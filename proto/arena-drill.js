// FORGE FOREVER: the Drill (design pass 39, card t99, build 30): Grycus teaching the sand from the stand. A lesson on the Arena's own
// sand against Mara of the house (sword and bow, squire skill), in seven steps, each ended by the rules' own events: Guard (block two
// of her cuts), the parry (press Guard as the blade comes), the break (hit her till her gold bar breaks, then the CRIT), Dodge (through
// the first blow of her chain, so it cuts air), the rise (her finisher puts you down; Dodge as you lie rises at once), Rally (hit back
// within two breaths and the orange comes back), and finish her (the house's brain fights; her KO ends it). The drill's bout is
// proto/arena-page.js's (a local session, never the wire; fight.arena.drill set: the clock stands, the kid's blows taken x 0.25 and
// refilled at 0, no record, no XP); this file is the lesson over it: the step machine on spec/arena.json's drill.steps (the words,
// the targets, what ends each step, the bonk lines), Grycus's ribbon plank on proto/lessons.js's look (Lessons.addCSS and Lessons.face;
// never its step list or its record: tools/test-lessons.js pins that list), the glow on the button the step is about, the coach that
// gives Mara her input while a step has one (the house's brain otherwise), the record (drill.key: { v, done, skipped, runs }), and
// Skip. Plain script, defines window.ArenaDrill; needs spec/arena.js (window.FORGE_ARENA) and proto/combat.js's reachOf; lessons.js
// and grycus.js for the look, when they are there.
//
//   ArenaDrill.mount(hooks)            the page's hooks: { $, root (#game), store, state (the page's), reduce, coarse, Combat, getFight, onEnd(why) }
//   ArenaDrill.due()                   true when a phone with no drill done should run it first (spec drill.first; ?drill=0 says never, ?drill=1 always)
//   ArenaDrill.start(fight)            the lesson begins on this bout (the walk-in first: the plank waits for FIGHT)
//   ArenaDrill.coach(fight)            Mara's input this step (seat 1), or undefined for the house's brain
//   ArenaDrill.events(events, fight)   the rules' events: what ends a step, what bonks
//   ArenaDrill.tick(fight)             once a step of the page's clock: the walk-in's wait, a stall's nudge, the plank's place
//   ArenaDrill.line()                  the round plate's words: THE DRILL · A3 THE BREAK
//   ArenaDrill.finish() / skip() / end()   the KO's end (the record says done), Skip (asks; done and skipped), the page leaving (nothing written)
//   ArenaDrill.record() / markDone(skipped) / forget()
//   ArenaDrill.active, .step, .state (for the harnesses)
(function (root) {
  "use strict";
  const A = () => root.FORGE_ARENA || {};
  const D = () => A().drill || {};
  const Wd = () => D().words || {};
  let H = null, L = null;   // the page's hooks; the lesson's live state while it runs
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
  const fill = (s, o) => String(s || "").replace(/\{(\w+)\}/g, (m, k) => (o && o[k] !== undefined ? o[k] : m));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const param = k => { try { return H && H.params ? H.params.get(k) : null; } catch (e) { return null; } };

  // ------------------------------------------------------------------ the record: this phone's own
  function record() {
    const key = D().key || "forge-forever:arena-drill";
    let r = null; try { r = JSON.parse(H.store.get(key) || "null"); } catch (e) { r = null; }
    if (!r || typeof r !== "object" || r.v !== 1) r = { v: 1, done: null, skipped: false, runs: 0 };
    return r;
  }
  function write(r) { try { H.store.set(D().key || "forge-forever:arena-drill", JSON.stringify(r)); } catch (e) { /* kept for the session */ } return r; }
  function markDone(skipped) { const r = record(); r.done = new Date().toISOString(); r.skipped = !!skipped; r.runs = (r.runs | 0) + 1; return write(r); }
  function forget() { try { H.store.del(D().key || "forge-forever:arena-drill"); } catch (e) { /* nothing kept */ } }
  function due() {
    if (!D().on) return false;
    const p = param("drill"); if (p === "0") return false; if (p === "1") return true;
    if (D().first === false) return false;
    return !record().done;
  }

  // ------------------------------------------------------------------ the steps
  const steps = () => D().steps || [];
  const stepAt = i => steps()[i] || null;
  const desktop = () => !!(H && H.coarse === false);
  function wordsOf(st) { return (desktop() && st.desktop) || st.words || ""; }

  // ------------------------------------------------------------------ the plank: Grycus from the stand, in the cellar's ribbon over the stand
  let layer = null, plank = null, ask = null;
  function ensureLayer() {
    if (layer) return layer;
    const doc = root.document, Ls = root.Lessons;
    try { if (Ls && Ls.addCSS) Ls.addCSS(doc); } catch (e) { /* the plank still reads */ }
    if (!doc.getElementById("drill-css")) {
      const st = doc.createElement("style"); st.id = "drill-css";
      st.textContent = ".drill-glow{box-shadow:0 0 0 3px var(--brass,#feae34),0 0 14px 4px rgba(247,118,34,.6)!important;animation:drill-breathe 1.1s ease-in-out infinite}" +
        "@keyframes drill-breathe{50%{box-shadow:0 0 0 3px var(--brass,#feae34),0 0 22px 8px rgba(247,118,34,.95)}}" +
        ".still .drill-glow,.drill-still .drill-glow{animation:none;box-shadow:0 0 0 3px var(--brass,#feae34),0 0 0 5px var(--soot,#181425)!important}";
      doc.head.appendChild(st);
    }
    layer = doc.createElement("div"); layer.className = "lsn drill"; layer.style.zIndex = "5"; layer.hidden = true;
    plank = doc.createElement("div"); plank.className = "lsn-plank ribbon"; plank.setAttribute("role", "status"); plank.setAttribute("aria-live", "polite");
    ask = doc.createElement("div"); ask.className = "lsn-ask f-parch"; ask.hidden = true; ask.setAttribute("role", "dialog");
    layer.append(plank, ask);
    (H.root || doc.getElementById("game")).appendChild(layer);
    plank.addEventListener("click", e => { if (e.target && e.target.closest && e.target.closest("[data-drill-skip]")) return; onTap(); });
    return layer;
  }
  function faceEl() {
    const Ls = root.Lessons; if (!Ls || !Ls.face) return null;
    try { const f = Ls.face(4, root.document); if (f) { f.style.width = f.style.height = "58px"; } return f; } catch (e) { return null; }
  }
  function render() {
    if (!L || !layer) return;
    const st = stepAt(L.i); if (!st) { layer.hidden = true; return; }
    const W = Wd(), text = L.bonk ? L.bonk.words : wordsOf(st), tap = !!(st.ends && st.ends.on === "tap"), count = st.ends && st.ends.count > 1 ? `<span class="lsn-count">${L.count} / ${st.ends.count}</span>` : "";
    const cont = (W.continue || {})[desktop() ? "desktop" : "touch"] || "TAP TO CONTINUE";
    const key = [L.i, text, L.count, tap, L.shown].join("|");
    layer.hidden = false;
    if (plank.dataset.key !== key) {
      plank.dataset.key = key;
      plank.className = "lsn-plank ribbon" + (H.reduce ? "" : " rise");
      plank.innerHTML = `<div class="lsn-body"><span class="lsn-who">${esc(W.who || "Grycus · from the stand")}${count}</span><p class="lsn-words">${text}</p><div class="lsn-foot">${tap ? `<span class="lsn-tap">${esc(cont)}</span>` : "<span></span>"}<button type="button" class="lsn-skip" data-drill-skip>${esc(W.skip || "Skip the drill")}</button></div></div>`;
      const f = faceEl(), body = plank.firstChild; if (f) body.prepend(f); else body.classList.add("noface");
      const sk = plank.querySelector("[data-drill-skip]"); if (sk) sk.addEventListener("click", e => { e.stopPropagation(); openAsk(); });
      if (!H.reduce) root.setTimeout(() => { try { plank.classList.remove("rise"); } catch (e) { /* gone */ } }, 300);
    }
    place();
    glow(st);
  }
  // over the stand under the HUD's top row, from inset to inset: the ribbon's width rule (lessons.js's: 63 % of the width, 216 to 540)
  function place() {
    if (!L || !plank || !H.state || !H.state.layout) return;
    const Lo = H.state.layout, availW = Math.max(200, (Lo.gw || 0) - (Lo.pl || 0) - (Lo.pr || 0)), w = Math.round(clamp(0.63 * availW, 216, 540));
    plank.style.width = w + "px"; plank.style.left = Math.round((Lo.pl || 0) + (availW - w) / 2) + "px"; plank.style.top = Math.round((Lo.pt || 0) + 44) + "px";
  }
  const TARGETS = { guard: "guardBtn", dodge: "dodgeBtn", strike: "strikeBtn", swap: "swapBtn" };
  function glow(st) {
    const want = st && st.target ? TARGETS[st.target] : null;
    for (const id of Object.values(TARGETS)) { const el = H.$(id); if (!el) continue; el.classList.toggle("drill-glow", id === want && !L.bonk); }
  }
  function unglow() { for (const id of Object.values(TARGETS)) { const el = H.$(id); if (el) el.classList.remove("drill-glow"); } }
  function openAsk() {
    if (!L || !ask) return; const W = Wd();
    ask.innerHTML = `<h3>${esc(W.skipAsk || "Skip the drill?")}</h3><p>${esc(W.skipWords || "")}</p><div class="lsn-two"><button type="button" class="f-ember" data-yes>${esc(W.skipYes || "Skip")}</button><button type="button" class="f-iron" data-no>${esc(W.skipNo || "Stay")}</button></div>`;
    ask.hidden = false; L.asking = true; plank.hidden = true;
    ask.querySelector("[data-yes]").addEventListener("click", () => skip());
    ask.querySelector("[data-no]").addEventListener("click", () => { ask.hidden = true; L.asking = false; plank.hidden = false; });
  }

  // ------------------------------------------------------------------ the step machine
  function start(fight) {
    end();
    L = { i: 0, count: 0, bonk: null, bonkUntil: 0, shown: false, asking: false, began: fight ? fight.t : 0, stepAt: fight ? fight.t : 0, lastDodge: -1e9, hold: 0, nextCut: 0, cuts: 0, nudged: false, over: false, poiseWas: null };
    ensureLayer(); layer.hidden = true;
    enter(fight);
  }
  function enter(fight) {
    const st = stepAt(L.i); L.count = 0; L.bonk = null; L.nudged = false; L.stepAt = fight ? fight.t : 0; L.hold = 0; L.nextCut = 0; L.cuts = 0;
    if (!st) return;
    // Mara's poise for the break: the step says a smaller bar; it comes back when the step ends
    const m = fight && fight.knights ? fight.knights[1] : null;
    if (m) { if (L.poiseWas !== null) { m.poiseMax = L.poiseWas; m.poise = Math.min(m.poise, m.poiseMax); L.poiseWas = null; } if (st.poise) { L.poiseWas = m.poiseMax; m.poiseMax = st.poise; m.poise = Math.min(m.poise, st.poise); } }
    if (fight && fight.arena && fight.arena.drill) fight.arena.drill.full = !!st.full;   // (Rally's step: her one cut lands whole, so there is orange to win back)
    if (L.shown) render();
  }
  function advance(fight) {
    if (!L || L.over) return;
    const n = steps().length;
    if (L.i + 1 >= n) { L.over = true; return; }
    L.i++; enter(fight); render();
  }
  function onTap() { if (!L || L.asking || L.over) return; const st = stepAt(L.i); if (st && st.ends && st.ends.on === "tap") advance(H.getFight()); else nudge(); }
  function nudge() { if (!plank || H.reduce) return; plank.classList.remove("nudge"); void plank.offsetWidth; plank.classList.add("nudge"); }
  function bonk(st, which, fight) {
    const b = st.bonk; if (!b || b.on !== which) return;
    L.bonk = { words: b.words, on: which }; L.bonkUntil = (fight ? fight.t : 0) + (b.ms || 1600) / 1000; render();
  }
  // the rules' events of a step: the ones this step ends on, the ones that bonk
  function events(list, fight) {
    if (!L || L.over || !L.shown) return;
    const st = stepAt(L.i); if (!st || !st.ends || st.ends.on !== "event") return;
    for (const e of list) {
      const name = nameOf(e, fight); if (!name) continue;
      if (name === st.ends.event) { L.count++; if (L.count >= (st.ends.count || 1)) { advance(fight); return; } render(); }
      else if (st.bonk && st.bonk.on === name) bonk(st, name, fight);
    }
  }
  // the drill's names for the rules' events: block, parry, crit, dodgedWhiff (Mara's whiff within 0.6 s of the kid's dodge), quickRise,
  // slowRise, rally, ko (hers)
  function nameOf(e, fight) {
    const t = fight ? fight.t : 0;
    if (e.type === "block" && e.seat === 0 && !e.shot) return "block";
    if (e.type === "parry" && e.seat === 0) return "parry";
    if (e.type === "hit" && e.knight && e.crit && e.by === 0 && e.d === 1) return "crit";
    if (e.type === "dodge" && e.seat === 0) { L.lastDodge = t; return null; }
    if (e.type === "whiff" && e.seat === 1 && t - L.lastDodge <= 0.6) return "dodgedWhiff";
    if (e.type === "rise" && e.seat === 0) return e.quick ? "quickRise" : "slowRise";
    if (e.type === "rally" && e.seat === 0 && e.amount >= 0.5) return "rally";
    if (e.type === "ko" && e.seat === 1) return "ko";
    return null;
  }
  // once a step of the page's clock: the plank waits for FIGHT; the bonk line's time; a stall's nudge (the words shown again, nudged)
  function tick(fight) {
    if (!L || !fight || !fight.arena) return;
    const t = fight.t;
    if (!L.shown) { if (fight.arena.phase === "fight") { L.shown = true; L.stepAt = t; render(); } return; }
    if (L.bonk && t >= L.bonkUntil) { L.bonk = null; render(); }
    const st = stepAt(L.i);
    if (st && !L.nudged && st.ends && st.ends.on === "event" && t - L.stepAt >= (D().stall || 20)) { L.nudged = true; nudge(); }
    if (L.over && fight.arena.phase === "boutEnd") finish();
  }
  function line() {
    const st = L ? stepAt(L.i) : null, W = Wd();
    return (W.round || "THE DRILL") + (st ? " · A" + L.i + " " + String(st.label || st.id).toUpperCase() : "");
  }

  // ------------------------------------------------------------------ the coach: Mara's input this step (seat 1), from the sim's own state
  function coach(fight) {
    if (!L || !fight || !fight.knights || fight.knights.length < 2) return undefined;
    const st = stepAt(L.i), how = st ? st.coach : "fight";
    if (!how || how === "fight" || !L.shown) return undefined;   // (before FIGHT the walk-in moves her; the house's brain fights her last step)
    const m = fight.knights[1], k = fight.knights[0], C = H.Combat, out = { move: [0, 0], strike: false, swap: false, dodge: false, guard: false, ability: false };
    if (!m || !k || m.ko || m.out) return out;
    const dx = k.x - m.x, dy = k.y - m.y, dd = Math.hypot(dx, dy) || 1, ux = dx / dd, uy = dy / dd;
    const u = m.hands[m.active] ? m.hands[m.active].u : null, reach = (u && u.melee && C && C.reachOf ? C.reachOf(u) : 20) * 0.9 + (k.r || 6);
    const face = () => { out.move = [ux * 0.06, uy * 0.06]; };
    if (how === "stand") { if (dd > 44) out.move = [ux, uy]; else face(); return out; }
    const t = fight.t;
    if (m.lie > 0 || m.rising > 0 || m.staggered > 0 || m.st.freeze || m.st.stun) return out;
    if (dd > reach) { out.move = [ux, uy]; return out; }
    face();
    if (how === "cuts" || how === "oneCut") {
      if (how === "oneCut" && L.cuts >= 1) return out;
      if (t >= L.nextCut) { out.strike = true; L.nextCut = t + (D().cutEvery || 1.2); L.cuts++; }
      return out;
    }
    if (how === "chains") {
      // a three-blow chain: Strike held for its length (holding carries the chain on), then a rest
      if (L.hold <= 0 && t >= L.nextCut) { L.hold = D().chainHold || 1.6; L.nextCut = t + (D().chainEvery || 2.0) + L.hold; }
      if (L.hold > 0) { L.hold -= 1 / 60; out.strike = true; }
      return out;
    }
    return out;
  }

  // ------------------------------------------------------------------ the ends
  function finish() { if (!L || L.finished) return; L.finished = true; markDone(false); hidePlank(); if (H.onEnd) H.onEnd("done"); }
  function skip() { if (!L) return; markDone(true); hidePlank(); const fin = () => { if (H.onEnd) H.onEnd("skipped"); }; end(); fin(); }
  function hidePlank() { if (layer) layer.hidden = true; if (ask) ask.hidden = true; unglow(); }
  function end() {
    if (L) { const f = H.getFight ? H.getFight() : null, m = f && f.knights ? f.knights[1] : null; if (m && L.poiseWas !== null) { m.poiseMax = L.poiseWas; m.poise = Math.min(m.poise, m.poiseMax); } }
    L = null; hidePlank();
  }
  function mount(hooks) { H = hooks; return api; }

  const api = { mount, due, start, coach, events, tick, line, finish, skip, end, record, markDone, forget, place, render,
    get active() { return !!L && !L.finished; }, get step() { const st = L ? stepAt(L.i) : null; return st ? st.id : null; },
    get state() { return L ? { i: L.i, step: this.step, count: L.count, shown: L.shown, bonk: L.bonk ? L.bonk.on : null, over: L.over, finished: !!L.finished, asking: L.asking, words: plank && !plank.hidden && !layer.hidden ? plank.textContent : "", glow: Object.values(TARGETS).filter(id => { const el = H.$(id); return el && el.classList.contains("drill-glow"); }) } : null; } };
  root.ArenaDrill = api;
})(typeof window !== "undefined" ? window : globalThis);
