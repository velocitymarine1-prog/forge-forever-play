// FORGE FOREVER: the pixel renderer (design pass 2, The Forge).
// Draws any Thing as a 32 x 32 pixel sprite from its record alone: a weapon from its grammar sentence
// (base x material x element x attachments x size), an ingredient from its id or its hints. Nothing is a
// stored image, so anything the forge can say, the game can draw. The look follows the references Isaac
// gave on 27 September 2026: diagonal blades, a 1 px dark outline, four-tone ramps lit from the top left,
// element-infused edges (spine keeps the metal, the edge takes the element), a soft drop shadow.
// Palette: ENDESGA 32 (Lospec) plus a few stone and leather tones. Plain script, defines window.PixelForge.
// Since build 2 (card t65, design pass 7 as revised by card t64) it also draws a weapon in the hand: four poses, one per facing
// (right, left, away, toward), made only from the weapon's held drawing and that drawing's mirror, so nothing is turned, resampled
// or upside down. The held drawing is the icon, except that the axe's bit leads and the spellbook is 70 % of its shelf size. The bow
// keeps an upright drawing (the flat frame) turned by quarter turns. Every pose names a grip (the pixel that sits on the hand) and
// a tip (where a shot, a shell or a stream leaves). spriteFor and the shelf icons are unchanged.
// Since build 13 (card t74, design pass 20: the melee combos) it also draws the weapon in a swing: swingFor(thing, dir, lead, frame), in
// one of eight directions on a 48 x 48 grid. The shapes are the held drawing's shapes turned by a symmetry of the pixel grid (nothing is
// resampled) and drawn in place, so the light still comes from the top left and the edge, the axe's bit and the scythe's blade face
// the way the swing turns. The icon, the held drawing and the four hold poses are unchanged pixel for pixel.
(function (root) {
  "use strict";
  // pass 20: N is the grid a drawing is made on: 32 for every icon and hold, 48 while a swing is drawn (withGrid)
  let N = 32;
  const OUT = "#181425", SHADOW = "rgba(10,6,18,0.5)";

  const RAMP = {
    steel: ["#3a4466", "#5a6988", "#8b9bb4", "#c0cbdc"],
    iron: ["#262b44", "#3a4466", "#5a6988", "#8b9bb4"],
    bronze: ["#733e39", "#b86f50", "#d77643", "#e4a672"],
    gold: ["#be4a2f", "#f77622", "#feae34", "#fee761"],
    bone: ["#c28569", "#e8b796", "#ead4aa", "#fffaf0"],
    wood: ["#3e2731", "#733e39", "#b86f50", "#e4a672"],
    obsidian: ["#231b33", "#2f2a45", "#4a3f66", "#b55088"],
    crystal: ["#124e89", "#0099db", "#2ce8f5", "#ffffff"],
    coral: ["#a22633", "#e43b44", "#f6757a", "#e8b796"],
    "ice-glass": ["#0099db", "#2ce8f5", "#b8f4ff", "#ffffff"],
    brass: ["#733e39", "#d77643", "#e4a672", "#ead4aa"],
    stone: ["#4a4450", "#6e6a70", "#9a948c", "#c4bcae"],
    silver: ["#5a6988", "#8b9bb4", "#c0cbdc", "#ffffff"],
    leather: ["#2a1d28", "#3e2731", "#733e39", "#b86f50"],
    red: ["#a22633", "#e43b44", "#f6757a", "#ffd0c8"],
    green: ["#265c42", "#3e8948", "#63c74d", "#b4e67a"],
    glass: ["#262b44", "#3a4466", "#5a6988", "#c0cbdc"],
    parchment: ["#c28569", "#e4a672", "#ead4aa", "#fffaf0"],
    pink: ["#b55088", "#e43b44", "#f6757a", "#ffc0c8"],
    ember: ["#3e2731", "#a22633", "#f77622", "#fee761"]
  };
  const ELEM = {
    fire: ["#a22633", "#e43b44", "#f77622", "#fee761"],
    ice: ["#0099db", "#2ce8f5", "#b8f4ff", "#ffffff"],
    lightning: ["#d77643", "#feae34", "#fee761", "#ffffff"],
    poison: ["#193c3e", "#3e8948", "#63c74d", "#d6f264"],
    holy: ["#d77643", "#feae34", "#fee761", "#fffaf0"],
    void: ["#231b33", "#3e2753", "#68386c", "#b55088"],
    nature: ["#193c3e", "#265c42", "#3e8948", "#63c74d"],
    arcane: ["#68386c", "#b55088", "#f6757a", "#ffe0f0"],
    water: ["#262b44", "#124e89", "#0099db", "#2ce8f5"],
    earth: ["#3e2731", "#733e39", "#b86f50", "#e4a672"],
    wind: ["#3a6a6a", "#6fb0a8", "#bfe8e0", "#ffffff"]
  };
  const FXKIND = { fire: "rise", holy: "twinkle", void: "rise", arcane: "twinkle", ice: "twinkle", lightning: "zap",
    poison: "fall", water: "fall", nature: "drift", wind: "drift", earth: "dust" };

  // ------------------------------------------------------------------ small tools
  function fnv(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function pickW(r, items) { let s = 0; for (const [, w] of items) s += w; let x = r() * s; for (const [k, w] of items) { x -= w; if (x <= 0) return k; } return items[0][0]; }

  // pass 20: a sprite keeps the size of the grid it was made on (n: 32, or 48 for a swing)
  function Sprite() { this.n = N; this.px = new Array(N * N).fill(null); }
  Sprite.prototype.get = function (x, y) { const n = this.n; return x >= 0 && y >= 0 && x < n && y < n ? this.px[y * n + x] : null; };
  Sprite.prototype.set = function (x, y, c) { const n = this.n; if (x >= 0 && y >= 0 && x < n && y < n) this.px[y * n + x] = c; };
  Sprite.prototype.setIfEmpty = function (x, y, c) { if (!this.get(x, y)) this.set(x, y, c); };
  // a sprite that only takes pixels inside a clip predicate: the two halves of a fused legend are each drawn through one
  function ClipSprite(clip) { Sprite.call(this); this.clip = clip; }
  ClipSprite.prototype = Object.create(Sprite.prototype);
  ClipSprite.prototype.set = function (x, y, c) { if (!this.clip || this.clip(x, y)) Sprite.prototype.set.call(this, x, y, c); };

  function maskSet(fn) { const s = new Set(); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (fn(x, y)) s.add(y * N + x); return s; }
  function paint(sp, set, shade) {
    const m = (x, y) => x >= 0 && y >= 0 && x < N && y < N && set.has(y * N + x);
    for (const i of set) { const x = i % N, y = (i / N) | 0; const c = shade(x, y, m); if (c) sp.set(x, y, c); }
  }
  // light from the top left: the up/left rim is light, the down/right rim dark, a spec where the shape asks
  function auto(ramp, spec, glow) {
    return (x, y, m) => {
      const ul = !m(x - 1, y) || !m(x, y - 1), dr = !m(x + 1, y) || !m(x, y + 1);
      if (spec && spec(x, y)) return ramp[3];
      if (ul && dr) return ramp[1];
      if (dr) return ramp[0];
      if (ul) return glow ? glow[2] : ramp[2];
      return ramp[1];
    };
  }
  const flat = c => () => c;
  const disc = (cx, cy, r) => (x, y) => (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r + 0.25;
  const ell = (cx, cy, rx, ry) => (x, y) => ((x - cx) * (x - cx)) / (rx * rx) + ((y - cy) * (y - cy)) / (ry * ry) <= 1.02;
  const rect = (x0, y0, x1, y1) => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  function poly(pts) {
    return (x, y) => { let inside = false; const px = x + 0.5, py = y + 0.5;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside; }
      return inside; };
  }
  const or = (...fs) => (x, y) => fs.some(f => f(x, y));
  const and = (...fs) => (x, y) => fs.every(f => f(x, y));
  const not = f => (x, y) => !f(x, y);
  function stroke(pt, rad, steps) {
    const s = new Set(); steps = steps || 60;
    for (let i = 0; i <= steps; i++) { const t = i / steps, [cx, cy] = pt(t), r = rad(t);
      for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++)
        if (x >= 0 && y >= 0 && x < N && y < N && (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r + 0.2) s.add(y * N + x); }
    return s;
  }
  function touchesEdge(sp) {
    for (let i = 0; i < N; i++) if (sp.get(i, 0) || sp.get(i, N - 1) || sp.get(0, i) || sp.get(N - 1, i)) return true;
    return false;
  }
  function outline(sp) {
    const add = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!sp.get(x, y) && (sp.get(x - 1, y) || sp.get(x + 1, y) || sp.get(x, y - 1) || sp.get(x, y + 1))) add.push([x, y]);
    for (const [x, y] of add) sp.set(x, y, OUT);
  }
  // a tiny pixel sprite: rows of characters; 0-3 = ramp levels, 4-7 = second ramp, k = ink, w = white, . = empty
  function stamp(sp, rows, cx, cy, ramp, ramp2) {
    const h = rows.length, w = rows[0].length, x0 = Math.round(cx - (w - 1) / 2), y0 = Math.round(cy - (h - 1) / 2);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const ch = rows[j][i]; if (ch === ".") continue;
      const c = ch === "k" ? OUT : ch === "w" ? "#ffffff" : ch <= "3" ? ramp[+ch] : (ramp2 || ramp)[+ch - 4]; sp.set(x0 + i, y0 + j, c); }
  }

  // ------------------------------------------------------------------ the diagonal frame: a = along the weapon, b = across
  // pass 20: xf (a name of XF) turns the frame by a symmetry of the grid: the same shapes, turned on the pixels, nothing resampled. A
  // swing's flat frame is 1.4 px a unit (the bow's stays 1.25), so a weapon is as long pointing east as it is on the diagonal (its
  // units are 1.41 px there). lit is -1 when the turn puts the +b side toward the top-left light: the blade's and the haft's ramps
  // follow it, so a turned weapon is lit from the top left like the icon (auto() is lit on the screen already). n is +b on the screen
  function frameFor(L, flat, xf) {
    let F;
    if (flat) { const u = xf ? 1.4 : 1.25, ox = Math.floor((N - L * u) / 2), cy = (N - 1) / 2;
      F = { L, ox, oy: cy, flat: true, ab: (x, y) => [(x - ox) / u, (y - cy) / u], xy: (a, b) => [ox + a * u, cy + b * u] }; }
    else { const ox = Math.floor((N - L) / 2), oy = ox + L;
      F = { L, ox, oy, ab: (x, y) => [((x - ox) - (y - oy)) / 2, ((x - ox) + (y - oy)) / 2], xy: (a, b) => [ox + a + b, oy - a + b] }; }
    F.lit = 1; F.n = flat ? [0, 1] : [1, 1];
    if (!xf || xf === "id") { F.xf = xf || null; return F; }
    const T = XF[xf], Ti = XF[XINV[xf]], o = T(0, 0), t1 = T(F.n[0], F.n[1]), n = [t1[0] - o[0], t1[1] - o[1]], toLight = -n[0] - n[1];
    return { L, ox: F.ox, oy: F.oy, flat: F.flat, xf, n, lit: toLight > 0 || (toLight === 0 && n[1] < 0) ? -1 : 1,
      ab: (x, y) => { const p = Ti(x, y); return F.ab(p[0], p[1]); }, xy: (a, b) => { const p = F.xy(a, b); return T(p[0], p[1]); } };
  }
  function haft(c, a0, a1, ramp, o) {
    o = o || {}; const F = c.F, h = o.h || 0.5, off = o.c || (() => 0);
    const s = maskSet((x, y) => { const [a, b] = F.ab(x, y); return a >= a0 && a <= a1 && Math.abs(b - off(a)) <= h + 0.01; });
    paint(c.sp, s, (x, y) => { const [a, b] = F.ab(x, y), u = (b - off(a)) / h * (F.lit || 1); let l = u < -0.3 ? 2 : u > 0.3 ? 0 : 1;
      if (o.wrap && Math.floor(a * 2) % 3 === 0) l = Math.max(0, l - 1);
      if (o.bands && o.bands.some(q => Math.abs(a - q) < 0.6)) return (o.bandRamp || c.trim)[Math.min(3, l + 1)];
      return ramp[l]; });
  }
  function blade(c, a0, a1, o) {
    const F = c.F, cf = o.c || (() => 0), tl = o.taper || 3, mat = o.ramp || c.mat, el = o.el === undefined ? c.el : o.el;
    const wf = a => { const t = (a - a0) / Math.max(1, a1 - a0); let w = typeof o.w === "function" ? o.w(t) : o.w; if (a1 - a < tl) w *= Math.max(0, (a1 - a) / tl); return w; };
    const s = maskSet((x, y) => { const [a, b] = F.ab(x, y); if (a < a0 || a > a1) return false;
      const cc = cf((a - a0) / Math.max(1, a1 - a0)), w = wf(a); let hi = cc + w; if (o.jag && Math.floor(a) % 2 === 0 && a < a1 - 2) hi += 1;
      return b >= cc - w - 0.01 && b <= hi + 0.01; });
    paint(c.sp, s, (x, y) => { const [a, b] = F.ab(x, y), t = (a - a0) / Math.max(1, a1 - a0), cc = cf(t), w = Math.max(wf(a), 0.5), u = (b - cc) / w * (F.lit || 1);
      if (!el) { if (u < -0.55) return mat[2]; if (u <= 0.05) return mat[3]; if (u <= 0.55) return mat[1]; return mat[0]; }
      if (u > 0.25) return u > 0.65 ? mat[0] : mat[1];
      const lvl = Math.min(3, Math.floor(t * 3) + (u < -0.5 ? 1 : 0));
      return el[Math.max(0, lvl)]; });
  }
  function discAt(c, a, b, r, ramp, glowSpec) {
    const [cx, cy] = c.F.xy(a, b), s = maskSet(disc(cx, cy, r));
    paint(c.sp, s, auto(ramp, glowSpec ? (x, y) => x === Math.round(cx - r / 2) && y === Math.round(cy - r / 2) : null));
    return [cx, cy];
  }
  function region(c, pred, ramp, o) {
    o = o || {}; const F = c.F; const s = maskSet((x, y) => { const [a, b] = F.ab(x, y); return pred(a, b, x, y); });
    paint(c.sp, s, auto(ramp, o.spec ? (x, y) => { const [a, b] = F.ab(x, y); return o.spec(a, b, x, y); } : null, o.glow)); return s;
  }
  function pommel(c, a, r) { discAt(c, a, 0, r || 1.3, c.trim); }
  function guard(c, a, w) {
    const st = c.style.guard, ramp = c.guardRamp;
    region(c, (aa, b) => { const d = Math.abs(b) / w;
      if (Math.abs(b) > w + 0.01) return false;
      if (st === "winged") return aa >= a - 0.6 && aa <= a + 0.6 + d * 1.6;
      if (st === "curled") return (aa >= a - 0.6 && aa <= a + 0.6) || (d > 0.7 && aa >= a && aa <= a + 1.6);
      if (st === "disc") return (aa - a) * (aa - a) / 1.2 + b * b / (w * w) <= 1;
      return aa >= a - 0.6 && aa <= a + 0.6; }, ramp);
  }

  // ------------------------------------------------------------------ the bases (one drawing per grammar base word)
  const BLADES = {
    straight: { w: 2 }, broad: { w: 2.6 }, needle: { w: 1.5 },
    leaf: { w: t => 1.6 + 1.1 * Math.sin(Math.PI * Math.min(1, t * 1.1)) },
    curved: { w: 2, c: t => -2.6 * t * t }, jagged: { w: 2, jag: true },
    flamberge: { w: 1.9, c: t => 0.9 * Math.sin(t * 10) }
  };
  const BASES = {
    sword(c) { const L = c.L; pommel(c, 0.4, 1.4); haft(c, 1, 4.8, c.grip, { wrap: 1 }); guard(c, 5.4, 4.2); blade(c, 6.2, L, BLADES[c.style.blade]);
      c.anchors = { pommel: [0.4, 0], guard: [5.4, 0], mid: [(6.2 + L) / 2, 0], head: [L * 0.8, 0] }; },
    dagger(c) { const L = c.L; pommel(c, 0.4, 1.2); haft(c, 1, 3.8, c.grip, { wrap: 1 }); guard(c, 4.3, 3.2); blade(c, 5, L, Object.assign({}, BLADES[c.style.blade], { taper: 2.5 }));
      c.anchors = { pommel: [0.4, 0], guard: [4.3, 0], mid: [(5 + L) / 2, 0], head: [L * 0.8, 0] }; },
    axe(c) { const L = c.L, ac = L - 3.2, R = 6.4, dbl = c.style.double, bit = c.held ? 1 : -1;   // in the hand the bit leads (+b)
      haft(c, 0, L - 0.5, RAMP.wood, { h: 0.6, bands: [2.2], bandRamp: c.grip });
      const inHead = (a, b, side) => { const d = side * b; if (d < -0.6 || d > R) return false; const half = 1.3 + d * 0.42, edge = R - 0.12 * (a - ac) * (a - ac); return Math.abs(a - ac) <= half && d <= edge; };
      region(c, (a, b) => inHead(a, b, bit) || (dbl ? inHead(a, b, -bit) : (bit * b <= 0 && bit * b >= -1.8 && Math.abs(a - ac) <= 1.2)), c.mat,
        { spec: (a, b) => { const d = Math.abs(b), edge = R - 0.12 * (a - ac) * (a - ac); return d >= edge - 1 && (bit * b > 0 || dbl); }, glow: c.el });
      c.anchors = { pommel: [0.5, 0], guard: [ac - 3.5, 0], mid: [L * 0.5, 0], head: [ac, 2.5 * bit] }; },
    hammer(c) { const L = c.L, h0 = L - 8, h1 = L - 0.8;
      haft(c, 0, h0, RAMP.wood, { h: 0.6, bands: [1.5, 3], bandRamp: c.grip });
      region(c, (a, b) => a >= h0 && a <= h1 && Math.abs(b) <= 5, c.mat, { glow: c.el });
      region(c, (a, b) => a >= h0 && a <= h1 && Math.abs(b) > 3.8 && Math.abs(b) <= 5, c.el || c.trim);
      if (c.style.spike) region(c, (a, b) => a > h1 && a <= h1 + 2 && Math.abs(b) <= (h1 + 2 - a) * 0.7, c.trim);
      c.anchors = { pommel: [0.5, 0], guard: [h0 - 1.5, 0], mid: [L * 0.45, 0], head: [(h0 + h1) / 2, 0] }; },
    spear(c) { const L = c.L; haft(c, 0, L - 4.6, RAMP.wood); region(c, (a, b) => a >= L - 5.4 && a <= L - 4.4 && Math.abs(b) <= 1, c.trim);
      blade(c, L - 6, L, { w: t => 2.8 * Math.min(1, 0.6 + t * 2), taper: 3.8, ramp: c.mat === RAMP.wood ? RAMP.steel : c.mat });
      c.anchors = { pommel: [0.5, 0], guard: [L - 5, 0], mid: [L * 0.5, 0], head: [L - 2.5, 0] }; },
    staff(c) { const L = c.L; haft(c, 0, L - 3.5, RAMP.wood, { h: 0.6, bands: [L * 0.35], bandRamp: c.trim });
      for (const s of [-1, 1]) region(c, (a, b) => a >= L - 5.5 && a <= L - 1.5 && Math.abs(b - s * (1.6 + 0.3 * Math.sin((a - L + 5.5) * 1.2))) <= 0.5, c.trim);
      const g = c.el || RAMP.crystal; discAt(c, L - 2.6, 0, 2.3, g, true);
      c.anchors = { pommel: [0.5, 0], guard: [L - 6, 0], mid: [L * 0.5, 0], head: [L - 2.6, 0], gem: true }; },
    wand(c) { const L = c.L; haft(c, 0, L - 2.4, RAMP.wood, { bands: [1.5], bandRamp: c.trim }); const g = c.el || RAMP.crystal; discAt(c, L - 1.6, 0, 1.7, g, true);
      c.anchors = { pommel: [0.5, 0], guard: [L - 4.5, 0], mid: [L * 0.5, 0], head: [L - 1.6, 0], gem: true }; },
    whip(c) { const L = c.L; pommel(c, 0.4, 1.1); haft(c, 1, 6, c.grip, { wrap: 1 });
      const F = c.F, s = stroke(t => F.xy(6 + t * (L - 6), 2.2 * Math.sin(t * 7.5)), t => 0.75 - t * 0.3, 90); paint(c.sp, s, auto(c.mat, null, c.el));
      c.anchors = { pommel: [0.4, 0], guard: [6, 0], mid: [L * 0.6, 0], head: [L - 2, 0] }; },
    flail(c) { const L = c.L; haft(c, 0, 8.5, RAMP.wood, { h: 0.6, bands: [1.2, 8], bandRamp: c.trim });
      for (let a = 9.6; a < L - 6; a += 1.4) { const [x, y] = c.F.xy(a, 0); c.sp.set(Math.round(x), Math.round(y), (Math.round(a * 10) % 2) ? RAMP.iron[2] : RAMP.iron[1]); }
      const [cx, cy] = c.F.xy(L - 3.5, 0); for (const [dx, dy] of [[0, -5], [5, 0], [0, 5], [-5, 0], [4, -4], [4, 4], [-4, 4], [-4, -4]]) c.sp.set(Math.round(cx + dx), Math.round(cy + dy), c.trim[1]);
      paint(c.sp, maskSet(disc(cx, cy, 4)), auto(c.mat, (x, y) => x === Math.round(cx - 1) && y === Math.round(cy - 1), c.el));
      c.anchors = { pommel: [0.4, 0], guard: [8.5, 0], mid: [L * 0.45, 0], head: [L - 3.5, 0] }; },
    scythe(c) { const L = c.L; haft(c, 0, L, RAMP.wood, { bands: [3, L * 0.55], bandRamp: c.grip });
      const F = c.F, s = stroke(t => F.xy(L - 1.5 - 4.5 * t * t, 1 + 10 * t), t => 2.3 * (1 - t) + 0.5, 80);
      paint(c.sp, s, (x, y, m) => { const ul = !m(x - 1, y) || !m(x, y - 1), dr = !m(x + 1, y) || !m(x, y + 1); const e = c.el || c.mat;
        return dr && !ul ? e === c.mat ? c.mat[3] : e[2] : ul && !dr ? c.mat[0] : c.mat[1]; });
      c.anchors = { pommel: [0.5, 0], guard: [L * 0.55, 0], mid: [L * 0.4, 0], head: [L - 4, 5] }; },
    lance(c) { const L = c.L; haft(c, 0, 5, c.grip, { wrap: 1, h: 0.6 }); region(c, (a, b) => a >= 5 && a <= 6.4 && Math.abs(b) <= 3.6, c.trim);
      const a0 = 6.4; region(c, (a, b) => a >= a0 && a <= L && Math.abs(b) <= 2.6 * (1 - (a - a0) / (L - a0)) + 0.3, c.mat,
        { spec: (a, b) => Math.floor(a) % 4 === 0 && b < 0.5, glow: c.el });
      c.anchors = { pommel: [0.5, 0], guard: [5.7, 0], mid: [L * 0.55, 0], head: [L - 4, 0] }; },
    claw(c) { const L = c.L; region(c, (a, b) => a >= 2 && a <= 8.5 && Math.abs(b) <= 3.2, RAMP.leather);
      region(c, (a, b) => a >= 7.5 && a <= 9 && Math.abs(b) <= 3.4, c.trim);
      for (const o of [-2.2, 0, 2.2]) blade(c, 9, L - Math.abs(o) * 0.8, { w: 1.1, c: t => o - 1.4 * t * t, taper: 4.5 });
      c.anchors = { pommel: [2.5, 0], guard: [8.2, 0], mid: [L * 0.6, 0], head: [L - 3, 0] }; },
    bow(c) { const L = c.L, F = c.F, a0 = 0.5, a1 = L - 0.5, k = 5.4;
      paint(c.sp, stroke(t => F.xy(a0 + t * (a1 - a0), 0), () => 0.3, 60), flat("#ead4aa"));
      paint(c.sp, stroke(t => F.xy(a0 + t * (a1 - a0), -k * Math.sin(Math.PI * t)), t => 0.75 + 0.35 * Math.sin(Math.PI * t), 90), auto(c.mat, null, c.el));
      region(c, (a, b) => Math.abs(a - L / 2) <= 1.2 && b <= -k + 1.2 && b >= -k - 1.2, c.grip);
      for (const t of [0, 1]) { const [x, y] = F.xy(a0 + t * (a1 - a0), 0); c.sp.set(Math.round(x), Math.round(y), c.trim[2]); }
      c.anchors = { pommel: [L / 2, -k], guard: [L / 2 - 2.5, -k + 1], mid: [L * 0.72, -k * 0.8], head: [L * 0.8, -k * 0.6] }; },
    crossbow(c) { const L = c.L, F = c.F, pa = L - 7;
      haft(c, 0, L - 2, RAMP.wood, { h: 1, bands: [L - 3], bandRamp: c.trim });
      paint(c.sp, stroke(t => F.xy(pa - 2.8 - 0.1, (t * 2 - 1) * 7.2), () => 0.3, 50), flat("#ead4aa"));
      paint(c.sp, stroke(t => { const u = t * 2 - 1; return F.xy(pa - 2.2 * u * u + 0.6, u * 7.6); }, () => 0.8, 70), auto(c.mat, null, c.el));
      region(c, (a, b) => a >= 3 && a <= 5 && b >= 1 && b <= 2.6, c.grip);
      c.anchors = { pommel: [0.8, 0], guard: [4, 0], mid: [L * 0.45, 0], head: [pa, -4] }; },
    cannon(c) { const L = c.L, a0 = 5;
      region(c, (a, b) => a >= a0 && a <= L - 1 && Math.abs(b) <= 2.8, c.mat, { glow: c.el });
      region(c, (a, b) => ((a >= L - 1.8 && a <= L) || Math.abs(a - (a0 + 3)) < 0.7 || Math.abs(a - (L - 5)) < 0.7) && Math.abs(b) <= 3.5, c.trim);
      discAt(c, a0 - 1.2, 0, 1.6, c.trim);
      const [wx, wy] = c.F.xy(a0 + 4, 4.2); paint(c.sp, maskSet(and(disc(wx, wy, 3.8), not(disc(wx, wy, 2.4)))), auto(RAMP.wood)); c.sp.set(Math.round(wx), Math.round(wy), c.trim[2]);
      c.anchors = { pommel: [a0 - 1.2, 0], guard: [a0 + 3, 0], mid: [L * 0.6, 0], head: [L - 3, 0] }; },
    orb(c) { const g = c.el || RAMP.crystal;
      paint(c.sp, maskSet(or(poly([[9, 30], [23, 30], [20, 25], [12, 25]]), rect(14, 21, 17, 25))), auto(c.mat));
      for (const [x0, s] of [[9, 1], [22, -1]]) paint(c.sp, stroke(t => [x0 + s * (t * 3), 24 - t * 7], () => 0.6, 20), auto(c.trim));
      paint(c.sp, maskSet(disc(15.5, 13.5, 8.2)), auto(g, (x, y) => (x === 12 && y === 9) || (x === 11 && y === 10) || (x === 12 && y === 10)));
      c.anchors = { pommel: [0, 0], guard: [0, 0], mid: [0, 0], head: [0, 0] }; c.upright = { pommel: [15.5, 27], guard: [15.5, 22], mid: [15.5, 13.5], head: [15.5, 13.5] }; },
    shield(c) { const body = (x, y) => { if (y < 4 || y > 29 || x < 5 || x > 26) return false; const cx = 15.5, hw = y <= 15 ? 10.5 : 10.5 * (1 - Math.pow((y - 15) / 14.5, 1.5)); return Math.abs(x - cx) <= hw; };
      const s = maskSet(body); paint(c.sp, s, auto(c.trim));
      const inner = maskSet((x, y) => body(x, y) && body(x - 1, y) && body(x + 1, y) && body(x, y - 1) && body(x, y + 1) && body(x - 1, y - 1) && body(x + 1, y + 1));
      paint(c.sp, inner, (x, y, m) => { const band = c.el && Math.abs((x - 15.5) + (y - 16) * -0.9) <= 2.2; const r = band ? c.el : c.mat;
        const ul = !m(x - 1, y) || !m(x, y - 1), dr = !m(x + 1, y) || !m(x, y + 1); return dr ? r[0] : ul ? r[2] : r[1]; });
      paint(c.sp, maskSet(disc(15.5, 14.5, 2.4)), auto(c.trim, (x, y) => x === 14 && y === 13));
      c.upright = { pommel: [15.5, 26], guard: [15.5, 14.5], mid: [15.5, 20], head: [15.5, 8] }; },
    book(c) {
      if (c.held) {   // the book in the hand, 70 % of the shelf book (an 11 x 17 cover, a 2 px spine, the page edge, the caps, the medallion)
        paint(c.sp, maskSet(rect(11, 8, 22, 23)), (x, y) => x >= 21 ? (y % 2 ? "#ead4aa" : "#e4a672") : null);
        paint(c.sp, maskSet(rect(10, 7, 20, 23)), auto(c.mat === RAMP.steel ? RAMP.leather : c.mat));
        paint(c.sp, maskSet(rect(10, 7, 11, 23)), auto(RAMP.leather));
        for (const [x, y] of [[18, 8], [19, 8], [19, 9], [18, 22], [19, 22], [19, 21]]) c.sp.set(x, y, c.trim[2]);
        paint(c.sp, maskSet(disc(15.5, 15.5, 1.9)), auto(c.el || c.trim, (x, y) => x === 15 && y === 14));
        c.upright = { pommel: [15, 22], guard: [10, 15], mid: [15.5, 15.5], head: [15.5, 11] }; return; }
      paint(c.sp, maskSet(rect(8, 5, 24, 27)), (x, y) => x >= 23 ? (y % 2 ? "#ead4aa" : "#e4a672") : null);
      paint(c.sp, maskSet(rect(7, 4, 22, 27)), auto(c.mat === RAMP.steel ? RAMP.leather : c.mat));
      paint(c.sp, maskSet(rect(7, 4, 9, 27)), auto(RAMP.leather));
      for (const [x, y] of [[20, 5], [21, 5], [21, 6], [20, 26], [21, 26], [21, 25]]) c.sp.set(x, y, c.trim[2]);
      paint(c.sp, maskSet(disc(15.5, 15.5, 3.2)), auto(c.el || c.trim, (x, y) => x === 14 && y === 14));
      c.upright = { pommel: [15, 26], guard: [8, 15], mid: [15.5, 15.5], head: [15.5, 9] }; },
    lantern(c) { const g = c.el || ELEM.holy;
      paint(c.sp, stroke(t => [15.5 + 4 * Math.cos(Math.PI * (1 + t)), 6 + 3.5 * Math.sin(Math.PI * (1 + t))], () => 0.5, 30), flat(c.trim[1]));
      paint(c.sp, maskSet(poly([[10, 10], [22, 10], [20, 7], [12, 7]])), auto(c.trim));
      paint(c.sp, maskSet(rect(11, 10, 20, 23)), auto(g, (x, y) => x === 13 && (y === 12 || y === 13)));
      paint(c.sp, maskSet(or(rect(10, 10, 10, 23), rect(21, 10, 21, 23), rect(15, 10, 16, 11), rect(15, 22, 16, 23))), flat(c.mat[1]));
      paint(c.sp, maskSet(poly([[9, 24], [23, 24], [21, 28], [11, 28]])), auto(c.trim));
      c.upright = { pommel: [15.5, 27], guard: [15.5, 9], mid: [15.5, 16], head: [15.5, 4] }; },
    horn(c) { const F = c.F, L = c.L, a0 = 1, a1 = L - 1;
      const pt = t => F.xy(a0 + t * (a1 - a0), -3.4 * Math.sin(Math.PI * t * 0.9));
      paint(c.sp, stroke(pt, t => 0.5 + 3.1 * Math.pow(t, 1.6), 90), (x, y, m) => { const [a] = F.ab(x, y), t = (a - a0) / (a1 - a0);
        const band = [0.35, 0.62, 0.86].some(q => Math.abs(t - q) < 0.035); const r = band ? c.trim : RAMP.bone;
        const ul = !m(x - 1, y) || !m(x, y - 1), dr = !m(x + 1, y) || !m(x, y + 1); return dr ? r[0] : ul ? r[2] : r[1]; });
      const [mx, my] = pt(1); paint(c.sp, maskSet(disc(mx, my, 1.8)), flat(c.el ? c.el[1] : "#3e2731"));
      c.anchors = { pommel: [a0, 0], guard: [L * 0.35, -3], mid: [L * 0.55, -3], head: [L * 0.8, -2] }; }
  };
  const LENGTH = { S: 20, M: 24, L: 27 };
  const LEN_SCALE = { dagger: 0.78, wand: 0.85, claw: 0.85, cannon: 0.95, horn: 0.9, hammer: 0.9, axe: 0.9, scythe: 0.92, staff: 0.95 };

  function styleFor(base, w, id, isBase) {
    const r = rng(fnv("style:" + id));
    const el = w.element || "physical";
    const bladeW = [["straight", 4], ["broad", 2], ["leaf", 2], ["curved", 2], ["jagged", 1], ["flamberge", 1], ["needle", 1]];
    const favour = { fire: "flamberge", lightning: "jagged", void: "curved", nature: "leaf", ice: "broad", arcane: "needle", poison: "curved", earth: "broad" }[el];
    if (favour) bladeW.push([favour, 5]);
    const style = {
      blade: isBase ? (base === "dagger" ? "leaf" : "straight") : pickW(r, bladeW),
      guard: isBase ? "bar" : pickW(r, [["bar", 3], ["winged", 2], ["curled", 2], ["disc", 1]]),
      trim: isBase ? null : pickW(r, [["gold", 3], ["bronze", 2], ["iron", 2], ["brass", 1], ["silver", 1]]),
      double: !isBase && r() < 0.35, spike: !isBase && r() < 0.5,
      grip: pickW(r, [["leather", 3], ["wood", 1]])
    };
    return style;
  }

  // ------------------------------------------------------------------ attachments (drawn after the base, before the outline)
  function attach(c, name) {
    const at = key => { if (c.upright) return c.upright[key]; const [a, b] = c.anchors[key]; return c.F.xy(a, b); };
    const sp = c.sp, el = c.el;
    switch (name) {
      case "canister": { const [x, y] = at("guard"); stamp(sp, [".44.", "0120", "0w20", "0120", "0120", "0010"], x + 4, y + 2, RAMP.red, RAMP.steel); c.canister = [x + 4, y + 2]; break; }
      case "hose": { const [x0, y0] = c.canister || at("guard"), [x1, y1] = at("mid"); const s = stroke(t => [x0 + (x1 - x0) * t + 3 * Math.sin(Math.PI * t), y0 - 3 + (y1 - y0 + 3) * t + 2 * Math.sin(Math.PI * t)], () => 0.45, 40);
        paint(sp, s, (x, y) => ((x + y) % 3 ? "#3a4466" : "#e43b44")); break; }
      case "chain": { let [x, y] = at("guard"); x = Math.round(x); y = Math.round(y); while (y < N - 8 && sp.get(x + 1, y + 2)) y++; for (let i = 2; i <= 7; i++) sp.setIfEmpty(Math.round(x + 1 + i * 0.35), Math.round(y) + i, i % 2 ? RAMP.iron[3] : RAMP.iron[1]); break; }
      case "gem": { if (c.anchors && c.anchors.gem) break; const [x, y] = at("guard"); stamp(sp, [".1.", "132", ".0."], x, y, el || RAMP.crystal); break; }
      case "skull": { const [x, y] = at("pommel"); stamp(sp, [".222.", "23332", "2k2k2", ".121.", ".1.1."], x - 1, y + 1, RAMP.bone); break; }
      case "rune": { const [x, y] = at("mid"); const g = el || ELEM.arcane; stamp(sp, ["3.3", ".3.", "3.3"], x, y, g); break; }
      case "feathers": { const [x, y] = at("pommel"); const f = el ? [el[1], el[2], el[3], "#ffffff"] : RAMP.bone;
        stamp(sp, ["..23", ".232", "232.", "32.."], x - 3, y + 1, f); stamp(sp, ["23", "32"], x - 1, y + 3, f); break; }
      case "leaves": { const [x, y] = at("guard"); stamp(sp, [".2.", "213", ".1."], x - 2, y + 1, RAMP.green); stamp(sp, ["23", "12"], x + 2, y - 2, RAMP.green); break; }
      case "gears": { const [x, y] = at("guard"); stamp(sp, [".2.2.", "22222", ".2k2.", "21111", ".1.1."], x - 3, y - 3, RAMP.brass); break; }
      case "eye": { const [x, y] = at(c.anchors && c.anchors.gem ? "mid" : "guard"); stamp(sp, [".www.", "w6k6w", ".www."], x, y, RAMP.bone, el || RAMP.red); break; }
      case "wings": { const [x, y] = at("guard"); const f = RAMP.bone; stamp(sp, ["3...", "23..", "123.", ".12."], x - 3, y - 2, f); stamp(sp, ["...3", "..32", ".321", ".21."], x + 3, y + 1, f); break; }
      case "bell": { const [x, y] = at("guard"); stamp(sp, [".3.", "232", "121", "111", ".0."], x + 1, y + 4, RAMP.gold); break; }
      case "tusk": { const [x, y] = at("guard"); stamp(sp, ["...3", "..32", ".32.", "21..", "1..."], x + 2, y - 2, RAMP.bone); break; }
      case "thorns": { const [x0, y0] = at("guard"), [x1, y1] = at("head"); for (let i = 1; i < 5; i++) { const t = i / 5; const tx = Math.round(x0 + (x1 - x0) * t), ty = Math.round(y0 + (y1 - y0) * t); let k = 1; while (k < 14 && sp.get(tx + k, ty + k)) k++; sp.setIfEmpty(tx + k, ty + k, RAMP.green[i % 2 ? 1 : 2]); } break; }
      case "coil": { const [x, y] = at("guard"); stamp(sp, ["3.3.3", "23232", ".2.2."], x - 1, y + 2, RAMP.bronze); break; }
      case "crown": { const [x, y] = at("pommel"); stamp(sp, ["3.3.3", "23232", "12221"], x - 1, y + 2, RAMP.gold); break; }
      case "flame-guard": { const [x, y] = at("guard"); const f = ELEM.fire; stamp(sp, ["3...3", "23.32", ".2.2."], x - 2, y + 2, f); stamp(sp, ["3.", "23"], x + 3, y - 3, f); break; }
    }
  }

  // ------------------------------------------------------------------ element effects (after the outline, only on empty pixels; four frames)
  // pass 20: F, a swing's turned frame: the motes rise from the head's half, wherever the weapon points
  function fx(sp, name, ramp, seed, f, upright, skip, flat, F) {
    const pts = [], inHead = F ? (x, y) => F.ab(x, y)[0] > F.L * 0.45 : (x, y) => (upright ? y < 18 : flat ? x > 13 : x - y > 2);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const p = sp.get(x, y); if (p && p !== OUT && inHead(x, y)) pts.push([x, y]); }
    if (!pts.length) return;
    const P = i => pts[(i * 97 + seed) % pts.length];
    const kind = FXKIND[name] || "twinkle";
    const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < N && y < N && !sp.get(x, y) && !(skip && skip(x, y))) sp.set(x, y, c); };
    for (let i = 0; i < 5; i++) { const [x, y] = P(i), ph = (i + f) % 4;
      if (kind === "rise") { put(x + ((i % 3) - 1), y - 2 - ph, ramp[3 - (ph >> 1)]); if (ph === 0) put(x + ((i % 3) - 1), y - 3, ramp[2]); }
      else if (kind === "fall") { put(x + (i % 2), y + 2 + ph, ramp[2]); put(x + (i % 2), y + 3 + ph, ramp[1]); }
      else if (kind === "drift") { put(x - 3 - ph, y + (i % 2) - 1, ramp[2]); if (i % 2) put(x - 4 - ph, y + (i % 2) - 1, ramp[3]); }
      else if (kind === "dust") { put(x + 1, y + 3 + (ph >> 1), ramp[1]); put(x + 2, y + 3 + (ph >> 1), ramp[2]); }
      else if (kind === "zap") { if ((i + f) % 2 === 0) { put(x + 2, y - 2, ramp[3]); put(x + 3, y - 3, ramp[2]); put(x + 2, y - 4, ramp[3]); } }
      else { if ((i + f) % 3 === 0) { const cx = x + ((i * 5) % 5) - 2, cy = y - 3; put(cx, cy, ramp[3]); put(cx - 1, cy, ramp[2]); put(cx + 1, cy, ramp[2]); put(cx, cy - 1, ramp[2]); put(cx, cy + 1, ramp[2]); } }
    }
  }

  // ------------------------------------------------------------------ weapons
  // pass 20: xf, a swing's turn of the grid (SWING); len, the length the held drawing settled on, so a weapon is as long in a swing as
  // in the hand. A swing has no hallmark: a seal stamped in a corner of the grid cannot follow the weapon round
  function drawWeapon(w, id, frameNo, isBase, flat, held, xf, len) {
    const v = w.visual || {}, base = BASES[v.base] ? v.base : "sword";
    if (v.fuse && BASES[v.fuse] && v.fuse !== base && (!flat || xf)) return drawFused(w, id, frameNo, held, xf ? flat : false, xf, len);   // pixel rule 10: a legend is fused and gilded
    const L = len || Math.round((LENGTH[v.size] || LENGTH.M) * (LEN_SCALE[base] || 1));
    const style = styleFor(base, w, id || base, isBase);
    if (v.shape && BLADES[v.shape]) style.blade = v.shape;  // grammar 1.2 (proposed): the Oracle may name the shape and the trim
    if (v.trim && RAMP[v.trim]) style.trim = v.trim;
    const el = w.element && w.element !== "physical" && ELEM[w.element] ? ELEM[w.element] : null;
    const mat = RAMP[v.material] || RAMP.steel;
    const trim = style.trim ? RAMP[style.trim] : (v.material === "gold" ? RAMP.bronze : RAMP.bronze);
    // draw, and if anything but ink reaches the edge of the grid, shorten the weapon a pixel and draw again
    let c;
    for (let len = L; len >= L - 8; len--) {
      c = { sp: new Sprite(), F: frameFor(len, flat && !UPRIGHT[base], xf), L: len, mat, el, trim, grip: RAMP[style.grip], style, anchors: null, upright: null, held: !!held,
        guardRamp: (v.attachments || []).includes("flame-guard") ? ELEM.fire : trim };
      BASES[base](c);
      for (const a of v.attachments || []) attach(c, a);
      if (!touchesEdge(c.sp)) break;
    }
    outline(c.sp);
    const sealed = v.graft && !flat && !xf ? hallmark(c.sp, v.graft) : false;   // pixel rule 9: a gift is stamped with the giver's mark
    if (el) fx(c.sp, w.element, el, fnv(id || base) % 997, frameNo || 0, !!c.upright, sealed ? IN_SEAL : null, flat && !c.upright, xf ? c.F : null);
    c.sp.grip = gripPoint(c, base);
    c.sp.tip = nearestPainted(c.sp, tipPoint(c, base));
    c.sp.len = c.L; c.sp.n = N;
    return c.sp;
  }

  // ------------------------------------------------------------------ the hallmark (pixel rule 9, pass 4 §3.9): a 9 x 9 iron seal at x 22-30, y 22-30
  // with the giver's class glyph in gold at x 24-28, y 24-28. Drawn after the outline; the particles keep off it.
  const SEAL = ["..kkkkk..", ".k11111k.", "k1111111k", "k1111111k", "k1111111k", "k1111111k", "k1111111k", ".k10001k.", "..kkkkk.."];
  const IN_SEAL = (x, y) => x >= 22 && x <= 30 && y >= 22 && y <= 30;
  const MARKS = {
    sword: ["..#..", "..#..", "..#..", "#####", "..#.."], dagger: [".....", "..#..", "..#..", ".###.", "..#.."],
    axe: ["#.#.#", "#####", "#.#.#", "..#..", "..#.."], hammer: ["#####", "#####", "..#..", "..#..", "..#.."],
    spear: ["..#..", ".###.", "..#..", "..#..", "..#.."], bow: ["##...", "#.#..", "#..#.", "#.#..", "##..."],
    crossbow: ["#...#", ".#.#.", "..#..", "..#..", "..#.."], staff: ["..#..", ".#.#.", "..#..", "..#..", "..#.."],
    wand: ["#.#..", ".#...", "#.#..", "...#.", "....#"], orb: [".###.", "#####", "#####", "#####", ".###."],
    shield: ["#####", "#####", "#####", ".###.", "..#.."], claw: ["#.#.#", "#.#.#", "#.#.#", ".###.", "....."],
    whip: [".###.", "#...#", "#.#.#", "#..#.", ".#..."], flail: [".#...", "###..", ".#.#.", "...#.", "...#."],
    scythe: ["####.", "...#.", "...#.", "..#..", ".#..."], lance: ["..#..", "..#..", ".###.", ".###.", "#####"],
    cannon: [".....", "#####", "####.", ".#.#.", "....."], book: [".#.#.", "#.#.#", "#.#.#", "#####", "....."],
    lantern: ["..#..", ".###.", ".#.#.", ".###.", "....."], horn: ["....#", "...##", "..##.", "###..", "##..."],
    legendary: ["..#..", ".###.", "#####", ".###.", "..#.."]
  };
  function hallmark(sp, cls) {
    const rows = MARKS[cls]; if (!rows) return false;
    stamp(sp, SEAL, 26, 26, RAMP.iron);
    const gold = RAMP.gold;
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) { if (rows[j][i] !== "#") continue;
      const ul = j === 0 || rows[j - 1][i] !== "#" || i === 0 || rows[j][i - 1] !== "#";   // lit on the top and left of each stroke
      sp.set(24 + i, 24 + j, ul ? gold[3] : gold[2]); }
    return true;
  }

  // ------------------------------------------------------------------ fused legends (pixel rule 10, pass 5 §3.6.6)
  // The body class is drawn up to the cut, the head class from it, joined by a gold collar; the trim is gold; one glint travels the
  // edge over the four frames. NECK[class](L) is where a class's head starts along its own drawing; the cut is max(neck, 0.45 L).
  // Upright classes (orb, shield, book, lantern) lend a small charm as a head, and as a body take the head rising out of their upper right.
  const NECK = {
    sword: L => 6.2, dagger: L => 5, axe: L => L - 7.5, hammer: L => L - 8, spear: L => L - 6, bow: L => L / 2,
    crossbow: L => L - 10, staff: L => L - 6, wand: L => L - 3.5, claw: L => 8.5, whip: L => 6, flail: L => 9,
    scythe: L => L - 6.5, lance: L => 6.4, cannon: L => 5, horn: L => 0.45 * L,
    orb: L => L - 8, shield: L => L - 8, book: L => L - 8, lantern: L => L - 8
  };
  const UPRIGHT = { orb: true, shield: true, book: true, lantern: true };
  const cutFor = (head, L) => Math.max(NECK[head] ? NECK[head](L) : L - 8, 0.45 * L);
  // the charms: a small version of an upright class, hung past the cut, drawn in the diagonal frame so it sits on the haft
  const CHARMS = {
    orb(c, a0) { const L = c.L, g = c.el || RAMP.crystal;
      for (const b of [-2, 0, 2]) paint(c.sp, stroke(t => c.F.xy(a0 + 0.4 + t * 3.4, b * (1 - t * 0.3)), () => 0.55, 14), auto(c.trim));
      discAt(c, L - 3.4, 0, 3.1, g, true); },
    shield(c, a0) { const L = c.L, a1 = L - 0.4, k = a0 + 4;
      const hw = (a, w) => a <= k ? w : w * (a1 - a) / (a1 - k);
      region(c, (a, b) => a >= a0 + 1 && a <= a1 && Math.abs(b) <= hw(a, 3.4), c.trim);
      region(c, (a, b) => a >= a0 + 2 && a <= a1 - 1.2 && Math.abs(b) <= hw(a, 2.3), c.mat, { glow: c.el });
      discAt(c, k - 0.5, 0, 1, c.trim);
      paint(c.sp, stroke(t => c.F.xy(a0 + t * 1.2, 0), () => 0.6, 6), auto(c.trim)); },
    book(c, a0) { const L = c.L, mid = a0 + (L - a0) / 2, leather = c.mat === RAMP.steel ? RAMP.leather : c.mat;
      region(c, (a, b) => a >= a0 + 1.2 && a <= L - 0.8 && Math.abs(b) <= 2.6, leather);
      region(c, (a, b) => a >= a0 + 1.8 && a <= L - 1.4 && b >= 1.5 && b <= 2.6, RAMP.bone);
      region(c, (a, b) => Math.abs(a - mid) <= 0.6 && Math.abs(b) <= 2.6, c.trim);
      discAt(c, mid, -0.5, 1, c.el || c.trim);
      paint(c.sp, stroke(t => c.F.xy(a0 + t * 1.4, 0), () => 0.6, 6), auto(c.trim)); },
    lantern(c, a0) { const L = c.L, g = c.el || ELEM.holy;
      paint(c.sp, stroke(t => c.F.xy(a0 + t * 1.8, 0), () => 0.5, 8), auto(c.trim));
      region(c, (a, b) => a >= a0 + 1.8 && a <= L - 1 && Math.abs(b) <= 2.4, RAMP.iron);   // an iron cage, so the glass shows
      region(c, (a, b) => a >= a0 + 2.6 && a <= L - 1.8 && Math.abs(b) <= 1.5, g, { spec: (a, b) => b < -0.5 && a < a0 + 4.5 });
      region(c, (a, b) => a >= L - 1 && a <= L - 0.2 && Math.abs(b) <= 1.6, c.trim); }
  };
  function context(len, mat, el, trim, style, guardRamp, clip, held, F) {   // pass 20: F, a swing's frame
    return { sp: clip ? new ClipSprite(clip) : new Sprite(), F: F || frameFor(len), L: len, mat, el, trim, grip: RAMP[style.grip], style, anchors: null, upright: null, guardRamp, held: !!held };
  }
  // the gold collar: a band two pixels deep across the join, one pixel wider than the weapon on each side, lit on the upper-left side
  function collar(sp, F, cut, uprightBody, headSp) {
    const gold = RAMP.gold, band = [];
    if (uprightBody) {
      let lo = Infinity, hi = -Infinity;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (headSp.get(x, y) && x - y >= 4 && x - y <= 6) { lo = Math.min(lo, x + y); hi = Math.max(hi, x + y); }
      if (lo > hi) return;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if ((x - y === 3 || x - y === 4) && x + y >= lo - 1 && x + y <= hi + 1) band.push([x, y, (x + y - (lo + hi) / 2) / Math.max(1, (hi - lo) / 2)]);
    } else {
      let bmax = 0;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (sp.get(x, y)) { const [a, b] = F.ab(x, y); if (Math.abs(a - cut) <= 0.75) bmax = Math.max(bmax, Math.abs(b)); }
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const [a, b] = F.ab(x, y); if (Math.abs(a - cut) <= 0.75 && Math.abs(b) <= bmax + 1) band.push([x, y, b / Math.max(1, bmax + 1)]); }
    }
    for (const [x, y, u] of band) sp.set(x, y, u < -0.4 ? gold[3] : u > 0.4 ? gold[1] : gold[2]);
  }
  // one gold glint that travels the lit edge, pommel to tip, over the four frames
  function glint(sp, F, frameNo, uprightBody) {
    const edge = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const p = sp.get(x, y); if (!p || p === OUT) continue;
      const up = sp.get(x, y - 1), left = sp.get(x - 1, y); if (!up || up === OUT || !left || left === OUT) edge.push([x, y]); }
    if (!edge.length) return;
    const key = uprightBody ? (p => p[0] - p[1] + (p[0] + p[1]) / 100) : (p => F.ab(p[0], p[1])[0] + F.ab(p[0], p[1])[1] / 100);
    edge.sort((p, q) => key(p) - key(q));
    const [x, y] = edge[Math.min(edge.length - 1, Math.floor(edge.length * (((frameNo || 0) % 4) + 0.5) / 4))];
    sp.set(x, y, sp.get(x, y) === RAMP.gold[3] ? "#ffffff" : RAMP.gold[3]);
  }
  // pass 20: flat, xf and len as drawWeapon's, for a legend in a swing
  function drawFused(w, id, frameNo, held, flat, xf, len0) {
    const v = w.visual || {}, body = BASES[v.base] ? v.base : "sword", head = BASES[v.fuse] ? v.fuse : "hammer";
    const L0 = len0 || Math.round((LENGTH[v.size] || LENGTH.M) * (LEN_SCALE[body] || 1));
    const style = styleFor(body, w, id || body + "*" + head, false); style.trim = "gold";
    if (v.shape && BLADES[v.shape]) style.blade = v.shape;
    const el = w.element && w.element !== "physical" && ELEM[w.element] ? ELEM[w.element] : null;
    const mat = RAMP[v.material] || RAMP.steel, trim = RAMP.gold;
    const guardRamp = (v.attachments || []).includes("flame-guard") ? ELEM.fire : trim;
    const bodyUp = !!UPRIGHT[body], headUp = !!UPRIGHT[head];
    let out;
    for (let len = L0; len >= L0 - 8; len--) {
      const F = frameFor(len, !!flat, xf), cut = cutFor(head, len);
      const cb = context(len, mat, el, trim, style, guardRamp, bodyUp ? null : (x, y) => F.ab(x, y)[0] <= cut + 0.01, held && !bodyUp, F);
      BASES[body](cb);
      const ch = context(len, mat, el, trim, style, guardRamp, headUp ? null : bodyUp ? (x, y) => x - y >= 4 : (x, y) => F.ab(x, y)[0] >= cut - 0.01, held, F);
      if (headUp) CHARMS[head](ch, cut); else BASES[head](ch);
      const sp = new Sprite();
      for (let i = 0; i < N * N; i++) sp.px[i] = ch.sp.px[i] || cb.sp.px[i];
      const ca = context(len, mat, el, trim, style, guardRamp, null, false, F); ca.anchors = cb.anchors; ca.upright = cb.upright;
      for (const a of v.attachments || []) attach(ca, a);
      for (let i = 0; i < N * N; i++) if (ca.sp.px[i]) sp.px[i] = ca.sp.px[i];
      collar(sp, F, cut, bodyUp, ch.sp);
      out = { sp, F, upright: cb.upright, L: len };
      if (!touchesEdge(sp)) break;
    }
    outline(out.sp);
    glint(out.sp, out.F, frameNo || 0, bodyUp);
    const sealed = v.graft && !xf ? hallmark(out.sp, v.graft) : false;
    if (el) fx(out.sp, w.element, el, fnv(id || body + "*" + head) % 997, frameNo || 0, bodyUp, sealed ? IN_SEAL : null, false, xf ? out.F : null);
    out.sp.grip = gripPoint({ upright: out.upright, L: out.L, F: out.F }, body);
    out.sp.tip = nearestPainted(out.sp, headUp ? (([x, y]) => [Math.round(x), Math.round(y)])(out.F.xy(out.L - 2.5, 0)) : tipPoint({ upright: null, L: out.L, F: out.F }, head));
    out.sp.len = out.L;
    return out.sp;
  }

  // ------------------------------------------------------------------ ingredients: one small drawing per kind of thing
  function flask(sp, liquid, big) {
    const r = big ? 9 : 8, cy = big ? 19 : 20;
    paint(sp, maskSet(rect(13, 3, 18, 6)), auto(RAMP.wood));
    paint(sp, maskSet(rect(14, 6, 17, 11)), auto(RAMP.glass));
    const body = maskSet(disc(15.5, cy, r)); paint(sp, body, auto(RAMP.glass));
    paint(sp, maskSet(and(disc(15.5, cy, r - 1), (x, y) => y >= cy - 2)), auto(liquid, (x, y) => y === cy - 2 && x > 11 && x < 15));
    for (const [x, y] of [[10, cy - 4], [10, cy - 3], [11, cy - 5]]) sp.set(x, y, "#c0cbdc");
  }
  function ingot(sp, ramp) {
    paint(sp, maskSet(poly([[6, 16], [26, 16], [26, 23], [6, 23]])), auto(ramp));
    paint(sp, maskSet(poly([[9, 11], [23, 11], [26, 16], [6, 16]])), (x, y, m) => (y === 11 ? ramp[3] : ramp[2]));
    for (let x = 8; x < 25; x += 5) sp.set(x, 19, ramp[0]);
  }
  function rock(sp, ramp, seed, fleck) {
    const r = rng(seed); const pts = []; for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, rr = 8 + r() * 3; pts.push([16 + Math.cos(a) * rr * 1.1, 18 + Math.sin(a) * rr * 0.8]); }
    paint(sp, maskSet(poly(pts)), auto(ramp, (x, y) => (x + y * 3) % 11 === 0 && y < 17));
    if (fleck) for (let i = 0; i < 6; i++) sp.set(10 + Math.floor(r() * 12), 13 + Math.floor(r() * 9), fleck[i % 2 ? 2 : 3]);
  }
  function shards(sp, ramp) {
    for (const [x, h, w] of [[11, 14, 3], [17, 20, 3.5], [22, 12, 2.5]]) paint(sp, maskSet(poly([[x, 28 - h], [x + w, 28 - h * 0.45], [x, 28], [x - w, 28 - h * 0.45]])), auto(ramp, (xx, y) => xx === x - 1 && y > 28 - h + 2 && y < 28 - h * 0.45));
  }
  function coilRope(sp, ramp) {
    paint(sp, maskSet(and(ell(16, 18, 11, 8), not(ell(16, 18, 5.5, 3.5)))), (x, y, m) => { const dr = !m(x + 1, y) || !m(x, y + 1), ul = !m(x - 1, y) || !m(x, y - 1); return (x + y) % 3 === 0 ? ramp[0] : dr ? ramp[0] : ul ? ramp[2] : ramp[1]; });
    paint(sp, stroke(t => [25 + t * 4, 18 + t * 6], () => 1, 20), auto(ramp));
  }
  // a fang is the tusk drawn bone-white (wolf-fang, design pass 21 section 3.12): the bone ramp's peach for its shadow, floral white
  // for its body and white on its lit rim, so it reads beside the troll tooth's yellowed tusk. A Thing tagged "fang" draws in it;
  // every other tusk keeps the bone ramp pixel for pixel
  const FANG = ["#e8b796", "#fffaf0", "#ffffff", "#ffffff"];
  const isFang = t => !!(t && Array.isArray(t.tags) && t.tags.includes("fang"));
  const ICONS = {
    flask: (sp, t, el) => flask(sp, el || ELEM.arcane),
    jar: (sp, t, el) => flask(sp, el || ELEM.fire, true),
    ingot: (sp, t, el, mat) => ingot(sp, mat || RAMP.steel),
    nugget: sp => paint(sp, maskSet(or(disc(13, 18, 5), disc(19, 16, 5), disc(17, 21, 5))), auto(RAMP.gold, (x, y) => (x === 12 && y === 15) || (x === 18 && y === 13))),
    ore: (sp, t) => rock(sp, RAMP.stone, fnv(t.id), RAMP.bronze),
    rock: (sp, t) => rock(sp, RAMP.stone, fnv(t.id)),
    coal: (sp, t) => { rock(sp, ["#181425", "#262b44", "#3a4466", "#5a6988"], fnv(t.id)); for (const [x, y] of [[13, 20], [18, 17], [20, 22]]) { sp.set(x, y, "#f77622"); sp.set(x + 1, y, "#feae34"); } },
    salt: sp => { paint(sp, maskSet(poly([[5, 26], [12, 16], [16, 13], [21, 16], [27, 26]])), auto(["#8b9bb4", "#c0cbdc", "#ffffff", "#ffffff"])); for (const [x, y] of [[12, 21], [18, 19], [22, 23]]) sp.set(x, y, "#8b9bb4"); },
    bone: sp => { paint(sp, stroke(t => [9 + t * 14, 23 - t * 14], () => 1.4, 30), auto(RAMP.bone)); for (const [x, y] of [[7, 22], [10, 25], [22, 7], [25, 10]]) paint(sp, maskSet(disc(x, y, 2.2)), auto(RAMP.bone)); },
    log: sp => { paint(sp, maskSet(rect(8, 12, 24, 22)), (x, y, m) => (y === 12 ? RAMP.wood[2] : y === 22 ? RAMP.wood[0] : (x * 7 + y * 3) % 9 === 0 ? RAMP.wood[0] : RAMP.wood[1]));
      paint(sp, maskSet(ell(24, 17, 3, 5)), (x, y) => ((x - 24) ** 2 / 4 + (y - 17) ** 2 / 9 < 0.6 ? "#b86f50" : "#e4a672")); sp.set(24, 17, "#733e39"); },
    shards: (sp, t, el, mat) => shards(sp, mat || RAMP.crystal),
    coral: sp => { for (const [x0, x1, y1] of [[16, 10, 9], [16, 16, 6], [16, 22, 10], [13, 8, 15], [19, 25, 14]]) paint(sp, stroke(t => [x0 + (x1 - x0) * t, 27 - (27 - y1) * t], () => 1.3, 30), auto(RAMP.coral)); },
    rope: sp => coilRope(sp, RAMP.brass),
    strip: sp => coilRope(sp, RAMP.leather),
    spool: sp => { paint(sp, maskSet(rect(11, 11, 21, 23)), (x, y) => ((x + y) % 2 ? "#ffffff" : "#c0cbdc")); paint(sp, maskSet(or(rect(8, 8, 24, 10), rect(8, 24, 24, 26))), auto(RAMP.wood)); },
    feather: sp => { paint(sp, maskSet(poly([[24, 5], [27, 8], [14, 22], [9, 24], [10, 19]])), auto(RAMP.bone)); paint(sp, stroke(t => [6 + t * 19, 27 - t * 20], () => 0.3, 40), flat("#8b9bb4")); },
    clod: (sp, t) => { rock(sp, ELEM.earth, fnv(t.id)); for (let x = 9; x <= 23; x++) { const y = 12 + Math.round(1.5 * Math.sin(x * 0.7)); if (sp.get(x, y + 1)) { sp.set(x, y, "#63c74d"); if (x % 3 === 0) sp.set(x, y - 1, "#3e8948"); } } },
    core: (sp, t, el) => { paint(sp, maskSet(disc(15.5, 16.5, 9)), auto(RAMP.stone, (x, y) => (x === 11 && y === 11) || (x === 12 && y === 11))); stamp(sp, ["3...3", ".323.", ".222.", ".323.", "3...3"], 15.5, 16.5, el || ELEM.earth); },
    scale: (sp, t, el) => { paint(sp, maskSet(poly([[16, 4], [26, 12], [24, 22], [16, 28], [8, 22], [6, 12]])), auto(el || ELEM.fire, (x, y) => Math.abs(x - 16) < 1 && y > 7 && y < 22));
      for (const [x, y] of [[12, 14], [20, 14], [12, 20], [20, 20]]) sp.set(x, y, (el || ELEM.fire)[0]); },
    cloth: (sp, t, el) => { paint(sp, maskSet((x, y) => x >= 7 && x <= 25 && y >= 6 && y <= 24 + ((x % 4) < 2 ? 2 : 0) - (x > 20 ? 1 : 0)), (x, y, m) => { const r = el || ELEM.void; const dr = !m(x + 1, y) || !m(x, y + 1); return dr ? r[0] : x % 5 === 0 ? r[1] : r[2]; }); },
    blob: (sp, t, el) => { paint(sp, maskSet(and(ell(16, 22, 10, 10), (x, y) => y <= 27)), auto(el || ELEM.poison, (x, y) => (x === 11 && (y === 15 || y === 16)))); sp.set(13, 20, OUT); sp.set(19, 20, OUT); },
    skull: sp => { paint(sp, maskSet(or(disc(15.5, 14, 8.5), rect(11, 18, 20, 26))), auto(RAMP.bone)); paint(sp, maskSet(or(disc(12, 16, 2), disc(19, 16, 2))), flat(OUT)); sp.set(15, 20, OUT); sp.set(16, 20, OUT); for (let x = 12; x <= 19; x += 2) sp.set(x, 24, RAMP.bone[0]); },
    branch: sp => { paint(sp, stroke(t => [6 + t * 20, 26 - t * 18], t => 1.6 - t, 40), auto(RAMP.wood)); for (const [x, y] of [[12, 14], [20, 19], [24, 8], [9, 20]]) paint(sp, maskSet(ell(x, y, 3, 2)), auto(RAMP.green)); },
    ear: sp => { paint(sp, maskSet(poly([[8, 26], [6, 16], [12, 10], [28, 3], [18, 16], [16, 26]])), auto(RAMP.green)); paint(sp, maskSet(poly([[10, 22], [10, 16], [14, 13], [22, 8], [15, 17], [13, 22]])), flat("#265c42")); },
    wing: sp => { paint(sp, maskSet(poly([[4, 8], [28, 6], [26, 14], [22, 12], [20, 20], [15, 17], [11, 26], [8, 18]])), auto(["#3e2731", "#68386c", "#b55088", "#f6757a"]));
      paint(sp, stroke(t => [4 + t * 24, 8 - t * 2], () => 0.6, 30), auto(RAMP.bone)); for (const [x, y] of [[26, 14], [20, 20], [11, 26]]) paint(sp, stroke(t => [4 + (x - 4) * t, 8 + (y - 8) * t], () => 0.35, 30), flat(RAMP.bone[1])); },
    tongue: sp => paint(sp, stroke(t => [7 + t * 18, 24 - 16 * Math.sin(t * 2.2)], t => 3 - t * 1.6, 60), auto(RAMP.pink, (x, y) => (x + y) % 7 === 0)),
    eye: (sp, t, el) => { paint(sp, maskSet(ell(16, 16, 11, 7)), auto(RAMP.bone)); paint(sp, maskSet(disc(16, 16, 4.5)), auto(el || ["#265c42", "#3e8948", "#63c74d", "#d6f264"])); paint(sp, maskSet(rect(15, 12, 16, 20)), flat(OUT)); sp.set(14, 13, "#ffffff"); for (const [x, y] of [[7, 15], [8, 18], [24, 14]]) sp.set(x, y, "#e43b44"); },
    tusk: (sp, th) => paint(sp, stroke(t => [7 + t * 18, 27 - 22 * Math.sin(t * 1.3)], t => 2.6 * (1 - t) + 0.4, 60), auto(isFang(th) ? FANG : RAMP.bone)),
    // a folded green pelt (troll-hide, design pass 12 section 3.11.4): the fur side with a ragged foot and three leg flaps, its far
    // corner folded over along the diagonal so the pale flesh side lies on the fur, a few dark tufts in the fur
    pelt: sp => {
      paint(sp, maskSet(or(and(poly([[4, 12], [18, 10], [28, 20], [28, 24], [5, 25]]), (x, y) => y < 24 || (x + y) % 3 !== 0),
        poly([[3, 14], [8, 11], [2, 8]]), poly([[5, 22], [11, 22], [7, 28]]), poly([[21, 22], [27, 22], [26, 28]]))), auto(RAMP.green, (x, y) => y === 12 && x % 5 === 2));
      for (const [x, y] of [[8, 16], [12, 20], [15, 14], [10, 23], [16, 18], [14, 22], [22, 22]]) { sp.set(x, y, RAMP.green[0]); sp.set(x + 1, y - 1, RAMP.green[0]); }
      paint(sp, maskSet(poly([[18, 10], [28, 20], [18, 20]])), auto(RAMP.bone, (x, y) => x === 19 && y === 13));
      for (let x = 17; x <= 27; x++) sp.set(x, 21, RAMP.green[0]);   // the flap's shadow on the fur
    },
    can: sp => { paint(sp, maskSet(or(rect(8, 10, 24, 28), poly([[8, 10], [12, 6], [24, 6], [24, 10]]))), auto(RAMP.red)); paint(sp, maskSet(rect(8, 16, 24, 21)), flat("#feae34")); paint(sp, maskSet(rect(18, 2, 22, 6)), auto(RAMP.steel)); paint(sp, maskSet(rect(10, 3, 15, 4)), auto(RAMP.iron)); },
    bell: sp => { paint(sp, maskSet(or(ell(16, 14, 7, 8), poly([[9, 14], [23, 14], [27, 25], [5, 25]]))), auto(RAMP.gold, (x, y) => x === 12 && y > 9 && y < 18)); paint(sp, maskSet(disc(16, 27, 2)), auto(RAMP.iron)); paint(sp, maskSet(rect(15, 4, 16, 6)), flat(RAMP.iron[1])); },
    mirror: sp => { paint(sp, maskSet(ell(16, 14, 9, 11)), auto(RAMP.gold)); paint(sp, maskSet(ell(16, 14, 6.5, 8.5)), (x, y) => ((x - y) % 6 === 0 ? "#ffffff" : x < 16 ? "#c0cbdc" : "#8b9bb4")); paint(sp, maskSet(rect(15, 25, 17, 30)), auto(RAMP.gold)); },
    hourglass: sp => { paint(sp, maskSet(or(rect(7, 3, 25, 5), rect(7, 27, 25, 29))), auto(RAMP.wood)); paint(sp, maskSet(or(poly([[9, 6], [23, 6], [17, 16], [15, 16]]), poly([[15, 16], [17, 16], [23, 26], [9, 26]]))), flat("#3a4466"));
      paint(sp, maskSet(or(poly([[12, 6], [20, 6], [16.5, 12], [15.5, 12]]), poly([[14, 22], [18, 22], [21, 26], [11, 26]]))), auto(RAMP.gold)); for (const y of [15, 17, 19]) sp.set(16, y, "#feae34"); },
    magnet: sp => { const s = stroke(t => [16 + 8 * Math.cos(Math.PI * t), 14 + 8 * Math.sin(Math.PI * t)], () => 2.6, 60); for (const x of [8, 24]) for (let y = 4; y <= 14; y++) for (let dx = -2; dx <= 2; dx++) s.add(y * N + x + dx);
      paint(sp, s, (x, y, m) => (y < 8 ? (x < 16 ? "#c0cbdc" : "#8b9bb4") : (!m(x + 1, y) || !m(x, y + 1)) ? RAMP.red[0] : RAMP.red[1])); },
    chainlinks: sp => { for (const [x, y] of [[9, 23], [16, 16], [23, 9]]) paint(sp, maskSet(and(ell(x, y, 5, 3.5), not(ell(x, y, 2.6, 1.4)))), auto(RAMP.iron)); },
    gear: sp => { const teeth = (x, y) => { const a = Math.atan2(y - 15.5, x - 15.5), r = Math.hypot(x - 15.5, y - 15.5); return r <= 8.5 || (r <= 11.2 && Math.cos(a * 8) > 0.35); };
      paint(sp, maskSet(and(teeth, not(disc(15.5, 15.5, 3)))), auto(RAMP.brass, (x, y) => x === 11 && y === 11)); },
    spring: sp => paint(sp, stroke(t => [16 + 8 * Math.cos(t * Math.PI * 9), 5 + t * 22 + 1.5 * Math.sin(t * Math.PI * 9)], () => 0.8, 200), auto(RAMP.steel)),
    lanternIcon: (sp, t, el) => { const c = { sp, mat: RAMP.iron, el: el || ELEM.holy, trim: RAMP.brass }; BASES.lantern(c); },
    hornIcon: sp => { const c = { sp, F: frameFor(24), L: 24, mat: RAMP.bone, el: null, trim: RAMP.bronze }; BASES.horn(c); }
  };
  const ICON_BY_ID = {
    fire: ["flask", "fire"], ice: ["flask", "ice"], lightning: ["flask", "lightning"], venom: ["flask", "poison"], "holy-light": ["flask", "holy"],
    shadow: ["flask", "void"], "wild-sap": ["flask", "nature"], "arcane-dust": ["flask", "arcane"], water: ["flask", "water"], earth: ["clod", "earth"],
    wind: ["flask", "wind"], blood: ["flask", "blood"],
    "steel-ingot": ["ingot", null, "steel"], "iron-ore": ["ore"], "bronze-bar": ["ingot", null, "bronze"], "gold-nugget": ["nugget"], bone: ["bone"],
    "oak-wood": ["log"], "obsidian-shard": ["shards", null, "obsidian"], "crystal-shard": ["shards", null, "crystal"], coral: ["coral"],
    "ice-glass": ["shards", null, "ice-glass"], "brass-fitting": ["ingot", null, "brass"], stone: ["rock"], silver: ["ingot", null, "silver"],
    "leather-strip": ["strip"], rope: ["rope"], "glass-shard": ["shards", null, "silver"], feather: ["feather"], silk: ["spool"], coal: ["coal"], salt: ["salt"],
    "golem-core": ["core", "earth"], "dragon-scale": ["scale", "fire"], "dragon-breath": ["jar", "fire"], "wraith-shroud": ["cloth", "void"],
    "slime-jelly": ["blob", "poison"], "skeleton-skull": ["skull"], "treant-branch": ["branch"], "goblin-ear": ["ear"], "wyvern-wing": ["wing"],
    "mimic-tongue": ["tongue"], "basilisk-eye": ["eye"], "troll-tooth": ["tusk"], "troll-hide": ["pelt"], "wolf-fang": ["tusk"],
    "gas-can": ["can"], bell: ["bell"], mirror: ["mirror"], hourglass: ["hourglass"], magnet: ["magnet"], lantern: ["lanternIcon", "holy"],
    spring: ["spring"], chain: ["chainlinks"], gear: ["gear"], "war-horn": ["hornIcon"]
  };
  const ICON_BY_PART = { canister: "can", hose: "rope", chain: "chainlinks", gem: "shards", skull: "skull", rune: "core", feathers: "feather", leaves: "branch",
    gears: "gear", eye: "eye", wings: "wing", bell: "bell", tusk: "tusk", thorns: "branch", coil: "spring", crown: "nugget", horn: "hornIcon", "flame-guard": "scale" };

  function iconFor(t) {
    if (ICON_BY_ID[t.id]) return ICON_BY_ID[t.id];
    const h = t.hints || {};
    if (h.visual_part && ICON_BY_PART[h.visual_part]) return [ICON_BY_PART[h.visual_part], h.element || null, h.material || null];
    if (h.element) return ["flask", h.element];
    if (h.material) return ["ingot", null, h.material];
    return ["flask", "arcane"];
  }
  function drawIngredient(t, frameNo) {
    const sp = new Sprite(); const [kind, elName, matName] = iconFor(t);
    const el = elName === "blood" ? RAMP.red : elName && ELEM[elName] ? ELEM[elName] : null;
    ICONS[kind](sp, t, el, matName ? RAMP[matName] : null);
    outline(sp);
    if (elName && ELEM[elName]) fx(sp, elName, ELEM[elName], fnv(t.id) % 997, frameNo || 0, true);
    return sp;
  }

  // ------------------------------------------------------------------ the weapon in the hand: grips, tips and four poses (pass 7 section 3.6)
  // the grip along the weapon (a) and across it (b), per base; upright bases give a pixel
  const GRIP = { sword: L => [2.9, 0], dagger: L => [2.4, 0], axe: L => [2.4, 0], hammer: L => [2.3, 0], spear: L => [L * 0.32, 0], staff: L => [L * 0.34, 0],
    wand: L => [1.6, 0], whip: L => [3.4, 0], flail: L => [4.2, 0], scythe: L => [3.4, 0], lance: L => [2.6, 0], claw: L => [5, 0], bow: L => [L / 2, -5.4],
    crossbow: L => [4, 1.8], cannon: L => [4.6, 1.6], horn: L => [2.2, 0] };
  const UPRIGHT_GRIP = { orb: [15, 28], shield: [12, 17], book: [9, 18], lantern: [15, 4] };
  const HELD_GRIP = { book: [10, 16] };   // the small book in the hand is held by its spine
  function gripPoint(c, base) { if (c.upright) return ((c.held && HELD_GRIP[base]) || UPRIGHT_GRIP[base] || [15, 24]).slice(); const [a, b] = (GRIP[base] || GRIP.sword)(c.L); const [x, y] = c.F.xy(a, b); return [Math.round(x), Math.round(y)]; }
  // the tip: where a shot, a shell, a stream or a spell leaves the weapon (the head's end, a gem, a muzzle, a bell; the bow: in front of its riser)
  const TIP = { staff: L => [L - 2.6, 0], wand: L => [L - 1.6, 0], bow: L => [L / 2, -6.4], horn: L => [L - 1.5, -1.1], cannon: L => [L - 0.8, 0], crossbow: L => [L - 1, 0] };
  const UPRIGHT_TIP = { orb: [15, 13], shield: [15, 12], book: [15, 15], lantern: [15, 16] };
  function tipPoint(c, base) { if (c.upright) return (UPRIGHT_TIP[base] || [15, 12]).slice(); const [a, b] = (TIP[base] || (L => [L - 0.8, 0]))(c.L); const [x, y] = c.F.xy(a, b); return [Math.round(x), Math.round(y)]; }
  // the painted pixel nearest a point (so a tip always sits on the weapon)
  function nearestPainted(sp, p) { let best = null, bd = Infinity; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const c = sp.get(x, y); if (!c || c === OUT) continue; const d = (x - p[0]) ** 2 + (y - p[1]) ** 2; if (d < bd) { bd = d; best = [x, y]; } } return best || p.slice(); }
  // the four facings: right and toward hold the held drawing, left and away its mirror; nothing points down
  const FACINGS = ["right", "left", "away", "toward"];
  const MIRRORED = { left: true, away: true };
  // lossless transforms of a 32 x 32 sprite: each maps (x, y) to a new pixel
  // (pass 20: and the two diagonal mirrors, tr across the main diagonal and atr across the other, and each one's inverse)
  const XF = { id: (x, y) => [x, y], mx: (x, y) => [N - 1 - x, y], my: (x, y) => [x, N - 1 - y], r180: (x, y) => [N - 1 - x, N - 1 - y],
    cw: (x, y) => [N - 1 - y, x], ccw: (x, y) => [y, N - 1 - x], tr: (x, y) => [y, x], atr: (x, y) => [N - 1 - y, N - 1 - x] };
  const XINV = { id: "id", mx: "mx", my: "my", r180: "r180", cw: "ccw", ccw: "cw", tr: "tr", atr: "atr" };
  function transform(sp, name) {
    if (name === "id") return sp;
    const out = new Sprite(), f = XF[name];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const c = sp.get(x, y); if (!c) continue; const [nx, ny] = f(x, y); out.set(nx, ny, c); }
    if (sp.grip) out.grip = f(sp.grip[0], sp.grip[1]);
    if (sp.tip) out.tip = f(sp.tip[0], sp.tip[1]);
    return out;
  }
  const poseCache = new Map();
  // the weapon in the hand for a facing, made only from its held drawing and that drawing's mirror (the bow: its upright drawing's
  // quarter turns), so every pixel is the renderer's (pixel rule 1) and no pose has its head below its grip
  function poseFor(t, facing, frameNo) {
    if (FACINGS.indexOf(facing) < 0) facing = "right";
    const key = (t.id || "") + "|" + facing + "|" + (frameNo || 0) + "|" + (t.weapon ? JSON.stringify(t.weapon.visual) + t.weapon.element : "");
    if (poseCache.has(key)) return poseCache.get(key);
    let sp;
    const w = t.weapon;
    if (!w) sp = spriteFor(t, frameNo);
    else {
      const v = w.visual || {}, base = BASES[v.base] ? v.base : "sword", isBase = !(t.parents && t.parents.length);
      const fused = v.fuse && BASES[v.fuse] && v.fuse !== base;
      if (base === "bow" && !fused) {
        const up = drawWeapon(w, t.id, frameNo, isBase, true, true);   // the upright drawing shoots away (across its limbs, -b)
        const right = transform(up, "cw");
        sp = facing === "right" ? right : facing === "left" ? transform(right, "mx") : facing === "away" ? up : transform(up, "my");
      } else {
        const held = drawWeapon(w, t.id, frameNo, isBase, false, true);
        sp = MIRRORED[facing] ? transform(held, "mx") : held;
      }
    }
    poseCache.set(key, sp);
    return sp;
  }
  function gripOf(t, facing) { return (poseFor(t, facing, 0).grip || [6, 25]).slice(); }
  function tipOf(t, facing) { const sp = poseFor(t, facing, 0); return (sp.tip || sp.grip || [16, 8]).slice(); }

  // ------------------------------------------------------------------ pass 20: the weapon in a swing
  // dir: one of the eight directions on the screen; lead: "cw" or "ccw", the way the swing turns on the screen (the overhead and the
  // rising cut's tip go round clockwise and anticlockwise for a knight facing right), so the edge, the axe's bit and the scythe's blade
  // face where the weapon is going. The four diagonals are the held drawing's frame turned by a symmetry of the grid, the four straight
  // ways the flat frame (1.4 px a unit) turned; each turn is listed for cw, then ccw (a mirror across the weapon's own line swaps them).
  // The drawing is 48 x 48, the weapon centred at the held drawing's own length, its grip and tip named. ne + cw is the held drawing's
  // pixels moved 8 right and 8 down (the motes aside, no hallmark). An upright base (the shield) never turns: its swing is its hold.
  const SWING_DIRS = ["e", "ne", "n", "nw", "w", "sw", "s", "se"];
  const SWING = { ne: ["id", "atr"], nw: ["ccw", "mx"], sw: ["r180", "tr"], se: ["cw", "my"], e: ["id", "my"], n: ["ccw", "atr"], w: ["r180", "mx"], s: ["cw", "tr"] };
  const SWING_N = 48;
  function withGrid(n, fn) { const keep = N; N = n; try { return fn(); } finally { N = keep; } }
  function swingFor(t, dir, lead, frameNo) {
    if (!SWING[dir]) dir = "ne";
    const ccw = lead === "ccw" ? 1 : 0;
    const key = "swing|" + (t.id || "") + "|" + dir + "|" + ccw + "|" + (frameNo || 0) + "|" + (t.weapon ? JSON.stringify(t.weapon.visual) + t.weapon.element : "");
    if (poseCache.has(key)) return poseCache.get(key);
    let sp;
    const w = t.weapon;
    if (!w) sp = spriteFor(t, frameNo);
    else {
      const v = w.visual || {}, base = BASES[v.base] ? v.base : "sword", isBase = !(t.parents && t.parents.length);
      if (UPRIGHT[base]) sp = poseFor(t, "right", frameNo);
      else {
        const held = drawWeapon(w, t.id, frameNo, isBase, false, true), xf = SWING[dir][ccw], flat = dir.length === 1;
        sp = withGrid(SWING_N, () => drawWeapon(w, t.id, frameNo, isBase, flat, true, xf, held.len));
      }
    }
    poseCache.set(key, sp);
    return sp;
  }

  // ------------------------------------------------------------------ public api
  const cache = new Map();
  function spriteFor(t, frameNo) {
    const key = (t.id || "") + "|" + (frameNo || 0) + "|" + (t.weapon ? JSON.stringify(t.weapon.visual) + t.weapon.element : "");
    if (cache.has(key)) return cache.get(key);
    const sp = t.kind === "weapon" && t.weapon ? drawWeapon(t.weapon, t.id, frameNo, !(t.parents && t.parents.length)) : drawIngredient(t, frameNo);
    cache.set(key, sp);
    return sp;
  }
  // draw onto a canvas at an integer scale; the drop shadow is the silhouette one pixel down and right
  function draw(canvas, t, o) {
    o = o || {}; const scale = o.scale || 3, sh = o.shadow === false ? 0 : 1;
    const sp = spriteFor(t, o.frame || 0);
    canvas.width = (N + sh) * scale; canvas.height = (N + sh) * scale;
    const ctx = canvas.getContext("2d"); ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (sh) { ctx.fillStyle = o.shadowColor || SHADOW; for (let i = 0; i < N * N; i++) if (sp.px[i]) ctx.fillRect(((i % N) + sh) * scale, (((i / N) | 0) + sh) * scale, scale, scale); }
    for (let i = 0; i < N * N; i++) { const c = sp.px[i]; if (!c) continue; ctx.fillStyle = c; ctx.fillRect((i % N) * scale, ((i / N) | 0) * scale, scale, scale); }
    return canvas;
  }
  function canvasFor(t, o) { const cv = document.createElement("canvas"); draw(cv, t, o); cv.className = "px"; cv.setAttribute("role", "img"); cv.setAttribute("aria-label", t.name || t.id); return cv; }
  function dataURL(t, o) { return canvasFor(t, o).toDataURL("image/png"); }

  root.PixelForge = { N, OUT, RAMP, ELEM, BASES: Object.keys(BASES), BLADES: Object.keys(BLADES), MARKS: Object.keys(MARKS), CHARMS: Object.keys(CHARMS),
    NECK, UPRIGHT, cutFor, hallmark, drawFused, spriteFor, draw, canvasFor, dataURL, styleFor, fnv, rng, poseFor, gripOf, tipOf, FACINGS,
    swingFor, SWING_DIRS, SWING_N };   // pass 20
})(typeof window !== "undefined" ? window : globalThis);

