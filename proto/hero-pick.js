// FORGE FOREVER: hero-pick.js (design pass 46 section 3.6, built as build 36 by jumpr card t110). The chooser plank: What are you?
// One component, three places: the opening's first picture (proto/intro.js, over the empty cave), the menu's ask of a player whose game
// is older than the heroes (proto/main-menu.js, with Grycus's face and words in place of the line), and Settings' Your look (proto/
// settings.js, with Keep my look beside That's me). The six heroes stand on squares of stone in a row (a 32 x 36 canvas each, drawn
// with Knight.frame at 3 CSS px a pixel, 2 when the game is small), the picked one lit with a brass rim and turning round (toward,
// right, away, left, 0.7 s each; still under less motion); the three that take a colour are drawn in the picked colour, so a colour
// tap repaints them. Under the row, the colour row (six swatches, each the colour's ramp as a little tile, the picked one with a gold
// ring) while the picked hero takes a colour, else the hero's own line in its place at the same height; then That's me (glowing) and,
// where the page asks for it, Keep my look. The six and the swatches are radio buttons (the arrow keys move between them); Enter is
// That's me when no button has the focus. The words and the lists come from spec/heroes.js (window.FORGE_HEROES), the drawings from
// proto/knight.js and proto/heroes.js; without heroes.js every tile is the knight. Its CSS goes into the page once (#hero-pick-css).
//   HeroPick.mount(host, o) -> { el, value (get: { hero, colour }), set(look), refit(), ok(), destroy() }
//     o = { look (the start: { hero, colour }), words ({ heading, line, colour, ok, keep }: FORGE_HEROES.words fills what is missing),
//           speech ({ who, words, face (a canvas, or null) } in place of the line, or null), still() (less motion), small() (the small
//           size), onPick(look), onOk(look), onKeep() (Keep my look shows when given) }
(function (root) {
  "use strict";
  const FACINGS = ["toward", "right", "away", "left"], TURN_MS = 700;
  const TILE_W = 32, TILE_H = 36;   // the figure's 32 rows, then the stone's floor under its feet
  const CSS = `
.hpick{display:grid;gap:6px;padding:6px 12px 10px;color:var(--ink,#3e2731);text-align:center;max-width:100%;min-width:0;box-sizing:border-box}
.hpick *{box-sizing:border-box}
.hpick h2{margin:0;font-family:var(--display,"Grenze Gotisch",Georgia,serif);font-weight:800;font-size:26px;line-height:1;color:var(--ink,#3e2731)}
.hpick.small h2{font-size:22px}
.hpick .hp-line,.hpick .hp-nocolour{margin:0;font-family:var(--text,Alegreya,Georgia,serif);font-size:15px;line-height:1.25;color:var(--ink,#3e2731)}
.hpick .hp-speech{display:grid;grid-template-columns:auto minmax(0,1fr);gap:2px 9px;align-items:center;text-align:left}
.hpick .hp-speech canvas{display:block;width:58px;height:58px;background:var(--stone-2,#2c2540);border:2px solid #3a4466;box-shadow:0 0 0 2px var(--soot,#181425);image-rendering:pixelated;image-rendering:crisp-edges}
.hpick.small .hp-speech canvas{width:43px;height:43px}
.hpick .hp-speech b{display:block;font-family:var(--data,"Pixelify Sans",monospace);font-weight:600;font-size:10.8px;letter-spacing:.14em;text-transform:uppercase;color:var(--oak,#733e39);line-height:1.2}
.hpick .hp-speech span{display:block;font-family:var(--text,Alegreya,Georgia,serif);font-size:15.3px;line-height:1.28;color:var(--ink,#3e2731)}
.hpick.small .hp-speech span{font-size:13.5px;line-height:1.22}
.hpick .hp-heroes{display:flex;gap:6px;justify-content:center;flex-wrap:nowrap;max-width:100%}
.hpick .hp-hero{display:grid;gap:3px;justify-items:center;margin:0;padding:0;border:0;background:none;cursor:pointer;color:var(--ink,#3e2731);-webkit-tap-highlight-color:transparent;touch-action:manipulation;font:inherit}
.hpick .hp-hero canvas{display:block;width:96px;height:108px;image-rendering:pixelated;image-rendering:crisp-edges;border:2px solid var(--soot,#181425);box-shadow:0 0 0 2px #3a4466}
.hpick.small .hp-hero canvas{width:64px;height:72px}
.hpick .hp-hero[aria-checked="true"] canvas{box-shadow:0 0 0 2px var(--brass,#feae34),0 0 10px 3px rgba(254,231,97,.55);filter:brightness(1.12)}
.hpick .hp-hero span{font-family:var(--display,"Grenze Gotisch",Georgia,serif);font-weight:700;font-size:14px;line-height:1;color:var(--ink,#3e2731)}
.hpick .hp-hero[aria-checked="true"] span{color:var(--ink3,#a22633)}
.hpick .hp-row{min-height:44px;display:grid;align-items:center;justify-items:center}
.hpick.small .hp-row{min-height:38px}
.hpick .hp-colours{display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap}
.hpick .hp-cl{font-family:var(--data,"Pixelify Sans",monospace);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--oak,#733e39);margin-right:4px}
.hpick .hp-swatch{width:40px;height:40px;margin:0;padding:0;border:2px solid var(--soot,#181425);background:none;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.hpick.small .hp-swatch{width:34px;height:34px}
.hpick .hp-swatch canvas{display:block;width:100%;height:100%;image-rendering:pixelated;image-rendering:crisp-edges}
.hpick .hp-swatch[aria-checked="true"]{box-shadow:0 0 0 3px var(--brass,#feae34)}
.hpick .hp-btns{display:flex;gap:6px;justify-content:center;flex-wrap:wrap}
.hpick .hp-btns button{min-width:140px;min-height:44px;margin:0;padding:0 14px;background-color:transparent;cursor:pointer;font-family:var(--display,"Grenze Gotisch",Georgia,serif);font-weight:800;font-size:20px;line-height:1;color:var(--soot,#181425);touch-action:manipulation}
.hpick.small .hp-btns button{min-height:40px;font-size:18px}
.hpick .hp-btns .hp-keep{color:var(--parch,#ead4aa)}
.hpick .hp-ok.glow{animation:hp-glow 1.1s ease-in-out infinite}
@keyframes hp-glow{50%{box-shadow:0 0 16px 5px rgba(247,118,34,.8)}}
.hpick button:focus-visible{outline:3px solid var(--ice,#2ce8f5);outline-offset:2px}
.still .hpick *,.hpick.still *{animation:none!important;transition:none!important}
@media (prefers-reduced-motion:reduce){.hpick *{animation:none!important;transition:none!important}}
`;
  function addCSS(doc) { if (!doc || doc.getElementById("hero-pick-css")) return; const st = doc.createElement("style"); st.id = "hero-pick-css"; st.textContent = CSS.trim(); (doc.head || doc.documentElement).appendChild(st); }
  const esc = s => String(s === undefined || s === null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const STONE = "#2c2540", STONE2 = "#231c2e", FLOOR = "#201a2b", LINE = "#3e2731";

  // the stone tile with the hero on it: the floor's line under the feet, its band below, the cellar's drop shadow, then the frame
  function paintTile(cv, hero, colour, facing, alt) {
    const K = root.Knight; if (!K || !cv) return;
    const g = cv.getContext("2d"); if (!g) return;
    g.fillStyle = alt ? STONE2 : STONE; g.fillRect(0, 0, TILE_W, TILE_H);
    g.fillStyle = FLOOR; g.fillRect(0, 31, TILE_W, TILE_H - 31);
    g.fillStyle = LINE; g.fillRect(0, 31, TILE_W, 1);
    g.fillStyle = "rgba(10,6,18,0.45)";
    for (let dx = -7; dx <= 7; dx++) { const h = Math.max(1, Math.round(Math.sqrt(1 - (dx / 7.5) ** 2) * 2)); g.fillRect(16 + dx, 31 - h + 1, 1, 2 * h - 1); }
    let f = null; try { f = K.frame(facing, "idle", 0, 0, { hero, colour }); } catch (e) { f = null; }
    if (!f) return;
    for (let k = 0; k < 32 * 32; k++) { const c = f.px[k]; if (!c) continue; g.fillStyle = c; g.fillRect(k % 32, (k / 32) | 0, 1, 1); }
  }
  // a swatch: the colour's ramp as a little tile (lit at the top left, the glint, dark at the bottom right)
  function paintSwatch(cv, ramp) {
    const g = cv.getContext("2d"); if (!g) return;
    g.fillStyle = ramp[1]; g.fillRect(0, 0, 8, 8);
    g.fillStyle = ramp[2]; g.fillRect(0, 0, 8, 1); g.fillRect(0, 0, 1, 8);
    g.fillStyle = ramp[3]; g.fillRect(1, 1, 2, 1); g.fillRect(1, 2, 1, 1);
    g.fillStyle = ramp[0]; g.fillRect(0, 7, 8, 1); g.fillRect(7, 0, 1, 8);
  }

  function mount(host, o) {
    if (!host || !host.ownerDocument) return null;
    o = o || {};
    const doc = host.ownerDocument, win = doc.defaultView || root, K = root.Knight, H = root.Heroes, D = root.FORGE_HEROES || {};
    if (!K) return null;
    addCSS(doc);
    const heroes = Array.isArray(D.heroes) && D.heroes.length ? D.heroes : (H ? H.ids.map(id => ({ id, name: H.NAMES[id], colour: H.takesColour(id) })) : [{ id: "knight", name: "Knight", colour: true }]);
    const colours = Array.isArray(D.colours) && D.colours.length ? D.colours : Object.keys(K.COLOURS).map(id => ({ id, name: id, swatch: K.COLOURS[id][1] }));
    const W = Object.assign({ heading: "What are you?", line: "It's only your look: all six fight the same.", colour: "Your colour", ok: "That's me", keep: "Keep my look" }, D.words || {}, o.words || {});
    const still = () => (typeof o.still === "function" ? !!o.still() : !!o.still);
    const small = () => (typeof o.small === "function" ? !!o.small() : !!o.small);
    const takes = id => { const h = heroes.find(x => x.id === id); return h ? !!h.colour : false; };
    const heroOf = id => heroes.find(x => x.id === id) || null;
    const normal = l => { const hero = l && heroOf(l.hero) ? l.hero : (heroOf("knight") ? "knight" : heroes[0].id), colour = l && colours.some(c => c.id === l.colour) ? l.colour : (colours[0] ? colours[0].id : "red"); return { hero, colour }; };
    const look = normal(o.look);
    let turn = 0, timer = 0, destroyed = false;
    // the plank
    const el = doc.createElement("div"); el.className = "hpick"; el.setAttribute("role", "group"); el.setAttribute("aria-label", W.heading || "What are you?");
    const speech = o.speech && (o.speech.words || o.speech.face) ? `<div class="hp-speech"><div><b class="hp-who">${esc(o.speech.who || "Grycus")}</b><span class="hp-words">${esc(o.speech.words || "")}</span></div></div>` : `<p class="hp-line">${esc(W.line)}</p>`;
    el.innerHTML = `<h2 class="hp-head">${esc(W.heading)}</h2>${speech}` +
      `<div class="hp-heroes" role="radiogroup" aria-label="${esc(W.heading)}">${heroes.map(h => `<button type="button" class="hp-hero" role="radio" data-hero="${esc(h.id)}" aria-checked="false" tabindex="-1" aria-label="${esc(h.name)}"><canvas width="${TILE_W}" height="${TILE_H}" aria-hidden="true"></canvas><span>${esc(h.name)}</span></button>`).join("")}</div>` +
      `<div class="hp-row"><div class="hp-colours" role="radiogroup" aria-label="${esc(W.colour)}"><span class="hp-cl">${esc(W.colour)}</span>${colours.map(c => `<button type="button" class="hp-swatch" role="radio" data-colour="${esc(c.id)}" aria-checked="false" tabindex="-1" aria-label="${esc(c.name)}" title="${esc(c.name)}"><canvas width="8" height="8" aria-hidden="true"></canvas></button>`).join("")}</div><p class="hp-nocolour" hidden></p></div>` +
      `<div class="hp-btns"><button type="button" class="hp-ok f-ember">${esc(W.ok)}</button><button type="button" class="hp-keep f-iron" ${typeof o.onKeep === "function" ? "" : "hidden"}>${esc(W.keep)}</button></div>`;
    if (o.speech && o.speech.face) { const sp = el.querySelector(".hp-speech"); if (sp) { try { o.speech.face.classList.add("hp-face"); sp.prepend(o.speech.face); } catch (e) { /* no face */ } } }
    host.appendChild(el);
    const tiles = Array.from(el.querySelectorAll(".hp-hero")), swatches = Array.from(el.querySelectorAll(".hp-swatch")), coloursEl = el.querySelector(".hp-colours"), noColour = el.querySelector(".hp-nocolour"), okBtn = el.querySelector(".hp-ok"), keepBtn = el.querySelector(".hp-keep");
    swatches.forEach(b => { const ramp = K.COLOURS[b.dataset.colour] || K.COLOURS.red; paintSwatch(b.querySelector("canvas"), ramp); });

    function paintTiles(only) {
      tiles.forEach((b, i) => {
        const id = b.dataset.hero, picked = id === look.hero;
        if (only && only !== id) return;
        paintTile(b.querySelector("canvas"), id, look.colour, picked && !still() ? FACINGS[turn % 4] : "toward", i % 2 === 1);
      });
    }
    function render(all) {
      tiles.forEach(b => { const on = b.dataset.hero === look.hero; b.setAttribute("aria-checked", String(on)); b.tabIndex = on ? 0 : -1; });
      swatches.forEach(b => { const on = b.dataset.colour === look.colour; b.setAttribute("aria-checked", String(on)); b.tabIndex = on ? 0 : -1; });
      const tk = takes(look.hero), h = heroOf(look.hero);
      coloursEl.hidden = !tk; noColour.hidden = tk; noColour.textContent = tk ? "" : ((h && h.noColour) || "");
      el.classList.toggle("small", small()); el.classList.toggle("still", still());
      okBtn.classList.toggle("glow", !still());
      if (all) paintTiles();
    }
    function pick(hero) { if (!heroOf(hero) || hero === look.hero) return; const was = look.hero; look.hero = hero; turn = 0; render(false); paintTiles(was); paintTiles(hero); if (typeof o.onPick === "function") { try { o.onPick(value()); } catch (e) { /* the page's */ } } }
    function colour(id) { if (!colours.some(c => c.id === id) || id === look.colour) return; look.colour = id; render(true); if (typeof o.onPick === "function") { try { o.onPick(value()); } catch (e) { /* the page's */ } } }
    const value = () => ({ hero: look.hero, colour: look.colour });
    function ok() { if (destroyed) return false; if (typeof o.onOk === "function") { try { o.onOk(value()); } catch (e) { /* the page's */ } } return true; }
    function keep() { if (destroyed) return false; if (typeof o.onKeep === "function") { try { o.onKeep(); } catch (e) { /* the page's */ } } return true; }
    // the radio groups: a tap picks; the arrow keys move the pick and the focus along the row
    const stop = e => e.stopPropagation();
    el.addEventListener("click", e => {
      const t = e.target.closest("button"); if (!t || !el.contains(t)) return;
      e.stopPropagation();
      if (t.dataset.hero) pick(t.dataset.hero); else if (t.dataset.colour) colour(t.dataset.colour); else if (t === okBtn) ok(); else if (t === keepBtn) keep();
    });
    el.addEventListener("keydown", e => {
      const t = e.target.closest ? e.target.closest("button") : null;
      if (!t) return;
      const group = t.dataset.hero ? tiles : t.dataset.colour ? swatches : null;
      if (!group) return;
      const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      if (!d) return;
      e.preventDefault(); e.stopPropagation();
      const i = group.indexOf(t), n = group[(i + d + group.length) % group.length];
      if (n.dataset.hero) pick(n.dataset.hero); else colour(n.dataset.colour);
      try { n.focus({ preventScroll: true }); } catch (err) { /* not now */ }
    });
    // Enter anywhere on the page (no field, no button in focus) is That's me
    function docKey(e) {
      if (destroyed || e.key !== "Enter" || e.defaultPrevented || !el.isConnected) return;
      const a = doc.activeElement, tag = a && a.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON" || tag === "SELECT") return;
      for (let n = el; n; n = n.parentElement) if (n.hidden) return;
      e.preventDefault(); e.stopPropagation(); ok();
    }
    doc.addEventListener("keydown", docKey, true);
    for (const ev of ["pointerdown", "pointerup", "touchstart", "touchend", "mousedown", "mouseup"]) el.addEventListener(ev, stop);   // (the page's own taps never see the plank's)
    function tick() { if (destroyed || still()) return; turn = (turn + 1) % 4; paintTiles(look.hero); }
    function arm() { if (timer) win.clearInterval(timer); timer = still() ? 0 : win.setInterval(tick, TURN_MS); }
    const api = {
      el, get value() { return value(); },
      set(l) { const n = normal(l); look.hero = n.hero; look.colour = n.colour; turn = 0; render(true); },
      refit() { if (destroyed) return; render(true); arm(); },
      ok, keep,
      destroy() { if (destroyed) return; destroyed = true; if (timer) win.clearInterval(timer); timer = 0; doc.removeEventListener("keydown", docKey, true); el.remove(); },
      get picked() { return look.hero; }, get tiles() { return tiles; }, get swatches() { return swatches; }, get okButton() { return okBtn; }, get keepButton() { return keepBtn; }
    };
    render(true); arm();
    return api;
  }

  root.HeroPick = { mount, addCSS, paintTile, FACINGS, TURN_MS, TILE_W, TILE_H, version: 1 };
})(typeof window !== "undefined" ? window : globalThis);
