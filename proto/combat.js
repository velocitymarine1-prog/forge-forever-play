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
//   Combat.step(fight, dt, input)         input = { move: [x, y], strike, swap, dodge, ability }  (tests may add target and face)
//   Combat.hold(fight, anim, frame)       where the weapon sits on the knight's hand, for the screen and for a shot's start
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
  function use(spec, abilities) { DATA = spec; if (abilities) ABIL = abilities; }
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
  // area: { w, h, floor: { x0, x1, y0, y1 }, dummies: [{ kind, x, y, a, rail, resist, weak, immune }], knight: { start: [x, y], face (degrees) },
  //         room: { side, wallBot, front } }   (spec/cellar.json is one); loadout: one or two weapon records
  // opts: { crits: false } for tests that compare exact numbers
  function newFight(area, loadout, seed, opts) {
    const C = data();
    area = area || {}; opts = opts || {};
    const W = area.w || 384, H = area.h || 216;
    const floor = Object.assign({ x0: 8, x1: W - 8, y0: 8, y1: H - 8 }, area.floor || {});
    const pad = (C.walls || {}).pad || 8, room = area.room;
    const walls = room ? { x0: room.side || 0, x1: W - (room.side || 0), y0: room.wallBot || 0, y1: H - (room.front || 0) } : { x0: floor.x0 - pad, x1: floor.x1 + pad, y0: floor.y0 - pad, y1: floor.y1 + pad };
    const kn = area.knight || {}, start = kn.start || [floor.x0 + 20, (floor.y0 + floor.y1) / 2];
    const fight = { t: 0, steps: 0, seed: seed >>> 0, rand: rng((seed >>> 0) || 1), crits: opts.crits !== false && area.crits !== false, W, H, floor, walls,
      k: { x: start[0], y: start[1], face: (kn.face === undefined ? 0 : kn.face) * RAD, active: 0, moving: false, walkT: 0, strike: null, twinQ: null, pressed: false, lastSwap: false, lastDodge: false,
        streamOn: false, holdT: 0, stream: null, gout: null, charging: false, chargeT: 0, bonk: 0, shove: null, dodge: 0, dodgeCd: 0, safe: 0, dvx: 0, dvy: 0, swapT: 0, lunge: null, trailT: 0,
        lastAbility: false, abQ: null, guardT: 0 },
      hands: [], dummies: [], shots: [], traps: [], minions: [], patches: [], live: [], events: [], logged: {}, board: { last: null, name: "", log: [], dps: 0 }, nextId: 1 };
    for (const t of (loadout || []).slice(0, 2)) if (t && t.weapon) fight.hands.push(newHand(t));
    if (!fight.hands.length) throw new Error("a fight needs a weapon in hand");
    (area.dummies || []).forEach((d, i) => fight.dummies.push(newDummy(d, i)));
    return fight;
  }
  function newHand(t) { const u = units(t); return { thing: t, u, u2: u.second, ua: abilityUnits(t), acd: 0, acdOf: 1, cd: 0, recover: 0, recoverOf: 0, count: 0, lungeCd: 0, orbit: null, aura: null, practice: !!t.practice }; }
  function newDummy(d, i) {
    const C = data(), Z = isRule(C.dummies[d.kind]) ? C.dummies[d.kind] : C.dummies.straw;
    const o = { i, kind: isRule(C.dummies[d.kind]) ? d.kind : "straw", name: Z.name, x: d.x, y: d.y, r: Z.r, chest: Z.chest, head: Z.head, eyes: Z.eyes, size: Z.size, shadow: Z.shadow, puff: Z.puff,
      resist: d.resist || Z.resist || [], weak: d.weak || Z.weak || [], immune: d.immune || Z.immune || [],
      wob: 0, wv: 0, flash: 0, st: {}, combo: null, acc: 0, accT: 0 };
    if (o.kind === "rail") { const r = d.rail || {}; o.rail = { x0: r.x0 === undefined ? d.x - 60 : r.x0, x1: r.x1 === undefined ? d.x + 60 : r.x1, dir: r.dir === undefined ? 1 : r.dir, pause: r.pause || 0, speed: Z.speed, wait: Z.pause }; }
    if (o.kind === "quintain") o.arm = { a: (d.a || 0) * RAD, w: 0, cool: 0, len: Z.arm };
    return o;
  }
  // put a weapon in a hand (the rack); what the old weapon loosed stays loosed
  function setHand(fight, i, t) {
    if (!t || !t.weapon) return false;
    const k = fight.k, old = fight.hands[i], h = newHand(t);
    if (old) { h.orbit = old.orbit; h.aura = old.aura; }
    fight.hands[i] = h;
    if (i === k.active) { k.strike = null; k.twinQ = null; stopStream(fight); k.gout = null; k.charging = false; k.chargeT = 0; }
    for (const n of h.u.notes.concat(h.u2 ? h.u2.notes : [])) logOnce(fight, n);
    return true;
  }
  // take a weapon in the free hand (a knight that carries one weapon); returns the hand's index, or -1 when both hands are full
  function addHand(fight, t) { if (!t || !t.weapon || fight.hands.length >= 2) return -1; const h = newHand(t); fight.hands.push(h); for (const n of h.u.notes.concat(h.u2 ? h.u2.notes : [])) logOnce(fight, n); return fight.hands.length - 1; }
  function emit(fight, e) { e.t = Math.round(fight.t * 1e6) / 1e6; fight.events.push(e); return e; }
  function logOnce(fight, what) { if (fight.logged[what]) return; fight.logged[what] = true; emit(fight, { type: "log", text: "unknown " + what }); }

  // ------------------------------------------------------------------ the aim
  // the point a strike aims at: a dummy's chest (the quintain: its shield end, at chest height)
  function hitPoint(d) { if (d.arm) return [d.x + Math.cos(d.arm.a) * d.arm.len, d.y + Math.sin(d.arm.a) * d.arm.len - d.chest]; return [d.x, d.y - d.chest]; }
  function chestOf(fight) { const k = fight.k; return [k.x, k.y - data().knight.chest]; }
  function reachOf(u) { const f = u.form; return u.melee ? u.reach : f === "shoot" ? u.shot : f === "stream" ? u.streamLen : f === "lob" ? u.lobDist : f === "trap" ? u.throwD : data().aim.other; }
  // the nearest dummy within the weapon's reach or range x 1.25 (20 px more with lunge) and within 60 degrees of the facing; seeking
  // looks at the whole room; if there is none, straight along the facing. `not` leaves a dummy out (twin's second blow).
  function aim(fight, u, want, not) {
    const C = data(), k = fight.k, [ox, oy] = chestOf(fight);
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

  // ------------------------------------------------------------------ the weapon on the hand
  // the weapon's facing and its offset on the hand for the knight's state: one pose per facing; a strike moves it, never turns it
  function weaponPose(fight) {
    const k = fight.k, s = k.strike, C = data();
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
  function hold(fight, anim, i) {
    const k = fight.k, hand = fight.hands[k.active], u = hand.u, pose = weaponPose(fight), reach = armFor(u);
    const K = root.Knight, kf = K && K.frame ? K.frame(pose.facing, anim || "idle", i || 0, reach) : null, hp = kf ? kf.hand : HAND[pose.facing];
    const x0 = Math.round(k.x) - 16, y0 = Math.round(k.y) - 31, ho = holdOffset(u, pose.facing);
    return { thing: hand.thing, facing: pose.facing, off: pose.off, reach, frame: kf, x0, y0, hx: x0 + hp[0] + Math.round(pose.off[0]) + ho[0], hy: y0 + hp[1] + Math.round(pose.off[1]) + ho[1], behind: pose.facing === "away" };
  }
  // where a shot, a shell or a stream leaves the weapon: its tip in the hand (the head's end, a gem, a muzzle, a bell; the bow's riser)
  function tip(fight) {
    const PF = root.PixelForge, k = fight.k;
    if (!PF || !PF.poseFor) { const [ox, oy] = chestOf(fight), a = k.strike ? k.strike.a : k.face; return [ox + Math.cos(a) * 8, oy + Math.sin(a) * 8]; }
    const h = hold(fight, "strike", 0), sp = PF.poseFor(h.thing, h.facing, 0), g = sp.grip || [6, 25], tp = sp.tip || g;
    return [h.hx - g[0] + tp[0], h.hy - g[1] + tp[1]];
  }
  // the knight's animation and frame for its state (the screen draws it; the rules only need the strike frame, for the tip)
  function animOf(fight) {
    const k = fight.k, s = k.strike;
    if (k.bonk > 0) return { anim: "bonk", i: 0 };
    if (s) return { anim: s.t < s.wind ? "wind" : s.t < s.wind + s.act + 0.05 ? "strike" : "recover", i: 0 };
    if (k.streamOn || k.gout) return { anim: "strike", i: 0 };
    if (k.moving || k.dodge > 0 || k.lunge) return { anim: "walk", i: Math.floor(k.walkT * 8) % 4 };
    return { anim: "idle", i: Math.floor(fight.t * 2) % 2 };
  }

  // ------------------------------------------------------------------ the step
  function step(fight, dt, input) {
    const C = data();
    input = input || {};
    fight.events = []; fight.live = []; fight.steps++; fight.t += dt;
    fight.input = input;
    if (fight.steps === 1) for (const h of fight.hands) for (const n of h.u.notes.concat(h.u2 ? h.u2.notes : [])) logOnce(fight, n);
    knightStep(fight, dt, input);
    dummiesStep(fight, dt);
    keepOnFloor(fight);   // the rail dummy slides: it pushes a standing knight aside
    shotsStep(fight, dt); orbitsStep(fight, dt); aurasStep(fight, dt); trapsStep(fight, dt); minionsStep(fight, dt); patchesStep(fight, dt); streamStep(fight, dt, input); goutStep(fight, dt);
    const win = C.board.window, b = fight.board;
    while (b.log.length && fight.t - b.log[0][0] > win) b.log.shift();
    let sum = 0; for (const e of b.log) sum += e[1];
    b.dps = sum / win;
    return fight.events;
  }

  // ------------------------------------------------------------------ the knight: walking, the dodge, swapping, striking
  function knightStep(fight, dt, inp) {
    const C = data(), k = fight.k, KN = C.knight;
    for (const h of fight.hands) { h.cd -= dt; if (h.recover > 0) h.recover = Math.max(0, h.recover - dt); if (h.lungeCd > 0) h.lungeCd -= dt; if (h.acd > 0) { h.acd = Math.max(0, h.acd - dt); if (h.acd === 0) emit(fight, { type: "ready", hand: fight.hands.indexOf(h) }); } }
    if (k.guardT > 0) k.guardT = Math.max(0, k.guardT - dt);
    if (k.dodgeCd > 0) k.dodgeCd -= dt;
    if (k.safe > 0) k.safe -= dt;
    // swapping takes 0.3 s: the knight sheathes and draws
    const swap = !!inp.swap && !k.lastSwap; k.lastSwap = !!inp.swap;
    if (k.swapT > 0) k.swapT = Math.max(0, k.swapT - dt);
    if (swap && fight.hands.length > 1 && k.swapT <= 0 && k.bonk <= 0) {
      k.active = (k.active + 1) % fight.hands.length; k.swapT = KN.swap;
      k.strike = null; k.twinQ = null; k.gout = null; k.charging = false; k.chargeT = 0; stopStream(fight);
      emit(fight, { type: "swap", hand: k.active, weapon: fight.hands[k.active].thing.id });
    }
    const hand = fight.hands[k.active], u = hand.u;
    // staggered by the quintain: pushed away, nothing else
    if (k.bonk > 0) {
      k.bonk -= dt;
      if (k.shove) { const S = k.shove, q0 = S.t / S.T; S.t = Math.min(S.T, S.t + dt); const q = S.t / S.T - q0; k.x += S.dx * q; k.y += S.dy * q; if (S.t >= S.T) k.shove = null; keepOnFloor(fight); }
      k.pressed = !!inp.strike; k.lastDodge = !!inp.dodge; k.moving = false;
      return;
    }
    // the dodge: 56 px in 0.2 s along the stick (or the facing)
    const mv = inp.move || [0, 0], mm = Math.hypot(mv[0], mv[1]);
    const dodge = !!inp.dodge && !k.lastDodge; k.lastDodge = !!inp.dodge;
    if (dodge && k.dodge <= 0 && k.dodgeCd <= 0) {
      const a = mm > 0.05 ? Math.atan2(mv[1], mv[0]) : k.face, D = KN.dodge;
      k.dodge = D.time; k.dodgeCd = D.cooldown; k.safe = D.safe; k.dvx = Math.cos(a) * D.px / D.time; k.dvy = Math.sin(a) * D.px / D.time;
      k.strike = null; k.twinQ = null; k.charging = false; k.chargeT = 0; stopStream(fight);
      emit(fight, { type: "dodge", x: k.x, y: k.y, a });
    }
    if (k.dodge > 0) {
      const d = Math.min(dt, k.dodge); k.dodge -= dt; k.x += k.dvx * d; k.y += k.dvy * d; k.walkT += dt; k.moving = true;
      keepOnFloor(fight);
      k.pressed = !!inp.strike;
      return;
    }
    // walking: 80 px/s at full tilt, slower at partial tilt
    k.moving = mm > 0.05 && !k.lunge;
    if (k.moving) {
      const tilt = Math.min(1, mm), sp = KN.speed * tilt * u.speed;
      k.x += mv[0] / mm * sp * dt; k.y += mv[1] / mm * sp * dt; k.walkT += dt;
      if (!k.strike && !k.streamOn && !k.gout) k.face = Math.atan2(mv[1], mv[0]);
      if (u.mods.has("frost_trail")) { k.trailT += dt; if (k.trailT >= C.modifiers.frost_trail.every) { k.trailT = 0; patch(fight, "frost", k.x, k.y, C.modifiers.frost_trail.radius, u.statusT, u); } }
      keepOnFloor(fight);
    }
    if (inp.face !== undefined && inp.face !== null && !k.strike) k.face = inp.face;
    if (k.lunge) { const L = k.lunge; L.t += dt; const p = Math.min(1, L.t / L.T); k.x = L.x0 + (L.x1 - L.x0) * p; k.y = L.y0 + (L.y1 - L.y0) * p; k.walkT += dt; keepOnFloor(fight); if (p >= 1) k.lunge = null; }
    // Strike
    const held = !!inp.strike, pressed = held && !k.pressed;
    k.pressed = held;
    const F = C.forms[u.form], ready = k.swapT <= 0 && !k.strike && !k.gout;
    const next = () => false;   // design pass 10: a legend strikes with its body's form only; its head gives the ability
    // the ability: a press, when the hand has one and its clock is done; a blow in progress is cut short, as a dodge cuts it
    const abil = !!inp.ability && !k.lastAbility; k.lastAbility = !!inp.ability;
    // the queued plays of an ability (Frenzy's rakes, the Snare Line's traps...) come gap apart: the queue is stepped before a press
    // starts one, so the press's own frame doesn't count against the first gap
    if (k.abQ) { k.abQ.t -= dt; if (k.abQ.t <= 0 && (!k.strike || k.strike.done)) { const Q = k.abQ; Q.left--; Q.t = Q.gap; if (Q.left <= 0) k.abQ = null; playAbility(fight, hand, Q.ua, Q.i++, inp.target); } }
    if (abil && hand.ua && hand.acd <= 0 && k.swapT <= 0) { useAbility(fight, hand, inp.target); }
    // a blow was struck with the units fu: it counts, and a blow of a repeating form starts the hand's cooldown (1 / rate, the overshoot
    // of the last one carried, so a held Strike keeps the weapon's rate exactly)
    const did = fu => { if (!fu) return; hand.count++; if (C.forms[fu.form].blow) hand.cd = Math.max(hand.cd, -dt) + 1 / fu.rate; };
    if (u.mods.has("charge") && u.form !== "stream") {
      // charge: hold to charge (up to 1 s), release to strike at x (1 + 1.5 x the charge); a charge weapon doesn't repeat while held
      const CH = C.modifiers.charge;
      if (held && ready && hand.cd <= 0 && !k.charging && (F.blow || pressed)) { k.charging = true; k.chargeT = dt; emit(fight, { type: "charge", hand: k.active }); }
      else if (held && k.charging) k.chargeT = Math.min(CH.time, k.chargeT + dt);
      else if (!held && k.charging) {
        k.charging = false;
        const c = 1 + CH.more * clamp(k.chargeT / CH.time, 0, 1);
        if (ready) did(blow(fight, next(), inp.target, false, c));
        k.chargeT = 0;
      }
    } else if (u.form === "stream") {
      // hold: flows; release: stops. A legend's third start is one blow of its second form
      if (held && ready && !k.streamOn && hand.recover <= 0 && hand.cd <= 0) {
        if (next()) did(blow(fight, true, inp.target, false, 1));
        else { k.streamOn = true; k.holdT = 0; hand.count++; emit(fight, { type: "stream", on: true, hand: k.active }); }
      } else if (!held && k.streamOn) stopStream(fight);
    } else if (F.blow) {
      // tap: one blow; hold: blows at the weapon's rate
      if (held && ready && hand.cd <= 0) did(blow(fight, next(), inp.target, false, 1));
    } else if (pressed && ready) {
      // orbit, field, trap, summon: a press
      const second = next();
      if (!second || !C.forms[hand.u2.form].blow || hand.cd <= 0) did(blow(fight, second, inp.target, false, 1));
    }
    if (k.strike) strikeStep(fight, dt);
    // twin: every blow repeats 0.15 s later (once the first has landed)
    if (k.twinQ) { k.twinQ.t -= dt; if (k.twinQ.t <= 0 && (!k.strike || k.strike.done)) { const q = k.twinQ; k.twinQ = null; if (k.swapT <= 0) { startStrike(fight, q.fu, q.want, true, q.charge, q.first); strikeStep(fight, 0); } } }
  }
  function useAbility(fight, hand, want) {
    const k = fight.k, ua = hand.ua, A = ua.ability;
    k.strike = null; k.twinQ = null; k.gout = null; k.charging = false; k.chargeT = 0; k.abQ = null; stopStream(fight);
    hand.acd = A.cooldown; hand.acdOf = A.cooldown;
    emit(fight, { type: "ability", name: A.name, hand: k.active, x: k.x, y: k.y, el: ua.element });
    playAbility(fight, hand, ua, 0, want);
    if ((A.n || 1) > 1) k.abQ = { left: A.n - 1, gap: A.gap || 0.1, t: A.gap || 0.1, i: 1, ua };
    return true;
  }
  // one play of an ability: nova (a burst around the knight), guard (a blocking window, then the blow), line (a trap a step further each
  // play), or one blow of the ability's form at its damage factor
  function playAbility(fight, hand, ua, i, want) {
    const C = data(), k = fight.k, A = ua.ability, x = A.x || 1;
    if (A.special === "nova") { burst(fight, k.x, k.y, ua.fieldR, ua.hit * ua.K * x, "field", ua); return; }
    if (A.special === "guard") k.guardT = ua.guardT || 2;
    if (A.special === "line") { const d0 = ua.throwD; ua.throwD = d0 + i * ((ua.over.line || {}).step || 24); hand.cd = 0; placeTrap(fight, hand, ua, want, x); ua.throwD = d0; hand.cd = 0; return; }
    const F = C.forms[ua.form];
    if (F.blow) { startStrike(fight, ua, want, false, x); strikeStep(fight, 0); return; }
    if (ua.form === "stream") { startGout(fight, ua, want, x); if (ua.goutT) k.gout.T = ua.goutT; return; }
    if (ua.form === "orbit") { hand.orbit = null; hand.recover = 0; startOrbit(fight, hand, ua, x); return; }
    if (ua.form === "field") { hand.aura = null; hand.recover = 0; startAura(fight, hand, ua, x); return; }
    if (ua.form === "trap") { hand.cd = 0; placeTrap(fight, hand, ua, want, x); hand.cd = 0; return; }
    if (ua.form === "summon") { const hi = fight.hands.indexOf(hand); fight.minions = fight.minions.filter(m => m.owner !== hi); summon(fight, hand, ua, x); }
  }
  function stopStream(fight) { const k = fight.k; if (k.streamOn) emit(fight, { type: "stream", on: false, hand: k.active }); k.streamOn = false; k.stream = null; }
  // the knight is a circle of radius 6 at its feet: pushed out of the dummies' bases, then kept on the floor; when both bind (a dummy
  // by the wall) it slides along the wall
  function keepOnFloor(fight) {
    const k = fight.k, F = fight.floor, r = data().knight.r;
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (const d of fight.dummies) {
        const need = r + d.r, dx = k.x - d.x, dy = k.y - d.y, dd = Math.hypot(dx, dy);
        if (dd >= need) continue;
        if (dd < 1e-6) { k.x = d.x - need; } else { k.x = d.x + dx / dd * need; k.y = d.y + dy / dd * need; }
        moved = true;
      }
      const cx = clamp(k.x, F.x0, F.x1), cy = clamp(k.y, F.y0, F.y1), boundX = cx !== k.x, boundY = cy !== k.y;
      k.x = cx; k.y = cy;
      if (!moved) break;
      if (boundX || boundY) for (const d of fight.dummies) {
        const need = r + d.r, dx = k.x - d.x, dy = k.y - d.y;
        if (Math.hypot(dx, dy) >= need - 1e-6) continue;
        if (boundY && Math.abs(dy) < need) k.x = clamp(d.x + (dx >= 0 ? 1 : -1) * Math.sqrt(need * need - dy * dy), F.x0, F.x1);
        else if (boundX && Math.abs(dx) < need) k.y = clamp(d.y + (dy >= 0 ? 1 : -1) * Math.sqrt(need * need - dx * dx), F.y0, F.y1);
      }
    }
  }
  const onFloor = (fight, x, y) => [clamp(x, fight.floor.x0, fight.floor.x1), clamp(y, fight.floor.y0, fight.floor.y1)];

  // ------------------------------------------------------------------ a blow of a form
  // second: the legend's second form; charge: the blow's multiplier (1 when not charged). Returns the units the blow used, or null
  // when nothing could happen (an orbit still up, a hand recovering, the cap of traps or minions).
  function blow(fight, second, want, isTwin, charge) {
    const C = data(), k = fight.k, hand = fight.hands[k.active], fu = second && hand.u2 ? hand.u2 : hand.u, F = C.forms[fu.form];
    if (F.blow) { startStrike(fight, fu, want, isTwin, charge); return fu; }
    let done = false;
    if (fu.form === "stream") done = fu.isSecond ? startGout(fight, fu, want, charge) : false;   // a stream as a first form flows from the hold
    else if (fu.form === "orbit") done = startOrbit(fight, hand, fu, charge);
    else if (fu.form === "field") done = startAura(fight, hand, fu, charge);
    else if (fu.form === "trap") done = placeTrap(fight, hand, fu, want, charge);
    else if (fu.form === "summon") done = summon(fight, hand, fu, charge);
    if (done) return fu;
    return second ? blow(fight, false, want, isTwin, charge) : null;   // none could start: the blow is the first form
  }
  function startStrike(fight, fu, want, isTwin, charge, first) {
    const C = data(), k = fight.k, hand = fight.hands[k.active], F = C.forms[fu.form], M = C.modifiers;
    let am = aim(fight, fu, want, isTwin ? first : undefined);
    if (isTwin && !am.d && first) am = aim(fight, fu, first.i);   // twin: the next-nearest target, or the same one
    const s = k.strike = { form: fu.form, fu, hand: k.active, t: 0, wind: F.wind, act: F.act, dur: F.dur, a: am.a, target: am.d, done: false, twin: !!isTwin, charge: charge || 1 };
    k.face = am.a;
    // lunge: close the gap before a melee blow
    const LG = Object.assign({}, M.lunge, (fu.over || {}).lunge || {});
    if (fu.mods.has("lunge") && fu.melee && am.d && (hand.lungeCd <= 0 || fu.isAbility)) {
      const p = hitPoint(am.d), [ox, oy] = chestOf(fight), dd = dist(ox, oy, p[0], p[1]);
      if (dd > fu.reach && dd <= fu.reach + LG.dash) {
        const go = Math.min(LG.dash, dd - fu.reach + LG.past);
        k.lunge = { t: 0, T: LG.time, x0: k.x, y0: k.y, x1: k.x + Math.cos(am.a) * go, y1: k.y + Math.sin(am.a) * go };
        s.wind = LG.wind; if (!fu.isAbility) hand.lungeCd = LG.cooldown;
        emit(fight, { type: "fx", kind: "dash", x: k.x, y: k.y, a: am.a });
      }
    }
    emit(fight, { type: "strike", form: fu.form, hand: k.active, second: fu.isSecond, twin: !!isTwin, a: am.a, target: am.d ? am.d.i : null, charge: s.charge });
    if (fu.mods.has("twin") && !isTwin) k.twinQ = { t: M.twin.gap, fu, want, charge, first: am.d };
    return s;
  }
  function strikeStep(fight, dt) {
    const k = fight.k, s = k.strike;
    s.t += dt;
    if (!s.done && s.t >= s.wind) { s.done = true; resolve(fight, s); }
    if (s.done && s.t < s.wind + s.act) liveBox(fight, s);
    if (s.t >= s.dur) k.strike = null;
  }
  // the hitbox of a live strike, for the reach overlay
  function liveBox(fight, s) {
    const u = s.fu, [ox, oy] = chestOf(fight);
    if (s.form === "slash") fight.live.push(u.spin ? { type: "circle", x: ox, y: oy, r: u.reach } : { type: "sector", x: ox, y: oy, r: u.reach, a0: s.a - u.arc / 2 * RAD, a1: s.a + u.arc / 2 * RAD });
    else if (s.form === "thrust") fight.live.push(u.spin ? { type: "circle", x: ox, y: oy, r: u.reach } : { type: "line", x: ox, y: oy, a: s.a, len: u.reach, w: u.width });
    else if (s.form === "smash") fight.live.push(u.spin ? { type: "circle", x: ox, y: oy, r: u.reach } : { type: "circle", x: ox + Math.cos(s.a) * u.reach, y: oy + Math.sin(s.a) * u.reach, r: u.burst });
  }
  const SMEAR = { whip: "lash", claw: "rake", scythe: "reap", axe: "chop" };
  function resolve(fight, s) {
    const C = data(), k = fight.k, u = s.fu, [ox, oy] = chestOf(fight), amount = u.hit * u.K * s.charge;
    const look = { el: u.element, mat: u.material };
    const o = extra => Object.assign({ form: s.form, kind: "direct", from: [ox, oy], melee: true, fu: u }, extra || {});
    const struck = [];
    if (s.form === "slash") {
      const half = u.arc / 2 * RAD, a0 = s.a - half, a1 = s.a + half;
      emit(fight, Object.assign({ type: "fx", kind: "smear", x: ox, y: oy, r: u.reach, a0: u.spin ? s.a : a0, a1: u.spin ? s.a + TAU : a1, style: u.spin ? "spin" : (SMEAR[u.fuse || u.base] || "crescent") }, look));
      for (const d of fight.dummies) { const p = hitPoint(d), dd = dist(ox, oy, p[0], p[1]), a = Math.atan2(p[1] - oy, p[0] - ox);
        if (dd <= u.reach + d.r && (u.spin || Math.abs(angDiff(a, s.a)) <= half + C.forms.slash.slack)) { struck.push(d); hit(fight, d, amount, o()); } }
      if ((u.fuse || u.base) === "axe" && !u.spin) emit(fight, { type: "fx", kind: "dust", x: ox + Math.cos(s.a) * u.reach, y: k.y + Math.sin(s.a) * u.reach * 0.6 });
    } else if (s.form === "thrust") {
      if (u.spin) {
        emit(fight, Object.assign({ type: "fx", kind: "smear", x: ox, y: oy, r: u.reach, a0: s.a, a1: s.a + TAU, style: "spin" }, look));
        for (const d of fight.dummies) { const p = hitPoint(d); if (dist(ox, oy, p[0], p[1]) <= u.reach + d.r) { struck.push(d); hit(fight, d, amount, o()); } }
      } else {
        emit(fight, Object.assign({ type: "fx", kind: "streak", x: ox, y: oy, a: s.a, len: u.reach }, look));
        const hits = [], ca = Math.cos(s.a), sa = Math.sin(s.a);
        for (const d of fight.dummies) { const p = hitPoint(d), dx = p[0] - ox, dy = p[1] - oy, along = dx * ca + dy * sa, across = Math.abs(-dx * sa + dy * ca);
          if (along >= 0 && along <= u.reach + d.r && across <= u.width / 2 + d.r) hits.push([along, d]); }
        hits.sort((a, b) => a[0] - b[0] || a[1].i - b[1].i);
        for (const [, d] of (u.mods.has("pierce") ? hits : hits.slice(0, 1))) { struck.push(d); hit(fight, d, amount, o()); }
        if (hits.length) { const p = hitPoint(hits[0][1]); emit(fight, Object.assign({ type: "fx", kind: "star", x: p[0] - ca * 5, y: p[1] - sa * 5 }, look)); }
      }
    } else if (s.form === "smash") {
      // land (the Wrecking Ball): the blow comes down on the foe it aims at, up to its reach
      const R = u.land && s.target ? Math.min(u.reach, Math.max(0, dist(ox, oy, hitPoint(s.target)[0], hitPoint(s.target)[1]))) : u.reach;
      const cx = u.spin ? ox : ox + Math.cos(s.a) * R, cy = u.spin ? oy : oy + Math.sin(s.a) * R, r = u.spin ? u.reach : u.burst;
      const gy = u.spin ? k.y : k.y + Math.sin(s.a) * R * 0.6 + 2;
      emit(fight, Object.assign({ type: "fx", kind: u.spin ? "whirl" : "ring", x: cx, y: gy, r }, look));
      if (!u.spin) emit(fight, { type: "fx", kind: "crack", x: cx, y: gy, seed: fight.steps });
      emit(fight, { type: "shake", amp: C.forms.smash.shake, time: C.feel.shakeT });
      for (const d of fight.dummies) { const p = hitPoint(d); if (dist(cx, cy, p[0], p[1]) <= r + d.r) { struck.push(d); hit(fight, d, amount, o({ centre: u.spin ? null : [cx, cy + C.knight.chest] })); } }
    } else if (s.form === "shoot") {
      shoot(fight, s);
    } else if (s.form === "lob") {
      lob(fight, s);
    }
    if (u.melee) {
      // split, off a projectile: each attack also hits a second target within reach at 50 %
      if (u.mods.has("split")) {
        const near = fight.dummies.filter(d => !struck.includes(d)).map(d => { const p = hitPoint(d); return [dist(ox, oy, p[0], p[1]) - d.r, d]; }).filter(e => e[0] <= u.reach).sort((a, b) => a[0] - b[0] || a[1].i - b[1].i)[0];
        const d = near ? near[1] : struck[0];
        if (d) { if (near) emit(fight, Object.assign({ type: "fx", kind: "arc", from: [ox, oy], to: hitPoint(d) }, look)); hit(fight, d, amount * C.modifiers.split.share, o({ kind: "raw", why: "split" })); }
      }
      // boomerang, off a projectile: each attack also throws a ghost copy out to 2 x reach and back at 60 %
      if (u.mods.has("boomerang")) { const B = C.modifiers.boomerang;
        addShot(fight, { kind: "ghost", x: ox, y: oy, a: s.a, v: B.speed, range: u.reach * B.ghost, target: null, fu: u, hand: s.hand, amount: amount * B.share, r: B.size, boomerang: true, form: s.form, ghost: true }); }
    }
  }

  // ------------------------------------------------------------------ shots
  function addShot(fight, p) {
    const C = data();
    const k = fight.k;
    const s = Object.assign({ id: fight.nextId++, fx: k.x, fy: k.y, traveled: 0, hits: [], pierce: 0, back: false, homing: 0, boomerang: false, mult: 1, split: false, ricochet: 0, bounce: 0, phasing: false, halves: false, dropping: false, dropT: 0, trail: [], done: false, form: "shoot" }, p);
    fight.shots.push(s);
    while (fight.shots.length > C.caps.shots) fight.shots.shift();
    return s;
  }
  function shoot(fight, s) {
    const C = data(), u = s.fu, M = C.modifiers, [x, y] = tip(fight);
    const SP = Object.assign({}, M.spread, (u.over || {}).spread || {}), n = u.mods.has("spread") ? SP.shots : 1, fan = SP.fan * RAD;
    let a0 = s.a; if (s.target) { const hp = hitPoint(s.target); a0 = Math.atan2(hp[1] - y, hp[0] - x); }
    for (let i = 0; i < n; i++) {
      const a = a0 + (n > 1 ? (i - (n - 1) / 2) * fan / (n - 1) : 0);
      const p = addShot(fight, { kind: u.shotKind, x, y, a, v: u.pspeed, range: u.shot * (u.mods.has("bounce") ? M.bounce.travel : 1), reach: u.shot, target: s.target, fu: u, hand: s.hand, el: u.element, mat: u.material,
        amount: u.hit * u.K * s.charge, r: u.shotR, size: u.size, pierce: u.mods.has("pierce") ? mo(u, "pierce").through : 0, phasing: u.mods.has("phasing"),
        homing: u.mods.has("homing") ? M.homing.turn : u.mods.has("seeking") ? M.seeking.turn : 0, boomerang: u.mods.has("boomerang"), mult: n > 1 ? SP.each : 1,
        split: u.mods.has("split"), ricochet: u.mods.has("ricochet") ? M.ricochet.turns : 0, bounce: u.mods.has("bounce") ? M.bounce.walls : 0, form: s.form });
      emit(fight, { type: "shot", id: p.id, kind: p.kind, x, y, a, el: u.element });
    }
  }
  function nearest(fight, x, y, except, within) {
    let b = null, bd = Infinity;
    for (const d of fight.dummies) { if (except && except.includes(d.i)) continue; const p = hitPoint(d), dd = dist(x, y, p[0], p[1]); if (dd < bd && (within === undefined || dd <= within)) { bd = dd; b = d; } }
    return b;
  }
  function lob(fight, s) {
    const C = data(), k = fight.k, u = s.fu, M = C.modifiers, F = C.forms.lob, [x, y] = tip(fight);
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
      [tx, ty] = onFloor(fight, tx, ty);   // aimed at a wall, it lands at the nearest floor point
      const d = dist(k.x, k.y, tx, ty); T = Math.max(F.minT, d / u.pspeed);
      const p = addShot(fight, { kind: "shell", x0: x, y0: k.y, sx: x, sy: y, x: x, y: y, tx, ty, T, age: 0, h: Math.max(F.minRise, d * F.rise), gx: x, gy: k.y, z: k.y - y, fu: u, hand: s.hand, el: u.element, mat: u.material,
        amount: u.hit * u.K * s.charge * (n > 1 ? SP.each : 1), a: Math.atan2(ty - k.y, tx - k.x), size: u.size, hops: u.mods.has("bounce") ? 1 : 0, form: "lob" });
      emit(fight, { type: "shot", id: p.id, kind: "shell", x, y, a: p.a, el: u.element });
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
    const C = data(), k = fight.k, M = C.modifiers, W = fight.walls, chest = C.knight.chest;
    for (const p of fight.shots) {
      if (p.done) continue;
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
          for (const sgn of [-1, 1]) addShot(fight, { kind: p.kind, x: p.x, y: p.y, fx: p.x, fy: p.y + chest, a: p.a + sgn * M.split.angle * RAD, v: p.v, range: p.range, traveled: p.traveled, target: null, fu: p.fu, hand: p.hand, el: p.el, mat: p.mat, amount: p.amount,
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
        p.done = true; emit(fight, { type: "fx", kind: "star", x: p.x, y: p.y, el: p.el, mat: p.mat }); break;
      }
      if (p.done) continue;
      if (p.traveled >= p.range && !p.back) { if (p.boomerang) { p.back = true; p.hits = []; } else { p.dropping = true; p.dropT = 0; emit(fight, { type: "drop", id: p.id, x: p.x, y: p.y }); } }
      // the walls: a shot stops at one, or bounces off it up to twice
      const fy = p.y + chest;
      if (p.x < W.x0 || p.x > W.x1 || fy < W.y0 || fy > W.y1) {
        if (p.bounce > 0 && !p.back) { p.bounce--; if (p.x < W.x0 || p.x > W.x1) { p.a = Math.PI - p.a; p.x = clamp(p.x, W.x0, W.x1); } if (fy < W.y0 || fy > W.y1) { p.a = -p.a; p.y = clamp(fy, W.y0, W.y1) - chest; } p.target = null; p.fx = p.x; p.fy = p.y + chest; emit(fight, { type: "fx", kind: "star", x: p.x, y: p.y, el: p.el, mat: p.mat }); }
        else if (!p.back) { p.done = true; emit(fight, { type: "fx", kind: "star", x: clamp(p.x, W.x0, W.x1), y: clamp(fy, W.y0, W.y1) - chest, el: p.el, mat: p.mat }); }
      }
    }
    fight.shots = fight.shots.filter(p => !p.done);
  }
  // a burst on the floor at (x, y): everything whose chest is within r of the point at chest height
  function burst(fight, x, y, r, amount, form, fu, o) {
    const C = data(), chest = C.knight.chest;
    emit(fight, { type: "fx", kind: "blast", x, y, r, el: fu.element });
    emit(fight, { type: "shake", amp: (C.forms[form] || {}).shake || 3, time: C.feel.shakeT });
    fight.live.push({ type: "circle", x, y: y - chest, r });
    for (const d of fight.dummies) { const p = hitPoint(d); if (dist(x, y - chest, p[0], p[1]) <= r + d.r) hit(fight, d, amount, Object.assign({ form, kind: "direct", from: [x, y - chest - 8], fu, melee: false, centre: [x, y] }, o || {})); }
  }

  // ------------------------------------------------------------------ the stream: a cone while held (and a legend's gout)
  function cone(fight, S, fu, per, statusBase) {
    const half = fu.half * RAD, L = fu.streamLen, arms = [S.a];
    if (fu.mods.has("twin")) arms.push(S.a + data().forms.stream.twinOff * RAD);   // twin: a second cone 30 degrees off
    S.arms = arms;
    for (const a of arms) fight.live.push({ type: "cone", x: S.x, y: S.y, a, half, len: L });
    if (per === null) return;
    for (const d of fight.dummies) { const p = hitPoint(d), dd = dist(S.x, S.y, p[0], p[1]), a = Math.atan2(p[1] - S.y, p[0] - S.x);
      let inside = 0; for (const arm of arms) if (dd <= L + d.r && Math.abs(angDiff(a, arm)) <= half + Math.atan2(d.r, Math.max(1, dd))) inside++;
      for (let i = 0; i < inside; i++) hit(fight, d, per, { form: "stream", kind: "tick", from: [S.x, S.y], fu, sum: true, share: statusBase }); }
  }
  function streamStep(fight, dt, inp) {
    const C = data(), k = fight.k, F = C.forms.stream;
    if (!k.streamOn) { k.stream = null; return; }
    const hand = fight.hands[k.active], u = hand.u;
    k.holdT += dt;
    const charging = u.mods.has("charge") && k.holdT < F.chargeT;   // charge, on a stream: the first 0.6 s sputters, then it flows at x 1.5
    const am = aim(fight, u, inp.target);
    k.face = am.a;
    if (!k.stream) k.stream = { tick: 0 };
    const S = k.stream; S.charging = charging; S.el = u.element; S.half = u.half; S.len = u.streamLen;
    const [ox, oy] = tip(fight);
    S.x = ox; S.y = oy;
    S.a = am.d ? (hp => Math.atan2(hp[1] - oy, hp[0] - ox))(hitPoint(am.d)) : am.a;
    S.tick = charging ? 0 : S.tick + dt;   // the ticks start when the stream flows
    let per = null;
    if (S.tick >= F.tick - 1e-9) { S.tick = 0; per = u.hit * u.K * u.rate * F.tick * (u.mods.has("charge") ? F.chargeX : 1); }
    cone(fight, S, u, per, u.rate * F.tick);
    if (k.holdT >= u.hold - 1e-9) { stopStream(fight); hand.recover = F.recover; hand.recoverOf = F.recover; emit(fight, { type: "recover", what: "stream", hand: k.active, time: F.recover }); }
  }
  function startGout(fight, fu, want, charge) {
    const k = fight.k, am = aim(fight, fu, want);
    k.face = am.a;
    k.gout = { t: 0, T: data().forms.stream.gout, tick: 0, a: am.a, target: am.d, fu, charge: charge || 1, el: fu.element, half: fu.half, len: fu.streamLen };
    emit(fight, { type: "strike", form: "stream", hand: k.active, second: fu.isSecond, twin: false, a: am.a, target: am.d ? am.d.i : null, charge: charge || 1 });
    return true;
  }
  function goutStep(fight, dt) {
    const C = data(), k = fight.k, G = k.gout, F = C.forms.stream;
    if (!G) return;
    G.t += dt; G.tick += dt;
    const [ox, oy] = tip(fight);
    G.x = ox; G.y = oy;
    if (G.target) { const hp = hitPoint(G.target); G.a = Math.atan2(hp[1] - oy, hp[0] - ox); }
    let per = null;
    if (G.tick >= F.tick - 1e-9) { G.tick = 0; per = G.fu.hit * G.fu.K * G.fu.rate * F.tick * G.charge; }
    cone(fight, G, G.fu, per, G.fu.rate * F.tick);
    if (G.t >= G.T - 1e-9) k.gout = null;
  }

  // ------------------------------------------------------------------ orbit, field, trap, summon
  function startOrbit(fight, hand, fu, charge) {
    if (hand.orbit || hand.recover > 0) return false;
    const n = fu.bodies * (fu.mods.has("twin") ? 2 : 1);   // twin: twice the bodies
    hand.orbit = { t: 0, life: fu.active, phase: 0, n, hits: {}, fu, charge: charge || 1, pos: [] };
    emit(fight, { type: "orbit", hand: fight.hands.indexOf(hand), bodies: n, life: fu.active });
    return true;
  }
  function orbitsStep(fight, dt) {
    const C = data(), k = fight.k, F = C.forms.orbit;
    fight.hands.forEach((hand, hi) => {
      const O = hand.orbit; if (!O) return;
      const u = O.fu;
      O.t += dt; O.phase += u.orbitW * dt;
      O.pos = [];
      for (let i = 0; i < O.n; i++) { const a = O.phase + i * TAU / O.n; O.pos.push([k.x + Math.cos(a) * u.orbitR, k.y + Math.sin(a) * u.orbitR]); }
      fight.live.push({ type: "ring", x: k.x, y: k.y - 10, r: u.orbitR });
      O.pos.forEach((p, i) => { for (const d of fight.dummies) { const key = i + ":" + d.i, last = O.hits[key] === undefined ? -9 : O.hits[key];
        if (dist(p[0], p[1], d.x, d.y) <= u.touch + d.r && O.t - last >= F.again) { O.hits[key] = O.t; hit(fight, d, u.hit * u.K * O.charge, { form: "orbit", kind: "direct", from: [p[0], p[1] - 10], floor: p, fu: u, melee: false }); } } });
      if (O.t >= O.life - 1e-9) { hand.orbit = null; hand.recover = F.recover; hand.recoverOf = F.recover; emit(fight, { type: "recover", what: "orbit", hand: hi, time: F.recover }); }
    });
  }
  function startAura(fight, hand, fu, charge) {
    if (hand.aura || hand.recover > 0) return false;
    hand.aura = { t: 0, life: fu.active, next: data().forms.field.first, again: -1, pulse: -1, fu, charge: charge || 1 };
    emit(fight, { type: "field", hand: fight.hands.indexOf(hand), r: fu.fieldR, life: fu.active });
    return true;
  }
  function aurasStep(fight, dt) {
    const C = data(), k = fight.k, F = C.forms.field;
    fight.hands.forEach((hand, hi) => {
      const A = hand.aura; if (!A) return;
      const u = A.fu;
      A.t += dt; A.next -= dt; if (A.again >= 0) A.again -= dt;
      fight.live.push({ type: "floorcircle", x: k.x, y: k.y, r: u.fieldR });
      const pulse = () => { A.pulse = A.t; emit(fight, { type: "pulse", hand: hi, x: k.x, y: k.y, r: u.fieldR, el: u.element });
        for (const d of fight.dummies) if (dist(k.x, k.y, d.x, d.y) <= u.fieldR + d.r) hit(fight, d, u.hit * u.K * A.charge, { form: "field", kind: "direct", from: [k.x, k.y - C.knight.chest], fu: u, melee: false, centre: [k.x, k.y], own: true }); };
      if (A.next <= 1e-9) { A.next += 1 / u.rate; pulse(); if (u.mods.has("twin")) A.again = F.twinGap; }   // twin: a double pulse
      else if (A.again >= 0 && A.again <= 1e-9) { A.again = -1; pulse(); }
      if (A.t >= A.life - 1e-9) { hand.aura = null; hand.recover = F.recover; hand.recoverOf = F.recover; emit(fight, { type: "recover", what: "field", hand: hi, time: F.recover }); }
    });
  }
  function placeTrap(fight, hand, fu, want, charge) {
    const C = data(), k = fight.k, F = C.forms.trap;
    if (hand.cd > 0) return false;
    const twin = fu.mods.has("twin"), cap = twin ? Math.min(F.maxTwin, C.caps.trapsTwin) : Math.min(F.max, C.caps.traps);
    const am = aim(fight, fu, want);
    k.face = am.a;
    const spots = [[k.x + Math.cos(am.a) * fu.throwD, k.y + Math.sin(am.a) * fu.throwD]];
    if (twin) spots.push([spots[0][0] - Math.sin(am.a) * F.twinOff, spots[0][1] + Math.cos(am.a) * F.twinOff]);   // twin: two at a time
    for (const s of spots) {
      const [tx, ty] = onFloor(fight, s[0], s[1]);   // aimed at a wall, it lands at the nearest floor point
      fight.traps.push({ id: fight.nextId++, x0: k.x, y0: k.y - C.knight.chest, x: tx, y: ty, t: 0, armed: false, sprung: -1, fu, charge: charge || 1, owner: fight.hands.indexOf(hand) });
      emit(fight, { type: "place", x: tx, y: ty });
    }
    while (fight.traps.filter(t => t.sprung < 0).length > cap) { const old = fight.traps.find(t => t.sprung < 0); fight.traps.splice(fight.traps.indexOf(old), 1); }   // the oldest goes
    hand.cd = Math.max(1 / fu.rate, F.gap);
    return true;
  }
  function trapsStep(fight, dt) {
    const F = data().forms.trap;
    for (const tr of fight.traps) {
      tr.t += dt;
      if (tr.sprung >= 0) { tr.sprung += dt; continue; }
      if (!tr.armed && tr.t >= F.arm - 1e-9) { tr.armed = true; emit(fight, { type: "armed", x: tr.x, y: tr.y }); }
      if (tr.armed) for (const d of fight.dummies) if (dist(tr.x, tr.y, d.x, d.y) <= F.spring + d.r) {
        tr.sprung = 0; emit(fight, { type: "spring", x: tr.x, y: tr.y, d: d.i });
        burst(fight, tr.x, tr.y, tr.fu.burst, tr.fu.hit * tr.fu.K * tr.charge, "trap", tr.fu); break; }
      if (tr.sprung < 0 && tr.t > tr.fu.life) { tr.sprung = 99; emit(fight, { type: "expire", what: "trap", x: tr.x, y: tr.y }); }
    }
    fight.traps = fight.traps.filter(tr => tr.sprung < F.shut);
  }
  function summon(fight, hand, fu, charge) {
    const C = data(), k = fight.k, F = C.forms.summon, hi = fight.hands.indexOf(hand);
    const cap = Math.min(fu.mods.has("twin") ? F.maxTwin : F.max, C.caps.minions), mine = fight.minions.filter(m => m.owner === hi).length;
    if (mine >= cap) return false;
    const n = fu.mods.has("twin") ? cap - mine : 1;   // twin: one press calls both
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? -1 : 1, [x, y] = onFloor(fight, k.x + side * F.beside[0], k.y + F.beside[1]);
      fight.minions.push({ id: fight.nextId++, x, y, t: 0, life: fu.life, cd: 0, fu, charge: charge || 1, swing: 0, walkT: 0, face: 1, owner: hi });
      emit(fight, { type: "summon", x, y });
    }
    return true;
  }
  function minionsStep(fight, dt) {
    const F = data().forms.summon;
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
      if (m.t >= m.life - 1e-9) { m.gone = true; emit(fight, { type: "expire", what: "minion", x: m.x, y: m.y }); }
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
    if (mine.length > cap) fight.patches.splice(fight.patches.indexOf(mine[0]), 1);   // the oldest goes
    emit(fight, { type: "patch", kind, x, y, r });
    return p;
  }
  function patchesStep(fight, dt) {
    const C = data(), M = C.modifiers, P = C.patch;
    for (const d of fight.dummies) d.chill = false;
    for (const p of fight.patches) {
      p.t += dt; p.tick += dt;
      const inside = d => dist(p.x, p.y, d.x, d.y) <= p.r + d.r * 0.5;
      if (p.kind === "fire") { if (p.tick >= P.tick - 1e-9) { p.tick = 0; for (const d of fight.dummies) if (inside(d)) dot(fight, d, p.fu.hit * M.ignite_ground.rate * P.tick, "fire"); } }
      else for (const d of fight.dummies) if (inside(d)) d.chill = true;   // frost slows what stands in it
    }
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
    const C = data(), k = fight.k, u = o.fu, M = C.modifiers, FEEL = C.feel;
    const mult = affinity(d, o.form, u.element, u);
    let dmg = base * mult, tag = mult > 1.01 ? "WEAK" : mult === 0 ? "IMMUNE" : mult < 0.99 ? "RESIST" : null, crit = false;
    const direct = o.kind === "direct";
    if (direct && fight.crits && u.crit > 0 && fight.rand() < u.crit) { dmg *= u.critX; crit = true; }
    if (d.st.mark) dmg *= C.statuses.mark.more;
    if (u.mods.has("combo") && direct) {   // the third hit in a row on the same target within 1.5 s deals x 2, then the count restarts
      if (d.combo && fight.t - d.combo.t < M.combo.within) d.combo.n++; else d.combo = { n: 1 };
      d.combo.t = fight.t;
      if (d.combo.n >= M.combo.hits) { dmg *= M.combo.x; tag = "COMBO"; d.combo = null; }
    }
    const hp = hitPoint(d), from = o.from || chestOf(fight), seen = Math.atan2(hp[1] - from[1], hp[0] - from[0]);
    // a push goes along the floor, away from where the blow came from: the knight, where a shot was loosed, a burst's centre, a mote,
    // a minion (heights are drawn up the screen, so the line from a raised tip to a chest is not the way the blow travels)
    const foot = o.centre || o.floor || [k.x, k.y], ang = Math.hypot(d.x - foot[0], d.y - foot[1]) > 1e-6 ? Math.atan2(d.y - foot[1], d.x - foot[0]) : seen;
    const share = o.kind === "tick" ? (o.share || 1) : 1;   // a stream's tick pushes and afflicts by its share of a blow
    let push = direct || o.kind === "tick" ? u.push * share * (u.statuses.includes("knockback") ? C.statuses.knockback.push : 1) : 0;
    // bounce, off a projectile: a target pushed into a wall or a rail stop takes 25 % more
    if (u.mods.has("bounce") && direct && o.form !== "shoot" && o.form !== "lob" && push > 0 && d.rail && !d.st.freeze && !d.st.stun) {
      const nx = d.x + Math.cos(ang) * push; if (nx > d.rail.x1 || nx < d.rail.x0) { dmg *= M.bounce.wall; if (!tag) tag = "WALL"; }
    }
    const e = emit(fight, { type: "hit", d: d.i, dummy: d.kind, amount: dmg, tag, crit, form: o.form, element: u.element, kind: o.kind, why: o.why || null, x: hp[0], y: hp[1], melee: !!o.melee,
      hold: direct && o.melee ? (crit ? FEEL.holdCrit : FEEL.hold) : 0, sum: !!o.sum });
    log(fight, d, dmg);
    if (mult === 0) return e;   // immune: nothing of the blow lands
    if (o.kind === "raw") { d.flash = FEEL.flash; if (!d.rail && !d.arm) d.wv += C.wobble.raw; return e; }
    if (direct) d.flash = FEEL.flash;
    // the push and the pull: the rail dummy slides along its rail, the quintain's arm turns (0.15 rad/s per point of damage, 0.1 per
    // pixel of push), a dummy on a post wobbles
    const pull = u.mods.has("pull") ? mo(u, "pull").px * share : 0, to = o.centre && !o.own ? o.centre : [k.x, k.y], Q = C.dummies.quintain, W = C.wobble;
    if (d.rail) { if (!d.st.freeze && !d.st.stun && (push > 0 || pull > 0)) d.x = clamp(d.x + Math.cos(ang) * push + Math.sign(to[0] - d.x) * Math.min(pull, Math.abs(to[0] - d.x)), d.rail.x0, d.rail.x1); }
    else if (d.arm) { if (direct) d.arm.w += (Q.perDamage * dmg + Q.perPush * push) * (Math.sin(angDiff(ang, d.arm.a)) >= 0 ? 1 : -1); }
    else d.wv += (Math.sign(Math.cos(ang) || 1) * (W.kick + push * W.perPush) - Math.sign(to[0] - d.x) * pull * W.perPush) * W.gain * share;
    if (direct && d.puff) emit(fight, { type: "fx", kind: d.puff, x: d.puff === "sparks" ? hp[0] - Math.cos(seen) * 4 : hp[0], y: hp[1], seed: fight.steps + d.i });
    // statuses
    const strength = o.kind === "tick" ? dmg / share : dmg;
    for (const s of u.statuses) { if (d.immune.includes(s)) { emit(fight, { type: "immune", d: d.i, status: s, x: hp[0], y: hp[1] }); continue; } applyStatus(fight, d, s, strength, u, o); }
    if (u.mods.has("sticky")) d.st.sticky = { t: M.sticky.time };   // hits slow the target 40 % for 1 s
    if (u.mods.has("vampiric")) emit(fight, { type: "heal", amount: dmg * mo(u, "vampiric").heal, why: "vampiric", x: k.x, y: k.y });
    if (u.mods.has("ignite_ground")) patch(fight, "fire", d.x, d.y, M.ignite_ground.radius, u.statusT, u);
    if (u.mods.has("frost_trail")) patch(fight, "frost", d.x, d.y, M.frost_trail.radius, u.statusT, u);
    if (o.ghost) return e;   // a ghost copy carries the statuses; it doesn't burst or jump
    // explode, off a burst: every hit also bursts for 40 % within 15 px of the target
    if (u.mods.has("explode") && o.form !== "smash" && o.form !== "lob" && o.form !== "trap") {
      if (direct) emit(fight, { type: "fx", kind: "blast", x: d.x, y: d.y, r: M.explode.within, el: u.element, small: true });
      for (const x of fight.dummies) if (dist(d.x, d.y, x.x, x.y) <= M.explode.within + (x === d ? 0 : x.r)) hit(fight, x, base * M.explode.share, { form: o.form, kind: "raw", why: "explode", from: [d.x, d.y - d.chest], fu: u, sum: !!o.sum });
    }
    // chain: each hit jumps to up to 2 more targets within 56 px at 50 %
    if (u.mods.has("chain")) jump(fight, d, base * M.chain.share, M.chain.jumps, M.chain.within, "chain", u, o);
    // ricochet, off a projectile: one jump at 70 % within 56 px
    if (u.mods.has("ricochet") && o.form !== "shoot") jump(fight, d, base * M.ricochet.share, 1, M.ricochet.otherWithin, "ricochet", u, o);
    return e;
  }
  // a jumped hit carries no statuses and doesn't jump again
  function jump(fight, d, amount, n, within, why, u, o) {
    const others = fight.dummies.filter(x => x !== d).map(x => [dist(d.x, d.y, x.x, x.y), x]).filter(p => p[0] <= within).sort((a, b) => a[0] - b[0] || a[1].i - b[1].i).slice(0, n);
    let prev = d;
    for (const [, x] of others) { if (o.kind === "direct") emit(fight, { type: "fx", kind: "arc", from: hitPoint(prev), to: hitPoint(x), el: u.element, mat: u.material, seed: fight.steps + x.i }); hit(fight, x, amount, { form: o.form, kind: "raw", why, from: hitPoint(prev), fu: u, sum: !!o.sum }); prev = x; }
  }
  // damage over time: a tick of burn, poison or bleed, or a burning patch
  function dot(fight, d, amount, what) {
    const hp = hitPoint(d), dmg = amount * (d.st.mark ? data().statuses.mark.more : 1);
    emit(fight, { type: "hit", d: d.i, dummy: d.kind, amount: dmg, tag: null, crit: false, form: null, element: what, kind: "dot", why: what, x: hp[0], y: hp[1], melee: false, hold: 0, sum: false });
    log(fight, d, dmg);
  }
  function log(fight, d, dmg) { const b = fight.board; b.last = dmg; b.name = d.name; b.log.push([fight.t, dmg]); }
  function applyStatus(fight, d, s, dmg, u, o) {
    const C = data(), S = C.statuses, T = u.statusT, st = d.st, Z = S[s];
    let applied = true;
    if (s === "burn") st.burn = { t: T, rate: Math.max((st.burn || {}).rate || 0, dmg * Z.rate), tick: (st.burn || {}).tick || 0 };   // reapplying refreshes it and keeps the higher rate
    else if (s === "freeze") { if (st.freezeImm || st.freeze) applied = false; else st.freeze = { t: Math.min(T, Z.max) }; }
    else if (s === "shock") {
      st.shock = { t: Z.show };
      if (o.kind === "direct") { const near = fight.dummies.filter(x => x !== d).map(x => [dist(d.x, d.y, x.x, x.y), x]).filter(p => p[0] <= Z.within).sort((a, b) => a[0] - b[0] || a[1].i - b[1].i)[0];
        if (near) { emit(fight, { type: "fx", kind: "arc", from: hitPoint(d), to: hitPoint(near[1]), el: "lightning", seed: fight.steps }); hit(fight, near[1], dmg * Z.share, { form: o.form, kind: "raw", why: "shock", from: hitPoint(d), fu: u }); } }
    }
    else if (s === "poisoned") st.poisoned = { t: T, stacks: Math.min(Z.stacks, ((st.poisoned || {}).stacks || 0) + 1), rate: Math.max((st.poisoned || {}).rate || 0, dmg * Z.rate), tick: (st.poisoned || {}).tick || 0 };
    else if (s === "bleed") st.bleed = { t: T, stacks: Math.min(Z.stacks, ((st.bleed || {}).stacks || 0) + 1), rate: Math.max((st.bleed || {}).rate || 0, dmg * Z.rate), tick: (st.bleed || {}).tick || 0 };
    else if (s === "stun") { if (st.stunImm || st.stun) applied = false; else st.stun = { t: Z.time }; }
    else if (s === "slow" || s === "blind" || s === "weaken" || s === "mark") st[s] = { t: T };
    else if (s === "lifesteal") emit(fight, { type: "heal", amount: dmg * Z.heal, why: "lifesteal", x: fight.k.x, y: fight.k.y, from: hitPoint(d) });
    else if (s === "knockback") { /* this hit's push x 1.5: applied with the push */ }
    if (applied) emit(fight, { type: "status", d: d.i, status: s, stacks: (st[s] || {}).stacks || null });
    return applied;
  }

  // ------------------------------------------------------------------ the dummies: statuses, the wobble, the rail, the quintain
  function dummiesStep(fight, dt) {
    const C = data(), k = fight.k, S = C.statuses, W = C.wobble, Q = C.dummies.quintain, M = C.modifiers;
    const hand = fight.hands[k.active], u = hand.u;
    for (const d of fight.dummies) {
      d.flash = Math.max(0, d.flash - dt);
      // the wobble: a spring on the post
      d.wv += (-W.spring * d.wob - W.damp * d.wv) * dt; d.wob += d.wv * dt; d.wob = clamp(d.wob, -W.max, W.max);
      const st = d.st;
      for (const key of Object.keys(st)) {
        const s = st[key]; s.t -= dt;
        if (key === "burn" || key === "poisoned" || key === "bleed") { s.tick += dt; if (s.tick >= S.tick - 1e-9) { s.tick = 0; dot(fight, d, s.rate * (s.stacks || 1) * S.tick, key === "burn" ? "fire" : key === "poisoned" ? "poison" : "bleed"); } }
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
        if (!held && arm.cool <= 0 && Math.abs(arm.w) > Q.bonkAbove && k.bonk <= 0 && k.dodge <= 0 && k.safe <= 0 && dist(bx, by, k.x, k.y) < Q.bagR) {
          arm.cool = Q.again;
          const facing = Math.abs(angDiff(Math.atan2(d.y - k.y, d.x - k.x), k.face)) < Math.PI / 2;
          if (st.blind && fight.rand() < S.blind.miss) emit(fight, { type: "miss", x: k.x, y: k.y, d: d.i });   // a blinded quintain misses half the time
          else if (k.guardT > 0) { arm.w = -arm.w; emit(fight, { type: "block", x: k.x, y: k.y, bx: (bx + k.x) / 2, by: k.y - 14, d: d.i }); emit(fight, { type: "reflect", x: k.x, y: k.y, d: d.i }); }
          else if (u.mods.has("guard") && facing) { arm.w = -arm.w * Q.blockBack; emit(fight, { type: "block", x: k.x, y: k.y, bx: (bx + k.x) / 2, by: k.y - 14, d: d.i }); }
          else if (u.mods.has("reflect")) { arm.w = -arm.w; emit(fight, { type: "reflect", x: k.x, y: k.y, d: d.i }); }
          else {
            const a = Math.atan2(k.y - d.y, k.x - d.x), px = Q.push * (st.weaken ? 1 - S.weaken.less : 1);   // a weakened quintain shoves 40 % less
            k.bonk = Q.stagger; k.shove = { t: 0, T: Q.pushT, dx: Math.cos(a) * px, dy: Math.sin(a) * px };
            k.strike = null; k.twinQ = null; k.gout = null; k.charging = false; k.chargeT = 0; k.lunge = null; stopStream(fight);
            emit(fight, { type: "bonk", x: k.x, y: k.y, push: px, d: d.i });
          }
        }
      }
    }
  }
  // ------------------------------------------------------------------ resetting the room (the menu's Reset)
  function reset(fight) {
    for (const d of fight.dummies) { d.st = {}; d.wob = 0; d.wv = 0; d.flash = 0; d.combo = null; d.chill = false; if (d.arm) { d.arm.w = 0; d.arm.cool = 0; } }
    fight.shots = []; fight.traps = []; fight.minions = []; fight.patches = [];
    for (const h of fight.hands) { h.orbit = null; h.aura = null; h.recover = 0; h.cd = 0; h.acd = 0; }
    fight.board = { last: null, name: "", log: [], dps: 0 };
    const k = fight.k; k.strike = null; k.twinQ = null; k.gout = null; k.charging = false; k.chargeT = 0; k.abQ = null; k.guardT = 0; stopStream(fight);
    return fight;
  }

  root.Combat = { abilityUnits, abilities, units, unitsFor, newFight, step, hold, tip, aim, animOf, weaponPose, facingOf, hitPoint, reachOf, setHand, addHand, reset, affinity, railAhead, use, rng, FACINGS, NUMBERS };
  if (typeof module !== "undefined" && module.exports) module.exports = root.Combat;
})(typeof window !== "undefined" ? window : globalThis);
