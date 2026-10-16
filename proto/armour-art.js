// FORGE FOREVER: the armour sets (design pass 47, the Armorer, with its revision 1; jumpr card t109, built as build 38 by card t113).
// The four sets Ottar sells at the Courtyard's stand, drawn on the player's hero: the Castle Plate (polished steel, gold trim, your
// colour on the badge and, in the knight's cut, on the hem), the Wizard's Robes (purple, gold edges, white stars, a cyan clasp), the
// Frost Plate (blue ice, white fur at the neck and the hem, icicles) and the Molten Plate (black rock red-hot at its edges, lava in its
// cracks and seams). A set is a look and a guard; the guard is proto/armour.js's and never reaches this file.
// Ported from the pass's sketch (docs/design/47-the-armorer.sketch.js), a first pass at the art: any set can be redrawn here without
// touching anything else, inside the knight's frame rules (tools/test-armour-art.js).
//
// The rules that keep it honest. A set is drawn on the knight's own skeleton (Knight.skeleton, design pass 46: the parts of any frame,
// the hip's row, the lean, the head's offset, the legs, the arms as boxes or slanted segments with a fist, the knees, the skirt's length,
// the plume streaming up or not, the back view), so every animation in every facing, the overlays and the carried ram come for free.
// **A set never has a helmet** (revision 1): it dresses the body below the neck, and every hero's head is its own, painted by its own
// painter in its own ramps (the knight's great helm with its plume in the player's colour through Knight.kit.helm, helmProne and
// helmLying; the elf's hair and ears, the wretch's hood, the wizard's hat and beard, the yeti's and the sasquatch's heads through
// Heroes.head and Heroes.LYING with the hero's own skin). Two cuts:
//   the knight's cut (the knight, the yeti, the sasquatch): the set's own shapes on the body below the neck, as the first draft drew
//     them (the Castle Plate's breastplate, pauldrons, faulds and greaves; the robes' mantle and robe; the Frost Plate's crystal and
//     fur; the Molten Plate's black rock and lava);
//   the hero's own cut (the elf, the wretch, the wizard): the hero's own painter (Heroes.paint) given a skin whose clothes are the
//     set's stuff (FIT), its own skin as `own` for the head, and a few marks sewn in after each slot (a badge, rims, a hem, stars, fur,
//     cracks), each painted only over a pixel its slot just painted in a garment's tone: the hero's outline is its own in every frame.
// The fist is in the knight's fist box and the hand is the knight's hand in every frame, so every weapon sits and swings from the same
// pixel, and the rules never hear of a look. ENDESGA 32 and the Things' ramps, four-tone ramps lit from the top left, a one-pixel soot
// outline, the feet on the bottom row.
//
//   ArmourArt.SETS, SET                the four sets: { id, name, kind (plate | robe: the knight's cut), its ramps }
//   ArmourArt.CUT                      the cut by hero: "knight" (knight, yeti, sasquatch) or "own" (elf, wretch, wizard)
//   ArmourArt.has(id)                  whether an id is a set drawn here
//   ArmourArt.draw(id, hero, drawing, parts, look, carry)   the frame's grid for proto/knight.js (px, hand); null for an id it does
//                                      not know, or when the heroes' painter this cut needs is missing (the hero is drawn in its own kit)
//   ArmourArt.standFrame(id)           the set on a suit stand in the yard: the knight's cut from the front, an oak finial for a head
//   ArmourArt.metal(id)                the set's metal, what the sick overlay keeps (proto/knight.js overlayPx)
//   ArmourArt.RAMPS, FIT, fit, knightCut   the ramps, the own cut's stuff by set, the two skins (for the checks)
// Plain script, defines window.ArmourArt (module.exports in node); needs proto/knight.js (build 38's kit) and proto/heroes.js before it.
(function (root) {
  "use strict";
  const K = root.Knight;
  if (!K || !K.kit || !K.skeleton) return;
  const { Grid, rect, ell, or, cap, region, outline, R } = K.kit;
  const N = K.N, OUT = K.OUT;
  const HS = () => root.Heroes || null;
  const dark = r => [r[0], r[0], r[1], r[2]];   // a ramp a step darker (heroes.js's)
  function trim(sp) { for (let k = 0; k < N; k++) { sp.set(0, k, null); sp.set(N - 1, k, null); sp.set(k, N - 1, null); } }

  // ------------------------------------------------------------------ the ramps (dark, mid, lit, glint), every tone in ENDESGA 32 or PF.RAMP
  const A_ = {
    silver: ["#5a6988", "#8b9bb4", "#c0cbdc", "#ffffff"],   // PF silver: the Castle Plate's polished steel
    steel: ["#3a4466", "#5a6988", "#8b9bb4", "#c0cbdc"],    // PF steel: its gauntlets and sabatons, a step darker
    gold: ["#be4a2f", "#f77622", "#feae34", "#fee761"],     // PF gold: the trim
    iron: ["#262b44", "#3a4466", "#5a6988", "#8b9bb4"],     // PF iron: the belt
    violet: ["#2f2a45", "#68386c", "#b55088", "#f6757a"],   // the robes (pass 46's purple)
    plum: ["#231b33", "#2f2a45", "#68386c", "#b55088"],     // the robes a step darker: a cloak in the hero's own cut
    dusk: ["#231b33", "#2f2a45", "#4a3f66", "#68386c"],     // the robes' mantle, gloves and slippers (PF obsidian's dark three)
    crystal: ["#124e89", "#0099db", "#2ce8f5", "#ffffff"],  // PF crystal: the Frost Plate
    deep: ["#262b44", "#124e89", "#0099db", "#2ce8f5"],     // its gauntlets, boots and far limbs
    glass: ["#0099db", "#2ce8f5", "#b8f4ff", "#ffffff"],    // PF ice-glass: the icicles
    snow: ["#8b9bb4", "#c0cbdc", "#ffffff", "#ffffff"],     // the white fur at the neck and the hem
    basalt: ["#231b33", "#3e2731", "#a22633", "#f77622"],   // the Molten Plate: black rock, red-hot at its lit edges
    cinder: ["#181425", "#231b33", "#3e2731", "#a22633"],   // its gauntlets, boots and far limbs
    ember: ["#a22633", "#f77622", "#feae34", "#fee761"],    // PF ember's hot end: the seams and the cracks
    leather: ["#2a1d28", "#3e2731", "#733e39", "#b86f50"],
    red: ["#a22633", "#e43b44", "#f6757a", "#ffd0c8"]       // the knight's crimson (the colour's default)
  };
  const STAR = "#ffffff", STAR2 = "#c0cbdc";               // the stars sewn on the robes
  const GEM = "#2ce8f5", GEM2 = "#0099db";                 // the robes' arcane glow: a clasp at the collar

  // ------------------------------------------------------------------ the four sets, and their stuff in each cut
  // the knight's cut, kind plate: plates over the body (the torso, the pauldrons, the faulds over the hips, greaves, gauntlets, sabatons);
  // kind robe: a robe to the ankles, bell sleeves, a mantle over the shoulders, gloves, slippers. Never a helm: the head is the hero's
  const SETS = [
    { id: "plate", name: "Castle Plate", kind: "plate", plate: A_.silver, far: A_.steel, fist: A_.steel, foot: A_.steel, belt: A_.iron, trim: A_.gold, hem: "colour" },
    { id: "robes", name: "Wizard's Robes", kind: "robe", plate: A_.violet, far: dark(A_.violet), fist: A_.dusk, foot: A_.dusk, belt: A_.gold, trim: A_.gold, hem: null },
    { id: "frost", name: "Frost Plate", kind: "plate", plate: A_.crystal, far: A_.deep, fist: A_.deep, foot: A_.deep, belt: A_.deep, trim: A_.snow, hem: A_.snow },
    { id: "molten", name: "Molten Plate", kind: "plate", plate: A_.basalt, far: A_.cinder, fist: A_.cinder, foot: A_.cinder, belt: A_.cinder, trim: A_.ember, hem: A_.leather }
  ];
  const SET = Object.fromEntries(SETS.map(s => [s.id, s]));
  // the hero's own cut: the set's stuff for each of a hero's garments (main: a tunic, a robe, a cloak; cloak: the elf's cloak, a step
  // darker; leg and foot: leggings, boots and shoes; belt, buckle, cord (the wizard's), rope (the wretch's); cuff: the elf's bracer;
  // trim: the wizard's cuffs and every set's rims; hem: the garment's bottom row (the Castle Plate's gold here: your colour is its badge);
  // patch, patch2: the wretch's patches, re-made)
  const FIT = {
    plate: { main: A_.silver, cloak: A_.steel, leg: A_.steel, foot: A_.iron, belt: A_.iron, buckle: A_.gold, cord: A_.gold, rope: A_.iron, cuff: A_.steel, trim: A_.gold, hem: A_.gold, patch: A_.steel, patch2: A_.iron },
    robes: { main: A_.violet, cloak: A_.plum, leg: A_.dusk, foot: A_.dusk, belt: A_.gold, buckle: A_.gold, cord: A_.gold, rope: A_.gold, cuff: A_.gold, trim: A_.gold, hem: A_.gold, patch: A_.plum, patch2: A_.gold },
    frost: { main: A_.crystal, cloak: A_.deep, leg: A_.deep, foot: A_.deep, belt: A_.deep, buckle: A_.glass, cord: A_.snow, rope: A_.snow, cuff: A_.snow, trim: A_.snow, hem: A_.snow, patch: A_.glass, patch2: A_.deep },
    molten: { main: A_.basalt, cloak: A_.cinder, leg: A_.cinder, foot: A_.cinder, belt: A_.cinder, buckle: A_.ember, cord: A_.ember, rope: A_.ember, cuff: A_.ember, trim: A_.ember, hem: A_.ember, patch: A_.cinder, patch2: A_.ember }
  };
  const CUT = { knight: "knight", yeti: "knight", sasquatch: "knight", elf: "own", wretch: "own", wizard: "own" };

  // ------------------------------------------------------------------ painting helpers
  const at = (sp, x, y) => sp.get(x, y);
  const put = (sp, x, y, c) => sp.set(x, y, c);
  const putOn = (sp, x, y, c) => { if (at(sp, x, y) && at(sp, x, y) !== OUT) put(sp, x, y, c); };   // only over the body
  const fill = (sp, x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(sp, x, y, c); };
  const limbShape = (a, widen) => a.seg ? cap(a.seg[0], a.seg[1], a.seg[2], a.seg[3], (a.w || 1.3) + (widen || 0)) : rect(a.x0, a.y0, a.x1, a.y1);
  // the bottom row of a region's pixels in a box, as a list (a pauldron's rim)
  function rimOf(sp, x0, x1, y0, y1, set) { const out = []; for (let x = x0; x <= x1; x++) for (let y = y1; y >= y0; y--) { const c = at(sp, x, y); if (c && set.includes(c)) { out.push([x, y]); break; } } return out; }

  // ================================================================== THE KNIGHT'S CUT (the knight, the yeti, the sasquatch)
  // The set's body, the head the hero's own (for the knight, its own great helm and plume)
  function skinOf(setId, hero, L, colour) {
    const S0 = SET[setId], H = HS();
    return Object.assign({}, S0, { colour, hemRamp: S0.hem === "colour" ? colour : S0.hem, hero, own: hero === "knight" || !H ? null : H.skinOf(hero, L), plume: L.plume, band: L.band || null,
      sleeve: S0.plate, leg: S0.plate, lower: S0.plate, torso: S0.plate, shoulder: S0.plate });
  }
  function limb(sp, S, a) {
    const far = !!a.far, r = far ? S.far : S.sleeve;
    if (S.kind === "robe") region(sp, a.seg ? cap(a.seg[0], a.seg[1], a.seg[2], a.seg[3], 1.4) : rect(a.x0, a.y0, a.x1, a.y1), r);
    else region(sp, limbShape(a), r);
    if (a.fist) {
      const [x0, y0, x1, y1] = a.fist;
      if (S.kind === "robe" && !a.seg && !a.out) { region(sp, rect(x0 - 1, y0 - 1, x1 + 1, y0), far ? dark(S.sleeve) : S.sleeve, { flat: 1 }); region(sp, rect(x0 - 1, y0, x1 + 1, y0), S.trim, { flat: far ? 1 : 2 }); }   // the bell sleeve's gold cuff
      region(sp, rect(x0, y0, x1, y1), far ? dark(S.fist) : S.fist);
      if (S.id === "molten" && !far && !a.out) put(sp, x0 + 1, y0, S.trim[1]);   // a seam glowing at the wrist
    }
    // the elbow's cop on a plate arm hanging straight: one glint at its middle
    if (S.kind === "plate" && !far && !a.seg && !a.out && a.y1 - a.y0 >= 4) put(sp, Math.round((a.x0 + a.x1) / 2), a.y0 + 2, S.plate[3]);
  }
  function legs(sp, S, P, side) {
    for (const g of P.legs) {
      const far = !!g.far, r = far ? S.far : S.leg, fr = far ? dark(S.foot) : S.foot;
      if (S.kind === "robe") region(sp, rect(g.x - 1, g.y0, g.x + 3, g.y1 - 1), far ? dark(S.lower) : S.lower);
      else {
        region(sp, rect(g.x, g.y0, g.x + 2, g.y1), r);
        if (!far && g.y1 - g.y0 >= 4) {
          put(sp, g.x + 1, g.y0 + 1, S.plate[3]);                                                         // the knee's cop
          if (S.id === "molten") for (let y = g.y0 + 3; y < g.y1; y += 2) put(sp, g.x + 1, y, S.trim[(y >> 1) & 1 ? 1 : 2]);   // the shin's seam, glowing
          if (S.id === "frost") put(sp, g.x + 2, g.y0 + 3, A_.glass[3]);
        }
      }
      if (g.boot) {
        const b0 = g.boot[0], b1 = g.boot[1];
        region(sp, rect(b0, g.y1, b1, g.y1 + 1), fr, far ? { flat: 1 } : undefined);
        if (S.kind === "robe" && side) put(sp, b1 + 1, g.y1 + 1, fr[1]);                                   // the slipper's toe
      }
      if (g.shin) region(sp, rect(g.shin[0], g.shin[1], g.shin[2], g.shin[3]), r);
    }
  }
  function lower(sp, S, P, side, X) {
    const hip = P.hip, skirt = P.skirt || 4, sx0 = side ? 11 + X : 11, sx1 = side ? 19 + X : 20;
    if (S.kind === "robe") {
      region(sp, rect(sx0 - 1, hip + 1, sx1 + 1, hip + skirt), S.lower);
      // standing, the robe falls to the ankles in one piece over both legs (pass 46's wizard's rule); striding, it parts round them
      if (P.basic || P.legs.every(g => g.y1 >= 29 && g.y0 >= 23)) {
        const lx0 = Math.min(...P.legs.map(g => g.x)) - 1, lx1 = Math.max(...P.legs.map(g => g.x)) + 3, y1 = Math.min(...P.legs.map(g => g.y1)) - 1;
        region(sp, rect(Math.min(lx0, sx0 - 1), hip + 1, Math.max(lx1, sx1 + 1), y1), S.lower);
        const yb = y1; for (let x = Math.min(lx0, sx0 - 1); x <= Math.max(lx1, sx1 + 1); x++) put(sp, x, yb, S.trim[(x & 1) ? 1 : 2]);   // the gold hem
        if (!side && !P.back) { for (let y = hip + 1; y < yb; y++) put(sp, 15, y, S.trim[2]); }                                        // the front's gold edge
        for (const [sx, sy, c] of [[13, hip + 3, STAR], [18, hip + 6, STAR2], [12, hip + 7, STAR2]]) putOn(sp, sx + (side ? X - 1 : 0), sy, c);   // stars
      } else for (let x = sx0 - 1; x <= sx1 + 1; x++) put(sp, x, hip + skirt, S.trim[(x & 1) ? 1 : 2]);
    } else {
      // plate: the faulds, lames of steel over the hips, each row a step darker than the one above; then the hem below them
      const fy1 = hip + Math.max(1, skirt - 2);
      for (let y = hip + 1; y <= fy1; y++) region(sp, rect(sx0, y, sx1, y), S.plate, { flat: Math.max(0, 2 - (y - hip - 1)) });
      if (S.id === "molten") for (let x = sx0 + 1; x < sx1; x += 2) put(sp, x, hip + 2, S.trim[x % 4 === 1 ? 1 : 2]);   // the glow between the lames
      const hem = S.hemRamp;
      if (hem) {
        region(sp, rect(sx0, fy1 + 1, sx1, hip + skirt), hem);
        if (S.id === "frost") { for (let x = sx0; x <= sx1; x += 3) put(sp, x, hip + skirt + 1, A_.glass[1]); }        // icicles under the white fur
      }
    }
    if (S.band) region(sp, rect(sx0, hip + skirt - 1, sx1, hip + skirt), S.band, { flat: 1 });   // (a party's seat colour, as the knight's tabard wears it)
  }
  function knees(sp, S, P) { for (const [cx, cy, rx, ry] of P.knees || []) region(sp, ell(cx, cy, rx, ry), S.kind === "robe" ? S.lower : S.leg, { spec: (x, y) => x === Math.floor(cx) - 1 && y === Math.floor(cy - ry + 0.5) }); }
  function waist(sp, S, P, side, X, front) {
    const hip = P.hip, x0 = side ? 11 + X : 10, x1 = side ? 19 + X : 21;
    if (S.kind === "robe") { region(sp, rect(x0, hip, x1, hip), S.belt, { flat: 2 }); if (front) { put(sp, 18, hip + 1, S.belt[2]); put(sp, 18, hip + 2, S.belt[1]); put(sp, 19, hip + 3, S.belt[1]); } return; }   // the gold cord, its ends hanging
    region(sp, rect(x0, hip, x1, hip), S.belt, { flat: 1 });
    if (front) { put(sp, 15, hip, S.trim[3]); put(sp, 16, hip, S.trim[2]); }                     // the buckle
    if (side) put(sp, 18 + X, hip, S.trim[2]);
  }
  function torso(sp, S, P, drawing, X, front) {
    const hip = P.hip, t0 = hip - 7, side = drawing === "side", back = drawing === "up" || P.back;
    if (side) {
      if (S.kind === "robe") region(sp, rect(10 + X, t0 + 1, 11 + X, hip + 2), dark(S.plate));   // the robe's back fold
      region(sp, rect(11 + X, t0, 19 + X, hip - 1), S.torso);
      if (S.kind === "plate") { for (let y = t0 + 1; y < hip - 1; y++) put(sp, 18 + X, y, S.plate[2]); put(sp, 18 + X, t0 + 1, S.plate[3]); }   // the breastplate's ridge, toward the front
      if (S.id === "frost") { fill(sp, 12 + X, t0, 18 + X, t0, A_.snow[1]); put(sp, 13 + X, t0, A_.snow[2]); }
      if (S.id === "molten") { put(sp, 15 + X, t0 + 2, S.trim[1]); put(sp, 16 + X, t0 + 3, S.trim[2]); put(sp, 16 + X, t0 + 4, S.trim[1]); put(sp, 15 + X, t0 + 5, S.trim[1]); }
      if (S.id === "plate") { put(sp, 16 + X, t0 + 3, S.colour[1]); put(sp, 16 + X, t0 + 4, S.colour[0]); }
      if (S.kind === "robe") { for (let y = t0 + 1; y < hip; y++) put(sp, 18 + X, y, S.trim[2]); putOn(sp, 14 + X, t0 + 3, STAR); }
      return;
    }
    region(sp, rect(10, t0, 21, hip - 1), S.torso);
    if (back) { for (let y = t0 + 1; y < hip - 1; y++) put(sp, 15, y, S.plate[0]); if (S.kind === "robe") { putOn(sp, 18, t0 + 3, STAR); putOn(sp, 12, t0 + 5, STAR2); } return; }   // the backplate's seam; a star on the robe's back
    if (S.kind === "robe") {
      for (let y = t0 + 1; y < hip; y++) put(sp, 15, y, S.trim[2]);                              // the gold edge down the front
      for (const [sx, sy, c] of [[12, t0 + 2, STAR], [19, t0 + 4, STAR2], [13, t0 + 5, STAR2]]) putOn(sp, sx, sy, c);
      return;
    }
    // the breastplate's ridge down the middle, lit on its left
    for (let y = t0 + 1; y < hip - 1; y++) { put(sp, 15, y, S.plate[2]); put(sp, 16, y, S.plate[1]); }
    put(sp, 15, t0 + 1, S.plate[3]);
    if (S.id === "plate") { put(sp, 15, t0 + 3, S.colour[2]); put(sp, 16, t0 + 3, S.colour[1]); put(sp, 15, t0 + 4, S.colour[1]); put(sp, 16, t0 + 4, S.colour[0]); }   // the badge, in the colour
    if (S.id === "frost") {
      fill(sp, 11, t0, 20, t0, A_.snow[1]); put(sp, 12, t0, A_.snow[2]); put(sp, 13, t0, A_.snow[2]);   // the white fur at the neck
      for (const [x, y] of [[12, 2], [13, 3], [14, 4], [19, 2], [18, 3], [17, 4]]) put(sp, x, t0 + y, A_.crystal[0]);   // a facet, a V cut in the crystal
    }
    if (S.id === "molten") for (const [x, y, k] of [[12, 1, 1], [13, 2, 2], [13, 3, 1], [14, 4, 2], [18, 2, 1], [19, 3, 2], [18, 4, 1], [17, 5, 1]]) put(sp, x, t0 + y, S.trim[k]);   // cracks of lava
  }
  function shoulders(sp, S, P, drawing, X) {
    const t0 = P.hip - 7, side = drawing === "side";
    if (S.kind === "robe") {
      // the mantle: a short cape over the shoulders, its edge in gold
      if (side) { region(sp, ell(14.5 + X, t0 + 1, 3.8, 2.3), A_.dusk); for (const [x, y] of rimOf(sp, 11 + X, 18 + X, t0, t0 + 4, A_.dusk)) put(sp, x, y, S.trim[1]); return; }
      region(sp, ell(15.5, t0 + 1, 7, 2.3), A_.dusk);
      for (const [x, y] of rimOf(sp, 9, 22, t0, t0 + 4, A_.dusk)) put(sp, x, y, S.trim[(x & 1) ? 1 : 2]);
      return;
    }
    const pads = side ? [[14.5 + X, 3.9]] : [[9, 3.5], [22, 3.5]];
    for (const [cx, rx] of pads) {
      region(sp, ell(cx, t0 + 1, rx, 2.7), S.shoulder, { spec: (x, y) => x === Math.floor(cx) - 1 && y === t0 });
      const rim = rimOf(sp, Math.floor(cx - rx), Math.ceil(cx + rx), t0 - 2, t0 + 4, S.shoulder);
      if (S.id === "plate") for (const [x, y] of rim) put(sp, x, y, S.trim[2]);                  // the gold rim
      if (S.id === "molten") for (const [x, y] of rim) put(sp, x, y, S.trim[(x & 1) ? 1 : 2]);    // a glowing edge
      if (S.id === "frost") {
        for (const [x, y] of rim) put(sp, x, y, A_.snow[1]);
        // icicle spikes standing up from the pauldron
        const xs = side ? [Math.round(cx) - 2, Math.round(cx) + 1] : cx < 15 ? [Math.round(cx) - 2, Math.round(cx)] : [Math.round(cx), Math.round(cx) + 2];
        for (const x of xs) { put(sp, x, t0 - 2, A_.glass[2]); put(sp, x, t0 - 3, A_.glass[3]); }
      }
    }
  }

  // ------------------------------------------------------------------ the heads: never a helm. The knight's own great helm and plume (Knight.kit.helm, helmProne and
  // helmLying: the knight's own lines, in its kit since build 38); every other hero's own head painter (Heroes.head and LYING, with the
  // hero's own skin). A suit on its stand in the yard has no hero in it: the stand's oak pole ends in a small finial at the neck
  function knob(sp, P) { const h0 = P.hip - 16; region(sp, rect(15, h0 + 6, 16, h0 + 9), R.oak, { flat: 1 }); region(sp, ell(15.5, h0 + 6, 2.1, 1.6), R.oak, { spec: (x, y) => x === 14 && y === h0 + 5 }); }
  function head(sp, S, P, drawing) {
    if (S.stand) return knob(sp, P);
    if (S.hero === "knight") return K.kit.helm(sp, drawing, P, S.plume);
    HS().head(sp, S.own, P, drawing);
  }

  // ------------------------------------------------------------------ a frame of parts, the ram, the crawl, lying (the knight's cut)
  function paintParts(S, drawing, P) {
    const sp = new Grid(), side = drawing === "side", X = P.lean || 0, front = drawing === "down" && !P.back;
    for (const a of P.arms) if (a.behind) limb(sp, S, a);
    legs(sp, S, P, side);
    lower(sp, S, P, side, X);
    knees(sp, S, P);
    torso(sp, S, P, drawing, X, front);
    waist(sp, S, P, side, X, front);
    for (const a of P.arms) if (!a.behind && !a.over) limb(sp, S, a);
    shoulders(sp, S, P, drawing, X);
    head(sp, S, P, drawing);
    for (const a of P.arms) if (a.over) limb(sp, S, a);
    trim(sp); outline(sp);
    sp.hand = P.hand;
    return sp;
  }
  // the Last Army's Ram, carried (knight.js ram()'s places): the log and its iron cap as the knight's, the arms that hold it in the
  // set's sleeve and fist; on idle, walk, wind, strike, recover and hurt (hurt with the ram is bonk's parts, as knight.js draws it).
  // P is a basic frame's parts with its pose on it (Knight.skeleton's)
  function paintRam(S, drawing, P) {
    const pose = P.pose || {}, B = pose.bob || 0, X = drawing === "side" ? (pose.lean || 0) : 0, arm = pose.arm || [0, 0];
    const sp = new Grid(), OAK = R.oak, IRON = R.iron;
    const shove = arm[0] > 1 ? 3 : arm[0] < 0 ? -3 : arm[0] > 0 ? 1 : 0, lift = arm[1] < -1 ? -1 : 0, side = drawing === "side", front = drawing === "down";
    const log = (x0, x1, y) => { region(sp, rect(x0, y, x1 - 3, y + 2), OAK, { spec: (x, yy) => yy === y && x % 5 === 2 }); region(sp, rect(x1 - 3, y - 1, x1, y + 3), IRON, { spec: (x, yy) => x === x1 - 3 && yy === y - 1 }); };
    if (drawing === "up") log(4, 27, 21 + B + lift);   // facing away, the log is in front of the knight: behind it on the screen
    legs(sp, S, P, side); lower(sp, S, P, side, X); torso(sp, S, P, drawing, X, front); waist(sp, S, P, side, X, front); shoulders(sp, S, P, drawing, X); head(sp, S, P, drawing);
    let hand;
    if (side) {
      const y = 18 + B + lift, hx = 17 + X + shove;
      log(6 + X + shove, 26 + X + shove, y);
      region(sp, rect(16 + X, 15 + B, 18 + X, y - 1), S.sleeve); region(sp, rect(hx - 1, y - 1, hx + 1, y + 1), S.fist);
      region(sp, rect(10 + X + shove, y - 1, 12 + X + shove, y + 1), dark(S.fist));
      hand = [hx, y];
    } else {
      const y = 21 + B + lift;
      if (front) { log(4, 27, y); region(sp, rect(8, 20 + B, 10, y + 1), S.sleeve); region(sp, rect(21, 20 + B, 23, y + 1), S.sleeve); region(sp, rect(8, y, 10, y + 2), S.fist); region(sp, rect(21, y, 23, y + 2), S.fist); hand = [22, y + 1]; }
      else { for (const a of P.arms) limb(sp, S, a); hand = P.hand; }   // from behind the log is held out of sight: the arms hang as ever (knight.js's own rule)
    }
    trim(sp); outline(sp); sp.hand = hand; return sp;
  }
  // the side crawl (the knight's drawProne's places)
  function paintProne(S, r) {
    const P = { hip: 21, lean: 0, skirt: 3, legs: [], arms: [], hand: r ? [24, 28] : [20, 28] };
    const sp = new Grid();
    region(sp, rect(8, 22, 10, 28), S.far); region(sp, rect(3, 28, 9, 29), S.far); region(sp, rect(1, 29, 3, 30), dark(S.foot), { flat: 1 });
    region(sp, rect(16, 20, 18, 27), S.far); region(sp, rect(16, 28, 18, 29), dark(S.fist));
    region(sp, rect(11, 21, 18, 25), S.kind === "robe" ? S.lower : S.hemRamp || S.plate);
    region(sp, rect(10 + 2 * r, 22, 12 + 2 * r, 28), S.leg); region(sp, rect(5 + 2 * r, 29, 11 + 2 * r, 30), S.leg); region(sp, rect(3 + 2 * r, 29, 5 + 2 * r, 30), S.foot);
    region(sp, rect(9, 17, 19, 22), S.torso);
    if (S.id === "molten") { put(sp, 13, 19, S.trim[1]); put(sp, 14, 20, S.trim[2]); put(sp, 16, 19, S.trim[1]); }
    if (S.id === "frost") fill(sp, 9, 17, 18, 17, A_.snow[1]);
    region(sp, rect(11, 17, 12, 23), S.belt, { flat: 2 });
    region(sp, ell(18, 18, 3, 2.2), S.kind === "robe" ? A_.dusk : S.shoulder, { spec: (x, y) => x === 17 && y === 16 });
    if (r) { region(sp, rect(20, 20, 22, 24), S.sleeve); region(sp, rect(22, 24, 24, 27), S.sleeve); region(sp, rect(23, 28, 25, 29), S.fist); }
    else { region(sp, rect(19, 20, 21, 27), S.sleeve); region(sp, rect(19, 28, 22, 29), S.fist); }
    if (S.hero === "knight") K.kit.helmProne(sp, S.plume);
    else HS().head(sp, S.own, Object.assign(P, { head: [8, 9] }), "side");
    trim(sp); outline(sp); sp.hand = P.hand; return sp;
  }
  // lying flat, beaten (drawLying's places): the body on its back, the head at the left
  function paintLying(S) {
    const sp = new Grid();
    region(sp, rect(8, 21, 10, 29), S.far);
    region(sp, rect(22, 23, 27, 25), S.far); region(sp, rect(22, 27, 27, 29), S.far);
    region(sp, rect(20, 24, 29, 26), S.leg); region(sp, rect(29, 23, 30, 27), S.foot);
    region(sp, rect(27, 27, 29, 29), S.leg); region(sp, rect(29, 28, 30, 30), S.foot, { flat: 1 });
    region(sp, rect(10, 21, 20, 29), S.torso);
    region(sp, rect(19, 22, 21, 29), S.kind === "robe" ? S.lower : S.hemRamp || S.plate);
    region(sp, rect(18, 21, 18, 30), S.belt, { flat: 2 });
    if (S.id === "molten") { put(sp, 13, 23, S.trim[1]); put(sp, 14, 24, S.trim[2]); put(sp, 15, 23, S.trim[1]); }
    if (S.id === "plate") { put(sp, 14, 23, S.colour[1]); put(sp, 15, 23, S.colour[2]); }
    region(sp, ell(12, 23, 2.4, 1.8), S.kind === "robe" ? A_.dusk : S.shoulder, { spec: (x, y) => x === 11 && y === 22 });
    region(sp, rect(13, 25, 20, 27), S.sleeve); region(sp, rect(20, 26, 22, 28), S.fist);
    if (S.hero === "knight") K.kit.helmLying(sp, S.plume);
    else HS().LYING[S.hero](sp, S.own);
    trim(sp); outline(sp); sp.hand = [21, 27]; return sp;
  }

  // ================================================================== THE HERO'S OWN CUT (the elf, the wretch, the wizard)
  // proto/heroes.js paints the hero's own frame (its shapes, its slots, its order, its outline) from a skin whose garment ramps are the
  // set's; the head, the hands and the wretch's bandaged limbs keep the hero's own. Then the marks, each painted only over the pixels
  // its slot just painted in a garment's tone (so nothing ever leaves the hero's own outline). Isaac's call 8 at its default: the
  // wretch's hood and the wizard's hat stay in the player's colour (a set never touches the head)
  function fitSkin(hero, setId, L, colour) {
    const own = HS().skinOf(hero, L), F = FIT[setId], S = Object.assign({}, own, { own, set: setId, colour, fit: F });
    if (hero === "elf") Object.assign(S, { sleeve: F.main, torso: F.main, lower: F.main, cape: F.cloak, shoulder: F.cloak, cuff: F.cuff, leg: F.leg, foot: F.foot, waist: F.belt, buckle: F.buckle });
    if (hero === "wizard") Object.assign(S, { sleeve: F.main, torso: F.main, lower: F.main, leg: F.main, shoulder: F.main, cuff: F.trim, waist: F.cord, foot: F.foot });
    if (hero === "wretch") Object.assign(S, { torso: F.main, shoulder: F.main, lower: F.main, waist: F.rope, patch: F.patch, patch2: F.patch2 });
    S.cloth = new Set(F.main.concat(F.cloak));
    S.mark = marksOf(S);
    return S;
  }
  // the marks of each set in the hero's own cut, slot by slot (heroes.js calls them after each slot: behind, legs, lower, knees, torso,
  // waist, arms, shoulders; and prone, lying before the head of the crawl and of the lying body)
  function marksOf(S) {
    const F = S.fit, id = S.set, C = S.colour, hemR = F.hem, robe = S.kind === "robe";
    let prev = null; const got = {};
    return function (slot, sp, P, drawing) {
      const cur = sp.px, mine = new Set();
      for (let k = 0; k < cur.length; k++) if (cur[k] && cur[k] !== (prev ? prev[k] : null)) mine.add(k);
      got[slot] = mine;
      const cloth = (x, y, set) => { x = Math.round(x); y = Math.round(y); if (x < 1 || y < 0 || x > N - 2 || y > N - 2) return false; const k = y * N + x; return (!set || set.has(k)) && S.cloth.has(cur[k]); };
      const on = (x, y, c, set) => { if (cloth(x, y, set || mine)) sp.set(x, y, c); };
      const side = drawing === "side", back = drawing === "up" || !!(P && P.back), front = drawing === "down" && !back, X = side && P ? (P.lean || 0) : 0;
      const t0 = P ? P.hip - 7 : 0, hip = P ? P.hip : 0;
      if (slot === "knees" && !S.band) {
        // the hem: the lowest garment pixel of each column of the lower body (the tunic's points, the robe at the ankles or at the skirt
        // when it parts round a stride, the rags' tatters), in the set's hem
        const body = new Set([...(got.lower || [])].concat(robe ? [...mine] : []));
        for (let x = 1; x < N - 1; x++) for (let y = N - 2; y > hip; y--) if (cloth(x, y, body)) { sp.set(x, y, hemR[id !== "plate" && (x & 1) ? 1 : 2]); break; }
      }
      if (slot === "lower" && id === "robes") {
        // stars on the skirt; on the wizard's robe its gold edge down the front, under the cord
        for (const [sx, sy, c] of [[13, hip + 3, STAR], [18, hip + 6, STAR2], [12, hip + 7, STAR2]]) on(sx + (side ? X - 1 : 0), sy, c);
        if (robe && front) for (let y = hip + 1; y < N - 2; y++) on(15, y, F.trim[2]);
      }
      if (slot === "torso") {
        if (id === "plate") {
          if (front) { for (let y = t0 + 2; y < hip - 1; y++) { on(15, y, F.main[2]); on(16, y, F.main[1]); } on(15, t0 + 3, C[2]); on(16, t0 + 3, C[1]); on(15, t0 + 4, C[1]); on(16, t0 + 4, C[0]); }   // the ridge, lit on its left, and the badge in the colour
          else if (side) { on(16 + X, t0 + 3, C[1]); on(16 + X, t0 + 4, C[0]); }
        }
        if (id === "robes") {
          if (front) { on(12, t0 + 2, STAR); on(19, t0 + 4, STAR2); on(13, t0 + 5, STAR2); on(15, t0 + 2, GEM); on(16, t0 + 2, GEM2); }   // stars, and the glow's clasp at the collar
          else if (side) on(14 + X, t0 + 3, STAR);
          else { on(18, t0 + 3, STAR); on(12, t0 + 5, STAR2); }
        }
        if (id === "frost") {
          // the white fur at the neck: the top row of the garment, the lit pixel at its left
          let first = true; for (let x = 1; x < N - 1; x++) for (let y = t0 - 1; y <= t0 + 1; y++) if (cloth(x, y, mine)) { sp.set(x, y, first ? A_.snow[2] : A_.snow[1]); first = false; break; }
          if (front) on(13, t0 + 2, A_.glass[3]);   // a glint
        }
        if (id === "molten") {
          const cracks = front ? [[12, 1, 1], [13, 2, 2], [14, 3, 1], [18, 2, 1], [19, 3, 2], [18, 4, 1], [17, 5, 1]] : side ? [[15, 2, 1], [16, 3, 2], [16, 4, 1], [15, 5, 1]].map(([x, y, k]) => [x + X, y, k]) : [[13, 2, 1], [12, 3, 2], [18, 3, 1], [17, 4, 2]];
          for (const [x, y, k] of cracks) on(x, t0 + y, A_.ember[k]);
        }
      }
      if (slot === "shoulders") {
        // a rim on each shoulder's lower edge, in the set's trim (gold, gold, white fur, a glowing edge)
        for (let x = 1; x < N - 1; x++) for (let y = N - 2; y >= 0; y--) if (cloth(x, y, mine)) { sp.set(x, y, id === "molten" || id === "robes" ? F.trim[(x & 1) ? 1 : 2] : id === "frost" ? A_.snow[1] : F.trim[2]); break; }
      }
      if (slot === "prone") {
        // the crawl's back: rows 17 to 22 of x 9 to 19
        if (id === "plate") { on(14, 19, C[1]); on(15, 19, C[2]); }
        if (id === "robes") { on(12, 19, STAR); on(16, 21, STAR2); }
        if (id === "frost") for (let x = 9; x <= 19; x++) for (let y = 16; y <= 18; y++) if (cloth(x, y)) { sp.set(x, y, A_.snow[1]); break; }
        if (id === "molten") { on(13, 19, A_.ember[1]); on(14, 20, A_.ember[2]); on(16, 19, A_.ember[1]); }
      }
      if (slot === "lying") {
        // on its back: the torso x 10 to 20, rows 21 to 29, the neck at the left
        if (id === "plate") { on(14, 23, C[1]); on(15, 23, C[2]); }
        if (id === "robes") { on(13, 22, STAR); on(17, 23, STAR2); }
        if (id === "frost") for (let y = 21; y <= 29; y++) on(10, y, A_.snow[(y & 1) ? 1 : 2]);
        if (id === "molten") { on(13, 23, A_.ember[1]); on(14, 24, A_.ember[2]); on(15, 23, A_.ember[1]); }
      }
      prev = sp.px.slice();
    };
  }

  // ------------------------------------------------------------------ the frame: what proto/knight.js asks for
  // draw(id, hero, drawing, parts, look, carry): the grid of a frame (px, hand) of a set on a hero; null for a set this file does not
  // know, or when the heroes' painter the cut needs is not there (an older heroes.js: the hero is drawn in its own kit). parts:
  // Knight.skeleton's ({ lying }, { prone }, or a parts list with its pose); look: the knight's resolved look; carry: "ram" on the frames
  // that carry it. A hero the art does not know is the knight, in the knight's cut with the knight's own helm
  const has = id => !!SET[id];
  function draw(id, hero, drawing, P, look, carry) {
    const S0 = SET[id]; if (!S0 || !P) return null;
    const H = HS(), L = look || {};
    if (!(H && H.has(hero))) hero = "knight";
    const colour = K.COLOURS[L.colour] || A_.red, cut = CUT[hero] || "knight";
    if (cut === "own") { if (!(H && typeof H.paint === "function" && typeof H.head === "function" && typeof H.skinOf === "function")) return null; return H.paint(fitSkin(hero, id, L, colour), drawing, P, carry); }
    if (hero !== "knight" && !(H && typeof H.head === "function" && H.LYING && typeof H.skinOf === "function")) return null;
    const S = skinOf(id, hero, L, colour), ram = carry === "ram" && P.basic && P.pose;
    return ram ? paintRam(S, drawing, P) : P.lying ? paintLying(S) : P.prone !== undefined ? paintProne(S, P.prone) : paintParts(S, drawing, P);
  }
  // the set on a suit stand in the Courtyard (the knight's cut, from the front, standing; no hero in it: an oak finial at the neck)
  function standFrame(id) {
    if (!SET[id]) return null;
    const S = Object.assign(skinOf(id, "knight", K.lookOf(null), A_.red), { stand: true });
    return paintParts(S, "down", K.skeleton("down", "idle", 0, 0));
  }
  // the colours of a set's metal: what the sick overlay must leave alone (the knight's steel, today), as proto/knight.js overlayPx reads them
  function metal(id) { const S = SET[id]; return S ? [...new Set(S.plate.concat(S.far, S.fist, S.foot))] : null; }

  const api = { SETS, SET, FIT, CUT, RAMPS: A_, has, draw, standFrame, metal, fit: fitSkin, knightCut: skinOf, version: 1 };
  root.ArmourArt = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
