// FORGE FOREVER: forge-lessons.js (design pass 16 with its revision 1, the first five minutes; built by build 8, stages D and F).
// Grycus teaches the first forge on the real Forge and says good luck: proto/lessons.js's controller mounted on the Forge's game root
// (#app), told what glows at each step and where his plank goes (view), and moved on by the Forge's own hooks. Loaded after
// spec/lessons.js, smith.js and lessons.js and before the-forge.js, which calls the hooks below through lessonOn(name, ...); this file
// reaches the page through window.TheForge. Plain script, defines window.ForgeLessons. His words are spec/lessons.json's.
//
//   F1 the welcome and F1b his deal (a glance at the coin chip): his big plank over his head with its tail, the veil, a tap continues;
//      F1 has Skip the lessons. He counts as met from F1: his three meet lines never play.
//   F2 the empty ADD slot glows (his plank over his head); its tap opens the walls on Materials.
//   F3 the Cart on the Materials wall glows (the walls open: he is not drawn, so his plank keeps away from it, his face says who talks).
//   F4 the Fire row in the Cart glows (scrolled into view; the purse topped up to 30 if a save says less). In the lessons only, the
//      bought Fire's sprite flies from its row onto ADD in 0.4 s while the coin chip counts down, and the walls close: F5.
//   F5 Strike glows (over his head again). The forging plays with no veil and no words; a tap skips it, as always.
//   F6 Emberbane's plaque in lesson mode: TAP ANYWHERE TO CONTINUE hidden, Equip and Share under the veil, only Try it in the cellar
//      lit, his words small over the empty parchment above the name, no remark. Try it moves the record on to the cellar's first step
//      and goes down as always: Emberbane in hand, the Sword in the other.
//   the cellar's steps are the cellar's (it reads the record itself); opened in the Forge they are his resume line, the door glowing.
//   the farewell, back from the cellar: his largest plank in the middle with Into the wild glowing in it; the gift once (the purse and
//      the crate, saved before the coin chip counts up); then the lessons are done and he is pass 17's Grycus again, and Into the wild
//      walks to the Troll Gate (wild: the handoff, then battlegrounds.html?area=gate).
// Resuming (section 3.7): every step comes back after a reload or the back gesture with the state it needs (settle, consistent,
// prepare). Skip the lessons (F1's link, and a row in Settings while they run) gives exactly the end state of finishing, recorded
// skipped. The bench (Developer, in Settings): Start the lessons over (the old Start fresh), Skip to the cellar lessons, Play as the
// dev smith. ?lessons=1 (with ?stay=1, for the checks) makes a test player, Tester, with the lessons at the welcome.
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const stay = params.get("stay") === "1";
  const Ls = window.Lessons || null, Sm = window.Smith || null;
  const TF = () => window.TheForge || null;
  const D = () => window.FORGE_LESSONS || {};
  const WORDS = () => D().words || {};
  const BUY = () => Object.assign({ thing: "fire", coins: 30 }, D().buy || {});
  const GIFT = () => Object.assign({ coins: 120, each: 3, stores: ["Elements", "Materials", "Curios"] }, D().gift || {});
  const BASE = () => (D().start || {}).base || "sword";
  const CART = { kind: "cart", key: "The Trader's Cart" };
  const nowIso = () => new Date().toISOString().replace(/\.\d+Z$/, "Z");
  let L = null;   // lessons.js's controller on #app, from the boot
  const live = { flying: false, leaving: false, pinned: false, counting: 0 };
  const rows = { skip: null };
  const still = () => { const F = TF(); return !!(F && F.reduce) || !!(window.Settings && Settings.reduce()); };

  // ------------------------------------------------------------------ who is playing (called by the Forge's boot, before its load)
  // { id, name } from the player record; "menu" when there is none and the main menu should ask the name (normal use); null for the
  // dev smith (no record under ?stay=1, the harnesses and the pictures). ?lessons=1 with ?stay=1 makes Tester, the lessons started
  function who() {
    if (!Sm || !Ls) return null;
    const r = Sm.read();
    if (r) return { id: r.id, name: r.name };
    if (!stay) return "menu";
    if (params.get("lessons") === "1") { const t = Sm.make("Tester"); Ls.start(t.id); return { id: t.id, name: t.name }; }
    return null;
  }

  // ------------------------------------------------------------------ what glows, and where his plank goes
  // Emberbane: the ledger's Sword + Fire (its id stayed emberbrand when it was renamed)
  function emberbane() {
    const F = TF(), Fo = window.Forge;
    try { const a = F.world.get(BASE()), b = F.world.get(BUY().thing), [k, x, y] = Fo.roles(a, b), r = F.rows.get(Fo.keyText(k, x.id, y.id)); if (r) return r.thing ? r.thing.id : r.linked_to; } catch (e) { /* the row's own id */ }
    return "emberbrand";
  }
  const cartButton = () => { const w = $("wall"); return w ? Array.from(w.querySelectorAll("button")).find(b => b.getAttribute("aria-label") === "The Trader's Cart") || null : null; };
  function fireRow() {
    const F = TF(), t = F && F.world.get(BUY().thing), name = t ? t.name : "Fire";
    return Array.from(document.querySelectorAll("#cart .cartrow")).find(r => { const n = r.querySelector(".n"); return !!n && n.textContent === name; }) || null;
  }
  // the names spec/lessons.json gives its targets and glances
  function resolve(name) {
    if (name === "add") return $("slotB");
    if (name === "cart") return cartButton();
    if (name === "fire") return fireRow();
    if (name === "strike") return $("strike");
    if (name === "try-it") return $("tryBtn");
    if (name === "coins") return $("chipCoins");
    return null;
  }
  // bright and live above the veil: the cog, and Settings while it is open (Skip the lessons, left-handed, my screen won't turn)
  function allowed() { const s = $("setPlank"); return [$("setBtn"), s && !s.hidden ? s : null].filter(Boolean); }
  // where his plank may sit: the root below the sign
  function bounds() {
    const app = $("app"), sign = app.querySelector(".sign"), sb = sign ? L.boxOf(sign) : null, top = sb ? sb.y + sb.h + 6 : 56;
    return { x: 8, y: top, w: Math.max(40, app.clientWidth - 16), h: Math.max(40, app.clientHeight - top - 8) };
  }
  // his head (Grycus.place's head, in the room's world pixels) in the root's own coordinates, while he is drawn in the room: the walls
  // shut, the Forge's room, not the forging's close-up. Else null: his plank keeps away from the target, his face says who talks
  function overHim() {
    const F = TF(), sp = F && F.grycus.spot, lens = $("lens"), b = $("grycus");
    if (!sp || !lens || !lens.offsetWidth || F.wallsOpen || F.inArmory || F.state.forging || lens.classList.contains("near") || !b || b.hidden) return null;
    const k = lens.offsetWidth / F.roomW;
    return L.pointIn(lens, sp.head.x * k, sp.head.y * k);
  }
  // F6: his words hang small from the plaque's top edge, over the empty parchment above the name (the plaque's middle column), and
  // Try it in the cellar alone is lit
  function plaqueView(B) {
    const p = $("plaque"), tr = $("tryBtn");
    if (!p || p.hidden || !tr || !p.contains(tr)) return null;
    const pb = L.boxOf(p), main = p.querySelector(".main"), mb = main ? L.boxOf(main) : null;
    if (!pb || !mb) return { target: tr, manual: true, bounds: B };
    const w = Math.min(380, mb.w + 12);
    return { target: tr, manual: true, box: { x: mb.x - 12, y: pb.y - 2, w }, bounds: { x: pb.x + 4, y: Math.max(B.y - 8, pb.y - 4), w: pb.w - 8, h: pb.h }, pointer: "above" };
  }
  // F6's card makes room for his words when it must: if the card's own centred column would put the name under his plank (a short
  // phone), its middle column (the name, the recipe, the traits) starts under the plank instead, padded by its height, and the card
  // is fitted again (fitPlaque), so the name is never under his words; a tall card keeps its centred column. Measured: the card as it
  // lays itself out, his plank placed; then, if needed, the padding set, the card fitted, his plank placed again (twice more at most,
  // as the column's width moves with the fit). Again on a resize and when the fonts arrive
  function layPlaque() {
    const F = TF(), p = $("plaque"), main = p && p.querySelector(".main");
    if (!L || !live.pinned || !F || !F.plaqueOpen() || !main || L.step !== "f.plaque") return;
    main.style.alignSelf = ""; main.style.paddingTop = ""; F.fitPlaque(); L.render();
    { const pl = L.state.plank, mb = L.boxOf(main); if (!pl || !mb || mb.y >= pl.y + pl.h + 6) return; }   // (room above the name already)
    for (let i = 0; i < 3; i++) {
      L.render();
      const pl = L.state.plank, pb = L.boxOf(p); if (!pl || !pb) return;
      const want = Math.max(0, Math.ceil(pl.y + pl.h + 6 - (pb.y + p.clientTop))), now = parseFloat(main.style.paddingTop) || 0;
      if (main.style.alignSelf === "start" && Math.abs(want - now) <= 1) break;
      main.style.alignSelf = "start"; main.style.paddingTop = want + "px";
      F.fitPlaque();
    }
    L.render();
  }
  window.addEventListener("resize", () => { if (live.pinned) setTimeout(layPlaque, 80); });
  try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (live.pinned) layPlaque(); }); } catch (e) { /* no font loading API */ }
  // what shows at each step (read again at every render and refit: kept cheap). null: nothing shows and nothing is gated
  function view(id, ctl) {
    if (!L && ctl) L = ctl;   // (mount's own first render comes before mount returns the controller)
    const F = TF(); if (!F || live.leaving || F.session.leaving) return null;
    const st = Ls.step(id); if (!st) return null;
    if (F.state.forging || F.state.pouring) return null;   // the forging plays with no veil and no words: a tap skips it, as always
    const B = bounds();
    if (st.page === "cellar") {
      // a cellar step opened in the Forge: his resume line, and the cellar's door, which takes them down (the cellar reads the record)
      const door = $("cellarDoor"), open = !!door && !door.hidden && !F.wallsOpen && !F.inArmory;
      return { target: open ? door : [], kind: "plank", words: WORDS().resume || "", foot: false, veil: true, anchor: overHim(), bounds: B, manual: true, pointer: "below" };   // (the Forge's veil; the pointer under the door, off its plate)
    }
    if (id === "f.forging") return null;
    if (id === "f.plaque") return plaqueView(B);
    if (id === "f.fire") return live.flying ? { target: [], bounds: B } : { bounds: B, manual: true };   // (the purchase ends it: bought)
    if (st.place === "grycus") return { anchor: overHim(), bounds: B, pointer: id === "f.add" ? "right" : undefined };   // (beside ADD, off its plate)
    return { bounds: B };
  }

  // ------------------------------------------------------------------ each step's state (section 3.7: every step resumes)
  // the record's step, moved to the one the Forge's state supports: Fire bought but not forged is F5 with Fire on ADD; Emberbane owned
  // is F6 with its plaque open; a forge that never finished (the page died in it) is Strike again
  function consistent(id) {
    const F = TF(), at = s => Ls.index(s), i = at(id);
    if (Ls.pageOf(id) !== "forge" || id === "f.farewell" || i < 0) return id;
    const hasE = F.own.has(emberbane()), hasFire = F.have(BUY().thing) > 0;
    if (hasE && i >= at("f.strike")) return "f.plaque";
    if (id === "f.plaque" || id === "f.forging") return hasFire ? "f.strike" : "f.add";
    if (hasFire && i >= at("f.add") && i < at("f.strike")) return "f.strike";
    if (id === "f.strike" && !hasFire) return "f.add";
    return id;
  }
  // the Sword on BASE, and Fire on ADD (F5) or nothing
  function onAnvil(withFire) {
    const F = TF(), fire = BUY().thing, a = F.own.has(BASE()) ? BASE() : F.state.a, b = withFire && F.have(fire) > 0 ? fire : null;
    if (F.state.a === a && F.state.b === b) return;
    F.state.a = a; F.state.b = b; F.renderAll();
  }
  // nothing stands over the room: the Armory, the walls, the crucible, a plaque that is not the lesson's
  function shut() {
    const F = TF();
    F.closeArmory(); if (!live.pinned) F.closePlaque(); F.closeWalls();
    if (F.state.station !== "anvil") F.setStation("anvil");
  }
  // an element scrolled into view in its scrolling box (in the root's own coordinates, so a turned frame scrolls the same)
  function inView(el, box) {
    if (!el || !box) return;
    const e = L.boxOf(el), b = L.boxOf(box); if (!e || !b) return;
    const top = b.y + box.clientTop, bottom = top + box.clientHeight;
    if (e.y < top) box.scrollTop -= top - e.y + 6; else if (e.y + e.h > bottom) box.scrollTop += e.y + e.h - bottom + 6;
  }
  // he counts as met from his first line (his welcome is the lesson; the meeting's greeting clock starts with it)
  function meet() { const F = TF(), m = F && F.grycus.mem; if (m && !m.met) { m.met = true; if (!m.greetAt) m.greetAt = nowIso(); F.save(); } }
  function topUp() { const F = TF(), c = BUY().coins; if (F.profile.coins < c) { F.profile.coins = c; F.save(); F.renderSign(); } }
  // as if the first forge had happened: Emberbane owned (the Fire it was made of used, or with none bought its price paid), and the
  // Sword and Emberbane in hand, Emberbane active. Nothing when Emberbane is owned. True when it gave it
  function firstForge() {
    const F = TF(), E = emberbane(), fire = BUY().thing;
    if (!F || !F.world.has(E) || F.own.has(E)) return false;
    const o = F.own.get(fire);
    if (o && o.n > 0) o.n -= 1; else F.profile.coins = Math.max(0, F.profile.coins - BUY().coins);
    F.gain(E);
    if (!F.profile.found.includes(E)) F.profile.found.push(E);
    const hands = [BASE(), E].filter(x => F.own.has(x));
    F.session.equipped = hands; F.session.active = Math.max(0, hands.indexOf(E));
    return true;
  }
  // the page made ready for a step (the record has just moved on to it, or the page came back to it)
  function prepare(id) {
    const F = TF(); if (!F || live.leaving) return;
    const st = Ls.step(id); if (!st) return;
    meet();
    if (st.page === "cellar" || id === "f.farewell") {
      if (firstForge()) F.save();   // (a record ahead of its save, the bench's Skip to the cellar lessons: Emberbane and both hands)
      unpin(); F.closePlaque(); F.closeArmory(); F.closeWalls();
      if (F.state.a || F.state.b) { F.state.a = null; F.state.b = null; }
      F.renderAll();
      return;
    }
    if (id === "f.welcome" || id === "f.deal" || id === "f.add" || id === "f.strike") {
      shut(); onAnvil(id === "f.strike");
      if (id === "f.add" && F.state.tab !== "materials") F.setTab("materials");   // (so the ADD slot opens the walls on Materials)
      return;
    }
    if (id === "f.cart" || id === "f.fire") {
      F.closeArmory(); F.closePlaque(); onAnvil(false);
      if (!F.wallsOpen) F.openWalls("pick");
      if (F.state.tab !== "materials") F.setTab("materials");
      if (id === "f.cart") { if (F.state.view !== "wall") F.closeCabinet(); return; }
      topUp();
      if (F.state.bulk) F.state.bulk = false;   // (one Fire, not five)
      if (!(F.state.view === "cabinet" && F.state.cab && F.state.cab.kind === "cart")) F.openCabinet(CART); else F.renderCart();
      inView(fireRow(), $("cart"));
      return;
    }
    if (id === "f.plaque") openPlaque();
  }
  // F6 after a reload: Emberbane's plaque open in lesson mode
  function openPlaque() {
    const F = TF(), E = emberbane(), t = F.world.get(E);
    if (!t || !F.own.has(E)) return;
    const h2 = $("plaque").querySelector("h2");
    if (F.plaqueOpen() && F.plaqueMode === "forge" && h2 && h2.textContent === t.name) { pin(); layPlaque(); return; }
    F.closeArmory(); F.closeWalls();
    const claim = { thing: t, status: "known", provisional: false, kind: null };
    F.session.lastClaim = claim;
    F.showPlaque(claim, F.world.get(BASE()), F.world.get(BUY().thing));   // (its hook pins it)
  }
  // the plaque in lesson mode: TAP ANYWHERE TO CONTINUE hidden (a tap anywhere would lose the step), its line kept so the card fits as
  // it always does (with the line gone the foot's last letters would hang a pixel out of the card, and the fit would shrink it all)
  function pin() { const t = $("tapOn"); if (t) { t.style.visibility = "hidden"; t.setAttribute("aria-hidden", "true"); } live.pinned = true; }
  function unpin() { if (!live.pinned) return; live.pinned = false; const t = $("tapOn"); if (t) { t.style.visibility = ""; t.removeAttribute("aria-hidden"); } }
  // after a boot or the back gesture: the record's step, with the state it needs
  function settle(atBoot, o) {
    const F = TF(); if (!F || !L) return;
    o = o || {};
    if (!L.record && atBoot && o.fresh) { L.start(); syncRows(); return; }   // (a player with no save and no lessons yet: they start)
    syncRows();
    const rec = L.record;
    if (!rec) return;
    if (rec.done) { if (rec.skipped && !rec.gift) finishState(); return; }   // (a skip the page did not live to give)
    const id = consistent(rec.step);
    if (id !== rec.step) { L.jump(id); return; }
    prepare(id);
    L.render();
  }

  // ------------------------------------------------------------------ the record moves on
  function onStep(id, from) {
    syncRows();
    if (id === null) { ended(from); return; }
    prepare(id);
  }
  // the lessons are done (finished or skipped): Grycus is himself again
  function ended(from) {
    const F = TF(); if (!F) return;
    F.grycus.hush();   // (his opening, waiting since the boot, is dropped: the farewell was his word)
    meet(); unpin(); syncRows();
    const rec = L.record;
    if (from === "f.farewell" && rec && !rec.skipped) wild();
  }
  // Into the wild (section 3.6, Isaac's answer 6): the first real Battleground is built (build 7, design pass 12, the Troll Gate), so
  // Into the wild walks straight to it: the to-cellar handoff as the Forge's door down writes it (Emberbane in hand and the Sword in
  // the other; the finds come home through forge-forever:from-battle as always), then the Battlegrounds page at ?area=gate, alone
  // (&brothers= left out: the level has its own first-visit plank, The Troll Gate), once the purse has counted up. The way is pushed
  // plainly (not nav.js's go: the cellar is right behind this page, and going back would wake it, not the level). Staying (the checks)
  // records the way in TheForge.wentDown and goes nowhere
  function wild() {
    const F = TF(); if (!F) return;
    F.renderAll();
    const sent = F.writeHandoff(null), base = F.cellarUrl(), url = base + (base.indexOf("?") >= 0 ? "&" : "?") + "area=gate";
    F.wentDown = { url, sent, try: null, how: "push", wild: true };   // (and the handoff is not written over on the way out)
    const go = () => { if (stay || F.session.leaving) return; F.session.leaving = true; window.location.href = url + "#from=forge"; };
    if (stay || still()) go(); else setTimeout(go, 1400);   // (the coin chip's count, 1.2 s, plays first)
  }
  // the coin chip counting from one sum to another (the sign's own number afterwards); none under less motion
  function countCoins(from, to, ms) {
    const el = $("coins"); if (!el) return;
    clearInterval(live.counting); live.counting = 0;
    if (still() || from === to) { el.textContent = to.toLocaleString(); return; }
    const t0 = Date.now(); el.textContent = from.toLocaleString();
    live.counting = setInterval(() => {
      const k = Math.min(1, (Date.now() - t0) / ms);
      el.textContent = Math.round(from + (to - from) * k).toLocaleString();
      if (k >= 1) { clearInterval(live.counting); live.counting = 0; }
    }, 40);
  }
  // the farewell's gift (section 3.6), once: the purse (120 coins) and the crate (3 of every element, material and curio, the stock of
  // the bench's old fresh smithy), both saved before the coin chip counts up, so a page that dies during the count never gives twice
  function gift() {
    const F = TF(); if (!F || !L || !L.giveGift()) return false;
    const G = GIFT(), before = F.profile.coins;
    F.profile.coins += G.coins;
    for (const t of window.FORGE_THINGS) if (t.kind !== "weapon" && G.stores.includes(F.storeOf(t))) F.gain(t.id, G.each);
    F.save();
    F.renderAll();
    countCoins(before, F.profile.coins, 1200);
    const st = Ls.step("f.farewell");
    F.toast((st && st.toast) || "+" + G.coins + " coins");
    return true;
  }
  // Skip the lessons (section 3.7): exactly the end state of finishing them. Emberbane forged from the Sword and one Fire (the
  // ledger's row), both in hand, the anvil empty, nothing open, the purse and the crate given once: 150 coins in all
  function finishState() {
    const F = TF(); if (!F) return;
    unpin(); F.closePlaque(); F.closeArmory(); F.closeWalls();
    firstForge();
    F.state.a = null; F.state.b = null;
    gift();
    F.save(); F.renderAll();
  }
  function onSkip() { finishState(); }
  function onButton(id) { if (id === "f.farewell") gift(); }

  // ------------------------------------------------------------------ the bought Fire's flight (F4)
  // its sprite from the Cart's row to the ADD slot in 0.4 s (eight steps, on an arc), over the veil; none under less motion
  function fly(id, fromEl, toEl, done) {
    const F = TF(), app = $("app"), t = F.world.get(id), a = fromEl && L.boxOf(fromEl), b = toEl && L.boxOf(toEl);
    if (!t || !a || !b || still() || !window.PixelForge) { done(); return; }
    let cv = null;
    try { cv = PixelForge.canvasFor(t, { scale: 2 }); } catch (e) { cv = null; }
    if (!cv) { done(); return; }
    cv.className = "lsn-fly"; cv.setAttribute("aria-hidden", "true");
    cv.style.cssText = "position:absolute;z-index:8;pointer-events:none;image-rendering:pixelated;image-rendering:crisp-edges";
    app.appendChild(cv);
    const s0 = Math.max(a.w, 24), s1 = Math.max(24, Math.min(b.w, b.h, 50)), x0 = a.x + a.w / 2, y0 = a.y + a.h / 2, x1 = b.x + b.w / 2, y1 = b.y + b.h / 2;
    const lift = Math.min(90, 30 + Math.abs(x1 - x0) * 0.2), N = 8;
    let i = 0;
    const put = () => { const k = i / N, s = s0 + (s1 - s0) * k, x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k - lift * 4 * k * (1 - k);
      cv.style.width = cv.style.height = Math.round(s) + "px"; cv.style.left = Math.round(x - s / 2) + "px"; cv.style.top = Math.round(y - s / 2) + "px"; };
    put();
    const timer = setInterval(() => { i++; put(); if (i >= N) { clearInterval(timer); cv.remove(); done(); } }, 50);
  }

  // ------------------------------------------------------------------ Settings and the bench (stage F)
  function syncRows() { if (rows.skip) rows.skip.hidden = !(L && L.active); }
  // Skip the lessons, a row of Settings while they run: Settings closes and his question asks once
  function settingsRows() {
    if (!Ls || !Sm) return [];
    const b = document.createElement("button"), W = WORDS().skip || {};
    b.type = "button"; b.className = "set-row f-iron"; b.setAttribute("data-skip-lessons", "1"); b.hidden = true;
    b.innerHTML = "<b></b><i>As if you'd finished: Emberbane, the purse and the crate</i><span>Skip</span>";
    b.querySelector("b").textContent = W.link || "Skip the lessons";
    b.addEventListener("click", () => { const F = TF(); if (F) F.closeSettings(); if (L) L.askSkip(); });
    rows.skip = b;
    return [b];
  }
  function reload() { const F = TF(); if (F) F.session.leaving = true; try { window.location.reload(); } catch (e) { /* the next visit */ } }
  const nameNow = () => { const r = Sm && Sm.read(); return r ? r.name : "Isaac"; };   // (no record is the dev smith, Isaac's)
  // Start the lessons over (the bench's old Start fresh): a new player under the same name, a new id and a fresh save, at the welcome
  function startOver() {
    if (!Sm || !Ls) return false;
    const p = Sm.make(nameNow());
    Ls.start(p.id);
    reload();
    return true;
  }
  // Skip to the cellar lessons: a new player as Start the lessons over, with the record at the cellar's first step; the Forge gives
  // them what the cellar needs (Emberbane and the Sword in hand) and its door glows, down to the cellar
  function toCellarLessons() {
    if (!Sm || !Ls) return false;
    const p = Sm.make(nameNow()), rec = Ls.start(p.id), first = (Ls.steps().find(s => s.page === "cellar") || {}).id || "c.arrive";
    Ls.save(p.id, Ls.moveTo(rec, first));
    reload();
    return true;
  }
  // Play as the dev smith: the player record isaac, its lessons done; today's level-12 dev save (local:isaac) is used as it is
  function devSmith() {
    if (!Sm || !Ls) return false;
    Sm.make("Isaac", { id: "isaac" });
    const r = Ls.load("isaac");
    if (!r || !r.done) Ls.save("isaac", Ls.finish(r || Ls.begin()));
    reload();
    return true;
  }
  {
    const dev = $("devSmith"), down = $("cellarLessons");
    if (dev) { if (Sm && Ls) dev.addEventListener("click", devSmith); else dev.hidden = true; }
    if (down) { if (Sm && Ls) down.addEventListener("click", toCellarLessons); else down.hidden = true; }
  }

  // ------------------------------------------------------------------ the Forge's hooks (lessonOn(name, ...) in the-forge.js)
  window.ForgeLessons = {
    who,
    // the boot, after the Forge's load: the controller on #app, then the record's step with the state it needs
    boot(o) {
      const F = TF(); if (!F || !Ls || !Sm || L) return;
      L = Ls.mount($("app"), { page: "forge", resolve, view, onStep, onSkip, onButton, allow: allowed, build: document.body.getAttribute("data-build") || "dev" });
      if (!L) return;
      F.lessons = L;
      settle(true, o);
    },
    // the back gesture restored the page: the record as the other pages left it
    shown(o) {
      const F = TF(); if (!F || !L) return;
      live.leaving = false; live.flying = false;
      const r = Sm && Sm.read(); if (r && r.id === F.profile.id && r.name !== F.profile.name) F.profile.name = r.name;
      L.reload();
      settle(false, o);
    },
    // Grycus holds his tongue while the lessons run: no meet, greet, back or remark
    quiet() { return !!(L && L.active); },
    // the plaque is the lesson's (F6): it does not continue on a tap or a key, and Settings does not close it
    pinned() { const F = TF(); return !!(L && L.active && L.step === "f.plaque" && F && F.plaqueOpen() && F.plaqueMode === "forge"); },
    // Strike fell (F5 ends: the forging) and a forge that failed (back to Strike)
    strike() { if (L && L.active && L.step === "f.strike") L.event("strike"); },
    failed() { if (L && L.active && (L.step === "f.forging" || L.step === "f.strike")) L.jump("f.strike"); },
    // a plaque after a forge: F6 in lesson mode
    plaque(claim, isView) {
      if (!L || !L.active || isView) return;
      const id = L.step;
      if (id !== "f.forging" && id !== "f.strike" && id !== "f.plaque") return;
      pin();
      if (id === "f.forging") L.event("plaque"); else if (id === "f.strike") L.jump("f.plaque");
      layPlaque();
    },
    // the page goes down (Try it, the door): at F6 the record moves on to the cellar's first step first
    down() {
      if (!L || !L.active || L.step !== "f.plaque") return;
      live.leaving = !stay;   // (the page leaves: nothing more shows here; staying, for the checks, it shows the resume line)
      unpin();
      L.event("down");
    },
    // a purchase in the Cart: at F4 the bought Fire flies onto ADD by itself, the walls close, F5
    bought(id, res) {
      const F = TF(); if (!F || !L || !L.active || L.step !== "f.fire" || id !== BUY().thing || live.flying) return false;
      const row = fireRow(), cost = res && typeof res.cost === "number" ? res.cost : BUY().coins;
      live.flying = true; L.render();   // (the glow leaves the row while the Fire flies: nothing more to buy)
      countCoins(F.profile.coins + cost, F.profile.coins, 400);
      fly(id, row && row.querySelector("canvas"), $("slotB"), () => {
        live.flying = false;
        if (!(L.active && L.step === "f.fire")) return;
        F.pick(id);   // (onto ADD beside the Sword: pick closes the walls, both slots full)
        L.event("bought");
      });
      return true;
    },
    settingsRows,
    // Your name renamed in Settings: the profile and his words say it
    renamed(r) { const F = TF(); if (F && r && r.id === F.profile.id) { F.profile.name = r.name; F.save(); } if (L) L.reload(); },
    startOver, toCellarLessons, devSmith, emberbane,
    get L() { return L; }, get flying() { return live.flying; }, get leaving() { return live.leaving; }, get pinnedNow() { return live.pinned; },
    version: 1
  };
})();
