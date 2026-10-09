// FORGE FOREVER: settings.js (design pass 11 section 3.4, card t69; the switches are design pass 9 section 3.3). One settings module
// for two doors: the main menu's General Settings and the Forge's Settings plank draw the same rows from it, flip the same keys and
// erase the smithy the same way. Each page gives it a host element and callbacks; the page's own CSS frames the rows (.set-row,
// .set-danger, .set-extra, .set-btns, .set-foot, .set-ask). Plain script, defines window.Settings. Storage is a convenience: every
// read and write is in a try/catch, and a page works without it.
// Since build 8 (design pass 16), on a page that loads smith.js: the row Your name: Mara, which renames (the same field and rules as
// the menu's "Who's at the forge?"), and with lessons.js too, Copy my playtest notes (the lines of section 3.8, copied, and shown so
// they can be selected where copying is not allowed). Erase my smithy also forgets the player record and every player's lessons, so
// the next open asks the name again. The two sub-planks' field and notes have a little CSS of their own (#set-css).
// Since build 9 (design pass 13), where the cloud is on (window.Cloud.on, proto/cloud.js; since build 11 the GitHub Pages copy too):
// Play on another phone (a key), Bring a game here (the key typed) and Delete my game, each with its sub-plank; Erase my smithy is sent online too; the foot says where the game is saved. And on every
// copy, mount() returns addRow(el) and addSection(el), so a page adds the bench once the server says the player may have it.
(function (root) {
  "use strict";
  const KEYS = { lefty: "forge-forever:left-handed", forced: "forge-forever:forced-landscape", motion: "forge-forever:less-motion", pour: "forge-forever:tap-to-pour",
    erased: "forge-forever:erased", to: "forge-forever:to-cellar", from: "forge-forever:from-cellar", seen: "forge-forever:cellar-seen",
    smith: "forge-forever:smith", lessons: "forge-forever:lessons:" };   // (build 8: the player record, and the prefix of each player's lessons)
  // ?nostore=1 (the checks) makes storage act as if the browser blocked it
  let blockedStore = false; try { blockedStore = new URLSearchParams(root.location.search).get("nostore") === "1"; } catch (e) { blockedStore = false; }
  const store = {
    get(k) { if (blockedStore) return null; try { return root.localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { if (blockedStore) return false; try { root.localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del(k) { if (blockedStore) return false; try { root.localStorage.removeItem(k); return true; } catch (e) { return false; } }
  };
  const media = q => !!(root.matchMedia && root.matchMedia(q).matches);
  const phoneStill = () => media("(prefers-reduced-motion: reduce)");
  // reduce(): the phone asks for less motion, or the switch is on, or the page was opened with ?motion=reduce (?motion=full for the checks)
  function reduce() {
    let q = null; try { q = new URLSearchParams(root.location.search).get("motion"); } catch (e) { q = null; }
    if (q) return q === "reduce";
    return phoneStill() || store.get(KEYS.motion) === "1";
  }
  // the four switches the whole game reads. left-handed keeps its "0" (the cellar's own menu writes it that way)
  const SWITCHES = [
    { name: "lefty", key: KEYS.lefty, label: "Left-handed", hint: "The stick on the right in the Battlegrounds", write: on => on ? "1" : "0" },
    { name: "forced", key: KEYS.forced, label: "My screen won't turn", hint: "The game turns for you" },
    { name: "motion", key: KEYS.motion, label: "Less motion", hint: "A still fire, no shake, no flashes" },
    { name: "pour", key: KEYS.pour, label: "Tap to pour", hint: "The Crucible pours on a tap, not a hold" }
  ];
  const byName = name => SWITCHES.find(s => s.name === name) || null;
  function isOn(name) { const s = byName(name); return !!s && store.get(s.key) === "1"; }
  function setOn(name, on) { const s = byName(name); if (!s) return false; if (s.write) return store.set(s.key, s.write(on)); return on ? store.set(s.key, "1") : store.del(s.key); }
  // erase(): the saves of every world of one, the handoffs and the first-visit mark go, and (build 8) the player record and every
  // player's lessons, the visit's copies too; the four switches stay; the time is kept
  function eraseLocal() {
    const removed = [];
    try { for (let i = root.localStorage.length - 1; i >= 0; i--) { const k = root.localStorage.key(i); if (k && (k.indexOf("forge-forever:local:") === 0 || k.indexOf(KEYS.lessons) === 0)) removed.push(k); } } catch (e) { /* no storage */ }
    for (const k of removed.concat([KEYS.to, KEYS.from, KEYS.seen, KEYS.smith])) store.del(k);
    try { if (root.Smith) root.Smith.clear(); if (root.Lessons) root.Lessons.forgetAll(); } catch (e) { /* the keys above are gone anyway */ }
    const kept = store.set(KEYS.erased, new Date().toISOString());
    return { removed, kept };
  }
  // erase(): this phone wiped, and (build 9, the Cloudflare copy) the game erased online too, so the player's other phones forget it
  function erase() {
    const r = eraseLocal();
    try { if (root.Cloud && root.Cloud.on) root.Cloud.erase(); } catch (e) { /* the phone is wiped either way */ }
    return r;
  }
  const Cl = () => (root.Cloud && root.Cloud.on ? root.Cloud : null);
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

  // (build 8) the CSS of the two sub-planks' field and notes, written once into the page: the pages' palette and type
  const CSS = ".set-field{display:block;width:100%;height:38px;margin:2px 0 4px;padding:0 10px;font-family:var(--text,Alegreya,Georgia,serif);font-size:17px;background:var(--stone,#231c2e);color:var(--parch,#ead4aa);border:2px solid var(--oak-d,#3e2731);border-radius:0;-webkit-user-select:text;user-select:text;-webkit-appearance:none;appearance:none}" +
    ".set-field::placeholder{color:var(--dim,#8a7d6e)}.set-why{min-height:15px;margin:0 0 6px;font-family:var(--data,'Pixelify Sans',monospace);font-size:11.5px;letter-spacing:.03em;color:var(--ink3,#a22633);text-align:center}" +
    ".set-key{display:block;margin:6px 0 8px;font-family:var(--data,'Pixelify Sans',monospace);font-size:26px;font-weight:600;letter-spacing:.08em;text-align:center;color:var(--ink,#3e2731);-webkit-user-select:all;user-select:all;overflow-wrap:anywhere}" +
    ".set-notes-text{display:block;width:100%;height:128px;margin:2px 0 4px;padding:6px 8px;resize:none;font-family:var(--data,'Pixelify Sans',monospace);font-size:11.5px;line-height:1.5;background:var(--soot,#181425);color:var(--parch,#ead4aa);border:2px solid var(--oak-d,#3e2731);border-radius:0;-webkit-user-select:text;user-select:text;white-space:pre}";
  function addCSS(doc) { if (!doc || doc.getElementById("set-css")) return; const st = doc.createElement("style"); st.id = "set-css"; st.textContent = CSS; (doc.head || doc.documentElement).appendChild(st); }
  const Sm = () => root.Smith || null, Ls = () => root.Lessons || null;

  // mount(host, o): the rows into host. o = { build, rows (elements placed before Erase), section (an element placed after the rows),
  // toast(m), onChange(name, on), onErase({ removed, kept }), onClose(), onRename(record) }. Returns { render, openErase, closeErase,
  // asking, host }; closeErase closes whichever question or sub-plank is open (Erase, Your name, the notes)
  function mount(host, o) {
    if (!host || !host.ownerDocument) return null;
    o = o || {};
    const doc = host.ownerDocument;
    const say = m => { if (typeof o.toast === "function") o.toast(m); };
    if (Sm()) addCSS(doc);
    const you = Sm() ? `<button type="button" class="set-row f-iron" data-you="1" hidden><b>Your name</b><i></i><span>Rename</span></button>` : "";
    const copy = Sm() && Ls() ? `<button type="button" class="set-row f-iron" data-notes="1" hidden><b>Copy my playtest notes</b><i>Your lessons, to paste in a message</i><span>Copy</span></button>` : "";
    // (build 9) the Cloudflare copy's three rows: a key for another phone, a key typed here, and the game deleted for good
    const cloud = Cl() ? `<button type="button" class="set-row f-iron" data-key="1"><b>Play on another phone</b><i>A key to type there</i><span>Key</span></button><button type="button" class="set-row f-iron" data-claim="1"><b>Bring a game here</b><i>The key from your other phone</i><span>Enter</span></button>` : "";
    const gone = Cl() ? `<button type="button" class="set-row f-iron set-danger" data-delete="1"><b>Delete my game</b><i>Your name, game and key, online and here</i><span></span></button>` : "";
    host.innerHTML = `<div class="set-rows">${SWITCHES.map(s => `<button type="button" class="set-row f-iron" data-switch="${s.name}" aria-pressed="false"><b>${esc(s.label)}</b><i>${esc(s.hint)}</i><span>off</span></button>`).join("")}${you}${cloud}${copy}<button type="button" class="set-row f-iron set-danger" data-erase="1"><b>Erase my smithy</b><i>Your name, weapons, level and coins here</i><span></span></button>${gone}</div><div class="set-extra" hidden></div><div class="set-btns"><button type="button" class="f-ember set-done">Done</button></div><p class="set-foot"></p><div class="set-ask f-parch" hidden role="dialog" aria-label="Erase your smithy?"><h3>Erase your smithy?</h3><p>Your name and your lessons, everything you own, your level, coins and embers, and all you forged in this browser${Cl() ? ", and your place on the Roll of First Forges" : ""}. Grycus will ask who you are again. This can't be undone.</p><div class="set-btns"><button type="button" class="f-ember set-keep">Keep my smithy</button><button type="button" class="f-iron set-erase">Erase it</button></div></div>` +
      (you ? `<form class="set-ask set-you f-parch" hidden role="dialog" aria-label="Your name" novalidate autocomplete="off"><h3>Your name</h3><input class="set-field" type="text" maxlength="16" autocomplete="off" autocapitalize="words" autocorrect="off" spellcheck="false" enterkeyhint="done" placeholder="Your name" aria-label="Your name"><div class="set-why" aria-live="polite"></div><div class="set-btns"><button type="submit" class="f-ember set-rename" disabled>Rename</button><button type="button" class="f-iron set-unrename">Keep it</button></div></form>` : "") +
      (copy ? `<div class="set-ask set-notes f-parch" hidden role="dialog" aria-label="Your playtest notes"><h3>Your playtest notes</h3><textarea class="set-notes-text" readonly rows="6" aria-label="Your playtest notes"></textarea><div class="set-btns"><button type="button" class="f-ember set-copy">Copy</button><button type="button" class="f-iron set-notes-done">Done</button></div></div>` : "") +
      (cloud ? `<div class="set-ask set-keyask f-parch" hidden role="dialog" aria-label="Your key"><h3>Your key</h3><p>On your other phone, open Settings, then Bring a game here, and type it. A new key replaces the last one.</p><output class="set-key" aria-live="polite"></output><div class="set-why" aria-live="polite"></div><div class="set-btns"><button type="button" class="f-ember set-keycopy" disabled>Copy</button><button type="button" class="f-iron set-keydone">Done</button></div></div>` +
        `<form class="set-ask set-claim f-parch" hidden role="dialog" aria-label="Bring a game here" novalidate autocomplete="off"><h3>Bring a game here</h3><p>The game on this phone is replaced by the one the key belongs to.</p><input class="set-field" type="text" maxlength="24" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" enterkeyhint="go" placeholder="XXXX-XXXX-XXXX-XXXX" aria-label="Your key"><div class="set-why" aria-live="polite"></div><div class="set-btns"><button type="submit" class="f-ember set-bring" disabled>Bring my game</button><button type="button" class="f-iron set-unclaim">Keep this one</button></div></form>` +
        `<div class="set-ask set-gone f-parch" hidden role="dialog" aria-label="Delete your game?"><h3>Delete your game?</h3><p>Your name, everything you own, your key and your place on the Roll, online and on this phone. Grycus will ask who you are again. This can't be undone.</p><div class="set-why" aria-live="polite"></div><div class="set-btns"><button type="button" class="f-ember set-keepgame">Keep my game</button><button type="button" class="f-iron set-delete">Delete it</button></div></div>` : "");
    const rows = host.querySelector(".set-rows"), extra = host.querySelector(".set-extra"), btns = host.querySelector(".set-btns"), foot = host.querySelector(".set-foot"), ask = host.querySelector(".set-ask");
    const youAsk = host.querySelector(".set-you"), notesAsk = host.querySelector(".set-notes");
    const keyAsk = host.querySelector(".set-keyask"), claimAsk = host.querySelector(".set-claim"), goneAsk = host.querySelector(".set-gone");
    const eraseRow = rows.querySelector("[data-erase]");
    for (const el of (o.rows || [])) if (el) rows.insertBefore(el, eraseRow);
    if (o.section) { extra.appendChild(o.section); extra.hidden = false; }
    let saidBlocked = false;
    const blocked = () => { if (!saidBlocked) say("This browser won't keep settings"); saidBlocked = true; };
    function render() {
      const still = phoneStill();
      for (const s of SWITCHES) {
        const b = rows.querySelector(`[data-switch="${s.name}"]`); if (!b) continue;
        const on = isOn(s.name) || (s.name === "motion" && still);
        b.setAttribute("aria-pressed", String(on));
        b.classList.toggle("set-phone", s.name === "motion" && still);
        b.querySelector("span").textContent = s.name === "motion" && still ? "on · phone" : on ? "on" : "off";
      }
      // (build 8) Your name: Mara, and Copy my playtest notes once there are lessons to note
      const p = Sm() ? Sm().read() : null, yr = rows.querySelector("[data-you]"), nr = rows.querySelector("[data-notes]");
      if (yr) { yr.hidden = !p; if (p) { yr.querySelector("b").textContent = "Your name: " + p.name; yr.querySelector("i").textContent = "Your code " + Sm().code(p.id); } }
      if (nr) nr.hidden = !(p && Ls().load(p.id));
      foot.textContent = (Cl() && Cl().foot(o.build)) || "Saved in this browser · build " + (o.build || "dev");
    }
    let asking = false;
    const asks = [ask, youAsk, notesAsk, keyAsk, claimAsk, goneAsk];
    function openAsk(el) { asking = true; rows.hidden = true; extra.hidden = true; btns.hidden = true; foot.hidden = true; for (const a of asks) if (a) a.hidden = a !== el; }
    function openErase() { openAsk(ask); const first = ask.querySelector("button"); if (first && !media("(pointer: coarse)")) first.focus(); }
    function closeErase() { asking = false; rows.hidden = false; extra.hidden = !extra.childElementCount; btns.hidden = false; foot.hidden = false; for (const a of asks) if (a) a.hidden = true; }
    // Your name: the same field and rules as the menu's plank; Rename lights for a good name that is not the one already kept
    const fld = youAsk && youAsk.querySelector(".set-field"), why = youAsk && youAsk.querySelector(".set-why"), ren = youAsk && youAsk.querySelector(".set-rename");
    function checkRename() {
      const p = Sm() && Sm().read(); if (!fld || !p) return false;
      const w = Sm().checkSmithName(fld.value, root.FORGE_NAME_FILTER || null), same = Sm().cleanName(fld.value) === p.name;
      ren.disabled = !!w || same; why.textContent = fld.value.trim() ? w : "";
      return !w && !same;
    }
    function openRename() { const p = Sm().read(); if (!p) return; fld.value = p.name; checkRename(); openAsk(youAsk); if (!media("(pointer: coarse)")) { fld.focus(); fld.select(); } }
    if (youAsk) {
      fld.addEventListener("input", checkRename);
      youAsk.addEventListener("submit", e => {
        e.preventDefault(); if (!checkRename()) return;
        const r = Sm().rename(fld.value);
        try { fld.blur(); } catch (err) { /* gone */ }
        closeErase(); render();
        if (r) say(Sm().kept ? "Your name is " + r.name + " now" : "Your name is " + r.name + " for this visit: this browser won't keep it");
        if (typeof o.onRename === "function") o.onRename(r);
      });
      youAsk.querySelector(".set-unrename").addEventListener("click", closeErase);
    }
    // Copy my playtest notes: the lines go to the clipboard and show, selected where a browser will not copy them for a page
    function notesText() {
      const p = Sm().read(), rec = p ? Ls().load(p.id) : null;
      return Ls().notes(rec, { build: o.build || "dev", player: p, screen: { w: root.innerWidth, h: root.innerHeight }, touch: media("(pointer: coarse)"), lefty: isOn("lefty") });
    }
    function copyNotes() {
      const ta = notesAsk.querySelector(".set-notes-text"), text = ta.value;
      const pick = () => { try { ta.focus({ preventScroll: true }); ta.select(); ta.setSelectionRange(0, text.length); } catch (e) { /* shown anyway */ } };
      const fallback = () => { pick(); let ok = false; try { ok = !!(doc.execCommand && doc.execCommand("copy")); } catch (e) { ok = false; } say(ok ? "Copied your playtest notes" : "Select the notes and copy them"); };
      // (a browser that never answers is as one that said no: after 1.5 s the notes are selected instead)
      let answered = false; const once = f => () => { if (answered) return; answered = true; f(); };
      try { if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) { root.navigator.clipboard.writeText(text).then(once(() => say("Copied your playtest notes")), once(fallback)); root.setTimeout(once(fallback), 1500); return; } } catch (e) { /* the fallback */ }
      fallback();
    }
    if (notesAsk) {
      notesAsk.querySelector(".set-copy").addEventListener("click", copyNotes);
      notesAsk.querySelector(".set-notes-done").addEventListener("click", closeErase);
    }
    // (build 9) Key for another phone: a new key, shown big and selectable, with Copy
    let shownKey = "";
    async function openKey() {
      const out = keyAsk.querySelector(".set-key"), w = keyAsk.querySelector(".set-why"), cp = keyAsk.querySelector(".set-keycopy");
      out.textContent = "…"; w.textContent = ""; cp.disabled = true; shownKey = "";
      openAsk(keyAsk);
      const r = await Cl().newKey();
      if (r.ok) { shownKey = r.key; out.textContent = r.key; cp.disabled = false; } else { out.textContent = ""; w.textContent = r.reason || "Can't get a key right now."; }
    }
    function copyKey() {
      if (!shownKey) return;
      const out = keyAsk.querySelector(".set-key");
      const pick = () => { try { const rg = doc.createRange(); rg.selectNodeContents(out); const sel = root.getSelection(); sel.removeAllRanges(); sel.addRange(rg); } catch (e) { /* shown anyway */ } };
      try { root.navigator.clipboard.writeText(shownKey).then(() => say("Copied your key"), () => { pick(); say("Select the key and copy it"); }); } catch (e) { pick(); say("Select the key and copy it"); }
    }
    if (keyAsk) { keyAsk.querySelector(".set-keycopy").addEventListener("click", copyKey); keyAsk.querySelector(".set-keydone").addEventListener("click", closeErase); }
    // (build 9) I have a key: Bring my game lights for something shaped like a key; the game it brings replaces this phone's
    const cf = claimAsk && claimAsk.querySelector(".set-field"), cw = claimAsk && claimAsk.querySelector(".set-why"), cb = claimAsk && claimAsk.querySelector(".set-bring");
    const keyShape = v => /^[0-9a-z]{16}$/.test(String(v || "").toLowerCase().replace(/[\s-]/g, ""));
    if (claimAsk) {
      cf.addEventListener("input", () => { cb.disabled = !keyShape(cf.value); cw.textContent = ""; });
      claimAsk.addEventListener("submit", async e => {
        e.preventDefault(); if (!keyShape(cf.value)) return;
        cb.disabled = true; cw.textContent = "…";
        const r = await Cl().claim(cf.value);
        if (!r.ok) { cw.textContent = r.reason || "That key didn't work."; cb.disabled = false; return; }
        cw.textContent = ""; try { cf.blur(); } catch (err) { /* gone */ }
        say("Welcome back, " + r.smith.name);
        if (typeof o.onClaim === "function") o.onClaim(r.smith); else { try { root.location.reload(); } catch (err) { /* the next open shows it */ } }
      });
      claimAsk.querySelector(".set-unclaim").addEventListener("click", closeErase);
    }
    // (build 9) Delete my game: online and here, for good; the page starts again at the name
    if (goneAsk) {
      goneAsk.querySelector(".set-keepgame").addEventListener("click", closeErase);
      goneAsk.querySelector(".set-delete").addEventListener("click", async () => {
        const w = goneAsk.querySelector(".set-why"); w.textContent = "…";
        const r = await Cl().deleteGame();
        if (!r.ok) { w.textContent = r.reason || "Can't delete it right now."; return; }
        w.textContent = ""; closeErase(); render(); say("Your game is deleted");
        if (typeof o.onErase === "function") o.onErase({ removed: [], kept: true, deleted: true });
      });
    }
    rows.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b || !rows.contains(b)) return;
      if (b.hasAttribute("data-erase")) { openErase(); return; }
      if (b.hasAttribute("data-key")) { openKey(); return; }
      if (b.hasAttribute("data-claim")) { cf.value = ""; cb.disabled = true; cw.textContent = ""; openAsk(claimAsk); if (!media("(pointer: coarse)")) cf.focus(); return; }
      if (b.hasAttribute("data-delete")) { goneAsk.querySelector(".set-why").textContent = ""; openAsk(goneAsk); return; }
      if (b.hasAttribute("data-you")) { openRename(); return; }
      if (b.hasAttribute("data-notes")) { notesAsk.querySelector(".set-notes-text").value = notesText(); openAsk(notesAsk); copyNotes(); return; }
      const name = b.getAttribute("data-switch"); if (!name) return;
      if (name === "motion" && phoneStill()) { say("Your phone's settings ask for less motion"); return; }
      const on = !isOn(name);
      if (!setOn(name, on)) blocked();
      render();
      if (typeof o.onChange === "function") o.onChange(name, isOn(name));
    });
    host.querySelector(".set-done").addEventListener("click", () => { if (typeof o.onClose === "function") o.onClose(); });
    host.querySelector(".set-keep").addEventListener("click", closeErase);
    host.querySelector(".set-erase").addEventListener("click", () => {
      const r = erase();
      closeErase(); render();
      say(r.kept ? "Your smithy is erased. The Forge starts again." : "This browser won't keep settings, so there is no smithy here to erase");
      if (typeof o.onErase === "function") o.onErase(r);
    });
    render();
    if (Cl()) Cl().ready.then(render);   // (build 9) the foot says where the game is saved once the server has answered
    // (build 9) addRow(el): a row placed before Erase; addSection(el): an element placed after the rows (the bench, once allowed)
    function addRow(el) { if (el) rows.insertBefore(el, eraseRow); }
    function addSection(el) { if (!el) return; extra.appendChild(el); if (!asking) extra.hidden = false; }
    return { render, openErase, closeErase, addRow, addSection, openRename: youAsk ? openRename : null, notes: copy ? notesText : null, get asking() { return asking; }, host };
  }

  root.Settings = { KEYS, SWITCHES, store, reduce, phoneStill, isOn, setOn, erase, eraseLocal, mount, version: 1 };
})(typeof window !== "undefined" ? window : globalThis);
