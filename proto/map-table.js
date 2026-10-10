// FORGE FOREVER: the Map Table (design pass 25 with its revision 1; built by build 17, card t79, design pass 26). The oak table in the
// gatehouse by the courtyard's gate, seen from straight above and lit by two candles, and on it the map of the realm: home in the
// middle, the Troll Castle on the left (open: a troll footman, the game's own sprite, keeps its gate), the Frostpeaks (north), the
// Dragon's Den (north-east), the Usurper's Capital (east) and the Burning Sands (south), the four of them placeholders under drifting
// cloud with a carved pawn where their mob will stand. A room of the castle page (proto/the-forge.html), which mounts this file: the
// names, the taps, the plates and the trip's clock are the page's. This file is the map itself: docs/design/25-map-table.sketch.js
// moved into the game with its drawing code untouched (tools/test-map.js holds its pixels to the sketch's and keeps revision 1's
// checks), its numbers as data (spec/map.json, the sketch's SPEC), and the reveal added to the live layer.
//
// Land is painted flat on the parchment; home and the places are models that stand up off it, outlined in soot, so they read as the
// things to tap. Since revision 1 the sheet is 512 x 240 and drawn as a map: every area in a territory of its own (its tap zone), its
// country a shape inside it with open plain or the river between two countries; the parchment under a pale green wash, with grain,
// stains and fold lines; an inked texture for each country, a lined coast and a ruled sea; a ruled border carrying the degrees of
// seven meridians and four parallels; a compass rose, a scale bar and a legend in the north-west corner, the map's fine print inked
// in a 3 x 5 pixel hand. Everything is drawn in code by the house's rules (pass 2 section 3.2, pass 7).
//
//   MapTable.SPEC                         spec/map.json (window.FORGE_MAP in the page)
//   const room = new MapTable.Room()      the table, the sheet, the land, the chart, the furniture, the models, the lights
//   room.groundFrame(f, x0, y0, w, h)     the room lit for candle phase f (0 to 3), a crop of it, as RGBA; room.pieceFrame(P, f)
//   room.live(t, st)                      everything that moves at time t, in room pixels. st: { states: { areaId: state }, trip: { area,
//                                         t0, back } | null, going: { area, t0 } | null, reveal: { kind, area, t0 } | null, wobble, shades, still }
//   MapTable.areaState(A, cleared)        soon, shut, open or won; MapTable.levelRows(A, cleared, lastPick) the plate's rows and its pick
//   MapTable.levelUrl(row, brothers, base)   the address a pick opens on the Battlegrounds page
//   MapTable.tripAt, tripTime             the knight on a road; MapTable.hitAt(spec, x, y) where a tap on the sheet lands
//   MapTable.seenOf(spec, cleared), changes(spec, seen, cleared)   what the map shows now (the save keeps it), and what changed since it
//                                         was last shown: the reveal's plays
//   MapTable.fit(devW, devH)              the largest whole scale that fits the sheet (with its margin of table) in so many device pixels
//
// Pure: no DOM, no clock, no Math.random. Needs proto/smithy.js; the figures are proto/trolls.js's and proto/knight.js's, drawn by the
// page. Plain script, defines window.MapTable (module.exports in node).
(function (root) {
  "use strict";
  if (!root.Smithy && typeof module !== "undefined" && module.exports && typeof require === "function") require("./smithy.js");
  const S = root.Smithy;
  if (!S || !S.BAYER) throw new Error("map-table.js needs proto/smithy.js");
  const OUT = S.OUT, BAYER = S.BAYER, hex = S.hex;
  const bay = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  // a hash in [0, 1) for a cell, the same at every size and on every run (the courtyard sketch's)
  const hash = (a, b, c) => { let h = (a * 374761393 + b * 668265263 + (c || 0) * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const smooth = t => t * t * (3 - 2 * t);
  // value noise at lattice scale s, 0 to 1 (proto/gate.js's)
  function vnoise(x, y, s, k) {
    const gx = Math.floor(x / s), gy = Math.floor(y / s), fx = smooth(x / s - gx), fy = smooth(y / s - gy);
    const a = hash(gx, gy, k), b = hash(gx + 1, gy, k), c = hash(gx, gy + 1, k), d = hash(gx + 1, gy + 1, k);
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // ------------------------------------------------------------------ the map's numbers: spec/map.json
  // Map pixels (the sheet's own), y grows downward. A place's zone is its territory and what a tap on it hits: zones never overlap
  // and lie at least 6 px apart. Its label is where its name stands (the page writes the names in HTML over the canvas, centred on
  // that point). A road runs from where the knight stands at home to where the knight stops at the place. An area's levels are the
  // levels of the Battlegrounds page in order; a level marked soon is shown, dimmed, and cannot be picked.
  const SPEC = root.FORGE_MAP || (typeof module !== "undefined" && module.exports && typeof require === "function" ? require("../spec/map.json") : null);
  if (!SPEC) throw new Error("map-table.js: spec/map.js is not loaded");

  // the palette's ramps (dark, mid, lit, glint)
  const R = {
    oak: ["#3e2731", "#733e39", "#b86f50", "#e4a672"], iron: ["#262b44", "#3a4466", "#5a6988", "#8b9bb4"], steel: ["#3a4466", "#5a6988", "#8b9bb4", "#c0cbdc"],
    parch: ["#c28569", "#e4a672", "#ead4aa", "#fffaf0"], ink: ["#3e2731", "#733e39"],
    grass: ["#193c3e", "#265c42", "#3e8948", "#63c74d"], field: ["#3e2731", "#733e39", "#b86f50", "#e4a672"], snow: ["#5a6988", "#8b9bb4", "#c0cbdc", "#ffffff"],
    sand: ["#733e39", "#b86f50", "#e4a672", "#ead4aa"], ash: ["#181425", "#2a1d28", "#3e2731", "#5a3030"], water: ["#262b44", "#124e89", "#0099db", "#2ce8f5"],
    rock: ["#262b44", "#3a4466", "#5a6988", "#8b9bb4"], tstone: ["#4a4450", "#6e6a70", "#9a948c", "#c4bcae"], hstone: ["#4a4458", "#6e6a70", "#9a948c", "#c4bcae"],
    cstone: ["#5a6988", "#8b9bb4", "#c0cbdc", "#ffffff"], slate: ["#181425", "#262b44", "#3a4466", "#5a6988"], crimson: ["#5a3030", "#a22633", "#e43b44", "#f6757a"],
    terra: ["#733e39", "#be4a2f", "#d77643", "#e4a672"], hide: ["#3e2731", "#733e39", "#b86f50", "#c28569"], bone: ["#c28569", "#e8b796", "#ead4aa", "#fffaf0"],
    gold: ["#be4a2f", "#f77622", "#feae34", "#fee761"], blue: ["#0b2f55", "#124e89", "#0099db", "#2ce8f5"], moss: ["#193c3e", "#265c42"], lava: ["#a22633", "#e43b44", "#f77622", "#feae34", "#fee761"],
    pewter: ["#3a4466", "#5a6988", "#8b9bb4", "#c0cbdc"], wax: ["#c28569", "#e8b796", "#ead4aa", "#fffaf0"], cloud: ["#8b9bb4", "#c0cbdc", "#ffffff", "#ffffff"]
  };
  const FIRE = ["#a22633", "#e43b44", "#f77622", "#feae34", "#fee761", "#fff6c8"];

  // ------------------------------------------------------------------ a painter over a W x H layer: a colour and whether light falls on it
  function Layer(w, h) { this.w = w; this.h = h; this.px = new Array(w * h).fill(null); this.lit = new Uint8Array(w * h); }
  Layer.prototype.set = function (x, y, c, l) { x = Math.round(x); y = Math.round(y); if (c && x >= 0 && y >= 0 && x < this.w && y < this.h) { this.px[y * this.w + x] = c; this.lit[y * this.w + x] = l === undefined ? 1 : l; } };
  Layer.prototype.get = function (x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.px[y * this.w + x] : null; };
  Layer.prototype.fill = function (x0, y0, x1, y1, f, l) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const c = typeof f === "function" ? f(x, y) : f; if (c) this.set(x, y, c, l); } };
  // a region lit from the top left (the house's rule): the ramp's lit tone on its upper-left edge, its dark tone on its lower-right
  Layer.prototype.region = function (pred, ramp, o) {
    o = o || {}; const x0 = Math.max(0, o.x0 || 0), y0 = Math.max(0, o.y0 || 0), x1 = Math.min(this.w - 1, o.x1 === undefined ? this.w - 1 : o.x1), y1 = Math.min(this.h - 1, o.y1 === undefined ? this.h - 1 : o.y1);
    const m = (x, y) => pred(x + 0.5, y + 0.5);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (m(x, y)) {
      const ul = !m(x - 1, y) || !m(x, y - 1), dr = !m(x + 1, y) || !m(x, y + 1);
      let c = ul && dr ? ramp[1] : dr ? ramp[0] : ul ? ramp[2] : ramp[1];
      if (o.spec && o.spec(x, y)) c = ramp[3];
      if (o.tex) c = o.tex(x, y, c) || c;
      this.set(x, y, c, o.l);
    }
  };
  // the soot outline round whatever is drawn (every empty pixel beside a drawn one)
  Layer.prototype.outline = function (l) { const add = []; for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (!this.get(x, y) && (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1))) add.push([x, y]); for (const [x, y] of add) this.set(x, y, OUT, l); };
  const rect = (x0, y0, x1, y1) => (x, y) => x >= x0 && x <= x1 + 1 && y >= y0 && y <= y1 + 1;
  const ell = (cx, cy, rx, ry) => (x, y) => ((x - cx) ** 2) / (rx * rx) + ((y - cy) ** 2) / (ry * ry) <= 1.02;
  const poly = pts => (x, y) => { let inside = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside; } return inside; };
  const or = (...f) => (x, y) => f.some(g => g(x, y));
  const and = (...f) => (x, y) => f.every(g => g(x, y));
  const not = f => (x, y) => !f(x, y);
  function segDist(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy, t = L ? clamp(((px - ax) * dx + (py - ay) * dy) / L, 0, 1) : 0; return Math.hypot(px - ax - t * dx, py - ay - t * dy); }
  function lineDist(px, py, pts) { let d = 1e9; for (let i = 0; i + 1 < pts.length; i++) d = Math.min(d, segDist(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1])); return d; }
  // walk a polyline by arc length: the points every `step` pixels, with the direction there
  function along(pts, step, from) {
    const out = []; let acc = from || 0;
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1], L = Math.hypot(bx - ax, by - ay);
      while (acc <= L) { const t = acc / L; out.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t, dx: (bx - ax) / L, dy: (by - ay) / L }); acc += step; }
      acc -= L;
    }
    return out;
  }
  const lengthOf = pts => { let L = 0; for (let i = 0; i + 1 < pts.length; i++) L += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); return L; };

  // ------------------------------------------------------------------ the land: where each kind of country is
  const W = SPEC.sheet.w, H = SPEC.sheet.h, IN = SPEC.border;    // the sheet, and the border's depth: the land is painted inside it
  const FX0 = IN, FY0 = IN, FX1 = W - IN - 1, FY1 = H - IN - 1;   // the field: the first and last pixel of land each way
  // the coast: the sea lies right of this line (x at each y, down to the sheet's foot)
  const COAST = [[512, 90], [504, 102], [498, 116], [496, 132], [494, 148], [490, 162], [480, 174], [466, 184], [452, 194], [438, 204], [426, 214], [416, 226], [410, 240]];
  function coastX(y) { if (y < COAST[0][1]) return 1e9; for (let i = 0; i + 1 < COAST.length; i++) { const [x0, y0] = COAST[i], [x1, y1] = COAST[i + 1]; if (y <= y1) return x0 + (x1 - x0) * (y - y0) / (y1 - y0) + (vnoise(0, y, 6, 31) - 0.5) * 3; } return COAST[COAST.length - 1][0]; }
  const inSea = (x, y) => x > coastX(y);
  // the river: from the frozen lake at the Frostpeaks' east foot, out through the gap between the peaks and the Den, down between
  // home's plain and the capital's fields, past the Sands to the sea. It is the line between the map's middle and its east
  const RIVER = [[316, 85], [324, 91], [334, 100], [344, 112], [352, 126], [360, 142], [368, 158], [376, 174], [386, 190], [396, 206], [404, 220], [410, 236]];
  const LAKE = { x: 307, y: 82, rx: 11, ry: 5 };
  const riverW = y => y < 130 ? 1.3 : y < 186 ? 1.7 : 2.1;
  const inLake = (x, y) => ((x - LAKE.x) / LAKE.rx) ** 2 + ((y - LAKE.y) / LAKE.ry) ** 2 <= 1;
  const inRiver = (x, y) => y >= RIVER[0][1] && lineDist(x, y, RIVER) <= riverW(y);
  // how far (x, y) is outside a box with round corners (negative inside)
  function sdRound(x, y, x0, y0, x1, y1, r) { const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, qx = Math.abs(x - cx) - ((x1 - x0) / 2 - r), qy = Math.abs(y - cy) - ((y1 - y0) / 2 - r); return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r; }
  // Each area's country is a shape that lies inside the area's zone: a round-cornered box two pixels inside it (cut where the zone
  // is cut), its edge pushed in by up to twelve more pixels of noise so no border is a ruled line (wob scales that). Where a zone
  // meets the border the country runs off the sheet, as a map's countries do. Whatever is not a country, the sea or the bare corner
  // is plain. dry: how far the country keeps from the river's line
  const COUNTRIES = [
    { kind: "snow", area: "frostpeaks", sd: (x, y) => sdRound(x, y, 144, -30, 320, 90, 18) },
    { kind: "ash", area: "dragons-den", sd: (x, y) => sdRound(x, y, 348, -30, 540, 92, 16) },
    { kind: "waste", area: "troll-castle", sd: (x, y) => Math.max(sdRound(x, y, -30, 90, 156, 270, 16), ((x - 122) - (y - 88)) / Math.SQRT2 + 3, ((x - 158) * 50 + (y - 176) * 22) / 54.63 + 3) },
    { kind: "farm", area: "usurpers-capital", dry: 5, sd: (x, y) => sdRound(x, y, 386, 102, 540, 216, 16) },
    { kind: "sand", area: "burning-sands", dry: 5, wob: 0.45, sd: (x, y) => sdRound(x, y, 166, 188, 368, 270, 12) }
  ];
  const CORNER = SPEC.corner;
  // what lies at a map pixel: { kind, depth } with depth how far inside its shape the pixel is. For the plain, depth is how far it
  // is from the bare corner (the wash thins toward it)
  function shapeAt(x, y) {
    if (inSea(x, y)) return { kind: "sea", depth: 9 };
    for (let i = 0; i < COUNTRIES.length; i++) {
      const C = COUNTRIES[i], d = C.sd(x, y); if (d > 0) continue;
      const depth = -d - (vnoise(x, y, 19, 30 + i * 2) * 9 + vnoise(x, y, 6, 31 + i * 2) * 3) * (C.wob || 1);
      if (depth > 0 && !(C.dry && lineDist(x, y, RIVER) < C.dry)) return { kind: C.kind, depth, area: C.area };
    }
    const bare = -sdRound(x, y, CORNER[0] - 8, CORNER[1] - 8, CORNER[2] + 4, CORNER[3] + 2, 12) - (vnoise(x, y, 11, 44) - 0.5) * 5;
    return bare > 0 ? { kind: "bare", depth: bare } : { kind: "plain", depth: -bare };
  }
  // the country a map pixel is drawn as (a country's last two pixels are dithered into the plain, so its edge is soft)
  function countryAt(x, y) { const s = shapeAt(x, y); return s.kind !== "sea" && s.kind !== "plain" && s.kind !== "bare" && s.depth < 2 && bay(x, y) > s.depth / 2 ? "plain" : s.kind; }
  // the bare paper at a sheet pixel: the parchment's tone and its stains
  function paperAt(x, y) { const st = vnoise(x, y, 19, 23), st2 = vnoise(x, y, 5, 24); return (st > 0.68 && bay(x, y) < (st - 0.68) * 3) || (st2 > 0.84 && bay(x, y) < 0.25) ? R.parch[1] : R.parch[2]; }
  // the plain: the parchment itself under a pale green wash, so the paper shows through everywhere; greener round home, with deeper
  // meadow in patches, and thinning to bare paper toward the furniture corner (fade 0 to 1)
  function plainAt(x, y, fade) {
    const v = vnoise(x, y, 23, 61), v2 = vnoise(x, y, 6, 62), home = Math.max(0, 1 - Math.hypot((x - 258) / 150, (y - 138) / 92));
    const g = (0.36 + v * 0.26 + home * 0.34) * (fade === undefined ? 1 : fade), b = bay(x, y);
    if (b < g - 0.5 && v2 > 0.42) return R.grass[2];
    return b < g ? R.grass[3] : paperAt(x, y);
  }
  // a country's own ground: a wash and an inked texture over it, from noise and the Bayer matrix (the same on every run)
  function groundAt(kind, x, y, depth) {
    const v = vnoise(x, y, 7, 11), h = hash(x, y, 13), b = bay(x, y);
    switch (kind) {
      case "snow": {   // white, a cool edge, drift lines and a few dots
        if (depth < 3.4) return b < 0.45 ? R.snow[1] : R.snow[2];
        const drift = Math.sin(x * 0.16 - y * 0.42 + vnoise(x, y, 14, 18) * 5);
        return h > 0.992 ? R.snow[1] : drift > 0.86 ? R.snow[2] : b < (0.3 - v) * 1.1 ? R.snow[2] : R.snow[3]; }
      case "ash": {    // a dark wash, cross-hatched in patches, cracked
        const crack = Math.abs(vnoise(x, y, 10, 15) - 0.5) < 0.025, hatch = ((x + y) % 5 === 0 || (x - y + 600) % 5 === 0) && vnoise(x, y, 9, 19) > 0.52;
        return crack ? R.ash[0] : h > 0.994 ? "#a22633" : hatch ? R.ash[1] : b < (v - 0.45) * 1.4 ? R.ash[3] : R.ash[2]; }
      case "waste": {  // the trolls' country: a russet wash, scratch-hatched, burnt in patches, a little green left
        const burnt = vnoise(x, y, 11, 14), scratch = (x * 2 + y * 3) % 9 === 0 && vnoise(x, y, 7, 17) > 0.4;
        if (scratch) return R.field[1];
        if (burnt > 0.62) return b < (burnt - 0.62) * 3 ? R.field[1] : R.field[2];
        if (burnt < 0.3 && b < (0.3 - burnt) * 2.2) return R.grass[2];
        return h > 0.992 ? "#feae34" : b < 0.26 + burnt * 0.3 ? R.field[3] : R.field[2]; }
      case "sand": {   // ripples, and stipple in patches
        const rip = Math.sin(x * 0.42 + y * 1.3 + vnoise(x, y, 12, 16) * 7), dot = (x * 3 + y * 5) % 13 === 0 && vnoise(x, y, 8, 20) > 0.4;
        if (depth < 1.6) return R.sand[1];
        return dot ? R.sand[1] : rip > 0.86 ? R.sand[3] : rip < -0.9 && b < 0.5 ? R.sand[1] : R.sand[2]; }
      case "farm": return farmAt(x, y);
    }
    return plainAt(x, y);
  }

  // fields in a patchwork: the nearest of a jittered grid of field centres decides the crop, and where two fields meet, a hedge
  function farmAt(x, y) {
    const C = 11, gx = Math.floor(x / C), gy = Math.floor(y / (C * 0.75)); let d1 = 1e9, d2 = 1e9, k1 = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = (gx + i + 0.2 + hash(gx + i, gy + j, 18) * 0.6) * C, cy = (gy + j + 0.2 + hash(gx + i, gy + j, 19) * 0.6) * C * 0.75, d = Math.hypot(x - cx, (y - cy) * 1.2);
      if (d < d1) { d2 = d1; d1 = d; k1 = hash(gx + i, gy + j, 20); } else if (d < d2) d2 = d;
    }
    if (d2 - d1 < 1.1) return bay(x, y) < 0.6 ? R.grass[1] : R.grass[0];
    if (k1 < 0.22) return (y + Math.floor(x / 3)) % 2 ? R.field[1] : R.field[2];           // ploughed, in furrows
    if (k1 < 0.38) return y % 2 ? R.sand[2] : R.field[2];                                  // wheat
    if (k1 < 0.75) return bay(x, y) < 0.18 ? R.grass[3] : R.grass[2];                      // pasture
    return bay(x, y) < 0.35 ? R.grass[1] : R.grass[2];                                     // rough grazing
  }

  // ------------------------------------------------------------------ the map's own hand: capitals and digits, three by five
  const FONT = (() => {
    const g = {
      A: ".o. o.o ooo o.o o.o", B: "oo. o.o oo. o.o oo.", C: ".oo o.. o.. o.. .oo", D: "oo. o.o o.o o.o oo.", E: "ooo o.. oo. o.. ooo", F: "ooo o.. oo. o.. o..",
      G: ".oo o.. o.o o.o .oo", H: "o.o o.o ooo o.o o.o", I: "ooo .o. .o. .o. ooo", J: "..o ..o ..o o.o .o.", K: "o.o o.o oo. o.o o.o", L: "o.. o.. o.. o.. ooo",
      M: "o.o ooo ooo o.o o.o", N: "oo. o.o o.o o.o o.o", O: ".o. o.o o.o o.o .o.", P: "oo. o.o oo. o.. o..", Q: ".o. o.o o.o ooo .oo", R: "oo. o.o oo. o.o o.o",
      S: ".oo o.. .o. ..o oo.", T: "ooo .o. .o. .o. .o.", U: "o.o o.o o.o o.o ooo", V: "o.o o.o o.o o.o .o.", W: "o.o o.o ooo ooo o.o", X: "o.o o.o .o. o.o o.o",
      Y: "o.o o.o .o. .o. .o.", Z: "ooo ..o .o. o.. ooo",
      0: "ooo o.o o.o o.o ooo", 1: ".o. oo. .o. .o. ooo", 2: "oo. ..o .o. o.. ooo", 3: "oo. ..o .o. ..o oo.", 4: "o.o o.o ooo ..o ..o", 5: "ooo o.. oo. ..o oo.",
      6: ".oo o.. ooo o.o ooo", 7: "ooo ..o .o. .o. .o.", 8: "ooo o.o ooo o.o ooo", 9: "ooo o.o ooo ..o oo.",
      "°": "oo oo .. .. ..", " ": ".. .. .. .. .."
    };
    const out = {}; for (const k of Object.keys(g)) out[k] = g[k].split(" "); return out;
  })();
  // how wide a line of the hand is, a pixel (or gap pixels) between its letters
  const textW = (s, gap) => [...String(s)].reduce((w, ch) => w + (FONT[ch] || FONT[" "])[0].length + (gap || 1), -(gap || 1));
  // ink a line of the hand with its top left at (x, y); turn -1 runs it up the sheet, turn 1 down it (for the border's sides)
  function inkText(set, s, x, y, c, turn, gap) {
    let at = 0;
    for (const ch of String(s)) {
      const G = FONT[ch] || FONT[" "];
      for (let j = 0; j < 5; j++) for (let i = 0; i < G[0].length; i++) if (G[j][i] === "o") { if (!turn) set(x + at + i, y + j, c); else if (turn < 0) set(x + j, y - at - i, c); else set(x + 4 - j, y + at + i, c); }
      at += G[0].length + (gap || 1);
    }
  }
  // where the chart's lines run: a meridian's x at height y, a parallel's y at x. The meridians lean in toward the north and the
  // parallels sag at the sides, as on a chart of the northern half of a world
  const GR = SPEC.graticule;
  const meridianX = (x0, y) => W / 2 + (x0 - W / 2) * (1 + GR.lean * (y - H / 2) / (H / 2 - IN));
  const parallelY = (y0, x) => y0 - GR.sag * ((x - W / 2) / (W / 2 - IN)) ** 2;

  // ------------------------------------------------------------------ the room: the table, the sheet, the land, the models, the light
  const DEN = { cx: 424, top: 16, base: 80, hw: 52, cave: 72 };   // the Den's mountain: its middle, top and foot, its half width, its cave's sill
  const CAMP = { hut: [32, 174], fire: [56, 182] };                // the trolls' camp
  function Room(spec) {
    spec = spec || SPEC;
    this.spec = spec; this.W = spec.room.w; this.H = spec.room.h; this.SX = spec.room.sheetX; this.SY = spec.room.sheetY;
    this.ground = new Layer(this.W, this.H);
    this.lava = [];                // the den's lava pixels (room pixels) with their phase, recoloured live
    this.water = [];               // where the glints may show (room pixels)
    this.flames = [];              // the still things that burn: candles, the trolls' fire, the capital's torches, the Forge's mouth
    this.smokes = [];              // where smoke rises: { x, y, kind }
    this.banners = [];             // { x, y, kind } the pole's top, room pixels
    this.lights = [];
    this.marks = [];               // what stands in each area, for the check: { area, what, box: [x0, y0, x1, y1] } in sheet pixels
    paintTable(this);
    paintSheet(this);
    paintLand(this);
    paintWater(this);
    paintPaper(this);
    paintGraticule(this);
    paintBorder(this);
    paintRoads(this);
    paintCountry(this);
    paintFurniture(this);
    paintProps(this);
    this.pieces = [castlePiece(this), homePiece(this), capitalPiece(this)].concat(spec.candles.map(([x, y]) => candlePiece(this, x, y))).concat(spec.areas.some(a => a.look === "arena") ? [arenaPiece(this)] : []);   // (design pass 36: the Arena's colosseum, after the candles so their places in the list hold)
    for (const c of spec.candles) this.lights.push({ kind: "candle", x: c[0], y: c[1] - 16, r: 120 });
    const hm = spec.home.model;
    this.lights.push({ kind: "fire", x: this.SX + CAMP.fire[0], y: this.SY + CAMP.fire[1], r: 16 }, { kind: "fire", x: this.SX + hm[0] + 44, y: this.SY + hm[1] + 20, r: 10 },
      { kind: "lava", x: this.SX + DEN.cx, y: this.SY + DEN.cave - 8, r: 22 }, { kind: "lava", x: this.SX + DEN.cx - 2, y: this.SY + DEN.top + 4, r: 16 });
    this.frames = [];
  }
  // a map pixel into the room: set(x, y) in sheet pixels
  function M(room) { const g = room.ground, SX = room.SX, SY = room.SY; const set = (x, y, c, l) => g.set(SX + x, SY + y, c, l); return { set, get: (x, y) => g.get(SX + x, SY + y), fill: (x0, y0, x1, y1, c, l) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, typeof c === "function" ? c(x, y) : c, l); } }; }

  // the oak table: planks across the room, 13 px each, every plank its own tone and grain, the joints dark; darker toward the edges
  function paintTable(room) {
    const g = room.ground, w = room.W, h = room.H, cx = w / 2, cy = h / 2;
    for (let y = 0; y < h; y++) {
      const plank = Math.floor(y / 13), py = y % 13, off = Math.floor(hash(plank, 0, 3) * 97), tone = hash(plank, 1, 3);
      for (let x = 0; x < w; x++) {
        const end = (x + off) % 151 === 0;
        let c = py === 0 || end ? "#2a1d28" : py === 1 ? "#b86f50" : py === 12 ? "#3e2731" : R.oak[1];
        if (c === R.oak[1]) {
          const grain = Math.sin((x + off) * 0.07 + py * 0.9 + vnoise(x, y, 23, plank) * 6);
          if (grain > 0.9) c = "#5a3030"; else if (grain < -0.94 && tone > 0.4) c = "#b86f50";
          if (hash(Math.floor((x + off) / 41), plank, 4) > 0.86 && Math.hypot(((x + off) % 41) - 20, py - 6) < 2.2) c = "#3e2731";   // a knot
        }
        // the edges of the table fall into the dark: dithered toward soot by the distance from the middle
        const d = Math.hypot((x - cx) / (w * 0.62), (y - cy) / (h * 0.66));
        if (bay(x, y) < (d - 0.62) * 2.2) c = d > 0.95 && bay(x + 1, y) < (d - 0.9) * 3 ? OUT : "#2a1d28";
        g.set(x, y, c, 1);
      }
    }
  }
  // the parchment: worn at its edge, stained, a soft shadow on the table (paintBorder inks the border over it)
  function paintSheet(room) {
    const g = room.ground, SX = room.SX, SY = room.SY;
    // the shadow under the sheet, 3 px to the right and down
    for (let y = 2; y < H + 3; y++) for (let x = 2; x < W + 3; x++) if (x >= W - 1 || y >= H - 1) g.set(SX + x, SY + y, bay(x, y) < 0.7 ? "#2a1d28" : OUT, 1);
    const m = M(room);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const e = Math.min(x, y, W - 1 - x, H - 1 - y);
      // the worn edge: a few pixels bitten out, never through the border's line
      if (e === 0 && hash(x, y, 21) < 0.18) continue;
      if (e === 1 && hash(x, y, 22) < 0.05) continue;
      m.set(x, y, e === 0 ? R.parch[0] : e === 1 ? R.parch[1] : paperAt(x, y), 1);
    }
  }
  // the plain's wash and every country's ground inside the border. room.country says what each pixel was drawn as
  function paintLand(room) {
    const m = M(room);
    room.country = new Array(W * H).fill(null);
    for (let y = FY0; y <= FY1; y++) for (let x = FX0; x <= FX1; x++) {
      const s = shapeAt(x, y); let k = s.kind;
      if (k !== "sea" && k !== "plain" && k !== "bare" && s.depth < 2 && bay(x, y) > s.depth / 2) k = "plain";   // the soft edge
      room.country[y * W + x] = k;
      if (k === "sea" || k === "bare") continue;
      m.set(x, y, k === "plain" ? plainAt(x, y, s.kind === "plain" ? clamp(s.depth / 18, 0, 1) : 1) : groundAt(k, x, y, s.depth), 1);
    }
    // tufts inked on the plain: three pixels, a little v
    for (let gy = FY0; gy < FY1 - 2; gy += 7) for (let gx = FX0; gx < FX1 - 3; gx += 9) {
      if (hash(gx, gy, 71) > 0.36) continue;
      const x = gx + 1 + Math.floor(hash(gx, gy, 72) * 5), y = gy + 1 + Math.floor(hash(gx, gy, 73) * 4), s = shapeAt(x, y);
      if (s.kind !== "plain" || s.depth < 14) continue;
      if (![0, 1, 2].every(i => countryOf(room, x + i, y) === "plain" && countryOf(room, x + i, y + 1) === "plain")) continue;
      m.set(x, y, R.grass[1], 1); m.set(x + 2, y, R.grass[1], 1); m.set(x + 1, y + 1, R.grass[1], 1);
    }
  }
  const countryOf = (room, x, y) => (x >= FX0 && y >= FY0 && x <= FX1 && y <= FY1) ? room.country[(y | 0) * W + (x | 0)] : null;
  // the sea, its shallows, the lining that follows the coast out and the wave strokes ruled across the open water; the frozen lake;
  // the river with its banks inked; the coast inked
  function paintWater(room) {
    const m = M(room), SX = room.SX, SY = room.SY;
    for (let y = FY0; y <= FY1; y++) for (let x = FX0; x <= FX1; x++) {
      if (countryOf(room, x, y) !== "sea") continue;
      const off = x - coastX(y);
      let c = off < 3 ? R.water[2] : R.water[1];
      // water lining: two dotted rows that follow the coast out, as an engraver rules them
      if ((off >= 6 && off < 7 && (x + y) % 3 !== 0) || (off >= 11 && off < 12 && (x + y) % 4 < 2)) c = R.water[2];
      // the open sea: short wave strokes in staggered rows
      if (off >= 16 && y % 5 === 2 && (x + (Math.floor(y / 5) % 2) * 5) % 10 < 4) c = R.water[2];
      m.set(x, y, c, 1);
      if (off > 4 && hash(x, y, 42) < 0.04) room.water.push([SX + x, SY + y]);
    }
    // the coast: a beach pixel of pale sand, then the ink line on the sea's side
    for (let y = FY0; y <= FY1; y++) for (let x = FX0; x <= FX1; x++) {
      const sea = countryOf(room, x, y) === "sea";
      if (!sea && countryOf(room, x + 1, y) === "sea") { m.set(x, y, R.sand[3], 1); }
      if (sea && (countryOf(room, x - 1, y) && countryOf(room, x - 1, y) !== "sea" || countryOf(room, x, y - 1) && countryOf(room, x, y - 1) !== "sea")) m.set(x, y, R.ink[0], 1);
    }
    // the frozen lake at the Frostpeaks' east foot: ice with its cracks, a dark rim
    for (let y = LAKE.y - LAKE.ry - 1; y <= LAKE.y + LAKE.ry + 1; y++) for (let x = LAKE.x - LAKE.rx - 1; x <= LAKE.x + LAKE.rx + 1; x++) {
      if (!inLake(x, y)) continue;
      const rim = !inLake(x - 1, y) || !inLake(x + 1, y) || !inLake(x, y - 1) || !inLake(x, y + 1);
      const crack = Math.abs((x - LAKE.x) * 0.5 - (y - LAKE.y) * 1.3) < 0.5 || Math.abs((x - LAKE.x + 6) * 0.9 + (y - LAKE.y) * 1.1) < 0.5;
      m.set(x, y, rim ? R.snow[0] : crack ? R.snow[1] : (y < LAKE.y - 1 && bay(x, y) < 0.3) ? R.snow[3] : R.snow[2], 1);
    }
    // the river: the water two tones, a bank inked on each side
    for (let y = RIVER[0][1]; y <= FY1; y++) for (let x = 300; x < 424; x++) {
      const k = countryOf(room, x, y); if (k === "sea" || !k || inLake(x, y)) continue;
      const d = lineDist(x, y, RIVER), w = riverW(y);
      if (d <= w) { m.set(x, y, d < w - 0.9 ? R.water[1] : R.water[2], 1); if (hash(x, y, 43) < 0.05) room.water.push([SX + x, SY + y]); }
      else if (d <= w + 1) m.set(x, y, k === "snow" ? R.snow[0] : k === "ash" ? R.ash[0] : R.ink[1], 1);
    }
  }
  // the paper under the paint: fibres that show through it, the sheet aged toward its edge, foxing, the folds rubbed pale
  function paintPaper(room) {
    const m = M(room), F = room.spec.folds;
    const light = k => k === "bare" || k === "plain" ? R.parch[3] : k === "ash" ? R.ash[3] : k === "sea" ? R.water[2] : k === "snow" ? R.snow[3] : R.parch[2];
    for (let y = FY0; y <= FY1; y++) for (let x = FX0; x <= FX1; x++) {
      const k = countryOf(room, x, y); if (!k) continue;
      // fibres: short flecks along the grain, pale or brown on the paper, the paper's own tone where there is paint over it
      const cx = Math.floor(x / 7), hf = hash(cx, y, 81);
      if (hf < 0.05) { const x0 = cx * 7 + Math.floor(hash(cx, y, 82) * 4), len = 2 + Math.floor(hash(cx, y, 83) * 3); if (x >= x0 && x < x0 + len) m.set(x, y, k === "bare" || k === "plain" ? (hash(cx, y, 84) < 0.55 ? R.parch[3] : R.parch[1]) : light(k), 1); }
      // aged toward the edge: the paper darker in the last few pixels
      const e = Math.min(x - FX0, y - FY0, FX1 - x, FY1 - y);
      if (e < 9 && m.get(x, y) === R.parch[2] && bay(x, y) < (9 - e) / 18) m.set(x, y, R.parch[1], 1);
    }
    // foxing: little clusters of brown specks on the open paper
    for (let gy = FY0; gy < FY1; gy += 13) for (let gx = FX0; gx < FX1; gx += 17) {
      if (hash(gx, gy, 87) > 0.3) continue;
      const cx = gx + Math.floor(hash(gx, gy, 88) * 15), cy = gy + Math.floor(hash(gx, gy, 89) * 11);
      for (let n = 0; n < 4; n++) { const x = cx + Math.round((hash(gx + n, gy, 90) - 0.5) * 5), y = cy + Math.round((hash(gx, gy + n, 91) - 0.5) * 4), k = countryOf(room, x, y); if ((k === "bare" || k === "plain") && (m.get(x, y) === R.parch[2] || m.get(x, y) === R.parch[1])) m.set(x, y, R.parch[0], 1); }
    }
    // the folds: two down the sheet and one across, rubbed to the paper, a shadow beside each on the open paper, a worn spot where they cross
    const rub = (x, y, p) => { const k = countryOf(room, x, y); if (k && hash(x, y, 85) < p) m.set(x, y, light(k), 1); };
    const crease = (x, y) => { const k = countryOf(room, x, y); if ((k === "bare" || k === "plain") && hash(x, y, 86) < 0.3) m.set(x, y, R.parch[0], 1); };
    for (const fx of F.x) for (let y = FY0; y <= FY1; y++) { rub(fx, y, 0.74); crease(fx + 1, y); }
    for (const fy of F.y) for (let x = FX0; x <= FX1; x++) { rub(x, fy, 0.74); crease(x, fy + 1); }
    for (const fx of F.x) for (const fy of F.y) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (Math.abs(dx) + Math.abs(dy) <= 3) rub(fx + dx, fy + dy, 0.8 - (Math.abs(dx) + Math.abs(dy)) * 0.15);
  }
  // the chart's lines: seven meridians and four parallels dotted in ink over the land and the sea (pale over dark ground). The
  // marks, the roads, the furniture and the models are drawn after and stand over them
  function paintGraticule(room) {
    const m = M(room);
    const dot = (x, y) => { const k = countryOf(room, x, y); if (k) m.set(x, y, k === "ash" ? R.field[2] : k === "sea" ? R.cloud[1] : k === "snow" ? R.rock[3] : R.ink[1], 1); };
    for (const x0 of GR.meridians) for (let y = FY0; y <= FY1; y++) if (y % 3 === 0) dot(Math.round(meridianX(x0, y)), y);
    for (const y0 of GR.parallels) for (let x = FX0; x <= FX1; x++) if (x % 3 === 0) dot(x, Math.round(parallelY(y0, x)));
  }
  // the border: the worn paper, an ink line, a ruled band seven pixels deep, an ink line. The band carries a ruler of bars, and where
  // each line of the chart meets it, that line's degrees (turned to run along the band at the sides); a star in each corner
  function paintBorder(room) {
    const m = M(room), B = IN, set = (x, y, c) => m.set(x, y, c, 1);
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) { const e = Math.min(x, y, W - 1 - x, H - 1 - y); if (e < B) set(x, y, e === 2 || e === B - 1 ? R.ink[0] : paperAt(x, y)); }
    for (let x = B; x < W - B; x++) if (Math.floor((x - B) / 8) % 2 === 0) for (const y of [5, 6, 7, H - 8, H - 7, H - 6]) set(x, y, R.ink[1]);
    for (let y = B; y < H - B; y++) if (Math.floor((y - B) / 8) % 2 === 0) for (const x of [5, 6, 7, W - 8, W - 7, W - 6]) set(x, y, R.ink[1]);
    // the degrees: a window cleared in the ruler and the number in it, over the place where the dotted line meets the band (a tick
    // beside a number five pixels tall only spoils the number, so there is none)
    GR.meridians.forEach((x0, i) => { const s = GR.degrees.meridians[i] + "°", w = textW(s);
      for (const [ty, ey] of [[4, FY0], [H - 9, FY1]]) { const x = Math.round(meridianX(x0, ey)), tx = x - Math.floor(w / 2);
        for (let yy = ty - 1; yy <= ty + 5; yy++) for (let xx = tx - 2; xx <= tx + w + 1; xx++) set(xx, yy, R.parch[2]);
        inkText(set, s, tx, ty, R.ink[0]); } });
    GR.parallels.forEach((y0, i) => { const s = GR.degrees.parallels[i] + "°", w = textW(s), y = Math.round(parallelY(y0, FX0));
      for (const [tx, turn] of [[4, -1], [W - 9, 1]]) { const ty = turn < 0 ? y + Math.floor(w / 2) : y - Math.floor(w / 2);
        for (let yy = y - Math.floor(w / 2) - 2; yy <= y + Math.floor(w / 2) + 2; yy++) for (let xx = tx - 1; xx <= tx + 5; xx++) set(xx, yy, R.parch[2]);
        inkText(set, s, tx, ty, R.ink[0], turn); } });
    // a four-pointed star in each corner, a gold eye in it
    for (const [cx, cy] of [[6, 6], [W - 7, 6], [6, H - 7], [W - 7, H - 7]]) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const a = Math.abs(dx), b = Math.abs(dy);
      set(cx + dx, cy + dy, a + b === 0 ? "#feae34" : (a === 0 || b === 0) && a + b <= 3 ? (a + b === 3 ? R.ink[1] : R.ink[0]) : a === 1 && b === 1 ? R.ink[1] : R.parch[2]);
    }
  }
  // the roads: inked dots, two pixels square every four, from home to each place; a plank bridge where a road meets the river
  function paintRoads(room) {
    const m = M(room);
    for (const A of room.spec.areas) for (const p of along(A.road, 4, 2)) {
      const x = Math.round(p.x), y = Math.round(p.y);
      if (inRiver(x, y) || inRiver(x + 1, y)) continue;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) m.set(x + dx, y + dy, (dx + dy === 0) ? R.ink[1] : R.ink[0], 1);
    }
    // the bridges: the den's road and the capital's road over the river
    for (const A of room.spec.areas) {
      const pts = along(A.road, 1, 0); for (const p of pts) {
        const x = Math.round(p.x), y = Math.round(p.y);
        if (!inRiver(x, y)) continue;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -1; dx <= 1; dx++) m.set(x + dx, y + dy, Math.abs(dy) === 3 ? OUT : dx === -1 ? R.oak[2] : dx === 1 ? R.oak[0] : R.oak[1], 1);
      }
    }
  }

  // ------------------------------------------------------------------ the country's marks: trees, peaks, dunes, the den, the camp
  // a pine (5 x 8 over its foot): a cone lit on the left, snow on its boughs in the north
  function pine(m, x, y, snowy) {
    for (let dy = 0; dy < 7; dy++) { const half = Math.floor((dy + 1) / 2) + (dy > 4 ? 0 : 0); for (let dx = -half; dx <= half; dx++) { const lit = dx < 0; m.set(x + dx, y - 7 + dy, snowy && lit && (dy % 2 === 1 || dx === -half) ? R.snow[3] : lit ? R.grass[1] : R.grass[0], 1); } }
    m.set(x, y, R.oak[0], 1);
    for (let dy = 0; dy < 7; dy++) { const half = Math.floor((dy + 1) / 2); m.set(x - half - 1, y - 7 + dy, OUT, 1); m.set(x + half + 1, y - 7 + dy, OUT, 1); }
    m.set(x, y - 8, OUT, 1);
  }
  // an oak (7 x 7 over its foot): a round crown lit from the top left, a trunk
  function oak(m, x, y, dark) {
    const crown = ell(x + 0.5, y - 4, 3.4, 2.9), ramp = dark ? [R.grass[0], R.grass[0], R.grass[1], R.grass[2]] : R.grass;
    for (let yy = y - 8; yy <= y; yy++) for (let xx = x - 4; xx <= x + 5; xx++) {
      const c0 = crown(xx + 0.5, yy + 0.5);
      if (c0) { const u = (xx - x) + (yy - (y - 4)); m.set(xx, yy, u < -3 ? ramp[3] : u < 0 ? ramp[2] : u < 3 ? ramp[1] : ramp[0], 1); }
      else if (crown(xx + 1.5, yy + 0.5) || crown(xx - 0.5, yy + 0.5) || crown(xx + 0.5, yy + 1.5) || crown(xx + 0.5, yy - 0.5)) { if (!(xx === x && yy > y - 2)) m.set(xx, yy, OUT, 1); }
    }
    m.set(x, y - 1, R.oak[0], 1); m.set(x, y, R.oak[0], 1);
  }
  // a dead tree: a bare trunk and three crooked branches
  function deadTree(m, x, y) {
    for (let dy = 0; dy < 9; dy++) m.set(x, y - dy, dy < 2 ? R.ash[1] : R.ash[2], 1);
    for (const [dx, dy] of [[-1, -5], [-2, -6], [-3, -6], [1, -7], [2, -8], [1, -3], [2, -4], [3, -4], [-1, -8], [-1, -9]]) m.set(x + dx, y + dy, R.ash[2], 1);
  }
  // a peak of the Frostpeaks: a jagged cone, rock lit on the left and shaded on the right, snow over its top, outlined in soot
  function peak(m, cx, top, base, hw, seed) {
    const ridge = y => cx + Math.round((y - top) * 0.18 * (hash(seed, 0, 51) - 0.5));
    const half = y => (y - top) / (base - top) * hw + (vnoise(y, seed, 3, 52) - 0.5) * 2.4;
    const inP = (x, y) => y >= top && y <= base && Math.abs(x + 0.5 - cx) <= half(y);
    const snowLine = y => top + (base - top) * (0.42 + 0.14 * vnoise(cx, y, 4, 53)) + (hash(seed, 1, 54) > 0.5 ? 4 : 0);
    for (let y = top; y <= base; y++) for (let x = Math.floor(cx - hw - 3); x <= Math.ceil(cx + hw + 3); x++) {
      if (!inP(x, y)) { if (inP(x - 1, y) || inP(x + 1, y) || inP(x, y + 1)) m.set(x, y, OUT, 1); continue; }
      const lit = x < ridge(y), sn = y < snowLine(x * 0.7 + y), rel = (y - top) / (base - top);
      let c = sn ? (lit ? (bay(x, y) < 0.15 ? R.snow[2] : R.snow[3]) : (rel < 0.15 ? R.snow[2] : R.snow[1])) : (lit ? R.rock[2] : (rel > 0.8 && bay(x, y) < 0.5 ? R.rock[0] : R.rock[1]));
      if (!lit && (x + y * 2) % 4 === 0) c = sn ? R.snow[0] : R.rock[0];   // ink hachures down the shaded face
      if (!sn && lit && x === ridge(y) - 1) c = R.rock[3];
      if (x === ridge(y) && !sn) c = R.rock[1];
      m.set(x, y, c, 1);
    }
    m.set(cx, top - 1, OUT, 1);
  }
  // a dune: a crescent mound, its crest lit and its lee in shadow
  function dune(m, cx, cy, rx, ry) {
    for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) {
      const u = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; if (u > 1) continue;
      const crest = Math.abs(y - (cy - ry * 0.3 + (x - cx) * 0.25)) < 0.8 && u < 0.8;
      const lee = y > cy - ry * 0.3 + (x - cx) * 0.25;
      m.set(x, y, crest ? R.sand[3] : lee ? (u > 0.7 && bay(x, y) < 0.5 ? R.sand[2] : R.sand[1]) : R.sand[2], 1);
    }
  }
  // a hill inked on the plain: an arc nine pixels wide, a stroke of shade under its right shoulder
  function hill(m, x, y) {
    for (const [dx, dy] of [[0, 0], [1, -1], [2, -2], [3, -3], [4, -3], [5, -3], [6, -2], [7, -1], [8, 0]]) m.set(x + dx, y + dy, R.ink[1], 1);
    m.set(x + 6, y - 1, R.ink[1], 1); m.set(x + 7, y, R.ink[1], 1); m.set(x + 5, y - 1, R.parch[0], 1); m.set(x + 5, y - 2, R.parch[0], 1);
  }
  function paintCountry(room) {
    const m = M(room), sp = room.spec, ok = (x, y) => { const k = countryOf(room, x, y); return k && k !== "sea" && k !== "bare" && !inRiver(x, y) && !inLake(x, y); };
    const nearRoad = (x, y, d) => sp.areas.some(A => lineDist(x, y, A.road) < d);
    const free = (x, y, d) => ok(x, y) && !nearRoad(x, y, d || 6);
    const on = (x, y, k) => countryOf(room, x, y) === k;
    const note = (area, what, x0, y0, x1, y1) => room.marks.push({ area, what, box: [x0, y0, x1, y1] });
    const pawnBy = (x, y, d) => sp.areas.some(A => A.mob.kind === "pawn" && Math.hypot(x - A.mob.x, (y - A.mob.y + 6) * 0.8) < d);   // a pawn's foot stays clear
    // THE FROSTPEAKS: a range of thirteen peaks, the far ones first and the near ones over them, none past the border; snowy pines
    // at their feet
    const PEAKS = [[160, 25, 54, 11], [181, 19, 56, 13], [205, 23, 54, 12], [251, 21, 56, 13], [274, 17, 55, 13], [297, 25, 56, 11],
      [157, 41, 70, 10], [175, 33, 71, 14], [201, 31, 72, 15], [262, 29, 72, 16], [288, 35, 71, 13], [306, 44, 70, 9], [229, 14, 73, 23]];
    PEAKS.map((p, i) => p.concat(20 + i)).sort((a, b) => a[2] - b[2]).forEach(([cx, top, base, hw, s]) => { peak(m, cx, top, base, hw, s); note("frostpeaks", "peak", cx - hw - 2, top - 1, cx + hw + 2, base); });
    for (let gy = 75; gy < 90; gy += 5) for (let gx = 148; gx < 318; gx += 6) {
      const x = gx + Math.floor(hash(gx, gy, 65) * 4), y = gy + Math.floor(hash(gx, gy, 66) * 3);
      if (hash(gx, gy, 67) < 0.55 && free(x, y, 7) && on(x, y, "snow") && on(x - 4, y, "snow") && on(x + 4, y, "snow") && !pawnBy(x, y, 11) && Math.hypot(x - LAKE.x, (y - LAKE.y) * 2) > 17) { pine(m, x, y, true); note("frostpeaks", "pine", x - 4, y - 8, x + 4, y); }
    }
    // the west wood between home and the trolls, north of the road; a few oaks by the river's bend east of home
    for (let gy = 104; gy < 162; gy += 6) for (let gx = 164; gx < 200; gx += 7) { const x = gx + Math.floor(hash(gx, gy, 71) * 5), y = gy + Math.floor(hash(gx, gy, 72) * 4); if (hash(gx, gy, 73) < 0.66 && free(x, y, 9) && on(x, y, "plain") && on(x - 4, y - 4, "plain") && on(x + 5, y - 4, "plain") && y < 164) oak(m, x, y); }
    for (let gy = 106; gy < 132; gy += 6) for (let gx = 300; gx < 344; gx += 7) { const x = gx + Math.floor(hash(gx, gy, 74) * 5), y = gy + Math.floor(hash(gx, gy, 75) * 4); if (hash(gx, gy, 76) < 0.42 && free(x, y, 8) && lineDist(x, y, RIVER) > 7 && on(x, y, "plain") && on(x, y - 8, "plain")) oak(m, x, y); }
    // hills inked in the open gaps: the pass between the Frostpeaks and the Den, the rise between the trolls' country and the Sands
    for (const [x, y] of [[329, 28], [333, 46], [327, 63], [149, 201], [145, 217]]) if ([0, 4, 8].every(d => on(x + d, y, "plain") && on(x + d, y - 3, "plain"))) hill(m, x, y);
    // home's fields east of its wall, in strips
    for (let y = 138; y < 166; y++) for (let x = 294; x < 346; x++) { if (!free(x, y, 3) || !on(x, y, "plain") || lineDist(x, y, RIVER) < 5) continue; if (Math.hypot((x - 318) / 23, (y - 152) / 11) > 1 + (vnoise(x, y, 6, 21) - 0.5) * 0.5) continue; m.set(x, y, farmAt(x, y), 1); }
    // THE TROLLS' COUNTRY: the dark wood along its foot, dead trees, the camp's hut and fire ring, stakes by the road, a skull on a pike
    for (let gy = 208; gy < 224; gy += 5) for (let gx = 18; gx < 136; gx += 7) { const x = gx + Math.floor(hash(gx, gy, 77) * 5), y = gy + Math.floor(hash(gx, gy, 78) * 3); if (hash(gx, gy, 79) < 0.62 && free(x, y, 6) && on(x, y, "waste") && on(x - 4, y, "waste") && on(x + 5, y, "waste") && on(x, y + 1, "waste")) { oak(m, x, y, true); note("troll-castle", "oak", x - 4, y - 8, x + 5, y); } }
    for (const [x, y] of [[24, 122], [30, 102], [130, 202], [146, 140], [20, 150]]) { deadTree(m, x, y); note("troll-castle", "dead tree", x - 3, y - 9, x + 3, y); }
    { const [hx, hy] = CAMP.hut;   // a hut of hides over bent poles, a dark door, two tusks over it
      for (let y = hy - 11; y <= hy; y++) for (let x = hx - 9; x <= hx + 9; x++) { const u = ((x - hx) / 9) ** 2 + ((y - hy) / 11) ** 2; if (u > 1) continue; const edge = ((x - hx) / 8) ** 2 + ((y - hy) / 10) ** 2 > 1; const lit = x - hx + (y - hy + 6) < -2; m.set(x, y, edge ? OUT : lit ? R.hide[2] : (x + y) % 5 === 0 ? R.hide[0] : R.hide[1], 1); }
      for (let y = hy - 5; y <= hy; y++) for (let x = hx - 2; x <= hx + 2; x++) m.set(x, y, "#120e1a", 1);
      m.set(hx - 3, hy - 7, R.bone[2], 1); m.set(hx - 4, hy - 8, R.bone[3], 1); m.set(hx + 3, hy - 7, R.bone[2], 1); m.set(hx + 4, hy - 8, R.bone[3], 1);
      for (const [dx, dy] of [[-1, -12], [0, -13], [1, -12]]) m.set(hx + dx, hy + dy, R.oak[0], 1);
      note("troll-castle", "hut", hx - 9, hy - 13, hx + 9, hy); }
    { const [fx, fy] = CAMP.fire;   // the fire ring: stones round a bed of coals (the flame is live)
      for (let a = 0; a < 8; a++) { const x = Math.round(fx + Math.cos(a * Math.PI / 4) * 4), y = Math.round(fy + Math.sin(a * Math.PI / 4) * 2); m.set(x, y, R.tstone[a < 4 ? 1 : 2], 1); }
      m.set(fx - 1, fy, "#3e1420", 1); m.set(fx, fy, "#a22633", 1); m.set(fx + 1, fy, "#3e1420", 1); m.set(fx - 2, fy + 1, R.oak[0], 1); m.set(fx + 2, fy - 1, R.oak[0], 1);
      room.flames.push({ x: room.SX + fx, y: room.SY + fy - 1, kind: "camp" }); room.smokes.push({ x: room.SX + fx, y: room.SY + fy - 6, kind: "camp" });
      note("troll-castle", "fire", fx - 4, fy - 6, fx + 4, fy + 2); }
    for (const [x, y] of [[128, 160], [134, 158], [140, 157]]) { for (let dy = 0; dy < 6; dy++) m.set(x, y - dy, dy === 5 ? R.oak[3] : R.oak[1], 1); m.set(x + 1, y - 1, R.oak[0], 1); note("troll-castle", "stake", x, y - 5, x + 1, y); }
    { const px = 22, py = 198; for (let dy = 0; dy < 10; dy++) m.set(px, py - dy, R.oak[0], 1); for (const [dx, dy, c] of [[-1, -11, R.bone[2]], [0, -11, R.bone[3]], [1, -11, R.bone[2]], [-1, -10, R.bone[2]], [0, -10, OUT], [1, -10, R.bone[1]], [0, -12, R.bone[2]]]) m.set(px + dx, py + dy, c, 1); note("troll-castle", "pike", px - 1, py - 12, px + 1, py); }
    // THE BURNING SANDS: dunes, the oasis with two palms at its west end, the dead king's stone head half buried, a ribcage
    for (const [cx, cy, rx, ry] of [[270, 201, 15, 4], [300, 221, 12, 3], [322, 203, 11, 4], [346, 217, 10, 3], [178, 198, 8, 3], [276, 216, 9, 3]]) { dune(m, cx, cy, rx, ry); note("burning-sands", "dune", cx - rx, cy - ry, cx + rx, cy + ry); }
    { const hx = 214, hy = 221;   // the dead king's stone head, sunk to the chin: a crown of three points, a brow, shut eyes, a long nose, a hard mouth
      const head = or(and(ell(hx, hy - 7, 9, 10), (x, y) => y < hy + 1), rect(hx - 8, hy - 17, hx + 8, hy - 14));
      const crown = (x, y) => y >= hy - 22 && y < hy - 14 && Math.abs(x - hx) <= 8 && (y >= hy - 17 || [hx - 6, hx, hx + 6].some(px => Math.abs(x - px) <= (y - (hy - 22)) * 0.5));
      for (let y = hy - 24; y <= hy + 1; y++) for (let x = hx - 11; x <= hx + 11; x++) {
        const inH = head(x + 0.5, y + 0.5) || crown(x + 0.5, y + 0.5);
        if (!inH) { if (head(x + 1.5, y + 0.5) || head(x - 0.5, y + 0.5) || head(x + 0.5, y + 1.5) || head(x + 0.5, y - 0.5) || crown(x + 1.5, y + 0.5) || crown(x - 0.5, y + 0.5) || crown(x + 0.5, y + 1.5)) m.set(x, y, OUT, 1); continue; }
        if (crown(x + 0.5, y + 0.5) && y < hy - 14) { m.set(x, y, x < hx - 1 ? "#fee761" : x < hx + 3 ? "#feae34" : "#be4a2f", 1); continue; }
        const u = (x - hx) * 1.1 + (y - hy + 8) * 0.5; m.set(x, y, u < -5 ? R.tstone[3] : u < 0 ? R.tstone[2] : u < 5 ? R.tstone[1] : R.tstone[0], 1);
      }
      m.fill(hx - 6, hy - 12, hx - 2, hy - 12, R.tstone[3], 1); m.fill(hx + 2, hy - 12, hx + 6, hy - 12, R.tstone[2], 1);   // the brow
      m.fill(hx - 5, hy - 10, hx - 2, hy - 10, OUT, 1); m.fill(hx + 2, hy - 10, hx + 5, hy - 10, OUT, 1);                      // shut eyes
      for (let y = hy - 10; y <= hy - 5; y++) { m.set(hx, y, R.tstone[3], 1); m.set(hx + 1, y, R.tstone[0], 1); }               // the nose
      m.set(hx - 1, hy - 4, R.tstone[0], 1); m.set(hx + 2, hy - 4, R.tstone[0], 1);
      m.fill(hx - 3, hy - 2, hx + 3, hy - 2, OUT, 1);                                                                              // the mouth
      m.set(hx + 6, hy - 7, OUT, 1); m.set(hx + 7, hy - 6, OUT, 1); m.set(hx + 7, hy - 5, OUT, 1);                                 // a crack
      for (let x = hx - 12; x <= hx + 12; x++) { m.set(x, hy + 1, R.sand[3], 1); if (Math.abs(x - hx) < 9) m.set(x, hy, R.sand[2], 1); m.set(x, hy + 2, R.sand[1], 1); }
      note("burning-sands", "stone head", hx - 12, hy - 24, hx + 12, hy + 2); }
    { const bx = 322, by = 220; for (let i = 0; i < 4; i++) { m.set(bx + i * 2, by, R.bone[3], 1); m.set(bx + i * 2, by - 1, R.bone[2], 1); m.set(bx + i * 2, by - 2, R.bone[1], 1); } m.fill(bx - 1, by + 1, bx + 7, by + 1, R.bone[2], 1); m.set(bx - 3, by - 1, R.bone[3], 1); m.set(bx - 3, by, R.bone[2], 1); m.set(bx - 4, by, OUT, 1); note("burning-sands", "ribcage", bx - 4, by - 2, bx + 7, by + 1); }
    { const ox = 186, oy = 213;   // the oasis: a pool and two palms leaning over it
      for (let y = oy - 3; y <= oy + 3; y++) for (let x = ox - 7; x <= ox + 7; x++) { const u = ((x - ox) / 7) ** 2 + ((y - oy) / 3) ** 2; if (u <= 1) m.set(x, y, u > 0.65 ? R.water[2] : R.water[1], 1); else if (u <= 1.4) m.set(x, y, R.grass[2], 1); }
      for (const [px, py, lean] of [[ox - 9, oy - 1, -1], [ox + 8, oy, 1]]) { for (let dy = 0; dy < 9; dy++) m.set(px + Math.round(lean * dy * 0.25), py - dy, dy % 2 ? R.oak[2] : R.oak[1], 1); const tx = px + Math.round(lean * 2.2), ty = py - 9; for (const [dx, dy] of [[-4, 1], [-3, 0], [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1], [3, 0], [4, 1], [-2, 0], [2, 0], [-1, 1], [1, 1], [0, 0], [-5, 2], [5, 2]]) m.set(tx + dx, ty + dy, dy < 0 ? R.grass[3] : R.grass[2], 1); m.set(tx, ty + 1, R.oak[0], 1); }
      note("burning-sands", "oasis", ox - 17, oy - 11, ox + 16, oy + 4); }
    // THE DRAGON'S DEN: a black mountain with its crater, lava down its face, its cave, scorched crags, bones at the mouth
    paintDen(room, m, note);
  }
  function paintDen(room, m, note) {
    const cx = DEN.cx, top = DEN.top, base = DEN.base, hw = DEN.hw;
    const half = y => (y - top + 6) / (base - top + 6) * hw + (vnoise(y, 3, 4, 81) - 0.5) * 4;
    const inMt = (x, y) => y >= top && y <= base && Math.abs(x + 0.5 - cx) <= half(y) && !(y < top + 5 && Math.abs(x + 0.5 - cx) < 6 - (y - top));
    // two side crags first, then the mountain over them
    for (const [sx, st, sb, sh] of [[380, 52, 84, 13], [469, 48, 84, 15]]) { for (let y = st; y <= sb; y++) for (let x = sx - sh - 2; x <= sx + sh + 2; x++) {
      const hh = (y - st) / (sb - st) * sh + (vnoise(x, y, 3, 82) - 0.5) * 3, inC = Math.abs(x + 0.5 - sx) <= hh;
      if (inC) m.set(x, y, x < sx - 1 ? R.ash[2] : R.ash[1], 1); else if (Math.abs(x + 0.5 - sx) <= hh + 1 && y > st) m.set(x, y, OUT, 1);
    } note("dragons-den", "crag", sx - sh - 2, st, sx + sh + 2, sb); }
    for (let y = top - 1; y <= base; y++) for (let x = cx - hw - 3; x <= cx + hw + 3; x++) {
      if (!inMt(x, y)) { if (inMt(x - 1, y) || inMt(x + 1, y) || inMt(x, y + 1)) m.set(x, y, OUT, 1); continue; }
      const ridge = cx - 3 + Math.round((y - top) * 0.12), lit = x < ridge, rel = (y - top) / (base - top);
      const fold = Math.sin(x * 0.35 + y * 0.12 + vnoise(x, y, 6, 83) * 4) > 0.75;
      let c = lit ? (fold ? R.ash[1] : bay(x, y) < 0.25 && rel < 0.6 ? "#5a3030" : R.ash[2]) : (fold && bay(x, y) < 0.5 ? R.ash[0] : R.ash[1]);
      if (lit && x === ridge - 1 && bay(x, y) < 0.6) c = "#733e39";
      m.set(x, y, c, 1);
    }
    note("dragons-den", "mountain", cx - hw - 3, top - 1, cx + hw + 3, base);
    // the crater's glow in the notch at the top
    for (let y = top - 1; y <= top + 5; y++) for (let x = cx - 6; x <= cx + 6; x++) { if (y < top + 5 && Math.abs(x + 0.5 - cx) < 6 - (y - top)) { const k = 4 - Math.min(4, Math.abs(x - cx) + Math.max(0, y - top)); room.lava.push({ x: room.SX + x, y: room.SY + y, k: 4 + k, hot: 1 }); } }
    // three runs of lava down the face from the crater, each a crooked line two pixels wide near the top
    for (const [dir, len, seed] of [[-1, 38, 1], [1, 46, 2], [0.2, 28, 3]]) {
      let x = cx + dir * 3, y = top + 3;
      for (let i = 0; i < len; i++) {
        y += 1; x += dir * 0.55 + (hash(i, seed, 84) - 0.5) * 1.6;
        const X = Math.round(x);
        if (!inMt(X, y)) break;
        room.lava.push({ x: room.SX + X, y: room.SY + y, k: i, hot: i < 10 ? 1 : 0 });
        if (i < 18) room.lava.push({ x: room.SX + X + 1, y: room.SY + y, k: i + 1, hot: 0 });
        m.set(X - 1, y, R.ash[0], 1);
      }
    }
    // the cave at the mountain's foot: a dark arch, a red throat
    const mx = cx, my = DEN.cave;
    for (let y = my - 9; y <= my + 2; y++) for (let x = mx - 8; x <= mx + 8; x++) {
      const u = ((x - mx) / 8) ** 2 + ((y - my) / 9) ** 2; if (u > 1 || y > my + 2) continue;
      const inner = ((x - mx) / 6) ** 2 + ((y - my) / 7) ** 2 <= 1;
      m.set(x, y, !inner ? OUT : y > my - 2 ? "#a22633" : y > my - 5 ? "#3e1420" : "#120e1a", 1);
      if (inner && y > my - 2) room.lava.push({ x: room.SX + x, y: room.SY + y, k: x + y, hot: 0, cave: 1 });
    }
    // fangs of rock round the mouth, and bones on the scorched ground before it
    for (const [x, y] of [[mx - 6, my - 6], [mx - 3, my - 8], [mx + 2, my - 8], [mx + 5, my - 6]]) { m.set(x, y, R.ash[3], 1); m.set(x, y + 1, R.ash[2], 1); }
    for (const [x, y] of [[mx - 14, my + 6], [mx + 12, my + 8], [mx + 4, my + 10], [mx - 6, my + 11]]) { m.set(x, y, R.bone[3], 1); m.set(x + 1, y, R.bone[2], 1); m.set(x + 2, y - 1, R.bone[1], 1); }
    for (const [x, y] of [[360, 84], [358, 54], [488, 84], [462, 88]]) { deadTree(m, x, y); note("dragons-den", "dead tree", x - 3, y - 9, x + 3, y); }
    room.smokes.push({ x: room.SX + cx, y: room.SY + top - 2, kind: "den" });
  }

  // ------------------------------------------------------------------ the furniture: the compass rose, the scale bar, the legend
  // the legend's signs, eleven by five: three gold dots, three ink dots, a little pawn, two peaks, three trees, sand, sea
  const SIGN_ROWS = {
    "open-road": ["...........", "GU..GU..GU.", "UU..UU..UU.", "...........", "..........."],
    "road": ["...........", "ik..ik..ik.", "kk..kk..kk.", "...........", "..........."],
    "pawn": ["....Po.....", "....oi.....", "....oi.....", "...Pooi....", "..Poooii..."],
    "peaks": ["...k.......", "..kwk...k..", ".kwwrk.kwk.", "kwrrrkkwrrk", "kkkkkkkkkkk"],
    "forest": [".l...l...l.", "lgg.lgg.lgg", "ggg.ggg.ggg", ".i...i...i.", ".i...i...i."],
    "sands": ["PPPPPPPPPPP", "PoPPPppPPoP", "PPPPpPPpPPP", "PPPoPPPoPPP", "PPPPPPPPPPP"],
    "sea": ["bbbbbbbbbbb", "baaabbbaaab", "bbbbbbbbbbb", "bbbbaaabbbb", "bbbbbbbbbbb"]
  };
  const SIGN_PAL = { G: "#feae34", U: "#be4a2f", i: "#733e39", k: "#3e2731", P: "#e4a672", o: "#b86f50", w: "#ffffff", r: "#8b9bb4", l: "#63c74d", g: "#3e8948", p: "#fffaf0", b: "#124e89", a: "#0099db" };
  // a sign as a sprite { px, w, h } (the page draws them at reading size in the legend's plate)
  function sign(kind) { const R0 = SIGN_ROWS[kind] || SIGN_ROWS.road, w = R0[0].length, px = new Array(w * R0.length).fill(null); R0.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== ".") px[y * w + x] = SIGN_PAL[ch]; })); return { px, w, h: R0.length }; }
  // the compass rose: a disc of bare paper, a double ring with a tick for each of sixteen winds, eight short winds as lines, four
  // points between and the four winds over them, each inked round and split dark and light down its middle (north's dark half red),
  // a gold boss, an inked N over the north
  function paintRose(set, cx, cy, r) {
    for (let y = cy - r - 3; y <= cy + r + 3; y++) for (let x = cx - r - 3; x <= cx + r + 3; x++) if (Math.hypot(x - cx, y - cy) <= r + 3.2) set(x, y, paperAt(x, y));
    const ring = (rad, c) => { for (let a = 0; a < 1440; a++) { const t = a * Math.PI / 720; set(Math.round(cx + Math.cos(t) * rad), Math.round(cy + Math.sin(t) * rad), c); } };
    ring(r + 2, R.ink[0]); ring(r, R.ink[1]);
    for (let n = 0; n < 16; n++) { const t = n * Math.PI / 8; set(Math.round(cx + Math.cos(t) * (r + 1)), Math.round(cy + Math.sin(t) * (r + 1)), R.ink[0]); }
    // a point: a kite along the angle a, L long and wb wide at its shoulder; 1 or 2 for the half a pixel is in, 0 outside it
    const kite = (dx, dy, a, L, wb) => { const u = dx * Math.cos(a) + dy * Math.sin(a), v = -dx * Math.sin(a) + dy * Math.cos(a); if (u < -0.5 || u > L) return 0; const t0 = L * 0.24, w = u < t0 ? wb * Math.max(u, 0) / t0 : wb * (L - u) / (L - t0); return Math.abs(v) <= w + 0.3 ? (v < 0 ? 1 : 2) : 0; };
    const each = f => { for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) f(x, y, x - cx, y - cy); };
    for (let n = 0; n < 8; n++) { const a = (n + 0.5) * Math.PI / 4; for (let u = 3; u <= r * 0.5; u += 0.5) set(Math.round(cx + Math.cos(a) * u), Math.round(cy + Math.sin(a) * u), R.ink[1]); }
    const pts = []; for (let n = 0; n < 4; n++) pts.push([(n + 0.5) * Math.PI / 2, r * 0.68, 2.3, 0]); for (let n = 0; n < 4; n++) pts.push([n * Math.PI / 2, r - 1.5, 3.1, n === 3 ? 1 : 0]);
    for (const [a, L, wb, north] of pts) {
      each((x, y, dx, dy) => { if (kite(dx, dy, a, L + 1.2, wb + 1.1)) set(x, y, R.ink[0]); });
      each((x, y, dx, dy) => { const h = kite(dx, dy, a, L, wb); if (h) set(x, y, h === 1 ? (north ? "#a22633" : R.ink[1]) : R.parch[3]); });
    }
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) <= 2) set(cx + dx, cy + dy, Math.abs(dx) + Math.abs(dy) === 2 ? R.ink[0] : dx + dy < 0 ? "#fee761" : "#feae34");
    inkText(set, "N", cx - 1, cy - r - 9, R.ink[0]);
  }
  // the scale bar: ruled segments, dark and open by turns, a tick at each end and the middle, the leagues over it and the word under
  function paintScale(set, S0) {
    const x0 = S0.at[0], y0 = S0.at[1], x1 = x0 + S0.seg * S0.n;
    for (let x = x0; x < x1; x++) { const dark = Math.floor((x - x0) / S0.seg) % 2 === 0; set(x, y0, R.ink[0]); set(x, y0 + 1, dark ? R.ink[0] : R.parch[3]); set(x, y0 + 2, R.ink[0]); }
    for (const x of [x0 - 1, x1]) for (let y = y0 - 1; y <= y0 + 3; y++) set(x, y, R.ink[0]);
    set(Math.round((x0 + x1) / 2), y0 - 1, R.ink[0]);
    S0.marks.forEach((v, i) => { const s = String(v), x = x0 + (x1 - x0) * i / (S0.marks.length - 1); inkText(set, s, Math.round(x - textW(s) / 2), y0 - 8, R.ink[0]); });
    inkText(set, S0.word, Math.round((x0 + x1) / 2 - textW(S0.word) / 2), y0 + 5, R.ink[1]);
  }
  // the legend: a panel of clean paper in a double ink border, its title over a rule, a sign and a word to each row
  function paintLegend(set, Lg) {
    const [x0, y0, x1, y1] = Lg.box;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const e = Math.min(x - x0, y - y0, x1 - x, y1 - y); set(x, y, e === 0 ? R.ink[0] : e === 2 ? R.ink[1] : e === 1 || bay(x, y) < 0.34 ? R.parch[3] : R.parch[2]); }
    inkText(set, Lg.title, Math.round((x0 + x1 + 1) / 2 - textW(Lg.title, 2) / 2), y0 + 5, R.ink[0], 0, 2);
    for (let x = x0 + 5; x <= x1 - 5; x++) set(x, y0 + 12, R.ink[1]);
    Lg.rows.forEach((row, i) => { const y = y0 + 15 + i * 7, s = sign(row.sign); for (let j = 0; j < s.h; j++) for (let k = 0; k < s.w; k++) if (s.px[j * s.w + k]) set(x0 + 5 + k, y + j, s.px[j * s.w + k]); inkText(set, row.word, x0 + 19, y, R.ink[0]); });
  }
  function paintFurniture(room) {
    const m = M(room), sp = room.spec, set = (x, y, c) => m.set(x, y, c, 1);
    paintRose(set, sp.rose.at[0], sp.rose.at[1], sp.rose.r);
    paintScale(set, sp.scale);
    paintLegend(set, sp.legend);
  }
  // the props on the table round the sheet: the dagger pinning the sheet's left edge near its top corner, the tankard on its
  // bottom-right corner, the inkpot and its quill out to the left, a few coins out to the right; the candles are drawn with their
  // light as pieces of the table
  function paintProps(room) {
    const g = room.ground, P = room.spec.props;
    { const [x0, y0] = P.dagger;   // the blade driven through the edge, the grip toward the top left
      for (let i = 0; i < 14; i++) { const x = x0 - i, y = y0 - i; g.set(x, y, i < 2 ? R.steel[1] : R.steel[3], 1); g.set(x + 1, y, i < 2 ? R.steel[0] : R.steel[1], 1); g.set(x, y + 1, OUT, 1); g.set(x + 2, y, OUT, 1); }
      for (let i = -3; i <= 3; i++) { g.set(x0 - 14 + i, y0 - 14 - i, "#feae34", 1); g.set(x0 - 14 + i + 1, y0 - 14 - i, "#be4a2f", 1); g.set(x0 - 14 + i, y0 - 14 - i + 1, OUT, 1); }
      for (let i = 15; i < 22; i++) { const x = x0 - i, y = y0 - i; g.set(x, y, i % 2 ? R.oak[2] : R.oak[1], 1); g.set(x + 1, y, R.oak[0], 1); g.set(x - 1, y, OUT, 1); g.set(x + 2, y, OUT, 1); }
      g.set(x0 - 22, y0 - 22, "#feae34", 1); g.set(x0 - 23, y0 - 23, OUT, 1);
      g.set(x0 + 1, y0 + 1, OUT, 1); }
    { const [cx, cy] = P.tankard;   // a pewter tankard, seen from above: its rim, the dark ale, the handle
      for (let y = cy - 9; y <= cy + 9; y++) for (let x = cx - 9; x <= cx + 14; x++) {
        const d = Math.hypot(x - cx, y - cy), hd = Math.hypot(x - cx - 10, (y - cy) * 1.3);
        if (d <= 8.5) { const u = (x - cx) + (y - cy); g.set(x, y, d > 7.5 ? OUT : d > 5.5 ? (u < -3 ? R.pewter[3] : u < 2 ? R.pewter[2] : R.pewter[1]) : d > 4.5 ? R.pewter[0] : (u < -4 ? "#be4a2f" : "#733e39"), 1); }
        else if (hd <= 4.5 && hd >= 2.4 && x > cx + 7) g.set(x, y, hd > 3.6 ? OUT : R.pewter[1], 1);
      }
      g.set(cx - 2, cy - 2, "#feae34", 1); }
    { const [ix, iy] = P.ink;   // the inkpot (a squat black jar) and its quill laid along the table
      for (let y = iy - 6; y <= iy + 6; y++) for (let x = ix - 6; x <= ix + 6; x++) { const d = Math.hypot(x - ix, y - iy); if (d <= 6.2) g.set(x, y, d > 5.3 ? OUT : d > 3 ? (x + y < ix + iy - 3 ? R.iron[2] : R.iron[1]) : d > 2 ? R.iron[0] : OUT, 1); }
      for (let i = 0; i < 30; i++) { const x = ix + 4 + i, y = iy + 9 + Math.round(i * 0.25); g.set(x, y, i < 4 ? R.ink[0] : i < 12 ? "#ffffff" : "#c0cbdc", 1); if (i > 10) { g.set(x, y - 1, i % 3 ? "#ffffff" : "#c0cbdc", 1); g.set(x, y - 2, i > 16 && i % 2 ? "#c0cbdc" : null, 1); g.set(x, y + 1, "#8b9bb4", 1); } } }
    { const [kx, ky] = P.coins;   // a little stack and two coins loose
      for (const [dx, dy, n] of [[0, 0, 3], [12, 6, 1], [-6, 10, 1]]) for (let s = 0; s < n; s++) for (let y = -3; y <= 3; y++) for (let x = -4; x <= 4; x++) { const d = Math.hypot(x, y * 1.3); if (d <= 4.2) g.set(kx + dx + x, ky + dy + y - s * 2, d > 3.4 ? OUT : x + y < -1 ? "#fee761" : x + y < 2 ? "#feae34" : "#be4a2f", 1); } }
  }

  // ------------------------------------------------------------------ the standing models: the Troll Castle, home, the capital
  function Piece(x, y, w, h, sy) { this.x = x; this.y = y; this.w = w; this.h = h; this.sy = sy; this.layer = new Layer(w, h); }
  // a round tower seen from the front: shaded by column from the lit left, crenellated, snow on its top if asked; its roof optional
  function drum(g, x0, x1, y0, y1, ramp, o) {
    o = o || {}; const w = x1 - x0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const u = (x - x0) / w, col = u < 0.22 ? ramp[2] : u < 0.62 ? ramp[1] : ramp[0];
      const course = (y - y0) % 5 === 0 && x !== x0 && x !== x1;
      g.set(x, y, x === x0 || x === x1 ? OUT : course ? (u < 0.22 ? ramp[1] : ramp[0]) : col);
    }
    // the merlons on top: three teeth
    for (let x = x0; x <= x1; x++) { const tooth = Math.floor((x - x0) / 3) % 2 === 0; if (tooth) for (let y = y0 - 3; y < y0; y++) g.set(x, y, x === x0 || x === x1 || y === y0 - 3 ? OUT : ramp[x - x0 < w * 0.3 ? 2 : 1]); }
    if (o.snow) for (let x = x0 + 1; x < x1; x++) { const tooth = Math.floor((x - x0) / 3) % 2 === 0; g.set(x, tooth ? y0 - 3 : y0, "#ffffff"); if (tooth && bay(x, y0) < 0.5) g.set(x, y0 - 2, "#c0cbdc"); }
    if (o.roof) { const cx = (x0 + x1) / 2, top = y0 - 3 - o.roof; for (let y = top; y < y0 - 1; y++) { const hw = (y - top) / (o.roof + 2) * (w / 2 + 1); for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) { const e = Math.abs(x + 0.5 - cx) > hw - 1; g.set(x, y, e ? OUT : x + 0.5 < cx ? o.roofRamp[2] : o.roofRamp[1]); } } g.set(Math.round(cx), top - 1, OUT); }
    if (o.slit) { g.set(Math.round(x0 + w * 0.4), y0 + 5, OUT); g.set(Math.round(x0 + w * 0.4), y0 + 6, OUT); }
  }
  // a stretch of wall: stone courses lit from the top, crenellated, the merlons capped with snow if asked
  function wall(g, x0, x1, y0, y1, ramp, o) {
    o = o || {};
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const row = Math.floor((y - y0) / 4), brick = (x + (row % 2 ? 3 : 0)) % 7 === 0, course = (y - y0) % 4 === 0;
      let c = course ? ramp[0] : brick ? ramp[0] : y === y0 + 1 ? ramp[2] : (hash(x, y, o.seed || 5) > 0.9 ? ramp[2] : ramp[1]);
      g.set(x, y, c);
    }
    for (let x = x0; x <= x1; x++) { const tooth = Math.floor((x - x0) / 3) % 2 === 0 && !(o.gap && o.gap(x)); if (tooth) for (let y = y0 - 3; y < y0; y++) g.set(x, y, y === y0 - 3 ? OUT : ramp[2]); else g.set(x, y0 - 1, OUT); }
    for (let x = x0 - 1; x <= x1 + 1; x++) g.set(x, y1 + 1, OUT);
    for (let y = y0 - 3; y <= y1; y++) { g.set(x0 - 1, y, OUT); g.set(x1 + 1, y, OUT); }
    if (o.snow) for (let x = x0; x <= x1; x++) { const tooth = Math.floor((x - x0) / 3) % 2 === 0 && !(o.gap && o.gap(x)); g.set(x, tooth ? y0 - 3 : y0, "#ffffff"); if (!tooth) g.set(x, y0 + 1, bay(x, y0) < 0.5 ? "#c0cbdc" : g.get(x, y0 + 1)); }
  }
  // an arched gateway in a wall: dark inside, a portcullis drawn up (raised) or down
  function gateway(g, cx, hw, y0, y1, o) {
    o = o || {};
    const inA = (x, y) => Math.abs(x + 0.5 - cx) <= hw && (y >= y0 + hw || ((x + 0.5 - cx) / hw) ** 2 + ((y - y0 - hw) / hw) ** 2 <= 1);
    for (let y = y0 - 1; y <= y1; y++) for (let x = Math.floor(cx - hw - 1); x <= Math.ceil(cx + hw + 1); x++) {
      if (inA(x, y)) {
        let c = "#120e1a";
        if (o.glow && y > y1 - 4) c = y > y1 - 2 ? "#be4a2f" : "#3e1420";
        const bars = o.portcullis === "down" ? (Math.round(x - cx + hw) % 2 === 0 || (y - y0) % 3 === 0) : o.portcullis === "up" ? (y <= y0 + 2 && Math.round(x - cx + hw) % 2 === 0) : o.portcullis === "bent" ? (y <= y0 + 3 + (x > cx ? 2 : 0) && Math.round(x - cx + hw) % 2 === 0) : false;
        if (bars) c = (x + y) % 2 ? R.iron[2] : R.iron[1];
        g.set(x, y, c);
      } else if (inA(x - 1, y) || inA(x + 1, y) || inA(x, y + 1) || inA(x, y - 1)) g.set(x, y, OUT);
    }
  }
  // THE TROLL CASTLE: the abandoned castle the trolls took (pass 12, pass 21): its keep broken at the top, two drum towers, a wall with a
  // breach, the gatehouse with the castle's arms over its arch (a white wolf on blue in gold, smeared with the trolls' green hand), the
  // portcullis bent where it was raised, snow on every ledge (the Great Hall's snow), moss in the joints, the moat and the drawbridge down
  function castlePiece(room) {
    const at = room.spec.areas.find(a => a.id === "troll-castle").model, ox = at[0], oy = at[1], P = new Piece(room.SX + ox, room.SY + oy, 86, 76, room.SY + oy + 76), g = P.layer, st = R.tstone;
    // the keep behind: a tall square tower, its right top broken away, a slit, snow on its ledges
    for (let y = 8; y <= 46; y++) for (let x = 34; x <= 52; x++) {
      const broken = x > 44 && y < 8 + (x - 44) * 1.3 + (hash(x, 1, 91) > 0.5 ? 1 : 0);
      if (broken) continue;
      const u = (x - 34) / 18, c = (y - 8) % 5 === 0 ? st[0] : u < 0.25 ? st[2] : u < 0.7 ? st[1] : st[0];
      g.set(x, y, c);
    }
    for (let x = 34; x <= 52; x++) { const tooth = Math.floor((x - 34) / 3) % 2 === 0 && x <= 44; if (tooth) for (let y = 5; y < 8; y++) g.set(x, y, y === 5 ? "#ffffff" : st[2]); }
    g.set(40, 18, OUT); g.set(40, 19, OUT); g.set(40, 20, OUT); g.set(46, 26, OUT); g.set(46, 27, OUT);
    for (const [x, y] of [[47, 16], [48, 17], [50, 21], [51, 22], [49, 19]]) g.set(x, y, "#ffffff");
    // the curtain wall, a breach in it on the right; moss creeping up
    wall(g, 6, 80, 34, 58, st, { snow: true, seed: 92, gap: x => x >= 62 && x <= 67 });
    for (let y = 37; y <= 44; y++) for (let x = 62; x <= 67; x++) if (Math.abs(x - 64.5) <= 2.6 - (44 - y) * 0.15) g.set(x, y, y > 41 ? R.tstone[0] : "#120e1a");
    for (let x = 6; x <= 80; x++) { const v = vnoise(x, 0, 6, 93); if (v > 0.55) for (let y = 58 - Math.floor((v - 0.55) * 20); y <= 58; y++) if (bay(x, y) < 0.6) g.set(x, y, y > 55 ? R.moss[0] : R.moss[1]); }
    // the drum towers at each end, the right one broken
    drum(g, 0, 14, 24, 62, st, { snow: true, slit: true });
    drum(g, 72, 85, 28, 62, st, { slit: true });
    for (let x = 72; x <= 85; x++) for (let y = 22; y < 31; y++) if (y < 25 + Math.abs(x - 78) * 0.6 + (hash(x, 2, 94) > 0.6 ? 2 : 0)) g.set(x, y, null);
    for (let x = 73; x <= 84; x++) { const y = Math.round(25 + Math.abs(x - 78) * 0.6) + 2; g.set(x, y, "#ffffff"); g.set(x, y - 1, OUT); }
    // the gatehouse, taller than the wall, its arch with the portcullis bent, the arms over it
    for (let y = 26; y <= 62; y++) for (let x = 30; x <= 56; x++) {
      const u = (x - 30) / 26, c = (y - 26) % 5 === 0 ? st[0] : u < 0.2 ? st[2] : u < 0.72 ? st[1] : st[0];
      g.set(x, y, x === 30 || x === 56 ? OUT : c);
    }
    for (let x = 30; x <= 56; x++) { const tooth = Math.floor((x - 30) / 3) % 2 === 0; if (tooth) for (let y = 22; y < 26; y++) g.set(x, y, y === 22 ? OUT : y === 23 ? "#ffffff" : st[2]); else g.set(x, 25, OUT); }
    gateway(g, 43, 6, 46, 62, { portcullis: "bent" });
    // the arms: a blue shield, a white wolf's head, the gold rim, a smear of green hand across it
    for (let y = 31; y <= 40; y++) for (let x = 38; x <= 48; x++) { const inS = y <= 36 ? Math.abs(x - 43) <= 5 : Math.abs(x - 43) <= 5 - (y - 36) * 1.2; if (!inS) continue; const rim = y === 31 || !(y <= 36 ? Math.abs(x - 43) <= 4 : Math.abs(x - 43) <= 4 - (y - 36) * 1.2); g.set(x, y, rim ? "#feae34" : "#124e89"); }
    for (const [x, y] of [[42, 33], [43, 33], [44, 34], [42, 34], [43, 34], [43, 35], [41, 32], [44, 32]]) g.set(x, y, "#ffffff");
    for (const [x, y] of [[40, 35], [41, 35], [41, 36], [42, 37], [43, 37], [44, 38], [45, 36], [46, 34]]) g.set(x, y, y % 2 ? "#3e8948" : "#265c42");
    // the moat in front, and the drawbridge down across it to the bank
    for (let y = 63; y <= 70; y++) for (let x = 0; x <= 85; x++) { const edge = y === 63 || y === 70; g.set(x, y, edge ? OUT : y === 64 ? R.water[2] : (x * 3 + y * 5) % 17 === 0 ? R.water[2] : R.water[1]); }
    for (const x of [4, 9, 70, 79]) { g.set(x, 63, R.moss[1]); g.set(x, 62, "#3e8948"); }
    for (let y = 62; y <= 73; y++) for (let x = 37; x <= 49; x++) g.set(x, y, x === 37 || x === 49 ? OUT : y === 73 ? OUT : (y - 62) % 3 === 0 ? R.oak[0] : x === 38 ? R.oak[2] : R.oak[1]);
    g.set(37, 61, R.iron[2]); g.set(49, 61, R.iron[2]);
    // the banner's pole on the keep's top left (the banner flaps live)
    for (let y = 0; y <= 5; y++) g.set(35, y, y === 0 ? "#feae34" : R.oak[0]);
    room.banners.push({ x: room.SX + ox + 36, y: room.SY + oy + 1, kind: "wolf" });
    room.crowsAt = { x: room.SX + ox + 44, y: room.SY + oy + 4 };
    P.zone = "troll-castle";
    return P;
  }
  // HOME: the castle of the courtyard (pass 24), small: the keep with its banner (a gold anvil on red, a swallowtail), the two wings
  // under slate with their windows lit, the curtain wall, the west gate at its front left open and warm, the Forge's chimney glowing
  function homePiece(room) {
    const ox = room.spec.home.model[0], oy = room.spec.home.model[1], P = new Piece(room.SX + ox, room.SY + oy, 70, 60, room.SY + oy + 60), g = P.layer, st = R.hstone, sl = R.slate;
    // the wings: stone faces under slate roofs
    for (const [x0, x1] of [[6, 26], [42, 62]]) {
      for (let y = 14; y <= 22; y++) { const inset = Math.floor((22 - y) * 0.8); for (let x = x0 + inset - 1; x <= x1 - inset + 1; x++) { const e = x <= x0 + inset - 1 || x >= x1 - inset + 1 || y === 14; g.set(x, y, e ? OUT : (y % 2 ? sl[2] : sl[3])); } }
      for (let y = 23; y <= 40; y++) for (let x = x0; x <= x1; x++) g.set(x, y, x === x0 || x === x1 ? OUT : (y - 23) % 4 === 0 ? st[0] : x < x0 + 4 ? st[2] : st[1]);
      for (const wx of [x0 + 4, x0 + 10, x0 + 16]) if (wx + 1 < x1) { g.set(wx, 27, "#fee761"); g.set(wx + 1, 27, "#f77622"); g.set(wx, 28, "#f77622"); g.set(wx + 1, 28, "#be4a2f"); }
      g.set(x0 + 3, 12, OUT); g.set(x0 + 3, 13, st[1]);
    }
    // the keep between them: stone to the top, merlons, two slits, the banner's pole
    for (let y = 8; y <= 42; y++) for (let x = 26; x <= 42; x++) g.set(x, y, x === 26 || x === 42 ? OUT : (y - 8) % 5 === 0 ? st[0] : x < 30 ? st[2] : x > 38 ? st[0] : st[1]);
    for (let x = 26; x <= 42; x++) { const tooth = Math.floor((x - 26) / 3) % 2 === 0; if (tooth) for (let y = 4; y < 8; y++) g.set(x, y, y === 4 || x === 26 || x === 42 ? OUT : st[2]); else g.set(x, 7, OUT); }
    for (const x of [30, 38]) { g.set(x, 16, "#f77622"); g.set(x, 17, "#5a3030"); }
    for (let y = 0; y <= 4; y++) g.set(34, y, y === 0 ? "#feae34" : R.oak[0]);
    room.banners.push({ x: room.SX + ox + 35, y: room.SY + oy + 1, kind: "anvil" });
    // the curtain wall in front, the Forge's chimney rising behind it with its red mouth
    for (let y = 26; y <= 36; y++) for (let x = 50; x <= 54; x++) g.set(x, y, x === 50 || x === 54 ? OUT : y === 26 ? OUT : (y % 3 === 0 ? "#5a3030" : x === 51 ? "#b86f50" : "#733e39"));
    for (let x = 51; x <= 53; x++) g.set(x, 27, "#feae34");
    room.flames.push({ x: room.SX + ox + 52, y: room.SY + oy + 26, kind: "forge" }); room.smokes.push({ x: room.SX + ox + 52, y: room.SY + oy + 22, kind: "forge" });
    wall(g, 4, 66, 40, 54, st, { seed: 95 });
    // the west gate at the front left: a squat tower over an open arch with the road's warm light in it
    for (let y = 34; y <= 56; y++) for (let x = 2; x <= 20; x++) g.set(x, y, x === 2 || x === 20 ? OUT : (y - 34) % 5 === 0 ? st[0] : x < 6 ? st[2] : x > 16 ? st[0] : st[1]);
    for (let x = 2; x <= 20; x++) { const tooth = Math.floor((x - 2) / 3) % 2 === 0; if (tooth) for (let y = 30; y < 34; y++) g.set(x, y, y === 30 || x === 2 || x === 20 ? OUT : st[2]); else g.set(x, 33, OUT); }
    gateway(g, 11, 4, 46, 56, { portcullis: "up", glow: true });
    for (let x = 1; x <= 67; x++) g.set(x, 57, OUT);
    P.zone = "home";
    return P;
  }
  // THE USURPER'S CAPITAL: a white walled city on the coast: round towers with crimson cones, roofs packed inside, the palace and its
  // spire at the back, banners of crimson and black, the great gate shut, torches either side
  function capitalPiece(room) {
    const at = room.spec.areas.find(a => a.id === "usurpers-capital").model, ox = at[0], oy = at[1], P = new Piece(room.SX + ox, room.SY + oy, 100, 86, room.SY + oy + 84), g = P.layer, st = R.cstone, cr = R.crimson;
    // the palace at the back: a tall block, its spire, two thin towers, banners
    for (let y = 18; y <= 52; y++) for (let x = 38; x <= 62; x++) g.set(x, y, x === 38 || x === 62 ? OUT : (y - 18) % 5 === 0 ? st[0] : x < 43 ? st[3] : x > 57 ? st[1] : st[2]);
    for (let y = 2; y < 18; y++) { const hw = (y - 2) / 16 * 13; for (let x = Math.floor(50 - hw); x <= Math.ceil(50 + hw); x++) { const e = Math.abs(x + 0.5 - 50.5) > hw - 0.5; g.set(x, y, e ? OUT : x < 50 ? cr[2] : cr[1]); } }
    g.set(50, 1, OUT); g.set(50, 0, "#feae34");
    for (const x of [44, 56]) { g.set(x, 26, "#fee761"); g.set(x, 27, "#f77622"); g.set(x, 32, OUT); g.set(x, 33, OUT); }
    for (const [x0, x1] of [[32, 37], [63, 68]]) { for (let y = 14; y <= 50; y++) for (let x = x0; x <= x1; x++) g.set(x, y, x === x0 || x === x1 ? OUT : x === x0 + 1 ? st[3] : st[1]); for (let y = 6; y < 14; y++) { const hw = (y - 6) / 8 * 3.5; for (let x = Math.floor((x0 + x1) / 2 + 0.5 - hw); x <= Math.ceil((x0 + x1) / 2 + 0.5 + hw); x++) g.set(x, y, Math.abs(x - (x0 + x1) / 2 - 0.5) > hw - 0.6 ? OUT : x < (x0 + x1) / 2 + 0.5 ? cr[2] : cr[1]); } }
    room.banners.push({ x: room.SX + ox + 51, y: room.SY + oy + 1, kind: "crown" });
    // roofs packed inside the walls: rows of little houses, terracotta and slate, a lit window here and there
    for (let row = 0; row < 3; row++) for (let i = 0; i < 12; i++) {
      const hx = 6 + i * 8 + (row % 2 ? 4 : 0) + Math.floor(hash(i, row, 96) * 2), hy = 40 + row * 6;
      if (hx > 92 || (row === 0 && hx > 30 && hx < 70)) continue;
      const tone = hash(i, row, 97) < 0.6 ? R.terra : R.slate;
      for (let y = hy - 4; y <= hy; y++) { const hw = (y - hy + 5) * 0.9 + 1; for (let x = Math.floor(hx - hw); x <= Math.ceil(hx + hw); x++) g.set(x, y, Math.abs(x - hx) > hw - 0.6 || y === hy - 4 ? OUT : x < hx ? tone[2] : tone[1]); }
      if (hash(i, row, 98) > 0.6) g.set(hx, hy + 1, "#fee761");
    }
    // the outer wall and its four round towers with crimson cones
    wall(g, 4, 96, 56, 76, st, { seed: 99 });
    for (const [x0, x1] of [[0, 12], [26, 38], [62, 74], [88, 99]]) drum(g, x0, x1, 46, 80, st, { roof: 9, roofRamp: cr });
    // the great gate, shut, between two torches
    gateway(g, 50, 6, 62, 78, { portcullis: "down" });
    for (const x of [41, 59]) { g.set(x, 66, OUT); g.set(x, 67, R.oak[0]); room.flames.push({ x: room.SX + ox + x, y: room.SY + oy + 65, kind: "torch" }); }
    for (const x of [6, 32, 68, 94]) room.flames.push({ x: room.SX + ox + x, y: room.SY + oy + 44 - 9, kind: "beacon", off: true });
    for (let x = 0; x <= 99; x++) g.set(x, 81, OUT);
    // the harbour on the coast: an oak pier into the sea, a moored boat
    P.zone = "usurpers-capital";
    return P;
  }

  // ------------------------------------------------------------------ the light: two candles on the table, the little fires on the map
  // how lit (room pixel x, y) is for flicker phase f: k, the candles' warm pool (0 to 1); warm, a fire's on the map (0 to 1); and dim,
  // how far the dark has crept in from the table's edge (0 in the sheet's middle, rising past its corners)
  Room.prototype.lightAt = function (x, y, f) {
    let k = 0, warm = 0;
    this.lights.forEach((l, i) => {
      const fl = l.kind === "candle" ? 3 * Math.sin(f * 1.7 + i * 2.1) : 1.5 * Math.sin(f * 2.3 + i), R0 = l.r + fl, d = Math.hypot(x - l.x, (y - l.y) * 1.05);
      const v = 1 - d / R0; if (v <= 0) return;
      if (l.kind === "candle") k = Math.max(k, v); else warm = Math.max(warm, v * (l.kind === "lava" ? 1.15 : 1));
    });
    const cx = this.SX + this.spec.sheet.w / 2, cy = this.SY + this.spec.sheet.h / 2, v = Math.hypot((x - cx) / (this.spec.sheet.w * 0.56), (y - cy) / (this.spec.sheet.h * 0.62));
    return { k: Math.min(1, k), warm: Math.min(1, warm), dim: Math.max(0, v - 0.8) };
  };
  // light one pixel's colour (r, g, b) at room pixel (x, y): the dark at the edges in dithered steps, the candles' warmth, a fire's glow
  const CANDLE = [255, 214, 150], DARK = [24, 20, 37];
  function lightPx(rgb, L, x, y) {
    let [r, g, b] = rgb;
    const dim = Math.min(4, Math.max(0, Math.floor(L.dim * 9 + bay(x, y) - 0.5))) * 0.075;
    if (dim) { r += (DARK[0] - r) * dim; g += (DARK[1] - g) * dim; b += (DARK[2] - b) * dim; }
    if (L.k > 0) { const lift = S.glow(L.k, x, y) * 0.5; r += (CANDLE[0] - r) * lift; g += (CANDLE[1] - g) * lift; b += (CANDLE[2] - b) * lift * 0.55; }
    if (L.warm > 0) { const m = S.glow(L.warm, x, y), G = S.GLOW; r += (G[0] - r) * m; g += (G[1] - g) * m * 0.9; b += (G[2] - b) * m * 0.8; }
    return [r, g, b];
  }
  // the room's pixels lit for phase f, for the box (x0, y0, w, h) of the room: { w, h, d: RGBA bytes } of the still ground alone
  Room.prototype.groundFrame = function (f, x0, y0, w, h) {
    x0 = x0 || 0; y0 = y0 || 0; w = w || this.W; h = h || this.H;
    const G = this.ground, d = new Uint8ClampedArray(w * h * 4);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const x = x0 + xx, y = y0 + yy, inside = x >= 0 && y >= 0 && x < this.W && y < this.H, i = y * this.W + x, c = inside ? G.px[i] : OUT;
      let rgb = c ? hex(c) : DARK;
      if (inside && G.lit[i]) rgb = lightPx(rgb, this.lightAt(x, y, f), x, y);
      const o = (yy * w + xx) * 4; d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2]; d[o + 3] = 255;
    }
    return { w, h, d };
  };
  // a piece's pixels lit where it stands for phase f, as RGBA with transparency
  Room.prototype.pieceFrame = function (P, f) {
    const d = new Uint8ClampedArray(P.w * P.h * 4);
    for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) {
      const i = y * P.w + x, c = P.layer.px[i]; if (!c) continue;
      const rgb = lightPx(hex(c), this.lightAt(P.x + x, Math.min(P.sy, P.y + y + 6), f || 0), P.x + x, P.y + y);
      const o = i * 4; d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2]; d[o + 3] = 255;
    }
    return { w: P.w, h: P.h, d };
  };

  // ------------------------------------------------------------------ the small sprites: the pawn, the shades, banners, crows, the ship
  // a sprite from rows of letters and a palette, anchored at (ox, oy): { px, w, h, ox, oy }
  function rows(R0, pal, ox, oy) { const h = R0.length, w = R0[0].length, px = new Array(w * h).fill(null); R0.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== ".") px[y * w + x] = pal[ch]; })); return { px, w, h, ox, oy }; }
  // the placeholder: a war-table pawn of plain oak, carved and turned, lit from the top left, on its round foot
  const PAWN = [
    "....oooo....",
    "...oddcbo...",
    "..oddccbbo..",
    "..odccccbo..",
    "..occccbbo..",
    "...ocbbbo...",
    "....oooo....",
    "...occcbo...",
    "....ocbo....",
    "....ocbo....",
    "....ocbo....",
    "...occcbo...",
    "..occccbbo..",
    ".occcccbbbo.",
    ".oddcccbbbo.",
    "..oooooooo.."
  ];
  const pawn = () => rows(PAWN, { o: OUT, d: R.oak[3], c: R.oak[2], b: R.oak[1] }, 6, 15);
  // the shades (the other way for the placeholders, Isaac's call 3): a guess at each area's mob in soot, a cool rim on its lit edges,
  // two yellow eyes; the build draws none of them unless Isaac picks it
  function shade(kind, i) {
    const N = 40, L = new Layer(N, N), b = (i | 0) % 2;
    let body;
    if (kind === "yeti") body = or(ell(20, 22 + b, 9, 10), ell(20, 12 + b, 6, 5.5), rect(9, 20 + b, 12, 33), rect(28, 20 + b, 31, 33), rect(14, 30, 18, 38), rect(22, 30, 26, 38), ell(14, 16 + b, 4, 3), ell(26, 16 + b, 4, 3));
    else if (kind === "wyrm") body = or(ell(13, 33, 9, 4), ell(23, 30, 6, 4), ell(28, 24 - b, 4, 5), ell(30, 17 - b, 4.5, 3.5), poly([[33, 16 - b], [39, 18 - b], [33, 20 - b]]), ell(8, 35, 5, 2), rect(26, 23, 30, 30));
    else if (kind === "dragon") body = or(ell(20, 28, 9, 6), ell(28, 20 - b, 3, 6), ell(31, 13 - b, 4, 3), poly([[34, 12 - b], [39, 13 - b], [34, 15 - b]]), poly([[14, 25], [2, 8 - b * 2], [9, 13], [12, 6 - b * 2], [16, 15], [20, 12 - b], [21, 24]]), poly([[11, 31], [3, 36], [1, 33], [8, 30]]), rect(15, 31, 17, 38), rect(23, 31, 25, 38), poly([[30, 10 - b], [29, 6 - b], [32, 9 - b]]));
    else body = or(ell(20, 11 + b, 4, 4), poly([[15, 9 + b], [20, 3 + b], [25, 9 + b]]), rect(15, 15 + b, 25, 29), rect(15, 29, 18, 38), rect(22, 29, 25, 38), poly([[24, 16 + b], [32, 16 + b], [32, 27 + b], [28, 32 + b], [24, 27 + b]]), rect(10, 2, 11, 38), poly([[9, 2], [10.5, -2], [12, 2]]));
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!body(x + 0.5, y + 0.5)) continue;
      const ul = !body(x - 0.5, y + 0.5) || !body(x + 0.5, y - 0.5);
      L.set(x, y, ul ? "#3a4466" : OUT);
    }
    const eyes = { yeti: [[18, 12], [22, 12]], wyrm: [[31, 16]], dragon: [[32, 12]], guard: [[19, 11], [21, 11]] }[kind] || [];
    for (const [x, y] of eyes) L.set(x, y + (kind === "yeti" || kind === "guard" ? b : -b), "#fee761");
    if (kind === "guard") for (let y = 18; y <= 25; y++) L.set(28, y + b, "#a22633");
    return { px: L.px, w: N, h: N, ox: 20, oy: 38 };
  }
  // the banners, nine by six, flapping in three frames: the Troll Castle's (the wolf on blue in gold, the green hand over it unless the
  // castle is won), home's (a gold anvil on red, a swallowtail), the capital's (crimson, a black chevron); pole on the left
  function banner(kind, f, clean) {
    const w = 10, h = 8, px = new Array(w * h).fill(null), wave = x => Math.round(Math.sin(x * 0.9 - f * 2.1) * 1.1 * (x / w));
    const field = kind === "wolf" ? ["#0b2f55", "#124e89"] : kind === "anvil" ? ["#a22633", "#e43b44"] : ["#5a3030", "#a22633"];
    for (let x = 0; x < w; x++) {
      const dy = wave(x), tail = kind === "anvil" && x >= w - 2;
      for (let y = 0; y < 6; y++) {
        if (tail && (y === 2 || y === 3) && x === w - 1) continue;
        if (tail && (y === 2 || y === 3) && x === w - 2 && kind === "anvil") continue;
        const Y = y + dy + 1; if (Y < 0 || Y >= h) continue;
        let c = (x + f) % 3 === 0 ? field[0] : field[1];
        if (y === 0 || y === 5) c = kind === "crown" ? OUT : "#feae34";
        if (kind === "wolf" && x >= 3 && x <= 5 && y >= 2 && y <= 3) c = "#ffffff";
        if (kind === "wolf" && x === 4 && y === 1) c = "#ffffff";
        if (kind === "wolf" && !clean && ((x === 5 && y === 4) || (x === 6 && y === 3) || (x === 6 && y === 2) || (x === 7 && y === 3))) c = "#3e8948";
        if (kind === "anvil" && ((y === 2 && x >= 3 && x <= 6) || (y === 3 && x >= 4 && x <= 5) || (y === 4 && x >= 3 && x <= 6))) c = "#feae34";
        if (kind === "crown" && y >= 1 && y <= 4 && Math.abs(x - 4.5) <= 3 - Math.abs(y - 2.5) * 0.9 && y > 1) c = OUT;
        px[Y * w + x] = c;
      }
    }
    return { px, w, h, ox: 0, oy: 1 };
  }
  // a crow: wings up, level or down, five by three
  const CROW = [["o...o", ".o.o.", "..o.."], [".....", "ooooo", "..o.."], [".....", ".ooo.", "o.o.o"]];
  const crow = f => rows(CROW[((f % 3) + 3) % 3], { o: OUT }, 2, 1);
  // the ship: a cog with a cream sail and a red stripe, eleven by ten, its bow to the right (mirrored when it sails left)
  const SHIP = [
    ".....o.....",
    "....oqo....",
    "...oqqqo...",
    "..oqrrqqo..",
    "..oqqqqqo..",
    "...ooooo...",
    ".....o.....",
    "obbbbbbbbbo",
    ".obaaaaabo.",
    "..ooooooo.."
  ];
  const ship = () => rows(SHIP, { o: OUT, q: "#ead4aa", r: "#a22633", b: R.oak[2], a: R.oak[1] }, 5, 9);
  // a candle on its brass dish: wax lit on the left, a drip, the flame live (drawn as a piece so the figures never pass under it)
  // (design pass 36, build 27) the Arena: a round colosseum of ashlar on the sands' northern edge, seen from the front and a little above:
  // two tiers of arcade arches, the sand of its floor inside the oval, a dark gate at the front, a red pennant on a pole; outlined in
  // soot as the map's models are. Its model point is the piece's top left (spec areas[].model); the place is the oval's middle
  function arenaPiece(room) {
    const A = room.spec.areas.find(a => a.look === "arena"), at = A.model, ox = at[0], oy = at[1], P = new Piece(room.SX + ox, room.SY + oy, 44, 30, room.SY + oy + 26), g = P.layer;
    const st = R.tstone, sd = ["#e8b796", "#ead4aa"], cx = 22, cy = 17;
    const ell = (x0, y0, rx, ry, c) => { for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) g.set(x0 + x, y0 + y, c); };
    ell(cx, cy + 2, 17, 8, OUT); ell(cx, cy - 5, 17, 8, OUT); for (let y = cy - 5; y <= cy + 2; y++) for (let x = cx - 17; x <= cx + 17; x++) g.set(x, y, OUT);
    ell(cx, cy + 2, 16, 7, st[1]); for (let y = cy - 5; y <= cy + 2; y++) for (let x = cx - 16; x <= cx + 16; x++) g.set(x, y, x < cx - 6 ? st[2] : x > cx + 8 ? st[0] : st[1]);
    ell(cx, cy - 5, 16, 7, st[1]); ell(cx, cy - 6, 15, 6, st[2]);
    ell(cx, cy - 5, 10, 4, sd[0]); ell(cx, cy - 5, 9, 3, sd[1]);
    for (let x = cx - 14; x <= cx + 14; x += 3) { const dip = Math.abs(x - cx) > 10 ? -1 : 0; g.set(x, cy + 2 + dip, "#262b44"); g.set(x, cy + 3 + dip, "#262b44"); g.set(x, cy - 2 + dip, st[3]); g.set(x, cy - 1 + dip, "#262b44"); }
    for (let y = cy; y <= cy + 1; y++) for (let x = cx - 16; x <= cx + 16; x++) if (g.px[y * P.w + x] !== OUT) g.set(x, y, st[3]);
    for (let y = cy + 4; y <= cy + 8; y++) for (let x = cx - 1; x <= cx + 1; x++) g.set(x, y, "#262b44");
    for (let y = cy - 16; y <= cy - 6; y++) g.set(cx + 12, y, OUT);
    for (let x = cx + 13; x <= cx + 18; x++) for (let y = cy - 16; y <= cy - 14; y++) g.set(x, y, y === cy - 16 ? R.crimson[2] : R.crimson[1]);
    g.set(cx + 13, cy - 13, R.crimson[0]); g.set(cx + 14, cy - 13, R.crimson[0]);
    room.banners.push({ x: room.SX + ox + cx + 12, y: room.SY + oy + cy - 17, kind: "pennant" });
    room.marks.push({ area: A.id, what: "colosseum", box: [ox + cx - 17, oy + cy - 17, ox + cx + 18, oy + cy + 10] });
    return P;
  }
  function candlePiece(room, x, y) {
    const P = new Piece(x - 8, y - 22, 17, 24, y + 2), g = P.layer;
    for (let yy = 16; yy <= 23; yy++) for (let xx = 0; xx <= 16; xx++) { const d = Math.hypot(xx - 8, (yy - 19.5) * 2); if (d <= 8.5) g.set(xx, yy, d > 7.5 ? OUT : d > 5.5 ? (xx < 7 ? "#fee761" : "#feae34") : "#be4a2f"); }
    for (let yy = 4; yy <= 19; yy++) for (let xx = 5; xx <= 11; xx++) g.set(xx, yy, xx === 5 || xx === 11 ? OUT : yy === 4 ? OUT : xx < 7 ? R.wax[3] : xx < 10 ? R.wax[2] : R.wax[1]);
    for (const [xx, yy] of [[10, 6], [10, 7], [10, 8], [6, 5], [6, 6]]) g.set(xx, yy, R.wax[3]);
    g.set(8, 3, OUT); g.set(8, 2, OUT);
    room.flames.push({ x, y: y - 22, kind: "candle" });
    return P;
  }

  // ------------------------------------------------------------------ the rules: an area's state and its rows (the build tests these)
  // cleared: a set (or an object of id: true) of the level ids cleared, the runs still waiting to be paid counted in by the page
  function isCleared(cleared, id) { return !!id && (cleared instanceof Set ? cleared.has(id) : !!(cleared && cleared[id])); }
  // (design pass 36, build 27) a level still marked soon (the Throne) stands for the last built level of its area (the Keep): what opens
  // after it opens after that one, until it is built (Isaac's call, pass 36 section 8)
  function standIn(id) {
    for (const A of (SPEC.areas || [])) { const L = (A.levels || []).find(l => l.id === id); if (!L) continue; if (!L.soon) return id; const built = (A.levels || []).filter(l => !l.soon); return built.length ? built[built.length - 1].id : id; }
    return id;
  }
  const clearedOrStandIn = (cleared, id) => isCleared(cleared, id) || (standIn(id) !== id && isCleared(cleared, standIn(id)));
  // soon: no level built; shut: built, but the level it opens after is not cleared; open; won: its last level (wonBy) cleared
  function areaState(A, cleared) {
    if (A.pvp) return A.opensAfter && !clearedOrStandIn(cleared, A.opensAfter) ? "shut" : "open";   // (design pass 36) the Arena: never soon, never won
    const built = (A.levels || []).filter(L => !L.soon);
    if (!built.length) return "soon";
    if (A.opensAfter && !isCleared(cleared, A.opensAfter)) return "shut";   // (the stand-in rule is the Arena's alone: the Frostpeaks wait for the Throne)
    if (A.wonBy && isCleared(cleared, A.wonBy)) return "won";
    return "open";
  }
  // the plate's rows: each level, cleared, open, locked (with what to clear first) or soon; the pick is the first open level not cleared,
  // or the last level the player picked here if it is still open
  function levelRows(A, cleared, lastPick) {
    const rowsOut = (A.levels || []).map((L, n) => {
      const prev = L.after || (n > 0 ? A.levels[n - 1].id : null);
      let state = L.soon ? "soon" : isCleared(cleared, L.id) ? "cleared" : (!prev || isCleared(cleared, prev)) ? "open" : "locked";
      const need = state === "locked" ? (A.levels.find(x => x.id === prev) || {}).name : null;
      return { id: L.id, n: n + 1, name: L.name, area: L.area || null, state, need, boss: L.boss || null };
    });
    const pickable = r => r.state === "open" || r.state === "cleared";
    let pick = rowsOut.find(r => r.id === lastPick && pickable(r)) || rowsOut.find(r => r.state === "open") || rowsOut.filter(pickable).pop() || null;
    return { rows: rowsOut, pick: pick ? pick.id : null };
  }
  // the address a pick opens on the Battlegrounds page (the way into a level: ?area= and the brothers). base is the page's own name
  // for the Battlegrounds page (the-battlegrounds.html in the source, battlegrounds.html where it is deployed), with any flags it carries
  function levelUrl(row, brothers, base) { base = base || "battlegrounds.html"; return base + (base.indexOf("?") >= 0 ? "&" : "?") + "area=" + encodeURIComponent(row.area) + "&brothers=" + clamp(brothers | 0, 0, 3); }

  // ------------------------------------------------------------------ the trip: the knight walks the road out (or home)
  // where the knight is at time s (seconds) into a trip along pts at speed v: { x, y, facing, walking, done }
  function tripAt(pts, s, v) {
    const L = lengthOf(pts); let d = clamp(s * v, 0, L), i = 0;
    while (i + 1 < pts.length) { const seg = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); if (d <= seg || i + 2 === pts.length) { const t = seg ? Math.min(1, d / seg) : 1, dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1]; return { x: pts[i][0] + dx * t, y: pts[i][1] + dy * t, facing: Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "away" : "toward"), walking: s * v < L, done: s * v >= L, len: L }; } d -= seg; i++; }
    const p = pts[pts.length - 1]; return { x: p[0], y: p[1], facing: "toward", walking: false, done: true, len: L };
  }
  // a road's time at the knight's speed, never more than 1.1 s (a long road is walked quicker)
  function tripTime(pts, v) { return Math.min(1.1, lengthOf(pts) / v); }

  // ------------------------------------------------------------------ the live layer at time t: everything that moves
  // st: { states: { areaId: "open" | ... }, trip: { area, t0, back } | null, still } ; returns lists in room pixels, each sorted by the
  // page: figures (sprites with a sort y), flames, smoke puffs, sparks, snow, sand, glints, lava recolours, clouds, crows, the ship
  Room.prototype.live = function (t, st) {
    st = st || {}; t = Math.max(0, t || 0);
    const still = !!st.still, tick = still ? 0 : Math.floor(t * 8), SX = this.SX, SY = this.SY, sp = this.spec, out = { figures: [], flames: [], smoke: [], sparks: [], snow: [], sand: [], glints: [], lava: [], clouds: [], shadows: [], crows: [], banners: [], road: [] };
    const states = st.states || {};
    // a reveal in play (design pass 25 section 4.7): st.reveal is { kind: "open" | "won", area, t0 }; rv says how far into it the clock is
    const rv = !still && st.reveal && REVEAL_S[st.reveal.kind] && t >= st.reveal.t0 && t - st.reveal.t0 < REVEAL_S[st.reveal.kind] ? { kind: st.reveal.kind, area: st.reveal.area, s: t - st.reveal.t0 } : null;
    const winning = rv && rv.kind === "won" && rv.area === "troll-castle" ? rv : null, opening = rv && rv.kind === "open" ? rv : null;
    // the flames: candles and fires flicker on the frame clock; the capital's beacons are dark
    for (const F of this.flames) if (!F.off) out.flames.push({ x: F.x, y: F.y, kind: F.kind, f: (tick + F.x * 7 + F.y) % 4 });
    // smoke: the candles none; the trolls' fire a thin grey trail; home's chimney with sparks; the den a thick dark column
    if (!still) for (const s of this.smokes) out.smoke.push(...smokeOf(t, s));
    if (!still) { const c = this.smokes.find(s => s.kind === "forge"); if (c) out.sparks.push(...sparksOf(t, c.x, c.y + 3)); const d = this.smokes.find(s => s.kind === "den"); if (d) out.sparks.push(...embersOf(t, d.x, d.y + 4)); }
    // the banners flap
    for (const B of this.banners) out.banners.push({ x: B.x, y: B.y, kind: B.kind, f: still ? 0 : Math.floor(t * 5 + B.x) % 3, clean: B.kind === "wolf" && states["troll-castle"] === "won" && !(winning && winning.s < 0.6) });   // (won in play: the green hand burns off as the troll finishes turning to stone)
    // the den's lava runs and pulses down from the crater; the cave breathes
    for (const P of this.lava) { const ph = still ? 0 : Math.floor(t * 6); const k = P.cave ? 1 + Math.round(1 + Math.sin(t * 2.2 + P.x * 0.3)) * (still ? 0 : 1) : P.hot ? 2 + ((ph - P.k) & 3 ? 1 : 2) : ((ph - P.k) & 7) < 2 ? 3 : ((ph - P.k) & 7) < 5 ? 2 : 1; out.lava.push({ x: P.x, y: P.y, c: R.lava[clamp(P.cave ? k - 1 : k, 0, 4)] }); }
    // glints on the sea and the river: each shows for two ticks in every sixteen
    if (!still) for (let n = 0; n < this.water.length; n++) { const [x, y] = this.water[n]; if (((tick + Math.floor(hash(x, y, 101) * 16)) & 15) < 2) out.glints.push({ x, y, c: (n % 3) ? "#2ce8f5" : "#ffffff" }); }
    // snow falling over the Frostpeaks (inside its country), sand blowing over the Sands
    if (!still) {
      for (let n = 0; n < 46; n++) { const x0 = 142 + hash(n, 1, 102) * 180, v = 6 + hash(n, 2, 102) * 5, y = 12 + ((hash(n, 3, 102) * 82 + t * v) % 82), x = x0 + Math.sin(t * 0.9 + n) * 2; const k = countryOf(this, Math.round(x), Math.round(y)); if (k === "snow") out.snow.push({ x: SX + Math.round(x), y: SY + Math.round(y), c: n % 4 ? "#ffffff" : "#c0cbdc" }); }
      for (let n = 0; n < 22; n++) { const y = 190 + hash(n, 4, 103) * 34, v = 16 + hash(n, 5, 103) * 10, x = 164 + ((hash(n, 6, 103) * 214 + t * v) % 214); const k = countryOf(this, Math.round(x), Math.round(y)); if (k === "sand" && ((Math.floor(t * 2 + n) % 5) !== 0)) out.sand.push({ x: SX + Math.round(x), y: SY + Math.round(y), len: 2 + (n % 3), c: n % 2 ? "#ead4aa" : "#fffaf0" }); }
    }
    // crows round the Troll Castle's broken keep (gone once it is won)
    // (won in play: they fly off to the east and up, and are gone when it ends)
    if ((states["troll-castle"] !== "won" || winning) && this.crowsAt) for (let n = 0; n < 3; n++) { const a = (still ? 0 : t) * 0.9 + n * 2.1, off = winning ? winning.s : 0; out.crows.push({ x: Math.round(this.crowsAt.x + Math.cos(a) * 16 + off * (60 + n * 14)), y: Math.round(this.crowsAt.y + Math.sin(a) * 5 - n - off * off * 44), f: still ? 1 : Math.floor(t * 6 + n * 2) % 3 }); }
    // the ship sails along the coast and back, bobbing; it parks at the harbour under less motion
    { const T = 64, u = still ? 0.15 : ((t % T) / T), back = u > 0.5, s = back ? (1 - u) * 2 : u * 2, x = 434 + s * 50, y = 224 - s * 5 + (still ? 0 : Math.round(Math.sin(t * 1.4))); out.ship = { x: SX + Math.round(x), y: SY + Math.round(y), flip: back }; }
    // cloud shadows drift west to east over the whole sheet; the soon areas sit under drifting cloud
    if (!still) for (let n = 0; n < 3; n++) { const x = ((t * 3.2 + n * 197) % 700) - 90, y = 34 + n * 70 + Math.sin(t * 0.05 + n) * 6; out.shadows.push({ x: SX + Math.round(x), y: SY + Math.round(y), rx: 34 + n * 6, ry: 10 + (n % 2) * 3 }); }
    for (const A of sp.areas) {
      if ((states[A.id] || "soon") !== "soon") continue;
      const C = CLOUDS[A.id] || [];
      C.forEach((c, n) => out.clouds.push({ x: SX + c[0] + Math.round(still ? 0 : Math.sin(t * 0.22 + n * 1.9) * 5), y: SY + c[1] + Math.round(still ? 0 : Math.sin(t * 0.15 + n) * 1.5), w: c[2], seed: n + A.order * 7 }));
    }
    // an area that has just opened: its clouds roll off toward the sheet's nearer side for 1.2 s (the page clips them to the sheet)
    if (opening && CLOUDS[opening.area] && opening.s < 1.2) { const A = sp.areas.find(a => a.id === opening.area), u = opening.s / 1.2, dir = A && A.place[0] < W / 2 ? -1 : 1; if (A) CLOUDS[A.id].forEach((c, n) => out.clouds.push({ x: SX + c[0] + Math.round(dir * u * u * 240), y: SY + c[1] - Math.round(u * 6), w: c[2], seed: n + A.order * 7, leaving: true })); }
    // the open roads' dots shine gold and crawl outward from home
    for (const A of sp.areas) { const s0 = states[A.id]; if (s0 !== "open" && s0 !== "won") continue; let n = 0; const head = still ? -1 : Math.floor(t * 7) % (along(A.road, 4, 2).length + 6), lim = opening && opening.area === A.id ? Math.floor(Math.max(0, opening.s - 1) * along(A.road, 4, 2).length) : Infinity /* just opened: the road turns gold from home outward in the reveal's last second */; for (const p of along(A.road, 4, 2)) { const x = Math.round(p.x), y = Math.round(p.y); n++; if (n > lim) break; if (inRiver(x, y) || inRiver(x + 1, y)) continue; out.road.push({ x: SX + x, y: SY + y, hot: Math.abs(n - head) <= 1 }); } }
    // the figures: each area's mob (or its placeholder), and the knight
    for (const A of sp.areas) {
      const s0 = states[A.id] || "soon", mob = A.mob, mx = mob.x !== undefined ? mob.x : (mob.x0 + mob.x1) / 2, op = opening && opening.area === A.id ? opening.s : null;
      // an area that has just opened: its pawn sinks into the map in a puff of dust (0.6 to 1.1 s in), then its mob rises in its place
      if (op !== null && op < 1.1) { out.figures.push({ who: "pawn", x: SX + Math.round(mx), y: SY + mob.y, area: A.id, sink: clamp((op - 0.6) / 0.5, 0, 1) }); if (op > 0.6) out.smoke.push(...dustOf(op - 0.6, SX + mx, SY + mob.y)); continue; }
      const rise = op !== null ? clamp((op - 1.1) / 0.4, 0, 1) : 1;
      // (won in play: the troll goes to stone where he stands in the stone death's four steps; shut: he stands grey and still)
      if (mob.kind === "troll") out.figures.push(Object.assign({ who: "troll", troll: mob.troll }, winning && winning.area === A.id ? { x: SX + mx, y: SY + mob.y, facing: "toward", anim: "idle", i: 0, stone: Math.min(4, 1 + Math.floor(winning.s / 0.15)) } : s0 === "shut" ? { x: SX + mx, y: SY + mob.y, facing: "toward", anim: "idle", i: 0, stone: 4 } : trollAt(t, mob, s0, st, still), { area: A.id, rise }));
      else if (st.shades) out.figures.push({ who: "shade", shade: mob.shade, x: SX + mob.x, y: SY + mob.y, i: still ? 0 : Math.floor(t * 1.6 + A.order) % 2, area: A.id });
      else out.figures.push({ who: "pawn", x: SX + mob.x, y: SY + mob.y, area: A.id, wobble: st.wobble && st.wobble.area === A.id ? st.wobble : null });
    }
    out.figures.push(Object.assign({ who: "knight" }, knightAt(t, sp, st, still)));
    // Go (section 4.5): the knight takes two steps on from where the road stops, toward the place, in a quarter of a second
    if (st.going) { const A = sp.areas.find(a => a.id === st.going.area), K = out.figures[out.figures.length - 1]; if (A) { const u = still ? 1 : clamp((t - st.going.t0) / 0.25, 0, 1), dx = A.place[0] - A.stop[0], dy = A.place[1] - A.stop[1], d = Math.hypot(dx, dy) || 1; K.x = SX + A.stop[0] + dx / d * 6 * u; K.y = SY + A.stop[1] + dy / d * 6 * u; K.facing = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "away" : "toward"); K.anim = u < 1 ? "walk" : "idle"; K.i = u < 1 ? Math.floor(t * 8) % 4 : 0; } }
    for (const F of out.figures) F.sy = F.y;
    return out;
  };
  // where the shroud clouds sit over each soon area: [x, y, width] in sheet pixels. Each stays inside its own area's zone through
  // its whole drift (5 px to either side, 2 px up and down)
  const CLOUDS = {
    "frostpeaks": [[150, 40, 30], [252, 18, 34], [284, 58, 26]],
    "dragons-den": [[354, 22, 30], [458, 42, 32]],
    "usurpers-capital": [[392, 106, 28], [464, 162, 26]],
    "burning-sands": [[264, 189, 28], [306, 197, 28]]
  };
  // the troll by the castle (state "open"): a patrol along the castle's front, a look round, a swing of the club; facing the knight with
  // the club up while the knight stands at the castle (the trip there and the plate open); stone in his place once the castle is won
  function trollAt(t, mob, s0, st, still) {
    const ox = SPEC.room.sheetX, oy = SPEC.room.sheetY, mid = (mob.x0 + mob.x1) / 2;
    if (s0 === "won") return { x: ox + mid, y: oy + mob.y, facing: "toward", anim: "stone", i: 0 };
    if (still) return { x: ox + mid, y: oy + mob.y, facing: "right", anim: "idle", i: 0 };
    const trip = st.trip && st.trip.area === "troll-castle" && !st.trip.back;
    if (trip) { const dt = t - st.trip.t0; return { x: ox + mob.x1 - 4, y: oy + mob.y, facing: "right", anim: dt < 0.25 ? "idle" : "wind", i: Math.floor(t * 2) % 2 }; }
    // the cycle (14 s): walk left 3.2 s, look 2 s, swing 0.8 s, walk right 3.2 s, idle facing you 4.8 s
    const c = t % 14, span = mob.x1 - mob.x0, v = span / 3.2;
    if (c < 3.2) return { x: ox + mob.x1 - c * v, y: oy + mob.y, facing: "left", anim: "walk", i: Math.floor(t * 8) % 4 };
    if (c < 5.2) return { x: ox + mob.x0, y: oy + mob.y, facing: c < 4.2 ? "left" : "away", anim: "idle", i: Math.floor(t * 2) % 2 };
    if (c < 6.0) { const k = c - 5.2; return { x: ox + mob.x0, y: oy + mob.y, facing: "left", anim: k < 0.4 ? "wind" : k < 0.55 ? "strike" : "recover", i: 0 }; }
    if (c < 9.2) return { x: ox + mob.x0 + (c - 6.0) * v, y: oy + mob.y, facing: "right", anim: "walk", i: Math.floor(t * 8) % 4 };
    return { x: ox + mob.x1, y: oy + mob.y, facing: c < 11 ? "toward" : "right", anim: "idle", i: Math.floor(t * 2) % 2 };
  }
  // the knight: by home's gate, facing you; on a trip, walking the road (there, or home); stopped at the place while its plate is open
  function knightAt(t, sp, st, still) {
    const ox = sp.room.sheetX, oy = sp.room.sheetY, home = sp.knight.stand;
    if (st.trip) {
      const A = sp.areas.find(a => a.id === st.trip.area); if (A) {
        const pts = st.trip.back ? A.road.slice().reverse() : A.road, v = Math.max(sp.knight.speed, lengthOf(pts) / 1.1), s = still ? 99 : t - st.trip.t0, p = tripAt(pts, s, v);
        const facing = p.done ? (st.trip.back ? "toward" : "left") : p.facing;
        return { x: ox + p.x, y: oy + p.y, facing, anim: p.walking ? "walk" : "idle", i: p.walking ? Math.floor(t * 8) % 4 : Math.floor(t * 2) % 2, arrived: p.done };
      }
    }
    return { x: ox + home[0], y: oy + home[1], facing: "toward", anim: "idle", i: still ? 0 : Math.floor(t * 2) % 2 };
  }
  // smoke from a source: puffs that rise, drift east and fade (dithered discs); the den's thick and dark, the trolls' thin and grey
  function smokeOf(t, s) {
    const out = [], big = s.kind === "den", n = big ? 14 : s.kind === "forge" ? 6 : 5, life = big ? 5.2 : 3.2, col = big ? ["#2a1d28", "#3e2731", "#5a3030"] : ["#5a6988", "#8b9bb4", "#c0cbdc"];
    for (let k = 0; k < n; k++) {
      const age = ((t + k * life / n) % life) / life, rise = age * (big ? 60 : 26), drift = age * age * (big ? -12 : 12) + Math.sin(t * 1.3 + k) * (big ? 2 : 1.2);
      out.push({ x: Math.round(s.x + drift), y: Math.round(s.y - rise), r: (big ? 3.5 : 1.2) + age * (big ? 7 : 3), a: (1 - age * 0.8) * (big ? 1 : 0.7), c: col[k % 3] });
    }
    return out;
  }
  function sparksOf(t, x, y) { const out = []; for (let k = 0; k < 4; k++) { const age = ((t * 1.3 + k * 0.37) % 1); if (age > 0.7) continue; out.push({ x: Math.round(x + Math.sin(k * 2.3 + t) * 3 + age * 4), y: Math.round(y - age * 14), c: age < 0.3 ? "#fee761" : "#f77622" }); } return out; }
  function embersOf(t, x, y) { const out = []; for (let k = 0; k < 7; k++) { const age = ((t * 0.6 + k * 0.29) % 1); out.push({ x: Math.round(x + Math.sin(k * 3.1 + t * 0.8) * 5 - age * 6), y: Math.round(y - age * 26), c: age < 0.25 ? "#fee761" : age < 0.6 ? "#f77622" : "#a22633" }); } return out; }
  // a cloud of the shroud, w wide: three to five puffs, white on top, pale grey under, a grey rim, the same shape for the same seed
  function cloud(w, seed) {
    const h = Math.round(w * 0.44), L = new Layer(w + 2, h + 2), puffs = [];
    const n = 3 + (seed % 3);
    for (let k = 0; k < n; k++) { const px = 3 + (w - 6) * (k + 0.5) / n + (hash(k, seed, 111) - 0.5) * 4, r = h * (0.4 + hash(k, seed, 112) * 0.22) * (k === 0 || k === n - 1 ? 0.78 : 1); puffs.push([px, h - r * 0.95, r]); }
    const inC = (x, y) => (y < h - 1 && puffs.some(([px, py, r]) => Math.hypot(x - px, (y - py) * 1.15) <= r)) || (y >= h * 0.6 && y < h - 0.5 && x > 3 && x < w - 3);
    for (let y = 0; y <= h; y++) for (let x = 0; x <= w; x++) {
      if (!inC(x + 0.5, y + 0.5)) continue;
      const top = !inC(x + 0.5, y - 0.5), left = !inC(x - 0.5, y + 0.5), base = y >= h - 2, under = y > h * 0.66;
      L.set(x + 1, y + 1, base ? R.cloud[0] : under ? R.cloud[1] : (top || left) ? R.cloud[3] : R.cloud[2]);
    }
    const add = []; for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) if (!L.get(x, y) && (L.get(x - 1, y) || L.get(x + 1, y) || L.get(x, y - 1) || L.get(x, y + 1))) add.push([x, y]);
    for (const [x, y] of add) L.set(x, y, y > L.h * 0.6 ? "#5a6988" : R.cloud[0]);
    return { px: L.px, w: L.w, h: L.h, ox: 0, oy: 0 };
  }
  // a little flame, three frames of five rows for a candle, smaller for a torch, a fire's bigger
  const FLAME = { candle: [["..y..", ".yhy.", ".yhy.", ".fyf.", "..f.."], [".y...", ".yhy.", ".yhy.", ".fyf.", "..f.."], ["...y.", ".yhy.", ".yhy.", ".fyf.", "..f.."], ["..y..", "..y..", ".yhy.", ".fyf.", "..f.."]],
    camp: [["..y..", ".yfy.", "yfrfy", ".frf."], [".y.y.", ".yfy.", "yfhfy", ".frf."], ["...y.", "y.fy.", "yfhfy", ".frf."], [".y...", ".yfy.", "yfrfy", "frrrf"]],
    torch: [["y", "f"], ["h", "f"], ["y", "r"], ["h", "y"]], forge: [["fyf"], ["yhy"], ["fyf"], ["rfr"]], beacon: [["y"], ["f"], ["y"], ["f"]] };
  const FLAME_PAL = { y: "#feae34", h: "#fee761", f: "#f77622", r: "#e43b44" };

  // where a tap at sheet pixel (x, y) lands: an area's id, "home", "legend", or null
  function hitAt(spec, x, y) {
    for (const A of spec.areas) if (poly(A.zone)(x, y)) return A.id;
    if (spec.home && poly(spec.home.zone)(x, y)) return "home";
    if (spec.legend) { const b = spec.legend.box; if (x >= b[0] && x <= b[2] + 1 && y >= b[1] && y <= b[3] + 1) return "legend"; }
    return null;
  }

  // ------------------------------------------------------------------ what changed since the map was last shown (design pass 25 section 4.7)
  // how long a reveal plays (seconds): an area opening (its clouds roll off in 1.2 s, the pawn sinks and the mob rises, the road turns
  // gold from home outward), an area won (the troll goes to stone in four steps of 0.15 s, the banner comes clean, the crows fly off).
  // A level cleared for the first time is the page's own: its pip fills with a gold glint
  const REVEAL_S = { open: 2, won: 1.2 };
  // a puff of dust where a pawn sinks into the map: pale puffs that spread and fade
  function dustOf(s, x, y) { const out = []; for (let k = 0; k < 5; k++) { const a = k * 1.26, u = Math.min(1, s * 2); out.push({ x: Math.round(x + Math.cos(a) * (2 + u * 7)), y: Math.round(y - 1 - Math.abs(Math.sin(a)) * u * 4), r: 1.2 + u * 2, a: 0.9 - u * 0.6, c: k % 2 ? "#e4a672" : "#ead4aa" }); } return out; }
  // what the map shows now, as the save keeps it (profile.mapSeen): each area's state and each level's
  function seenOf(spec, cleared) {
    const out = { areas: {}, levels: {} };
    for (const A of spec.areas) { out.areas[A.id] = areaState(A, cleared); for (const r of levelRows(A, cleared).rows) out.levels[r.id] = r.state; }
    return out;
  }
  // the reveal's plays since the map was last shown (seen: what seenOf gave then), in the order they play: each level cleared for the
  // first time, then each area that opened, then each area won. A map never shown before plays nothing: it is seen as it stands
  function changes(spec, seen, cleared) {
    const out = [];
    if (!seen || typeof seen !== "object" || !seen.areas || typeof seen.areas !== "object") return out;
    const now = seenOf(spec, cleared), was = seen.areas, lv = seen.levels && typeof seen.levels === "object" ? seen.levels : {};
    for (const A of spec.areas) for (const r of levelRows(A, cleared).rows) if (r.state === "cleared" && lv[r.id] !== "cleared") out.push({ kind: "level", area: A.id, level: r.id, name: r.name });
    for (const A of spec.areas) { const a = now.areas[A.id], b = was[A.id]; if ((a === "open" || a === "won") && b !== "open" && b !== "won") out.push({ kind: "open", area: A.id, name: A.name }); }
    for (const A of spec.areas) if (now.areas[A.id] === "won" && was[A.id] !== "won") out.push({ kind: "won", area: A.id, name: A.name });
    return out;
  }
  // the scale on a screen (design pass 25 section 4.2, revision 1): the largest whole number of device pixels to a map pixel that fits
  // the sheet with 4 px of table at each side and 1 px above and below (spec.fit) into devW x devH device pixels
  function fit(devW, devH, spec) { spec = spec || SPEC; return Math.max(1, Math.floor(Math.min(devW / spec.fit.w, devH / spec.fit.h))); }

  const api = { SPEC, R, Layer, Room, rows, pawn, shade, banner, crow, ship, cloud, candlePiece, FLAME, FLAME_PAL, hash, bay, areaState, levelRows, levelUrl, tripAt, tripTime, lengthOf, hitAt, countryAt, shapeAt, coastX,
    sign, inkText, textW, meridianX, parallelY, lineDist, poly, COUNTRIES, CLOUDS, RIVER, LAKE, DEN, REVEAL_S, seenOf, changes, fit, version: 1 };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.MapTable = api;
})(typeof window !== "undefined" ? window : globalThis);
