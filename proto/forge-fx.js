// FORGE FOREVER: the forging (design pass 10, card t67; widened by design pass 14 for the wide smithy: this is pass 14's sketch).
// When the smith strikes, the two things lift out of the anvil's slots and fly into the hearth, melt into one glowing billet, and the
// smith's hammer beats it on the anvil until the world answers (the forge's loading screen); then the result comes out of the last
// blow. Everything is drawn in world pixels on an overlay canvas the size of the smithy (W x 112: 200 in pass 10, the room's own width
// since pass 14) stacked on the room's canvas, by the pixel rules: a soot outline, ramps lit from the top left, motion on four frames,
// nothing turned or resampled. The station's numbers below are pass 10's, for a room 200 wide; a wider room is drawn shifted by
// ox = W / 2 - 100, so the hearth and the anvil stay where the room has them. From the cut on, a dithered curtain of soot closes in at
// the sides beyond the station (pass 14): the 2x lens of a wide room shows more than the station, and the smith's arm runs into it.
//
// Time is in milliseconds from the Strike. Most of the sequence moves in beats of 90 ms (the fire's own pace); a hammer blow is 960 ms
// (revision 1: Isaac slowed the strikes by 0.6 s): raised 360, swinging 90, on the billet 360, rebounding 150.
//   ForgeFx.frame(ctx, plan, ms)     draws the overlay at that moment; pure: the same plan and ms give the same pixels
//   ForgeFx.zoomAt(plan, ms)         1 or 2: the room's lens (the cut to the anvil when both things are in the fire)
//   ForgeFx.phaseAt(plan, ms)        "fly" | "melt" | "hop" | "blow" | "last" | "reveal" | "done" | "fail" | "still"
//   ForgeFx.strikeAt(plan)           the moment the last blow lands (Infinity until the world answers); doneAt(plan) when it is over
//   ForgeFx.start(opts) -> run       runs on the page's clock in steps of 30 ms; run.answer(thing, gold), run.fail(), run.skip(),
//                                    run.stop(), run.done (a promise: "revealed" or "failed")
// A plan is { from: [[x, y], [x, y]] (each thing's top-left at its slot, in the station's own pixels), things: [A, B], answerAt, result,
// failAt, skipAt, reduce, gold, W, ox } with its moments in ms; start() takes the room's pixels and shifts them by ox. Plain script, defines window.ForgeFx; reads window.PixelForge for the sprites.
(function (root) {
  "use strict";
  const W0 = 200, H = 112, N = 32, STEP = 30, BEAT = 90, CLEAR = 56, CURTAIN = 16;
  const OUT = "#181425";
  const T = { fly: 4, melt: 2, hop: 2, min: 1, rise: 3 };                // beats: a flight's steps, the melt, the hop; blows before the last; the rise
  const POSE_MS = [360, 90, 360, 150];                                    // a blow: raised, swinging, on the billet, rebounding (960 ms)
  const BLOW = POSE_MS.reduce((a, b) => a + b, 0), STRIKE = POSE_MS[0] + POSE_MS[1];   // 960, and the hammer lands 450 ms into it
  const FIRST_BLOW = (1 + T.fly + T.melt + T.hop) * BEAT;                // 810: A flies 0-360, B 90-450, the melt 450-630, the hop 630-810
  const REVEAL = 5 * BEAT;                                                // from the last strike to the plaque: a white beat, then colour and the rise
  const MOUTH = [84, 50];                                                  // where a thing enters the fire (its top-left)
  const FACE = { x: 101, y: 80 };                                          // the anvil's face (Smithy's anvilTop is (100, 80))
  const HEAT = [["#fff6c8", "#fee761", "#feae34"], ["#fee761", "#feae34", "#f77622"], ["#feae34", "#f77622", "#e43b44"], ["#f77622", "#e43b44", "#a22633"]];
  const HOT = ["#be4a2f", "#f77622", "#feae34", "#fee761", "#fff6c8"];
  const IRON = ["#262b44", "#3a4466", "#5a6988", "#8b9bb4", "#c0cbdc"], OAK = ["#3e2731", "#733e39", "#b86f50", "#e4a672"], SKIN = ["#733e39", "#c28569", "#e8b796"];
  const COLD = ["#5a6988", "#3a4466", "#262b44"];
  const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);

  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const luma = h => { const [r, g, b] = hex(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };

  // ------------------------------------------------------------------ the timeline (milliseconds)
  // strikeAt: when the last blow lands. Without an answer, never. Otherwise the strike of the first blow that starts once the world has
  // answered (never before blow MIN); a tap after the answer brings it to the next step.
  const has = v => v !== null && v !== undefined;
  function strikeAt(plan) {
    if (!has(plan.answerAt)) return Infinity;
    const L = Math.max(T.min, Math.ceil((plan.answerAt - FIRST_BLOW) / BLOW)), normal = FIRST_BLOW + BLOW * L + STRIKE;
    return has(plan.skipAt) ? Math.min(normal, Math.max(plan.skipAt, plan.answerAt) + STEP) : normal;
  }
  function doneAt(plan) {
    if (plan.reduce) return has(plan.answerAt) ? Math.max(plan.answerAt + 100, 300) : Infinity;
    if (has(plan.failAt)) return Math.max(plan.failAt, FIRST_BLOW) + 4 * BEAT;
    return strikeAt(plan) + REVEAL;
  }
  function phaseAt(plan, t) {
    if (t >= doneAt(plan)) return "done";
    if (plan.reduce) return "still";
    if (has(plan.failAt) && t >= Math.max(plan.failAt, FIRST_BLOW)) return "fail";
    const S = strikeAt(plan);
    if (t >= S) return t < S + BEAT ? "last" : "reveal";
    if (t < (1 + T.fly) * BEAT) return "fly";
    if (t < (1 + T.fly + T.melt) * BEAT) return "melt";
    if (t < FIRST_BLOW) return "hop";
    return "blow";
  }
  const zoomAt = (plan, t) => plan.reduce ? 1 : (t >= (1 + T.fly) * BEAT || t >= strikeAt(plan)) ? 2 : 1;
  // where a moment falls in the blows: the blow k, the pose f (0 raised, 1 swinging, 2 on the billet, 3 rebounding), and the ms into it
  function blowAt(t) { const k = Math.floor((t - FIRST_BLOW) / BLOW), b = t - FIRST_BLOW - k * BLOW; let f = 0, acc = 0; while (f < 3 && b >= acc + POSE_MS[f]) { acc += POSE_MS[f]; f++; } return { k, f, b }; }
  // the moments the hammer lands, up to t (the page flashes and shakes then)
  function strikesUpTo(plan, t) { const out = [], S = strikeAt(plan); for (let k = 0; FIRST_BLOW + BLOW * k + STRIKE <= Math.min(t, S - 1); k++) out.push(FIRST_BLOW + BLOW * k + STRIKE); if (S <= t) out.push(S); return out; }

  // ------------------------------------------------------------------ a tiny painter over an ImageData
  function painter(ctx, W, ox) {
    const img = ctx.createImageData(W, H), d = img.data, mark = new Uint8Array(W * H);
    // put takes the station's pixels (pass 10's, a room 200 wide) and shifts them by ox; at paints the room's own pixels (the outline)
    const at = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H || !c) return; const i = y * W + x, [r, g, b] = hex(c); d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255; mark[i] = 1; };
    const put = (x, y, c) => at(x + ox, y, c);
    // outline what was drawn since the last layer() (a 1 px soot edge where a drawn pixel meets nothing), counting pixels drawn over
    // an earlier layer too (the hammer's head over the billet's outline: pass 10's sketch skipped those, nicking the head's corner)
    const drawn = new Uint8Array(W * H), at0 = at;
    const atD = (x, y, c) => { at0(x, y, c); x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H && c) drawn[y * W + x] = 1; };
    const putD = (x, y, c) => atD(x + ox, y, c);
    const layer = () => { drawn.fill(0); };
    const outline = () => { const add = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (mark[i]) continue;
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) return false; return drawn[yy * W + xx] === 1; })) add.push([x, y]); }
      for (const [x, y] of add) at0(x, y, OUT); };
    return { put: putD, img, layer, outline, mark };
  }
  function sprite(t) { const PF = root.PixelForge; return PF && t ? PF.spriteFor(t, 0) : null; }
  // a thing's sprite at (x0, y0); map turns each colour into another (the heat of the fire)
  function blit(P, t, x0, y0, map) { const sp = sprite(t); if (!sp) return; for (let i = 0; i < N * N; i++) { const c = sp.px[i]; if (c) P.put(x0 + (i % N), y0 + ((i / N) | 0), map ? map(c) : c); } }
  // a ring of light around a sprite, so the result reads against the flames
  function halo(P, t, x0, y0, c) {
    const sp = sprite(t); if (!sp) return;
    const on = (x, y) => x >= 0 && y >= 0 && x < N && y < N && !!sp.px[y * N + x];
    for (let y = -2; y < N + 2; y++) for (let x = -2; x < N + 2; x++) { if (on(x, y)) continue;
      let near = false; for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2 && !near; dx++) if (Math.abs(dx) + Math.abs(dy) <= 2 && on(x + dx, y + dy)) near = true;
      if (near) P.put(x0 + x, y0 + y, c); }
  }
  // rays of light from a point: eight dithered spokes, `len` long
  function rays(P, cx, cy, len, c) { for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; for (let r = 6; r < len; r++) if ((r + i) % 2 === 0) P.put(cx + Math.cos(a) * r, cy + Math.sin(a) * r, c); } }
  const hotMap = c => c === OUT ? "#a22633" : HOT[Math.min(4, Math.floor(luma(c) * 5))];
  const whiteMap = c => c === OUT ? "#feae34" : "#fff6c8";

  // the billet: a bar of hot metal, `len` long and 3 high, its heat step s (0 white-hot .. 3 cooling), centred at (cx, y top)
  function billet(P, cx, y, len, s, cold) {
    P.layer();
    const ramp = cold ? COLD : HEAT[Math.min(3, s)], x0 = Math.round(cx - len / 2);
    for (let j = 0; j < 3; j++) for (let i = 0; i < len; i++) P.put(x0 + i, y + j, (i === 0 || i === len - 1) && j !== 1 ? ramp[1] : ramp[j]);
    P.outline();
  }
  // the hammer and the smith's forearm: the fist at (fx, fy), the handle along the angle (degrees: 90 up, 45 up and left, 0 left)
  function hammer(P, fx, fy, deg, smear) {
    const a = deg * Math.PI / 180, dx = -Math.cos(a), dy = -Math.sin(a), px = -dy, py = dx;   // along the handle, and across it
    const HANDLE = 17, HEAD_L = 13, HEAD_W = 7;
    P.layer();
    // the forearm: from the fist down and to the right, off the lens (the smith stands out of sight, right of the anvil)
    for (let s = 0; s < 44; s++) { const half = 2 + Math.min(2, Math.floor(s / 8)); for (let w = -half; w <= half; w++) { const x = fx + 3 + s, y = fy + 1 + s * 0.4 + w; P.put(x, y, w === -half ? SKIN[2] : w >= half - 1 ? SKIN[0] : SKIN[1]); } }
    for (let s = 24; s < 44; s++) for (let w = -5; w <= 5; w++) P.put(fx + 3 + s, fy + 1 + s * 0.4 + w, w <= -4 ? OAK[2] : w >= 4 ? OAK[0] : OAK[1]);   // a rolled leather sleeve
    // the handle: 2 px of oak, lit on its upper side
    for (let s = 1; s <= HANDLE; s++) for (let w = 0; w <= 1; w++) { const x = fx + dx * s + px * (w - 0.5), y = fy + dy * s + py * (w - 0.5); P.put(x, y, s >= HANDLE - 1 ? OAK[0] : w === 0 ? OAK[2] : OAK[1]); }
    // the head: 13 across the handle and 7 along it, iron lit from the top left
    const hx = fx + dx * (HANDLE + HEAD_W / 2), hy = fy + dy * (HANDLE + HEAD_W / 2);
    for (let y = Math.floor(hy - 9); y <= hy + 9; y++) for (let x = Math.floor(hx - 9); x <= hx + 9; x++) {
      const rx = x + 0.5 - hx - 0.5, ry = y + 0.5 - hy - 0.5, along = rx * dx + ry * dy, across = rx * px + ry * py;
      if (Math.abs(along) > HEAD_W / 2 || Math.abs(across) > HEAD_L / 2) continue;
      const edge = Math.abs(across) > HEAD_L / 2 - 1.2 ? 1 : 0, lit = (x - hx) + (y - hy) < -3 ? 1 : (x - hx) + (y - hy) > 3 ? -1 : 0;
      P.put(x, y, edge ? IRON[3] : lit > 0 ? IRON[3] : lit < 0 ? IRON[1] : IRON[2]);
    }
    P.put(Math.round(hx - 2), Math.round(hy - 2), IRON[4]);
    // the fist, a leather glove
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) P.put(fx + x, fy + y, y === -2 || x === -2 ? OAK[2] : y === 2 || x === 2 ? OAK[0] : OAK[1]);
    P.outline();
    // the smear of the down-swing: a dithered arc of light where the head passed
    if (smear) for (let i = 0; i < 9; i++) { const aa = (deg + 12 + i * 4) * Math.PI / 180, r = HANDLE + 2 + (i % 3) * 3; if (i % 2 === 0) P.put(fx - Math.cos(aa) * r, fy - Math.sin(aa) * r, IRON[4]); }
  }
  // the hammer's four frames in a blow: raised, swinging, on the billet, rebounding. The fist moves a little with the arm.
  const POSE = [{ deg: 78, f: [123, 70] }, { deg: 45, f: [124, 70], smear: true }, { deg: 0, f: [125, 71] }, { deg: 38, f: [124, 70] }];

  // sparks of a strike: a seeded fan up from the billet, 1 px each, falling; drawn as a pure function of the ticks since the strike
  function sparks(P, x, y, since, seed, n, gold) {
    const r = rng(seed), cols = gold ? ["#fee761", "#feae34", "#ffffff", "#fff6c8"] : ["#fff6c8", "#fee761", "#feae34", "#f77622"];
    for (let i = 0; i < n; i++) {
      const ang = Math.PI * (1.05 + 0.9 * r()), sp = 2 + r() * 2.6, life = 3 + Math.floor(r() * 4), c = cols[i % cols.length];
      if (since < 0 || since > life) continue;
      const sx = x + Math.cos(ang) * sp * since, sy = y + Math.sin(ang) * sp * since + 0.35 * since * since;
      P.put(sx, sy, c); if (since < 2) P.put(sx - Math.cos(ang), sy - Math.sin(ang), cols[(i + 2) % cols.length]);
    }
  }

  // ------------------------------------------------------------------ one frame
  function frame(ctx, plan, t) {
    t = Math.max(0, Math.floor(t / STEP) * STEP);
    const W = plan.W || W0, ox = plan.ox || 0, P = painter(ctx, W, ox), ph = phaseAt(plan, t);
    const [A, B] = plan.things || [];
    const face = FACE;
    if (ph === "still") {
      // less motion: the billet on the anvil under the hammer's blow, then the result standing on the anvil
      if (has(plan.answerAt) && t >= plan.answerAt && plan.result) blit(P, plan.result, face.x - 16, face.y - N);
      else { billet(P, face.x, face.y - 3, 14, 0); hammer(P, POSE[2].f[0], POSE[2].f[1], POSE[2].deg, false); }
      ctx.putImageData(P.img, 0, 0); return ph;
    }
    if (ph === "fly") {
      // A leaves on tick 0, B on tick 1; each takes four steps on an arc into the hearth's mouth; the step that reaches it is hot
      for (const [thing, from, start] of [[A, plan.from[0], 0], [B, plan.from[1], 1]]) {
        const s = Math.floor(t / BEAT) - start + 1; if (s < 1 || s > T.fly) continue;
        const u = s / T.fly, x = from[0] + (MOUTH[0] - from[0]) * u, y = from[1] + (MOUTH[1] - from[1]) * u - 22 * 4 * u * (1 - u);
        blit(P, thing, Math.round(x), Math.round(y), s === T.fly ? hotMap : null);
      }
    } else if (ph === "melt") {
      // in the fire: the two melt into one white-hot billet; embers go up the chimney
      const s = Math.floor(t / BEAT) - (1 + T.fly);
      if (s === 0) { blit(P, A, MOUTH[0] - 3, MOUTH[1] + 6, hotMap); blit(P, B, MOUTH[0] + 3, MOUTH[1] + 6, hotMap); }
      else billet(P, 100, 76, 12, 0);
      sparks(P, 100, 74, s + 1, 11, 10, false);
    } else if (ph === "hop") {
      const s = Math.floor(t / BEAT) - (1 + T.fly + T.melt);
      billet(P, s === 0 ? 100 : face.x, s === 0 ? 70 : face.y - 3, 12, 0);
    } else if (ph === "done" && has(plan.failAt)) {
      // failed: nothing is left on the anvil (the page puts the two things back in their slots)
    } else if (ph === "blow" || ph === "fail") {
      const { k, f, b } = blowAt(t), struck = f >= 2 ? k + 1 : k;
      if (ph === "fail") {
        billet(P, face.x, face.y - 3, 12 + 2 * Math.min(3, struck), 3, t - Math.max(plan.failAt, FIRST_BLOW) >= 2 * BEAT);
        hammer(P, POSE[0].f[0], POSE[0].f[1], POSE[0].deg, false);
      } else {
        const pose = POSE[f];
        billet(P, face.x, face.y - 3, 12 + 2 * Math.min(3, struck), Math.max(0, struck - 1), false);
        hammer(P, pose.f[0], pose.f[1], pose.deg, !!pose.smear);
        if (f >= 2) sparks(P, face.x - 2, face.y - 4, Math.floor((b - STRIKE) / BEAT), 101 + k, 14, false);
      }
    } else if (ph === "last") {
      // the last blow lands: the billet flashes white under the hammer, and the sparks fly
      P.layer(); for (let i = -9; i <= 9; i++) for (let j = 0; j < 3; j++) P.put(face.x + i, face.y - 3 + j, "#ffffff"); P.outline();
      hammer(P, POSE[2].f[0], POSE[2].f[1], POSE[2].deg, false);
      sparks(P, face.x - 2, face.y - 4, 0, 997, 22, plan.gold);
    } else if (ph === "reveal" || ph === "done") {
      // out of the last blow: the result, white for a tick with rays, then itself in a ring of light, rising a pixel a tick; the smith
      // has stepped back with the hammer
      const since = Math.floor((Math.min(t, doneAt(plan) - 1) - strikeAt(plan)) / BEAT) - 1;
      const rise = Math.min(T.rise, Math.max(0, since - 1)) * 2;
      const rx = face.x - 16, ry = face.y - N + 1 - rise;
      if (since <= 1) rays(P, face.x, ry + 16, since === 0 ? 30 : 24, since === 0 ? "#ffffff" : "#fee761");
      if (plan.result) { halo(P, plan.result, rx, ry, since === 0 ? "#ffffff" : "#fff6c8"); blit(P, plan.result, rx, ry, since === 0 ? whiteMap : null); }
      sparks(P, face.x - 2, face.y - 4, since + 1, 997, 22, plan.gold);
      if (plan.gold && since >= 1) sparks(P, face.x, face.y - 18, since - 1, 777, 16, true);
    }
    if (zoomAt(plan, t) === 2 && !(ph === "done" && has(plan.failAt))) curtain(P, W, ox);
    ctx.putImageData(P.img, 0, 0);
    return ph;
  }
  // the curtain (pass 14): soot closing in from the sides, clear within CLEAR px of the anvil, dithered over the next CURTAIN px, then
  // solid; drawn straight into the image so it covers the arm and nothing outlines it
  function curtain(P, W, ox) {
    const cx = 100 + ox, d = P.img.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = (Math.abs(x + 0.5 - cx) - CLEAR) / CURTAIN; if (k <= 0) continue;
      if (k < 1 && BAYER4[(y & 3) * 4 + (x & 3)] >= k) continue;
      const i = (y * W + x) * 4; d[i] = 0x18; d[i + 1] = 0x14; d[i + 2] = 0x25; d[i + 3] = 255;
    }
  }

  // ------------------------------------------------------------------ the runner, on the page's clock
  // opts: { canvas, lens (the element that zooms), room (Smithy.mount's state: its heat), from, things, reduce, onStrike(last), onPhase(ph) }
  // run.answer(thing, gold): gold sparks for a first.
  // The run's moment t is read from the page's clock at each tick (the steps since the Strike, never fewer than one more than the last
  // tick's), not counted: pass 10's sketch counted its steps, and each frame's drawing time stretched a 2.67 s forge to about 3.1 s on
  // a Mac. Each tick is set for the next step's boundary; a late tick draws the moment it is at and lands any blow it passed. (Date.now,
  // not performance.now: under headless Chrome's virtual time, which the harness runs on, Date.now keeps step with the timers)
  const now = () => Date.now();
  function start(opts) {
    const ctx = opts.canvas.getContext("2d");
    const Wd = opts.W || W0, ox = Math.floor(Wd / 2) - 100;
    const plan = { from: opts.from.map(([x, y]) => [x - ox, y]), things: opts.things, answerAt: null, result: null, failAt: null, skipAt: null, reduce: !!opts.reduce, gold: false, W: Wd, ox };
    let t = 0, timer = 0, stopped = false, resolve, lastPh = null, lastStrike = -1;
    const t0 = now();
    const done = new Promise(r => { resolve = r; });
    const lens = opts.lens;
    function tick() {
      if (stopped) return;
      const ph = frame(ctx, plan, t);
      if (lens) lens.classList.toggle("near", zoomAt(plan, t) === 2);
      if (ph !== lastPh) { lastPh = ph; if (opts.onPhase) opts.onPhase(ph); if (ph === "melt" && opts.room) opts.room.heat = 1; }
      const st = strikesUpTo(plan, t).slice(-1)[0];
      if (!plan.reduce && opts.onStrike && st !== undefined && st > lastStrike) { lastStrike = st; opts.onStrike(ph === "last"); }
      if (ph === "done") { resolve(has(plan.failAt) ? "failed" : "revealed"); return; }
      const next = t + STEP, elapsed = now() - t0;
      t = Math.max(next, Math.floor(elapsed / STEP) * STEP);
      timer = setTimeout(tick, Math.max(1, Math.min(STEP, t - elapsed)));
    }
    tick();
    return {
      plan, done,
      get ms() { return t; },
      answer(thing, gold) { if (plan.answerAt === null && plan.failAt === null) { plan.result = thing; plan.gold = !!gold; plan.answerAt = t; } },
      fail() { if (plan.failAt === null && plan.answerAt === null) plan.failAt = t; },
      skip() { if (plan.answerAt !== null && plan.skipAt === null && !plan.reduce) plan.skipAt = t; },
      stop() { stopped = true; clearTimeout(timer); ctx.clearRect(0, 0, Wd, H); if (lens) lens.classList.remove("near"); },
      // the harness's pictures: stop the clock and draw one moment as it would be
      hold(at) { stopped = true; clearTimeout(timer); if (at !== undefined) { frame(ctx, plan, at); if (lens) lens.classList.toggle("near", zoomAt(plan, at) === 2); } }
    };
  }

  root.ForgeFx = { frame, zoomAt, phaseAt, doneAt, strikeAt, strikesUpTo, blowAt, start, T, STEP, BEAT, POSE_MS, BLOW, STRIKE, FIRST_BLOW, REVEAL, MOUTH, FACE, POSE, W: W0, H, CLEAR, CURTAIN, TICK: BEAT };
})(typeof window !== "undefined" ? window : globalThis);
