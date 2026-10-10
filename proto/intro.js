// FORGE FOREVER: intro.js (design pass 37, the opening; built as build 29 by jumpr card t97). The storybook a phone that has never had a
// player sees before anything else: fourteen pictures, each painted in code at the Forge's own pixel size (the long side at most 256 world
// pixels, Hearth.kFor's rule, so the opening's pixels are the menu's), with the words the player taps through under them (spec/intro.json,
// the browser twin spec/intro.js: window.FORGE_INTRO). Two parts in one file:
//   IntroArt, the painter, pure (no DOM, no clock, no Math.random; node runs it for tools/test-intro.js), ported line for line from the
//     pass's sketch (docs/design/37-the-opening.sketch.js): the house's pixel rules (the ENDESGA 32 palette and the smithy's own tones,
//     shapes lit from the light in the picture on four-tone ramps, a one-pixel soot outline, the Bayer dither for every band and glow),
//     motion only on the fire's 90 ms beat (a slow pan of one pixel a beat, the ember's breath, the beam, the fire), Grycus and the knight
//     the game's own sprites (proto/grycus.js, proto/knight.js) lit by the picture's light the way the hearth lights its room, the hearth
//     pictures the menu's own (proto/hearth.js on proto/smithy.js: a Hearth.Scene the caller keeps, so the title card is the main menu).
//     IntroArt.paint(id, W, H, t, o) -> { rgba, W, H, ox, wide, boxes }: o = { line (the line showing, 0-based), lineT (seconds since it
//     showed), still (less motion: no pan, no breath, the last frame of every change), scene (a Hearth.Scene), band (0 to 1: the bottom
//     share shaded for the narration) }; boxes are the sprites drawn, in window pixels, so the page can keep the talk box off the figures.
//     IntroArt.kFor, PAN, BEAT, BAND, sprite, faces (the two 16 x 16 face crops), Pic, panels.
//   Intro, the controller: Intro.wanted({ player, params, store }) says whether a phone sees the book and from where; Intro.mount(game, o)
//     runs it on the menu page (the layer, the clock, the taps, the name beat, Skip, the record through Lessons.opening). See below.
(function (root) {
  "use strict";
  const OUT = "#181425", SOOT = "#0d0a14", N = 32;
  const BEAT = 0.09, PAN = 0.2, BAND = 0.3;   // the fire's beat; how far a panning picture is painted past the window; the narration's band
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
  const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  const HEX = {};
  const hex = h => HEX[h] || (HEX[h] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const beatOf = t => Math.floor(Math.max(0, t || 0) / BEAT);
  // the hearth's firelight: four dithered steps toward the ember, and past the light's reach four steps toward soot
  const GLOW = [247, 118, 34], LEVELS = [0, 0.14, 0.28, 0.42, 0.5], SHADE = [0, 0.25, 0.5, 0.7];
  function glowAt(k, x, y) { const lvl = Math.floor(k * 4 + bayer(x, y) - 0.5); return LEVELS[clamp(lvl, 0, 4)]; }
  function shadeAt(f, x, y) { const lvl = Math.floor(f * 3 + bayer(x, y) - 0.5); return SHADE[clamp(lvl, 0, 3)]; }
  function kFor(devW, devH) { return Math.max(1, Math.ceil(Math.max(devW | 0, devH | 0, 1) / 256)); }

  // ------------------------------------------------------------------ the palette (ENDESGA 32 and the smithy's own tones)
  const IRON = ["#262b44", "#3a4466", "#5a6988", "#8b9bb4", "#c0cbdc"];
  const STEEL = ["#3a4466", "#5a6988", "#8b9bb4", "#c0cbdc"];
  const ROCK = ["#0d0a14", "#181425", "#262b44", "#3a4466", "#5a6988"];
  const EMBER = ["#a22633", "#f77622", "#feae34", "#fee761", "#fff6c8"];
  const OAK = ["#3e2731", "#733e39", "#b86f50", "#e4a672"];
  const GREEN = ["#193c3e", "#265c42", "#3e8948", "#63c74d"];
  const SNOW = ["#8b9bb4", "#c0cbdc", "#ffffff"];
  const WATER = ["#124e89", "#0099db", "#2ce8f5"];
  const SAND = ["#b86f50", "#d77643", "#e4a672", "#ead4aa"];
  const DUSK = ["#181425", "#262b44", "#3a4466", "#68386c", "#b55088", "#f6757a", "#e4a672", "#feae34", "#fee761"];
  const DAY = ["#124e89", "#0099db", "#2ce8f5", "#c0cbdc", "#fee761"];
  const FEVER = ["#0d0a14", "#181425", "#262b44", "#3e2731", "#68386c", "#b55088"];
  const NIGHT = ["#0d0a14", "#181425", "#181425", "#262b44"];
  const WARSKY = ["#181425", "#3e1420", "#a22633", "#e43b44", "#f77622", "#feae34"];

  // ------------------------------------------------------------------ a picture: W x H, a colour a pixel
  function Pic(W, H, fillHex) {
    this.W = W; this.H = H; this.px = new Float32Array(W * H * 3); this.boxes = null;
    if (fillHex) { const c = hex(fillHex); for (let i = 0; i < W * H; i++) { this.px[i * 3] = c[0]; this.px[i * 3 + 1] = c[1]; this.px[i * 3 + 2] = c[2]; } }
  }
  Pic.prototype.in = function (x, y) { return x >= 0 && y >= 0 && x < this.W && y < this.H; };
  Pic.prototype.set = function (x, y, c) { x = Math.round(x); y = Math.round(y); if (!c || !this.in(x, y)) return; const v = typeof c === "string" ? hex(c) : c, o = (y * this.W + x) * 3; this.px[o] = v[0]; this.px[o + 1] = v[1]; this.px[o + 2] = v[2]; };
  Pic.prototype.get = function (x, y) { if (!this.in(x, y)) return null; const o = (y * this.W + x) * 3; return [this.px[o], this.px[o + 1], this.px[o + 2]]; };
  // fill(x0, y0, x1, y1, fn): fn(x, y) gives the colour (null leaves the pixel)
  Pic.prototype.fill = function (x0, y0, x1, y1, fn) { for (let y = Math.max(0, y0); y <= Math.min(this.H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(this.W - 1, x1); x++) this.set(x, y, typeof fn === "function" ? fn(x, y) : fn); };
  // toward(x, y, rgb, m): the pixel moved a share m toward a colour
  Pic.prototype.toward = function (x, y, c, m) { if (!this.in(x, y) || m <= 0) return; const o = (y * this.W + x) * 3; this.px[o] += (c[0] - this.px[o]) * m; this.px[o + 1] += (c[1] - this.px[o + 1]) * m; this.px[o + 2] += (c[2] - this.px[o + 2]) * m; };
  // light(cx, cy, R, o): the hearth's firelight from a point, reaching R: o.colour (the ember's by default), o.dark (shade toward soot
  // past the reach, as the hearth does), o.wide (the hearth's weighting: wider than tall), o.only (a predicate: light these pixels alone)
  Pic.prototype.light = function (cx, cy, R, o) {
    o = o || {}; const C = o.colour ? hex(o.colour) : GLOW, s = o.strength === undefined ? 1 : o.strength;
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
      if (o.only && !o.only(x, y)) continue;
      const d = o.wide ? Math.hypot((x - cx) * 0.9, (y - cy) * 1.2) : Math.hypot(x - cx, y - cy), k = 1 - d / R;
      if (k > 0) { const m = glowAt(k * s, x, y); this.toward(x, y, [C[0], C[1], C[2]], m); const o3 = (y * this.W + x) * 3; this.px[o3 + 1] -= (C[1] - this.px[o3 + 1]) * m * 0.1; this.px[o3 + 2] -= (C[2] - this.px[o3 + 2]) * m * 0.2; }
      else if (o.dark) this.toward(x, y, [13, 10, 20], shadeAt(Math.min(1, -k * (o.dark === true ? 2.2 : o.dark)), x, y));
    }
  };
  // a soot outline round every pixel for which pred holds (the sprites bring their own; the drawn things need it)
  Pic.prototype.outline = function (pred, x0, y0, x1, y1, c) {
    const add = []; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!pred(x, y) && (pred(x - 1, y) || pred(x + 1, y) || pred(x, y - 1) || pred(x, y + 1))) add.push([x, y]);
    for (const [x, y] of add) this.set(x, y, c || OUT);
  };
  // blit(px, n, x, y, o): a sprite's n x n colours (null for none) with its bottom-left of its ink at (x, y) (o.anchor "bl" by default;
  // "tl" its top-left, "bc" its bottom-centre); o.flip mirrors it, o.rot 1 turns it a quarter clockwise, 3 anticlockwise (lying down:
  // the head to the left, the face up); o.tint maps each colour; o.shadow draws it as one colour. Returns its box in the picture
  Pic.prototype.blit = function (px, n, x, y, o) {
    o = o || {}; const who = px.who || null; let src = px.slice();
    if (o.flip) { const t = new Array(n * n).fill(null); for (let yy = 0; yy < n; yy++) for (let xx = 0; xx < n; xx++) t[yy * n + (n - 1 - xx)] = src[yy * n + xx]; src = t; }
    if (o.rot) { const t = new Array(n * n).fill(null); for (let yy = 0; yy < n; yy++) for (let xx = 0; xx < n; xx++) { const c = src[yy * n + xx]; if (o.rot === 1) t[xx * n + (n - 1 - yy)] = c; else t[(n - 1 - xx) * n + yy] = c; } src = t; }
    let bx0 = n, by0 = n, bx1 = -1, by1 = -1;
    for (let yy = 0; yy < n; yy++) for (let xx = 0; xx < n; xx++) if (src[yy * n + xx]) { bx0 = Math.min(bx0, xx); by0 = Math.min(by0, yy); bx1 = Math.max(bx1, xx); by1 = Math.max(by1, yy); }
    if (bx1 < 0) return null;
    const anchor = o.anchor || "bl";
    const ox = anchor === "bc" ? Math.round(x - (bx0 + bx1) / 2) : x - bx0, oy = anchor === "tl" ? y - by0 : y - by1;
    for (let yy = by0; yy <= by1; yy++) for (let xx = bx0; xx <= bx1; xx++) { let c = src[yy * n + xx]; if (!c) continue; if (o.shadow) c = o.shadow; else if (o.tint) c = o.tint(c) || c; this.set(ox + xx, oy + yy, c); }
    const box = { x0: ox + bx0, y0: oy + by0, x1: ox + bx1, y1: oy + by1 };
    if (this.boxes) this.boxes.push(Object.assign({ who }, box));
    return box;
  };
  // window(ox): the W x H window of this (wider) picture starting at world x ox, as RGBA bytes
  Pic.prototype.window = function (W, H, ox) {
    const d = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = this.get(x + ox, y) || [13, 10, 20], o = (y * W + x) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; }
    return d;
  };
  // band(share): the bottom share of the picture shaded toward soot, dithered, for the narration to stand on
  Pic.prototype.band = function (share) {
    if (!(share > 0)) return; const top = Math.round(this.H * (1 - share)), h = this.H - top;
    for (let y = top; y < this.H; y++) for (let x = 0; x < this.W; x++) this.toward(x, y, [13, 10, 20], shadeAt(clamp((y - top) / Math.max(1, h * 0.55), 0, 1), x, y) * 1.1);
  };
  // wash(level, colour): the picture dithered toward a colour by level 0 to 1 (the burst's white-out, a fade from black)
  // (build 29: at level 1 every pixel is the colour, so the title card starts black and the burst ends white; the sketch left a dithered
  // ghost at 80 %)
  Pic.prototype.wash = function (level, colour) { if (!(level > 0)) return; const c = typeof colour === "string" ? hex(colour) : colour; const full = level >= 1; for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) { const l = Math.floor(level * 5 + bayer(x, y) - 0.5); if (full || l >= 5) this.toward(x, y, c, 1); else if (l > 0) this.toward(x, y, c, l / 5 * 0.8); } };

  // ------------------------------------------------------------------ the sprites: the game's own, when their scripts are here
  const SPR = {};
  function knight(facing, anim, i) { const K = root.Knight; const key = "k" + facing + anim + i; if (SPR[key] !== undefined) return SPR[key]; let px = null; try { px = K ? K.frame(facing, anim, i | 0, 0, { seat: 0, kit: "knight" }).px : null; } catch (e) { px = null; } px = px || stand(IRON); px.who = "knight"; return (SPR[key] = px); }
  function grycus(pose, i) { const G = root.Grycus; const key = "g" + pose + i; if (SPR[key] !== undefined) return SPR[key]; let px = null; try { px = G ? G.frame(pose, i | 0).px : null; } catch (e) { px = null; } px = px || stand(OAK); px.who = "grycus"; return (SPR[key] = px); }
  // without the game's scripts: a plain standing figure, so the pictures still compose
  function stand(ramp) { const px = new Array(N * N).fill(null); for (let y = 6; y < 32; y++) for (let x = 11; x < 21; x++) px[y * N + x] = y < 12 ? ramp[2] : ramp[1]; return px; }
  function sprite(kind, a, b, c) { return kind === "knight" ? knight(a, b, c) : grycus(a, b); }

  // ------------------------------------------------------------------ the sky: bands top to bottom with a Bayer dither across each edge,
  // the edges lifted toward the sun (the dusk vista's rule)
  function sky(p, bands, edges, y0, y1, sunX, lift) {
    const H = y1 - y0; if (H <= 0) return;
    const tops = new Float64Array(bands.length);
    for (let x = 0; x < p.W; x++) {
      const g = sunX === undefined ? 0 : Math.exp(-Math.pow((x - sunX) / (0.28 * p.W), 2));
      for (let i = 0; i < bands.length; i++) tops[i] = y0 + (edges[i] - (lift ? lift[i] : 0) * g) * H;
      let i = 0;
      for (let y = y0; y < y1; y++) {
        while (i < bands.length - 1 && y >= tops[i + 1]) i++;
        let c = bands[i];
        if (i < bands.length - 1) { const d = tops[i + 1] - y; if (d < 3 && bayer(x, y) > d / 3) c = bands[i + 1]; }
        p.set(x, y, c);
      }
    }
  }
  function stars(p, r, y1, n, c) { for (let i = 0; i < n; i++) { const x = Math.floor(r() * p.W), y = Math.floor(r() * y1); p.set(x, y, c || (r() < 0.3 ? "#c0cbdc" : "#5a6988")); } }
  // a ridge: y(x) from a base and harmonics, filled down to bottom in body, its edge lit on the side facing the light (lx), a soot line on top
  function ridge(p, r, base, A, L, bottom, body, lit, rim, lx, outline) {
    const ph = A.map(() => r() * Math.PI * 2), ys = new Int32Array(p.W);
    for (let x = 0; x < p.W; x++) { let v = base; for (let k = 0; k < A.length; k++) v += A[k] * Math.sin(2 * Math.PI * x / L[k] + ph[k]); ys[x] = Math.round(v); }
    for (let x = 0; x < p.W; x++) {
      const slope = (ys[Math.min(p.W - 1, x + 1)] - ys[Math.max(0, x - 1)]) / 2, faces = lx === undefined ? false : (lx < x ? slope > 0.15 : slope < -0.15);
      for (let y = ys[x]; y <= bottom; y++) { const d = y - ys[x]; p.set(x, y, d === 0 && outline !== false ? OUT : d < 3 && faces && lit ? (d === 1 && rim ? rim : lit) : body); }
    }
    return ys;
  }

  // ------------------------------------------------------------------ the cave: a tunnel seen from the side, rock above and below, a dark
  // back wall; r seeds its shape; the floor at fy
  function cave(p, r, fy, o) {
    o = o || {};
    p.fill(0, 0, p.W - 1, p.H - 1, (x, y) => (bayer(x, y) < 0.35 ? ROCK[1] : ROCK[0]));
    // the back wall's rock: blocks of dark rock with a dithered join, darker toward the roof
    for (let y = 0; y < fy; y++) for (let x = 0; x < p.W; x++) { const t = y / fy; const c = bayer(x, y) < 0.18 + 0.5 * t ? ROCK[1] : (x * 7 + y * 13) % 29 === 0 ? ROCK[2] : ROCK[0]; p.set(x, y, c); }
    // cracks and the odd pale stone in the back wall
    for (let i = 0; i < p.W / 9; i++) { const x = Math.floor(r() * p.W), y = Math.floor(r() * fy * 0.9) + 2, len = 3 + Math.floor(r() * 6); for (let k = 0; k < len; k++) p.set(x + (k & 1 ? 1 : 0) + Math.floor(k / 2) * (r() < 0.5 ? 1 : -1), y + k, ROCK[2]); }
    // the roof: stalactites hanging from a jagged line
    const roof = ridge(p, r, Math.round(fy * 0.22), [fy * 0.06, fy * 0.03], [p.W * 0.37, p.W * 0.13], -1, ROCK[2], null, null, undefined, false);
    for (let x = 0; x < p.W; x++) for (let y = 0; y <= roof[x]; y++) p.set(x, y, y === roof[x] ? ROCK[3] : (y === roof[x] - 1 ? ROCK[2] : bayer(x, y) < 0.5 ? ROCK[2] : ROCK[1]));
    for (let i = 0; i < p.W / 14; i++) { const x = Math.floor(r() * p.W), len = 3 + Math.floor(r() * (fy * 0.16)), w = 2 + Math.floor(r() * 2); const top = roof[Math.min(p.W - 1, x)]; for (let k = 0; k < len; k++) { const hw = Math.max(0, Math.round(w * (1 - k / len))); for (let dx = -hw; dx <= hw; dx++) p.set(x + dx, top + k, dx === -hw ? ROCK[3] : dx === hw ? ROCK[1] : ROCK[2]); } p.set(x, top + len, ROCK[3]); }
    // the floor: a lit top edge, rock below, rubble
    const floor = ridge(p, r, fy, [1.2, 0.6], [p.W * 0.3, p.W * 0.09], p.H - 1, ROCK[2], null, null, undefined, false);
    for (let x = 0; x < p.W; x++) { p.set(x, floor[x], ROCK[3]); p.set(x, floor[x] + 1, ROCK[2]); for (let y = floor[x] + 2; y < p.H; y++) p.set(x, y, bayer(x, y) < 0.3 ? ROCK[1] : ROCK[2]); }
    for (let i = 0; i < p.W / 10; i++) { const x = Math.floor(r() * p.W), y = floor[Math.min(p.W - 1, x)] - 1, w = 1 + Math.floor(r() * 3); for (let dx = 0; dx < w; dx++) { p.set(x + dx, y, ROCK[3]); if (w > 1) p.set(x + dx, y + 1, ROCK[2]); } }
    return { roof, floor };
  }
  // the ember: a coal the size of a coin, its light breathing; motes rising from it on the beat
  function ember(p, x, y, t, o) {
    o = o || {}; const b = beatOf(t), breath = o.still ? 1 : 1 + 0.06 * Math.sin(t * 2.7) + 0.03 * Math.sin(t * 5.1);
    const R = (o.R || 30) * breath;
    p.light(x, y, R, { strength: o.strength || 1 });
    p.light(x, y, R * 0.3, { colour: "#feae34" });
    // the coal: a 5 x 4 ember, dark at its rim, white at its heart
    const coal = [[0, -1, 1], [1, -1, 2], [2, -1, 2], [3, -1, 1], [-1, 0, 1], [0, 0, 2], [1, 0, 4], [2, 0, 3], [3, 0, 2], [4, 0, 1], [-1, 1, 0], [0, 1, 2], [1, 1, 3], [2, 1, 3], [3, 1, 2], [4, 1, 0], [0, 2, 0], [1, 2, 1], [2, 2, 1], [3, 2, 0]];
    for (const [dx, dy, lvl] of coal) { const l = o.still ? lvl : Math.max(0, Math.min(4, lvl + ((b + dx * 3 + dy) % 7 === 0 ? -1 : 0))); p.set(x + dx - 2, y + dy - 1, EMBER[l]); }
    if (!o.still && !o.noMotes) { const r = rng(1000 + b); for (let i = 0; i < 5; i++) { const age = (b + i * 3) % 14, mx = x + Math.round((r() - 0.5) * 6) + Math.round(Math.sin((b + i * 5) * 0.8) * 1.5), my = y - 2 - age; if (age > 0) p.set(mx, my, EMBER[age < 4 ? 4 : age < 8 ? 3 : age < 11 ? 2 : 1]); } }
  }
  // the gauntlet: the knight's hand reaching in from the left, palm down, big (a close-up), lit by the ember on its right
  function gauntlet(p, x, y, o) {
    o = o || {}; const s = o.s || 1;
    const parts = [];   // [x0, y0, x1, y1, ramp index base]
    parts.push([x - 26 * s, y - 7 * s, x - 14 * s, y + 6 * s, 1]);   // the cuff
    parts.push([x - 15 * s, y - 5 * s, x - 1, y + 4 * s, 2]);        // the back of the hand
    const fingers = [[-5, 9], [-2, 11], [1, 10], [4, 8]];              // [y, length]
    for (const [fy, len] of fingers) parts.push([x - 2, y + fy * s, x - 2 + len * s, y + (fy + 2) * s, 2]);
    parts.push([x - 10 * s, y + 5 * s, x - 3 * s, y + 8 * s, 1]);     // the thumb, under
    const inPart = (xx, yy) => parts.some(q => xx >= q[0] && xx <= q[3 - 2] && yy >= q[1] && yy <= q[3]);
    for (const q of parts) for (let yy = q[1]; yy <= q[3]; yy++) for (let xx = q[0]; xx <= q[2]; xx++) {
      const top = yy === q[1], left = xx === q[0], bottom = yy === q[3], right = xx === q[2];
      let c = STEEL[q[4]]; if (top || right) c = STEEL[Math.min(3, q[4] + 1)]; if (bottom || left) c = STEEL[Math.max(0, q[4] - 1)]; if ((top && right)) c = STEEL[3];
      p.set(xx, yy, c);
    }
    // the plates' joins: a dark line across the fingers' knuckles and the cuff's edge
    for (const [fy] of fingers) { p.set(x + 1, y + fy * s, STEEL[0]); p.set(x + 1, y + (fy + 1) * s, STEEL[0]); }
    for (let yy = y - 7 * s; yy <= y + 6 * s; yy++) p.set(x - 15 * s, yy, STEEL[0]);
    p.outline(inPart, x - 28 * s, y - 9 * s, x + 14 * s, y + 10 * s);
  }
  // small figures in silhouette: a soldier standing (facing dir), with a spear and maybe a banner
  function soldier(p, x, y, dir, c, r) {
    const b = c || OUT; const bodyH = 6;
    for (let yy = 0; yy < bodyH; yy++) { p.set(x, y - yy, b); p.set(x + 1, y - yy, b); }
    p.set(x, y - bodyH, b); p.set(x + 1, y - bodyH, b); p.set(x, y - bodyH - 1, b); p.set(x + 1, y - bodyH - 1, b);   // the helm
    p.set(x + (dir > 0 ? 2 : -1), y - 4, b);   // the arm
    const sx = x + (dir > 0 ? 3 : -2); for (let yy = 0; yy < 11; yy++) p.set(sx, y - 1 - yy, b);   // the spear
    p.set(sx, y - 12, "#5a6988");
    if (r && r() < 0.18) { for (let yy = 0; yy < 4; yy++) for (let dx = 1; dx <= 4; dx++) p.set(sx + dx * dir, y - 11 + yy, "#a22633"); }
  }

  // ------------------------------------------------------------------ the land of Ardentia (three moods: gold, fever, night), one painting
  // wide enough to pan: the Frostpeaks at the back on the left, the Dragon's Den smoking on the right, the old west castle on its hill
  // on the left, the capital's towers on the right, the river down the middle, the sands at the bottom right, and the forge's own
  // chimney in the middle of the foreground
  function land(p, mood, t, o) {
    o = o || {}; const r = rng(360 + (mood === "night" ? 1 : 0)), W = p.W, H = p.H, hy = Math.round(H * 0.46);
    const sunX = Math.round(W * 0.62), still = !!o.still;
    if (mood === "gold") sky(p, DAY, [0, 0.3, 0.62, 0.84, 0.95], 0, hy + 2, sunX, [0, 0.02, 0.06, 0.1, 0.12]);
    else if (mood === "fever") sky(p, FEVER, [0, 0.2, 0.4, 0.62, 0.8, 0.93], 0, hy + 2);
    else { sky(p, NIGHT, [0, 0.4, 0.7, 0.92], 0, hy + 2); stars(p, r, hy - 4, Math.round(W / 4)); }
    // the sun (gold), its rim and corona
    if (mood === "gold") { const sx = sunX, sy = Math.round(hy * 0.42), sr = Math.max(3, Math.round(H * 0.07)); for (let y = sy - sr - 3; y <= sy + sr + 3; y++) for (let x = sx - sr - 3; x <= sx + sr + 3; x++) { const d = Math.hypot(x - sx, y - sy); if (d <= sr - 1.2) p.set(x, y, "#fee761"); else if (d <= sr) p.set(x, y, "#feae34"); else if (d <= sr + 2.5 && bayer(x, y) > (d - sr) / 2.5) p.set(x, y, "#feae34"); } }
    const G = mood === "gold" ? { far: ["#5a6988", "#8b9bb4", "#c0cbdc"], hill: [GREEN[1], GREEN[2], GREEN[3]], field: [GREEN[2], GREEN[3], "#ead4aa"], water: WATER, sand: SAND, stone: STEEL, roof: ["#be4a2f", "#feae34"], wood: OAK }
      : mood === "fever" ? { far: ["#262b44", "#3a4466", "#5a6988"], hill: ["#262b44", "#3a4466", "#3e2731"], field: ["#3a4466", "#5a6988", "#733e39"], water: ["#181425", "#262b44", "#3a4466"], sand: ["#3e2731", "#733e39", "#733e39", "#b86f50"], stone: ["#262b44", "#3a4466", "#5a6988", "#8b9bb4"], roof: ["#3e2731", "#733e39"], wood: ["#181425", "#3e2731", "#3e2731", "#733e39"] }
      : { far: ["#181425", "#262b44", "#3a4466"], hill: ["#0d0a14", "#181425", "#262b44"], field: ["#181425", "#262b44", "#3a4466"], water: ["#0d0a14", "#181425", "#262b44"], sand: ["#181425", "#262b44", "#262b44", "#3a4466"], stone: ["#181425", "#262b44", "#3a4466", "#5a6988"], roof: ["#181425", "#262b44"], wood: ["#0d0a14", "#181425", "#181425", "#262b44"] };
    // the far peaks (the Frostpeaks on the left half, snow on their caps), the smoking mountain on the right
    const peaks = ridge(p, r, hy - H * 0.14, [H * 0.1, H * 0.05, H * 0.02], [W * 0.5, W * 0.21, W * 0.09], hy + 3, G.far[0], G.far[1], null, sunX);
    for (let x = 0; x < Math.round(W * 0.55); x++) { const top = peaks[x]; const capH = clamp(Math.round((hy - H * 0.14 - top) * 0.45), 0, 9); for (let y = top + 1; y <= top + capH; y++) if (bayer(x, y) < 1 - (y - top) / (capH + 1)) p.set(x, y, mood === "gold" ? (y - top < 2 ? SNOW[2] : SNOW[1]) : G.far[2]); }
    { const vx = Math.round(W * 0.86), vy = peaks[Math.min(W - 1, vx)] - Math.round(H * 0.12); for (let y = vy; y <= hy + 2; y++) { const hw = Math.round((y - vy) * 0.9) + 1; for (let x = vx - hw; x <= vx + hw; x++) p.set(x, y, y === vy || x === vx - hw ? (mood === "gold" ? "#733e39" : G.far[1]) : (x === vx + hw ? G.far[0] : (mood === "gold" ? "#3e2731" : G.far[0]))); }
      p.set(vx, vy - 1, mood === "night" ? "#a22633" : "#f77622"); p.set(vx - 1, vy, mood === "night" ? "#3e1420" : "#e43b44");
      const b = beatOf(t); for (let i = 0; i < 14; i++) { const k = (i * 5 + (still ? 0 : b)) % 40, sx = vx + Math.round(Math.sin((i * 1.7 + k * 0.2)) * (1 + k * 0.12)), sy = vy - 2 - k; if (bayer(sx, sy) < 0.7 - k / 50) p.set(sx, sy, k < 14 ? "#5a6988" : "#3a4466"); } }
    // the hills, green, lit toward the sun; the fields in strips below them; the river from the peaks to the bottom
    ridge(p, r, hy + H * 0.02, [H * 0.05, H * 0.025], [W * 0.42, W * 0.17], Math.round(H * 0.7), G.hill[1], G.hill[2], null, sunX);
    const fy0 = Math.round(H * 0.64);
    for (let y = fy0; y < H; y++) for (let x = 0; x < W; x++) { const row = Math.floor((y - fy0) / 4), s = (x + row * 7) % 23 < 11 ? 0 : 1; const c = (y - fy0) % 4 === 0 ? G.hill[0] : (s ? G.field[0] : G.field[1]); if (bayer(x, y) < 0.08) p.set(x, y, G.field[2]); else p.set(x, y, c); }
    // the river: winding down from the peaks' foot on the left of the middle, widening, with glints
    { let rx = W * 0.44; for (let y = hy + 3; y < H; y++) { rx += Math.sin(y * 0.19) * 0.9 + Math.sin(y * 0.07) * 0.6; const hw = 1 + Math.round((y - hy) / (H - hy) * 3.5); for (let dx = -hw; dx <= hw; dx++) { const x = Math.round(rx) + dx; p.set(x, y, dx === -hw ? G.water[0] : dx === hw ? G.water[2] : (!still && ((x * 3 + y * 5 + beatOf(t)) % 17 === 0) ? G.water[2] : G.water[1])); } p.set(Math.round(rx) - hw - 1, y, OUT); p.set(Math.round(rx) + hw + 1, y, OUT); } }
    // the sands at the bottom right: dunes, their crests lit
    { const sx0 = Math.round(W * 0.62), sy0 = Math.round(H * 0.74); for (let y = sy0; y < H; y++) for (let x = sx0 + Math.round((y - sy0) * -1.2); x < W; x++) { const d = Math.sin(x * 0.21 + y * 0.5) + Math.sin(x * 0.07); p.set(x, y, d > 1.2 ? G.sand[3] : d > 0.3 ? G.sand[2] : d > -0.6 ? G.sand[1] : G.sand[0]); } for (let y = sy0; y < H; y++) p.set(sx0 + Math.round((y - sy0) * -1.2) - 1, y, OUT); }
    // the old castle on its hill on the left: a keep, two towers, banners; the capital on the right: a cluster of towers and a dome
    castle(p, Math.round(W * 0.16), Math.round(H * 0.6), G, mood, 1);
    city(p, Math.round(W * 0.8), Math.round(H * 0.62), G, mood);
    // the forge: a low stone house with a tall chimney in the middle of the foreground, its smoke on the beat
    { const fx = Math.round(W * 0.5), fy = Math.round(H * 0.86), w = Math.round(H * 0.11), h = Math.round(H * 0.07);
      p.fill(fx - w, fy - h, fx + w, fy, (x, y) => x === fx - w || x === fx + w || y === fy ? OUT : y === fy - h ? G.stone[3] : (x + y) % 5 === 0 ? G.stone[0] : G.stone[1]);
      for (let k = 0; k <= h + 2; k++) for (let x = fx - w - k + h + 2; x <= fx + w + k - h - 2; x++) p.set(x, fy - h - 1 - (h + 2 - k), k === 0 ? OUT : (k === 1 ? G.roof[1] : G.roof[0]));
      p.fill(fx + w - 5, fy - h - 9, fx + w - 2, fy - h - 1, (x, y) => x === fx + w - 5 || x === fx + w - 2 ? OUT : y === fy - h - 9 ? G.stone[3] : G.stone[1]);
      p.fill(fx - 2, fy - 4, fx + 1, fy - 1, (x, y) => mood === "night" ? "#f77622" : (y === fy - 4 ? OUT : "#3e1420"));
      const b = beatOf(t); for (let i = 0; i < 8; i++) { const k = (i * 4 + (still ? 0 : b)) % 24, sx = fx + w - 3 + Math.round(Math.sin(i + k * 0.3) * (1 + k * 0.1)), sy = fy - h - 10 - k; if (bayer(sx, sy) < 0.8 - k / 30) p.set(sx, sy, "#8b9bb4"); } }
  }
  function castle(p, cx, cy, G, mood) {
    // the hill
    for (let y = cy - 8; y <= cy + 6; y++) { const hw = Math.round(22 - Math.abs(y - cy - 6) * 0.1 - Math.max(0, (cy - y)) * 1.6); for (let x = cx - hw; x <= cx + hw; x++) p.set(x, y, y === cy - 8 - 0 && false ? OUT : (y < cy - 6 ? G.hill[2] : G.hill[1])); }
    const tower = (x, w, h, flag) => { p.fill(x, cy - h, x + w, cy, (xx, yy) => xx === x || xx === x + w || yy === cy ? OUT : yy === cy - h ? G.stone[3] : xx === x + 1 ? G.stone[2] : (xx + yy) % 4 === 0 ? G.stone[0] : G.stone[1]); for (let xx = x; xx <= x + w; xx += 2) p.set(xx, cy - h - 1, G.stone[2]); if (flag) { for (let yy = 0; yy < 5; yy++) p.set(x + (w >> 1), cy - h - 2 - yy, OUT); for (let yy = 0; yy < 3; yy++) for (let dx = 1; dx <= 4 - yy; dx++) p.set(x + (w >> 1) + dx, cy - h - 6 + yy, mood === "gold" ? "#e43b44" : G.roof[0]); } };
    p.fill(cx - 14, cy - 7, cx + 14, cy, (x, y) => x === cx - 14 || x === cx + 14 || y === cy ? OUT : y === cy - 7 ? G.stone[3] : (x + y) % 4 === 0 ? G.stone[0] : G.stone[1]);   // the wall
    for (let x = cx - 14; x <= cx + 14; x += 2) p.set(x, cy - 8, G.stone[2]);
    tower(cx - 15, 5, 14, true); tower(cx + 10, 5, 14, true); tower(cx - 4, 8, 19, true);
    p.fill(cx - 1, cy - 4, cx + 1, cy - 1, (x, y) => mood === "night" ? "#181425" : "#3e2731");   // the gate
    if (mood === "night") { p.set(cx, cy - 12, EMBER[3]); }
  }
  function city(p, cx, cy, G, mood) {
    const tower = (x, w, h, roofC) => { p.fill(x, cy - h, x + w, cy, (xx, yy) => xx === x || xx === x + w || yy === cy ? OUT : yy === cy - h ? G.stone[3] : xx === x + 1 ? G.stone[2] : (xx * 3 + yy) % 7 === 0 ? G.stone[0] : G.stone[1]); for (let k = 0; k <= (w >> 1) + 1; k++) for (let xx = x + k - 1; xx <= x + w - k + 1; xx++) p.set(xx, cy - h - 1 - k, k === 0 ? OUT : (xx === x + k - 1 ? OUT : roofC)); };
    p.fill(cx - 24, cy - 6, cx + 24, cy, (x, y) => x === cx - 24 || x === cx + 24 || y === cy ? OUT : y === cy - 6 ? G.stone[3] : (x + y) % 4 === 0 ? G.stone[0] : G.stone[1]);
    for (let x = cx - 24; x <= cx + 24; x += 2) p.set(x, cy - 7, G.stone[2]);
    tower(cx - 21, 4, 12, G.roof[0]); tower(cx - 13, 5, 17, G.roof[1]); tower(cx + 8, 5, 15, G.roof[1]); tower(cx + 17, 4, 11, G.roof[0]);
    // the dome of the old king's hall in the middle
    { const dx = cx - 2, dy = cy - 10, rr = 7; p.fill(dx - rr - 1, dy - rr - 1, dx + rr + 1, cy, (x, y) => { const d = Math.hypot(x - dx, (y - dy) * 1.25); if (y > dy) return x === dx - rr - 1 || x === dx + rr + 1 ? OUT : (x + y) % 5 === 0 ? G.stone[0] : G.stone[1]; if (d <= rr) return x < dx - 2 ? G.roof[1] : G.roof[0]; if (d <= rr + 1) return OUT; return null; }); p.set(dx, dy - rr - 1, OUT); p.set(dx, dy - rr - 2, mood === "gold" ? "#fee761" : G.roof[1]); }
    if (mood === "night") p.set(cx - 2, cy - 14, EMBER[3]);
  }

  // ------------------------------------------------------------------ the hearth pictures: the menu's own picture with Grycus and the knight on
  // the flagstones in front of the anvil, lit by the fire as the room is
  function hearth(p, W, H, t, o) {
    const Hh = root.Hearth; let rgba = null, L = null;
    const tt = o.still ? 0 : t;   // (build 29: under less motion the fire's light holds still, as the menu's does)
    if (o.scene && o.scene.renderInto) { rgba = new Uint8ClampedArray(W * H * 4); o.scene.renderInto(rgba, tt); L = o.scene.L; }
    else if (Hh) { const f = Hh.frame(W, H, Hh.SEED, undefined, tt); rgba = f.rgba; L = f.L; }
    if (rgba) { for (let i = 0; i < W * H; i++) { p.px[i * 3] = rgba[i * 4]; p.px[i * 3 + 1] = rgba[i * 4 + 1]; p.px[i * 3 + 2] = rgba[i * 4 + 2]; } }
    else { p.fill(0, 0, W - 1, H - 1, (x, y) => y > H * 0.8 ? "#3b2f36" : "#2f2940"); L = { cx: W >> 1, floorY: Math.round(H * 0.8), hw: Math.round(H * 0.36), light: { x: W >> 1, y: Math.round(H * 0.6), R: Math.round(H * 0.9) }, anvil: { x0: (W >> 1) - 27, A: 54 } }; }
    return L;
  }
  // the firelight on a box of sprite pixels (the room's own rule, so the figures sit in the room's light)
  function firelight(p, box, L, t) {
    if (!box) return; const R = L.light.R * (1 + 0.04 * Math.sin(t * 7.3) + 0.025 * Math.sin(t * 13.1));
    for (let y = box.y0; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++) {
      const d = Math.hypot((x - L.light.x) * 0.9, (y - L.light.y) * 1.2), k = 1 - d / R;
      if (k > 0) { const m = glowAt(k, x, y); const o = (y * p.W + x) * 3; p.px[o] += (GLOW[0] - p.px[o]) * m; p.px[o + 1] += (GLOW[1] - p.px[o + 1]) * m * 0.9; p.px[o + 2] += (GLOW[2] - p.px[o + 2]) * m * 0.8; }
      else p.toward(x, y, [13, 10, 20], shadeAt(Math.min(1, -k * 2.2), x, y));
    }
  }
  // where the two stand in the hearth picture: Grycus left of the hearth's block facing the anvil, the knight between him and the stump
  function places(L, W) { const floor = L.floorY + Math.max(2, Math.round((W > 200 ? 0.05 : 0.04) * L.floorY)); const gx = Math.max(2, L.cx - L.hw - Math.round(W * 0.13)); return { floor, gx, kx: Math.max(gx + 30, L.cx - L.hw - 2) }; }

  // ------------------------------------------------------------------ the panels
  const P = {};
  // 1. the cave: the tunnel, the knight walking away from us toward a glow at its far end; a slow pan right
  P.cave = (p, t, o) => {
    const r = rng(361), fy = Math.round(p.H * 0.8); cave(p, r, fy);
    const ex = p.W - 3, ey = Math.round(p.H * 0.52);
    p.light(ex, ey, p.H * 1.0 * (o.still ? 1 : 1 + 0.05 * Math.sin(t * 2.3)), { strength: 1, dark: 1.6 });
    const b = beatOf(t), step = o.still ? 0 : Math.min(Math.round(p.W * 0.16), Math.floor(b / 3));
    const kx = Math.round(p.W * 0.3) + step, box = p.blit(knight("away", "walk", o.still ? 0 : Math.floor(b / 3) % 4), N, kx, fy + 1, { anchor: "bc" });
    if (box) p.light(ex, ey, p.H * 0.9, { strength: 0.7, dark: 1.6, only: (x, y) => x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1 });
    return { pan: true };
  };
  // 2. the ember: close in: a rock shelf, the ember on it, the knight's gauntlet reaching in from the left
  P.ember = (p, t, o) => {
    const r = rng(362), fy = Math.round(p.H * 0.66); cave(p, r, fy);
    const sx = Math.round(p.W * 0.6), sy = Math.round(p.H * 0.56), sw = Math.round(p.H * 0.22), sh = fy - sy + 3;
    // the shelf: a boulder with a flat top
    const inShelf = (x, y) => y >= sy && y <= fy + 2 && Math.abs(x - sx) <= sw - Math.max(0, (sy + 4 - y)) * 2.2 && Math.abs(x - sx) <= sw - Math.max(0, y - (fy - 1)) * 1.5;
    p.fill(sx - sw - 2, sy - 2, sx + sw + 2, fy + 2, (x, y) => inShelf(x, y) ? (y === sy ? ROCK[4] : y === sy + 1 ? ROCK[3] : (x * 5 + y * 3) % 13 === 0 ? ROCK[1] : ROCK[2]) : null);
    p.outline(inShelf, sx - sw - 3, sy - 3, sx + sw + 3, fy + 3);
    const ex = sx - 2, ey = sy - 1;
    const b = beatOf(t), reach = o.still ? 6 : Math.min(6, Math.floor(b / 4));
    gauntlet(p, Math.round(p.W * 0.2) + reach + Math.max(0, Math.round((sx - sw) - p.W * 0.2 - 16)), sy - 4);
    ember(p, ex, ey, t, { R: p.H * 0.8, still: o.still, strength: 1.25 });
    void sh;
    return { pan: false };
  };
  // 3. the burst: the same close-up; a column of light from the ember to the roof (line 0), then the white-out (line 1)
  P.burst = (p, t, o) => {
    const r = rng(362), fy = Math.round(p.H * 0.66); cave(p, r, fy);
    const sx = Math.round(p.W * 0.6), sy = Math.round(p.H * 0.56), sw = Math.round(p.H * 0.22);
    const inShelf = (x, y) => y >= sy && y <= fy + 2 && Math.abs(x - sx) <= sw - Math.max(0, (sy + 4 - y)) * 2.2 && Math.abs(x - sx) <= sw - Math.max(0, y - (fy - 1)) * 1.5;
    p.fill(sx - sw - 2, sy - 2, sx + sw + 2, fy + 2, (x, y) => inShelf(x, y) ? (y === sy ? ROCK[4] : y === sy + 1 ? ROCK[3] : (x * 5 + y * 3) % 13 === 0 ? ROCK[1] : ROCK[2]) : null);
    p.outline(inShelf, sx - sw - 3, sy - 3, sx + sw + 3, fy + 3);
    const ex = sx - 2, ey = sy - 1, b = o.still ? 12 : beatOf(t), line = o.line | 0, lt = o.still ? 2 : (o.lineT || 0);
    // the hand flung back
    gauntlet(p, Math.round(p.W * 0.2) + 6 + Math.max(0, Math.round((sx - sw) - p.W * 0.2 - 16)) - Math.min(10, b), sy - 4 - Math.min(3, b >> 2));
    // the whole cave lit, more every beat
    const grow = Math.min(1, b / 8);
    p.light(ex, ey, p.H * (0.6 + 1.6 * grow), { strength: 1, colour: "#feae34" });
    ember(p, ex, ey, t, { R: p.H * 0.5, still: true, noMotes: true });
    // the beam: a column from the ember up through the roof, widening as it rises, white at its heart
    const bw = Math.max(1, Math.round(2 + 8 * grow)), top = Math.round(ey - (ey + 2) * Math.min(1, b / 6));
    for (let y = top; y <= ey - 2; y++) for (let x = ex - bw - 2; x <= ex + bw + 2; x++) {
      const d = Math.abs(x + 0.5 - ex) / bw; if (d > 1.3) continue;
      const c = d < 0.45 ? "#ffffff" : d < 0.8 ? "#fff6c8" : d < 1 ? "#fee761" : (bayer(x, y) < 0.45 ? "#feae34" : null); if (c) p.set(x, y, c);
    }
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + b * 0.05, len = (p.H * 0.4) * grow; for (let k = 6; k < len; k += 2) { const x = Math.round(ex + Math.cos(a) * k), y = Math.round(ey - 2 + Math.sin(a) * k); if (y < ey - 1 && (k + i) % 3 === 0) p.set(x, y, "#fee761"); } }
    if (line >= 1) p.wash(Math.min(1, lt / 1.1), "#fff6c8");
    return { pan: false };
  };
  // 4. black: nothing
  P.black = p => { p.fill(0, 0, p.W - 1, p.H - 1, SOOT); return { pan: false }; };
  // 5. the title card: the hearth rising out of black (the sign is the menu's own, in HTML over it)
  P.title = (p, t, o) => { hearth(p, p.W, p.H, t, o); const lt = o.still ? 2 : (o.lineT || t || 0); p.wash(1 - Math.min(1, lt / 1.3), SOOT); return { pan: false }; };
  // 6. waking: the knight flat on the flagstones, Grycus bent over them
  P.wake = (p, t, o) => {
    const L = hearth(p, p.W, p.H, t, o), q = places(L, p.W);
    const kb = p.blit(knight("right", "idle", 0), N, q.kx, q.floor, { rot: 3 });
    const gb = p.blit(grycus("watch", o.still ? 0 : Math.floor(beatOf(t) / 4) % 4), N, q.gx, q.floor);
    firelight(p, kb, L, o.still ? 0 : t); firelight(p, gb, L, o.still ? 0 : t);
    return { pan: false };
  };
  // 7. found: the cave mouth in a hillside at dusk, Grycus with his lantern at its mouth, the knight's boots in the dark
  P.found = (p, t, o) => {
    const r = rng(367), hy = Math.round(p.H * 0.6);
    sky(p, DUSK, [0, 0.16, 0.30, 0.44, 0.58, 0.70, 0.80, 0.90, 0.97], 0, hy + 1, Math.round(p.W * 0.78), [0, 0, 0, 0.02, 0.05, 0.08, 0.10, 0.12, 0.12]);
    stars(p, r, Math.round(hy * 0.3), Math.round(p.W / 12));
    ridge(p, r, hy - p.H * 0.08, [p.H * 0.06, p.H * 0.03], [p.W * 0.5, p.W * 0.2], p.H - 1, "#262b44", "#3a4466", null, Math.round(p.W * 0.78));
    // the hill in front, from the left, rising to the right edge of the mouth; the mouth an arch of dark in it
    const mx = Math.round(p.W * 0.36), my = Math.round(p.H * 0.86), mw = Math.round(p.H * 0.17), mh = Math.round(p.H * 0.3);
    const hillTop = x => my - mh - 6 - Math.round(p.H * 0.16 * Math.exp(-Math.pow((x - mx) / (mw * 2.6), 2))) + Math.round(Math.sin(x * 0.11) * 1.5) + Math.round(Math.max(0, x - mx - mw * 2) * 0.35);
    const hill = (x, y) => y >= hillTop(x) && x <= mx + mw + Math.round(p.W * 0.34);
    p.fill(0, 0, p.W - 1, p.H - 1, (x, y) => hill(x, y) ? ((y - hillTop(x)) < 2 ? "#2c2540" : bayer(x, y) < 0.15 ? "#1e1828" : "#231c2e") : null);
    p.outline(hill, 0, 0, p.W - 1, p.H - 1);
    for (let y = my; y < p.H; y++) for (let x = 0; x < p.W; x++) p.set(x, y, y === my ? "#3e2731" : bayer(x, y) < 0.3 ? "#1e1828" : "#231c2e");
    const inMouth = (x, y) => y <= my && y >= my - mh && Math.abs(x - mx) <= mw * Math.sqrt(Math.max(0, 1 - Math.pow((my - mh * 0.55 - y) / (mh * 0.55), 2) * (y < my - mh * 0.45 ? 1 : 0)));
    p.fill(mx - mw - 1, my - mh - 1, mx + mw + 1, my, (x, y) => inMouth(x, y) ? SOOT : null);
    p.outline(inMouth, mx - mw - 2, my - mh - 2, mx + mw + 2, my + 1, "#3a4466");
    // the knight lying in the mouth, boots toward us, mostly in the dark; Grycus at the mouth with the lantern's light on him
    const kb = p.blit(knight("right", "idle", 0), N, mx - mw + 6, my - 1, { rot: 3 });
    const gb = p.blit(grycus("watch", 0), N, mx + mw - 4, my, { flip: true });
    const lx = mx + mw - 10, ly = my - 11;
    p.set(lx, ly, "#fee761"); p.set(lx, ly - 1, "#feae34"); p.set(lx, ly + 1, "#feae34"); p.set(lx, ly - 2, OUT);
    const R = p.H * 0.36 * (o.still ? 1 : 1 + 0.05 * Math.sin(t * 9));
    p.light(lx, ly, R, { colour: "#feae34", strength: 1, dark: 1.2, only: (x, y) => (kb && x >= kb.x0 && x <= kb.x1 && y >= kb.y0 && y <= kb.y1) || inMouth(x, y) });
    p.light(lx, ly, R, { colour: "#feae34", strength: 0.8, only: (x, y) => (gb && x >= gb.x0 && x <= gb.x1 && y >= gb.y0 && y <= gb.y1) || (y >= my && !inMouth(x, y)) });
    return { pan: true };
  };
  // 8. the name: the knight sitting up, Grycus talking; the name field comes in the words
  P.name = (p, t, o) => {
    const L = hearth(p, p.W, p.H, t, o), q = places(L, p.W), b = beatOf(t), line = o.line | 0;
    const kb = p.blit(knight("left", "down", 0), N, q.kx + 4, q.floor);
    const pose = line === 1 ? "idle" : line === 2 ? "shake" : "talk";
    const gb = p.blit(grycus(pose, o.still ? 0 : Math.floor(b / 2) % 4), N, q.gx, q.floor);
    firelight(p, kb, L, o.still ? 0 : t); firelight(p, gb, L, o.still ? 0 : t);
    return { pan: false };
  };
  // 9. Ardentia as it was: the land in gold; a slow pan
  P.ardentia = (p, t, o) => { land(p, "gold", t, o); return { pan: true }; };
  // 10. the fever: the same land under a sick sky, a tear in it over the capital
  P.fever = (p, t, o) => {
    land(p, "fever", t, o);
    const tx = Math.round(p.W * 0.72), b = o.still ? 20 : beatOf(t), reach = Math.min(1, b / 16), bottom = Math.round(p.H * 0.44 * reach);
    for (let y = 0; y < bottom; y++) { const x = tx + Math.round(Math.sin(y * 0.6) * 1.5 + Math.sin(y * 0.17) * 3), w = 1 + (y % 5 === 0 ? 1 : 0); for (let dx = -w - 3; dx <= w + 3; dx++) { const d = Math.abs(dx); p.set(x + dx, y, d <= 0 ? "#ff0044" : d <= w ? "#b55088" : bayer(x + dx, y) < 0.5 - d * 0.1 ? "#68386c" : null); } }
    p.light(tx, Math.round(bottom * 0.6), p.H * 0.5 * reach, { colour: "#b55088", strength: 0.9 });
    return { pan: true };
  };
  // 11. the war: a ridge at dusk, two lines of spears across a burning plain, arrows in the air; a slow pan
  P.war = (p, t, o) => {
    const r = rng(371), hy = Math.round(p.H * 0.58), b = o.still ? 0 : beatOf(t);
    sky(p, WARSKY, [0, 0.22, 0.44, 0.64, 0.82, 0.95], 0, hy + 1, Math.round(p.W * 0.5), [0, 0.02, 0.04, 0.06, 0.08, 0.1]);
    ridge(p, r, hy - p.H * 0.06, [p.H * 0.05, p.H * 0.02], [p.W * 0.45, p.W * 0.16], p.H - 1, "#231c2e", null, null, undefined);
    ridge(p, r, Math.round(p.H * 0.78), [2, 1], [p.W * 0.3, p.W * 0.1], p.H - 1, OUT, null, null, undefined, false);
    // the plain burning: fires with smoke between the lines
    for (let i = 0; i < 7; i++) { const fx = Math.round(p.W * (0.1 + i * 0.13)) + Math.round(r() * 8), fy = Math.round(p.H * (0.62 + r() * 0.1)); for (let k = 0; k < 4; k++) { const h = 2 + ((b + i + k) % 3); for (let yy = 0; yy < h; yy++) p.set(fx + k - 1, fy - yy, yy === h - 1 ? "#fee761" : yy > h - 3 ? "#feae34" : "#f77622"); } for (let k = 0; k < 10; k++) { const sx = fx + Math.round(Math.sin(k * 0.9 + i) * (1 + k * 0.3)), sy = fy - 4 - k * 2 - ((b + i) % 2); if (bayer(sx, sy) < 0.6 - k * 0.05) p.set(sx, sy, k < 4 ? "#3e2731" : "#262b44"); } }
    // the two lines on the near ridge, facing each other across the middle
    const gy = Math.round(p.H * 0.8);
    for (let i = 0; i < Math.round(p.W / 7); i++) { const x = 4 + i * 7 + Math.round(r() * 2); if (x < p.W * 0.42) soldier(p, x, gy + Math.round(Math.sin(x * 0.2)), 1, OUT, r); else if (x > p.W * 0.58) soldier(p, x, gy + Math.round(Math.sin(x * 0.2)), -1, OUT, r); }
    // arrows in flight, both ways, on the beat
    for (let i = 0; i < 9; i++) { const dir = i % 2 ? 1 : -1, k = (b + i * 5) % 30, x0 = dir > 0 ? Math.round(p.W * 0.3) : Math.round(p.W * 0.7), x = x0 + dir * k * 2, y = Math.round(p.H * 0.66 - k * 1.3 + k * k * 0.045 + i * 2); p.set(x, y, "#8b9bb4"); p.set(x - dir, y, "#5a6988"); }
    return { pan: true };
  };
  // 12. the hoard: the land at night, an ember's light hoarded in each of the five strongholds; they breathe on the second line
  P.hoard = (p, t, o) => {
    land(p, "night", t, o); const W = p.W, H = p.H, pulse = o.still ? 1 : 1 + 0.08 * Math.sin(t * 2.2);
    const spots = [[Math.round(W * 0.16) + 0, Math.round(H * 0.6) - 12], [Math.round(W * 0.2), Math.round(H * 0.3)], [Math.round(W * 0.86), Math.round(H * 0.2) + 2], [Math.round(W * 0.8) - 2, Math.round(H * 0.62) - 14], [Math.round(W * 0.8), Math.round(H * 0.9)]];
    for (const [x, y] of spots) { p.light(x, y, H * 0.22 * pulse, { colour: "#feae34", strength: 1 }); p.set(x, y, "#fff6c8"); p.set(x - 1, y, "#fee761"); p.set(x + 1, y, "#fee761"); p.set(x, y - 1, "#fee761"); p.set(x, y + 1, "#feae34"); }
    return { pan: true };
  };
  // 13. your ember: the knight sitting up with the ember's trace glowing in the open gauntlet; Grycus marvels on the second line
  P.yours = (p, t, o) => {
    const L = hearth(p, p.W, p.H, t, o), q = places(L, p.W), b = beatOf(t), line = o.line | 0;
    const kb = p.blit(knight("left", "down", 0), N, q.kx + 4, q.floor);
    const gb = p.blit(grycus(line >= 1 ? "marvel" : "watch", o.still ? 0 : Math.floor(b / 3) % 4), N, q.gx, q.floor);
    firelight(p, kb, L, o.still ? 0 : t); firelight(p, gb, L, o.still ? 0 : t);
    if (kb) { const hx = kb.x0 + 2, hy = kb.y0 + Math.round((kb.y1 - kb.y0) * 0.55); p.light(hx, hy, 9 * (o.still ? 1 : 1 + 0.1 * Math.sin(t * 3)), { colour: "#fee761", strength: 1.2 }); p.set(hx, hy, "#fff6c8"); p.set(hx - 1, hy, "#fee761"); p.set(hx + 1, hy, "#fee761"); }
    return { pan: false };
  };
  // 14. the call: both standing, Grycus straighter than he has stood in years
  P.call = (p, t, o) => {
    const L = hearth(p, p.W, p.H, t, o), q = places(L, p.W), b = beatOf(t), line = o.line | 0;
    const kb = p.blit(knight("left", "idle", o.still ? 0 : Math.floor(b / 6) % 2), N, q.kx + 6, q.floor);
    const gb = p.blit(grycus(line >= 1 ? "talk" : "marvel", o.still ? 0 : Math.floor(b / 3) % 4), N, q.gx, q.floor);
    firelight(p, kb, L, o.still ? 0 : t); firelight(p, gb, L, o.still ? 0 : t);
    return { pan: false };
  };

  // ------------------------------------------------------------------ paint(id, W, H, t, o)
  function paint(id, W, H, t, o) {
    o = o || {}; W = Math.max(8, W | 0); H = Math.max(8, H | 0); t = Math.max(0, +t || 0);
    const panel = (data().panels || []).find(q => q.id === id), fn = P[id] || P.black;
    const pans = panel ? !!panel.pan : false, pw = pans ? W + Math.round(W * PAN) : W;
    const p = new Pic(pw, H, SOOT); p.boxes = [];
    fn(p, t, o);
    if (o.band > 0) p.band(o.band);
    // the pan: one pixel a beat from the left (or the right: pan "left"), stopping at the painting's edge; still: the middle
    let ox = 0;
    if (pans) { const far = pw - W, b = beatOf(t); const k = o.still ? Math.round(far / 2) : Math.min(far, b); ox = panel.pan === "left" ? far - k : k; }
    return { rgba: p.window(W, H, ox), W, H, ox, wide: pw, boxes: p.boxes.map(b => ({ who: b.who, x0: b.x0 - ox, y0: b.y0, x1: b.x1 - ox, y1: b.y1 })) };
  }

  // ------------------------------------------------------------------ the storybook's data: window.FORGE_INTRO (spec/intro.js) in the browser,
  // spec/intro.json in node; an empty book when neither is here
  const EMPTY = { version: 1, words: {}, panels: [] };
  let fileData = null;
  function data() {
    if (root.FORGE_INTRO && root.FORGE_INTRO.panels) return root.FORGE_INTRO;
    if (fileData) return fileData;
    try { if (typeof require === "function") { const path = require("path"), fs = require("fs"); fileData = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "spec", "intro.json"), "utf8")); return fileData; } } catch (e) { /* no file */ }
    return EMPTY;
  }

  // ------------------------------------------------------------------ the faces: the lessons' crop of Grycus's idle frame (x 13 to 28, y 6 to 21),
  // and the same crop of the knight's front frame (columns 8 to 23, rows 0 to 15: the helm, the visor, the plume, the shoulders)
  function crop(px, x0, y0) { if (!px) return null; const out = []; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) out.push(px[(y0 + y) * N + x0 + x] || null); return out; }
  function faces() {
    let g = null, k = null;
    try { g = root.Grycus ? crop(root.Grycus.frame("idle", 0).px, 13, 6) : null; } catch (e) { g = null; }
    try { k = root.Knight ? crop(root.Knight.frame("toward", "idle", 0, 0, { seat: 0, kit: "knight" }).px, 8, 0) : null; } catch (e) { k = null; }
    return { grycus: g, you: k };
  }

  const IntroArt = { get DATA() { return data(); }, PAN, BEAT, BAND, kFor, paint, sprite, faces, Pic, panels: Object.keys(P) };

  // ================================================================== the controller: Intro (design pass 37 section 3.7)
  // The book on the menu page. wanted() says whether a phone sees it and from where; mount() builds the opening's layer in the game
  // root (the picture's canvas at the hearth's pixel size, the narration on its band, the talk box in the lessons' own markup and CSS,
  // the name row, Skip the story), drives the page's own sign, tap line and fade, and keeps the clock: one beat every 90 ms, counted,
  // so a page hidden by the lock screen or paused under the turn plate resumes where it was. The record (forge-forever:intro:<id>) is
  // proto/lessons.js's Lessons.opening, written first at the picture after the name.
  const HEARTH = { title: 1, wake: 1, name: 1, yours: 1, call: 1 };
  const GUARD = 300, TAP_AFTER = 9;   // ms a tap is ignored after a line shows; beats before the tap line shows (0.81 s)
  function param(params, k) { try { if (!params) return null; if (typeof params.get === "function") return params.get(k); return params[k] === undefined ? null : params[k]; } catch (e) { return null; } }
  const opening = () => (root.Lessons && root.Lessons.opening) || null;
  // wanted({ player, params, store }) -> { play, at, named, replay, why }
  function wanted(o) {
    o = o || {};
    const D = data(), named = !!o.player, none = why => ({ play: false, at: null, named, replay: false, why });
    if (!D || !D.panels || !D.panels.length) return none("no data");
    const intro = param(o.params, "intro");
    if (intro === "skip") return none("skip");
    if (intro === "1") return { play: true, at: null, named, replay: true, why: "replay" };
    if (intro === "play") return { play: true, at: null, named, replay: false, why: "play" };   // (the checks: the book from the cave, ?stay=1 or not)
    if (intro && intro.indexOf("at:") === 0) { const id = intro.slice(3); return D.panels.some(p => p.id === id) ? { play: true, at: id, named, replay: false, why: "at" } : none("no panel " + id); }
    if (param(o.params, "stay") === "1") return none("stay");
    if (!o.player) return { play: true, at: null, named: false, replay: false, why: "new" };
    const Op = opening(), rec = Op ? Op.load(o.player.id, o.store) : null;
    if (rec && !rec.done) return { play: true, at: Op.resumeAt(rec) || null, named: true, replay: false, why: "resume" };
    return none(rec ? "done" : "no record");
  }

  const CSS = `
.intro{position:absolute;left:0;top:0;width:100%;height:100%;z-index:1;overflow:hidden;pointer-events:none;--st:env(safe-area-inset-top,0px);--sr:env(safe-area-inset-right,0px);--sb:env(safe-area-inset-bottom,0px);--sl:env(safe-area-inset-left,0px)}
.intro-pic{position:absolute;left:0;top:0;display:block;image-rendering:pixelated;image-rendering:crisp-edges;background:#0d0a14}
.intro-story{position:absolute;left:calc(7% + var(--sl));right:calc(7% + var(--sr));bottom:calc(46px + var(--sb));margin:0;text-align:center;font-family:var(--text,Alegreya,Georgia,serif);font-size:20px;line-height:1.3;color:var(--parch,#ead4aa);text-shadow:0 1px 0 #0d0a14,1px 0 0 #0d0a14,0 -1px 0 #0d0a14,-1px 0 0 #0d0a14;text-wrap:balance}
.intro.tiny .intro-story{font-size:17px;bottom:calc(36px + var(--sb))}
.game.forced .intro-story{left:calc(7% + var(--st));right:calc(7% + var(--sb));bottom:calc(46px + var(--sl))}
.game.forced .intro.tiny .intro-story{bottom:calc(36px + var(--sl))}
.intro-story.rise{animation:intro-rise .3s steps(4,end)}
@keyframes intro-rise{from{transform:translateY(6px);opacity:0}to{transform:none;opacity:1}}
.intro .lsn-plank{left:50%;top:calc(10px + var(--st));transform:translateX(-50%);width:min(67.5%,540px);pointer-events:auto}
.game.forced .intro .lsn-plank{top:calc(10px + var(--sr))}
.intro .lsn-heading{display:none;margin:0;font-family:var(--display,"Grenze Gotisch",Georgia,serif);font-weight:800;font-size:21px;line-height:1;color:var(--ink,#3e2731)}
.intro .lsn-name{grid-column:2;display:grid;gap:5px;margin-top:4px}
.intro .lsn-name .fld{display:block;width:100%;height:38px;margin:0;padding:0 10px;font-family:var(--text,Alegreya,Georgia,serif);font-size:17px;background:var(--stone,#231c2e);color:var(--parch,#ead4aa);border:2px solid var(--oak-d,#3e2731);border-radius:0;-webkit-user-select:text;user-select:text;-webkit-appearance:none;appearance:none}
.intro .lsn-name .fld::placeholder{color:var(--dim,#8a7d6e)}
.intro .lsn-name .fld:focus-visible{outline:3px solid var(--ice,#2ce8f5);outline-offset:1px}
.intro .lsn-name .why{min-height:15px;font-family:var(--data,"Pixelify Sans",monospace);font-size:11.5px;letter-spacing:.03em;line-height:1.25;color:var(--ink3,#a22633)}
.intro .lsn-name .go{display:block;width:100%;min-height:44px;padding:0 8px;background-color:transparent;cursor:pointer;font-family:var(--display,"Grenze Gotisch",Georgia,serif);font-weight:800;font-size:20px;line-height:1;color:var(--soot,#181425);touch-action:manipulation}
.intro .lsn-name .go:disabled{opacity:.45;cursor:not-allowed}
.intro .lsn-name .go.glow{animation:intro-glow 1.1s ease-in-out infinite}
@keyframes intro-glow{50%{box-shadow:0 0 16px 5px rgba(247,118,34,.8)}}
.intro .lsn-plank.lifted{z-index:6;transform:none;width:auto}
.intro .lsn-plank.lifted .lsn-body{grid-template-columns:minmax(0,1fr);gap:4px 8px;padding:5px 10px 6px}
.intro .lsn-plank.lifted .lsn-face,.intro .lsn-plank.lifted .lsn-who,.intro .lsn-plank.lifted .lsn-words,.intro .lsn-plank.lifted .lsn-foot{display:none}
.intro .lsn-plank.lifted .lsn-heading{display:block}
.intro .lsn-plank.lifted .lsn-name{grid-column:1;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 8px;margin:0}
.intro .lsn-plank.lifted .lsn-name .fld{grid-column:1;grid-row:1}
.intro .lsn-plank.lifted .lsn-name .go{grid-column:2;grid-row:1;width:auto;min-height:38px;padding:0 14px;font-size:19px}
.intro .lsn-plank.lifted .lsn-name .why{grid-column:1/-1;grid-row:2;min-height:0}
.intro .lsn-plank.lifted .lsn-name .why:empty{display:none}
.intro-skip{position:absolute;right:calc(12px + var(--sr));top:calc(10px + var(--st));z-index:5;pointer-events:auto;border:0;margin:0;padding:3px 7px;background:rgba(13,10,20,.55);font-family:var(--data,"Pixelify Sans",monospace);font-size:11.25px;letter-spacing:.06em;color:var(--parch,#ead4aa);text-decoration:underline;cursor:pointer;touch-action:manipulation}
.game.forced .intro-skip{right:calc(12px + var(--sb));top:calc(10px + var(--sr))}
.game.book .menu{pointer-events:none}
.still .intro *,.intro.still *{animation:none!important;transition:none!important}
@media (prefers-reduced-motion:reduce){.intro *{animation:none!important;transition:none!important}}
`;
  function addCSS(doc) { if (!doc || doc.getElementById("intro-css")) return; const st = doc.createElement("style"); st.id = "intro-css"; st.textContent = CSS.trim(); (doc.head || doc.documentElement).appendChild(st); }
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const rich = (s, name) => esc(s || "").replace(/&lt;(\/?)(em|b)&gt;/g, "<$1$2>").replace(/\{name\}/g, esc(name || "Outlander"));
  const plain = s => String(s || "").replace(/<[^>]+>/g, "");
  const isoNow = () => new Date().toISOString().replace(/\.\d+Z$/, "Z");

  // mount(game, o): o = { still (bool or fn), size() -> { w, h } (CSS px of the game root), desktop, player, at, named, replay, scene (a
  // Hearth.Scene or a function giving one: the menu's own fire), sign, tapLine, fade (the page's elements), band() (what the keyboard
  // leaves, the menu's own measure), store, onName(name) -> record, onDone(), onBack(), onSkip(panelId, label) }
  function mount(game, o) {
    if (!game || !game.ownerDocument) return null;
    o = o || {};
    const doc = game.ownerDocument, win = doc.defaultView || root;
    const D = data(), PANELS = D.panels || [], WORDS = D.words || {};
    if (!PANELS.length) return null;
    const Ls = root.Lessons || null, Sm = root.Smith || null, Hh = root.Hearth || null;
    if (Ls && Ls.addCSS) Ls.addCSS(doc);
    addCSS(doc);
    const still = () => typeof o.still === "function" ? !!o.still() : !!o.still;
    const desktop = !!o.desktop;
    const dprOf = () => (win.devicePixelRatio > 0 ? win.devicePixelRatio : 1);
    const report = e => { try { (win.__errors || (win.__errors = [])).push("intro: " + (e && e.message || e)); if (doc.body) doc.body.setAttribute("data-errors", String(win.__errors.length)); } catch (x) { /* no list */ } };
    const now = () => Date.now();
    // the layer: before the menu's grid, so the page's sign stands above the picture on the title card
    const layer = doc.createElement("div"); layer.className = "intro"; layer.setAttribute("aria-label", "The opening");
    const canvas = doc.createElement("canvas"); canvas.className = "intro-pic"; canvas.setAttribute("role", "img"); canvas.setAttribute("aria-label", "The story's picture");
    const story = doc.createElement("p"); story.className = "intro-story"; story.hidden = true; story.setAttribute("aria-live", "polite");
    const box = doc.createElement("div"); box.className = "lsn-plank talk intro-box"; box.hidden = true; box.setAttribute("role", "status"); box.setAttribute("aria-live", "polite");
    box.innerHTML = `<div class="lsn-body"><canvas class="lsn-face" width="16" height="16" aria-hidden="true"></canvas><h2 class="lsn-heading"></h2><span class="lsn-who"></span><p class="lsn-words"></p><div class="lsn-foot"><span class="lsn-tap"></span></div><div class="lsn-name" hidden><input class="fld" type="text" maxlength="16" autocomplete="off" autocapitalize="words" autocorrect="off" spellcheck="false" enterkeyhint="go"><div class="why" aria-live="polite"></div><button type="button" class="go f-ember" disabled></button></div><button type="button" class="lsn-btn f-ember" hidden></button></div>`;
    const skipBtn = doc.createElement("button"); skipBtn.type = "button"; skipBtn.className = "intro-skip lsn-skip"; skipBtn.hidden = true; skipBtn.textContent = WORDS.skip || "Skip the story";
    layer.append(canvas, story, box, skipBtn);
    const menuEl = game.querySelector(".menu");
    if (menuEl && menuEl.parentNode === game) game.insertBefore(layer, menuEl); else game.appendChild(layer);
    const ctx = canvas.getContext("2d");
    const faceCv = box.querySelector(".lsn-face"), heading = box.querySelector(".lsn-heading"), whoEl = box.querySelector(".lsn-who"), wordsEl = box.querySelector(".lsn-words"), foot = box.querySelector(".lsn-foot"), tapEl = box.querySelector(".lsn-tap");
    const nameRow = box.querySelector(".lsn-name"), field = nameRow.querySelector(".fld"), why = nameRow.querySelector(".why"), go = nameRow.querySelector(".go"), btn = box.querySelector(".lsn-btn");
    field.placeholder = WORDS.field || "A name"; field.setAttribute("aria-label", WORDS.field || "A name"); go.textContent = WORDS.button || "Call me that"; heading.textContent = WORDS.heading || "What do I call you?";
    const FACES = faces();
    function drawFace(who) { const px = FACES[who === "you" ? "you" : "grycus"], g = faceCv.getContext("2d"); g.clearRect(0, 0, 16, 16); g.fillStyle = "#2c2540"; g.fillRect(0, 0, 16, 16); if (!px) return; px.forEach((c, i) => { if (c) { g.fillStyle = c; g.fillRect(i % 16, Math.floor(i / 16), 1, 1); } }); }
    const tapWas = o.tapLine ? o.tapLine.textContent : "";

    // ---------------------------------------------------------------- the state
    const at0 = o.at ? PANELS.findIndex(p => p.id === o.at) : -1;
    const st = { i: at0 >= 0 ? at0 : 0, line: 0, beat: 0, lineBeat: 0, panelBeat: 0, tapAt: TAP_AFTER, guard: 0, fading: false, done: false, destroyed: false, paused: false, busy: false, lifted: false,
      name: o.named && o.player ? o.player.name : "", named: !!(o.named && o.player), replay: !!o.replay, player: o.player || null,
      started: isoNow(), namedAt: null, skipped: null, skipLabel: null, k: 1, W: 1, H: 1, dpr: 1, cw: 1, ch: 1, boxes: [], skipTaps: 0, taps: 0 };
    const panel = () => PANELS[st.i], line = () => panel().lines[st.line] || { who: "narrator", words: "" };
    let img = null, own = null, raf = 0, last = 0;

    // ---------------------------------------------------------------- the picture
    function sceneNow() {
      if (!Hh) return null;
      const s = typeof o.scene === "function" ? o.scene() : o.scene;
      if (s && s.W === st.W && s.H === st.H && typeof s.renderInto === "function") return s;
      if (!own || own.W !== st.W || own.H !== st.H) { try { own = new Hh.Scene(st.W, st.H, Hh.SEED); for (let i = 0; i < own.prime; i++) own.stepFire(); } catch (e) { own = null; report(e); } }
      return own;
    }
    function paintNow(stepping) {
      if (st.destroyed) return;
      const p = panel(), t = (st.beat - st.panelBeat) * BEAT, lineT = (st.beat - st.lineBeat) * BEAT, s = still();
      let scene = null;
      if (HEARTH[p.id]) { scene = sceneNow(); if (scene && scene === own && stepping && !s) own.stepFire(); }
      try {
        const f = paint(p.id, st.W, st.H, t, { line: st.line, lineT, still: s, scene, band: p.kind === "story" ? BAND : 0 });
        if (!img || img.width !== st.W || img.height !== st.H) img = ctx.createImageData(st.W, st.H);
        img.data.set(f.rgba); ctx.putImageData(img, 0, 0);
        st.boxes = f.boxes || [];
      } catch (e) { ctx.fillStyle = SOOT; ctx.fillRect(0, 0, st.W, st.H); st.boxes = []; report("paint " + p.id + ": " + (e && e.message)); }
    }
    function refit() {
      if (st.destroyed) return;
      const want = typeof o.size === "function" ? o.size() : { w: game.clientWidth, h: game.clientHeight };
      const cw = Math.max(1, Math.round(want.w || 1)), ch = Math.max(1, Math.round(want.h || 1)), dpr = dprOf(), devW = Math.round(cw * dpr), devH = Math.round(ch * dpr);
      const k = kFor(devW, devH), W = Math.max(8, Math.ceil(devW / k)), H = Math.max(8, Math.ceil(devH / k));
      if (W !== st.W || H !== st.H) { canvas.width = W; canvas.height = H; img = null; }
      st.k = k; st.W = W; st.H = H; st.dpr = dpr; st.cw = cw; st.ch = ch;
      canvas.style.width = (W * k / dpr) + "px"; canvas.style.height = (H * k / dpr) + "px";
      layer.classList.toggle("tiny", ch <= 340);
      sizeFace();
      paintNow(false);
      lift();
    }
    function sizeFace() { const px = Ls && Ls.faceSize && Ls.FACE ? Ls.faceSize(Ls.FACE.talk, dprOf()) : 72; faceCv.style.width = faceCv.style.height = px + "px"; }
    function loop(ts) {
      if (st.destroyed) return;
      raf = win.requestAnimationFrame(loop);
      if (st.paused) { last = ts; return; }
      if (!last) last = ts;
      if (ts - last >= BEAT * 1000) { last = ts; st.beat++; if (!still()) paintNow(true); tapLine(); }
    }

    // ---------------------------------------------------------------- the words
    function tapLine() {
      if (!o.tapLine) return;
      const kind = panel().kind, show = !st.done && !st.fading && (kind === "story" || kind === "title") && st.beat >= st.tapAt;
      if (o.tapLine.hidden !== !show) o.tapLine.hidden = !show;
      const want = (WORDS.continue || {})[desktop ? "desktop" : "touch"] || "TAP TO CONTINUE";
      if (o.tapLine.textContent !== want) o.tapLine.textContent = want;
    }
    const fieldLine = l => !!l.field && !st.named && !st.replay;
    function render(entering) {
      const p = panel(), l = line(), kind = p.kind, hasField = fieldLine(l), hasBtn = !!l.button;
      if (o.sign) { const show = kind === "title"; o.sign.hidden = !show; o.sign.classList.toggle("rise", show && entering && !still()); }
      story.hidden = kind !== "story";
      if (kind === "story") { story.textContent = l.words || ""; if (entering && !still()) { story.classList.remove("rise"); void story.offsetWidth; story.classList.add("rise"); } }
      const talk = kind === "talk" || kind === "name";
      box.hidden = !talk;
      if (talk) {
        const you = l.who === "you";
        whoEl.textContent = you ? (st.name || WORDS.you || "You") : (WORDS.grycus || "Grycus");
        drawFace(you ? "you" : "grycus");
        wordsEl.innerHTML = rich(l.words, st.name);
        nameRow.hidden = !hasField; btn.hidden = !hasBtn; foot.hidden = hasField || hasBtn;
        tapEl.textContent = (WORDS.continue || {})[desktop ? "desktop" : "touch"] || "TAP TO CONTINUE";
        if (hasBtn) btn.textContent = st.replay ? (WORDS.back || "Back to the menu") : (WORDS.into || "Into the castle");
        if (hasField) { field.value = ""; why.textContent = ""; go.disabled = true; go.classList.remove("glow"); }
        if (entering && !still()) { box.classList.remove("rise"); void box.offsetWidth; box.classList.add("rise"); }
        if (entering && desktop && hasField) { try { field.focus({ preventScroll: true }); } catch (e) { /* not now */ } }
        if (entering && desktop && hasBtn) { try { btn.focus({ preventScroll: true }); } catch (e) { /* not now */ } }
      }
      skipBtn.hidden = st.i < 1 || hasField || st.done || (st.i === PANELS.length - 1 && st.line === p.lines.length - 1);
      tapLine();
      lift();
    }
    function mark() {
      const Op = opening(); if (!Op || st.replay || !st.named || !st.player || !st.player.id) return;
      try { Op.mark(st.player.id, panel().id, { now: isoNow(), started: st.started, named: st.namedAt, skipped: st.skipped, skipLabel: st.skipLabel }, o.store); } catch (e) { report(e); }
    }
    function show(i, li) {
      const changed = i !== st.i;
      st.i = i; st.line = li;
      if (changed) st.panelBeat = st.beat;
      st.lineBeat = st.beat; st.tapAt = st.beat + TAP_AFTER; st.guard = now() + GUARD;
      render(true); paintNow(false);
      if (changed) mark();
    }
    function fadeTo(i, li) {
      if (st.fading) return;
      st.fading = true; tapLine();
      if (o.fade) o.fade.classList.add("on");
      win.setTimeout(() => { if (st.destroyed) return; st.fading = false; show(i, li); if (o.fade) o.fade.classList.remove("on"); }, still() ? 0 : 260);
    }
    // the next line of the picture, skipping the name's line once the name is known (a replay, a resumed book)
    function nextLine() { const ls = panel().lines; let n = st.line + 1; while (n < ls.length && fieldLine(ls[n]) === false && ls[n].field && (st.named || st.replay)) n++; return n < ls.length ? n : -1; }
    function nudge() { if (still()) return; box.classList.remove("nudge"); void box.offsetWidth; box.classList.add("nudge"); win.setTimeout(() => box.classList.remove("nudge"), 220); }
    // tap(): a tap anywhere (the page's click on the game root, Enter, Space or the right arrow)
    function tap() {
      if (st.destroyed || st.done) return "done";
      if (st.fading) return "fading";
      st.taps++;
      if (now() < st.guard) return "guard";
      const l = line();
      if (fieldLine(l)) { nudge(); try { field.focus({ preventScroll: true }); } catch (e) { /* kept */ } return "field"; }
      if (l.button) { nudge(); return "button"; }
      const n = nextLine();
      if (n >= 0) { st.line = n; st.lineBeat = st.beat; st.tapAt = st.beat + TAP_AFTER; st.guard = now() + GUARD; render(true); if (still()) paintNow(false); return "line"; }
      if (st.i + 1 < PANELS.length) { fadeTo(st.i + 1, 0); return "panel"; }
      end(); return "end";
    }
    // skip(): before the name, to the name's line; after it (or in a replay), to the last line
    function skip() {
      if (st.destroyed || st.done || st.fading) return false;
      const p = panel(); st.skipped = p.id; st.skipLabel = p.label || p.id; st.skipTaps++;
      if (typeof o.onSkip === "function") { try { o.onSkip(p.id, p.label); } catch (e) { report(e); } }
      const ni = PANELS.findIndex(q => q.kind === "name" || q.lines.some(l => l.field));
      if (!st.named && !st.replay && ni >= 0 && st.i <= ni) fadeTo(ni, Math.max(0, PANELS[ni].lines.findIndex(l => l.field)));
      else fadeTo(PANELS.length - 1, PANELS[PANELS.length - 1].lines.length - 1);
      return true;
    }
    // the name: the plank's rules on every keystroke; the button (or Enter) makes the player through the page
    function checkName() {
      const w = Sm ? Sm.checkSmithName(field.value, root.FORGE_NAME_FILTER || null) : (field.value.trim().length >= 3 && field.value.trim().length <= 16 ? "" : "3 to 16 characters");
      go.disabled = !!w; go.classList.toggle("glow", !w && !still()); why.textContent = field.value.trim() ? w : "";
      return !w;
    }
    function submitName() {
      if (st.destroyed || st.busy || st.fading || !fieldLine(line()) || !checkName()) return false;
      const name = Sm ? Sm.cleanName(field.value) : field.value.replace(/\s+/g, " ").trim();
      let rec = null;
      try { rec = typeof o.onName === "function" ? o.onName(name) : null; } catch (e) { report(e); }
      st.player = rec && rec.id ? rec : st.player; st.name = (rec && rec.name) || name; st.named = true; st.namedAt = isoNow();
      try { field.blur(); } catch (e) { /* gone */ }
      lift();
      const n = nextLine();
      if (n >= 0) { st.line = n; st.lineBeat = st.beat; st.guard = now() + GUARD; render(true); paintNow(false); }
      else if (st.i + 1 < PANELS.length) fadeTo(st.i + 1, 0);
      else end();
      return true;
    }
    function end() {
      if (st.done || st.destroyed) return;
      st.done = true; skipBtn.hidden = true; tapLine();
      const Op = opening();
      if (!st.replay && Op && st.player && st.player.id) { try { Op.finish(st.player.id, { now: isoNow(), started: st.started, named: st.namedAt, skipped: st.skipped, skipLabel: st.skipLabel }, o.store); } catch (e) { report(e); } }
      if (st.replay) { if (typeof o.onBack === "function") { try { o.onBack(); } catch (e) { report(e); } } }
      else if (typeof o.onDone === "function") { try { o.onDone(); } catch (e) { report(e); } }
    }
    // the keyboard: while the field has the focus and the keys cover the screen, the box lifts into what is left and shrinks to the
    // heading, the field and the button (the menu plank's rule)
    function lift() {
      const b = typeof o.band === "function" ? o.band() : null;
      const on = !box.hidden && !nameRow.hidden && doc.activeElement === field && !!b && (b.h < game.clientHeight * 0.8 || b.w < game.clientWidth * 0.8 || b.h < 300);
      box.classList.toggle("lifted", on); st.lifted = on;
      if (!on) { box.style.left = box.style.top = box.style.width = ""; return; }
      const w = Math.max(220, Math.min(b.w - 16, 420));
      box.style.width = w + "px";
      const h = box.offsetHeight;
      box.style.left = Math.round(b.x + Math.max(8, (b.w - w) / 2)) + "px";
      box.style.top = Math.round(b.y + Math.max(4, (b.h - h) / 2)) + "px";
    }
    let liftRaf = 0;
    const liftSoon = () => { if (liftRaf || st.destroyed) return; liftRaf = win.requestAnimationFrame(() => { liftRaf = 0; lift(); }); };
    const stop = e => e.stopPropagation();
    field.addEventListener("input", checkName);
    field.addEventListener("click", stop);
    field.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); submitName(); } });
    field.addEventListener("focus", () => { lift(); liftSoon(); });
    field.addEventListener("blur", () => win.setTimeout(lift, 0));
    go.addEventListener("click", e => { e.stopPropagation(); submitName(); });
    btn.addEventListener("click", e => { e.stopPropagation(); if (!st.fading) end(); });
    skipBtn.addEventListener("click", e => { e.stopPropagation(); skip(); });
    if (win.visualViewport) { win.visualViewport.addEventListener("resize", liftSoon); win.visualViewport.addEventListener("scroll", liftSoon); }

    // ---------------------------------------------------------------- the API
    const boxIn = el => (Ls && Ls.boxIn ? Ls.boxIn(el, game) : null);
    const toCss = b => { const s = st.k / st.dpr; return { who: b.who || null, x: b.x0 * s, y: b.y0 * s, w: (b.x1 - b.x0 + 1) * s, h: (b.y1 - b.y0 + 1) * s }; };
    const api = {
      tap, skip, refit, submitName, checkName,
      pause(on) { st.paused = !!on; if (!st.paused) last = 0; },
      destroy() {
        if (st.destroyed) return; st.destroyed = true;
        if (raf) win.cancelAnimationFrame(raf);
        if (win.visualViewport) { win.visualViewport.removeEventListener("resize", liftSoon); win.visualViewport.removeEventListener("scroll", liftSoon); }
        layer.remove();
        if (o.sign) { o.sign.hidden = false; o.sign.classList.remove("rise"); }
        if (o.tapLine) o.tapLine.textContent = tapWas;
      },
      get layer() { return layer; }, get field() { return field; }, get button() { return btn; }, get skipLink() { return skipBtn; },
      get state() {
        const p = panel(), l = line();
        return { panel: p.id, index: st.i, line: st.line, lines: p.lines.length, kind: p.kind, label: p.label, who: box.hidden ? (story.hidden ? "" : "narrator") : whoEl.textContent, words: box.hidden ? (story.hidden ? "" : story.textContent) : plain(wordsEl.innerHTML).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"'),
          speaker: l.who, name: st.name, named: st.named, replay: st.replay, done: st.done, fading: st.fading, paused: st.paused, beat: st.beat, t: (st.beat - st.panelBeat) * BEAT, lineT: (st.beat - st.lineBeat) * BEAT,
          k: st.k, W: st.W, H: st.H, cw: st.cw, ch: st.ch, dpr: st.dpr, still: still(), box: box.hidden ? null : boxIn(box), story: story.hidden ? null : boxIn(story), figures: st.boxes.map(toCss),
          skip: !skipBtn.hidden, tapLine: !!(o.tapLine && !o.tapLine.hidden), field: !nameRow.hidden, button: !btn.hidden, buttonText: btn.hidden ? "" : btn.textContent, lifted: st.lifted, sign: !!(o.sign && !o.sign.hidden), skipped: st.skipped, taps: st.taps, player: st.player };
      }
    };
    // ---------------------------------------------------------------- go
    if (o.tapLine) o.tapLine.hidden = true;
    if (o.sign) o.sign.hidden = true;
    refit();
    show(st.i, 0);
    if (st.named && !st.replay) mark();   // (a book resumed, or started at a picture for the checks: the record knows this picture)
    raf = win.requestAnimationFrame(loop);
    return api;
  }

  const Intro = { KEY_PREFIX: "forge-forever:intro:", wanted, mount, addCSS, HEARTH, GUARD, TAP_AFTER, BEAT, version: 1 };
  if (typeof module !== "undefined" && module.exports) module.exports = { IntroArt, Intro };
  else { root.IntroArt = IntroArt; root.Intro = Intro; }
})(typeof window !== "undefined" ? window : globalThis);
