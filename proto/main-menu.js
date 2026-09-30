// FORGE FOREVER: main-menu.js (design pass 9, card t66; built sideways first by design pass 11, card t69). The main menu: the title,
// the dusk vista over the whole screen, and three buttons: Forge, Battlegrounds, General Settings. The vista is proto/dusk.js at a
// whole number of device pixels per world pixel. General Settings are proto/settings.js's rows (four switches the whole game reads,
// Erase my smithy) plus a row that opens the Forge on its Developer's bench. Moving between pages is proto/nav.js's rule.
// For the checks: ?stay=1 records where a button would go and stays; ?motion=reduce stills the page; ?open=settings|erase opens the
// plank; ?nostore=1 makes storage act blocked.
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const media = q => !!(window.matchMedia && window.matchMedia(q).matches);
  const S = window.Settings || null;
  const stay = params.get("stay") === "1";
  const phoneStill = () => media("(prefers-reduced-motion: reduce)");
  let still = S ? S.reduce() : (params.get("motion") === "reduce" || phoneStill());
  if (still) document.documentElement.classList.add("still");
  const toasts = [];
  let toastTimer = 0;
  function toast(m) { const el = $("toast"); el.textContent = m; el.classList.add("show"); window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => el.classList.remove("show"), 3000); toasts.push(m); }
  try { Smithy.installFrames(); } catch (e) { /* the frames' flat grounds show */ }

  // ------------------------------------------------------------------ the vista and the glyphs
  let vista = null;
  function mountVista(quiet) {
    if (vista) { try { vista.stop(); } catch (e) { /* stopped */ } vista = null; }
    if (!window.Dusk) return null;
    try { vista = Dusk.mount($("vista"), { still: quiet }); } catch (e) { vista = null; window.__errors.push("vista: " + e.message); }
    return vista;
  }
  mountVista(still);
  try { for (const cv of document.querySelectorAll("canvas[data-glyph]")) Smithy.glyph(cv, cv.getAttribute("data-glyph"), 2); } catch (e) { /* the labels stand alone */ }
  function fit() { if (vista) { try { vista.refit(); } catch (e) { /* kept as it was */ } } return vista ? vista.layout : null; }

  // ------------------------------------------------------------------ the three buttons
  const url = name => document.body.getAttribute("data-" + name) || ({ forge: "the-forge.html", battlegrounds: "the-battlegrounds.html" })[name];
  let leaving = false, went = null;
  function go(to, query) {
    if (leaving) return null;
    closePlanks();
    const target = (to === "forge" ? url("forge") : url("battlegrounds")) + (query || "");
    if (stay) { went = window.Nav ? Nav.go(to, target, { stay: true }) : { to, url: target, how: "push" }; return went; }
    leaving = true;
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { /* nothing was locked */ }
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
    if (first && !media("(pointer: coarse)")) first.focus();
  }
  function closePlanks() {
    const was = open;
    $("setVeil").hidden = true;
    if (settings) settings.closeErase();
    open = null;
    if (was && !media("(pointer: coarse)")) $("menuSettings").focus();
  }
  $("setVeil").addEventListener("click", e => { if (e.target === $("setVeil")) closePlanks(); });
  window.addEventListener("keydown", e => { if (e.key === "Escape" && open) { e.preventDefault(); if (settings && settings.asking) settings.closeErase(); else closePlanks(); } });

  // ------------------------------------------------------------------ boot
  window.MainMenu = { get layout() { return vista ? vista.layout : null; }, get went() { return went; }, toasts, go, openPlank, closePlanks, fit, get vista() { return vista; }, get open() { return open; }, get settings() { return settings; }, get still() { return still; } };
  if (window.Nav) Nav.arrive("menu");
  try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { /* nothing was locked */ }
  window.addEventListener("resize", fit);
  window.addEventListener("orientationchange", fit);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", fit);
  // back from the Forge or the cellar, the browser may restore this page as it was left: lift the fade, close any plank, refit
  window.addEventListener("pageshow", e => { if (e.persisted) { leaving = false; $("fade").classList.remove("on"); closePlanks(); fit(); } });
  const opened = params.get("open");
  if (opened === "settings") openPlank("set"); else if (opened === "erase") openPlank("erase");
  document.body.setAttribute("data-booted", "1");
  document.body.setAttribute("data-errors", String((window.__errors || []).length));
  window.requestAnimationFrame(() => $("fade").classList.remove("on"));
  if (still) $("fade").classList.remove("on");
})();
