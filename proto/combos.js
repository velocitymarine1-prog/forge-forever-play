// FORGE FOREVER: the melee combos (design pass 20, card t74; built by build 13). What a combo's moves look like: the screen's half of the
// combos, pure (no DOM, no clock), read by proto/battlegrounds.js; the rules' half (the chain, the finisher's numbers) is proto/combat.js
// with spec/combat.json's "combos" block, which this file reads for the sets of moves and the finisher's times.
//
// Every melee weapon (a slash, thrust or smash form: sword, dagger, axe, hammer, spear, shield, claw, whip, flail, scythe, lance)
// strikes in a chain of three moves and starts over: I and II, then III, the finisher. Each class has its own three moves (the spec's
// sets), each move one of fourteen shapes (ARCH: the overhead, the sweep, the rising cut, the thrust, the leap...) with its class's look
// (MOVES: the smear's style, how low it sweeps, what flies off the hit). A shape is a few keyframes per view (the knight's pose, the
// weapon's direction and the way it turns, the knight moved a few pixels: step in, crouch, hop, leap) and the smear's curve: an arc of an
// ellipse around the chest, upright for a chop, flattened for a sweep (its far half drawn behind the knight), tilted for a slam from the
// side, or straight streaks for a thrust.
//
// The knight's poses are proto/knight.js's ten combo poses; the weapon is PixelForge.swingFor, drawn in eight directions. Facing left is
// facing right mirrored; facing away is facing toward mirrored, its forward directions turned up the screen and the weapon behind the
// knight. Plain script, defines window.Combos (module.exports in node). Needs spec/combat.js (window.FORGE_COMBAT).
(function (root) {
  "use strict";
  const RAD = Math.PI / 180;

  // ------------------------------------------------------------------ the rules' numbers: spec/combat.json's "combos" block
  const NONE = { on: false, window: 0, reset: 0, finisher: { wind: 0, follow: 0 }, sets: {}, byForm: {} };
  const rules = () => (root.FORGE_COMBAT && root.FORGE_COMBAT.combos) || NONE;
  const MELEE = { slash: true, thrust: true, smash: true };
  // the forms' times when spec/combat.js is not loaded (they are spec/combat.json's)
  const FORMS = { slash: { wind: 0.08, act: 0.1, dur: 0.34 }, thrust: { wind: 0.06, act: 0.08, dur: 0.28 }, smash: { wind: 0.25, act: 0.06, dur: 0.5 } };

  // ------------------------------------------------------------------ the moves
  // arch: the shape (ARCH); style: the smear's look (crescent, chop, heavy, reap, lash, rake, streak, bash); dy: the smear lowered (a
  // sweep at the waist or the knees); fx: what the hit throws off besides the form's own (the finisher's flash, sparks and ring are
  // every finisher's): dust, crack, chunks, bleed, crack-star (a whip's tip), speed (speed lines), wisp, ring
  const MOVES = {
    cleave:          { name: "Cleave",         arch: "overhead", style: "crescent" },
    sweep:           { name: "Sweep",          arch: "sweep",    style: "crescent" },
    "rising-moon":   { name: "Rising Moon",    arch: "rising",   style: "crescent", fx: ["moon"] },
    chop:            { name: "Chop",           arch: "overhead", style: "chop", fx: ["dust"] },
    hew:             { name: "Hew",            arch: "sweep",    style: "chop", dy: 3 },
    headsman:        { name: "Headsman",       arch: "leap",     style: "chop", fx: ["crack", "dust", "chunks"] },
    slam:            { name: "Slam",           arch: "overhead", style: "heavy" },
    "side-slam":     { name: "Side Slam",      arch: "slant",    style: "heavy" },
    earthshaker:     { name: "Earthshaker",    arch: "leap",     style: "heavy", fx: ["crack", "crack", "chunks", "dust", "quake"] },
    jab:             { name: "Jab",            arch: "thrust",   style: "streak" },
    "low-stab":      { name: "Low Stab",       arch: "lowthrust", style: "streak" },
    plunge:          { name: "Plunge",         arch: "leap",     style: "streak", down: true, fx: ["bleed", "dust"] },
    thrust:          { name: "Thrust",         arch: "thrust",   style: "streak" },
    overhand:        { name: "Overhand",       arch: "overhand", style: "streak" },
    impale:          { name: "Impale",         arch: "charge",   style: "streak", fx: ["ring", "speed"] },
    couched:         { name: "Couched Thrust", arch: "thrust",   style: "streak" },
    lift:            { name: "Lift",           arch: "lift",     style: "streak" },
    "grand-charge":  { name: "Grand Charge",   arch: "charge",   style: "streak", fx: ["speed", "dust", "ring"] },
    bash:            { name: "Bash",           arch: "thrust",   style: "bash" },
    "rim-slam":      { name: "Rim Slam",       arch: "overhead", style: "heavy", small: true },
    bulwark:         { name: "Bulwark",        arch: "charge",   style: "bash", fx: ["speed", "dust", "ring"] },
    swipe:           { name: "Swipe",          arch: "slant",    style: "rake" },
    "gut-rake":      { name: "Gut Rake",       arch: "sweep",    style: "rake", dy: 3 },
    frenzy:          { name: "Frenzy",         arch: "cross",    style: "rake", fx: ["bleed"] },
    lash:            { name: "Lash",           arch: "overhead", style: "lash", fx: ["crack-star"] },
    sidewinder:      { name: "Sidewinder",     arch: "sweep",    style: "lash", dy: 9, fx: ["crack-star"] },
    "thunder-crack": { name: "Thunder Crack",  arch: "whirl",    style: "lash", fx: ["crack-star", "ring"] },
    whirl:           { name: "Whirl",          arch: "overhead", style: "heavy" },
    orbit:           { name: "Orbit",          arch: "spin",     style: "heavy" },
    meteor:          { name: "Meteor",         arch: "leap",     style: "heavy", fx: ["crack", "chunks", "dust", "quake"] },
    reap:            { name: "Reap",           arch: "sweep",    style: "reap", dy: 2 },
    hook:            { name: "Hook",           arch: "overhead", style: "reap" },
    "grim-harvest":  { name: "Grim Harvest",   arch: "spin",     style: "reap", fx: ["wisp", "bleed"] }
  };

  // ------------------------------------------------------------------ the shapes
  // A keyframe is [pose, dir, dx, dy, flags]: the knight's pose (20-knight.sketch.js), the weapon's direction (e ne n nw w sw s se on
  // the screen, facing right or toward), the knight moved dx forward and dy down (px), and flags: b the weapon behind the knight, g the
  // finisher's glint on the edge, o the weapon circling (its dir runs round `orbit`). set is the first half of a wind-up of 0.12 s or
  // more (the cock alone for a shorter one); hit is the first half of the blow's live time, where the hit lands and the screen holds;
  // follow runs from there to 0.05 s after the live time (the finisher's 0.12 s longer); then the knight is back in its hold. lead is the
  // way the swing turns on the screen (the edge, the bit and the scythe's blade lead it). smear: the side and the front's curve, R the
  // weapon's reach plus 2 (the hit's own measure): an arc of an ellipse (c: its centre from the chest, r: [rx, ry] in R, rot: the tilt,
  // a0 to a1: degrees on a dial with 0 ahead and 90 up, far: the part drawn behind the knight), or streaks (ang: degrees below ahead).
  const ARCH = {
    overhead: { lead: ["cw", "cw"],
      side: { set: ["raise", "n", -1, 0], cock: ["raise", "nw", -1, 0, "g"], hit: ["chop", "e", 2, 0], follow: ["chop", "se", 2, 0] },
      toward: { set: ["raise", "n", 0, 0], cock: ["raise", "n", 0, -1, "g"], hit: ["chop", "s", 0, 1], follow: ["chop", "s", 0, 1] },
      smear: { side: { c: [2, -3], r: [1, 1], a0: 130, a1: -35 }, toward: { c: [8, -3], r: [0.35, 1], a0: 90, a1: -90 } } },
    sweep: { lead: ["ccw", "cw"],
      side: { cock: ["cock", "w", -1, 0, "bg"], hit: ["sweep", "e", 2, 0], follow: ["sweep", "ne", 2, 0] },
      toward: { cock: ["cock", "e", 0, 0, "g"], hit: ["sweep", "w", 0, 0], follow: ["sweep", "sw", 0, 0] },
      smear: { side: { c: [0, 1], r: [1, 0.42], a0: 180, a1: 382, far: true }, toward: { c: [0, 2], r: [1, 0.42], a0: 0, a1: -180 } } },
    rising: { lead: ["ccw", "ccw"],
      side: { set: ["crouch", "s", 0, 1], cock: ["crouch", "sw", 0, 1, "g"], hit: ["rise", "ne", 1, -2], follow: ["rise", "n", 1, -2] },
      toward: { set: ["crouch", "s", 0, 1], cock: ["crouch", "s", 0, 1, "g"], hit: ["rise", "n", 0, -2], follow: ["rise", "n", 0, -2] },
      smear: { side: { c: [3, -3], r: [1, 1], a0: -105, a1: 82 }, toward: { c: [8, -3], r: [0.35, 1], a0: -90, a1: 90 } } },
    thrust: { lead: ["cw", "cw"],
      side: { cock: ["draw", "e", -2, 0, "g"], hit: ["lunge", "e", 3, 0], follow: ["lunge", "e", 2, 0] },
      toward: { cock: ["draw", "s", 0, -1, "g"], hit: ["lunge", "s", 0, 2], follow: ["lunge", "s", 0, 1] },
      smear: { side: { ang: 0 }, toward: { ang: 90 } } },
    lowthrust: { lead: ["cw", "cw"],
      side: { cock: ["draw", "e", -1, 0, "g"], hit: ["lunge", "se", 3, 1], follow: ["lunge", "se", 2, 1] },
      toward: { cock: ["draw", "s", 0, -1, "g"], hit: ["lunge", "s", 1, 2], follow: ["lunge", "s", 1, 2] },
      smear: { side: { ang: 28, dy: 3 }, toward: { ang: 90, dx: 2 } } },
    overhand: { lead: ["cw", "cw"],
      side: { cock: ["raise", "e", -1, 0, "g"], hit: ["chop", "se", 3, 0], follow: ["chop", "se", 2, 0] },
      toward: { cock: ["raise", "s", 0, -1, "g"], hit: ["chop", "s", 0, 2], follow: ["chop", "s", 0, 2] },
      smear: { side: { ang: 34, dy: -4 }, toward: { ang: 90 } } },
    lift: { lead: ["ccw", "ccw"],
      side: { cock: ["draw", "e", -1, 1, "g"], hit: ["rise", "ne", 2, -1], follow: ["rise", "ne", 2, -1] },
      toward: { cock: ["draw", "s", 0, 0, "g"], hit: ["rise", "n", 0, -1], follow: ["rise", "n", 0, -1] },
      smear: { side: { ang: -32, arc: { c: [0, -2], r: [1, 1], a0: -8, a1: 50 } }, toward: { ang: 90 } } },
    slant: { lead: ["cw", "cw"],
      side: { set: ["cock", "sw", -1, 0, "b"], cock: ["cock", "w", -1, 0, "bg"], hit: ["chop", "se", 2, 1], follow: ["land", "s", 2, 1] },
      toward: { set: ["cock", "e", 0, 0], cock: ["raise", "ne", 0, 0, "g"], hit: ["chop", "sw", 0, 1], follow: ["chop", "sw", 0, 1] },
      smear: { side: { c: [1, -1], r: [1, 0.6], rot: 20, a0: 200, a1: -25, far: true }, toward: { c: [0, -2], r: [1, 0.5], rot: -35, a0: 10, a1: -170 } } },
    leap: { lead: ["cw", "cw"],
      side: { set: ["crouch", "ne", 0, 1], cock: ["leap", "nw", 1, -6, "g"], hit: ["land", "se", 3, 0], follow: ["land", "s", 3, 0] },
      toward: { set: ["crouch", "ne", 0, 1], cock: ["leap", "n", 0, -6, "g"], hit: ["land", "s", 0, 1], follow: ["land", "s", 0, 1] },
      smear: { side: { c: [3, -8], r: [1.1, 1.2], a0: 135, a1: -55 }, toward: { c: [8, -6], r: [0.4, 1.2], a0: 90, a1: -95 } } },
    spin: { lead: ["cw", "cw"], turn: true,   // the wind-up turns the knight once round (TURN), then the blow comes round to the aim
      side: { cock: ["sweep", "e", 0, 0, "g"], hit: ["sweep", "e", 2, 0], follow: ["sweep", "ne", 2, 0] },
      toward: { cock: ["lunge", "s", 0, 0, "g"], hit: ["lunge", "s", 0, 1], follow: ["sweep", "sw", 0, 0] },
      smear: { side: { c: [0, 1], r: [1, 0.42], a0: 0, a1: -382, far: true }, toward: { c: [0, 2], r: [1, 0.42], a0: -90, a1: -472, far: true } } },
    charge: { lead: ["cw", "cw"],
      side: { cock: ["draw", "e", -3, 1, "g"], hit: ["lunge", "e", 5, 0], follow: ["lunge", "e", 4, 0] },
      toward: { cock: ["draw", "s", 0, -2, "g"], hit: ["lunge", "s", 0, 4], follow: ["lunge", "s", 0, 3] },
      smear: { side: { ang: 0, lines: 5 }, toward: { ang: 90, lines: 5 } } },
    cross: { lead: ["cw", "cw"],
      side: { set: ["raise", "n", -1, 0], cock: ["raise", "nw", -1, 0, "g"], hit: ["chop", "se", 2, 1], follow: ["chop", "s", 2, 1] },
      toward: { set: ["raise", "n", 0, 0], cock: ["raise", "n", 0, -1, "g"], hit: ["chop", "sw", 0, 1], follow: ["chop", "s", 0, 1] },
      smear: { side: { c: [2, -2], r: [1, 1], a0: 120, a1: -50 }, toward: { c: [4, -2], r: [0.7, 1], a0: 120, a1: -60 } } },
    whirl: { lead: ["cw", "cw"],
      side: { set: ["raise", "nw", 0, 0, "o"], cock: ["raise", "ne", 0, -1, "og"], hit: ["sweep", "e", 2, 0], follow: ["sweep", "e", 2, 0] },
      toward: { set: ["raise", "n", 0, 0, "o"], cock: ["raise", "n", 0, -1, "og"], hit: ["lunge", "s", 0, 1], follow: ["lunge", "s", 0, 1] },
      smear: { side: { ang: 0, whirl: { c: [-1, -22], r: [14, 5] } }, toward: { ang: 90, whirl: { c: [8, -22], r: [12, 4] } } } }
  };
  // the weapon circling over the head (flag o): its direction every 1/20 s
  const ORBIT = ["w", "nw", "n", "ne", "e", "ne", "n", "nw"];
  // a turn: the facings clockwise on the screen, and each one's pose with the weapon held out ahead (the right-facing or toward
  // drawing's direction; left and away are drawn as their mirrors)
  const TURN = ["right", "toward", "left", "away"], TURN_POSE = { right: ["sweep", "e"], left: ["sweep", "e"], toward: ["lunge", "s"], away: ["lunge", "s"] };

  // ------------------------------------------------------------------ which moves a weapon plays
  // the set of a weapon: its body's class (a legend's body, its left), or by its form; null for a form that isn't melee
  function setFor(thing) {
    const w = (thing && thing.weapon) || {}, v = w.visual || {}, form = w.form;
    if (!MELEE[form]) return null;
    const base = v.base === "claws" ? "claw" : v.base, R = rules();
    return R.sets[base] ? base : (R.byForm[form] || null);
  }
  // a move's name, by its number in a set; a name this file doesn't know draws as the sword's move of that number (the console says so once)
  const SWORD = ["cleave", "sweep", "rising-moon"], warned = {};
  function moveOf(set, n) { const R = rules(), i = Math.max(1, Math.min(3, n | 0)) - 1; return known(((R.sets[set] || SWORD)[i]), i + 1); }
  function known(move, n) {
    if (MOVES[move]) return move;
    if (!warned[move] && root.console) { warned[move] = true; root.console.warn("Forge Forever: no combo move " + move + " (drawn as the sword's)"); }
    return SWORD[Math.max(1, Math.min(3, n | 0)) - 1];
  }
  // a blow's times: the form's, and the finisher's longer wind-up and follow-through
  function times(form, finisher) {
    const C = root.FORGE_COMBAT, F = (C && C.forms && C.forms[form]) || FORMS[form] || FORMS.slash, X = rules().finisher;
    return { wind: F.wind + (finisher ? X.wind : 0), act: F.act, dur: F.dur + (finisher ? X.wind + X.follow : 0), finisher: !!finisher };
  }
  // the keyframe a blow shows at s seconds since it began (T: times()): set, cock, hit, follow, or null (the hold)
  function phaseAt(s, T) {
    if (s < T.wind) return T.wind >= 0.12 && s < T.wind / 2 ? "set" : "cock";
    if (s < T.wind + T.act / 2) return "hit";
    if (s < T.wind + T.act + 0.05 + (T.finisher ? rules().finisher.follow : 0)) return "follow";
    return null;
  }

  // ------------------------------------------------------------------ the frame of a move
  const MIRROR = { e: "w", w: "e", ne: "nw", nw: "ne", se: "sw", sw: "se", n: "n", s: "s" };
  // facing away: toward's frame mirrored, what points forward (down the screen) turned to point up it
  const AWAY = { e: "w", w: "e", ne: "nw", nw: "ne", n: "n", s: "n", se: "nw", sw: "ne" };
  const VIEW = { right: "side", left: "side", toward: "toward", away: "toward" };
  // frameAt(move, facing, s, T) -> { phase, pose, facing, dir, lead, dx, dy, behind, glint, mirror } or null (the knight's hold). dir is
  // the direction to draw the weapon in before the mirror (facing left: draw the right-facing weapon, mirrored); dx is forward on the
  // screen for the facing (negative to the left), dy down
  function frameAt(move, facing, s, T) {
    const M = MOVES[move] || MOVES.cleave, A = ARCH[M.arch], phase = phaseAt(s, T);
    if (!phase) return null;
    const view = VIEW[facing] || "side", K = A[view];
    let lead = A.lead[view === "side" ? 0 : 1], k = K[phase] || K.cock, f = facing, pose = k[0], dir = k[1], dx = k[2], dy = k[3];
    const flags = k[4] || "";
    if (A.turn && s < T.wind) {
      // the turn: the three facings after this one, clockwise, each for a third of the wind-up
      // (facing left, facing right's turn mirrored: the other way round)
      const i = Math.min(2, Math.floor(s / T.wind * 3)), MX = { right: "left", left: "right", toward: "toward", away: "away" };
      f = facing === "left" ? MX[TURN[(TURN.indexOf("right") + 1 + i) % 4]] : TURN[(TURN.indexOf(facing) + 1 + i) % 4]; [pose, dir] = TURN_POSE[f]; dx = 0; dy = 0;
    } else if (flags.includes("o")) dir = ORBIT[Math.floor(s * 20) % ORBIT.length];
    if (M.down && (phase === "hit" || phase === "follow")) dir = "s";   // the plunge drives the point straight down
    if (f === "left") dx = -dx;
    if (f === "away") { dir = AWAY[dir]; dx = -dx; dy = dy > 0 ? -dy : dy; lead = lead === "cw" ? "ccw" : "cw"; }   // forward is up the screen
    return { phase, move, name: M.name, pose, facing: f, dir, lead, dx, dy, mirror: f === "left", behind: f === "away" || (f === "right" || f === "left") && flags.includes("b"),
      glint: T.finisher && flags.includes("g") && s >= T.wind - 0.06 && s < T.wind };
  }

  // ------------------------------------------------------------------ the smear of a move
  // smearOf(move, facing, R, o) -> the curve to paint, in px from the knight's chest on the screen (x right, y down), or null.
  // o: { finisher, twin (the twin's repeat: the curve turned over, a rake from below), life }
  function smearOf(move, facing, R, o) {
    o = o || {};
    const M = MOVES[move] || MOVES.cleave, A = ARCH[M.arch], view = VIEW[facing] || "side", S = A.smear[view];
    const sx = facing === "left" || facing === "away" ? -1 : 1, away = facing === "away", fin = !!o.finisher, flip = !!o.twin;
    const base = { move, style: M.style, fin, life: o.life || (fin ? 0.36 : 0.26), band: bandOf(M.style) + (fin ? 2 : 0), small: !!M.small };
    const r = M.small ? R * 0.7 : R, dy = (M.dy || 0) + (S.dy || 0);
    if (S.ang !== undefined) {
      // streaks: straight lines from the chest along ang (below ahead), the finisher's longer and five of them
      let ang = S.ang * RAD; if (sx < 0) ang = Math.PI - ang; if (away) ang = -ang;
      const out = Object.assign(base, { kind: "streak", x: (S.dx || 0) * sx, y: dy, ang, len: r * (fin && M.arch !== "whirl" ? 1.2 : 1), lines: S.lines || (fin ? 5 : 3), behind: away });
      if (S.arc) out.arc = arcOf(S.arc, r, sx, away, flip, dy);
      if (S.whirl) out.whirl = { cx: S.whirl.c[0] * sx, cy: S.whirl.c[1], rx: S.whirl.r[0], ry: S.whirl.r[1] };
      return out;
    }
    return Object.assign(base, arcOf(S, r, sx, away, flip, dy), { kind: "arc" });
  }
  function arcOf(S, r, sx, away, flip, dy) {
    // the dial: a point at angle a is (cos a, -sin a) of the radii, tilted by rot (clockwise on the screen), mirrored for the left;
    // facing away the curve is toward's turned over (forward is up the screen); a twin's repeat is the curve turned over
    let a0 = S.a0, a1 = S.a1, rot = S.rot || 0, cy = S.c[1] + dy, ry = r * S.r[1];
    if (flip) { a0 = -a0; a1 = -a1; rot = -rot; }
    // facing away the curve is turned over; an upright one (a chop seen end on) is also pressed into the half above the chest, since
    // both its ends (over the head, and ahead on the floor) are up the screen from the knight
    if (away) { a0 = -a0; a1 = -a1; rot = -rot; cy = -cy - 4; if (S.r[1] > S.r[0]) { cy = -ry * 0.45 - 2; ry *= 0.55; } }
    return { cx: S.c[0] * sx, cy, rx: r * S.r[0], ry, rot: rot * RAD, a0: a0 * RAD, a1: a1 * RAD, sx, far: !!S.far, behind: away };
  }
  function bandOf(style) { return { crescent: 5, chop: 7, heavy: 8, reap: 6, lash: 1, rake: 3, streak: 3, bash: 4 }[style] || 5; }
  // the point of an arc at angle a (radians on the dial), and whether it is on the far side (drawn behind the knight)
  function arcPoint(sm, a, inset) {
    const k = sm.rx > 0 ? sm.ry / sm.rx : 1, rx = Math.max(0, sm.rx - inset), ry = Math.max(0, sm.ry - inset * k);
    const x0 = Math.cos(a) * rx, y0 = -Math.sin(a) * ry, c = Math.cos(sm.rot), s = Math.sin(sm.rot);
    return [sm.cx + (x0 * c - y0 * s) * sm.sx, sm.cy + x0 * s + y0 * c];
  }
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
  const dith = (x, y, a) => BAYER[((Math.round(y) & 3) * 4) + (Math.round(x) & 3)] < a;
  // paintSmear(put, sm, age, ramp, pass): every pixel of the smear at this age (s), put(x, y, colour) in px from the chest; pass
  // "back" paints the far part (before the knight), "front" the rest. ramp: the element's (or the metal's) four tones. Returns false
  // once the smear is spent. The smear is whole at once and dithers out, as the cellar's crescent does (a curve that grew would hide
  // behind the hit-stop); a finisher's has a white core while it is fresh
  function paintSmear(put, sm, age, ramp, pass) {
    if (!sm || age >= sm.life) return false;
    const fade = Math.max(0, (age - 0.05) / (sm.life - 0.05)), white = sm.fin && age < sm.life * 0.4;
    const P = (x, y, c) => { put(Math.round(x), Math.round(y), c); };
    if (sm.kind === "streak") {
      if ((pass === "back") === !!sm.behind) {
        const ca = Math.cos(sm.ang), sa = Math.sin(sm.ang), lines = sm.lines, half = (lines - 1) / 2;
        // a whip's crack: one line that wriggles out to the reach, its tip white
        if (sm.style === "lash") { for (let r = 4; r < sm.len; r++) { const off = Math.sin(r * 0.45) * 2 * (1 - r / sm.len) + Math.sin(r * 0.9); if (dith(r, off, 1 - fade)) P(sm.x + ca * r - sa * off, sm.y + sa * r + ca * off, r > sm.len - 5 ? "#ffffff" : ramp[2]); } }
        else for (let i = 0; i < lines; i++) { const off = (i - half) * 3;
          for (let r = 6 + Math.abs(off) * 1.5; r < sm.len - 2; r++) if (dith(r, off, 1 - fade) && (r + off) % 2) P(sm.x + ca * r - sa * off, sm.y + sa * r + ca * off, off === 0 ? (white ? "#ffffff" : ramp[3]) : ramp[2]); }
        if (sm.style === "bash" && fade < 0.6) for (let j = -4; j <= 4; j++) P(sm.x + ca * (sm.len - 3) - sa * j, sm.y + sa * (sm.len - 3) + ca * j, j % 2 ? ramp[2] : ramp[3]);
      }
      if (sm.arc) paintArc(P, Object.assign({}, sm.arc, { style: "crescent", band: 3, fin: sm.fin }), fade, white, ramp, pass);
      if (sm.whirl && (pass === "back") === !!sm.behind) { const W = sm.whirl, n = 40; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; if (dith(i, 0, (1 - fade) * 0.8)) P(W.cx + Math.cos(a) * W.rx, W.cy + Math.sin(a) * W.ry, i % 3 ? ramp[2] : ramp[3]); } }
      return true;
    }
    paintArc(P, sm, fade, white, ramp, pass);
    return true;
  }
  function paintArc(P, sm, fade, white, ramp, pass) {
    const span = sm.a1 - sm.a0, steps = Math.ceil(Math.abs(span) * Math.max(sm.rx, sm.ry) * 1.3) + 2;
    const back = p => sm.behind || (sm.far && p);   // a far point: on the upper half of a flat curve
    for (let i = 0; i <= steps; i++) {
      const a = sm.a0 + span * i / steps, lead = i / steps, far = Math.sin(a) > 0.05;
      if ((pass === "back") !== !!back(far)) continue;
      if (sm.style === "lash") {
        // the lash uncoils: from half the reach out to all of it, wriggling, its tip lit
        const wig = Math.sin(lead * 9) * 2, [x, y] = arcPoint(sm, a, sm.rx * 0.5 * (1 - lead)), nx = Math.cos(a) * sm.sx, ny = -Math.sin(a);
        if (dith(x, y, 1 - fade)) P(x + nx * wig, y + ny * wig, lead > 0.85 ? (white ? "#ffffff" : ramp[3]) : ramp[2]);
        continue;
      }
      if (sm.style === "rake") { for (const d of [0, 3, 6]) { const [x, y] = arcPoint(sm, a, d + 1); if (dith(x, y, 1 - fade)) P(x, y, d === 0 ? (white ? "#ffffff" : ramp[3]) : ramp[2]); } continue; }
      const band = sm.band;
      const thin = sm.style === "crescent" ? Math.sin(Math.PI * lead) : sm.style === "reap" ? Math.min(1, lead * 1.6) : sm.style === "heavy" ? 0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, lead * 1.1)) : Math.sin(Math.PI * Math.min(1, lead * 1.2));
      for (let d = 0; d < band; d++) {
        if (d > Math.max(1, band * thin)) continue;
        const [x, y] = arcPoint(sm, a, d), c = d === 0 ? (white ? "#ffffff" : ramp[3]) : d < 3 ? ramp[2] : sm.style === "heavy" && d >= band - 2 ? ramp[0] : ramp[1];
        if ((d === 0 && fade < 0.45) || dith(x, y, (1 - fade) * (0.55 + 0.45 * lead))) P(x, y, c);
      }
    }
    // the reap's hook at the end
    if (sm.style === "reap" && fade < 0.6 && (pass === "back") === !!sm.behind) { const [x, y] = arcPoint(sm, sm.a1, 4); for (let d = 0; d < 5; d++) P(x - Math.sin(sm.a1) * d * sm.sx, y - Math.cos(sm.a1) * d, ramp[2]); }
  }

  // the end of a smear (px from the chest): the tip of a lash or a streak, where a whip's crack goes off
  function tipOf(sm) {
    if (!sm) return [0, 0];
    if (sm.kind === "streak") return [sm.x + Math.cos(sm.ang) * sm.len, sm.y + Math.sin(sm.ang) * sm.len];
    return arcPoint(sm, sm.a1, 0);
  }

  // ------------------------------------------------------------------ what a hit throws off
  // impactOf(move, finisher) -> [{ kind, ... }]: the screen's effects at the hit point (at: "hit") or the knight's feet (at: "feet").
  // Every finisher: a white flash ring and a big star, and ten sparks in the weapon's tones; then the move's own
  function impactOf(move, finisher) {
    const M = MOVES[move] || MOVES.cleave, out = [];
    if (finisher) out.push({ kind: "flash", at: "hit", r: 13, life: 0.18 }, { kind: "star", at: "hit", big: true, life: 0.2 }, { kind: "sparks", at: "hit", n: 10, life: 0.3 });
    for (const f of (finisher ? M.fx || [] : []).concat(!finisher && (M.fx || []).includes("crack-star") ? ["crack-star"] : [])) {
      if (f === "dust") out.push({ kind: "dust", at: "feet", dx: -7, life: 0.4 }, { kind: "dust", at: "feet", dx: 7, life: 0.4 });
      else if (f === "crack") out.push({ kind: "crack", at: "ground", life: 1.2, seed: out.length });
      else if (f === "chunks") out.push({ kind: "chunks", at: "ground", n: 8, life: 0.55 });
      else if (f === "quake") out.push({ kind: "ring", at: "ground", r: 26, life: 0.4 });
      else if (f === "bleed") out.push({ kind: "bleed", at: "hit", n: 9, life: 0.45 });
      else if (f === "crack-star") out.push({ kind: "star", at: "tip", big: finisher, life: 0.16, c: "#ffffff" });
      else if (f === "ring") out.push({ kind: "ring", at: "hit", r: 10, life: 0.3 });
      else if (f === "speed") out.push({ kind: "speed", at: "knight", life: 0.25 });
      else if (f === "wisp") out.push({ kind: "wisp", at: "hit", n: 6, life: 0.6 });
      else if (f === "moon") out.push({ kind: "moon", at: "hit", life: 0.45 });
    }
    return out;
  }

  const api = { rules, MOVES, ARCH, FORMS, MELEE, ORBIT, TURN, setFor, moveOf, known, times, phaseAt, frameAt, smearOf, paintSmear, arcPoint, tipOf, impactOf, MIRROR, DIRS: ["e", "ne", "n", "nw", "w", "sw", "s", "se"] };
  root.Combos = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
