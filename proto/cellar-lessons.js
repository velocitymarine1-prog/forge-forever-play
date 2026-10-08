// FORGE FOREVER: cellar-lessons.js (design pass 16 with its revision 1, the first five minutes, section 3.5; built by build 8, stage E).
// Grycus shouts the Training Cellar's lessons down the stairs: proto/lessons.js's controller mounted on the cellar's game root (#game,
// so the ribbon and the glow turn with a forced landscape), told what glows at each step, and moved on by the rules' own events. Loaded
// after spec/lessons.js, grycus.js (his face), smith.js and lessons.js and before battlegrounds.js, which calls the hooks below through
// lessonOn(name, ...); this file reaches the page through window.TheBattlegrounds. Plain script, defines window.CellarLessons. His words
// are spec/lessons.json's; every line is GRYCUS · FROM THE STAIRS, the ribbon kind of plank, centred over the back wall under the HUD's
// top row, with no veil: the stick, the buttons and the room stay live.
//
//   C1 Arrive: his line once the knight has walked off the bottom step; a tap continues.
//   C2 Walk: the ghost thumb slides in the stick's corner (on the right with Left-handed) and a floor ring burns round the straw dummies;
//      ends when the knight's feet are inside the ring (an event the page knows: ring).
//   C3 Strike: Strike glows, 0 / 3 counts the blows that land on straw (the rules' hit events with dummy "straw"; a burn tick is not a
//      blow); then his beat about the Fire. C4 Dodge: Dodge glows, one dodge. C5 Swap: Swap glows, one swap; then his beat with a
//      glance at the rack on the wall. C6 The quintain: a floor ring round it, 0 / 3 hits on it; the arm catching the knight (the rules'
//      bonk) says "It got you!" and the count goes on. C7 Up: the stairs' opening and ↑ Forge glow; the page leaving for the Forge ends it.
//   Until C7 ↑ Forge and the house are dimmed and inert, so are Back to the Forge and Main menu in the cellar's menu, and the door to
//   the Troll Gate on the left wall is no zone: no prompt, no plate (the cellar's menu itself stays live; the stairs stay live too: up
//   them, the Forge says the lessons are in the cellar and sends the player back down). The first-visit plank does not show while the
//   lessons run and is marked seen when they leave the cellar. Every step resumes after a reload (the count starts again).
//   ?lessons=1 with ?stay=1 (the checks) makes a test player, Tester, with the lessons at the cellar's first step.
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const stay = params.get("stay") === "1";
  const Ls = window.Lessons || null, Sm = window.Smith || null;
  const TB = () => window.TheBattlegrounds || null;
  const D = () => window.FORGE_LESSONS || {};
  const firstStep = () => (((D().steps || []).find(s => s.page === "cellar") || {}).id) || "c.arrive";
  let L = null, lay = null;   // lessons.js's controller on #game, and this file's own layer (the anchors and the thumb)
  const live = { arriving: false, flare: 0, anchors: {}, thumb: null, blocked: [] };
  // the floor rings, in world pixels: an ellipse round the straw dummies' feet and one round the quintain's (section 3.5's marks)
  const RINGS = { straw: { cx: 232, cy: 128, rx: 42, ry: 34 }, quintain: { cx: 96, cy: 168, rx: 44, ry: 30 } };
  // the stairs' opening on the back wall and the rack, in world pixels (proto/cellar.js draws them there)
  const BOXES = { stairs: { x: 21, y: 18, w: 36, h: 46 }, rack: { x: 94, y: 22, w: 46, h: 32 } };
  const EMBER = ["#f77622", "#feae34", "#fee761"], SOOT = "#181425";
  const still = () => (L && L.state.still) || document.documentElement.classList.contains("still");

  // ------------------------------------------------------------------ whose lessons are in the cellar
  // the record of a player whose lessons stand at a cellar step, else null (no player, another page's step, done: the cellar plays as
  // it always has). ?lessons=1 with ?stay=1 makes Tester there
  function record() {
    if (!Sm || !Ls) return null;
    let p = Sm.read();
    if (!p && stay && params.get("lessons") === "1") { p = Sm.make("Tester"); Ls.save(p.id, Ls.moveTo(Ls.begin(), firstStep())); }
    const r = p ? Ls.load(p.id) : null;
    return r && !r.done && Ls.pageOf(r.step) === "cellar" ? r : null;
  }

  // ------------------------------------------------------------------ what glows, and where the ribbon goes
  // the names spec/lessons.json gives its targets and glances: the HUD's buttons, and anchors over the stairs and the rack on the stage
  function resolve(name) {
    if (name === "strike") return $("strikeBtn");
    if (name === "dodge") return $("dodgeBtn");
    if (name === "swap") return $("swapBtn");
    if (name === "forge") return $("upBtn");
    if (name === "stairs" || name === "rack") return live.anchors[name] || null;
    return null;
  }
  // live, and no tap on them counts: the cog, and the planks (the menu, the rack, the gate plate, the turn plate)
  const allowed = () => ["menuBtn", "menuVeil", "rackVeil", "gateVeil", "askVeil", "firstVeil", "tallyVeil", "turnPlate"].map($).filter(Boolean);
  // dimmed and inert until C7: ↑ Forge and the house, and the menu's two ways out
  const blockedEls = id => id === "c.up" ? [] : ["upBtn", "homeBtn", "mForge", "mHome"].map($).filter(Boolean);
  // the ribbon's place: centred over the back wall, under the HUD's top row (the stage's top 17 world pixels), as wide as a plank may be;
  // while his beat glances at the rack it steps right of the rack, so the glance shows
  function ribbonBox() {
    const T = TB(), Lo = T.state.layout, W = $("game").clientWidth, roomW = (T.VIEW ? T.VIEW.w : 384) * Lo.s;   // (design pass 30: the canvas covers the glass; the ribbon keeps to the room)
    const w = Math.floor(Math.min(Ls.widest("ribbon", W), roomW - 12));
    let x = Math.round((W - w) / 2);
    const prev = L && L.state.beat ? Ls.steps()[Ls.index(L.step) - 1] : null;   // (a beat is the step before's: its glance is in its data)
    if (prev && prev.beat && prev.beat.glance === "rack") x = Math.min(Math.max(x, Math.round(Lo.x + (BOXES.rack.x + BOXES.rack.w) * Lo.s) + 10), Math.round(Lo.x + roomW - 6 - w));
    return { x, y: Math.round(Lo.y + 17 * Lo.s), w };
  }
  function view(id, ctl) {
    if (!L && ctl) L = ctl;   // (mount's own first render comes before mount returns the controller)
    const T = TB(); if (!T || T.state.left) return null;
    const st = Ls.step(id); if (!st || st.page !== "cellar") return null;   // (another page's step: the page is leaving for it)
    if (id === firstStep() && T.state.arrive > 0) return null;   // his first line waits till the knight is off the stairs
    const v = { box: ribbonBox(), block: blockedEls(id), words: Ls.wordsFor(st, { desktop: L ? L.state.desktop : false, lefty: !!T.state.lefty }) };
    if (id === "c.up") { v.manual = true; v.pointer = "below"; }   // (the stairs end it, not a tap on the glow)
    return v;
  }
  function marks(id) { const st = Ls.step(id); return (st && st.marks) || {}; }

  // ------------------------------------------------------------------ the anchors and the ghost thumb (this file's layer, under lessons.js's)
  function layer() {
    if (lay) return lay;
    const g = $("game"); if (!g) return null;
    const st = document.createElement("style"); st.id = "cl-css";
    st.textContent = ".cl{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:hidden}.cl>*{position:absolute;pointer-events:none}" +
      ".cl-thumb{width:40px;height:40px;image-rendering:pixelated;image-rendering:crisp-edges;opacity:.78;filter:drop-shadow(0 0 3px rgba(254,231,97,.9));animation:cl-slide 1.2s steps(4,end) infinite}" +
      "@keyframes cl-slide{50%{translate:24px 0}}" +
      ".still .cl-thumb,.cl.still .cl-thumb{animation:none;translate:14px 0}";
    document.head.appendChild(st);
    lay = document.createElement("div"); lay.className = "cl"; lay.setAttribute("aria-hidden", "true"); lay.style.zIndex = "4";
    for (const n of ["stairs", "rack"]) { const a = document.createElement("div"); a.className = "cl-" + n; lay.appendChild(a); live.anchors[n] = a; }
    g.appendChild(lay);
    return lay;
  }
  // the anchors over the stairs and the rack follow the stage (fit); the thumb sits on the stick's rest, and slides toward the dummies
  function sync() {
    const T = TB(); if (!T || !lay) return;
    const Lo = T.state.layout;
    lay.classList.toggle("still", still());
    for (const [n, b] of Object.entries(BOXES)) { const a = live.anchors[n]; a.style.left = Math.round(Lo.x + b.x * Lo.s) + "px"; a.style.top = Math.round(Lo.y + b.y * Lo.s) + "px"; a.style.width = Math.round(b.w * Lo.s) + "px"; a.style.height = Math.round(b.h * Lo.s) + "px"; }
    const want = !!(L && L.active && marks(L.step).thumb && !L.state.desktop && !L.state.beat);
    if (!want) { if (live.thumb) { live.thumb.remove(); live.thumb = null; } return; }
    const stick = $("stick"), sb = stick && stick.classList.contains("rest") ? L.boxOf(stick) : null;
    if (!live.thumb) {
      const cv = document.createElement("canvas"); cv.className = "cl-thumb";
      try { window.Smithy.glyph(cv, "thumb", 1); } catch (e) { cv.width = 16; cv.height = 16; }
      lay.appendChild(cv); live.thumb = cv;
    }
    if (sb) { live.thumb.style.left = Math.round(sb.x + sb.w / 2 - 20 - (T.state.lefty ? 10 : 0)) + "px"; live.thumb.style.top = Math.round(sb.y + sb.h / 2 - 20) + "px"; live.thumb.dataset.side = T.state.lefty ? "right" : "left"; }
  }

  // ------------------------------------------------------------------ the floor rings (drawn on the stage, in world pixels, under the actors)
  // a dotted ember ellipse with a soot shadow, its dots walking round (still under less motion); a tap off the glow flares it whole
  function ring(ctx, r, t) {
    const n = Math.ceil(Math.PI * (r.rx + r.ry)), flare = live.flare > t, ph = still() ? 0 : Math.floor(t * 12);
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, x = Math.round(r.cx + r.rx * Math.cos(a)), y = Math.round(r.cy + r.ry * Math.sin(a)); ctx.fillStyle = SOOT; ctx.fillRect(x, y + 1, 1, 1); }
    for (let i = 0; i < n; i++) {
      if (!flare && ((i + ph) % 6) >= 3) continue;
      const a = i / n * Math.PI * 2, x = Math.round(r.cx + r.rx * Math.cos(a)), y = Math.round(r.cy + r.ry * Math.sin(a));
      ctx.fillStyle = flare ? EMBER[2] : EMBER[((i + ph) % 6) === 1 ? 1 : 0]; ctx.fillRect(x, y, 1, 1);
    }
  }
  const inRing = (k, r) => !!k && Math.pow((k.x - r.cx) / r.rx, 2) + Math.pow((k.y - r.cy) / r.ry, 2) <= 1;
  const ringNow = () => { const m = L && L.active && !L.state.beat ? marks(L.step).ring : null; return m && RINGS[m] ? m : null; };

  // ------------------------------------------------------------------ the record moves on
  function onStep(id) {
    const T = TB();
    if (!id || Ls.pageOf(id) !== "cellar") { if (T && T.markSeen) T.markSeen(); }   // (the lessons leave the cellar: the first visit is seen)
    live.blocked = id && Ls.pageOf(id) === "cellar" && id !== "c.up" ? ["gate"] : [];
    sync();
  }
  function onOff() { const T = TB(); if (T) live.flare = T.state.t + 0.4; }

  // ------------------------------------------------------------------ the page's hooks (lessonOn(name, ...) in battlegrounds.js)
  window.CellarLessons = {
    // the boot, once the page stands (TheBattlegrounds, the fit, the HUD): true when the lessons run here, so the first-visit plank waits
    boot() {
      const T = TB(); if (!T || !Ls || !Sm || L || T.LEVEL || T.shut) return false;
      const rec = record(); if (!rec) return false;
      layer();
      L = Ls.mount($("game"), { page: "cellar", z: 4, resolve, view, onStep, onOff, allow: allowed, build: document.body.getAttribute("data-build") || "dev" });
      if (!L) return false;
      T.lessons = L;
      live.arriving = T.state.arrive > 0;
      live.blocked = L.step && L.step !== "c.up" ? ["gate"] : [];
      sync();
      return true;
    },
    // one step of the page's clock: his first line once the knight is off the stairs, and the knight's feet inside the ring (C2)
    tick() {
      const T = TB(); if (!L || !L.active || !T) return;
      if (live.arriving && T.state.arrive <= 0) { live.arriving = false; L.render(); sync(); }
      if (live.thumb) { const st = $("stick"), held = !!st && !st.classList.contains("rest"); if (live.thumb.hidden !== held) live.thumb.hidden = held; }   // (the thumb fades once the stick moves, back when it rests)
      const r = ringNow();
      if (r && (L.step === "c.walk") && inRing(T.fight.k, RINGS[r])) L.event("ring", { ring: r });
    },
    // the rules' events of one step: the blows that land on a dummy (a swing through two straw dummies is one blow: one hit of a kind
    // counts a step; a burn tick is not a blow), a dodge, a swap, the quintain's arm catching the knight
    events(events) {
      if (!L || !L.active) return;
      const landed = new Set();
      for (const e of events) {
        if (e.type === "hit") { if (e.dummy && e.kind !== "dot" && !landed.has(e.dummy)) { landed.add(e.dummy); L.event("hit", { dummy: e.dummy }); } }
        else if (e.type === "dodge" || e.type === "swap") L.event(e.type);
        else if (e.type === "bonk") L.event("bonk");
      }
    },
    // the zones that are no zones while the lessons run (the door to the Troll Gate until C7)
    blocked() { return L && L.active ? live.blocked : null; },
    // the page leaves: up the stairs (or ↑ Forge) at C7 ends the cellar's lessons; the Forge takes it from there
    leave(to) { if (L && L.active && L.step === "c.up" && to === "forge") L.event("up"); },
    // the floor rings, drawn under the actors each frame
    floor(ctx) { const T = TB(), r = ringNow(); if (r && T) ring(ctx, RINGS[r], T.state.t); },
    // the stage was fitted (a resize, a turn, a switch of hands): the anchors and the thumb follow, the ribbon is measured again
    fit() { if (!L) return; sync(); L.refit(); },
    get L() { return L; },
    get state() {
      const T = TB(), r = ringNow(), k = T && T.fight ? T.fight.k : null, th = live.thumb;
      return { step: L ? L.step : null, active: !!(L && L.active), ring: r, rings: r ? [Object.assign({ name: r }, RINGS[r])] : [], inside: !!(r && inRing(k, RINGS[r])), blocked: live.blocked.slice(),
        thumb: th ? { side: th.dataset.side || "left", x: parseFloat(th.style.left) || 0, y: parseFloat(th.style.top) || 0 } : null, anchors: Object.fromEntries(Object.entries(live.anchors).map(([n, a]) => [n, L ? L.boxOf(a) : null])) };
    },
    version: 1
  };
})();
