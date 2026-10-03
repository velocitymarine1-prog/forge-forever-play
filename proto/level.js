// level.js: the Troll Gate's director (design pass 12, revision 3): the camera, the arenas and their waves, the troll doors, the outposts,
// the trebuchets and their winchmen, the castle front (the horn, the drawbridge, the gate, the burst, the chest), the Breathers, the
// retries, the drops and the pouches, and Level.edgeMarks. Pure: no DOM, no clock, no Math.random; every number from spec/gate.json (the
// area), spec/trolls.json, spec/combat.json, spec/drops.json and spec/difficulty.json; its random draws from fight.rng.waves (the
// Emberback, in combat.js) and fight.rng.drops (one stream a seat). It is stepped inside Combat.step through fight.director, after the
// soft push and before the view's hold, so a level's event log, camera moves included, replays byte for byte.
//   Level.attach(fight, opts)    the director on a level's fight (fight.director); opts.waves false keeps the camera alone (tests, scenes)
//   Level.scaling(area, p, b)    section 3.7's counts for p human knights and b sword-brothers (brothers a quarter): factor, cap, the gate's HP
//   Level.edgeMarks(fight, o)    who gets a mark at the view's edge (section 3.14): [{ x, y, size, dir, alarm, dot, d }], view px, at most 8
//   Level.jump(fight, arenaId)   the party at an arena's rally points with the earlier arenas cleared (tests, the harness's scenes)
// What the page and the bots read: fight.view (the camera, whole pixels), fight.engines [{ id, phase, t, T, manned, wrecked, stone, x, y }],
// fight.chest { x, y, r, shown, open, openAt }, fight.bridge { down, fallAt, fall }, fight.gate { down, lift, stage, eyes, burst, burstDone,
// ours }, fight.pouches [{ id, seat, item, from, x, y, z, on, t, fly }], a knight's k.satchel [item ids], fight.level.arena { x0, x1 },
// fight.level.rally [[x, y] by seat], fight.level.postAwake, fight.level.chest (= fight.chest), fight.level.gateOpen.
// Plain script, defines window.Level (module.exports in node).
(function (root) {
  "use strict";
  const req = name => (typeof require === "function" ? require(name) : null);
  const CB = () => root.Combat || req("./combat.js");
  const PH = () => root.Physics || req("./physics.js");
  const COIN = () => root.Coin || req("./coin.js");
  const DROPS = () => root.FORGE_DROPS || null;
  const trolls = () => root.FORGE_TROLLS || {};
  const common = () => trolls().common || {};
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  const TAU = Math.PI * 2, XY = (u, v) => [(u + v) / 2, (v - u) / 2], YIELD = 2;
  const full = k => k.kind !== "brother", humans = fight => fight.knights.filter(full).length, brothersOf = fight => fight.knights.filter(k => !full(k)).length;
  const standing = k => !k.down && !k.out && !(k.rise > 0);
  const emit = (fight, e) => CB().emit(fight, e);
  const dX = (fight, key) => CB().dX(fight, key);

  // ------------------------------------------------------------------ scaling (section 3.7)
  // count = round(base x factor), factor = 1 + 0.6 x (p_eff - 1), p_eff = p + 0.25 x b, in integer thousandths so that 5 x 1.3 is 6.5 and
  // rounds to 7 as the note's table says (in floating point 1.3 x 5 falls a hair short); the alive cap floor(6 + 3 p_eff); the wall
  // archers round(2 x factor) at most 4, every second one ice; the gate's HP by the factor; each trickle's alive at once 2 + p (humans only)
  function scaling(A, p, b) {
    const S = A.scaling || {}, per = S.perKnight === undefined ? 0.6 : S.perKnight, w = S.brotherWeight === undefined ? 0.25 : S.brotherWeight;
    const peff = p + w * b, f1000 = Math.round(1000 * (1 + per * (peff - 1)));
    const count = base => Math.round(base * f1000 / 1000);
    const capB = S.aliveCap || [6, 3], cap = Math.floor(capB[0] + capB[1] * peff);
    const WA = S.wallArchers || { base: 2, max: 4, iceEvery: 2 }, wn = Math.min(WA.max || 4, count(WA.base || 2)), wice = Math.floor(wn / (WA.iceEvery || 2));
    return { p, b, peff, f1000, factor: f1000 / 1000, count, cap, trickleAlive: 2 + p, gateHp: Math.round(((A.gate || {}).hp || 480) * f1000 / 1000), wall: { n: wn, ice: wice } };
  }
  // section 3.7's table, source by source, for p human knights and b brothers: each wave's door totals by kind, its outposts' groups and
  // trickles, the wall archers and their ice, the gate's HP, the alive cap, and the troll counts before and in wave 5 (with the reserves)
  function counts(A, p, b) {
    const S = scaling(A, p, b), kinds = (A.scaling || {}).kinds || ["footman", "firestaff", "archer", "icearcher"], crew = ((A.engineKinds || {}).trebuchet || {}).crew || 3, roar = ((trolls().brute || {}).roar || {}).calls || 2;
    const out = { factor: S.factor, cap: S.cap, trickleAlive: S.trickleAlive, gateHp: S.gateHp, wall: S.wall, waves: [], before5: 0, in5: 0, reserves: 0 };
    for (const w of A.waves || []) {
      const W = { arena: w.arena, kinds: {}, outposts: [], trickles: [], fixed: {}, engines: 0 }, all = (w.groups || []).concat(((w.breakGate || {}).groups) || []);
      for (const kind of kinds) { const doors = all.filter(g => typeOf(g) === "door" && g.kind === kind && g.scale !== false); if (doors.length) W.kinds[kind] = S.count(doors.reduce((s, g) => s + g.n, 0)); }
      for (const g of all) {
        const t = typeOf(g);
        if (t === "door" && g.scale === false) W.fixed[g.kind] = (W.fixed[g.kind] || 0) + g.n;
        else if (t === "deck") W.fixed[g.kind] = (W.fixed[g.kind] || 0) + g.n;
        else if (t === "hut") W.outposts.push({ from: g.from, kind: g.kind, n: S.count(g.n) });
        else if (t === "trickle") W.trickles.push({ kind: g.kind, n: S.count(g.n) });
        else if (t === "engine") W.engines++;
      }
      let n = Object.values(W.kinds).reduce((s, v) => s + v, 0) + Object.values(W.fixed).reduce((s, v) => s + v, 0) + W.outposts.reduce((s, g) => s + g.n, 0) + W.trickles.reduce((s, g) => s + g.n, 0) + W.engines;
      if (w.arena === 5) { n += S.wall.n + roar * Object.values(W.fixed).reduce((s, v) => s + v, 0); out.in5 = n; } else out.before5 += n;
      out.reserves += W.engines * (crew - 1);
      W.n = n; out.waves.push(W);
    }
    out.total = out.before5 + out.in5;
    return out;
  }
  // a total split over groups by largest remainder, the earlier group taking the extra (Math.round halves up is the count's; this is the split)
  function split(total, weights) {
    const sum = weights.reduce((s, w) => s + w, 0);
    if (sum <= 0) return weights.map(() => 0);
    const exact = weights.map(w => total * w / sum), out = exact.map(Math.floor);
    const left = total - out.reduce((s, n) => s + n, 0), order = exact.map((e, i) => [e - out[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    for (let j = 0; j < left; j++) out[order[j % order.length][1]]++;
    return out;
  }

  // ------------------------------------------------------------------ the director on a fight
  function attach(fight, opts) {
    opts = opts || {};
    if (!fight.level || !fight.world || !fight.world.level) throw new Error("level.js: the director runs a level's fight");
    const A = fight.area, C = CB(), F = fight.floor, W = fight.world;
    const D = { A, opts, fight, waves: opts.waves !== false, t: 0, p: humans(fight), b: brothersOf(fight), arenas: [], ai: 0, cam: null, engines: [], outposts: {}, pouches: [], pouchId: 1,
      track: {}, squadT: 0, wiping: false, horn: null, frame: false, castle: null, calls: [], seen: { gateHp: null } };
    D.scale = scaling(A, D.p, D.b);
    fight.director = D; fight.brains = true;
    // the arenas, each with its wave; the first is the current one
    (A.arenas || []).forEach((ar, i) => {
      const w = (A.waves || []).find(q => q.arena === ar.id) || null;
      D.arenas.push({ id: ar.id, i, spec: ar, wave: w, state: "ahead", delay: 0, t: 0, entries: [], groups: [], trolls: [], started: false, cleared: false, attempt: 0, phase: null, trickle: null, breakGate: null, retryPhase: false, undropped: [], seenN: 0 });
    });
    D.cam = { xf: ((A.camera || {}).start || [0, 0])[0], yf: ((A.camera || {}).start || [0, 0])[1], left: 0, right: 0 };
    limits(fight, D);
    C.setView(fight, Math.round(D.cam.xf), Math.round(D.cam.yf));
    // the outposts: fixed shares per hut from the level's start (a hut wrecked early cancels the footmen it had not yet sent); an outpost
    // that sends from Break the gate (the Gallows Post) has its shares filled now, so a wake before then sends two out of them
    for (const op of A.outposts || []) {
      const pieces = fight.pieces.filter(p => p.outpost === op.id), huts = (op.huts || []).map((at, i) => ({ i, x: at[0], y: at[1], r: op.r, piece: pieces.find(p => p.x === at[0] && p.y === at[1]) || pieces[i] || null, queue: [], sent: 0, t: op.every || 10, trolls: [], dropped: false }));
      D.outposts[op.id] = { id: op.id, spec: op, huts, every: op.every || 10, awake: false, live: false, from: op.from || null, aliveMax: Infinity, arena: op.arena, filled: false };
    }
    D.outpostList = Object.values(D.outposts);
    for (const w of A.waves || []) if (w.breakGate && w.breakGate.groups) fillHuts(fight, D, w.breakGate.groups.filter(g => typeOf(g) === "hut"), true);
    // the engines: the trebuchets (section 3.5), the Gallows one manned from the level's start
    fight.engines = D.engines;
    for (const e of A.engines || []) D.engines.push(newEngine(fight, D, e));
    // the castle front (section 3.4): the bridge raised, the portcullis down, the eyes in the arch, no chest yet
    const CH = A.chest || {}, at = CH.at ? XY(CH.at.u, CH.at.v) : [2880, 256];
    fight.bridge = { down: false, fallAt: null, fall: 0, rattleAt: null, landed: null };
    fight.gate = { down: true, lift: 0, stage: 0, eyes: true, burst: null, burstDone: false, ours: false, glint: false, hp: null, hpMax: null, dropAt: null };
    fight.chest = { x: at[0], y: at[1], r: CH.r || 6, shown: false, open: false, openAt: null, solid: null };
    fight.pouches = D.pouches;
    fight.level.chest = fight.chest; fight.level.gateOpen = false; fight.level.postAwake = false; fight.level.calls = fight.level.calls || [];
    fight.level.respawn = (g, f) => respawn(g, D, f);
    // the drops' streams: one a seat (A.4 rng.drops, then the seat's own step), so every knight's loot is its own
    const RN = (root.FORGE_COMBAT || {}).rng || {}, c0 = parseInt(RN.drops || "0x6c6f6f74", 16) >>> 0, c1 = parseInt(RN.dropsSeat || "0x9e3779b9", 16) >>> 0;
    fight.rng.drops = fight.knights.map(k => C.rng(((fight.seed ^ c0) + Math.imul(k.seat + 1, c1)) >>> 0));
    for (const k of fight.knights) { k.satchel = k.satchel || []; D.track[k.seat] = { px: k.x, py: k.y, vx: 0, vy: 0, log: [], sum: 0 }; }
    setArena(fight, D, null); setGoal(fight, D, D.arenas[0]);   // on a walk the fields follow the view (combat.js's fallback); an arena is set when the camera reaches it
    freeBox(fight, D);
    D.step = (g, dt, input) => step(g, D, dt, input);
    return D;
  }
  // the fields' box is the arena the party fights in (fight.level.arena, built now, inside the wave's delay, so no step of a fight pays
  // the build); on a walk it is null and the fields follow the view (the arena or the column under its centre, combat.js's fallback)
  function setArena(fight, D, ar) {
    const F = fight.floor;
    fight.level.arena = ar ? { x0: Math.max(F.x0, ar.spec.x0), x1: Math.min(F.x1, ar.spec.x1) } : null;
    CB().fieldsReady(fight);
  }
  // the squire's goal between the waves (Bots.ADAPT.goal, section 3.7a): the heart of the arena ahead, where its wave starts (the horn
  // line's bank in the last); none while a wave lives or once the gate has burst (the squire's own plan: the trolls, the chest, the exit).
  // A wave starts on the counted knights' mean x (the camera's trigger, or the horn line), and a bench party's bots follow behind the
  // squire, so while the arena is ahead the goal moves on until the mean has crossed (steerGoal), never past the moat's bank
  function setGoal(fight, D, ar) {
    const s = ar && ar.spec;
    fight.level.goal = s ? { x: s.hornLine ? Math.max(s.rally, s.hornLine + 30) : s.x0 + 192, y: (s.rallyY || [200])[0], base: s.hornLine ? Math.max(s.rally, s.hornLine + 30) : s.x0 + 192 } : null;
  }
  function steerGoal(fight, D, ar) {
    const g = fight.level.goal, s = ar.spec; if (!g) return;
    const counted = fight.knights.filter(k => full(k) && standing(k)); if (counted.length < 2) { g.x = g.base; return; }
    const mean = counted.reduce((q, k) => q + k.x, 0) / counted.length, trigger = s.hornLine ? s.hornLine : (s.camX || [s.x0])[0] + ((fight.area.camera || {}).aimX === undefined ? 176 : fight.area.camera.aimX);
    const lead = fight.knights[0], want = lead.x + (trigger - mean) + 12, bank = s.hornLine ? (((fight.area.moat || {}).u || [2580])[0] - 16) + g.y : Infinity;   // on the bank: u <= the moat's edge less 16
    g.x = Math.min(Math.max(g.base, want), bank);
  }
  const arenaBox = (fight, ar) => { const F = fight.floor; return { x0: Math.max(F.x0, ar.spec.x0), x1: Math.min(F.x1, ar.spec.x1), y0: F.y0, y1: F.y1 }; };
  const rallyOf = (fight, ar) => fight.knights.map(k => [ar.spec.rally, (ar.spec.rallyY || [])[k.seat] !== undefined ? ar.spec.rallyY[k.seat] : (ar.spec.rallyY || [212])[0]]);

  // ------------------------------------------------------------------ the step
  function step(fight, D, dt, input) {
    const C = CB();
    D.t += dt;
    tracks(fight, D, dt);
    uses(fight, D, input);
    if (fight.wipe) { if (!D.wiping) { D.wiping = true; onWipe(fight, D); } }
    else if (D.wiping) { D.wiping = false; retry(fight, D); }
    deaths(fight, D);   // the drops of this step's deaths first, so a clear's magnet takes the last troll's pouch too
    if (D.waves && !fight.wipe) {
      castleStep(fight, D, dt);
      wavesStep(fight, D, dt);
      callsStep(fight, D);
      postWatch(fight, D);
    }
    enginesStep(fight, D, dt);
    gateWatch(fight, D);
    pouchesStep(fight, D, dt);
    camera(fight, D, dt);
    freeBox(fight, D);
  }
  // each knight's movement over the last 2.0 s (the trebuchets pick the least moved) and its velocity this step (their lead)
  function tracks(fight, D, dt) {
    const win = (((fight.area.engineKinds || {}).trebuchet || {}).pickWindow) || 2.0;
    for (const k of fight.knights) {
      const T = D.track[k.seat] || (D.track[k.seat] = { px: k.x, py: k.y, vx: 0, vy: 0, log: [], sum: 0 });
      const d = dist(k.x, k.y, T.px, T.py);
      T.vx = dt > 0 ? (k.x - T.px) / dt : 0; T.vy = dt > 0 ? (k.y - T.py) / dt : 0; T.px = k.x; T.py = k.y;
      T.log.push([D.t, d]); T.sum += d; T.head = T.head || 0;
      while (T.head < T.log.length && T.log[T.head][0] < D.t - win - 1e-9) T.sum -= T.log[T.head++][1];
      if (T.head > 256) { T.log = T.log.slice(T.head); T.head = 0; }
      if (T.sum < 1e-9) T.sum = 0;
    }
  }
  // E or a tap (inp.use, one step): the chest within 16 px first, then the ram (gate.json promptOrder); the exit (inp.exit, the page's
  // finish) opens the chest at once and brings every pouch home, so nothing is lost (section 3.4)
  function uses(fight, D, input) {
    const C = CB(), A = fight.area;
    // the party leaves (the page's finish steps once with exit: true, on seat 0's input or on the keyed container): the chest opens if it
    // was not, and every pouch on the ground or in flight lands in its knight's satchel in this very step, its pickup event with it
    if (input && (input.exit || (inputOf(input, 0) || {}).exit)) { if (fight.chest.shown && !fight.chest.open) openChest(fight, D, 0, true); for (const q of D.pouches.slice()) take(fight, D, q); }
    for (const k of fight.knights) {
      const inp = inputOf(input, k.seat);
      if (!inp) continue;
      if (!inp.use || !standing(k)) continue;
      const ch = fight.chest;
      if (ch.shown && !ch.open && dist(k.x, k.y, ch.x, ch.y) <= ((A.chest || {}).use || 16) + 1e-9) { openChest(fight, D, k.seat, false); continue; }
      C.takeRam(fight, k.seat);
    }
  }
  function inputOf(input, seat) { if (!input) return null; if (Array.isArray(input)) return input[seat] || null; if (input[seat] !== undefined && typeof input[seat] === "object") return input[seat]; return seat === 0 ? input : null; }

  // ------------------------------------------------------------------ the camera (section 3.2)
  // Float positions moved at up to 96 px/s an axis toward the aim: across, the counted knights' mean x - 176 (- 96 east of x 2560); up and
  // down a dead zone, camY moving only when the mean feet leave view y 84..148 and only to its edge; the lean toward the trolls on a knight
  // within 240 px (32 across and up, 14 down) shifts the aim and the window; the limits (the last started arena's west edge; the first
  // uncleared arena's camera x); then the position yields to the counted knights (feet in view y 70..204; solo, x 14..369 too), the horn's
  // frame holds camY 100..146 and drives camX to 2604 or more; the view is the rounded position. Downed, carried-off and brothers are not counted
  function camera(fight, D, dt) {
    const A = fight.area, CA = A.camera || {}, C = CB(), cam = D.cam, vw = fight.vw, vh = fight.vh;
    const counted = fight.knights.filter(k => full(k) && standing(k));
    const aimXd = CA.aimX === undefined ? 176 : CA.aimX, G = CA.aimXGate || { east: 2560, aimX: 96 }, DZ = CA.deadY || [84, 148], LN = CA.lean || { max: 32, maxDown: 14, within: 240 }, sp = CA.speed || 96;
    const VK = A.viewKnight || { x0: 14, x1: 369, y0: 70, y1: 204 };
    let tx = cam.xf, ty = cam.yf;
    if (counted.length) {
      let mx = 0, my = 0; for (const k of counted) { mx += k.x; my += k.y - (k.z || 0); } mx /= counted.length; my /= counted.length;
      // the lean: the mean of the trolls that target a knight within 240 px of it, relative to the knights' mean
      let lx = 0, ly = 0, n = 0;
      for (const f of fight.foes) { if (f.dead || !f.brain || f.brain.target === null) continue; const k = fight.knights[f.brain.target]; if (!k || dist(f.x, f.y, k.x, k.y) > LN.within) continue; lx += f.x; ly += f.y - (f.z || 0); n++; }
      if (n) { lx = clamp(lx / n - mx, -LN.max, LN.max); ly = clamp(ly / n - my, -LN.max, LN.maxDown); } else { lx = 0; ly = 0; }
      tx = mx - (mx >= G.east ? G.aimX : aimXd) + lx;
      const fy = my - cam.yf, w0 = DZ[0] - ly, w1 = DZ[1] - ly;   // the window, shifted by the lean (down: the knights sit higher on the screen)
      if (fy < w0) ty = my - w0; else if (fy > w1) ty = my - w1; else ty = cam.yf;
    }
    if (D.frame) { tx = Math.max(tx, (CA.hornFrame || {}).xMin || 2604); ty = clamp(ty, ((CA.hornFrame || {}).y || [100, 146])[0], ((CA.hornFrame || {}).y || [100, 146])[1]); }
    tx = clamp(tx, cam.left, cam.right); ty = clamp(ty, (CA.y || [0, 216])[0], (CA.y || [0, 216])[1]);
    cam.xf += clamp(tx - cam.xf, -sp * dt, sp * dt);
    cam.yf += clamp(ty - cam.yf, -sp * dt, sp * dt);
    // the yield: no counted knight is ever moved by the view (inside the limits). It keeps the feet 2 px inside the box: a knight's own move
    // is clamped to the box of the last step's camera before this step's camera is read, so at the box's very edge (the lean's window shifted
    // 14 px down meets it) a knight walking out would be stopped by the box while the camera never followed
    yieldCam(fight, D, true);
    cam.xf = clamp(cam.xf, cam.left, cam.right); cam.yf = clamp(cam.yf, (CA.y || [0, 216])[0], (CA.y || [0, 216])[1]);
    const x0 = Math.round(cam.xf), y0 = Math.round(cam.yf);
    if (x0 !== fight.view.x0 || y0 !== fight.view.y0) C.setView(fight, x0, y0);
  }
  // the yield (section 3.2): camY clamped so every counted knight's screen feet stay inside view y 70..204 (2 px in), and, solo, camX so the
  // knight stays inside view x 14..369; not during the horn's frame (the frame holds the camera, a knight outside is drawn along by the edge).
  // The yield is not bound by the camera's 96 px/s: a solo knight's dodge or knockback past the window is followed in the same step, since
  // "a solo knight is never moved by the view" (section 3.2) comes before the speed
  function yieldCam(fight, D, inStep, xAll) {
    const A = fight.area, VK = A.viewKnight || { x0: 14, x1: 369, y0: 70, y1: 204 }, cam = D.cam;
    const counted = fight.knights.filter(k => full(k) && standing(k));
    if (!counted.length || (inStep && D.frame)) return;
    let lo = -Infinity, hi = Infinity;
    for (const k of counted) { const feet = k.y - (k.z || 0); lo = Math.max(lo, feet - VK.y1 + YIELD); hi = Math.min(hi, feet - VK.y0 - YIELD); }
    if (lo <= hi) cam.yf = clamp(cam.yf, lo, hi);
    if (counted.length === 1 || xAll) { let xlo = -Infinity, xhi = Infinity; for (const k of counted) { xlo = Math.max(xlo, k.x - VK.x1 + YIELD); xhi = Math.min(xhi, k.x - VK.x0 - YIELD); } if (xlo <= xhi) cam.xf = clamp(cam.xf, xlo, xhi); }
  }
  // the box a counted solo knight's own move keeps to (combat.js's W.boxOf reads fight.level.freeBox for fight.level.freeSeat): every view
  // the camera's limits allow, so its dodge or walk is never stopped by the view it happens to be in, and the camera yields to it (above);
  // none during the horn's frame or with two or more counted knights (the view's box then, as before)
  function freeBox(fight, D) {
    const A = fight.area, CA = A.camera || {}, VK = A.viewKnight || { x0: 14, x1: 369, y0: 70, y1: 204 }, F = fight.floor, Y = CA.y || [0, 216], L = fight.level;
    const counted = fight.knights.filter(k => full(k) && standing(k));
    if (D.frame || counted.length !== 1) { L.freeBox = null; L.freeSeat = null; return; }
    L.freeSeat = counted[0].seat;
    L.freeBox = { x0: Math.max(F.x0, D.cam.left + VK.x0), x1: Math.min(F.x1, D.cam.right + VK.x1), y0: Math.max(F.y0, Y[0] + VK.y0), y1: Math.min(F.y1, Y[1] + VK.y1) };
  }
  // the limits: left, the west edge of the last arena whose wave has started (0 before arena 1); right, the camera x of the first arena not
  // yet cleared (its second value in arena 5), else the world's right end
  function limits(fight, D) {
    const CA = fight.area.camera || {}, X = CA.x || [0, 2688];
    let left = X[0], right = X[1];
    for (const ar of D.arenas) if (ar.started || ar.state !== "ahead") left = Math.max(left, ar.spec.x0);   // from the moment the camera reaches the arena (its wave in `delay` s), not its start
    const next = D.arenas.find(ar => !ar.cleared);
    if (next) right = next.spec.camX ? next.spec.camX[next.spec.camX.length - 1] : next.spec.x0;
    D.cam.left = clamp(left, X[0], X[1]); D.cam.right = clamp(Math.max(right, D.cam.left), X[0], X[1]);
  }

  // ------------------------------------------------------------------ the waves (section 3.6)
  function wavesStep(fight, D, dt) {
    const C = CB(), ar = D.arenas[D.ai];
    if (!ar) return;
    if (ar.state === "ahead") {
      const ST = (ar.wave || {}).start || {};
      if (!ar.wave) { clearArena(fight, D, ar); return; }
      steerGoal(fight, D, ar);
      if (ST.after === "hornLine") {   // arena 5: the horn when the counted knights' mean x passes the horn line (the castle's step runs the bridge)
        if (D.hornRetryAt !== undefined && D.hornRetryAt !== null) return;   // a retry: the horn 3 s after the fade lifts (the castle's step sounds it)
        const counted = fight.knights.filter(k => full(k) && standing(k)), mx = counted.length ? counted.reduce((s, k) => s + k.x, 0) / counted.length : -Infinity;
        if (mx < (ar.spec.hornLine || 2700)) return;
        horn(fight, D, ar, ST.delay || 3);
      } else {
        if (fight.view.x0 < (ar.spec.camX || [ar.spec.x0])[0] - 1e-9) return;   // the camera reaches the arena's x: the wave in `delay` s
        ar.state = "delay"; ar.delay = ST.delay || 2; limits(fight, D);
        fight.level.rally = rallyOf(fight, ar); setArena(fight, D, ar); setGoal(fight, D, null);
      }
      return;
    }
    if (ar.state === "delay") { ar.delay -= dt; if (ar.delay <= 1e-9) { if (ar.retryPhase) resumePhase(fight, D, ar); else startWave(fight, D, ar); } return; }
    if (ar.state !== "live") return;
    ar.t += dt;
    if (ar.id === 5 && !fight.bridge.down) return;   // nothing comes out before the bridge lands (the castle's step)
    release(fight, D, ar, dt);
    hutsStep(fight, D, ar, dt);
    trickleStep(fight, D, ar, dt);
    if (ar.id === 5) castlePhases(fight, D, ar);
    if (arenaDone(fight, D, ar)) clearArena(fight, D, ar);
  }
  // the wave begins: its name, the attempt (the Second Wind back, the carried-off back at the rally), its groups scaled and split, the
  // Emberback's roll, the engine of the wave manned
  function startWave(fight, D, ar) {
    const C = CB(), w = ar.wave;
    ar.state = "live"; ar.t = 0; ar.attempt++;
    if (!ar.started) { ar.started = true; limits(fight, D); D.p = humans(fight); D.b = brothersOf(fight); D.scale = scaling(fight.area, D.p, D.b); }
    fight.level.rally = rallyOf(fight, ar); setArena(fight, D, ar);
    if (ar.attempt === 1) C.waveStart(fight, fight.level.rally);   // the wave's first attempt: the Second Wind back, the carried-off back at the rally (a retry's rally did that)
    emit(fight, { type: "wave", n: ar.i + 1, of: (fight.area.waves || []).length || 5, name: w.name, arena: ar.id, attempt: ar.attempt });
    buildGroups(fight, D, ar, w.groups || [], false);
    for (const e of D.engines) if (e.spec.arena === ar.id && e.spec.manned === "waveStart" && !e.wrecked) { if (!e.winch || e.winch.dead) { e.crew = e.K.crew || 3; e.sent = 0; e.reserveAt = null; manEngine(fight, D, e, true); } e.active = true; }   // its cycle runs from the wave's start (a retry re-manned it at the rally)
    D.squadT = 0;
  }
  // the groups of a wave (or of Break the gate): a kind's total over the door groups scaled by the rule and split by largest remainder;
  // an outpost's group and a trickle a total of their own; brutes, the tower archer and the engines fixed; the wall archers by their rule
  function buildGroups(fight, D, ar, specs, breakGate) {
    const A = fight.area, S = D.scale, kinds = (A.scaling || {}).kinds || ["footman", "firestaff", "archer", "icearcher"], cm = dX(fight, "count");
    const scaled = n => Math.round(S.count(n) * cm);
    const groups = specs.map((g, i) => ({ i, spec: g, kind: g.kind || null, n: 0, solo: g.n || 0, scaled: 0, delay: g.delay || 0, sent: 0, trolls: [], type: typeOf(g) }));
    for (const kind of kinds) {
      const doors = groups.filter(g => g.type === "door" && g.kind === kind && g.spec.scale !== false);
      if (!doors.length) continue;
      const total = doors.reduce((s, g) => s + g.solo, 0), sc = scaled(total), parts = split(sc, doors.map(g => g.solo));
      doors.forEach((g, j) => { g.n = parts[j]; g.scaled = sc; g.total = total; });
    }
    for (const g of groups) {
      if (g.type === "door" && g.spec.scale === false) { g.n = g.solo; g.scaled = g.solo; g.total = g.solo; }
      else if (g.type === "deck") { g.n = g.solo; g.scaled = g.solo; g.total = g.solo; }
      else if (g.type === "trickle" || g.type === "hut") { g.n = g.spec.scale === false ? g.solo : scaled(g.solo); g.scaled = g.n; g.total = g.solo; }
      else if (g.type === "wall") { g.n = S.wall.n; g.scaled = S.wall.n; g.total = (A.scaling || {}).wallArchers ? A.scaling.wallArchers.base || 2 : 2; }
    }
    ar.groups = ar.groups.concat(groups);
    // the door entries in release order (group order, then each troll), the Emberback replacing the middle club footman (waves 2 to 5)
    const entries = [];
    for (const g of groups) if (g.type === "door" || g.type === "deck" || g.type === "wall") for (let j = 0; j < g.n; j++) entries.push({ g, j, kind: g.kind, door: j, waitT: 0, sent: false, troll: null });
    if (!breakGate) {
      const foot = entries.filter(e => e.g.type === "door" && e.kind === "footman");
      if (foot.length && CB().emberRoll(fight, ar.i + 1)) foot[Math.floor((foot.length - 1) / 2)].kind = "emberback";
    }
    ar.entries = ar.entries.concat(entries);
    // the outposts' huts: each hut's queue by the split of each kind's total over the outpost's huts (the Gallows Post's were filled at the
    // level's start: they only come alive here)
    fillHuts(fight, D, groups.filter(g => g.type === "hut"), false);
    // the trickle (wave 5's gate): one every `every` s while a named kind lives, the fire-staff third, at most 2 + p alive
    const tr = groups.filter(g => g.type === "trickle");
    if (tr.length) {
      const seq = [], foot = tr.find(g => g.kind === "footman"), others = tr.filter(g => g !== foot);
      if (foot) for (let j = 0; j < foot.n; j++) seq.push({ kind: foot.kind, g: foot });
      for (const g of others) { const ord = g.spec.order || 3; for (let j = 0; j < g.n; j++) seq.splice(Math.min(seq.length, ord - 1 + j * ord), 0, { kind: g.kind, g }); }
      ar.trickle = { seq, i: 0, t: tr[0].spec.every || 4, every: tr[0].spec.every || 4, whileAlive: tr[0].spec.whileAlive || null, aliveMax: tr[0].spec.aliveMax ? S.trickleAlive : Infinity, trolls: [], from: tr[0].spec.from };
    }
  }
  // the huts' queues from an outpost's groups (scaled totals of their own, split over the huts by largest remainder, footmen before fire-staffs);
  // early: filled at the level's start and not live yet; else live from now, with the outpost's alive at once (2 + p where the group says)
  function fillHuts(fight, D, groups, early) {
    const S = D.scale, cm = dX(fight, "count");
    for (const g of groups) {
      const op = D.outposts[String(g.from || g.spec.from).replace("outpost", "") | 0]; if (!op) continue;
      const spec = g.spec || g, kind = g.kind || spec.kind;
      if (!op.filled) {
        const n = g.n !== undefined && g.spec ? g.n : Math.round(S.count(spec.n || 0) * cm), parts = split(n, op.huts.map(() => 1));
        op.huts.forEach((h, j) => { for (let q = 0; q < parts[j]; q++) h.queue.push({ kind, g: g.spec ? g : { i: -1, spec, kind, n, solo: spec.n || 0, scaled: n, total: spec.n || 0, sent: 0, trolls: [], type: "hut" } }); if (h.piece && h.piece.broken) h.queue.length = 0; h.share = h.queue.map(q => ({ kind: q.kind, g: q.g })); });   // a hut wrecked before its wave: its share is cancelled; the share is kept for a retry
      }
      if (!early) { op.live = true; op.aliveMax = spec.aliveMax ? S.trickleAlive : Infinity; if (g.spec) g.op = op; }
    }
    for (const g of groups) { const op = D.outposts[String(g.from || g.spec.from).replace("outpost", "") | 0]; if (op) op.filled = true; }   // filled once: a retry resets the standing huts' queues to their shares, never appends
  }
  function typeOf(g) {
    if (g.engine) return "engine";
    const from = Array.isArray(g.from) ? g.from[0] : g.from;
    if (typeof from === "string" && /^outpost/.test(from)) return "hut";
    if (from === "breaches" || g.n === "wallArchers") return "wall";
    if (from === "towerDeck") return "deck";
    if (g.every) return "trickle";
    return "door";
  }
  // the door points of a group's `from` (a name or names of gate.json's doors); the gate's arch and the deck are their own
  function doorsOf(fight, g) {
    const A = fight.area, names = Array.isArray(g.spec.from) ? g.spec.from : [g.spec.from], out = [];
    for (const name of names) for (const p of (A.doors || {})[name] || []) out.push({ name, p });
    return out;
  }
  // the release: a squad of at most 4 due entries every 2.5 s (a hut's footman a squad of one, through the same gate), never over the alive
  // cap (roar footmen pass it); each troll comes through its door unless a standing knight is within 48 px of its point or the point is
  // under a thumb: then the group's other doors, then the palisade's other gates, and after 1.5 s its own door anyway, shoving knights
  // within 16 px of where it steps in 12 px away; the gate's arch never waits
  function release(fight, D, ar, dt) {
    const C = CB(), R = fight.area.release || { squad: 4, every: 2.5 }, DW = common().doorWait || { near: 48, max: 1.5, shoveWithin: 16, shove: 12 };
    D.squadT = Math.max(0, D.squadT - dt);
    // the entries picked for the squads so far keep trying their doors
    for (const e of ar.entries) if (e.picked && !e.sent) tryDoor(fight, D, ar, e, dt, DW);
    for (const e of ar.entries) if (!e.picked && e.g.type === "wall" && ar.t >= e.g.delay - 1e-9) { e.picked = true; e.pickedAt = fight.t; tryDoor(fight, D, ar, e, dt, DW); }   // the wall archers take their breaches outside the squads: they come through no door
    if (D.squadT > 0) return;
    const room = D.scale.cap * dX(fight, "aliveCap") - aliveIn(fight, D, ar);
    if (room < 1) return;
    const due = ar.entries.filter(e => !e.picked && ar.t >= e.g.delay - 1e-9).slice(0, Math.min(R.squad || 4, Math.floor(room)));
    if (!due.length) return;
    for (const e of due) { e.picked = true; e.pickedAt = fight.t; tryDoor(fight, D, ar, e, dt, DW); }
    D.squadT = R.every || 2.5;
  }
  function aliveIn(fight, D, ar) { let n = 0; for (const f of fight.foes) if (!f.dead && f.arenaId === ar.id && !f.pastCap) n++; for (const e of ar.entries) if (e.picked && !e.sent) n++; return n; }
  function tryDoor(fight, D, ar, e, dt, DW) {
    const g = e.g;
    if (g.type === "wall") { const slot = wallSlot(fight, D, e); if (slot) spawnAt(fight, D, ar, e, slot); return; }
    if (g.type === "deck") { const S = (fight.area.surfaces || []).find(s => s.id === g.spec.from); if (S) spawnAt(fight, D, ar, e, { x: (S.rect[0] + S.rect[2]) / 2, y: (S.rect[1] + S.rect[3]) / 2 - 6, on: S.id, hold: true, name: S.id }); return; }
    const doors = doorsOf(fight, g);
    if (!doors.length) { e.sent = true; return; }
    const first = doors[e.door % doors.length], never = (DW.never || ["gate"]).includes(first.name);
    const order = [first].concat(doors.filter(d => d !== first)).concat(never ? [] : siblings(fight, first.name, doors));
    if (!never) for (const d of order) if (!blocked(fight, d.p, DW)) { spawnDoor(fight, D, ar, e, d, false); return; }
    if (never || e.waitT >= (DW.max || 1.5) - 1e-9) { spawnDoor(fight, D, ar, e, first, true); return; }
    e.waitT += dt;
  }
  // the other troll gates of the same palisade ("stake1Up" <-> "stake1Low")
  function siblings(fight, name, had) {
    const m = /^(stake\d)(Up|Low)$/.exec(name); if (!m) return [];
    const other = m[1] + (m[2] === "Up" ? "Low" : "Up"), out = [];
    for (const p of (fight.area.doors || {})[other] || []) if (!had.some(d => d.name === other)) out.push({ name: other, p });
    return out;
  }
  function blocked(fight, p, DW) {
    const C = CB(), v = fight.view, inView = p[0] >= v.x0 && p[0] <= v.x1 && p[1] >= v.y0 && p[1] <= v.y1;
    if (inView && C.inThumb(fight, p[0], p[1], 0)) return true;   // under a thumbs' corner of the view (a door off the screen is clear)
    for (const k of fight.knights) if (standing(k) && dist(k.x, k.y, p[0], p[1]) <= (DW.near || 48) + 1e-9) return true;
    return false;
  }
  // where a door's troll steps onto the floor: a troll gate's point stands past the palisade's line, so in through it, onto the arena's
  // floor; the arch's point on the deck; the rest at the point, on free floor
  function spawnDoor(fight, D, ar, e, d, forced) {
    const A = fight.area, F = fight.floor, K = CB().trollKind(e.kind), r = (K.body || {}).r || 7;
    let x = d.p[0], y = clamp(d.p[1], F.y0, F.y1), on = null;
    if (/^stake/.test(d.name)) { const pal = (A.palisades || []).find(s => x >= s.x0 - 1 && x <= s.x1 + 16 + r + 2); if (pal) x = pal.x0 - r - 2; }
    if (d.name === "gate") { const B = fight.world.plats.find(P => P.when === "bridgeDown"); on = B ? B.id : null; }
    spawnAt(fight, D, ar, e, { x, y, on, name: d.name, point: d.p, forced });
  }
  function spawnAt(fight, D, ar, e, at) {
    const C = CB(), P = PH(), W = fight.world, DW = common().doorWait || { shoveWithin: 16, shove: 12 }, g = e.g;
    const o = { tell: common().spawnTell || 0.6, on: at.on || null, hold: !!at.hold, fixed: !!at.fixed, z: at.z, from: at.from || (g.type === "hut" ? "hut" : at.name || null), brain: true };
    const f = C.spawn(fight, e.kind, at.x, at.y, o);
    if (!f) return false;   // at caps.foes: it waits
    e.sent = true; e.troll = f; g.sent++; g.trolls.push(f); ar.trolls.push(f);
    f.arenaId = ar.id; f.box = at.fixed ? null : arenaBox(fight, ar); f.group = g; f.door = at.name || null; f.pastCap = !!e.pastCap;
    f.drop = { source: e.source || (g.type === "deck" ? "towerArcher" : e.kind), solo: g.total, scaled: g.scaled };
    if (!at.fixed && !at.on) { W.list = C.bodies(fight); if (P.caught(W, f) || P.groundAt(W, f.x, f.y).deep) { P.freePoint(W, f); } }
    // a troll stepping in shoves every knight within 16 px of where it steps 12 px away (no damage, no stagger)
    for (const k of fight.knights) if (!k.out && dist(k.x, k.y, f.x, f.y) <= (DW.shoveWithin || 16) + 1e-9) { const d = dist(k.x, k.y, f.x, f.y), ux = d > 1e-6 ? (k.x - f.x) / d : -1, uy = d > 1e-6 ? (k.y - f.y) / d : 0; P.push(W, k, ux, uy, DW.shove || 12); emit(fight, { type: "shoved", seat: k.seat, by: f.id, x: k.x, y: k.y }); }
    return true;
  }
  // a wall archer's breach: the slots in the castle's order, every second one to stand an ice archer, fixed on its sill at z 16
  function wallSlot(fight, D, e) {
    const BR = ((fight.area.castle || {}).breaches) || {}, slots = BR.slots || [], order = BR.order || slots.map((s, i) => i), idx = order[e.j % order.length];
    if (slots[idx] === undefined) return null;
    const ice = ((fight.area.scaling || {}).wallArchers || {}).iceEvery || 2;
    e.kind = (e.j + 1) % ice === 0 ? "icearcher" : "archer"; e.source = e.kind;
    return { x: slots[idx][0], y: slots[idx][1], fixed: true, z: BR.z === undefined ? 16 : BR.z, name: "breach", from: "breach" };
  }
  // the huts: from the wave's start each standing hut sends one of its queue every `every` s (the first after `every`), through the squad
  // gate as a squad of one, under the cap and the outpost's own alive at once; a wrecked hut sends no more
  function hutsStep(fight, D, ar, dt) {
    for (const op of (D.outpostList || Object.values(D.outposts))) {
      if (!op.live || op.arena !== ar.id) continue;
      const DW = common().doorWait || { near: 48, max: 1.5 }, flap = h => [h.x, h.y + h.r + 8], standingHut = h => h.piece && !h.piece.broken && h.queue.length;
      for (const h of op.huts) {
        if (!standingHut(h)) continue;
        h.t -= dt;
        if (h.t > 1e-9 || D.squadT > 0) continue;
        if (aliveIn(fight, D, ar) >= D.scale.cap * dX(fight, "aliveCap") || op.huts.reduce((s, q) => s + q.trolls.filter(f => !f.dead).length, 0) >= op.aliveMax) continue;
        // a knight at the flap (48 px) or a flap under a thumb: the troll comes out of another standing hut first; after 1.5 s its own anyway
        let from = h;
        if (blocked(fight, flap(h), DW)) { from = op.huts.find(o => o !== h && standingHut(o) && !blocked(fight, flap(o), DW)) || null; if (!from) { h.waitT = (h.waitT || 0) + dt; if (h.waitT < (DW.max || 1.5) - 1e-9) continue; from = h; } }
        const q = h.queue[0];
        if (spawnHut(fight, D, ar, op, from, q)) { h.queue.shift(); h.t += op.every; h.waitT = 0; D.squadT = (fight.area.release || {}).every || 2.5; }
      }
    }
  }
  function spawnHut(fight, D, ar, op, h, q) {
    const K = CB().trollKind(q.kind), r = (K.body || {}).r || 7, e = { g: q.g, j: h.sent, kind: q.kind, source: q.kind, sent: false };
    if (!spawnAt(fight, D, ar, e, { x: h.x, y: h.y + h.r + r + 1, name: "hut", from: "hut" })) return false;
    h.sent++; h.trolls.push(e.troll); e.troll.hut = h; return true;
  }
  // wave 5's trickle out of the arch: one every 4 s while a brute lives, at most 2 + p of them alive, under the cap
  function trickleStep(fight, D, ar, dt) {
    const T = ar.trickle; if (!T || T.i >= T.seq.length) return;
    if (T.whileAlive && !fight.foes.some(f => !f.dead && T.whileAlive.includes(f.kind) && f.arenaId === ar.id)) return;
    T.t -= dt; if (T.t > 1e-9) return;
    if (T.trolls.filter(f => !f.dead).length >= T.aliveMax || aliveIn(fight, D, ar) >= D.scale.cap * dX(fight, "aliveCap")) return;
    const q = T.seq[T.i], e = { g: q.g, j: T.i, kind: q.kind, source: q.kind, sent: false };
    const d = { name: T.from, p: ((fight.area.doors || {})[T.from] || [[2884, 252]])[0] };
    spawnDoor(fight, D, ar, e, d, true);
    if (e.sent) { T.i++; T.t += T.every; T.trolls.push(e.troll); }
  }
  // the roar's footmen (fight.level.calls, written by the brute's roar in combat.js): out of the arch past the cap, cancelled when the
  // arch is blocked (the portcullis down)
  function callsStep(fight, D) {
    const L = fight.level, ar = D.arenas[D.ai];
    if (!L.calls || !L.calls.length) return;
    if (!ar || ar.id !== 5 || ar.phase !== "gatekeepers" || !fight.bridge.down) { L.calls.length = 0; return; }
    for (const c of L.calls.slice()) {
      if (D.t < c.at - 1e-9 && fight.t < c.at - 1e-9) continue;
      L.calls.splice(L.calls.indexOf(c), 1);
      const g = ar.groups.find(q => q.kind === "footman" && q.type === "trickle") || { i: -1, kind: "footman", n: 0, solo: 0, scaled: 0, total: 0, sent: 0, trolls: [], type: "call", spec: {} };
      const e = { g, j: 0, kind: c.kind || "footman", source: "roarFootman", pastCap: true, sent: false };
      spawnDoor(fight, D, ar, e, { name: c.from || "gate", p: ((fight.area.doors || {})[c.from || "gate"] || [[2884, 252]])[0] }, true);
    }
  }
  // an arena is done when every entry has come in and died, no standing hut has anything left to send, the trickle is spent and no
  // reserve is still to come for its engine (with the wave's other trolls dead the reserves are cancelled)
  function arenaDone(fight, D, ar) {
    if (ar.entries.some(e => !e.sent)) return false;
    if (ar.trickle && ar.trickle.i < ar.trickle.seq.length && (!ar.trickle.whileAlive || fight.foes.some(f => !f.dead && ar.trickle.whileAlive.includes(f.kind) && f.arenaId === ar.id))) return false;
    for (const op of (D.outpostList || Object.values(D.outposts))) if (op.live && op.arena === ar.id) for (const h of op.huts) if (h.piece && !h.piece.broken && h.queue.length) return false;
    if (ar.id === 5 && ar.phase !== "lastStand") return false;
    const live = fight.foes.filter(f => !f.dead && f.arenaId === ar.id);
    const others = live.some(f => f.kind !== "winchman");
    for (const e of D.engines) if (e.spec.arena === ar.id && !e.wrecked) { if (!others) { e.reserveAt = null; e.crew = 0; } else if (e.reserveAt !== null || (e.winch && !e.winch.dead)) return false; }
    return live.length === 0;
  }
  // the arena clears: its palisade topples (Onward), a Breather where the area says so, the next arena's box for the fields; arena 5's
  // clear is the gate ours
  function clearArena(fight, D, ar) {
    const C = CB(), P = PH(), W = fight.world, A = fight.area;
    deaths(fight, D);   // this step's deaths (the burst's crushed and drowned) roll their pouches before the magnet takes them
    ar.state = "cleared"; ar.cleared = true;
    if (ar.spec.palisade !== undefined && W.palisades[ar.spec.palisade] !== undefined) {
      const s = W.solids[W.palisades[ar.spec.palisade]];
      if (s && !s.gone) { P.removeSolid(W, s); P.addCover(W, { kind: "fallenPalisade", shape: "r", x0: s.x0, y0: s.y0, x1: s.x1 + 24, y1: s.y1, on: null }); emit(fight, { type: "palisade", id: ar.spec.palisade, x0: s.x0, x1: s.x1, y0: s.y0, y1: s.y1 }); }
    }
    if (ar.id === 5) { fight.gate.ours = true; fight.level.gateOpen = true; emit(fight, { type: "gateOurs", x: fight.chest.x, y: fight.chest.y }); magnet(fight, D); }
    else {
      emit(fight, { type: "onward", arena: ar.id, next: ar.id + 1 });
      if (ar.spec.breather) breather(fight, D);
    }
    for (const e of D.engines) if (e.spec.arena === ar.id && e.spec.manned === "waveStart") e.active = false;
    D.ai = ar.i + 1;
    limits(fight, D);
    setArena(fight, D, null);   // the walk: the fields follow the view until the camera reaches the next arena
    if (D.arenas[D.ai]) setGoal(fight, D, D.arenas[D.ai]); else setGoal(fight, D, null);
  }
  // the Breather (section 3.6): every knight heals 40, a downed knight stands at 40, the carried-off come back at 50 at the rally, every
  // pouch on the ground flies home
  function breather(fight, D) {
    const C = CB(), B = fight.area.breather || { heal: 40, liftHp: 40, returnHp: 50 }, heal = Math.round((B.heal || 40) * dX(fight, "breatherHeal"));
    for (const k of fight.knights) {
      if (k.down) { k.down = null; k.hp = B.liftHp || 40; k.hurt = 0; k.stagger = 0; emit(fight, { type: "lifted", by: null, x: k.x, y: k.y, hp: k.hp, seat: k.seat }); }
      else if (!k.out && !(k.rise > 0)) C.healKnight(fight, k, heal);
    }
    C.returnKnights(fight, fight.level.rally);
    emit(fight, { type: "breather", heal });
    magnet(fight, D);
  }
  // a wipe (section 3.8): the fade's 3 s, then the rally restarts the wave: every troll of the arena alive is gone (quietly: no stone death,
  // no drops), the door groups come again in full, a hut's or a trickle's trolls alive at the wipe go back to its share; the engine of the
  // wave is manned again; Break the gate keeps the gate's damage, the brutes dead and the bridge down; the gatekeepers' retry raises the
  // bridge and sounds the horn 3 s after the fade lifts
  function onWipe(fight, D) { /* the trolls fight on through the fade; the rally restarts the wave */ }
  function retry(fight, D) {
    const C = CB(), ar = D.arenas[D.ai];
    if (!ar || ar.state !== "live" && ar.state !== "delay") return;
    const last = ar.id === 5 && ar.phase === "lastStand";
    // every troll of the arena alive leaves quietly; after the burst the trolls that were left stand again at 1 HP instead (section 3.8)
    for (const f of fight.foes.slice()) if (f.arenaId === ar.id && !f.dead) { if (last && !f.fixed) { f.hp = Math.min(f.hp, 1); f.act = null; continue; } unspawn(fight, D, f); }
    // a standing hut sends its whole share again (section 3.8); the wrecked stay wrecked
    for (const op of (D.outpostList || Object.values(D.outposts))) if (op.arena === ar.id) for (const h of op.huts) { h.trolls = h.trolls.filter(f => f.dead || f.gone !== "wipe"); h.t = op.every; h.waitT = 0; if (op.live && h.piece && !h.piece.broken) h.queue = (h.share || []).map(q => ({ kind: q.kind, g: q.g })); }
    fight.level.calls.length = 0;
    // a standing engine's crew is whole again, with a winchman at its post
    for (const e of D.engines) if (e.spec.arena === ar.id && !e.wrecked) { e.crew = e.K.crew || 3; e.sent = 0; e.reserveAt = null; e.waitT = 0; if (!e.winch || e.winch.dead) manEngine(fight, D, e, true); }
    if (ar.id === 5 && ar.phase && ar.phase !== "gatekeepers") {
      // Break the gate, or the last of them, again (A.2 retry.breakGate.keep): the gate's damage, the brutes dead and the bridge down stay,
      // nothing of the gatekeepers' wave is rebuilt; during Break the gate the wall archers stand again (after the burst they are drowned)
      ar.entries = ar.entries.filter(e => e.g.type === "wall" ? ar.phase === "breakGate" : (e.sent && e.troll && e.troll.dead));
      for (const e of ar.entries) if (e.g.type === "wall") { e.sent = false; e.picked = false; e.troll = null; e.waitT = 0; }
      if (ar.trickle) ar.trickle.trolls = ar.trickle.trolls.filter(f => f.dead);
      ar.retryPhase = true; ar.state = "delay"; ar.delay = (ar.wave.start || {}).delay || 2;
      return;
    }
    ar.entries = []; ar.groups = []; ar.trickle = null;
    ar.state = "delay"; ar.delay = (ar.wave.start || {}).delay || 2;
    if (ar.id === 5) { raiseBridge(fight, D); ar.phase = null; ar.state = "ahead"; D.hornRetryAt = D.t + (((((fight.area.waves || [])[4] || {}).retry || {}).gatekeepers || {}).hornAfter || 3); }   // "horn: 3 s after the fade lifts"
  }
  // Break the gate or the last of them again after a wipe (section 3.8's Wave 5 retry row): the phase's own line again, nothing of the
  // gatekeepers' wave rebuilt; the wall archers come to their breaches again at once (Break the gate), the Gallows share in full
  function resumePhase(fight, D, ar) {
    const BG = (ar.wave || {}).breakGate || {}, LS = (ar.wave || {}).lastStand || {}, p = gatePiece(fight);
    ar.retryPhase = false; ar.state = "live"; ar.t = 0; ar.attempt++;
    fight.level.rally = rallyOf(fight, ar); setArena(fight, D, ar);
    if (ar.phase === "breakGate") { const op = D.outposts[3]; if (op) { op.live = true; for (const h of op.huts) h.t = op.every; } emit(fight, { type: "breakGate", name: BG.name || "BREAK THE GATE", hp: p ? p.hp : null, x: p ? p.x : 2892, y: p ? p.y : 244, attempt: ar.attempt }); }
    else emit(fight, { type: "lastOfThem", name: LS.name || "THE LAST OF THEM", attempt: ar.attempt });
    D.squadT = 0;
  }
  function unspawn(fight, D, f) {
    const C = CB(), P = PH(), W = fight.world;
    f.dead = true; f.gone = "wipe"; f.hp = 0;
    const i = fight.foes.indexOf(f); if (i >= 0) fight.foes.splice(i, 1);
    fight.tdirty = true;
    if (f.climbing) { f.climbing.ladder.by = null; f.climbing = null; }
    if (f.rockLying) { P.removeSolid(W, f.rockLying); f.rockLying = null; }
    if (f.rock) { P.removeSolid(W, f.rock); f.rock = null; }
    if (f.hut) { f.hut.queue.unshift({ kind: f.kind, g: f.group }); f.hut.sent--; }
    for (const e of D.engines) if (e.winch === f) { e.winch = null; e.reserveAt = null; }
    emit(fight, { type: "unspawn", foe: f.id, kind: f.kind, x: f.x, y: f.y });
  }
  // a stuck troll's way back in (combat.js's stuck rule): its own door's spot inside its arena, else the nearest door of the arena
  function respawn(fight, D, f) {
    const C = CB(), P = PH(), W = fight.world, A = fight.area, ar = D.arenas.find(a => a.id === f.arenaId) || D.arenas[D.ai];
    const g = f.group, doors = g && g.type === "door" ? doorsOf(fight, g) : [], F = fight.floor, r = f.r || 7;
    let best = null, bd = Infinity;
    const cands = doors.length ? doors : Object.entries(A.doors || {}).flatMap(([name, pts]) => pts.map(p => ({ name, p }))).filter(d => ar && d.p[0] >= ar.spec.x0 - 8 && d.p[0] <= ar.spec.x1 + 8);
    for (const d of cands) { const dd = dist(d.p[0], d.p[1], f.x, f.y); if (dd < bd) { bd = dd; best = d; } }
    if (!best) return;
    let x = best.p[0], y = clamp(best.p[1], F.y0 + r, F.y1 - r);
    if (/^stake/.test(best.name)) { const pal = (A.palisades || []).find(s => x >= s.x0 - 1 && x <= s.x1 + 16 + r + 2); if (pal) x = pal.x0 - r - 2; }
    if (ar) x = clamp(x, Math.max(F.x0, ar.spec.x0) + r + 2, Math.min(F.x1, ar.spec.x1) - r - 2);
    C.place(fight, f, x, y, best.name === "gate" ? (W.plats.find(Q => Q.when === "bridgeDown") || {}).id : undefined);
    W.list = C.bodies(fight); if (P.caught(W, f)) P.freePoint(W, f);
    f.spawn = common().spawnTell || 0.6; f.act = null; f.intent = null; if (f.brain) f.brain.stuck.best = Infinity; fight.tdirty = true;
    emit(fight, { type: "spawn", foe: f.id, kind: f.kind, x: f.x, y: f.y, z: f.z, tell: f.spawn, again: true, from: best.name });
  }

  // ------------------------------------------------------------------ the castle front (section 3.4): the horn, the bridge, the phases
  // the horn: the camera's frame begins (camY 100..146, camX 2604 or more), the wave starts after the delay, then the chains rattle as the
  // portcullis grinds up (1.5 s; 0.5 on a retry) and the bridge falls (0.5 s); nothing attacks until it lands
  function horn(fight, D, ar, delay) {
    ar.state = "delay"; ar.delay = delay; ar.phase = "gatekeepers"; D.frame = true; D.horn = { at: D.t, retry: ar.attempt > 0 }; limits(fight, D);
    fight.level.rally = rallyOf(fight, ar); setArena(fight, D, ar); setGoal(fight, D, null);
    emit(fight, { type: "horn", x: fight.area.gate ? fight.area.gate.aim.at[0] : 2892, y: fight.area.gate ? fight.area.gate.aim.at[1] : 244 });
  }
  function castleStep(fight, D, dt) {
    const ar = D.arenas[D.ai], B = fight.bridge, G = fight.gate, A = fight.area, L = (A.bridge || {}).lower || { rattle: 1.5, retryRattle: 0.5, fall: 0.5, shake: 3 };
    if (D.hornRetryAt !== undefined && D.hornRetryAt !== null && D.t >= D.hornRetryAt - 1e-9 && ar && ar.id === 5 && ar.state === "ahead") { D.hornRetryAt = null; horn(fight, D, ar, (ar.wave.start || {}).delay || 3); }
    if (!ar || ar.id !== 5 || !ar.started || B.down) return;
    // after the wave starts: the rattle (the portcullis lifting), then the fall, then the landing
    if (ar.state !== "live") return;
    const rattle = D.horn && D.horn.retry ? (L.retryRattle || 0.5) : (L.rattle || 1.5);
    if (B.rattleAt === null) { B.rattleAt = fight.t; G.down = false; emit(fight, { type: "rattle", time: rattle }); }
    const since = fight.t - B.rattleAt;
    G.lift = clamp(since / rattle, 0, 1);
    if (since < rattle - 1e-9) return;
    if (B.fallAt === null) { B.fallAt = fight.t; emit(fight, { type: "bridgeFall", time: L.fall || 0.5 }); }
    B.fall = clamp((fight.t - B.fallAt) / (L.fall || 0.5), 0, 1);
    if (B.fall < 1 - 1e-9) return;
    landBridge(fight, D);
  }
  // the landing: the deck comes into the world (its surface, edges and fields), a body on the bank stretch is pushed toward the field until
  // it is clear of the deck, at most 24 px, with no damage; the frame ends; the arch's trolls come (the groups' delays count from here)
  function landBridge(fight, D) {
    const C = CB(), P = PH(), W = fight.world, A = fight.area, B = fight.bridge, L = (A.bridge || {}).lower || { shake: 3 };
    const deck = W.plats.find(Q => Q.when === "bridgeDown");
    if (deck) {
      P.setPlatform(W, deck.id, true);
      const LP = ((A.surfaces || []).find(s => s.id === deck.id) || {}).landPush || { max: 24 };
      W.list = C.bodies(fight);
      for (const b of W.list) {
        if (b.on || !P.inShape(deck, b.x, b.y)) continue;
        const u = b.x - b.y, over = (u + b.r * Math.SQRT2) - deck.u0; if (over <= 0) continue;   // toward the field: -u, along (-1, +1) / sqrt 2
        const s = Math.min(LP.max || 24, over / Math.SQRT2);
        b.x -= s / Math.SQRT2; b.y += s / Math.SQRT2;
        if (P.caught(W, b)) P.freePoint(W, b);
        emit(fight, { type: "bankPush", seat: b.knight ? b.seat : undefined, foe: b.foe ? b.id : undefined, px: s, x: b.x, y: b.y });
      }
      for (const b of W.list) if (!b.on && P.inShape(deck, b.x, b.y)) { b.on = deck.id; b.z = 0; }
    }
    B.down = true; B.fall = 1; B.landed = fight.t; D.frame = false;
    emit(fight, { type: "bridgeDown", x: fight.chest.x, y: fight.chest.y });
    emit(fight, { type: "shake", amp: L.shake || 3, time: ((root.FORGE_COMBAT || {}).feel || {}).shakeT || 0.12 });
    C.fieldsReady(fight, true);
    const ar = D.arenas[D.ai]; if (ar) ar.t = 0;
    for (const e of D.engines) if (e.spec.arena === 5) e.active = true;
  }
  function raiseBridge(fight, D) {
    const P = PH(), W = fight.world, B = fight.bridge, G = fight.gate, deck = W.plats.find(Q => Q.when === "bridgeDown");
    if (deck && deck.active) { for (const b of W.list) if (b.on === deck.id) { b.on = null; } P.setPlatform(W, deck.id, false); }
    B.down = false; B.fallAt = null; B.fall = 0; B.rattleAt = null; B.landed = null;
    G.down = true; G.lift = 0; D.frame = false;
    for (const e of D.engines) if (e.spec.arena === 5) e.active = false;
    CB().fieldsReady(fight, true);
    emit(fight, { type: "bridgeUp" });
  }
  // arena 5's phases: the gatekeepers until both brutes are dead; Break the gate until the gate's HP is 0; the last of them until every
  // troll is dead (then the arena clears: the gate is ours)
  function castlePhases(fight, D, ar) {
    const A = fight.area, W5 = ar.wave || {};
    if (ar.phase === "gatekeepers") {
      const brutes = ar.entries.filter(e => (A.scaling || {}).brutes ? A.scaling.brutes.includes(e.kind) : (e.kind === "brute" || e.kind === "rockbrute"));
      if (brutes.length && brutes.every(e => e.sent && e.troll && e.troll.dead)) breakGate(fight, D, ar);
      return;
    }
    if (ar.phase === "breakGate") {
      const G = fight.gate, p = gatePiece(fight), DR = (A.gate || {}).drop || { time: 0.3 };
      if (G.dropAt !== null) G.lift = clamp(1 - (fight.t - G.dropAt) / (DR.time || 0.3), 0, 1);
      if (p && p.broken) burst(fight, D, ar);
    }
  }
  const gatePiece = fight => { const L = fight.level; if (L && L._gate !== undefined) return L._gate; const p = fight.pieces.find(p => p.kind === "gate") || null; if (L) L._gate = p; return p; };
  function breakGate(fight, D, ar) {
    const A = fight.area, G = fight.gate, p = gatePiece(fight), BG = (ar.wave || {}).breakGate || {}, DR = (A.gate || {}).drop || { time: 0.3, shake: 2 };
    ar.phase = "breakGate"; ar.breakGate = { at: fight.t };
    G.down = true; G.dropAt = fight.t; G.lift = 1; G.glint = true;
    if (p) { p.active = true; p.hp = p.hpMax = Math.round(D.scale.gateHp); p.broken = false; p.gone = false; fight.tdirty = true; G.hp = p.hp; G.hpMax = p.hpMax; D.seen.gateHp = p.hp; }
    fight.level.calls.length = 0;
    emit(fight, { type: "breakGate", name: BG.name || "BREAK THE GATE", hp: p ? p.hp : null, x: p ? p.x : 2892, y: p ? p.y : 244 });
    emit(fight, { type: "shake", amp: DR.shake || 2, time: ((root.FORGE_COMBAT || {}).feel || {}).shakeT || 0.12 });
    buildGroups(fight, D, ar, BG.groups || [], true);
    const op = D.outposts[3]; if (op) { op.live = true; for (const h of op.huts) h.t = op.every; }
    if (p && p.hp <= 0) burst(fight, D, ar);   // kept from a retry: the damage stands
  }
  // the gate's damage stages (75, 50, 25 %) and a 1 px shake a hit; the burst when its HP reaches 0
  function gateWatch(fight, D) {
    const p = gatePiece(fight), G = fight.gate, A = fight.area; if (!p || !p.active) return;
    const stages = (A.gate || {}).stages || [0.75, 0.5, 0.25];
    G.hp = Math.max(0, p.hp); G.hpMax = p.hpMax;
    if (D.seen.gateHp !== null && p.hp < D.seen.gateHp - 1e-9) {
      emit(fight, { type: "shake", amp: 1, time: ((root.FORGE_COMBAT || {}).feel || {}).shakeT || 0.12 });
      let st = 0; for (let i = 0; i < stages.length; i++) if (p.hp <= p.hpMax * stages[i] + 1e-9) st = i + 1;
      while (G.stage < st) { G.stage++; emit(fight, { type: "gateStage", stage: G.stage, frac: stages[G.stage - 1], hp: p.hp, x: p.x, y: p.y }); }
    }
    D.seen.gateHp = p.hp;
  }
  // the burst (section 3.4): every troll on the deck or in the arch is crushed, the wall archers fall into the moat and drown, every other
  // troll of the arena is stunned 1.5 s at 1 HP with its regrowth gone, the Gallows Post sends no more, the Gallows trebuchet stops, the
  // eyes go out, and the iron chest stands on the deck
  function burst(fight, D, ar) {
    const C = CB(), P = PH(), W = fight.world, A = fight.area, G = fight.gate, BU = ((A.gate || {}).burst) || {}, R = BU.rest || { stun: 1.5, hp: 1 };
    if (G.burst !== null) return;
    ar.phase = "lastStand"; ar.breakGate = null;
    G.burst = fight.t; G.burstDone = false; G.eyes = false; G.lift = 1; G.hp = 0;   // fight.level.gateOpen waits for the clear: the exit takes the party only once the gate is ours
    emit(fight, { type: "burst", x: A.gate ? A.gate.aim.at[0] : 2892, y: A.gate ? A.gate.aim.at[1] : 244 });
    emit(fight, { type: "shake", amp: BU.shake || 3, time: ((root.FORGE_COMBAT || {}).feel || {}).shakeT || 0.12 });
    const deck = W.plats.find(Q => Q.when === "bridgeDown"), moat = W.holes.find(H => H.kind === "moat"), foot = ((A.castle || {}).foot || {}).u || 2648;
    for (const f of fight.foes.slice()) {
      if (f.dead || f.arenaId !== 5) continue;
      if (f.fixed) {   // a wall archer: into the moat
        if (moat) { const v = f.x + f.y, u = (moat.u0 + moat.u1) / 2; f.x = (u + v) / 2; f.y = (v - u) / 2; } f.z = 0; f.fixed = false;
        C.drownPuddle(fight, f); C.die(fight, f, "DROWNED"); continue;
      }
      if ((deck && (f.on === deck.id || P.inShape(deck, f.x, f.y))) || f.x - f.y >= foot - 16) { C.die(fight, f, "CRUSHED"); continue; }
      f.hp = Math.min(f.hp, R.hp === undefined ? 1 : R.hp); f.noRegrow = R.regrow === false || R.regrow === undefined; f.st.stun = { t: R.stun || 1.5 };
      if (f.act) { f.act = null; }
      emit(fight, { type: "status", d: f.i, status: "stun", stacks: null, foe: f.id });
      emit(fight, { type: "cracked", foe: f.id, kind: f.kind, x: f.x, y: f.y, hp: f.hp });
    }
    for (const op of (D.outpostList || Object.values(D.outposts))) if (op.arena === 5) { op.live = false; for (const h of op.huts) h.queue.length = 0; }
    if (ar.trickle) ar.trickle.i = ar.trickle.seq.length;
    for (const e of D.engines) if (e.spec.stopOn === "burst" || e.spec.arena === 5) { e.active = false; e.stopped = true; e.reserveAt = null; e.crew = 0; }
    fight.level.calls.length = 0;
    emit(fight, { type: "lastOfThem", name: ((ar.wave || {}).lastStand || {}).name || "THE LAST OF THEM" });
    showChest(fight, D);
  }
  // the chest on the deck at u 2624, v 3136, or the nearest point of the deck 6 px clear of every body (rings of 2 px); solid r 6, ht 10
  function showChest(fight, D) {
    const C = CB(), P = PH(), W = fight.world, A = fight.area, CH = A.chest || {}, ch = fight.chest, deck = W.plats.find(Q => Q.when === "bridgeDown");
    const clear = CH.bodyClear || 6, at0 = CH.at ? XY(CH.at.u, CH.at.v) : [ch.x, ch.y];
    W.list = C.bodies(fight);
    // a spot keeps to the deck's middle (within 8 u-units of its centre line), so a knight's lane of 12 px stays open on both sides of the
    // chest: a spot nearer a side closes that lane, and with the gate's foot a step east a body between them is wedged for good
    const vc = deck ? (deck.v0 + deck.v1) / 2 : null;
    const free = (x, y) => { if (deck && !P.inShape(deck, x - 6, y) || deck && !P.inShape(deck, x + 6, y)) return false; if (vc !== null && Math.abs(x + y - vc) > 8) return false; for (const b of W.list) if (dist(b.x, b.y, x, y) < b.r + ch.r + clear - 1e-9) return false; return true; };
    let spot = free(at0[0], at0[1]) ? at0 : null;
    for (let R = 2; !spot && R <= 96; R += 2) for (let i = 0; i < 16 && !spot; i++) { const a = i * TAU / 16, x = at0[0] + Math.cos(a) * R, y = at0[1] + Math.sin(a) * R; if (free(x, y)) spot = [x, y]; }   // along the deck's middle, as far as its length
    if (!spot) spot = at0;
    ch.x = spot[0]; ch.y = spot[1]; ch.shown = true; ch.open = false; ch.openAt = null;
    ch.solid = P.addSolid(W, { kind: "chest", shape: "c", x: ch.x, y: ch.y, r: ch.r, ht: ((A.propKinds || {}).chest || {}).ht || 10 }).id;
    // a deck too crowded for any clear spot (a party of four on its middle): the chest stands at its spot and the bodies on it step aside
    W.list = C.bodies(fight); for (const b of W.list) if (!b.on || b.on === (deck && deck.id)) { if (P.caught(W, b)) P.freePoint(W, b); }
    emit(fight, { type: "chest", x: ch.x, y: ch.y });
  }
  // the chest opens (E, a tap, or leaving): the lid lifts over 0.6 s and one pouch per human knight springs out and flies to its knight
  // (one sure roll on the iron table each); nothing for the brothers; straight into the satchels when the party leaves
  function openChest(fight, D, seat, atOnce) {
    const ch = fight.chest, CH = fight.area.chest || {}; if (!ch.shown || ch.open) return;
    ch.open = true; ch.openAt = fight.t;
    emit(fight, { type: "chestOpen", seat, x: ch.x, y: ch.y, open: CH.open || 0.6 });
    const made = rollDrops(fight, D, "chest", "iron", 1, 1, ch.x, ch.y, "chest", { z: 0, on: null });
    for (const q of made) { if (atOnce) take(fight, D, q); else fly(fight, D, q); }
  }

  // ------------------------------------------------------------------ the trebuchets (section 3.5)
  function newEngine(fight, D, e) {
    const A = fight.area, K = (A.engineKinds || {})[e.kind] || {}, f = e.frame, piece = fight.pieces.find(p => p.kind === "engine" && p.engine === e.id) || null;
    const E = { id: e.id, kind: e.kind, name: e.name || e.id, arena: e.arena, spec: e, K, x: (f.x0 + f.x1) / 2, y: (f.y0 + f.y1) / 2, frame: f, piece,
      post: { x: e.post[0], y: e.post[1], engine: e.id, faceX: (f.x0 + f.x1) / 2, faceY: (f.y0 + f.y1) / 2 },
      phase: "crank", t: 0, T: (K.cycle || {}).crank || 5.5, manned: false, wrecked: false, stone: null, winch: null, crew: K.crew || 3, sent: 0, reserveAt: null, active: false, stopped: false, loaded: false, target: null };
    if (e.manned === "levelStart") manEngine(fight, D, E, true);
    return E;
  }
  // its winchman at the post (manned at once at the level's or the wave's start; a reserve walks to it and mans it in 1.5 s)
  function manEngine(fight, D, E, atOnce, at) {
    const C = CB(); if (E.wrecked || E.crew <= 0) return null;
    const x = at ? at.x : E.post.x, y = at ? at.y : E.post.y;
    const f = C.spawn(fight, E.K.operator || "winchman", x, y, { tell: atOnce ? 0 : (common().spawnTell || 0.6), post: E.post, manned: !!atOnce, brain: true, from: at ? at.name : "post" });
    if (!f) return null;
    E.winch = f; E.crew--; E.sent++; E.reserveAt = null;
    f.arenaId = E.arena; f.box = (D.arenas.find(a => a.id === E.arena) ? arenaBox(fight, D.arenas.find(a => a.id === E.arena)) : null); f.engine = E.id;
    f.drop = { source: "winchman", solo: 1, scaled: 1 };
    const ar = D.arenas.find(a => a.id === E.arena); if (ar) ar.trolls.push(f);
    return f;
  }
  function enginesStep(fight, D, dt) {
    const C = CB(), A = fight.area;
    for (const E of D.engines) {
      if (E.piece && E.piece.broken && !E.wrecked) wreck(fight, D, E);
      E.post.quiet = !E.active || E.stopped;   // the winchman stands at a quiet engine's handle (before the horn), heaves at a working one
      E.manned = !E.wrecked && !!E.winch && !E.winch.dead && C.manned(fight, E.winch);
      if (E.stone && !(fight.marks && fight.marks.stone.includes(E.stone))) E.stone = null;
      reserves(fight, D, E, dt);
      if (E.wrecked || E.stopped || !E.active || !E.manned || fight.wipe) continue;
      cycle(fight, D, E, dt);
    }
  }
  // the cycle while manned: crank 5.5 s (the loose shown for its first 0.25 s), load 1.5 s, then loaded until a knight is in range and in
  // the view, aim 1.0 s with the target picked at its end, loose: a stone 2.0 s in the air; the next crank starts at the loose
  function cycle(fight, D, E, dt) {
    const K = E.K, CY = K.cycle || { crank: 5.5, load: 1.5, aim: 1.0 }, crank = (CY.crank || 5.5) * dX(fight, "siegeEvery");
    E.t += dt;
    if (E.phase === "loose") { if (E.t >= 0.25 - 1e-9) { E.phase = "crank"; } return; }
    if (E.phase === "crank") { E.T = crank; if (E.t >= crank - 1e-9) { E.phase = "load"; E.t = 0; E.T = CY.load || 1.5; E.loaded = false; } return; }
    if (E.phase === "load") {
      if (E.t >= E.T - 1e-9) { E.t = E.T; E.loaded = true; if (candidates(fight, D, E).length) { E.phase = "aim"; E.t = 0; E.T = CY.aim || 1.0; } }
      return;
    }
    if (E.phase === "aim") {
      if (E.t < E.T - 1e-9) return;
      const k = pickTarget(fight, D, E);
      if (!k) { E.phase = "load"; E.t = E.T = (CY.load || 1.5); E.loaded = true; return; }   // nobody to throw at any more: it waits loaded
      loose(fight, D, E, k);
      E.phase = "loose"; E.t = 0; E.T = crank; E.loaded = false;
    }
  }
  // the knights a trebuchet may throw at: standing (brothers included), in the view, 120 to 400 px from the engine, never frozen,
  // staggered or downed
  function candidates(fight, D, E) {
    const C = CB(), R = E.K.range || [120, 400], out = [];
    for (const k of fight.knights) {
      if (!standing(k) || k.frozen > 0 || k.stagger > 0 || !C.inView(fight, k)) continue;
      const d = dist(k.x, k.y, E.x, E.y); if (d < R[0] - 1e-9 || d > R[1] + 1e-9) continue;
      out.push(k);
    }
    return out;
  }
  // the one that has moved least in the last 2.0 s, ties to the lowest seat
  function pickTarget(fight, D, E) {
    const list = candidates(fight, D, E); if (!list.length) return null;
    list.sort((a, b) => (D.track[a.seat].sum - D.track[b.seat].sum) || (a.seat - b.seat));
    return list[0];
  }
  // the point: the knight's feet plus its velocity x 0.5 s (at most 24 px), on the surface it stands on (inside a platform or the deck),
  // on the ground out of solids, inside the view's floor box and 16 px from the moat's edge; then the stone (Combat.throwStone)
  function loose(fight, D, E, k) {
    const C = CB(), P = PH(), W = fight.world, A = fight.area, K = E.K, ST = K.stone || {}, LD = K.lead || { t: 0.5, max: 24 }, T = D.track[k.seat];
    let lx = T.vx * (LD.t || 0.5), ly = T.vy * (LD.t || 0.5); const ll = Math.hypot(lx, ly); if (ll > (LD.max || 24)) { lx *= (LD.max || 24) / ll; ly *= (LD.max || 24) / ll; }
    let x = k.x + lx, y = k.y + ly, z = k.z || 0, on = k.on || null;
    if (on) {
      const Q = W.platBy[on];
      if (Q && Q.shape === "r") { x = clamp(x, Q.x0 + 1, Q.x1 - 1); y = clamp(y, Q.y0 + 1, Q.y1 - 1); z = P.platZ(Q, x, y); }
      else if (Q && Q.shape === "uv") { let u = clamp(x - y, Q.u0 + 1, Q.u1 - 1), v = clamp(x + y, Q.v0 + 1, Q.v1 - 1); x = (u + v) / 2; y = (v - u) / 2; z = Q.z || 0; }
    } else {
      const VK = A.viewKnight || { x0: 14, x1: 369, y0: 70, y1: 204 }, v = fight.view, F = fight.floor;
      x = clamp(x, Math.max(F.x0, v.x0 + VK.x0), Math.min(F.x1, v.x0 + VK.x1)); y = clamp(y, Math.max(F.y0, v.y0 + VK.y0), Math.min(F.y1, v.y0 + VK.y1));
      const CM = K.clearOfMoat || { px: 16 }, moat = W.holes.find(H => H.kind === "moat");
      if (moat && x - y > moat.u0 - (CM.px || 16) * Math.SQRT2) { const u = moat.u0 - (CM.px || 16) * Math.SQRT2, vv = x + y; x = (u + vv) / 2; y = (vv - u) / 2; }   // 16 px from the edge: the moat's u runs diagonally, so 16 x sqrt 2 u-units
      const probe = { x, y, z: 0, r: 6, h: 24, knight: true, on: null, air: false };
      if (P.caught(W, probe) || P.groundAt(W, x, y).deep) { W.list = C.bodies(fight); if (P.freePoint(W, probe)) { x = probe.x; y = probe.y; } }
      z = P.groundAt(W, x, y).z;
    }
    const m = C.throwStone(fight, [E.x, E.y], { x, y, z, on }, { engine: E.id, spec: ST, seat: k.seat });
    if (m) { E.stone = m; E.target = k.seat; emit(fight, { type: "loose", engine: E.id, seat: k.seat, x, y, z, on }); }
  }
  // a winchman dies: the engine stands idle; a reserve comes 6.0 s later (crew 3) while the wave has other trolls alive or to come, from the
  // engine's reserve door (treb4: palisade 4's lower gates; the Gallows one: a standing Gallows hut, without waking the Post; none with
  // every hut wrecked); it walks to the post and mans it in 1.5 s
  function reserves(fight, D, E, dt) {
    const A = fight.area, C = CB();
    if (E.wrecked || E.stopped) return;
    if (E.winch && E.winch.dead && E.reserveAt === null && E.crew > 0) { E.reserveAt = fight.t + (E.K.replaceAfter || 6.0); emit(fight, { type: "engineIdle", engine: E.id }); }
    if (E.reserveAt === null || fight.t < E.reserveAt - 1e-9 || E.crew <= 0) return;
    const ar = D.arenas.find(a => a.id === E.arena);
    if (!ar || !E.active) return;
    if (aliveIn(fight, D, ar) >= D.scale.cap * dX(fight, "aliveCap")) return;   // it waits for room
    const from = E.spec.reservesFrom || "";
    let at = null;
    if (/^outpost/.test(from)) {
      const op = D.outposts[from.replace(/outpost(\d+).*/, "$1") | 0], huts = op ? op.huts.filter(h => h.piece && !h.piece.broken) : [];
      if (!huts.length) { E.reserveAt = null; E.crew = 0; return; }
      const h = huts.slice().sort((a, b) => dist(a.x, a.y, E.post.x, E.post.y) - dist(b.x, b.y, E.post.x, E.post.y))[0], K = C.trollKind(E.K.operator || "winchman"), r = (K.body || {}).r || 7;
      at = { x: h.x, y: h.y + h.r + r + 1, name: "hut" };
    } else {
      const pts = (A.doors || {})[from] || [], DW = common().doorWait || { near: 48, max: 1.5 };
      if (!pts.length) { E.reserveAt = null; return; }
      let d = pts.find(p => !blocked(fight, p, DW)) || null;
      if (!d) { E.waitT = (E.waitT || 0) + dt; if (E.waitT < (DW.max || 1.5) - 1e-9) return; d = pts[0]; }
      E.waitT = 0;
      const K = C.trollKind(E.K.operator || "winchman"), r = (K.body || {}).r || 7, pal = (A.palisades || []).find(s => d[0] >= s.x0 - 1 && d[0] <= s.x1 + 16 + r + 2);
      at = { x: pal ? pal.x0 - r - 2 : d[0], y: clamp(d[1], fight.floor.y0, fight.floor.y1), name: from };
    }
    const f = manEngine(fight, D, E, false, at);
    if (f) { const W = fight.world; W.list = C.bodies(fight); if (PH().caught(W, f)) PH().freePoint(W, f); emit(fight, { type: "reserve", engine: E.id, foe: f.id, x: f.x, y: f.y }); }
  }
  // the wreck: the cycle ends for the run (a stone in flight lands), the winchman at the post is stunned 1.0 s and fights on foot; fire
  // burns it through the piece's own rule (combat.js breakPiece)
  function wreck(fight, D, E) {
    const WR = E.K.wreck || { operatorStun: 1.0 };
    E.wrecked = true; E.phase = "wrecked"; E.active = false; E.reserveAt = null; E.crew = 0; E.loaded = false;
    if (E.winch && !E.winch.dead) { const f = E.winch; if (f.manning || dist(f.x, f.y, E.post.x, E.post.y) <= 12) { f.st.stun = { t: WR.operatorStun || 1.0 }; f.manning = false; f.act = null; emit(fight, { type: "status", d: f.i, status: "stun", stacks: null, foe: f.id }); } f.post = null; f.manning = false; }
    emit(fight, { type: "engineWrecked", engine: E.id, x: E.x, y: E.y });
  }
  // the Gallows Post wakes (section 3.3): quiet until Break the gate, but a human knight within 60 px of a standing hut, or a hit on one,
  // wakes it: two footmen of its share at once, one from each of the two nearest standing huts; a brother never wakes it
  function postWatch(fight, D) {
    for (const op of (D.outpostList || Object.values(D.outposts))) {
      const WK = op.spec.wake; if (!WK || op.awake || op.live) continue;
      let by = null;
      for (const h of op.huts) {
        if (!h.piece || h.piece.broken) continue;
        if (WK.onHit !== false && h.piece.hp < h.piece.hpMax - 1e-9) { by = [h.x, h.y]; break; }
        for (const k of fight.knights) if (full(k) && !k.out && dist(k.x, k.y, h.x, h.y) <= (WK.within || 60) + 1e-9) { by = [k.x, k.y]; break; }   // 60 px of the hut's centre; a brother never wakes it
        if (by) break;
      }
      if (!by) continue;
      op.awake = true; fight.level.postAwake = true;
      emit(fight, { type: "postAwake", outpost: op.id, x: by[0], y: by[1] });
      const ar = D.arenas.find(a => a.id === op.arena) || D.arenas[D.ai];
      const huts = op.huts.filter(h => h.piece && !h.piece.broken && h.queue.length).sort((a, b) => dist(a.x, a.y, by[0], by[1]) - dist(b.x, b.y, by[0], by[1]));
      let sent = 0;
      for (let i = 0; i < huts.length && sent < (WK.send || 2); i++) { const h = huts[i % huts.length], q = h.queue.find(e => e.kind === "footman") || h.queue[0]; if (!q) continue; if (spawnHut(fight, D, ar, op, h, q)) { h.queue.splice(h.queue.indexOf(q), 1); sent++; if (huts.length === 1) i--; if (sent >= (WK.send || 2)) break; } }
    }
  }

  // ------------------------------------------------------------------ drops and pouches (section 3.11)
  // at a troll's death (and a hut's wreck, and the chest) the table is rolled once for each knight in the party but the brothers, on that
  // seat's own stream, at the solo chance x fair share's factor (a source that grows with the party divided by its group's count ratio and
  // x 1.15 with two or more humans; brutes, huts, the tower archer, winchmen, roar footmen, the Emberback and the chest undivided); a drop
  // is a pouch within 10 px of the body (a drowned troll's floats to the bank's edge, a spiked one's lies at the pit's lip)
  function deaths(fight, D) {
    for (const ar of D.arenas) {
      // the arena's trolls not yet dropped (new ones in ar.trolls taken up as they come), in spawn order, so a step's deaths roll in that order
      const U = ar.undropped || (ar.undropped = []); let seen = ar.seenN || 0; while (seen < ar.trolls.length) U.push(ar.trolls[seen++]); ar.seenN = seen;
      if (!U.length) continue;
      let w = 0;
      for (let i = 0; i < U.length; i++) {
        const f = U[i];
        if (!f.dead) { U[w++] = f; continue; }
        if (f.dropped || f.gone === "wipe") continue;
        f.dropped = true;
        if (!f.drop) continue;
        const at = restingPlace(fight, f);
        rollDrops(fight, D, f.drop.source, f.kind, f.drop.solo, f.drop.scaled, at[0], at[1], "troll", { z: f.why === "DROWNED" || f.why === "SPIKED" ? 0 : (f.z || 0), on: f.why === "DROWNED" || f.why === "SPIKED" ? null : (f.on || null) });
      }
      U.length = w;
    }
    for (const op of (D.outpostList || Object.values(D.outposts))) for (const h of op.huts) if (h.piece && h.piece.broken && !h.dropped) { h.dropped = true; h.queue.length = 0; rollDrops(fight, D, "hut", "hut", 1, 1, h.x, h.y + h.r + 4, "hut", { z: 0, on: null }); }
  }
  function restingPlace(fight, f) {
    const W = fight.world, M = ((root.FORGE_COMBAT || {}).marks || {}).puddle || {}, PS = M.drown || { r: 8 };
    if (f.why === "DROWNED") { const moat = W.holes.find(H => H.kind === "moat"); if (moat) { const u = f.x - f.y, v = f.x + f.y, lip = moat.u0 - (PS.r || 8) * Math.SQRT2; return [(lip + v) / 2, (v - lip) / 2]; } }   // the pouch floats to the bank (section 3.11), whichever half it drowned in: the far lip is the castle's foot
    if (f.why === "SPIKED") { const pit = W.holes.find(H => H.deep && H.shape === "r" && f.x >= H.x0 - 2 && f.x <= H.x1 + 2 && f.y >= H.y0 - 2 && f.y <= H.y1 + 2); if (pit) { const dl = f.x - pit.x0, dr = pit.x1 - f.x, dt_ = f.y - pit.y0, db = pit.y1 - f.y, m = Math.min(dl, dr, dt_, db); return m === dl ? [pit.x0 - 6, f.y] : m === dr ? [pit.x1 + 6, f.y] : m === dt_ ? [f.x, pit.y0 - 6] : [f.x, pit.y1 + 6]; } }
    return [f.x, f.y];
  }
  function rollDrops(fight, D, source, kind, solo, scaled, x, y, from, o) {
    const Co = COIN(), DR = DROPS(), made = []; if (!Co || !DR || !fight.rng.drops) return made;
    const entry = Co.dropEntry(kind, DR); if (!entry) return made;
    const factor = Co.dropFactor(source, D.p, solo, scaled, DR) * dX(fight, "drops");
    let n = 0;
    for (const k of fight.knights) {
      if (!full(k)) continue;
      for (const item of Co.rollDrop(entry, fight.rng.drops[k.seat], factor)) made.push(pouch(fight, D, k.seat, item, from, x, y, o, n++));
    }
    return made;
  }
  function pouch(fight, D, seat, item, from, x, y, o, n) {
    const P = PH(), W = fight.world, F = fight.floor, a = seat * 2.4 + n * 1.7, r = from === "chest" ? 0 : 6;
    let px = clamp(x + Math.cos(a) * r, F.x0, F.x1), py = clamp(y + Math.sin(a) * r, F.y0, F.y1);
    if (!o.on && P.groundAt(W, px, py).deep) { px = x; py = y; }
    const q = { id: D.pouchId++, seat, item, from, x: px, y: py, z: o.z || 0, on: o.on || null, t: 0, fly: null };
    D.pouches.push(q);
    emit(fight, { type: "pouch", id: q.id, seat, item, from, x: q.x, y: q.y, z: q.z });
    const cap = ((root.FORGE_COMBAT || {}).caps || {}).pouches || 40;
    while (D.pouches.filter(p => !p.fly).length > cap) { const old = D.pouches.find(p => !p.fly); if (!old) break; fly(fight, D, old); }
    return q;
  }
  // every pouch of a knight's still on the ground flies to it over 0.6 s (a Breather, the clear, the chest's)
  function magnet(fight, D) { for (const q of D.pouches) if (!q.fly) fly(fight, D, q); }
  function fly(fight, D, q) { if (q.fly) return; q.fly = { x0: q.x, y0: q.y, t: 0, T: (fight.area.breather || {}).magnet || (fight.area.chest || {}).fly || 0.6 }; emit(fight, { type: "pouchFly", id: q.id, seat: q.seat }); }
  function take(fight, D, q) {
    const i = D.pouches.indexOf(q); if (i < 0) return;
    D.pouches.splice(i, 1);
    const k = fight.knights[q.seat]; if (k) k.satchel.push(q.item);
    emit(fight, { type: "pickup", seat: q.seat, id: q.item, from: q.from, x: q.x, y: q.y, pouch: q.id });
  }
  function pouchesStep(fight, D, dt) {
    for (const q of D.pouches.slice()) {
      const k = fight.knights[q.seat]; if (!k) { D.pouches.splice(D.pouches.indexOf(q), 1); continue; }
      q.t += dt;
      if (q.fly) { q.fly.t += dt; const u = Math.min(1, q.fly.t / q.fly.T); q.x = q.fly.x0 + (k.x - q.fly.x0) * u; q.y = q.fly.y0 + (k.y - q.fly.y0) * u; q.z = (k.z || 0) * u + q.z * (1 - u); if (u >= 1 - 1e-9) take(fight, D, q); continue; }
      if (standing(k) && !k.air && dist(k.x, k.y, q.x, q.y) <= 12 + 1e-9 && Math.abs((k.z || 0) - (q.z || 0)) <= 12) take(fight, D, q);
    }
  }

  // ------------------------------------------------------------------ marks at the view's edge (section 3.14)
  // Who gets one: every live troll of the current arena past its spawn tell, and every manned trebuchet, whose screen feet are outside the
  // view and within 200 px of its edge; every trebuchet stone in flight whose ring's whole hit circle is outside the view. The mark sits on
  // the line from the view's centre (192, 116) to the body, 4 px in from the edge: 5 px within 64 px of the edge, 3 beyond, 7 for a brute,
  // 5 with a dot for a trebuchet; red (alarm) for a trebuchet whose stone flies and for a stone's ring off the screen. Never above view y
  // 28, never in a thumbs' corner, on the bottom edge only in the band between the stick and the buttons (22 px up while the toast shows):
  // a mark that would fall elsewhere slides along the edge to the nearest allowed point. At most 8, merged within 6 px. The painter's
  // Gate.edgeMarks draws the same list; the squire reads this one (o: { lefty, toast })
  function edgeMarks(fight, o) {
    o = o || {}; const v = fight.view; if (!v) return [];
    const A = fight.area || {}, M = A.offscreenMarks || {}, W = v.x1 - v.x0, H = v.y1 - v.y0, within = M.within || 200, near = M.near || 64, inset = M.inset || 4;
    const lefty = o.lefty === undefined ? fight.hand === "left" : !!o.lefty;
    const SZ = Object.assign({ near: 5, far: 3, brute: 7, engine: 5 }, M.size || {}), top = M.top || 28, TH = M.thumbs || { x: 67, y: 118 }, band = (M.bottomBand || {})[lefty ? "left" : "right"] || (lefty ? [68, 204] : [180, 316]);
    const cx = W / 2, cy = (A.camera || {}).aimY || 116, out = [];
    const AR = fight.level && fight.level.arena && fight.level.arena.x0 !== undefined ? fight.level.arena : null, inArena = x => !AR || (x >= AR.x0 && x <= AR.x1);
    const add = (sx, sy, size, extra) => { if (sx >= 0 && sx <= W && sy >= 0 && sy <= H) return; const dx = Math.max(0, -sx, sx - W), dy = Math.max(0, -sy, sy - H), d = Math.hypot(dx, dy); if (d > within) return; out.push(Object.assign({ sx, sy, d, size: size === "auto" ? (d <= near ? SZ.near : SZ.far) : size, alarm: false, dot: false }, extra || {})); };
    for (const f of fight.foes || []) if (!f.dead && !(f.spawn > 0) && inArena(f.x)) add(f.x - v.x0, f.y - (f.z || 0) - v.y0, f.kind === "brute" || f.kind === "rockbrute" ? SZ.brute : "auto");
    for (const e of fight.engines || []) if (e.manned && !e.wrecked) add(e.x - v.x0, e.y - v.y0, SZ.engine, { dot: true, alarm: !!e.stone });
    for (const s of ((fight.marks || {}).stone || [])) { const r = s.r || 16, sx = s.x - v.x0, sy = s.y - (s.z || 0) - v.y0; if (sx + r < 0 || sx - r > W || sy + r < 0 || sy - r > H) add(sx, sy, SZ.engine, { alarm: true }); }
    out.sort((a, b) => a.d - b.d);
    const placed = [];
    for (const m of out) {
      if (placed.length >= (M.max || 8)) break;
      const x0 = inset, x1 = W - inset, y0 = inset, y1 = H - (o.toast ? 22 : inset), ddx = m.sx - cx, ddy = m.sy - cy;
      let t = Infinity; if (ddx > 0) t = Math.min(t, (x1 - cx) / ddx); if (ddx < 0) t = Math.min(t, (x0 - cx) / ddx); if (ddy > 0) t = Math.min(t, (y1 - cy) / ddy); if (ddy < 0) t = Math.min(t, (y0 - cy) / ddy);
      let x = clamp(cx + ddx * t, x0, x1), y = clamp(cy + ddy * t, y0, y1);
      const onBottom = y >= y1 - 0.5, onTop = y <= y0 + 0.5;
      if (onTop || y < top) { y = top; x = x < cx ? x0 : x1; }
      if (onBottom && (x < band[0] || x > band[1])) {
        const toBand = x < band[0] ? band[0] - x : x - band[1], side = x < cx ? x0 : x1, upSide = Math.abs(x - side) + (y1 - (TH.y - 1));
        if (toBand <= upSide) x = x < band[0] ? band[0] : band[1]; else { x = side; y = TH.y - 1; }
      }
      if ((x >= W - TH.x || x <= TH.x) && y >= TH.y && !onBottom) y = Math.max(top, TH.y - 1);
      if ((x >= W - TH.x || x <= TH.x) && y >= TH.y) y = TH.y - 1;
      const dup = placed.find(p => Math.hypot(p.x - x, p.y - y) <= (M.merge || 6)); if (dup) continue;
      const ang = Math.atan2(y - cy, x - cx), dir = ((Math.round(ang / (TAU / 8)) % 8) + 8) % 8;
      placed.push({ x: Math.round(x), y: Math.round(y), size: m.size, dir, alarm: m.alarm, dot: m.dot, d: Math.round(m.d) });
    }
    return placed;
  }

  // ------------------------------------------------------------------ for tests and scenes: the party at an arena
  // the earlier arenas cleared (their palisades gone, quietly), the camera at the arena's x, the knights at its rally points; the wave
  // starts as it would (the camera has reached the arena), unless the director was attached with waves: false
  function jump(fight, arenaId) {
    const D = fight.director; if (!D) throw new Error("level.js: attach the director first");
    const C = CB(), P = PH(), W = fight.world, ar = D.arenas.find(a => a.id === arenaId); if (!ar) return null;
    for (const q of D.arenas) if (q.i < ar.i && !q.cleared) { q.state = "cleared"; q.cleared = true; q.started = true; if (q.spec.palisade !== undefined && W.palisades[q.spec.palisade] !== undefined) { const s = W.solids[W.palisades[q.spec.palisade]]; if (s && !s.gone) P.removeSolid(W, s); } }
    D.ai = ar.i; limits(fight, D);
    const rally = rallyOf(fight, ar); fight.level.rally = rally;
    for (const k of fight.knights) { const at = rally[k.seat]; C.place(fight, k, at[0], at[1]); C.clearSeat(fight, k); }
    D.cam.xf = clamp((ar.spec.camX || [ar.spec.x0])[0], D.cam.left, D.cam.right);
    const feet = fight.k.y - (fight.k.z || 0), CA = fight.area.camera || {}, DZ = CA.deadY || [84, 148];
    D.cam.yf = clamp(feet - (DZ[0] + DZ[1]) / 2, 0, (CA.y || [0, 216])[1]);
    yieldCam(fight, D, false, true);   // the knights inside the view's box at once (arena 5's rally lies east of its camX)
    C.setView(fight, Math.round(D.cam.xf), Math.round(D.cam.yf));
    setArena(fight, D, ar);
    freeBox(fight, D);
    return ar;
  }

  // the camera put on the counted knights at once (tests and scenes, after Combat.place): the aim and the yield with no speed, inside the limits
  function snap(fight) {
    const D = fight.director; if (!D) return null;
    const CA = fight.area.camera || {}, VK = fight.area.viewKnight || { x0: 14, x1: 369, y0: 70, y1: 204 }, G = CA.aimXGate || { east: 2560, aimX: 96 }, DZ = CA.deadY || [84, 148];
    const counted = fight.knights.filter(k => full(k) && standing(k)); if (!counted.length) return fight.view;
    let mx = 0, my = 0; for (const k of counted) { mx += k.x; my += k.y - (k.z || 0); } mx /= counted.length; my /= counted.length;
    D.cam.xf = clamp(mx - (mx >= G.east ? G.aimX : (CA.aimX === undefined ? 176 : CA.aimX)), D.cam.left, D.cam.right);
    D.cam.yf = clamp(my - (DZ[0] + DZ[1]) / 2, (CA.y || [0, 216])[0], (CA.y || [0, 216])[1]);
    let lo = -Infinity, hi = Infinity; for (const k of counted) { const feet = k.y - (k.z || 0); lo = Math.max(lo, feet - VK.y1 + YIELD); hi = Math.min(hi, feet - VK.y0 - YIELD); }
    if (lo <= hi) D.cam.yf = clamp(D.cam.yf, lo, hi);
    D.cam.yf = clamp(D.cam.yf, (CA.y || [0, 216])[0], (CA.y || [0, 216])[1]);
    const v = CB().setView(fight, Math.round(D.cam.xf), Math.round(D.cam.yf)); freeBox(fight, D); return v;
  }

  root.Level = { attach, scaling, counts, split, edgeMarks, jump, snap };
  if (typeof module !== "undefined" && module.exports) module.exports = root.Level;
})(typeof window !== "undefined" ? window : globalThis);
