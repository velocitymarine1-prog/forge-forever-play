// FORGE FOREVER: forge-lessons.js (design pass 16 with its revision 1, the first five minutes; built by build 8, stages D and F; through
// the courtyard and the map since build 17: design pass 24 section 4.14, pass 25 section 4.10, settled by pass 26 section 3.6).
// Grycus and Nell teach a new knight on the real castle page: proto/lessons.js's controller mounted on the page's game root (#app),
// told what glows at each step and where the plank goes (view), and moved on by the page's own hooks. Loaded after spec/lessons.js,
// smith.js and lessons.js and before the-forge.js, which calls the hooks below through lessonOn(name, ...); this file reaches the page
// through window.TheForge. Plain script, defines window.ForgeLessons. The words are spec/lessons.json's.
//
//   y.gate the new knight walks in through the courtyard's gate; Nell's ribbon (her face) across the top of the view, no soot over the
//      yard (pass 26 section 3.2 row 5): the page draws an ember ring at her cart, a yellow arrow over it and a chevron at the view's
//      edge while it is off screen; every other place is inert and the house dim. Ends when the knight stands in the ring.
//   y.fire her plank open with Fire alone lit under the veil (pass 16's veil for a tap step); Fire bought ends it.
//   y.forge her ribbon again, the ring and the arrow at the Forge's door; walking into the Forge ends it.
//   f.welcome, f.deal his big plank over his head; f.add the ADD slot glows (the walls open on Materials); f.pick the Fire on its shelf
//      (the Elements cabinet) glows and goes onto the anvil; f.strike Strike; f.forging plays with no veil; f.plaque Emberbane's plaque
//      in lesson mode, Try it in the cellar alone lit. Try it moves the record on to the cellar's first step and goes down.
//   the cellar's steps are the cellar's; opened on the castle page they are his resume line from the Forge, the stairs glowing in the yard.
//   y.back up from the cellar at the top of its stairs, his ribbon from the Forge, the Forge's door glowing; f.farewell his largest
//      plank in the middle with Into the wild and the gift once; y.wild the gate (and the table) glowing; y.map the Map Table with the
//      Troll Castle alone lit (the page's own veil and ring on the canvas); y.go the castle's plate with Go alone alone lit. Go alone
//      ends the lessons and the page leaves for the Troll Gate.
// Resuming (section 3.7): every step comes back after a reload or the back gesture with the state it needs (settle, consistent,
// prepare: the right room, the right plank). Skip the lessons (y.gate's link, and a row in Settings while they run) gives exactly the
// end state of finishing, recorded skipped; the knight stays where he stands. The bench (Developer, in Settings): Start the lessons
// over, Skip to the cellar lessons, Play as the dev smith. ?lessons=1 (with ?stay=1, for the checks) makes a test player, Tester,
// with the lessons at the first step.
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const stay = params.get("stay") === "1";
  const Ls = window.Lessons || null, Sm = window.Smith || null, FK = window.Folk || null;
  const TF = () => window.TheForge || null;
  const D = () => window.FORGE_LESSONS || {};
  const WORDS = () => D().words || {};
  const BUY = () => Object.assign({ thing: "fire", coins: 30 }, D().buy || {});
  const GIFT = () => Object.assign({ coins: 120, each: 3, stores: ["Elements", "Materials", "Curios"] }, D().gift || {});
  const BASE = () => (D().start || {}).base || "sword";
  const ELEMENTS = { kind: "store", key: "Elements" };
  const nowIso = () => new Date().toISOString().replace(/\.\d+Z$/, "Z");
  let L = null;   // lessons.js's controller on #app, from the boot
  const live = { leaving: false, pinned: false, counting: 0, nellFace: null };
  const rows = { skip: null };
  const still = () => { const F = TF(); return !!(F && F.reduce) || !!(window.Settings && Settings.reduce()); };
  const stepOf = id => (Ls ? Ls.step(id) : null);
  const roomOf = id => { const s = stepOf(id); return s && s.room ? s.room : null; };
  const yardStep = id => roomOf(id) === "yard", mapStep = id => roomOf(id) === "map";
  const YARD_PLACES = ["nell", "forge", "gate", "cellar", "table", "vorn", "well", "armory"];

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

  // ------------------------------------------------------------------ what glows, and where the plank goes
  // Emberbane: the ledger's Sword + Fire (its id stayed emberbrand when it was renamed)
  function emberbane() {
    const F = TF(), Fo = window.Forge;
    try { const a = F.world.get(BASE()), b = F.world.get(BUY().thing), [k, x, y] = Fo.roles(a, b), r = F.rows.get(Fo.keyText(k, x.id, y.id)); if (r) return r.thing ? r.thing.id : r.linked_to; } catch (e) { /* the row's own id */ }
    return "emberbrand";
  }
  const fireName = () => { const F = TF(), t = F && F.world.get(BUY().thing); return t ? t.name : "Fire"; };
  // Nell's row for Fire in her plank (y.fire), and the Fire on its shelf in the Elements cabinet (f.pick)
  function fireRow() { return Array.from(document.querySelectorAll("#folkPlank .cartrow")).find(r => { const n = r.querySelector(".n"); return !!n && n.textContent === fireName(); }) || null; }
  function fireShelf() { return Array.from(document.querySelectorAll("#shelves .shelfitem")).find(b => { const sp = b.querySelector("span"); return !!sp && sp.textContent === fireName(); }) || null; }
  // the names spec/lessons.json gives its targets and glances (the yard's places and the map's areas are the page's to draw: no element)
  function resolve(name) {
    if (name === "add") return $("slotB");
    if (name === "fire") return fireRow();
    if (name === "fire-shelf") return fireShelf();
    if (name === "strike") return $("strike");
    if (name === "try-it") return $("tryBtn");
    if (name === "coins") return $("chipCoins");
    if (name === "go-alone") return $("goAlone");
    return null;
  }
  // bright and live above the veil: the cog, and Settings while it is open (Skip the lessons, left-handed, my screen won't turn)
  function allowed() { const s = $("setPlank"); return [$("setBtn"), s && !s.hidden ? s : null].filter(Boolean); }
  // where the plank may sit: the root below the sign
  function bounds() {
    const app = $("app"), sign = app.querySelector(".sign"), sb = sign && L ? L.boxOf(sign) : null, top = sb ? sb.y + sb.h + 6 : 56;
    return { x: 8, y: top, w: Math.max(40, app.clientWidth - 16), h: Math.max(40, app.clientHeight - top - 8) };
  }
  // his head (Grycus.place's head, in the room's world pixels) in the root's own coordinates, while he is drawn in the room: the Forge's
  // room, the walls shut, not the forging's close-up. Else null: his plank keeps away from the target, his face says who talks
  function overHim() {
    const F = TF(), sp = F && F.grycus.spot, lens = $("lens"), b = $("grycus");
    if (!sp || !lens || !lens.offsetWidth || F.wallsOpen || F.roomName !== "forge" || F.state.forging || lens.classList.contains("near") || !b || b.hidden) return null;
    const k = lens.offsetWidth / F.roomW;
    return L.pointIn(lens, sp.head.x * k, sp.head.y * k);
  }
  // Nell's face for her plank's head (a 16 x 16 crop of her idle frame, as his is of his)
  function nellFace() {
    if (live.nellFace) return live.nellFace;
    if (!FK) return undefined;
    try {
      const f = FK.face("nell"), cv = document.createElement("canvas"); cv.width = 16; cv.height = 16; cv.dataset.face = "nell"; cv.setAttribute("aria-hidden", "true");
      const g = cv.getContext("2d"); f.px.forEach((c, i) => { if (c) { g.fillStyle = c; g.fillRect(i % 16, Math.floor(i / 16), 1, 1); } });
      live.nellFace = cv; return cv;
    } catch (e) { return undefined; }
  }
  // the ribbon in the yard (pass 26 section 3.2 row 6): across the top of the view under the sign, as the cellar's; at the bottom while
  // the glowing place is in the top two fifths of the view, so it never covers its own target
  function yardBox(place) {
    const F = TF(), app = $("app"), B = bounds(), W = app.clientWidth, w = Math.floor(Math.min(Ls.widest("ribbon", W), W - 24)), x = Math.round((W - w) / 2);
    const Y = F.yard, cv = $("yard");
    if (place && Y && Y.L && Y.Y && cv) {
      const t = Y.Y.targetOf(place);
      if (t) { const ty = (t.y - Y.cam.y) * Y.L.per; if (ty < 0.4 * Y.L.vh * Y.L.per) return { x, bottom: B.y + B.h, w }; }
    }
    return { x, y: B.y, w };
  }
  // the plank on the map: top right while the castle on the left is to tap, top left once its plate is open on the right
  function mapBox(id) { const app = $("app"), B = bounds(), W = app.clientWidth, w = Math.floor(Math.min(Ls.widest("plank", W), W * 0.5 - 16)); return { x: id === "y.go" ? 8 : W - w - 8, y: B.y + 4, w }; }
  // the house is dim until the gate (y.wild), as in pass 16 (pass 24 section 4.14)
  function dimmed(id) { const i = Ls.index(id), w = Ls.index("y.wild"); return i >= 0 && w >= 0 && i < w ? [$("homeBtn")].filter(Boolean) : []; }
  // y.go: the plate's other buttons are dimmed and inert, Go alone alone lit
  function plateBlocked() { return Array.from(document.querySelectorAll("#areaPlate button")).filter(b => b.id !== "goAlone"); }
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
  // F6's card makes room for his words when it must (see build 8): the middle column starts under the plank on a short phone
  function layPlaque() {
    const F = TF(), p = $("plaque"), main = p && p.querySelector(".main");
    if (!L || !live.pinned || !F || !F.plaqueOpen() || !main || L.step !== "f.plaque") return;
    main.style.alignSelf = ""; main.style.paddingTop = ""; F.fitPlaque(); L.render();
    { const pl = L.state.plank, mb = L.boxOf(main); if (!pl || !mb || mb.y >= pl.y + pl.h + 6) return; }
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
  // what shows at each step (read again at every render and refit: kept cheap). null: nothing shows and nothing is gated. A step of
  // one room shows nothing in another: the player stepped out of the lesson's room, and the record waits
  function view(id, ctl) {
    if (!L && ctl) L = ctl;   // (mount's own first render comes before mount returns the controller)
    const F = TF(); if (!F || live.leaving || F.session.leaving) return null;
    const st = stepOf(id); if (!st) return null;
    if (F.state.forging || F.state.pouring) return null;   // the forging plays with no veil and no words: a tap skips it, as always
    const B = bounds(), room = F.roomName;
    if (st.page === "cellar") {
      // a cellar step opened on the castle page: his resume line from the Forge, the cellar's stairs glowing in the yard (the page draws
      // the ring); under the old room graph the Forge's door down, which takes them down (the cellar reads the record)
      if (room === "yard") return { target: [], kind: "ribbon", words: WORDS().resume || "", who: WORDS().forge || "Grycus · from the Forge", foot: false, veil: false, box: yardBox("cellar"), manual: true };
      if (room !== "forge") return null;
      const door = $("cellarDoor"), open = !!F.noyard && !!door && !door.hidden && !F.wallsOpen;
      return { target: open ? door : [], kind: "plank", words: WORDS().resume || "", foot: false, veil: true, anchor: overHim(), bounds: B, manual: true, pointer: "below" };
    }
    if (yardStep(id)) {
      if (room !== "yard") return null;
      const nell = st.who === "nell", whoLabel = nell ? (WORDS().nell || "Nell") : (WORDS().forge || "Grycus · from the Forge"), face = nell ? nellFace() : undefined;
      if (id === "y.fire") {
        if (F.folkOpen() && F.folk.who === "nell") return { target: fireRow() || [], veil: true, bounds: B, who: whoLabel, face, manual: true, pointer: "left", block: dimmed(id) };
        return { target: [], kind: "ribbon", veil: false, box: yardBox("nell"), who: whoLabel, face, manual: true, block: dimmed(id) };   // (her plank closed: back to her cart)
      }
      return { target: [], kind: "ribbon", veil: false, box: yardBox(typeof st.target === "string" ? st.target : null), who: whoLabel, face, manual: true, block: dimmed(id) };
    }
    if (mapStep(id)) {
      if (room !== "map") return null;
      if (id === "y.go") { const g = $("goAlone"), open = !!g && !!F.map.plate; return { target: open ? g : [], veil: open, bounds: B, kind: "plank", box: mapBox(id), manual: true, pointer: "left", block: open ? plateBlocked() : [] }; }
      return { target: [], kind: "plank", veil: false, box: mapBox(id), who: WORDS().forge || "Grycus · from the Forge", manual: true, block: dimmed(id) };   // (the page veils the map and rings the castle on its canvas)
    }
    if (room !== "forge") return null;
    if (id === "f.forging") return null;
    if (id === "f.plaque") return plaqueView(B);
    if (id === "f.pick") return { target: fireShelf() || [], bounds: B, manual: true, pointer: "below" };   // (the pick ends it: picked)
    if (st.place === "grycus") return { anchor: overHim(), bounds: B, pointer: id === "f.add" ? "right" : undefined };   // (beside ADD, off its plate)
    return { bounds: B };
  }
  // what the yard draws and lets through at the step (the page asks each frame): the place to ring (an ember ring at its stand, the
  // arrow and the chevron) and which places answer a tap, E or a walk into them
  function yardView() {
    if (!L || !L.active) return null;
    const id = L.step, st = stepOf(id); if (!st) return null;
    if (st.page === "cellar") return { target: "cellar", allow: p => p === "cellar" };
    if (!yardStep(id)) return null;
    if (id === "y.wild") return { target: "gate", allow: p => p === "gate" || p === "table" };
    const t = typeof st.target === "string" && YARD_PLACES.includes(st.target) ? st.target : id === "y.fire" ? "nell" : null;
    return { target: t, allow: p => p === t };
  }
  // what the map draws and lets through: the ring round the Troll Castle (y.map), or Go alone alone (y.go)
  function mapView() {
    if (!L || !L.active) return null;
    const id = L.step; if (!mapStep(id)) return null;
    if (id === "y.go") return { goOnly: true, allow: () => false };
    const st = stepOf(id), area = (st.marks && st.marks.ring) || st.target || "troll-castle";
    return { ring: area, allow: a => a === area };
  }

  // ------------------------------------------------------------------ each step's state (section 3.7: every step resumes)
  // the record's step, moved to the one the page's state supports: Emberbane owned is F6 with its plaque open; Fire in hand before
  // the Forge is y.forge; no Fire at a Forge step before Strike is back at Nell; a forge that never finished (the page died in it) is
  // Strike again; a save from before build 17 at the Cart's two steps goes where its Fire says
  function consistent(id) {
    const F = TF(), at = s => Ls.index(s), i = at(id);
    if (id === "f.cart" || id === "f.fire") return F.have(BUY().thing) > 0 ? "f.add" : "y.gate";
    const st = stepOf(id);
    if (!st || i < 0 || st.page !== "forge" || ["f.farewell", "y.back", "y.wild", "y.map", "y.go"].includes(id)) return id;
    const hasE = F.own.has(emberbane()), hasFire = F.have(BUY().thing) > 0;
    if (hasE && i <= at("f.plaque")) return "f.plaque";
    if ((id === "y.gate" || id === "y.fire") && hasFire) return "y.forge";
    if (id === "y.forge" && !hasFire) return "y.gate";
    if (id === "f.plaque" || id === "f.forging") return hasFire ? "f.strike" : "y.gate";
    if (i >= at("f.welcome") && i <= at("f.strike") && !hasFire) return "y.gate";
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
    F.closeArmory(); if (!live.pinned) F.closePlaque(); F.closeWalls(); F.closeFolk();
    if (F.state.station !== "anvil") F.setStation("anvil");
  }
  // an element scrolled into view in its scrolling box (in the root's own coordinates, so a turned frame scrolls the same)
  function inView(el, box) {
    if (!el || !box || !L) return;
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
    // (build 12, design pass 19) and its XP, as the forge itself pays: Emberbane's rarity, a Fire used up (8 XP), so skipping ends where
    // finishing does
    if (window.Progress && Progress.forgeXp) { F.profile.xp += Progress.forgeXp({ tier: F.world.get(E).tier, usesUp: true, isNew: !F.profile.found.includes(E) }); F.profile.level = Progress.levelFor(F.profile.xp); }
    if (!F.profile.found.includes(E)) F.profile.found.push(E);
    const hands = [BASE(), E].filter(x => F.own.has(x));
    F.session.equipped = hands; F.session.active = Math.max(0, hands.indexOf(E));
    return true;
  }
  // where the knight stands when a yard step opens its room: the new knight walks in through the gate; back from the cellar at the top
  // of its stairs; Into the wild at the Forge's door; else where the room he was in puts him
  function yardSpot(id) {
    const F = TF(), room = F.roomName;
    if (id === "y.gate") return "lessons";
    if (id === "y.back") return "cellar";
    if (id === "y.wild") return "forge";
    return room === "forge" ? "forge" : room === "armory" ? "armory" : room === "map" ? "table" : "menu";
  }
  // the page made ready for a step (the record has just moved on to it, or the page came back to it)
  function prepare(id, o) {
    const F = TF(); if (!F || live.leaving) return;
    const st = stepOf(id); if (!st) return;
    o = o || {};
    meet();
    if (st.page === "cellar") {
      if (firstForge()) F.save();   // (a record ahead of its save, the bench's Skip to the cellar lessons: Emberbane and both hands)
      unpin(); F.closePlaque(); F.closeWalls(); F.closeFolk();
      if (F.state.a || F.state.b) { F.state.a = null; F.state.b = null; }
      F.renderAll();
      if (!F.noyard && F.roomName !== "yard") F.enter("yard", { at: "cellar" });
      return;
    }
    if (yardStep(id)) {
      unpin(); F.closePlaque(); F.closeWalls();
      // (the new knight walks in through the gate as the page boots on y.gate, unless the page came back to where he stood: its mark)
      if (F.roomName !== "yard" || (id === "y.gate" && o.boot && !(F.start && F.start.how === "mark"))) F.enter("yard", { at: yardSpot(id), cut: F.roomName === "yard" });
      if (id === "y.fire") { topUp(); if (!(F.folkOpen() && F.folk.who === "nell")) F.openFolk("nell"); inView(fireRow(), $("folkList")); }
      else F.closeFolk();
      return;
    }
    if (mapStep(id)) {
      unpin(); F.closePlaque(); F.closeWalls(); F.closeFolk();
      if (F.roomName !== "map") F.enter("map");
      if (id === "y.go" && !F.map.plate) F.map.tap("troll-castle");
      F.map.fit();   // (the names and the plate drawn again with this step's gate: the others dim, Go alone alone lit)
      return;
    }
    // the Forge's steps
    if (F.roomName !== "forge") F.enter("forge");
    if (id === "f.farewell") {
      if (firstForge()) F.save();
      unpin(); F.closePlaque(); F.closeWalls(); F.closeFolk();
      if (F.state.a || F.state.b) { F.state.a = null; F.state.b = null; }
      F.renderAll();
      return;
    }
    if (id === "f.welcome" || id === "f.deal" || id === "f.add" || id === "f.strike") {
      shut(); onAnvil(id === "f.strike");
      if (id === "f.add" && F.state.tab !== "materials") F.setTab("materials");   // (so the ADD slot opens the walls on Materials)
      return;
    }
    if (id === "f.pick") {
      F.closeArmory(); F.closePlaque(); F.closeFolk(); onAnvil(false);
      if (!F.wallsOpen) F.openWalls("pick");
      if (F.state.tab !== "materials") F.setTab("materials");
      if (!(F.state.view === "cabinet" && F.state.cab && F.state.cab.kind === "store" && F.state.cab.key === "Elements")) F.openCabinet(ELEMENTS);
      inView(fireShelf(), $("shelves"));
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
    F.closeArmory(); F.closeWalls(); F.closeFolk();
    const claim = { thing: t, status: "known", provisional: false, kind: null };
    F.session.lastClaim = claim;
    F.showPlaque(claim, F.world.get(BASE()), F.world.get(BUY().thing));   // (its hook pins it)
  }
  // the plaque in lesson mode: TAP ANYWHERE TO CONTINUE hidden (a tap anywhere would lose the step), its line kept so the card fits as
  // it always does
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
    prepare(id, { boot: atBoot });
    L.render();
  }

  // ------------------------------------------------------------------ the record moves on
  function onStep(id, from) {
    syncRows();
    if (id === null) { ended(from); return; }
    prepare(id);
  }
  // the lessons are done (finished or skipped): Grycus is himself again. Finished by y.go, the page is leaving for the Troll Gate
  function ended(from) {
    const F = TF(); if (!F) return;
    F.grycus.hush();   // (his opening, waiting since the boot, is dropped: the farewell was his word)
    meet(); unpin(); syncRows();
    if (from && !live.leaving) F.renderAll();
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
  // the farewell's gift (section 3.6), once: the purse (120 coins) and the crate (3 of every element, material and curio), both saved
  // before the coin chip counts up, so a page that dies during the count never gives twice
  function gift() {
    const F = TF(); if (!F || !L || !L.giveGift()) return false;
    const G = GIFT(), before = F.profile.coins;
    F.profile.coins += G.coins;
    for (const t of window.FORGE_THINGS) if (t.kind !== "weapon" && G.stores.includes(F.storeOf(t))) F.gain(t.id, G.each);
    F.save();
    F.renderAll();
    countCoins(before, F.profile.coins, 1200);
    const st = stepOf("f.farewell");
    F.toast((st && st.toast) || "+" + G.coins + " coins");
    return true;
  }
  // Skip the lessons (section 3.7): exactly the end state of finishing them. Emberbane forged from the Sword and one Fire (the
  // ledger's row), both in hand, the anvil empty, nothing open, the purse and the crate given once: 150 coins in all. The knight stays
  // where he stands
  function finishState() {
    const F = TF(); if (!F) return;
    unpin(); F.closePlaque(); F.closeWalls(); F.closeFolk(); if (F.roomName === "armory") F.closeArmory();
    firstForge();
    F.state.a = null; F.state.b = null;
    gift();
    F.save(); F.renderAll();
  }
  function onSkip() { finishState(); }
  function onButton(id) { if (id === "f.farewell") gift(); }

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
  // Start the lessons over (the bench's old Start fresh): a new player under the same name, a new id and a fresh save, at the first step
  function startOver() {
    if (!Sm || !Ls) return false;
    const p = Sm.make(nameNow());
    Ls.start(p.id);
    reload();
    return true;
  }
  // Skip to the cellar lessons: a new player as Start the lessons over, with the record at the cellar's first step; the castle page
  // gives them what the cellar needs (Emberbane and the Sword in hand) and the stairs glow in the yard
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
  // the knight stands in Nell's ring (y.gate): within 22 px of her stand
  const NELL_RING = 22;

  // ------------------------------------------------------------------ the castle page's hooks (lessonOn(name, ...) in the-forge.js)
  window.ForgeLessons = {
    who,
    // the boot, after the page's load: the controller on #app, then the record's step with the state it needs
    boot(o) {
      const F = TF(); if (!F || !Ls || !Sm || L) return;
      L = Ls.mount($("app"), { page: "forge", resolve, view, onStep, onSkip, onButton, allow: allowed, build: document.body.getAttribute("data-build") || "dev" });
      if (!L) return;
      F.lessons = L;
      settle(true, o);
    },
    // the back gesture restored the page: the record as the other pages left them
    shown(o) {
      const F = TF(); if (!F || !L) return;
      live.leaving = false;
      const r = Sm && Sm.read(); if (r && r.id === F.profile.id && r.name !== F.profile.name) F.profile.name = r.name;
      L.reload();
      settle(false, o);
    },
    // Grycus holds his tongue while the lessons run: no meet, greet, back or remark (and the well waits, Vorn's "!" too)
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
    // the page goes down (Try it, the stairs): at F6 the record moves on to the cellar's first step first
    down() {
      if (!L || !L.active || L.step !== "f.plaque") return;
      live.leaving = !stay;   // (the page leaves: nothing more shows here; staying, for the checks, it shows the resume line)
      unpin();
      L.event("down");
    },
    // a purchase at Nell's: at y.fire the bought Fire ends the step (it goes into the stock; her plank closes as the next step opens)
    bought(id) { if (!L || !L.active || L.step !== "y.fire" || id !== BUY().thing) return false; L.event("bought"); return true; },
    // a thing picked onto the anvil: at f.pick, the Fire
    picked(id) { if (L && L.active && L.step === "f.pick" && id === BUY().thing) L.event("picked"); },
    // the page changed room (enter): the walk steps end on the room they lead to
    room(room) { if (L && L.active) L.event("room", { room }); },
    // the yard's clock: the knight in Nell's ring ends y.gate
    yardTick(k) {
      const F = TF(); if (!L || !L.active || !F || L.step !== "y.gate" || !k || !F.yard.Y) return;
      const t = F.yard.Y.targetOf("nell"); if (t && Math.hypot(k.x - t.x, k.y - t.y) <= NELL_RING) L.event("ring", { ring: "nell" });
    },
    yardUse() { /* (the room's change and the plank's purchase end the yard's steps; nothing here) */ },
    yardView, mapView,
    // the Map Table: an area's plate opened (y.map), Go (y.go)
    plate(area) { if (L && L.active && L.step === "y.map") L.event("plate", { area }); },
    go() { if (L && L.active && L.step === "y.go") { live.leaving = !stay; L.event("go"); } },
    // a tap off the glow where the page keeps its own gate (the yard's places, the map's areas): counted and nudged
    offTap() { if (L && L.active) L.offTap(); },
    settingsRows,
    // Your name renamed in Settings: the profile and the words say it
    renamed(r) { const F = TF(); if (F && r && r.id === F.profile.id) { F.profile.name = r.name; F.save(); } if (L) L.reload(); },
    startOver, toCellarLessons, devSmith, emberbane, consistent,
    get L() { return L; }, get leaving() { return live.leaving; }, get pinnedNow() { return live.pinned; },
    version: 2
  };
})();
