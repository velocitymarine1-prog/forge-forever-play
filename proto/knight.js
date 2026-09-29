// FORGE FOREVER: the knight (design pass 7 section 3.5, revised by card t64; built by card t65).
// The hero of the Battlegrounds for now: a very basic pixel knight, 32 x 32, drawn in code from shapes the way the renderer draws
// Things (masks, light from the top left, four-tone ramps, a soot outline): a steel great helm with a T visor and a red plume, steel
// pauldrons, arms and greaves, a crimson tabard with a gold mark, a leather belt and boots. Its feet stand on the bottom row, so it
// shares the grid of every weapon. Three drawings (down, up, side; the side mirrored for left) and the frames idle, walk, wind,
// strike, recover and bonk. Every frame names the pixel of the weapon hand, and the side drawing also comes with its near arm held
// out at chest height: reach 1 for a thing held in front (a spellbook), reach 2 the straight bow arm, 3 px longer.
// Pass 1's four heroes replace it later through the same interface. The pixels are made without a DOM, so node can check them;
// canvases are made only when a page asks. Plain script, defines window.Knight. Needs no other file.
(function (root) {
  "use strict";
  const N = 32, OUT = "#181425";
  const R = {
    steel: ["#3a4466", "#5a6988", "#8b9bb4", "#c0cbdc"], iron: ["#262b44", "#3a4466", "#5a6988", "#8b9bb4"], red: ["#a22633", "#e43b44", "#f6757a", "#ffd0c8"],
    leather: ["#2a1d28", "#3e2731", "#733e39", "#b86f50"], gold: ["#be4a2f", "#f77622", "#feae34", "#fee761"]
  };
  // the four facings and the drawing each uses: right and left the side drawing (left mirrored), away the back, toward the front
  const FACINGS = ["right", "left", "away", "toward"];
  const DRAWING = { right: ["side", false], left: ["side", true], away: ["up", false], toward: ["down", false] };
  const ANIMS = { idle: 2, walk: 4, wind: 1, strike: 1, recover: 1, bonk: 1 };

  // ------------------------------------------------------------------ a small painter (the renderer's way)
  function Grid() { this.N = N; this.px = new Array(N * N).fill(null); }
  Grid.prototype.get = function (x, y) { return x >= 0 && y >= 0 && x < N && y < N ? this.px[y * N + x] : null; };
  Grid.prototype.set = function (x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < N && y < N) this.px[y * N + x] = c; };
  const rect = (x0, y0, x1, y1) => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  const ell = (cx, cy, rx, ry) => (x, y) => ((x - cx) ** 2) / (rx * rx) + ((y - cy) ** 2) / (ry * ry) <= 1.02;
  const or = (...f) => (x, y) => f.some(g => g(x, y));
  function region(sp, pred, ramp, o) {
    o = o || {}; const m = (x, y) => x >= 0 && y >= 0 && x < N && y < N && pred(x, y);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (m(x, y)) {
      const ul = !m(x - 1, y) || !m(x, y - 1), dr = !m(x + 1, y) || !m(x, y + 1);
      let c = ul && dr ? ramp[1] : dr ? ramp[0] : ul ? ramp[2] : ramp[1];
      if (o.spec && o.spec(x, y)) c = ramp[3];
      if (o.flat !== undefined) c = ramp[o.flat];
      sp.set(x, y, c);
    }
  }
  function outline(sp) { const add = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!sp.get(x, y) && (sp.get(x - 1, y) || sp.get(x + 1, y) || sp.get(x, y - 1) || sp.get(x, y + 1))) add.push([x, y]); for (const [x, y] of add) sp.set(x, y, OUT); }

  // ------------------------------------------------------------------ the three drawings
  // pose: { step (-1, 0, 1: which leg leads), bob (0 or 1), lean (side only), arm ([dx, dy] of the weapon arm), reach (0, 1, 2) }
  function draw(drawing, pose) {
    pose = pose || {}; const sp = new Grid(), step = pose.step || 0, B = pose.bob || 0, X = drawing === "side" ? (pose.lean || 0) : 0;
    const STEEL = R.steel, DARK = R.iron, RED = R.red, LEATHER = R.leather, GOLD = R.gold;
    let hand;
    if (drawing === "down" || drawing === "up") {
      const lA = step > 0 ? -1 : 0, lB = step < 0 ? -1 : 0;
      region(sp, rect(12, 24 + lA, 14, 29 + lA), STEEL); region(sp, rect(17, 24 + lB, 19, 29 + lB), STEEL);
      region(sp, rect(11, 29 + lA, 14, 30 + lA), LEATHER); region(sp, rect(17, 29 + lB, 20, 30 + lB), LEATHER);
      region(sp, rect(11, 21 + B, 20, 25 + B), RED);
      region(sp, rect(10, 20 + B, 21, 21 + B), LEATHER, { flat: 2 });
      if (drawing === "down") { sp.set(15, 20 + B, GOLD[2]); sp.set(16, 20 + B, GOLD[3]); sp.set(15, 21 + B, GOLD[1]); sp.set(16, 21 + B, GOLD[2]); }
      region(sp, rect(10, 13 + B, 21, 19 + B), STEEL);
      region(sp, rect(12, 13 + B, 19, 19 + B), RED);
      if (drawing === "down") for (const [x, y] of [[15, 15], [16, 15], [14, 16], [15, 16], [16, 16], [17, 16], [15, 17], [16, 17]]) sp.set(x, y + B, (x + y) % 2 ? GOLD[2] : GOLD[3]);
      const armL = pose.arm && drawing === "up" ? pose.arm : [0, 0], armR = pose.arm && drawing === "down" ? pose.arm : [0, 0];
      region(sp, rect(7 + armL[0], 15 + B + armL[1], 9 + armL[0], 20 + B + armL[1]), STEEL); region(sp, rect(22 + armR[0], 15 + B + armR[1], 24 + armR[0], 20 + B + armR[1]), STEEL);
      region(sp, rect(7 + armL[0], 20 + B + armL[1], 9 + armL[0], 22 + B + armL[1]), DARK); region(sp, rect(22 + armR[0], 20 + B + armR[1], 24 + armR[0], 22 + B + armR[1]), DARK);
      region(sp, ell(9, 14 + B, 3, 2.4), STEEL, { spec: (x, y) => x === 8 && y === 13 + B }); region(sp, ell(22, 14 + B, 3, 2.4), STEEL, { spec: (x, y) => x === 21 && y === 13 + B });
      region(sp, or(rect(10, 4 + B, 21, 12 + B), ell(15.5, 5 + B, 6, 2.5)), STEEL, { spec: (x, y) => (x === 12 && y === 5 + B) || (x === 13 && y === 4 + B) });
      if (drawing === "down") {
        for (let x = 11; x <= 20; x++) sp.set(x, 8 + B, OUT);
        for (let y = 9; y <= 11; y++) { sp.set(15, y + B, OUT); sp.set(16, y + B, OUT); }
        for (const [x, y] of [[12, 10], [13, 11], [18, 10], [19, 11]]) sp.set(x, y + B, DARK[0]);
      } else for (let y = 5; y <= 12; y++) sp.set(15, y + B, STEEL[0]);
      region(sp, or(ell(15.5, 2 + B, 2.2, 2), rect(15, 0 + B, 16, 3 + B)), RED, { spec: (x, y) => x === 15 && y === 1 + B });
      hand = drawing === "down" ? [23 + armR[0], 21 + B + armR[1]] : [8 + armL[0], 21 + B + armL[1]];
    } else {
      const back = step > 0 ? -2 : step < 0 ? 2 : 0, fwd = -back;
      region(sp, rect(13 + back, 24, 15 + back, 29), DARK); region(sp, rect(12 + back, 29, 16 + back, 30), LEATHER, { flat: 1 });
      region(sp, rect(15 + fwd, 24, 17 + fwd, 29), STEEL); region(sp, rect(15 + fwd, 29, 19 + fwd, 30), LEATHER);
      region(sp, rect(11 + X, 21 + B, 19 + X, 25 + B), RED);
      region(sp, rect(11 + X, 20 + B, 19 + X, 21 + B), LEATHER, { flat: 2 });
      region(sp, rect(11 + X, 13 + B, 19 + X, 19 + B), STEEL);
      region(sp, rect(13 + X, 13 + B, 18 + X, 19 + B), RED);
      region(sp, ell(14.5 + X, 14 + B, 3.4, 2.4), STEEL, { spec: (x, y) => x === 13 + X && y === 13 + B });
      region(sp, or(rect(10 + X, 4 + B, 20 + X, 12 + B), ell(15 + X, 5 + B, 5.5, 2.5)), STEEL, { spec: (x, y) => x === 12 + X && y === 5 + B });
      for (let x = 17; x <= 20; x++) sp.set(x + X, 8 + B, OUT);
      sp.set(19 + X, 10 + B, DARK[0]); sp.set(20 + X, 11 + B, DARK[0]);
      region(sp, or(ell(13 + X, 2 + B, 3, 1.8), rect(13 + X, 0 + B, 14 + X, 3 + B), ell(10 + X, 3 + B, 2, 1.4)), RED, { spec: (x, y) => x === 12 + X && y === 1 + B });
      const arm = pose.arm || [0, 0];
      if (pose.reach) {
        // the arm held out at chest height. For a spellbook the hand is 5 px further forward and 4 px higher than the hanging hand; for
        // a bow the arm is straight and 3 px longer, so the string clears the helm
        const sx = 17 + X + (arm[0] > 0 ? 1 : 0), sy = 16 + B + (arm[1] < 0 ? -1 : 0), len = pose.reach === 2 ? 10 : 7;
        region(sp, rect(sx, sy, sx + len - 2, sy + 2), STEEL); region(sp, rect(sx + len - 2, sy, sx + len, sy + 2), DARK);
        hand = [sx + len, sy + 1];
      } else {
        const ax = 18 + X + arm[0], ay = 15 + B + arm[1];
        region(sp, rect(ax, ay, ax + 2, ay + 5), STEEL); region(sp, rect(ax, ay + 5, ax + 2, ay + 7), DARK);
        hand = [ax + 1, ay + 6];
      }
    }
    outline(sp);
    sp.hand = hand;
    return sp;
  }
  // the pose of an animation's frame i for a drawing
  function poseOf(drawing, anim, i) {
    const side = drawing === "side";
    if (anim === "walk") return { step: [1, 0, -1, 0][i % 4], bob: i % 2 ? 0 : 1 };
    if (anim === "wind") return { lean: -1, arm: side ? [-1, -3] : [0, -2] };
    if (anim === "strike") return { lean: 1, arm: side ? [2, -1] : [0, 1] };
    if (anim === "recover") return { lean: 1, arm: side ? [1, 0] : [0, 0] };
    if (anim === "bonk") return { lean: -1, bob: 1 };
    return { bob: i % 2 };   // idle: a 1 px breath
  }

  // ------------------------------------------------------------------ the frames
  const cache = new Map();
  // Knight.frame(facing, anim, i, reach) -> { px, hand, facing, anim, reach, canvas(), white() }
  //   facing: right | left | away | toward (anything else is drawn as right); anim: idle | walk | wind | strike | recover | bonk
  //   reach: 0 the hanging arm, 1 the arm held out, 2 the straight bow arm (right and left only; away and toward keep the hanging arm)
  function frame(facing, anim, i, reach) {
    if (!DRAWING[facing]) facing = "right";
    if (!ANIMS[anim]) anim = "idle";
    i = (i | 0) % ANIMS[anim];
    const [drawing, flip] = DRAWING[facing];
    reach = drawing === "side" ? (reach === true ? 1 : Math.max(0, Math.min(2, reach | 0))) : 0;
    const key = facing + "|" + anim + "|" + i + "|" + reach;   // the key names the arm, so the book never takes the bow's
    if (cache.has(key)) return cache.get(key);
    const pose = poseOf(drawing, anim, i); pose.reach = reach;
    const sp = draw(drawing, pose);
    let px = sp.px, hand = sp.hand.slice();
    if (flip) { px = new Array(N * N).fill(null); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) px[y * N + (N - 1 - x)] = sp.px[y * N + x]; hand = [N - 1 - hand[0], hand[1]]; }
    const out = { px, hand, facing, anim, i, reach, w: N, h: N, _c: null, _w: null,
      canvas() { return this._c || (this._c = toCanvas(px, null)); },
      white() { return this._w || (this._w = toCanvas(px, "#ffffff")); } };
    cache.set(key, out);
    return out;
  }
  function toCanvas(px, tint) {
    const c = root.document.createElement("canvas"); c.width = N; c.height = N; const g = c.getContext("2d");
    for (let k = 0; k < N * N; k++) { const col = px[k]; if (!col) continue; g.fillStyle = tint && col !== OUT ? tint : col; g.fillRect(k % N, (k / N) | 0, 1, 1); }
    return c;
  }
  // the weapon hand's pixel in a frame
  function hand(facing, anim, i, reach) { return frame(facing, anim, i, reach).hand.slice(); }

  root.Knight = { N, OUT, FACINGS, DRAWING, ANIMS, frame, hand, poseOf };
  if (typeof module !== "undefined" && module.exports) module.exports = root.Knight;
})(typeof window !== "undefined" ? window : globalThis);
