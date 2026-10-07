// FORGE FOREVER: the Training Cellar's art (design pass 7 sections 3.3 and 3.4, revised by card t64; built by card t65).
// The first area of the Battlegrounds, drawn in code like every Thing: a cellar of 384 x 216 pixels under the smithy, made with the
// smithy's own bricks, beam, posts, floor tones and firelight (the helpers of proto/smithy.js), with the stairs up (to the Forge until
// design pass 24, build 17; to the Courtyard since), three wall torches, a weapon rack, a chalk tally board and the rail; and the four
// kinds of training dummy (straw, the armored dummy at 48 x 48, the rail dummy, the quintain and its arm), the 3 x 5 pixel font and the
// torch flame. The left wall is plain: the door to the levels that design pass 12 cut into it is drawn only for a spec that still has one.
// The pixels are made without a DOM, so node can check them; canvases are made only when a page asks (bake, dummySprite).
// Plain script, defines window.Cellar. Needs proto/smithy.js; reads the room from spec/cellar.js (window.FORGE_CELLAR).
(function (root) {
  "use strict";
  const S = root.Smithy;
  if (!S || !S.bricks) throw new Error("cellar.js needs proto/smithy.js (the shared room helpers)");
  const OUT = S.OUT, hex = S.hex, rng = S.rng, BAYER = S.BAYER, T = S.TONES, FIRE = T.fire;
  const R = {
    steel: ["#3a4466", "#5a6988", "#8b9bb4", "#c0cbdc"], iron: T.iron, red: ["#a22633", "#e43b44", "#f6757a", "#ffd0c8"],
    leather: ["#2a1d28", "#3e2731", "#733e39", "#b86f50"], gold: ["#be4a2f", "#f77622", "#feae34", "#fee761"], wood: T.oak,
    burlap: ["#733e39", "#b86f50", "#e4a672", "#ead4aa"], straw: ["#be4a2f", "#d77643", "#feae34", "#fee761"], paper: ["#c28569", "#e4a672", "#ead4aa", "#fffaf0"]
  };

  // ------------------------------------------------------------------ canvases (only in a page)
  function canvas(w, h) { const c = root.document.createElement("canvas"); c.width = w; c.height = h; return c; }
  // a pixel array as a canvas; o.tint recolours every pixel but the outline, o.flip mirrors it
  function canvasOf(px, W, H, o) {
    o = o || {}; const c = canvas(W, H), g = c.getContext("2d");
    for (let i = 0; i < W * H; i++) { let col = px[i]; if (!col) continue; if (o.tint && col !== OUT) col = o.tint(col); const x = i % W; g.fillStyle = col; g.fillRect(o.flip ? W - 1 - x : x, (i / W) | 0, 1, 1); }
    return c;
  }

  // ------------------------------------------------------------------ a small painter over an N x N grid (the renderer's way)
  function Grid(N) { this.N = N; this.px = new Array(N * N).fill(null); }
  Grid.prototype.get = function (x, y) { const N = this.N; return x >= 0 && y >= 0 && x < N && y < N ? this.px[y * N + x] : null; };
  Grid.prototype.set = function (x, y, c) { const N = this.N; x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < N && y < N) this.px[y * N + x] = c; };
  const rect = (x0, y0, x1, y1) => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  const ell = (cx, cy, rx, ry) => (x, y) => ((x - cx) ** 2) / (rx * rx) + ((y - cy) ** 2) / (ry * ry) <= 1.02;
  const or = (...f) => (x, y) => f.some(g => g(x, y));
  // a region lit from the top left: the ramp's light tone on its upper-left edge, its dark tone on its lower-right edge
  function region(sp, pred, ramp, o) {
    o = o || {}; const N = sp.N, m = (x, y) => x >= 0 && y >= 0 && x < N && y < N && pred(x, y);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (m(x, y)) {
      const ul = !m(x - 1, y) || !m(x, y - 1), dr = !m(x + 1, y) || !m(x, y + 1);
      let c = ul && dr ? ramp[1] : dr ? ramp[0] : ul ? ramp[2] : ramp[1];
      if (o.spec && o.spec(x, y)) c = ramp[3];
      if (o.flat !== undefined) c = ramp[o.flat];
      if (o.tex) c = o.tex(x, y, c) || c;
      sp.set(x, y, c);
    }
  }
  function outline(sp) { const N = sp.N, add = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!sp.get(x, y) && (sp.get(x - 1, y) || sp.get(x + 1, y) || sp.get(x, y - 1) || sp.get(x, y + 1))) add.push([x, y]); for (const [x, y] of add) sp.set(x, y, OUT); }

  // ------------------------------------------------------------------ the room
  // spec is spec/cellar.json: { w, h, room: { seed, wallTop, wallBot, side, front, stairs, torches, torchY, rack, board, rail }, light }
  function Scene(spec) {
    spec = spec || root.FORGE_CELLAR;
    const o = spec.room || {}, W = spec.w, H = spec.h;
    this.spec = spec; this.W = W; this.H = H;
    const base = this.base = new Array(W * H).fill(null), lit = this.lit = new Uint8Array(W * H);
    const set = (x, y, c, l) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H && c) { base[y * W + x] = c; lit[y * W + x] = l === undefined ? 1 : l; } };
    const fill = (x0, y0, x1, y1, f, l) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const c = typeof f === "function" ? f(x, y) : f; if (c) set(x, y, c, l); } };
    this.set = set; this.fill = fill;
    const p = { set, fill };
    const r = rng(o.seed || 1209);
    const wallTop = o.wallTop === undefined ? 8 : o.wallTop, wallBot = o.wallBot || 64, side = o.side === undefined ? 8 : o.side, front = o.front === undefined ? 8 : o.front;
    this.wallTop = wallTop; this.wallBot = wallBot; this.side = side; this.front = front;
    // the back wall: the smithy's stone bricks
    S.bricks(p, r, W, wallTop, wallBot);
    // the floor: flagstones seen from above, in the smithy floor's tones (12 px rows of stones 18 to 30 px wide)
    for (let row = 0; wallBot + row * 12 < H; row++) {
      const y0 = wallBot + row * 12;
      let x = -Math.floor(r() * 20);
      while (x < W) {
        const w = 18 + Math.floor(r() * 13), t = T.floor[Math.floor(r() * 3)], cracked = r() < 0.1;
        fill(Math.max(0, x), y0, Math.min(W - 1, x + w - 1), Math.min(H - 1, y0 + 11), (xx, yy) => {
          if (yy === y0 || xx === x) return T.floorJoint;
          if (yy === y0 + 1 || xx === x + 1) return T.floorLit;
          if (yy === y0 + 11 || xx === x + w - 1) return T.floorShade;
          return t;
        });
        if (cracked) { let cx = x + 4 + Math.floor(r() * Math.max(1, w - 8)), cy = y0 + 3; for (let i = 0; i < 6; i++) { set(cx, cy, T.floorJoint); cx += r() < 0.5 ? 1 : 0; cy += 1; if (cy > y0 + 10) break; } }
        x += w;
      }
    }
    // a shadow dithered along the foot of the wall
    for (let y = wallBot; y < wallBot + 5; y++) for (let x = 0; x < W; x++) if (BAYER[(y & 3) * 4 + (x & 3)] < 1 - (y - wallBot) / 5) set(x, y, T.floorJoint);
    // the beam and the posts (the smithy's)
    S.beam(p, W);
    if (o.posts !== false) for (const px of [side, W - side - 7]) S.post(p, px, 8, wallBot - 1);
    // side and front walls, seen from above: a lit inner rim, dark stone, brick joints, a soot line where they meet the floor
    const topC = d => d === 0 ? T.course : d === 1 ? T.wall[3] : (d % 4 === 2 ? T.under : "#2c2638");
    if (side) {
      fill(0, 8, side - 1, H - 1, (x, y) => topC(side - 1 - x), 0);
      fill(W - side, 8, W - 1, H - 1, (x, y) => topC(x - (W - side)), 0);
      for (let y = 8; y < H - front; y++) { set(side, y, OUT, 0); set(W - side - 1, y, OUT, 0); }
      for (let y = 12; y < H - front; y += 9) { set(2, y, T.joint, 0); set(3, y, T.joint, 0); set(W - 3, y + 4, T.joint, 0); set(W - 4, y + 4, T.joint, 0); }
    }
    if (front) {
      fill(0, H - front, W - 1, H - 1, (x, y) => topC(y - (H - front)), 0);
      for (let x = side; x < W - side; x++) set(x, H - front - 1, OUT, 0);
    }
    this.props = {};
    // the door to the levels in the left wall (design pass 12, section 3.14). Design pass 24 (section 4.12, build 17) took it out of
    // spec/cellar.json, so the wall is plain; a spec that still has one gets it drawn (the twin of the build before, cached on a phone
    // while a deploy is fresh)
    if (o.door) this.door(o.door);
    if (o.stairs !== undefined && o.stairs !== null) this.stairs(o.stairs);
    this.torches = [];
    for (const tx of (o.torches || [])) this.torch(tx, o.torchY || 24);
    if (o.rack) this.rack(o.rack[0], o.rack[1]);
    if (o.board) this.board(o.board[0], o.board[1]);   // hung low enough that the HUD's top row never covers it
    if (o.rail) this.rail(o.rail[0], o.rail[1], o.rail[2]);
    this.rgb = base.map(c => c ? hex(c) : [0, 0, 0]);
    this.light = Object.assign({ radius: 58, flicker: 3, floor: 0.62, fps: 8 }, spec.light || {});
    this.frames = null;
  }
  // the stairs up (to the Courtyard since design pass 24, build 17; drawn as they were when they led to the Forge): an arched opening
  // with six steps rising into the dark, firelight on the top steps
  Scene.prototype.stairs = function (x0) {
    const set = this.set, top = 18, bot = this.wallBot - 1, w = 34, cx = x0 + w / 2;
    this.props.stairs = { x0, x1: x0 + w, y: bot };
    const inOpen = (x, y) => Math.abs(x + 0.5 - cx) <= w / 2 - 3 && (y >= top + 10 || Math.pow((x + 0.5 - cx) / (w / 2 - 3), 2) + Math.pow((y - top - 10) / 10, 2) <= 1);
    const inArch = (x, y) => Math.abs(x + 0.5 - cx) <= w / 2 && (y >= top + 10 || Math.pow((x + 0.5 - cx) / (w / 2), 2) + Math.pow((y - top - 10) / 13, 2) <= 1);
    for (let y = top - 4; y <= bot; y++) for (let x = x0 - 1; x <= x0 + w + 1; x++) {
      if (inOpen(x, y)) {
        const d = bot - y, step = Math.floor(d / 5), inStep = d % 5;
        if (Math.abs(x + 0.5 - cx) > w / 2 - 3 - step * 0.6) { set(x, y, T.dark, 0); continue; }
        let c;
        if (step > 6) c = T.dark;
        else if (inStep === 4) c = step < 3 ? T.stone[2] : step < 5 ? T.stone[1] : T.stone[0];
        else if (inStep === 3) c = step < 3 ? T.stone[1] : T.stone[0];
        else c = step < 2 ? T.wall[3] : step < 4 ? "#2a2338" : T.joint;
        set(x, y, c, step < 3 ? 1 : 0);
        const warm = Math.max(0, 1 - (y - top) / 22);
        if (warm > 0 && BAYER[(y & 3) * 4 + (x & 3)] < warm * 0.7) set(x, y, warm > 0.7 ? "#f77622" : warm > 0.4 ? "#a22633" : "#5a3040", 0);
      } else if (inArch(x, y)) {
        const ang = Math.atan2(y - top - 10, x + 0.5 - cx), seg = Math.floor((ang + Math.PI) / (Math.PI / 7));
        const edge = !inArch(x - 1, y) || !inArch(x, y - 1);
        set(x, y, edge ? "#8b9bb4" : (y < top + 10 && seg % 2) ? T.stone[2] : y >= top + 10 && Math.floor((y - top) / 6) % 2 ? T.stone[2] : T.stone[1]);
      } else if (inArch(x - 1, y) || inArch(x + 1, y) || inArch(x, y - 1)) set(x, y, OUT);
    }
  };
  // the door to the Troll Gate (design pass 12, section 3.14): in this view a side wall shows only its top, so the door reads as an
  // opening cut through the left wall's top strip at the floor's edge, as a doorway in a plan does. From y0 to y1 the strip x 0 to 7 is
  // the passage's floor, going dark to the west, with two worn steps; jamb stones above and below; an oak leaf swung open against the
  // north jamb with two iron straps; a worn sill over the floor's edge at x 8 to 9; and above the north jamb a small iron plate with the
  // trolls' smeared green hand, saying where it goes. Like the rest of that wall it is drawn with light 0, so the torches never change it.
  // o: { side: "w", y0, y1 }; the door's rectangle (x 0 to 9, y0 - 6 to y1 + 4) is the only part of the room that changes.
  // (The cellar's own spec has had no door since design pass 24, build 17: this draws one for a spec that still does.)
  Scene.prototype.door = function (o) {
    const set = this.set, y0 = o.y0 === undefined ? 88 : o.y0, y1 = o.y1 === undefined ? 112 : o.y1;
    this.props.door = { side: o.side || "w", x0: 0, x1: 9, y0: y0 - 6, y1: y1 + 4, open: { y0, y1 } };
    for (let y = y0; y <= y1; y++) for (let x = 0; x <= 7; x++) set(x, y, x <= 1 ? T.dark : x <= 4 ? "#1b1525" : "#231c2e", 0);   // the passage (the stone of the page's gutters), darker to the west
    for (let y = y0 + 4; y <= y1; y++) { set(2, y, T.oak[0], 0); set(5, y, T.oak[0], 0); }                                        // two worn steps
    for (const y of [y0 - 2, y0 - 1, y1 + 1, y1 + 2]) for (let x = 0; x <= 7; x++) set(x, y, y === y0 - 2 || y === y1 + 1 ? T.course : T.under, 0);   // the jamb stones
    for (let y = y0 + 1; y <= y0 + 3; y++) for (let x = 0; x <= 7; x++) set(x, y, T.oak[y - y0], 0);                                  // the oak leaf, swung open against the north jamb
    for (const x of [2, 5]) for (let y = y0 + 1; y <= y0 + 3; y++) set(x, y, "#3a4466", 0);                                          // its two iron straps
    for (let y = y0; y <= y1; y++) { set(8, y, T.wall[3], 0); set(9, y, T.wall[3], 0); }                                             // the worn sill over the floor's edge
    for (let y = y0 - 6; y <= y0 - 3; y++) for (let x = 1; x <= 6; x++) set(x, y, y === y0 - 6 || x === 1 || x === 6 ? OUT : "#3a4466", 0);   // the iron plate
    for (const [x, y] of [[3, y0 - 5], [4, y0 - 5], [3, y0 - 4], [2, y0 - 4]]) set(x, y, "#265c42", 0);                                // the trolls' smeared hand
  };
  // a wall torch: an iron bracket and an oak handle; its flame is drawn live (flame), its light is baked (frame)
  Scene.prototype.torch = function (x, y) {
    const set = this.set;
    for (const [dx, dy, c] of [[-1, 10, "#3a4466"], [0, 10, "#5a6988"], [1, 10, "#3a4466"], [-1, 11, "#262b44"], [0, 11, "#3a4466"], [1, 11, "#262b44"], [0, 12, "#262b44"], [0, 9, "#5a6988"]]) set(x + dx, y + dy, c);
    for (let i = 0; i < 7; i++) { set(x, y + 2 + i, i < 2 ? "#3e2731" : "#733e39"); set(x + 1, y + 2 + i, "#3e2731"); }
    set(x - 1, y + 1, "#5a6988"); set(x, y + 1, "#8b9bb4"); set(x + 1, y + 1, "#5a6988"); set(x + 2, y + 1, "#3a4466");
    for (let i = 2; i <= 12; i++) set(x - 1, y + i, i > 8 ? this.base[(y + i) * this.W + x - 1] : OUT);
    this.torches.push({ x: x + 0.5, y: y - 3 });
  };
  // the weapon rack: an oak frame with pegs, a sword, an axe and a spear drawn small
  Scene.prototype.rack = function (x0, y0) {
    const fill = this.fill, set = this.set, w = 46, h = 32;
    this.props.rack = { x0, x1: x0 + w, y: this.wallBot };
    const oak = (x, y, x1, y1) => fill(x, y, x1, y1, (xx, yy) => yy === y ? "#b86f50" : yy === y1 ? "#3e2731" : "#733e39");
    oak(x0, y0, x0 + w, y0 + 3); oak(x0, y0 + h - 4, x0 + w, y0 + h - 1);
    for (const px of [x0, x0 + w - 2]) fill(px, y0, px + 2, y0 + h - 1, (x) => x === px ? "#b86f50" : x === px + 2 ? "#3e2731" : "#733e39");
    const sx = x0 + 10; for (let y = y0 + 5; y < y0 + 24; y++) { set(sx, y, "#c0cbdc"); set(sx + 1, y, "#8b9bb4"); } fill(sx - 2, y0 + 20, sx + 3, y0 + 21, "#feae34"); fill(sx, y0 + 22, sx + 1, y0 + 26, "#733e39");
    const ax = x0 + 22; for (let y = y0 + 4; y < y0 + 28; y++) set(ax, y, y > y0 + 24 ? "#3e2731" : "#b86f50"); fill(ax + 1, y0 + 5, ax + 5, y0 + 11, (x) => (x === ax + 5 ? "#c0cbdc" : "#8b9bb4"));
    const px2 = x0 + 34; for (let y = y0 + 3; y < y0 + 28; y++) set(px2, y, y < y0 + 8 ? "#c0cbdc" : "#b86f50"); set(px2 - 1, y0 + 6, "#8b9bb4"); set(px2 + 1, y0 + 6, "#8b9bb4");
    for (let x = x0 - 1; x <= x0 + w + 1; x++) set(x, y0 + h, OUT);
  };
  // the tally board: slate in an oak frame; the page chalks its three lines on it (boardInner)
  Scene.prototype.board = function (x0, y0) {
    const fill = this.fill, w = 58, h = 29;
    this.props.board = { x0, y0, w, h };
    fill(x0 - 1, y0 - 1, x0 + w + 1, y0 + h + 1, OUT);
    fill(x0, y0, x0 + w, y0 + h, (x, y) => (x <= x0 + 1 || y <= y0 + 1) ? (x === x0 || y === y0 ? "#b86f50" : "#733e39") : (x >= x0 + w - 1 || y >= y0 + h - 1) ? (x === x0 + w || y === y0 + h ? "#3e2731" : "#733e39") : ((x * 7 + y * 3) % 23 === 0 ? "#2b3a36" : "#1f2b28"));
    this.boardInner = { x: x0 + 3, y: y0 + 3, w: w - 5, h: h - 5 };
  };
  // the rail: two iron rails on oak sleepers every 10 px, iron stops at the ends
  Scene.prototype.rail = function (x0, x1, y) {
    const set = this.set, fill = this.fill;
    this.props.rail = { x0, x1, y };
    for (let x = x0; x <= x1; x += 10) fill(x, y - 3, x + 2, y + 4, (xx, yy) => yy === y - 3 ? "#b86f50" : yy === y + 4 ? "#241c26" : "#733e39");
    for (let x = x0 - 3; x <= x1 + 5; x++) { set(x, y - 1, "#8b9bb4"); set(x, y, "#3a4466"); set(x, y + 2, "#8b9bb4"); set(x, y + 3, "#3a4466"); }
    for (const ex of [x0 - 5, x1 + 7]) fill(ex, y - 3, ex + 2, y + 5, (xx, yy) => yy === y - 3 ? "#8b9bb4" : "#3a4466");
  };
  // the lit room as RGBA for a flicker phase f (0 to 3) with the first `burning` torches lit (all of them by default): each torch adds
  // the hearth's dithered glow, and on the floor vertical distance counts less, so the light pools down the flagstones
  Scene.prototype.frame = function (f, burning) {
    const W = this.W, H = this.H, L0 = this.light, d = new Uint8ClampedArray(W * H * 4), glow = S.GLOW;
    const n = burning === undefined ? this.torches.length : Math.max(0, Math.min(this.torches.length, burning));
    const L = this.torches.slice(0, n).map((tc, i) => ({ x: tc.x, y: tc.y, R: L0.radius + L0.flicker * Math.sin(f * 1.7 + i * 2.1) }));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; let [r, gg, b] = this.rgb[i];
      if (this.lit[i] && L.length) {
        let k = 0;
        for (const l of L) { const dy = y - l.y, dd = Math.hypot(x - l.x, dy > 0 && y >= this.wallBot ? dy * L0.floor : dy); k = Math.max(k, 1 - dd / l.R); }
        const m = S.glow(k, x, y);
        r += (glow[0] - r) * m; gg += (glow[1] - gg) * m * 0.9; b += (glow[2] - b) * m * 0.8;
      }
      const o = i * 4; d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255;
    }
    return d;
  };
  // bake the lit room at four flicker phases, and once each with no, one and two torches lit (the torches catch one after another
  // when the knight arrives); each is a canvas, so a frame of play costs one drawImage
  Scene.prototype.bake = function () {
    if (this.frames) return this.frames;
    const W = this.W, H = this.H;
    const make = (f, burning) => { const c = canvas(W, H), g = c.getContext("2d"), img = g.createImageData(W, H); img.data.set(this.frame(f, burning)); g.putImageData(img, 0, 0); return c; };
    this.frames = [0, 1, 2, 3].map(f => make(f));
    this.catching = []; for (let n = 0; n < this.torches.length; n++) this.catching.push(make(0, n));
    return this.frames;
  };
  // draw the room at time t; burning is how many torches are lit (all by default); still holds the flicker and the flames
  Scene.prototype.draw = function (ctx, t, still, burning) {
    const frames = this.bake(), n = burning === undefined ? this.torches.length : burning, tick = still ? 0 : Math.floor(t * this.light.fps);
    ctx.drawImage(n >= this.torches.length ? frames[tick % 4] : this.catching[Math.max(0, n)], 0, 0);
    this.torches.forEach((tc, i) => { if (i < n) flame(ctx, Math.floor(tc.x), Math.floor(tc.y) + 3, still ? 0 : (tick + Math.floor(tc.x)) % 4); });
  };
  // a torch flame, 5 x 8, on four frames in the hearth's fire ramp
  const FLAME = [
    ["..3..", ".353.", ".354.", "34543", "35653", "35763", ".376.", "..6.."],
    [".3...", ".33..", ".453.", "34543", "35653", "35763", ".376.", "..6.."],
    ["...3.", "..33.", ".354.", "34553", "35653", "35763", ".376.", "..6.."],
    ["..3..", "..3..", ".353.", "34543", "35663", "36763", ".376.", "..6.."]
  ];
  function flame(ctx, x, y, f) {
    const rows = FLAME[f & 3];
    for (let j = 0; j < rows.length; j++) for (let i = 0; i < 5; i++) { const ch = rows[j][i]; if (ch === ".") continue; ctx.fillStyle = FIRE[+ch]; ctx.fillRect(x - 2 + i, y - 8 + j, 1, 1); }
  }

  // ------------------------------------------------------------------ the 3 x 5 pixel font
  const FONT = {
    "0": "111101101101111", "1": "010110010010111", "2": "111001111100111", "3": "111001111001111", "4": "101101111001001", "5": "111100111001111",
    "6": "111100111101111", "7": "111001010010010", "8": "111101111101111", "9": "111101111001111", ".": "000000000000010", " ": "000000000000000",
    "!": "010010010000010", "+": "000010111010000", "-": "000000111000000", "/": "001001010100100", ":": "000010000010000", "x": "000101010101000",
    A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110", E: "111100110100111", F: "111100110100100", G: "011100101101011",
    H: "101101111101101", I: "111010010010111", J: "001001001101010", K: "101101110101101", L: "100100100100111", M: "101111111101101", N: "110101101101101",
    O: "010101101101010", P: "110101110100100", Q: "010101101110011", R: "110101110101101", S: "011100010001110", T: "111010010010010", U: "101101101101111",
    V: "101101101101010", W: "101101111111101", X: "101101010101101", Y: "101101010010010", Z: "111001010100111"
  };
  function text(ctx, s, x, y, c, shadow) {
    s = String(s).toUpperCase();
    for (const pass of shadow ? [0, 1] : [1]) {
      let cx = Math.round(x); ctx.fillStyle = pass ? c : shadow;
      for (const ch of s) { const g = FONT[ch] || FONT[" "]; for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j * 3 + i] === "1") ctx.fillRect(cx + i + (pass ? 0 : 1), Math.round(y) + j + (pass ? 0 : 1), 1, 1); cx += 4; }
    }
  }
  const textWidth = s => String(s).length * 4 - 1;
  // a number with a soot outline all round, so it reads over anything
  function outlined(ctx, s, x, y, c) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) text(ctx, s, x + dx, y + dy, OUT);
    text(ctx, s, x, y, c);
  }

  // ------------------------------------------------------------------ the dummies (32 x 32, the base on row 30; the armored dummy 48 x 48)
  const burlapTex = (x, y) => ((x * 3 + y * 5) % 7 === 0 ? R.burlap[0] : null);
  function postAndArms(sp) {
    region(sp, rect(15, 19, 16, 29), R.wood);
    region(sp, or(rect(10, 29, 21, 30), rect(14, 28, 17, 30)), R.wood);
    region(sp, rect(5, 12, 26, 13), R.wood, { spec: (x, y) => y === 12 && x % 5 === 0 });
    for (const [x, y, c] of [[4, 11, 2], [4, 13, 3], [3, 12, 2], [27, 11, 2], [27, 13, 3], [28, 12, 2], [5, 14, 1], [26, 14, 1]]) sp.set(x, y, R.straw[c]);
  }
  function target(sp, ring) { for (const [r, c] of [[3.6, ring], [2.4, "#fffaf0"], [1.2, ring]]) for (let y = 13; y < 24; y++) for (let x = 10; x < 22; x++) if ((x - 15.5) ** 2 + (y - 18) ** 2 <= r * r) sp.set(x, y, c); }
  function strawHead(sp) {
    region(sp, ell(15.5, 6.5, 4.5, 4.5), R.burlap, { tex: burlapTex });
    for (const [x, y] of [[13, 5], [14, 6], [14, 4], [13, 7], [17, 5], [18, 6], [18, 4], [17, 7]]) sp.set(x, y, R.wood[0]);
    for (let x = 13; x <= 18; x++) sp.set(x, 11, R.wood[1]);
  }
  const DUMMY = {
    // a burlap sack on an oak post, a stitched face, crossbar arms with straw tufts, a red-and-white target on the chest
    straw(sp) { postAndArms(sp); region(sp, ell(15.5, 18, 6.5, 6.5), R.burlap, { tex: burlapTex }); target(sp, R.red[1]); strawHead(sp); for (const [x, y] of [[15, 1], [16, 0], [14, 1]]) sp.set(x, y, R.straw[2]); },
    // a generic armored enemy on a training stand, 1.5 x the others: 48 x 48, the base on rows 44 to 46, the crest at row 2
    armored(sp) {
      const IRON = R.iron, STEEL = R.steel, BRASS = R.gold, CLOTH = ["#231b33", "#3e2753", "#68386c", "#8b5a9c"];
      // the stand: an oak cross-foot under the sabatons
      region(sp, or(rect(11, 44, 36, 46), rect(19, 42, 28, 46)), R.wood, { spec: (x, y) => y === 44 && x % 6 === 1 });
      // the legs: greaves, knee cops and sabatons
      region(sp, or(rect(16, 32, 21, 41), rect(26, 32, 31, 41)), IRON, { spec: (x, y) => (x === 17 || x === 27) && y > 34 && y < 40 });
      region(sp, or(ell(18.5, 33.5, 3.2, 2.2), ell(28.5, 33.5, 3.2, 2.2)), STEEL, { spec: (x, y) => (x === 17 || x === 27) && y === 32 });
      region(sp, or(rect(14, 41, 21, 43), rect(26, 41, 33, 43)), IRON, { flat: 1 });
      // the faulds: three lames of plate below the belt, a dark tabard panel hanging between them
      region(sp, rect(13, 25, 34, 31), IRON, { tex: (x, y) => (y === 27 || y === 29) ? IRON[0] : null });
      region(sp, rect(20, 25, 27, 36), CLOTH, { tex: (x, y) => ((x * 3 + y) % 7 === 0 ? CLOTH[0] : null) });
      for (const x of [20, 22, 24, 26]) sp.set(x, 36, null);
      region(sp, rect(12, 23, 35, 24), R.leather, { flat: 2 });
      for (const [x, y, c] of [[22, 23, 3], [23, 23, 3], [24, 23, 2], [22, 24, 2], [23, 24, 1], [24, 24, 1]]) sp.set(x, y, BRASS[c]);
      // the arms hang at the sides: vambraces, couters and gauntlets
      region(sp, or(rect(5, 15, 9, 28), rect(38, 15, 42, 28)), IRON, { spec: (x, y) => (x === 6 || x === 39) && y > 16 && y < 26 });
      region(sp, or(ell(7, 21.5, 2.8, 2), ell(40, 21.5, 2.8, 2)), STEEL);
      region(sp, or(ell(7, 30, 3, 2.6), ell(40, 30, 3, 2.6)), IRON, { flat: 1, tex: (x, y) => ((x === 6 || x === 39) && y === 29 ? IRON[3] : null) });
      // the breastplate: rounded, ridged down the middle, brass rivets
      region(sp, or(ell(23.5, 16.5, 11.5, 8.5), rect(12, 16, 35, 22)), STEEL, { spec: (x, y) => (x === 21 || x === 22) && y > 10 && y < 21 });
      for (let y = 10; y <= 22; y++) sp.set(24, y, STEEL[0]);
      for (const [x, y] of [[14, 14], [33, 14], [13, 19], [34, 19], [14, 22], [33, 22]]) sp.set(x, y, BRASS[2]);
      // the pauldrons: three lames each
      region(sp, or(ell(9.5, 13.5, 6.2, 4.6), ell(37.5, 13.5, 6.2, 4.6)), STEEL, { tex: (x, y) => (y === 14 || y === 16) ? STEEL[0] : null, spec: (x, y) => (x === 6 || x === 34) && y === 11 });
      // the gorget and the helm: a round-topped great helm with a visor slit and breaths, a dark crest
      region(sp, rect(18, 10, 29, 12), IRON);
      region(sp, or(rect(17, 4, 30, 10), ell(23.5, 5, 6.5, 3)), STEEL, { spec: (x, y) => (x === 19 && y === 4) || (x === 20 && y === 3) });
      for (let x = 18; x <= 29; x++) sp.set(x, 7, OUT);
      sp.set(23, 8, OUT); sp.set(24, 8, OUT);
      for (const [x, y] of [[19, 9], [21, 9], [26, 9], [28, 9]]) sp.set(x, y, IRON[0]);
      region(sp, or(ell(23.5, 2.5, 2.2, 1.5), rect(23, 2, 24, 4)), CLOTH, { spec: (x, y) => x === 23 && y === 2 });
    },
    // a straw dummy with a blue target, on a wooden sled with iron wheels
    rail(sp) {
      region(sp, rect(15, 19, 16, 26), R.wood); region(sp, rect(5, 12, 26, 13), R.wood);
      for (const [x, y, c] of [[4, 11, 2], [4, 13, 3], [3, 12, 2], [27, 11, 2], [27, 13, 3], [28, 12, 2]]) sp.set(x, y, R.straw[c]);
      region(sp, ell(15.5, 18, 6.5, 6.5), R.burlap, { tex: burlapTex }); target(sp, "#124e89"); strawHead(sp);
      region(sp, rect(6, 25, 25, 27), R.wood, { spec: (x, y) => y === 25 && x % 4 === 0 });
      for (const wx of [9, 22]) region(sp, ell(wx, 29, 2, 2), R.iron, { spec: (x, y) => x === wx - 1 && y === 28 });
    },
    // a tall post; its pivoting arm is drawn every frame at its angle (quintainArm)
    quintain(sp) {
      region(sp, rect(15, 7, 16, 29), R.wood);
      region(sp, or(rect(10, 29, 21, 30), rect(13, 27, 18, 30)), R.wood);
      region(sp, ell(15.5, 7, 2.5, 1.8), R.iron, { spec: (x, y) => x === 14 && y === 6 });
    }
  };
  const KINDS = Object.keys(DUMMY);
  // each dummy's grid, and the row where the wobble stops (the post's foot)
  const DSIZE = { armored: 48 }, DFOOT = { armored: 41 };
  const sizeOf = kind => DSIZE[kind] || 32;
  const pcache = new Map(), dcache = new Map();
  // a dummy's pixels, leaning `tilt` pixels at its top (the wobble): rows above the post's foot shift by up to |tilt| pixels
  function dummyPixels(kind, tilt) {
    if (!DUMMY[kind]) kind = "straw";
    tilt = tilt | 0;
    const key = kind + tilt;
    if (pcache.has(key)) return pcache.get(key);
    const N = sizeOf(kind), foot = DFOOT[kind] || 26;
    const sp = new Grid(N); DUMMY[kind](sp); outline(sp);
    let px = sp.px;
    if (tilt) {
      const out = new Array(N * N).fill(null);
      for (let y = 0; y < N; y++) { const shift = y >= foot ? 0 : Math.round(tilt * (foot - y) / foot); for (let x = 0; x < N; x++) { const c = px[y * N + x]; if (c) { const nx = x + shift; if (nx >= 0 && nx < N) out[y * N + nx] = c; } } }
      px = out;
    }
    const res = { px, size: N, kind };
    pcache.set(key, res);
    return res;
  }
  // a dummy's canvas: plain, white (the hit flash) or ice (frozen), tilted by the wobble
  function dummySprite(kind, tilt, mode) {
    const key = kind + (tilt | 0) + (mode || "");
    if (dcache.has(key)) return dcache.get(key);
    const d = dummyPixels(kind, tilt);
    const tint = mode === "white" ? () => "#ffffff" : mode === "ice" ? c => { const [r, g, b] = hex(c); const m = 0.55; return "rgb(" + Math.round(r + (184 - r) * m) + "," + Math.round(g + (244 - g) * m) + "," + Math.round(b + (255 - b) * m) + ")"; } : null;
    const c = canvasOf(d.px, d.size, d.size, { tint });
    dcache.set(key, c);
    return c;
  }
  // the quintain's arm at angle a (radians, in the floor plane), drawn round the post's top at (x, y - 24): a red-and-white shield at
  // one end, a sandbag at the other, foreshortened; returns where both ends are over the floor
  function quintainArm(ctx, x, y, a, len) {
    const Rr = len || 17, cx = x + 0.5, cy = y - 24;
    const ex = Math.cos(a) * Rr, ey = Math.sin(a) * Rr * 0.5;
    const line = (x0, y0, x1, y1, c) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0; for (let i = 0; i <= n; i++) { const u = n ? i / n : 0; ctx.fillStyle = c; ctx.fillRect(Math.round(x0 + (x1 - x0) * u), Math.round(y0 + (y1 - y0) * u), 1, 1); } };
    const shieldEnd = () => { const sx = Math.round(cx + ex), sy = Math.round(cy + ey); paint(ctx, ["kkkkkkk", "kwRRRwk", "kRwRwRk", "kRRwRRk", "kRwRwRk", ".kRRRk.", "..kkk.."], { k: OUT, w: "#fffaf0", R: "#e43b44" }, sx - 3, sy - 3); };
    const bagEnd = () => { const bx = Math.round(cx - ex), by = Math.round(cy - ey); paint(ctx, [".kkk.", "kbBbk", "kBBBk", "kBBbk", "kbbbk", ".kkk."], { k: OUT, b: "#733e39", B: "#b86f50" }, bx - 2, by - 1); };
    const shieldBehind = Math.sin(a) < 0;
    if (shieldBehind) shieldEnd(); else bagEnd();
    line(cx - ex, cy - ey, cx + ex, cy + ey, "#733e39"); line(cx - ex, cy - ey + 1, cx + ex, cy + ey + 1, "#3e2731");
    ctx.fillStyle = "#8b9bb4"; ctx.fillRect(Math.round(cx), cy, 1, 1);
    if (shieldBehind) bagEnd(); else shieldEnd();
    return { bag: [x - Math.cos(a) * Rr, y - Math.sin(a) * Rr], shield: [x + Math.cos(a) * Rr, y + Math.sin(a) * Rr] };
  }
  // rows of characters as pixels through a palette ("." is empty)
  function paint(ctx, rows, pal, x, y, flip) {
    const w = rows[0].length;
    for (let j = 0; j < rows.length; j++) for (let i = 0; i < w; i++) { const ch = rows[j][i]; if (ch === "." || !pal[ch]) continue; ctx.fillStyle = pal[ch]; ctx.fillRect(Math.round(x) + (flip ? w - 1 - i : i), Math.round(y) + j, 1, 1); }
  }
  // a soft elliptical drop shadow on the floor, w pixels to each side
  function shadow(ctx, x, y, w) { ctx.fillStyle = "rgba(10,6,18,0.45)"; for (let dx = -w; dx <= w; dx++) { const h = Math.max(1, Math.round(Math.sqrt(1 - (dx / (w + 0.5)) ** 2) * 2)); ctx.fillRect(Math.round(x) + dx, Math.round(y) - h + 1, 1, h * 2 - 1); } }

  root.Cellar = { OUT, R, FIRE, BAYER, hex, rng, Scene, flame, FLAME, text, textWidth, outlined, FONT, KINDS, sizeOf, dummyPixels, dummySprite, quintainArm, paint, shadow,
    canvas, canvasOf, Grid, region, outline, rect, ell, or };
  if (typeof module !== "undefined" && module.exports) module.exports = root.Cellar;
})(typeof window !== "undefined" ? window : globalThis);
