// FORGE FOREVER: settings.js (design pass 11 section 3.4, card t69; the switches are design pass 9 section 3.3). One settings module
// for two doors: the main menu's General Settings and the Forge's Settings plank draw the same rows from it, flip the same keys and
// erase the smithy the same way. Each page gives it a host element and callbacks; the page's own CSS frames the rows (.set-row,
// .set-danger, .set-extra, .set-btns, .set-foot, .set-ask). Plain script, defines window.Settings. Storage is a convenience: every
// read and write is in a try/catch, and a page works without it.
(function (root) {
  "use strict";
  const KEYS = { lefty: "forge-forever:left-handed", forced: "forge-forever:forced-landscape", motion: "forge-forever:less-motion", pour: "forge-forever:tap-to-pour",
    erased: "forge-forever:erased", to: "forge-forever:to-cellar", from: "forge-forever:from-cellar", seen: "forge-forever:cellar-seen" };
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
    { name: "forced", key: KEYS.forced, label: "My screen won't turn", hint: "The Battlegrounds turn the game for you" },
    { name: "motion", key: KEYS.motion, label: "Less motion", hint: "A still fire, no shake, no flashes" },
    { name: "pour", key: KEYS.pour, label: "Tap to pour", hint: "The Crucible pours on a tap, not a hold" }
  ];
  const byName = name => SWITCHES.find(s => s.name === name) || null;
  function isOn(name) { const s = byName(name); return !!s && store.get(s.key) === "1"; }
  function setOn(name, on) { const s = byName(name); if (!s) return false; if (s.write) return store.set(s.key, s.write(on)); return on ? store.set(s.key, "1") : store.del(s.key); }
  // erase(): the saves of every world of one, the handoffs and the first-visit mark go; the four switches stay; the time is kept
  function erase() {
    const removed = [];
    try { for (let i = root.localStorage.length - 1; i >= 0; i--) { const k = root.localStorage.key(i); if (k && k.indexOf("forge-forever:local:") === 0) removed.push(k); } } catch (e) { /* no storage */ }
    for (const k of removed.concat([KEYS.to, KEYS.from, KEYS.seen])) store.del(k);
    const kept = store.set(KEYS.erased, new Date().toISOString());
    return { removed, kept };
  }
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

  // mount(host, o): the rows into host. o = { build, rows (elements placed before Erase), section (an element placed after the rows),
  // toast(m), onChange(name, on), onErase({ removed, kept }), onClose() }. Returns { render, openErase, closeErase, asking }.
  function mount(host, o) {
    if (!host || !host.ownerDocument) return null;
    o = o || {};
    const doc = host.ownerDocument;
    const say = m => { if (typeof o.toast === "function") o.toast(m); };
    host.innerHTML = `<div class="set-rows">${SWITCHES.map(s => `<button type="button" class="set-row f-iron" data-switch="${s.name}" aria-pressed="false"><b>${esc(s.label)}</b><i>${esc(s.hint)}</i><span>off</span></button>`).join("")}<button type="button" class="set-row f-iron set-danger" data-erase="1"><b>Erase my smithy</b><i>Your weapons, level and coins in this browser</i><span></span></button></div><div class="set-extra" hidden></div><div class="set-btns"><button type="button" class="f-ember set-done">Done</button></div><p class="set-foot"></p><div class="set-ask f-parch" hidden role="dialog" aria-label="Erase your smithy?"><h3>Erase your smithy?</h3><p>Everything you own, your level, coins and embers, and all you forged in this browser. The Forge starts again as it does for a new smith. This can't be undone.</p><div class="set-btns"><button type="button" class="f-ember set-keep">Keep my smithy</button><button type="button" class="f-iron set-erase">Erase it</button></div></div>`;
    const rows = host.querySelector(".set-rows"), extra = host.querySelector(".set-extra"), btns = host.querySelector(".set-btns"), foot = host.querySelector(".set-foot"), ask = host.querySelector(".set-ask");
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
      foot.textContent = "Saved in this browser · build " + (o.build || "dev");
    }
    let asking = false;
    function openErase() { asking = true; rows.hidden = true; extra.hidden = true; btns.hidden = true; foot.hidden = true; ask.hidden = false; const first = ask.querySelector("button"); if (first && !media("(pointer: coarse)")) first.focus(); }
    function closeErase() { asking = false; rows.hidden = false; extra.hidden = !o.section; btns.hidden = false; foot.hidden = false; ask.hidden = true; }
    rows.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b || !rows.contains(b)) return;
      if (b.hasAttribute("data-erase")) { openErase(); return; }
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
    return { render, openErase, closeErase, get asking() { return asking; }, host };
  }

  root.Settings = { KEYS, SWITCHES, store, reduce, phoneStill, isOn, setOn, erase, mount, version: 1 };
})(typeof window !== "undefined" ? window : globalThis);
