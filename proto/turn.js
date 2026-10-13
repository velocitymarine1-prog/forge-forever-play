// FORGE FOREVER: turn.js (design pass 40, jumpr card t102, build 31): one rule for upright or sideways, that keeps looking.
// Landscape only (design pass 11, amendment 9) needs every page to know whether the phone is upright. Until build 30 three pages
// (main-menu.js, the-forge.js, battlegrounds.js) each decided from one reading of the viewport's size, taken as they arrived, and looked
// again only on a resize event; a web view that hands a page a stale upright size at arrival and corrects it later without an event
// (WebKit bugs 170595 and 267545, card t100's diagnosis) left a sideways phone with the turn plate, or, with My screen won't turn on, the
// game laid out upright and turned a quarter. This script is the one answer for all three, and it keeps looking.
//   The readings (read()): the size from the layout viewport, the box of a fixed probe outside every turned root (#ffTurnProbe), with the
//   visual viewport and window.inner* beside it; and the phone's own word, screen.orientation.type (portrait-* upright, landscape-*
//   sideways), else window.orientation (0 or 180 upright, ±90 sideways), else no word.
//   The rule (decide(), pure): the size says how the page is laid out; on a coarse pointer the phone's word can veto "upright", never add
//   it. upright = sizeUpright, except that a phone that says sideways is never upright; plate = upright && coarse && !forced (waiting for a
//   second look on arrival when it rests on the size alone); turned = forced && upright. So My screen won't turn never turns a sideways
//   phone, and "Turn your phone sideways" is never shown to one.
//   It keeps looking (mount()): a ResizeObserver on the probe (the layout viewport changing, with or without a resize event); every
//   resize, orientationchange, visual-viewport resize, fullscreenchange, pageshow, visibilitychange to visible, focus and
//   screen.orientation change starts a settle series (a look now, the next frame, 150, 300, 600 and 1,200 ms); a one-second check while the
//   page is visible. A look refits (the page's fit) only when the size, the box's size (the probe, since build 34) or the answer changed;
//   a change found by anything but the native resize event itself fires a synthetic resize on window and on visualViewport, so the
//   lessons' planks and the scenes follow.
//   The log: the last 30 decisions that changed something, in localStorage forge-forever:turn-log (the time, the page, what woke it,
//   every reading, the phone's word, the display mode, the switch, and plate or turn), notes() as lines for Settings' Copy my playtest
//   notes; a disagreement between the phone's word and the size that lasts more than 3 s is logged once a minute.
//   The checks: ?orient=upright|sideways|none stands in for the phone's word (the harnesses' upright frames sit in a desktop window);
//   window.FF_TURN_FAKE, a function returning { w, h } or null, stands in for the probe's size (the phone driver's stale script); a faked
//   reading is marked in the log. Plain script, defines window.Turn; decide, wordOf, line, notes and trim are pure and run in node
//   (tools/test-turn.js).
(function (root) {
  "use strict";
  const KEY = "forge-forever:turn-log", KEEP = 30, SETTLE_MS = 250, SERIES = [150, 300, 600, 1200], TICK_MS = 1000, DISAGREE_MS = 3000, DISAGREE_EVERY = 60000;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const doc = root.document || null;
  let params = null; try { params = new URLSearchParams(root.location.search); } catch (e) { params = null; }
  const orientParam = params ? params.get("orient") : null;   // ?orient=upright|sideways|none: a test's stand-in for the phone's word
  const nostore = !!params && params.get("nostore") === "1";
  const store = {
    get(k) { if (nostore) return null; try { return root.localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { if (nostore) return false; try { root.localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del(k) { if (nostore) return false; try { root.localStorage.removeItem(k); return true; } catch (e) { return false; } }
  };
  const nowMs = () => Date.now();

  // ------------------------------------------------------------------ the phone's own word (pure)
  // wordOf(type, winOrientation): "upright", "sideways" or null from screen.orientation.type and window.orientation
  function wordOf(type, wo) {
    if (typeof type === "string") { if (/portrait/i.test(type)) return "upright"; if (/landscape/i.test(type)) return "sideways"; }
    if (typeof wo === "number" && isFinite(wo)) return Math.abs(wo) === 90 || wo === 270 ? "sideways" : "upright";
    return null;
  }
  function word() {
    if (orientParam === "upright" || orientParam === "sideways") return orientParam;
    if (orientParam === "none") return null;
    let type = null, wo = null;
    try { const o = root.screen && root.screen.orientation; if (o && typeof o.type === "string") type = o.type; } catch (e) { type = null; }
    try { if (typeof root.orientation === "number") wo = root.orientation; } catch (e) { wo = null; }
    return wordOf(type, wo);
  }

  // ------------------------------------------------------------------ the readings
  const n = v => Math.max(1, Math.round(Number(v) || 0));
  // read(probe): { w, h (the layout size: the visual viewport, else inner, else the probe), probe, vv, inner, sizeUpright (from the probe,
  // else the visual viewport, else inner), word, type, angle, wo, lock, mode, fake, override }. Every reading is guarded; there is always a size
  function read(probe) {
    let vv = null, inner = null, box = null, fake = false;
    try { const v = root.visualViewport; if (v && v.width > 0 && v.height > 0) vv = [n(v.width), n(v.height)]; } catch (e) { vv = null; }
    try { if (root.innerWidth > 0 && root.innerHeight > 0) inner = [n(root.innerWidth), n(root.innerHeight)]; } catch (e) { inner = null; }
    try { if (probe && probe.getBoundingClientRect) { const r = probe.getBoundingClientRect(); if (r.width > 0 && r.height > 0) box = [n(r.width), n(r.height)]; } } catch (e) { box = null; }
    try { const f = typeof root.FF_TURN_FAKE === "function" ? root.FF_TURN_FAKE() : null; if (f && f.w > 0 && f.h > 0) { box = [n(f.w), n(f.h)]; fake = true; } } catch (e) { /* no fake */ }
    const size = box || vv || inner || [1, 1], lay = vv || inner || box || [1, 1];
    let type = null, angle = null, wo = null, lock = "none";
    try { const o = root.screen && root.screen.orientation; if (o) { type = typeof o.type === "string" ? o.type : null; angle = typeof o.angle === "number" ? o.angle : null; lock = typeof o.lock; } } catch (e) { /* no orientation */ }
    try { wo = typeof root.orientation === "number" ? root.orientation : null; } catch (e) { wo = null; }
    let mode = "browser";
    try { if ((root.navigator && root.navigator.standalone) || (root.matchMedia && root.matchMedia("(display-mode: standalone)").matches)) mode = "standalone"; else if (root.matchMedia && root.matchMedia("(display-mode: fullscreen)").matches) mode = "fullscreen"; } catch (e) { mode = "browser"; }
    return { w: lay[0], h: lay[1], probe: box, vv, inner, sizeUpright: size[1] > size[0], word: word(), type, angle, wo, lock, mode, fake, override: orientParam || null };
  }

  // ------------------------------------------------------------------ the rule (pure)
  // decide(reading, { coarse, forced, word (else the reading's), settled (true unless said) }) → { upright, plate, turned, stale, held, word }
  function decide(r, o) {
    o = o || {};
    const coarse = !!o.coarse, forced = !!o.forced, w = o.word === undefined ? (r.word === undefined ? null : r.word) : o.word, settled = o.settled !== false;
    const su = !!r.sizeUpright;
    let upright, stale;
    if (coarse && w === "sideways") { upright = false; stale = su; }   // the phone's word vetoes: a sideways phone is never upright
    else { upright = su; stale = coarse && w === "upright" && !su; }   // (the phone says upright, the size not yet: nothing shows until they agree)
    const wants = upright && coarse && !forced;
    const plate = wants && (w !== null || settled);   // on the size alone the plate waits for a second look
    return { upright, plate, turned: forced && upright, stale, held: wants && !plate, word: w };
  }
  // (build 34) the key holds the box too (the probe: the layout viewport, which the game roots and the menu's fire fill): on Isaac's iPhone
  // the app opened upright and turned, the visible area read sideways at once while the box kept the upright height (874 x 812) a moment
  // longer, and its correction, with the visible size and the answer unchanged, refitted nothing: the fire stayed laid out 812 tall
  const keyOf = d => d.w + "x" + d.h + (d.probe ? "/" + d.probe[0] + "x" + d.probe[1] : "") + "|" + (d.upright ? "U" : "S") + (d.plate ? "P" : "-") + (d.turned ? "T" : "-");

  // ------------------------------------------------------------------ the log (pure where it can be)
  const trim = entries => (Array.isArray(entries) ? entries : []).slice(-KEEP);
  function loadLog() { try { const a = JSON.parse(store.get(KEY) || "null"); return Array.isArray(a) ? trim(a.filter(e => e && typeof e === "object")) : []; } catch (e) { return []; } }
  let memory = null;   // the entries, read once and kept (the store may be blocked)
  function log() { if (!memory) memory = loadLog(); return memory.slice(); }
  function remember(e) { if (!memory) memory = loadLog(); memory.push(e); memory = trim(memory); store.set(KEY, JSON.stringify(memory)); return e; }
  function clear() { memory = []; store.del(KEY); }
  const two = v => (v ? v[0] + "x" + v[1] : null);
  function entryOf(page, why, r, d, o) {
    return { t: new Date().toISOString(), page, why, w: r.w, h: r.h, vv: two(r.vv), inner: two(r.inner), probe: two(r.probe), type: r.type, angle: r.angle, wo: r.wo, lock: r.lock, mode: r.mode,
      forced: !!o.forced, coarse: !!o.coarse, word: d.word === undefined ? null : d.word, upright: !!d.upright, plate: !!d.plate, turned: !!d.turned, stale: !!d.stale, fake: !!r.fake, override: r.override || null };
  }
  // line(e): one entry as a line of the playtest notes
  function line(e) {
    const d = new Date(e.t), pad = v => String(v).padStart(2, "0");
    const when = isNaN(d.getTime()) ? String(e.t) : d.getDate() + " " + MONTHS[d.getMonth()] + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
    const result = e.plate ? "plate" : e.turned ? "turned" : e.upright ? "upright" : "sideways";
    const phone = e.word === null || e.word === undefined ? "no word" : (e.override ? "?orient=" + e.override : (e.type || e.word) + (e.angle === null || e.angle === undefined ? "" : "/" + e.angle));
    return when + " " + e.page + " " + e.why + " " + e.w + "×" + e.h + " (vv " + (e.vv || "?") + ", inner " + (e.inner || "?") + ", probe " + (e.probe || "?") + ") phone " + phone +
      " lock:" + e.lock + " " + e.mode + " switch:" + (e.forced ? "on" : "off") + (e.coarse ? "" : " mouse") + " → " + result + (e.stale ? " (size stale)" : "") + (e.fake ? " (test)" : "");
  }
  // notes(entries): the lines for Copy my playtest notes (the log's own entries unless given); [] when there are none
  function notes(entries) { const es = Array.isArray(entries) ? entries : log(); return es.length ? ["Screen log (newest last):"].concat(es.map(line)) : []; }

  // ------------------------------------------------------------------ the probe: a fixed, untransformed, full-viewport box outside every turned root
  function makeProbe() {
    if (!doc || !doc.createElement) return null;
    let el = doc.getElementById("ffTurnProbe");
    if (el) return el;
    el = doc.createElement("div"); el.id = "ffTurnProbe"; el.setAttribute("aria-hidden", "true");
    el.style.cssText = "position:fixed;left:0;top:0;right:0;bottom:0;width:auto;height:auto;margin:0;padding:0;border:0;visibility:hidden;pointer-events:none;z-index:-1;contain:strict";
    (doc.body || doc.documentElement).appendChild(el);
    return el;
  }

  // ------------------------------------------------------------------ the controller
  // mount({ page, coarse, forced: () => bool, fit: (d, why) => void }) → T. The page's fit calls T.apply() for its reading and lays out
  // from it; the controller's looks call fit only when the size, the box or the answer changed. Nothing looks until the page's script has run:
  // the arrival series starts on the next frame
  const Turn = { version: 1, KEEP, read, decide, wordOf, keyOf, trim, line, notes, log, clear, word, firing: false, mounted: null };
  function mount(o) {
    o = o || {};
    const page = o.page || "page", coarse = !!o.coarse;
    const forcedNow = typeof o.forced === "function" ? o.forced : () => !!o.forced;
    const fit = typeof o.fit === "function" ? o.fit : () => {};
    const probe = makeProbe();
    const T = { page, probe, now: null, applied: null, arrivedAt: nowMs(), looks: 0, fits: 0, nudges: 0 };
    let timers = [], raf = 0, fresh = null, pendingWhy = null, disagreeSince = 0, disagreeSaid = 0;
    const settled = () => nowMs() - T.arrivedAt >= SETTLE_MS;
    function current(why) {
      const forced = forcedNow(), r = read(probe), d = decide(r, { coarse, forced, settled: settled() });
      return Object.assign({ page, why: why || "fit", coarse, forced }, r, d);
    }
    function record(d) { const k = keyOf(d); if (k !== T.applied) { remember(entryOf(page, T.applied === null ? "boot" : d.why, d, d, d)); T.applied = k; } T.now = d; return d; }
    // apply(why): the page's fit asks for its reading (the look's own while one is in flight), and the decision becomes the applied one
    function apply(why) { const d = fresh || current(why || pendingWhy || "fit"); fresh = null; return record(d); }
    // nudge(): a synthetic resize on window and the visual viewport, so every other listener follows a change found without the native event
    function nudge() {
      if (Turn.firing) return;
      Turn.firing = true; T.nudges++;
      try { root.dispatchEvent(new Event("resize")); } catch (e) { /* no Event */ }
      try { if (root.visualViewport && root.visualViewport.dispatchEvent) root.visualViewport.dispatchEvent(new Event("resize")); } catch (e) { /* none */ }
      Turn.firing = false;
    }
    function disagreement(d) {
      if (!d.stale) { disagreeSince = 0; return; }
      const t = nowMs();
      if (!disagreeSince) disagreeSince = t;
      if (t - disagreeSince >= DISAGREE_MS && t - disagreeSaid >= DISAGREE_EVERY) { disagreeSaid = t; remember(entryOf(page, "disagree", d, d, d)); }
    }
    // look(why): read, and refit only when the size, the box or the answer changed
    function look(why) {
      T.looks++;
      const d = current(why);
      disagreement(d);
      if (d.held) later(SETTLE_MS - (nowMs() - T.arrivedAt) + 20, why + "+settled");   // (the plate waits: a look once settled)
      if (keyOf(d) === T.applied) { T.now = d; return d; }
      const native = why === "resize" || why === "vv-resize";
      fresh = d; pendingWhy = why; T.fits++;
      try { fit(d, why); } finally { fresh = null; pendingWhy = null; }
      if (keyOf(d) !== T.applied) record(d);   // (a fit that did not ask: the decision is applied all the same)
      if (!native) nudge();
      return d;
    }
    function clearSeries() { for (const t of timers) root.clearTimeout(t); timers = []; if (raf) { try { root.cancelAnimationFrame(raf); } catch (e) { /* none */ } raf = 0; } }
    function later(ms, why) { timers.push(root.setTimeout(() => look(why), Math.max(0, ms))); }
    // series(why): a look now, the next frame, then 150, 300, 600 and 1,200 ms (a new series clears the last one's timers)
    function series(why) {
      clearSeries();
      look(why);
      try { raf = root.requestAnimationFrame(() => { raf = 0; look(why + "+frame"); }); } catch (e) { later(16, why + "+frame"); }
      for (const ms of SERIES) later(ms, why + "+" + ms);
    }
    function arrive(why) { T.arrivedAt = nowMs(); series(why); }
    const onNative = why => () => { if (Turn.firing) return; series(why); };
    try { root.addEventListener("resize", onNative("resize")); } catch (e) { /* no window */ }
    try { root.addEventListener("orientationchange", onNative("orientationchange")); } catch (e) { /* none */ }
    try { if (root.visualViewport) root.visualViewport.addEventListener("resize", onNative("vv-resize")); } catch (e) { /* none */ }
    try { root.addEventListener("focus", () => series("focus")); } catch (e) { /* none */ }
    try { root.addEventListener("pageshow", e => arrive(e && e.persisted ? "pageshow-cache" : "pageshow")); } catch (e) { /* none */ }
    try { if (doc) doc.addEventListener("fullscreenchange", () => series("fullscreen")); } catch (e) { /* none */ }
    try { if (doc) doc.addEventListener("visibilitychange", () => { if (!doc.hidden) series("visible"); }); } catch (e) { /* none */ }
    try { const so = root.screen && root.screen.orientation; if (so && so.addEventListener) so.addEventListener("change", () => series("orientation")); } catch (e) { /* none */ }
    let observer = null;
    try { if (probe && typeof root.ResizeObserver === "function") { observer = new root.ResizeObserver(() => { if (T.applied !== null) look("probe"); }); observer.observe(probe); } } catch (e) { observer = null; }
    const tick = root.setInterval(() => { if (!(doc && doc.hidden)) look("tick"); }, TICK_MS);
    // the arrival: once the page's own script has run (its first fit is its own), so nothing is fitted before it is ready
    try { root.requestAnimationFrame(() => { if (T.applied !== null) arrive("boot"); else later(0, "boot+late"); }); } catch (e) { later(16, "boot"); }
    Object.assign(T, { apply, look, series, arrive, nudge, settled, get observer() { return observer; }, get tick() { return tick; },
      destroy() { clearSeries(); root.clearInterval(tick); if (observer) { try { observer.disconnect(); } catch (e) { /* gone */ } } } });
    Turn.mounted = T;
    return T;
  }
  Turn.mount = mount;
  root.Turn = Turn;
})(typeof window !== "undefined" ? window : globalThis);
