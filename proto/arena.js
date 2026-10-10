// FORGE FOREVER: the Arena's painter (design pass 36 with its revision 1; built 9 October 2026 on Isaac's word, track P of the build).
// The colosseum on the sands where knights fight knights: one world 448 x 216 (the pit, 1v1 and 2v2) or 640 x 216 (the great sand, 3v3
// and 4v4), drawn in the cellar's grammar from the pass's pictures (docs/design/36-shots/scene.html): a pale desert sky under a striped
// awning slung from poles, the sun high at the left, three tiers of sun-bleached stone with a vomitorium every 64 px and the crowd on
// them (two rows of heads a tier, their cloth in eight colours, placed by hash so it is the same crowd every bout), the podium wall of
// ashlar with its cornice, a portcullis gate in it at each end (the west gate the red side's, the east the blue's) and the editor's box
// in the middle (a shaded loggia, the editor in gold, three guests, the two sides' pennants, a banner cloth with the knights' names), and
// the sand: raked, scuffed, keeping its marks (blood, craters, scorch) the whole bout.
//
// It plugs into the Troll Gate's painter (proto/gate.js) as an art module, the way the Great Hall's and the Keep's do:
// new Gate.Scene(area, Arena.art), the area being one of spec/arena.json's sands (w, h, floor, room, marks) with art: "Arena". What
// Arena.art supplies:
//   paintRows(A, col, y0, y1, px)  the column tiles of 384 x 432: the still colosseum (the sky, the awning, the sun, the empty tiers, the
//                                  wall with its gates' dark arches and the box's stone, the sand), painted in Gate.Tiles' slices; the
//                                  rows below the sand's lip and the columns past the world's width are night. paint(A, col) is the
//                                  whole tile; the same column paints the same twice
//   pieces(A, S, act)              nothing stands on the sand (the pass's rule): no actors
//   tufts: false                   no grass
//   wall(ctx, F, t, still, S)      the stand's live things each frame, in world coordinates, after the ground and before the bodies:
//                                  the crowd by the fight's heat (baked strips: arms up by the heat, the banners waving from
//                                  feel.crowd.banners, the whole stand up from feel.crowd.stand; still under less motion), the box's
//                                  figures (the editor leans forward from feel.crowd.editorLeans), the pennants, the gates' grilles
//                                  (lifted during the walk-in), the banner cloth with its names, and the stand dimmed under the HUD's
//                                  top row (art.hudDim)
//   weather(ctx, camX, camY, t, still, S, F)  the effects over everything, in view coordinates: sparks (a parry, a block, a crit's star),
//                                  dust (a wall hit, a knockdown), the petals the crowd throws at a KO (art.petals)
//   prints(F, S)                   the footprints the bodies leave in the sand this frame, at most 24 (the scene stamps them)
//   markKind, markLook, liveLook, chipLook   the sand's looks: a crater is a bowl in the sand, scorch is dark sand, blood is the pass's
//                                  own kind (stamped by take on a crit, a bleed's burst and a KO)
//   take(e, F, S)                  the duel's events the painter listens for: phase (the gates), ko, stagger, crit, parry, block,
//                                  wallHit, knockdown, bleedOut, banner, heat
// And beside the hooks: Arena.art.heat(h), banner(text), gates(open01), reset() (the live state the page sets each frame or at a bout's
// start; one arena scene exists at a time), Arena.lobby(ctx, w, h, t, o) (the Gate of Champions' hall for the page's lobby canvas),
// Arena.lobbyPixels(w, h) (the same, still, as pixels: node checks it), Arena.sizes() (the two sands), Arena.crowdStrip(...) and
// Arena.sprites (the tests read them).
// The pixels are made without a DOM, so node can check them (tools/test-arena-art.js); canvases are made only when a page asks. Pure:
// no Math.random, no clock of its own (the page's t and the fight's). Plain script, defines window.Arena; needs proto/gate.js
// (window.Gate, or required in node) and spec/arena.js (window.FORGE_ARENA); proto/cellar.js for the banner's letters when it is there.
(function (root) {
  "use strict";
  const G = root.Gate || (typeof module !== "undefined" && typeof require === "function" ? require("./gate.js") : null);
  if (!G) throw new Error("proto/arena.js needs proto/gate.js");
  const OUT = G.OUT, hash = G.hash, dith = G.dith, Grid = G.Grid, TW = G.TW, TH = G.TH, drawAt = G.drawAt, blit = G.blit, sprite = G.sprite, region = G.region, rect = G.rect, ell = G.ell, or = G.or;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), TAU = Math.PI * 2;
  const NIGHT = "#120e1a";

  // ------------------------------------------------------------------ the ramps (ENDESGA 32, the pass's pictures): the desert's sand and sky,
  // the colosseum's limestone, the crowd's cloth and skin, the two sides
  const R = {
    sky: ["#c0cbdc", "#8b9bb4", "#5a6988"], sun: ["#fee761", "#feae34"], awn: ["#e4a672", "#ead4aa", "#b86f50"],
    sand: ["#ead4aa", "#e8b796", "#c28569", "#b86f50"], stone: ["#c4bcae", "#9a948c", "#6e6a70", "#4a4450"], arch: "#262b44",
    cloth: ["#be4a2f", "#feae34", "#63c74d", "#0099db", "#b55088", "#ead4aa", "#733e39", "#3a4466"], skin: ["#e8b796", "#c28569", "#733e39"],
    red: ["#a22633", "#e43b44", "#f6757a"], blue: ["#124e89", "#0099db", "#2ce8f5"], iron: ["#262b44", "#3a4466", "#5a6988", "#8b9bb4"],
    gold: "#feae34", hot: "#fee761", ember: "#f77622", blood: ["#68182c", "#a22633", "#e43b44"], white: "#ffffff", green: "#63c74d",
    petal: ["#e4a672", "#ead4aa", "#e43b44", "#feae34", "#f6757a"], flag: ["#2b2532", "#36303f", "#403a4b", "#4c4558"], vault: ["#3a3340", "#4a4450", "#5c5662", "#6e6a70"],
    fire: ["#120e1a", "#3e1420", "#a22633", "#e43b44", "#f77622", "#feae34", "#fee761", "#fff6c8"]
  };
  // the cellar's torch flame (proto/cellar.js FLAME, the hall's copy), four frames
  const FLAME = [
    ["..3..", ".353.", ".354.", "34543", "35653", "35763", ".376.", "..6.."],
    [".3...", ".33..", ".453.", "34543", "35653", "35763", ".376.", "..6.."],
    ["...3.", "..33.", ".354.", "34553", "35653", "35763", ".376.", "..6.."],
    ["..3..", "..3..", ".353.", "34543", "35663", "36763", ".376.", "..6.."]
  ];
  const cache = new Map();
  const once = (key, make) => { let v = cache.get(key); if (!v) { v = make(); cache.set(key, v); } return v; };
  const gridSprite = (sp, ox, oy, extra) => sprite(sp.px, sp.W, sp.H, ox, oy, extra);
  const spec = () => root.FORGE_ARENA || null;

  // ------------------------------------------------------------------ the layout of a sand, from the area and the spec, once per area
  const PREP = new WeakMap();
  function prep(A) {
    let P = PREP.get(A); if (P) return P;
    const SP = spec() || {}, wall = SP.wall || { top: 80, bottom: 108, gates: { west: 36, east: -36, w: 22 }, box: { w: 52 } }, art = SP.art || {};
    const W = A.w || 448, H = A.h || 216, floor = A.floor || { x0: 16, x1: W - 16, y0: 108, y1: 212 };
    const wallY = wall.top === undefined ? 80 : wall.top, sandY = floor.y0, lip = floor.y1, gw = (wall.gates || {}).w || 22;
    const gx = v => v < 0 ? W + v : v;
    P = { A, W, H, wallY, sandY, lip, seed: A.seed || (SP.seed || 3600),
      tiers: (art.tiers || [{ y: 14, h: 22 }, { y: 36, h: 22 }, { y: 58, h: 22 }]).map(t => ({ y: t.y, h: t.h })),
      awning: art.awning || { h: 6, poles: 48 }, sun: art.sun || { x: 50, y: 8 }, crowd: art.crowd || { rows: 2, step: 6, gap: 0.08, banners: 0.12 }, vom: art.vomitoria || 64,
      hudDim: art.hudDim === undefined ? 0.35 : art.hudDim, petals: art.petals || { n: 40, time: 2.5 },
      gates: [{ x: Math.round(gx((wall.gates || {}).west === undefined ? 36 : wall.gates.west) - gw / 2), w: gw, side: "red" }, { x: Math.round(gx((wall.gates || {}).east === undefined ? -36 : wall.gates.east) - gw / 2), w: gw, side: "blue" }],
      box: { x: Math.round(W / 2 - ((wall.box || {}).w || 52) / 2), w: (wall.box || {}).w || 52 } };
    PREP.set(A, P);
    return P;
  }

  // ------------------------------------------------------------------ the still colosseum, pixel by pixel (the tiles)
  // the sky's three bands, the awning over its top rows with its poles, the sun under the awning's edge
  function skyAt(P, x, y) {
    const AW = P.awning.h || 6;
    if (y < AW) return R.awn[((x >> 3) & 1) ? 1 : 0];
    if (y === AW) return R.awn[2];
    if (y < 14 && ((x - 12) % (P.awning.poles || 48)) >= 0 && ((x - 12) % (P.awning.poles || 48)) < 2) return R.stone[3];
    const sx = P.sun.x, sy = P.sun.y + 4, dx = x - sx, dy = y - sy;
    if (dx * dx + dy * dy <= 36) return (dx * dx + dy * dy <= 16 && dy < 1) ? R.sun[0] : R.sun[1];
    if (dx * dx + dy * dy <= 49 && ((x + y) & 1)) return R.sun[0];
    return y < 10 ? R.sky[0] : y < 22 ? R.sky[1] : R.sky[2];
  }
  // a tier of seating: a stone step with its light top edge and dark foot, a vomitorium (a dark arch) every 64 px
  function tierAt(P, T, i, x, y) {
    const dy = y - T.y;
    const vx = ((x % P.vom) + P.vom) % P.vom;
    if (dy >= 4 && vx >= 32 && vx < 42) return R.arch;
    if (dy >= 2 && dy < 4 && vx >= 33 && vx < 41) return R.arch;
    if (dy === 1 && vx >= 35 && vx < 39) return R.arch;
    if (dy === 0) return R.stone[0];
    if (dy >= T.h - 2) return R.stone[2];
    return i === 0 ? R.stone[2] : (hash(x, y, P.seed + 3) < 0.04 ? R.stone[0] : R.stone[1]);
  }
  // the podium wall: ashlar in courses of 6 with joints, the cornice on top, the dark foot; a gate's arch cut into it at each end; the
  // editor's box over the middle (its ledge, its awning, its dark loggia)
  function wallAt(P, x, y) {
    const wh = P.sandY - P.wallY, dy = y - P.wallY;
    for (const g of P.gates) {
      const gx = x - g.x;
      if (gx >= -2 && gx < 0 && dy >= 2) return R.stone[0];
      if (gx >= g.w && gx < g.w + 2 && dy >= 2) return R.stone[0];
      if (gx >= 0 && gx < g.w) { if (dy >= 6) return OUT; if (dy >= 3 && gx >= 2 && gx < g.w - 2) return OUT; if (dy === 2 && gx >= 5 && gx < g.w - 5) return OUT; }
    }
    const bx = x - P.box.x;
    if (bx >= 0 && bx < P.box.w) {
      if (dy >= -6 && dy < 2) return R.stone[0];                               // the ledge (the rows above the wall are painted by the stand's code: see pixel())
      if (dy >= 2 && dy < 8 && bx >= 2 && bx < P.box.w - 2) return R.awn[((bx >> 2) & 1) ? 1 : 0];
      if (dy >= 8 && dy < 22 && bx >= 2 && bx < P.box.w - 2) return R.stone[3];
    }
    if (dy < 2) return R.stone[0];
    if (dy >= wh - 3) return R.stone[2];
    const course = Math.floor((dy - 2) / 6), cy = (dy - 2) % 6, jx = ((x + (course & 1 ? 8 : 0)) % 16 + 16) % 16;
    if (cy === 5 || jx === 0) return R.stone[2];
    return hash(x, y, P.seed + 4) < 0.05 ? R.stone[0] : R.stone[1];
  }
  // the sand: pale, speckled by hash, raked in lines every 9 rows, the wall's shadow on its top rows, the lip at its foot
  function sandAt(P, x, y) {
    const dy = y - P.sandY;
    if (dy === 0) return R.sand[2];
    if (dy < 3) return R.sand[1];
    if (y === P.lip) return R.sand[3];
    if (y > P.lip) return NIGHT;
    const r = hash(x, y, P.seed + 2);
    if (r < 0.06) return R.sand[1];
    if (r < 0.075) return R.sand[2];
    if (dy >= 6 && (dy - 6) % 9 === ((hash(x >> 1, 0, P.seed + 5) * 2) | 0) && hash(x >> 1, dy, P.seed + 4) < 0.6) return R.sand[1];
    return R.sand[0];
  }
  function pixel(P, x, y) {
    if (x >= P.W || y >= P.H) return NIGHT;
    if (y >= P.sandY) return sandAt(P, x, y);
    if (y >= P.wallY) return wallAt(P, x, y);
    // the box's ledge and pennant pole rise above the wall into the top tier
    const bx = x - P.box.x, dy = y - P.wallY;
    if (bx >= 0 && bx < P.box.w && dy >= -6) return R.stone[0];
    if (bx === 25 || bx === 26) { if (dy >= -14 && dy < -6) return R.stone[3]; }
    for (let i = P.tiers.length - 1; i >= 0; i--) { const T = P.tiers[i]; if (y >= T.y && y < T.y + T.h) return tierAt(P, T, i, x, y); }
    return skyAt(P, x, y);
  }
  function paintRows(A, col, y0, y1, px) {
    const P = prep(A), X0 = col * TW;
    for (let y = y0; y < y1; y++) { const o = y * TW; for (let x = 0; x < TW; x++) px[o + x] = pixel(P, X0 + x, y); }
    return px;
  }
  function paint(A, col) { const px = new Array(TW * TH).fill(null); paintRows(A, col, 0, TH, px); return { px, W: TW, H: TH, col }; }

  // ------------------------------------------------------------------ the sprites the live things are made of
  const SPR = {};
  // the crowd on one tier, one column wide: two rows of heads by hash (the same crowd every bout), their arms up by the level (0 none,
  // 1 a third, 2 two thirds, 3 everyone, up on their feet), their banners held still or waving (frame f); the strip is TW x (h + 6) with
  // its top 4 px above the tier (the arms and the banners reach up)
  function crowdStrip(P, tier, col, level, f) {
    const T = P.tiers[tier], X0 = col * TW, key = "crowd|" + P.W + "|" + tier + "|" + col + "|" + level + "|" + (f & 1);
    return once(key, () => {
      const C = P.crowd, H = T.h + 4, sp = new Grid(TW, H), set = (x, y, c) => sp.set(x - X0, y - T.y + 4, c);
      const stand = level >= 3, share = [0, 0.35, 0.7, 1][clamp(level | 0, 0, 3)];
      for (let r = 0; r < (C.rows || 2); r++) for (let x = 2 + r * 3; x < P.W - 4; x += (C.step || 6)) {
        if (x + 6 < X0 || x - 2 >= X0 + TW) continue;
        const h = hash(x, T.y + r, 7);
        if (h < (C.gap === undefined ? 0.08 : C.gap)) continue;
        const up = stand ? 1 : 0, yy = T.y + 6 + r * 8 + (hash(x, r, 3) > 0.5 ? 1 : 0) - up;
        const cloth = R.cloth[(h * 8) | 0], skin = R.skin[(hash(x, r, 11) * 3) | 0];
        for (let i = 0; i < 5; i++) for (let j = 0; j < 4 + up; j++) set(x + i, yy + 3 + j, cloth);
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) set(x + 1 + i, yy + j, skin);
        const arms = hash(x, r, 5) < share * 0.95;
        if (arms) { const wave = (f & 1) && hash(x, r, 29) < 0.5 ? 1 : 0; for (let j = 0; j < 4; j++) { set(x - 1, yy - 1 - wave + j, skin); set(x + 5, yy - 1 + wave - 1 + j + 1, skin); } }
        if (hash(x, r, 19) < (C.banners === undefined ? 0.12 : C.banners)) { const bc = R.cloth[(hash(x, r, 23) * 8) | 0], wx = (level >= 1 && (f & 1)) ? 1 : 0; for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) set(x + 1 + i + wx, yy - 2 - (arms ? 2 : 0) + j, bc); set(x + 1 + wx, yy - (arms ? 2 : 0), R.stone[3]); }
      }
      return gridSprite(sp, 0, 4);
    });
  }
  // a gate's grille: iron bars across an arch 22 wide and 22 tall, drawn lifted by the walk-in
  SPR.grille = w => once("grille" + w, () => {
    const h = 22, sp = new Grid(w, h);
    for (let y = 2; y < h; y += 4) for (let x = 1; x < w - 1; x++) sp.set(x, y, R.iron[2]);
    for (let x = 4; x < w - 2; x += 5) for (let y = 1; y < h; y++) sp.set(x, y, y % 4 === 2 ? R.iron[3] : R.iron[2]);
    for (let x = 1; x < w - 1; x++) sp.set(x, h - 1, R.iron[1]);
    return gridSprite(sp, 0, 0);
  });
  // the box's figures: a guest in his cloth, the editor in gold; lean: the figure a pixel forward (down) when the fight is hot
  SPR.figure = (i, lean) => once("figure" + i + (lean ? "L" : ""), () => {
    const sp = new Grid(7, 12), cloth = i === 1 ? R.gold : R.cloth[(i * 3) % 8], y = lean ? 1 : 0;
    for (let x = 1; x < 6; x++) for (let j = 0; j < 6; j++) sp.set(x, 4 + y + j, cloth);
    for (let x = 2; x < 5; x++) for (let j = 0; j < 3; j++) sp.set(x, 1 + y + j, R.skin[1]);
    if (i === 1) { sp.set(2, y, R.gold); sp.set(4, y, R.gold); }
    return gridSprite(sp, 0, 0);
  });
  // a pennant, 7 x 7, its free edge up or down by the frame
  SPR.pennant = (side, f) => once("pennant" + side + (f & 1), () => {
    const sp = new Grid(8, 8), ramp = side === "red" ? R.red : R.blue;
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7 - Math.floor(y / 3) - (x => 0)(0); x++) { const edge = x >= 5; sp.set(x, y + (edge ? (f & 1 ? 1 : 0) : 0), edge ? ramp[0] : y < 2 ? ramp[2] : ramp[1]); }
    return gridSprite(sp, 0, 0);
  });
  // the banner cloth under the box, w x 7, parchment with a dark hem
  SPR.cloth = w => once("cloth" + w, () => { const sp = new Grid(w, 7); for (let y = 0; y < 7; y++) for (let x = 0; x < w; x++) sp.set(x, y, y === 6 ? R.awn[2] : (x === 0 || x === w - 1) ? R.awn[0] : R.awn[1]); return gridSprite(sp, 0, 0); });
  // a boot print in the sand, 3 x 2, left or right (the hall's prints' manner)
  SPR.print = n => once("sprint" + (n & 1), () => { const sp = new Grid(4, 3); for (let x = 0; x < 3; x++) sp.set(x + (n & 1), 0, R.sand[2]); sp.set(1, 1, R.sand[2]); sp.set(2 - (n & 1), 1, R.sand[1]); return gridSprite(sp, 2, 1); });
  // a spark's pixel (hot or white, 1 or 2 px), a dust mote (sand, 2 x 1), a petal (2 x 2 in a petal colour), the crit's star
  SPR.spark = (big, hot) => once("spark" + (big ? 1 : 0) + (hot ? 1 : 0), () => { const n = big ? 2 : 1, sp = new Grid(n, n); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) sp.set(x, y, hot ? R.hot : R.white); return gridSprite(sp, 0, 0); });
  SPR.mote = v => once("mote" + (v & 1), () => { const sp = new Grid(2, 1); sp.set(0, 0, R.sand[v & 1]); sp.set(1, 0, R.sand[v & 1]); return gridSprite(sp, 1, 0); });
  SPR.petal = v => once("petal" + (v % 5), () => { const sp = new Grid(2, 2), c = R.petal[v % 5]; sp.set(0, 0, c); sp.set(1, 0, c); sp.set(0, 1, c); sp.set(1, 1, R.awn[2]); return gridSprite(sp, 1, 1); });
  SPR.star = r => once("star" + r, () => { const sp = new Grid(2 * r + 3, 2 * r + 3), c = r + 1; for (let d = -r; d <= r; d++) { sp.set(c + d, c, R.white); sp.set(c, c + d, R.white); if (Math.abs(d) > 2) { sp.set(c + d, c + d, R.hot); sp.set(c + d, c - d, R.hot); } } for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) sp.set(c + x, c + y, R.white); return gridSprite(sp, c, c); });
  SPR.flame = f => once("aflame" + (f & 3), () => { const sp = new Grid(5, 8), rows = FLAME[f & 3]; for (let y = 0; y < 8; y++) for (let x = 0; x < 5; x++) { const ch = rows[y][x]; if (ch !== ".") sp.set(x, y, R.fire[+ch]); } return gridSprite(sp, 2, 8); });
  SPR.torch = () => once("atorch", () => { const sp = new Grid(5, 16); for (let y = 2; y < 16; y++) sp.set(2, y, R.iron[1]); for (let y = 0; y < 3; y++) for (let x = 1; x < 4; x++) sp.set(x, y, R.iron[2]); return gridSprite(sp, 2, 0); });

  // ------------------------------------------------------------------ the marks' looks on sand
  const MK = {};
  MK.crater = (r, v) => once("scrater" + r + "|" + v, () => { const w = 2 * r + 5, sp = new Grid(w, Math.ceil(w / 2) + 2), c = r + 2, cy = Math.ceil(w / 4) + 1; region(sp, ell(c, cy, r + 2, Math.max(1, (r + 2) / 2)), R.sand, { flat: 1 }); region(sp, ell(c, cy, r, Math.max(1, r / 2)), R.sand, { flat: 2 }); region(sp, ell(c + 1, cy + 1, Math.max(1, r - 2), Math.max(1, (r - 2) / 2)), R.sand, { flat: 3 }); for (let i = 0; i < 6; i++) { const a = hash(i, r, 41 + v) * TAU; sp.set(c + Math.cos(a) * (r + 2), cy + Math.sin(a) * (r + 2) / 2, R.sand[1]); } return gridSprite(sp, c, cy); });
  MK.scorch = (r, v) => once("sscorch" + r + "|" + v, () => { const w = 2 * r + 3, sp = new Grid(w, Math.ceil(w / 2) + 1), c = r + 1, cy = Math.ceil(w / 4); region(sp, (x, y) => ell(c, cy, r, Math.max(1, r / 2))(x, y) && hash(x, y, 51 + v) < 0.8, R.flag, { tex: (x, y) => hash(x, y, 52 + v) < 0.3 ? R.sand[3] : R.flag[1] }); return gridSprite(sp, c, cy); });
  MK.blood = (r, v) => once("sblood" + r + "|" + v, () => { const w = 2 * r + 3, sp = new Grid(w, Math.ceil(w / 2) + 2), c = r + 1, cy = Math.ceil(w / 4); for (let i = 0; i < r * 3 + 4; i++) { const a = hash(i, r, 61 + v) * TAU, d = hash(i, v, 62 + r) * r; const x = Math.round(c + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d * 0.5); sp.set(x, y, i % 3 ? R.blood[1] : R.blood[2]); if (i % 2) sp.set(x + 1, y, R.blood[0]); } for (let y = cy - 1; y <= cy + 1; y++) for (let x = c - 1; x <= c + 1; x++) sp.set(x, y, R.blood[1]); return gridSprite(sp, c, cy); });
  MK.scuff = (r, v) => once("sscuff" + r + "|" + v, () => { const w = 2 * r + 3, sp = new Grid(w, 4), c = r + 1; for (let i = 0; i < w - 2; i++) if (hash(i, v, 71) < 0.7) sp.set(1 + i, 1 + ((i + v) & 1), R.sand[2]); return gridSprite(sp, c, 2); });
  MK.damp = (r, v) => once("sdamp" + r + "|" + v, () => { const w = 2 * r + 3, sp = new Grid(w, Math.ceil(w / 2) + 1), c = r + 1, cy = Math.ceil(w / 4); region(sp, ell(c, cy, r, Math.max(1, r / 2)), R.sand, { flat: 2 }); return gridSprite(sp, c, cy); });
  function markKind(e, kind, A) { if (e.kind === "blood") return "blood"; if (e.kind === "scuff") return "scuff"; return kind; }
  function markLook(kind, r, v, x, y, A) {
    const rr = Math.max(2, Math.round(r || 4)), vv = (v | 0) % 3;
    if (kind === "crater" || kind === "filled") return MK.crater(rr, vv);
    if (kind === "scorch" || kind === "dirt" || kind === "crack") return MK.scorch(rr, vv);
    if (kind === "blood") return MK.blood(rr, vv);
    if (kind === "scuff") return MK.scuff(rr, vv);
    if (kind === "damp") return MK.damp(rr, vv);
    return null;
  }
  function liveLook(kind, r, f, level, x, y, A) { return null; }
  function chipLook(kind, i, x, y, A) { return null; }

  // ------------------------------------------------------------------ the live state: what the page sets (the heat, the banner, the gates) and
  // what the events leave (the effects, the footprints' memory), per scene
  const LIVE = { heat: 0, banner: "", gates: null, gatesAt: null, final: false };
  function reset() { LIVE.heat = ((spec() || {}).feel || {}).crowd ? spec().feel.crowd.start || 0 : 0; LIVE.banner = ""; LIVE.gates = null; LIVE.gatesAt = null; LIVE.final = false; }
  function stateOf(S) { return S.arena || (S.arena = { fx: [], foot: new Map(), petals: null }); }
  function levelOf(h) { const C = ((spec() || {}).feel || {}).crowd || {}; const stand = C.stand === undefined ? 0.7 : C.stand, ban = C.banners === undefined ? 0.4 : C.banners; return h >= stand ? 3 : h >= ban ? 2 : h >= 0.15 ? 1 : 0; }
  // the gates' lift, 0 shut to 1 open: the page's own value, or an opening timed from a walk-in's phase event (1 s), or open
  function gatesOpen(t) { if (LIVE.gates !== null) return clamp(LIVE.gates, 0, 1); if (LIVE.gatesAt !== null) return clamp((t - LIVE.gatesAt) / 1.0, 0, 1); return 1; }

  // ------------------------------------------------------------------ the hooks the scene calls each frame
  function pieces(A, S, act) { /* nothing stands on the sand (the pass's rule) */ }
  function wall(ctx, F, t, still, S) {
    const P = prep(S.A), v = S.view, VW = S.vw || TW, VH = S.vh || 216, ft = F ? F.t || 0 : 0, tick = still ? 0 : Math.floor(t * 4);
    if (v.y0 > P.sandY) return 0;
    const level = still ? Math.min(levelOf(LIVE.heat), 2) : levelOf(LIVE.heat), f = still ? 0 : (tick & 1);
    let n = 0;
    // the crowd on its three tiers, a baked strip a column
    const c0 = clamp(Math.floor(v.x0 / TW), 0, 9), c1 = clamp(Math.floor((v.x0 + VW - 1) / TW), 0, 9);
    for (let c = c0; c <= c1; c++) { if (c * TW >= P.W) break; for (let i = 0; i < P.tiers.length; i++) { const s = crowdStrip(P, i, c, level, f + i); blit(ctx, s, c * TW, P.tiers[i].y - 4); n++; } }
    // the box: its figures (the editor leaning when the fight is hot), the pennants waving with the crowd
    const C = ((spec() || {}).feel || {}).crowd || {}, lean = LIVE.heat >= (C.editorLeans === undefined ? 0.6 : C.editorLeans);
    const bx = P.box.x, by = P.wallY;
    if (bx + P.box.w >= v.x0 && bx <= v.x0 + VW) {
      for (let i = 0; i < 4; i++) { drawAt(ctx, SPR.figure(i, i === 1 && lean), bx + 6 + i * 11, by + 9); n++; }
      drawAt(ctx, SPR.pennant("red", f), bx + 18, by - 13); drawAt(ctx, SPR.pennant("blue", f + 1), bx + 27, by - 13); n += 2;
      if (LIVE.banner) { const cw = P.box.w - 4; drawAt(ctx, SPR.cloth(cw), bx + 2, by + 21); n++; const CE = root.Cellar; if (CE && CE.outlined && CE.textWidth) { const tw = CE.textWidth(LIVE.banner); CE.outlined(ctx, LIVE.banner, Math.round(bx + 2 + (cw - tw) / 2), by + 22, R.awn[0] === "#e4a672" ? "#3e2731" : OUT); } }
    }
    // the gates' grilles, lifted by the walk-in and clipped to their arches
    const open = gatesOpen(ft), lift = Math.round(open * 24);
    for (const g of P.gates) {
      if (g.x + g.w < v.x0 || g.x > v.x0 + VW) continue;
      ctx.save(); ctx.beginPath(); ctx.rect(g.x, P.wallY + 2, g.w, P.sandY - P.wallY - 2); ctx.clip();
      drawAt(ctx, SPR.grille(g.w), g.x, P.wallY + 6 - lift); n++;
      ctx.restore();
    }
    // the stand dimmed under the HUD's top row (the plates sit over the awning and the first tier)
    if (P.hudDim > 0 && v.y0 < 16) { ctx.fillStyle = "rgba(24,20,37," + P.hudDim + ")"; ctx.fillRect(v.x0, v.y0, VW, 16 - v.y0); n++; }
    return n;
  }
  // the effects over everything, in view coordinates: each a record { kind, x, y, t0 } on the fight's clock; the petals across the view
  function weather(ctx, camX, camY, t, still, S, F) {
    const P = prep(S.A), st = stateOf(S), ft = F ? F.t || 0 : 0, VW = S.vw || TW, VH = S.vh || 216;
    let n = 0;
    const keep = [];
    for (const e of st.fx) {
      const age = still ? 0.02 : ft - e.t0; if (age < 0) continue;
      const x = e.x - camX, y = e.y - camY;
      if (e.kind === "sparks") { if (age < 0.32) { keep.push(e); const q = age / 0.32; for (let i = 0; i < e.n; i++) { const a = (i / e.n) * TAU + e.v, d = (e.big ? 9 : 5) * (0.3 + hash(i, e.v, 1) * 0.7) * (0.3 + q); drawAt(ctx, SPR.spark(age < 0.1 && i % 3 === 0, i % 2 === 0), Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d - q * 2)); n++; } if (age < 0.06) { drawAt(ctx, SPR.star(e.big ? 6 : 3), Math.round(x), Math.round(y)); n++; } } }
      else if (e.kind === "star") { if (age < 0.06) { keep.push(e); drawAt(ctx, SPR.star(e.big ? 9 : 6), Math.round(x), Math.round(y)); n++; } }
      else if (e.kind === "dust") { if (age < 0.45) { keep.push(e); const q = age / 0.45; for (let i = 0; i < e.n; i++) { drawAt(ctx, SPR.mote(i), Math.round(x + (hash(i, e.v, 31) - 0.5) * 20 * (0.4 + q)), Math.round(y - hash(i, e.v, 32) * 8 * q - 1)); n++; } } }
    }
    st.fx = keep;
    // the petals the crowd throws at a KO: from the awning down across the view, drifting, for art.petals.time
    if (st.petals !== null) {
      const age = still ? 0.6 : ft - st.petals, T = P.petals.time || 2.5;
      if (age >= 0 && age < T) { const N = P.petals.n || 40; for (let i = 0; i < N; i++) { const q = ((age / T) + hash(i, 2, 82)) % 1, x = hash(i, 1, 81) * VW + Math.sin(age * 2 + i) * 6, y = -8 + q * (VH + 16); drawAt(ctx, SPR.petal(i), Math.round(x), Math.round(y)); n++; } }
      else if (age >= T) st.petals = null;
    }
    return n;
  }
  // the footprints in the sand: every knight on its feet leaves one each 6 px it walks, left and right by turns, at most 24 a frame
  function prints(F, S) {
    const P = prep(S.A), st = stateOf(S), out = [], seen = new Set();
    if (!F) return out;
    for (const b of S.bodiesOf(F)) {
      if (!b.knight) continue;
      const key = "k" + b.seat; seen.add(key);
      if (b.on || b.air || b.climbing || Math.abs(b.z || 0) > 0.5 || b.out || b.down || b.lie > 0) { st.foot.delete(key); continue; }
      const L = st.foot.get(key);
      if (!L) { st.foot.set(key, { x: b.x, y: b.y, side: 0, n: 0 }); continue; }
      const dx = b.x - L.x, dy = b.y - L.y, d = Math.hypot(dx, dy);
      if (d < 6) continue;
      if (d > 40) { L.x = b.x; L.y = b.y; continue; }
      if (out.length >= 24) continue;
      const nx = -dy / d, ny = dx / d, side = L.side ? 1 : -1, px = Math.round(b.x + nx * 1.5 * side), py = Math.round(b.y + ny * 1.5 * side);
      L.x = b.x; L.y = b.y; L.side ^= 1; L.n++;
      if (py >= P.sandY + 2 && py < P.lip) out.push({ s: SPR.print(L.n), x: px, y: py });
    }
    for (const k of st.foot.keys()) if (!seen.has(k)) st.foot.delete(k);
    return out;
  }
  // the duel's events the painter keeps: the gates on a walk-in, the effects, the blood, the petals, the banner and the heat when the page
  // sends them as events instead of calling the setters
  function take(e, F, S) {
    const st = stateOf(S), t = F ? F.t || 0 : 0, fx = (kind, o) => { st.fx.push(Object.assign({ kind, x: e.x || 0, y: e.y || 0, t0: t, v: (e.seat | 0) + Math.round(t * 7) }, o)); while (st.fx.length > 24) st.fx.shift(); };
    if (e.type === "phase") { if (e.phase === "walkIn") { LIVE.gates = null; LIVE.gatesAt = t; } else if (e.phase === "fight") { LIVE.gates = null; LIVE.gatesAt = null; } return true; }
    if (e.type === "heat") { LIVE.heat = clamp(+e.heat || 0, 0, 1); return true; }
    if (e.type === "banner") { LIVE.banner = typeof e.text === "string" ? e.text : ""; return true; }
    if (e.type === "parry") { fx("sparks", { n: 12, big: true }); return true; }
    if (e.type === "block") { fx("sparks", { n: 6, big: false }); return true; }
    if (e.type === "crit") { fx("star", { big: true }); fx("sparks", { n: 8, big: true }); S.stamp({ kind: "blood", x: e.x, y: e.y, r: 5, id: e.seat | 0 }); return true; }
    if (e.type === "stagger") { fx("dust", { n: 6 }); return true; }
    if (e.type === "wallHit" || e.type === "knockdown") { fx("dust", { n: e.type === "wallHit" ? 10 : 12 }); return true; }
    if (e.type === "bleedOut") { S.stamp({ kind: "blood", x: e.x, y: e.y, r: 7, id: e.seat | 0 }); fx("dust", { n: 4 }); return true; }
    if (e.type === "ko") { S.stamp({ kind: "blood", x: e.x, y: e.y, r: 8, id: e.seat | 0 }); fx("dust", { n: 10 }); if (e.final || e.last) { st.petals = t; LIVE.final = true; } return true; }
    if (e.type === "boutEnd") { st.petals = t; return true; }
    return false;
  }

  // ------------------------------------------------------------------ the Gate of Champions: the lobby's hall, 384 x 216 (or the page's size)
  // the vault of ashlar in the dark over the smithy's flagstones (proto/smithy.js when it is there), the iron gate in the middle with the
  // sand bright beyond it, a torch bracket each side; still, as pixels, baked once a size; the page draws the flames over it by t
  function lobbyPixels(w, h) {
    const SP = spec() || {}, L = (SP.art || {}).lobby || { gateX: 150, gateW: 84, torches: [120, 264] };
    const key = "lobby|" + w + "|" + h;
    return once(key, () => {
      const px = new Array(w * h).fill(null), set = (x, y, c) => { if (x >= 0 && y >= 0 && x < w && y < h && c) px[y * w + x] = c; };
      const FL = Math.round(h * 0.815), gx = L.gateX, gw = L.gateW, gy = 30;
      for (let y = 0; y < FL; y++) for (let x = 0; x < w; x++) {
        const course = Math.floor(y / 8), jx = ((x + (course & 1 ? 10 : 0)) % 20 + 20) % 20, cy = y % 8;
        set(x, y, cy === 7 || jx === 19 ? R.vault[0] : hash(x, y, 40) < 0.06 ? R.vault[1] : R.vault[2]);
      }
      // the flagstones: the smithy's own when it is there, else the vault's foot
      const S = root.Smithy;
      if (S && S.flagstones) { const p = { set, fill: (x0, y0, x1, y1, f) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, typeof f === "function" ? f(x, y) : f); } }; S.flagstones(p, w, FL, h); }
      else for (let y = FL; y < h; y++) for (let x = 0; x < w; x++) set(x, y, ((x >> 4) + (y >> 3)) & 1 ? R.flag[1] : R.flag[2]);
      // the arch: dark, its top rounded, the way through bright: the sky, the far stand, the sand
      for (let y = gy; y < FL; y++) for (let x = gx; x < gx + gw; x++) set(x, y, OUT);
      for (let y = gy - 12; y < gy; y++) { const ins = y < gy - 6 ? 16 : 6; for (let x = gx + ins; x < gx + gw - ins; x++) set(x, y, OUT); }
      for (let y = gy + 10; y < FL; y++) for (let x = gx + 6; x < gx + gw - 6; x++) set(x, y, y < gy + 40 ? R.sky[1] : y < gy + 60 ? R.stone[1] : R.sand[hash(x, y, 2) < 0.06 ? 1 : 0]);
      for (let y = gy; y < FL; y++) { set(gx, y, "#fff3c0"); set(gx + 1, y, "#fff3c0"); set(gx + gw - 2, y, "#fff3c0"); set(gx + gw - 1, y, "#fff3c0"); }
      // the grille, raised: its bars over the way, every 7 rows and every 10 columns
      for (let y = gy + 6; y < FL; y += 7) for (let x = gx; x < gx + gw; x++) set(x, y, R.iron[2]);
      for (let x = gx + 8; x < gx + gw; x += 10) for (let y = gy; y < FL; y++) set(x, y, R.iron[2]);
      // the torch brackets
      for (const tx of L.torches || []) { const s = SPR.torch(); for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (s.px[y * s.w + x]) set(tx - s.ox + x, 46 + y, s.px[y * s.w + x]); }
      return { px, w, h, torches: (L.torches || []).slice(), flameY: 46 };
    });
  }
  function lobby(ctx, w, h, t, o) {
    o = o || {}; const L = lobbyPixels(w, h), key = "lobbyCanvas|" + w + "|" + h;
    const cv = once(key, () => sprite(L.px, w, h, 0, 0)).canvas();
    ctx.drawImage(cv, 0, 0);
    const f = o.still ? 0 : Math.floor(t * 8);
    let n = 1;
    L.torches.forEach((tx, i) => { drawAt(ctx, SPR.flame((f + i * 2) & 3), tx, L.flameY); n++; });
    return n;
  }
  function sizes() { const SP = spec() || {}, s = SP.sands || {}; const out = {}; for (const k of Object.keys(s)) out[k] = { w: s[k].w, h: s[k].h }; return out; }

  const art = { id: "Arena", tufts: false, paintRows, paint, pieces, wall, weather, prints, markKind, markLook, liveLook, chipLook, take, stateOf,
    heat(h) { LIVE.heat = clamp(+h || 0, 0, 1); }, banner(text) { LIVE.banner = typeof text === "string" ? text : ""; }, gates(q) { LIVE.gates = q === null || q === undefined ? null : clamp(+q || 0, 0, 1); }, reset, live: LIVE };
  root.Arena = { art, R, prep, pixel, paint, paintRows, crowdStrip, sprites: SPR, marks: MK, lobby, lobbyPixels, sizes, levelOf, LIVE };
  if (typeof module !== "undefined" && module.exports) module.exports = root.Arena;
})(typeof window !== "undefined" ? window : globalThis);
