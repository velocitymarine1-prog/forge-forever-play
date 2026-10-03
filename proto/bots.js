// FORGE FOREVER: the bots of the Battlegrounds (design pass 12 revision 3, sections 3.10 and 3.7a; built by build 7).
// The sword-brothers Edric, Osk and Tam (knights of the old castle guard a solo player may bring, 1 to 3, at seats 1 to 3: the bench
// bots' code with a brother's numbers), the bench bots (the same code counting as full knights, for the party tests) and the squire (the
// sim's stand-in for the player at seat 0, with its own numbers). A bot plays through the same per-seat input the page writes
// ({ move, strike, swap, dodge, ability }), so it tests the real rules, and the rules never know a bot from a thumb.
//
// Pure: no DOM, no clock, no Math.random. The brothers draw their numbers from fight.rng.bots (never fight.rand), so a run with them
// replays byte for byte; the squire draws from its own mulberry32 of the seed XOR 0x73717569, outside the fight (it is the player, not
// the rules), and sees only what a player sees: the view, the telegraphs and the marks at the view's edge (Level.edgeMarks).
//
//   Bots.brothers(n)             the seats for Combat.newFight(level, [player].concat(Bots.brothers(n)), seed): Edric (Sword, Bow), Osk
//                                (Hammer, Sword), Tam (Spear, Bow), kind "brother" (a quarter of a knight to the scaling; no drops, no pay)
//   Bots.bench(n)                the same seats as kind "bench": full knights to the rules and the scaling (Settings > Developer, ?party=n)
//   Bots.loadout("new" | "mid")  the sim's two loadouts by id (section 3.7a): Emberbane and the Sword; the Hammer and the Bow
//   Bots.party(fight, opts)      the brothers' (and the bench's) controller: party.step(dt, input0) -> the keyed input for Combat.step,
//                                seat 0's as given, each bot seat's its own. Called before every Combat.step; it reads the last step's
//                                fight.events for the telegraphs. opts.seats names the bot seats (default: every brother and bench seat)
//   Bots.squire(fight, opts)     the squire at seat 0: squire.step(dt) -> seat 0's input. opts: { seed (the fight's unless given), clumsy
//                                (the clumsier first-timer: dodge 0.5, step-off 0.5) }
//   Bots.drive(fight, opts)      the sim's one driver, the squire and the party together: drive.step(dt) -> the keyed input
//   Bots.ADAPT                   what the bots read of the level's director (stage E's proto/level.js): the chest, the gate, the exit, a
//                                sleeping Gallows Post, the stone rings and chunk shadows in flight (fight.marks), Level.edgeMarks
//
// The numbers are A.4's brothers, squire and rng blocks of spec/combat.json; until that file carries them, the same numbers stand here
// (DEFAULTS), so the blocks' arrival changes nothing. Plain script, defines window.Bots (module.exports in node).
(function (root) {
  "use strict";
  const PI = Math.PI;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  const unit = (x, y) => { const d = Math.hypot(x, y); return d > 1e-9 ? [x / d, y / d] : [1, 0]; };
  // the same mulberry32 as proto/combat.js's
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  let CB = null, PH = null;
  function combat() { if (!CB) CB = root.Combat || (typeof require === "function" ? require("./combat.js") : null); if (!CB) throw new Error("bots.js needs proto/combat.js (window.Combat)"); return CB; }
  function phys() { if (!PH) PH = root.Physics || (typeof require === "function" ? require("./physics.js") : null); if (!PH) throw new Error("bots.js needs proto/physics.js (window.Physics)"); return PH; }
  function data() { const D = root.FORGE_COMBAT; if (!D) throw new Error("bots.js needs spec/combat.js (window.FORGE_COMBAT)"); return D; }
  const trollCommon = () => ((root.FORGE_TROLLS || {}).common) || {};

  // ------------------------------------------------------------------ the numbers (A.4)
  const DEFAULTS = {
    brothers: { max: 3, weight: 0.25, names: ["Edric", "Osk", "Tam"], loadouts: [["sword", "bow"], ["hammer", "sword"], ["spear", "bow"]],
      hp: 100, think: 0.1, react: [0.25, 0.40], dodgeMelee: 0.5, stepOffLine: 0.5, leaveRing: 0.8, rollBurning: 0.6,
      guard: 120, follow: [48, 96], liftWithin: 160, thingsWhenClear: 80, bowAt: 80,
      climbs: false, ram: false, chest: false, camera: false, drops: false, pay: false },
    squire: { think: 0.1, react: [0.20, 0.35], dodgeMelee: 0.70, stepOffLine: 0.75, leaveRing: 0.90, leaveChunkShadow: 0.5, rollBurning: 0.60,
      clumsy: { dodgeMelee: 0.5, stepOffLine: 0.5 },
      meleeAt: 0.9, bowKeep: [80, 140], thingsWhenClear: 80, climbs: false, ram: false, wakesPost: false, wanders: 0, chest: true },
    rng: { bots: "0x626f7473", squire: "0x73717569" }
  };
  const brothersSpec = () => Object.assign({}, DEFAULTS.brothers, data().brothers || {});
  const squireSpec = () => Object.assign({}, DEFAULTS.squire, data().squire || {});
  const seedConst = key => Number(((data().rng || {})[key]) || DEFAULTS.rng[key]) >>> 0;
  // the brothers' stream inside the fight: a level's rules make fight.rng = { waves, marks, bots } (A.4); until they do, the same stream is
  // made here by the same formula, so nothing moves when they do
  function botsRng(fight) { if (!fight.rng) fight.rng = {}; if (!fight.rng.bots) fight.rng.bots = rng((fight.seed ^ seedConst("bots")) >>> 0); return fight.rng.bots; }

  // ------------------------------------------------------------------ the seats
  function weapon(id) {
    const t = (root.FORGE_THINGS || []).find(q => q.id === id && q.weapon) || ((root.FORGE_LEDGER || {}).rows || []).map(r => r.thing).find(q => q && q.id === id && q.weapon);
    if (!t) throw new Error("bots.js: no weapon " + id + " in spec/things.js or the ledger");
    return t;
  }
  // the brothers' seats, in their order, with the class weapons of the rack (never the player's); the bench's are the same code counting
  // as full knights, so they take the kind "bench" (the rules count every kind but "brother" as a whole knight)
  function brothers(n, kind) {
    const B = brothersSpec(), out = [];
    n = clamp(n | 0, 0, B.max);
    for (let i = 0; i < n; i++) out.push({ kind: kind || "brother", name: kind === "bench" ? "Bench " + (i + 1) : B.names[i], loadout: B.loadouts[i].map(weapon) });
    return out;
  }
  const bench = n => brothers(n, "bench");
  const LOADOUTS = { new: ["emberbrand", "sword"], mid: ["hammer", "bow"] };
  const loadout = which => (LOADOUTS[which] || LOADOUTS.new).map(weapon);

  // ------------------------------------------------------------------ what the bots read of the level's director (stage E)
  // Each reads the director's state where it has it and sees nothing where it has not, so the bots run on a fight with no director (a
  // test's scripted trolls), and stage F fills these in against proto/level.js as it lands.
  const ADAPT = {
    // the stones in flight (a trebuchet's: its ring r 16 at the landing point) and the chunks' shadows, each { id, x, y, r } (section 3.6a)
    rings(fight) { const M = fight.marks; return M && M.stone ? M.stone : []; },
    shadows(fight) { const M = fight.marks; return M && M.chunk ? M.chunk : []; },
    // the marks at the view's edge for the trolls off the screen (section 3.7a: Level.edgeMarks gives them in view px, as the painter draws
    // them; the squire walks to where a mark sits on the screen, so each comes back as a world point), nothing without them
    edgeMarks(fight) { const L = root.Level, v = fight.view || { x0: 0, y0: 0 }; return L && typeof L.edgeMarks === "function" ? (L.edgeMarks(fight) || []).map(m => Object.assign({}, m, { x: m.x + v.x0, y: m.y + v.y0 })) : []; },
    // the Gallows Post sleeps until it is hit or neared (section 3.6): its huts are left alone while it does
    postAwake(fight) { const L = fight.level || {}; return !!(L.postAwake || (L.gallows && L.gallows.awake) || (L.post && L.post.awake)); },
    // the iron chest, standing shown and unopened: { x, y } (section 3.4)
    chest(fight) { const L = fight.level || {}, c = L.chest; return c && c.shown && !c.open ? c : null; },
    // the gate has burst, so the exit zone takes the party in
    gateOpen(fight) { const L = fight.level || {}; if (L.gateOpen !== undefined) return !!L.gateOpen; const g = (fight.pieces || []).find(p => p.kind === "gate"); return !!(g && g.broken); },
    // the director's own goal for the squire, { x, y }, when it gives one
    goal(fight) { const L = fight.level || {}; return L.goal || null; }
  };

  // ------------------------------------------------------------------ what a bot sees
  const standing = k => combat().standing(k);
  const alive = f => !f.dead && !(f.spawn > 0);
  const foes = fight => (fight.foes || []).filter(alive);
  const inView = (fight, b) => combat().inView(fight, b);
  const up = b => (b.z || 0) > 12;   // on the roof, the tower deck, a breach or up the stair: above the ground by more than a step (the drawbridge deck is at the ground's height: a knight on it is followed, not guarded from the chapel stair's foot)
  const targetOf = f => f.brain ? f.brain.target : f.act ? f.act.seat : null;   // the seat a troll is on
  const isBrute = f => !!f.spec && f.spec.tokens === false;
  const isRanged = f => !!(f.spec && f.spec.keep);
  const baseOf = h => ((h.thing.weapon || {}).visual || {}).base || null;
  const handOf = (k, base) => k.hands.findIndex(h => baseOf(h) === base);
  const hasBow = k => handOf(k, "bow") >= 0;
  const nearestOf = (list, x, y) => { let best = null, bd = Infinity; for (const b of list) { const d = dist(b.x, b.y, x, y); if (d < bd) { bd = d; best = b; } } return best; };
  const toward = (k, x, y, tilt) => { const [ux, uy] = unit(x - k.x, y - k.y); return [ux * tilt, uy * tilt]; };
  // an attack's numbers by its name (an alias, "club": "footman", read through)
  function attackOf(f, name) { const A = (f.spec || {}).attacks || {}; let a = A[name]; if (typeof a === "string") a = (((root.FORGE_TROLLS || {})[a] || {}).attacks || {})[name]; return a || {}; }

  // the brothers' and the squire's own class on the trolls' field set: a knight's body with the trolls' costs for fire, ice, craters and
  // holes, no ladder and no stair rows (section 3.10: a brother never climbs); pinned, so its fields are kept with no troll alive
  function knightClass(fight) {
    const FS = fight.fields;
    if (FS && FS.classes && FS.classes.knight) return;
    const KN = data().knight, C0 = trollCommon(), PA = C0.path || {};
    combat().fieldClass(fight, "knight", { r: KN.r, h: KN.h || 24, fits: KN.r, mass: KN.mass || 1, cost: Object.assign({}, C0.avoidCost || {}), narrow: false, ladder: null, stairUp: PA.stairUp || 1.25, drop: PA.drop || 24, tears: null, tearCost: 1, clods: true })   // clods block a knight (it cannot break or step over them), so its own field walks round them;
  }
  // a clear straight way for the knight's body along (ux, uy) for len px: no solid at its height, no deep hole
  function wayClear(fight, k, ux, uy, len) {
    const P = phys(), W = fight.world, probe = { x: k.x, y: k.y, z: k.z || 0, r: k.r, h: k.h || 24, on: k.on || null, knight: true };
    for (let t = 4; t <= len; t += 4) { probe.x = k.x + ux * t; probe.y = k.y + uy * t; if (P.caught(W, probe, probe.x, probe.y) || (!k.on && P.groundAt(W, probe.x, probe.y).deep)) return false; }
    return true;
  }
  // the next point on the way to a target { x, y, r?, id?, on?, z?, knight? }: straight when within 64 px and clear; else down the knight
  // class's field (toward a standing knight the rules' own field for it; toward a troll, a piece or a point a field of the bot's own,
  // seeded there, rebuilt every 0.5 s and when the target or the world changes); else straight
  function stepToward(fight, bot, k, tgt) {
    const dx = tgt.x - k.x, dy = tgt.y - k.y, dd = Math.hypot(dx, dy), [ux, uy] = unit(dx, dy);
    if (dd <= 64 && wayClear(fight, k, ux, uy, Math.max(0, dd - k.r - (tgt.r || 0)))) return { x: tgt.x, y: tgt.y };
    const nx = tgt.knight && standing(tgt) ? (combat().nextToward(fight, k, tgt, "knight") || knightFieldNear(fight, k, tgt)) : ownField(fight, bot, k, tgt);
    return nx ? { x: nx.x, y: nx.y } : { x: tgt.x, y: tgt.y };
  }
  function ownField(fight, bot, k, tgt) {
    const FS = fight.fields, P = phys();
    if (!FS || !FS.set || !FS.set.cls.knight) return null;
    const set = FS.set, key = tgt.id !== undefined ? "b" + tgt.id : Math.round(tgt.x) + "," + Math.round(tgt.y), every = (trollCommon().path || {}).rebuild || 0.5;
    let p = bot.path;
    if (!p || p.set !== set) p = bot.path = { set, F: P.field(set, "knight"), key: null, t: 1e9 };
    if (p.key !== key || p.t >= every - 1e-9 || p.F.ver !== set.ver) { P.fieldBuild(set, p.F, P.fieldSeeds(set, "knight", { x: tgt.x, y: tgt.y, z: tgt.z || 0, on: tgt.on || null, climbing: null })); p.key = key; p.t = 0; }
    if (k.x < set.box.x0 - 8 || k.x > set.box.x1 + 8 || k.y < set.box.y0 - 8 || k.y > set.box.y1 + 8) return null;
    const n0 = P.nodeOf(set, k), nx = P.fieldNext(set, p.F, n0);
    if (nx) { const [x, y] = P.nodeAt(set, nx.n); return { x, y, kind: nx.kind }; }
    // nothing leads on from here: at the seed itself (a target outside the set's box) the straight way; from a node the class cannot stand
    // on (the knight wedged against a boulder's footprint, where the field has no value) the nearest reached node
    const c = set.cls.knight; if (!c || c.ok[n0]) return null;
    return reachedNear(fight, k, set, c, p.F.dist, n0);
  }
  // the rules' field of a knight (the brothers' and the bench bots' way to the player) from a node the knight class cannot stand on: a body
  // on the drawbridge deck whose cell's centre lies over the moat, or against the chest; the nearest reached node
  function knightFieldNear(fight, k, tgt) {
    const FS = fight.fields, P = phys(); if (!FS || !FS.set || !FS.set.cls.knight) return null;
    const r = (FS.list || []).find(q => q.seat === tgt.seat && q.cls === "knight" && q.F && q.F.built); if (!r) return null;
    const set = FS.set, c = set.cls.knight, n0 = P.nodeOf(set, k); if (c.ok[n0]) return null;
    return reachedNear(fight, k, set, c, r.F.dist, n0);
  }
  // the nodes within two cells of n0 that the field reaches, the nearest by its cost plus the way to it that a straight walk from the knight
  // can take (else the nearest), so a wedged knight is not sent through what wedges it
  function reachedNear(fight, k, set, c, D, n0) {
    const L = set.layers[set.lay[n0]]; if (!L || !D || (L.kind !== "grid" && L.kind !== "ground")) return null;
    const i0 = n0 - L.i0, ci = i0 % L.nx, cj = (i0 - ci) / L.nx, cands = [];
    for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) { const i2 = ci + di, j2 = cj + dj; if ((!di && !dj) || i2 < 0 || j2 < 0 || i2 >= L.nx || j2 >= L.ny) continue; const m = L.i0 + j2 * L.nx + i2; if (!c.ok[m] || !(D[m] < Infinity)) continue; cands.push([D[m] + dist(k.x, k.y, set.x[m], set.y[m]), m]); }
    if (!cands.length) return null;
    cands.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    for (const [, m] of cands) { const dx = set.x[m] - k.x, dy = set.y[m] - k.y, d = Math.hypot(dx, dy); if (d < 1e-6 || wayClear(fight, k, dx / d, dy / d, d)) return { x: set.x[m], y: set.y[m], kind: "walk" }; }
    const m = cands[0][1]; return { x: set.x[m], y: set.y[m], kind: "walk" };
  }
  // where a brother guards when the player is up (section 3.10): the foot of the ladder to its deck, else the foot of the stair
  function footOf(fight, p) {
    const W = fight.world, A = fight.area || {};
    for (const L of W.ladders || []) if (L.deck === p.on) return [L.foot[0] - L.into[0] * 14, L.foot[1] - L.into[1] * 14];
    const S = (A.surfaces || []).find(s => s.kind === "stair");
    if (!S) return null;
    const r = S.rect, y = S.pathRow !== undefined ? S.pathRow : (r[1] + r[3]) / 2;
    return S.rise === "e" ? [r[0] - 12, y] : S.rise === "w" ? [r[2] + 12, y] : S.rise === "n" ? [(r[0] + r[2]) / 2, r[3] + 12] : [(r[0] + r[2]) / 2, r[1] - 12];
  }
  // the standing things a bot may hit (section 3.10: a hut, a tent, the engine, the gate; the squire also fells the watchtower when it has no
  // bow): aim targets in the view, never a hut of the sleeping Gallows Post
  const gallowsId = fight => { const op = ((fight.area || {}).outposts || []).find(o => o.wake); return op ? op.id : null; };
  function nearestThing(fight, k, tower) {
    const asleep = !ADAPT.postAwake(fight), gid = gallowsId(fight);
    let best = null, bd = Infinity;
    for (const p of fight.pieces || []) {
      if (!p.aim || p.gone || p.broken || p.active === false) continue;
      if (!(p.kind === "hut" || p.kind === "tent" || p.kind === "engine" || p.kind === "gate" || (tower && p.kind === "tower"))) continue;
      if (asleep && gid !== null && p.outpost === gid) continue;
      if (!inView(fight, p)) continue;
      const d = dist(p.x, p.y, k.x, k.y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  // ------------------------------------------------------------------ a bot
  function newBot(seat, N, who) { return { seat, who, N, think: 0, mode: "follow", tid: null, lift: null, path: null, evade: null, queue: [], seen: {}, swapT: 0, goal: null }; }
  // a telegraph starts (the last step's events): a melee wind-up whose area covers me, a slam's ring I stand in, a charge's strip I stand on
  // (dodged, dodgeMelee), an aim line on me (stepped off, stepOffLine), a burn on me (rolled out, rollBurning); each rolled once, then
  // done 0.25 to 0.40 s later (the squire 0.20 to 0.35)
  function react(fight, bot, k, R, e) {
    const N = bot.N;
    const roll = (p, kind, ax, ay, hold) => { if (R() >= p) return; bot.queue.push({ at: fight.t + N.react[0] + (N.react[1] - N.react[0]) * R(), kind, ax, ay, hold: hold || 0 }); };
    if (e.type === "windUp") {
      const f = (fight.foes || []).find(q => q.id === e.foe); if (!f) return;
      const tel = e.tel || {}, [ax, ay] = unit(k.x - f.x, k.y - f.y);
      if (tel.kind === "ring") { if (dist(k.x, k.y, tel.x, tel.y) <= tel.r + k.r + 4) { const [bx, by] = unit(k.x - tel.x, k.y - tel.y); roll(N.dodgeMelee, "dodge", bx, by); } }
      else if (tel.kind === "strip") {
        const lx = tel.x1 - tel.x0, ly = tel.y1 - tel.y0, ll = Math.hypot(lx, ly) || 1, t = clamp(((k.x - tel.x0) * lx + (k.y - tel.y0) * ly) / (ll * ll), 0, 1);
        const px = tel.x0 + lx * t, py = tel.y0 + ly * t, off = dist(k.x, k.y, px, py);
        if (off <= (tel.w || 22) / 2 + k.r + 6) { const side = (k.x - px) * -ly + (k.y - py) * lx >= 0 ? 1 : -1; roll(N.dodgeMelee, "dodge", -ly / ll * side, lx / ll * side); }
      } else {
        const atk = attackOf(f, e.attack), reach = (atk.reach || atk.range || 22) + k.r + 8;
        if (atk.projectile) return;   // a shot's draw is no melee wind-up: its aim line is answered below (section 3.7a's "steps off an aim line"), never a dodge away from a troll it must close on
        if ((e.seat === k.seat || dist(k.x, k.y, f.x, f.y) <= reach) && Math.abs((k.z || 0) - (f.z || 0)) <= 12) roll(N.dodgeMelee, "dodge", ax, ay);
      }
    } else if (e.type === "aimLine" && e.seat === k.seat) {
      const [lx, ly] = unit(e.x1 - e.x0, e.y1 - e.y0), side = R() < 0.5 ? 1 : -1;
      roll(N.stepOffLine, "step", -ly * side, lx * side, 0.3);
    } else if (e.type === "kstatus" && e.status === "burning" && e.on && e.seat === k.seat) roll(N.rollBurning, "dodge", Math.cos(k.face), Math.sin(k.face));
  }
  // the marks that are not events: a stone's ring I stand in is left (leaveRing), a chunk's shadow over me too (the squire by its own
  // number); each mark rolled once, by its id
  function readMarks(fight, bot, k, R) {
    const N = bot.N;
    const look = (list, p, tag) => {
      for (const m of list) {
        const id = tag + (m.id !== undefined ? m.id : Math.round(m.x) + "," + Math.round(m.y));
        if (bot.seen[id]) continue;
        bot.seen[id] = true;
        const r = (m.r || 16) + k.r + 4;
        if (dist(k.x, k.y, m.x, m.y) > r || R() >= p) continue;
        bot.queue.push({ at: fight.t + N.react[0] + (N.react[1] - N.react[0]) * R(), kind: "leave", cx: m.x, cy: m.y, r: r + 2 });
      }
    };
    look(ADAPT.rings(fight), N.leaveRing, "s");
    look(ADAPT.shadows(fight), N.leaveChunkShadow === undefined ? N.leaveRing : N.leaveChunkShadow, "c");
  }
  // the reactions due now: a dodge is a press along its way; a step or a leave takes the stick for its while
  function due(fight, bot, k, out) {
    let pressed = false;
    for (let i = bot.queue.length - 1; i >= 0; i--) {
      const q = bot.queue[i];
      if (q.at > fight.t + 1e-9) continue;
      bot.queue.splice(i, 1);
      if (q.kind === "dodge") { if (!pressed) { out.dodge = true; out.move = [q.ax, q.ay]; pressed = true; } }
      else if (q.kind === "step") bot.evade = { kind: "step", ax: q.ax, ay: q.ay, until: fight.t + q.hold };
      else bot.evade = { kind: "leave", cx: q.cx, cy: q.cy, r: q.r, until: fight.t + 1.5 };
    }
    return pressed;
  }
  // the weapon a bot wants in hand for a target (section 3.10, section 3.7a's table): a brother's Bow (Edric, Tam) for a troll up, in a
  // breach or more than 80 px away (kept until it comes within 64), else its melee weapon; Osk's Hammer for a brute, his Sword for the
  // rest; the squire's Hammer for a brute, its Bow for a ranged troll over 80 px away or above the ground, with Emberbane the Sword for the
  // Emberback, else its first weapon
  function wantHand(bot, k, f) {
    const hands = k.hands;
    if (hands.length < 2) return k.active;
    const bow = handOf(k, "bow"), hammer = handOf(k, "hammer"), plain = hands.findIndex(h => baseOf(h) === "sword" && h.u.element !== "fire");
    const dd = dist(k.x, k.y, f.x, f.y), at = bot.N.bowAt || 80, far = up(f) || dd > (k.active === bow && bow >= 0 ? at - 16 : at);
    if (bot.who === "squire") {
      if (isBrute(f) && hammer >= 0) return hammer;
      if (isRanged(f) && far && bow >= 0) return bow;
      if (f.kind === "emberback" && plain >= 0 && hands[0].u.element === "fire") return plain;   // Emberbane's fire is resisted: the plain Sword
      return 0;
    }
    if (bow >= 0) return far ? bow : 1 - bow;
    if (hammer >= 0) return isBrute(f) ? hammer : 1 - hammer;
    return 0;
  }
  // the fight with a target (a troll or a thing): the wanted weapon in hand, then in melee closing to 0.9 of the reach (plus its radius), a
  // nudge of the stick to face it and Strike held; with the bow, standing 80 to 140 px off (inside the bow's range), facing it and loosing
  function fightInput(fight, bot, k, f, out, swapTo) {
    const N = bot.N, want = swapTo === undefined ? wantHand(bot, k, f) : swapTo;
    if (want !== k.active && k.hands.length > 1 && k.swapT <= 0 && bot.swapT <= 0) { out.swap = true; bot.swapT = 0.5; return; }
    const u = k.hands[k.active].u, dd = dist(k.x, k.y, f.x, f.y), face = () => { out.move = toward(k, f.x, f.y, 0.06); out.strike = true; };
    if (u.melee) {
      const reach = combat().reachOf(u) * (N.meleeAt || 0.9) + (f.r || 0);
      if (dd > reach || Math.abs((k.z || 0) - (f.z || 0)) > 12) { const s = stepToward(fight, bot, k, f); out.move = toward(k, s.x, s.y, 1); }
      else face();
    } else {
      const keep = N.bowKeep || [80, 140], range = combat().reachOf(u), lo = keep[0], hi = Math.min(keep[1], range * 0.9);
      const blocked = f.id !== undefined && !f.piece && !combat().lineClear(fight, { x: k.x, y: k.y, z: k.z || 0, chest: (data().knight || {}).chest || 12 }, f);   // a shot-stopping solid between: a hut's ruin, a stone
      if (dd > hi || blocked) { const s = stepToward(fight, bot, k, f); out.move = toward(k, s.x, s.y, 1); }
      else if (dd < lo && !up(f) && !f.piece) out.move = toward(k, f.x, f.y, -1);
      else face();
    }
  }
  // the follow (section 3.10): 48 to 96 px from the player's knight; when it is up, the foot of its ladder or stair, 12 to 32 px off
  // a knight pressed against something it did not mean to stand at (a clod the fields leave out, a rock's edge, the chest on the deck, two
  // ways it flips between) steps round it: with its stick pushed for 0.5 s and its feet not 4 px from where they were, the push is turned
  // 60 degrees to one side (its own stream picks the side) for 0.3 s, as a player shoulders past what it bumps into; a dodge, an evade or
  // a knight not standing resets the count, and so does a push held on purpose (the stick into the gate in the exit zone)
  function shoulder(fight, bot, k, out, R, dt) {
    if (!k || !out || !out.move) return;
    const S = bot.stuck || (bot.stuck = { x: k.x, y: k.y, t: 0, side: 1, until: -1 });
    if (bot.press === fight.t) { S.x = k.x; S.y = k.y; S.t = 0; S.until = -1; return; }
    const turn = () => { const a = S.side * Math.PI / 3, c = Math.cos(a), sn = Math.sin(a), mx = out.move[0], my = out.move[1]; out.move = [c * mx - sn * my, sn * mx + c * my]; };
    if (fight.t < S.until) { turn(); return; }
    const want = Math.hypot(out.move[0], out.move[1]) > 0.5 && !out.dodge && !bot.evade && standing(k) && !k.climbing && !k.air;
    if (!want) { S.x = k.x; S.y = k.y; S.t = 0; return; }
    S.t += dt;
    if (S.t >= 0.5 - 1e-9) {
      const far = dist(k.x, k.y, S.x, S.y) >= 4; S.x = k.x; S.y = k.y; S.t = 0;
      if (far) { S.runs = 0; return; }
      // a clod in the way breaks to any blow (section 3.3: "marks made in a fight never close a lane"): it strikes through it, else it turns;
      // while no progress comes it keeps the side it took and holds the turn longer (0.3, 0.6, 1.2 s), as a player walks round a boulder
      const clod = clodAhead(fight, k, out.move, (S.runs || 0) >= 2);   // wedged a second or more: any clod in reach, whichever side (a pocket between a boulder and a clod)
      if (clod) { S.strikeUntil = fight.t + 0.6; S.clod = clod; }
      else {
        S.runs = (S.runs || 0) + 1; if (S.runs === 1) S.side = R() < 0.5 ? 1 : -1;
        // wedged on the drawbridge deck (beside the chest in a lane it closes): a dodge toward the deck's middle, as a player rolls out of a corner
        const Q = k.on ? fight.world.platBy[k.on] : null;
        if (Q && Q.shape === "uv" && S.runs >= 3 && !(k.dodgeCd > 0)) { const vc = (Q.v0 + Q.v1) / 2, sg = (k.x + k.y) <= vc ? 1 : -1; out.move = [sg / Math.SQRT2, sg / Math.SQRT2]; out.dodge = true; S.until = -1; return; }
        S.until = fight.t + Math.min(1.2, 0.3 * Math.pow(2, S.runs - 1)); turn();
      }
    }
    if (S.strikeUntil > fight.t && S.clod && !S.clod.gone) { out.move = toward(k, S.clod.x, S.clod.y, 0.3); out.strike = true; }
  }
  // the nearest standing clod within a blow's reach and 60 degrees of the push (any side when `any`)
  function clodAhead(fight, k, mv, any) {
    const l = Math.hypot(mv[0], mv[1]); if (l < 1e-6 && !any) return null; const ux = l < 1e-6 ? 1 : mv[0] / l, uy = l < 1e-6 ? 0 : mv[1] / l;
    let best = null, bd = Infinity;
    for (const s of fight.world.solids) { if (s.kind !== "clod" || s.gone) continue; const dx = s.x - k.x, dy = s.y - k.y, d = Math.hypot(dx, dy); if (d > k.r + s.r + 14 || (!any && (dx * ux + dy * uy) / (d || 1) < 0.5) || d >= bd) continue; bd = d; best = s; }
    return best;
  }
  function followInput(fight, bot, k, out) {
    const N = bot.N, p = fight.knights[0];
    if (!p || !standing(p) || p === k) return;
    let tgt = p, lo = N.follow[0], hi = N.follow[1];
    if (up(p)) { const ft = footOf(fight, p); if (ft) { tgt = { x: ft[0], y: ft[1], r: 0 }; lo = 12; hi = 32; } }
    // a leader standing still (at a wave's trigger it waits for the party's mean: the bank before the horn) is closed up on to the band's
    // near end, so a party's mean reaches where its leader stands; a walking leader is followed anywhere in the band
    const still = bot.pl && Math.hypot(p.x - bot.pl[0], p.y - bot.pl[1]) < 0.5; bot.pl = [p.x, p.y];
    if (still && tgt === p) hi = Math.min(hi, lo + 12);
    const dd = dist(k.x, k.y, tgt.x, tgt.y);
    if (dd > hi) { const s = stepToward(fight, bot, k, tgt); out.move = toward(k, s.x, s.y, 1); }
    else if (dd < lo) out.move = toward(k, tgt.x, tgt.y, -1);
  }
  // the lift (section 3.10): to the downed knight, then standing by it (the rules lift by proximity, 2.0 s)
  function liftInput(fight, bot, k, out) {
    const d = fight.knights[bot.lift];
    if (!d || !d.down) { bot.lift = null; return false; }
    const within = ((data().downed || {}).lift || {}).within || 16;
    if (dist(k.x, k.y, d.x, d.y) > within - 5) { const s = stepToward(fight, bot, k, d); out.move = toward(k, s.x, s.y, 1); }
    return true;
  }
  // the common part of a bot's step: nothing while carried off, in a wipe, rising, frozen, on a ladder or in the air; a crawl toward the
  // nearest standing knight while down; the telegraphs read and the reactions due; the think clock. Returns the input, or null when the
  // bot is free to decide and act this step
  function common(fight, bot, k, R, dt, out) {
    if (!k || k.out || fight.wipe) return out;
    for (const e of fight.events || []) react(fight, bot, k, R, e);
    if (bot.path) bot.path.t += dt;
    bot.swapT = Math.max(0, bot.swapT - dt);
    bot.think -= dt;
    if (k.down) { const a = nearestOf(fight.knights.filter(q => q !== k && standing(q)), k.x, k.y); if (a) out.move = toward(k, a.x, a.y, 1); return out; }
    if (k.rise > 0 || k.frozen > 0 || k.climbing || k.air) { bot.queue.length = 0; return out; }
    if (due(fight, bot, k, out)) return out;
    if (bot.evade) {
      const E = bot.evade;
      if (fight.t >= E.until || (E.kind === "leave" && dist(k.x, k.y, E.cx, E.cy) > E.r)) bot.evade = null;
      else { out.move = E.kind === "leave" ? toward(k, E.cx, E.cy, -1) : [E.ax, E.ay]; return out; }
    }
    return null;
  }

  // ------------------------------------------------------------------ the sword-brothers (and the bench)
  // every 0.1 s a brother decides: the lift the party gave it; else its target by section 3.10's tiers (a troll on the player's knight
  // within 120 px of it, else a troll on itself, else the nearest troll in the view; one it can only reach with a bow it has none of is
  // not its); else, with no troll within 80 px, the nearest standing thing; else the follow
  function brotherDecide(fight, bot, k) {
    const N = bot.N, p = fight.knights[0], FO = foes(fight).filter(f => inView(fight, f)), bow = hasBow(k);
    bot.mode = "follow"; bot.tid = null;
    if (bot.lift !== null) { bot.mode = "lift"; return; }
    const can = f => bow || (!up(f) && Math.abs((k.z || 0) - (f.z || 0)) <= 12);
    const onP = FO.filter(f => can(f) && targetOf(f) === 0 && p && standing(p) && dist(f.x, f.y, p.x, p.y) <= N.guard);
    const onMe = FO.filter(f => can(f) && targetOf(f) === k.seat);
    const rest = FO.filter(f => can(f) && (bow || dist(f.x, f.y, k.x, k.y) <= N.guard || (p && dist(f.x, f.y, p.x, p.y) <= N.guard)));
    const pool = onP.length ? onP : onMe.length ? onMe : rest;
    if (pool.length) { bot.tid = nearestOf(pool, k.x, k.y).id; bot.mode = "fight"; return; }
    if (!foes(fight).some(f => can(f) && dist(f.x, f.y, k.x, k.y) <= N.thingsWhenClear)) { const t = nearestThing(fight, k, false); if (t) { bot.tid = t; bot.mode = "thing"; return; } }
  }
  function brotherInput(fight, party, bot, dt) { const out = brotherInput0(fight, party, bot, dt); shoulder(fight, bot, fight.knights[bot.seat], out, botsRng(fight), dt); return out; }
  function brotherInput0(fight, party, bot, dt) {
    const k = fight.knights[bot.seat], R = botsRng(fight), out = { move: [0, 0], strike: false, swap: false, dodge: false, ability: false };
    const held = common(fight, bot, k, R, dt, out);
    if (held) return held;
    readMarks(fight, bot, k, R);
    if (bot.think <= 0) { bot.think += bot.N.think; brotherDecide(fight, bot, k); }
    if (bot.mode === "lift" && liftInput(fight, bot, k, out)) return out;
    if (bot.mode === "fight") { const f = (fight.foes || []).find(q => q.id === bot.tid); if (f && alive(f)) { fightInput(fight, bot, k, f, out); return out; } }
    if (bot.mode === "thing") { const t = bot.tid; if (t && !t.gone && !t.broken && t.active !== false) { fightInput(fight, bot, k, t, out, 0); return out; } }
    followInput(fight, bot, k, out);
    return out;
  }
  // the lifts, given by the party: for each downed knight the nearest standing brother within 160 px (one lifter a knight, a lifter one
  // knight at a time), unless a troll is winding up at its spot
  function assignLifts(fight, party) {
    const K = fight.knights, N = party.N;
    for (const b of party.bots) if (b.lift !== null) { const d = K[b.lift], k = K[b.seat]; if (!d || !d.down || !k || !standing(k)) b.lift = null; }
    for (const d of K) {
      if (!d.down || party.bots.some(b => b.lift === d.seat)) continue;
      if (foes(fight).some(f => f.act && f.act.phase === "wind" && (f.act.seat === d.seat || dist(f.x, f.y, d.x, d.y) <= 30))) continue;
      let best = null, bd = Infinity;
      for (const b of party.bots) { const k = K[b.seat]; if (!k || !standing(k) || k.frozen > 0 || b.lift !== null) continue; const dd = dist(k.x, k.y, d.x, d.y); if (dd <= N.liftWithin && dd < bd) { bd = dd; best = b; } }
      if (best) best.lift = d.seat;
    }
  }
  function party(fight, opts) {
    opts = opts || {};
    if (!fight.level) throw new Error("bots.js: the bots play in a level");
    knightClass(fight); botsRng(fight);
    const B = brothersSpec(), seats = opts.seats || fight.knights.filter(k => k.seat > 0 && (k.kind === "brother" || k.kind === "bench")).map(k => k.seat);
    const P = { N: B, seats, bots: seats.map(s => newBot(s, B, "brother")),
      step(dt, input0) {
        assignLifts(fight, P);
        const out = [input0 || {}];
        for (let s = 1; s < fight.knights.length; s++) out[s] = {};
        for (const b of P.bots) out[b.seat] = brotherInput(fight, P, b, dt);
        return out;
      } };
    return P;
  }

  // ------------------------------------------------------------------ the squire (section 3.7a)
  // the squire's plan with no troll in sight: the director's goal; the chest (opened by use); the exit when the gate has burst (the stick
  // pushed toward the gate, up and right, as the cellar's stairs are left); the nearest mark at the view's edge; else east, to the heart
  // of the next arena (the view's centre over it, or the bank past the horn line in the last), where the waves start; it never wanders
  function plan(fight, k) {
    const A = fight.area || {};
    const g = ADAPT.goal(fight); if (g) return g;
    const ch = ADAPT.chest(fight); if (ch) return { x: ch.x, y: ch.y, r: ch.r || 6, use: true };
    if (ADAPT.gateOpen(fight)) { const Z = (A.zones || {}).exit; if (Z && Z.u) { const u = (Z.u[0] + Z.u[1]) / 2, v = (Z.v[0] + Z.v[1]) / 2; return { x: (u + v) / 2, y: (v - u) / 2, exit: true }; } }
    const marks = ADAPT.edgeMarks(fight).filter(m => m && m.x !== undefined && m.y !== undefined);
    if (marks.length) {
      // a mark at the view's edge means a troll beyond it: the squire walks past the mark, 64 px on in the mark's direction (its `dir`, eighths
      // of a turn from the view's centre; a mark slid along the edge into the thumbs' band still points the way), so the camera follows it
      // down or across until the troll is in view and the fight takes over; walking to the mark itself chased a point that moved with the view
      // a dotted mark is a manned trebuchet's: the engine never moves and the player has seen it, so the squire walks to its post (the winchman
      // stands there, the last troll left after the burst as often as not), wherever the mark slid to along the edge
      const dotted = marks.find(m => m.dot), E = dotted ? (fight.engines || []).find(e => e.manned && !e.wrecked) : null;
      if (E) { const at = E.post || E; return { x: at.x, y: at.y, mark: true }; }
      const m = nearestOf(marks, k.x, k.y), v = fight.view || { x0: 0, y0: 0, x1: 384, y1: 216 }, F = fight.floor || { x0: -Infinity, y0: -Infinity, x1: Infinity, y1: Infinity };
      let a; if (m.dir !== undefined) a = m.dir * Math.PI / 4; else a = Math.atan2(m.y - (v.y0 + v.y1) / 2, m.x - (v.x0 + v.x1) / 2);
      return { x: clamp(m.x + Math.cos(a) * 64, F.x0 + 8, F.x1 - 8), y: clamp(m.y + Math.sin(a) * 64, F.y0 + 8, F.y1 - 8), mark: true };
    }
    for (const a of A.arenas || []) { const x = a.hornLine ? Math.max(a.rally, a.hornLine + 30) : a.x0 + 192; if (x > k.x + 8) return { x, y: (a.rallyY || [200])[0] }; }
    return null;
  }
  // the squire decides every 0.1 s: the nearest troll in the view it can fight (any with a bow; one on the ground within 12 px of its
  // height without); with no troll within 80 px, the nearest standing thing (the watchtower too when it has no bow); else its plan
  function squireDecide(fight, bot, k) {
    const N = bot.N, bow = hasBow(k), can = f => bow || (!up(f) && Math.abs((k.z || 0) - (f.z || 0)) <= 12), FO = foes(fight).filter(f => inView(fight, f) && can(f));
    // its target is kept while it holds (a troll stepping a pixel out of the view, a hut at the view's edge, would otherwise flip it every think)
    const cur = bot.mode === "fight" ? (fight.foes || []).find(q => q.id === bot.tid) : null, curThing = bot.mode === "thing" ? bot.tid : null;
    if (cur && alive(cur) && can(cur) && inViewPad(fight, cur, 32)) { const near = FO.length ? nearestOf(FO, k.x, k.y) : null; if (!near || near === cur || dist(near.x, near.y, k.x, k.y) + 24 >= dist(cur.x, cur.y, k.x, k.y)) return; }
    if (curThing && !FO.length && !curThing.gone && !curThing.broken && curThing.active !== false && inViewPad(fight, curThing, 32) && !foes(fight).some(f => can(f) && dist(f.x, f.y, k.x, k.y) <= N.thingsWhenClear)) return;
    bot.mode = "plan"; bot.tid = null;
    if (FO.length) { bot.tid = nearestOf(FO, k.x, k.y).id; bot.mode = "fight"; return; }
    // "no troll within 80 px" counts the trolls it could fight: the tower archer above a knight with no bow is answered by felling the tower
    if (!foes(fight).some(f => can(f) && dist(f.x, f.y, k.x, k.y) <= N.thingsWhenClear)) { const t = nearestThing(fight, k, !bow); if (t) { bot.tid = t; bot.mode = "thing"; return; } }
    bot.goal = plan(fight, k);
  }
  function squireInput(fight, Q, bot, dt) { const out = squireInput0(fight, Q, bot, dt); shoulder(fight, bot, fight.knights[0], out, Q.rng, dt); return out; }
  function squireInput0(fight, Q, bot, dt) {
    const k = fight.knights[0], out = { move: [0, 0], strike: false, swap: false, dodge: false, ability: false };
    const held = common(fight, bot, k, Q.rng, dt, out);
    if (held) return held;
    readMarks(fight, bot, k, Q.rng);
    if (bot.think <= 0) { bot.think += bot.N.think; squireDecide(fight, bot, k); }
    if (bot.mode === "fight") { const f = (fight.foes || []).find(q => q.id === bot.tid); if (f && alive(f)) { fightInput(fight, bot, k, f, out); return out; } }
    if (bot.mode === "thing") { const t = bot.tid; if (t && !t.gone && !t.broken && t.active !== false) { fightInput(fight, bot, k, t, out, 0); return out; } }
    const g = bot.goal;
    if (!g) return out;
    const dd = dist(k.x, k.y, g.x, g.y);
    if (g.exit) {
      // to the zone: by its field until it stands on the deck, then straight along the deck in the lane beside the chest on its own side (the
      // chest stands on the centre line at the zone's mouth, and the 8 px grid has no sure way past it); in the zone the stick is held toward
      // the gate, up and right (no shouldering: the page's exit wants the dwell)
      const Q = k.on ? fight.world.platBy[k.on] : null, onDeck = !!(Q && Q.shape === "uv"), tgt = onDeck ? laneGoal(fight, k, Q, g) : g;
      if (inExitZone(fight, k)) { out.move = [0.7, -0.7]; bot.press = fight.t; }
      else if (onDeck) out.move = toward(k, tgt.x, tgt.y, 1);
      else { const s = stepToward(fight, bot, k, g); out.move = toward(k, s.x, s.y, 1); }
      return out;
    }
    if (g.use && dd <= (g.r || 6) + 10) { out.use = true; return out; }   // the chest: a tap on the prompt or E, for the director
    if (dd > 4) { const s = stepToward(fight, bot, k, g); out.move = toward(k, s.x, s.y, 1); }
    return out;
  }
  // the point of the exit zone to walk to along the deck: the zone's u, and a v in the lane beside the chest (12 to 18 px from it, so 15:
  // 21 u-units off its line) on the knight's side, kept 12 u-units (8.5 px) inside the deck's edges and inside the zone
  function laneGoal(fight, k, Q, g) {
    const A = fight.area || {}, Z = (A.zones || {}).exit, ch = fight.chest, u = Z && Z.u ? (Z.u[0] + Z.u[1]) / 2 : g.x - g.y;
    const vc = ch && ch.shown ? ch.x + ch.y : g.x + g.y, mine = (k.x + k.y) >= vc ? 1 : -1;
    // the lane on its own side unless the chest stands off the centre and squeezes it shut (then the other side has the room)
    const lane = side => { const want = vc + side * 21; let v = clamp(want, Q.v0 + 12, Q.v1 - 12); if (Z && Z.v) v = clamp(v, Z.v[0] + 2, Z.v[1] - 2); return { v, squeeze: Math.abs(v - want) }; };
    const a = lane(mine), b = lane(-mine), v = a.squeeze <= 4 || a.squeeze <= b.squeeze ? a.v : b.v;
    return { x: (u + v) / 2, y: (v - u) / 2 };
  }
  function inExitZone(fight, k) { const Z = ((fight.area || {}).zones || {}).exit; if (!Z || !Z.u) return false; const u = k.x - k.y, v = k.x + k.y; return u >= Z.u[0] && u <= Z.u[1] && v >= Z.v[0] && v <= Z.v[1]; }
  const inViewPad = (fight, b, pad) => { const v = fight.view; if (!v) return true; const fy = b.y - (b.z || 0); return b.x >= v.x0 - pad && b.x <= v.x1 + pad && fy >= v.y0 - pad && fy <= v.y1 + pad; };
  function squire(fight, opts) {
    opts = opts || {};
    if (!fight.level) throw new Error("bots.js: the squire plays in a level");
    knightClass(fight);
    const S = squireSpec(), N = Object.assign({}, S, opts.clumsy ? S.clumsy : {}), seed = (opts.seed === undefined ? fight.seed : opts.seed) >>> 0;
    const bot = newBot(0, N, "squire");
    const Q = { N, bot, seed, rng: rng((seed ^ seedConst("squire")) >>> 0), step(dt) { return squireInput(fight, Q, bot, dt); } };
    return Q;
  }
  // the sim's driver: the squire at seat 0 and the party at the rest, one keyed input a step
  function drive(fight, opts) {
    const Q = squire(fight, opts), P = party(fight, opts);
    return { squire: Q, party: P, step(dt) { return P.step(dt, Q.step(dt)); } };
  }

  root.Bots = { brothers, bench, loadout, party, squire, drive, ADAPT, DEFAULTS, rng };
  if (typeof module !== "undefined" && module.exports) module.exports = root.Bots;
})(typeof window !== "undefined" ? window : globalThis);
