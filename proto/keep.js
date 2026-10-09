// FORGE FOREVER: the Keep's painter (design pass 27 sections 3.5, 3.10 and 3.14; built by card t91, build 22).
// Level 3 is three rooms in one world of 2688 x 648, drawn in the cellar's grammar: the Portrait Hall (x 0 to 1152, one screen tall: the
// keep's gallery of the old lords' portraits on blue damask over oak, the bedchamber doors the trolls burst out of, moonlight through tall
// windows, the lord's blue runner down an oak floor), the Great Stair (1152 to 1920, three screens tall: a granite shaft of four landings
// and three flights, each tier's face a coursed wall under a balustrade, torches on every face, moonlight from the great window, the
// antechamber's doors in the top wall) and the Antechamber (1920 to 2688, two screens: dark marble in a checker, the castle's carpet burnt
// through by the wizard's circle, slashed tapestries, stained glass, the throne room's great doors sealed in green fire, the dais with its
// stone wolves and green braziers). Ported from the pass's sketch (docs/design/27-the-keep.sketch.js) and fitted to spec/keep.json.
//
// It plugs into the Troll Gate's painter (proto/gate.js) as an art module, as the Great Hall's does: new Gate.Scene(area, Keep.art).
//   paintRows(A, col, y0, y1, px)  the seven column tiles of 384 x 648 with their light baked (the cellar's four dithered levels toward the
//                                  fire's glow, a green glow for the Green Hand's fire, the windows' cold moon), painted in Gate.Tiles'
//                                  slices; the rooms shorter than the world are night below. paint(A, col) is the whole tile
//   pieces(A, S, act)              every standing piece as an actor sorted by its foot with the bodies: the busts (broken when struck
//                                  down), the suits of armour, the iron gates (the hall's portcullis across the portrait hall, the bars
//                                  across the west flight's foot, rising into the vault when their waves are beaten), the balustrades along
//                                  the landings' edges with the gaps at the flights' heads, the fallen chandelier, barrels and crates,
//                                  the green braziers, the columns, the stone wolves, the benches, the dais and its steps with the bodies
//                                  on it, the wizard's stone where he fell
//   tufts: false                   no grass
//   lights(ctx, F, t, still, S)    the flicker rings of the fires in view, at most 8 a frame (green for the green fire)
//   wall(ctx, F, t, still, S)      the back walls' live things: the torches' flames, the bedchamber doors bursting at their trolls' spawn,
//                                  the antechamber's doors opening at the second Breather, the bats roosting under the antechamber's beam
//                                  until the vault drops them, the seal of green fire on the throne room's doors, burning out at the end
//   markKind, markLook, liveLook, chipLook   the halls' stone craters, broken slabs and grey chips (the Great Hall's looks)
//   take(e, F, S)                  the events it listens for (the doors' trolls, the phases' art, the Breathers, the end)
//   fx                             the Keep's effect sprites the scene draws for its kinds (proto/gate.js): the ward's egg of light, the
//                                  blink's glyph, the blast, the fizzle's smoke, the seal, the roost
// The pixels are made without a DOM, so node can check them (tools/test-keep-art.js); canvases are made only when a page asks.
// Plain script, defines window.Keep; needs proto/gate.js (window.Gate, or required in node) and borrows the Great Hall's armour, barrel,
// pillar, bench, portcullis and flame sprites and its stone marks (proto/hall.js, window.Hall).
(function (root) {
  "use strict";
  const G = root.Gate || (typeof module !== "undefined" && typeof require === "function" ? require("./gate.js") : null);
  if (!G) throw new Error("proto/keep.js needs proto/gate.js");
  const HALL = () => root.Hall || (typeof module !== "undefined" && typeof require === "function" ? require("./hall.js") : null);
  const OUT = G.OUT, BAYER = G.BAYER, hash = G.hash, vnoise = G.vnoise, dith = G.dith, Grid = G.Grid, TW = G.TW;
  const rect = G.rect, ell = G.ell, or = G.or, line = G.line, outline = G.outline, drawAt = G.drawAt, blit = G.blit;
  const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const and = (...f) => (x, y) => f.every(g => g(x, y)), not = f => (x, y) => !f(x, y);
  function poly(pts) {
    return (x, y) => { const px = x + 0.5, py = y + 0.5; let inside = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside; } return inside; };
  }
  // a region lit from the top left (proto/trolls.js region): o.ball shades a round mass, else the edges; o.spec the ramp's glint, o.flat
  // one tone, o.tex a texture, o.cast a 1 px shadow down and right onto what is behind
  function region(sp, pred, ramp, o) {
    o = o || {}; const W = sp.W, H = sp.H, m = (x, y) => x >= 0 && y >= 0 && x < W && y < H && pred(x, y);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m(x, y)) {
      const ul = !m(x - 1, y) || !m(x, y - 1), dr = !m(x + 1, y) || !m(x, y + 1);
      let t;
      if (o.ball) { const v = ((x - o.ball[0]) + (y - o.ball[1])) / (2 * o.ball[2]); t = v < -0.2 ? 2 : v < 0.55 ? 1 : 0; if (dr && t === 1 && v > 0.25) t = 0; }
      else t = ul && dr ? 1 : dr ? 0 : ul ? 2 : 1;
      let c = ramp[t];
      if (o.spec && o.spec(x, y)) c = ramp[3];
      if (o.flat !== undefined) c = ramp[o.flat];
      if (o.tex) c = o.tex(x, y, c) || c;
      sp.set(x, y, c);
    }
    if (o.cast) for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) if (!m(x, y) && sp.get(x, y) && sp.get(x, y) !== OUT && (m(x - 1, y) || m(x, y - 1) || m(x - 1, y - 1))) sp.set(x, y, o.cast);
  }
  // the ramps (the sketch's: ENDESGA 32, the Things' stone, oak, iron and leather; the pass's own: the wizard's plum robe, the Green Hand's
  // fire, the antechamber's marble, the bats' fur and wings)
  const R = {
    green: ["#265c42", "#3e8948", "#63c74d", "#b4e67a"], nature: ["#193c3e", "#265c42", "#3e8948", "#63c74d"],
    iron: ["#262b44", "#3a4466", "#5a6988", "#8b9bb4"], dark: ["#181425", "#262b44", "#3a4466", "#5a6988"], steel: ["#3a4466", "#5a6988", "#8b9bb4", "#c0cbdc"],
    oak: ["#3e2731", "#733e39", "#b86f50", "#e4a672"], oakD: ["#2a1d28", "#3e2731", "#733e39", "#b86f50"], leather: ["#2a1d28", "#3e2731", "#733e39", "#b86f50"],
    stone: ["#4a4450", "#6e6a70", "#9a948c", "#c4bcae"], granite: ["#2c2838", "#3e3a4a", "#555064", "#6e6a78"], bone: ["#c28569", "#e8b796", "#ead4aa", "#fffaf0"],
    blue: ["#0b2f55", "#124e89", "#0099db", "#2ce8f5"], gilt: ["#733e39", "#be4a2f", "#feae34", "#fee761"], beard: ["#3a4466", "#5a6988", "#8b9bb4", "#c0cbdc"],
    robe: ["#3e2731", "#68386c", "#b55088", "#f6757a"], hex: ["#265c42", "#3e8948", "#63c74d", "#b4e67a", "#ffffff"],
    fur: ["#181425", "#3e2731", "#68386c", "#b55088"], wing: ["#181425", "#3a4466", "#5a6988", "#8b9bb4"],
    marble: ["#5a6988", "#8b9bb4", "#c0cbdc", "#ffffff"], flag: ["#2b2532", "#36303f", "#403a4b", "#4c4558"], wine: ["#3e1428", "#68182c", "#a22633", "#be4a2f"]
  };
  const EYE = "#fee761", HEXEYE = "#b4e67a", TUSK = ["#e8b796", "#ead4aa"], HAND = ["#265c42", "#3e8948"], HEXF = R.hex;
  // the green hand the trolls daub on everything they take: a palm, four fingers and a thumb, 8 x 7
  const HANDPRINT = [".#.#.#..", ".#.#.#.#", ".#######", "########", ".#######", "..#####.", "..####.."];
  const inHand = (hx, hy) => hy >= 0 && hy < HANDPRINT.length && hx >= 0 && hx < 8 && HANDPRINT[hy][hx] === "#";
  const NIGHT = "#120e1a", JOINT = "#262036";

  // ================================================================== the ground: three rooms in the cellar's grammar, light baked in
  const GLOW = [247, 118, 34], HEXGLOW = [99, 199, 77], MOON = [90, 105, 136], LEVELS = [0, 0.16, 0.3, 0.44, 0.56];
  const TIERS = [{ id: "T3", y0: 96, y1: 175 }, { id: "T2", y0: 212, y1: 323, face: [176, 211], flight: [1832, 1896] }, { id: "T1", y0: 360, y1: 463, face: [324, 359], flight: [1176, 1240] }, { id: "T0", y0: 500, y1: 639, face: [464, 499], flight: [1832, 1896] }];
  // every light: a fire (torch, brazier: the warm GLOW), the Green Hand's fire (HEXGLOW), wall lights counted 0.8 in y, floor lights 0.62
  const LIGHTS = [
    // the portrait hall: a torch between each pair of portraits, the doors' lamps
    ...[30, 250, 420, 590, 790, 980, 1130].map(x => ({ x, y: 30, r: 58, k: "fire", wall: true })),
    // the great stair: torches on every face and by the antechamber's doors; the green braziers either side of the doors
    ...[1300, 1500, 1700].map(x => ({ x, y: 190, r: 56, k: "fire", wall: true })), ...[1400, 1620, 1800].map(x => ({ x, y: 338, r: 56, k: "fire", wall: true })),
    ...[1330, 1560, 1760].map(x => ({ x, y: 478, r: 56, k: "fire", wall: true })), { x: 1250, y: 60, r: 40, k: "fire", wall: true }, { x: 1800, y: 60, r: 40, k: "fire", wall: true },
    { x: 1484, y: 124, r: 64, k: "hex" }, { x: 1588, y: 124, r: 64, k: "hex" }, { x: 1500, y: 560, r: 40, k: "fire" },
    // the antechamber: the green braziers on the dais (the room's strongest light), green sconces on the north wall, two warm torches
    { x: 2220, y: 124, r: 96, k: "hex" }, { x: 2388, y: 124, r: 96, k: "hex" }, ...[2000, 2196, 2412, 2608].map(x => ({ x, y: 40, r: 44, k: "hex", wall: true })),
    { x: 1952, y: 40, r: 60, k: "fire", wall: true }, { x: 2656, y: 40, r: 60, k: "fire", wall: true }
  ];
  // moonlight: through the portrait hall's tall windows (a cold patch slanting onto the floor), the stair's great window, the antechamber's
  // stained glass (its panes' colours on the floor)
  const PH_WINDOWS = [196, 548, 820];
  // a torch in its iron sconce on a wall light's spot (a still flame here; the art's wall hook flickers it): warm, or the Green Hand's green
  const FLAME = ["..1..", ".121.", ".232.", "12321", ".232.", "..2.."], FIRE = ["#be4a2f", "#f77622", "#fee761"], HEXFLAME = [HEXF[1], HEXF[2], HEXF[4]];
  const SCONCES = LIGHTS.filter(L => L.wall);
  function sconceAt(x, y) {
    for (const L of SCONCES) {
      const dx = x - L.x, dy = y - L.y; if (dx < -2 || dx > 2 || dy < -8 || dy > 4) continue;
      if (dy >= 1) return dy === 1 ? (Math.abs(dx) <= 2 ? R.iron[dx < 0 ? 3 : 1] : null) : (dx === 0 ? R.iron[dy === 4 ? 1 : 2] : null);
      const row = FLAME[dy + 6]; if (!row) continue; const ch = row[dx + 2]; if (ch === ".") continue;
      return (L.k === "hex" ? HEXFLAME : FIRE)[+ch - 1];
    }
    return null;
  }
  function hex2(c) { return [1, 3, 5].map(k => parseInt(c.slice(k, k + 2), 16)); }
  function mix(c, to, a) { const v = hex2(c); return "#" + v.map((q, i) => Math.round(q + (to[i] - q) * a).toString(16).padStart(2, "0")).join(""); }
  function lightAt(x, y, alt) {
    let fire = 0, hexk = 0, moon = 0;
    for (const L of LIGHTS) { const r = alt && alt.L === L ? alt.r : L.r, dx = x - L.x, dy = (y - L.y) * (L.wall ? 0.8 : 0.62); if (Math.abs(dx) > r || Math.abs(dy) > r) continue; const k = 1 - Math.hypot(dx, dy) / r; if (k <= 0) continue; if (L.k === "hex") hexk = Math.max(hexk, k); else fire = Math.max(fire, k); }
    if (x < 1152 && y >= 64 && y < 150) for (const w of PH_WINDOWS) { const t = (y - 64) / 86, cx = w + 7 + t * 30; if (Math.abs(x - cx) < 9 - t * 3) moon = Math.max(moon, 0.6 - t * 0.5); }
    if (x >= 1152 && x < 1920 && y >= 96 && y < 330) { const t = (y - 96) / 230, cx = 1320 + t * 120; if (Math.abs(x - cx) < 18 - t * 6) moon = Math.max(moon, 0.6 - t * 0.45); }
    return [fire, hexk, moon];
  }
  const UNLIT = new Set([...FIRE, ...HEXFLAME]);
  function lit(c, x, y, wall, alt) {
    if (!c || c === OUT || UNLIT.has(c)) return c;
    const [fire, hexk, moon] = lightAt(x, y, alt), b = BAYER[(y & 3) * 4 + (x & 3)] / 16;
    let out = c;
    if (moon > 0) { const lvl = Math.floor(moon * 3 + b - 0.3); if (lvl > 0) out = mix(out, MOON, Math.min(0.5, lvl * 0.22)); }
    if (fire > 0) { const lvl = clamp(Math.floor(fire * 4 + b - 0.5), 0, 4); if (lvl > 0) out = mix(out, GLOW, LEVELS[lvl] * (wall ? 0.9 : 1)); }
    if (hexk > 0) { const lvl = clamp(Math.floor(hexk * 4 + b - 0.5), 0, 4); if (lvl > 0) out = mix(out, HEXGLOW, LEVELS[lvl] * (wall ? 0.8 : 0.85)); }
    return out;
  }
  // dressed stone in courses (granite for the stair's shaft, a warmer ashlar for the antechamber)
  function coursed(x, y, course, w0, ramp, k) {
    const row = Math.floor(y / course), off = row % 2 ? (w0 >> 1) : 0, bx = Math.floor((x + off) / w0), inX = (x + off) % w0, inY = y % course;
    if (inY === course - 1 || inX === 0) return JOINT;
    const t = hash(bx, row, k);
    let c = t < 0.33 ? ramp[1] : t < 0.66 ? ramp[2] : ramp[1];
    if (inY === 0) c = ramp[3];
    if (inX === w0 - 1) c = ramp[0];
    if (hash(x, y, k + 1) < 0.025) c = ramp[0];
    return c;
  }
  // an arched opening (x0, y0) w by h: a door (oak leaves with iron studs, or open on the dark), a window (night glass and its leading, lit
  // panes for stained glass), an archway with steps rising inside it
  function arched(x, y, x0, y0, w, h) { if (x < x0 || x >= x0 + w || y < y0 || y >= y0 + h) return null; const cx = x0 + (w - 1) / 2, top = y0 + w / 2; if (y < top && ((x - cx) / (w / 2)) ** 2 + ((y - top) / (w / 2)) ** 2 > 1) return null; const rim = x === x0 || x === x0 + w - 1 || (y < top + 1 && ((x - cx) / (w / 2 - 1.5)) ** 2 + ((y - top) / (w / 2 - 1.5)) ** 2 > 1); return { rim, cx, top }; }
  function oakDoor(x, y, x0, y0, w, h, rim) {
    const a = arched(x, y, x0, y0, w, h); if (!a) return null;
    if (a.rim) return rim || R.stone[2];
    if ((x - x0) % 4 === 0 || Math.abs(x - a.cx) < 0.6) return R.oakD[0];
    if ((y - y0) % 9 === 4) return ((x + y) % 3 === 0) ? R.iron[3] : R.iron[1];
    return x < a.cx ? R.oakD[2] : R.oakD[1];
  }
  function nightGlass(x, y, x0, y0, w, h) {
    const a = arched(x, y, x0, y0, w, h); if (!a) return null;
    if (a.rim) return R.stone[3];
    if (y === y0 + h - 1) return R.stone[3];
    if (Math.abs(x - a.cx) < 0.6 || (y - y0) % 10 === 9) return OUT;
    const t = (y - y0) / h; return dith(x, y, 0.55 - t * 0.3) ? "#3a4466" : (hash(x, y, 71) < 0.04 ? "#8b9bb4" : "#262b44");
  }
  function stainedGlass(x, y, x0, y0, w, h) {
    const a = arched(x, y, x0, y0, w, h); if (!a) return null;
    if (a.rim) return R.stone[3];
    const px = Math.floor((x - x0) / 4), py = Math.floor((y - y0) / 5);
    if ((x - x0) % 4 === 0 || (y - y0) % 5 === 0) return OUT;
    const pane = hash(px, py, 72); return pane < 0.3 ? "#124e89" : pane < 0.5 ? "#feae34" : pane < 0.68 ? "#68182c" : pane < 0.85 ? "#3e8948" : "#0099db";
  }

  // ---- the portrait hall
  // the portraits of the castle's lords and ladies in gilt frames on blue damask, over oak panelling; slashed, and daubed with the hand
  const PORTRAITS = [[66, 0], [150, 1], [296, 2], [350, 3], [508, 4], [700, 5], [760, 6], [920, 7], [1080, 8]].filter(([x]) => !(x >= 440 && x < 504) && !(x >= 600 && x < 664));
  function portraitAt(x, y) {
    for (const [px, id] of PORTRAITS) {
      const x0 = px - 9, y0 = 12, w = 18, h = 22; if (x < x0 || x >= x0 + w || y < y0 || y >= y0 + h) continue;
      const u = x - x0, v = y - y0;
      if (u === 0 || v === 0) return R.gilt[3]; if (u === w - 1 || v === h - 1) return R.gilt[1]; if (u === 1 || v === 1 || u === w - 2 || v === h - 2) return R.gilt[2];
      // the canvas: a dark ground, the lord's head and shoulders, the castle's blue behind; a tear across some, the green hand over others
      if (id % 3 === 1 && Math.abs((u - 3) - (v - 3) * 0.8) < 0.9 && v > 2) return OUT;
      if (id % 3 === 2 && inHand(u - 5, v - 7)) return HAND[(u + v) & 1];
      const hx = 9, hy = 9, head = ((u - hx) ** 2) / 10 + ((v - hy) ** 2) / 12 <= 1, hair = ((u - hx) ** 2) / 14 + ((v - hy + 2) ** 2) / 9 <= 1 && v < hy - 1;
      if (hair) return id % 2 ? "#3e2731" : "#c0cbdc";
      if (head) return u < hx ? R.bone[1] : R.bone[0];
      if (v >= 14) return (u > 4 && u < 14) ? (id % 2 ? R.blue[1] : R.wine[1]) : "#1e1828";
      if (v >= 13 && u > 6 && u < 12) return R.bone[3];   // the lace collar
      return id % 2 ? "#193c3e" : "#262b44";
    }
    return null;
  }
  const PH_DOORS = [[456, 32], [616, 32], [856, 32], [1000, 32]];
  function phBack(x, y) {
    const sc = sconceAt(x, y); if (sc) return sc;
    // the beam
    if (y < 8) return y < 2 ? R.oakD[0] : y < 6 ? (x % 24 === 0 ? R.gilt[1] : R.oak[1 + (y === 2 ? 1 : 0)]) : R.oakD[0];
    // the stair arch at the east end, steps rising into the dark
    if (x >= 1068 && x < 1124) { const a = arched(x, y, 1068, 14, 56, 50); if (a) { if (a.rim) return R.stone[3]; const st = Math.floor((63 - y) / 4); return y > 58 - st * 0 && (y % 4 === 0) ? "#2a2235" : dith(x, y, Math.max(0, (y - 20) / 60)) ? "#3a3448" : "#1e1828"; } }
    for (const [dx, w] of PH_DOORS) { const d = oakDoor(x, y, dx, 22, w, 42); if (d) return d; }
    for (const wx of PH_WINDOWS) { const g = nightGlass(x, y, wx, 12, 14, 34); if (g) return g; }
    const p = portraitAt(x, y); if (p) return p;
    // armour niches behind the suits of armour
    for (const nx of [110, 390, 704, 940]) if (x >= nx - 8 && x < nx + 8 && y >= 22 && y < 64) { const a = arched(x, y, nx - 8, 22, 16, 42); if (a) return a.rim ? R.stone[2] : (y > 58 ? "#2a2235" : "#1e1828"); }
    // the dado rail, the oak panelling below it, the blue damask above
    if (y >= 37 && y <= 38) return y === 37 ? R.oak[2] : R.oakD[1];
    if (y > 38) { const pu = (x + 4) % 22, pv = (y - 41) % 20; if (y < 41 || y > 62) return R.oakD[1]; if (pu === 0 || pu === 1) return R.oakD[0]; if (pv === 0 || pu === 2) return R.oak[1]; if (pu === 21) return R.oakD[0]; return hash(x, y >> 2, 75) < 0.5 ? R.oakD[2] : R.oak[1]; }
    const lx = ((x % 12) + 12) % 12, ly = (((y - 8) % 12) + 12) % 12, dd = Math.abs(lx - 6) + Math.abs(ly - 6);
    return dd === 0 ? R.gilt[1] : dd === 6 ? "#103a66" : R.blue[0];
  }
  function phFloor(x, y) {
    // oak boards running east and west, the lord's blue runner down the middle with a gold border and the castle's wolf woven in it
    if (y >= 112 && y <= 160) {
      if (y === 112 || y === 160) return R.gilt[1]; if (y === 113 || y === 159) return R.gilt[2];
      const wx = (x + 48) % 96 - 48, wy = y - 136;
      if (Math.abs(wx) <= 4 && Math.abs(wy) <= 4 && ((wx * wx) / 16 + (wy * wy) / 12 <= 1 || (wy < -2 && Math.abs(Math.abs(wx) - 2) < 1))) return "#ead4aa";
      return (x % 4 === 0 && y % 4 === 2) || (x % 4 === 2 && y % 4 === 0) ? R.blue[1] : R.blue[0];
    }
    const row = Math.floor((y - 64) / 6), off = Math.floor(hash(row, 0, 77) * 40), seam = (x + off) % 46 === 0;
    if ((y - 64) % 6 === 5 || seam) return "#1e1626";
    return (y - 64) % 6 === 0 ? "#4f3537" : (hash(Math.floor((x + off) / 46), row, 78) < 0.5 ? "#3e2731" : "#2e2029");
  }
  function phBase(x, y) {
    if (y >= 216) return [NIGHT, 0];
    if (y >= 208) return [y === 208 ? R.stone[2] : y < 212 ? R.stone[1] : R.stone[0], 0];
    if (y < 64) return [phBack(x, y), 2];
    let c = phFloor(x, y);
    if (y < 69) c = dith(x, y, (69 - y) / 6) ? "#1e1828" : c;   // the wall's shadow on the floor
    return [c, 1];
  }

  // ---- the great stair
  function stBack(x, y) {
    const sc = sconceAt(x, y); if (sc) return sc;
    if (y < 8) return y < 2 ? R.oakD[0] : y < 6 ? R.oakD[1] : R.oakD[0];
    // the antechamber's doors: black oak and iron, the castle's wolf on the lintel with the troll king's crown daubed over it
    if (x >= 1500 && x < 1572 && y >= 24) { const a = arched(x, y, 1500, 24, 72, 72); if (a) { if (a.rim) return R.stone[3]; if (y < 34 && Math.abs(x - 1536) < 6) return y < 28 ? R.bone[2] : R.bone[1]; if (Math.abs(x - 1536) < 1) return OUT; if ((y - 24) % 12 === 6) return R.iron[(x & 1) + 1]; return x < 1536 ? "#2a1d28" : "#1e1626"; } }
    const ud = oakDoor(x, y, 1712, 56, 18, 40); if (ud) return ud;
    // the great window, moonlit
    const g = nightGlass(x, y, 1296, 12, 40, 70); if (g) return g;
    // the trolls' banners: black cloth, the green hand under a crude bone crown
    for (const bx of [1236, 1664]) if (x >= bx && x < bx + 22 && y >= 10 && y < 62 + ((x - bx) % 4 === 0 ? 3 : 0)) { const u = x - bx, v = y - 10; if (v < 2) return R.iron[1]; if (inHand(u - 7, v - 22)) return HAND[(u + v) & 1]; if (v >= 12 && v <= 16 && u >= 6 && u <= 15 && (v === 16 || (u - 6) % 3 === 0)) return R.bone[2]; return (u + v) % 5 === 0 ? "#262b44" : "#181425"; }
    return coursed(x, y, 8, 22, R.granite, 81);
  }
  const DEPTH = { T3: 0, T2: 0.1, T1: 0.2, T0: 0.3 };
  function stFloor(x, y, tier) {
    // big granite flags, quiet, each tier a step darker toward the foot of the shaft
    const fy = y - tier.y0, row = Math.floor(fy / 7), off = Math.floor(hash(row, tier.y0, 83) * 24), fx = x + off, col = Math.floor(fx / 24);
    const seam = fx % 24 === 0 || fy % 7 === 6;
    let c = seam ? "#241f2c" : fy % 7 === 0 ? "#363042" : (hash(col, row, 84) < 0.5 ? "#2e2838" : "#312b3c");
    if (hash(x, y, 85) > 0.988) c = "#262036";
    return DEPTH[tier.id] ? mix(c, [18, 14, 26], DEPTH[tier.id]) : c;
  }
  function stFace(x, y, f) {
    // a tier's face: the coping under the balustrade, coursed granite, darker toward its foot; at the flight, six steps rising north
    const [y0, y1] = f.face, [fx0, fx1] = f.flight;
    const sc = sconceAt(x, y); if (sc) return sc;
    if (x >= fx0 && x < fx1) {
      if (x < fx0 + 2 || x >= fx1 - 2) return x === fx0 || x === fx1 - 1 ? OUT : R.stone[1];   // the stringers
      const k = Math.floor((y - y0) / 6), v = (y - y0) % 6;
      if (v === 5) return OUT;
      return v < 3 ? (v === 0 ? R.stone[3] : R.stone[2]) : (hash(x, k, 85) < 0.1 ? R.stone[0] : R.stone[1]);
    }
    if (y - y0 < 3) return y === y0 ? R.stone[3] : y === y0 + 1 ? R.stone[2] : R.stone[1];
    const pil = ((x - 1164) % 96 + 96) % 96;
    if (pil < 10) return pil === 0 ? R.granite[3] : pil === 9 ? "#1e1a28" : (y - y0) % 9 === 8 ? JOINT : R.granite[2];   // a pilaster
    const c = coursed(x, y, 6, 16, R.granite, 86);
    return (y1 - y) < 6 && dith(x, y, (6 - (y1 - y)) / 6) ? "#1a1624" : c;
  }
  function stBase(x, y) {
    if (x < 1164 || x >= 1908) { const inner = x === 1163 || x === 1908; return [inner ? R.granite[2] : ((x + y) % 7 === 0 ? R.granite[1] : R.granite[0]), 2]; }
    if (y >= 640) return [y === 640 ? R.stone[2] : R.stone[1], 0];
    if (y < 96) return [stBack(x, y), 2];
    for (const t of TIERS) {
      if (t.face && y >= t.face[0] && y <= t.face[1]) return [stFace(x, y, t), 2];
      if (y >= t.y0 && y <= t.y1) {
        let c = stFloor(x, y, t);
        if (y - t.y0 < 3) c = dith(x, y, (3 - (y - t.y0)) / 4) ? "#16121e" : c;   // the face above throws its shadow
        return [c, 1];
      }
    }
    return [NIGHT, 0];
  }

  // ---- the antechamber
  function anBack(x, y) {
    const sc = sconceAt(x, y); if (sc) return sc;
    if (y < 8) return y < 2 ? R.oakD[0] : (y < 6 ? ((x - 1920) % 32 < 3 ? R.gilt[2] : R.oakD[1]) : R.oakD[0]);
    // the throne room's great doors: black oak and iron, ring handles, the castle's wolf on the stone lintel with the troll king's crown
    // daubed over it; (the seal of green fire chains across them is live: the art's wall hook, not the tile)
    if (x >= 2268 && x < 2340 && y >= 14) {
      const a = arched(x, y, 2268, 14, 72, 82); if (a) {
        if (a.rim) return R.stone[3];
        if (y < 30 && Math.abs(x - 2304) < 9) { const cr = y < 22 && (x - 2296) % 4 === 0; return cr ? R.bone[3] : (y < 24 ? R.bone[1] : "#3e3a4a"); }
        if (Math.abs(x - 2304) < 1) return OUT;
        if ((y - 14) % 14 === 7) return R.iron[(x & 1) + 1];
        if ((Math.abs(x - 2296) < 3 || Math.abs(x - 2312) < 3) && Math.abs(y - 62) < 3) return Math.hypot(x - (x < 2304 ? 2296 : 2312), y - 62) > 1.5 ? R.iron[3] : (x < 2304 ? "#2a1d28" : "#1e1626");   // the ring handles (the door shows through the ring)
        return x < 2304 ? "#2a1d28" : "#1e1626";
      }
    }
    for (const [gx, w] of [[2032, 28], [2548, 28]]) { const g = stainedGlass(x, y, gx, 12, w, 58); if (g) return g; }
    for (const sx of [1970, 2614]) { const d = oakDoor(x, y, sx, 50, 24, 46); if (d) return d; }
    // the tapestries: the castle's story, a knight and a white wolf on blue in a gold border, slashed by the trolls
    for (const tx of [2096, 2432]) if (x >= tx && x < tx + 84 && y >= 12 && y < 60) {
      const u = x - tx, v = y - 12;
      if (Math.abs((u - 10) - v * 1.4) < 1.1 || Math.abs((u - 60) + v * 0.9) < 1) return "#181425";
      if (u < 2 || v < 2 || u > 81 || v > 45) return R.gilt[(u + v) % 2 ? 2 : 1];
      if (((u - 26) ** 2) / 36 + ((v - 26) ** 2) / 16 <= 1 || (u > 30 && u < 34 && v > 16 && v < 24)) return "#ead4aa";   // the wolf
      if (u > 52 && u < 60 && v > 12 && v < 40) return v < 18 ? R.steel[3] : R.steel[2];                              // the knight
      return (u + v) % 6 === 0 ? R.blue[1] : R.blue[0];
    }
    return coursed(x, y, 7, 20, ["#2c2838", "#3e3a4a", "#4a4458", "#5a5468"], 88);
  }
  function anFloor(x, y) {
    // dark marble in a checker of 16 px with faint veins; the castle's blue carpet up to the dais, burnt through by the wizard's circle
    const dc = Math.hypot(x - 2304, (y - 268) * 1.4);
    if (Math.abs(dc - 44) < 1.6) return "#120e1a";
    if (dc < 42 && Math.abs(dc - 36) < 3.5) { const a = Math.atan2(y - 268, x - 2304), seg = Math.floor((a + Math.PI) / (Math.PI * 2) * 24); return (seg % 2 === 0 && Math.abs(dc - 36) < 1.5) ? HEXF[hash(seg, 0, 89) < 0.5 ? 0 : 1] : "#1e1626"; }
    if (dc < 14 && inHand(Math.round((x - 2300)), Math.round((y - 265) * 1.2))) return HEXF[0];
    if (x >= 2276 && x <= 2332 && y >= 148) {
      if (dc < 31 && dc > 0) { if (hash(x, y, 90) < 0.5 - dc / 80) return "#1e1626"; }
      if (x === 2276 || x === 2332) return R.gilt[1]; if (x === 2277 || x === 2331) return R.gilt[2];
      return (x + y) % 8 === 0 ? R.blue[1] : R.blue[0];
    }
    const cx = Math.floor((x - 1920) / 16), cy = Math.floor((y - 96) / 16), dark = (cx + cy) % 2 === 0, u = (x - 1920) % 16, v = (y - 96) % 16;
    let c = dark ? "#2a2434" : "#322c3e";
    if (u === 0 || v === 0) c = "#262036";
    const vein = Math.abs(Math.sin((x * 0.21 + y * 0.13) + vnoise(x, y, 9, 91) * 4)) < 0.05; if (vein) c = dark ? "#352f42" : "#3e3850";
    return c;
  }
  function anBase(x, y) {
    if (x < 1932 || x >= 2676) { const inner = x === 1931 || x === 2676; return [inner ? "#4a4458" : "#2c2838", 2]; }
    if (y >= 432) return [NIGHT, 0];
    if (y >= 424) return [y === 424 ? "#5a5468" : "#3e3a4a", 0];
    if (y < 96) return [anBack(x, y), 2];
    let c = anFloor(x, y);
    if (y < 101) c = dith(x, y, (101 - y) / 6) ? "#16121e" : c;
    // the stained glass's moonlight: its colours dithered onto the floor below each window
    for (const gx of [2046, 2562]) { const t = (y - 96) / 90, cx = gx + t * 26; if (t >= 0 && t < 1 && Math.abs(x - cx) < 10 - t * 4 && dith(x, y, 0.22 - t * 0.15)) c = mix(c, hex2([["#124e89"], ["#feae34"], ["#3e8948"]][Math.floor(hash(Math.floor(x / 4), Math.floor(y / 5), 92) * 3)][0]), 0.55); }
    return [c, 1];
  }
  // the unlit colour at (x, y) and its mode (0: left as it is, the lips and the night; 1: a floor, lit; 2: a wall, lit as a wall)
  function base(x, y) { return x < 1152 ? phBase(x, y) : x < 1920 ? stBase(x, y) : anBase(x, y); }
  function pixel(x, y, alt) { const b = base(x, y); return b[1] ? lit(b[0], x, y, b[1] === 2, alt) : b[0]; }


  // ------------------------------------------------------------------ the tiles (Gate.Tiles paints them in slices; a tile is the level's height)
  function paintRows(A, col, y0, y1, px) {
    const X0 = col * TW;
    for (let y = y0; y < y1; y++) { const o = y * TW; for (let x = 0; x < TW; x++) px[o + x] = pixel(X0 + x, y); }
    return px;
  }
  function paint(A, col) { const H = Math.max(432, A.h || 648), px = new Array(TW * H).fill(null); paintRows(A, col, 0, H, px); return { px, W: TW, H, col }; }

  // ================================================================== the pieces, each { px, w, h, ox, oy } on its foot (the sketch's)
  const PC = new Map(), once = (key, make) => { if (!PC.has(key)) PC.set(key, make()); return PC.get(key); };
  const done = (sp, ox, oy, extra) => { outline(sp); return G.sprite(sp.px, sp.W, sp.H, ox, oy, extra); };
  const raw = (sp, ox, oy) => G.sprite(sp.px, sp.W, sp.H, ox, oy);
  const P = {};
  // a marble bust of an old lord on a stone plinth, 22 tall; broken: the head knocked off, a jagged neck
  P.bust = broken => once("bust" + (broken ? 1 : 0), () => {
    const sp = new Grid(15, 27), cx = 7;
    region(sp, or(rect(cx - 4, 14, cx + 4, 23), rect(cx - 5, 12, cx + 5, 13), rect(cx - 5, 23, cx + 5, 24)), R.stone, { spec: (x, y) => y === 12, tex: (x, y) => y === 18 ? R.stone[1] : null });
    region(sp, or(ell(cx, 10, 5, 2.4), rect(cx - 2, 7, cx + 2, 9)), R.marble, { ball: [cx - 2, 8, 5] });
    if (!broken) { region(sp, ell(cx, 4.5, 2.8, 3.2), R.marble, { ball: [cx - 1, 3, 3] }); sp.set(cx + 2, 5, R.marble[1]); sp.set(cx - 1, 4, R.marble[0]); }
    else { sp.set(cx - 1, 6, R.marble[0]); sp.set(cx + 1, 6, R.marble[1]); sp.set(cx, 5, R.marble[2]); for (const [x, y] of [[cx - 3, 9], [cx - 2, 8], [cx + 3, 10]]) sp.set(x, y, HAND[1]); }
    return done(sp, cx, 24);
  });
  // a tier's stone balustrade along its south edge, w long, 8 tall, with a gap where a flight comes up (gap: [from, to] in its own x)
  P.balustrade = (w, gap) => once("bal" + w + "|" + (gap || []).join(), () => {
    const W = w + 2, sp = new Grid(W, 13);
    region(sp, (x, y) => x >= 1 && x <= W - 2 && !(gap && x >= gap[0] && x <= gap[1]) && (y >= 3 && y <= 4 || y === 10 || (y > 4 && y < 10 && (x % 4 === 1 || x % 4 === 2))), R.stone, { spec: (x, y) => y === 3, tex: (x, y) => (y > 4 && y < 10 && x % 4 === 2) ? R.stone[1] : null });
    if (gap) for (const gx of [gap[0] - 1, gap[1] + 1]) region(sp, rect(gx - 1, 1, gx + 1, 10), R.stone, { spec: (x, y) => y === 1 });   // the newel posts at the flight's head
    return done(sp, 1, 10);
  });
  // the iron gate across a flight's foot, seen face on: bars with spikes, 40 tall; rising into the vault when its wave is beaten (lift px)
  P.gateFront = (w, lift) => once("gf" + w + "|" + (lift | 0), () => {
    const H = 44, W = w + 2, sp = new Grid(W, H + 1), off = lift | 0;
    for (let x = 1; x < W - 1; x++) for (let y = 1; y < H - off; y++) {
      const bar = x % 5 === 1, cross = (y + off) % 13 === 6;
      if (bar) sp.set(x, y, y < 4 + 0 ? R.iron[3] : R.iron[x % 10 === 1 ? 2 : 1]);
      else if (cross) sp.set(x, y, R.iron[2]);
    }
    return done(sp, 1, H - 1);
  });
  // the great chandelier the trolls cut down: an iron ring 32 across lying flat, its candles spilt, a length of chain
  P.chandelier = () => once("chand", () => {
    const sp = new Grid(42, 24), cx = 20, cy = 13;
    region(sp, (x, y) => { const d = Math.hypot(x - cx, (y - cy) * 2); return d > 13 && d < 16.5; }, R.iron, { tex: (x, y) => hash(x, y, 95) < 0.15 ? "#be4a2f" : null });
    region(sp, or(line(cx - 14, cy, cx + 14, cy, 1), line(cx, cy - 7, cx, cy + 7, 1)), R.iron, { flat: 1 });
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, x = cx + Math.cos(a) * 15, y = cy + Math.sin(a) * 7.5; if (hash(k, 0, 96) < 0.6) { sp.set(x, y - 1, R.bone[2]); sp.set(x, y - 2, R.bone[3]); } }
    region(sp, line(cx + 15, cy - 4, cx + 20, cy - 10, 1), R.iron, { flat: 2 });
    return done(sp, cx, cy + 8);
  });
  // a crate of the trolls' plunder, 12 x 10 and 14 tall
  P.crate = () => once("crate", () => {
    const sp = new Grid(14, 22);
    region(sp, rect(1, 1, 12, 8), R.oak, { tex: (x, y) => (x === 6 || y === 4) ? R.oak[1] : null, spec: (x, y) => y === 1 });
    region(sp, rect(1, 9, 12, 20), R.oakD, { tex: (x, y) => (x === 1 || x === 12 || y === 9 || y === 20 || x - 1 === y - 9 || x - 1 === 20 - y) ? R.oak[1] : null });
    return done(sp, 1, 20);
  });
  // a brazier burning the Green Hand's fire: an iron basket on three legs, 14 tall, the green flames on four frames
  P.hexBrazier = f => once("hexBrazier" + (f & 3), () => {
    const sp = new Grid(15, 26), fr = f & 3, G = [HEXF[0], HEXF[1], HEXF[2], HEXF[3], HEXF[4]];
    region(sp, or(line(3, 24, 6, 14, 1), line(11, 24, 8, 14, 1), line(7, 24, 7, 15, 1)), R.iron);
    region(sp, or(ell(7, 13, 6, 2.5), rect(2, 11, 12, 13)), R.iron, { tex: (x, y) => (x % 2 === 0 && y === 12) ? R.iron[3] : null });
    for (let x = 3; x <= 11; x++) sp.set(x, 10, hash(x, fr, 97) < 0.5 ? G[1] : G[2]);
    const F = [["..5.5..", ".55455.", "5443445", "4333334"], [".5...5.", ".54.45.", "5444335", "4333334"], ["...5...", ".5545..", "5434435", "4333334"], [".5..5..", "..5455.", "5443445", "4333344"]][fr];
    for (let j = 0; j < F.length; j++) for (let k = 0; k < 7; k++) { const ch = F[j][k]; if (ch !== ".") sp.set(4 + k, 6 + j, G[+ch - 1]); }
    sp.set(7, 2 + fr % 2, G[4]);
    return done(sp, 7, 24);
  });
  // a stone wolf sitting on its haunches beside the throne room's doors, 30 tall (dir 1: facing right, -1: left)
  P.wolfStatue = dir => once("wolfStatue" + dir, () => {
    const sp = new Grid(24, 36), m = x => dir > 0 ? x + 1 : 22 - x;
    region(sp, or(rect(3, 28, 20, 33)), R.stone, { flat: 1, spec: (x, y) => y === 28 });
    region(sp, (x, y) => or(ell(m(10), 21, 6, 7), ell(m(14), 13, 3.5, 6), ell(m(15), 8, 3.4, 3), poly([[m(16), 7], [m(21), 9], [m(20), 11], [m(16), 11]].map(([a, b]) => [a, b])), rect(m(dir > 0 ? 13 : 6), 6, m(dir > 0 ? 13 : 6), 6))(x, y), R.stone, { ball: [m(9), 12, 10] });
    for (const [x, y] of [[13, 3], [14, 4], [16, 3], [16, 4]]) sp.set(m(x), y, R.stone[2]);   // the ears
    sp.set(m(17), 8, OUT);
    region(sp, or(rect(m(dir > 0 ? 12 : 8), 22, m(dir > 0 ? 13 : 9), 28), rect(m(dir > 0 ? 15 : 5), 22, m(dir > 0 ? 16 : 6), 28)), R.stone, { flat: 2 });
    for (const [x, y] of [[9, 18], [10, 19], [8, 19], [9, 20], [10, 21], [11, 20]]) sp.set(m(x), y, HAND[(x + y) & 1]);   // the green hand on its flank
    return done(sp, 12, 33);
  });
  // the dais before the throne room's doors: white marble, 192 x 40 and 6 up, two steps along its whole south side (12 deep)
  P.dais = () => once("dais", () => {
    const W = 194, H = 40 + 12 + 6 + 2, sp = new Grid(W, H);
    const M = ["#262b44", "#3a4466", "#4a5578", "#5a6988"];
    region(sp, rect(1, 1, W - 2, 40), M, { tex: (x, y) => { const u = x % 24, v = y % 10; if (u === 0 || v === 0) return M[1]; return (x + y * 3) % 23 === 0 ? M[1] : (y < 3 ? M[3] : M[2]); } });
    region(sp, rect(1, 41, W - 2, 46), M, { flat: 1, tex: (x) => x % 24 === 0 ? M[0] : null });
    region(sp, rect(1, 47, W - 2, 49), M, { flat: 2 }); region(sp, rect(1, 50, W - 2, 52), M, { flat: 1 });
    region(sp, rect(1, 53, W - 2, 55), M, { flat: 2 }); region(sp, rect(1, 56, W - 2, 57), M, { flat: 0 });
    return done(sp, 1, 40);
  });

  // ================================================================== THE TELEGRAPHS AND EFFECTS this level adds (gate.js and trolls.js)
  // the Green Hand's ward: a dome of his light over him, r 20, its rim bright and its runes turning; four frames
  P.ward = f => once("ward" + (f & 3), () => {
    const r = 20, W = 2 * r + 5, H = 60, sp = new Grid(W, H), cx = r + 2, base = H - 7, fr = f & 3;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x - cx) / r, dy = (y - base) / 50, dyb = (y - base) / (r * 0.35), dome = dy <= 0 && dx * dx + dy * dy <= 1, foot = dy > 0 && dx * dx + dyb * dyb <= 1;
      if (!dome && !foot) continue;
      const rim = dome ? 1 - Math.sqrt(dx * dx + dy * dy) : 1 - Math.sqrt(dx * dx + dyb * dyb);
      if (rim < 0.05) { sp.set(x, y, (x + y + fr) % 3 === 0 ? HEXF[4] : HEXF[3]); continue; }
      if (dome && rim < 0.16 && dith(x + fr, y, 0.4)) sp.set(x, y, HEXF[2]);
      else if (dome && dith(x + fr * 2, y + fr, 0.06)) sp.set(x, y, HEXF[3]);
      if (foot && Math.abs(Math.atan2(dyb, dx) * 4 + fr) % 2 < 0.4 && rim < 0.35) sp.set(x, y, HEXF[3]);
    }
    return raw(sp, cx, base);
  });
  // the blink's glyph where he will stand: a green rune circle r 10 on the floor, drawing itself over the 0.5 s (q 0 to 1)
  P.glyph = q => once("glyph" + Math.round(q * 4), () => {
    const W = 25, H = 13, sp = new Grid(W, H), cx = 12, cy = 6;
    for (let k = 0; k < 64 * q; k++) { const a = k / 64 * TAU, x = cx + Math.cos(a) * 11, y = cy + Math.sin(a) * 5.5; sp.set(x, y, HEXF[k % 4 === 0 ? 4 : 3]); }
    if (q >= 0.5) for (let k = 0; k < 6; k++) { const a = k / 6 * TAU, x = cx + Math.cos(a) * 7, y = cy + Math.sin(a) * 3.5; sp.set(x, y, HEXF[2]); sp.set(x + 1, y, HEXF[1]); }
    if (q >= 1) { sp.set(cx, cy, HEXF[4]); sp.set(cx - 1, cy, HEXF[3]); sp.set(cx + 1, cy, HEXF[3]); }
    return raw(sp, cx, cy);
  });
  // a hexbolt: a green orb with a white heart and a short trail behind it (a, its heading), two frames
  P.hexbolt = (a, f) => once("hexbolt" + G.dirOf(a) + "|" + (f & 1), () => {
    const W = 15, H = 15, sp = new Grid(W, H), cx = 7, cy = 7, ux = Math.cos(a), uy = Math.sin(a);
    for (let k = 6; k >= 1; k--) { const x = cx - ux * k * 1.2, y = cy - uy * k * 1.2; sp.set(x, y, k > 4 ? HEXF[0] : k > 2 ? HEXF[1] : HEXF[2]); }
    region(sp, ell(cx, cy, 2.2, 2.2), [HEXF[2], HEXF[3], HEXF[4], HEXF[4]], { ball: [cx - 1, cy - 1, 2.4] });
    sp.set(cx, cy, "#ffffff"); if (f) { sp.set(cx + 2, cy - 2, HEXF[3]); sp.set(cx - 2, cy + 2, HEXF[2]); }
    return raw(sp, cx, cy);
  });
  // the burster's blast: a ring of green fire r 44 thrown out, white at its heart, smoke after (q 0 to 1 of its 0.4 s)
  P.blast = (r, q) => once("blast" + Math.round(r) + "|" + Math.round(q * 8), () => {
    const R0 = Math.round(r), W = 2 * R0 + 5, H = 2 * R0 + 5 + 20, sp = new Grid(W, H), cx = R0 + 2, cy = R0 + 2 + 20, rr = R0 * (0.4 + q * 0.6);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - cx, y - cy), a = Math.atan2(y - cy, x - cx);
      if (Math.abs(d - rr) < 2.6) sp.set(x, y, Math.abs(d - rr) < 1.1 ? "#ffffff" : HEXF[3]);
      else if (d < rr - 2 && d > rr - 9 && Math.sin(a * 9 + q * 4) > 0.35) sp.set(x, y, HEXF[2]);               // tongues of fire inside the ring
      else if (d < rr * 0.45 && dith(x, y, Math.max(0, 0.9 - q))) sp.set(x, y, d < rr * 0.25 ? "#ffffff" : HEXF[4]);   // the flash
      else if (d < rr && hash(x, y, 98) < 0.05) sp.set(x, y, HEXF[4]);
    }
    // smoke rising from the heart
    for (let k = 0; k < 7; k++) { const sx = cx + (hash(k, 1, 97) - 0.5) * rr, sy = cy - 6 - k * 3 - q * 8; region(sp, ell(Math.round(sx), Math.round(sy), 3, 2.2), ["#262b44", "#3a4466", "#5a6988", "#8b9bb4"], { ball: [sx - 1, sy - 1, 3] }); }
    return raw(sp, cx, cy);
  });
  // the seal on the throne room's doors: two chains of green fire crossed in an X, burning while he lives (f: the flicker)
  P.seal = f => once("seal" + (f & 1), () => {
    const W = 64, H = 66, sp = new Grid(W, H);
    for (const [x0, y0, x1, y1] of [[2, 4, 61, 62], [61, 4, 2, 62]]) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let i = 0; i <= n; i++) { const t = i / n, x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t), link = (i >> 2) % 2;
        sp.set(x, y, link ? HEXF[3] : HEXF[2]); sp.set(x + 1, y, link ? HEXF[1] : HEXF[3]); if ((i + (f & 1) * 3) % 7 === 0) { sp.set(x, y - 1, HEXF[4]); sp.set(x + 1, y - 2, HEXF[3]); } }
    }
    for (const [x, y] of [[2, 4], [61, 4], [2, 62], [61, 62]]) region(sp, ell(x, y, 2.5, 2.5), R.iron, { ball: [x - 1, y - 1, 2.5] });
    region(sp, ell(31.5, 33, 4, 4), [HEXF[1], HEXF[2], HEXF[3], HEXF[4]], { ball: [30, 31, 4] });
    return raw(sp, 0, 0);
  });
  // the bats roosting under the beam before the fight: little folded shapes hanging in a row
  P.roost = (w, seed) => once("roost" + w + "|" + seed, () => {
    const sp = new Grid(w, 10);
    for (let x = 3; x < w - 3; x += 7 + Math.floor(hash(x, seed, 99) * 9)) { region(sp, or(ell(x, 4, 1.6, 3), rect(x, 0, x, 1)), R.fur, { ball: [x - 1, 3, 2] }); sp.set(x - 1, 6, HEXEYE); }
    return done(sp, 0, 0);
  });

  // ------------------------------------------------------------------ the fizzle: a puff of green smoke where a burster died unburst (four frames)
  P.fizzle = f => once("fizzle" + (f & 3), () => {
    const sp = new Grid(21, 21), fr = f & 3, cx = 10, cy = 16 - fr * 2;
    for (let k = 0; k < 4 + fr; k++) { const a = k / (4 + fr) * TAU + fr, rr = 3 + fr * 1.5, x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.6; region(sp, ell(Math.round(x), Math.round(y), 2.5 - fr * 0.3, 2 - fr * 0.3), fr < 2 ? [HEXF[0], HEXF[1], HEXF[2], HEXF[3]] : ["#262b44", "#3a4466", "#5a6988", "#8b9bb4"], { ball: [x - 1, y - 1, 2.5] }); }
    if (fr < 2) sp.set(cx, cy, HEXF[4]);
    return raw(sp, cx, 18);
  });
  // the wizard's stone where he fell: his stone frame standing, from the troll painter
  function wizardStone(ctx, x, y) { const T = root.Trolls; if (!T) return; const fr = T.frame("wizard", "toward", "stone", 0); ctx.drawImage(fr.canvas(), Math.round(x) - 24, Math.round(y) - 47); }

  // ================================================================== the art module (Gate.Scene's hooks)
  const PREP = new WeakMap();
  function prep(A) {
    let P0 = PREP.get(A); if (P0) return P0;
    P0 = { A, W: A.w || 2688, H: A.h || 648, tiers: A.tiers || TIERS.map(t => ({ id: t.id, y0: t.y0, y1: t.y1, face: t.face, flight: t.flight ? { x0: t.flight[0], x1: t.flight[1] } : undefined })), stairX: [1164, 1908] };
    const RM = (A.rooms || []).find(r => r.climb); if (RM) P0.stairX = [RM.x0 + 12, RM.x1 - 12];
    // the fires for the flicker rings, with an index each (the sketch's lights: the torches in their sconces, the braziers, the fallen chandelier's candles)
    P0.lights = LIGHTS.map((L, i) => Object.assign({ i, fy: L.wall ? 0.8 : 0.62 }, L));
    PREP.set(A, P0);
    return P0;
  }
  function stateOf(S) { return S.keep || (S.keep = { doors: {}, anteDoors: null, roostGone: null, seal: null, rings: new Map(), ringOrder: [], blasts: [] }); }
  // what the art reads of the fight each frame (the events say the same, sooner): a bedchamber door bursts when a troll came through it;
  // the antechamber's doors open when arena 4 is cleared; the roost empties when the first bat has come; the seal burns out at the end
  function sync(S, F) {
    const st = stateOf(S), A = S.A; if (!F) return st;
    const D = F.director, t = F.t || 0;
    for (const f of F.foes || []) if (f.door && /^door[A-D]$/.test(f.door) && st.doors[f.door] === undefined) st.doors[f.door] = t - (f.spawn > 0 ? 0 : 0.6);
    if (st.roostGone === null) for (const f of F.foes || []) if (f.kind === "bat") { st.roostGone = t; break; }
    const AD = (A.passages || []).find(p => p.id === "antechamberDoors");
    if (D && D.arenas && AD && AD.when && AD.when.cleared !== undefined && st.anteDoors === null) { const ar = D.arenas.find(a => a.id === AD.when.cleared); if (ar && ar.cleared) st.anteDoors = t; }
    const E = A.end || {};
    if (E.art === "sealBreaks" && F.level && F.level[E.open || "gateOpen"] && st.seal === null) st.seal = t;
    return st;
  }
  function take(e, F, S) {
    const st = stateOf(S), A = S.A, t = F ? F.t || 0 : 0;
    if (e.type === "spawn" && e.from && /^door[A-D]$/.test(e.from)) { if (st.doors[e.from] === undefined) st.doors[e.from] = t; return true; }
    if (e.type === "spawn" && e.kind === "bat") { if (st.roostGone === null) st.roostGone = t; return true; }
    if (e.type === "onward") { const AD = (A.passages || []).find(p => p.id === "antechamberDoors"); if (AD && AD.when && AD.when.cleared === e.arena && st.anteDoors === null) st.anteDoors = t; return true; }
    if (A.end && e.type === A.end.event && A.end.art === "sealBreaks") { if (st.seal === null) st.seal = t; return true; }
    if (e.type === "blast") { st.blasts.push({ x: e.x, y: e.y, z: e.z || 0, r: e.r || 44, t0: t }); while (st.blasts.length > 12) st.blasts.shift(); return true; }
    if (e.type === "fizzle") { st.blasts.push({ x: e.x, y: e.y, z: e.z || 0, r: 0, t0: t, fizzle: true }); while (st.blasts.length > 12) st.blasts.shift(); return true; }
    return false;
  }
  // an iron gate's lift (px) on the page's clock from its palisade's fall: 0 standing, rising over the fall's 0.6 s to 56, gone
  function gateLift(S, F, s, t) { const f = S.palisadeFrame(F, s, t); if (!f) return 0; if (f >= 4) return 56; const t0 = S.fell["pal" + s.id], q = clamp((t - t0) / (S.A.palisadeFall || 0.6), 0, 1); return Math.min(52, Math.round(q * 56 / 4) * 4); }
  const HPC = () => { const H = HALL(); return H ? H.sprites : null; };
  function pieces(A, S, act) {
    const P0 = prep(A), st = stateOf(S), pc = (F, x, y) => S.pieceAt(F, x, y), HS = HPC();
    for (const p of A.props || []) {
      const k = p.kind;
      if (k === "wall" || k === "face") continue;   // drawn in the tiles
      if (k === "bust") act(p.x - 8, p.y - 28, p.x + 8, p.y + 4, p.y, (ctx, F) => { const b = pc(F, p.x, p.y); if (b && b.gone) return; drawAt(ctx, P.bust(!!p.broken || !!(b && b.broken)), p.x, p.y); });
      else if (k === "armour") act(p.x - 9, p.y - 31, p.x + 9, p.y + 3, p.y, ctx => { if (HS) drawAt(ctx, HS.armour(), p.x, p.y); });
      else if (k === "chandelier") act(p.x - 22, p.y - 20, p.x + 22, p.y + 10, p.y, ctx => drawAt(ctx, P.chandelier(), p.x, p.y + 7));
      else if (k === "barrel") act(p.x - 7, p.y - 21, p.x + 7, p.y + 4, p.y, (ctx, F) => { const b = pc(F, p.x, p.y); if (b && b.gone) return; if (HS) drawAt(ctx, HS.barrel(), p.x, p.y); });
      else if (k === "crate") { const cx = (p.x0 + p.x1) / 2; act(p.x0 - 2, p.y1 - 22, p.x1 + 2, p.y1 + 2, p.y1, (ctx, F) => { const b = pc(F, cx, (p.y0 + p.y1) / 2); if (b && b.gone) return; drawAt(ctx, P.crate(), p.x0, p.y1); }); }
      else if (k === "brazier") { const z = p.base || 0; act(p.x - 8, p.y - z - 28, p.x + 8, p.y + 3, p.y, (ctx, F, o) => drawAt(ctx, P.hexBrazier(o.still ? 0 : Math.floor(o.t * 8 + p.x) & 3), p.x, p.y - z), z); }
      else if (k === "column") { const h = Math.max(20, p.y - 6); act(p.x - 10, 0, p.x + 10, p.y + 4, p.y, ctx => { if (HS) drawAt(ctx, HS.pillar(h), p.x, p.y); }); }
      else if (k === "wolfStatue") { const z = p.base || 0, dir = p.x < 2304 ? 1 : -1; act(p.x - 12, p.y - z - 36, p.x + 12, p.y + 3, p.y, ctx => drawAt(ctx, P.wolfStatue(dir), p.x, p.y - z), z); }
      else if (k === "bench") { if (HS) { const s = HS.bench(p.x1 - p.x0, p.y1 - p.y0); act(p.x0 - 2, p.y0 - 10, p.x1 + 2, p.y1 + 2, p.y1, ctx => blit(ctx, s, p.x0 - 1, p.y1 + 1 - s.h)); } }
    }
    // the balustrades along the landings' south edges (drawn only: the face below is the solid), a gap where the flight below comes up
    const tiers = P0.tiers.slice().sort((a, b) => a.y0 - b.y0), [sx0, sx1] = P0.stairX;
    for (let i = 0; i + 1 < tiers.length; i++) {
      const T0 = tiers[i], below = tiers[i + 1]; if (!below.face) continue;
      const y = below.face[0] - 1, gap = below.flight ? [below.flight.x0 - sx0 + 1, below.flight.x1 - sx0] : null, s = P.balustrade(sx1 - sx0, gap);
      act(sx0 - 2, y - 12, sx1 + 2, y + 2, y, ctx => drawAt(ctx, s, sx0, y));
    }
    // the surfaces: the dais with its steps (one sprite, the bodies on it drawn by their feet, lifted by its height)
    for (const su of A.surfaces || []) {
      if (!su.rect || su.kind !== "landing") continue;
      const [x0, y0, x1, y1] = su.rect, z = su.z || 0;
      act(x0 - 2, y0 - z - 4, x1 + 2, y1 + 14, y0, (ctx, F, o) => { const s = P.dais(); blit(ctx, s, x0 - 1, y0 - z - 1); S.drawLifted(ctx, su.id, o); });
    }
    // the palisades: the hall's portcullis across the portrait hall (bars seen from the side, in 8 px slices), the bars across the west
    // flight's foot seen face on; both rise into the vault when their waves are beaten
    for (const s of A.palisades || []) {
      const Y = s.y || [64, 208];
      if (s.style === "portcullisFront") { const w = s.x1 - s.x0; act(s.x0 - 2, Y[1] - 46, s.x1 + 2, Y[1] + 2, Y[1], (ctx, F, o) => { const L = gateLift(S, F, s, o.t); if (L >= 56) return; drawAt(ctx, P.gateFront(w, L), s.x0, Y[1]); }); continue; }
      for (let y = Y[0]; y < Y[1]; y += 8) { const yy = Math.min(y + 6, Y[1]), cx = (s.x0 + s.x1) / 2; act(cx - 6, yy - 64, cx + 6, yy + 2, yy, (ctx, F, o) => { const L = gateLift(S, F, s, o.t); if (L >= 56 || !HS) return; drawAt(ctx, HS.portcullis(L), cx, yy); }); }
    }
    return st;
  }
  // the back walls' live things (drawn after the decals, before the floor's marks and the actors)
  const PH_DOORX = [456, 616, 856, 1000], DOOR_OF = { doorA: 456, doorB: 616, doorC: 856, doorD: 1000 };
  function wall(ctx, F, t, still, S) {
    const st = sync(S, F), v = S.view, vx0 = v.x0 - 16, vx1 = v.x0 + (S.vw || TW) + 16, ft = F ? F.t || 0 : 0, HS = HPC();
    let n = 0;
    if (v.y0 > 140) return 0;   // (the back walls are out of view)
    const tick = still ? 0 : Math.floor(t * 8);
    // the torches' flames, warm and green, over their baked sconces
    for (const L of SCONCES) { if (L.x < vx0 || L.x > vx1) continue; if (HS && L.k !== "hex") { drawAt(ctx, HS.flame((tick + L.x) & 3), L.x, L.y); n++; } else { drawAt(ctx, P.hexBrazier((tick + L.x) & 3), L.x, L.y + 18); n++; } }
    // the bedchamber doors burst open at their trolls' spawn: the leaves swing in over 0.3 s and stand open on the dark
    for (const [name, dx] of Object.entries(DOOR_OF)) { if (dx + 32 < vx0 || dx > vx1) continue; const at = st.doors[name]; if (at === undefined) continue; const q = still ? 1 : clamp((ft - at) / 0.3, 0, 1); drawAt(ctx, P.doorOpen(Math.min(3, Math.floor(q * 4))), dx, 22); n++; }
    // the antechamber's doors on the stair's top wall: shut until the second Breather, then open on the dark
    if (1500 <= vx1 && 1572 >= vx0 && v.y0 < 100) { const q = st.anteDoors === null ? 0 : still ? 1 : clamp((ft - st.anteDoors) / 0.6, 0, 1); if (q > 0) { drawAt(ctx, P.anteOpen(Math.min(3, Math.floor(q * 4))), 1500, 24); n++; } }
    // the antechamber: the bats roosting under the beam until the vault drops them; the seal across the throne room's doors while he lives
    if (vx1 >= 1932 && vx0 <= 2676) {
      if (st.roostGone === null) for (const x0 of [1960, 2120, 2420, 2560]) { if (x0 + 90 < vx0 || x0 > vx1) continue; drawAt(ctx, P.roost(90, x0), x0, 8); n++; }
      if (2268 <= vx1 && 2340 >= vx0) {
        if (st.seal === null) { drawAt(ctx, P.seal(still ? 0 : tick & 1), 2272, 22); n++; }
        else if (!still) { const q = (ft - st.seal) / 1.2; if (q < 1) { drawAt(ctx, P.sealBurn(Math.min(3, Math.floor(q * 4))), 2272, 22); n++; } }
      }
    }
    return n;
  }
  // a bedchamber door standing open: the leaves swung in on the dark, four frames of the swing (over the tile's shut door, 32 x 42)
  P.doorOpen = f => once("doorOpen" + (f & 3), () => {
    const sp = new Grid(34, 44), fr = f & 3, w = Math.round(14 * (1 - fr / 3));
    region(sp, (x, y) => x >= 1 && x <= 32 && y >= 1 && y <= 42 && !(y < 1 + 16 && ((x - 16.5) / 16) ** 2 + ((y - 17) / 16) ** 2 > 1), ["#1a1424", "#1e1828", "#241c30", "#2a2235"], { flat: fr === 3 ? 0 : 1 });
    for (const side of [1, -1]) for (let y = 2; y <= 41; y++) for (let k = 0; k < w; k++) { const x = side > 0 ? 1 + k : 32 - k; if (y < 17 && ((x - 16.5) / 16) ** 2 + ((y - 17) / 16) ** 2 > 1) continue; sp.set(x, y, k === w - 1 ? R.oakD[0] : (y % 9 === 4 ? R.iron[1] : (side > 0 ? R.oakD[2] : R.oakD[1]))); }
    return raw(sp, 1, 1);
  });
  // the antechamber's doors on the stair's wall standing open (72 x 72), the leaves swung back on the dark, four frames
  P.anteOpen = f => once("anteOpen" + (f & 3), () => {
    const sp = new Grid(74, 74), fr = f & 3, w = Math.round(30 * (1 - fr / 3));
    region(sp, (x, y) => x >= 1 && x <= 72 && y >= 1 && y <= 72 && !(y < 37 && ((x - 36.5) / 36) ** 2 + ((y - 37) / 36) ** 2 > 1), ["#14101c", "#1a1424", "#1e1828", "#241c30"], { flat: 1, tex: (x, y) => y > 60 && (y - 60) % 4 === 0 ? "#2a2235" : null });
    for (const side of [1, -1]) for (let y = 2; y <= 71; y++) for (let k = 0; k < w; k++) { const x = side > 0 ? 1 + k : 72 - k; if (y < 37 && ((x - 36.5) / 36) ** 2 + ((y - 37) / 36) ** 2 > 1) continue; sp.set(x, y, k === w - 1 ? OUT : ((y - 1) % 12 === 6 ? R.iron[(x & 1) + 1] : (side > 0 ? "#2a1d28" : "#1e1626"))); }
    return raw(sp, 1, 1);
  });
  // the seal burning out at the end (four frames: the chains dim, break and are gone)
  P.sealBurn = f => once("sealBurn" + (f & 3), () => {
    const s = P.seal(0), sp = new Grid(s.w, s.h), fr = f & 3;
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const c = s.px[y * s.w + x]; if (!c) continue; if (hash(x, y, 300 + fr) < 0.25 * (fr + 1)) continue; sp.set(x, y, fr < 2 ? c : (fr === 2 ? "#3a4466" : "#262b44")); }
    return raw(sp, 0, 0);
  });

  // ------------------------------------------------------------------ the flicker rings (the hall's way): per fire in view, at most 8, its pool
  // re-lit at its radius +3, +1 or -2 on its own phase; a ring is the pixels whose light changes, baked once (48 kept)
  const DELTA = [0, 3, 1, -2];
  function ringSprite(S, P0, L, f) {
    const st = stateOf(S), key = L.i + "|" + f;
    let s = st.rings.get(key); if (s) return s;
    const R1 = L.r + Math.max(0, DELTA[f]) + 1, hx = Math.ceil(R1), hy = Math.ceil(R1 / L.fy), x0 = Math.floor(L.x) - hx, y0 = Math.floor(L.y) - hy, W = 2 * hx + 1, H = 2 * hy + 1, px = new Array(W * H).fill(null);
    const alt = { L: LIGHTS[L.i], r: L.r + DELTA[f] };
    let any = 0;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const x = x0 + i, y = y0 + j; if (x < 0 || y < 0 || x >= P0.W || y >= P0.H) continue;
      const b = base(x, y); if (!b[1]) continue;
      const was = pixel(x, y), now = pixel(x, y, alt);
      if (was !== now) { px[j * W + i] = now; any++; }
    }
    s = G.sprite(px, W, H, 0, 0, { ring: true, light: L.i, phase: f, x0, y0, n: any });
    st.rings.set(key, s); st.ringOrder.push(key);
    while (st.ringOrder.length > 48) st.rings.delete(st.ringOrder.shift());
    return s;
  }
  function lights(ctx, F, t, still, S) {
    if (still) return 0;
    const P0 = prep(S.A), v = S.view, VW = S.vw || TW, VH = S.vh || 216, cx = v.x0 + VW / 2, cy = v.y0 + VH / 2, tick = Math.floor(t * 8);
    const fires = P0.lights.filter(L => L.x + L.r >= v.x0 && L.x - L.r <= v.x0 + VW && L.y + L.r / L.fy >= v.y0 && L.y - L.r / L.fy <= v.y0 + VH);
    fires.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
    let n = 0, made = 0; const st = stateOf(S);
    for (const L of fires.slice(0, 8)) { const f = (tick + L.i * 3) & 3; if (!f) continue; if (!st.rings.has(L.i + "|" + f)) { if (made >= 1) continue; made++; } const s = ringSprite(S, P0, L, f); if (s.n) { blit(ctx, s, s.x0, s.y0); n++; } }
    return n;
  }
  // the marks' looks: the halls' stone craters, broken slabs and grey chips (the Great Hall's, for every room of the Keep)
  function markLook(kind, r, v, x, y, A) { const H = HALL(); if (!H) return null; const MK = H.marks, rr = Math.max(2, Math.round(r || 4)), vv = (v | 0) % 3; if (kind === "crater") return MK.stoneCrater(rr, vv); if (kind === "filled") return MK.slabs(rr, vv); if (kind === "dirt") return MK.chips(rr, vv); if (kind === "crack") return MK.crack(rr, vv); return null; }
  function chipLook(kind, i) { const H = HALL(); if (!H) return null; if (kind === "clod") return H.marks.clod(); if (kind === "dirt") return H.marks.chip(i); return null; }
  const fx = { ward: P.ward, glyph: P.glyph, blast: P.blast, fizzle: P.fizzle, seal: P.seal, roost: P.roost, hexbolt: P.hexbolt, wizardStone };
  const art = { id: "Keep", tufts: false, paintRows, paint, pieces, lights, wall, markLook, chipLook, take, fx, sync, stateOf };
  const DRAWS = { wall: "tile", face: "tile", bust: "bust", armour: "armour (the hall's)", chandelier: "chandelier", barrel: "barrel (the hall's)", crate: "crate", brazier: "hexBrazier", column: "pillar (the hall's)",
    wolfStatue: "wolfStatue", bench: "bench (the hall's)", landing: "dais", stair: "dais (its steps)", portcullis: "portcullis (the hall's)", portcullisFront: "gateFront", wizardStone: "wizardStone" };
  root.Keep = { art, R, HEXF, prep, paint, paintRows, pixel, base, lightAt, lit, TIERS, LIGHTS, sprites: P, fx, sync, stateOf, inHand, DRAWS, ringSprite, DELTA };
  if (typeof module !== "undefined" && module.exports) module.exports = root.Keep;
})(typeof window !== "undefined" ? window : globalThis);
