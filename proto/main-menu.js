// FORGE FOREVER: main-menu.js (design pass 9, card t66; built sideways first by design pass 11, card t69; landscape only since its
// amendment 9). The main menu: the title, the dusk vista over the whole screen, and three buttons: Forge, Battlegrounds, General
// Settings. The vista is proto/dusk.js at a whole number of device pixels per world pixel. General Settings are proto/settings.js's
// rows plus a row that opens the Forge on its Developer's bench. Moving between pages is proto/nav.js's rule. A phone held upright
// sees the turn plate; with My screen won't turn the game root is laid out at height x width and turned a quarter (the cellar's rule).
// For the checks: ?stay=1 records where a button would go and stays; ?motion=reduce stills the page; ?open=settings|erase opens the
// plank; ?nostore=1 makes storage act blocked; ?pointer=coarse|fine overrides the pointer.
// Since build 8 (design pass 16, the first five minutes): a phone with no player (proto/smith.js) sees "Who's at the forge?" in place
// of the three buttons: Grycus's face and words, a name field and Into the forge, which writes the player record, starts the lessons
// (proto/lessons.js) at the welcome and walks into the Forge. While the field has the focus and the keyboard is up, the plank rises
// into what the keyboard leaves of the screen (visualViewport). While the lessons run, Forge and Battlegrounds both go to the lesson's
// page. Settings (settings.js) has Your name and Copy my playtest notes, and Erase forgets the player and the lessons.
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const media = q => !!(window.matchMedia && window.matchMedia(q).matches);
  const S = window.Settings || null;
  const stay = params.get("stay") === "1";
  const coarse = params.get("pointer") ? params.get("pointer") === "coarse" : media("(pointer: coarse)");
  const phoneStill = () => media("(prefers-reduced-motion: reduce)");
  let still = S ? S.reduce() : (params.get("motion") === "reduce" || phoneStill());
  if (still) document.documentElement.classList.add("still");
  const toasts = [];
  let toastTimer = 0;
  function toast(m) { const el = $("toast"); el.textContent = m; el.classList.add("show"); window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => el.classList.remove("show"), 3000); toasts.push(m); }
  try { Smithy.installFrames(); } catch (e) { /* the frames' flat grounds show */ }
  const game = $("game");
  const turn = { forced: S ? S.isOn("forced") : false, turned: false, plate: false, layout: null };
  // (build 8) who is at the forge: the player record and the lessons, when their scripts are here, and the name plank's state
  const Sm = window.Smith || null, Ls = window.Lessons || null;
  const who = { shown: false, at: null, lifted: false, fake: null, made: null };
  const field = $("whoField"), whoOn = !!(Sm && field && $("who"));   // (an older cached page without the plank: the menu as it was)

  // ------------------------------------------------------------------ the game root: sideways, or turned a quarter (landscape only)
  const viewport = () => { const vv = window.visualViewport; return { w: Math.max(1, Math.round(vv ? vv.width : window.innerWidth)), h: Math.max(1, Math.round(vv ? vv.height : window.innerHeight)) }; };
  function fitTurn() {
    const v = viewport(), portrait = v.h > v.w;
    turn.turned = turn.forced && portrait;   // forced landscape only turns a viewport that is upright
    let gw = v.w, gh = v.h;
    if (turn.turned) { gw = v.h; gh = v.w; game.style.width = gw + "px"; game.style.height = gh + "px"; game.style.transform = "translateX(" + v.w + "px) rotate(90deg)"; }
    else { game.style.width = ""; game.style.height = ""; game.style.transform = ""; }
    game.classList.toggle("forced", turn.turned);
    game.classList.toggle("short", gh <= 500);
    game.classList.toggle("tiny", gh <= 340);
    game.style.setProperty("--gw", gw + "px"); game.style.setProperty("--gh", gh + "px");
    // a phone held upright gets the turn plate; a fine pointer never does
    turn.plate = portrait && coarse && !turn.forced;
    $("turnPlate").hidden = !turn.plate;
    $("tFull").hidden = !(document.documentElement.requestFullscreen && screen.orientation && screen.orientation.lock);
    turn.layout = { vw: v.w, vh: v.h, gw, gh, turned: turn.turned, plate: turn.plate };
    return turn.layout;
  }
  function lockLandscape() { try { const o = screen.orientation; if (o && o.lock) { const p = o.lock("landscape"); if (p && p.catch) p.catch(() => {}); } } catch (e) { /* this browser doesn't lock */ } }
  function setForced(on) { turn.forced = !!on; if (S && S.isOn("forced") !== turn.forced) S.setOn("forced", turn.forced); fit(); if (settings) settings.render(); }
  $("tForce").addEventListener("click", () => setForced(true));
  $("tFull").addEventListener("click", () => { try { const p = document.documentElement.requestFullscreen(); if (p && p.then) p.then(lockLandscape).catch(() => {}); } catch (e) { /* this browser doesn't go full screen */ } });
  (function () { const cv = $("turnPhone"); try { Smithy.drawTurnPhone(cv, false); } catch (e) { return; } let s = false; window.setInterval(() => { if ($("turnPlate").hidden || still) return; s = !s; Smithy.drawTurnPhone(cv, s); }, 1000); })();

  // ------------------------------------------------------------------ the vista and the glyphs
  let vista = null;
  const gameSize = () => ({ w: game.clientWidth || viewport().w, h: game.clientHeight || viewport().h });
  function mountVista(quiet) {
    if (vista) { try { vista.stop(); } catch (e) { /* stopped */ } vista = null; }
    if (!window.Dusk) return null;
    try { vista = Dusk.mount($("vista"), { still: quiet, size: gameSize }); } catch (e) { vista = null; window.__errors.push("vista: " + e.message); }
    return vista;
  }
  try { for (const cv of document.querySelectorAll("canvas[data-glyph]")) Smithy.glyph(cv, cv.getAttribute("data-glyph"), 2); } catch (e) { /* the labels stand alone */ }
  function fit() { fitTurn(); if (vista) { try { vista.refit(); } catch (e) { /* kept as it was */ } } liftWho(); return vista ? vista.layout : null; }

  // ------------------------------------------------------------------ the three buttons
  const url = name => document.body.getAttribute("data-" + name) || ({ forge: "the-forge.html", battlegrounds: "the-battlegrounds.html" })[name];
  let leaving = false, went = null;
  function go(to, query) {
    if (leaving) return null;
    closePlanks();
    const target = (to === "forge" ? url("forge") : url("battlegrounds")) + (query || "");
    if (stay) { went = window.Nav ? Nav.go(to, target, { stay: true }) : { to, url: target, how: "push" }; return went; }
    leaving = true;
    $("fade").classList.add("on");
    window.setTimeout(() => { if (window.Nav) went = Nav.go(to, target); else window.location.href = target; }, still ? 0 : 260);
    return went;
  }
  // (build 8) while the lessons run, both go where the lesson is: the cellar for its steps, the Forge for the rest
  $("menuForge").addEventListener("click", () => go(lessonPage() || "forge"));
  $("menuBattle").addEventListener("click", () => go(lessonPage() || "cellar"));
  $("menuSettings").addEventListener("click", () => openPlank("set"));

  // ------------------------------------------------------------------ who is at the forge (design pass 16, build 8)
  // No player record: the plank in place of the three buttons. Its words are the lessons' data (spec/lessons.js); the name's rules are
  // smith.js's, on the game's word filter. Without smith.js (an old cached file) the menu is as it was
  function player() { return Sm ? Sm.read() : null; }
  function lessonPage() { if (!Sm || !Ls) return null; const p = player(); return p ? Ls.where(Ls.load(p.id)) : null; }
  function renderWho() {
    if (!whoOn) return;
    const show = !player();
    $("who").hidden = !show; $("buttons").hidden = show; $("menu").classList.toggle("naming", show);
    if (show && !who.shown) {
      who.at = Date.now();
      const W = (window.FORGE_LESSONS && window.FORGE_LESSONS.words) || {}, M = W.menu || {};
      if (M.heading) $("whoHead").textContent = M.heading;
      if (W.who) $("whoWho").textContent = W.who;
      if (M.words) $("whoWords").textContent = M.words;
      if (M.field) { field.placeholder = M.field; field.setAttribute("aria-label", M.field); }
      if (M.button) $("whoGo").textContent = M.button;
      // his face, the crop of his idle frame (sized by the page's CSS); without grycus.js the label and the words stand alone
      const old = $("whoSpeech").querySelector("canvas"); if (old) old.remove();
      const f = Ls && Ls.face ? Ls.face(3) : null;
      if (f) { f.style.width = f.style.height = ""; f.id = "whoFace"; $("whoSpeech").prepend(f); }
    }
    who.shown = show;
    if (show) checkName();
    liftWho();
  }
  // the line under the field says what is wrong once something is typed; the button lights (and glows) only for a good name
  function checkName() {
    const why = Sm ? Sm.checkSmithName(field.value, window.FORGE_NAME_FILTER || null) : "";
    $("whoGo").disabled = !!why; $("whoGo").classList.toggle("glow", !why && !still);
    $("whoWhy").textContent = field.value.trim() ? why : "";
    return !why;
  }
  if (whoOn) field.addEventListener("input", checkName);
  // Into the forge (the field's Go key too): the record, the lessons at the welcome, and the Forge with the menu's fade
  if (whoOn) $("who").addEventListener("submit", e => {
    e.preventDefault();
    if (!Sm || leaving || !checkName()) return;
    const rec = Sm.make(field.value);
    if (Ls) Ls.start(rec.id, { named: who.at });
    who.made = rec;
    try { field.blur(); } catch (err) { /* gone */ }
    go("forge");
    if (!leaving) renderWho();   // (?stay=1: the plank gives way to the buttons; leaving, it stays through the fade)
  });
  // the visible part of the game (in its own coordinates): what the keyboard leaves of the screen. A turned game is already sized to
  // the visual viewport by fitTurn, so it is all of it
  function band() {
    if (who.fake) return who.fake;
    const gw = game.clientWidth, gh = game.clientHeight, vv = window.visualViewport;
    if (!vv || turn.turned) return { x: 0, y: 0, w: gw, h: gh };
    const x0 = Math.max(0, Math.round(vv.offsetLeft)), y0 = Math.max(0, Math.round(vv.offsetTop));
    return { x: x0, y: y0, w: Math.max(0, Math.min(gw, x0 + Math.round(vv.width)) - x0), h: Math.max(0, Math.min(gh, y0 + Math.round(vv.height)) - y0) };
  }
  // while the field has the focus and the keyboard covers the screen (less than 80 % of the game left, or a page the keyboard has
  // shrunk under 300 px), the plank rises above the keys on the right and shrinks to the heading, the field and the button
  function liftWho() {
    if (!whoOn) return;
    const el = $("who"), b = band();
    const lift = !el.hidden && document.activeElement === field && (b.h < game.clientHeight * 0.8 || b.w < game.clientWidth * 0.8 || b.h < 300);
    el.classList.toggle("lifted", lift); who.lifted = lift;
    if (!lift) { el.style.left = el.style.top = el.style.width = ""; return; }
    const w = Math.max(220, Math.min(b.w - 16, 420));
    el.style.width = w + "px";
    const h = el.offsetHeight;
    el.style.left = Math.round(b.x + Math.max(8, b.w - w - 8)) + "px";
    el.style.top = Math.round(b.y + Math.max(4, b.h - h - 6)) + "px";
  }
  let liftRaf = 0;
  const liftSoon = () => { if (liftRaf) return; liftRaf = window.requestAnimationFrame(() => { liftRaf = 0; liftWho(); }); };
  if (whoOn) {
    field.addEventListener("focus", () => { liftWho(); liftSoon(); });
    field.addEventListener("blur", () => window.setTimeout(liftWho, 0));
    if (window.visualViewport) { window.visualViewport.addEventListener("resize", liftSoon); window.visualViewport.addEventListener("scroll", liftSoon); }
  }

  // ------------------------------------------------------------------ General Settings: settings.js's rows, plus the way to the bench
  let open = null, settings = null;
  const benchRow = document.createElement("button");
  benchRow.type = "button"; benchRow.className = "set-row f-iron set-wide"; benchRow.id = "sBench";
  benchRow.innerHTML = "<b>Developer's bench</b><i>Start fresh, levels, a full armory</i><span>Forge →</span>";
  benchRow.addEventListener("click", () => go("forge", "?bench=1"));
  if (S) {
    settings = S.mount($("setBody"), {
      build: document.body.getAttribute("data-build") || "dev", rows: [benchRow], toast,
      onChange(name, on) {
        if (name === "forced") { turn.forced = on; fit(); return; }
        if (name !== "motion") return;
        still = S.reduce();   // the phone's setting and ?motion=reduce still count
        document.documentElement.classList.toggle("still", still);
        mountVista(still);   // the stars still, or twinkle again
      },
      onErase() { closePlanks(); renderWho(); },   // the keys are gone; the Forge boots fresh next time (pass 9: both planks close, the toast says so); since build 8 Grycus asks who is at the forge again
      onClose: closePlanks
    });
  }
  function openPlank(which) {
    if (!settings) { toast("Settings didn't load"); return; }
    open = which;
    settings.closeErase(); settings.render();
    $("setVeil").hidden = false;
    if (which === "erase") settings.openErase();
    const first = $("setPlank").querySelector("button:not([hidden])");
    if (first && !coarse) first.focus();
  }
  function closePlanks() {
    const was = open;
    $("setVeil").hidden = true;
    if (settings) settings.closeErase();
    open = null;
    if (was && !coarse) $("menuSettings").focus();
  }
  $("setVeil").addEventListener("click", e => { if (e.target === $("setVeil")) closePlanks(); });
  window.addEventListener("keydown", e => { if (e.key === "Escape" && open) { e.preventDefault(); if (settings && settings.asking) settings.closeErase(); else closePlanks(); } });

  // ------------------------------------------------------------------ boot
  window.MainMenu = { get layout() { return vista ? vista.layout : null; }, get went() { return went; }, toasts, go, openPlank, closePlanks, fit, fitTurn, setForced, get vista() { return vista; }, get open() { return open; }, get settings() { return settings; }, get still() { return still; },
    get turned() { return turn.turned; }, get plate() { return turn.plate; }, get forced() { return turn.forced; }, get turn() { return turn.layout; },
    // (build 8) who is at the forge: the plank's state; fakeBand(b) stands in for a keyboard the checks cannot open (null: the real one)
    get who() { return { shown: who.shown, lifted: who.lifted, made: who.made, player: player(), lesson: lessonPage(), band: band() }; }, renderWho, liftWho, fakeBand(b) { who.fake = b || null; liftWho(); return band(); } };
  if (window.Nav) Nav.arrive("menu");
  lockLandscape();
  fitTurn();
  mountVista(still);
  window.addEventListener("resize", fit);
  window.addEventListener("orientationchange", fit);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", fit);
  document.addEventListener("fullscreenchange", fit);
  // back from the Forge or the cellar, the browser may restore this page as it was left: lift the fade, close any plank, refit
  window.addEventListener("pageshow", e => { if (e.persisted) { leaving = false; $("fade").classList.remove("on"); closePlanks(); if (S) turn.forced = S.isOn("forced"); fit(); renderWho(); } });
  renderWho();
  if (who.shown && !coarse) { try { field.focus({ preventScroll: true }); } catch (e) { /* not now */ } }   // a mouse and the keys: type at once
  const opened = params.get("open");
  if (opened === "settings") openPlank("set"); else if (opened === "erase") openPlank("erase");
  document.body.setAttribute("data-booted", "1");
  document.body.setAttribute("data-errors", String((window.__errors || []).length));
  window.requestAnimationFrame(() => $("fade").classList.remove("on"));
  if (still) $("fade").classList.remove("on");
})();
