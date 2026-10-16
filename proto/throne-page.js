// FORGE FOREVER: the Throne's page (design pass 44 section 3.13 with revision 1; built by card t112, build 37 stage G). What level 4 adds
// to the Battlegrounds page beside the director's events: the King's talk box (his 32 x 32 face from proto/trolls.js on the lessons'
// plank, five lines a tap each, Skip from the second), his barks in a bubble over his head (a combo's, a hurt line when a combo is broken,
// a retry's), the gallery's whispers as notes, the cutscenes' input (next, skipCine, boxDone) and the .game.cine class that takes the
// buttons and the stick off the screen while one plays, the Wrath's pulse and flash, the end's hitstop and flashes, the narration band of
// the take's cutscene, and the Legend Ember's box with its words from the spec. proto/battlegrounds.js mounts it for a level whose spec
// has an intro and an end that pops (the Throne), hands it the page's hooks, and asks it on every event, step and input.
// Plain script, defines window.ThronePage; needs proto/lessons.js (the plank's CSS) and proto/trolls.js (his face).
(function (root) {
  "use strict";
  let H = null, E = null, S = null, I = null;   // the page's hooks, the elements, the module's state, the cine input
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const said = (v, d) => typeof v === "string" && v ? v : d;
  const CSS = ".king-talk{z-index:5}.king-talk .lsn-face{background:var(--stone-2,#2c2540)}" +
    ".king-says{position:absolute;left:0;top:0;transform:translate(-50%,-100%);max-width:220px;pointer-events:none!important;z-index:4}.king-says .lsn-words{white-space:nowrap}" +
    ".king-band{position:absolute;left:0;right:0;bottom:0;height:28%;min-height:64px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:6px calc(16px + var(--gr,0px)) calc(8px + var(--gb,0px)) calc(16px + var(--gl,0px));background:linear-gradient(to top,rgba(24,20,37,.94) 55%,rgba(24,20,37,.62) 82%,rgba(24,20,37,0));pointer-events:auto;cursor:pointer;z-index:4;-webkit-tap-highlight-color:transparent}" +
    ".king-band::before{content:\"\";position:absolute;inset:0;background:repeating-conic-gradient(rgba(24,20,37,.55) 0 25%,transparent 0 50%) 0 0/4px 4px;opacity:.7;pointer-events:none}" +
    ".king-band p{position:relative;margin:0;max-width:540px;text-align:center;font-family:var(--text,Alegreya,Georgia,serif);font-size:16px;line-height:1.3;color:var(--parch,#ead4aa);text-shadow:0 2px 0 #0d0a14;text-wrap:balance}" +
    ".king-band .king-tap{position:relative;font-family:var(--data,\"Pixelify Sans\",\"Courier New\",monospace);font-size:10.5px;letter-spacing:.14em;color:var(--mute,#b3a48c)}" +
    ".ember-icon{display:block;margin:2px auto 4px;image-rendering:pixelated;image-rendering:crisp-edges}" +
    ".still .king-band,.still .king-talk{animation:none}";
  // his face at a whole number of device pixels for a 32 px crop (about 72 CSS px: the lessons' face is 16 px at about 58)
  function faceCss(target) { const d = root.devicePixelRatio > 0 ? root.devicePixelRatio : 1, k = Math.max(1, Math.round(target * d / 32)); return 32 * k / d; }
  function faceEl(glow, mouth) {
    const T = root.Trolls; if (!T || !T.kingFace) return null;
    try {
      const fr = T.kingFace(glow, mouth), cv = root.document.createElement("canvas"); cv.width = 32; cv.height = 32; cv.className = "lsn-face"; cv.setAttribute("aria-hidden", "true");
      const g = cv.getContext("2d"); g.imageSmoothingEnabled = false; g.drawImage(fr.canvas(), 0, 0);
      cv.style.width = cv.style.height = faceCss(72) + "px";
      return cv;
    } catch (e) { return null; }
  }
  function ensure() {
    if (E) return E;
    const doc = root.document, Ls = root.Lessons;
    try { if (Ls && Ls.addCSS) Ls.addCSS(doc); } catch (e) { /* the plank still reads */ }
    if (!doc.getElementById("king-css")) { const st = doc.createElement("style"); st.id = "king-css"; st.textContent = CSS; doc.head.appendChild(st); }
    const layer = doc.createElement("div"); layer.className = "lsn king"; layer.style.zIndex = "5"; layer.hidden = true;
    const talk = doc.createElement("div"); talk.className = "lsn-plank talk king-talk"; talk.id = "kingTalk"; talk.setAttribute("role", "dialog"); talk.setAttribute("aria-live", "polite"); talk.hidden = true;
    talk.addEventListener("click", e => { if (e.target && e.target.closest && e.target.closest("[data-king-skip]")) return; I.next = true; });
    const says = doc.createElement("div"); says.className = "lsn-plank tiny tail king-says"; says.id = "kingSays"; says.setAttribute("role", "status"); says.hidden = true;
    says.innerHTML = '<div class="lsn-body noface"><p class="lsn-words"></p></div>';
    const band = doc.createElement("div"); band.className = "king-band"; band.id = "kingBand"; band.setAttribute("role", "status"); band.setAttribute("aria-live", "polite"); band.hidden = true;
    band.innerHTML = '<p></p><span class="king-tap">TAP TO CONTINUE</span>';
    band.addEventListener("click", () => { I.next = true; });
    layer.append(talk, says, band);
    H.game.appendChild(layer);
    // the box: a parchment plank over the paused level (the page's planks' look), its words from the spec
    const veil = doc.createElement("div"); veil.className = "veil"; veil.id = "emberVeil"; veil.hidden = true;
    veil.innerHTML = '<div class="plank f-parch" id="emberBox" role="dialog" aria-label="Legend Ember"><h2 id="emberTitle"></h2><p class="small" id="emberSub"></p><canvas class="ember-icon" id="emberIcon" width="24" height="24" aria-hidden="true"></canvas><p id="emberWhat"></p><p class="small" id="emberWhenLabel"></p><p id="emberWhen"></p><p class="small" id="emberBelow"></p><p id="emberHome"></p><div class="pbtns"><button class="f-ember primary" id="emberOk">Keep it safe</button></div></div>';
    H.game.appendChild(veil);
    veil.querySelector("#emberOk").addEventListener("click", () => { I.boxDone = true; S.box = false; try { H.closePlank(); } catch (e) { veil.hidden = true; } });
    if (H.VEILS) H.VEILS.ember = "emberVeil";
    // a tap on the stage, or Enter, Space, E or J, moves a cutscene's lines on
    const stage = H.$("stage"); if (stage) stage.addEventListener("click", () => { if (linesOn()) I.next = true; });
    root.addEventListener("keydown", e => { if (!linesOn() || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return; if (e.code === "Enter" || e.code === "Space" || e.code === "KeyE" || e.code === "KeyJ") { e.preventDefault(); I.next = true; } });
    E = { layer, talk, says, band, veil, box: veil.querySelector("#emberBox") };
    return E;
  }
  const linesOn = () => !!(S && (S.talk !== null || S.band));
  const fight = () => H.fight();
  const king = () => { const F = fight(); const b = F.level ? F.level.boss : null; return b && !b.dead ? b : (F.foes || []).find(f => f.kind === S.tag && !f.dead) || null; };

  // ------------------------------------------------------------------ the talk box, the bubble, the band, the box
  function showTalk(e) {
    const el = ensure().talk, PG = H.PG, who = said((PG.boss || {}).name, "THE TROLL KING"), count = e.of > 1 && !e.again ? `<span class="lsn-count">${e.i + 1} / ${e.of}</span>` : "";
    const cont = H.coarse ? "TAP TO CONTINUE" : "TAP OR PRESS SPACE";
    el.hidden = false; ensure().layer.hidden = false; hideSays();
    el.className = "lsn-plank talk king-talk" + (H.reduce ? "" : " rise");
    el.innerHTML = `<div class="lsn-body"><span class="lsn-who">${esc(who)}${count}</span><p class="lsn-words">${esc(e.words || "")}</p><div class="lsn-foot">${e.again ? "<span></span>" : `<span class="lsn-tap">${esc(cont)}</span>`}${e.skip ? '<button type="button" class="lsn-skip" data-king-skip>Skip</button>' : ""}</div></div>`;
    const f = faceEl(e.mouth === 2 ? 2 : 1, e.mouth || 1), body = el.firstChild; if (f) body.prepend(f); else body.classList.add("noface");
    const sk = el.querySelector("[data-king-skip]"); if (sk) sk.addEventListener("click", ev => { ev.stopPropagation(); I.skipCine = true; });
    if (!H.reduce) root.setTimeout(() => { try { el.classList.remove("rise"); } catch (err) { /* gone */ } }, 300);
    S.talk = e.i; S.lines.push(e.words || "");
    placeTalk();
  }
  function hideTalk() { if (!E) return; E.talk.hidden = true; S.talk = null; if (!S.band && E.says.hidden) E.layer.hidden = true; }
  // the box over the stage's bottom, from inset to inset: the ribbon's width rule (63 % of the width, 216 to 540), his face at its left
  function placeTalk() {
    if (!E || E.talk.hidden || !H.state.layout) return;
    const Lo = H.state.layout, availW = Math.max(200, (Lo.gw || 0) - (Lo.pl || 0) - (Lo.pr || 0)), w = Math.round(clamp(0.63 * availW, 216, 540)), gh = Lo.gh || (Lo.pt || 0) + (Lo.h || 0) * (Lo.s || 1);
    E.talk.style.width = w + "px"; E.talk.style.left = Math.round((Lo.pl || 0) + (availW - w) / 2) + "px";
    E.talk.style.top = Math.max((Lo.pt || 0) + 44, Math.round(gh - E.talk.offsetHeight - 10 - (Lo.pb || 0))) + "px";
  }
  // a bark: one at a time, 1 s each, over his head, never over the talk box or the plate (it waits for the bubble, and for the box)
  function bark(text, now) {
    if (!text) return false;
    if (S.sayUntil > H.state.t && !now) { S.sayQueue = text; return false; }
    const el = ensure().says; el.querySelector(".lsn-words").textContent = text; el.hidden = !!(S.talk !== null); ensure().layer.hidden = false;
    S.sayUntil = H.state.t + 1.0; S.sayText = text; S.barks.push(text); if (S.barks.length > 20) S.barks.shift();
    placeSays();
    return true;
  }
  function hideSays() { if (E) E.says.hidden = true; S.sayUntil = 0; }
  function placeSays() {
    if (!E || E.says.hidden) return;
    const f = king(), L = H.state.layout, F = fight(); if (!f || !L || !F.view) { E.says.hidden = true; return; }
    const wide = (L.gw || L.w) - L.pl - (L.pr || 0), half = Math.ceil((E.says.offsetWidth || 60) / 2) + 2;
    const x = Math.round(clamp(L.x - L.pl + (f.x - F.view.x0) * L.s, half, wide - half)), y = Math.round(L.y - L.pt + (f.y - (f.z || 0) - F.view.y0 - 92) * L.s);
    E.says.style.left = x + "px"; E.says.style.top = Math.max(84, y) + "px";
  }
  function showBand(words) { const el = ensure().band; el.querySelector("p").textContent = words || ""; el.hidden = false; ensure().layer.hidden = false; S.band = true; hideSays(); }
  function hideBand() { if (!E) return; E.band.hidden = true; S.band = false; if (S.talk === null && E.says.hidden) E.layer.hidden = true; }
  // the box's words from the spec: {crucible} the grammar's fuse level, {level} the player's level from the smith's XP, {left} the levels to go
  function openBox() {
    const el = ensure(), W = (H.PG || {}).ember || {}, G = root.FORGE_GRAMMAR || {}, cru = (G.fuse || {}).level || 25, xp = H.smith && typeof H.smith.xp === "number" ? H.smith.xp : null;
    const lvl = xp !== null && root.Progress && root.Progress.levelFor ? root.Progress.levelFor(xp) : (H.smith && H.smith.level) || 1, left = Math.max(0, cru - lvl);
    const put = (id, text) => { const q = el.box.querySelector("#" + id); if (!q) return; q.hidden = !text; q.textContent = text || ""; };
    put("emberTitle", said(W.title, "Legend Ember")); put("emberSub", said(W.sub, "")); put("emberWhat", said(W.what, ""));
    put("emberWhenLabel", said(W.whenLabel, "")); put("emberWhen", said(W.when, "").replace("{crucible}", String(cru)));
    put("emberBelow", left === 0 ? said(W.ready, "") : (left === 1 ? said(W.belowOne, "") : said(W.below, "")).replace("{level}", String(lvl)).replace("{left}", String(left)));
    put("emberHome", H.visiting ? said(W.visiting, "") : said(W.home, ""));
    el.box.querySelector("#emberOk").textContent = H.visiting ? said(W.okVisiting, "I see") : said(W.ok, "Keep it safe");
    el.box.setAttribute("aria-label", said(W.title, "Legend Ember"));
    try { const Th = root.Throne, cv = el.box.querySelector("#emberIcon"), g = cv.getContext("2d"); g.imageSmoothingEnabled = false; g.clearRect(0, 0, 24, 24); if (Th && Th.sprites && Th.sprites.emberIcon) g.drawImage(Th.sprites.emberIcon(0).canvas(), 0, 0); const d = root.devicePixelRatio > 0 ? root.devicePixelRatio : 1, k = Math.max(1, Math.round(96 * d / 24)); cv.style.width = cv.style.height = (24 * k / d) + "px"; } catch (e) { /* the box reads without its icon */ }
    hideBand(); S.box = true;
    try { H.openPlank("ember"); } catch (e) { el.veil.hidden = false; }
  }
  function setCine(on) { on = !!on; if (on === S.cine) return; S.cine = on; H.game.classList.toggle("cine", on); if (on) { H.input.strike = false; H.input.guard = false; } if (!on) { hideTalk(); hideBand(); } }

  // ------------------------------------------------------------------ the events (true: taken here; false: the page's own handlers go on)
  function take(e) {
    const PG = H.PG, B = PG.boss || {}, F = fight();
    switch (e.type) {
      case "cine": {
        if (e.kind === "intro") { if (e.step === "enter") { setCine(true); S.introAt = F.t; } if (e.step === "rise" || e.step === "roar" || e.step === "leap") hideTalk(); if (e.step === "done") { setCine(false); S.introDone = true; } }
        else if (e.kind === "end") { if (e.step === "freeze") setCine(true); if (e.step === "done") setCine(false); }
        else if (e.kind === "ember") { if (e.step === "take") setCine(true); if (e.step === "lines" || e.step === "box") hideSays(); }
        S.cineStep = e.kind + ":" + e.step;
        return true; }
      case "cineLine": if (e.who === "narrator") showBand(e.words); else showTalk(e); return true;
      case "cineSkip": hideTalk(); hideBand(); return true;
      case "roar": bark(e.line || "KNEEL!", true); return true;
      case "doorsOpen": return true;
      case "doorsShut": H.shake(2, 0.15); return true;
      // a combo's bark (the event names its key: staff, charge, beam, slam), at most one every `every` s and by its chance; a combo broken by
      // a parry or a stagger gets a hurt line
      case "kingCombo": { const BK = B.barks || {}, key = e.bark; if (key && typeof BK[key] === "string" && H.state.t >= S.barkAt && H.rnd() < (BK.chance === undefined ? 0.35 : BK.chance)) { S.barkAt = H.state.t + (BK.every || 8); bark(BK[key]); } return true; }
      case "comboEnd": { const BK = B.barks || {}, hurt = Array.isArray(BK.hurt) ? BK.hurt : [], broken = !!e.why && e.why !== "done" && e.why !== "miss" && e.why !== "rest" && e.why !== "ultimate" && e.why !== "dead"; if (broken && hurt.length && H.state.t >= S.barkAt) { S.barkAt = H.state.t + (BK.every || 8) / 2; bark(hurt[S.hurtI++ % hurt.length]); } return true; }
      case "kingMove": return true;
      case "ultStart": { S.ult = e.kind; S.ultFirst = e.kind; S.ultFirstAt = H.state.t + 2.5; return true; }   // (its first-time line after the phase's line, at the ultimate's priority: tick)
      case "ultStep": return true;
      case "ultDone": S.ult = null; return true;
      case "kneel": return true;
      case "wrathPulse": { H.shake(1, 0.12); H.addFx({ kind: "flash", x: e.x, y: e.y, r: 36 + 6 * (e.k || 0), life: 0.3 }); return true; }
      case "wrath": H.flash(0.22); return true;
      case "ruin": H.flash(0.12); return true;
      case "grind": case "grindStop": case "grindBreak": case "propCrack": case "propRestore": case "foeImmune": case "crash": case "flight": case "flightEnd": case "beamFire": case "empower": case "whisper": case "wake": return true;
      case "propBreak": H.shake(2, 0.15); return true;
      case "checkpoint": H.toast("Checkpoint"); return true;
      case "retryAt": return true;
      case "spawn": if (e.kind === S.tag && e.retry) { const R = (H.AREA.intro || {}).retry; if (Array.isArray(R) && R.length) bark(R[S.retryI++ % R.length], true); return true; } return e.kind === S.tag;
      case "kingDown": { H.hold(e.hold || 0); H.lv.bossT1 = F.t; H.mark("throneDown", true); if (!e.first) H.note(said(B.falls, "The Troll King falls."), "boss"); setCine(!!e.first || true); return true; }
      case "kingFreeze": return true;
      case "kingPop": H.flash(e.flash || 0.12); return true;
      case "emberHang": case "emberDown": case "emberTake": return true;
      case "emberDrop": if (e.line) H.note(e.line, "boss"); return true;
      case "emberBox": openBox(); return true;
      case "emberTaken": { H.mark("emberTaken", true); setCine(false); hideBand(); return true; }
      default: return false;
    }
  }
  // the cutscenes' input, once a step (a driver's, the harness's squire, says next, skipCine or boxDone too)
  function input(inp, T) {
    if (I.next || (T && T.next)) inp.next = true;
    if (I.skipCine || (T && T.skipCine)) inp.skipCine = true;
    if (I.boxDone || (T && T.boxDone)) inp.boxDone = true;
    I.next = I.skipCine = I.boxDone = false;
    if (T) { T.next = T.skipCine = T.boxDone = undefined; }
    return inp;
  }
  // once a step: the whispers by the lead's y, the bubble's clock and place, the box's place, the cine class by the fight's state
  function tick() {
    const F = fight(); if (!F || !F.knights) return;
    const lead = F.knights.reduce((m, k) => (!k.out && !k.down && (m === null || k.y < m.y) ? k : m), null);
    if (lead && !S.introDone) for (const w of H.AREA.whispers || []) { if (S.whispered.has(w.y) || lead.y > w.y) continue; if (H.note(w.line, "whisper")) S.whispered.add(w.y); }   // (a whisper dropped for a higher line is said at the next step)
    // an ultimate's first-time line (Get behind a pillar!), once a phone, said as soon as the note is free of the phase's line
    if (S.ultFirst && H.state.t >= S.ultFirstAt) { const line = (H.PG.firsts || {})[S.ultFirst]; if (!line || H.firstTime(S.ultFirst, line, "ult", 3.5)) S.ultFirst = null; }
    const on = !!(F.cine && F.cine.lock); if (on !== S.cine) setCine(on);
    if (S.sayUntil && H.state.t >= S.sayUntil) { hideSays(); if (S.sayQueue) { const q = S.sayQueue; S.sayQueue = null; bark(q, true); } }
    if (E && !E.says.hidden) placeSays();
    if (E && !E.talk.hidden) placeTalk();
  }
  const locked = () => { const F = fight(); return !!(F && F.cine && F.cine.lock); };
  // the boss plate's notches: the phases that are his ultimates, by their shares of his health (67 and 33 %)
  function notches() { const out = []; for (const w of H.AREA.waves || []) for (const p of w.phases || []) if (p.ult && Array.isArray(p.when)) for (const c of p.when) if (typeof c.below === "number") out.push(c.below); return out.length ? out : [0.7, 0.4]; }
  function mount(h) {
    H = h; S = { tag: (h.PG.boss || {}).tag || "king", cine: false, talk: null, band: false, box: false, lines: [], barks: [], sayUntil: 0, sayText: "", sayQueue: null, barkAt: 0, hurtI: 0, retryI: 0, ult: null, ultFirst: null, ultFirstAt: 0, whispered: new Set(), introAt: null, introDone: false, cineStep: null };
    I = { next: false, skipCine: false, boxDone: false };
    ensure();
    return api;
  }
  const api = { mount, take, input, tick, locked, notches, bark, openBox, get state() { return S ? { cine: S.cine, talk: S.talk, band: S.band, box: S.box, lines: S.lines.slice(), barks: S.barks.slice(), ult: S.ult, step: S.cineStep, whispered: S.whispered.size } : null; }, get el() { return E; }, get pressed() { return I; } };
  root.ThronePage = api;
})(typeof window !== "undefined" ? window : globalThis);
