// FORGE FOREVER: the folk of the Courtyard (design pass 24 sections 4.7, 4.8 and 4.15; built by build 17, card t79). Nell the Trader,
// her mule Biscuit, Vorn the old quartermaster, two hens and the cat asleep on the Forge's beam: their sprites, drawn in code the
// knight's and Grycus's way (docs/design/24-courtyard.sketch.js's own drawing, moved here untouched), and when Nell and Vorn speak
// and what. Their words are data (spec/folk.json, window.FORGE_FOLK in the page; spec/folk.js is the browser twin).
//
//   Folk.frame(who, pose, i)    → { layer, ox, oy }: the sprite of nell, vorn, biscuit, hen or cat at a pose and frame, as one of the
//                                 courtyard's layers (px, w, h), its anchor at its feet. Nell: idle, talk, wave, count. Vorn: idle,
//                                 talk, point, nod. Biscuit: idle, eat
//   Folk.face(who)              → { px, w: 16, h: 16 }: the face for a plank's head (a crop of the idle frame, as Grycus's on his plank)
//   Folk.memory(saved)          what each has said, as the save keeps it beside Grycus's: { nell: { met, at, n }, vorn: { met, at, n } }
//   Folk.opening(mem, who, o)   → { pool, mem }: which pool a plank opens on. The first meeting (meet); for Vorn, his whole rack sold
//                                 (all: o.all) or picks waiting on the house (free: o.free); a greeting after ten minutes away
//                                 (greet); else open and tap in turn. o.now is the time (ms)
//   Folk.say(mem, who, pool, o) → { text, mem }: the next line of a pool, in order, round and round ({n} filled from o.n); null for an
//                                 empty pool
//   Folk.title(who), Folk.arms(cls)   the plank's title, and a weapon class's line on Vorn's plank
//
// Pure: no DOM, no clock of its own, no Math.random. Needs proto/courtyard.js (its painter's layer and shapes). Plain script, defines
// window.Folk (module.exports in node).
(function (root) {
  "use strict";
  if (!root.Courtyard && typeof module !== "undefined" && module.exports && typeof require === "function") require("./courtyard.js");
  const C = root.Courtyard;
  if (!C || !C.Layer) throw new Error("folk.js needs proto/courtyard.js");
  const Layer = C.Layer, R = C.R, OUT = C.OUT, rect = C.shapes.rect, ell = C.shapes.ell, poly = C.shapes.poly, or = C.shapes.or;

  // ------------------------------------------------------------------ the folk (32 x 32 like the knight and Grycus, feet on row 31)
  // Nell, the Trader: a stout woman past fifty in a plum headscarf and shawl, grey hair, a gold hoop, rosy cheeks, a terracotta dress
  // under a cream apron, a coin pouch at her hip. Poses: idle (the breath), talk (the jaw, a hand out), wave (a hand up), count (a coin)
  const mod4 = i => (((i | 0) % 4) + 4) % 4;   // a frame number, never negative
  const NELL_POSES = { idle: [{}, {}, { b: 1 }, { b: 1 }], talk: [{ m: 1, hand: 1 }, { hand: 1 }, { m: 1, hand: 1, b: 1 }, { hand: 1, b: 1 }], wave: [{ wave: 0 }, { wave: 1 }, { wave: 0 }, { wave: 1 }], count: [{ coin: 0 }, { coin: 1 }, { coin: 2 }, { coin: 1 }] };
  function nell(pose, i) {
    const f = (NELL_POSES[pose] || NELL_POSES.idle)[mod4(i)], b = f.b ? 1 : 0, g = new Layer(32, 32);
    // the skirt, the apron over it, the boots under the hem
    g.region(poly([[10, 19 + b], [22, 19 + b], [24, 30], [8, 30]]), R.rust);
    g.region(poly([[12, 20 + b], [20, 20 + b], [21, 29], [11, 29]]), R.cream, { tex: (x, y, c) => (x === 16 && y > 23 && y < 27) ? "#c28569" : null });
    g.region(rect(10, 30, 13, 30), R.leather); g.region(rect(18, 30, 21, 30), R.leather);
    // the body and the shawl over her shoulders, knotted at the front
    g.region(ell(16, 17 + b, 7, 5), R.rust);
    g.region(poly([[8, 14 + b], [24, 14 + b], [22, 20 + b], [16, 22 + b], [10, 20 + b]]), R.shawl, { tex: (x, y) => (x + y) % 4 === 0 ? "#3e2731" : null });
    g.region(ell(16, 21 + b, 1.6, 1.4), R.plum, { spec: () => true });
    // the pouch at her hip
    g.region(ell(22, 22 + b, 2.2, 2.6), R.leather); g.set(22, 21 + b, "#feae34");
    // the arms: hands clasped at the waist, or out (talk), or up (wave), or at the pouch flipping a coin (count)
    if (f.wave !== undefined) { const up = f.wave ? 6 : 8; g.region(rect(23, up + b, 25, 16 + b), R.plum); g.region(rect(23, up - 3 + b, 25, up - 1 + b), R.skin); g.region(rect(8, 16 + b, 10, 20 + b), R.plum); g.region(rect(10, 21 + b, 12, 22 + b), R.skin); }
    else if (f.hand) { g.region(rect(23, 16 + b, 26, 18 + b), R.plum); g.region(rect(27, 16 + b, 28, 18 + b), R.skin); g.region(rect(8, 16 + b, 10, 20 + b), R.plum); g.region(rect(10, 21 + b, 12, 22 + b), R.skin); }
    else if (f.coin !== undefined) { g.region(rect(22, 16 + b, 24, 20 + b), R.plum); g.region(rect(23, 21 + b, 24, 22 + b), R.skin); g.region(rect(8, 16 + b, 10, 20 + b), R.plum); g.region(rect(10, 21 + b, 12, 22 + b), R.skin); const cy = [19, 15, 13][f.coin] + b; g.set(25, cy, "#fee761"); g.set(26, cy, "#feae34"); g.set(25, cy + 1, "#feae34"); g.set(26, cy + 1, "#be4a2f"); }
    else { g.region(rect(9, 16 + b, 11, 20 + b), R.plum); g.region(rect(21, 16 + b, 23, 20 + b), R.plum); g.region(rect(13, 20 + b, 19, 21 + b), R.skin); }
    // the head: a round face, grey hair at the temples, the plum scarf over it tied under the chin's side, the gold hoop
    g.region(ell(16, 10.5 + b, 5.4, 4.8), R.skin);
    // the scarf: over the crown and down both sides of the face, its knot on top; grey hair at the temples under it
    g.region(or(ell(16, 5.6 + b, 6.6, 3.4), rect(9, 6 + b, 10, 12 + b), rect(22, 6 + b, 23, 11 + b)), R.plum, { tex: (x, y) => (y === 3 + b && x > 12 && x < 20) ? "#b55088" : null });
    g.region(ell(19, 2.4 + b, 1.8, 1.3), R.plum, { spec: () => true });
    for (const [x, c] of [[11, "#c0cbdc"], [12, "#8b9bb4"], [20, "#8b9bb4"], [21, "#c0cbdc"]]) g.set(x, 8 + b, c);
    g.set(14, 10 + b, OUT); g.set(18, 10 + b, OUT); g.set(14, 9 + b, "#5a6988"); g.set(18, 9 + b, "#5a6988");
    g.set(12, 12 + b, "#f6757a"); g.set(13, 12 + b, "#f6757a"); g.set(19, 12 + b, "#f6757a"); g.set(20, 12 + b, "#f6757a");
    g.set(16, 11 + b, "#b86f50");
    if (f.m) { g.set(15, 13 + b, "#a22633"); g.set(16, 13 + b, "#5a3030"); g.set(17, 13 + b, "#a22633"); g.set(16, 14 + b, "#a22633"); } else { g.set(14, 13 + b, "#a22633"); g.set(15, 14 + b, "#a22633"); g.set(16, 14 + b, "#a22633"); g.set(17, 14 + b, "#a22633"); g.set(18, 13 + b, "#a22633"); }
    g.outline();
    g.set(10, 12 + b, "#feae34"); g.set(9, 13 + b, "#feae34"); g.set(10, 14 + b, "#be4a2f");
    return g;
  }
  // Biscuit, Nell's mule: a bay with a pale muzzle, long ears, a dark mane and tail, a red halter, a collar for the shafts; facing west,
  // 40 x 30, hooves on the bottom row. Poses: idle (the tail swishes, an ear flicks), eat (the head down at the nosebag)
  function mule(pose, i) {
    i = mod4(i); const eat = pose === "eat", g = new Layer(40, 30), hd = eat ? 4 : 0, tail = [0, 1, 2, 1][i], ear = !eat && i === 2 ? 1 : 0;
    // legs, the far ones darker
    for (const [lx, far] of [[13, true], [29, true], [11, false], [27, false]]) g.region(rect(lx, 20, lx + 1, 28), far ? ["#2a1d28", "#3e2731", "#5a3030", "#733e39"] : R.coat);
    for (const lx of [11, 13, 27, 29]) { g.set(lx, 29, OUT); g.set(lx + 1, 29, OUT); }
    // the barrel of the body, the neck, the head with its long muzzle
    g.region(ell(21, 15, 11, 6.4), R.coat, { tex: (x, y) => y > 18 && x > 14 && x < 28 ? "#733e39" : null });
    g.region(poly([[12, 12], [16, 17], [10, 18 + hd], [6, 8 + hd]]), R.coat);
    g.region(poly([[2, 8 + hd], [9, 6 + hd], [11, 11 + hd], [4, 15 + hd], [1, 13 + hd]]), R.coat);
    g.region(ell(3, 12.5 + hd, 2.8, 2.4), R.burlap);
    g.set(2, 12 + hd, OUT);
    // the ears, long
    g.region(poly([[7, 7 + hd], [6, 0 + hd + ear], [9, 6 + hd]]), R.coat); g.region(poly([[9, 6 + hd], [10, 1 + hd], [11, 7 + hd]]), ["#3e2731", "#5a3030", "#733e39", "#b86f50"]);
    // the mane, the tail
    for (let k = 0; k < 7; k++) g.set(9 + k, 6 + Math.round(k * 0.9) + (hd ? Math.max(0, 3 - k) : 0), "#3e2731");
    for (let k = 0; k < 9; k++) { const tx = 32 + Math.round(k * 0.3) + (k > 4 ? tail : 0), ty = 12 + k; g.set(tx, ty, k > 5 ? "#2a1d28" : "#3e2731"); if (k > 5) g.set(tx + 1, ty, "#3e2731"); }
    // the halter and the collar
    for (let y = 8 + hd; y <= 13 + hd; y++) g.set(6, y, "#a22633"); g.set(5, 10 + hd, "#e43b44");
    for (let y = 9; y <= 17; y++) { g.set(14, y, "#3e2731"); g.set(15, y, "#5a3030"); }
    // the nosebag when eating
    if (eat) g.region(rect(0, 13 + hd, 5, 17 + hd), R.burlap);
    g.set(5, 9 + hd, OUT);
    g.outline();
    return g;
  }
  // Vorn, the weapons seller: a big old sergeant, bald with a grey fringe, a black patch over one eye on a strap, a broken nose, a grey
  // braided beard with a brass bead, a leather jerkin over mail sleeves, a faded blue scarf; behind his counter. Poses: idle (arms
  // crossed, the breath), talk (a hand out, the jaw), point (an arm to the rack), nod
  const VORN_POSES = { idle: [{}, {}, { b: 1 }, { b: 1 }], talk: [{ m: 1, hand: 1 }, { hand: 1 }, { m: 1, hand: 1 }, { hand: 1, b: 1 }], point: [{ point: 1 }, { point: 1 }, { point: 1, b: 1 }, { point: 1, b: 1 }], nod: [{}, { h: 1 }, { h: 1 }, {}] };
  function vorn(pose, i) {
    const f = (VORN_POSES[pose] || VORN_POSES.idle)[mod4(i)], b = f.b ? 1 : 0, h = f.h ? 1 : 0, g = new Layer(32, 32);
    // the legs and boots (mostly behind the counter)
    g.region(rect(11, 24, 14, 30), R.navy); g.region(rect(18, 24, 21, 30), R.navy); g.region(rect(10, 29, 14, 30), R.leather); g.region(rect(18, 29, 22, 30), R.leather);
    // the torso: mail under a leather jerkin, broad
    g.region(poly([[6, 13 + b], [26, 13 + b], [24, 25], [8, 25]]), R.iron, { tex: (x, y) => (x + y) % 2 === 0 ? "#3a4466" : null });
    g.region(poly([[9, 13 + b], [23, 13 + b], [22, 25], [10, 25]]), R.leather, { tex: (x, y) => (y === 19 + b) ? "#2a1d28" : null });
    g.region(rect(10, 22, 22, 23), ["#2a1d28", "#3e2731", "#733e39", "#b86f50"]); g.set(16, 22, "#feae34");
    // the arms: crossed over his chest, or a hand out, or pointing back over his shoulder
    if (f.point) { g.region(rect(4, 14 + b, 7, 18 + b), R.iron); g.region(poly([[4, 9 + b], [7, 9 + b], [7, 14 + b], [4, 14 + b]]), R.iron); g.region(rect(4, 6 + b, 6, 8 + b), R.skin); g.region(rect(23, 14 + b, 26, 21 + b), R.iron); g.region(rect(23, 21 + b, 25, 22 + b), R.skin); }
    else if (f.hand) { g.region(rect(5, 14 + b, 8, 21 + b), R.iron); g.region(rect(6, 21 + b, 8, 22 + b), R.skin); g.region(rect(24, 15 + b, 28, 18 + b), R.iron); g.region(rect(28, 15 + b, 29, 18 + b), R.skin); }
    else { g.region(rect(5, 14 + b, 8, 20 + b), R.iron); g.region(rect(24, 14 + b, 27, 20 + b), R.iron); g.region(rect(8, 17 + b, 24, 19 + b), R.skin, { tex: (x) => x === 16 ? "#b86f50" : x === 12 ? "#124e89" : null }); }
    // the scarf
    g.region(poly([[10, 12 + b], [22, 12 + b], [20, 15 + b], [12, 15 + b]]), R.teal);
    // the head, a little forward when he nods: bald, a grey fringe, the patch on his right eye (our left), the nose, the braided beard
    const hy = b + h;
    g.region(ell(16, 7 + hy, 5.4, 5.4), R.skin);
    g.set(11, 7 + hy, "#c0cbdc"); g.set(11, 8 + hy, "#8b9bb4"); g.set(21, 7 + hy, "#c0cbdc"); g.set(21, 8 + hy, "#8b9bb4");
    g.region(or(poly([[12, 12 + hy], [20, 12 + hy], [19, 17 + hy], [17, 20 + hy], [15, 20 + hy], [13, 17 + hy]])), R.hair, { tex: (x, y) => (y - hy) % 2 === 0 && x === 16 ? "#8b9bb4" : null });
    g.set(16, 21 + hy, "#feae34");
    g.set(13, 7 + hy, OUT); g.set(14, 7 + hy, OUT); g.set(13, 8 + hy, OUT); g.set(14, 8 + hy, OUT);
    for (let k = 0; k < 9; k++) g.set(11 + k, 4 + hy + Math.round(k * 0.35), OUT);
    g.set(18, 7 + hy, OUT);
    g.set(16, 9 + hy, "#ead4aa"); g.set(16, 10 + hy, "#b86f50"); g.set(17, 9 + hy, "#b86f50");
    if (f.m) { g.set(15, 13 + hy, "#3e2731"); g.set(16, 13 + hy, "#3e2731"); }
    g.outline();
    return g;
  }
  // a hen: cream feathers, a red comb, a yellow beak; stand and peck, facing right (flip for left)
  function hen(i) {
    const peck = mod4(i) === 2, g = new Layer(12, 10);
    g.region(ell(5, 6, 4, 3), R.white);
    g.region(peck ? ell(9, 7, 1.8, 1.6) : ell(8.5, 3, 1.8, 1.8), R.white);
    g.set(peck ? 9 : 8, peck ? 5 : 1, "#e43b44"); g.set(peck ? 10 : 9, peck ? 6 : 1, "#e43b44");
    g.set(peck ? 11 : 10, peck ? 8 : 3, "#feae34");
    g.set(1, 4, "#c0cbdc"); g.set(0, 3, "#8b9bb4");
    g.outline();
    g.set(4, 9, "#feae34"); g.set(6, 9, "#feae34"); g.set(peck ? 9 : 9, peck ? 7 : 3, OUT);
    return g;
  }
  // the cat asleep on the Forge's warm roof: ginger, curled, its tail round it; it breathes
  function cat(i) {
    const g = new Layer(14, 9), b = mod4(i) >= 2 ? 1 : 0;
    g.region(ell(7, 5.5 - b * 0.5, 5.5, 3 + b * 0.4), R.ginger, { tex: (x, y) => (x + y) % 3 === 0 ? "#be4a2f" : null });
    g.region(ell(3, 5, 2.6, 2.2), R.ginger);
    g.set(1, 3, "#be4a2f"); g.set(3, 2, "#be4a2f");
    for (let x = 4; x <= 11; x++) g.set(x, 8, x > 9 ? "#ead4aa" : "#be4a2f");
    g.outline();
    g.set(2, 5, OUT); g.set(4, 5, OUT);
    return g;
  }

  // the sprite of a folk at a pose and frame: { layer, ox, oy } with its anchor at its feet
  const FOLK = {
    nell: (p, i) => ({ layer: nell(p, i), ox: 16, oy: 31 }), vorn: (p, i) => ({ layer: vorn(p, i), ox: 16, oy: 31 }), biscuit: (p, i) => ({ layer: mule(p, i), ox: 20, oy: 29 }),
    hen: (p, i) => ({ layer: hen(i), ox: 6, oy: 9 }), cat: (p, i) => ({ layer: cat(i), ox: 7, oy: 8 })
  };
  function frame(who, pose, i) { const f = FOLK[who]; return f ? f(pose || "idle", i | 0) : null; }
  // the face for a plank's head: the idle frame's 16 x 16 from (8, 1), the head and shoulders (as Grycus's crop on his plank)
  function face(who) {
    const f = frame(who, "idle", 0); if (!f) return null;
    const L = f.layer, px = new Array(256).fill(null);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px[y * 16 + x] = L.get(8 + x, 1 + y);
    return { px, w: 16, h: 16 };
  }

  // ------------------------------------------------------------------ when Nell and Vorn speak, and what (design pass 24 section 4.15)
  // Their pools are spec/folk.json's: meet, greet, open, bought, poor and tap for both; bulk, trophy and ember for Nell; free, all
  // for Vorn. They have no bubble in the yard: a plank's head is where they speak. The page keeps the memory in the save
  const D = () => root.FORGE_FOLK || (typeof module !== "undefined" && module.exports && typeof require === "function" ? require("../spec/folk.json") : null) || { folk: {}, arms: {} };
  const WHO = ["nell", "vorn"], GREET_MS = 10 * 60 * 1000;
  const isoOf = ms => new Date(ms).toISOString().replace(/\.\d+Z$/, "Z");
  function memory(saved) {
    const m = {};
    for (const who of WHO) {
      const s = saved && typeof saved === "object" && saved[who] && typeof saved[who] === "object" ? saved[who] : {}, n = {};
      if (s.n && typeof s.n === "object") for (const [k, v] of Object.entries(s.n)) if (v > 0) n[k] = v | 0;
      m[who] = { met: !!s.met, at: typeof s.at === "string" ? s.at : null, n };
    }
    return m;
  }
  const poolOf = (who, pool) => { const L = (((D().folk || {})[who] || {}).lines || {})[pool]; return Array.isArray(L) ? L : []; };
  function say(mem, who, pool, o) {
    const m = memory(mem), L = poolOf(who, pool);
    if (!m[who] || !L.length) return { text: null, mem: m };
    const k = m[who].n[pool] || 0; m[who].n[pool] = k + 1;
    return { text: String(L[k % L.length]).replace(/\{n\}/g, o && o.n !== undefined ? String(o.n) : ""), mem: m };
  }
  function opening(mem, who, o) {
    o = o || {};
    const m = memory(mem), me = m[who]; if (!me) return { pool: null, mem: m };
    const now = o.now === undefined ? Date.now() : o.now, last = me.at ? Date.parse(me.at) : NaN;
    let pool;
    if (!me.met) pool = "meet";
    else if (who === "vorn" && o.all) pool = "all";
    else if (who === "vorn" && o.free > 0) pool = o.free === 1 ? "free_one" : o.free === 2 ? "free" : "free_many";
    else if (!isNaN(last) && now - last >= GREET_MS) pool = "greet";
    else pool = ((me.n.open || 0) + (me.n.tap || 0)) % 2 ? "tap" : "open";
    me.met = true; me.at = isoOf(now);
    return { pool, mem: m };
  }
  const title = who => ((D().folk || {})[who] || {}).title || who;
  const arms = cls => (D().arms || {})[cls] || "";

  const api = { frame, face, memory, say, opening, title, arms, nell, mule, vorn, hen, cat, FOLK, NELL_POSES, VORN_POSES, WHO, GREET_MS, version: 1 };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.Folk = api;
})(typeof window !== "undefined" ? window : globalThis);
