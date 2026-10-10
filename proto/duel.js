// FORGE FOREVER: the duel (design pass 36 with its revision 1, the Arena; built 9 October 2026 on Isaac's word, with his two changes:
// no boards, the house's knights fill the seats after a minute). Knights against knights on the sand: one bout of rounds on the cellar's
// combat engine with a rule set of its own, every number in spec/arena.json (window.FORGE_ARENA). This file is the fight's director and
// the arena's half of the hit pipeline; proto/combat.js calls it at a few seams, each behind fight.arena, so the cellar and the castle's
// levels step byte for byte as before.
//
//   Duel.spec()                       spec/arena.json
//   Duel.seatsFor(o)                  the seats a bout needs: o = { mode, players: [{ team, name, level, loadout: [id|thing, id|thing], kind }], local, skill }:
//                                     the local player's team first (seat 0 is always the knight on this phone), the empty seats filled
//                                     with the house's knights (spec house.knights, kind "house")
//   Duel.newFight(o)                  the fight: o = { mode, seed, seats, local, skill }; Combat.newFight on the mode's sand, every knight on
//                                     its side's mark, fight.arena the bout's state and the rules' hooks; no director, no waves, no marks
//   Duel.step(fight, dt, inputs)      one step: inputs keyed by seat (an array or an object); a house seat with no input is driven by the
//                                     duelist brain (proto/bots.js, from fight.rng.bots, so every phone simulates it alike); returns the
//                                     events (Combat.step's, with the duel's own appended). Slow time steps the bodies at dt x arena.slow.
//   Duel.input(raw)                   the input a seat gives: { move: [x, y], strike, swap, dodge, guard, ability, use }
//   Duel.view(fight)                  what the page draws (the camera's wish, the plates, every knight's bars; the camera itself is the
//                                     page's: nothing here reads fight.view)
//   Duel.result(fight)                the bout's result once it has ended (null before)
//   Duel.forfeit(fight, seat)         that seat leaves the bout
//   Duel.tally(fight, seat)           the words of the tally plank for that seat
//   Duel.snapshot(fight) / restore(fight, s) / checksum(fight)   the lockstep's rollback (proto/wire.js)
//
// The rules, in short (the note's sections 4.5 and 4.6): a knight's blow meets the other team's standing knights only; damage is halved
// (takenX); there is no 0.5 s of safety after a blow but hitstun by form with decay; a chain's finisher or the fourth blow within 2 s knocks
// the struck knight down (it lies 0.7 s taking no blow, rises in 0.3 s with 0.5 s of safety that ends when it acts; a Dodge in the lie's
// last 12 ticks rises at once); poise (100) is taken by a blow's class and regrows; at 0 the knight is STAGGERED 1 s and the first blow in
// that second is a CRITICAL (x 2, a knockdown); Guard (held) blocks a melee blow from the front (30 %, a shield 10 %, poise x 1.25) and its
// first 12 ticks are a parry window (a parried foe takes 50 poise, the parrier's next blow is a riposte); Rally gives back half of a
// landed blow from the HP the last blow took, for 2 s; Last Stand at 25 HP regrows poise faster; a whiff costs recovery; a push into the
// wall adds a quarter; shots land x 0.7 beyond 48 px; every status has a PvP time, bleed bursts at five stacks; every class has its
// signature (spec classes); hitlag holds the two bodies of a blow still. Pure: no DOM, no clock, no Math.random (fight.rand and
// fight.rng.bots). Plain script, defines window.Duel (module.exports in node). Needs proto/combat.js, physics.js, bots.js, spec/arena.js,
// spec/combat.js, spec/things.js.
(function (root) {
  "use strict";
  const RAD = Math.PI / 180, TAU = Math.PI * 2, TICK = 1 / 60;
  let CB = null, PH = null, BT = null;
  const req = f => (typeof require === "function" ? require(f) : null);
  const combat = () => CB || (CB = root.Combat || req("./combat.js"));
  const phys = () => PH || (PH = root.Physics || req("./physics.js"));
  const bots = () => BT || (BT = root.Bots || req("./bots.js"));
  function spec() { const A = root.FORGE_ARENA; if (!A) throw new Error("duel.js needs spec/arena.js (window.FORGE_ARENA)"); return A; }
  const combatSpec = () => root.FORGE_COMBAT;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };
  const r3 = v => Math.round(v * 1000) / 1000;

  // ------------------------------------------------------------------ the things and the seats
  function thingOf(id) {
    if (id && typeof id === "object") return id;
    const T = (root.FORGE_THINGS || []).find(t => t.id === id && t.weapon);
    if (T) return T;
    const L = root.FORGE_LEDGER, row = L && L.rows ? L.rows.find(r => r.thing && r.thing.id === id && r.thing.weapon) : null;
    if (row) return row.thing;
    throw new Error("duel.js: no weapon " + id);
  }
  const modeOf = mode => { const M = spec().modes[mode]; if (!M) throw new Error("duel.js: no mode " + mode); return M; };
  // the seats of a bout: the local player's team first with the local player at seat 0, then the other team; each side filled to the
  // mode's count with the house's knights in the spec's order, skipping the names the players took
  function seatsFor(o) {
    const S = spec(), M = modeOf(o.mode), n = M.seats, players = (o.players || []).slice(), local = Math.max(0, Math.min(players.length - 1, o.local || 0));
    const skill = o.skill || S.house.default;
    if (!players.length) players.push({ team: 0, name: "You", level: 1, loadout: ["sword"], kind: "player" });
    const localTeam = players[local].team === undefined ? 0 : players[local].team;
    const mine = players.filter((p, i) => i === local).concat(players.filter((p, i) => i !== local && (p.team === undefined ? 0 : p.team) === localTeam));
    const theirs = players.filter((p, i) => i !== local && (p.team === undefined ? 0 : p.team) !== localTeam);
    const used = new Set(players.map(p => p.name)), houseList = S.house.knights.filter(h => !used.has(h[0]));
    let hi = 0;
    const house = () => { const h = houseList[hi++ % houseList.length], tag = hi > houseList.length ? " " + Math.ceil(hi / houseList.length) : ""; return { name: h[0] + tag, level: S.house.level, loadout: h.slice(1), kind: "house", house: true, skill }; };
    const side = (list, team) => { const out = list.slice(0, n).map(p => Object.assign({}, p, { team, house: !!p.house, kind: p.house ? "house" : p.kind === "remote" ? "remote" : "player", skill: p.skill || skill })); while (out.length < n) out.push(Object.assign(house(), { team })); return out; };
    const seats = side(mine, 0).concat(side(theirs, 1));
    return seats.map((s, i) => Object.assign(s, { seat: i, loadout: (s.loadout || ["sword"]).slice(0, 2).map(thingOf) }));
  }

  // ------------------------------------------------------------------ the fight
  const teamOf = b => b.team !== undefined ? b.team : b.fu && b.fu.knight ? b.fu.knight.team : b.knight !== undefined && b.knight === false ? -1 : -1;
  function markOf(fight, k) {
    const A = fight.arena, S = A.spec, F = fight.floor, side = k.team === 0 ? S.sides.red : S.sides.blue, great = A.sand === "great";
    const x0 = great ? side.xGreat : side.x, x = x0 >= 0 ? x0 : fight.W + x0, mates = A.teams[k.team], i = mates.indexOf(k.seat), n = mates.length;
    const cy = (F.y0 + F.y1) / 2, y = cy + (i - (n - 1) / 2) * S.sides.gap;
    return [x, clamp(y, F.y0 + 8, F.y1 - 8)];
  }
  function gateOf(fight, k) { const S = fight.arena.spec, G = S.wall.gates, F = fight.floor, m = markOf(fight, k); return [k.team === 0 ? G.west + G.w / 2 : fight.W + G.east - G.w / 2, F.y0 + 4 + (m[1] - (F.y0 + F.y1) / 2) * 0.25]; }
  const faceOf = k => k.team === 0 ? 0 : Math.PI;
  function newFight(o) {
    const S = spec(), M = modeOf(o.mode), sandKey = M.sand, SD = S.sands[sandKey], CS = combatSpec(), seats = o.seats || seatsFor(o);
    const area = { id: "arena", name: S.name, level: 1, w: SD.w, h: SD.h, floor: SD.floor, room: SD.room, view: S.view, marks: false, crits: true, difficulty: "normal",
      knight: { starts: seats.map(() => [SD.floor.x0 + 20, (SD.floor.y0 + SD.floor.y1) / 2]), face: 0 }, bots: {}, arena: true };
    const fight = combat().newFight(area, seats.map(s => ({ kind: s.house ? "house" : (s.kind || "player"), name: s.name, loadout: s.loadout })), o.seed || S.seed);
    fight.marks = null;   // the sand's marks are the painter's (blood, craters from the events); nothing here changes the world, so a snapshot is cheap
    const A = fight.arena = {
      spec: S, rules: S.rules, mode: o.mode, sand: sandKey, M, seats, teams: [[], []], local: o.local || 0, skill: o.skill || S.house.default, boardsOn: !!(S.boards && S.boards.on),
      phase: "walkIn", phaseT: 0, round: 1, score: [0, 0], clock: M.round, sudden: false, heat: S.feel.crowd.start, slow: 1, slowT: 0, banner: null, bannerT: 0, punch: 1, punchT: 0,
      rounds: [], result: null, forfeited: null, lastHit: null, stats: seats.map(() => ({ landed: 0, taken: 0, biggest: 0, parries: 0, crits: 0, staggers: 0, bursts: 0, kos: 0 })), botState: {},
      striker: null, roundT: 0, staggerAllows: { walk: false, strike: false, swap: false, ability: false, dodge: false, dodgeEnds: false }
    };
    Object.assign(A, HOOKS);
    for (const k of fight.knights) {
      const s = seats[k.seat];
      Object.assign(k, { i: k.seat, team: s.team, house: !!s.house, skill: s.skill || A.skill, level: s.level || 1, chest: CS.knight.chest, st: {}, weak: [], resist: [], immune: [], flash: 0, wv: 0, combo: null, puff: "sparks",
        poiseMax: S.rules.poise.max, poise: S.rules.poise.max, staggered: 0, poiseImmune: 0, poiseAt: -1e9, lie: 0, rising: 0, safeAct: false, guard: false, guardHeld: 0, guardRelease: 0, guardReleasedAt: -1e9, parryWin: 0,
        riposteUntil: 0, rally: null, lastStand: false, chain: { n: 0, t: -1e9 }, lag: 0, frenzy: null, band: null, bandAt: -1e9, dodgeEnd: -1e9, ko: false, forfeited: false, landedAt: -1e9 });
      A.teams[k.team].push(k.seat);
      for (const h of k.hands) { const CL = S.classes[classOf(h.u)] || {}; if (CL.rateX) h.u.rate *= CL.rateX; }   // the crossbow's slower rate (the units are the hand's own)
    }
    for (const k of fight.knights) { const g = gateOf(fight, k); combat().place(fight, k, g[0], g[1]); k.face = faceOf(k); }
    fight.vw = fight.W; fight.vh = fight.H; combat().setView(fight, 0, 0);   // the rules read no view in the arena; the page keeps its own camera
    A.bots = bots().duelists(fight);
    return fight;
  }
  // the class of a blow's units: its base, or by its form for a legend or an unknown base
  function classOf(u) {
    const S = spec(), base = u.base;
    if (!u.fuse && base && S.classes[base] && base !== "byForm") return base;
    return S.classes.byForm[u.form] || "sword";
  }
  function handOf(k, u) { return k.hands.find(h => h.u === u || h.uf === u || h.u2 === u || h.ua === u) || k.hands[k.active] || k.hands[0]; }
  const shieldOf = k => { const h = k.hands[k.active]; return !!(h && h.u && h.u.base === "shield" && !h.u.fuse); };
  const standsIn = k => !k.out && !k.down && !k.ko && k.hp > 0;
  const acts = k => standsIn(k) && !(k.lie > 0) && !(k.rising > 0);

  // ------------------------------------------------------------------ the input
  function input(raw) {
    raw = raw || {};
    const mv = Array.isArray(raw.move) ? raw.move : [0, 0];
    return { move: [+mv[0] || 0, +mv[1] || 0], strike: !!raw.strike, swap: !!raw.swap, dodge: !!raw.dodge, guard: !!raw.guard, ability: !!raw.ability, use: !!raw.use, target: raw.target };
  }
  const IDLE = () => ({ move: [0, 0], strike: false, swap: false, dodge: false, guard: false, ability: false, use: false });

  // ------------------------------------------------------------------ the step and the director
  function emit(fight, e, k) { return combat().emit(fight, e, k); }
  function step(fight, dt, inputs) {
    const A = fight.arena, S = A.spec, M = A.M;
    const dtE = dt * A.slow;
    const inp = [];
    for (const k of fight.knights) {
      const given = inputs ? inputs[k.seat] : undefined;
      if (A.phase === "walkIn") inp[k.seat] = walkInput(fight, k);
      else if (A.phase !== "fight" || k.ko || k.out) inp[k.seat] = IDLE();
      else if (k.house && given === undefined) inp[k.seat] = input(bots().duelInput(fight, k.seat, dtE));
      else inp[k.seat] = input(given);
    }
    const before = fight.events;
    combat().step(fight, dtE, inp);
    const heatOf = scanEvents(fight);
    A.phaseT += dtE; A.roundT += dtE;
    if (A.phase === "walkIn") { if (A.phaseT >= S.bout.walkIn - 1e-9) hold(fight); }
    else if (A.phase === "hold") { if (A.phaseT >= S.bout.fightHold - 1e-9) startRound(fight); }
    else if (A.phase === "fight") fightStep(fight, dtE);
    else if (A.phase === "roundEnd") { if (A.phaseT >= S.bout.between - 1e-9) resetRound(fight); }
    // the crowd's heat, the slow time, the banner and the camera's punch (the heat floor of a knight in Last Stand on the sand)
    const C = S.feel.crowd;
    A.heat = clamp(A.heat + heatOf - C.decay * dtE, fight.knights.some(k => k.lastStand && standsIn(k)) ? S.rules.lastStand.heatFloor : 0, 1);
    if (A.slowT > 0) { A.slowT -= dt; if (A.slowT <= 1e-9) { A.slowT = 0; A.slow = 1; } }
    if (A.bannerT > 0) { A.bannerT -= dt; if (A.bannerT <= 1e-9) { A.bannerT = 0; A.banner = null; } }
    if (A.punchT > 0) { A.punchT -= dt; if (A.punchT <= 1e-9) { A.punchT = 0; A.punch = 1; } }
    return fight.events;
  }
  // the walk-in: every knight walks from its gate to its mark, then faces its side
  function walkInput(fight, k) {
    const m = markOf(fight, k), out = IDLE(), dd = dist(k.x, k.y, m[0], m[1]);
    if (dd > 1.5) out.move = [(m[0] - k.x) / dd, (m[1] - k.y) / dd];
    else { out.face = faceOf(k); }
    return out;
  }
  function banner(fight, key, o, t) { const A = fight.arena; A.banner = Object.assign({ key }, o || {}); A.bannerT = t; emit(fight, { type: "banner", key, team: o ? o.team : undefined, name: o ? o.name : undefined, t }); }
  function hold(fight) {
    const A = fight.arena, S = A.spec;
    for (const k of fight.knights) { const m = markOf(fight, k); if (!k.out) combat().place(fight, k, m[0], m[1]); k.face = faceOf(k); }
    A.phase = "hold"; A.phaseT = 0;
    banner(fight, "fight", null, S.bout.fightHold);
    emit(fight, { type: "phase", phase: "hold", round: A.round });
  }
  function startRound(fight) {
    const A = fight.arena, M = A.M;
    A.phase = "fight"; A.phaseT = 0; A.clock = M.round; A.sudden = false; A.roundT = 0;
    emit(fight, { type: "phase", phase: "fight", round: A.round }); emit(fight, { type: "fight", round: A.round });
  }
  const sideUp = (fight, t) => fight.arena.teams[t].some(s => standsIn(fight.knights[s]));
  const sideHp = (fight, t) => fight.arena.teams[t].reduce((m, s) => { const k = fight.knights[s]; return m + (standsIn(k) ? k.hp : 0); }, 0);
  function fightStep(fight, dt) {
    const A = fight.arena, S = A.spec;
    const up0 = sideUp(fight, 0), up1 = sideUp(fight, 1);
    if (!up0 || !up1) { if (up0 !== up1) return roundWon(fight, up0 ? 0 : 1, "ko"); return roundVoid(fight); }   // (a double KO on the same tick: the round is void)
    A.clock -= dt;
    if (A.clock > 1e-9) return;
    const h0 = sideHp(fight, 0), h1 = sideHp(fight, 1);
    if (h0 !== h1) return roundWon(fight, h0 > h1 ? 0 : 1, "clock");
    if (!A.sudden) { A.sudden = true; A.clock = S.bout.suddenDeath; banner(fight, "sudden", null, 2.0); emit(fight, { type: "sudden", round: A.round }); return; }
    roundVoid(fight);
  }
  function roundWon(fight, t, why) {
    const A = fight.arena, S = A.spec;
    A.score[t]++;
    A.rounds.push({ winner: t, t: r3(A.roundT), why, round: A.round });
    const last = A.score[t] >= S.bout.rounds, slow = last ? S.bout.slow.last : S.bout.slow.ko;
    A.slow = slow[0]; A.slowT = slow[1];
    A.punch = S.camera.punch.ko[0]; A.punchT = S.camera.punch.ko[1];
    A.heat = clamp(A.heat + S.feel.crowd.ko, 0, 1);
    emit(fight, { type: "roundEnd", winner: t, why, round: A.round, score: A.score.slice() });
    if (last) return boutEnd(fight, t);
    const name = A.M.seats === 1 ? fight.knights[A.teams[t][0]].name : null;
    banner(fight, "roundTo", { team: t, name }, S.bout.between);
    A.phase = "roundEnd"; A.phaseT = 0;
    emit(fight, { type: "phase", phase: "roundEnd", round: A.round });
  }
  function roundVoid(fight) {
    const A = fight.arena, S = A.spec;
    A.rounds.push({ winner: null, t: r3(A.roundT), why: "void", round: A.round });
    emit(fight, { type: "roundEnd", winner: null, why: "void", round: A.round, score: A.score.slice() });
    banner(fight, "void", null, S.bout.between);
    A.phase = "roundEnd"; A.phaseT = 0;
    emit(fight, { type: "phase", phase: "roundEnd", round: A.round });
  }
  // between the rounds: HP, poise and the statuses back, every knight on its mark (a forfeited one stays out); the round counts on
  function resetRound(fight) {
    const A = fight.arena, S = A.spec;
    for (const k of fight.knights) {
      if (k.forfeited) continue;
      Object.assign(k, { hp: k.hpMax, out: false, down: null, ko: false, rise: 0, hurt: 0, stagger: 0, safe: 0, bonk: 0, shove: null, dodge: 0, dodgeCd: 0, lunge: null, strike: null, twinQ: null, gout: null, charging: false, chargeT: 0, abQ: null,
        st: {}, poise: k.poiseMax, staggered: 0, poiseImmune: 0, poiseAt: -1e9, lie: 0, rising: 0, safeAct: false, guard: false, guardHeld: 0, guardRelease: 0, parryWin: 0, riposteUntil: 0, rally: null, lastStand: false, chain: { n: 0, t: -1e9 }, lag: 0, frenzy: null, band: null, flash: 0 });
      for (const h of k.hands) { h.combo = null; h.orbit = null; h.aura = null; h.recover = 0; h.cd = 0; }
      const m = markOf(fight, k); combat().place(fight, k, m[0], m[1]); k.face = faceOf(k);
    }
    fight.shots = []; fight.traps = []; fight.minions = []; fight.patches = [];
    A.round++;
    emit(fight, { type: "roundStart", round: A.round });
    hold(fight);
  }
  function boutEnd(fight, t) {
    const A = fight.arena, S = A.spec;
    A.phase = "boutEnd"; A.phaseT = 0;
    banner(fight, t === 0 ? "yours" : "theirs", { team: t }, 1e9);
    A.result = result(fight, t);
    emit(fight, { type: "phase", phase: "boutEnd", round: A.round });
    emit(fight, { type: "boutEnd", result: A.result });
  }
  // the heat of this step's events: a blow landed, a big moment, a KO
  function scanEvents(fight) {
    const A = fight.arena, C = A.spec.feel.crowd; let h = 0;
    for (const e of fight.events) {
      if (e.type === "hit" && e.knight && e.kind === "direct" && e.amount > 0) h += C.blow;
      else if (e.type === "stagger" || e.type === "parry" || e.type === "bleedOut" || e.type === "crit") h += C.big;
      else if (e.type === "ko") h += C.ko;
    }
    return h;
  }
  function forfeit(fight, seat) {
    const A = fight.arena, k = fight.knights[seat];
    if (!k || k.forfeited) return;
    k.forfeited = true; k.out = true; k.down = null; k.ko = false;
    if (A.forfeited === null) A.forfeited = seat;
    emit(fight, { type: "forfeit", seat, x: k.x, y: k.y }, k);
    if (A.phase === "boutEnd") return;
    if (A.M.seats === 1 || !sideUp(fight, k.team)) { const t = k.team === 0 ? 1 : 0; A.score[t] = Math.max(A.score[t], A.spec.bout.rounds); A.rounds.push({ winner: t, t: r3(A.roundT), why: "forfeit", round: A.round }); boutEnd(fight, t); }
  }

  // ------------------------------------------------------------------ the arena's hooks, called by proto/combat.js behind fight.arena
  const HOOKS = {
    targets(fight) { return fight.knights.filter(q => !q.out); },
    canHit(fight, k, d, u) {
      const team = teamOf(k);
      return d !== k && d.knight && d.team !== team && standsIn(d) && !(d.lie > 0);
    },
    hit: arenaHit,
    dot(fight, d, amount, what, k) {
      const A = fight.arena, dmg = amount * A.rules.takenX * (d.st.mark ? A.spec.statuses.mark.more : 1);
      const res = combat().hurt(fight, d, dmg, { tick: true, src: what });
      if (res !== "hit") return null;
      A.stats[d.seat].taken += dmg; if (k && k.seat !== undefined) A.stats[k.seat].landed += dmg;
      return emit(fight, { type: "hit", d: d.seat, knight: true, dummy: "knight", amount: dmg, tag: null, crit: false, form: null, element: what, kind: "dot", why: what, x: d.x, y: d.y - d.chest - (d.z || 0), melee: false, hold: 0, sum: false, by: k ? k.seat : null }, k);
    },
    fall(fight, k) {
      const A = fight.arena, S = A.spec;
      k.hp = 0; k.hurt = 0; k.stagger = 0; k.staggered = 0; k.dodge = 0; k.strike = null; k.twinQ = null; k.gout = null; k.charging = false; k.chargeT = 0; k.abQ = null; k.lunge = null; k.guard = false; k.parryWin = 0; k.lie = 0; k.rising = 0;
      for (const h of k.hands) { h.combo = null; h.orbit = null; h.aura = null; }
      k.st = {}; k.rally = null; k.frenzy = null;
      const by = A.lastHit && A.lastHit.seat !== k.seat ? A.lastHit.seat : null, R = A.rules;
      if (A.M.seats === 1 || !A.teams[k.team].some(s => s !== k.seat && standsIn(fight.knights[s]))) {
        k.ko = true; k.down = { t: Infinity, lift: 0, by: null, ko: true };
        if (by !== null) { const b = fight.knights[by]; b.lag = Math.max(b.lag, R.hitlag.ko); A.stats[by].kos++; }
        k.lag = Math.max(k.lag, R.hitlag.ko);
        emit(fight, { type: "ko", seat: k.seat, by, x: k.x, y: k.y }, k);
        return;
      }
      k.down = { t: S.bout.down.bleed, lift: 0, by: null };
      emit(fight, { type: "down", x: k.x, y: k.y, bleed: k.down.t, by }, k);
    },
    // hitlag: the body and its clocks stand still; its presses are tracked so nothing fires when it moves again
    lagged(fight, k, dt, inp) {
      if (!(k.lag > 0)) return false;
      k.lag -= dt; if (k.lag <= 1e-9) k.lag = 0;
      k.pressed = !!inp.strike; k.lastDodge = !!inp.dodge; k.lastSwap = !!inp.swap; k.lastAbility = !!inp.ability; k.lastGuard = !!inp.guard; k.moving = false;
      return true;
    },
    knightPre,
    speedX(k) { const A = spec(); return (k.guard ? A.rules.guard.walk : 1) * (k.st.slow ? A.statuses.slow.speed : 1); },
    noStrike(k) { return k.guard || k.guardRelease > 0 || k.lie > 0 || k.rising > 0 || k.ko; },
    rateX(k) {
      const S = spec(); let x = 1;
      if (k.frenzy) { const CL = S.classes.claws.frenzy; x *= 1 + CL.rate * k.frenzy.stacks; }
      if (k.band) x *= 1 + S.classes["battle-horn"].band.rate;
      return x;
    },
    comboWindow(k) { const S = spec(), h = k.hands[k.active], CL = h ? S.classes[classOf(h.u)] : null; return CL && CL.window ? CL.window : combatSpec().combos.window; },
    // a melee blow that met nothing: its recovery grows; a flail's whiffed meteor staggers its own knight
    whiff(fight, k, s) {
      const A = fight.arena, R = A.rules, CL = A.spec.classes[classOf(s.fu)] || {}, fin = s.move === 3;
      let more = fin ? R.whiff.finisher : R.whiff.recover;
      if (CL.whiff) more += CL.whiff;
      if (CL.charge && s.move === 1) more += CL.charge.miss;
      s.dur += more;
      if (CL.selfStagger && fin) { k.stagger = Math.max(k.stagger, CL.selfStagger); emit(fight, { type: "selfStagger", x: k.x, y: k.y }, k); }
      emit(fight, { type: "whiff", form: s.form, fin, x: k.x, y: k.y }, k);
    }
  };

  // the arena's rules on a knight each step, before its own input is read: poise regrows, the stagger and the immunities run down, the
  // statuses tick, the lie-down and the get-up, the safety that ends on an act, Guard and the parry window. Returns true when the knight
  // cannot act this step (it lies, rises, is beaten, frozen or stunned)
  function knightPre(fight, k, dt, inp) {
    const A = fight.arena, S = A.spec, R = A.rules, PZ = R.poise;
    const track = () => { k.pressed = !!inp.strike; k.lastDodge = !!inp.dodge; k.lastSwap = !!inp.swap; k.lastAbility = !!inp.ability; k.lastGuard = !!inp.guard; k.moving = false; };
    if (k.flash > 0) k.flash = Math.max(0, k.flash - dt);
    if (k.staggered > 0) { k.staggered -= dt; if (k.staggered <= 1e-9) endStagger(fight, k, false); }
    if (k.poiseImmune > 0) { k.poiseImmune -= dt; if (k.poiseImmune <= 1e-9) k.poiseImmune = 0; }
    if (k.parryWin > 0) { k.parryWin -= dt; if (k.parryWin <= 1e-9) k.parryWin = 0; }
    if (k.guardRelease > 0) { k.guardRelease -= dt; if (k.guardRelease <= 1e-9) k.guardRelease = 0; }
    if (k.rally) { k.rally.t -= dt; if (k.rally.t <= 1e-9 || k.rally.pool <= 1e-9) k.rally = null; }
    if (k.frenzy) { k.frenzy.t -= dt; if (k.frenzy.t <= 1e-9) k.frenzy = null; }
    if (k.band) { k.band.t -= dt; if (k.band.t <= 1e-9) k.band = null; }
    k.lastStand = k.hp > 0 && k.hp <= R.lastStand.hp;
    if (k.staggered <= 0 && k.poise < k.poiseMax && fight.t - k.poiseAt >= PZ.after - 1e-9 && !A.sudden) k.poise = Math.min(k.poiseMax, k.poise + PZ.regrow * (k.lastStand ? R.lastStand.poiseX : 1) * dt);
    statusStep(fight, k, dt);
    if (k.ko || k.out || k.down) { track(); return !!(k.ko || k.out); }   // (down: combat's lie() crawls and the lift is lifeStep's)
    if (k.lie > 0) {
      const edge = !!inp.dodge && !k.lastDodge; track();
      k.lie -= dt;
      if (edge && k.lie <= R.knockdown.quickRise.ticks * TICK + 1e-9) { quickRise(fight, k, inp); return true; }
      if (k.lie <= 1e-9) { k.lie = 0; k.rising = R.knockdown.rise; }
      return true;
    }
    if (k.rising > 0) {
      track(); k.rising -= dt;
      if (k.rising <= 1e-9) { k.rising = 0; k.safe = Math.max(k.safe, R.knockdown.safe); k.safeAct = true; emit(fight, { type: "rise", quick: false, x: k.x, y: k.y }, k); }
      return true;
    }
    if (k.safeAct && ((inp.strike && !k.pressed) || (inp.dodge && !k.lastDodge) || inp.guard)) { k.safe = 0; k.safeAct = false; }
    if (k.st.freeze || k.st.stun) { track(); if (k.guard) { k.guard = false; k.parryWin = 0; } return true; }
    // Guard: held, the weapon is up; its first ticks are the parry window (a press soon after a release gets the short one)
    const held = !!inp.guard && !k.strike && (k.guard || !(k.stagger > 0));   // a guard already up stays up through hitstun (blockstun is still a guard); a new one waits for the stun to pass
    if (held && !k.guard) {
      const re = fight.t - k.guardReleasedAt < R.parry.repress.within;
      k.guard = true; k.guardHeld = 0; k.parryWin = (re ? R.parry.repress.ticks : shieldOf(k) ? R.parry.ticksShield : R.parry.ticks) * TICK;
      k.charging = false; k.chargeT = 0;
      emit(fight, { type: "guard", on: true, parry: k.parryWin, x: k.x, y: k.y }, k);
    } else if (!held && k.guard) {
      k.guard = false; k.guardReleasedAt = fight.t; k.guardRelease = R.guard.release; k.parryWin = 0;
      emit(fight, { type: "guard", on: false, x: k.x, y: k.y }, k);
    }
    k.lastGuard = !!inp.guard;
    if (k.guard) k.guardHeld += dt;
    return false;
  }
  function quickRise(fight, k, inp) {
    const C = combatSpec(), D = C.knight.dodge, R = fight.arena.rules.knockdown.quickRise, mv = inp.move || [0, 0], mm = Math.hypot(mv[0], mv[1]);
    const a = mm > 0.05 ? Math.atan2(mv[1], mv[0]) : k.face + Math.PI;
    k.lie = 0; k.rising = 0; k.safeAct = false;
    k.dodge = D.time; k.dodgeCd = D.cooldown; k.safe = D.safe; k.dvx = Math.cos(a) * R.roll / D.time; k.dvy = Math.sin(a) * R.roll / D.time;
    emit(fight, { type: "rise", quick: true, x: k.x, y: k.y, a }, k);
    emit(fight, { type: "dodge", x: k.x, y: k.y, a }, k);
  }
  function knockdown(fight, d, by, why) {
    const R = fight.arena.rules.knockdown;
    d.lie = R.lie; d.rising = 0; d.safeAct = false; d.stagger = 0; d.staggered = 0; d.strike = null; d.twinQ = null; d.lunge = null; d.charging = false; d.chargeT = 0; d.guard = false; d.parryWin = 0; d.chain = { n: 0, t: -1e9 };
    for (const h of d.hands) h.combo = null;
    if (d.poise <= 0 || d.staggered > 0) endStagger(fight, d, true);
    emit(fight, { type: "knockdown", seat: d.seat, by: by ? by.seat : null, why: why || null, x: d.x, y: d.y }, d);
  }
  function takePoise(fight, d, n, by) {
    const A = fight.arena, R = A.rules.poise;
    if (!(n > 0) || d.poiseImmune > 0 || d.staggered > 0 || d.poise <= 0) return false;
    d.poise = Math.max(0, d.poise - n); d.poiseAt = fight.t;
    if (d.poise > 0) return false;
    d.staggered = R.stagger; d.stagger = Math.max(d.stagger, R.stagger);
    if (d.strike && d.strike.t < d.strike.wind) { d.strike = null; d.twinQ = null; d.lunge = null; for (const h of d.hands) h.combo = null; }
    d.guard = false; d.parryWin = 0; d.charging = false; d.chargeT = 0;
    A.punch = Math.max(A.punch, A.spec.camera.punch.stagger[0]); A.punchT = Math.max(A.punchT, A.spec.camera.punch.stagger[1]);
    A.stats[d.seat].staggers++;
    emit(fight, { type: "stagger", seat: d.seat, by: by ? by.seat : null, x: d.x, y: d.y - d.chest }, d);
    return true;
  }
  function endStagger(fight, k, punished) {
    const R = fight.arena.rules.poise;
    k.staggered = 0; k.poise = k.poiseMax; k.poiseImmune = R.immune; k.poiseAt = fight.t;
    if (!punished) k.stagger = 0;
    emit(fight, { type: "staggerEnd", seat: k.seat, punished: !!punished }, k);
  }
  // a knight's statuses in the arena: a troll's st shape (the page draws them as it draws a troll's), the PvP table's times; bleed bursts at five
  function statusStep(fight, k, dt) {
    const A = fight.arena, ST = A.spec.statuses, st = k.st;
    for (const key of Object.keys(st)) {
      const s = st[key]; if (!s) { delete st[key]; continue; }
      s.t -= dt;
      if (key === "burn" || key === "poisoned" || key === "bleed") {
        s.tick += dt;
        const Z = ST[key], per = Z.tick;
        if (s.tick >= per - 1e-9) {
          s.tick -= per;
          const amount = key === "bleed" ? Z.perStack * k.hpMax * (s.stacks || 1) : Z.damage * (s.stacks || 1);
          tickDamage(fight, k, amount, key, s.by);
        }
      }
      if (s.t <= 1e-9) { delete st[key]; if (key === "freeze") st.freezeImm = { t: ST.freeze.immune }; if (key === "stun") st.stunImm = { t: ST.stun.immune }; if (key === "bleed" && s.burst) st.bleedImm = { t: ST.bleed.immune }; }
    }
  }
  function tickDamage(fight, k, amount, what, bySeat) {
    const A = fight.arena, by = bySeat !== undefined && bySeat !== null ? fight.knights[bySeat] : null;
    const dmg = amount * (k.st.mark ? A.spec.statuses.mark.more : 1);
    const res = combat().hurt(fight, k, dmg, { tick: true, src: what });
    if (res !== "hit") return;
    A.stats[k.seat].taken += dmg; if (by) A.stats[by.seat].landed += dmg;
    emit(fight, { type: "hit", d: k.seat, knight: true, dummy: "knight", amount: dmg, tag: null, crit: false, form: null, element: what === "poisoned" ? "poison" : what === "burn" ? "fire" : what, kind: "dot", why: what, x: k.x, y: k.y - k.chest - (k.z || 0), melee: false, hold: 0, sum: false, by: by ? by.seat : null }, by);
  }
  function addBleed(fight, d, n, by) {
    const A = fight.arena, Z = A.spec.statuses.bleed, st = d.st;
    if (st.bleedImm) return;
    const cur = st.bleed || { stacks: 0, tick: 0 };
    st.bleed = { stacks: Math.min(Z.stacks, cur.stacks + n), t: Z.time, tick: cur.tick || 0, by: by ? by.seat : null };
    emit(fight, { type: "status", d: d.seat, knight: true, status: "bleed", stacks: st.bleed.stacks }, by);
    if (st.bleed.stacks < Z.stacks) return;
    // the burst: a share of the whole bar at once, the stacks cleared, a while of immunity
    delete st.bleed; st.bleedImm = { t: Z.immune };
    const amount = Z.burst * d.hpMax;
    const res = combat().hurt(fight, d, amount, { tick: true, src: "bleed" });
    if (res !== "hit") return;
    A.stats[d.seat].taken += amount; if (by) { A.stats[by.seat].landed += amount; A.stats[by.seat].bursts++; }
    emit(fight, { type: "bleedOut", seat: d.seat, by: by ? by.seat : null, amount, x: d.x, y: d.y - d.chest }, d);
    emit(fight, { type: "hit", d: d.seat, knight: true, dummy: "knight", amount, tag: "BLEED OUT", crit: false, form: null, element: "bleed", kind: "dot", why: "bleed", x: d.x, y: d.y - d.chest - (d.z || 0), melee: false, hold: 0, sum: false, by: by ? by.seat : null }, by);
  }
  // the weapon's statuses and a class's, with the arena's times
  function applyStatuses(fight, d, u, k, dmg, CL) {
    const A = fight.arena, ST = A.spec.statuses, st = d.st, timeX = CL.statusTimeX || 1;
    const list = (u.statuses || []).slice();
    if (CL.sets) list.push(CL.sets);
    if (CL.bleedPerBlow && !list.includes("bleed")) addBleed(fight, d, CL.bleedPerBlow + (u.isFinisher ? (CL.finisherStacks || 1) - 1 : 0), k);   // (a weapon that bleeds by its own sentence stacks once a blow, not twice)
    for (const s of list) {
      const Z = ST[s]; if (!Z) continue;
      let applied = true;
      if (s === "burn") st.burn = { t: Z.time * timeX, tick: (st.burn || {}).tick || 0, by: k.seat };
      else if (s === "freeze") { if (st.freezeImm || st.freeze) applied = false; else { st.freeze = { t: Z.hold }; d.strike = null; d.guard = false; d.parryWin = 0; } }
      else if (s === "shock") {
        st.shock = { t: 0.3 };
        const near = fight.knights.filter(x => x !== d && x.team === d.team && standsIn(x) && !(x.lie > 0) && dist(d.x, d.y, x.x, x.y) <= Z.within).sort((a, b) => dist(d.x, d.y, a.x, a.y) - dist(d.x, d.y, b.x, b.y) || a.seat - b.seat)[0];
        if (near) { emit(fight, { type: "fx", kind: "arc", from: [d.x, d.y - d.chest], to: [near.x, near.y - near.chest], el: "lightning", seed: fight.steps }, k); arenaHit(fight, near, dmg * Z.share / A.rules.takenX, { form: null, kind: "raw", why: "shock", from: [d.x, d.y - d.chest], fu: u }); }
      }
      else if (s === "poisoned") st.poisoned = { t: Z.time * timeX, stacks: Math.min(Z.stacks, ((st.poisoned || {}).stacks || 0) + 1), tick: (st.poisoned || {}).tick || 0, by: k.seat };
      else if (s === "bleed") addBleed(fight, d, 1, k);
      else if (s === "stun") { if (st.stunImm || st.stun) applied = false; else { st.stun = { t: Z.time }; d.stagger = Math.max(d.stagger, Z.time); d.guard = false; d.parryWin = 0; } }
      else if (s === "slow" || s === "blind" || s === "weaken" || s === "mark") st[s] = { t: (s === "blind" && CL.setsTime ? CL.setsTime : Z.time) * timeX };
      else if (s === "lifesteal") { const v = dmg * Z.heal; k.hp = Math.min(k.hpMax, k.hp + v); emit(fight, { type: "heal", amount: v, why: "lifesteal", x: k.x, y: k.y }, k); }
      else if (s === "knockback") applied = false;   // this blow's push x 1.5, applied with the push
      if (applied && s !== "bleed") emit(fight, { type: "status", d: d.seat, knight: true, status: s, stacks: (st[s] || {}).stacks || null }, k);
    }
  }
  const fromFront = (d, from) => Math.abs(angDiff(Math.atan2(from[1] - d.y, from[0] - d.x), d.face)) <= spec().rules.guard.arc / 2 * RAD + 1e-9;
  // the arena's hit pipeline: a blow, a shot, a burst, a touch or a jump on a knight (o as combat.js's hit: { form, kind, from, fu, melee, move, centre, why, floor })
  function arenaHit(fight, d, base, o) {
    const A = fight.arena, S = A.spec, R = A.rules, ST = S.statuses, CS = combatSpec(), u = o.fu, k = u.knight || fight.k;
    if (!HOOKS.canHit(fight, k, d, u)) return null;
    A.striker = k;
    const direct = o.kind === "direct", tick = o.kind === "tick", raw = o.kind === "raw", melee = !!o.melee;
    const cls = classOf(u), CL = S.classes[cls] || {}, hand = handOf(k, u), tier = hand && hand.thing ? (hand.thing.tier || 3) : 3, fin = !!u.isFinisher;
    const from = o.from || [k.x, k.y - k.chest], at = [d.x, d.y - d.chest - (d.z || 0)];
    const event = (amount, tag, crit, hold, kind) => emit(fight, { type: "hit", d: d.seat, knight: true, dummy: "knight", amount, tag, crit, form: o.form, element: u.element, kind: kind || o.kind, why: o.why || null, x: at[0], y: at[1], melee, hold, sum: false, by: k.seat, cls, move: o.move || null, fin }, k);
    // a blind knight's blows miss half the time
    if (direct && k.st.blind && fight.rand() < ST.blind.miss) { emit(fight, { type: "miss", seat: d.seat, by: k.seat, x: at[0], y: at[1] }, k); return event(0, "MISS", false, 0); }
    const gear = clamp(1 + R.gear.perTier * (tier - R.gear.atTier), R.gear.min, R.gear.max);
    let dmg = base * R.takenX * gear * (k.st.weaken ? 1 - ST.weaken.less : 1) * (d.st.mark ? ST.mark.more : 1) * (CL.K || 1);
    let tag = null, crit = false, knock = false, push = (direct || tick) ? (u.push || 0) * (o.share || 1) * (u.statuses.includes("knockback") ? ST.knockback.push : 1) : 0;
    const cd = dist(k.x, k.y, d.x, d.y);
    if (o.form === "shoot" || o.form === "lob") { if (cd > R.shots.within) dmg *= CL.farX !== undefined ? CL.farX : R.shots.farX; }
    if (u.isAbility && o.form === "field") dmg *= R.abilities.novaX;
    if (direct && melee && CL.counter && d.strike && !d.strike.done) { dmg *= CL.counter.x; tag = "COUNTER"; if (CL.counter.cancels) { d.strike = null; d.twinQ = null; d.lunge = null; for (const h of d.hands) h.combo = null; } }
    if (direct && melee && CL.inside && cd < CL.inside) dmg *= CL.insideX;
    if (direct && melee && CL.far && cd >= CL.far) dmg *= CL.farX;
    if (direct && CL.reapX && ((d.st.bleed && d.st.bleed.stacks >= (CL.reapStacks || 1)) || d.staggered > 0)) dmg *= CL.reapX;
    const riposte = direct && melee && k.riposteUntil > fight.t;
    if (riposte) { k.riposteUntil = 0; dmg *= R.parry.riposte.x; tag = "RIPOSTE"; if (CL.riposteFinisher) knock = true; }
    // the guard: a melee blow from the front on a knight whose weapon is up is parried in the window, else blocked; a shot is blocked
    let blocked = false, crushed = false, poiseX = 1;
    if (direct && d.guard && !d.strike && !(riposte && R.parry.riposte.unblockable) && fromFront(d, from)) {
      if (melee && d.parryWin > 0 && !CL.unparryable && !(R.parry.crushUnparryable && CL.crush && fin && R.guard.crush.forms.includes(o.form))) {
        const PR = R.parry;
        d.parryWin = 0; d.riposteUntil = fight.t + PR.riposte.within;
        k.lag = Math.max(k.lag, PR.hold); d.lag = Math.max(d.lag, PR.hold);
        if (!takePoise(fight, k, PR.poise, d)) k.stagger = Math.max(k.stagger, PR.stagger);
        if (k.strike) { k.strike = null; k.twinQ = null; k.lunge = null; for (const h of k.hands) h.combo = null; }
        A.stats[d.seat].parries++;
        emit(fight, { type: "parry", seat: d.seat, by: k.seat, x: at[0], y: at[1] }, d);
        return event(0, "PARRY", false, PR.hold);
      }
      if (!melee) {
        if (R.guard.blocksShots) { emit(fight, { type: "block", seat: d.seat, by: k.seat, shot: true, x: at[0], y: at[1] }, d); return event(0, "BLOCK", false, 0); }
      } else {
        blocked = true; tag = "BLOCK";
        let take = shieldOf(d) ? R.guard.takeShield : R.guard.take;
        if (CL.onGuard !== undefined) take = Math.min(take, CL.onGuard);
        if (R.guard.crush.forms.includes(o.form) && (fin || !R.guard.crush.finisherOnly) && CL.crush) { take = R.guard.crush.take; poiseX *= R.guard.crush.poiseX; crushed = true; tag = "CRUSH"; }
        if (CL.finisherIgnoresGuard && fin) take = 1;
        if (CL.guardPoiseX) poiseX *= CL.guardPoiseX;
        dmg *= take; push *= R.guard.push;
        if (CL.blockedSets && ST[CL.blockedSets]) { d.st[CL.blockedSets] = { t: ST[CL.blockedSets].time }; emit(fight, { type: "status", d: d.seat, knight: true, status: CL.blockedSets, stacks: null }, k); }
        emit(fight, { type: "block", seat: d.seat, by: k.seat, crushed, x: at[0], y: at[1] }, d);
      }
    }
    // the crit on a staggered knight, before the blow lands
    if (direct && d.staggered > 0 && !blocked) { dmg *= R.poise.crit.x; crit = true; tag = "CRIT"; if (R.poise.crit.knockdown) knock = true; endStagger(fight, d, true); A.stats[k.seat].crits++; if (CL.critCrater && fight.marks !== undefined) emit(fight, { type: "crater", x: d.x, y: d.y, r: 10 }, k); }
    // hitstun by form, decaying along a chain of blows; the chain's cap, the finisher, a cannon's ball, a lance's charge and a shield's bash
    let stun = 0;
    if (direct && !raw) {
      const ch = d.chain, HS = R.hitstun;
      if (fight.t - ch.t <= R.knockdown.capWithin) ch.n++; else ch.n = 1;
      ch.t = fight.t;
      stun = (HS[o.form] || 0) + (fin ? HS.finisher : 0) + (crit ? HS.crit : 0);
      stun *= Math.pow(HS.decay, Math.max(0, ch.n - 1));
      if (fin && R.knockdown.finisher) knock = true;
      if (ch.n >= R.knockdown.capBlows) knock = true;
      if (CL.knockdown && o.form === "lob") knock = true;
      if (CL.charge && CL.charge.knockdown && o.move && hand && hand.combo === null) {}   // (the lance's couched move is its first; marked by the move's name below)
      if (CL.charge && CL.charge.knockdown && o.move === "couched") knock = true;
      if (CL.finisherKnockdown && fin) knock = true;
      if (CL.bashStun && o.move === "bash") { if (!d.st.stunImm && !d.st.stun) { d.st.stun = { t: CL.bashStun }; stun = Math.max(stun, CL.bashStun); } }
    }
    // the wall: a push that would carry the knight into the sand's edge
    if (push > 0 && !blocked) {
      const F = fight.floor, a = Math.atan2(d.y - from[1], d.x - from[0]), nx = d.x + Math.cos(a) * (push + 4), ny = d.y + Math.sin(a) * (push + 4);
      if (nx < F.x0 || nx > F.x1 || ny < F.y0 || ny > F.y1) { dmg *= R.wall.damage; stun += R.wall.hitstun; if (!tag) tag = "WALL"; emit(fight, { type: "wallHit", seat: d.seat, x: d.x, y: d.y }, d); }
    }
    // the blow lands
    const res = combat().hurt(fight, d, dmg, { melee, from, push, stagger: stun, src: cls, shot: !melee && direct && (o.form === "shoot") ? "arrow" : undefined });
    if (res === "safe" || res === "none") return null;
    if (res === "block" || res === "reflect") return event(0, "BLOCK", false, 0);
    A.lastHit = { seat: k.seat, t: fight.t };
    const alive = d.hp > 0;
    const St = A.stats; St[k.seat].landed += dmg; St[d.seat].taken += dmg; if (dmg > St[k.seat].biggest) St[k.seat].biggest = dmg;
    // hitlag on the two bodies, the flash, the poise, the knockdown, Rally, the statuses, the signatures' after-effects
    let hold = 0;
    if (direct && !raw) {
      const HL = R.hitlag; hold = clamp(HL.base + HL.perDamage * dmg, HL.base, HL.max) + (crit || fin ? HL.big : 0);
      if (alive) { k.lag = Math.max(k.lag, hold); d.lag = Math.max(d.lag, hold); }
      d.flash = CS.feel.flash;
      const base = typeof CL.poise === "number" ? CL.poise : (S.classes[S.classes.byForm[u.form] || "sword"] || {}).poise || 10;
      let poise = fin ? (CL.finisherPoise || base * R.poise.finisherX) : base;
      if (blocked) poise *= R.poise.blockedX;
      poise *= poiseX;
      if (alive && !crit) takePoise(fight, d, poise, k);
      if (alive && knock && !(d.lie > 0)) knockdown(fight, d, k, crit ? "crit" : fin ? "finisher" : "chain");
      // Rally: the struck knight may win this back; the striker wins back what it lost lately
      if (R.rally.on && alive) {
        if (k.rally && k.rally.pool > 0) { const back = Math.min(k.rally.pool, dmg * R.rally.share); k.rally.pool -= back; k.hp = Math.min(k.hpMax, k.hp + back); emit(fight, { type: "rally", seat: k.seat, amount: back, x: k.x, y: k.y - k.chest }, k); }
        if (!blocked) d.rally = { t: R.rally.time, pool: dmg };
      }
      if (!blocked && alive) applyStatuses(fight, d, u, k, dmg, CL);
      if (CL.frenzy) { const F = CL.frenzy; k.frenzy = { stacks: Math.min(F.stacks, (k.frenzy ? k.frenzy.stacks : 0) + 1), t: F.time }; }
      if (CL.band && fight.t - k.bandAt >= CL.band.cooldown) { k.bandAt = fight.t; for (const m of fight.knights) if (m !== k && m.team === k.team && standsIn(m) && dist(k.x, k.y, m.x, m.y) <= CL.band.within) { m.band = { t: CL.band.time }; emit(fight, { type: "band", seat: m.seat, by: k.seat }, m); } }
      if (alive && !blocked && melee && ((CL.pull && o.move === "sidewinder") || (CL.hookPull && o.move === "hook"))) { const px = CL.pull || CL.hookPull, dd = dist(d.x, d.y, k.x, k.y); if (dd > 1e-6) phys().push(fight.world, d, (k.x - d.x) / dd, (k.y - d.y) / dd, Math.min(px, Math.max(0, dd - k.r - d.r))); emit(fight, { type: "pull", seat: d.seat, by: k.seat, px }, d); }
      if (alive && CL.pin && !melee && fight.t - d.dodgeEnd <= CL.pin + 1e-9 && !d.st.stunImm && !d.st.stun) { d.st.stun = { t: CL.pin }; d.stagger = Math.max(d.stagger, CL.pin); if (!tag) tag = "PIN"; emit(fight, { type: "pin", seat: d.seat, by: k.seat, x: at[0], y: at[1] }, d); }
      if (!blocked && !fin && (cls === "spellbook" || cls === "orb") && CL.fieldSlow && o.form === "orbit") d.st.slow = { t: ST.slow.time };
    } else if (tick && alive && !blocked) { d.flash = CS.feel.flash; applyStatuses(fight, d, u, k, dmg, CL); }
    return event(dmg, tag, crit, hold);
  }

  // ------------------------------------------------------------------ what the page draws
  function view(fight) {
    const A = fight.arena, S = A.spec, me = fight.knights[A.local] || fight.knights[0];
    let focus = [me.x, me.y];
    if (me) { let best = null, bd = Infinity; for (const q of fight.knights) { if (q.team === me.team || !standsIn(q)) continue; const dd = dist(me.x, me.y, q.x, q.y); if (dd < bd) { bd = dd; best = q; } }
      if (best && bd <= S.camera.leanToFoe.within) { const a = Math.atan2(best.y - me.y, best.x - me.x), lean = Math.min(S.camera.leanToFoe.max, bd / 2); focus = [me.x + Math.cos(a) * lean, me.y + Math.sin(a) * lean]; } }
    return {
      mode: A.mode, sand: A.sand, phase: A.phase, phaseT: r3(A.phaseT), round: A.round, clock: Math.max(0, A.clock), score: A.score.slice(), heat: A.heat, slow: A.slow, sudden: A.sudden, focus, punch: A.punch, punchT: A.punchT,
      banner: A.banner ? Object.assign({ t: A.bannerT }, A.banner) : null, local: A.local, boardsOn: A.boardsOn, house: A.teams[1].every(s => fight.knights[s].house),
      knights: fight.knights.map(k => ({ seat: k.seat, team: k.team, name: k.name, house: !!k.house, kind: k.kind, hands: k.hands.map(h => h.thing.id), active: k.active, hp: k.hp, hpMax: k.hpMax, poise: k.poise, poiseMax: k.poiseMax, staggered: k.staggered, down: k.down && !k.ko ? k.down.t : 0, ko: !!k.ko,
        lie: k.lie, rising: k.rising > 0, safe: k.safe > 0, safeAct: !!k.safeAct, guard: !!k.guard, parryWin: k.parryWin, rally: k.rally ? k.rally.pool : 0, lastStand: !!k.lastStand, statuses: Object.keys(k.st).filter(s => !/Imm$/.test(s)), out: !!k.out, forfeited: !!k.forfeited,
        x: k.x, y: k.y, z: k.z || 0, face: k.face, flash: k.flash || 0, lag: k.lag || 0, stagger: k.stagger, frenzy: k.frenzy ? k.frenzy.stacks : 0, band: !!k.band, riposte: k.riposteUntil > fight.t })),
      result: A.result
    };
  }
  function result(fight, winner) {
    const A = fight.arena;
    const w = winner !== undefined ? winner : A.result ? A.result.winner : null;
    return { mode: A.mode, winner: w, score: A.score.slice(), rounds: A.rounds.map(r => Object.assign({}, r)), byseat: A.stats.map((s, i) => Object.assign({ seat: i, team: fight.knights[i].team, name: fight.knights[i].name, house: !!fight.knights[i].house }, s)),
      forfeited: A.forfeited, house: A.teams[1].every(s => fight.knights[s].house) || A.teams[0].slice(1).concat(A.teams[1]).every(s => fight.knights[s].house), checksum: checksum(fight), t: r3(fight.t), local: A.local };
  }
  function tally(fight, seat) {
    const A = fight.arena, S = A.spec, W = S.words.tally, res = A.result || result(fight);
    const k = fight.knights[seat === undefined ? A.local : seat], win = res.winner === k.team, st = A.stats[k.seat];
    const title = res.forfeited === k.seat ? W.forfeited : res.winner === null ? W.void : win ? W.win : W.loss;
    const fill = (s, o) => s.replace(/\{(\w+)\}/g, (m, key) => o[key] === undefined ? m : o[key]);
    const lines = [fill(W.rounds, { a: res.score[k.team], b: res.score[k.team === 0 ? 1 : 0] }), fill(W.blows, { landed: Math.round(st.landed), taken: Math.round(st.taken) }), fill(W.biggest, { n: Math.round(st.biggest) }), fill(W.parries, { n: st.parries })];
    if (res.house) lines.push(W.house);
    return { title, lines, win, house: res.house, void: res.winner === null, forfeited: res.forfeited === k.seat };
  }

  // ------------------------------------------------------------------ the snapshot (the lockstep's rollback): everything Duel.step reads or writes
  // The knights, the hands and their units, the spec and the world are kept by reference (pinned): a knight's own fields are copied field by
  // field; the transient lists (shots, traps, minions, patches) are deep copies whose references to pinned objects stay references
  const SKIP = new Set(["hands", "_mv"]);
  function copier(fight) {
    const pin = new Set([fight.area, fight.world, fight.arena.spec, fight.arena.rules, fight.arena.M, fight.arena.seats, fight.arena.bots, fight.floor, fight.walls, fight.view]);
    for (const k of fight.knights) { pin.add(k); for (const h of k.hands) { pin.add(h); pin.add(h.thing); for (const u of [h.u, h.u2, h.ua, h.uf]) if (u) pin.add(u); } }
    for (const key of Object.keys(HOOKS)) pin.add(HOOKS[key]);
    const seen = new Map();
    function clone(v) {
      if (v === null || typeof v !== "object") return v;
      if (pin.has(v)) return v;
      if (seen.has(v)) return seen.get(v);
      let out;
      if (Array.isArray(v)) { out = []; seen.set(v, out); for (const x of v) out.push(clone(x)); return out; }
      if (ArrayBuffer.isView(v)) { out = v.slice(); seen.set(v, out); return out; }
      if (v instanceof Set) { out = new Set(); seen.set(v, out); for (const x of v) out.add(clone(x)); return out; }
      if (v instanceof Map) { out = new Map(); seen.set(v, out); for (const [a, b] of v) out.set(clone(a), clone(b)); return out; }
      if (v.fu && v.fu.knight) { /* a shot, a trap, a minion: its units are pinned, the rest copied */ }
      out = {}; seen.set(v, out);
      for (const key of Object.keys(v)) { const x = v[key]; if (typeof x === "function") continue; out[key] = clone(x); }
      return out;
    }
    return clone;
  }
  function snapshot(fight) {
    const A = fight.arena, clone = copier(fight);
    const knights = fight.knights.map(k => { const o = {}; for (const key of Object.keys(k)) { if (SKIP.has(key)) continue; const x = k[key]; if (typeof x === "function") continue; o[key] = clone(x); } o.hands = k.hands.map(h => ({ cd: h.cd, recover: h.recover, recoverOf: h.recoverOf, count: h.count, lungeCd: h.lungeCd, acd: h.acd, acdOf: h.acdOf, combo: clone(h.combo), orbit: clone(h.orbit), aura: clone(h.aura), hasUf: !!h.uf })); return o; });
    const arena = {}; for (const key of Object.keys(A)) { if (key === "spec" || key === "rules" || key === "M" || key === "seats" || key === "bots" || typeof A[key] === "function") continue; arena[key] = clone(A[key]); }
    return { t: fight.t, steps: fight.steps, nextId: fight.nextId, bodyId: fight.bodyId, rand: fight.rand.state(), rng: { waves: fight.rng.waves.state(), marks: fight.rng.marks.state(), bots: fight.rng.bots.state() },
      knights, shots: clone(fight.shots), traps: clone(fight.traps), minions: clone(fight.minions), patches: clone(fight.patches), board: clone(fight.board), arena, wipe: null, k: fight.k.seat, hand: fight.hand || null };
  }
  function restore(fight, s) {
    const clone = copier(fight);
    fight.t = s.t; fight.steps = s.steps; fight.nextId = s.nextId; fight.bodyId = s.bodyId;
    fight.rand.seed(s.rand); fight.rng.waves.seed(s.rng.waves); fight.rng.marks.seed(s.rng.marks); fight.rng.bots.seed(s.rng.bots);
    fight.knights.forEach((k, i) => {
      const o = s.knights[i];
      for (const key of Object.keys(k)) if (!SKIP.has(key) && !(key in o) && typeof k[key] !== "function") delete k[key];
      for (const key of Object.keys(o)) { if (key === "hands") continue; k[key] = clone(o[key]); }
      k.hands.forEach((h, j) => { const q = o.hands[j]; h.cd = q.cd; h.recover = q.recover; h.recoverOf = q.recoverOf; h.count = q.count; h.lungeCd = q.lungeCd; h.acd = q.acd; h.acdOf = q.acdOf; h.combo = clone(q.combo); h.orbit = clone(q.orbit); h.aura = clone(q.aura); });
      k._mv = null;
    });
    fight.shots = clone(s.shots); fight.traps = clone(s.traps); fight.minions = clone(s.minions); fight.patches = clone(s.patches); fight.board = clone(s.board);
    const A = fight.arena; for (const key of Object.keys(s.arena)) A[key] = clone(s.arena[key]);
    fight.wipe = null; fight.events = []; fight.live = []; fight.tdirty = true; fight.tlist = null;
    fight.world.list = combat().bodies(fight);
    return fight;
  }
  // a 32-bit checksum of the rules' state (never the view: every phone's camera differs)
  function checksum(fight) {
    let h = 0x811c9dc5 | 0;
    const mix = v => { h = Math.imul(h ^ (v | 0), 0x01000193) | 0; };
    const fx = v => mix(Math.round((v || 0) * 1024));
    const A = fight.arena;
    mix(fight.steps); fx(fight.t); mix(fight.rand.state()); mix(fight.rng.bots.state());
    for (const k of fight.knights) { fx(k.x); fx(k.y); fx(k.hp); fx(k.poise); fx(k.staggered); fx(k.stagger); fx(k.lie); fx(k.lag); fx(k.face); mix(k.ko ? 1 : 0); mix(k.down ? 1 : 0); mix(k.out ? 1 : 0); mix(k.guard ? 1 : 0); fx(k.parryWin); mix(k.active); mix(k.strike ? 1 : 0); fx(k.strike ? k.strike.t : 0); for (const key of Object.keys(k.st)) { mix(key.length); fx(k.st[key].t); } for (const hd of k.hands) { fx(hd.cd); fx(hd.recover); } }
    mix(fight.shots.length); for (const p of fight.shots) { fx(p.x); fx(p.y); }
    mix(A.phase.length); mix(A.round); mix(A.score[0]); mix(A.score[1]); fx(A.clock); mix(A.sudden ? 1 : 0); fx(A.slow); fx(A.heat);
    return h >>> 0;
  }

  root.Duel = { spec, seatsFor, newFight, step, input, view, result, forfeit, tally, snapshot, restore, checksum, classOf, markOf, gateOf, IDLE };
  if (typeof module !== "undefined" && module.exports) module.exports = root.Duel;
})(typeof window !== "undefined" ? window : globalThis);
