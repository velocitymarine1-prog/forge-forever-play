// FORGE FOREVER: the drill (design pass 32, card t90; build 21). When a class is taken at Vorn's, or the first weapon is chosen, the
// Forge page raises a plaque with a stage on it: a slice of the Training Cellar where the cellar's own knight drills with the class
// weapon against a straw dummy, looping, and under it the weapon's damage and strengths in words. This file is the stage and the
// words; the plaque round them is proto/the-forge.js's (openDrill).
//
// The stage is 160 x 64 world pixels: the smithy's brick wall down to the floor line (y 44) and its flagstones below (Smithy.bricks,
// Smithy.flagstones), the knight at x 48 with his feet at y 56 (Knight.frame, the cellar's knight, facing right), the straw dummy
// ahead of him (Cellar.dummyPixels, tilted by its wobble, white on a hit) at x 80 for a melee class, where a swing's tip lands, or
// x 120 for the rest, with room for a shot to fly; both with the cellar's drop shadow. Every frame is a pure function of the weapon
// and a time t in seconds (frameAt), so node checks it and the page's seek(t) draws any moment. What plays is by the weapon's form:
//   slash, thrust, smash   the class's three combo moves in turn (Combos.moveOf, the third the finisher) with their times
//                          (Combos.times), the knight's pose and step from Combos.frameAt, the swing drawing (PixelForge.swingFor) on
//                          the hand as the cellar places it, the move's smear (Combos.smearOf, paintSmear) in the weapon's ramp; the
//                          hold (PixelForge.poseFor) between blows: hold 0.5 s, blow I, 0.4, blow II, 0.4, blow III, 1.0, again
//   shoot                  three shots then a rest: wind, strike, recover; a dart from the weapon's tip at 160 px/s to the dummy's chest
//   lob                    two lobs then a rest: a shell in an arc from the muzzle onto the dummy in 0.6 s, a burst ring in the fire tones
//   stream                 the strike pose held 0.8 s with rings of sound rolling from the mouth to the dummy, then a rest
//   orbit                  the knight stands with empty hands while the orb itself circles him, hitting as it passes the dummy's side
//   field                  the weapon held out, a dotted ring on the floor round the knight's feet breathing in four frames, the dummy hit
//                          every half second
//   summon                 the book held out; a wisp rises from it, flies to the dummy, strikes three times and fades
// A hit is the cellar's: the dummy white for 0.06 s, then its wobble by spec/combat.json's spring (a kick of (kick + knockback x
// perPush) x gain, the spring and damp, the tilt capped at max), summed over the hits of the last second (the spring is linear).
//   Drill.plan(thing)            the play: { form, melee, dummyX, cycle, hits: [t...], segs, still } (still: the first hit's moment)
//   Drill.frameAt(thing, t)      { px, W, H } the stage at t seconds (px: W x H colours or null), pure
//   Drill.words(thing)           { damage, strengths }: "steel, in a slow, heavy arc. Stuns." and "knocks back, hits hard." from the
//                                weapon's record and spec/folk.json's drill word tables
//   Drill.mount(canvas, thing, o) the page's loop on requestAnimationFrame: { stop(), seek(t), t(), thing }; o.reduce draws one
//                                still (the first hit) and never loops
// Plain script, defines window.Drill (module.exports in node). Reads window.Knight, PixelForge, Combos, Cellar, Smithy, FORGE_COMBAT,
// FORGE_GRAMMAR and FORGE_FOLK when called, never at load.
(function (root) {
  "use strict";
  const W = 160, H = 64, FLOOR = 44, FEET = 56, KX = 48, DX_MELEE = 80, DX_ORBIT = 76, DX_FAR = 120;
  const OUT = "#181425", N = 32, DUMMY = 32, DUMMY_CHEST = 14, SHADOW_W = 7;
  const FLASH = 0.06;
  const FIRE = ["#fff6c8", "#fee761", "#feae34", "#f77622"];
  const mods = () => ({ K: root.Knight, PF: root.PixelForge, C: root.Combos, CE: root.Cellar, S: root.Smithy, G: root.FORGE_GRAMMAR, CB: root.FORGE_COMBAT, FK: root.FORGE_FOLK });
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // ------------------------------------------------------------------ the ground, baked once: the wall and the flagstones
  let GROUND = null;
  function ground() {
    if (GROUND) return GROUND;
    const { S } = mods(), px = new Array(W * H).fill(null);
    const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H && c) px[y * W + x] = c; };
    const fill = (x0, y0, x1, y1, f) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, typeof f === "function" ? f(x, y) : f); };
    const p = { set, fill };
    fill(0, 0, W - 1, H - 1, (S.TONES && S.TONES.joint) || "#1e1828");   // (the bricks leave their joints unset: the wall's joint tone under all)
    S.bricks(p, S.rng(1209), W, 0, FLOOR);
    S.flagstones(p, W, FLOOR, H);
    GROUND = px;
    return px;
  }
  // a colour darkened toward the shadow's soot (the cellar's rgba(10,6,18,0.45) over the floor)
  const darkCache = new Map();
  function shade(c) {
    if (!c) return "#0a0612";
    let v = darkCache.get(c);
    if (!v) { const [r, g, b] = mods().S.hex(c), m = 0.45; v = "#" + [Math.round(r + (10 - r) * m), Math.round(g + (6 - g) * m), Math.round(b + (18 - b) * m)].map(n => n.toString(16).padStart(2, "0")).join(""); darkCache.set(c, v); }
    return v;
  }

  // ------------------------------------------------------------------ the weapon's units the stage needs (the cellar's numbers)
  const units = () => (mods().CB || {}).units || {};
  const unit = (name, n) => { const u = units()[name]; return u ? u.base + u.per * (n | 0) : 0; };
  function reachOf(thing) { const n = ((thing.weapon || {}).numbers || {}).range; return unit("reach", n === undefined ? 2 : n) || 24; }
  function rampOf(thing) {
    const { PF } = mods(), v = (thing.weapon || {}).visual || {}, el = (thing.weapon || {}).element, mat = v.material;
    if (el && el !== "physical" && PF.ELEM && PF.ELEM[el]) return PF.ELEM[el];
    const m = PF.RAMP[mat] || PF.RAMP.steel;
    return mat === "wood" ? PF.RAMP.steel : m;
  }
  const baseOf = thing => (((thing.weapon || {}).visual || {}).base) || "sword";
  const formOf = thing => (thing.weapon || {}).form || "slash";

  // ------------------------------------------------------------------ the play: segments on a loop, and when the dummy is hit
  const HOLDS = { melee: [0.5, 0.4, 0.4, 1.0], shoot: 0.6, lob: 0.6, stream: 0.6, summon: 0.5 };
  const SHOT = { wind: 0.1, strike: 0.15, recover: 0.2, speed: 160 };
  const LOB = { wind: 0.1, strike: 0.1, recover: 0.2, flight: 0.6, burst: 0.25, rise: 18 };
  const STREAM = { on: 0.8, every: 0.15, travel: 0.3, hitEvery: 0.25, rest: 0.8 };
  const ORBIT = { turn: 1.2, rx: 22, ry: 10 };
  const FIELD = { every: 0.5, rx: 40, ry: 14 };
  const WISP = { rise: 0.4, fly: 0.4, every: 0.3, strikes: 3, fade: 0.3, rest: 0.8 };
  const planCache = new Map();
  function plan(thing) {
    const key = thing.id || JSON.stringify(thing.weapon);
    if (planCache.has(key)) return planCache.get(key);
    const { C } = mods(), form = formOf(thing), set = C && C.setFor ? C.setFor(thing) : null, melee = !!set;
    const P = { form, melee, set, dummyX: melee ? DX_MELEE : form === "orbit" ? DX_ORBIT : form === "field" ? DX_MELEE : DX_FAR, segs: [], hits: [], cycle: 0, still: 0 };
    let t = 0;
    const seg = (kind, dur, extra) => { const s = Object.assign({ kind, t0: t, t1: t + dur, dur }, extra || {}); P.segs.push(s); t += dur; return s; };
    if (melee) {
      const holds = HOLDS.melee;
      for (let n = 1; n <= 3; n++) {
        seg("hold", holds[n - 1]);
        const move = C.moveOf(set, n), T = C.times(form, n === 3), s = seg("blow", T.dur, { n, move, T });
        P.hits.push(s.t0 + T.wind);
      }
      seg("hold", holds[3]);
    } else if (form === "shoot" || form === "trap") {
      const tipX = KX + 10, flight = Math.max(0.1, (P.dummyX - 6 - tipX) / SHOT.speed);
      for (let n = 1; n <= 3; n++) { seg("hold", HOLDS.shoot); const s = seg("shot", SHOT.wind + SHOT.strike + SHOT.recover, { n, flight }); P.hits.push(s.t0 + SHOT.wind + flight); }
      seg("hold", 1.0);
    } else if (form === "lob") {
      for (let n = 1; n <= 2; n++) { seg("hold", HOLDS.lob); const s = seg("lob", LOB.wind + LOB.flight + LOB.burst, { n }); P.hits.push(s.t0 + LOB.wind + LOB.flight); }
      seg("hold", 1.0);
    } else if (form === "stream") {
      seg("hold", HOLDS.stream); const s = seg("stream", STREAM.on);
      for (let h = STREAM.travel; h < STREAM.on; h += STREAM.hitEvery) P.hits.push(s.t0 + h);
      seg("hold", STREAM.rest);
    } else if (form === "orbit") {
      seg("orbit", ORBIT.turn); P.hits.push(0);
    } else if (form === "field") {
      seg("field", FIELD.every); P.hits.push(0.25);
    } else if (form === "summon") {
      seg("hold", HOLDS.summon); const s = seg("wisp", WISP.rise + WISP.fly + WISP.every * WISP.strikes + WISP.fade);
      for (let k = 0; k < WISP.strikes; k++) P.hits.push(s.t0 + WISP.rise + WISP.fly + WISP.every * k);
      seg("hold", WISP.rest);
    } else {   // a form the stage has no play for: the knight strikes at the dummy with the weapon held, a dart flies
      const tipX = KX + 10, flight = Math.max(0.1, (P.dummyX - 6 - tipX) / SHOT.speed);
      seg("hold", HOLDS.shoot); const s = seg("shot", SHOT.wind + SHOT.strike + SHOT.recover, { n: 1, flight }); P.hits.push(s.t0 + SHOT.wind + flight);
      seg("hold", 1.0);
    }
    P.cycle = t;
    P.still = (P.hits[0] || 0) + 0.015;
    planCache.set(key, P);
    return P;
  }
  const segAt = (P, t) => { const u = ((t % P.cycle) + P.cycle) % P.cycle; for (const s of P.segs) if (u >= s.t0 && u < s.t1) return [s, u - s.t0, u]; const s = P.segs[P.segs.length - 1]; return [s, u - s.t0, u]; };
  // the hits before u on the loop (this cycle's and the last cycle's, so a wobble carries over the seam), newest last
  function hitsBefore(P, u, back) {
    const out = [];
    for (const h of P.hits) { if (h <= u && u - h <= back) out.push(u - h); if (h - P.cycle <= u && u - (h - P.cycle) <= back) out.push(u - (h - P.cycle)); }
    return out;
  }
  // the dummy's wobble at u: the cellar's spring (wobble.spring, damp, max) kicked at each hit by (kick + knockback x perPush) x gain
  function wobbleAt(thing, P, u) {
    const Wb = (mods().CB || {}).wobble || { spring: 90, damp: 9, max: 3, kick: 2, perPush: 0.4, gain: 5 };
    const push = (((thing.weapon || {}).numbers || {}).knockback | 0), v0 = (Wb.kick + push * Wb.perPush) * Wb.gain;
    const w0 = Math.sqrt(Wb.spring), z = Wb.damp / (2 * w0), wd = w0 * Math.sqrt(Math.max(0.01, 1 - z * z));
    let x = 0;
    for (const age of hitsBefore(P, u, 1.2)) x += (v0 / wd) * Math.exp(-z * w0 * age) * Math.sin(wd * age);
    return clamp(x, -Wb.max, Wb.max);
  }
  const flashAt = (P, u) => hitsBefore(P, u, FLASH).length > 0;

  // ------------------------------------------------------------------ the knight and the weapon (the cellar's placing)
  const holdOut = base => (((mods().CB || {}).hold || {}).out || {})[base] || 0;
  function holdOffset(base) { const h = (((mods().CB || {}).hold || {}).offset || {})[base]; return h && h.right ? h.right : [0, 0]; }
  let swingFailed = {};
  function swingOf(thing, dir, lead) {
    const { PF } = mods();
    try { return PF.swingFor(thing, dir, lead, 0); }
    catch (e) { if (!swingFailed[thing.id] && root.console) { swingFailed[thing.id] = true; root.console.warn("Forge Forever: a swing drawing failed on the drill (" + thing.id + "); its hold is drawn"); (root.__errors || []).push("drill swing " + thing.id + ": " + (e && e.message || e)); } return PF.poseFor(thing, "right", 0); }
  }
  // the knight's frame and where the weapon's grip goes: in a combo blow the move's pose and step with the swing drawing (as
  // battlegrounds.js drawKnight places it); else the hold, the weapon posed on the hand with the form's offsets
  function knightAt(thing, P, s, u, t) {
    const { K, C, PF } = mods(), base = baseOf(thing), reach = holdOut(base), ho = holdOffset(base);
    const x0 = KX - 16, y0 = FEET - 31;
    if (s.kind === "blow") {
      const fr = C.frameAt(s.move, "right", u, s.T);
      if (fr) {
        const kf = K.frame(fr.facing, fr.pose, 0, 0), up = !!(PF.UPRIGHT && PF.UPRIGHT[base]), mirror = C.mirrorOf ? C.mirrorOf(fr.facing, up) : fr.mirror;
        const sp = swingOf(thing, fr.dir, fr.lead), n = sp.n || N, grip = sp.grip || [n / 2, n / 2];
        const gx = mirror ? n - 1 - grip[0] : grip[0];
        return { kf, kx: x0 + fr.dx, ky: y0 + fr.dy, weapon: { sp, n, mirror, x: x0 + fr.dx + kf.hand[0] - gx, y: y0 + fr.dy + kf.hand[1] - grip[1] }, behind: !!fr.behind, swing: true, frame: fr };
      }
    }
    let anim = "idle", i = Math.floor(t * 2) % 2, off = [0, 0];
    if (s.kind === "shot" || s.kind === "lob") {
      const A = s.kind === "shot" ? SHOT : LOB, F = ((mods().CB || {}).forms || {})[P.form] || {}, Pz = F.pose || {};
      if (u < A.wind) { anim = "wind"; i = 0; } else if (u < A.wind + A.strike) { anim = "strike"; i = 0; if (Pz.recoil && u < A.wind + (Pz.recoilT || 0.05)) off = [Pz.recoil[0], -Pz.recoil[1]]; } else if (u < A.wind + A.strike + A.recover) { anim = "recover"; i = 0; }
    } else if (s.kind === "stream") { anim = "strike"; i = 0; }
    else if (s.kind === "wisp" && u < WISP.rise) { anim = "strike"; i = 0; }
    const noWeapon = P.form === "orbit";
    const kf = K.frame("right", anim, i, noWeapon ? 0 : reach);
    if (noWeapon) return { kf, kx: x0, ky: y0, weapon: null, behind: false, swing: false };
    const sp = PF.poseFor(thing, "right", 0), grip = sp.grip || [6, 25];
    return { kf, kx: x0, ky: y0, weapon: { sp, n: sp.n || N, mirror: false, x: x0 + kf.hand[0] + off[0] + ho[0] - grip[0], y: y0 + kf.hand[1] + off[1] + ho[1] - grip[1], tip: sp.tip || grip }, behind: false, swing: false };
  }

  // ------------------------------------------------------------------ the frame
  function frameAt(thing, t) {
    const { K, C, CE, PF } = mods();
    if (!K || !PF || !CE) throw new Error("drill.js needs proto/knight.js, proto/pixel-forge.js and proto/cellar.js");
    const P = plan(thing), [s, u, uu] = segAt(P, t), px = ground().slice();
    const put = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H && c) px[y * W + x] = c; };
    const blit = (sp, n, x0, y0, mirror, tint) => { for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const c = sp[y * n + x]; if (!c) continue; put(x0 + (mirror ? n - 1 - x : x), y0 + y, tint && c !== OUT ? tint : c); } };
    const shadow = (cx, cy, w) => { for (let dx = -w; dx <= w; dx++) { const h = Math.max(1, Math.round(Math.sqrt(1 - (dx / (w + 0.5)) ** 2) * 2)); for (let y = cy - h + 1; y < cy + h; y++) { const x = Math.round(cx) + dx; if (x >= 0 && y >= 0 && x < W && y < H) px[y * W + x] = shade(px[y * W + x]); } } };
    // the ground's shadows, the dummy (tilted by its wobble, white on a hit)
    const kn = knightAt(thing, P, s, u, t);
    shadow(KX + (kn.frame ? kn.frame.dx : 0), FEET, SHADOW_W); shadow(P.dummyX, FEET, SHADOW_W);
    const tilt = Math.round(wobbleAt(thing, P, uu)), d = CE.dummyPixels("straw", tilt);
    blit(d.px, d.size, P.dummyX - DUMMY / 2, FEET - (DUMMY - 2), false, flashAt(P, uu) ? "#ffffff" : null);
    // the blow's smear: its far half behind the knight, the rest over the weapon (the cellar's two passes)
    const chest = [KX, FEET - (((mods().CB || {}).knight || {}).chest || 12)], ramp = rampOf(thing);
    let smear = null;
    if (s.kind === "blow" && u >= s.T.wind && C.smearOf) { const sm = C.smearOf(s.move, "right", reachOf(thing) + 2, { finisher: s.T.finisher }); if (sm) smear = { sm, age: u - s.T.wind }; }
    const paintSmear = pass => { if (smear) C.paintSmear((x, y, c) => put(chest[0] + x, chest[1] + y, c), smear.sm, smear.age, ramp, pass); };
    paintSmear("back");
    // the orb circling (the far half before the knight); the knight; the weapon; the smear's front
    let orb = null;
    if (s.kind === "orbit") { const a = (uu / ORBIT.turn) * Math.PI * 2, sp = PF.spriteFor(thing, 0), bb = bbox(sp.px, sp.n || N); orb = { sp, bb, x: chest[0] + Math.cos(a) * ORBIT.rx, y: chest[1] + Math.sin(a) * ORBIT.ry, far: Math.sin(a) < 0 }; }
    const drawOrb = () => { if (!orb) return; blit(orb.sp.px, orb.sp.n || N, Math.round(orb.x - orb.bb.cx), Math.round(orb.y - orb.bb.cy), false, null); };
    if (orb && orb.far) drawOrb();
    const drawWeapon = () => { if (kn.weapon) blit(kn.weapon.sp.px, kn.weapon.n, kn.weapon.x, kn.weapon.y, kn.weapon.mirror, null); };
    if (kn.behind) drawWeapon();
    blit(kn.kf.px, N, kn.kx, kn.ky, false, null);
    if (!kn.behind) drawWeapon();
    paintSmear("front");
    if (orb && !orb.far) drawOrb();
    // the effects of the other forms: the dart, the shell and its burst, the rings of sound, the field's ring, the wisp
    const tip = kn.weapon && kn.weapon.tip ? [kn.weapon.x + kn.weapon.tip[0], kn.weapon.y + kn.weapon.tip[1]] : [KX + 12, chest[1]];
    const target = [P.dummyX - 6, FEET - DUMMY_CHEST];
    if (s.kind === "shot" && u >= SHOT.wind && u < SHOT.wind + s.flight) {
      const q = (u - SHOT.wind) / s.flight, x = tip[0] + (target[0] - tip[0]) * q, y = tip[1] + (target[1] - tip[1]) * q;
      for (let k = 0; k < 4; k++) put(x - k, y, ramp[3 - k]);
    }
    if (s.kind === "lob") {
      if (u >= LOB.wind && u < LOB.wind + LOB.flight) {
        const q = (u - LOB.wind) / LOB.flight, x = tip[0] + (target[0] - tip[0]) * q, y = tip[1] + (target[1] - tip[1]) * q - LOB.rise * 4 * q * (1 - q);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) put(x + dx, y + dy, dx === -1 && dy === -1 ? ramp[3] : Math.abs(dx) + Math.abs(dy) === 2 ? ramp[1] : ramp[2]);
      } else if (u >= LOB.wind + LOB.flight && u < LOB.wind + LOB.flight + LOB.burst) {
        const q = (u - LOB.wind - LOB.flight) / LOB.burst, r = 3 + 7 * q, c = FIRE[Math.min(3, Math.floor(q * 4))];
        for (let a = 0; a < 360; a += 20) put(target[0] + Math.cos(a * Math.PI / 180) * r, target[1] + Math.sin(a * Math.PI / 180) * r * 0.6, c);
      }
    }
    if (s.kind === "stream") {
      for (let born = 0; born < u; born += STREAM.every) {
        const age = u - born; if (age > STREAM.travel) continue;
        const q = age / STREAM.travel, x = tip[0] + (target[0] - tip[0]) * q, y = tip[1] + (target[1] - tip[1]) * q, h = 2 + 3 * q;
        for (let a = -60; a <= 60; a += 30) put(x + Math.cos(a * Math.PI / 180) * 2, y + Math.sin(a * Math.PI / 180) * h, a === 0 ? ramp[3] : ramp[2]);
      }
    }
    if (s.kind === "field") {
      const f = Math.floor(uu / FIELD.every * 4) % 4, rx = FIELD.rx + [0, 1, 2, 1][f], ry = FIELD.ry + [0, 0, 1, 0][f];
      for (let a = 0; a < 360; a += 12) if (((a / 12) + f) % 2 === 0) put(KX + Math.cos(a * Math.PI / 180) * rx, FEET + Math.sin(a * Math.PI / 180) * ry, "#fee761");
    }
    if (s.kind === "wisp") {
      const from = [tip[0], tip[1]], top = [from[0] + 2, from[1] - 10];
      let x, y, alpha = 1, f = Math.floor(t * 6) % 2;
      if (u < WISP.rise) { const q = u / WISP.rise; x = from[0] + (top[0] - from[0]) * q; y = from[1] + (top[1] - from[1]) * q; }
      else if (u < WISP.rise + WISP.fly) { const q = (u - WISP.rise) / WISP.fly; x = top[0] + (target[0] - 4 - top[0]) * q; y = top[1] + (target[1] - 6 - top[1]) * q - 6 * Math.sin(q * Math.PI); }
      else if (u < WISP.rise + WISP.fly + WISP.every * WISP.strikes) { const q = ((u - WISP.rise - WISP.fly) % WISP.every) / WISP.every; x = target[0] - 4 + (q < 0.3 ? 3 * (q / 0.3) : q < 0.6 ? 3 * (1 - (q - 0.3) / 0.3) : 0); y = target[1] - 6; }
      else { x = target[0] - 4; y = target[1] - 6 - 6 * ((u - WISP.rise - WISP.fly - WISP.every * WISP.strikes) / WISP.fade); alpha = 0; }
      const rows = f ? [".bbb.", "bwWwb", "bWwWb", "bwWwb", ".bbb."] : [".bbb.", "bwwwb", "bwWwb", "bwwwb", ".bbb."], pal = { b: "#8b9bb4", w: "#c0cbdc", W: "#ffffff" };
      for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) { const ch = rows[j][i]; if (ch === ".") continue; if (!alpha && (i + j) % 2) continue; put(x + i - 2, y + j - 2, pal[ch]); }
    }
    return { px, W, H, seg: s.kind, u, t };
  }
  const bboxCache = new Map();
  function bbox(px, n) {
    const key = px; if (bboxCache.has(key)) return bboxCache.get(key);
    let x0 = n, y0 = n, x1 = -1, y1 = -1;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (px[y * n + x]) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    const b = x1 < 0 ? { cx: n / 2, cy: n / 2 } : { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    bboxCache.set(key, b); return b;
  }

  // ------------------------------------------------------------------ the words under the stage
  function words(thing) {
    const { G, FK } = mods(), D = (FK || {}).drill || {}, w = thing.weapon || {}, form = w.form || "slash";
    const el = (D.elements || {})[w.element] || w.element || "steel", phrase = (D.forms || {})[form] || "";
    const st = (w.status || []).map(s => (D.statuses || {})[s]).filter(Boolean);
    const damage = el + (phrase ? ", " + phrase : "") + "." + (st.length ? " " + cap(st.join(" and ")) + "." : "");
    const uses = (((G || {}).forms || {})[form] || {}).uses || Object.keys(w.numbers || {}), nums = w.numbers || {};
    const top = uses.map((k, i) => [k, nums[k] | 0, i]).sort((a, b) => (b[1] - a[1]) || (a[2] - b[2])).slice(0, 2).map(([k]) => (D.strengths || {})[k]).filter(Boolean);
    return { damage, strengths: top.length ? top.join(", ") + "." : "" };
  }

  // ------------------------------------------------------------------ the page's loop
  function mount(canvas, thing, o) {
    o = o || {};
    const P = plan(thing);
    canvas.width = W; canvas.height = H;
    const g = canvas.getContext("2d"), img = g.createImageData(W, H), data = img.data, rgb = new Map();
    const hex = c => { let v = rgb.get(c); if (!v) { v = mods().S.hex(c); rgb.set(c, v); } return v; };
    let t = 0, raf = 0, t0 = 0, stopped = false;
    const draw = at => {
      t = at;
      const f = frameAt(thing, at);
      for (let i = 0; i < W * H; i++) { const c = f.px[i]; if (c) { const v = hex(c); data[i * 4] = v[0]; data[i * 4 + 1] = v[1]; data[i * 4 + 2] = v[2]; data[i * 4 + 3] = 255; } else data[i * 4 + 3] = 0; }
      g.putImageData(img, 0, 0);
    };
    if (o.reduce) { draw(P.still); return { stop() { stopped = true; }, seek: draw, t: () => t, thing, plan: P, still: true }; }
    const tick = now => { if (stopped) return; if (!t0) t0 = now; draw((now - t0) / 1000); raf = root.requestAnimationFrame(tick); };
    raf = root.requestAnimationFrame(tick);
    return { stop() { stopped = true; if (raf) root.cancelAnimationFrame(raf); }, seek(at) { t0 = 0; stopped = true; if (raf) root.cancelAnimationFrame(raf); draw(at); }, t: () => t, thing, plan: P, still: false };
  }

  const api = { W, H, FLOOR, FEET, KX, DX_MELEE, DX_FAR, DX_ORBIT, plan, frameAt, words, mount, ground, wobbleAt, version: 1 };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Drill = api;
})(typeof window !== "undefined" ? window : globalThis);
