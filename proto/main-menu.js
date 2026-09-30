// FORGE FOREVER: main-menu.js (design pass 9, card t66; built sideways first by design pass 11, card t69; landscape only since its
// amendment 9). The main menu: the title, the dusk vista over the whole screen, and three buttons: Forge, Battlegrounds, General
// Settings. The vista is proto/dusk.js at a whole number of device pixels per world pixel. General Settings are proto/settings.js's
// rows plus a row that opens the Forge on its Developer's bench. Moving between pages is proto/nav.js's rule. A phone held upright
// sees the turn plate; with My screen won't turn the game root is laid out at height x width and turned a quarter (the cellar's rule).
// For the checks: ?stay=1 records where a button would go and stays; ?motion=reduce stills the page; ?open=settings|erase opens the
// plank; ?nostore=1 makes storage act blocked; ?pointer=coarse|fine overrides the pointer.
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
  function fit() { fitTurn(); if (vista) { try { vista.refit(); } catch (e) { /* kept as it was */ } } return vista ? vista.layout : null; }

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
  $("menuForge").addEventListener("click", () => go("forge"));
  $("menuBattle").addEventListener("click", () => go("cellar"));
  $("menuSettings").addEventListener("click", () => openPlank("set"));

  // ------------------------------------------------------------------ General Settings: settings.js's rows, plus the way to the bench
  let open = null, settings = null;
  const benchRow = document.createElement("button");
  benchRow.type = "button"; benchRow.className = "set-row f-iron set-wide"; benchRow.id = "sBench";
  benchRow.innerHTML = "<b>Developer's bench</b><i>Start fresh, grant levels, fill the armory</i><span>Forge →</span>";
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
      onErase() { closePlanks(); },   // the keys are gone; the Forge boots fresh next time (pass 9: both planks close, the toast says so)
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
    get turned() { return turn.turned; }, get plate() { return turn.plate; }, get forced() { return turn.forced; }, get turn() { return turn.layout; } };
  if (window.Nav) Nav.arrive("menu");
  lockLandscape();
  fitTurn();
  mountVista(still);
  window.addEventListener("resize", fit);
  window.addEventListener("orientationchange", fit);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", fit);
  document.addEventListener("fullscreenchange", fit);
  // back from the Forge or the cellar, the browser may restore this page as it was left: lift the fade, close any plank, refit
  window.addEventListener("pageshow", e => { if (e.persisted) { leaving = false; $("fade").classList.remove("on"); closePlanks(); if (S) turn.forced = S.isOn("forced"); fit(); } });
  const opened = params.get("open");
  if (opened === "settings") openPlank("set"); else if (opened === "erase") openPlank("erase");
  document.body.setAttribute("data-booted", "1");
  document.body.setAttribute("data-errors", String((window.__errors || []).length));
  window.requestAnimationFrame(() => $("fade").classList.remove("on"));
  if (still) $("fade").classList.remove("on");
})();
