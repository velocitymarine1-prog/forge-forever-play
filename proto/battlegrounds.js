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
// For the harness (tools/battle-harness.html): ?harness=1 lets time move only through TheBattlegrounds.step(ms); ?seed=n fixes the
// fight; ?weapons=a,b picks the loadout; ?pointer=coarse|fine overrides the pointer; ?fresh=1 shows the first-visit plank again and
// ?seen=1 skips it; ?motion=reduce stills the room; ?stay=1 leaves without going anywhere.
(function () {
  "use strict";
  const PF = window.PixelForge, C = window.Cellar, Combat = window.Combat, SPEC = window.FORGE_COMBAT, AREA = window.FORGE_CELLAR, Smithy = window.Smithy;
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const media = q => !!(window.matchMedia && window.matchMedia(q).matches);
  // less motion: the phone's setting, the game's own switch (forge-forever:less-motion, design pass 9) or ?motion=reduce
  const reduce = window.Settings ? Settings.reduce() : (params.get("motion") ? params.get("motion") === "reduce" : media("(prefers-reduced-motion: reduce)"));
  const harness = params.get("harness") === "1", stay = params.get("stay") === "1";
  const coarse = params.get("pointer") ? params.get("pointer") === "coarse" : media("(pointer: coarse)");
  const STEP = SPEC.step, W = AREA.w, H = AREA.h, OUT = C.OUT, TAU = Math.PI * 2, FEEL = SPEC.feel, CHEST = SPEC.knight.chest;
  const KEYS = { to: "forge-forever:to-cellar", from: "forge-forever:from-cellar", seen: "forge-forever:cellar-seen", forced: "forge-forever:forced-landscape", lefty: "forge-forever:left-handed" };
  // storage is a convenience: the cellar works without it, and nothing is remembered
  const store = {
    get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { window.localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del(k) { try { window.localStorage.removeItem(k); } catch (e) { /* nothing to forget */ } }
  };
  const nowIso = () => new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
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
    t: 0, arrive: reduce ? 0 : AREA.knight.arrive, lit: reduce ? 3 : 0, hold: 0, shake: { t: 0, amp: 0 }, fx: [], nums: [], parts: [], rings: [], sums: {}, heal: { n: 0, at: 0 }, trail: [],
    plank: null, turned: false, left: false, leftTo: null, went: null, tookBack: false, stairs: 0, zone: null, booted: false, layout: { x: 0, y: 0, s: 1, k: 1, w: W, h: H, pl: 0, pt: 0 }, frames: 0, log: [],
    legendNoted: false, noteUntil: 0, noteText: "" };   // the first legend of the visit: a note under the plate for 3 s (design pass 10)
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
  let fight = Combat.newFight(AREA, first.hands, seed);
  fight.k.active = first.active;
  const scene = new C.Scene(AREA);
  const stage = $("stage"), ctx = stage.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const game = $("game");
  // the screen's own random numbers (particles, the shake): drawing never touches the fight's
  const rnd = Combat.rng((seed ^ 0x9e3779b9) >>> 0);

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
    writeBack();
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { /* nothing was locked */ }
    try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); } catch (e) { /* not full screen */ }
    $("fade").classList.add("on");
    const go = () => {
      const url = to === "menu" ? menuUrl() : forgeUrl();
      state.leftTo = url;
      state.went = window.Nav ? Nav.go(to, url, { stay }) : { to, url, how: "push" };
      if (stay || window.Nav) return;
      window.location.href = url;
    };
    if (reduce || harness) go(); else setTimeout(go, 260);
  }
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
    const availW = gw - pl - pr, availH = gh - pt - pb, dpr = window.devicePixelRatio || 1;
    const k = Math.max(1, Math.floor(Math.min(availW / W, availH / H) * dpr));
    const cw = W * k / dpr, ch = H * k / dpr;
    stage.style.width = cw + "px"; stage.style.height = ch + "px";
    state.layout = { x: pl + (availW - cw) / 2, y: pt + (availH - ch) / 2, s: k / dpr, k, w: cw, h: ch, pl, pt, gw, gh, vw: v.w, vh: v.h, dpr };
    // a phone held upright gets the turn plate, and the game waits
    const plate = portrait && coarse && !state.forced;
    $("turnPlate").hidden = !plate;
    state.plate = plate;
    const canFull = !!(document.documentElement.requestFullscreen && screen.orientation && screen.orientation.lock);
    $("tFull").hidden = !canFull;
    $("mForced").hidden = !state.forced;
    return state.layout;
  }
  function lockLandscape() { try { const o = screen.orientation; if (o && o.lock) { const p = o.lock("landscape"); if (p && p.catch) p.catch(() => {}); } } catch (e) { /* this browser doesn't lock */ } }
  // a point of the viewport in the game's own space (turned back when the game is turned)
  const toGame = (cx, cy) => state.turned ? [cy, state.layout.vw - cx] : [cx, cy];
  const paused = () => !!(state.plank || state.plate || document.hidden || state.left);

  // ------------------------------------------------------------------ input: the stick, the buttons, the keyboard
  const input = { stick: null, sx: 0, sy: 0, strike: false, swap: false, dodge: false, ability: false, keys: {}, test: null };
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
    const K = input.keys, T = input.test;
    let mx = input.sx, my = input.sy;
    if (!input.stick) { mx = (K.right ? 1 : 0) - (K.left ? 1 : 0); my = (K.down ? 1 : 0) - (K.up ? 1 : 0); const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; } }
    const inp = { move: [mx, my], strike: input.strike || !!K.strike, swap: input.swap, dodge: input.dodge, ability: input.ability };
    input.swap = false; input.dodge = false; input.ability = false;   // Swap, Dodge and the ability are passed once, a press each
    if (T) { if (T.move) inp.move = T.move; if (T.strike !== undefined) inp.strike = !!T.strike; if (T.swap) { inp.swap = true; T.swap = false; } if (T.dodge) { inp.dodge = true; T.dodge = false; } if (T.ability) { inp.ability = true; T.ability = false; } if (T.target !== undefined) inp.target = T.target; if (T.face !== undefined) inp.face = T.face; }
    // arriving: the knight walks down off the bottom step while input waits
    if (state.arrive > 0) { state.arrive -= STEP; return { move: fight.k.y < AREA.knight.walkTo[1] ? [0, 1] : [0, 0] }; }
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
    if (state.lit < 3) state.lit = Math.min(3, Math.floor(state.t / (AREA.light.catch / 3)));   // the torches catch one after another
    if (state.hold > 0) { state.hold -= STEP; for (const n of state.nums) n.t += STEP * 0.25; return; }
    const k = fight.k, before = k.active, events = Combat.step(fight, STEP, gather());
    if (harness) { for (const e of events) state.log.push(e); if (state.log.length > 4000) state.log.splice(0, state.log.length - 4000); }
    take(events);
    if (k.active !== before) { syncHud(); writeBack(); }
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
    for (const e of events) {
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

  // ------------------------------------------------------------------ the stairs and the rack: prompts above the knight
  const inZone = z => { const k = fight.k; return k.x >= z.x0 && k.x <= z.x1 && k.y >= z.y0 && k.y <= z.y1; };
  function zones() {
    const Z = AREA.zones, was = state.zone;
    state.zone = state.arrive > 0 ? null : inZone(Z.stairs) ? "stairs" : inZone(Z.rack) ? "rack" : null;
    if (state.zone !== was) syncPrompt();
    // walking up into the stairs for 0.4 s leaves the cellar
    const mv = (fight.input && fight.input.move) || [0, 0];
    if (state.zone === "stairs" && mv[1] < -0.5 && fight.k.y <= AREA.floor.y0 + 0.5) { state.stairs += STEP; if (state.stairs >= Z.stairs.dwell) leave(); } else state.stairs = 0;
  }
  function use() { if (state.zone === "stairs") leave(); else if (state.zone === "rack") openPlank("rack"); }
  function syncPrompt() {
    const p = $("prompt"), z = state.zone;
    p.hidden = !z;
    if (z) p.textContent = AREA.zones[z].prompt;
  }
  $("prompt").addEventListener("click", use);

  // ------------------------------------------------------------------ drawing
  const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };
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
    const k = fight.k, t = state.t, still = reduce, fxf = still ? 0 : Math.floor(t * 8) % 4;
    ctx.save();
    if (state.shake.t > 0 && !still) ctx.translate(Math.round((rnd() * 2 - 1) * state.shake.amp), Math.round((rnd() * 2 - 1) * state.shake.amp));
    scene.draw(ctx, t, still, state.lit);
    drawBoard();
    // floor decals: patches, cracks, traps, the fields
    for (const p of fight.patches) drawPatch(p, t);
    for (const f of state.fx) if (f.kind === "crack") drawCrack(f);
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
  function drawKnight(fxf) {
    const k = fight.k, a = Combat.animOf(fight), h = Combat.hold(fight, a.anim, a.i), kf = h.frame;
    C.shadow(ctx, k.x, k.y, 7);
    // the dodge draws the walk frame with three fading afterimages; so does a lunge
    if (!reduce) for (let g = 1; g <= 3; g++) { const p = state.trail[g * 3 - 1]; if (!p) break; ctx.globalAlpha = 0.3 / g; ctx.drawImage(kf.canvas(), Math.round(p[0]) - 16, Math.round(p[1]) - 31); ctx.globalAlpha = 1; }
    const wc = weaponCanvas(h.thing, h.facing, fxf), sheathed = k.swapT > SPEC.knight.swap / 2;
    const drawW = () => {
      if (sheathed) return;   // swapping: the knight sheathes, then draws
      const S = k.stream;
      if (S && S.charging && !reduce && (state.frames >> 2) & 1) ctx.globalAlpha = 0.6;
      ctx.drawImage(wc.c, h.hx - wc.grip[0], h.hy - wc.grip[1]);
      ctx.globalAlpha = 1;
      if (k.charging) {   // a charge: a glow building on the weapon
        const c = clamp(k.chargeT / SPEC.modifiers.charge.time, 0, 1);
        if (!wc.white) wc.white = C.canvasOf(wc.px, 32, 32, { tint: () => "#fff6c8" });
        ctx.globalAlpha = 0.15 + 0.55 * c * (reduce || c >= 1 || (state.frames >> 2) & 1 ? 1 : 0.6);
        ctx.drawImage(wc.white, h.hx - wc.grip[0], h.hy - wc.grip[1]);
        ctx.globalAlpha = 1;
      }
    };
    if (h.behind) drawW();   // facing away the weapon is further from the camera, so it is drawn behind the knight
    ctx.drawImage(k.bonk > SPEC.dummies.quintain.stagger - 0.15 ? kf.white() : kf.canvas(), h.x0, h.y0);
    if (!h.behind) drawW();
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
  function drawMinion(m) {
    C.shadow(ctx, m.x, m.y, 5);
    const bob = reduce ? 0 : Math.floor(m.walkT * 6) % 2, x = Math.round(m.x) - 5, y = Math.round(m.y) - 13 - bob, flip = m.face < 0;
    const rows = ["k........k", "kk......kk", "k3k....k3k", "k33kkkk33k", "k3333333k.", ".k3k33k3k.", ".k333333k.", ".k322223k.", "..k2222k..", "..k2kk2k..", "..kk..kk.."];
    C.paint(ctx, rows, { k: OUT, "3": "#fffaf0", "2": "#ead4aa", "1": "#c28569" }, x, y, flip !== (m.swing > 0));
    px(x + 3, y + 5, "#b55088"); px(x + 6, y + 5, "#b55088");
    if (m.swing > 0) for (let i = 0; i < 5; i++) px(x + (flip ? -2 - i * 0.5 : 11 + i * 0.5), y + 3 + i, i % 2 ? "#f6757a" : "#ffe0f0");
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
  function drawStatuses(d, t) {
    const st = d.st, hx = d.arm ? Combat.hitPoint(d)[0] : d.x, hy = d.arm ? Combat.hitPoint(d)[1] : d.y - d.chest, f = reduce ? 0 : Math.floor(t * 8);
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
  const hud = { held: null, other: null, pip: -1, tag: null, p: -1, c: -1, on: null, x: -1, y: -1, ab: -1 };
  // a legend's ability button (design pass 10) carries its head class's own weapon, drawn at 1x
  const classWeapon = c => (window.FORGE_THINGS || []).find(t => t.kind === "weapon" && t.weapon && t.weapon.visual && t.weapon.visual.base === c);
  function syncHud() {
    const k = fight.k, hand = fight.hands[k.active], t = hand.thing, other = fight.hands.length > 1 ? fight.hands[1 - k.active].thing : null;
    if (hud.held !== t.id) {
      hud.held = t.id;
      $("wName").textContent = t.name || t.id; $("wLine").textContent = sentence(t);
      const sb = $("strikeBtn"); sb.replaceChildren(icon(t, 2)); sb.insertAdjacentHTML("beforeend", '<i class="clock"></i><i class="glow"></i>');
      sb.setAttribute("aria-label", "Strike with " + (t.name || t.id));
      $("pips").hidden = true;   // design pass 10: no third blow and no pips; a legend's head is its ability
      // the gold button above Strike, only while a legend is in hand: the head's class weapon as its icon, the ability's words as its label
      const ab = $("abilityBtn"), ua = hand.ua;
      ab.hidden = !ua;
      if (ua) {
        const cw = classWeapon((t.weapon.visual || {}).fuse);
        ab.replaceChildren(cw ? icon(cw, 1) : document.createTextNode("✦")); ab.insertAdjacentHTML("beforeend", '<i class="clock"></i><i class="glow"></i>');
        ab.setAttribute("aria-label", ua.ability.name + ": " + ua.ability.line); ab.title = ua.ability.name;
        // the first legend of the visit: a note under the plate says where its ability is, for 3 s
        if (!state.legendNoted) { state.legendNoted = true; state.noteUntil = state.t + 3; state.noteText = "✦ " + ua.ability.name + " · the gold button above Strike"; }
      }
      hud.ab = -1;
      if (ua) syncAbility(hand);   // the clock of the hand now held, at once (a swap never shows the other hand's clock for a frame)
      hud.pip = -1; hud.p = -1; hud.c = -1;
    }
    const oid = other ? other.id : "";
    if (hud.other !== oid) {
      hud.other = oid;
      const sw = $("swapBtn");
      if (other) { sw.replaceChildren(icon(other, 1)); sw.setAttribute("aria-label", "Swap to " + (other.name || other.id)); } else { sw.textContent = "Swap"; sw.setAttribute("aria-label", "Swap: you carry one weapon"); }
      sw.classList.toggle("off", !other); sw.disabled = !other;   // one weapon: Swap is greyed
    }
    const tag = practice(t) ? "practice" : "";
    if (hud.tag !== tag) { hud.tag = tag; $("wTag").hidden = !tag; $("wTag").textContent = tag ? "⛓ practice only" : ""; }
    $("wSlow").hidden = !state.slow;
    const note = $("note"), text = state.empty && state.loadout.length === 0 ? "Bring weapons from the Forge, or take one from the rack" : state.noteUntil > state.t ? state.noteText : "";
    note.hidden = !text; if (text) note.textContent = text;
  }
  // the ability's clock sweeps while it cools (--p in 40 steps); ready, the button pulses
  function syncAbility(hand) { const q = hand.acd > 0 ? Math.round((1 - hand.acd / (hand.acdOf || 1)) * 40) / 40 : 1; if (q !== hud.ab) { hud.ab = q; const ab = $("abilityBtn"); ab.style.setProperty("--p", String(q)); ab.classList.toggle("ready", q >= 1); } }
  // what changes every frame: a legend's ability clock, the recovery clock, the charge, the held button, the prompt's place
  function syncLive() {
    const k = fight.k, hand = fight.hands[k.active];
    if (hand.ua) syncAbility(hand);
    if (state.noteUntil && state.t >= state.noteUntil) { state.noteUntil = 0; syncHud(); }   // the first-legend note is over
    const of = hand.recoverOf || 1, p = hand.recover > 0 ? Math.round((1 - hand.recover / of) * 40) / 40 : 1;
    if (p !== hud.p) { hud.p = p; $("strikeBtn").style.setProperty("--p", String(p)); }
    const c = k.charging ? Math.round(clamp(k.chargeT / SPEC.modifiers.charge.time, 0, 1) * 20) / 20 : 0;
    if (c !== hud.c) { hud.c = c; $("strikeBtn").style.setProperty("--c", String(c)); }
    const on = !!(fight.input && fight.input.strike);
    if (on !== hud.on) { hud.on = on; $("strikeBtn").classList.toggle("on", on); }
    if (state.zone) { const L = state.layout, x = Math.round(L.x - L.pl + k.x * L.s), y = Math.round(L.y - L.pt + (k.y - 36) * L.s); if (x !== hud.x || y !== hud.y) { hud.x = x; hud.y = y; const pr = $("prompt"); pr.style.left = x + "px"; pr.style.top = Math.max(76, y) + "px"; } }
  }
  let toastTimer = 0;
  const toasts = [];
  function toast(m) { const el = $("toast"); el.textContent = m; el.classList.add("show"); window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => el.classList.remove("show"), 3000); toasts.push(m); }

  // ------------------------------------------------------------------ the planks: the first visit, the rack, the menu
  const VEILS = { first: "firstVeil", rack: "rackVeil", menu: "menuVeil" };
  function openPlank(which) {
    if (state.left) return;
    closePlank();
    state.plank = which;
    input.strike = false; input.keys = {}; stickUp();
    if (which === "rack") renderRack();
    if (which === "menu") renderMenu();
    $(VEILS[which]).hidden = false;
    const focus = $(VEILS[which]).querySelector("button"); if (focus && !coarse) focus.focus();
  }
  function closePlank() {
    if (!state.plank) return;
    $(VEILS[state.plank]).hidden = true;
    if (state.plank === "first") store.set(KEYS.seen, "1");
    state.plank = null; last = window.performance.now(); acc = 0;
    if (document.activeElement && document.activeElement !== document.body && document.activeElement.blur) document.activeElement.blur();
  }
  $("firstGo").addEventListener("click", closePlank);
  for (const id of Object.values(VEILS)) $(id).addEventListener("click", e => { if (e.target === $(id) && id !== VEILS.first) closePlank(); });
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
  function renderMenu() {
    const set = (id, on) => { const b = $(id); b.setAttribute("aria-pressed", String(on)); b.querySelector("span").textContent = on ? "on" : "off"; };
    set("mReach", state.reach); set("mSlow", state.slow); set("mLefty", state.lefty);
    $("mForced").hidden = !state.forced;
  }
  $("menuBtn").addEventListener("click", () => openPlank("menu"));
  $("mReach").addEventListener("click", () => { state.reach = !state.reach; renderMenu(); });
  $("mSlow").addEventListener("click", () => { state.slow = !state.slow; renderMenu(); syncHud(); });
  $("mLefty").addEventListener("click", () => { state.lefty = !state.lefty; store.set(KEYS.lefty, state.lefty ? "1" : "0"); fit(); renderMenu(); });
  $("mReset").addEventListener("click", () => { reset(); closePlank(); toast("The dummies stand as they were"); });
  $("mForced").addEventListener("click", () => { setForced(false); closePlank(); });
  $("mForge").addEventListener("click", () => leave("forge"));
  $("mHome").addEventListener("click", () => leave("menu"));
  $("mClose").addEventListener("click", closePlank);
  $("upBtn").addEventListener("click", () => leave("forge"));
  $("homeBtn").addEventListener("click", () => leave("menu"));
  function reset() { Combat.reset(fight); state.fx = []; state.nums = []; state.parts = []; state.rings = []; state.sums = {}; state.heal = { n: 0, at: state.t }; state.hold = 0; state.shake = { t: 0, amp: 0 }; }

  // ------------------------------------------------------------------ the turn plate
  function setForced(on) { state.forced = !!on; if (on) store.set(KEYS.forced, "1"); else store.del(KEYS.forced); fit(); last = window.performance.now(); acc = 0; }
  $("tForce").addEventListener("click", () => setForced(true));
  $("tForge").addEventListener("click", () => leave("forge"));
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
  function refit() { fit(); hud.x = -1; }
  window.addEventListener("resize", refit);
  window.addEventListener("orientationchange", refit);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", refit);
  document.addEventListener("fullscreenchange", refit);
  document.addEventListener("visibilitychange", () => { last = window.performance.now(); acc = 0; if (document.hidden) { input.strike = false; input.keys = {}; stickUp(); } });
  // the harness's handle on the screen
  window.TheBattlegrounds = {
    state, world, toasts, input(o) { input.test = o ? Object.assign({}, o) : null; }, pick, reset, leave, use, fit, openPlank, closePlank, setForced, toGame, writeBack, syncHud,
    get fight() { return fight; }, get rack() { return rack.slice(); }, get paused() { return paused(); },
    // move time on by ms (in steps of 1/60 s); while the game is paused, time doesn't move
    step(ms) { let n = 0; const want = Math.round(ms / 1000 / STEP); for (let i = 0; i < want; i++) { if (paused()) break; tick(); n++; } flushSums(false); draw(); return n; },
    stick(cx, cy, dx, dy) { const [gx, gy] = toGame(cx, cy), [hx, hy] = toGame(cx + dx, cy + dy); input.stick = { id: -1, cx: gx, cy: gy }; stickTo(hx, hy); return [input.sx, input.sy]; },
    draw
  };
  lockLandscape();
  fit();
  syncHud(); syncPrompt();
  if (state.visiting) { const v = $("visitLine"); v.hidden = false; v.textContent = "You came without weapons from the Forge, so the rack holds the twenty class weapons and the world's forged weapons."; }
  if (!coarse) { $("keyWalk").textContent = "W A S D or the arrows"; $("keyStrike").textContent = "J or Space"; $("keySwap").textContent = "K"; $("keyDodge").textContent = "L or Shift"; $("keyLine").textContent = "E uses the rack on the wall and the stairs back up. U: a legend's ability. Esc opens the cellar's menu."; }
  if (params.get("seen") !== "1" && (store.get(KEYS.seen) !== "1" || params.get("fresh") === "1")) openPlank("first");
  draw();
  state.booted = true;
  document.body.setAttribute("data-booted", "1");
  document.body.setAttribute("data-errors", String((window.__errors || []).length));
  window.requestAnimationFrame(() => { $("fade").classList.remove("on"); });
  if (reduce || harness) $("fade").classList.remove("on");
  last = window.performance.now();
  window.requestAnimationFrame(frame);
})();
