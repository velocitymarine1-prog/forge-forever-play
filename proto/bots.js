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
      meleeAt: 0.9, bowKeep: [80, 140], thingsWhenClear: 80, climbs: false, ram: false, wakesPost: false, wanders: 0, chest: true,
      roundShield: 0.5, roundEvery: 3.0 },   // (design pass 21) a troll knight's shield up and facing it: half its approaches it goes round
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
    // (design pass 27) a level whose bots.marksPoint is set reads the marks as the page draws them (point: a mark over the top band stays
    // under its target and points at it), so a troll straight above the view sends the squire up, not to one side and then the other
    edgeMarks(fight) { const L = root.Level, v = fight.view || { x0: 0, y0: 0 }, o = ((fight.area || {}).bots || {}).marksPoint ? { point: true } : undefined; return L && typeof L.edgeMarks === "function" ? (L.edgeMarks(fight, o) || []).map(m => Object.assign({}, m, { x: m.x + v.x0, y: m.y + v.y0 })) : []; },
    // the Gallows Post sleeps until it is hit or neared (section 3.6): its huts are left alone while it does
    postAwake(fight) { const L = fight.level || {}; return !!(L.postAwake || (L.gallows && L.gallows.awake) || (L.post && L.post.awake)); },
    // the iron chest, standing shown and unopened: { x, y } (section 3.4)
    chest(fight) { const L = fight.level || {}, c = L.chest; return c && c.shown && !c.open ? c : null; },
    // the gate has burst, so the exit zone takes the party in
    gateOpen(fight) { const L = fight.level || {}; if (L.gateOpen !== undefined) return !!L.gateOpen; const g = (fight.pieces || []).find(p => p.kind === "gate"); return !!(g && g.broken); },
    // the director's own goal for the squire, { x, y }, when it gives one
    goal(fight) { const L = fight.level || {}; return L.goal || null; },
    // (design pass 21) the passage open from the party's room, its spec, or null
    passage(fight) { const L = fight.level || {}; return L.passage ? ((fight.area || {}).passages || []).find(q => q.id === L.passage) || null : null; }
  };

  // ------------------------------------------------------------------ what a bot sees
  const standing = k => combat().standing(k);
  const alive = f => !f.dead && !(f.spawn > 0);
  const foes = fight => (fight.foes || []).filter(alive);
  const inView = (fight, b) => combat().inView(fight, b);
  const up = b => (b.z || 0) > 12;   // on the roof, the tower deck, a breach or up the stair: above the ground by more than a step (the drawbridge deck is at the ground's height: a knight on it is followed, not guarded from the chapel stair's foot)
  // (design pass 21) a troll on a surface the level's bots climb to (spec bots.climbTo: the Great Hall's gallery and the keep's balcony,
  // stairs at both ends): a knight with no bow goes up after it, as a player does; the Troll Gate lists none, so its squire never climbs
  const climbsTo = (fight, f) => !!(f && f.on && (((fight.area || {}).bots || {}).climbTo || []).includes(f.on));
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
    // (design pass 21) in a level whose bots see raised surfaces as walls (spec bots.walls: the Great Hall, where a gallery landing's
    // side stands between the ground under the deck and a troll at its stair's foot), the way follows the height it would walk at: onto
    // any surface within a step of it (up a stair from its foot, a landing from the stair's head), under a deck, and never into the side
    // of a surface solid underneath more than a step above it
    const walls = ((fight.area || {}).bots || {}).walls, step = (W.N && W.N.stepUp) || 6;
    let h = k.z || 0;
    for (let t = 4; t <= len; t += 4) {
      probe.x = k.x + ux * t; probe.y = k.y + uy * t;
      if (P.caught(W, probe, probe.x, probe.y) || (!k.on && P.groundAt(W, probe.x, probe.y).deep)) return false;
      if (walls) {
        let next = 0;
        for (const Q of W.plats) { if (!P.inPlat(Q, probe.x, probe.y)) continue; const z = P.platZ(Q, probe.x, probe.y); if (z <= h + step + 1e-9) next = Math.max(next, z); else if (Q.solidUnder) return false; }
        h = next;
      }
    }
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
    let n0 = P.nodeOf(set, k);
    // (design pass 21, in a level whose bots cross layers with care: spec bots.layers, the Great Hall) a knight at a stair's edge whose node
    // lies past the stair's rect (its grid's last row reaches 2 px beyond the keep steps' foot): the class cannot stand on that node, so it
    // goes from the ground's node under it, within a step of its height
    const layers = !!((fight.area || {}).bots || {}).layers;
    if (layers && k.on && !set.cls.knight.ok[n0]) { const g0 = P.nodeOf(set, { x: k.x, y: k.y, on: null }); if (set.cls.knight.ok[g0] && Math.abs(set.z[g0] - (k.z || 0)) <= 6) n0 = g0; }
    // (design pass 27, in a level whose bots.wedgeNear is set: the Keep) a knight on a node its class cannot stand on (wedged between a barrel
    // and a riser's face) goes to the nearest node the field reaches, never to the field's next from a node it has no value for (that sent
    // the squire into the face, for ever)
    if (((fight.area || {}).bots || {}).wedgeNear && set.cls.knight && !set.cls.knight.ok[n0] && p.F.dist) { const r = reachedNear(fight, k, set, set.cls.knight, p.F.dist, n0); if (r) return r; }
    let nx = P.fieldNext(set, p.F, n0);
    // (design pass 21) a walk link to another layer's node a step or two away (the dais steps' grid over the ground's, offset 2 px): the
    // knight is already there, so the way on is that node's next; where the field ends there (its seed, the nearest node to a surface too
    // narrow for nodes of its own: the keep door's landing), the rest is the straight way to the target
    if (nx && nx.kind === "walk" && set.lay[nx.n] !== set.lay[n0] && dist(k.x, k.y, set.x[nx.n], set.y[nx.n]) < (layers ? 6 : 3)) { const n2 = P.fieldNext(set, p.F, nx.n); if (n2) nx = n2; else return null; }
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
    const stairs = (A.surfaces || []).filter(s => s.kind === "stair"), cx = s => (s.rect[0] + s.rect[2]) / 2, cy = s => (s.rect[1] + s.rect[3]) / 2;
    const S = stairs.length > 1 ? stairs.slice().sort((a, b) => dist(cx(a), cy(a), p.x, p.y) - dist(cx(b), cy(b), p.x, p.y))[0] : stairs[0];   // (design pass 21) the stair nearest the player
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
  function newBot(seat, N, who) { return { seat, who, N, think: 0, mode: "follow", tid: null, lift: null, path: null, evade: null, queue: [], seen: {}, swapT: 0, goal: null, hold: null }; }
  // (design pass 38) the bots' Guard: spec/signatures.json bots: the chance a bot parries a parryable melee wind-up aimed at it (by its name;
  // the squire by its own, the clumsier squire less), else the chance it guards through the blow when its poise allows the block
  const sigBots = () => { const S = root.FORGE_SIGNATURES; return S && S.on !== false && S.bots ? S : null; };
  const parryChance = bot => { const S = sigBots(); if (!S) return 0; const P = S.bots.parry || {}; if (bot.who === "squire") return bot.N.clumsy === true ? (P.clumsy || 0) : (P.squire || 0); return P[bot.name] !== undefined ? P[bot.name] : 0; };
  const guardChance = bot => { const S = sigBots(); if (!S) return 0; const G = S.bots.guard || {}; if (bot.who === "squire") return bot.N.clumsy === true ? (G.clumsy || 0) : (G.squire || 0); return G.brother || 0; };
  // a telegraph starts (the last step's events): a melee wind-up whose area covers me, a slam's ring I stand in, a charge's strip I stand on
  // (dodged, dodgeMelee), an aim line on me (stepped off, stepOffLine), a burn on me (rolled out, rollBurning); each rolled once, then
  // done 0.25 to 0.40 s later (the squire 0.20 to 0.35)
  function react(fight, bot, k, R, e) {
    const N = bot.N;
    const roll = (p, kind, ax, ay, hold) => { if (R() >= p) return; bot.queue.push({ at: fight.t + N.react[0] + (N.react[1] - N.react[0]) * R(), kind, ax, ay, hold: hold || 0 }); };
    if (e.type === "windUp") {
      const f = (fight.foes || []).find(q => q.id === e.foe); if (!f) return;
      const tel = e.tel || {}, [ax, ay] = unit(k.x - f.x, k.y - f.y);
      if (e.attack === "blink") return;   // (design pass 27) a caster sinking into smoke is no blow to dodge
      // (design pass 27) a burster's fuse whose ring covers me: I walk out of it, to its edge and 6 px past (the level's bots.leaveFuse; the
      // clumsier squire half as often), 0.20 to 0.35 s after it starts; else I fight on, and may kill it inside its fuse
      if (tel.kind === "fuse") { const LF = N.leaveFuse === undefined ? 0 : N.leaveFuse, r = (tel.r || 44) + k.r + 4; if (dist(k.x, k.y, f.x, f.y) <= r && R() < LF) bot.queue.push({ at: fight.t + N.react[0] + (N.react[1] - N.react[0]) * R(), kind: "leave", cx: f.x, cy: f.y, r: r + 2 }); return; }
      // (design pass 27) the wizard's rune rings across my path: a ring I stand in is dodged as any ring, but away from the rings' line (they
      // all but touch: a dodge along the line lands in the next); a lone ring away from its centre
      if (tel.kind === "rings") {
        const L = tel.list || [], Rg = L.find(q => dist(k.x, k.y, q.x, q.y) <= (tel.r || 18) + k.r + 4);
        if (Rg) { let bx, by; if (L.length >= 2) { const [lx, ly] = unit(L[L.length - 1].x - L[0].x, L[L.length - 1].y - L[0].y), side = (k.x - Rg.x) * -ly + (k.y - Rg.y) * lx >= 0 ? 1 : -1; bx = -ly * side; by = lx * side; } else [bx, by] = unit(k.x - Rg.x, k.y - Rg.y); roll(N.dodgeMelee, "dodge", bx, by); }
        return;
      }
      if (tel.kind === "ring") { if (dist(k.x, k.y, tel.x, tel.y) <= tel.r + k.r + 4) { const [bx, by] = unit(k.x - tel.x, k.y - tel.y); roll(N.dodgeMelee, "dodge", bx, by); } }
      else if (tel.kind === "strip") {
        const lx = tel.x1 - tel.x0, ly = tel.y1 - tel.y0, ll = Math.hypot(lx, ly) || 1, t = clamp(((k.x - tel.x0) * lx + (k.y - tel.y0) * ly) / (ll * ll), 0, 1);
        const px = tel.x0 + lx * t, py = tel.y0 + ly * t, off = dist(k.x, k.y, px, py);
        if (off <= (tel.w || 22) / 2 + k.r + 6) { const side = (k.x - px) * -ly + (k.y - py) * lx >= 0 ? 1 : -1; roll(N.dodgeMelee, "dodge", -ly / ll * side, lx / ll * side); }
      } else {
        const atk = attackOf(f, e.attack), reach = (atk.reach || atk.range || 22) + k.r + 8;
        if (atk.projectile) return;   // a shot's draw is no melee wind-up: its aim line is answered below (section 3.7a's "steps off an aim line"), never a dodge away from a troll it must close on
        if ((e.seat === k.seat || dist(k.x, k.y, f.x, f.y) <= reach) && Math.abs((k.z || 0) - (f.z || 0)) <= 12) {
          // (design pass 38) a parryable blow aimed at me: a parry by my chance (a Guard press timed so the window covers the landing), else
          // a guard through it when my poise allows the block, else the dodge as ever; a blow that cannot be parried (red) is dodged
          const S = sigBots(), M = S ? ((S.mobs[f.kind] || {})[e.attack] || null) : null, parryable = !!(S && e.tel && e.tel.parry === true), wind = e.wind || 0.45;
          if (parryable && e.seat === k.seat && R() < parryChance(bot)) { const lead = S.bots.parryLead || 0.12, at = Math.max(fight.t + N.react[0], e.t + wind - lead); bot.queue.push({ at, kind: "guard", hold: lead + (S.bots.guardHold || 0.3) }); return; }
          if (parryable && e.seat === k.seat && M && k.poiseMax > 0 && k.poise > (M.poise || 10) * (S.poise.blockedX || 1.25) && R() < guardChance(bot)) { const at = fight.t + N.react[0] + (N.react[1] - N.react[0]) * R(); bot.queue.push({ at, kind: "guard", hold: Math.max(0.1, e.t + wind - at) + (S.bots.guardHold || 0.3) }); return; }
          roll(N.dodgeMelee, "dodge", ax, ay);
        }
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
      else if (q.kind === "guard") bot.hold = { until: fight.t + q.hold };   // (design pass 38) Guard held from now for its while
      else if (q.kind === "step") bot.evade = { kind: "step", ax: q.ax, ay: q.ay, until: fight.t + q.hold };
      else bot.evade = { kind: "leave", cx: q.cx, cy: q.cy, r: q.r, until: fight.t + 1.5 };
    }
    return pressed;
  }
  // the weapon a bot wants in hand for a target (section 3.10, section 3.7a's table): a brother's Bow (Edric, Tam) for a troll up, in a
  // breach or more than 80 px away (kept until it comes within 64), else its melee weapon; Osk's Hammer for a brute, his Sword for the
  // rest; the squire's Hammer for a brute, its Bow for a ranged troll over 80 px away or above the ground, with Emberbane the Sword for the
  // Emberback, else its first weapon
  function wantHand(fight, bot, k, f) {
    const hands = k.hands;
    if (hands.length < 2) return k.active;
    const bow = handOf(k, "bow"), hammer = handOf(k, "hammer"), plain = hands.findIndex(h => baseOf(h) === "sword" && h.u.element !== "fire");
    const dd = dist(k.x, k.y, f.x, f.y), at = bot.N.bowAt || 80, far = up(f) || dd > (k.active === bow && bow >= 0 ? at - 16 : at);
    if (bot.who === "squire") {
      if (isBrute(f) && hammer >= 0 && !f.spec.keep) return hammer;   // (a caster that keeps its distance, design pass 27, is no brute to hammer)
      if (isRanged(f) && far && bow >= 0) return bow;
      if (f.kind === "burster" && !(f.act && f.act.fam === "fuse") && dd > 60 && bow >= 0) return bow;   // (design pass 27) a burster running at me from over 60 px: the bow first
      if (plain >= 0 && hands[0].u.element === "fire" && (f.kind === "emberback" || swapFromFire(fight).includes(f.kind))) return plain;   // Emberbane's fire is resisted: the plain Sword (the Emberback; the level's bots.swapFromFire, design pass 27)
      return 0;
    }
    if (bow >= 0) return far ? bow : 1 - bow;
    if (hammer >= 0) return isBrute(f) ? hammer : 1 - hammer;
    return 0;
  }
  // the fight with a target (a troll or a thing): the wanted weapon in hand, then in melee closing to 0.9 of the reach (plus its radius), a
  // nudge of the stick to face it and Strike held; with the bow, standing 80 to 140 px off (inside the bow's range), facing it and loosing
  function fightInput(fight, bot, k, f, out, swapTo) {
    const N = bot.N, want = swapTo === undefined ? wantHand(fight, bot, k, f) : swapTo;
    if (want !== k.active && k.hands.length > 1 && k.swapT <= 0 && bot.swapT <= 0) { out.swap = true; bot.swapT = 0.5; return; }
    const u = k.hands[k.active].u, dd = dist(k.x, k.y, f.x, f.y), face = () => { out.move = toward(k, f.x, f.y, 0.06); out.strike = true; };
    if (u.melee && f.spec && f.spec.guard && bot.R && guardFacing(fight, f, k)) {   // (design pass 21) the shield up and facing it: on half its approaches it walks round to the side first
      const F = bot.flank || (bot.flank = {}), c = F[f.id];
      if (!c || fight.t >= c.until) F[f.id] = { side: bot.R() < (N.roundShield === undefined ? 0.5 : N.roundShield) ? (bot.R() < 0.5 ? 1 : -1) : 0, until: fight.t + (N.roundEvery || 3.0) };
      const side = F[f.id].side;
      if (side) { const a = f.face + side * 1.9, tx = f.x + Math.cos(a) * 20, ty = f.y + Math.sin(a) * 20; if (dist(k.x, k.y, tx, ty) > 6) { const s = stepToward(fight, bot, k, { x: tx, y: ty }); out.move = toward(k, s.x, s.y, 1); return; } }
    }
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
  // a troll knight's shield up and facing a knight (within its 120 degrees)
  function guardFacing(fight, f, k) {
    const G = f.spec.guard, up = !(f.stagger > 0) && !(f.reelUntil > fight.t) && !(f.guard && f.guard.upAt > fight.t) && !(f.act && (f.act.phase === "wind" || f.act.phase === "strike"));
    if (!up) return false;
    let d = Math.atan2(k.y - f.y, k.x - f.x) - f.face; d = ((d + 3 * PI) % (2 * PI)) - PI;
    return Math.abs(d) <= ((G.arc || 120) / 2) * PI / 180;
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
    // (design pass 27, a level whose bots.partyWithin is set: the Keep) a leader near as the crow flies but behind a wall (the stair's face: the
    // leader on the landing above, the follower below) is followed by the field all the same, else the follower stands content in its band
    // on the wrong tier and the party never climbs
    const [fx, fy] = unit(tgt.x - k.x, tgt.y - k.y), blocked = !!((fight.area || {}).bots || {}).partyWithin && dd > lo && !wayClear(fight, k, fx, fy, Math.max(0, dd - k.r - (tgt.r === undefined ? 6 : tgt.r)));
    if (dd > hi || blocked) { const s = stepToward(fight, bot, k, tgt); out.move = toward(k, s.x, s.y, 1); }
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
    if (bot.hold) { if (fight.t < bot.hold.until) out.guard = true; else bot.hold = null; }   // (design pass 38) the Guard held through a blow
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
    const k = fight.knights[bot.seat], R = botsRng(fight), out = { move: [0, 0], strike: false, swap: false, dodge: false, ability: false, guard: false };
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
    const P = { N: B, seats, bots: seats.map(s => Object.assign(newBot(s, B, "brother"), { name: (fight.knights[s] || {}).name || null })),
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
    const P = ADAPT.passage(fight); if (P) { const zx = (P.zone.x[0] + P.zone.x[1]) / 2, zy = Math.max((P.zone.y[0] + P.zone.y[1]) / 2, P.zone.y[1] + 2); return { x: zx, y: zy, on: P.on || null, pass: P.id }; }   // (its zone's foot: the wall stands behind it)   // (design pass 21) through the open door into the next room
    const g = ADAPT.goal(fight); if (g) return g;
    const ch = ADAPT.chest(fight); if (ch) { if (!ch.on) return { x: ch.x, y: ch.y, r: ch.r || 6, use: true }; const b = besideChest(fight, k, ch); return { x: b[0], y: b[1], r: 2, on: ch.on, use: true, chest: ch }; }   // (design pass 21) a chest on a surface: a free spot beside it
    if (ADAPT.gateOpen(fight)) { const Z = (A.zones || {}).exit; if (Z && Z.u) { const u = (Z.u[0] + Z.u[1]) / 2, v = (Z.v[0] + Z.v[1]) / 2; return { x: (u + v) / 2, y: (v - u) / 2, exit: true }; } if (Z && Z.rect) return { x: (Z.rect[0] + Z.rect[2]) / 2, y: (Z.rect[1] + Z.rect[3]) / 2, exit: true }; }
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
    for (const a of A.arenas || []) {
      // (design pass 27) an arena stacked in y (a climbing room's tier): the squire climbs to the rally of the first tier above it; never east to a
      // tier's heart by x alone (the tier under the knight, cleared, took it down into a riser)
      if (a.y0 !== undefined && a.y1 !== undefined) { if (k.x >= a.x0 - 8 && k.x <= a.x1 + 8 && a.y1 < k.y - 8) return { x: a.rally, y: (a.rallyY || [200])[0] }; continue; }   // (its own room only: a knight in the throne room never walks back to the stair)
      const x = a.hornLine ? Math.max(a.rally, a.hornLine + 30) : a.x0 + 192; if (x > k.x + 8) return { x, y: (a.rallyY || [200])[0] };
    }
    return null;
  }
  // a free spot 14 px from a chest on a surface (the hall's dais), the side toward the knight first
  function besideChest(fight, k, ch) {
    const P = phys(), W = fight.world, a0 = Math.atan2(k.y - ch.y, k.x - ch.x), R = (ch.r || 6) + (k.r || 6) + 1;
    for (const da of [0, 0.8, -0.8, 1.6, -1.6, 2.4, -2.4, Math.PI]) { const a = a0 + da, x = ch.x + Math.cos(a) * R, y = ch.y + Math.sin(a) * R; if (!P.caught(W, { x, y, z: ch.z || 0, r: k.r || 6, h: k.h || 24, on: ch.on, knight: true })) return [x, y]; }
    return [ch.x, ch.y + R];
  }
  // the squire decides every 0.1 s: the nearest troll in the view it can fight (any with a bow; one on the ground within 12 px of its
  // height without); with no troll within 80 px, the nearest standing thing (the watchtower too when it has no bow); else its plan
  // (design pass 27) the kinds the squire meets with its plain weapon when its first one is fire (the level's bots.swapFromFire: the wizard)
  const swapFromFire = fight => (((fight.area || {}).bots || {}).swapFromFire) || [];
  // (design pass 27) the room a knight stands in climbs (spec rooms[].climb: the Keep's great stair)
  const climbingRoom = (fight, k) => { const RM = (((fight.area || {}).rooms) || []).find(r => k.x >= r.x0 && k.x < r.x1); return !!(RM && RM.climb); };
  function squireDecide(fight, bot, k) {
    // (design pass 27) a warded caster is never struck (the squire fights what he called); a caster gone in his blink is no target
    const N = bot.N, bow = hasBow(k), can = f => !f.ward && !f.gone && (bow || (!up(f) && Math.abs((k.z || 0) - (f.z || 0)) <= 12) || climbsTo(fight, f)), FO = foes(fight).filter(f => inView(fight, f) && can(f));
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
    const k = fight.knights[0], out = { move: [0, 0], strike: false, swap: false, dodge: false, ability: false, guard: false };
    const held = common(fight, bot, k, Q.rng, dt, out);
    if (held) return held;
    readMarks(fight, bot, k, Q.rng);
    if (bot.think <= 0) { bot.think += bot.N.think; squireDecide(fight, bot, k); }
    if (bot.mode === "fight") { const f = (fight.foes || []).find(q => q.id === bot.tid); if (f && alive(f)) { fightInput(fight, bot, k, f, out); return out; } }
    if (bot.mode === "thing") { const t = bot.tid; if (t && !t.gone && !t.broken && t.active !== false) { fightInput(fight, bot, k, t, out, 0); return out; } }
    const g = bot.goal;
    if (!g) return out;
    const dd = dist(k.x, k.y, g.x, g.y);
    if (g.pass) {   // (design pass 21) a passage: walked to by the field; in its zone the stick held toward the door and the pass sent (the page's fade is the page's)
      const P = ((fight.area || {}).passages || []).find(q => q.id === g.pass);
      if (P && k.x >= P.zone.x[0] && k.x <= P.zone.x[1] && k.y >= P.zone.y[0] - 6 && k.y <= P.zone.y[1] + 6) { out.move = [0, -0.7]; out.pass = g.pass; bot.press = fight.t; return out; }
      const s = stepToward(fight, bot, k, { x: g.x, y: g.y, on: g.on || null }); out.move = toward(k, s.x, s.y, 1); return out;
    }
    if (g.exit && !(((fight.area || {}).zones || {}).exit || {}).u) {   // a level's exit by x and y (the hall's lord's door): walk in and push on
      // (design pass 27) the push follows the zone's dir: the hall's door right, the Keep's throne-room door up (pushing right there walked out of the rect)
      if (inExitZone(fight, k)) { const d = ((((fight.area || {}).zones || {}).exit || {}).dir || ["right"])[0]; out.move = d === "up" ? [0, -1] : d === "down" ? [0, 1] : d === "left" ? [-1, 0] : [1, 0]; bot.press = fight.t; }
      else { const s = stepToward(fight, bot, k, g); out.move = toward(k, s.x, s.y, 1); }
      return out;
    }
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
    // (design pass 27) in a climbing room between the waves the squire keeps its party with it: the standing knight of the party farthest from
    // it, beyond bots.partyWithin px (the Keep's 160), is walked back to until it is within half that, the camera (which follows the squire)
    // coming back over the flight the laggard needs (a knight pinned at the view's edge below the stair could never reach it); the gate's and
    // the hall's squires have no climbing room
    const PW = ((fight.area || {}).bots || {}).partyWithin;
    if (PW && climbingRoom(fight, k) && fight.knights.length > 1 && !g.exit && !g.use) {
      // (the knight once waited for is waited for until it is close, so two laggards at one distance do not pull the squire left and right)
      const held = bot.waitFor === undefined || bot.waitFor === null ? null : fight.knights.find(q => q.seat === bot.waitFor && q !== k && standing(q) && !q.out);
      const lag = held || fight.knights.filter(q => q !== k && standing(q) && !q.out).sort((a, b) => dist(k.x, k.y, b.x, b.y) - dist(k.x, k.y, a.x, a.y))[0];
      if (lag) { const dl = dist(k.x, k.y, lag.x, lag.y); if (dl > PW || (held && dl > PW / 2)) { bot.waitFor = lag.seat; const s = stepToward(fight, bot, k, { x: lag.x, y: lag.y, r: lag.r, on: lag.on || null, z: lag.z || 0 }); out.move = toward(k, s.x, s.y, 1); return out; } bot.waitFor = null; }
    }
    if (g.use && (g.chest ? dist(k.x, k.y, g.chest.x, g.chest.y) <= (g.chest.r || 6) + 10 : dd <= (g.r || 6) + 10)) { out.use = true; return out; }   // the chest: a tap on the prompt or E, for the director
    if (g.chest && dd <= 4) { out.move = toward(k, g.chest.x, g.chest.y, 1); return out; }   // (design pass 21) beside a chest on a surface and not yet in reach: lean in
    if (dd > 4) { const s = stepToward(fight, bot, k, g.on ? { x: g.x, y: g.y, on: g.on, z: (g.chest && g.chest.z) || 0 } : g); out.move = toward(k, s.x, s.y, 1); }
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
  function inExitZone(fight, k) { const Z = ((fight.area || {}).zones || {}).exit; if (Z && Z.rect) return k.x >= Z.rect[0] - 1 && k.x <= Z.rect[2] + 1 && k.y >= Z.rect[1] && k.y <= Z.rect[3]; if (!Z || !Z.u) return false; const u = k.x - k.y, v = k.x + k.y; return u >= Z.u[0] && u <= Z.u[1] && v >= Z.v[0] && v <= Z.v[1]; }
  const inViewPad = (fight, b, pad) => { const v = fight.view; if (!v) return true; const fy = b.y - (b.z || 0); return b.x >= v.x0 - pad && b.x <= v.x1 + pad && fy >= v.y0 - pad && fy <= v.y1 + pad; };
  function squire(fight, opts) {
    opts = opts || {};
    if (!fight.level) throw new Error("bots.js: the squire plays in a level");
    knightClass(fight);
    // (design pass 27) the level's own numbers for its squire: bots.leaveFuse (the Keep's 0.8), and the clumsier squire's targets.normal.clumsy
    const LB = (fight.area || {}).bots || {}, LC = (((fight.area || {}).targets || {}).normal || {}).clumsy || {};
    const S = squireSpec(), N = Object.assign({}, S, LB.leaveFuse !== undefined ? { leaveFuse: LB.leaveFuse } : {}, opts.clumsy ? Object.assign({}, S.clumsy, LC.leaveFuse !== undefined ? { leaveFuse: LC.leaveFuse } : {}) : {}), seed = (opts.seed === undefined ? fight.seed : opts.seed) >>> 0;
    const bot = newBot(0, N, "squire"); if (opts.clumsy) bot.N.clumsy = true;
    const Q = { N, bot, seed, rng: rng((seed ^ seedConst("squire")) >>> 0), step(dt) { return squireInput(fight, Q, bot, dt); } };
    bot.R = Q.rng;
    return Q;
  }
  // the sim's driver: the squire at seat 0 and the party at the rest, one keyed input a step
  function drive(fight, opts) {
    const Q = squire(fight, opts), P = party(fight, opts);
    return { squire: Q, party: P, step(dt) { return P.step(dt, Q.step(dt)); } };
  }


  // ------------------------------------------------------------------ the house's knights (design pass 36: the Arena)
  // A duelist fights the other team's knights on the sand with the arena's reads: it keeps its distance by its weapon's reach, strikes
  // when the foe is not in a wind-up it means to answer, dodges a telegraphed blow by its skill's dodgeMelee, guards a blow by `guard`,
  // parries (a Guard press timed to the blow's landing, its first 0.2 s the window) by `parry`, flanks a guard facing it, chases a
  // staggered foe for the crit, backs off at 25 HP to let poise regrow, lifts a downed ally when nobody is near it, rushes as a dagger and
  // keeps range as a bow (swapping when pressed). Its state is plain data in fight.arena.botState[seat] (the lockstep's snapshot holds it)
  // and its numbers draw from fight.rng.bots, so every phone simulates the house alike and no wire carries it.
  function newDuelState() { return { think: 0, target: null, mode: "fight", queue: [], guardUntil: 0, strafe: 0, strafeT: 0, backOff: 0, swapT: 0, lift: null, face: 0 }; }
  function duelists(fight) { if (!fight.arena) throw new Error("bots.js: the duelists play in the arena"); botsRng(fight); const seats = fight.knights.filter(k => k.house).map(k => k.seat); for (const s of seats) if (!fight.arena.botState[s]) fight.arena.botState[s] = newDuelState(); return { seats }; }
  const duelStands = k => !k.out && !k.down && !k.ko && k.hp > 0 && !(k.lie > 0);
  const facingMe = (f, k) => { let d = Math.atan2(k.y - f.y, k.x - f.x) - f.face; d = ((d + 3 * PI) % (2 * PI)) - PI; return Math.abs(d) <= 60 * PI / 180; };
  function duelInput(fight, seat, dt) {
    const A = fight.arena, S = A.spec, C = (root.FORGE_COMBAT || {}), k = fight.knights[seat];
    const out = { move: [0, 0], strike: false, swap: false, dodge: false, guard: false, ability: false };
    if (!k || k.out || k.ko) return out;
    const B = A.botState[seat] || (A.botState[seat] = newDuelState()), N = S.house.skills[k.skill] || S.house.skills[S.house.default], R = botsRng(fight);
    const foes = fight.knights.filter(q => q.team !== k.team && duelStands(q));
    const myReach = u => (u.melee ? combat().reachOf(u) : 0);
    // the last step's events: a foe's blow begun is a telegraph; answered by a dodge, a parry or a block, each rolled once
    for (const e of fight.events || []) {
      // a rush of fast blows on me (two within a second): I hold the guard a while (the dagger's land 20 %, the claws' none), by my skill's guard
      if (e.type === "hit" && e.knight && e.d === k.seat && e.kind === "direct" && e.amount > 0 && e.by !== undefined) {
        const fu = fight.knights[e.by] && fight.knights[e.by].hands[fight.knights[e.by].active] ? fight.knights[e.by].hands[fight.knights[e.by].active].u : null, F = C.forms && fu ? C.forms[fu.form] : null;
        if (fu && fu.melee && F && (fu.windT || F.wind) < 0.12) { B.fast = (B.fast || []).filter(t => fight.t - t <= 1.0).concat([fight.t]); if (B.fast.length >= 2 && B.guardUntil <= fight.t && R() < Math.min(0.9, N.guard * 2)) { B.guardUntil = fight.t + 0.7; B.fast = []; } }
        continue;
      }
      if (e.type !== "strike" || e.seat === undefined || e.seat === k.seat) continue;
      const f = fight.knights[e.seat]; if (!f || f.team === k.team) continue;
      const fu = f.hands[f.active] ? f.hands[f.active].u : null, F = C.forms ? C.forms[e.form] : null; if (!fu || !F) continue;
      const wind = (fu.windT || F.wind || 0.1) + (e.move === 3 ? ((C.combos || {}).finisher || {}).wind || 0.1 : 0);
      const reach = (fu.melee ? myReach(fu) : combat().reachOf(fu)) + k.r + 10, dd = dist(k.x, k.y, f.x, f.y);
      const onMe = e.target === k.seat || (fu.melee && dd <= reach);
      if (!onMe) continue;
      const parryable = fu.melee && !(S.classes[duelClass(fu)] || {}).unparryable;
      const roll = R();
      if (parryable && k.poise > 20 && roll < N.parry) B.queue.push({ at: fight.t + Math.max(0, wind - 0.12), kind: "guard", hold: 0.34 });
      else if (fu.melee && k.poise > 40 && roll < N.parry + N.guard && wind >= 0.3) B.queue.push({ at: fight.t + Math.max(0, wind - 0.3), kind: "guard", hold: 0.55 });
      else if (roll < N.parry + N.guard + N.dodgeMelee) { const at = fight.t + N.react[0] + (N.react[1] - N.react[0]) * R(); if (at <= fight.t + wind - 0.02) { const [ax, ay] = unit(k.x - f.x, k.y - f.y), side = R() < 0.5 ? 1 : -1, sw = R() < 0.4; B.queue.push({ at, kind: "dodge", ax: sw ? -ay * side : ax, ay: sw ? ax * side : ay }); } }   // (a dodge that would come after the blow is no dodge: it only breaks the chain)
    }
    B.think -= dt; if (B.backOff > 0) B.backOff -= dt; if (B.swapT > 0) B.swapT -= dt; B.strafeT -= dt;
    if (k.down) { const a = nearestOf(fight.knights.filter(q => q !== k && q.team === k.team && duelStands(q)), k.x, k.y); if (a) out.move = toward(k, a.x, a.y, 1); return out; }
    if (k.lie > 0) { if (k.lie <= 0.2 && R() < 0.5) { out.dodge = true; const f = foes.length ? nearestOf(foes, k.x, k.y) : null; if (f) out.move = toward(k, f.x, f.y, -1); } return out; }
    if (k.rising > 0 || k.stagger > 0 || k.st.freeze || k.st.stun || k.lag > 0) return out;
    // what was queued and is due
    for (let i = B.queue.length - 1; i >= 0; i--) {
      const q = B.queue[i]; if (q.at > fight.t + 1e-9) continue; B.queue.splice(i, 1);
      if (q.kind === "dodge") { if (!out.dodge) { out.dodge = true; out.move = [q.ax, q.ay]; } }
      else if (q.kind === "guard") B.guardUntil = Math.max(B.guardUntil, fight.t + q.hold);
    }
    if (out.dodge) return out;
    if (B.guardUntil > fight.t && !k.strike) { out.guard = true; const f = foes.length ? nearestOf(foes, k.x, k.y) : null; if (f) out.move = toward(k, f.x, f.y, 0.06); return out; }   // (the guard faces the foe: a tilt past the stick's dead zone turns the knight without carrying it)
    if (B.think <= 0) {
      B.think += 0.1;
      // the target: a staggered foe first (the crit), else the nearest; a downed ally with no foe near it is lifted by its nearest mate
      const stag = foes.filter(f => f.staggered > 0);
      const pick = stag.length ? nearestOf(stag, k.x, k.y) : foes.length ? nearestOf(foes, k.x, k.y) : null;
      B.target = pick ? pick.seat : null; B.lift = null;
      for (const d of fight.knights) {
        if (d.team !== k.team || !d.down || d.ko) continue;
        if (foes.some(f => dist(f.x, f.y, d.x, d.y) <= 48)) continue;
        const mates = fight.knights.filter(q => q.team === k.team && q !== d && duelStands(q));
        if (nearestOf(mates, d.x, d.y) === k) { B.lift = d.seat; break; }
      }
      if (k.hp <= S.rules.lastStand.hp && k.poise < 50 && B.backOff <= 0 && R() < 0.5) B.backOff = 1.0;
    }
    if (B.lift !== null) { const d = fight.knights[B.lift]; if (d && d.down && !d.ko) { if (dist(k.x, k.y, d.x, d.y) > 12) out.move = toward(k, d.x, d.y, 1); return out; } B.lift = null; }
    const f = B.target !== null ? fight.knights[B.target] : null;
    if (!f || !duelStands(f)) return out;
    const hand = k.hands[k.active], u = hand.u, dd = dist(k.x, k.y, f.x, f.y);
    // the hand: melee when the foe is near, the bow when it is far and the knight has one
    const mi = k.hands.findIndex(h => h.u.melee), bi = k.hands.findIndex(h => !h.u.melee);
    if (k.hands.length > 1 && k.swapT <= 0 && B.swapT <= 0) {
      if (!u.melee && mi >= 0 && dd <= 40) { out.swap = true; B.swapT = 0.6; return out; }
      if (u.melee && bi >= 0 && dd >= 130 && !(f.staggered > 0)) { out.swap = true; B.swapT = 0.6; return out; }
    }
    if (B.backOff > 0) { out.move = toward(k, f.x, f.y, -1); return out; }
    if (B.strafeT <= 0) { const r = R(); B.strafe = r < 0.3 ? -1 : r < 0.6 ? 1 : 0; B.strafeT = 0.4 + R() * 0.6; }
    const [ux, uy] = unit(f.x - k.x, f.y - k.y), px = -uy * B.strafe, py = ux * B.strafe;
    if (u.melee) {
      const reach = myReach(u) * (N.meleeAt || 0.9) + f.r;
      if (dd > reach) { const [mx, my] = unit(ux + px * 0.5, uy + py * 0.5); out.move = [mx, my]; }
      else if (f.guard && facingMe(f, k) && !(S.classes[duelClass(u)] || {}).crush && R() < 0.8) { const side = B.strafe || 1; out.move = [-uy * side, ux * side]; }
      else { out.move = toward(k, f.x, f.y, 0.06); out.strike = true; if (hand.ua && hand.acd <= 0 && R() < 0.3) out.ability = true; }
    } else {
      const range = combat().reachOf(u), lo = 50, hi = Math.min(110, range * 0.9);
      if (dd > hi) out.move = [ux, uy];
      else if (dd < lo) out.move = toward(k, f.x, f.y, -1);
      else { out.move = toward(k, f.x, f.y, 0.06); out.strike = true; }
    }
    return out;
  }
  // the class of a blow's units, as proto/duel.js reads it (the arena's spec)
  function duelClass(u) { const S = root.FORGE_ARENA; if (!S) return u.base; const base = u.base; if (!u.fuse && base && S.classes[base] && base !== "byForm") return base; return (S.classes.byForm || {})[u.form] || "sword"; }

  root.Bots = { brothers, bench, loadout, party, squire, drive, ADAPT, DEFAULTS, rng, duelists, duelInput };   // (design pass 36) the house's knights
  if (typeof module !== "undefined" && module.exports) module.exports = root.Bots;
})(typeof window !== "undefined" ? window : globalThis);
