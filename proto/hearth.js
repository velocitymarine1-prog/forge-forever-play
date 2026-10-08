// FORGE FOREVER: hearth.js (design pass 28, card t86, build 18): the front door's hearth. The main menu's ground: the forge itself, close up:
// the hearth's stone mouth with the fire burning in it, the anvil on its stump in front of it, and nothing else, lit by the fire alone.
// Painted in code at any width and height by the smithy's own rules (proto/smithy.js: its stone and its flagstones, its doom fire, its
// dithered firelight, a soot outline round the anvil, the light from the top left), at the Forge's own pixel size (the picture's long side
// at most 256 world pixels, so the menu's pixels are the smithy's). Plain script, defines window.Hearth; needs proto/smithy.js before it.
// layout(), paint() and frame() need no DOM, so node can test them and the design page can draw them.
//
//   Hearth.kFor(devW, devH)            device pixels per world pixel for a screen of that many device pixels (the long side at most 256)
//   Hearth.layout(W, H)                where everything is in a picture of W x H world pixels (the floor, the mouth, the anvil, the light)
//   Hearth.paint(W, H, seed)           the still picture: { base: colours, lit, dist, L } (pure: the same call gives the same picture)
//   Hearth.frame(W, H, seed, steps, t) the picture after that many steps of the fire, lit for the time t, as RGBA bytes (pure)
//   Hearth.mount(canvas, { still, size, seed })   the scene over the whole screen at whole device pixels; refit(), stop(), layout, frame
(function (root) {
  "use strict";
  const SEED = 1209;   // the smithy's own seed: the same bricks
  const OUT = "#181425", SOOT = "#0d0a14";
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
  const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // the smithy's tones (proto/smithy.js TONES and its fire ramp), named here so the picture reads without it too
  const FIRE = ["#120e1a", "#3e1420", "#a22633", "#e43b44", "#f77622", "#feae34", "#fee761", "#fff6c8"];
  const IRON = ["#262b44", "#3a4466", "#5a6988", "#8b9bb4", "#c0cbdc"];
  const OAK = ["#3e2731", "#733e39", "#b86f50", "#e4a672"];
  const STONE = { face: "#555064", lit: "#6e6a70", joint: "#231c2c", mantel: ["#8b9bb4", "#5a6988", "#262b44"], hood: ["#4a4458", "#3a3448", "#2c2638", "#1e1828"] };
  const MOUTH = { dark: "#120e1a", bed: "#2a1418" };
  const WALL = { tones: ["#2f2940", "#383049", "#403752", "#352d45"], course: "#4a4060", under: "#262036", side: "#453b58", joint: "#1e1828" };
  const FLOOR = { tones: ["#3b2f36", "#382c33", "#3e3139"], lit: "#4a3c40", joint: "#241c26", shade: "#2e242c", edge: "#5a4a4a" };
  const GLOW = [247, 118, 34], LEVELS = [0, 0.14, 0.28, 0.42, 0.5];   // the smithy's firelight: four dithered steps toward the ember
  const SHADE = [0, 0.25, 0.5, 0.7];                                   // and, past its reach, four dithered steps toward soot
  const SPARK = ["#a22633", "#f77622", "#feae34", "#fee761"];        // an ember's colours from its last breath to its first
  const PALETTE = Array.from(new Set([OUT, SOOT].concat(FIRE, IRON, OAK, STONE.mantel, STONE.hood, [STONE.face, STONE.lit, STONE.joint, MOUTH.dark, MOUTH.bed], WALL.tones, [WALL.course, WALL.under, WALL.side, WALL.joint], FLOOR.tones, [FLOOR.lit, FLOOR.joint, FLOOR.shade, FLOOR.edge])));

  // kFor(devW, devH): device pixels per world pixel for a screen of that many device pixels. The long side is at most 256 world pixels,
  // the Forge's own size (its room is 112 tall), so an iPhone sideways (2532 x 1170) is 10 and the picture 254 x 117, a 1280 x 800
  // desktop at 2 device pixels 10 (256 x 160), a 1920 x 1080 monitor 8 (240 x 135), an SE 6 (223 x 125)
  function kFor(devW, devH) { return Math.max(1, Math.ceil(Math.max(devW | 0, devH | 0, 1) / 256)); }

  // layout(W, H): where everything stands, in world pixels, by the height (the title takes the top quarter of the screen, the tap line
  // the bottom tenth, so the hearth is laid out between). The floor takes the bottom fifth; the hearth is centred, its mouth a quarter
  // of the height each side of the middle (less on a picture too narrow for that) and 46 % of the height from the crown of its
  // elliptical arch to the floor; the block round it, a mantel shelf, and a hood up behind the title; the anvil in front of the mouth,
  // nine tenths of its width, on an oak stump that stands into the floor, with a third of the mouth's height of flame above its face;
  // the fire's light from the mouth's belly, reaching nine tenths of the height
  function layout(W, H) {
    W = Math.max(1, W | 0); H = Math.max(1, H | 0);
    const cx = Math.floor(W / 2);
    const floorY = Math.max(2, H - Math.round(H * 0.2));
    const mhw = Math.max(5, Math.min(Math.round(H * 0.26), Math.round(W * 0.19)));
    const mouthH = Math.max(6, Math.min(Math.round(H * 0.46), Math.round(mhw * 2.2)));   // the crown of the arch to the floor
    const crown = floorY - mouthH;
    const archH = Math.max(2, Math.min(Math.round(mhw * 0.45), mouthH >> 1));
    const mouthTop = crown + archH;
    const hw = mhw + Math.max(5, Math.round(mhw * 0.4));
    const hTop = crown - Math.max(3, Math.round(H * 0.04));
    const mantel = { y0: hTop - 4, y1: hTop - 1, x0: cx - hw - 2, x1: cx + hw + 2 };
    const hood = { y0: 0, y1: hTop - 5, hwAt: y => Math.max(Math.round(mhw * 0.7), hw + 1 - Math.floor((hTop - 5 - y) / 3)) };
    const A = Math.max(8, Math.round(mhw * 1.8)), Ah = Math.max(4, Math.round(A * 0.38)), st = Math.max(3, Math.round(H * 0.085));
    const stump = { x0: cx - Math.round(A * 0.23), x1: cx + Math.round(A * 0.23), y0: floorY - st, y1: Math.min(H - 1, floorY + Math.round(st * 0.6)) };
    const ay = floorY - st + 2 - Ah;
    const anvil = { x0: cx - Math.round(A * 0.54), x1: cx - Math.round(A * 0.54) + A - 1, y0: ay, y1: ay + Ah - 1, A, Ah, top: { x: cx, y: ay } };
    const light = { x: cx, y: mouthTop + Math.round((floorY - mouthTop) * 0.55), R: Math.max(8, Math.round(H * 0.9)) };
    const fire = { x0: cx - mhw, x1: cx + mhw, y0: crown, y1: floorY - 1, w: 2 * mhw + 1, h: floorY - crown };
    return { W, H, cx, floorY, mhw, mouthH, mouthTop, archH, crown, hw, hTop, mantel, hood, anvil, stump, light, fire };
  }

  // the wall and the floor are the smithy's own helpers when smithy.js is here (the same bricks), else drawn here the same way
  function bricks(p, r, W, top, bottom) {
    const S = root.Smithy; if (S && S.bricks) return S.bricks(p, r, W, top, bottom);
    const tones = WALL.tones;
    for (let row = 0; top + row * 7 < bottom; row++) {
      const y0 = top + row * 7, off = row % 2 ? 7 : 0;
      for (let bx = -off; bx < W; bx += 14 + ((row * 3 + bx) % 3 === 0 ? 2 : 0)) {
        const t = tones[Math.floor(r() * tones.length)], bw = 13;
        p.fill(bx, y0, bx + bw, y0 + 5, (x, y) => y === y0 ? WALL.course : x === bx ? WALL.side : t);
        if (r() < 0.12) { const kx = bx + 3 + Math.floor(r() * 7); p.set(kx, y0 + 2, WALL.joint); p.set(kx + 1, y0 + 3, WALL.joint); }
        p.fill(bx, y0 + 6, bx + bw + 1, y0 + 6, WALL.joint); p.fill(bx + bw + 1, y0, bx + bw + 1, y0 + 5, WALL.joint); p.fill(bx, y0 + 5, bx + bw, y0 + 5, WALL.under);
      }
    }
  }
  function flagstones(p, W, floorY, H) {
    const S = root.Smithy; if (S && S.flagstones) return S.flagstones(p, W, floorY, H);
    for (let y = floorY; y < H; y++) for (let x = 0; x < W; x++) {
      const row = Math.floor((y - floorY) / 5), off = row % 2 ? 9 : 0, seam = (x + off) % 18 === 0 || (y - floorY) % 5 === 0;
      p.set(x, y, y === floorY ? FLOOR.edge : seam ? FLOOR.joint : FLOOR.tones[(x * 7 + row * 3) % 3]);
    }
  }
  // the firelight (the smithy's glow): how far a pixel goes toward the ember for a closeness k, in four dithered steps
  function glow(k, x, y) { const lvl = Math.floor(k * 4 + bayer(x, y) - 0.5); return LEVELS[Math.max(0, Math.min(4, lvl))]; }
  // the shade past the light's reach: how far a pixel falls toward soot for a farness f (0 at the light's edge, 1 well beyond)
  function shade(f, x, y) { const lvl = Math.floor(f * 3 + bayer(x, y) - 0.5); return SHADE[Math.max(0, Math.min(3, lvl))]; }

  // the anvil: a London pattern seen from the front, drawn as one shape at any size (its face, the horn on the left, the waist, the
  // flared foot) and shaded by the pixel rules: the face's top row the brightest steel, the row under it the next, the left edges lit,
  // the right and lower edges dark, a soot outline all round
  function anvilAt(L, x, y) {
    const a = L.anvil, X = (x + 0.5 - a.x0) / a.A, Y = (y + 0.5 - a.y0) / a.Ah;
    if (X < 0 || X >= 1 || Y < 0 || Y >= 1) return false;
    if (Y < 0.3) { if (X >= 0.24) return true; const t = X / 0.24; return Y >= 0.06 && Y < 0.06 + 0.24 * Math.pow(t, 0.75); }   // the face, and the horn tapering to its tip
    if (Y < 0.6) return X >= 0.37 && X < 0.79;                                                                              // the waist
    const f = (Y - 0.6) / 0.4; return X >= 0.3 - 0.07 * f && X < 0.86 + 0.07 * f;                                           // the foot, flaring
  }

  // paint(W, H, seed): the still picture. base[i] is the colour of pixel i (null never happens); lit[i] is 0 in the mouth, where the fire
  // is drawn, and 1 everywhere the fire's light falls; dist[i] is each pixel's distance from the fire for the light
  function paint(W, H, seed) {
    const L = layout(W, H); W = L.W; H = L.H;
    const r = rng(seed === undefined ? SEED : seed);
    const base = new Array(W * H).fill(OUT), lit = new Uint8Array(W * H).fill(1);
    const set = (x, y, c, l) => { if (x >= 0 && y >= 0 && x < W && y < H && c) { base[y * W + x] = c; if (l !== undefined) lit[y * W + x] = l; } };
    const fill = (x0, y0, x1, y1, f) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const c = typeof f === "function" ? f(x, y) : f; if (c) set(x, y, c); } };
    const p = { set, fill };
    const { cx, floorY, mhw, mouthTop, archH, hw, hTop, mantel, hood, anvil, stump } = L;
    // 1. the wall and the floor
    bricks(p, r, W, 0, floorY);
    flagstones(p, W, floorY, H);
    // 2. the hood: a stone chimney widening down to the mantel, its courses darker up into the soot
    for (let y = hood.y0; y <= hood.y1; y++) { const h = hood.hwAt(y); for (let x = cx - h; x <= cx + h; x++) {
      const d = hood.y1 - y, c = (x + y * 2) % 11 === 0 ? STONE.hood[1] : y % 6 === 0 ? STONE.hood[2] : d > 36 ? STONE.hood[3] : d > 18 ? STONE.hood[1] : STONE.hood[0];
      set(x, y, x === cx - h || x === cx + h ? OUT : c); } }
    // 3. the mantel shelf, proud of the block
    fill(mantel.x0, mantel.y0, mantel.x1, mantel.y1, (x, y) => x === mantel.x0 || x === mantel.x1 ? OUT : y === mantel.y0 ? STONE.mantel[0] : y === mantel.y1 ? STONE.mantel[2] : STONE.mantel[1]);
    // 4. the block: stone courses with their joints, the mouth cut out of it (dark, its bed of ash at the foot), and a soot outline
    const inMouth = (x, y) => Math.abs(x - cx) <= mhw && y < floorY && (y >= mouthTop || Math.pow((x - cx) / mhw, 2) + Math.pow((y - mouthTop) / archH, 2) <= 1);
    for (let y = hTop; y < floorY; y++) for (let x = cx - hw; x <= cx + hw; x++) {
      if (inMouth(x, y)) { set(x, y, y > floorY - 5 ? MOUTH.bed : MOUTH.dark, 0); continue; }
      const course = Math.floor((y - hTop) / 6), off = course % 2 ? 5 : 0, joint = (x - cx + 60 + off) % 10 === 0 || (y - hTop) % 6 === 5;
      set(x, y, joint ? STONE.joint : (y - hTop) % 6 === 0 ? STONE.lit : STONE.face);
    }
    for (let y = hTop; y < floorY; y++) { set(cx - hw - 1, y, OUT); set(cx + hw + 1, y, OUT); }
    for (let y = hTop - 1; y < floorY; y++) for (let x = cx - hw; x <= cx + hw; x++) if (!inMouth(x, y) && (inMouth(x - 1, y) || inMouth(x + 1, y) || inMouth(x, y - 1))) set(x, y, OUT);
    // 5. the stump: an oak block standing into the floor, lit from the left, a soot outline
    fill(stump.x0, stump.y0, stump.x1, stump.y1, (x, y) => x === stump.x0 || x === stump.x1 || y === stump.y1 ? OUT : y === stump.y0 ? OAK[3] : y === stump.y0 + 1 ? OAK[2] : x < stump.x0 + Math.round((stump.x1 - stump.x0) * 0.3) ? OAK[2] : x > stump.x1 - Math.round((stump.x1 - stump.x0) * 0.3) ? OAK[0] : (x * 5 + y * 3) % 17 === 0 ? OAK[0] : OAK[1]);
    // 6. the anvil, over the stump and the mouth
    const on = (x, y) => anvilAt(L, x, y);
    for (let y = anvil.y0 - 1; y <= anvil.y1 + 1; y++) for (let x = anvil.x0 - 1; x <= anvil.x1 + 1; x++) {
      if (on(x, y)) {
        const edgeR = !on(x + 1, y), edgeD = !on(x, y + 1), edgeL = !on(x - 1, y), top = !on(x, y - 1);
        let c = IRON[1];
        if (top) c = IRON[4]; else if (!on(x, y - 2)) c = IRON[3]; else if (edgeR || edgeD) c = IRON[0]; else if (edgeL) c = IRON[2];
        set(x, y, c, 1);
      } else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) set(x, y, OUT, 1);
    }
    // 7. the light: each pixel's distance from the fire's belly (the smithy's own weighting: wider than tall)
    const dist = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) dist[y * W + x] = Math.hypot((x - L.light.x) * 0.9, (y - L.light.y) * 1.2);
    return { W, H, base, lit, dist, L };
  }

  // the fire: the smithy's doom fire in the mouth (intensities 0 to 36 over its eight colours), stepped on the page's clock
  function Scene(W, H, seed) {
    const p = paint(W, H, seed);
    this.W = p.W; this.H = p.H; this.L = p.L; this.base = p.base; this.lit = p.lit; this.dist = p.dist;
    this.rgb = this.base.map(hex);
    const f = this.L.fire;
    this.fw = f.w; this.fh = f.h; this.top = 36; this.fire = new Uint8Array(this.fw * this.fh);
    // each row cools the flame by one with this chance, so the 36 steps from white to dark are spread over 92 % of the mouth's height
    // whatever that is (the smithy's own 40-row fire cools faster and flatter); the bed, the bottom quarter, cools at half that
    this.d = Math.min(1, 37.9 / f.h); this.prime = f.h + 16;
    this.fr = rng((seed === undefined ? SEED : seed) + 77);
    this.pal = []; for (let i = 0; i <= this.top; i++) { const t = i / this.top * (FIRE.length - 1), a = Math.floor(t), b = Math.min(FIRE.length - 1, a + 1), q = t - a, A = hex(FIRE[a]), B = hex(FIRE[b]); this.pal.push([Math.round(A[0] + (B[0] - A[0]) * q), Math.round(A[1] + (B[1] - A[1]) * q), Math.round(A[2] + (B[2] - A[2]) * q)]); }
    this.steps = 0;
  }
  Scene.prototype.stepFire = function () {
    const w = this.fw, h = this.fh, f = this.fire, r = this.fr, top = this.top;
    for (let x = 0; x < w; x++) { const edge = Math.min(x, w - 1 - x); f[(h - 1) * w + x] = edge < 3 ? Math.round(top * 0.4) : top; }
    const d = this.d, bed = h * 0.75;
    for (let y = 1; y < h; y++) for (let x = 0; x < w; x++) { const src = y * w + x, v = f[src], rnd = Math.floor(r() * 3), dst = src - w - rnd + 1; if (dst >= 0 && dst < w * h) f[dst] = r() < (y >= bed ? d * 0.5 : d) ? Math.max(0, v - 1) : v; }
    this.steps++;
  };
  // renderInto(data, t): the lit picture at time t (seconds) into RGBA bytes: the fire where the mouth is, the firelight on everything
  // else, flickering a little with t, and the shade toward soot past its reach
  Scene.prototype.renderInto = function (d, t) {
    const W = this.W, H = this.H, L = this.L, f = L.fire, R0 = L.light.R;
    const R = R0 * (1 + 0.04 * Math.sin(t * 7.3) + 0.025 * Math.sin(t * 13.1));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; let [r, g, b] = this.rgb[i];
      if (!this.lit[i]) {
        const fx = x - f.x0, fy = y - f.y0, v = fx >= 0 && fx < this.fw && fy >= 0 && fy < this.fh ? this.fire[fy * this.fw + fx] : 0;
        if (v > 2) [r, g, b] = this.pal[v];
      } else {
        const k = 1 - this.dist[i] / R;
        if (k > 0) { const m = glow(k, x, y); r += (GLOW[0] - r) * m; g += (GLOW[1] - g) * m * 0.9; b += (GLOW[2] - b) * m * 0.8; }
        else { const s = shade(Math.min(1, -k * 2.2), x, y); r += (13 - r) * s; g += (10 - g) * s; b += (20 - b) * s; }
      }
      const o = i * 4; d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
    }
    return d;
  };
  Scene.prototype.render = function (ctx, t) { const img = ctx.createImageData(this.W, this.H); this.renderInto(img.data, t); ctx.putImageData(img, 0, 0); return img; };
  // frame(W, H, seed, steps, t): the picture after so many steps of the fire, lit for the time t, as RGBA bytes (pure)
  function frame(W, H, seed, steps, t) { const sc = new Scene(W, H, seed); for (let i = 0; i < (steps === undefined ? sc.prime : steps); i++) sc.stepFire(); const d = new Uint8ClampedArray(sc.W * sc.H * 4); sc.renderInto(d, t || 0); return { rgba: d, W: sc.W, H: sc.H, L: sc.L, steps: sc.steps }; }

  // mount(canvas, { still, seed, size }): the scene over the whole viewport (or the box size() returns in CSS pixels: the menu's game
  // root, which may be turned a quarter) at a whole number of device pixels per world pixel, repainted by refit() when the viewport
  // changes. The fire steps every 90 ms on the page's own clock, as the Forge's does, with a few embers rising out of it; still (less
  // motion) draws the fire once, after forty steps, and no embers
  function mount(canvas, o) {
    o = o || {};
    const seed = o.seed === undefined ? SEED : o.seed, still = !!o.still;
    const ctx = canvas.getContext("2d");
    const st = { stopped: false, frame: 0, layout: null, scene: null, img: null, sparks: [], sr: rng(seed + 5) };
    function refit() {
      const vv = root.visualViewport, want = typeof o.size === "function" ? o.size() : null;
      const cw = Math.max(1, Math.round(want ? want.w : (vv ? vv.width : root.innerWidth))), ch = Math.max(1, Math.round(want ? want.h : (vv ? vv.height : root.innerHeight)));
      const dpr = root.devicePixelRatio || 1, devW = Math.round(cw * dpr), devH = Math.round(ch * dpr);
      const k = kFor(devW, devH), W = Math.max(1, Math.ceil(devW / k)), H = Math.max(1, Math.ceil(devH / k));
      canvas.width = W; canvas.height = H;
      canvas.style.width = (W * k / dpr) + "px"; canvas.style.height = (H * k / dpr) + "px";
      st.scene = new Scene(W, H, seed);
      for (let i = 0; i < st.scene.prime; i++) st.scene.stepFire();   // (primed: the flames have reached the crown before the first frame)
      st.sparks = [];
      st.img = st.scene.render(ctx, 0);
      st.layout = { cw, ch, dpr, k, W, H, cssW: W * k / dpr, cssH: H * k / dpr, L: st.scene.L };
      return st.layout;
    }
    // the embers: a few bright pixels that rise out of the flames inside the mouth, drift, and go out before the arch's crown; at most
    // six alive
    function sparks() {
      const sc = st.scene, L = sc.L, r = st.sr, d = st.img.data, W = sc.W;
      if (st.sparks.length < 6 && r() < 0.35) st.sparks.push({ x: L.cx + Math.round((r() * 2 - 1) * L.mhw * 0.6), y: L.mouthTop + Math.floor(r() * (L.floorY - L.mouthTop) * 0.4), life: 10 + Math.floor(r() * 14), age: 0 });
      for (const s of st.sparks) { s.age++; s.y -= 1; if (r() < 0.4) s.x += r() < 0.5 ? -1 : 1; }
      st.sparks = st.sparks.filter(s => s.age < s.life && s.y > L.crown + 1 && Math.abs(s.x - L.cx) < L.mhw - 1);
      for (const s of st.sparks) { if (s.x < 0 || s.x >= W) continue; const left = 1 - s.age / s.life, c = hex(SPARK[Math.min(3, Math.floor(left * 4))]), o = (s.y * W + s.x) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; }
    }
    refit();
    if (!still) {
      let last = 0;
      const loop = ts => {
        if (st.stopped) return;
        if (ts - last >= 90) { last = ts; st.frame++; st.scene.stepFire(); st.img = ctx.createImageData(st.scene.W, st.scene.H); st.scene.renderInto(st.img.data, ts / 1000); sparks(); ctx.putImageData(st.img, 0, 0); }
        root.requestAnimationFrame(loop);
      };
      root.requestAnimationFrame(loop);
    }
    return { refit, stop() { st.stopped = true; }, get layout() { return st.layout; }, get frame() { return st.frame; }, get scene() { return st.scene; }, get sparks() { return st.sparks; }, still };
  }

  root.Hearth = { kFor, layout, paint, frame, mount, Scene, anvilAt, SEED, PALETTE, FIRE, OUT, SOOT, GLOW, LEVELS, SHADE };
})(typeof window !== "undefined" ? window : globalThis);
