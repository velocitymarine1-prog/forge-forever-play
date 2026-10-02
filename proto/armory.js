// FORGE FOREVER: the Armory (design pass 15, card t70). A room of its own beside the smithy, through the door on the Forge's right
// wall: a hall of the smithy's own stone, beam and flagstones, as long as the smith's collection, with every weapon standing on oak
// shelves, a bay for each class, lit by caged lamps hung from the beam. Nothing is played in it: it is looked at. A second wall, the
// Legends, hangs each legend in a gilt case. The door at the hall's left end goes back to the Forge.
// Everything is drawn in world pixels at the smithy's scale (the room is 112 high), by the pixel rules: a soot outline, ramps lit from
// the top left, the ENDESGA 32 palette and the smithy's own tones, light dithered in four levels.
//   Armory.layout(model, viewW) -> L   where everything stands: the door, the bays and their cells, the cases, the lamps, the hall's width
//   Armory.paint(L, x0, x1) -> { w, h, data }   the hall's pixels for the columns x0 to x1 - 1, as RGBA; pure, and any two slices agree
//                                      where they meet, so the page paints the hall in chunks as it is walked
//   Armory.mount(els, o) -> hall       the page's side: a native sideways scroller, the chunks, a button and a sprite for each weapon
// A model is { page: "armory" | "legends", classes: [{ cls, label, items: [{ t, n, gone, mine }] }], legends: [{ t, n, gone, mine,
// sub: [lines] }], missing, empty } with t the Thing's record. Plain script, defines window.Armory; reads window.Smithy for the room's tones and light.
(function (root) {
  "use strict";
  const S = root.Smithy, T = S.TONES, OUT = S.OUT, BAYER = S.BAYER;
  const H = 112, FLOOR = 92, POST = 7, CHUNK = 128;
  // a bay: two uprights of SIDE, cells of CELL across, two shelves; the sprites' rows and the boards under them
  const CELL = 36, SIDE = 4, GAP = 12, FIRST = 66, TAIL = 74;
  const ROWS = [{ top: 14, board: 46 }, { top: 51, board: 83 }];
  // the door back to the Forge: the Forge's own Armory door, mirrored (its frame x 14 to 53, the leaf swung open against the wall at 9 to 13)
  const DOOR = { x0: 14, x1: 53, top: 40, bot: 91 };
  // a legend's case: a gilt frame CASE.w wide, one every CASE.pitch
  const CASE = { w: 44, pitch: 72, top: 14, bot: 59, first: 72 };
  const TIER = { 1: "#5a6988", 2: "#3e8948", 3: "#124e89", 4: "#68386c", 5: "#f77622", 6: "#a22633" };
  const LAMP = [254, 174, 52], REACH = 48;
  const hexOf = new Map(), hex = c => { let v = hexOf.get(c); if (!v) { v = S.hex(c); hexOf.set(c, v); } return v; };
  // a number from 0 to 1 for a pair of whole numbers: the wall's bricks take their tones from it, so any slice of the hall is the same wall
  const hash = (a, b) => { let t = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35); t ^= t >>> 15; t = Math.imul(t, 0x2c1b3c6d); t ^= t >>> 12; return (t >>> 0) / 4294967296; };

  // ------------------------------------------------------------------ where everything stands
  function layout(model, viewW) {
    model = model || {};
    const page = model.page === "legends" ? "legends" : "armory";
    const L = { page, H, floorY: FLOOR, door: { x0: DOOR.x0 - 5, x1: DOOR.x1, y0: DOOR.top, y1: DOOR.bot }, bays: [], cases: [], cells: [], lamps: [{ x: 59, y: 13 }], missing: model.missing | 0 };
    let x = FIRST;
    if (page === "armory") {
      for (const c of (model.classes || [])) {
        const n = c.items.length, cols = Math.max(1, Math.ceil(n / 2)), x0 = x, x1 = x0 + 2 * SIDE + cols * CELL - 1;
        const bay = { cls: c.cls, label: c.label || c.cls, x0, x1, cols, n, held: c.items.filter(it => !it.gone).length, cells: [] };
        // down the first column, then the next: the rarest stand nearest the door
        c.items.forEach((item, i) => { const col = i >> 1, row = i & 1, cell = { item, bay: c.cls, x: x0 + SIDE + col * CELL + 2, y: ROWS[row].top, col, row }; bay.cells.push(cell); L.cells.push(cell); });
        L.bays.push(bay);
        for (let col = 4; col < cols - 1; col += 4) L.lamps.push({ x: x0 + SIDE + col * CELL, y: 13 });   // a long bay is lit along its length too
        L.lamps.push({ x: x1 + 1 + GAP / 2, y: 13 });
        x = x1 + 1 + GAP;
      }
    } else {
      x = CASE.first;
      (model.legends || []).forEach((item, i) => {
        const x0 = CASE.first + i * CASE.pitch, x1 = x0 + CASE.w - 1, cell = { item, bay: "legendary", x: x0 + 6, y: CASE.top + 7, col: i, row: 0 };
        L.cases.push({ x0, x1, y0: CASE.top, y1: CASE.bot, cx: x0 + CASE.w / 2, cell }); L.cells.push(cell);
        L.lamps.push({ x: x1 + 1 + (CASE.pitch - CASE.w) / 2, y: 13 });
        x = x0 + CASE.pitch;
      });
    }
    L.end = x;                                                  // where the bare wall begins, past the last bay or case
    L.W = Math.max(Math.ceil(viewW || 0), x + TAIL + POST);    // the hall is never shorter than the screen
    // the bare wall past the collection is lit too: a lamp every 76 px
    for (let lx = x + 70; lx < L.W - POST - 12; lx += 76) L.lamps.push({ x: lx, y: 13 });
    return L;
  }

  // ------------------------------------------------------------------ the hall's pixels
  // the wall: the smithy's stone in 7 px courses, bricks 13 wide on a pitch of 14, each its own tone, a crack now and then
  function wallAt(x, y) {
    const row = Math.floor(y / 7), yy = y - row * 7, xo = x + (row % 2 ? 7 : 0), bi = Math.floor(xo / 14), bx = xo - bi * 14;
    if (yy === 6) return T.joint;
    if (bx === 13) return T.dark;
    if (yy === 0) return T.course;
    if (yy === 5) return T.under;
    if (bx === 0) return T.side;
    if (hash(row, bi + 4096) < 0.12) { const kx = 3 + Math.floor(hash(row, bi + 8192) * 7); if ((bx === kx && yy === 2) || (bx === kx + 1 && yy === 3)) return T.joint; }
    return T.wall[Math.floor(hash(row, bi) * T.wall.length)];
  }
  const floorAt = (x, y) => { const row = Math.floor((y - FLOOR) / 5), xo = x + (row % 2 ? 9 : 0), seam = xo % 18 === 0 || (y - FLOOR) % 5 === 0; return y === FLOOR ? T.floorEdge : seam ? T.floorJoint : (xo % 18 < 2 || (y - FLOOR) % 5 === 1) ? T.floorLit : T.floor[0]; };
  const beamAt = (x, y) => y === 0 ? OUT : y === 1 ? T.oak[2] : y === 7 ? T.oak[0] : (x * 3 + y * 7) % 13 === 0 ? T.oakKnot : T.oak[1];

  function paint(L, x0, x1) {
    x0 = Math.max(0, Math.floor(x0)); x1 = Math.min(L.W, Math.ceil(x1));
    const w = Math.max(0, x1 - x0), base = new Array(w * H).fill(null), lit = new Uint8Array(w * H);
    // set paints the hall's own pixel (x, y), whatever slice is being painted; lit 0 keeps the lamps' glow off it
    const set = (x, y, c, l) => { x = Math.round(x); y = Math.round(y); if (x < x0 || x >= x1 || y < 0 || y >= H || !c) return; const i = y * w + (x - x0); base[i] = c; lit[i] = l === undefined ? 1 : l; };
    const fill = (fx0, fy0, fx1, fy1, f, l) => { for (let y = fy0; y <= fy1; y++) for (let x = Math.max(fx0, x0); x <= Math.min(fx1, x1 - 1); x++) { const c = typeof f === "function" ? f(x, y) : f; if (c) set(x, y, c, l); } };
    const near = (a, b) => b >= x0 - 2 && a < x1 + 2;
    // the wall, the floor, the beam, the two posts
    for (let y = 8; y < FLOOR; y++) for (let x = x0; x < x1; x++) set(x, y, wallAt(x, y));
    for (let y = FLOOR; y < H; y++) for (let x = x0; x < x1; x++) set(x, y, floorAt(x, y));
    for (let y = 0; y < 8; y++) for (let x = x0; x < x1; x++) set(x, y, beamAt(x, y));
    for (const px of [0, L.W - POST]) if (near(px, px + POST - 1)) {
      fill(px, 8, px + 6, FLOOR - 1, (x, y) => x === px ? OUT : x === px + 1 ? T.oak[2] : x === px + 6 ? T.oak[0] : (y * 5 + x) % 17 === 0 ? T.oakKnot : T.oak[1]);
      set(px + 3, 3, T.iron[3]); set(px + 3, 4, T.iron[0]);
    }
    if (near(L.door.x0 - 2, L.door.x1 + 3)) forgeDoor(set, fill);
    for (const b of L.bays) if (near(b.x0 - 1, b.x1 + 1)) bay(set, fill, b);
    for (const c of L.cases) if (near(c.x0 - 1, c.x1 + 1)) legendCase(set, fill, c);
    for (const lp of L.lamps) if (near(lp.x - 3, lp.x + 3)) lamp(set, lp.x);
    // the lamps' light, dithered in the smithy's four levels: each pixel takes the nearest lamp's; on the floor it pools under each one
    const lamps = L.lamps.filter(lp => lp.x > x0 - REACH - 8 && lp.x < x1 + REACH + 8), data = new Uint8ClampedArray(w * H * 4);
    for (let y = 0; y < H; y++) for (let x = x0; x < x1; x++) {
      const i = y * w + (x - x0); let [r, g, b] = base[i] ? hex(base[i]) : [0, 0, 0];
      if (lit[i]) {
        let k = 0; for (const lp of lamps) { const d = y >= FLOOR ? 14 + Math.hypot((x + 0.5 - lp.x) * 0.8, (y - FLOOR) * 2.4) : Math.hypot((x + 0.5 - lp.x) * 0.9, y - lp.y); if (1 - d / REACH > k) k = 1 - d / REACH; }
        const m = S.glow(k, x, y);
        r += (LAMP[0] - r) * m; g += (LAMP[1] - g) * m * 0.9; b += (LAMP[2] - b) * m * 0.8;
      }
      const o = i * 4; data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
    }
    return { w, h: H, x0, x1, data, base, lit };
  }

  // the door back to the Forge: an oak frame studded with iron, the leaf swung open against the wall on the left, a stone sill; through
  // it the smithy, dark, with the hearth's fire on its stone and the anvil against it; the firelight spills onto the hall's floor
  function forgeDoor(set, fill) {
    const { x0, x1, top, bot } = DOOR, oak = T.oak, ix0 = x0 + 4, ix1 = x1 - 4, iy0 = top + 5, fx = ix0 + 9, fy = bot - 9;
    for (let y = iy0; y <= bot; y++) for (let x = ix0; x <= ix1; x++) {
      const k = Math.max(0, 1 - Math.hypot((x - fx) * 0.8, (y - fy) * 1.0) / 34), b = BAYER[(y & 3) * 4 + (x & 3)];
      const course = Math.floor((y - iy0) / 6), off = course % 2 ? 5 : 0, joint = (y - iy0) % 6 === 5 || (x - ix0 + off) % 10 === 9;
      let c;
      if (y >= bot - 3) c = y === bot - 3 ? "#2a1418" : k * 1.1 > b ? "#be4a2f" : "#3b2f36";
      else c = joint ? (k > 0.66 ? "#a22633" : "#1e1828") : k > 0.42 + b * 0.5 ? (k > 0.68 + b * 0.26 ? "#f77622" : "#a22633") : k > 0.3 ? "#3e2731" : "#2a2338";
      set(x, y, c, 0);
    }
    // the anvil on its stump, seen against the fire
    const ANVIL = ["ooooooooooo.", "o5444444431o", ".oo3222221o.", "...o32221o..", "..o3222221o.", ".o322222221o", ".oooooooooo."], AC = { o: OUT, 5: "#c0cbdc", 4: "#8b9bb4", 3: "#5a6988", 2: "#3a4466", 1: "#262b44" };
    ANVIL.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== ".") set(ix0 + 5 + i, bot - 13 + j, AC[ch], 0); }));
    fill(ix0 + 8, bot - 6, ix0 + 13, bot - 4, (x) => x === ix0 + 8 || x === ix0 + 13 ? OUT : x < ix0 + 11 ? "#b86f50" : "#733e39", 0);
    // the frame: oak jambs and a lintel standing proud of the wall, studded with iron
    for (let y = top; y <= bot; y++) for (let x = x0; x <= x1; x++) {
      if (x >= ix0 && x <= ix1 && y >= iy0) continue;
      const lintel = y < iy0, edge = x === x0 || x === x1 || y === top;
      const stud = (lintel && y === top + 2 && (x - x0) % 6 === 3) || (!lintel && (x === x0 + 2 || x === x1 - 1) && (y - iy0) % 7 === 3);
      set(x, y, edge ? OUT : stud ? "#8b9bb4" : lintel ? (y === top + 1 ? oak[2] : y === iy0 - 1 ? oak[0] : oak[1]) : x === x0 + 1 || x === x1 - 3 ? oak[2] : x === ix0 - 1 || x === x1 - 1 ? oak[0] : oak[1]);
    }
    for (let x = x0 - 2; x <= x1 + 2; x++) { set(x, top - 1, OUT); if (x < x0 || x > x1) { set(x, top, OUT); set(x, top + 1, x === x0 - 2 || x === x1 + 2 ? OUT : oak[2]); set(x, top + 2, x === x0 - 2 || x === x1 + 2 ? OUT : oak[1]); set(x, top + 3, OUT); } }
    // the leaf, swung open against the wall on the left: oak seen at a slant, two iron bands, a ring
    for (let t = 0; t <= 4; t++) { const x = x0 - 1 - t, y0 = top + 3 + t, y1 = bot - Math.floor(t / 2);
      for (let y = y0; y <= y1; y++) set(x, y, t === 4 || y === y0 || y === y1 ? OUT : (y - top) % 18 === 9 || (y - top) % 18 === 10 ? "#5a6988" : t === 0 ? oak[0] : t === 1 ? oak[1] : oak[2]); }
    set(x0 - 3, Math.round((top + bot) / 2) + 2, "#feae34");
    // the sill, and the hearth's light on the hall's floor in front of the door
    fill(x0 - 1, bot, x1 + 1, bot, (x) => x === x0 - 1 || x === x1 + 1 ? OUT : "#8b9bb4", 0);
    for (let y = FLOOR; y < Math.min(H, FLOOR + 7); y++) for (let x = ix0 - 2; x <= ix1 + 2; x++) {
      const k = 1 - (y - FLOOR) / 7 - Math.abs(x + 0.5 - (ix0 + ix1 + 1) / 2) / 26;
      if (k > 0 && BAYER[(y & 3) * 4 + (x & 3)] < k * 0.7) set(x, y, y === FLOOR ? "#f77622" : "#a22633", 0);
    }
  }
  // a bay: an oak rack standing on the floor against the wall: two uprights, a cornice, a dark back of planks, two shelves, a plinth;
  // on each board's face, under each weapon, a tag in the colour of its rarity
  function bay(set, fill, b) {
    const { x0, x1 } = b, oak = T.oak, ix0 = x0 + SIDE, ix1 = x1 - SIDE;
    fill(ix0, 14, ix1, 86, (x, y) => y === 14 ? OUT : (x - ix0) % 9 === 8 ? T.joint : Math.floor((x - ix0) / 9) % 2 ? "#2a2338" : T.under);
    for (const row of ROWS) {
      fill(ix0, row.board, ix1, row.board + 3, (x, y) => y === row.board ? oak[3] : y === row.board + 1 ? oak[2] : y === row.board + 2 ? oak[1] : OUT);
      fill(ix0, row.board + 4, ix1, row.board + 4, T.joint);                       // the board's shadow on the back
    }
    for (const cell of b.cells) {
      const bx = cell.x + 11, by = ROWS[cell.row].board + 1, c = cell.item.gone ? "#3a3448" : TIER[Math.max(1, Math.min(6, cell.item.t.tier | 0))];
      fill(bx, by, bx + 9, by + 1, (x) => x === bx || x === bx + 9 ? OUT : c);
    }
    fill(x0, 14, x0 + 3, FLOOR - 1, (x) => x === x0 ? OUT : x === x0 + 1 ? oak[2] : x === x0 + 2 ? oak[1] : oak[0]);
    fill(x1 - 3, 14, x1, FLOOR - 1, (x) => x === x1 ? OUT : x === x1 - 3 ? oak[2] : x === x1 - 2 ? oak[1] : oak[0]);
    fill(ix0, 87, ix1, FLOOR - 1, (x, y) => y === 87 ? oak[2] : y === FLOOR - 1 ? oak[0] : (x * 3 + y) % 11 === 0 ? T.oakKnot : oak[1]);
    fill(x0 - 1, 10, x1 + 1, 13, (x, y) => y === 10 || x === x0 - 1 || x === x1 + 1 ? OUT : y === 11 ? oak[3] : y === 12 ? oak[2] : oak[0]);
  }
  // a legend's case: a gilt frame moulded in three rings round a dark velvet ground, a brass plate under it
  function legendCase(set, fill, c) {
    const { x0, x1, y0, y1 } = c, G = ["#fee761", "#feae34", "#be4a2f"];
    for (let y = y0; y <= y1; y++) for (let x = Math.max(x0, 0); x <= x1; x++) {
      const e = Math.min(x - x0, x1 - x, y - y0, y1 - y), tl = (x - x0 === e) || (y - y0 === e);
      let col;
      if (e === 0) col = OUT;
      else if (e === 1) col = tl ? G[0] : G[2];
      else if (e === 2) col = G[1];
      else if (e === 3) col = tl ? G[2] : G[0];
      else if (e === 4) col = OUT;
      else { const k = 1 - ((x - x0) + (y - y0)) / 70; col = BAYER[(y & 3) * 4 + (x & 3)] < k * 0.55 ? "#68386c" : "#3e2731"; }
      set(x, y, col, e <= 4 ? 1 : 0);
    }
    set(x0 + 2, y0 + 2, "#ffffff");
    const cx = Math.floor((x0 + x1) / 2);
    fill(cx - 8, y1 + 2, cx + 9, y1 + 5, (x, y) => x === cx - 8 || x === cx + 9 || y === y1 + 2 || y === y1 + 5 ? OUT : y === y1 + 3 ? G[1] : G[2]);
  }
  // a lamp hung from the beam on a chain: an iron cage, a flame
  function lamp(set, lx) {
    lx = Math.floor(lx);
    for (let y = 8; y <= 9; y++) set(lx, y, y % 2 ? "#262b44" : "#5a6988", 0);
    const CAGE = [".ooo.", "o444o", "oywyo", "oyyyo", ".o3o."], CC = { o: OUT, 4: "#8b9bb4", 3: "#5a6988", y: "#fee761", w: "#fff6c8" };
    CAGE.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== ".") set(lx - 2 + i, 10 + j, CC[ch], 0); }));
  }

  // ------------------------------------------------------------------ the page's side: the hall under the thumb
  // els: { hall (the scroller), track (as wide as the hall, inside it) }. o: { sprite(t, scale) -> canvas, onOpen(t), onDoor(),
  // tierWord(t) }. The hall scrolls sideways natively; its pixels are painted in chunks CHUNK wide as they come near the screen (each
  // one pixel wider than its place, so no seam shows between two at any scale), and each weapon near the screen is a button holding
  // its sprite at the room's own scale. Everything in the track is placed in world pixels through --x, --y and the track's --s
  function mount(els, o) {
    const hall = els.hall, track = els.track, doc = hall.ownerDocument;
    let L = null, model = null, s = 1, viewW = 232, queued = false;
    const chunks = new Map(), cellEls = new Map(), fixed = [];
    const place = (el, x, y) => { el.style.setProperty("--x", x); if (y !== undefined) el.style.setProperty("--y", y); return el; };
    function update() {
      queued = false;
      if (!L) return;
      const a = hall.scrollLeft / s, span = Math.max(1, hall.clientWidth / s), lo = Math.max(0, a - span), hi = Math.min(L.W, a + 2 * span);
      for (let i = Math.floor(lo / CHUNK); i * CHUNK < hi; i++) {
        if (chunks.has(i)) continue;
        const img = paint(L, i * CHUNK, Math.min(L.W, (i + 1) * CHUNK + 1)), cv = doc.createElement("canvas");
        cv.width = img.w; cv.height = img.h; cv.className = "hc"; cv.setAttribute("aria-hidden", "true"); cv.style.setProperty("--cw", img.w);
        const g = cv.getContext("2d"), id = g.createImageData(img.w, img.h); id.data.set(img.data); g.putImageData(id, 0, 0);
        track.insertBefore(place(cv, i * CHUNK, 0), track.firstChild); chunks.set(i, cv);
      }
      for (const [i, cv] of chunks) if ((i + 1) * CHUNK < lo - span || i * CHUNK > hi + span) { cv.remove(); chunks.delete(i); }
      for (const cell of L.cells) {
        const on = cell.x + CELL > lo && cell.x < hi, el = cellEls.get(cell);
        if (on && !el) { const b = button(cell); track.appendChild(b); cellEls.set(cell, b); }
        else if (!on && el && (cell.x + CELL < lo - span || cell.x > hi + span)) { el.remove(); cellEls.delete(cell); }
      }
      if (o.onScroll) o.onScroll(hall.scrollLeft, hall.scrollWidth - hall.clientWidth);
    }
    function button(cell) {
      const it = cell.item, t = it.t, b = doc.createElement("button");
      b.type = "button"; b.className = "aw" + (it.gone ? " gone" : "") + (it.mine ? " mine" : "") + (L.page === "legends" ? " leg" : "");
      b.dataset.id = t.id;
      const word = o.tierWord ? o.tierWord(t) : "";
      b.title = t.name + (word ? " · " + word : "") + (it.gone ? " · no longer held" : "");
      b.setAttribute("aria-label", t.name + (word ? ": " + word : "") + (it.n > 1 ? ", " + it.n + " held" : "") + (it.gone ? ", no longer held" : ""));
      b.appendChild(o.sprite(t, 1));
      if (it.mine) { const st = doc.createElement("span"); st.className = "st"; st.textContent = "★"; st.setAttribute("aria-hidden", "true"); b.appendChild(st); }
      if (it.n > 1) { const x = doc.createElement("span"); x.className = "x"; x.textContent = "×" + it.n; b.appendChild(x); }
      b.addEventListener("click", () => { if (o.onOpen) o.onOpen(t); });
      return place(b, cell.x - 2, cell.y);
    }
    function queue() { if (queued) return; queued = true; (root.requestAnimationFrame || (f => setTimeout(f, 16)))(update); }
    hall.addEventListener("scroll", queue, { passive: true });
    // a mouse has no thumb: the wheel walks the hall, and so does a drag (the click that ends a drag opens nothing). In a frame turned
    // a quarter (My screen won't turn) a browser's own touch scrolling does not follow the turn, so there a thumb's drag is walked here
    // too, along the glass's long side, with a short glide when it lifts
    hall.addEventListener("wheel", e => { if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; e.preventDefault(); hall.scrollLeft += e.deltaY; }, { passive: false });
    let drag = null, dragged = false, glide = 0;
    const raf = root.requestAnimationFrame || (f => setTimeout(() => f(Date.now()), 16)), caf = root.cancelAnimationFrame || clearTimeout;
    hall.addEventListener("pointerdown", e => {
      dragged = false; if (glide) { caf(glide); glide = 0; }
      const turned = !!(o.turned && o.turned()), mouse = e.pointerType === "mouse";
      if (mouse ? e.button === 0 : turned) drag = { id: e.pointerId, x: e.clientX, y: e.clientY, left: hall.scrollLeft, turned, glides: !mouse, trail: [[e.timeStamp, 0]] };
    });
    root.addEventListener("pointermove", e => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag.turned ? e.clientY - drag.y : e.clientX - drag.x;
      if (Math.abs(d) > 4) dragged = true;
      if (dragged) { hall.scrollLeft = drag.left - d; drag.trail.push([e.timeStamp, d]); if (drag.trail.length > 5) drag.trail.shift(); }
    });
    const letGo = e => {
      if (!drag || e.pointerId !== drag.id) return;
      const tr = drag.trail, glides = drag.glides && dragged && tr.length > 1; drag = null;
      if (!glides) return;
      let v = (tr[tr.length - 1][1] - tr[0][1]) / Math.max(1, tr[tr.length - 1][0] - tr[0][0]), last = 0;   // the thumb's speed, CSS pixels a millisecond
      const step = now => { const dt = last ? Math.min(40, now - last) : 16; last = now; hall.scrollLeft -= v * dt; v *= Math.pow(0.95, dt / 16);
        glide = Math.abs(v) < 0.03 || hall.scrollLeft <= 0 || hall.scrollLeft >= hall.scrollWidth - hall.clientWidth ? 0 : raf(step); };
      if (Math.abs(v) >= 0.05) glide = raf(step);
    };
    root.addEventListener("pointerup", letGo); root.addEventListener("pointercancel", letGo);
    hall.addEventListener("click", e => { if (dragged) { dragged = false; e.preventDefault(); e.stopPropagation(); } }, true);

    function render(m, keep) {
      const at = keep ? hall.scrollLeft / s : 0;
      model = m; L = layout(model, viewW);
      for (const cv of chunks.values()) cv.remove(); chunks.clear();
      for (const el of cellEls.values()) el.remove(); cellEls.clear();
      for (const el of fixed) el.remove(); fixed.length = 0;
      track.style.setProperty("--w", L.W);
      const add = el => { fixed.push(el); track.appendChild(el); return el; };
      // the door back to the Forge, under its plate
      const d = doc.createElement("button"); d.type = "button"; d.className = "door"; d.id = "forgeDoor"; d.setAttribute("aria-label", "Back through the door to the Forge");
      d.innerHTML = '<span class="doorplate">← Forge</span>';
      d.style.setProperty("--dw", L.door.x1 - L.door.x0 + 3); d.style.setProperty("--dh", L.door.y1 - L.door.y0 + 1);
      d.addEventListener("click", () => { if (o.onDoor) o.onDoor(); });
      add(place(d, L.door.x0 - 1, L.door.y0));
      // a plate on the floor before each bay: the class and how many weapons stand in it. The foot is as wide as the bay and the plate
      // sticks to the screen's edges inside it, so a bay longer than the screen keeps its name in sight
      for (const b of L.bays) {
        const f = doc.createElement("div"); f.className = "bayfoot"; f.style.setProperty("--bw", b.x1 - b.x0 + 1);
        const p = doc.createElement("div"); p.className = "bayplate"; p.dataset.cls = b.cls; p.innerHTML = "<b></b><span></span>"; p.firstChild.textContent = b.label; p.lastChild.textContent = b.n;
        f.appendChild(p); add(place(f, b.x0, FLOOR + 3));
      }
      // under each legend's case: its name, and what the page says of it
      for (const c of L.cases) {
        const it = c.cell.item, p = doc.createElement("div"); p.className = "legcap" + (it.gone ? " gone" : ""); p.dataset.id = it.t.id;
        const b = doc.createElement("b"); b.textContent = it.t.name + (it.mine ? " ★" : ""); p.appendChild(b);
        for (const line of [].concat(it.sub || [])) { const sp = doc.createElement("span"); sp.textContent = line; p.appendChild(sp); }
        add(place(p, c.cx, c.y1 + 8));
      }
      // on the bare wall past the last bay: what is still to find, or that there is nothing yet
      const note = L.page === "legends" ? (L.cases.length ? "" : (m.empty || "No legends yet.")) : (L.bays.length ? (L.missing > 0 ? L.missing + (L.missing === 1 ? " more class" : " more classes") + " to find" : "") : (m.empty || "No weapons yet."));
      if (note) { const p = doc.createElement("div"); p.className = "wallnote"; p.textContent = note; add(place(p, L.end + 10, 36)); }
      hall.scrollLeft = at * s;
      update();
      return L;
    }
    // the scale (CSS pixels to a world pixel) and the screen's width in world pixels; a wider screen may lengthen a short hall
    function fit(scale, vw) {
      const at = hall.scrollLeft / s, was = L ? L.W : 0;
      s = scale; viewW = vw; track.style.setProperty("--s", s);
      if (model && layout(model, viewW).W !== was) render(model, false);
      hall.scrollLeft = at * s;
      queue();
    }
    const walk = (dir, still) => { const by = dir * hall.clientWidth * 0.8; if (hall.scrollBy && !still) hall.scrollBy({ left: by, behavior: "smooth" }); else hall.scrollLeft += by; };
    return { render, fit, update, walk, get layout() { return L; }, get scale() { return s; }, get x() { return hall.scrollLeft / s; }, set x(v) { hall.scrollLeft = v * s; update(); }, chunks, cellEls };
  }

  root.Armory = { layout, paint, mount, H, FLOOR, CELL, SIDE, GAP, FIRST, TAIL, POST, CHUNK, ROWS, DOOR, CASE, TIER, LAMP, REACH, wallAt, floorAt, beamAt };
})(typeof window !== "undefined" ? window : globalThis);
