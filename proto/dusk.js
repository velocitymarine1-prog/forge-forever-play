// FORGE FOREVER: the dusk vista (design pass 11, card t69). The main menu's background: rolling mountains at dusk, painted in code
// at any width and height from one seed, by the pixel rules of pass 2 section 3.2: the ENDESGA palette and the smithy's own stone
// tones, a one-pixel soot outline along every ridge and down every step, slopes lit where they face the sun (which is on the left, as
// the light always is in this game), dithered bands, a four-frame twinkle and nothing else moving. Plain script, defines window.Dusk;
// paint() and kFor() need no DOM, so node can test them.
(function (root) {
  "use strict";
  const SEED = 2026;
  const OUT = "#181425";
  // the sky, top to horizon; each band's top edge as a fraction of the sky's height, and how far it lifts toward the sun
  const SKY = ["#181425", "#262b44", "#3a4466", "#68386c", "#b55088", "#f6757a", "#e4a672", "#feae34", "#fee761"];
  const EDGE = [0, 0.16, 0.30, 0.44, 0.58, 0.70, 0.80, 0.90, 0.97];
  const LIFT = [0, 0, 0, 0.02, 0.05, 0.08, 0.10, 0.12, 0.12];
  // four ranges, far to near: the mean ridge (from the horizon, in s = min(W, H)), the harmonics (amplitude in s, wavelength in W),
  // the body, the lit slope, the rim under the outline where the dusk light grazes, and how deep the lit band goes
  const RANGES = [
    { base: -0.12, A: [0.070, 0.035, 0.015], L: [0.55, 0.23, 0.11], body: "#3a4466", lit: "#5a6988", rim: "#8b9bb4", depth: 2 },
    { base: 0.02, A: [0.080, 0.040, 0.018], L: [0.62, 0.27, 0.13], body: "#262b44", lit: "#3a4466", rim: "#5a6988", depth: 3 },
    { base: 0.16, A: [0.070, 0.045, 0.020], L: [0.70, 0.31, 0.15], body: "#231c2e", lit: "#2c2540", rim: "#733e39", depth: 4 },
    { base: 0.30, A: [0.050, 0.025], L: [0.80, 0.33], body: "#1e1828", lit: null, rim: "#3e2731", depth: 0 }
  ];
  const SUN = { body: "#fee761", rim: "#feae34" };
  const STAR = ["#5a6988", "#8b9bb4", "#c0cbdc"];   // faint, dim, bright: the twinkle's three steps
  const PINE = "#181425";
  // a star's brightness over sixteen steps of the 8-a-second clock (two seconds): mostly bright, a dip now and then, never a flicker
  const PATTERN = [2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 0, 1, 2, 2];
  const PALETTE = Array.from(new Set([OUT, PINE].concat(SKY, STAR, [SUN.body, SUN.rim], RANGES.flatMap(R => [R.body, R.lit, R.rim]).filter(Boolean))));
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
  const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const RGB = {};
  const rgb = h => RGB[h] || (RGB[h] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);

  // kFor(devW, devH): device pixels per world pixel for a viewport of that many device pixels. The long side is at most 512 world
  // pixels, so an iPhone sideways (2532 x 1170) is 5, a 1280 x 800 desktop at 2 device pixels 5, a 1920 x 1080 monitor 4
  function kFor(devW, devH) { return Math.max(1, Math.ceil(Math.max(devW | 0, devH | 0, 1) / 512)); }

  // putStar(data, W, H, star, frame): one star at its brightness for this frame; a big star is a three-pixel cross
  function putStar(data, W, H, s, frame) {
    const step = PATTERN[(frame + s.phase) & 15];
    const set = (x, y, c) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const o = (y * W + x) * 4, v = rgb(c); data[o] = v[0]; data[o + 1] = v[1]; data[o + 2] = v[2]; data[o + 3] = 255; };
    set(s.x, s.y, STAR[step]);
    if (s.big) { const arm = STAR[Math.max(0, step - 1)]; set(s.x - 1, s.y, arm); set(s.x + 1, s.y, arm); set(s.x, s.y - 1, arm); set(s.x, s.y + 1, arm); }
  }

  // paint(W, H, seed): the whole picture as RGBA bytes, plus where things are. Pure: the same call gives the same bytes.
  function paint(W, H, seed) {
    W = Math.max(1, W | 0); H = Math.max(1, H | 0);
    const r = rng(seed === undefined ? SEED : seed);
    const s = Math.min(W, H), hy = Math.round(0.58 * H);
    const data = new Uint8ClampedArray(W * H * 4);
    const put = (x, y, c) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const o = (y * W + x) * 4, v = rgb(c); data[o] = v[0]; data[o + 1] = v[1]; data[o + 2] = v[2]; data[o + 3] = 255; };
    // the ridges first (their phases take the seed's first numbers), so the sky knows how far down it shows
    const ridges = RANGES.map(R => {
      const ph = R.A.map(() => r() * Math.PI * 2), base = hy + R.base * s, y = new Int32Array(W);
      for (let x = 0; x < W; x++) { let v = base; for (let k = 0; k < R.A.length; k++) v += R.A[k] * s * Math.sin(2 * Math.PI * x / (R.L[k] * W) + ph[k]); y[x] = Math.round(v); }
      return y;
    });
    let skyBottom = 0; for (let x = 0; x < W; x++) if (ridges[0][x] + 1 > skyBottom) skyBottom = ridges[0][x] + 1;
    skyBottom = Math.max(1, Math.min(H, skyBottom));
    const sun = { x: Math.round(0.30 * W), y: Math.round(hy - 0.12 * s - 0.12 * s), r: Math.max(2, Math.round(0.06 * s)) };
    // 1. the sky: nine bands, their edges lifted toward the sun, a three-pixel Bayer dither across each edge
    const tops = new Float64Array(SKY.length);
    for (let x = 0; x < W; x++) {
      const g = Math.exp(-Math.pow((x - sun.x) / (0.28 * W), 2));
      for (let i = 0; i < SKY.length; i++) tops[i] = (EDGE[i] - LIFT[i] * g) * skyBottom;
      let i = 0;
      for (let y = 0; y < H; y++) {
        while (i < SKY.length - 1 && y >= tops[i + 1]) i++;
        let c = SKY[i];
        if (i < SKY.length - 1) { const d = tops[i + 1] - y; if (d < 3 && bayer(x, y) > d / 3) c = SKY[i + 1]; }
        put(x, y, c);
      }
    }
    // 2. the sun: a disc, a one-pixel rim, a dithered corona; no outline (a light has none, like the hearth's fire)
    for (let y = sun.y - sun.r - 3; y <= sun.y + sun.r + 3; y++) for (let x = sun.x - sun.r - 3; x <= sun.x + sun.r + 3; x++) {
      const d = Math.hypot(x - sun.x, y - sun.y);
      if (d <= sun.r - 1.2) put(x, y, SUN.body);
      else if (d <= sun.r) put(x, y, SUN.rim);
      else if (d <= sun.r + 2.5 && bayer(x, y) > (d - sun.r) / 2.5) put(x, y, SUN.rim);
    }
    // 3. the stars, in the top 35 % of the sky, clear of the sun and of each other; the first two are crosses
    const stars = [], want = Math.max(6, Math.round(W * H / 9000)), top = Math.max(2, Math.floor(skyBottom * 0.35));
    for (let tries = 0; stars.length < want && tries < want * 40; tries++) {
      const x = Math.floor(r() * W), y = Math.floor(r() * top);
      if (Math.hypot(x - sun.x, y - sun.y) < sun.r + 5) continue;
      if (stars.some(q => Math.abs(q.x - x) < 4 && Math.abs(q.y - y) < 4)) continue;
      stars.push({ x, y, phase: Math.floor(r() * 16), big: stars.length < 2 });
    }
    for (const q of stars) putStar(data, W, H, q, 0);
    // 4. the ranges, far to near, each painted from its ridge to the bottom over the ones behind: soot where a pixel's left, right or
    //    upper neighbour is outside the range (the outline), the rim right under the outline on a lit slope, the lit band below it
    //    with one half-dithered row into the body. A slope is lit where the ridge descends toward the left over six pixels: it faces
    //    the sun
    for (let i = 0; i < RANGES.length; i++) {
      const R = RANGES[i], rd = ridges[i];
      for (let x = 0; x < W; x++) {
        const lit = rd[Math.min(W - 1, x + 3)] - rd[Math.max(0, x - 3)] <= -1;
        for (let y = Math.max(0, rd[x]); y < H; y++) {
          const edge = y === rd[x] || (x > 0 && y < rd[x - 1]) || (x < W - 1 && y < rd[x + 1]);
          let c = R.body;
          if (edge) c = OUT;
          else {
            const d = y - rd[x];
            if (lit && d === 1) c = R.rim;
            else if (lit && R.lit && (d <= R.depth || (d === R.depth + 1 && bayer(x, y) < 0.5))) c = R.lit;
          }
          put(x, y, c);
        }
      }
    }
    // 5. pines on the foreground hill: soot silhouettes, three wide and four to six tall, against the near range behind them
    const fg = ridges[RANGES.length - 1], pines = [];
    for (let n = Math.max(2, Math.round(W / 26)); n > 0; n--) {
      const x = 2 + Math.floor(r() * Math.max(1, W - 4)), h = 4 + Math.floor(r() * 3), t = fg[x] - h;
      for (let j = 0; j < h; j++) { const w = (j < 2 || j === h - 1) ? 0 : 1; for (let dx = -w; dx <= w; dx++) put(x + dx, t + j, PINE); }
      pines.push({ x, h });
    }
    return { rgba: data, W, H, stars, sun, hy, skyBottom, ridges, pines };
  }

  // mount(canvas, { still, seed }): the vista over the whole viewport at a whole number of device pixels per world pixel, repainted
  // by refit() when the viewport changes; the stars twinkle on the 8-a-second clock unless still
  function mount(canvas, o) {
    o = o || {};
    const seed = o.seed === undefined ? SEED : o.seed, still = !!o.still;
    const ctx = canvas.getContext("2d");
    const st = { stopped: false, frame: 0, layout: null, stars: [], base: null, img: null };
    function refit() {
      const vv = root.visualViewport;
      const cw = Math.max(1, Math.round(vv ? vv.width : root.innerWidth)), ch = Math.max(1, Math.round(vv ? vv.height : root.innerHeight));
      const dpr = root.devicePixelRatio || 1, devW = Math.round(cw * dpr), devH = Math.round(ch * dpr);
      const k = kFor(devW, devH), W = Math.max(1, Math.ceil(devW / k)), H = Math.max(1, Math.ceil(devH / k));
      canvas.width = W; canvas.height = H;
      canvas.style.width = (W * k / dpr) + "px"; canvas.style.height = (H * k / dpr) + "px";
      const p = paint(W, H, seed);
      st.base = p.rgba; st.stars = p.stars;
      st.img = ctx.createImageData(W, H); st.img.data.set(p.rgba); ctx.putImageData(st.img, 0, 0);
      st.layout = { cw, ch, dpr, k, W, H, cssW: W * k / dpr, cssH: H * k / dpr, sun: p.sun, hy: p.hy, skyBottom: p.skyBottom };
      return st.layout;
    }
    refit();
    if (!still) {
      let last = 0;
      const loop = ts => {
        if (st.stopped) return;
        if (ts - last >= 120) { last = ts; st.frame++; st.img.data.set(st.base); for (const q of st.stars) putStar(st.img.data, st.img.width, st.img.height, q, st.frame); ctx.putImageData(st.img, 0, 0); }
        root.requestAnimationFrame(loop);
      };
      root.requestAnimationFrame(loop);
    }
    return { refit, stop() { st.stopped = true; }, get layout() { return st.layout; }, get frame() { return st.frame; }, get stars() { return st.stars; }, still };
  }

  root.Dusk = { paint, mount, kFor, putStar, rng, SEED, PALETTE, SKY, RANGES, STAR, SUN, PATTERN, OUT };
})(typeof window !== "undefined" ? window : globalThis);
