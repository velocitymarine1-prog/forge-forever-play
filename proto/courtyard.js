// FORGE FOREVER: the Courtyard (design pass 24 with its revisions 1 and 2, and design pass 25's map table by the gate; built by
// build 17, card t79, design pass 26). The castle's inner yard at dusk, the game's hub: a room of the castle page
// (proto/the-forge.html), walked like the Training Cellar, with no weapons out. This file is the yard itself and nothing of the
// page: its painter, its standing pieces, its light, what moves in it, its zones, the way a tap finds its place, the walk and the
// camera. It is docs/design/24-courtyard.sketch.js moved into the game with its drawing code untouched (tools/test-courtyard.js
// holds its pixels to the sketch's), the yard's numbers as data (spec/courtyard.json, the sketch's SPEC), the folk in proto/folk.js,
// the map table (the map sketch's yardTable) where the signpost stood, and the walk on the game's one physics model.
//
// Everything is drawn in code by the house's rules (pass 2 section 3.2, pass 7): the ENDESGA 32 palette and the smithy's own stone
// and oak tones, shapes lit from the top left on four-tone ramps, a one-pixel soot outline, whole scales, the cellar's dithered
// firelight (Smithy.glow) for every lamp, and nothing moving under less motion but what the player moves. Seen the cellar's way: the
// north range as a wall face, the curtain walls on the west, east and south as their tops, the floor from above.
//   the north face: only the two main ways, the gate, Into the wild (left, its two oak doors cracked open on the world) and the Forge
//   (right, the smithy's own front), the keep and its banner between them, the map table beside the gate; the west: the Armory, the
//   castle's west range, its gable and door facing the yard; the east: the Training Cellar's stairs going down under the wall, and the
//   Training Yard's chained gate; the south: the market, Vorn's stall, the Armorer's stand (shut) and Nell's cart with Biscuit; the
//   middle: the well, where the daily coins wait (a glint).
//
//   Courtyard.SPEC                     spec/courtyard.json (window.FORGE_COURTYARD in the page)
//   const yard = new Courtyard.Yard()  the ground painted, the pieces made, the lights placed
//   yard.groundFrame(f, into, y0, y1)  the ground lit for flicker phase f (0 to 3) as RGBA; rows y0 to y1 only, into a buffer, when the
//                                      page bakes a phase in slices
//   yard.pieceFrame(P)                 a standing piece lit where it stands, as RGBA; yard.pieces are sorted with the folk and the
//                                      knight by their feet (P.sy)
//   yard.live(t, still, o)             what moves at time t: flames, smoke, sparks, the folk's poses, the hens' walk, the well's glint
//   yard.zoneAt(x, y)                  the place the feet stand in: a door, the map table, the well, a stall; or null
//   yard.tapAt(x, y)                   the place a tap on the world point hits (its tap box), or null; yard.targetOf(id) where to stand
//   yard.world(), yard.body(x, y)      the yard as Physics sees it (a level's world of its solids) and a knight's body for it
//   yard.step(k, vx, vy, dt)           one step of the walk through Physics.move; yard.free(x, y) whether feet can stand there
//   yard.path(x0, y0, tx, ty)          tap to go: A* on a 6 px grid of free cells, the turns only; .partial when the place can't be reached
//   yard.camera(cam, k, vw, vh, dt)    the view follows the feet with a dead zone, inside the yard; without dt it snaps
//   yard.settle(k)                     a knight on a blocked spot is put on the nearest free point
//   Courtyard.fit(frameW, frameH, paneW, paneH, dpr)   the view's size at the cellar's scale, for the page and the checks
//
// Pure: no DOM, no clock, no Math.random. Needs proto/smithy.js (the helpers); the walk needs proto/physics.js and the physics
// numbers of spec/combat.js. Plain script, defines window.Courtyard (module.exports in node).
(function (root) {
  "use strict";
  if (!root.Smithy && typeof module !== "undefined" && module.exports && typeof require === "function") require("./smithy.js");
  const S = root.Smithy;
  if (!S || !S.bricks) throw new Error("courtyard.js needs proto/smithy.js");
  const OUT = S.OUT, T = S.TONES, BAYER = S.BAYER, hex = S.hex;
  const bay = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  // a hash in [0, 1) for a cell, so the pattern is the same at every size and on every run
  const hash = (a, b, c) => { let h = (a * 374761393 + b * 668265263 + (c || 0) * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

  // ------------------------------------------------------------------ the yard's numbers: spec/courtyard.json
  // World pixels, y grows downward. Feet are what collide and what sort. A door's zone is walked into (dwell) or used with its prompt.
  const SPEC = root.FORGE_COURTYARD || (typeof module !== "undefined" && module.exports && typeof require === "function" ? require("../spec/courtyard.json") : null);
  if (!SPEC) throw new Error("courtyard.js: spec/courtyard.js is not loaded");

  const R = {
    stone: ["#2c2638", "#4a4458", "#555064", "#6e6a70"], slate: ["#181425", "#262b44", "#3a4466", "#5a6988"], oak: T.oak, iron: T.iron,
    straw: ["#be4a2f", "#d77643", "#feae34", "#fee761"], burlap: ["#733e39", "#b86f50", "#e4a672", "#ead4aa"], cream: ["#c28569", "#e4a672", "#ead4aa", "#fffaf0"],
    red: ["#a22633", "#e43b44", "#f6757a", "#ffd0c8"], plum: ["#3e2731", "#68386c", "#b55088", "#f6757a"], leaf: ["#193c3e", "#265c42", "#3e8948", "#63c74d"],
    skin: ["#b86f50", "#e8b796", "#ead4aa", "#ffffff"], hair: ["#5a6988", "#8b9bb4", "#c0cbdc", "#ffffff"], gold: ["#be4a2f", "#f77622", "#feae34", "#fee761"],
    navy: ["#181425", "#262b44", "#124e89", "#0099db"], rust: ["#5a3030", "#a22633", "#be4a2f", "#d77643"], coat: ["#3e2731", "#733e39", "#b86f50", "#e4a672"],
    leather: ["#2a1d28", "#3e2731", "#733e39", "#b86f50"], teal: ["#193c3e", "#265c42", "#124e89", "#0099db"], white: ["#8b9bb4", "#c0cbdc", "#ffffff", "#ffffff"],
    ginger: ["#733e39", "#be4a2f", "#f77622", "#feae34"], shawl: ["#2a1d28", "#3e2731", "#68386c", "#b55088"], steel: ["#3a4466", "#5a6988", "#8b9bb4", "#c0cbdc"]
  };
  // the twelve elements' flasks on Nell's cart, in the elements' own colours
  const FLASKS = ["#f77622", "#2ce8f5", "#fee761", "#63c74d", "#fffaf0", "#68386c", "#3e8948", "#b55088", "#0099db", "#b86f50", "#c0cbdc", "#a22633"];

  // ------------------------------------------------------------------ a painter over a W x H layer: a colour and whether lamps light it
  function Layer(w, h) { this.w = w; this.h = h; this.px = new Array(w * h).fill(null); this.lit = new Uint8Array(w * h); }
  Layer.prototype.set = function (x, y, c, l) { x = Math.round(x); y = Math.round(y); if (c && x >= 0 && y >= 0 && x < this.w && y < this.h) { this.px[y * this.w + x] = c; this.lit[y * this.w + x] = l === undefined ? 1 : l; } };
  Layer.prototype.get = function (x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.px[y * this.w + x] : null; };
  Layer.prototype.fill = function (x0, y0, x1, y1, f, l) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const c = typeof f === "function" ? f(x, y) : f; if (c) this.set(x, y, c, l); } };
  // a region lit from the top left (the house's rule): the ramp's light tone on its upper-left edge, its dark tone on its lower-right
  Layer.prototype.region = function (pred, ramp, o) {
    o = o || {}; const x0 = o.x0 || 0, y0 = o.y0 || 0, x1 = o.x1 === undefined ? this.w - 1 : o.x1, y1 = o.y1 === undefined ? this.h - 1 : o.y1;
    const m = (x, y) => pred(x + 0.5, y + 0.5);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (m(x, y)) {
      const ul = !m(x - 1, y) || !m(x, y - 1), dr = !m(x + 1, y) || !m(x, y + 1);
      let c = ul && dr ? ramp[1] : dr ? ramp[0] : ul ? ramp[2] : ramp[1];
      if (o.spec && o.spec(x, y)) c = ramp[3];
      if (o.tex) c = o.tex(x, y, c) || c;
      this.set(x, y, c, o.l);
    }
  };
  // the soot outline round whatever is drawn (on a sprite layer: every empty pixel beside a drawn one)
  Layer.prototype.outline = function (l) { const add = []; for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (!this.get(x, y) && (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1))) add.push([x, y]); for (const [x, y] of add) this.set(x, y, OUT, l); };
  const rect = (x0, y0, x1, y1) => (x, y) => x >= x0 && x <= x1 + 1 && y >= y0 && y <= y1 + 1;
  const ell = (cx, cy, rx, ry) => (x, y) => ((x - cx) ** 2) / (rx * rx) + ((y - cy) ** 2) / (ry * ry) <= 1.02;
  const poly = pts => (x, y) => { let inside = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside; } return inside; };
  const or = (...f) => (x, y) => f.some(g => g(x, y));
  const not = (a, b) => (x, y) => a(x, y) && !b(x, y);
  const seg = (x0, y0, x1, y1, r) => (x, y) => { const vx = x1 - x0, vy = y1 - y0, L = vx * vx + vy * vy; let t = L ? ((x - x0) * vx + (y - y0) * vy) / L : 0; t = Math.max(0, Math.min(1, t)); const dx = x - (x0 + t * vx), dy = y - (y0 + t * vy); return dx * dx + dy * dy <= r * r; };

  // ------------------------------------------------------------------ the ground: everything the knight is always in front of
  // the stone face of a building: big courses lit at the top, darker toward the floor
  function face(g, x0, x1, y0, y1, seed) {
    for (let y = y0; y < y1; y++) for (let x = x0; x <= x1; x++) {
      const row = Math.floor((y - y0) / 7), off = row % 2 ? 7 : 0, bx = Math.floor((x - x0 + off) / 14), h = hash(bx, row, seed);
      const inRow = (y - y0) % 7, inBrick = (x - x0 + off) % 14;
      let c = h < 0.3 ? "#4a4458" : h < 0.75 ? "#555064" : "#5c566a";
      if (inRow === 0) c = "#6e6a70"; else if (inRow === 6) c = "#2c2638"; else if (inBrick === 0) c = "#3a3448"; else if (inRow === 5) c = "#433d52";
      if (y > y1 - 10 && bay(x, y) < (y - (y1 - 10)) / 14) c = inRow === 6 ? "#231c2e" : "#3a3448";
      g.set(x, y, c, 1);
    }
  }
  function Ground(spec) {
    spec = spec || SPEC;
    const W = spec.w, H = spec.h, g = new Layer(W, H), N = spec.north, eaves = N.eaves, floorY = N.floor, east = spec.walls.east;
    this.spec = spec; this.W = W; this.H = H; this.layer = g;

    // the sky in the vista's dusk bands (the menu's own colours), the sun low on the left
    const SKY = ["#262b44", "#3a4466", "#68386c", "#b55088", "#f6757a", "#e4a672"];
    for (let y = 0; y < 44; y++) for (let x = 0; x < W; x++) {
      const t = y / 38 + (1 - x / W) * 0.18, f = t * (SKY.length - 1), i = Math.min(SKY.length - 2, Math.floor(f)), u = f - i;
      g.set(x, y, bay(x, y) < u ? SKY[Math.min(SKY.length - 1, i + 1)] : SKY[i], 0);
    }
    for (const [sx, sy] of [[40, 3], [131, 6], [209, 2], [377, 1], [455, 2], [530, 7], [602, 4]]) g.set(sx, sy, "#c0cbdc", 0);

    // the two wings: slate roofs over a stone face, a chimney each, windows lit and dark, a small banner
    const wings = [[16, 163], [509, east - 1]];
    for (const [x0, x1] of wings) {
      for (let y = N.ridge; y < eaves; y++) for (let x = x0; x <= x1; x++) {
        const row = Math.floor((y - N.ridge) / 4), off = (row % 2) * 3, sx = x - x0 + off, k = Math.floor(sx / 6);
        const h = hash(k, row, 7), top = (y - N.ridge) % 4 === 0, left = sx % 6 === 0;
        let c = h < 0.33 ? R.slate[1] : h < 0.8 ? R.slate[2] : "#30364e";
        if (top) c = R.slate[0]; else if (left) c = R.slate[1]; else if ((y - N.ridge) % 4 === 1) c = h < 0.5 ? R.slate[3] : R.slate[2];
        if (hash(k, row, 9) < 0.06 && !top) c = (x + y) % 2 ? "#265c42" : "#3e8948";
        g.set(x, y, c, 0);
      }
      g.fill(x0, N.ridge - 1, x1, N.ridge - 1, OUT, 0); g.fill(x0, N.ridge, x1, N.ridge, "#5a6988", 0);
      g.fill(x0, eaves, x1, eaves + 1, (x, y) => y === eaves ? OUT : "#1e1828", 0);
      face(g, x0, x1, eaves + 2, floorY, x0 + 3);
    }
    for (const cx of [108, 566]) { g.fill(cx, 4, cx + 8, N.ridge + 3, (x, y) => x === cx || x === cx + 8 || y === 4 ? OUT : (y - 4) % 4 === 3 ? "#3a3448" : x < cx + 3 ? "#6e6a70" : "#555064", 0); g.fill(cx - 1, 3, cx + 9, 4, (x, y) => y === 3 ? OUT : "#8b9bb4", 0); }
    this.smokes = [{ x: 112, y: 2 }, { x: 570, y: 2 }];
    this.windows = [];
    const win = (x, y, lit) => {
      g.fill(x - 1, y - 1, x + 6, y + 9, (xx, yy) => yy === y - 1 || xx === x - 1 || xx === x + 6 || yy === y + 9 ? OUT : null, 0);
      g.fill(x, y, x + 5, y + 8, (xx, yy) => { if (!lit) return yy < y + 2 ? "#262b44" : "#181425"; if (xx === x + 2 || yy === y + 4) return "#5a3030"; return (xx + yy) % 5 === 0 ? "#fee761" : yy < y + 3 ? "#feae34" : "#f77622"; }, 0);
      g.fill(x - 1, y + 9, x + 6, y + 10, (xx, yy) => yy === y + 9 ? "#8b9bb4" : "#3a3448", 1);
      if (lit) this.windows.push({ x: x + 3, y: y + 12 });
    };
    for (const [x, lit] of [[100, true], [130, false], [548, true], [584, false], [606, true]]) win(x, 50, lit);
    for (const bx of [146, 520]) { g.fill(bx - 1, 39, bx + 9, 40, (x, y) => y === 39 ? OUT : "#b86f50", 1); for (let y = 41; y < 68; y++) for (let x = bx; x <= bx + 8; x++) { if (y > 62 && Math.abs(x - bx - 4) < (y - 62) * 1.2) continue; g.set(x, y, x === bx || x === bx + 8 || y === 67 ? OUT : x === bx + 1 ? "#feae34" : (y === 52 && x > bx + 1 && x < bx + 7) || (x === bx + 4 && y > 48 && y < 57) ? "#fee761" : "#a22633", 1); } }

    // the keep between the two ways, and the two main ways (revision 1: the gate on the left, the Forge on the right; revision 2: the
    // gate smaller, its doors cracked open)
    keepMiddle(g, 252, 388, floorY);
    this.gate = gateFront(g, 164, 252, floorY);
    this.forge = forgeFront(g, 388, 508, floorY);
    g.fill(16, floorY - 1, east - 1, floorY - 1, (x) => { const c = g.get(x, floorY - 1); return c === "#8b9bb4" || c === "#c0cbdc" || c === "#e4a672" || c === "#b86f50" || c === "#feae34" || c === "#fee761" ? null : "#231c2e"; }, 1);

    // ---- the floor: cobbles from above, worn paths from the well to every way, the road's dirt at the gate, earth by the market
    this.paths = [
      seg(304, 166, 208, 102, 9), seg(336, 166, 448, 102, 9), seg(300, 186, 56, 234, 7), seg(342, 178, 566, 175, 7), seg(340, 190, 606, 244, 7),
      seg(304, 194, 242, 240, 6), seg(242, 240, 242, 326, 6), seg(336, 194, 412, 240, 6), seg(412, 240, 412, 326, 6), seg(96, 326, 600, 326, 7)
    ];
    const onPath = (x, y) => { const j = (hash(x >> 2, y >> 2, 21) - 0.5) * 3; for (const p of this.paths) if (p(x + j, y + j * 0.6)) return true; const d = Math.hypot(x - 320, (y - 180) * 1.25); return d > 18 && d < 30 + j; };
    const road = (x, y) => y < 138 && Math.abs(x + 0.5 - 208) < 14 - (y - floorY) * 0.22 + (hash(x >> 2, y >> 2, 23) - 0.5) * 3;
    const earth = (x, y) => { const j = hash(x >> 3, y >> 3, 31) * 6; return Math.hypot(x - 464, (y - 308) * 1.5) < 30 + j || (y > 314 && x > 92 && x < 600 && hash(x >> 3, y >> 2, 33) < 0.35) || Math.hypot(x - 48, (y - 322) * 1.3) < 26 + j; };
    for (let y = floorY; y < H; y++) for (let x = 16; x < east; x++) {
      const path = onPath(x, y), big = path ? [9, 6] : [7, 5];
      const cw = big[0], ch = big[1], gx = Math.floor(x / cw), gy = Math.floor(y / ch);
      let d1 = 1e9, d2 = 1e9, best = null;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const cx = gx + i, cy = gy + j, px = (cx + 0.2 + hash(cx, cy, path ? 41 : 43) * 0.6) * cw, py = (cy + 0.2 + hash(cx, cy, path ? 42 : 44) * 0.6) * ch;
        const d = Math.hypot(x + 0.5 - px, (y + 0.5 - py) * 1.15);
        if (d < d1) { d2 = d1; d1 = d; best = [cx, cy, px, py]; } else if (d < d2) d2 = d;
      }
      const edge = d2 - d1, h = hash(best[0], best[1], 47);
      let c;
      if (road(x, y)) { const rut = Math.abs(Math.abs(x + 0.5 - 208) - 6) < 1.1; c = rut ? "#3e2731" : (x * 7 + y * 3) % 11 === 0 ? "#5a3a3a" : h < 0.5 ? "#4f3537" : "#5a3a3a"; }
      else if (earth(x, y) && h < 0.62) c = edge < 1.2 ? "#2a1d28" : (x + y * 3) % 7 === 0 ? "#4f3537" : h < 0.3 ? "#3e2731" : "#45303a";
      else if (edge < 1.1) c = path ? "#3a3346" : "#2a2336";
      else {
        const dx = x + 0.5 - best[2], dy = y + 0.5 - best[3];
        const tones = path ? ["#4f4a5e", "#5c566a", "#625c6e"] : ["#433d52", "#4a4458", "#47425a"];
        c = tones[Math.floor(h * 3) % 3];
        if (dx + dy < -2.6 && edge < 2.6) c = path ? "#7a7484" : "#5c566a";
        else if (dx + dy > 2.4 && edge < 2.4) c = path ? "#433d52" : "#35304a";
      }
      g.set(x, y, c, 1);
    }
    // grass and weeds along the walls' feet and the corners, in dusk greens
    for (let i = 0; i < 250; i++) {
      const side = hash(i, 1, 61), t = hash(i, 2, 62);
      let x, y;
      if (side < 0.36) { x = 18 + Math.floor(t * (W - 38)); y = floorY + 1 + Math.floor(hash(i, 3, 63) * 5); }
      else if (side < 0.52) { x = 17 + Math.floor(hash(i, 3, 63) * 6); y = floorY + Math.floor(t * (H - floorY - 16)); }
      else if (side < 0.68) { x = east - 8 + Math.floor(hash(i, 3, 63) * 6); y = floorY + Math.floor(t * (H - floorY - 16)); }
      else if (side < 0.84) { x = 18 + Math.floor(t * (W - 38)); y = spec.walls.south - 8 + Math.floor(hash(i, 3, 63) * 6); }
      else { const c = Math.floor(hash(i, 4, 64) * 4), cx = [26, east - 10, 26, east - 10][c], cy = [104, 104, H - 26, H - 26][c]; x = cx + Math.floor((hash(i, 5, 65) - 0.5) * 22); y = cy + Math.floor((hash(i, 6, 66) - 0.5) * 12); }
      if (onPath(x, y) || road(x, y)) continue;
      const tall = hash(i, 7, 67) < 0.4, flower = hash(i, 8, 68) < 0.08;
      g.set(x, y, "#265c42"); g.set(x - 1, y - 1, "#3e8948"); g.set(x + 1, y - 1, "#265c42"); if (tall) { g.set(x, y - 2, "#3e8948"); g.set(x + 1, y - 3, "#63c74d"); }
      if (flower) g.set(x, y - 3, hash(i, 9, 69) < 0.5 ? "#fee761" : "#f6757a");
    }

    // ---- the curtain walls, seen from above (the cellar's side walls): a walkway, merlons on the outer edge, a lit inner rim
    const top = (d) => d === 0 ? "#8b9bb4" : d === 1 ? "#6e6a70" : d % 4 === 2 ? "#4a4458" : "#555064";
    for (let y = eaves + 2; y < H; y++) {
      for (let x = 0; x < 16; x++) g.set(x, y, x < 4 ? (Math.floor(y / 6) % 2 ? "#6e6a70" : "#2c2638") : (y % 9 === 0 && x > 5 ? "#3a3448" : top(15 - x)), 0);
      for (let x = east; x < W; x++) g.set(x, y, x > W - 5 ? (Math.floor(y / 6) % 2 ? "#6e6a70" : "#2c2638") : (y % 9 === 4 && x < W - 6 ? "#3a3448" : top(x - east)), 0);
      g.set(16, y, OUT, 0); g.set(east - 1, y, OUT, 0);
    }
    for (let y = spec.walls.south; y < H; y++) for (let x = 0; x < W; x++) g.set(x, y, y > H - 5 ? (Math.floor(x / 6) % 2 ? "#6e6a70" : "#2c2638") : (x % 11 === 3 && y > spec.walls.south + 1 ? "#3a3448" : top(y - spec.walls.south)), 0);
    g.fill(17, spec.walls.south - 1, east - 2, spec.walls.south - 1, OUT, 0);

    // ---- the west: the Armory, the castle's west range (revision 2), its roof one with the north wing's, its gable and door facing the yard
    this.armory = armoryRange(g, 16, 84, eaves, 158, 176, 222);
    // ---- the east: the Training Cellar's stairs going down into the wall, and the Training Yard's chained gate
    this.cellar = cellarStairs(g, 560, east, spec.doors.cellar.y0, spec.doors.cellar.y1);
    const yd = spec.doors.yard;
    for (let y = yd.y0; y <= yd.y1; y++) for (let x = east; x < W; x++) g.set(x, y, x < east + 3 ? "#2a2336" : x < east + 11 ? ((y - yd.y0) % 6 === 0 ? "#3e2731" : (y - yd.y0) % 12 < 6 ? "#733e39" : "#5a3a3a") : "#1e1828", 0);
    for (const y of [yd.y0 + 7, yd.y1 - 7]) g.fill(east + 3, y, east + 10, y + 1, (x, yy) => yy === y ? "#8b9bb4" : "#3a4466", 0);
    for (let y = yd.y0 + 2; y <= yd.y1 - 2; y += 3) { g.set(east - 2, y, "#8b9bb4", 1); g.set(east - 2, y + 1, "#3a4466", 1); g.set(east - 3, y + 1, OUT, 1); }
    g.fill(east - 5, yd.y0 + 15, east - 2, yd.y0 + 19, (x, y) => x === east - 5 || y === yd.y0 + 19 ? OUT : y === yd.y0 + 15 ? "#fee761" : "#feae34", 1);
    for (const y of [yd.y0 - 1, yd.y1 + 1]) g.fill(east - 1, y, W - 5, y, OUT, 0);
    for (let y = yd.y0 - 9; y <= yd.y0 - 3; y++) for (let x = east + 2; x <= east + 12; x++) { const d = Math.hypot(x - east - 7, y - (yd.y0 - 6)); if (d <= 3.6) g.set(x, y, d > 2.8 ? "#e43b44" : d > 1.8 ? "#ffffff" : d > 0.9 ? "#e43b44" : "#ffffff", 0); }
  }

  // the keep between the gate and the Forge: stone to the top of the world, merlons, arrow slits, the castle's banner (a gold anvil
  // on red in a gold border, a swallowtail)
  function keepMiddle(g, x0, x1, floorY) {
    face(g, x0, x1, 8, floorY, 11);
    for (let x = x0; x <= x1; x++) { const merlon = Math.floor((x - x0) / 7) % 2 === 0; for (let y = 0; y < 8; y++) { if (!merlon && y < 4) continue; g.set(x, y, y === 0 || (!merlon && y === 4) ? "#8b9bb4" : x === x0 || x === x1 ? OUT : y === 7 ? "#2c2638" : "#6e6a70", 0); } }
    for (const x of [x0 + 8, x1 - 10]) g.fill(x, 24, x + 2, 36, (xx, yy) => xx === x || yy === 24 ? OUT : yy < 28 ? "#f77622" : "#5a3030", 0);
    const cx = Math.round((x0 + x1) / 2), bx0 = cx - 12, bx1 = cx + 12, by0 = 14, by1 = 46;
    for (let y = by0; y <= by1 + 5; y++) for (let x = bx0; x <= bx1; x++) {
      const tail = y > by1 && Math.abs(x - (bx0 + bx1) / 2) < (y - by1) * 2.4; if (tail) continue;
      const edge = x === bx0 || x === bx1 || y === by0 || (y >= by1 && (y === by1 + 5 || Math.abs(x - (bx0 + bx1) / 2) >= (y + 1 - by1) * 2.4));
      g.set(x, y, edge ? OUT : x === bx0 + 1 || x === bx1 - 1 || y === by0 + 1 ? "#feae34" : (x + y) % 9 === 0 ? "#a22633" : x < bx0 + 4 ? "#e43b44" : "#a22633", 1);
    }
    g.fill(bx0 - 2, by0 - 2, bx1 + 2, by0 - 1, (x, y) => y === by0 - 2 ? OUT : "#b86f50", 1);
    const ax = cx, ay = 27;
    for (const [dx0, dx1, dy] of [[-7, 5, 0], [-5, 5, 1], [-2, 3, 2], [-2, 3, 3], [-4, 5, 4], [-5, 6, 5]]) for (let dx = dx0; dx <= dx1; dx++) g.set(ax + dx, ay + dy, dy === 0 ? "#fee761" : dx === dx1 ? "#be4a2f" : "#feae34", 1);
    for (let y = 0; y < floorY; y++) { g.set(x0 - 1, y, OUT, 0); g.set(x1 + 1, y, OUT, 0); }
  }
  // the gate, Into the wild (revision 2: smaller, its two oak doors cracked open): two round towers with pennants, the gatehouse wall
  // between them, the arch with its portcullis drawn up, and in it the gate's two great leaves standing a little open; through the gap
  // the world: the evening sky, the sun going down, the hills, the road running away; the gold light from the gap laid on the cobbles
  function gateFront(g, x0, x1, floorY) {
    const tw = 20, T1 = [x0, x0 + tw], T2 = [x1 - tw, x1], a0 = x0 + tw + 3, a1 = x1 - tw - 3, top = 52, spring = 64, hz = 72;
    for (let y = 22; y < floorY; y++) for (let x = T1[1] + 1; x <= T2[0] - 1; x++) {
      if (y < 28) { const merlon = Math.floor((x - T1[1]) / 6) % 2 === 0; if (!merlon && y < 25) continue; g.set(x, y, y === 22 || (!merlon && y === 25) ? "#8b9bb4" : y === 27 ? "#2c2638" : "#6e6a70", 0); continue; }
      const row = Math.floor((y - 28) / 7), off = row % 2 ? 7 : 0, h = hash(Math.floor((x - x0 + off) / 14), row, 151), inRow = (y - 28) % 7, inB = (x - x0 + off) % 14;
      g.set(x, y, inRow === 0 ? "#6e6a70" : inRow === 6 ? "#2c2638" : inB === 0 ? "#3a3448" : h < 0.5 ? "#4a4458" : "#555064", 1);
    }
    for (const [tx0, tx1] of [T1, T2]) {
      for (let y = 10; y < floorY; y++) for (let x = tx0; x <= tx1; x++) {
        const u = (x - tx0) / (tx1 - tx0);
        if (y < 16) { const merlon = Math.floor((x - tx0) / 4) % 2 === 0; if (!merlon && y < 13) continue; g.set(x, y, x === tx0 || x === tx1 ? OUT : y === 10 || (!merlon && y === 13) ? "#8b9bb4" : u < 0.3 ? "#8b9bb4" : "#6e6a70", 0); continue; }
        const row = Math.floor((y - 16) / 6), inRow = (y - 16) % 6, off = (row % 2) * 4, joint = inRow === 5 || (x - tx0 + off) % 8 === 0;
        let c = u < 0.18 ? "#8b9bb4" : u < 0.4 ? "#6e6a70" : u < 0.75 ? "#555064" : u < 0.9 ? "#4a4458" : "#3a3448";
        if (joint) c = u < 0.4 ? "#555064" : "#2c2638";
        if (x === tx0 || x === tx1) c = OUT;
        g.set(x, y, c, 1);
      }
      const sx = Math.round((tx0 + tx1) / 2);
      g.fill(sx - 1, 34, sx + 1, 44, (x, y) => x === sx - 1 || y === 34 ? OUT : y < 37 ? "#f77622" : "#5a3030", 0);
      for (let y = 4; y < 11; y++) g.set(sx, y, "#5a6988", 0);
      for (let y = 4; y < 7; y++) for (let x = sx + 1; x <= sx + 6 - (y - 4) * 2; x++) g.set(x, y, y === 5 && x < sx + 3 ? "#feae34" : "#e43b44", 0);
    }
    const cx = (a0 + a1 + 1) / 2, hw = (a1 - a0 + 1) / 2, gap = 5;
    const inOpen = (x, y, e) => { e = e || 0; const dx = x + 0.5 - cx; if (Math.abs(dx) > hw + e || y >= floorY || y < top - e) return false; if (y >= spring) return true; return (dx / (hw + e)) ** 2 + ((y + 0.5 - spring) / (spring - top + e)) ** 2 <= 1; };
    for (let y = top - 6; y < floorY; y++) for (let x = a0 - 6; x <= a1 + 6; x++) {
      if (inOpen(x, y)) {
        const dx = x + 0.5 - cx, ad = Math.abs(dx);
        let c, l = 0;
        if (ad <= gap) {
          // the world through the gap: the sky's bands, the sun going down, the hills, the road running away through the grass
          if (y < hz) {
            const SK = ["#68386c", "#b55088", "#f6757a", "#e4a672", "#feae34"], t = (y - top) / (hz - top) * (SK.length - 1), i = Math.min(SK.length - 2, Math.floor(t));
            c = bay(x, y) < t - i ? SK[i + 1] : SK[i];
            if (Math.hypot(x + 0.5 - (cx - 2), y + 0.5 - (hz - 2)) < 4) c = "#fee761";
            const hill = hz - 3 - Math.round(2 * Math.sin(x / 3)); if (y >= hill) c = y === hill ? "#5a3030" : "#3e2731";
          } else {
            const depth = (y - hz) / (floorY - hz), half = 0.8 + depth * 4.2;
            c = ad < half ? (Math.abs(ad - half * 0.55) < 0.6 ? "#733e39" : bay(x, y) < 0.85 - depth * 0.5 ? "#e4a672" : "#b86f50") : (bay(x, y) < 0.45 - depth * 0.3 ? "#3e8948" : depth > 0.55 ? "#193c3e" : "#265c42");
          }
        } else {
          // a leaf: oak planks and three iron bands, swung a little in (darker toward the gap), its edge at the gap lit gold
          const u = (ad - gap) / (hw - gap), plank = Math.floor((ad - gap) / 5), inPl = (ad - gap) % 5;
          c = u < 0.3 ? "#5a3030" : (plank % 2 ? "#733e39" : "#6b3a36");
          if (inPl < 1) c = "#3e2731";
          const band = [top + 14, spring + 12, floorY - 10].some(b => y === b || y === b + 1);
          if (band) c = (y % 2 === 0) ? "#5a6988" : "#3a4466";
          if (band && Math.round(ad) % 4 === 0) c = "#8b9bb4";
          if (ad - gap < 1.2) c = "#feae34"; else if (ad - gap < 2) c = "#be4a2f";
          if (u > 0.92) c = "#2a1d28";
          l = 1;
        }
        // the portcullis drawn up into the crown: its iron teeth
        if (!inOpen(x, y - 4) && inOpen(x, y)) { c = (x % 4 === 0) ? "#8b9bb4" : "#262b44"; l = 0; }
        g.set(x, y, c, l);
      } else if (inOpen(x, y, 4)) {
        const ang = Math.atan2(y + 0.5 - spring, x + 0.5 - cx), segN = y < spring ? Math.floor((ang + Math.PI) / (Math.PI / 9)) : Math.floor((y - spring) / 6);
        const outer = !inOpen(x - 1, y, 4) || !inOpen(x, y - 1, 4);
        g.set(x, y, outer ? "#8b9bb4" : segN % 2 ? "#555064" : "#6e6a70", 1);
      } else if (inOpen(x, y, 5)) g.set(x, y, OUT, 1);
    }
    // the ring handles, one on each leaf beside the gap
    for (const hx of [Math.round(cx) - gap - 5, Math.round(cx) + gap + 4]) for (const [dx, dy, c] of [[0, 0, "#8b9bb4"], [1, 0, "#5a6988"], [-1, 1, "#8b9bb4"], [2, 1, "#3a4466"], [0, 2, "#5a6988"], [1, 2, "#262b44"]]) g.set(hx + dx, 79 + dy, c, 1);
    // the castle's shield over the keystone
    const kx = Math.round(cx), ky = 32;
    for (let y = ky; y <= ky + 11; y++) for (let x = kx - 6; x <= kx + 6; x++) {
      const w = y < ky + 6 ? 6 : 6 - (y - ky - 6) * 1.1; if (Math.abs(x + 0.5 - kx - 0.5) > w) continue;
      const edge = Math.abs(x + 0.5 - kx - 0.5) > w - 1 || y === ky;
      g.set(x, y, edge ? "#feae34" : y < ky + 3 || (x === kx && y < ky + 8) ? "#fee761" : "#a22633", 1);
    }
    return { a0, a1, top, cx, gap };
  }
  // the Forge from outside (revision 1: on the north face, drawn from its left edge x0): the smithy's own bricks between oak posts under an oak beam, a gable of oak
  // boards with a round vent glowing, the chimney stack red-hot at its mouth, the door open on the hearth (the fire at the back, the
  // anvil's shape against it, the floor in its light), the FORGE board on the beam, the anvil on a hanging sign, a quench barrel
  function forgeFront(g, x0, x1, floorY) {
    const beamY = 40, apex = 6, cx = Math.round((x0 + x1) / 2), halfW = (x1 - x0) / 2;
    // the gable: oak boards inside the bargeboards, slates beyond them, a soot outline
    for (let y = apex; y < beamY; y++) for (let x = x0 - 2; x <= x1 + 2; x++) {
      const half = (y - apex) / (beamY - apex) * halfW, ad = Math.abs(x + 0.5 - cx - 0.5);
      if (ad > half + 4) continue;
      let c;
      if (ad > half + 3) c = OUT;
      else if (ad > half + 1) c = ad > half + 2 ? "#262b44" : "#3a4466";
      else if (ad > half - 2) c = ad > half - 0.5 ? "#3e2731" : "#b86f50";
      else c = (x - x0) % 5 === 0 ? "#2a1d28" : (x * 3 + y) % 23 === 0 ? T.oakKnot : (x - x0) % 5 === 1 ? "#5a3030" : "#4a2a2e";
      g.set(x, y, c, 1);
    }
    // the round vent, the heat glowing between its slats
    const vx = cx, vy = 24;
    for (let y = vy - 7; y <= vy + 7; y++) for (let x = vx - 7; x <= vx + 7; x++) { const d = Math.hypot(x + 0.5 - vx - 0.5, y + 0.5 - vy - 0.5); if (d > 6.6) continue; g.set(x, y, d > 5.6 ? OUT : d > 4.4 ? (x + y < vx + vy ? "#8b9bb4" : "#3a4466") : (y - vy) % 2 === 0 ? "#262b44" : bay(x, y) < 0.6 ? "#f77622" : "#be4a2f", 0); }
    // the beam and the posts (the smithy's own)
    g.fill(x0 - 2, beamY, x1 + 2, beamY + 5, (x, y) => y === beamY ? OUT : y === beamY + 1 ? T.oak[2] : y === beamY + 5 ? T.oak[0] : (x * 3 + y * 7) % 13 === 0 ? T.oakKnot : T.oak[1], 1);
    // the face: the smithy's bricks, as inside, painted on a painter kept to the face
    const clip = { set: (x, y, c, l) => { if (x >= x0 && x <= x1 && y > beamY + 5 && y < floorY) g.set(x, y, c, l === undefined ? 1 : l); } };
    clip.fill = (fx0, fy0, fx1, fy1, f) => { for (let y = fy0; y <= fy1; y++) for (let x = fx0; x <= fx1; x++) { const c = typeof f === "function" ? f(x, y) : f; if (c) clip.set(x, y, c); } };
    S.bricks(clip, S.rng(2410), 576, beamY + 6, floorY);
    for (const px of [x0, x1 - 6]) g.fill(px, beamY + 6, px + 6, floorY - 1, (x, y) => x === px ? OUT : x === px + 1 ? T.oak[2] : x === px + 6 ? T.oak[0] : (y * 5 + x) % 17 === 0 ? T.oakKnot : T.oak[1], 1);
    // the door, open on the hearth
    const d0 = x0 + 40, d1 = x0 + 80, dTop = 54, i0 = d0 + 4, i1 = d1 - 4, iTop = dTop + 5;
    for (let y = iTop; y < floorY; y++) for (let x = i0; x <= i1; x++) {
      const hx = (i0 + i1) / 2, fire = Math.hypot((x + 0.5 - hx) * 0.9, y + 0.5 - 76), b = bay(x, y);
      let c = y < iTop + 4 ? "#120e1a" : "#1e1828";
      if (fire < 13) c = fire < 5 ? (b < 0.6 ? "#fee761" : "#feae34") : fire < 9 ? (b < 0.5 ? "#feae34" : "#f77622") : b < 0.5 ? "#be4a2f" : "#5a3030";
      if (y >= floorY - 6) c = b < 0.7 - (floorY - 1 - y) * 0.08 ? "#be4a2f" : "#733e39";
      if (x <= i0 + 2 || x >= i1 - 2) c = x === i0 || x === i1 ? OUT : "#733e39";   // the door's two leaves, swung in
      g.set(x, y, c, 0);
    }
    for (const [ax0, ax1, y] of [[50, 70, 83], [53, 67, 84], [57, 63, 85], [57, 63, 86], [55, 65, 87], [54, 66, 88]]) for (let x = x0 + ax0; x <= x0 + ax1; x++) g.set(x, y, "#181425", 0);
    for (let y = dTop; y < floorY; y++) for (let x = d0; x <= d1; x++) {
      if (x >= i0 && x <= i1 && y >= iTop) continue;
      const lintel = y < iTop, edge = x === d0 || x === d1 || y === dTop;
      const stud = (lintel && y === dTop + 2 && (x - d0) % 6 === 3) || (!lintel && (x === d0 + 2 || x === d1 - 1) && (y - iTop) % 7 === 3);
      g.set(x, y, edge ? OUT : stud ? "#8b9bb4" : lintel ? (y === dTop + 1 ? T.oak[2] : y === iTop - 1 ? T.oak[0] : T.oak[1]) : x === d0 + 1 ? T.oak[2] : x === d1 - 1 ? T.oak[0] : T.oak[1], 1);
    }
    g.fill(d0 - 1, floorY - 1, d1 + 1, floorY - 1, (x) => x === d0 - 1 || x === d1 + 1 ? OUT : "#e4a672", 0);
    // the FORGE board on the beam
    for (let y = beamY + 3; y <= beamY + 13; y++) for (let x = x0 + 45; x <= x0 + 75; x++) g.set(x, y, x === x0 + 45 || x === x0 + 75 || y === beamY + 3 || y === beamY + 13 ? OUT : y === beamY + 4 ? "#e4a672" : y === beamY + 12 ? "#3e2731" : (x * 5 + y) % 19 === 0 ? T.oakKnot : "#733e39", 1);
    letters((x, y, c, l) => g.set(x, y, c, l), "FORGE", x0 + 51, beamY + 6, "#fee761", "#3e2731");
    // the anvil on its hanging sign, on an iron arm right of the door
    const sx = x0 + 87, sy = 60;
    for (let x = d1 + 1; x <= sx + 15; x++) { g.set(x, sy - 4, "#5a6988", 1); g.set(x, sy - 3, "#262b44", 1); }
    for (const hx of [sx + 2, sx + 13]) { g.set(hx, sy - 2, "#8b9bb4", 1); g.set(hx, sy - 1, "#5a6988", 1); }
    for (let y = sy; y <= sy + 13; y++) for (let x = sx; x <= sx + 15; x++) g.set(x, y, x === sx || x === sx + 15 || y === sy || y === sy + 13 ? OUT : y === sy + 1 ? "#e4a672" : x === sx + 1 ? "#b86f50" : "#733e39", 1);
    for (const [a, b, dy] of [[2, 12, 4], [3, 12, 5], [6, 9, 6], [6, 9, 7], [5, 10, 8], [4, 11, 9]]) for (let x = a; x <= b; x++) g.set(sx + x, sy + dy, dy === 4 ? "#ffffff" : x === b ? "#3a4466" : dy === 5 ? "#c0cbdc" : "#8b9bb4", 1);
    // the quench barrel by the door, tongs leaning on the wall
    const bx = x0 + 16;
    for (let y = 78; y < floorY; y++) for (let x = bx; x <= bx + 14; x++) g.set(x, y, x === bx || x === bx + 14 || y === floorY - 1 ? OUT : (y - 78) % 5 === 1 ? "#5a6988" : x < bx + 4 ? "#b86f50" : x > bx + 10 ? "#3e2731" : "#733e39", 1);
    g.fill(bx + 1, 78, bx + 13, 79, (x, y) => y === 78 ? "#2ce8f5" : "#0099db", 0);
    for (let i = 0; i < 22; i++) { g.set(x0 + 33 + (i >> 3), 66 + i, "#5a6988", 1); g.set(x0 + 34 + (i >> 3), 66 + i, "#262b44", 1); }
    // the chimney: a stone stack beside the gable, its mouth red-hot
    const c0 = x0 + 6, c1 = x0 + 26, cTop = 10, cMouth = 16;
    for (let y = cTop; y <= beamY + 3; y++) for (let x = c0; x <= c1; x++) {
      const e = x === c0 || x === c1 || y === cTop;
      let c;
      if (e) c = OUT;
      else if (y < cMouth) c = x > c0 + 2 && x < c1 - 2 && y > cTop + 1 ? (bay(x, y) < 0.45 ? "#fee761" : bay(x, y) < 0.8 ? "#f77622" : "#be4a2f") : (y === cTop + 1 ? "#8b9bb4" : "#6e6a70");
      else { const row = Math.floor((y - cMouth) / 5), off = row % 2 ? 4 : 0; c = (y - cMouth) % 5 === 0 ? "#2c2638" : (x - c0 + off) % 8 === 0 ? "#3a3448" : x < c0 + 4 ? "#6e6a70" : "#555064"; }
      g.set(x, y, c, y < cMouth ? 0 : 1);
    }
    return { x0, x1, door: { x0: d0, x1: d1, y0: dTop, y1: floorY - 1 }, chimney: { x: Math.round((c0 + c1) / 2), y: cTop + 2 } };
  }
  // the Armory (revision 2: the castle's west range): its slate roof runs down the west wall from the north wing's eave, so the two wings
  // meet in one roof at the corner; its south end is a stone gable with the crossed swords on it, and the Forge's old Armory door is in
  // the face below, facing the yard
  function armoryRange(g, x0, x1, roofTop, gableTop, faceTop, floorY) {
    const ridgeX = Math.round((x0 + x1) / 2);
    // the roof from above: courses of slate running down its length (parallel to its eaves), the west slope in the light, the east slope
    // toward the yard in shadow, the joints between slates staggered course to course, a little moss, the ridge's capping
    for (let y = roofTop; y < faceTop; y++) for (let x = x0; x <= x1; x++) {
      const westSide = x < ridgeX, d = Math.abs(x - ridgeX), course = Math.floor(d / 4), inCourse = d % 4, jy = y - roofTop + (course % 2) * 3;
      const h = hash(course * (westSide ? -1 : 1), Math.floor(jy / 6), 141);
      let c = westSide ? (h < 0.5 ? "#4a5878" : h < 0.85 ? "#465474" : "#3a4466") : (h < 0.5 ? "#262b44" : "#30364e");
      if (inCourse === 3) c = westSide ? "#3a4466" : "#181425";
      else if (jy % 6 === 0) c = westSide ? "#3a4466" : "#1e1828";
      else if (inCourse === 0 && westSide && h < 0.25) c = "#5a6988";
      if (hash(course, Math.floor(jy / 6), 143) < 0.04 && inCourse !== 3) c = (x + y) % 2 ? "#265c42" : "#3e8948";
      if (x === ridgeX) c = "#8b9bb4"; if (x === ridgeX + 1) c = "#262b44";
      if (x === x1) c = OUT;
      g.set(x, y, c, westSide ? 1 : 0);
    }
    // the eave's shadow on the cobbles along the yard side
    for (let y = 96; y < floorY; y++) for (let x = x1 + 2; x <= x1 + 4; x++) if (bay(x, y) < (x1 + 5 - x) / 4) { const c0 = g.get(x, y); if (c0 && c0 !== OUT) g.set(x, y, "#231c2e", 1); }
    for (let x = x0; x <= x1; x++) { g.set(x, roofTop, OUT, 0); g.set(x, roofTop + 1, "#1e1828", 0); }   // the valley where the two roofs meet
    // the gable: stone in small courses inside oak bargeboards, the crossed swords on it
    for (let y = gableTop; y < faceTop; y++) for (let x = x0; x <= x1 + 1; x++) {
      const half = (y - gableTop + 1) / (faceTop - gableTop) * ((x1 - x0) / 2 + 1), ad = Math.abs(x + 0.5 - ridgeX - 0.5);
      if (ad > half + 2) continue;
      let c;
      if (ad > half + 1) c = OUT; else if (ad > half - 1) c = ad > half ? "#3e2731" : "#b86f50";
      else { const row = Math.floor((y - gableTop) / 4), joint = (y - gableTop) % 4 === 3 || (x + row * 3) % 8 === 0; c = joint ? "#3a3448" : hash(x >> 3, row, 147) < 0.5 ? "#555064" : "#5c566a"; }
      g.set(x, y, c, 1);
    }
    crossedSwords(g, ridgeX, gableTop + 6);
    face(g, x0, x1, faceTop, floorY, 23);
    g.fill(x0, faceTop, x1, faceTop + 1, (x, y) => y === faceTop ? OUT : "#1e1828", 1);
    for (let y = roofTop; y < floorY; y++) g.set(x1 + 1, y, OUT, 1);
    g.fill(x0, floorY - 1, x1, floorY - 1, (x) => { const c = g.get(x, floorY - 1); return c === "#8b9bb4" ? null : "#231c2e"; }, 1);
    return armoryDoor(g, x0 + 13, x0 + 55, faceTop + 4, floorY - 1);
  }
  // the Training Cellar's way down (revision 1: on the east): stairs sunk in the floor going down toward the east wall and under it, a
  // stone rim on each side, the bulkhead's two oak leaves flung open and lying flat on the cobbles, the way in dark under the wall
  function cellarStairs(g, x0, x1, y0, y1) {
    for (const [ly0, ly1] of [[y0 - 15, y0 - 5], [y1 + 5, y1 + 15]]) for (let y = ly0; y <= ly1; y++) for (let x = x0 + 6; x <= x0 + 40; x++) {
      const e = x === x0 + 6 || x === x0 + 40 || y === ly0 || y === ly1, strap = (x - x0) % 12 === 4;
      g.set(x, y, e ? OUT : strap ? "#3a4466" : (x - x0) % 6 === 0 ? "#3e2731" : y === ly0 + 1 ? "#e4a672" : "#b86f50", 1);
    }
    for (const [ry0, ry1] of [[y0 - 4, y0 - 1], [y1 + 1, y1 + 4]]) for (let y = ry0; y <= ry1; y++) for (let x = x0; x < x1; x++) g.set(x, y, y === ry0 ? "#8b9bb4" : y === ry1 ? "#2c2638" : (x - x0) % 7 === 0 ? "#3a3448" : "#6e6a70", 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x < x1; x++) {
      const d = x - x0, step = Math.floor(d / 6), inStep = d % 6;
      let c;
      if (x >= x1 - 14) c = T.dark;
      else if (inStep === 0) c = step === 0 ? "#c0cbdc" : S.STEP_LIT[Math.min(4, step)];
      else c = S.STEP_FILL[Math.min(4, step)];
      if (y === y0 || y === y1) c = step < 3 ? "#2c2638" : "#181425";
      g.set(x, y, c, d < 14 ? 1 : 0);
    }
    // the arch over the way in, in the east wall's top: its stones round the dark mouth
    for (let y = y0 - 3; y <= y1 + 3; y++) for (let x = x1 - 16; x < x1; x++) { if (y >= y0 && y <= y1 && x >= x1 - 14) continue; if (y < y0 || y > y1) g.set(x, y, (x + y) % 5 === 0 ? "#3a3448" : "#8b9bb4", 0); }
    // the straw dummy's face on a board on the wall's top beside it
    g.fill(x1 + 2, y0 - 13, x1 + 14, y0 - 4, (x, y) => x === x1 + 2 || x === x1 + 14 || y === y0 - 13 || y === y0 - 4 ? OUT : y === y0 - 12 ? "#e4a672" : "#b86f50", 0);
    g.region(ell(x1 + 8.5, y0 - 8.5, 3.2, 3), R.burlap, { x0: x1 + 4, y0: y0 - 12, x1: x1 + 12, y1: y0 - 5, l: 0 }); g.set(x1 + 8, y0 - 9, "#e43b44", 0);
    return { x0, x1, y0, y1 };
  }

  function armoryDoor(g, x0, x1, top, bot) {
    const oak = T.oak, ix0 = x0 + 4, ix1 = x1 - 4, iy0 = top + 5, glowX = (ix0 + ix1) / 2, glowY = iy0 + 8;
    for (let y = iy0; y <= bot; y++) for (let x = ix0; x <= ix1; x++) {
      const k = Math.max(0, 1 - Math.hypot((x - glowX) * 0.8, y - glowY) / 30), b = bay(x, y), side = Math.min(x - ix0, ix1 - x), shade = side < 2 ? 0.45 : side < 4 ? 0.2 : 0;
      const joint = (y - iy0) % 5 === 4 || (x - ix0 + (Math.floor((y - iy0) / 5) % 2 ? 4 : 0)) % 8 === 7;
      let c;
      if (y <= iy0 + 1) c = k * 0.5 - shade > b ? "#733e39" : "#3e2731";
      else if (y >= bot - 3) c = y === bot - 3 ? "#3e2731" : k + 0.35 - shade > b ? "#c28569" : "#b86f50";
      else c = joint ? (k - shade > 0.55 ? "#733e39" : "#3e2731") : k - shade > b ? (k - shade > 0.6 + b * 0.3 ? "#c28569" : "#b86f50") : k - shade + 0.35 > b ? "#733e39" : "#3e2731";
      g.set(x, y, c, 0);
    }
    const lampX = ix0 + 22, lampY = iy0 + 5;
    for (let y = iy0; y < lampY - 1; y++) g.set(lampX, y, "#262b44", 0);
    g.fill(lampX - 1, lampY - 1, lampX + 1, lampY + 1, (x, y) => x === lampX && y === lampY ? "#fff6c8" : y === lampY - 1 ? "#5a6988" : "#fee761", 0);
    const scx = ix0 + 7, scy = iy0 + 9;
    for (let y = scy - 5; y <= scy + 5; y++) for (let x = scx - 5; x <= scx + 5; x++) { const d = Math.hypot(x - scx, y - scy); if (d > 5.2) continue; g.set(x, y, d > 4.4 ? OUT : d > 3.4 ? (x + y < scx + scy ? "#c0cbdc" : "#5a6988") : d < 1.2 ? "#feae34" : (x + y < scx + scy - 1 ? "#e43b44" : "#a22633"), 0); }
    const barY = iy0 + 19, benchY = bot - 7;
    g.fill(ix0, barY, ix1, barY + 1, (x, y) => y === barY ? "#e4a672" : "#3e2731", 0);
    g.fill(ix0, benchY, ix1, benchY + 3, (x, y) => y === benchY ? "#e4a672" : y === benchY + 3 ? OUT : "#b86f50", 0);
    const blade = (x, yTop, yBot) => { for (let y = yTop; y <= yBot; y++) { g.set(x - 1, y, OUT, 0); g.set(x, y, "#c0cbdc", 0); g.set(x + 1, y, "#5a6988", 0); g.set(x + 2, y, OUT, 0); } g.set(x, yTop - 1, "#c0cbdc", 0); g.set(x, yTop - 2, OUT, 0); };
    const sword = (x, tip) => { blade(x, tip, benchY - 6); g.fill(x - 2, benchY - 5, x + 3, benchY - 4, (xx, y) => y === benchY - 5 ? "#feae34" : "#be4a2f", 0); g.fill(x, benchY - 3, x + 1, benchY - 1, "#3e2731", 0); };
    sword(ix0 + 4, iy0 + 17);
    const spx = ix0 + 13, spy = iy0 + 9; for (let y = spy; y <= benchY - 1; y++) g.set(spx, y, y < spy + 5 ? "#c0cbdc" : "#e4a672", 0);
    const axx = ix0 + 20, axy = iy0 + 14; for (let y = axy - 1; y <= benchY - 1; y++) { g.set(axx, y, "#e4a672", 0); g.set(axx + 1, y, "#b86f50", 0); }
    ["..oooo", ".o5433", "o54333", "o54332", "o54332", "o54333", ".o5433", "..oooo"].forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== ".") g.set(axx - 6 + i, axy - 1 + j, { o: OUT, 5: "#c0cbdc", 4: "#8b9bb4", 3: "#5a6988", 2: "#3a4466" }[ch], 0); }));
    sword(ix0 + 26, iy0 + 15);
    for (let y = top; y <= bot; y++) for (let x = x0; x <= x1; x++) {
      if (x >= ix0 && x <= ix1 && y >= iy0) continue;
      const lintel = y < iy0, edge = x === x0 || x === x1 || y === top;
      const stud = (lintel && y === top + 2 && (x - x0) % 6 === 3) || (!lintel && (x === x0 + 2 || x === x1 - 1) && (y - iy0) % 7 === 3);
      g.set(x, y, edge ? OUT : stud ? "#8b9bb4" : lintel ? (y === top + 1 ? oak[2] : y === iy0 - 1 ? oak[0] : oak[1]) : x === x0 + 1 || x === x1 - 3 ? oak[2] : x === ix0 - 1 || x === x1 - 1 ? oak[0] : oak[1], 1);
    }
    const lx0 = x1 + 1, lx1 = x1 + 5;
    for (let x = lx0; x <= lx1; x++) { const t = x - lx0, y0 = top + 3 + t, y1 = bot - Math.floor(t / 2); for (let y = y0; y <= y1; y++) g.set(x, y, x === lx1 || y === y0 || y === y1 ? OUT : (y - top) % 18 === 9 || (y - top) % 18 === 10 ? "#5a6988" : t === 0 ? oak[2] : t === 1 ? oak[1] : oak[0], 1); }
    g.fill(x0 - 1, bot, x1 + 1, bot, (x) => x === x0 - 1 || x === x1 + 1 ? OUT : "#8b9bb4", 0);
    return { x0, x1: lx1, y0: top, y1: bot, lamp: { x: lampX, y: lampY } };
  }
  // two swords crossed over the Armory's door, hilts down (the Forge's own, pass 14)
  function crossedSwords(g, cx, top) {
    const L = 11;
    for (const s of [-1, 1]) for (let i = 0; i <= L; i++) {
      const x = cx - s * 6 + s * i, y = top + i;
      if (i <= 7) { g.set(x, y, "#c0cbdc"); g.set(x + s, y, "#5a6988"); g.set(x - s, y, OUT); g.set(x + 2 * s, y, OUT); }
      else if (i === 8) { g.fill(x - 2, y, x + 2, y, "#feae34"); g.set(x - 3, y, OUT); g.set(x + 3, y, OUT); }
      else { g.set(x, y, i === L ? "#feae34" : "#733e39"); g.set(x + s, y, i === L ? "#be4a2f" : "#3e2731"); g.set(x - s, y, OUT); g.set(x + 2 * s, y, OUT); }
    }
  }
  // the Training Cellar's way down, in the keep: a round stone arch (the Forge's own arch, pass 14) over steps going down into the dark,
  // the torches' light on the top steps
  // the Armorer's sign: a board with a steel helmet on it, drawn by the painter L at (x, y), 14 x 12
  function helmetBoard(L, x, y) {
    for (let yy = y; yy <= y + 11; yy++) for (let xx = x; xx <= x + 13; xx++) L(xx, yy, xx === x || xx === x + 13 || yy === y || yy === y + 11 ? OUT : yy === y + 1 ? "#e4a672" : "#b86f50", 1);
    const hcx = x + 6.5, hcy = y + 5.5;
    for (let yy = y + 2; yy <= y + 9; yy++) for (let xx = x + 2; xx <= x + 11; xx++) { const dx = xx + 0.5 - hcx, dy = yy + 0.5 - hcy; const dome = dx * dx / 16 + dy * dy / 12 <= 1 && yy <= y + 8; if (!dome) continue; L(xx, yy, yy === y + 6 && Math.abs(dx) < 3 ? OUT : dx < -1.5 ? "#c0cbdc" : dx > 2 ? "#5a6988" : "#8b9bb4", 1); }
  }

  // ------------------------------------------------------------------ the standing things: each its own sprite, sorted with the
  // knight by its foot (sy), drawn at (x, y) world. { x, y, w, h, sy, layer }
  function Piece(x, y, w, h, sy) { this.x = x; this.y = y; this.w = w; this.h = h; this.sy = sy; this.layer = new Layer(w, h); }
  // the Forge, from above: its slate roof against the south wall, the chimney with its red-hot mouth, the door under the eave with the
  // hearth's light pouring out of it, an anvil on a hanging sign
  const FONT = { F: "111100110100100", O: "010101101101010", R: "110101110101101", G: "011100101101011", E: "111100110100111" };
  function letters(L, s, x, y, c, sh) { let cx = x; for (const ch of s) { const gl = FONT[ch]; if (gl) for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (gl[j * 3 + i] === "1") { if (sh) L(cx + i + 1, y + j + 1, sh, 1); L(cx + i, y + j, c, 1); } cx += 4; } }
  // the Armorer's stand (revision 1: where the Forge was going to be, a placeholder, shut): its back board and posts, the canvas rolled
  // up and tied under the roof's edge; in front, the counter under a tarp roped down with a notice pinned to it, the front posts, the
  // helmet sign on its pole; beside it an armour stand with a helmet and a breastplate. No armorer yet
  function armorerBack() {
    const P = new Piece(246, 190, 104, 36, 212), g = P.layer, ox = 246, oy = 190;
    const L = (x, y, c, l) => g.set(x - ox, y - oy, c, l);
    const sx0 = 250, sx1 = 326;
    for (let y = 206; y <= 224; y++) for (let x = sx0 + 4; x <= sx1 - 4; x++) L(x, y, x === sx0 + 4 || x === sx1 - 4 || y === 206 ? OUT : (x - sx0) % 9 === 0 ? "#2a1d28" : "#3e2731", 1);
    for (const px of [sx0 + 4, sx1 - 6]) for (let y = 199; y <= 206; y++) { L(px, y, OUT, 1); L(px + 1, y, "#733e39", 1); L(px + 2, y, OUT, 1); }
    // the roof's edge and the rolled canvas tied under it
    for (let y = 194; y <= 198; y++) for (let x = sx0 - 2; x <= sx1 + 2; x++) L(x, y, y === 194 || y === 198 || x === sx0 - 2 || x === sx1 + 2 ? OUT : y === 195 ? "#e4a672" : "#733e39", 1);
    for (let y = 199; y <= 204; y++) for (let x = sx0 + 2; x <= sx1 - 2; x++) { const st = Math.floor((x - sx0) / 6) % 2; L(x, y, y === 204 || x === sx0 + 2 || x === sx1 - 2 ? OUT : (x - sx0) % 6 === 0 ? "#3e2731" : st ? (y < 201 ? "#c0cbdc" : "#8b9bb4") : (y < 201 ? "#be4a2f" : "#a22633"), 1); }
    for (const tx of [sx0 + 16, sx1 - 16]) for (let y = 199; y <= 205; y++) L(tx, y, "#e4a672", 1);
    return P;
  }
  function armorerFront() {
    const P = new Piece(232, 190, 120, 58, 246), g = P.layer, ox = 232, oy = 190;
    const L = (x, y, c, l) => g.set(x - ox, y - oy, c, l);
    const sx0 = 250, sx1 = 326;
    for (const px of [sx0, sx1 - 2]) for (let y = 198; y <= 244; y++) { L(px, y, OUT, 1); L(px + 1, y, "#733e39", 1); L(px + 2, y, OUT, 1); }
    // the counter under its tarp: grey canvas in folds, two ropes, a notice pinned to it
    for (let y = 222; y <= 246; y++) for (let x = sx0 + 2; x <= sx1 - 2; x++) {
      const e = x === sx0 + 2 || x === sx1 - 2 || y === 222 || y === 246, fold = (x - sx0 + Math.floor((y - 222) / 3)) % 11;
      L(x, y, e ? OUT : y < 226 ? (y === 223 ? "#c0cbdc" : "#8b9bb4") : fold === 0 ? "#3a4466" : fold < 3 ? "#5a6988" : fold > 8 ? "#8b9bb4" : "#5a6988", 1);
    }
    for (const rx of [sx0 + 14, sx1 - 14]) for (let y = 222; y <= 246; y++) { L(rx, y, "#b86f50", 1); L(rx + 1, y, "#733e39", 1); }
    for (let y = 229; y <= 239; y++) for (let x = 282; x <= 294; x++) L(x, y, x === 282 || x === 294 || y === 229 || y === 239 ? "#c28569" : (y === 232 || y === 234) && x > 283 && x < 293 ? "#733e39" : y === 236 && x > 283 && x < 289 ? "#733e39" : "#ead4aa", 1);
    L(288, 229, "#a22633", 1);
    // the sign on its pole at the front corner: the helmet
    for (let y = 204; y <= 246; y++) { L(240, y, OUT, 1); L(241, y, "#733e39", 1); L(242, y, OUT, 1); }
    helmetBoard(L, 234, 200);
    return P;
  }
  function armourStand() {
    const P = new Piece(326, 202, 24, 46, 246), g = P.layer, ox = 326, oy = 202;
    const L = (x, y, c, l) => g.set(x - ox, y - oy, c, l);
    for (let y = 226; y <= 244; y++) { L(337, y, "#b86f50", 1); L(338, y, "#733e39", 1); }
    for (let x = 332; x <= 343; x++) { L(x, 244, OUT, 1); L(x, 245, "#3e2731", 1); }
    g.region((x, y) => poly([[331, 222], [345, 222], [343, 236], [339, 239], [337, 239], [333, 236]])(x + ox, y + oy), R.steel, { spec: (x, y) => x + ox === 334 && y + oy < 230 });
    g.region((x, y) => ell(338, 214, 5, 6)(x + ox, y + oy), R.steel);
    for (let x = 335; x <= 341; x++) L(x, 214, OUT, 1); L(338, 215, OUT, 1); L(338, 216, OUT, 1);
    g.outline(1);
    return P;
  }

  function wellPiece() {
    const P = new Piece(268, 128, 42, 46, 172), g = P.layer, ox = 268, oy = 128;
    const L = (x, y, c, l) => g.set(x - ox, y - oy, c, l);
    const cx = 288.5, cy = 162;
    // the ring's south face, then its top, then the water inside
    for (let y = cy - 8; y <= cy + 12; y++) for (let x = cx - 14; x <= cx + 14; x++) {
      const dx = x + 0.5 - cx, top = (dx * dx) / 196 + ((y + 0.5 - cy) ** 2) / 64 <= 1, face = Math.abs(dx) <= 13.6 && y > cy && y <= cy + 6 + Math.sqrt(Math.max(0, 1 - dx * dx / 196)) * 4;
      const inner = (dx * dx) / 81 + ((y + 0.5 - cy + 1) ** 2) / 25 <= 1;
      if (inner && top) L(x, y, (x + y) % 7 === 0 ? "#124e89" : y < cy - 2 ? "#181425" : "#193c3e", 0);
      else if (top) L(x, y, Math.floor((Math.atan2(y - cy, dx) + 4) * 3) % 2 ? "#8b9bb4" : "#6e6a70", 1);
      else if (face) L(x, y, (y - cy) % 4 === 0 ? "#2c2638" : (Math.floor((x + (Math.floor((y - cy) / 4) % 2) * 3) / 6) % 2) ? "#555064" : "#4a4458", 1);
    }
    g.outline(1);
    L(cx - 3, cy - 1, "#0099db", 0); L(cx - 2, cy - 1, "#2ce8f5", 0);
    // the posts and the winch
    for (const px of [275, 300]) for (let y = 138; y <= 164; y++) { L(px, y, OUT, 1); L(px + 1, y, "#b86f50", 1); L(px + 2, y, "#733e39", 1); L(px + 3, y, OUT, 1); }
    for (let x = 276; x <= 302; x++) { L(x, 145, OUT, 1); L(x, 146, x % 3 === 0 ? "#3e2731" : "#733e39", 1); L(x, 147, OUT, 1); }
    for (let y = 147; y <= 154; y++) L(289, y, "#e4a672", 1);
    for (let y = 155; y <= 159; y++) for (let x = 286; x <= 292; x++) L(x, y, x === 286 || x === 292 || y === 159 ? OUT : y === 155 ? "#8b9bb4" : x < 289 ? "#b86f50" : "#733e39", 1);
    L(303, 145, "#5a6988", 1); L(304, 146, "#5a6988", 1); L(304, 147, "#3e2731", 1);
    // the roof: shingles in rows, a ridge
    for (let y = 130; y <= 141; y++) { const half = 6 + (y - 130) * 1.4; for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) { const e = y === 141 || Math.abs(x + 0.5 - cx) > half - 1; L(x, y, e ? OUT : (y - 130) % 3 === 0 ? "#3e2731" : x < cx - 2 ? "#b86f50" : "#733e39", 1); } }
    for (let x = Math.round(cx - 6); x <= Math.round(cx + 6); x++) L(x, 129, OUT, 1);
    return P;
  }
  // Nell's cart: an oak bed on two spoked wheels, a striped awning on four poles, her goods (the twelve elements' flasks, crates, sacks,
  // rope, ingots), a lantern on a pole, the shafts reaching west to Biscuit, a board with a coin
  function cartPiece() {
    const P = new Piece(64, 178, 74, 62, 234), g = P.layer, ox = 64, oy = 178;
    const L = (x, y, c, l) => g.set(x - ox, y - oy, c, l);
    const bx0 = 72, bx1 = 126, by0 = 206, by1 = 222, face1 = 229;
    // the shafts
    for (let x = 64; x <= bx0; x++) for (const y of [214, 224]) { L(x, y, "#733e39", 1); L(x, y + 1, "#3e2731", 1); }
    // the bed's top (the goods sit on it) and its south side
    for (let y = by0; y <= face1; y++) for (let x = bx0; x <= bx1; x++) {
      const e = x === bx0 || x === bx1 || y === by0 || y === face1;
      L(x, y, e ? OUT : y > by1 ? ((y - by1) % 3 === 0 ? "#3e2731" : x % 9 === 0 ? "#5a3030" : "#733e39") : (y - by0) % 4 === 0 ? "#733e39" : "#b86f50", 1);
    }
    for (let x = bx0 + 1; x < bx1; x++) L(x, by1 + 1, "#e4a672", 1);
    // goods: crates, sacks, rope, ingots, the flasks in a rack
    const crate = (x, y, w, h) => { for (let yy = y; yy <= y + h; yy++) for (let xx = x; xx <= x + w; xx++) L(xx, yy, xx === x || xx === x + w || yy === y || yy === y + h ? OUT : (xx - x === yy - y || xx - x === h - (yy - y)) ? "#733e39" : yy === y + 1 ? "#e4a672" : "#b86f50", 1); };
    crate(74, 198, 10, 9); crate(84, 202, 8, 6);
    for (let y = 196; y <= 208; y++) for (let x = 112; x <= 124; x++) { const d = ((x - 118) ** 2) / 40 + ((y - 203) ** 2) / 34; if (d > 1) continue; L(x, y, d > 0.8 ? OUT : x < 116 && y < 202 ? "#e4a672" : x > 120 ? "#733e39" : "#b86f50", 1); }
    L(118, 197, "#3e2731", 1); L(117, 198, "#3e2731", 1);
    for (let y = 199; y <= 205; y++) for (let x = 100; x <= 109; x++) { const d = Math.hypot(x - 104.5, (y - 202) * 1.3); if (d > 4.6 || d < 1.6) continue; L(x, y, d > 3.9 ? OUT : (x + y) % 2 ? "#e4a672" : "#b86f50", 1); }
    for (const [x, y] of [[94, 207], [97, 205], [100, 207]]) { L(x, y, "#c0cbdc", 1); L(x + 1, y, "#8b9bb4", 1); L(x + 2, y, "#5a6988", 1); L(x, y + 1, "#3a4466", 1); L(x + 1, y + 1, "#3a4466", 1); L(x + 2, y + 1, OUT, 1); }
    for (let i = 0; i < 12; i++) { const x = 74 + i * 4 + (i > 5 ? 2 : 0), y = 211; L(x, y - 1, "#b86f50", 0); L(x, y, FLASKS[i], 0); L(x + 1, y, FLASKS[i], 0); L(x, y + 1, FLASKS[i], 0); L(x + 1, y + 1, i === 4 ? "#c0cbdc" : "#181425", 0); L(x, y + 2, OUT, 0); L(x + 1, y + 2, OUT, 0); }
    // the wheels: spoked, iron-shod
    for (const wx of [80, 116]) for (let y = 220; y <= 234; y++) for (let x = wx - 7; x <= wx + 7; x++) {
      const d = Math.hypot(x + 0.5 - wx, y + 0.5 - 227); if (d > 7.2) continue;
      const a = Math.atan2(y + 0.5 - 227, x + 0.5 - wx), spoke = Math.abs(Math.sin(a * 3)) < 0.28 && d < 5.6;
      L(x, y, d > 6.4 ? OUT : d > 5.4 ? (x + y < wx + 227 ? "#8b9bb4" : "#3a4466") : d < 1.6 ? "#3e2731" : spoke ? "#b86f50" : null, 1);
    }
    // the awning on its poles: red and cream stripes running back, a scalloped front edge
    for (const px of [74, 124]) for (let y = 186; y <= 212; y++) { L(px, y, OUT, 1); L(px + 1, y, "#733e39", 1); L(px + 2, y, OUT, 1); }
    for (let y = 182; y <= 194; y++) for (let x = 70; x <= 130; x++) {
      const sc = y > 191 && ((x - 70) % 6 > 2) === (y > 193); if (sc && y > 192) continue;
      const e = x === 70 || x === 130 || y === 182 || (y === 194) || (y === 192 && (x - 70) % 6 > 2);
      const stripe = Math.floor((x - 70) / 6) % 2;
      L(x, y, e ? OUT : stripe ? (y < 185 ? "#ead4aa" : "#e4a672") : (y < 185 ? "#e43b44" : "#a22633"), 1);
    }
    // her lantern on a pole at the corner, and her board with a coin
    for (let y = 182; y <= 200; y++) L(129, y, "#3e2731", 1);
    for (let y = 194; y <= 200; y++) for (let x = 126; x <= 132; x++) L(x, y, x === 126 || x === 132 || y === 194 || y === 200 ? OUT : y === 195 ? "#5a6988" : "#fee761", 0);
    L(129, 197, "#fff6c8", 0);
    for (let y = 196; y <= 205; y++) for (let x = 86; x <= 97; x++) L(x, y, x === 86 || x === 97 || y === 196 || y === 205 ? OUT : y === 197 ? "#e4a672" : "#733e39", 1);
    for (let y = 198; y <= 203; y++) for (let x = 89; x <= 94; x++) { const d = Math.hypot(x + 0.5 - 91.5, y + 0.5 - 200.5); if (d < 2.8) L(x, y, d > 2 ? "#be4a2f" : "#feae34", 1); }
    return P;
  }
  // Vorn's stall: an oak counter facing the yard, a rack of class weapons behind it, a navy-and-cream canvas on four posts, a board
  // with a crossed axe and sword, and two barrels of spears at its side
  function stallPiece() {
    const P = new Piece(424, 164, 122, 84, 210), g = P.layer, ox = 424, oy = 164;
    const L = (x, y, c, l) => g.set(x - ox, y - oy, c, l);
    const sx0 = 428, sx1 = 514;
    // the back rack against which the weapons lean
    for (let y = 186; y <= 222; y++) for (let x = sx0 + 6; x <= sx1 - 6; x++) L(x, y, x === sx0 + 6 || x === sx1 - 6 || y === 186 ? OUT : (y - 186) % 12 === 0 ? "#b86f50" : (x - sx0) % 10 === 0 ? "#3e2731" : "#2a1d28", 1);
    // the weapons, small, by the Armory door's hand: a bow, an axe, a flail, a spear, a staff with an orb, a crossbow, a hammer, a shield
    const W8 = [];
    const px = (x, y, c) => W8.push([x, y, c]);
    // a bow (the curve and its string)
    for (let i = 0; i <= 16; i++) { const y = 190 + i, x = 440 + Math.round(3 * Math.sin(i / 16 * Math.PI)); px(x, y, "#b86f50"); px(x + 1, y, "#733e39"); px(440, y, "#c0cbdc"); }
    // an axe
    for (let y = 190; y <= 210; y++) { px(452, y, "#e4a672"); px(453, y, "#b86f50"); }
    ["..oo", ".o54", "o543", "o543", ".o54", "..oo"].forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== ".") px(447 + i, 190 + j, { o: OUT, 5: "#c0cbdc", 4: "#8b9bb4", 3: "#5a6988" }[ch]); }));
    // a flail: a handle, a chain, a spiked ball
    for (let y = 200; y <= 212; y++) { px(462, y, "#e4a672"); px(463, y, "#733e39"); }
    for (const [x, y] of [[463, 198], [464, 196], [465, 194]]) px(x, y, "#8b9bb4");
    for (let y = 188; y <= 194; y++) for (let x = 463; x <= 469; x++) { const d = Math.hypot(x - 466, y - 191); if (d < 3) px(x, y, d < 1.6 ? "#8b9bb4" : "#3a4466"); else if (d < 3.6 && (x + y) % 2) px(x, y, "#c0cbdc"); }
    // a spear
    for (let y = 188; y <= 216; y++) px(475, y, y < 193 ? "#c0cbdc" : "#e4a672");
    px(474, 190, "#8b9bb4"); px(476, 190, "#5a6988"); px(474, 191, "#8b9bb4"); px(476, 191, "#5a6988");
    // a staff with its orb
    for (let y = 192; y <= 216; y++) { px(484, y, "#b86f50"); px(485, y, "#733e39"); }
    for (let y = 187; y <= 192; y++) for (let x = 482; x <= 487; x++) { const d = Math.hypot(x + 0.5 - 485, y + 0.5 - 189.5); if (d < 2.8) px(x, y, d < 1.2 ? "#ffffff" : x < 485 ? "#2ce8f5" : "#0099db"); }
    // a crossbow, on its side
    for (let x = 491; x <= 503; x++) { px(x, 199, "#b86f50"); px(x, 200, "#733e39"); }
    for (let y = 193; y <= 206; y++) px(493 + Math.round(1.5 * Math.sin((y - 193) / 13 * Math.PI)), y, "#8b9bb4");
    // a war hammer
    for (let y = 202; y <= 218; y++) { px(498, y, "#e4a672"); px(499, y, "#733e39"); }
    for (let y = 202; y <= 206; y++) for (let x = 495; x <= 502; x++) px(x, y, y === 202 ? "#c0cbdc" : y === 206 ? "#3a4466" : "#5a6988");
    for (const [x, y, c] of W8) L(x, y, c, 1);
    // soot round each weapon so it reads on the dark rack
    const wset = new Set(W8.map(([x, y]) => x + "," + y));
    for (const [x, y] of W8) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!wset.has((x + dx) + "," + (y + dy)) && g.get(x + dx - ox, y + dy - oy) && g.get(x + dx - ox, y + dy - oy) !== OUT && (x + dx - sx0) % 10 !== 0) L(x + dx, y + dy, "#181425", 1);
    // the canvas
    for (let y = 168; y <= 182; y++) for (let x = sx0 - 4; x <= sx1 + 4; x++) {
      const e = x === sx0 - 4 || x === sx1 + 4 || y === 168 || y === 182 || (y === 180 && (x - sx0) % 8 > 3);
      if (y > 180 && (x - sx0) % 8 > 3) continue;
      const stripe = Math.floor((x - sx0 + 4) / 8) % 2;
      L(x, y, e ? OUT : stripe ? (y < 171 ? "#ead4aa" : "#e4a672") : (y < 171 ? "#124e89" : "#262b44"), 1);
    }
    for (const px0 of [sx0 + 4, sx1 - 6]) for (let y = 182; y <= 186; y++) { L(px0, y, OUT, 1); L(px0 + 1, y, "#733e39", 1); L(px0 + 2, y, OUT, 1); }
    return P;
  }
  function stallFront() {
    const P = new Piece(424, 174, 122, 74, 246), g = P.layer, ox = 424, oy = 174;
    const L = (x, y, c, l) => g.set(x - ox, y - oy, c, l);
    const sx0 = 428, sx1 = 514;
    // the front posts
    for (const px0 of [sx0, sx1 - 2]) for (let y = 182; y <= 244; y++) { L(px0, y, OUT, 1); L(px0 + 1, y, "#733e39", 1); L(px0 + 2, y, OUT, 1); }
    // the counter: its top and its face of boards toward the yard
    for (let y = 222; y <= 246; y++) for (let x = sx0 + 2; x <= sx1 - 2; x++) {
      const e = x === sx0 + 2 || x === sx1 - 2 || y === 222 || y === 246, topF = y < 227;
      L(x, y, e ? OUT : topF ? (y === 223 ? "#e4a672" : "#b86f50") : (x - sx0) % 7 === 0 ? "#3e2731" : y === 227 ? "#3e2731" : (x * 7 + y * 3) % 31 === 0 ? T.oakKnot : "#733e39", 1);
    }
    // a shield hung on the counter's face, his sign
    const scx = 471, scy = 236;
    for (let y = scy - 7; y <= scy + 7; y++) for (let x = scx - 7; x <= scx + 7; x++) { const d = Math.hypot(x + 0.5 - scx, y + 0.5 - scy); if (d > 6.6) continue; L(x, y, d > 5.8 ? OUT : d > 4.6 ? (x + y < scx + scy ? "#c0cbdc" : "#5a6988") : d < 1.5 ? "#feae34" : (x + y < scx + scy - 1 ? "#0099db" : "#124e89"), 1); }
    for (let i = -3; i <= 3; i++) { L(scx + i, scy + i, "#ead4aa", 1); L(scx + i, scy - i, "#ead4aa", 1); }
    // the barrels of spears at its side
    for (const bx of [518, 530]) {
      for (let y = 224; y <= 244; y++) for (let x = bx - 5; x <= bx + 5; x++) { const e = Math.abs(x - bx) === 5 || y === 244; L(x, y, e ? OUT : (y - 224) % 7 === 2 ? "#5a6988" : x < bx - 2 ? "#b86f50" : x > bx + 2 ? "#3e2731" : "#733e39", 1); }
      for (let x = bx - 4; x <= bx + 4; x++) { L(x, 223, OUT, 1); L(x, 224, "#3e2731", 1); }
      for (const [dx, h] of [[-3, 20], [0, 26], [3, 22]]) for (let y = 224 - h; y < 224; y++) L(bx + dx, y, y < 224 - h + 4 ? "#c0cbdc" : "#e4a672", 1);
    }
    return P;
  }
  // the old oak in the north-east corner, a bench under it
  function oakPiece() {
    const P = new Piece(496, 66, 76, 80, 141), g = P.layer, ox = 496, oy = 66;
    const L = (x, y, c, l) => g.set(x - ox, y - oy, c, l);
    // the bench
    for (let y = 132; y <= 141; y++) for (let x = 504; x <= 524; x++) { const leg = (x === 506 || x === 522) && y > 135; const seat = y >= 132 && y <= 135; if (!leg && !seat) continue; L(x, y, x === 504 || x === 524 || y === 132 ? OUT : y === 133 ? "#e4a672" : seat ? "#b86f50" : "#3e2731", 1); }
    // the trunk and its roots
    g.region((x, y) => poly([[528, 141], [530, 104], [537, 104], [540, 141]])(x + ox, y + oy) || ell(534, 140, 9, 2.4)(x + ox, y + oy), R.coat, { l: 1, tex: (x, y) => (x + y * 2) % 5 === 0 ? "#3e2731" : null });
    for (const [a, b2] of [[[530, 112], [522, 104]], [[537, 110], [548, 100]]]) for (let i = 0; i <= 10; i++) { const x = Math.round(a[0] + (b2[0] - a[0]) * i / 10), y = Math.round(a[1] + (b2[1] - a[1]) * i / 10); L(x, y, "#733e39", 1); L(x + 1, y, "#3e2731", 1); }
    // the crown: three lobes of leaves lit from the top left, dusk-dark underneath
    const crown = or(ell(522, 92, 18, 14), ell(544, 86, 20, 16), ell(536, 104, 22, 10), ell(512, 102, 10, 8));
    for (let y = 66; y <= 118; y++) for (let x = 496; x <= 571; x++) {
      if (!crown(x + 0.5, y + 0.5)) continue;
      const h = hash(x >> 1, y >> 1, 101), light = (crown(x - 2.5, y - 2.5) ? 0 : 1) + (crown(x + 3.5, y + 3.5) ? 0 : -1);
      const lumps = hash(Math.floor((x + (y % 2)) / 3), Math.floor(y / 3), 103);
      let c = light > 0 ? (h < 0.5 ? "#63c74d" : "#3e8948") : light < 0 ? "#193c3e" : lumps < 0.35 ? "#265c42" : lumps < 0.85 ? "#3e8948" : "#265c42";
      if (y > 104 && light <= 0) c = "#193c3e";
      L(x, y, c, 1);
    }
    g.outline(1);
    return P;
  }
  // a lantern on an iron post
  function lanternPiece(x, y) {
    const P = new Piece(x - 4, y - 30, 9, 32, y), g = P.layer, ox = x - 4, oy = y - 30;
    const L = (xx, yy, c, l) => g.set(xx - ox, yy - oy, c, l);
    for (let yy = y - 22; yy <= y; yy++) { L(x - 1, yy, OUT, 1); L(x, yy, "#5a6988", 1); L(x + 1, yy, OUT, 1); }
    L(x - 2, y, OUT, 1); L(x + 2, y, OUT, 1); L(x - 1, y - 1, "#3a4466", 1); L(x + 1, y - 1, "#3a4466", 1);
    for (let yy = y - 29; yy <= y - 21; yy++) for (let xx = x - 3; xx <= x + 3; xx++) { const e = xx === x - 3 || xx === x + 3 || yy === y - 29 || yy === y - 21; L(xx, yy, e ? OUT : yy === y - 28 ? "#3a4466" : yy === y - 22 ? "#3a4466" : xx === x ? "#5a6988" : "#fee761", 0); }
    L(x - 1, y - 25, "#fff6c8", 0); L(x + 1, y - 25, "#fff6c8", 0);
    P.flame = { x, y: y - 25 };
    return P;
  }
  // hay by Nell's cart, crates and barrels in the south-west corner (the road's signpost by the gate went when the map table took its place)
  function clutter() {
    const out = [];
    const hay = new Piece(496, 210, 24, 20, 228), h = hay.layer;
    h.region(rect(3, 6, 20, 17), R.straw, { tex: (x, y, c) => (x + y) % 4 === 0 ? "#be4a2f" : (y === 9 || y === 14) ? "#733e39" : null }); h.outline(1); out.push(hay);
    const cr = new Piece(22, 230, 54, 36, 264), c = cr.layer;
    const box = (x, y, w, hh) => { for (let yy = y; yy <= y + hh; yy++) for (let xx = x; xx <= x + w; xx++) c.set(xx, yy, xx === x || xx === x + w || yy === y || yy === y + hh ? OUT : (xx - x === yy - y || xx - x === hh - (yy - y)) ? "#733e39" : yy === y + 1 ? "#e4a672" : "#b86f50"); };
    box(4, 16, 14, 13); box(18, 18, 12, 11); box(8, 4, 11, 11);
    for (const bx of [36, 46]) for (let y = 14; y <= 32; y++) for (let x = bx - 4; x <= bx + 4; x++) c.set(x, y, Math.abs(x - bx) === 4 || y === 32 ? OUT : (y - 14) % 6 === 2 ? "#5a6988" : x < bx - 1 ? "#b86f50" : x > bx + 1 ? "#3e2731" : "#733e39");
    for (const bx of [36, 46]) for (let x = bx - 3; x <= bx + 3; x++) { c.set(x, 13, OUT); c.set(x, 14, "#3e2731"); }
    out.push(cr);
    return out;
  }
  // the map table (design pass 25 section 4.1), where pass 24's signpost stood, just right of the gate on the top wall: an oak trestle table with
  // the map spread on it, a dagger in its corner, an iron lantern on a post at its back. at is the table's foot, front and middle
  function tablePiece(at) {
    at = at || { x: 264, y: 120 };
    const x0 = at.x - 20, y0 = at.y - 38, P = { x: x0, y: y0, w: 42, h: 42, sy: at.y, layer: new Layer(42, 42) }, g = P.layer;
    const L = (x, y, c, l) => g.set(x - x0, y - y0, c, l === undefined ? 1 : l);
    const tx0 = at.x - 17, tx1 = at.x + 16, ty0 = at.y - 24, ty1 = at.y - 8;   // the top
    // the legs and the trestle bar under the top
    for (const lx of [tx0 + 3, tx1 - 5]) for (let y = ty1; y <= at.y; y++) { L(lx, y, OUT); L(lx + 1, y, "#3e2731"); L(lx + 2, y, OUT); }
    for (let x = tx0 + 4; x <= tx1 - 4; x++) { L(x, at.y - 3, "#3e2731"); L(x, at.y - 2, OUT); }
    // the top, oak planks seen from above, its front edge in shadow
    for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
      const e = x === tx0 || x === tx1 || y === ty0 || y === ty1;
      L(x, y, e ? OUT : y >= ty1 - 2 ? (y === ty1 - 1 ? "#3e2731" : "#733e39") : (y - ty0) % 5 === 0 ? "#733e39" : x < tx0 + 4 ? "#e4a672" : "#b86f50");
    }
    // the map on it: parchment with its little countries, the roads, home's red dot
    const mx0 = tx0 + 3, mx1 = tx1 - 3, my0 = ty0 + 2, my1 = ty1 - 4;
    for (let y = my0; y <= my1; y++) for (let x = mx0; x <= mx1; x++) {
      const e = x === mx0 || x === mx1 || y === my0 || y === my1, u = (x - mx0) / (mx1 - mx0), v = (y - my0) / (my1 - my0);
      let c = e ? "#c28569" : "#ead4aa";
      if (!e) {
        if (v < 0.4 && u > 0.3 && u < 0.68) c = "#ffffff";
        else if (v < 0.5 && u >= 0.68) c = "#3e2731";
        else if (u < 0.28) c = (x + y) % 2 ? "#733e39" : "#3e8948";
        else if (v > 0.68 && u > 0.3 && u < 0.72) c = "#e4a672";
        else if (u > 0.82 && v > 0.5) c = "#124e89";
        else c = (x + y) % 3 ? "#3e8948" : "#63c74d";
      }
      L(x, y, c, 0);
    }
    const cx = Math.round((mx0 + mx1) / 2), cy = Math.round((my0 + my1) / 2) + 1;
    L(cx, cy, "#e43b44", 0); L(cx + 1, cy, "#a22633", 0); for (const d of [-6, -4, -2]) L(cx + d, cy + (d < -4 ? 1 : 0), "#feae34", 0);
    L(mx0 + 2, cy - 1, "#3e8948", 0); L(mx0 + 2, cy - 2, "#c4bcae", 0);
    // a dagger pinning the far corner
    L(mx1 - 1, my0 + 1, "#c0cbdc", 0); L(mx1, my0, "#8b9bb4", 0); L(mx1 + 1, my0 - 1, "#feae34", 0); L(mx1 + 2, my0 - 2, OUT, 0);
    // the lantern's iron post at the back right, the lantern lit on its hook
    const px = tx1 + 1;
    for (let y = y0 + 2; y <= ty1 + 2; y++) { L(px, y, OUT); L(px + 1, y, "#5a6988"); L(px + 2, y, OUT); }
    for (let y = y0; y <= y0 + 8; y++) for (let x = px - 2; x <= px + 4; x++) { const e = x === px - 2 || x === px + 4 || y === y0 || y === y0 + 8; L(x, y, e ? OUT : y === y0 + 1 || y === y0 + 7 ? "#3a4466" : x === px + 1 ? "#5a6988" : "#fee761", 0); }
    L(px, y0 + 4, "#fff6c8", 0); L(px + 2, y0 + 4, "#fff6c8", 0);
    P.flame = { x: px + 1, y: y0 + 4 };
    return P;
  }

  // smoke from the Forge's chimney and the wings' chimneys, sparks from the Forge's; deterministic at time t (seconds)
  function smoke(t, x, y, big) {
    const out = [], n = big ? 7 : 4;
    for (let k = 0; k < n; k++) {
      const age = ((t * (big ? 0.5 : 0.35) + k / n) % 1), r = (big ? 2 : 1.5) + age * (big ? 5 : 3);
      const sx = x + Math.sin(age * 5 + k) * 3 + age * 10, sy = y - age * (big ? 38 : 22);
      out.push({ x: sx, y: sy, r, c: age < 0.3 ? "#8b9bb4" : age < 0.7 ? "#5a6988" : "#3a4466", a: 1 - age * 0.8 });
    }
    return out;
  }
  function sparks(t, x, y) {
    const out = [];
    for (let k = 0; k < 6; k++) { const age = (t * 0.9 + k * 0.37) % 1; if (age > 0.7) continue; out.push({ x: x + Math.sin(k * 7.3 + t) * 4 + (hash(k, Math.floor(t * 0.9 + k * 0.37), 5) - 0.5) * 8, y: y - age * 30, c: age < 0.3 ? "#fee761" : age < 0.5 ? "#feae34" : "#f77622" }); }
    return out;
  }
  // a torch or lantern flame, 5 x 6 on four frames, in the hearth's fire ramp
  const FLAME = [["..3..", ".353.", "34543", "35653", ".376.", "..6.."], [".3...", ".35..", "34543", "35653", ".376.", "..6.."], ["...3.", "..33.", "34553", "35653", ".376.", "..6.."], ["..3..", "..3..", "34543", "35663", ".366.", "..6.."]];
  const FIRE = { 3: "#be4a2f", 4: "#f77622", 5: "#feae34", 6: "#fee761", 7: "#fff6c8" };

  // ------------------------------------------------------------------ the whole yard: the ground, the pieces, the lights, the walk
  // a piece drawn where an earlier revision had it, moved to its revision 2 place
  function moved(P, dx, dy) { P.x += dx; P.y += dy; P.sy += dy; return P; }
  function Yard(spec) {
    spec = spec || SPEC;
    this.spec = spec; this.W = spec.w; this.H = spec.h;
    this.ground = new Ground(spec);
    const [hay, crates] = clutter();
    this.pieces = [
      moved(wellPiece(), 32, 17),
      moved(stallPiece(), -328, 70), moved(stallFront(), -328, 70),
      moved(armorerBack(), 32, 70), moved(armorerFront(), 32, 70), moved(armourStand(), 32, 70),
      moved(cartPiece(), 412, 70),
      moved(oakPiece(), 16, -4),
      moved(hay, 70, 70), moved(crates, 0, 70)
    ].concat(spec.lanterns.map(([x, y]) => lanternPiece(x, y)), spec.stairLamps.map(([x, y]) => lanternPiece(x, y)));
    this.lights = spec.lights.slice();
    for (const w of this.ground.windows) this.lights.push({ kind: "window", x: w.x, y: w.y, r: 14 });
    // the map table in the signpost's place, its lantern lighting it like the yard's others (design pass 25 section 4.1). It comes
    // after the windows, so every other light keeps its place in the list (a light's flicker goes by its place)
    this.table = spec.table ? tablePiece({ x: spec.table.x, y: spec.table.y }) : null;
    if (this.table) { this.pieces.push(this.table); this.lights.push({ kind: "lantern", x: this.table.flame.x, y: this.table.flame.y + 2, r: spec.table.light || 40 }); }
    this._world = null; this._P = null; this._grid = null; this._probe = null;
  }
  // the light at (x, y) for flicker phase f: { k: the lamps' closeness, sun: the gate's evening gold } (pools flattened on the floor,
  // as the cellar's; a spill and the sun pour south out of the north face)
  Yard.prototype.lightAt = function (x, y, f) {
    let k = 0, sun = 0;
    const each = (l, i) => {
      const still = l.kind === "window" || l.kind === "sun" || l.kind === "beam", R = l.r + (still ? 0 : 3 * Math.sin(f * 1.7 + i * 2.1));
      let d;
      if (l.kind === "spill" || l.kind === "sun") { if (y < l.y - 2) return; d = Math.hypot((x - l.x) * 1.1, (y - l.y) * 0.9); }
      else if (l.kind === "beam") { const dy = y - l.y; if (dy < -2) return; const w = 4 + dy * 0.28, edge = Math.max(0, Math.abs(x + 0.5 - l.x) - w); if (edge > 7) return; d = dy * 0.9 + edge * 9; }
      else d = Math.hypot(x - l.x, (y - l.y) / 0.62);
      const v = (1 - d / R) * (l.kind === "window" ? 0.7 : l.s || 1);
      if (l.kind === "sun" || l.kind === "beam") sun = Math.max(sun, v); else k = Math.max(k, v);
    };
    // only the lights that can reach this pixel are asked (the build's one change to the sketch's light: a light out of reach adds
    // nothing, so the answer is the same; a frame of the ground is lit six times faster). A light keeps its place in the list, i
    const near = x >= 0 && y >= 0 && x < this.W && y < this.H ? this.reach()[(y >> 4) * this._rw + (x >> 4)] : null;
    if (near) for (let n = 0; n < near.length; n++) each(this.lights[near[n]], near[n]); else this.lights.forEach(each);
    return { k: Math.min(1, k), sun: Math.min(1, sun) };
  };
  // which lights can reach each 16 px cell of the yard: every light whose pool, at its widest flicker, touches the cell
  Yard.prototype.reach = function () {
    if (this._reach && this._reachN === this.lights.length) return this._reach;
    const rw = this._rw = Math.ceil(this.W / 16), rh = Math.ceil(this.H / 16), cells = []; for (let i = 0; i < rw * rh; i++) cells.push([]);
    this.lights.forEach((l, i) => {
      const R = l.r + 3; let x0, x1, y0, y1;
      if (l.kind === "spill" || l.kind === "sun") { x0 = l.x - R / 1.1; x1 = l.x + R / 1.1; y0 = l.y - 2; y1 = l.y + R / 0.9; }
      else if (l.kind === "beam") { const far = R / 0.9, hw = 4 + far * 0.28 + 8; x0 = l.x - hw; x1 = l.x + hw; y0 = l.y - 2; y1 = l.y + far; }
      else { x0 = l.x - R; x1 = l.x + R; y0 = l.y - R * 0.62; y1 = l.y + R * 0.62; }
      for (let cy = Math.max(0, Math.floor((y0 - 2) / 16)); cy <= Math.min(rh - 1, Math.floor((y1 + 2) / 16)); cy++) for (let cx = Math.max(0, Math.floor((x0 - 2) / 16)); cx <= Math.min(rw - 1, Math.floor((x1 + 2) / 16)); cx++) cells[cy * rw + cx].push(i);
    });
    this._reach = cells; this._reachN = this.lights.length;
    return cells;
  };
  const GOLD = [254, 174, 52];
  function lit(rgb, L, x, y) {
    let [r, gg, b] = rgb;
    if (L.sun > 0) { const m = S.glow(L.sun, x, y) * 0.9; r += (GOLD[0] - r) * m; gg += (GOLD[1] - gg) * m * 0.95; b += (GOLD[2] - b) * m * 0.7; }
    if (L.k > 0) { const m = S.glow(L.k, x, y), G = S.GLOW; r += (G[0] - r) * m; gg += (G[1] - gg) * m * 0.9; b += (G[2] - b) * m * 0.8; }
    return [r, gg, b];
  }
  // the yard's pixels lit for phase f: { w, h, d: Uint8ClampedArray RGBA } of the ground alone. With `into` (a buffer of the yard's
  // size) and rows y0 to y1, only those rows are lit, into it: the page bakes the flicker's other phases a slice at a time
  Yard.prototype.groundFrame = function (f, into, y0, y1) {
    const G = this.ground.layer, W = this.W, H = this.H, d = into || new Uint8ClampedArray(W * H * 4);
    for (let y = y0 === undefined ? 0 : y0; y < (y1 === undefined ? H : y1); y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, c = G.px[i]; let rgb = c ? hex(c) : [24, 20, 37];
      if (G.lit[i]) rgb = lit(rgb, this.lightAt(x, y, f), x, y);
      const o = i * 4; d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2]; d[o + 3] = 255;
    }
    return { w: W, h: H, d };
  };
  // a piece's pixels lit where it stands (phase 0), as RGBA with transparency
  Yard.prototype.pieceFrame = function (P) {
    const d = new Uint8ClampedArray(P.w * P.h * 4);
    for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) {
      const i = y * P.w + x, c = P.layer.px[i]; if (!c) continue;
      let rgb = hex(c);
      if (P.layer.lit[i]) rgb = lit(rgb, this.lightAt(P.x + x, Math.min(P.sy, P.y + y + 6), 0), P.x + x, P.y + y);
      const o = i * 4; d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2]; d[o + 3] = 255;
    }
    return { w: P.w, h: P.h, d };
  };
  // the live things at time t: flames (x, y, frame), smoke puffs, sparks, the well's glint while the daily coins wait (o.wellReady,
  // true unless false), the folk's poses and frames, the hens' walk
  Yard.prototype.live = function (t, still, o) {
    o = o || {};
    t = Math.max(0, t || 0); const S0 = this.spec, tick = still ? 0 : Math.floor(t * 8), out = { flames: [], smoke: [], sparks: [], folk: [], glint: null };
    for (const P of this.pieces) if (P.flame) out.flames.push({ x: P.flame.x, y: P.flame.y + 2, f: (tick + P.flame.x) % 4 });
    out.flames.push({ x: S0.cartLamp[0], y: S0.cartLamp[1], f: tick % 4, small: true });
    if (!still) { const c = this.ground.forge.chimney; out.smoke = out.smoke.concat(smoke(t, c.x, c.y, true)); out.sparks = sparks(t, c.x, c.y + 2); for (const s of this.ground.smokes) out.smoke = out.smoke.concat(smoke(t + s.x, s.x, s.y, false)); }
    if (o.wellReady !== false) { const w = S0.well; out.glint = { x: w.x - 4, y: w.y - 2, on: still || tick % 6 < 3 }; }
    const beat = still ? 0 : t;
    const nPose = Math.floor(beat / 4) % 3 === 2 ? "count" : "idle", vPose = Math.floor(beat / 5) % 4 === 3 ? "point" : "idle";
    out.folk.push({ who: "nell", x: S0.folk.nell.x, y: S0.folk.nell.y, pose: nPose, i: Math.floor(beat * (nPose === "idle" ? 1.6 : 4)) % 4 });
    out.folk.push({ who: "biscuit", x: S0.folk.biscuit.x, y: S0.folk.biscuit.y, pose: Math.floor(beat / 6) % 2 ? "eat" : "idle", i: Math.floor(beat * 3) % 4 });
    out.folk.push({ who: "vorn", x: S0.folk.vorn.x, y: S0.folk.vorn.y, pose: vPose, i: Math.floor(beat * 1.6) % 4 });
    S0.folk.hens.forEach((hn, k) => {
      const [x0, y0, x1, y1] = hn.home, ph = beat * 0.25 + k * 1.7, wx = (x0 + x1) / 2 + Math.sin(ph) * (x1 - x0) * 0.4, wy = (y0 + y1) / 2 + Math.sin(ph * 0.7 + k) * (y1 - y0) * 0.3;
      out.folk.push({ who: "hen", x: still ? hn.x : wx, y: still ? hn.y : wy, i: Math.floor(beat * 3 + k) % 4, flip: Math.cos(ph) < 0 });
    });
    out.folk.push({ who: "cat", x: S0.folk.cat.x, y: S0.folk.cat.y, i: Math.floor(beat * 0.8) % 4, onRoof: true });
    return out;
  };
  // ------------------------------------------------------------------ the places: zones, taps, where to stand
  // a place by its id: a door, the map table, the well, Nell or Vorn
  Yard.prototype.placeOf = function (id) { const S0 = this.spec; return S0.doors[id] || S0.folk[id] || (id === "well" ? S0.well : id === "table" ? S0.table : null) || null; };
  const PLACES = S0 => [["table", "table", S0.table]].concat(Object.keys(S0.doors).map(id => [id, "door", S0.doors[id]]), [["well", "well", S0.well], ["nell", "folk", S0.folk.nell], ["vorn", "folk", S0.folk.vorn]]).filter(p => p[2]);
  const placed = (id, kind, P) => { const o = { id, kind, prompt: P.prompt }; o[kind === "folk" ? "folk" : kind] = P; return o; };
  // which zone the feet are in: a door, the map table, the well or a folk, or null
  Yard.prototype.zoneAt = function (x, y) {
    for (const [id, kind, P] of PLACES(this.spec)) { const z = P.zone; if (z && x >= z[0] && x <= z[2] && y >= z[1] && y <= z[3]) return placed(id, kind, P); }
    return null;
  };
  // which place a tap on the world point (x, y) hits: its tap box (the table before the gate, whose box reaches over it), or null
  Yard.prototype.tapAt = function (x, y) {
    for (const [id, kind, P] of PLACES(this.spec)) { const b = P.tap; if (b && x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]) return placed(id, kind, P); }
    return null;
  };
  // where a tap on a place walks to: the spot to stand on, inside its zone and clear of every solid
  Yard.prototype.targetOf = function (id) {
    const D = this.placeOf(id); if (!D) return null;
    if (D.stand) return { x: D.stand[0], y: D.stand[1] };
    const z = D.zone; return { x: (z[0] + z[2]) / 2, y: (z[1] + z[3]) / 2 };
  };

  // ------------------------------------------------------------------ the walk: the game's one physics model (design pass 24 section 4.5)
  // The yard as Physics sees it: a level's world holding the yard's solids, each with its height, as every standing thing of the Troll
  // Gate is. The box keeps the feet on the floor; it reaches a little way past the floor's north edge, where the north face's solids
  // leave only the two ways open, so a knight walks into the gate and the Forge's door. P and N default to the page's own
  // (window.Physics, spec/combat.js's physics block)
  Yard.prototype.world = function (P, N) {
    if (this._world) return this._world;
    P = P || root.Physics; N = N || (root.FORGE_COMBAT || {}).physics;
    if (!P || !N) throw new Error("courtyard.js: the walk needs proto/physics.js and spec/combat.js");
    const S0 = this.spec, F = S0.floor, r = S0.knight.r;
    const W = P.world({ level: true, area: { w: this.W, h: this.H }, W: this.W, H: this.H, dummies: [], floor: { x0: F.x0 - 4 + r, x1: F.x1 + 4 - r, y0: S0.north.floor + 1, y1: F.y1 } }, N, root.FORGE_COMBAT || null);
    for (const s of S0.solids) P.addSolid(W, s.kind === "circle" ? { kind: "yard", shape: "c", x: s.x, y: s.y, r: s.r, ht: s.ht || 16, thin: !!s.thin } : { kind: "yard", shape: "r", x0: s.x0, y0: s.y0, x1: s.x1, y1: s.y1, ht: s.ht || 16 });
    this._world = W; this._P = P;
    return W;
  };
  // a knight's body for the yard: the feet at (x, y)
  Yard.prototype.body = function (x, y) { return { x, y, z: 0, r: this.spec.knight.r, h: 24, mass: 1, knight: true, on: null, vx: 0, vy: 0, ix: 0, iy: 0 }; };
  // one step: the knight wishes to move at (vx, vy) px/s; Physics.move walks, collides and slides
  Yard.prototype.step = function (k, vx, vy, dt) { const W = this.world(); this._P.move(k, { wish: [vx, vy] }, W, dt); return k; };
  // whether feet can stand at (x, y): on the floor and caught by no solid (the physics model's own answer, so the walk and tap to go agree)
  Yard.prototype.free = function (x, y) {
    const W = this.world(), F = W.floor; if (x < F.x0 || x > F.x1 || y < F.y0 || y > F.y1) return false;
    const b = this._probe || (this._probe = this.body(0, 0)); b.x = x; b.y = y;
    return !this._P.caught(W, b);
  };
  // a knight brought to a spot that is somehow blocked is put on the nearest free point (design pass 24 section 4.6)
  Yard.prototype.settle = function (k) { const W = this.world(), F = W.floor; k.x = Math.max(F.x0, Math.min(F.x1, k.x)); k.y = Math.max(F.y0, Math.min(F.y1, k.y)); if (this._P.caught(W, k)) this._P.freePoint(W, k, 64); return k; };
  // tap to go: the shortest way round the yard's solids from (x0, y0) to (tx, ty), A* on a 6 px grid of free cells (each cell asked of
  // the physics model once), the turns only, the last point the target itself. When the target can't be reached the way leads to the
  // free cell nearest it, and the list is marked partial: the knight walks as near as it can and stops
  const CELL = 6;
  Yard.prototype.path = function (x0, y0, tx, ty) {
    const C = CELL, GW = Math.ceil(this.W / C), GH = Math.ceil(this.H / C);
    if (!this._grid) { const g = this._grid = new Uint8Array(GW * GH); for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) g[j * GW + i] = this.free(i * C + C / 2, j * C + C / 2) ? 1 : 0; }
    const G = this._grid, free = (i, j) => G[j * GW + i] === 1;
    const si = Math.floor(x0 / C), sj = Math.floor(y0 / C), ti = Math.floor(tx / C), tj = Math.floor(ty / C);
    const key = (i, j) => j * GW + i, open = [[si, sj]], g0 = new Map([[key(si, sj), 0]]), from = new Map(), hsc = (i, j) => Math.hypot(i - ti, j - tj);
    let found = false, guard = 0, best = [si, sj];
    while (open.length && guard++ < 8000) {
      let bi = 0; for (let n = 1; n < open.length; n++) if (g0.get(key(...open[n])) + hsc(...open[n]) < g0.get(key(...open[bi])) + hsc(...open[bi])) bi = n;
      const [i, j] = open.splice(bi, 1)[0];
      if (hsc(i, j) < hsc(...best)) best = [i, j];
      if (i === ti && j === tj) { found = true; break; }
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= GW || nj >= GH) continue;
        if (!free(ni, nj) && !(ni === ti && nj === tj && this.free(tx, ty))) continue;
        if (di && dj && (!free(i + di, j) || !free(i, j + dj))) continue;
        const ng = g0.get(key(i, j)) + (di && dj ? 1.414 : 1);
        if (!g0.has(key(ni, nj)) || ng < g0.get(key(ni, nj))) { g0.set(key(ni, nj), ng); from.set(key(ni, nj), [i, j]); open.push([ni, nj]); }
      }
    }
    const pts = []; let cur = found ? [ti, tj] : best;
    while (cur && !(cur[0] === si && cur[1] === sj)) { pts.unshift({ x: cur[0] * C + C / 2, y: cur[1] * C + C / 2 }); cur = from.get(key(...cur)); }
    if (found) pts.push({ x: tx, y: ty });
    // keep only the turns that matter: from where he stands, and then from each point kept, the farthest point of the way that a
    // straight walk reaches over free floor (asked every 2 px), so the knight walks a few straight legs, not the grid's staircase
    const clear = (ax, ay, bx, by) => { const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 2); for (let q = 1; q < n; q++) if (!this.free(ax + (bx - ax) * q / n, ay + (by - ay) * q / n)) return false; return true; };
    const out = []; let ax = x0, ay = y0, n = 0;
    while (n < pts.length) { let far = n; for (let q = pts.length - 1; q > n; q--) if (clear(ax, ay, pts[q].x, pts[q].y)) { far = q; break; } out.push(pts[far]); ax = pts[far].x; ay = pts[far].y; n = far + 1; }
    if (!found) out.partial = true;
    return out;
  };
  // ------------------------------------------------------------------ the knight in the yard: the stick, tap to go, the doors' dwell
  // The page's clock steps him; nothing here touches the page. A knight is a body with what the walk remembers: his facing and frame,
  // the way a tap gave him (path, goal), how long he has pushed into a door (dwell), the door he last used (so it opens once a visit),
  // and where an arrival walks him to (walkTo: through the gate and a few steps on, the thumbs waiting meanwhile). at is an arrival's
  // name (spec.arrive) or { x, y, face, walkTo }
  Yard.prototype.knight = function (at) {
    const A = (typeof at === "string" ? this.spec.arrive[at] : at) || this.spec.arrive.menu, k = this.body(A.x, A.y);
    return Object.assign(k, { facing: A.face || "toward", anim: "idle", i: 0, at: 0, path: null, goal: null, dwell: 0, used: null, stuck: 0, walkTo: A.walkTo ? A.walkTo.slice() : null });
  };
  // tap to go: the knight sets out for a place (a door, the table, the well, a stall); false for a place the yard does not have
  Yard.prototype.goTo = function (k, id) {
    const t = this.targetOf(id); if (!t) return false;
    k.path = this.path(k.x, k.y, t.x, t.y); k.goal = k.path.partial ? null : id; k.stuck = 0; k.walkTo = null;
    return true;
  };
  // one step of dt seconds. (wx, wy) is the stick's or the keys' wish, each from -1 to 1; with none, a way given by a tap is walked.
  // allow(id), if given, says which places answer (the lessons make the rest inert). Returns { zone, use, auto }: the place the feet
  // stand in, the place to use now (a door pushed into for its dwell, or the place a tap sent him to, reached), and whether he walked
  // by himself. The doors that lead somewhere open by walking into them; the table, the well, the stalls and the shut doors never do
  Yard.prototype.tick = function (k, wx, wy, dt, allow) {
    const sp = this.spec.knight.speed; let auto = false, arrived = null;
    const m = Math.hypot(wx, wy); if (m > 1) { wx /= m; wy /= m; }
    if (k.walkTo) {
      const tx = k.walkTo[0] === null || k.walkTo[0] === undefined ? k.x : k.walkTo[0], ty = k.walkTo[1] === null || k.walkTo[1] === undefined ? k.y : k.walkTo[1], d = Math.hypot(tx - k.x, ty - k.y);
      if (d < 1) { k.walkTo = null; wx = 0; wy = 0; } else { wx = (tx - k.x) / d; wy = (ty - k.y) / d; auto = true; }
    } else if (wx || wy) { k.path = null; k.goal = null; }
    else if (k.path && k.path.length) {
      const p = k.path[0], dx = p.x - k.x, dy = p.y - k.y, dd = Math.hypot(dx, dy);
      if (dd < 2) { k.path.shift(); if (!k.path.length) { arrived = k.goal; k.path = null; k.goal = null; } }
      else { wx = dx / dd; wy = dy / dd; auto = true; }
    }
    if (wx || wy) {
      const bx = k.x, by = k.y;
      this.step(k, wx * sp, wy * sp, dt);
      // walking by himself and held up (a corner, a body in the way): after 0.3 s on to the next turn of the way, or he stops
      if (auto && Math.hypot(k.x - bx, k.y - by) < sp * dt * 0.25) { k.stuck += dt; if (k.stuck > 0.3) { k.stuck = 0; if (k.walkTo) k.walkTo = null; else if (k.path) { k.path.shift(); if (!k.path.length) { k.path = null; k.goal = null; } } } } else k.stuck = 0;
      k.facing = Math.abs(wx) > Math.abs(wy) ? (wx < 0 ? "left" : "right") : (wy < 0 ? "away" : "toward");
      if (k.anim !== "walk") { k.anim = "walk"; k.at = 0; }
      k.at += dt; k.i = Math.floor(k.at * 8) % 4;
    } else { if (k.anim !== "idle") { k.anim = "idle"; k.at = 0; } k.at += dt; k.i = Math.floor(k.at * 1.6) % 2; }
    let zone = this.zoneAt(k.x, k.y), use = null;
    if (zone && allow && !allow(zone.id)) zone = null;
    if (zone && zone.kind === "door" && zone.door.goes && !auto) {
      const side = zone.door.side, into = (side === "n" && wy < -0.3) || (side === "s" && wy > 0.3) || (side === "w" && wx < -0.3) || (side === "e" && wx > 0.3);
      if (into && k.used !== zone.id) { k.dwell += dt; if (k.dwell >= (zone.door.dwell || 0.35) - 1e-9) { k.used = zone.id; k.dwell = 0; use = zone; } } else k.dwell = 0;
    } else k.dwell = 0;
    if (arrived && zone && zone.id === arrived) { use = zone; k.used = zone.id; }
    if (!zone) k.used = null;
    return { zone, use, auto };
  };
  // the camera: the view (vw x vh world px) follows the feet with a dead zone, kept inside the yard; the feet sit aimY of the way down the
  // view (revision 1: 0.72, so the north face's two ways show from the middle of the yard)
  Yard.prototype.camera = function (cam, k, vw, vh, dt) {
    const C = this.spec.camera, D = C.dead, W = this.W, H = this.H;
    const ax = k.x - vw / 2, ay = C.aimY !== undefined ? k.y - C.aimY * vh : k.y - 16 - vh / 2;
    let tx = cam.x, ty = cam.y;
    if (dt === undefined) { tx = ax; ty = ay; }   // a snap (an arrival) places the knight exactly; a step keeps the dead zone
    else {
      if (ax > cam.x + D[0]) tx = ax - D[0]; else if (ax < cam.x - D[0]) tx = ax + D[0];
      if (ay > cam.y + D[1]) ty = ay - D[1]; else if (ay < cam.y - D[1]) ty = ay + D[1];
    }
    tx = Math.max(0, Math.min(Math.max(0, W - vw), tx)); ty = Math.max(0, Math.min(Math.max(0, H - vh), ty));
    if (vw >= W) tx = (W - vw) / 2; if (vh >= H) ty = (H - vh) / 2;
    if (dt === undefined) { cam.x = tx; cam.y = ty; } else { const sp = C.speed * dt; cam.x += Math.max(-sp, Math.min(sp, tx - cam.x)); cam.y += Math.max(-sp, Math.min(sp, ty - cam.y)); }
    return cam;
  };
  // the view on a screen (design pass 24 section 4.2): a whole number of device pixels to a world pixel, taken as the cellar takes it
  // (k from the whole frame over the cellar's 384 x 216 stage, so the knight is the cellar's knight), and as much of the yard as the
  // pane under the sign holds at that scale; a pane bigger than the yard shows the whole yard
  function fit(frameW, frameH, paneW, paneH, dpr, spec) {
    spec = spec || SPEC; dpr = dpr || 1;
    const V = spec.view || { w: 384, h: 216 }, k = Math.max(1, Math.floor(Math.min(frameH / V.h, frameW / V.w) * dpr)), per = k / dpr;
    // (design pass 30, build 19) the view is rounded up to the pane, never down, so no line of the pane's stone shows beside the yard; on
    // every iPhone the cellar's k already covers the pane (the frame's height sets it: k 5 at 852 x 393, a view of 512 x 207 of the 640)
    return { k, per, vw: Math.max(1, Math.min(spec.w, Math.ceil(paneW / per))), vh: Math.max(1, Math.min(spec.h, Math.ceil(paneH / per))) };
  }

  const api = { SPEC, R, Layer, Piece, shapes: { rect, ell, poly, or, not, seg }, Ground, Yard, tablePiece, smoke, sparks, FLAME, FIRE, FLASKS, hash, bay, OUT, fit, CELL, version: 1 };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.Courtyard = api;
})(typeof window !== "undefined" ? window : globalThis);
