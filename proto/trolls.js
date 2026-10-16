// FORGE FOREVER: the trolls (design pass 12 sections 3.5 and 3.12, revision 3; built by build 7 stage H).
// The Troll Gate's enemies, drawn in code on the knight's frame interface (proto/knight.js) with a painter of their own on 32 and 48
// px grids: masks lit from the top left, four-tone ramps, a soot outline, feet on the bottom row. Eight kinds on three bodies: the
// footman (a stooped green troll with an oak club studded with iron), the fire-staff troll (a soot hood and a charred staff with a coal
// caged at its head), the Emberback (broader, its hide cracked over glowing veins, a charred club), the winchman (a leather apron and a
// winch handle at his belt); the archer (lanky, a leather hood, an oak self bow and a quiver of pale fletching) and the ice archer (a
// frost-white hood, the bow wrapped in pale cord, blue-white fletching, cyan arrowheads); the brute (48 px, darker, hunched, an iron
// collar with a broken chain and a maul of a stone slab lashed to a log) and the rock brute (both arms up round a boulder in the field's
// rock ramp). Three drawings (side, toward, away; left is the side mirrored), the frames idle 2, walk 4, wind, strike, recover, hit,
// stone, climb 2 and fall 1 (climb and fall for the small trolls), and the few each kit needs besides: jab 2 (the archers' stab with
// the bow's end, the fire-staff's butt), heave 2 (the winchman at the winch), charge, roar and sit (the brutes' charge, roar and
// stagger). Every frame bakes a white canvas (the hit flash) and its stone canvases (the stone death: four steps of ramp swap to the
// Things stone ramp); the fire-staff's coal and the Emberback's veins glow on two phases, still under reduced motion. A frame names
// its weapon's tip, where the page draws the red glint of a wind-up: no sprite holds #ff0044, the colour kept for telegraphs.
// Design pass 21 (the Great Hall, sections 3.6, 3.7 and 3.9; built by build 15 stage E) adds two kinds on bodies of their own, ported
// from its sketch (docs/design/21-great-hall.sketch.js): the troll knight (a kettle helm, plate too small for its hump, a long sword and
// the castle's kite shield; block, bash 2 and reel besides, and frame()'s sixth argument cracks the shield as its guard meter fills) and
// the rabid troll wolf (grey mange patched green, 14 px at the withers; run 4 and leap besides, and no climb or fall).
// Besides the trolls, the small things of the fight, each a sprite with its anchor: the troll arrow and the ice arrow (7 x 3, in 16
// directions, with a 1 px ground shadow), the fire bolt's tumbling coal and its sparks, the trebuchet's stone, the chunks a rock slam
// throws (dirt, clods, the drawbridge's splinters) and the soot shadows where they will land, the pouch, the splash and the rock brute's
// rock as it lies. Building a frame costs under a millisecond in node; frames are made on first use and kept.
// The pixels are made without a DOM, so node can check them; canvases are made only when a page asks.
// Design pass 27 (the Keep, sections 3.7 to 3.9; built by card t91) adds three kinds on bodies of their own, ported from its sketch
// (docs/design/27-the-keep.sketch.js): Gorvash the troll wizard (48 px: a plum robe, a crown of antler and bone, the hexstone on his staff,
// his left hand green to the elbow; cast, point, jab, nova, ward 2, kneel and blink 3 besides), the hex bat (32 px, drawn low in its cell
// and lifted by its height; fly 4, wind, strike as it swoops, stone folded) and the troll burster (32 px, a belly in two iron hoops glowing
// through its cracks; run 4 and fuse 4, swelling to white). And the wizard's hexbolt among the projectiles.
// Plain script, defines window.Trolls. Needs no other file.
(function (root) {
  "use strict";
  const OUT = "#181425";
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const R = {
    green: ["#265c42", "#3e8948", "#63c74d", "#b4e67a"], nature: ["#193c3e", "#265c42", "#3e8948", "#63c74d"],
    bone: ["#c28569", "#e8b796", "#ead4aa", "#fffaf0"], oak: ["#3e2731", "#733e39", "#b86f50", "#e4a672"], burlap: ["#733e39", "#b86f50", "#e4a672", "#ead4aa"],
    leather: ["#2a1d28", "#3e2731", "#733e39", "#b86f50"], iron: ["#262b44", "#3a4466", "#5a6988", "#8b9bb4"], stone: ["#4a4450", "#6e6a70", "#9a948c", "#c4bcae"],
    soot: ["#181425", "#262b44", "#3e2731", "#5a6988"], frost: ["#5a6988", "#8b9bb4", "#c0cbdc", "#ffffff"], charred: ["#181425", "#2a1d28", "#3e2731", "#733e39"],
    fire: ["#be4a2f", "#f77622", "#feae34", "#fee761"],
    // design pass 21's three: the troll knights' plate (the Things' steel), the castle's blue of its arms (its shade #0b2f55 is the
    // pass's own) and the rabid wolves' mange, a cool grey darker than the trolls (the pass's own ramp)
    steel: ["#3a4466", "#5a6988", "#8b9bb4", "#c0cbdc"], blue: ["#0b2f55", "#124e89", "#0099db", "#2ce8f5"], mange: ["#24222c", "#443f4d", "#686475", "#968fa2"]
  };
  const EYE = "#fee761", TUSK = ["#e8b796", "#ead4aa"], MOSS = "#265c42";
  // the green hand the trolls smear over the castle's wolf, the gilt of the shield's rim (lit, shaded), a rabid wolf's gums and froth
  const HAND = ["#265c42", "#3e8948"], GILT = ["#feae34", "#be4a2f"], GUM = "#a22633", FROTH = "#ffffff";
  // the stone ramp the dead swap to (the Things', pixel-forge.js RAMP.stone) and the field's rock ramp, the same tones
  const STONE = R.stone;
  const FACINGS = ["right", "left", "away", "toward"];
  const DRAWING = { right: ["side", false], left: ["side", true], away: ["up", false], toward: ["down", false] };
  const SMALL = { idle: 2, walk: 4, wind: 1, strike: 1, recover: 1, hit: 1, stone: 1, climb: 2, fall: 1, reel: 1 };   // (reel: design pass 38, the poise stagger of a small troll)
  const LARGE = { idle: 2, walk: 4, wind: 1, strike: 1, recover: 1, hit: 1, stone: 1 };
  // each kind: its body, its cell, its skin, its dress and weapon, and the frames its kit adds
  const KIND = {
    footman: { body: "footman", N: 32, skin: R.green, weapon: "club" },
    firestaff: { body: "footman", N: 32, skin: R.green, weapon: "staff", hood: R.soot, extra: { jab: 2 } },
    emberback: { body: "footman", N: 32, skin: R.green, weapon: "ember", broad: 1, veins: true },
    winchman: { body: "footman", N: 32, skin: R.green, weapon: "club", apron: true, extra: { heave: 2 } },
    archer: { body: "archer", N: 32, skin: R.green, weapon: "bow", hood: R.leather, fletch: R.bone, extra: { jab: 2 } },
    icearcher: { body: "archer", N: 32, skin: R.green, weapon: "bow", hood: R.frost, fletch: R.frost, ice: true, extra: { jab: 2 } },
    brute: { body: "brute", N: 48, skin: R.nature, weapon: "maul", extra: { charge: 1, roar: 1, sit: 1 } },
    rockbrute: { body: "brute", N: 48, skin: R.nature, weapon: "rock", extra: { roar: 1, sit: 1 } },
    // design pass 21 (the Great Hall): the troll knight (its shield's block, bash and reel) and the rabid troll wolf (its gallop and its
    // leap), who never climbs
    trollknight: { body: "knight", N: 32, skin: R.green, weapon: "sword", extra: { block: 1, bash: 2, reel: 1 } },
    wolf: { body: "wolf", N: 32, skin: R.mange, weapon: "jaws", climbs: false, extra: { run: 4, leap: 1, reel: 1 } },
    // design pass 27: the Keep's three, on bodies of their own (the sketch's frames: the wizard's cast, point, jab, nova, ward 2, kneel and
    // blink 3; the bat's fly 4 (its idle too); the burster's run 4 and fuse 4)
    wizard: { body: "wizard", N: 48, skin: R.nature, weapon: "hexstaff", extra: { cast: 1, point: 1, jab: 1, nova: 1, ward: 2, kneel: 1, blink: 3 } },
    bat: { body: "bat", N: 32, skin: R.fur, weapon: "fangs", climbs: false, extra: { idle: 4, fly: 4, reel: 1 } },
    burster: { body: "burster", N: 32, skin: R.nature, weapon: "belly", extra: { run: 4, fuse: 4 } },
    // design pass 44: the Troll King, 96 px, on the sketch's own animations alone (own: no LARGE set under them), never climbing
    king: { body: "king", N: 96, skin: null, weapon: "sceptre", climbs: false, own: true, extra: { idle: 2, walk: 4, seat: 2, rise: 1, roar: 1, sweepWind: 1, sweep: 1, gavelWind: 1, gavel: 1, chargeWind: 1, charge: 2, stomp: 2, crouch: 1, air: 1, land: 1, aim: 1, fire: 1, aimHigh: 1, fireHigh: 1, spin: 1, nova: 3, kneel: 1, reel: 1, hit: 1 } }
  };
  const KINDS = Object.keys(KIND);
  const ANIMS = {}; for (const k of KINDS) ANIMS[k] = KIND[k].own ? Object.assign({}, KIND[k].extra) : Object.assign({}, KIND[k].N === 48 || KIND[k].climbs === false ? LARGE : SMALL, KIND[k].extra || {});

  // ------------------------------------------------------------------ a small painter over an N x N grid (the renderer's way)
  function Grid(N) { this.N = N; this.px = new Array(N * N).fill(null); }
  Grid.prototype.get = function (x, y) { const N = this.N; return x >= 0 && y >= 0 && x < N && y < N ? this.px[y * N + x] : null; };
  Grid.prototype.set = function (x, y, c) { const N = this.N; x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < N && y < N) this.px[y * N + x] = c; };
  const rect = (x0, y0, x1, y1) => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  const ell = (cx, cy, rx, ry) => (x, y) => ((x - cx) ** 2) / (rx * rx) + ((y - cy) ** 2) / (ry * ry) <= 1.02;
  const or = (...f) => (x, y) => f.some(g => g(x, y));
  // a thick line from (x0, y0) to (x1, y1), w pixels across, as a mask
  function line(x0, y0, x1, y1, w) {
    const s = new Set(), n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 + 1, a = -((w - 1) >> 1), b = w >> 1;
    for (let i = 0; i <= n; i++) { const t = i / n, x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t); for (let dx = a; dx <= b; dx++) for (let dy = a; dy <= b; dy++) s.add((x + dx) + "," + (y + dy)); }
    return (x, y) => s.has(x + "," + y);
  }
  // a region lit from the top left: o.ball [cx, cy, r] shades it as a round mass (light toward the top left, dark toward the bottom
  // right), else as the house does, its upper-left edge light and its lower-right edge dark; o.spec puts the ramp's glint, o.flat one tone
  function region(sp, pred, ramp, o) {
    o = o || {}; const N = sp.N, m = (x, y) => x >= 0 && y >= 0 && x < N && y < N && pred(x, y);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (m(x, y)) {
      const ul = !m(x - 1, y) || !m(x, y - 1), dr = !m(x + 1, y) || !m(x, y + 1);
      let t;
      if (o.ball) { const v = ((x - o.ball[0]) + (y - o.ball[1])) / (2 * o.ball[2]); t = v < -0.2 ? 2 : v < 0.55 ? 1 : 0; if (dr && t === 1 && v > 0.25) t = 0; }
      else t = ul && dr ? 1 : dr ? 0 : ul ? 2 : 1;
      let c = ramp[t];
      if (o.spec && o.spec(x, y)) c = ramp[3];
      if (o.flat !== undefined) c = ramp[o.flat];
      if (o.tex) c = o.tex(x, y, c) || c;
      sp.set(x, y, c);
    }
    // o.cast: the region casts a 1 px shadow down and to the right onto what is already painted behind it, in that tone, so a limb or
    // a head reads apart from a body of the same skin
    if (o.cast) for (let y = N - 1; y >= 0; y--) for (let x = N - 1; x >= 0; x--) if (!m(x, y) && sp.get(x, y) && sp.get(x, y) !== OUT && (m(x - 1, y) || m(x, y - 1) || m(x - 1, y - 1))) sp.set(x, y, o.cast);
  }
  function outline(sp) { const N = sp.N, add = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!sp.get(x, y) && (sp.get(x - 1, y) || sp.get(x + 1, y) || sp.get(x, y - 1) || sp.get(x, y + 1))) add.push([x, y]); for (const [x, y] of add) sp.set(x, y, OUT); }
  const dark = ramp => [ramp[0], ramp[0], ramp[1], ramp[2]];   // a limb on the far side, a step darker
  // a limb from the shoulder (sx, sy) to the fist (fx, fy), 3 px thick, with a fist of radius fr
  function limb(sp, sx, sy, fx, fy, ramp, fr, w) { region(sp, line(sx, sy, fx, fy, w || 3), ramp, { cast: ramp[0] }); region(sp, ell(fx, fy, fr || 2.3, (fr || 2.3) * 0.9), ramp, { ball: [fx - 1, fy - 1, 2.5], cast: ramp[0] }); }

  // ------------------------------------------------------------------ the weapons
  // each weapon is drawn from the fist toward its tip, and returns the tip's pixel (where a wind-up's glint is drawn). Every weapon stays
  // a pixel inside its cell, so the outline closes it on every side: a club's head (2 px round its centre) is kept 3 px in, which also
  // plants a club resting on the ground when the body breathes down a pixel
  const inside = (v, r, N) => Math.max(r + 1, Math.min(N - 2 - r, v));
  function club(sp, fx, fy, tx, ty, K) {
    tx = inside(tx, 2, sp.N); ty = inside(ty, 2, sp.N);
    const OAK = K.weapon === "ember" ? R.charred : R.oak;
    region(sp, line(fx, fy, tx, ty, 2), OAK);
    region(sp, ell(tx, ty, 2.4, 2.4), OAK, { ball: [tx, ty, Math.max(2.4, 2.4)], spec: (x, y) => x === Math.round(tx) - 1 && y === Math.round(ty) - 1 });
    if (K.weapon === "ember") { sp.set(tx, ty, R.fire[K.glow ? 2 : 1]); sp.set(tx + 1, ty, R.fire[K.glow ? 1 : 0]); }
    else for (const [dx, dy] of [[-1, 1], [1, -1], [1, 1]]) sp.set(tx + dx, ty + dy, R.iron[3]);
    const d = Math.hypot(tx - fx, ty - fy) || 1;
    return [Math.round(tx + (tx - fx) / d * 2), Math.round(ty + (ty - fy) / d * 2)];
  }
  // the fire-staff: a charred staff, 1 px, from its butt through the fist to an iron cage holding a coal (two phases; brighter in a wind);
  // the cage (4 x 4 from a pixel up and left of its centre) and the butt stay inside the cell, the butt planted on the ground row
  function staff(sp, bx, by, tx, ty, K, hot) {
    const N = sp.N; bx = inside(bx, 0, N); by = inside(by, 0, N); tx = Math.max(2, Math.min(N - 4, tx)); ty = Math.max(2, Math.min(N - 4, ty));
    region(sp, line(bx, by, tx, ty, 1), R.charred, { flat: 2 });
    const cx = Math.round(tx), cy = Math.round(ty);
    region(sp, rect(cx - 1, cy - 1, cx + 2, cy + 2), R.iron, { flat: 1 });
    const f = K.glow ? 1 : 0, core = hot ? [R.fire[3], R.fire[2]] : [R.fire[2], R.fire[1]];
    sp.set(cx, cy, core[f]); sp.set(cx + 1, cy, core[1 - f]); sp.set(cx, cy + 1, core[1 - f]); sp.set(cx + 1, cy + 1, R.fire[f ? 1 : 0]);
    return [cx, cy - 2];
  }

  // ------------------------------------------------------------------ the footman's body (footman, fire-staff, Emberback, winchman)
  // P: { step, bob, lean, head [dx, dy], arm (the weapon arm's state), climb (0, 1), fall, flinch }
  function footman(drawing, P, K) {
    const N = 32, sp = new Grid(N), S = K.skin, B = P.bob || 0, step = P.step || 0, W = K.broad || 0;
    let tip = null;
    if (drawing === "side") {
      const X = P.lean || 0, back = step > 0 ? -2 : step < 0 ? 2 : 0, fwd = -back, hx = X + (P.head ? P.head[0] : 0), hy = B + (P.head ? P.head[1] : 0);
      const arm = P.arm || "rest";
      // the far arm, behind
      if (arm === "heave") region(sp, line(11 + X, 15 + B, 19 + X + (P.pull ? -2 : 1), 19 + B, 3), dark(S));
      else if (P.fall) limb(sp, 11 + X, 16 + B, 8 + X, 7 + B, dark(S));
      else limb(sp, 11 + X, 15 + B, 10 + X, 22 + B, dark(S));
      // the legs: short, thick and bowed, bare feet with the toes forward
      region(sp, rect(11 + back, 24, 13 + back, 28), dark(S)); region(sp, rect(10 + back, 29, 14 + back, 30), dark(S));
      region(sp, rect(15 + fwd, 24, 17 + fwd, 28), S); region(sp, rect(15 + fwd, 29, 19 + fwd, 30), S, { ball: [16 + fwd, 29, 3] });
      // the hunched body, the hump of the shoulders behind the head
      region(sp, ell(13.5 + X, 19 + B, 6.5 + W, 6), S, { ball: [13.5 + X, 19 + B, Math.max(6.5 + W, 6)] });
      region(sp, ell(12 + X, 14.5 + B, 5.5 + W, 4.5), S, { ball: [12 + X, 14.5 + B, Math.max(5.5 + W, 4.5)], spec: (x, y) => x === 9 + X && y === 12 + B, cast: S[0] });
      dress(sp, drawing, X, B, K);
      // the head, jutting forward below the hump: a heavy brow, a yellow eye, a big nose, an underbite and a tusk, a pointed ear behind
      region(sp, ell(20.5 + hx, 15 + hy, 4, 3.5), S, { ball: [20.5 + hx, 15 + hy, Math.max(4, 3.5)], cast: S[0] });
      region(sp, rect(24 + hx, 14 + hy, 25 + hx, 16 + hy), S, { spec: (x, y) => x === 24 + hx && y === 14 + hy });
      region(sp, or(rect(16 + hx, 12 + hy, 17 + hx, 13 + hy), rect(15 + hx, 11 + hy, 15 + hx, 11 + hy)), S, { flat: 1 });
      for (let x = 19; x <= 23; x++) sp.set(x + hx, 13 + hy, S[0]);
      sp.set(22 + hx, 14 + hy, P.flinch ? S[0] : EYE);
      for (let x = 20; x <= 23; x++) sp.set(x + hx, 17 + hy, S[0]);
      sp.set(23 + hx, 16 + hy, TUSK[1]); sp.set(23 + hx, 17 + hy, TUSK[0]);
      if (K.hood) hood(sp, drawing, hx, hy, K);
      if (K.veins) veins(sp, drawing, X, B, K);
      // the near arm and the weapon
      tip = nearArm(sp, drawing, arm, X, B, K, P);
    } else {
      const up = drawing === "up", lA = step > 0 ? -1 : 0, lB = step < 0 ? -1 : 0, hy = B + (P.head ? P.head[1] : 0);
      const arm = P.arm || "rest", climb = P.climb, fall = P.fall;
      // a weapon behind the body (raised over the head facing the camera, slung on the back while climbing)
      if (!up && arm === "raise") tip = weapon(sp, drawing, "raise", B, K);
      // the legs
      if (climb !== undefined) {
        const c = climb ? 1 : 0;
        region(sp, rect(11, 23 - 2 * c, 13, 27 - 2 * c), S); region(sp, rect(10, 28 - 2 * c, 14, 29 - 2 * c), S);
        region(sp, rect(18, 21 + 2 * c, 20, 28), S); region(sp, rect(17, 29, 21, 30), S);
      } else if (fall) {
        region(sp, rect(9, 24, 11, 28), S); region(sp, rect(8, 29, 12, 30), S); region(sp, rect(20, 24, 22, 28), S); region(sp, rect(19, 29, 23, 30), S);
      } else {
        region(sp, rect(11 - W, 25 + lA, 13 - W, 28 + lA), S); region(sp, rect(10 - W, 29 + lA, 14 - W, 30 + lA), S, { ball: [11, 29, 3] });
        region(sp, rect(18 + W, 25 + lB, 20 + W, 28 + lB), S); region(sp, rect(17 + W, 29 + lB, 21 + W, 30 + lB), S, { ball: [18, 29, 3] });
      }
      // the belly and the broad shoulders
      region(sp, ell(15.5, 19 + B, 7 + W, 5.5), S, { ball: [15.5, 19 + B, Math.max(7 + W, 5.5)] });
      dress(sp, drawing, 0, B, K);
      region(sp, ell(15.5, 15 + B, 9.5 + W, 3.6), S, { ball: [15.5, 15 + B, Math.max(9.5 + W, 3.6)], spec: (x, y) => x === 8 - W && y === 13 + B, cast: S[0] });
      // the arms
      if (climb !== undefined) {
        const c = climb ? 1 : 0;
        limb(sp, 8, 14, 7, 4 + 3 * c, S); limb(sp, 23, 14, 24, 7 - 3 * c, S);
      } else if (fall) {
        limb(sp, 7, 14, 4, 6, S); limb(sp, 24, 14, 27, 6, S);
      } else {
        const free = up ? [24 + W, 15, 24 + W, 22] : [7 - W, 15, 7 - W, 22];
        if (arm === "heave") { limb(sp, 7, 15, 12, 21 + (P.pull ? 0 : 1), S); limb(sp, 24, 15, 19, 21 + (P.pull ? 0 : 1), S); }
        else if (P.flinch) limb(sp, free[0], 15 + B, free[0] - 2, 19 + B, S);
        else limb(sp, free[0], free[1] + B, free[2], free[3] + B, S);
      }
      // the head, low between the shoulders
      region(sp, ell(15.5, 11.5 + hy, 4.5, 4), S, { ball: [15.5, 11.5 + hy, Math.max(4.5, 4)], cast: S[0] });
      region(sp, or(rect(9, 10 + hy, 10, 11 + hy), rect(21, 10 + hy, 22, 11 + hy), rect(8, 9 + hy, 8, 9 + hy), rect(23, 9 + hy, 23, 9 + hy)), S, { flat: 1 });
      if (!up) {
        for (let x = 12; x <= 19; x++) sp.set(x, 10 + hy, S[0]);
        sp.set(13, 11 + hy, P.flinch ? S[0] : EYE); sp.set(18, 11 + hy, P.flinch ? S[0] : EYE);
        region(sp, rect(15, 12 + hy, 16, 13 + hy), S, { spec: (x, y) => x === 15 && y === 12 + hy });
        for (let x = 13; x <= 18; x++) sp.set(x, 14 + hy, S[0]);
        sp.set(13, 13 + hy, TUSK[1]); sp.set(18, 13 + hy, TUSK[1]); sp.set(13, 14 + hy, TUSK[0]); sp.set(18, 14 + hy, TUSK[0]);
      } else for (let x = 13; x <= 18; x++) sp.set(x, 14 + hy, S[0]);
      if (K.hood) hood(sp, drawing, 0, hy, K);
      if (K.veins) veins(sp, drawing, 0, B, K);
      if (climb === undefined && !fall && arm !== "heave" && !(arm === "raise" && !up)) tip = weapon(sp, drawing, arm, B, K, P.flinch);
      else if (climb !== undefined || fall) tip = weapon(sp, drawing, climb !== undefined ? "back" : "flail", B, K);
    }
    outline(sp);
    sp.tip = tip;
    return sp;
  }
  // the loincloth (burlap, a rope belt, a ragged hem), the winchman's leather apron and winch handle
  function dress(sp, drawing, X, B, K) {
    const side = drawing === "side", x0 = side ? 8 + X : 10 - (K.broad || 0), x1 = side ? 19 + X : 21 + (K.broad || 0), y0 = 22 + B;
    region(sp, (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y0 + 4 && !(y === y0 + 4 && (x + B) % 3 === 0), R.burlap);
    for (let x = x0; x <= x1; x++) sp.set(x, y0, R.oak[2]);
    if (K.apron) {
      const ax0 = side ? 14 + X : 12, ax1 = side ? 20 + X : 19;
      region(sp, rect(ax0, y0 - 3, ax1, y0 + 5), R.oak, { spec: (x, y) => x === ax0 + 1 && y === y0 - 2 });
      for (let x = ax0; x <= ax1; x++) sp.set(x, y0 - 3, R.oak[0]);   // its top hem
      // the winch handle at the belt: an iron crank
      const hx = side ? 9 + X : 20, hy = y0 + 1;
      region(sp, or(rect(hx, hy, hx + 1, hy + 3), rect(hx, hy + 3, hx + 3, hy + 3)), R.iron, { flat: 2 });
    }
  }
  // the fire-staff's soot hood, over the head
  function hood(sp, drawing, hx, hy, K) {
    if (drawing === "side") region(sp, or(ell(18.5 + hx, 11.5 + hy, 4.5, 3.2), rect(14 + hx, 11 + hy, 16 + hx, 15 + hy)), K.hood, { ball: [18 + hx, 12 + hy, 4.5] });
    else region(sp, or(ell(15.5, 10 + hy, 5.2, 3.5), rect(10, 10 + hy, 11, 14 + hy), rect(20, 10 + hy, 21, 14 + hy)), K.hood, { ball: [15.5, 10.5 + hy, 5] });
    if (drawing === "side") { sp.set(21 + hx, 12 + hy, EYE); sp.set(18 + hx, 11 + hy, K.hood[0]); }
    else if (drawing === "down") { sp.set(13, 11 + hy, EYE); sp.set(18, 11 + hy, EYE); }
  }
  // the Emberback's veins: 1 px cracks of fire over the hide, pulsing on two phases
  function veins(sp, drawing, X, B, K) {
    const a = R.fire[K.glow ? 2 : 1], b = R.fire[K.glow ? 1 : 2];
    // each crack a short zigzag line of fire, its pixels changing colour on the two phases
    const cracks = drawing === "side" ? [[[8, 13], [9, 14], [9, 15], [10, 16]], [[13, 12], [14, 13], [15, 13]], [[10, 19], [11, 20], [11, 21], [12, 22]], [[15, 18], [16, 19], [17, 19]]]
      : drawing === "down" ? [[[8, 14], [9, 15], [9, 16], [10, 17]], [[21, 13], [22, 14], [22, 15], [23, 16]], [[13, 18], [14, 19], [15, 19], [16, 20]], [[18, 17], [19, 18], [19, 19]], [[12, 12], [13, 13]]]
        : [[[9, 13], [10, 14], [10, 15], [11, 16]], [[20, 13], [21, 14], [21, 15]], [[14, 16], [15, 17], [16, 17], [17, 18]], [[12, 19], [13, 20]]];
    for (const crack of cracks) crack.forEach(([x, y], k) => sp.set(x + X, y + B, k % 2 ? b : a));
  }
  // the near arm in the side drawing, and its weapon
  function nearArm(sp, drawing, arm, X, B, K, P) {
    const S = K.skin;
    if (arm === "heave") { limb(sp, 16 + X, 15 + B, 21 + X + (P.pull ? -2 : 1), 20 + B, S); return [21 + X + (P.pull ? -2 : 1), 20 + B]; }   // (the fist is the tip: the hook's glint sits on it, design pass 38)
    const at = {
      rest: [[16, 17], [18, 23]], raise: [[15, 16], [13, 10]], swing: [[16, 17], [22, 19]], ground: [[16, 17], [21, 23]],
      flinch: [[15, 16], [15, 21]], jab0: [[16, 17], [14, 21]], jab1: [[16, 17], [22, 19]], flail: [[16, 17], [19, 8]]
    }[arm] || [[16, 17], [18, 23]];
    const [[sx, sy], [fx, fy]] = at;
    // the weapon behind the fist when it is raised behind the head
    let tip = null;
    if (arm === "raise") tip = weaponSide(sp, arm, fx + X, fy + B, K);
    limb(sp, sx + X, sy + B, fx + X, fy + B, S);
    if (arm !== "raise") tip = weaponSide(sp, arm, fx + X, fy + B, K);
    return tip;
  }
  // a footman's weapon in the side drawing, from the fist
  function weaponSide(sp, arm, fx, fy, K) {
    if (K.weapon === "staff") {
      const v = { rest: [[fx - 1, fy + 7], [fx + 2, fy - 18]], raise: [[fx + 3, fy + 12], [fx - 3, fy - 8]], swing: [[fx - 9, fy + 2], [fx + 5, fy - 4]],
        ground: [[fx - 6, fy - 5], [fx + 5, fy + 4]], flinch: [[fx - 2, fy + 8], [fx + 3, fy - 16]], jab0: [[fx - 6, fy - 3], [fx + 8, fy + 1]], jab1: [[fx + 6, fy + 1], [fx - 8, fy - 2]],
        flail: [[fx - 3, fy + 10], [fx + 3, fy - 6]] }[arm] || [[fx - 1, fy + 7], [fx + 2, fy - 18]];
      const [[bx, by], [tx, ty]] = v;
      return staff(sp, bx, by, tx, ty, K, arm === "raise");
    }
    const t = { rest: [fx + 4, fy + 5], raise: [fx - 6, fy - 6], swing: [fx + 5, fy + 2], ground: [fx + 6, fy + 5], flinch: [fx + 4, fy - 9], flail: [fx + 4, fy - 5] }[arm] || [fx + 4, fy + 5];
    return club(sp, fx, fy, t[0], t[1], K);
  }
  // a footman's weapon facing the camera or away
  function weapon(sp, drawing, arm, B, K, flinch) {
    const up = drawing === "up", m = x => up ? 31 - x : x, S = K.skin;
    if (arm === "back") {   // climbing: slung across the back
      if (K.weapon === "staff") return staff(sp, m(9), 26, m(22), 5, K);
      return club(sp, m(10), 21, m(20), 9, K);
    }
    if (arm === "flail") {
      if (K.weapon === "staff") return staff(sp, m(29), 16, m(27), 2, K);
      return club(sp, m(27), 6, m(29), 2, K);
    }
    const W = K.broad || 0;
    if (arm === "raise") {   // facing the camera, drawn before the body: the club back over the head
      limb(sp, m(24 + W), 15 + B, m(22), 8 + B, S);
      if (K.weapon === "staff") return staff(sp, m(25), 22 + B, m(19), 2 + B, K, true);
      return club(sp, m(22), 8 + B, m(16), 3 + B, K);
    }
    const hand = { rest: [24 + W, 23], swing: [21, 20], ground: [22, 23], jab0: [22, 21], jab1: [20, 21] }[flinch ? "rest" : arm] || [24 + W, 23];
    const fx = m(hand[0]), fy = hand[1] + B;
    limb(sp, m(24 + W), 15 + B, fx, fy, S);
    if (K.weapon === "staff") {
      const v = { rest: [[fx + (up ? -1 : 1), fy + 7], [fx + (up ? -2 : 2), fy - 19]], swing: [[fx - (up ? -3 : 3), fy + 4], [fx + (up ? -4 : 4), fy - 14]], ground: [[fx, fy - 10], [fx + (up ? -4 : 4), fy + 4]],
        jab0: [[fx + (up ? -3 : 3), fy - 4], [fx - (up ? -4 : 4), fy + 6]], jab1: [[fx - (up ? -5 : 5), fy - 6], [fx + (up ? -2 : 2), fy + 7]] }[flinch ? "rest" : arm] || [[fx, fy + 7], [fx + 2, fy - 19]];
      return staff(sp, v[0][0], v[0][1], v[1][0], v[1][1], K, false);
    }
    const t = { rest: [fx + (up ? -3 : 3), fy + 5], swing: [fx + (up ? -3 : 3), fy + 7], ground: [fx + (up ? -3 : 3), fy + 6] }[flinch ? "rest" : arm] || [fx + (up ? -3 : 3), fy + 5];
    return club(sp, fx, fy, t[0], t[1], K);
  }

  // ------------------------------------------------------------------ the archer's body (archer, ice archer)
  // lanky and drawn 27 px tall (3.5; its h 25 walks under the archer tower's deck): thin legs, a leather kilt, a hood with a short mantle
  // over the shoulders, its head hunched down into the mantle (2 px from the side, 3 px facing the camera or away), long thin arms, a
  // quiver of pale fletching on the back, an oak self bow (the ice archer's wrapped in pale cord, its fletching blue-white, its heads cyan)
  function archer(drawing, P, K) {
    const N = 32, sp = new Grid(N), S = K.skin, H = K.hood, B = P.bob || 0, step = P.step || 0, arm = P.arm || "rest";
    let tip = null;
    if (drawing === "side") {
      const X = P.lean || 0, back = step > 0 ? -2 : step < 0 ? 2 : 0, fwd = -back, hx = X + (P.head ? P.head[0] : 0), hy = B + 2 + (P.head ? P.head[1] : 0);
      // the quiver on the back, the far arm (drawing the string, or hanging)
      quiver(sp, 9 + X, 8 + B, K, "side");
      if (arm === "draw") limb(sp, 13 + X, 12 + B, 17 + X, 11 + B, dark(S), 1.6, 2);
      else if (arm === "loose") limb(sp, 13 + X, 12 + B, 14 + X, 10 + B, dark(S), 1.6, 2);
      else if (arm !== "jab0" && arm !== "jab1") limb(sp, 12 + X, 12 + B, 11 + X, 20 + B, dark(S), 1.6, 2);
      region(sp, rect(12 + back, 22, 13 + back, 28), dark(S)); region(sp, rect(11 + back, 29, 14 + back, 30), dark(S));
      region(sp, rect(15 + fwd, 22, 16 + fwd, 28), S); region(sp, rect(15 + fwd, 29, 18 + fwd, 30), S, { ball: [16 + fwd, 29, 3] });
      kilt(sp, 11 + X, 18 + X, 18 + B, K);
      region(sp, ell(14.5 + X, 14.5 + B, 4, 4.8), S, { ball: [14.5 + X, 14.5 + B, Math.max(4, 4.8)] });
      region(sp, line(11 + X, 12 + B, 17 + X, 18 + B, 1), K.hood, { flat: 0 });   // the quiver's strap across the chest
      // the hood and its mantle, the face at its front: a yellow eye, a long nose, a small tusk
      region(sp, ell(14 + X, 11 + B, 4.5, 2.2), H, { ball: [14 + X, 11 + B, Math.max(4.5, 2.2)], cast: H[0] });
      region(sp, or(ell(16 + hx, 7.5 + hy, 4.2, 4.2), rect(12 + hx, 7 + hy, 14 + hx, 12 + hy)), H, { ball: [16 + hx, 8 + hy, 4.5], spec: (x, y) => x === 14 + hx && y === 4 + hy, cast: H[0] });
      region(sp, ell(18.5 + hx, 8.5 + hy, 2.3, 2.6), S, { ball: [18.5 + hx, 8.5 + hy, Math.max(2.3, 2.6)] });
      sp.set(19 + hx, 8 + hy, P.flinch ? S[0] : EYE); sp.set(21 + hx, 9 + hy, S[1]); sp.set(21 + hx, 10 + hy, S[0]); sp.set(19 + hx, 11 + hy, TUSK[1]);
      tip = bowSide(sp, arm, X, B, K);
    } else {
      const up = drawing === "up", lA = step > 0 ? -1 : 0, lB = step < 0 ? -1 : 0, hy = B + 3 + (P.head ? P.head[1] : 0), m = x => up ? 31 - x : x;
      const climb = P.climb, fall = P.fall;
      if (!up) quiver(sp, 20, 6 + B, K, "down");
      if (up && (climb !== undefined || arm === "back")) tip = bowFront(sp, "back", B, K, up);
      if (climb !== undefined) {
        const c = climb ? 1 : 0;
        region(sp, rect(12, 21 - 2 * c, 13, 27 - 2 * c), S); region(sp, rect(11, 28 - 2 * c, 14, 29 - 2 * c), S);
        region(sp, rect(18, 20 + 2 * c, 19, 28), S); region(sp, rect(17, 29, 20, 30), S);
      } else if (fall) {
        region(sp, rect(10, 22, 11, 28), S); region(sp, rect(9, 29, 12, 30), S); region(sp, rect(20, 22, 21, 28), S); region(sp, rect(19, 29, 22, 30), S);
      } else {
        region(sp, rect(12, 22 + lA, 13, 28 + lA), S); region(sp, rect(11, 29 + lA, 14, 30 + lA), S, { ball: [12, 29, 3] });
        region(sp, rect(18, 22 + lB, 19, 28 + lB), S); region(sp, rect(17, 29 + lB, 20, 30 + lB), S, { ball: [18, 29, 3] });
      }
      kilt(sp, 11, 20, 18 + B, K);
      region(sp, ell(15.5, 15 + B, 4.5, 5), S, { ball: [15.5, 15 + B, Math.max(4.5, 5)] });
      if (up) quiver(sp, 13, 8 + B, K, "up");
      region(sp, ell(15.5, 11.5 + B, 6.5, 2.4), H, { ball: [15.5, 11.5 + B, Math.max(6.5, 2.4)], cast: H[0] });
      // the arms, long and thin
      if (climb !== undefined) { const c = climb ? 1 : 0; limb(sp, 10, 12, 8, 3 + 3 * c, S, 1.6, 2); limb(sp, 21, 12, 23, 6 - 3 * c, S, 1.6, 2); }
      else if (fall) { limb(sp, 10, 12, 8, 3, S, 1.6, 2); limb(sp, 21, 12, 23, 3, S, 1.6, 2); }
      else if (!["draw", "loose", "jab0", "jab1"].includes(arm)) { limb(sp, m(21), 12 + B, m(22), 21 + B, S, 1.6, 2); if (arm !== "lower") limb(sp, m(10), 12 + B, m(9), 21 + B, S, 1.6, 2); }
      // the hood, the face in its opening
      region(sp, ell(15.5, 7.5 + hy, 4.6, 4.6), H, { ball: [15.5, 7.5 + hy, Math.max(4.6, 4.6)], spec: (x, y) => x === 13 && y === 4 + hy, cast: H[0] });
      if (!up) {
        region(sp, ell(15.5, 9 + hy, 3, 2.8), S, { ball: [15.5, 9 + hy, Math.max(3, 2.8)] });
        sp.set(14, 8 + hy, P.flinch ? S[0] : EYE); sp.set(17, 8 + hy, P.flinch ? S[0] : EYE);
        sp.set(15, 9 + hy, S[2]); sp.set(16, 9 + hy, S[1]); sp.set(15, 10 + hy, S[1]); sp.set(16, 10 + hy, S[0]);
        sp.set(14, 11 + hy, TUSK[1]); sp.set(17, 11 + hy, TUSK[1]);
      } else for (let y = 5; y <= 10; y++) sp.set(15, y + hy, H[0]);
      if (climb === undefined && fall === undefined) tip = bowFront(sp, arm, B, K, up);
      else if (fall) tip = bowFront(sp, "flail", B, K, up);
      else if (!up) tip = bowFront(sp, "back", B, K, up);
    }
    outline(sp);
    sp.tip = tip;
    return sp;
  }
  function kilt(sp, x0, x1, y0, K) {
    region(sp, (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y0 + 4 && !(y === y0 + 4 && x % 2 === 0), R.leather, { spec: (x, y) => y === y0 && x === x0 + 1 });
    if (K.ice) for (let x = x0; x <= x1; x++) sp.set(x, y0, R.frost[1]);
  }
  // the quiver: a leather tube, its fletching standing out of the top
  function quiver(sp, x, y, K, drawing) {
    const F = K.fletch;
    if (drawing === "side") { region(sp, rect(x, y + 2, x + 2, y + 9), R.leather); for (const [dx, dy, c] of [[0, 0, 2], [1, 1, 2], [2, 0, 1], [0, 1, 1], [2, 1, 2], [1, 0, 3]]) sp.set(x + dx, y + dy, F[c]); }
    else if (drawing === "down") { for (const [dx, dy, c] of [[0, 1, 2], [1, 0, 2], [2, 1, 1], [1, 1, 3], [0, 2, 1], [2, 2, 2]]) sp.set(x + dx, y + dy, F[c]); }
    else { region(sp, line(x + 6, y, x + 1, y + 10, 3), R.leather); for (const [dx, dy, c] of [[6, -1, 2], [7, -2, 2], [5, -2, 1], [6, -2, 3], [8, -1, 1]]) sp.set(x + dx, y + dy, F[c]); }
  }
  // a bow: an oak arc through the grip (gx, gy), its back bulging toward (dx, dy), its string straight or drawn back to (sx, sy)
  function bow(sp, gx, gy, ax, ay, half, bulge, K, string) {
    // ax, ay: the bow's axis (a unit vector along the limbs); the bulge is to the axis's right-hand side times `bulge`
    const nx = -ay * bulge, ny = ax * bulge, pts = new Set();
    for (let t = -half; t <= half; t += 0.25) { const b = Math.cos(t / half * 1.2) * 2.2; pts.add(Math.round(gx + ax * t + nx * b) + "," + Math.round(gy + ay * t + ny * b)); }
    const arc = (x, y) => pts.has(x + "," + y);
    region(sp, arc, K.ice ? R.frost : R.oak, { flat: K.ice ? 1 : 2, tex: (x, y) => (K.ice && (x + y) % 3 === 0 ? R.frost[3] : null) });
    const e0 = [Math.round(gx - ax * half + nx * 0.8), Math.round(gy - ay * half + ny * 0.8)], e1 = [Math.round(gx + ax * half + nx * 0.8), Math.round(gy + ay * half + ny * 0.8)];
    const strCol = "#ead4aa";
    if (string) { region(sp, line(e0[0], e0[1], string[0], string[1], 1), [strCol, strCol, strCol, strCol]); region(sp, line(string[0], string[1], e1[0], e1[1], 1), [strCol, strCol, strCol, strCol]); }
    else region(sp, line(e0[0], e0[1], e1[0], e1[1], 1), [strCol, strCol, strCol, strCol]);
  }
  // the nocked arrow from (x0, y0) to its head at (x1, y1): an oak shaft, the head (iron, or cyan for the ice archer)
  function arrow(sp, x0, y0, x1, y1, K) {
    region(sp, line(x0, y0, x1, y1, 1), K.ice ? R.frost : R.oak, { flat: K.ice ? 2 : 2 });
    sp.set(x1, y1, K.ice ? "#2ce8f5" : R.iron[3]);
    const d = Math.hypot(x1 - x0, y1 - y0) || 1; sp.set(Math.round(x1 - (x1 - x0) / d), Math.round(y1 - (y1 - y0) / d), K.ice ? "#2ce8f5" : R.iron[2]);
    return [x1, y1];
  }
  function bowSide(sp, arm, X, B, K) {
    const S = K.skin;
    if (arm === "draw") {   // the bow held out, the string drawn to the cheek, the arrow along the line
      limb(sp, 15 + X, 12 + B, 23 + X, 12 + B, S, 1.6, 2);
      bow(sp, 24 + X, 12 + B, 0, 1, 8, 1, K, [17 + X, 11 + B]);
      return arrow(sp, 17 + X, 11 + B, 28 + X, 11 + B, K);
    }
    if (arm === "loose") { limb(sp, 15 + X, 12 + B, 23 + X, 12 + B, S, 1.6, 2); bow(sp, 24 + X, 12 + B, 0, 1, 8, 1, K, null); return [25 + X, 12 + B]; }
    if (arm === "jab0" || arm === "jab1") {
      const f = arm === "jab1" ? 5 : 0;
      limb(sp, 12 + X, 13 + B, 13 + X + f, 18 + B, dark(S), 1.6, 2);
      limb(sp, 15 + X, 13 + B, 18 + X + f, 18 + B, S, 1.6, 2);
      bow(sp, 16 + X + f, 18 + B, 1, 0, 8, 1, K, null);
      return [25 + X + f, 18 + B];
    }
    if (arm === "flinch") { limb(sp, 15 + X, 12 + B, 19 + X, 15 + B, S, 1.6, 2); bow(sp, 21 + X, 14 + B, 0.3, 1, 8, 1, K, null); return [18 + X, 6 + B]; }
    if (arm === "lower") { limb(sp, 15 + X, 12 + B, 19 + X, 19 + B, S, 1.6, 2); bow(sp, 21 + X, 20 + B, 0.6, 0.8, 8, 1, K, null); return [26 + X, 26 + B]; }
    if (arm === "back") { bow(sp, 13 + X, 15 + B, 0.6, 0.8, 8, -1, K, null); return [8 + X, 9 + B]; }
    if (arm === "flail") { limb(sp, 15 + X, 12 + B, 19 + X, 4 + B, S, 1.6, 2); bow(sp, 20 + X, 3 + B, 1, 0, 8, -1, K, null); return [28 + X, 3 + B]; }
    // rest: the bow carried in the near hand, upright at the side
    limb(sp, 15 + X, 12 + B, 17 + X, 20 + B, S, 1.6, 2);
    bow(sp, 19 + X, 19 + B, 0, 1, 8, 1, K, null);
    return [19 + X, 11 + B];
  }
  function bowFront(sp, arm, B, K, up) {
    const S = K.skin, m = x => up ? 31 - x : x, s = up ? -1 : 1;
    if (arm === "draw" || arm === "loose") {
      // facing the camera the bow is held level across the chest and the arrow points down at the target; facing away, up
      limb(sp, 10, 12 + B, 9, 16 + B, S, 1.6, 2); limb(sp, 21, 12 + B, 22, 16 + B, S, 1.6, 2);
      if (up) { bow(sp, 15.5, 9 + B, 1, 0, 9, -1, K, arm === "draw" ? [15, 14 + B] : null); return arm === "draw" ? arrow(sp, 15, 14 + B, 15, 3 + B, K) : [15, 5 + B]; }
      bow(sp, 15.5, 19 + B, 1, 0, 9, 1, K, arm === "draw" ? [15, 13 + B] : null);
      return arm === "draw" ? arrow(sp, 15, 13 + B, 15, 25 + B, K) : [15, 22 + B];
    }
    if (arm === "jab0" || arm === "jab1") {
      const f = arm === "jab1" ? 4 : 0;
      limb(sp, m(10), 12 + B, m(13), 17 + B + f, S, 1.6, 2); limb(sp, m(21), 12 + B, m(18), 17 + B + f, S, 1.6, 2);
      bow(sp, 15.5, 18 + B + f, 0, 1, 8, s, K, null);
      return [15, 26 + B + f];
    }
    if (arm === "back") { bow(sp, m(16), 15 + B, 0.6, 0.8, 9, s, K, null); return [m(21), 22 + B]; }
    if (arm === "flail") { bow(sp, 15.5, 3 + B, 1, 0, 8, -1, K, null); return [m(23), 2 + B]; }   // falling, the bow held over the head in both hands
    if (arm === "flinch" || arm === "lower") { limb(sp, m(10), 12 + B, m(8), 18 + B, S, 1.6, 2); bow(sp, m(7), 18 + B, 0.4, 0.9, 8, -s, K, null); return [m(10), 25 + B]; }
    // rest: upright in the left hand at the side
    bow(sp, m(7), 20 + B, 0, 1, 8, -s, K, null);
    return [m(7), 12 + B];
  }

  // ------------------------------------------------------------------ the brute's body (brute, rock brute), 48 px
  // about 40 px tall and hunched: thick legs, a burlap loincloth, a belly and a huge hump of shoulders, the head low and forward, an
  // iron collar with a broken chain; the maul (a stone slab lashed to a log) or, for the rock brute, a boulder held over its head
  function brute(drawing, P, K) {
    const N = 48, sp = new Grid(N), S = K.skin, B = P.bob || 0, step = P.step || 0, arm = P.arm || "rest", rock = K.weapon === "rock";
    let tip = null;
    const sit = P.sit, roar = P.roar ? -1 : 0;
    if (drawing === "side") {
      const X = (P.lean || 0) + (sit ? -1 : 0), back = step > 0 ? -3 : step < 0 ? 3 : 0, fwd = -back, D = sit ? 6 : 0;
      const hx = X + (P.head ? P.head[0] : 0), hy = B + D + (P.head ? P.head[1] : 0);
      // a maul held behind (raised overhead from behind the hump)
      if (!rock && (arm === "rest" || arm === "raise" || arm === "roar" || arm === "flinch")) tip = maulSide(sp, arm, X, B, K);
      if (rock && armsUp(arm)) tip = rockOver(sp, 20 + X + (arm === "raise" ? -2 : 0), (arm === "raise" ? 1 : 3) + B + roar, K);
      // the far arm
      if (rock && (armsUp(arm) || arm === "flinch")) limb(sp, 16 + X, 21 + B, 18 + X + (arm === "raise" ? -2 : arm === "flinch" ? -4 : 0), 10 + B + roar, dark(S), 3.2, 5);
      else if (arm === "strike" || arm === "ground") limb(sp, 16 + X, 22 + B, 29 + X, 34 + B, dark(S), 3.2, 5);
      else if (sit) limb(sp, 15 + X, 26 + D, 11 + X, 38 + D, dark(S), 3.2, 5);
      else limb(sp, 15 + X, 23 + B, 13 + X, 35 + B, dark(S), 3.2, 5);
      // the legs
      if (sit) {
        region(sp, rect(14, 38, 28, 42), dark(S)); region(sp, rect(25, 40, 31, 44), dark(S)); region(sp, rect(26, 45, 34, 46), dark(S));
        region(sp, rect(18, 39, 32, 43), S); region(sp, rect(29, 41, 34, 44), S); region(sp, rect(30, 45, 38, 46), S, { ball: [32, 45, 4] });
      } else {
        region(sp, rect(17 + back, 37, 21 + back, 44), dark(S)); region(sp, rect(16 + back, 45, 23 + back, 46), dark(S));
        region(sp, rect(23 + fwd, 37, 27 + fwd, 44), S); region(sp, rect(23 + fwd, 45, 30 + fwd, 46), S, { ball: [26 + fwd, 45, 4] });
      }
      // the belly, the loincloth, the hump of the shoulders
      region(sp, ell(21 + X, 28 + B + D + roar, 11, 9), S, { ball: [21 + X, 28 + B + D + roar, Math.max(11, 9)] });
      region(sp, (x, y) => x >= 12 + X && x <= 30 + X && y >= 34 + B + D && y <= 39 + B + D && !(y === 39 + B + D && x % 3 === 0), R.burlap, { tex: (x, y) => y === 34 + B + D ? R.oak[2] : null });
      region(sp, ell(18 + X, 20 + B + D + roar, 9, 7), S, { ball: [18 + X, 20 + B + D + roar, Math.max(9, 7)], spec: (x, y) => x === 13 + X && y === 16 + B + D, cast: S[0] });
      // the head, low and forward: a heavy brow, a yellow eye, a broad nose, an underbite with a big tusk, a torn ear
      region(sp, ell(30 + hx, 23 + hy, 6, 5), S, { ball: [30 + hx, 23 + hy, Math.max(6, 5)], cast: S[0] });
      region(sp, rect(35 + hx, 21 + hy, 37 + hx, 24 + hy), S, { spec: (x, y) => x === 35 + hx && y === 21 + hy });
      region(sp, or(rect(25 + hx, 18 + hy, 26 + hx, 20 + hy), rect(24 + hx, 17 + hy, 24 + hx, 17 + hy)), S, { flat: 1 });
      for (let x = 28; x <= 34; x++) sp.set(x + hx, 21 + hy, S[0]);
      sp.set(33 + hx, 22 + hy, P.flinch ? S[0] : EYE);
      for (let x = 30; x <= 35; x++) sp.set(x + hx, 26 + hy, P.roar ? OUT : S[0]);
      if (P.roar) for (let x = 31; x <= 35; x++) sp.set(x + hx, 27 + hy, "#3e2731");
      sp.set(34 + hx, 23 + hy, TUSK[1]); sp.set(34 + hx, 24 + hy, TUSK[1]); sp.set(34 + hx, 25 + hy, TUSK[0]); sp.set(35 + hx, 25 + hy, TUSK[0]);
      // the iron collar and its broken chain
      region(sp, rect(25 + X, 27 + B + D, 30 + X, 29 + B + D), R.iron, { spec: (x, y) => y === 27 + B + D && x % 2 === 0 });
      for (const [dx, dy] of [[29, 31], [30, 32], [29, 33], [30, 35], [29, 36]]) sp.set(dx + X, dy + B + D, dy % 2 ? R.iron[3] : R.iron[1]);
      // the near arm
      if (rock && armsUp(arm)) limb(sp, 22 + X, 22 + B, 23 + X + (arm === "raise" ? -2 : 0), 11 + B + roar, S, 3.2, 5);
      else if (arm === "strike" || arm === "ground") limb(sp, 22 + X, 23 + B, 37 + X, 36 + B, S, 3.4, 5);
      else if (arm === "charge") limb(sp, 22 + X, 25 + B, 30 + X, 37 + B, S, 3.4, 5);
      else if (sit) limb(sp, 22 + X, 27 + D, 27 + X, 36 + D, S, 3.4, 5);
      else if (rock && arm === "flinch") limb(sp, 22 + X, 23 + B, 19 + X, 11 + B, S, 3.2, 5);
      else if (!rock && (arm === "rest" || arm === "raise" || arm === "roar" || arm === "flinch")) limb(sp, 22 + X, 23 + B, ...maulFist(arm, X, B), S, 3.4, 5);
      else limb(sp, 22 + X, 23 + B, 25 + X, 35 + B, S, 3.4, 5);
      if (!rock && (arm === "strike" || arm === "ground")) tip = maulSide(sp, arm, X, B, K);
      if (rock && arm === "flinch") tip = rockOver(sp, 15 + X, 2 + B, K);
      if (rock && (arm === "strike" || arm === "ground")) tip = [Math.min(46, 39 + X), 38 + B];
    } else {
      const up = drawing === "up", lA = step > 0 ? -1 : 0, lB = step < 0 ? -1 : 0, D = sit ? 6 : 0, hy = B + D + (P.head ? P.head[1] : 0) + roar;
      const m = x => up ? 47 - x : x;
      if (!up && !rock && arm === "raise") tip = maulFront(sp, arm, B, K, up);
      if (rock && armsUp(arm) && !up) tip = rockOver(sp, 17, (arm === "raise" ? 1 : 2) + B + roar, K);
      if (rock && arm === "flinch" && !up) tip = rockOver(sp, 15, 1 + B, K);
      // the legs
      if (sit) {
        region(sp, rect(12, 40, 21, 44), S); region(sp, rect(27, 40, 36, 44), S); region(sp, rect(10, 45, 21, 46), S, { ball: [14, 45, 4] }); region(sp, rect(27, 45, 38, 46), S, { ball: [31, 45, 4] });
      } else {
        region(sp, rect(16, 37 + lA, 21, 44 + lA), S); region(sp, rect(15, 45 + lA, 22, 46 + lA), S, { ball: [17, 45, 4] });
        region(sp, rect(27, 37 + lB, 32, 44 + lB), S); region(sp, rect(26, 45 + lB, 33, 46 + lB), S, { ball: [28, 45, 4] });
      }
      region(sp, ell(24, 30 + B + D + roar, 11, 8.5), S, { ball: [24, 30 + B + D + roar, Math.max(11, 8.5)] });
      region(sp, (x, y) => x >= 14 && x <= 34 && y >= 34 + B + D && y <= 39 + B + D && !(y === 39 + B + D && x % 3 === 0), R.burlap, { tex: (x, y) => y === 34 + B + D ? R.oak[2] : null });
      if (up && rock && armsUp(arm)) tip = rockOver(sp, 17, (arm === "raise" ? 1 : 2) + B + roar, K);
      if (up && rock && arm === "flinch") tip = rockOver(sp, 19, 1 + B, K);
      region(sp, ell(24, 22 + B + D + roar, 15.5, 6), S, { ball: [24, 22 + B + D + roar, Math.max(15.5, 6)], spec: (x, y) => x === 12 && y === 19 + B + D, cast: S[0] });
      // the arms
      const big = (sx, sy, fx, fy) => limb(sp, sx, sy, fx, fy, S, 3.4, 5);
      if (rock && armsUp(arm)) { const r = arm === "raise" ? -2 : 0; big(11, 21 + B, 16, 10 + B + r + roar); big(37, 21 + B, 32, 10 + B + r + roar); }
      else if (rock && arm === "flinch") { big(11, 21 + B, 14, 9 + B); big(37, 21 + B, 30, 9 + B); }
      else if (arm === "strike" || arm === "ground") { big(12, 22 + B, 18, 36 + B); big(36, 22 + B, 30, 36 + B); }
      else if (arm === "charge") { big(11, 23 + B, 13, 37 + B); big(37, 23 + B, 35, 37 + B); }
      else if (sit) { big(11, 23 + D, 8, 37 + D); big(37, 23 + D, 40, 37 + D); }
      else if (arm === "roar") { big(m(10), 21 + B, m(6), 11 + B); big(m(38), 22 + B, m(39), 35 + B); }   // the maul brute rears up, a fist raised
      else { big(m(10), 22 + B, m(9), 35 + B); if (rock || arm === "strike") big(m(38), 22 + B, m(39), 35 + B); }
      if (up && !rock && arm === "raise") tip = maulFront(sp, arm, B, K, up);
      // the head, low between the shoulders
      region(sp, ell(24, 18 + hy, 6, 5), S, { ball: [24, 18 + hy, Math.max(6, 5)], cast: S[0] });
      region(sp, or(rect(16, 16 + hy, 17, 18 + hy), rect(31, 16 + hy, 32, 18 + hy), rect(15, 15 + hy, 15, 15 + hy), rect(33, 15 + hy, 33, 15 + hy)), S, { flat: 1 });
      if (!up) {
        for (let x = 20; x <= 28; x++) sp.set(x, 16 + hy, S[0]);
        sp.set(21, 17 + hy, P.flinch ? S[0] : EYE); sp.set(27, 17 + hy, P.flinch ? S[0] : EYE);
        region(sp, rect(23, 18 + hy, 25, 20 + hy), S, { spec: (x, y) => x === 23 && y === 18 + hy });
        for (let x = 20; x <= 28; x++) sp.set(x, 21 + hy, P.roar ? OUT : S[0]);
        if (P.roar) for (let x = 21; x <= 27; x++) sp.set(x, 22 + hy, "#3e2731");
        for (const [x, y, c] of [[20, 19, 1], [20, 20, 1], [20, 21, 0], [28, 19, 1], [28, 20, 1], [28, 21, 0]]) sp.set(x, y + hy, TUSK[c]);
      } else for (let x = 20; x <= 28; x++) sp.set(x, 21 + hy, S[0]);
      region(sp, rect(18, 22 + hy, 30, 24 + hy), R.iron, { spec: (x, y) => y === 22 + hy && x % 3 === 0 });
      for (const [dx, dy] of [[31, 25], [32, 26], [31, 27], [32, 29], [31, 30]]) sp.set(m(dx), dy + hy, dy % 2 ? R.iron[3] : R.iron[1]);
      if (!rock && arm !== "raise") tip = maulFront(sp, arm === "roar" ? "rest" : arm, B, K, up, sit, D);
      if (rock && (arm === "strike" || arm === "ground")) tip = [24, 44 + B];
    }
    outline(sp);
    sp.tip = tip;
    return sp;
  }
  const armsUp = arm => arm === "rest" || arm === "raise" || arm === "roar";
  // the rock brute's boulder over its head: 14 x 12 in the field's rock ramp with a moss cap, its top-left corner at (x, y)
  function rockOver(sp, x, y, K) { boulder(sp, x, y); return [x + 7, y + 6]; }
  function boulder(sp, x, y) {
    region(sp, or(ell(x + 6.5, y + 6, 7, 5.5), rect(x + 2, y + 6, x + 11, y + 10)), STONE, { ball: [x + 4, y + 3, 7], spec: (xx, yy) => (xx === x + 3 && yy === y + 2) || (xx === x + 4 && yy === y + 1) });
    for (const [dx, dy] of [[3, 1], [4, 1], [5, 0], [6, 1], [2, 2]]) sp.set(x + dx, y + dy, MOSS);
    for (const [dx, dy] of [[8, 5], [9, 6], [9, 7], [10, 8]]) sp.set(x + dx, y + dy, STONE[0]);   // a crack
  }
  // the maul in the side drawing: where the fist is, and the log and slab from it
  function maulFist(arm, X, B) { return { rest: [25 + X, 34 + B], raise: [24 + X, 12 + B], roar: [21 + X, 14 + B], flinch: [24 + X, 26 + B] }[arm] || [25 + X, 34 + B]; }
  function maulSide(sp, arm, X, B, K) {
    if (arm === "strike" || arm === "ground") {   // slammed down 24 px ahead, the slab on the ground at the cell's edge
      region(sp, line(36 + X, 35 + B, 41 + X, 38 + B, 3), R.oak);
      slab(sp, 38 + X, 37, 46, 46);
      return [42 + X, 36];
    }
    const [fx, fy] = maulFist(arm, X, B);
    const t = { rest: [10 + X, 9 + B], raise: [17 + X, 5 + B], roar: [12 + X, 6 + B], flinch: [11 + X, 10 + B] }[arm];
    region(sp, line(fx, fy, t[0], t[1], 3), R.oak, { cast: R.oak[0] });
    slab(sp, t[0] - 5, t[1] - 4, t[0] + 4, t[1] + 4);
    return [t[0] - 1, t[1] - 5];
  }
  function maulFront(sp, arm, B, K, up, sit, D) {
    const m = x => up ? 47 - x : x;
    if (arm === "raise" || arm === "roar") {   // lifted high overhead in both hands
      const lift = arm === "raise" ? 0 : 3;
      region(sp, line(m(24), 18 + B + lift, m(24), 8 + B + lift, 3), R.oak);
      slab(sp, 18, 1 + B + lift, 30, 8 + B + lift);
      return [24, 0 + B + lift];
    }
    if (arm === "strike" || arm === "ground") { region(sp, line(24, 30 + B, 24, 38 + B, 3), R.oak); slab(sp, 18, 38, 30, 46); return [24, 37]; }
    if (sit) { region(sp, line(m(40), 36 + D, m(43), 39 + D, 3), R.oak); slab(sp, up ? 1 : 38, 38, up ? 9 : 46, 46); return [m(42), 37]; }
    // rest (and the charge, the hit): on the shoulder, the slab over it
    region(sp, line(m(39), 34 + B, m(41), 13 + B, 3), R.oak, { cast: R.oak[0] });
    slab(sp, up ? 3 : 36, 5 + B, up ? 11 : 44, 13 + B);
    return [m(40), 4 + B];
  }
  // the maul's slab: grey stone lashed with rope
  function slab(sp, x0, y0, x1, y1) {
    region(sp, rect(x0, y0, x1, y1), STONE, { spec: (x, y) => x === x0 + 1 && y === y0 + 1, tex: (x, y, c) => ((x * 7 + y * 3) % 11 === 0 ? STONE[0] : null) });
    const my = Math.round((y0 + y1) / 2); for (let x = x0; x <= x1; x++) { sp.set(x, my, R.burlap[x % 2 ? 1 : 2]); }
  }

  // ------------------------------------------------------------------ the troll knight's body (design pass 21 section 3.6)
  // A footman in the castle's stolen armour, ported from docs/design/21-great-hall.sketch.js: a dented kettle helm, its eye glinting under
  // the brim over a green face, a tusk and an underbite; a breastplate too small for its green hump, a pauldron, a mail skirt, iron
  // greaves over bare green feet; a long sword, and a kite shield of the castle's arms (a white wolf's head on blue in a gilt rim) smeared
  // with the green hand, its face cracked once and twice as the guard meter fills (K.dent 1, 2). The shield is on the near arm in the side
  // drawing, held low so the face shows over it (raised over the face to block); on the troll's left facing the camera, the sword on its
  // right; seen from behind, its back of oak boards and straps. Drawn 26 px tall (27 facing the camera or away), a footman's frame under
  // the helm.
  const kite = (cx, cy) => (x, y) => { const yy = y - cy, xx = x - cx; if (yy < 0 || yy > 12) return false; return Math.abs(xx) <= (yy < 6 ? 4.5 : 4.5 * (1 - (yy - 6) / 7.5)); };
  // the shield's face, its top at (cx, cy), 9 x 12: the gilt rim (lit on the top and the left), the blue field (light on the left), the
  // white wolf's head looking left, the green hand smeared down over it, the dents, the iron boss (returned: a bash's tip)
  function shield(sp, cx, cy, dent) {
    const k = kite(cx, cy), B = R.blue;
    region(sp, k, B, { tex: (x, y) => {
      const yy = y - cy, xx = x - cx;
      if (!k(x - 1, y) || !k(x + 1, y) || !k(x, y - 1) || !k(x, y + 1)) return yy < 2 || xx < 0 ? GILT[0] : GILT[1];
      const wolf = (xx >= -2 && xx <= 2 && yy >= 3 && yy <= 7) || (xx === -3 && yy >= 5 && yy <= 6) || (xx === -2 && yy === 2) || (xx === 1 && yy === 2) || (xx >= -1 && xx <= 1 && yy === 8);
      if (wolf) return xx === 0 && yy === 4 ? R.iron[0] : xx >= 1 ? R.bone[2] : "#ffffff";
      return xx < 0 ? B[2] : yy > 8 ? B[0] : B[1];
    } });
    for (const [dx, dy] of [[0, 5], [1, 5], [-1, 6], [0, 6], [1, 6], [2, 6], [0, 7], [1, 7], [-1, 4], [1, 3], [2, 4], [0, 9], [1, 10]]) { const c = sp.get(cx + dx, cy + dy); if (c && c !== GILT[0] && c !== GILT[1]) sp.set(cx + dx, cy + dy, dy > 7 ? HAND[0] : HAND[1]); }
    if (dent >= 1) for (const [dx, dy] of [[-3, 2], [-2, 3], [-2, 4], [-1, 5]]) sp.set(cx + dx, cy + dy, OUT);
    if (dent >= 2) for (const [dx, dy] of [[3, 7], [2, 8], [2, 9], [3, 3], [2, 2]]) sp.set(cx + dx, cy + dy, OUT);
    sp.set(cx, cy + 5, R.iron[3]);
    return [cx, cy + 5];
  }
  // the shield's back (seen from behind): oak boards, two leather straps across, the boss's rivet; its tip on the top board, which shows
  // over the shoulders when the shield is thrust ahead of the body
  function shieldBack(sp, cx, cy) {
    const k = kite(cx, cy);
    region(sp, (x, y) => k(x, y) && Math.abs(x - cx) <= 4, R.leather, { tex: (x, y, c) => (y - cy === 4 || y - cy === 8) ? R.leather[0] : x === cx && y - cy === 6 ? R.iron[2] : (x - cx) % 3 === 0 && c === R.leather[1] ? R.leather[2] : null });
    return [cx, cy + 2];
  }
  // the long sword from the fist (fx, fy) to its point (tx, ty): an iron pommel, a leather grip, an iron cross, a steel blade whose point
  // is its brightest pixel (returned: the tip, where a cut's glint is drawn)
  function sword(sp, fx, fy, tx, ty) {
    const d = Math.hypot(tx - fx, ty - fy) || 1, ux = (tx - fx) / d, uy = (ty - fy) / d;
    region(sp, line(fx - ux * 2, fy - uy * 2, fx, fy, 1), R.leather, { flat: 2 });
    region(sp, line(fx + ux - uy * 2, fy + uy + ux * 2, fx + ux + uy * 2, fy + uy - ux * 2, 1), R.iron, { flat: 2 });
    region(sp, line(fx + ux * 2, fy + uy * 2, tx, ty, 1), R.steel, { flat: 2, spec: (x, y) => (x + y) % 3 === 0 });
    sp.set(Math.round(fx - ux * 3), Math.round(fy - uy * 3), R.iron[3]);
    sp.set(tx, ty, R.steel[3]);
    return [Math.round(tx), Math.round(ty)];
  }
  // the kettle helm, its brim on row by: a low dome lit from the top left with a dent, the wide brim
  function helm(sp, cx, by, side) {
    const rx = side ? 4.3 : 4.8, w = side ? 6 : 7;
    region(sp, or((x, y) => y < by && ell(cx, by, rx, 5)(x, y), rect(Math.round(cx - w), by, Math.round(cx + w), by)), R.iron,
      { ball: [cx - 1.5, by - 3, 4.5], spec: (x, y) => x === Math.round(cx - 2) && y === by - 3, tex: (x, y) => y === by ? (x < cx - 1 ? R.iron[2] : R.iron[1]) : null });
    sp.set(Math.round(cx + 1), by - 3, R.iron[0]);   // the dent
  }
  // the side drawing's poses: the sword arm (the far arm) [shoulder, fist, the blade's point] and the shield [cx, its top]. At rest the
  // sword drags its point behind; the cut raises it behind and swings it down ahead; reeling, both arms are flung back and the front is open
  const KS = {
    rest: { sword: [[12, 16], [8, 21], [2, 29]], shield: [18, 17] }, raise: { sword: [[12, 15], [9, 9], [3, 3]], shield: [19, 16] },
    strike: { sword: [[14, 16], [22, 19], [29, 25]], shield: [15, 16] }, ground: { sword: [[14, 16], [21, 22], [28, 29]], shield: [16, 16] },
    block: { sword: [[12, 16], [8, 21], [3, 28]], shield: [21, 9] }, bash0: { sword: [[12, 16], [8, 21], [2, 28]], shield: [15, 15] },
    bash1: { sword: [[12, 16], [9, 21], [3, 28]], shield: [23, 15] }, reel: { sword: [[12, 15], [8, 11], [4, 5]], shield: [7, 12] },
    flinch: { sword: [[12, 16], [8, 22], [3, 28]], shield: [17, 16] }
  };
  // facing the camera: the sword's fist and point on the troll's right (our left), the shield [cx, its top] on its left
  const KF = {
    rest: { fist: [6, 21], point: [2, 29], shield: [22, 17] }, raise: { fist: [5, 8], point: [9, 1], shield: [22, 16] },
    strike: { fist: [9, 23], point: [13, 29], shield: [23, 16] }, ground: { fist: [8, 23], point: [11, 29], shield: [22, 17] },
    block: { fist: [6, 21], point: [3, 28], shield: [16, 10] }, bash0: { fist: [6, 21], point: [2, 29], shield: [24, 14] },
    bash1: { fist: [6, 21], point: [2, 29], shield: [19, 17] }, reel: { fist: [4, 11], point: [2, 3], shield: [26, 9] },
    flinch: { fist: [6, 21], point: [3, 29], shield: [21, 16] }
  };
  // the shield's back seen from behind, on our left: [cx, its top] (raised to block, drawn back and thrust for the bash, flung wide)
  const KB = { rest: [5, 13], raise: [5, 13], strike: [6, 13], ground: [5, 14], block: [7, 8], bash0: [5, 15], bash1: [8, 10], reel: [5, 10], flinch: [5, 13] };
  function trollKnight(drawing, P, K) {
    const N = 32, sp = new Grid(N), S = K.skin, B = P.bob || 0, step = P.step || 0, arm = P.arm || "rest", dent = K.dent || 0;
    let tip = null;
    if (drawing === "side") {
      const X = P.lean || 0, back = step > 0 ? -2 : step < 0 ? 2 : 0, fwd = -back, hx = X + (P.head ? P.head[0] : 0), hy = B + (P.head ? P.head[1] : 0);
      const pose = KS[arm] || KS.rest, [[sx, sy], [fx, fy], [tx, ty]] = pose.sword;
      // the sword arm, behind: the sword raised behind it for the cut, else held in its fist
      if (arm === "raise" || arm === "reel") tip = sword(sp, fx + X, fy + B, tx + X, ty + B);
      limb(sp, sx + X, sy + B, fx + X, fy + B, dark(S));
      if (arm !== "raise" && arm !== "reel") tip = sword(sp, fx + X, fy + B, tx + X, ty + B);
      // the legs in iron greaves, bare green feet with the toes forward
      region(sp, rect(11 + back, 24, 13 + back, 28), dark(R.iron)); region(sp, rect(10 + back, 29, 14 + back, 30), dark(S));
      region(sp, rect(15 + fwd, 24, 17 + fwd, 28), R.iron); region(sp, rect(15 + fwd, 29, 19 + fwd, 30), S, { ball: [16 + fwd, 29, 3] });
      // the troll's body, the mail skirt, the breastplate too small for it, the green hump of the shoulders and the pauldron
      region(sp, ell(13.5 + X, 19 + B, 6.5, 6), S, { ball: [13.5 + X, 19 + B, 6.5] });
      region(sp, (x, y) => x >= 8 + X && x <= 19 + X && y >= 21 + B && y <= 25 + B && !(y === 25 + B && (x + B) % 2 === 0), R.iron, { tex: (x, y) => (x + y) % 2 ? R.iron[1] : R.iron[2] });
      region(sp, ell(14.5 + X, 18.5 + B, 5.5, 4.5), R.steel, { ball: [13 + X, 16.5 + B, 5.5], spec: (x, y) => x === 11 + X && y === 15 + B });
      region(sp, ell(11.5 + X, 13.5 + B, 5, 4), S, { ball: [11.5 + X, 13.5 + B, 5], spec: (x, y) => x === 9 + X && y === 11 + B, cast: S[0] });
      region(sp, ell(13 + X, 15 + B, 3.5, 2.4), R.steel, { ball: [12 + X, 14 + B, 3.5], cast: R.steel[0] });
      // the head, jutting forward under the helm: the brow in the brim's shadow, a yellow eye, a big nose, an underbite and a tusk
      region(sp, ell(20.5 + hx, 15.5 + hy, 3.8, 3), S, { ball: [20.5 + hx, 15.5 + hy, 3.8], cast: S[0] });
      region(sp, rect(24 + hx, 14 + hy, 25 + hx, 16 + hy), S, { spec: (x, y) => x === 24 + hx && y === 14 + hy });
      for (let x = 18; x <= 23; x++) sp.set(x + hx, 13 + hy, S[0]);
      for (let x = 20; x <= 23; x++) sp.set(x + hx, 17 + hy, S[0]);
      sp.set(23 + hx, 16 + hy, TUSK[1]); sp.set(23 + hx, 17 + hy, TUSK[0]);
      helm(sp, 19.5 + hx, 12 + hy, true);
      sp.set(22 + hx, 14 + hy, P.flinch ? S[0] : EYE);
      // the near arm and the shield on it, its face toward us
      const [shx, shy] = pose.shield;
      limb(sp, 15 + X, 16 + B, shx - 1 + X, shy + 5 + B, S, 2, 3);
      const boss = shield(sp, shx + X, shy + B, dent);
      if (arm === "bash0" || arm === "bash1") tip = boss;
    } else {
      const up = drawing === "up", lA = step > 0 ? -1 : 0, lB = step < 0 ? -1 : 0, m = x => up ? 31 - x : x, hy = B + (P.head ? P.head[1] : 0);
      const climb = P.climb, fall = P.fall;
      // facing away, the shield's back on our left (the troll's left arm), behind the body when it is raised to block or thrust
      const bk = up && climb === undefined && !fall ? KB[arm] || KB.rest : null;
      if (bk && (arm === "block" || arm === "bash1")) tip = shieldBack(sp, bk[0], bk[1] + B);
      // the legs in greaves, bare green feet
      if (climb !== undefined) {
        const c = climb ? 1 : 0;
        region(sp, rect(11, 23 - 2 * c, 13, 26 - 2 * c), R.iron); region(sp, rect(10, 27 - 2 * c, 14, 28 - 2 * c), S);
        region(sp, rect(18, 21 + 2 * c, 20, 28), R.iron); region(sp, rect(17, 29, 21, 30), S);
      } else if (fall) {
        region(sp, rect(9, 24, 11, 28), R.iron); region(sp, rect(8, 29, 12, 30), S); region(sp, rect(20, 24, 22, 28), R.iron); region(sp, rect(19, 29, 23, 30), S);
      } else {
        region(sp, rect(11, 25 + lA, 13, 28 + lA), R.iron); region(sp, rect(10, 29 + lA, 14, 30 + lA), S, { ball: [11, 29, 3] });
        region(sp, rect(18, 25 + lB, 20, 28 + lB), R.iron); region(sp, rect(17, 29 + lB, 21, 30 + lB), S, { ball: [18, 29, 3] });
      }
      // the green body bulging round a breastplate too small for it, the mail skirt, the plated shoulders
      region(sp, ell(15.5, 19 + B, 7.5, 5.5), S, { ball: [15.5, 19 + B, 7.5] });
      region(sp, (x, y) => x >= 9 && x <= 22 && y >= 22 + B && y <= 25 + B && !(y === 25 + B && (x + B) % 2 === 0), R.iron, { tex: (x, y) => (x + y) % 2 ? R.iron[1] : R.iron[2] });
      if (up) {   // its back: the green hump and the breastplate's straps across it
        for (let x = 10; x <= 21; x++) { sp.set(x, 18 + B, R.leather[1]); if (x >= 12 && x <= 19) sp.set(x, 21 + B, R.leather[1]); }
        sp.set(15, 18 + B, R.iron[2]); sp.set(16, 18 + B, R.iron[2]);
      } else {
        region(sp, ell(15.5, 18.5 + B, 5.5, 4.5), R.steel, { ball: [14, 16.5 + B, 5.5], spec: (x, y) => x === 12 && y === 15 + B });
        for (let x = 12; x <= 19; x++) if ((x + B) % 3 === 0) sp.set(x, 19 + B, R.steel[0]);
      }
      region(sp, ell(15.5, 14.5 + B, 9.5, 3.2), R.steel, { ball: [14, 13.5 + B, 9.5], spec: (x, y) => x === 9 && y === 13 + B, cast: R.steel[0] });
      // the arms: climbing or falling both up; else the sword in the troll's right fist (our left facing the camera)
      if (climb !== undefined) { const c = climb ? 1 : 0; limb(sp, 8, 14, 7, 4 + 3 * c, S); limb(sp, 23, 14, 24, 7 - 3 * c, S); }
      else if (fall) { limb(sp, 7, 14, 4, 6, S); limb(sp, 24, 14, 27, 6, S); tip = sword(sp, m(4), 6, m(2), 1); }
      else {
        const f = KF[arm] || KF.rest, [fx, fy] = f.fist, [px, py] = f.point;
        limb(sp, m(7), 15 + B, m(fx), fy + B, S);
        const t = sword(sp, m(fx), fy + B, m(px), py + (arm === "raise" ? 0 : B));
        if (arm !== "bash0" && arm !== "bash1") tip = t;
      }
      // the head low between the plated shoulders, the helm's brim over the eyes
      region(sp, ell(15.5, 13 + hy, 4.3, 3.3), S, { ball: [15.5, 13 + hy, 4.3], cast: S[0] });
      if (!up) {
        sp.set(13, 12 + hy, P.flinch ? S[0] : EYE); sp.set(18, 12 + hy, P.flinch ? S[0] : EYE);
        region(sp, rect(15, 13 + hy, 16, 14 + hy), S, { spec: (x, y) => x === 15 && y === 13 + hy });
        for (let x = 13; x <= 18; x++) sp.set(x, 15 + hy, S[0]);
        sp.set(13, 14 + hy, TUSK[1]); sp.set(18, 14 + hy, TUSK[1]); sp.set(13, 15 + hy, TUSK[0]); sp.set(18, 15 + hy, TUSK[0]);
      } else for (let x = 13; x <= 18; x++) sp.set(x, 15 + hy, S[0]);
      helm(sp, 15.5, 11 + hy, false);
      // the shield: its back on our left facing away; its face on our right facing the camera; slung on the back to climb, flung up falling
      if (bk && arm !== "block" && arm !== "bash1") { const t = shieldBack(sp, bk[0], bk[1] + B); if (arm === "bash0") tip = t; }
      if (climb !== undefined) tip = shieldBack(sp, 15, 15);
      if (fall) { if (up) shieldBack(sp, m(25), 3); else shield(sp, m(25), 3, dent); }
      if (!up && climb === undefined && !fall) {
        const [shx, shy] = (KF[arm] || KF.rest).shield;
        limb(sp, 24, 15 + B, shx + 1, shy + 6 + B, S, 2, 3);
        const boss = shield(sp, shx, shy + B, dent);
        if (arm === "bash0" || arm === "bash1") tip = boss;
      }
    }
    outline(sp);
    sp.tip = tip;
    return sp;
  }
  function knightPose(anim, i) {
    if (anim === "walk") return { step: [1, 0, -1, 0][i % 4], bob: i % 2 ? 0 : 1, arm: "rest" };
    if (anim === "wind") return { lean: -1, arm: "raise" };
    if (anim === "strike") return { lean: 1, arm: "strike" };
    if (anim === "recover") return { lean: 1, bob: 1, arm: "ground" };
    if (anim === "hit" || anim === "stone") return { lean: -1, head: [-1, -1], flinch: true, arm: "flinch" };
    if (anim === "block") return { bob: 1, head: [-1, 1], arm: "block" };
    if (anim === "bash") return { lean: i % 2 ? 2 : -1, arm: i % 2 ? "bash1" : "bash0" };
    if (anim === "reel") return { lean: -2, head: [-1, -1], arm: "reel" };
    if (anim === "climb") return { climb: i % 2, arm: "back" };
    if (anim === "fall") return { fall: true, arm: "reel" };
    return { bob: i % 2, arm: "rest" };   // idle: a 1 px breath
  }

  // ------------------------------------------------------------------ the rabid troll wolf's body (design pass 21 section 3.7)
  // The castle's wolves, taken from the kennels and infected, ported from the sketch: lean and grey in the mange ramp (lit a step above
  // its middle, so the grey reads on the halls' dark floors and stays darker than a troll's green), the fur patched green where the
  // troll shows (the patches fixed to the body, so they ride its breath), hackles along the back, ribs, a bushy tail held low, pricked
  // ears (laid back when it snarls), yellow troll eyes, small tusks, a red mouth and froth when the jaws open. 14 px tall at the withers
  // (its body's h), drawn 15 with its ears, the head carried low and forward; side, toward and away. The tip is at the jaws.
  // P: { bob, crouch (the body lowered), legs [near fore, far fore, near hind, far hind] (each -2 to 2, back to forward), jaw (0 to 3),
  // froth, hackles (raised, the ears laid back), flinch, tailDown, lunge (the head thrust forward), stretch (the leap: long and low,
  // the fore legs reaching ahead, the hind legs pushing off behind) }
  function hash(x, y, k) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul((k | 0) + 1, 2246822519)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
  // a stroke 2 px wide (each pixel and the one to its right) through the points: a quadruped's thin legs, no lower than the last point
  function stroke2(pts) {
    const s = new Set();
    for (let k = 0; k + 1 < pts.length; k++) { const [x0, y0] = pts[k], [x1, y1] = pts[k + 1], n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 + 1;
      for (let i = 0; i <= n; i++) { const t = i / n, x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t); s.add(x + "," + y); s.add((x + 1) + "," + y); } }
    return (x, y) => s.has(x + "," + y);
  }
  function wolf(drawing, P, K) {
    const N = 32, sp = new Grid(N), F = K.skin, B = P.bob || 0, crouch = P.crouch || 0, Y = crouch + B, legs = P.legs || [0, 0, 0, 0], jaw = P.jaw || 0;
    const FUR = [F[1], F[2], F[3], F[3]], FAR = [F[0], F[1], F[2], F[2]], td = P.tailDown ? 2 : 0, back = !!P.hackles;
    // the mange's green patches in blotches, by the body's own pixel (x, y - Y)
    const patch = (x, y) => { const v = y - Y; return hash(x >> 1, v >> 1, 77) < 0.32 && hash(x, v, 78) < 0.6 ? HAND[hash(x, v, 79) < 0.5 ? 0 : 1] : null; };
    // a paw on row y, 2 px and a toe toward dx
    const paw = (x, y, dx, ramp) => region(sp, rect(Math.min(x, x + dx), y, Math.max(x + 1, x + 1 + dx), y), ramp, { flat: 1 });
    let tip = null;
    if (drawing === "side") {
      const L = P.lunge || 0, st = P.stretch ? 1 : 0;
      // a fore leg from the elbow to the paw, the wrist bent by its swing; a hind leg from the hip back to the hock, then down; stretched
      // in the leap, the fore legs reach ahead off the ground and the hind legs push off behind
      const fore = (x, ph, ramp) => {
        if (st) { region(sp, stroke2([[x, 23 + Y], [x + 4, 26], [x + 7, 27]]), ramp); paw(x + 7, 28, 1, ramp); return; }
        const px = x + 2 * ph; region(sp, stroke2([[x, 23 + Y], [x + ph, 27], [px, 29]]), ramp); paw(px, 30, 1, ramp);
      };
      const hind = (x, ph, ramp) => {
        if (st) { region(sp, stroke2([[x, 22 + Y], [x - 4, 26], [x - 7, 29]]), ramp); paw(x - 7, 30, -1, ramp); return; }
        const hx = x - 2 + ph, px = x - 1 + 2 * ph; region(sp, stroke2([[x, 22 + Y], [hx, 27], [px, 29]]), ramp); paw(px, 30, 1, ramp);
      };
      // the far legs; the tail, bushy and low (streaming behind in a leap); the body: a deep chest, the belly tucked up, the rump
      fore(17, legs[1], FAR); hind(11, legs[3], FAR);
      const tail = st ? or(line(6, 20 + Y, 3, 20 + Y, 3), line(3, 20 + Y, 1, 19 + Y, 2)) : or(line(6, 20 + Y, 4, 22 + Y + td, 3), line(4, 22 + Y + td, 2, 25 + Y + td, 2));
      region(sp, tail, FUR, { tex: (x, y) => patch(x, y) || ((x + y) % 3 === 0 ? F[1] : null) });
      region(sp, or(ell(8.5, 21 + Y, 3, 2.5), ell(13.5, 20.8 + Y, 6, 1.9), ell(19.5, 21.6 + Y, 3.3, 2.9)), FUR,
        { ball: [12, 19 + Y, 9], tex: (x, y) => patch(x, y) || ((x === 14 || x === 16) && y >= 20 + Y && y <= 21 + Y ? F[1] : null) });
      // the hackles: tufts over the shoulders, a ridge the length of the back when they are raised
      if (back) { for (let x = 11; x <= 20; x++) sp.set(x, 18 + Y, F[x % 2 ? 1 : 0]); for (let x = 13; x <= 19; x += 2) sp.set(x, 17 + Y, F[1]); }
      else for (const x of [15, 17, 19]) sp.set(x, 18 + Y, F[2]);
      fore(19, legs[0], FUR); hind(9, legs[2], FUR);
      // the neck and the head, low and forward: pricked ears (laid back snarling), a long muzzle and its nose, the jaw dropped by `jaw`
      const hx = 24 + L, hy = 21 + Y;
      region(sp, line(21, 21 + Y, hx - 1, hy, 3), FUR, { tex: patch });
      region(sp, ell(hx, hy, 2.3, 1.8), FUR, { ball: [hx - 1, hy - 1, 2.3] });
      if (back) { region(sp, rect(hx - 2, hy - 2, hx - 1, hy - 2), FAR, { flat: 2 }); sp.set(hx - 3, hy - 2, F[1]); }
      else { sp.set(hx - 2, hy - 3, F[1]); sp.set(hx - 2, hy - 2, F[1]); sp.set(hx - 1, hy - 3, F[3]); sp.set(hx - 1, hy - 2, F[2]); sp.set(hx, hy - 2, F[2]); }
      region(sp, rect(hx + 3, hy, hx + 4, hy + 1), FUR, { tex: (x, y) => y === hy ? F[3] : null });                     // the muzzle
      sp.set(hx + 5, hy, OUT);                                                                                         // the nose
      region(sp, rect(hx, hy + 2 + jaw, hx + 4, hy + 2 + jaw), FUR, { flat: 0 });                                          // the jaw
      if (jaw) { for (let x = hx + 1; x <= hx + 4; x++) for (let y = hy + 2; y < hy + 2 + jaw; y++) sp.set(x, y, GUM); sp.set(hx + 4, hy + 2, TUSK[1]); sp.set(hx + 3, hy + 1 + jaw, TUSK[1]); if (P.froth) sp.set(hx + 1, hy + 2 + jaw, FROTH); }
      else sp.set(hx + 3, hy + 1, TUSK[1]);
      sp.set(hx + 1, hy - 1, P.flinch ? F[1] : EYE);
      tip = [hx + 4, hy + 2];
    } else if (drawing === "down") {
      // facing the camera: the shoulders wide behind the head, the head low in front with its pricked ears (laid back snarling), a pale
      // ridge down the muzzle to the nose, the narrow chest and the fore legs (the hind legs hidden behind them); of a pair of legs the
      // one swung further forward is lifted a pixel
      const lift = k => legs[k] > legs[k ^ 1] ? 1 : 0, hy = 22 + Y + (P.lunge > 0 ? 1 : 0), st = P.stretch;
      // leaping, the hind legs push off behind and the fore paws reach out at us, spread
      if (st) { region(sp, or(rect(14, 26 + Y, 14, 29), rect(17, 26 + Y, 17, 29)), FAR); paw(13, 30, 0, FAR); paw(17, 30, 0, FAR); }
      region(sp, ell(15.5, 21 + Y, 5.5, 2), FUR, { ball: [13.5, 20 + Y, 5.5], tex: patch });
      region(sp, ell(15.5, 24.5 + Y, 3, 2), FUR, { ball: [14.5, 23.5 + Y, 3], tex: patch });
      if (st) { region(sp, or(line(13, 25 + Y, 11, 27, 2), line(18, 25 + Y, 20, 27, 2)), FUR); paw(10, 28, 0, FUR); paw(20, 28, 0, FUR); }
      else { region(sp, or(rect(13, 26 + Y, 14, 29 - lift(0)), rect(17, 26 + Y, 18, 29 - lift(1))), FUR); paw(13, 30 - lift(0), -1, FUR); paw(17, 30 - lift(1), 0, FUR); }
      if (back) region(sp, or(rect(11, hy - 2, 12, hy - 2), rect(19, hy - 2, 20, hy - 2)), FAR, { flat: 2 });
      else for (const [x, y, c] of [[12, -4, 3], [12, -3, 2], [13, -3, 1], [19, -4, 2], [19, -3, 1], [18, -3, 1]]) sp.set(x, hy + y, F[c]);
      region(sp, or(ell(15.5, hy, 3.4, 2.3), rect(12, hy - 1, 19, hy)), FUR, { ball: [14.5, hy - 1, 3.4] });
      for (let y = hy - 2; y <= hy; y++) { sp.set(15, y, F[3]); sp.set(16, y, F[2]); }                               // the muzzle's ridge
      sp.set(15, hy + 1, OUT); sp.set(16, hy + 1, OUT);                                                              // the nose
      region(sp, rect(14, hy + 2 + jaw, 17, hy + 2 + jaw), FUR, { flat: 0 });                                          // the jaw
      if (jaw) { for (let x = 14; x <= 17; x++) for (let y = hy + 2; y < hy + 2 + jaw; y++) sp.set(x, y, GUM); sp.set(14, hy + 2, TUSK[1]); sp.set(17, hy + 2, TUSK[1]); if (P.froth) sp.set(16, hy + 2 + jaw, FROTH); }
      else { sp.set(14, hy + 1, TUSK[1]); sp.set(17, hy + 1, TUSK[1]); }
      sp.set(14, hy - 1, P.flinch ? F[1] : EYE); sp.set(17, hy - 1, P.flinch ? F[1] : EYE);
      tip = [15, hy + 2];
    } else {
      // from behind: the head and its ears beyond the shoulders, the haunches, the hocks and the tail hanging between them
      const lift = k => legs[k] > legs[k ^ 1] ? 1 : 0, st = P.stretch;
      if (back) region(sp, or(rect(11, 19 + Y, 12, 19 + Y), rect(19, 19 + Y, 20, 19 + Y)), FAR, { flat: 1 });
      else for (const [x, y, c] of [[12, 18, 2], [12, 19, 1], [13, 19, 1], [19, 18, 1], [19, 19, 1], [18, 19, 0]]) sp.set(x, y + Y, F[c]);
      region(sp, or(ell(15.5, 20.4 + Y, 3, 1.3), ell(15.5, 21.2 + Y, 5, 1.6)), FAR, { ball: [14, 20 + Y, 5] });
      // leaping, the hind legs splay back at us to push off and the tail streams up behind
      if (st) { region(sp, or(line(12, 25 + Y, 10, 29, 2), line(18, 25 + Y, 20, 29, 2)), FUR); paw(9, 30, 0, FUR); paw(20, 30, 1, FUR); }
      else { region(sp, or(rect(12, 26 + Y, 13, 29 - lift(3)), rect(18, 26 + Y, 19, 29 - lift(2))), FUR); paw(11, 30 - lift(3), 1, FUR); paw(18, 30 - lift(2), 1, FUR); }
      region(sp, or(ell(13, 23.5 + Y, 2.6, 2.8), ell(18, 23.5 + Y, 2.6, 2.8)), FUR, { ball: [12.5, 22 + Y, 4], tex: patch });
      const tb = Math.min(29, 27 + Y + (td ? 1 : 0)), t0 = st ? 17 + Y : 21 + Y, t1 = st ? 22 + Y : tb;
      region(sp, or(rect(15, t0, 16, t1), rect(14, t0 + 1, 17, t1 - 1)), FUR, { tex: (x, y) => y === (st ? t0 : tb) ? F[3] : (x + y) % 3 === 0 ? F[1] : null });
      tip = [15, 20 + Y];
    }
    outline(sp);
    sp.tip = tip;
    return sp;
  }
  function wolfPose(anim, i) {
    if (anim === "walk") return { legs: [[1, 0, -1, 0], [0, -1, 0, 1], [-1, 0, 1, 0], [0, 1, 0, -1]][i % 4], bob: i % 2 };
    if (anim === "run") return { legs: [[2, 1, -2, -1], [0, -1, -1, 0], [-2, -1, 2, 1], [-1, 0, 1, 0]][i % 4], bob: i % 2, jaw: 1, froth: i % 2 === 0 };
    if (anim === "wind") return { crouch: 2, jaw: 2, froth: true, hackles: true, legs: [-1, -1, 1, 1] };
    if (anim === "leap") return { stretch: true, jaw: 2, lunge: 1, hackles: true };
    if (anim === "strike") return { jaw: 3, lunge: 2, legs: [1, 1, 0, 0], froth: true, hackles: true };
    if (anim === "recover") return { crouch: 1, jaw: 1, legs: [0, 1, 0, 1] };
    if (anim === "hit" || anim === "stone") return { flinch: true, crouch: 1, tailDown: true, lunge: -1, hackles: true };
    if (anim === "reel") return { flinch: true, crouch: 2, tailDown: true, lunge: -2, hackles: true };   // (design pass 38) its poise broken: flat on its belly, back on its haunches
    return { bob: i % 2, jaw: i % 2 ? 1 : 0, froth: i % 2 === 1 };   // idle: panting
  }

  // ================================================================== design pass 27 (the Keep): Gorvash the troll wizard, the hex bat and
  // the troll burster, ported from docs/design/27-the-keep.sketch.js as they were drawn there (the sketch's helpers it needs are above:
  // poly, dith and clamp are its own; darkOf is this file's dark; the five ramps are the pass's: the wizard's plum robe, the Green Hand's
  // fire, his grey beard, the bats' fur and wings)
  R.robe = ["#3e2731", "#68386c", "#b55088", "#f6757a"]; R.hex = ["#265c42", "#3e8948", "#63c74d", "#b4e67a", "#ffffff"];
  R.beard = ["#3a4466", "#5a6988", "#8b9bb4", "#c0cbdc"]; R.fur = ["#181425", "#3e2731", "#68386c", "#b55088"]; R.wing = ["#181425", "#3a4466", "#5a6988", "#8b9bb4"];
  const HEXEYE = "#b4e67a", TAU = Math.PI * 2, darkOf = dark, clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const dith = (x, y, a) => BAYER[((y & 3) << 2) | (x & 3)] < a * 16;
  function poly(pts) {
    return (x, y) => { const px = x + 0.5, py = y + 0.5; let inside = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside; } return inside; };
  }
  const HEXF = R.hex;
  function hexstone(sp, cx, cy, glow, big) {
    // the crystal: a diamond 3 wide and 5 tall (5 x 7 when blazing), white at its heart when it glows
    const w = big ? 2.6 : 1.7, h = big ? 3.6 : 2.6;
    region(sp, (x, y) => Math.abs(x - cx) / w + Math.abs(y - cy) / h <= 1.0, [HEXF[1], HEXF[2], HEXF[3], HEXF[4]], { ball: [cx - 0.5, cy - 1, w + 1] });
    sp.set(cx, cy, glow ? HEXF[4] : HEXF[3]); if (big) { sp.set(cx, cy - 1, HEXF[4]); sp.set(cx - 1, cy, HEXF[3]); }
  }
  function claw(sp, cx, cy) {
    // the iron claw round the crystal's foot: three prongs
    for (const [dx, dy] of [[-2, 1], [-2, 0], [2, 1], [2, 0], [0, 3], [-1, 3], [1, 3], [-1, 2], [1, 2]]) sp.set(cx + dx, cy + dy, R.iron[(dx + dy) & 1 ? 1 : 2]);
    sp.set(cx - 2, cy - 1, R.iron[3]); sp.set(cx + 2, cy - 1, R.iron[1]);
  }
  function staffShaft(sp, x0, y0, x1, y1) {
    // a gnarled black staff: 2 px, its knots lit; its butt kept a row above the cell's bottom, so the outline closes it (the feet's row)
    y0 = Math.min(y0, sp.N - 3); y1 = Math.min(y1, sp.N - 3);
    region(sp, line(x0, y0, x1, y1, 2), ["#181425", "#2a1d28", "#3e2731", "#733e39"], { tex: (x, y) => hash(x, y, 31) < 0.12 ? "#733e39" : null });
  }
  function crown(sp, cx, top, side) {
    // a band of bone round the brow with a green stone, and antler tines rising (side: swept back)
    region(sp, rect(cx - 3, top + 4, cx + 3, top + 5), R.bone, { tex: (x, y) => (x + y) % 3 === 0 ? R.bone[1] : null });
    sp.set(cx, top + 4, HEXF[2]); sp.set(cx, top + 5, HEXF[1]);
    const tines = side ? [[[cx - 2, top + 4], [cx - 4, top + 1], [cx - 6, top]], [[cx + 1, top + 4], [cx, top]], [[cx + 3, top + 4], [cx + 4, top + 1]]]
                       : [[[cx - 3, top + 4], [cx - 5, top + 1], [cx - 7, top + 1]], [[cx - 1, top + 4], [cx - 2, top]], [[cx + 1, top + 4], [cx + 2, top]], [[cx + 3, top + 4], [cx + 5, top + 1], [cx + 7, top + 1]]];
    for (const t of tines) for (let k = 0; k + 1 < t.length; k++) region(sp, line(t[k][0], t[k][1], t[k + 1][0], t[k + 1][1], 1), R.bone, { flat: k ? 3 : 2 });
  }
  function greenHand(sp, fx, fy, open, glow, dir) {
    // the green hand: a palm and four splayed fingers toward dir (1 right, -1 left, 0 up)
    const G = glow ? [HEXF[1], HEXF[2], HEXF[3], HEXF[4]] : [HEXF[0], HEXF[1], HEXF[2], HEXF[3]];
    region(sp, ell(fx, fy, 1.8, 1.6), G, { ball: [fx - 1, fy - 1, 2] });
    if (!open) return;
    const F = dir === 0 ? [[-2, -3], [-1, -4], [1, -4], [2, -3]] : [[3 * dir, -2], [4 * dir, -1], [4 * dir, 1], [3 * dir, 2]];
    for (const [dx, dy] of F) { sp.set(fx + Math.sign(dx) * Math.min(1, Math.abs(dx)) + (dir ? 0 : 0), fy + (dir ? 0 : -1), G[2]); region(sp, line(fx + Math.sign(dx), fy + Math.sign(dy) * (dir === 0 ? 1 : 0), fx + dx, fy + dy, 1), G, { flat: 2 }); sp.set(fx + dx, fy + dy, G[3]); }
  }
  // the green hand the trolls daub on everything they take, here as his own sign: a palm, four fingers and a thumb, 8 x 7
  const HANDPRINT = [".#.#.#..", ".#.#.#.#", ".#######", "########", ".#######", "..#####.", "..####.."];
  const inHand = (hx, hy) => hy >= 0 && hy < HANDPRINT.length && hx >= 0 && hx < 8 && HANDPRINT[hy][hx] === "#";
  // the robe's cloth: the green trim at the hem, folds falling from the belt (a dark line and its lit edge every 5 px)
  function robeTex(x, y, c, belt, slant) {
    if (y >= 42 && y <= 43) return HEXF[(x >> 1) % 2 ? 0 : 1];
    if (y > belt + 2 && y < 42) { const f = (x + Math.floor((y - belt) * slant)) % 5; if (f === 0) return R.robe[0]; if (f === 1 && c !== R.robe[0]) return R.robe[2]; }
    return null;
  }
  function wizardBody(drawing, P) {
    const N = 48, sp = new Grid(N), S = R.nature, B = (P.bob || 0) + (P.kneel ? P.kneel * 3 : 0), glow = P.glow ? 1 : 0, step = P.step || 0;
    const staff = P.staff || "rest", hand = P.hand || "hide", kneel = P.kneel || 0;
    let tip = null;
    if (drawing === "side") {
      const X = P.lean || 0, sway = step;
      // the staff behind the near arm when planted at rest; its crystal is the tip of a cast
      const SP = { rest: [[33, 46], [34, 6]], raise: [[30, 30], [36, 5]], forward: [[26, 27], [42, 13]], plant: [[33, 46], [33, 7]], wide: [[38, 44], [42, 8]], down: [[40, 46], [30, 40]], jab: [[24, 26], [41, 22]] }[staff] || [[33, 46], [34, 6]];
      const [[bx, by], [cx, cy]] = SP.map(([x, y]) => [x + (staff === "down" ? 0 : X), y + (staff === "rest" || staff === "plant" || staff === "down" ? 0 : B)]);   // (a dropped staff lies on the ground, whatever the kneel)
      const drawStaff = () => { staffShaft(sp, bx, by, cx, cy + 3); claw(sp, cx, cy); hexstone(sp, cx, cy, glow || staff === "raise", staff === "raise"); tip = [cx, cy]; };
      if (staff === "rest" || staff === "plant" || staff === "wide") drawStaff();
      // the feet under the hem: bare green toes, the far one a step darker
      if (!kneel) { region(sp, rect(18 + sway, 45, 21 + sway, 46), darkOf(S)); region(sp, rect(25 - sway, 45, 29 - sway, 46), S, { ball: [26, 45, 3] }); }
      // the robe: hunched, an A-line to the floor, its hem ragged; the hump of the back high behind the head
      const k = kneel ? 4 : 0;
      const robe = poly([[16 + X, 13 + B], [12 + X, 17 + B], [10 + X, 25 + B], [10 + k, 33 + B / 2 + k], [11 - sway + k, 45], [31 + sway, 45], [29 + X, 33 + B], [27 + X, 22 + B], [25 + X, 16 + B], [21 + X, 13 + B]]);
      region(sp, (x, y) => robe(x, y) && !(y === 45 && (x + sway) % 3 === 0), R.robe, { ball: [15 + X, 18 + B, 14], tex: (x, y, c) => robeTex(x, y, c, 30 + B, 0.15) });
      // the green stole hanging down the front from the shoulder, fringed at its end
      region(sp, (x, y) => robe(x, y) && y >= 17 + B && y <= 39 && x >= 25 + X + Math.floor((y - 17 - B) / 8) && x <= 26 + X + Math.floor((y - 17 - B) / 8) && !(y === 39 && x % 2), HEXF, { tex: (x, y) => x === 25 + X + Math.floor((y - 17 - B) / 8) ? HEXF[2] : HEXF[0] });
      // the rope belt and its trinkets: a little skull and a bone
      region(sp, rect(13 + X, 30 + B, 27 + X, 30 + B), R.leather, { flat: 3, tex: (x) => x % 2 ? R.leather[2] : null });
      region(sp, rect(22 + X, 31 + B, 23 + X, 33 + B), R.bone, { flat: 2 }); sp.set(22 + X, 32 + B, OUT);
      // the green hand thrust out (the rune rings' wind), raised (the ward), flung wide (the nova), or hanging in its sleeve
      if (hand === "point") { region(sp, line(22 + X, 19 + B, 33 + X, 19 + B, 3), R.robe, { flat: 2, cast: R.robe[0] }); limb(sp, 31 + X, 19 + B, 37 + X, 19 + B, [HEXF[0], HEXF[1], HEXF[2], HEXF[3]], 1.6, 2); greenHand(sp, 39 + X, 19 + B, true, true, 1); tip = [41 + X, 19 + B]; }
      else if (hand === "up") { region(sp, line(22 + X, 20 + B, 28 + X, 12 + B, 3), R.robe, { flat: 2 }); limb(sp, 28 + X, 12 + B, 30 + X, 6 + B, [HEXF[0], HEXF[1], HEXF[2], HEXF[3]], 1.6, 2); greenHand(sp, 30 + X, 4 + B, true, true, 0); }
      else if (hand === "wide") { region(sp, line(16 + X, 18 + B, 8 + X, 14 + B, 3), R.robe, { flat: 1 }); greenHand(sp, 6 + X, 13 + B, true, true, -1); }
      else if (hand === "down") { region(sp, line(22 + X, 20 + B, 23 + X, 30 + B, 3), R.robe, { flat: 1 }); greenHand(sp, 23 + X, 32 + B, false, glow, 1); }
      // the head, low and forward: a long skull, the ear swept back, the hooked nose, a tusk, the eye glowing green
      const hx = X + (P.head ? P.head[0] : 0), hy = B + (P.head ? P.head[1] : 0) + (kneel ? 1 : 0);
      region(sp, ell(25 + hx, 14 + hy, 4.4, 3.8), S, { ball: [24 + hx, 13 + hy, 4.4], cast: S[0] });
      region(sp, line(21 + hx, 12 + hy, 17 + hx, 10 + hy, 2), S, { flat: 1 });                      // the ear
      region(sp, poly([[28 + hx, 13 + hy], [32 + hx, 15 + hy], [31 + hx, 17 + hy], [29 + hx, 16 + hy]]), S, { flat: 2 });   // the nose
      sp.set(31 + hx, 16 + hy, S[1]); sp.set(27 + hx, 17 + hy, TUSK[1]); sp.set(27 + hx, 18 + hy, TUSK[0]);
      sp.set(27 + hx, 13 + hy, P.flinch ? S[0] : HEXEYE); sp.set(26 + hx, 13 + hy, S[0]);
      // the beard: braided grey to the belt, a bone bead
      region(sp, poly([[23 + hx, 17 + hy], [28 + hx, 17 + hy], [27 + hx, 23 + hy], [26 + hx, 28 + hy], [24 + hx, 29 + hy], [24 + hx, 22 + hy]]), R.beard, { ball: [24 + hx, 19 + hy, 6], tex: (x, y) => (y + x) % 3 === 0 ? R.beard[1] : null });
      sp.set(25 + hx, 25 + hy, R.bone[3]); sp.set(25 + hx, 26 + hy, R.bone[1]);
      crown(sp, 25 + hx, 5 + hy, true);
      // the staff held before the body (raised, thrust, jabbing, dropped) and the near hand on it
      if (staff === "raise" || staff === "forward" || staff === "jab" || staff === "down") drawStaff();
      const grip = staff === "raise" ? [32 + X, 18 + B] : staff === "forward" ? [31 + X, 22 + B] : staff === "jab" ? [30 + X, 24 + B] : staff === "down" ? null : staff === "wide" ? [37 + X, 22 + B] : [32 + X, 24 + B];
      if (grip) { region(sp, line(24 + X, 18 + B, grip[0] - 1, grip[1], 3), R.robe, { flat: 2, cast: R.robe[0] }); region(sp, ell(grip[0], grip[1], 1.7, 1.6), S, { ball: [grip[0] - 1, grip[1] - 1, 2] }); }
      if (P.smoke) smokeOver(sp, P.smoke);
    } else {
      const up = drawing === "up", m = x => up ? 47 - x : x, X = 0;
      // the staff in the troll's right hand (our left facing the camera), planted or raised; the crystal its tip
      const SD = { rest: [[11, 46], [11, 6]], plant: [[11, 46], [11, 6]], raise: [[13, 30], [13, 5]], forward: [[13, 30], [13, 4]], wide: [[5, 44], [4, 10]], down: [[6, 46], [16, 42]], jab: [[13, 30], [13, 4]] }[staff] || [[11, 46], [11, 6]];
      const [[bx, by], [cx, cy]] = SD.map(([x, y]) => [m(x), y + (staff === "rest" || staff === "plant" || staff === "down" ? 0 : B)]);
      const drawStaff = () => { staffShaft(sp, bx, by, cx, cy + 3); claw(sp, cx, cy); hexstone(sp, cx, cy, glow || staff === "raise", staff === "raise"); tip = [cx, cy]; };
      if (up) drawStaff();
      if (!kneel) { region(sp, rect(18 - step, 45, 21 - step, 46), darkOf(S)); region(sp, rect(26 + step, 45, 29 + step, 46), S, { ball: [27, 45, 3] }); }
      const k = kneel ? 3 : 0;
      const robe = poly([[17, 14 + B], [13, 18 + B], [12, 28 + B], [10 - k, 45], [37 + k, 45], [35, 28 + B], [34, 18 + B], [30, 14 + B]]);
      region(sp, (x, y) => robe(x, y) && !(y === 45 && x % 3 === 0), R.robe, { ball: [18, 18 + B, 15], tex: (x, y, c) => {
        if (up && inHand(x - 20, y - (21 + B))) return HAND[(x + y) & 1 ? 0 : 1];                   // the green hand, his sign, big on the back
        return robeTex(x, y, c, 30 + B, 0);
      } });
      // facing us, the green stole: two bands from the shoulders to the knees, fringed
      if (!up) region(sp, (x, y) => robe(x, y) && y >= 18 + B && y <= 39 && (x === 16 || x === 17 || x === 30 || x === 31) && !(y === 39 && x % 2), HEXF, { tex: (x) => x === 16 || x === 30 ? HEXF[2] : HEXF[0] });
      region(sp, rect(14, 30 + B, 33, 30 + B), R.leather, { flat: 3, tex: (x) => x % 2 ? R.leather[2] : null });
      if (!up) { region(sp, rect(27, 31 + B, 28, 33 + B), R.bone, { flat: 2 }); sp.set(27, 32 + B, OUT); }
      // the shoulders, hunched up round the head
      region(sp, ell(23.5, 16 + B, 10, 3.6), R.robe, { ball: [20, 15 + B, 10], cast: R.robe[0] });
      // the green hand: hanging at the troll's left (our right facing the camera), raised for the ward, flung wide, or pointed at us
      const L = x => m(x);
      if (hand === "point") { region(sp, line(L(32), 18 + B, L(36), 23 + B, 3), R.robe, { flat: 2 }); greenHand(sp, L(37), 25 + B, true, true, up ? -1 : 1); tip = [L(38), 25 + B]; }
      else if (hand === "up") { region(sp, line(L(32), 17 + B, L(36), 9 + B, 3), R.robe, { flat: 2 }); limb(sp, L(36), 9 + B, L(37), 5 + B, [HEXF[0], HEXF[1], HEXF[2], HEXF[3]], 1.6, 2); greenHand(sp, L(37), 3 + B, true, true, 0); }
      else if (hand === "wide") { region(sp, line(L(32), 17 + B, L(39), 14 + B, 3), R.robe, { flat: 2 }); greenHand(sp, L(41), 13 + B, true, true, up ? -1 : 1); }
      else { region(sp, line(L(33), 18 + B, L(35), 28 + B, 3), R.robe, { flat: 1 }); limb(sp, L(35), 27 + B, L(35), 31 + B, [HEXF[0], HEXF[1], HEXF[2], HEXF[3]], 1.6, 2); greenHand(sp, L(35), 32 + B, false, glow, 1); }
      // the head between the shoulders: ears drooping out, the crown
      const hy = B + (P.head ? P.head[1] : 0) + (kneel ? 1 : 0);
      region(sp, ell(23.5, 12 + hy, 4.4, 4), S, { ball: [22.5, 11 + hy, 4.4], cast: S[0] });
      region(sp, or(line(19, 12 + hy, 15, 15 + hy, 2), line(28, 12 + hy, 32, 15 + hy, 2)), S, { flat: 1 });
      if (!up) {
        sp.set(21, 11 + hy, P.flinch ? S[0] : HEXEYE); sp.set(26, 11 + hy, P.flinch ? S[0] : HEXEYE);
        region(sp, rect(23, 12 + hy, 24, 14 + hy), S, { flat: 2 }); sp.set(23, 15 + hy, S[0]); sp.set(24, 15 + hy, S[0]);
        sp.set(21, 15 + hy, TUSK[1]); sp.set(26, 15 + hy, TUSK[1]);
        // the beard: wide under the tusks, falling to two braids with bone beads
        region(sp, or(poly([[19, 16 + hy], [28, 16 + hy], [26, 23 + hy], [21, 23 + hy]]), rect(23, 23 + hy, 24, 31 + hy)), R.beard, { ball: [21, 18 + hy, 6], tex: (x, y) => (y + x) % 3 === 0 ? R.beard[1] : null });
        sp.set(23, 27 + hy, R.bone[3]); sp.set(24, 27 + hy, R.bone[1]); sp.set(23, 30 + hy, R.bone[2]);
      }
      crown(sp, 23.5, 3 + hy, false);
      if (!up) drawStaff();
      // the near hand on the staff
      if (staff !== "down" && staff !== "wide") { const gy = staff === "raise" ? 18 + B : 24 + B; region(sp, line(m(15), 17 + B, m(12), gy, 3), R.robe, { flat: 2, cast: R.robe[0] }); region(sp, ell(m(12), gy, 1.7, 1.6), S, { ball: [m(12) - 1, gy - 1, 2] }); }
      if (P.smoke) smokeOver(sp, P.smoke);
    }
    outline(sp);
    sp.tip = tip;
    return sp;
  }
  // the blink: green smoke eats the body from the hem up (s 1 to 3), leaving the eyes and the crystal last
  function smokeOver(sp, s) {
    const W = sp.N, H = sp.N, keep = new Set([HEXEYE, HEXF[3], HEXF[4]]);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = sp.get(x, y); if (!c) continue;
      const frac = (H - y) / H, eat = s / 3 * 1.25 - frac;   // the lower part first
      if (eat > 0 && !keep.has(c)) sp.set(x, y, dith(x, y, Math.min(1, eat * 2.2)) ? (hash(x, y, 41) < 0.5 ? HEXF[1] : HEXF[2]) : (dith(x + 1, y, Math.min(1, eat * 1.6)) ? null : c));
    }
    if (s >= 3) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = sp.get(x, y); if (c && !keep.has(c) && hash(x, y, 42) < 0.55) sp.set(x, y, null); }
  }
  function wizardPose(anim, i) {
    const g = i % 2;
    if (anim === "walk") return { step: [1, 0, -1, 0][i % 4], bob: i % 2 ? 0 : 1, staff: "plant", hand: "down", glow: g };
    if (anim === "cast" || anim === "wind") return { lean: -1, staff: "raise", hand: "down", glow: 1 };              // the hexbolts' wind: the staff high, the crystal blazing
    if (anim === "point") return { lean: 1, staff: "plant", hand: "point", glow: 1 };              // the rune rings' wind: the green hand thrust out
    if (anim === "strike") return { lean: 1, staff: "forward", hand: "down", glow: 1 };            // the loose
    if (anim === "jab") return { lean: 2, staff: "jab", hand: "down", glow: 0 };                   // the staff's jab
    if (anim === "recover") return { lean: 0, bob: 1, staff: "plant", hand: "down", glow: 0 };
    if (anim === "nova") return { lean: 0, staff: "wide", hand: "wide", glow: 1 };                 // arms flung wide
    if (anim === "ward") return { kneel: 1, staff: "plant", hand: "up", glow: g };                 // on one knee, the green hand raised under the dome
    if (anim === "kneel") return { kneel: 2, staff: "down", hand: "down", head: [1, 3], glow: 0 };  // the ward broken: on his knees, the staff dropped
    if (anim === "blink") return { staff: "plant", hand: "down", smoke: i + 1, glow: 1 };
    if (anim === "hit" || anim === "stone") return { lean: -1, head: [-1, -1], flinch: true, staff: "plant", hand: "down" };
    return { bob: g, staff: "rest", hand: "down", glow: g };   // idle: a breath, the crystal pulsing
  }
  const WIZARD_ANIMS = { idle: 2, walk: 4, cast: 1, point: 1, strike: 1, jab: 1, recover: 1, nova: 1, ward: 2, kneel: 1, blink: 3, hit: 1, stone: 1 };

  // ================================================================== THE HEX BAT (body "bat", 32 px)
  // The wizard's familiars: small black-plum bats with slate wings, green eyes and white fangs. They fly at z 10 (the frame is drawn with
  // its bottom row at the bat's feet, lifted by its height), so the body sits low in the cell and the wings spread above and round it.
  // P: { wing (0 up, 1 level, 2 down), mouth (0, 1), swept (the swoop), folded (falling stone), flinch }
  function batWing(sp, sx, sy, dir, wing, swept, ramp) {
    // one wing from the shoulder (sx, sy) toward dir (-1 left, 1 right): three finger bones and the scalloped membrane between
    const lift = swept ? [-1, 0, 1] : [[-7, -9, -6], [-2, -3, -1], [3, 5, 6]][wing];
    const reach = swept ? [6, 8, 9] : [8, 10, 11];
    const tips = [0, 1, 2].map(k => [sx + dir * reach[k] * (swept ? 0.7 : 1), sy + lift[k] + (swept ? 4 + k : 0)]);
    const wrist = [sx + dir * 3, sy - (swept ? 0 : wing === 0 ? 4 : wing === 1 ? 1 : -1)];
    const pts = [[sx, sy], wrist, tips[0], [wrist[0] + dir * 4, wrist[1] + 2], tips[1], [wrist[0] + dir * 5, wrist[1] + 4], tips[2], [sx + dir * 2, sy + 3]];
    region(sp, poly(pts.map(([x, y]) => [x + 0.5, y + 0.5])), ramp, { ball: [sx + dir * 4, sy - 3, 7], tex: (x, y, c) => hash(x, y, 51) < 0.08 ? ramp[0] : null });
    for (const t of tips) region(sp, line(wrist[0], wrist[1], t[0], t[1], 1), R.wing, { flat: 3 });
    region(sp, line(sx, sy, wrist[0], wrist[1], 1), R.wing, { flat: 3 });
  }
  // the rows of a cell moved down n (a bat's body, drawn low, brought to the cell's bottom row: its feet stand there as every kind's)
  function dropRows(sp, n) { const N = sp.N, px = new Array(N * N).fill(null); for (let y = 0; y + n < N; y++) for (let x = 0; x < N; x++) px[(y + n) * N + x] = sp.px[y * N + x]; sp.px = px; }
  function batBody(drawing, P) {
    const N = 32, sp = new Grid(N), wing = P.wing === undefined ? 1 : P.wing, F = R.fur;
    let tip = null;
    if (P.folded) {
      // a stone bat falling: wings wrapped round the body
      region(sp, ell(16, 26, 3.5, 4.5), R.wing, { ball: [15, 24, 4] }); region(sp, ell(16, 22, 2.2, 2), F, { ball: [15, 21, 2] });
      sp.set(15, 20, F[2]); sp.set(17, 20, F[2]);
      dropRows(sp, 1); outline(sp); sp.tip = [16, 24]; return sp;
    }
    if (drawing === "side") {
      // facing right: the far wing behind, darker, the near wing over the body; the head turned right with its ears back
      batWing(sp, 15, 24, -1, wing, P.swept, darkOf(R.wing));
      region(sp, ell(15.5, 25, 3.4, 2.4), F, { ball: [14.5, 24, 3.4], tex: (x, y) => (x + y) % 3 === 0 ? F[1] : null });
      region(sp, ell(19.5, 23.5, 2.2, 2), F, { ball: [19, 23, 2.2] });
      sp.set(18, 21, F[3]); sp.set(19, 20, F[2]); sp.set(18, 20, F[1]); sp.set(20, 21, F[2]);       // the ears
      sp.set(20, 23, P.flinch ? F[1] : HEXEYE); sp.set(21, 24, F[2]);
      if (P.mouth) { sp.set(21, 25, "#a22633"); sp.set(22, 25, TUSK[1]); sp.set(21, 26, TUSK[1]); } else sp.set(21, 25, TUSK[1]);
      batWing(sp, 16, 24, 1, wing, P.swept, R.wing);
      region(sp, or(rect(14, 27, 14, 28), rect(16, 27, 16, 28)), F, { flat: 1 });                       // the feet tucked
      tip = [22, 25];
    } else {
      const up = drawing === "up";
      batWing(sp, 14, 24, -1, wing, P.swept, up ? R.wing : R.wing);
      batWing(sp, 17, 24, 1, wing, P.swept, R.wing);
      region(sp, ell(15.5, 25, 2.6, 3.2), F, { ball: [14.5, 24, 3], tex: (x, y) => (x + y) % 3 === 0 ? F[1] : null });
      region(sp, ell(15.5, 21.5, 2.4, 2), F, { ball: [14.5, 21, 2.4] });
      sp.set(13, 19, F[2]); sp.set(13, 18, F[3]); sp.set(18, 19, F[2]); sp.set(18, 18, F[3]); sp.set(14, 19, F[1]); sp.set(17, 19, F[1]);
      if (!up) {
        sp.set(14, 21, P.flinch ? F[1] : HEXEYE); sp.set(17, 21, P.flinch ? F[1] : HEXEYE); sp.set(15, 22, F[3]); sp.set(16, 22, F[3]);
        if (P.mouth) { sp.set(15, 23, "#a22633"); sp.set(16, 23, "#a22633"); sp.set(14, 23, TUSK[1]); sp.set(17, 23, TUSK[1]); } else { sp.set(14, 23, TUSK[1]); sp.set(17, 23, TUSK[1]); }
      }
      region(sp, or(rect(14, 28, 14, 29), rect(17, 28, 17, 29)), F, { flat: 1 });
      tip = [15, 23];
    }
    dropRows(sp, 2); if (tip) tip = [tip[0], tip[1] + 2];
    outline(sp);
    sp.tip = tip;
    return sp;
  }
  function batPose(anim, i) {
    if (anim === "fly") return { wing: [0, 1, 2, 1][i % 4] };
    if (anim === "wind") return { wing: 0, mouth: 1 };
    if (anim === "strike") return { swept: true, mouth: 1 };
    if (anim === "recover") return { wing: 2 };
    if (anim === "hit") return { wing: 1, flinch: true };
    if (anim === "reel") return { wing: 2, flinch: true };   // (design pass 38) pinned or broken: the wings up, flinching
    if (anim === "stone") return { folded: true };
    return { wing: [0, 1, 2, 1][i % 4] };
  }
  const BAT_ANIMS = { idle: 4, fly: 4, wind: 1, strike: 1, recover: 1, hit: 1, stone: 1 };

  // ================================================================== THE TROLL BURSTER (body "burster", 32 px)
  // A troll the wizard has filled with his green fire until it eats him from the inside: a swollen belly held in two rusty iron hoops,
  // glowing through black cracks, a manic grin, the skin gone dark and sickly (the brutes' darker green), arms out, clawing. Its fuse is
  // four frames: the belly swells by a pixel a frame, the cracks spread and brighten, the last frame white at the heart.
  // P: { step, bob, lean, swell (0..3), glow (0..4: how lit the cracks are), arms (reach | back | up), flinch, smoke }
  // the cracks: five jagged lines out from the heart of the belly, longer and brighter as the fuse burns (lit 0: dark seams)
  const CRACKS = [[-0.9, 3], [-0.15, 4], [0.7, 3], [1.6, 4], [2.5, 3], [3.6, 4], [4.6, 3]];
  function onCrack(x, y, cx, cy, r, lit) {
    const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy); if (d > r - 0.8) return false;
    if (d < 1.2 + lit * 0.5) return true;   // the heart
    const a = Math.atan2(dy, dx);
    for (const [a0, len] of CRACKS) { const reach = Math.min(r - 1, len + lit); if (d > reach) continue; const jag = a0 + Math.sin(d * 1.7 + a0 * 3) * 0.22; let da = Math.abs(((a - jag) + 3 * Math.PI) % (2 * Math.PI) - Math.PI); if (da * d < 0.75) return true; }
    return false;
  }
  function belly(sp, cx, cy, r, glow, front) {
    const G = HEXF, lit = glow || 0;
    region(sp, ell(cx, cy, r, r * 0.95), R.nature, { ball: [cx - 1.5, cy - 1.5, r], tex: (x, y) => {
      if (onCrack(x, y, cx, cy, r, lit)) { const d = Math.hypot(x - cx, y - cy); return lit === 0 ? OUT : G[clamp(Math.round(1 + lit - d / 3), 1, 4)]; }
      return null; } });
    // the two iron hoops round it, rusted in spots
    for (const dy of [-Math.round(r * 0.5), Math.round(r * 0.55)]) for (let x = Math.round(cx - r); x <= Math.round(cx + r); x++) { const yy = Math.round(cy + dy), inside = ((x - cx) ** 2) / (r * r) + ((yy - cy) ** 2) / (r * r * 0.9) <= 1.0; if (inside) sp.set(x, yy, hash(x, yy, 63) < 0.18 ? "#be4a2f" : R.iron[x < cx - 1 ? 3 : x < cx + 2 ? 2 : 1]); }
  }
  function bursterBody(drawing, P) {
    const N = 32, sp = new Grid(N), S = R.nature, B = P.bob || 0, step = P.step || 0, sw = P.swell || 0, glow = P.glow || 0, arms = P.arms || "reach";
    let tip = null;
    if (drawing === "side") {
      const X = P.lean || 0, back = step > 0 ? -2 : step < 0 ? 2 : 0, fwd = -back;
      // the far arm reaching, a step darker
      const far = arms === "up" ? [[12, 15], [10, 7]] : arms === "back" ? [[12, 16], [6, 20]] : [[15, 16], [24, 17]];
      limb(sp, far[0][0] + X, far[0][1] + B, far[1][0] + X, far[1][1] + B, darkOf(S), 2, 2);
      // the legs, short and bowed
      region(sp, rect(11 + back, 25, 13 + back, 29), darkOf(S)); region(sp, rect(10 + back, 30, 14 + back, 30), darkOf(S));
      region(sp, rect(16 + fwd, 25, 18 + fwd, 29), S); region(sp, rect(16 + fwd, 30, 20 + fwd, 30), S, { ball: [17 + fwd, 30, 3] });
      // the leather loincloth under the belly
      region(sp, rect(11 + X, 24 + B, 19 + X, 26 + B), R.leather, { tex: (x) => x % 2 ? R.leather[1] : null });
      // the hunched shoulders running into the neck, then the swollen belly in its hoops below them
      region(sp, or(ell(15 + X, 13.5 + B, 5.5, 3.6), line(17 + X, 12 + B, 20 + X, 12 + B, 3)), S, { ball: [13 + X, 12 + B, 6] });
      belly(sp, 15 + X, 19 + B - Math.floor(sw / 2), 5.5 + sw, glow, true);
      tip = [15 + X, 19 + B - Math.floor(sw / 2)];
      // the head thrust forward: a wide grinning mouth of crooked teeth, the eyes wide and yellow
      const hx = X + (P.head ? P.head[0] : 0), hy = B + (P.head ? P.head[1] : 0);
      region(sp, ell(20.5 + hx, 11 + hy, 3.6, 3.2), S, { ball: [20 + hx, 10 + hy, 3.6], cast: S[0] });
      region(sp, rect(22 + hx, 12 + hy, 24 + hx, 13 + hy), S, { flat: 2 });
      for (let x = 19; x <= 23; x++) sp.set(x + hx, 13 + hy, x % 2 ? TUSK[1] : OUT);
      sp.set(22 + hx, 10 + hy, P.flinch ? S[0] : EYE); sp.set(21 + hx, 10 + hy, P.flinch ? S[0] : "#ffffff");
      region(sp, line(17 + hx, 9 + hy, 15 + hx, 7 + hy, 1), S, { flat: 1 });                        // the ear
      if (P.smoke) for (const [dx, dy] of [[0, 0], [1, -1], [2, -2], [1, -3], [3, -3]].slice(0, 2 + P.smoke)) sp.set(24 + hx + dx, 12 + hy + dy, HEXF[(dx + dy) & 1 ? 1 : 2]);
      // the near arm, clawing ahead (or flung back as it runs)
      const near = arms === "up" ? [[17, 15], [19, 7]] : arms === "back" ? [[14, 17], [8, 22]] : [[17, 16], [26, 19]];
      limb(sp, near[0][0] + X, near[0][1] + B, near[1][0] + X, near[1][1] + B, S, 2, 2);
      for (const [dx, dy] of [[1, -1], [1, 1], [2, 0]]) sp.set(near[1][0] + X + dx * (near[1][0] > near[0][0] ? 1 : -1), near[1][1] + B + dy, TUSK[1]);
    } else {
      const up = drawing === "up", lA = step > 0 ? -1 : 0, lB = step < 0 ? -1 : 0;
      region(sp, rect(11, 25 + lA, 13, 29 + lA), S); region(sp, rect(10, 30 + lA, 14, 30 + lA), S);
      region(sp, rect(18, 25 + lB, 20, 29 + lB), S); region(sp, rect(17, 30 + lB, 21, 30 + lB), S);
      region(sp, rect(10, 24 + B, 21, 26 + B), R.leather, { tex: (x) => x % 2 ? R.leather[1] : null });
      const armY = arms === "up" ? -9 : arms === "back" ? 4 : 2;
      limb(sp, 9, 15 + B, 4, 15 + B + armY, S, 2, 2); limb(sp, 22, 15 + B, 27, 15 + B + armY, S, 2, 2);
      if (up) region(sp, ell(15.5, 14 + B, 6, 4), S, { ball: [14, 13 + B, 6] });
      belly(sp, 15.5, 19 + B - Math.floor(sw / 2), 5.8 + sw, up ? Math.max(0, glow - 1) : glow, !up);
      tip = [15, 19 + B - Math.floor(sw / 2)];
      const hy = B + (P.head ? P.head[1] : 0);
      region(sp, ell(15.5, 10 + hy, 3.8, 3.4), S, { ball: [14.5, 9 + hy, 3.8], cast: S[0] });
      region(sp, or(line(12, 9 + hy, 9, 7 + hy, 1), line(19, 9 + hy, 22, 7 + hy, 1)), S, { flat: 1 });
      if (!up) {
        sp.set(13, 9 + hy, P.flinch ? S[0] : EYE); sp.set(18, 9 + hy, P.flinch ? S[0] : EYE);
        for (let x = 13; x <= 18; x++) sp.set(x, 12 + hy, x % 2 ? TUSK[1] : OUT);
        if (P.smoke) for (const [dx, dy] of [[0, 0], [-1, -1], [1, -2], [0, -3]].slice(0, 1 + P.smoke)) sp.set(16 + dx, 13 + hy + 1 + dy - 4, HEXF[(dx + dy) & 1 ? 1 : 2]);
      }
    }
    outline(sp);
    sp.tip = tip;
    return sp;
  }
  function bursterPose(anim, i) {
    if (anim === "walk") return { step: [1, 0, -1, 0][i % 4], bob: i % 2 ? 0 : 1, arms: "reach", glow: 1 };
    if (anim === "run") return { step: [2, 0, -2, 0][i % 4], bob: i % 2 ? 0 : 1, lean: 1, arms: "back", glow: 1 };
    if (anim === "fuse" || anim === "wind") return { swell: i, glow: 1 + i, arms: "up", smoke: 1 + (i >> 1), lean: 0 };
    if (anim === "hit" || anim === "stone") return { flinch: true, lean: -1, head: [-1, -1], arms: "back", glow: 1 };   // (the stone frame is the hit pose in stone, as every kind's)
    if (anim === "reel") return { flinch: true, lean: -2, head: [-2, -1], arms: "back", glow: 1 };   // (design pass 38) its poise broken: further back
    return { bob: i % 2, arms: "reach", glow: 1 };
  }
  const BURSTER_ANIMS = { idle: 2, walk: 4, run: 4, fuse: 4, hit: 1, stone: 1 };



  // ================================================================== design pass 44 (card t112): THE TROLL KING, body "king" on a 96 px cell
  // Ported verbatim from the pass's sketch, docs/design/44-the-troll-king.sketch.js (its helpers kept with it: the sketch's Grid is sized,
  // its region shades the same way; the King's palette is his own), so the built frames equal the sketch's pixel for pixel
  // (tools/test-render.js proves it). Two drawings (the front, the three-quarter toward his facing; away draws the three-quarter: he is
  // never seen from behind), 24 animations, his face for the talk box, and his end (the freeze's cracks, the burst into his own pixels)
  const KING = (function () {
    const OUT = "#181425";
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const TAU = Math.PI * 2;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    // the ramps: ENDESGA 32 (the house's), with the Things' stone, oak and iron. The King's own: his skin (the brutes' dark troll green),
    // his robe (crimson, a step darker than the knight's tabard so the two never read as one), the ermine of his mantle, the gold of his
    // crown and sceptre, and the Ember's light in five steps from banked to white
    const R = {
      skin: ["#193c3e", "#265c42", "#3e8948", "#63c74d"], robe: ["#3e2731", "#a22633", "#e43b44", "#f6757a"],
      ermine: ["#8b9bb4", "#c0cbdc", "#ffffff", "#ffffff"], gold: ["#733e39", "#be4a2f", "#feae34", "#fee761"],
      iron: ["#262b44", "#3a4466", "#5a6988", "#8b9bb4"], stone: ["#4a4450", "#6e6a70", "#9a948c", "#c4bcae"],
      oak: ["#3e2731", "#733e39", "#b86f50", "#e4a672"], dark: ["#181425", "#262b44", "#3a4466", "#5a6988"],
      marble: ["#1d1a26", "#262233", "#302b40", "#3a344c"], granite: ["#2c2838", "#3e3a4a", "#555064", "#6e6a78"],
      blue: ["#0b2f55", "#124e89", "#0099db", "#2ce8f5"], burnt: ["#2a1d28", "#3e2731", "#733e39", "#be4a2f"]
    };
    const EMBER = ["#be4a2f", "#f77622", "#feae34", "#fee761", "#ffffff"];   // banked, low, lit, bright, white
    const TUSK = ["#c28569", "#e8b796", "#ead4aa"];
    const GEM = { red: ["#a22633", "#e43b44"], blue: ["#124e89", "#0099db"] };

    // ------------------------------------------------------------------ hashes, noise, dither (never Math.random)
    function hash(x, y, k) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul((k | 0) + 1, 2246822519)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
    const smooth = t => t * t * (3 - 2 * t);
    function vnoise(x, y, s, k) {
      const gx = Math.floor(x / s), gy = Math.floor(y / s), fx = smooth(x / s - gx), fy = smooth(y / s - gy);
      const a = hash(gx, gy, k), b = hash(gx + 1, gy, k), c = hash(gx, gy + 1, k), d = hash(gx + 1, gy + 1, k);
      return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
    }
    const dith = (x, y, a) => BAYER[((y & 3) << 2) | (x & 3)] < a * 16;

    // ------------------------------------------------------------------ a sized painter (the renderer's way, on any W x H)
    function Grid(W, H) { this.W = W; this.H = H || W; this.N = W; this.px = new Array(this.W * this.H).fill(null); }
    Grid.prototype.get = function (x, y) { return x >= 0 && y >= 0 && x < this.W && y < this.H ? this.px[y * this.W + x] : null; };
    Grid.prototype.set = function (x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.W && y < this.H) this.px[y * this.W + x] = c; };
    const rect = (x0, y0, x1, y1) => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
    const ell = (cx, cy, rx, ry) => (x, y) => ((x - cx) ** 2) / (rx * rx) + ((y - cy) ** 2) / (ry * ry) <= 1.02;
    const or = (...f) => (x, y) => f.some(g => g(x, y));
    const and = (...f) => (x, y) => f.every(g => g(x, y));
    const not = f => (x, y) => !f(x, y);
    function poly(pts) {
      return (x, y) => { const px = x + 0.5, py = y + 0.5; let inside = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside; } return inside; };
    }
    function line(x0, y0, x1, y1, w) {
      const s = new Set(), n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 + 1, a = -((w - 1) >> 1), b = w >> 1;
      for (let i = 0; i <= n; i++) { const t = i / n, x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t); for (let dx = a; dx <= b; dx++) for (let dy = a; dy <= b; dy++) s.add((x + dx) + "," + (y + dy)); }
      return (x, y) => s.has(x + "," + y);
    }
    // a region lit from the top left (proto/trolls.js region): o.ball shades a round mass, else the edges; o.spec the ramp's glint, o.flat
    // one tone, o.tex a texture, o.cast a 1 px shadow down and right onto what is behind
    function region(sp, pred, ramp, o) {
      o = o || {}; const W = sp.W, H = sp.H, m = (x, y) => x >= 0 && y >= 0 && x < W && y < H && pred(x, y);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m(x, y)) {
        const ul = !m(x - 1, y) || !m(x, y - 1), dr = !m(x + 1, y) || !m(x, y + 1);
        let t;
        if (o.ball) { const v = ((x - o.ball[0]) + (y - o.ball[1])) / (2 * o.ball[2]); t = v < -0.2 ? 2 : v < 0.55 ? 1 : 0; if (dr && t === 1 && v > 0.25) t = 0; }
        else t = ul && dr ? 1 : dr ? 0 : ul ? 2 : 1;
        let c = ramp[t];
        if (o.spec && o.spec(x, y)) c = ramp[3];
        if (o.flat !== undefined) c = ramp[o.flat];
        if (o.tex) c = o.tex(x, y, c) || c;
        sp.set(x, y, c);
      }
      if (o.cast) for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) if (!m(x, y) && sp.get(x, y) && sp.get(x, y) !== OUT && (m(x - 1, y) || m(x, y - 1) || m(x - 1, y - 1))) sp.set(x, y, o.cast);
    }
    function outline(sp) { const W = sp.W, H = sp.H, add = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!sp.get(x, y) && (sp.get(x - 1, y) || sp.get(x + 1, y) || sp.get(x, y - 1) || sp.get(x, y + 1))) add.push([x, y]); for (const [x, y] of add) sp.set(x, y, OUT); }
    const darkOf = r => [r[0], r[0], r[1], r[2]];
    function limb(sp, sx, sy, fx, fy, ramp, fr, w) { region(sp, line(sx, sy, fx, fy, w || 3), ramp, { cast: ramp[0] }); region(sp, ell(fx, fy, fr || 2.3, (fr || 2.3) * 0.9), ramp, { ball: [fx - 1, fy - 1, (fr || 2.3) + 0.5], cast: ramp[0] }); }
    const inCell = (v, r, N) => Math.max(r + 1, Math.min(N - 2 - r, v));

    // ================================================================== THE TROLL KING (body "king", 96 px)
    // A troll twice a brute's height and three times his breadth, gone fat and grand on what he took: a crown of five gold points too small
    // for his skull, an ermine mantle over a hump of shoulder, a crimson robe open on his chest, gold bracers and a gold belt with a crown
    // for a buckle, and the old lords' sceptre, a gold staff as tall as he is whose head is a gold crown cradling a shard of yellow light.
    // The Legend Ember is in him: pressed into his breastbone, a white heart in a ring of cracked, burnt flesh, and from it yellow veins run
    // under the green skin to his arms, his throat and the corners of his eyes, pulsing with it. His eyes are the Ember's yellow.
    // P: { bob, step (-1..1), lean, crouch (px lower), kneel (0 or 1), seat, staff (plant | raise | over | sweepL | sweepR | level | out |
    //      both | drop | back), arm (hang | fist | wide | reach | up | grip), head ([dx, dy]), mouth (0 | 1 | 2), glow (0..3), flinch, puff }
    // glow: 0 the veins banked (the kneel, the stone), 1 lit, 2 bright (a beam, the Wrath), 3 white-hot (the Ember King, phase 3)
    const VEINS = [["#3e2731", "#733e39"], ["#be4a2f", "#f77622"], ["#f77622", "#feae34"], ["#feae34", "#fee761"]];
    const HEART = [["#733e39", "#be4a2f", "#f77622"], ["#f77622", "#feae34", "#fee761"], ["#feae34", "#fee761", "#ffffff"], ["#fee761", "#ffffff", "#ffffff"]];
    const EYES = [["#f77622", "#feae34"], ["#fee761", "#ffffff"], ["#fee761", "#ffffff"], ["#ffffff", "#ffffff"]];
    // the veins: polylines in the front drawing's coordinates from the Ember outward (the side drawing shifts them), each point [x, y]
    const VEIN_FRONT = [
      [[48, 54], [46, 50], [45, 47], [44, 45]], [[48, 54], [51, 50], [52, 47], [53, 45]],                     // up the throat
      [[48, 54], [43, 53], [39, 51], [36, 49]], [[48, 54], [53, 53], [57, 51], [60, 49]],                     // out to the shoulders
      [[48, 54], [46, 59], [44, 63], [45, 67]], [[48, 54], [51, 58], [53, 62], [52, 67]],                     // down the belly
      [[48, 54], [42, 57], [39, 61]], [[48, 54], [55, 57], [58, 61]]
    ];
    function veinsOn(sp, lines, dx, dy, glow, skinOK) {
      const V = VEINS[glow];
      for (const L of lines) for (let k = 0; k + 1 < L.length; k++) {
        const [x0, y0] = L[k], [x1, y1] = L[k + 1], n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        for (let i = 0; i <= n; i++) { const x = Math.round(x0 + (x1 - x0) * i / n) + dx, y = Math.round(y0 + (y1 - y0) * i / n) + dy; if (skinOK(sp.get(x, y))) sp.set(x, y, k === 0 && i < n / 2 ? V[1] : V[(x + y) & 1 ? 0 : 1]); }
      }
    }
    const isSkin = c => R.skin.includes(c);
    // the Ember in his breastbone: a crater of burnt flesh (r 4), its cracks, the ring of light and the heart (3 px, white at glow 2 and 3)
    function ember(sp, cx, cy, glow, big) {
      const H = HEART[glow], r = big ? 4.6 : 3.8;
      region(sp, ell(cx, cy, r, r * 0.95), R.burnt, { ball: [cx + 1, cy + 1, r] });
      for (const [dx, dy] of [[-5, -1], [-4, 3], [4, -3], [5, 2], [0, -5], [1, 5], [-3, -4], [3, 4]]) if (isSkin(sp.get(cx + dx, cy + dy))) sp.set(cx + dx, cy + dy, R.burnt[1]);
      region(sp, ell(cx, cy, r - 1.4, (r - 1.4) * 0.95), [H[0], H[1], H[1], H[2]], { ball: [cx - 0.5, cy - 0.5, r - 1.4] });
      region(sp, ell(cx, cy, big ? 1.6 : 1.1, big ? 1.6 : 1.1), [H[2], H[2], H[2], H[2]]);
      sp.set(cx, cy, glow >= 2 ? "#ffffff" : H[2]);
    }
    // the crown: a gold band with three gems and five points (the middle tallest), set a pixel askew because his skull is too big for it
    function crown(sp, cx, top, side, tilt, turned) {
      const w = side ? 6 : 9, w1 = turned ? 6 : w, t = tilt || 0;   // (revision 1) turned: the band runs cx - 9 to cx + 6, foreshortened toward the facing
      region(sp, (x, y) => x >= cx - w && x <= cx + w1 && y >= top + 6 + (x > cx ? t : 0) && y <= top + 9 + (x > cx ? t : 0), R.gold, { tex: (x, y) => y === top + 6 + (x > cx ? t : 0) ? R.gold[3] : null });
      const pts = side ? [[-6, 3], [-2, 1], [2, 0], [6, 2]] : turned ? [[-9, 3], [-5, 1], [-1, -1], [3, 1], [6, 3]] : [[-9, 3], [-5, 1], [0, -1], [5, 1], [9, 3]];
      for (const [px, py] of pts) {
        const x = cx + px, yb = top + 6 + (x > cx ? t : 0), y0 = top + py + (x > cx ? t : 0);
        region(sp, poly([[x - 1.6, yb + 0.5], [x + 0.5, y0], [x + 2.6, yb + 0.5]]), R.gold, { tex: (xx, yy) => xx <= x ? R.gold[3] : null });
        sp.set(x, y0 - 1, R.gold[3]);
      }
      if (turned) { sp.set(cx - 5, top + 8, GEM.blue[1]); sp.set(cx - 1, top + 8, GEM.red[1]); sp.set(cx + 3, top + 8 + t, GEM.blue[1]); sp.set(cx - 1, top + 7, "#f6757a"); }
      else if (!side) { sp.set(cx - 5, top + 8, GEM.blue[1]); sp.set(cx, top + 8 + 0, GEM.red[1]); sp.set(cx + 5, top + 8 + t, GEM.blue[1]); sp.set(cx, top + 7, "#f6757a"); }
      else { sp.set(cx - 2, top + 8, GEM.red[1]); sp.set(cx + 3, top + 8 + t, GEM.blue[1]); }
    }
    // the sceptre: a gold shaft 3 px wide with a grip of leather, and its head, a gold crown (a cup with four points) holding the shard
    function sceptre(sp, bx, by, hx, hy, glow, P) {
      region(sp, line(bx, by, hx, hy, 3), R.gold, { tex: (x, y) => (Math.round(x * 0.7 + y) % 9 === 0) ? R.gold[1] : null });
      // the head: a cup of gold under the shard, its points, the shard of light (the tip, where the beams come out)
      const dx = hx - bx, dy = hy - by, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, px = -uy, py = ux;
      const at = (a, b) => [hx + ux * a + px * b, hy + uy * a + py * b];
      region(sp, poly([at(-1, -4.5), at(-1, 4.5), at(4, 3.4), at(4, -3.4)]), R.gold, { ball: [hx - 1, hy - 1, 5] });
      for (const b of [-4, -1.4, 1.4, 4]) { const [x, y] = at(6.2, b); region(sp, line(...at(3, b * 0.9), x, y, 1), R.gold, { flat: 3 }); }
      const [sx, sy] = at(5, 0), E = HEART[clamp(glow + 1, 0, 3)];
      region(sp, ell(sx, sy, 2.1, 2.1), [E[0], E[1], E[1], E[2]], { ball: [sx - 0.5, sy - 0.5, 2.1] });
      sp.set(sx, sy, glow >= 1 ? E[2] : E[1]);
      return [Math.round(sx), Math.round(sy)];
    }
    function fist(sp, x, y, ramp, r) { region(sp, ell(x, y, r || 3.6, (r || 3.6) * 0.92), ramp, { ball: [x - 1, y - 1, (r || 3.6) + 0.5], cast: ramp[0] }); }
    function bracer(sp, x0, y0, x1, y1) { region(sp, line(x0, y0, x1, y1, 9), R.gold, { tex: (x, y) => (x + y) % 4 === 0 ? R.gold[3] : null }); }
    // an arm: the upper arm from the shoulder, the forearm to the fist, a gold bracer above the wrist; ramp the skin (dark on the far side)
    function arm(sp, sx, sy, ex, ey, fx, fy, ramp, glow, veins) {
      region(sp, line(sx, sy, ex, ey, 11), ramp, { cast: ramp[0] });
      region(sp, line(ex, ey, fx, fy, 10), ramp, { cast: ramp[0] });
      const bx = ex + (fx - ex) * 0.62, by = ey + (fy - ey) * 0.62, cx = ex + (fx - ex) * 0.82, cy = ey + (fy - ey) * 0.82;
      bracer(sp, Math.round(bx), Math.round(by), Math.round(cx), Math.round(cy));
      fist(sp, fx, fy, ramp, 5.6);
      if (veins) veinsOn(sp, [[[sx, sy + 2], [ex + 1, ey], [Math.round(bx), Math.round(by) - 1]]], 0, 0, glow, isSkin);
    }
    // the head from the front: a broad skull under a heavy brow, small deep eyes (the Ember's yellow), a wide nose, an underbite with two
    // great tusks, long ears drooping out; P.mouth 1 talks, 2 roars; the veins reach the corners of his eyes
    function headFront(sp, cx, cy, P, glow) {
      const S = R.skin, m = P.mouth || 0;
      region(sp, or(line(cx - 12, cy - 2, cx - 19, cy + 2, 3), line(cx + 12, cy - 2, cx + 19, cy + 2, 3)), S, { flat: 1 });   // the ears, long and drooping
      sp.set(cx - 19, cy + 3, S[0]); sp.set(cx + 19, cy + 3, S[0]); sp.set(cx - 18, cy + 3, S[1]); sp.set(cx + 18, cy + 3, S[1]);
      region(sp, ell(cx, cy - 3, 12, 9.5), S, { ball: [cx - 3, cy - 6, 12], cast: S[0] });                                        // the skull
      const jw = m === 2 ? 3 : m ? 1 : 0;
      region(sp, poly([[cx - 13, cy], [cx + 13, cy], [cx + 12, cy + 12 + jw], [cx + 8, cy + 14 + jw], [cx - 8, cy + 14 + jw], [cx - 12, cy + 12 + jw]]), S, { ball: [cx - 4, cy + 3, 13] });   // the great jaw
      for (let x = cx - 10; x <= cx + 10; x++) { sp.set(x, cy - 6, S[0]); if (Math.abs(x - cx) > 1) sp.set(x, cy - 7, S[2]); }       // the brow ridge
      sp.set(cx - 1, cy - 8, S[0]); sp.set(cx + 1, cy - 8, S[0]); sp.set(cx, cy - 9, S[0]);                                      // a scowl
      const E = EYES[glow];
      if (P.flinch) { for (const x of [cx - 7, cx - 6, cx - 5, cx + 5, cx + 6, cx + 7]) sp.set(x, cy - 4, S[0]); }
      else {
        for (const [x, c] of [[cx - 7, 0], [cx - 6, 1], [cx - 5, 0], [cx + 5, 0], [cx + 6, 1], [cx + 7, 0]]) sp.set(x, cy - 4, E[c]);
        for (const x of [cx - 6, cx + 6]) { sp.set(x, cy - 5, E[0]); sp.set(x, cy - 3, S[0]); }
        if (glow >= 2) for (const [x, y] of [[cx - 8, cy - 4], [cx - 4, cy - 4], [cx + 4, cy - 4], [cx + 8, cy - 4], [cx - 6, cy - 6], [cx + 6, cy - 6]]) if (isSkin(sp.get(x, y))) sp.set(x, y, "#feae34");
        if (glow >= 3) for (const [x, y] of [[cx - 8, cy - 3], [cx - 9, cy - 2], [cx + 8, cy - 3], [cx + 9, cy - 2], [cx - 9, cy - 1], [cx + 9, cy - 1]]) sp.set(x, y, "#fee761");   // light running from them
      }
      region(sp, poly([[cx - 2, cy - 4], [cx + 2, cy - 4], [cx + 4, cy + 1], [cx - 4, cy + 1]]), S, { spec: (x, y) => x === cx - 2 && y === cy - 3 });   // the nose
      sp.set(cx - 2, cy + 1, S[0]); sp.set(cx + 2, cy + 1, S[0]);
      // the mouth: an underbite, open to the gullet when he talks or roars, a row of teeth along the lower lip
      const my = cy + 5;
      if (m) { region(sp, rect(cx - 8, my, cx + 8, my + 1 + jw), ["#2a1d28", "#2a1d28", "#3e2731", "#3e2731"]); for (let x = cx - 7; x <= cx + 7; x += 2) sp.set(x, my + 1 + jw, TUSK[2]); }
      else { for (let x = cx - 9; x <= cx + 9; x++) sp.set(x, my, S[0]); for (let x = cx - 6; x <= cx + 6; x += 3) sp.set(x, my - 1, TUSK[1]); }
      // the tusks: two great ivory tusks up from the jaw past the lip, lit on their left
      for (const s2 of [-1, 1]) { const tx = cx + s2 * 9, ty = my + 4 + jw; region(sp, poly([[tx - 2, ty], [tx + 2, ty], [tx + s2 * 1.2 + 0.6, my - 6], [tx + s2 * 1.2 - 0.6, my - 6]]), TUSK, { tex: (x) => x <= tx + s2 * 0.6 - 0.5 ? TUSK[2] : TUSK[1] }); sp.set(tx + s2, ty - 1, TUSK[0]); }
      // warts, and the veins up his throat into the corners of his eyes
      sp.set(cx - 9, cy + 8, S[1]); sp.set(cx + 10, cy - 1, S[1]); sp.set(cx + 4, cy + 11, S[1]);
      const V = VEINS[glow];
      for (const [x, y] of [[cx - 8, cy - 2], [cx - 9, cy - 1], [cx - 9, cy], [cx - 10, cy + 1], [cx + 8, cy - 2], [cx + 9, cy - 1], [cx + 10, cy], [cx - 4, cy + 10], [cx - 5, cy + 11], [cx - 5, cy + 12], [cx + 4, cy + 9], [cx + 5, cy + 10], [cx - 3, cy - 10]]) if (isSkin(sp.get(x, y))) sp.set(x, y, V[(x + y) & 1]);
    }
    // (revision 1) the head turned three-quarter toward his facing (right): the skull and the jaw turned, the near ear (his right) long and
    // drooping, the far one only a tip behind the skull, both yellow eyes (the far one by the nose), the hooked nose and the far tusk breaking
    // the cheek's line toward the facing; P.mouth 1 talks, 2 roars; the veins reach the corners of his eyes as from the front
    function headThree(sp, cx, cy, P, glow) {
      const S = R.skin, m = P.mouth || 0, jw = m === 2 ? 3 : m ? 1 : 0;
      region(sp, line(cx - 11, cy - 2, cx - 19, cy + 3, 3), S, { flat: 1 });                                                       // the near ear, long and drooping
      sp.set(cx - 19, cy + 4, S[0]); sp.set(cx - 18, cy + 4, S[1]);
      region(sp, ell(cx - 1, cy - 3, 12, 9.5), S, { ball: [cx - 4, cy - 6, 12], cast: S[0] });                                     // the skull
      region(sp, poly([[cx - 10, cy], [cx + 13, cy - 2], [cx + 16, cy + 9 + jw], [cx + 12, cy + 14 + jw], [cx - 4, cy + 14 + jw], [cx - 9, cy + 12 + jw]]), S, { ball: [cx - 1, cy + 3, 13] });   // the jaw, turned: its far corner juts toward the facing
      for (let x = cx - 8; x <= cx + 13; x++) { sp.set(x, cy - 6, S[0]); if (x > cx - 7 && x < cx + 12) sp.set(x, cy - 7, S[2]); }  // the brow ridge
      sp.set(cx + 3, cy - 8, S[0]); sp.set(cx + 5, cy - 8, S[0]); sp.set(cx + 4, cy - 9, S[0]);                                    // a scowl over the nose
      const E = EYES[glow];
      if (P.flinch) { for (const x of [cx - 4, cx - 3, cx - 2, cx + 8, cx + 9]) sp.set(x, cy - 4, S[0]); }
      else {
        for (const [x, c] of [[cx - 4, 0], [cx - 3, 1], [cx - 2, 0], [cx + 8, 1], [cx + 9, 0]]) sp.set(x, cy - 4, E[c]);           // the near eye (3 px) and the far one by the nose (2 px)
        sp.set(cx - 3, cy - 5, E[0]); sp.set(cx + 8, cy - 5, E[0]); sp.set(cx - 3, cy - 3, S[0]); sp.set(cx + 9, cy - 3, S[0]);
        if (glow >= 2) for (const [x, y] of [[cx - 5, cy - 4], [cx - 1, cy - 4], [cx + 7, cy - 4], [cx + 10, cy - 4], [cx - 3, cy - 6], [cx + 8, cy - 6]]) if (isSkin(sp.get(x, y))) sp.set(x, y, "#feae34");
        if (glow >= 3) for (const [x, y] of [[cx - 5, cy - 3], [cx - 6, cy - 2], [cx - 6, cy - 1], [cx + 10, cy - 3], [cx + 11, cy - 2], [cx + 12, cy - 2]]) sp.set(x, y, "#fee761");   // light running from them
      }
      region(sp, poly([[cx + 4, cy - 5], [cx + 7, cy - 5], [cx + 15, cy + 1], [cx + 13, cy + 2], [cx + 5, cy + 2]]), S, { spec: (x, y) => x === cx + 5 && y === cy - 4 });   // the hooked nose, past the cheek
      sp.set(cx + 6, cy + 2, S[0]); sp.set(cx + 12, cy + 2, S[0]);
      const my = cy + 6;
      if (m) { region(sp, rect(cx - 4, my, cx + 13, my + 1 + jw), ["#2a1d28", "#2a1d28", "#3e2731", "#3e2731"]); for (let x = cx - 3; x <= cx + 12; x += 2) sp.set(x, my + 1 + jw, TUSK[2]); }
      else { for (let x = cx - 5; x <= cx + 14; x++) sp.set(x, my, S[0]); for (let x = cx - 2; x <= cx + 10; x += 3) sp.set(x, my - 1, TUSK[1]); }
      // the tusks: the far one (toward the facing) long, breaking the jaw's line; the near one shorter
      { const tx = cx + 12, ty = my + 4 + jw; region(sp, poly([[tx - 2, ty], [tx + 2, ty], [tx + 2.2, my - 6], [tx + 1, my - 6]]), TUSK, { tex: (x) => x <= tx + 1 ? TUSK[2] : TUSK[1] }); sp.set(tx + 1, ty - 1, TUSK[0]); }
      { const tx = cx - 4, ty = my + 4 + jw; region(sp, poly([[tx - 1.5, ty], [tx + 1.5, ty], [tx - 0.4, my - 4], [tx - 1.4, my - 4]]), TUSK, { tex: (x) => x <= tx - 1 ? TUSK[2] : TUSK[1] }); }
      sp.set(cx - 7, cy + 8, S[1]); sp.set(cx + 13, cy + 5, S[1]); sp.set(cx + 6, cy + 12, S[1]);
      const V = VEINS[glow];
      for (const [x, y] of [[cx - 5, cy - 2], [cx - 6, cy - 1], [cx - 6, cy], [cx - 7, cy + 1], [cx + 10, cy - 2], [cx + 11, cy - 1], [cx + 12, cy], [cx, cy + 11], [cx - 1, cy + 12], [cx - 1, cy + 13], [cx + 7, cy + 10], [cx + 8, cy + 11], [cx, cy - 10]]) if (isSkin(sp.get(x, y))) sp.set(x, y, V[(x + y) & 1]);
    }
    // the ermine mantle: white fur over the hump of the shoulders, black tail-tips in rows, its lower edge scalloped
    const ermineTex = (x, y, c) => ((x * 7 + y * 3) % 11 === 0 && (y % 4 === 1)) ? OUT : (y % 4 === 2 && (x * 7 + y * 3) % 11 === 0 ? R.ermine[0] : null);
    function robeTex(x, y, c, hem) { if (y >= hem - 1) return R.gold[(x >> 1) % 2 ? 2 : 3]; if ((x * 3 + y) % 13 === 0) return R.robe[0]; return null; }

    // the sceptre for each staff pose, in each drawing: [its butt, its head, the near hand's grip] (B the body's drop). From the front the
    // sceptre is in his right hand, our left. In three-quarter (revision 1: facing right; left is the mirror) it is the same hand, the one
    // nearer the camera, reaching across his front toward the facing; "back" trails it behind him, "levelHigh" raises it 45° at a target
    // above him, "high" holds it overhead in one fist (the Sunwheel's pose, from the front). "drop" lies on the floor (no grip)
    function staffOf(drawing, st, B) {
      if (drawing === "three") return ({
        plant: [[15, 94], [15, 8 + B], [16, 70 + B]], raise: [[22, 62 + B], [26, 4 + B], [23, 46 + B]], over: [[24, 34 + B], [74, 4 + B], [32, 28 + B]],
        sweepR: [[44, 62 + B], [6, 76 + B], [40, 64 + B]], sweepL: [[46, 66 + B], [90, 56 + B], [56, 64 + B]], level: [[42, 62 + B], [90, 52 + B], [56, 58 + B]],
        levelHigh: [[44, 68 + B], [80, 12 + B], [54, 54 + B]], out: [[42, 60 + B], [90, 60 + B], [56, 60 + B]], both: [[54, 94], [54, 16 + B], [52, 58 + B]],
        drop: [[8, 94], [60, 92], null], back: [[40, 60 + B], [4, 82 + B], [36, 62 + B]], slam: [[48, 62 + B], [90, 88], [54, 66 + B]], high: [[20, 60 + B], [22, 2 + B], [21, 36 + B]]
      })[st] || null;
      return ({
        plant: [[13, 94], [13, 8 + B], [14, 70 + B]], raise: [[20, 62 + B], [22, 4 + B], [21, 46 + B]], over: [[30, 42 + B], [64, 6 + B], [36, 32 + B]],
        sweepL: [[20, 70 + B], [4, 52 + B], [10, 64 + B]], sweepR: [[26, 68 + B], [90, 62 + B], [30, 66 + B]], level: [[20, 58 + B], [38, 80 + B], [24, 64 + B]],
        levelHigh: [[20, 66 + B], [26, 8 + B], [22, 50 + B]], out: [[20, 62 + B], [4, 62 + B], [12, 62 + B]], both: [[48, 94], [48, 16 + B], [42, 58 + B]],
        drop: [[6, 94], [58, 92], null], back: [[18, 64 + B], [4, 88], [14, 68 + B]], slam: [[30, 64 + B], [46, 93], [34, 68 + B]], high: [[14, 60 + B], [14, 2 + B], [14, 36 + B]]
      })[st] || null;
    }

    // Revision 1 (card t111): two drawings, the front ("down") and the three-quarter ("three", turned toward his right); there is no
    // profile and no back. The three-quarter is the front turned a quarter: the gut, the robe's open front and the Ember stay toward the
    // camera, shifted 4 px toward the facing; the face turns with them (headThree); the far arm is half behind the gut, a step darker; the
    // cape is a strip behind the near shoulder, never the slab the old side drawing showed (it read as his back). P.lean moves his upper body
    // toward the facing (three-quarter only), as it moved the old profile's
    function kingBody(drawing, P) {
      const N = 96, sp = new Grid(N), S = R.skin, glow = clamp(P.glow === undefined ? 1 : P.glow, 0, 3);
      const B = (P.bob || 0) + (P.crouch || 0) + (P.kneel ? 6 : 0) + (P.seat ? 8 : 0), st = P.staff || "plant", A = P.arm || "hang", step = P.step || 0;
      const three = drawing === "three", X = three ? (P.lean || 0) : 0, T = three ? 5 : 0;   // X the lean; T the turn: the torso's features shift toward the facing
      const hx = (P.head ? P.head[0] : 0) + X, hy = B + (P.head ? P.head[1] : 0);
      const la = step > 0 ? -1 : 0, lb = step < 0 ? -1 : 0, SD = staffOf(drawing, st, B);
      let tip = null, heart = null;
      const drawStaff = () => { if (!SD) return; const [[bx, by], [cx, cy]] = SD; tip = sceptre(sp, inCell(bx, 2, N), inCell(by, 2, N), inCell(cx, 6, N), inCell(cy, 6, N), glow, P); };
      const twoHands = st === "over" || st === "slam" || st === "both";
      // the cape behind him: from the front wider than he is, to the floor; in three-quarter only a strip behind his near shoulder (our left)
      if (three) region(sp, poly([[27 + X, 44 + B], [16 + X * 0.5, 70 + B], [9, 95], [32, 95], [31 + X, 58 + B]]), darkOf(R.robe), { tex: (x, y) => y >= 94 ? R.gold[(x >> 1) & 1 ? 2 : 3] : (Math.abs(x - 15 - (95 - y) * 0.2) < 1 && y > 60 + B ? R.robe[0] : null) });
      else region(sp, poly([[22, 44 + B], [13, 72 + B], [16, 95], [80, 95], [83, 72 + B], [74, 44 + B]]), darkOf(R.robe), { tex: (x, y) => y >= 94 ? R.gold[(x >> 1) & 1 ? 2 : 3] : ((x * 2 + y) % 11 === 0 ? R.robe[0] : null) });
      if (st === "over" || (three && (st === "back" || st === "sweepR"))) drawStaff();   // a sceptre behind him (overhead, or trailed behind) goes first
      // the legs and feet (seated: thighs toward us, feet planted wide; kneeling: one knee down); in three-quarter the far leg a step darker
      const NL = three ? 2 : 0, FL = three ? 3 : 0, farS = three ? darkOf(S) : S;
      if (P.seat) {
        region(sp, rect(26 + NL, 80, 44 + NL, 90), S, { ball: [32 + NL, 83, 9] }); region(sp, rect(52 + FL, 80, 70 + FL, 90), farS, { ball: [58 + FL, 83, 9] });
        region(sp, rect(22 + NL, 89, 42 + NL, 95), S, { ball: [28 + NL, 91, 7] }); region(sp, rect(54 + FL, 89, 74 + FL, 95), farS, { ball: [60 + FL, 91, 7] });
      } else if (P.kneel) {
        region(sp, rect(28 + NL, 86, 44 + NL, 95), S, { ball: [33 + NL, 89, 7] }); region(sp, rect(54 + FL, 82, 66 + FL, 92), farS); region(sp, rect(52 + FL, 90, 70 + FL, 95), farS, { ball: [58 + FL, 92, 6] });
      } else {
        region(sp, rect(51 + FL, 84 + lb, 66 + FL, 91 + lb), farS); region(sp, rect(50 + FL, 90 + lb, 69 + FL + (three ? 2 : 0), 95 + lb), farS, { ball: [56 + FL, 91, 8] });
        region(sp, rect(30 + NL, 84 + la, 45 + NL, 91 + la), S); region(sp, rect(27 + NL, 90 + la, 46 + NL + (three ? 3 : 0), 95 + la), S, { ball: [34 + NL, 91, 8] });
        for (const [x0, l] of [[30 + NL, la], [51 + FL, lb]]) for (let x = x0; x <= x0 + 15; x++) sp.set(x, 88 + l, (x & 1) ? R.gold[2] : R.gold[3]);
        for (const x of [29, 33, 37, 41]) sp.set(x + NL + (three ? 3 : 0), 94 + la, S[0]);
        for (const x of [53, 57, 61, 65]) sp.set(x + FL + (three ? 2 : 0), 94 + lb, S[0]);
      }
      // the robe: falling from the shoulders behind the arms to a bell at the knees, open on the chest and the belly
      const rb = 88 + (P.seat ? -6 : 0);
      region(sp, poly(three ? [[24 + X, 46 + B], [19 + X, 70 + B], [18, rb], [77, rb], [75 + X, 70 + B], [70 + X, 46 + B]] : [[24, 46 + B], [18, 70 + B], [17, rb], [79, rb], [78, 70 + B], [72, 46 + B]]),
        R.robe, { ball: [30 + X, 56 + B, 28], tex: (x, y, c) => robeTex(x, y, c, rb) });
      // the arms: the sceptre in his right hand (ours left from the front; the near hand in three-quarter); s -1 his right, 1 his left
      const SH = { near: [22 + (three ? 2 : 0) + X, 50 + B], far: [74 - (three ? 3 : 0) + X, 50 + B] };
      const farRamp = three ? darkOf(S) : S;
      const armOf = (s) => {
        if (!three) {   // the front, as pass 44 drew it, and the Sunwheel's sceptre held high
          const sx = s < 0 ? 22 : 74;
          if (s < 0 && st !== "drop") { const G = SD ? SD[2] : [14, 70 + B]; return arm(sp, sx, 50 + B, st === "high" ? sx - 8 : sx - 6, st === "high" ? 44 + B : 62 + B, G[0], G[1], S, glow, true); }
          if (st === "both") return arm(sp, sx, 50 + B, sx - 6, 62 + B, 54, 58 + B, S, glow, true);
          if (st === "over") return arm(sp, sx, 50 + B, sx - 4, 38 + B, 58, 26 + B, S, glow, true);
          if (st === "slam") return arm(sp, sx, 50 + B, sx - 8, 62 + B, 42, 72 + B, S, glow, true);
          if (A === "wide") return arm(sp, sx, 48 + B, sx + s * 12, 40 + B, sx + s * 18, 26 + B, S, glow, true);
          if (A === "reach") return arm(sp, sx, 48 + B, sx + s * 4, 32 + B, sx + s * 6, 14 + B, S, glow, true);
          if (A === "fist") return arm(sp, sx, 50 + B, sx + s * 6, 64 + B, sx + s * 2, 74 + B, S, glow, true);
          if (P.seat) return arm(sp, sx, 50 + B, sx + s * 10, 64 + B, sx + s * 12, 74 + B, S, glow, true);
          return arm(sp, sx, 50 + B, sx + s * 5, 66 + B, sx + s * 7, 82 + B, S, glow, true);
        }
        // three-quarter: the near hand (his right, our left) holds the sceptre, reaching across his front when its grip is toward the facing
        const near = s < 0, [sx, sy] = near ? SH.near : SH.far, ramp = near ? S : farRamp, out = near ? -1 : 1, G = SD && SD[2];
        if (near && G && st !== "drop") {
          const across = G[0] > sx + 6;
          const ex = across ? sx + 10 : st === "raise" || st === "high" ? sx - 6 : st === "over" ? sx + 2 : sx - 4, ey = st === "over" ? sy - 12 : st === "high" ? sy - 6 : sy + 12;
          return arm(sp, sx, sy, ex, ey, G[0], G[1], ramp, glow, true);
        }
        if (!near && twoHands && G) return st === "over" ? arm(sp, sx, sy, sx + 6, sy - 20, 58, 14 + B, ramp, glow, false) : arm(sp, sx, sy, sx - 2, sy + 12, G[0] + 6, G[1] + 2, ramp, glow, false);   // overhead: the far hand higher up the shaft, the head between the arms
        if (A === "wide") return arm(sp, sx, sy - 2, sx + out * 12, sy - 10, sx + out * 18, sy - 24, ramp, glow, near);
        if (A === "reach") return arm(sp, sx, sy - 2, sx + out * 4, sy - 18, sx + out * 6, sy - 36, ramp, glow, near);
        if (A === "fist") return arm(sp, sx, sy, sx + out * 6, sy + 14, sx + out * 2, sy + 24, ramp, glow, near);
        if (P.seat) return arm(sp, sx, sy, sx + out * 10, sy + 14, sx + out * 12, sy + 24, ramp, glow, near);
        return arm(sp, sx, sy, sx + out * 5, sy + 16, sx + out * 7 - (near ? 0 : 3), sy + 32, ramp, glow, near);
      };
      // in three-quarter the far arm hangs half behind the gut, so it goes before the gut (unless it is raised wide or on the staff)
      const farFront = !three || A === "wide" || A === "reach" || twoHands;
      if (!farFront) armOf(1);
      // the gut: a great bare round belly between the robe's gold-edged fronts, the Ember in the breastbone above it
      const gx = 48 + T + X;
      region(sp, ell(gx, 67 + B, three ? 18 : 19, 16), S, { ball: [gx - 6, 58 + B, 19] });
      region(sp, or(ell(41 + T + X, 54 + B, 8, 5), ell(55 + T + X + (three ? -1 : 0), 54 + B, three ? 7 : 8, 5)), S, { ball: [40 + T + X, 51 + B, 8] });   // the slabs of his chest
      const fl = three ? 33 + X : 31, fr = three ? 68 + X : 65;   // the robe's two front edges (in three-quarter the far one narrower)
      region(sp, or(poly([[25 + X, 48 + B], [fl + 1, 50 + B], [fl - 1, rb - 2], [22, rb - 2]]), poly([[fr + 6, 48 + B], [fr - 1, 50 + B], [fr + 1, rb - 2], [three ? 75 : 74, rb - 2]])), R.robe, { flat: 1, tex: (x, y) => {
        const l = fl - Math.round((y - 50 - B) * 0.04), r = fr + Math.round((y - 50 - B) * 0.04);
        return (x === l || x === l - 1 || x === r || x === r + 1) ? R.gold[x === l || x === r + 1 ? 3 : 2] : null; } });
      region(sp, rect(29 + T * 0.5 + X, 79 + B, 67 + T + X, 82 + B), R.gold, { tex: (x, y) => y === 79 + B ? R.gold[3] : (x % 5 === 0 ? R.gold[1] : null) });          // the belt
      const bk = 48 + T + X;
      region(sp, poly([[bk - 5, 77 + B], [bk + 5, 77 + B], [bk + 6, 84 + B], [bk - 6, 84 + B]]), R.gold, { ball: [bk - 3, 78 + B, 6] });                                   // its buckle: a crown
      for (const x of [bk - 4, bk, bk + 4]) sp.set(x, 76 + B - (x === bk ? 1 : 0), R.gold[3]); sp.set(bk, 81 + B, GEM.red[1]);
      heart = [48 + T + X, 56 + B];
      veinsOn(sp, [
        [[48, 56], [45, 52], [44, 48]], [[48, 56], [52, 52], [53, 48]], [[48, 56], [42, 55], [36, 52], [31, 51]], [[48, 56], [55, 55], [61, 52], [66, 51]],
        [[48, 56], [45, 62], [42, 68], [43, 74]], [[48, 56], [51, 61], [55, 67], [54, 74]], [[48, 56], [40, 60], [35, 66]], [[48, 56], [57, 60], [61, 66]], [[48, 56], [48, 64], [47, 72]]
      ], T + X, B, glow, isSkin);
      ember(sp, heart[0], heart[1], glow, true);
      // the mantle: ermine over the shoulders' hump, open at the throat, its edge scalloped with black tails; heavier on the near shoulder
      const mx0 = three ? 46 + X : 48, mw = three ? 31 : 33, th0 = 40 + T + X, th1 = 56 + T + X;
      region(sp, (x, y) => ell(mx0, 46 + B, mw, 10.5)(x, y) && !(x >= th0 && x <= th1 && y >= 46 + B), R.ermine, { ball: [mx0 - 12, 41 + B, 26], tex: ermineTex });
      for (let x = mx0 - mw + 3; x <= mx0 + mw - 3; x += 4) if (x < th0 || x > th1) sp.set(x, 56 + B - ((x >> 2) & 1) - Math.round(Math.abs(x - mx0) * 0.06), OUT);
      // the head, low between the shoulders and thrust forward, and the crown too small for it
      if (three) { headThree(sp, 53 + hx, 39 + hy, P, glow); crown(sp, 54 + hx, 17 + hy, false, 1, true); }
      else { headFront(sp, 48 + hx, 39 + hy, P, glow); crown(sp, 48 + hx, 17 + hy, false, 1); }
      if (farFront) armOf(1);
      armOf(-1);
      if (st !== "over" && !(three && (st === "back" || st === "sweepR"))) drawStaff();
      if (P.puff) for (let k = 0; k < 22; k++) { const a = hash(k, 3, 5) * TAU, r = 32 + hash(k, 4, 5) * 12, x = Math.round(48 + Math.cos(a) * r), y = Math.round(58 + Math.sin(a) * r * 0.8); if (x > 1 && x < 94 && y > 1 && y < 94 && !sp.get(x, y)) sp.set(x, y, EMBER[2 + (k & 1)]); }
      outline(sp);
      sp.tip = tip; sp.heart = heart;
      return sp;
    }
    // the poses: every frame the rules name (§3.6 to §3.9 of the note) and the intro's. Revision 1: the Sunwheel's spin is square to the
    // camera with the sceptre held high and the arms flung wide (the beam comes from the Ember in his chest); aimHigh and fireHigh raise the
    // sceptre at a target above him; fall and stone are gone (he no longer turns to stone: he freezes and pops, §3.11)
    function kingPose(anim, i) {
      const g = i % 2;
      switch (anim) {
        case "idle": return { bob: g, staff: "plant", arm: "hang", glow: 1 };
        case "walk": return { step: [1, 0, -1, 0][i % 4], bob: i % 2 ? 0 : 1, staff: "plant", arm: "hang" };
        case "seat": return { seat: 1, staff: "plant", arm: "hang", mouth: g, head: [0, 1] };                 // slumped on the throne, muttering
        case "rise": return { crouch: 5, staff: "plant", arm: "fist", mouth: 1 };
        case "roar": return { staff: "plant", arm: "wide", mouth: 2, head: [0, -1], glow: 2 };
        case "sweepWind": return { lean: -2, staff: "sweepR", arm: "fist", glow: 1 };                        // the staff drawn back across him
        case "sweep": return { lean: 3, staff: "sweepL", arm: "fist", glow: 1 };                             // swept out
        case "gavelWind": return { lean: -2, crouch: -1, staff: "over", arm: "grip", head: [0, -2], glow: 2 };   // overhead in both hands
        case "gavel": return { lean: 3, crouch: 4, staff: "slam", arm: "grip", mouth: 2, glow: 2 };         // slammed down in front
        case "chargeWind": return { lean: 4, crouch: 4, staff: "back", arm: "fist", head: [3, 3], glow: 1 };   // head down, the staff trailed
        case "charge": return { lean: 5, crouch: 3, step: [1, -1][g], staff: "back", arm: "fist", head: [3, 3], mouth: 2 };
        case "stomp": return { bob: g ? 0 : -2, step: g ? 0 : 1, staff: "plant", arm: "fist", mouth: g ? 2 : 0 };
        case "crouch": return { crouch: 7, staff: "plant", arm: "fist", glow: 1 };
        case "air": return { crouch: -6, staff: "over", arm: "grip", mouth: 2, glow: 2 };
        case "land": return { crouch: 8, staff: "slam", arm: "grip", mouth: 2, glow: 2 };
        case "aim": return { lean: 1, staff: "level", arm: "fist", glow: 2 };                                // the sceptre levelled
        case "fire": return { lean: -1, staff: "level", arm: "fist", mouth: 2, glow: 3 };                    // the beam out of it
        case "aimHigh": return { lean: 1, staff: "levelHigh", arm: "fist", head: [0, -1], glow: 2 };         // raised at a target above him
        case "fireHigh": return { lean: -1, staff: "levelHigh", arm: "fist", head: [0, -1], mouth: 2, glow: 3 };
        case "spin": return { staff: "high", arm: "wide", mouth: 2, head: [0, -1], glow: 3 };               // square to us, the beam from his chest
        case "nova": return [{ crouch: 4, staff: "plant", arm: "fist", head: [0, 2], glow: 2 }, { crouch: 2, staff: "plant", arm: "wide", mouth: 1, glow: 3, puff: 1 }, { crouch: 0, staff: "plant", arm: "wide", mouth: 2, head: [0, -2], glow: 3, puff: 1 }][i % 3];
        case "kneel": return { kneel: 1, staff: "plant", arm: "hang", head: [0, 3], glow: 0 };              // spent: the Ember banked
        case "reel": return { lean: -4, staff: "plant", arm: "hang", head: [-2, 1], flinch: true, glow: 0 };
        case "hit": return { lean: -2, staff: "plant", arm: "hang", flinch: true };
      }
      return { bob: g, staff: "plant", arm: "hang" };
    }
    const KING_ANIMS = { idle: 2, walk: 4, seat: 2, rise: 1, roar: 1, sweepWind: 1, sweep: 1, gavelWind: 1, gavel: 1, chargeWind: 1, charge: 2, stomp: 2, crouch: 1, air: 1, land: 1, aim: 1, fire: 1, aimHigh: 1, fireHigh: 1, spin: 1, nova: 3, kneel: 1, reel: 1, hit: 1 };

    // ------------------------------------------------------------------ frames: trolls.js's interface (left is the three-quarter mirrored)
    // Revision 1: there is no back. "away" draws the three-quarter (the page asks for his last side instead: the facing rule, §3.6), so no
    // path through the code shows his back
    const DRAWING = { right: ["three", false], left: ["three", true], away: ["three", false], toward: ["down", false] };
    const LUM = c => { const v = [1, 3, 5].map(k => parseInt(c.slice(k, k + 2), 16)); return 0.299 * v[0] + 0.587 * v[1] + 0.114 * v[2]; };
    const toStone = c => R.stone[LUM(c) < 70 ? 0 : LUM(c) < 115 ? 1 : LUM(c) < 165 ? 2 : 3];
    const cache = new Map();
    // o.glow overrides the pose's (the page pulses it with the Ember's beat: 1 and 2 by turns, 3 in phase 3, 0 when spent)
    function frame(facing, anim, i, o) {
      o = o || {};
      if (!DRAWING[facing]) facing = "right";
      if (!KING_ANIMS[anim]) anim = "idle";
      i = (i | 0) % KING_ANIMS[anim];
      const key = facing + "|" + anim + "|" + i + "|" + (o.glow === undefined ? "" : o.glow);
      if (cache.has(key)) return cache.get(key);
      const P = Object.assign({}, kingPose(anim, i)); if (o.glow !== undefined && anim !== "kneel") P.glow = Math.max(P.glow === undefined ? 1 : P.glow, o.glow);
      const [drawing, flip] = DRAWING[facing], sp = kingBody(drawing, P), N = 96;
      let px = sp.px.slice(), tip = sp.tip ? sp.tip.slice() : null, heart = sp.heart ? sp.heart.slice() : null;
      if (flip) { const q = new Array(N * N).fill(null); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) q[y * N + (N - 1 - x)] = px[y * N + x]; px = q; if (tip) tip = [N - 1 - tip[0], tip[1]]; if (heart) heart = [N - 1 - heart[0], heart[1]]; }
      const out = { px, N, w: N, h: N, facing, anim, i, tip, heart };
      cache.set(key, out);
      return out;
    }


    // ------------------------------------------------------------------ his face for the talk box: a 32 x 32 crop of the front frame
    // (the head, the crown's band and the tusks), drawn with the glow and the mouth of the line he is saying; the talk box shows it at
    // Lessons.faceSize for a 32 crop (about 72 CSS px), as it shows Grycus's 16 x 16
    function face(glow, mouth) {
      const sp = kingBody("down", { staff: "none", arm: "hang", glow: glow === undefined ? 1 : glow, mouth: mouth || 0 }), out = [];
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) out.push(sp.get(32 + x, 18 + y) || null);
      return { px: out, w: 32, h: 32 };
    }

    // ================================================================== the end (revision 1, §3.11): he freezes, he pops, the Ember is taken
    // freeze(fr, step, white): his frame held rigid as he died in it, the Ember's light cracking through him: twelve jagged cracks from his
    // heart, step 0 to 4 their reach (9 px a step), a white core with the Ember's yellow and gold beside it, only over his body; on the flash's
    // frames (every 0.1 s) his whole silhouette white inside its soot outline. Pure: a new frame, the cached one untouched
    function freeze(fr, step, white) {
      const N = fr.N, px = fr.px.slice(), hx = (fr.heart || [48, 56])[0], hy = (fr.heart || [48, 56])[1];
      const body = (x, y) => x >= 0 && y >= 0 && x < N && y < N && px[y * N + x] && px[y * N + x] !== OUT;
      if (white) { for (let i = 0; i < px.length; i++) if (px[i] && px[i] !== OUT) px[i] = "#ffffff"; return { px, N, w: N, h: N, heart: fr.heart, tip: fr.tip }; }
      const reach = clamp(step, 0, 4) * 9;
      for (let k = 0; k < 12; k++) {
        let a = k / 12 * TAU + (hash(k, 1, 131) - 0.5) * 0.4, x = hx, y = hy;
        for (let d = 0; d < reach; d++) {
          a += (hash(k, d, 132) - 0.5) * 0.55; x += Math.cos(a); y += Math.sin(a) * 1.1;
          const X = Math.round(x), Y = Math.round(y); if (!body(X, Y)) break;
          px[Y * N + X] = d < reach - 4 ? "#ffffff" : "#fee761";
          const side = Math.abs(Math.sin(a)) > 0.7 ? [X + 1, Y] : [X, Y + 1];
          if (body(side[0], side[1]) && px[side[1] * N + side[0]] !== "#ffffff") px[side[1] * N + side[0]] = d < reach - 4 ? "#fee761" : "#feae34";
        }
      }
      if (step > 0) for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (body(hx + i, hy + j) && Math.abs(i) + Math.abs(j) <= 2 + (step > 2 ? 1 : 0)) px[(hy + j) * N + hx + i] = "#ffffff";   // the heart swells white
      return { px, N, w: N, h: N, heart: fr.heart, tip: fr.tip };
    }
    // burst(fr, t): t s after the pop, his body burst into its own pixels: every 3 x 3 block of the frame flung from his heart across the floor
    // at 60 to 160 px/s and up at 40 to 140 px/s, falling at 420 px/s^2, bouncing once at a third of its speed, gone between 0.6 and 1.0 s.
    // Each shard is { x, y, z, px (its nine colours), fade (0 to 1) }: x across from his feet, y in depth from his feet, z its height; the
    // painter draws its pixels at (feet x + x + i, feet y + y - z + j) and dithers it out by fade
    function burst(fr, t) {
      const N = fr.N, hx = (fr.heart || [48, 56])[0], hy = (fr.heart || [48, 56])[1], out = [];
      for (let by = 0; by < N; by += 3) for (let bx = 0; bx < N; bx += 3) {
        const cols = []; let any = false;
        for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { const c = (by + j < N && bx + i < N && fr.px[(by + j) * N + bx + i]) || null; cols.push(c); if (c && c !== OUT) any = true; }
        if (!any) continue;
        const k = bx * 131 + by * 7, dx = bx + 1.5 - hx, dy = by + 1.5 - hy, L = Math.hypot(dx, dy) || 1;
        const sp = 60 + hash(k, 1, 140) * 100, up = 40 + hash(k, 2, 140) * 100, life = 0.6 + hash(k, 3, 140) * 0.4;
        if (t >= life) continue;
        const g = 420, z0 = 95 - by, tLand = (up + Math.sqrt(up * up + 2 * g * z0)) / g;
        let z;
        if (t <= tLand) z = z0 + up * t - g * t * t / 2; else { const v2 = (g * tLand - up) * 0.35, t2 = t - tLand; z = Math.max(0, v2 * t2 - g * t2 * t2 / 2); }
        out.push({ x: bx - 48 + (dx / L) * sp * t, y: (hash(k, 4, 140) - 0.5) * 8 + (dy / L) * sp * t * 0.35, z, px: cols, fade: t > life - 0.3 ? (t - (life - 0.3)) / 0.3 : 0 });
      }
      return out;
    }
    return { kingBody, kingPose, KING_ANIMS, DRAWING, frame, face, freeze, burst, R };
  })();

  // ------------------------------------------------------------------ the frames
  // the pose of a kind's animation frame i
  function poseOf(kind, anim, i) {
    const body = KIND[kind].body;
    if (body === "knight") return knightPose(anim, i);
    if (body === "wolf") return wolfPose(anim, i);
    if (body === "wizard") return wizardPose(anim, i);   // design pass 27
    if (body === "bat") return batPose(anim, i);
    if (body === "burster") return bursterPose(anim, i);
    if (anim === "walk") return { step: [1, 0, -1, 0][i % 4], bob: i % 2 ? 0 : 1, arm: "rest" };
    if (anim === "wind") return { lean: -1, arm: body === "archer" ? "draw" : "raise" };
    if (anim === "strike") return { lean: 1, arm: body === "archer" ? "loose" : body === "brute" ? "strike" : "swing" };
    if (anim === "recover") return { lean: body === "brute" ? 2 : 1, bob: 1, arm: body === "archer" ? "lower" : "ground" };
    if (anim === "hit" || anim === "stone") return { lean: -1, head: [-1, -1], flinch: true, arm: "flinch" };
    if (anim === "reel") return { lean: -2, head: [-1, -2], flinch: true, arm: "flinch", bob: 1 };   // (design pass 38) its poise broken: a lurch back, the head down, the weapon arm dropped
    if (anim === "climb") return { climb: i % 2, arm: "back" };
    if (anim === "fall") return { fall: true, arm: "flail" };
    if (anim === "jab") return { lean: i % 2 ? 1 : -1, arm: i % 2 ? "jab1" : "jab0" };
    if (anim === "heave") return { lean: i % 2 ? 1 : -1, arm: "heave", pull: i % 2 };
    if (anim === "charge") return { lean: 2, bob: 1, head: [2, 3], arm: "charge" };
    if (anim === "roar") return { lean: -1, head: [-1, -2], arm: "roar", roar: true };
    if (anim === "sit") return { sit: true, arm: "sit" };
    return { bob: i % 2, arm: "rest" };   // idle: a 1 px breath
  }
  const cache = new Map();
  // Trolls.frame(kind, facing, anim, i, glow, dent) -> { px, N, w, h, kind, facing, anim, i, glow, dent, tip, canvas(), white(), stonePx(s),
  //   stone(s) }
  //   kind: one of KINDS (anything else is a footman); facing: right | left | away | toward (anything else is right); anim: one of the
  //   kind's ANIMS (anything else is idle; climb and fall only for the small trolls that climb); glow: 0 or 1, the coal's and the veins'
  //   phase; dent: 0, 1 or 2, the troll knight's shield cracked as its guard meter fills (a third, two thirds; ignored for other kinds)
  function frame(kind, facing, anim, i, glow, dent) {
    if (!KIND[kind]) kind = "footman";
    if (KIND[kind].body === "king") return kingFrame(facing, anim, i, glow);   // (design pass 44) his own drawings and glows
    if (!DRAWING[facing]) facing = "right";
    const A = ANIMS[kind];
    if (!A[anim]) anim = "idle";
    i = (i | 0) % A[anim];
    const knight = KIND[kind].body === "knight";
    const K = Object.assign({}, KIND[kind], { kind, glow: (KIND[kind].weapon === "staff" || KIND[kind].veins) && glow ? 1 : 0, dent: knight ? Math.max(0, Math.min(2, dent | 0)) : 0 });
    const climbing = anim === "climb";
    const [drawing, flip] = climbing ? ["up", false] : DRAWING[facing];
    const key = kind + "|" + (climbing ? "away" : facing) + "|" + anim + "|" + i + "|" + K.glow + (knight ? "|" + K.dent : "");
    if (cache.has(key)) return cache.get(key);
    const P = poseOf(kind, anim, i);
    const sp = BODY[K.body](drawing, P, K);
    const N = sp.N;
    let px = sp.px, tip = sp.tip ? [Math.max(0, Math.min(N - 1, Math.round(sp.tip[0]))), Math.max(0, Math.min(N - 1, Math.round(sp.tip[1])))] : null;
    if (anim === "stone") px = px.map(c => c && c !== OUT ? toStone(c) : c);
    if (flip) { px = new Array(N * N).fill(null); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) px[y * N + (N - 1 - x)] = sp.px[y * N + x]; if (anim === "stone") px = px.map(c => c && c !== OUT ? toStone(c) : c); if (tip) tip = [N - 1 - tip[0], tip[1]]; }
    const out = { px, N, w: N, h: N, kind, facing: climbing ? "away" : facing, anim, i, glow: K.glow, dent: K.dent, tip, _c: null, _w: null, _s: [],
      canvas() { return this._c || (this._c = toCanvas(px, N, null)); },
      white() { return this._w || (this._w = toCanvas(px, N, () => "#ffffff")); },
      // the stone death's ramp swap, step 1 to 4 (4 is all stone); a dithered share of the pixels each step
      stonePx(s) { return stonePixels(px, N, s); },
      stone(s) { s = Math.max(1, Math.min(4, s === undefined ? 4 : s | 0)); return this._s[s] || (this._s[s] = toCanvas(stonePixels(px, N, s), N, null)); } };
    cache.set(key, out);
    return out;
  }
  // a colour to the stone ramp by its lightness: the dead troll's ramps swap tone for tone
  const LUM = c => { const v = [1, 3, 5].map(k => parseInt(c.slice(k, k + 2), 16)); return 0.299 * v[0] + 0.587 * v[1] + 0.114 * v[2]; };
  const stoneOf = new Map();
  function toStone(c) { if (!stoneOf.has(c)) { const l = LUM(c); stoneOf.set(c, STONE[l < 70 ? 0 : l < 115 ? 1 : l < 165 ? 2 : 3]); } return stoneOf.get(c); }
  function stonePixels(px, N, s) {
    s = Math.max(1, Math.min(4, s === undefined ? 4 : s | 0));
    return px.map((c, k) => { if (!c || c === OUT) return c; const x = k % N, y = (k / N) | 0; return BAYER[(y & 3) * 4 + (x & 3)] < s * 4 ? toStone(c) : c; });
  }
  function toCanvas(px, N, tint, H) {
    H = H || N;
    const c = root.document.createElement("canvas"); c.width = N; c.height = H; const g = c.getContext("2d");
    for (let k = 0; k < N * H; k++) { const col = px[k]; if (!col) continue; g.fillStyle = tint && col !== OUT ? tint(col) : col; g.fillRect(k % N, (k / N) | 0, 1, 1); }
    return c;
  }

  // ------------------------------------------------------------------ the things that fly, fall and lie (section 3.12)
  // Small sprites of their own size, each { px, w, h, ox, oy, canvas() }: the page draws one with its anchor (ox, oy) on the point it
  // stands for (a projectile's head or centre, a chunk's or a shadow's centre, a pouch's or a splash's or a rock's foot)
  function thing(px, w, h, ox, oy, extra) { return Object.assign({ px, w, h, ox, oy, _c: null, canvas() { return this._c || (this._c = toCanvas(px, w, null, h)); } }, extra || {}); }
  const tcache = new Map();
  const once = (key, make) => { if (!tcache.has(key)) tcache.set(key, make()); return tcache.get(key); };
  // projectiles turn to the nearest of 16 directions
  const DIRS = 16, dirOf = a => ((Math.round((+a || 0) / (Math.PI * 2 / DIRS)) % DIRS) + DIRS) % DIRS;
  // the troll arrow (7 x 3: a soot shaft, a white head, pale fletching) and the ice arrow (7 x 3: a pale shaft, a cyan head, blue-white
  // fletching), drawn along the direction in a 13 px cell, anchored at the head; with a 1 px shadow on the ground, its footprint
  function arrowSprite(kind, k) {
    const W = 13, c = 6, a = k * 2 * Math.PI / DIRS, ca = Math.cos(a), sa = Math.sin(a), px = new Array(W * W).fill(null), sh = new Array(W * W).fill(null);
    const at = (t, s) => [Math.round(c + ca * t - sa * s), Math.round(c + sa * t + ca * s)];
    const put = (arr, t, s, col) => { const [x, y] = at(t, s); if (x >= 0 && y >= 0 && x < W && y < W) arr[y * W + x] = col; };
    const ice = kind === "ice-arrow", SHAFT = ice ? "#c0cbdc" : OUT, HEAD = ice ? "#2ce8f5" : "#ffffff", FLETCH = ice ? "#8b9bb4" : "#c0cbdc";
    if (k % 4 === 2) {
      // the four diagonals are drawn by hand (rounding a turned line breaks them): pointing down and right, the fletching at the top
      // left, the shaft, and the head an L whose corner is the point and whose arms are the barbs; mirrored for the other three
      const mx = k === 6 || k === 10, my = k === 10 || k === 14, set = (arr, dx, dy, col) => { const x = 4 + (mx ? 5 - dx : dx), y = 4 + (my ? 5 - dy : dy); arr[y * W + x] = col; };
      for (let d = 0; d <= 5; d++) set(sh, d, d, "#3e2731");
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) set(px, dx, dy, FLETCH);
      for (const d of [1, 2, 3, 4]) set(px, d, d, SHAFT);
      for (const [dx, dy] of [[5, 5], [5, 4], [5, 3], [4, 5], [3, 5]]) set(px, dx, dy, HEAD);
      const hx = 4 + (mx ? 0 : 5), hy = 4 + (my ? 0 : 5);
      return thing(px, W, W, hx, hy, { kind, dir: k, shadow: thing(sh, W, W, hx, hy) });
    }
    for (let t = -3; t <= 3; t++) put(sh, t, 0, "#3e2731");
    for (let t = -3; t <= 1; t++) put(px, t, 0, SHAFT);
    put(px, -3, -1, FLETCH); put(px, -3, 1, FLETCH); put(px, -2, -1, FLETCH); put(px, -2, 1, FLETCH);
    put(px, 2, 0, HEAD); put(px, 3, 0, HEAD); put(px, 2, -1, HEAD); put(px, 2, 1, HEAD);
    const [hx, hy] = at(3, 0);
    return thing(px, W, W, hx, hy, { kind, dir: k, shadow: thing(sh, W, W, hx, hy) });
  }
  // the fire bolt: a 5 x 5 coal tumbling on four frames, #f77622 and #feae34 round a #fee761 heart, with a 3 px trail of sparks behind
  // it; anchored at its centre (its hit circle's)
  const COAL = [".oFY.", "oFYWF", "FYWYF", "FYYFo", ".FFo."], COALPAL = { o: R.fire[0], F: R.fire[1], Y: R.fire[2], W: R.fire[3] };
  function boltSprite(k, f) {
    const W = 17, c = 8, a = k * 2 * Math.PI / DIRS, ca = Math.cos(a), sa = Math.sin(a), px = new Array(W * W).fill(null);
    const put = (x, y, col) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < W) px[y * W + x] = col; };
    [[4, R.fire[2]], [5.5, R.fire[1]], [7, R.fire[0]]].forEach(([d, col], j) => put(c - ca * d - sa * (j % 2 ? 0.6 : -0.6) * (f % 2 ? 1 : -1), c - sa * d + ca * (j % 2 ? 0.6 : -0.6) * (f % 2 ? 1 : -1), col));
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
      // the coal turned a quarter each frame
      let sx = x, sy = y; for (let q = 0; q < (f & 3); q++) { const t = sx; sx = 4 - sy; sy = t; }
      const ch = COAL[sy][sx]; if (ch !== ".") put(c - 2 + x, c - 2 + y, COALPAL[ch]);
    }
    return thing(px, W, W, c, c, { kind: "fire-bolt", dir: k, i: f & 3 });
  }
  // the trebuchet's stone: a 6 x 6 boulder in the field's rock ramp with a soot outline, on two tumbling frames; anchored at its centre
  function stoneSprite(f) {
    const sp = new Grid(8);
    region(sp, ell(3.5, 3.5, 3, 3), STONE, { ball: [3.5, 3.5, 3], spec: (x, y) => f % 2 ? x === 5 && y === 2 : x === 2 && y === 2 });
    if (f % 2) { sp.set(2, 4, STONE[0]); sp.set(3, 5, STONE[0]); } else { sp.set(4, 3, STONE[0]); sp.set(5, 4, STONE[0]); sp.set(3, 2, MOSS); }
    outline(sp);
    return thing(sp.px, 8, 8, 4, 4, { kind: "stone", i: f % 2 });
  }
  function projectile(kind, angle, i) {
    const k = dirOf(angle);
    if (kind === "fire-bolt") return once("bolt" + k + "|" + ((i | 0) & 3), () => boltSprite(k, (i | 0) & 3));
    if (kind === "hexbolt") return once("hex" + k + "|" + ((i | 0) & 3), () => hexboltSprite(k, (i | 0) & 3));
    if (kind === "stone") return once("stone" + ((i | 0) % 2), () => stoneSprite((i | 0) % 2));
    if (kind !== "ice-arrow") kind = "troll-arrow";
    return once(kind + k, () => arrowSprite(kind, k));
  }
  // (design pass 27) the wizard's hexbolt: a 5 px orb of the Green Hand's fire round a white heart, a 3 px trail of green sparks behind
  // it, its heart pulsing on four frames; anchored at its centre (its hit circle's)
  function hexboltSprite(k, f) {
    const W = 17, c = 8, a = k * 2 * Math.PI / DIRS, ca = Math.cos(a), sa = Math.sin(a), px = new Array(W * W).fill(null), H = R.hex;
    const put = (x, y, col) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < W) px[y * W + x] = col; };
    [[4, H[2]], [5.5, H[1]], [7, H[0]]].forEach(([d, col], j) => put(c - ca * d - sa * (j % 2 ? 0.6 : -0.6) * (f % 2 ? 1 : -1), c - sa * d + ca * (j % 2 ? 0.6 : -0.6) * (f % 2 ? 1 : -1), col));
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) { const d = Math.hypot(x, y); if (d > 2.3) continue; put(c + x, c + y, d <= 0.6 ? H[4] : d <= 1.5 ? (f % 2 ? H[3] : H[4]) : ((x + y + f) & 1 ? H[2] : H[3])); }
    put(c + (f & 1 ? 1 : -1), c - 2, H[1]); put(c - (f & 1 ? 1 : -1), c + 2, H[1]);
    return thing(px, W, W, c, c, { kind: "hexbolt", dir: k, i: f & 3 });
  }
  const PROJECTILES = { "troll-arrow": 1, "ice-arrow": 1, "fire-bolt": 4, stone: 2, hexbolt: 4 };
  // the rock slam's chunks (and a stone's): dirt, 3 x 3 of the ground's tones; the clod, every third chunk, 4 x 4; a splinter of the
  // drawbridge's oak; each with a soot outline, tumbling on two frames, anchored at its centre
  function chunkSprite(kind, f) {
    const n = kind === "clod" ? 6 : 5, sp = new Grid(n + 1), GROUND = ["#3e2731", "#733e39", "#b86f50", "#e4a672"];
    if (kind === "splinter") region(sp, f ? line(1, 3, 4, 1, 1) : rect(1, 2, 4, 3), R.oak, { spec: (x, y) => x === 1 && y === (f ? 3 : 2) });
    else if (kind === "clod") region(sp, f ? or(rect(1, 2, 4, 4), rect(2, 1, 3, 1)) : or(rect(1, 1, 4, 3), rect(2, 4, 4, 4)), GROUND, { spec: (x, y) => x === (f ? 2 : 1) && y === 1 });
    else region(sp, f ? or(rect(1, 2, 3, 3), rect(2, 1, 2, 1)) : or(rect(1, 1, 3, 2), rect(2, 3, 3, 3)), GROUND, { spec: (x, y) => x === (f ? 2 : 1) && y === 1 });
    outline(sp);
    const N = n + 1;
    return thing(sp.px, N, N, N >> 1, N >> 1, { kind, i: f });
  }
  function chunk(kind, i) { if (kind !== "clod" && kind !== "splinter") kind = "dirt"; const f = (i | 0) % 2; return once("chunk" + kind + f, () => chunkSprite(kind, f)); }
  // a soot shadow on the ground, r 1 to 10 (a chunk's grows to 3, a stone's from 3 to 10): its core the ground's darkest tone, its rim
  // soot; anchored at its centre
  function shadow(r) {
    r = Math.max(1, Math.min(10, Math.round(+r || 1)));
    return once("shadow" + r, () => {
      const rx = r, ry = Math.max(1, Math.round(r * 0.6)), w = 2 * rx + 1, h = 2 * ry + 1, px = new Array(w * h).fill(null);
      const inside = (x, y) => ((x - rx) / (rx + 0.5)) ** 2 + ((y - ry) / (ry + 0.5)) ** 2 <= 1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x, y)) px[y * w + x] = inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1) ? "#3e2731" : OUT;
      return thing(px, w, h, rx, ry, { r });
    });
  }
  // a pouch on the ground (section 3.11.2): 7 x 6 burlap with a soot outline, a plain tie or a gold one (tier 2 and up, the Emberback's),
  // and a 1 px #fee761 glint at the top of its bob; anchored at its foot
  const POUCH = ["..oTo..", ".otbto.", "oBgBBbo", "oBBBBbo", "oBBbbbo", ".ooooo."];
  function pouch(gold, glint) {
    gold = !!gold; glint = !!glint;
    return once("pouch" + gold + glint, () => {
      const pal = { o: OUT, B: R.burlap[2], b: R.burlap[1], g: glint ? "#fee761" : R.burlap[2], t: gold ? R.fire[2] : R.burlap[0], T: gold ? R.fire[3] : R.burlap[1] };
      const px = []; for (const row of POUCH) for (const ch of row) px.push(ch === "." ? null : pal[ch]);
      return thing(px, 7, 6, 3, 5, { gold, glint });
    });
  }
  // the splash of a troll going into the moat: four frames of #2ce8f5 and #0099db, droplets thrown up and falling, rings on the water;
  // anchored at the water's point
  function splash(i) {
    const f = Math.max(0, Math.min(3, i | 0));
    return once("splash" + f, () => {
      const w = 17, h = 15, cx = 8, cy = 13, px = new Array(w * h).fill(null), A = "#2ce8f5", Bc = "#0099db";
      const put = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < w && y < h) px[y * w + x] = c; };
      const ring = (rx, c) => { for (let a = 0; a < 64; a++) { const t = a / 64 * Math.PI * 2; put(cx + Math.cos(t) * rx, cy + Math.sin(t) * rx * 0.3, c); } };
      if (f === 0) { ring(3, Bc); for (const dx of [-2, -1, 1, 2]) put(cx + dx, cy - 2 - (Math.abs(dx) === 1 ? 1 : 0), A); put(cx, cy - 1, A); }
      else if (f === 1) { ring(5, Bc); for (let y = cy - 7; y <= cy - 1; y++) { put(cx, y, A); if (y > cy - 6) { put(cx - 1, y, Bc); put(cx + 1, y, Bc); } } for (const [dx, dy] of [[-4, -5], [4, -5], [-3, -7], [3, -7], [0, -9]]) put(cx + dx, cy + dy, A); }
      else if (f === 2) { ring(6, Bc); for (const [dx, dy] of [[-6, -4], [6, -4], [-4, -8], [4, -8], [-1, -10], [1, -6], [-2, -3], [2, -3]]) put(cx + dx, cy + dy, dy < -6 ? A : Bc); }
      else { ring(7, Bc); ring(4, A); for (const [dx, dy] of [[-7, -2], [7, -2], [-3, -4], [3, -4]]) put(cx + dx, cy + dy, Bc); }
      return thing(px, w, h, cx, cy, { i: f });
    });
  }
  // the rock brute's rock, as it lies (the rock a staggered rock brute drops, the boulder a dead one leaves, the rock in a fresh crater):
  // the boulder it carries, 14 x 12 with its outline; anchored at its foot
  function rock() {
    return once("rock", () => {
      const sp = new Grid(16); boulder(sp, 1, 1); outline(sp);
      const px = sp.px.slice(0, 16 * 14);
      return thing(px, 16, 14, 8, 13);
    });
  }
  // a kind's sprite on the knight's interface: { kind, N, FACINGS, ANIMS, frame(facing, anim, i, glow, dent) }
  function sprite(kind) { if (!KIND[kind]) kind = "footman"; return { kind, N: KIND[kind].N, FACINGS, DRAWING, ANIMS: ANIMS[kind], frame: (facing, anim, i, glow, dent) => frame(kind, facing, anim, i, glow, dent) }; }

  const BODY = { footman, archer, brute, knight: trollKnight, wolf, wizard: (drawing, P) => wizardBody(drawing, P), bat: (drawing, P) => batBody(drawing, P), burster: (drawing, P) => bursterBody(drawing, P), king: (drawing, P) => KING.kingBody(drawing, P) };
  // (design pass 44) the King's frames: the sketch's frame (facing right | left | away | toward, the three-quarter for every side, flipped
  // for left; glow 0 to 3 raises the pose's own, the kneel's banked 0 kept) on the frame interface; the pose's glow is reported
  const kcache = new Map();
  function kingFrame(facing, anim, i, glow) {
    if (!KING.DRAWING[facing]) facing = "right";
    if (!KING.KING_ANIMS[anim]) anim = "idle";
    i = (i | 0) % KING.KING_ANIMS[anim];
    const g = Math.max(0, Math.min(3, glow | 0));   // (no glow asked is 0: the pose's own, the same frame and the same object)
    const key = facing + "|" + anim + "|" + i + "|" + g;
    if (kcache.has(key)) return kcache.get(key);
    const fr = KING.frame(facing, anim, i, { glow: g }), N = fr.N, px = fr.px;
    const out = { px, N, w: N, h: N, kind: "king", facing, anim, i, glow: g, dent: 0, tip: fr.tip, heart: fr.heart, _c: null, _w: null, _s: [],
      canvas() { return this._c || (this._c = toCanvas(px, N, null)); },
      white() { return this._w || (this._w = toCanvas(px, N, () => "#ffffff")); },
      stonePx(s) { return stonePixels(px, N, s); },
      stone(s) { s = Math.max(1, Math.min(4, s === undefined ? 4 : s | 0)); return this._s[s] || (this._s[s] = toCanvas(stonePixels(px, N, s), N, null)); } };
    kcache.set(key, out);
    return out;
  }
  // his face for the talk box (32 x 32: the head, the crown's band and the tusks, with the glow and the mouth of the line), his end's frames
  const fcache = new Map();
  function kingFace(glow, mouth) { const key = (glow | 0) + "|" + (mouth | 0); if (!fcache.has(key)) { const f = KING.face(glow, mouth); fcache.set(key, Object.assign(f, { _c: null, canvas() { return this._c || (this._c = toCanvas(this.px, this.w, null, this.h)); } })); } return fcache.get(key); }
  function kingFreeze(fr, step, white) { const f = KING.freeze(fr, step, white); return Object.assign(f, { kind: "king", _c: null, canvas() { return this._c || (this._c = toCanvas(this.px, this.N, null)); } }); }
  const kingBurst = (fr, t) => KING.burst(fr, t);
  root.Trolls = { OUT, R, STONE, KINDS, KIND, FACINGS, DRAWING, ANIMS, frame, sprite, poseOf, toStone, stonePixels, DIRS, dirOf, PROJECTILES, projectile, chunk, shadow, pouch, splash, rock,
    kingFace, kingFreeze, kingBurst, KING_ANIMS: KING.KING_ANIMS, KING_DRAWING: KING.DRAWING };   // (design pass 44)
  if (typeof module !== "undefined" && module.exports) module.exports = root.Trolls;
})(typeof window !== "undefined" ? window : globalThis);
