// FORGE FOREVER: Grycus, the smith of the Forge (design pass 17, card t71, with its revision 1; built by build 6). The game's first
// world-building: the hunched old smith who has spent sixty years hunting the perfect weapon and swings the sledge in every forge,
// though his back screams. Here: his drawing in the room (eight poses), his swing at the anvil (seven poses, drawn into the forging's
// overlay by proto/forge-fx.js), where he stands in the room (place), and when he speaks and what (the talk rules; his words are the
// data file spec/grycus.json, window.FORGE_GRYCUS). Pure: no DOM, no clock, no Math.random. The page's controller is in the-forge.js.
//
// 32 x 32, drawn in code the knight's way (shapes lit from the top left on four-tone ramps, then a soot outline), facing right, toward
// the anvil: a bowed back with the hump the highest thing about him, the bald head hung forward below it with a fringe of white hair
// and two wrinkles, a hooked nose, a bushy white brow over a brass jeweller's loupe, a long white beard singed at the tip, a moss-green
// shirt with the sleeves rolled to the elbow, a tan leather apron (its strap across the back, its knot at the waist, tongs in its
// pocket), navy trousers, old boots, and a sword planted point down as a cane, its tip broken. The feet stand on the bottom row, like
// the knight's. Every colour is ENDESGA 32 or one of the smithy's own tones (#5a3030, #fff6c8). Plain script, defines window.Grycus
// (globalThis.Grycus in node). Needs no other file.
(function (root) {
  "use strict";
  const N = 32, OUT = "#181425";
  const R = {
    shirt: ["#193c3e", "#265c42", "#3e8948", "#63c74d"],
    apron: ["#3e2731", "#733e39", "#b86f50", "#e4a672"],
    cloth: ["#181425", "#262b44", "#3a4466", "#5a6988"],
    boot: ["#181425", "#3e2731", "#5a3030", "#733e39"],
    skin: ["#b86f50", "#e8b796", "#ead4aa", "#ffffff"],
    beard: ["#5a6988", "#c0cbdc", "#ffffff", "#ffffff"]
  };
  // the poses and how many frames each has (motion on four frames, the pixel rules); a frame is a set of small offsets on one drawing
  //   b: the breath (the upper body a pixel down), h: the head forward (+) or back (-), u: the head raised (-1), c: the cane lifted,
  //   g: the loupe glints, m: the jaw open (talking), s: the shoulders up (standing straighter)
  const POSES = {
    idle:   [{}, {}, { b: 1 }, { b: 1 }],
    glint:  [{ g: 1 }, { g: 2 }, { g: 1 }, {}],
    tap:    [{ c: 1 }, {}, { c: 1 }, {}],
    watch:  [{ h: 1 }, { h: 1, g: 1 }, { h: 1 }, { h: 1, b: 1 }],
    shake:  [{ h: -1 }, {}, { h: -1 }, {}],
    talk:   [{ m: 1 }, {}, { m: 1, b: 1 }, { b: 1 }],
    marvel: [{ s: 1, u: -1 }, { s: 1, u: -1, g: 2 }, { s: 1, u: -1, g: 1 }, { s: 1, u: -1 }],
    twitch: [{ h: 1 }, {}, { h: 1, g: 1 }, {}]
  };
  // the pose frames in milliseconds (the fire's beat is 90 ms; each frame is a whole number of beats)
  const MS = { idle: [630, 450, 630, 450], glint: [90, 180, 90, 270], tap: [270, 180, 270, 360], watch: [360, 270, 360, 270], shake: [270, 270, 270, 270], talk: [180, 180, 180, 180], marvel: [450, 180, 180, 450], twitch: [90, 90, 90, 450] };

  function Grid() { this.px = new Array(N * N).fill(null); }
  Grid.prototype.get = function (x, y) { return x >= 0 && y >= 0 && x < N && y < N ? this.px[y * N + x] : null; };
  Grid.prototype.set = function (x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < N && y < N) this.px[y * N + x] = c; };
  const rect = (x0, y0, x1, y1) => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  const ell = (cx, cy, rx, ry) => (x, y) => ((x - cx) ** 2) / (rx * rx) + ((y - cy) ** 2) / (ry * ry) <= 1.02;
  const cap = (x0, y0, x1, y1, r) => (x, y) => { const vx = x1 - x0, vy = y1 - y0, L = vx * vx + vy * vy; let t = L ? ((x - x0) * vx + (y - y0) * vy) / L : 0; t = Math.max(0, Math.min(1, t)); const dx = x - (x0 + t * vx), dy = y - (y0 + t * vy); return dx * dx + dy * dy <= r * r + 0.01; };
  const poly = pts => (x, y) => { let inside = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside; } return inside; };
  const or = (...f) => (x, y) => f.some(g => g(x, y));
  // a region lit from the top left: the light tone on its upper-left edge, the dark tone on its lower-right edge (the knight's rule)
  function region(sp, pred, ramp, o) {
    o = o || {}; const m = (x, y) => x >= 0 && y >= 0 && x < N && y < N && pred(x + 0.5, y + 0.5);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (m(x, y)) {
      const ul = !m(x - 1, y) || !m(x, y - 1), dr = !m(x + 1, y) || !m(x, y + 1);
      let c = ul && dr ? ramp[1] : dr ? ramp[0] : ul ? ramp[2] : ramp[1];
      if (o.spec && o.spec(x, y)) c = ramp[3];
      if (o.flat !== undefined) c = ramp[o.flat];
      sp.set(x, y, c);
    }
  }
  function outline(sp) { const add = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!sp.get(x, y) && (sp.get(x - 1, y) || sp.get(x + 1, y) || sp.get(x, y - 1) || sp.get(x, y + 1))) add.push([x, y]); for (const [x, y] of add) sp.set(x, y, OUT); }

  // the body's rows [y, x0, x1]: the back bowed, its top sloping down into the neck so the head hangs forward below the hump
  const BACK = [[5, 9, 12], [6, 7, 14], [7, 6, 15], [8, 5, 16], [9, 5, 16], [10, 4, 17], [11, 4, 17], [12, 4, 17], [13, 4, 17], [14, 4, 17], [15, 5, 17], [16, 5, 16], [17, 5, 16], [18, 6, 15], [19, 6, 15], [20, 6, 15], [21, 7, 14]];

  function draw(f) {
    f = f || {};
    const sp = new Grid(), b = f.b | 0, s = f.s | 0, B = b - s, H = (f.h | 0), U = (f.u | 0) + B, C = -(f.c | 0), M = f.m | 0;
    const up = y => y <= 15 ? B : 0;   // the upper body rises and falls with the breath; the hips and legs stay
    // the back leg: the thigh down to the knee, the shin, the boot
    region(sp, or(cap(8.6, 21.4, 12, 24.2, 2), poly([[9.6, 23.6], [12.6, 23.6], [11.4, 29], [9.2, 29]])), R.cloth);
    region(sp, poly([[6.8, 28.8], [11.8, 28.8], [12.2, 31], [6.6, 31]]), R.boot);
    // the back and the hump (the shirt), lit on its crown, falling into shadow under the hump (dithered where they meet)
    const back = (x, y) => { x = Math.floor(x); y = Math.floor(y); for (const [ry, x0, x1] of BACK) if (y === ry + up(ry) && x >= x0 && x <= x1) return true; return false; };
    region(sp, back, R.shirt, { spec: (x, y) => (y === 6 + B && (x === 8 || x === 9)) || (y === 7 + B && x === 6) });
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!back(x + 0.5, y + 0.5) || sp.get(x, y) !== R.shirt[1]) continue;
      const yy = y - up(y);
      if (yy <= 6 || (yy === 7 && x <= 9)) sp.set(x, y, R.shirt[2]);
      else if (yy >= 17 || (yy === 16 && x >= 9)) sp.set(x, y, R.shirt[0]);
    }
    // the apron's strap across the back, from the shoulder to the knot at the waist
    for (const [x, y] of [[13, 7], [12, 8], [11, 9], [10, 10], [10, 11], [9, 12], [9, 13], [8, 14], [8, 15], [7, 16], [7, 17], [6, 18]]) { sp.set(x, y + up(y), y % 3 === 1 ? R.apron[2] : R.apron[1]); sp.set(x + 1, y + up(y), R.apron[0]); }
    // the waist string, its knot at the back
    for (let x = 6; x <= 14; x++) sp.set(x, 19, x % 4 === 1 ? R.apron[2] : R.apron[1]);
    for (const [x, y, c] of [[4, 18, R.apron[2]], [3, 19, R.apron[1]], [5, 19, R.apron[2]], [4, 20, R.apron[1]], [3, 21, "#5a3030"]]) sp.set(x, y, c);
    // the front leg: the thigh forward to the knee, the shin back to the boot
    region(sp, or(cap(10.6, 21.8, 16.4, 24.4, 2.1), poly([[13.8, 24], [17.8, 24], [17, 29], [14.2, 29]])), R.cloth);
    region(sp, poly([[13.6, 28.8], [18, 28.8], [20.6, 30], [20.6, 31], [13.6, 31]]), R.boot);
    // the apron, in front only: the bib under the beard, the skirt to the knee; the tongs' handles in its pocket
    region(sp, poly([[15.6, 14.2 + B], [18.8, 14.2 + B], [20.6, 26.6], [12.6, 26.6], [13.2, 20.2], [14.6, 16.6]]), R.apron);
    for (let y = 22; y <= 24; y++) for (let x = 14; x <= 17; x++) sp.set(x, y, y === 22 ? R.apron[2] : R.apron[0]);
    sp.set(15, 21, "#8b9bb4"); sp.set(15, 20, "#c0cbdc"); sp.set(16, 21, "#5a6988"); sp.set(16, 20, "#8b9bb4");
    // the near arm: from the top of the shoulder down the front of the body to the rolled cuff, a dark seam behind it (at the forge,
    // f.arm false, the swing draws both arms itself)
    if (f.arm !== false) {
      const arm = cap(13.2, 8.2 + B, 15, 14.6 + (B > 0 ? 0 : 0), 2.0);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!arm(x + 0.5, y + 0.5) && arm(x + 1.5, y + 0.5) && back(x + 0.5, y + 0.5)) sp.set(x, y, R.shirt[0]);
      region(sp, arm, [R.shirt[1], R.shirt[2], R.shirt[3], R.shirt[3]]);
      region(sp, ell(15.2, 15.8, 2.1, 1.25), [R.shirt[0], R.shirt[1], R.shirt[2], R.shirt[2]]);
      // the forearm, forward to the hilt
      region(sp, cap(15.4, 17.6, 23, 19.4 + C, 1.25), R.skin);
    }
    // the head: forward of the hump and below it, with its hooked nose
    const hx = H, hy = U;
    region(sp, or(ell(20.4 + hx, 12.7 + hy, 3.9, 3.8), poly([[23 + hx, 10.9 + hy], [26.2 + hx, 12.7 + hy], [27.2 + hx, 14.7 + hy], [25.8 + hx, 15.9 + hy], [23.4 + hx, 15.3 + hy]])), R.skin);
    // the neck's wrinkled skin between the hump and the fringe
    for (const [x, y, c] of [[16, 9, "#c28569"], [17, 9, "#b86f50"], [16, 10, "#b86f50"]]) sp.set(x + Math.min(0, hx), y + B, c);
    // the beard, from the jaw to a point below the belt (the jaw drops a pixel when he talks)
    region(sp, poly([[16.8 + hx, 14 + hy], [25.4 + hx, 15 + hy], [24.8 + hx, 18 + hy + M], [22.8, 22.4 + hy + M], [21.2, 25.6 + hy + M], [19.8, 22.8 + hy + M], [17.6, 18.4 + hy]]), R.beard);
    // the fist round the grip; the pommel above it, the crossguard below, the blade to the floor (none at the forge: f.arm false)
    if (f.arm !== false) {
      region(sp, ell(24.6, 19.4 + C, 1.9, 1.8), R.skin);
      sp.set(24, 16 + C, "#fee761"); sp.set(25, 16 + C, "#feae34"); sp.set(24, 17 + C, "#feae34"); sp.set(25, 17 + C, "#be4a2f");
      for (let x = 22; x <= 28; x++) sp.set(x, 21 + C, x === 22 ? "#fee761" : x < 25 ? "#feae34" : x < 27 ? "#f77622" : "#be4a2f");
      sp.set(24, 22 + C, "#be4a2f"); sp.set(25, 22 + C, "#be4a2f");
      for (let y = 22 + C; y <= 30 + C; y++) { sp.set(24, y, y < 27 + C ? "#c0cbdc" : "#8b9bb4"); sp.set(25, y, y < 27 + C ? "#8b9bb4" : "#5a6988"); }
      sp.set(25, 30 + C, null);
    }
    // the fringe of white hair at the back of the head, the ear
    for (const [x, y, c] of [[17, 10, "#c0cbdc"], [16, 11, "#ffffff"], [17, 11, "#ffffff"], [16, 12, "#c0cbdc"], [17, 12, "#ffffff"], [16, 13, "#8b9bb4"], [17, 13, "#c0cbdc"], [17, 14, "#8b9bb4"]]) sp.set(x + hx, y + hy, c);
    sp.set(18 + hx, 12 + hy, "#c28569"); sp.set(18 + hx, 13 + hy, "#b86f50"); sp.set(19 + hx, 13 + hy, "#c28569");
    sp.set(20 + hx, 9 + hy, "#e8b796"); sp.set(21 + hx, 9 + hy, "#c28569"); sp.set(19 + hx, 9 + hy, "#c28569");
    // the brow, bushy and white, over the loupe: a brass ring round a lens that glints (g 1 a gleam, g 2 the full flash)
    for (const [x, y, c] of [[20, 10, "#ffffff"], [21, 10, "#ffffff"], [22, 10, "#ffffff"], [23, 10, "#c0cbdc"], [23, 9, "#ffffff"], [24, 10, "#c0cbdc"]]) sp.set(x + hx, y + hy, c);
    const lens = f.w ? "#733e39" : f.g === 2 ? "#ffffff" : f.g === 1 ? "#fff6c8" : "#fee761";
    for (const [x, y, c] of [[21, 11, "#feae34"], [22, 11, "#feae34"], [23, 11, "#f77622"], [21, 12, "#feae34"], [22, 12, lens], [23, 12, "#be4a2f"], [21, 13, "#f77622"], [22, 13, "#be4a2f"], [23, 13, "#be4a2f"]]) sp.set(x + hx, y + hy, c);
    if (f.g === 2) { sp.set(22 + hx, 11 + hy, "#fff6c8"); sp.set(21 + hx, 12 + hy, "#fee761"); }
    // a wince (w): the brow crushed down over the loupe, the eye behind it shut (the lens dark), the teeth set
    if (f.w) for (const [x, y, c] of [[20, 11, "#ffffff"], [21, 11, "#c0cbdc"], [22, 11, "#ffffff"], [23, 11, "#c0cbdc"]]) sp.set(x + hx, y + hy, c);
    // the nostril, the cheek
    sp.set(25 + hx, 15 + hy, "#733e39"); sp.set(26 + hx, 15 + hy, "#b86f50"); sp.set(20 + hx, 14 + hy, "#c28569");
    // the moustache (a dark mouth under it when he talks), strands in the beard, the singed tip
    for (const x of [21, 22, 23, 24]) sp.set(x + hx, 16 + hy, "#ffffff");
    if (M) { sp.set(22 + hx, 17 + hy, "#3e2731"); sp.set(23 + hx, 17 + hy, "#3e2731"); }
    if (f.w) { sp.set(21 + hx, 17 + hy, "#3e2731"); sp.set(22 + hx, 17 + hy, "#ffffff"); sp.set(23 + hx, 17 + hy, "#ffffff"); sp.set(24 + hx, 17 + hy, "#3e2731"); }
    for (const [x, y] of [[19, 18], [20, 20], [21, 19], [21, 22], [22, 21], [22, 17]]) if (!(M && y === 17)) sp.set(x, y + hy + (y > 18 ? M : 0), "#8b9bb4");
    sp.set(21, 24 + hy + M, "#be4a2f"); sp.set(22, 24 + hy + M, "#733e39"); sp.set(21, 25 + hy + M, "#be4a2f");
    if (!f.raw) outline(sp);
    return sp.px;
  }
  // a frame of a pose: { px (1024 colours or null), pose, i }; an unknown pose is idle, the index wraps
  const cache = new Map();
  function frame(pose, i) {
    if (!POSES[pose]) pose = "idle";
    const fs = POSES[pose], k = ((i | 0) % fs.length + fs.length) % fs.length, key = pose + k;
    if (!cache.has(key)) cache.set(key, { px: draw(fs[k]), pose, i: k });
    return cache.get(key);
  }
  // where a pose is at t ms after it started: { i, done } (a pose that loops never ends)
  function at(pose, t, loops) {
    const ms = MS[pose] || MS.idle, total = ms.reduce((a, b) => a + b, 0); t = Math.max(0, t);
    const n = loops === undefined ? Infinity : loops;
    if (t >= total * n) return { i: ms.length - 1, done: true };
    let r = t % total, i = 0; while (r >= ms[i]) { r -= ms[i]; i++; }
    return { i, done: false };
  }

  // ------------------------------------------------------------------ at the anvil: his swing (revision 1: he is the smith)
  // A frame of 72 x 56 drawn into the forging's overlay, its top-left at (42, 41) in the station's pixels (pass 10's 200-wide numbers,
  // shifted by ox in a wider room), so his feet stand on y 96 left of the anvil, his front 3 px short of its horn, the bellows behind
  // him. His body is draw()'s, without the cane and the hanging arm (f.arm false), at (10, 24) in the frame; his near arm and the sledge
  // are drawn over it (or the sledge behind him), then one soot outline round the lot.
  const SW = { w: 72, h: 56, x: 42, y: 41, bx: 10, by: 24 };
  const OAK = ["#3e2731", "#733e39", "#b86f50", "#e4a672"], IRON = ["#262b44", "#3a4466", "#5a6988", "#8b9bb4", "#c0cbdc"];
  function Frame(w, h) { this.w = w; this.h = h; this.px = new Array(w * h).fill(null); }
  Frame.prototype.get = function (x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.px[y * this.w + x] : null; };
  Frame.prototype.set = function (x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c; };
  function fill(fr, pred, ramp) {
    const m = (x, y) => x >= 0 && y >= 0 && x < fr.w && y < fr.h && pred(x + 0.5, y + 0.5);
    for (let y = 0; y < fr.h; y++) for (let x = 0; x < fr.w; x++) if (m(x, y)) { const ul = !m(x - 1, y) || !m(x, y - 1), dr = !m(x + 1, y) || !m(x, y + 1); fr.set(x, y, ul && dr ? ramp[1] : dr ? ramp[0] : ul ? ramp[2] : ramp[1]); }
  }
  function ink(fr) { const add = []; for (let y = 0; y < fr.h; y++) for (let x = 0; x < fr.w; x++) if (!fr.get(x, y) && (fr.get(x - 1, y) || fr.get(x + 1, y) || fr.get(x, y - 1) || fr.get(x, y + 1))) add.push([x, y]); for (const [x, y] of add) fr.set(x, y, OUT); }
  // the sledge from the fists at (hx, hy) along deg (0 right, 90 up, 180 left, 270 down): an oak handle 15 long and 2 wide, then the
  // iron head, 7 along the handle and 13 across it, lit from the top left, its two striking faces bright
  function sledge(fr, hx, hy, deg) {
    const a = deg * Math.PI / 180, dx = Math.cos(a), dy = -Math.sin(a), px = -dy, py = dx, L = 15, HA = 7, HC = 13;
    for (let s = -1; s <= L; s++) for (let w = 0; w <= 1; w++) fr.set(hx + dx * s + px * (w - 0.5), hy + dy * s + py * (w - 0.5), s <= 0 ? OAK[0] : (w === 0) === (py < 0) ? OAK[2] : OAK[1]);
    const cx = hx + dx * (L + HA / 2), cy = hy + dy * (L + HA / 2);
    for (let y = Math.floor(cy - 9); y <= cy + 9; y++) for (let x = Math.floor(cx - 9); x <= cx + 9; x++) {
      const rx = x + 0.5 - cx, ry = y + 0.5 - cy, along = rx * dx + ry * dy, across = rx * px + ry * py;
      if (Math.abs(along) > HA / 2 || Math.abs(across) > HC / 2) continue;
      const face = Math.abs(across) > HC / 2 - 1.2, lit = rx + ry < -3 ? 1 : rx + ry > 3 ? -1 : 0;
      fr.set(x, y, face ? IRON[3] : lit > 0 ? IRON[3] : lit < 0 ? IRON[1] : IRON[2]);
    }
    fr.set(Math.round(cx - 2), Math.round(cy - 2), IRON[4]);
  }
  // a dithered arc of light where the head has just been, from deg0 to deg1 about the fists, 15 to 21 out
  function trail(fr, hx, hy, deg0, deg1, c) { for (let i = 0; i <= 9; i += 2) { const a = (deg0 + (deg1 - deg0) * i / 9) * Math.PI / 180; for (const r of [15, 18, 21]) if ((i + r) % 3 !== 1) fr.set(hx + Math.cos(a) * r, hy - Math.sin(a) * r, c); } }
  // the poses: the body's offsets (as draw's f; w is the wince), where the fists are in the frame, the sledge's angle, the sledge behind
  // him or not, a trail [from, to]. A blow is behind, over, down, impact, back (240, 120, 90, 300, 210 ms: the head lands 450 ms in, as
  // the floating hammer's did); ready is the hammer on his shoulder before the first blow; rest is leaning on it after the last
  const SWING = {
    ready:  { f: {}, hand: [36, 38], deg: 130, behind: true },
    behind: { f: { h: -1, s: 1 }, hand: [21, 23], deg: 232, behind: true },
    over:   { f: { s: 1, u: -1 }, hand: [29, 26], deg: 90 },
    down:   { f: { h: 1 }, hand: [38, 27], deg: 42, trail: [90, 42] },
    impact: { f: { h: 1, b: 1, w: 1 }, hand: [41, 30], deg: 0 },
    back:   { f: { h: 1 }, hand: [33, 27], deg: 115, trail: [8, 115], behind: true },
    rest:   { f: { b: 1, m: 1 }, hand: [42, 39], deg: 270 }
  };
  const BLOW_POSES = ["behind", "over", "down", "impact", "back"], BLOW_MS = [240, 120, 90, 300, 210];
  const swung = new Map();
  function drawSwing(name) {
    const P = SWING[name] || SWING.ready, fr = new Frame(SW.w, SW.h), f = Object.assign({ arm: false, cane: false, raw: true }, P.f);
    const B = (f.b | 0) - (f.s | 0), [hx, hy] = P.hand;
    if (P.behind) sledge(fr, hx, hy, P.deg);
    const body = draw(f);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const c = body[y * N + x]; if (c) fr.set(x + SW.bx, y + SW.by, c); }
    // the near arm: the shoulder to the elbow in the rolled sleeve, the elbow to the fists bare; the elbow bends down and back
    const sx = 13.2 + SW.bx, sy = 8.2 + SW.by + B, L1 = 7.5, L2 = 9;
    const dx = hx - sx, dy = hy - sy, d = Math.min(L1 + L2 - 0.01, Math.hypot(dx, dy)), a = Math.atan2(dy, dx), k = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
    const ex = sx + Math.cos(a + k) * L1, ey = sy + Math.sin(a + k) * L1;
    fill(fr, cap(sx, sy, ex, ey, 2.2), R.shirt);
    fill(fr, ell(ex, ey, 2.2, 2.2), [R.shirt[1], R.shirt[2], R.shirt[3], R.shirt[3]]);
    fill(fr, cap(ex, ey, hx, hy, 1.6), R.skin);
    if (!P.behind) sledge(fr, hx, hy, P.deg);
    fill(fr, ell(hx, hy, 2.3, 2.1), R.skin);
    fr.set(Math.round(hx), Math.round(hy), "#b86f50");
    if (P.trail) trail(fr, hx, hy, P.trail[0], P.trail[1], name === "down" ? "#fff6c8" : "#c0cbdc");
    ink(fr);
    return fr.px;
  }
  // a pose's frame: { px (w x h colours or null), w, h, x, y } with (x, y) its top-left in the station's pixels; an unknown pose is ready
  function swing(name) {
    if (!SWING[name]) name = "ready";
    if (!swung.has(name)) swung.set(name, { px: drawSwing(name), w: SW.w, h: SW.h, x: SW.x, y: SW.y, pose: name });
    return swung.get(name);
  }

  // ------------------------------------------------------------------ where he stands (section 3.3 of the note)
  // In the wide smithy W world pixels across (232 to 320; cx = floor(W / 2)): the frame's left at cx - 92, never left of 45, so his
  // pixels (x + 2 to x + 29) keep clear of the cellar's door (x 10 to 45, its button to 46). slotLeft, when the page knows it, is where
  // the anvil's base slot begins in world pixels (the slots are CSS-sized, so on a short screen they reach further into the room): if
  // his front would come within 2 px of it, he steps left to x = floor(slotLeft) - 32, in front of the arch's right jamb, but never
  // left of 37. His feet on y 96, four rows forward of the wall on the flagstones, in front of the coal scuttle and, in a narrow room,
  // the end of the bellows
  function place(W, slotLeft) {
    const cx = Math.floor(W / 2), y = 96 - 31;
    let x = Math.max(45, cx - 92);
    if (typeof slotLeft === "number" && isFinite(slotLeft) && x + 29 + 2 > slotLeft) x = Math.max(37, Math.min(x, Math.floor(slotLeft) - 32));
    return { x, y, box: { x0: x + 2, x1: x + 29, y0: y + 3, y1: y + 31 }, head: { x: x + 20, y: y + 9 } };
  }

  // ------------------------------------------------------------------ what he says, and when (section 3.4); pure, the words are data
  const TRIGGERS = ["meet", "greet", "back", "crucible", "tap", "first", "legend", "rare", "common", "ingredient", "fail"];
  // the pose a remark is made in, before he talks (a pool not listed here is said straight away, talking)
  const REACT = { first: "marvel", legend: "marvel", crucible: "marvel", rare: "watch", common: "shake", ingredient: "shake", fail: "shake" };
  // his memory, from a save (anything missing or malformed takes its default)
  function memory(saved) {
    const m = { v: 1, met: false, next: {}, since: 0, greetAt: null, crucible: false };
    if (saved && typeof saved === "object") {
      m.met = saved.met === true; m.crucible = saved.crucible === true;
      m.since = Number.isInteger(saved.since) && saved.since > 0 ? saved.since : 0;
      m.greetAt = typeof saved.greetAt === "string" && !isNaN(Date.parse(saved.greetAt)) ? saved.greetAt : null;
      for (const t of TRIGGERS) { const n = saved.next && saved.next[t]; if (Number.isInteger(n) && n >= 0) m.next[t] = n; }
    }
    return m;
  }
  const copy = (m, o) => Object.assign({}, m, o, { next: Object.assign({}, m.next, (o && o.next) || {}) });
  // the next line of a pool, in the file's order and round again after the last: { text, mem } (text null for an empty pool). at (an
  // ISO time) is when it is said: a line said on opening the Forge (meet, greet, back, crucible) stamps greetAt with it, so a reload
  // does not greet again; meet marks him met, crucible marks the Crucible seen
  const OPENING = ["meet", "greet", "back", "crucible"];
  function line(m, trigger, W, at) {
    const pool = ((W || words()).lines || {})[trigger] || [];
    if (!pool.length) return { text: null, mem: m };
    const i = (m.next[trigger] || 0) % pool.length, o = { next: { [trigger]: i + 1 } };
    if (trigger === "meet") o.met = true;
    if (trigger === "crucible") o.crucible = true;
    if (at && OPENING.includes(trigger)) o.greetAt = at;
    return { text: pool[i], mem: copy(m, o) };
  }
  // opening the Forge: the pool he speaks from first, or null. ctx = { now (ms), fromCellar, crucibleAwake }
  function opening(m, ctx, W) {
    W = W || words();
    if (!m.met) return "meet";
    if (ctx.fromCellar) return "back";
    if (ctx.crucibleAwake && !m.crucible) return "crucible";
    if (!m.greetAt || ctx.now - Date.parse(m.greetAt) >= (W.greetAfterMin || 10) * 60000) return "greet";
    return null;
  }
  // after a forge or a pour: the pool he answers from (or null) and his memory. A legend, a world first, a rare weapon or better and a
  // failure always get a word; an ordinary forge only every third time. o = { pour, failed, status, tier, weapon }
  function after(m, o, W) {
    W = W || words();
    const t = o.failed ? "fail" : o.pour ? "legend" : o.status === "first" ? "first" : o.weapon && (o.tier | 0) >= 3 ? "rare" : null;
    if (t) return { trigger: t, mem: copy(m, { since: 0 }) };
    const since = m.since + 1;
    if (since >= ((W.every && W.every.common) || 3)) return { trigger: o.weapon ? "common" : "ingredient", mem: copy(m, { since: 0 }) };
    return { trigger: null, mem: copy(m, { since }) };
  }
  // how long a line stays up: 55 ms a letter, never less than 2.6 s or more than 6 s
  const holdFor = text => Math.max(2600, Math.min(6000, 55 * String(text || "").length));

  // ------------------------------------------------------------------ the words: spec/grycus.json (window.FORGE_GRYCUS), read when used, so
  // the order the two scripts load in does not matter; without the file the pools are empty and he never speaks
  const EMPTY = { lines: {} }, words = () => root.FORGE_GRYCUS || EMPTY;

  root.Grycus = { N, OUT, R, POSES, MS, frame, at, draw, place, SW, SWING, BLOW_POSES, BLOW_MS, swing, TRIGGERS, REACT, memory, line, opening, after, holdFor, get WORDS() { return words(); } };
})(typeof window !== "undefined" ? window : globalThis);
