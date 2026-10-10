// FORGE FOREVER: the class signatures (design pass 38, weapon identities; built by card t96 as its revision 1). One rule set for every
// blow in the game: a weapon's class carries a signature (hammers stagger, daggers bleed, the sword ripostes, the spear counters...) that
// acts whoever swings and whoever is struck; every body has poise that breaks into a stagger and a critical; the knight has a Guard with
// a parry. proto/combat.js calls this file at four seams (classOf, onHit, onHurt, step) and hands it a host of its own functions (emit,
// cancelAct, applyStatus, damage, stagger, stamp, putRam, the physics); each seam is a no-op when spec/signatures.json is absent or its
// `on` is false, and then the rules of build 26 play event for event. Pure: no DOM, no clock, no Math.random; every number is the spec's.
//
//   Signatures.on()                       the spec is loaded and on
//   Signatures.classOf(u)                 the class of a weapon's units: its base (a legend's body's), else its form's stand-in
//   Signatures.sigOf(cls)                 the class's rule { signature, poise, ... }
//   Signatures.poiseMax(kind)             a body's poise by kind (knight, brother, a troll kind, a dummy kind); null for none
//   Signatures.initBody(fight, b, kind)   the poise fields on a body
//   Signatures.blowPoise(u, o)            the poise a knight's blow takes
//   Signatures.onHit(H, fight, k, d, u, o, h)      the seam in hit(): { dmg, tag, crit, statuses, pull, after }
//   Signatures.onHurt(H, fight, k, o, dmg)        the seam in hurt(): { res, dmg, push, sets, stagger, pull, tag, after }
//   Signatures.step(H, fight, dt)         the clocks: regrowth, the reels, the frenzy and the band, the knight's bleed
//   Signatures.mobAttack(src)             a troll attack's row of the spec's mobs, by its src "kind.attack"
//   Signatures.extraAttacks(kind)         the attacks the spec adds to a kind's kit (the winchman's hook)
//   Signatures.words                      plaqueLine(cls), bayWord(cls), hint(kind), levelLine(area), signatureOf(cls)
// Plain script, defines window.Signatures (module.exports in node).
(function (root) {
  "use strict";
  const TAU = Math.PI * 2, RAD = Math.PI / 180;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
  let SPEC = null;
  function spec() { if (!SPEC) SPEC = root.FORGE_SIGNATURES || null; return SPEC; }
  function use(s) { SPEC = s; }
  const on = () => { const S = spec(); return !!(S && S.on !== false); };
  const LARGE = () => (spec().poise.large || ["brute", "rockbrute"]);
  const BOSS = () => (spec().poise.boss || ["wizard"]);
  const isLarge = kind => LARGE().includes(kind), isBoss = kind => BOSS().includes(kind);
  const small = f => !!f && !!f.foe && !isLarge(f.kind) && !isBoss(f.kind);

  // ------------------------------------------------------------------ the classes
  function classOf(u) {
    const S = spec(), C = S ? S.classes : null;
    if (!u) return "sword";
    if (u.ram) return "hammer";
    const b = u.base === "claws" ? "claw" : u.base;
    if (C && C[b] && b !== "legendary" && b !== "byForm") return b;
    return ((C && C.byForm) || {})[u.form] || "sword";
  }
  // the class of a weapon record (no units: the Forge page has no rules loaded): its base, a legend's body's base, else its form's stand-in
  function classOfThing(t) {
    const S = spec(), C = S ? S.classes : null, w = t && t.weapon; if (!w || !C) return null;
    const v = w.visual || {}, b = v.base === "claws" ? "claw" : v.base;
    if (b && C[b] && b !== "legendary" && b !== "byForm") return b;
    return (C.byForm || {})[w.form] || "sword";
  }
  function sigOf(cls) { const C = spec().classes; return C[cls] && typeof C[cls] === "object" && cls !== "byForm" ? C[cls] : C.sword; }
  function blowPoise(u, o) {
    const S = spec(), C = sigOf(classOf(u));
    let p = typeof C.poise === "number" ? C.poise : S.classes.sword.poise;
    if (u.isFinisher) p = typeof C.finisherPoise === "number" ? C.finisherPoise : p * (S.poise.finisherX || 1.5);
    if (o && o.kind === "tick") p *= (o.share || 1);
    return p;
  }
  // the combo window a class keeps its chain alive for (the sword's longer one), else the given default
  const comboWindow = (u, dflt) => { const C = sigOf(classOf(u)); return typeof C.window === "number" ? C.window : dflt; };
  // the rate factor of a hand: the claws' frenzy stacks and the horn's band on its knight
  function rateX(fight, k, hand) {
    let x = 1;
    if (hand && hand.frenzy && hand.frenzy.until > fight.t) x *= 1 + hand.frenzy.rate * hand.frenzy.n;
    if (k && k.bandUntil > fight.t) x *= 1 + (k.bandRate || 0);
    return x;
  }
  // what a blow does on the troll knight's shield: { take, crush, ignore }
  function shieldOf(u, o) {
    const C = sigOf(classOf(u)), out = { take: null, crush: 1, ignore: false };
    if (typeof C.throughShield === "number") out.take = C.throughShield;
    if (C.crush && (classOf(u) !== "flail" || u.isFinisher)) out.crush = C.crush;
    if (C.shieldX) out.crush = C.shieldX;
    if (C.finisherIgnoresShield && u.isFinisher) out.ignore = true;
    return out;
  }
  const statusTimeX = u => { const C = sigOf(classOf(u)); return typeof C.statusTimeX === "number" ? C.statusTimeX : 1; };
  const areaX = u => { const C = sigOf(classOf(u)); return typeof C.areaX === "number" ? C.areaX : 1; };

  // ------------------------------------------------------------------ poise on a body
  function poiseMax(kind) { const P = spec().poise.max, v = P[kind]; if (v === null) return null; return v === undefined ? (P.other === undefined ? 40 : P.other) : v; }
  const groupOf = (kind, knight) => knight ? "knight" : kind === "trollknight" ? "trollknight" : isLarge(kind) ? "brute" : isBoss(kind) ? "wizard" : (kind === "straw" || kind === "armored" || kind === "rail" || kind === "quintain") ? "dummy" : "small";
  const reelOf = (kind, knight) => { const R = spec().poise.reel, g = groupOf(kind, knight); return R[g] === undefined ? R.small : R[g]; };
  const againOf = (kind, knight) => { const R = spec().poise.again, g = groupOf(kind, knight); return R[g] === undefined ? R.small : R[g]; };
  const windowOf = (kind, knight) => { const R = spec().poise.critWindow || {}, g = groupOf(kind, knight); return R[g] === undefined ? (R.small === undefined ? 2.0 : R.small) : R[g]; };
  function initBody(fight, b, kind) {
    const m = poiseMax(kind);
    b.poiseKind = kind; b.poiseMax = m === null ? 0 : m; b.poise = b.poiseMax; b.poiseAt = -1e9; b.poiseLock = 0; b.critOpen = false; b.reelT = 0; b.lag = 0;
    return b;
  }
  // a hit event's place on a body: a troll's chest where it is drawn, a dummy's chest, a knight's chest
  const at = (H, d) => d.foe || d.piece ? H.drawnAt(d) : d.knight ? [d.x, d.y - (d.z || 0) - H.data().knight.chest] : H.hitPoint(d);
  // the break: the bar shatters, the body reels, its act ends, the first blow on it is a crit
  function breakPoise(H, fight, d) {
    const reel = reelOf(d.poiseKind, false);
    d.poise = 0; d.critOpen = true; d.poiseAt = fight.t; d.critUntil = fight.t + windowOf(d.poiseKind, false);
    if (d.foe) {
      d.stagger = Math.max(d.stagger || 0, reel); d.staggered = true; d.reelUntil = fight.t + reel;
      if (d.act) H.cancelAct(fight, d, "stagger", true);
      if (d.onStagger) d.onStagger(fight, d);
    } else d.reelT = reel;
    const p = at(H, d);
    H.emit(fight, { type: "poiseBreak", d: d.i, dummy: d.kind, reel, x: p[0], y: p[1] });
  }
  // the stagger over (a crit landed, or its time ran out): the bar refills and cannot break again for `again`
  function endStagger(H, fight, d) {
    d.critOpen = false; d.poise = d.poiseMax; d.poiseLock = fight.t + againOf(d.poiseKind, false); d.poiseAt = fight.t;
    if (d.foe) { d.stagger = 0; d.staggered = false; d.reelUntil = undefined; } else d.reelT = 0;
  }
  // a troll's poise taken by something other than a knight's blow (a parry, the horn's cone): the break when it empties, else a reel
  function takePoise(H, fight, d, p, reel) {
    if (!d || !(d.poiseMax > 0) || d.dead || d.critOpen) return false;
    d.poise -= p; d.poiseAt = fight.t;
    if (d.poise <= 1e-9 && fight.t >= d.poiseLock) { breakPoise(H, fight, d); return true; }
    if (d.poise < 0) d.poise = 0;
    if (reel > 0 && d.foe) { d.stagger = Math.max(d.stagger || 0, reel); d.staggered = true; if (d.act) H.cancelAct(fight, d, "parried", true); }
    return false;
  }
  // a plain stagger on a troll, whatever its poise (the cannon's siege, the lance's charge): no crit opens
  function reelFor(H, fight, d, s) { if (!d.foe || d.dead) return; d.stagger = Math.max(d.stagger || 0, s); d.staggered = true; if (d.act) H.cancelAct(fight, d, "stagger", true); }
  // the bow's pin: a leaping, swooping or charging troll stops where it is and staggers
  function pin(H, fight, d) {
    const S = spec(), A = d.act, reel = ((S.classes.bow || {}).pin || {}).reel || 0.3;
    if (A && A.phase === "run" && A.fam === "charge") H.runEnd(fight, d, A, "pin", 0);
    if (d.air) { d.ix = 0; d.iy = 0; d.vx = 0; d.vy = 0; if (A && A.fam === "leap") A.hits.push(-1); }
    reelFor(H, fight, d, reel);
    const p = at(H, d);
    H.emit(fight, { type: "pin", d: d.i, x: p[0], y: p[1] });
  }

  // ------------------------------------------------------------------ the seam in hit(): a knight's blow on a troll or a dummy
  // h: { dmg, tag, crit, direct, blockX (the troll knight's shield factor, or null), dist (the knight's chest to the target's point) }
  function onHit(H, fight, k, d, u, o, h) {
    const S = spec(), cls = classOf(u), C = sigOf(cls), R = { dmg: h.dmg, tag: h.tag, crit: h.crit, statuses: [], pull: 0, after: [] };
    if (!h.direct || d.piece || (d.foe && (d.dead || d.ward))) return R;
    const foe = !!d.foe, melee = !!o.melee, hand = k.hands ? k.hands.find(x => x.u === u || x.uf === u) || null : null;
    // the riposte: the blow after a parry (a sword's is the chain's finisher, set at the parry: no second factor)
    if (k.riposteUntil > fight.t && melee) { if (!(cls === "sword" && C.riposteFinisher)) R.dmg *= S.guard.parry.riposte.x; R.tag = "RIPOSTE"; k.riposteUntil = 0; }
    // the spear's counter: a thrust on a troll in its wind-up
    if (C.counter && foe && melee && d.act && d.act.phase === "wind") { R.dmg *= C.counter.x; R.tag = "COUNTER"; if (C.counter.cancels) R.after.push(() => { if (d.act && d.act.phase === "wind") H.cancelAct(fight, d, "counter"); }); }
    // the scythe's reap: a bleeding or staggered troll
    if (C.reapX && foe && (d.critOpen || (d.st && d.st.bleed))) R.dmg *= C.reapX;
    // reach rules: the whip's and the spear's inside, the whip's far lash
    if (melee && typeof h.dist === "number") { if (C.inside && h.dist < C.inside) R.dmg *= C.insideX; else if (C.far && h.dist >= C.far) R.dmg *= C.farX; }
    // the pulls: the whip's sidewinder on a small troll, the scythe's hook
    if (foe && melee && o.move === "sidewinder" && C.pull && (small(d) || C.pullsBrutes)) R.pull = C.pull;
    if (foe && melee && o.move === "hook" && C.hookPull) R.pull = C.hookPull;
    // poise and the crit, on a body the blow reached (a blow on the troll knight's shield feeds the shield's meter instead)
    if (h.blockX === null && d.poiseMax > 0) {
      if (d.critOpen) { R.dmg *= S.poise.crit.knight.x; R.crit = true; R.tag = "CRIT"; R.after.push(() => { endStagger(H, fight, d); if (C.critCrater && fight.marks) H.stamp(fight, "crack", d.x, d.y, 10, d.z || 0); }); }
      else {
        const p = blowPoise(u, o);
        d.poise -= p; d.poiseAt = fight.t;
        if (d.poise <= 1e-9 && fight.t >= d.poiseLock && !(d.st && d.st.freeze)) { if (!R.tag) R.tag = "STAGGER"; R.after.push(() => { if (!d.critOpen) breakPoise(H, fight, d); }); }
        else if (d.poise < 0) d.poise = 0;
      }
    }
    // the staggers whatever the poise: the cannon's siege on a direct hit, the lance's couched run on a small troll
    if (C.reelAny && foe && !d.critOpen) R.after.push(() => reelFor(H, fight, d, C.reelAny));
    if (C.charge && foe && o.move === "couched" && small(d) && !d.critOpen) R.after.push(() => reelFor(H, fight, d, C.charge.reel));
    // the bow's pin: a troll in the air or charging
    if (C.pin && foe && !melee && !d.critOpen) { const A = d.act; if ((d.air && C.pin.airborne) || (A && A.phase === "run" && C.pin.charging)) { R.tag = "PIN"; R.after.push(() => pin(H, fight, d)); } }
    // the statuses a class adds: the dagger's stack (two on its plunge), the axe's weaken, the wand's mark, the lantern's blind
    if (C.bleedPerBlow && melee) { const have = u.statuses.includes("bleed") ? 1 : 0, n = (u.isFinisher && C.finisherStacks ? C.finisherStacks : C.bleedPerBlow) - have; for (let i = 0; i < n; i++) R.statuses.push("bleed"); }
    if (C.sets && (melee || C.sets !== "weaken") && !u.statuses.includes(C.sets)) R.statuses.push(C.sets);
    // the claws' frenzy on the hand that struck
    if (C.frenzy && melee && hand) { const F = hand.frenzy && hand.frenzy.until > fight.t ? hand.frenzy : { n: 0 }; hand.frenzy = { n: Math.min(C.frenzy.stacks, F.n + 1), rate: C.frenzy.rate, until: fight.t + C.frenzy.time }; }
    return R;
  }
  // a knight's melee strike that met nothing: the hammer's and the lance's cost, the flail's whiffed meteor
  function onWhiff(H, fight, k, hand, u) {
    const C = sigOf(classOf(u));
    if (typeof C.whiff === "number" && hand) hand.cd += C.whiff;
    if (C.charge && typeof C.charge.miss === "number" && hand) hand.cd += C.charge.miss;
    if (C.selfReel && u.isFinisher) H.stagger(fight, k, C.selfReel);
  }
  // the bleed's burst (the dagger's five stacks): a share of max HP at once, the stacks gone, immune for a while
  function bleedBurst(H, fight, d, u) {
    const S = spec(), Z = S.statuses.bleed, st = d.st;
    if (!st.bleed || st.bleed.stacks < Z.stacks || st.bleedImm) return false;
    const max = d.foe ? d.hpMax : Z.dummyMax || 100, share = d.foe && isBoss(d.kind) ? Z.burstBoss : Z.burst, amount = max * share;
    delete st.bleed; st.bleedImm = { t: Z.immune };
    const p = at(H, d);
    H.emit(fight, { type: "hit", d: d.i, dummy: d.kind, amount, tag: "BLEED OUT", crit: false, form: null, element: "bleed", kind: "burst", why: "bleed", x: p[0], y: p[1], melee: false, hold: 0, sum: false }, u.knight);
    if (d.foe) H.damage(fight, d, amount, "bleed", null, u.knight, "direct");
    return true;
  }

  // ------------------------------------------------------------------ the seam in hurt(): a troll's blow, shot or burst on a knight
  function mobAttack(src) {
    const S = spec(); if (!S || typeof src !== "string") return null;
    const i = src.indexOf("."); if (i < 0) return null;
    const kind = src.slice(0, i), name = src.slice(i + 1), M = S.mobs[kind];
    return M && M[name] && typeof M[name] === "object" ? M[name] : null;
  }
  function extraAttacks(kind) {
    const S = spec(), M = S && S.mobs ? S.mobs[kind] : null, out = {};
    if (!M) return null;
    let any = false;
    for (const name of Object.keys(M)) if (M[name] && M[name].new) { const a = Object.assign({}, M[name]); delete a.new; delete a.class; delete a.parry; delete a.poise; out[name] = a; any = true; }
    return any ? out : null;
  }
  const handOf = k => k.carry || k.hands[k.active];
  function onHurt(H, fight, k, o, dmg) {
    const S = spec(), G = S.guard, R = { res: null, dmg, push: o.push, sets: o.sets, stagger: o.stagger, pull: o.pull || 0, tag: null, after: [], timeX: 1 };
    if (k.knock) { R.res = "safe"; return R; }   // lying or rising: no blow lands
    const f = o.by || (o.byId !== undefined && fight.foes ? fight.foes.find(g => g.id === o.byId) || null : null), M = mobAttack(o.src), melee = !!o.melee && !o.shot;
    const from = o.from || [k.x, k.y], dd = Math.hypot(from[0] - k.x, from[1] - k.y), front = dd < 1e-6 || Math.abs(angDiff(Math.atan2(from[1] - k.y, from[0] - k.x), k.face)) <= (G.arc || 120) / 2 * RAD + 1e-9;
    const cls = classOf(handOf(k).u), shield = cls === "shield";
    // the Guard
    if (k.guarding && front && !o.fall && !o.tick) {
      const block = () => H.emit(fight, { type: "block", x: k.x, y: k.y, bx: (from[0] + k.x) / 2, by: k.y - 14 }, k);
      if (o.shot) { if (G.blocksShots !== false) { block(); if (shield) { H.emit(fight, { type: "reflect", x: k.x, y: k.y }, k); R.res = "reflect"; } else R.res = "block"; return R; } }
      else if (melee) {
        const parryable = !(M && M.parry === false) && o.parry !== false;
        if (parryable && fight.t <= k.parryUntil + 1e-9) {
          R.res = "parry"; k.parryUntil = 0; k.riposteUntil = fight.t + G.parry.riposte.within;
          if (cls === "sword" && sigOf("sword").riposteFinisher) { const hand = handOf(k); if (hand && !hand.carry) hand.combo = { n: 2, until: Infinity }; }   // the next blow is the chain's third
          H.emit(fight, { type: "parry", x: k.x, y: k.y, bx: (from[0] + k.x) / 2, by: k.y - 14, foe: f ? f.id : null }, k);
          if (f) { takePoise(H, fight, f, G.parry.poise, G.parry.reel); if (lagOn(fight)) { f.lag = Math.max(f.lag || 0, S.feel.hitlag.parry); } }
          if (lagOn(fight)) k.lag = Math.max(k.lag || 0, S.feel.hitlag.parry);
          return R;
        }
        R.res = "block"; block();
        R.dmg = dmg * (shield ? G.takeShield : G.take); R.push = (o.push || 0) * G.push; R.sets = null; R.stagger = 0; R.pull = 0;
        const p = (M ? M.poise || 0 : 10) * (S.poise.blockedX || 1.25);
        if (k.poiseMax > 0) { k.poise -= p; k.poiseAt = fight.t; if (k.poise <= 1e-9 && fight.t >= k.poiseLock) { R.tag = "STAGGER"; R.after.push(() => knightBreak(H, fight, k)); } else if (k.poise < 0) k.poise = 0; }
        return R;
      }
    }
    if (o.tick) return R;
    // the crit on a reeling knight: x 1.5 and the knockdown; else the attack's poise
    if (k.critOpen) { R.dmg *= S.poise.crit.troll.x; R.tag = "CRIT"; R.after.push(() => { endKnightStagger(fight, k); if (S.poise.crit.troll.knockdown) knockDown(H, fight, k); }); }
    else if (M && !o.fall) {
      const p = o.zone === "outer" && typeof M.outerPoise === "number" ? M.outerPoise : (M.poise || 0);
      if (p > 0 && k.poiseMax > 0) { k.poise -= p; k.poiseAt = fight.t; if (k.poise <= 1e-9 && fight.t >= k.poiseLock) { R.tag = "STAGGER"; R.after.push(() => knightBreak(H, fight, k)); } else if (k.poise < 0) k.poise = 0; }
      if (M.coreKnockdown && o.zone === "core") R.after.push(() => knockDown(H, fight, k));
    }
    // the mark on the knight: more from every blow while it lasts; the wizard's bolt sets it
    if (k.markUntil > fight.t) R.dmg *= S.statuses.mark.more;
    if (M && M.sets === "mark") R.after.push(() => { k.markUntil = fight.t + S.statuses.mark.time; H.emit(fight, { type: "kstatus", status: "mark", on: true, x: k.x, y: k.y }, k); });
    // the troll knight's riposte: its cut within a second of a block
    if (M && M.riposte && f && f.guard && Array.isArray(f.guard.blocks) && f.guard.blocks.length && fight.t - f.guard.blocks[f.guard.blocks.length - 1] <= M.riposte.within + 1e-9) { R.dmg *= M.riposte.x; if (!R.tag) R.tag = "RIPOSTE"; }
    // the archer's pin: an arrow that lands just after a dodge ended
    if (M && M.pinAfterDodge && o.shot && k.dodgeEnd !== undefined && fight.t - k.dodgeEnd <= M.pinAfterDodge + 1e-9 && fight.t - k.dodgeEnd >= 0) { R.stagger = Math.max(R.stagger || 0, M.pin || 0.3); R.tag = "PIN"; }
    // the fangs' bleed on the knight, the wolf's frenzy, the long burns
    if (M && M.bleed && !o.shot) R.after.push(() => knightBleed(H, fight, k, M.bleed));
    if (M && M.frenzy && f) { const FZ = sigOf("claw").frenzy, F = f.frenzy && f.frenzy.until > fight.t ? f.frenzy : { n: 0 }; f.frenzy = { n: Math.min(FZ.stacks, F.n + 1), rate: FZ.rate, until: fight.t + FZ.time }; }
    if (M && typeof M.statusTimeX === "number") R.timeX = M.statusTimeX;
    return R;
  }
  const lagOn = fight => { const F = spec().feel.hitlag; return !!(F && (!F.levelsOnly || fight.level)); };
  // hitlag on the two bodies of a blow (a shot's striker plays on)
  function hitlag(fight, a, b, dmg, big, strikerToo) {
    if (!lagOn(fight)) return;
    const F = spec().feel.hitlag, t = clamp(F.base + F.perDamage * dmg, F.base, F.max) + (big ? F.big : 0);
    if (b) b.lag = Math.max(b.lag || 0, t);
    if (a && strikerToo && F.striker !== false) a.lag = Math.max(a.lag || 0, t);   // (feel.hitlag.striker false: the striker plays on, only the struck body sticks)
  }
  function knightBreak(H, fight, k) {
    const reel = reelOf("knight", true);
    k.poise = 0; k.critOpen = true; k.reelT = reel; k.poiseAt = fight.t; k.critUntil = fight.t + windowOf("knight", true);
    k.strike = null; k.twinQ = null; k.charging = false; k.chargeT = 0; k.lunge = null; k.guarding = false; H.stopStream(fight, k); H.breakChain(k);
    if (k.carry) H.putRam(fight, k);
    H.emit(fight, { type: "poiseBreak", reel, x: k.x, y: k.y }, k);
  }
  function endKnightStagger(fight, k) { k.critOpen = false; k.reelT = 0; k.poise = k.poiseMax; k.poiseLock = fight.t + againOf("knight", true); k.poiseAt = fight.t; }
  function knockDown(H, fight, k) {
    const K = spec().knockdown;
    if (k.knock || k.down || k.out || k.rise > 0) return;
    endKnightStagger(fight, k);
    k.knock = { phase: "lie", t: K.lie };
    k.strike = null; k.twinQ = null; k.gout = null; k.charging = false; k.chargeT = 0; k.abQ = null; k.lunge = null; k.dodge = 0; k.guarding = false; k.stagger = 0; H.stopStream(fight, k); H.breakChain(k);
    if (k.carry) H.putRam(fight, k);
    if (k.climbing) H.letGo(fight, k);
    H.emit(fight, { type: "knock", x: k.x, y: k.y, lie: K.lie, rise: K.rise }, k);
  }
  // the knight's knockdown, stepped by knightStep: lying, then rising, then the safety that ends when the knight acts
  function knockStep(H, fight, k, dt) {
    const K = spec().knockdown, N = k.knock;
    N.t -= dt;
    if (N.t > 1e-9) return;
    if (N.phase === "lie") { N.phase = "rise"; N.t = K.rise; return; }
    k.knock = null; k.safe = Math.max(k.safe, K.safe); k.safeActs = true;
    H.emit(fight, { type: "rise", x: k.x, y: k.y, hp: k.hp, knock: true }, k);
  }
  // the fangs' bleed on the knight: stacks that fade after their time; at five, a burst of a share of max HP (BLEED OUT), then immunity
  function knightBleed(H, fight, k, n) {
    const Z = spec().statuses.knightBleed;
    if (k.bleedImm > fight.t) return;
    if (!(fight.t - (k.bleedAt === undefined ? -1e9 : k.bleedAt) <= Z.time)) k.bleedN = 0;
    k.bleedN = (k.bleedN || 0) + n; k.bleedAt = fight.t;
    H.emit(fight, { type: "kstatus", status: "bleed", on: true, n: k.bleedN, x: k.x, y: k.y }, k);
    if (k.bleedN >= Z.stacks) {
      const amount = Math.round(k.hpMax * Z.burst);
      k.bleedN = 0; k.bleedImm = fight.t + Z.immune;
      H.emit(fight, { type: "kstatus", status: "bleed", on: false, n: 0, why: "burst", x: k.x, y: k.y }, k);
      H.hurt(fight, k, amount, { tick: true, src: "bleed", tag: "BLEED OUT" });
    }
  }

  // ------------------------------------------------------------------ the clocks
  function step(H, fight, dt) {
    const S = spec(), RG = S.poise.regrow;
    const grow = (b, knight) => {
      if (!(b.poiseMax > 0) || b.critOpen || b.poise >= b.poiseMax) return;
      const after = knight ? RG.knightAfter : RG.after;
      if (fight.t - b.poiseAt < after - 1e-9) return;
      b.poise = Math.min(b.poiseMax, b.poise + (knight ? RG.knightPerSecond : b.poiseMax * RG.perSecond) * dt);
    };
    for (const k of fight.knights) {
      if (k.out) continue;
      if (k.reelT > 0) { k.reelT -= dt; if (k.reelT <= 1e-9) k.reelT = 0; }
      if (k.critOpen && fight.t >= k.critUntil - 1e-9) endKnightStagger(fight, k);
      grow(k, true);
      if (k.bleedN > 0 && fight.t - k.bleedAt > S.statuses.knightBleed.time) { k.bleedN = 0; H.emit(fight, { type: "kstatus", status: "bleed", on: false, n: 0, why: "time", x: k.x, y: k.y }, k); }
      for (const h of k.hands) if (h.frenzy && h.frenzy.until <= fight.t) h.frenzy = null;
    }
    for (const f of fight.foes || []) {
      if (f.dead) continue;
      if (f.critOpen && fight.t >= f.critUntil - 1e-9) endStagger(H, fight, f);   // the crit window over with no blow: the bar refills and locks
      grow(f, false);
      if (f.frenzy && f.frenzy.until <= fight.t) f.frenzy = null;
    }
    for (const d of fight.dummies) {
      if (d.reelT > 0) { d.reelT -= dt; if (d.reelT <= 1e-9) d.reelT = 0; }
      if (d.critOpen && fight.t >= d.critUntil - 1e-9) endStagger(H, fight, d);
      grow(d, false);
    }
  }
  // the horn's rally: on the blast's first tick (and every cooldown): the brothers within the band's reach quicken, the trolls in the cone lose poise
  function rally(H, fight, k, u, cone) {
    const S = spec(), C = sigOf("horn"), B = C.band; if (!B) return false;
    if (k.rallyAt !== undefined && fight.t - k.rallyAt < B.cooldown - 1e-9) return false;
    k.rallyAt = fight.t;
    for (const b of fight.knights) if (b !== k && !b.out && !b.down && Math.hypot(b.x - k.x, b.y - k.y) <= B.within) { b.bandUntil = fight.t + B.time; b.bandRate = B.rate; }
    let n = 0;
    for (const f of fight.foes || []) if (!f.dead && !(f.spawn > 0) && !f.gone && cone(f)) { takePoise(H, fight, f, C.conePoise || 10, 0); n++; }
    H.emit(fight, { type: "rally", x: k.x, y: k.y, trolls: n, within: B.within, seat: k.seat });
    return true;
  }
  // a troll's speed factor: the wolf's frenzy, and the orb's field (a knight's orbit of the orb class it stands inside slows it)
  function trollSpeedX(fight, f) {
    let x = f && f.frenzy && f.frenzy.until > fight.t ? 1 + f.frenzy.rate * f.frenzy.n : 1;
    for (const k of fight.knights) { if (k.out) continue; for (const h of k.hands) { const O = h.orbit; if (!O) continue; const C = sigOf(classOf(O.fu)); if (C.fieldSlow && Math.hypot(f.x - k.x, f.y - k.y) <= O.fu.orbitR + (f.r || 0)) { x *= C.fieldSlow; break; } } }
    return x;
  }
  // a knight's walking factor: the Guard's half speed, and its own orb's field
  function knightWalkX(fight, k) {
    let x = k.guarding ? spec().guard.walk : 1;
    for (const h of k.hands) { const O = h.orbit; if (!O) continue; const C = sigOf(classOf(O.fu)); if (C.fieldSlow) { x *= C.fieldSlow; break; } }
    return x;
  }
  // a class's own damage factor (the shield's weakness)
  const damageX = u => { const C = sigOf(classOf(u)); return typeof C.K === "number" ? C.K : 1; };
  const pierceOf = u => { const C = sigOf(classOf(u)); return typeof C.pierce === "number" ? C.pierce : 0; };

  // ------------------------------------------------------------------ the words
  const words = {
    plaqueLine: cls => { const S = spec(); return S ? ((S.words || {}).plaque || {})[cls] || null : null; },
    bayWord: cls => { const S = spec(); if (!S) return null; const C = S.classes[cls]; return C && typeof C === "object" && typeof C.signature === "string" && cls !== "legendary" ? C.signature.toUpperCase() : null; },
    signatureOf: cls => { const S = spec(); if (!S) return null; const C = S.classes[cls]; return C && typeof C === "object" ? C.signature : null; },
    hint: kind => { const S = spec(); return S ? ((S.words || {}).hints || {})[kind] || null : null; },
    levelLine: area => { const S = spec(); return S ? ((S.words || {}).levels || {})[area] || null : null; },
    tag: key => { const S = spec(); return S ? ((S.feel || {}).tags || {})[key] || key.toUpperCase() : key.toUpperCase(); }
  };

  root.Signatures = { spec, use, on, classOf, classOfThing, sigOf, blowPoise, comboWindow, rateX, shieldOf, statusTimeX, areaX, poiseMax, reelOf, againOf, windowOf, initBody, breakPoise, endStagger, takePoise, reelFor, pin,
    onHit, onWhiff, bleedBurst, mobAttack, extraAttacks, onHurt, hitlag, lagOn, knightBreak, endKnightStagger, knockDown, knockStep, knightBleed, step, rally, trollSpeedX, knightWalkX, damageX, pierceOf, small, isLarge, isBoss, words, version: 1 };
  if (typeof module !== "undefined" && module.exports) module.exports = root.Signatures;
})(typeof window !== "undefined" ? window : globalThis);
