// FORGE FOREVER: the Great Hall's painter (design pass 21 sections 3.2, 3.4, 3.8, 3.9, 3.13 and 3.14; built by build 15 stage G).
// Level 2 is three rooms side by side in one world of 3456 x 432, drawn in the cellar's grammar: the Yard (x 0 to 1536, at nightfall in
// falling snow: the north range's stables, guard hall and gallery, the Great Keep's face and its great door; mud and straw trodden through
// fresh snow), the Long Hall (1536 to 2688, one screen tall: torchlit granite, moonlight through arrow slits, a blue runner, pillars, iron
// gates) and the Great Hall (2688 to 3456: the hearth hung with the trolls' hide, the kennels, trestle tables laid for a troll feast, the
// dais with the high table and the lord's chair). Ported from the pass's sketch (docs/design/21-great-hall.sketch.js) and fitted to
// spec/hall.json's exact places.
//
// It plugs into the Troll Gate's painter (proto/gate.js) as an art module: new Gate.Scene(area, Hall.art). What Hall.art supplies:
//   paintRows(A, col, y0, y1, px)  the nine column tiles of 384 x 432 with their light baked (the cellar's four dithered levels toward the
//                                  fire's glow, the slits' cold moon), painted in Gate.Tiles' 2 ms slices; the Long Hall's rock below
//                                  y 216 filled flat. paint(A, col) is the whole tile; the same column paints the same twice
//   pieces(A, S, act)              every standing piece as an actor sorted by its foot with the bodies: the gallery and the keep's balcony
//                                  drawn as groups with their stairs, landings and the bodies on and under them, the stairs, the keep's
//                                  steps and landing, the dais, the hay (burning, burnt), butts, braziers, the rack, the hay cart, the
//                                  well, barrels, the pale tree, steam over the grates, pillars, armour, tables with their feasts,
//                                  benches, the high table and the lord's chair, the chandeliers, the barricades (falling flat) and the
//                                  iron gates (rising into the vault), the yard's trebuchet under snow
//   tufts: false                   no grass
//   lights(ctx, F, t, still, S)    the flicker rings, at most 8 a frame (drawn by the scene after the tiles and under the decals)
//   wall(ctx, F, t, still, S)      the back wall's live things: the torches' flames, the hearth's fire, the kennels' bars and eyes (they
//                                  burst at the Pack), the keep's great door (it bursts open at wave 3), the great hall's doors (they open
//                                  at the second Breather), the hide over the hearth (it burns and falls when the hall is won)
//   weather(ctx, camX, camY, t, still, S, F)  the yard's falling snow in view coordinates (60 flakes; 40 still under less motion), a few
//                                  flakes blowing in at the Long Hall's slits
//   prints(F, S)                   the footprints the bodies leave in the yard's snow this frame, at most 24 (the scene stamps them)
//   markKind, markLook, liveLook, chipLook   the yard's melt under fire and its craters in the snow, its darker ice; the halls' stone
//                                  craters, broken slabs and grey chips
//   take(e, F, S)                  the events it listens for (a phase's art, the waves, the end); it also reads the same from the fight
// The pixels are made without a DOM, so node can check them (tools/test-hall-art.js); canvases are made only when a page asks.
// Plain script, defines window.Hall; needs proto/gate.js (window.Gate, or required in node).
(function (root) {
  "use strict";
  const G = root.Gate || (typeof module !== "undefined" && typeof require === "function" ? require("./gate.js") : null);
  if (!G) throw new Error("proto/hall.js needs proto/gate.js");
  const OUT = G.OUT, BAYER = G.BAYER, hash = G.hash, vnoise = G.vnoise, dith = G.dith, Grid = G.Grid, TW = G.TW, TH = G.TH;
  const rect = G.rect, ell = G.ell, or = G.or, line = G.line, outline = G.outline, drawAt = G.drawAt, blit = G.blit;
  const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ------------------------------------------------------------------ the ramps (the sketch's: ENDESGA 32, the Things' stone, oak, iron and
  // leather, the granite of the north and the night's tones the note names)
  const R = {
    green: ["#265c42", "#3e8948", "#63c74d", "#b4e67a"], iron: ["#262b44", "#3a4466", "#5a6988", "#8b9bb4"], dark: ["#181425", "#262b44", "#3a4466", "#5a6988"],
    steel: ["#3a4466", "#5a6988", "#8b9bb4", "#c0cbdc"], oak: ["#3e2731", "#733e39", "#b86f50", "#e4a672"], oakD: ["#2a1d28", "#3e2731", "#733e39", "#b86f50"],
    leather: ["#2a1d28", "#3e2731", "#733e39", "#b86f50"], stone: ["#4a4450", "#6e6a70", "#9a948c", "#c4bcae"], granite: ["#2c2838", "#3e3a4a", "#555064", "#6e6a78"],
    snow: ["#5a6988", "#8b9bb4", "#c0cbdc", "#ffffff"], straw: ["#733e39", "#be4a2f", "#d77643", "#feae34"], hay: ["#8a4b2a", "#be7a3a", "#e4a24a", "#f6c66a"],
    blue: ["#0b2f55", "#124e89", "#0099db", "#2ce8f5"], bone: ["#c28569", "#e8b796", "#ead4aa", "#fffaf0"], fire: ["#a22633", "#e43b44", "#f77622", "#feae34", "#fee761", "#fff6c8"],
    leaf: ["#3e1428", "#68182c", "#a22633", "#be4a2f"], bark: ["#5a6988", "#8b9bb4", "#c0cbdc", "#ffffff"], charred: ["#181425", "#2a1d28", "#3e2731", "#5a6988"],
    mud: ["#211722", "#2e2029", "#3e2731", "#57373a"], flag: ["#2b2532", "#36303f", "#403a4b", "#4c4558"], flagW: ["#2e2228", "#3b2f36", "#463840", "#54434a"],
    ground: ["#3e2731", "#733e39", "#b86f50", "#e4a672"]
  };
  const SNOW = R.snow, MUD = R.mud, GRAN = R.granite, HAND = ["#265c42", "#3e8948"], EYE = "#fee761", JOINT = "#262036", NIGHT = "#120e1a";
  // the cellar's torch flame (proto/cellar.js FLAME, its fire ramp T.fire)
  const FIRE = ["#120e1a", "#3e1420", "#a22633", "#e43b44", "#f77622", "#feae34", "#fee761", "#fff6c8"];
  const FLAME = [
    ["..3..", ".353.", ".354.", "34543", "35653", "35763", ".376.", "..6.."],
    [".3...", ".33..", ".453.", "34543", "35653", "35763", ".376.", "..6.."],
    ["...3.", "..33.", ".354.", "34553", "35653", "35763", ".376.", "..6.."],
    ["..3..", "..3..", ".353.", "34543", "35663", "36763", ".376.", "..6.."]
  ];

  // ------------------------------------------------------------------ a sized painter (the sketch's region: lit from the top left, o.ball
  // shading a round mass, o.cast a soft shadow down and right, o.spec the glint, o.flat one tone, o.tex a texture over the tone)
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
  const darkOf = ramp => [ramp[0], ramp[0], ramp[1], ramp[2]];
  const sprite = (sp, ox, oy, extra) => G.sprite(sp.px, sp.W, sp.H, ox, oy, extra);
  const done = (sp, ox, oy, extra) => { outline(sp); return sprite(sp, ox, oy, extra); };
  const cache = new Map();
  const once = (key, make) => { let v = cache.get(key); if (!v) { v = make(); cache.set(key, v); } return v; };
  // snow on the top of a grid's columns: the first coloured pixel of each column white (the first under the soot, once outlined), the
  // next pale now and then; top: only where that pixel is at or above the row
  function snowCap(sp, top) {
    for (let x = 0; x < sp.W; x++) {
      let y = 0; while (y < sp.H && !sp.get(x, y)) y++;
      if (y < sp.H && sp.get(x, y) === OUT) y++;
      if (y >= sp.H || !sp.get(x, y) || sp.get(x, y) === OUT || (top !== undefined && y > top)) continue;
      sp.set(x, y, SNOW[3]); if (hash(x, y, 9) < 0.6 && y + 1 < sp.H && sp.get(x, y + 1) && sp.get(x, y + 1) !== OUT) sp.set(x, y + 1, SNOW[2]);
    }
  }
  // a gate.js sprite (outlined already) as a grid, to be given snow
  function gridOf(s) { const sp = new Grid(s.w, s.h); sp.px = s.px.slice(); return sp; }

  // ------------------------------------------------------------------ the area, prepared once: the rooms, the lights by column, the pieces
  // the ground needs (grates, drifts, the shelter under the decks), the banners and torches of the walls
  const YARD = "yard", HALLWAY = "hallway", HALL = "hall";
  const LAYOUT = {
    // the yard's north range (section 3.4): the gatehouse's towers, the stables (their arches at the spec's stables doors), the guard hall
    // and its gallery doors, the Great Keep with its balcony door and its great door
    yard: { floorTop: 96, front: 424, west: 8, east: 1530, passage: [196, 244], arches: [180, 436, 520], hayDoor: [300, 330],
      windows: [584, 648, 712, 776, 840, 904, 968, 1032, 1096, 1160], unlit: [0, 3, 6, 9], galleryDoors: [912, 1000], armoryDoors: [640, 760], kitchen: 1180,
      buttresses: [1206, 1366, 1450, 1518], keepWindows: [[1240, true], [1290, false], [1494, true]], balconyDoor: 1256, greatDoor: [1384, 1432, 34, 88],
      torches: [[78, 54], [1370, 54], [1453, 54]], lanterns: [[230, 74], [478, 74]],
      banners: [[700, 14, false, 34], [1120, 16, true, 30], [1336, 6, false, 40], [1476, 6, false, 40]] },
    // the long hall: torches in iron sconces, arrow slits between them, the side doors at the spec's doors, the armour's alcoves, the doors
    // to the great hall, banners (two of them troll hide); each kept clear of the pillars, which stand to the beam
    hallway: { floorTop: 64, front: 208, west: 1542, east: 2682, door: [96, 152], torches: [1600, 1744, 1872, 1984, 2120, 2252, 2368, 2516, 2660], torchY: 36,
      slits: [1660, 1812, 1930, 2046, 2154, 2300, 2416, 2540], sideDoors: [[1700, 16, 34], [2080, 24, 40, true], [2200, 16, 34]], alcoves: [1680, 2140, 2440],
      hallDoors: [2576, 2640, 14, 64], runner: [122, 150],
      banners: [[1776, 10, false, 34], [1958, 10, true, 30], [2272, 10, false, 34], [2336, 10, true, 30], [2462, 10, false, 34]] },
    // the great hall's north wall: the hearth, the kennels (the spec's kennelW and kennelE doors), windows, banners, the kennels' torches
    hall: { floorTop: 96, front: 424, west: 2694, east: 3442, doors: [230, 270], hearth: [3018, 3126], firebox: [3034, 3110, 50], mantel: 32,
      kennels: [2812, 3196], kennelW: 40, kennelTop: 52, windows: [2724, 2915, 3150, 3290, 3384], torches: [[2790, 58], [3258, 58]],
      banners: [[2880, 10, false, 36], [2994, 10, false, 36], [3330, 10, false, 36], [3418, 12, true, 30]] }
  };
  const PREP = new WeakMap();
  function prep(A) {
    let P = PREP.get(A); if (P) return P;
    const W = A.w || 3456, rooms = (A.rooms && A.rooms.length) ? A.rooms : [{ id: "yard", x0: 0, x1: 1536, look: YARD }, { id: "longHall", x0: 1536, x1: 2688, look: HALLWAY }, { id: "greatHall", x0: 2688, x1: 3456, look: HALL }];
    P = { A, W, seed: A.seed || 2110, rooms, lights: [], grates: [], drifts: [], shelter: [], banners: [], torchesAt: [], cols: Math.ceil(W / TW), colLights: [], moon: [] };
    P.lookX = new Uint8Array(W + 1); for (let x = 0; x <= W; x++) { const r = rooms.find(q => x >= q.x0 && x < q.x1) || rooms[rooms.length - 1]; P.lookX[x] = r.look === HALLWAY ? 1 : r.look === HALL ? 2 : 0; }
    P.hallX0 = (rooms.find(q => q.look === HALLWAY) || { x0: 1536 }).x0; P.hallX1 = (rooms.find(q => q.look === HALLWAY) || { x1: 2688 }).x1; P.greatX0 = (rooms.find(q => q.look === HALL) || { x0: 2688 }).x0;
    const K = A.propKinds || {};
    for (const p of A.props || []) {
      if (p.kind === "grate") P.grates.push({ x0: p.x0, y0: p.y0, x1: p.x1, y1: p.y1, cx: (p.x0 + p.x1) / 2, cy: (p.y0 + p.y1) / 2 });
      else if (p.kind === "drift") P.drifts.push(p);
      else if (p.kind === "brazier") { const look = lookOf(P, p.x), r0 = ((K.brazier || {}).light || {}).r || 40; P.lights.push({ x: p.x, y: p.y, r: look === HALL ? r0 + 12 : r0 + 4, wall: false, fire: true, kind: "brazier" }); }
      else if (p.kind === "table") { const [cx, cy] = chandelierAt(p); P.lights.push({ x: cx, y: cy, r: 46, wall: false, fire: true, kind: "chandelier" }); }
    }
    // the shelter: no snow lies under the gallery and the keep's balcony, nor beside their stairs
    for (const su of A.surfaces || []) { if (!su.rect || lookOf(P, su.rect[0]) !== YARD) continue; const zt = Array.isArray(su.z) ? su.z[1] : su.z || 0; if (zt >= 20) P.shelter.push([su.rect[0] - 2, su.rect[2] + 2, su.rect[3] + 5]); }
    // the walls' own lights: the yard's torches and lanterns, the long hall's torches, the great hall's hearth and its kennels' torches
    const LY = LAYOUT.yard, LH = LAYOUT.hallway, LG = LAYOUT.hall;
    for (const [x, y] of LY.torches) P.lights.push({ x, y: y + 4, r: 30, wall: true, fire: true, kind: "torch", tx: x, ty: y });
    for (const [x, y] of LY.lanterns) P.lights.push({ x, y: y + 4, r: 22, wall: true, fire: true, kind: "lantern", tx: x, ty: y });
    for (let k = 0; k < LY.windows.length; k++) if (!LY.unlit.includes(k)) P.lights.push({ x: LY.windows[k] + 4, y: 30, r: 12, wall: true, fire: false, kind: "window" });
    for (const [wx, lit] of LY.keepWindows) if (lit) P.lights.push({ x: wx + 3, y: 20, r: 10, wall: true, fire: false, kind: "window" });
    for (const x of LH.torches) P.lights.push({ x, y: LH.torchY + 4, r: 56, wall: true, fire: true, kind: "torch", tx: x, ty: LH.torchY });
    P.lights.push({ x: (LG.hearth[0] + LG.hearth[1]) / 2, y: 90, r: 150, wall: true, fire: true, kind: "hearth" });
    for (const [x, y] of LG.torches) P.lights.push({ x, y: y + 4, r: 34, wall: true, fire: true, kind: "torch", tx: x, ty: y });
    P.lights.forEach((L, i) => { L.i = i; L.fy = L.wall ? 0.8 : 0.62; });
    // each column's lights: those whose pool reaches it, of its own room only (no light passes a wall between rooms; every room's edges
    // fall on the columns' edges)
    for (let c = 0; c < P.cols; c++) { const x0 = c * TW, x1 = x0 + TW, room = lookOf(P, x0 + 1); P.colLights.push(P.lights.filter(L => L.x + L.r >= x0 && L.x - L.r < x1 && lookOf(P, L.x) === room)); }
    P.slits = LH.slits;
    // the banners, baked into the back walls, and the torches' sconces, found by x
    for (const look of [YARD, HALLWAY, HALL]) for (const [x, y, troll, h] of LAYOUT[look].banners) { const s = PC.wallBanner(troll, h); P.banners.push({ x0: x - s.ox, y0: y - s.oy, s }); }
    P.bannerX = new Int16Array(W + 1).fill(-1); P.banners.forEach((b, i) => { for (let x = b.x0; x < b.x0 + b.s.w; x++) if (x >= 0 && x <= W) P.bannerX[x] = i; });
    P.sconceX = new Int16Array(W + 1).fill(-1); P.lights.forEach((L, i) => { if (L.tx === undefined) return; for (let x = L.tx - 2; x <= L.tx + 2; x++) if (x >= 0 && x <= W) P.sconceX[x] = i; });
    PREP.set(A, P);
    return P;
  }
  const lookOf = (P, x) => { const v = P.lookX[clamp(Math.floor(x), 0, P.W)]; return v === 1 ? HALLWAY : v === 2 ? HALL : YARD; };
  // a table's chandelier: over its middle, the north row's 20 px west of it and the south row's 20 px east, so that no chain to the beam
  // runs through the chandelier of the table behind
  const chandelierAt = p => { const my = (p.y0 + p.y1) / 2; return [(p.x0 + p.x1) / 2 + (my > 260 ? 20 : -20), my]; };

  // ------------------------------------------------------------------ the light (section 3.9: the cellar's way at level size). A light's
  // closeness k (1 at its fire, 0 at the rim of its pool, vertical distance counted x 0.62 on the floor, x 0.8 for a wall light) pulls a
  // pixel toward the fire's glow in four dithered levels; the slits' moonlight pulls the long hall's floor toward a cold blue in three
  const GLOW = [247, 118, 34], MOON = [90, 105, 136], LEVELS = [0, 0.16, 0.3, 0.44, 0.56];
  function kOf(L, x, y, r) { const dx = x - L.x, dy = (y - L.y) * L.fy; if (dx > r || dx < -r || dy > r || dy < -r) return 0; const k = 1 - Math.sqrt(dx * dx + dy * dy) / r; return k > 0 ? k : 0; }
  // the strongest light at (x, y): every light of its column, one of them (alt) at another radius (a flicker ring's phase)
  function lightK(P, x, y, alt) {
    const list = P.colLights[clamp(Math.floor(x / TW), 0, P.cols - 1)];
    let best = 0;
    for (let i = 0; i < list.length; i++) { const L = list[i], k = kOf(L, x, y, alt && alt.L === L ? alt.r : L.r); if (k > best) best = k; }
    return best;
  }
  function moonAt(P, x, y) {
    if (y < 64 || y >= 140 || x < P.hallX0 || x >= P.hallX1) return 0;
    const t = (y - 64) / 70; let m = 0;
    for (const s of P.slits) { const cx = s + 4 + t * 30; if (Math.abs(x - cx) < 6 - t * 2) m = Math.max(m, 0.7 - t * 0.5); }
    return m;
  }
  const MIXED = new Map();
  function hex2(v) { return (v < 16 ? "0" : "") + v.toString(16); }
  function mixed(c, glvl, wall, mlvl) {
    const key = c + glvl + (wall ? "w" : "f") + mlvl;
    let out = MIXED.get(key);
    if (out) return out;
    let r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
    if (mlvl > 0) { const a = Math.min(0.5, mlvl * 0.22); r += (MOON[0] - r) * a; g += (MOON[1] - g) * a; b += (MOON[2] - b) * a; }
    if (glvl > 0) { const a = LEVELS[glvl] * (wall ? 0.9 : 1); r += (GLOW[0] - r) * a; g += (GLOW[1] - g) * a; b += (GLOW[2] - b) * a; }
    out = "#" + hex2(Math.round(r)) + hex2(Math.round(g)) + hex2(Math.round(b));
    if (out === "#ff0044") out = "#fe0044";   // (never the telegraphs' red; no glow comes near it, but the rule is kept here)
    MIXED.set(key, out);
    return out;
  }
  // a base colour lit at (x, y): mode 0 unlit, 1 the floor, 2 a wall; alt: a light at another radius (the flicker rings)
  function shade(P, x, y, c, mode, alt) {
    if (!mode || !c || c === OUT) return c;
    const b = BAYER[((y & 3) << 2) | (x & 3)] / 16;
    let mlvl = 0;
    if (mode === 1) { const m = moonAt(P, x, y); if (m > 0) mlvl = Math.max(0, Math.floor(m * 3 + b - 0.3)); }
    const k = lightK(P, x, y, alt), glvl = k > 0 ? clamp(Math.floor(k * 4 + b - 0.5), 0, 4) : 0;
    if (!glvl && !mlvl) return c;
    return mixed(c, glvl, mode === 2, mlvl);
  }

  // ------------------------------------------------------------------ the walls' parts (the sketch's): granite courses, arched windows,
  // doors, the night sky with its far towers, the torches' iron sconces
  function skyAt(x, y) {
    for (const [tx, top, hw, broken] of [[160, 4, 11, false], [350, 6, 14, true]]) if (x >= tx - hw && x < tx + hw && y >= top + (broken ? Math.floor(hash(x, 0, 71) * 6) : ((x - tx + hw) % 6 < 3 ? 0 : 2))) return y < top + 3 + (broken ? 6 : 2) && hash(x, y, 72) < 0.5 ? "#262b44" : "#2a2e48";
    return dith(x, y, y / 32 * 0.9) ? "#262b44" : "#181425";
  }
  function graniteAt(x, y, course, w0) {
    const row = Math.floor(y / course), off = row % 2 ? (w0 >> 1) : 0, bx = Math.floor((x + off) / w0), inX = (x + off) % w0, inY = y % course;
    if (inY === course - 1 || inX === 0) return JOINT;
    const t = hash(bx, row, 81);
    let c = t < 0.33 ? GRAN[1] : t < 0.66 ? GRAN[2] : "#4a4658";
    if (inY === 0) c = GRAN[3];
    if (inX === w0 - 1) c = GRAN[0];
    if (hash(x, y, 82) < 0.025) c = GRAN[0];
    return c;
  }
  function win(x, y, x0, y0, w, h, litOn) {
    if (x < x0 || x >= x0 + w || y < y0 || y >= y0 + h) return null;
    const cx = x0 + (w - 1) / 2, arch = y < y0 + w / 2 && ((x - cx) / (w / 2)) ** 2 + ((y - (y0 + w / 2)) / (w / 2)) ** 2 > 1;
    if (arch) return null;
    if (y === y0 + h - 1) return SNOW[3];
    if (y === y0 + h - 2) return GRAN[3];
    const rim = x === x0 || x === x0 + w - 1 || (y < y0 + w / 2 + 1 && ((x - cx) / (w / 2 - 1)) ** 2 + ((y - (y0 + w / 2)) / (w / 2 - 1)) ** 2 > 1);
    if (rim) return GRAN[3];
    const bar = x === Math.round(cx) || y === y0 + Math.round(h / 3);
    if (!litOn) return bar ? "#181425" : (dith(x, y, 0.3) ? "#262b44" : "#1e2238");
    return bar ? "#be4a2f" : (y < y0 + w / 2 + 2 ? "#fee761" : ((x + y) % 4 === 0 ? "#f77622" : "#feae34"));
  }
  // an arched doorway; open: the leaves hang at its sides and its dark shows, else oak planks with iron straps
  function door(x, y, x0, y0, w, h, open, iron) {
    if (x < x0 || x >= x0 + w || y < y0 || y >= y0 + h) return null;
    const cx = x0 + (w - 1) / 2, top = y0 + w / 2;
    if (y < top && ((x - cx) / (w / 2)) ** 2 + ((y - top) / (w / 2)) ** 2 > 1) return null;
    const rimArch = y < top + 1 && ((x - cx) / (w / 2 - 1.5)) ** 2 + ((y - top) / (w / 2 - 1.5)) ** 2 > 1;
    if (rimArch || x === x0 || x === x0 + w - 1) return R.stone[2];
    if (open) { if (x < x0 + 4 || x > x0 + w - 5) return iron && (y - y0) % 7 === 3 ? R.iron[2] : ((y % 5 === 0) ? R.oakD[0] : R.oakD[2]); return dith(x, y, (y - y0) / h * 0.4) ? "#1e1828" : NIGHT; }
    return (x - x0) % 4 === 0 ? R.oakD[0] : ((y - y0) % 9 === 4 ? R.iron[2] : (x < cx ? R.oakD[2] : R.oakD[1]));
  }
  // a torch's iron sconce on a wall (its flame drawn live, wall()): a cup, its stem and bracket, the soot its smoke left on the stone
  function sconceAt(P, x, y) {
    const i = P.sconceX[x]; if (i < 0) return null;
    const L = P.lights[i], tx = L.tx, ty = L.ty, dx = x - tx;
    if (y === ty && dx >= -1 && dx <= 1) return R.iron[2];
    if (y === ty + 1 && dx >= -1 && dx <= 1) return R.iron[1];
    if (dx === 0 && y >= ty + 2 && y <= ty + 5) return R.iron[0];
    if (y === ty + 5 && (dx === -1 || dx === 1)) return R.iron[0];
    if (dx >= -1 && dx <= 1 && y >= ty - 16 && y < ty - 8 && dith(x, y, 0.35 - (ty - 8 - y) * 0.03)) return JOINT;
    return null;
  }
  function bannerAt(P, x, y) {
    const i = P.bannerX[x]; if (i < 0) return null;
    const b = P.banners[i], sx = x - b.x0, sy = y - b.y0;
    if (sy < 0 || sy >= b.s.h) return null;
    return b.s.px[sy * b.s.w + sx] || null;
  }
  // the oak beam along an indoor room's top (the smithy's)
  const beamAt = (x, y) => y === 0 ? OUT : (y === 1 ? R.oak[2] : y === 7 ? R.oakD[0] : ((x * 3 + y * 7) % 13 === 0 ? "#5a3030" : R.oakD[1]));
  // a side wall's top, seen from above as the cellar's are: a lit rim on its inner side, dark stone, joints; d is the distance from the rim
  const wallTop = (d, y, snowy) => snowy && d >= 1 ? (dith(d, y, 0.85 - d * 0.04) ? SNOW[d < 3 ? 3 : 2] : SNOW[1]) : d === 0 ? GRAN[3] : d === 1 ? "#4a4658" : (d % 4 === 2 ? JOINT : (y % 9 === 3 ? "#262036" : "#2c2638"));

  // ------------------------------------------------------------------ the yard (x 0 to 1536)
  function yardBack(P, x, y) {
    const LY = LAYOUT.yard, bn = bannerAt(P, x, y); if (bn) return bn;
    const sc = sconceAt(P, x, y); if (sc) return sc;
    if (x < 96) {   // the gatehouse's inner towers: merlons capped with snow to the sky, an open arch into the gate's passage
      if (y < 4) return ((x >> 2) % 2) ? (y < 2 ? skyAt(x, y) : SNOW[3]) : (y === 0 ? SNOW[3] : graniteAt(x, y, 7, 13));
      const d = door(x, y, 20, 40, 40, 56, true); if (d) return d;
      return graniteAt(x, y, 7, 13);
    }
    const eave = x < 560 ? 30 : x < 1200 ? 12 : 0;
    if (eave > 0) {   // a roof seen from the front: slates under thick snow, the eave's edge, icicles under it
      if (y < eave - 14) return skyAt(x, y);
      if (y < eave) { const r = eave - y; if (r <= 2) return y === eave - 1 ? SNOW[0] : SNOW[1]; return hash(x, y, 83) < 0.08 ? R.dark[2] : (dith(x, y, 0.75 - r * 0.02) ? SNOW[3] : SNOW[2]); }
      if (y === eave && hash(x, 0, 84) < 0.4) return SNOW[2];
      if (y > eave && y < eave + 4 && hash(x, 0, 85) < 0.25 && y - eave < 1 + Math.floor(hash(x, 1, 85) * 4)) return SNOW[3];
    }
    if (x < 560) {   // the stables: a timber loft with its hay door and hoist over granite, the stable arches with their doors hanging open
      if (y < 60) {
        if (x >= LY.hayDoor[0] && x < LY.hayDoor[1] && y >= 36 && y < 58) return y > 50 ? (hash(x, y, 86) < 0.6 ? R.hay[2] : R.hay[1]) : (dith(x, y, 0.2) ? R.hay[1] : OUT);
        if (y === 33 && x >= 296 && x < 352) return R.oakD[2];
        if (x === 349 && y > 33 && y < 44) return R.oak[2];
        if (y === 44 && (x === 348 || x === 350)) return R.iron[2];
        if (x % 32 < 3 || y === 31 || y === 45 || y === 59) return (x % 32 === 0 || y === 59) ? R.oakD[0] : R.oakD[1];
        return (x % 4 === 0) ? "#2e2029" : (hash(x, y, 87) < 0.05 ? "#4f3537" : "#3e2731");
      }
      for (const ax of LY.arches) { const d = door(x, y, ax - 16, 64, 32, 32, true); if (d) return d; }
      return graniteAt(x, y, 7, 15);
    }
    if (x < 1200) {   // the armory and the guard hall: two storeys of granite, tall windows (some lit), the doors onto the gallery and under it
      for (const g of LY.galleryDoors) { const d = door(x, y, g - 7, 44, 14, 22, true); if (d) return d; }
      if (y === 60 || y === 61) return y === 60 ? SNOW[2] : GRAN[3];
      for (let k = 0; k < LY.windows.length; k++) { const w = win(x, y, LY.windows[k], 18, 8, 22, !LY.unlit.includes(k)); if (w) return w; }
      for (const dx of LY.armoryDoors) { const d = door(x, y, dx - 8, 66, 16, 30, false); if (d) return d; }
      for (const dx of LY.galleryDoors) { const d = door(x, y, dx - 8, 70, 16, 26, true); if (d) return d; }
      { const d = door(x, y, LY.kitchen - 7, 72, 14, 24, true); if (d) return d; }
      return graniteAt(x, y, 7, 15);
    }
    // the Great Keep: big courses to the top of the view, buttresses, high windows, the door onto its balcony, the great door's arch
    for (const bx of LY.buttresses) if (x >= bx && x < bx + 8) return x === bx ? GRAN[3] : (x === bx + 7 ? JOINT : graniteAt(x, y, 9, 8));
    { const g = LY.greatDoor, d = arch(x, y, g[0], g[1], g[2], g[3]); if (d) return d; }
    { const d = door(x, y, LY.balconyDoor - 7, 44, 14, 22, true); if (d) return d; }
    for (const [wx, lit] of LY.keepWindows) { const w = win(x, y, wx, 10, 6, 20, lit); if (w) return w; }
    if (y < 2) return SNOW[3];
    return graniteAt(x, y, 9, 18);
  }
  // a great door's arch: a ring of big voussoirs round a dark opening (its leaves drawn live, wall()); the keep's hall glows deep inside
  function arch(x, y, x0, x1, y0, y1) {
    if (x < x0 || x >= x1 || y < y0 || y >= y1) return null;
    const w = x1 - x0, cx = x0 + (w - 1) / 2, r = w / 2, top = y0 + r, rr = (x - cx) ** 2 + (y - top) ** 2;
    if (y < top && rr > r * r) return null;
    const inner = r - 4, openArch = y >= top ? Math.abs(x - cx) <= inner : rr <= inner * inner;
    if (!openArch) { const a = y < top ? Math.atan2(y - top, x - cx) : (x < cx ? Math.PI : 0), k = Math.floor((a + Math.PI) / 0.3); if (y < top && (Math.abs(x - cx) < 1.5) && y < y0 + 5) return R.stone[3]; return (y >= top && (y - y0) % 7 === 0) || (y < top && hash(k, 0, 88) < 0.5 && Math.abs(Math.sqrt(rr) - r + 2) < 0.6) ? JOINT : (k % 2 ? R.stone[2] : GRAN[3]); }
    const depth = (y - y0) / (y1 - y0);
    if (depth > 0.72 && dith(x, y, (depth - 0.72) * 2.2)) return "#3e1420";
    return dith(x, y, 0.15 + depth * 0.25) ? "#1e1828" : NIGHT;
  }
  // the yard's floor: mud and straw trodden through fresh snow; the snow thick along the walls, in the corners and the drifts, a dusting
  // elsewhere (at most a third of the pixels in an arena's middle); the cobbled apron before the keep, the melted rings round the steam
  // grates, the dark under the gallery and the balcony, the broken gate's splinters at the west passage
  function yardFloor(P, x, y) {
    const S = P.seed, LY = LAYOUT.yard;
    const n = vnoise(x, y, 14, S), n2 = vnoise(x, y, 5, S + 1);
    let c = dith(x, y, n * 0.8) ? MUD[2] : MUD[1];
    if (n2 > 0.72 && dith(x, y, 0.5)) c = MUD[3];
    if (hash(x, y, S + 2) > (x < 600 && y < 230 ? 0.972 : 0.985)) c = hash(x, y, S + 3) < 0.5 ? "#b86f50" : "#e4a672";   // straw, more by the stables
    if (x > 1180 && y < 200 && dith(x, y, clamp((x - 1180) / 50, 0, 1) * clamp((200 - y) / 30, 0, 1))) {   // the cobbled apron before the keep
      const row = Math.floor(y / 4), cx = (x + (row % 2) * 2) % 5, cy = y % 4, sx = Math.floor((x + (row % 2) * 2) / 5);
      c = (cx === 0 || cy === 0) ? (hash(sx, row, S + 7) < 0.35 ? SNOW[1] : "#1e1828") : (cx === 1 && cy === 1 ? "#5d5866" : (hash(sx, row, S + 8) < 0.5 ? "#3e3a4a" : "#4a4458"));
    }
    if (x < 44 && y >= LY.passage[0] - 4 && y < LY.passage[1] + 4) {   // the broken gate's splinters, strewn in from the passage
      const k = hash(x >> 1, y >> 1, S + 9); if (k < 0.12 - x * 0.002) return k < 0.04 ? R.oak[0] : k < 0.08 ? R.oak[1] : R.oak[2];
    }
    // the snow
    const wallD = Math.min(y - LY.floorTop, LY.front - y, x - LY.west, LY.east - x), edge = clamp(1 - wallD / 22, 0, 1), drift = vnoise(x, y, 36, S + 4), fine = vnoise(x, y, 7, S + 6);
    let s = Math.max(edge, (drift - 0.6) * 2.6, 0) + (fine - 0.5) * 0.35;
    for (const d of P.drifts) { const dx = Math.max(d.x0 - x, 0, x - d.x1), dy = Math.max(d.y0 - y, 0, y - d.y1), dd = Math.hypot(dx, dy); if (dd < 8) s = Math.max(s, 0.9 - dd * 0.06 + (fine - 0.5) * 0.2); }
    const path = Math.abs(y - (232 + Math.sin(x / 120) * 26)) < 30 || (x < 300 && Math.abs(y - 220) < 40);
    if (path) s *= 0.35;
    for (const g of P.grates) {   // the steam grates over the hot springs: iron bars in a frame, the snow melted black round them
      if (x >= g.x0 && x < g.x1 && y >= g.y0 && y < g.y1) return (x === g.x0 || x === g.x1 - 1 || y === g.y0 || y === g.y1 - 1) ? R.iron[2] : ((x - g.x0) % 3 === 1 ? R.iron[1] : "#181425");
      const d = Math.hypot(x - g.cx, (y - g.cy) * 1.4);
      if (d < 18) { s = 0; c = dith(x, y, 0.4 + (d < 11 ? 0.2 : 0)) ? "#181425" : MUD[0]; if (hash(x, y, S + 5) < 0.05) c = R.dark[3]; }
    }
    for (const [x0, x1, y1] of P.shelter) if (x >= x0 && x < x1 && y < y1) { s = 0; c = dith(x, y, 0.55) ? "#181425" : MUD[0]; }
    if (s > 0.5) c = s < 0.56 ? SNOW[1] : (fine > 0.56 ? SNOW[3] : SNOW[2]);
    else if (s > 0.3 && dith(x, y, (s - 0.3) * 1.6)) c = SNOW[1];
    if (y < LY.floorTop + 5) c = dith(x, y, (LY.floorTop + 5 - y) / 6) ? MUD[0] : c;   // the shadow at the wall's foot
    return c;
  }
  // a base pixel and its light mode into OUTB: [colour, mode]
  const OUTB = [null, 0];
  function yardBase(P, x, y, o) {
    const LY = LAYOUT.yard;
    if (y >= LY.front) { o[0] = y === LY.front ? R.dark[2] : (dith(x, y, 0.8) ? SNOW[3] : SNOW[2]); o[1] = 1; return; }   // the south range's eaves under snow
    if (y < LY.floorTop) { o[0] = yardBack(P, x, y); o[1] = 2; return; }
    const inPassage = y >= LY.passage[0] && y < LY.passage[1];
    if (x < LY.west) {   // the west wall's top under snow, the gate's passage through it (dark going west, the broken gate's splinters), jamb stones either side
      if (inPassage) { const d = LY.west - 1 - x, k = hash(x, y >> 1, P.seed + 10); o[0] = k < 0.07 ? R.oak[k < 0.03 ? 0 : 1] : d >= 6 ? NIGHT : d >= 4 ? "#1b1525" : (dith(x, y, 0.45) ? "#231c2e" : MUD[0]); o[1] = 1; return; }
      if (y === LY.passage[0] - 1 || y === LY.passage[1] || y === LY.passage[0] - 2 || y === LY.passage[1] + 1) { o[0] = (y === LY.passage[0] - 2 || y === LY.passage[1]) ? GRAN[3] : JOINT; o[1] = 1; return; }
      o[0] = wallTop(LY.west - 1 - x, y, true); o[1] = 1; return;
    }
    if (x === LY.west && !inPassage) { o[0] = OUT; o[1] = 0; return; }
    if (x >= LY.east) { o[0] = x === LY.east ? OUT : wallTop(x - LY.east - 1, y, true); o[1] = x === LY.east ? 0 : 1; return; }   // the east wall's top
    o[0] = yardFloor(P, x, y); o[1] = 1;
  }

  // ------------------------------------------------------------------ the long hall (x 1536 to 2688; the cellar's shape: beam, back wall,
  // floor, the south wall's top, rock below)
  function hallwayBack(P, x, y) {
    const LH = LAYOUT.hallway, bn = bannerAt(P, x, y); if (bn) return bn;
    const sc = sconceAt(P, x, y); if (sc) return sc;
    for (const s of LH.slits) if (x >= s && x < s + 4 && y >= 16 && y < 38) return y === 37 ? SNOW[3] : (x === s || x === s + 3 ? "#181425" : (dith(x, y, 0.5) ? SNOW[0] : "#3a4466"));   // an arrow slit: the night, a sill of snow
    for (const ax of LH.alcoves) if (x >= ax - 8 && x <= ax + 8 && y >= 30) { const top = 30 + 8 - Math.sqrt(Math.max(0, 64 - (x - ax) ** 2)); if (y >= top) return (x === ax - 8 || x === ax + 8 || y < top + 1) ? GRAN[3] : (dith(x, y, 0.3) ? "#1e1828" : "#262036"); }   // an alcove
    for (const [dx, w, h, iron] of LH.sideDoors) { const d = door(x, y, dx - w / 2, 64 - h, w, h, true, iron); if (d) return d; }
    { const g = LH.hallDoors, d = arch(x, y, g[0], g[1], g[2], g[3]); if (d) return d; }   // the great hall's doors (their leaves drawn live)
    return graniteAt(x, y, 7, 16);
  }
  function hallwayFloor(P, x, y) {
    const LH = LAYOUT.hallway, fy = y - LH.floorTop, row = Math.floor(fy / 5), off = row % 2 ? 9 : 0, seam = (x + off) % 18 === 0 || fy % 5 === 0;
    let c = seam ? "#241c26" : ((x + off) % 18 < 2 || fy % 5 === 1) ? R.flag[3] : (hash(Math.floor((x + off) / 18), row, 92) < 0.5 ? R.flag[2] : R.flag[1]);
    const [r0, r1] = LH.runner;
    if (y >= r0 && y <= r1) c = (y === r0 || y === r1) ? "#3a4466" : ((y === r0 + 2 || y === r1 - 2) ? ((x % 4 < 2) ? "#be4a2f" : "#262b44") : (dith(x, y, 0.15) ? "#1e2238" : "#262b44"));
    if (y < LH.floorTop + 4) c = dith(x, y, (LH.floorTop + 4 - y) / 4) ? "#1e1828" : c;
    return c;
  }
  function hallwayBase(P, x, y, o) {
    const LH = LAYOUT.hallway;
    if (y >= 216) { o[0] = NIGHT; o[1] = 0; return; }   // the rock under the south wall, filled flat
    if (y < 8) { o[0] = beamAt(x, y); o[1] = 0; return; }   // the oak beam, the room's whole width
    if (y >= LH.front) { o[0] = y === LH.front ? GRAN[3] : (y < LH.front + 3 ? GRAN[2] : JOINT); o[1] = 0; return; }   // the south wall's top
    if (x < LH.west) {   // the west wall's top, cut by the doorway from the keep's great door (an oak leaf swung open against its north jamb)
      const d = LH.west - 1 - x, [y0, y1] = LH.door;
      if (y >= y0 && y <= y1 && y >= LH.floorTop) { o[0] = d >= 4 ? "#120e1a" : (d >= 2 ? "#1b1525" : "#231c2e"); if (y <= y0 + 3) o[0] = R.oak[clamp(y - y0, 0, 3)]; o[1] = 1; return; }
      if (y >= LH.floorTop && (y === y0 - 2 || y === y1 + 1)) { o[0] = GRAN[3]; o[1] = 0; return; }
      if (y >= LH.floorTop && (y === y0 - 1 || y === y1 + 2)) { o[0] = JOINT; o[1] = 0; return; }
      o[0] = x === LH.west - 1 - 5 ? GRAN[1] : wallTop(d, y, false); o[1] = 0; return;
    }
    if (x === LH.west && !(y >= LH.door[0] && y <= LH.door[1])) { o[0] = OUT; o[1] = 0; return; }
    if (x >= LH.east) { o[0] = x === LH.east ? OUT : wallTop(x - LH.east - 1, y, false); o[1] = 0; return; }
    if (y < LH.floorTop) { o[0] = hallwayBack(P, x, y); o[1] = 2; return; }
    o[0] = hallwayFloor(P, x, y); o[1] = 1;
  }

  // ------------------------------------------------------------------ the great hall (x 2688 to 3456)
  function hallBack(P, x, y) {
    const LG = LAYOUT.hall, bn = bannerAt(P, x, y); if (bn) return bn;
    const sc = sconceAt(P, x, y); if (sc) return sc;
    // the great hearth: a stone surround and an oak mantel, the firebox (its fire drawn live), the hood carved with the wolf
    if (x >= LG.hearth[0] && x < LG.hearth[1]) {
      const [f0, f1, fy] = LG.firebox;
      if (y >= LG.mantel && y < LG.mantel + 4) return y === LG.mantel ? R.oak[3] : y === LG.mantel + 3 ? R.oakD[0] : R.oak[1];
      if (y >= fy && x >= f0 && x < f1) { const t = (y - fy) / 46; if (y >= 90) return hash(x, y, 97) < 0.5 ? (hash(x, y, 98) < 0.4 ? "#f77622" : "#3e1420") : (x % 9 < 6 ? R.oakD[1] : R.oakD[0]); return dith(x, y, 0.3 + t * 0.4) ? "#3e1420" : NIGHT; }
      if (y < LG.mantel) { const d = Math.hypot(x - 3072, (y - 18) * 1.3); if (d < 9) return d < 6 && ((((x - 3072) * (x - 3072)) + (y - 18) * 3) % 5 === 0) ? "#ffffff" : R.stone[d < 6 ? 2 : 1]; }
      return ((x - LG.hearth[0]) % 12 === 0 || (y - 8) % 8 === 0) ? R.stone[0] : (x < 3072 ? R.stone[2] : R.stone[1]);
    }
    // the kennels: barred arches (the bars and the eyes drawn live), the dark behind them
    for (const kx of LG.kennels) if (x >= kx - 2 && x < kx + LG.kennelW + 2 && y >= LG.kennelTop - 2) {
      const cx = kx + LG.kennelW / 2, r = LG.kennelW / 2, top = LG.kennelTop + r, rr = (x + 0.5 - cx) ** 2 + (y - top) ** 2;
      if (y >= top ? (x >= kx && x < kx + LG.kennelW) : rr <= r * r) return dith(x, y, 0.2) ? "#1e1828" : NIGHT;
      if (y >= top ? (x >= kx - 2 && x < kx + LG.kennelW + 2) : rr <= (r + 2) * (r + 2)) return (y - LG.kennelTop) % 6 === 0 ? JOINT : R.stone[1];
    }
    for (const wx of LG.windows) { const w = win(x, y, wx, 12, 8, 30, false); if (w) return w === "#181425" ? w : w === SNOW[3] || w === GRAN[3] ? w : (dith(x, y, 0.5) ? "#3a4466" : "#262b44"); }   // tall windows, the moon behind them
    if (y > 90) return dith(x, y, (y - 90) / 6) ? "#1e1828" : graniteAt(x, y, 8, 17);
    return graniteAt(x, y, 8, 17);
  }
  function hallFloor(P, x, y) {
    const LG = LAYOUT.hall, fy = y - LG.floorTop, row = Math.floor(fy / 6), off = row % 2 ? 10 : 0, seam = (x + off) % 20 === 0 || fy % 6 === 0;
    let c = seam ? "#22181f" : ((x + off) % 20 < 2 || fy % 6 === 1) ? R.flagW[3] : (hash(Math.floor((x + off) / 20), row, 93) < 0.5 ? R.flagW[2] : R.flagW[1]);
    if (hash(x, y, 94) > 0.982) c = hash(x, y, 95) < 0.6 ? "#b86f50" : "#e4a672";   // rushes
    if (hash(Math.floor(x / 3), Math.floor(y / 2), 96) > 0.997) c = R.bone[1];   // bones
    if (vnoise(x, y, 9, 99) > 0.8 && dith(x, y, 0.5)) c = "#2a1d28";   // spilled ale
    if (y < LG.floorTop + 9 && x >= LG.hearth[0] + 8 && x < LG.hearth[1] - 8 && dith(x, y, 0.6 - (y - LG.floorTop) * 0.06)) c = hash(x, y, 100) < 0.5 ? "#4a4450" : "#6e6a70";   // the hearth's ash
    if (y < LG.floorTop + 5) c = dith(x, y, (LG.floorTop + 5 - y) / 6) ? "#1e1828" : c;
    return c;
  }
  function hallBase(P, x, y, o) {
    const LG = LAYOUT.hall;
    if (y >= LG.front) { o[0] = y === LG.front ? GRAN[3] : (y < LG.front + 3 ? GRAN[2] : JOINT); o[1] = 0; return; }
    if (y < 8) { o[0] = beamAt(x, y); o[1] = 0; return; }   // the oak beam, the room's whole width
    const inDoor = y >= LG.doors[0] && y < LG.doors[1];
    if (x < LG.west) {   // the west wall's top: the doorway the party comes in by
      if (inDoor) { o[0] = hallFloor(P, LG.west, y); o[1] = 1; return; }
      if (y === LG.doors[0] - 1 || y === LG.doors[1]) { o[0] = GRAN[3]; o[1] = 0; return; }
      o[0] = wallTop(LG.west - 1 - x, y, false); o[1] = 0; return;
    }
    if (x >= LG.east) {   // the east wall's top: the lord's door, the way up to the keep (dark steps going up)
      if (inDoor) { const d = x - LG.east; o[0] = d >= 9 ? NIGHT : (d >= 4 ? ((y - LG.doors[0]) % 5 === 0 ? "#3a3448" : "#231c2e") : hallFloor(P, LG.east - 1, y)); o[1] = d < 4 ? 1 : 0; return; }
      if (y === LG.doors[0] - 1 || y === LG.doors[1]) { o[0] = GRAN[3]; o[1] = 0; return; }
      o[0] = x === LG.east ? OUT : wallTop(x - LG.east - 1, y, false); o[1] = 0; return;
    }
    if (x === LG.west && !inDoor) { o[0] = OUT; o[1] = 0; return; }
    if (y < LG.floorTop) { o[0] = hallBack(P, x, y); o[1] = 2; return; }
    o[0] = hallFloor(P, x, y); o[1] = 1;
  }

  // ------------------------------------------------------------------ the tiles
  function baseOf(P, x, y, o) { const v = P.lookX[clamp(x, 0, P.W)]; if (v === 0) yardBase(P, x, y, o); else if (v === 1) hallwayBase(P, x, y, o); else hallBase(P, x, y, o); return o; }
  // the pixel of the still world at (x, y), lit: what the tile holds
  function pixel(P, x, y) { baseOf(P, x, y, OUTB); return shade(P, x, y, OUTB[0], OUTB[1], null); }
  // paint rows y0 to y1 (exclusive) of column col into px (Gate.Tiles calls this in its slices); the long hall's rock below y 216 is flat
  function paintRows(A, col, y0, y1, px) {
    const P = prep(A), X0 = col * TW;
    for (let y = y0; y < y1; y++) {
      const o = y * TW;
      if (y >= 216 && P.lookX[X0] === 1 && P.lookX[Math.min(P.W, X0 + TW - 1)] === 1) { for (let x = 0; x < TW; x++) px[o + x] = NIGHT; continue; }
      for (let x = 0; x < TW; x++) px[o + x] = pixel(P, X0 + x, y);
    }
    return px;
  }
  function paint(A, col) { const px = new Array(TW * TH).fill(null); paintRows(A, col, 0, TH, px); return { px, W: TW, H: TH, col }; }
  // the unlit colour at (x, y), and whether it is snow (the prints' ground)
  const SNOWY = new Set([SNOW[1], SNOW[2], SNOW[3]]);
  function snowyAt(P, x, y) { if (lookOf(P, x) !== YARD || y < LAYOUT.yard.floorTop || y >= LAYOUT.yard.front || x <= LAYOUT.yard.west || x >= LAYOUT.yard.east) return false; return SNOWY.has(yardFloor(P, x, y)); }

  // ------------------------------------------------------------------ the pieces' art (section 3.4), each { px, w, h, ox, oy, canvas() } drawn
  // with (ox, oy) on its foot: a circle's centre, a rect's bottom-left
  const PC = {};
  // a hay bale 14 x 8, 14 tall (a stack 24): its top of straw under snow, its sides lashed with twine; burning on four frames (no snow)
  PC.hay = (stack, burn) => once("hay" + (stack ? 1 : 0) + "|" + (burn === undefined || burn === null ? "n" : burn & 3), () => {
    const lit = burn !== undefined && burn !== null, f = lit ? burn & 3 : 0, ht = stack ? 24 : 14, W = 16, flameRoom = lit ? 18 : 0, H = 8 + ht + 2 + flameRoom, sp = new Grid(W, H), top = H - 2 - 8 - ht + 1;
    for (const b of stack ? [0, 10] : [0]) {
      const y1 = H - 2 - b, y0 = y1 - 8 - 13;
      region(sp, rect(1, y0 + 8, 14, y1), R.hay, { tex: (x, y, c) => (y === y0 + 8 + 3 || y === y0 + 8 + 9) ? R.leather[1] : (hash(x, y, 11) < 0.25 ? R.hay[0] : (x % 3 === 0 ? R.hay[1] : null)), spec: (x, y) => x === 2 && y < y0 + 11 });
      region(sp, rect(1, y0 + 1, 14, y0 + 8), R.hay, { tex: (x, y, c) => hash(x, y, 12) < 0.3 ? R.hay[3] : (hash(x, y, 13) < 0.2 ? R.hay[1] : R.hay[2]) });
    }
    if (lit) {
      for (let k = 0; k < 40; k++) { const x = 1 + Math.floor(hash(k, f, 14) * 14), y = top + 2 + Math.floor(hash(k, f, 15) * (ht + 4)); if (sp.get(x, y)) sp.set(x, y, hash(k, 3, 16) < 0.5 ? "#2a1d28" : "#3e2731"); }
      for (let x = 2; x <= 13; x++) { const h = 6 + Math.floor(hash(x, f, 17) * 9) + (x > 4 && x < 11 ? 4 : 0); for (let y = 0; y < h; y++) if (!(y > h - 3 && (x + f) % 2)) sp.set(x, top + 2 - y, y > h - 3 ? R.fire[5] : y > h - 5 ? R.fire[4] : y > h - 8 ? R.fire[3] : y > 2 ? R.fire[2] : R.fire[1]); }
    } else snowCap(sp);
    return done(sp, 1, H - 2, { ht, depth: 8 });
  });
  // burnt hay: a low black heap, its straw glowing for 3 s (glow 1) then cold; loose hay: a bale broken by a blow, flattened and strewn
  PC.hayAsh = (v, glow) => once("hayAsh" + (v | 0) % 3 + (glow ? "g" : ""), () => {
    const sp = new Grid(18, 10);
    region(sp, (x, y) => ell(8.5, 5.5, 7.5, 2.8)(x, y) && hash(x, y, 120 + (v | 0)) > 0.1, R.charred, { ball: [6, 4, 7] });
    for (let k = 0; k < 9; k++) { const x = 3 + Math.floor(hash(k, v | 0, 121) * 12), y = 3 + Math.floor(hash(k, v | 0, 122) * 4); if (sp.get(x, y)) sp.set(x, y, glow ? (k % 3 ? "#f77622" : "#feae34") : (k % 3 ? "#5a6988" : "#3e2731")); }
    return done(sp, 1, 7);
  });
  PC.hayLoose = v => once("hayLoose" + (v | 0) % 3, () => {
    const sp = new Grid(20, 10);
    region(sp, (x, y) => ell(9.5, 5.5, 8.5, 3.2)(x, y) && hash(x, y, 125 + (v | 0)) > 0.18, R.hay, { tex: (x, y, c) => hash(x, y, 126) < 0.3 ? R.hay[3] : hash(x, y, 127) < 0.3 ? R.hay[1] : null });
    return done(sp, 2, 7);
  });
  // an archery butt: a straw target on an A-frame, 16 tall, two arrows in it, snow on its top
  PC.butt = () => once("butt", () => {
    const sp = new Grid(15, 21);
    region(sp, or(line(3, 19, 7, 6, 1), line(11, 19, 7, 6, 1), line(7, 6, 7, 19, 1)), R.oakD);
    region(sp, ell(7, 9, 5.5, 5.5), R.straw, { tex: (x, y, c) => { const d = Math.hypot(x - 7, y - 9); return d < 1.3 ? "#feae34" : d < 2.8 ? "#ead4aa" : d < 4 ? "#a22633" : null; } });
    region(sp, line(9, 7, 13, 4, 1), R.oak, { flat: 2 }); sp.set(13, 4, "#ead4aa"); region(sp, line(5, 11, 1, 13, 1), R.oak, { flat: 2 }); sp.set(1, 13, "#ead4aa");
    snowCap(sp, 6);
    return done(sp, 7, 19);
  });
  // a brazier: an iron basket on three legs, 14 tall, its coals and fire on four frames
  PC.brazier = f => once("brazier" + (f & 3), () => {
    const sp = new Grid(15, 26), fr = f & 3;
    region(sp, or(line(3, 24, 6, 14, 1), line(11, 24, 8, 14, 1), line(7, 24, 7, 15, 1)), R.iron);
    region(sp, or(ell(7, 13, 6, 2.5), rect(2, 11, 12, 13)), R.iron, { tex: (x, y, c) => (x % 2 === 0 && y === 12) ? R.iron[3] : null });
    for (let x = 3; x <= 11; x++) sp.set(x, 10, hash(x, fr, 21) < 0.5 ? R.fire[2] : R.fire[3]);
    const F = [["..5.5..", ".55455.", "5443445", "4333334"], [".5...5.", ".54.45.", "5444335", "4333334"], ["...5...", ".5545..", "5434435", "4333334"], [".5..5..", "..5455.", "5443445", "4333344"]][fr];
    for (let j = 0; j < F.length; j++) for (let k = 0; k < 7; k++) { const ch = F[j][k]; if (ch !== ".") sp.set(4 + k, 6 + j, R.fire[+ch - 1]); }
    sp.set(7, 2 + fr % 2, R.fire[4]);
    return done(sp, 7, 24);
  });
  // a deck (the gallery's dark oak planks, the keep's balcony's stone): its top d deep, its slab, snow along its front edge
  PC.deck = (w, d, slab, look) => once("deck" + w + "|" + d + "|" + slab + "|" + look, () => {
    const W = w + 2, H = d + slab + 2, sp = new Grid(W, H), stone = look === "stone";
    region(sp, rect(1, 1, W - 2, d), stone ? R.stone : R.oak, { tex: (x, y, c) => stone ? ((x + y * 3) % 9 === 0 ? R.stone[0] : (y < 3 ? R.stone[3] : R.stone[2])) : (x % 7 === 0 ? R.oak[0] : (y < 3 ? R.oak[3] : (hash(x, y, 31) < 0.2 ? R.oak[1] : R.oak[2]))) });
    region(sp, rect(1, d + 1, W - 2, H - 2), stone ? darkOf(R.stone) : R.oakD, { tex: (x, y, c) => (!stone && x % 6 === 0) ? "#2a1d28" : (stone && x % 5 === 0 ? R.stone[0] : null) });
    for (let x = 1; x < W - 1; x++) { if (hash(x, 1, 32) < 0.7) sp.set(x, d, SNOW[2]); if (hash(x, 2, 32) < 0.5) sp.set(x, d - 1, SNOW[hash(x, 3, 32) < 0.5 ? 3 : 2]); if (hash(x, 4, 32) < 0.35) sp.set(x, 2, SNOW[2]); }
    return done(sp, 1, H - 2, { ht: 0 });
  });
  // a landing at a stair's head (spec 55bfec7): the deck's top (planks or stone) at its height, its face the deck's slab over the stair's
  // risers, down to the ground (solid under), snow along its front edge, so stair, landing and deck read as one gallery
  PC.landing = (w, d, z, look, slab) => once("landing" + w + "|" + d + "|" + z + "|" + look + "|" + slab, () => {
    const stone = look === "stone", ramp = stone ? R.stone : R.oak, W = w + 2, H = d + z + 2, sp = new Grid(W, H), sl = slab === undefined ? 4 : slab;
    region(sp, rect(1, 1, W - 2, d), ramp, { tex: (x, y, c) => stone ? ((x + y * 3) % 9 === 0 ? R.stone[0] : (y < 3 ? R.stone[3] : R.stone[2])) : (x % 7 === 0 ? R.oak[0] : (y < 3 ? R.oak[3] : (hash(x, y, 31) < 0.2 ? R.oak[1] : R.oak[2]))) });
    if (sl > 0) region(sp, rect(1, d + 1, W - 2, Math.min(H - 2, d + sl)), stone ? darkOf(R.stone) : R.oakD, { tex: (x, y, c) => (!stone && x % 6 === 0) ? "#2a1d28" : (stone && x % 5 === 0 ? R.stone[0] : null) });
    if (d + sl + 1 <= H - 2) region(sp, rect(1, d + sl + 1, W - 2, H - 2), ramp, { tex: (x, y, c) => (y - d - sl) % 4 === 0 ? ramp[0] : (stone && (x + Math.floor((y - d) / 4) * 3) % 8 === 0 ? ramp[0] : ramp[1]) });
    for (let x = 1; x < W - 1; x++) { if (hash(x, 1, 33) < 0.7) sp.set(x, d, SNOW[2]); if (hash(x, 2, 33) < 0.5) sp.set(x, d - 1, SNOW[hash(x, 3, 33) < 0.5 ? 3 : 2]); }
    return done(sp, 1, H - 2);
  });
  PC.post = h => once("post" + h, () => { const sp = new Grid(5, h + 2); region(sp, rect(1, 1, 3, h), R.oak, { spec: (x, y) => x === 1 && y % 4 === 1 }); return done(sp, 2, h); });
  // the gallery's rail (oak, a broken section where a body can be shoved through) or the balcony's balustrade (stone), capped with snow
  PC.rail = (w, gap, look) => once("rail" + w + "|" + (gap || []).join() + look, () => {
    const W = w + 2, sp = new Grid(W, 9), stone = look === "stone";
    region(sp, (x, y) => y >= 2 && y <= 6 && x >= 1 && x <= W - 2 && !(gap && x >= gap[0] && x <= gap[1]) && (stone ? (y <= 3 || x % 5 === 0 || y === 6) : (y <= 3 || x % 8 === 0)), stone ? R.stone : R.oak, { spec: (x, y) => y === 2 });
    for (let x = 1; x < W - 1; x++) if (sp.get(x, 2) && !(gap && x >= gap[0] && x <= gap[1])) sp.set(x, 1, hash(x, 5, 33) < 0.8 ? SNOW[3] : SNOW[2]);
    if (gap) { region(sp, line(gap[0], 4, gap[0] + 4, 7, 1), R.oakD); region(sp, line(gap[1], 3, gap[1] - 3, 7, 1), R.oakD); }
    return done(sp, 1, 6);   // (on the deck's front edge: its foot row)
  });
  // a balustrade along a deck's side (the keep's balcony's west edge): a short stone wall seen end-on, d deep, 4 tall
  PC.railSide = d => once("railSide" + d, () => { const sp = new Grid(5, d + 8); region(sp, rect(1, 2, 2, d + 5), R.stone, { spec: (x, y) => x === 1 }); for (let y = 2; y <= d + 1; y += 3) sp.set(1, y, SNOW[3]); return done(sp, 1, d + 5); });
  // a stair of `steps` steps rising toward `dir` (e, w or n) from z 0 to zTop over its rect (w across, d deep), timber or stone, snow on
  // the treads outdoors
  PC.stair = (steps, w, d, zTop, dir, look, snowy) => once(["stair", steps, w, d, zTop, dir, look, snowy ? 1 : 0].join("|"), () => {
    const stone = look === "stone", ramp = stone ? R.stone : R.oak, zk = k => Math.round((k + 1) * zTop / steps);
    if (dir === "n") {   // the treads run across x; the highest is the northmost (the sprite's top)
      const W = w + 2, H = d + zTop + 2, sp = new Grid(W, H), tread = d / steps;
      let y = 1;
      for (let j = 0; j < steps; j++) {
        const z = zk(steps - 1 - j), zn = j === steps - 1 ? 0 : zk(steps - 2 - j), ty = Math.round(tread * (j + 1)) - Math.round(tread * j);
        region(sp, rect(1, y, W - 2, y + ty - 1), ramp, { flat: 3, tex: (x, yy) => stone && (x + yy) % 11 === 0 ? ramp[2] : null }); y += ty;
        if (z - zn > 0) { region(sp, rect(1, y, W - 2, y + z - zn - 1), ramp, { flat: 1, tex: (x) => x % 9 === 0 ? ramp[0] : null }); y += z - zn; }
        if (snowy) for (let x = 1; x < W - 1; x++) if (hash(x, j, 34) < 0.5) sp.set(x, y - (z - zn) - ty, SNOW[3]);
      }
      return done(sp, 1, H - 2);
    }
    const tread = w / steps, W = w + 2, H = d + zTop + 2, sp = new Grid(W, H);
    for (let k = 0; k < steps; k++) {
      const z = zk(k), kk = dir === "w" ? steps - 1 - k : k, x0 = 1 + Math.round(kk * tread), x1 = Math.round((kk + 1) * tread), yT = H - 2 - d - z + 1, yB = H - 2 - z;
      // a tread: lit along its back edge, a line where it drops to the step below; stone laid in courses (the dais's deep steps)
      const drop = k === 0 ? -1 : dir === "w" ? x1 : x0;
      region(sp, rect(x0, yT, x1, yB), ramp, { tex: (x, y, c) => (y === yT ? ramp[3] : x === drop ? ramp[1] : (stone && (y - yT) % 6 === 5 && y < yB ? ramp[1] : ramp[2])) });
      region(sp, rect(x0, yB + 1, x1, H - 2), ramp, { tex: (x, y, c) => y === yB + 1 ? ramp[0] : ((y - yB) % 4 === 0 ? ramp[0] : ramp[1]) });
      if (snowy) for (let x = x0; x <= x1; x++) if (hash(x, k, 35) < 0.55) sp.set(x, yT, SNOW[3]);
    }
    return done(sp, 1, H - 2);
  });
  // a granite pillar r 7 standing h tall to the beam: a base, a shaft lit from the left, a capital
  PC.pillar = h => once("pillar" + h, () => {
    const W = 19, H = h + 6, sp = new Grid(W, H), cx = 9;
    region(sp, (x, y) => Math.abs(x - cx) <= 6 && y >= 4 && y <= H - 7, R.stone, { tex: (x, y) => { const d = x - cx; let t = d < -3 ? 2 : d < 1 ? 1 : 0; if (d === -4 && y % 2) t = 3; if ((y + Math.floor(x / 3)) % 11 === 0) t = 0; return R.stone[t]; } });
    region(sp, or(rect(cx - 8, H - 7, cx + 8, H - 3), ell(cx, H - 4, 8.5, 2)), R.stone, { flat: 1, spec: (x, y) => y === H - 7 });
    region(sp, rect(cx - 8, 1, cx + 8, 4), R.stone, { flat: 2, spec: (x, y) => y === 1 });
    return done(sp, cx, H - 4);
  });
  // an iron gate's slice: the two bars of 8 px of its depth (the nearer 4 px nearer, so 4 px lower on the screen), 40 tall and spiked,
  // lifted L px into the vault and cut at its line (56 over the floor); anchored at the nearer bar's foot
  PC.portcullis = L => once("port" + L, () => {
    const W = 9, H = 64, oy = 61, sp = new Grid(W, H);
    for (const dy of [-4, 0]) {
      const foot = oy + dy - L, top = Math.max(foot - 40, oy + dy - 56);
      if (foot <= top) continue;
      for (let y = top; y <= foot; y++) { sp.set(3, y, R.iron[2]); sp.set(4, y, R.iron[1]); sp.set(5, y, R.iron[0]); }
      for (const h of [12, 26, 38]) { const y = foot - h; if (y >= top) { sp.set(2, y, R.iron[1]); sp.set(3, y, R.iron[3]); sp.set(6, y, R.iron[1]); } }
      if (foot - 40 >= top) sp.set(4, foot - 41 >= 0 ? foot - 41 : 0, R.iron[3]);   // the spike, when its top shows
      sp.set(3, foot, null); sp.set(5, foot, null);   // the tooth at its foot
    }
    return done(sp, 4, oy);
  });
  // a suit of armour on its stand
  PC.armour = () => once("armour", () => {
    const sp = new Grid(17, 32), cx = 8;
    region(sp, or(rect(cx - 1, 22, cx + 1, 29), rect(cx - 4, 29, cx + 4, 30)), R.oakD);
    region(sp, or(ell(cx, 15, 4, 5), rect(cx - 5, 10, cx + 5, 12), rect(cx - 3, 19, cx + 3, 24)), R.steel, { ball: [cx - 1, 13, 5] });
    region(sp, ell(cx, 6, 3, 3.5), R.steel, { ball: [cx - 1, 5, 3], spec: (x, y) => x === cx - 1 && y === 4 });
    for (let x = cx - 2; x <= cx + 2; x++) sp.set(x, 6, "#181425");
    region(sp, line(cx + 6, 3, cx + 6, 26, 1), R.iron, { flat: 2 }); sp.set(cx + 6, 2, R.steel[3]);
    return done(sp, cx, 29);
  });
  // a long trestle table w x d, 12 tall, laid for a troll feast (variant v: pewter, bread, goblets, candles, bones; the odd ones a roast boar)
  PC.table = (w, d, v) => once("table" + w + "|" + d + "|" + v, () => {
    const ht = 12, pad = 5, W = w + 2, H = d + ht + 2 + pad, sp = new Grid(W, H), top = 1 + pad;   // (pad: the candles' flames stand over the board)
    region(sp, rect(1, top, W - 2, top + d - 1), R.oak, { tex: (x, y, c) => (y - top) % 4 === 3 ? R.oak[1] : (hash(x, y, 41) < 0.1 ? R.oak[1] : R.oak[2]), spec: (x, y) => y === top });
    region(sp, rect(1, top + d, W - 2, top + d + 3), R.oakD, { spec: (x, y) => y === top + d });
    for (const lx of [4, W - 6]) region(sp, rect(lx, top + d + 4, lx + 2, H - 2), R.oakD);
    const items = [];
    if (d >= 8) for (let x = 6; x < W - 8; x += 13 + Math.floor(hash(x, v, 42) * 8)) items.push([x, top + 2 + Math.floor(hash(x, v, 43) * Math.max(1, d - 6)), Math.floor(hash(x, v, 44) * 5)]);
    else for (let y = 4; y < d - 4; y += 15 + Math.floor(hash(y, v, 45) * 10)) items.push([1 + Math.floor(W / 2) - 2, y, Math.floor(hash(y, v, 44) * 5)]);
    for (const [x, y, k] of items) {
      if (k === 0) { region(sp, ell(x, y + 1, 2.5, 1.5), R.steel, { flat: 2, spec: (xx, yy) => yy === y }); sp.set(x, y + 1, R.oak[3]); }
      else if (k === 1) region(sp, ell(x, y + 1, 2.5, 1.4), R.hay, { ball: [x - 1, y, 2.5] });
      else if (k === 2) { region(sp, rect(x, y - 1, x + 1, y + 1), ["#be4a2f", "#f77622", "#feae34", "#fee761"], { flat: 2 }); sp.set(x, y - 2, "#fee761"); }
      else if (k === 3) { region(sp, rect(x, y - 3, x, y), R.bone, { flat: 2 }); sp.set(x, y - 4, R.fire[4]); sp.set(x, y - 5, R.fire[5]); }
      else region(sp, line(x - 2, y + 1, x + 2, y, 1), R.bone, { flat: 2 });
    }
    if (v % 2 === 1 && d >= 8) { const bx = Math.floor(W / 2); region(sp, ell(bx, top + d / 2, 7, 3.5), ["#57262c", "#733e39", "#b86f50", "#e4a672"], { ball: [bx - 2, top + d / 2 - 1, 7] }); sp.set(bx + 7, Math.round(top + d / 2), "#e4a672"); sp.set(bx + 6, Math.round(top + d / 2 - 2), "#ead4aa"); region(sp, ell(bx, top + d / 2 + 2, 9, 1.3), R.steel, { flat: 1 }); }
    return done(sp, 1, H - 2, { ht, depth: d, top: pad });
  });
  PC.bench = (w, d) => once("bench" + w + "|" + d, () => { const ht = 6, W = w + 2, H = d + ht + 2, sp = new Grid(W, H); region(sp, rect(1, 1, W - 2, d), R.oak, { spec: (x, y) => y === 1, tex: (x, y) => (x % 23 === 0 ? R.oak[1] : null) }); region(sp, rect(1, d + 1, W - 2, d + 2), R.oakD); for (const lx of [3, W - 5]) region(sp, rect(lx, d + 3, lx + 1, H - 2), R.oakD); return done(sp, 1, H - 2, { ht, depth: d }); });
  // the dais: a granite platform w x d at z, its front face in courses
  PC.dais = (w, d, z) => once("dais" + w + "|" + d + "|" + z, () => { const W = w + 2, H = d + z + 2, sp = new Grid(W, H); region(sp, rect(1, 1, W - 2, d), GRAN, { tex: (x, y) => ((x + Math.floor(y / 6) * 5) % 12 === 0 || y % 6 === 0) ? "#2c2838" : (hash(Math.floor(x / 12), Math.floor(y / 6), 46) < 0.5 ? "#4a4458" : "#555064") }); for (let x = 1; x < W - 1; x++) sp.set(x, 1, "#6e6a78"); region(sp, rect(1, d + 1, W - 2, H - 2), GRAN, { tex: (x, y) => (y - d) % 3 === 0 ? "#2c2838" : "#3e3a4a" }); return done(sp, 1, H - 2); });
  // the lord's chair: a high back carved with the castle's wolf, on the dais
  PC.chair = () => once("chair", () => { const sp = new Grid(16, 30); region(sp, or(rect(2, 2, 13, 18), rect(2, 18, 13, 22), rect(2, 22, 4, 27), rect(11, 22, 13, 27)), R.oakD, { spec: (x, y) => y === 2 || x === 2 }); region(sp, rect(4, 4, 11, 15), R.blue, { flat: 1, tex: (x, y) => ((x >= 6 && x <= 9 && y >= 7 && y <= 11) || (x === 6 && y === 6) || (x === 9 && y === 6)) ? "#ead4aa" : null }); for (const x of [3, 12]) sp.set(x, 1, "#feae34"); return done(sp, 8, 27); });
  // an iron chandelier: a ring of candles on two frames, its chains running `up` px to the beam
  PC.chandelier = (f, up) => once("chand" + (f & 1) + "|" + up, () => {
    const W = 27, H = up + 12, sp = new Grid(W, H), cy = H - 4, hook = cy - 26;
    for (const x1 of [4, 22, 13]) for (let k = 0; k <= 24; k++) { const t = k / 24, x = Math.round(13 + (x1 - 13) * t), y = Math.round(hook + (cy - 2 - hook) * t); sp.set(x, y, k % 2 ? "#262b44" : "#3a4466"); }
    for (let y = 1; y < hook; y++) sp.set(13, y, y % 2 ? "#262b44" : "#3a4466");
    region(sp, (x, y) => { const d = ((x - 13) / 11) ** 2 + ((y - cy) / 2.6) ** 2; return d <= 1 && d >= 0.45; }, R.iron, { spec: (x, y) => y === cy - 2 });
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU, x = Math.round(13 + Math.cos(a) * 10), y = Math.round(cy + Math.sin(a) * 2.2) - 2; sp.set(x, y, R.bone[2]); sp.set(x, y - 1, R.bone[2]); sp.set(x, y - 2, (k + f) % 2 ? R.fire[4] : R.fire[3]); if ((k + f) % 3 === 0) sp.set(x, y - 3, R.fire[5]); }
    return done(sp, 13, cy);
  });
  // the pale tree: a white trunk with a carved face weeping red, its roots, a crown of blood-red leaves dusted with snow
  PC.paleTree = () => once("paleTree", () => {
    const W = 71, H = 88, sp = new Grid(W, H), cx = 35, foot = H - 6;
    region(sp, or(rect(cx - 5, foot - 44, cx + 5, foot), line(cx - 4, foot, cx - 11, foot + 2, 2), line(cx + 4, foot, cx + 12, foot + 1, 2), line(cx - 2, foot - 40, cx - 13, foot - 52, 3), line(cx + 3, foot - 38, cx + 15, foot - 54, 3)), R.bark,
      { tex: (x, y, c) => { const d = x - cx; let t = d < -2 ? 3 : d < 2 ? 2 : 1; if ((y * 3 + x) % 13 === 0) t = 0; if (hash(x, y, 51) < 0.08) t = 0; return R.bark[t]; } });
    for (const [x, y] of [[cx - 3, foot - 30], [cx - 2, foot - 30], [cx + 2, foot - 30], [cx + 3, foot - 30], [cx - 1, foot - 24], [cx, foot - 24], [cx + 1, foot - 24]]) sp.set(x, y, "#262b44");
    for (const [x, y0, n] of [[cx - 3, foot - 29, 6], [cx + 3, foot - 29, 4], [cx, foot - 23, 5]]) for (let k = 0; k < n; k++) sp.set(x, y0 + k, k < n - 1 ? "#a22633" : "#68182c");
    const lobes = [[cx, 18, 17, 12], [cx - 17, 26, 12, 9], [cx + 17, 25, 12, 9], [cx - 8, 34, 11, 7], [cx + 10, 34, 11, 7], [cx, 10, 10, 7]];
    region(sp, (x, y) => lobes.some(([lx, ly, rx, ry]) => ((x - lx) / rx) ** 2 + ((y - ly) / ry) ** 2 <= 1 && hash(x, y, 52) > 0.06), R.leaf, { tex: (x, y, c) => {
      const n = vnoise(x, y, 4, 53), lit = (x - cx) * -0.02 + (30 - y) * 0.03 + n * 0.6;
      if (lit > 0.85 && hash(x, y, 54) < 0.5) return hash(x, y, 55) < 0.6 ? SNOW[3] : SNOW[2];
      return lit > 0.55 ? R.leaf[3] : lit > 0.3 ? R.leaf[2] : lit > 0.05 ? R.leaf[1] : R.leaf[0];
    } });
    return done(sp, cx, foot);
  });
  // steam over a grate: three dithered puffs rising on two frames (no soot: steam has no edge)
  PC.steam = f => once("steam" + (f & 1), () => { const sp = new Grid(17, 30); for (let k = 0; k < 3; k++) { const cx = 8 + (k % 2 ? 2 : -2) + (f ? 1 : -1) * (k - 1), cy = 24 - k * 8 - f * 2, r = 3 + k; for (let y = 0; y < 30; y++) for (let x = 0; x < 17; x++) if (((x - cx) / r) ** 2 + ((y - cy) / (r * 0.8)) ** 2 <= 1 && dith(x + f, y, 0.55 - k * 0.12)) sp.set(x, y, k === 0 ? SNOW[3] : SNOW[2]); } return sprite(sp, 8, 28, { steam: true }); });
  // a weapon rack against the wall: spears in it, snow on its crossbar
  PC.rack = () => once("rack", () => { const sp = new Grid(31, 27); region(sp, or(rect(1, 9, 29, 10), rect(1, 19, 29, 20), rect(2, 7, 3, 25), rect(27, 7, 28, 25)), R.oakD); for (let x = 6; x < 26; x += 5) { region(sp, rect(x, 2, x, 24), R.oak, { flat: 2 }); sp.set(x, 1, R.steel[3]); sp.set(x, 2, R.steel[2]); } snowCap(sp, 9); return done(sp, 1, 25); });
  // a barricade's planks, h tall (variant v), snow on their tops; and its hinged plank gate (open 0, 1, 2: swung as a troll comes through)
  PC.planks = (h, v) => once("planks" + h + "|" + v, () => { const sp = new Grid(11, h + 3); region(sp, (x, y) => y >= 1 + (x + v) % 3 && y <= h + 1 && x >= 1 && x <= 9 && (x % 3 !== 0 || y > h - 4), R.oak, { tex: (x, y) => (y % 7 === 3 ? R.oakD[1] : null), spec: (x, y) => y < 3 }); snowCap(sp); return done(sp, 5, h + 1); });
  PC.plankGate = f => once("plankGate" + (f | 0), () => {
    const w = 11, h = 21, sp = new Grid(w, h), open = Math.min(2, f | 0);
    region(sp, (x, y) => x >= 1 && x <= 9 - open * 3 && y >= 4 && y <= 19 && ((x - 1) % 3 !== 2 || y === 8 || y === 14), R.oak, { tex: (x, y) => y === 8 || y === 14 ? R.oakD[1] : null, spec: (x, y) => y === 4 });
    if (open) region(sp, (x, y) => x >= 9 - open * 3 && x <= 9 && y >= 2 + open && y <= 19 - open && (x + y) % 2 === 0, R.oak);
    snowCap(sp);
    return done(sp, 5, h - 2);
  });
  // a barricade's piece falling (frames 1 to 3: leaning east and down) and lying in a low heap (4): planks flat and hay strewn
  function leanOf(s, f, key) { return once("lean" + key + "|" + f, () => { const lean = f * 4, drop = f * 2, W = s.w + lean + 1, H = s.h + drop, sp = new Grid(W, H); for (let y = 0; y < s.h; y++) { const sh = Math.round((s.h - 1 - y) / Math.max(1, s.h - 1) * lean); for (let x = 0; x < s.w; x++) { const c = s.px[y * s.w + x]; if (c) sp.set(x + sh, y + drop, c); } } return sprite(sp, s.ox, s.oy + drop); }); }
  // the barricade fallen (frame 4): one low field of debris along its line, thrown east over the fallen cover's 24 px: planks lying at odd
  // angles, tipped bales and loose straw, a cart's wheel now and then, snow on their tops; flat, so drawn under every body
  PC.debris = (len, v) => once("debris" + len + "|" + v, () => {
    const W = 36, H = len + 8, sp = new Grid(W, H), items = [];
    for (let y = 5; y < H - 5; y += 5 + Math.floor(hash(y, v, 134) * 6)) items.push(y);
    for (const y of items) {
      const k = hash(y, v, 135);
      if (k < 0.55) { const x0 = 1 + Math.floor(hash(y, v, 136) * 8), len2 = 9 + Math.floor(hash(y, v, 137) * 18), dy = Math.floor(hash(y, v, 138) * 7) - 3; region(sp, line(x0, y, Math.min(W - 3, x0 + len2), clamp(y + dy, 1, H - 3), 2), R.oak, { tex: (x, yy) => (x + y) % 7 === 0 ? R.oakD[1] : null }); }
      else if (k < 0.85) { const cx = 8 + Math.floor(hash(y, v, 139) * 18); region(sp, ell(cx, y, 6, 3), R.hay, { ball: [cx - 2, y - 1, 6], tex: (x, yy) => hash(x, yy, 140) < 0.3 ? R.hay[3] : (yy === y && x % 4 === 0 ? R.leather[1] : null) }); }
      else if (k < 0.95) { for (let i = 0; i < 9; i++) { const x = 2 + Math.floor(hash(i, y, 141) * 26), yy = y - 2 + Math.floor(hash(i, y, 142) * 5); sp.set(x, yy, i % 3 ? R.hay[2] : R.hay[1]); } }
      else { const cx = 10 + Math.floor(hash(y, v, 143) * 14); region(sp, ell(cx, y, 4, 2.5), R.iron, { spec: (x, yy) => x === cx - 2 && yy === y - 1 }); sp.set(cx, y, R.oak[1]); }
    }
    snowCap(sp);
    for (let i = 0; i < len / 3; i++) { const x = Math.floor(hash(i, v, 144) * W), y = Math.floor(hash(i, v, 145) * H); if (sp.get(x, y) && sp.get(x, y) !== OUT) sp.set(x, y, SNOW[hash(i, v, 146) < 0.5 ? 3 : 2]); }
    return done(sp, 1, 1, { debris: true });
  });
  // the castle's wolf on blue with its gold border, or the trolls' hide with the green hand, hanging from a wall (baked into the tiles)
  PC.wallBanner = (troll, h) => once("wb" + (troll ? 1 : 0) + "|" + h, () => {
    const W = 15, H = h + 4, sp = new Grid(W, H);
    region(sp, rect(1, 1, 13, 2), R.oakD, { flat: 2 });
    const cloth = (x, y) => x >= 2 && x <= 12 && y >= 3 && y <= H - 3 - (Math.abs(x - 7) < 2 ? 0 : (x < 7 ? 2 : 1)) && !(troll && hash(x, y, 61) < 0.05);
    if (troll) { region(sp, cloth, ["#3e2731", "#733e39", "#b86f50", "#c28569"], { tex: (x, y) => (x + y * 2) % 9 === 0 ? "#3e2731" : null }); for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [-1, -1], [3, -1], [1, -2], [0, 2], [2, 2], [1, 3]]) sp.set(6 + dx, 9 + dy, dy > 1 ? HAND[0] : HAND[1]); }
    else {
      region(sp, cloth, R.blue, { tex: (x, y) => (x === 2 || x === 12 || y === H - 3 - (Math.abs(x - 7) < 2 ? 0 : (x < 7 ? 2 : 1))) ? "#feae34" : (x < 7 ? R.blue[2] : R.blue[1]) });
      const wy = 7; for (const [dx, dy] of [[-1, 0], [0, 0], [1, 0], [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1], [-1, 2], [0, 2], [1, 2], [-2, -1], [2, -1], [-3, 2], [0, 3], [1, 3]]) sp.set(7 + dx, wy + dy, dx > 0 ? "#ead4aa" : "#ffffff");
      sp.set(7, wy + 1, "#262b44");
    }
    return sprite(sp, 7, 1);
  });
  // level 1's pieces under snow: the well, a barrel, the hay cart, the trebuchet (its frames from the director)
  PC.well = () => once("well", () => { const sp = gridOf(G.sprites.well()); snowCap(sp); const s = G.sprites.well(); return sprite(sp, s.ox, s.oy); });
  PC.barrel = () => once("barrel", () => { const sp = gridOf(G.sprites.barrel()); snowCap(sp); const s = G.sprites.barrel(); return sprite(sp, s.ox, s.oy); });
  PC.trebuchet = frame => once("treb" + frame, () => { const s = G.sprites.trebuchet(frame, false), sp = gridOf(s); snowCap(sp); return sprite(sp, s.ox, s.oy, { ht: s.ht, depth: s.depth, top: s.top }); });
  PC.cart = (w, d) => once("cart" + w + "|" + d, () => {
    const s = G.sprites.cart(w, d, false), ht = 16, load = 9, sp = new Grid(s.w, s.h + load);
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const c = s.px[y * s.w + x]; if (c) sp.set(x, y + load, c); }
    // its load of hay: bales on the bed, their tops under snow
    const bedTop = load + ht - 10;
    region(sp, (x, y) => x >= 3 && x <= s.w - 4 && y >= bedTop - 8 && y <= bedTop + 2 && !(y < bedTop - 5 && (x < 6 || x > s.w - 7)), R.hay, { tex: (x, y) => (x % 7 === 0 || y === bedTop - 2) ? R.leather[1] : (hash(x, y, 131) < 0.25 ? R.hay[3] : null), spec: (x, y) => y === bedTop - 8 });
    outline(sp); snowCap(sp);
    return sprite(sp, s.ox, s.oy + load, { ht: ht + load, depth: d, top: load });
  });
  // the kennels' bars: whole (0), bending (1), bursting (2), broken (3), in the arch's shape, 40 x 44, anchored at the arch's top left
  // (wall overlays keep a 1 px margin, so their soot closes round them: anchored at (1, 1), the arch's top left)
  PC.kennelBars = state => once("kbars" + state, () => {
    const W0 = LAYOUT.hall.kennelW, H0 = 44, sp = new Grid(W0 + 2, H0 + 2), r = W0 / 2, top = r;
    const inArch = (x, y) => (y >= top ? true : (x + 0.5 - r) ** 2 + (y - top) ** 2 <= r * r);
    const put = (x, y, c) => { if (x >= 0 && x < W0 && y >= 0 && y < H0) sp.set(x + 1, y + 1, c); };
    for (let i = 0; i < 8; i++) {
      const bx = 2 + i * 5, bend = state === 1 ? Math.round(Math.sin((i + 0.5) / 8 * Math.PI) * 2) : 0;
      for (let y = 0; y < H0; y++) {
        if (!inArch(bx, y)) continue;
        if (state >= 2 && y > 6 && y < H0 - 6 && !(state === 2 && hash(i, 0, 140) < 0.35)) continue;   // burst: the middle of every bar gone (one or two still flying)
        const by = state === 2 && y > 6 && y < H0 - 6 ? y + 6 : y, x = bx + (y > 10 && y < H0 - 8 ? bend : 0) + (state === 2 && y > 6 && y < H0 - 6 ? (i < 4 ? -3 : 3) : 0);
        put(x, by, R.iron[y % 7 === 0 ? 3 : 2]); put(x + 1, by, R.iron[0]);
      }
    }
    if (state < 2) for (let x = 1; x < W0 - 1; x++) if (inArch(x, 24)) { put(x, 24, R.iron[1]); put(x, 25, R.iron[0]); }
    if (state === 3) for (const [x, y] of [[6, 40], [7, 41], [8, 41], [9, 42], [28, 41], [29, 41], [30, 40], [31, 40]]) put(x, y, R.iron[1]);   // bent bars lying at the foot
    outline(sp);
    return sprite(sp, 1, 1);
  });
  // a pair of yellow eyes in the dark (the kennels' wolves), 5 px apart, so each looks out between two bars
  PC.eyes = () => once("eyes", () => G.sprite([EYE, null, null, null, null, EYE], 6, 1, 0, 0));
  // a great door's two leaves in its arch (w x h, the arch's top round): shut (0), swinging in (1 to 3), open (4: the leaves edge-on at
  // the jambs); oak planks with iron bands; the keep's carries the castle's wolf on blue, the great hall's its carved wolves and the
  // claw marks down its foot
  PC.leaves = (w, h, f, kind) => once("leaves" + w + "|" + h + "|" + f + "|" + kind, () => {
    const sp = new Grid(w + 2, h + 2), r = w / 2, inOpen = (x, y) => y >= r || (x + 0.5 - r) ** 2 + (y - r) ** 2 <= r * r, half = Math.floor(w / 2);
    const put = (x, y, c) => { if (x >= 0 && x < w && y >= 0 && y < h) sp.set(x + 1, y + 1, c); };
    const lw = [half, Math.round(half * 0.7), Math.round(half * 0.4), Math.round(half * 0.2), 2][clamp(f | 0, 0, 4)];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!inOpen(x, y)) continue;
      const left = x < half, lx = left ? x : w - 1 - x;
      if (lx >= lw) continue;
      const shade = f > 0 ? (left ? R.oakD[1] : R.oakD[0]) : null;
      let c = lx % 6 === 0 ? R.oakD[0] : (y % 12 === 6 ? R.iron[2] : (left ? R.oakD[2] : R.oakD[1]));
      if (shade && lx % 6 !== 0 && y % 12 !== 6) c = shade;
      if (kind === "hall" && y > h - 10 && (x % 7 === 2 || x % 7 === 3) && hash(x, y, 91) < 0.7) c = "#57373a";
      put(x, y, c);
    }
    if (!f) {
      if (kind === "keep") { const cx = half - 4, cy = Math.round(h * 0.45); for (let y = cy; y < cy + 11; y++) for (let x = cx; x < cx + 8; x++) put(x, y, ((x - cx) + (y - cy)) % 3 === 0 ? "#ffffff" : "#124e89"); }
      else for (const cx of [half - 10, half + 10]) { const cy = Math.round(h * 0.42); for (const [dx, dy] of [[-1, 0], [0, 0], [1, 0], [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1], [-1, 2], [0, 2], [1, 2], [-2, -1], [2, -1], [0, 3]]) put(cx + dx, cy + dy, R.oak[3]); }
      for (let y = Math.round(r); y < h; y++) put(half, y, OUT);
    }
    outline(sp);
    return sprite(sp, 1, 1);
  });
  // the trolls' hide over the hearth's hood: whole (0), burning from its foot (1 to 3), its last shreds falling (4), embers (5)
  PC.hide = f => once("hide" + (f | 0), () => {
    const W = 20, H = 36, sp = new Grid(W, H), st = clamp(f | 0, 0, 5), burnt = [0, 5, 11, 16, 20, 24][st], drop = st >= 4 ? (st - 3) * 5 : 0;
    const cloth = (x, y) => x >= 2 && x <= 17 && y >= 3 && y <= 26 - (Math.abs(x - 9.5) < 3 ? 0 : 2) && !(hash(x, y, 62) < 0.05);
    if (st < 5) {
      region(sp, (x, y) => cloth(x, y - drop) && (y - drop) < 27 - burnt, ["#3e2731", "#733e39", "#b86f50", "#c28569"], { tex: (x, y) => (x + y * 2) % 9 === 0 ? "#3e2731" : null });
      for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [-1, -1], [3, -1], [1, -2], [0, 2], [2, 2], [1, 3]]) { const x = 8 + dx, y = 11 + dy + drop; if (sp.get(x, y)) sp.set(x, y, dy > 1 ? HAND[0] : HAND[1]); }
      if (st === 0) for (const x of [2, 17]) { sp.set(x, 2, R.oak[2]); sp.set(x, 1, R.oak[1]); }   // its ropes to the hood's hooks
      if (st >= 1) for (let x = 2; x <= 17; x++) { const y0 = 27 - burnt + drop, fh = 2 + Math.floor(hash(x, st, 63) * 6); for (let k = 0; k < fh; k++) { const y = y0 - k; if (y >= 1 && y < H - 1) sp.set(x, y, k < 2 ? R.fire[2] : k < 4 ? R.fire[3] : R.fire[4]); } if (y0 + 1 < H - 1) sp.set(x, y0 + 1, "#2a1d28"); }
    } else for (let k = 0; k < 7; k++) sp.set(3 + Math.floor(hash(k, 5, 64) * 14), 21 + Math.floor(hash(k, 6, 64) * 12), k % 2 ? "#f77622" : "#feae34");
    outline(sp);
    return sprite(sp, Math.floor(W / 2), 1);
  });
  // a torch's flame (the cellar's, four frames), anchored at its foot; the hearth's fire the width of a cart (four frames)
  PC.flame = f => once("flame" + (f & 3), () => { const rows = FLAME[f & 3], sp = new Grid(5, 8); for (let j = 0; j < 8; j++) for (let i = 0; i < 5; i++) { const ch = rows[j][i]; if (ch !== ".") sp.set(i, j, FIRE[+ch]); } return sprite(sp, 2, 8); });
  PC.hearthFire = f => once("hearth" + (f & 3), () => {
    const LG = LAYOUT.hall, W = LG.firebox[1] - LG.firebox[0], H = 40, sp = new Grid(W, H), fr = f & 3;
    for (let x = 1; x < W - 1; x++) {
      const h = 9 + Math.floor(hash(x, fr, 700) * 14) + Math.round(Math.sin(x / 5 + fr * 1.7) * 3) - (x < 6 || x > W - 7 ? 6 : 0);
      for (let y = 0; y < h; y++) { if (y > h - 3 && hash(x, y + fr, 701) < 0.5) continue; sp.set(x, H - 1 - y, y > h - 3 ? FIRE[6] : y > h - 6 ? FIRE[5] : y > h - 11 ? FIRE[4] : y > 2 ? FIRE[3] : FIRE[2]); }
    }
    for (let k = 0; k < 5; k++) { const x = 3 + Math.floor(hash(k, fr, 702) * (W - 6)), y = H - 26 - Math.floor(hash(k, fr, 703) * 10); sp.set(x, y, k % 2 ? FIRE[6] : FIRE[7]); }
    return sprite(sp, 0, H - 1);
  });
  // a snowflake (1 px, or 2 with its shaded side)
  PC.flake = big => once("flake" + (big ? 1 : 0), () => big ? G.sprite(["#ffffff", "#c0cbdc", "#8b9bb4", null], 2, 2, 0, 0) : G.sprite(["#c0cbdc"], 1, 1, 0, 0));
  // footprints in the snow, mud showing through: a knight's boot 2 x 1, a troll's bare foot 3 x 2, a brute's 4 x 3, a wolf's paws in pairs
  PC.print = (kind, v) => once("print" + kind + (v & 1), () => {
    if (kind === "boot") return G.sprite([MUD[2], MUD[1]], 2, 1, 1, 0);
    if (kind === "paws") return G.sprite(v & 1 ? [MUD[2], null, MUD[1]] : [MUD[1], null, MUD[2]], 3, 1, 1, 0);
    if (kind === "brute") return G.sprite([SNOW[0], MUD[2], MUD[2], SNOW[0], MUD[2], MUD[1], MUD[1], MUD[2], null, MUD[2], MUD[2], null], 4, 3, 2, 1);
    return G.sprite([SNOW[0], MUD[2], SNOW[0], MUD[2], MUD[1], MUD[2]], 3, 2, 1, 1);
  });

  // ------------------------------------------------------------------ the marks' looks (section 3.8): the yard's melt (fire on snow melts it
  // to wet black mud with a glint), its craters in the snow, mud clods and filled holes; the halls' stone craters (broken slabs round a
  // shallow bowl), broken flagstones, grey chips, cracks in the flags; the yard's darker ice
  const sq = r => { const w = 2 * r + 1; return { w, c: r, sp: new Grid(w, w) }; };
  const MK = {};
  MK.melt = (r, v) => once("melt" + r + "|" + v, () => { const { w, c, sp } = sq(r), off = v * 3;
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) { const d = Math.hypot(x - c, y - c) + (vnoise(x + off * 7, y, 3, 150 + v) - 0.5) * 2.2; if (d > r + 0.5) continue;
      if (d > r - 1.2) { if (dith(x + off, y, 0.55)) sp.set(x, y, hash(x, y, 151) < 0.5 ? SNOW[0] : SNOW[1]); }
      else sp.set(x, y, hash(x + off, y, 152) > 0.97 ? SNOW[1] : (hash(x, y + off, 153) > 0.985 ? SNOW[2] : (dith(x + off, y, 0.55) ? "#181425" : MUD[0]))); }
    return sprite(sp, c, c); });
  MK.snowCrater = (r, v) => once("scrater" + r + "|" + v, () => { const { w, c, sp } = sq(r), off = v * 3;
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) { const dd = Math.hypot(x - c, y - c); if (dd > r + 0.5) continue; const tt = 1 - dd / Math.max(1, r - 3);
      if (dd > r - 3) { const far = y < c - Math.abs(x - c) * 0.4; sp.set(x, y, far ? (dith(x + off, y, 0.7) ? SNOW[3] : SNOW[2]) : (dith(x + off, y, 0.5) ? MUD[2] : SNOW[1])); }
      else sp.set(x, y, tt > 0.7 ? "#120e1a" : tt > 0.35 ? (dith(x + off, y, (tt - 0.35) * 2.5) ? "#120e1a" : MUD[0]) : (dith(x + off, y, tt * 2.5) ? MUD[0] : MUD[1])); }
    return sprite(sp, c, c); });
  MK.yardDirt = (r, v) => once("ydirt" + r + "|" + v, () => { const { w, c, sp } = sq(r), off = v * 3; for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) { const d = Math.hypot(x - c, y - c); if (d > r + 0.5) continue; if (dith(x + off, y, 0.55 * (1.4 - d / (r + 0.5)))) sp.set(x, y, hash(x, y, 155 + v) < 0.5 ? MUD[1] : MUD[2]); } return sprite(sp, c, c); });
  MK.yardFilled = (r, v) => once("yfill" + r + "|" + v, () => { const { w, c, sp } = sq(r), off = v * 3; for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) { const d = Math.hypot(x - c, y - c); if (d > r + 0.5) continue; if (dith(x + off, y, 0.7 * (1.3 - d / (r + 0.5)))) sp.set(x, y, hash(x, y, 156 + v) < 0.15 ? SNOW[1] : hash(x, y, 157) < 0.5 ? MUD[2] : MUD[1]); } return sprite(sp, c, c); });
  MK.slush = (r, v) => once("slush" + r + "|" + v, () => { const { w, c, sp } = sq(r), off = v * 3; for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) { const d = Math.hypot(x - c, y - c); if (d > r + 0.5) continue; if (d > r - 1.6) { if (dith(x + off, y, 0.7)) sp.set(x, y, SNOW[0]); } else if (dith(x + off, y, 0.3)) sp.set(x, y, "#262b44"); } return sprite(sp, c, c); });
  // the halls': broken slabs round a shallow bowl (a stone crater), the slabs alone (filled), grey chips (loose dirt), a crack in the flags
  function slabCell(x, y, v) { const gx = Math.floor((x + (Math.floor(y / 5) % 2) * 3) / 6), gy = Math.floor(y / 5); return hash(gx, gy, 160 + v); }
  MK.stoneCrater = (r, v) => once("stcrater" + r + "|" + v, () => { const { w, c, sp } = sq(r), off = v * 3;
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) { const dd = Math.hypot(x - c, y - c); if (dd > r + 0.5) continue;
      const k = slabCell(x + off, y, v), edge = (x + off + (Math.floor(y / 5) % 2) * 3) % 6 === 0 || y % 5 === 0;
      if (dd > r - 3) { if (edge || hash(x, y, 161) < 0.25) sp.set(x, y, "#241c26"); else if (dith(x, y, 0.45)) sp.set(x, y, k < 0.4 ? R.stone[0] : k < 0.8 ? R.stone[1] : R.stone[2]); }
      else { const tt = 1 - dd / Math.max(1, r - 3); sp.set(x, y, edge ? "#120e1a" : tt > 0.65 ? (dith(x, y, 0.6) ? "#120e1a" : "#1e1828") : (k < 0.3 ? "#2c2838" : k < 0.7 ? "#3e3a4a" : (y < c ? "#555064" : "#2c2838"))); } }
    return sprite(sp, c, c); });
  MK.slabs = (r, v) => once("slabs" + r + "|" + v, () => { const { w, c, sp } = sq(r), off = v * 3;
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) { const d = Math.hypot(x - c, y - c); if (d > r + 0.5) continue; const k = slabCell(x + off, y, v), edge = (x + off + (Math.floor(y / 5) % 2) * 3) % 6 === 0 || y % 5 === 0;
      if (edge) { if (d < r - 1 || dith(x, y, 0.5)) sp.set(x, y, "#1e1828"); } else if (k < 0.35 && d < r - 1) sp.set(x, y, k < 0.15 ? "#2c2838" : "#4a4458"); }
    return sprite(sp, c, c); });
  MK.chips = (r, v) => once("chips" + r + "|" + v, () => { const { w, c, sp } = sq(r), off = v * 3; for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) { const d = Math.hypot(x - c, y - c); if (d > r + 0.5) continue; if (dith(x + off, y, 0.45 * (1.3 - d / (r + 0.5)))) sp.set(x, y, hash(x, y, 165 + v) < 0.5 ? R.stone[0] : R.stone[1]); } return sprite(sp, c, c); });
  MK.crack = (r, v) => once("hcrack" + r + "|" + v, () => { const { w, c, sp } = sq(r); for (let b = 0; b < 4; b++) { let x = c, y = c, a = b * Math.PI / 2 + hash(b, v, 52) * 1.2; for (let i = 0; i < r; i++) { x += Math.cos(a) * 1.2; y += Math.sin(a) * 0.9; a += hash(i, b + v * 4, 53) - 0.5; if (Math.hypot(x - c, y - c) <= r + 0.5) sp.set(x, y, "#1e1828"); } } return sprite(sp, c, c); });
  // the yard's ice, darker where it lies on snow so it reads: #8b9bb4 over #c0cbdc with cyan glints (the gate's frames otherwise)
  MK.ice = (r, f, level) => once("yice" + r + "|" + f + "|" + level, () => {
    const w = 2 * r + 3, sp = new Grid(w, w), c = r + 1, a = (level + 1) / 4;
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) { const dd = Math.hypot(x - c, y - c); if (dd > r + 0.5) continue; if (dith(x, y, 0.55 * a)) sp.set(x, y, (x + y) % 3 ? "#8b9bb4" : "#c0cbdc"); if (dd > r - 1 && dith(x + 1, y, 0.6)) sp.set(x, y, "#5a6988"); if (hash(x, y, 54 + f) > 0.965) sp.set(x, y, "#2ce8f5"); }
    return sprite(sp, c, c);
  });
  // grey chips for the halls: a clod of broken flagstone (as gate.js's clod, r 4, 6 tall) and a flying chip
  MK.clod = () => once("sclod", () => { const sp = new Grid(11, 9); region(sp, or(ell(5, 5, 4, 2.5), rect(2, 2, 7, 5)), R.stone, { ball: [3, 3, 4] }); return done(sp, 5, 6); });
  MK.chip = f => once("schip" + (f & 1), () => { const sp = new Grid(6, 6); region(sp, f & 1 ? or(rect(1, 2, 3, 3), rect(2, 1, 2, 1)) : or(rect(1, 1, 3, 2), rect(2, 3, 3, 3)), R.stone, { spec: (x, y) => x === ((f & 1) ? 2 : 1) && y === 1 }); return done(sp, 3, 3); });

  // ------------------------------------------------------------------ what the level's art hears and reads (section 3.5's moments): the
  // keep's great door bursts open when its wave begins (the wave's art "keepDoorOpens"), the kennels burst at the Pack (the phase's art
  // "kennelsOpen"), the great hall's doors open with their passage (their arena cleared), the hide over the hearth burns when the hall is
  // won (the end's art "hideBurns"). Each is read from the fight (the director's arenas, the level's flags) and from the events alike, and
  // kept: a wipe never shuts a door again. Times on the fight's clock
  function stateOf(S) { return S.hall || (S.hall = { keepDoor: null, hallDoors: null, kennels: null, hide: null, foot: new Map(), rings: new Map(), ringOrder: [] }); }
  function sync(S, F) {
    const st = stateOf(S), A = S.A;
    if (!F) return st;
    const D = F.director, t = F.t || 0;
    if (D && D.arenas) for (const ar of D.arenas) {
      const w = ar.wave; if (!w) continue;
      if (w.art === "keepDoorOpens" && ar.started && st.keepDoor === null) st.keepDoor = t;
      for (const ph of w.phases || []) if (ph.art === "kennelsOpen" && ar.phaseDone && ar.phaseDone[ph.id] && st.kennels === null) st.kennels = t;
    }
    const HD = (A.passages || []).find(p => p.id === "hallDoors");
    if (D && D.arenas && HD && HD.when && HD.when.cleared !== undefined && st.hallDoors === null) { const ar = D.arenas.find(a => a.id === HD.when.cleared); if (ar && ar.cleared) st.hallDoors = t; }
    const E = A.end || {};
    if (E.art === "hideBurns" && F.level && F.level[E.open || "gateOpen"] && st.hide === null) st.hide = t;
    return st;
  }
  function take(e, F, S) {
    const st = stateOf(S), A = S.A, t = F ? F.t || 0 : 0;
    if (e.type === "phase" && e.art === "kennelsOpen") { if (st.kennels === null) st.kennels = t; return true; }
    if (e.type === "wave") { const w = (A.waves || []).find(q => q.arena === e.arena); if (w && w.art === "keepDoorOpens") { if (st.keepDoor === null) st.keepDoor = t; return true; } return false; }
    if (A.end && e.type === A.end.event && A.end.art === "hideBurns") { if (st.hide === null) st.hide = t; return true; }
    return false;
  }

  // ------------------------------------------------------------------ the pieces as actors (the scene sorts them by their feet with the bodies)
  // a deep piece in 8 px slices, each sorted by its own foot, drawn lifted by z (the high table on the dais)
  function sliced(act, s, x0, y0, x1, y1, z, top, extra) {
    const n = Math.max(1, Math.ceil((y1 - y0) / 8)), H = s.h, tp = top || 0;
    for (let j = 0; j < n; j++) act(x0 - 2, y0 - z - 40 - tp, x1 + 2, y1 + 2, y0 + Math.min(8 * j + 8, y1 - y0), (ctx, F, o) => {
      const sp = typeof s === "function" ? s(F, o) : s; if (!sp) return;
      const r0 = j === 0 ? 0 : tp + 8 * j, r1 = j === n - 1 ? sp.h : Math.min(sp.h, tp + 8 * j + 8);
      if (r1 > r0) ctx.drawImage(sp.canvas(), 0, r0, sp.w, r1 - r0, x0 - 1, y1 - z - H + 1 + r0 - (sp.h - H), sp.w, r1 - r0);
      if (extra && j === n - 1) extra(ctx, F, o);
    }, z);
  }
  function pieces(A, S, act) {
    const P = prep(A), st = stateOf(S);
    const pc = (F, x, y) => S.pieceAt(F, x, y);
    for (const p of A.props || []) {
      const k = p.kind;
      if (k === "wall" || k === "drift") continue;   // drawn in the tiles
      if (k === "well") act(p.x - 12, p.y - 26, p.x + 12, p.y + 8, p.y, ctx => drawAt(ctx, PC.well(), p.x, p.y));
      else if (k === "barrel") act(p.x - 7, p.y - 21, p.x + 7, p.y + 4, p.y, (ctx, F) => { const b = pc(F, p.x, p.y); if (b && b.gone) return; drawAt(ctx, PC.barrel(), p.x, p.y); });
      else if (k === "cart") { const s = PC.cart(p.x1 - p.x0, p.y1 - p.y0); sliced(act, s, p.x0, p.y0, p.x1, p.y1, 0, s.top); }
      else if (k === "hay") {
        // a bale by its piece's state: standing under snow, burning (four frames), burnt to a heap glowing 3 s, or broken and strewn
        const cx = (p.x0 + p.x1) / 2, cy = (p.y0 + p.y1) / 2, stack = !!p.stack;
        act(p.x0 - 3, p.y1 - 50, p.x1 + 3, p.y1 + 3, p.y1, (ctx, F, o) => {
          const b = pc(F, cx, cy);
          if (b && (b.gone || b.broken)) { const at = S.wrecks[b.i], glow = at !== undefined && F.t - at < 3 && !o.still; drawAt(ctx, b.byFire ? PC.hayAsh(b.i, glow) : PC.hayLoose(b.i), p.x0, p.y1 - 1); return; }
          drawAt(ctx, PC.hay(stack, b && b.burning ? (o.still ? 0 : Math.floor(o.t * 8 + p.x0) & 3) : null), p.x0, p.y1 - 1);
        });
      }
      else if (k === "grate") { const cx = (p.x0 + p.x1) / 2, cy = (p.y0 + p.y1) / 2; act(cx - 9, cy - 32, cx + 9, cy + 2, cy, (ctx, F, o) => drawAt(ctx, PC.steam(o.still ? 0 : Math.floor(o.t * 2 + cx) & 1), cx, cy)); }
      else if (k === "rack") act(p.x0 - 2, p.y1 - 26, p.x1 + 4, p.y1 + 2, p.y1, ctx => drawAt(ctx, PC.rack(), p.x0, p.y1 - 1));
      else if (k === "butt") act(p.x - 8, p.y - 20, p.x + 8, p.y + 3, p.y, ctx => drawAt(ctx, PC.butt(), p.x, p.y));
      else if (k === "brazier") act(p.x - 8, p.y - 26, p.x + 8, p.y + 3, p.y, (ctx, F, o) => drawAt(ctx, PC.brazier(o.still ? 0 : Math.floor(o.t * 8 + p.x) & 3), p.x, p.y));
      else if (k === "paleTree") act(p.x - 36, p.y - 84, p.x + 36, p.y + 6, p.y, ctx => { drawAt(ctx, G.longShadow(p.r), p.x, p.y); drawAt(ctx, PC.paleTree(), p.x, p.y); });
      else if (k === "pillar") { const h = Math.max(20, p.y - 6); act(p.x - 10, 0, p.x + 10, p.y + 4, p.y, ctx => drawAt(ctx, PC.pillar(h), p.x, p.y)); }
      else if (k === "armour") act(p.x - 9, p.y - 31, p.x + 9, p.y + 3, p.y, ctx => drawAt(ctx, PC.armour(), p.x, p.y));
      else if (k === "table") {
        const w = p.x1 - p.x0, d = p.y1 - p.y0, [mx, my] = chandelierAt(p), base = p.base || 0;
        { const s = PC.table(w, d, p.feast || 0); sliced(act, s, p.x0, p.y0, p.x1, p.y1, base, s.top); }
        // its chandelier, hanging 64 px over the table's middle on chains to the beam (drawn only: it has no body)
        const up = Math.max(30, Math.round(my - 64 - 8)); act(mx - 14, 0, mx + 14, my + 2, my + 0.5, (ctx, F, o) => drawAt(ctx, PC.chandelier(o.still ? 0 : Math.floor(o.t * 3 + mx) & 1, up), mx, my - 64), 64);
      }
      else if (k === "highTable") { const s = PC.table(p.x1 - p.x0, p.y1 - p.y0, 0); sliced(act, s, p.x0, p.y0, p.x1, p.y1, p.base || 0, s.top); }
      else if (k === "bench") { const s = PC.bench(p.x1 - p.x0, p.y1 - p.y0), z = p.base || 0; act(p.x0 - 2, p.y0 - z - 10, p.x1 + 2, p.y1 + 2, p.y1, ctx => blit(ctx, s, p.x0 - 1, p.y1 - z + 1 - s.h), z); }
      else if (k === "chair") { const z = p.base || 0, cx = (p.x0 + p.x1) / 2; act(p.x0 - 4, p.y1 - z - 32, p.x1 + 4, p.y1 + 2, p.y1, ctx => drawAt(ctx, PC.chair(), cx, p.y1 - 1 - z), z); }
    }
    // the surfaces. The gallery and the keep's balcony are drawn as groups with their landings and stairs: the bodies under the deck, its
    // posts, the stairs, landings and deck, the marks on them, every body on them by its feet, the pouches, the rail in front
    const SU = A.surfaces || [], byId = id => SU.find(s => s.id === id);
    const decks = SU.filter(s => s.kind === "deck" && s.rect);
    const groupOf = new Map();
    for (const dk of decks) {
      const ids = [dk.id], [x0, , x1] = dk.rect;
      // the stairs and landings that join the deck end to end (a landing at its side, a stair at the landing's far side) are its group's
      let grew = true; while (grew) { grew = false; for (const su of SU) { if (ids.includes(su.id) || su === dk || !su.rect || su.rect[1] !== dk.rect[1] || su.rect[3] !== dk.rect[3] || (su.kind !== "stair" && su.kind !== "landing")) continue; if (ids.some(id => { const r = byId(id).rect; return Math.abs(su.rect[2] - r[0]) < 1e-9 || Math.abs(su.rect[0] - r[2]) < 1e-9; })) { ids.push(su.id); grew = true; } } }
      for (const id of ids) { groupOf.set(id, dk.id); S.grouped.add(id); }
      const members = ids.map(byId), gx0 = Math.min(...members.map(m => m.rect[0])), gx1 = Math.max(...members.map(m => m.rect[2])), z = dk.z, [, y0, , y1] = dk.rect;
      const snowy = lookOf(P, x0) === YARD, w = x1 - x0, d = y1 - y0, slab = dk.slab || 4, gap = ((dk.parapet || {}).gaps || []).filter(g => g.side === "s").map(g => [g.from - x0 + 1, g.to - x0 + 1])[0] || null;
      const legs = (dk.legs && dk.legs.at) || [], sideW = ((dk.parapet || {}).sides || []).includes("w"), railS = ((dk.parapet || {}).sides || []).includes("s");
      act(gx0 - 8, y0 - z - 48, gx1 + 8, y1 + 8, y0, (ctx, F, o) => {
        const PL = F.world.platBy[dk.id]; if (PL && !PL.active) return;
        S.drawUnder(ctx, F, o, dk);
        for (const l of legs) drawAt(ctx, PC.post(z - slab), l[0], l[1]);
        for (const m of members) drawSurface(ctx, m, snowy);
        for (const m of members) S.drawLifted(ctx, m.id, o);
        const on = S.bodiesOf(F).filter(b => b.on && ids.includes(b.on) && !b.climbing).sort((a, b) => a.y - b.y || a.x - b.x);
        for (const b of on) S.drawOne(ctx, F, o, b);
        for (const id of ids) S.drawPouches(ctx, F, o, id);
        if (railS) blit(ctx, PC.rail(w, gap, dk.look), x0 - 1, y1 - z - 7);
        if (sideW) blit(ctx, PC.railSide(d), x0 - 1, y0 - z - 6);
      }, z);
    }
    // the rest: each its own actor at its back edge, the bodies on it drawn by their feet, lifted by their height
    for (const su of SU) {
      if (!su.rect || groupOf.has(su.id)) continue;
      const [x0, y0, x1, y1] = su.rect, zt = Array.isArray(su.z) ? su.z[1] : su.z || 0, snowy = lookOf(P, x0) === YARD;
      act(x0 - 2, y0 - zt - 4, x1 + 2, y1 + 2, y0, (ctx, F, o) => { drawSurface(ctx, su, snowy); S.drawLifted(ctx, su.id, o); });
    }
    // the palisades by style: the barricades (hay, planks and hinged plank gates; falling flat into a heap), the iron gates (bars rising
    // into the vault and gone)
    for (const s of A.palisades || []) {
      const style = s.style || "barricade", Y = s.y || A.palisadeY || [64, 424], gates = s.trollGates || [];
      if (style === "portcullis") {
        for (let y = Y[0]; y < Y[1]; y += 8) { const yy = Math.min(y + 6, Y[1]), cx = (s.x0 + s.x1) / 2; act(cx - 6, yy - 64, cx + 6, yy + 2, yy, (ctx, F, o) => { const L = gateLift(S, F, s, o.t); if (L >= 56) return; drawAt(ctx, PC.portcullis(L), cx, yy); }); }   // (bars at y + 2 and y + 6)
        continue;
      }
      const rows = s.rows || 1;
      // fallen: its debris, one flat field the length of the line (the fallen cover runs 24 px east of it), under every body
      act(s.x0 - 4, Y[0] - 4, s.x1 + 34, Y[1] + 8, Y[0], (ctx, F, o) => { if (S.palisadeFrame(F, s, o.t) < 4) return; drawAt(ctx, PC.debris(Y[1] - Y[0], s.id | 0), s.x0 - 2, Y[0] + 1); });
      for (let r = 0; r < rows; r++) {
        let k = 0;
        for (let y = Y[0] + 6 + r * 3; y <= Y[1]; y += 6, k++) {
          const g = gates.find(([a, b]) => y >= a - 2 && y <= b + 2), x = s.x0 + 2 + r * 4;
          if (g) { if (r === 0 && y - 6 < g[0] - 2) { const gy = g[1]; act(x - 8, g[0] - 24, x + 12, gy + 4, gy, (ctx, F, o) => { const f = S.palisadeFrame(F, s, o.t); if (f >= 4) return; const sp = PC.plankGate(S.gateOpen(F, s, g[0], g[1])); drawAt(ctx, f ? leanOf(sp, f, "pg" + S.gateOpen(F, s, g[0], g[1])) : sp, x + 2, gy); }); } continue; }
          const v = hash(k, x, 600), hay = v < 0.4, stack = v < 0.15, h = 18 + Math.floor(v * 4), kk = k % 3;
          act(x - 6, y - 30, x + 22, y + 4, y, (ctx, F, o) => {
            const f = S.palisadeFrame(F, s, o.t);
            if (f >= 4) return;   // (lying in the debris)
            const sp = hay ? PC.hay(stack, null) : PC.planks(h, kk), at = hay ? [x - 4, y + 3] : [x + 2, y];
            drawAt(ctx, f ? leanOf(sp, f, (hay ? "h" + (stack ? 1 : 0) : "p" + h + kk)) : sp, at[0], at[1]);
          });
        }
      }
    }
    // the engines: the yard's trebuchet under snow, in 8 px slices, its frame from the director
    for (const e of A.engines || []) { const f = e.frame, n = Math.ceil((f.y1 - f.y0) / 8); for (let j = 0; j < n; j++) act(f.x0 - 2, f.y0 - 64, f.x1 + 2, f.y1 + 2, f.y0 + 8 * j + 8, (ctx, F, o) => { const s = PC.trebuchet(S.engineFrame(F, e, o.t)); drawSliceOf(ctx, s, f.x0, f.y1, j, n); }); }
    return st;
  }
  function drawSliceOf(ctx, s, x0, y1, j, n) { const top = s.top || 0, H = s.h, r0 = j === 0 ? 0 : top + 8 * j, r1 = j === n - 1 ? H : Math.min(H, top + 8 * j + 8); if (r1 > r0) ctx.drawImage(s.canvas(), 0, r0, s.w, r1 - r0, x0 - 1, y1 + 1 - H + r0, s.w, r1 - r0); }
  // a surface's art, by its kind and look: a stair (timber or stone, rising e, w or n), a landing (the deck's top at its height, its face
  // to the ground), the dais (granite), a deck
  function drawSurface(ctx, su, snowy) {
    const [x0, y0, x1, y1] = su.rect, w = x1 - x0, d = y1 - y0, look = su.look || "stone";
    if (su.kind === "stair") { const zt = su.z[1], s = PC.stair(su.steps || 8, w, d, zt, su.rise || "e", look, snowy); blit(ctx, s, x0 - 1, y1 + 1 - s.h); return; }
    if (su.kind === "landing") { const s = su.id === "dais" || (!snowy && look === "stone" && d > 40) ? PC.dais(w, d, su.z) : PC.landing(w, d, su.z, look, su.z >= 20 ? 4 : 0); blit(ctx, s, x0 - 1, y1 + 1 - s.h); return; }
    if (su.kind === "deck") { const s = PC.deck(w, d, su.slab || 4, look); blit(ctx, s, x0 - 1, y0 - su.z - 1); }
  }
  // an iron gate's lift (px) on the page's clock from its palisade's fall: 0 standing, rising over the fall's 0.6 s to 56, gone
  function gateLift(S, F, s, t) { const f = S.palisadeFrame(F, s, t); if (!f) return 0; if (f >= 4) return 56; const t0 = S.fell["pal" + s.id], q = clamp((t - t0) / (S.A.palisadeFall || 0.6), 0, 1); return Math.min(52, Math.round(q * 56 / 4) * 4); }

  // ------------------------------------------------------------------ the back wall's live things (drawn after the decals, before the floor's
  // marks and every actor): torch flames, the hearth's fire, the kennels' bars and eyes, the great doors' leaves, the hide over the hearth
  function wall(ctx, F, t, still, S) {
    const P = prep(S.A), st = sync(S, F), v = S.view, vx0 = v.x0 - 16, vx1 = v.x0 + (S.vw || TW) + 16, LG = LAYOUT.hall, LY = LAYOUT.yard, LH = LAYOUT.hallway, ft = F ? F.t || 0 : 0;
    if (v.y0 > 120) return 0;   // (the back walls are out of view)
    const tick = still ? 0 : Math.floor(t * 8);
    let n = 0;
    for (const L of P.lights) { if (L.tx === undefined || L.tx < vx0 || L.tx > vx1) continue; drawAt(ctx, PC.flame(still ? 0 : (tick + L.i) & 3), L.tx, L.ty); n++; }
    // the hearth's fire, and the hide over its hood: whole, burning 1.2 s from its foot and falling when the hall is won, then gone
    const hx = (LG.hearth[0] + LG.hearth[1]) / 2;
    if (LG.hearth[1] >= vx0 && LG.hearth[0] <= vx1) {
      drawAt(ctx, PC.hearthFire(still ? 0 : tick & 3), LG.firebox[0], 95); n++;
      if (st.hide === null) { drawAt(ctx, PC.hide(0), hx, 8); n++; }
      else if (!still) { const q = (ft - st.hide) / 1.2; if (q < 1) { drawAt(ctx, PC.hide(1 + Math.min(4, Math.floor(q * 5))), hx, 8); n++; } }
    }
    // the kennels: their bars whole with the eyes blinking in the dark; at the Pack they bend and burst (0.4 s) and hang broken
    for (const kx of LG.kennels) {
      if (kx + LG.kennelW < vx0 || kx > vx1) continue;
      let state = 0; if (st.kennels !== null) { const q = still ? 1 : (ft - st.kennels) / 0.4; state = q < 0.5 ? 1 : q < 1 ? 2 : 3; }
      if (state === 0) for (const [ex, ey, ph] of [[kx + 10, 80, 0], [kx + 25, 84, 3]]) { const blink = still ? false : ((Math.floor(t * 1.5) + ph + kx) % 7) === 0; if (!blink) { drawAt(ctx, PC.eyes(), ex, ey); n++; } }   // (in the gaps between the bars)
      drawAt(ctx, PC.kennelBars(state), kx, LG.kennelTop); n++;
    }
    // the keep's great door: shut until its wave, then the leaves swing in (0.4 s) and stand open
    { const g = LY.greatDoor; if (g[1] >= vx0 && g[0] <= vx1) { const f = st.keepDoor === null ? 0 : still ? 4 : Math.min(4, 1 + Math.floor((ft - st.keepDoor) / 0.1)); drawAt(ctx, PC.leaves(g[1] - g[0] - 8, g[3] - g[2] - 4, f, "keep"), g[0] + 4, g[2] + 4); n++; } }
    // the great hall's doors at the long hall's end: shut until the second Breather, then open
    { const g = LH.hallDoors; if (g[1] >= vx0 && g[0] <= vx1) { const f = st.hallDoors === null ? 0 : still ? 4 : Math.min(4, 1 + Math.floor((ft - st.hallDoors) / 0.15)); drawAt(ctx, PC.leaves(g[1] - g[0] - 8, g[3] - g[2] - 4, f, "hall"), g[0] + 4, g[2] + 4); n++; } }
    return n;
  }

  // ------------------------------------------------------------------ the flicker rings (section 3.9): per fire in view, at most 8 (the
  // nearest the view's middle), its pool's outer two levels drawn again at its radius +3, +1 or -2 on its own phase (phase 0, held under
  // less motion, is the baked pool itself). A ring is the pixels whose light changes, lit from the ground's own colour, so it lies on the
  // tile exactly; each is baked once (a store that forgets the oldest past 48) and drawn with one drawImage
  const DELTA = [0, 3, 1, -2];
  function ringSprite(S, P, L, f) {
    const st = stateOf(S), key = L.i + "|" + f;
    let s = st.rings.get(key);
    if (s) return s;
    const R1 = L.r + Math.max(0, DELTA[f]) + 1, hx = Math.ceil(R1), hy = Math.ceil(R1 / L.fy), x0 = Math.floor(L.x) - hx, y0 = Math.floor(L.y) - hy, W = 2 * hx + 1, H = 2 * hy + 1, px = new Array(W * H).fill(null);
    const alt = { L, r: L.r + DELTA[f] }, o = [null, 0];
    let any = 0;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const x = x0 + i, y = y0 + j; if (x < 0 || y < 0 || x >= P.W || y >= TH) continue;
      const k0 = kOf(L, x, y, L.r), k1 = kOf(L, x, y, alt.r); if (k0 === 0 && k1 === 0) continue;
      if (Math.max(k0, k1) > 0.55) continue;   // (the outer two levels only)
      // a pixel can change only where this light's own level does: the level grows with closeness, so the strongest light's level is the
      // largest of the lights' levels, and the others' are the same at both radii
      const b = BAYER[((y & 3) << 2) | (x & 3)] / 16; if (clamp(Math.floor(k0 * 4 + b - 0.5), 0, 4) === clamp(Math.floor(k1 * 4 + b - 0.5), 0, 4)) continue;
      baseOf(P, x, y, o); if (!o[1]) continue;
      const was = shade(P, x, y, o[0], o[1], null), now = shade(P, x, y, o[0], o[1], alt);
      if (was !== now) { px[j * W + i] = now; any++; }
    }
    s = G.sprite(px, W, H, 0, 0, { ring: true, light: L.i, phase: f, x0, y0, n: any });
    st.rings.set(key, s); st.ringOrder.push(key);
    while (st.ringOrder.length > 48) st.rings.delete(st.ringOrder.shift());
    return s;
  }
  function lights(ctx, F, t, still, S) {
    if (still) return 0;
    const P = prep(S.A), v = S.view, VW = S.vw || TW, VH = S.vh || 216, cx = v.x0 + VW / 2, cy = v.y0 + VH / 2, tick = Math.floor(t * 8);
    const fires = P.lights.filter(L => L.fire && L.x + L.r >= v.x0 && L.x - L.r <= v.x0 + VW && L.y + L.r / L.fy >= v.y0 && L.y - L.r / L.fy <= v.y0 + VH);
    fires.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
    // (a ring not yet baked is baked now, one a frame (2 ms at most); the rest wait, their pools showing as baked meanwhile)
    let n = 0, made = 0; const st = stateOf(S);
    for (const L of fires.slice(0, 8)) { const f = (tick + L.i * 3) & 3; if (!f) continue; if (!st.rings.has(L.i + "|" + f)) { if (made >= 1) continue; made++; } const s = ringSprite(S, P, L, f); if (s.n) { blit(ctx, s, s.x0, s.y0); n++; } }
    return n;
  }

  // ------------------------------------------------------------------ the weather (section 3.8): snow falls in the yard, about 60 flakes of 1
  // and 2 px drifting down and a little east at 10 to 18 px/s with a slow sway, in view coordinates; held still under less motion (40
  // flakes); a few blow in at the long hall's arrow slits
  function weather(ctx, camX, camY, t, still, S) {
    // (the window the page draws may be wider or taller than the camera's 384 x 216: the flakes wrap over it, as many to the area)
    const P = prep(S.A), VW = S.vw || TW, VH = S.vh || 216, WX = VW + 16, WY = VH + 16, area = (WX * WY) / (400 * 232); let n = 0;
    if (lookOf(P, camX + VW / 2) === YARD) {
      const N = Math.round((still ? 40 : 60) * Math.max(1, area)), tt = still ? 0 : t;
      for (let i = 0; i < N; i++) {
        const vy = 10 + 8 * hash(i, 3, 503), vx = 2 + 3 * hash(i, 4, 504), amp = 1.5 + 2.5 * hash(i, 5, 505), ph = hash(i, 6, 506) * TAU;
        const wx = hash(i, 1, 501) * WX + vx * tt + Math.sin(tt * 0.9 + ph) * amp, wy = hash(i, 2, 502) * WY + vy * tt;
        const x = ((wx - camX) % WX + WX) % WX - 8, y = ((wy - camY) % WY + WY) % WY - 8;
        drawAt(ctx, PC.flake(hash(i, 7, 507) < 0.3), Math.round(x), Math.round(y)); n++;
      }
    } else if (!still && lookOf(P, camX + VW / 2) === HALLWAY) {
      for (const s of P.slits) { const sx = s + 2 - camX; if (sx < -4 || sx > VW + 4) continue; for (let i = 0; i < 2; i++) { const q = ((t * 0.35 + hash(s, i, 508)) % 1), x = sx + q * 10 + Math.sin(t * 2 + i) * 1.5, y = 38 - camY + q * 26; drawAt(ctx, PC.flake(false), Math.round(x), Math.round(y)); n++; } }
    }
    return n;
  }

  // ------------------------------------------------------------------ the footprints (section 3.8): every body on the yard's ground leaves a
  // print each 6 px it walks on snow, at its left and right foot by turns; at most 24 a frame (the scene stamps them into the decals)
  function printKind(b) { if (b.knight) return "boot"; if (b.kind === "wolf") return "paws"; if (b.kind === "brute" || b.kind === "rockbrute") return "brute"; return "foot"; }
  function prints(F, S) {
    const P = prep(S.A), st = stateOf(S), out = [];
    if (lookOf(P, S.view.x0 + (S.vw || TW) / 2) !== YARD) return out;
    const seen = new Set();
    for (const b of S.bodiesOf(F)) {
      if (!b.knight && !b.foe) continue;   // (a knight's summons leave none)
      const key = b.knight ? "k" + b.seat : "f" + b.id; seen.add(key);
      if (b.on || b.air || b.climbing || Math.abs(b.z || 0) > 0.5 || b.spawn > 0 || b.out) { st.foot.delete(key); continue; }
      const L = st.foot.get(key);
      if (!L) { st.foot.set(key, { x: b.x, y: b.y, side: 0, n: 0 }); continue; }
      const dx = b.x - L.x, dy = b.y - L.y, d = Math.hypot(dx, dy);
      if (d < 6) continue;
      if (d > 40) { L.x = b.x; L.y = b.y; continue; }   // a passage, a shove, a leap's landing: no trail across it
      if (out.length >= 24) continue;   // (left for the next frame)
      const nx = -dy / d, ny = dx / d, side = L.side ? 1 : -1, w = b.kind === "brute" || b.kind === "rockbrute" ? 3 : b.knight ? 1.5 : 2;
      const px = Math.round(b.x + nx * w * side), py = Math.round(b.y + ny * w * side);
      L.x = b.x; L.y = b.y; L.side ^= 1; L.n++;
      if (snowyAt(P, px, py)) out.push({ s: PC.print(printKind(b), L.n), x: px, y: py });
    }
    for (const k of st.foot.keys()) if (!seen.has(k)) st.foot.delete(k);
    return out;
  }

  // ------------------------------------------------------------------ the marks' looks, by where they lie
  function markKind(e, kind, A) {
    if (e.type === "mark" && e.kind === "fire" && !(e.z > 0) && !e.on && lookOf(prep(A), e.x) === YARD) return "melt";   // fire on the yard melts the snow under it at once
    return kind;
  }
  function markLook(kind, r, v, x, y, A) {
    const rr = Math.max(2, Math.round(r || 4)), vv = (v | 0) % 3, yard = lookOf(prep(A), x) === YARD;
    if (yard) {
      if (kind === "melt" || kind === "scorch") return MK.melt(rr, vv);
      if (kind === "crater") return MK.snowCrater(rr, vv);
      if (kind === "filled") return MK.yardFilled(rr, vv);
      if (kind === "dirt") return MK.yardDirt(rr, vv);
      if (kind === "damp") return MK.slush(rr, vv);
      return null;
    }
    if (kind === "crater") return MK.stoneCrater(rr, vv);
    if (kind === "filled") return MK.slabs(rr, vv);
    if (kind === "dirt") return MK.chips(rr, vv);
    if (kind === "crack") return MK.crack(rr, vv);
    return null;
  }
  function liveLook(kind, r, f, level, x, y, A) { if (kind === "ice" && lookOf(prep(A), x) === YARD) return MK.ice(Math.max(2, Math.round(r)), (f | 0) & 3, clamp(level === undefined ? 3 : level | 0, 0, 3)); return null; }
  function chipLook(kind, i, x, y, A) { if (lookOf(prep(A), x) === YARD) return null; if (kind === "clod") return MK.clod(); if (kind === "dirt") return MK.chip(i); return null; }

  // ------------------------------------------------------------------ the art, and what the tests read
  const art = { id: "Hall", tufts: false, paintRows, paint, pieces, lights, wall, weather, prints, markKind, markLook, liveLook, chipLook, take };
  // every prop kind, surface kind, palisade style and engine kind the level's spec may name, and how this art draws it
  const DRAWS = { wall: "tile", drift: "tile", grate: "tile+steam", well: "well", cart: "cart", hay: "hay", rack: "rack", butt: "butt", brazier: "brazier", barrel: "barrel",
    paleTree: "paleTree", pillar: "pillar", armour: "armour", table: "table+chandelier", bench: "bench", highTable: "table", chair: "chair",
    deck: "deck", stair: "stair", landing: "landing", barricade: "planks+hay+plankGate", portcullis: "portcullis", trebuchet: "trebuchet" };
  root.Hall = { art, R, LAYOUT, prep, paint, paintRows, pixel, baseOf, shade, lightK, snowyAt, sprites: PC, marks: MK, DRAWS, sync, stateOf, ringSprite, DELTA };
  if (typeof module !== "undefined" && module.exports) module.exports = root.Hall;
})(typeof window !== "undefined" ? window : globalThis);
