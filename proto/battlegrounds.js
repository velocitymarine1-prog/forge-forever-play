// FORGE FOREVER: The Battlegrounds screen (design pass 7, revised by card t64; built by card t65). The first area is the Training
// Cellar: a small room under the smithy where the smith walks a knight among training dummies and tries the weapons they forged.
// Landscape, two thumbs: a floating stick on the left, Strike, Swap and Dodge on the right, and above Strike a legend's gold ability
// button (design pass 10: a legend strikes with its body's form, and its head's class gives it one of twenty abilities); aim is automatic.
//
// This file is the screen and nothing else. The rules are proto/combat.js (pure: the fight's state and its events); the room, the
// dummies and the font are proto/cellar.js; the knight is proto/knight.js; the weapon in the hand is proto/pixel-forge.js. The screen
// owns the clock (a fixed step of 1/60 s, at most 5 a frame), the hold on a hit and the shake, every particle, the numbers, the HUD,
// the planks, the orientation, and the handoff with the Forge (localStorage: forge-forever:to-cellar comes down with the loadout and
// every owned weapon as a whole record; forge-forever:from-cellar goes back up with the loadout, on every change of hand).
//
// Since design pass 12 (build 7) the same page plays a level: ?area=gate boots the Troll Gate (spec/gate.js, drawn by proto/gate.js, its
// trolls by proto/trolls.js). A level's area is larger than the stage: the VIEW (384 x 216, the cellar's size) is the stage and the fit's
// measure, the ground comes from the level's baked column tiles and decal canvases drawn before the camera's translate, and everything
// else is drawn in world coordinates after it; the camera is the fight's own (fight.view, stepped by the rules), read by cam().
// ?perf=stress builds the worst case for the frame (done criterion 17) and shows a step and frame-time readout; ?perf=1 shows the readout.
// The level's HUD is the cellar's, exactly (section 3.14): the note shows one timed line at a time by priority, the prompt over the knight
// says what E or a tap does (the exit, a lift, the chest, the ram), the toast says what was picked up, and the planks a level needs (the
// gate plate, Leave the gate?, the tally, The gate is shut) are built from the cellar's frames. The way in is the door on the cellar's
// left wall (its zone opens the gate plate, which fades to ?area=gate&brothers=n); the way home is forge-forever:from-battle, written
// once with the satchel (ingredient ids only) and the run's finds at the clear, or banked without pay on a quit (section 3.11.5).
// Since design pass 18 (build 10) the level tells the player what to do without words: a health plate top left (the knight's 100 HP,
// a blow's pale chip, green while it grows back, a blink when low), the trolls left top right (or the gate's share), the guide drawn by
// the painter from Level.guide (yellow arrows over the ram, the gate, the chest, the way in and a fallen friend, their chevrons at the
// edge, GO at the right edge between the waves), health bars over what was hit, Dodge glowing while the knight burns.
//
// For the harness (tools/battle-harness.html): ?harness=1 lets time move only through TheBattlegrounds.step(ms); ?seed=n fixes the
// fight; ?weapons=a,b picks the loadout; ?pointer=coarse|fine overrides the pointer; ?fresh=1 shows the first-visit plank again and
// ?seen=1 skips it; ?motion=reduce stills the room; ?stay=1 leaves without going anywhere; ?brothers=n brings sword-brothers and
// ?party=n fills bench seats (as the Forge's bench.party does); ?badspec=1 plays a level whose spec can't be read, ?badspec=2 one whose
// spec throws while the page reads it (a boot error, which shows the shut plank too).
(function () {
  "use strict";
  const PF = window.PixelForge, C = window.Cellar, Combat = window.Combat, SPEC = window.FORGE_COMBAT, Smithy = window.Smithy, Gate = window.Gate, Trolls = window.Trolls, Knight = window.Knight;
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  // the area: the cellar, or a level the query names (the Troll Gate's spec and painter must be loaded for it; a level that can't be read
  // shows "The gate is shut", never a blank stage: section 3.15)
  const wantLevel = params.get("area") === "gate";
  // a level that throws while the page comes up (a spec past its checks that the page still cannot read) shows the shut plank as well:
  // until the page says it has booted, an uncaught error opens the shut veil, lifts the fade and makes ↑ Forge go up plainly
  if (wantLevel) window.addEventListener("error", function bootShut() {
    if (document.body.getAttribute("data-booted") === "1") return;
    try {
      const up = () => { window.location.href = document.body.getAttribute("data-forge") || "the-forge.html"; };
      for (const id of ["shutForge", "upBtn", "homeBtn", "tForge", "tHome"]) { const b = $(id); if (b) b.addEventListener("click", up); }
      $("shutVeil").hidden = false; $("fade").classList.remove("on");
      if (!window.TheBattlegrounds) window.TheBattlegrounds = { state: { booted: true, shut: true, left: false }, AREA: null, LEVEL: false, shut: true, bootError: true, toasts: [], fit() {}, get paused() { return true; }, step() { return 0; } };
      document.body.setAttribute("data-booted", "1");
    } catch (e) { /* the plank could not be shown either */ }
  });
  const levelOk = a => !!(a && a.level && a.w > 0 && a.h > 0 && a.view && a.knight && a.zones && a.sections && a.arenas && a.waves && window.FORGE_TROLLS && Gate && Trolls);
  const badSpec = params.get("badspec");
  const AREA = wantLevel && badSpec !== "1" && levelOk(window.FORGE_GATE) ? (badSpec === "2" ? new Proxy(window.FORGE_GATE, { get(t, k) { if (k === "knight") throw new Error("the spec could not be read"); return t[k]; } }) : window.FORGE_GATE) : window.FORGE_CELLAR;   // (badspec=2: the spec passes its checks and throws at the page's first read of its knight block, before the fight is built)
  const LEVEL = !!AREA.level, SHUT = wantLevel && !LEVEL;
  const media = q => !!(window.matchMedia && window.matchMedia(q).matches);
  // less motion: the phone's setting, the game's own switch (forge-forever:less-motion, design pass 9) or ?motion=reduce
  const reduce = window.Settings ? Settings.reduce() : (params.get("motion") ? params.get("motion") === "reduce" : media("(prefers-reduced-motion: reduce)"));
  const harness = params.get("harness") === "1", stay = params.get("stay") === "1";
  const coarse = params.get("pointer") ? params.get("pointer") === "coarse" : media("(pointer: coarse)");
  // the view is the stage: the area's own size in the cellar, 384 x 216 over a larger level (design pass 12, section 3.2)
  const VIEW = AREA.view || { w: AREA.w, h: AREA.h };
  const STEP = SPEC.step, W = VIEW.w, H = VIEW.h, OUT = C.OUT, TAU = Math.PI * 2, FEEL = SPEC.feel, CHEST = SPEC.knight.chest;
  const perf = params.get("perf");
  const KEYS = { to: "forge-forever:to-cellar", from: "forge-forever:from-cellar", seen: "forge-forever:cellar-seen", forced: "forge-forever:forced-landscape", lefty: "forge-forever:left-handed",
    // design pass 12: a level's run home, the level's first visit, the gate plate's last choice, the first-time lines seen, the satchel (sessionStorage)
    battle: "forge-forever:from-battle", gateSeen: "forge-forever:gate-seen", brothers: "forge-forever:gate-brothers", firsts: "forge-forever:gate-firsts", satchel: "forge-forever:satchel" };
  // storage is a convenience: the cellar works without it, and nothing is remembered (?nostore=1 plays as if it were blocked)
  const nostore = params.get("nostore") === "1";
  const store = {
    get(k) { try { return nostore ? null : window.localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { if (nostore) return false; window.localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del(k) { try { if (!nostore) window.localStorage.removeItem(k); } catch (e) { /* nothing to forget */ } }
  };
  // the satchel lives in sessionStorage between a reload and the way home (section 3.11.2); blocked, it lives in memory
  const session = {
    get(k) { try { return nostore ? null : window.sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { if (nostore) return false; window.sessionStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del(k) { try { if (!nostore) window.sessionStorage.removeItem(k); } catch (e) { /* nothing to forget */ } }
  };
  const nowIso = () => new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  // the cellar's lessons (design pass 16 section 3.5, build 8): proto/cellar-lessons.js (window.CellarLessons, loaded before this file)
  // drives them through window.TheBattlegrounds; lessonOn(name, ...) calls one of its hooks when it is loaded, and nothing without it
  function lessonOn(name, ...args) {
    const CL = window.CellarLessons;
    if (!CL || typeof CL[name] !== "function") return undefined;
    try { return CL[name](...args); } catch (e) { (window.__errors || []).push("cellar-lessons: " + (e && e.message || e)); return undefined; }
  }
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  Smithy.installFrames();
  try { for (const cv of document.querySelectorAll("canvas[data-glyph]")) Smithy.glyph(cv, cv.getAttribute("data-glyph"), 1); } catch (e) { /* the plates stand without their glyphs */ }
  if (window.Nav) Nav.arrive("cellar");
  if (harness || reduce) document.documentElement.classList.add("still");

  // ------------------------------------------------------------------ the weapons: what came down from the Forge, or a visit
  const world = new Map();   // id -> the weapon's whole record; the rack holds them all
  let rack = [];             // ids in the rack's order: the loadout first, then newest first
  function readHandoff() {
    const raw = store.get(KEYS.to);
    if (!raw) return null;
    let d = null;
    try { d = JSON.parse(raw); } catch (e) { return null; }   // a bad key is ignored, never thrown on
    if (!d || d.v !== 1 || !d.weapons || typeof d.weapons !== "object" || !Array.isArray(d.loadout)) return null;
    if (params.get("world") && d.world !== params.get("world")) return null;   // a handoff for another world
    return d;
  }
  const isWeapon = t => !!(t && t.kind === "weapon" && t.weapon && typeof t.weapon === "object");
  const handoff = readHandoff();
  if (handoff) {
    const order = Array.isArray(handoff.order) ? handoff.order : Object.keys(handoff.weapons);
    for (const id of order) { const t = handoff.weapons[id]; if (isWeapon(t) && !world.has(id)) { t.id = t.id || id; world.set(id, t); rack.push(id); } }
    // a handoff over the storage quota carries the loadout's records only: the rack then holds the loadout and the class weapons
    // (those of a class the smith hasn't opened as practice only)
    if (handoff.trimmed && rack.length) { const open = (handoff.smith && handoff.smith.classes) || [];
      for (const t of window.FORGE_THINGS) if (isWeapon(t) && !world.has(t.id)) { const c = Object.assign({}, t); if (!open.includes(t.weapon.visual.base)) c.practice = true; world.set(c.id, c); rack.push(c.id); } }
  }
  const visiting = !handoff || !rack.length;
  if (visiting) {
    // visiting: the twenty class weapons and every weapon in the seed ledger
    world.clear(); rack = [];
    for (const t of window.FORGE_THINGS) if (isWeapon(t)) { world.set(t.id, t); rack.push(t.id); }
    const rows = ((window.FORGE_LEDGER || {}).rows || []).filter(r => isWeapon(r.thing)).sort((a, b) => String(b.at).localeCompare(String(a.at)));
    for (const r of rows) if (!world.has(r.thing.id)) { world.set(r.thing.id, r.thing); rack.push(r.thing.id); }
  }
  const practice = t => !!(t && t.practice);
  function readBack() {
    const raw = store.get(KEYS.from); if (!raw) return null;
    let d = null; try { d = JSON.parse(raw); } catch (e) { return null; }
    return d && d.v === 1 && Array.isArray(d.loadout) ? d : null;
  }
  const classOf = t => { const v = (t.weapon || {}).visual || {}; return v.fuse && v.fuse !== v.base ? "legendary" : (v.base || "sword"); };
  // the weapon plate's line: the form, the element, the statuses and the modifiers (a legend's second form is no longer played, so it
  // is no longer said: design pass 10)
  function sentence(t) { const w = t.weapon; return [w.form, w.element !== "physical" ? w.element : null].concat(w.status || [], w.modifiers || []).filter(Boolean).join(" · ").replace(/_/g, " ").toUpperCase(); }

  // the hands (what the knight holds now, practice weapons included) and the loadout (what goes back up)
  const state = { visiting, handoff: visiting ? null : handoff, loadout: [], empty: false, slow: false, reach: false, lefty: store.get(KEYS.lefty) === "1", forced: store.get(KEYS.forced) === "1",
    t: 0, arrive: reduce ? 0 : (AREA.knight.arrive || 0), lit: reduce || !AREA.light ? 3 : 0, hold: 0, shake: { t: 0, amp: 0 }, fx: [], nums: [], parts: [], rings: [], sums: {}, heal: { n: 0, at: 0 }, trail: [],
    plank: null, turned: false, left: false, leftTo: null, went: null, tookBack: false, stairs: 0, zone: null, booted: false, layout: { x: 0, y: 0, s: 1, k: 1, w: W, h: H, pl: 0, pt: 0 }, frames: 0, log: [],
    done: false, shut: false, askTo: null, brothers: 0, lv: null,   // a level: the run is over (the tally shows), the gate is shut, where leaving asks to go
    legendNoted: false, noteUntil: 0, noteText: "",   // the first legend of the visit: a note under the plate for 3 s (design pass 10)
    perf: perf ? { steps: [], frames: [], last: 0, hitches: 0, batchT: 0, batchN: 0 } : null, stress: null };
  function firstHands() {
    let ids = [], active = 0;
    const asked = (params.get("weapons") || "").split(",").map(s => s.trim()).filter(id => world.has(id));
    if (asked.length) ids = asked.slice(0, 2);
    else if (visiting) ids = AREA.visiting.loadout.filter(id => world.has(id));
    else {
      // the smith may have picked weapons at the rack, gone to the menu and come back down before the Forge took them: a from-cellar
      // for this world that is newer than the handoff is the loadout (design pass 9 section 3.5)
      let lo = handoff.loadout, act = handoff.active | 0;
      const back = readBack();
      if (back && back.world === handoff.world && Date.parse(back.at || 0) > Date.parse(handoff.at || 0)) { lo = back.loadout; act = back.active | 0; state.tookBack = true; }
      ids = lo.filter(id => world.has(id) && !practice(world.get(id))).slice(0, 2); active = clamp(act, 0, Math.max(0, ids.length - 1));
    }
    const hands = ids.map(id => world.get(id));
    // what each hand gives back to the loadout: the weapon it came down with, unless that is practice only
    const slots = ids.map(id => practice(world.get(id)) ? null : id);
    // Try it in the cellar on a chained weapon: it is held on arrival and never joins the loadout
    const tried = !asked.length && handoff && handoff.try && world.has(handoff.try) ? world.get(handoff.try) : null;
    if (tried && !ids.includes(tried.id)) { if (hands.length < 2) { hands.push(tried); slots.push(null); active = hands.length - 1; } else hands[active] = tried; }
    if (!hands.length) {   // an empty loadout: the knight holds the class Sword
      const sword = world.get(AREA.empty) || window.FORGE_THINGS.find(t => t.id === AREA.empty);
      hands.push(sword); slots.push(null); state.empty = true;
      if (!world.has(sword.id)) { world.set(sword.id, sword); rack.unshift(sword.id); }
    }
    state.loadout = slots.filter(Boolean);
    return { hands, active, slots };
  }
  const first = firstHands();
  const seed = params.get("seed") ? (parseInt(params.get("seed"), 10) >>> 0) : ((Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0);
  // the seats of a level (design pass 12, section 3.10): the player first; then the bench's bots as full knights (?party=n, or bench.party
  // in the handoff from the Forge's Settings > Developer), then the sword-brothers (?brothers=n, chosen on the gate plate); four seats at
  // most. proto/bots.js (stage F) gives their seats and drives them; until it is loaded the brothers of section 3.10 stand still
  const BROTHERS = [{ name: "Edric", loadout: ["sword", "bow"] }, { name: "Osk", loadout: ["hammer", "sword"] }, { name: "Tam", loadout: ["spear", "bow"] }];
  const classThing = id => (window.FORGE_THINGS || []).find(t => t.id === id);
  const brotherSeats = (n, kind) => BROTHERS.slice(0, n).map(b => ({ kind, name: b.name, loadout: b.loadout.map(classThing).filter(isWeapon) }));
  const Bots = window.Bots || null;
  const brothersN = LEVEL ? clamp(parseInt(params.get("brothers"), 10) || (perf === "stress" ? 3 : 0), 0, 3) : 0;   // (the stress case brings three brothers)
  const benchParty = handoff && handoff.bench ? parseInt(handoff.bench.party, 10) : NaN;   // (a bench.party that is no number counts for nothing)
  const partyN = LEVEL ? clamp(parseInt(params.get("party"), 10) || (Number.isFinite(benchParty) ? benchParty : 0) || 1, 1, 4) : 1;
  function seats() {
    const out = [{ loadout: first.hands, kind: "player", name: handoff && handoff.smith ? handoff.smith.name : null }];
    const bench = Math.min(partyN - 1, 3), bros = Math.min(brothersN, 3 - bench);
    if (bench > 0) out.push(...(Bots && Bots.bench ? Bots.bench(bench) : brotherSeats(bench, "bench")));
    if (bros > 0) out.push(...(Bots && Bots.brothers ? Bots.brothers(bros) : brotherSeats(bros, "brother")));
    return out.slice(0, 4);
  }
  // a level's fight takes its knights in seat order; the cellar's takes the hands. A level whose world can't be built is shut (section 3.15)
  let fight = null, scene = null, shutBy = null;
  // the hand the thumbs are in (section 3.14): the rules read fight.hand for the thumbs' corner the archers avoid, the door rule's thumb
  // check and Level.edgeMarks' default; set with the fight and kept in step on every fit (a switch of hands in the menu refits)
  const syncHand = () => { if (fight && LEVEL) fight.hand = state.lefty ? "left" : "right"; };
  try {
    fight = LEVEL ? Combat.newFight(AREA, seats(), seed) : Combat.newFight(AREA, first.hands, seed);
    fight.k.active = first.active;
    // the director (design pass 12, proto/level.js: the camera, the waves, the doors, the engines, the castle front, the drops) is attached
    // by one call, never by newFight, and sets fight.brains itself; ?perf=stress builds its own scene (stress()) and keeps the camera where
    // that puts it, so it runs without one
    if (LEVEL && window.Level && perf !== "stress") Level.attach(fight);
    syncHand();
    scene = LEVEL ? new Gate.Scene(AREA) : new C.Scene(AREA);
  } catch (e) { if (!wantLevel) throw e; shutBy = e; }
  const shut = SHUT || !!shutBy;
  // the party's controller (stage F's Bots.party): it turns the player's input into every seat's; without it the other seats stand still
  const party = fight && LEVEL && fight.knights.length > 1 && Bots && Bots.party ? Bots.party(fight) : null;
  // the run's id, "<seed>-<seat>-<startedAt>" (section 3.11.5): the Forge pays or banks a run once by it
  const startedAt = Date.now(), runId = seed + "-0-" + startedAt;
  // the camera: the fight's own view (its origin in whole world pixels; the rules move it), (0, 0) in the cellar
  const cam = () => fight.view ? [fight.view.x0, fight.view.y0] : [0, 0];
  const stage = $("stage"), ctx = stage.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const game = $("game");
  // the screen's own random numbers (particles, the shake): drawing never touches the fight's
  const rnd = Combat.rng((seed ^ 0x9e3779b9) >>> 0);
  if (shut) {
    // the gate is shut (section 3.15: a bad gate.json or trolls.json): a parchment plank over the dark stage and ↑ Forge, never a blank stage
    if (window.console && shutBy) window.console.warn("Forge Forever: the Troll Gate could not be read: " + (shutBy.message || shutBy));
    fit();
    $("shutVeil").hidden = false; state.plank = "shut"; state.shut = true;
    const up = () => { if (state.left) return; state.left = true; $("fade").classList.add("on"); const url = document.body.getAttribute("data-forge") || "the-forge.html"; state.leftTo = url; state.went = window.Nav ? Nav.go("forge", url, { stay }) : { to: "forge", url, how: "push" }; if (!stay && !window.Nav) window.location.href = url; };
    $("shutForge").addEventListener("click", up); $("upBtn").addEventListener("click", up); $("homeBtn").addEventListener("click", up); $("tForge").addEventListener("click", up); $("tHome").addEventListener("click", up);
    window.TheBattlegrounds = { state, world, toasts: [], AREA, LEVEL: false, shut: true, fit, get paused() { return true; }, step() { return 0; } };
    state.booted = true;
    document.body.setAttribute("data-booted", "1");
    document.body.setAttribute("data-errors", String((window.__errors || []).length));
    $("fade").classList.remove("on");
    return;
  }

  // ------------------------------------------------------------------ going back up: the loadout, on every change of hand
  function writeBack() {
    if (!state.handoff) return false;   // visiting: there is no world to give it to
    const loadout = state.loadout.filter(id => world.has(id) && !practice(world.get(id))).slice(0, 2);
    const held = fight.hands[fight.k.active].thing.id, active = Math.max(0, loadout.indexOf(held));
    return store.set(KEYS.from, JSON.stringify({ v: 1, at: nowIso(), world: state.handoff.world, loadout, active }));
  }
  const forgeUrl = () => document.body.getAttribute("data-forge") || "the-forge.html";
  const menuUrl = () => document.body.getAttribute("data-menu") || "main-menu.html";
  // leave(to): up to the Forge (the stairs, ↑ Forge, Back to the Forge) or to the main menu (the house, Main menu). nav.js goes back
  // in history when that page is right behind, and forward otherwise (design pass 9 section 3.6)
  function leave(to) {
    if (state.left) return;
    to = to === "menu" ? "menu" : "forge";
    state.left = true;
    lessonOn("leave", to);   // (build 8) C7 ends on the way up
    if (LEVEL) sendHome(lv.done);   // a quit banks the satchel and pays nothing (section 3.11.5); after a clear the run has gone home already, and goes as a clear if it has not
    writeBack();
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { /* nothing was locked */ }
    try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); } catch (e) { /* not full screen */ }
    $("fade").classList.remove("wipe"); $("fade").classList.add("on");
    const go = () => {
      const url = to === "menu" ? menuUrl() : forgeUrl();
      state.leftTo = url;
      state.went = window.Nav ? Nav.go(to, url, { stay }) : { to, url, how: "push" };
      if (stay || window.Nav) return;
      window.location.href = url;
    };
    if (reduce || harness) go(); else setTimeout(go, 260);
  }
  // in a level, ↑ Forge, the house and the menu's two ways out ask first (section 3.8), unless the run is over (the tally shows)
  function askLeave(to) { if (state.left) return; if (!LEVEL || state.done) { leave(to); return; } state.askTo = to; openPlank("ask"); }
  // the way to the level (section 3.14): the gate plate's Go starts the fade as leave() does, writes from-cellar back as the cellar always
  // does, remembers the choice, and changes page to ?area=gate&brothers=n 260 ms later (the same page; the harness's own flags ride along)
  const levelUrl = n => (location.pathname.split("/").pop() || "the-battlegrounds.html") + "?area=gate&brothers=" + n + (harness ? "&harness=1&seen=1" : "") + (params.get("world") ? "&world=" + encodeURIComponent(params.get("world")) : "");
  function go(n) {
    if (state.left) return;
    n = clamp(n | 0, 0, 3);
    state.left = true; state.brothers = n;
    store.set(KEYS.brothers, String(n));
    writeBack();
    $("fade").classList.add("on");
    const url = levelUrl(n);
    const run = () => { state.leftTo = url; state.went = { to: "gate", url, how: "push" }; if (!stay) window.location.href = url; };
    if (reduce || harness) run(); else setTimeout(run, 260);
  }
  // Again, from the tally: the same level with the same brothers (a new seed); the run that just ended has gone home already
  function again() { if (state.left) return; state.left = true; $("fade").classList.add("on"); const url = levelUrl(brothersN); const run = () => { state.leftTo = url; state.went = { to: "gate", url, how: "push" }; if (!stay) window.location.href = url; }; if (reduce || harness) run(); else setTimeout(run, 260); }
  // restored from the back-forward cache: the handoff may be another one, so start again
  window.addEventListener("pageshow", e => { if (e.persisted) { state.left = false; window.location.reload(); } });
  window.addEventListener("pagehide", () => { if (!state.left) writeBack(); });

  // ------------------------------------------------------------------ the stage: a whole number of device pixels per world pixel
  function insets() { const cs = window.getComputedStyle($("probe")), n = v => parseFloat(v) || 0; return { t: n(cs.paddingTop), r: n(cs.paddingRight), b: n(cs.paddingBottom), l: n(cs.paddingLeft) }; }
  function viewport() { const vv = window.visualViewport; return { w: Math.round(vv ? vv.width : window.innerWidth), h: Math.round(vv ? vv.height : window.innerHeight) }; }
  function fit() {
    const v = viewport(), portrait = v.h > v.w, s = insets();
    state.portrait = portrait;
    state.turned = state.forced && portrait;   // forced landscape only turns a viewport that is upright
    let gw = v.w, gh = v.h, pl = s.l, pt = s.t, pr = s.r, pb = s.b;
    if (state.turned) {
      // the game is laid out at the viewport's height x width and turned 90 degrees clockwise; the player turns the phone anticlockwise
      gw = v.h; gh = v.w; pl = s.t; pt = s.r; pr = s.b; pb = s.l;
      game.style.width = gw + "px"; game.style.height = gh + "px"; game.style.transform = "translateX(" + v.w + "px) rotate(90deg)";
    } else { game.style.width = ""; game.style.height = ""; game.style.transform = ""; }
    game.classList.toggle("forced", state.turned);
    game.classList.toggle("lefty", state.lefty);
    syncHand();
    const availW = gw - pl - pr, availH = gh - pt - pb, dpr = window.devicePixelRatio || 1;
    const k = Math.max(1, Math.floor(Math.min(availW / W, availH / H) * dpr));
    const cw = W * k / dpr, ch = H * k / dpr;
    stage.style.width = cw + "px"; stage.style.height = ch + "px";
    state.layout = { x: pl + (availW - cw) / 2, y: pt + (availH - ch) / 2, s: k / dpr, k, w: cw, h: ch, pl, pt, pr, pb, gw, gh, vw: v.w, vh: v.h, dpr };
    // a phone held upright gets the turn plate, and the game waits
    const plate = portrait && coarse && !state.forced;
    $("turnPlate").hidden = !plate;
    state.plate = plate;
    const canFull = !!(document.documentElement.requestFullscreen && screen.orientation && screen.orientation.lock);
    $("tFull").hidden = !canFull;
    $("mForced").hidden = !state.forced;
    lessonOn("fit");
    return state.layout;
  }
  function lockLandscape() { try { const o = screen.orientation; if (o && o.lock) { const p = o.lock("landscape"); if (p && p.catch) p.catch(() => {}); } } catch (e) { /* this browser doesn't lock */ } }
  // a point of the viewport in the game's own space (turned back when the game is turned)
  const toGame = (cx, cy) => state.turned ? [cy, state.layout.vw - cx] : [cx, cy];
  const paused = () => !!(state.plank || state.plate || document.hidden || state.left);

  // ------------------------------------------------------------------ input: the stick, the buttons, the keyboard
  const input = { stick: null, sx: 0, sy: 0, strike: false, swap: false, dodge: false, ability: false, use: false, keys: {}, test: null };
  const R = 44, DEAD = 0.12;
  function stickTo(gx, gy) {
    const dx = gx - input.stick.cx, dy = gy - input.stick.cy, d = Math.hypot(dx, dy), m = Math.min(1, d / R);
    if (m < DEAD) { input.sx = 0; input.sy = 0; } else { input.sx = dx / d * m; input.sy = dy / d * m; }
    const kx = d > R ? dx / d * R : dx, ky = d > R ? dy / d * R : dy;
    $("knob").style.transform = "translate(" + kx.toFixed(1) + "px," + ky.toFixed(1) + "px)";
  }
  const zone = $("stickZone");
  zone.addEventListener("pointerdown", e => {
    if (input.stick || paused()) return;
    e.preventDefault();
    const [gx, gy] = toGame(e.clientX, e.clientY);
    input.stick = { id: e.pointerId, cx: gx, cy: gy };
    try { zone.setPointerCapture(e.pointerId); } catch (err) { /* a synthetic pointer */ }
    const st = $("stick"); st.classList.remove("rest"); st.style.left = (gx - state.layout.pl) + "px"; st.style.top = (gy - state.layout.pt) + "px";
    stickTo(gx, gy);
  });
  zone.addEventListener("pointermove", e => { if (!input.stick || input.stick.id !== e.pointerId) return; const [gx, gy] = toGame(e.clientX, e.clientY); stickTo(gx, gy); });
  function stickUp(e) {
    if (!input.stick || (e && input.stick.id !== e.pointerId)) return;
    input.stick = null; input.sx = 0; input.sy = 0;
    const st = $("stick"); st.classList.add("rest"); st.style.left = ""; st.style.top = ""; $("knob").style.transform = "";
  }
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) zone.addEventListener(ev, stickUp);
  function holdButton(el, down, up) {
    el.addEventListener("pointerdown", e => { e.preventDefault(); if (paused()) return; try { el.setPointerCapture(e.pointerId); } catch (err) { /* a synthetic pointer */ } down(); });
    for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) el.addEventListener(ev, () => { if (up) up(); if (document.activeElement === el) el.blur(); });
    el.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && !e.repeat) { e.preventDefault(); down(); } });
    el.addEventListener("keyup", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); up && up(); } });
  }
  holdButton($("strikeBtn"), () => { input.strike = true; }, () => { input.strike = false; });
  holdButton($("swapBtn"), () => { input.swap = true; });
  holdButton($("dodgeBtn"), () => { input.dodge = true; });
  // a legend's ability (design pass 10): the gold button above Strike, or U (above J, as the button is above Strike); pressed, it is brighter
  holdButton($("abilityBtn"), () => { input.ability = true; $("abilityBtn").classList.add("on"); }, () => { $("abilityBtn").classList.remove("on"); });
  const KEYMAP = { KeyW: "up", ArrowUp: "up", KeyS: "down", ArrowDown: "down", KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right", KeyJ: "strike", Space: "strike", KeyK: "swap", KeyL: "dodge", ShiftLeft: "dodge", ShiftRight: "dodge", KeyE: "use", KeyU: "ability", Escape: "menu" };
  window.addEventListener("keydown", e => {
    const what = KEYMAP[e.code];
    if (!what || e.metaKey || e.ctrlKey || e.altKey) return;
    if (what === "menu") { e.preventDefault(); if (state.plank) closePlank(); else openPlank("menu"); return; }
    if (paused() || (e.target && e.target.tagName === "BUTTON" && (e.code === "Space"))) return;
    e.preventDefault();
    if (e.repeat) return;
    if (what === "swap") input.swap = true; else if (what === "dodge") input.dodge = true; else if (what === "ability") input.ability = true; else if (what === "use") use(); else input.keys[what] = true;
  });
  window.addEventListener("keyup", e => { const what = KEYMAP[e.code]; if (what) input.keys[what] = false; });
  window.addEventListener("blur", () => { input.keys = {}; input.strike = false; stickUp(); });
  for (const ev of ["contextmenu", "gesturestart", "dblclick"]) game.addEventListener(ev, e => e.preventDefault());
  // what the thumbs say for this step
  function gather() {
    const K = input.keys, T = typeof input.test === "function" ? input.test(STEP) : input.test;   // (a driver, the harness's squire, answers once a step)
    let mx = input.sx, my = input.sy;
    if (!input.stick) { mx = (K.right ? 1 : 0) - (K.left ? 1 : 0); my = (K.down ? 1 : 0) - (K.up ? 1 : 0); const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; } }
    const inp = { move: [mx, my], strike: input.strike || !!K.strike, swap: input.swap, dodge: input.dodge, ability: input.ability };
    if (LEVEL && input.use) inp.use = true;   // E or a tap on the prompt by the chest or the ram: the rules take it up (section 3.14)
    input.swap = false; input.dodge = false; input.ability = false; input.use = false;   // Swap, Dodge, the ability and use are passed once, a press each
    if (T) { if (T.move) inp.move = T.move; if (T.strike !== undefined) inp.strike = !!T.strike; if (T.swap) { inp.swap = true; T.swap = false; } if (T.dodge) { inp.dodge = true; T.dodge = false; } if (T.ability) { inp.ability = true; T.ability = false; } if (T.use) { inp.use = true; T.use = false; } if (T.target !== undefined) inp.target = T.target; if (T.face !== undefined) inp.face = T.face; }
    // arriving: the knight walks in while input waits, to the area's walkTo ([x, y], null for an axis it keeps: the cellar's knight walks
    // down off the bottom step, the level's in from the left edge of the field)
    if (state.arrive > 0) { state.arrive -= STEP; const wt = AREA.knight.walkTo || [null, null], k = fight.k; return { move: [wt[0] !== null && wt[0] !== undefined && k.x < wt[0] ? 1 : 0, wt[1] !== null && wt[1] !== undefined && k.y < wt[1] ? 1 : 0] }; }
    return inp;
  }

  // ------------------------------------------------------------------ the loop: a fixed step, at most 5 a frame
  let last = 0, acc = 0;
  function frame(now) {
    window.requestAnimationFrame(frame);
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
    if (!harness && !paused()) advance(dt);
    draw();
  }
  function advance(dt) {
    acc += dt * (state.slow ? 0.25 : 1);
    let n = 0;
    while (acc >= STEP && n < SPEC.caps.steps) { tick(); acc -= STEP; n++; }
    if (n >= SPEC.caps.steps) acc = 0;   // a slow phone: the world slows rather than jumping
    return n;
  }
  // one step of the screen's clock: the world holds on a hit; otherwise the fight moves on and its events are shown
  function tick() {
    state.t += STEP;
    if (state.lit < 3 && AREA.light) state.lit = Math.min(3, Math.floor(state.t / (AREA.light.catch / 3)));   // the torches catch one after another
    if (state.hold > 0) { state.hold -= STEP; for (const n of state.nums) n.t += STEP * 0.25; return; }
    const k = fight.k, before = k.active, carried = !!k.carry, inp0 = gather(), t0 = state.perf ? window.performance.now() : 0;
    // with sword-brothers or bench bots the party's controller gives every seat its input (the player's is seat 0's)
    const events = Combat.step(fight, STEP, party ? party.step(STEP, inp0) : inp0);
    // the step's cost is timed in batches of 8 (a clock of 0.1 ms, 1 ms in Safari, cannot time one step): each sample is a batch's mean
    if (state.perf) { const P = state.perf; P.batchT += window.performance.now() - t0; if (++P.batchN >= 8) { P.steps.push(P.batchT / P.batchN); P.batchT = 0; P.batchN = 0; if (P.steps.length > 240) P.steps.shift(); } }
    if (harness) { for (const e of events) state.log.push(e); if (state.log.length > 4000) state.log.splice(0, state.log.length - 4000); }
    take(events);
    if (k.active !== before) { syncHud(); writeBack(); } else if (!!k.carry !== carried) syncHud();
    if (LEVEL) levelTick();
    particles();
    for (const f of state.fx) f.t += STEP;
    state.fx = state.fx.filter(f => f.t < f.life);
    for (const n of state.nums) n.t += STEP;
    state.nums = state.nums.filter(n => n.t < n.life);
    if (state.shake.t > 0) state.shake.t -= STEP;
    // the dodge and the lunge leave afterimages
    if (k.dodge > 0 || k.lunge) { state.trail.unshift([k.x, k.y]); if (state.trail.length > 9) state.trail.pop(); } else if (state.trail.length) state.trail.pop();
    flushSums(false);
    zones();
    lessonOn("tick");
  }

  // ------------------------------------------------------------------ what happened: events to effects, numbers, holds and shakes
  const LIFE = { smear: 0.26, streak: 0.16, star: 0.14, ring: 0.3, whirl: 0.3, crack: 1.0, dust: 0.35, blast: 0.4, puff: 0.4, straw: 0.35, sparks: 0.25, arc: 0.18, dash: 0.25 };
  const INK = { normal: "#ffffff", crit: "#fee761", RESIST: "#8b9bb4", IMMUNE: "#8b9bb4", WEAK: "#f77622", COMBO: "#feae34", WALL: "#feae34", raw: "#fee761", heal: "#63c74d", bonk: "#e4a672", block: "#c0cbdc", reflect: "#2ce8f5", miss: "#8b9bb4", bleed: "#e43b44" };
  const ELC = { physical: ["#5a6988", "#8b9bb4", "#c0cbdc", "#ffffff"] };
  const elemRamp = e => PF.ELEM[e] || ELC.physical;
  function ramp(el, mat) { if (el && el !== "physical" && PF.ELEM[el]) return PF.ELEM[el]; const m = PF.RAMP[mat] || PF.RAMP.steel; return mat === "wood" ? PF.RAMP.steel : m; }
  function addFx(e, extra) { const f = Object.assign({}, e, extra || {}, { t: 0 }); f.life = f.life || LIFE[f.kind] || 0.3; if (f.el !== undefined || f.mat !== undefined) f.ramp = ramp(f.el, f.mat); state.fx.push(f); if (state.fx.length > 96) state.fx.shift(); return f; }
  function say(x, y, s, c, big) { state.nums.push({ x, y, s: String(s), c: c || INK.normal, t: 0, life: FEEL.number, big: !!big }); if (state.nums.length > 64) state.nums.shift(); }
  function take(events) {
    lessonOn("events", events);
    for (const e of events) {
      if (LEVEL && takeLevel(e)) continue;
      if (e.type === "fx") addFx(e, e.kind === "blast" && e.small ? { life: 0.25 } : null);
      else if (e.type === "hit") onHit(e);
      else if (e.type === "shake") { if (!reduce) state.shake = { t: e.time, amp: e.amp }; }
      else if (e.type === "bonk") say(e.x, e.y - 36, "BONK", INK.bonk);
      // an ability (design pass 10): its name in capitals floats over the knight in the carried element's lightest tone (white for
      // physical), with a star at the chest; when its clock is done the button is drawn ready again
      else if (e.type === "ability") { say(e.x, e.y - 40, String(e.name).toUpperCase(), elemRamp(e.el)[3], true); addFx({ kind: "star", x: e.x, y: e.y - 16, c: "#fee761", big: true, life: 0.2 }); }
      else if (e.type === "ready") hud.ab = -1;
      else if (e.type === "block") { say(e.x, e.y - 36, "BLOCK", INK.block); addFx({ kind: "sparks", x: e.bx, y: e.by, seed: fight.steps }); }
      else if (e.type === "reflect") say(e.x, e.y - 36, "REFLECT", INK.reflect);
      else if (e.type === "miss") say(e.x, e.y - 36, "MISS", INK.miss);
      else if (e.type === "immune") say(e.x, e.y - 24, "IMMUNE", INK.IMMUNE);
      else if (e.type === "heal") { state.heal.n += e.amount; }
      else if (e.type === "summon") addFx({ kind: "puff", x: e.x, y: e.y - 4, c: "#ead4aa" });
      else if (e.type === "expire" && e.what === "minion") addFx({ kind: "puff", x: e.x, y: e.y - 5, c: "#ead4aa", scraps: true, life: 0.5 });
      else if (e.type === "swap") addFx({ kind: "puff", x: fight.k.x, y: fight.k.y - 14, c: "#9a948c", life: 0.3 });
      else if (e.type === "log" && window.console) window.console.warn("Forge Forever: " + e.text + " (played by the fallback)");
    }
  }
  // a level's events (design pass 12): the marks and the pieces go to the painter (a smash's crack is a lasting mark there, stamped once,
  // not the cellar's live effect); a knight's hurt and its burn ticks show in the INK colours; a troll's death by the water or the spikes
  // says so; the director's events (section 3.6) become the note's lines, the pickups go into the satchel, and the first time a thing
  // happens the note teaches it (section 3.8). Returns true for an event the cellar's take() must not see
  function takeLevel(e) {
    if (e.type === "mark" || e.type === "markEnd" || e.type === "wreck" || e.type === "fell" || e.type === "die" || e.type === "windUp") scene.take(e, fight);   // (windUp: the Emberback's flare, a ring with no troll behind it)
    if (e.type === "palisade") scene.fell["pal" + e.id] = state.t;   // a palisade topples from the director's event (its four frames on the screen's clock, as the painter times them)
    if (e.type === "unspawn") scene.last.delete(e.foe);   // a wipe's quiet removal (section 3.8): no stone death, no rubble; the painter only forgets the troll
    if (e.type === "hurt") {
      const kz = e.z !== undefined ? e.z : ((fight.knights[e.seat] || fight.k).z || 0);   // a number over a knight on the roof or the deck is lifted with it
      say(e.x + (e.tick ? rnd() * 6 - 3 : 0), e.y - kz - (e.tick ? 30 : 36), Math.max(1, Math.round(e.amount)), e.tick && e.src === "burning" ? INK.WEAK : INK.bleed);
      if (e.src === "wire" && isMine(e)) firstTime("wire", "Wire cuts. Go round or cut it.");
      if (isMine(e) && fight.k.hp > 0 && fight.k.hp <= LVN.badlyHurt && !lv.badly) { lv.badly = true; note("Badly hurt", "badlyHurt"); }
      return true;
    }
    // (the satchel is saved on every count too, so a reload keeps the finds and the counts earned since the last pickup)
    if (e.type === "die") { if (e.foe !== undefined) { lv.felled++; if (e.kind === "emberback") lv.finds.rare_enemies++; saveSatchel(); } if (e.why === "DROWNED" || e.why === "SPIKED") say(e.x, e.y - 24, e.why, INK.block); }
    if (e.type === "wreck") { if (e.kind === "hut" || e.kind === "tent") { lv.huts++; saveSatchel(); } else if (e.kind === "engine" || e.kind === "trebuchet") { lv.engines++; saveSatchel(); } }
    if (e.type === "regrow") { if (e.amount >= 1) say(e.x, e.y - 4, "+" + Math.round(e.amount), INK.heal); firstTime("regrow", "It heals. Burn it."); }   // the troll's green + of regrowth (its y comes lifted: the rules say it over the chest)
    if (e.type === "fx" && e.kind === "crack") { scene.stamp({ type: "mark", kind: "crack", id: e.seed | 0, x: e.x, y: e.y, z: 0, r: 8 }); return true; }
    // the director's lines (section 3.14: one timed line at a time, by priority) and what the first time of a thing teaches
    const D = DIRECTOR[e.type];
    if (D) D(e);
    return false;
  }
  // ------------------------------------------------------------------ the level's HUD (design pass 12, sections 3.8, 3.11 and 3.14)
  // The note's lines and their priorities come from the area (gate.json notes: the priority list and each line's seconds). The director's
  // events this page reads (proto/level.js emits them): wave { n, of, name, arena, attempt }, breakGate { name, hp }, lastOfThem { name },
  // gateStage { stage, frac, hp }, onward { arena, next }, breather { heal }, horn, rattle { time }, bridgeDown, burst { x, y }, gateOurs,
  // pickup { seat, id, from, pouch }, chestOpen { seat, open }, palisade { id }, unspawn { foe }, spawn with from: "hut" for a hut's troll,
  // foeShotEnd with over: true for a shot over a trench; wipe / rally / secondWind / down / carry / kstatus / aimLine / mark are the rules' own
  // (the notes block is read with care: a priority list that is no list of names, or lacks a name the page uses, falls back to the note's
  // order for what is missing, so a malformed spec never stops the page)
  const NOTES = AREA.notes && typeof AREA.notes === "object" ? AREA.notes : {};
  const PRIORITY = ["downed", "wipe", "secondWind", "gateOurs", "wave", "gateLine", "onward", "firstTime", "badlyHurt", "empty"];
  const specPri = Array.isArray(NOTES.priority) ? NOTES.priority.filter(s => typeof s === "string") : [];
  const LVN = { secs: Object.assign({ wave: 2.5, breakGate: 2.5, lastOfThem: 2.5, gateLine: 2.0, onward: 2.0, breather: 2.5, wipe: 3.0, gateOurs: 3.0, secondWind: 1.5, firstTime: 3.0, badlyHurt: 2.0, horn: 2.5 }, NOTES),
    priority: specPri.concat(PRIORITY.filter(name => !specPri.includes(name))),
    empty: typeof NOTES.empty === "string" ? NOTES.empty : "You carry the practice sword. Bring weapons from the Forge", badlyHurt: typeof NOTES.badlyHurtAt === "number" ? NOTES.badlyHurtAt : 30 };   // the HP at which the note says Badly hurt (section 3.8: 30 HP or less)
  const PRI = {}; LVN.priority.forEach((name, i) => { PRI[name] = i; });
  // the level's own state on the page: the note, the satchel, the counts for the tally, what the first-time lines have taught
  const lv = { line: null, waved: false, badly: false, ours: false, done: false, clearT: 0, felled: 0, huts: 0, engines: 0, edgeSeen: false,
    things: [], finds: { gold_chests: 0, iron_chests: 0, rare_enemies: 0, quest_embers: 0 }, firsts: new Set(), sent: null };
  state.lv = lv;
  const isMine = e => e.seat === undefined || e.seat === fight.k.seat;
  const title = s => { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); };
  // one timed line at a time: a new line replaces the shown one if its priority is the same or higher and restarts the timer; a lower line
  // arriving while a higher one shows is dropped, never queued (returns whether it shows)
  function note(text, kind, secs) {
    const pri = PRI[kind] === undefined ? PRI.firstTime : PRI[kind], dur = secs === undefined ? (typeof LVN.secs[kind] === "number" ? LVN.secs[kind] : 2.5) : secs;
    if (lv.line && lv.line.until > state.t && lv.line.pri < pri) return false;
    lv.line = { text, pri, until: state.t + dur, kind };
    syncHud();
    return true;
  }
  // a first-time line (section 3.8): once per profile, 3 s; dropped for a higher line it is not marked seen, so it shows the next time.
  // Returns whether there is nothing more to show (the line showed now, or was taught before); false while it waits for its turn
  function firstTime(key, text) {
    if (lv.firsts.has(key)) return true;
    if (!note(text, "firstTime")) return false;
    lv.firsts.add(key);
    store.set(KEYS.firsts, JSON.stringify(Array.from(lv.firsts)));
    return true;
  }
  try { for (const k of JSON.parse(store.get(KEYS.firsts) || "[]")) if (typeof k === "string") lv.firsts.add(k); } catch (e) { /* nothing taught yet */ }
  const DIRECTOR = {
    wave(e) { lv.waved = true; lv.badly = false; note("Wave " + (e.n || 1) + " of " + (e.of || (AREA.waves || []).length || 5) + " · " + title(e.name), "wave"); },
    breakGate(e) { note(title((e && e.name) || "Break the gate"), "wave", LVN.secs.breakGate); },
    lastOfThem(e) { note(title((e && e.name) || "The last of them"), "wave", LVN.secs.lastOfThem); },
    gateStage(e) { const L = (AREA.gate || {}).lines || {}, line = L[String(e.frac)] || L[String(e.at)]; if (line) note(line, "gateLine"); },
    onward() { note(arrowed("Onward →"), "onward"); },
    breather(e) { note("Breather · +" + (e.heal || (AREA.breather || {}).heal || 40), "onward", LVN.secs.breather); },
    // the castle front (section 3.4): the horn's line while the camera frames the gatehouse, the chains' rattle a 1 px tremor for its time
    // (the portcullis lifts from fight.gate.lift), the bridge's landing a dust burst at the deck's bank end (the director's shake rides with
    // it), the burst a blast of splinters at the arch (the doors split from fight.gate.burst, the fight's clock)
    horn() { note("A war horn sounds from the castle", "onward", LVN.secs.horn); },
    rattle(e) { if (!reduce) state.shake = { t: Math.max(state.shake.t, e.time || 1.5), amp: 1 }; },
    bridgeDown() { const B = AREA.bridge; if (!B || !B.u) return; for (const v of [B.v[0] + 8, (B.v[0] + B.v[1]) / 2, B.v[1] - 8]) addFx({ kind: "dust", x: (B.u[0] + v) / 2, y: (v - B.u[0]) / 2, c: "#b86f50", life: 0.5 }); },
    burst(e) { addFx({ kind: "blast", x: e.x, y: e.y, r: 18, life: 0.5 }); for (let i = 0; i < 3; i++) addFx({ kind: "puff", x: e.x - 8 + i * 8, y: e.y + 4 - (i % 2) * 6, c: "#9a948c", life: 0.45 }); },
    // (the wipe's line rides on the fade itself, which covers the note: .fade.wipe shows its data-line over the black until the rally)
    wipe() { note("The trolls hold the field", "wipe"); if (!reduce) { const f = $("fade"); f.setAttribute("data-line", "The trolls hold the field"); f.classList.add("on", "wipe"); } },
    rally() { lv.badly = false; clearFx(); $("fade").classList.remove("on", "wipe"); },
    secondWind() { note("Second wind", "secondWind"); },
    gateOurs() { lv.ours = true; lv.clearT = fight.t; note("The gate is ours.", "gateOurs"); },
    clear() { DIRECTOR.gateOurs(); },
    pickup(e) { if (isMine(e)) pickup(e.id || e.thing, e.from); },
    chestOpen(e) { if (isMine(e)) { lv.finds.iron_chests = 1; saveSatchel(); } },
    spawn(e) { if (e.from === "hut" || e.door === "hut" || e.hut !== undefined) firstTime("hut", "Huts send trolls. Wreck them."); if (e.kind === "brute" || e.kind === "rockbrute") firstTime("brute", "Hit it hard and fast."); if (e.kind === "emberback") firstTime("emberback", "A glowing one. It drops a rare find."); },
    aimLine() { firstTime("aimLine", "Red line: step off it."); },
    mark(e) { if (e.kind === "stone") firstTime("stone", "Red ring: a stone is coming. Move."); },
    foeShotEnd(e) { if (e.why === "over" || e.over) firstTime("trench", "In a trench, arrows from the side fly over you."); },
    kstatus(e) { if (!e.on || !isMine(e)) return; if (e.status === "burning") firstTime("burning", "Burning! Dodge to roll it out."); if (e.status === "chill") firstTime("chill", "Ice slows you. Three hits freeze."); },
    down(e) { if (!isMine(e)) firstTime("downed", "Stand by a fallen friend to lift them."); },
    carry(e) { if (e.what === "ram" && e.on && isMine(e)) toast((AREA.ram || {}).name + " in hand"); }
  };
  // the satchel (section 3.11.2): ingredient ids only, kept in sessionStorage on every pickup so a reload does not lose it; the toast says
  // what came, "Troll Hide +1", or "First find: Troll Hide" for a Thing never found before, "Iron chest: Chain +1" from the chest
  const found = new Set(handoff && handoff.smith && Array.isArray(handoff.smith.found) ? handoff.smith.found : []);
  const ingredient = id => { const t = classThing(id); return t && t.kind !== "weapon" ? t : null; };
  function pickup(id, from) {
    const t = ingredient(id);
    if (!t) return false;
    const first = !found.has(id) && !lv.things.includes(id);
    lv.things.push(id);
    saveSatchel();
    toast(from === "chest" ? "Iron chest: " + t.name + " +1" : first ? "First find: " + t.name : t.name + " +1");
    return true;
  }
  function saveSatchel() { session.set(KEYS.satchel, JSON.stringify({ v: 1, at: nowIso(), world: handoff ? handoff.world : null, things: lv.things, finds: lv.finds, felled: lv.felled, huts: lv.huts, engines: lv.engines })); }
  (function loadSatchel() {   // a reload keeps the satchel (same world); a run that never ended (a closed tab) rides with the next one, so nothing is lost
    let d = null; try { d = JSON.parse(session.get(KEYS.satchel)); } catch (e) { d = null; }
    if (!d || d.v !== 1 || !Array.isArray(d.things) || (d.world || null) !== (handoff ? handoff.world : null)) return;
    for (const id of d.things) if (ingredient(id)) lv.things.push(id);
    for (const k of Object.keys(lv.finds)) lv.finds[k] = Math.max(0, (d.finds || {})[k] | 0);
    lv.felled = d.felled | 0; lv.huts = d.huts | 0; lv.engines = d.engines | 0;
  })();
  // the way home (section 3.11.5): forge-forever:from-battle, written once with the run; a clear pays at the Forge, a quit banks. The key
  // keeps every run still waiting for the Forge, each by its own id, so the Forge pays or banks each in turn (Again twice: two runs, two
  // pays): this world's in order under `runs` (`run` is the latest, the note's shape), another world's under `others` by its world, left
  // whole until that world's Forge reads them. A quit with nothing in the satchel and no clear has nothing to send and leaves the key as it is
  const clearedBefore = !!(handoff && handoff.smith && handoff.smith.cleared && handoff.smith.cleared[AREA.id]);
  const fullKnight = k => k.kind !== "brother";
  const okRun = r => !!(r && typeof r === "object" && typeof r.id === "string");
  const runsOf = d => (Array.isArray(d.runs) ? d.runs : d.run ? [d.run] : []).filter(okRun);
  function sendHome(cleared) {
    if (lv.sent) return lv.sent;
    const run = { id: runId, area: AREA.id, level: AREA.level || 1, boss: !!AREA.boss, replay: clearedBefore, cleared: !!cleared, things: lv.things.slice(), finds: Object.assign({}, lv.finds),
      party: fight.knights.filter(fullKnight).length, brothers: fight.knights.filter(k => k.kind === "brother").length };
    if (!state.handoff) { session.del(KEYS.satchel); lv.sent = { ok: false, why: "visiting", run }; return lv.sent; }   // visiting: no world to carry the finds to
    if (!run.cleared && !run.things.length) { session.del(KEYS.satchel); lv.sent = { ok: true, why: null, run, empty: true }; return lv.sent; }   // nothing to bank, nothing to pay
    const me = state.handoff.world;
    let prev = null; try { prev = JSON.parse(store.get(KEYS.battle)); } catch (e) { prev = null; }
    let runs = []; const others = {};
    if (prev && typeof prev === "object" && prev.v === 1) {
      const head = runsOf(prev);
      if (prev.world === me) runs = head; else if (typeof prev.world === "string" && head.length) others[prev.world] = { at: prev.at, loadout: prev.loadout, active: prev.active, runs: head };
      for (const [w, o] of Object.entries(prev.others && typeof prev.others === "object" ? prev.others : {})) { if (!o || typeof o !== "object") continue; const l = runsOf(o); if (!l.length) continue; if (w === me) runs = l.concat(runs); else others[w] = Object.assign({}, o, { runs: l }); }
    }
    runs = runs.filter(r => r.id !== run.id).slice(-19); runs.push(run);
    const loadout = state.loadout.filter(id => world.has(id) && !practice(world.get(id))).slice(0, 2), held = fight.hands[fight.k.active].thing.id;
    const d = { v: 1, at: nowIso(), world: me, loadout, active: Math.max(0, loadout.indexOf(held)), run, runs };
    if (Object.keys(others).length) d.others = others;
    const ok = store.set(KEYS.battle, JSON.stringify(d));
    if (ok) session.del(KEYS.satchel);
    lv.sent = { ok, why: ok ? null : "storage", run };
    return lv.sent;
  }
  // the clear (section 3.4): the first knight into the gate takes the party in; the chest is opened first if it was not, its pouches going
  // straight to the satchel; the fade closes and the tally shows 260 ms later
  function finish() {
    if (state.left || lv.done) return;
    lv.done = true; state.done = true;
    // one step with exit: true, always (the rules land every pouch still flying), and use: true while the chest stands unopened (its pouches
    // go straight to the satchel); then the clear goes home at once, before the fade, so a thumb on ↑ Forge inside it finds the run sent
    const landed = Combat.step(fight, STEP, Object.assign(gather(), { use: !!(LV.chest() && !LV.chestOpen()), exit: true }));
    if (harness) for (const e of landed) state.log.push(e);   // (the exit's own step is logged like any tick's: its pickups are the run's last)
    take(landed);
    if (lv.clearT <= 0) lv.clearT = fight.t;
    sendHome(true);
    $("fade").classList.add("on");
    const show = () => { renderTally(); openPlank("tally"); $("fade").classList.remove("on"); };
    if (reduce || harness) show(); else setTimeout(show, 260);
  }
  // what the page reads of the director's state (the rules keep it; the shapes stage G and this stage assume are one line each to change)
  const LV = {
    when(name) { return name === "gateOpen" ? lv.ours || !!(fight.gate && fight.gate.ours) : name === "chestShown" ? !!LV.chest() && !LV.chestOpen() : true; },   // (the chest stays shown for its lid once open; its prompt does not)
    chest() { const c = fight.chest; return c && c.shown ? c : null; },   // { x, y, shown, open?, openAt? }
    chestOpen() { const c = LV.chest(); return !!c && (c.open === true || (c.openAt !== undefined && c.openAt !== null)); },
    ram() { const W = fight.world, id = W && W.ram; if (id === null || id === undefined || !W.solids || !W.solids[id]) return null; const s = W.solids[id]; return { x0: s.x0, y0: s.y0, x1: s.x1, y1: s.y1 }; },
    at(name) { return name === "chest" ? LV.chest() : name === "ram" ? LV.ram() : null; },
    // the knight a lift line is about: a downed ally within the lift's reach of the player's knight
    lifting() { const k = fight.k, L = (SPEC.downed || {}).lift || { within: 16, time: 2 }; if (k.down || k.out) return null; for (const b of fight.knights) if (b !== k && b.down && !b.out && dist(k.x, k.y, b.x, b.y) <= (L.within || 16)) return b; return null; }
  };
  // every step of a level: the downed countdown and the lift line are read from the knights, the ladder's foot teaches the climb
  function levelTick() {
    const k = fight.k;
    if (k.down) { const left = Math.max(0, Math.ceil(k.down.t)); if (!lv.line || lv.line.kind !== "downed" || lv.line.text.slice(-String(left).length) !== String(left)) { lv.line = { text: "Down · a friend can lift you · " + left, pri: PRI.downed, until: state.t + 1, kind: "downed" }; syncHud(); } }
    else if (lv.line && lv.line.kind === "downed") { lv.line = null; syncHud(); }
    if (!lv.firsts.has("ladder") && !k.climbing && fight.world && fight.world.ladders) for (const L of fight.world.ladders) if (L.active !== false && dist(k.x, k.y, L.foot[0], L.foot[1]) <= 12) { firstTime("ladder", "Climb: push up at the ladder."); break; }
  }
  function onHit(e) {
    const tagged = e.tag && INK[e.tag];
    if (e.hold > 0 && !reduce) state.hold = Math.max(state.hold, e.hold);
    if (e.sum) { const s = state.sums[e.d] || (state.sums[e.d] = { acc: 0, at: state.t, x: e.x, y: e.y, tag: null }); s.acc += e.amount; s.x = e.x; s.y = e.y; if (e.tag) s.tag = e.tag; return; }
    if (e.kind === "dot") { say(e.x + (rnd() * 6 - 3), e.y - 6, Math.max(1, Math.round(e.amount)), e.why === "bleed" ? INK.bleed : elemRamp(e.why)[2]); return; }
    if (e.tag === "IMMUNE") { say(e.x, e.y - 10, "IMMUNE", INK.IMMUNE); return; }   // the word instead of a number
    say(e.x, e.y - 10, Math.round(e.amount) + (e.crit ? "!" : ""), e.crit ? INK.crit : tagged ? INK[e.tag] : e.kind === "raw" ? INK.raw : INK.normal, e.crit);
    if (e.tag) say(e.x, e.y - 17, e.tag, INK[e.tag] || INK.normal);
    if (e.crit) addFx({ kind: "star", x: e.x, y: e.y - 4, c: INK.crit, big: true, life: 0.2 });
  }
  // stream ticks are summed per dummy and shown every half second; so are the knight's small heals
  function flushSums(all) {
    for (const key of Object.keys(state.sums)) { const s = state.sums[key]; if (all || state.t - s.at >= FEEL.sum) { if (s.acc > 0) say(s.x, s.y - 10, Math.max(1, Math.round(s.acc)), s.tag ? INK[s.tag] : INK.normal); delete state.sums[key]; } }
    if (state.heal.n > 0 && (all || state.t - state.heal.at >= FEEL.sum)) { say(fight.k.x, fight.k.y - 34, "+" + Math.max(1, Math.round(state.heal.n)), INK.heal); state.heal.n = 0; state.heal.at = state.t; }
    if (state.heal.n === 0) state.heal.at = state.t;
  }
  // a stream's particles, by element: flames, rolling rings of sound, a beam, flakes and drips
  function cones() { const k = fight.k, out = []; if (k.stream && k.stream.arms) out.push(k.stream); if (k.gout && k.gout.arms) out.push(k.gout); return out; }
  function particles() {
    if (reduce) { state.parts = []; state.rings = []; return; }
    for (const S of cones()) {
      const half = S.half * Math.PI / 180, L = S.len, n = S.charging ? 1 : 5;
      for (const a of S.arms) {
        if (S.el === "physical") { if (!S.charging && fight.steps % 7 === 0) state.rings.push({ x: S.x, y: S.y, a, half, len: L, r: 4 }); continue; }
        for (let i = 0; i < n; i++) { const aa = a + (rnd() * 2 - 1) * half * (S.charging ? 0.4 : 1), dd = rnd() * L * (S.charging ? 0.3 : 1);
          state.parts.push({ x: S.x + Math.cos(aa) * dd * 0.2, y: S.y + Math.sin(aa) * dd * 0.2, ox: S.x, oy: S.y, vx: Math.cos(aa) * (L / 0.35), vy: Math.sin(aa) * (L / 0.35), t: 0, life: 0.3 + rnd() * 0.1, len: L, el: S.el }); }
      }
    }
    for (const p of state.parts) { p.t += STEP; p.x += p.vx * STEP; p.y += p.vy * STEP - (p.el === "fire" ? 12 * STEP : 0); if (dist(p.ox, p.oy, p.x, p.y) > p.len) p.t = p.life; }
    state.parts = state.parts.filter(p => p.t < p.life);
    while (state.parts.length > SPEC.caps.particles) state.parts.shift();
    for (const r of state.rings) r.r += 150 * STEP;
    state.rings = state.rings.filter(r => r.r < r.len);
  }

  // ------------------------------------------------------------------ the zones: prompts above the knight, read from the area
  // The cellar's zones (the stairs, the rack, the door to the Troll Gate) are boxes; a level's (design pass 12, section 3.4) are the exit's
  // slanted box in u = x - y and v = x + y, and the chest and the ram, followed within a few pixels while the director shows them. The
  // area's promptOrder says which wins where two apply (the exit, a lift line, the chest, the ram); a lift line is a knight's state, not a
  // zone (section 3.8). Walking into a zone's wall for its dwell does what E does there (the stairs up, the door left, the gate right or up)
  const inZone = z => { const k = fight.k; return !!z && z.x0 !== undefined && k.x >= z.x0 && k.x <= z.x1 && k.y >= z.y0 && k.y <= z.y1; };
  // the player's move this step: the fight's input is a plain object alone, keyed by seat with a party
  const myMove = () => { const I = fight.input, mine = !I ? null : Array.isArray(I) ? I[fight.k.seat] : I[fight.k.seat] && typeof I[fight.k.seat] === "object" && I.move === undefined ? I[fight.k.seat] : I; return (mine && mine.move) || [0, 0]; };
  function zoneAt(z) {
    const k = fight.k;
    if (!z || (z.when && !LV.when(z.when))) return false;
    if (z.follow) { const p = LV.at(z.follow); if (!p) return false; const qx = p.x1 !== undefined ? clamp(k.x, p.x0, p.x1) : p.x, qy = p.y1 !== undefined ? clamp(k.y, p.y0, p.y1) : p.y; return dist(k.x, k.y, qx, qy) <= (z.within || 16); }
    if (z.u) { const u = k.x - k.y, v = k.x + k.y; return u >= z.u[0] && u <= z.u[1] && v >= z.v[0] && v <= z.v[1]; }
    return inZone(z);
  }
  function zones() {
    const Z = AREA.zones || {}, was = state.zone, wasText = state.promptText;
    let zone = null;
    const shutZones = lessonOn("blocked") || null;   // (build 8) the door to the Troll Gate is no zone while the cellar's lessons run
    if (state.arrive <= 0 && !fight.k.down && !fight.k.out) for (const name of (AREA.promptOrder || Object.keys(Z))) {
      if (shutZones && shutZones.includes(name)) continue;
      if (name === "lift") { if (LEVEL && LV.lifting()) { zone = name; break; } continue; }
      if (zoneAt(Z[name])) { zone = name; break; }
    }
    state.zone = zone;
    state.promptText = promptText();
    if (zone !== was || state.promptText !== wasText) syncPrompt();
    // walking into the zone's wall (the stairs up, the door left) or toward the gate for the zone's dwell does what E does there
    const z = Z[zone], mv = myMove(), F = AREA.floor || {};
    const pushing = z && z.dwell && [].concat(z.dir || "up").some(d => d === "up" ? mv[1] < -0.5 && (!!z.u || fight.k.y <= F.y0 + 0.5) : d === "left" ? mv[0] < -0.5 && (!!z.u || fight.k.x <= F.x0 + 0.5) : d === "right" ? mv[0] > 0.5 : d === "down" && mv[1] > 0.5);
    if (pushing) { state.stairs += STEP; if (state.stairs >= z.dwell - 1e-9) { state.stairs = 0; useZone(zone); } } else state.stairs = 0;
  }
  // E, a tap on the prompt, or the dwell: the stairs leave for the Forge, the rack and the door open their planks, the exit takes the party
  // into the castle, the chest and the ram are the rules' (use rides with the next step); a lift line does nothing (section 3.8)
  function useZone(zone) {
    const z = (AREA.zones || {})[zone];
    if (!zone || !z && zone !== "lift") return;
    if (zone === "lift") return;
    if (zone === "stairs") leave("forge");
    else if (zone === "rack") openPlank("rack");
    else if (z.opens) openPlank(z.opens);
    else if (zone === "exit") finish();
    else input.use = true;
  }
  function use() { useZone(state.zone); }
  // "←" and "→" are set in Pixelify Sans like the cellar's "↑ The Forge" (section 3.14). Once the font is loaded, a glyph it lacks would come
  // from another face: then the prompt is plain "The Troll Gate" and the lines "Onward" and "Into the castle". A glyph is in the font when
  // its width is the same with either fallback behind the font; with the font itself missing (offline) nothing can be told and the arrows stay
  state.arrows = null;
  const arrowed = s => state.arrows === false ? String(s).replace(/^[←→]\s*/, "").replace(/\s*[←→]$/, "") : s;
  (function arrows() {
    const FS = document.fonts; if (!FS || !FS.ready) return;
    const test = () => { try {
      const c = document.createElement("canvas").getContext("2d"), w = (f, s) => { c.font = f; return c.measureText(s).width; }, inFont = ch => Math.abs(w("40px 'Pixelify Sans', monospace", ch) - w("40px 'Pixelify Sans', serif", ch)) < 0.01;
      state.arrows = inFont("A") ? inFont("←") && inFont("→") : null;
      if (state.zone) { state.promptText = promptText(); syncPrompt(); }
    } catch (e) { /* the arrows stay */ } };
    FS.ready.then(test, () => {});
  })();
  function promptText() {
    const z = state.zone;
    if (!z) return "";
    // "Lift Ana" while the lift waits (the lifter was just hit, or another knight lifts), "Lifting Ana 1/4" to "4/4" while this knight lifts
    if (z === "lift") { const b = LV.lifting(), L = (SPEC.downed || {}).lift || { time: 2 }, who = (b && b.name) || "your friend"; return b && b.down.by === fight.k.seat ? "Lifting " + who + " " + Math.min(4, Math.floor(b.down.lift / (L.time || 2) * 4) + 1) + "/4" : "Lift " + who; }
    return arrowed((AREA.zones[z] || {}).prompt || "");
  }
  function syncPrompt() {
    const p = $("prompt"), z = state.zone;
    p.hidden = !z;
    if (z) { p.textContent = state.promptText || promptText(); p.style.pointerEvents = z === "lift" ? "none" : ""; hud.half = Math.ceil((p.offsetWidth || 0) / 2) + 2; hud.x = -1; }
  }
  $("prompt").addEventListener("click", use);

  // ------------------------------------------------------------------ drawing
  const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); }, pxAt = px;
  const dith = (x, y, a) => C.BAYER[((Math.round(y) & 3) * 4) + (Math.round(x) & 3)] < a;
  function line(x0, y0, x1, y1, c) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0; for (let i = 0; i <= n; i++) { const u = n ? i / n : 0; px(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, c); } }
  const wcache = new Map();
  function weaponCanvas(t, facing, f) {
    const key = t.id + "|" + facing + "|" + f;
    if (wcache.has(key)) return wcache.get(key);
    const sp = PF.poseFor(t, facing, f), out = { c: C.canvasOf(sp.px, 32, 32), white: null, px: sp.px, grip: sp.grip || [6, 25], tip: sp.tip || sp.grip || [16, 8] };
    wcache.set(key, out);
    return out;
  }
  const FIRECOL = ["#fee761", "#feae34", "#f77622", "#e43b44"];
  function draw() {
    state.frames++;
    if (state.perf) { const now = window.performance.now(); if (state.perf.last) { state.perf.frames.push(now - state.perf.last); if (state.perf.frames.length > 240) state.perf.frames.shift(); } state.perf.last = now; }
    if (LEVEL) { drawLevel(); return; }
    const k = fight.k, t = state.t, still = reduce, fxf = still ? 0 : Math.floor(t * 8) % 4;
    ctx.save();
    if (state.shake.t > 0 && !still) ctx.translate(Math.round((rnd() * 2 - 1) * state.shake.amp), Math.round((rnd() * 2 - 1) * state.shake.amp));
    scene.draw(ctx, t, still, state.lit);
    drawBoard();
    // floor decals: patches, cracks, traps, the fields
    for (const p of fight.patches) drawPatch(p, t);
    for (const f of state.fx) if (f.kind === "crack") drawCrack(f);
    lessonOn("floor", ctx);   // (build 8) the lessons' floor rings, under the actors
    for (const tr of fight.traps) drawTrap(tr, t);
    for (const h of fight.hands) if (h.aura) drawAura(h.aura, k, t);
    // actors, sorted by their feet
    const actors = [];
    for (const d of fight.dummies) actors.push({ y: d.y, draw: () => drawDummy(d, t) });
    actors.push({ y: k.y, draw: () => drawKnight(fxf) });
    for (const m of fight.minions) actors.push({ y: m.y, draw: () => drawMinion(m) });
    for (const h of fight.hands) if (h.orbit && h.orbit.pos.length) { const O = h.orbit, n = O.pos.length;
      O.pos.forEach((p, i) => actors.push({ y: p[1], draw: () => { if (!still) drawTrail(k.x, k.y, O.fu.orbitR, O.phase + i * TAU / n, O.fu); drawBody(p[0], p[1] - 10, O.fu); } })); }
    actors.sort((a, b) => a.y - b.y);
    for (const a of actors) a.draw();
    // shots, streams, effects, numbers
    for (const p of fight.shots) drawShot(p, t);
    drawStreams();
    for (const f of state.fx) if (f.kind !== "crack") drawFx(f);
    for (const n of state.nums) { const q = n.t / n.life, y = n.y - FEEL.rise * Math.min(1, q * 1.4); if (q > 0.8 && (state.frames & 1) && !still) continue; C.outlined(ctx, n.s, Math.round(n.x - C.textWidth(n.s) / 2), Math.round(y), n.c); }
    if (state.reach) drawReach();
    ctx.restore();
    syncLive();
  }
  // a level's frame (design pass 12, section 3.2): inside the shake, the ground from the column tiles and the decal canvases before the
  // camera's translate; after it, in world coordinates, the grass tufts, the live marks and telegraphs on the floor, the traps and auras,
  // every actor by its feet (the painter sorts the pieces, the bodies and the platform groups), the knights' shots, streams, effects and
  // numbers; then, in view coordinates, the marks for trolls off the screen; the reach overlay last
  function drawLevel() {
    const t = state.t, still = reduce, [camX, camY] = cam(), fxf = still ? 0 : Math.floor(t * 8) % 4;
    if (!scene.tiles.allDone()) scene.tiles.work(2, () => window.performance.now());   // the tiles bake in 2 ms slices while the party walks
    ctx.save();
    if (state.shake.t > 0 && !still) ctx.translate(Math.round((rnd() * 2 - 1) * state.shake.amp), Math.round((rnd() * 2 - 1) * state.shake.amp));
    const hitches = scene.tiles.hitches;
    scene.drawGround(ctx, camX, camY);
    if (state.perf && scene.tiles.hitches > hitches) { state.perf.hitches++; if (window.console) window.console.warn("Forge Forever: a column tile was finished at once (a hitch)"); }
    ctx.translate(-camX, -camY);
    const o = { t, still, dt: STEP, marks: state.stress ? state.stress.marks : null, patchFade: SPEC.patch.fade, few: state.fx.length > 64,
      knight: (k, c) => drawKnight(fxf, k, c), minion: (m, c) => drawMinion(m, c), statuses: (f, c) => drawStatuses(f, t, c) };
    scene.drawWallArchers(ctx, fight, o);
    scene.drawTufts(ctx, t, still, fight);
    scene.drawFloor(ctx, fight, o);
    for (const tr of fight.traps) drawTrap(tr, t);
    for (const k of fight.knights) if (!k.out) for (const h of k.hands) if (h.aura) drawAura(h.aura, k, t);
    scene.draw(ctx, fight, o);
    scene.drawBars(ctx, fight, o);   // (design pass 18: over what was hit, after the field's actors)
    for (const p of fight.shots) drawShot(p, t);
    drawStreams();
    for (const f of state.fx) if (f.kind !== "crack") drawFx(f);
    for (const n of state.nums) { const q = n.t / n.life, y = n.y - FEEL.rise * Math.min(1, q * 1.4); if (q > 0.8 && (state.frames & 1) && !still) continue; C.outlined(ctx, n.s, Math.round(n.x - C.textWidth(n.s) / 2), Math.round(y), n.c); }
    // the guide (design pass 18): what the level points at, worked out once a frame; its arrows over everything on the field, not under a
    // plank or in a fade, as the edge marks
    const toastOn = $("toast").classList.contains("show"), shown = !state.plank && !state.left && !(fight.wipe && $("fade").classList.contains("on"));
    const top = markTop(), guide = state.guide = window.Level && Level.guide ? Level.guide(fight, { lefty: state.lefty, toast: toastOn, top }) : null;
    if (shown) scene.drawGuide(ctx, guide, o);
    ctx.translate(camX, camY);
    if (shown) { const em = (window.Level ? Level.edgeMarks : Gate.edgeMarks)(fight, { lefty: state.lefty, toast: toastOn, marks: o.marks, avoid: guide ? guide.edges : [], top }); scene.drawEdgeMarks(ctx, em); scene.drawGuideView(ctx, guide, o); if (em.length && !state.lv.edgeSeen && firstTime("edge", "Marks at the edge: trolls off the screen.")) state.lv.edgeSeen = true; }   // (dropped under a higher line, the line is tried again while marks show)
    if (state.reach) { ctx.translate(-camX, -camY); drawReach(); ctx.translate(camX, camY); }
    if (state.perf) drawPerf();
    ctx.restore();
    syncLive();
  }
  // the view's line under the two plates on this phone (design pass 18): the marks at the view's edge and GO keep below it, wherever the
  // stage sits (the safe-area insets and the whole-pixel fit move it); never above the area's own top line (offscreenMarks.top)
  // (worked out once per fit and kept: reading the plate's offsets every frame would force a layout each frame)
  let markTopKept = null;
  function markTop() {
    const L = state.layout, M = AREA.offscreenMarks || {}, p = $("hpPlate");
    if (!LEVEL || !L || !(L.s > 0) || !p || p.hidden) return M.top || 28;
    if (markTopKept !== null && markTopKept.layout === L) return markTopKept.top;
    const bottom = (L.pt || 0) + p.offsetTop + p.offsetHeight;   // (the plates hang at the same height; the HUD's inner box starts at the insets)
    markTopKept = { layout: L, top: Math.max(M.top || 28, Math.ceil((bottom - L.y) / L.s) + 5) };   // (5: a mark's half size, so the whole chevron clears the plate)
    return markTopKept.top;
  }
  // the step and frame-time readout under ?perf: the steps are timed in batches of 8 (the clock's grain is too coarse for one), so the
  // line says the mean step and the p99 of the 8-step means over the last 240 batches (ms); then the mean and p99 frame time, the
  // hitches, the frame's stamps; the numbers in the 3 x 5 font, under the top row
  function drawPerf() {
    const P = state.perf, mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0, p99 = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * 0.99))]; };
    const lines = ["STEP " + mean(P.steps).toFixed(3) + " MS  P99 OF 8-STEP MEANS " + p99(P.steps).toFixed(3), "FRAME " + mean(P.frames).toFixed(1) + " MS  P99 " + p99(P.frames).toFixed(1), "HITCH " + P.hitches + "  STAMPS " + scene.stamped + "  FOES " + (fight.foes || []).length];
    lines.forEach((s, i) => C.outlined(ctx, s, 4, 34 + i * 7, "#fee761"));
  }
  // the tally board, in chalk: the last hit, the damage a second over the last 5 s, the dummy's name
  function drawBoard() {
    const bi = scene.boardInner, b = fight.board;
    C.text(ctx, "LAST " + (b.last === null ? "-" : Math.round(b.last)), bi.x + 3, bi.y + 3, "#d8dcd0");
    C.text(ctx, "DPS " + b.dps.toFixed(1), bi.x + 3, bi.y + 11, "#d8dcd0");
    C.text(ctx, b.name || "", bi.x + 3, bi.y + 19, "#7d9088");
  }
  function drawDummy(d, t) {
    C.shadow(ctx, d.x, d.y, d.shadow);
    const tilt = d.arm ? 0 : Math.round(d.wob), mode = d.flash > 0 ? "white" : d.st.freeze ? "ice" : null;
    ctx.drawImage(C.dummySprite(d.kind, tilt, mode), Math.round(d.x) - d.size / 2, Math.round(d.y) - (d.size - 2));
    if (d.arm) C.quintainArm(ctx, Math.round(d.x), Math.round(d.y), d.arm.a, d.arm.len);
    drawStatuses(d, t);
  }
  // a knight's animation in a level (design pass 12, section 3.12): the frames a real fight needs, from its state, else the cellar's
  function levelAnim(k) {
    if (k.air) return { anim: "fall", i: 0 };
    if (k.climbing) return { anim: "climb", i: Math.floor((k.z || 0) / 6) & 1 };
    if (k.down || k.rise > 0) return k.down && k.moving ? { anim: "crawl", i: Math.floor(k.walkT * 4) & 1 } : { anim: "down", i: 0 };
    if (k.hurt > 0 && ((state.frames >> 2) & 1) && !reduce) return { anim: "hurt", i: 0 };   // the blink after a hit
    if (k.teeter) return { anim: "teeter", i: 0 };
    return Combat.animOf(fight, k);
  }
  // the look of a knight: the cellar's for the solo player's knight, the brothers' steel-grey kit with their seat's colour, the carried ram
  const lookOf = k => { const L = {}; if (k.kind === "brother") { L.seat = k.seat; L.kit = "brother"; } else if (k.seat && fight.knights.length > 1) L.seat = k.seat; if (k.carry) L.carry = "ram"; return Object.keys(L).length ? L : null; };
  // the knight (c: a context in world coordinates; the painter lifts a knight by its height before calling this in a level)
  function drawKnight(fxf, k, c) {
    k = k || fight.k; c = c || ctx;
    const a = LEVEL ? levelAnim(k) : Combat.animOf(fight), h = Combat.hold(fight, a.anim, a.i, k), look = LEVEL ? lookOf(k) : null, kf = look ? Knight.frame(h.facing, a.anim, a.i, h.reach, look) : h.frame;
    if (!LEVEL) C.shadow(c, k.x, k.y, 7);   // (in a level the painter draws the shadow on the surface under the knight)
    // the dodge draws the walk frame with three fading afterimages; so does a lunge
    if (!reduce && k === fight.k) for (let g = 1; g <= 3; g++) { const p = state.trail[g * 3 - 1]; if (!p) break; c.globalAlpha = 0.3 / g; c.drawImage(kf.canvas(), Math.round(p[0]) - 16, Math.round(p[1]) - 31); c.globalAlpha = 1; }
    const wc = weaponCanvas(h.thing, h.facing, fxf), sheathed = k.swapT > SPEC.knight.swap / 2, noWeapon = LEVEL && (k.down || k.climbing || k.air || k.carry);
    const drawW = () => {
      if (sheathed || noWeapon) return;   // swapping: the knight sheathes, then draws; down, on the ladder or in the air the weapon is away
      const S = k.stream;
      if (S && S.charging && !reduce && (state.frames >> 2) & 1) c.globalAlpha = 0.6;
      c.drawImage(wc.c, h.hx - wc.grip[0], h.hy - wc.grip[1]);
      c.globalAlpha = 1;
      if (k.charging) {   // a charge: a glow building on the weapon
        const q = clamp(k.chargeT / SPEC.modifiers.charge.time, 0, 1);
        if (!wc.white) wc.white = C.canvasOf(wc.px, 32, 32, { tint: () => "#fff6c8" });
        c.globalAlpha = 0.15 + 0.55 * q * (reduce || q >= 1 || (state.frames >> 2) & 1 ? 1 : 0.6);
        c.drawImage(wc.white, h.hx - wc.grip[0], h.hy - wc.grip[1]);
        c.globalAlpha = 1;
      }
    };
    if (h.behind) drawW();   // facing away the weapon is further from the camera, so it is drawn behind the knight
    c.drawImage(k.bonk > SPEC.dummies.quintain.stagger - 0.15 ? kf.white() : kf.canvas(), h.x0, h.y0);
    if (!h.behind) drawW();
    // the statuses a level puts on a knight (section 3.8): burning, chill and frozen as overlays made from the frame's own pixels
    if (LEVEL) { const ov = k.frozen > 0 ? "frozen" : k.chill && k.chill.n > 0 ? "chill" : k.burn ? "burning" : null; if (ov) { const o = kf.over(ov, reduce ? 0 : Math.floor(state.t * 8) & 1); if (o) c.drawImage(o.canvas(), h.x0, h.y0); } }
  }
  function drawReach() {
    const c = "#2ce8f5", dot = (x, y) => px(x, y, c);
    for (const b of fight.live) {
      if (b.type === "sector" || b.type === "circle" || b.type === "ring") {
        const a0 = b.type === "sector" ? b.a0 : 0, a1 = b.type === "sector" ? b.a1 : TAU, n = Math.ceil(b.r * (a1 - a0) / 2);
        for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; dot(b.x + Math.cos(a) * b.r, b.y + Math.sin(a) * b.r); }
        if (b.type === "sector") for (const a of [a0, a1]) for (let r = 0; r <= b.r; r += 2) dot(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r);
      } else if (b.type === "floorcircle") { const n = Math.ceil(b.r * Math.PI); for (let i = 0; i < n; i++) { const a = i / n * TAU; dot(b.x + Math.cos(a) * b.r, b.y + Math.sin(a) * b.r); } }
      else if (b.type === "line") { const ca = Math.cos(b.a), sa = Math.sin(b.a); for (const side of [-1, 1]) for (let r = 0; r <= b.len; r += 2) dot(b.x + ca * r - sa * side * b.w / 2, b.y + sa * r + ca * side * b.w / 2); for (let q = -b.w / 2; q <= b.w / 2; q += 2) dot(b.x + ca * b.len - sa * q, b.y + sa * b.len + ca * q); }
      else if (b.type === "cone") { for (const s of [-1, 1]) for (let r = 0; r <= b.len; r += 2) dot(b.x + Math.cos(b.a + s * b.half) * r, b.y + Math.sin(b.a + s * b.half) * r); const n = Math.ceil(b.len * b.half); for (let i = 0; i <= n; i++) { const a = b.a - b.half + 2 * b.half * i / n; dot(b.x + Math.cos(a) * b.len, b.y + Math.sin(a) * b.len); } }
    }
    // the dummies' and the knight's colliders, faint; and the weapon's reach while it rests
    const faint = "rgba(44,232,245,0.45)";
    const ring = (x, y, r) => { const n = Math.max(8, Math.ceil(r * 2)); for (let i = 0; i < n; i++) { const a = i / n * TAU; ctx.fillStyle = faint; ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), 1, 1); } };
    for (const d of fight.dummies) ring(d.x, d.y, d.r);
    const k = fight.k, u = fight.hands[k.active].u, r = Combat.reachOf(u);
    ring(k.x, k.y, SPEC.knight.r);
    if (!fight.live.length && (u.melee || u.form === "shoot" || u.form === "lob")) { const n = Math.ceil(r * Math.PI / 3); for (let i = 0; i < n; i++) { if (i % 2) continue; const a = i / n * TAU; ctx.fillStyle = faint; ctx.fillRect(Math.round(k.x + Math.cos(a) * r), Math.round(k.y - CHEST + Math.sin(a) * r), 1, 1); } }
  }
  function drawFx(f) {
    const q = f.t / f.life, Rr = f.ramp || ELC.physical;
    if (f.kind === "smear") {
      // the smear frame: the whole crescent at once, then it dithers out (a crescent that grows would hide behind the hold)
      const fade = Math.max(0, (f.t - 0.05) / (f.life - 0.05)), span = f.a1 - f.a0, band = f.style === "chop" ? 7 : f.style === "reap" ? 6 : 5;
      const steps = Math.ceil(Math.abs(span) * f.r * 1.3) + 2;
      for (let i = 0; i <= steps; i++) {
        const a = f.a0 + span * i / steps, lead = i / steps;
        if (f.style === "lash") { const r = f.r * (0.55 + 0.45 * lead), wig = Math.sin(lead * 9) * 2, x = f.x + Math.cos(a) * r - Math.sin(a) * wig, y = f.y + Math.sin(a) * r + Math.cos(a) * wig; if (dith(x, y, 1 - fade)) px(x, y, lead > 0.8 ? Rr[3] : Rr[2]); continue; }
        if (f.style === "rake") { for (const dr of [0, 3, 6]) { const r = f.r - 1 - dr, x = f.x + Math.cos(a) * r, y = f.y + Math.sin(a) * r; if (dith(x, y, 1 - fade)) px(x, y, dr === 0 ? Rr[3] : Rr[2]); } continue; }
        for (let d = 0; d < band; d++) {
          const r = f.r - d, c = d === 0 ? Rr[3] : d < 3 ? Rr[2] : Rr[1];
          const thin = f.style === "crescent" || f.style === "spin" ? Math.sin(Math.PI * lead) : f.style === "reap" ? Math.min(1, lead * 1.6) : Math.sin(Math.PI * Math.min(1, lead * 1.2));
          if (d > Math.max(1, band * thin)) continue;
          const x = f.x + Math.cos(a) * r, y = f.y + Math.sin(a) * r;
          if ((d === 0 && fade < 0.45) || dith(x, y, (1 - fade) * (0.55 + 0.45 * lead))) px(x, y, c);
        }
      }
      if (f.style === "reap" && fade < 0.6) { const a = f.a1; for (let d = 0; d < 5; d++) px(f.x + Math.cos(a) * (f.r - 5 + d * 0.3) - Math.sin(a) * d, f.y + Math.sin(a) * (f.r - 5) + Math.cos(a) * d, Rr[2]); }
    } else if (f.kind === "streak") {
      const ca = Math.cos(f.a), sa = Math.sin(f.a);
      for (const off of [-3, 0, 3]) for (let r = 6 + Math.abs(off) * 2; r < f.len - 2; r++) if (dith(r, off, 1 - q) && (r + off) % 2) px(f.x + ca * r - sa * off, f.y + sa * r + ca * off, off === 0 ? Rr[3] : Rr[2]);
    } else if (f.kind === "star") {
      const c = f.c || Rr[3] || "#ffffff", s = f.big ? 3 : 2; if (q < 0.7) for (let i = -s; i <= s; i++) { px(f.x + i, f.y, c); px(f.x, f.y + i, c); }
    } else if (f.kind === "ring" || f.kind === "blast") {
      const blast = f.kind === "blast", r = f.r * (0.5 + 0.5 * Math.min(1, q * 2.2)), n = Math.ceil(r * 7);
      const cols = blast ? ["#fee761", "#f77622", "#e43b44", "#9a948c"] : ["#e4a672", "#b86f50", "#9a948c", "#6e6a70"];
      for (let i = 0; i < n; i++) { const a = i / n * TAU, x = f.x + Math.cos(a) * r, y = f.y - (blast ? CHEST : 0) + Math.sin(a) * r * (blast ? 1 : 0.6); if (dith(x, y, 1 - q)) px(x, y, cols[Math.min(3, Math.floor(q * 4))]); }
      if (blast && q < 0.35) for (let i = 0; i < 40; i++) { const a = (i * 2.4) % TAU, rr = (i % 7) / 7 * r * 0.8; px(f.x + Math.cos(a) * rr, f.y - CHEST + Math.sin(a) * rr, i % 3 ? "#fee761" : "#f77622"); }
    } else if (f.kind === "whirl") {
      const n = 48; for (let i = 0; i < n; i++) { const a = i / n * TAU, x = f.x + Math.cos(a) * f.r, y = f.y - 10 + Math.sin(a) * f.r * 0.6; if (dith(x, y, (1 - q) * 0.8)) px(x, y, i % 3 ? Rr[2] : Rr[3]); }
    } else if (f.kind === "dust" || f.kind === "puff") {
      for (let i = 0; i < 8; i++) { const a = i * 0.8, r = 2 + q * 7; if (dith(i, q * 10, 1 - q)) px(f.x + Math.cos(a) * r, f.y - 2 + Math.sin(a) * r * 0.5 - q * 3, f.c || (i % 2 ? "#9a948c" : "#6e6a70")); }
      if (f.scraps) for (let i = 0; i < 6; i++) px(f.x + (i - 3) * 2, f.y + q * 8 + (i % 2) * 2, i % 2 ? "#ead4aa" : "#c28569");
    } else if (f.kind === "straw") {
      const r = C.rng(f.seed); for (let i = 0; i < 6; i++) { const a = r() * TAU, v = 6 + r() * 10; px(f.x + Math.cos(a) * v * q * 1.4, f.y + Math.sin(a) * v * q + q * q * 10, i % 2 ? "#feae34" : "#e4a672"); }
    } else if (f.kind === "sparks") {
      const r = C.rng(f.seed); for (let i = 0; i < 6; i++) { const a = r() * TAU, v = 8 + r() * 12; if (q < 0.8) px(f.x + Math.cos(a) * v * q, f.y + Math.sin(a) * v * q, i % 2 ? "#ffffff" : "#fee761"); }
    } else if (f.kind === "arc") {
      // a jagged line hopping target to target
      const r = C.rng((f.seed || 1) + Math.floor(f.t * 30)), [x0, y0] = f.from, [x1, y1] = f.to, n = Math.ceil(dist(x0, y0, x1, y1) / 3), c = f.el === "lightning" ? "#fee761" : Rr[3];
      let lx = x0, ly = y0; for (let i = 1; i <= n; i++) { const u = i / n, x = x0 + (x1 - x0) * u + (i < n ? (r() * 4 - 2) : 0), y = y0 + (y1 - y0) * u + (i < n ? (r() * 4 - 2) : 0); line(lx, ly, x, y, i % 2 ? c : "#ffffff"); lx = x; ly = y; }
    } else if (f.kind === "dash") {
      for (let i = 0; i < 3; i++) { const r = 4 + i * 3; if (q < 0.8) px(f.x - Math.cos(f.a) * r, f.y - 2 - i, "#9a948c"); }
    }
  }
  function drawCrack(f) {
    const r = C.rng(f.seed), fade = f.t / f.life;
    for (let b = 0; b < 4; b++) { let x = f.x, y = f.y, a = b * Math.PI / 2 + r(); for (let i = 0; i < 6; i++) { x += Math.cos(a) * 1.4; y += Math.sin(a) * 0.8; a += r() - 0.5; if (dith(x, y, 1 - fade)) px(x, y, "#1e1828"); } }
  }
  function drawPatch(p, t) {
    const fade = Math.min(1, (p.life - p.t) / SPEC.patch.fade);
    if (p.kind === "fire") {
      for (let y = -p.r * 0.6; y <= p.r * 0.6; y++) for (let x = -p.r; x <= p.r; x++) { if ((x * x) / (p.r * p.r) + (y * y) / (p.r * p.r * 0.36) > 1) continue; if (dith(p.x + x, p.y + y, 0.28 * fade)) px(p.x + x, p.y + y, (x + y + (reduce ? 0 : state.frames)) % 3 ? "#a22633" : "#f77622"); }
      const f = reduce ? 0 : Math.floor(t * 10); for (let i = 0; i < 4; i++) { const x = p.x + ((i * 5 + f * 3) % (p.r * 2)) - p.r, h = (f + i) % 3; if (fade > 0.3) { px(x, p.y - 1 - h, "#feae34"); px(x, p.y - h, "#f77622"); } }
    } else {
      for (let y = -p.r * 0.6; y <= p.r * 0.6; y++) for (let x = -p.r; x <= p.r; x++) { if ((x * x) / (p.r * p.r) + (y * y) / (p.r * p.r * 0.36) > 1) continue; if (dith(p.x + x, p.y + y, 0.45 * fade)) px(p.x + x, p.y + y, (x * 3 + y) % 5 ? "#b8f4ff" : "#ffffff"); }
    }
  }
  // a trap: a toothed iron plate; thrown for a quarter second, armed after half a second (a red glint), shut when sprung
  function drawTrap(tr, t) {
    const F = SPEC.forms.trap;
    if (tr.t < F.flight) { const q = tr.t / F.flight; px(tr.x0 + (tr.x - tr.x0) * q, tr.y0 + (tr.y - tr.y0) * q - Math.sin(Math.PI * q) * 10, "#8b9bb4"); return; }
    const closed = tr.sprung >= 0;
    const rows = closed ? [".kkkkkk.", "k343434k", "k222222k", ".kkkkkk."] : ["k3.3.3.k", "k2222222", "k111111k", ".kkkkkk."];
    C.paint(ctx, rows, { k: OUT, "1": "#262b44", "2": "#3a4466", "3": "#8b9bb4", "4": "#c0cbdc" }, tr.x - 4, tr.y - 3);
    if (tr.armed && !closed && (reduce || Math.floor(t * 4) % 2)) px(tr.x, tr.y - 4, "#e43b44");
  }
  function drawAura(F, k, t) {
    const u = F.fu, Rr = u.fieldR, rp = elemRamp(u.element), n = Math.ceil(Rr * 8), spin = reduce ? 0 : t * 0.6;
    for (let i = 0; i < n; i++) { const a = i / n * TAU + spin, x = k.x + Math.cos(a) * Rr, y = k.y + Math.sin(a) * Rr; if (dith(x, y, 0.8)) px(x, y, i % 4 ? rp[2] : rp[3]); }
    for (let y = -Rr; y <= Rr; y += 1) for (let x = -Rr; x <= Rr; x += 1) if (x * x + y * y < Rr * Rr && dith(k.x + x, k.y + y, 0.07)) px(k.x + x, k.y + y, rp[1]);
    const since = F.t - F.pulse;   // a pulse is a ring expanding from 0.6 to 1 x the radius
    if (F.pulse >= 0 && since < 0.25) { const r = Rr * (0.6 + 0.4 * since / 0.25), m = Math.ceil(r * 8); for (let i = 0; i < m; i++) { const a = i / m * TAU, x = k.x + Math.cos(a) * r, y = k.y + Math.sin(a) * r; if (dith(x, y, 1 - since / 0.25)) px(x, y, rp[3]); } }
    if (!reduce) { const f = Math.floor(t * 8); for (let i = 0; i < 6; i++) { const a = i * 1.1 + f * 0.05, r = (i * 7) % Rr; px(k.x + Math.cos(a) * r, k.y + Math.sin(a) * r - ((f + i * 3) % 8), rp[3]); } }
  }
  // a mote is 6 x 6, lit from the top left, and trails an arc of fading light along its circle
  const MOTE = [".k11k.", "k2332k", "13ww31", "13w331", "k2332k", ".k11k."];
  const BIGMOTE = ["..k111k..", ".k22332k.", "k2333332k", "123ww3321", "133ww3331", "1233w3321", "k2333332k", ".k22332k.", "..k111k.."];
  function drawBody(x, y, u) {
    const rp = elemRamp(u.element === "physical" ? "arcane" : u.element), big = u.size > 1.2;
    C.paint(ctx, big ? BIGMOTE : MOTE, { k: OUT, "1": rp[1], "2": rp[2], "3": rp[3], w: "#ffffff" }, Math.round(x) - (big ? 4 : 3), Math.round(y) - (big ? 4 : 3));
  }
  function drawTrail(cx, cy, Rr, a, u) {
    const rp = elemRamp(u.element === "physical" ? "arcane" : u.element), span = 0.7, n = Math.max(6, Math.ceil(span * Rr * 1.2));
    for (let j = 2; j <= n; j++) {
      const q = j / n, aa = a - span * q, x = cx + Math.cos(aa) * Rr, y = cy + Math.sin(aa) * Rr - 10;
      if (!dith(x, y, 1.05 - q)) continue;
      px(x, y, q < 0.3 ? rp[3] : q < 0.65 ? rp[2] : rp[1]); if (q < 0.45) px(x, y + 1, rp[q < 0.25 ? 2 : 1]);
    }
  }
  // a paper imp, folded from the book's pages
  function drawMinion(m, c) {
    c = c || ctx;
    if (!LEVEL) C.shadow(c, m.x, m.y, 5);
    const bob = reduce ? 0 : Math.floor(m.walkT * 6) % 2, x = Math.round(m.x) - 5, y = Math.round(m.y) - 13 - bob, flip = m.face < 0;
    const rows = ["k........k", "kk......kk", "k3k....k3k", "k33kkkk33k", "k3333333k.", ".k3k33k3k.", ".k333333k.", ".k322223k.", "..k2222k..", "..k2kk2k..", "..kk..kk.."];
    C.paint(c, rows, { k: OUT, "3": "#fffaf0", "2": "#ead4aa", "1": "#c28569" }, x, y, flip !== (m.swing > 0));
    c.fillStyle = "#b55088"; c.fillRect(x + 3, y + 5, 1, 1); c.fillRect(x + 6, y + 5, 1, 1);
    if (m.swing > 0) for (let i = 0; i < 5; i++) { c.fillStyle = i % 2 ? "#f6757a" : "#ffe0f0"; c.fillRect(Math.round(x + (flip ? -2 - i * 0.5 : 11 + i * 0.5)), y + 3 + i, 1, 1); }
  }
  function drawShot(p, t) {
    const Rr = ramp(p.el, p.mat), blink = reduce ? 0 : Math.floor(t * 10) % 2;
    if (p.kind === "shell") {
      // a black ball on a high arc, its shadow on the floor under it, a fuse spark
      C.shadow(ctx, p.gx, p.gy, 2);
      const x = Math.round(p.gx), y = Math.round(p.gy - CHEST - p.z);
      p.trail.unshift([x, y]); if (p.trail.length > 5) p.trail.pop();
      p.trail.forEach(([tx, ty], i) => { if (i > 0 && i % 2 === 0) px(tx + 1, ty - 2, i < 3 ? "#feae34" : "#be4a2f"); });
      C.paint(ctx, [".kkk.", "k232k", "k221k", "k111k", ".kkk."], { k: OUT, "1": "#262b44", "2": "#3a4466", "3": "#8b9bb4" }, x - 2, y - 2);
      px(x + 1, y - 3, blink ? "#fee761" : "#f77622"); px(x + 2, y - 4, "#fff6c8");
      return;
    }
    const ca = Math.cos(p.a), sa = Math.sin(p.a), fade = p.dropping ? Math.min(1, p.dropT / SPEC.projectiles.drop) : 0;
    const x = p.x, y = p.y + (p.dropping ? p.dropT * 20 : 0);
    if (fade > 0 && dith(x, y, fade)) return;
    if (p.kind === "ghost") {   // a ghost copy of a blow: the weapon's edge, faint
      for (let i = -3; i <= 3; i++) { const gx = x - sa * i - ca * Math.abs(i) * 0.6, gy = y + ca * i - sa * Math.abs(i) * 0.6; if (dith(gx, gy, 0.7)) px(gx, gy, Math.abs(i) < 2 ? Rr[3] : Rr[2]); }
    } else if (p.kind === "arrow" || p.kind === "bolt" || p.kind === "javelin") {
      const L = p.kind === "bolt" ? 5 : p.kind === "javelin" ? 10 : 7, steel = Rr === PF.RAMP.steel || Rr === PF.RAMP.iron;
      for (let i = 0; i < L; i++) px(x - ca * i, y - sa * i, i < 2 ? (steel ? "#c0cbdc" : Rr[3]) : p.kind === "bolt" ? "#733e39" : "#b86f50");
      if (p.kind === "arrow") { px(x - ca * (L - 1) - sa, y - sa * (L - 1) + ca, "#ead4aa"); px(x - ca * (L - 1) + sa, y - sa * (L - 1) - ca, "#ead4aa"); }
      if (p.kind === "bolt") { px(x - ca - sa, y - sa + ca, "#8b9bb4"); px(x - ca + sa, y - sa - ca, "#8b9bb4"); }
    } else if (p.kind === "shard") {
      const ice = p.el && p.el !== "physical" ? elemRamp(p.el) : PF.ELEM.ice;
      for (let i = 0; i < 5; i++) { px(x - ca * i, y - sa * i, i === 0 ? "#ffffff" : ice[2]); if (i > 0 && i < 4) px(x - ca * i - sa, y - sa * i + ca, ice[1]); }
      p.trail.forEach(([tx, ty], i) => { if (i % 2 === 0) px(tx, ty, ice[1]); });
    } else if (p.kind === "dart") {
      for (let i = 0; i < 4; i++) px(x - ca * i, y - sa * i, i === 0 ? Rr[3] : "#fffaf0");
      p.trail.forEach(([tx, ty], i) => { if (i % 2 === 1) px(tx, ty, Rr[1]); });
    } else if (p.kind === "ball") {
      C.paint(ctx, [".kk.", "k23k", "k12k", ".kk."], { k: OUT, "1": "#262b44", "2": "#3a4466", "3": "#8b9bb4" }, x - 2, y - 2);
    } else if (p.kind === "orb") {   // the staff's orb: 7 x 7, a white glint, a sparkle, a trail two pixels wide
      p.trail.forEach(([tx, ty], i) => { if (i < 6) { px(tx, ty, Rr[i < 2 ? 2 : 1]); if (i < 4) px(tx, ty + 1, Rr[1]); } });
      C.paint(ctx, ["..111..", ".12331.", "12ww321", "13w3321", "1233221", ".12221.", "..111.."], { "1": Rr[1], "2": Rr[2], "3": Rr[3], w: "#ffffff" }, Math.round(x) - 3, Math.round(y) - 3);
      if (blink) px(x - 2, y - 4, "#ffffff");
    } else {   // a mote: 3 x 3, bright, with a trail
      p.trail.forEach(([tx, ty], i) => { if (i < 5) px(tx, ty, Rr[i < 2 ? 2 : 1]); });
      C.paint(ctx, [".2.", "232", ".2."], { "2": Rr[2], "3": Rr[3] }, x - 1, y - 1);
      if (blink) px(x - 1, y - 2, "#ffffff");
    }
  }
  function drawStreams() {
    if (reduce) {   // nothing moves: the cone's edges stand for the stream
      for (const S of cones()) { const rp = elemRamp(S.el), half = S.half * Math.PI / 180; for (const a of S.arms) for (const s of [-1, 0, 1]) for (let r = 4; r <= S.len; r += 3) px(S.x + Math.cos(a + s * half) * r, S.y + Math.sin(a + s * half) * r, rp[s ? 2 : 3]); }
      return;
    }
    for (const r of state.rings) { const n = Math.ceil(r.r * r.half * 2) + 2; for (let i = 0; i <= n; i++) { const a = r.a - r.half + 2 * r.half * i / n, x = r.x + Math.cos(a) * r.r, y = r.y + Math.sin(a) * r.r; if (dith(x, y, 1 - r.r / r.len * 0.6)) { px(x, y, i % 3 ? "#bfe8e0" : "#ffffff"); if (r.r < r.len * 0.5) px(x - Math.cos(a), y - Math.sin(a), "#6fb0a8"); } } }
    for (const p of state.parts) { const q = p.t / p.life, rp = elemRamp(p.el), c = p.el === "fire" ? FIRECOL[Math.min(3, Math.floor(q * 4))] : rp[3 - Math.min(3, Math.floor(q * 4))]; px(p.x, p.y, c); if (q < 0.4) px(p.x + 1, p.y, c); }
  }
  function drawStatuses(d, t, c) {
    const st = d.st, hx = d.arm ? Combat.hitPoint(d)[0] : d.x, hy = (d.arm ? Combat.hitPoint(d)[1] : d.y - d.chest) - (d.z || 0), f = reduce ? 0 : Math.floor(t * 8);
    const px = c && c !== ctx ? (x, y, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), 1, 1); } : pxAt;
    if (!st) return;
    if (d.head === undefined) d = Object.assign({}, d, { head: d.chest + 8, eyes: d.chest + 5, y: d.y - (d.z || 0) });   // a troll: its head and eyes stand over its chest
    if (st.burn) for (let i = 0; i < 3; i++) px(hx - 4 + ((i * 5 + f) % 9), hy - 2 - ((f + i * 3) % 7), FIRECOL[(f + i) % 4]);
    if (st.bleed) for (let i = 0; i < (st.bleed.stacks > 2 ? 2 : 1); i++) px(hx - 3 + i * 5, hy + 2 + ((f + i * 4) % 8), "#a22633");
    if (st.poisoned) px(hx + 2, hy + 2 + (f % 8), "#63c74d");
    if (st.stun) for (let i = 0; i < 3; i++) { const a = (reduce ? 0 : t * 6) + i * TAU / 3; px(d.x + Math.cos(a) * 6, d.y - d.head + Math.sin(a) * 2, "#fee761"); }
    if (st.mark) { const c = "#f6757a", s = 6; for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { px(hx + sx * s, hy + sy * s, c); px(hx + sx * (s - 1), hy + sy * s, c); px(hx + sx * s, hy + sy * (s - 1), c); } }
    if (st.blind) for (let x = -3; x <= 3; x++) px(d.x + x, d.y - d.eyes, OUT);
    if (st.weaken) { for (let i = 0; i < 4; i++) px(hx - 7, hy - 3 + i, "#b55088"); px(hx - 8, hy - 1, "#b55088"); px(hx - 6, hy - 1, "#b55088"); px(hx - 7, hy + 1, "#68386c"); }
    if (st.freeze && f % 4 === 0) px(hx + 3, hy - 6, "#ffffff");
    if (st.slow || st.sticky || d.chill) for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; if (i % 2) px(d.x + Math.cos(a) * (d.r + 1), d.y + Math.sin(a) * 3, "#2ce8f5"); }
    if (st.shock && (reduce || f % 2)) { px(hx + 4, hy - 4, "#fee761"); px(hx + 5, hy - 5, "#ffffff"); px(hx - 4, hy + 2, "#fee761"); }
  }

  // ------------------------------------------------------------------ the HUD
  const icon = (t, scale) => PF.canvasFor(t, { scale: scale || 2, shadow: false });
  const hud = { held: null, other: null, pip: -1, tag: null, p: -1, c: -1, on: null, x: -1, y: -1, ab: -1, hint: false };
  // a legend's ability button (design pass 10) carries its head class's own weapon, drawn at 1x
  const classWeapon = c => (window.FORGE_THINGS || []).find(t => t.kind === "weapon" && t.weapon && t.weapon.visual && t.weapon.visual.base === c);
  // the ram on the Strike button (section 3.14): an iron-capped log, drawn once
  let ramIconCanvas = null;
  function ramIcon() {
    if (ramIconCanvas) return ramIconCanvas;
    const rows = ["kkkk....................kkkk", "k22kkkkkkkkkkkkkkkkkkkkkk22k", "k23k1111111111111111111k32k", "k23kb222b222b222b222b22k32k", "k23k1bbb1bbb1bbb1bbb1bbk32k", "k22kkkkkkkkkkkkkkkkkkkkkk22k", "kkkk....................kkkk"];
    const cv = C.canvas(28, 7), g = cv.getContext("2d");
    C.paint(g, rows, { k: OUT, "1": "#733e39", "2": "#8b9bb4", "3": "#c0cbdc", b: "#b86f50" }, 0, 0);
    const out = C.canvas(56, 14); out.getContext("2d").imageSmoothingEnabled = false; out.getContext("2d").drawImage(cv, 0, 0, 56, 14);
    out.style.width = "52px"; out.style.height = "13px";
    return (ramIconCanvas = out);
  }
  function syncHud() {
    const k = fight.k, hand = fight.hands[k.active], ram = LEVEL && k.carry ? k.carry : null, t = ram ? ram.thing : hand.thing;
    // while a knight carries the ram it is the active weapon: Strike shows the ram, Swap the knight's own weapon (Swap puts the ram down)
    const other = ram ? hand.thing : fight.hands.length > 1 ? fight.hands[1 - k.active].thing : null;
    if (hud.held !== t.id) {
      hud.held = t.id;
      $("wName").textContent = t.name || t.id; $("wLine").textContent = ram ? (t.line || "SMASH · BREAKS GATES") : sentence(t);
      const sb = $("strikeBtn"); sb.replaceChildren(ram ? ramIcon() : icon(t, 2)); sb.insertAdjacentHTML("beforeend", '<i class="clock"></i><i class="glow"></i>');
      sb.setAttribute("aria-label", "Strike with " + (t.name || t.id));
      $("pips").hidden = true;   // design pass 10: no third blow and no pips; a legend's head is its ability
      // the gold button above Strike, only while a legend is in hand: the head's class weapon as its icon, the ability's words as its label
      const ab = $("abilityBtn"), ua = ram ? null : hand.ua;
      ab.hidden = !ua;
      if (ua) {
        const cw = classWeapon((t.weapon.visual || {}).fuse);
        ab.replaceChildren(cw ? icon(cw, 1) : document.createTextNode("✦")); ab.insertAdjacentHTML("beforeend", '<i class="clock"></i><i class="glow"></i>');
        ab.setAttribute("aria-label", ua.ability.name + ": " + ua.ability.line); ab.title = ua.ability.name;
        // the first legend of the visit: a note under the plate says where its ability is, for 3 s (in a level, a first-time line)
        if (!state.legendNoted) { state.legendNoted = true; if (LEVEL) firstTime("ability", "✦ " + ua.ability.name + " · the gold button above Strike"); else { state.noteUntil = state.t + 3; state.noteText = "✦ " + ua.ability.name + " · the gold button above Strike"; } }
      }
      hud.ab = -1;
      if (ua) syncAbility(hand);   // the clock of the hand now held, at once (a swap never shows the other hand's clock for a frame)
      hud.pip = -1; hud.p = -1; hud.c = -1;
    }
    const oid = other ? other.id : "";
    if (hud.other !== oid) {
      hud.other = oid;
      const sw = $("swapBtn");
      if (other) { sw.replaceChildren(icon(other, 1)); sw.setAttribute("aria-label", ram ? "Put the ram down for " + (other.name || other.id) : "Swap to " + (other.name || other.id)); } else { sw.textContent = "Swap"; sw.setAttribute("aria-label", "Swap: you carry one weapon"); }
      sw.classList.toggle("off", !other); sw.disabled = !other;   // one weapon: Swap is greyed
    }
    const tag = !ram && practice(t) ? "practice" : "";
    if (hud.tag !== tag) { hud.tag = tag; $("wTag").hidden = !tag; $("wTag").textContent = tag ? "⛓ practice only" : ""; }
    $("wSlow").hidden = !state.slow;
    const note = $("note"), text = LEVEL ? levelNote() : state.empty && state.loadout.length === 0 ? "Bring weapons from the Forge, or take one from the rack" : state.noteUntil > state.t ? state.noteText : "";
    note.hidden = !text; if (text) note.textContent = text;
    if (LEVEL) placeNote();
  }
  // in a level the note stays under the weapon plate unless it would touch one of the two plates (design pass 18: a long line on a small
  // phone); then it drops just under them. Measured in the HUD's own layout (offsets), so the turned game measures the same
  function placeNote() {
    const n = $("note"); n.style.top = "";
    if (n.hidden) return;
    const box = el => ({ x0: el.offsetLeft, y0: el.offsetTop, x1: el.offsetLeft + el.offsetWidth, y1: el.offsetTop + el.offsetHeight });
    const W = n.offsetParent ? n.offsetParent.clientWidth : 0, nw = n.offsetWidth, nb = { x0: W / 2 - nw / 2, x1: W / 2 + nw / 2, y0: n.offsetTop, y1: n.offsetTop + n.offsetHeight };
    const plates = [$("hpPlate"), $("objPlate")].filter(el => !el.hidden).map(box), touches = q => nb.x0 < q.x1 + 4 && nb.x1 > q.x0 - 4 && nb.y0 < q.y1 && nb.y1 > q.y0;
    if (plates.some(touches)) n.style.top = (Math.max.apply(null, plates.map(q => q.y1)) + 4) + "px";
  }
  // the level's note (section 3.14): the timed line by priority, else, with an empty loadout, the level's own line until the first wave
  function levelNote() {
    const L = state.lv;
    if (L.line && (L.line.until > state.t || L.line.kind === "downed")) return L.line.text;
    if (L.line) L.line = null;
    return state.empty && state.loadout.length === 0 && !L.waved ? LVN.empty : "";
  }
  // the ability's clock sweeps while it cools (--p in 40 steps); ready, the button pulses
  function syncAbility(hand) { const q = hand.acd > 0 ? Math.round((1 - hand.acd / (hand.acdOf || 1)) * 40) / 40 : 1; if (q !== hud.ab) { hud.ab = q; const ab = $("abilityBtn"); ab.style.setProperty("--p", String(q)); ab.classList.toggle("ready", q >= 1); } }
  // ------------------------------------------------------------------ the level's plates (design pass 18, sections 3.1 and 3.6)
  // the health plate: a 9 x 8 heart and a 56 x 6 bar drawn at 2x, the number. A blow leaves the lost part pale for 0.4 s, then it drains
  // at 60 HP a second; growing back the fill's two leading columns are green; at 30 or less the heart and the fill blink at 2 Hz (lit and
  // still under less motion); down, the bar is empty and the heart grey. Redrawn only when what it shows changes
  const HEART = [".........", "..rr.rr..", ".rlWrrrr.", ".rlrrrrR.", "..rrrRR..", "...rRR...", "....R....", "........."];
  const HPC = { r: "#e43b44", R: "#a22633", l: "#f6757a", W: "#ffffff", k: OUT };
  const hpv = { hp: -1, chip: 0, holdTo: 0, at: 0, key: "", heart: "", n: "" };
  function paintRows(cv, rows, pal) { const g = cv.getContext("2d"); g.clearRect(0, 0, cv.width, cv.height); for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) { const c = pal[rows[y][x]]; if (c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); } } }
  // the heart sealed in soot (its outline added round the rows), in its colours, greyed when down, its fill pale on the blink
  function heartRows(mode) { const W = 9, H = 8, at = (x, y) => x >= 0 && y >= 0 && x < W && y < H && HEART[y][x] !== "."; const out = [];
    for (let y = 0; y < H; y++) { let row = ""; for (let x = 0; x < W; x++) row += at(x, y) ? (mode === "down" ? (HEART[y][x] === "W" ? "g" : "G") : mode === "blink" ? (HEART[y][x] === "R" ? "r" : "W") : HEART[y][x]) : (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1) ? "k" : "."); out.push(row); }
    return out; }
  function syncHealth() {
    const plate = $("hpPlate"); if (!LEVEL) return;
    const k = fight.k, max = k.hpMax > 0 ? k.hpMax : 100, hp = Math.max(0, Math.min(max, k.hp || 0)), t = state.t, down = !!(k.down || k.out || hp <= 0);
    if (hpv.hp < 0) { hpv.hp = hp; hpv.chip = hp; hpv.at = t; }
    if (hp < hpv.hp - 1e-9) { hpv.chip = Math.max(hpv.chip, hpv.hp); hpv.holdTo = t + 0.4; }   // a blow: the chip keeps what the bar showed for 0.4 s
    hpv.hp = hp;
    if (hpv.chip < hp) hpv.chip = hp; else if (hpv.chip > hp && t >= hpv.holdTo) hpv.chip = Math.max(hp, hpv.chip - 60 * Math.max(0, t - hpv.at));
    hpv.at = t;
    const IN = 54, fill = hp > 0 ? Math.max(1, Math.round(IN * hp / max)) : 0, chip = Math.max(0, Math.round(IN * hpv.chip / max) - fill);
    const grow = !down && !!(Combat.regrowing && Combat.regrowing(k)), low = !down && hp <= (SPEC.knight.lowHp || 30), blink = low && !reduce && (Math.floor(state.t * 4) & 1) === 1;
    const key = fill + "|" + chip + "|" + (grow ? 1 : 0) + "|" + (blink ? 1 : 0) + "|" + (down ? 1 : 0) + "|" + (low ? 1 : 0);
    if (key !== hpv.key) {
      hpv.key = key;
      const g = $("hpBar").getContext("2d"); g.clearRect(0, 0, 56, 6); g.fillStyle = OUT; g.fillRect(0, 0, 56, 6);
      for (let x = 0; x < IN; x++) for (let y = 1; y <= 4; y++) {
        let c = x < fill ? (y === 1 ? "#f6757a" : y === 4 ? "#a22633" : "#e43b44") : x < fill + chip ? "#ead4aa" : "#3e2731";
        if (x < fill && grow && x >= fill - 2) c = y === 1 ? "#b4e67a" : y === 4 ? "#3e8948" : "#63c74d";
        if (x < fill && blink) c = y === 1 ? "#ffffff" : y === 4 ? "#e43b44" : "#f6757a";
        g.fillStyle = c; g.fillRect(x + 1, y, 1, 1);
      }
      const hm = down ? "down" : blink ? "blink" : "lit";
      if (hm !== hpv.heart) { hpv.heart = hm; paintRows($("hpHeart"), heartRows(hm), Object.assign({ g: "#8b9bb4", G: "#5a6988" }, HPC)); }
      plate.classList.toggle("grow", grow); plate.classList.toggle("low", low);
    }
    const n = String(down ? 0 : Math.min(999, Math.ceil(hp - 1e-9)));   // (a test's unkillable knight shows 999, not a run of nines)
    if (n !== hpv.n) { hpv.n = n; $("hpNum").textContent = n; plate.setAttribute("aria-label", "Health " + n + " of " + Math.round(max)); }
  }
  // the trolls-left plate: a troll's head and the count while a wave lives; a portcullis and the gate's share while it is to be broken;
  // hidden between the waves (Level.guide's left and gate)
  const TROLLHEAD = [".........", "..ggggg..", ".ggggggG.", ".gegggeG.", ".ggggggG.", ".gugggug.", "..gGGGg..", "...ggg...", "........."];
  const PORTCULLIS = [".........", ".sssssss.", ".S.S.S.S.", ".s.s.s.s.", ".SSSSSSS.", ".s.s.s.s.", ".S.S.S.S.", ".s.s.s.s.", "........."];
  const sealRows = rows => { const H = rows.length, W = rows[0].length, at = (x, y) => x >= 0 && y >= 0 && x < W && y < H && rows[y][x] !== "."; return rows.map((r, y) => Array.from(r).map((ch, x) => ch !== "." ? ch : at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1) ? "k" : ".").join("")); };
  const obv = { mode: "", n: "", bar: -1 };
  function syncObjective() {
    const plate = $("objPlate"); if (!LEVEL) return;
    const g = state.plank || state.left ? null : state.guide, mode = g && g.gate ? "gate" : g && g.left !== null && g.left !== undefined ? "trolls" : "";
    if (mode !== obv.mode) {
      obv.mode = mode; plate.hidden = !mode; obv.n = ""; obv.bar = -1; placeNote();
      if (mode === "trolls") { paintRows($("objIcon"), sealRows(TROLLHEAD), { g: "#63c74d", G: "#3e8948", e: "#fee761", u: "#ead4aa", k: OUT }); $("objBar").hidden = true; $("objNum").hidden = false; }
      if (mode === "gate") { paintRows($("objIcon"), sealRows(PORTCULLIS), { s: "#8b9bb4", S: "#5a6988", k: OUT }); $("objBar").hidden = false; $("objNum").hidden = true; }
    }
    if (mode === "trolls") { const n = String(g.left); if (n !== obv.n) { obv.n = n; $("objNum").textContent = n; plate.setAttribute("aria-label", n + (g.left === 1 ? " troll left" : " trolls left")); } }
    if (mode === "gate") { const f = Math.round(26 * Math.max(0, g.gate.hp) / Math.max(1, g.gate.hpMax)); if (f !== obv.bar) { obv.bar = f; const c = $("objBar").getContext("2d"); c.fillStyle = OUT; c.fillRect(0, 0, 28, 6); for (let x = 0; x < 26; x++) for (let y = 1; y <= 4; y++) { c.fillStyle = x < f ? (y === 1 ? "#f6757a" : y === 4 ? "#a22633" : "#e43b44") : "#3e2731"; c.fillRect(x + 1, y, 1, 1); } plate.setAttribute("aria-label", "The gate: " + Math.ceil(g.gate.hp) + " of " + Math.round(g.gate.hpMax)); } }
  }
  // what changes every frame: a legend's ability clock, the recovery clock, the charge, the held button, the prompt's place
  function syncLive() {
    const k = fight.k, hand = fight.hands[k.active];
    if (LEVEL) { syncHealth(); syncObjective(); const burning = !!k.burn && !k.down && !k.out; if (burning !== hud.hint) { hud.hint = burning; $("dodgeBtn").classList.toggle("hint", burning); } }
    if (hand.ua) syncAbility(hand);
    if (state.noteUntil && state.t >= state.noteUntil) { state.noteUntil = 0; syncHud(); }   // the first-legend note is over
    if (LEVEL && state.lv.line && state.lv.line.kind !== "downed" && state.lv.line.until <= state.t) syncHud();   // a timed line is over
    const of = hand.recoverOf || 1, p = hand.recover > 0 ? Math.round((1 - hand.recover / of) * 40) / 40 : 1;
    if (p !== hud.p) { hud.p = p; $("strikeBtn").style.setProperty("--p", String(p)); }
    const c = k.charging ? Math.round(clamp(k.chargeT / SPEC.modifiers.charge.time, 0, 1) * 20) / 20 : 0;
    if (c !== hud.c) { hud.c = c; $("strikeBtn").style.setProperty("--c", String(c)); }
    const on = !!(fight.input && fight.input.strike);
    if (on !== hud.on) { hud.on = on; $("strikeBtn").classList.toggle("on", on); }
    // the prompt floats over the knight's screen feet (lifted by its height, the camera taken off) and is clamped to the HUD's box (the
    // game's width inside the safe-area insets); its half width is measured when its text changes (syncPrompt), not every frame
    if (state.zone) { const L = state.layout, [camX, camY] = cam(), pr = $("prompt"), half = hud.half || 40, wide = (L.gw || L.w) - L.pl - (L.pr || 0);
      const x = Math.round(clamp(L.x - L.pl + (k.x - camX) * L.s, half, wide - half)), y = Math.round(L.y - L.pt + (k.y - (k.z || 0) - camY - 36) * L.s);
      if (x !== hud.x || y !== hud.y) { hud.x = x; hud.y = y; pr.style.left = x + "px"; pr.style.top = Math.max(76, y) + "px"; } }
  }
  let toastTimer = 0;
  const toasts = [];
  function toast(m) { const el = $("toast"); el.textContent = m; el.classList.add("show"); window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => el.classList.remove("show"), 3000); toasts.push(m); }

  // ------------------------------------------------------------------ the planks: the first visit, the rack, the menu; the level's (section 3.14)
  const VEILS = { first: "firstVeil", rack: "rackVeil", menu: "menuVeil", gate: "gateVeil", ask: "askVeil", tally: "tallyVeil" };
  const STAYS = ["first", "tally"];   // planks a tap outside does not close: the first visit, and the tally (the run is over)
  function openPlank(which) {
    if (state.left || !VEILS[which]) return;
    closePlank();
    state.plank = which;
    input.strike = false; input.keys = {}; stickUp();
    if (which === "rack") renderRack();
    if (which === "menu") renderMenu();
    if (which === "gate") renderGate();
    $(VEILS[which]).hidden = false;
    const focus = $(VEILS[which]).querySelector("button"); if (focus && !coarse) focus.focus();
  }
  function closePlank() {
    if (!state.plank) return;
    if (state.plank === "tally") return;   // the run is over: the tally stays until Back to the Forge or Again
    $(VEILS[state.plank]).hidden = true;
    if (state.plank === "first") store.set(LEVEL ? KEYS.gateSeen : KEYS.seen, "1");
    state.plank = null; last = window.performance.now(); acc = 0;
    if (document.activeElement && document.activeElement !== document.body && document.activeElement.blur) document.activeElement.blur();
  }
  $("firstGo").addEventListener("click", closePlank);
  for (const [which, id] of Object.entries(VEILS)) $(id).addEventListener("click", e => { if (e.target === $(id) && !STAYS.includes(which)) closePlank(); });
  // the rack: your weapons as a grid of sprites with their names, newest first, with class chips to filter
  const rackView = { cls: null };
  function renderRack() {
    const list = $("rackList"), chips = $("rackChips");
    const all = rack.map(id => world.get(id)).filter(Boolean), classes = Array.from(new Set(all.map(classOf)));
    if (rackView.cls && !classes.includes(rackView.cls)) rackView.cls = null;
    chips.replaceChildren();
    if (classes.length > 1) for (const c of [null].concat(classes)) {
      const b = document.createElement("button"); b.textContent = c || "all"; b.setAttribute("aria-pressed", String(rackView.cls === c));
      b.addEventListener("click", () => { rackView.cls = c; renderRack(); }); chips.appendChild(b);
    }
    const shown = all.filter(t => !rackView.cls || classOf(t) === rackView.cls);
    $("rackCount").textContent = shown.length === all.length ? all.length + " weapons" : shown.length + " of " + all.length;
    list.replaceChildren();
    const inHand = fight.hands.map(h => h.thing.id);
    for (const t of shown) {
      const b = document.createElement("button"), chained = practice(t), held = inHand.indexOf(t.id);
      b.className = "rw f-slot" + (chained ? " chained" : "") + (held === fight.k.active ? " held" : "");
      b.appendChild(icon(t, 2));
      const n = document.createElement("b"); n.textContent = t.name || t.id; b.appendChild(n);
      const s = document.createElement("span"); s.textContent = chained ? "practice only" : held === fight.k.active ? "in hand" : held >= 0 ? "other hand" : classOf(t); b.appendChild(s);
      b.title = (t.name || t.id) + " · " + sentence(t);
      b.setAttribute("aria-label", (t.name || t.id) + (chained ? ", chained: practice only" : "") + (held === fight.k.active ? ", in hand" : ""));
      b.addEventListener("click", () => { if (Date.now() - rackDrag.at < 350) return; pick(t.id); closePlank(); });   // (a drag of the list is not a tap)
      list.appendChild(b);
    }
    if (!shown.length) list.insertAdjacentHTML("beforeend", '<div class="empty">Nothing on the rack.</div>');
  }
  // put a weapon of the rack in the active hand; a chained one is practice only and never becomes the loadout. A knight that carries
  // one weapon takes it in the free hand instead (the stand-in Sword of an empty loadout is not a weapon carried: it is replaced)
  const slots = first.slots;   // what each hand gives back to the loadout: the last weapon in it that was not practice only
  function pick(id) {
    const t = world.get(id);
    if (!t) return false;
    const k = fight.k, other = fight.hands.length > 1 ? 1 - k.active : -1;
    if (fight.hands[k.active].thing.id === id) return true;
    if (other >= 0 && fight.hands[other].thing.id === id) { k.active = other; k.swapT = SPEC.knight.swap; k.strike = null; syncHud(); writeBack(); return true; }   // it is in the other hand: the hands swap
    let i = k.active;
    if (fight.hands.length === 1 && !state.empty) { i = Combat.addHand(fight, t); k.active = i; k.swapT = SPEC.knight.swap; k.strike = null; slots[i] = null; }
    else Combat.setHand(fight, i, t);
    if (!practice(t)) { slots[i] = id; state.empty = false; }
    state.loadout = slots.filter(Boolean);
    syncHud(); writeBack();
    toast(practice(t) ? (t.name || id) + ": practice only, it stays in the cellar" : (t.name || id) + " in hand");
    return true;
  }
  $("rackClose").addEventListener("click", closePlank);
  // the rack's list is dragged by the thumb in the game's own space, so it scrolls the same way when the game is turned a quarter
  const rackDrag = { id: null, y: 0, top: 0, moved: 0, at: 0 };
  (function dragScroll(list) {
    list.addEventListener("pointerdown", e => { if (e.pointerType === "mouse") return; rackDrag.id = e.pointerId; rackDrag.y = toGame(e.clientX, e.clientY)[1]; rackDrag.top = list.scrollTop; rackDrag.moved = 0; });
    list.addEventListener("pointermove", e => { if (rackDrag.id !== e.pointerId) return; const d = toGame(e.clientX, e.clientY)[1] - rackDrag.y; rackDrag.moved = Math.max(rackDrag.moved, Math.abs(d)); if (rackDrag.moved > 6) list.scrollTop = rackDrag.top - d; });
    for (const ev of ["pointerup", "pointercancel"]) list.addEventListener(ev, e => { if (rackDrag.id !== e.pointerId) return; rackDrag.id = null; if (rackDrag.moved > 6) rackDrag.at = Date.now(); });
  })($("rackList"));
  // the menu: the cellar's seven rows; in a level (section 3.14) the title is the level's, a line under it counts the satchel, Slow time and
  // Reset the dummies do not show, and the ember button goes back to the gate
  function renderMenu() {
    const set = (id, on) => { const b = $(id); b.setAttribute("aria-pressed", String(on)); b.querySelector("span").textContent = on ? "on" : "off"; };
    set("mReach", state.reach); set("mSlow", state.slow); set("mLefty", state.lefty);
    $("mForced").hidden = !state.forced;
    if (LEVEL) { const n = state.lv.things.length; $("mSatchel").hidden = false; $("mSatchel").textContent = "Satchel: " + n + (n === 1 ? " thing" : " things"); }
  }
  if (LEVEL) { $("menuTitle").textContent = AREA.name || "The Troll Gate"; $("mSlow").hidden = true; $("mReset").hidden = true; $("mClose").firstChild.textContent = "Back to the gate"; $("menuBtn").setAttribute("aria-label", "The gate's menu"); $("menuBtn").title = "The gate's menu"; }
  $("menuBtn").addEventListener("click", () => openPlank("menu"));
  $("mReach").addEventListener("click", () => { state.reach = !state.reach; renderMenu(); });
  $("mSlow").addEventListener("click", () => { state.slow = !state.slow; renderMenu(); syncHud(); });
  $("mLefty").addEventListener("click", () => { state.lefty = !state.lefty; store.set(KEYS.lefty, state.lefty ? "1" : "0"); fit(); renderMenu(); });
  $("mReset").addEventListener("click", () => { reset(); closePlank(); toast("The dummies stand as they were"); });
  $("mForced").addEventListener("click", () => { setForced(false); closePlank(); });
  $("mForge").addEventListener("click", () => askLeave("forge"));
  $("mHome").addEventListener("click", () => askLeave("menu"));
  $("mClose").addEventListener("click", closePlank);
  $("upBtn").addEventListener("click", () => askLeave("forge"));
  $("homeBtn").addEventListener("click", () => askLeave("menu"));
  function clearFx() { state.fx = []; state.nums = []; state.parts = []; state.rings = []; state.sums = {}; state.heal = { n: 0, at: state.t }; state.hold = 0; state.shake = { t: 0, amp: 0 }; state.trail = []; }
  function reset() { Combat.reset(fight); clearFx(); }
  // the gate plate (section 3.14), opened from the door on the cellar's left wall: Go alone, Bring sword-brothers 1 to 3 (the last choice
  // remembered), Back to the cellar; Raise and Join a party wait for the second build; "Cleared" once the smith has cleared it
  function renderGate() {
    const smith = (handoff && handoff.smith) || {}, cleared = !!(smith.cleared && smith.cleared["castle-gate"]), last = clamp(parseInt(store.get(KEYS.brothers), 10) || 0, 0, 3);
    $("gateLine").innerHTML = "Normal" + (cleared ? ' · <b>Cleared</b>' : "");
    $("gateAlone").setAttribute("aria-pressed", String(last === 0));
    for (const n of [1, 2, 3]) $("gateB" + n).setAttribute("aria-pressed", String(last === n));
    $("gateParty").hidden = true;
  }
  $("gateAlone").addEventListener("click", () => go(0));
  for (const n of [1, 2, 3]) $("gateB" + n).addEventListener("click", () => go(n));
  $("gateBack").addEventListener("click", closePlank);
  // Leave the gate? (section 3.8): Leave banks the satchel and goes; Stay closes the plank
  $("askLeave").addEventListener("click", () => leave(state.askTo || "forge"));
  $("askStay").addEventListener("click", closePlank);
  // the tally (section 3.11.5): the time, the trolls felled and the huts and engines wrecked, the brothers who came, the finds as icons at x 2
  // with NEW on a first find, the pay (the Legend Ember's chances are rolled at the Forge), a level-up; visiting, or with storage blocked,
  // the finds could not be carried home
  function renderTally() {
    const L = state.lv, sent = L.sent || {}, secs = Math.max(0, Math.round(L.clearT || fight.t)), mm = Math.floor(secs / 60), ss = String(secs % 60).padStart(2, "0");
    $("tallyTime").textContent = "The old road to the castle in " + mm + ":" + ss + ".";
    const parts = ["You felled " + L.felled + (L.felled === 1 ? " troll" : " trolls")];
    if (L.huts || L.engines) parts.push("wrecked " + [L.huts ? L.huts + (L.huts === 1 ? " hut" : " huts") : null, L.engines ? L.engines + (L.engines === 1 ? " engine" : " engines") : null].filter(Boolean).join(" and "));
    $("tallyFelled").textContent = parts.join(" and ") + ".";
    const bros = fight.knights.filter(k => k.kind === "brother").map(k => k.name).filter(Boolean);
    $("tallyWith").hidden = !bros.length; if (bros.length) $("tallyWith").textContent = "With " + (bros.length > 1 ? bros.slice(0, -1).join(", ") + " and " + bros[bros.length - 1] : bros[0]);
    const carried = sent.ok === true;
    $("tallyFindsLine").textContent = carried ? "Your finds" : "Your finds could not be carried home";
    const row = $("tallyFinds"), counts = {}; for (const id of L.things) counts[id] = (counts[id] || 0) + 1;
    row.replaceChildren();
    for (const id of Object.keys(counts)) { const t = ingredient(id); if (!t) continue; const d = document.createElement("div"); d.className = "find"; d.title = t.name; d.appendChild(icon(t, 2)); const s = document.createElement("span"); s.textContent = t.name + (counts[id] > 1 ? " ×" + counts[id] : ""); d.appendChild(s); if (!found.has(id)) { const n = document.createElement("i"); n.textContent = "NEW"; d.appendChild(n); } row.appendChild(d); }
    if (!L.things.length) row.insertAdjacentHTML("beforeend", '<div class="none">Nothing dropped this time.</div>');
    const pay = window.Coin && Coin.runPay ? Coin.runPay(AREA.level || 1, !!AREA.boss, clearedBefore, L.finds) : null, smith = (handoff && handoff.smith) || {};
    $("tallyPay").textContent = !carried ? (sent.why === "visiting" ? "You came without the Forge, so nothing is paid." : "The finds could not be saved, so nothing is paid.") : pay ? pay.xp + " XP and " + pay.coins + " coins" + (clearedBefore ? " (a replay)" : "") + (L.finds.iron_chests || L.finds.rare_enemies ? " · the Forge rolls for a Legend Ember" : "") : "";
    const up = carried && pay && window.Progress && typeof smith.xp === "number" && typeof smith.level === "number" ? Progress.levelFor(smith.xp + pay.xp) : null;
    $("tallyLevel").hidden = !(up && up > smith.level); if (up && up > smith.level) $("tallyLevel").textContent = "Level " + up + "!";
  }
  $("tallyForge").addEventListener("click", () => leave("forge"));
  $("tallyAgain").addEventListener("click", again);

  // ------------------------------------------------------------------ the turn plate
  function setForced(on) { state.forced = !!on; if (on) store.set(KEYS.forced, "1"); else store.del(KEYS.forced); fit(); last = window.performance.now(); acc = 0; }
  $("tForce").addEventListener("click", () => setForced(true));
  $("tForge").addEventListener("click", () => leave("forge"));   // (the turn plate covers the page, so its ways out bank and go without asking)
  $("tHome").addEventListener("click", () => leave("menu"));
  $("tFull").addEventListener("click", () => {
    try { const p = document.documentElement.requestFullscreen(); if (p && p.then) p.then(lockLandscape).catch(() => {}); } catch (e) { /* this browser doesn't go full screen */ }
  });
  (function turnPhone() {
    // a pixel phone tipping onto its side, on two frames
    const cv = $("turnPhone"), g = cv.getContext("2d");
    const phone = sideways => {
      g.clearRect(0, 0, 32, 32);
      const w = sideways ? 22 : 12, h = sideways ? 12 : 22, x0 = 16 - w / 2, y0 = 16 - h / 2;
      g.fillStyle = OUT; g.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
      g.fillStyle = "#5a6988"; g.fillRect(x0, y0, w, h);
      g.fillStyle = "#231c2e"; g.fillRect(x0 + 2, y0 + 2, w - 4, h - 4);
      g.fillStyle = "#f77622"; g.fillRect(x0 + (sideways ? 4 : 3), y0 + (sideways ? 5 : 8), 2, 2);
      g.fillStyle = "#8b9bb4"; if (sideways) g.fillRect(x0 + w - 2, y0 + 5, 1, 2); else g.fillRect(x0 + 5, y0 + h - 2, 2, 1);
      if (!sideways) { g.fillStyle = "#fee761"; for (let i = 0; i < 5; i++) g.fillRect(24 + Math.round(3 * Math.cos(-1.2 + i * 0.5)), 8 + Math.round(3 * Math.sin(-1.2 + i * 0.5)), 1, 1); g.fillRect(26, 11, 1, 1); g.fillRect(27, 10, 1, 1); }
    };
    phone(false);
    if (!reduce) { let s = false; window.setInterval(() => { if ($("turnPlate").hidden) return; s = !s; phone(s); }, 1000); }
  })();

  // ------------------------------------------------------------------ boot
  function refit() { fit(); hud.x = -1; if (LEVEL) placeNote(); }
  window.addEventListener("resize", refit);
  window.addEventListener("orientationchange", refit);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", refit);
  document.addEventListener("fullscreenchange", refit);
  document.addEventListener("visibilitychange", () => { last = window.performance.now(); acc = 0; if (document.hidden) { input.strike = false; input.keys = {}; stickUp(); } });
  // the harness's handle on the screen
  window.TheBattlegrounds = {
    // (input(o): a plain object stands for the thumbs until changed; a function is a driver, called once a step with dt, its answer the thumbs' input)
    state, world, toasts, markSeen() { return store.set(LEVEL ? KEYS.gateSeen : KEYS.seen, "1"); }, lessons: null, input(o) { input.test = typeof o === "function" ? o : o ? Object.assign({}, o) : null; }, pick, reset, leave, use, fit, openPlank, closePlank, setForced, toGame, writeBack, syncHud, cam, scene, VIEW, AREA, LEVEL,
    // a level (design pass 12): the run's id, the satchel's state, the way home, the clear, the adapter over the director's state, a synthetic event
    runId, go, again, finish, sendHome, askLeave, LV, pickup, firstTime, note, get lv() { return state.lv; }, get guide() { return state.guide; }, take(events) { take(Array.isArray(events) ? events : [events]); },
    get fight() { return fight; }, get rack() { return rack.slice(); }, get paused() { return paused(); },
    // move time on by ms (in steps of 1/60 s); while the game is paused, time doesn't move
    step(ms) { let n = 0; const want = Math.round(ms / 1000 / STEP); for (let i = 0; i < want; i++) { if (paused()) break; tick(); n++; } flushSums(false); draw(); return n; },
    stick(cx, cy, dx, dy) { const [gx, gy] = toGame(cx, cy), [hx, hy] = toGame(cx + dx, cy + dy); input.stick = { id: -1, cx: gx, cy: gy }; stickTo(hx, hy); return [input.sx, input.sy]; },
    draw
  };
  // a level: the first two column tiles are baked whole behind the fade (the rest in slices while the party walks); ?perf=stress builds the
  // worst case for the frame in arena 3's lower screen (done criterion 17): three sword-brothers, the alive cap of trolls and the roar
  // footmen round the Stilt Camp and its tower, thinking and fighting (fight.brains), six more trolls above the view for the edge marks,
  // every mark kind at its cap (the marks are stood in for until the rules keep them), the camera on them
  if (LEVEL) { scene.tiles.finish(0); scene.tiles.finish(1); if (perf === "stress") stress(); }
  function stress() {
    const W = fight.world, P = window.Physics, caps = SPEC.caps, k = fight.k;
    Combat.setView(fight, 1536, 216); Combat.place(fight, k, 1660, 300);
    fight.knights.slice(1).forEach((b, i) => Combat.place(fight, b, 1640 + i * 14, 320 + i * 12));
    state.arrive = 0;
    const kinds = ["footman", "footman", "footman", "footman", "footman", "footman", "footman", "footman", "footman", "firestaff", "archer", "icearcher", "brute", "rockbrute", "winchman"];
    const spots = [[1600, 260], [1640, 340], [1700, 300], [1760, 320], [1800, 350], [1840, 300], [1870, 260], [1620, 400], [1700, 400], [1560, 330], [1700, 260], [1860, 400], [1600, 370], [1800, 390], [1740, 240]];
    kinds.forEach((kind, i) => Combat.spawn(fight, kind, spots[i][0], spots[i][1], { tell: 0 }));
    if (fight.foes.length < kinds.length + 1) Combat.spawn(fight, "archer", 1770, 250, { tell: 0, on: "towerDeck" });
    for (let i = 0; i < 6; i++) Combat.spawn(fight, "footman", 1560 + i * 60, 120 + (i % 2) * 40, { tell: 0 });   // off the screen, above the view and inside the world: the edge marks
    fight.brains = true;   // the trolls think, path and wind up, as the director has them do in a wave
    const rm = Combat.rng(1210), pick = (x0, x1, y0, y1) => [x0 + Math.floor(rm() * (x1 - x0)), y0 + Math.floor(rm() * (y1 - y0))], mk = (kind, n, r, life, extra) => { const out = []; for (let i = 0; i < n; i++) { const [x, y] = pick(1550, 1900, 230, 420); out.push(Object.assign({ id: i + 1, kind, x, y, z: 0, r, t: rm() * life * 0.8, life, side: "troll" }, extra ? extra(x, y, i) : {})); } return out; };
    const M = fight.marks;
    if (M) {
      // the rules' own marks at every cap (done criterion 17), made by the rules' makers: fire, ice and puddles each on a band of their own
      // (a fire melts the ice it touches, a puddle quenches a fire), craters over the whole stretch, the chunks of one burst, the stones in
      // flight, the arrows stuck on a piece; a maker that merges or refuses a spot is simply tried at another
      // (the craters first, since a crater removes the live patches it opens under; then the patches on a lattice wider than their merge
      // reach, so none merges into its neighbour, with random spots in the same band for any the makers refuse)
      const fill = (list, cap, x0, x1, y0, y1, d, make) => {
        const spots = []; for (let y = y0 + d / 2; y < y1; y += d) for (let x = x0 + d / 2; x < x1; x += d) spots.push([Math.round(x + (rm() - 0.5) * 4), Math.round(y + (rm() - 0.5) * 4)]);
        for (let i = 0; i < spots.length + cap * 8 && list.length < cap; i++) { const [x, y] = i < spots.length ? spots[i] : pick(x0, x1, y0, y1); make(x, y); } };
      fill(M.crater, caps.craters || 24, 1550, 1900, 230, 420, 34, (x, y) => Combat.crater(fight, x, y, 14, 10, { side: "troll" }));
      fill(M.fire, caps.worldFire || 12, 1550, 1660, 230, 420, 26, (x, y) => Combat.fire(fight, x, y, 10, 4, "troll"));
      fill(M.ice, caps.ice || 16, 1672, 1790, 230, 420, 26, (x, y) => Combat.ice(fight, x, y, 10, 8, "troll"));
      fill(M.puddle, caps.puddles || 16, 1802, 1900, 230, 420, 22, (x, y) => Combat.puddle(fight, x, y, 8, 20, "world"));
      Combat.chunks(fight, 1720, 330, 0, null, { n: [caps.chunks || 24, caps.chunks || 24], dist: [16, 70], flight: [0.6, 0.8], shadow: 3, damageKnight: 2, damageTroll: 4, push: 4, clodEvery: 3 }, "troll", false);
      for (let i = 0; i < (caps.stones || 4); i++) Combat.throwStone(fight, [1500, 300], { x: 1600 + i * 80, y: 260 + (i % 2) * 100, z: 0, on: null }, { engine: "treb4", seat: 0 });
      const piece = fight.pieces.find(p => p.kind === "hut") || fight.pieces[0];
      if (piece) for (let i = 0; i < (caps.stuckOnPieces || 32); i++) { const [x, y] = pick(1550, 1900, 230, 420); Combat.stuck(fight, x, y, 0, null, piece, "arrow"); }
    } else state.stress = { marks: { fire: mk("fire", caps.worldFire || 12, 10, 4), ice: mk("ice", caps.ice || 16, 10, 8), puddle: mk("puddle", caps.puddles || 16, 8, 20), crater: [], clod: [],
      chunk: mk("chunk", caps.chunks || 24, 2, 0.7, (x, y, i) => ({ x0: x - 30, y0: y - 10, clod: i % 3 === 0 })), stone: mk("stone", 2, 16, 2, (x, y) => ({ x0: x - 200, y0: y - 40, z0: 40, peak: 80 })), stuck: mk("stuck", caps.stuckOnPieces || 32, 1, 1e9, () => ({ piece: 1 })) } };
    if (!M) for (let i = 0; i < (caps.craters || 24); i++) { const [x, y] = pick(1550, 1900, 230, 420); if (P.crater) P.crater(W, x, y, 14, 10); scene.stamp({ type: "mark", kind: "crater", id: i, x, y, z: 0, r: 14 }); }
    for (let i = 0; i < (caps.clods || 24); i++) { const [x, y] = pick(1550, 1900, 230, 420); P.addSolid(W, { kind: "clod", shape: "c", x, y, r: 4, ht: 6 }); }
    for (let i = 0; i < 40; i++) { const [x, y] = pick(1550, 1900, 230, 420); scene.stamp({ type: "mark", kind: i % 2 ? "scorch" : "rubble", id: i, x, y, z: 0, r: 6 + (i % 5) }); }
    fight.tdirty = true;
  }
  lockLandscape();
  fit();
  syncHud(); syncPrompt();
  // the first-visit plank: the cellar's, or the level's in the same frame (section 3.14), its key line for a keyboard or for thumbs
  if (LEVEL) {
    $("firstPlank").setAttribute("aria-label", AREA.name || "The Troll Gate"); $("firstPlank").querySelector("h2").textContent = AREA.name || "The Troll Gate";
    $("firstPlank").querySelector("p").textContent = "Trolls hurt here. Fight east to the castle, and break its gate.";
    // (design pass 18) the plates, and one line that says them once
    game.classList.add("level"); $("hpPlate").hidden = false; placeNote();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => placeNote(), () => {});   // (the plates and the note change width once the font is in)
    const line = document.createElement("p"); line.className = "small"; line.id = "guideLine"; line.textContent = "The red bar top left is your health: it grows back while nothing hits you. Follow the yellow arrows."; $("firstPlank").querySelector("p").after(line);
    $("firstGo").textContent = "Onto the old road";
    $("stage").setAttribute("aria-label", "The Troll Gate: a dusk field two screens deep before a troll castle; knights among trolls, wire, stakes, huts and trenches");
  }
  if (state.visiting) { const v = $("visitLine"); v.hidden = false; v.textContent = LEVEL ? "You came without weapons from the Forge: you carry the Sword and the Bow, and your finds cannot be carried home." : "You came without weapons from the Forge, so the rack holds the twenty class weapons and the world's forged weapons."; }
  if (!coarse) { $("keyWalk").textContent = "W A S D or the arrows"; $("keyStrike").textContent = "J or Space"; $("keySwap").textContent = "K"; $("keyDodge").textContent = "L or Shift"; $("keyLine").textContent = LEVEL ? "E takes up what lies on the field and goes into the castle. Esc opens the menu." : "E uses the rack, the stairs and the Troll Gate's door. U: a legend's ability. Esc opens the cellar's menu."; }
  else { $("keyLine").textContent = LEVEL ? "Tap the prompt over your knight to take up what lies on the field, and to go into the castle." : "Under the rack on the wall you can take any weapon you own. The stairs lead back up. The door on the left goes to the Troll Gate."; if (LEVEL) $("keyDodge").textContent = "a roll past a blow"; }   // (the cellar's "through the bag" is the cellar's)
  // (build 8) with the cellar's lessons running, his words take the first visit's place: the plank waits, and is marked seen when they end
  const lessons = lessonOn("boot") === true;
  if (!lessons && params.get("seen") !== "1" && (store.get(LEVEL ? KEYS.gateSeen : KEYS.seen) !== "1" || params.get("fresh") === "1")) openPlank("first");
  draw();
  state.booted = true;
  document.body.setAttribute("data-booted", "1");
  document.body.setAttribute("data-errors", String((window.__errors || []).length));
  window.requestAnimationFrame(() => { $("fade").classList.remove("on"); });
  if (reduce || harness) $("fade").classList.remove("on");
  last = window.performance.now();
  window.requestAnimationFrame(frame);
})();
