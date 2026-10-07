// FORGE FOREVER: the Troll Gate's painter (design pass 12 revision 3, sections 3.2, 3.2b, 3.3, 3.4, 3.6a, 3.12 and 3.14; built by build 7
// stage G). The first level is a dusk field eight cellar widths long and two cellar heights tall, drawn in the cellar's grammar taken
// outdoors: an upright back band along the top (a dead blackthorn hedge, then a tumbled dry-stone wall with the castle's towers on the
// skyline), a floor seen from above, a dark verge along the bottom, and at the right end the castle front on a slant, facing the party.
// It is golden hour, the sun low on the left behind the party: light from the top left, the castle lit gold, long shadows to the right.
// The field is dark russet with gold tufts, so that the green trolls, and everything on the ground the player must see, read at k 5.
//
// What this file holds, and what the page (proto/battlegrounds.js) does with it:
//   Gate.paint(spec, col)              the unlit column tile, 384 x 432, as pixels: the sky, the back band, the ground, the flat pieces (the
//                                      road, the trenches, the pits, the caltrops, the ditch), the moat's water, the front lip and the castle
//                                      front's face. Deterministic for the area's seed; the same column paints the same twice
//   new Gate.Tiles(spec)               the eight tiles baked in time slices (work(ms, now)), the first two whole behind the arrival's fade,
//                                      a column the camera needs before its turn finished at once (a hitch, counted)
//   Gate.sprites                       every standing piece's art, baked once per kind, size and variant: { px, w, h, ox, oy, canvas() }
//   Gate.marks, Gate.telegraph         the decal stamps (lasting marks), the live marks' frames, the telegraphs by radius, length and frame
//   Gate.edgeMark, Gate.edgeMarks      the chevrons for trolls off the screen, and who gets one (section 3.14)
//   Gate.guideMark, sprites.arrow/go/bar  design pass 18: the yellow arrow over what to go to and use, its chevron at the view's edge, GO
//                                      at the right edge between the waves, the health bars over hit trolls, pieces, the gate and brothers
//   new Gate.Scene(spec)               the level on the stage: the ground and the decal canvases before the camera's translate, then every
//                                      actor in the order of its feet with the platform groups and drawing at height (section 3.2b)
//   new Gate.Scene(spec, art)          design pass 21: another level drawn by its own art module (proto/hall.js's Hall.art): its ground in
//                                      the same column tiles, its pieces, its light, weather, footprints and marks' looks through the hooks
//                                      the Scene's comment lists; with no art the Troll Gate's scene, unchanged
// The pixels are made without a DOM, so node can check them (tools/test-render.js); canvases are made only when a page asks.
// Plain script, defines window.Gate. Reads proto/trolls.js and proto/knight.js for the bodies, proto/cellar.js for the font and shadows.
(function (root) {
  "use strict";
  const OUT = "#181425";
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const TAU = Math.PI * 2;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  // the ramps (ENDESGA 32 and the Things' stone, oak, iron, leather and burlap tones; the few outdoor tones section 3.12 names)
  const R = {
    stone: ["#4a4450", "#6e6a70", "#9a948c", "#c4bcae"], oak: ["#3e2731", "#733e39", "#b86f50", "#e4a672"], iron: ["#262b44", "#3a4466", "#5a6988", "#8b9bb4"],
    steel: ["#3a4466", "#5a6988", "#8b9bb4", "#c0cbdc"], leather: ["#2a1d28", "#3e2731", "#733e39", "#b86f50"], burlap: ["#733e39", "#b86f50", "#e4a672", "#ead4aa"],
    hide: ["#3e2731", "#733e39", "#b86f50", "#c28569"], ground: ["#3e2731", "#733e39", "#b86f50", "#e4a672"], water: ["#262b44", "#124e89", "#0099db", "#2ce8f5"],
    fire: ["#a22633", "#e43b44", "#f77622", "#fee761"], bone: ["#c28569", "#e8b796", "#ead4aa", "#fffaf0"], charred: ["#181425", "#2a1d28", "#3e2731", "#5a6988"],
    canvas: ["#3a4466", "#5a6988", "#8b9bb4", "#c0cbdc"], blue: ["#124e89", "#0099db", "#2ce8f5", "#ffffff"], gold: ["#be4a2f", "#f77622", "#feae34", "#fee761"]
  };
  const SKY = ["#f6757a", "#e4a672", "#feae34"];             // the lower dusk bands (proto/dusk.js SKY), the sun low on the left
  const FAR = "#3e2731", FAR2 = "#231c2e", FAR3 = "#2c2540";  // the far tones: the castle on the skyline, the hedge's mass
  const JOINT = "#262036", DARK = "#120e1a";                 // the castle's joints; the arch's and the breaches' dark
  const MOSS = ["#193c3e", "#265c42"], REED = "#265c42", LIT = ["#c28569", "#e4a672"], RED = "#ff0044", BONE = "#ead4aa";
  const SHADOW = "rgba(10,6,18,0.45)";
  const PALETTE = Array.from(new Set([].concat(...Object.values(R), SKY, [OUT, FAR, FAR2, FAR3, JOINT, DARK, REED, RED, BONE, "#ffffff", "#8b9bb4", "#c0cbdc", "#b8f4ff", "#fee761", "#feae34", "#f77622", "#a22633", "#3e8948", "#63c74d", "#b4e67a"], MOSS, LIT)));

  // ------------------------------------------------------------------ hashes and noise (the seed's, never Math.random)
  function hash(x, y, k) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul((k | 0) + 1, 2246822519)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
  const smooth = t => t * t * (3 - 2 * t);
  // value noise at lattice scale s, 0 to 1
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
  function line(x0, y0, x1, y1, w) {
    const s = new Set(), n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 + 1, a = -((w - 1) >> 1), b = w >> 1;
    for (let i = 0; i <= n; i++) { const t = i / n, x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t); for (let dx = a; dx <= b; dx++) for (let dy = a; dy <= b; dy++) s.add((x + dx) + "," + (y + dy)); }
    return (x, y) => s.has(x + "," + y);
  }
  // a region lit from the top left: the ramp's light tone on its upper-left edge, its dark tone on its lower-right edge; o.ball shades it
  // as a round mass, o.spec puts the glint, o.flat one tone, o.tex a texture over the tone
  function region(sp, pred, ramp, o) {
    o = o || {}; const W = sp.W, H = sp.H, m = (x, y) => x >= 0 && y >= 0 && x < W && y < H && pred(x, y);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m(x, y)) {
      let c;
      if (o.ball) { const [cx, cy, r] = o.ball, d = ((x - cx) * 0.7 + (y - cy) * 0.7) / r; c = ramp[d < -0.45 ? 3 : d < -0.05 ? 2 : d < 0.5 ? 1 : 0]; if (ramp[3] === "#ffffff" && d < -0.45) c = ramp[2]; }
      else { const ul = !m(x - 1, y) || !m(x, y - 1), dr = !m(x + 1, y) || !m(x, y + 1); c = ul && dr ? ramp[1] : dr ? ramp[0] : ul ? ramp[2] : ramp[1]; }
      if (o.spec && o.spec(x, y)) c = ramp[3];
      if (o.flat !== undefined) c = ramp[o.flat];
      if (o.tex) c = o.tex(x, y, c) || c;
      sp.set(x, y, c);
    }
  }
  function outline(sp) { const W = sp.W, H = sp.H, add = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!sp.get(x, y) && (sp.get(x - 1, y) || sp.get(x + 1, y) || sp.get(x, y - 1) || sp.get(x, y + 1))) add.push([x, y]); for (const [x, y] of add) sp.set(x, y, OUT); }
  // rows of characters through a palette ("." is empty) onto a grid at (x, y)
  function paintChars(sp, rows, pal, x, y, flip) { const w = rows[0].length; for (let j = 0; j < rows.length; j++) for (let i = 0; i < w; i++) { const ch = rows[j][i]; if (ch === "." || !pal[ch]) continue; sp.set(x + (flip ? w - 1 - i : i), y + j, pal[ch]); } }
  // a pixel array as a canvas (only in a page); the canvas remembers its pixels, so a test's fake canvas can say what was drawn
  const RGB = new Map();
  // a colour's channels and its alpha, 0 to 255: "#rrggbb", or the shadows' "rgba(r,g,b,a)"
  function rgb(c) { let v = RGB.get(c); if (!v) { if (c.charAt(0) === "#") v = [1, 3, 5].map(k => parseInt(c.slice(k, k + 2), 16)).concat(255); else { const q = (c.match(/[\d.]+/g) || []).map(Number); v = [q[0] | 0, q[1] | 0, q[2] | 0, q.length > 3 ? Math.round(q[3] * 255) : 255]; } RGB.set(c, v); } return v; }
  function canvasOf(px, w, h) {
    const c = root.document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d");
    if (g.createImageData && g.putImageData) {
      const img = g.createImageData(w, h), d = img.data;
      for (let i = 0; i < w * h; i++) { const col = px[i]; if (!col) continue; const [r, gg, b, a] = rgb(col), o = i * 4; d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = a; }
      g.putImageData(img, 0, 0);
    } else for (let i = 0; i < w * h; i++) { const col = px[i]; if (!col) continue; g.fillStyle = col; g.fillRect(i % w, (i / w) | 0, 1, 1); }
    c.px = px; c.pw = w; c.ph = h;
    return c;
  }
  // a small sprite: its pixels, size and anchor (drawn with (ox, oy) on its point), and its canvas on first use (the canvas remembers its
  // sprite, so a test's fake canvas can say which was drawn)
  function sprite(px, w, h, ox, oy, extra) { return Object.assign({ px, w, h, ox: ox || 0, oy: oy || 0, _c: null, canvas() { if (!this._c) { this._c = canvasOf(this.px, this.w, this.h); this._c.sprite = this; } return this._c; } }, extra || {}); }
  const gridSprite = (sp, ox, oy, extra) => sprite(sp.px, sp.W, sp.H, ox, oy, extra);
  const cache = new Map();
  const once = (key, make) => { let v = cache.get(key); if (!v) { v = make(); cache.set(key, v); } return v; };

  // ------------------------------------------------------------------ the tiles: the still ground, column by column
  const TW = 384, TH = 432;
  const FLOOR_TOP = 64, LIP = 424, HEDGE_TOP = 34, WALL_TOP = 40;
  // what the painter needs of the area, found once: the pieces by column, the back band's kinds and gaps, the outposts' trodden rings...
  const prepared = new WeakMap();
  function prepare(A) {
    let P = prepared.get(A);
    if (P) return P;
    const seed = A.seed || 1210;
    P = { A, seed, holes: [], caltrops: [], trodden: [], stone: [], gaps: (A.backGaps || []).slice(), ditch: [], band: A.backBand || [], castle: A.castle || null, moat: A.moat || null,
      road: A.road || null, breaches: ((A.castle || {}).breaches || {}).slots || [], arch: null, towers: [] };
    for (const p of A.props || []) {
      const pk = (A.propKinds || {})[p.kind] || {};
      if (pk.hole) P.holes.push(Object.assign({ kind: p.kind, depth: pk.hole.depth }, p));
      else if (p.kind === "caltrops") {
        const list = [];   // one four-point spike for about every 6 x 6 of the patch, each jittered in its cell
        for (let cy = p.y0 + 3; cy < p.y1; cy += 6) for (let cx = p.x0 + 3; cx < p.x1; cx += 6) list.push([cx + Math.floor(hash(cx, cy, seed + 5) * 3) - 1, cy + Math.floor(hash(cx, cy, seed + 6) * 3) - 1]);
        P.caltrops.push({ x0: p.x0 - 2, y0: p.y0 - 2, x1: p.x1 + 2, y1: p.y1 + 2, list });
      }
    }
    for (const op of A.outposts || []) { for (const h of op.huts || []) P.trodden.push({ x: h[0], y: h[1], r: op.r + 14 }); if (op.fire) P.trodden.push({ x: op.fire[0], y: op.fire[1], r: 18, fire: true }); }
    for (const p of A.props || []) if (p.kind === "burntTent" || (p.kind === "cart" && p.over)) P.trodden.push({ x: (p.x0 + p.x1) / 2, y: (p.y0 + p.y1) / 2, r: Math.max(p.x1 - p.x0, p.y1 - p.y0) / 2 + 10, light: true });
    for (const r of A.rocks || []) if (r.r >= ((A.propKinds || {}).rock || {}).big || r.r >= 12) P.stone.push({ x: r.x, y: r.y, r: r.r });
    for (const d of (A.doors || {}).ditch1 || []) P.ditch.push(d[0]);
    if (P.castle && P.castle.gatehouse) { const g = P.castle.gatehouse, v = g.arch.v; P.arch = { x0: (P.castle.foot.u + v[0]) / 2, x1: (P.castle.foot.u + v[1]) / 2, h: g.arch.h, block: g.h, cx: g.at[0] }; }
    prepared.set(A, P);
    return P;
  }
  const bandKind = (P, x) => { for (const b of P.band) if (x >= b.x0 && x < b.x1) return b.kind; return null; };
  // the sky's three bands, dithered one into the next
  function sky(x, y) { const b = y < 12 ? 0 : y < 24 ? 1 : 2, edge = (b + 1) * 12; if (b < 2 && y >= edge - 3) return dith(x, y, (y - (edge - 3) + 1) / 4) ? SKY[b + 1] : SKY[b]; return SKY[b]; }
  // the castle's towers on the skyline (from S5 to the castle front): a flat far tone, crenellated, with towers
  const SKYLINE_TOWERS = [1612, 1760, 1930, 2100, 2270, 2440, 2590];
  function skylineTop(x) {
    for (const t of SKYLINE_TOWERS) if (x >= t - 7 && x < t + 7) return 9 + Math.floor(hash(t, 0, 2) * 4) + (x === t - 7 || x === t + 6 ? 2 : 0) - (((x - t + 7) % 4) < 2 ? 2 : 0);
    return ((Math.floor(x / 4) % 2) === 0) ? 22 : 26;
  }
  // the ground: russet dithered with its lighter tone by value noise, sparse gold highlights
  function groundAt(P, x, y) {
    const n = vnoise(x, y, 12, P.seed);
    if (hash(x, y, P.seed + 1) > 0.988 && n > 0.45) return R.ground[3];
    return dith(x, y, n * 0.9) ? R.ground[2] : R.ground[1];
  }
  // the pixel of the still world at (x, y): what the tile holds
  function pixel(P, x, y) {
    const A = P.A, u = x - y;
    const castle = P.castle && u >= P.castle.foot.u && x >= P.castle.foot.from[0] - 1;
    if (castle) return castleAt(P, x, y, u);
    // the moat along the front's foot, a deep still water
    if (P.moat && y >= FLOOR_TOP && y < LIP && u >= P.moat.u[0] && u < P.moat.u[1]) return moatAt(P, x, y, u);
    if (y >= LIP) return lipAt(P, x, y);
    const kind = bandKind(P, x), top = kind === "hedge" ? HEDGE_TOP : WALL_TOP;
    if (y < FLOOR_TOP) {
      if (kind === "hedge") return y < hedgeTop(P, x) - 1 ? sky(x, y) : y === hedgeTop(P, x) - 1 ? OUT : hedgeAt(P, x, y);
      if (kind === "drystone") { if (y < wallTop(P, x) - 1) return x >= 1536 && y >= skylineTop(x) ? FAR : sky(x, y); if (y === wallTop(P, x) - 1) return OUT; return wallAt(P, x, y); }
      // past the wall's end, before the castle: the bank runs up to the front's foot
      if (y < top) return x >= 1536 && y >= skylineTop(x) ? FAR : sky(x, y);
      return groundAt(P, x, y);
    }
    // the floor band
    let c = null;
    // the hedge's end at the world's left edge, where the road comes in through it
    if (x < 8 && !(y >= 118 && y < 150)) return hedgeMass(P, x, y);
    if (x === 8 && !(y >= 118 && y < 150)) return OUT;
    for (const h of P.holes) if (x >= h.x0 && x < h.x1 && y >= h.y0 && y < h.y1) return h.kind === "pit" ? pitAt(P, h, x, y) : trenchAt(P, h, x, y);
    for (const h of P.holes) { c = holeLip(P, h, x, y); if (c) return c; }
    for (const cp of P.caltrops) if (x >= cp.x0 && x < cp.x1 && y >= cp.y0 && y < cp.y1) for (const [cx, cy] of cp.list) { const dx = Math.abs(x - cx), dy = Math.abs(y - cy); if (dx + dy <= 1) return dx + dy === 0 ? R.iron[1] : R.iron[3]; }
    c = groundAt(P, x, y);
    // the bank's mud east of the gallows road, from about the wall's broken end (x 2656): its edge wanders by value noise and it is
    // dithered in over 48 px, never a straight column; trodden earth round the outposts and in the siege camp; bare stone among the boulders
    if (P.moat && x >= 2620) { const m = clamp((x - 2656 + (vnoise(x, y, 14, P.seed + 12) - 0.5) * 40) / 48, 0, 1);
      if (m > 0 && dith(x + 1, y + 2, m)) { const n = vnoise(x, y, 10, P.seed + 2); c = dith(x, y, n * 0.75) ? R.ground[1] : R.ground[0]; if (n > 0.55 && dith(x, y, 0.12)) c = R.ground[2]; } }
    for (const t of P.trodden) { const d = Math.hypot(x - t.x, y - t.y); if (d < t.r && dith(x, y, (t.light ? 0.35 : 0.6) * (1 - d / t.r) + 0.1)) { c = R.ground[0]; break; } }
    for (const s of P.stone) { const d = Math.hypot(x - s.x, y - s.y) - s.r; if (d < 10 && dith(x, y, 0.55 * (1 - d / 10))) { c = hash(x, y, 3) < 0.3 ? R.stone[0] : R.stone[1]; break; } }
    // the road: two ruts of trodden earth, the bed between them lightly trodden, fading out
    if (P.road && x < P.road.x1) { const a = x < 300 ? 1 : 1 - (x - 300) / (P.road.x1 - 300); let rut = false; for (const [r0, r1] of P.road.ruts) if (y >= r0 && y <= r1) rut = true;
      if (rut && dith(x, y, a)) c = R.ground[0]; else if (y > P.road.ruts[0][1] && y < P.road.ruts[1][0] && dith(x, y, 0.3 * a)) c = R.ground[2]; }
    // the trodden earth under a back gap and the ditch's notches, where trolls come in
    for (const g of P.gaps) if (Math.abs(x - g) <= 9 && y < FLOOR_TOP + 8 && dith(x, y, 1 - (y - FLOOR_TOP) / 8)) c = R.ground[0];
    for (const d of P.ditch) if (Math.abs(x - d) <= 8 && y >= 418 && dith(x, y, 0.5 + (y - 418) / 12)) c = R.ground[0];
    // the moat's reeds on the bank's edge
    if (P.moat && u >= P.moat.u[0] - 8 && u < P.moat.u[0]) { const v = x + y; for (let k = 0; k <= 2; k++) { const vb = v + k, ub = u - k; if (hash(vb, 1, 7) < 0.3 && ub === P.moat.u[0] - 2 - Math.floor(hash(vb, 2, 7) * 3) && (vb & 1) === ((ub & 1))) c = k === 2 && hash(vb, 3, 7) < 0.5 ? "#3e8948" : REED; } }
    // a soft shadow at the back band's foot, as in the cellar
    if (y < FLOOR_TOP + 5 && dith(x, y, 1 - (y - FLOOR_TOP) / 5)) c = R.ground[0];
    return c;
  }
  const hedgeTop = (P, x) => HEDGE_TOP + Math.round(vnoise(x, 7, 6, P.seed) * 4) - 2;
  const wallTop = (P, x) => WALL_TOP + Math.round(vnoise(x, 1, 9, P.seed) * 3);
  // the hedge: a dead blackthorn on a low earth bank, bare branches, soot along its top; its 16 px troll gaps are dark hollows
  function hedgeAt(P, x, y) {
    for (const g of P.gaps) if (Math.abs(x - g + 0.5) < 8 && y >= 44) { if (y < 58) return Math.abs(x - g + 0.5) > 6.5 ? FAR2 : OUT; return R.ground[0]; }
    if (y >= 60) return dith(x, y, (y - 59) / 5) ? R.ground[1] : R.ground[0];
    if (y >= 57) return R.ground[0];
    return hedgeMass(P, x, y);
  }
  function hedgeMass(P, x, y) {
    const top = hedgeTop(P, x);
    if (y <= top + 1) return FAR;   // the lit rim
    if (((x + 2 * y) % 9 === 0 && hash(x, y, 4) > 0.35) || ((x * 7 + y) % 13 === 0 && y < top + 8)) return y < top + 6 ? R.ground[1] : FAR;
    return vnoise(x, y, 5, P.seed + 3) > 0.56 ? FAR3 : FAR2;
  }
  // the dry-stone field wall: tumbled courses of the Things stone ramp, its gaps dark hollows with trodden earth
  function wallAt(P, x, y) {
    for (const g of P.gaps) if (Math.abs(x - g + 0.5) < 8 && y >= 46) { if (y < 60) return Math.abs(x - g + 0.5) > 6.5 ? R.stone[0] : OUT; return R.ground[0]; }
    if (y >= 62) return R.ground[0];
    const c = Math.floor((y - 38) / 5), row = (y - 38) % 5, s = Math.floor((x + c * 4) / 9), col = (x + c * 4) % 9;
    if (row === 0 || col === 0) return R.stone[0];
    const tone = hash(s, c, 8) < 0.6 ? R.stone[1] : R.stone[2];
    if (row === 1 && hash(s, c, 9) < 0.6) return R.stone[3];
    if (row === 4) return R.stone[0];
    return tone;
  }
  // the front lip: blackthorn tops over the ditch's edge, with worn notches where trolls climb out
  function lipAt(P, x, y) {
    for (const d of P.ditch) if (Math.abs(x - d) <= 8) return dith(x, y, 0.5 + (y - 418) / 12) ? R.ground[0] : R.ground[1];
    if (y === LIP) return OUT;
    if (y >= TH - 2) return dith(x, y, 0.6) ? OUT : FAR2;
    return vnoise(x, y, 4, P.seed + 4) > 0.5 ? FAR3 : FAR2;
  }
  // a spike pit: the dark seen through its lip, sharpened stake tips standing out of it
  function pitAt(P, h, x, y) {
    const gx = Math.floor((x - h.x0) / 6), gy = Math.floor((y - h.y0) / 6);
    const sx = h.x0 + gx * 6 + 2 + Math.floor(hash(gx, gy, 12) * 3), sy = h.y0 + gy * 6 + 2 + Math.floor(hash(gx, gy, 13) * 3);
    if (x === sx && (y === sy || y === sy + 1) && sy + 1 < h.y1) return y === sy ? R.ground[3] : R.ground[2];
    return dith(x, y, 0.35 * vnoise(x, y, 6, P.seed + 5)) ? FAR2 : OUT;
  }
  // a trench: its floor sunk, its far wall in shadow, plank revetments, a lip of thrown-up earth on its near side
  function trenchAt(P, h, x, y) {
    if (x === h.x0 || x === h.x1 - 1 || y === h.y0 || y === h.y0 + 1) return FAR2;
    if (y === h.y0 + 2 || y === h.y1 - 1) return (x - h.x0) % 8 === 4 ? R.ground[0] : R.ground[1];
    return dith(x, y, 0.3 * (1 - (y - h.y0) / (h.y1 - h.y0))) ? FAR2 : R.ground[0];
  }
  // a hole's lip: trodden earth round a pit (its near lip lit), thrown-up earth along a trench's near side
  function holeLip(P, h, x, y) {
    if (h.kind === "pit") {
      if (x >= h.x0 - 2 && x < h.x1 + 2 && y >= h.y0 - 2 && y < h.y1 + 2) { if (y >= h.y1) return y === h.y1 ? R.ground[2] : R.ground[1]; return dith(x, y, 0.8) ? R.ground[0] : R.ground[1]; }
      return null;
    }
    if (x >= h.x0 && x < h.x1 && y >= h.y1 && y < h.y1 + 2) return dith(x, y, y === h.y1 ? 0.8 : 0.4) ? (hash(x, y, 14) < 0.15 ? R.ground[3] : R.ground[2]) : null;
    return null;
  }
  // the moat: still, green-black water (section 3.12: the water ramp darkened toward #193c3e), greener and darker toward the wall, the
  // ramp's blue only where the value noise peaks and a rare lit ripple; a shadow under the bank's edge. Its shimmer is live (drawFloor)
  function moatAt(P, x, y, u) {
    if (u < P.moat.u[0] + 3) return R.water[0];
    const n = vnoise(x, y, 8, P.seed + 8), deep = (u - P.moat.u[0]) / (P.moat.u[1] - P.moat.u[0]);
    if (deep < 0.7 && n > 0.84 && dith(x, y, (n - 0.84) * 2.5)) return R.water[2];
    if (hash(x, y, 15) > 0.994) return R.water[2];
    if (deep < 0.8 && n > 0.6 && dith(x + 2, y + 1, (n - 0.6) * (1.5 - deep))) return R.water[1];
    return dith(x, y, 0.35 + 0.45 * n + 0.2 * deep) ? MOSS[0] : R.water[0];
  }
  // the castle front, painted in screen columns and heights and sheared one pixel down per column (u = x - y is the height above the
  // foot plus the foot's u): its courses, merlons and moat run at 45 degrees, its verticals stay vertical
  function castleAt(P, x, y, u) {
    const CA = P.castle, h = u - CA.foot.u, face = CA.face || 72, walk = CA.walk || 24;
    const AR = P.arch, inBlock = AR && x >= AR.x0 - 9 && x < AR.x1 + 9;
    // the broken north end, where the west tower fell: the wall tumbles down to nothing at its first columns
    const ruin = x < CA.foot.from[0] + 48 ? Math.max(0, Math.floor((x - CA.foot.from[0]) * 1.6 + vnoise(x, 0, 5, P.seed + 9) * 10 - 6)) : 999;
    const top = inBlock ? AR.block : face;
    if (h < Math.min(top, ruin)) {
      // the face: the arch and the breaches are dark holes in it
      if (AR && x >= AR.x0 && x < AR.x1) {
        const cx = (AR.x0 + AR.x1 - 1) / 2, half = (AR.x1 - AR.x0) / 2, hh = AR.h - half;
        if (h < hh || Math.abs(x - cx) <= half * Math.sqrt(Math.max(0, 1 - ((h - hh) / half) ** 2))) return DARK;
        if (h < AR.h + 1 && Math.abs(x - cx) <= half * Math.sqrt(Math.max(0, 1 - ((h - hh - 1) / (half + 1)) ** 2))) return R.stone[3];
      }
      for (const [bx] of P.breaches) {
        const hw = h > 32 ? 7 - Math.floor((h - 32) / 2) : 7, j = Math.floor(hash(x, Math.floor(h / 3), 16) * 2);
        if (h >= 16 && h < 42 && Math.abs(x - bx) < hw - j) return DARK;
        if (h >= 12 && h < 16 && Math.abs(x - bx) < 9) return dith(x, y, 0.6) ? R.stone[1] : R.stone[0];
      }
      if (inBlock) {
        // the gatehouse block: its arrow loops, the old arms defaced with a green hand, the machicolated top
        if ((x === AR.x0 - 5 || x === AR.x0 - 4 || x === AR.x1 + 3 || x === AR.x1 + 4) && h >= 28 && h < 40) return DARK;
        // the castle's old arms over the arch, where the note's gatehouse drawing puts them: a shield 13 columns wide from h 62 to 78 (so
        // that it stands clear over the 65 px raised face), blue with a gold chevron, defaced with the trolls' green hand, edged in soot;
        // the chains' holes at h 82 to 86 in the two columns beside the arch
        const ax = x - AR.cx, aw = Math.abs(ax), narrow = Math.max(0, 66 - h) * 0.8;
        if (h >= 62 && h < 79 && aw <= 6 - narrow) { if (ax * ax + (h - 70) * (h - 70) < 6 || ((aw === 1 || aw === 3) && h >= 72 && h <= 76)) return MOSS[1]; if (Math.abs(h - 72 + aw * 0.8) < 1.2) return "#feae34"; return R.blue[0]; }
        if (h >= 61 && h <= 79 && aw <= 7 - narrow) return OUT;
        if ((x === AR.x0 - 2 || x === AR.x0 - 1 || x === AR.x1 || x === AR.x1 + 1) && h >= 82 && h < 87) return DARK;
        if (h >= AR.block - 8) { const m = Math.floor((x + 2) / 5) % 2; if (h >= AR.block - 4) return m ? R.stone[2] : JOINT; return m && ((x + 2) % 5) === 2 ? JOINT : R.stone[3]; }
      }
      return courseAt(P, x, h, u);
    }
    if (ruin < face && h < ruin + 3) return dith(x, y, 0.5) ? R.stone[1] : R.stone[0];   // the ragged broken top
    if (h < top + 8 && !inBlock && ruin >= face) {
      // the merlons along the top, one in four missing; between them the wall-walk shows
      const m = Math.floor(x / 11), inM = (x % 11) < 6;
      if (inM && m % 4 !== 3) return (x % 11) === 5 ? R.stone[1] : (x % 11) === 0 ? R.stone[3] : R.stone[2];
      return walkAt(P, x, y);
    }
    if (h < top + 8 + walk) return walkAt(P, x, y);
    return roofsAt(P, x, y, h - top - 8 - walk);
  }
  // a course of warm stone: blocks 8 columns wide and 6 high, staggered, joints dark, the lit edges gold, moss down a third of the joints,
  // two long cracks
  function courseAt(P, x, h, u) {
    const c = Math.floor(h / 6), row = h % 6, off = (c % 2) * 4, col = (x + off) % 8, b = Math.floor((x + off) / 8);
    for (const cx of [2731, 3011]) { const d = x - cx - Math.round(Math.sin(h * 0.45) * 2 + Math.sin(h * 0.13) * 3); if (h >= 20 && h < 70 && d === 0) return JOINT; }
    if (row === 0 || col === 0) { if (hash(b, c, 17) < 0.3 && row > 0 && row < 4 + Math.floor(hash(b, c, 18) * 3)) return hash(b, c, 19) < 0.5 ? MOSS[0] : MOSS[1]; return JOINT; }
    if (row === 5) return hash(b, c, 20) < 0.7 ? LIT[0] : R.stone[3];
    if (col === 1 && dith(x, h, 0.6)) return LIT[1];
    const tone = hash(b, c, 21);
    return tone < 0.2 ? R.stone[1] : tone < 0.85 ? R.stone[2] : R.stone[3];
  }
  // the wall-walk, flags seen from above
  function walkAt(P, x, y) { return ((x - y) % 6 === 0 || (x + y) % 9 === 0) ? R.stone[0] : dith(x, y, 0.35) ? R.stone[2] : R.stone[1]; }
  // beyond the walk the castle's roofs and its keep in far tones, up to the top of the world
  function roofsAt(P, x, y, k) {
    const keep = x >= 2896 && x < 3000;
    if (keep && k >= 40) { if (k < 44 || (k >= 120 && k < 126 && (Math.floor(x / 6) % 2))) return FAR2; if (k >= 126) return sky(x, Math.min(39, Math.max(0, 20 - (k - 126)))); const jr = k % 7 === 0, jc = (x + Math.floor(k / 7) * 3) % 10 === 0; return jr || jc ? FAR2 : (hash(x, k, 22) > 0.993 ? LIT[1] : FAR); }
    const slope = ((x + k) % 14), ridge = k % 18 === 0;
    if (k >= 140 + (Math.floor(x / 20) % 3) * 6) return sky(x, Math.max(0, Math.min(39, 30 - (k - 140) / 3)));
    return ridge ? FAR2 : slope < 7 ? (dith(x, y, 0.5) ? FAR3 : FAR) : FAR;
  }
  // paint rows y0 to y1 (exclusive) of column col into px
  function paintRows(A, col, y0, y1, px) {
    const P = prepare(A), X0 = col * TW;
    for (let y = y0; y < y1; y++) for (let x = 0; x < TW; x++) px[y * TW + x] = pixel(P, X0 + x, y);
    return px;
  }
  function paint(A, col) { const px = new Array(TW * TH).fill(null); paintRows(A, col, 0, TH, px); return { px, W: TW, H: TH, col }; }
  // the eight tiles baked in time slices: S1 and S2 whole (behind the gate plate and the arrival's fade), then the rest in column order in
  // slices of at most `budget` ms a call (work), from the first frame of the walk; a column the camera needs before its turn is finished
  // at once and counted as a hitch (?perf logs it)
  // (the clock is read after every two rows, so a slice overshoots its budget by a fraction of a millisecond at most, and each band of
  // rows goes into the column's canvas as it is painted, so no frame pays for turning a whole tile into a canvas)
  // (art: a level's own art, design pass 21: its paintRows paints the columns in place of the gate's ground)
  function Tiles(A, art) {
    this.A = A; this.n = Math.ceil((A.w || 3072) / TW); this.tiles = []; this.hitches = 0; this.rowsPer = 2;
    this.rows = art && art.paintRows ? art.paintRows : paintRows;
    for (let c = 0; c < this.n; c++) this.tiles.push({ px: new Array(TW * TH).fill(null), rows: 0, canvas: null, ctx: null, put: 0, done: false });
  }
  // rows y0 to y1 of a tile, painted, into its canvas (in a page; node has no canvas and reads the pixels)
  Tiles.prototype.band = function (t, y0, y1) {
    if (y1 <= y0 || !root.document || !root.document.createElement) return;
    if (!t.canvas) { const cv = root.document.createElement("canvas"); cv.width = TW; cv.height = TH; const g = cv.getContext("2d"); if (!g || !g.createImageData || !g.putImageData) return; t.canvas = cv; t.ctx = g; }
    const img = t.ctx.createImageData(TW, y1 - y0), d = img.data;
    for (let y = y0; y < y1; y++) for (let x = 0; x < TW; x++) { const col = t.px[y * TW + x]; if (!col) continue; const [r, gg, b] = rgb(col), o = ((y - y0) * TW + x) * 4; d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255; }
    t.ctx.putImageData(img, 0, y0); t.put = y1;
  };
  Tiles.prototype.finish = function (col) { const t = this.tiles[col]; if (!t || t.done) return t; const rows = this.rows; rows(this.A, col, t.rows, TH, t.px); this.band(t, t.rows, TH); t.rows = TH; t.done = true; return t; };
  Tiles.prototype.allDone = function () { return this.tiles.every(t => t.done); };
  // paint the next rows within a budget (ms, by now()); returns true while there is work left
  Tiles.prototype.work = function (budget, now) {
    const t0 = now ? now() : 0, rows = this.rows;
    let slices = 0;
    for (const [c, t] of this.tiles.entries()) {
      while (!t.done) {
        const y1 = Math.min(TH, t.rows + this.rowsPer);
        rows(this.A, c, t.rows, y1, t.px); this.band(t, t.rows, y1); t.rows = y1; slices++;
        if (t.rows >= TH) t.done = true;
        if (now ? now() - t0 >= budget : slices >= 8) return !this.allDone();
      }
    }
    return false;
  };
  // the column's canvas (filled band by band as its rows were painted; made whole from the pixels where no band could be put); a column
  // not yet done is finished now, a hitch
  Tiles.prototype.canvas = function (col) {
    const t = this.tiles[col]; if (!t) return null;
    if (!t.done) { this.hitches++; this.finish(col); }
    if (t.canvas && t.put >= TH) return t.canvas;
    return (t.canvas = canvasOf(t.px, TW, TH));
  };

  // ------------------------------------------------------------------ the pieces' art (section 3.12), baked once per kind, size and variant
  // Every sprite is { px, w, h, ox, oy, canvas() }, drawn with (ox, oy) on the piece's foot (a circle's centre, a rect's bottom-left) so it
  // sorts by that foot with the bodies. Deep pieces (carts, tents, rubble, the engines) are drawn in 8 px slices by the scene (drawSliced).
  const G = (w, h) => new Grid(w, h);
  const done = (sp, ox, oy, extra) => { outline(sp); return gridSprite(sp, ox, oy, extra); };
  // the ground's long shadow of a standing thing: 6 px to the right, a soft ellipse (alpha, so it is a canvas of its own, made in a page)
  function longShadow(r) {
    return once("lshadow" + r, () => { const w = 2 * r + 9, h = Math.max(3, Math.round(r * 0.8)) + 1, ry = h / 2; const px = new Array(w * h).fill(null);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (((x - (r + 4)) / (r + 4)) ** 2 + ((y - ry + 0.5) / ry) ** 2 <= 1) px[y * w + x] = SHADOW;
      return sprite(px, w, h, r - 2, Math.round(ry), { alpha: true }); });
  }
  // the soft elliptical drop shadow under a body (Cellar.shadow's pixels: 2w + 1 wide, 3 tall, anchored at its centre row); low: a knight
  // at 30 HP or less (section 3.8) stands on the same ellipse dithered in #a22633, the one standing low-HP cue where there is no HP bar
  function bodyShadow(w, low) {
    w = Math.max(1, Math.round(w));
    return once("bshadow" + w + (low ? "L" : ""), () => { const W = 2 * w + 1, px = new Array(W * 3).fill(null);
      for (let dx = -w; dx <= w; dx++) { const h = Math.max(1, Math.round(Math.sqrt(1 - (dx / (w + 0.5)) ** 2) * 2)); for (let r = 2 - h; r <= h; r++) px[r * W + dx + w] = low && dith(dx + w, r, 0.5) ? "#a22633" : SHADOW; }
      return sprite(px, W, 3, w, 1, { alpha: true, low: !!low }); });
  }
  const SPR = {};
  // a rock (r 7 to 9) or a boulder (r 14 to 18): the stone ramp as a round mass, a moss cap on the lit top left, cracks on the big ones;
  // cracked: a rock a brute has charged
  SPR.rock = (r, cracked) => once("rock" + r + (cracked ? "c" : ""), () => {
    const ry = Math.round(r * 0.8), w = 2 * r + 3, h = r + ry + 3, cx = r + 1, cy = ry + 1, sp = G(w, h);
    region(sp, (x, y) => ((x - cx) / r) ** 2 + ((y - cy) / ry) ** 2 <= 1 || (y >= cy && y <= cy + 1 && Math.abs(x - cx) <= r - 1), R.stone, { ball: [cx - r * 0.3, cy - ry * 0.4, r], spec: (x, y) => x === cx - Math.round(r * 0.4) && y === cy - Math.round(ry * 0.5) });
    for (let i = 0; i < Math.max(3, r - 2); i++) { const a = -2.2 + i * 0.35; sp.set(cx + Math.cos(a) * (r - 1.5), cy + Math.sin(a) * (ry - 1.5), MOSS[1]); if (r >= 12 && i % 2) sp.set(cx + Math.cos(a) * (r - 2.5), cy + Math.sin(a) * (ry - 2.5), MOSS[0]); }
    if (r >= 12 || cracked) { let x = cx + 2, y = cy - 1; for (let i = 0; i < (cracked ? 7 : 4); i++) { sp.set(x, y, R.stone[0]); x += hash(i, r, 30) < 0.6 ? 1 : 0; y += 1; } }
    if (cracked) for (let i = 0; i < 5; i++) sp.set(cx - 3 + i, cy - 3 + (i % 2), R.stone[0]);
    return done(sp, cx, cy);
  });
  // a palisade log: 5 px wide, 18 tall, a sharpened tip, dark oak lashed with rope; two variants; fallen frames f 1 to 3 lean east, 4 lies flat
  SPR.log = (v, f) => once("log" + v + "|" + (f | 0), () => {
    if (f >= 4) { const sp = G(23, 7); region(sp, (x, y) => (x >= 1 && x <= 20 && y >= 2 && y <= 4) || (x >= 18 && x <= 21 && y === 3), ["#3e2731", "#3e2731", "#733e39", "#b86f50"]); for (const x of [6, 12]) sp.set(x, 2, R.oak[3]); return done(sp, 1, 5); }
    const lean = (f | 0) * 5, w = 7 + lean, h = 21, sp = G(w, h), tip = v ? 2 : 3;
    const body = (x, y) => { const t = (h - 2 - y) / (h - 2), xx = x - t * lean; return y >= tip && y <= h - 2 && xx >= 1 && xx <= 5 && !(y < tip + 3 && Math.abs(xx - 3) > (y - tip) * 0.8); };
    region(sp, body, ["#3e2731", "#3e2731", "#733e39", "#b86f50"], { spec: (x, y) => y === tip + 1 && Math.round(x - (h - 2 - y) / (h - 2) * lean) === 3 });
    for (const y of [9, 10, 14]) { const sh = Math.round((h - 2 - y) / (h - 2) * lean); for (let x = 1; x <= 5; x++) sp.set(x + sh, y, y === 14 ? R.oak[3] : "#e4a672"); }
    return done(sp, 3, h - 2);
  });
  // a troll gate in the palisade: shorter lashed stakes on a crossbar, shut, or swung open on two frames (a gap for the troll)
  SPR.gate = f => once("pgate" + (f | 0), () => {
    const w = 11, h = 19, sp = G(w, h), open = Math.min(2, f | 0);
    region(sp, (x, y) => x >= 1 && x <= 9 - open * 3 && y >= 4 && y <= 16 && ((x - 1) % 2 === 0 || y === 8 || y === 13), R.oak, { spec: (x, y) => y === 4 });
    if (open) region(sp, (x, y) => x >= 9 - open * 3 && x <= 9 && y >= 2 + open && y <= 17 - open && (x + y) % 2 === 0, R.oak);
    return done(sp, 5, h - 2);
  });
  // a stake fence section (16 px): two sharpened stakes crossed in an X on a lashed log, the points lit; broken, the stakes lie flat (a stamp)
  SPR.stakes = () => once("stakes", () => {
    const sp = G(19, 15);
    region(sp, or(line(3, 2, 13, 11, 2), line(13, 2, 3, 11, 2)), R.oak, { spec: (x, y) => (y <= 3 && (x <= 4 || x >= 12)) });
    region(sp, rect(1, 9, 17, 11), ["#3e2731", "#3e2731", "#733e39", "#b86f50"]);
    for (const x of [5, 12]) { sp.set(x, 9, "#e4a672"); sp.set(x, 11, "#e4a672"); }
    return done(sp, 1, 12);
  });
  // thorn-wire: a section of `len` px (16 at most): a crooked post 10 px tall at its west end (and the east end of a run), a coil of three
  // looped iron strands between, 6 px deep, thorns as 1 px glints every 3 px; vertical runs turn it
  SPR.wire = (len, last, vert) => once("wire" + len + (last ? "L" : "") + (vert ? "V" : ""), () => {
    len = Math.max(4, Math.round(len));
    if (vert) { const w = 13, h = len + 3, sp = G(w, h), sz = (x, y, c) => sp.set(x, y, c);
      for (let y = 1; y < h - 1; y++) for (const s of [0, 1, 2]) { const x = 4 + s * 2 + Math.round(Math.sin(y * 0.9 + s * 2.1) * 1.4); sz(x, y, R.iron[1]); if ((y + s) % 3 === 0) sz(x + (s % 2 ? 1 : -1), y, "#c0cbdc"); }
      region(sp, rect(1, 1, 3, h - 2), ["#3e2731", "#3e2731", "#733e39", "#733e39"]); if (last) region(sp, rect(1, h - 4, 3, h - 2), ["#3e2731", "#3e2731", "#733e39", "#733e39"]);
      return done(sp, 2, h - 2); }
    const w = len + 3, h = 13, sp = G(w, h);
    for (let x = 1; x < w - 1; x++) for (const s of [0, 1, 2]) { const y = 5 + s * 2 + Math.round(Math.sin(x * 0.9 + s * 2.1) * 1.4); sp.set(x, y, R.iron[1]); if ((x + s) % 3 === 0) sp.set(x, y - 1, "#c0cbdc"); }
    const post = px => { region(sp, (x, y) => x >= px && x <= px + 1 && y >= 1 && y <= 11 && (y > 2 || x === px), ["#3e2731", "#3e2731", "#733e39", "#733e39"]); };
    post(1); if (last) post(w - 3);
    return done(sp, 1, 11);
  });
  // caltrops: one four-point iron spike, 3 x 3 (the tile scatters them)
  SPR.caltrop = () => once("caltrop", () => { const sp = G(3, 3); paintChars(sp, [".p.", "pcp", ".p."], { c: R.iron[1], p: R.iron[3] }, 0, 0); return gridSprite(sp, 1, 1); });
  // a round hide hut on bent poles (r 14, 24 tall) with a smoke hole and a dark flap; damage 0 whole, 1 torn, 2 sagging, 3 burning; the ruin
  // (a low heap, r 10, 8 tall) is its own sprite
  SPR.hut = (r, ht, dmg) => once("hut" + r + "|" + ht + "|" + (dmg | 0), () => {
    const sag = dmg >= 2 ? 4 : 0, ry = Math.round(r * 0.5), w = 2 * r + 3, h = ht + ry + 3, cx = r + 1, cy = ht + 1, sp = G(w, h);
    const dome = (x, y) => { const yy = y - cy, xx = x - cx; if (yy > 0) return (xx / r) ** 2 + (yy / ry) ** 2 <= 1; const t = -yy / (ht - sag); return t <= 1 && Math.abs(xx) <= r * Math.sqrt(Math.max(0, 1 - t * t * 0.85)); };
      const torn = dmg >= 1 ? line(cx - 2, cy - ht + 6 + sag, cx + 3, cy - 4, 1) : () => false;
    region(sp, (x, y) => dome(x, y) && !torn(x, y), R.hide, { ball: [cx - r * 0.35, cy - ht * 0.6, r], tex: (x, y, c) => { const yy = y - cy; if (dmg >= 3 && hash(x, y, 31) < 0.35) return R.charred[1]; if (((x - cx) * 5 + yy * 2) % 11 === 0 && yy < -2) return "#3e2731"; return null; } });
    for (let y = cy - ht + 1 + sag; y <= cy - ht + 4 + sag; y++) for (let x = cx - 1; x <= cx + 1; x++) if (sp.get(x, y)) sp.set(x, y, OUT);   // the smoke hole
    for (let y = cy - 7; y <= cy + 1; y++) for (let x = cx - 2 + (y > cy - 2 ? 0 : 1); x <= cx + 2 - (y > cy - 2 ? 0 : 1); x++) if (sp.get(x, y)) sp.set(x, y, y > cy - 1 ? "#2a1d28" : "#3e2731");   // the flap
    for (const dx of [-r + 2, r - 2]) for (let y = cy - 3; y <= cy + 1; y++) if (sp.get(cx + dx, y)) sp.set(cx + dx, y, "#3e2731");   // the poles' feet
    return done(sp, cx, cy);
  });
  SPR.hutRuin = () => once("hutRuin", () => { const sp = G(23, 15); region(sp, or(ell(11, 8, 10, 4), rect(3, 6, 19, 9)), R.charred, { ball: [8, 6, 10] });
    for (const [x0, y0, x1, y1] of [[2, 3, 9, 8], [12, 2, 20, 7], [6, 9, 16, 11]]) region(sp, line(x0, y0, x1, y1, 1), ["#2a1d28", "#3e2731", "#733e39", "#733e39"]); return done(sp, 11, 9); });
  // a hide tent (r 13, 20 tall): hide stretched over a ridge pole, stitched seams, a dark flap; damage as the hut's
  SPR.tent = (r, ht, dmg) => once("tent" + r + "|" + ht + "|" + (dmg | 0), () => {
    const sag = dmg >= 2 ? 3 : 0, w = 2 * r + 3, h = ht + 10, cx = r + 1, cy = ht + 4, sp = G(w, h);
    const body = (x, y) => { const yy = cy - y + 2, xx = Math.abs(x - cx); return yy >= 0 && yy <= ht - sag && xx <= Math.min(r - 1, r * (1 - yy / (ht - sag) * 0.75) + (y > cy - 2 ? 2 : 0)) && !(y > cy + 3); };
    const torn = dmg >= 1 ? line(cx + 4, cy - ht + 5, cx + 7, cy - 2, 1) : () => false;
    region(sp, (x, y) => body(x, y) && !torn(x, y), R.hide, { tex: (x, y, c) => { if (dmg >= 3 && hash(x, y, 32) < 0.35) return R.charred[1]; if (x === cx && y < cy) return "#3e2731"; if ((x - cx + y * 3) % 9 === 0) return "#3e2731"; return x < cx ? (c === R.hide[1] ? R.hide[2] : c) : (c === R.hide[2] ? R.hide[1] : c); } });
    for (let y = cy - 6; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) if (sp.get(x, y)) sp.set(x, y, "#2a1d28");   // the flap
    sp.set(cx, cy - ht - sag + 1, "#733e39"); sp.set(cx, cy - ht - sag, "#b86f50");   // the ridge pole's end
    return done(sp, cx, cy);
  });
  // a cookfire: a ring of stones r 6 with the cellar's fire on four frames and a thin smoke
  SPR.cookfire = f => once("cookfire" + ((f | 0) & 3), () => {
    const sp = G(17, 16), cx = 8, cy = 11, fr = (f | 0) & 3;
    for (let a = 0; a < 12; a++) { const x = Math.round(cx + Math.cos(a / 12 * TAU) * 6), y = Math.round(cy + Math.sin(a / 12 * TAU) * 3); sp.set(x, y, a % 3 ? R.stone[1] : R.stone[2]); sp.set(x, y - 1, R.stone[2]); }
    region(sp, line(cx - 3, cy, cx + 3, cy - 1, 2), ["#2a1d28", "#3e2731", "#733e39", "#733e39"]);   // the logs
    const F = [["..3..", ".353.", "34543", "35653", ".376."], [".3...", ".33..", "34543", "35653", ".376."], ["...3.", "..33.", "34553", "35653", ".376."], ["..3..", ".353.", "34543", "35663", ".376."]][fr];
    paintChars(sp, F, { "3": R.fire[0], "4": R.fire[1], "5": R.fire[2], "6": R.fire[3], "7": R.fire[2] }, cx - 2, cy - 7);
    for (let i = 0; i < 3; i++) sp.set(cx + ((i + fr) % 2 ? 1 : -1), cy - 8 - i, "#5a6988");
    return done(sp, cx, cy);
  });
  // the last army's burnt tent (a rect, 10 tall): charred canvas on blackened frames, collapsed over its footprint; drawn in 8 px slices
  SPR.burntTent = (w, d) => once("burntTent" + w + "|" + d, () => {
    const ht = 10, W = w + 2, H = d + ht + 2, sp = G(W, H), cx = W / 2;
    region(sp, (x, y) => y >= 1 && y <= H - 2 && Math.abs(x - cx) <= (w / 2 - 1) * (0.55 + 0.45 * Math.min(1, (y - 1) / ht)) && !(y > ht + 3 && Math.abs(x - cx) > w / 2 - 3 && (x + y) % 3 === 0), R.canvas, { tex: (x, y, c) => (x + y * 2) % 7 === 0 || hash(x, y, 33) < 0.25 ? R.charred[hash(x, y, 34) < 0.5 ? 1 : 2] : null });
    for (const [x0, y0, x1, y1] of [[2, ht + 2, W - 3, ht + 2], [Math.round(cx), 1, Math.round(cx), ht + 4], [3, H - 3, Math.round(cx) - 2, ht + 6]]) region(sp, line(x0, y0, x1, y1, 1), R.charred);
    return done(sp, 1, H - 2, { ht, depth: d });
  });
  // a cart (a rect, 16 tall): oak planks with iron wheel rims and spilled sacks; overturned, its wheels in the air; drawn in 8 px slices
  SPR.cart = (w, d, over) => once("cart" + w + "|" + d + (over ? "o" : ""), () => {
    const ht = 16, W = w + 2, H = d + ht + 2, sp = G(W, H), tall = d > w;
    region(sp, rect(1, ht - 6, W - 2, H - 2), ["#3e2731", "#733e39", "#b86f50", "#e4a672"], { tex: (x, y, c) => ((tall ? y : x) % 5 === 0) ? "#3e2731" : null, spec: (x, y) => y === ht - 6 });
    region(sp, rect(1, ht - 10, W - 2, ht - 6), ["#3e2731", "#733e39", "#b86f50", "#e4a672"], { tex: (x, y, c) => ((tall ? y : x) % 5 === 0) ? "#3e2731" : null });   // the side boards
    const wheel = (x, y) => region(sp, ell(x, y, 3.5, 3.5), R.iron, { spec: (xx, yy) => xx === x - 2 && yy === y - 2, tex: (xx, yy, c) => (Math.hypot(xx - x, yy - y) < 2 ? (xx === x || yy === y ? "#733e39" : null) : null) });
    if (over) { wheel(tall ? W / 2 : 6, 5); wheel(tall ? W / 2 : W - 7, tall ? H - 9 : 5); } else { wheel(5, H - 5); wheel(W - 6, H - 5); }
    for (let i = 0; i < 3; i++) region(sp, ell(Math.min(W - 5, 5 + i * 5 + (over ? W / 2 - 8 : 0)), H - 5 - (i % 2), 2.4, 1.6), R.burlap);   // spilled sacks
    return done(sp, 1, H - 2, { ht, depth: d });
  });
  // a barrel (r 5, 16 tall): oak staves with iron hoops; broken, flat staves (a stamp)
  SPR.barrel = () => once("barrel", () => { const sp = G(13, 20); region(sp, or(ell(6, 15, 5, 2.5), rect(1, 3, 11, 15), ell(6, 3, 5, 2.5)), R.oak, { tex: (x, y, c) => x % 3 === 1 && y > 1 && y < 17 ? "#3e2731" : null, spec: (x, y) => y === 2 && x === 4 });
    for (const y of [5, 12]) for (let x = 1; x <= 11; x++) sp.set(x, y, x === 1 || x === 11 ? R.iron[0] : R.iron[2]); return done(sp, 6, 15); });
  // a well (r 9, 16 tall): a ring of stones with a dark eye and a broken winch
  SPR.well = () => once("well", () => { const sp = G(23, 30), cx = 11, cy = 22;
    region(sp, (x, y) => { const d = ((x - cx) / 9.5) ** 2 + ((y - cy) / 5.5) ** 2; return (d <= 1 && d >= 0.42) || (y > cy && y <= cy + 5 && Math.abs(x - cx) <= 9 * Math.sqrt(Math.max(0, 1 - ((y - cy) / 5.5) ** 2))); }, R.stone, { tex: (x, y, c) => (x + y) % 4 === 0 && y <= cy + 1 ? R.stone[0] : null, spec: (x, y) => y === cy - 5 && x >= cx - 3 && x <= cx + 1 });
    region(sp, (x, y) => ((x - cx) / 9.5) ** 2 + ((y - cy) / 5.5) ** 2 < 0.42, ["#120e1a", "#120e1a", "#181425", "#262b44"], { flat: 0 });
    region(sp, or(rect(cx - 8, 6, cx - 7, cy - 4), rect(cx - 8, 6, cx + 2, 7)), R.oak); region(sp, line(cx + 2, 8, cx + 4, 12, 1), R.oak);
    return done(sp, cx, cy); });
  // the ruined windmill's round stone base (r 18, 30 tall) with moss and a dark door; and its broken sails lying across the grass (a low
  // lattice of oak spars and canvas scraps, a rect 6 tall)
  SPR.mill = () => once("mill", () => { const r = 18, ht = 30, w = 2 * r + 3, cx = r + 1, cy = ht + 2, sp = G(w, ht + 14);
    region(sp, (x, y) => (y <= cy && y >= 4 && Math.abs(x - cx) <= r - Math.round((cy - y) / 9)) || ((x - cx) / r) ** 2 + ((y - cy) / 9) ** 2 <= 1, R.stone, { tex: (x, y, c) => (y % 5 === 0 || (x + Math.floor(y / 5) * 4) % 9 === 0) && y <= cy ? R.stone[0] : (y < 8 && hash(x, y, 35) < 0.35 ? null : null), spec: (x, y) => x === cx - r + 2 + Math.round((cy - y) / 9) && y > 6 && y < cy - 2 });
    for (let x = cx - r + 2; x <= cx + r - 2; x++) if (hash(x, 0, 36) < 0.4) for (let y = 3; y < 3 + 2 + Math.floor(hash(x, 1, 36) * 3); y++) sp.set(x, y, null);   // the broken top
    for (const [x, y] of [[cx - 10, 12], [cx - 9, 13], [cx - 11, 14], [cx - 8, 18], [cx + 6, 24], [cx + 7, 25]]) sp.set(x, y, MOSS[hash(x, y, 37) < 0.5 ? 0 : 1]);
    region(sp, or(rect(cx - 3, cy - 9, cx + 3, cy + 1), ell(cx, cy - 9, 3.5, 2.5)), ["#120e1a", "#120e1a", "#181425", "#181425"], { flat: 0 });
    return done(sp, cx, cy); });
  SPR.sails = (w, d) => once("sails" + w + "|" + d, () => { const W = w + 2, H = d + 8, sp = G(W, H);
    region(sp, or(line(2, H - 3, W - 3, 3, 2), line(2, 3, W - 3, H - 3, 2)), R.oak);
    for (let x = 4; x < W - 4; x += 6) region(sp, rect(x, 2, x + 3, H - 3), R.canvas, { tex: (xx, yy, c) => (xx + yy) % 3 === 0 ? null : c === R.canvas[1] ? R.canvas[2] : c });
    return done(sp, 1, H - 2, { ht: 6, depth: d }); });
  // a gibbet (r 3, 34 tall): an oak post and arm with an empty iron cage hanging
  SPR.gibbet = () => once("gibbet", () => { const sp = G(17, 37); region(sp, or(rect(2, 2, 4, 35), rect(2, 2, 14, 4), line(4, 8, 9, 4, 1)), R.oak, { spec: (x, y) => y === 2 });
    region(sp, (x, y) => x >= 9 && x <= 14 && y >= 6 && y <= 20 && (x === 9 || x === 14 || y === 6 || y === 20 || y === 13 || x === 11), R.iron, { flat: 2 }); sp.set(12, 5, R.iron[3]);
    return done(sp, 3, 35); });
  // a banner (r 2, 30 tall) on a crooked pole: the last army's and the castle's blue and gold, torn; the trolls' stitched hide with a smeared hand
  SPR.banner = side => once("banner" + side, () => { const sp = G(13, 33), troll = side === "troll";
    region(sp, (x, y) => (x === 2 && y >= 1 && y <= 31) || (x === 3 && y >= 9 && y <= 31) || (y === 1 && x >= 2 && x <= 10), R.oak, { spec: (x, y) => y === 1 });
    const cloth = (x, y) => x >= 4 && x <= 10 && y >= 2 && y <= 24 && !(y > 18 && (x + y) % 4 === 0 && hash(x, y, 38) < 0.6) && !(troll && y > 20 && x < 6);
    if (troll) { region(sp, cloth, R.hide, { tex: (x, y, c) => (x + y * 2) % 7 === 0 ? "#3e2731" : null }); for (const [x, y] of [[6, 8], [7, 8], [8, 8], [6, 9], [7, 9], [8, 9], [5, 7], [9, 7], [7, 6], [6, 10], [8, 10]]) sp.set(x, y, MOSS[1]); }
    else region(sp, cloth, ["#124e89", "#124e89", "#0099db", "#2ce8f5"], { flat: 0, tex: (x, y, c) => y % 6 === 3 || (x === 7 && y > 8 && y < 16) ? "#feae34" : (x === 4 ? "#0099db" : null) });
    return done(sp, 2, 31); });
  // a lych-gate post (r 3, 20 tall) with a broken lintel stub; a headstone (6 x 10), leaning
  SPR.post = () => once("post", () => { const sp = G(9, 23); region(sp, or(rect(2, 2, 4, 21), rect(2, 2, 7, 3)), R.oak, { spec: (x, y) => y === 2 && x < 5 }); return done(sp, 3, 21); });
  SPR.headstone = v => once("headstone" + (v | 0), () => { const sp = G(10, 13), lean = (v | 0) % 2 ? 1 : -1;
    region(sp, (x, y) => { const xx = x - (y < 6 ? 0 : lean); return y >= 1 && y <= 11 && xx >= 2 && xx <= 7 && !(y < 3 && (xx === 2 || xx === 7)); }, R.stone, { tex: (x, y, c) => y === 5 || y === 7 ? (x % 2 ? R.stone[0] : null) : null });
    return done(sp, 5, 11); });
  // the chapel (section 3.2b): its roof of lead and slate behind 4 px wall-heads with a gap at the stair's head, a cracked bell in an oak
  // frame on the north side; the south face 24 tall with a barred door; the south wall-head; the stone stair of 8 steps; the landing
  SPR.chapelRoof = (w, d, gap) => once("chapelRoof" + w + "|" + d + "|" + gap.join(), () => {
    const W = w + 2, H = d + 2, sp = G(W, H);
    region(sp, rect(1, 1, W - 2, H - 2), ["#3a4466", "#3a4466", "#5a6988", "#8b9bb4"], { flat: 2, tex: (x, y, c) => (y % 4 === 0 || ((x + Math.floor(y / 4) * 3) % 6 === 0)) ? "#3a4466" : (x < W / 2 - 2 && (x + y) % 9 === 0 ? "#8b9bb4" : null) });   // lead to the west, slates laid in courses
    const head = (x, y) => (y <= 2 || x <= 2 || x >= W - 3) && !(y >= H - 3 && x >= gap[0] + 1 && x < gap[1] + 1);
    region(sp, (x, y) => x >= 1 && x <= W - 2 && y >= 1 && y <= H - 2 && head(x, y), R.stone, { tex: (x, y, c) => (x + y) % 5 === 0 ? R.stone[0] : null });
    return done(sp, 1, H - 2);
  });
  SPR.chapelHead = (w, gap) => once("chapelHead" + w + "|" + gap.join(), () => { const W = w + 2, sp = G(W, 7);
    region(sp, (x, y) => y >= 1 && y <= 5 && x >= 1 && x <= W - 2 && !(x >= gap[0] + 1 && x < gap[1] + 1), R.stone, { tex: (x, y, c) => x % 5 === 0 ? R.stone[0] : null, spec: (x, y) => y === 1 && x % 5 === 2 }); return done(sp, 1, 5); });
  SPR.bell = () => once("bell", () => { const sp = G(13, 15); region(sp, or(rect(2, 2, 3, 12), rect(9, 2, 10, 12), rect(2, 2, 10, 3)), R.oak, { spec: (x, y) => y === 2 });
    region(sp, or(ell(6, 8, 2.5, 3), rect(4, 8, 8, 11)), ["#4a4450", "#6e6a70", "#9a948c", "#c4bcae"], { ball: [5, 6, 3] }); sp.set(6, 10, R.stone[0]); sp.set(6, 11, R.stone[0]); sp.set(7, 9, R.stone[0]); return done(sp, 6, 13); });
  SPR.chapelFace = (w, ht) => once("chapelFace" + w + "|" + ht, () => { const W = w + 2, H = ht + 2, sp = G(W, H), cx = Math.round(W / 2);
    region(sp, rect(1, 1, W - 2, H - 2), R.stone, { tex: (x, y, c) => { const cr = Math.floor(y / 6), off = (cr % 2) * 4; if (y % 6 === 0 || (x + off) % 8 === 0) return hash(x, y, 39) < 0.12 ? MOSS[1] : R.stone[0]; return y % 6 === 1 ? R.stone[3] : null; } });
    region(sp, or(rect(cx - 4, H - 14, cx + 4, H - 2), ell(cx, H - 14, 4.5, 3)), ["#2a1d28", "#3e2731", "#733e39", "#b86f50"], { tex: (x, y, c) => y === H - 10 || y === H - 6 ? R.iron[1] : (x === cx ? "#2a1d28" : null) });
    return done(sp, 1, H - 2); });
  SPR.stair = (steps, tread, rise, d) => once("stair" + steps + "|" + tread + "|" + rise + "|" + d, () => {
    const zTop = steps * rise, W = steps * tread + 2, H = d + zTop + 2, sp = G(W, H);
    for (let k = 0; k < steps; k++) { const z = k * rise, x0 = 1 + k * tread, x1 = x0 + tread - 1, yT = H - 2 - d - z + 1, yB = H - 2 - z;
      region(sp, rect(x0, yT, x1, yB), R.stone, { tex: (x, y, c) => x < x0 + 2 ? R.stone[1] : (y === yT ? R.stone[3] : (x + y) % 5 === 0 ? R.stone[2] : R.stone[3]) });
      region(sp, rect(x0, yB + 1, x1, H - 2), R.stone, { tex: (x, y, c) => y === yB + 1 ? R.stone[0] : (y - yB) % 4 === 0 ? R.stone[0] : R.stone[1] }); }
    return done(sp, 1, H - 2); });
  SPR.landing = (w, d, z) => once("landing" + w + "|" + d + "|" + z, () => { const W = w + 2, H = d + z + 2, sp = G(W, H);
    region(sp, rect(1, 1, W - 2, d), R.stone, { tex: (x, y, c) => (x + y) % 5 === 0 ? R.stone[2] : R.stone[3] });
    region(sp, rect(1, d + 1, W - 2, H - 2), R.stone, { tex: (x, y, c) => (y - d) % 6 === 1 || (x + Math.floor((y - d) / 6) * 4) % 8 === 0 ? R.stone[0] : R.stone[1] });
    return done(sp, 1, H - 2); });
  // the archer tower (the watchtower): oak legs with cross braces, a plank deck 40 x 36 at 30 px with a 4 px slab edge, wall-heads of lashed
  // poles with a gap over the ladder, a hide lean-to over the deck's north half, an oak ladder of 7 rungs; and its poles fallen flat
  SPR.leg = () => once("leg", () => { const sp = G(9, 34); region(sp, or(rect(3, 1, 5, 32), line(1, 10, 7, 4, 1), line(1, 22, 7, 16, 1)), R.oak, { spec: (x, y) => x === 3 && y > 2 && y % 3 === 0 }); return done(sp, 4, 32); });
  SPR.deck = (w, d, slab) => once("deck" + w + "|" + d + "|" + slab, () => { const W = w + 2, H = d + slab + 2, sp = G(W, H);
    region(sp, rect(1, 1, W - 2, d), ["#3e2731", "#733e39", "#b86f50", "#e4a672"], { tex: (x, y, c) => (y % 5 === 0 ? "#3e2731" : (x % 11 === 5 && y % 5 === 2 ? R.iron[1] : null)) });
    region(sp, rect(1, d + 1, W - 2, H - 2), ["#2a1d28", "#3e2731", "#733e39", "#733e39"], { tex: (x, y, c) => x % 6 === 0 ? "#2a1d28" : null });
    return done(sp, 1, H - 2, { ht: 0 }); });
  SPR.deckHeads = (w, d, gap, front) => once("deckHeads" + w + "|" + d + "|" + gap.join() + (front ? "F" : "B"), () => { const W = w + 2, H = front ? 7 : d + 2, sp = G(W, H);
    const on = front ? (x, y) => y >= 1 && y <= 5 && x >= 1 && x <= W - 2 && !(x >= gap[0] + 1 && x < gap[1] + 1) : (x, y) => x >= 1 && x <= W - 2 && y >= 1 && y <= H - 2 && (y <= 4 || x <= 2 || x >= W - 3);
    region(sp, on, R.oak, { tex: (x, y, c) => (front ? x % 4 === 0 : (y <= 4 ? x % 4 === 0 : y % 4 === 0)) ? "#3e2731" : null, spec: (x, y) => y === 1 && x % 4 === 2 });
    return done(sp, 1, front ? 5 : H - 2); });
  SPR.leanTo = w => once("leanTo" + w, () => { const W = w + 2, H = 16, sp = G(W, H);
    region(sp, (x, y) => y >= 1 && y <= H - 2 && x >= 1 && x <= W - 2 && (y >= 3 || (x > 3 && x < W - 4)), R.hide, { tex: (x, y, c) => (x + y * 3) % 8 === 0 ? "#3e2731" : (y > H - 5 ? "#3e2731" : null) });
    for (const x of [2, W - 3]) for (let y = 3; y <= H - 2; y++) sp.set(x, y, R.oak[1]);
    return done(sp, 1, H - 2); });
  SPR.ladder = h => once("ladder" + h, () => { const sp = G(9, h + 2);
    region(sp, (x, y) => y >= 1 && y <= h && ((x === 2 || x === 6) || ((y - 1) % 6 === 3 && x >= 2 && x <= 6)), R.oak, { spec: (x, y) => x === 2 && (y - 1) % 6 === 2 }); return done(sp, 4, h); });
  SPR.poles = (w, d) => once("poles" + w + "|" + d, () => { const W = w + 2, H = d + 2, sp = G(W, H);
    region(sp, or(rect(1, 2, W - 2, 3), rect(1, H - 4, W - 2, H - 3), rect(3, 5, W - 4, 6)), R.oak, { spec: (x, y) => y === 2 && x % 7 === 3 }); return done(sp, 1, H - 2, { ht: 0, depth: d }); });
  // a trebuchet (56 x 24, 24 tall, in 8 px slices): a heavy oak frame, two A-frame uprights, an axle, a long arm with a counterweight box and
  // a sling; frames: crank 0..3 (the arm winding down), load, aim 0..1 (the arm quivering), loose 0..1 (whipping up), wrecked (the arm
  // snapped); mended: the arm splinted with rope and hide
  SPR.trebuchet = (frame, mended) => once("treb" + frame + (mended ? "m" : ""), () => {
    const w = 56, d = 24, ht = 24, top = 34, W = w + 2, H = top + ht + d + 2, sp = G(W, H), baseY = H - 2, frameTop = baseY - d - ht;
    const wrecked = frame === "wrecked";
    // the base frame on the ground, the two A-frames, the axle between them
    region(sp, rect(1, baseY - d, W - 2, baseY), ["#3e2731", "#733e39", "#b86f50", "#e4a672"], { tex: (x, y, c) => (y - (baseY - d)) % 6 === 0 || x % 14 === 7 ? "#3e2731" : (y > baseY - d + 1 && y < baseY - 1 && x > 2 && x < W - 3 && (x + y) % 2 ? null : null) });
    for (const ax of [16, 42]) { region(sp, or(line(ax - 7, baseY - d + 2, ax, frameTop + 2, 2), line(ax + 7, baseY - d + 2, ax, frameTop + 2, 2), rect(ax - 4, frameTop + 10, ax + 4, frameTop + 11)), R.oak, { spec: (x, y) => y === frameTop + 2 }); }
    region(sp, rect(16, frameTop + 3, 42, frameTop + 4), R.iron);   // the axle
    // the arm about the axle: its angle by frame (down and winding, loaded flat-ish, up at the loose); the counterweight at the short end
    let a = -1.1;   // radians from the horizontal, positive = the long end up (toward the north)
    if (typeof frame === "number") a = -0.15 - (3 - frame) * 0.32;
    else if (frame === "load") a = -0.15; else if (frame === "aim0") a = -0.15; else if (frame === "aim1") a = -0.1; else if (frame === "loose0") a = 0.7; else if (frame === "loose1") a = 1.2; else if (wrecked) a = -0.5;
    const px0 = 27, py0 = frameTop + 3, L = wrecked ? 14 : 26, ca = Math.cos(a), sa = -Math.sin(a);
    region(sp, line(px0 - ca * 8, py0 - sa * 8, px0 + ca * L, py0 + sa * L, 2), R.oak, { tex: (x, y, c) => mended && hash(x, y, 40) < 0.3 ? (hash(x, y, 41) < 0.5 ? R.hide[3] : "#e4a672") : null });
    region(sp, ell(px0 - ca * 9, py0 - sa * 9, 4, 3.5), R.stone, { ball: [px0 - ca * 9 - 1, py0 - sa * 9 - 1, 4] });   // the counterweight box of stones
    if (!wrecked) { const tx = px0 + ca * L, ty = py0 + sa * L; region(sp, line(tx, ty, tx - ca * 6 + 2, ty + 7, 1), ["#733e39", "#b86f50", "#e4a672", "#ead4aa"]); if (frame === "load" || frame === "aim0" || frame === "aim1") region(sp, ell(tx - ca * 6 + 2, ty + 8, 2.5, 2.5), R.stone, { ball: [tx - ca * 6 + 1, ty + 7, 2.5] }); }
    else { region(sp, line(px0 + ca * L, py0 + sa * L, px0 + ca * L + 6, py0 + sa * L + 10, 2), R.charred); for (let i = 0; i < 40; i++) { const x = 3 + Math.floor(hash(i, 0, 42) * (W - 6)), y = baseY - d + Math.floor(hash(i, 1, 42) * d); if (sp.get(x, y)) sp.set(x, y, R.charred[1]); } }
    return done(sp, 1, baseY, { ht, depth: d, top: top + 1 });
  });
  // the Last Army's Ram: an iron-capped oak log on a broken wheeled frame, lying (40 x 8, 8 tall)
  SPR.ram = () => once("ram", () => { const sp = G(44, 17); region(sp, or(rect(4, 7, 36, 11), rect(1, 8, 9, 10)), R.oak, { tex: (x, y, c) => y === 9 && x % 7 === 3 ? "#3e2731" : null, spec: (x, y) => y === 7 && x % 9 === 4 });
    region(sp, rect(35, 6, 42, 12), R.iron, { spec: (x, y) => x === 36 && y === 7 });
    region(sp, or(rect(6, 12, 30, 13), line(8, 13, 4, 15, 1), line(28, 13, 32, 15, 1)), ["#2a1d28", "#3e2731", "#733e39", "#733e39"]);
    for (const wx of [10, 26]) region(sp, ell(wx, 14, 2.5, 1.5), R.iron);
    return done(sp, 1, 15); });
  // the iron chest: a 12 x 8 iron-bound oak box with a gold lock; its lid lifting on four frames
  SPR.chest = f => once("chest" + ((f | 0) & 3), () => { const sp = G(16, 20), lift = [0, 2, 4, 5][(f | 0) & 3], B = 4;
    region(sp, rect(2, B + 7, 13, B + 13), R.oak, { tex: (x, y, c) => x === 2 || x === 13 || x === 7 || x === 8 ? R.iron[1] : (y === B + 13 ? R.iron[0] : null) });
    region(sp, (x, y) => x >= 2 && x <= 13 && y >= B + 4 - lift && y <= B + 6 - lift && !(y === B + 4 - lift && (x === 2 || x === 13)), R.oak, { tex: (x, y, c) => x === 2 || x === 13 || x === 7 || x === 8 ? R.iron[2] : null, spec: (x, y) => y === B + 4 - lift });
    if (lift) for (let y = B + 7 - lift; y < B + 7; y++) for (let x = 3; x <= 12; x++) sp.set(x, y, y === B + 7 - lift ? "#fee761" : "#120e1a");
    sp.set(7, B + 9, "#fee761"); sp.set(8, B + 9, "#fee761"); sp.set(7, B + 10, "#feae34"); sp.set(8, B + 10, "#feae34");
    return done(sp, 8, B + 13); });
  // ---- design pass 18: the level tells the player what to do without words
  // the yellow arrow (17 x 16 with its soot): pointing down at what to go to and use, a 5 px shaft and a 15 px head, lit from the top left
  // (pale on its upper-left edges, orange on its lower-right), anchored at its tip; the page bobs it 3 px
  const GOLDY = ["#feae34", "#fee761", "#fffaf0", "#ffffff"];
  SPR.arrow = () => once("garrow", () => { const sp = G(17, 16); region(sp, (x, y) => (x >= 6 && x <= 10 && y >= 1 && y <= 5) || (y >= 6 && y <= 13 && Math.abs(x - 8) <= 13 - y), GOLDY); return done(sp, 8, 13); });
  // GO in bold letters over a yellow arrow pointing right (the old arcade brawlers' sign that the way ahead is open), 19 x 21 with its soot,
  // anchored at the arrow's tip
  SPR.go = () => once("ggo", () => { const sp = G(21, 22);
    paintChars(sp, [".yyyyy", "yy....", "yy....", "yy.yyy", "yy..yy", "yy..yy", ".yyyy."], { y: "#fee761" }, 3, 1);
    paintChars(sp, [".yyyy.", "yy..yy", "yy..yy", "yy..yy", "yy..yy", "yy..yy", ".yyyy."], { y: "#fee761" }, 10, 1);
    region(sp, (x, y) => (x >= 1 && x <= 13 && y >= 14 && y <= 16) || (x >= 13 && x <= 18 && Math.abs(y - 15) <= Math.min(5, 18 - x)), GOLDY);
    return done(sp, 18, 15); });
  // a health bar (design pass 18 section 3.7): w wide, 4 tall (soot, the light row, the dark row, soot), f inner pixels filled; red over a
  // troll, a piece or the gate, green over a sword-brother; tip: its last filled column pale green (a troll's regrowth). Anchored at its top
  // centre's row 1. Baked once per width, fill and kind
  const BAR = { red: ["#e43b44", "#a22633"], green: ["#63c74d", "#3e8948"], track: "#3e2731", tip: ["#b4e67a", "#63c74d"] };
  SPR.bar = (w, f, kind, tip) => { w = clamp(Math.round(w), 6, 48); f = clamp(Math.round(f), 0, w - 2); const k = kind === "green" ? "green" : "red";
    return once("gbar" + w + "|" + f + "|" + k + (tip ? "t" : ""), () => { const px = new Array(w * 4).fill(OUT), C = BAR[k];
      for (let x = 1; x < w - 1; x++) for (let y = 1; y <= 2; y++) { const n = x - 1; px[y * w + x] = n < f ? (tip && n === f - 1 ? BAR.tip[y - 1] : C[y - 1]) : BAR.track; }
      return sprite(px, w, 4, w >> 1, 1, { bar: { w, f, kind: k, tip: !!tip } }); }); };
  // a drum tower of the gatehouse (r 16, 128 tall), painted unsheared as a standing cylinder shaded by column from the lit left, with arrow
  // loops, a crenellated top and the banners hanging from it: the castle's blue and gold, torn, and the trolls' hide over it
  SPR.drumTower = () => once("drumTower", () => { const r = 16, ht = 128, w = 2 * r + 3, cx = r + 1, cy = ht + 10, sp = G(w, cy + 10);
    const tone = x => { const t = (x - 1) / (2 * r); return t < 0.2 ? R.stone[3] : t < 0.5 ? R.stone[2] : t < 0.8 ? R.stone[1] : R.stone[0]; };
    region(sp, (x, y) => ((x - cx) / r) ** 2 + ((y - cy) / 8) ** 2 <= 1 || (y >= 8 && y <= cy && Math.abs(x - cx) <= r), R.stone, { tex: (x, y, c) => { if (y <= cy && y >= 8) { if (y % 6 === 0) return JOINT; if ((x + Math.floor(y / 6) * 3) % 7 === 0) return JOINT; return tone(x); } return R.stone[0]; } });
    for (let x = cx - r; x <= cx + r; x += 5) if (((x - cx + r) / 5) % 2 === 0) for (let y = 4; y < 8; y++) sp.set(x, y, null), sp.set(x + 1, y, null), sp.set(x + 2, y, null);   // the crenels
    for (let x = cx - r; x <= cx + r; x++) for (let y = 3; y < 8; y++) if (!sp.get(x, y) && (((x - cx + r) / 5) | 0) % 2 === 1) sp.set(x, y, tone(x));
    for (const ly of [30, 70, 100]) for (let y = ly; y < ly + 9; y++) sp.set(cx - 3, y, DARK);
    // the banners: blue and gold on the lit side, torn; the troll hide hung over it
    region(sp, (x, y) => x >= cx - 12 && x <= cx - 8 && y >= 10 && y <= 48 && !(y > 40 && (x + y) % 3 === 0), ["#124e89", "#124e89", "#0099db", "#2ce8f5"], { flat: 0, tex: (x, y, c) => y % 8 === 4 ? "#feae34" : null });
    region(sp, (x, y) => x >= cx - 10 && x <= cx - 6 && y >= 12 && y <= 34, R.hide, { tex: (x, y, c) => (x + y * 2) % 7 === 0 ? "#3e2731" : (y >= 18 && y <= 22 && Math.abs(x - cx + 8) <= 1 ? MOSS[1] : null) });
    return done(sp, cx, cy); });
  // the drawbridge's swing (section 3.4): the screen offset of its outer edge from its hinge at the arch's foot at frame f of 4 (0 upright,
  // 4 down flat on the bank, 22.5 degrees a frame); the deck is 65 long (92 in u), so the edge stands 46 cos(a) px west of the hinge and
  // 46 cos(a) - 65 sin(a) px down the screen
  const bridgeSwing = f => { const a = (4 - clamp(f, 0, 4)) * Math.PI / 8; return [-46 * Math.cos(a), 46 * Math.cos(a) - 65 * Math.sin(a)]; };
  const plankAt = (c, k) => (k === 2 || k === 32 || k === 62 || c === 0 || c === 33) ? R.iron[1] : (k % 7 === 0 ? "#3e2731" : k % 7 === 1 ? "#b86f50" : "#733e39");
  // the drawbridge raised: an upright face of oak planks with iron straps standing in the arch, 34 columns wide and 65 tall, sheared one
  // pixel down per column as the castle is (its canvas is 34 x 98; faceH is the face's own height); f 1 to 3: falling, the whole bridge
  // swung down about its hinge toward the bank, its outer edge out over the moat and its face foreshortened, outlined; every frame is
  // anchored (ox, oy) at the hinge's north end
  SPR.bridgeRaised = f => once("bridgeRaised" + (f | 0), () => { const w = 34, fr = clamp(f | 0, 0, 3);
    if (!fr) { const sp = G(w, 65 + w - 1);
      for (let c = 0; c < w; c++) for (let k = 0; k < 65; k++) sp.set(c, c + k, plankAt(c, k));
      for (const c of [1, w - 2]) for (let k = 0; k < 65; k += 3) sp.set(c, c + k, R.iron[3]);
      return gridSprite(sp, 0, 65, { faceH: 65, sheared: true, swing: 0 }); }
    // the face's column c, row k from its top (k 64 at the hinge), lands at hinge(c) + (dx, dy) (64 - k) / 64; painted by the inverse map
    const [dx, dy] = bridgeSwing(fr), det = dx - dy, ox = Math.ceil(Math.max(0, -dx)) + 1, oy = 2 - Math.min(0, Math.floor(dy)), W = w + Math.ceil(Math.abs(dx)) + 3, H = w + Math.max(0, Math.ceil(dy)) + oy + 2, sp = G(W, H);
    const at = (X, Y) => { const s = (X - ox - (Y - oy) - 1) / det; return [X - ox - dx * s, s]; };
    region(sp, (X, Y) => { const [c, s] = at(X, Y); return s >= -0.01 && s <= 1.01 && c >= -0.5 && c < w - 0.5; }, R.oak, { tex: (X, Y) => { const [c, s] = at(X, Y); return plankAt(clamp(Math.round(c), 0, w - 1), 64 - clamp(Math.round(64 * s), 0, 64)); } });
    for (const c of [1, w - 2]) for (let k = 0; k < 65; k += 3) { const s = (64 - k) / 64; sp.set(ox + c + dx * s, oy + c - 1 + dy * s, R.iron[3]); }
    return done(sp, ox, oy, { faceH: Math.round(65 * Math.sin((4 - fr) * Math.PI / 8)), sheared: true, swing: fr }); });
  // the drawbridge down: a deck of planks seen from above on the slant, 48 wide and 65 long over the moat and 17 px onto the bank, iron
  // straps along its long sides; drawn at its bounding box's top left
  SPR.bridgeDeck = (u0, u1, v0, v1) => once("bridgeDeck" + [u0, u1, v0, v1].join(), () => {
    const x0 = Math.floor((u0 + v0) / 2) - 1, x1 = Math.ceil((u1 + v1) / 2) + 1, y0 = Math.floor((v0 - u1) / 2) - 1, y1 = Math.ceil((v1 - u0) / 2) + 1, W = x1 - x0 + 1, H = y1 - y0 + 1, sp = G(W, H);
    region(sp, (x, y) => { const u = x0 + x - (y0 + y), v = x0 + x + y0 + y; return u >= u0 && u <= u1 && v >= v0 && v <= v1; }, R.oak, { flat: 1, tex: (x, y, c) => { const u = x0 + x - (y0 + y), v = x0 + x + y0 + y; if (v <= v0 + 2 || v >= v1 - 2) return R.iron[1]; if ((u - u0) % 8 < 2) return "#3e2731"; if ((u - u0) % 8 === 2) return "#b86f50"; return hash(x, y, 43) < 0.08 ? "#b86f50" : null; } });
    return done(sp, 0, 0, { x0, y0 }); });
  // the falling bridge's shadow (section 3.4: "its shadow growing across the bank as it falls"): the deck's footprint on the water and the
  // bank from the hinge out, half the moat at the first frame, past the bank's edge at the second, the deck's whole landing at the third,
  // its leading edge soft; alpha, so a canvas of its own, drawn at its box's top left under the bridge (drawFloor)
  const SWING_SHADOW = [0, 46, 76, 92];
  SPR.bridgeShadow = (f, u0, u1, v0, v1) => { f = clamp(f | 0, 1, 3); return once("bridgeShadow" + f + "|" + [u0, u1, v0, v1].join(), () => {
    const uu = Math.max(u0, u1 - SWING_SHADOW[f]), x0 = Math.floor((uu + v0) / 2) - 1, x1 = Math.ceil((u1 + v1) / 2) + 1, y0 = Math.floor((v0 - u1) / 2) - 1, y1 = Math.ceil((v1 - uu) / 2) + 1, W = x1 - x0 + 1, H = y1 - y0 + 1, px = new Array(W * H).fill(null);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const u = x0 + x - (y0 + y), v = x0 + x + y0 + y; if (u > u1 || u < uu || v < v0 || v > v1) continue; if (dith(x0 + x, y0 + y, clamp((u - uu) / 8, 0, 1))) px[y * W + x] = SHADOW; }
    return sprite(px, W, H, 0, 0, { alpha: true, bridgeShadow: true, frame: f, x0, y0, reach: u1 - uu }); }); };
  // a drawbridge chain, after the Crucible's chain links: 1 px links of dark and lit iron alternating along its run from the gatehouse's
  // hole (its anchor) to the bridge's corner at (dx, dy), edged in soot
  SPR.chain = (dx, dy) => { dx = Math.round(dx); dy = Math.round(dy); return once("chain" + dx + "|" + dy, () => {
    const ox = Math.max(0, -dx) + 1, oy = Math.max(0, -dy) + 1, n = Math.max(Math.abs(dx), Math.abs(dy), 1), sp = G(Math.abs(dx) + 3, Math.abs(dy) + 3);
    for (let i = 0; i <= n; i++) sp.set(ox + dx * i / n, oy + dy * i / n, i % 2 ? R.iron[2] : R.iron[0]);
    return done(sp, ox, oy, { chain: true, dx, dy }); }); };
  // the portcullis: iron bars 1 px at a 4 px pitch in the arch (34 columns, 56 tall, sheared), one bent corner; damage frames 1 to 3 (bars
  // bent, the door plank behind split, the whole sagging); the oak doors behind it split on the burst's four frames (doors(f))
  SPR.portcullis = stage => once("portcullis" + (stage | 0), () => { const w = 34, h = 56, sp = G(w, h + w - 1), s = stage | 0;
    for (let c = 0; c < w; c++) for (let k = 0; k < h; k++) { const bent = s >= 1 && c > 26 && k < 10 + s * 4 ? (c - 26) % 3 : 0, sag = s >= 3 && c > 8 && c < 26 ? 2 : 0, bar = (c % 4 === 1 + bent) || ((k + sag) % 4 === 0); if (!bar) continue; sp.set(c, (h - 1 - k) + c, c % 4 === 1 + bent ? R.iron[2] : R.iron[0]); }
    for (let c = 0; c < w; c += 4) sp.set(c + 1, (h - 1) + c - 2, R.iron[3]);
    return gridSprite(sp, 0, h - 1, { sheared: true }); });
  SPR.doors = f => once("doors" + ((f | 0) & 3), () => { const w = 34, h = 40, sp = G(w, h + w - 1), split = [0, 2, 5, 9][(f | 0) & 3];
    for (let c = 0; c < w; c++) for (let k = 0; k < h; k++) { if (Math.abs(c - 16.5) < split * (1 - k / h) + (split ? 1 : 0) && split) continue; sp.set(c, (h - 1 - k) + c, c === 16 || c === 17 ? "#2a1d28" : (k % 6 === 0 ? R.iron[1] : (c % 5 === 0 ? "#3e2731" : "#733e39"))); }
    return gridSprite(sp, 0, h - 1, { sheared: true }); });
  SPR.eyes = () => once("eyes", () => sprite(["#fee761", null, null, "#fee761"], 4, 1, 0, 0));
  SPR.chestGlint = () => once("chestGlint", () => sprite(["#fee761"], 1, 1, 0, 0));
  // the fallen tower's rubble heap (64 x 46, 18 tall, in 8 px slices) and its stump (r 16, 40 tall), ragged
  SPR.rubble = (w, d) => once("rubble" + w + "|" + d, () => { const ht = 18, W = w + 2, H = d + ht + 2, sp = G(W, H);
    region(sp, (x, y) => y >= 1 && y <= H - 2 && x >= 1 && x <= W - 2 && (y > ht || Math.abs(x - W / 2) <= (W / 2 - 1) * Math.min(1, (y - 1) / ht + 0.4)), R.stone, { tex: (x, y, c) => { const k = hash(Math.floor(x / 5), Math.floor(y / 4), 44); return (x % 5 === 0 || y % 4 === 0) ? R.stone[0] : k < 0.3 ? R.stone[1] : k < 0.8 ? R.stone[2] : (hash(x, y, 45) < 0.1 ? MOSS[1] : R.stone[3]); } });
    return done(sp, 1, H - 2, { ht, depth: d }); });
  SPR.stump = () => once("stump", () => { const r = 16, ht = 40, w = 2 * r + 3, cx = r + 1, cy = ht + 2, sp = G(w, ht + 12);
    region(sp, (x, y) => (y <= cy && y >= 2 + Math.floor(hash(x, 0, 46) * 7) && Math.abs(x - cx) <= r) || ((x - cx) / r) ** 2 + ((y - cy) / 8) ** 2 <= 1, R.stone, { tex: (x, y, c) => y % 6 === 0 || (x + Math.floor(y / 6) * 3) % 8 === 0 ? JOINT : (x < cx - 6 ? R.stone[3] : x > cx + 8 ? R.stone[1] : R.stone[2]) });
    for (let y = 14; y < 24; y++) sp.set(cx + 4, y, DARK);
    return done(sp, cx, cy); });
  // the marks that stand: a clod (r 4, 6 tall), a dead brute's stone (r 10, 24 tall), its boulder (r 10), a troll's rubble heap (flat, a stamp)
  SPR.clod = () => once("clod", () => { const sp = G(11, 9); region(sp, or(ell(5, 5, 4, 2.5), rect(2, 2, 7, 5)), R.ground, { ball: [3, 3, 4] }); return done(sp, 5, 6); });
  SPR.bruteStone = v => once("bruteStone" + (v | 0), () => { const sp = G(25, 32), cx = 12, cy = 28;
    region(sp, or(ell(cx, cy - 3, 10, 5), ell(cx - 2, cy - 14, 8, 9), ell(cx + 1, cy - 22, 5, 5), rect(cx - 10, cy - 6, cx + 10, cy)), R.stone, { ball: [cx - 5, cy - 18, 11], tex: (x, y, c) => hash(x, y, 47 + (v | 0)) < 0.06 ? R.stone[0] : null });
    for (const [x, y] of [[cx - 4, cy - 23], [cx - 3, cy - 24], [cx + 5, cy - 10]]) sp.set(x, y, MOSS[1]);
    return done(sp, cx, cy); });
  // tall grass: a 32 x 20 patch of stalks 7 px tall, drawn over the feet of anything in it; a grass tuft (5 x 4) on four swaying frames,
  // three variants, and flattened
  SPR.tallGrass = () => once("tallGrass", () => { const sp = G(34, 29);
    for (let i = 0; i < 46; i++) { const bx = 2 + Math.floor(hash(i, 0, 48) * 30), by = 9 + Math.floor(hash(i, 1, 48) * 19), h = 4 + Math.floor(hash(i, 2, 48) * 4), lean = hash(i, 3, 48) < 0.5 ? 0 : 1;
      for (let k = 0; k < h; k++) sp.set(bx + (k > h - 3 ? lean : 0), by - k, k >= h - 2 ? "#feae34" : "#e4a672"); }
    outline(sp);
    return gridSprite(sp, 1, 27); });
  SPR.tuft = (v, f, flat) => once("tuft" + v + "|" + f + (flat ? "f" : ""), () => { const sp = G(9, 6), v3 = (v | 0) % 3, lean = flat ? 0 : [0, 1, 0, -1][(f | 0) & 3];
    if (flat) { paintChars(sp, [".1.2.", "12221"], { "1": "#b86f50", "2": "#e4a672" }, 2, 3); }
    else { const rows = [[".2...", "12.1.", "1213.", "12131"], ["..2..", ".2.3.", ".213.", "12131"], ["...2.", ".1.2.", ".3121", "13121"]][v3]; paintChars(sp, rows, { "1": "#b86f50", "2": "#e4a672", "3": v3 === 1 ? "#3e8948" : "#feae34" }, 2 + lean, 1); }
    outline(sp); return gridSprite(sp, 4, 4); });
  // crows on the merlons by the gatehouse: 5 x 4, lifting off on four frames
  SPR.crow = f => once("crow" + ((f | 0) & 3), () => { const sp = G(7, 6), rows = [["..k..", ".kkk.", "kk.kk"], [".k.k.", ".kkk.", "..k.."], ["k...k", ".kkk.", "..k.."], [".k.k.", "kkkkk", "..k.."]][(f | 0) & 3]; paintChars(sp, rows, { k: OUT }, 1, 1); return gridSprite(sp, 3, 4); });
  // a wall archer stands in a breach, seen from the chest up: the troll's frame cut below its chest (the sill hides the rest)
  SPR.cut = (fr, rows) => once("cut" + fr.kind + fr.facing + fr.anim + fr.i + fr.glow + "|" + rows, () => { const N = fr.N, px = fr.px.slice(); for (let y = N - rows; y < N; y++) for (let x = 0; x < N; x++) px[y * N + x] = null; return sprite(px, N, N, N / 2, N - 1 - rows); });

  // ------------------------------------------------------------------ the marks (section 3.6a): stamps baked once per kind, size and variant;
  // the live marks' frames; and the telegraphs (section 3.5) baked by radius, length and frame. Floor circles are drawn as the rules test
  // them, true circles, so a ring lies on its hit circle and a crater on its bowl
  const MK = {}, TG = {};
  const sq = r => { const w = 2 * r + 1; return { w, h: w, c: r, sp: G(w, w) }; };
  const ringPx = (sp, cx, cy, r, c, a, f) => { for (let i = 0; i < 64 * r; i++) { const t = i / (64 * r) * TAU, x = Math.round(cx + Math.cos(t) * r), y = Math.round(cy + Math.sin(t) * r); if (a === undefined || dith(x + f, y, a)) sp.set(x, y, c); } };
  // a 1 px soot edge round every pixel of a colour (the telegraphs' red, the chevrons' bone)
  function edge(sp, keep) { const add = []; for (let y = 0; y < sp.H; y++) for (let x = 0; x < sp.W; x++) if (!sp.get(x, y)) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const c = sp.get(x + dx, y + dy); if (c && (!keep || keep(c))) { add.push([x, y]); break; } } for (const [x, y] of add) sp.set(x, y, OUT); }
  MK.KINDS = ["scorch", "crater", "dirt", "filled", "crack", "rubble", "damp", "tangle", "stakes", "staves", "stuck", "frost"];
  MK.stamp = (kind, r, v) => { r = Math.max(2, Math.round(r || 4)); v = (v | 0) % 3; return once("stamp" + kind + "|" + r + "|" + v, () => {
    if (kind === "tangle" || kind === "stakes" || kind === "staves") {
      const w = kind === "staves" ? 13 : r * 2 + 3, sp = G(w, 8);
      if (kind === "tangle") { for (let x = 1; x < w - 1; x++) for (const s of [0, 1, 2]) { const y = 2 + s + Math.round(Math.sin(x * 0.7 + s * 2 + v) * 1.6); sp.set(x, y, R.iron[1]); if ((x + s + v) % 3 === 0) sp.set(x, y - 1, "#c0cbdc"); } }
      else if (kind === "stakes") { region(sp, or(line(1, 1, w - 2, 5, 1), line(1, 5, w - 2, 1, 1)), R.oak, { spec: (x, y) => x <= 2 || x >= w - 3 }); region(sp, rect(2, 6, w - 3, 6), ["#3e2731", "#3e2731", "#733e39", "#733e39"]); }
      else { for (let i = 0; i < 4; i++) region(sp, line(1 + i * 3, 1 + (i % 2) * 2, 4 + i * 3, 6 - (i % 2) * 2, 1), R.oak); for (let x = 2; x < 11; x++) sp.set(x, 4 + (x % 3 === 0 ? 1 : 0), R.iron[2]); }
      return gridSprite(sp, w >> 1, 4);
    }
    if (kind === "stuck") { const sp = G(7, 6), a = [0.4, 0.9, -0.3][v]; for (let i = 0; i < 4; i++) sp.set(3 + Math.round(Math.cos(a) * i * 0.8), 4 - Math.round(Math.abs(Math.sin(a)) * i + i * 0.3), i < 2 ? OUT : (i === 2 ? "#3e2731" : OUT)); sp.set(3 + Math.round(Math.cos(a) * 3), 0 + (v === 1 ? 1 : 0), "#c0cbdc"); sp.set(2 + Math.round(Math.cos(a) * 3), 1, "#c0cbdc"); return gridSprite(sp, 3, 4); }
    if (kind === "frost") { const sp = G(9, 9); for (let i = -3; i <= 3; i++) { sp.set(4 + i, 4, "#c0cbdc"); sp.set(4, 4 + i, "#c0cbdc"); if (i % 2) { sp.set(4 + i, 4 + i, "#8b9bb4"); sp.set(4 + i, 4 - i, "#8b9bb4"); } } sp.set(4, 4, "#ffffff"); sp.set(4 + v - 1, 2, "#ffffff"); return gridSprite(sp, 4, 4); }
    const { w, c, sp } = sq(r), d = (x, y) => Math.hypot(x - c, y - c), inD = (x, y) => d(x, y) <= r + 0.5, off = v * 3;
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
      if (!inD(x, y)) continue;
      const dd = d(x, y), t = 1 - dd / (r + 0.5);
      if (kind === "scorch") { if (dith(x + off, y + v, 0.45 + 0.4 * t)) sp.set(x, y, OUT); else if (t > 0.2 && dith(x + off + 2, y, 0.5)) sp.set(x, y, R.ground[0]); }
      else if (kind === "crater") {
        if (dd > r - 3) { const far = y < c - Math.abs(x - c) * 0.4; sp.set(x, y, far && dith(x + off, y, 0.5) ? R.ground[3] : (dith(x + off, y, 0.7) ? R.ground[2] : R.ground[1])); }
        else { const tt = 1 - dd / Math.max(1, r - 3); sp.set(x, y, tt > 0.7 ? FAR2 : tt > 0.35 ? (dith(x + off, y, (tt - 0.35) * 2.5) ? FAR2 : R.ground[0]) : (dith(x + off, y, tt * 2.5) ? R.ground[0] : R.ground[1])); }
      }
      else if (kind === "dirt" || kind === "filled") { if (dith(x + off, y, 0.55 * (0.4 + t))) sp.set(x, y, hash(x, y, 50 + v) < 0.5 ? R.ground[0] : R.ground[1]); }
      else if (kind === "rubble") { const k = hash(Math.floor((x + off) / 3), Math.floor(y / 2), 51 + v); if (t > 0.1 || dith(x, y, 0.5)) sp.set(x, y, k < 0.25 ? R.stone[0] : k < 0.6 ? R.stone[1] : k < 0.9 ? R.stone[2] : R.stone[3]); }
      else if (kind === "damp") { if (dd > r - 1.6) { if (dith(x + off, y, 0.7)) sp.set(x, y, R.ground[0]); } else if (dith(x + off, y, 0.2)) sp.set(x, y, R.water[0]); }
    }
    if (kind === "crack") for (let b = 0; b < 4; b++) { let x = c, y = c, a = b * Math.PI / 2 + hash(b, v, 52) * 1.2; for (let i = 0; i < r; i++) { x += Math.cos(a) * 1.2; y += Math.sin(a) * 0.9; a += hash(i, b + v * 4, 53) - 0.5; if (inD(x, y)) sp.set(x, y, R.ground[0]); } }
    return gridSprite(sp, c, c); }); };
  // the live marks' frames: fire (4 flicker frames, 4 fade levels), the knights' frost, the trolls' ice (a shimmer; its shrink is the
  // radius), puddles (2 shimmer frames, 4 drying levels), the Emberback's glowing rubble cooling (4 steps)
  MK.live = (kind, r, f, level) => { r = Math.max(2, Math.round(r)); f = (f | 0) & 3; level = clamp(level === undefined ? 3 : level | 0, 0, 3); return once("live" + kind + "|" + r + "|" + f + "|" + level, () => {
    const w = 2 * r + 3, top = kind === "fire" ? 4 : 0, h = w + top, sp = G(w, h), c = r + 1, cy = c + top, a = (level + 1) / 4;
    for (let y = top; y < h; y++) for (let x = 0; x < w; x++) {
      const dd = Math.hypot(x - c, y - cy); if (dd > r + 0.5) continue;
      if (kind === "fire") { if (dith(x, y, 0.3 * a)) sp.set(x, y, (x + y + f) % 3 ? "#a22633" : "#f77622"); }
      else if (kind === "frost") { if (dith(x, y, 0.45 * a)) sp.set(x, y, (x * 3 + y) % 5 ? "#b8f4ff" : "#ffffff"); }
      else if (kind === "ice") { if (dith(x, y, 0.5 * a)) sp.set(x, y, (x + y) % 3 ? "#c0cbdc" : "#8b9bb4"); if (hash(x, y, 54 + f) > 0.965) sp.set(x, y, "#ffffff"); }
      else if (kind === "puddle") { if (dith(x, y, 0.85 * a)) sp.set(x, y, dith(x + 1, y + 2, 0.3) ? R.water[0] : R.water[1]); if (hash(x, y, 55 + f) > 0.985 && level > 0) sp.set(x, y, R.water[3]); }
      else if (kind === "ember") { const k = hash(Math.floor(x / 3), Math.floor(y / 2), 56); sp.set(x, y, k < 0.25 ? R.stone[0] : k < 0.7 ? R.stone[1] : R.stone[2]); if ((x * 7 + y * 3) % 11 === 0 && hash(x, y, 57) < (3 - level) / 3) sp.set(x, y, level < 2 ? "#fee761" : "#f77622"); }
    }
    if (kind === "fire" && level > 0) for (let i = 0; i < 4; i++) { const x = 1 + ((i * 5 + f * 3) % (w - 2)), hh = (f + i) % 3; sp.set(x, cy - 1 - hh - 2, "#feae34"); sp.set(x, cy - hh - 2, "#f77622"); if (hh) sp.set(x, cy - hh - 1, "#f77622"); }
    return gridSprite(sp, c, cy); }); };
  // the telegraphs: #ff0044 cores with a 1 px soot edge. A ring r on four dither steps (the stone's fills over its last 0.5 s); a dotted aim
  // line of len px in one of 16 directions; a charge's strip, arrow-shaped, w wide; the wind-up's glint (0 dim, 1 bright)
  // a ring r (to 64: the roar's is 56) on four dither steps; solid: a 1 px outline (the rock slam's inner ring at its core's r)
  TG.ring = (r, f, solid) => { r = clamp(Math.round(r), 3, 64); f = (f | 0) & 3; return once("ring" + r + "|" + f + (solid ? "s" : ""), () => { const w = 2 * r + 5, sp = G(w, w), c = r + 2; if (solid) ringPx(sp, c, c, r, RED, 1, 0); else ringPx(sp, c, c, r, RED, [0.35, 0.55, 0.8, 1][f], f); edge(sp); return gridSprite(sp, c, c); }); };
  const DIR = 16, dirOf = a => ((Math.round((+a || 0) / (TAU / DIR)) % DIR) + DIR) % DIR;
  // an aim line and a charge's strip are baked exactly, from their true start to their true end (section 3.5: the arrow flies exactly along
  // the line shown), into their own bounding box when the aim locks, and kept in a small store that forgets the oldest (a lock's line is
  // reused every frame it shows; after the attack it goes). The 16-direction forms below stay for the tests of the older shape
  const TGC = { keep: 24, m: new Map() };
  const keep = (key, make) => { let v = TGC.m.get(key); if (v) { TGC.m.delete(key); TGC.m.set(key, v); return v; } v = make(); TGC.m.set(key, v); if (TGC.m.size > TGC.keep) TGC.m.delete(TGC.m.keys().next().value); return v; };
  TG.lineTo = (dx, dy) => { dx = clamp(Math.round(dx), -320, 320); dy = clamp(Math.round(dy), -320, 320); return keep("l" + dx + "|" + dy, () => {
    const len = Math.hypot(dx, dy), ux = len ? dx / len : 1, uy = len ? dy / len : 0, ox = Math.max(0, -dx) + 2, oy = Math.max(0, -dy) + 2, sp = G(Math.abs(dx) + 5, Math.abs(dy) + 5);
    for (let t = 0; t <= len; t += 2) sp.set(ox + ux * t, oy + uy * t, RED); edge(sp); return gridSprite(sp, ox, oy); }); };
  TG.stripTo = (dx, dy, wd) => { dx = clamp(Math.round(dx), -240, 240); dy = clamp(Math.round(dy), -240, 240); wd = clamp(Math.round(wd || 22), 8, 32); return keep("s" + dx + "|" + dy + "|" + wd, () => {
    const len = Math.hypot(dx, dy), ca = len ? dx / len : 1, sa = len ? dy / len : 0, hw = wd / 2, pad = Math.ceil(hw) + 3, ox = Math.max(0, -dx) + pad, oy = Math.max(0, -dy) + pad, W = Math.abs(dx) + 2 * pad, H = Math.abs(dy) + 2 * pad, sp = G(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const px = x - ox, py = y - oy, t = px * ca + py * sa, s = -px * sa + py * ca; if (t < 0 || t > len) continue; const lim = t > len - 8 ? hw * (len - t) / 8 + 1 : hw - (t < 6 ? 2 : 0); if (Math.abs(s) > lim) continue; if (Math.abs(s) > lim - 1.2 || dith(x, y, 0.35)) sp.set(x, y, RED); }
    edge(sp); return gridSprite(sp, ox, oy); }); };
  TG.line = (len, dir) => { len = clamp(Math.round(len / 4) * 4, 8, 240); dir = ((dir | 0) % DIR + DIR) % DIR; return once("tline" + len + "|" + dir, () => {
    const a = dir * TAU / DIR, ca = Math.cos(a), sa = Math.sin(a), w = 2 * len + 6, sp = G(w, w), c = w >> 1;
    for (let t = 0; t <= len; t += 2) sp.set(c + ca * t, c + sa * t, RED); edge(sp); return gridSprite(sp, c, c); }); };
  TG.strip = (len, dir, wd) => { len = clamp(Math.round(len / 8) * 8, 16, 160); dir = ((dir | 0) % DIR + DIR) % DIR; wd = clamp(Math.round(wd || 22), 8, 32); return once("tstrip" + len + "|" + dir + "|" + wd, () => {
    const a = dir * TAU / DIR, ca = Math.cos(a), sa = Math.sin(a), w = 2 * (len + wd) + 8, sp = G(w, w), c = w >> 1, hw = wd / 2;
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) { const dx = x - c, dy = y - c, t = dx * ca + dy * sa, s = -dx * sa + dy * ca; if (t < 0 || t > len) continue; const lim = t > len - 8 ? hw * (len - t) / 8 + 1 : hw - (t < 6 ? 2 : 0); if (Math.abs(s) > lim) continue; if (Math.abs(s) > lim - 1.2 || dith(x, y, 0.35)) sp.set(x, y, RED); }
    edge(sp); return gridSprite(sp, c, c); }); };
  TG.glint = bright => once("glint" + (bright ? 1 : 0), () => { const sp = G(5, 5); if (bright) { for (let i = 0; i < 3; i++) { sp.set(1 + i, 2, RED); sp.set(2, 1 + i, RED); } } else { sp.set(1, 1, RED); sp.set(2, 1, RED); sp.set(1, 2, RED); sp.set(2, 2, RED); } edge(sp); return gridSprite(sp, 2, 2); });
  // the moat's shimmer: four frames of 1 px glints on 1 pixel in 40, as a 48 x 48 tile drawn over the water in view (clipped to it)
  MK.shimmer = f => once("shimmer" + ((f | 0) & 3), () => { const w = 48, px = new Array(w * w).fill(null); for (let i = 0; i < w * w; i++) if (hash(i % w, (i / w) | 0, 58 + ((f | 0) & 3)) < 1 / 40) px[i] = R.water[3]; return sprite(px, w, w, 0, 0); });
  // stone pebbles for a troll's crumble, bubbles for a drowning
  MK.pebble = v => once("pebble" + ((v | 0) % 3), () => { const sp = G(4, 4), v3 = (v | 0) % 3; sp.set(1, 1, R.stone[2]); sp.set(2, 1, R.stone[1]); sp.set(1, 2, R.stone[v3]); if (v3) sp.set(2, 2, R.stone[0]); outline(sp); return gridSprite(sp, 2, 2); });
  MK.bubbles = f => once("bubbles" + ((f | 0) & 3), () => { const sp = G(9, 7), ff = (f | 0) & 3; for (let i = 0; i < 3; i++) sp.set(1 + i * 3, 5 - ((ff + i * 2) % 5), i === ff % 3 ? R.water[3] : R.water[2]); return gridSprite(sp, 4, 6); });

  // ------------------------------------------------------------------ marks for trolls off the screen (section 3.14)
  // a chevron of 3, 5 or 7 px pointing outward in one of 8 directions, bone with a 1 px soot edge (red while a trebuchet's stone flies),
  // the engine's dot behind it; anchored at its tip
  const DIR8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  function edgeMark(size, dir, alarm, dot) {
    size = size >= 7 ? 7 : size >= 5 ? 5 : 3; dir = ((dir | 0) % 8 + 8) % 8;
    return once("emark" + size + "|" + dir + (alarm ? "a" : "") + (dot ? "d" : ""), () => {
      const n = size + 8, sp = G(n, n), c = n >> 1, h = (size - 1) / 2, col = alarm ? RED : BONE;
      // (ax, ay) in the chevron's own frame: ax along the direction (the tip at 0, the arms behind), ay across; a diagonal's steps are halved
      const put = (ax, ay) => { const [dx, dy] = DIR8[dir], k = dx && dy ? 2 : 1; sp.set(c + Math.round((ax * dx - ay * dy) / k), c + Math.round((ax * dy + ay * dx) / k), col); };
      for (let i = 0; i <= h; i++) { put(-i, i); put(-i, -i); }
      if (dot) { const [dx, dy] = DIR8[dir]; sp.set(c - dx * (h + 3), c - dy * (h + 3), col); }
      edge(sp);
      return gridSprite(sp, c, c);
    });
  }
  // the guide's chevron (design pass 18): two 7 px chevrons one behind the other, yellow with a soot edge, pointing outward in one of 8
  // directions at what the player should go to off the screen; anchored at its tip
  function guideMark(dir) {
    dir = ((dir | 0) % 8 + 8) % 8;
    return once("gmark" + dir, () => {
      const n = 19, sp = G(n, n), c = n >> 1, h = 3;
      const put = (ax, ay) => { const [dx, dy] = DIR8[dir], k = dx && dy ? 2 : 1; sp.set(c + Math.round((ax * dx - ay * dy) / k), c + Math.round((ax * dy + ay * dx) / k), "#fee761"); };
      for (const back of [0, 3]) for (let i = 0; i <= h; i++) { put(-back - i, i); put(-back - i, -i); }
      edge(sp);
      return gridSprite(sp, c, c);
    });
  }
  // who gets a mark: every live troll past its spawn tell and every manned trebuchet whose screen feet are outside the view and within 200
  // px of its edge, and every trebuchet stone in flight whose ring's whole hit circle is outside the view. Pure: the squire reads it too.
  // Returns [{ x, y (view px), size, dir (0 to 7), alarm, dot, d }], at most 8, the nearest first, merged within 6 px
  function edgeMarks(fight, o) {
    o = o || {}; const v = fight.view; if (!v) return [];
    const A = fight.area || {}, M = A.offscreenMarks || {}, W = v.x1 - v.x0, H = v.y1 - v.y0, within = M.within || 200, near = M.near || 64, inset = M.inset || 4;
    const SZ = Object.assign({ near: 5, far: 3, brute: 7, engine: 5 }, M.size || {}), top = typeof o.top === "number" ? Math.max(o.top, M.top || 28) : (M.top || 28), TH_ = M.thumbs || { x: 67, y: 118 }, band = (M.bottomBand || {})[o.lefty ? "left" : "right"] || (o.lefty ? [68, 204] : [180, 316]);
    const cx = W / 2, cy = (A.camera || {}).aimY || 116, out = [];
    // only the current arena's trolls (the director's fight.level.arena: { x0, x1 }; before an arena is set, every troll)
    const AR = fight.level && fight.level.arena && fight.level.arena.x0 !== undefined ? fight.level.arena : null, inArena = x => !AR || (x >= AR.x0 && x <= AR.x1);
    const add = (sx, sy, size, extra) => { if (sx >= 0 && sx <= W && sy >= 0 && sy <= H) return; const dx = Math.max(0, -sx, sx - W), dy = Math.max(0, -sy, sy - H), d = Math.hypot(dx, dy); if (d > within) return; out.push(Object.assign({ sx, sy, d, size: size === "auto" ? (d <= near ? SZ.near : SZ.far) : size, alarm: false, dot: false }, extra || {})); };
    for (const f of fight.foes || []) if (!f.dead && !(f.spawn > 0) && inArena(f.x)) add(f.x - v.x0, f.y - (f.z || 0) - v.y0, f.kind === "brute" || f.kind === "rockbrute" ? SZ.brute : f.kind === "wolf" ? SZ.far : "auto");   // (a wolf's chevron the small size, design pass 21)
    for (const e of fight.engines || []) if (e.manned && !e.wrecked) add(e.x - v.x0, e.y - v.y0, SZ.engine, { dot: true, alarm: !!e.stone });
    for (const s of ((o.marks || fight.marks || {}).stone || [])) { const r = s.r || 16, sx = s.x - v.x0, sy = s.y - (s.z || 0) - v.y0; if (sx + r < 0 || sx - r > W || sy + r < 0 || sy - r > H) add(sx, sy, SZ.engine, { alarm: true }); }
    out.sort((a, b) => a.d - b.d);
    const placed = [];
    for (const m of out) {
      if (placed.length >= (M.max || 8)) break;
      // the point where the line from the view's centre to the troll's feet leaves the view, inset
      const x0 = inset, x1 = W - inset, y0 = inset, y1 = H - (o.toast ? 22 : inset), ddx = m.sx - cx, ddy = m.sy - cy;
      let t = Infinity; if (ddx > 0) t = Math.min(t, (x1 - cx) / ddx); if (ddx < 0) t = Math.min(t, (x0 - cx) / ddx); if (ddy > 0) t = Math.min(t, (y1 - cy) / ddy); if (ddy < 0) t = Math.min(t, (y0 - cy) / ddy);
      let x = clamp(cx + ddx * t, x0, x1), y = clamp(cy + ddy * t, y0, y1);
      // where it may not sit: above the top row, in a thumbs' corner, on the bottom edge outside the band; it slides along the edge
      const onBottom = y >= y1 - 0.5, onTop = y <= y0 + 0.5;
      if (onTop || y < top) { y = top; x = x < cx ? x0 : x1; }
      if (onBottom && (x < band[0] || x > band[1])) {
        const toBand = x < band[0] ? band[0] - x : x - band[1], side = x < cx ? x0 : x1, upSide = Math.abs(x - side) + (y1 - (TH_.y - 1));
        if (toBand <= upSide) x = x < band[0] ? band[0] : band[1]; else { x = side; y = TH_.y - 1; }
      }
      if ((x >= W - TH_.x || x <= TH_.x) && y >= TH_.y && !onBottom) y = Math.max(top, TH_.y - 1);
      if ((x >= W - TH_.x || x <= TH_.x) && y >= TH_.y) y = TH_.y - 1;
      const dup = placed.find(p => Math.hypot(p.x - x, p.y - y) <= (M.merge || 6)); if (dup) continue;
      const ang = Math.atan2(y - cy, x - cx), dir = ((Math.round(ang / (TAU / 8)) % 8) + 8) % 8;
      placed.push({ x: Math.round(x), y: Math.round(y), size: m.size, dir, alarm: m.alarm, dot: m.dot, d: Math.round(m.d) });
    }
    return placed;
  }

  // ------------------------------------------------------------------ the level on the stage: Gate.Scene
  // The scene owns the baked tiles, the decal canvases of lasting marks (one per column, made when the first mark falls there), the grass
  // tufts, and the actors: every piece in view drawn by its foot with the bodies (section 3.2: depth), the platform groups and bodies at
  // height (section 3.2b). The page draws the ground before its camera translate (drawGround) and the rest after (draw), and the marks for
  // trolls off the screen last, in view coordinates (drawEdgeMarks). Nothing is drawn pixel by pixel: every piece, mark and telegraph is a
  // baked canvas drawn once with drawImage
  const drawAt = (ctx, s, x, y) => ctx.drawImage(s.canvas(), Math.round(x) - s.ox, Math.round(y) - s.oy);
  const blit = (ctx, s, x, y) => ctx.drawImage(s.canvas(), Math.round(x), Math.round(y));
  // art (design pass 21): a level's own art module (proto/hall.js's Hall.art), or nothing for the Troll Gate, whose scene is then today's,
  // pixel for pixel. The art paints the column tiles (paintRows), says the standing pieces (pieces), has no grass (tufts: false), and
  // draws its flicker rings under the decals (lights), its back wall's live things (wall), its weather after the actors (weather), its
  // footprints into the decals (prints) and its own looks for the marks (markLook, markKind, liveLook, chipLook); every hook is optional
  function Scene(A, art) {
    this.A = A; this.art = art || null; this.P = prepare(A); this.tiles = new Tiles(A, this.art); this.cols = this.tiles.n;
    this.decals = new Array(this.cols).fill(null); this.lifted = []; this.queue = []; this.stamped = 0; this.lastStamps = 0;
    this.fell = {}; this.wrecks = {}; this.dying = []; this.flares = []; this.last = new Map(); this.covered = new WeakSet(); this.crows = -1; this.world = null; this.byKey = null;
    this.tufts = this.art && this.art.tufts === false ? [] : makeTufts(A, this.P); this.flat = new Map(); this.view = { x0: 0, y0: 0 }; this.vw = TW; this.vh = 216;
    this.blocks = new Map(); this.breaks = new Map(); this.clock = null; this.fight = null; this.printed = 0; this.lastPrints = 0;   // (the troll knights' blocks and breaks by foe, on the fight's clock; the art's clock)
    this.badly = A.notes && typeof A.notes.badlyHurtAt === "number" ? A.notes.badlyHurtAt : 30;   // the HP at or under which a knight's shadow goes red (section 3.8)
    // the platforms drawn as a group with their bodies (the chapel's roof, the archer tower's deck); the stair, the landing and the lowered
    // drawbridge draw no bodies of their own, so a body on them is drawn by its feet, lifted by its z (section 3.2b)
    this.grouped = new Set((A.surfaces || []).filter(su => su.kind === "roof" || (su.kind === "deck" && su.rect)).map(su => su.id));
    this.flatPlats = new Set((A.surfaces || []).filter(su => su.kind === "deck" && !su.rect).map(su => su.id));   // drawn with the floor, before the bodies
    this.pieces = this.art && this.art.pieces ? artPieces(this, A, this.art) : staticPieces(this, A);
  }
  // a level's own pieces (design pass 21): its art says every standing thing as an actor, act(bx0, by0, bx1, by1, y, draw, z): its box
  // for the cull, its foot for the sort, its height for a tie; draw(ctx, fight, o) as the gate's pieces are drawn
  function artPieces(S, A, art) { const out = []; art.pieces(A, S, (bx0, by0, bx1, by1, y, draw, z) => out.push({ bx0, by0, bx1, by1, y, z: z || 0, draw })); return out; }
  // the platform a point at height z lies on: a surface whose box holds it (the stair at any height along it, the rest within 8 px of
  // their z), or the lowered drawbridge's deck by its u and v box; null on the ground
  Scene.prototype.platAt = function (x, y, z) {
    for (const su of this.A.surfaces || []) {
      if (su.rect) { const [x0, y0, x1, y1] = su.rect; if (x < x0 || x > x1 || y < y0 || y > y1) continue; if (su.kind === "stair" || Math.abs((z || 0) - (su.z || 0)) <= 8) return su.id; continue; }
      if (su.kind === "deck") { const B = this.A.bridge; if (B && B.u && B.v) { const u = x - y, v = x + y; if (u >= B.u[0] - 2 && u <= B.u[1] + 2 && v >= B.v[0] && v <= B.v[1]) return su.id; } }
    }
    return null;
  };
  // ---- the window the page draws (Isaac, 7 Oct 2026: a level fills the screen): w x h world px around the camera's view, 384 x 216 by
  // default; every culling and the ground's columns follow it
  Scene.prototype.setWindow = function (w, h) { this.vw = w > 0 ? w : TW; this.vh = h > 0 ? h : 216; };
  // ---- the ground, before the camera's translate: the one or two tiles the view overlaps, each with its decal canvas over it
  Scene.prototype.drawGround = function (ctx, camX, camY) {
    const c0 = clamp(Math.floor(camX / TW), 0, this.cols - 1), c1 = clamp(Math.floor((camX + this.vw - 1) / TW), 0, this.cols - 1);
    this.flush();
    let n = 0;
    if (this.art) {
      // a level's art (design pass 21): the tiles, then its flicker rings over the baked light in world coordinates (on the clock of the
      // frame before: the page hands the scene its clock in drawTufts), then the decals, so a ring never paints over a lasting mark
      for (let c = c0; c <= c1; c++) { ctx.drawImage(this.tiles.canvas(c), c * TW - camX, -camY); n++; }
      this.view = { x0: camX, y0: camY };
      if (this.art.lights) { const k = this.clock || { t: 0, still: true }; ctx.save(); ctx.translate(-camX, -camY); this.art.lights(ctx, this.fight, k.t, k.still, this); ctx.restore(); }
      for (let c = c0; c <= c1; c++) { const d = this.decals[c]; if (d) ctx.drawImage(d.canvas, c * TW - camX, -camY); }
      return n;
    }
    for (let c = c0; c <= c1; c++) { ctx.drawImage(this.tiles.canvas(c), c * TW - camX, -camY); n++; const d = this.decals[c]; if (d) ctx.drawImage(d.canvas, c * TW - camX, -camY); }
    this.view = { x0: camX, y0: camY };
    return n;
  };
  // ---- the lasting marks: an event (mark / markEnd, or a piece broken) becomes a stamp into the column's decal canvas, at most 8 a frame
  const STAMP_END = { fire: "scorch", puddle: "damp", crater: "filled", clod: "dirt" };
  Scene.prototype.stamp = function (e) {
    let kind = e.type === "markEnd" ? (e.why === "puddle" || e.why === "ice" ? null : STAMP_END[e.kind]) : (MK.KINDS.includes(e.kind) ? e.kind : null);
    if (this.art && this.art.markKind) kind = this.art.markKind(e, kind, this.A);   // (a level's art may stamp a mark of its own: the yard's melt under a fire)
    if (!kind) return false;
    const r = e.r || (kind === "rubble" ? 6 : kind === "crack" ? 8 : 4), key = kind + ":" + Math.round(e.x) + ":" + Math.round(e.y);
    if (this.queue.some(q => q.key === key)) return false;
    this.queue.push({ key, kind, x: e.x, y: e.y, z: e.z || 0, r, v: (e.id | 0) % 3, len: e.len, on: e.on || null });
    return true;
  };
  // a stamp on a platform (the event's `on`, or the platform under its point at its height) is kept as a lifted record drawn with that
  // platform, at most 600 of them (the oldest go); a stamp at height over no platform lands flat
  Scene.prototype.flush = function () {
    let n = 0;
    while (this.queue.length && n < 8) {
      const q = this.queue.shift(), qr = q.kind === "tangle" || q.kind === "stakes" ? (q.len || 16) / 2 : q.r;
      const s = (this.art && this.art.markLook && this.art.markLook(q.kind, qr, q.v, q.x, q.y, this.A)) || MK.stamp(q.kind, qr, q.v);   // (a level's art has its own looks: the yard's melt, the halls' stone craters)
      const plat = q.on || (q.z > 0 ? this.platAt(q.x, q.y, q.z) : null);
      if (plat) { this.lifted.push({ s, x: q.x, y: q.y, z: q.z, plat }); while (this.lifted.length > 600) this.lifted.shift(); n++; continue; }
      if (q.z > 0) q.y -= q.z;
      this.stampAt(s, q.x, q.y);
      n++;
    }
    this.lastStamps = n; this.stamped += n;
    return n;
  };
  // a sprite drawn into the decal canvas of every column it touches, its anchor at (x, y); the column's canvas made on its first stamp
  Scene.prototype.stampAt = function (s, x, y) {
    const x0 = Math.round(x) - s.ox, x1 = x0 + s.w;
    for (let c = clamp(Math.floor(x0 / TW), 0, this.cols - 1); c <= clamp(Math.floor((x1 - 1) / TW), 0, this.cols - 1); c++) {
      let d = this.decals[c];
      if (!d) { const cv = root.document.createElement("canvas"); cv.width = TW; cv.height = TH; d = this.decals[c] = { canvas: cv, ctx: cv.getContext("2d"), n: 0 }; }
      d.ctx.drawImage(s.canvas(), x0 - c * TW, Math.round(y) - s.oy); d.n++;
    }
  };
  // a level's footprints (design pass 21 section 3.8): the art says where the bodies' feet left a print in the snow this frame, at most
  // 24, and each is drawn into the decals at once (none queue behind the marks' 8 a frame)
  Scene.prototype.prints = function (fight) {
    if (!this.art || !this.art.prints || !fight) return 0;
    const list = this.art.prints(fight, this) || [];
    let n = 0;
    for (const p of list) { if (n >= 24) break; this.stampAt(p.s, p.x, p.y); n++; }
    this.lastPrints = n; this.printed += n;
    return n;
  };
  // the page hands the scene what happened: marks made and ended, pieces wrecked (cut wire, broken stakes and staves lie flat), trolls dying
  Scene.prototype.take = function (e, fight) {
    if (e.type === "mark" || e.type === "markEnd") return this.stamp(e);
    if (e.type === "wreck") { this.wrecks[e.piece] = e.t === undefined ? (fight ? fight.t : 0) : e.t; const p = fight && fight.pieces.find(p => p.i === e.piece); if (p && (p.kind === "wire" || p.kind === "stakeFence" || p.kind === "barrel")) { const s = fight.world.solids[p.solids[0]]; const len = s && s.shape === "r" ? Math.max(s.x1 - s.x0, s.y1 - s.y0) : 16; return this.stamp({ kind: p.kind === "wire" ? "tangle" : p.kind === "barrel" ? "staves" : "stakes", x: p.x, y: p.y, id: p.i, len, r: 6 }); } return false; }
    if (e.type === "fell") { this.fell[e.piece] = fight ? fight.t : 0; return true; }
    // the Emberback's death flare (section 3.6a): a windUp with no live troll behind it; its ring plays on the fight's clock for its wind
    if (e.type === "windUp") { if (e.attack === "flare" && e.tel && e.tel.kind === "ring") { this.flares.push({ x: e.x, y: e.y, z: e.z || 0, r: e.tel.r || 16, T: e.wind || e.tel.grow || 0.5, t0: fight ? fight.t : 0, on: e.on || null }); return true; } return false; }
    if (e.type === "die") { const L = this.last.get(e.foe) || { facing: "toward", anim: "idle", i: 0 }, f = fight && (fight.foes || []).find(x => x.id === e.foe), on = e.on || (f && f.on) || null;
      this.dying.push({ id: e.foe, kind: e.kind, x: e.x, y: e.y, z: e.z || 0, on, why: e.why, t: 0, facing: L.facing, anim: L.anim, i: L.i, dent: L.dent | 0 });
      if (e.why !== "DROWNED" && e.why !== "SPIKED" && fight && fight.area && fight.area.marks && !(fight.marks && fight.marks.rubbleEvents)) this.stamp({ kind: "rubble", x: e.x, y: e.y, z: e.z || 0, on, id: e.foe, r: e.kind === "brute" || e.kind === "rockbrute" ? 10 : 6 }); return true; }
    // a troll knight's shield (design pass 21 section 3.6): a block shows its block pose for 0.25 s, a guard break its reel (the rules'
    // reelUntil, else 1.2 s from the event), both on the fight's clock (trollAnim reads the guard's own record too)
    if (e.type === "foeBlock" || e.type === "guardBreak") { const id = e.foe !== undefined ? e.foe : e.id; if (id === undefined) return false; (e.type === "foeBlock" ? this.blocks : this.breaks).set(id, fight ? fight.t : 0); return true; }
    // what a level's art wants to hear of (the hall's: a phase's art, the waves, the end)
    if (this.art && this.art.take) return !!this.art.take(e, fight, this);
    return false;
  };
  // ---- the grass tufts: about a hundred a column, placed by the seed on open ground, swaying on four frames, flattened by a body for 2 s
  function makeTufts(A, P) {
    const out = [], cols = Math.ceil((A.w || 3072) / TW), seed = P.seed;
    const bad = (x, y) => { if (y < FLOOR_TOP + 6 || y >= LIP - 4 || x < 12) return true; if (P.castle && x - y >= (P.moat ? P.moat.u[0] : P.castle.foot.u) - 10) return true;
      for (const h of P.holes) if (x >= h.x0 - 3 && x < h.x1 + 3 && y >= h.y0 - 3 && y < h.y1 + 4) return true;
      for (const cp of P.caltrops) if (x >= cp.x0 && x < cp.x1 && y >= cp.y0 && y < cp.y1) return true;
      if (P.road && x < P.road.x1 && y >= P.road.ruts[0][0] - 2 && y <= P.road.ruts[1][1] + 2) return true;
      for (const t of P.trodden) if (Math.hypot(x - t.x, y - t.y) < t.r * 0.8) return true;
      return false; };
    for (let c = 0; c < cols; c++) for (let i = 0; i < 140; i++) { const x = c * TW + Math.floor(hash(c, i, seed + 60) * TW), y = Math.floor(hash(c, i, seed + 61) * TH); if (!bad(x, y)) out.push({ x, y, v: i % 3 }); }
    out.sort((a, b) => a.x - b.x);
    return out;
  }
  Scene.prototype.drawTufts = function (ctx, t, still, fight) {
    // a level's art (design pass 21) has no grass: here, after the ground and before the floor's marks, it keeps the frame's clock for its
    // rings, draws its back wall's live things (the torches' flames, the hearth, the doors that open) and leaves its footprints
    if (this.art) { this.clock = { t, still }; if (fight) this.fight = fight; let n = 0; if (this.art.wall) n += this.art.wall(ctx, fight || null, t, still, this) || 0; this.prints(fight); return n; }
    const x0 = this.view.x0 - 4, x1 = this.view.x0 + this.vw + 4, y0 = this.view.y0 - 6, y1 = this.view.y0 + this.vh + 6, bodies = fight && fight.world && fight.world.list ? fight.world.list : [];
    let lo = 0, hi = this.tufts.length; while (lo < hi) { const m = (lo + hi) >> 1; if (this.tufts[m].x < x0) lo = m + 1; else hi = m; }
    let n = 0;
    for (let i = lo; i < this.tufts.length && this.tufts[i].x <= x1; i++) {
      const g = this.tufts[i]; if (g.y < y0 || g.y > y1) continue;
      for (const b of bodies) if (Math.abs(b.x - g.x) < 7 && Math.abs(b.y - g.y) < 5 && !(b.z > 0)) { this.flat.set(i, t + 2); break; }
      const flat = (this.flat.get(i) || 0) > t, f = still ? 0 : Math.floor(t * 4 + g.x / 24) & 3;
      drawAt(ctx, SPR.tuft(g.v, f, flat), g.x, g.y); n++;
    }
    return n;
  };
  // ---- the pieces that never move: their actors, built once from the area (the state of a breakable piece is read from the fight)
  function staticPieces(S, A) {
    const out = [], K = A.propKinds || {};
    const act = (bx0, by0, bx1, by1, y, draw, z) => out.push({ bx0, by0, bx1, by1, y, z: z || 0, draw });
    for (const r of A.rocks || []) act(r.x - r.r - 2, r.y - r.r - 2, r.x + r.r + 10, r.y + r.r + 3, r.y, (ctx, F) => { const s = S.solidAt(F, r.x, r.y); if (s && s.gone) return; drawAt(ctx, longShadow(r.r), r.x, r.y); drawAt(ctx, SPR.rock(r.r, !!(s && s.cracked)), r.x, r.y); });
    for (const p of A.props || []) {
      const k = p.kind, pk = K[k] || {};
      if (k === "mill") act(p.x - 20, p.y - 44, p.x + 20, p.y + 12, p.y, ctx => { drawAt(ctx, longShadow(p.r), p.x, p.y); drawAt(ctx, SPR.mill(), p.x, p.y); });
      else if (k === "sails") sliced(out, SPR.sails(p.x1 - p.x0, p.y1 - p.y0), p.x0, p.y0, p.x1, p.y1, 6);
      else if (k === "well") act(p.x - 11, p.y - 24, p.x + 11, p.y + 7, p.y, ctx => drawAt(ctx, SPR.well(), p.x, p.y));
      else if (k === "cart") sliced(out, SPR.cart(p.x1 - p.x0, p.y1 - p.y0, !!p.over), p.x0, p.y0, p.x1, p.y1, 16);
      else if (k === "burntTent") sliced(out, SPR.burntTent(p.x1 - p.x0, p.y1 - p.y0), p.x0, p.y0, p.x1, p.y1, 10);
      else if (k === "rubble") sliced(out, SPR.rubble(p.x1 - p.x0, p.y1 - p.y0), p.x0, p.y0, p.x1, p.y1, 18);
      else if (k === "gibbet") act(p.x - 4, p.y - 37, p.x + 13, p.y + 2, p.y, ctx => drawAt(ctx, SPR.gibbet(), p.x, p.y));
      else if (k === "banner") act(p.x - 3, p.y - 33, p.x + 11, p.y + 2, p.y, ctx => drawAt(ctx, SPR.banner(p.side || "army"), p.x, p.y));
      else if (k === "post") act(p.x - 4, p.y - 23, p.x + 6, p.y + 2, p.y, ctx => drawAt(ctx, SPR.post(), p.x, p.y));
      else if (k === "headstone") act(p.x - 6, p.y - 12, p.x + 6, p.y + 2, p.y, ctx => drawAt(ctx, SPR.headstone(p.x), p.x, p.y));
      else if (k === "barrel") act(p.x - 7, p.y - 20, p.x + 7, p.y + 4, p.y, (ctx, F) => { const pc = S.pieceAt(F, p.x, p.y); if (pc && pc.gone) return; drawAt(ctx, SPR.barrel(), p.x, p.y); });
      else if (k === "wire" || k === "stakeFence") {
        // one actor per section, read from the fight's pieces (a cut or broken section is stamped flat and no longer drawn)
        const along = p.x1 - p.x0 >= p.y1 - p.y0, len = along ? p.x1 - p.x0 : p.y1 - p.y0, n = Math.max(1, Math.ceil(len / (pk.section || 16) - 1e-9)), w = len / n;
        for (let i = 0; i < n; i++) {
          const x0 = along ? p.x0 + w * i : p.x0, y0 = along ? p.y0 : p.y0 + w * i, x1 = along ? x0 + w : p.x1, y1 = along ? p.y1 : y0 + w, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
          act(x0 - 2, y0 - 14, x1 + 2, y1 + 2, y1, (ctx, F) => { const pc = S.pieceAt(F, cx, cy); if (pc && pc.gone) return;
            if (k === "wire") { const s = SPR.wire(Math.round(w), i === n - 1, !along); if (along) blit(ctx, s, x0 - 1, y1 - 11); else blit(ctx, s, x0 - 2, y0 - 1); } else drawAt(ctx, SPR.stakes(), cx, y1); });
        }
      }
    }
    // the outposts' cookfires (their huts are read from the fight's pieces each frame); the tall grass over the feet of what stands in it
    for (const op of A.outposts || []) if (op.fire) { const [x, y] = op.fire; act(x - 9, y - 12, x + 9, y + 4, y, (ctx, F, o) => drawAt(ctx, SPR.cookfire(o.still ? 0 : Math.floor(o.t * 8 + x) & 3), x, y)); }
    for (const g of A.tallGrass || []) { const [x, y] = g; act(x - 1, y - 8, x + 33, y + 21, y + 20, (ctx, F) => { if (S.grassBurnt(F, x, y)) return; blit(ctx, SPR.tallGrass(), x - 1, y - 8); }); }
    // the palisades: logs every 5 px the full height of the floor (one or two staggered rows), the troll gates in their places; fallen, the
    // logs lean east over four frames and lie flat
    const PY = A.palisadeY || [64, 424], gates = A.trollGates || [];
    for (const s of A.palisades || []) {
      const rows = s.rows || 1;
      for (let r = 0; r < rows; r++) for (let y = PY[0] + 6 + r * 2; y <= PY[1]; y += 5) {
        if (gates.some(([g0, g1]) => y >= g0 && y <= g1)) continue;
        const x = s.x0 + 2 + r * 4, v = ((x * 7 + y) % 5) < 2 ? 1 : 0;
        act(x - 4, y - 21, x + 20, y + 3, y, (ctx, F, o) => { const f = S.palisadeFrame(F, s, o.t); drawAt(ctx, SPR.log(v, f), x, y); });
      }
      for (const [g0, g1] of gates) { const x = s.x0 + 4, y = g1; act(x - 6, g0 - 4, x + 6, g1 + 2, y, (ctx, F, o) => { const f = S.palisadeFrame(F, s, o.t); if (f >= 4) return; drawAt(ctx, SPR.gate(S.gateOpen(F, s, g0, g1)), x, y); }); }
    }
    // the chapel (its roof group, the stair, the landing, the south wall-head, the south face) and the archer tower (its group)
    for (const su of A.surfaces || []) {
      if (su.kind === "roof") { const [x0, y0, x1, y1] = su.rect, w = x1 - x0, d = y1 - y0, gap = (su.parapet && su.parapet.gaps || []).filter(g => g.side === "s").map(g => [g.from - x0, g.to - x0])[0] || [w, w], z = su.z;
        act(x0 - 1, y0 - z - 10, x1 + 1, y1 + 1, y0, (ctx, F, o) => { blit(ctx, SPR.chapelRoof(w, d, gap), x0 - 1, y0 - z - 1); if (su.bell) drawAt(ctx, SPR.bell(), su.bell[0], su.bell[1] - z); S.drawLifted(ctx, su.id, o); S.drawOn(ctx, F, o, su.id); S.drawPouches(ctx, F, o, su.id); blit(ctx, SPR.chapelHead(w, gap), x0 - 1, y1 - z - 5); }, z);
        act(x0 - 1, y1 - z, x1 + 1, y1 + 1, y1, ctx => blit(ctx, SPR.chapelFace(w, su.block ? su.block.ht : z), x0 - 1, y1 - z - 1)); }
      else if (su.kind === "stair") { const [x0, y0, x1, y1] = su.rect, steps = su.steps || 8, tread = (x1 - x0) / steps, rise = (su.z[1] - su.z[0]) / steps; act(x0 - 1, y0 - su.z[1] - 1, x1 + 1, y1 + 1, y0, (ctx, F, o) => { const s = SPR.stair(steps, tread, rise, y1 - y0); blit(ctx, s, x0 - 1, y1 + 1 - s.h); S.drawLifted(ctx, su.id, o); }); }
      else if (su.kind === "landing") { const [x0, y0, x1, y1] = su.rect; act(x0 - 1, y0 - su.z - 1, x1 + 1, y1 + 1, y0, (ctx, F, o) => { const s = SPR.landing(x1 - x0, y1 - y0, su.z); blit(ctx, s, x0 - 1, y1 + 1 - s.h); S.drawLifted(ctx, su.id, o); }); }
      else if (su.kind === "deck" && su.rect) {
        const [x0, y0, x1, y1] = su.rect, w = x1 - x0, d = y1 - y0, z = su.z, slab = su.slab || 4, gap = (su.parapet && su.parapet.gaps || []).filter(g => g.side === "s").map(g => [g.from - x0, g.to - x0])[0] || [w, w];
        const legs = (su.legs && su.legs.at) || [], L = (A.ladders || []).find(l => l.deck === su.id);
        act(x0 - 8, y0 - z - 24, x1 + 8, y1 + 8, y1, (ctx, F, o) => {
          const P = F.world.platBy[su.id];
          if (!P || !P.active) { return; }   // felled: its poles lie as cover, drawn with the ground's cover
          const back = legs.filter(l => l[1] < (y0 + y1) / 2), front = legs.filter(l => l[1] >= (y0 + y1) / 2);
          for (const l of back) drawAt(ctx, SPR.leg(), l[0], l[1]);
          S.drawUnder(ctx, F, o, su);
          for (const l of front) drawAt(ctx, SPR.leg(), l[0], l[1]);
          blit(ctx, SPR.deck(w, d, slab), x0 - 1, y0 - z - 1);
          blit(ctx, SPR.deckHeads(w, d, gap, false), x0 - 1, y0 - z - 5);
          if (su.lean) blit(ctx, SPR.leanTo(w), x0 - 1, y0 - z - 13);
          S.drawLifted(ctx, su.id, o);
          S.drawOn(ctx, F, o, su.id);
          S.drawPouches(ctx, F, o, su.id);
          blit(ctx, SPR.deckHeads(w, d, gap, true), x0 - 1, y1 - z - 5);
          if (L) { const h = L.foot[1] - (L.head[1] - z); blit(ctx, SPR.ladder(h), L.foot[0] - 4, L.head[1] - z - 1); S.drawClimber(ctx, F, o, L.id); }
        }, z);
      }
    }
    // the engines, in 8 px slices, their frame from the director's state; the castle's drum towers, bridge and gate
    for (const e of A.engines || []) { const f = e.frame; const n = Math.ceil((f.y1 - f.y0) / 8); for (let j = 0; j < n; j++) act(f.x0 - 2, f.y0 - 60, f.x1 + 2, f.y1 + 2, f.y0 + 8 * j + 8, (ctx, F, o) => { const s = SPR.trebuchet(S.engineFrame(F, e, o.t), e.id === "treb4"); drawSlice(ctx, s, f.x0, f.y0, f.y1, j, n); }); }
    // (the ram is not one of these: it is drawn where it lies, every frame, with the solids a fight adds; design pass 18)
    if (A.castle) {
      const CA = A.castle, GH = CA.gatehouse;
      if (CA.fallenTower) { const [x, y] = CA.fallenTower.at; act(x - 18, y - 46, x + 18, y + 10, y, ctx => { drawAt(ctx, longShadow(16), x, y); drawAt(ctx, SPR.stump(), x, y); }); }
      if (GH) {
        for (const t of GH.towers || []) { const [x, y] = t.at; act(x - 18, y - 140, x + 18, y + 12, y, ctx => drawAt(ctx, SPR.drumTower(), x, y)); }
        const B = A.bridge, u0 = B.u[0], u1 = B.u[1], v0 = B.v[0], v1 = B.v[1], ax = (CA.foot.u + v0) / 2, ay = (v0 - CA.foot.u) / 2, aw = (v1 - v0) / 2;
        // the gate: the oak doors and the portcullis in the arch (sheared), the eyes in its dark head; the bridge raised in front of it, or
        // down as a deck across the moat (drawn with the ground's cover, under the bodies); crows on the merlons
        act(ax - 2, ay - 70, ax + aw + 2, ay + aw + 2, ay + aw / 2 + 1, (ctx, F, o) => {
          const G0 = F.gate || {}, bridge = S.bridgeState(F, o);
          const doors = SPR.doors(G0.burst ? Math.min(3, Math.floor((F.t - G0.burst) * 10)) : 0); blit(ctx, doors, ax, ay - doors.oy);   // (the gate's clock is the fight's)
          if (G0.eyes && !G0.burstDone) { const bl = o.still ? 0 : Math.floor(o.t * 1.5) % 7; for (let i = 0; i < 3; i++) if (bl !== i) drawAt(ctx, SPR.eyes(), ax + 6 + i * 9, ay + 6 + i * 9 - 40); }
          if (G0.glint && !G0.burst && (o.still || (Math.floor(o.t * 2) & 1))) drawAt(ctx, SPR.chestGlint(), ax + 17, ay + 17 - 22);   // the chest's dull glint through the portcullis during Break the gate (section 3.12)
          if (G0.down !== false && !G0.burst) { const pc = SPR.portcullis(G0.stage | 0), lift = G0.lift ? Math.round(G0.lift * 50) : 0;
            if (lift) { ctx.save(); ctx.beginPath(); ctx.moveTo(ax, ay - 56); ctx.lineTo(ax + aw, ay + aw - 56); ctx.lineTo(ax + aw, ay + aw + 1); ctx.lineTo(ax, ay + 1); ctx.closePath(); ctx.clip(); blit(ctx, pc, ax, ay - pc.oy - lift); ctx.restore(); }
            else blit(ctx, pc, ax, ay - pc.oy); }
          // the bridge: raised, the face in the arch; falling, swung out over the moat frame by frame (its shadow is drawn with the floor);
          // down, the deck lies with the floor. Its two chains run from the gatehouse's holes (h 84, beside the arch) to its outer corners:
          // the face's top corners raised, the deck's bank corners down, and wherever the corners are through the fall
          const sw = bridge.down ? 4 : bridge.falling ? bridge.frame : 0, [dx, dy] = bridgeSwing(sw);
          if (sw < 4) { const s = SPR.bridgeRaised(sw); blit(ctx, s, ax - s.ox, ay - s.oy); }
          for (const [hx, hy, cx, cy] of [[ax - 1, ay - 85, ax + dx, ay - 1 + dy], [ax + aw, ay + aw - 84, ax + aw - 1 + dx, ay + aw - 2 + dy]]) drawAt(ctx, SPR.chain(cx - hx, cy - hy), hx, hy);
          if (S.crows >= 0 && o.t - S.crows < 1.6 && !o.still) { const q = (o.t - S.crows) / 1.6, f = Math.floor(o.t * 10) & 3; for (let i = 0; i < 3; i++) drawAt(ctx, SPR.crow(f), ax - 20 + i * 14 - q * 30, ay - 80 + i * 12 - q * 50 - (i % 2) * 6); }
          else if (S.crows < 0) for (let i = 0; i < 3; i++) drawAt(ctx, SPR.crow(0), ax - 20 + i * 14 + (i === 2 ? 60 : 0), ay - 80 + i * 14 + (i === 2 ? 60 : 0));   // (under reduced motion the crows sit)
        });
      }
    }
    return out;
  }
  // a deep piece in 8 px slices, each sorted by its own foot (the slices of a sprite baked whole: rows top + 8j to top + 8j + 8)
  function sliced(out, s, x0, y0, x1, y1, ht) { const n = Math.ceil((y1 - y0) / 8); for (let j = 0; j < n; j++) out.push({ bx0: x0 - 2, by0: y0 - ht - 2, bx1: x1 + 2, by1: y1 + 2, y: y0 + 8 * j + 8, z: 0, draw: ctx => drawSlice(ctx, s, x0, y0, y1, j, n) }); }
  function drawSlice(ctx, s, x0, y0, y1, j, n) {
    const top = s.top || 0, H = s.h, r0 = j === 0 ? 0 : top + 8 * j, r1 = j === n - 1 ? H : Math.min(H, top + 8 * j + 8);
    if (r1 <= r0) return;
    ctx.drawImage(s.canvas(), 0, r0, s.w, r1 - r0, x0 - 1, y1 + 1 - H + r0, s.w, r1 - r0);
  }
  // ---- what the actors read of the fight's state
  Scene.prototype.index = function (F) {
    if (this.world === F.world && this.byKey) return;
    this.world = F.world; this.byKey = new Map();
    for (const s of F.world.solids || []) if (s.shape === "c") this.byKey.set("s" + Math.round(s.x) + "," + Math.round(s.y), s);
    for (const p of F.world.pieces || []) this.byKey.set("p" + Math.round(p.x) + "," + Math.round(p.y), p);
  };
  Scene.prototype.solidAt = function (F, x, y) { this.index(F); return this.byKey.get("s" + Math.round(x) + "," + Math.round(y)) || null; };
  Scene.prototype.pieceAt = function (F, x, y) { this.index(F); return this.byKey.get("p" + Math.round(x) + "," + Math.round(y)) || null; };
  Scene.prototype.grassBurnt = function (F, x, y) { for (const c of F.world.cover || []) if (c.kind === "grass" && c.x0 === x && c.y0 === y) return !!c.burnt; return false; };
  // a palisade's frame: 0 standing, 1 to 3 leaning east over its 0.6 s fall, 4 lying flat (its solid gone; the page's clock times the fall)
  Scene.prototype.palisadeFrame = function (F, s, t) {
    const id = F.world.palisades[s.id], sol = id === undefined ? null : F.world.solids[id];
    if (!sol || !sol.gone) return 0;
    if (this.fell["pal" + s.id] === undefined) this.fell["pal" + s.id] = t;
    const q = (t - this.fell["pal" + s.id]) / ((this.A.palisadeFall || 0.6)); return q >= 1 ? 4 : 1 + Math.min(2, Math.floor(q * 3));
  };
  // a troll gate swings open (two frames) while a troll in its spawn tell stands at it
  Scene.prototype.gateOpen = function (F, s, g0, g1) { for (const f of F.foes || []) if (f.spawn > 0 && Math.abs(f.x - (s.x0 + 4)) < 24 && f.y >= g0 - 6 && f.y <= g1 + 6) return f.spawn > 0.3 ? 1 : 2; return 0; };
  // an engine's frame from the director's state (fight.engines: { id, phase, t, T }): crank 0..3, load, aim 0..1, loose 0..1, wrecked
  Scene.prototype.engineFrame = function (F, e, t) {
    const E = (F.engines || []).find(x => x.id === e.id), p = F.pieces.find(p => p.engine === e.id);
    if ((p && p.broken) || (E && E.phase === "wrecked")) return "wrecked";
    if (!E) return "load";
    if (E.phase === "crank") return Math.min(3, Math.floor((E.t || 0) / Math.max(0.1, E.T || 5.5) * 4));
    if (E.phase === "aim") return "aim" + (Math.floor(t * 8) & 1); if (E.phase === "loose") return "loose" + ((E.t || 0) < 0.15 ? 0 : 1);
    return "load";
  };
  // the drawbridge: raised until the director lowers it (fight.bridge = { down, fallAt (the fight's clock when the fall began, null before),
  // fall (the fall's progress 0..1) }); the fall's length is the area's (bridge.lower.fall, 0.5 s), its four frames timed from fallAt
  Scene.prototype.bridgeState = function (F, o) {
    const P = F.world.platBy && F.world.platBy.bridgeDeck, B = F.bridge || {}, L = ((this.A.bridge || {}).lower || {}).fall || 0.5;
    if (B.fallAt !== undefined && B.fallAt !== null && !B.down && F.t - B.fallAt < L) { if (this.crows < 0 && F.t - B.fallAt >= L - 0.05) this.crows = o.t; return { falling: true, frame: 1 + Math.min(2, Math.floor((F.t - B.fallAt) / L * 3)) }; }
    if (P && P.active) { if (this.crows < 0) this.crows = o.t; return { down: true }; }
    return { raised: true };
  };
  // ---- bodies: the knights (the page draws them, lifted here), the trolls, the minions; at height, with their shadows and their clip
  // the surface a body's shadow falls on: the platform it stands on or climbs beside, else the ground under it
  Scene.prototype.surfaceZ = function (F, b) {
    const P = root.Physics, W = F.world;
    if (b.on && W.platBy[b.on]) return P.platZ(W.platBy[b.on], b.x, b.y);
    if (b.climbing) { const d = W.platBy[b.climbing.ladder.deck]; return b.z >= (d ? d.z : 0) - 1 ? (d ? d.z : 0) : 0; }
    const s = P.surfaceAt ? P.surfaceAt(W, b.x, b.y, (b.air ? 0 : b.z) + 6) : null;
    return s ? s.z : 0;
  };
  // a shallow hole's near lip under a body (its feet sink below the ground in front of it): the y to clip at, or null
  Scene.prototype.lipUnder = function (F, b) {
    if (!(b.z < 0) || b.on) return null;
    for (const h of F.world.holes || []) { if (h.deep) continue;
      if (h.shape === "r" && b.x >= h.x0 && b.x <= h.x1 && b.y >= h.y0 && b.y <= h.y1) return h.y1;
      if (h.shape === "c") { const dx = b.x - h.x; if (Math.abs(dx) <= h.r && Math.hypot(dx, b.y - h.y) <= h.r) return h.y + Math.sqrt(Math.max(0, h.r * h.r - dx * dx)); } }
    return null;
  };
  Scene.prototype.drawBody = function (ctx, F, o, b, draw) {
    const z = b.z || 0, zs = this.surfaceZ(F, b), lip = this.lipUnder(F, b);
    const w = b.knight ? 7 : (b.shadow ? Math.round(b.shadow * 1.5) : 5), shrink = Math.max(0.6, 1 - Math.max(0, z - zs) / 50);
    const low = !!b.knight && typeof b.hp === "number" && b.hp <= this.badly && !b.out;   // a knight badly hurt: its shadow dithered red (section 3.8)
    if (lip !== null) { ctx.save(); ctx.beginPath(); ctx.rect(Math.round(b.x) - 40, Math.round(b.y) - 200, 80, Math.round(lip) - Math.round(b.y) + 200); ctx.clip(); }
    if (!b.air || zs > z - 60) drawAt(ctx, bodyShadow(w * shrink, low), b.x, b.y - zs);
    draw(ctx, b, z);
    if (lip !== null) ctx.restore();
  };
  // a troll's animation from its state (section 3.5's poses; the kits' own frames besides). at (design pass 21, from the scene): { ft, the
  // fight's clock; blockAt and brokeAt, its last foeBlock and guardBreak events for this troll }. A troll knight reels while its guard is
  // broken (the rules' reelUntil on the fight's clock, or f.reel) and raises its shield for 0.25 s after a block (its guard's last block, or
  // the event); its cut and the wolf's bite strike, its shield bash winds and thrusts; a wolf flies its leap and gallops over 70 px/s
  const BRUTES = { brute: 1, rockbrute: 1 };
  function trollAnim(f, t, at) {
    const A = f.act;
    if (f.reel > 0 || (at && f.reelUntil !== undefined && at.ft < f.reelUntil - 1e-9) || (at && f.reelUntil === undefined && at.brokeAt !== undefined && at.ft - at.brokeAt < 1.2)) return { anim: "reel", i: 0 };
    if (A && A.phase) { const k = A.kind || "";
      if (A.phase === "wind") return { anim: k === "charge" ? "charge" : k === "stab" || k === "jab" ? "jab" : k === "heave" ? "heave" : k === "roar" ? "roar" : k === "bash" ? "bash" : "wind", i: 0 };
      if (k === "leap" && A.phase !== "recover") return { anim: "leap", i: 0 };
      if (A.phase === "run") return { anim: "walk", i: Math.floor(t * 10) & 3 };
      if (A.phase === "strike" || A.phase === "loose" || A.phase === "slam") return { anim: k === "stab" || k === "jab" ? "jab" : k === "heave" ? "heave" : k === "bash" ? "bash" : "strike", i: 1 };
      // the rock slam's recover ends with the lift (A.lift s): the brute stoops to its rock in the crater, then stands with it overhead
      if (A.phase === "recover") return { anim: A.lift && (A.t || 0) >= (A.T || 0) - A.lift / 2 ? "idle" : "recover", i: 0 }; }
    if (at) { const g = f.guard && typeof f.guard.last === "number" ? f.guard.last : -1e9, b = at.blockAt === undefined ? -1e9 : at.blockAt, last = Math.max(g, b); if (at.ft >= last - 1e-9 && at.ft - last < 0.25) return { anim: "block", i: 0 }; }
    if (f.stagger > 0 || f.staggered) return { anim: BRUTES[f.kind] ? "sit" : "hit", i: 0 };
    if (f.flash > 0) return { anim: "hit", i: 0 };
    if (f.climbing) return { anim: "climb", i: Math.floor((f.z || 0) / 6) & 1 };
    if (f.air) return { anim: f.kind === "wolf" ? "leap" : "fall", i: 0 };
    const w = f.intent && f.intent.wish, moving = f.moving || (w && Math.hypot(w[0], w[1]) > 1) || Math.hypot(f.vx || 0, f.vy || 0) > 2 || (f.pushV && Math.hypot(f.pushV[0], f.pushV[1]) > 8);
    if (moving && f.kind === "wolf" && Math.hypot(f.vx || 0, f.vy || 0) > 70) return { anim: "run", i: Math.floor(t * 12 + (f.id || 0)) & 3 };
    if (moving) return { anim: "walk", i: Math.floor(t * 8 + (f.id || 0)) & 3 };
    return { anim: "idle", i: Math.floor(t * 2 + (f.id || 0)) & 1 };
  }
  // a troll knight's shield's dents from its guard meter (design pass 21 section 3.6): 1 at a third of the guard's breakAt, 2 at two
  // thirds (the spec's dents); a meter whose window has passed with no block is empty, as the rules count it at the next block
  function dentOf(f, ft) {
    const G = f.guard, GD = f.spec && f.spec.guard;
    if (!G) return 0;
    if (!GD || typeof G.meter !== "number") return clamp(G.dent | 0, 0, 2);
    if (typeof G.last === "number" && ft - G.last > (GD.window || 3) + 1e-9) return 0;
    const frac = G.meter / (GD.breakAt || 40), D = GD.dents || [1 / 3, 2 / 3];
    return frac >= D[1] - 1e-9 ? 2 : frac >= D[0] - 1e-9 ? 1 : 0;
  }
  Scene.prototype.drawTroll = function (ctx, F, o, f) {
    const T = root.Trolls, kind = T.KIND[f.kind] ? f.kind : "footman", N = T.KIND[kind].N;
    let a = f.face; if (a === undefined) { const k = F.k || { x: f.x + 1, y: f.y }; a = Math.atan2(k.y - f.y, k.x - f.x); }
    const facing = root.Combat && root.Combat.facingOf ? root.Combat.facingOf(a) : (Math.cos(a) >= 0 ? "right" : "left"), an = trollAnim(f, o.t, { ft: F.t || 0, blockAt: this.blocks.get(f.id), brokeAt: this.breaks.get(f.id) });
    const glow = o.still ? 0 : (kind === "firestaff" ? Math.floor(o.t * 4) & 1 : kind === "emberback" ? Math.floor(o.t * 2) & 1 : 0);
    const dent = dentOf(f, F.t || 0);   // (design pass 21) the troll knight's shield dents as its guard meter fills
    const fr = T.frame(kind, facing, an.anim, an.i, glow, dent);
    this.last.set(f.id, { facing, anim: an.anim, i: an.i, dent });
    this.drawBody(ctx, F, o, f, (c, b, z) => {
      const x0 = Math.round(b.x) - N / 2, y0 = Math.round(b.y - z) - (N - 1);
      if (b.spawn > 0) c.globalAlpha = 0.5;
      c.drawImage(b.flash > 0 ? fr.white() : fr.canvas(), x0, y0);
      c.globalAlpha = 1;
      const A = b.act, tel = A && A.tel ? A.tel.kind : null;
      if (A && A.phase === "wind" && fr.tip && (tel === "glint" || !tel || (tel === "draw" && A.kind === "bolt"))) { const atk = A.atk || {}, bright = A.T ? A.t >= A.T - (atk.glintBright || 0.15) : false; drawAt(c, TG.glint(bright ? 1 : 0), x0 + fr.tip[0], y0 + fr.tip[1]); }
      if (o.statuses) o.statuses(b, c);
    });
  };
  // the dying: the stone death (four steps of ramp swap over 0.4 s, then a crumble of pebbles), a drowning's splash and bubbles; each is
  // stepped once a frame and drawn among the actors at its own depth
  Scene.prototype.stepDying = function (dt) { for (const d of this.dying) d.t += dt; this.dying = this.dying.filter(d => d.t < (d.why === "DROWNED" ? 1.6 : 0.9)); };
  Scene.prototype.drawDyingOne = function (ctx, o, d) {
    const T = root.Trolls;
    if (d.why === "DROWNED") { if (d.t < 0.6) drawAt(ctx, T.splash(Math.floor(d.t / 0.15)), d.x, d.y); else drawAt(ctx, MK.bubbles(Math.floor(d.t * 6)), d.x, d.y - 2); return; }
    const kind = T.KIND[d.kind] ? d.kind : "footman", N = T.KIND[kind].N, fr = T.frame(kind, d.facing, d.anim === "walk" || d.anim === "run" ? "idle" : d.anim, d.i, 0, d.dent | 0), x0 = Math.round(d.x) - N / 2, y0 = Math.round(d.y - d.z) - (N - 1);
    if (o.still) { if (d.t < 0.3) ctx.drawImage(fr.stone(4), x0, y0); return; }
    if (d.t < 0.4) { ctx.drawImage(fr.stone(1 + Math.min(3, Math.floor(d.t * 10))), x0, y0); return; }
    const q = (d.t - 0.4) / 0.5, n = o.few ? 4 : 6 + (d.id % 5); for (let i = 0; i < n; i++) { const a = i / n * TAU + d.id, r = 6 + (i % 3) * 4; drawAt(ctx, MK.pebble(i), d.x + Math.cos(a) * r * q * 1.5, d.y - d.z - 8 + Math.sin(a) * r * q * 0.6 + q * q * 14); }
  };
  Scene.prototype.drawDying = function (ctx, F, o, dt) { this.stepDying(dt); for (const d of this.dying) this.drawDyingOne(ctx, o, d); };
  // the bodies on a platform (by y) and under the deck, drawn inside the platform's group; a climber after the ladder
  Scene.prototype.drawOn = function (ctx, F, o, plat) { const on = this.bodiesOf(F).filter(b => b.on === plat && !b.climbing).sort((a, b) => a.y - b.y); for (const b of on) this.drawOne(ctx, F, o, b); };
  Scene.prototype.drawUnder = function (ctx, F, o, su) { const [x0, y0, x1, y1] = su.rect; const under = this.bodiesOf(F).filter(b => !b.on && !b.climbing && !(b.z > 0) && b.x >= x0 - 4 && b.x <= x1 + 4 && b.y >= y0 - 2 && b.y <= y1 + 2).sort((a, b) => a.y - b.y); for (const b of under) this.drawOne(ctx, F, o, b); };
  Scene.prototype.drawClimber = function (ctx, F, o, ladder) { for (const b of this.bodiesOf(F)) if (b.climbing && b.climbing.ladder.id === ladder) this.drawOne(ctx, F, o, b); };
  Scene.prototype.bodiesOf = function (F) { const out = []; for (const k of F.knights) if (!k.out) out.push(k); for (const f of F.foes || []) if (!f.dead) out.push(f); for (const m of F.minions || []) if (m.body) out.push(m); return out; };
  Scene.prototype.drawOne = function (ctx, F, o, b) {
    if (b.foe) this.drawTroll(ctx, F, o, b);
    else if (b.knight) this.drawBody(ctx, F, o, b, (c, k, z) => { c.save(); c.translate(0, -Math.round(z)); o.knight(k, c); c.restore(); });
    else this.drawBody(ctx, F, o, b, (c, m, z) => { c.save(); c.translate(0, -Math.round(z)); o.minion(m, c); c.restore(); });
  };
  // in a platform's group: the marks and rings that lie on it, right after its surface
  Scene.prototype.drawLifted = function (ctx, plat, o) { for (const L of this.lifted) if (L.plat === plat) drawAt(ctx, L.s, L.x, L.y - L.z); for (const r of (o && o.rings) || this.rings || []) if (r.plat === plat) drawAt(ctx, r.s, r.x, r.y - r.z); };
  // ---- the live marks on the floor, the shadows of what flies, the telegraph rings and lines, the cover that lies flat, the moat's shimmer
  Scene.prototype.drawFloor = function (ctx, F, o) {
    const M = o.marks || F.marks || {}, t = o.t, still = o.still, v = this.view, inV = (x, y, r) => x + r >= v.x0 - 8 && x - r <= v.x0 + this.vw + 8 && y + r >= v.y0 - 8 && y - r <= v.y0 + this.vh + 8;
    let n = 0;
    // a ring or a live mark on a platform drawn as a group (the roof, the tower's deck) or as an actor (the stair, the landing) is kept
    // for that platform's own pass (drawLifted), after its surface; on the lowered drawbridge (drawn here, first) it is drawn at once, lifted
    const rings = this.rings = o.rings = [];
    const place = (s, x, y, z, plat) => { if (z > 0 && plat && !this.flatPlats.has(plat)) { rings.push({ s, x, y, z, plat }); return; } drawAt(ctx, s, x, y - z); n++; };
    // the cover that lies flat: the felled tower's poles (cut wire, broken stakes and staves are stamped)
    for (const c of F.world.cover || []) if (c.kind === "poles" && inV(c.x0, c.y0, 48)) { blit(ctx, SPR.poles(c.x1 - c.x0, c.y1 - c.y0), c.x0 - 1, c.y0 - 1); n++; }
    // the moat's shimmer, clipped to the water in view (before the deck, so the planks lie over the water)
    const MO = this.A.moat;
    if (MO && !still && v.x0 + this.vw > MO.u[0] + 64) {
      const u0 = MO.u[0] + 3, u1 = MO.u[1], y0 = Math.max(FLOOR_TOP, v.y0), y1 = Math.min(LIP, v.y0 + this.vh), f = Math.floor(t * 4) & 3;
      ctx.save(); ctx.beginPath(); ctx.moveTo(u0 + y0, y0); ctx.lineTo(u1 + y0, y0); ctx.lineTo(u1 + y1, y1); ctx.lineTo(u0 + y1, y1); ctx.closePath(); ctx.clip();
      const sh = MK.shimmer(f), xs = Math.max(v.x0, u0 + y0), xe = Math.min(v.x0 + this.vw, u1 + y1);
      for (let x = Math.floor(xs / 48) * 48; x < xe; x += 48) for (let y = Math.floor(y0 / 48) * 48; y < y1; y += 48) { blit(ctx, sh, x, y); n++; }
      ctx.restore();
    }
    // the falling bridge's shadow across the water and the bank (section 3.4), under the bridge itself (drawn with the gate's actor)
    const B = this.A.bridge, BS = B && B.u && this.A.castle ? this.bridgeState(F, o) : null;
    if (BS && BS.falling) { const s = SPR.bridgeShadow(BS.frame, B.u[0], B.u[1], B.v[0], B.v[1]); if (inV(s.x0, s.y0, 100)) { blit(ctx, s, s.x0, s.y0); n++; } }
    // the drawbridge's deck, down, with the stamps that lie on it
    const P = F.world.platBy && F.world.platBy.bridgeDeck;
    if (P && P.active) { const s = SPR.bridgeDeck(P.u0, P.u1, P.v0, P.v1); if (inV(s.x0, s.y0, 90)) { blit(ctx, s, s.x0, s.y0); n++; for (const su of this.flatPlats) this.drawLifted(ctx, su, { rings: [] }); } }
    // the knights' own patches (fire and frost), and the trolls' and the world's marks that play (a level's art may have its own look for
    // one where it lies: the yard's darker ice, design pass 21)
    const fade = o.patchFade || 0.5, art = this.art && this.art.liveLook ? this.art : null, A0 = this.A;
    const live = (kind, r, f, level, x, y) => (art && art.liveLook(kind, r, f, level, x, y, A0)) || MK.live(kind, r, f, level);
    for (const p of F.patches || []) if (inV(p.x, p.y, p.r)) { const left = p.life - p.t, level = left < fade ? Math.floor(left / fade * 4) : 3; place(live(p.kind === "fire" ? "fire" : "frost", p.r, still ? 0 : Math.floor(t * 8 + (p.id || 0)) & 3, level, p.x, p.y), p.x, p.y, p.z || 0, p.on); }
    for (const m of M.fire || []) if (inV(m.x, m.y, m.r)) { const left = m.life - m.t, level = left < 1 ? Math.floor(left * 4) : 3; place(live("fire", m.r, still ? 0 : Math.floor(t * 8 + m.id) & 3, level, m.x, m.y), m.x, m.y, m.z || 0, m.on); }
    for (const m of M.ice || []) if (inV(m.x, m.y, m.r)) { const left = m.life - m.t, r = left < 2 ? Math.max(2, m.r * left / 2) : m.r; place(live("ice", r, still ? 0 : Math.floor(t * 6 + m.id) & 3, 3, m.x, m.y), m.x, m.y, m.z || 0, m.on); }
    for (const m of M.puddle || []) if (inV(m.x, m.y, m.r)) { const left = m.life - m.t, level = left < 4 ? Math.floor(left) : 3; place(live("puddle", m.r, still ? 0 : Math.floor(t * 2 + m.id) & 1, level, m.x, m.y), m.x, m.y, m.z || 0, m.on); }
    for (const m of M.ember || []) if (inV(m.x, m.y, 8)) place(live("ember", 6, 0, Math.min(3, Math.floor((m.t || 0) / 1.5)), m.x, m.y), m.x, m.y, m.z || 0, m.on);
    // what flies: the shadow where a chunk or a stone will land, growing; the stone's ring, filling over its last 0.5 s (its hit circle)
    const T = root.Trolls;
    for (const c of M.chunk || []) if (inV(c.x, c.y, 6)) { const q = clamp(c.t / (c.life || 0.7), 0, 1); drawAt(ctx, T.shadow(1 + Math.round(q * 2)), c.x, c.y - (c.z || 0)); n++; }
    for (const s of M.stone || []) if (inV(s.x, s.y, 20)) { const q = clamp(s.t / (s.life || 2), 0, 1), left = (s.life || 2) - s.t; drawAt(ctx, T.shadow(3 + Math.round(q * 7)), s.x, s.y - (s.z || 0)); place(TG.ring(s.r || 16, left < 0.5 ? 3 : Math.min(2, Math.floor(q * 3))), s.x, s.y, s.z || 0, s.on); n++; }
    // the stuck arrows on a piece's face (those in the ground are stamped)
    for (const a of M.stuck || []) if (a.piece && inV(a.x, a.y, 4)) { drawAt(ctx, MK.stamp("stuck", 0, a.id % 3), a.x, a.y - (a.z || 0)); n++; }
    // the trolls' telegraphs, from each troll's act (f.act: { kind, phase, t, T, tel: { kind: glint | draw | ring | strip, ... }, aim, locked, ring }):
    // a ring on the surface it will hit, filling as the wind goes; the dotted aim line from the troll to its aim once the draw has locked;
    // the charge's strip along its path (the glint is drawn on the troll, at its weapon's tip)
    // a ring grows over its wind (tel.grow s: the rock slam's to r 30, the roar's pulse to r 56) and fills as the wind goes; the slam's solid
    // inner ring (tel.inner, its core) marks where the ground will open; the aim line runs from the troll's chest to the aim (the target's
    // chest, as the rules set it) exactly; the charge's strip along its path, from the brute's feet
    for (const f of F.foes || []) { const A = f.act; if (!A || A.phase !== "wind") continue;
      const tel = A.tel || {}, q = tel.grow ? clamp((A.t || 0) / tel.grow, 0, 1) : 1, fill = Math.min(3, Math.floor((A.t || 0) / Math.max(0.1, A.T || 0.9) * 4));
      if (A.ring && inV(A.ring.x, A.ring.y, A.ring.r)) { place(TG.ring(Math.max(3, A.ring.r * q), tel.pulse ? (still ? 0 : Math.floor(t * 6) & 1) : fill), A.ring.x, A.ring.y, A.ring.z || 0, f.on); if (tel.inner) place(TG.ring(tel.inner, 0, true), A.ring.x, A.ring.y, A.ring.z || 0, f.on); }   // (the roar's ring pulses between its first two steps)
      if (tel.kind === "draw" && A.locked && A.aim) { const x0 = f.x, y0 = f.y - (f.z || 0) - (f.chest || 0), x1 = A.aim.x, y1 = A.aim.y - (A.aim.z || 0); if (inV(x0, y0, Math.hypot(x1 - x0, y1 - y0))) { drawAt(ctx, TG.lineTo(x1 - x0, y1 - y0), x0, y0); n++; } }
      if (tel.kind === "strip") { const len = Math.hypot(tel.x1 - tel.x0, tel.y1 - tel.y0); if (inV(tel.x0, tel.y0, len)) { drawAt(ctx, TG.stripTo(tel.x1 - tel.x0, tel.y1 - tel.y0, tel.w), tel.x0, tel.y0 - (f.z || 0)); n++; } }
    }
    // the Emberback's death flare: its ring grows and fills over its 0.5 s from the windUp event (no troll stands behind it), then the fire
    this.flares = this.flares.filter(fl => F.t - fl.t0 < fl.T);
    for (const fl of this.flares) if (inV(fl.x, fl.y, fl.r)) { const q = clamp((F.t - fl.t0) / fl.T, 0, 1); place(TG.ring(Math.max(3, fl.r * q), Math.min(3, Math.floor(q * 4))), fl.x, fl.y, fl.z, fl.on); }
    return n;
  };
  // ---- the actors, every frame: the pieces in view, the bodies, the chunks and stones in flight, the stamps lifted on a platform
  Scene.prototype.draw = function (ctx, F, o) {
    const v = this.view, x0 = v.x0 - 48, x1 = v.x0 + this.vw + 48, y0 = v.y0 - 160, y1 = v.y0 + this.vh + 48, acts = [];
    const art = this.art, chip = (kind, i, x, y) => (art && art.chipLook && art.chipLook(kind, i, x, y, this.A)) || null;   // (a level's art: the halls' grey chips)
    if (art) { this.fight = F; if (!this.clock) this.clock = { t: o.t, still: o.still }; }
    const push = (y, z, draw) => acts.push({ y, z, draw });
    for (const p of this.pieces) if (p.bx1 >= x0 && p.bx0 <= x1 && p.by1 >= y0 && p.by0 <= y1) push(p.y, p.z, p.draw);
    const W = F.world, inV = (x, y, r) => x + r >= x0 && x - r <= x1 && y + r >= y0 && y - r <= y1;
    // the breakable pieces by their state: huts and tents whole, torn, sagging, burning, then a ruin; the solids a fight adds (clods, a dead
    // brute's stone and boulder, a dropped rock, a hut's ruin) by their kind
    for (const p of W.pieces || []) {
      if ((p.kind !== "hut" && p.kind !== "tent") || !inV(p.x, p.y, 20)) continue;
      const op = (this.A.outposts || []).find(op => op.id === p.outpost) || { r: p.r, ht: p.ht };
      push(p.y, 0, (c, F2, o2) => { if (p.gone) return; const q = p.hp / (p.hpMax || 1), dmg = q <= 0.25 ? 3 : q <= 0.5 ? 2 : q <= 0.75 ? 1 : 0; drawAt(c, longShadow(op.r || p.r), p.x, p.y); drawAt(c, p.kind === "tent" ? SPR.tent(op.r || 13, op.ht || p.ht || 20, dmg) : SPR.hut(op.r || 14, op.ht || p.ht || 24, dmg), p.x, p.y); if (dmg === 3 && !o2.still) drawAt(c, SPR.cookfire(Math.floor(o2.t * 8) & 3), p.x, p.y - (op.ht || 20) + 6); });
    }
    // (the rock lying in the crater through a slam's recover is drawn until the brute's lift takes it up again, in the lift's second half)
    const lifted = new Set(); for (const f of F.foes || []) if (f.rockLying && f.act && f.act.phase === "recover" && f.act.lift && (f.act.t || 0) >= (f.act.T || 0) - f.act.lift / 2) lifted.add(f.rockLying);
    for (const s of W.solids || []) {
      if (s.gone || !inV(s.x || s.x0, s.y || s.y0, 16)) continue;
      if (s.kind === "hutRuin") push(s.y, 0, c => drawAt(c, SPR.hutRuin(), s.x, s.y));
      else if (s.kind === "clod") push(s.y, 0, c => drawAt(c, chip("clod", s.id | 0, s.x, s.y) || SPR.clod(), s.x, s.y));
      else if (s.kind === "bruteStone") push(s.y, 0, c => { drawAt(c, longShadow(10), s.x, s.y); drawAt(c, SPR.bruteStone(s.id), s.x, s.y); });
      else if (s.kind === "boulder" && s.r <= 10 && !(this.A.rocks || []).some(r => r.x === s.x && r.y === s.y)) push(s.y, 0, c => drawAt(c, SPR.rock(10), s.x, s.y));   // (a level with no rocks of its own: the Great Hall's rock brute's boulder)
      else if (s.kind === "droppedRock" || (s.kind === "rockLying" && !lifted.has(s))) push(s.y, 0, c => drawAt(c, root.Trolls.rock(), s.x, s.y));
    }
    // the Last Army's Ram where it lies, by its own box and its own foot (design pass 18: it was a piece of the map, built once with its
    // starting box, so put down anywhere far from there it was culled from the frame while its body and its prompt stayed)
    const RM = W.ram === null || W.ram === undefined ? null : W.solids[W.ram];
    if (RM && !RM.gone && RM.x1 >= x0 && RM.x0 <= x1 && RM.y1 >= y0 && RM.y0 - 16 <= y1) push(RM.y1, 0, c => drawAt(c, SPR.ram(), RM.x0, RM.y1));
    // the bodies not in a platform's group (the roof's, the tower deck's) and not on the castle's wall: on the ground, in a hole, in the air,
    // on the stair, the landing or the lowered drawbridge, each by its feet and lifted by its height
    for (const b of this.bodiesOf(F)) { if (b.climbing || (b.on && this.grouped.has(b.on))) continue; if (b.foe && this.onWall(b)) continue; if (this.underDeck(F, b)) continue; if (!inV(b.x, b.y - (b.z || 0), 32)) continue; push(b.y, b.z || 0, c => this.drawOne(c, F, o, b)); }
    // the chest (its lid on the fight's clock); the chunks and stones in flight (their shadows are on the floor already); the dying, by depth
    // (a level's chest may stand on a surface, the hall's on the dais: drawn at that surface's height, design pass 21)
    const CH = F.chest; if (CH && CH.shown && inV(CH.x, CH.y, 10)) { const cz = art ? this.chestZ(F, CH) : 0; push(CH.y, cz, c => drawAt(c, SPR.chest(CH.openAt !== undefined && CH.openAt !== null ? Math.min(3, Math.floor((F.t - CH.openAt) / 0.15)) : 0), CH.x, CH.y - cz)); }
    // the pouches (section 3.11.2; the director's fight.pouches [{ id, seat, item, x, y, z, on, t, fly }]): every seat's, each by its feet,
    // lifted by its z like a body; one lying on a grouped platform (the roof, the tower's deck) is drawn in that platform's own pass
    // (drawPouches), a flying one where its flight has it this step
    for (const q of F.pouches || []) { if (q.on && !q.fly && this.grouped.has(q.on)) continue; if (!inV(q.x, q.y - (q.z || 0), 8)) continue; push(q.y, q.z || 0, c => this.drawPouch(c, q, o)); }
    this.stepDying(o.dt || 0);
    for (const d of this.dying) if (inV(d.x, d.y - d.z, 32)) push(d.y, d.z, c => this.drawDyingOne(c, o, d));
    const M = o.marks || F.marks || {}, T = root.Trolls;
    for (const ch of M.chunk || []) { const q = clamp(ch.t / (ch.life || 0.7), 0, 1), fx = ch.x0 === undefined ? ch.x : ch.x0 + (ch.x - ch.x0) * q, fy = ch.y0 === undefined ? ch.y : ch.y0 + (ch.y - ch.y0) * q, z = (ch.z || 0) + 28 * Math.sin(Math.PI * q); if (inV(fx, fy, 8)) push(fy, z, c => drawAt(c, chip(ch.clod ? "clod" : ch.splinter ? "splinter" : "dirt", Math.floor(o.t * 8), fx, fy) || T.chunk(ch.clod ? "clod" : "dirt", Math.floor(o.t * 8)), fx, fy - z)); }
    for (const s of M.stone || []) { const q = clamp(s.t / (s.life || 2), 0, 1), fx = s.x0 === undefined ? s.x : s.x0 + (s.x - s.x0) * q, fy = s.y0 === undefined ? s.y : s.y0 + (s.y - s.y0) * q, z = (s.z || 0) + (s.peak || 60) * Math.sin(Math.PI * q) + (s.z0 || 40) * (1 - q); if (inV(fx, fy, 8)) push(fy, z, c => drawAt(c, T.projectile("stone", 0, Math.floor(o.t * 6)), fx, fy - z)); }
    // the foe shots: arrows with their ground shadows, the fire bolt tumbling, the stone
    for (const p of F.foeShots || []) { if (p.done || !inV(p.fx, p.fy, 8)) continue; const pr = T.projectile(p.kind, p.a, Math.floor(o.t * 8)); push(p.fy, p.fz || 0, c => { if (pr.shadow && p.fz > 2) drawAt(c, pr.shadow, p.fx, p.fy); drawAt(c, pr, p.fx, p.fy - (p.fz || 0)); }); }
    acts.sort((a, b) => a.y - b.y || b.z - a.z);
    for (const a of acts) a.draw(ctx, F, o);
    // a level's weather (design pass 21: the yard's snow), after the actors, in view coordinates
    if (art && art.weather) { ctx.save(); ctx.translate(v.x0, v.y0); art.weather(ctx, v.x0, v.y0, o.t, o.still, this, F); ctx.restore(); }
    return acts.length;
  };
  // the height of the surface the chest stands on (the area's chest.on, the hall's dais), 0 on the ground
  Scene.prototype.chestZ = function (F, CH) {
    const on = (this.A.chest || {}).on, P = on && F.world && F.world.platBy ? F.world.platBy[on] : null, PH = root.Physics;
    if (!P || !P.active || !PH || !PH.platZ) return 0;
    return P.shape === "r" && CH.x >= P.x0 && CH.x <= P.x1 && CH.y >= P.y0 && CH.y <= P.y1 ? PH.platZ(P, CH.x, CH.y) : 0;
  };
  // ---- the health bars (design pass 18 section 3.7), after the field's actors, in world coordinates: over a troll once hit (the wall
  // archers too; a green tip while it regrows), a hut, tent, the watchtower or a trebuchet once hit, the gate through Break the gate, and a
  // hurt knight that is not the player's (green). Every bar a baked sprite drawn once
  Scene.prototype.drawBars = function (ctx, F, o) {
    const v = this.view, inV = (x, y) => x >= v.x0 - 24 && x <= v.x0 + this.vw + 24 && y >= v.y0 - 24 && y <= v.y0 + this.vh + 24;
    let n = 0;
    const bar = (x, y, w, q, kind, tip) => { const f = q > 0 ? Math.max(1, Math.round((w - 2) * Math.min(1, q))) : 0; drawAt(ctx, SPR.bar(w, f, kind, tip), x, y); n++; };
    for (const f of F.foes || []) {
      if (f.dead || f.spawn > 0 || !(f.hp < f.hpMax - 1e-9)) continue;
      const big = !!BRUTES[f.kind], y = Math.round(f.y - (f.z || 0) - (f.h || 24) - (big ? 6 : 5));
      if (inV(f.x, y)) bar(Math.round(f.x), y, big ? 18 : f.kind === "wolf" ? 8 : 12, f.hp / f.hpMax, "red", root.Combat && root.Combat.foeRegrowing ? root.Combat.foeRegrowing(F, f) : f.regrowT > 1e-9);   // (a wolf's bar 8 px, design pass 21)
    }
    for (const p of F.pieces || []) {
      if (p.broken || p.gone || !(p.hp < p.hpMax - 1e-9) || !PIECE_BARS[p.kind]) continue;
      const y = Math.round(p.y - (p.ht || 24) - PIECE_BARS[p.kind]);
      if (inV(p.x, y)) bar(Math.round(p.x), y, 20, p.hp / p.hpMax, "red");
    }
    // the gate's, over the portcullis's lower half with the guide's arrow under it (the arch's top is under the top row when the camera is low)
    const G0 = F.gate || {}, gp = (F.pieces || []).find(p => p.kind === "gate");
    if (gp && gp.active && !gp.broken && G0.down && G0.burst === null && gp.hpMax > 0) { const y = Math.round(gp.y - 36); if (inV(gp.x, y)) bar(Math.round(gp.x), y, 40, gp.hp / gp.hpMax, "red"); }
    for (const k of F.knights) if (k !== F.k && !k.out && !k.down && !(k.rise > 0) && k.hp < k.hpMax - 1e-9) { const y = Math.round(k.y - (k.z || 0) - 30); if (inV(k.x, y)) bar(Math.round(k.x), y, 12, k.hp / k.hpMax, "green"); }
    return n;
  };
  const PIECE_BARS = { hut: 8, tent: 8, engine: 8, tower: 22 };   // how far over its height a piece's bar stands
  // ---- the guide (design pass 18; Level.guide says what): the yellow arrows in world coordinates, after everything on the field, bobbing
  // 3 px on four frames (still under reduced motion); then, in view coordinates, the yellow chevrons at the edge and GO at the right edge,
  // blinking 0.6 s on and 0.25 s off (steady under reduced motion)
  const BOB = [0, 1, 3, 1];
  Scene.prototype.drawGuide = function (ctx, g, o) { if (!g) return 0; const b = o.still ? 0 : BOB[Math.floor(o.t * 4) & 3]; for (const a of g.arrows) drawAt(ctx, SPR.arrow(), a.x, a.y - b); return g.arrows.length; };
  Scene.prototype.drawGuideView = function (ctx, g, o) {
    if (!g) return 0; let n = 0;
    for (const m of g.edges) { drawAt(ctx, guideMark(m.dir), m.x, m.y); n++; }
    if (g.go && (o.still || (o.t % 0.85) < 0.6)) { drawAt(ctx, SPR.go(), this.vw - 5, g.go.y); n++; }
    return n;
  };
  // a find on the ground (Isaac, 7 Oct 2026: every drop lit up, so it shows from across the field): an orb of light in its rarity's colours
  // (the Forge's bands: common grey, uncommon green, rare blue, epic purple, legendary orange, mythic red) round a white core, a pool of its
  // light on the ground under it, and a thread of light with three motes rising from it; eight frames a second on the drop's own clock,
  // the orb bobbing 1 px at 2 fps, everything held on its first frame under reduced motion; drawn at (x, y - z) by its foot. [the dark,
  // the base, the light and the bright of each rarity]
  const tierOf = id => { if (id === "legend-ember") return 5; const t = (root.FORGE_THINGS || []).find(q => q.id === id); return t && t.tier ? t.tier : 1; };   // (a Legend Ember, were one ever to lie on the field, legendary)
  const DROP = { 1: ["#3a4466", "#5a6988", "#8b9bb4", "#c0cbdc"], 2: ["#193c3e", "#265c42", "#3e8948", "#63c74d"], 3: ["#262b44", "#124e89", "#0099db", "#2ce8f5"],
    4: ["#3e2731", "#68386c", "#b55088", "#f6757a"], 5: ["#be4a2f", "#f77622", "#feae34", "#fee761"], 6: ["#3e2731", "#a22633", "#e43b44", "#f6757a"] };
  function dropOrb(tier, f) {
    const T = DROP[tier] || DROP[1];
    return once("drop" + tier + ":" + f, () => {
      const w = 19, h = 40, cx = 9, cy = 30, gy = 35, px = new Array(w * h).fill(null), set = (x, y, c) => { if (x >= 0 && y >= 0 && x < w && y < h) px[y * w + x] = c; };
      // the pool of light on the ground under it: an ellipse 19 x 5, dithered, its light colour at the middle, its base and dark round it
      for (let y = gy - 2; y <= gy + 2; y++) for (let x = 0; x < w; x++) { const e = ((x - cx) / 8.5) ** 2 + ((y - gy) / 2.3) ** 2; if (e <= 1 && dith(x, y, 0.95 - e * 0.55)) set(x, y, e < 0.18 ? T[2] : e < 0.5 ? T[1] : T[0]); }
      // the glow round the orb, r 3.4 to 6.4, a little fuller on the pulse's high frames
      const pulse = f % 4 < 2 ? 0.62 : 0.44;
      for (let y = cy - 7; y <= cy + 7; y++) for (let x = cx - 7; x <= cx + 7; x++) { const d = Math.hypot(x - cx, y - cy); if (d > 3.4 && d <= 6.4 && dith(x, y, pulse * (1 - (d - 3.4) / 3))) set(x, y, d < 4.8 ? T[2] : T[1]); }
      // the thread: a column of light from the orb up 26 px, thinning as it rises, its pattern climbing a pixel a frame
      for (let y = cy - 5; y >= cy - 31; y--) { const u = (cy - 5 - y) / 26; if (dith(cx, y + f, 0.97 - u * 0.85)) set(cx, y, u < 0.35 ? T[3] : u < 0.7 ? T[2] : T[1]); }
      // three motes rising and swaying beside the thread, dimming toward the top
      for (let i = 0; i < 3; i++) { const q = ((f + i * 2.67) % 8) / 8, y = Math.round(cy - 7 - q * 26), x = Math.round(cx + Math.sin((q * 2 + i * 0.7) * Math.PI) * 2.6); set(x, y, q < 0.5 ? T[3] : T[2]); }
      // the orb, 7 px across: a white core in its bright colour, rimmed in its light colour
      for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 4; x <= cx + 4; x++) { const d = Math.hypot(x - cx, y - cy); if (d <= 1.5) set(x, y, "#ffffff"); else if (d <= 2.6) set(x, y, T[3]); else if (d <= 3.5) set(x, y, T[2]); }
      return sprite(px, w, h, cx, gy);
    });
  }
  Scene.prototype.drawPouch = function (ctx, q, o) {
    const qt = q.t || 0, f = o.still ? 0 : Math.floor(qt * 8) & 7, bob = o.still ? 0 : Math.floor(qt * 2) & 1;
    drawAt(ctx, dropOrb(clamp(tierOf(q.item) | 0, 1, 6), f), q.x, q.y - (q.z || 0) - bob);
  };
  Scene.prototype.drawPouches = function (ctx, F, o, plat) { let n = 0; for (const q of F.pouches || []) if (q.on === plat && !q.fly) { this.drawPouch(ctx, q, o); n++; } return n; };
  Scene.prototype.underDeck = function (F, b) { if (b.z > 0) return false; for (const su of this.A.surfaces || []) if (su.kind === "deck" && su.rect && !su.solidUnder) { const P = F.world.platBy[su.id]; if (!P || !P.active) continue; const [x0, y0, x1, y1] = su.rect; if (b.x >= x0 - 4 && b.x <= x1 + 4 && b.y >= y0 - 2 && b.y <= y1 + 2) return true; } return false; };
  // the wall archers in the breaches, drawn with the castle front from the chest up, before the field's actors
  Scene.prototype.drawWallArchers = function (ctx, F, o) {
    const CA = this.A.castle; if (!CA || !F.foes) return 0;
    let n = 0; const T = root.Trolls;
    for (const f of F.foes) { if (f.dead || !this.onWall(f)) continue; const fr = T.frame(T.KIND[f.kind] ? f.kind : "archer", "toward", f.act && f.act.phase === "wind" ? "wind" : "idle", Math.floor(o.t * 2) & 1, 0), N = fr.N; const cut = SPR.cut(fr, 14);
      ctx.drawImage(f.flash > 0 ? fr.white() : cut.canvas(), Math.round(f.x) - N / 2, Math.round(f.y - (f.z || 0)) - (N - 1)); n++; }   // (an archer's draw has no glint, on the wall as in the field)
    return n;
  };
  // a troll standing at the castle's foot or beyond is a wall archer in its breach: drawn with the castle front, not among the field's actors
  Scene.prototype.onWall = function (f) { const CA = this.A.castle; return !!CA && f.x - f.y >= CA.foot.u - 4; };
  Scene.prototype.drawEdgeMarks = function (ctx, list) { for (const m of list) drawAt(ctx, edgeMark(m.size, m.dir, m.alarm, m.dot), m.x, m.y); return list.length; };

  root.Gate = { OUT, R, SKY, PALETTE, BAYER, TW, TH, FLOOR_TOP, LIP, hash, vnoise, dith, Grid, region, outline, rect, ell, or, line, dropOrb, DROP, paintRows: paintRows, paint, prepare, Tiles, canvasOf, sprite, sprites: SPR, longShadow, bodyShadow,
    marks: MK, telegraph: TG, dirOf, edgeMark, edgeMarks, guideMark, Scene, trollAnim, dentOf, drawAt, blit, bridgeSwing };
  if (typeof module !== "undefined" && module.exports) module.exports = root.Gate;
})(typeof window !== "undefined" ? window : globalThis);
