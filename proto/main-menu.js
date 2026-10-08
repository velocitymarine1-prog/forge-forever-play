// FORGE FOREVER: main-menu.js (design pass 9, card t66; built sideways first by design pass 11, card t69; landscape only since its
// amendment 9; the front door of design pass 28, card t86, since build 18). The main menu is the title, the forge's fire over the whole
// screen, and TAP ANYWHERE TO CONTINUE: no buttons. The scene is proto/hearth.js at a whole number of device pixels per world pixel
// (the Forge's own pixel size), the fire stepping on the page's clock unless the page is still. A tap or click anywhere on the game
// root (Enter or Space on a desktop) goes where Play went until build 18: the castle page, which opens the Courtyard, the game's hub,
// or the lesson's page while the lessons run (the cellar for its steps); moving between pages is proto/nav.js's rule, with the fade.
// A phone held upright sees the turn plate; with My screen won't turn the game root is laid out at height x width and turned a
// quarter (the cellar's rule).
// Since build 8 (design pass 16, the first five minutes): a phone with no player (proto/smith.js) is asked "Who's at the forge?":
// Grycus's face and words, a name field and Into the castle, which writes the player record, starts the lessons (proto/lessons.js)
// at the courtyard's gate and walks into the castle. Since build 18 the plank rises on the first tap, in the room under the sign, in
// place of the tap line; Escape puts it away. While the field has the focus and the keyboard is up, the plank rises into what the
// keyboard leaves of the screen (visualViewport).
// Settings is the cog on the castle page (settings.js, with every row the menu's plank had and the bench under Developer); the menu
// reads its switches: My screen won't turn for the quarter turn, Less motion for the still page.
// For the checks: ?stay=1 records where a tap would go and stays; ?motion=reduce stills the page (?motion=full plays it); ?nostore=1
// makes storage act blocked; ?pointer=coarse|fine overrides the pointer.
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const media = q => !!(window.matchMedia && window.matchMedia(q).matches);
  const S = window.Settings || null;
  const stay = params.get("stay") === "1";
  const coarse = params.get("pointer") ? params.get("pointer") === "coarse" : media("(pointer: coarse)");
  const phoneStill = () => media("(prefers-reduced-motion: reduce)");
  const reduce = () => S ? S.reduce() : (params.get("motion") === "reduce" || phoneStill());
  let still = reduce();
  if (still) document.documentElement.classList.add("still");
  const toasts = [];
  let toastTimer = 0;
  function toast(m) { const el = $("toast"); el.textContent = m; el.classList.add("show"); window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => el.classList.remove("show"), 3000); toasts.push(m); }
  try { Smithy.installFrames(); } catch (e) { /* the frames' flat grounds show */ }
  const game = $("game");
  const turn = { forced: S ? S.isOn("forced") : false, turned: false, plate: false, layout: null };
  // (build 8) who is at the forge: the player record and the lessons, when their scripts are here, and the name plank's state
  // (asked: a tap has asked for the plank, build 18)
  const Sm = window.Smith || null, Ls = window.Lessons || null;
  const who = { shown: false, asked: false, at: null, lifted: false, fake: null, made: null, busy: false };
  const field = $("whoField"), whoOn = !!(Sm && field && $("who"));   // (an older cached page without the plank: the menu without it)
  let booted = false;

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
  function setForced(on) { turn.forced = !!on; if (S && S.isOn("forced") !== turn.forced) S.setOn("forced", turn.forced); fit(); }
  $("tForce").addEventListener("click", () => setForced(true));
  $("tFull").addEventListener("click", () => { try { const p = document.documentElement.requestFullscreen(); if (p && p.then) p.then(lockLandscape).catch(() => {}); } catch (e) { /* this browser doesn't go full screen */ } });
  (function () { const cv = $("turnPhone"); try { Smithy.drawTurnPhone(cv, false); } catch (e) { return; } let s = false; window.setInterval(() => { if ($("turnPlate").hidden || still) return; s = !s; Smithy.drawTurnPhone(cv, s); }, 1000); })();

  // ------------------------------------------------------------------ the scene: the forge's fire (design pass 28)
  let scene = null;
  const gameSize = () => ({ w: game.clientWidth || viewport().w, h: game.clientHeight || viewport().h });
  function mountScene(quiet) {
    if (scene) { try { scene.stop(); } catch (e) { /* stopped */ } scene = null; }
    if (!window.Hearth) return null;
    try { scene = Hearth.mount($("scene"), { still: quiet, size: gameSize }); } catch (e) { scene = null; window.__errors.push("scene: " + e.message); }
    return scene;
  }
  function fit() { fitTurn(); if (scene) { try { scene.refit(); } catch (e) { /* kept as it was */ } } liftWho(); return scene ? scene.layout : null; }

  // ------------------------------------------------------------------ the way on
  const url = name => document.body.getAttribute("data-" + name) || ({ forge: "the-forge.html", battlegrounds: "the-battlegrounds.html" })[name];
  let leaving = false, went = null;
  function go(to, query) {
    if (leaving) return null;
    const target = (to === "forge" ? url("forge") : url("battlegrounds")) + (query || "");
    if (stay) { went = window.Nav ? Nav.go(to, target, { stay: true }) : { to, url: target, how: "push" }; return went; }
    leaving = true;
    $("fade").classList.add("on");
    window.setTimeout(() => { if (window.Nav) went = Nav.go(to, target); else window.location.href = target; }, still ? 0 : 260);
    return went;
  }
  function player() { return Sm ? Sm.read() : null; }
  // (build 8) while the lessons run, the way on is where the lesson is: the cellar for its steps, the castle page for the rest
  function lessonPage() { if (!Sm || !Ls) return null; const p = player(); return p ? Ls.where(Ls.load(p.id)) : null; }
  // the tap (design pass 28): nothing while leaving, before the page is booted, under the turn plate, or while the plank is up; with a
  // player, where Play went; without one, the plank
  function tap() {
    if (leaving || !booted || turn.plate || who.shown) return null;
    if (whoOn && !player()) { showWho(); return "who"; }
    return go(lessonPage() || "forge");
  }
  game.addEventListener("click", e => { if (whoOn && $("who").contains(e.target)) return; tap(); });
  window.addEventListener("keydown", e => {
    const t = e.target, tag = t && t.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return;   // the field's own keys; a focused button's Enter is its click
    if (e.key === "Escape") { if (who.shown) { e.preventDefault(); hideWho(); } return; }
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tap(); }
  });

  // ------------------------------------------------------------------ who is at the forge (design pass 16, build 8; on a tap since build 18)
  // No player record: the plank in the room under the sign once a tap has asked for it. Its words are the lessons' data (spec/lessons.js);
  // the name's rules are smith.js's, on the game's word filter. Without smith.js (an old cached file) the menu has no plank
  function showWho() {
    who.asked = true; renderWho();
    if (who.shown && !coarse) { try { field.focus({ preventScroll: true }); } catch (e) { /* not now */ } }   // a mouse and the keys: type at once
  }
  function hideWho() { who.asked = false; try { field.blur(); } catch (e) { /* gone */ } renderWho(); }
  function renderWho() {
    if (!whoOn) { $("tap").hidden = !booted; return; }
    const need = !player(), show = need && who.asked;
    if (!need) who.asked = false;
    $("who").hidden = !show; $("tap").hidden = !booted || show;
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
  // Into the castle (the field's Go key too): the record, the lessons at the gate, and the castle page with the menu's fade
  const CL = window.Cloud && window.Cloud.on ? window.Cloud : null;   // (build 9) where the cloud is on; null elsewhere
  if (whoOn) $("who").addEventListener("submit", async e => {
    e.preventDefault();
    if (!Sm || leaving || who.busy || !checkName()) return;
    const rec = Sm.make(field.value);
    if (Ls) Ls.start(rec.id, { named: who.at });
    who.made = rec;
    try { field.blur(); } catch (err) { /* gone */ }
    // (build 9) online, the new player goes online before the castle page opens (4 s at most: offline, it goes later)
    if (CL) { who.busy = true; $("whoGo").disabled = true; await Promise.race([CL.adopt(rec), new Promise(r => window.setTimeout(r, 4000))]); who.busy = false; }
    go("forge");
    if (!leaving) renderWho();   // (?stay=1: the plank gives way to the tap line; leaving, it stays through the fade)
  });
  // (build 11, design pass 13 revision 4) no key on the first screen: it only asks the name, as on the phone. A game moves to another
  // phone through Settings on the castle page (Play on another phone, Bring a game here)
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
  // shrunk under 300 px), the plank rises into what the keys leave, centred in it, and shrinks to the heading, the field and the
  // button; the sign steps out of its way meanwhile (.menu.typing: there is no room for both, and centred it would cover the title)
  function liftWho() {
    if (!whoOn) return;
    const el = $("who"), b = band();
    const lift = !el.hidden && document.activeElement === field && (b.h < game.clientHeight * 0.8 || b.w < game.clientWidth * 0.8 || b.h < 300);
    el.classList.toggle("lifted", lift); who.lifted = lift; $("menu").classList.toggle("typing", lift);
    if (!lift) { el.style.left = el.style.top = el.style.width = ""; return; }
    const w = Math.max(220, Math.min(b.w - 16, 420));
    el.style.width = w + "px";
    const h = el.offsetHeight;
    el.style.left = Math.round(b.x + Math.max(8, (b.w - w) / 2)) + "px";
    el.style.top = Math.round(b.y + Math.max(4, (b.h - h) / 2)) + "px";
  }
  let liftRaf = 0;
  const liftSoon = () => { if (liftRaf) return; liftRaf = window.requestAnimationFrame(() => { liftRaf = 0; liftWho(); }); };
  if (whoOn) {
    field.addEventListener("focus", () => { liftWho(); liftSoon(); });
    field.addEventListener("blur", () => window.setTimeout(liftWho, 0));
    if (window.visualViewport) { window.visualViewport.addEventListener("resize", liftSoon); window.visualViewport.addEventListener("scroll", liftSoon); }
  }

  // ------------------------------------------------------------------ boot
  window.MainMenu = { get layout() { return scene ? scene.layout : null; }, get went() { return went; }, toasts, go, tap, showWho, hideWho, fit, fitTurn, setForced, get scene() { return scene; }, get still() { return still; }, get booted() { return booted; },
    get turned() { return turn.turned; }, get plate() { return turn.plate; }, get forced() { return turn.forced; }, get turn() { return turn.layout; },
    // (build 8) who is at the forge: the plank's state; fakeBand(b) stands in for a keyboard the checks cannot open (null: the real one)
    get who() { return { shown: who.shown, asked: who.asked, lifted: who.lifted, made: who.made, player: player(), lesson: lessonPage(), band: band() }; }, renderWho, liftWho, fakeBand(b) { who.fake = b || null; liftWho(); return band(); } };
  if (window.Nav) Nav.arrive("menu");
  lockLandscape();
  fitTurn();
  mountScene(still);
  window.addEventListener("resize", fit);
  window.addEventListener("orientationchange", fit);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", fit);
  document.addEventListener("fullscreenchange", fit);
  // back from the castle page or the cellar, the browser may restore this page as it was left: lift the fade, read the switches again
  // (less motion changed on the castle page stills or wakes the fire), refit, and put the plank away if there is a player now
  window.addEventListener("pageshow", e => {
    if (!e.persisted) return;
    leaving = false; $("fade").classList.remove("on");
    if (S) turn.forced = S.isOn("forced");
    const now = reduce(); if (now !== still) { still = now; document.documentElement.classList.toggle("still", still); mountScene(still); }
    fit(); renderWho();
  });
  // booted: the scene is up and the tap line showing (online, once the server has answered: it may bring this phone's game back, or
  // say the game was erased; 4.5 s at most)
  function bootDone() {
    booted = true; renderWho();
    document.body.setAttribute("data-booted", "1");
    document.body.setAttribute("data-errors", String((window.__errors || []).length));
  }
  if (CL) { CL.onNote(toast); CL.ready.then(bootDone); } else bootDone();
  window.requestAnimationFrame(() => $("fade").classList.remove("on"));
  if (still) $("fade").classList.remove("on");
})();
