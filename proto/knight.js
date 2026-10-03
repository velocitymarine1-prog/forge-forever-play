// FORGE FOREVER: the knight (design pass 7 section 3.5, revised by card t64; built by card t65; design pass 12 sections 3.8 and 3.12,
// built by build 7 stage H).
// The hero of the Battlegrounds for now: a very basic pixel knight, 32 x 32, drawn in code from shapes the way the renderer draws
// Things (masks, light from the top left, four-tone ramps, a soot outline): a steel great helm with a T visor and a red plume, steel
// pauldrons, arms and greaves, a crimson tabard with a gold mark, a leather belt and boots. Its feet stand on the bottom row, so it
// shares the grid of every weapon. Three drawings (down, up, side; the side mirrored for left) and the frames idle, walk, wind,
// strike, recover and bonk. Every frame names the pixel of the weapon hand, and the side drawing also comes with its near arm held
// out at chest height: reach 1 for a thing held in front (a spellbook), reach 2 the straight bow arm, 3 px longer.
// Design pass 12 (the Troll Gate) adds the frames a real fight needs: hurt (the blink after a hit), down (kneeling), crawl (two),
// climb (two, the back view with the arms up, whatever the facing), fall and teeter; the status overlays (burning on two frames,
// chill, frozen), made from any frame's own pixels; the carried ram; and a look: each seat's colour on the plume and the band of the
// tabard (seat 0 white, 1 cyan, 2 yellow, 3 rose) and the sword-brothers' plain steel-grey kit. A frame asked for with four
// arguments, as the rules and the cellar ask, is the cellar's knight, pixel for pixel: alone, the player is the cellar's knight.
// Pass 1's four heroes replace it later through the same interface. The pixels are made without a DOM, so node can check them;
// canvases are made only when a page asks. Plain script, defines window.Knight. Needs no other file.
(function (root) {
  "use strict";
  const N = 32, OUT = "#181425";
  const R = {
    steel: ["#3a4466", "#5a6988", "#8b9bb4", "#c0cbdc"], iron: ["#262b44", "#3a4466", "#5a6988", "#8b9bb4"], red: ["#a22633", "#e43b44", "#f6757a", "#ffd0c8"],
    leather: ["#2a1d28", "#3e2731", "#733e39", "#b86f50"], gold: ["#be4a2f", "#f77622", "#feae34", "#fee761"], oak: ["#3e2731", "#733e39", "#b86f50", "#e4a672"]
  };
  // the four facings and the drawing each uses: right and left the side drawing (left mirrored), away the back, toward the front
  const FACINGS = ["right", "left", "away", "toward"];
  const DRAWING = { right: ["side", false], left: ["side", true], away: ["up", false], toward: ["down", false] };
  const ANIMS = { idle: 2, walk: 4, wind: 1, strike: 1, recover: 1, bonk: 1, hurt: 1, down: 1, crawl: 2, climb: 2, fall: 1, teeter: 1 };
  // the seats' colours (design pass 12 section 3.12): none green, so no knight reads as a troll, none red, so none reads as a warning.
  // SEATS is the colour itself; SEAT_RAMP lights it for the plume (dark, the colour, lit, glint)
  const SEATS = ["#ffffff", "#2ce8f5", "#fee761", "#b55088"];
  const SEAT_RAMP = [["#c0cbdc", "#ffffff", "#ffffff", "#ffffff"], ["#0099db", "#2ce8f5", "#b8f4ff", "#ffffff"], ["#feae34", "#fee761", "#fffaf0", "#ffffff"], ["#68386c", "#b55088", "#b55088", "#ffc0c8"]];
  const KITS = ["knight", "brother"];
  const CARRY = ["ram"];
  // the overlays (design pass 12 section 3.12), each still under reduced motion: burning on two frames, chill and frozen on one
  const OVERLAYS = { burning: 2, chill: 1, frozen: 1 };

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

  // ------------------------------------------------------------------ the look: whose knight it is
  // L: { plume, tabard (ramps), band (a ramp or null: the seat's band across the tabard's hem), mark (the gold mark), carry }. The
  // cellar's knight is a red plume on a crimson tabard with the gold mark and no band; a seat puts its colour on the plume and the band;
  // a sword-brother wears it on a plain steel-grey tabard with no mark
  function lookOf(o) {
    o = o || {};
    const seat = o.seat === 0 || o.seat === 1 || o.seat === 2 || o.seat === 3 ? o.seat : null, brother = o.kit === "brother";
    const carry = CARRY.includes(o.carry) ? o.carry : null;
    if (seat === null && !brother) return { key: carry ? "|" + carry : "", plume: R.red, tabard: R.red, band: null, mark: true, carry, seat: null, kit: "knight" };
    const s = seat === null ? 0 : seat;
    return { key: "|" + s + (brother ? "b" : "k") + (carry ? carry : ""), plume: SEAT_RAMP[s], tabard: brother ? R.iron : R.red, band: SEAT_RAMP[s], mark: !brother, carry, seat: s, kit: brother ? "brother" : "knight" };
  }
  const CELLAR = lookOf(null);

  // ------------------------------------------------------------------ the three drawings
  // pose: { step (-1, 0, 1: which leg leads), bob (0 or 1), lean (side only), arm ([dx, dy] of the weapon arm), reach (0, 1, 2) }
  function draw(drawing, pose, L) {
    pose = pose || {}; L = L || CELLAR; const sp = new Grid(), step = pose.step || 0, B = pose.bob || 0, X = drawing === "side" ? (pose.lean || 0) : 0;
    const STEEL = R.steel, DARK = R.iron, LEATHER = R.leather, GOLD = R.gold, CLOTH = L.tabard, PLUME = L.plume;
    let hand;
    if (drawing === "down" || drawing === "up") {
      const lA = step > 0 ? -1 : 0, lB = step < 0 ? -1 : 0;
      region(sp, rect(12, 24 + lA, 14, 29 + lA), STEEL); region(sp, rect(17, 24 + lB, 19, 29 + lB), STEEL);
      region(sp, rect(11, 29 + lA, 14, 30 + lA), LEATHER); region(sp, rect(17, 29 + lB, 20, 30 + lB), LEATHER);
      region(sp, rect(11, 21 + B, 20, 25 + B), CLOTH);
      if (L.band) region(sp, rect(11, 24 + B, 20, 25 + B), L.band, { flat: 1 });
      region(sp, rect(10, 20 + B, 21, 21 + B), LEATHER, { flat: 2 });
      if (drawing === "down" && L.mark) { sp.set(15, 20 + B, GOLD[2]); sp.set(16, 20 + B, GOLD[3]); sp.set(15, 21 + B, GOLD[1]); sp.set(16, 21 + B, GOLD[2]); }
      region(sp, rect(10, 13 + B, 21, 19 + B), STEEL);
      region(sp, rect(12, 13 + B, 19, 19 + B), CLOTH);
      if (drawing === "down" && L.mark) for (const [x, y] of [[15, 15], [16, 15], [14, 16], [15, 16], [16, 16], [17, 16], [15, 17], [16, 17]]) sp.set(x, y + B, (x + y) % 2 ? GOLD[2] : GOLD[3]);
      const armL = pose.arm && drawing === "up" ? pose.arm : [0, 0], armR = pose.arm && drawing === "down" ? pose.arm : [0, 0];
      if (L.carry && drawing === "up") ram(sp, "up", pose);   // facing away the log is in front of the knight, so behind it on the screen
      region(sp, rect(7 + armL[0], 15 + B + armL[1], 9 + armL[0], 20 + B + armL[1]), STEEL); region(sp, rect(22 + armR[0], 15 + B + armR[1], 24 + armR[0], 20 + B + armR[1]), STEEL);
      region(sp, rect(7 + armL[0], 20 + B + armL[1], 9 + armL[0], 22 + B + armL[1]), DARK); region(sp, rect(22 + armR[0], 20 + B + armR[1], 24 + armR[0], 22 + B + armR[1]), DARK);
      region(sp, ell(9, 14 + B, 3, 2.4), STEEL, { spec: (x, y) => x === 8 && y === 13 + B }); region(sp, ell(22, 14 + B, 3, 2.4), STEEL, { spec: (x, y) => x === 21 && y === 13 + B });
      region(sp, or(rect(10, 4 + B, 21, 12 + B), ell(15.5, 5 + B, 6, 2.5)), STEEL, { spec: (x, y) => (x === 12 && y === 5 + B) || (x === 13 && y === 4 + B) });
      if (drawing === "down") {
        for (let x = 11; x <= 20; x++) sp.set(x, 8 + B, OUT);
        for (let y = 9; y <= 11; y++) { sp.set(15, y + B, OUT); sp.set(16, y + B, OUT); }
        for (const [x, y] of [[12, 10], [13, 11], [18, 10], [19, 11]]) sp.set(x, y + B, DARK[0]);
      } else for (let y = 5; y <= 12; y++) sp.set(15, y + B, STEEL[0]);
      region(sp, or(ell(15.5, 2 + B, 2.2, 2), rect(15, 0 + B, 16, 3 + B)), PLUME, { spec: (x, y) => x === 15 && y === 1 + B });
      hand = drawing === "down" ? [23 + armR[0], 21 + B + armR[1]] : [8 + armL[0], 21 + B + armL[1]];
      if (L.carry && drawing === "down") hand = ram(sp, "down", pose);
    } else {
      const back = step > 0 ? -2 : step < 0 ? 2 : 0, fwd = -back;
      region(sp, rect(13 + back, 24, 15 + back, 29), DARK); region(sp, rect(12 + back, 29, 16 + back, 30), LEATHER, { flat: 1 });
      region(sp, rect(15 + fwd, 24, 17 + fwd, 29), STEEL); region(sp, rect(15 + fwd, 29, 19 + fwd, 30), LEATHER);
      region(sp, rect(11 + X, 21 + B, 19 + X, 25 + B), CLOTH);
      if (L.band) region(sp, rect(11 + X, 24 + B, 19 + X, 25 + B), L.band, { flat: 1 });
      region(sp, rect(11 + X, 20 + B, 19 + X, 21 + B), LEATHER, { flat: 2 });
      region(sp, rect(11 + X, 13 + B, 19 + X, 19 + B), STEEL);
      region(sp, rect(13 + X, 13 + B, 18 + X, 19 + B), CLOTH);
      region(sp, ell(14.5 + X, 14 + B, 3.4, 2.4), STEEL, { spec: (x, y) => x === 13 + X && y === 13 + B });
      region(sp, or(rect(10 + X, 4 + B, 20 + X, 12 + B), ell(15 + X, 5 + B, 5.5, 2.5)), STEEL, { spec: (x, y) => x === 12 + X && y === 5 + B });
      for (let x = 17; x <= 20; x++) sp.set(x + X, 8 + B, OUT);
      sp.set(19 + X, 10 + B, DARK[0]); sp.set(20 + X, 11 + B, DARK[0]);
      region(sp, or(ell(13 + X, 2 + B, 3, 1.8), rect(13 + X, 0 + B, 14 + X, 3 + B), ell(10 + X, 3 + B, 2, 1.4)), PLUME, { spec: (x, y) => x === 12 + X && y === 1 + B });
      const arm = pose.arm || [0, 0];
      if (L.carry) hand = ram(sp, "side", pose);
      else if (pose.reach) {
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
  // the Last Army's Ram, carried (design pass 12 section 3.4): an iron-capped oak log held level across the body in both hands, pulled
  // back for the wind and driven forward at the strike. Drawn into the knight's grid; returns the near hand's pixel
  function ram(sp, drawing, pose) {
    const B = pose.bob || 0, X = drawing === "side" ? (pose.lean || 0) : 0, arm = pose.arm || [0, 0];
    const shove = arm[0] > 1 ? 3 : arm[0] < 0 ? -3 : arm[0] > 0 ? 1 : 0, lift = arm[1] < -1 ? -1 : 0;
    const OAK = R.oak, IRON = R.iron, STEEL = R.steel;
    if (drawing === "side") {
      const y = 18 + B + lift, x0 = 6 + X + shove, x1 = 26 + X + shove;
      region(sp, rect(x0, y, x1 - 3, y + 2), OAK, { spec: (x, yy) => yy === y && x % 5 === 2 });
      region(sp, rect(x1 - 3, y - 1, x1, y + 3), IRON, { spec: (x, yy) => x === x1 - 3 && yy === y - 1 });
      // the near arm reaches down to the log; the far hand grips it behind, by the belt
      const hx = 17 + X + shove;
      region(sp, rect(16 + X, 15 + B, 18 + X, y - 1), STEEL); region(sp, rect(hx - 1, y - 1, hx + 1, y + 1), R.iron);
      region(sp, rect(10 + X + shove, y - 1, 12 + X + shove, y + 1), R.iron);
      return [hx, y];
    }
    // toward and away: the log across the body at the hips, its iron cap on the right; the hands on it either side of the belt
    const y = 21 + B + lift, x0 = 4, x1 = 27;
    region(sp, rect(x0, y, x1 - 3, y + 2), OAK, { spec: (x, yy) => yy === y && x % 5 === 2 });
    region(sp, rect(x1 - 3, y - 1, x1, y + 3), IRON, { spec: (x, yy) => x === x1 - 3 && yy === y - 1 });
    if (drawing === "down") {
      region(sp, rect(8, 20 + B, 10, y + 1), STEEL); region(sp, rect(21, 20 + B, 23, y + 1), STEEL);
      region(sp, rect(8, y, 10, y + 2), IRON); region(sp, rect(21, y, 23, y + 2), IRON);
      return [22, y + 1];
    }
    return [9, y + 1];
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

  // ------------------------------------------------------------------ the frames of a real fight (design pass 12)
  // The same parts as draw(), placed by part: P = { hip (the belt's row), lean (the upper body's x, side), head ([dx, dy] of the helm),
  // legs (a list of { x, y0, y1, boot: [x0, x1], far }), arms (a list of { x0, y0, x1, y1, fist: [x0, y0, x1, y1], far }), plume
  // ("up" streams it up), back (the drawing has no face) }. The torso is the hip's 7 rows above it, the skirt the 4 below.
  function drawParts(drawing, P, L) {
    if (P.prone !== undefined) return drawProne(P.prone, L);
    const sp = new Grid(), STEEL = R.steel, DARK = R.iron, LEATHER = R.leather, GOLD = R.gold, CLOTH = L.tabard, PLUME = L.plume;
    const side = drawing === "side", hip = P.hip, X = P.lean || 0, hx = (P.head || [0, 0])[0], hy = (P.head || [0, 0])[1];
    const limb = (a, ramp) => { region(sp, rect(a.x0, a.y0, a.x1, a.y1), ramp); if (a.fist) region(sp, rect(a.fist[0], a.fist[1], a.fist[2], a.fist[3]), DARK); };
    for (const a of P.arms) if (a.behind) limb(a, a.far ? DARK : STEEL);   // an arm behind the body, drawn first
    for (const g of P.legs) { region(sp, rect(g.x, g.y0, g.x + 2, g.y1), g.far ? DARK : STEEL); if (g.boot) region(sp, rect(g.boot[0], g.y1, g.boot[1], g.y1 + 1), LEATHER, g.far ? { flat: 1 } : undefined); if (g.shin) region(sp, rect(g.shin[0], g.shin[1], g.shin[2], g.shin[3]), g.far ? DARK : STEEL); }
    const sx0 = side ? 11 + X : 11, sx1 = side ? 19 + X : 20, skirt = P.skirt || 4;
    region(sp, rect(sx0, hip + 1, sx1, hip + skirt), CLOTH);
    if (L.band) region(sp, rect(sx0, hip + skirt - 1, sx1, hip + skirt), L.band, { flat: 1 });
    for (const [cx, cy, rx, ry] of P.knees || []) region(sp, ell(cx, cy, rx, ry), STEEL, { spec: (x, y) => x === Math.floor(cx) - 1 && y === Math.floor(cy - ry + 0.5) });   // a knee in front of the skirt
    region(sp, rect(side ? 11 + X : 10, hip, side ? 19 + X : 21, hip + 1), LEATHER, { flat: 2 });
    if (drawing === "down" && L.mark) { sp.set(15, hip, GOLD[2]); sp.set(16, hip, GOLD[3]); sp.set(15, hip + 1, GOLD[1]); sp.set(16, hip + 1, GOLD[2]); }
    const t0 = hip - 7;
    if (side) {
      region(sp, rect(11 + X, t0, 19 + X, hip - 1), STEEL);
      region(sp, rect(13 + X, t0, 18 + X, hip - 1), CLOTH);
      region(sp, ell(14.5 + X, t0 + 1, 3.4, 2.4), STEEL, { spec: (x, y) => x === 13 + X && y === t0 });
    } else {
      region(sp, rect(10, t0, 21, hip - 1), STEEL);
      region(sp, rect(12, t0, 19, hip - 1), CLOTH);
      if (drawing === "down" && L.mark && !P.back) for (const [x, y] of [[15, 2], [16, 2], [14, 3], [15, 3], [16, 3], [17, 3], [15, 4], [16, 4]]) sp.set(x, t0 + y, (x + y) % 2 ? GOLD[3] : GOLD[2]);
    }
    for (const a of P.arms) if (!a.behind && !a.over) limb(a, a.far ? DARK : STEEL);
    if (!side) { region(sp, ell(9, t0 + 1, 3, 2.4), STEEL, { spec: (x, y) => x === 8 && y === t0 }); region(sp, ell(22, t0 + 1, 3, 2.4), STEEL, { spec: (x, y) => x === 21 && y === t0 }); }
    // the helm: 9 rows over the torso, moved by the head
    const h0 = t0 - 9 + hy;
    if (side) {
      const hX = X + hx;
      region(sp, or(rect(10 + hX, h0, 20 + hX, h0 + 8), ell(15 + hX, h0 + 1, 5.5, 2.5)), STEEL, { spec: (x, y) => x === 12 + hX && y === h0 + 1 });
      for (let x = 17; x <= 20; x++) sp.set(x + hX, h0 + 4, OUT);
      sp.set(19 + hX, h0 + 6, DARK[0]); sp.set(20 + hX, h0 + 7, DARK[0]);
      if (P.plume === "up") region(sp, or(ell(13 + hX, h0 - 2, 2, 2.4), rect(13 + hX, h0 - 4, 14 + hX, h0)), PLUME, { spec: (x, y) => x === 13 + hX && y === h0 - 3 });
      else region(sp, or(ell(13 + hX, h0 - 2, 3, 1.8), rect(13 + hX, h0 - 4, 14 + hX, h0 - 1), ell(10 + hX, h0 - 1, 2, 1.4)), PLUME, { spec: (x, y) => x === 12 + hX && y === h0 - 3 });
    } else {
      region(sp, or(rect(10 + hx, h0, 21 + hx, h0 + 8), ell(15.5 + hx, h0 + 1, 6, 2.5)), STEEL, { spec: (x, y) => (x === 12 + hx && y === h0 + 1) || (x === 13 + hx && y === h0) });
      if (drawing === "down" && !P.back) {
        for (let x = 11; x <= 20; x++) sp.set(x + hx, h0 + 4, OUT);
        for (let y = 5; y <= 7; y++) { sp.set(15 + hx, h0 + y, OUT); sp.set(16 + hx, h0 + y, OUT); }
        for (const [x, y] of [[12, 6], [13, 7], [18, 6], [19, 7]]) sp.set(x + hx, h0 + y, DARK[0]);
      } else for (let y = 1; y <= 8; y++) sp.set(15 + hx, h0 + y, STEEL[0]);
      region(sp, or(ell(15.5 + hx, h0 - 2, 2.2, 2), rect(15 + hx, h0 - 4, 16 + hx, h0 - 1)), PLUME, { spec: (x, y) => x === 15 + hx && y === h0 - 3 });
    }
    for (const a of P.arms) if (a.over) limb(a, a.far ? DARK : STEEL);   // an arm raised over the helm
    outline(sp);
    sp.hand = P.hand;
    return sp;
  }
  // the side crawl, on hands and knees: the back level at the hips' height, the helm leading, the near arm straight down to the ground
  // (reaching ahead on frame 1), the thighs down to the knees and the shins back along the ground (the near knee forward on frame 1)
  function drawProne(r, L) {
    const sp = new Grid(), STEEL = R.steel, DARK = R.iron, LEATHER = R.leather, CLOTH = L.tabard, PLUME = L.plume;
    region(sp, rect(8, 22, 10, 28), DARK); region(sp, rect(3, 28, 9, 29), DARK); region(sp, rect(1, 29, 3, 30), LEATHER, { flat: 1 });
    region(sp, rect(16, 20, 18, 27), DARK); region(sp, rect(16, 28, 18, 29), DARK);   // the far arm, behind
    region(sp, rect(11, 21, 18, 25), CLOTH);
    if (L.band) region(sp, rect(11, 24, 18, 25), L.band, { flat: 1 });
    region(sp, rect(10 + 2 * r, 22, 12 + 2 * r, 28), STEEL); region(sp, rect(5 + 2 * r, 29, 11 + 2 * r, 30), STEEL); region(sp, rect(3 + 2 * r, 29, 5 + 2 * r, 30), LEATHER);
    region(sp, rect(9, 17, 19, 22), STEEL);
    region(sp, rect(13, 18, 18, 22), CLOTH);
    region(sp, rect(11, 17, 12, 23), LEATHER, { flat: 2 });
    region(sp, ell(18, 18, 3, 2.2), STEEL, { spec: (x, y) => x === 17 && y === 16 });
    let hand;
    if (r) { region(sp, rect(20, 20, 22, 24), STEEL); region(sp, rect(22, 24, 24, 27), STEEL); region(sp, rect(23, 28, 25, 29), DARK); hand = [24, 28]; }
    else { region(sp, rect(19, 20, 21, 27), STEEL); region(sp, rect(19, 28, 22, 29), DARK); hand = [20, 28]; }
    region(sp, or(rect(19, 13, 27, 21), ell(23, 14, 4.5, 2)), STEEL, { spec: (x, y) => x === 21 && y === 13 });
    for (let x = 24; x <= 27; x++) sp.set(x, 17, OUT);
    sp.set(26, 19, DARK[0]); sp.set(27, 20, DARK[0]);
    region(sp, or(ell(20, 11, 3, 1.6), rect(20, 10, 21, 12), ell(17, 12, 2, 1.2)), PLUME, { spec: (x, y) => x === 19 && y === 10 });
    outline(sp);
    sp.hand = hand;
    return sp;
  }
  // the parts of the new frames for a drawing
  function partsOf(drawing, anim, i) {
    const side = drawing === "side";
    const stand = d => d === "side"
      ? [{ x: 13, y0: 24, y1: 29, boot: [12, 16], far: true }, { x: 15, y0: 24, y1: 29, boot: [15, 19] }]
      : [{ x: 12, y0: 24, y1: 29, boot: [11, 14] }, { x: 17, y0: 24, y1: 29, boot: [17, 20] }];
    if (anim === "hurt") {
      // the blink after a hit: thrown back, the arms flung up and out, the helm knocked back
      if (side) return { hip: 21, lean: -2, head: [-1, 0], legs: [{ x: 14, y0: 24, y1: 29, boot: [13, 17], far: true }, { x: 16, y0: 24, y1: 29, boot: [16, 20] }],
        arms: [{ x0: 11, y0: 10, x1: 13, y1: 15, fist: [11, 8, 13, 9], over: true }], hand: [12, 9] };
      return { hip: 21, head: [0, -1], legs: stand(drawing), arms: [{ x0: 6, y0: 11, x1: 8, y1: 16, fist: [6, 9, 8, 10] }, { x0: 23, y0: 11, x1: 25, y1: 16, fist: [23, 9, 25, 10] }],
        back: drawing === "up", hand: drawing === "down" ? [24, 10] : [7, 10] };
    }
    if (anim === "down") {
      // kneeling, the head bowed: the near knee up, the far knee on the ground; a hand on the knee
      if (side) return { hip: 24, lean: 1, head: [1, 1], skirt: 3,
        legs: [{ x: 12, y0: 26, y1: 29, far: true, shin: [7, 29, 12, 30] }, { x: 18, y0: 27, y1: 29, boot: [18, 22], shin: [15, 25, 20, 27] }],
        arms: [{ x0: 19, y0: 19, x1: 21, y1: 24, fist: [19, 25, 21, 26] }], hand: [20, 25] };
      // from the front or behind: one knee raised before the skirt with a hand on it, the other on the ground, the free hand down to it
      return { hip: 26, head: [0, 1], skirt: 2, legs: [{ x: 10, y0: 28, y1: 29, boot: [9, 13] }, { x: 17, y0: 29, y1: 30 }],
        knees: [[11.5, 28, 2.6, 1.6], [18.5, 29.5, 2.2, 1.2]],
        arms: [{ x0: 7, y0: 21, x1: 9, y1: 25, fist: [8, 26, 10, 27] }, { x0: 22, y0: 21, x1: 24, y1: 27, fist: [22, 28, 24, 29] }], back: drawing === "up", hand: drawing === "down" ? [23, 28] : [9, 26] };
    }
    if (anim === "crawl") {
      // dragging itself along on its knees and one hand: the body low, the reaching hand and the knees changing over
      const r = i % 2;
      if (side) return { prone: r };
      return { hip: 26, head: [0, 3], skirt: 2, legs: [{ x: 12, y0: 28 - r, y1: 29, boot: [11, 14] }, { x: 17, y0: 27 + r, y1: 29, boot: [17, 20] }],
        arms: [{ x0: 6, y0: 21 + r, x1: 8, y1: 27, fist: [5, 28 - r, 8, 29 - r] }, { x0: 23, y0: 22 - r, x1: 25, y1: 27, fist: [23, 27 + r, 26, 28 + r] }],
        back: drawing === "up", hand: drawing === "down" ? [24, 28] : [7, 28] };
    }
    if (anim === "climb") {
      // on the ladder, seen from behind whatever the facing: the hands high on the rungs, one leg up a rung, changing over
      const r = i % 2;
      return { hip: 20, back: true, legs: [{ x: 12, y0: 24 - 2 * r, y1: 29 - 2 * r, boot: [11, 14] }, { x: 17, y0: 22 + 2 * r, y1: 27 + 2 * r, boot: [17, 20] }],
        arms: [{ x0: 7, y0: 3 + 3 * r, x1: 9, y1: 13, fist: [7, 1 + 3 * r, 9, 2 + 3 * r], over: true }, { x0: 22, y0: 6 - 3 * r, x1: 24, y1: 13, fist: [22, 4 - 3 * r, 24, 5 - 3 * r], over: true }],
        hand: [8, 2 + 3 * r] };
    }
    if (anim === "fall") {
      // in the air: the arms thrown up, the legs apart, the plume streaming up
      if (side) return { hip: 20, lean: -1, plume: "up", legs: [{ x: 11, y0: 24, y1: 29, boot: [10, 14], far: true }, { x: 17, y0: 24, y1: 29, boot: [17, 21] }],
        arms: [{ x0: 18, y0: 5, x1: 20, y1: 13, fist: [18, 3, 20, 4], over: true }], hand: [19, 4] };
      return { hip: 20, legs: [{ x: 10, y0: 24, y1: 29, boot: [9, 12] }, { x: 19, y0: 24, y1: 29, boot: [19, 22] }],
        arms: [{ x0: 6, y0: 6, x1: 8, y1: 13, fist: [6, 4, 8, 5], over: true }, { x0: 23, y0: 6, x1: 25, y1: 13, fist: [23, 4, 25, 5], over: true }],
        back: drawing === "up", hand: drawing === "down" ? [24, 5] : [7, 5] };
    }
    // teeter: on a ledge's edge, leaning out over it, the arms out to catch the balance
    if (side) return { hip: 20, lean: 2, head: [1, 0], legs: [{ x: 12, y0: 24, y1: 29, boot: [11, 15], far: true }, { x: 14, y0: 24, y1: 29, boot: [14, 18] }],
      arms: [{ x0: 20, y0: 8, x1: 22, y1: 14, fist: [20, 6, 22, 7], over: true }, { x0: 8, y0: 14, x1: 12, y1: 16, fist: [6, 14, 7, 16], far: true, behind: true }], hand: [21, 7] };
    return { hip: 20, legs: [{ x: 12, y0: 23, y1: 28, boot: [11, 14] }, { x: 17, y0: 24, y1: 29, boot: [17, 20] }],
      arms: [{ x0: 3, y0: 13, x1: 8, y1: 15, fist: [1, 12, 2, 15] }, { x0: 23, y0: 16, x1: 28, y1: 18, fist: [29, 15, 30, 18] }],
      back: drawing === "up", hand: drawing === "down" ? [29, 16] : [2, 13] };
  }
  const MORE = { hurt: 1, down: 1, crawl: 1, climb: 1, fall: 1, teeter: 1 };

  // ------------------------------------------------------------------ the overlays
  // made from a frame's own pixels, for any square grid of n (a troll's too): burning, 3 px tongues of flame, #f77622 over #feae34,
  // rising from the top of the body at every fourth column, the columns moving on frame 1; chill, the outline's pixels pale #8b9bb4 (a
  // rim on the outline); frozen, a 1 px #c0cbdc shell round the outline with #ffffff glints. Returns a pixel array of n x n (null where
  // nothing is drawn), to draw over the frame
  function overlayPx(px, n, kind, i) {
    const out = new Array(n * n).fill(null), at = (x, y) => x >= 0 && y >= 0 && x < n && y < n ? px[y * n + x] : null;
    const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < n && y < n) out[y * n + x] = c; };
    if (kind === "burning") {
      const f = (i | 0) % 2;
      for (let x = 0; x < n; x++) {
        if (x % 4 !== (f ? 3 : 1)) continue;
        let top = -1; for (let y = 0; y < n; y++) if (at(x, y)) { top = y; break; }
        if (top < 0) continue;
        const base = Math.max(top + 1, 3);
        put(x, base, "#feae34"); put(x, base - 1, "#feae34"); put(x, base - 2, "#f77622");
      }
    } else if (kind === "chill") {
      for (let k = 0; k < n * n; k++) if (px[k] === OUT) out[k] = "#8b9bb4";
    } else if (kind === "frozen") {
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        if (at(x, y) || !(at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1))) continue;
        put(x, y, (x * 3 + y * 5) % 11 === 0 ? "#ffffff" : "#c0cbdc");
      }
    }
    return out;
  }

  // ------------------------------------------------------------------ the frames
  const cache = new Map();
  // Knight.frame(facing, anim, i, reach, look) -> { px, hand, facing, anim, i, reach, seat, kit, carry, canvas(), white(), over(kind, i) }
  //   facing: right | left | away | toward (anything else is drawn as right); anim: idle | walk | wind | strike | recover | bonk | hurt |
  //   down | crawl | climb | fall | teeter (anything else is idle); climb is the back view whatever the facing
  //   reach: 0 the hanging arm, 1 the arm held out, 2 the straight bow arm (right and left only; away and toward keep the hanging arm;
  //   the new frames of design pass 12 and a carried ram keep their own arms)
  //   look (optional): { seat: 0 to 3, kit: "knight" | "brother", carry: "ram" }; without one the frame is the cellar's knight. A carried
  //   ram is drawn on idle, walk, wind, strike, recover and hurt (a knight who goes down, climbs or falls has put it down)
  function frame(facing, anim, i, reach, look) {
    if (!DRAWING[facing]) facing = "right";
    if (!ANIMS[anim]) anim = "idle";
    i = (i | 0) % ANIMS[anim];
    const L0 = look ? lookOf(look) : CELLAR, carry = L0.carry && ["idle", "walk", "wind", "strike", "recover", "hurt"].includes(anim) ? L0.carry : null;
    const L = carry === L0.carry ? L0 : lookOf(Object.assign({}, look, { carry: null }));
    if (anim === "climb") facing = "away";
    const [drawing, flip] = DRAWING[facing];
    reach = drawing === "side" && !MORE[anim] && !carry ? (reach === true ? 1 : Math.max(0, Math.min(2, reach | 0))) : 0;
    const key = facing + "|" + anim + "|" + i + "|" + reach + L.key;   // the key names the arm, so the book never takes the bow's
    if (cache.has(key)) return cache.get(key);
    let sp;
    if (carry && anim === "hurt") sp = draw(drawing, poseOf(drawing, "bonk", 0), L);   // hurt with the ram: thrown back, the log still held
    else if (MORE[anim]) sp = drawParts(drawing, partsOf(drawing, anim, i), L);
    else { const pose = poseOf(drawing, anim, i); pose.reach = reach; sp = draw(drawing, pose, L); }
    let px = sp.px, hand = sp.hand.slice();
    if (flip) { px = new Array(N * N).fill(null); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) px[y * N + (N - 1 - x)] = sp.px[y * N + x]; hand = [N - 1 - hand[0], hand[1]]; }
    const out = { px, hand, facing, anim, i, reach, seat: L.seat, kit: L.kit, carry, w: N, h: N, _c: null, _w: null, _o: null,
      canvas() { return this._c || (this._c = toCanvas(px, null)); },
      white() { return this._w || (this._w = toCanvas(px, "#ffffff")); },
      // a status overlay over this frame: { px, canvas() }
      over(kind, k) {
        if (!OVERLAYS[kind]) return null;
        k = (k | 0) % OVERLAYS[kind];
        const o = this._o || (this._o = {}), ok = kind + k;
        if (!o[ok]) { const opx = overlayPx(px, N, kind, k); o[ok] = { px: opx, kind, i: k, canvas() { return this._c || (this._c = toCanvas(opx, null)); } }; }
        return o[ok];
      } };
    cache.set(key, out);
    return out;
  }
  function toCanvas(px, tint) {
    const c = root.document.createElement("canvas"); c.width = N; c.height = N; const g = c.getContext("2d");
    for (let k = 0; k < N * N; k++) { const col = px[k]; if (!col) continue; g.fillStyle = tint && col !== OUT ? tint : col; g.fillRect(k % N, (k / N) | 0, 1, 1); }
    return c;
  }
  // the weapon hand's pixel in a frame
  function hand(facing, anim, i, reach, look) { return frame(facing, anim, i, reach, look).hand.slice(); }

  root.Knight = { N, OUT, FACINGS, DRAWING, ANIMS, SEATS, SEAT_RAMP, KITS, CARRY, OVERLAYS, frame, hand, poseOf, overlayPx };
  if (typeof module !== "undefined" && module.exports) module.exports = root.Knight;
})(typeof window !== "undefined" ? window : globalThis);
