// FORGE FOREVER: the one move function of the Battlegrounds (design pass 12 revision 3, sections 3.2a and 3.2b; built by build 7).
// Isaac: the trolls "behave on the same physics model as the player does". So one pure function moves every body (knights, sword-
// brothers, trolls and, in a level, minions): its own motion (the wish a stick or a brain writes, or a drive the rules set: the dodge,
// the quintain's shove, a lunge), then collide and slide against the world. Trolls differ from knights only in their numbers.
//
// The rules are pure: no DOM, no clock, no Math.random. Nothing here draws a random number or takes an id from fight.nextId (a body's
// id comes from fight.bodyId), so a fight's log sees the same calls in the same order with or without it. In the cellar's world
// (spec/cellar.json has no solids, surfaces, cover or substep) the dummies are the only circles and fight.floor is the box, nothing is
// ever put on a free point, and every step below is the line proto/combat.js ran at a6bed45 (section 3.2a's table): one knight in the
// cellar is still today's game, byte for byte. tools/test-physics.js runs the frozen a6bed45 rules beside these to prove it.
//
// A level's world (spec/gate.json) is solid and has height (sections 3.2a, 3.2b, 3.3). Everything that stands is a solid with a foot
// height (base) and a height (ht): circles, rectangles, boxes on the castle's slant (u = x - y, v = x + y), the castle's half-plane;
// a solid blocks a body when their vertical spans overlap, and a thin one (posts, poles) blocks bodies but not shots. Places have
// heights: the ground with its holes (deep pits and the moat, whose lip a knight or a brute catches; shallow trenches; crater bowls),
// and platforms (the chapel's roof, stair and landing, the archer tower's deck on its legs, the drawbridge's deck when it is down).
// Where two places differ by more than 6 px the loader makes an edge: a ledge to bodies on the upper one (self-motion stops r from it, a
// push of 30 px/s or more takes a body over, and on an edge marked drop a body can step off on purpose), a wall to bodies beside a
// platform that is solid underneath. Ground cover (grass, the road, caltrops, ice and puddles) is flat and sets friction and speed.
//
//   Physics.world(fight, numbers, spec)          the world a fight's bodies move in: the cellar's live dummies and its floor as the box;
//                                                in a level (numbers: spec/combat.json's physics block, spec: the whole of it) the
//                                                level's world, built from fight.area
//   Physics.move(body, intent, world, dt, pre)   one step of a body's own motion, then the resolve. intent: { wish: [wx, wy] } in px/s,
//                                                or { drive }: vel (the dodge: { vx, vy, d }, d the step's share of it), share (the
//                                                quintain's shove, shared over its time) or lerp (a lunge, interpolated); a drive
//                                                that ends sets drive.done. pre(body), if given, runs between the motion and the
//                                                resolve (frost_trail drops its patch there, as it did). In a level the intent may
//                                                add tilt (the stick's, 0 to 1) and climb (-1, 0, 1), and the step returns the
//                                                contacts it made: solids met (with the walk's and the push's speed into them),
//                                                falls, landings (their height, a deep hole), climbs, drops and teetering
//   Physics.resolve(body, world)                 collide and slide: out of the circles in up to 3 passes, the centre kept in the box,
//                                                and along a wall when a circle and the box both bind
//   Physics.settle(body, world)                  the resolve after the world itself moved (the rail dummy pushes a standing knight)
//   Physics.push(world, body, ax, ay, px)        a push of px along the unit (ax, ay): an impulse of px x 12 / mass px/s, which the
//                                                ground's friction slows so that the body slides px / mass
//   Physics.soft(world, bodies)                  bodies push each other softly (a hard core inside), after every body has moved
//   Physics.cores(world, bodies)                 the final core pass, after the view has held the knights
//   Physics.letGo(world, body), fellTower(world, deck, dir), crater(world, x, y, r, depth), addSolid / removeSolid,
//   setPlatform(world, id, on), groundAt, surfaceAt, coverOf, shotStop, freePoint   the level's other doings and questions
//
// Plain script, defines window.Physics (module.exports in node). Its numbers live in spec/combat.json's physics block.
(function (root) {
  "use strict";
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // ------------------------------------------------------------------ the world
  // The cellar's: its dummies are its only colliders (live, so the rail dummy's slide counts) and fight.floor is every body's box. A
  // fight with a level gets the level's world (below) from its area.
  function world(fight, N, D) { if (fight.level && N) return levelWorld(fight, fight.area || {}, N, D || null); return { circles: fight.dummies, box: fight.floor }; }

  // ------------------------------------------------------------------ a body's own motion
  // the drives, each written as proto/combat.js wrote it at a6bed45 (lines 281, 267 and 296), so a cellar knight moves to the bit
  const DRIVES = {
    vel(b, D) { b.x += D.vx * D.d; b.y += D.vy * D.d; },
    share(b, D, dt) { const q0 = D.t / D.T; D.t = Math.min(D.T, D.t + dt); const q = D.t / D.T - q0; b.x += D.dx * q; b.y += D.dy * q; if (D.t >= D.T) D.done = true; },
    lerp(b, D, dt) { D.t += dt; const p = Math.min(1, D.t / D.T); b.x = D.x0 + (D.x1 - D.x0) * p; b.y = D.y0 + (D.y1 - D.y0) * p; if (p >= 1) D.done = true; }
  };
  // one step: a drive, else the walk (x += wx * dt, the stick's wish in today's order); then pre; then collide and slide
  function move(b, intent, W, dt, pre) {
    if (W.level) return moveLevel(b, intent, W, dt, pre);
    const D = intent.drive;
    if (D) DRIVES[D.kind](b, D, dt);
    else { const w = intent.wish; b.x += w[0] * dt; b.y += w[1] * dt; }
    if (pre) pre(b);
    resolve(b, W);
  }

  // ------------------------------------------------------------------ collide and slide (proto/combat.js keepOnFloor, line for line)
  // a circle pushes the body radially out to r + its r; then the centre is clamped to the box; when both bind (a dummy by the wall) the
  // body slides along the wall. Up to 3 passes, stopping at the first that moves nothing.
  function resolve(b, W) {
    if (W.level) return resolveLevel(b, W, b.x, b.y, null, true);
    const F = W.box, S = W.circles, r = b.r;
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (const d of S) {
        const need = r + d.r, dx = b.x - d.x, dy = b.y - d.y, dd = Math.hypot(dx, dy);
        if (dd >= need) continue;
        if (dd < 1e-6) { b.x = d.x - need; } else { b.x = d.x + dx / dd * need; b.y = d.y + dy / dd * need; }
        moved = true;
      }
      const cx = clamp(b.x, F.x0, F.x1), cy = clamp(b.y, F.y0, F.y1), boundX = cx !== b.x, boundY = cy !== b.y;
      b.x = cx; b.y = cy;
      if (!moved) break;
      if (boundX || boundY) for (const d of S) {
        const need = r + d.r, dx = b.x - d.x, dy = b.y - d.y;
        if (Math.hypot(dx, dy) >= need - 1e-6) continue;
        if (boundY && Math.abs(dy) < need) b.x = clamp(d.x + (dx >= 0 ? 1 : -1) * Math.sqrt(need * need - dy * dy), F.x0, F.x1);
        else if (boundX && Math.abs(dx) < need) b.y = clamp(d.y + (dy >= 0 ? 1 : -1) * Math.sqrt(need * need - dx * dx), F.y0, F.y1);
      }
    }
  }
  const settle = resolve;

  // ================================================================== a level: the solid world and height
  const SQ2 = Math.SQRT2, FAR = 1e9, RAD = Math.PI / 180, ZERO = [0, 0];
  const MARGIN = 13;        // the broadphase pads every solid and edge by the widest body (r 11, or 9 with the ram) and a little more
  const OUT = 4;            // a climber stepping off the ladder's foot stands 4 px out from it (section 3.2b)
  // ground cover by rank: on overlapping cover the more slippery or slower wins
  const RANK = { ice: 6, puddle: 5, caltrops: 4, crater: 3, trench: 2, snow: 1.5, fire: 1, ground: 0 };   // snow (design pass 21): a drift slows to 0.8   // fire: no friction of its own (a mark the fields cost at 4)
  const GROUND = { kind: "ground" };

  // ------------------------------------------------------------------ building it from the area
  // A level's world from its area (spec/gate.json's shape; any part may be missing): solids, holes, platforms (and their edges), the
  // ladder, flat cover, and the breakable pieces the rules strike (huts, tents, the archer tower, fence and wire sections, barrels, the
  // trebuchets, the gate). The level's dummies, when it has any, are live circles as in the cellar. D: the combat spec (statuses' slow).
  function levelWorld(fight, A, N, D) {
    const W = { level: true, N, D: D || root.FORGE_COMBAT || {}, A, floor: fight.floor, solids: [], halves: [], holes: [], plats: [], platBy: {}, edges: [], ladders: [], cover: [],
      pieces: [], palisades: {}, dummies: fight.dummies, list: [], boxOf: null, cw: 32, gen: 0, ram: null, changes: null };
    W.ncx = Math.ceil((fight.W || A.w || 384) / W.cw) + 1; W.ncy = Math.ceil((fight.H || A.h || 216) / W.cw) + 1;
    W.cells = []; W.ecells = []; W.ccells = []; W.hcells = []; W.coverSwept = 0;   // ccells / hcells: the cover and the holes by cell (coverOf, gz read one cell)
    for (let i = 0; i < W.ncx * W.ncy; i++) { W.cells.push([]); W.ecells.push([]); W.ccells.push([]); W.hcells.push([]); }
    const K = A.propKinds || {};
    // rocks and boulders (a boulder is r 12 or more, and taller)
    for (const r of A.rocks || []) { const pk = K.rock || {}, big = r.r >= (pk.big || 12);
      addSolid(W, { kind: big ? "boulder" : "rock", shape: "c", x: r.x, y: r.y, r: r.r, ht: big ? (pk.htBig || 22) : (pk.ht || 16), stun: pk.chargeStun }); }
    // the props by their kind: a solid with a height, a hole, or flat cover
    for (const p of A.props || []) prop(W, p, K[p.kind] || {});
    // the outposts: huts and tents (breakable, aim targets) round a cookfire (a ring of stones, a solid you are burnt by if pushed in)
    const HU = A.huts || {};
    for (const op of A.outposts || []) {
      for (const at of op.huts || []) {
        const s = addSolid(W, { kind: op.kind || "hut", shape: "c", x: at[0], y: at[1], r: op.r, ht: op.ht, stun: (K.rock || {}).chargeStun });
        addPiece(W, { kind: op.kind || "hut", x: at[0], y: at[1], r: op.r, chest: HU.aimChest || 10, ht: op.ht, hp: op.hp, weak: HU.weak, resist: HU.resist, aim: true, solids: [s.id], outpost: op.id, wood: HU.wood !== false });
      }
      if (op.fire) { const cf = K.cookfire || {}; addSolid(W, { kind: "cookfire", shape: "c", x: op.fire[0], y: op.fire[1], r: cf.r || 6, ht: cf.ht || 6, contact: cf.contact || "fire", burnBase: cf.burnBase }); }
    }
    // the platforms: the chapel's block and roof, its stair and landing; the archer tower's deck, its slab, legs and parapets; the drawbridge
    for (const S of A.surfaces || []) platform(W, S);
    for (const L of A.ladders || []) {
      const rail = L.rails ? addSolid(W, { kind: "rails", shape: "r", x0: L.rails.rect[0], y0: L.rails.rect[1], x1: L.rails.rect[2], y1: L.rails.rect[3], ht: L.rails.ht, thin: !!L.rails.thin, tower: L.deck }) : null;
      const into = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[L.into || "n"];
      W.ladders.push({ id: L.id, deck: L.deck, foot: L.foot.slice(), head: L.head.slice(), h: L.h, into, maxMass: L.maxMass === undefined ? 1.5 : L.maxMass, by: null, active: true, rails: rail ? rail.id : null });
    }
    // the engines (the trebuchets): solid frames that stop shots, breakable aim targets whose wreck stays solid
    for (const e of A.engines || []) {
      const ek = (A.engineKinds || {})[e.kind] || {}, f = e.frame;
      const s = addSolid(W, { kind: e.kind, shape: "r", x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, ht: ek.ht || 24, stun: ek.chargeStun });
      addPiece(W, { kind: "engine", engine: e.id, x: (f.x0 + f.x1) / 2, y: (f.y0 + f.y1) / 2, r: (ek.aim || {}).r || 14, chest: (ek.aim || {}).chest || 12, ht: ek.ht || 24, hp: ek.hp, weak: ek.weak, resist: ek.resist, aim: true, solids: [s.id], stays: true, wood: ek.wood !== false });
    }
    // the castle: its foot a half-plane on the slant (u at least the foot's u is wall), its drum towers and the fallen tower's stump; the
    // moat a deep hole along the foot; the gate a breakable aim target the director opens at Break the gate
    const CA = A.castle;
    if (CA) {
      W.halves.push({ id: -1, kind: "castle", shape: "hp", ax: 1, ay: -1, c: CA.foot.u, base: 0, ht: CA.face || 72 });
      for (const t of (CA.gatehouse || {}).towers || []) addSolid(W, { kind: "drumTower", shape: "c", x: t.at[0], y: t.at[1], r: t.r, ht: t.h });
      if (CA.fallenTower) addSolid(W, { kind: "stump", shape: "c", x: CA.fallenTower.at[0], y: CA.fallenTower.at[1], r: CA.fallenTower.r, ht: (K.stump || {}).ht || 40 });
    }
    if (A.moat) W.holes.push({ id: W.holes.length, kind: "moat", shape: "uv", u0: A.moat.u[0], u1: A.moat.u[1], v0: -FAR, v1: FAR, depth: A.moat.hole.depth, deep: A.moat.hole.class === "deep", death: A.moat.hole.death });
    // the gate is struck in melee only from the drawbridge's deck (its meleeFrom): fromPlat names that platform
    const bridge = W.plats.find(P => P.when === "bridgeDown");
    if (A.gate) addPiece(W, { kind: "gate", x: A.gate.aim.at[0], y: A.gate.aim.at[1], r: A.gate.aim.r, chest: A.gate.aim.chest, ht: ((CA || {}).gatehouse || {}).arch ? CA.gatehouse.arch.h : 56, hp: A.gate.hp, weak: A.gate.weak, resist: A.gate.resist, aim: true, solids: [],
      fromPlat: A.gate.aim.meleeFrom === "deck" && bridge ? bridge.id : undefined, active: false });
    // the palisades: each a solid the full height of the floor until its arena clears (the director topples it)
    const PY = A.palisadeY || [64, 424];
    for (const s of A.palisades || []) W.palisades[s.id] = addSolid(W, { kind: "palisade", shape: "r", x0: s.x0, y0: PY[0], x1: s.x1, y1: PY[1], ht: (K.palisade || {}).ht || 18, palisade: s.id }).id;
    // the Last Army's Ram, lying on its broken frame until a knight takes it up
    if (A.ram && A.ram.rect) W.ram = addSolid(W, { kind: "ram", shape: "r", x0: A.ram.rect[0], y0: A.ram.rect[1], x1: A.ram.rect[2], y1: A.ram.rect[3], ht: (K.ram || {}).ht || 8 }).id;
    for (const g of A.tallGrass || []) W.cover.push({ kind: "grass", shape: "r", x0: g[0], y0: g[1], x1: g[0] + 32, y1: g[1] + 20, on: null });
    coverSync(W);   // the area's own cover and holes into their cells
    for (const H of W.holes) cellsOf(W, bboxOf(H), i => W.hcells[i].push(H));
    buildEdges(W);
    W.changes = [];   // from here on every change to the world is logged by its box, for the trolls' fields (fieldUpdate)
    return W;
  }
  // a change to the world (a solid comes or goes, a crater opens, a platform comes or goes, cover is laid): its box, padded, logged. soft:
  // a live mark's cover (fire, ice, a puddle, the knights' patches) comes or goes: the fields judge its nodes again but are not marked
  // dirty by it (section 3.5's rebuildOn list has no mark; the 0.5 s rebuild reads the new costs)
  function changed(W, bb, cover, soft) { if (W.changes) W.changes.push({ x0: bb[0], y0: bb[1], x1: bb[2], y1: bb[3], cover: !!cover, soft: !!soft }); }
  // a prop by its kind (spec/gate.json propKinds): wire and stake fences in sections of at most 16 px, each its own solid and piece
  function prop(W, p, pk) {
    if (pk.hole) { W.holes.push({ id: W.holes.length, kind: p.kind, shape: "r", x0: p.x0, y0: p.y0, x1: p.x1, y1: p.y1, depth: pk.hole.depth, deep: pk.hole.class === "deep", death: pk.hole.death, cover: pk.cover, shotCover: pk.shotCover }); return; }
    if (pk.cover && !pk.shape) { W.cover.push({ kind: pk.cover, prop: p.kind, rule: pk, shape: "r", x0: p.x0, y0: p.y0, x1: p.x1, y1: p.y1, on: null }); return; }
    const base = { kind: p.kind, base: p.base || 0, ht: pk.ht, thin: !!pk.thin, stun: pk.chargeStun, contact: pk.contact, burnBase: pk.burnBase };   // base: (design pass 21) a prop on a surface (the high table on the dais)
    if (pk.section && p.x0 !== undefined) {
      // sections along the long side, of equal length and at most `section` px
      const along = p.x1 - p.x0 >= p.y1 - p.y0, len = along ? p.x1 - p.x0 : p.y1 - p.y0, n = Math.max(1, Math.ceil(len / pk.section - 1e-9)), w = len / n;
      for (let i = 0; i < n; i++) {
        const r = along ? [p.x0 + w * i, p.y0, p.x0 + w * (i + 1), p.y1] : [p.x0, p.y0 + w * i, p.x1, p.y0 + w * (i + 1)];
        const s = addSolid(W, Object.assign({ shape: "r", x0: r[0], y0: r[1], x1: r[2], y1: r[3] }, base));
        addPiece(W, { kind: p.kind, x: (r[0] + r[2]) / 2, y: (r[1] + r[3]) / 2, r: pk.hitR || 8, up: pk.hitUp || 0, chest: pk.hitUp || 0, ht: pk.ht, hp: pk.hp, weak: pk.weak, resist: pk.resist, aim: !!pk.aim, solids: [s.id], wood: !!pk.wood, section: i, of: n });
      }
      return;
    }
    const s = addSolid(W, Object.assign(p.r !== undefined || pk.shape === "circle" ? { shape: "c", x: p.x, y: p.y, r: p.r !== undefined ? p.r : pk.r } : { shape: "r", x0: p.x0, y0: p.y0, x1: p.x1, y1: p.y1 }, base));
    if (pk.hp) addPiece(W, { kind: p.kind, x: s.shape === "c" ? s.x : (s.x0 + s.x1) / 2, y: s.shape === "c" ? s.y : (s.y0 + s.y1) / 2, r: pk.hitR || s.r || 8, chest: 0, ht: pk.ht, hp: pk.hp, weak: pk.weak, resist: pk.resist, aim: !!pk.aim, solids: [s.id], wood: !!pk.wood });
  }
  // a surface of spec/gate.json: a platform, and what stands with it (the chapel's block; the deck's slab, legs and parapets)
  function platform(W, S) {
    const P = { id: S.id, kind: S.kind, active: S.when ? false : true, when: S.when || null, solidUnder: !!(S.solidUnder || S.block), maxR: S.maxR, slab: S.slab || 0, open: S.open || {}, walls: S.wall || [], spec: S };
    if (S.uv) { P.shape = "uv"; P.u0 = S.uv.u[0]; P.u1 = S.uv.u[1]; P.v0 = S.uv.v[0]; P.v1 = S.uv.v[1]; }
    else { P.shape = "r"; P.x0 = S.rect[0]; P.y0 = S.rect[1]; P.x1 = S.rect[2]; P.y1 = S.rect[3]; }
    if (Array.isArray(S.z)) { P.z0 = S.z[0]; P.z1 = S.z[1]; P.rise = S.rise || "e"; P.z = S.z[1]; } else P.z = S.z || 0;
    W.plats.push(P); W.platBy[P.id] = P;
    if (S.block) addSolid(W, { kind: "chapel", shape: "r", x0: P.x0, y0: P.y0, x1: P.x1, y1: P.y1, ht: S.block.ht, stun: S.block.chargeStun, plat: P.id, block: true });
    // the deck's underside: a slab its bodies stand on and shorter bodies walk under
    if (P.slab && P.shape === "r") addSolid(W, { kind: "slab", shape: "r", x0: P.x0, y0: P.y0, x1: P.x1, y1: P.y1, base: P.z - P.slab, ht: P.slab, plat: P.id });
    // the legs: thin solids, together one breakable piece (the archer tower), an aim target 10 px up
    if (S.legs) {
      const L = S.legs, ids = L.at.map(at => addSolid(W, { kind: "leg", shape: "c", x: at[0], y: at[1], r: L.r, ht: L.ht, thin: !!L.thin, tower: L.hp ? P.id : null }).id);
      // (design pass 21) legs with no hit points (the Great Hall's gallery posts) are posts, never a target
      if (L.hp) addPiece(W, { kind: "tower", deck: P.id, x: (P.x0 + P.x1) / 2, y: (P.y0 + P.y1) / 2, r: (L.aim || {}).r || 9, chest: (L.aim || {}).chest || 10, ht: P.z, hp: L.hp, weak: L.weak, resist: L.resist, aim: true, solids: ids, wood: true, fall: L.fall || {}, creak: L.creak });
    }
    // the parapet: 2 px walls 4 px tall on the platform's edges (a wall to bodies on it, nothing to bodies below), with its gaps; thin,
    // since it is too low to stop a shot (a bow from the ground reaches the deck's archer over it)
    if (S.parapet && P.shape === "r") {
      const pw = S.parapet.w || 2, ph = S.parapet.ht || 4;
      const side = (s, a0, a1) => {   // the stretches of side s from a0 to a1 that its gaps leave
        let pieces = [[a0, a1]];
        for (const g of S.parapet.gaps || []) if (g.side === s) pieces = pieces.flatMap(([p, q]) => [[p, Math.min(q, g.from)], [Math.max(p, g.to), q]]).filter(([p, q]) => q - p > 1e-9);
        return pieces;
      };
      for (const s of S.parapet.sides || []) {
        const horiz = s === "n" || s === "s";
        for (const [p, q] of horiz ? side(s, P.x0, P.x1) : side(s, P.y0, P.y1)) {
          const r = s === "n" ? [p, P.y0, q, P.y0 + pw] : s === "s" ? [p, P.y1 - pw, q, P.y1] : s === "w" ? [P.x0, p, P.x0 + pw, q] : [P.x1 - pw, p, P.x1, q];
          addSolid(W, { kind: "parapet", shape: "r", x0: r[0], y0: r[1], x1: r[2], y1: r[3], base: P.z, ht: ph, plat: P.id, thin: true });
        }
      }
    }
    return P;
  }
  // a solid: given an id, added to the broadphase cells it may touch (padded by the widest body)
  function addSolid(W, d) {
    const s = Object.assign({ id: W.solids.length, base: 0, ht: 16, thin: false, gone: false }, d);
    W.solids.push(s);
    cellsOf(W, bboxOf(s), c => W.cells[c].push(s.id));
    changed(W, bboxOf(s), false, s.kind === "clod");   // a clod is a soft change: the trolls' classes leave clods out (judge), the bots' knight class counts them
    return s;
  }
  function removeSolid(W, id) {
    const s = typeof id === "object" ? id : W.solids[id];
    if (!s || s.gone) return;
    s.gone = true;
    cellsOf(W, bboxOf(s), c => { const L = W.cells[c], i = L.indexOf(s.id); if (i >= 0) L.splice(i, 1); });
    changed(W, bboxOf(s), false, s.kind === "clod");
  }
  // flat cover laid on the world (a cut wire section, broken staves, the felled tower's poles, a mark that plays): into its cells, logged
  // for the fields (a live mark's cover, c.mark or c.patch, as a soft change)
  const liveCover = c => !!(c.mark || c.patch);
  const indexCover = (W, c) => { c.ix = true; cellsOf(W, coverBox(c), i => W.ccells[i].push(c)); };
  // cover pushed onto W.cover without addCover (a test's) is put into its cells the next time the cells are read
  const coverSync = W => { if (W.coverN !== W.cover.length) { for (const c of W.cover) if (!c.ix) indexCover(W, c); W.coverN = W.cover.length; } return W.ccells; };
  function addCover(W, c) { W.cover.push(c); if (W.ccells) { coverSync(W); if (!c.ix) indexCover(W, c); } changed(W, coverBox(c), true, liveCover(c)); return c; }
  const coverBox = c => c.shape === "c" ? [c.x - c.r, c.y - c.r, c.x + c.r, c.y + c.r] : [c.x0, c.y0, c.x1, c.y1];
  // cover taken up (a mark that ended): marked gone, out of its cells and the list at once (W.coverSwept counts them, so the fields' count
  // of the cover still adds up), and logged as a plain change of its box
  function removeCover(W, c) {
    if (!c || c.gone) return;
    c.gone = true;
    if (W.ccells) { coverSync(W); cellsOf(W, coverBox(c), i => { const L = W.ccells[i], k = L.indexOf(c); if (k >= 0) L.splice(k, 1); }); }
    const i = W.cover.indexOf(c); if (i >= 0) { W.cover.splice(i, 1); W.coverSwept = (W.coverSwept || 0) + 1; W.coverN = W.cover.length; }
    changed(W, coverBox(c), false, liveCover(c));
  }
  // a cover's shape changed in place (a puddle shrinks): its box is judged again
  function coverChanged(W, c) { changed(W, coverBox(c), false, liveCover(c)); }
  // the cover whose boxes meet bb, each once (the cells it lies in)
  function coverNear(W, bb, f) {
    if (!W.ccells) { for (const c of W.cover) f(c); return; }
    coverSync(W);
    const q = W.cq = (W.cq || 0) + 1;
    cellsOf(W, bb, i => { for (const c of W.ccells[i]) { if (c.cq === q) continue; c.cq = q; f(c); } });
  }
  function addPiece(W, d) {
    const p = Object.assign({ i: 1000000 + W.pieces.length, piece: true, z: 0, up: 0, immune: [], weak: [], resist: [], st: {}, combo: null, flash: 0, wob: 0, wv: 0, active: true, gone: false, solids: [] }, d);
    p.weak = (d.weak || []).slice(); p.resist = (d.resist || []).slice(); p.hpMax = p.hp; p.name = (p.kind || "").toUpperCase();
    for (const id of p.solids) W.solids[id].piece = p;   // a solid knows its piece (a brute tears the wire section it meets)
    W.pieces.push(p);
    return p;
  }
  function bboxOf(s) {
    if (s.shape === "c") return [s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r];
    if (s.shape === "r") return [s.x0, s.y0, s.x1, s.y1];
    if (s.shape === "seg") return [Math.min(s.ax, s.bx), Math.min(s.ay, s.by), Math.max(s.ax, s.bx), Math.max(s.ay, s.by)];
    return [-FAR, -FAR, FAR, FAR];
  }
  function cellsOf(W, bb, f) {
    const c = W.cw, i0 = clamp(Math.floor((bb[0] - MARGIN) / c), 0, W.ncx - 1), i1 = clamp(Math.floor((bb[2] + MARGIN) / c), 0, W.ncx - 1);
    const j0 = clamp(Math.floor((bb[1] - MARGIN) / c), 0, W.ncy - 1), j1 = clamp(Math.floor((bb[3] + MARGIN) / c), 0, W.ncy - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) f(j * W.ncx + i);
  }
  const cellAt = (W, x, y) => clamp(Math.floor(y / W.cw), 0, W.ncy - 1) * W.ncx + clamp(Math.floor(x / W.cw), 0, W.ncx - 1);

  // ------------------------------------------------------------------ shapes
  const inRect = (x, y, x0, y0, x1, y1) => x >= x0 && x < x1 && y >= y0 && y < y1;
  // a hole's or a platform's footprint (half-open, so two that meet share no point)
  function inShape(S, x, y) {
    if (S.shape === "r") return inRect(x, y, S.x0, S.y0, S.x1, S.y1);
    if (S.shape === "uv") return inRect(x - y, x + y, S.u0, S.v0, S.u1, S.v1);
    if (S.shape === "c") return Math.hypot(x - S.x, y - S.y) < S.r;
    return false;
  }
  // the way out of solid s for a circle of radius r at (x, y): [nx, ny, depth], or null when it is clear. A circle pushes radially; a
  // rectangle along the least penetration when the centre is inside it (ties -x, +x, -y, +y), else radially from its nearest point; a box
  // on the slant does the same in u and v; a half-plane pushes along its normal
  function out(s, x, y, r) {
    if (s.shape === "c") { const need = r + s.r, dx = x - s.x, dy = y - s.y, dd = Math.hypot(dx, dy); if (dd >= need) return null; return dd < 1e-6 ? [-1, 0, need] : [dx / dd, dy / dd, need - dd]; }
    if (s.shape === "r") return outRect(x, y, r, s.x0, s.y0, s.x1, s.y1);
    if (s.shape === "uv") {
      const o = outRect(x - y, x + y, r * SQ2, s.u0, s.v0, s.u1, s.v1);
      if (!o) return null;
      const du = o[0] * o[2], dv = o[1] * o[2], dx = (du + dv) / 2, dy = (dv - du) / 2, m = Math.hypot(dx, dy);
      return [dx / m, dy / m, m];
    }
    if (s.shape === "hp") { const L = Math.hypot(s.ax, s.ay), d = (s.c - (s.ax * x + s.ay * y)) / L; if (d >= r) return null; return [-s.ax / L, -s.ay / L, r - d]; }
    return null;
  }
  function outRect(x, y, r, x0, y0, x1, y1) {
    if (x >= x0 && x <= x1 && y >= y0 && y <= y1) {
      const c0 = x - x0 + r, c1 = x1 - x + r, c2 = y - y0 + r, c3 = y1 - y + r;
      let k = 0, m = c0;
      if (c1 < m) { k = 1; m = c1; } if (c2 < m) { k = 2; m = c2; } if (c3 < m) { k = 3; m = c3; }
      return k === 0 ? [-1, 0, m] : k === 1 ? [1, 0, m] : k === 2 ? [0, -1, m] : [0, 1, m];
    }
    const qx = x < x0 ? x0 : x > x1 ? x1 : x, qy = y < y0 ? y0 : y > y1 ? y1 : y, dx = x - qx, dy = y - qy, d = Math.hypot(dx, dy);
    if (d >= r) return null;
    return [dx / d, dy / d, r - d];
  }
  // a solid blocks a body when their vertical spans overlap
  const blocks = (s, b) => !s.gone && b.z < s.base + s.ht && b.z + (b.h || 24) > s.base;
  const massOf = b => (b.stagger > 0 && b.massStaggered ? b.massStaggered : b.mass) || 1;

  // ------------------------------------------------------------------ heights: the ground and its holes, the platforms
  // the ground at (x, y): 0, or the deepest hole there (a crater is a bowl, its floor sloping from the rim to its depth at the centre, so
  // overlapping craters make one wider bowl, the ground being the lowest of them)
  function groundAt(W, x, y) { const z = gz(W, x, y); return { z, hole: GH, deep: !!(GH && GH.deep) }; }
  let GH = null;   // the hole gz found
  function gz(W, x, y) {
    let z = 0; GH = null;
    for (const H of W.hcells ? W.hcells[cellAt(W, x, y)] : W.holes) {
      if (H.gone) continue;
      let hz;
      if (H.bowl) { const d = Math.hypot(x - H.x, y - H.y); if (d >= H.r) continue; hz = -H.depth * (1 - d / H.r); }
      else if (!inShape(H, x, y)) continue; else hz = -H.depth;
      if (hz < z) { z = hz; GH = H; }
    }
    return z;
  }
  // a platform's height at (x, y): a stair rises along its run
  function platZ(P, x, y) {
    if (P.rise === undefined) return P.z;
    const t = P.rise === "e" ? (x - P.x0) / (P.x1 - P.x0) : P.rise === "w" ? (P.x1 - x) / (P.x1 - P.x0) : P.rise === "s" ? (y - P.y0) / (P.y1 - P.y0) : (P.y1 - y) / (P.y1 - P.y0);
    return P.z0 + (P.z1 - P.z0) * clamp(t, 0, 1);
  }
  const inPlat = (P, x, y) => P.active && inShape(P, x, y);
  // inside a platform that is solid underneath (the chapel's block, its stair and landing): there is no ground to stand on there
  function underSolid(W, x, y) { for (const P of W.plats) if (P.solidUnder && inPlat(P, x, y)) return true; return false; }
  // the highest surface under (x, y) at or below z: { z, plat, hole }
  function surfaceAt(W, x, y, z) {
    let best = null, bz = -FAR;
    for (const P of W.plats) { if (!inPlat(P, x, y)) continue; const h = platZ(P, x, y); if (h <= z + 1e-9 && h > bz) { best = P; bz = h; } }
    const g = groundAt(W, x, y);
    if (!underSolid(W, x, y) && g.z <= z + 1e-9 && g.z > bz) return { z: g.z, plat: null, hole: g.hole };
    return best ? { z: bz, plat: best, hole: null } : null;
  }

  // ------------------------------------------------------------------ edges: the boundaries between surfaces
  // Walk every platform's outline and every deep hole's at 1 px steps: where the heights on either side differ by at most 6 px the
  // surfaces join; otherwise the boundary is a ledge to bodies on the upper side (a deep hole's ledge is its lip), and a wall to bodies
  // beside it on the lower side where the upper is solid underneath. A side the area names a wall is one; a side it names open with
  // drop lets a body step off on purpose (from fromZ up). A platform with a widest body (the stair's maxR) walls off its joins to wider
  // bodies. Rebuilt whenever a surface changes (the bridge comes down, the tower falls).
  function buildEdges(W) {
    W.edges = []; for (const c of W.ecells) c.length = 0;
    for (const P of W.plats) if (P.active) for (const sd of sidesOf(W, P)) walkSide(W, P, sd);
    for (const H of W.holes) if (H.deep && !H.bowl && !H.gone) for (const sd of sidesOf(W, H)) walkLip(W, H, sd);
    W.gen++;
  }
  // a footprint's sides, each with its inward normal (into the shape); a box on the slant with no end in v gives only its u sides,
  // within the world's rows
  function sidesOf(W, S) {
    if (S.shape === "r") return [
      { name: "n", a: [S.x0, S.y0], b: [S.x1, S.y0], n: [0, 1] }, { name: "s", a: [S.x0, S.y1], b: [S.x1, S.y1], n: [0, -1] },
      { name: "w", a: [S.x0, S.y0], b: [S.x0, S.y1], n: [1, 0] }, { name: "e", a: [S.x1, S.y0], b: [S.x1, S.y1], n: [-1, 0] }];
    const XY = (u, v) => [(u + v) / 2, (v - u) / 2], H = (W.floor.y1 || 0) + 24, s2 = 1 / SQ2;
    const v0 = S.v0 > -FAR / 2 ? S.v0 : null, v1 = S.v1 < FAR / 2 ? S.v1 : null, out = [];
    const vr = u => [v0 !== null ? v0 : u + 2 * ((W.floor.y0 || 0) - 24), v1 !== null ? v1 : u + 2 * H];
    let r = vr(S.u0); out.push({ name: "u0", a: XY(S.u0, r[0]), b: XY(S.u0, r[1]), n: [s2, -s2] });
    r = vr(S.u1); out.push({ name: "u1", a: XY(S.u1, r[0]), b: XY(S.u1, r[1]), n: [-s2, s2] });
    if (v0 !== null) out.push({ name: "v0", a: XY(S.u0, v0), b: XY(S.u1, v0), n: [s2, s2] });
    if (v1 !== null) out.push({ name: "v1", a: XY(S.u0, v1), b: XY(S.u1, v1), n: [-s2, -s2] });
    return out;
  }
  function walkSide(W, P, sd) {
    const step = W.N.stepUp, len = Math.hypot(sd.b[0] - sd.a[0], sd.b[1] - sd.a[1]), n = Math.max(1, Math.ceil(len - 1e-9));
    const open = P.open[sd.name], wall = P.walls.includes(sd.name);
    const runs = { own: null, ground: null };
    for (let t = 0; t <= n; t++) {
      let key = null, gkey = null;
      if (t < n) {
        const f = (t + 0.5) / n, mx = sd.a[0] + (sd.b[0] - sd.a[0]) * f, my = sd.a[1] + (sd.b[1] - sd.a[1]) * f;
        const ix = mx + sd.n[0] * 0.5, iy = my + sd.n[1] * 0.5, ox = mx - sd.n[0] * 0.5, oy = my - sd.n[1] * 0.5, hi = platZ(P, ix, iy);
        // what a body could stand on just outside: the other platforms there, and the ground unless it is under a solid platform
        const hs = [];
        for (const Q of W.plats) if (Q !== P && inPlat(Q, ox, oy)) hs.push({ h: platZ(Q, ox, oy), Q });
        const g = underSolid(W, ox, oy) ? null : groundAt(W, ox, oy);
        if (g) hs.push({ h: g.z, deep: g.deep, ground: true });
        let cls;
        if (wall) cls = "wall";
        else if (!hs.length || hs.some(c => Math.abs(c.h - hi) <= step + 1e-9)) cls = hs.length ? "join" : "ledge";
        else if (hs.every(c => c.h > hi + step)) cls = hs.some(c => c.Q && c.Q.solidUnder) ? "wall" : "join";
        else cls = "ledge";
        const lower = hs.filter(c => c.h < hi - step).sort((a, b) => b.h - a.h)[0];
        const deep = cls === "ledge" && !!(lower && lower.deep), drop = cls === "ledge" && !!(open && open.drop) && hi >= (open.fromZ || 0) - 1e-9;
        if (cls !== "join") key = cls + (drop ? "+drop" : "") + (deep ? "+deep" : "");
        // for bodies on the ground beside it: a wall where a solid platform stands more than a step above the ground, and the joins of a
        // platform with a widest body walled off to wider ones
        if (g && P.solidUnder && hi - g.z > step + 1e-9) gkey = "wall";
        else if (g && P.maxR && cls === "join" && Math.abs(hi - g.z) <= step + 1e-9) gkey = "rwall";
        if (P.spec && P.spec.block) gkey = null;   // the chapel's block is a solid already
      }
      runs.own = run(W, runs.own, key, t, n, sd, P, false);
      runs.ground = run(W, runs.ground, gkey, t, n, sd, P, true);
    }
  }
  // merge the 1 px samples of one side into segments of one kind; a run ends where the kind changes (or the side ends)
  function run(W, cur, key, t, n, sd, P, ground) {
    if (cur && cur.key === key) return cur;
    if (cur && cur.key) {
      const f0 = cur.t0 / n, f1 = t / n, ax = sd.a[0] + (sd.b[0] - sd.a[0]) * f0, ay = sd.a[1] + (sd.b[1] - sd.a[1]) * f0, bx = sd.a[0] + (sd.b[0] - sd.a[0]) * f1, by = sd.a[1] + (sd.b[1] - sd.a[1]) * f1;
      const k = cur.key, e = { id: W.edges.length, ax, ay, bx, by, side: sd.name, plat: P.id };
      if (ground) Object.assign(e, { owner: "ground", kind: "wall", nx: -sd.n[0], ny: -sd.n[1], rMin: k === "rwall" ? P.maxR : undefined, airborne: k === "wall" });
      else Object.assign(e, { owner: P.id, kind: k.startsWith("wall") ? "wall" : "ledge", nx: sd.n[0], ny: sd.n[1], drop: k.includes("+drop"), deep: k.includes("+deep") });
      addEdge(W, e);
    }
    return key ? { key, t0: t } : null;
  }
  // a deep hole's lip: a ledge to bodies on the ground beside it (a wall to those that catch it), except where a platform over the hole
  // joins the ground (the drawbridge's deck)
  function walkLip(W, H, sd) {
    const step = W.N.stepUp, len = Math.hypot(sd.b[0] - sd.a[0], sd.b[1] - sd.a[1]), n = Math.max(1, Math.ceil(len - 1e-9));
    let cur = null;
    const fake = { id: null, maxR: undefined };
    for (let t = 0; t <= n; t++) {
      let key = null;
      if (t < n) {
        const f = (t + 0.5) / n, mx = sd.a[0] + (sd.b[0] - sd.a[0]) * f, my = sd.a[1] + (sd.b[1] - sd.a[1]) * f;
        const ix = mx + sd.n[0] * 0.5, iy = my + sd.n[1] * 0.5, ox = mx - sd.n[0] * 0.5, oy = my - sd.n[1] * 0.5;
        let outside = true;
        for (const s of W.halves) if (s.ax * ox + s.ay * oy >= s.c) outside = false;   // the castle's foot: nobody stands beyond it
        if (outside && !underSolid(W, ox, oy)) {
          const go = groundAt(W, ox, oy).z;
          let joined = false;
          for (const Q of W.plats) if (inPlat(Q, ix, iy) && Math.abs(platZ(Q, ix, iy) - go) <= step + 1e-9) joined = true;
          if (!joined && go - (-H.depth) > step) key = "lip";
        }
      }
      if (!(cur && cur.key === key)) {
        if (cur && cur.key) {
          const f0 = cur.t0 / n, f1 = t / n;
          addEdge(W, { id: W.edges.length, owner: "ground", kind: "ledge", deep: true, hole: H.id, ax: sd.a[0] + (sd.b[0] - sd.a[0]) * f0, ay: sd.a[1] + (sd.b[1] - sd.a[1]) * f0,
            bx: sd.a[0] + (sd.b[0] - sd.a[0]) * f1, by: sd.a[1] + (sd.b[1] - sd.a[1]) * f1, nx: -sd.n[0], ny: -sd.n[1], plat: fake.id, side: sd.name });
        }
        cur = key ? { key, t0: t } : null;
      }
    }
  }
  function addEdge(W, e) { W.edges.push(e); cellsOf(W, [Math.min(e.ax, e.bx), Math.min(e.ay, e.by), Math.max(e.ax, e.bx), Math.max(e.ay, e.by)], c => W.ecells[c].push(e.id)); }
  // the nearest point of an edge to (x, y), and the signed distance to it: negative only across the edge (a centre that projects onto the
  // segment, on the side its bodies may not go); beyond its ends it is the distance to the end
  function segQ(e, x, y) { const dx = e.bx - e.ax, dy = e.by - e.ay, L2 = dx * dx + dy * dy; let t = L2 > 0 ? ((x - e.ax) * dx + (y - e.ay) * dy) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; return [e.ax + dx * t, e.ay + dy * t, t]; }
  function sdist(e, x, y) { const q = segQ(e, x, y), d = Math.hypot(x - q[0], y - q[1]); return q[2] > 0 && q[2] < 1 && (x - e.ax) * e.nx + (y - e.ay) * e.ny < 0 ? -d : d; }
  // an edge acts on the bodies on the surface that owns it; a wall beside a solid platform also on a falling body below its top
  function edgeFor(W, e, b) {
    if (e.rMin !== undefined && !(b.r > e.rMin + 1e-9)) return false;
    if (b.air) { if (!e.airborne) return false; const P = W.platBy[e.plat], q = segQ(e, b.x, b.y); return !!P && b.z < platZ(P, q[0] - e.nx * 0.5, q[1] - e.ny * 0.5); }
    return e.owner === (b.on || "ground");
  }

  // ------------------------------------------------------------------ cover
  // the flat cover under a body's centre on its own surface: the most slippery or slowest of ice, puddles, caltrops, craters and trenches
  function coverOf(W, b, x, y) {
    x = x === undefined ? b.x : x; y = y === undefined ? b.y : y;
    let best = GROUND, rank = 0;
    const on = b.on || null;
    for (const c of W.ccells ? coverSync(W)[cellAt(W, x, y)] : W.cover) {
      if (c.gone || (c.on || null) !== on || (c.only && !b[c.only])) continue;   // c.only: cover that acts on one sort of body (the knights' frost on trolls)
      const rk = RANK[c.kind] || 0;
      if (rk <= rank || !inShape(c, x, y)) continue;
      best = c; rank = rk;
    }
    if (!on) { gz(W, x, y); const H = GH; if (H && H.cover && (RANK[H.cover] || 0) > rank) best = H.coverRec || (H.coverRec = { kind: H.cover, hole: H }); }
    return best;
  }
  // what the fields pay for a node's cover: the dearest of every cover under it (fire in a trench or a crater costs the fire, section 3.6a),
  // by the class's cost table
  function coverCost(W, b, x, y, cost) {
    if (!cost) return 1;
    let m = 1;
    const on = b.on || null;
    for (const c of W.ccells ? coverSync(W)[cellAt(W, x, y)] : W.cover) {
      if (c.gone || (c.on || null) !== on || (c.only && !b[c.only]) || !inShape(c, x, y)) continue;
      m = Math.max(m, cost[c.kind] || 1);
    }
    if (!on) { gz(W, x, y); const H = GH; if (H && H.cover) m = Math.max(m, cost[H.cover] || 1); }
    return m;
  }

  // ------------------------------------------------------------------ the move, in a level (section 3.2a's seven parts)
  function moveLevel(b, intent, W, dt, pre) {
    const N = W.N, out = b.contacts || (b.contacts = []);
    out.length = 0;
    if (b.climbing) { climbStep(b, intent, W, dt, out); return out; }
    if (b.air) { airStep(b, W, dt, out); return out; }
    // 1. statuses: the speed factor is the product of the body's (slow, chill, the cover's, the ram's); a stun, a freeze or a stagger
    //    holds the wish; a freeze cancels the drive and makes friction x 0.25
    const st = b.st || {}, frozen = !!(st.freeze || b.frozen > 0), held = frozen || !!st.stun || b.stagger > 0;
    const cv = coverOf(W, b), CV = N.cover[cv.kind] || N.cover.ground, ignores = b.ignores && b.ignores.includes(cv.kind);
    const slow = st.slow ? ((W.D.statuses || {}).slow || {}).speed || 0.6 : 1, chill = b.chill && b.chill.n ? Math.pow(b.chill.speed || 0.8, b.chill.n) : 1;
    let sf = (ignores ? 1 : CV.speed) * slow * chill * (b.carry ? b.carry.speed || 1 : 1);
    const P = b.on ? W.platBy[b.on] : null, w = intent.wish || ZERO;
    if (P && P.rise !== undefined) { const up = (P.rise === "e" ? w[0] : P.rise === "w" ? -w[0] : P.rise === "s" ? w[1] : -w[1]) > 0; sf *= up ? N.stair.up : N.stair.down; }
    // 4. self-motion: a drive, else the walk; on ice the walk velocity approaches the wish (the position moves first, as an impulse's)
    let sx = 0, sy = 0, wx = 0, wy = 0;
    const D = intent.drive;
    if (D && frozen) D.done = true;
    if (D && !frozen) { const d = driveStep(D, dt); sx = d[0]; sy = d[1]; wx = sx / dt; wy = sy / dt; }
    else {
      if (!held) { wx = w[0] * sf; wy = w[1] * sf; }
      if (CV.slip && !ignores) { sx = (b.vx || 0) * dt; sy = (b.vy || 0) * dt; } else { sx = wx * dt; sy = wy * dt; b.vx = wx; b.vy = wy; }
    }
    // 5. the impulse (skipped when it is zero)
    const imp = !!(b.ix || b.iy), px = imp ? b.ix * dt : 0, py = imp ? b.iy * dt : 0;
    if (!imp) b.pushV = null;
    b._wx = (CV.slip && !D) ? (b.vx || 0) : wx; b._wy = (CV.slip && !D) ? (b.vy || 0) : wy;
    if (pre) pre({ x: b.x + sx + px, y: b.y + sy + py });
    // 6. substeps: a step that moves more than 4 px (its own motion and its push together) is cut into equal parts; 7. in each, the own
    //    motion's share is resolved as self-motion (never over a ledge), then the push's share by the push's own rule (over a ledge it was
    //    shoved toward at 30 px/s or more), each with the surfaces after it. So walking on while a push slides never adds to the push
    const sl = Math.hypot(sx, sy), pl = Math.hypot(px, py), n = sl + pl > N.substep ? Math.ceil((sl + pl) / N.substep) : 1;
    for (let i = 0; i < n && !b.air; i++) {
      if (sl > 0 || !imp) part(b, W, sx / n, sy / n, out, true);
      if (imp && !b.air) part(b, W, px / n, py / n, out, false);
    }
    // the impulse slows by the cover's friction (a frozen body's x 0.25; none in the air); under 1 px/s it stops
    if (imp && !b.air) {
      const k = (ignores ? N.cover.ground.k : CV.k) * (frozen ? N.frozenK : 1), f = Math.max(0, 1 - k * dt);
      b.ix *= f; b.iy *= f;
      if (Math.hypot(b.ix, b.iy) < N.cutoff) { b.ix = 0; b.iy = 0; b.pushV = null; }
    }
    if (CV.slip && !ignores && !b.air) { const a = Math.min(1, CV.accel * dt); b.vx = (b.vx || 0) + (wx - (b.vx || 0)) * a; b.vy = (b.vy || 0) + (wy - (b.vy || 0)) * a; }
    if (!b.air && !b.climbing) { if (!mount(b, intent, W, dt, out)) drop(b, intent, W, dt, out); }
    if (!b.climbing) teeter(b, W, out);
    return out;
  }
  // one share of a step's motion: moved, resolved (self: the body's own motion, which a ledge always stops) and stood on its surface
  function part(b, W, dx, dy, out, self) { const x0 = b.x, y0 = b.y; b.x += dx; b.y += dy; resolveLevel(b, W, x0, y0, out, self); surface(b, W, out); }
  // a drive's motion this step: the dodge's velocity, the quintain's shove shared over its time, a lunge along its line (in a level by
  // the line's increment, so a body a resolve moved off the line is not carried through a post), a brute's charge (px/s and px left)
  function driveStep(D, dt) {
    if (D.kind === "vel") return [D.vx * D.d, D.vy * D.d];
    if (D.kind === "share") { const q0 = D.t / D.T; D.t = Math.min(D.T, D.t + dt); const q = D.t / D.T - q0; if (D.t >= D.T) D.done = true; return [D.dx * q, D.dy * q]; }
    if (D.kind === "lerp") { D.t += dt; const p = Math.min(1, D.t / D.T), dp = p - (D.p || 0); D.p = p; if (p >= 1) D.done = true; return [(D.x1 - D.x0) * dp, (D.y1 - D.y0) * dp]; }
    if (D.kind === "run") { const go = Math.min(D.speed * dt, D.left); D.left -= go; if (D.left <= 1e-9) D.done = true; return [D.ux * go, D.uy * go]; }
    return [0, 0];
  }
  // collide and slide in a level: up to 3 passes over the solids near the body (32 px cells, ids ascending; the level's dummies; the
  // castle's foot), each push removing the inward part of the impulse and of the ice walk (the slide) and recording a contact with the
  // walk's and the push's speed into the solid; then the centre clamped to the body's box; then the edges (ledges last, so a pass ends
  // on the right side of each). A body still caught in a solid goes to the nearest free point. self: the body's own motion (its walk or
  // drive, a shove, the view's hold), which never crosses a ledge whatever the body's impulse; else the share its push moved it
  function resolveLevel(b, W, x0, y0, out, self) {
    const box = W.boxOf ? W.boxOf(b) : W.floor;
    let moved = false, clamped = false;
    for (let pass = 0; pass < 3; pass++) {
      moved = false; clamped = false;
      for (const d of W.dummies) {
        const dx = b.x - d.x, dy = b.y - d.y, need = b.r + d.r, dd = Math.hypot(dx, dy);
        if (dd >= need) continue;
        const ux = dd < 1e-6 ? -1 : dx / dd, uy = dd < 1e-6 ? 0 : dy / dd;
        b.x = d.x + ux * need; b.y = d.y + uy * need; slide(b, ux, uy); moved = true;
      }
      for (const id of W.cells[cellAt(W, b.x, b.y)]) {
        const s = W.solids[id];
        if (!blocks(s, b)) continue;
        const o = out_(s, b);
        if (!o) continue;
        if (out) note(b, out, s, o[0], o[1]);
        b.x += o[0] * o[2]; b.y += o[1] * o[2]; slide(b, o[0], o[1]); moved = true;
      }
      for (const s of W.halves) { if (!blocks(s, b)) continue; const o = out_(s, b); if (!o) continue; if (out) note(b, out, s, o[0], o[1]); b.x += o[0] * o[2]; b.y += o[1] * o[2]; slide(b, o[0], o[1]); moved = true; }
      const cx = clamp(b.x, box.x0, box.x1), cy = clamp(b.y, box.y0, box.y1);
      if (cx !== b.x || cy !== b.y) { b.x = cx; b.y = cy; clamped = true; }
      for (const id of W.ecells[cellAt(W, b.x, b.y)]) { const e = W.edges[id]; if (edgeFor(W, e, b) && edge(W, b, e, x0, y0, self, out)) moved = true; }
      if (!moved) break;
    }
    // still caught after the passes (only possible when the last pass pushed or clamped it): the nearest free point
    if ((moved || clamped) && caught(W, b)) freePoint(W, b);
  }
  const out_ = (s, b) => out(s, b.x, b.y, b.r);
  // the slide: the inward part of the impulse (unless walk is set: only the walk is stopped) and of the ice walk velocity is taken away
  function slide(b, nx, ny, walk) {
    const vi = walk ? 0 : (b.ix || 0) * nx + (b.iy || 0) * ny; if (vi < 0) { b.ix -= vi * nx; b.iy -= vi * ny; }
    const vw = (b.vx || 0) * nx + (b.vy || 0) * ny; if (vw < 0) { b.vx -= vw * nx; b.vy -= vw * ny; }
  }
  // a contact, once a solid a move: the walk's and the push's speed into it, before the slide took them
  function note(b, out, s, nx, ny) {
    for (const c of out) if (c.s === s) return;
    out.push({ kind: "solid", s, nx, ny, walk: Math.max(0, -((b._wx || 0) * nx + (b._wy || 0) * ny)), push: Math.max(0, -((b.ix || 0) * nx + (b.iy || 0) * ny)) });
  }
  // an edge on a body: a wall (or a deep hole's lip to a body that catches it) keeps the centre r from it; a ledge stops self-motion r
  // from it, or where the body already was if a push left it nearer, and lets the share a push of 30 px/s or more toward it moves the
  // body take it over. Stopping self-motion at a ledge leaves the impulse to its own share (a push judged by its own rule)
  function edge(W, b, e, x0, y0, self, out) {
    const q = segQ(e, b.x, b.y), dx = b.x - q[0], dy = b.y - q[1], d = Math.hypot(dx, dy), side = (b.x - e.ax) * e.nx + (b.y - e.ay) * e.ny, sd = q[2] > 0 && q[2] < 1 && side < 0 ? -d : d;
    // (design pass 21) a ground body on a platform's side of its ground wall is pushed out only from inside the platform's footprint (and
    // its radius): beyond it (south of the keep's steps, under the same 32 px cell as the landing's north wall) the wall is not its business
    if (sd < 0 && e.owner === "ground" && e.plat) { const P = W.platBy[e.plat]; if (P && P.shape === "r" && !(b.x > P.x0 - b.r && b.x < P.x1 + b.r && b.y > P.y0 - b.r && b.y < P.y1 + b.r)) return false;
      // and back out the way it came: a body that crossed this wall in this substep goes back through it; one already inside goes out
      // through the nearest side that has a wall (a body squeezed a pixel into a gallery stair's south side was thrown out of its north
      // side, into the wall behind it; a brute knocked into the keep landing's east side is nearest its open south side, onto the steps)
      if (P && P.shape === "r" && sdist(e, x0, y0) < -1e-9) {
        if (P._gwOf !== W.edges) { P._gwOf = W.edges; P._gw = { n: false, s: false, e: false, w: false }; for (const q of W.edges) if (q.owner === "ground" && q.plat === P.id && q.kind === "wall") P._gw[q.ny < -0.5 ? "n" : q.ny > 0.5 ? "s" : q.nx < -0.5 ? "w" : "e"] = true; }
        const G = P._gw, to = { n: b.y - P.y0, s: P.y1 - b.y, w: b.x - P.x0, e: P.x1 - b.x }, mine = e.ny < -0.5 ? "n" : e.ny > 0.5 ? "s" : e.nx < -0.5 ? "w" : "e";
        let near = Infinity; for (const k of ["n", "s", "w", "e"]) if (G[k]) near = Math.min(near, to[k]);
        if (to[mine] > near + 1e-9) return false;
      } }
    const hard = e.kind === "wall" || (e.deep && b.catches);
    let floor;
    if (hard) floor = b.r;
    else {
      if (!self && b.pushV && -(b.pushV[0] * e.nx + b.pushV[1] * e.ny) >= W.N.ledge.shoveOver - 1e-9) return false;
      // a ledge holds only a body that began this substep on its side (one already past it, over a hole or another ledge, is falling),
      // and across its line only one whose way crossed this very segment (one that came round its end into a hole crossed another)
      const d0 = sdist(e, x0, y0);
      if (d0 < -1e-9 || (sd < 0 && !crosses(x0, y0, b.x, b.y, e))) return false;
      floor = Math.max(0, Math.min(b.r, d0));
    }
    if (sd >= floor - 1e-9) return false;
    const ux = sd > 1e-9 ? dx / d : e.nx, uy = sd > 1e-9 ? dy / d : e.ny;
    b.x = q[0] + ux * floor; b.y = q[1] + uy * floor;
    slide(b, ux, uy, self && !hard);
    if (out && e.kind === "wall") { let seen = false; for (const c of out) if (c.edge === e) seen = true; if (!seen) out.push({ kind: "edge", edge: e, nx: ux, ny: uy }); }
    return true;
  }
  // does the way from (x0, y0) to (x1, y1) cross an edge's segment?
  function crosses(x0, y0, x1, y1, e) {
    const cr = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const d1 = cr(e.ax, e.ay, e.bx, e.by, x0, y0), d2 = cr(e.ax, e.ay, e.bx, e.by, x1, y1), d3 = cr(x0, y0, x1, y1, e.ax, e.ay), d4 = cr(x0, y0, x1, y1, e.bx, e.by);
    return (d1 > 0) !== (d2 > 0) && (d3 > 0) !== (d4 > 0);
  }
  // still caught in a solid (more than 0.01 px inside one)?
  function caught(W, b, x, y) {
    x = x === undefined ? b.x : x; y = y === undefined ? b.y : y;
    for (const d of W.dummies) if (Math.hypot(x - d.x, y - d.y) < b.r + d.r - 0.01) return true;
    for (const id of W.cells[cellAt(W, x, y)]) { const s = W.solids[id]; if (!blocks(s, b)) continue; const o = out(s, x, y, b.r); if (o && o[2] > 0.01) return true; }
    for (const s of W.halves) { if (!blocks(s, b)) continue; const o = out(s, x, y, b.r); if (o && o[2] > 0.01) return true; }
    return false;
  }
  // the nearest free point (levels only): rings of 2 to 24 px, 16 directions each, starting east and going clockwise; a point overlapping
  // no solid, inside the body's box, on the body's own surface (never in a deep hole, never inside a solid platform from the ground) and
  // outside every other body's core. With none, the body stays.
  function freePoint(W, b, far) {
    const F = W.N.free, S = W.N.soft, box = W.boxOf ? W.boxOf(b) : W.floor, max = far === undefined ? F.max : Math.max(F.max, far);
    for (let R = F.ring; R <= max + 1e-9; R += F.ring) for (let i = 0; i < F.dirs; i++) {
      const a = i * 2 * Math.PI / F.dirs, x = b.x + Math.cos(a) * R, y = b.y + Math.sin(a) * R;
      if (x < box.x0 || x > box.x1 || y < box.y0 || y > box.y1 || caught(W, b, x, y)) continue;
      if (b.on) { const P = W.platBy[b.on]; if (!P || !inPlat(P, x, y)) continue; }
      else if (!b.air && (groundAt(W, x, y).deep || underSolid(W, x, y))) continue;
      let core = false;
      if (F.outsideCores) for (const o of W.list) { if (o === b || o.climbing || !(b.z < o.z + (o.h || 24) && b.z + (b.h || 24) > o.z)) continue; const c = (b.knight && o.knight ? S.coreKnights : S.core) * (b.r + o.r); if (Math.hypot(x - o.x, y - o.y) < c - 1e-9) { core = true; break; } }
      if (core) continue;
      b.x = x; b.y = y;
      return true;
    }
    return false;
  }
  // after a resolve: the surface the body stands on, and its z. Leaving a platform it walks onto what joins it; over a ledge (a push took
  // it) or into a deep hole it falls. The ground's z follows its shallow holes; the platforms with a step of it take a body on the ground
  function surface(b, W, out) {
    const step = W.N.stepUp;
    if (b.on) { const P = W.platBy[b.on]; if (P && inPlat(P, b.x, b.y)) { b.z = platZ(P, b.x, b.y); return; } }
    let best = null, bz = -FAR;
    for (const Q of W.plats) { if (!inPlat(Q, b.x, b.y)) continue; const h = platZ(Q, b.x, b.y); if (h <= b.z + step + 1e-9 && h > bz) { best = Q; bz = h; } }
    const g = gz(W, b.x, b.y), hole = GH;
    if (g <= b.z + step + 1e-9 && g > bz && !underSolid(W, b.x, b.y)) { best = null; bz = g; }
    if (bz === -FAR) return;
    if (bz >= b.z - step - 1e-9 || (!best && hole && hole.bowl)) { b.on = best ? best.id : null; b.z = bz; return; }
    fallFrom(b, out);
  }
  function fallFrom(b, out) { b.air = true; b.vz = 0; b.fallFrom = b.z; b.on = null; if (out) out.push({ kind: "fall", z: b.z }); }
  // in the air: gravity, the impulse kept with no friction, solids by height, no acting; it lands on the highest surface under its centre
  // that it reaches, with the fall's height (a body that catches lips is never left in a deep hole: it goes to the nearest free point)
  function airStep(b, W, dt, out) {
    const N = W.N, z0 = b.z;
    b.vz -= N.g * dt;
    const z1 = z0 + b.vz * dt;
    b._wx = 0; b._wy = 0;
    const px = (b.ix || 0) * dt, py = (b.iy || 0) * dt, d = Math.hypot(px, py), n = d > N.substep ? Math.ceil(d / N.substep) : 1;
    for (let i = 0; i < n; i++) { const x0 = b.x, y0 = b.y; b.x += px / n; b.y += py / n; resolveLevel(b, W, x0, y0, out, false); }
    let land = null, lz = -FAR;
    for (const Q of W.plats) { if (!inPlat(Q, b.x, b.y)) continue; const h = platZ(Q, b.x, b.y); if (h <= z0 + 1e-9 && h >= z1 && h > lz) { land = Q; lz = h; } }
    const g = groundAt(W, b.x, b.y);
    if (!underSolid(W, b.x, b.y) && g.z >= z1 && g.z > lz) { land = null; lz = g.z; }   // the ground it falls through this step, or ground already above it (a push carried it out of a hole's bowl under the bank): it lands at once, never falling on under the world
    if (lz === -FAR) { b.z = z1; return; }
    let hole = !land && g.deep ? g.hole : null;
    b.air = false; b.vz = 0; b.z = lz; b.on = land ? land.id : null;
    if (hole && b.catches) { freePoint(W, b); b.z = groundAt(W, b.x, b.y).z; hole = null; }
    out.push({ kind: "land", H: b.fallFrom - (hole ? -hole.depth : lz), hole, structure: !!b.structFall, x: b.x, y: b.y, z: b.z });
    b.structFall = false;
  }
  // on a ladder: up at its climb speed, down at its other, along the ladder's line from its foot (z 0) to its head (z h); at the top it
  // steps onto the deck at the head, at the bottom 4 px out from the foot. The stick climbs when it points along the ladder's line
  function climbStep(b, intent, W, dt, out) {
    const L = b.climbing.ladder, w = intent.wish || ZERO, wm = Math.hypot(w[0], w[1]);
    let dir = intent.climb;
    if (dir === undefined) { const al = wm > 1e-9 ? (w[0] * L.into[0] + w[1] * L.into[1]) / wm : 0, tilt = intent.tilt === undefined ? (wm > 1e-9 ? 1 : 0) : intent.tilt; dir = tilt < 0.3 ? 0 : al > 0.5 ? 1 : al < -0.5 ? -1 : 0; }
    b._wx = 0; b._wy = 0;
    if (dir > 0) b.z = Math.min(L.h, b.z + b.climb[0] * dt); else if (dir < 0) b.z = Math.max(0, b.z - b.climb[1] * dt);
    const f = b.z / L.h;
    b.x = L.foot[0] + (L.head[0] - L.foot[0]) * f; b.y = L.foot[1] + (L.head[1] - L.foot[1]) * f;
    if (dir > 0 && b.z >= L.h - 1e-9) {
      const P = W.platBy[L.deck];
      b.climbing = null; L.by = null; b.on = P.id; b.x = L.head[0]; b.y = L.head[1]; b.z = platZ(P, b.x, b.y);
      out.push({ kind: "climb", at: "top" });
    } else if (dir < 0 && b.z <= 1e-9) {
      b.climbing = null; L.by = null; b.on = null; b.x = L.foot[0] - L.into[0] * OUT; b.y = L.foot[1] - L.into[1] * OUT; b.z = groundAt(W, b.x, b.y).z;
      out.push({ kind: "climb", at: "bottom" });
    }
  }
  // getting on a ladder: within 6 px of its foot (or, on the deck, of its head), the stick within 45 degrees of the way up (or down) at
  // tilt 0.5 or more, for 0.15 s, the ladder free; a body that cannot climb or is too heavy (a brute) or carries the ram never gets on
  function mount(b, intent, W, dt, out) {
    const C = W.N.climb, w = intent.wish || ZERO, wm = Math.hypot(w[0], w[1]), tilt = intent.tilt !== undefined ? intent.tilt : (b.speed ? wm / b.speed : 0);
    let want = null;
    if (b.climb && !b.carry && tilt >= 0.5 - 1e-9 && wm > 1e-9) {
      const ux = w[0] / wm, uy = w[1] / wm, cone = Math.cos(C.cone * RAD);
      for (const L of W.ladders) {
        if (!L.active || L.by !== null || massOf(b) > L.maxMass + 1e-9) continue;
        const along = ux * L.into[0] + uy * L.into[1];
        if (!b.on && Math.hypot(b.x - L.foot[0], b.y - L.foot[1]) <= C.within + 1e-9 && along >= cone - 1e-9) { want = { L, top: false }; break; }
        if (b.on === L.deck && Math.hypot(b.x - L.head[0], b.y - L.head[1]) <= C.within + 1e-9 && -along >= cone - 1e-9) { want = { L, top: true }; break; }
      }
    }
    if (!want) { b.mountT = 0; return false; }
    b.mountT = (b.mountT || 0) + dt;
    if (b.mountT < C.dwell - 1e-9) return false;
    const L = want.L;
    b.mountT = 0; b.dropT = 0; L.by = b.id; b.climbing = { ladder: L }; b.on = null; b.ix = 0; b.iy = 0; b.vx = 0; b.vy = 0; b.pushV = null; b.teeter = false;
    if (want.top) { b.z = L.h; b.x = L.head[0]; b.y = L.head[1]; } else { b.z = 0; b.x = L.foot[0]; b.y = L.foot[1]; }
    out.push({ kind: "climb", at: want.top ? "mountTop" : "mount" });
    return true;
  }
  // stepping off on purpose: at an open edge marked drop, the stick within 45 degrees of outward at tilt 0.5 or more for 0.25 s: the
  // centre goes just over the edge and the body falls
  function drop(b, intent, W, dt, out) {
    const LE = W.N.ledge, w = intent.wish || ZERO, wm = Math.hypot(w[0], w[1]), tilt = intent.tilt !== undefined ? intent.tilt : (b.speed ? wm / b.speed : 0);
    let ed = null;
    if (b.on && (tilt >= 0.5 - 1e-9 || intent.drop) && wm > 1e-9) {
      const cone = Math.cos(LE.dropCone * RAD);
      for (const id of W.ecells[cellAt(W, b.x, b.y)]) { const e = W.edges[id]; if (!e.drop || e.owner !== b.on) continue; if (sdist(e, b.x, b.y) > b.r + 0.5) continue; if (-(w[0] * e.nx + w[1] * e.ny) / wm < cone - 1e-9) continue; ed = e; break; }
    }
    if (!ed) { b.dropT = 0; return false; }
    b.dropT = (b.dropT || 0) + dt;
    if (b.dropT < LE.dropDwell - 1e-9) return false;
    b.dropT = 0;
    const sd = sdist(ed, b.x, b.y);
    b.x -= ed.nx * (sd + 0.5); b.y -= ed.ny * (sd + 0.5);
    fallFrom(b, out); out.push({ kind: "drop", edge: ed });
    return true;
  }
  // a body closer to a ledge than half its r teeters (the knight's frame); a lip it catches is a wall to it, not a ledge
  function teeter(b, W, out) {
    let t = false;
    if (!b.air) for (const id of W.ecells[cellAt(W, b.x, b.y)]) { const e = W.edges[id]; if (e.kind !== "ledge" || (e.deep && b.catches) || !edgeFor(W, e, b)) continue; if (sdist(e, b.x, b.y) < b.r * W.N.ledge.teeter) { t = true; break; } }
    if (t && !b.teeter) out.push({ kind: "teeter" });
    b.teeter = t;
  }

  // ------------------------------------------------------------------ pushes, bodies on bodies
  // a push of px along (ax, ay): an impulse of px x 12 / mass px/s (a staggered brute weighs 1), at most 480 px/s; it remembers the push
  // so that a ledge knows whether it was shoved over (30 px/s or more toward it)
  function push(W, b, ax, ay, px) {
    const N = W.N, m = massOf(b), v = px * N.impulseK / m;
    b.ix = (b.ix || 0) + ax * v; b.iy = (b.iy || 0) + ay * v;
    const s = Math.hypot(b.ix, b.iy);
    if (s > N.impulseMax) { b.ix *= N.impulseMax / s; b.iy *= N.impulseMax / s; }
    b.pushV = [b.ix, b.iy];
  }
  // where every body was at the step's start (the soft push's core puts a pair back on the sides they came from)
  function begin(W, list) { W.list = list; for (const b of list) { b.sx = b.x; b.sy = b.y; } }
  const paired = (a, b) => !a.climbing && !b.climbing && a.z < b.z + (b.h || 24) && a.z + (a.h || 24) > b.z;
  // bodies push each other softly: one pass over the pairs, each body in id order with its partners of higher id, in id order. Each of a
  // pair overlapping by o moves away by o x share x the other's mass / both masses (share 0.3 between knights, 0.5 with a troll or a
  // minion). A pair closer than its core (0.6 of their radii, 0.5 between knights) is first put straight to it along the pair's offset at
  // the step's start, so nobody passes through anybody. Every shove is resolved as self-motion: never over a ledge, into a solid or a hole
  function soft(W, list) {
    const S = W.N.soft, L = list.slice().sort((a, b) => a.id - b.id);
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const a = L[i], b = L[j], R = a.r + b.r;
      if (Math.abs(a.x - b.x) >= R || Math.abs(a.y - b.y) >= R || !paired(a, b)) continue;
      let dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
      if (d >= R) continue;
      const kk = a.knight && b.knight, share = kk ? S.knights : S.other, core = (kk ? S.coreKnights : S.core) * R, ma = massOf(a), mb = massOf(b), M = ma + mb;
      if (d < core - 1e-9) {
        let ux = (a.sx === undefined ? a.x : a.sx) - (b.sx === undefined ? b.x : b.sx), uy = (a.sy === undefined ? a.y : a.sy) - (b.sy === undefined ? b.y : b.sy), u = Math.hypot(ux, uy);
        if (u < 1e-9) { ux = dx; uy = dy; u = d; }
        if (u < 1e-9) { ux = 1; uy = 0; u = 1; }
        ux /= u; uy /= u;
        const cx = (a.x * ma + b.x * mb) / M, cy = (a.y * ma + b.y * mb) / M;
        shove(W, a, cx + ux * core * mb / M - a.x, cy + uy * core * mb / M - a.y);
        shove(W, b, cx - ux * core * ma / M - b.x, cy - uy * core * ma / M - b.y);
        dx = a.x - b.x; dy = a.y - b.y; d = Math.hypot(dx, dy);
        if (d >= R || d < 1e-9) continue;
      }
      const o = R - d, ux = dx / d, uy = dy / d;
      shove(W, a, ux * o * share * mb / M, uy * o * share * mb / M);
      shove(W, b, -ux * o * share * ma / M, -uy * o * share * ma / M);
    }
  }
  function shove(W, b, dx, dy) {
    if (b.climbing || (Math.abs(dx) < 1e-12 && Math.abs(dy) < 1e-12)) return;
    const x0 = b.x, y0 = b.y;
    b.x += dx; b.y += dy;
    resolveLevel(b, W, x0, y0, null, true);
    if (!b.air) surface(b, W, null);
  }
  // the final core pass, after the view has held the knights (which moved them without looking at other bodies): a troll or a minion too
  // close to a knight is put out to the core along their offset (resolved, and to the nearest free point if caught); two knights move
  // apart equally
  function cores(W, list) {
    const S = W.N.soft, L = list.slice().sort((a, b) => a.id - b.id);
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const a = L[i], b = L[j];
      if (!(a.knight || b.knight) || !paired(a, b)) continue;
      const kk = a.knight && b.knight, core = (kk ? S.coreKnights : S.core) * (a.r + b.r);
      let dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
      if (d >= core - 1e-9) continue;
      if (d < 1e-9) { dx = (a.sx === undefined ? 0 : a.sx - b.sx) || 1; dy = (a.sy === undefined ? 0 : a.sy - b.sy); d = Math.hypot(dx, dy); }
      const ux = dx / d, uy = dy / d;
      if (kk) { const m = (core - d) / 2; shove(W, a, ux * m, uy * m); shove(W, b, -ux * m, -uy * m); }
      else if (a.knight) shove(W, b, a.x - ux * core - b.x, a.y - uy * core - b.y);
      else shove(W, a, b.x + ux * core - a.x, b.y + uy * core - a.y);
    }
  }
  // the view's hold on a knight: its box, as self-motion (never over a ledge; if caught in a solid, the nearest free point)
  function hold(W, b) {
    if (b.climbing || b.air) return;
    const box = W.boxOf ? W.boxOf(b) : W.floor;
    if (b.x >= box.x0 && b.x <= box.x1 && b.y >= box.y0 && b.y <= box.y1) return;
    const x0 = b.x, y0 = b.y; resolveLevel(b, W, x0, y0, null, true);
    // the box's edge met a wall with the body between them (a lagging brother drawn along the chapel's face): the nearest free point inside
    // the box, as far as the wall's end, never a body left inside a solid
    if (caught(W, b)) freePoint(W, b, 128);
  }

  // ------------------------------------------------------------------ the level's doings
  // letting go of a ladder (a dodge, a hit, a freeze): it falls from where it is, 40 px/s away from the ladder when knocked off
  function letGo(W, b, kick) {
    const C = b.climbing; if (!C) return false;
    const L = C.ladder; L.by = null; b.climbing = null;
    fallFrom(b, null);
    if (kick) { b.ix = (b.ix || 0) - L.into[0] * W.N.climb.offPush; b.iy = (b.iy || 0) - L.into[1] * W.N.climb.offPush; b.pushV = [b.ix, b.iy]; }
    return true;
  }
  // a surface comes or goes (the drawbridge lands; the tower is felled): its edges are walked again
  function setPlatform(W, id, on) { const P = W.platBy[id]; if (!P || P.active === !!on) return P; P.active = !!on; buildEdges(W); changed(W, platBox(P)); return P; }
  // a platform's box in x and y (a box on the slant by its four corners)
  function platBox(P) {
    if (P.shape === "r") return [P.x0, P.y0, P.x1, P.y1];
    const xs = [], ys = []; for (const u of [P.u0, P.u1]) for (const v of [P.v0, P.v1]) { xs.push((u + v) / 2); ys.push((v - u) / 2); }
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }
  // the archer tower is felled: every body on its deck or its ladder falls from where it is, thrown along the fall (dir: a unit vector),
  // and lands by the "structure" row; the deck, its edges, its slab, parapets and legs and the ladder leave the world, and the poles lie
  // flat as ground cover along the fall (bodies under the deck or where the poles fall take nothing)
  function fellTower(W, deck, dir, list) {
    const P = W.platBy[deck]; if (!P || !P.active) return null;
    const F = W.N.fall.structure;
    for (const b of list || W.list) {
      const on = b.on === deck, up = b.climbing && b.climbing.ladder.deck === deck;
      if (!on && !up) continue;
      if (up) { b.climbing.ladder.by = null; b.climbing = null; }
      fallFrom(b, null); b.structFall = true;
      b.ix = (b.ix || 0) + dir[0] * F.throw; b.iy = (b.iy || 0) + dir[1] * F.throw; b.pushV = [b.ix, b.iy];
    }
    for (const s of W.solids) if (!s.gone && (s.plat === deck || s.tower === deck)) removeSolid(W, s);
    for (const L of W.ladders) if (L.deck === deck) { L.active = false; L.by = null; }
    P.active = false; buildEdges(W); changed(W, platBox(P));
    const cx = (P.x0 + P.x1) / 2, cy = (P.y0 + P.y1) / 2, len = (P.spec.legs && P.spec.legs.fall && P.spec.legs.fall.poles) || [40, 10];
    const r = dir[0] > 0.5 ? [cx, cy - len[1] / 2, cx + len[0], cy + len[1] / 2] : dir[0] < -0.5 ? [cx - len[0], cy - len[1] / 2, cx, cy + len[1] / 2]
      : dir[1] > 0.5 ? [cx - len[1] / 2, cy, cx + len[1] / 2, cy + len[0]] : [cx - len[1] / 2, cy - len[0], cx + len[1] / 2, cy];
    return addCover(W, { kind: "poles", shape: "r", x0: r[0], y0: r[1], x1: r[2], y1: r[3], on: null });
  }
  // a crater on the ground (a rock slam, a trebuchet's stone): a bowl r wide and depth deep at its centre, never on a platform or the
  // drawbridge; a body standing where it opens has its z snapped to the bowl, with no fall and no stagger
  function crater(W, x, y, r, depth) {
    for (const P of W.plats) if (P.active && inShape(P, x, y)) return null;
    const H = { id: W.holes.length, kind: "crater", shape: "c", bowl: true, x, y, r, depth, deep: false, cover: "crater" };
    W.holes.push(H); if (W.hcells) cellsOf(W, bboxOf(H), i => W.hcells[i].push(H)); changed(W, [x - r, y - r, x + r, y + r]);
    for (const b of W.list) if (!b.on && !b.air && !b.climbing && Math.hypot(b.x - x, b.y - y) < r) b.z = groundAt(W, b.x, b.y).z;
    return H;
  }
  const holeCells = (W, H, add) => { if (W.hcells) cellsOf(W, bboxOf(H), i => { const L = W.hcells[i], k = L.indexOf(H); if (add) { if (k < 0) L.push(H); } else if (k >= 0) L.splice(k, 1); }); };
  // a crater widened by a slam on it (the marks merge craters whose centres lie within 10 px), or filled in at the marks' cap: the ground
  // under the standing bodies follows, with no fall and no stagger
  function resizeCrater(W, H, r, depth) {
    const r0 = Math.max(H.r, r);
    H.r = r; H.depth = depth; holeCells(W, H, true); changed(W, [H.x - r0, H.y - r0, H.x + r0, H.y + r0]);
    for (const b of W.list) if (!b.on && !b.air && !b.climbing && Math.hypot(b.x - H.x, b.y - H.y) < r0) b.z = groundAt(W, b.x, b.y).z;
    return H;
  }
  function fillCrater(W, H) {
    if (!H || H.gone) return H;
    H.gone = true; holeCells(W, H, false); changed(W, [H.x - H.r, H.y - H.r, H.x + H.r, H.y + H.r]);
    for (const b of W.list) if (!b.on && !b.air && !b.climbing && Math.hypot(b.x - H.x, b.y - H.y) < H.r) b.z = groundAt(W, b.x, b.y).z;
    return H;
  }
  // what stops a shot at a floor point and height: a solid there taller than the shot (never a thin one), a slab, or a surface it has
  // come down to. Returns { solid } or { surface: z }, or null when the way is clear
  function shotStop(W, x, y, z, zPrev) {
    for (const id of W.cells[cellAt(W, x, y)]) {
      const s = W.solids[id];
      if (s.gone || s.thin || z < s.base || z >= s.base + s.ht) continue;
      if (s.shape === "c" ? Math.hypot(x - s.x, y - s.y) < s.r : s.shape === "r" ? inRect(x, y, s.x0, s.y0, s.x1, s.y1) : false) return { solid: s };
    }
    for (const s of W.halves) if (s.ax * x + s.ay * y >= s.c && z < s.ht) return { solid: s };
    const g = surfaceAt(W, x, y, zPrev === undefined ? z : zPrev);
    if (g && z <= g.z + 1e-9) return { surface: g.z, plat: g.plat };
    return null;
  }

  // ================================================================== the trolls' way: layered flow fields (section 3.5)
  // A field set covers one box of a level (an arena: 48 x 44 cells of 8 px a column, double for arena 5): the ground's grid; a small grid for
  // each platform with room to walk on (the chapel's roof, the archer tower's deck); and a row of nodes on the centre line of each narrow
  // one (the chapel's stair and landing: their pathRow), whose bands are narrower than a cell's blocking radius allows. A platform level
  // with the ground (the drawbridge) is part of the ground's grid. Each class of body (small: every troll of r 8 or less; large: the
  // brutes) has its own map of the nodes it can stand on (clear by its radius of every solid at the layer's height, never in a deep hole,
  // never nearer than its radius to a ledge or a wall it would meet; the deck's slab blocks only the large, by height; the large tears
  // wire, at 1.5), each node's cost by its cover, and its own links between layers: a walk where two layers meet within a step (6 px)
  // with no edge between them, a one-way drop through a drop ledge (+24), the ladder for the small class (its climb time in walking px).
  // A field is a reverse Dijkstra over one class's map from a knight (a binary heap over typed arrays, ties by node index): dist[n] is the
  // walking cost from node n to the knight. The maps follow the world's change log (a crater, a cut wire, a fallen tower) node by node in
  // the boxes that changed. Nothing here touches a fight: no random number, no id.
  //   fieldSet(W, box, classes)  the nodes of a box; classes: { name: { r, h, fits, mass, cost: { cover: x }, tears: [contact], tearCost,
  //                              narrow, ladder: { up, down, speed, dwell } } }
  //   fieldUpdate(set)           the maps brought up to the world's changes (true when anything changed: every field of the set is stale)
  //   field(set, cls), fieldBuild(set, F, seeds), fieldSeeds(set, cls, b), nodeOf(set, b), fieldNext(set, F, n), nodeAt(set, n)
  const FG = 8, JOIN = 12.5, DROPR = 20, SQ8 = 8 * SQ2;
  function fieldSet(W, box, classes) {
    const layers = [], L0 = { kind: "ground", id: null, i0: 0, nx: Math.ceil((box.x1 - box.x0) / FG - 1e-9), ny: Math.ceil((box.y1 - box.y0) / FG - 1e-9), x0: box.x0, y0: box.y0 };
    L0.n = L0.nx * L0.ny; layers.push(L0);
    let N = L0.n;
    for (const P of W.plats) {
      if (P.shape !== "r" || P.x1 <= box.x0 || P.x0 >= box.x1 || P.y1 <= box.y0 || P.y0 >= box.y1) continue;
      const row = (P.spec || {}).pathRow;
      if (row !== undefined) { const xs = []; for (let x = P.x0 + FG / 2; x < P.x1; x += FG) xs.push(x); layers.push({ kind: "row", id: P.id, plat: P, i0: N, n: xs.length, xs, y: row }); N += xs.length; continue; }
      if (Math.abs(P.z) <= W.N.stepUp && P.rise === undefined) continue;
      const nx = Math.ceil((P.x1 - P.x0) / FG - 1e-9), ny = Math.ceil((P.y1 - P.y0) / FG - 1e-9);
      layers.push({ kind: "grid", id: P.id, plat: P, i0: N, n: nx * ny, nx, ny, x0: P.x0, y0: P.y0 }); N += nx * ny;
    }
    const set = { W, box, layers, layerBy: {}, N, x: new Float64Array(N), y: new Float64Array(N), z: new Float64Array(N), lay: new Uint8Array(N), on: new Array(N).fill(null), open: new Uint8Array(N),
      cls: {}, names: Object.keys(classes), seen: -1, coverN: 0, ver: 0, tab: 0, heapN: new Int32Array(9 * N + 256), heapD: new Float32Array(9 * N + 256), linkBox: null };
    layers.forEach((L, li) => {
      if (L.id) set.layerBy[L.id] = L;
      L.index = li;
      // the links between layers change only where a change comes near a platform layer or a ladder's foot
      if (li > 0) { const P = L.plat, pad = DROPR + 12 + FG, b = set.linkBox || (set.linkBox = [Infinity, Infinity, -Infinity, -Infinity]); b[0] = Math.min(b[0], P.x0 - pad); b[1] = Math.min(b[1], P.y0 - pad); b[2] = Math.max(b[2], P.x1 + pad); b[3] = Math.max(b[3], P.y1 + pad); }
      for (let k = 0; k < (L.kind === "row" ? L.n : L.nx * L.ny); k++) {
        const n = L.i0 + k; set.lay[n] = li;
        if (L.kind === "row") { set.x[n] = L.xs[k]; set.y[n] = L.y; }
        else { set.x[n] = L.x0 + FG / 2 + FG * (k % L.nx); set.y[n] = L.y0 + FG / 2 + FG * Math.floor(k / L.nx); }
      }
    });
    for (const name of set.names) set.cls[name] = Object.assign({ name, ok: new Uint8Array(N), mult: new Float32Array(N).fill(1), out: [], in: [] }, classes[name]);
    fieldUpdate(set);
    return set;
  }
  // the maps follow the world: the nodes inside each box the change log names since the set last looked are judged again, then the links
  // between layers are found again (all of them: they are few). A cover laid without the log (a test's) judges every node again. Returns
  // true when the fields are stale: a change that was not soft (a live mark's cover coming or going judges its nodes but leaves the fields
  // to their 0.5 s rebuild). The cover is counted as the list plus what was taken up (W.coverSwept), so a removal is no mismatch
  function fieldUpdate(set) {
    const W = set.W, log = W.changes || [], covers = W.cover.length + (W.coverSwept || 0);
    if (set.seen === log.length && set.coverN === covers) return false;
    let full = set.seen < 0, logged = 0, hard = full;
    for (let i = Math.max(0, set.seen); i < log.length; i++) if (log[i].cover) logged++;
    if (!full && covers !== set.coverN + logged) full = hard = true;
    let near = full;
    if (full) { for (let n = 0; n < set.N; n++) judge(set, n); wire(set); }
    else {
      // only the nodes in each change's padded box are judged, and only those whose tables changed (open, z, a class's ok or cost) are
      // wired again, with their in-layer neighbours (whose step tables name them): byte for byte what wiring the whole set would give
      const pad = 12 + FG, LB = set.linkBox, dirty = set.dirty || (set.dirty = new Uint8Array(set.N)), touched = [];
      for (let i = set.seen; i < log.length; i++) {
        const c = log[i];
        if (!c.soft) hard = true;
        if (LB && c.x1 >= LB[0] && c.x0 <= LB[2] && c.y1 >= LB[1] && c.y0 <= LB[3]) near = true;
        for (const L of set.layers) {
          if (L.kind === "row") { for (let k = 0; k < L.n; k++) { const n = L.i0 + k; if (set.x[n] >= c.x0 - pad && set.x[n] <= c.x1 + pad && set.y[n] >= c.y0 - pad && set.y[n] <= c.y1 + pad) rejudge(set, n, dirty, touched); } continue; }
          const i0 = clamp(Math.floor((c.x0 - pad - L.x0) / FG), 0, L.nx - 1), i1 = clamp(Math.floor((c.x1 + pad - L.x0) / FG), 0, L.nx - 1);
          const j0 = clamp(Math.floor((c.y0 - pad - L.y0) / FG), 0, L.ny - 1), j1 = clamp(Math.floor((c.y1 + pad - L.y0) / FG), 0, L.ny - 1);
          if (c.x1 + pad < L.x0 || c.x0 - pad > L.x0 + L.nx * FG || c.y1 + pad < L.y0 || c.y0 - pad > L.y0 + L.ny * FG) continue;
          for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) rejudge(set, L.i0 + j * L.nx + i, dirty, touched);
        }
      }
      for (const n of touched) { dirty[n] = 0; for (const name of set.names) { const c = set.cls[name]; wireNode(set, c, n); forNeighbours(set, n, u => wireNode(set, c, u)); } }
    }
    if (near) for (const name of set.names) links(set, set.cls[name]);
    set.seen = log.length; set.coverN = covers; if (hard) set.ver++; set.tab++;
    return hard;
  }
  // a node judged again; when a table of it changed it is noted once for the wiring
  function rejudge(set, n, dirty, touched) {
    const names = set.names, z0 = set.z[n], open0 = set.open[n], on0 = set.on[n];
    let ok0 = 0, m0 = 0, changed = false;
    const K = names.length, okb = set.okBuf || (set.okBuf = new Uint8Array(16)), mb = set.multBuf || (set.multBuf = new Float32Array(16));
    for (let i = 0; i < K; i++) { const c = set.cls[names[i]]; okb[i] = c.ok[n]; mb[i] = c.mult[n]; }
    judge(set, n);
    if (set.z[n] !== z0 || set.open[n] !== open0 || set.on[n] !== on0) changed = true;
    else for (let i = 0; i < K; i++) { const c = set.cls[names[i]]; if (c.ok[n] !== okb[i] || c.mult[n] !== mb[i]) { changed = true; break; } }
    if (changed && !dirty[n]) { dirty[n] = 1; touched.push(n); }
  }
  // a node's in-layer neighbours (a grid's 8, a row's 2), the ones whose step tables can name it
  function forNeighbours(set, n, fn) {
    const L = set.layers[set.lay[n]];
    if (L.kind === "row") { if (n - 1 >= L.i0) fn(n - 1); if (n + 1 < L.i0 + L.n) fn(n + 1); return; }
    const k = n - L.i0, ci = k % L.nx, cj = (k - ci) / L.nx;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const i2 = ci + di, j2 = cj + dj; if (i2 < 0 || j2 < 0 || i2 >= L.nx || j2 >= L.ny) continue; fn(L.i0 + j2 * L.nx + i2); }
  }
  // one node judged for every class: what a body stands on there (the ground, a platform level with it, or its own layer's platform), and
  // whether a body of the class's radius and height can stand there, and at what cost
  const PROBE = { x: 0, y: 0, z: 0, r: 8, h: 25, on: null, foe: true };   // the fields are the trolls': cover meant for trolls alone counts
  function judge(set, n) {
    const W = set.W, L = set.layers[set.lay[n]], x = set.x[n], y = set.y[n], step = W.N.stepUp;
    let on = null, z = 0, open = true;
    if (L.kind === "ground") {
      const s = surfaceAt(W, x, y, step);
      if (!s || (s.plat && (Math.abs(s.z) > step || (s.plat.spec || {}).pathRow !== undefined))) open = false;
      else if (s.plat) { on = s.plat.id; z = s.z; }
      else { z = s.z; if (s.hole && s.hole.deep) open = false; }
    } else { const P = L.plat; if (!P.active || !inShape(P, x, y)) open = false; else { on = P.id; z = platZ(P, x, y); } }
    set.z[n] = z; set.on[n] = on; set.open[n] = open ? 1 : 0;
    const cell = cellAt(W, x, y);
    for (const name of set.names) {
      const c = set.cls[name];
      let ok = open && !(L.kind === "row" && (!c.narrow || (L.plat.maxR !== undefined && c.fits > L.plat.maxR + 1e-9))), m = 1;
      PROBE.x = x; PROBE.y = y; PROBE.z = z; PROBE.r = c.r; PROBE.h = c.h; PROBE.on = on;
      const r = L.kind === "row" ? Math.min(c.r, c.fits) : c.r;   // a row's nodes are tested with the walking kind's own radius
      if (ok) for (const id of W.cells[cell]) {
        const s = W.solids[id];
        if ((s.kind === "clod" && !c.clods) || !blocks(s, PROBE) || !out(s, x, y, r)) continue;   // clods are left out of the trolls' fields: bodies slide round them (section 3.5); a class with `clods` (the bots' knight) walks round them
        if (c.tears && s.contact && c.tears.includes(s.contact)) { m = Math.max(m, c.tearCost || 1); continue; }
        ok = false; break;
      }
      if (ok) for (const s of W.halves) if (blocks(s, PROBE) && out(s, x, y, r)) { ok = false; break; }
      if (ok) for (const d of W.dummies) if (Math.hypot(x - d.x, y - d.y) < r + d.r) { ok = false; break; }
      if (ok) for (const id of W.ecells[cell]) {
        const e = W.edges[id];
        if (e.owner !== (on || "ground") || (e.rMin !== undefined && !(c.fits > e.rMin + 1e-9))) continue;
        if (sdist(e, x, y) < r - 1e-9) { ok = false; break; }
      }
      if (ok) m *= coverCost(W, PROBE, x, y, c.cost);   // the dearest cover under the node: fire in a trench or a crater costs the fire's 4
      c.ok[n] = ok ? 1 : 0; c.mult[n] = m;
    }
  }
  // the links of a class between layers: walks where two layers meet (within a step, no edge of the first's between them), one-way drops
  // through a drop ledge, and the ladders for a class that climbs and weighs no more than a ladder carries
  function links(set, c) {
    const W = set.W;
    c.out = []; c.in = []; c.reach = set.layers.map(L => L.kind === "ground");   // the layers a body of the class can come onto
    const add = (u, v, cost, kind, ladder) => {
      for (const l of c.out[u] || []) if (l.v === v) return;   // one link a pair (a crossing seen from two cells)
      (c.out[u] || (c.out[u] = [])).push({ v, cost, kind, ladder }); (c.in[v] || (c.in[v] = [])).push({ u, cost });
    };
    const tryLink = (u, v) => {
      const xu = set.x[u], yu = set.y[u], xv = set.x[v], yv = set.y[v], d = Math.hypot(xv - xu, yv - yu);
      if (d > DROPR) return;
      const own = set.on[u] || "ground", c0 = cellAt(W, xu, yu), c1 = cellAt(W, xv, yv), c2 = cellAt(W, (xu + xv) / 2, (yu + yv) / 2);
      let wall = false, drop = false, ledge = false;
      for (const cell of c0 === c1 && c1 === c2 ? [c0] : [c0, c1, c2]) for (const id of W.ecells[cell]) {
        const e = W.edges[id];
        if (e.owner !== own || (e.rMin !== undefined && !(c.fits > e.rMin + 1e-9)) || !crosses(xu, yu, xv, yv, e)) continue;
        if (e.kind === "wall") wall = true; else if (e.drop) drop = true; else ledge = true;
      }
      if (wall || ledge) return;
      const dz = set.z[v] - set.z[u], m = (c.mult[u] + c.mult[v]) / 2, up = set.layers[set.lay[v]].kind === "row" && dz > 1e-9 ? (c.stairUp || 1) : 1;
      if (!drop && Math.abs(dz) <= W.N.stepUp + 1e-9 && d <= JOIN) add(u, v, d * m * up, "walk");
      else if (drop && -dz > W.N.stepUp) add(u, v, (c.drop || 24) + d * m, "drop");
    };
    const L0 = set.layers[0];
    for (let a = 1; a < set.layers.length; a++) {
      const A = set.layers[a];
      for (let k = 0; k < (A.kind === "row" ? A.n : A.nx * A.ny); k++) {
        const u = A.i0 + k;
        if (!c.ok[u]) continue;
        const x = set.x[u], y = set.y[u];
        // the ground's cells within reach, both ways
        const i0 = Math.max(0, Math.floor((x - DROPR - L0.x0) / FG)), i1 = Math.min(L0.nx - 1, Math.floor((x + DROPR - L0.x0) / FG));
        const j0 = Math.max(0, Math.floor((y - DROPR - L0.y0) / FG)), j1 = Math.min(L0.ny - 1, Math.floor((y + DROPR - L0.y0) / FG));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const v = j * L0.nx + i; if (c.ok[v]) { tryLink(u, v); tryLink(v, u); } }
        // the nodes of the later layers, both ways
        for (let b = a + 1; b < set.layers.length; b++) { const B = set.layers[b]; for (let q = 0; q < (B.kind === "row" ? B.n : B.nx * B.ny); q++) { const v = B.i0 + q; if (c.ok[v]) { tryLink(u, v); tryLink(v, u); } } }
      }
    }
    // the ladders: foot (the ground's nearest node) to head (the deck's nearest), up at the climb's time and down at its other, each with
    // the 0.15 s of getting on, in walking px
    if (c.ladder) for (const Ld of W.ladders) {
      const D = set.layerBy[Ld.deck];
      if (!Ld.active || !D || (c.mass || 1) > Ld.maxMass + 1e-9) continue;
      const near = (L, p) => { let best = -1, bd = JOIN; for (let k = 0; k < (L.kind === "row" ? L.n : L.nx * L.ny); k++) { const n = L.i0 + k; if (!c.ok[n]) continue; const dd = Math.hypot(set.x[n] - p[0], set.y[n] - p[1]); if (dd < bd - 1e-9) { bd = dd; best = n; } } return best; };
      const foot = near(L0, Ld.foot), head = near(D, Ld.head), Cl = c.ladder;
      if (foot < 0 || head < 0) continue;
      add(foot, head, (Ld.h / Cl.up + Cl.dwell) * Cl.speed, "ladder", Ld);
      add(head, foot, (Ld.h / Cl.down + Cl.dwell) * Cl.speed, "ladder", Ld);
    }
    // the layers the class can come onto: those its links lead to from the ground, and on from them
    for (let again = true; again;) { again = false; for (let u = 0; u < set.N; u++) { if (!c.reach[set.lay[u]] || !c.out[u]) continue; for (const l of c.out[u]) if (!c.reach[set.lay[l.v]]) { c.reach[set.lay[l.v]] = true; again = true; } } }
      // dense tables over the sparse lists: the nodes with links in, and out, by index (-1: none)
    const N = set.N, inAt = c.inAt || (c.inAt = new Int32Array(N)), outAt = c.outAt || (c.outAt = new Int32Array(N)); inAt.fill(-1); outAt.fill(-1);
    c.inL = []; c.outL = [];
    for (let n = 0; n < N; n++) { if (c.in[n]) { inAt[n] = c.inL.length; c.inL.push(c.in[n]); } if (c.out[n]) { outAt[n] = c.outL.length; c.outL.push(c.out[n]); } }
  }

  function field(set, cls) { return { cls, dist: new Float32Array(set.N).fill(Infinity), built: false, ver: -1, tab: -1, key: null }; }
  // the step tables of a class, after its nodes were judged: each node's in-layer neighbours (a grid's 8, a diagonal only past two open
  // sides; a row's 2) in a flat Int32Array, with the cost of stepping to each (nc) and back from each (nr: a stair's rise costs more one
  // way), so the Dijkstra and the next step read flat arrays
  function wire(set) {
    const N = set.N;
    for (const name of set.names) {
      const c = set.cls[name]; c.nb || (c.nb = new Int32Array(N * 8)); c.nc || (c.nc = new Float32Array(N * 8)); c.nr || (c.nr = new Float32Array(N * 8));
      for (let n = 0; n < N; n++) wireNode(set, c, n);
    }
  }
  // one node's step table for a class: its in-layer neighbours it can step to (none when it cannot stand there), in a fixed order
  function wireNode(set, c, n) {
    const ok = c.ok, mult = c.mult, NB = c.nb, NC = c.nc, NR = c.nr, up = c.stairUp || 1, L = set.layers[set.lay[n]], o = n * 8;
    for (let j = 0; j < 8; j++) NB[o + j] = -1;
    if (!ok[n]) return;
    let j = 0;
    if (L.kind === "row") {
      for (let u = n - 1; u <= n + 1; u += 2) {
        if (u < L.i0 || u >= L.i0 + L.n || !ok[u]) continue;
        const m = FG * (mult[n] + mult[u]) * 0.5;
        NB[o + j] = u; NC[o + j] = m * (set.z[u] > set.z[n] + 1e-9 ? up : 1); NR[o + j] = m * (set.z[n] > set.z[u] + 1e-9 ? up : 1); j++;
      }
      return;
    }
    const k = n - L.i0, ci = k % L.nx, cj = (k - ci) / L.nx;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const i2 = ci + di, j2 = cj + dj;
      if (i2 < 0 || j2 < 0 || i2 >= L.nx || j2 >= L.ny) continue;
      const u = L.i0 + j2 * L.nx + i2;
      if (!ok[u] || (di && dj && (!ok[L.i0 + cj * L.nx + i2] || !ok[L.i0 + j2 * L.nx + ci]))) continue;
      const m = (di && dj ? SQ8 : FG) * (mult[n] + mult[u]) * 0.5;
      NB[o + j] = u; NC[o + j] = m; NR[o + j] = m; j++;
    }
  }
  // the node a body stands on: its platform's (the nearest of a row), else the ground's cell under it, kept inside the box
  function nodeOf(set, b) {
    const L = b.on && set.layerBy[b.on];
    if (L && L.kind === "row") return L.i0 + clamp(Math.round((b.x - L.xs[0]) / FG), 0, L.n - 1);
    const G = L || set.layers[0];
    return G.i0 + clamp(Math.floor((b.y - G.y0) / FG), 0, G.ny - 1) * G.nx + clamp(Math.floor((b.x - G.x0) / FG), 0, G.nx - 1);
  }
  const nodeAt = (set, n) => [set.x[n], set.y[n]];
  // can a body of the class come onto the layer a body stands on (a brute never onto the roof or the deck)?
  function fieldReach(set, cls, b) { const L = b.on && set.layerBy[b.on]; return !L || !!set.cls[cls].reach[L.index]; }
  // where a field starts for a body: the node it stands on (on the ladder, its foot or its head by its height), or, when that node is not
  // the class's, the class's nodes of the same layer within two cells; and when its layer is one the class cannot come onto (a brute and
  // a knight on the roof), the ground's nodes nearest it, so a body that cannot reach it waits at the reachable cell nearest it.
  // [node, cost] pairs
  function fieldSeeds(set, cls, b) {
    const c = set.cls[cls], out = [];
    let n = -1;
    if (b.climbing) {
      const Ld = b.climbing.ladder, top = b.z >= Ld.h / 2, p = top ? Ld.head : Ld.foot, L = top ? set.layerBy[Ld.deck] : set.layers[0];
      if (L && L.kind !== "row") n = nodeOf(set, { x: p[0], y: p[1], on: top ? Ld.deck : null });
    } else n = nodeOf(set, b);
    const L = n >= 0 ? set.layers[set.lay[n]] : set.layers[0];
    if (c.reach[L.index]) {
      if (n >= 0 && c.ok[n]) { out.push([n, Math.hypot(set.x[n] - b.x, set.y[n] - b.y)]); return out; }
      if (L.kind === "row") { for (let k = 0; k < L.n; k++) { const m = L.i0 + k; if (!c.ok[m]) continue; const d = Math.hypot(set.x[m] - b.x, set.y[m] - b.y); if (d <= 2 * FG) out.push([m, d]); } }
      else if (n >= 0) { const i = n - L.i0, ci = i % L.nx, cj = (i - ci) / L.nx; for (let j = Math.max(0, cj - 2); j <= Math.min(L.ny - 1, cj + 2); j++) for (let q = Math.max(0, ci - 2); q <= Math.min(L.nx - 1, ci + 2); q++) { const m = L.i0 + j * L.nx + q; if (c.ok[m]) out.push([m, Math.hypot(set.x[m] - b.x, set.y[m] - b.y)]); } }
      if (out.length) return out;
    }
    // the ground's nodes nearest it (within a cell of the nearest), their cost the extra way
    const G = set.layers[0]; let best = Infinity;
    for (let m = 0; m < G.n; m++) if (c.ok[m]) best = Math.min(best, Math.hypot(set.x[m] - b.x, set.y[m] - b.y));
    if (best < Infinity) for (let m = 0; m < G.n; m++) if (c.ok[m]) { const d = Math.hypot(set.x[m] - b.x, set.y[m] - b.y); if (d <= best + FG) out.push([m, d - best]); }
    return out;
  }
  // the reverse Dijkstra: from the seeds outward over the class's map, each node's walking cost to them (Infinity where none reaches).
  // A binary heap over the set's typed arrays (grown if a build ever needs more), ties by node index, so a build is the same on every run
  function fieldBuild(set, F, seeds) {
    let key = ""; for (const sd of seeds) key += sd[0] + ":" + sd[1] + ";";
    if (F.built && F.tab === set.tab && F.key === key) return F;   // the same seeds over the same tables: the field it has is the one a build would give
    const c = set.cls[F.cls], D = F.dist, ok = c.ok, NB = c.nb, NR = c.nr, INAT = c.inAt, INL = c.inL;
    let HN = set.heapN, HD = set.heapD, cap = HN.length, size = 0;
    D.fill(Infinity);
    const push = (n, d) => {
      if (size >= cap) { const N2 = new Int32Array(cap * 2), D2 = new Float32Array(cap * 2); N2.set(HN); D2.set(HD); HN = set.heapN = N2; HD = set.heapD = D2; cap *= 2; }
      let i = size++;
      while (i > 0) { const p = (i - 1) >> 1; if (HD[p] < d || (HD[p] === d && HN[p] < n)) break; HN[i] = HN[p]; HD[i] = HD[p]; i = p; }
      HN[i] = n; HD[i] = d;
    };
    for (const [n, d0] of seeds) if (ok[n] && d0 < D[n]) { D[n] = d0; push(n, D[n]); }
    while (size > 0) {
      const v = HN[0], d = HD[0];
      // pop: the last entry sifts down from the root
      const ln = HN[--size], ld = HD[size];
      let i = 0;
      for (;;) { let l = 2 * i + 1; if (l >= size) break; const r = l + 1; if (r < size && (HD[r] < HD[l] || (HD[r] === HD[l] && HN[r] < HN[l]))) l = r; if (HD[l] > ld || (HD[l] === ld && HN[l] > ln)) break; HN[i] = HN[l]; HD[i] = HD[l]; i = l; }
      if (size > 0) { HN[i] = ln; HD[i] = ld; }
      if (d > D[v]) continue;
      // the nodes that step to v in their own layer, then the links into it
      const o = v * 8;
      for (let j = 0; j < 8; j++) { const u = NB[o + j]; if (u < 0) break; const nd = d + NR[o + j]; if (nd < D[u]) { D[u] = nd; push(u, nd); } }
      const li = INAT ? INAT[v] : -1;
      if (li >= 0) { const inl = INL[li]; for (let q = 0; q < inl.length; q++) { const l = inl[q]; if (!ok[l.u]) continue; const nd = d + l.cost; if (nd < D[l.u]) { D[l.u] = nd; push(l.u, nd); } } }
    }
    F.built = true; F.ver = set.ver; F.tab = set.tab; F.key = key;
    return F;
  }
  // the next node from n down the field: the neighbour (or the link) with the least cost to it plus its own cost onward, when that beats
  // staying (less than n's own cost), ties to the lower node; { n, kind: walk | drop | ladder, ladder, cost } or null when nothing leads on.
  // A node the class cannot stand on (a body pushed into a tight spot) still looks at its layer's neighbours
  function fieldNext(set, F, n) {
    const c = set.cls[F.cls], D = F.dist, NB = c.nb, NC = c.nc, mult = c.mult, dn = D[n];
    let best = -1, bc = Infinity, kind = "walk", ladder = null;
    // only downhill (a node nearer the seeds than n), the least way through it; at the seed's own node nothing leads on
    const take = (v, cost, kd, ld) => { if (!(D[v] < dn - 1e-9)) return; const t = cost + D[v]; if (t < bc - 1e-9 || (t <= bc + 1e-9 && v < best)) { bc = t; best = v; kind = kd; ladder = ld || null; } };
    if (c.ok[n]) { const o = n * 8; for (let j = 0; j < 8; j++) { const v = NB[o + j]; if (v < 0) break; if (D[v] < Infinity) take(v, NC[o + j], "walk", null); } }
    else {
      const L = set.layers[set.lay[n]];
      if (L.kind === "row") { for (let v = n - 1; v <= n + 1; v += 2) if (v >= L.i0 && v < L.i0 + L.n && c.ok[v] && D[v] < Infinity) take(v, FG * (mult[n] + mult[v]) * 0.5, "walk", null); }
      else {
        const k = n - L.i0, ci = k % L.nx, cj = (k - ci) / L.nx;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const i2 = ci + di, j2 = cj + dj;
          if (i2 < 0 || j2 < 0 || i2 >= L.nx || j2 >= L.ny) continue;
          const v = L.i0 + j2 * L.nx + i2;
          if (c.ok[v] && D[v] < Infinity) take(v, (di && dj ? SQ8 : FG) * (mult[n] + mult[v]) * 0.5, "walk", null);
        }
      }
    }
    const oi = c.outAt ? c.outAt[n] : -1;
    if (oi >= 0) for (const l of c.outL[oi]) if (D[l.v] < Infinity) take(l.v, l.cost, l.kind, l.ladder);
    return best < 0 ? null : { n: best, kind, ladder, cost: bc };
  }

  root.Physics = { world, move, resolve, settle, DRIVES, push, begin, soft, cores, hold, letGo, setPlatform, fellTower, crater, resizeCrater, fillCrater, shotStop,
    addSolid, removeSolid, addPiece, addCover, removeCover, coverChanged, coverNear, coverCost, cellAt, groundAt, surfaceAt, platZ, inPlat, inShape, coverOf, freePoint, caught, out, blocks, sdist, segQ, edgeFor, buildEdges, massOf,
    fieldSet, fieldUpdate, field, fieldBuild, fieldSeeds, fieldNext, fieldReach, nodeOf, nodeAt };
  if (typeof module !== "undefined" && module.exports) module.exports = root.Physics;
})(typeof window !== "undefined" ? window : globalThis);
