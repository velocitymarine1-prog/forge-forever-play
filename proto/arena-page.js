// FORGE FOREVER: the Arena's page (design pass 36 with its revision 1, built on Isaac's word of 9 October 2026 as build 27, with his two
// changes: the boards are off and a minute in the queue fills the empty seats with the house's knights). The Battlegrounds page
// (proto/battlegrounds.js) mounts this file with ?area=arena and hands it the page's hooks; this file owns what the Arena adds to that
// page: the Gate of Champions (the lobby: the mode plates, the queue's words, the house's skill, the record plate, the tablet's line),
// the bout's flow (the seats, the fight through proto/duel.js, the session through proto/wire.js, the walk-in, FIGHT, the rounds, the
// KO, the tally, Again, back to the Gate), the arena's HUD (the round plate, the poise bar under the health plate, the foe's plate in a
// duel, the names and bars over every other knight, the Guard button and its parry rim), the feel on the page (the banners across the
// middle, trauma shake, the camera's punch-in, the impact frame, haptics, the crowd's heat handed to the painter), the phone's own
// record (spec/arena.json record.key: wins and losses by mode, this phone's and no board's), the XP run sent home to the Forge, and the
// way out (a forfeit mid-bout). The rules are proto/duel.js's, the painter proto/arena.js's, the wire proto/wire.js's; the numbers are
// spec/arena.json's (window.FORGE_ARENA). Plain script, defines window.ArenaPage.
(function (root) {
  "use strict";
  const A = () => root.FORGE_ARENA || {};
  const W = () => (A().words || {});
  let H = null;   // the page's hooks (mount)
  // the arena's own state on the page
  const P = { lobby: true, mode: "1v1", skill: null, online: false, queue: null, session: null, bout: null, seats: null, seed: 0, heat: 0, trauma: 0, punch: { z: 1, t: 0, dur: 0, from: 1 },
    veil: 0, cam: null, ended: false, result: null, tallyAt: 0, lastView: null, lines: {}, banners: [], house: false, record: null, since: 0, forfeited: false, waiting: false, xpSent: null, loadoutIds: [],
    fallen: [], beatenFx: {},   // (design pass 39) the weapons lying on the sand this round, and what each beaten knight's fall has already thrown (the dust, the pool, the shards, the scorch)
    drill: false };   // (design pass 39) this bout is the Drill (proto/arena-drill.js over a local bout against Mara)
  const DR = () => root.ArenaDrill || null;
  const DW = () => ((A().drill || {}).words || {});
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const fill = (s, o) => String(s || "").replace(/\{(\w+)\}/g, (m, k) => (o && o[k] !== undefined ? o[k] : m));
  const mmss = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  const $ = id => H.$(id);

  // ------------------------------------------------------------------ the record: this phone's own wins and losses by mode (no board)
  function readRecord() {
    const R = A().record || {}, key = R.key || "forge-forever:arena-record";
    let d = null; try { d = JSON.parse(H.store.get(key) || "null"); } catch (e) { d = null; }
    if (!d || typeof d !== "object" || d.v !== 1) d = { v: 1, modes: {}, house: { day: "", wins: 0 }, streak: 0 };
    for (const m of (R.modes || ["1v1", "2v2", "3v3", "4v4"])) if (!Array.isArray(d.modes[m])) d.modes[m] = [0, 0];
    if (!d.house || typeof d.house !== "object") d.house = { day: "", wins: 0 };
    return d;
  }
  function writeRecord(d) { const R = A().record || {}; return H.store.set(R.key || "forge-forever:arena-record", JSON.stringify(d)); }
  const today = () => new Date().toISOString().slice(0, 10);

  // ------------------------------------------------------------------ the lobby: the Gate of Champions
  function skillDefault() { const hs = A().house || {}; return hs.default && hs.skills && hs.skills[hs.default] ? hs.default : Object.keys((hs.skills || {}))[0] || "knight"; }
  function modeList() { const M = A().modes || {}; return Object.keys(M).sort((a, b) => (M[a].order || 0) - (M[b].order || 0)); }
  function renderLobby() {
    const el = $("lobby"); if (!el) return;
    const L = W().lobby || {}, M = A().modes || {}, rec = P.record || (P.record = readRecord());
    const plates = modeList().map(m => {
      const md = M[m], r = rec.modes[m] || [0, 0], lit = P.mode === m, q = P.queue && P.queue.mode === m ? P.queue.line : null;
      return '<button type="button" class="lplate f-iron' + (lit ? " lit" : "") + '" data-mode="' + m + '" aria-pressed="' + String(lit) + '"><b>' + m + ' · ' + (md.name || m) + '</b><span class="ln">' + (q || (L.modeLine || {})[m] || "") + '</span><span class="rc">' + fill(L.record || "{mode} {w}–{l}", { mode: "", w: r[0], l: r[1] }).trim() + '</span></button>';
    }).join("");
    const skills = (A().house || {}).skills || {}, sk = P.skill || (P.skill = skillDefault());
    const chips = Object.keys(skills).map(s => '<button type="button" data-skill="' + s + '" aria-pressed="' + String(sk === s) + '">' + ((L.skills || {})[s] || s) + '</button>').join("");
    const hands = (H.getFight() && H.getFight().hands || []).map(h => h.thing), lo = hands.length > 1 ? fill(L.loadout || "You carry {a} and {b}", { a: hands[0].name || hands[0].id, b: hands[1].name || hands[1].id }) : hands.length ? fill(L.loadoutOne || "You carry {a}", { a: hands[0].name || hands[0].id }) : "";
    const online = !!(H.Wire && H.Wire.available && H.Wire.available());
    // (design pass 39) the Drill's plate: Grycus teaches the sand; its line says when it was done
    const Dd = A().drill || {}, drillRec = DR() && Dd.on ? DR().record() : null;
    const drillPlate = Dd.on && DR() ? '<button type="button" class="lplate f-iron drill" id="lobbyDrill"><b>' + (DW().plate || "The Drill") + '</b><span class="ln">' + (DW().plateLine || "Grycus teaches the sand") + '</span><span class="rc">' + (drillRec && drillRec.done ? (DW().plateDone || "done") : "") + '</span></button>' : "";
    el.innerHTML = '<div class="lhead"><h2>' + (L.title || "The Gate of Champions") + '</h2><p class="small">' + (online ? "" : (L.offline || "Your phone is offline: the house's knights will fight you")) + '</p></div>'
      + '<div class="lplates">' + plates + drillPlate + '</div>'
      + '<div class="lside"><div class="ltablet plank f-parch"><h2>' + (L.tablet || "CHAMPIONS") + '</h2><p class="small">' + (L.boardsOff || "The boards are not open yet. Your record is this phone's own.") + '</p>'
      + '<p class="small lo">' + lo + '</p><p class="small">' + (L.skill || "The house's skill") + '</p><div class="chips lskill">' + chips + '</div>'
      + '<div class="pbtns"><button type="button" class="f-ember primary" id="lobbyFight">' + (L.fight || "FIGHT") + '</button><button type="button" class="f-iron" id="lobbySpar">' + (L.spar || "Spar") + '</button></div>'
      + '<p class="small">' + (L.sparLine || "the house's knights, any time") + '</p></div></div>';
    el.querySelectorAll(".lplate").forEach(b => b.addEventListener("click", () => { if (P.queue) return; P.mode = b.dataset.mode; renderLobby(); }));
    el.querySelectorAll(".lskill button").forEach(b => b.addEventListener("click", () => { P.skill = b.dataset.skill; renderLobby(); }));
    const fb = $("lobbyFight"); if (fb) fb.addEventListener("click", () => { if (P.queue) leaveQueue(); else if (!drillFirst()) start(P.mode); });
    const sb = $("lobbySpar"); if (sb) sb.addEventListener("click", () => { if (P.queue) leaveQueue(); if (!drillFirst()) startBout({ online: false, mode: P.mode }); });
    const db = $("lobbyDrill"); if (db) db.addEventListener("click", () => { if (P.queue) leaveQueue(); startBout({ online: false, mode: (A().drill || {}).mode || "1v1", drill: true }); });
    if (P.queue && fb) fb.textContent = L.leaveQueue || "Stop looking";
    el.hidden = false;
  }
  // (design pass 39) a phone with no drill done runs the Drill before its first bout (a toast says so; Skip is on the plank)
  function drillFirst() {
    const Dr = DR(); if (!Dr || !Dr.due || !Dr.due()) return false;
    H.toast && H.toast(DW().first || "The Drill first.");
    startBout({ online: false, mode: (A().drill || {}).mode || "1v1", drill: true });
    return true;
  }
  function showLobby() {
    P.lobby = true; P.ended = false; P.result = null; P.bout = null; P.drill = false;
    const g = $("game"); if (g) { g.classList.remove("bout"); g.classList.add("lobbying"); }   // (design pass 39: the lobby hides the sand's buttons)
    for (const id of ["hpPlate", "poisePlate", "roundPlate", "foePlate", "guardBtn"]) { const e = $(id); if (e) e.hidden = true; }
    renderLobby();
  }
  function hideLobby() { const el = $("lobby"); if (el) el.hidden = true; P.lobby = false; const g = $("game"); if (g) { g.classList.add("bout"); g.classList.remove("lobbying"); } }

  // ------------------------------------------------------------------ the queue and the seats
  function playerSeat() {
    const f = H.getFight(), hands = (f && f.hands || []).map(h => h.thing), S = H.smith || {};
    return { seat: 0, team: 0, name: S.name || "You", level: S.level || 1, loadout: hands.length ? hands.slice(0, 2) : [], kind: "player" };
  }
  function start(mode) {
    P.mode = mode;
    const L = W().lobby || {};
    if (H.Wire && H.Wire.available && H.Wire.available() && H.Wire.queue) {
      const me = playerSeat();
      P.queue = { mode, line: fill(L.looking || "Looking for a knight… {t}", { t: "0:00" }), t0: Date.now() };
      try {
        P.queue.q = H.Wire.queue({ mode, name: me.name, level: me.level, loadout: me.loadout.map(t => t.id), onState: s => {
          if (!P.queue) return;
          if (s.kind === "looking") P.queue.line = s.waiting > 1 ? fill(L.waiting || "{n} knights waiting", { n: s.waiting }) : fill(L.looking || "Looking for a knight… {t}", { t: mmss(s.t || (Date.now() - P.queue.t0) / 1000) });
          else if (s.kind === "filling") P.queue.line = L.filling || "The house's knights are coming";
          else if (s.kind === "found") { const q = P.queue; P.queue = null; startBout(Object.assign({ online: true }, s)); return; }
          else if (s.kind === "offline" || s.kind === "error") { P.queue = null; startBout({ online: false, mode }); return; }
          else if (s.kind === "left") P.queue.line = fill(L.left || "{name} left the gate", { name: s.name || "A knight" });
          renderLobby();
        } });
      } catch (e) { P.queue = null; startBout({ online: false, mode }); return; }
      renderLobby();
      return;
    }
    startBout({ online: false, mode });
  }
  function leaveQueue() { if (P.queue && P.queue.q && P.queue.q.leave) { try { P.queue.q.leave(); } catch (e) { /* gone */ } } P.queue = null; renderLobby(); }
  // the seats of a bout: the player at seat 0, team 0; the players a found bout names on their seats; the house's knights for the rest
  function seatsFor(o) {
    const Duel = H.Duel, me = playerSeat();
    // online: the Herald's seats stand as they are (every phone must number the seats alike: the packets are keyed by seat); each seat's
    // loadout comes as thing ids and is resolved here; the house's seats are the Herald's too
    if (o.online && Array.isArray(o.seats) && o.seats.length) {
      const things = root.FORGE_THINGS || [], thingOf = id => (typeof id === "string" ? (H.world && H.world.get && H.world.get(id)) || things.find(t => t.id === id) || null : id);
      return o.seats.map(s => Object.assign({}, s, { kind: s.house ? "house" : s.seat === o.seat ? "player" : "remote", loadout: (Array.isArray(s.loadout) ? s.loadout : []).map(thingOf).filter(Boolean),
        name: s.seat === o.seat ? me.name : s.name })).map(s => s.seat === o.seat && !s.loadout.length ? Object.assign(s, { loadout: me.loadout }) : s);
    }
    if (o.drill) {   // (design pass 39) the Drill: the kid against Mara of the house, at the drill's skill
      const Dd = A().drill || {}, partner = Dd.partner || ["Mara", "sword", "bow"], hs = A().house || {};
      return Duel.seatsFor({ mode: o.mode || Dd.mode || "1v1", players: [me, { team: 1, name: partner[0], level: hs.level || 8, loadout: partner.slice(1), kind: "house", house: true, skill: Dd.skill || "squire" }], skill: Dd.skill || "squire", local: 0 });
    }
    return Duel.seatsFor({ mode: o.mode || P.mode, players: [me], skill: P.skill || skillDefault(), local: 0 });
  }
  // a bout: the fight, the scene, the session; the lobby goes, the HUD comes
  function startBout(o) {
    const Duel = H.Duel, mode = o.mode || P.mode, M = (A().modes || {})[mode] || {}, sandKey = M.sand || "pit", sand = (A().sands || {})[sandKey];
    P.mode = mode; P.online = !!o.online; P.ended = false; P.result = null; P.forfeited = false; P.waiting = false; P.xpSent = null; P.heat = (A().feel || {}).crowd ? (A().feel.crowd.start || 0) : 0; P.trauma = 0; P.veil = 0; P.punch = { z: 1, t: 0, dur: 0, from: 1 };
    P.fallen = []; P.beatenFx = {}; P.drill = !!o.drill; if (!o.drill && DR() && DR().active) DR().end();
    const seed = o.seed !== undefined ? (o.seed >>> 0) : ((Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0);
    P.seed = seed;
    let seats; try { seats = seatsFor(o); } catch (e) { (root.__errors || []).push("arena seats: " + (e && e.message)); return false; }
    P.seats = seats;
    let fight, scene;
    const local = P.online && typeof o.seat === "number" ? o.seat : 0;
    try {
      fight = Duel.newFight({ mode, seed, seats, local, skill: o.drill ? ((A().drill || {}).skill || "squire") : (P.skill || skillDefault()), online: P.online, drill: !!o.drill });
      // the page's knight is the one on this phone: online its seat is the Herald's, not 0
      if (local !== 0 && fight.knights[local]) { fight.k = fight.knights[local]; fight.hands = fight.k.hands; if (fight.arena) fight.arena.local = local; }
      // the page's area object follows the sand (the window reads its size; the floor and the walls are the fight's own)
      if (sand) { H.AREA.w = sand.w; H.AREA.h = sand.h; H.AREA.floor = Object.assign({}, sand.floor); H.AREA.room = Object.assign({}, sand.room); H.AREA.camera = Object.assign({}, A().camera || {}, sand.camera || {}); H.AREA.sand = sandKey; }
      const areaForScene = Object.assign({}, H.AREA, { id: "arena", art: "Arena", level: 0, arena: true });
      scene = H.Arena && H.Arena.art ? new H.Scene(areaForScene, H.Arena.art) : new H.Scene(areaForScene, null);
      if (scene.tiles && scene.tiles.finish) { try { scene.tiles.finish(0); scene.tiles.finish(1); if (sand && sand.w > 384) scene.tiles.finish(2); } catch (e) { /* baked in slices */ } }
    } catch (e) { (root.__errors || []).push("arena fight: " + (e && (e.stack || e.message))); return false; }
    H.setFight(fight, scene);
    P.house = fight.arena && Array.isArray(fight.arena.teams) ? (fight.arena.teams[1] || []).every(s => (fight.knights[s] || {}).house) : false;
    // the session: the wire's (the found bout) or the local one (the Drill's always local, Mara's input from the coach)
    try {
      if (P.drill) { const Dr = DR(); P.session = localSession(fight, Duel, Dr ? f => Dr.coach(f) : null); if (Dr) Dr.start(fight); }
      else if (P.online && H.Wire && H.Wire.session) P.session = H.Wire.session({ bout: o.bout, ticket: o.ticket, seat: local, seats: o.seats, seed, fight, duel: Duel,
        onStart: () => {}, onForfeit: (seat, tick) => onForfeit(seat, tick), onVoid: why => onVoid(why), onEnd: r => onWireEnd(r), onWaiting: w => { P.waiting = !!w; },
        onError: why => { H.toast((W().sand || {}).shifted || "The sand shifted. The bout is void."); onVoid(why); } });
      else P.session = H.Wire && H.Wire.local ? H.Wire.local({ fight, duel: Duel, seat: 0 }) : localSession(fight, Duel);
    } catch (e) { (root.__errors || []).push("arena session: " + (e && e.message)); P.session = localSession(fight, Duel); P.online = false; }
    // the painter's banner: the names of the two sides; its crowd and gates reset for the bout
    try { const art = H.Arena && H.Arena.art; if (art) { if (art.reset) art.reset(); if (art.banner) art.banner(bannerNames(fight)); if (art.heat) art.heat(P.heat); } } catch (e) { /* the painter stands */ }
    hideLobby();
    for (const id of ["hpPlate", "poisePlate", "roundPlate", "guardBtn"]) { const e = $(id); if (e) e.hidden = false; }
    const fp = $("foePlate"); if (fp) fp.hidden = (M.seats || 1) !== 1;
    P.cam = null; P.lastView = null; hud.key = ""; hud.foe = ""; hud.round = ""; hud.poise = -1; hud.guard = null; hud.parry = null;
    H.clearFx(); H.syncHud(); H.fit();
    H.toast && (P.house && !P.drill ? H.toast((W().tally || {}).house || "Against the house's knights") : null);
    return true;
  }
  // a session with no wire at all (proto/wire.js missing, or the Drill): the sim steps straight, the house seats driven by the rules, or
  // seat 1 by a coach while it gives an input (design pass 39)
  function localSession(fight, Duel, coach) {
    return { local: true, frame(dt, inp) { const inputs = {}; inputs[0] = inp; if (coach) { const c = coach(fight); if (c !== undefined) inputs[1] = c; } const events = Duel.step(fight, dt, inputs); return { events }; }, result() {}, close() {}, forfeit() {} };
  }
  function bannerNames(fight) {
    const T = fight.arena && fight.arena.teams || [[0], [1]];
    const names = t => (t || []).map(s => (fight.knights[s] || {}).name || "").filter(Boolean).join(" · ");
    return names(T[0]) + "  ·  " + names(T[1]);
  }

  // ------------------------------------------------------------------ the bout's step: the session's frame, the duel's events, the feel
  function step(inp0) {
    if (P.lobby || !P.session) return [];
    const Duel = H.Duel, fight = H.getFight();
    const raw = Object.assign({}, inp0, { guard: !!(inp0.guard || H.input.guard || (H.input.keys && H.input.keys.guard)) });
    const inp = Duel.input ? Duel.input(raw) : raw;
    let r; try { r = P.session.frame(H.STEP, inp); } catch (e) { (root.__errors || []).push("arena step: " + (e && (e.stack || e.message))); return []; }
    const events = (r && r.events) || [];
    const out = [];
    for (const e of events) {
      if (e.type === "hurt") continue;   // (a blow on a knight comes as a hit event; the level's hurt number would double it)
      if (H.sceneTake) H.sceneTake(e);   // (the painter sees every event: the gates on the walk-in's phase, the crowd's heat, the sparks, the petals)
      if (!takeArena(e, fight)) out.push(e);
    }
    const v = P.lastView = Duel.view(fight);
    if (v && typeof v.heat === "number") setHeat(v.heat);
    beatenStep(fight);
    if (P.drill && DR()) { try { DR().events(events, fight); DR().tick(fight); } catch (e) { (root.__errors || []).push("drill: " + (e && e.message)); } }
    camera(v);
    if (v && v.result && !P.ended) ended(v.result);
    return out;
  }
  const BIG = new Set(["crit", "parry", "ko"]);
  function takeArena(e, fight) {
    const F = A().feel || {}, S = W().sand || {}, k = e.seat !== undefined ? fight.knights[e.seat] : null;
    switch (e.type) {
      case "phase": if (e.phase === "fight" && !e.silent) banner(S.fight || "FIGHT", null, true); return true;
      case "fight": banner(S.fight || "FIGHT", null, true); return true;
      case "banner": {   // (the rules name a banner by its key: the words are the spec's)
        const key = e.key || "", side = e.team === 0 || e.team === 1 ? e.team : null, sideWord = ((S.sides || {})[side === 0 ? "red" : "blue"]) || (side === 0 ? "RED" : "BLUE");
        const text = e.text || (key === "fight" ? (S.fight || "FIGHT") : key === "roundTo" ? (e.name ? fill(S.roundTo || "ROUND TO {name}", { name: String(e.name).toUpperCase() }) : fill(S.roundToSide || "ROUND TO THE {side}", { side: sideWord }))
          : key === "sudden" ? (S.sudden || "SUDDEN DEATH") : key === "void" ? (S.void || "VOID") : key === "yours" || key === "theirs" ? null : key ? String(key).toUpperCase() : null);
        if (text) banner(text, e.line || null, key === "fight" || e.quick === true); return true;
      }
      case "roundEnd": {
        const T = fight.arena && fight.arena.teams || [[0], [1]], side = e.winner === 0 || e.winner === 1 ? e.winner : null;
        const names = side === null ? null : T[side].map(s => (fight.knights[s] || {}).name).filter(Boolean);
        const text = e.why === "void" ? (S.void || "VOID") : side === null ? (S.void || "VOID") : names && names.length === 1 ? fill(S.roundTo || "ROUND TO {name}", { name: names[0].toUpperCase() }) : fill(S.roundToSide || "ROUND TO THE {side}", { side: ((S.sides || {})[side === 0 ? "red" : "blue"]) || (side === 0 ? "RED" : "BLUE") });
        banner(text, null, false); kick(F.shake && F.shake.trauma ? F.shake.trauma.ko : 0.5); punch("ko"); haptic("ko"); return true;
      }
      case "sudden": banner(S.sudden || "SUDDEN DEATH", null, false); return true;
      case "boutEnd": return true;   // (the view's result ends the bout: ended())
      case "ko": { kick((F.shake && F.shake.trauma ? F.shake.trauma.ko : 0.5)); punch("ko"); haptic("ko"); veil(); painterTake(e); fling(e, fight); if (k && (fight.arena.M.seats || 1) > 1 && S.beaten) H.say(k.x, k.y - 44, fill(S.beaten, { name: String(k.name || "").toUpperCase() }), "#e43b44", true); return true; }   // (design pass 39: the weapon flies from the hand; in a team mode the name says who fell)
      case "roundStart": P.fallen = []; P.beatenFx = {}; return true;   // (design pass 39: the round's sand cleared of the fallen weapons)
      case "stagger": { if (k) H.say(k.x, k.y - 44, "STAGGER", "#fee761", true); kick(F.shake && F.shake.trauma ? F.shake.trauma.big : 0.35); punch("stagger"); haptic("big"); H.addFx({ kind: "sparks", x: e.x, y: e.y - 20, seed: fight.steps, n: 8, ramp: ["#733e39", "#feae34", "#fee761", "#ffffff"] }); painterTake(e); return true; }
      case "crit": { kick(F.shake && F.shake.trauma ? F.shake.trauma.big : 0.35); haptic("big"); veil(); H.addFx({ kind: "star", x: e.x, y: e.y - 4, c: "#fee761", big: true, life: 0.25 }); painterTake(e); return true; }
      case "parry": { if (k) H.say(k.x, k.y - 44, "PARRY", "#fee761", true); H.addFx({ kind: "sparks", x: e.x, y: e.y, seed: fight.steps + 7, n: (F.sparks || {}).parry || 12 }); H.hold((A().rules || {}).hitlag ? A().rules.hitlag.parry || 0.12 : 0.12); kick(F.shake && F.shake.trauma ? F.shake.trauma.big : 0.35); haptic("big"); veil(); painterTake(e); return true; }
      case "block": { H.addFx({ kind: "sparks", x: e.x, y: e.y, seed: fight.steps + 3, n: (F.sparks || {}).block || 6 }); painterTake(e); return true; }
      case "counter": { if (k) H.say(k.x, k.y - 44, "COUNTER", "#fee761", true); return true; }
      case "knockdown": { H.addFx({ kind: "dust", x: e.x, y: e.y, life: 0.4 }); H.addFx({ kind: "dust", x: e.x + 6, y: e.y + 2, life: 0.45 }); painterTake(e); return true; }
      case "rise": return true;
      case "bleedOut": { if (k) H.say(k.x, k.y - 44, "BLEED OUT", "#e43b44", true); H.addFx({ kind: "bleed", x: e.x, y: e.y - 10, n: 10, seed: fight.steps, life: 0.5 }); painterTake(e); return true; }
      case "rally": { if (k && e.amount >= 1) H.say(k.x, k.y - 38, "+" + Math.round(e.amount), "#f77622"); return true; }
      case "wallHit": { H.addFx({ kind: "dust", x: e.x, y: e.y, c: "#9a948c", life: 0.4 }); kick(F.shake && F.shake.trauma ? F.shake.trauma.blow : 0.15); painterTake(e); return true; }
      case "pin": { if (k) H.say(k.x, k.y - 44, "PIN", "#fee761", true); return true; }
      case "heat": setHeat(e.heat); return true;
      case "forfeit": onForfeit(e.seat); return true;
      case "hit": {
        if (e.knight) { kick(e.crit || e.fin ? (F.shake && F.shake.trauma ? F.shake.trauma.big : 0.35) : (F.shake && F.shake.trauma ? F.shake.trauma.blow : 0.15)); haptic(e.crit || e.fin ? "big" : "blow"); if (e.fin) veil(); }
        return false;   // the page says the number and holds the screen
      }
      default: return false;
    }
  }
  function painterTake(e) { /* (the scene already took the event in step(); kept for the effects the page adds on top) */ return !!e; }
  function setHeat(h) { P.heat = clamp(h, 0, 1); try { if (H.Arena && H.Arena.art && H.Arena.art.heat) H.Arena.art.heat(P.heat); } catch (e) { /* no crowd */ } }
  // the feel: trauma for the shake (Eiserloh: added per event, shake = trauma squared), the camera's punch-in, the impact frame, the haptics
  function kick(n) { if (H.reduce) return; P.trauma = clamp(P.trauma + (n || 0), 0, 1); }
  // (design pass 39) the punch-in is off by its key (camera.punch.on false: a zoom changes the picture's size and scales the pixel grid by a
  // non-whole number; the slow time and the trauma carry the KO); the numbers stay for Isaac's call
  function punch(kind) { if (H.reduce) return; const C = (A().camera || {}).punch || {}, p = C[kind]; if (!p || C.on === false) return; P.punch = { from: 1, z: p[0], t: 0, dur: p[1], ease: C.ease || 0.4 }; }
  function veil() { if (H.reduce) return; const I = (A().feel || {}).impactFrame; if (I && I.on !== false) P.veil = I.frames || 2; }
  function haptic(kind) {
    const F = (A().feel || {}).haptics; if (!F || H.reduce) return;
    try { if (H.store.get("forge-forever:haptics-off") === "1") return; if (root.navigator && typeof root.navigator.vibrate === "function") root.navigator.vibrate(F[kind] || F.blow || 10); } catch (e) { /* no motor */ }
  }
  // ------------------------------------------------------------------ the fall (design pass 39): a beaten knight's weapon on the sand, the frame of its fall,
  // and what the fall throws as its clock (k.beaten.t, the sim's, at the slow time's rate) passes each mark of spec beaten
  const BT = () => A().beaten || {};
  // the KO: the knight's weapon flies from its hand along the blow (10 px, a hop) and lies where it lands till the round resets
  function fling(e, fight) {
    const k = fight.knights[e.seat]; if (!k || !k.hands || !k.hands[k.active]) return;
    const h = k.hands[k.active], by = e.by !== null && e.by !== undefined ? fight.knights[e.by] : null, B = BT();
    const dx = by ? k.x - by.x : (k.face !== undefined ? -Math.cos(k.face) : 1), dy = by ? k.y - by.y : 0, dd = Math.hypot(dx, dy) || 1, push = B.weaponPush || 10;
    const lx = k.x + dx / dd * push * 1.6, ly = Math.min(fight.floor ? fight.floor.y1 - 1 : k.y + 3, k.y + 3 + dy / dd * 4);
    P.fallen = P.fallen.filter(f => f.seat !== k.seat);
    P.fallen.push({ seat: k.seat, thing: h.thing, x0: k.x, y0: k.y - 20, x: lx, y: ly, t0: fight.t, fly: B.weaponFly || 0.3, side: dx >= 0 ? "right" : "left" });
  }
  // the frame of the fall for a beaten knight: the pose by its clock (hurt, the knees, the topple, lying), the overlay by what killed it
  // (frozen stiff then shards, burning then ash, poisoned green), a jolt of white for a shock, a pixel of bounce as it lands; still
  // under less motion: lying at once
  function fallFrame(k) {
    const B = BT(), F = B.fall || [0.12, 0.30, 0.45], t = k.beaten.t, w = k.beaten.with, still = H.reduce, steps = (H.getFight() || {}).steps || 0;
    const out = { anim: "lie", i: 0, overlay: null, overlayI: 0, shards: false, white: false, dy: 0, bubbles: false, gone: false, lying: still || t >= F[2] };
    out.anim = still || t >= F[2] ? "lie" : t >= F[1] ? "topple" : t >= F[0] ? (w === "freeze" ? "hurt" : "down") : "hurt";
    if (!still && out.lying && t < F[2] + (B.bounce || 0.12)) out.dy = -1;
    if (w === "burn") { if (t >= (B.ash || 2.0)) out.overlay = "ash"; else { out.overlay = "burning"; out.overlayI = still ? 0 : (steps >> 3) & 1; } }
    else if (w === "freeze") { if (t >= (B.shardsFade || 1.6)) out.gone = true; else if (t >= (B.shatter || 0.6)) out.shards = true; else out.overlay = "frozen"; }
    else if (w === "shock") { if (!still && out.lying && t < F[2] + (B.jolt || 0.4)) out.white = ((steps >> 1) & 1) === 1; }
    else if (w === "poisoned") { if (out.lying) { out.overlay = "sick"; out.bubbles = t < F[2] + (B.bubbles || 1.5); } }
    return out;
  }
  // what the fall throws, once each as the clock passes the mark: the dust of the landing, the pool of a bled knight, the shards and the
  // damp of a frozen one, the scorch and the smoke of a burnt one, the sparks of a shocked one
  function beatenStep(fight) {
    const B = BT(), F = B.fall || [0.12, 0.30, 0.45];
    for (const k of fight.knights) {
      if (!k.beaten || !k.ko) continue;
      const t = k.beaten.t, w = k.beaten.with, d = P.beatenFx[k.seat] || (P.beatenFx[k.seat] = {}), seed = fight.steps + k.seat * 13;
      if (!d.land && t >= F[2]) { d.land = true; H.addFx({ kind: "dust", x: k.x - 6, y: k.y, life: 0.4 }); H.addFx({ kind: "dust", x: k.x + 8, y: k.y + 1, life: 0.45 }); }
      if (w === "bleed" && !d.pool && t >= (B.pool || 0.5)) { d.pool = true; H.stamp({ kind: "blood", x: k.x, y: k.y + 2, r: 10, id: k.seat }); }
      if (w === "freeze" && !d.shatter && t >= (B.shatter || 0.6)) { d.shatter = true; H.addFx({ kind: "shards", x: k.x, y: k.y - 6, n: 12, seed, life: 0.6 }); H.stamp({ kind: "damp", x: k.x, y: k.y + 2, r: 9, id: k.seat }); }
      if (w === "burn" && !d.scorch && t >= (B.ash || 2.0)) { d.scorch = true; H.stamp({ kind: "scorch", x: k.x, y: k.y + 2, r: 9, id: k.seat }); }
      if (w === "burn" && t >= (B.ash || 2.0) && !H.reduce && fight.steps % 54 === 0) H.addFx({ kind: "smoke", x: k.x - 4 + (seed % 9), y: k.y - 4, n: 3, seed, life: B.smoke || 0.9 });
      if (w === "shock" && !H.reduce && t >= F[2] && t < F[2] + (B.jolt || 0.4) && fight.steps % 6 === 0) H.addFx({ kind: "sparks", x: k.x + (seed % 7) - 3, y: k.y - 6, seed, n: 4 });
    }
  }
  // the fallen weapons, under the actors: in flight for weaponFly s (a hop of 10 px, tumbling through the four facings), then lying
  function drawFallen(ctx, t) {
    const fight = H.getFight(); if (!fight || !P.fallen.length || !H.weaponCanvas) return;
    const fxf = H.reduce ? 0 : Math.floor(t * 8) % 4, FAC = ["toward", "away"];
    for (const f of P.fallen) {
      const age = fight.t - f.t0, q = f.fly > 0 ? Math.min(1, age / f.fly) : 1, flying = q < 1 && !H.reduce;
      const facing = flying ? FAC[Math.floor(q * 4) & 1] : f.side;
      let wc; try { wc = H.weaponCanvas(f.thing, facing, fxf); } catch (e) { continue; }
      if (!wc || !wc.c) continue;
      const x = f.x0 + (f.x - f.x0) * q, y = f.y0 + (f.y - f.y0) * q - (flying ? 10 * Math.sin(Math.PI * q) : 0);
      if (!flying) { try { if (H.longShadow) H.longShadow(ctx, f.x, f.y, 6); } catch (e) { /* no shadow */ } }
      ctx.drawImage(wc.c, Math.round(x - wc.grip[0]), Math.round(y - wc.grip[1]));
    }
  }

  // the banner across the middle: the page's LEVEL CLEAR band with the arena's words (quick: FIGHT's second; else the band's 3.4 s)
  function banner(text, line, quick) { if (!text) return; try { H.banner(String(text), line || "", !!quick); } catch (e) { /* no band */ } }
  // the camera: the view's wish (the local knight leaned toward the nearest foe) followed at the sand's speed, clamped to the sand's range;
  // never part of the simulation (every phone has its own)
  function camera(v) {
    const fight = H.getFight(); if (!fight || !v) return;
    const C = H.AREA.camera || {}, VW = (A().view || {}).w || 384, VH = (A().view || {}).h || 216, rx = C.x || [0, 0], ry = C.y || [0, 0];
    const f = v.focus || [fight.k.x, fight.k.y];
    const wantX = clamp(Math.round(f[0] - (C.aimX || VW / 2)), rx[0], rx[1]), wantY = clamp(Math.round(f[1] - (C.aimY || VH / 2)), ry[0], ry[1]);
    if (!P.cam) P.cam = [wantX, wantY];
    const sp = (C.speed || 96) * H.STEP;
    P.cam[0] += clamp(wantX - P.cam[0], -sp, sp); P.cam[1] += clamp(wantY - P.cam[1], -sp, sp);
    try { H.setView(Math.round(P.cam[0]), Math.round(P.cam[1])); } catch (e) { /* the view stays */ }
  }
  // what the frame draws: the shake's offset (trauma squared along smooth noise, a kick along the last blow), the punch's zoom and its
  // focus (the local knight), the impact frame's veil
  function frameFx(t) {
    const F = (A().feel || {}).shake || {}, fight = H.getFight();
    let dx = 0, dy = 0;
    if (P.trauma > 0 && !H.reduce) {
      const s = P.trauma * P.trauma * (F.max || 4);
      dx = Math.round(s * Math.sin(t * 37.1) * Math.cos(t * 13.7)); dy = Math.round(s * Math.sin(t * 29.3 + 1.7) * Math.cos(t * 17.9));
      P.trauma = Math.max(0, P.trauma - ((F.trauma || {}).decay || 1.2) * H.STEP);
    }
    let z = 1;
    if (P.punch && P.punch.dur > 0) { const q = P.punch; q.t += H.STEP; const u = q.t / q.dur; z = u < 1 ? q.z : u < 1 + (q.ease || 0.4) / q.dur ? 1 + (q.z - 1) * (1 - (u - 1) * q.dur / (q.ease || 0.4)) : 1; if (z === 1 && u >= 1) P.punch = { z: 1, t: 0, dur: 0, from: 1 }; }
    const veilOn = P.veil > 0; if (veilOn) P.veil--;
    const k = fight && fight.k;
    return { dx, dy, zoom: z, focus: k ? [k.x, k.y - 12] : null, veil: veilOn ? ((A().feel || {}).impactFrame || {}).veil || 0.12 : 0 };
  }
  // the names and the bars over every other knight (the local knight has the plates), their statuses, the stagger's reel
  function drawOver(ctx, win, t) {
    const fight = H.getFight(), v = P.lastView; if (!fight || P.lobby) return;
    const me = fight.k, own = me.team;
    const list = v && v.knights ? v.knights : fight.knights.map(k => ({ seat: k.seat, team: k.team, name: k.name, hp: k.hp, hpMax: k.hpMax, poise: k.poise, poiseMax: k.poiseMax, x: k.x, y: k.y, out: k.out, house: k.house }));
    for (const kv of list) {
      const k = fight.knights[kv.seat]; if (!k || k === me || kv.out) continue;
      const x = Math.round(kv.x !== undefined ? kv.x : k.x), y = Math.round((kv.y !== undefined ? kv.y : k.y) - (k.z || 0));
      const ally = kv.team === own, col = ally ? "#f6757a" : "#2ce8f5";
      // (design pass 39) a beaten knight: its name dimmed over the body it has become, no bars
      if (kv.beaten || k.beaten) { const name = String(kv.name || "").toUpperCase(); if (name && !(k.beaten && fallFrame(k).gone)) H.text(ctx, name, x - Math.round(H.textWidth(name) / 2), y - 20, "#8b9bb4"); continue; }
      const name = String(kv.name || "").toUpperCase(); if (name) H.text(ctx, name, x - Math.round(H.textWidth(name) / 2), y - 46, col);
      const hpq = clamp((kv.hp || 0) / (kv.hpMax || 100), 0, 1), pq = kv.poiseMax ? clamp((kv.poise || 0) / kv.poiseMax, 0, 1) : 0;
      ctx.fillStyle = "#181425"; ctx.fillRect(x - 9, y - 39, 18, 5);
      ctx.fillStyle = "#3e2731"; ctx.fillRect(x - 8, y - 38, 16, 2); ctx.fillStyle = "#e43b44"; ctx.fillRect(x - 8, y - 38, Math.round(16 * hpq), 2);
      ctx.fillStyle = "#262b44"; ctx.fillRect(x - 8, y - 36, 16, 1); if (kv.staggered > 0) { if (Math.floor(t * 12) & 1) { ctx.fillStyle = "#fee761"; for (let i = 0; i < 4; i++) ctx.fillRect(x - 8 + i * 5, y - 37 - (i % 2), 2, 1); } } else { ctx.fillStyle = "#feae34"; ctx.fillRect(x - 8, y - 36, Math.round(16 * pq), 1); }
      if (H.drawStatuses && k.st) { try { H.drawStatuses(k, t, ctx); } catch (e) { /* no statuses */ } }
    }
    if (P.waiting) { const s = (W().sand || {}).slows || "The sand slows…"; H.text(ctx, s.toUpperCase(), Math.round(win.x0 + win.w / 2 - H.textWidth(s.toUpperCase()) / 2), win.y0 + 100, "#fee761"); }
  }

  // ------------------------------------------------------------------ the HUD each frame: the round plate, the poise bar, the foe's plate, Guard
  const hud = { key: "", round: "", foe: "", poise: -1, guard: null, parry: null, foeHp: -1, foePoise: -1 };
  function syncLive() {
    if (P.lobby) return;
    const fight = H.getFight(), v = P.lastView || (H.Duel.view ? H.Duel.view(fight) : null); if (!fight || !v) return;
    const S = W().sand || {}, me = v.knights ? v.knights.find(q => q.seat === fight.k.seat) : null;
    // the round plate: ROUND n · m:ss · a–b, SUDDEN DEATH while it lasts, the walk-in's names before the first round
    const rp = $("roundPlate");
    if (rp) {
      const text = P.drill && DR() ? (v.phase === "walkIn" ? bannerNames(fight) : DR().line()) : v.phase === "walkIn" ? bannerNames(fight) : (v.sudden ? (S.sudden || "SUDDEN DEATH") : fill(S.round || "ROUND {n}", { n: v.round || 1 })) + " · " + mmss(v.clock || 0) + " · " + (v.score ? v.score[0] + "–" + v.score[1] : "0–0");   // (design pass 39: the Drill's step on the plate)
      if (text !== hud.round) { hud.round = text; const b = rp.querySelector("b"); if (b) b.textContent = text; else rp.textContent = text; rp.setAttribute("aria-label", text); }
    }
    // the poise bar under the health plate: gold on a dark track, pale while it regrows, empty and blinking while staggered
    const pb = $("poiseBar");
    if (pb && me) {
      const q = me.poiseMax ? clamp(me.poise / me.poiseMax, 0, 1) : 0, stag = me.staggered > 0, key = Math.round(q * 52) + "|" + (stag ? 1 : 0) + "|" + ((Math.floor(H.state.t * 8) & 1) && stag ? 1 : 0);
      if (key !== hud.poise) {
        hud.poise = key;
        const g = pb.getContext("2d"); g.clearRect(0, 0, 54, 4); g.fillStyle = "#181425"; g.fillRect(0, 0, 54, 4); g.fillStyle = "#262b44"; g.fillRect(1, 1, 52, 2);
        if (stag) { if (Math.floor(H.state.t * 8) & 1) { g.fillStyle = "#fee761"; for (let i = 0; i < 6; i++) g.fillRect(2 + i * 9, 1 + (i % 2), 3, 1); } }
        else { g.fillStyle = q < 0.3 ? "#f77622" : "#feae34"; g.fillRect(1, 1, Math.round(52 * q), 2); if (q > 0) { g.fillStyle = q < 0.3 ? "#feae34" : "#fee761"; g.fillRect(1, 1, Math.round(52 * q), 1); } }
      }
      const pp = $("poisePlate"); if (pp) pp.classList.toggle("broken", stag);
    }
    // the foe's plate (a duel): its name, its red bar, its poise hairline
    const fp = $("foePlate");
    if (fp && !fp.hidden && v.knights) {
      const foe = v.knights.find(q => q.team !== (me ? me.team : 0));
      if (foe) {
        const name = String(foe.name || "").toUpperCase() + (foe.house ? "" : ""); if (name !== hud.foe) { hud.foe = name; const b = fp.querySelector("b"); if (b) b.textContent = name; }
        const hq = clamp((foe.hp || 0) / (foe.hpMax || 100), 0, 1), pq = foe.poiseMax ? clamp(foe.poise / foe.poiseMax, 0, 1) : 0, stag = foe.staggered > 0;
        const key = Math.round(hq * 54) + "|" + Math.round(pq * 54) + "|" + (stag ? (Math.floor(H.state.t * 8) & 1) : 2);
        if (key !== hud.foeHp) {
          hud.foeHp = key;
          const g = $("foeBar") && $("foeBar").getContext("2d");
          if (g) { g.clearRect(0, 0, 56, 9); g.fillStyle = "#181425"; g.fillRect(0, 0, 56, 9); for (let x = 0; x < 54; x++) for (let y = 1; y <= 4; y++) { g.fillStyle = x < Math.round(54 * hq) ? (y === 1 ? "#f6757a" : y === 4 ? "#a22633" : "#e43b44") : "#3e2731"; g.fillRect(x + 1, y, 1, 1); }
            g.fillStyle = "#262b44"; g.fillRect(1, 6, 54, 2); if (stag) { if (Math.floor(H.state.t * 8) & 1) { g.fillStyle = "#fee761"; for (let i = 0; i < 6; i++) g.fillRect(2 + i * 9, 6 + (i % 2), 3, 1); } } else { g.fillStyle = "#feae34"; g.fillRect(1, 6, Math.round(54 * pq), 2); } }
          const n = $("foeNum"); if (n) n.textContent = foe.beaten ? (S.beatenPlate || "BEATEN") : String(Math.max(0, Math.ceil((foe.hp || 0) - 1e-9)));   // (design pass 39)
        }
      }
    }
    // the Guard button: lit while held, a gold rim during its parry window
    const gb = $("guardBtn");
    if (gb && me) {
      const held = !!me.guard, win = (me.parryWin || 0) > 0;
      if (held !== hud.guard) { hud.guard = held; gb.classList.toggle("on", held); }
      if (win !== hud.parry) { hud.parry = win; gb.classList.toggle("parry", win); }
    }
  }

  // ------------------------------------------------------------------ the end: the record, the XP home, the tally
  function ended(result) {
    P.ended = true; P.result = result;
    if (P.drill) {   // (design pass 39) the Drill's end: nothing counted, nothing paid; the record says done (the KO's), the tally says what was learned
      if (DR()) { try { DR().finish(); } catch (e) { /* done either way */ } }
      const S = W().sand || {}; banner(DW().tally || S.yours || "THE SAND IS YOURS", null, false); kick(0.5);
      const slow = ((A().bout || {}).slow || {}).last || [0.25, 1.0]; P.tallyAt = H.state.t + (slow[1] || 1.0) + 1.2; return;
    }
    const fight = H.getFight(), win = result.winner === fight.k.team, rec = P.record || (P.record = readRecord());
    const r = rec.modes[P.mode] || (rec.modes[P.mode] = [0, 0]);
    if (result.winner === 0 || result.winner === 1) { if (win) r[0]++; else r[1]++; rec.streak = win ? (rec.streak || 0) + 1 : 0; }
    const house = result.house !== undefined ? !!result.house : P.house;
    let xp = 0;
    if (result.winner === 0 || result.winner === 1) {
      const X = A().xp || {};
      if (house) { if (win) { if (rec.house.day !== today()) rec.house = { day: today(), wins: 0 }; if (rec.house.wins < ((X.house || {}).perDay || 10)) { xp = (X.house || {}).win || 5; rec.house.wins++; } } }
      else xp = win ? ((X.win || {})[P.mode] || 0) : Math.round(((X.win || {})[P.mode] || 0) * (X.lossShare || 0.25));
    }
    writeRecord(rec);
    if (xp > 0 && H.runHome) { const run = { id: "arena-" + P.seed + "-" + Date.now(), area: "arena", level: 0, boss: false, replay: false, cleared: false, things: [], finds: {}, arena: { mode: P.mode, win, house, xp } }; P.xpSent = H.runHome(run); }
    try { if (P.session && P.session.result) P.session.result(result); } catch (e) { /* the wire has it or not */ }
    const S = W().sand || {};
    banner(win ? (S.yours || "THE SAND IS YOURS") : (S.theirs || "THE SAND IS THEIRS"), null, false);
    kick(0.5); punch("ko");
    const slow = ((A().bout || {}).slow || {}).last || [0.25, 1.0];
    P.tallyAt = H.state.t + (slow[1] || 1.0) + 1.2;
  }
  function tallyDue() { if (P.ended && P.tallyAt && H.state.t >= P.tallyAt && H.state.plank !== "tally") { P.tallyAt = 0; renderTally(); H.openPlank("tally"); } }
  function renderTally() {
    const T = W().tally || {}, fight = H.getFight(), res = P.result || {}, win = res.winner === fight.k.team, mine = (res.byseat || []).find(b => b.seat === fight.k.seat) || {};
    const put = (id, text, hide) => { const e = $(id); if (!e) return; e.hidden = !!hide; if (!hide) e.textContent = text; };
    if (P.drill) {   // (design pass 39) the Drill's tally
      put("tallyTitle", DW().tally || "YOU KNOW THE SAND"); put("tallyTime", DW().tallyLine || ""); put("tallyFelled", fill(T.blows || "{landed} blows landed, {taken} taken", { landed: mine.landed | 0, taken: mine.taken | 0 }) + (mine.parries ? " · " + fill(T.parries || "{n} parries", { n: mine.parries }) : ""));
      put("tallyWith", DW().against || "Mara of the house, the Drill"); put("tallyFindsLine", "", true); const f = $("tallyFinds"); if (f) { f.hidden = true; f.replaceChildren(); } put("tallyPay", "", true); put("tallyLevel", "", true);
      const tf = $("tallyForge"); if (tf) tf.textContent = T.gate || "The Gate"; const tn = $("tallyNext"); if (tn) tn.hidden = true; const ta = $("tallyAgain"); if (ta) { ta.textContent = DW().again || "The Drill again"; ta.hidden = false; }
      return;
    }
    put("tallyTitle", P.forfeited ? (T.forfeited || "DEFEAT · forfeited") : res.winner === null || res.winner === undefined ? (T.void || "VOID") : win ? (T.win || "VICTORY") : (T.loss || "DEFEAT"));
    put("tallyTime", fill(T.rounds || "{a}–{b} in rounds", { a: res.score ? res.score[0] : 0, b: res.score ? res.score[1] : 0 }) + (P.mode ? " · " + P.mode : ""));
    put("tallyFelled", fill(T.blows || "{landed} blows landed, {taken} taken", { landed: mine.landed | 0, taken: mine.taken | 0 }) + (mine.biggest ? " · " + fill(T.biggest || "Biggest blow {n}", { n: Math.round(mine.biggest) }) : "") + (mine.parries ? " · " + fill(T.parries || "{n} parries", { n: mine.parries }) : ""));
    put("tallyWith", (res.house ? (T.house || "Against the house's knights") : "") + (P.record && P.record.streak >= 2 && win ? (res.house ? " · " : "") + fill(T.streak || "{n} in a row", { n: P.record.streak }) : ""), !(res.house || (P.record && P.record.streak >= 2 && win)));
    put("tallyFindsLine", "", true); const f = $("tallyFinds"); if (f) { f.hidden = true; f.replaceChildren(); }
    const xp = P.xpSent && P.xpSent.run && P.xpSent.run.arena ? P.xpSent.run.arena.xp : 0;
    put("tallyPay", xp > 0 ? fill(T.xp || "+{n} XP", { n: xp }) + (P.xpSent && P.xpSent.ok === false ? " (waits for the Forge)" : "") : (H.visiting ? "You came without the Forge, so nothing is paid." : "No XP this time."));
    put("tallyLevel", "", true);
    const tf = $("tallyForge"); if (tf) tf.textContent = T.gate || "The Gate";
    const tn = $("tallyNext"); if (tn) tn.hidden = true;
    const ta = $("tallyAgain"); if (ta) { ta.textContent = T.again || "Again"; ta.hidden = false; }
  }
  // Again: the same mode (online: the queue again; offline: the same seats with a new seed); The Gate: back to the lobby
  function again() {
    if (!P.ended) return;
    const online = P.online, drill = P.drill;
    endSession();
    H.closePlankForce();
    if (drill) { startBout({ online: false, mode: (A().drill || {}).mode || "1v1", drill: true }); return; }
    if (online) { showLobby(); start(P.mode); return; }
    startBout({ online: false, mode: P.mode });
  }
  function gate() { if (DR() && DR().active) DR().end(); endSession(); H.closePlankForce(); showLobby(); H.syncHud(); H.fit(); }
  // (design pass 39) the Drill ends: its KO (done) takes the tally's road; Skip goes straight back to the Gate
  function onDrillEnd(why) { if (why === "skipped") { endSession(); H.closePlankForce(); showLobby(); H.syncHud(); H.fit(); } }
  function endSession() { try { if (P.session && P.session.close) P.session.close(); } catch (e) { /* closed */ } P.session = null; P.ended = true; }
  function onForfeit(seat) {
    const fight = H.getFight(); if (!fight) return;
    const S = W().sand || {}, k = fight.knights[seat];
    if (k) H.toast(fill(S.forfeit || "{name} forfeited", { name: k.name || "A knight" }));
    try { if (H.Duel.forfeit) H.Duel.forfeit(fight, seat); } catch (e) { /* the rules have no forfeit */ }
  }
  function onVoid() { const S = W().sand || {}; H.toast(S.shifted || "The sand shifted. The bout is void."); if (!P.ended) { P.ended = true; P.result = { winner: null, score: [0, 0], byseat: [], house: P.house, mode: P.mode, void: true }; P.tallyAt = H.state.t + 0.5; } }
  function onWireEnd(r) { /* the Bout's settled result (the boards are off: nothing to read back) */ }
  // leaving the page mid-bout is a forfeit (the ask plank says so); from the lobby it is a plain leave
  function onLeave() {
    if (P.lobby || !P.session) return;
    if (P.drill) { if (DR()) DR().end(); endSession(); return; }   // (design pass 39) leaving the Drill forfeits nothing
    P.forfeited = !P.ended;
    try { if (P.session.forfeit) P.session.forfeit(); } catch (e) { /* the wire's forfeit by silence */ }
    if (!P.ended) { const rec = P.record || (P.record = readRecord()); const r = rec.modes[P.mode] || (rec.modes[P.mode] = [0, 0]); r[1]++; rec.streak = 0; writeRecord(rec); }
    endSession();
  }
  function askText() { const S = W().sand || {}; if (P.drill) return { title: DW().leave || "Leave the Drill?", go: DW().leaveGo || "Leave", stay: S.stay || "Stay" }; return { title: S.leave || "Leave the sand? You forfeit the bout.", go: S.go || "Forfeit", stay: S.stay || "Stay" }; }

  // ------------------------------------------------------------------ mount: the page hands its hooks; the lobby shows
  function mount(hooks) {
    H = hooks;
    P.record = readRecord();
    P.skill = skillDefault();
    try { if (H.DMath && H.DMath.install) H.DMath.install(); } catch (e) { /* the sim stays on Math: a duel offline needs no agreement */ }
    if (DR() && DR().mount) { try { DR().mount({ $: H.$, root: H.$("game"), store: H.store, state: H.state, reduce: H.reduce, coarse: H.coarse, params: H.params, Combat: H.Combat, getFight: H.getFight, onEnd: onDrillEnd }); } catch (e) { (root.__errors || []).push("drill mount: " + (e && e.message)); } }   // (design pass 39)
    showLobby();
    // the harness and the pictures: ?bout=1v1 starts a bout against the house at boot (&skill=champion); with ?harness=1, &run=<ms> then moves
    // time on that far through the page's own step, so a picture of the sand can be taken by a headless browser
    const bout = H.params && H.params.get("bout");
    if (bout && (A().modes || {})[bout]) { if (H.params.get("skill")) P.skill = H.params.get("skill"); startBout({ online: false, mode: bout, drill: H.params.get("drill") === "1" }); const run = +(H.params.get("run") || 0); if (run > 0 && H.harness && root.TheBattlegrounds && root.TheBattlegrounds.step) root.setTimeout(() => { try { root.TheBattlegrounds.step(run); } catch (e) { /* the picture is of the start */ } }, 0); }
    return api;
  }
  const api = { mount, step, drawOver, frameFx, syncLive, tallyDue, again, gate, onLeave, askText, renderTally, start, startBout, showLobby, fallFrame, drawFallen,
    get lobby() { return P.lobby; }, get inBout() { return !P.lobby && !!P.session; }, get ended() { return P.ended; }, get state() { return P; }, get heat() { return P.heat; }, get mode() { return P.mode; }, get drill() { return P.drill; } };
  root.ArenaPage = api;
})(typeof window !== "undefined" ? window : globalThis);
