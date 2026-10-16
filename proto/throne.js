// FORGE FOREVER: the Throne's painter (design pass 44 section 3.12 with revision 1; built by card t112, build 37 stage F).
// Level 4 is two rooms stacked in one world of 1920 x 1296, drawn in the cellar's grammar: the Throne Room (x 1152 to 1920, y 0 to 432: the
// north wall with the cloth of state over the throne, the troll banners, the sun inlaid at the heart, the crimson carpet from the south
// doors to the dais, black and gold-veined marble, the King's gold light and the braziers' fire; after the Wrath, ruined: the roof and the
// top of the wall gone to the night sky, the floor scorched, moonlight) and under it the King's Walk (x 1344 to 1728, y 432 to 1296: a
// gallery climbing north to the great doors, pilasters, torches, cold moon in shafts, the runner burnt where his feet went, the veins of
// the Ember's gold thickening toward the throne). Ported from the pass's sketch (docs/design/44-the-troll-king.sketch.js) and fitted to
// spec/throne.json; the King himself is proto/trolls.js's (the same sketch).
//
// It plugs into the Troll Gate's painter (proto/gate.js) as an art module, as the Keep's does: new Gate.Scene(area, Throne.art).
//   paintRows(A, col, y0, y1, px)  the five column tiles of 384 x 1296 with their light baked, in Gate.Tiles' slices; the world beyond
//                                  the two rooms is night. paint(A, col) is the whole tile; the ruin is a second set of tiles the scene
//                                  bakes in slices once the fight has begun and swaps in at the ruin event (ruinTiles)
//   pieces(A, S, act)              every standing piece as an actor sorted by its foot with the bodies: the columns (whole, cracked and
//                                  glowing with the Sunwheel's heat, or a stump in its rubble, by their solid's state), the statues, the
//                                  throne on its dais, the braziers (gone when the Wrath takes them), the hoard, the gallery's columns,
//                                  lords and standards, the tribute, the dais with its steps and the bodies on it
//   tufts: false                   no grass
//   ground(S, F)                   before the ground is drawn: the ruin's tiles baked a slice at a time once the fight has begun, swapped
//                                  in when the room is ruined (the ruin event swaps them at once)
//   lights(ctx, F, t, still, S)    the flicker rings of the fires in view (at most 8 a frame), the great doors open with his light pouring
//                                  into the gallery (one baked difference image, faded in over the doors' open time), and the castle
//                                  waking at the end (the veins dying grey behind a front of light)
//   wall(ctx, F, t, still, S)      the torches' flames on the walls (the Great Hall's)
//   actors(F, o, S, push)          the Legend Ember hung in the air, dropping and resting on the floor with its beacon; the broken sceptre;
//                                  his crown spinning up out of the burst
//   over(ctx, F, o, S)             after the actors: the live beams (the lance, the crown's fan, the Sunwheel), the Wrath's and the pop's
//                                  rings of light, the burst of his own pixels, the chips of a breaking prop, the take's column of light
//                                  and its rings
//   dies(e, F, S)                  the King's death is the end's (no stone, no crumble)
//   markLook, chipLook             the halls' stone craters, broken slabs and grey chips (the Great Hall's looks)
//   take(e, F, S)                  the events it listens for (the doors, the ruin, the Wrath, a prop breaking, the pop, the waking)
//   fx                             the level's effect painters the scene draws for its telegraph kinds (proto/gate.js): the beam, the red
//                                  line, the red strip, the big ring, the arc, the fissure, the Wrath's rays, the pillar, the ring of light
// The pixels are made without a DOM, so node can check them (tools/test-throne-art.js); canvases are made only when a page asks.
// Plain script, defines window.Throne; needs proto/gate.js (window.Gate, or required in node) and borrows the Great Hall's flame and its
// stone marks (proto/hall.js, window.Hall).
(function (root) {
  "use strict";
  const G = root.Gate || (typeof module !== "undefined" && typeof require === "function" ? require("./gate.js") : null);
  if (!G) throw new Error("proto/throne.js needs proto/gate.js");
  const HALL = () => root.Hall || (typeof module !== "undefined" && typeof require === "function" ? require("./hall.js") : null);
  const OUT = G.OUT, BAYER = G.BAYER, hash = G.hash, vnoise = G.vnoise, dith = G.dith, Grid = G.Grid, TW = G.TW;
  const rect = G.rect, ell = G.ell, or = G.or, line = G.line, outline = G.outline, drawAt = G.drawAt, blit = G.blit;
  const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // ------------------------------------------------------------------ the sketch's helpers and ramps (its lines, as they are)
  const and = (...f) => (x, y) => f.every(g => g(x, y));
  const not = f => (x, y) => !f(x, y);
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
  const R = {
    skin: ["#193c3e", "#265c42", "#3e8948", "#63c74d"], robe: ["#3e2731", "#a22633", "#e43b44", "#f6757a"],
    ermine: ["#8b9bb4", "#c0cbdc", "#ffffff", "#ffffff"], gold: ["#733e39", "#be4a2f", "#feae34", "#fee761"],
    iron: ["#262b44", "#3a4466", "#5a6988", "#8b9bb4"], stone: ["#4a4450", "#6e6a70", "#9a948c", "#c4bcae"],
    oak: ["#3e2731", "#733e39", "#b86f50", "#e4a672"], dark: ["#181425", "#262b44", "#3a4466", "#5a6988"],
    marble: ["#1d1a26", "#262233", "#302b40", "#3a344c"], granite: ["#2c2838", "#3e3a4a", "#555064", "#6e6a78"],
    blue: ["#0b2f55", "#124e89", "#0099db", "#2ce8f5"], burnt: ["#2a1d28", "#3e2731", "#733e39", "#be4a2f"]
  };
  const EMBER = ["#be4a2f", "#f77622", "#feae34", "#fee761", "#ffffff"];   // banked, low, lit, bright, white
  const GEM = { red: ["#a22633", "#e43b44"], blue: ["#124e89", "#0099db"] };
  // (the King's crown, for the crown piece of his end; the King's own is in proto/trolls.js)
  function crown(sp, cx, top, side, tilt, turned) {
    const w = side ? 6 : 9, w1 = turned ? 6 : w, t = tilt || 0;   // (revision 1) turned: the band runs cx - 9 to cx + 6, foreshortened toward the facing
    region(sp, (x, y) => x >= cx - w && x <= cx + w1 && y >= top + 6 + (x > cx ? t : 0) && y <= top + 9 + (x > cx ? t : 0), R.gold, { tex: (x, y) => y === top + 6 + (x > cx ? t : 0) ? R.gold[3] : null });
    const pts = side ? [[-6, 3], [-2, 1], [2, 0], [6, 2]] : turned ? [[-9, 3], [-5, 1], [-1, -1], [3, 1], [6, 3]] : [[-9, 3], [-5, 1], [0, -1], [5, 1], [9, 3]];
    for (const [px, py] of pts) {
      const x = cx + px, yb = top + 6 + (x > cx ? t : 0), y0 = top + py + (x > cx ? t : 0);
      region(sp, poly([[x - 1.6, yb + 0.5], [x + 0.5, y0], [x + 2.6, yb + 0.5]]), R.gold, { tex: (xx, yy) => xx <= x ? R.gold[3] : null });
      sp.set(x, y0 - 1, R.gold[3]);
    }
    if (turned) { sp.set(cx - 5, top + 8, GEM.blue[1]); sp.set(cx - 1, top + 8, GEM.red[1]); sp.set(cx + 3, top + 8 + t, GEM.blue[1]); sp.set(cx - 1, top + 7, "#f6757a"); }
    else if (!side) { sp.set(cx - 5, top + 8, GEM.blue[1]); sp.set(cx, top + 8 + 0, GEM.red[1]); sp.set(cx + 5, top + 8 + t, GEM.blue[1]); sp.set(cx, top + 7, "#f6757a"); }
    else { sp.set(cx - 2, top + 8, GEM.red[1]); sp.set(cx + 3, top + 8 + t, GEM.blue[1]); }
  }

  // ================================================================== the pieces: sprites { px, w, h, ox, oy } on their foot
  function piece(W, H, ox, oy, paint) { const g = new Grid(W, H); paint(g); return { px: g.px, w: W, h: H, ox, oy }; }
  const BLACKMARBLE = ["#181425", "#262233", "#3a344c", "#5a5468"];
  // a column of the throne room: black marble veined with gold, a gilt capital and base; whole, cracked (the Sunwheel grinding it: glowing
  // cracks, heat 0 to 1) or broken (a stump in its rubble). 70 tall standing; foot at its centre's floor point
  function column(state, heat) {
    const W = 24, H = state === "broken" ? 22 : 76;
    return piece(W, H, 12, H - 4, g => {
      if (state === "broken") {
        region(g, ell(12, 17, 11, 4.5), R.stone, { ball: [10, 15, 10], tex: (x, y) => hash(x, y, 81) < 0.3 ? R.stone[0] : null });
        region(g, poly([[5, 17], [5, 9], [8, 6], [11, 9], [14, 5], [17, 8], [19, 7], [19, 17]]), BLACKMARBLE, { ball: [9, 8, 8], tex: (x, y) => hash(x, y, 82) < 0.08 ? R.gold[2] : null });
        for (const [x, y] of [[3, 18], [20, 19], [7, 20], [16, 20]]) region(g, ell(x, y, 2, 1.5), R.stone, { flat: 1 });
        outline(g); return;
      }
      region(g, ell(12, 72, 11, 3.5), R.gold, { ball: [9, 71, 10] });                                       // the base
      region(g, rect(5, 10, 19, 70), BLACKMARBLE, { tex: (x, y, c) => {
        const v = vnoise(x * 2, y, 6, 83); if (Math.abs(v - 0.5) < 0.035) return R.gold[1];                 // gold veins in the marble
        if (x === 6 || x === 7) return BLACKMARBLE[2]; if (x >= 17) return BLACKMARBLE[0];
        if ((x === 10 || x === 14) && y % 9 > 1) return BLACKMARBLE[x === 10 ? 2 : 1];                         // its flutes
        return null; } });
      region(g, rect(3, 4, 21, 9), R.gold, { tex: (x, y) => y === 4 ? R.gold[3] : (x % 3 === 0 && y > 5 ? R.gold[1] : null) });   // the capital
      region(g, rect(5, 1, 19, 3), R.gold, { flat: 1 });
      if (state === "cracked") {
        const C = heat > 0.66 ? ["#fee761", "#ffffff"] : heat > 0.33 ? ["#f77622", "#fee761"] : ["#be4a2f", "#f77622"];
        for (const [x0, y0, x1, y1] of [[8, 20, 14, 34], [14, 34, 10, 46], [10, 46, 16, 60], [16, 26, 18, 40], [7, 52, 11, 64]]) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) g.set(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), C[i % 3 ? 0 : 1]); }
      }
      outline(g);
    });
  }
  // the throne: a high back of gold with a crown for a crest over crimson, broad gold arms with lions' paws, a crimson seat; it stands on
  // the dais against the north wall; 52 wide, 64 tall, its foot the seat's front centre
  function throne() {
    return piece(92, 108, 46, 104, g => {
      region(g, poly([[10, 104], [10, 30], [16, 18], [30, 10], [46, 6], [62, 10], [76, 18], [82, 30], [82, 104]]), R.gold, { tex: (x, y) => (x + y) % 9 === 0 ? R.gold[1] : (x === 12 || x === 13 ? R.gold[3] : null) });   // the back
      region(g, poly([[18, 80], [18, 34], [24, 24], [46, 18], [68, 24], [74, 34], [74, 80]]), R.robe, { tex: (x, y, c) => (x * 3 + y) % 11 === 0 ? R.robe[0] : ([30, 46, 62].includes(x) && y > 26 ? R.robe[0] : ([31, 47, 63].includes(x) && y > 26 ? R.robe[2] : null)) });   // its crimson, buttoned in rows
      for (const [px, top] of [[22, 8], [34, 3], [46, 0], [58, 3], [70, 8]]) region(g, poly([[px - 3.5, top + 10], [px + 0.5, top], [px + 4.5, top + 10]]), R.gold, { tex: (x) => x <= px ? R.gold[3] : null });   // the crest's points
      region(g, rect(18, 12, 74, 16), R.gold, { tex: (x, y) => y === 12 ? R.gold[3] : null }); g.set(46, 14, GEM.red[1]); g.set(32, 14, GEM.blue[1]); g.set(60, 14, GEM.blue[1]);
      region(g, rect(16, 80, 76, 92), R.robe, { tex: (x, y) => y === 80 ? R.robe[2] : null });                                          // the seat's cushion
      for (const sx of [2, 76]) { region(g, rect(sx, 64, sx + 13, 76), R.gold, { ball: [sx + 3, 65, 8] }); region(g, rect(sx + 2, 76, sx + 11, 104), R.gold, { tex: (x, y) => x === sx + 2 ? R.gold[3] : (y % 6 === 0 ? R.gold[1] : null) }); region(g, ell(sx + 6, 101, 7, 3.5), R.gold, { flat: 2 }); }
      region(g, rect(16, 92, 76, 104), R.gold, { tex: (x, y) => y === 92 ? R.gold[3] : (x % 4 === 0 ? R.gold[1] : null) });
      outline(g);
    });
  }
  // an old lord of Ardentia in stone on a plinth, his own crown knocked off and a troll crown daubed on his head in yellow
  function statue(broken) {
    return piece(22, broken ? 26 : 50, 11, broken ? 24 : 48, g => {
      const H = broken ? 26 : 50;
      region(g, rect(3, H - 10, 18, H - 3), R.stone, { tex: (x, y) => y === H - 10 ? R.stone[3] : null });   // the plinth
      if (broken) { region(g, poly([[6, H - 10], [7, H - 18], [11, H - 22], [15, H - 17], [16, H - 10]]), R.stone, { ball: [9, H - 18, 7] }); outline(g); return; }
      region(g, poly([[6, 40], [7, 18], [11, 14], [15, 18], [16, 40]]), R.stone, { ball: [9, 20, 12], tex: (x, y) => (x === 11 && y > 22) ? R.stone[0] : null });   // the robed body
      region(g, rect(5, 18, 17, 22), R.stone, { ball: [8, 18, 7] });                                          // the shoulders
      region(g, ell(11, 11, 3.5, 4), R.stone, { ball: [10, 10, 4] });                                        // the head
      region(g, line(15, 22, 18, 36, 2), R.stone, { flat: 2 }); region(g, line(18, 12, 18, 40, 1), R.stone, { flat: 3 });   // the stone sword held point down
      for (const [x, y] of [[8, 6], [9, 7], [10, 6], [11, 5], [12, 6], [13, 7], [14, 6], [8, 8], [14, 8]]) g.set(x, y, "#fee761");   // the daubed crown
      g.set(10, 11, "#3e2731"); g.set(12, 11, "#3e2731");
      outline(g);
    });
  }
  // a gold brazier on three feet, its fire (4 frames)
  function brazier(i) {
    return piece(16, 26, 8, 24, g => {
      region(g, poly([[2, 12], [14, 12], [11, 18], [5, 18]]), R.gold, { ball: [5, 13, 6] });
      for (const x of [4, 8, 12]) region(g, line(8, 18, x, 24, 1), R.gold, { flat: 1 });
      const F = ["#be4a2f", "#f77622", "#feae34", "#fee761"], t = (i | 0) % 4;
      region(g, poly([[3, 12], [4, 7 - (t & 1)], [6, 9], [8, 2 + (t === 2 ? 1 : 0)], [10, 8], [12, 5 + (t & 1)], [13, 12]]), F, { tex: (x, y) => y > 10 ? F[1] : y < 6 ? F[3] : F[2] });
      outline(g);
    });
  }
  // a heap of the hoard: gold coins, a cup, a lord's crown thrown on it
  function hoard(k) {
    return piece(28, 14, 14, 12, g => {
      region(g, ell(14, 11, 13, 5), R.gold, { tex: (x, y) => { const h = hash(x, y, 90 + k); return h < 0.15 ? R.gold[3] : h < 0.3 ? R.gold[1] : null; } });
      region(g, rect(8 + k * 3, 3, 11 + k * 3, 7), R.gold, { flat: 2 }); g.set(9 + k * 3, 3, R.gold[3]);
      for (const [x, y] of [[18, 6], [19, 5], [20, 6], [21, 5], [22, 6]]) g.set(x - k, y, R.gold[3]);
      g.set(20 - k, 7, GEM.red[1]);
      outline(g);
    });
  }
  // (revision 1) a troll standard of the gallery: a pole with a black hide hung from a crossbar, a crude crown daubed on it in yellow; foot at
  // the pole's base
  function standard() {
    return piece(18, 50, 9, 48, g => {
      region(g, rect(8, 4, 9, 48), R.oak, { tex: (x) => x === 8 ? R.oak[2] : R.oak[1] });                                  // the pole
      region(g, rect(2, 6, 16, 7), R.oak, { flat: 1 });                                                                      // the crossbar
      region(g, poly([[3, 8], [15, 8], [15, 30], [12, 34], [9, 31], [6, 34], [3, 30]]), ["#181425", "#1e1a24", "#262233", "#2c2838"], { tex: (x, y) => (x + y * 3) % 7 === 0 ? "#262233" : null });   // the hide
      for (const [x, y] of [[5, 15], [7, 13], [9, 15], [11, 13], [13, 15], [5, 16], [6, 16], [7, 16], [8, 16], [9, 16], [10, 16], [11, 16], [12, 16], [13, 16]]) g.set(x, y, "#fee761");   // its daubed crown
      region(g, ell(9, 3, 1.6, 1.6), R.gold, { flat: 2 });
      outline(g);
    });
  }
  // (revision 1) a heap of stone dust: what a troll turned to stone crumbles to when the castle wakes (§3.11); k varies it
  function dust(k) {
    return piece(16, 7, 8, 5, g => {
      region(g, ell(8, 4.5, 7, 2.6), R.stone, { tex: (x, y) => { const h = hash(x, y, 160 + k); return h < 0.25 ? R.stone[0] : h < 0.45 ? R.stone[2] : null; } });
      for (const [x, y] of [[3 + k, 2], [11 - k, 2], [7, 1]]) g.set(x, y, R.stone[1]);
    });
  }
  // (revision 1) the sceptre broken in two where it fell: the shaft's half and the half with the head and its dark shard; foot at the middle
  function brokenSceptre() {
    return piece(46, 14, 23, 9, g => {
      region(g, line(2, 10, 18, 7, 3), R.gold, { tex: (x, y) => (x + y) % 6 === 0 ? R.gold[1] : null });
      region(g, line(24, 9, 38, 11, 3), R.gold, { tex: (x, y) => (x + y) % 6 === 0 ? R.gold[1] : null });
      region(g, poly([[37, 7], [44, 8], [43, 13], [37, 13]]), R.gold, { ball: [38, 8, 4] });
      g.set(41, 10, "#3e2731"); g.set(42, 10, "#733e39");                                                                    // the shard, gone dark
      outline(g);
    });
  }
  // (revision 1) his crown, as it spins up out of the burst (f 0 flat, 1 tilted, 2 on its edge); foot at its middle
  function crownPiece(f) {
    return piece(24, 16, 12, 12, g => {
      const sp = new Grid(24, 16); crown(sp, 12, 1, f === 2, f === 1 ? 2 : 0, false);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 24; x++) { const c = sp.get(x, y); if (c) g.set(x, y, c); }
      outline(g);
    });
  }
  // the Legend Ember free in the air: a coin of white fire in its halo (the legendary orb's colours), 4 frames of its pulse
  function emberOrb(i) {
    return piece(15, 15, 7, 7, g => {
      const t = (i | 0) % 4, r = 6 + (t === 1 ? 0.5 : t === 3 ? -0.5 : 0);
      for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) { const d = Math.hypot(x - 7, y - 7); if (d <= r && dith(x, y, 1 - d / r + 0.15)) g.set(x, y, d < 2.2 ? "#ffffff" : d < 3.6 ? "#fee761" : d < 5 ? "#feae34" : "#f77622"); }
    });
  }  // (revision 1, §3.11) the Legend Ember lying on the floor: the legendary find at twice an orb's size, with a beacon three times as tall: a
  // pool of its light on the floor (40 x 12), short rays, the Ember a few pixels over the floor with its halo, a column of light 60 px tall
  // whose pattern climbs a pixel a frame, motes rising beside it; foot at the Ember's floor point; f its frame (8 a second)
  function legendFind(f) {
    const W = 48, H = 96, cx = 24, gy = 90, cy = 80;
    f = f | 0;
    return piece(W, H, cx, gy, g => {
      for (let y = gy - 6; y <= gy + 5; y++) for (let x = 0; x < W; x++) { const e = ((x - cx) / 22.5) ** 2 + ((y - gy) / 5.8) ** 2; if (e <= 1 && dith(x, y, 0.97 - e * 0.6)) g.set(x, y, e < 0.14 ? "#fee761" : e < 0.42 ? "#feae34" : e < 0.72 ? "#f77622" : "#be4a2f"); }
      for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + 0.2, r0 = 9 + ((f + k) & 1), r1 = 17 + ((f >> 1) + k) % 3; for (let r = r0; r <= r1; r++) { const x = Math.round(cx + Math.cos(a) * r), y = Math.round(gy + Math.sin(a) * r * 0.32); g.set(x, y, r < r0 + 3 ? "#ffffff" : "#fee761"); } }
      // the beacon: a column of light 5 px across and 78 tall, a white core, thinning and climbing a pixel a frame
      for (let y = cy - 9; y >= 1; y--) { const u = (cy - 9 - y) / (cy - 10); for (const dx of [-2, -1, 0, 1, 2]) { const w = dx === 0 ? 1.05 : Math.abs(dx) === 1 ? 0.8 : 0.42; if (dith(cx + dx, y + f, w - u * 0.8)) g.set(cx + dx, y, dx === 0 && u < 0.5 ? "#ffffff" : u < 0.3 ? "#fee761" : u < 0.7 ? "#feae34" : "#f77622"); } }
      for (let i = 0; i < 7; i++) { const q = ((f + i * 1.17) % 8) / 8, y = Math.round(cy - 6 - q * 70), x = Math.round(cx + Math.sin((q * 2 + i * 0.9) * Math.PI) * (5 + (i % 3))); g.set(x, y, q < 0.5 ? "#ffffff" : "#fee761"); }
      // the halo round the Ember, dithered, pulsing with the frame
      for (let y = cy - 11; y <= cy + 11; y++) for (let x = cx - 11; x <= cx + 11; x++) { const d = Math.hypot(x - cx, y - cy); if (d > 6 && d <= 11 && dith(x, y, (0.75 - (d - 6) / 7) + ((f & 2) ? 0.08 : 0))) g.set(x, y, d < 8.5 ? "#fee761" : "#feae34"); }
      const e = emberOrb(f & 3); for (let j = 0; j < e.h; j++) for (let i = 0; i < e.w; i++) { const c = e.px[j * e.w + i]; if (c) g.set(cx - e.ox + i, cy - e.oy + j, c); }
    });
  }
  // (revision 1, §3.13) the Legend Ember's icon for the box: 24 x 24, a coin of white fire in a halo with three tongues of flame licking up
  // from it, four frames; shown at a whole-pixel scale (x 4 is 96 CSS px)
  function emberIcon(f) {
    const W = 24, g = new Grid(W, W), cx = 11.5, cy = 14; f = (f | 0) & 3;
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const d = Math.hypot(x - cx, (y - cy) * 1.05); if (d > 7.5 && d <= 11.5 && dith(x, y, 0.5 * (1 - (d - 7.5) / 4) + (f & 1) * 0.08)) g.set(x, y, d < 9.5 ? "#feae34" : "#f77622"); }
    const tongues = [[-4, 6 + (f === 1 ? 1 : 0)], [0, 9 + (f === 2 ? 1 : f === 0 ? -1 : 0)], [4, 6 + (f === 3 ? 1 : 0)]];
    for (const [dx, h] of tongues) region(g, poly([[cx + dx - 2.6, cy - 4], [cx + dx + 2.6, cy - 4], [cx + dx + 0.6 + (f & 1 ? 0.7 : -0.4), cy - 4 - h]]), ["#be4a2f", "#f77622", "#feae34", "#fee761"], { tex: (x, y) => y > cy - 4 - h * 0.45 ? "#fee761" : "#feae34" });
    region(g, ell(cx, cy, 6.6, 6.6), ["#be4a2f", "#f77622", "#feae34", "#fee761"], { ball: [cx - 1.5, cy - 1.5, 6.6] });
    region(g, ell(cx, cy, 4.4, 4.4), ["#feae34", "#fee761", "#fee761", "#ffffff"], { ball: [cx - 1, cy - 1, 4.4] });
    region(g, ell(cx - 0.5, cy - 0.5, 2.2, 2.2), ["#ffffff", "#ffffff", "#ffffff", "#ffffff"]);
    g.set(Math.round(cx - 2), Math.round(cy - 3), "#ffffff");
    outline(g);
    return { px: g.px, w: W, h: W };
  }

  // ================================================================== effects (drawn into an image by the painter; world px)
  // the beam: from (x0, y0) to (x1, y1), w px across (10 the lance, 12 the Sunwheel's): a white core, the Ember's yellow, an orange edge, a
  // dithered halo, a splash of sparks where it strikes, a flare at the sceptre; t the frame (its flicker)
  function beam(put, x0, y0, x1, y1, w, t) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux, hw = w / 2 + 2;
    const minX = Math.floor(Math.min(x0, x1) - hw - 3), maxX = Math.ceil(Math.max(x0, x1) + hw + 3), minY = Math.floor(Math.min(y0, y1) - hw - 3), maxY = Math.ceil(Math.max(y0, y1) + hw + 3);
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5 - x0, py = y + 0.5 - y0, a = px * ux + py * uy, d = Math.abs(px * nx + py * ny);
      if (a < -2 || a > L + 2) continue;
      const wob = (hash(Math.floor(a / 3), t | 0, 95) - 0.5) * 1.2, e = d + wob;
      if (e <= w * 0.18) put(x, y, "#ffffff"); else if (e <= w * 0.34) put(x, y, "#fee761"); else if (e <= w * 0.5) put(x, y, "#feae34");
      else if (e <= w * 0.5 + 1.2) put(x, y, "#f77622", 0.8); else if (e <= w * 0.5 + 3 && dith(x, y, 0.35)) put(x, y, "#feae34", 0.55);
    }
    for (let k = 0; k < 14; k++) { const a = hash(k, t | 0, 96) * TAU, r = 3 + hash(k, (t | 0) + 1, 96) * 9; put(Math.round(x1 + Math.cos(a) * r - ux * 3), Math.round(y1 + Math.sin(a) * r - uy * 3), k & 1 ? "#fee761" : "#ffffff"); }
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; put(Math.round(x0 + Math.cos(a) * 5), Math.round(y0 + Math.sin(a) * 5), "#fee761"); put(Math.round(x0 + Math.cos(a) * 3), Math.round(y0 + Math.sin(a) * 3), "#ffffff"); }
  }
  // a telegraph's red line (dotted, edged in soot), past gate.js's 320 px limit: the beam's aim line, the Sunwheel's first line
  function redLine(put, x0, y0, x1, y1) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
    for (let i = 0; i <= n; i++) { if (i % 6 > 3) continue; const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n); put(x, y + 1, OUT); put(x, y, "#ff0044"); }
  }
  // a red strip (a fissure's telegraph, the charge's lane): w px across, its edges solid, its inside hatched
  function redStrip(put, x0, y0, x1, y1, w) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux, hw = w / 2;
    const minX = Math.floor(Math.min(x0, x1) - hw - 2), maxX = Math.ceil(Math.max(x0, x1) + hw + 2), minY = Math.floor(Math.min(y0, y1) - hw - 2), maxY = Math.ceil(Math.max(y0, y1) + hw + 2);
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5 - x0, py = y + 0.5 - y0, a = px * ux + py * uy, d = Math.abs(px * nx + py * ny);
      if (a < 0 || a > L) continue;
      if (d > hw - 1 && d <= hw) put(x, y, "#ff0044"); else if (d > hw && d <= hw + 1) put(x, y, OUT); else if (d < hw - 1 && ((x + y) % 4 === 0)) put(x, y, "#ff0044", 0.7);
    }
  }
  // a ring past gate.js's 64 px clamp: the red dotted ring of a reach (the Wrath's 210), and q 0 to 1 its solid fill growing inside it
  function bigRing(put, cx, cy, r, q) {
    const n = Math.ceil(TAU * r);
    for (let i = 0; i < n; i++) { if (i % 6 > 3) continue; const a = i / n * TAU, x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r); put(x, y + 1, OUT); put(x, y, "#ff0044"); }
    if (q > 0) { const rr = r * q, m = Math.ceil(TAU * rr); for (let i = 0; i < m; i++) { const a = i / m * TAU, x = Math.round(cx + Math.cos(a) * rr), y = Math.round(cy + Math.sin(a) * rr); put(x, y + 1, OUT); put(x, y, "#ff0044"); put(x, y - 1, "#ff0044"); } }
  }
  // the Sunwheel's arc: a red arc round him (r, from angle a0 through span, dir 1 clockwise on screen) with an arrowhead at its end
  function arcArrow(put, cx, cy, r, a0, span, dir) {
    const n = Math.ceil(Math.abs(span) * r);
    for (let i = 0; i <= n; i++) { const a = a0 + dir * span * i / n, x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r); put(x, y + 1, OUT); put(x, y, "#ff0044"); put(x + 1, y, "#ff0044"); }
    const a = a0 + dir * span, ex = cx + Math.cos(a) * r, ey = cy + Math.sin(a) * r, tx = -Math.sin(a) * dir, ty = Math.cos(a) * dir;
    for (let k = 0; k <= 5; k++) for (let j = -k; j <= k; j++) { const x = Math.round(ex + tx * (5 - k) + Math.cos(a) * j * 0.8), y = Math.round(ey + ty * (5 - k) + Math.sin(a) * j * 0.8); put(x, y, "#ff0044"); }
  }
  // a fissure erupting: a crack of the Ember's light along the floor (the telegraph was its red strip)
  function fissure(put, x0, y0, x1, y1, t) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
    for (let i = 0; i <= n; i++) { const j = Math.round((hash(i >> 2, t | 0, 97) - 0.5) * 3), x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n) + j; put(x, y, "#ffffff"); put(x + 1, y, "#fee761"); put(x - 1, y, "#feae34"); if (hash(i, t | 0, 98) < 0.18) put(x, y - 2 - Math.round(hash(i, 2, 98) * 4), "#fee761"); }
  }
  // the Wrath's charge on the floor round him: rays of light cracking out to the ring, brighter as it fills (q 0 to 1)
  function wrathRays(put, cx, cy, r, q) {
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * TAU + hash(k, 1, 99) * 0.2, L = r * (0.25 + q * 0.7) * (0.6 + hash(k, 2, 99) * 0.4);
      for (let i = 12; i < L; i++) { const x = Math.round(cx + Math.cos(a) * i), y = Math.round(cy + Math.sin(a) * i * 0.9); if (hash(i, k, 100) < 0.85) put(x, y, i < L * 0.5 ? "#fee761" : "#feae34", q > 0.6 ? 1 : 0.8); }
    }
  }

  // the take's light (§3.11's cutscene): a column of the Ember's light from the knight's raised hand up off the top of the view (w 9: a white
  // core, yellow, gold, a dithered edge, flickering by t)
  function pillar(put, x, y, top, t) {
    for (let yy = Math.round(y); yy >= top; yy--) for (let dx = -6; dx <= 6; dx++) {
      const e = Math.abs(dx) + (hash(yy >> 2, (t | 0), 141) - 0.5) * 1.4;
      if (e <= 1.2) put(x + dx, yy, "#ffffff"); else if (e <= 2.6) put(x + dx, yy, "#fee761", 0.9); else if (e <= 4.2) put(x + dx, yy, "#feae34", 0.6); else if (e <= 6 && dith(x + dx, yy, 0.3)) put(x + dx, yy, "#feae34", 0.4);
    }
  }
  // a ring of the Ember's light rippling out across the floor (r its radius, q 0 to 1 how far through its 0.8 s, fading as it goes)
  function lightRing(put, cx, cy, r, q) {
    const n = Math.ceil(TAU * r), a0 = 1 - q;
    for (let i = 0; i < n; i++) { const a = i / n * TAU, x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r * 0.62); if (dith(x, y, 0.55 + a0 * 0.4)) { put(x, y, "#fee761", 0.5 + a0 * 0.5); put(x, y + 1, "#feae34", 0.35 + a0 * 0.4); } }
  }

  // ================================================================== the ground: the King's Walk and the Throne Room (and the ruin)
  // World px as spec/throne.json (proposed: docs/design/44-shots/throne-spec.json). Revision 1: the world is 1920 x 1296 and the two rooms
  // are stacked: the Throne Room x 1152 to 1920, y 0 to 432 (two screens: the beam 0 to 7, the north wall 8 to 95 with the throne's cloth
  // of state, the floor 96 to 423, the lip 424 to 431 with the doorway's gold threshold), and under it, on the carpet's line, the King's
  // Walk, a gallery x 1344 to 1728, y 432 to 1296 (one screen wide, four tall: the beam 432 to 439, the north wall 440 to 527 with the great
  // doors at x 1500 to 1572, the floor 528 to 1279 between side walls 16 px thick, the lip 1280 to 1287). Outside the two rooms is wall,
  // never in view. The corruption: veins of the Ember's gold in the stone, thickening toward the throne. o.ruined: the Throne Room after the
  // Wrath (the north wall broken to the night sky, the beam gone, the floor scorched and strewn, moonlight). o.doorsOpen: the great doors
  // swung in, his gold light pouring out. o.woken { x, y, r }: the castle waking from the knight who holds the Ember (§3.11's cutscene): the
  // veins within r of (x, y) gone grey and dead and a front of light at r (the crown daubed on the cloth of state burns away too, though
  // the throne's crest hides it from the camera, so the note does not count on it).
  const NIGHT = "#120e1a";
  const KS_dith = (x, y) => dith(x, y, 0.5);
  const WALK = { x0: 1344, x1: 1728, y0: 432, y1: 1296, wallY: 440, floorY: 528, lipY: 1280, side: 16, doors: [1500, 1572], runner: [1512, 1560], arch: [1536, 484, 36] };
  // each light a position, a radius and a colour (fire, gold, moon) in its room; shaft: moonlight falling in a band from a high window
  const LIGHTS = [
    { x: 1452, y: 128, r: 70, k: "fire", room: "throne" }, { x: 1620, y: 128, r: 70, k: "fire", room: "throne" }, { x: 1440, y: 404, r: 64, k: "fire", room: "throne" }, { x: 1632, y: 404, r: 64, k: "fire", room: "throne" },
    { x: 1536, y: 70, r: 150, k: "gold", wall: true, room: "throne" }, { x: 1536, y: 260, r: 60, k: "gold", room: "throne" },
    ...[1236, 1836].map(x => ({ x, y: 40, r: 56, k: "fire", wall: true, room: "throne" })),
    // the gallery (revision 1): cold moonlight in shafts across its lower half, torches on its walls, the braziers by the doors, and the
    // gold under the doors (far more when they open)
    ...[870, 1030, 1190].map(y => ({ x: 1360, y, r: 1, k: "moon", room: "walk", shaft: { a: 0.5, w: 15, len: 300 } })),
    ...[700, 924, 1148].flatMap(y => [{ x: 1366, y, r: 50, k: "fire", room: "walk" }, { x: 1706, y, r: 50, k: "fire", room: "walk" }]),
    { x: 1468, y: 562, r: 66, k: "fire", room: "walk" }, { x: 1604, y: 562, r: 66, k: "fire", room: "walk" },
    { x: 1536, y: 534, r: 74, k: "gold", room: "walk", shut: true }, { x: 1536, y: 500, r: 70, k: "gold", wall: true, room: "walk" }
  ];
  const RUIN_LIGHTS = [{ x: 1350, y: 240, r: 170, k: "moon" }, { x: 1720, y: 250, r: 170, k: "moon" }, { x: 1536, y: 30, r: 200, k: "moon", wall: true }];
  const DOOR_LIGHTS = [{ x: 1536, y: 548, r: 190, k: "gold" }, { x: 1536, y: 500, r: 110, k: "gold", wall: true }];
  const altL = (list, alt) => alt ? list.map(l => l === alt.L ? Object.assign({}, l, { r: alt.r }) : l) : list;
  function lightsFor(room, o) {
    const L = LIGHTS.filter(l => l.room === room);
    if (room === "throne") return o.ruined ? L.filter(l => l.k !== "gold").concat(RUIN_LIGHTS) : L;
    return o.doorsOpen ? L.filter(l => !l.shut).concat(DOOR_LIGHTS) : L;
  }
  const GOLD = [254, 174, 52], FIRE = [247, 118, 34], MOON = [90, 105, 136];
  function hex2(c) { return [1, 3, 5].map(k => parseInt(c.slice(k, k + 2), 16)); }
  function mix(c, to, a) { const v = hex2(c); return "#" + v.map((q, i) => Math.round(q + (to[i] - q) * a).toString(16).padStart(2, "0")).join(""); }
  function lit(c, x, y, list, wall) {
    if (!c || c === OUT) return c;
    let fire = 0, gold = 0, moon = 0;
    for (const L of list) {
      let k;
      if (L.shaft) { const ca = Math.cos(L.shaft.a), sa = Math.sin(L.shaft.a), u = (x - L.x) * ca + (y - L.y) * sa, d = Math.abs(-(x - L.x) * sa + (y - L.y) * ca); if (u < 0 || u > L.shaft.len || d > L.shaft.w) continue; k = (1 - d / L.shaft.w) * (1 - u / L.shaft.len) * 0.9; }
      else { const dx = x - L.x, dy = (y - L.y) * (L.wall ? 0.8 : 0.62); if (Math.abs(dx) > L.r || Math.abs(dy) > L.r) continue; k = 1 - Math.hypot(dx, dy) / L.r; }
      if (k <= 0) continue;
      if (L.k === "fire") fire = Math.max(fire, k); else if (L.k === "gold") gold = Math.max(gold, k); else moon = Math.max(moon, k);
    }
    const b = BAYER[(y & 3) * 4 + (x & 3)] / 16; let out = c;
    if (moon > 0) { const l = Math.floor(moon * 3 + b - 0.3); if (l > 0) out = mix(out, MOON, Math.min(0.55, l * 0.2)); }
    if (fire > 0) { const l = clamp(Math.floor(fire * 4 + b - 0.5), 0, 4); if (l > 0) out = mix(out, FIRE, [0, 0.14, 0.26, 0.38, 0.5][l] * (wall ? 0.9 : 1)); }
    if (gold > 0) { const l = clamp(Math.floor(gold * 4 + b - 0.5), 0, 4); if (l > 0) out = mix(out, GOLD, [0, 0.1, 0.18, 0.26, 0.34][l]); }
    return out;
  }
  // the corruption in the stone: gold veins that branch, denser toward the throne (k 0 to 1 their density here)
  function veinAt(x, y, k) { const v = vnoise(x, y * 1.4, 26, 101), w = vnoise(x + 300, y, 11, 102); return Math.abs(v - 0.5) < 0.0045 + k * 0.0055 && w > 0.55 - k * 0.25; }
  function coursed(x, y, course, w0) { const row = Math.floor(y / course), off = row % 2 ? (w0 >> 1) : 0, inX = (x + off) % w0, inY = y % course; return inX === 0 || inY === 0 ? 2 : inX === 1 || inY === 1 ? 1 : 0; }
  // the waking (revision 1): 0 where the castle still sleeps, 1 inside the dead ring, 2 on its bright front (the last 6 px)
  function wakeAt(o, x, y) { const W = o && o.woken; if (!W) return 0; const d = Math.hypot(x - W.x, (y - W.y) * 1.25); return d < W.r - 6 ? 1 : d <= W.r ? 2 : 0; }
  // the King's Walk (revision 1): a gallery climbing north to the great doors: the side walls seen from above (pilasters every 112 px),
  // the north wall in dark ashlar with the corruption at its thickest, two troll banners and the doors (black oak under gold leaf, his
  // light in the seam and under them; open, the opening full of his gold light and the two leaves dark slivers at the jambs); the floor a
  // checker of dark marble with the crimson runner up the middle, burnt where his feet went, the veins few at the foot and thick at the top
  function walkBase(x, y, o) {
    const W = WALK, cx = W.arch[0];
    if (y < W.wallY) return [y === W.wallY - 1 ? "#3e2731" : x % 32 === 0 ? R.gold[1] : "#2a1d28", 2];
    if (x < W.x0 + W.side || x >= W.x1 - W.side) {
      const inner = x === W.x0 + W.side - 1 || x === W.x1 - W.side, pil = y > 560 && y < 1270 && (y - 586) % 112 >= 0 && (y - 586) % 112 < 14;
      return [inner ? (pil ? "#4a4458" : "#3a3648") : pil ? "#2c2838" : (hash(x, y, 150) < 0.06 ? "#24202e" : "#1e1a24"), 2];
    }
    if (y < W.floorY) {
      const top = W.arch[1] - Math.round(Math.sqrt(Math.max(0, W.arch[2] * W.arch[2] - (x - cx + 0.5) ** 2)));
      if (x >= W.doors[0] && x <= W.doors[1] && y >= top - 2) {
        if (y < top || x <= W.doors[0] + 1 || x >= W.doors[1] - 1) return [R.gold[y === top - 2 || x === W.doors[0] || x === W.doors[1] ? 3 : 2], 2];   // the gilt frame
        if (o.doorsOpen) {
          if (x <= W.doors[0] + 6 || x >= W.doors[1] - 6) return [(x + y) % 3 ? "#2a1d28" : "#3e2731", 2];       // the leaves, swung in
          const d = Math.hypot((x - cx) * 0.9, (W.floorY - 1 - y) * 0.7) / 40 + (hash(x, y, 151) - 0.5) * 0.12;
          return [d < 0.34 ? "#ffffff" : d < 0.66 ? "#fee761" : d < 0.98 ? "#feae34" : "#f77622", 0];
        }
        if (x === cx - 1) return ["#ffffff", 0]; if (x === cx) return ["#fee761", 0];
        if (y >= W.floorY - 2) return ["#fee761", 0];
        if ((y - top) % 12 === 6) return [R.gold[1], 2];
        if ((y - top) % 12 === 7 && (x - W.doors[0]) % 8 === 4) return [R.gold[3], 2];
        return [x < cx ? "#2a1d28" : "#221a26", 2];
      }
      for (const bx of [1402, 1652]) if (x >= bx && x <= bx + 18 && y >= 452 && y <= 504) {   // troll banners: black hides on poles, a crude crown in yellow
        if (y === 452) return [R.oak[1], 2]; const u = x - bx, v = y - 462;
        if (v >= 6 && v <= 8 && u >= 3 && u <= 15) return ["#fee761", 0];
        if (v >= 0 && v < 6 && u >= 3 && u <= 15 && [3, 9, 15].some(q => Math.abs(u - q) <= v * 0.3)) return ["#fee761", 0];
        if (y > 500 && (x + y) % 3 === 0) break; return [y > 502 ? NIGHT : "#1e1a24", 2];
      }
      const c = coursed(x, y, 8, 22), base = ["#2c2838", "#262233", "#3a3648"][c];
      if (veinAt(x, y, 0.8)) return [hash(x, y, 152) < 0.3 ? R.gold[2] : R.gold[1], 0];
      return [hash(x, y, 153) < 0.05 ? "#24202e" : base, 2];
    }
    if (y < W.lipY) {
      if (x >= W.runner[0] && x <= W.runner[1]) {
        if (x === W.runner[0] || x === W.runner[1]) return [R.gold[2], 1]; if (x === W.runner[0] + 1 || x === W.runner[1] - 1) return [R.gold[1], 1];
        const burnt = vnoise(x, y, 12, 104) > 0.8; return [burnt ? (KS_dith(x, y) ? "#3e2731" : "#5a1622") : ((x + y) % 11 === 0 ? "#a22633" : "#7a1a28"), 1];
      }
      const k = clamp((1230 - y) / 620, 0, 1), sq = ((x >> 4) + (y >> 4)) & 1, joint = x % 16 === 0 || y % 16 === 0;
      if (veinAt(x * 1.3, y * 1.3, k * 0.75)) return [k > 0.8 && hash(x, y, 154) < 0.35 ? R.gold[1] : "#733e39", 1];
      return [joint ? "#15121c" : sq ? "#221e2c" : "#2a2536", 1];
    }
    if (y < W.lipY + 8) { if (x >= W.doors[0] && x <= W.doors[1]) return [R.gold[y === W.lipY ? 3 : 1], 2]; return [y === W.lipY ? "#3a3648" : "#262233", 2]; }
    return [NIGHT, 0];
  }
  // the throne room: the north wall with the cloth of state behind the throne (crimson with a gold fringe, the troll crown daubed on the
  // castle's wolf), two side doors, sconces, banners; the floor a checker of black and gold-veined marble, the crimson carpet from the
  // south doors to the dais, the sun inlaid at the room's heart (where he turns the Sunwheel)
  function throneBase(x, y, o) {
    const cx = 1536, ruined = !!o.ruined, wk = wakeAt(o, x, y);
    if (ruined && y < 96) {
      // the Wrath took the roof and the top of the wall: a broken edge, the night sky with its stars above it
      const edge = 26 + Math.round(vnoise(x, 0, 18, 105) * 34 + hash(x, 0, 106) * 6) - (Math.abs(x - cx) < 60 ? 0 : 0);
      if (y < edge) { const st = hash(x, y, 107); return [st < 0.006 ? "#ffffff" : st < 0.014 ? "#c0cbdc" : y < 20 ? "#0b0a14" : "#121024", 0]; }
      if (y < edge + 2) return ["#3a3648", 2];
    }
    if (y < 8) return [y === 7 ? "#3e2731" : x % 32 === 0 ? R.gold[2] : "#2a1d28", 2];
    if (y < 96) {
      // the cloth of state over the throne
      if (x >= cx - 40 && x <= cx + 40 && y >= 10 && y <= 92) {
        if (y <= 13) return [R.gold[y === 10 ? 3 : 2], 2];
        if (ruined && hash(x >> 2, y >> 2, 108) < 0.35 && y > 40) return ["#1e1a24", 2];
        if (x === cx - 40 || x === cx + 40) return [R.gold[2], 2];
        if (y >= 88) return [((x >> 1) & 1) ? R.gold[2] : R.gold[1], 2];
        const u = x - cx, v = y - 40;
        if (Math.abs(u) <= 14 && v >= -2 && v <= 12) { // the castle's white wolf under a yellow crown daubed across it (burnt away where the castle has woken)
          if (!wk && v >= -2 && v <= 1 && Math.abs(u) <= 12 && (v === 1 || [-12, -6, 0, 6, 12].some(p => Math.abs(u - p) <= (v + 2) * 0.8))) return ["#fee761", 0];
          if (v >= 3 && v <= 12 && ell(0, 8, 11, 4.5)(u, v)) return [(u + v) % 5 === 0 ? "#8b9bb4" : "#c0cbdc", 2];
        }
        return [(x * 2 + y) % 13 === 0 ? "#68182c" : "#7a1a28", 2];
      }
      // side doors near the corners (x 1180 to 1212 and 1860 to 1892): where his court comes in
      for (const dx of [1180, 1860]) if (x >= dx && x <= dx + 32 && y >= 40) { const top = 40 + Math.round(16 - Math.sqrt(Math.max(0, 256 - (x - dx - 16) ** 2))); if (y < top) break; if (x === dx || x === dx + 32 || y === top) return [R.stone[1], 2]; return [(y - top) % 9 === 0 ? "#2a1d28" : "#1e1626", 2]; }
      for (const bx of [1290, 1380, 1684, 1774]) if (!ruined && x >= bx && x <= bx + 18 && y >= 14 && y <= 58) { if (y === 14) return [R.oak[1], 2]; const u = x - bx, v = y - 24; if (v >= 6 && v <= 8 && u >= 3 && u <= 15) return ["#fee761", 0]; if (v >= 0 && v < 6 && u >= 3 && u <= 15 && [3, 9, 15].some(p => Math.abs(u - p) <= v * 0.3)) return ["#fee761", 0]; return [y > 54 ? "#120e1a" : "#1e1a24", 2]; }
      const c = coursed(x, y, 8, 24), base = ["#2c2838", "#262233", "#3a3648"][c];
      if (veinAt(x, y, 0.9)) return wk === 1 ? [hash(x, y, 121) < 0.3 ? "#4a4450" : "#3a3648", 2] : wk === 2 ? ["#ffffff", 0] : [hash(x, y, 121) < 0.3 ? R.gold[2] : R.gold[1], 0];
      return [hash(x, y, 109) < 0.05 ? "#24202e" : base, 2];
    }
    if (y < 424) {
      // the sun inlaid at the heart of the room (1536, 260): a gold disc and its rays
      const sx = x - cx, sy = (y - 260) / 0.62, sd = Math.hypot(sx, sy);
      if (sd < 30) { if (sd < 12) return [sd < 10 ? R.gold[2] : R.gold[1], 1]; const a = Math.atan2(sy, sx), ray = Math.abs(((a / TAU * 16) % 1 + 1) % 1 - 0.5); if (ray > 0.32 && sd < 28) return [R.gold[2], 1]; }
      // the carpet from the south doors to the dais
      if (x >= cx - 16 && x <= cx + 16 && y >= 150) {
        if (Math.abs(x - cx) >= 15) return [R.gold[2], 1]; if (Math.abs(x - cx) === 14) return [R.gold[1], 1];
        if (ruined && vnoise(x, y, 10, 110) > 0.62) return ["#2a1d28", 1];
        return [(x + y) % 11 === 0 ? "#a22633" : "#7a1a28", 1];
      }
      const sq = ((x >> 4) + (y >> 4)) & 1, joint = x % 16 === 0 || y % 16 === 0;
      if (ruined) { const sc = vnoise(x, y, 26, 111); if (sc > 0.66) return [joint ? "#0f0c14" : "#16121c", 1]; if (hash(x, y, 112) < 0.02) return [R.stone[0], 1]; }
      if (veinAt(x * 1.2, y * 1.2, 0.55)) return wk === 1 ? ["#2c2738", 1] : wk === 2 ? ["#fee761", 0] : ["#733e39", 1];
      return [joint ? "#15121c" : sq ? "#221e2c" : "#2c2738", 1];
    }
    if (y < 432) { if (x >= cx - 30 && x <= cx + 30) return [R.gold[y === 424 ? 3 : 1], 2]; return [y === 424 ? "#3a3648" : "#262233", 2]; }
    return [NIGHT, 0];
  }
  // (alt { L, r }: one light at another radius, for the flicker rings)
  function pixel(x, y, o, alt) {
    o = o || {};
    if (x >= 1152 && x < 1920 && y >= 0 && y < 432) {
      if (x < 1164 || x >= 1908) return x === 1163 || x === 1908 ? "#3a3648" : "#1e1a24";
      const [c, m] = throneBase(x, y, o), out = m ? lit(c, x, y, altL(lightsFor("throne", o), alt), m === 2) : c;
      return wakeAt(o, x, y) === 2 && out !== NIGHT && dith(x, y, 0.7) ? mix(out, [254, 231, 97], 0.45) : out;   // the waking's front, a band of light
    }
    if (x >= WALK.x0 && x < WALK.x1 && y >= WALK.y0 && y < WALK.y1) { const [c, m] = walkBase(x, y, o); return m ? lit(c, x, y, altL(lightsFor("walk", o), alt), m === 2) : c; }
    return NIGHT;
  }
  function ground(x0, y0, w, h, o) { const px = new Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px[y * w + x] = pixel(x0 + x, y0 + y, o); return { px, w, h }; }

  // ================================================================== the art module (Gate.Scene's hooks), proto/keep.js's shape
  const PC = new Map(), once = (key, make) => { if (!PC.has(key)) PC.set(key, make()); return PC.get(key); };
  const wrap = (key, make) => once(key, () => { const p = make(); return G.sprite(p.px, p.w, p.h, p.ox || 0, p.oy || 0); });
  const IMG = (key, x0, y0, x1, y1, paint, clip) => G.telegraph.image(key, x0, y0, x1, y1, paint, clip);
  const RUINED = { ruined: true };
  // the sprites, each once: the sketch's pieces on their feet (a column's heat in three looks)
  const P = {};
  P.column = (state, heat) => { const h = state === "cracked" ? (heat > 0.66 ? 1 : heat > 0.33 ? 0.5 : 0) : 0; return wrap("column|" + state + "|" + h, () => column(state === "broken" ? "broken" : state === "cracked" ? "cracked" : "whole", h)); };
  P.throne = () => wrap("throne", () => throne());
  P.statue = broken => wrap("statue" + (broken ? 1 : 0), () => statue(!!broken));
  P.brazier = f => wrap("brazier" + ((f | 0) & 3), () => brazier((f | 0) & 3));
  P.hoard = k => wrap("hoard" + ((k | 0) % 3), () => hoard((k | 0) % 3));
  P.standard = () => wrap("standard", () => standard());
  P.dust = k => wrap("dust" + ((k | 0) % 3), () => dust((k | 0) % 3));
  P.brokenSceptre = () => wrap("brokenSceptre", () => brokenSceptre());
  P.crownPiece = f => wrap("crownPiece" + ((f | 0) % 3), () => crownPiece((f | 0) % 3));
  P.emberOrb = f => wrap("emberOrb" + ((f | 0) & 3), () => emberOrb((f | 0) & 3));
  P.legendFind = f => wrap("legendFind" + ((f | 0) & 7), () => legendFind((f | 0) & 7));
  P.emberIcon = f => wrap("emberIcon" + ((f | 0) & 3), () => emberIcon((f | 0) & 3));
  // the dais (the spec's landing, look marble): 128 x 68 of the room's black marble edged in gold, lifted by its z, its front face and its
  // two steps below (the stair surface draws nothing of its own); one sprite, the bodies on it drawn after it by their feet
  P.dais = () => once("dais", () => {
    const W = 130, TOP = 68, FACE = 8, H = TOP + FACE + 12 + 2, sp = new Grid(W, H);
    region(sp, rect(1, 1, W - 2, TOP), BLACKMARBLE, { tex: (x, y) => { if (y === 1 || x === 1 || x === W - 2) return R.gold[2]; if (y === 2) return R.gold[1]; if (Math.abs(vnoise(x * 2, y, 6, 171) - 0.5) < 0.03) return R.gold[1]; return ((x >> 4) + (y >> 4)) & 1 ? BLACKMARBLE[2] : BLACKMARBLE[1]; } });
    region(sp, rect(1, TOP + 1, W - 2, TOP + FACE), BLACKMARBLE, { flat: 0, tex: (x, y) => y === TOP + 1 ? R.gold[1] : (x % 16 === 0 ? "#120e1a" : null) });
    for (let s = 0; s < 2; s++) { const y0 = TOP + FACE + 1 + s * 6; region(sp, rect(1, y0, W - 2, y0 + 2), BLACKMARBLE, { flat: 2, tex: (x, y) => y === y0 ? R.gold[2] : null }); region(sp, rect(1, y0 + 3, W - 2, y0 + 5), BLACKMARBLE, { flat: 0 }); }
    outline(sp);
    return G.sprite(sp.px, sp.W, sp.H, 1, TOP);
  });

  const PREP = new WeakMap();
  function prep(A) {
    let P0 = PREP.get(A); if (P0) return P0;
    const braz = new Set((A.props || []).filter(p => p.kind === "brazier").map(p => p.x + "," + p.y));
    P0 = { A, W: A.w || 1920, H: A.h || 1296, lights: LIGHTS.map((L, i) => Object.assign({ i, fy: L.wall ? 0.8 : 0.62 }, L)) };
    P0.fires = P0.lights.filter(L => L.k === "fire");   // the fires flicker; his gold and the moon are still
    P0.torches = P0.fires.filter(L => !braz.has(L.x + "," + L.y));   // a fire with no brazier of the spec is a torch on the wall
    PREP.set(A, P0);
    return P0;
  }
  function stateOf(S) { return S.throne || (S.throne = { doorsOpen: null, doorsOpenTime: 0.8, doorsShut: null, ruin: null, ruinTiles: null, baseTiles: null, swapped: false, rings: new Map(), ringOrder: [], doorLight: null, woken: null, wokenDiff: null, pop: null, sceptre: null, blasts: [], breaks: [], kingGone: null, pulseAt: null }); }
  const stateKey = st => (st.swapped ? "r" : "") + (st.doorsOpen !== null ? "d" : "");
  const roomState = st => ({ ruined: st.swapped, doorsOpen: st.doorsOpen !== null });
  // what the art reads of the fight each frame (the events say the same, sooner): the seam's doors open and shut, the room ruined (a reload
  // after the Wrath; a retry before it undoes the ruin on its event)
  function sync(S, F) {
    const st = stateOf(S), A = S.A; if (!F) return st;
    const D = F.director, t = F.t || 0;
    if (D && D.seams) for (const PS of A.passages || []) { const sm = PS.seam && D.seams[PS.id]; if (!sm) continue; if (sm.open && st.doorsOpen === null) st.doorsOpen = t - ((PS.doors || {}).open || 0.8); if (sm.shut && st.doorsShut === null) st.doorsShut = t; }
    if (F.level && F.level.ruined && st.ruin === null) st.ruin = t - 1;
    return st;
  }
  function take(e, F, S) {
    const st = stateOf(S), t = F ? F.t || 0 : 0;
    if (e.type === "doorsOpen") { if (st.doorsOpen === null) st.doorsOpen = t; if (e.time) st.doorsOpenTime = e.time; return true; }
    if (e.type === "doorsShut") { if (st.doorsShut === null) st.doorsShut = t; return true; }
    if (e.type === "ruin") { if (st.ruin === null) st.ruin = t; if (!st.swapped) swapRuin(S, st); return true; }   // (swapped now: the next frame draws the ruin under the page's flash)
    if (e.type === "wrath") { st.blasts.push({ x: e.x, y: e.y, z: e.z || 0, r: e.r || 210, t0: t, T: 0.3 }); while (st.blasts.length > 4) st.blasts.shift(); return true; }
    if (e.type === "wrathPulse") { st.pulseAt = t; return true; }
    if (e.type === "propBreak") { st.breaks.push({ x: e.x, y: e.y, z: e.z || 0, t0: t, id: e.solid | 0 }); while (st.breaks.length > 8) st.breaks.shift(); return true; }
    if (e.type === "kingPop") { const L = S.last.get(e.foe), T = root.Trolls, fr = L && T && T.frame ? T.frame("king", L.facing, L.anim, L.i, L.glow | 0) : null; st.pop = { x: e.x, y: e.y, z: e.z || 0, t0: t, fr, crown: e.crown || null, ring: e.ring || null }; st.sceptre = { x: e.x + 8, y: e.y + 6 }; return true; }
    if (e.type === "wake") { st.woken = { x: e.x, y: e.y, r: e.r }; return true; }
    if (e.type === "retryAt") { st.pop = null; st.sceptre = null; st.blasts = []; st.breaks = []; st.woken = null; st.kingGone = null;
      if (st.swapped && !(F && F.level && F.level.ruined)) { S.tiles = st.baseTiles; st.swapped = false; st.ruin = null; st.rings.clear(); st.ringOrder.length = 0; }   // a retry at a checkpoint before the Wrath: the room whole again
      return true; }
    return false;
  }
  // the King's death is the end's: he freezes and pops (drawn by the painter from the cine and the pop), never stone, never a crumble
  function dies(e, F, S) { if (e.kind !== "king") return false; stateOf(S).kingGone = F ? F.t || 0 : 0; return true; }

  // ------------------------------------------------------------------ the ground: the tiles, the ruin's tiles, the doors' light, the waking
  function paintRows(A, col, y0, y1, px, o) {
    const X0 = col * TW, oo = o || {};
    for (let y = y0; y < y1; y++) { const r = y * TW; for (let x = 0; x < TW; x++) px[r + x] = pixel(X0 + x, y, oo); }
    return px;
  }
  function paint(A, col, o) { const H = Math.max(432, A.h || 1296), px = new Array(TW * H).fill(null); paintRows(A, col, 0, H, px, o); return { px, W: TW, H, col }; }
  // the ruin: the Throne Room's rows painted ruined, every other row the base tile's (copied once baked, painted again if not)
  function ruinTiles(S, st) {
    if (st.ruinTiles) return st.ruinTiles;
    const base = S.tiles, A = S.A;
    const rows = (A0, col, y0, y1, px) => { const X0 = col * TW, bt = base.tiles[col], inRoom = X0 + TW > 1152 && X0 < 1920;
      for (let y = y0; y < y1; y++) { const r = y * TW; if (y < 432 && inRoom) { for (let x = 0; x < TW; x++) px[r + x] = pixel(X0 + x, y, RUINED); } else if (bt && bt.done) { for (let x = 0; x < TW; x++) px[r + x] = bt.px[r + x]; } else { for (let x = 0; x < TW; x++) px[r + x] = pixel(X0 + x, y, {}); } }
      return px; };
    st.baseTiles = base; st.ruinTiles = new G.Tiles(A, { paintRows: rows });
    return st.ruinTiles;
  }
  const NOW = () => root.performance && root.performance.now ? root.performance.now() : 0;
  function ruinWork(S, F, st) {
    const D = F && F.director, begun = st.ruin !== null || !!(D && D.arenas && D.arenas.some(a => a.started));
    if (!begun || st.swapped) return;
    const T0 = ruinTiles(S, st); if (!T0.allDone()) T0.work(1.5, root.performance && root.performance.now ? NOW : null);
  }
  function swapRuin(S, st) { const T0 = ruinTiles(S, st); while (T0.work(1e9, null)) { /* the rest at once, under the page's flash */ } S.tiles = T0; st.swapped = true; st.rings.clear(); st.ringOrder.length = 0; }
  // the great doors open: the gallery as the tile would be with doorsOpen (the leaves swung in, the opening full of his light, the floor
  // lit under it), only where it differs; baked in bands of 32 rows a frame, drawn once whole
  const DOORBOX = [1344, 440, 1727, 860];
  function doorLight(S, st) {
    const [x0, y0, x1, y1] = DOORBOX, W = x1 - x0 + 1, H = y1 - y0 + 1;
    let d = st.doorLight; if (!d) d = st.doorLight = { rows: 0, px: new Array(W * H).fill(null), s: null, n: 0 };
    if (d.s) return d.s;
    const o0 = {}, o1 = { doorsOpen: true }, y2 = Math.min(H, d.rows + 32);
    for (let j = d.rows; j < y2; j++) for (let i = 0; i < W; i++) { const x = x0 + i, y = y0 + j, a = pixel(x, y, o0), b = pixel(x, y, o1); if (a !== b) { d.px[j * W + i] = b; d.n++; } }
    d.rows = y2;
    if (d.rows >= H) d.s = G.sprite(d.px, W, H, 0, 0, { x0, y0, doorLight: true, n: d.n });
    return d.s;
  }
  // the waking (the end's cutscene): the Throne Room with every vein dead and the daubed crown burnt, where it differs from the room as it
  // is; baked in bands of 12 rows a frame through the take, drawn clipped to the front's ellipse
  const WAKEBOX = [1152, 0, 1919, 431];
  function wokenDiff(S, st) {
    const [x0, y0, x1, y1] = WAKEBOX, W = x1 - x0 + 1, H = y1 - y0 + 1;
    let d = st.wokenDiff; if (!d) d = st.wokenDiff = { rows: 0, px: new Array(W * H).fill(null), s: null, ruined: st.swapped };
    if (d.s) return d.s;
    const o0 = { ruined: d.ruined }, o1 = { ruined: d.ruined, woken: { x: 1536, y: 260, r: 1e6 } }, y2 = Math.min(H, d.rows + 12);
    for (let j = d.rows; j < y2; j++) for (let i = 0; i < W; i++) { const x = x0 + i, y = y0 + j, a = pixel(x, y, o0), b = pixel(x, y, o1); if (a !== b) d.px[j * W + i] = b; }
    d.rows = y2;
    if (d.rows >= H) d.s = G.sprite(d.px, W, H, 0, 0, { x0, y0, woken: true });
    return d.s;
  }
  // the front of the waking: a band of light 6 px deep on the ellipse at r (0.8 as tall as wide), in view, a new image a frame
  function frontSprite(Wk, S) {
    const v = S.view, VW = S.vw || TW, VH = S.vh || 216, rx = Wk.r, ry = Wk.r * 0.8; if (rx < 8) return null;
    const x0 = Math.max(v.x0 - 4, Wk.x - rx - 4), x1 = Math.min(v.x0 + VW + 4, Wk.x + rx + 4), y0 = Math.max(v.y0 - 4, Wk.y - ry - 4), y1 = Math.min(v.y0 + VH + 4, Wk.y + ry + 4); if (x1 <= x0 || y1 <= y0) return null;
    return IMG(null, x0, y0, x1, y1, put => { const n = Math.ceil(TAU * rx); for (let i = 0; i < n; i++) { const a = i / n * TAU, ca = Math.cos(a), sa = Math.sin(a); for (let d = 0; d < 6; d++) { const x = Math.round(Wk.x + ca * (rx - d)), y = Math.round(Wk.y + sa * (ry - d * 0.8)); if (dith(x, y, 0.75 - d * 0.1)) put(x, y, d < 2 ? "#ffffff" : d < 4 ? "#fee761" : "#feae34"); } } }, [1164, 8, 1908, 431]);
  }

  // ------------------------------------------------------------------ the flicker rings (the Keep's way): per fire in view, at most 8, its pool
  // re-lit at its radius +3, +1 or -2 on its own phase; a ring is the pixels whose light changes, baked once per room state (48 kept)
  const DELTA = [0, 3, 1, -2];
  function ringSprite(S, P0, L, f, o) {
    const st = stateOf(S), key = L.i + "|" + f + "|" + stateKey(st);
    let s = st.rings.get(key); if (s) return s;
    const R1 = L.r + Math.max(0, DELTA[f]) + 1, hx = Math.ceil(R1), hy = Math.ceil(R1 / L.fy), x0 = Math.floor(L.x) - hx, y0 = Math.floor(L.y) - hy, W = 2 * hx + 1, H = 2 * hy + 1, px = new Array(W * H).fill(null);
    const alt = { L: LIGHTS[L.i], r: L.r + DELTA[f] }, oo = o || roomState(st);
    let any = 0;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const x = x0 + i, y = y0 + j; if (x < 0 || y < 0 || x >= P0.W || y >= P0.H) continue;
      const was = pixel(x, y, oo), now = pixel(x, y, oo, alt);
      if (was !== now) { px[j * W + i] = now; any++; }
    }
    s = G.sprite(px, W, H, 0, 0, { ring: true, light: L.i, phase: f, x0, y0, n: any });
    st.rings.set(key, s); st.ringOrder.push(key);
    while (st.ringOrder.length > 48) st.rings.delete(st.ringOrder.shift());
    return s;
  }
  // before the ground is drawn: the fight's state read, the ruin's tiles baked a slice and swapped in when the room is ruined
  function ground(S, F) { const st = sync(S, F); ruinWork(S, F, st); if (!st.swapped && st.ruin !== null) swapRuin(S, st); }
  function lights(ctx, F, t, still, S) {
    const st = sync(S, F), P0 = prep(S.A), v = S.view, VW = S.vw || TW, VH = S.vh || 216, ft = F ? F.t || 0 : 0, o = roomState(st);
    let n = 0;
    // the great doors open: the gallery re-lit by his light (faded in over the doors' open time; at once under less motion)
    if (st.doorsOpen !== null && v.y0 + VH > DOORBOX[1] && v.y0 < DOORBOX[3]) { const d = doorLight(S, st); if (d) { const q = still ? 1 : clamp((ft - st.doorsOpen) / (st.doorsOpenTime || 0.8), 0, 1); if (q > 0) { if (q < 1) ctx.globalAlpha = q; blit(ctx, d, d.x0, d.y0); if (q < 1) ctx.globalAlpha = 1; n++; } } }
    // the flicker rings
    if (!still) {
      const cx = v.x0 + VW / 2, cy = v.y0 + VH / 2, tick = Math.floor(t * 8);
      const fires = P0.fires.filter(L => L.x + L.r >= v.x0 && L.x - L.r <= v.x0 + VW && L.y + L.r / L.fy >= v.y0 && L.y - L.r / L.fy <= v.y0 + VH);
      fires.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
      let made = 0;
      for (const L of fires.slice(0, 8)) { const f = (tick + L.i * 3) & 3; if (!f) continue; if (!st.rings.has(L.i + "|" + f + "|" + stateKey(st))) { if (made >= 1) continue; made++; } const s = ringSprite(S, P0, L, f, o); if (s.n) { blit(ctx, s, s.x0, s.y0); n++; } }
    }
    // the waking: the veins dead inside the front (the difference clipped to the front's ellipse), the front a band of light
    if (F && F.cine && F.cine.kind === "ember" && !(st.wokenDiff && st.wokenDiff.s)) wokenDiff(S, st);
    if (st.woken && st.woken.r > 0 && v.y0 < 432) {
      const Wk = st.woken, d = wokenDiff(S, st);
      if (d && ctx.ellipse) { ctx.save(); ctx.beginPath(); ctx.ellipse(Wk.x, Wk.y, Math.max(1, Wk.r - 6), Math.max(1, Wk.r * 0.8 - 6), 0, 0, TAU); ctx.clip(); blit(ctx, d, d.x0, d.y0); ctx.restore(); n++; }
      const fr = frontSprite(Wk, S); if (fr) { blit(ctx, fr, fr.x0, fr.y0); n++; }
    }
    return n;
  }
  // the back walls' live things: the torches' flames (the Great Hall's) on the wall lights that are no brazier
  function wall(ctx, F, t, still, S) {
    const P0 = prep(S.A), H0 = HALL(), v = S.view, vx0 = v.x0 - 16, vx1 = v.x0 + (S.vw || TW) + 16, vy0 = v.y0 - 24, vy1 = v.y0 + (S.vh || 216) + 24, tick = still ? 0 : Math.floor(t * 8);
    if (!H0 || !H0.sprites || !H0.sprites.flame) return 0;
    let n = 0;
    for (const L of P0.torches) { if (L.x < vx0 || L.x > vx1 || L.y < vy0 || L.y > vy1) continue; drawAt(ctx, H0.sprites.flame((tick + L.x) & 3), L.x, L.y - (L.wall ? 0 : 6)); n++; }
    return n;
  }

  // ------------------------------------------------------------------ the pieces, each an actor on its foot
  function pieces(A, S, act) {
    const sol = (F, x, y) => S.solidAt(F, x, y);
    let hoards = 0;
    for (const p of A.props || []) {
      const k = p.kind, z = p.base || 0;
      if (k === "wall" || k === "greatDoors" || k === "southDoors") continue;   // in the tile (the open doors are the lights hook's)
      if (k === "column" || k === "galleryColumn") act(p.x - 12, p.y - 76, p.x + 12, p.y + 4, p.y, (ctx, F) => { const b = sol(F, p.x, p.y), st = b && b.broken ? "broken" : b && b.cracks > 0 ? "cracked" : "whole"; drawAt(ctx, P.column(st, b ? b.heat || 0 : 0), p.x, p.y); });
      else if (k === "statue" || k === "lordStatue") act(p.x - 11, p.y - 50, p.x + 11, p.y + 4, p.y, (ctx, F) => { const b = sol(F, p.x, p.y); drawAt(ctx, P.statue(!!(b && b.broken)), p.x, p.y); });
      else if (k === "throne") act(p.x - 46, p.y - z - 106, p.x + 46, p.y + 6, p.y, ctx => drawAt(ctx, P.throne(), p.x, p.y - z), z);
      else if (k === "brazier") act(p.x - 8, p.y - z - 26, p.x + 8, p.y + 3, p.y, (ctx, F, o) => { const b = sol(F, p.x, p.y); if (b && b.broken) return; drawAt(ctx, P.brazier(o.still ? 0 : Math.floor(o.t * 8 + p.x) & 3), p.x, p.y - z); }, z);
      else if (k === "hoard" || k === "tribute") { const kk = hoards++ % 3; act(p.x - 14, p.y - 14, p.x + 14, p.y + 3, p.y, ctx => drawAt(ctx, P.hoard(kk), p.x, p.y)); }
      else if (k === "standard") act(p.x - 9, p.y - 50, p.x + 9, p.y + 3, p.y, ctx => drawAt(ctx, P.standard(), p.x, p.y));
    }
    // the dais with its steps (one sprite, the bodies on it drawn by their feet, lifted by its height)
    for (const su of A.surfaces || []) {
      if (!su.rect || su.kind !== "landing") continue;
      const [x0, y0, x1, y1] = su.rect, z = su.z || 0;
      act(x0 - 2, y0 - z - 4, x1 + 2, y1 + 14, y0, (ctx, F, o) => { blit(ctx, P.dais(), x0 - 1, y0 - z - 1); S.drawLifted(ctx, su.id, o); });
    }
  }
  // the moving things sorted with the bodies: the Legend Ember (hung over where he stood, dropping, resting with its beacon), the broken
  // sceptre where it fell, his crown spinning up out of the burst and landing aside (then it is the find the director drops)
  function actors(F, o, S, push) {
    const st = stateOf(S), EB = F.level && F.level.legendEmber, still = o.still, t = o.t, ft = F.t || 0;
    let n = 0;
    if (EB && EB.state !== "taken") {
      if (EB.state === "rest") { const f = still ? 0 : Math.floor(t * 8) & 7; push(EB.y, 0, ctx => drawAt(ctx, P.legendFind(f), EB.x, EB.y)); n++; }
      else { const f = still ? 0 : Math.floor(t * 8) & 3, z = EB.z || 0; push(EB.y, z, ctx => drawAt(ctx, P.emberOrb(f), EB.x, EB.y - z)); n++; }
    }
    if (st.sceptre) { const sc = st.sceptre; push(sc.y, 0, ctx => drawAt(ctx, P.brokenSceptre(), sc.x, sc.y)); n++; }
    const PP = st.pop;
    if (PP && PP.crown) { const CR = PP.crown, age = ft - PP.t0, L = CR.land || 0.6; if (age >= 0 && age < L) { const q = age / L, up = (CR.up || 26) * Math.sin(Math.PI * q), x = PP.x + (CR.aside || 30) * q, y = PP.y + 2, fi = Math.floor(q * 3) % 3; push(y, up + PP.z, ctx => drawAt(ctx, P.crownPiece(fi), x, y - PP.z - up)); n++; } }
    return n;
  }
  // after the actors: the live beams, the rings of light, the burst, the chips of a breaking prop, the take's light
  function over(ctx, F, o, S) {
    const st = stateOf(S), ft = F.t || 0, v = S.view, VW = S.vw || TW, VH = S.vh || 216, still = o.still, t = o.t;
    const inV = (x, y, r) => x + r >= v.x0 && x - r <= v.x0 + VW && y + r >= v.y0 && y - r <= v.y0 + VH;
    let n = 0;
    // the live beams: each along its angle to where it stopped (the rules' lens), at the beam's height, flickering (one frame under less motion)
    for (const f of F.foes || []) {
      const A = f.act, tel = A && A.tel; if (!tel || tel.kind !== "beamLive" || !tel.from || !tel.angles) continue;
      const zz = ((A.atk && A.atk.z) || 16) + (f.z || 0), lens = tel.lens || [], ends = tel.angles.map((a, i) => { const L = lens[i] !== undefined ? lens[i] : 320; return [tel.from[0] + Math.cos(a) * L, tel.from[1] + Math.sin(a) * L]; });
      let x0 = tel.from[0], y0 = tel.from[1] - zz, x1 = x0, y1 = y0; for (const e of ends) { x0 = Math.min(x0, e[0]); x1 = Math.max(x1, e[0]); y0 = Math.min(y0, e[1] - zz); y1 = Math.max(y1, e[1] - zz); }
      if (!inV((x0 + x1) / 2, (y0 + y1) / 2, Math.max(x1 - x0, y1 - y0) / 2 + 20)) continue;
      const fr = still ? 0 : Math.floor(t * 20), s = IMG(null, x0 - 12, y0 - 12, x1 + 12, y1 + 12, put => { for (const e of ends) beam(put, tel.from[0], tel.from[1] - zz, e[0], e[1] - zz, tel.w || 10, fr); });
      blit(ctx, s, s.x0, s.y0); n++;
    }
    // the Wrath's blast and the pop: a ring of light rippling out over 0.3 s
    const ring = (x, y, z, r, q) => { const rr = Math.max(4, r * q), s = IMG(null, x - rr - 2, y - z - rr * 0.62 - 4, x + rr + 2, y - z + rr * 0.62 + 4, put => lightRing(put, x, y - z, rr, q)); blit(ctx, s, s.x0, s.y0); n++; };
    for (const b of st.blasts) { const q = (ft - b.t0) / b.T; if (q >= 0 && q < 1 && inV(b.x, b.y, b.r)) ring(b.x, b.y, b.z, b.r, q); }
    st.blasts = st.blasts.filter(b => ft - b.t0 < b.T);
    const PP = st.pop;
    if (PP) { const age = ft - PP.t0;
      if (PP.ring && age >= 0 && age < (PP.ring.time || 0.3) && inV(PP.x, PP.y, PP.ring.r || 80)) ring(PP.x, PP.y, PP.z, PP.ring.r || 80, age / (PP.ring.time || 0.3));
      // the burst of his own pixels (Trolls.kingBurst: every 3 x 3 block of his last frame flung from his heart), one image a frame
      if (PP.fr && root.Trolls && root.Trolls.kingBurst && age >= 0 && age < 1.0 && inV(PP.x, PP.y, 200)) { const sh = root.Trolls.kingBurst(PP.fr, age); if (sh.length) {
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const s of sh) { x0 = Math.min(x0, PP.x + s.x); x1 = Math.max(x1, PP.x + s.x + 3); y0 = Math.min(y0, PP.y - PP.z + s.y - s.z); y1 = Math.max(y1, PP.y - PP.z + s.y - s.z + 3); }
        const im = IMG(null, x0, y0, x1, y1, put => { for (const s of sh) for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { const c = s.px[j * 3 + i]; if (!c) continue; put(PP.x + s.x + i, PP.y - PP.z + s.y - s.z + j, c, s.fade > 0 ? 1 - s.fade : undefined); } });
        blit(ctx, im, im.x0, im.y0); n++; } } }
    // the chips of a breaking column or statue, flung for 0.5 s
    const H0 = HALL();
    for (const b of st.breaks) { const age = ft - b.t0; if (age < 0 || age > 0.5 || !H0 || !inV(b.x, b.y, 30)) continue; const q = age / 0.5; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + b.id, r = 8 + (i % 3) * 5; drawAt(ctx, H0.marks.chip(i), b.x + Math.cos(a) * r * q * 1.6, b.y - b.z - 12 + Math.sin(a) * r * q * 0.6 + q * q * 18); n++; } }
    st.breaks = st.breaks.filter(b => ft - b.t0 <= 0.5);
    // the take: the column of the Ember's light from the knight's raised hand up off the top of the view, then its rings across the floor
    const CN = F.cine;
    if (CN && CN.kind === "ember") {
      const k = F.knights[CN.seat] || F.k, EC = (F.area.end || {}).cine || {}, LT = EC.light || {}, lit = CN.step === "light" || CN.step === "wake" || (CN.step === "take" && CN.pose === "rise");
      if (lit && k) { const hx = Math.round(k.x) + 2, hy = Math.round(k.y - (k.z || 0)) - 34, top = v.y0 - 2; if (hy > top) { const s = IMG(null, hx - 7, top, hx + 7, hy, put => pillar(put, hx, hy, top, still ? 0 : Math.floor(t * 12))); blit(ctx, s, s.x0, s.y0); n++; } }
      if (CN.step === "light" && k) { const per = (LT.ringTime || 0.8) + (LT.gap || 0.5); for (let i = 0; i < (LT.rings || 3); i++) { const q = (CN.t - i * per) / (LT.ringTime || 0.8); if (q <= 0 || q >= 1) continue; const rr = Math.max(4, (LT.ringR || 300) * q), s = IMG(null, k.x - rr - 2, k.y - rr * 0.62 - 4, k.x + rr + 2, k.y + rr * 0.62 + 4, put => lightRing(put, k.x, k.y, rr, q), [1164, 96, 1908, 424]); blit(ctx, s, s.x0, s.y0); n++; } }
    }
    return n;
  }
  // the marks' looks: the halls' stone craters, broken slabs and grey chips (the Great Hall's, for both rooms)
  function markLook(kind, r, v, x, y, A) { const H0 = HALL(); if (!H0) return null; const MK = H0.marks, rr = Math.max(2, Math.round(r || 4)), vv = (v | 0) % 3; if (kind === "crater") return MK.stoneCrater(rr, vv); if (kind === "filled") return MK.slabs(rr, vv); if (kind === "dirt") return MK.chips(rr, vv); return null; }
  function chipLook(kind, i) { const H0 = HALL(); if (!H0) return null; if (kind === "clod") return H0.marks.clod(); if (kind === "dirt") return H0.marks.chip(i); return null; }
  const fx = { beam, redLine, redStrip, bigRing, arcArrow, fissure, wrathRays, pillar, lightRing, emberOrb: P.emberOrb, legendFind: P.legendFind, emberIcon: P.emberIcon };
  const art = { id: "Throne", tufts: false, paintRows, paint, ground, pieces, lights, wall, actors, over, dies, markLook, chipLook, take, fx, sync, stateOf };
  const DRAWS = { wall: "tile", column: "column", galleryColumn: "column (never breaks)", statue: "statue", lordStatue: "statue (never breaks)", throne: "throne", brazier: "brazier", hoard: "hoard", tribute: "hoard",
    standard: "standard", greatDoors: "tile (open: the doors' light)", southDoors: "tile (the threshold)", landing: "dais", stair: "dais (its steps)", crater: "mark" };
  root.Throne = { art, R, EMBER, GEM, OUT, prep, paint, paintRows, pixel, lightsFor, lit, LIGHTS, WALK, NIGHT, sprites: P, pieces: { column, throne, statue, brazier, hoard, emberOrb, standard, dust, brokenSceptre, crownPiece, legendFind, emberIcon }, fx, sync, take, stateOf, DRAWS, ringSprite, DELTA, ruinTiles, doorLight, wokenDiff, frontSprite, DOORBOX, WAKEBOX, region, poly, crown };
  if (typeof module !== "undefined" && module.exports) module.exports = root.Throne;
})(typeof window !== "undefined" ? window : globalThis);
