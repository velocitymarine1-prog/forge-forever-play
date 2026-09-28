// FORGE FOREVER: the smithy (design pass 2, The Forge). The background of The Forge screen as pixel art, drawn in code:
// a stone wall, an oak beam and posts, a hearth with a live fire (the classic "doom fire" cellular automaton), a hood,
// flagstones, an anvil on a stump, bellows, a tool rack and a quench barrel, all lit by a dithered hearth glow.
// Also makes the pixel UI frames (wood panel, iron button, ember button, parchment, stone slot, shelf board, and since pass 5
// the gold plaque and the clay mold) as 9-slice data URLs for CSS border-image, and draws the crucible prop over the hearth
// (hidden, cold or lit). Plain script, defines window.Smithy. Needs no other file.
(function (root) {
  "use strict";
  const OUT = "#181425";
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ------------------------------------------------------------------ the scene
  function Scene(W, H) {
    this.W = W; this.H = H; this.base = new Array(W * H).fill(null); this.lit = new Uint8Array(W * H);
    const r = rng(1209);
    const set = (x, y, c, lit) => { if (x >= 0 && y >= 0 && x < W && y < H) { this.base[y * W + x] = c; this.lit[y * W + x] = lit === undefined ? 1 : lit; } };
    const fillRect = (x0, y0, x1, y1, f) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const c = typeof f === "function" ? f(x, y) : f; if (c) set(x, y, c); } };
    this.set = set;
    const floorY = H - 20, cx = Math.floor(W / 2);
    this.floorY = floorY; this.cx = cx;

    // the wall: stone bricks, 7 px courses, each brick its own tone
    const tones = ["#2f2940", "#383049", "#403752", "#352d45"];
    for (let row = 0; row * 7 < floorY; row++) {
      const y0 = row * 7, off = row % 2 ? 7 : 0;
      for (let bx = -off; bx < W; bx += 14 + ((row * 3 + bx) % 3 === 0 ? 2 : 0)) {
        const t = tones[Math.floor(r() * tones.length)], bw = 13;
        fillRect(Math.max(0, bx), y0, Math.min(W - 1, bx + bw - 1), Math.min(floorY - 1, y0 + 5), (x, y) => y === y0 ? "#4a4060" : y === y0 + 5 ? "#262036" : x === bx ? "#453b58" : t);
        if (r() < 0.12) { const kx = bx + 3 + Math.floor(r() * 7); set(kx, y0 + 2, "#1e1828"); set(kx + 1, y0 + 3, "#1e1828"); }
      }
      fillRect(0, y0 + 6, W - 1, Math.min(floorY - 1, y0 + 6), "#1e1828");
    }
    // the floor: flagstones
    for (let y = floorY; y < H; y++) for (let x = 0; x < W; x++) {
      const row = Math.floor((y - floorY) / 5), off = row % 2 ? 9 : 0, seam = (x + off) % 18 === 0 || (y - floorY) % 5 === 0;
      set(x, y, y === floorY ? "#5a4a4a" : seam ? "#241c26" : ((x + off) % 18 < 2 || (y - floorY) % 5 === 1) ? "#4a3c40" : "#3b2f36");
    }
    // the hearth: a stone arch, a hood above, a dark mouth
    const hw = 30, hTop = 40, mouthW = 20, mouthTop = 52;
    this.hearth = { x0: cx - mouthW, x1: cx + mouthW, y0: mouthTop, y1: floorY - 1 };
    fillRect(cx - hw - 6, 12, cx + hw + 5, hTop - 1, (x, y) => { const inset = Math.floor((y - 12) / 4); if (x < cx - hw - 6 + (7 - inset) || x > cx + hw + 5 - (7 - inset)) return null;
      return y === hTop - 1 ? "#1e1828" : (x + y * 2) % 11 === 0 ? "#3a3448" : y % 6 === 0 ? "#2c2638" : "#4a4458"; });
    fillRect(cx - hw - 8, hTop - 3, cx + hw + 7, hTop, (x, y) => y === hTop - 3 ? "#8b9bb4" : y === hTop ? "#262b44" : "#5a6988");
    for (let y = hTop + 1; y < floorY; y++) for (let x = cx - hw; x <= cx + hw; x++) {
      const inMouth = Math.abs(x - cx) <= mouthW && (y >= mouthTop || Math.pow((x - cx) / mouthW, 2) + Math.pow((y - mouthTop) / 9, 2) <= 1);
      if (inMouth) { set(x, y, (y > floorY - 5) ? "#2a1418" : "#120e1a", 0); continue; }
      const course = Math.floor((y - hTop - 1) / 6), off = course % 2 ? 5 : 0, joint = (x - cx + 60 + off) % 10 === 0 || (y - hTop - 1) % 6 === 5;
      set(x, y, joint ? "#231c2c" : (y - hTop - 1) % 6 === 0 ? "#6e6a70" : "#555064");
    }
    // outline the hearth block
    for (let y = hTop + 1; y < floorY; y++) { set(cx - hw - 1, y, OUT); set(cx + hw + 1, y, OUT); }
    // the beam and posts
    fillRect(0, 0, W - 1, 7, (x, y) => y === 0 ? OUT : y === 1 ? "#b86f50" : y === 7 ? "#3e2731" : (x * 3 + y * 7) % 13 === 0 ? "#5a3030" : "#733e39");
    for (const px of [0, W - 7]) fillRect(px, 8, px + 6, floorY - 1, (x, y) => x === px ? OUT : x === px + 1 ? "#b86f50" : x === px + 6 ? "#3e2731" : (y * 5 + x) % 17 === 0 ? "#5a3030" : "#733e39");
    for (const px of [3, W - 4]) { set(px, 3, "#8b9bb4"); set(px, 4, "#262b44"); }
    // a tool rack on the left: two pegs, tongs and a hammer
    const tx = 14; fillRect(tx, 18, tx + 26, 20, (x, y) => y === 18 ? "#b86f50" : y === 20 ? "#3e2731" : "#733e39");
    for (const [x0, len] of [[tx + 4, 16], [tx + 8, 15]]) for (let i = 0; i < len; i++) { set(x0 + (i >> 3), 21 + i, "#5a6988"); set(x0 + 1 + (i >> 3), 21 + i, "#262b44"); }
    fillRect(tx + 16, 21, tx + 17, 36, "#733e39"); fillRect(tx + 13, 21, tx + 20, 24, (x, y) => y === 21 ? "#8b9bb4" : "#5a6988");
    fillRect(tx + 22, 21, tx + 22, 30, "#262b44"); fillRect(tx + 21, 31, tx + 23, 33, "#5a6988");
    // bellows by the hearth, left
    const bx = cx - hw - 20, by = floorY - 12;
    for (let y = 0; y < 10; y++) for (let x = 0; x < 16; x++) { const w = 8 - Math.abs(y - 5) * 0.6; if (Math.abs(x - 8) <= w) set(bx + x, by + y, y === 0 || y === 9 ? OUT : y % 3 === 0 ? "#3e2731" : "#733e39"); }
    fillRect(bx + 15, by + 4, bx + 19, by + 5, "#8b9bb4");
    // the quench barrel, right
    const qx = cx + hw + 10, qy = floorY - 16;
    fillRect(qx, qy, qx + 14, floorY - 1, (x, y) => x === qx || x === qx + 14 ? OUT : (y - qy) % 5 === 1 ? "#5a6988" : x < qx + 4 ? "#b86f50" : x > qx + 10 ? "#3e2731" : "#733e39");
    fillRect(qx + 1, qy, qx + 13, qy + 1, (x, y) => y === qy ? "#2ce8f5" : "#0099db");
    // the anvil on its stump, in front of the mouth
    const ay = floorY - 12;
    fillRect(cx - 7, floorY - 6, cx + 7, floorY + 5, (x, y) => x === cx - 7 || x === cx + 7 || y === floorY + 5 ? OUT : y === floorY - 6 ? "#e4a672" : x < cx - 3 ? "#b86f50" : x > cx + 3 ? "#3e2731" : "#733e39");
    const anvil = (x, y) => { const dy = y - ay; if (dy < 0 || dy > 7) return false;
      if (dy <= 2) return x >= cx - 17 + (2 - dy) * 3 && x <= cx + 13; if (dy <= 4) return x >= cx - 6 && x <= cx + 8; return x >= cx - 9 + (7 - dy) && x <= cx + 11 - (7 - dy); };
    for (let y = ay - 1; y <= ay + 8; y++) for (let x = cx - 19; x <= cx + 15; x++) {
      if (anvil(x, y)) set(x, y, y === ay ? "#c0cbdc" : !anvil(x, y + 1) || !anvil(x + 1, y) ? "#262b44" : y === ay + 1 ? "#8b9bb4" : "#3a4466");
      else if (anvil(x - 1, y) || anvil(x + 1, y) || anvil(x, y - 1) || anvil(x, y + 1)) set(x, y, OUT);
    }
    this.anvilTop = { x: cx, y: ay };
    // hearth glow: distance from the fire, precomputed
    this.dist = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) this.dist[y * W + x] = Math.hypot((x - cx) * 0.9, (y - (floorY - 8)) * 1.2);
    this.rgb = this.base.map(c => c ? hex(c) : [0, 0, 0]);
    // the fire buffer (doom fire): intensities 0..36
    this.fw = mouthW * 2 + 1; this.fh = floorY - mouthTop; this.fire = new Uint8Array(this.fw * this.fh);
    for (let x = 0; x < this.fw; x++) this.fire[(this.fh - 1) * this.fw + x] = 36;
    this.fr = rng(77);
    this.firePal = []; const stops = ["#120e1a", "#3e1420", "#a22633", "#e43b44", "#f77622", "#feae34", "#fee761", "#fff6c8"];
    for (let i = 0; i <= 36; i++) { const t = i / 36 * (stops.length - 1), a = Math.floor(t), b = Math.min(stops.length - 1, a + 1), f = t - a, A = hex(stops[a]), B = hex(stops[b]);
      this.firePal.push([Math.round(A[0] + (B[0] - A[0]) * f), Math.round(A[1] + (B[1] - A[1]) * f), Math.round(A[2] + (B[2] - A[2]) * f)]); }
    // the overlay: the crucible prop (pass 5 §3.6.3), drawn over the fire and lit by the hearth like everything else
    this.over = new Array(W * H).fill(null); this.overHot = new Uint8Array(W * H); this.crucible = "hidden";
  }
  // the crucible: an iron pot on two chains from the mantle, hanging in the hearth's mouth. Cold (dark iron, a small chained plate)
  // before level 25; lit (a glowing rim, molten metal, embers) once the Crucible wakes; hidden draws nothing.
  Scene.prototype.drawCrucible = function (mode) {
    const W = this.W, cx = this.cx, over = this.over, hot = this.overHot;
    over.fill(null); hot.fill(0); this.crucible = mode || "hidden";
    if (this.crucible === "hidden") return;
    const lit = this.crucible === "lit";
    const put = (x, y, c, h) => { if (x >= 0 && y >= 0 && x < W && y < this.H) { over[y * W + x] = hex(c); hot[y * W + x] = h ? 1 : 0; } };
    const iron = ["#262b44", "#3a4466", "#5a6988", "#8b9bb4"];
    const top = 47, bottom = 59;
    const half = y => y <= top + 1 ? 8 : Math.max(3, Math.round(8 - (y - top - 1) * 0.5));
    const inPot = (x, y) => y >= top && y <= bottom && Math.abs(x - cx + 0.5) <= half(y) - (y === bottom ? 1 : 0);
    // the chains, from under the mantle to the rim
    for (let y = 41; y < top; y++) for (const x of [cx - 6, cx + 5]) put(x, y, y % 2 ? (lit ? iron[2] : iron[1]) : iron[0]);
    // the pot, then its ink outline
    for (let y = top; y <= bottom; y++) for (let x = cx - 10; x <= cx + 10; x++) {
      if (!inPot(x, y)) continue;
      const rim = y <= top + 1, edgeL = !inPot(x - 1, y), edgeR = !inPot(x + 1, y);
      let c = rim ? (lit && y === top ? "#f77622" : iron[2]) : edgeL ? iron[2] : edgeR ? iron[0] : iron[1];
      if (lit && !rim && y <= top + 3) c = y === top + 2 ? "#a22633" : "#5a3040";
      put(x, y, c);
    }
    for (let y = top - 1; y <= bottom + 1; y++) for (let x = cx - 11; x <= cx + 11; x++)
      if (!inPot(x, y) && (inPot(x - 1, y) || inPot(x + 1, y) || inPot(x, y - 1) || inPot(x, y + 1))) put(x, y, OUT);
    if (lit) {
      // the molten metal inside the rim, and embers above it
      for (let x = cx - 6; x <= cx + 5; x++) put(x, top, Math.abs(x - cx + 0.5) < 4 ? "#fee761" : "#feae34", true);
      for (const [x, y, c] of [[cx - 3, 44, "#fee761"], [cx + 2, 43, "#f77622"], [cx + 5, 45, "#feae34"], [cx - 1, 42, "#f77622"]]) put(x, y, c, true);
    } else {
      // a small chained plate under the pot ("Wakes at level 25"; the page letters it)
      put(cx, bottom + 2, iron[1]); put(cx, bottom + 3, iron[0]);
      for (let y = bottom + 4; y <= bottom + 7; y++) for (let x = cx - 4; x <= cx + 3; x++)
        put(x, y, y === bottom + 4 || y === bottom + 7 || x === cx - 4 || x === cx + 3 ? OUT : y === bottom + 5 ? "#b86f50" : "#733e39");
    }
  };
  Scene.prototype.stepFire = function (heat) {
    const w = this.fw, h = this.fh, f = this.fire, r = this.fr; const top = heat === undefined ? 36 : Math.round(20 + 16 * Math.min(1, Math.max(0, heat)));
    for (let x = 0; x < w; x++) { const edge = Math.min(x, w - 1 - x); f[(h - 1) * w + x] = edge < 3 ? Math.round(top * 0.4) : top; }
    for (let y = 1; y < h; y++) for (let x = 0; x < w; x++) { const src = y * w + x, v = f[src], rnd = Math.floor(r() * 3), dst = src - w - rnd + 1;
      if (dst >= 0 && dst < w * h) f[dst] = Math.max(0, v - (rnd & 1) - (y < h * 0.5 ? 1 : 0)); }
  };
  Scene.prototype.render = function (ctx, t, heat) {
    const W = this.W, H = this.H, img = ctx.createImageData(W, H), d = img.data, glow = [247, 118, 34];
    const R = 62 + 8 * (heat || 0) + 3 * Math.sin(t * 7.3) + 2 * Math.sin(t * 13.1);
    const hx = this.hearth;
    const flick = Math.sin(t * 9) > 0 ? 36 : 34;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; let [r, g, b] = this.rgb[i];
      const ov = this.over[i];
      if (ov) {
        [r, g, b] = this.overHot[i] ? this.firePal[flick] : ov;
        const k = Math.max(0, 1 - this.dist[i] / R), lvl = Math.floor(k * 4 + BAYER[(y & 3) * 4 + (x & 3)] - 0.5); const m = [0, 0.14, 0.28, 0.42, 0.5][Math.max(0, Math.min(4, lvl))];
        r += (glow[0] - r) * m; g += (glow[1] - g) * m * 0.9; b += (glow[2] - b) * m * 0.8;
      } else if (x >= hx.x0 && x <= hx.x1 && y >= hx.y0 && y <= hx.y1 && !this.lit[i]) {
        const fx = x - hx.x0, fy = y - hx.y0 - (this.fh - (hx.y1 - hx.y0 + 1)); const v = fy >= 0 ? this.fire[fy * this.fw + fx] : 0;
        if (v > 2) [r, g, b] = this.firePal[v];
      } else if (this.lit[i]) {
        const k = Math.max(0, 1 - this.dist[i] / R), lvl = Math.floor(k * 4 + BAYER[(y & 3) * 4 + (x & 3)] - 0.5); const m = [0, 0.14, 0.28, 0.42, 0.5][Math.max(0, Math.min(4, lvl))];
        r += (glow[0] - r) * m; g += (glow[1] - g) * m * 0.9; b += (glow[2] - b) * m * 0.8;
      }
      const o = i * 4; d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  };
  function mount(canvas, o) {
    o = o || {}; const W = o.w || 200, H = o.h || 112, sc = new Scene(W, H);
    canvas.width = W; canvas.height = H; const ctx = canvas.getContext("2d");
    const still = o.still || (root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const state = { heat: 0, scene: sc, stop: false, crucible: o.crucible || "hidden" };
    sc.drawCrucible(state.crucible);
    for (let i = 0; i < 40; i++) sc.stepFire(0);
    sc.render(ctx, 0, 0);
    if (!still) { let last = 0; const loop = ts => { if (state.stop) return; if (ts - last > 90) { last = ts; sc.stepFire(state.heat); sc.render(ctx, ts / 1000, state.heat); state.heat *= 0.93; } requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
    state.setCrucible = mode => { state.crucible = mode; sc.drawCrucible(mode); if (still) sc.render(ctx, 0, state.heat); };
    return state;
  }

  // ------------------------------------------------------------------ pixel UI frames (9-slice, 12 x 12, slice 4)
  function frameURL(kind) {
    const S = 12, cv = document.createElement("canvas"); cv.width = S; cv.height = S; const g = cv.getContext("2d");
    const px = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
    const P = {
      plank: { edge: ["#b86f50", "#733e39", "#3e2731"], fill: "#2a1f2b", corner: "#5a6988" },
      iron: { edge: ["#8b9bb4", "#5a6988", "#262b44"], fill: "#3a4466", corner: "#c0cbdc" },
      ember: { edge: ["#fee761", "#f77622", "#a22633"], fill: "#e4572e", corner: "#fee761" },
      parchment: { edge: ["#fffaf0", "#e4a672", "#c28569"], fill: "#ead4aa", corner: null },
      slot: { edge: ["#120e1a", "#1e1828", "#4a4060"], fill: "#231c2e", corner: null },
      stone: { edge: ["#6e6a70", "#4a4450", "#262036"], fill: "#332b40", corner: null },
      gold: { edge: ["#fee761", "#feae34", "#be4a2f"], fill: "#ead4aa", corner: null },      // the legend plaque (pass 5 §3.6.3)
      clay: { edge: ["#b86f50", "#733e39", "#3e2731"], fill: "#2a1f2b", corner: "#e4a672" }   // the Crucible's molds
    }[kind];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const e = Math.min(x, y, S - 1 - x, S - 1 - y);
      if (e === 0) { px(x, y, (x === 0 || x === S - 1) && (y === 0 || y === S - 1) ? "rgba(0,0,0,0)" : OUT); continue; }
      if (e === 1) { px(x, y, x === 1 || y === 1 ? P.edge[0] : P.edge[2]); continue; }
      if (e === 2) { px(x, y, P.edge[1]); continue; }
      if (e === 3) { px(x, y, x === 3 || y === 3 ? P.edge[2] : P.edge[0]); if (kind === "parchment" || kind === "plank" || kind === "gold") px(x, y, P.edge[2]); continue; }
      px(x, y, P.fill);
    }
    if (P.corner) for (const [x, y] of [[2, 2], [S - 3, 2], [2, S - 3], [S - 3, S - 3]]) px(x, y, P.corner);
    return cv.toDataURL("image/png");
  }
  function boardURL() {
    const cv = document.createElement("canvas"); cv.width = 16; cv.height = 8; const g = cv.getContext("2d");
    const rows = ["#181425", "#e4a672", "#b86f50", "#b86f50", "#733e39", "#3e2731", "#181425", "rgba(24,20,37,0.45)"];
    rows.forEach((c, y) => { g.fillStyle = c; g.fillRect(0, y, 16, 1); });
    g.fillStyle = "#733e39"; g.fillRect(5, 2, 3, 1); g.fillStyle = "#e4a672"; g.fillRect(11, 3, 2, 1);
    return cv.toDataURL("image/png");
  }
  function brickURL() {
    const cv = document.createElement("canvas"); cv.width = 28; cv.height = 14; const g = cv.getContext("2d");
    const r = rng(5); const tones = ["#241e30", "#28213a", "#2c2540"];
    for (let row = 0; row < 2; row++) for (let bx = row ? -7 : 0; bx < 28; bx += 14) { g.fillStyle = tones[Math.floor(r() * 3)]; g.fillRect(bx, row * 7, 13, 6); g.fillStyle = "#302846"; g.fillRect(bx, row * 7, 13, 1); }
    g.fillStyle = "#1a1524"; for (const y of [6, 13]) g.fillRect(0, y, 28, 1); g.fillRect(13, 0, 1, 6); g.fillRect(6, 7, 1, 6); g.fillRect(20, 7, 1, 6);
    return cv.toDataURL("image/png");
  }
  // apply the frames as CSS custom properties on an element (usually :root)
  function installFrames(el) {
    el = el || document.documentElement;
    for (const k of ["plank", "iron", "ember", "parchment", "slot", "stone", "gold", "clay"]) el.style.setProperty("--frame-" + k, `url(${frameURL(k)})`);
    el.style.setProperty("--board", `url(${boardURL()})`);
    el.style.setProperty("--bricks", `url(${brickURL()})`);
  }

  root.Smithy = { Scene, mount, frameURL, boardURL, brickURL, installFrames };
})(typeof window !== "undefined" ? window : globalThis);
