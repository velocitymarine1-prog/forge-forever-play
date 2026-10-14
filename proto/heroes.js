// FORGE FOREVER: the heroes (design pass 46, jumpr card t108; built as build 36 by card t110). What the player is, purely a look:
// an elf, a knight, a wretch, a wizard, a yeti or a sasquatch, chosen at the beginning of the game (proto/hero-pick.js) and kept in the
// player record (proto/smith.js: hero, colour). The knight is proto/knight.js's own; the five others are skins painted here on the
// knight's skeleton (Knight.skeleton: the parts of any frame, the hip's row, the lean, the head's offset, the legs, the arms as boxes or
// slanted segments with a fist, the knees, the skirt's length, the plume streaming up or not, the back view), so every animation the
// knight has in every facing, the overlays and the carried ram come for free, and the rule that keeps it cosmetic holds: the fist is
// painted in the knight's fist box and the frame's hand is the skeleton's, the knight's, so a weapon sits, swings and fires from the
// same pixel whoever holds it, and the rules never hear of a hero (Combat.hold reads the knight's hand with no look). The house's
// pixel rules hold: ENDESGA 32 and the Things' ramps (proto/pixel-forge.js RAMP), four-tone ramps lit from the top left (the knight's
// region()), a one-pixel soot outline, the feet on the bottom row; nothing but the outline on the grid's left, right and bottom edges.
// The colours (red, orange, yellow, green, blue, purple: Knight.COLOURS) are the wretch's cloak and hood and the wizard's robe, sleeves
// and hat; the elf wears the forest's green, the yeti white fur, the sasquatch brown. On the sand (a look with a side) the main colour
// is the side's, and the three with no colour of their own wear a tournament tabard in it; an ally's band is the gold hem.
// Ported from the pass's sketch (docs/design/46-heroes.sketch.js), a first pass at each hero: any of them can be redrawn here without
// touching anything else, inside the hand and grid rules (tools/test-heroes.js).
//   Heroes.ids                        the six, in the chooser's order (the knight among them)
//   Heroes.has(id), takesColour(id)   whether an id is a hero here; whether it takes a colour (the knight, the wretch, the wizard)
//   Heroes.of(record)                 { hero, colour, chosen } from a player record (the knight in red by default; chosen: the record names a hero)
//   Heroes.draw(hero, drawing, parts, look, carry)   the frame's grid for proto/knight.js (null for a hero not painted here)
//   Heroes.face(look)                 the talk box's 16 x 16 face: the opening's crop of the front idle frame (columns 8 to 23, rows 0 to 15)
//   Heroes.gauntlet(hero, colour), paintHand(set, x, y, hero, colour, s)   the opening's close-up hand in the hero's ramps (proto/intro.js)
//   Heroes.RAMPS, NAMES               the heroes' own ramps; a name for each id (the words proper are spec/heroes.json's)
// Plain script, defines window.Heroes (module.exports in node); needs proto/knight.js loaded before it (an older knight.js without the
// skeleton leaves no Heroes, and every hero is drawn as the knight).
(function (root) {
  "use strict";
  const KN = root.Knight;
  if (!KN || !KN.kit || !KN.skeleton) return;
  const { Grid, rect, ell, or, cap, region, outline, R } = KN.kit;
  const N = KN.N, OUT = KN.OUT;
  const COLOUR = KN.COLOURS, SIDE = KN.SIDE;

  // ------------------------------------------------------------------ the six, and their ramps
  const IDS = ["elf", "knight", "wretch", "wizard", "yeti", "sasquatch"];
  const NAMES = { elf: "Elf", knight: "Knight", wretch: "Wretch", wizard: "Wizard", yeti: "Yeti", sasquatch: "Sasquatch" };
  const TAKES = { knight: true, wretch: true, wizard: true };
  // every tone is in ENDESGA 32 or the Things' ramps (test-heroes holds the palette)
  const P_ = {
    soot: ["#181425", "#181425", "#262b44", "#262b44"],
    skin: ["#c28569", "#e8b796", "#ead4aa", "#fffaf0"],          // (PF bone)
    hair: ["#d77643", "#feae34", "#fee761", "#fffaf0"],          // the elf's golden hair
    leaf: ["#265c42", "#3e8948", "#63c74d", "#b4e67a"],          // the elf's tunic (PF green)
    moss: ["#193c3e", "#265c42", "#3e8948", "#63c74d"],          // the elf's cloak, a step darker
    leather: ["#2a1d28", "#3e2731", "#733e39", "#b86f50"],
    wood: ["#3e2731", "#733e39", "#b86f50", "#e4a672"],
    gold: ["#be4a2f", "#f77622", "#feae34", "#fee761"],
    beard: ["#8b9bb4", "#c0cbdc", "#ffffff", "#ffffff"],
    wraps: ["#c28569", "#e4a672", "#ead4aa", "#fffaf0"],         // the wretch's bandages (PF parchment)
    rope: ["#733e39", "#d77643", "#e4a672", "#ead4aa"],          // (PF brass)
    shadow: ["#181425", "#231b33", "#2f2a45", "#4a3f66"],        // inside the wretch's hood (PF obsidian's)
    snow: ["#8b9bb4", "#c0cbdc", "#ffffff", "#ffffff"],          // the yeti's coat
    ice: ["#124e89", "#0099db", "#2ce8f5", "#b8f4ff"],           // the yeti's face, hands and feet
    bark: ["#3e2731", "#733e39", "#b86f50", "#e4a672"],          // the sasquatch's coat (PF wood)
    hide: ["#b86f50", "#c28569", "#e8b796", "#ead4aa"]           // the sasquatch's face, hands and feet: a pale hide, as an ape's
  };
  const OAK = R.oak, IRON = R.iron;
  const dark = r => [r[0], r[0], r[1], r[2]];   // a ramp a step darker (the far limbs; the wretch's worn cloth)

  // ------------------------------------------------------------------ painting helpers
  const at = (sp, x, y) => sp.get(x, y);
  const put = (sp, x, y, c) => sp.set(x, y, c);
  const fill = (sp, x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(sp, x, y, c); };
  const limbShape = (a, widen) => a.seg ? cap(a.seg[0], a.seg[1], a.seg[2], a.seg[3], (a.w || 1.3) + (widen || 0)) : rect(a.x0, a.y0, a.x1, a.y1);
  // a box arm widened by w on its outer side (the side away from the body's middle at x 15.5)
  const boxWide = (a, w) => { if (!w || a.seg) return limbShape(a, w > 0 ? w * 0.5 : w * 0.4); const outer = (a.x0 + a.x1) / 2 < 15.5 ? -1 : 1; return outer < 0 ? rect(a.x0 - w, a.y0, a.x1, a.y1) : rect(a.x0, a.y0, a.x1 + w, a.y1); };
  // shag: a fur coat's edge roughened, one pixel out on the left and right edges every third row, in the coat's dark tone
  function shag(sp, coat) {
    const isFur = c => coat.includes(c), add = [];
    for (let y = 1; y < N - 2; y++) for (let x = 1; x < N - 1; x++) {
      const c = at(sp, x, y); if (!isFur(c)) continue;
      if ((x * 7 + y * 3) % 3 !== 0) continue;
      if (!at(sp, x - 1, y) && !at(sp, x - 1, y + 1)) add.push([x - 1, y]);
      else if (!at(sp, x + 1, y) && !at(sp, x + 1, y + 1)) add.push([x + 1, y]);
    }
    for (const [x, y] of add) put(sp, x, y, coat[0]);
  }
  // the outline needs the grid's left, right and bottom edges: nothing but the outline is drawn there (a widened sleeve or a tuft of
  // fur that reached them is trimmed); the top row stays open for a crest's tip, as the knight's plume uses it
  function trim(sp) { for (let k = 0; k < N; k++) { put(sp, 0, k, null); put(sp, N - 1, k, null); put(sp, k, N - 1, null); } }
  // a ragged hem: the bottom row of a cloth band kept on every other column
  function ragged(sp, x0, x1, y, keepOdd) { for (let x = x0; x <= x1; x++) if ((x % 2 === 1) !== !!keepOdd) put(sp, x, y, null); }

  // ------------------------------------------------------------------ the skins
  // Each skin answers the same slots the knight's drawParts fills, in the same order: the arms behind the body, the legs (with their
  // feet), the lower body (skirt, robe, rags or coat) and its band, the knees, the waist, the torso, the front arms, the shoulders, the
  // head (with its crest: hair, hat, hood's point or tuft, streaming up when the pose says so), the arms raised over the head. The fist
  // is always the knight's fist box; a skin may widen an arm on its outer side or thin it, never move the fist.
  // look: proto/knight.js's resolved look ({ colour, side, band, ... })
  function skinOf(hero, look) {
    const col = COLOUR[look.colour] || COLOUR.red, side = look.side ? SIDE[look.side] : null, acc = side || col;
    const S = { hero, band: look.band || null, tabard: null };
    if (hero === "elf") Object.assign(S, { kind: "cloth", sleeve: P_.leaf, cuff: P_.leather, fist: P_.skin, leg: P_.leather, foot: P_.soot.slice(0, 2).concat(P_.leather.slice(1, 3)), lower: P_.leaf, waist: P_.leather, buckle: P_.gold, torso: P_.leaf, cape: P_.moss, shoulder: P_.moss, tabard: side });
    if (hero === "wizard") Object.assign(S, { kind: "robe", sleeve: acc, cuff: P_.gold, fist: P_.skin, leg: acc, foot: P_.leather, lower: acc, waist: P_.gold, torso: acc, shoulder: acc, hat: acc });
    if (hero === "wretch") Object.assign(S, { kind: "rags", sleeve: P_.wraps, cuff: null, fist: P_.wraps, leg: P_.wraps, foot: P_.wraps, lower: acc, waist: P_.rope, torso: acc, shoulder: acc, hood: acc, thin: true });
    if (hero === "yeti") Object.assign(S, { kind: "fur", sleeve: P_.snow, fist: P_.ice, leg: P_.snow, foot: P_.ice, lower: P_.snow, torso: P_.snow, shoulder: P_.snow, face: P_.ice, coat: P_.snow, tabard: side });
    if (hero === "sasquatch") Object.assign(S, { kind: "fur", sleeve: P_.bark, fist: P_.hide, leg: P_.bark, foot: P_.hide, lower: P_.bark, torso: P_.bark, shoulder: P_.bark, face: P_.hide, coat: P_.bark, tabard: side });
    return S;
  }

  function limb(sp, S, a) {
    const far = !!a.far, r = far ? dark(S.sleeve) : S.sleeve;
    if (S.kind === "fur") region(sp, boxWide(a, 1), r);
    else if (S.thin) region(sp, a.seg ? cap(a.seg[0], a.seg[1], a.seg[2], a.seg[3], 0.9) : (a.out ? rect(a.x0, a.y0 + 1, a.x1, a.y1) : rect(a.x0 + ((a.x0 + a.x1) / 2 < 15.5 ? 1 : 0), a.y0, a.x1 - ((a.x0 + a.x1) / 2 < 15.5 ? 0 : 1), a.y1)), r);
    else region(sp, limbShape(a), r);
    if (a.fist) {
      const [x0, y0, x1, y1] = a.fist;
      // the wizard's bell sleeve: the cuff a pixel wider round the wrist; the elf's leather bracer above the hand
      if (S.kind === "robe" && !a.seg && !a.out) region(sp, rect(x0 - 1, y0 - 1, x1 + 1, y0), far ? dark(S.sleeve) : S.sleeve, { flat: 1 });
      if (S.cuff && !a.out && !a.seg) region(sp, rect(x0, y0 - 1, x1, y0 - 1), S.cuff, { flat: far ? 0 : 1 });
      region(sp, rect(x0, y0, x1, y1), far ? dark(S.fist) : S.fist);
    }
  }
  function legs(sp, S, P, side) {
    for (const g of P.legs) {
      const far = !!g.far, r = far ? dark(S.leg) : S.leg, fr = far ? dark(S.foot) : S.foot;
      if (S.kind === "fur") region(sp, rect(g.x - (side ? 0 : g.x < 15 ? 1 : 0), g.y0, g.x + 2 + (side ? 1 : g.x < 15 ? 0 : 1), g.y1), r);
      else if (S.kind === "robe") region(sp, rect(g.x - 1, g.y0, g.x + 3, g.y1 - 1), r);
      else if (S.thin) region(sp, rect(g.x + 1, g.y0, g.x + 2, g.y1), r);
      else region(sp, rect(g.x, g.y0, g.x + 2, g.y1), r);
      if (g.boot) {
        // the foot: the knight's boot box; a fur foot a pixel longer toward the toe (bigfoot), a wizard's shoe pointed
        let b0 = g.boot[0], b1 = g.boot[1];
        if (S.kind === "fur") { if (side) b1 += 1; else if (b0 < 15) b0 -= 1; else b1 += 1; }
        region(sp, rect(b0, g.y1, b1, g.y1 + 1), fr, far ? { flat: 1 } : undefined);
        if (S.kind === "robe" && side) put(sp, b1 + 1, g.y1 + 1, fr[1]);
      }
      if (g.shin) region(sp, rect(g.shin[0], g.shin[1], g.shin[2], g.shin[3]), r);
    }
  }
  function lower(sp, S, P, side, X) {
    const hip = P.hip, skirt = P.skirt || 4, sx0 = side ? 11 + X : 11, sx1 = side ? 19 + X : 20;
    if (S.kind === "fur") {
      region(sp, rect(sx0 - 1, hip, sx1 + 1, hip + skirt - 1), S.lower);
      ragged(sp, sx0 - 1, sx1 + 1, hip + skirt - 1, true);
    } else if (S.kind === "robe") {
      region(sp, rect(sx0 - 1, hip + 1, sx1 + 1, hip + skirt), S.lower);
      // standing, the robe falls to the ankles in one piece over both legs
      if (P.basic || P.legs.every(g => g.y1 >= 29 && g.y0 >= 23)) { const lx0 = Math.min(...P.legs.map(g => g.x)) - 1, lx1 = Math.max(...P.legs.map(g => g.x)) + 3, y1 = Math.min(...P.legs.map(g => g.y1)) - 1; region(sp, rect(Math.min(lx0, sx0 - 1), hip + skirt, Math.max(lx1, sx1 + 1), y1), S.lower); }
    } else if (S.kind === "rags") {
      region(sp, rect(sx0 - 1, hip + 1, sx1 + 1, hip + skirt + 1), S.lower);
      ragged(sp, sx0 - 1, sx1 + 1, hip + skirt + 1, false);
      put(sp, sx0 + 2, hip + 3, P_.leather[2]); put(sp, sx0 + 3, hip + 3, P_.leather[2]);   // a patch
    } else {
      region(sp, rect(sx0, hip + 1, sx1, hip + skirt), S.lower);
      for (let x = sx0; x <= sx1; x += 3) put(sp, x, hip + skirt, null);   // the elf's tunic cut in points
    }
    if (S.tabard) region(sp, rect(sx0, hip + 1, sx1, hip + skirt), S.tabard);
    if (S.band) region(sp, rect(sx0, hip + skirt - 1, sx1, hip + skirt), S.band, { flat: 1 });
  }
  function knees(sp, S, P) { for (const [cx, cy, rx, ry] of P.knees || []) region(sp, ell(cx, cy, rx, ry), S.kind === "fur" || S.kind === "robe" ? S.lower : S.leg); }
  function waist(sp, S, P, side, X, front) {
    const hip = P.hip, x0 = side ? 11 + X : 10, x1 = side ? 19 + X : 21;
    if (S.kind === "fur") return;
    if (S.kind === "cloth") { region(sp, rect(x0 + (side ? 0 : 1), hip, x1 - (side ? 0 : 1), hip + 1), S.waist, { flat: 2 }); if (front) { put(sp, 15, hip, S.buckle[3]); put(sp, 16, hip, S.buckle[2]); put(sp, 15, hip + 1, S.buckle[2]); put(sp, 16, hip + 1, S.buckle[1]); } return; }
    if (S.kind === "robe") { region(sp, rect(x0, hip, x1, hip), S.waist, { flat: 2 }); if (front) { put(sp, 18, hip + 1, S.waist[2]); put(sp, 18, hip + 2, S.waist[1]); put(sp, 19, hip + 3, S.waist[1]); } return; }
    region(sp, rect(x0 + (side ? 0 : 1), hip, x1 - (side ? 0 : 1), hip), S.waist, { flat: 2 });
    if (front) { put(sp, 13, hip + 1, S.waist[1]); put(sp, 13, hip + 2, S.waist[0]); }
  }
  function torso(sp, S, P, drawing, X, front) {
    const hip = P.hip, t0 = hip - 7, side = drawing === "side", back = drawing === "up" || P.back;
    if (side) {
      if (S.kind === "cloth") region(sp, rect(9 + X, t0 + 1, 11 + X, hip + 3), dark(S.cape));          // the elf's cloak hangs behind
      if (S.kind === "rags") region(sp, ell(11.5 + X, t0 + 1.5, 2.5, 2.2), S.torso);                  // the wretch's hunched back
      const x0 = S.kind === "fur" ? 10 + X : 11 + X, x1 = S.kind === "fur" ? 20 + X : 19 + X;
      region(sp, rect(x0, t0, x1, hip - 1), S.torso);
      if (S.tabard) region(sp, rect(13 + X, t0, 18 + X, hip - 1), S.tabard);
      return;
    }
    const x0 = S.kind === "fur" ? 9 : S.kind === "cloth" ? 11 : 10, x1 = S.kind === "fur" ? 22 : S.kind === "cloth" ? 20 : 21;
    if (S.kind === "cloth" && !back) { region(sp, rect(10, t0 + 1, 10, hip + 2), dark(S.cape)); region(sp, rect(21, t0 + 1, 21, hip + 2), dark(S.cape)); }
    region(sp, rect(x0, t0, x1, hip - 1), back && S.kind === "cloth" ? S.cape : S.torso);
    if (S.kind === "cloth" && back) region(sp, rect(10, t0, 21, hip + 3), S.cape);                   // the cloak down the elf's back
    if (S.kind === "cloth" && !back) { put(sp, 15, t0, P_.skin[1]); put(sp, 16, t0, P_.skin[1]); put(sp, 15, t0 + 1, P_.skin[0]); put(sp, 16, t0 + 1, P_.skin[2]); }   // the tunic's neck
    if (S.kind === "rags") { put(sp, 12, t0 + 3, P_.leather[2]); put(sp, 13, t0 + 3, P_.leather[3]); put(sp, 12, t0 + 4, P_.leather[1]); put(sp, 13, t0 + 4, P_.leather[2]); put(sp, 19, t0 + 5, P_.wood[2]); put(sp, 19, t0 + 6, P_.wood[1]); }   // patches
    if (S.kind === "fur" && S.hero === "sasquatch" && !back) region(sp, rect(13, t0 + 1, 18, t0 + 5), [P_.bark[1], P_.bark[2], P_.bark[2], P_.bark[3]]);   // the paler chest
    if (S.tabard) region(sp, rect(12, t0, 19, hip - 1), S.tabard);
  }
  function shoulders(sp, S, P, drawing, X) {
    const t0 = P.hip - 7, side = drawing === "side";
    if (S.kind === "fur") { if (side) region(sp, ell(14.5 + X, t0 + 1, 3.8, 2.8), S.shoulder); else { region(sp, ell(9, t0 + 1, 3.6, 2.8), S.shoulder); region(sp, ell(22, t0 + 1, 3.6, 2.8), S.shoulder); } return; }
    if (side) { region(sp, ell(14.5 + X, t0 + 1, 2.6, 2), S.shoulder); return; }
    region(sp, ell(9.5, t0 + 1, 2.4, 1.9), S.shoulder); region(sp, ell(21.5, t0 + 1, 2.4, 1.9), S.shoulder);
  }

  // ------------------------------------------------------------------ the heads (h0: the helm's top row; 9 rows, its crest above)
  function head(sp, S, P, drawing) {
    const side = drawing === "side", back = drawing === "up" || P.back, X = P.lean || 0;
    let [hx, hy] = P.head || [0, 0];
    if (S.hero === "wretch") { hy += 1; if (side) hx += 1; }   // the wretch's hunch: the head low, and forward from the side
    if (S.hero === "sasquatch") hy += 1;                        // the sasquatch has no neck: the head sunk between the shoulders
    const h0 = P.hip - 7 - 9 + hy, up = P.plume === "up";
    const fn = HEADS[S.hero]; fn(sp, S, side ? X + hx : hx, h0, side, back, up);
  }
  const HEADS = {
    elf(sp, S, x, h0, side, back, up) {
      const H = P_.hair, SK = P_.skin;
      if (side) {
        // the hair down the back (or streaming up), the head, the face to the right, the ear pointing back and up
        if (up) region(sp, or(rect(10 + x, h0 - 2, 12 + x, h0 + 3), ell(11 + x, h0 - 2, 1.5, 1.5)), H);
        else region(sp, rect(10 + x, h0 + 3, 13 + x, h0 + 11), H);
        region(sp, or(rect(11 + x, h0 + 1, 19 + x, h0 + 8), ell(15 + x, h0 + 2, 4.5, 2.4)), H);
        region(sp, rect(15 + x, h0 + 3, 19 + x, h0 + 8), SK);
        put(sp, 20 + x, h0 + 5, SK[1]); put(sp, 20 + x, h0 + 6, SK[0]);   // the nose
        fill(sp, 15 + x, h0 + 2, 19 + x, h0 + 2, H[2]); put(sp, 15 + x, h0 + 3, H[1]); put(sp, 16 + x, h0 + 3, H[1]);   // the fringe
        put(sp, 18 + x, h0 + 5, OUT); put(sp, 18 + x, h0 + 4, H[0]);   // the eye under its brow
        put(sp, 19 + x, h0 + 7, SK[0]);   // the mouth
        put(sp, 19 + x, h0 + 8, SK[0]);
        for (let k = 0; k <= 5; k++) { put(sp, 14 - k + x, h0 + 6 - k, SK[k < 2 ? 0 : 1]); put(sp, 14 - k + x, h0 + 5 - k, SK[2]); }   // the long ear, back and up out of the hair
        put(sp, 8 + x, h0, SK[2]);
        return;
      }
      if (back) {
        region(sp, or(rect(11 + x, h0 + 1, 20 + x, h0 + 11), ell(15.5 + x, h0 + 2, 5, 2.4)), H);
        for (let y = h0 + 4; y <= h0 + 11; y++) put(sp, 15 + x + ((y & 1) ? 1 : 0), y, H[0]);   // a parting of the long hair
      } else {
        region(sp, rect(10 + x, h0 + 3, 21 + x, h0 + 10), H);                                   // the long hair either side
        region(sp, or(rect(11 + x, h0 + 1, 20 + x, h0 + 4), ell(15.5 + x, h0 + 2, 5, 2.4)), H);
        region(sp, or(rect(12 + x, h0 + 4, 19 + x, h0 + 8), rect(13 + x, h0 + 9, 18 + x, h0 + 9)), SK);
        fill(sp, 12 + x, h0 + 3, 19 + x, h0 + 3, H[2]); put(sp, 12 + x, h0 + 4, H[1]); put(sp, 19 + x, h0 + 4, H[1]);   // the fringe
        put(sp, 13 + x, h0 + 6, OUT); put(sp, 18 + x, h0 + 6, OUT); put(sp, 13 + x, h0 + 5, SK[0]); put(sp, 18 + x, h0 + 5, SK[0]);   // eyes and brows
        put(sp, 15 + x, h0 + 8, SK[0]); put(sp, 16 + x, h0 + 8, SK[0]);   // the mouth
      }
      // the ears: long, pointed, out and up from either side of the head, through the hair
      for (const s of [-1, 1]) { const ex = s < 0 ? 11 + x : 20 + x; for (const [d, dy, c] of [[0, 5, 1], [1, 5, 1], [1, 4, 2], [2, 4, 1], [3, 3, 2], [4, 2, 1], [2, 5, 0]]) put(sp, ex + s * d, h0 + dy, SK[c]); }
    },
    wizard(sp, S, x, h0, side, back, up) {
      const HAT = S.hat, B = P_.beard, SK = P_.skin, G = P_.gold;
      const tipBack = side ? -1 : 1;   // the tip folds toward the back from the side, to the right from the front
      if (side) {
        region(sp, rect(11 + x, h0 + 4, 14 + x, h0 + 9), B);                                    // the hair under the brim at the back
        region(sp, rect(15 + x, h0 + 4, 19 + x, h0 + 8), SK);
        put(sp, 20 + x, h0 + 6, SK[1]); put(sp, 21 + x, h0 + 6, SK[0]); put(sp, 20 + x, h0 + 5, SK[2]);   // the long nose
        fill(sp, 17 + x, h0 + 4, 19 + x, h0 + 4, B[2]); put(sp, 18 + x, h0 + 5, OUT);           // the brow and the eye
        region(sp, or(rect(16 + x, h0 + 7, 20 + x, h0 + 10), rect(16 + x, h0 + 11, 19 + x, h0 + 12), rect(17 + x, h0 + 13, 18 + x, h0 + 14)), B);   // the beard
      } else if (!back) {
        region(sp, or(rect(12 + x, h0 + 4, 19 + x, h0 + 8)), SK);
        fill(sp, 12 + x, h0 + 4, 14 + x, h0 + 4, B[2]); fill(sp, 17 + x, h0 + 4, 19 + x, h0 + 4, B[2]);
        put(sp, 13 + x, h0 + 5, OUT); put(sp, 18 + x, h0 + 5, OUT); put(sp, 15 + x, h0 + 6, SK[2]); put(sp, 16 + x, h0 + 6, SK[0]);
        region(sp, or(rect(12 + x, h0 + 7, 19 + x, h0 + 10), rect(13 + x, h0 + 11, 18 + x, h0 + 12), rect(14 + x, h0 + 13, 17 + x, h0 + 14)), B);   // moustache and beard
        put(sp, 15 + x, h0 + 8, B[0]); put(sp, 16 + x, h0 + 8, B[0]);
      } else region(sp, rect(12 + x, h0 + 4, 19 + x, h0 + 10), B);                              // white hair from behind
      // the hat: a wide brim, a cone that leans and folds at its tip, a gold band
      const bx0 = side ? 9 + x : 8 + x, bx1 = side ? 22 + x : 23 + x;
      region(sp, ell((bx0 + bx1) / 2, h0 + 3, (bx1 - bx0) / 2 + 0.5, 1.2), HAT);
      const lean = side ? -0.5 : 0.25, top = up ? h0 - 4 : h0 - 3;   // (build 36: two rows shorter than the sketch's cone, so the folded tip fits the grid standing; the knight's plume is cut the same way only on the rise and the leap)
      const cone = (xx, yy) => { if (yy < top || yy > h0 + 2) return false; const k = (h0 + 2 - yy) / (h0 + 2 - top), c = 15.5 + x + lean * (h0 + 2 - yy), w = 4.6 * (1 - k) + 0.6; return Math.abs(xx - c) <= w; };
      region(sp, cone, HAT);
      region(sp, rect(11 + x + (side ? -1 : 0), h0 + 1, 20 + x + (side ? -1 : 0), h0 + 1), G, { flat: 2 });   // the band
      if (S.band) region(sp, rect(11 + x + (side ? -1 : 0), h0 + 1, 20 + x + (side ? -1 : 0), h0 + 1), S.band, { flat: 1 });
      const tx = Math.round(15.5 + x + lean * (h0 + 2 - top)), ty = top;
      put(sp, tx, ty - 1, HAT[2]); put(sp, tx + tipBack, ty - 1, HAT[1]); put(sp, tx + 2 * tipBack, ty, HAT[1]); put(sp, tx + 2 * tipBack, ty + 1, HAT[0]);   // the tip, folded over
      if (!back && !side) { put(sp, 14 + x, h0 - 1, G[3]); put(sp, 13 + x, h0 - 1, G[2]); put(sp, 14 + x, h0 - 2, G[2]); put(sp, 15 + x, h0 - 1, G[2]); put(sp, 14 + x, h0, G[2]); }   // a gold star
    },
    wretch(sp, S, x, h0, side, back, up) {
      const HD = S.hood, D = P_.shadow, EYE = "#fffaf0";
      if (side) {
        region(sp, or(rect(10 + x, h0 + 1, 19 + x, h0 + 9), rect(9 + x, h0 + 3, 9 + x, h0 + 10), ell(14 + x, h0 + 2, 5, 2.5)), HD);   // the hood, its back fallen to the shoulders
        region(sp, or(rect(16 + x, h0 + 4, 19 + x, h0 + 8), rect(17 + x, h0 + 3, 19 + x, h0 + 3)), D);
        put(sp, 18 + x, h0 + 6, EYE); put(sp, 19 + x, h0 + 6, "#c0cbdc");
        // the hood's point, flopping back (up when the pose streams)
        if (up) { put(sp, 11 + x, h0, HD[1]); put(sp, 11 + x, h0 - 1, HD[2]); put(sp, 10 + x, h0 - 2, HD[1]); }
        else { put(sp, 10 + x, h0 + 1, HD[1]); put(sp, 9 + x, h0 + 2, HD[1]); put(sp, 8 + x, h0 + 3, HD[2]); put(sp, 9 + x, h0 + 1, HD[2]); }
        return;
      }
      region(sp, or(rect(10 + x, h0 + 2, 21 + x, h0 + 9), ell(15.5 + x, h0 + 2.5, 5.6, 2.8)), HD);
      if (!back) {
        region(sp, or(ell(15.5 + x, h0 + 6, 3.2, 2.6), rect(13 + x, h0 + 4, 18 + x, h0 + 8)), D);
        put(sp, 14 + x, h0 + 6, EYE); put(sp, 17 + x, h0 + 6, EYE); put(sp, 14 + x, h0 + 7, "#4a3f66"); put(sp, 17 + x, h0 + 7, "#4a3f66");
      } else for (let y = h0 + 3; y <= h0 + 9; y++) put(sp, 15 + x, y, HD[0]);
      if (up) { put(sp, 16 + x, h0, HD[1]); put(sp, 16 + x, h0 - 1, HD[2]); put(sp, 17 + x, h0 - 2, HD[1]); }
      else { put(sp, 16 + x, h0, HD[2]); put(sp, 17 + x, h0, HD[1]); put(sp, 18 + x, h0 + 1, HD[1]); }
    },
    yeti(sp, S, x, h0, side, back, up) {
      const C = S.coat, F = S.face, W = "#ffffff";
      if (side) {
        // a round head on the shoulders, no neck; the blue face at the front, the brow's fur over the eye, the jaw open on a fang
        region(sp, or(ell(15 + x, h0 + 4.5, 5.6, 5), rect(10 + x, h0 + 5, 20 + x, h0 + 9)), C);
        if (!back) {
          region(sp, or(ell(18.6 + x, h0 + 6, 2.6, 2.8), rect(18 + x, h0 + 4, 21 + x, h0 + 8)), F);
          fill(sp, 17 + x, h0 + 3, 20 + x, h0 + 3, C[2]); put(sp, 21 + x, h0 + 3, C[1]); put(sp, 18 + x, h0 + 4, C[1]);   // the brow
          put(sp, 19 + x, h0 + 5, OUT); put(sp, 19 + x, h0 + 4, F[0]);
          fill(sp, 19 + x, h0 + 7, 21 + x, h0 + 7, OUT); put(sp, 20 + x, h0 + 8, W);                         // the mouth and a fang
        }
      } else {
        region(sp, or(ell(15.5 + x, h0 + 4.5, 6.6, 5.2), rect(9 + x, h0 + 5, 22 + x, h0 + 9)), C);
        if (!back) {
          region(sp, or(ell(15.5 + x, h0 + 6.5, 4.6, 3.1), rect(12 + x, h0 + 5, 19 + x, h0 + 8)), F);
          // the brow's fur comes down in a point between the eyes
          fill(sp, 11 + x, h0 + 4, 20 + x, h0 + 4, C[2]); put(sp, 15 + x, h0 + 5, C[1]); put(sp, 16 + x, h0 + 5, C[1]);
          put(sp, 13 + x, h0 + 5, OUT); put(sp, 18 + x, h0 + 5, OUT); put(sp, 13 + x, h0 + 6, OUT); put(sp, 18 + x, h0 + 6, OUT);   // the eyes
          fill(sp, 13 + x, h0 + 8, 18 + x, h0 + 8, OUT); fill(sp, 14 + x, h0 + 9, 17 + x, h0 + 9, OUT);                             // the wide mouth
          put(sp, 13 + x, h0 + 9, W); put(sp, 18 + x, h0 + 9, W); put(sp, 15 + x, h0 + 7, F[0]); put(sp, 16 + x, h0 + 7, F[0]);    // the fangs; the nose
        }
      }
      // the tuft on top, streaming up when the pose says so
      const tx = side ? 14 + x : 15 + x;
      for (const [dx, dy] of up ? [[0, -1], [0, -2], [1, -2], [1, -3], [-2, -1], [2, -1]] : [[0, -1], [1, -1], [1, -2], [-2, 0], [-2, -1], [3, 0], [3, -1]]) put(sp, tx + dx, h0 + dy, C[(dx + dy) & 1 ? 2 : 1]);
    },
    sasquatch(sp, S, x, h0, side, back, up) {
      const C = S.coat, F = S.face;
      if (side) {
        // a peaked head sunk in the shoulders, the pale face jutting forward under a heavy brow
        region(sp, or(ell(14.5 + x, h0 + 4, 5, 4.6), rect(10 + x, h0 + 4, 19 + x, h0 + 9)), C);
        region(sp, or(rect(16 + x, h0 + 4, 20 + x, h0 + 9), rect(21 + x, h0 + 6, 21 + x, h0 + 8)), F);
        fill(sp, 16 + x, h0 + 3, 21 + x, h0 + 3, C[0]); put(sp, 21 + x, h0 + 4, C[0]);           // the brow ridge
        put(sp, 19 + x, h0 + 4, OUT); put(sp, 20 + x, h0 + 6, F[0]); fill(sp, 19 + x, h0 + 8, 21 + x, h0 + 8, OUT);
      } else {
        region(sp, or(ell(15.5 + x, h0 + 4, 6.2, 4.8), rect(10 + x, h0 + 4, 21 + x, h0 + 9)), C);
        if (!back) {
          region(sp, or(rect(12 + x, h0 + 4, 19 + x, h0 + 9), rect(13 + x, h0 + 10, 18 + x, h0 + 10)), F);
          fill(sp, 11 + x, h0 + 3, 20 + x, h0 + 3, C[0]); fill(sp, 12 + x, h0 + 4, 19 + x, h0 + 4, C[1]);   // the heavy brow
          put(sp, 13 + x, h0 + 5, OUT); put(sp, 18 + x, h0 + 5, OUT); put(sp, 14 + x, h0 + 5, F[2]); put(sp, 17 + x, h0 + 5, F[2]);
          put(sp, 15 + x, h0 + 7, F[0]); put(sp, 16 + x, h0 + 7, F[0]); put(sp, 15 + x, h0 + 6, F[2]); put(sp, 16 + x, h0 + 6, F[1]);   // the broad nose
          fill(sp, 13 + x, h0 + 9, 18 + x, h0 + 9, OUT);                                              // the wide mouth
        }
      }
      // the crest: the bigfoot's peaked crown
      const cx = side ? 13 + x : 15 + x;
      for (const [dx, dy] of up ? [[0, 0], [1, 0], [0, -1], [1, -1], [1, -2]] : [[0, -1], [1, -1], [0, -2], [-1, 0], [2, 0]]) put(sp, cx + dx, h0 + dy, C[dy < -1 ? 2 : 1]);
    }
  };

  // ------------------------------------------------------------------ the Last Army's Ram, carried (the knight's ram(), in the hero's arms)
  // the log and its iron cap as the knight's; the arms in the skin's sleeve ramp, the hands in its fist ramp; the hand is the knight's pixel
  const ramOf = pose => { const arm = pose.arm || [0, 0]; return { B: pose.bob || 0, shove: arm[0] > 1 ? 3 : arm[0] < 0 ? -3 : arm[0] > 0 ? 1 : 0, lift: arm[1] < -1 ? -1 : 0 }; };
  const log = (sp, x0, x1, y) => { region(sp, rect(x0, y, x1 - 3, y + 2), OAK, { spec: (x, yy) => yy === y && x % 5 === 2 }); region(sp, rect(x1 - 3, y - 1, x1, y + 3), IRON, { spec: (x, yy) => x === x1 - 3 && yy === y - 1 }); };
  // from the side: held level across the body, the near arm down to it, the far hand behind by the belt
  function ramSide(sp, S, pose) {
    const { B, shove, lift } = ramOf(pose), X = pose.lean || 0, y = 18 + B + lift;
    log(sp, 6 + X + shove, 26 + X + shove, y);
    const hx = 17 + X + shove;
    region(sp, rect(16 + X, 15 + B, 18 + X, y - 1), S.sleeve); region(sp, rect(hx - 1, y - 1, hx + 1, y + 1), S.fist);
    region(sp, rect(10 + X + shove, y - 1, 12 + X + shove, y + 1), dark(S.fist));
    return [hx, y];
  }
  // toward and away: the log across the body at the hips; toward, the hands on it either side of the belt
  function ramFront(sp, S, pose, hands) {
    const { B, lift } = ramOf(pose), y = 21 + B + lift;
    log(sp, 4, 27, y);
    if (!hands) return null;
    region(sp, rect(8, 20 + B, 10, y + 1), S.sleeve); region(sp, rect(21, 20 + B, 23, y + 1), S.sleeve);
    region(sp, rect(8, y, 10, y + 2), S.fist); region(sp, rect(21, y, 23, y + 2), S.fist);
    return [22, y + 1];
  }

  // ------------------------------------------------------------------ a frame of parts
  function paintParts(S, drawing, P, carry) {
    const sp = new Grid(), side = drawing === "side", X = P.lean || 0, front = drawing === "down" && !P.back, ram = carry === "ram" && P.basic && P.pose ? P.pose : null;
    for (const a of P.arms) if (a.behind) limb(sp, S, a);
    legs(sp, S, P, side);
    lower(sp, S, P, side, X);
    knees(sp, S, P);
    torso(sp, S, P, drawing, X, front);
    waist(sp, S, P, side, X, front);
    if (ram && drawing === "up") ramFront(sp, S, ram, false);   // facing away the log is in front of the hero, so behind its arms on the screen
    for (const a of P.arms) if (!a.behind && !a.over) limb(sp, S, a);
    shoulders(sp, S, P, drawing, X);
    head(sp, S, P, drawing);
    let hand = P.hand;
    if (ram && side) hand = ramSide(sp, S, ram);   // the near arm reaches down to the log in place of the hanging arm
    else for (const a of P.arms) if (a.over) limb(sp, S, a);
    if (ram && drawing === "down") hand = ramFront(sp, S, ram, true);
    if (S.kind === "fur") shag(sp, S.coat);
    trim(sp); outline(sp);
    sp.hand = hand;
    return sp;
  }
  // the crawl from the side (the knight's drawProne's places), and lying flat (drawLying's), in a hero's shapes
  function paintProne(S, r) {
    const P = { hip: 21, lean: 0, skirt: 3, legs: [], arms: [], hand: r ? [24, 28] : [20, 28] };
    const sp = new Grid(), far = dark(S.leg);
    region(sp, rect(8, 22, 10, 28), far); region(sp, rect(3, 28, 9, 29), far); region(sp, rect(1, 29, 3, 30), dark(S.foot), { flat: 1 });
    region(sp, rect(16, 20, 18, 27), dark(S.sleeve)); region(sp, rect(16, 28, 18, 29), dark(S.fist));
    region(sp, rect(11, 21, 18, 25), S.lower);
    region(sp, rect(10 + 2 * r, 22, 12 + 2 * r, 28), S.leg); region(sp, rect(5 + 2 * r, 29, 11 + 2 * r, 30), S.leg); region(sp, rect(3 + 2 * r, 29, 5 + 2 * r, 30), S.foot);
    region(sp, rect(9, 17, 19, 22), S.torso);
    if (S.kind === "cloth") region(sp, rect(9, 16, 18, 18), S.cape);
    if (r) { region(sp, rect(20, 20, 22, 24), S.sleeve); region(sp, rect(22, 24, 24, 27), S.sleeve); region(sp, rect(23, 28, 25, 29), S.fist); }
    else { region(sp, rect(19, 20, 21, 27), S.sleeve); region(sp, rect(19, 28, 22, 29), S.fist); }
    // the head leading, low: a hero's side head moved down and forward
    head(sp, S, Object.assign(P, { head: [8, 9] }), "side");
    if (S.kind === "fur") shag(sp, S.coat);
    trim(sp); outline(sp); sp.hand = P.hand; return sp;
  }
  function paintLying(S) {
    const sp = new Grid();
    region(sp, rect(8, 21, 10, 29), dark(S.sleeve));
    region(sp, rect(22, 23, 27, 25), dark(S.leg)); region(sp, rect(22, 27, 27, 29), dark(S.leg));
    region(sp, rect(20, 24, 29, 26), S.leg); region(sp, rect(29, 23, 30, 27), S.foot);
    region(sp, rect(27, 27, 29, 29), S.leg); region(sp, rect(29, 28, 30, 30), S.foot, { flat: 1 });
    region(sp, rect(10, 21, 20, 29), S.torso);
    region(sp, rect(19, 22, 21, 29), S.lower);
    if (S.tabard) region(sp, rect(11, 23, 21, 28), S.tabard);
    region(sp, rect(13, 25, 20, 27), S.sleeve); region(sp, rect(20, 26, 22, 28), S.fist);
    LYING[S.hero](sp, S);   // the head at the left, the crown toward the edge, the face to the sky, inside rows 21 to 29 (12 rows in all, as the knight's)
    if (S.kind === "fur") shag(sp, S.coat);
    trim(sp); outline(sp); sp.hand = [21, 27]; return sp;
  }
  // the heads lying down: x 1 to 10, rows 21 to 29; the face on the upper side, the back of the head on the ground
  const LYING = {
    elf(sp) {
      const H = P_.hair, SK = P_.skin;
      region(sp, or(ell(5.5, 25.5, 4.2, 4), rect(1, 26, 9, 29)), H);                 // the hair spread on the ground
      region(sp, or(ell(6.5, 23.6, 3.2, 2.4), rect(5, 22, 9, 24)), SK);
      put(sp, 6, 23, OUT); put(sp, 7, 23, OUT); put(sp, 9, 22, SK[2]); put(sp, 9, 21, SK[1]);   // the eye shut; the nose
      put(sp, 3, 22, SK[1]); put(sp, 2, 21, SK[2]); put(sp, 3, 21, SK[1]); put(sp, 1, 21, SK[2]);   // the ear, out along the ground
    },
    wizard(sp, S) {
      const B = P_.beard, SK = P_.skin, HAT = S.hat, G = P_.gold;
      region(sp, or(rect(1, 25, 4, 27), rect(3, 24, 4, 28)), HAT);                    // the hat, still on, its cone along the ground
      region(sp, rect(4, 22, 5, 29), HAT, { flat: 1 }); region(sp, rect(5, 23, 5, 28), G, { flat: 2 });
      region(sp, rect(6, 23, 9, 28), B);                                              // white hair under the brim
      region(sp, rect(6, 22, 9, 25), SK); put(sp, 7, 23, OUT); put(sp, 9, 21, SK[2]); put(sp, 8, 21, SK[1]);
      region(sp, or(rect(8, 24, 10, 26), rect(10, 22, 11, 25)), B);                  // the beard over the chest
    },
    wretch(sp, S) {
      const HD = S.hood, D = P_.shadow;
      region(sp, or(ell(5.5, 25, 4.5, 4), rect(2, 24, 10, 29)), HD);
      region(sp, or(ell(7, 23.6, 2.6, 2), rect(6, 22, 9, 24)), D);
      put(sp, 7, 23, "#fffaf0"); put(sp, 1, 27, HD[1]); put(sp, 1, 28, HD[2]);       // one eye; the hood's point
    },
    yeti(sp, S) {
      const C = S.coat, F = S.face;
      region(sp, or(ell(5.5, 25.5, 4.6, 4), rect(1, 26, 10, 29)), C);
      region(sp, or(ell(6.5, 23.4, 3, 2), rect(5, 22, 9, 24)), F);
      put(sp, 6, 23, OUT); put(sp, 8, 23, OUT); put(sp, 9, 22, F[2]);
      put(sp, 1, 24, C[2]); put(sp, 2, 23, C[1]);                                     // the tuft
    },
    sasquatch(sp, S) {
      const C = S.coat, F = S.face;
      region(sp, or(ell(5.5, 25.5, 4.6, 4), rect(1, 26, 10, 29)), C);
      region(sp, or(ell(6.8, 23.4, 3, 2), rect(5, 22, 9, 24)), F);
      fill(sp, 5, 22, 5, 24, C[0]); put(sp, 6, 23, OUT); put(sp, 8, 22, F[0]); put(sp, 9, 22, F[2]);
      put(sp, 1, 25, C[2]); put(sp, 1, 24, C[1]);                                     // the crest
    }
  };

  // ------------------------------------------------------------------ the frame: what proto/knight.js asks for
  // draw(hero, drawing, parts, look, carry): the grid of a frame (px, hand) for a hero painted here; null for the knight or an id this
  // file does not know (the knight draws then). parts: Knight.skeleton's ({ lying }, { prone }, or a parts list); look: the resolved look;
  // carry: "ram" on the frames that carry it
  function draw(hero, drawing, P, look, carry) {
    if (!HEADS[hero] || !P) return null;
    const S = skinOf(hero, look || {});
    if (P.lying) return paintLying(S);
    if (P.prone !== undefined) return paintProne(S, P.prone);
    return paintParts(S, drawing, P, carry);
  }
  const has = id => IDS.includes(id);
  const takesColour = id => !!TAKES[id];
  // of(record): the look of a player record (smith.js's), the knight in red by default; chosen says the record names a hero at all (one
  // this file does not know, a newer version's, counts: the player chose)
  function of(rec) {
    const hero = rec && has(rec.hero) ? rec.hero : "knight", colour = rec && COLOUR[rec.colour] ? rec.colour : "red";
    return { hero, colour, chosen: !!(rec && typeof rec.hero === "string" && rec.hero) };
  }
  // face(look): the talk box's 16 x 16 face, the crop the opening takes of the knight's front frame (columns 8 to 23, rows 0 to 15)
  function face(look) { const px = KN.frame("toward", "idle", 0, 0, look || null).px, out = []; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) out.push(px[y * N + 8 + x] || null); return out; }
  // the opening's close-up hand (proto/intro.js gauntlet): its cuff and its hand, and what is drawn on them
  function gauntlet(hero, colour) {
    const c = COLOUR[colour] || COLOUR.red;
    return { knight: { cuff: R.steel, hand: R.steel, joins: true }, elf: { cuff: P_.leaf, hand: P_.skin, band: P_.leather }, wizard: { cuff: c, hand: P_.skin, band: P_.gold },
      wretch: { cuff: c, hand: P_.wraps, wraps: true, ragged: true }, yeti: { cuff: P_.snow, hand: P_.ice, fur: true }, sasquatch: { cuff: P_.bark, hand: P_.hide, fur: true } }[hero] || null;
  }
  // paintHand(set, x, y, hero, colour, s): the close-up hand reaching in from the left, palm down, at the gauntlet's places (its cuff, the
  // back of the hand, four fingers, the thumb under), in the hero's ramps: the knight's plates and joins as the gauntlet's; a sleeve's
  // band at the cuff's edge (the elf's bracer, the wizard's gold); the wretch's bandage in stripes with a ragged cuff; fur's edge
  // roughened. set(x, y, c) paints a pixel; the outline is the caller's (the parts' union is returned as inPart)
  function paintHand(set, x, y, hero, colour, s) {
    s = s || 1; const G = gauntlet(hero, colour) || gauntlet("knight"), parts = [];
    parts.push([x - 26 * s, y - 7 * s, x - 14 * s, y + 6 * s, 1, "cuff"]);
    parts.push([x - 15 * s, y - 5 * s, x - 1, y + 4 * s, 2, "hand"]);
    const fingers = [[-5, 9], [-2, 11], [1, 10], [4, 8]];
    for (const [fy, len] of fingers) parts.push([x - 2, y + fy * s, x - 2 + len * s - (G.fur ? 1 : 0), y + (fy + 2) * s, 2, "hand"]);
    parts.push([x - 10 * s, y + 5 * s, x - 3 * s, y + 8 * s, 1, "hand"]);
    const inPart = (xx, yy) => parts.some(q => xx >= q[0] && xx <= q[2] && yy >= q[1] && yy <= q[3]);
    for (const q of parts) { const RP = q[5] === "cuff" ? G.cuff : G.hand; for (let yy = q[1]; yy <= q[3]; yy++) for (let xx = q[0]; xx <= q[2]; xx++) {
      const top = yy === q[1], left = xx === q[0], bottom = yy === q[3], right = xx === q[2];
      let c = RP[q[4]]; if (top || right) c = RP[Math.min(3, q[4] + 1)]; if (bottom || left) c = RP[Math.max(0, q[4] - 1)]; if (top && right) c = RP[3];
      if (G.wraps && q[5] === "hand" && ((xx * 2 - yy) & 3) === 0) c = RP[0];   // the bandage's turns, slanting round the hand
      set(xx, yy, c);
    } }
    if (G.joins) { for (const [fy] of fingers) { set(x + 1, y + fy * s, G.hand[0]); set(x + 1, y + (fy + 1) * s, G.hand[0]); } for (let yy = y - 7 * s; yy <= y + 6 * s; yy++) set(x - 15 * s, yy, G.hand[0]); }
    if (G.band) for (let yy = y - 7 * s; yy <= y + 6 * s; yy++) { set(x - 15 * s, yy, G.band[1]); set(x - 16 * s, yy, G.band[2]); }
    const extra = [];
    if (G.fur) for (let xx = x - 26 * s; xx <= x + 6; xx += 2) { const top = parts.filter(q => xx >= q[0] && xx <= q[2]).reduce((m, q) => Math.min(m, q[1]), 99); if (top < 99) { set(xx, top - 1, G.cuff[2]); extra.push([xx, top - 1]); } }
    if (G.ragged) for (let yy = y - 7 * s; yy <= y + 6 * s; yy += 2) { set(x - 27 * s, yy, G.cuff[1]); extra.push([x - 27 * s, yy]); }
    return (xx, yy) => inPart(xx, yy) || extra.some(e => e[0] === xx && e[1] === yy);
  }

  const api = { ids: IDS.slice(), NAMES, RAMPS: P_, COLOURS: COLOUR, SIDE, has, takesColour, of, draw, face, gauntlet, paintHand, skinOf, version: 1 };
  root.Heroes = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
