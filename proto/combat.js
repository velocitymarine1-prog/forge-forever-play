// FORGE FOREVER: the combat rules of the Battlegrounds (design pass 7 section 3.8, revised by card t64; built by card t65).
// What a weapon does when it is used: its numbers in units, the aim, the ten forms (slash, thrust, smash, shoot, stream, lob, orbit,
// field, trap, summon), the hit (affinity, crits, mark, combo, charge), the twelve statuses, the 31 modifiers (each with its main
// effect and its fallback for the other forms), a legend's ability (design pass 10: a legend strikes with its body's form on every
// blow, and its head's class gives it one of the twenty abilities of spec/abilities.json on a button of its own, with a cooldown per
// hand), and the training dummies (the wobble, the rail, the armored dummy's resistances, the quintain that hits back).
//
// The rules are pure: no DOM, no canvas, no clock, no Math.random. A fight is plain state; step(fight, dt, input) moves it on by dt
// and returns what happened as events. The same seed and the same inputs give the same events, byte for byte, so every weapon is
// tested in node (tools/test-combat.js) and every later level plays by this file. The screen (proto/battlegrounds.js) draws the
// fight's standing state and turns the events into smears, numbers, holds and shakes on its own clock.
//
// Every number lives in spec/combat.json (window.FORGE_COMBAT). Positions are world pixels on the floor, y growing down the screen;
// a thing's height is drawn up the screen, so a chest is struck at (x, y - chest). Angles are radians, 0 to the right, clockwise.
//
//   Combat.units(weapon)                  the weapon's numbers in units, its modifiers applied (u.second: the second form's, kept
//                                         on the record and no longer played)
//   Combat.abilityUnits(legend)           a legend's ability in units (null for anything else): its numbers in the ability's form
//   Combat.newFight(area, loadout, seed)  a fight in an area ({ w, h, floor, dummies, knight }) with one or two weapons
//   Combat.newFight(level, knights, seed) a fight with knights [{ loadout, kind, name }] in seat order (design pass 12): fight.knights,
//                                         fight.k the first of them (seat 0) and fight.hands its hands, as the one knight's always were
//   Combat.step(fight, dt, input)         input = { move: [x, y], strike, swap, dodge, ability }  (tests may add target and face); a plain
//                                         object is seat 0's, and [input0, input1, ...] or { 0: ..., 1: ... } gives each seat its own
//   Combat.hold(fight, anim, frame, k)    where the weapon sits on the knight's hand, for the screen and for a shot's start (k: seat 0's
//                                         knight unless given; the same for tip, aim, animOf and weaponPose)
//   Combat.hurt(fight, seat, amount, o)   a blow, a shot or a tick on a knight in a level (design pass 12, section 3.8): its hit points,
//                                         the safety, the guard, the stagger, the fall; and for the level's director: waveStart (the
//                                         Second Wind back, the carried-off back), returnKnights and healKnight
//   Combat.afflict(fight, seat, status)   burning or chill on a knight in a level (section 3.8): a burn ticks 2 every 0.5 s for 3.0 s, a
//                                         chill slows x 0.8 a stack on one shared 3.0 s timer, and the third stack in a row freezes it
//
// A level (design pass 12, sections 3.2 to 3.4; spec/gate.json) is solid and has height: every body (knights, trolls, minions) moves by
// proto/physics.js once a step, pushes the others softly, falls, climbs and lands. The trolls are fight.foes, with stable ids from
// fight.bodyId (Combat.spawn, and their death); the breakable pieces (huts, tents, the archer tower, fence and wire sections, barrels,
// the trebuchets, the gate) are fight.pieces. The aim is the cellar's, measured feet to feet on the floor plane: trolls first, then the
// pieces that are aim targets, only in the view, and for melee and streams only within 12 px of height; shots fly with a height and
// stop on what stands taller than them; nothing bounces off the view's edge.
//   Combat.spawn(fight, kind, x, y, o)    a troll of spec/trolls.json comes in (o.tell: its spawn tell, o.on: the platform it stands on)
//   Combat.setView(fight, x0, y0)         the view (the stage's 384 x 216 over the level): the knights' box and the shots' walls
//   Combat.foeShot / foeBurst / reaches   a troll's shot, a blow on the ground, and the 12 px rule, for the trolls' kits
//   Combat.takeRam(fight, seat), Combat.remains(fight, x, y)   the ram's carry slot; where a dead brute's stone may lie
//
// Plain script, defines window.Combat (module.exports in node). Reads proto/pixel-forge.js and proto/knight.js when they are loaded
// (for the weapon's tip); without them a shot leaves from the knight's chest.
(function (root) {
  "use strict";
  const TAU = Math.PI * 2, RAD = Math.PI / 180;
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  let DATA = null;
  function data() { if (!DATA) DATA = root.FORGE_COMBAT; if (!DATA) throw new Error("combat.js needs spec/combat.js (window.FORGE_COMBAT)"); return DATA; }
  // the one move function (design pass 12, section 3.2a): every body's motion and its collide and slide
  let PHYS = null;
  function phys() { if (!PHYS) PHYS = root.Physics || (typeof require === "function" ? require("./physics.js") : null); if (!PHYS) throw new Error("combat.js needs proto/physics.js (window.Physics)"); return PHYS; }
  function use(spec, abilities, trollSpec) { DATA = spec; if (abilities) ABIL = abilities; if (trollSpec) TROLLS = trollSpec; }
  // the trolls' kits and bodies (design pass 12, spec/trolls.json); a kind with a base takes every field of its base it does not set,
  // its body included, and its own resist, weak and immune lists join the trolls' common ones (a kind's own word wins: the Emberback
  // resists the fire the others are weak to)
  let TROLLS = null;
  function trollSpec() { if (!TROLLS) TROLLS = root.FORGE_TROLLS; if (!TROLLS) throw new Error("a level's trolls need spec/trolls.js (window.FORGE_TROLLS)"); return TROLLS; }
  function trollKind(kind) {
    const T = trollSpec(), own = T[kind];
    if (!isRule(own) || kind === "common") return null;
    const base = own.base && isRule(T[own.base]) ? T[own.base] : {}, K = Object.assign({}, base, own), C0 = T.common || {};
    const join = (key, not) => Array.from(new Set((C0[key] || []).filter(x => !(own[not] || []).includes(x)).concat(own[key] || base[key] || [])));
    K.resist = join("resist", "weak"); K.weak = join("weak", "resist"); K.immune = join("immune", "none");
    return K;
  }
  // a legend's ability (design pass 10): the head's class decides it; spec/abilities.json holds all twenty
  let ABIL = null;
  function abilities() { if (!ABIL) ABIL = root.FORGE_ABILITIES || { classes: {} }; return ABIL.classes || {}; }
  const isRule = v => !!v && typeof v === "object";
  const NUMBERS = ["damage", "rate", "range", "speed", "area", "duration", "knockback", "crit"];
  const RANGES = ["reach", "shot", "streamLen", "lobDist", "orbitR", "throwD", "minionReach"];
  const FACINGS = ["right", "left", "away", "toward"];
  const FWD = { right: [1, 0], left: [-1, 0], away: [0, -1], toward: [0, 1] };
  const HAND = { right: [19, 21], left: [12, 21], away: [8, 21], toward: [23, 21] };   // the hanging hand, when proto/knight.js is not loaded
  // four facings: right or left within 60 degrees of the horizontal, else away (up the screen) or toward (down the screen)
  function facingOf(a) { const c = Math.cos(a), s = Math.sin(a), lim = Math.cos(((data().knight || {}).face || 60) * RAD); if (Math.abs(c) >= lim - 1e-9) return c >= 0 ? "right" : "left"; return s > 0 ? "toward" : "away"; }

  // ------------------------------------------------------------------ numbers to units (pass 7 section 3.8.1), then the modifiers
  function numbersOf(w) { const n = {}; for (const k of NUMBERS) { const v = Number((w.numbers || {})[k]); n[k] = isFinite(v) ? clamp(v, 1, 10) : 1; } return n; }
  const isFused = v => !!(v && v.fuse && v.fuse !== v.base);
  function unitsFor(t, second) {
    const C = data(), w = (t && t.weapon) || {}, v = w.visual || {}, n = numbersOf(w), notes = [];
    let form = second ? w.form2 : w.form;
    if (!isRule(C.forms[form])) { notes.push("form " + form); form = C.unknownForm; }   // a word of a newer grammar plays as slash
    const F = C.forms[form], M = C.modifiers, melee = !!F.melee;
    const mods = new Set(); for (const m of (w.modifiers || [])) { if (isRule(M[m])) mods.add(m); else notes.push("modifier " + m); }
    let statuses = []; for (const s of (w.status || [])) { if (isRule(C.statuses[s])) { if (!statuses.includes(s)) statuses.push(s); } else notes.push("status " + s); }
    let element = w.element || "physical";
    // a legend has two forms: the first carries the weapon's element and its first status, the second its second status in that
    // status's element (burn is fire, freeze is ice); with one status both forms carry it
    if (isRule(C.forms[w.form2]) && statuses.length > 1) {
      const mine = second ? statuses[1] : statuses[0];
      if (second && C.statuses[mine].element) element = C.statuses[mine].element;
      statuses = [mine];
    }
    const u = { id: t && t.id, form, isSecond: !!second, second: null, element, statuses, mods, over: {}, base: v.base || "sword", fuse: isFused(v) ? v.fuse : null, material: v.material || "steel",
      n, notes, K: F.K, melee, critX: C.critX, speed: 1, size: 1, spin: false, width: C.forms.thrust.width, touch: C.forms.orbit.touch, shotR: C.projectiles.radius };
    for (const key of Object.keys(C.units)) { const d = C.units[key]; if (!isRule(d)) continue; u[key] = d.div ? d.base + Math.floor(n[d.of] / d.div) : d.base + d.per * n[d.of]; }
    u.shotKind = shotKind(u, v, second);
    if (C.projectiles.byKind[u.shotKind]) u.shotR = C.projectiles.byKind[u.shotKind];
    // every area a form has, and the sizes of what it looses (giant, tiny); a form's own area (the fallbacks of spread and spin)
    const scaleAll = f => { u.arc = Math.min(360, u.arc * f); u.burst *= f; u.half = Math.min(180, u.half * f); u.fieldR *= f; u.width *= f; u.touch *= f; u.shotR *= f; u.size *= f; };
    const scaleOwn = f => { const a = F.area; if (a === "arc") u.arc = Math.min(360, u.arc * f); else if (a === "half") u.half = Math.min(180, u.half * f); else if (typeof u[a] === "number") u[a] *= f; if (a === "touch" || a === "shotR") u.size *= f; };
    if (mods.has("rapid")) { u.rate *= M.rapid.rate; u.hit *= M.rapid.hit; }
    if (mods.has("heavy")) { u.hit *= M.heavy.hit; u.rate *= M.heavy.rate; u.push *= M.heavy.push; }
    if (mods.has("light")) { u.rate *= M.light.rate; u.hit *= M.light.hit; u.speed *= M.light.speed; }
    if (mods.has("giant")) { scaleAll(M.giant.area); u.rate *= M.giant.rate; }
    if (mods.has("tiny")) { scaleAll(M.tiny.area); u.rate *= M.tiny.rate; u.crit += M.tiny.crit; }
    if (mods.has("reach")) for (const k of RANGES) u[k] *= M.reach.range;
    if (mods.has("crit")) { u.crit += M.crit.crit; u.critX = M.crit.critX; }
    if (mods.has("push")) u.push *= M.push.push;
    if (mods.has("spread")) { if (form === "slash") u.arc = Math.min(360, u.arc + M.spread.arc); else if (form === "stream") u.half = Math.min(180, u.half * M.spread.stream); else if (form !== "shoot" && form !== "lob") scaleOwn(M.spread.area); }
    if (mods.has("spin")) { if (melee) { u.spin = true; u.reach *= M.spin.reach; } else if (form === "orbit") u.orbitW *= M.spin.orbit; else scaleOwn(M.spin.area); }
    if (mods.has("explode") && (form === "smash" || form === "lob" || form === "trap")) u.burst *= M.explode.burst;
    if (mods.has("homing") && form !== "shoot" && form !== "lob") for (const k of RANGES) u[k] *= M.homing.range;
    if (mods.has("boomerang") && form !== "shoot" && !melee) for (const k of RANGES) u[k] *= M.boomerang.range;
    if (mods.has("lunge") && !melee) u.speed *= M.lunge.speed;
    return u;
  }
  // what a weapon shoots: by its base (a legend's second form: a shard in its own element), or by a rule on its parts
  function shotKind(u, v, second) {
    const P = data().projectiles;
    if (second) return P.second;
    for (const r of (P.rules || [])) if (r.base === u.base && !u.fuse && (v.attachments || []).includes(r.attachment)) return r.kind;
    return P.kinds[u.fuse || u.base] || P.kinds[u.base] || P.other;
  }
  function units(t) { const u = unitsFor(t, false), w = (t && t.weapon) || {}; u.second = w.form2 ? unitsFor(t, true) : null; return u; }
  // a modifier's numbers for these units: the ability's own when it has them
  const mo = (u, m) => (u && u.over && u.over[m]) || data().modifiers[m];
  // the ability's units: the legend's numbers played in the ability's form, carrying the legend's second status (its first when it has
  // one) in that status's element, plus the ability's own status (at most two), the legend's modifiers plus the ability's; then the
  // ability's set, times and over. null for a weapon that isn't a legend (or a head with no ability)
  function abilityUnits(t) {
    const C = data(), w = (t && t.weapon) || {}, v = w.visual || {};
    const A = isFused(v) ? abilities()[v.fuse] : null;
    if (!A || !isRule(C.forms[A.form])) return null;
    const st = (w.status || []).filter(x => isRule(C.statuses[x])), mine = st.length > 1 ? [st[1]] : st.slice(0, 1);
    if (A.status && isRule(C.statuses[A.status]) && !mine.includes(A.status)) mine.push(A.status);
    const carried = mine[0] && C.statuses[mine[0]] && C.statuses[mine[0]].element;
    const rec = { id: (t.id || "legend") + "#ability", weapon: Object.assign({}, w, { form: A.form, form2: null, status: mine.slice(0, 2),
      modifiers: Array.from(new Set((w.modifiers || []).concat(A.add || []))), element: st.length > 1 && carried ? carried : (w.element || "physical") }) };
    const u = unitsFor(rec, false);
    u.over = Object.assign({}, A.over || {});
    for (const k of Object.keys(A.set || {})) u[k] = A.set[k];
    for (const k of Object.keys(A.times || {})) if (typeof u[k] === "number") u[k] *= A.times[k];
    if (A.shot) { u.shotKind = A.shot; if (C.projectiles.byKind[A.shot]) u.shotR = C.projectiles.byKind[A.shot]; }
    u.ability = A; u.isAbility = true;
    return u;
  }

  // ------------------------------------------------------------------ a fight
  // area: { w, h, floor: { x0, x1, y0, y1 }, dummies: [{ kind, x, y, a, rail, resist, weak, immune }], knight: { start: [x, y], starts: [[x, y]]
  //         by seat, face (degrees) }, room: { side, wallBot, front }, level }   (spec/cellar.json is one; a level names its number in `level`)
  // loadout: one or two weapon records, for one knight; or knights: [{ loadout, kind, name }] in seat order, kind being player, guest,
  // brother or bench (design pass 12, section 3.10)
  // opts: { crits: false } for tests that compare exact numbers
  function newFight(area, loadout, seed, opts) {
    const C = data();
    area = area || {}; opts = opts || {};
    const W = area.w || 384, H = area.h || 216;
    const floor = Object.assign({ x0: 8, x1: W - 8, y0: 8, y1: H - 8 }, area.floor || {});
    const pad = (C.walls || {}).pad || 8, room = area.room;
    const walls = room ? { x0: room.side || 0, x1: W - (room.side || 0), y0: room.wallBot || 0, y1: H - (room.front || 0) } : { x0: floor.x0 - pad, x1: floor.x1 + pad, y0: floor.y0 - pad, y1: floor.y1 + pad };
    const kn = area.knight || {}, start = kn.start || [floor.x0 + 20, (floor.y0 + floor.y1) / 2];
    const fight = { t: 0, steps: 0, seed: seed >>> 0, rand: rng((seed >>> 0) || 1), crits: opts.crits !== false && area.crits !== false, W, H, floor, walls, k: null, knights: [], hands: null,
      dummies: [], shots: [], traps: [], minions: [], patches: [], live: [], events: [], logged: {}, board: { last: null, name: "", log: [], dps: 0 }, nextId: 1, bodyId: 1,
      level: area.level ? { n: area.level, attempt: 1, wipes: 0, rally: null } : null };
    (isKnights(loadout) ? loadout : [{ loadout }]).forEach((s, seat) => {
      const k = newKnight(fight, s, seat, (kn.starts && kn.starts[seat]) || start, kn.face);
      for (const t of (s.loadout || []).slice(0, 2)) if (t && t.weapon) k.hands.push(newHand(t, k));
      if (!k.hands.length) throw new Error("a fight needs a weapon in hand");
      fight.knights.push(k);
    });
    fight.k = fight.knights[0]; fight.hands = fight.k.hands;
    (area.dummies || []).forEach((d, i) => fight.dummies.push(newDummy(d, i)));
    if (fight.level) levelFight(fight, area);
    fight.world = phys().world(fight, fight.level ? C.physics : null, C);
    if (fight.level) levelWorld(fight);
    return fight;
  }
  // a level's fight (design pass 12): its trolls, its view (the stage over the level: the cellar's 384 x 216 when the area is larger),
  // the shots' walls measured from the view when the area says so, and every knight a body of the one move function with a height
  function levelFight(fight, area) {
    const C = data(), KN = C.knight;
    fight.area = area; fight.foes = []; fight.pieces = []; fight.tdirty = true; fight.tlist = null; fight.brains = area.brains === true;   // trolls think when the director (or a test) says so
    // the level's own random streams (section 3.6a, A.4): waves (spawns, the Emberback), marks (chunks, stamps), bots (the sword-brothers),
    // each a mulberry32 of the seed XOR its constant; fight.rand stays the cellar's, driving crits and the blind miss as before
    const RN = C.rng || {}, sx = (key, dflt) => rng((fight.seed ^ parseInt(RN[key] || dflt, 16)) >>> 0);
    fight.rng = { waves: sx("waves", "0x77617665"), marks: sx("marks", "0x6d61726b"), bots: sx("bots", "0x626f7473") };
    // the marks of the battlefield, only where the area says marks: true (their ids from fight.markId, never fight.nextId)
    fight.markId = 1; fight.marks = area.marks ? newMarks(fight) : null;
    if (fight.marks) { fight.gw = Math.ceil(fight.W / GG); fight.gh = Math.ceil(fight.H / GG); fight.ground = new Uint8Array(fight.gw * fight.gh); }
    // the difficulty (section 3.7a): its multipliers apply after party scaling wherever a rule owns the number; normal is all 1.0, so a run
    // with spec/difficulty.json loaded logs byte for byte as one without it
    fight.difficulty = difficultyOf(area.difficulty);
    const vw = area.view || {}, cs = (area.camera || {}).start || [0, 0];
    fight.vw = Math.min(fight.W, vw.w || 384); fight.vh = Math.min(fight.H, vw.h || 216);
    setView(fight, cs[0], cs[1]);
    for (const k of fight.knights) { bodyOf(k, { r: KN.r, h: KN.h || 24, mass: KN.mass || 1, climb: KN.climb || null, catches: (KN.catches || []).includes("deep"), speed: KN.speed }, true); k.hpMax = k.hp = Math.round(KN.hp * dX(fight, "knightHp")); }
  }
  function difficultyOf(name) { const D = root.FORGE_DIFFICULTY; if (!D) return { name: name || "normal", m: {} }; const n = name || D.default || "normal"; return { name: n, m: (D.levels || {})[n] || {} }; }
  const dX = (fight, key) => { const m = fight.difficulty && fight.difficulty.m ? fight.difficulty.m[key] : undefined; return typeof m === "number" ? m : 1; };
  // the level's world is built: the pieces are the rules' targets; a knight's box is the view's, by its screen feet (y - z); a troll's
  // or a minion's the level's floor
  function levelWorld(fight) {
    const W = fight.world, A = fight.area, vk = A.viewKnight;
    fight.pieces = W.pieces || [];
    W.boxOf = b => {
      const F = fight.floor;
      if (b.foe && b.box) return b.box;   // a troll that has come in keeps to its arena's floor (the director's box, section 3.6)
      if (!(b.knight || b.minion) || !vk) return F;
      const v = fight.view, z = b.z || 0, L = fight.level || {}, FB = b.knight && fight.director && L.freeBox && L.freeSeat === b.seat ? L.freeBox : null;   // only while the director steps (a scene that stands it down moves the view itself)
      // a counted solo knight keeps to every view the camera's limits allow (the director's fight.level.freeBox, section 3.2: "a solo
      // knight is never moved by the view"): the camera yields to where it goes; the rest keep to the view they are in
      if (FB) return { x0: FB.x0, x1: FB.x1, y0: Math.max(F.y0, FB.y0 + z), y1: Math.min(F.y1, FB.y1 + z) };
      return { x0: Math.max(F.x0, v.x0 + vk.x0), x1: Math.min(F.x1, v.x0 + vk.x1), y0: Math.max(F.y0, Math.max(F.y0, v.y0 + vk.y0) + z), y1: Math.min(F.y1, Math.min(F.y1, v.y0 + vk.y1) + z) };
    };
    W.list = bodies(fight);
    for (const k of fight.knights) surfaceOf(fight, k);
  }
  // a body's fields for the one move function (design pass 12, section 3.2a)
  function bodyOf(b, o, knight) {
    return Object.assign(b, { z: 0, on: null, r: o.r, h: o.h, mass: o.mass, massStaggered: o.massStaggered, climb: o.climb, catches: !!o.catches, speed: o.speed,
      ix: 0, iy: 0, vx: 0, vy: 0, vz: 0, air: false, climbing: null, pushV: null, mountT: 0, dropT: 0, teeter: false, wireT: 0, knight: !!knight, cal: null });
  }
  // put a body at (x, y), at rest, on what is under it (a platform it is put on); for tests and the level's director (rally points)
  function place(fight, b, x, y, plat) {
    b.x = x; b.y = y; b.ix = 0; b.iy = 0; b.vx = 0; b.vy = 0; b.vz = 0; b.pushV = null; b.air = false; b.z = 0;
    if (b.climbing) { b.climbing.ladder.by = null; b.climbing = null; }
    surfaceOf(fight, b, plat);
    return b;
  }
  // a body placed on what is under it: a platform it is put on, else the ground at its point
  function surfaceOf(fight, b, plat) {
    const W = fight.world, P = phys();
    if (plat && W.platBy && W.platBy[plat]) { b.on = plat; b.z = P.platZ(W.platBy[plat], b.x, b.y); return; }
    const s = W.level ? P.surfaceAt(W, b.x, b.y, (b.z || 0) + W.N.stepUp) : null;
    b.on = s && s.plat ? s.plat.id : null; b.z = s ? s.z : 0;
  }
  // the view: the stage's 384 x 216 over the level, at whole pixels. The knights' box is read from it (above); in an area that gives the
  // view's walls, the shots' walls are the view's box inset as the cellar's walls are (nothing bounces off them in a level)
  function setView(fight, x0, y0) {
    const A = fight.area || {}, VW = A.viewWalls;
    fight.view = { x0, y0, x1: x0 + fight.vw, y1: y0 + fight.vh };
    if (VW) fight.walls = { x0: x0 + VW.x0, x1: x0 + VW.x1, y0: Math.max(VW.floorTop || 0, y0 + VW.y0), y1: y0 + VW.y1 };
    return fight.view;
  }
  // every body in the world this step, in id order: the knights who are not carried off, the trolls past their spawn tell, the minions
  function bodies(fight) {
    const out = [];
    for (const k of fight.knights) if (!k.out) out.push(k);
    for (const f of fight.foes) if (!f.dead && !(f.spawn > 0) && !f.fixed) out.push(f);   // a fixed troll (a wall archer in its breach) is no body: nothing moves it
    for (const m of fight.minions) if (m.body) out.push(m);
    return out;
  }
  const isKnights = list => Array.isArray(list) && list.length > 0 && list.every(s => s && !s.weapon && Array.isArray(s.loadout));
  // a knight: a body of the one move function (its id from fight.bodyId, never fight.nextId) with the cellar knight's state, and hands
  function newKnight(fight, s, seat, at, face) {
    return { id: fight.bodyId++, seat, kind: s.kind || (seat === 0 ? "player" : "guest"), name: s.name || null, hands: [], r: data().knight.r,
      x: at[0], y: at[1], face: (face === undefined ? 0 : face) * RAD, active: 0, moving: false, walkT: 0, strike: null, twinQ: null, pressed: false, lastSwap: false, lastDodge: false,
      streamOn: false, holdT: 0, stream: null, gout: null, charging: false, chargeT: 0, bonk: 0, shove: null, dodge: 0, dodgeCd: 0, safe: 0, dvx: 0, dvy: 0, swapT: 0, lunge: null, trailT: 0,
      lastAbility: false, abQ: null, guardT: 0,
      hp: data().knight.hp, hpMax: data().knight.hp, hurt: 0, stagger: 0, down: null, out: false, rise: 0, secondWind: true, satchel: [] };
  }
  // a hand: one weapon's units and clocks. Its units know whose hand made them (u.knight), so a shot, a trap, a minion, a patch or a
  // status pushes, pulls, heals and is logged for the knight that loosed it
  function newHand(t, k) { const u = units(t), h = { thing: t, u, u2: u.second, ua: abilityUnits(t), acd: 0, acdOf: 1, cd: 0, recover: 0, recoverOf: 0, count: 0, lungeCd: 0, orbit: null, aura: null, practice: !!t.practice }; for (const x of [u, h.u2, h.ua]) if (x) x.knight = k; return h; }
  function newDummy(d, i) {
    const C = data(), Z = isRule(C.dummies[d.kind]) ? C.dummies[d.kind] : C.dummies.straw;
    const o = { i, kind: isRule(C.dummies[d.kind]) ? d.kind : "straw", name: Z.name, x: d.x, y: d.y, r: Z.r, chest: Z.chest, head: Z.head, eyes: Z.eyes, size: Z.size, shadow: Z.shadow, puff: Z.puff,
      resist: d.resist || Z.resist || [], weak: d.weak || Z.weak || [], immune: d.immune || Z.immune || [],
      wob: 0, wv: 0, flash: 0, st: {}, combo: null, acc: 0, accT: 0 };
    if (o.kind === "rail") { const r = d.rail || {}; o.rail = { x0: r.x0 === undefined ? d.x - 60 : r.x0, x1: r.x1 === undefined ? d.x + 60 : r.x1, dir: r.dir === undefined ? 1 : r.dir, pause: r.pause || 0, speed: Z.speed, wait: Z.pause }; }
    if (o.kind === "quintain") o.arm = { a: (d.a || 0) * RAD, w: 0, cool: 0, len: Z.arm };
    return o;
  }
  // put a weapon in a hand (the rack) of a seat's knight (seat 0's unless given); what the old weapon loosed stays loosed
  function setHand(fight, i, t, seat) {
    if (!t || !t.weapon) return false;
    const k = fight.knights[seat || 0], old = k.hands[i], h = newHand(t, k);
    if (old) { h.orbit = old.orbit; h.aura = old.aura; }
    k.hands[i] = h;
    if (i === k.active) { k.strike = null; k.twinQ = null; stopStream(fight, k); k.gout = null; k.charging = false; k.chargeT = 0; }
    for (const n of h.u.notes.concat(h.u2 ? h.u2.notes : [])) logOnce(fight, n);
    return true;
  }
  // take a weapon in the free hand (a knight that carries one weapon); returns the hand's index, or -1 when both hands are full
  function addHand(fight, t, seat) { const k = fight.knights[seat || 0]; if (!t || !t.weapon || k.hands.length >= 2) return -1; const h = newHand(t, k); k.hands.push(h); for (const n of h.u.notes.concat(h.u2 ? h.u2.notes : [])) logOnce(fight, n); return k.hands.length - 1; }
  // an event; one a knight caused carries its seat when the fight has a level or a second knight (design pass 12, section 3.2a: a lone
  // knight's events keep exactly their keys in their order, so the cellar's pinned logs stay byte for byte)
  function emit(fight, e, k) { if (k && (fight.level || fight.knights.length > 1)) e.seat = k.seat; e.t = Math.round(fight.t * 1e6) / 1e6; fight.events.push(e); return e; }
  // the input of a seat: a plain object is seat 0's (the cellar's page, the tests); [input0, input1] or { 0: ..., 1: ... } is keyed by seat
  function inputOf(fight, input, seat) {
    let keyed = Array.isArray(input);
    for (let s = 0; !keyed && s < fight.knights.length; s++) if (input[s] !== undefined) keyed = true;
    return keyed ? input[seat] || {} : seat === 0 ? input : {};
  }
  function logOnce(fight, what) { if (fight.logged[what]) return; fight.logged[what] = true; emit(fight, { type: "log", text: "unknown " + what }); }

  // ------------------------------------------------------------------ the aim
  // the point a strike aims at: a dummy's chest (the quintain: its shield end, at chest height)
  function hitPoint(d) { if (d.arm) return [d.x + Math.cos(d.arm.a) * d.arm.len, d.y + Math.sin(d.arm.a) * d.arm.len - d.chest]; if (d.foe || d.piece) return [d.x, d.y - data().knight.chest]; return [d.x, d.y - d.chest]; }
  // in a level a troll or a piece is measured feet to feet on the floor plane (design pass 12, section 3.2b): its point is its feet at the
  // height of the knight's chest, so a distance from the knight's chest is a distance on the floor; where it is drawn (its chest over its
  // surface) is drawnAt
  const drawnAt = d => [d.x, d.y - (d.z || 0) - (d.chest || 0) - (d.up || 0)];
  function chestOf(k) { return [k.x, k.y - data().knight.chest]; }
  function reachOf(u) { const f = u.form; return u.melee ? u.reach : f === "shoot" ? u.shot : f === "stream" ? u.streamLen : f === "lob" ? u.lobDist : f === "trap" ? u.throwD : data().aim.other; }
  // the nearest dummy within the weapon's reach or range x 1.25 (20 px more with lunge) and within 60 degrees of the facing; seeking
  // looks at the whole room; if there is none, straight along the facing. `not` leaves a dummy out (twin's second blow).
  function aim(fight, u, want, not, k) {
    k = k || fight.k;
    if (fight.level) return aimLevel(fight, u, want, not, k);
    const C = data(), [ox, oy] = chestOf(k);
    if (want !== undefined && want !== null && fight.dummies[want]) { const d = fight.dummies[want], p = hitPoint(d); return { a: Math.atan2(p[1] - oy, p[0] - ox), d }; }
    const seeking = u.mods.has("seeking"), lim = (reachOf(u) + (u.mods.has("lunge") && u.melee ? mo(u, "lunge").dash : 0)) * C.aim.stretch, cone = C.aim.cone * RAD;
    let best = null, bd = Infinity;
    for (const d of fight.dummies) {
      if (d === not) continue;
      const p = hitPoint(d), dd = dist(ox, oy, p[0], p[1]), a = Math.atan2(p[1] - oy, p[0] - ox);
      if ((seeking || (dd <= lim + d.r && Math.abs(angDiff(a, k.face)) <= cone)) && dd < bd) { bd = dd; best = { a, d }; }
    }
    return best || { a: k.face, d: null };
  }
  // the aim in a level (design pass 12, sections 3.2b and 3.8): the cellar's rule, feet to feet on the floor plane, over what stands in the
  // view: the trolls (and a level's dummies) first, then the pieces that are aim targets (huts, tents, the archer tower, the trebuchets, the
  // gate), never wire, a fence, a barrel or a clod; a melee or stream weapon skips what is more than 12 px above or below the knight's
  // feet, and the gate only from the drawbridge's deck. want: a target, or its i
  function aimLevel(fight, u, want, not, k) {
    const C = data(), [ox, oy] = chestOf(k), all = targets(fight);
    if (want !== undefined && want !== null) { const d = typeof want === "object" ? want : all.find(t => t.i === want); if (d) { const p = hitPoint(d); return { a: Math.atan2(p[1] - oy, p[0] - ox), d }; } }
    const seeking = u.mods.has("seeking"), lim = (reachOf(u) + (u.mods.has("lunge") && u.melee ? mo(u, "lunge").dash : 0)) * C.aim.stretch, cone = C.aim.cone * RAD;
    const zr = u.melee || u.form === "stream" ? C.physics.z.melee : Infinity;
    const pick = things => {
      let best = null, bd = Infinity;
      for (const d of all) {
        if (d === not || !!d.piece !== things || (things && !d.aim) || !inView(fight, d) || !canHit(fight, k, d, u, zr)) continue;
        const p = hitPoint(d), dd = dist(ox, oy, p[0], p[1]), a = Math.atan2(p[1] - oy, p[0] - ox);
        if ((seeking || (dd <= lim + d.r && Math.abs(angDiff(a, k.face)) <= cone)) && dd < bd) { bd = dd; best = { a, d }; }
      }
      return best;
    };
    return pick(false) || pick(true) || { a: k.face, d: null };
  }

  // ------------------------------------------------------------------ the weapon on the hand
  // the weapon's facing and its offset on the hand for the knight's state: one pose per facing; a strike moves it, never turns it
  function weaponPose(fight, k) {
    k = k || fight.k;
    const s = k.strike, C = data();
    const facing = facingOf(s ? s.a : k.face), f = FWD[facing];
    let fw = 0, up = 0;
    if (s) {
      const P = (C.forms[s.form] || {}).pose || {}, since = s.t - s.wind - s.act;
      if (P.recoil) { if (s.t >= s.wind && s.t < s.wind + P.recoilT) { fw = P.recoil[0]; up = P.recoil[1]; } }
      else if (s.t < s.wind) { if (P.wind) { fw = P.wind[0]; up = P.wind[1]; } }
      else if (since < 0) { if (P.strike) { fw = P.strike[0]; up = P.strike[1]; } }
      else if (P.ease) fw = Math.max(0, Math.round(P.strike[0] - since * P.ease));
      else if (P.recover && since < P.recoverT) { fw = P.recover[0]; up = P.recover[1]; }
    }
    return { facing, off: [f[0] * fw, f[1] * fw - up] };
  }
  // which of the knight's arms holds a base out in front (0 the hanging arm); a fused legend is held like the rest
  function armFor(u) { return u.fuse ? 0 : ((data().hold.out || {})[u.base] || 0); }
  function holdOffset(u, facing) { const h = u.fuse ? null : (data().hold.offset || {})[u.base]; if (!h) return [0, 0]; if (facing === "left") return [-h.right[0], h.right[1]]; return h[facing] || [0, 0]; }
  // the knight's frame and where its weapon's grip lands, for an animation frame
  function hold(fight, anim, i, k) {
    k = k || fight.k;
    const hand = k.hands[k.active], u = hand.u, pose = weaponPose(fight, k), reach = armFor(u);
    const K = root.Knight, kf = K && K.frame ? K.frame(pose.facing, anim || "idle", i || 0, reach) : null, hp = kf ? kf.hand : HAND[pose.facing];
    const x0 = Math.round(k.x) - 16, y0 = Math.round(k.y) - 31, ho = holdOffset(u, pose.facing);
    return { thing: hand.thing, facing: pose.facing, off: pose.off, reach, frame: kf, x0, y0, hx: x0 + hp[0] + Math.round(pose.off[0]) + ho[0], hy: y0 + hp[1] + Math.round(pose.off[1]) + ho[1], behind: pose.facing === "away" };
  }
  // where a shot, a shell or a stream leaves the weapon: its tip in the hand (the head's end, a gem, a muzzle, a bell; the bow's riser)
  function tip(fight, k) {
    k = k || fight.k;
    const PF = root.PixelForge;
    if (!PF || !PF.poseFor) { const [ox, oy] = chestOf(k), a = k.strike ? k.strike.a : k.face; return [ox + Math.cos(a) * 8, oy + Math.sin(a) * 8]; }
    const h = hold(fight, "strike", 0, k), sp = PF.poseFor(h.thing, h.facing, 0), g = sp.grip || [6, 25], tp = sp.tip || g;
    return [h.hx - g[0] + tp[0], h.hy - g[1] + tp[1]];
  }
  // the knight's animation and frame for its state (the screen draws it; the rules only need the strike frame, for the tip)
  function animOf(fight, k) {
    k = k || fight.k;
    const s = k.strike;
    if (k.bonk > 0) return { anim: "bonk", i: 0 };
    if (s) return { anim: s.t < s.wind ? "wind" : s.t < s.wind + s.act + 0.05 ? "strike" : "recover", i: 0 };
    if (k.streamOn || k.gout) return { anim: "strike", i: 0 };
    if (k.moving || k.dodge > 0 || k.lunge) return { anim: "walk", i: Math.floor(k.walkT * 8) % 4 };
    return { anim: "idle", i: Math.floor(fight.t * 2) % 2 };
  }

  // ------------------------------------------------------------------ the step
  function step(fight, dt, input) {
    data();
    input = input || {};
    fight.events = []; fight.live = []; fight.steps++; fight.t += dt;
    fight.input = input;
    const K = fight.knights;
    if (fight.steps === 1) for (const k of K) for (const h of k.hands) for (const n of h.u.notes.concat(h.u2 ? h.u2.notes : [])) logOnce(fight, n);
    if (fight.world.level) { levelStep(fight, dt, input); return finishStep(fight, dt, input); }
    for (const k of K) knightStep(fight, k, dt, inputOf(fight, input, k.seat));
    dummiesStep(fight, dt);
    for (const k of K) if (!k.out) phys().settle(k, fight.world);   // the rail dummy slides: it pushes a standing knight aside
    if (fight.level) lifeStep(fight, dt);
    return finishStep(fight, dt, input);
  }
  // a level's step (design pass 12, section 3.2a): knights in seat order, then the trolls in id order, then the minions, each moved once
  // by the one move function; then the soft push between bodies, the view's hold on the knights and the final core pass
  function levelStep(fight, dt, input) {
    const P = phys(), W = fight.world, K = fight.knights;
    W.list = bodies(fight); P.begin(W, W.list);
    for (const k of K) { k._mv = null; knightStep(fight, k, dt, inputOf(fight, input, k.seat)); if (!k.out) moveBody(fight, k, k._mv, dt); }
    dummiesStep(fight, dt);
    fieldsStep(fight, dt); deckWatch(fight, dt);
    for (const f of fight.foes.slice()) foeStep(fight, f, dt);
    minionsLevel(fight, dt);
    W.list = bodies(fight);
    P.soft(W, W.list);
    if (fight.director) { fight.director.step(fight, dt, input); W.list = bodies(fight); }   // the level's director (proto/level.js): the waves, the engines and the camera, before the view's hold
    for (const k of K) if (!k.out) P.hold(W, k);
    P.cores(W, W.list);
    marksStep(fight, dt);
    lifeStep(fight, dt);
  }
  function finishStep(fight, dt, input) {
    const C = data(), K = fight.knights;
    shotsStep(fight, dt); for (const k of K) orbitsStep(fight, k, dt); for (const k of K) aurasStep(fight, k, dt); trapsStep(fight, dt); minionsStep(fight, dt); patchesStep(fight, dt);
    for (const k of K) streamStep(fight, k, dt, inputOf(fight, input, k.seat)); for (const k of K) goutStep(fight, k, dt);
    const win = C.board.window, b = fight.board;
    while (b.log.length && fight.t - b.log[0][0] > win) b.log.shift();
    let sum = 0; for (const e of b.log) sum += e[1];
    b.dps = sum / win;
    return fight.events;
  }

  // ------------------------------------------------------------------ the knight: walking, the dodge, swapping, striking
  function knightStep(fight, k, dt, inp) {
    const C = data(), KN = C.knight;
    if (k.out) return;   // carried off (a level): it watches from the edge until it comes back
    for (const h of k.hands) { h.cd -= dt; if (h.recover > 0) h.recover = Math.max(0, h.recover - dt); if (h.lungeCd > 0) h.lungeCd -= dt; if (h.acd > 0) { h.acd = Math.max(0, h.acd - dt); if (h.acd === 0) emit(fight, { type: "ready", hand: k.hands.indexOf(h) }, k); } }
    if (k.guardT > 0) k.guardT = Math.max(0, k.guardT - dt);
    if (k.dodgeCd > 0) k.dodgeCd -= dt;
    if (k.safe > 0) k.safe -= dt;
    if (k.hurt > 0) { k.hurt -= dt; if (k.hurt <= 1e-9) k.hurt = 0; }
    if (k.stagger > 0) { k.stagger -= dt; if (k.stagger <= 1e-9) k.stagger = 0; }
    if (k.wireT > 0) k.wireT -= dt;
    if (fight.level) statusStep(fight, k, dt);   // burning, chill and frozen (design pass 12, section 3.8)
    if (k.down || k.rise > 0 || fight.wipe) { lie(fight, k, dt, inp); return; }
    if (k.climbing || k.air) { aloft(fight, k, dt, inp); return; }
    // frozen: no walking, strike, dodge, swap or ability for its 1.0 s; its presses are tracked, so nothing fires when it thaws
    if (k.frozen > 0) { k.pressed = !!inp.strike; k.lastSwap = !!inp.swap; k.lastDodge = !!inp.dodge; k.lastAbility = !!inp.ability; k.moving = false; return; }
    // a blow's stagger (a level): no walk, strike, swap or ability, and a dodge ends it (spec/combat.json knight.stagger)
    const ST = KN.stagger || {}, staggered = k.stagger > 0;
    // swapping takes 0.3 s: the knight sheathes and draws
    const swap = !!inp.swap && !k.lastSwap; k.lastSwap = !!inp.swap;
    if (k.swapT > 0) k.swapT = Math.max(0, k.swapT - dt);
    if (swap && k.carry && k.swapT <= 0 && (!staggered || ST.swap)) { putRam(fight, k); k.swapT = KN.swap; }
    else if (swap && k.hands.length > 1 && k.swapT <= 0 && k.bonk <= 0 && (!staggered || ST.swap)) {
      k.active = (k.active + 1) % k.hands.length; k.swapT = KN.swap;
      k.strike = null; k.twinQ = null; k.gout = null; k.charging = false; k.chargeT = 0; stopStream(fight, k);
      emit(fight, { type: "swap", hand: k.active, weapon: k.hands[k.active].thing.id }, k);
    }
    const hand = handOf(k), u = hand.u;
    // staggered by the quintain: pushed away, nothing else
    if (k.bonk > 0) {
      k.bonk -= dt;
      if (k.shove) { go(fight, k, { drive: k.shove }, dt); if (k.shove.done) k.shove = null; }
      k.pressed = !!inp.strike; k.lastDodge = !!inp.dodge; k.moving = false;
      return;
    }
    // the dodge: 56 px in 0.2 s along the stick (or the facing)
    const mv = inp.move || [0, 0], mm = Math.hypot(mv[0], mv[1]);
    const dodge = !!inp.dodge && !k.lastDodge; k.lastDodge = !!inp.dodge;
    if (dodge && k.dodge <= 0 && k.dodgeCd <= 0 && (!staggered || ST.dodge)) {
      const a = mm > 0.05 ? Math.atan2(mv[1], mv[0]) : k.face, D = KN.dodge;
      k.dodge = D.time; k.dodgeCd = D.cooldown; k.safe = D.safe; k.dvx = Math.cos(a) * D.px / D.time; k.dvy = Math.sin(a) * D.px / D.time;
      if (staggered && ST.dodgeEnds) k.stagger = 0;
      k.strike = null; k.twinQ = null; k.charging = false; k.chargeT = 0; stopStream(fight, k);
      emit(fight, { type: "dodge", x: k.x, y: k.y, a }, k);
    }
    if (k.dodge > 0) {
      const d = Math.min(dt, k.dodge); k.dodge -= dt;
      go(fight, k, { drive: { kind: "vel", vx: k.dvx, vy: k.dvy, d } }, dt);
      k.walkT += dt; k.moving = true;
      k.pressed = !!inp.strike;
      if (k.dodge <= 0 && k.burn) endBurn(fight, k, "dodge");   // the roll puts a burn out when the dodge ends (a level)
      return;
    }
    // walking: 80 px/s at full tilt, slower at partial tilt; frost_trail drops its patch where the step lands, before the resolve
    k.moving = mm > 0.05 && !k.lunge && (!staggered || ST.walk);
    if (k.moving) {
      const tilt = Math.min(1, mm), sp = KN.speed * tilt * u.speed;
      k.walkT += dt;
      if (!k.strike && !k.streamOn && !k.gout) k.face = Math.atan2(mv[1], mv[0]);
      const trail = u.mods.has("frost_trail") ? b => { k.trailT += dt; if (k.trailT >= C.modifiers.frost_trail.every) { k.trailT = 0; patch(fight, "frost", b.x, b.y, C.modifiers.frost_trail.radius, u.statusT, u); } } : null;
      go(fight, k, { wish: [mv[0] / mm * sp, mv[1] / mm * sp], tilt }, dt, trail);
    }
    if (inp.face !== undefined && inp.face !== null && !k.strike) k.face = inp.face;
    if (k.lunge) { const L = k.lunge; go(fight, k, { drive: L }, dt); k.walkT += dt; if (L.done) k.lunge = null; }
    // Strike
    const held = !!inp.strike, pressed = held && !k.pressed;
    k.pressed = held;
    const F = C.forms[u.form], ready = k.swapT <= 0 && !k.strike && !k.gout && (!staggered || ST.strike);
    const next = () => false;   // design pass 10: a legend strikes with its body's form only; its head gives the ability
    // the ability: a press, when the hand has one and its clock is done; a blow in progress is cut short, as a dodge cuts it
    const abil = !!inp.ability && !k.lastAbility; k.lastAbility = !!inp.ability;
    // the queued plays of an ability (Frenzy's rakes, the Snare Line's traps...) come gap apart: the queue is stepped before a press
    // starts one, so the press's own frame doesn't count against the first gap
    if (k.abQ) { k.abQ.t -= dt; if (k.abQ.t <= 0 && (!k.strike || k.strike.done)) { const Q = k.abQ; Q.left--; Q.t = Q.gap; if (Q.left <= 0) k.abQ = null; playAbility(fight, k, hand, Q.ua, Q.i++, inp.target); } }
    if (abil && hand.ua && hand.acd <= 0 && k.swapT <= 0 && (!staggered || ST.ability)) { useAbility(fight, k, hand, inp.target); }
    // a blow was struck with the units fu: it counts, and a blow of a repeating form starts the hand's cooldown (1 / rate, the overshoot
    // of the last one carried, so a held Strike keeps the weapon's rate exactly)
    const did = fu => { if (!fu) return; hand.count++; if (C.forms[fu.form].blow) hand.cd = Math.max(hand.cd, -dt) + 1 / fu.rate; };
    if (u.mods.has("charge") && u.form !== "stream") {
      // charge: hold to charge (up to 1 s), release to strike at x (1 + 1.5 x the charge); a charge weapon doesn't repeat while held
      const CH = C.modifiers.charge;
      if (held && ready && hand.cd <= 0 && !k.charging && (F.blow || pressed)) { k.charging = true; k.chargeT = dt; emit(fight, { type: "charge", hand: k.active }, k); }
      else if (held && k.charging) k.chargeT = Math.min(CH.time, k.chargeT + dt);
      else if (!held && k.charging) {
        k.charging = false;
        const c = 1 + CH.more * clamp(k.chargeT / CH.time, 0, 1);
        if (ready) did(blow(fight, k, next(), inp.target, false, c));
        k.chargeT = 0;
      }
    } else if (u.form === "stream") {
      // hold: flows; release: stops. A legend's third start is one blow of its second form
      if (held && ready && !k.streamOn && hand.recover <= 0 && hand.cd <= 0) {
        if (next()) did(blow(fight, k, true, inp.target, false, 1));
        else { k.streamOn = true; k.holdT = 0; hand.count++; emit(fight, { type: "stream", on: true, hand: k.active }, k); }
      } else if (!held && k.streamOn) stopStream(fight, k);
    } else if (F.blow) {
      // tap: one blow; hold: blows at the weapon's rate
      if (held && ready && hand.cd <= 0) did(blow(fight, k, next(), inp.target, false, 1));
    } else if (pressed && ready) {
      // orbit, field, trap, summon: a press
      const second = next();
      if (!second || !C.forms[hand.u2.form].blow || hand.cd <= 0) did(blow(fight, k, second, inp.target, false, 1));
    }
    if (k.strike) strikeStep(fight, k, dt);
    // twin: every blow repeats 0.15 s later (once the first has landed)
    if (k.twinQ) { k.twinQ.t -= dt; if (k.twinQ.t <= 0 && (!k.strike || k.strike.done)) { const q = k.twinQ; k.twinQ = null; if (k.swapT <= 0) { startStrike(fight, k, q.fu, q.want, true, q.charge, q.first); strikeStep(fight, k, 0); } } }
  }
  function useAbility(fight, k, hand, want) {
    const ua = hand.ua, A = ua.ability;
    k.strike = null; k.twinQ = null; k.gout = null; k.charging = false; k.chargeT = 0; k.abQ = null; stopStream(fight, k);
    hand.acd = A.cooldown; hand.acdOf = A.cooldown;
    emit(fight, { type: "ability", name: A.name, hand: k.active, x: k.x, y: k.y, el: ua.element }, k);
    playAbility(fight, k, hand, ua, 0, want);
    if ((A.n || 1) > 1) k.abQ = { left: A.n - 1, gap: A.gap || 0.1, t: A.gap || 0.1, i: 1, ua };
    return true;
  }
  // one play of an ability: nova (a burst around the knight), guard (a blocking window, then the blow), line (a trap a step further each
  // play), or one blow of the ability's form at its damage factor
  function playAbility(fight, k, hand, ua, i, want) {
    const C = data(), A = ua.ability, x = A.x || 1;
    if (A.special === "nova") { burst(fight, k.x, k.y, ua.fieldR, ua.hit * ua.K * x, "field", ua); return; }
    if (A.special === "guard") k.guardT = ua.guardT || 2;
    if (A.special === "line") { const d0 = ua.throwD; ua.throwD = d0 + i * ((ua.over.line || {}).step || 24); hand.cd = 0; placeTrap(fight, k, hand, ua, want, x); ua.throwD = d0; hand.cd = 0; return; }
    const F = C.forms[ua.form];
    if (F.blow) { startStrike(fight, k, ua, want, false, x); strikeStep(fight, k, 0); return; }
    if (ua.form === "stream") { startGout(fight, k, ua, want, x); if (ua.goutT) k.gout.T = ua.goutT; return; }
    if (ua.form === "orbit") { hand.orbit = null; hand.recover = 0; startOrbit(fight, k, hand, ua, x); return; }
    if (ua.form === "field") { hand.aura = null; hand.recover = 0; startAura(fight, k, hand, ua, x); return; }
    if (ua.form === "trap") { hand.cd = 0; placeTrap(fight, k, hand, ua, want, x); hand.cd = 0; return; }
    if (ua.form === "summon") { const hi = k.hands.indexOf(hand); fight.minions = fight.minions.filter(m => m.owner !== hi || m.fu.knight !== k); summon(fight, k, hand, ua, x); }
  }
  // a knight on the ground (a level): down, it crawls along the stick at 16 px/s, facing its way; getting up from a Second Wind or in a
  // wipe's fade it lies still. Its presses are tracked, so a button held on the ground does not fire when it stands
  function lie(fight, k, dt, inp) {
    const mv = inp.move || [0, 0], mm = Math.hypot(mv[0], mv[1]);
    k.pressed = !!inp.strike; k.lastSwap = !!inp.swap; k.lastDodge = !!inp.dodge; k.lastAbility = !!inp.ability;
    k.moving = !!k.down && !fight.wipe && mm > 0.05;
    if (!k.moving) return;
    const sp = data().downed.crawl * Math.min(1, mm);
    k.walkT += dt; k.face = Math.atan2(mv[1], mv[0]);
    go(fight, k, { wish: [mv[0] / mm * sp, mv[1] / mm * sp] }, dt);
  }
  // a knight's motion this step: in the cellar's world the move itself, on today's four branches only (an idle knight is never resolved);
  // in a level it is held for the one move every body makes each step (moveBody), after the rest of its step
  function go(fight, k, intent, dt, pre) { if (fight.world.level) { k._mv = { intent, pre }; return; } phys().move(k, intent, fight.world, dt, pre); }
  const handOf = k => k.carry || k.hands[k.active];   // the ram, while a knight carries it (design pass 12, section 3.4)
  // a knight on a ladder or in the air (a level): it cannot strike, swap or use its ability; on a ladder the stick climbs and a dodge lets
  // go (it falls from where it is). Its presses are tracked, so a button held up there does not fire when it lands
  function aloft(fight, k, dt, inp) {
    const dodge = !!inp.dodge && !k.lastDodge;
    k.pressed = !!inp.strike; k.lastSwap = !!inp.swap; k.lastDodge = !!inp.dodge; k.lastAbility = !!inp.ability; k.moving = false;
    if (!k.climbing) return;
    if (dodge) { phys().letGo(fight.world, k, false); emit(fight, { type: "letGo", x: k.x, y: k.y, z: k.z }, k); return; }
    const mv = inp.move || [0, 0], mm = Math.hypot(mv[0], mv[1]), sp = data().knight.speed;
    if (mm > 0.05) { k._mv = { intent: { wish: [mv[0] / mm * sp, mv[1] / mm * sp], tilt: Math.min(1, mm) } }; k.moving = true; k.walkT += dt; }
  }
  function stopStream(fight, k) { if (k.streamOn) emit(fight, { type: "stream", on: false, hand: k.active }, k); k.streamOn = false; k.stream = null; }
  // the knight is a circle of radius 6 at its feet, moved by proto/physics.js: pushed out of the dummies' bases, then kept on the floor
  const onFloor = (fight, x, y, apex) => fight.level ? levelFloor(fight, x, y, apex) : [clamp(x, fight.floor.x0, fight.floor.x1), clamp(y, fight.floor.y0, fight.floor.y1)];
  // in a level (design pass 12, section 3.2): clamped to the knights' box in the view, pushed out of the solids (never into the moat, a pit
  // or a solid platform), on the highest surface under it that comes no higher than apex: [x, y, z]
  function levelFloor(fight, x, y, apex) {
    const W = fight.world, P = phys(), b = { x, y, z: 0, r: 3, h: 4, knight: true }, box = W.boxOf ? W.boxOf(b) : fight.floor;
    b.x = clamp(x, box.x0, box.x1); b.y = clamp(y, box.y0, box.y1);
    const s = P.surfaceAt(W, b.x, b.y, apex === undefined ? 1e9 : apex);
    b.on = s && s.plat ? s.plat.id : null; b.z = s ? s.z : 0;
    if (P.caught(W, b) || (!b.on && P.groundAt(W, b.x, b.y).deep)) P.freePoint(W, b);
    const t = P.surfaceAt(W, b.x, b.y, apex === undefined ? 1e9 : apex);
    return [b.x, b.y, t ? t.z : 0];
  }

  // ------------------------------------------------------------------ a blow of a form
  // second: the legend's second form; charge: the blow's multiplier (1 when not charged). Returns the units the blow used, or null
  // when nothing could happen (an orbit still up, a hand recovering, the cap of traps or minions).
  function blow(fight, k, second, want, isTwin, charge) {
    const C = data(), hand = handOf(k), fu = second && hand.u2 ? hand.u2 : hand.u, F = C.forms[fu.form];
    if (F.blow) { startStrike(fight, k, fu, want, isTwin, charge); return fu; }
    let done = false;
    if (fu.form === "stream") done = fu.isSecond ? startGout(fight, k, fu, want, charge) : false;   // a stream as a first form flows from the hold
    else if (fu.form === "orbit") done = startOrbit(fight, k, hand, fu, charge);
    else if (fu.form === "field") done = startAura(fight, k, hand, fu, charge);
    else if (fu.form === "trap") done = placeTrap(fight, k, hand, fu, want, charge);
    else if (fu.form === "summon") done = summon(fight, k, hand, fu, charge);
    if (done) return fu;
    return second ? blow(fight, k, false, want, isTwin, charge) : null;   // none could start: the blow is the first form
  }
  function startStrike(fight, k, fu, want, isTwin, charge, first) {
    const C = data(), hand = handOf(k), F = C.forms[fu.form], M = C.modifiers;
    let am = aim(fight, fu, want, isTwin ? first : undefined, k);
    if (isTwin && !am.d && first) am = aim(fight, fu, first.i, undefined, k);   // twin: the next-nearest target, or the same one
    const s = k.strike = { form: fu.form, fu, hand: k.active, t: 0, wind: fu.windT || F.wind, act: F.act, dur: fu.windT ? Math.max(F.dur, fu.windT + F.act + 0.1) : F.dur, a: am.a, target: am.d, done: false, twin: !!isTwin, charge: charge || 1 };
    k.face = am.a;
    // lunge: close the gap before a melee blow
    const LG = Object.assign({}, M.lunge, (fu.over || {}).lunge || {});
    if (fu.mods.has("lunge") && fu.melee && am.d && (hand.lungeCd <= 0 || fu.isAbility)) {
      const p = hitPoint(am.d), [ox, oy] = chestOf(k), dd = dist(ox, oy, p[0], p[1]);
      if (dd > fu.reach && dd <= fu.reach + LG.dash) {
        const go = Math.min(LG.dash, dd - fu.reach + LG.past);
        k.lunge = { kind: "lerp", t: 0, T: LG.time, x0: k.x, y0: k.y, x1: k.x + Math.cos(am.a) * go, y1: k.y + Math.sin(am.a) * go };
        s.wind = LG.wind; if (!fu.isAbility) hand.lungeCd = LG.cooldown;
        emit(fight, { type: "fx", kind: "dash", x: k.x, y: k.y, a: am.a }, k);
      }
    }
    emit(fight, { type: "strike", form: fu.form, hand: k.active, second: fu.isSecond, twin: !!isTwin, a: am.a, target: am.d ? am.d.i : null, charge: s.charge }, k);
    if (fu.mods.has("twin") && !isTwin) k.twinQ = { t: M.twin.gap, fu, want, charge, first: am.d };
    return s;
  }
  function strikeStep(fight, k, dt) {
    const s = k.strike;
    s.t += dt;
    if (!s.done && s.t >= s.wind) { s.done = true; resolve(fight, k, s); }
    if (s.done && s.t < s.wind + s.act) liveBox(fight, k, s);
    if (s.t >= s.dur) k.strike = null;
  }
  // the hitbox of a live strike, for the reach overlay
  function liveBox(fight, k, s) {
    const u = s.fu, [ox, oy] = chestOf(k);
    if (s.form === "slash") fight.live.push(u.spin ? { type: "circle", x: ox, y: oy, r: u.reach } : { type: "sector", x: ox, y: oy, r: u.reach, a0: s.a - u.arc / 2 * RAD, a1: s.a + u.arc / 2 * RAD });
    else if (s.form === "thrust") fight.live.push(u.spin ? { type: "circle", x: ox, y: oy, r: u.reach } : { type: "line", x: ox, y: oy, a: s.a, len: u.reach, w: u.width });
    else if (s.form === "smash") fight.live.push(u.spin ? { type: "circle", x: ox, y: oy, r: u.reach } : { type: "circle", x: ox + Math.cos(s.a) * u.reach, y: oy + Math.sin(s.a) * u.reach, r: u.burst });
  }
  const SMEAR = { whip: "lash", claw: "rake", scythe: "reap", axe: "chop" };
  function resolve(fight, k, s) {
    const C = data(), u = s.fu, [ox, oy] = chestOf(k), amount = u.hit * u.K * s.charge;
    const look = { el: u.element, mat: u.material };
    const o = extra => Object.assign({ form: s.form, kind: "direct", from: [ox, oy], melee: true, fu: u }, extra || {});
    const struck = [];
    if (s.form === "slash") {
      const half = u.arc / 2 * RAD, a0 = s.a - half, a1 = s.a + half;
      emit(fight, Object.assign({ type: "fx", kind: "smear", x: ox, y: oy, r: u.reach, a0: u.spin ? s.a : a0, a1: u.spin ? s.a + TAU : a1, style: u.spin ? "spin" : (SMEAR[u.fuse || u.base] || "crescent") }, look), k);
      for (const d of targets(fight)) { if (!canHit(fight, k, d, u)) continue; const p = hitPoint(d), dd = dist(ox, oy, p[0], p[1]), a = Math.atan2(p[1] - oy, p[0] - ox);
        if (dd <= u.reach + d.r && (u.spin || Math.abs(angDiff(a, s.a)) <= half + C.forms.slash.slack)) { struck.push(d); hit(fight, d, amount, o()); } }
      if ((u.fuse || u.base) === "axe" && !u.spin) emit(fight, { type: "fx", kind: "dust", x: ox + Math.cos(s.a) * u.reach, y: k.y + Math.sin(s.a) * u.reach * 0.6 }, k);
    } else if (s.form === "thrust") {
      if (u.spin) {
        emit(fight, Object.assign({ type: "fx", kind: "smear", x: ox, y: oy, r: u.reach, a0: s.a, a1: s.a + TAU, style: "spin" }, look), k);
        for (const d of targets(fight)) { if (!canHit(fight, k, d, u)) continue; const p = hitPoint(d); if (dist(ox, oy, p[0], p[1]) <= u.reach + d.r) { struck.push(d); hit(fight, d, amount, o()); } }
      } else {
        emit(fight, Object.assign({ type: "fx", kind: "streak", x: ox, y: oy, a: s.a, len: u.reach }, look), k);
        const hits = [], ca = Math.cos(s.a), sa = Math.sin(s.a);
        for (const d of targets(fight)) { if (!canHit(fight, k, d, u)) continue; const p = hitPoint(d), dx = p[0] - ox, dy = p[1] - oy, along = dx * ca + dy * sa, across = Math.abs(-dx * sa + dy * ca);
          if (along >= 0 && along <= u.reach + d.r && across <= u.width / 2 + d.r) hits.push([along, d]); }
        hits.sort((a, b) => a[0] - b[0] || a[1].i - b[1].i);
        for (const [, d] of (u.mods.has("pierce") ? hits : hits.slice(0, 1))) { struck.push(d); hit(fight, d, amount, o()); }
        if (hits.length) { const p = hitPoint(hits[0][1]); emit(fight, Object.assign({ type: "fx", kind: "star", x: p[0] - ca * 5, y: p[1] - sa * 5 }, look), k); }
      }
    } else if (s.form === "smash") {
      // land (the Wrecking Ball): the blow comes down on the foe it aims at, up to its reach
      const R = u.land && s.target ? Math.min(u.reach, Math.max(0, dist(ox, oy, hitPoint(s.target)[0], hitPoint(s.target)[1]))) : u.reach;
      const cx = u.spin ? ox : ox + Math.cos(s.a) * R, cy = u.spin ? oy : oy + Math.sin(s.a) * R, r = u.spin ? u.reach : u.burst;
      const gy = u.spin ? k.y : k.y + Math.sin(s.a) * R * 0.6 + 2;
      emit(fight, Object.assign({ type: "fx", kind: u.spin ? "whirl" : "ring", x: cx, y: gy, r }, look), k);
      if (!u.spin) emit(fight, { type: "fx", kind: "crack", x: cx, y: gy, seed: fight.steps }, k);
      if (!u.spin && fight.marks) stamp(fight, "crack", cx, gy, Math.round(u.burst * (C.forms.smash.crack || 1)), k.z || 0);   // a smash form's crack stays on the field (section 3.6a)
      emit(fight, { type: "shake", amp: C.forms.smash.shake, time: C.feel.shakeT }, k);
      for (const d of targets(fight)) { if (!canHit(fight, k, d, u)) continue; const p = hitPoint(d); if (dist(cx, cy, p[0], p[1]) <= r + d.r) { struck.push(d); hit(fight, d, amount, o({ centre: u.spin ? null : [cx, cy + C.knight.chest] })); } }
    } else if (s.form === "shoot") {
      shoot(fight, k, s);
    } else if (s.form === "lob") {
      lob(fight, k, s);
    }
    if (u.melee) {
      // split, off a projectile: each attack also hits a second target within reach at 50 %
      if (u.mods.has("split")) {
        const near = struckBy(fight).filter(d => !struck.includes(d) && canHit(fight, k, d, u)).map(d => { const p = hitPoint(d); return [dist(ox, oy, p[0], p[1]) - d.r, d]; }).filter(e => e[0] <= u.reach).sort((a, b) => a[0] - b[0] || a[1].i - b[1].i)[0];
        const d = near ? near[1] : struck[0];
        if (d) { if (near) emit(fight, Object.assign({ type: "fx", kind: "arc", from: [ox, oy], to: hitPoint(d) }, look), k); hit(fight, d, amount * C.modifiers.split.share, o({ kind: "raw", why: "split" })); }
      }
      // boomerang, off a projectile: each attack also throws a ghost copy out to 2 x reach and back at 60 %
      if (u.mods.has("boomerang")) { const B = C.modifiers.boomerang;
        addShot(fight, k, { kind: "ghost", x: ox, y: oy, a: s.a, v: B.speed, range: u.reach * B.ghost, target: null, fu: u, hand: s.hand, amount: amount * B.share, r: B.size, boomerang: true, form: s.form, ghost: true }); }
    }
  }

  // ------------------------------------------------------------------ shots
  function addShot(fight, k, p) {
    const C = data();
    const s = Object.assign({ id: fight.nextId++, fx: k.x, fy: k.y, traveled: 0, hits: [], pierce: 0, back: false, homing: 0, boomerang: false, mult: 1, split: false, ricochet: 0, bounce: 0, phasing: false, halves: false, dropping: false, dropT: 0, trail: [], done: false, form: "shoot" }, p);
    // a level's shot flies with a floor point (lx, ly) and a height (lz) above it, from its shooter's z + chest, its height changing by ldz
    // a px (design pass 12, section 3.2b); zf is the shooter's z (a shot fired from above the ground is not stopped by the view's walls)
    if (fight.level && s.kind !== "shell") { if (s.lx === undefined) { s.lx = s.x; s.ly = k.y; s.lz = (k.z || 0) + C.knight.chest; s.ldz = 0; } if (s.zf === undefined) s.zf = k.z || 0; }
    fight.shots.push(s);
    while (fight.shots.length > C.caps.shots) fight.shots.shift();
    return s;
  }
  function shoot(fight, k, s) {
    const C = data(), u = s.fu, M = C.modifiers, [x, y] = tip(fight, k);
    const SP = Object.assign({}, M.spread, (u.over || {}).spread || {}), n = u.mods.has("spread") ? SP.shots : 1, fan = SP.fan * RAD;
    let a0 = s.a; if (s.target) { const hp = hitPoint(s.target); a0 = Math.atan2(hp[1] - y, hp[0] - x); }
    if (fight.level && s.target) a0 = Math.atan2(s.target.y - k.y, s.target.x - x);   // a level: aimed on the floor plane
    for (let i = 0; i < n; i++) {
      const a = a0 + (n > 1 ? (i - (n - 1) / 2) * fan / (n - 1) : 0);
      const p = addShot(fight, k, { kind: u.shotKind, x, y, a, v: u.pspeed, range: u.shot * (u.mods.has("bounce") ? M.bounce.travel : 1), reach: u.shot, target: s.target, fu: u, hand: s.hand, el: u.element, mat: u.material,
        amount: u.hit * u.K * s.charge, r: u.shotR, size: u.size, pierce: u.mods.has("pierce") ? mo(u, "pierce").through : 0, phasing: u.mods.has("phasing"),
        homing: u.mods.has("homing") ? M.homing.turn : u.mods.has("seeking") ? M.seeking.turn : 0, boomerang: u.mods.has("boomerang"), mult: n > 1 ? SP.each : 1,
        split: u.mods.has("split"), ricochet: u.mods.has("ricochet") ? M.ricochet.turns : 0, bounce: u.mods.has("bounce") ? M.bounce.walls : 0, form: s.form });
      if (fight.level && s.target) aimZ(p, s.target);
      emit(fight, { type: "shot", id: p.id, kind: p.kind, x, y, a, el: u.element }, k);
    }
  }
  function nearest(fight, x, y, except, within) {
    let b = null, bd = Infinity;
    for (const d of struckBy(fight)) { if (except && except.includes(d.i)) continue; if (fight.level && !inView(fight, d)) continue; const p = hitPoint(d), dd = dist(x, y, p[0], p[1]); if (dd < bd && (within === undefined || dd <= within)) { bd = dd; b = d; } }
    return b;
  }
  function lob(fight, k, s) {
    const C = data(), u = s.fu, M = C.modifiers, F = C.forms.lob, [x, y] = tip(fight, k);
    const SP = Object.assign({}, M.spread, (u.over || {}).spread || {}), n = u.mods.has("spread") ? SP.shots : 1, fan = SP.fan * RAD;
    for (let i = 0; i < n; i++) {
      const turn = n > 1 ? (i - (n - 1) / 2) * fan / (n - 1) : 0;
      let tx, ty, T;
      if (s.target) {
        const d = s.target; tx = d.x; ty = d.y;
        T = Math.max(F.minT, dist(k.x, k.y, tx, ty) / u.pspeed);
        // homing, on a lob: it lands where the target will be
        if (u.mods.has("homing") && d.rail) { const f = railAhead(d, T); tx = f; T = Math.max(F.minT, dist(k.x, k.y, tx, ty) / u.pspeed); }
      } else { tx = k.x + Math.cos(s.a) * u.lobDist; ty = k.y + Math.sin(s.a) * u.lobDist; }
      if (turn) { const dx = tx - k.x, dy = ty - k.y, c = Math.cos(turn), sn = Math.sin(turn); tx = k.x + dx * c - dy * sn; ty = k.y + dx * sn + dy * c; }
      const zs = (k.z || 0) + C.knight.chest, lh = Math.max(F.minRise, dist(k.x, k.y, tx, ty) * F.rise);   // a level: from the shooter's chest
      let tz = 0; [tx, ty, tz] = onFloor(fight, tx, ty, zs + lh);   // aimed at a wall, it lands at the nearest floor point (a level: on the surface its apex clears)
      if (fight.level && s.target && (s.target.foe || s.target.piece) && dist(tx, ty, s.target.x, s.target.y) < 1e-6) tz = s.target.z || 0;
      const d = dist(k.x, k.y, tx, ty); T = Math.max(F.minT, d / u.pspeed);
      const p = addShot(fight, k, { kind: "shell", x0: x, y0: k.y, sx: x, sy: y, x: x, y: y, tx, ty, T, age: 0, h: Math.max(F.minRise, d * F.rise), gx: x, gy: k.y, z: k.y - y, fu: u, hand: s.hand, el: u.element, mat: u.material,
        amount: u.hit * u.K * s.charge * (n > 1 ? SP.each : 1), a: Math.atan2(ty - k.y, tx - k.x), size: u.size, hops: u.mods.has("bounce") ? 1 : 0, form: "lob" });
      if (fight.level) { p.zs = zs; p.zl = tz; }
      emit(fight, { type: "shot", id: p.id, kind: "shell", x, y, a: p.a, el: u.element }, k);
    }
  }
  // where a rail dummy will be after T seconds (its slide, its stops and its pauses)
  function railAhead(d, T) {
    const R = d.rail; let x = d.x, dir = R.dir, pause = R.pause, left = T, guard = 0;
    while (left > 1e-9 && guard++ < 64) {
      if (pause > 0) { const w = Math.min(pause, left); pause -= w; left -= w; continue; }
      const edge = dir > 0 ? R.x1 : R.x0, need = Math.abs(edge - x) / R.speed;
      if (need > left) { x += dir * R.speed * left; left = 0; } else { x = edge; left -= need; dir = -dir; pause = R.wait; }
    }
    return x;
  }
  function shotsStep(fight, dt) {
    if (fight.level) return shotsStepLevel(fight, dt);
    const C = data(), M = C.modifiers, W = fight.walls, chest = C.knight.chest;
    for (const p of fight.shots) {
      if (p.done) continue;
      const k = p.fu.knight || fight.k;   // the knight that loosed it
      if (p.kind === "shell") {
        p.age += dt; const q = Math.min(1, p.age / p.T);
        p.gx = p.x0 + (p.tx - p.x0) * q; p.gy = p.y0 + (p.ty - p.y0) * q; p.z = p.h * 4 * q * (1 - q) + (1 - q) * (p.y0 - p.sy);
        p.x = p.gx; p.y = p.gy - chest - p.z;
        if (q >= 1) {
          burst(fight, p.tx, p.ty, p.fu.burst, p.amount, "lob", p.fu);
          if (p.hops > 0) {   // bounce, on a lob: it hops 48 px on and bursts again at 50 %
            p.hops--; p.amount *= M.bounce.share;
            const [nx, ny] = onFloor(fight, p.tx + Math.cos(p.a) * M.bounce.hop, p.ty + Math.sin(p.a) * M.bounce.hop);
            p.x0 = p.tx; p.y0 = p.ty; p.sx = p.tx; p.sy = p.ty; p.tx = nx; p.ty = ny; p.age = 0; p.T = C.forms.lob.minT; p.h = C.forms.lob.minRise;
          } else p.done = true;
        }
        continue;
      }
      if (p.dropping) { p.dropT += dt; if (p.dropT > C.projectiles.drop) p.done = true; continue; }
      // homing turns a shot toward its target; a boomerang on its way back flies at the knight
      if (p.homing && !p.back) { const tg = p.target && !p.hits.includes(p.target.i) ? p.target : nearest(fight, p.x, p.y, p.hits); if (tg) { const hp = hitPoint(tg), da = angDiff(Math.atan2(hp[1] - p.y, hp[0] - p.x), p.a); p.a += clamp(da, -p.homing * dt, p.homing * dt); } }
      if (p.back) { p.a = Math.atan2(k.y - chest - p.y, k.x - p.x); if (dist(p.x, p.y, k.x, k.y - chest) < C.projectiles.home) { p.done = true; continue; } }
      p.trail.unshift([p.x, p.y]); if (p.trail.length > C.projectiles.trail) p.trail.pop();
      p.x += Math.cos(p.a) * p.v * dt; p.y += Math.sin(p.a) * p.v * dt; p.traveled += p.v * dt;
      for (const d of fight.dummies) {
        if (p.hits.includes(d.i)) continue;
        const hp = hitPoint(d);
        if (dist(p.x, p.y, hp[0], hp[1]) > p.r + d.r) continue;
        p.hits.push(d.i);
        hit(fight, d, p.amount * p.mult, { form: p.form, kind: "direct", from: [p.x - Math.cos(p.a) * 10, p.y - Math.sin(p.a) * 10], floor: [p.fx, p.fy], fu: p.fu, melee: false, ghost: !!p.ghost });
        if (p.split && !p.halves) {   // on its first hit it splits into two at +-35 degrees at 50 %; the halves don't split
          p.split = false;
          for (const sgn of [-1, 1]) addShot(fight, k, { kind: p.kind, x: p.x, y: p.y, fx: p.x, fy: p.y + chest, a: p.a + sgn * M.split.angle * RAD, v: p.v, range: p.range, traveled: p.traveled, target: null, fu: p.fu, hand: p.hand, el: p.el, mat: p.mat, amount: p.amount,
            r: p.r, size: p.size, mult: p.mult * M.split.share, halves: true, hits: p.hits.slice(), form: p.form });
        }
        if (p.ghost) continue;   // a ghost copy passes through everything, once a leg
        if (p.pierce > 0) { p.pierce--; continue; }
        if (p.phasing) { p.phasing = false; continue; }   // it passes through the first target it hits
        if (p.ricochet > 0) {   // it turns to the nearest other target within 96 px, at 70 %
          const tg = nearest(fight, p.x, p.y, p.hits, M.ricochet.within);
          if (tg) { const tp = hitPoint(tg); p.ricochet--; p.mult *= M.ricochet.share; p.a = Math.atan2(tp[1] - p.y, tp[0] - p.x); p.target = tg; p.fx = p.x; p.fy = p.y + chest; p.traveled = Math.min(p.traveled, p.range - dist(p.x, p.y, tp[0], tp[1]) - 1); continue; }
        }
        if (p.boomerang && !p.back) { p.back = true; p.hits = []; break; }
        p.done = true; emit(fight, { type: "fx", kind: "star", x: p.x, y: p.y, el: p.el, mat: p.mat }, k); break;
      }
      if (p.done) continue;
      if (p.traveled >= p.range && !p.back) { if (p.boomerang) { p.back = true; p.hits = []; } else { p.dropping = true; p.dropT = 0; emit(fight, { type: "drop", id: p.id, x: p.x, y: p.y }, k); } }
      // the walls: a shot stops at one, or bounces off it up to twice
      const fy = p.y + chest;
      if (p.x < W.x0 || p.x > W.x1 || fy < W.y0 || fy > W.y1) {
        if (p.bounce > 0 && !p.back) { p.bounce--; if (p.x < W.x0 || p.x > W.x1) { p.a = Math.PI - p.a; p.x = clamp(p.x, W.x0, W.x1); } if (fy < W.y0 || fy > W.y1) { p.a = -p.a; p.y = clamp(fy, W.y0, W.y1) - chest; } p.target = null; p.fx = p.x; p.fy = p.y + chest; emit(fight, { type: "fx", kind: "star", x: p.x, y: p.y, el: p.el, mat: p.mat }, k); }
        else if (!p.back) { p.done = true; emit(fight, { type: "fx", kind: "star", x: clamp(p.x, W.x0, W.x1), y: clamp(fy, W.y0, W.y1) - chest, el: p.el, mat: p.mat }, k); }
      }
    }
    fight.shots = fight.shots.filter(p => !p.done);
  }
  // a level's shots (design pass 12, sections 3.2 and 3.2b): a floor point and a height; a shot hits a troll or a piece when the floor
  // distance is within the radii and its height inside the body's span (over a body in a trench from outside it only along the trench),
  // a level's dummy as in the cellar; it stops on a solid taller than its height (never a thin one), on a slab, on a surface it comes down
  // to, and at the view's edge (unless fired by or at a body above the ground), which nothing bounces off; a bounce shot turns off a piece
  // that stops shots. A lob lands on its surface
  function shotsStepLevel(fight, dt) {
    const C = data(), M = C.modifiers, W = fight.walls, P = phys(), Wd = fight.world;
    for (const p of fight.shots) {
      if (p.done) continue;
      const k = p.fu.knight || fight.k;
      if (p.kind === "shell") {
        p.age += dt; const q = Math.min(1, p.age / p.T);
        p.gx = p.x0 + (p.tx - p.x0) * q; p.gy = p.y0 + (p.ty - p.y0) * q; p.z = p.h * 4 * q * (1 - q) + (1 - q) * p.zs + q * p.zl;
        p.x = p.gx; p.y = p.gy - p.z;
        if (q >= 1) {
          burst(fight, p.tx, p.ty, p.fu.burst, p.amount, "lob", p.fu, { zs: p.zl });
          if (p.hops > 0) {   // bounce, on a lob: it hops 48 px on and bursts again at 50 %
            p.hops--; p.amount *= M.bounce.share;
            const [nx, ny, nz] = onFloor(fight, p.tx + Math.cos(p.a) * M.bounce.hop, p.ty + Math.sin(p.a) * M.bounce.hop, p.zl + C.forms.lob.minRise);
            p.x0 = p.tx; p.y0 = p.ty; p.sx = p.tx; p.sy = p.ty; p.tx = nx; p.ty = ny; p.zs = p.zl; p.zl = nz; p.age = 0; p.T = C.forms.lob.minT; p.h = C.forms.lob.minRise;
          } else p.done = true;
        }
        continue;
      }
      if (p.dropping) { p.dropT += dt; if (p.dropT > C.projectiles.drop) p.done = true; continue; }
      if (p.homing && !p.back) { const tg = p.target && !p.hits.includes(p.target.i) ? p.target : nearest(fight, p.x, p.y, p.hits); if (tg) { const da = angDiff(Math.atan2(tg.y - p.ly, tg.x - p.lx), p.a); p.a += clamp(da, -p.homing * dt, p.homing * dt); } }
      if (p.back) { p.a = Math.atan2(k.y - p.ly, k.x - p.lx); p.ldz = 0; if (dist(p.lx, p.ly, k.x, k.y) < C.projectiles.home) { p.done = true; continue; } }
      p.trail.unshift([p.x, p.y]); if (p.trail.length > C.projectiles.trail) p.trail.pop();
      const ox = p.lx, oy = p.ly, oz = p.lz;
      p.lx += Math.cos(p.a) * p.v * dt; p.ly += Math.sin(p.a) * p.v * dt; p.lz += p.ldz * p.v * dt; p.traveled += p.v * dt;
      p.x = p.lx; p.y = p.ly - p.lz;
      for (const d of targets(fight)) {
        if (p.hits.includes(d.i)) continue;
        // the archer tower is struck by a shot aimed at it; any other ground shot passes under its deck and between its legs
        if (d.piece && d.kind === "tower" && p.target !== d) continue;
        if (d.foe || d.piece) { if (Math.hypot(p.lx - d.x, p.ly - d.y) > p.r + d.r || p.lz < (d.z || 0) - 1e-9 || p.lz > (d.z || 0) + (d.h || d.ht || 24) + 1e-9 || trenchCover(fight, p, d)) continue; }
        else { const hp = hitPoint(d); if (dist(p.x, p.y, hp[0], hp[1]) > p.r + d.r) continue; }
        p.hits.push(d.i);
        hit(fight, d, p.amount * p.mult, { form: p.form, kind: "direct", from: [p.x - Math.cos(p.a) * 10, p.y - Math.sin(p.a) * 10], floor: [p.fx, p.fy], fu: p.fu, melee: false, ghost: !!p.ghost });
        if (p.split && !p.halves) {   // on its first hit it splits into two at +-35 degrees at 50 %; the halves don't split
          p.split = false;
          for (const sgn of [-1, 1]) addShot(fight, k, { kind: p.kind, x: p.x, y: p.y, fx: p.lx, fy: p.ly, lx: p.lx, ly: p.ly, lz: p.lz, ldz: 0, zf: p.zf, a: p.a + sgn * M.split.angle * RAD, v: p.v, range: p.range, traveled: p.traveled, target: null, fu: p.fu, hand: p.hand, el: p.el, mat: p.mat, amount: p.amount,
            r: p.r, size: p.size, mult: p.mult * M.split.share, halves: true, hits: p.hits.slice(), form: p.form });
        }
        if (p.ghost) continue;
        if (p.pierce > 0) { p.pierce--; continue; }
        if (p.phasing) { p.phasing = false; continue; }
        if (p.ricochet > 0) {
          const tg = nearest(fight, p.x, p.y, p.hits, M.ricochet.within);
          if (tg) { p.ricochet--; p.mult *= M.ricochet.share; p.a = Math.atan2(tg.y - p.ly, tg.x - p.lx); p.target = tg; p.fx = p.lx; p.fy = p.ly; aimZ(p, tg); p.traveled = Math.min(p.traveled, p.range - dist(p.lx, p.ly, tg.x, tg.y) - 1); continue; }
        }
        if (p.boomerang && !p.back) { p.back = true; p.hits = []; break; }
        p.done = true; emit(fight, { type: "fx", kind: "star", x: p.x, y: p.y, el: p.el, mat: p.mat }, k); break;
      }
      if (p.done) continue;
      if (p.traveled >= p.range && !p.back) { if (p.boomerang) { p.back = true; p.hits = []; } else { p.dropping = true; p.dropT = 0; emit(fight, { type: "drop", id: p.id, x: p.x, y: p.y }, k); if (fight.marks && p.kind === "arrow") { const s = P.surfaceAt(Wd, p.lx, p.ly, 1e9); stuck(fight, p.lx, p.ly, s ? s.z : 0, s && s.plat ? s.plat.id : null, null, "arrow"); } continue; } }
      const stop = p.back ? null : P.shotStop(Wd, p.lx, p.ly, p.lz, oz);
      if (stop) {
        if (stop.solid && p.bounce > 0) {   // bounce: it turns off the piece and flies on, aimed at nothing
          const n = faceOf(stop.solid, ox, oy), dd = Math.cos(p.a) * n[0] + Math.sin(p.a) * n[1];
          p.bounce--; p.a = Math.atan2(Math.sin(p.a) - 2 * dd * n[1], Math.cos(p.a) - 2 * dd * n[0]); p.lx = ox; p.ly = oy; p.lz = oz; p.ldz = 0; p.x = p.lx; p.y = p.ly - p.lz; p.target = null; p.fx = p.lx; p.fy = p.ly;
          emit(fight, { type: "fx", kind: "star", x: p.x, y: p.y, el: p.el, mat: p.mat }, k);
        } else {
          p.done = true; p.stop = stop.solid ? stop.solid.kind : "ground"; emit(fight, { type: "fx", kind: "star", x: p.x, y: p.y, el: p.el, mat: p.mat }, k);
          if (fight.marks && p.kind === "arrow") { const pc = stop.solid && stop.solid.piece && !stop.solid.piece.gone ? stop.solid.piece : null; stuck(fight, stop.solid ? ox : p.lx, stop.solid ? oy : p.ly, pc ? p.lz : (stop.surface || 0), stop.plat ? stop.plat.id : null, pc, "arrow"); }   // a knight's arrow sticks where it stops (section 3.6a)
        }
        continue;
      }
      // the view's walls: a shot fired by or at a body above the ground flies on by the height rules (its stops above, and its range)
      if (!p.back && !(p.zf > 0 || (p.target && (p.target.z || 0) > 0)) && (p.lx < W.x0 || p.lx > W.x1 || p.ly < W.y0 || p.ly > W.y1)) { p.done = true; p.stop = "edge"; emit(fight, { type: "fx", kind: "star", x: clamp(p.x, W.x0, W.x1), y: p.y, el: p.el, mat: p.mat }, k); }
    }
    fight.shots = fight.shots.filter(p => !p.done);
    foeShotsStep(fight, dt);
  }
  // a shot aimed at a body: its height changes linearly to meet the body's chest at the aimed distance, and keeps that slope after
  function aimZ(p, t) { const fd = Math.hypot(t.x - p.lx, t.y - p.ly); p.ldz = fd > 1e-6 ? ((t.z || 0) + (t.chest || 0) - p.lz) / fd : 0; }
  // the face of a solid a shot met, from where the shot was the step before: the outward normal there
  function faceOf(s, x, y) {
    if (s.shape === "c") { const dx = x - s.x, dy = y - s.y, d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d]; }
    if (s.shape === "hp") { const L = Math.hypot(s.ax, s.ay); return [-s.ax / L, -s.ay / L]; }
    const qx = clamp(x, s.x0, s.x1), qy = clamp(y, s.y0, s.y1), dx = x - qx, dy = y - qy, d = Math.hypot(dx, dy);
    if (d > 1e-9) return [dx / d, dy / d];
    const c = [x - s.x0, s.x1 - x, y - s.y0, s.y1 - y], m = Math.min(...c);
    return m === c[0] ? [-1, 0] : m === c[1] ? [1, 0] : m === c[2] ? [0, -1] : [0, 1];
  }
  // the trench's cover (design pass 12, sections 3.2b and 3.3): a shot from outside a trench flies over a body standing in it unless its
  // line runs within 30 degrees of the trench's length
  function trenchCover(fight, p, d) {
    if (!(d.z < 0) || d.on) return false;
    const H = phys().groundAt(fight.world, d.x, d.y).hole;
    if (!H || !H.shotCover || H.shape !== "r") return false;
    const sx = p.fx !== undefined ? p.fx : p.x0, sy = p.fy !== undefined ? p.fy : p.y0;
    if (sx >= H.x0 && sx < H.x1 && sy >= H.y0 && sy < H.y1) return false;
    const along = H.x1 - H.x0 >= H.y1 - H.y0 ? 0 : Math.PI / 2, off = Math.abs(angDiff(p.a, along)), fold = Math.min(off, Math.PI - off);
    return fold > (H.shotCover.alongWithin || 30) * RAD + 1e-9;
  }
  // a burst on the floor at (x, y): everything whose chest is within r of the point at chest height
  function burst(fight, x, y, r, amount, form, fu, o) {
    const C = data(), chest = C.knight.chest, zs = fight.level ? (o && o.zs !== undefined ? o.zs : ((fu.knight || fight.k).z || 0)) : 0;
    emit(fight, fight.level ? { type: "fx", kind: "blast", x, y, r, el: fu.element, z: zs } : { type: "fx", kind: "blast", x, y, r, el: fu.element }, fu.knight);
    emit(fight, { type: "shake", amp: (C.forms[form] || {}).shake || 3, time: C.feel.shakeT }, fu.knight);
    if (fight.marks && form === "lob") stamp(fight, "scorch", x, y, (C.marks.scorch || {}).lob || 4, zs);   // a lob's burst scorches the ground (section 3.6a)
    fight.live.push({ type: "circle", x, y: y - chest, r });
    for (const d of targets(fight)) { if (fight.level && !atZ(d, zs, C.physics.z.burst)) continue; const p = hitPoint(d); if (dist(x, y - chest, p[0], p[1]) <= r + d.r) hit(fight, d, amount, Object.assign({ form, kind: "direct", from: [x, y - chest - 8], fu, melee: false, centre: [x, y] }, o || {})); }
  }
  // standing (alive, not broken) within zr of a surface's height z: a burst's reach (design pass 12, section 3.2b)
  const atZ = (d, z, zr) => !(d.foe && d.dead) && !(d.piece && (d.gone || !d.active)) && Math.abs((d.z || 0) - z) <= zr + 1e-9;

  // ------------------------------------------------------------------ the stream: a cone while held (and a legend's gout)
  function cone(fight, S, fu, per, statusBase) {
    const half = fu.half * RAD, L = fu.streamLen, arms = [S.a];
    if (fu.mods.has("twin")) arms.push(S.a + data().forms.stream.twinOff * RAD);   // twin: a second cone 30 degrees off
    S.arms = arms;
    for (const a of arms) fight.live.push({ type: "cone", x: S.x, y: S.y, a, half, len: L });
    if (per === null) return;
    const sk = fu.knight || fight.k, zr = data().physics.z.stream;
    for (const d of targets(fight)) { if (!canHit(fight, sk, d, fu, zr)) continue; const p = hitPoint(d), dd = dist(S.x, S.y, p[0], p[1]), a = Math.atan2(p[1] - S.y, p[0] - S.x);
      let inside = 0; for (const arm of arms) if (dd <= L + d.r && Math.abs(angDiff(a, arm)) <= half + Math.atan2(d.r, Math.max(1, dd))) inside++;
      for (let i = 0; i < inside; i++) hit(fight, d, per, { form: "stream", kind: "tick", from: [S.x, S.y], fu, sum: true, share: statusBase }); }
  }
  function streamStep(fight, k, dt, inp) {
    const C = data(), F = C.forms.stream;
    if (!k.streamOn) { k.stream = null; return; }
    const hand = k.hands[k.active], u = hand.u;
    k.holdT += dt;
    const charging = u.mods.has("charge") && k.holdT < F.chargeT;   // charge, on a stream: the first 0.6 s sputters, then it flows at x 1.5
    const am = aim(fight, u, inp.target, undefined, k);
    k.face = am.a;
    if (!k.stream) k.stream = { tick: 0 };
    const S = k.stream; S.charging = charging; S.el = u.element; S.half = u.half; S.len = u.streamLen;
    const [ox, oy] = tip(fight, k);
    S.x = ox; S.y = oy;
    S.a = am.d ? (hp => Math.atan2(hp[1] - oy, hp[0] - ox))(hitPoint(am.d)) : am.a;
    S.tick = charging ? 0 : S.tick + dt;   // the ticks start when the stream flows
    let per = null;
    if (S.tick >= F.tick - 1e-9) { S.tick = 0; per = u.hit * u.K * u.rate * F.tick * (u.mods.has("charge") ? F.chargeX : 1); }
    cone(fight, S, u, per, u.rate * F.tick);
    if (k.holdT >= u.hold - 1e-9) { stopStream(fight, k); hand.recover = F.recover; hand.recoverOf = F.recover; emit(fight, { type: "recover", what: "stream", hand: k.active, time: F.recover }, k); }
  }
  function startGout(fight, k, fu, want, charge) {
    const am = aim(fight, fu, want, undefined, k);
    k.face = am.a;
    k.gout = { t: 0, T: data().forms.stream.gout, tick: 0, a: am.a, target: am.d, fu, charge: charge || 1, el: fu.element, half: fu.half, len: fu.streamLen };
    emit(fight, { type: "strike", form: "stream", hand: k.active, second: fu.isSecond, twin: false, a: am.a, target: am.d ? am.d.i : null, charge: charge || 1 }, k);
    return true;
  }
  function goutStep(fight, k, dt) {
    const C = data(), G = k.gout, F = C.forms.stream;
    if (!G) return;
    G.t += dt; G.tick += dt;
    const [ox, oy] = tip(fight, k);
    G.x = ox; G.y = oy;
    if (G.target) { const hp = hitPoint(G.target); G.a = Math.atan2(hp[1] - oy, hp[0] - ox); }
    let per = null;
    if (G.tick >= F.tick - 1e-9) { G.tick = 0; per = G.fu.hit * G.fu.K * G.fu.rate * F.tick * G.charge; }
    cone(fight, G, G.fu, per, G.fu.rate * F.tick);
    if (G.t >= G.T - 1e-9) k.gout = null;
  }

  // ------------------------------------------------------------------ orbit, field, trap, summon
  function startOrbit(fight, k, hand, fu, charge) {
    if (hand.orbit || hand.recover > 0) return false;
    const n = fu.bodies * (fu.mods.has("twin") ? 2 : 1);   // twin: twice the bodies
    hand.orbit = { t: 0, life: fu.active, phase: 0, n, hits: {}, fu, charge: charge || 1, pos: [] };
    emit(fight, { type: "orbit", hand: k.hands.indexOf(hand), bodies: n, life: fu.active }, k);
    return true;
  }
  function orbitsStep(fight, k, dt) {
    const C = data(), F = C.forms.orbit;
    k.hands.forEach((hand, hi) => {
      const O = hand.orbit; if (!O) return;
      const u = O.fu;
      O.t += dt; O.phase += u.orbitW * dt;
      O.pos = [];
      for (let i = 0; i < O.n; i++) { const a = O.phase + i * TAU / O.n; O.pos.push([k.x + Math.cos(a) * u.orbitR, k.y + Math.sin(a) * u.orbitR]); }
      fight.live.push({ type: "ring", x: k.x, y: k.y - 10, r: u.orbitR });
      O.pos.forEach((p, i) => { for (const d of targets(fight)) { if (!canHit(fight, k, d, u)) continue; const key = i + ":" + d.i, last = O.hits[key] === undefined ? -9 : O.hits[key];
        if (dist(p[0], p[1], d.x, d.y) <= u.touch + d.r && O.t - last >= F.again) { O.hits[key] = O.t; hit(fight, d, u.hit * u.K * O.charge, { form: "orbit", kind: "direct", from: [p[0], p[1] - 10], floor: p, fu: u, melee: false }); } } });
      if (O.t >= O.life - 1e-9) { hand.orbit = null; hand.recover = F.recover; hand.recoverOf = F.recover; emit(fight, { type: "recover", what: "orbit", hand: hi, time: F.recover }, k); }
    });
  }
  function startAura(fight, k, hand, fu, charge) {
    if (hand.aura || hand.recover > 0) return false;
    hand.aura = { t: 0, life: fu.active, next: data().forms.field.first, again: -1, pulse: -1, fu, charge: charge || 1 };
    emit(fight, { type: "field", hand: k.hands.indexOf(hand), r: fu.fieldR, life: fu.active }, k);
    return true;
  }
  function aurasStep(fight, k, dt) {
    const C = data(), F = C.forms.field;
    k.hands.forEach((hand, hi) => {
      const A = hand.aura; if (!A) return;
      const u = A.fu;
      A.t += dt; A.next -= dt; if (A.again >= 0) A.again -= dt;
      fight.live.push({ type: "floorcircle", x: k.x, y: k.y, r: u.fieldR });
      const pulse = () => { A.pulse = A.t; emit(fight, { type: "pulse", hand: hi, x: k.x, y: k.y, r: u.fieldR, el: u.element }, k);
        for (const d of targets(fight)) if (canHit(fight, k, d, u, C.physics.z.burst) && dist(k.x, k.y, d.x, d.y) <= u.fieldR + d.r) hit(fight, d, u.hit * u.K * A.charge, { form: "field", kind: "direct", from: [k.x, k.y - C.knight.chest], fu: u, melee: false, centre: [k.x, k.y], own: true }); };
      if (A.next <= 1e-9) { A.next += 1 / u.rate; pulse(); if (u.mods.has("twin")) A.again = F.twinGap; }   // twin: a double pulse
      else if (A.again >= 0 && A.again <= 1e-9) { A.again = -1; pulse(); }
      if (A.t >= A.life - 1e-9) { hand.aura = null; hand.recover = F.recover; hand.recoverOf = F.recover; emit(fight, { type: "recover", what: "field", hand: hi, time: F.recover }, k); }
    });
  }
  function placeTrap(fight, k, hand, fu, want, charge) {
    const C = data(), F = C.forms.trap;
    if (hand.cd > 0) return false;
    const twin = fu.mods.has("twin"), cap = twin ? Math.min(F.maxTwin, C.caps.trapsTwin) : Math.min(F.max, C.caps.traps);
    const am = aim(fight, fu, want, undefined, k);
    k.face = am.a;
    const spots = [[k.x + Math.cos(am.a) * fu.throwD, k.y + Math.sin(am.a) * fu.throwD]];
    if (twin) spots.push([spots[0][0] - Math.sin(am.a) * F.twinOff, spots[0][1] + Math.cos(am.a) * F.twinOff]);   // twin: two at a time
    for (const s of spots) {
      const [tx, ty, tz] = onFloor(fight, s[0], s[1], (k.z || 0) + C.knight.chest);   // aimed at a wall, it lands at the nearest floor point
      fight.traps.push(fight.level ? { id: fight.nextId++, x0: k.x, y0: k.y - C.knight.chest, x: tx, y: ty, z: tz, t: 0, armed: false, sprung: -1, fu, charge: charge || 1, owner: k.hands.indexOf(hand) }
        : { id: fight.nextId++, x0: k.x, y0: k.y - C.knight.chest, x: tx, y: ty, t: 0, armed: false, sprung: -1, fu, charge: charge || 1, owner: k.hands.indexOf(hand) });
      emit(fight, { type: "place", x: tx, y: ty }, k);
    }
    const set = t => t.sprung < 0 && t.fu.knight === k;   // each knight's own traps count against its cap
    while (fight.traps.filter(set).length > cap) { const old = fight.traps.find(set); fight.traps.splice(fight.traps.indexOf(old), 1); }   // the oldest goes
    hand.cd = Math.max(1 / fu.rate, F.gap);
    return true;
  }
  function trapsStep(fight, dt) {
    const F = data().forms.trap;
    for (const tr of fight.traps) {
      tr.t += dt;
      if (tr.sprung >= 0) { tr.sprung += dt; continue; }
      if (!tr.armed && tr.t >= F.arm - 1e-9) { tr.armed = true; emit(fight, { type: "armed", x: tr.x, y: tr.y }, tr.fu.knight); }
      if (tr.armed) for (const d of fight.level ? targets(fight).filter(x => !x.piece && atZ(x, tr.z, data().physics.z.burst)) : fight.dummies) if (dist(tr.x, tr.y, d.x, d.y) <= F.spring + d.r) {
        tr.sprung = 0; emit(fight, { type: "spring", x: tr.x, y: tr.y, d: d.i }, tr.fu.knight);
        burst(fight, tr.x, tr.y, tr.fu.burst, tr.fu.hit * tr.fu.K * tr.charge, "trap", tr.fu, fight.level ? { zs: tr.z } : undefined); break; }
      if (tr.sprung < 0 && tr.t > tr.fu.life) { tr.sprung = 99; emit(fight, { type: "expire", what: "trap", x: tr.x, y: tr.y }, tr.fu.knight); }
    }
    fight.traps = fight.traps.filter(tr => tr.sprung < F.shut);
  }
  function summon(fight, k, hand, fu, charge) {
    const C = data(), F = C.forms.summon, hi = k.hands.indexOf(hand);
    const cap = Math.min(fu.mods.has("twin") ? F.maxTwin : F.max, C.caps.minions), mine = fight.minions.filter(m => m.owner === hi && m.fu.knight === k).length;
    if (mine >= cap) return false;
    const n = fu.mods.has("twin") ? cap - mine : 1;   // twin: one press calls both
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? -1 : 1, [x, y] = onFloor(fight, k.x + side * F.beside[0], k.y + F.beside[1], (k.z || 0) + C.knight.chest);
      if (fight.level) { const m = { id: fight.bodyId++, x, y, t: 0, life: fu.life, cd: 0, fu, charge: charge || 1, swing: 0, walkT: 0, face: 1, owner: hi, body: true, minion: true, st: {} };
        bodyOf(m, Object.assign({ speed: fu.mspeed }, MINION), false); surfaceOf(fight, m); fight.minions.push(m); }
      else fight.minions.push({ id: fight.nextId++, x, y, t: 0, life: fu.life, cd: 0, fu, charge: charge || 1, swing: 0, walkT: 0, face: 1, owner: hi });
      emit(fight, { type: "summon", x, y }, k);
    }
    return true;
  }
  function minionsStep(fight, dt) {
    const F = data().forms.summon;
    if (fight.level) return;   // a level's minions are bodies: they moved and struck with the others (levelStep)
    for (const m of fight.minions) {
      m.t += dt; m.cd -= dt; if (m.swing > 0) m.swing -= dt;
      let d = null, bd = Infinity;   // the nearest dummy, by its feet
      for (const x of fight.dummies) { const dd = dist(m.x, m.y, x.x, x.y); if (dd < bd) { bd = dd; d = x; } }
      if (d) {
        const side = d.r + F.stand, sx = d.x + (m.x <= d.x ? -side : side), dd = dist(m.x, m.y, sx, d.y);
        m.face = d.x >= m.x ? 1 : -1;
        if (dd > m.fu.minionReach) { const a = Math.atan2(d.y - m.y, sx - m.x), go = Math.min(m.fu.mspeed * dt, dd - m.fu.minionReach + 0.01); m.x += Math.cos(a) * go; m.y += Math.sin(a) * go; m.walkT += dt; }
        else if (m.cd <= 0) { m.cd = 1 / m.fu.rate; m.swing = F.swing; hit(fight, d, m.fu.hit * m.fu.K * m.charge, { form: "summon", kind: "direct", from: [m.x, m.y - 6], floor: [m.x, m.y], fu: m.fu, melee: false }); }
      }
      if (m.t >= m.life - 1e-9) { m.gone = true; emit(fight, { type: "expire", what: "minion", x: m.x, y: m.y }, m.fu.knight); }
    }
    fight.minions = fight.minions.filter(m => !m.gone);
  }
  // a level's minions: bodies moved by the one move function toward the nearest troll (or a level's dummy; else an aim-target piece),
  // kept to the knights' box, striking within reach and 12 px of height
  function minionsLevel(fight, dt) {
    const F = data().forms.summon;
    for (const m of fight.minions) {
      m.t += dt; m.cd -= dt; if (m.swing > 0) m.swing -= dt;
      let d = null, bd = Infinity;
      for (const things of [false, true]) { if (d) break; for (const x of struckBy(fight)) { if (!!x.piece !== things || !canHit(fight, m, x, null)) continue; const dd = dist(m.x, m.y, x.x, x.y); if (dd < bd) { bd = dd; d = x; } } }
      let intent = null;
      if (d) {
        const side = d.r + F.stand, sx = d.x + (m.x <= d.x ? -side : side), dd = dist(m.x, m.y, sx, d.y);
        m.face = d.x >= m.x ? 1 : -1;
        if (dd > m.fu.minionReach) { const a = Math.atan2(d.y - m.y, sx - m.x), sp = Math.min(m.fu.mspeed, (dd - m.fu.minionReach + 0.01) / dt); intent = { wish: [Math.cos(a) * sp, Math.sin(a) * sp] }; m.walkT += dt; }
        else if (m.cd <= 0) { m.cd = 1 / m.fu.rate; m.swing = F.swing; hit(fight, d, m.fu.hit * m.fu.K * m.charge, { form: "summon", kind: "direct", from: [m.x, m.y - 6], floor: [m.x, m.y], fu: m.fu, melee: false }); }
      }
      moveBody(fight, m, intent ? { intent } : null, dt);
      if (m.t >= m.life - 1e-9) { m.gone = true; emit(fight, { type: "expire", what: "minion", x: m.x, y: m.y }, m.fu.knight); }
    }
    fight.minions = fight.minions.filter(m => !m.gone);
  }

  // ------------------------------------------------------------------ patches on the floor (ignite_ground, frost_trail)
  function patch(fight, kind, x, y, r, life, fu) {
    const C = data(), P = C.patch;
    const near = fight.patches.find(p => p.kind === kind && dist(p.x, p.y, x, y) <= P.merge);
    if (near) { near.t = 0; near.life = Math.max(near.life, life); near.fu = fu; return near; }   // a patch on a patch renews it
    const p = { id: fight.nextId++, kind, x, y, r, t: 0, life, tick: 0, fu };
    fight.patches.push(p);
    const cap = kind === "fire" ? C.caps.fire : C.caps.frost, mine = fight.patches.filter(q => q.kind === kind);
    if (mine.length > cap) { const old = mine[0]; fight.patches.splice(fight.patches.indexOf(old), 1); if (old.cover) phys().removeCover(fight.world, old.cover); }   // the oldest goes
    // in a level a knight's frost patch is slippery to trolls only (section 3.6a): ice cover that acts on foes alone; its fire patch is a fire
    // mark too, on the knights' side: fire cover the trolls' fields path round, and it meets ice and puddles (marksStep) and goes on a wipe
    if (fight.marks) { p.on = (fu.knight || fight.k).on || null; p.cover = phys().addCover(fight.world, { kind: kind === "frost" ? "ice" : "fire", only: "foe", shape: "c", x, y, r, on: p.on, patch: p }); }
    emit(fight, { type: "patch", kind, x, y, r }, fu.knight);
    return p;
  }
  // a knight's patch taken off the floor before its time (a crater opens under it, fire meets ice or a puddle, a wipe): its cover goes with it
  function endPatch(fight, p) { const i = fight.patches.indexOf(p); if (i < 0) return false; fight.patches.splice(i, 1); if (p.cover) { phys().removeCover(fight.world, p.cover); p.cover = null; } return true; }
  function patchesStep(fight, dt) {
    const C = data(), M = C.modifiers, P = C.patch;
    for (const d of fight.dummies) d.chill = false;
    for (const p of fight.patches) {
      p.t += dt; p.tick += dt;
      const inside = d => dist(p.x, p.y, d.x, d.y) <= p.r + d.r * 0.5;
      const under = fight.level ? targets(fight).filter(d => !d.piece) : fight.dummies;
      if (p.kind === "fire") { if (p.tick >= P.tick - 1e-9) { p.tick = 0; for (const d of under) if (inside(d)) dot(fight, d, p.fu.hit * M.ignite_ground.rate * P.tick, "fire", p.fu.knight); } }
      else for (const d of under) if (inside(d)) d.chill = true;   // frost slows what stands in it
    }
    if (fight.marks) for (const p of fight.patches) if (p.cover && p.t >= p.life) { phys().removeCover(fight.world, p.cover); p.cover = null; }
    fight.patches = fight.patches.filter(p => p.t < p.life);
  }

  // ------------------------------------------------------------------ a hit (pass 7 section 3.8.4)
  // damage = the blow x the modifiers' factors x crit x affinity x 1.25 if the dummy is marked x combo x charge
  // o: { form, kind: direct | tick | raw, from, fu, melee, sum, centre, share, why }
  //   direct: a blow, a shot, a touch, a pulse: crits, combo, statuses, pushes, jumps
  //   tick:   a stream's quarter second: statuses and pushes by its share of a blow, no crit
  //   raw:    a jump (chain, shock, ricochet, split, explode): affinity and mark only; no statuses, and it doesn't jump again
  function affinity(d, form, element, u) {
    const A = data().affinity;
    let m = 1;
    const pierce = u.mods.has("pierce");   // pierce ignores resistance, but not immunity
    for (const key of [form, element]) { if (!key) continue; if (d.weak.includes(key)) m *= A.weak; if (d.resist.includes(key) && !pierce) m *= A.resist; }
    if (d.immune.includes(element)) m *= u.mods.has("phasing") ? data().modifiers.phasing.immune : A.immune;
    return m;
  }
  function hit(fight, d, base, o) {
    const C = data(), u = o.fu, k = u.knight || fight.k, M = C.modifiers, FEEL = C.feel;   // k: the knight whose weapon struck
    if ((d.foe && d.dead) || (d.piece && (d.gone || !d.active))) return null;   // a level's troll or piece already struck down
    // the ram's blow on the gate, a hut, the tower or an engine is flat (design pass 12, section 3.4): no affinity, crit, mark or combo
    const flat = d.piece && u.ram ? u.ram.vs[RAM_VS[d.kind]] : undefined;
    const mult = flat !== undefined ? 1 : affinity(d, o.form, u.element, u);
    let dmg = flat !== undefined ? flat : base * mult, tag = mult > 1.01 ? "WEAK" : mult === 0 ? "IMMUNE" : mult < 0.99 ? "RESIST" : null, crit = false;
    const direct = o.kind === "direct";
    if (d.foe && d.staggered) { dmg *= takenX(d); if (!tag) tag = "STAGGER"; }   // a staggered brute takes x 1.25 from every hit (section 3.5)
    if (flat === undefined) {
      if (direct && fight.crits && u.crit > 0 && fight.rand() < u.crit) { dmg *= u.critX; crit = true; }
      if (d.st.mark) dmg *= C.statuses.mark.more;
      if (u.mods.has("combo") && direct) {   // the third hit in a row on the same target within 1.5 s deals x 2, then the count restarts
        if (d.combo && fight.t - d.combo.t < M.combo.within) d.combo.n++; else d.combo = { n: 1 };
        d.combo.t = fight.t;
        if (d.combo.n >= M.combo.hits) { dmg *= M.combo.x; tag = "COMBO"; d.combo = null; }
      }
    }
    const hp = hitPoint(d), from = o.from || chestOf(k), seen = Math.atan2(hp[1] - from[1], hp[0] - from[0]);
    // a push goes along the floor, away from where the blow came from: the knight, where a shot was loosed, a burst's centre, a mote,
    // a minion (heights are drawn up the screen, so the line from a raised tip to a chest is not the way the blow travels)
    const foot = o.centre || o.floor || [k.x, k.y], ang = Math.hypot(d.x - foot[0], d.y - foot[1]) > 1e-6 ? Math.atan2(d.y - foot[1], d.x - foot[0]) : seen;
    const share = o.kind === "tick" ? (o.share || 1) : 1;   // a stream's tick pushes and afflicts by its share of a blow
    let push = direct || o.kind === "tick" ? u.push * share * (u.statuses.includes("knockback") ? C.statuses.knockback.push : 1) : 0;
    // bounce, off a projectile: a target pushed into a wall or a rail stop takes 25 % more
    if (u.mods.has("bounce") && direct && o.form !== "shoot" && o.form !== "lob" && push > 0 && d.rail && !d.st.freeze && !d.st.stun) {
      const nx = d.x + Math.cos(ang) * push; if (nx > d.rail.x1 || nx < d.rail.x0) { dmg *= M.bounce.wall; if (!tag) tag = "WALL"; }
    }
    // in a level the wall is any solid: the troll's circle swept along the push for push / mass px meets one (section 3.2a)
    else if (d.foe && u.mods.has("bounce") && direct && o.form !== "shoot" && o.form !== "lob" && push > 0 && !d.st.freeze && !d.st.stun && sweeps(fight, d, ang, push / phys().massOf(d))) { dmg *= M.bounce.wall; if (!tag) tag = "WALL"; }
    const at = d.foe || d.piece ? drawnAt(d) : hp;
    const e = emit(fight, { type: "hit", d: d.i, dummy: d.kind, amount: dmg, tag, crit, form: o.form, element: u.element, kind: o.kind, why: o.why || null, x: at[0], y: at[1], melee: !!o.melee,
      hold: direct && o.melee ? (crit ? FEEL.holdCrit : FEEL.hold) : 0, sum: !!o.sum }, k);
    log(fight, d, dmg);
    // a level: a piece takes its hit points and nothing else (statuses do not act on it); a troll takes its hit points, then the rest
    if (d.piece) { if (direct) d.flash = FEEL.flash; damage(fight, d, dmg, null, foot, k); return e; }
    if (d.foe) damage(fight, d, dmg, o.why || null, null, k, o.kind);
    if (mult === 0) return e;   // immune: nothing of the blow lands
    if (o.kind === "raw") { d.flash = FEEL.flash; if (!d.rail && !d.arm) d.wv += C.wobble.raw; return e; }
    if (direct) d.flash = FEEL.flash;
    // the push and the pull: the rail dummy slides along its rail, the quintain's arm turns (0.15 rad/s per point of damage, 0.1 per
    // pixel of push), a dummy on a post wobbles
    const pull = u.mods.has("pull") ? mo(u, "pull").px * share : 0, to = o.centre && !o.own ? o.centre : [k.x, k.y], Q = C.dummies.quintain, W = C.wobble;
    if (d.foe) {   // a troll: the push is an impulse by its mass, a pull an impulse toward the knight (a hit knocks a climber off its ladder)
      const P = phys(), Wd = fight.world;
      if (!d.dead && push > 0) P.push(Wd, d, Math.cos(ang), Math.sin(ang), push);
      if (!d.dead && pull > 0) { const px = to[0] - d.x, py = to[1] - d.y, pd = Math.hypot(px, py); if (pd > 1e-6) P.push(Wd, d, px / pd, py / pd, Math.min(pull, pd)); }
      if (!d.dead && d.climbing && (dmg > 0 || push > 0)) P.letGo(Wd, d, true);
    }
    else if (d.rail) { if (!d.st.freeze && !d.st.stun && (push > 0 || pull > 0)) d.x = clamp(d.x + Math.cos(ang) * push + Math.sign(to[0] - d.x) * Math.min(pull, Math.abs(to[0] - d.x)), d.rail.x0, d.rail.x1); }
    else if (d.arm) { if (direct) d.arm.w += (Q.perDamage * dmg + Q.perPush * push) * (Math.sin(angDiff(ang, d.arm.a)) >= 0 ? 1 : -1); }
    else d.wv += (Math.sign(Math.cos(ang) || 1) * (W.kick + push * W.perPush) - Math.sign(to[0] - d.x) * pull * W.perPush) * W.gain * share;
    if (direct && d.puff) emit(fight, { type: "fx", kind: d.puff, x: d.puff === "sparks" ? hp[0] - Math.cos(seen) * 4 : hp[0], y: hp[1], seed: fight.steps + d.i }, k);
    // statuses
    const strength = o.kind === "tick" ? dmg / share : dmg;
    for (const s of u.statuses) { if (d.immune.includes(s)) { emit(fight, { type: "immune", d: d.i, status: s, x: hp[0], y: hp[1] }, k); continue; } applyStatus(fight, d, s, strength, u, o); }
    if (u.mods.has("sticky")) d.st.sticky = { t: M.sticky.time };   // hits slow the target 40 % for 1 s
    if (u.mods.has("vampiric")) { const v = dmg * mo(u, "vampiric").heal; emit(fight, { type: "heal", amount: v, why: "vampiric", x: k.x, y: k.y }, k); healKnight(fight, k, v); }
    if (fight.marks && d.foe && direct) {   // a level's marks (section 3.6a): a water hit leaves a puddle r 6 at the troll's feet (at most one a knight a second); a lightning hit scorch r 3
      const WA = (C.marks.puddle || {}).water || { r: 6, life: 10, every: 1.0 }, at = fight.marks.waterAt;
      if (u.element === "water" && !(at[k.seat] !== undefined && fight.t - at[k.seat] < (WA.every || 1.0) - 1e-9)) { at[k.seat] = fight.t; puddle(fight, d.x, d.y, WA.r || 6, WA.life || 10, "knight", { z: d.z, on: d.on }); }
      if (u.element === "lightning") stamp(fight, "scorch", d.x, d.y, (C.marks.scorch || {}).lightning || 3, d.z);
    }
    if (u.mods.has("ignite_ground")) patch(fight, "fire", d.x, d.y, M.ignite_ground.radius, u.statusT, u);
    if (u.mods.has("frost_trail")) patch(fight, "frost", d.x, d.y, M.frost_trail.radius, u.statusT, u);
    if (o.ghost) return e;   // a ghost copy carries the statuses; it doesn't burst or jump
    // explode, off a burst: every hit also bursts for 40 % within 15 px of the target
    if (u.mods.has("explode") && o.form !== "smash" && o.form !== "lob" && o.form !== "trap") {
      if (direct) emit(fight, { type: "fx", kind: "blast", x: d.x, y: d.y, r: M.explode.within, el: u.element, small: true }, k);
      for (const x of struckBy(fight)) if (dist(d.x, d.y, x.x, x.y) <= M.explode.within + (x === d ? 0 : x.r)) hit(fight, x, base * M.explode.share, { form: o.form, kind: "raw", why: "explode", from: [d.x, d.y - d.chest], fu: u, sum: !!o.sum });
    }
    // chain: each hit jumps to up to 2 more targets within 56 px at 50 %
    if (u.mods.has("chain")) jump(fight, d, base * M.chain.share, M.chain.jumps, M.chain.within, "chain", u, o);
    // ricochet, off a projectile: one jump at 70 % within 56 px
    if (u.mods.has("ricochet") && o.form !== "shoot") jump(fight, d, base * M.ricochet.share, 1, M.ricochet.otherWithin, "ricochet", u, o);
    return e;
  }
  // a jumped hit carries no statuses and doesn't jump again
  function jump(fight, d, amount, n, within, why, u, o) {
    const others = struckBy(fight).filter(x => x !== d).map(x => [dist(d.x, d.y, x.x, x.y), x]).filter(p => p[0] <= within).sort((a, b) => a[0] - b[0] || a[1].i - b[1].i).slice(0, n);
    let prev = d;
    for (const [, x] of others) { if (o.kind === "direct") emit(fight, { type: "fx", kind: "arc", from: hitPoint(prev), to: hitPoint(x), el: u.element, mat: u.material, seed: fight.steps + x.i }, u.knight); hit(fight, x, amount, { form: o.form, kind: "raw", why, from: hitPoint(prev), fu: u, sum: !!o.sum }); prev = x; }
  }
  // damage over time: a tick of burn, poison or bleed, or a burning patch (k: the knight that set it, when known)
  function dot(fight, d, amount, what, k) {
    const hp = d.foe || d.piece ? drawnAt(d) : hitPoint(d), dmg = amount * (d.st.mark ? data().statuses.mark.more : 1) * takenX(d);
    emit(fight, { type: "hit", d: d.i, dummy: d.kind, amount: dmg, tag: null, crit: false, form: null, element: what, kind: "dot", why: what, x: hp[0], y: hp[1], melee: false, hold: 0, sum: false }, k);
    log(fight, d, dmg);
    if (d.foe || d.piece) damage(fight, d, dmg, what, null, k, "dot");
  }
  // the ram's flat blows by the piece's kind
  const RAM_VS = { gate: "gate", hut: "hut", tent: "hut", tower: "tower", engine: "engine" };
  // does a troll's circle, swept along a push of len px at angle a, meet a solid (the wall bonus of a bounce weapon)?
  function sweeps(fight, d, a, len) {
    const W = fight.world, P = phys(), c = Math.cos(a), s = Math.sin(a), probe = { x: d.x, y: d.y, z: d.z, r: d.r, h: d.h };
    for (let t = 1; t <= Math.ceil(len); t++) { const f = Math.min(t, len); probe.x = d.x + c * f; probe.y = d.y + s * f; if (P.caught(W, probe)) return true; }
    return false;
  }
  function log(fight, d, dmg) { const b = fight.board; b.last = dmg; b.name = d.name; b.log.push([fight.t, dmg]); }
  function applyStatus(fight, d, s, dmg, u, o) {
    const C = data(), S = C.statuses, T = u.statusT, st = d.st, Z = S[s];
    let applied = true;
    if (s === "burn") st.burn = { t: T, rate: Math.max((st.burn || {}).rate || 0, dmg * Z.rate), tick: (st.burn || {}).tick || 0, by: u.knight };   // reapplying refreshes it and keeps the higher rate
    else if (s === "freeze") { if (st.freezeImm || st.freeze) applied = false; else st.freeze = { t: Math.min(T, Z.max) * (d.freezeScale || 1) }; }   // a brute's freeze lasts half as long (section 3.5)
    else if (s === "shock") {
      st.shock = { t: Z.show };
      if (o.kind === "direct") { const near = struckBy(fight).filter(x => x !== d).map(x => [dist(d.x, d.y, x.x, x.y), x]).filter(p => p[0] <= Z.within).sort((a, b) => a[0] - b[0] || a[1].i - b[1].i)[0];
        if (near) { emit(fight, { type: "fx", kind: "arc", from: hitPoint(d), to: hitPoint(near[1]), el: "lightning", seed: fight.steps }, u.knight); hit(fight, near[1], dmg * Z.share, { form: o.form, kind: "raw", why: "shock", from: hitPoint(d), fu: u }); }
        // a shock on a troll standing in a puddle also hits every troll in the same puddle (section 3.6a)
        const pd = fight.marks && d.foe ? fight.marks.puddle.find(m => inMark(m, d)) : null;
        if (pd) for (const g of fight.foes.slice()) { if (g === d || g.dead || g.spawn > 0 || (near && g === near[1]) || !inMark(pd, g)) continue; emit(fight, { type: "fx", kind: "arc", from: hitPoint(d), to: hitPoint(g), el: "lightning", seed: fight.steps + g.i }, u.knight); hit(fight, g, dmg * Z.share, { form: o.form, kind: "raw", why: "shock", from: hitPoint(d), fu: u }); } }
    }
    else if (s === "poisoned") st.poisoned = { t: T, stacks: Math.min(Z.stacks, ((st.poisoned || {}).stacks || 0) + 1), rate: Math.max((st.poisoned || {}).rate || 0, dmg * Z.rate), tick: (st.poisoned || {}).tick || 0, by: u.knight };
    else if (s === "bleed") st.bleed = { t: T, stacks: Math.min(Z.stacks, ((st.bleed || {}).stacks || 0) + 1), rate: Math.max((st.bleed || {}).rate || 0, dmg * Z.rate), tick: (st.bleed || {}).tick || 0, by: u.knight };
    else if (s === "stun") { if (st.stunImm || st.stun) applied = false; else st.stun = { t: Z.time }; }
    else if (s === "slow" || s === "blind" || s === "weaken" || s === "mark") st[s] = { t: T };
    else if (s === "lifesteal") { const k = u.knight || fight.k, v = dmg * Z.heal; emit(fight, { type: "heal", amount: v, why: "lifesteal", x: k.x, y: k.y, from: hitPoint(d) }, k); healKnight(fight, k, v); }
    else if (s === "knockback") { /* this hit's push x 1.5: applied with the push */ }
    if (applied) emit(fight, { type: "status", d: d.i, status: s, stacks: (st[s] || {}).stacks || null }, u.knight);
    return applied;
  }

  // ------------------------------------------------------------------ a knight's hit points (design pass 12, section 3.8; in a level only)
  // In a level a knight has 100 hit points. A blow takes them, gives 0.5 s of safety (the knight blinks) and its stagger; a tick (a burn,
  // wire, caltrops) goes through the safety with neither. At 0 the solo knight has one Second Wind an attempt (up after 1.5 s at 50 HP
  // with 1.5 s of safety), and its next fall is a wipe; in a party, or with sword-brothers once the Second Wind is spent, a knight goes
  // down: it crawls, a standing ally within 16 px lifts it in 2.0 s (a hit on the lifter or moving away pauses the lift, neither resets
  // it), and after 15 s it bleeds out and is carried off until the director brings it back at 50. Every knight down or carried off at
  // once is a wipe, and so is the only full knight bleeding out with brothers standing; 3 s later every knight stands at full HP. The
  // cellar has no level, so none of this ever runs there and the quintain's bonk takes nothing.
  const full = k => k.kind !== "brother";   // a player, a guest or a bench bot; a sword-brother counts a quarter (section 3.10)
  const soloOf = fight => fight.knights.filter(full).length === 1;
  // a blow, a shot or a tick on a knight (its seat, or the knight). o: { from: [x, y] where it came from, melee, shot (an arrow, an ice
  // arrow, a fire bolt), stagger (s), src (the kind and attack, for the sim's damage shares), tick }. Returns what came of it: "hit";
  // "cut" (the weapon's guard, facing the blow within 90 degrees, took guard.less of a melee blow); "block" (the guard stopped a shot);
  // "reflect" (a shot sent back at its shooter, or any blow thrown back by the ability's guard); "safe" (the dodge's, a lift's or a
  // Second Wind's safety); "spared" (the 0.5 s after a blow); "none" (no level, or the knight is not on its feet)
  function hurt(fight, who, amount, o) {
    const C = data(), KN = C.knight, k = typeof who === "number" ? fight.knights[who] : who;
    o = o || {};
    if (!fight.level || !k || k.out || k.down || k.rise > 0 || fight.wipe) return "none";
    let dmg = amount, res = "hit";
    if (!o.tick) {
      if (k.safe > 0) return "safe";
      if (k.hurt > 0 && !o.fall) return "spared";
      const from = o.from || [k.x, k.y], u = handOf(k).u, block = () => emit(fight, { type: "block", x: k.x, y: k.y, bx: (from[0] + k.x) / 2, by: k.y - 14 }, k);
      const facing = Math.abs(angDiff(Math.atan2(from[1] - k.y, from[0] - k.x), k.face)) < Math.PI / 2;
      if (k.guardT > 0 && !o.fall) { block(); emit(fight, { type: "reflect", x: k.x, y: k.y }, k); return "reflect"; }
      if (o.shot) {
        if (u.mods.has("guard") && facing) { block(); return "block"; }
        if (u.mods.has("reflect")) { emit(fight, { type: "reflect", x: k.x, y: k.y }, k); return "reflect"; }
      } else if (o.melee && u.mods.has("guard") && facing) { dmg = amount * (1 - C.modifiers.guard.less); res = "cut"; block(); }
    }
    k.hp = Math.max(0, k.hp - dmg);
    emit(fight, { type: "hurt", amount: dmg, src: o.src || null, tick: !!o.tick, x: k.x, y: k.y }, k);
    if (!o.tick) { k.hurt = KN.hurtSafe; if (o.stagger > 0) stagger(fight, k, o.stagger); }
    if (fight.world.level && !o.tick && !o.fall) {   // a blow that lands: it knocks a climber off its ladder, and its push is an impulse
      const P = phys(), from = o.from || [k.x, k.y];
      if (k.climbing) { P.letGo(fight.world, k, true); emit(fight, { type: "letGo", x: k.x, y: k.y, z: k.z }, k); }
      if (o.push > 0) { const dd = Math.hypot(k.x - from[0], k.y - from[1]), a = dd > 1e-6 ? Math.atan2(k.y - from[1], k.x - from[0]) : k.face + Math.PI; P.push(fight.world, k, Math.cos(a), Math.sin(a), o.push); }
    }
    // a blow shatters a freeze (it deals its damage); a blow that sets a status (o.sets: a fire bolt's burning, an ice arrow's chill) sets
    // it once it lands, and fire meeting a frozen knight puts the cold out and sets no burn (section 3.8)
    const cold = k.frozen > 0;
    if (cold && !o.tick && !o.fall) thaw(fight, k, "shatter");
    if (o.sets && k.hp > 0 && !(cold && o.sets === "burning")) afflict(fight, k, o.sets);
    if (k.hp <= 0) fall(fight, k);
    return res;
  }
  // a blow's stagger: a strike still in its wind-up is cut short (one past it finishes, and a held charge keeps charging)
  function stagger(fight, k, s) {
    k.stagger = Math.max(k.stagger, s);
    if (k.strike && k.strike.t < k.strike.wind) { k.strike = null; k.twinQ = null; k.lunge = null; }
  }
  function fall(fight, k) {
    const C = data();
    if (k.carry) putRam(fight, k);   // a knight who goes down drops the ram
    if (k.climbing) phys().letGo(fight.world, k, false);   // and lets go of a ladder
    clearStatuses(fight, k, "down");   // being downed puts a burn out, and the cold goes with it
    k.hp = 0; k.hurt = 0; k.stagger = 0; k.dodge = 0; k.strike = null; k.twinQ = null; k.gout = null; k.charging = false; k.chargeT = 0; k.abQ = null; k.lunge = null; stopStream(fight, k);
    const solo = soloOf(fight) && full(k), brothers = fight.knights.some(b => !full(b));
    if (solo && k.secondWind) { k.secondWind = false; k.rise = C.secondWind.delay; emit(fight, { type: "secondWind", x: k.x, y: k.y, delay: k.rise }, k); return; }
    if (solo && !brothers) { wipe(fight); return; }   // alone, the second fall is a wipe
    k.down = { t: C.downed.bleed, lift: 0, by: null };
    emit(fight, { type: "down", x: k.x, y: k.y, bleed: k.down.t }, k);
    if (fight.knights.every(b => b.down || b.out)) wipe(fight);
  }
  function bleedOut(fight, k) {
    k.down = null; k.out = true;
    for (const h of k.hands) { h.orbit = null; h.aura = null; }
    emit(fight, { type: "out", x: k.x, y: k.y }, k);
    if ((full(k) && soloOf(fight)) || fight.knights.every(b => b.down || b.out)) wipe(fight);   // the run never goes on without its human
  }
  function wipe(fight) {
    if (fight.wipe) return;
    fight.wipe = { t: data().wipe.wait }; fight.level.wipes++;
    for (const k of fight.knights) { k.strike = null; k.twinQ = null; k.gout = null; k.charging = false; k.chargeT = 0; k.abQ = null; k.lunge = null; k.dodge = 0; stopStream(fight, k); clearStatuses(fight, k, "wipe"); }
    wipeMarks(fight);   // the live marks go, the lasting ones stay (section 3.6a)
    emit(fight, { type: "wipe", attempt: fight.level.attempt });
  }
  // the wipe's fade lifts: every knight stands at full HP (at the level's rally point for its seat, when the director has set
  // fight.level.rally), its Second Wind back, and the attempt counts on; the director restarts the wave from the rally event
  function rally(fight) {
    const L = fight.level;
    fight.wipe = null; L.attempt++;
    for (const k of fight.knights) {
      k.hp = k.hpMax; k.down = null; k.out = false; k.rise = 0; k.hurt = 0; k.stagger = 0; k.safe = 0; k.bonk = 0; k.shove = null; k.dodge = 0; k.secondWind = true;
      if (L.rally && L.rally[k.seat]) { k.x = L.rally[k.seat][0]; k.y = L.rally[k.seat][1]; }
      if (fight.world.level) { place(fight, k, k.x, k.y); clearSeat(fight, k); }   // never on a crater, a clod or a stone (section 3.6a)
    }
    emit(fight, { type: "rally", attempt: L.attempt });
  }
  // each step of a level, after the bodies have moved: a Second Wind's getting up, the lifts and the bleeding out, the wipe's wait
  function lifeStep(fight, dt) {
    const C = data(), L = C.downed.lift;
    if (fight.wipe) { fight.wipe.t -= dt; if (fight.wipe.t <= 1e-9) rally(fight); return; }
    for (const k of fight.knights) {
      if (k.rise > 0) { k.rise -= dt; if (k.rise <= 1e-9) { k.rise = 0; k.hp = C.secondWind.hp; k.safe = C.secondWind.safe; emit(fight, { type: "rise", x: k.x, y: k.y, hp: k.hp }, k); } continue; }
      if (!k.down) continue;
      // the lifter: the nearest standing ally within 16 px that has not just been hit
      let lifter = null, best = Infinity;
      for (const a of fight.knights) { if (a === k || a.down || a.out || a.rise > 0 || a.hurt > 0) continue; const dd = dist(a.x, a.y, k.x, k.y); if (dd <= L.within && dd < best) { best = dd; lifter = a; } }
      k.down.by = lifter ? lifter.seat : null;
      if (lifter) { k.down.lift += dt; if (k.down.lift >= L.time - 1e-9) { k.down = null; k.hp = L.hp; k.safe = L.safe; emit(fight, { type: "lifted", by: lifter.seat, x: k.x, y: k.y, hp: k.hp }, k); continue; } }
      k.down.t -= dt;
      if (k.down.t <= 1e-9) bleedOut(fight, k);
    }
  }
  // for the level's director: a wave's attempt begins (the Second Wind is back, the carried-off come back); carried-off knights come
  // back with 50 HP (at a Breather or a wave's start), at at[seat] when given; a heal (lifesteal, vampiric, the Breather) up to full HP,
  // never for a knight on the ground
  function waveStart(fight, at) { if (!fight.level) return; fight.level.attempt = 1; for (const k of fight.knights) k.secondWind = true; returnKnights(fight, at); }
  function returnKnights(fight, at) {
    if (!fight.level) return;
    for (const k of fight.knights) if (k.out) {
      k.out = false; k.hp = data().downed.returnHp; k.hurt = 0; k.stagger = 0; k.safe = 0;
      if (at && at[k.seat]) { k.x = at[k.seat][0]; k.y = at[k.seat][1]; }
      if (fight.world.level) place(fight, k, k.x, k.y);
      emit(fight, { type: "back", x: k.x, y: k.y, hp: k.hp }, k);
    }
  }
  function healKnight(fight, k, amount) { if (fight.level && !k.down && !k.out && !(k.rise > 0)) k.hp = Math.min(k.hpMax, k.hp + amount); }

  // ------------------------------------------------------------------ what trolls do to a knight: burning, chill, frozen (section 3.8)
  // One record of each kind, made only in a level (the cellar's fight never meets a troll): k.burn { t, tick }, 2 every 0.5 s for 3.0 s,
  // renewed by a new fire and never stacked, its ticks going through the safety after a blow; k.chill { n, t, speed }, x 0.8 walking
  // speed a stack (proto/physics.js reads it), the stacks on one 3.0 s timer that every hit refreshes; k.frozen, the seconds left of a
  // freeze (physics holds the wish and makes friction x 0.25), which the third stack in a row sets and which uses the stacks up. After a
  // thaw the knight cannot freeze again for 3.0 s (chill still slows it, at most 2 stacks), and no troll winds up on it for 0.3 s
  // (k.noWind). Fire and ice undo each other: fire on a chilled or frozen knight clears the cold and sets no burn; a chill on a burning
  // knight puts the burn out and adds no stack. A burn goes out when a dodge ends, on a puddle or an ice patch, and when the knight goes
  // down; a troll's blow shatters a freeze.
  const KSTAT = () => data().knightStatuses || null;
  function trollCommon() { const T = TROLLS || root.FORGE_TROLLS; return (T && T.common) || {}; }
  function afflict(fight, who, what, o) {
    const KS = KSTAT(), k = typeof who === "number" ? fight.knights[who] : who;
    if (!fight.level || !KS || !k || k.out || k.down || k.rise > 0 || fight.wipe) return "none";
    if (what === "burning") {
      if (k.frozen > 0 || (k.chill && k.chill.n > 0)) { if (k.frozen > 0) thaw(fight, k, "fire"); endChill(fight, k, "fire"); return "quenched"; }
      if (k.burn) { k.burn.t = KS.burning.time * dX(fight, "knightStatusTime"); return "renewed"; }
      k.burn = { t: KS.burning.time * dX(fight, "knightStatusTime"), tick: 0 };
      emit(fight, { type: "kstatus", status: "burning", on: true, x: k.x, y: k.y }, k);
      return "burning";
    }
    if (what === "chill") {
      if (k.burn) { endBurn(fight, k, "chill"); return "quenched"; }
      if (k.frozen > 0) return "frozen";
      const CH = KS.chill, FZ = KS.frozen, ch = k.chill || (k.chill = { n: 0, t: 0, speed: CH.speed });
      ch.n++; ch.t = CH.time * dX(fight, "knightStatusTime");
      if (!(k.frozenImm > 0) && ch.n >= CH.freezeAt) { freeze(fight, k); return "frozen"; }
      ch.n = Math.min(ch.n, k.frozenImm > 0 ? FZ.chillMaxWhileImmune : CH.max);
      emit(fight, { type: "kstatus", status: "chill", on: true, n: ch.n, x: k.x, y: k.y }, k);
      return "chill";
    }
    return "none";
  }
  // the third stack: 1.0 s frozen, the stacks used up; a strike, a dodge, a charge or a stream in progress stops, a climber lets go, and
  // every troll wind-up aimed at the knight is cancelled into its recover (shots already loosed fly on)
  function freeze(fight, k) {
    const FZ = KSTAT().frozen;
    k.frozen = FZ.time * dX(fight, "knightStatusTime"); k.chill = null;
    k.strike = null; k.twinQ = null; k.gout = null; k.charging = false; k.chargeT = 0; k.lunge = null; k.dodge = 0; stopStream(fight, k);
    if (k.climbing) { phys().letGo(fight.world, k, false); emit(fight, { type: "letGo", x: k.x, y: k.y, z: k.z }, k); }
    emit(fight, { type: "kstatus", status: "frozen", on: true, x: k.x, y: k.y }, k);
    for (const f of fight.foes || []) if (f.act && f.act.phase === "wind" && f.act.seat === k.seat) cancelAct(fight, f, "frozen");
  }
  function thaw(fight, k, why) {
    k.frozen = 0; k.frozenImm = KSTAT().frozen.immune; k.noWind = (trollCommon().frozenKnight || {}).after || 0.3;
    emit(fight, { type: "kstatus", status: "frozen", on: false, why, x: k.x, y: k.y }, k);
  }
  function endBurn(fight, k, why) { if (!k.burn) return; k.burn = null; emit(fight, { type: "kstatus", status: "burning", on: false, why, x: k.x, y: k.y }, k); }
  function endChill(fight, k, why) { if (!k.chill) return; const n = k.chill.n; k.chill = null; if (n > 0) emit(fight, { type: "kstatus", status: "chill", on: false, n: 0, why, x: k.x, y: k.y }, k); }
  function clearStatuses(fight, k, why) { endBurn(fight, k, why); endChill(fight, k, why); if (k.frozen > 0) { k.frozen = 0; emit(fight, { type: "kstatus", status: "frozen", on: false, why, x: k.x, y: k.y }, k); } k.frozenImm = 0; k.noWind = 0; }
  // each step of a level, for each knight: the clocks of its statuses, and the burn's ticks (a puddle or ice under it puts the burn out)
  function statusStep(fight, k, dt) {
    const KS = KSTAT();
    if (!KS) return;
    if (k.noWind > 0) { k.noWind -= dt; if (k.noWind <= 1e-9) k.noWind = 0; }
    if (k.frozenImm > 0) { k.frozenImm -= dt; if (k.frozenImm <= 1e-9) k.frozenImm = 0; }
    if (k.frozen > 0) { k.frozen -= dt; if (k.frozen <= 1e-9) thaw(fight, k, "time"); }
    if (k.chill) { k.chill.t -= dt; if (k.chill.t <= 1e-9) endChill(fight, k, "time"); }
    const B = k.burn;
    if (!B) return;
    if (fight.world.level && !k.air && !k.climbing && !k.out) { const cv = phys().coverOf(fight.world, k).kind; if (KS.burning.outBy.includes(cv)) { endBurn(fight, k, cv); return; } }
    B.t -= dt; B.tick += dt;
    if (B.tick >= KS.burning.tick - 1e-9) { B.tick = 0; hurt(fight, k, KS.burning.damage, { tick: true, src: "burning" }); }
    if (k.burn === B && B.t <= 1e-9) endBurn(fight, k, "time");
  }

  // ------------------------------------------------------------------ a level's bodies, trolls and pieces (design pass 12, sections 3.2a to 3.5)
  const IDLE = { wish: [0, 0] }, NOMODS = new Set();
  const MINION = { r: 5, h: 12, mass: 0.5, climb: null, catches: false };   // a minion's body in a level (section 3.2a's table)
  // a body's one move this step, and what it met, by the pieces' rules
  function moveBody(fight, b, mv, dt) {
    const c = phys().move(b, mv ? mv.intent : IDLE, fight.world, dt, mv ? mv.pre : null);
    if (c && c.length) contacts(fight, b, c);
    if (!b.air && !b.climbing && !b.dead) covered(fight, b, dt);
  }
  // an event about a body: a knight's carries its seat, a troll's its id
  function bodyEvent(fight, b, e) { if (b.knight) return emit(fight, e, b); e.foe = b.id; return emit(fight, e); }
  // what a move met (section 3.2a's contacts with rules, section 3.2b's falls and climbs): thorn-wire cuts 2 at most every 0.5 s and
  // throws the body 5 px back when it walks or is pushed into a coil at 20 px/s or more (a brute tears the section open instead);
  // stake points take 6 from a body shoved onto a fence's long side at over 40 px/s and stop its impulse; a cookfire sets a body shoved
  // into it at over 40 px/s burning; a landing hurts and staggers by the fall's height, and in a deep hole kills
  function contacts(fight, b, list) {
    const C = data(), N = C.physics, CT = N.contact, W = fight.world;
    for (const c of list) {
      if (b.dead) return;
      if (c.kind === "solid") {
        const s = c.s, piece = s.piece || null;
        if (s.contact === "wire") {
          if (b.tears && b.tears.includes("wire")) { if (piece && !piece.gone) breakPiece(fight, piece, [b.x, b.y], b); continue; }
          if (c.walk + c.push >= CT.wire.minSpeed - 1e-9 && !(b.wireT > 0)) {
            b.wireT = CT.wire.every;
            phys().push(W, b, c.nx, c.ny, CT.wire.back);
            bodyEvent(fight, b, { type: "contact", kind: "wire", x: b.x, y: b.y });
            hurtBody(fight, b, CT.wire.damage, { tick: true, src: "wire" });
          }
        } else if (s.contact === "stakes") {
          if (c.push > CT.stakes.speed && Math.abs(c.ny) >= Math.abs(c.nx)) {
            b.ix = 0; b.iy = 0; b.pushV = null;
            bodyEvent(fight, b, { type: "contact", kind: "stakes", x: b.x, y: b.y });
            hurtBody(fight, b, CT.stakes.damage, { src: "stakes", from: [b.x - c.nx * 8, b.y - c.ny * 8] });
          }
        } else if (s.contact === "fire") {
          if (c.push > CT.fire.speed) { bodyEvent(fight, b, { type: "contact", kind: "fire", x: b.x, y: b.y }); ignite(fight, b, s.burnBase || 10); }
        } else if (s.kind === "clod" && b.cls === "large" && piece && !piece.gone) breakPiece(fight, piece, [b.x, b.y], b);   // a brute walking into a clod breaks it (section 3.6a)
      } else if (c.kind === "land") landing(fight, b, c);
      else if (c.kind === "climb") {
        if (c.at === "top") { if (b.knight) b.safe = Math.max(b.safe, N.climb.arriveSafe); else b.safeT = N.climb.arriveSafe; }
        bodyEvent(fight, b, { type: "climb", at: c.at, x: b.x, y: b.y, z: b.z });
      }
      else if (c.kind === "fall") bodyEvent(fight, b, { type: "fall", x: b.x, y: b.y, z: c.z });
      else if (c.kind === "drop") bodyEvent(fight, b, { type: "drop", x: b.x, y: b.y });
      else if (c.kind === "teeter") bodyEvent(fight, b, { type: "teeter", x: b.x, y: b.y });
    }
  }
  // a landing (section 3.2b): up to 8 px nothing; over 8 up to 16 a 0.2 s stagger; over 16 a 0.4 s stagger and (H - 16) x 0.5 damage,
  // rounded; a felled structure under it adds 8 and a 1.0 s stagger; into a deep hole a body that does not catch its lip dies by the
  // hole's rule (SPIKED, DROWNED)
  function landing(fight, b, c) {
    const F = data().physics.fall;
    bodyEvent(fight, b, { type: "land", h: Math.round(c.H * 100) / 100, x: b.x, y: b.y, z: b.z });
    if (c.hole) { if (b.foe) { if (c.hole.kind === "moat") drownPuddle(fight, b); die(fight, b, c.hole.death || "FELL"); } return; }
    let dmg = 0, st = 0;
    if (c.H > F.hurtOver + 1e-9) { dmg = Math.round((c.H - F.hurtOver) * F.perPx); st = F.stagger; }
    else if (c.H > F.step + 1e-9) st = F.staggerLow[1];
    if (c.structure) { dmg += F.structure.damage; st = F.structure.stagger; }
    if (dmg > 0) hurtBody(fight, b, dmg, { fall: true, stagger: st, src: c.structure ? "structure" : "fall" });
    else if (st > 0) staggerBody(fight, b, st);
  }
  function staggerBody(fight, b, s) { if (b.knight) stagger(fight, b, s); else b.stagger = Math.max(b.stagger || 0, s); }
  // damage from the world (wire, stakes, caltrops, a fall, a stone): a knight takes it through Combat.hurt, a troll as a hit with its number
  function hurtBody(fight, b, amount, o) {
    if (b.knight) return hurt(fight, b, amount, o);
    if (b.dead || b.spawn > 0 || (b.safeT > 0 && !o.tick)) return "none";
    const dmg = amount * takenX(b);
    emit(fight, { type: "hit", d: b.i, dummy: b.kind, amount: dmg, tag: b.staggered ? "STAGGER" : null, crit: false, form: null, element: o.element || null, kind: o.tick ? "dot" : "world", why: o.src || null,
      x: b.x, y: b.y - (b.z || 0) - (b.chest || 0), melee: false, hold: 0, sum: false });
    if (o.stagger > 0) b.stagger = Math.max(b.stagger || 0, o.stagger);
    if (o.push > 0 && o.from) { const dd = Math.hypot(b.x - o.from[0], b.y - o.from[1]), a = dd > 1e-6 ? Math.atan2(b.y - o.from[1], b.x - o.from[0]) : b.face; phys().push(fight.world, b, Math.cos(a), Math.sin(a), o.push); }   // a chunk's or a stone's push, away from where it landed
    damage(fight, b, dmg, o.src, null, null, o.tick ? "dot" : "world");
    return "hit";
  }
  // a troll set burning by fire (a cookfire it was shoved into): the trolls' burn, from a base of 10, for 3.0 s (design pass 12, section
  // 3.6a). A knight's burning is a status of its own (section 3.8), which the knight's status machinery sets
  function ignite(fight, b, base) {
    const C = data(), S = C.statuses, M = (C.marks || {}).fire || {}, T = M.trollBurn || { base, time: 3.0 };
    if (b.knight) { afflict(fight, b, "burning"); return; }
    if ((b.immune || []).includes("burn")) return;
    if (b.chills && b.chills.length && b.st.slow) { delete b.st.slow; b.chills = []; emit(fight, { type: "status", d: b.i, status: "slow", stacks: null, off: true }); return; }   // fire reaching a chilled troll: both end (section 3.6a)
    const fresh = !b.st.burn;
    b.st.burn = { t: T.time, rate: Math.max((b.st.burn || {}).rate || 0, (T.base || base) * S.burn.rate), tick: (b.st.burn || {}).tick || 0, by: null };
    if (fresh) emit(fight, { type: "status", d: b.i, status: "burn", stacks: null });   // once, when the burn starts: a troll standing in fire renews it every step
  }
  // caltrops: the first step in costs 3 and a 0.3 s stagger, then 1 every 0.5 s while moving (at x 0.7, the cover's speed); brutes ignore
  // them. Like wire and burning these tick through a knight's safety after a blow
  function covered(fight, b, dt) {
    const cv = phys().coverOf(fight.world, b);
    if (cv.kind !== "caltrops" || (b.ignores && b.ignores.includes("caltrops"))) { b.cal = null; return; }
    const R = cv.rule || {}, E = R.enter || {}, T = R.tick || {};
    if (!b.cal) {
      b.cal = { t: T.every || 0.5 };
      bodyEvent(fight, b, { type: "contact", kind: "caltrops", x: b.x, y: b.y });
      hurtBody(fight, b, E.damage || 3, { tick: true, src: "caltrops" });
      if (E.stagger) staggerBody(fight, b, E.stagger);
      return;
    }
    if (T.moving !== false && Math.hypot(b.x - b.sx, b.y - b.sy) < 1e-6) return;
    b.cal.t -= dt;
    if (b.cal.t <= 1e-9) { b.cal.t += T.every || 0.5; hurtBody(fight, b, T.damage || 1, { tick: true, src: "caltrops" }); }
  }
  // hit points off a troll or a piece; at 0 a troll dies and a piece breaks
  // kind: direct | raw | tick | dot | world (a troll's poise answers a single hit, not a dot)
  function damage(fight, d, amount, why, from, by, kind) {
    if (d.foe) { if (d.dead) return; d.hp -= amount; foeDamaged(fight, d, amount, kind || "direct", by); if (d.hp <= 1e-9) die(fight, d, why || null); return; }
    if (d.piece) {
      if (d.gone || !d.active) return;
      d.hp -= amount;
      if (d.kind === "tower" && d.creak && !d.creaked && d.hp > 1e-9 && d.hp <= d.hpMax * d.creak + 1e-9) { d.creaked = true; emit(fight, { type: "creak", piece: d.i, x: d.x, y: d.y }); }
      if (d.hp <= 1e-9) breakPiece(fight, d, from, by);
    }
  }

  // ------------------------------------------------------------------ the trolls: fight.foes
  // a troll of spec/trolls.json comes in at (x, y): a body with the kind's numbers, its id from fight.bodyId (never reused), on the surface
  // under it (o.on: a platform's id). For its spawn tell (0.6 s, o.tell) it cannot act, be hit or be pushed; stage C's brains move it
  function spawn(fight, kind, x, y, o) {
    o = o || {};
    const C = data(), K = fight.level ? trollKind(kind) : null;
    if (!K || fight.foes.length >= (C.caps.foes || 24)) return null;
    const T = trollSpec(), B = K.body || {}, f = { id: fight.bodyId++, foe: true, kind, name: K.name, x, y }, hp = Math.round(K.hp * dX(fight, "trollHp"));
    bodyOf(f, { r: B.r, h: B.h, mass: B.mass, massStaggered: B.massStaggered, climb: B.climb || null, catches: (B.catches || []).includes("deep"), speed: (K.speed || 42) * dX(fight, "trollSpeed") }, false);
    Object.assign(f, { i: f.id, chest: K.chest, size: K.size, shadow: K.shadow, hp, hpMax: hp, weak: K.weak, resist: K.resist, immune: K.immune, ignores: K.ignores || [], tears: K.tears || [],
      st: {}, combo: null, flash: 0, wob: 0, wv: 0, stagger: 0, safeT: 0, spawn: o.tell === undefined ? ((T.common || {}).spawnTell || 0) : o.tell, dead: false, spec: K, intent: null,
      face: o.face === undefined ? Math.PI : o.face, moving: false, walkT: 0, act: null, cd: {}, hurtAt: -1e9, regrowT: 0, regrowBar: 0, stagWin: [], staggerCd: 0, staggered: false, poise: K.poise || 0,
      freezeScale: K.stagger && K.stagger.freezeScale ? K.stagger.freezeScale : 1, lastHit: null, chop: null, cls: classOf(fight, B.r || 8), brain: null,
      rock: null, rockLying: null, roared: false, roarDue: false, post: null, manning: false, hold: !!o.hold, fixed: !!o.fixed, wantClose: false });   // o.hold: it keeps to the platform it stands on (the tower archer); o.fixed: it never moves and is no body (a wall archer in its breach, at o.z)
    if (K.stagger && K.stagger.dropsRock) f.onStagger = dropRock;
    if (o.brain === undefined ? fight.brains : o.brain) f.brain = newBrain(fight, f);
    surfaceOf(fight, f, o.on);
    if (f.fixed && o.z !== undefined) f.z = o.z;
    if (o.post) setPost(fight, f, o.post, o.manned);
    fight.foes.push(f); fight.tdirty = true;
    const e = { type: "spawn", foe: f.id, kind, x, y, z: f.z, tell: f.spawn };
    if (o.from) e.from = o.from;   // the door it comes through, for the page's first-time lines ("hut")
    emit(fight, e);
    return f;
  }
  // a troll dies: it leaves the bodies and the targets at once (its stone death, drops and rubble are the director's and the painter's)
  function die(fight, f, why) {
    if (f.dead) return;
    f.dead = true; f.hp = Math.min(f.hp, 0); f.why = why || null; f.diedAt = fight.t;   // kept on the record for the director's drops
    if (f.climbing) { f.climbing.ladder.by = null; f.climbing = null; }
    const i = fight.foes.indexOf(f); if (i >= 0) fight.foes.splice(i, 1);
    fight.tdirty = true;
    if (f.rockLying) { phys().removeSolid(fight.world, f.rockLying); f.rockLying = null; }
    const leaves = leavings(fight, f, why);   // what it leaves on the field (section 3.6a): its stone, its boulder, its scorch, the Emberback's flare
    const e = { type: "die", foe: f.id, kind: f.kind, x: f.x, y: f.y, z: f.z, why: why || null };
    if (leaves) e.leaves = leaves;
    if (f.rockLeaves) e.rock = f.rockLeaves;   // a rock brute's dropped rock: boulder (it stays), flatRubble or toppleIntoMoat (it went), at its x, y
    emit(fight, e);
  }
  // a troll's step: its spawn tell, its clocks and statuses (the dots tick as on a dummy), then its one move (stage C's brain writes
  // f.intent; without one it only slides by its impulse, falls and lands)
  function foeStep(fight, f, dt) {
    const S = data().statuses;
    if (f.dead) return;
    if (f.spawn > 0) { f.spawn -= dt; if (f.spawn <= 1e-9) { f.spawn = 0; fight.tdirty = true; emit(fight, { type: "arrive", foe: f.id, kind: f.kind, x: f.x, y: f.y, z: f.z }); } return; }
    f.flash = Math.max(0, f.flash - dt);
    if (f.stagger > 0) { f.stagger -= dt; if (f.stagger <= 1e-9) f.stagger = 0; }
    if (f.stagger === 0) f.staggered = false;
    for (const key of Object.keys(f.cd)) if (f.cd[key] > 0) f.cd[key] -= dt;
    if (f.staggerCd > 0) f.staggerCd -= dt;
    if (f.wireT > 0) f.wireT -= dt;
    if (f.safeT > 0) f.safeT -= dt;
    for (const key of Object.keys(f.st)) {
      const s = f.st[key]; s.t -= dt;
      if (key === "burn" || key === "poisoned" || key === "bleed") { s.tick += dt; if (s.tick >= S.tick - 1e-9) { s.tick = 0; dot(fight, f, s.rate * (s.stacks || 1) * S.tick, key === "burn" ? "fire" : key === "poisoned" ? "poison" : "bleed", s.by); } }
      if (f.dead) return;
      if (s.t <= 1e-9) { delete f.st[key]; if (key === "freeze") f.st.freezeImm = { t: S.freeze.immune }; if (key === "stun") f.st.stunImm = { t: S.stun.immune }; }
    }
    // a rock brute whose rock lies beside it (dropped by a stagger) spends 0.6 s picking it up once the stagger ends
    if (f.rock && f.stagger === 0) { f.pickUp = (f.pickUp === undefined ? ((f.spec.stagger || {}).pickUp || 0.6) : f.pickUp) - dt; if (f.pickUp <= 1e-9) { phys().removeSolid(fight.world, f.rock); emit(fight, { type: "rockUp", foe: f.id, x: f.rock.x, y: f.rock.y }); f.rock = null; f.pickUp = undefined; } }
    if (f.brain) { if (!(f.chop && chopStep(fight, f, dt))) brainStep(fight, f, dt); }
    regrowStep(fight, f, dt);
    if (f.dead || f.fixed) return;
    moveBody(fight, f, f.intent ? { intent: f.intent } : null, dt);
    // the Emberback scorches as it walks: a scorch mark r 4 every 16 px
    const TR = f.spec.trail;
    if (TR && fight.marks && !f.air) { f.trailD = (f.trailD || 0) + Math.hypot(f.x - f.sx, f.y - f.sy); if (f.trailD >= (TR.every || 16) - 1e-9) { f.trailD -= TR.every || 16; stamp(fight, "scorch", f.x, f.y, TR.scorch || 4, f.z); } }
  }
  // a troll's action cut short: a wind-up goes into its attack's recover (a frozen target, an interrupt: the blow misses); outright (a
  // stun, a freeze, a stagger) the action simply ends, the troll held by its status
  function cancelAct(fight, f, why, outright) {
    const A = f.act;
    if (!A || (!outright && A.phase !== "wind")) return;
    if (outright) { f.act = null; if (A.after) A.after(fight, f); } else { A.phase = "recover"; A.t = 0; A.T = (A.atk && A.atk.recover) || 0.6; }
    if (A.drive) A.drive.done = true;
    emit(fight, { type: "cancel", foe: f.id, attack: A.kind, why, x: f.x, y: f.y });
  }
  // what a knight's blows can strike: the dummies (the cellar's, or a level's), and in a level the trolls past their spawn tell, then the
  // breakable pieces still standing
  function targets(fight) {
    if (!fight.level) return fight.dummies;
    if (fight.tdirty || !fight.tlist) { fight.tlist = fight.dummies.concat(fight.foes.filter(f => !f.dead && !(f.spawn > 0)), fight.pieces.filter(p => p.active && !p.gone)); fight.tdirty = false; }
    return fight.tlist;
  }
  // the targets a blow may jump to or a shot may turn to: everything but the pieces that are never aim targets (wire, fences, barrels)
  const struckBy = fight => fight.level ? targets(fight).filter(d => !d.piece || d.aim) : fight.dummies;
  // a body's screen feet (y - z) inside the view
  function inView(fight, d) { const v = fight.view; if (!v) return true; const sy = d.y - (d.z || 0); return d.x >= v.x0 && d.x <= v.x1 && sy >= v.y0 && sy <= v.y1; }
  // the height rule (section 3.2b): melee and streams land only on what stands within 12 px of the striker's feet; the gate is struck in
  // melee only from the drawbridge's deck
  function canHit(fight, k, d, u, zr) {
    if (!fight.level) return true;
    if ((d.foe && d.dead) || (d.piece && (d.gone || !d.active))) return false;
    if (Math.abs((d.z || 0) - (k.z || 0)) > (zr === undefined ? data().physics.z.melee : zr) + 1e-9) return false;
    return !(d.fromPlat && u && u.melee && k.on !== d.fromPlat);
  }
  // the 12 px rule between any two bodies, and a reach on the floor plane, for the trolls' kits (stage C)
  function reaches(fight, a, b, range) { return Math.abs((a.z || 0) - (b.z || 0)) <= data().physics.z.melee + 1e-9 && (range === undefined || Math.hypot(a.x - b.x, a.y - b.y) <= range + (b.r || 0)); }

  // ------------------------------------------------------------------ the pieces: fight.pieces
  // a piece at 0 HP: a hut or a tent becomes a low ruin (solid, shots pass); a fence or wire section, a barrel leaves the world and lies
  // flat; a trebuchet's wreck stays solid; the archer tower is felled; the gate is broken (the burst is the director's)
  function breakPiece(fight, p, from, by) {
    if (p.gone || p.broken) return;
    const W = fight.world, P = phys(), K = (fight.area || {}).propKinds || {};
    p.hp = Math.min(p.hp, 0); p.broken = true; p.gone = !p.stays; fight.tdirty = true;
    if (p.kind === "tower") { fell(fight, p, from); return; }
    if (p.kind === "gate") { emit(fight, { type: "gateBroken", piece: p.i, x: p.x, y: p.y }); return; }
    if (!p.stays) for (const id of p.solids) {
      const s = W.solids[id];
      P.removeSolid(W, s);
      if (p.kind === "wire" || p.kind === "stakeFence" || p.kind === "barrel") P.addCover(W, Object.assign({ kind: p.kind === "wire" ? "cutWire" : p.kind === "barrel" ? "staves" : "brokenFence", on: null }, s.shape === "c" ? { shape: "c", x: s.x, y: s.y, r: s.r } : { shape: "r", x0: s.x0, y0: s.y0, x1: s.x1, y1: s.y1 }));
    }
    if (p.kind === "hut" || p.kind === "tent") { const R = K.hutRuin || {}; p.ruin = P.addSolid(W, { kind: "hutRuin", shape: "c", x: p.x, y: p.y, r: R.r || 10, ht: R.ht || 8 }).id; }
    emit(fight, { type: "wreck", piece: p.i, kind: p.kind, x: p.x, y: p.y });
    if (p.kind === "clod" && p.mark) { const m = p.mark; p.mark = null; endMark(fight, m, m.crumble ? "crumbled" : "broken"); }   // a broken clod leaves loose dirt
    else if (p.byFire && p.wood && fight.marks) { const HB = ((fight.area || {}).huts || {}).burning, B = p.kind === "hut" ? (HB || { r: 14, life: 3.0 }) : { r: 12, life: 3.0 }; p.burning = null; fire(fight, p.x, p.y, B.r || 12, B.life || 3.0, "world", { z: p.z, on: p.on }); }   // a wooden piece wrecked by fire burns (section 3.6a: a burning hut's collapse r 14, any other wooden piece r 12)
  }
  // the archer tower felled (section 3.2b): it falls away from the felling blow (to the east when the blow came from under it), and every
  // body on its deck and its ladder falls with it and lands by the "structure" row; the poles lie flat as ground cover along the fall
  function fell(fight, p, from) {
    const W = fight.world, P = W.platBy[p.deck], f = from || [p.x, p.y], dx = p.x - f[0], dy = p.y - f[1];
    const under = P && P.shape === "r" && f[0] >= P.x0 && f[0] <= P.x1 && f[1] >= P.y0 && f[1] <= P.y1, def = ((p.fall || {}).default || "e");
    const way = under || (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) ? def : Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "e" : "w") : (dy >= 0 ? "s" : "n");
    const dir = { e: [1, 0], w: [-1, 0], s: [0, 1], n: [0, -1] }[way];
    W.list = bodies(fight);
    const poles = phys().fellTower(W, p.deck, dir, W.list);
    emit(fight, { type: "fell", piece: p.i, kind: p.kind, way, x: p.x, y: p.y, poles: poles ? [poles.x0, poles.y0, poles.x1, poles.y1] : null });
  }

  // ------------------------------------------------------------------ the Last Army's Ram (section 3.4)
  // a knight within 16 px of it takes it up into a carry slot of its own: Strike swings it (a 0.6 s wind, 30 a blow at 0.5 a second, reach
  // 22, and a flat 120 on the gate, 60 on a hut, the tower or an engine), it walks at x 0.7 as a body of r 9 and cannot climb. Swap puts it
  // down along its facing at the nearest free spot within 24 px; a knight who goes down drops it where it fell
  function takeRam(fight, seat) {
    const k = fight.knights[seat || 0], W = fight.world, R = (fight.area || {}).ram;
    if (!R || !W.level || W.ram === null || W.ram === undefined || !k || k.carry || k.out || k.down || k.climbing || k.air) return false;
    const s = W.solids[W.ram], qx = clamp(k.x, s.x0, s.x1), qy = clamp(k.y, s.y0, s.y1);
    if (Math.hypot(k.x - qx, k.y - qy) > R.within + 1e-9) return false;
    phys().removeSolid(W, s); W.ram = null;
    k.carry = ramHand(fight, k); k.r = R.carryR || data().knight.carryR || k.r; k.strike = null; k.twinQ = null; stopStream(fight, k);
    emit(fight, { type: "carry", what: "ram", on: true, x: k.x, y: k.y }, k);
    return true;
  }
  function ramHand(fight, k) {
    const R = fight.area.ram, Wp = R.weapon, u = unitsFor({ id: "ram", weapon: { form: Wp.form, numbers: {}, modifiers: [], status: [], element: "physical", visual: { base: "hammer" } } }, false);
    Object.assign(u, { hit: Wp.hit, K: 1, rate: Wp.rate, reach: Wp.reach, windT: Wp.wind, push: 0, crit: 0, ram: { vs: R.vs || {}, flat: R.vsFlat !== false }, knight: k, second: null });
    return { thing: { id: "ram", name: R.name, line: R.line }, u, u2: null, ua: null, acd: 0, acdOf: 1, cd: 0, recover: 0, recoverOf: 0, count: 0, lungeCd: 0, orbit: null, aura: null, practice: false, carry: true, speed: R.speed || 1 };
  }
  function putRam(fight, k) {
    if (!k.carry) return false;
    const W = fight.world, R = fight.area.ram, P = phys(), w = R.rect[2] - R.rect[0], h = R.rect[3] - R.rect[1], KN = data().knight;
    const fx = Math.cos(k.face), fy = Math.sin(k.face), c0x = k.x + fx * (h / 2 + KN.r + 1), c0y = k.y + fy * (h / 2 + KN.r + 1);
    const free = (cx, cy) => {
      const s = { shape: "r", x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
      if (s.x0 < fight.floor.x0 || s.x1 > fight.floor.x1 || s.y0 < fight.floor.y0 || s.y1 > fight.floor.y1) return null;
      for (const o of W.solids) if (!o.gone && !o.thin && boxesMeet(s, o)) return null;
      for (const H of W.holes) if (H.deep && boxesMeet(s, H)) return null;
      for (const Q of W.plats) if (Q.active && boxesMeet(s, Q)) return null;
      for (const b of bodies(fight)) if (b !== k && Math.hypot(clamp(b.x, s.x0, s.x1) - b.x, clamp(b.y, s.y0, s.y1) - b.y) < b.r) return null;
      return s;
    };
    let spot = free(c0x, c0y);
    for (let r = 2; !spot && r <= 24; r += 2) for (let i = 0; i < 16 && !spot; i++) { const a = i * Math.PI / 8; spot = free(c0x + Math.cos(a) * r, c0y + Math.sin(a) * r); }
    if (!spot) return false;
    W.ram = P.addSolid(W, Object.assign({ kind: "ram", ht: ((fight.area.propKinds || {}).ram || {}).ht || 8 }, spot)).id;
    k.carry = null; k.r = KN.r; k.strike = null;
    emit(fight, { type: "carry", what: "ram", on: false, x: (spot.x0 + spot.x1) / 2, y: (spot.y0 + spot.y1) / 2 }, k);
    return true;
  }
  // does a box (x0..x1, y0..y1) meet a solid's, a hole's or a platform's shape?
  function boxesMeet(s, o) {
    if (o.shape === "c") return Math.hypot(clamp(o.x, s.x0, s.x1) - o.x, clamp(o.y, s.y0, s.y1) - o.y) < o.r;
    if (o.shape === "r") return s.x0 < o.x1 && s.x1 > o.x0 && s.y0 < o.y1 && s.y1 > o.y0;
    if (o.shape === "uv") { const us = [s.x0 - s.y1, s.x1 - s.y0], vs = [s.x0 + s.y0, s.x1 + s.y1]; return us[0] < o.u1 && us[1] > o.u0 && vs[0] < o.v1 && vs[1] > o.v0; }
    return false;
  }

  // ------------------------------------------------------------------ a troll's shot, a blow on the ground (the height rules, for stage C's kits)
  // a troll's shot: a floor point and a flight height from the shooter's z + chest, aimed at a body's chest (its height changes linearly to
  // meet it, and keeps the slope after); it hits a knight when the floor distance is within the radii and its height inside the knight's
  // span (the dodge's safety lets it pass), and stops on a solid taller than it, a slab, a surface it comes down to, or the view's edge
  // (unless fired by or at a body above the ground). o: { speed, range, r, damage, push, stagger, kind, src, at: [x, y] (a point, when it
  // has no body to aim at) }
  function foeShot(fight, from, at, o) {
    o = o || {};
    const C = data(), tx = at.x !== undefined ? at.x : at[0], ty = at.y !== undefined ? at.y : at[1], tz = at.x !== undefined ? (at.z || 0) + (at.chest !== undefined ? at.chest : C.knight.chest) : (o.z || 0);
    const fz = (from.z || 0) + (from.chest || 0), fd = Math.hypot(tx - from.x, ty - from.y);
    const p = { id: fight.nextId++, kind: o.kind || "troll-arrow", by: from.id, fx: from.x, fy: from.y, fz, x0: from.x, y0: from.y, a: Math.atan2(ty - from.y, tx - from.x), dz: fd > 1e-6 ? (tz - fz) / fd : 0,
      v: o.speed || 150, range: o.range || 200, traveled: 0, r: o.r === undefined ? C.projectiles.radius : o.r, o, hits: [], done: false,
      aloft: !!o.aloft || (from.z || 0) > 0 || (at.x !== undefined && (at.z || 0) > 0) };   // fired by or at a body above the ground: past the view's walls
    p.x = p.fx; p.y = p.fy - p.fz;
    (fight.foeShots || (fight.foeShots = [])).push(p);
    while (fight.foeShots.length > (C.caps.foeShots || 48)) fight.foeShots.shift();
    emit(fight, { type: "foeShot", id: p.id, kind: p.kind, foe: from.id, x: p.x, y: p.y, a: p.a, fx: p.fx, fy: p.fy, fz: p.fz });
    return p;
  }
  function foeShotsStep(fight, dt) {
    if (!fight.foeShots || !fight.foeShots.length) return;
    const W = fight.walls, P = phys();
    for (const p of fight.foeShots) {
      if (p.done) continue;
      const oz = p.fz;
      p.fx += Math.cos(p.a) * p.v * dt; p.fy += Math.sin(p.a) * p.v * dt; p.fz += p.dz * p.v * dt; p.traveled += p.v * dt;
      p.x = p.fx; p.y = p.fy - p.fz;
      if (p.back) {   // sent back by reflect: it flies the other way and strikes the first troll it meets, by its affinity
        for (const g of fight.foes) {
          if (g.dead || g.spawn > 0 || Math.hypot(p.fx - g.x, p.fy - g.y) > p.r + g.r || p.fz < (g.z || 0) - 1e-9 || p.fz > (g.z || 0) + (g.h || 24) + 1e-9) continue;
          p.done = true;
          const mult = affinity(g, null, p.o.element || null, { mods: NOMODS }), dmg = (p.o.damage || 0) * mult * takenX(g);
          emit(fight, { type: "hit", d: g.i, dummy: g.kind, amount: dmg, tag: mult > 1.01 ? "WEAK" : mult < 0.99 ? "RESIST" : g.staggered ? "STAGGER" : null, crit: false, form: "shoot", element: p.o.element || null, kind: "direct", why: "reflect", x: g.x, y: g.y - (g.z || 0) - (g.chest || 0), melee: false, hold: 0, sum: false });
          damage(fight, g, dmg, "reflect", [p.x0, p.y0], null, "direct");
          if (p.o.sets && !g.dead) trollSets(fight, g, p.o.sets);
          emit(fight, { type: "foeShotHit", id: p.id, foe: g.id, res: "back", x: p.x, y: p.y });
          break;
        }
      } else for (const k of fight.knights) {
        if (p.hits.includes(k.seat) || k.out || k.down) continue;
        if (Math.hypot(p.fx - k.x, p.fy - k.y) > p.r + k.r || p.fz < (k.z || 0) - 1e-9 || p.fz > (k.z || 0) + (k.h || 24) + 1e-9) continue;
        if (trenchCover(fight, { fx: p.x0, fy: p.y0, a: p.a }, k)) { p.over = true; continue; }   // it flies over a knight its trench covers (its end says so: the page's trench line)
        p.hits.push(k.seat);
        const res = hurt(fight, k, p.o.damage || 0, { shot: p.kind, from: [p.x0, p.y0], push: p.o.push, stagger: p.o.stagger, src: p.o.src || null, sets: p.o.sets });
        if (res === "safe") continue;   // the dodge's safety lets it pass
        emit(fight, { type: "foeShotHit", id: p.id, seat: k.seat, res, x: p.x, y: p.y });
        if (res === "reflect") { p.back = true; p.a += Math.PI; p.dz = -p.dz; p.traveled = 0; p.x0 = p.fx; p.y0 = p.fy; break; }
        p.done = true; p.hit = k.seat; p.res = res;
        break;
      }
      if (p.done) continue;
      if (p.traveled >= p.range) { p.done = true; emit(fight, shotEnd(p, { type: "foeShotEnd", id: p.id, why: "range", x: p.x, y: p.y, z: p.fz, miss: p.o.miss || null })); shotMiss(fight, p, "range", null); continue; }
      const stop = P.shotStop(fight.world, p.fx, p.fy, p.fz, oz);
      if (stop) { p.done = true; p.stop = stop; emit(fight, shotEnd(p, { type: "foeShotEnd", id: p.id, why: stop.solid ? stop.solid.kind : "ground", x: p.x, y: p.y, z: p.fz, miss: p.o.miss || null, piece: stop.solid && stop.solid.piece ? stop.solid.piece.i : null })); shotMiss(fight, p, "stop", stop); continue; }
      if (!p.aloft && (p.fx < W.x0 || p.fx > W.x1 || p.fy < W.y0 || p.fy > W.y1)) { p.done = true; emit(fight, shotEnd(p, { type: "foeShotEnd", id: p.id, why: "edge", x: p.x, y: p.y, z: p.fz, miss: null })); }
    }
    fight.foeShots = fight.foeShots.filter(p => !p.done);
  }
  // where a troll's shot ends without a knight (section 3.5, section 3.6a): an arrow sticks in the ground or the piece it met; a fire bolt
  // bursts into a fire patch r 10 for 4.0 s (on a wooden piece, 10 damage and it catches; a cart or a palisade only chars; in a puddle or on
  // ice it fizzles, melting the ice); an ice arrow shatters into an ice patch r 10 for 8.0 s (in a fire patch, no ice: the fire ends)
  const shotEnd = (p, e) => { if (p.over) e.over = true; return e; };   // a shot that flew over a knight in a trench says so when it ends
  function shotMiss(fight, p, how, stop) {
    const M = fight.marks; if (!M) return;
    const P = phys(), W = fight.world, miss = p.o.miss || null, solid = stop && stop.solid ? stop.solid : null, piece = solid && solid.piece && !solid.piece.gone ? solid.piece : null;
    // the floor point it ended on: a step back out of the solid it met; its surface (the ground under it, or the platform it came down to)
    const back = solid ? 2 : 0, x = p.fx - Math.cos(p.a) * back, y = p.fy - Math.sin(p.a) * back;
    const sf = stop && stop.surface !== undefined ? { z: stop.surface, on: stop.plat ? stop.plat.id : null } : (() => { const s = P.surfaceAt(W, x, y, 1e9); return s ? { z: s.z, on: s.plat ? s.plat.id : null } : { z: 0, on: null }; })();
    const isArrow = p.kind === "troll-arrow" || p.kind === "ice-arrow";
    if (isArrow) stuck(fight, x, y, piece ? p.fz : sf.z, sf.on, piece, p.kind);
    if (!miss) return;
    if (miss.patch === "fire") {
      if (piece) { if (piece.wood) { piece.byFire = true; const mult = affinity(piece, null, "fire", { mods: NOMODS }), dmg = (p.o.woodDamage || 10) * mult; emit(fight, { type: "hit", d: piece.i, dummy: piece.kind, amount: dmg, tag: mult > 1.01 ? "WEAK" : null, crit: false, form: null, element: "fire", kind: "world", why: "bolt", x: piece.x, y: piece.y - (piece.z || 0) - (piece.chest || 0), melee: false, hold: 0, sum: false }); damage(fight, piece, dmg, "fire", [x, y], null, "world"); if (!piece.gone) piece.burning = { t: 3.0 }; } }
      else if (solid && !solid.charred && ((data().wood || {}).charsOnly || ["cart", "palisade", "burntTent", "ram"]).includes(solid.kind)) { solid.charred = true; emit(fight, { type: "char", solid: solid.id, kind: solid.kind, x, y }); }
      for (const ic of M.ice.slice()) if (inMark(ic, { x, y, on: sf.on })) { melt(fight, ic, "fire"); emit(fight, { type: "fizzle", x, y, r: miss.r || 10 }); return; }
      for (const pd of M.puddle) if (inMark(pd, { x, y, on: sf.on })) { emit(fight, { type: "fizzle", x, y, r: miss.r || 10 }); return; }
      fire(fight, x, y, miss.r || 10, miss.life || 4.0, "troll", sf);
    } else if (miss.patch === "ice") ice(fight, x, y, miss.r || 10, miss.life || 8.0, "troll", sf);
  }
  // a blow on a surface (a slam, a stone): every knight whose centre is within r plus its own and whose feet are within 12 px of the
  // surface's height. o: { damage, push, stagger, from, src }. Returns the seats it hit and what came of each
  function foeBurst(fight, x, y, z, r, o) {
    o = o || {};
    const out = [], zr = data().physics.z.burst;
    for (const k of fight.knights) {
      if (k.out || k.down || Math.hypot(k.x - x, k.y - y) > r + k.r + 1e-9 || Math.abs((k.z || 0) - z) > zr + 1e-9) continue;
      out.push({ seat: k.seat, res: hurt(fight, k, o.damage || 0, { melee: !!o.melee, from: o.from || [x, y], push: o.push, stagger: o.stagger, src: o.src || null }) });
    }
    return out;
  }

  // ------------------------------------------------------------------ where a dead brute's stone may lie (section 3.5)
  // A brute slumps into a stone lump (r 10, 24 px tall), and a rock brute leaves its boulder too, only where it keeps 24 px from every
  // solid, hole and platform, lies off the drawbridge's deck and its bank stretch, and overlaps no body: "stone". A brute that dies on the
  // deck over the moat topples into it: "toppleIntoMoat"; anywhere else that fails the rule: "flatRubble"
  function remains(fight, x, y, r, skip) {   // skip: a solid left out of the rule (the dropped rock judged for itself)
    const W = fight.world, P = phys(), D = (trollSpec().brute || {}).deathLeaves || {}, clear = (D.place || {}).clear || 24;
    r = r || (D.bruteStone || {}).r || 10;
    const moat = W.holes.find(H => H.kind === "moat");
    for (const Q of W.plats) if (Q.when === "bridgeDown" && P.inShape(Q, x, y)) return Q.active && moat && x - y >= moat.u0 ? "toppleIntoMoat" : "flatRubble";
    const gap = s => {
      if (s.shape === "c") return (s.bowl || s.r !== undefined) ? Math.hypot(x - s.x, y - s.y) - s.r - r : Infinity;
      if (s.shape === "r") return Math.hypot(Math.max(s.x0 - x, 0, x - s.x1), Math.max(s.y0 - y, 0, y - s.y1)) - r;
      if (s.shape === "uv") { const u = x - y, v = x + y; return Math.hypot(Math.max(s.u0 - u, 0, u - s.u1), Math.max(s.v0 - v, 0, v - s.v1)) / Math.SQRT2 - r; }
      if (s.shape === "hp") return (s.c - (s.ax * x + s.ay * y)) / Math.hypot(s.ax, s.ay) - r;
      return Infinity;
    };
    for (const s of W.solids) if (!s.gone && s !== skip && gap(s) < clear - 1e-9) return "flatRubble";
    for (const s of W.halves) if (gap(s) < clear - 1e-9) return "flatRubble";
    for (const H of W.holes) if (!H.gone && gap(H) < clear - 1e-9) return "flatRubble";
    for (const Q of W.plats) if (Q.active && gap(Q) < clear - 1e-9) return "flatRubble";
    for (const b of bodies(fight)) if (Math.hypot(b.x - x, b.y - y) < b.r + r) return "flatRubble";
    return "stone";
  }

  // ------------------------------------------------------------------ the marks of the battlefield (design pass 12, section 3.6a)
  // Every effect in a level leaves a mark: live (it plays for a while: fire, ice, a puddle, a chunk or a stone in flight, the Emberback's
  // glowing heap) or lasting (a crater, a clod, an arrow stuck in a piece; scorch, cracks, loose dirt, frost stars and damp rings are
  // stamped by the page from the events and kept here only as bits of the ground). fight.marks = { fire, ice, puddle, crater, clod, chunk,
  // stone, stuck, ember }, each a list of { id, kind, x, y, z, r, t, life, side, on } in id order (side: knight, troll or world; z and on:
  // the surface it lies on), exists only in an area with marks: true: the cellar allocates nothing and emits no mark event. A mark's id
  // comes from fight.markId and every random choice from fight.rng.marks, never fight.nextId or fight.rand, so the cellar's logs and the
  // knights' crits never move. fight.ground is a Uint8Array over the floor's 8 px grid (scorch 1, ice 2, puddle 4, crater 8, fire 16) for
  // the fields and the bots. A mark's making and ending are events (mark, markEnd: kind, id, x, y, z, r; a markEnd's why), from which the
  // page stamps: a crater's bowl, a stuck arrow, a fire's scorch (unless a puddle or ice put it out), a puddle's damp ring, a filled
  // crater, a broken clod's dirt. Fire, ice and puddles are ground cover to the move function and the fields (Physics.addCover); a
  // crater is a bowl (Physics.crater); a clod is a solid and a 1 HP piece.
  const MARK_LISTS = ["fire", "ice", "puddle", "crater", "clod", "chunk", "stone", "stuck", "ember"], GBIT = { scorch: 1, ice: 2, puddle: 4, crater: 8, fire: 16 }, GG = 8;
  function newMarks(fight) { const M = { pending: [], waterAt: {}, made: 0, wiped: 0 }; for (const k of MARK_LISTS) M[k] = []; return M; }
  const MK = () => data().marks || {};
  const inMark = (m, b) => !b.air && (b.on || null) === (m.on || null) && Math.hypot(b.x - m.x, b.y - m.y) < m.r;   // a body stands in a mark: its centre inside the circle, on its surface
  const touches = (m, x, y, r) => Math.hypot(x - m.x, y - m.y) < m.r + r;
  // the ground's bits: the cells whose centre lies inside the circle (and the cell of the centre itself), set when a mark is made and
  // found again from the marks of its kind when one ends (scorch is never cleared)
  function overCells(fight, x, y, r, f) {
    const gw = fight.gw, gh = fight.gh, ci = clamp(Math.floor(x / GG), 0, gw - 1), cj = clamp(Math.floor(y / GG), 0, gh - 1);
    const i0 = clamp(Math.floor((x - r) / GG), 0, gw - 1), i1 = clamp(Math.floor((x + r) / GG), 0, gw - 1), j0 = clamp(Math.floor((y - r) / GG), 0, gh - 1), j1 = clamp(Math.floor((y + r) / GG), 0, gh - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const cx = i * GG + GG / 2, cy = j * GG + GG / 2; if ((i === ci && j === cj) || Math.hypot(cx - x, cy - y) < r) f(j * gw + i, cx, cy, i, j); }
  }
  const coversCell = (m, cx, cy, i, j) => (Math.floor(m.x / GG) === i && Math.floor(m.y / GG) === j) || Math.hypot(cx - m.x, cy - m.y) < m.r;
  function groundSet(fight, kind, x, y, r) { const bit = GBIT[kind]; if (!bit || !fight.ground) return; overCells(fight, x, y, r, i => { fight.ground[i] |= bit; }); }
  function groundRefresh(fight, kind, x, y, r) {
    const bit = GBIT[kind], M = fight.marks; if (!bit || !fight.ground || kind === "scorch") return;
    overCells(fight, x, y, r, (i, cx, cy, gi, gj) => { let on = false; for (const m of M[kind]) if (coversCell(m, cx, cy, gi, gj)) { on = true; break; } if (on) fight.ground[i] |= bit; else fight.ground[i] &= ~bit; });
  }
  const groundBits = (fight, x, y) => fight.ground ? fight.ground[clamp(Math.floor(y / GG), 0, fight.gh - 1) * fight.gw + clamp(Math.floor(x / GG), 0, fight.gw - 1)] : 0;
  // a mark made: its record (unless it is a stamp alone: o.stamp), its event, its ground bit. o: { z, on, side, x0, y0 (where a chunk or
  // a stone flew from), piece, clod, z0, peak, engine, atk, splinter, stamp }
  function mark(fight, kind, x, y, r, life, o) {
    const M = fight.marks; o = o || {};
    const m = { id: fight.markId++, kind, x, y, z: o.z || 0, r, t: 0, life, side: o.side || "world", on: o.on || null };
    for (const key of ["x0", "y0", "piece", "clod", "z0", "peak", "engine", "atk", "splinter", "arrow", "glow"]) if (o[key] !== undefined) m[key] = o[key];
    const e = { type: "mark", kind, id: m.id, x, y, z: m.z, r, side: m.side };
    if (o.x0 !== undefined) { e.x0 = o.x0; e.y0 = o.y0; e.life = life; }
    if (o.piece !== undefined) e.piece = o.piece;
    if (o.clod) e.clod = true;
    if (!o.stamp) { M[kind].push(m); M.made++; }
    groundSet(fight, kind, x, y, r);
    emit(fight, e);
    return m;
  }
  // a stamp alone (scorch, a crack, loose dirt, a frost star): an event with an id of its own, and the ground's scorch bit
  const stamp = (fight, kind, x, y, r, z) => fight.marks ? mark(fight, kind, x, y, r, 0, { z, stamp: true }) : null;
  // a mark ends (why: time, melt, puddle, ice, shatter, crater, filled, broken, crumbled, fell, dry, land, wipe): its record, cover and bowl go
  function endMark(fight, m, why, quiet) {
    const M = fight.marks, L = M[m.kind], i = L.indexOf(m), P = phys(), W = fight.world;
    if (i < 0) return false;
    L.splice(i, 1);
    if (m.cover) { P.removeCover(W, m.cover); m.cover = null; }
    if (m.hole) { P.fillCrater(W, m.hole); m.hole = null; }
    groundRefresh(fight, m.kind, m.x, m.y, m.r);
    if (m.kind === "fire" && why !== "puddle" && why !== "ice" && why !== "wipe") groundSet(fight, "scorch", m.x, m.y, m.r);   // a fire's end scorches the ground (the page stamps it from the markEnd)
    if (!quiet) emit(fight, { type: "markEnd", kind: m.kind, id: m.id, x: m.x, y: m.y, z: m.z, r: m.r, why });
    return true;
  }
  const oldestOf = list => list.length ? list[0] : null;
  // ---- fire (a missed bolt r 10 for 4.0 s, the Emberback's death r 16 for 3.0 s, burning grass and a burning wreck r 12 for 3.0 s;
  // side: troll or world, or knight for grass a knight's fire lit). Meeting ice, both end and a puddle of the ice's r is left (steam);
  // meeting a puddle the fire ends with no scorch and the puddle loses 4 px; on scorch it lives half as long
  function fire(fight, x, y, r, life, side, o) {
    const M = fight.marks; if (!M) return null;
    const MS = MK(), FS = MS.fire || {}, PS = MS.puddle || {}; o = o || {};
    for (const ice of M.ice.slice()) if (touches(ice, x, y, r)) { melt(fight, ice, "fire"); emit(fight, { type: "steam", x, y, r }); return null; }
    for (const pd of M.puddle.slice()) if (touches(pd, x, y, r)) { emit(fight, { type: "fizzle", x, y, r }); shrinkPuddle(fight, pd, PS.fireShrinks || 4); return null; }
    if (groundBits(fight, x, y) & GBIT.scorch) life *= FS.onScorch === undefined ? 0.5 : FS.onScorch;
    const m = mark(fight, "fire", x, y, r, life, { z: o.z, on: o.on, side });
    m.cover = phys().addCover(fight.world, { kind: "fire", shape: "c", x, y, r, on: m.on, mark: m });
    const pool = M.fire.filter(f => (f.side === "knight") === (side === "knight")), cap = (data().caps || {}).worldFire || 12;
    if (pool.length > cap) endMark(fight, pool[0], "time");   // the oldest ends early, as at its end
    return m;
  }
  // ---- ice (a missed ice arrow r 10 for 8.0 s): slippery for everyone; it melts into a puddle of its r (20 s) at its end, under a burning
  // body, or when fire meets it. An ice patch made in a fire patch shatters: no ice, the fire ends and leaves scorch
  function ice(fight, x, y, r, life, side, o) {
    const M = fight.marks; if (!M) return null;
    o = o || {};
    let shattered = false;
    for (const f of M.fire.slice()) if (touches(f, x, y, r)) { endMark(fight, f, "shatter"); shattered = true; }
    if (shattered) { emit(fight, { type: "steam", x, y, r }); return null; }
    const m = mark(fight, "ice", x, y, r, life, { z: o.z, on: o.on, side });
    m.cover = phys().addCover(fight.world, { kind: "ice", shape: "c", x, y, r, on: m.on, mark: m });
    const cap = (data().caps || {}).ice || 16;
    if (M.ice.length > cap) melt(fight, M.ice[0], "time");
    return m;
  }
  function melt(fight, m, why) { endMark(fight, m, why); return puddle(fight, m.x, m.y, m.r, (MK().puddle || {}).melted || 20, m.side, { z: m.z, on: m.on }); }
  // ---- a puddle (melted ice 20 s; a troll drowning, r 8 on the bank's edge, 20 s; a knight's water hit on a troll, r 6 for 10 s, at most
  // one a knight a second): x 0.9 speed, puts burning out, a fire that meets it goes out; it dries into a damp ring
  function puddle(fight, x, y, r, life, side, o) {
    const M = fight.marks; if (!M) return null;
    o = o || {};
    const m = mark(fight, "puddle", x, y, r, life, { z: o.z, on: o.on, side });
    m.cover = phys().addCover(fight.world, { kind: "puddle", shape: "c", x, y, r, on: m.on, mark: m });
    for (const f of M.fire.slice()) if (touches(f, x, y, r)) { endMark(fight, f, "puddle"); shrinkPuddle(fight, m, (MK().puddle || {}).fireShrinks || 4); if (!M.puddle.includes(m)) return null; }
    const cap = (data().caps || {}).puddles || 16;
    if (M.puddle.length > cap) endMark(fight, M.puddle[0], "dry");
    return m;
  }
  function shrinkPuddle(fight, m, by) {
    const PS = MK().puddle || {};
    m.r -= by;
    if (m.r < (PS.minR || 6) - 1e-9) { endMark(fight, m, "dry"); return; }
    if (m.cover) { m.cover.r = m.r; phys().coverChanged(fight.world, m.cover); }
    groundRefresh(fight, "puddle", m.x, m.y, m.r + by);
    emit(fight, { type: "mark", kind: "puddle", id: m.id, x: m.x, y: m.y, z: m.z, r: m.r, side: m.side, shrunk: true });
  }
  // ---- a crater (every rock slam on the ground r 14, 10 deep; every stone r 12, 8 deep): a bowl to the move function, never on a platform
  // or the drawbridge; one whose centre lies within 10 px of an older crater's widens that one (one record, one bowl), and any it overlaps it
  // merges with as the lowest of the bowls (Physics.crater); the live patches it opens under are removed; at the cap the oldest fills in
  function crater(fight, x, y, r, depth, o) {
    const M = fight.marks; if (!M) return null;
    const P = phys(), W = fight.world, CS = MK().crater || {}, merge = CS.merge === undefined ? 10 : CS.merge, cap = (data().caps || {}).craters || 24; o = o || {};
    for (const Q of W.plats) if (Q.active && P.inShape(Q, x, y)) return null;
    r = Math.max(r, CS.minR || 8);
    const near = M.crater.find(c => Math.hypot(c.x - x, c.y - y) <= merge + 1e-9);
    let c;
    if (near) {
      const nr = Math.max(near.r, r + Math.hypot(near.x - x, near.y - y)), nd = Math.max(near.hole.depth, depth);
      P.resizeCrater(W, near.hole, nr, nd); near.r = nr; c = near;
      groundSet(fight, "crater", c.x, c.y, c.r);
      emit(fight, { type: "mark", kind: "crater", id: c.id, x: c.x, y: c.y, z: 0, r: c.r, side: c.side, merged: true });
    } else {
      const H = P.crater(W, x, y, r, depth);
      if (!H) return null;
      c = mark(fight, "crater", x, y, r, Infinity, { side: o.side || "troll" });
      c.hole = H; H.mark = c;
    }
    for (const kind of ["fire", "ice", "puddle"]) for (const m of M[kind].slice()) if (!m.on && Math.hypot(m.x - c.x, m.y - c.y) < c.r) endMark(fight, m, "crater");
    for (const p of fight.patches.slice()) if (!p.on && Math.hypot(p.x - c.x, p.y - c.y) < c.r) endPatch(fight, p);   // the knights' own patches too, their cover with them
    if (M.crater.length > cap) endMark(fight, M.crater[0], "filled");
    return c;
  }
  // ---- chunks (6 to 9 from a rock slam, 20 to 56 px out over 0.5 to 0.8 s; 4 to 6 from a stone, 16 to 40 px over 0.6 to 0.8 s; their
  // count, directions, distances and times from fight.rng.marks): each shows its landing as a soot shadow for the whole flight and deals 2
  // to a knight and 4 to a troll touching the shadow, with a 4 px push; every third (in flight order) lands as a clod, the rest as loose
  // dirt; on a platform or the drawbridge they are splinters (no clods). At the cap a new chunk is not thrown (its numbers are drawn all
  // the same, so a replay matches)
  function chunks(fight, x, y, z, on, CH, side, splinters) {
    const M = fight.marks; if (!M || !CH) return [];
    const R = fight.rng.marks, cap = (data().caps || {}).chunks || 24, F = fight.floor, out = [];
    const n = CH.n[0] + Math.floor(R() * (CH.n[1] - CH.n[0] + 1));
    for (let i = 0; i < n; i++) {
      const a = R() * TAU, d = CH.dist[0] + R() * (CH.dist[1] - CH.dist[0]), T = CH.flight[0] + R() * (CH.flight[1] - CH.flight[0]);
      if (M.chunk.length >= cap) continue;
      const big = !splinters && (CH.clodEvery || 3) > 0 && (i % (CH.clodEvery || 3)) === (CH.clodEvery || 3) - 1;
      out.push(mark(fight, "chunk", clamp(x + Math.cos(a) * d, F.x0, F.x1), clamp(y + Math.sin(a) * d, F.y0, F.y1), CH.shadow || 3, T, { x0: x, y0: y, z, on, side, clod: big, atk: CH, splinter: !!splinters }));
    }
    return out;
  }
  function chunkLand(fight, m) {
    const W = fight.world, A = m.atk || {}, P = phys();
    for (const b of W.list) {
      if (b.air || b.climbing || (b.on || null) !== (m.on || null) || Math.hypot(b.x - m.x, b.y - m.y) > m.r + b.r + 1e-9) continue;
      if (b.knight) hurt(fight, b, (A.damageKnight === undefined ? 2 : A.damageKnight) * dX(fight, "trollDamage"), { from: [m.x, m.y], push: A.push || 4, src: m.splinter ? "splinter" : "chunk" });
      else hurtBody(fight, b, A.damageTroll === undefined ? 4 : A.damageTroll, { from: [m.x, m.y], push: A.push || 4, src: m.splinter ? "splinter" : "chunk" });
    }
    endMark(fight, m, "land");
    if (m.clod && clodAt(fight, m.x, m.y, m)) return;
    stamp(fight, "dirt", m.x, m.y, m.r, m.z);
  }
  // ---- a clod: a solid r 4, 6 px tall, and a 1 HP piece (never an aim target: a blow whose area covers it breaks it, and so does a brute
  // walking into it); one that would land touching a body, a solid, a hole or a platform lands as loose dirt instead; at the cap the oldest
  // crumbles. A broken clod leaves loose dirt (the page stamps it from the markEnd)
  function clodAt(fight, x, y, m) {
    const M = fight.marks, P = phys(), W = fight.world, K = ((fight.area || {}).propKinds || {}).clod || {}, r = K.r || 4, ht = K.ht || 6, F = fight.floor;
    if (m.on || x - r < F.x0 || x + r > F.x1 || y - r < F.y0 || y + r > F.y1) return false;
    if (P.groundAt(W, x, y).hole || P.caught(W, { x, y, z: 0, r, h: ht, on: null })) return false;
    for (const Q of W.plats) if (Q.active && P.inShape(Q, x, y)) return false;
    for (const b of W.list) if (!b.air && Math.hypot(b.x - x, b.y - y) < b.r + r) return false;
    const s = P.addSolid(W, { kind: "clod", shape: "c", x, y, r, ht }), p = P.addPiece(W, { kind: "clod", x, y, r, chest: 0, ht, hp: K.hp || 1, weak: [], resist: [], aim: false, solids: [s.id] });
    fight.tdirty = true;
    const c = mark(fight, "clod", x, y, r, Infinity, { side: m.side, piece: p.i, clod: true });
    p.mark = c; c.pieceRef = p;
    const cap = (data().caps || {}).clods || 24;
    if (M.clod.length > cap) { const old = M.clod[0]; old.crumble = true; breakPiece(fight, old.pieceRef, null, null); }
    return true;
  }
  // ---- a stone (a trebuchet's, stage E's engines call Combat.throwStone): it flies 2.0 s from the sling (z 40) to its target point on
  // its surface, its shadow growing from r 3 to 10 and its ring r 16 the hit circle; the impact deals 20 and a 20 px push to every body
  // touching the ring (trolls take it as earth), a 0.3 s stagger to knights, 20 to wooden pieces within 16 px, opens a crater r 12 8 deep
  // on the ground (merging) and throws 4 to 6 chunks (splinters and no crater on the drawbridge or a platform)
  function throwStone(fight, from, to, o) {
    const M = fight.marks; if (!M) return null;
    o = o || {};
    const ST = o.spec || (((fight.area || {}).engineKinds || {}).trebuchet || {}).stone || {}, cap = (data().caps || {}).stones || 4;
    if (M.stone.length >= cap) return null;
    const d = Math.hypot(to.x - from[0], to.y - from[1]), peak = Math.max((ST.peak || {}).min || 60, ((ST.peak || {}).perPx || 0.4) * d);
    const m = mark(fight, "stone", to.x, to.y, ST.ring || 16, ST.flight || 2.0, { x0: from[0], y0: from[1], z: to.z || 0, on: to.on || null, z0: ST.z0 || 40, peak, engine: o.engine, side: "troll", atk: ST });
    m.seat = o.seat === undefined ? null : o.seat;
    emit(fight, { type: "windUp", foe: null, engine: o.engine === undefined ? null : o.engine, kind: "trebuchet", attack: "stone", seat: m.seat, x: to.x, y: to.y, z: m.z, wind: m.life, tel: { kind: "ring", x: to.x, y: to.y, z: m.z, r: m.r, grow: m.life, stone: m.id } });
    return m;
  }
  function stoneLand(fight, m) {
    const W = fight.world, ST = m.atk || {}, P = phys(), hitR = ST.hitR || m.r || 16, seats = [];
    for (const b of W.list) {
      if (b.air || b.climbing || (b.on || null) !== (m.on || null) || Math.hypot(b.x - m.x, b.y - m.y) > hitR + b.r + 1e-9) continue;
      if (b.knight) { hurt(fight, b, (ST.damage === undefined ? 20 : ST.damage) * dX(fight, "trollDamage"), { from: [m.x, m.y], push: ST.push === undefined ? 20 : ST.push, stagger: ST.stagger === undefined ? 0.3 : ST.stagger, src: "trebuchet.stone" }); seats.push(b.seat); }
      else hurtBody(fight, b, (ST.damage === undefined ? 20 : ST.damage) * affinity(b, null, ST.trollsTake || "earth", { mods: NOMODS }), { from: [m.x, m.y], push: ST.push === undefined ? 20 : ST.push, src: "stone", element: ST.trollsTake || "earth" });
    }
    for (const p of fight.pieces) if (p.wood && p.active && !p.gone && (p.on || null) === (m.on || null) && Math.hypot(p.x - m.x, p.y - m.y) <= hitR + p.r + 1e-9) {
      emit(fight, { type: "hit", d: p.i, dummy: p.kind, amount: ST.woodDamage || 20, tag: null, crit: false, form: null, element: null, kind: "world", why: "stone", x: p.x, y: p.y - (p.z || 0) - (p.chest || 0), melee: false, hold: 0, sum: false });
      damage(fight, p, ST.woodDamage || 20, "stone", [m.x, m.y], null, "world");
    }
    endMark(fight, m, "land");
    emit(fight, { type: "stoneHit", id: m.id, engine: m.engine === undefined ? null : m.engine, x: m.x, y: m.y, z: m.z, r: hitR, hit: seats });
    if (ST.shake) emit(fight, { type: "shake", amp: ST.shake, time: data().feel.shakeT });
    const CR = ST.crater || { r: 12, depth: 8 }, H = m.on ? null : crater(fight, m.x, m.y, CR.r || 12, CR.depth || 8, { side: "troll" });
    chunks(fight, m.x, m.y, m.z, m.on, ST.chunks || { n: [4, 6], dist: [16, 40], flight: [0.6, 0.8], shadow: 3, damageKnight: 2, damageTroll: 4, push: 4, clodEvery: 3 }, "troll", !H);
  }
  // ---- stuck arrows: every troll or knight arrow that stops on the ground or a piece; one in the ground is stamped at once (an ice arrow
  // with a frost star), one on a piece's face is drawn live until the cap, when the oldest falls and is stamped flat
  function stuck(fight, x, y, z, on, piece, arrow) {
    const M = fight.marks; if (!M) return null;
    if (!piece) {
      const s = mark(fight, "stuck", x, y, 0, 0, { z, on, stamp: true, arrow });
      if (arrow === "ice-arrow") stamp(fight, "frost", x, y, 4, z);
      return s;
    }
    const m = mark(fight, "stuck", x, y, 0, Infinity, { z, on, piece: piece.i, arrow }), cap = (data().caps || {}).stuckOnPieces || 32;
    if (M.stuck.length > cap) { const old = M.stuck[0]; endMark(fight, old, "fell"); emit(fight, { type: "mark", kind: "stuck", id: old.id, x: old.x, y: old.y, z: 0, r: 0, side: "world" }); }
    return m;
  }
  // ---- tall grass: a fire patch or a burning body touching a clump lights it; after 1.0 s the clump is a fire patch r 12 for 3.0 s on the
  // side of what lit it (grass lit by a knight's fire, or by a body a knight set burning, is knight fire), then burnt grass (its scorch)
  function lightGrass(fight, x, y, r, side) {
    const W = fight.world, GR = (((fight.area || {}).propKinds || {}).tallGrass || {}).burns || { catch: 1.0, r: 12, life: 3.0 };
    phys().coverNear(W, [x - r, y - r, x + r, y + r], g => {   // the clumps in the cells about the fire
      if (g.kind !== "grass" || g.burnt || g.lit || g.gone) return;
      if (Math.hypot(clamp(x, g.x0, g.x1) - x, clamp(y, g.y0, g.y1) - y) >= r) return;
      g.lit = { side }; const cx = (g.x0 + g.x1) / 2, cy = (g.y0 + g.y1) / 2;
      emit(fight, { type: "grassLit", x: cx, y: cy, side });
      fight.marks.pending.push({ at: fight.t + (GR.catch === undefined ? 1.0 : GR.catch), grass: g, fire: fg => { g.burnt = true; g.lit = null; fire(fight, cx, cy, GR.r || 12, GR.life || 3.0, side); } });
    });
  }
  // the bodies that burn, and whose fire it is: a troll a knight's weapon set burning carries knight fire; everything else world fire
  const burnSide = b => b.knight ? "world" : b.st && b.st.burn && b.st.burn.by ? "knight" : "world";
  // a breakable wooden piece in fire: 6 a second (x 1.5, weak to fire); wrecked by fire it burns as a fire patch r 12 for 3.0 s
  function scorchPiece(fight, p, amount) {
    const mult = affinity(p, null, "fire", { mods: NOMODS });
    if (mult === 0) return;
    p.byFire = true;
    dot(fight, p, amount * mult, "fire", null);
  }
  // the Emberback's death: its cracks flare for 0.5 s (a ring r 16, the telegraph), then it bursts into a fire patch r 16 for 3.0 s that
  // burns everyone, and leaves a glowing heap that cools over 6 s (fight.marks.ember; the page stamps the rubble under it from the die event)
  function emberDeath(fight, f) {
    const D = f.spec.death || {}, PT = D.patch || { r: 16, life: 3.0 }, x = f.x, y = f.y, z = f.z, on = f.on;
    emit(fight, { type: "windUp", foe: f.id, kind: f.kind, attack: "flare", seat: null, x, y, z, wind: D.flare || 0.5, tel: { kind: "ring", x, y, z, r: PT.r || 16, grow: D.flare || 0.5 } });
    fight.marks.pending.push({ at: fight.t + (D.flare || 0.5), fire: () => { fire(fight, x, y, PT.r || 16, PT.life || 3.0, "troll", { z, on }); mark(fight, "ember", x, y, 6, D.rubbleCools || 6.0, { z, on, side: "troll" }); } });
  }
  // what a troll leaves where it died (section 3.5, section 3.6a): a burning one scorch r 6; a brute its stone lump (r 10, 24 px tall) and
  // a rock brute its boulder as well, where the remains rule lets them lie (else flat rubble, which the page stamps from the die event;
  // on the drawbridge's deck it topples into the moat); the Emberback its flare; a dropped rock stays as a boulder. In a hole nothing lies
  function leavings(fight, f, why) {
    const M = fight.marks; if (!M) return null;
    if (f.rock) rockLeft(fight, f);   // its dropped rock first, by the remains rule where it lies
    if (why === "DROWNED" || why === "SPIKED" || why === "FELL") return null;
    const K = f.spec, W = fight.world, P = phys(), DL = K.deathLeaves;
    if (f.st.burn) stamp(fight, "scorch", f.x, f.y, (MK().scorch || {}).trollDeath || 6, f.z);
    if (K.death && K.death.flare) { emberDeath(fight, f); return "ember"; }
    if (!DL) return null;
    const BS = DL.bruteStone || { r: 10, ht: 24 }, res = remains(fight, f.x, f.y, BS.r || 10);
    if (res === "stone") {
      P.addSolid(W, { kind: "bruteStone", shape: "c", x: f.x, y: f.y, r: BS.r || 10, ht: BS.ht || 24 });
      if (DL.boulder) {   // the rock brute's boulder beside its lump, where the rule lets it lie too
        const BO = DL.boulder, dd = (BS.r || 10) + (BO.r || 10) + ((((trollSpec().brute || {}).deathLeaves || {}).place || {}).clear || 24), F = fight.floor;
        let spot = null;
        for (let i = 0; i < 8 && !spot; i++) { const a = f.face + i * Math.PI / 4, x = f.x + Math.cos(a) * dd, y = f.y + Math.sin(a) * dd; if (x >= F.x0 + 10 && x <= F.x1 - 10 && y >= F.y0 + 10 && y <= F.y1 - 10 && remains(fight, x, y, BO.r || 10) === "stone") spot = [x, y]; }
        if (spot) P.addSolid(W, { kind: "boulder", shape: "c", x: spot[0], y: spot[1], r: BO.r || 10, ht: BO.ht || 22, stun: BO.chargeStun || 1.2 });
      }
    } else if (res === "toppleIntoMoat") drownPuddle(fight, f);
    return res;
  }
  // a rock brute's dropped rock when the brute dies (section 3.5, "where the rule above lets it lie, never on the bridge"): it stays as a
  // boulder where remains() says "stone" (judged for itself), else it goes: flat rubble (the page stamps it from the die event's `rock`),
  // or into the moat off the drawbridge's deck
  function rockLeft(fight, f) {
    const s = f.rock, W = fight.world; f.rock = null;
    const res = remains(fight, s.x, s.y, s.r, s);
    if (res === "stone") s.kind = "boulder"; else phys().removeSolid(W, s);
    f.rockLeaves = { x: s.x, y: s.y, leaves: res === "stone" ? "boulder" : res };
  }
  // a troll drowned in the moat leaves a puddle r 8 on the bank's edge for 20 s
  function drownPuddle(fight, b) {
    const M = fight.marks; if (!M) return null;
    const moat = fight.world.holes.find(H => H.kind === "moat"), PS = (MK().puddle || {}).drown || { r: 8, life: 20 };
    if (!moat) return null;
    const u = b.x - b.y, v = b.x + b.y, lip = u - moat.u0 <= moat.u1 - u ? moat.u0 - PS.r * Math.SQRT2 : moat.u1 + PS.r * Math.SQRT2;
    return puddle(fight, (lip + v) / 2, (v - lip) / 2, PS.r || 8, PS.life || 20, "world");
  }
  // the marks' step, after every body has moved: the clocks; fire burns whoever stands in it (knights by their status from troll or world
  // fire, trolls from a base of 10 from any fire, which stops their regrowth), takes 6 a second off a wooden piece it touches and lights
  // grass; a burning body on ice melts it and goes out, in a puddle goes out; chunks and stones land; the pending bursts
  function marksStep(fight, dt) {
    const M = fight.marks; if (!M) return;
    const C = data(), MS = MK(), S = C.statuses, W = fight.world, P = phys(), list = W.list, base = ((MS.fire || {}).trollBurn || {}).base || 10, SH = (MS.ice || {}).shrink || 2.0;
    if (M.pending.length) for (const q of M.pending.slice()) { if (fight.t < q.at - 1e-9) continue; M.pending.splice(M.pending.indexOf(q), 1); q.fire(fight, q); }
    // the clocks: a fire's wood ticks; an ice patch shrinks over its last 2.0 s (its cover's r, what bodies and the fields read; the record
    // keeps its r for the melt's puddle and the painter, which draws the same shrink from the clock)
    for (const m of M.fire) {
      m.t += dt; m.tick = (m.tick || 0) + dt;
      if (m.tick >= S.tick - 1e-9) { m.tick -= S.tick; for (const p of fight.pieces) if (p.wood && p.active && !p.gone && (p.on || null) === (m.on || null) && touches(m, p.x, p.y, p.r)) scorchPiece(fight, p, ((MS.fire || {}).woodPerSecond || 6) * S.tick); }
    }
    for (const m of M.ice) { m.t += dt; const left = m.life - m.t; if (m.cover && left < SH) m.cover.r = Math.max(1, m.r * Math.max(0, left) / SH); }
    for (const m of M.puddle) m.t += dt;
    // the bodies in live marks, each by the cover in its own cell (a mark's cover carries its record): fire burns whoever stands in it
    // (knights by their status from troll or world fire, trolls from a base of 10 from any fire), a burning body on ice goes out and melts
    // it, a burning troll in a puddle goes out
    for (const b of list) {
      if (b.dead || b.air) continue;
      const cell = W.ccells[P.cellAt(W, b.x, b.y)]; if (!cell.length) continue;
      const tmp = fight._cellTmp || (fight._cellTmp = []); tmp.length = 0; for (let q = 0; q < cell.length; q++) tmp.push(cell[q]);   // a copy: a fire met here may take cover out of the cell
      for (let q = 0; q < tmp.length; q++) { const c = tmp[q];
        const m = c.mark; if (!m || c.gone || (c.on || null) !== (b.on || null) || !P.inShape(c, b.x, b.y)) continue;
        if (m.kind === "fire") { if (b.knight) { if (m.side !== "knight" && standing(b)) afflict(fight, b, "burning"); } else if (b.foe && !(b.spawn > 0)) ignite(fight, b, base); }
        else if (m.kind === "ice") { if (b.knight ? !!b.burn : !!(b.foe && b.st && b.st.burn)) { if (b.knight) endBurn(fight, b, "ice"); else delete b.st.burn; melt(fight, m, "melt"); } }
        else if (m.kind === "puddle") { if (b.foe && b.st && b.st.burn) delete b.st.burn; }
      }
    }
    for (const m of M.fire.slice()) { lightGrass(fight, m.x, m.y, m.r, m.side); if (M.fire.includes(m) && m.t >= m.life - 1e-9) endMark(fight, m, "time"); }
    for (const m of M.ice.slice()) if (m.t >= m.life - 1e-9) melt(fight, m, "time");
    for (const m of M.puddle.slice()) if (m.t >= m.life - 1e-9) endMark(fight, m, "time");
    for (const p of fight.patches) if (p.kind === "fire") lightGrass(fight, p.x, p.y, p.r, "knight");
    for (const b of list) if (!b.dead && !b.air && ((b.knight && b.burn) || (b.foe && b.st && b.st.burn))) lightGrass(fight, b.x, b.y, b.r + 2, burnSide(b));
    // the knights' own fire patches are fire marks too (section 3.6a): meeting an ice patch both end and a puddle of the ice's r is left,
    // meeting a puddle the fire ends and the puddle loses 4 px
    for (const p of fight.patches.slice()) {
      if (p.kind !== "fire" || !p.cover) continue;
      let met = false;
      P.coverNear(W, [p.x - p.r, p.y - p.r, p.x + p.r, p.y + p.r], c => {
        const m = c.mark; if (met || !m || c.gone || (c.on || null) !== (p.on || null) || !touches(m, p.x, p.y, p.r)) return;
        if (m.kind === "ice") { melt(fight, m, "fire"); emit(fight, { type: "steam", x: p.x, y: p.y, r: p.r }); met = true; }
        else if (m.kind === "puddle") { emit(fight, { type: "fizzle", x: p.x, y: p.y, r: p.r }); shrinkPuddle(fight, m, (MS.puddle || {}).fireShrinks || 4); met = true; }
      });
      if (met) endPatch(fight, p);
    }
    for (const m of M.chunk.slice()) { m.t += dt; if (m.t >= m.life - 1e-9) chunkLand(fight, m); }
    for (const m of M.stone.slice()) { m.t += dt; if (m.t >= m.life - 1e-9) stoneLand(fight, m); }
    for (const m of M.ember.slice()) { m.t += dt; if (m.t >= m.life - 1e-9) endMark(fight, m, "time"); }
    // a wooden piece that caught (a bolt burst on it) burns at the fire patch's rate for 3.0 s
    for (const p of fight.pieces) { const B = p.burning; if (!B || p.gone || !p.active) { if (B) p.burning = null; continue; } B.t -= dt; B.tick = (B.tick || 0) + dt; if (B.tick >= S.tick - 1e-9) { B.tick -= S.tick; scorchPiece(fight, p, ((MS.fire || {}).woodPerSecond || 6) * S.tick); } if (p.burning && B.t <= 1e-9) p.burning = null; }
  }
  // on a wipe the live marks go (fire, ice, puddles, chunks, stones in flight, the glowing heaps) and the lasting ones stay; the retry is
  // fought on the scarred field
  function wipeMarks(fight) {
    const M = fight.marks; if (!M) return;
    for (const kind of ["fire", "ice", "puddle", "chunk", "stone", "ember"]) for (const m of M[kind].slice()) endMark(fight, m, "wipe", true);
    for (const q of M.pending) if (q.grass) q.grass.lit = null;   // a clump lit but not yet burning: the fire that lit it is gone, so it never catches
    M.pending.length = 0; M.wiped++;
    for (const p of fight.patches.slice()) endPatch(fight, p);   // the knights' own fire and frost patches are live marks too (section 3.6a)
    emit(fight, { type: "marksWiped" });
  }
  // a rally seat on or within 4 px of a crater, a clod or a stone moves to the nearest free floor point (rings of 4 px, 16 ways)
  function clearSeat(fight, k) {
    const M = fight.marks; if (!M) return;
    const W = fight.world, P = phys(), bad = (x, y) => {
      for (const c of M.crater) if (Math.hypot(c.x - x, c.y - y) < c.r + 4) return true;
      for (const c of M.clod) if (Math.hypot(c.x - x, c.y - y) < c.r + k.r + 4) return true;
      for (const s of W.solids) if (!s.gone && (s.kind === "bruteStone" || s.kind === "boulder" || s.kind === "droppedRock") && Math.hypot(s.x - x, s.y - y) < s.r + k.r + 4) return true;
      return P.caught(W, { x, y, z: 0, r: k.r, h: k.h, on: null }) || P.groundAt(W, x, y).deep;
    };
    if (!bad(k.x, k.y)) return;
    const F = fight.floor;
    for (let R = 4; R <= 96; R += 4) for (let i = 0; i < 16; i++) {
      const a = i * TAU / 16, x = k.x + Math.cos(a) * R, y = k.y + Math.sin(a) * R;
      if (x < F.x0 + k.r || x > F.x1 - k.r || y < F.y0 + k.r || y > F.y1 - k.r || bad(x, y)) continue;
      place(fight, k, x, y); return;
    }
  }

  // ------------------------------------------------------------------ the trolls' way: the flow fields, kept per standing knight and class (section 3.5)
  // The field set (proto/physics.js fieldSet) covers one box: the arena the director has set (fight.level.arena: { x0, x1 }), else the
  // arena of the area whose x range holds the view's centre, else the view's own span; the floor's rows. It is built again when the box
  // changes. Its classes come from spec/trolls.json (common.path.classes): small, every kind of r 8 or less, and large, the brutes; each
  // class is as wide as its name says, as tall and as heavy as its tallest and heaviest kind, climbs the ladder if its kinds climb and
  // weigh no more than a ladder carries, pays the common avoidCost by cover (1 for what its kinds ignore), and tears what they tear. A
  // field (one Dijkstra from a knight over a class's map) is kept for every standing knight and every class with a live troll (or a class
  // bots pinned), marked dirty every 0.5 s (common.path.rebuild) and by the world's change log, and rebuilt one a step, round-robin.
  function fieldClasses(fight) {
    const T = trollSpec(), C0 = T.common || {}, PA = C0.path || {}, sizes = PA.classes || { small: 8, large: 11 }, N = data().physics, out = {};
    const names = Object.keys(sizes).sort((a, b) => sizes[a] - sizes[b]);
    for (const name of names) out[name] = { r: sizes[name], h: 24, fits: 0, mass: 1, cost: Object.assign({}, C0.avoidCost || {}), narrow: true, ladder: null, stairUp: PA.stairUp || 1.25, drop: PA.drop || 24, tears: null, tearCost: 1, kinds: [] };
    for (const kind of Object.keys(T)) {
      const K = kind === "common" ? null : trollKind(kind);
      if (!K || !K.body) continue;
      const B = K.body, c = out[names.find(n => B.r <= sizes[n] + 1e-9) || names[names.length - 1]];
      c.kinds.push(kind); c.h = Math.max(c.h, B.h || 24); c.fits = Math.max(c.fits, B.r); c.mass = Math.max(c.mass, B.mass || 1);
      if (B.climb && (B.mass || 1) <= (PA.ladderMass === undefined ? 1.5 : PA.ladderMass) + 1e-9) { const L = c.ladder || (c.ladder = { up: Infinity, down: Infinity, speed: Infinity, dwell: N.climb.dwell }); L.up = Math.min(L.up, B.climb[0]); L.down = Math.min(L.down, B.climb[1]); L.speed = Math.min(L.speed, K.speed || 42); }
      if (K.tears && K.tears.length) { c.tears = Array.from(new Set((c.tears || []).concat(K.tears))); c.tearCost = 1.5; }   // wire costs the brutes 1.5 (section 3.5)
      for (const g of K.ignores || []) c.cost[g] = 1;
    }
    return out;
  }
  const classOf = (fight, r) => { const FS = fields(fight), names = Object.keys(FS.classes).sort((a, b) => FS.classes[a].r - FS.classes[b].r); return names.find(n => r <= FS.classes[n].r + 1e-9) || names[names.length - 1]; };
  function fields(fight) { return fight.fields || (fight.fields = { set: null, box: null, classes: fieldClasses(fight), list: [], rr: 0, pinned: [], builds: 0 }); }
  function fieldBox(fight) {
    const L = fight.level, A = fight.area || {}, F = fight.floor, v = fight.view;
    if (L && L.arena && L.arena.x0 !== undefined) return { x0: L.arena.x0, x1: L.arena.x1, y0: F.y0, y1: F.y1 };
    const cx = (v.x0 + v.x1) / 2, ar = (A.arenas || []).find(a => cx >= a.x0 && cx < a.x1);
    if (ar) return { x0: ar.x0, x1: ar.x1, y0: F.y0, y1: F.y1 };
    const col = fight.vw || 384, c0 = Math.floor(cx / col) * col;   // outside every arena (a walk): the whole column under the view's centre, so a moving camera builds nothing anew
    return { x0: Math.max(F.x0, c0), x1: Math.min(F.x1, c0 + col), y0: F.y0, y1: F.y1 };
  }
  const standing = k => !k.down && !k.out && !(k.rise > 0);
  function fieldsStep(fight, dt) {
    if (!(TROLLS || root.FORGE_TROLLS)) return;   // a level with no troll spec loaded (a test's) has nothing to path
    const FS = fields(fight), P = phys(), W = fight.world, PA = trollCommon().path || {};
    if (!FS.pinned.length && !fight.foes.some(f => !f.dead && f.brain)) { FS.list.length = 0; return; }   // nothing to path: no thinking troll alive and no class pinned
    const box = fieldBox(fight);
    if (!FS.set || FS.box.x0 !== box.x0 || FS.box.x1 !== box.x1 || FS.box.y0 !== box.y0 || FS.box.y1 !== box.y1) { FS.set = P.fieldSet(W, box, FS.classes); FS.box = box; for (const r of FS.list) { r.F = null; r.dirty = true; } }
    else if (P.fieldUpdate(FS.set)) for (const r of FS.list) r.dirty = true;
    // the fields wanted: a standing knight x a class with a live troll (or pinned by the bots)
    const live = {};
    for (const f of fight.foes) if (!f.dead) live[f.cls] = true;
    for (const n of FS.pinned) live[n] = true;
    const want = [];
    for (const k of fight.knights) if (standing(k)) for (const cls of Object.keys(FS.classes)) if (live[cls]) want.push(k.seat + ":" + cls);
    FS.list = FS.list.filter(r => want.includes(r.key));
    for (const key of want) if (!FS.list.some(r => r.key === key)) { const [seat, cls] = key.split(":"); FS.list.push({ key, seat: +seat, cls, F: null, dirty: true, t: 0 }); }
    const every = PA.rebuild || 0.5, per = PA.perStep || 1, n = FS.list.length;
    for (const r of FS.list) { r.t += dt; if (r.t >= every - 1e-9) { r.t = 0; r.dirty = true; } }
    // the dirty ones rebuilt, one a step (perStep), round-robin from where the last step left off
    for (let built = 0, i = 0; i < n && built < per; i++) {
      const r = FS.list[(FS.rr + i) % n];
      if (!r.dirty) continue;
      r.F = r.F || P.field(FS.set, r.cls);
      P.fieldBuild(FS.set, r.F, P.fieldSeeds(FS.set, r.cls, fight.knights[r.seat]));
      r.dirty = false; FS.builds++; built++; FS.rr = (FS.rr + i + 1) % n;
    }
  }
  const fieldOf = (fight, seat, cls) => { const FS = fight.fields; if (!FS) return null; const r = FS.list.find(q => q.seat === seat && q.cls === cls); return r && r.F && r.F.built ? r : null; };
  // for the bots: a class of their own (def as proto/physics.js's fieldSet takes it; pinned so its fields are kept with no troll alive)
  function fieldClass(fight, name, def) { const FS = fields(fight); FS.classes[name] = def; if (!FS.pinned.includes(name)) FS.pinned.push(name); FS.set = null; return def; }
  // for the director: the field set over the current box built now (inside a wave's delay, so no step of the fight pays its build), or
  // built again (force: the drawbridge's deck has come into the world)
  function fieldsReady(fight, force) {
    if (!(TROLLS || root.FORGE_TROLLS) || !fight.world.level) return false;
    const FS = fields(fight), box = fieldBox(fight);
    if (force || !FS.set || FS.box.x0 !== box.x0 || FS.box.x1 !== box.x1 || FS.box.y0 !== box.y0 || FS.box.y1 !== box.y1) { FS.set = phys().fieldSet(fight.world, box, FS.classes); FS.box = box; for (const r of FS.list) { r.F = null; r.dirty = true; } }
    return true;
  }
  // the next step of a body toward a knight down the class's field: { x, y, kind: walk | drop | ladder, ladder, dist } (dist: the walking
  // cost left), or null when the field is not built yet or nothing leads on (walk straight, then)
  function nextToward(fight, b, k, cls) {
    const FS = fight.fields, r = fieldOf(fight, k.seat, cls || b.cls);
    if (!r) return null;
    const P = phys(), set = FS.set;
    if (b.x < set.box.x0 - 8 || b.x > set.box.x1 + 8 || b.y < set.box.y0 - 8 || b.y > set.box.y1 + 8) return null;
    const n = P.nodeOf(set, b), nx = P.fieldNext(set, r.F, n);
    if (!nx) return null;
    const [x, y] = P.nodeAt(set, nx.n);
    return { x, y, kind: nx.kind, ladder: nx.ladder, dist: nx.cost, n: nx.n, on: set.on[nx.n] || null };
  }
  const fieldReach = (fight, cls, k) => { const FS = fight.fields; return !FS || !FS.set ? true : phys().fieldReach(FS.set, cls, k); };

  // ------------------------------------------------------------------ the trolls' brains and kits (section 3.5)
  // Every troll spawned with a brain (fight.brains, or spawn's { brain: true }; a scripted troll has none and keeps the intent a test
  // writes) picks a target every 0.5 s, walks down the field toward it (closing, keeping its distance, circling at 30 px when the tokens
  // are taken), and attacks only from inside the view, by its kit. An attack is an act: wind -> strike -> recover (the bolt and the arrow:
  // draw -> loose -> recover; the charge: wind -> run -> recover), its phases read by the painter from f.act, its telegraph emitted at the
  // wind's start. A kit's attacks are families (ATTACK): melee (club, stab, jab), shot (arrow, bolt), ring (slam, rockSlam), charge; a new
  // kind is new numbers in spec/trolls.json and, for a new family, one entry here. A cooldown is the time until the next blow may land
  // (the note's "1.4 s from the strike's start"), so a wind-up starts when the cooldown is down to its own length.
  const ATTACK = { club: "melee", stab: "melee", jab: "melee", arrow: "shot", bolt: "shot", slam: "ring", rockSlam: "ring", charge: "charge" };
  const TOKEN_OF = { melee: "melee", shot: "archers" }, ELEMENT_OF = { "fire-bolt": "fire", "ice-arrow": "ice" };   // what a kind's projectile carries (a reflected one strikes by it)
  const PI = Math.PI;
  function newBrain(fight, f) { return { target: null, rt: 0, circle: f.id % 2 ? 1 : -1, stuck: { t: 0, best: Infinity, tx: null, ty: null, side: false }, spot: null }; }
  // the brain's step, before the body's move: the act in progress, the target, an attack if one may start, else the way
  const heldBy = f => f.st.stun ? "stun" : f.st.freeze ? "freeze" : f.stagger > 0 ? "stagger" : null;
  function brainStep(fight, f, dt) {
    const B = f.brain, K = f.spec, C0 = trollCommon();
    const held = heldBy(f);
    if (held) { if (f.act) cancelAct(fight, f, held, true); f.intent = IDLE; f.moving = false; return; }
    if (f.rock) { f.intent = IDLE; f.moving = false; return; }   // a rock brute picking its rock up
    if (f.post && winchStep(fight, f, dt)) return;   // a winchman at his post
    if (f.act) actStep(fight, f, dt);
    B.rt -= dt;
    const cur = B.target !== null ? fight.knights[B.target] : null;
    if (B.rt <= 0 || !cur || !standing(cur)) { B.rt = C0.retarget || 0.5; pickTarget(fight, f); }
    const k = B.target !== null ? fight.knights[B.target] : null;
    if (f.act) { f.intent = f.act.drive ? { drive: f.act.drive } : IDLE; f.moving = !!f.act.drive; if (f.act.fam === "charge" && f.act.phase === "run") runStep(fight, f, dt); return; }
    if (f.roarDue && !fight.wipe) { beginRoar(fight, f); f.intent = IDLE; f.moving = false; return; }   // the roar waits for the attack in hand to end
    if (!k) { f.intent = IDLE; f.moving = false; return; }
    if (tryAttack(fight, f, k) || f.fixed) { f.intent = IDLE; f.moving = false; if (f.fixed) f.face = Math.atan2(k.y - f.y, k.x - f.x); return; }   // a fixed troll stands where it is and faces its knight
    moveToward(fight, f, k, dt);
    if (B.spotWalk && B.spot) stuckStep(fight, f, dt, B.spot[0], B.spot[1]); else stuckStep(fight, f, dt, k.x, k.y, k.seat);   // a walk to a trench's end is tracked toward its spot
  }
  // the roar's spec of a brute (the rock brute's names the brute's)
  function roarOf(K) { const R = K.roar; return typeof R === "string" ? ((trollSpec()[R] || {}).roar || null) : R || null; }
  // the Emberback's roll (section 3.5): at the start of waves 2 to 5, one roll on fight.rng.waves at 5 %, kept per wave so a wipe is not a
  // re-roll (wave 1 never rolls); on a hit the director replaces one club footman of the wave with it (the middle one in door order)
  function emberRoll(fight, wave) {
    const K = fight.level && fight.rng ? trollKind("emberback") : null;
    if (!K) return false;
    const rolls = fight.level.ember || (fight.level.ember = {});
    if (rolls[wave] === undefined) rolls[wave] = wave >= (K.fromWave || 2) && fight.rng.waves() < (K.chance || 0.05);
    return rolls[wave];
  }
  function beginRoar(fight, f) {
    const R = roarOf(f.spec) || {}, T = Math.max((R.wind || 0.6) * slowX(f) * dX(fight, "windUp"), trollCommon().telegraphMin || 0.45);
    f.act = { kind: "roar", atk: R, fam: "roar", phase: "wind", t: 0, T, seat: null, token: null, drive: null, hits: [], roar: R, tel: { kind: "ring", x: f.x, y: f.y, z: f.z, r: R.radius || 56, grow: T, pulse: true }, ring: { x: f.x, y: f.y, z: f.z, r: R.radius || 56, on: f.on || null } };
    emit(fight, { type: "windUp", foe: f.id, kind: f.kind, attack: "roar", seat: null, x: f.x, y: f.y, z: f.z, wind: T, tel: f.act.tel });
  }
  // the winchman at his post (section 3.5): he works the engine until a knight comes within 40 px, then lets go and fights; when no knight
  // has been within 80 px for 1.5 s he walks back to the post and mans it again in 1.5 s. Returns true while the post has him
  function winchStep(fight, f, dt) {
    const PO = f.post, S = f.spec.post || {}, near = fight.knights.some(k => standing(k) && Math.hypot(k.x - f.x, k.y - f.y) <= (S.leaveWithin || 40) + 1e-9);
    const clear = !fight.knights.some(k => standing(k) && Math.hypot(k.x - f.x, k.y - f.y) <= (S.backWhenClear || 80) + 1e-9);
    if (f.manning) {
      if (near) { f.manning = false; f.clearT = 0; if (f.act && f.act.fam === "heave") f.act = null; emit(fight, { type: "handle", foe: f.id, engine: PO.engine === undefined ? null : PO.engine, on: false, x: f.x, y: f.y }); return false; }
      if (PO.quiet) { if (f.act && f.act.fam === "heave") f.act = null; }   // a quiet engine (the Gallows one before the horn): he stands at the handle
      else { if (!f.act) f.act = { kind: "heave", atk: {}, fam: "heave", phase: "wind", t: 0, T: Infinity, seat: null, token: null, drive: null, hits: [] }; actStep(fight, f, dt); }
      f.intent = IDLE; f.moving = false; f.face = Math.atan2(PO.faceY === undefined ? 0 : PO.faceY - f.y, PO.faceX === undefined ? 1 : PO.faceX - f.x);
      return true;
    }
    if (f.act) return false;   // an attack in hand ends first
    f.clearT = clear ? (f.clearT === undefined ? Infinity : f.clearT + dt) : 0;
    if (!clear) { f.manT = 0; return false; }   // a knight within 80 px: he fights it (the footman's brain)
    if (f.clearT < (S.backAfter || 1.5) - 1e-9) { f.manT = 0; f.intent = IDLE; f.moving = false; f.wantClose = false; return true; }   // the knights gone beyond 80 px: he waits 1.5 s, then goes back
    const dx = PO.x - f.x, dy = PO.y - f.y, dd = Math.hypot(dx, dy);
    if (dd > 3) { const sp = f.speed || f.spec.speed || 42, w = steer(fight, f, dx / dd * sp, dy / dd * sp, dd); f.intent = { wish: w, tilt: 1 }; f.moving = true; f.wantClose = true; f.face = Math.atan2(w[1], w[0]); f.manT = 0; stuckStep(fight, f, dt, PO.x, PO.y); return true; }
    f.intent = IDLE; f.moving = false;
    f.manT = (f.manT || 0) + dt;
    if (f.manT >= (S.man || 1.5) - 1e-9) { f.manning = true; f.manT = 0; emit(fight, { type: "handle", foe: f.id, engine: PO.engine === undefined ? null : PO.engine, on: true, x: f.x, y: f.y }); }
    return true;
  }
  // a winchman's post: { x, y, engine, faceX?, faceY? }; he starts there manning it when `manned` says so (the engine's winchman from the
  // level's start), else he walks to it. Combat.manned(fight, f): is the engine worked this step (manning, not stunned, frozen or staggered)
  function setPost(fight, f, post, manned) {
    f.post = post || null; f.manning = false; f.manT = 0; f.clearT = Infinity; f.act = null;
    if (post && manned) { f.manning = true; emit(fight, { type: "handle", foe: f.id, engine: post.engine === undefined ? null : post.engine, on: true, x: f.x, y: f.y }); }
    return f;
  }
  const manned = (fight, f) => !!(f && !f.dead && !(f.spawn > 0) && f.manning && !heldBy(f));
  // a knight a troll may go for: standing, not frozen (and not just thawed), on a layer the troll's class can come onto (a brute and a
  // roof knight); the first two are waived when no other knight qualifies, since the troll then waits at the nearest reachable cell
  function pickTarget(fight, f) {
    const B = f.brain, K = f.spec, C0 = trollCommon(), bias = C0.lastHitBias || 40;
    const ok = fight.knights.filter(standing);
    if (!ok.length) { B.target = null; return; }
    const warm = ok.filter(k => !(k.frozen > 0) && !(k.noWind > 0) && fieldReach(fight, f.cls, k)), pool = warm.length ? warm : ok;
    const d = k => Math.hypot(k.x - f.x, k.y - f.y) - (f.lastHit === k.seat ? bias : 0);
    let pick = null;
    if (K.tokens === false) {   // a brute: the last knight to hit it, else the knight with the most trolls on it
      const last = pool.find(k => k.seat === f.lastHit);
      if (last) pick = last;
      else { const on = {}; for (const g of fight.foes) if (!g.dead && g.brain && g !== f && g.brain.target !== null) on[g.brain.target] = (on[g.brain.target] || 0) + 1; pick = pool.slice().sort((a, b) => (on[b.seat] || 0) - (on[a.seat] || 0) || a.seat - b.seat)[0]; }
    } else if (K.keep) {   // a ranged troll: the knight with the clearest line, within the archer tokens
      const T = (C0.tokens || {}).archers || 2, free = pool.filter(k => tokensOn(fight, k.seat, "archers", f) < T), src = free.length ? free : pool, clear = src.filter(k => lineClear(fight, f, k) && !trenchCovered(fight, f, k));   // a knight in a trench, covered from here, is not a clear one
      pick = (clear.length ? clear : src).slice().sort((a, b) => d(a) - d(b) || a.seat - b.seat)[0];
    } else pick = pool.slice().sort((a, b) => d(a) - d(b) || a.seat - b.seat)[0];
    B.target = pick ? pick.seat : null;
  }
  // the tokens held on a knight: trolls winding up or striking at it with an attack of that token (not f itself)
  function tokensOn(fight, seat, token, f) { let n = 0; for (const g of fight.foes) if (g !== f && !g.dead && g.act && g.act.seat === seat && g.act.token === token && g.act.phase !== "recover") n++; return n; }
  // the view rule (section 3.5, "Attacks only from inside the view"): a troll's screen feet (y - z) inside the view and at view y 24 or
  // more; an archer's draw box also keeps out of the thumbs' two bottom corners (the area's thumbSafe)
  function inAttackBox(fight, x, y, z) { const v = fight.view, top = (trollCommon().attackInView || {}).feetTop || 24, sy = y - (z || 0); return x >= v.x0 && x <= v.x1 && sy >= v.y0 + top && sy <= v.y1; }
  function inThumb(fight, x, y, z) {
    const v = fight.view, th = (fight.area || {}).thumbSafe; if (!th) return false;
    const sy = y - (z || 0), ab = th.abilityTop || th.h, left = fight.hand === "left";   // the corner under the ability button is raised to abilityTop (the right one unless the page says left-handed)
    if (x <= v.x0 + th.w) return sy >= v.y1 - (left ? ab : th.h);
    if (x >= v.x1 - th.w) return sy >= v.y1 - (left ? th.h : ab);
    return false;
  }
  const inDrawBox = (fight, f, x, y) => inAttackBox(fight, x === undefined ? f.x : x, y === undefined ? f.y : y, f.z) && !inThumb(fight, x === undefined ? f.x : x, y === undefined ? f.y : y, f.z);
  // a clear line for a shot from f to k: nothing that stops a shot along the way at the shot's height (the view's edge is not asked:
  // the archer itself must be in the box)
  function lineClear(fight, f, k, x, y) {
    const P = phys(), W = fight.world, C = data(), fx = x === undefined ? f.x : x, fy = y === undefined ? f.y : y, z0 = (f.z || 0) + (f.chest || 0), z1 = (k.z || 0) + (k.chest !== undefined ? k.chest : C.knight.chest);
    const d = Math.hypot(k.x - fx, k.y - fy), n = Math.max(1, Math.ceil(d / 6));
    let pz = z0;
    for (let i = 1; i < n; i++) { const t = i / n, px = fx + (k.x - fx) * t, py = fy + (k.y - fy) * t, z = z0 + (z1 - z0) * t; const s = P.shotStop(W, px, py, z, pz); if (s && s.solid) return false; pz = z; }
    return true;
  }
  // a clear way for a body of f's size along a line (the charge): its circle swept along it meets no solid at its height
  function wayClear(fight, f, ux, uy, len) {
    const P = phys(), W = fight.world, probe = { x: f.x, y: f.y, z: f.z, r: f.r, h: f.h };
    for (let t = 4; t <= len; t += 4) { probe.x = f.x + ux * t; probe.y = f.y + uy * t; if (P.caught(W, probe) || P.groundAt(W, probe.x, probe.y).deep) return false; }
    return true;
  }
  const slowX = f => f.st.slow ? 1.25 : 1, weakX = f => f.st.weaken ? 1 - data().statuses.weaken.less : 1;   // statuses on trolls: x 1.25 wind-up, 40 % less damage
  // may an attack start now? the common gates, then the family's own
  function tryAttack(fight, f, k) {
    const K = f.spec, A = K.attacks || {}, C0 = trollCommon(), names = Object.keys(A).sort((a, b) => (ATTACK[a] === "melee" ? 0 : 1) - (ATTACK[b] === "melee" ? 0 : 1));
    if (!standing(k) || k.frozen > 0 || k.noWind > 0 || fight.wipe) return false;
    if (f.climbing || !inAttackBox(fight, f.x, f.y, f.z)) return false;   // nobody strikes from a ladder (section 3.2b)
    for (const name of names) {
      let atk = A[name]; if (typeof atk === "string") atk = ((trollSpec()[atk] || {}).attacks || {})[name];   // "club": "footman"
      const fam = ATTACK[name]; if (!atk || !fam) continue;
      const windT = (atk.wind || atk.draw || 0) * slowX(f);
      if ((f.cd[name] || 0) > windT + 1e-9) continue;
      const token = K.tokens === false || (fam === "melee" && K.keep) ? null : TOKEN_OF[fam] || null;   // a ranged kind's stab or jab takes no token
      if (token && tokensOn(fight, k.seat, token, f) >= ((C0.tokens || {})[token] || 2)) continue;
      const start = FAMILY[fam].can(fight, f, k, atk, name);
      if (!start) continue;
      beginAct(fight, f, k, name, atk, fam, token, windT, start);
      return true;
    }
    return false;
  }
  function beginAct(fight, f, k, name, atk, fam, token, windT, start) {
    f.face = Math.atan2(k.y - f.y, k.x - f.x);
    f.act = Object.assign({ kind: name, atk, fam, phase: "wind", t: 0, T: Math.max(windT * dX(fight, "windUp"), trollCommon().telegraphMin || 0.45), seat: k.seat, token, drive: null, hits: [] }, start);   // a difficulty's wind-up never goes under telegraphMin
    emit(fight, { type: "windUp", foe: f.id, kind: f.kind, attack: name, seat: k.seat, x: f.x, y: f.y, z: f.z, wind: f.act.T, tel: f.act.tel || null });
  }
  // an act's clock: at the end of a phase the family moves it on (the blow lands at the strike's start)
  function actStep(fight, f, dt) {
    const A = f.act, F = FAMILY[A.fam];
    A.t += dt;
    if (F.during) F.during(fight, f, A, dt);
    if (A.t < A.T - 1e-9) return;
    if (A.phase === "wind") { A.t = 0; F.strike(fight, f, A); if (f.act !== A) return; if (A.phase === "wind") { A.phase = "recover"; A.T = A.atk.recover || 0.6; } }
    else if (A.phase === "strike") { A.phase = "recover"; A.t = 0; A.T = A.atk.recover || 0.6; }
    else if (A.phase === "run") { if (A.t > A.T + 0.5) runEnd(fight, f, A, "range", 0); }   // the run ends on what it meets or at its length (runStep); this is the safety
    else if (A.phase === "recover") { f.act = null; if (A.after) A.after(fight, f); }
  }
  // a knight the troll's target stands at (k), or the tower's legs when it chops them (A.legs): the melee blow's landing
  function landBlow(fight, f, A, dmg, o) {
    const S = data().statuses, k = fight.knights[A.seat];
    if (f.st.blind && fight.rand() < S.blind.miss) { emit(fight, { type: "miss", foe: f.id, attack: A.kind, x: f.x, y: f.y }); return "miss"; }
    return hurt(fight, k, dmg * weakX(f) * dX(fight, "trollDamage"), Object.assign({ melee: true, from: [f.x, f.y], src: f.kind + "." + A.kind }, o));
  }
  const FAMILY = {
    // a club, a stab, a jab: begun when the target is within range (feet to feet, plus its r) and within 12 px of height; the blow is an
    // arc in front of the troll (100 degrees, 20 px of reach for the club; a stab lands on its target alone)
    melee: {
      can(fight, f, k, atk) {
        if (!reaches(fight, f, k) || Math.hypot(k.x - f.x, k.y - f.y) > atk.range + 1e-9) return null;   // "within 22 px": centre to centre
        if (k.climbing && onMyLadder(f, k)) {   // a climber of its own ladder (section 3.15): the stab is begun only when it will land after the knight arrives and inside its 0.25 s of arrival safety
          const L = k.climbing.ladder, N = data().physics, T = Math.max((atk.wind || 0) * slowX(f) * dX(fight, "windUp"), trollCommon().telegraphMin || 0.45), arrive = (L.h - (k.z || 0)) / (k.climb ? k.climb[0] : 30);
          if (T < arrive - 1e-9 || T > arrive + N.climb.arriveSafe + 1e-9) return null;
        }
        return { tel: { kind: "glint" } };
      },
      strike(fight, f, A) {
        const atk = A.atk, k = fight.knights[A.seat];
        f.cd[A.kind] = atk.cooldown || 1.4;
        A.phase = "strike"; A.T = atk.strike || 0.1;
        if (A.legs) { chopLegs(fight, f, A); return; }
        const dd = Math.hypot(k.x - f.x, k.y - f.y), reach = (atk.reach || atk.range) + k.r, within = Math.abs(angDiff(Math.atan2(k.y - f.y, k.x - f.x), f.face)) <= ((atk.arc || 100) / 2) * RAD + 1e-9;
        let res = "miss";
        if (standing(k) && dd <= reach + 1e-9 && within && reaches(fight, f, k)) res = landBlow(fight, f, A, atk.damage, { push: atk.push, stagger: atk.stagger, sets: atk.sets });
        emit(fight, { type: "foeStrike", foe: f.id, attack: A.kind, seat: A.seat, res, x: f.x, y: f.y, z: f.z });
      }
    },
    // an arrow or a bolt: a draw that tracks its target with lead for its first part, then locks and shows the aim line; the loose flies
    // along the line shown. Begun on a clear line, within the shot's range, from inside the draw box
    shot: {
      can(fight, f, k, atk) {
        if (!inDrawBox(fight, f) || !lineClear(fight, f, k) || onMyLadder(f, k) || trenchCovered(fight, f, k)) return null;   // no draw at a knight its trench covers; the rim guards the head: no draw on a climber of its own ladder (the stab takes over at z 18)
        if (Math.hypot(k.x - f.x, k.y - f.y) > (atk.range || 200)) return null;
        return { tel: { kind: "draw" }, aim: aimAt(fight, f, k, atk, (atk.draw || 0) * slowX(f) - (atk.track || 0) * slowX(f)), locked: false };
      },
      during(fight, f, A, dt) {
        const atk = A.atk, k = fight.knights[A.seat], track = (atk.track || 0) * slowX(f);
        if (onMyLadder(f, k)) { cancelAct(fight, f, "climber"); return; }
        if (!A.locked && A.t < track - 1e-9) { if (standing(k)) A.aim = aimAt(fight, f, k, atk, A.T - A.t); return; }
        if (!A.locked) { A.locked = true; A.from = { x: f.x, y: f.y, z: f.z, chest: f.chest, id: f.id }; f.face = Math.atan2(A.aim.y - f.y, A.aim.x - f.x); emit(fight, { type: "aimLine", foe: f.id, attack: A.kind, seat: A.seat, x0: f.x, y0: f.y, z0: (f.z || 0) + (f.chest || 0), x1: A.aim.x, y1: A.aim.y, z1: A.aim.z, show: A.T - A.t }); }
      },
      strike(fight, f, A) {
        const atk = A.atk, S = data().statuses, proj = atk.projectile || "troll-arrow";
        f.cd[A.kind] = atk.cooldown || 2.2;
        if (f.st.blind && fight.rand() < S.blind.miss) emit(fight, { type: "miss", foe: f.id, attack: A.kind, x: f.x, y: f.y });
        else foeShot(fight, A.from || f, [A.aim.x, A.aim.y], { z: A.aim.z, aloft: (f.z || 0) > 0 || A.aim.z > 0, speed: atk.speed, range: atk.reach || atk.range, r: atk.hitR, damage: atk.damage * weakX(f) * dX(fight, "trollDamage"), push: atk.push, stagger: atk.stagger, kind: proj, src: f.kind + "." + A.kind, sets: atk.sets, miss: atk.miss || null, element: atk.element || ELEMENT_OF[proj] || null, woodDamage: atk.woodDamage, attack: A.kind });   // loosed from where it stood at the lock, along the line shown
        A.phase = "recover"; A.T = atk.recover || 0.4;
      }
    },
    // a slam: a ring on the surface ahead of the troll; at the impact every knight touching it (on that surface) is hit. The rock slam's ring
    // has a core (r 14: 30, a 30 px push, a 0.5 s stagger) inside its outer ring (to r 30: 16, a 20 px push), opens a crater and throws
    // chunks, and its recover (the rock lying in the crater) is followed by the lift; a rock brute whose rock lies dropped cannot slam
    ring: {
      can(fight, f, k, atk) {
        if (!reaches(fight, f, k, atk.range) || (atk.core && f.rock)) return null;
        const a = Math.atan2(k.y - f.y, k.x - f.x), r = atk.radius || (atk.outer || {}).r || 26, x = f.x + Math.cos(a) * (atk.ahead || 24), y = f.y + Math.sin(a) * (atk.ahead || 24);
        const tel = { kind: "ring", x, y, z: f.z, r, grow: (atk.wind || 0.9) * slowX(f) };
        if (atk.core) tel.inner = atk.core.r;
        return { tel, ring: { x, y, z: f.z, r, on: f.on || null } };
      },
      strike(fight, f, A) {
        const atk = A.atk, R = A.ring, src = f.kind + "." + A.kind, zr = data().physics.z.burst, S = data().statuses;
        let hit;
        if (f.st.blind && fight.rand() < S.blind.miss) { hit = []; emit(fight, { type: "miss", foe: f.id, attack: A.kind, x: f.x, y: f.y }); }   // blind: half its attacks miss (section 3.5); the ground is still struck
        else if (atk.core) {
          hit = [];
          for (const k of fight.knights) {
            if (k.out || k.down || Math.abs((k.z || 0) - R.z) > zr + 1e-9) continue;
            const dd = Math.hypot(k.x - R.x, k.y - R.y), Z = dd <= atk.core.r + k.r + 1e-9 ? atk.core : dd <= atk.outer.r + k.r + 1e-9 ? atk.outer : null;
            if (!Z) continue;
            hit.push({ seat: k.seat, res: hurt(fight, k, Z.damage * weakX(f) * dX(fight, "trollDamage"), { melee: true, from: [R.x, R.y], push: Z.push, stagger: Z.stagger, src }), zone: Z === atk.core ? "core" : "outer" });
          }
        } else hit = foeBurst(fight, R.x, R.y, R.z, R.r, { damage: atk.damage * weakX(f) * dX(fight, "trollDamage"), push: atk.push, stagger: atk.stagger, melee: true, from: [f.x, f.y], src });
        f.cd[A.kind] = atk.cooldown || 2.8;
        emit(fight, { type: "foeStrike", foe: f.id, attack: A.kind, seat: A.seat, hit: hit.map(h => h.seat), x: R.x, y: R.y, z: R.z, r: R.r });
        if (atk.shake) emit(fight, { type: "shake", amp: atk.shake, time: data().feel.shakeT });
        if (atk.crater || atk.chunks) rockImpact(fight, f, A);
        if (A.impact) A.impact(fight, f, A);   // a later kind's own doing at the impact
        A.phase = "recover"; A.T = (atk.recover || 1.1) + (atk.lift || 0); if (atk.lift) A.lift = atk.lift;
      }
    },
    // the roar (both brutes, once, the first time its HP falls to half): a 0.60 s wind with a ring pulsing out to r 56, then every knight
    // within 56 px is pushed 28 px straight away and staggered 0.3 s, with no damage, and two footmen are called out of the gate's arch
    // (1.0 and 2.0 s after; the director sends them, from fight.level.calls). It has no target, takes no token, and cannot be interrupted
    roar: {
      can() { return null; },   // begun by the brain itself (beginRoar), never by tryAttack
      strike(fight, f, A) {
        const R = A.roar, zr = data().physics.z.burst, P = phys(), W = fight.world, seats = [];
        for (const k of fight.knights) {
          if (!standing(k) || Math.abs((k.z || 0) - (f.z || 0)) > zr + 1e-9 || Math.hypot(k.x - f.x, k.y - f.y) > (R.radius || 56) + k.r + 1e-9) continue;
          // no safety spares it (section 3.8's dodge list has no roar, and it deals no damage): a dodging, lifted or risen knight is pushed too
          const dd = Math.hypot(k.x - f.x, k.y - f.y), a = dd > 1e-6 ? Math.atan2(k.y - f.y, k.x - f.x) : f.face;
          P.push(W, k, Math.cos(a), Math.sin(a), R.push || 28); stagger(fight, k, R.stagger || 0.3);
          if (k.climbing) { P.letGo(W, k, true); emit(fight, { type: "letGo", x: k.x, y: k.y, z: k.z }, k); }
          seats.push(k.seat);
        }
        f.roared = true; f.roarDue = false;
        const calls = [];
        for (let i = 0; i < (R.calls || 0); i++) calls.push({ at: fight.t + (R.callEvery || 1.0) * (i + 1), kind: "footman", from: R.from || "gate", pastCap: R.pastCap !== false, by: f.id });
        if (fight.level) fight.level.calls = (fight.level.calls || []).concat(calls);
        emit(fight, { type: "roar", foe: f.id, kind: f.kind, x: f.x, y: f.y, z: f.z, r: R.radius || 56, hit: seats, calls: calls.length, callEvery: R.callEvery || 1.0, from: R.from || "gate", pastCap: R.pastCap !== false });
        A.phase = "recover"; A.T = R.recover || 0.5;
      }
    },
    // the winchman's heave at the trebuchet's handle (stage E's engine runs the cycle while Combat.manned says he works it): an act that
    // holds until a knight comes within 40 px, its frames turning every 0.5 s
    heave: {
      can() { return null; },
      during(fight, f, A) { const ph = Math.floor(A.t / 0.5) & 1 ? "strike" : "wind"; if (ph !== A.phase) { A.phase = ph; if (ph === "strike") emit(fight, { type: "heave", foe: f.id, engine: f.post ? f.post.engine : null, x: f.x, y: f.y }); } },
      strike() {}
    },
    // a charge: a straight run fixed at the wind's start, a drive in the move function, that ends on what it meets
    charge: {
      can(fight, f, k, atk) {
        const dd = Math.hypot(k.x - f.x, k.y - f.y);
        if (dd < (atk.from || 60) || dd > (atk.to || 120) || Math.abs((k.z || 0) - (f.z || 0)) > data().physics.z.melee) return null;
        const ux = (k.x - f.x) / dd, uy = (k.y - f.y) / dd, len = Math.min(atk.max || 120, dd + f.r);
        if (!wayClear(fight, f, ux, uy, Math.min(len, dd - k.r - f.r))) return null;
        if (!inAttackBox(fight, f.x + ux * len, f.y + uy * len, f.z)) return null;   // its whole path inside the box
        return { tel: { kind: "strip", x0: f.x, y0: f.y, x1: f.x + ux * len, y1: f.y + uy * len, w: f.r * 2 }, ux, uy, len };
      },
      strike(fight, f, A) {
        const atk = A.atk;
        f.cd[A.kind] = atk.cooldown || 6;
        A.phase = "run"; A.T = (A.len / (atk.speed || 160)) + 1e-6; A.drive = { kind: "run", ux: A.ux, uy: A.uy, speed: atk.speed || 160, left: A.len }; A.x0 = f.x; A.y0 = f.y;
        if (f.st.blind && fight.rand() < data().statuses.blind.miss) { A.blindMiss = true; emit(fight, { type: "miss", foe: f.id, attack: A.kind, x: f.x, y: f.y }); }   // blind: the run hits nobody (section 3.5)
        f.intent = { drive: A.drive };
        emit(fight, { type: "charge", foe: f.id, x: f.x, y: f.y, x1: f.x + A.ux * A.len, y1: f.y + A.uy * A.len });
      }
    }
  };
  // a knight climbing the ladder of the troll's own platform (the deck archer's)
  const onMyLadder = (f, k) => !!(k.climbing && f.on && k.climbing.ladder.deck === f.on);
  // where a shot is aimed: the target's feet where they will be when the shot arrives if it keeps walking as it is (the draw's time left
  // after the lock and the flight; at most leadMax px of lead), at its chest's height
  function aimAt(fight, f, k, atk, left) {
    const dt = data().step || 1 / 60, vx = k.sx === undefined ? 0 : (k.x - k.sx) / dt, vy = k.sy === undefined ? 0 : (k.y - k.sy) / dt, sp = Math.hypot(vx, vy);
    const d = Math.hypot(k.x - f.x, k.y - f.y), fly = d / (atk.speed || 150) + Math.max(0, left || 0), lead = Math.min(sp * fly, atk.leadMax || 48);
    const x = k.x + (sp > 1e-6 ? vx / sp * lead : 0), y = k.y + (sp > 1e-6 ? vy / sp * lead : 0);
    return { x, y, z: (k.z || 0) + (k.chest !== undefined ? k.chest : data().knight.chest) };
  }
  // the charge's run: a knight in the path is hit and shoved aside; what the brute meets ends it by the table (section 3.5): a solid that
  // stuns (rocks, carts, the mill, the chapel, an engine, a boulder) stuns it 1.2 s; a hut takes 60 and stuns it; a stake fence breaks,
  // wire tears (the move's contact rule), a clod breaks; a palisade, rubble, a lip or a knight against a solid stop it with no stun, as
  // does its first step into a crater
  function runStep(fight, f, dt) {
    const A = f.act, atk = A.atk, P = phys(), W = fight.world, D = A.drive;
    for (const k of fight.knights) {
      if (A.hits.includes(k.seat) || !standing(k) || Math.abs((k.z || 0) - (f.z || 0)) > data().physics.z.melee) continue;
      const dx = k.x - f.x, dy = k.y - f.y, along = dx * A.ux + dy * A.uy;
      if (along < -2 || Math.hypot(dx, dy) > f.r + k.r + 2) continue;
      A.hits.push(k.seat);
      const res = A.blindMiss ? "miss" : hurt(fight, k, (atk.damage || 16) * weakX(f), { melee: true, from: [f.x, f.y], src: f.kind + ".charge" });
      const side = dx * -A.uy + dy * A.ux >= 0 ? 1 : -1;
      if (res !== "safe" && res !== "none" && res !== "miss") P.push(W, k, -A.uy * side, A.ux * side, atk.shove || 32);
      emit(fight, { type: "foeStrike", foe: f.id, attack: "charge", seat: k.seat, res, x: f.x, y: f.y, z: f.z });
    }
    let end = null, stun = 0;
    for (const c of f.contacts || []) {
      if (c.kind !== "solid") continue;
      const s = c.s, piece = s.piece || null;
      if (s.gone) continue;
      if (piece && (piece.kind === "hut" || piece.kind === "tent")) { damage(fight, piece, atk.hutDamage || 60, "charge", [f.x, f.y], f); end = "hut"; stun = atk.stun || 1.2; break; }
      if (s.contact === "stakes" || s.kind === "clod") { if (piece && !piece.gone) breakPiece(fight, piece, [f.x, f.y], f); else if (s.kind === "clod") P.removeSolid(W, s); continue; }   // smashed through
      if (s.contact === "wire") continue;   // torn by the move's contact rule
      if (s.stun) { end = "solid"; stun = s.stun; break; }
      end = s.kind; break;
    }
    if (!end) {
      const moved = Math.hypot(f.x - (A.px === undefined ? A.x0 : A.px), f.y - (A.py === undefined ? A.y0 : A.py));
      if (A.px !== undefined && moved < D.speed * dt * (((data().physics.contact || {}).charge || {}).blocked || 0.3) - 1e-9) end = "blocked";   // less than 30 % of its step: something holds it
      else if (P.coverOf(W, f).kind === "crater" && ((data().physics.contact || {}).charge || {}).endsIn && data().physics.contact.charge.endsIn.includes("crater")) end = "crater";
    }
    A.px = f.x; A.py = f.y;
    if (D.done && !end) end = "range";
    if (end) runEnd(fight, f, A, end, stun);
  }
  function runEnd(fight, f, A, why, stun) {
    if (A.drive) { A.drive.done = true; A.drive = null; }
    f.intent = IDLE;
    if (stun > 0) { f.st.stun = { t: stun }; emit(fight, { type: "status", d: f.i, status: "stun", stacks: null }); }
    emit(fight, { type: "chargeEnd", foe: f.id, why, stun, x: f.x, y: f.y, z: f.z });
    A.phase = "recover"; A.t = 0; A.T = A.atk.recover || 0.8;
  }
  // the way to the target: the melee kinds close (64 px/s within 60 px), circling at 30 px when the tokens on their knight are taken;
  // the ranged kinds keep their distance (keep: [lo, hi]), back off at their own speed when the knight comes near, and sidestep up to
  // 40 px for a clear line inside the draw box; the brutes walk straight and slow. Down the field where it is built, straight when the
  // target is near and the way to it is clear, or when the field has nothing to say
  // f.wantClose: the troll is trying to come nearer its target (the stuck rule watches only that); false while it waits by design: circling
  // for a token, queued at the ladder, a ranged kind holding or backing off, a troll held to its platform, a target its class cannot reach
  function moveToward(fight, f, k, dt) {
    const K = f.spec, B = f.brain, C0 = trollCommon(), P = phys(), W = fight.world;
    const dx = k.x - f.x, dy = k.y - f.y, dd = Math.hypot(dx, dy), ux = dd > 1e-9 ? dx / dd : 1, uy = dd > 1e-9 ? dy / dd : 0;
    let speed = f.speed || K.speed || 42, wish = null, tilt = 1, drop = false, closing = true;   // f.speed: the kind's, by the difficulty
    const held = f.hold && f.on ? W.platBy[f.on] : null;   // held to its platform (the tower archer): it never leaves it
    const onPlat = (x, y) => !held || P.inPlat(held, x, y);
    if (K.keep) {
      const lo = K.keep[0], hi = K.keep[1], BO = K.backOff || {}, within = BO.within || 48, toward = (x, y) => { const sx = x - f.x, sy = y - f.y, sd = Math.hypot(sx, sy); return sd > 1e-6 ? [sx / sd * speed, sy / sd * speed] : [0, 0]; };
      const go = (x, y) => { const w = toward(x, y); return steer(fight, f, w[0], w[1], Math.hypot(x - f.x, y - f.y)); }, moving = w => !!w && Math.hypot(w[0], w[1]) > 1e-6;   // steer looks no further than the spot (stage E)
      // its own walks never carry it out of its arena or the view (section 3.15: an archer walks into the view's box before it draws): the
      // part of a wish that would cross the box's edge is dropped. A back-off is steered round what stands in its way and runs only where
      // it really takes it away from the knight; where the box stops it, it stands and draws from there when its line is clear. A target
      // in a trench covered from here sends it toward the trench's nearer end (its spot, at its keep distance) until its line runs along
      // the trench (section 3.5), a walk finished once begun while the knight keeps to the trench; the keep distance yields to that walk,
      // the 48 px back-off does not (the walk goes on after it); within 56 px of the knight the walk skirts it (never nearer) when its
      // spot lies beyond
      const box = walkBox(fight, f, k), inDraw = inDrawBox(fight, f);
      const slide = w => { const l = Math.hypot(w[0], w[1]); if (l < 1e-6) return w; const x = f.x + w[0] / l * 8, y = f.y + w[1] / l * 8; return [x < box.x0 || x > box.x1 ? 0 : w[0], y < box.y0 || y > box.y1 ? 0 : w[1]]; };
      const away = w => { const s = slide(steer(fight, f, w[0], w[1])), l = Math.hypot(s[0], s[1]); return l < 1e-6 || (s[0] * -ux + s[1] * -uy) / l < 0.3 ? [0, 0] : s; };   // [0, 0]: wanted, but the box stops it
      const back = !held && dd < within ? away([-ux * (BO.speed || speed), -uy * (BO.speed || speed)]) : null;
      const walking = !!(B.spotWalk && B.spot && Math.hypot(B.spot[0] - f.x, B.spot[1] - f.y) > 2);
      const end = !held && (walking || trenchCovered(fight, f, k)) ? trenchEnd(fight, f, k) : null;
      if (!end && B.spotWalk) B.spot = null;   // the trench walk is over: its spot is no sidestep spot
      B.spotWalk = !!end;
      let picked = true;
      if (end && moving(back)) { B.spot = end; speed = BO.speed || speed; wish = back; closing = false; }   // the back-off first; the walk goes on after it
      else if (end) {
        B.spot = end; let w = toward(end[0], end[1]);
        if (dd < within + 8 && Math.hypot(end[0] - k.x, end[1] - k.y) > within + 8) { const inward = w[0] * ux + w[1] * uy; if (inward > 0) { const wx = w[0] - ux * inward, wy = w[1] - uy * inward, wl = Math.hypot(wx, wy); w = wl > 1e-6 ? [wx / wl * speed, wy / wl * speed] : [0, 0]; } }
        wish = slide(steer(fight, f, w[0], w[1], Math.hypot(end[0] - f.x, end[1] - f.y)));
      }
      else if (back) { speed = BO.speed || speed; wish = back; closing = false; }
      else if (dd < lo && !held) { const w = away([-ux * speed, -uy * speed]); if (moving(w) || inDraw) { wish = w; closing = false; } else picked = false; }   // outside the draw box with the way back blocked: it looks for a spot instead
      else if (dd > hi && !held) wish = null;   // approach, by the field below
      else picked = false;
      if (!picked) {
        // holding: a spot inside the draw box with a clear line, sidestepping up to `sidestep` px across the line, preferring a spot
        // covered from the other knights
        const going = B.spot && B.spotCovered && Math.hypot(B.spot[0] - f.x, B.spot[1] - f.y) >= 2;   // on its way to a covered spot it finishes the walk
        const here = !going && inDraw && lineClear(fight, f, k);
        closing = false;
        if (here) { B.spot = null; wish = [0, 0]; f.face = Math.atan2(dy, dx); }
        else {
          if (!B.spot || Math.hypot(B.spot[0] - f.x, B.spot[1] - f.y) < 2) { B.spot = bestSpot(fight, f, k); B.spotCovered = !!(B.spot && B.spot.covered); }
          if (B.spot) wish = go(B.spot[0], B.spot[1]);
          else if (held) { if (!inDraw && onPlat(f.x + ux * 8, f.y + uy * 8)) { wish = [ux * speed, uy * speed]; closing = true; } else { wish = [0, 0]; f.face = Math.atan2(dy, dx); } }   // outside the box with no spot across the line: it walks toward its knight along its platform into the box; nowhere better: it stands
          else { wish = null; closing = true; }   // nowhere to stand here: walk toward the knight, into the box
        }
      }
    } else if (K.close && dd <= (K.close.within || 60)) speed = K.close.speed || speed;
    // the melee kinds with the tokens on their knight taken circle at 30 px
    if (!K.keep && K.tokens !== false && wish === null) {
      const T = (C0.tokens || {}).melee || 2, taken = tokensOn(fight, k.seat, "melee", f) >= T, ring = C0.circle || 30;
      if (taken && dd < ring + 24) {
        const tx = -uy * B.circle, ty = ux * B.circle, rad = dd < ring - 4 ? -1 : dd > ring + 4 ? 1 : 0;
        const wx = tx + ux * rad * 0.6, wy = ty + uy * rad * 0.6, wl = Math.hypot(wx, wy);
        wish = [wx / wl * speed, wy / wl * speed]; f.face = Math.atan2(dy, dx); closing = false;
      }
    }
    if (wish === null) {
      const nx = nextToward(fight, f, k, f.cls), near = dd <= 48 && Math.abs((k.z || 0) - (f.z || 0)) <= data().physics.z.melee && wayClear(fight, f, ux, uy, Math.max(0, dd - f.r - k.r));
      if (f.climbing) { const L = f.climbing.ladder; f.intent = { wish: [0, 0], climb: k.on === L.deck || (k.z || 0) > 12 ? 1 : -1 }; f.moving = true; f.wantClose = false; return; }   // on the ladder: up to a deck knight, else down
      if (held && nx && (nx.kind !== "walk" || nx.on !== f.on)) { wish = [0, 0]; closing = false; f.face = Math.atan2(dy, dx); }   // the way leads off its platform: it stays
      else if (nx && !near) {
        if (nx.kind === "ladder") { wish = ladderWish(fight, f, nx.ladder, speed); if (!wish) { f.wantClose = false; return; } }
        else { const sx = nx.x - f.x, sy = nx.y - f.y, sd = Math.hypot(sx, sy); wish = sd > 1e-6 ? [sx / sd * speed, sy / sd * speed] : [0, 0]; if (nx.kind === "drop") drop = true; }
      } else if (!near && !fieldReach(fight, f.cls, k)) { wish = [0, 0]; closing = false; f.face = Math.atan2(dy, dx); }   // its class cannot reach the knight (a brute, a roof knight): it waits at the nearest cell it could reach
      else if (held && !onPlat(f.x + ux * 8, f.y + uy * 8)) { wish = [0, 0]; closing = false; f.face = Math.atan2(dy, dx); }
      else wish = [ux * speed, uy * speed];
    }
    f.intent = drop ? { wish, tilt, drop: true } : { wish, tilt };
    f.moving = Math.hypot(wish[0], wish[1]) > 1e-6;
    f.wantClose = closing && f.moving;
    if (f.moving && !K.keep) f.face = Math.atan2(wish[1], wish[0]);
  }
  // a ranged troll's spot when its line is blocked: across the line at 8 px steps up to its sidestep (40 px), its own side first, inside the
  // draw box, on its platform if held, with a clear line to its target; of those, the one covered from the most other knights (a solid
  // that stops shots, or wire, between). null when there is none
  function bestSpot(fight, f, k) {
    const K = f.spec, B = f.brain, P = phys(), W = fight.world, held = f.hold && f.on ? W.platBy[f.on] : null;
    const atk = Object.values(K.attacks || {}).find(a => a && ATTACK[Object.keys(K.attacks).find(n => K.attacks[n] === a)] === "shot") || {};
    const dx = k.x - f.x, dy = k.y - f.y, dd = Math.hypot(dx, dy) || 1, px = -dy / dd, py = dx / dd, max = atk.sidestep || 40, others = fight.knights.filter(q => q !== k && standing(q));
    let best = null, bestScore = -1;
    for (let s = 8; s <= max; s += 8) for (const sgn of [B.circle, -B.circle]) {
      const x = f.x + px * s * sgn, y = f.y + py * s * sgn;
      if ((held && !P.inPlat(held, x, y)) || !inDrawBox(fight, f, x, y) || !lineClear(fight, f, k, x, y) || P.caught(W, { x, y, z: f.z, r: f.r, h: f.h, on: f.on })) continue;
      let score = 0; for (const q of others) if (!lineClear(fight, f, q, x, y) || wireBetween(fight, x, y, q)) score++;
      if (score > bestScore) { bestScore = score; best = [x, y]; best.covered = score > 0; }
      if (!others.length) return best;
    }
    return best;
  }
  // an archer's target in a trench, covered from the archer's line (section 3.3's trench cover): its arrow would fly over
  function trenchCovered(fight, f, k) { return trenchCover(fight, { fx: f.x, fy: f.y, a: Math.atan2(k.y - f.y, k.x - f.x) }, k); }
  // a walk to a spot (an archer's sidestep, the trench's end, the winchman's post) is not led by the field, so it steers round what stands in
  // its way: the wish turned to the first clear way within 120 degrees, 6 px ahead of its edge
  function steer(fight, f, wx, wy, len) {
    const P = phys(), W = fight.world, sp = Math.hypot(wx, wy); if (sp < 1e-6) return [wx, wy];
    const probe = { x: 0, y: 0, z: f.z || 0, r: f.r, h: f.h, on: f.on || null }, a0 = Math.atan2(wy, wx), look = len === undefined ? f.r + 6 : Math.max(0.5, Math.min(f.r + 6, len));   // never past the spot itself (a spot by a parapet is free, the step beyond it is not)
    for (const da of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.1, -2.1]) { const a = a0 + da; probe.x = f.x + Math.cos(a) * look; probe.y = f.y + Math.sin(a) * look; if (!P.caught(W, probe) && !P.groundAt(W, probe.x, probe.y).deep) return [Math.cos(a) * sp, Math.sin(a) * sp]; }
    return [wx, wy];
  }
  // the spot from which the line runs along the trench (within 30 degrees of its length): on the trench's axis through the knight, toward
  // the trench's nearer end, at the archer's keep distance (out to its far keep, else in to its 48 px back-off: never nearer, or the
  // back-off would never let it stand there, and never past its shot's range), inside the trench itself when the trench is long; kept
  // inside the arena (the director's fight.level.arena, else the area's arena holding the knight, else the fields' box), the view and the
  // draw box (off the thumbs: pulled up out of a corner), on free floor; the other end's way when the nearer gives none; null when neither
  // does (the archer holds, or picks another knight)
  function trenchEnd(fight, f, k) {
    const P = phys(), W = fight.world, H = P.groundAt(W, k.x, k.y).hole; if (!H || H.shape !== "r") return null;
    const K = f.spec, along = H.x1 - H.x0 >= H.y1 - H.y0, lo = (K.keep || [90, 140])[0], hi = (K.keep || [90, 140])[1], near = (K.backOff || {}).within || 48, fold0 = (K.trenchLine || 30) * RAD, v = fight.view, top = (trollCommon().attackInView || {}).feetTop || 24;
    const range = Math.max(0, ...Object.values(K.attacks || {}).map(a => a && typeof a === "object" ? (a.range || a.reach || 0) : 0)) || 200;
    const box = walkBox(fight, f, k), y0 = Math.max(box.y0, v.y0 + top + (f.z || 0)), y1 = box.y1, ds = [];
    for (let d = lo; d <= hi + 1e-9; d += 8) ds.push(d);
    for (let d = lo - 8; d >= near - 1e-9; d -= 8) ds.push(d);
    const ends = along ? [[H.x0 - 16, k.y], [H.x1 + 16, k.y]] : [[k.x, H.y0 - 16], [k.x, H.y1 + 16]];
    ends.sort((a, b) => Math.hypot(a[0] - f.x, a[1] - f.y) - Math.hypot(b[0] - f.x, b[1] - f.y));
    const probe = { x: 0, y: 0, z: 0, r: f.r, h: f.h, on: null };
    for (const e of ends) {
      const ex = along ? Math.sign(e[0] - k.x) : 0, ey = along ? 0 : Math.sign(e[1] - k.y);
      for (const d of ds) {
        const x = clamp(k.x + ex * d, box.x0, box.x1);
        let y = clamp(k.y + ey * d, y0, y1);
        for (let n = 0; n < 40 && inThumb(fight, x, y, f.z) && y - 4 >= y0; n++) y -= 4;   // out of a thumb's corner, up toward the view's middle
        probe.x = x; probe.y = y;
        const dd = Math.hypot(x - k.x, y - k.y);
        if (dd < near - 1e-9 || dd > range - 10 || !inDrawBox(fight, f, x, y) || P.caught(W, probe) || P.groundAt(W, x, y).deep) continue;
        const off = Math.abs(angDiff(Math.atan2(k.y - y, k.x - x), along ? 0 : Math.PI / 2)), fold = Math.min(off, Math.PI - off);
        if (fold > fold0 + 1e-9) continue;
        return [x, y];
      }
    }
    return null;
  }
  // the box a ranged troll keeps to when it walks of itself (a back-off, a trench's end): its own box (the director's arena box, else the
  // floor) cut to its arena's x range (fight.level.arena, else the area's arena holding its knight, else the fields' box) and the view
  function walkBox(fight, f, k) {
    const F = fight.floor, W = fight.world, b = W.boxOf ? W.boxOf(f) : F, v = fight.view, L = fight.level, A = fight.area || {};
    const ar = (L && L.arena && L.arena.x0 !== undefined) ? L.arena : (A.arenas || []).find(a => k.x >= a.x0 && k.x < a.x1) || fieldBox(fight);
    const box = { x0: Math.max(b.x0, ar.x0, v ? v.x0 : -1e9) + f.r, x1: Math.min(b.x1, ar.x1, v ? v.x1 : 1e9) - f.r, y0: Math.max(b.y0, v ? v.y0 : -1e9) + f.r, y1: Math.min(b.y1, v ? v.y1 : 1e9) - f.r };
    // the arena's standing palisade is its east wall (found once an arena, kept while it stands)
    const PC = fight.palBy || (fight.palBy = {}); let pal = PC[ar.x0];
    if (pal === undefined) { pal = W.solids.find(s => !s.gone && s.kind === "palisade" && s.x0 >= ar.x0 && s.x1 <= ar.x1 + 16) || null; PC[ar.x0] = pal; }
    if (pal && !pal.gone) box.x1 = Math.min(box.x1, pal.x0 - f.r - 2);
    return box;
  }
  // a coil of thorn-wire between a spot and a knight (cover an archer likes to stand behind)
  function wireBetween(fight, x, y, k) {
    const W = fight.world, P = phys(), d = Math.hypot(k.x - x, k.y - y), n = Math.max(1, Math.ceil(d / 6)), coils = W.solids.filter(s => !s.gone && s.contact === "wire");
    if (!coils.length) return false;
    for (let i = 1; i < n; i++) { const t = i / n, px = x + (k.x - x) * t, py = y + (k.y - y) * t; for (const s of coils) if (P.inShape(s, px, py)) return true; }
    return false;
  }
  // the ladder as the next edge: walk to its foot, then push into it (the mount takes 0.15 s of wish); while another body is on it, wait
  // at the foot circling at 30 px
  function ladderWish(fight, f, L, speed) {
    const B = f.brain, C0 = trollCommon(), ring = C0.circle || 30;
    const fx = L.foot[0] - L.into[0] * 4, fy = L.foot[1] - L.into[1] * 4, dx = fx - f.x, dy = fy - f.y, dd = Math.hypot(dx, dy);
    if (L.by !== null && L.by !== f.id) {
      const cx = L.foot[0], cy = L.foot[1], rx = f.x - cx, ry = f.y - cy, rd = Math.hypot(rx, ry) || 1, tx = -ry / rd * B.circle, ty = rx / rd * B.circle, rad = rd < ring - 4 ? 1 : rd > ring + 4 ? -1 : 0;
      const wx = tx + rx / rd * rad * 0.6, wy = ty + ry / rd * rad * 0.6, wl = Math.hypot(wx, wy) || 1;
      f.intent = { wish: [wx / wl * speed, wy / wl * speed], tilt: 1 }; f.moving = true; return null;
    }
    if (dd > 3) { f.intent = { wish: [dx / dd * speed, dy / dd * speed], tilt: 1 }; f.moving = true; return null; }
    f.intent = { wish: [L.into[0] * speed, L.into[1] * speed], tilt: 1, climb: 1 }; f.moving = true; f.face = Math.atan2(L.into[1], L.into[0]);
    return null;
  }
  // stuck (section 3.5): a troll that wants to come nearer its target (f.wantClose; a troll waiting by design is never stuck) and makes no
  // progress for 3 s steps sideways along its way's normal; at 6 s it walks out at the nearest door of its own arena and comes in again
  // with the spawn tell (the director's fight.level.respawn when it has one). Progress: it has come nearer the target than its best by
  // 4 px, or (before the sidestep, which moves it of itself) it has moved 8 px, following a target that keeps away. The target's own
  // movement never resets the clock; a new target does
  function stuckStep(fight, f, dt, tx, ty, seat) {
    const S = f.brain.stuck, C0 = trollCommon(), R = C0.stuck || { sidestep: 3, respawn: 6 }, w = f.intent && f.intent.wish;
    if (!f.wantClose || !w || Math.hypot(w[0], w[1]) < 1e-6 || f.climbing || f.air) { S.t = 0; S.best = Infinity; S.side = false; S.mx = f.x; S.my = f.y; return; }
    const d = Math.hypot(tx - f.x, ty - f.y), key = seat === undefined ? tx + ":" + ty : seat;
    if (S.key !== key) { S.key = key; S.best = d; S.t = 0; S.mx = f.x; S.my = f.y; return; }
    if (d < S.best - 4) { S.best = d; S.t = 0; S.mx = f.x; S.my = f.y; return; }
    if (seat !== undefined && S.t < R.sidestep && Math.hypot(f.x - S.mx, f.y - S.my) > 8) { S.t = 0; S.mx = f.x; S.my = f.y; return; }   // following a knight that keeps away is progress; a spot (a trench's end, a post) does not move
    S.t += dt;
    if (S.t >= R.respawn) {
      S.t = 0; S.best = Infinity; S.mx = f.x; S.my = f.y;
      emit(fight, { type: "stuck", foe: f.id, x: f.x, y: f.y, why: "respawn" });
      if (fight.level && fight.level.respawn) fight.level.respawn(fight, f);
      else respawnAtDoor(fight, f);
      return;
    }
    if (S.t >= R.sidestep) { const sp = Math.hypot(w[0], w[1]), side = f.brain.circle; f.intent = { wish: [-w[1] / sp * sp * side, w[0] / sp * sp * side], tilt: 1 }; if (!S.side) { S.side = true; emit(fight, { type: "stuck", foe: f.id, x: f.x, y: f.y, why: "sidestep" }); } }
    else S.side = false;
  }
  // without a director: the nearest door point of the troll's own arena (the arena whose x range holds it, else the fields' box), brought
  // inside the arena's floor when the door stands in a palisade's line, and onto free floor
  function respawnAtDoor(fight, f) {
    const C0 = trollCommon(), A = fight.area || {}, P = phys(), W = fight.world, F = fight.floor;
    const ar = (A.arenas || []).find(a => f.x >= a.x0 && f.x < a.x1) || fieldBox(fight), x0 = ar.x0, x1 = ar.x1;
    let best = null, bd = Infinity;
    for (const pts of Object.values(A.doors || {})) for (const p of pts) { if (p[0] < x0 - 8 || p[0] > x1 + 8) continue; const dd = Math.hypot(p[0] - f.x, p[1] - f.y); if (dd < bd) { bd = dd; best = p; } }
    if (!best) return;
    let x = clamp(best[0], Math.max(F.x0, x0) + f.r + 2, Math.min(F.x1, x1) - f.r - 2), y = clamp(best[1], F.y0 + f.r, F.y1 - f.r);
    for (const s of W.solids) if (!s.gone && s.kind === "palisade" && s.x0 >= x0 && s.x1 <= x1 + 16 && x >= s.x0 - f.r - 2) x = s.x0 - f.r - 2;   // a troll gate's point stands in the palisade's line: in through it, onto the arena's floor
    place(fight, f, x, y);
    if (P.caught(W, f)) { W.list = bodies(fight); P.freePoint(W, f); surfaceOf(fight, f); }
    f.spawn = C0.spawnTell || 0.6; f.act = null; f.intent = IDLE; f.brain.stuck.best = Infinity; fight.tdirty = true;
    emit(fight, { type: "spawn", foe: f.id, kind: f.kind, x: f.x, y: f.y, z: f.z, tell: f.spawn, again: true });
  }
  // regrowth (section 3.5): after 3.0 s without damage a troll heals at its rate, in ticks of 0.5 s shown as a small green +; none while it
  // burns and for 2 s after (the Emberback burns inside already: chill and freeze stop its instead)
  function regrowStep(fight, f, dt) {
    const K = f.spec, C0 = trollCommon(), R = C0.regrowth || { after: 3.0, burnGrace: 2.0 }, S = data().statuses;
    const stops = K.regrowthStoppedBy || ["burn"], key = { burn: "burn", chill: "slow", frozen: "freeze" };
    let barred = false;
    for (const s of stops) if (f.st[key[s] || s]) { barred = true; if (s === "burn") f.regrowBar = fight.t + R.burnGrace; }
    if (barred || f.noRegrow || f.hp >= f.hpMax || fight.t - f.hurtAt < R.after - 1e-9 || fight.t < (f.regrowBar || 0) - 1e-9 || (f.dotAt !== undefined && fight.t - f.dotAt < S.tick + 0.1)) { f.regrowT = 0; return; }   // f.noRegrow: the gate's burst took its regrowth (section 3.4)
    f.regrowT += dt;
    if (f.regrowT < S.tick - 1e-9) return;
    f.regrowT -= S.tick;
    const amount = Math.min(f.hpMax - f.hp, (K.regen || 0) * S.tick * dX(fight, "regrowth"));
    if (amount <= 0) return;
    f.hp += amount;
    emit(fight, { type: "regrow", foe: f.id, amount, hp: f.hp, x: f.x, y: f.y - (f.z || 0) - (f.chest || 0) });
  }
  // damage taken by a troll (every path: a blow, a dot, the world): the regrowth clock starts over; a single hit at or over its poise cuts a
  // wind-up short (the brutes have the stagger instead: 40 within 3.0 s sits one down for 1.0 s, x 1.25 taken, not again for 4 s)
  function foeDamaged(fight, f, amount, kind, by) {
    const K = f.spec, single = kind !== "dot" && kind !== "tick";
    if (single) f.hurtAt = fight.t; else f.dotAt = fight.t;   // a blow starts the 3.0 s before regrowth over; a dot's tick only holds it while the dots come (a burn has its own 2 s grace)
    if (by && by.seat !== undefined) f.lastHit = by.seat;
    const ST = K.stagger;
    if (ST) {
      const win = f.stagWin;
      win.push([fight.t, amount]);
      while (win.length && fight.t - win[0][0] > ST.window + 1e-9) win.shift();
      let sum = 0; for (const w of win) sum += w[1];
      if (sum >= ST.damage - 1e-9 && !(f.staggerCd > 0) && !f.dead && f.hp > 1e-9) {   // a blow that kills it does not stagger it first (the rock would drop beside its lump)
        win.length = 0; f.stagger = Math.max(f.stagger || 0, ST.time); f.staggered = true; f.staggerCd = ST.again;
        if (f.act) cancelAct(fight, f, "stagger", true);
        emit(fight, { type: "foeStagger", foe: f.id, time: ST.time, x: f.x, y: f.y, z: f.z });
        if (ST.dropsRock && f.onStagger) f.onStagger(fight, f);   // the rock brute lets its rock fall
      }
    } else if (single && K.poise && amount >= K.poise - 1e-9 && f.act && f.act.phase === "wind") cancelAct(fight, f, "interrupt");
    // the roar: once, the first time a brute's HP falls to half or below (it comes after the attack in hand, and after any stun or freeze)
    const RO = roarOf(K);
    if (RO && !f.roared && !f.roarDue && !f.dead && f.hp <= f.hpMax * (RO.at === undefined ? 0.5 : RO.at) + 1e-9) f.roarDue = true;
  }
  // the rock brute's rock falls beside it when it staggers (no crater): a boulder, solid, that stops shots and stuns a charging maul brute,
  // until it picks it up 0.6 s after the stagger ends (foeStep); a rock brute that dies leaves it lying
  function dropRock(fight, f) {
    if (f.rock) return;
    const P = phys(), W = fight.world, BO = ((f.spec.deathLeaves || {}).boulder) || { r: 10, ht: 22, chargeStun: 1.2 }, r = BO.r || 10, dd = f.r + r + 1, F = fight.floor;
    for (let i = 0; i < 8; i++) {
      const a = f.face + Math.PI / 2 + i * Math.PI / 4, x = f.x + Math.cos(a) * dd, y = f.y + Math.sin(a) * dd;
      if (x - r < F.x0 || x + r > F.x1 || y - r < F.y0 || y + r > F.y1 || P.caught(W, { x, y, z: f.z || 0, r, h: BO.ht || 22, on: f.on || null }) || P.groundAt(W, x, y).deep) continue;
      if (f.on ? !P.inPlat(W.platBy[f.on], x, y) : W.plats.some(Q => Q.active && P.inShape(Q, x, y))) continue;
      if (bodies(fight).some(b => b !== f && Math.hypot(b.x - x, b.y - y) < b.r + r)) continue;
      f.rock = P.addSolid(W, { kind: "droppedRock", shape: "c", x, y, r, ht: BO.ht || 22, stun: BO.chargeStun || 1.2, base: f.z || 0 });
      f.pickUp = undefined;
      emit(fight, { type: "rockDrop", foe: f.id, x, y, z: f.z });
      return;
    }
  }
  // the rock slam's impact (section 3.5): on the ground a crater r 14, 10 deep (merging with any it overlaps), a crack to the outer ring and
  // 6 to 9 chunks; on the deck, the roof or the drawbridge no crater and its chunks are splinters; the rock lies in the crater through the
  // recover (a marker solid the page draws, no body meets), until the lift
  function rockImpact(fight, f, A) {
    const atk = A.atk, R = A.ring, P = phys(), W = fight.world;
    if (!fight.marks) return;
    const CR = atk.crater, H = R.on || !CR ? null : crater(fight, R.x, R.y, CR.r || 14, CR.depth || 10, { side: "troll" });
    if (H) stamp(fight, "crack", R.x, R.y, (atk.outer || {}).r || R.r, 0);
    chunks(fight, R.x, R.y, R.z, R.on, atk.chunks, "troll", !H);
    if (f.rockLying) P.removeSolid(W, f.rockLying);
    f.rockLying = P.addSolid(W, { kind: "rockLying", shape: "c", x: R.x, y: R.y, r: 7, ht: 0, thin: true, base: R.z || 0 });
    A.after = (fg, g) => { if (g.rockLying) { P.removeSolid(W, g.rockLying); g.rockLying = null; } };
  }
  const takenX = f => f.foe && f.staggered && f.spec.stagger ? f.spec.stagger.taken || 1.25 : 1;
  // a status a troll's own kind sets on a troll (a reflected ice arrow chills its archer: the trolls' slow for 2 s, three within 3 s freeze it)
  function trollSets(fight, f, what) {
    const S = data().statuses;
    if (what === "chill") {
      if (f.st.burn) { delete f.st.burn; emit(fight, { type: "status", d: f.i, status: "burn", stacks: null, off: true }); return; }   // a chill reaching a burning body: both end (section 3.6a)
      f.st.slow = { t: 2 }; f.chills = (f.chills || []).filter(t => fight.t - t <= 3); f.chills.push(fight.t);
      emit(fight, { type: "status", d: f.i, status: "slow", stacks: f.chills.length });
      if (f.chills.length >= 3 && !f.st.freeze && !f.st.freezeImm) { f.chills = []; f.st.freeze = { t: S.freeze.max * (f.freezeScale || 1) }; emit(fight, { type: "status", d: f.i, status: "freeze", stacks: null }); if (f.act) cancelAct(fight, f, "freeze", true); }
    } else if (what === "burning") ignite(fight, f, 10);
  }
  // the knights' time on a tower's deck, for the legs rule; and footmen whose target has held the deck 4 s go for the legs, at most 2 at once
  function deckWatch(fight, dt) {
    const L = (trollCommon().legs || { after: 4, max: 2 });
    const TW = fight._towers || (fight._towers = fight.pieces.filter(p => p.kind === "tower")); if (!TW.length) return;
    const decks = fight._decks || (fight._decks = {}); for (const d in decks) decks[d] = undefined; for (const p of TW) if (!p.gone) decks[p.deck] = p;
    for (const k of fight.knights) k.deckT = k.on && decks[k.on] && standing(k) ? (k.deckT || 0) + dt : 0;
    let choppers = 0; for (const f of fight.foes) if (f.chop && !f.dead) choppers++;
    for (const f of fight.foes) {
      if (f.dead || !f.brain || f.spawn > 0) continue;
      const k = f.brain.target !== null ? fight.knights[f.brain.target] : null, tower = k && k.on && decks[k.on], want = !!(tower && k.deckT >= L.after - 1e-9 && f.spec.close && !f.climbing && !f.on);
      if (f.chop && (!want || (f.chop !== tower))) { f.chop = null; choppers--; }
      if (want && !f.chop && choppers < L.max) { f.chop = tower; choppers++; }
    }
  }
  // chopping the legs: the troll walks to the nearest leg and clubs the tower piece there (tryAttack's melee family with A.legs set)
  function legsOf(fight, f) {
    const W = fight.world, p = f.chop; if (!p || p.gone) return null;
    let best = null, bd = Infinity;
    for (const id of p.solids) { const s = W.solids[id]; if (s.gone) continue; const d = Math.hypot(s.x - f.x, s.y - f.y); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  function chopLegs(fight, f, A) {
    const p = f.chop, leg = legsOf(fight, f), atk = A.atk;
    if (!p || p.gone || !leg) return;
    if (Math.hypot(leg.x - f.x, leg.y - f.y) <= (atk.reach || atk.range) + leg.r + 1e-9) {
      emit(fight, { type: "hit", d: p.i, dummy: p.kind, amount: atk.damage, tag: null, crit: false, form: null, element: null, kind: "world", why: f.kind + ".legs", x: leg.x, y: leg.y - 10, melee: true, hold: 0, sum: false });
      damage(fight, p, atk.damage, "legs", [f.x, f.y], f);
    }
    emit(fight, { type: "foeStrike", foe: f.id, attack: A.kind, seat: A.seat, legs: true, x: f.x, y: f.y, z: f.z });
  }
  // the brain of a troll that chops: at a leg it clubs it (with the view rule), else it walks straight to the nearest leg
  function chopStep(fight, f, dt) {
    const K = f.spec, A = K.attacks || {}, name = Object.keys(A).find(n => ATTACK[n] === "melee"), leg = legsOf(fight, f);
    if (!leg || !name) { f.chop = null; return false; }
    if (f.st.stun || f.st.freeze || f.stagger > 0 || f.climbing) return false;   // held, or on the ladder: the brain cancels and waits
    if (f.act) { actStep(fight, f, dt); f.intent = IDLE; f.moving = false; return true; }
    let atk = A[name]; if (typeof atk === "string") atk = ((trollSpec()[atk] || {}).attacks || {})[name];
    const dd = Math.hypot(leg.x - f.x, leg.y - f.y), windT = (atk.wind || 0.45) * slowX(f), k = fight.knights[f.brain.target];
    if (dd <= (atk.reach || atk.range) + leg.r && inAttackBox(fight, f.x, f.y, f.z) && (f.cd[name] || 0) <= windT + 1e-9) {
      f.face = Math.atan2(leg.y - f.y, leg.x - f.x);
      f.act = { kind: name, atk, fam: "melee", phase: "wind", t: 0, T: Math.max(windT, trollCommon().telegraphMin || 0.45), seat: k ? k.seat : null, token: null, drive: null, hits: [], legs: true, tel: { kind: "glint" } };
      emit(fight, { type: "windUp", foe: f.id, kind: f.kind, attack: name, seat: f.act.seat, legs: true, x: f.x, y: f.y, z: f.z, wind: f.act.T, tel: f.act.tel });
      f.intent = IDLE; f.moving = false; return true;
    }
    const ux = (leg.x - f.x) / dd, uy = (leg.y - f.y) / dd, speed = K.speed || 42;
    f.intent = { wish: [ux * speed, uy * speed], tilt: 1 }; f.moving = true; f.wantClose = true; f.face = Math.atan2(uy, ux);
    stuckStep(fight, f, dt, leg.x, leg.y);
    return true;
  }

  // ------------------------------------------------------------------ the dummies: statuses, the wobble, the rail, the quintain
  function dummiesStep(fight, dt) {
    const C = data(), S = C.statuses, W = C.wobble, Q = C.dummies.quintain, M = C.modifiers;
    for (const d of fight.dummies) {
      d.flash = Math.max(0, d.flash - dt);
      // the wobble: a spring on the post
      d.wv += (-W.spring * d.wob - W.damp * d.wv) * dt; d.wob += d.wv * dt; d.wob = clamp(d.wob, -W.max, W.max);
      const st = d.st;
      for (const key of Object.keys(st)) {
        const s = st[key]; s.t -= dt;
        if (key === "burn" || key === "poisoned" || key === "bleed") { s.tick += dt; if (s.tick >= S.tick - 1e-9) { s.tick = 0; dot(fight, d, s.rate * (s.stacks || 1) * S.tick, key === "burn" ? "fire" : key === "poisoned" ? "poison" : "bleed", s.by); } }
        if (s.t <= 1e-9) { delete st[key]; if (key === "freeze") st.freezeImm = { t: S.freeze.immune }; if (key === "stun") st.stunImm = { t: S.stun.immune }; }
      }
      const held = !!(st.freeze || st.stun);
      const slow = (st.slow ? S.slow.speed : 1) * (st.sticky ? 1 - M.sticky.slow : 1) * (d.chill ? 1 - M.frost_trail.slow : 1);
      if (d.rail && !held) {
        const R = d.rail;
        if (R.pause > 0) R.pause -= dt;
        else { d.x += R.dir * R.speed * slow * dt; if (d.x >= R.x1) { d.x = R.x1; R.dir = -1; R.pause = R.wait; } if (d.x <= R.x0) { d.x = R.x0; R.dir = 1; R.pause = R.wait; } }
      }
      if (d.arm) {
        const arm = d.arm;
        // a stun or a freeze holds the arm while it lasts, then it spins on
        if (!held) { arm.a += arm.w * dt; const fr = Q.friction * dt; arm.w = Math.abs(arm.w) <= fr ? 0 : arm.w - Math.sign(arm.w) * fr; }
        arm.cool = Math.max(0, arm.cool - dt);
        // the sandbag's place over the floor, and the bonk
        const bx = d.x - Math.cos(arm.a) * arm.len, by = d.y - Math.sin(arm.a) * arm.len;
        for (const k of fight.knights) {
          if (!(!held && arm.cool <= 0 && Math.abs(arm.w) > Q.bonkAbove && k.bonk <= 0 && k.dodge <= 0 && k.safe <= 0 && dist(bx, by, k.x, k.y) < Q.bagR)) continue;
          arm.cool = Q.again;
          const u = k.hands[k.active].u, facing = Math.abs(angDiff(Math.atan2(d.y - k.y, d.x - k.x), k.face)) < Math.PI / 2;
          if (st.blind && fight.rand() < S.blind.miss) emit(fight, { type: "miss", x: k.x, y: k.y, d: d.i }, k);   // a blinded quintain misses half the time
          else if (k.guardT > 0) { arm.w = -arm.w; emit(fight, { type: "block", x: k.x, y: k.y, bx: (bx + k.x) / 2, by: k.y - 14, d: d.i }, k); emit(fight, { type: "reflect", x: k.x, y: k.y, d: d.i }, k); }
          else if (u.mods.has("guard") && facing) { arm.w = -arm.w * Q.blockBack; emit(fight, { type: "block", x: k.x, y: k.y, bx: (bx + k.x) / 2, by: k.y - 14, d: d.i }, k); }
          else if (u.mods.has("reflect")) { arm.w = -arm.w; emit(fight, { type: "reflect", x: k.x, y: k.y, d: d.i }, k); }
          else {
            const a = Math.atan2(k.y - d.y, k.x - d.x), px = Q.push * (st.weaken ? 1 - S.weaken.less : 1);   // a weakened quintain shoves 40 % less
            k.bonk = Q.stagger; k.shove = { kind: "share", t: 0, T: Q.pushT, dx: Math.cos(a) * px, dy: Math.sin(a) * px };
            k.strike = null; k.twinQ = null; k.gout = null; k.charging = false; k.chargeT = 0; k.lunge = null; stopStream(fight, k);
            emit(fight, { type: "bonk", x: k.x, y: k.y, push: px, d: d.i }, k);
          }
        }
      }
    }
  }
  // ------------------------------------------------------------------ resetting the room (the menu's Reset)
  function reset(fight) {
    for (const d of fight.dummies) { d.st = {}; d.wob = 0; d.wv = 0; d.flash = 0; d.combo = null; d.chill = false; if (d.arm) { d.arm.w = 0; d.arm.cool = 0; } }
    fight.shots = []; fight.traps = []; fight.minions = []; fight.patches = [];
    fight.board = { last: null, name: "", log: [], dps: 0 };
    for (const k of fight.knights) {
      for (const h of k.hands) { h.orbit = null; h.aura = null; h.recover = 0; h.cd = 0; h.acd = 0; }
      k.strike = null; k.twinQ = null; k.gout = null; k.charging = false; k.chargeT = 0; k.abQ = null; k.guardT = 0; stopStream(fight, k);
    }
    return fight;
  }

  root.Combat = { abilityUnits, abilities, units, unitsFor, newFight, step, hold, tip, aim, animOf, weaponPose, facingOf, hitPoint, reachOf, setHand, addHand, reset, affinity, railAhead, use, rng,
    hurt, afflict, waveStart, returnKnights, healKnight, FACINGS, NUMBERS,
    spawn, die, place, setView, targets, bodies, inView, canHit, reaches, foeShot, foeBurst, takeRam, putRam, remains, breakPiece, damage, trollKind, drawnAt,
    fieldClass, nextToward, fieldReach, trollSets, standing, inAttackBox, lineClear, applyStatus, bestSpot, trenchCovered, trenchEnd, wireBetween,
    mark, endMark, stamp, fire, ice, puddle, crater, chunks, throwStone, stuck, groundBits, GBIT, clearSeat, setPost, manned, roarOf, emberRoll,
    emit, inThumb, drownPuddle, fieldsReady, difficultyOf, dX };
  if (typeof module !== "undefined" && module.exports) module.exports = root.Combat;
})(typeof window !== "undefined" ? window : globalThis);
