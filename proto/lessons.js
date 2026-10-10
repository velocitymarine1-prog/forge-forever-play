// FORGE FOREVER: lessons.js (design pass 16 with its revision 1, built by build 8). The first five minutes: Grycus teaching a new
// player on the real screens. One module for the main menu, the Forge and the cellar (like settings.js), with no page's own knowledge:
// each page tells it what glows (through resolve and view, below). His words and every step are data (spec/lessons.json, the browser
// twin spec/lessons.js: window.FORGE_LESSONS). Here:
//   the step machine and its record, forge-forever:lessons:<player id> = { v: 1, step, started, at: { step: when it began },
//     off: { step: taps off the glow }, done, skipped, gift } (section 3.7): pure functions, and a controller that keeps it;
//   the playtest notes (section 3.8), pure;
//   where his plank goes (section 3.3), pure;
//   his plank: his face (a 16 x 16 crop of Grycus.frame("idle", 0), x 13 to 28 and y 6 to 21; since build 17 a page may give another
//     face, Nell's in the courtyard: view.face), GRYCUS (or Grycus · from the stairs, or whoever view.who names),
//     his words with {name} filled and <em> in red, TAP TO CONTINUE, the pips, Skip the lessons, a button, a counter (0 / 3; in a
//     ribbon on the name row), a tail down to his head, four kinds by place (plank, big, tiny, ribbon), the rise in three steps
//     (0.27 s), a nudge. Since build 26 (design pass 34 with its revision 1) in two voices: a talk box for a line the player taps
//     through or the plank's own button (18 px words, the face about 72 px), a lesson plank for every line that points at something
//     (15.3 px, about 58 px; the tiny plank on the plaque 14.4 px, about 43 px); a face is a whole number of device pixels a face
//     pixel (faceSize), and a step's view may lift the layer (view.z: y.fire, over Nell's plank);
//   the glow: the ember ring (3 px gold, breathing every 1.1 s) on each glowing thing, the bobbing pixel pointer (Smithy's pointer
//     glyph), the veil (soot 55 %, cut open over the glowing things and the allowed ones) and its gate (a tap anywhere else does
//     nothing but nudge his words, flare the ring and count; the glowing thing's own handlers still run), glances (a still gold
//     outline), dimmed things that do nothing (the cellar's exits, which have no veil to sit under);
//   less motion (Settings.reduce() or the phone's prefers-reduced-motion): no breathing (a steady double line), no bob, no rise.
// Everything is placed in the game root's own coordinates, measured through offsets (not getBoundingClientRect), so a root turned a
// quarter by "My screen won't turn" measures the same and turns its glow with it; measured again on resize, turn and fit, and every
// 400 ms while a step shows (only redrawn when something moved). Without window.Grycus the plank has the label and the words, no face.
// Plain script: window.Lessons in the page, module.exports in node (the pure parts: tools/test-lessons.js). Its CSS is its own,
// written once into the page's head (.lsn-*), in the pages' palette and type.
//
// The pages call it like this:
//   const L = Lessons.mount(root, {        root: the game's root (the element that turns, or one inside it that is positioned and holds
//                                            every glowing thing: #app in the Forge, #game in the cellar)
//     page: "forge" | "cellar",
//     resolve(name, stepId) → Element | Element[] | null      the things the data names: target "add", glances "coins", beat glance "rack"…
//     view(stepId, L) → null | {            what this page shows for the step, read again at every render and refit (keep it cheap). null:
//                                            nothing shows and nothing is gated (the forging; a step of another page)
//       target, glances,                    Elements, in place of the data's names
//       allow: [Element],                   bright and live above the veil (the cog; an open Settings plank)
//       block: [Element],                   dimmed; their taps do nothing but nudge and count (the cellar's exits before C7)
//       veil: bool,                         the step's own by default (the Forge's steps have one, the cellar's none)
//       anchor: { x, y },                   his head, in root coordinates: the plank sits over it with a tail (L.pointIn helps)
//       box: { x, y | bottom, w },          the plank at this box (the cellar's back wall, the plaque's top edge)
//       bounds: { x, y, w, h },             where the plank may sit (default the root less 8 px: pass the room below the sign)
//       kind, words, who, face (an Element for the plank's head in place of his; null for none), foot, button,
//       talk: bool,                         the talk box or not (default: a step of this page that ends on a tap or has a button)
//       z: number,                          the layer's z-index for this step (default the mount's z: y.fire lifts it over Nell's plank)
//       pointer: "auto" | "side" | "above" | "below" | "left" | "right" | "none",
//       manual: bool,                       a tap on the target does not end the step: the page sends L.event(name) itself when its
//                                            action is done (the bought Fire's flight; anything that leaves the page should too)
//       plank: false }                      the glow without his plank
//     onStep(id, from, L)                   the record moved on (id null when the lessons are done): the page gets the step ready,
//                                            then the step renders; a step of the other page is the page's to go to (a tap or a
//                                            key never ends it here: with page given, only that page's steps end on its taps)
//     onSkip(L)                             Skip was confirmed: the record says done and skipped; the page gives the end state
//     onButton(id, L)                       the plank's button (the farewell's Into the wild), before the step's event ends it
//     allow, desktop, lefty, still, z, build, player, store     (all optional: see mount)
//   });
//   L.render()                show the current step (call when the page's own layout changed: the walls opened, a plaque fitted)
//   L.event(name, data)       something happened: counts it toward the step's end (ends.event, ends.match, ends.count); "bonk" shows
//                             the step's bonk line; returns true when it counted
//   L.state                   what shows, for the harnesses: { step, count, need, beat, bonk, asking, showing, kind, words, who,
//                             veil, plank, tail, targets, rings, pointer, glances, holes, root, off, offTotal, record, active }
//   L.record, L.active, L.step   the record (a copy), whether lessons run (a record, not done), the step's id
//   L.advance(), L.jump(id), L.start(), L.skip(), L.askSkip(), L.finish(), L.giveGift() (true once), L.reload(), L.hide(),
//   L.pause(on), L.refit(), L.nudge(), L.notes(o), L.pointIn(el, x, y), L.destroy()
// and, with no controller (the menu, the bench, Settings): Lessons.start(playerId, o), load, save, where, forgetAll, notes, face.
(function (root) {
  "use strict";
  const KEY_PREFIX = "forge-forever:lessons:";
  const EMPTY = { version: 1, parts: [], steps: [], words: {}, start: {}, buy: {}, gift: {} };
  // the data is read when used, so it counts whichever of the two scripts loads first (pass 17's lesson)
  const D = () => root.FORGE_LESSONS || EMPTY;
  const steps = () => D().steps || [];
  const step = id => steps().find(s => s.id === id) || null;
  const index = id => steps().findIndex(s => s.id === id);
  // the first step after the menu's (f.welcome until build 17; the courtyard's y.gate since: whatever the data lists first)
  const FIRST = () => { const s = steps().find(x => x.page !== "menu"); return s ? s.id : "f.welcome"; };
  function next(id) { const i = index(id), all = steps(); return i >= 0 && i + 1 < all.length ? all[i + 1].id : null; }
  const pageOf = id => { const s = step(id); return s ? s.page : null; };
  const words = () => D().words || {};
  const isoOf = t => new Date(t === undefined || t === null ? Date.now() : t).toISOString().replace(/\.\d+Z$/, "Z");
  const ms = iso => { if (typeof iso !== "string" || !/^\d{4}-\d\d-\d\dT/.test(iso)) return null; const t = Date.parse(iso); return isNaN(t) ? null : t; };
  const clone = o => JSON.parse(JSON.stringify(o));

  // ------------------------------------------------------------------ the record (pure: each returns a new record)
  // record(saved): the record from storage, every field checked (anything missing or malformed takes its default)
  function record(saved) {
    const s = saved && typeof saved === "object" ? saved : {};
    const at = {}, off = {};
    for (const [k, v] of Object.entries(s.at && typeof s.at === "object" ? s.at : {})) if (step(k) && ms(v) !== null) at[k] = v;
    for (const [k, v] of Object.entries(s.off && typeof s.off === "object" ? s.off : {})) if (step(k) && Number.isInteger(v) && v > 0) off[k] = v;
    return { v: 1, step: step(s.step) && s.step !== "m.name" ? s.step : FIRST(), started: ms(s.started) !== null ? s.started : null, at, off,
      done: ms(s.done) !== null ? s.done : null, skipped: s.skipped === true, gift: ms(s.gift) !== null ? s.gift : null };
  }
  // begin(now, named): a new record at the welcome; named (when the menu's plank first showed) stamps m.name for the notes
  function begin(now, named) {
    const r = record(null), t = isoOf(now);
    r.started = t; r.at[FIRST()] = t;
    if (named !== undefined && named !== null && ms(isoOf(named)) <= ms(t)) r.at["m.name"] = isoOf(named);
    return r;
  }
  // moveTo: the record at a step; a step keeps the time it first began (a resume does not restart its clock)
  function moveTo(rec, id, now) { const r = clone(record(rec)); if (!step(id) || id === "m.name") return r; r.step = id; if (!r.at[id]) r.at[id] = isoOf(now); if (!r.started) r.started = r.at[id]; return r; }
  function advance(rec, now) { const n = next(record(rec).step); return n ? moveTo(rec, n, now) : finish(rec, now); }
  function finish(rec, now, skipped) { const r = clone(record(rec)); if (!r.done) r.done = isoOf(now); if (skipped) r.skipped = true; return r; }
  function offTap(rec, id) { const r = clone(record(rec)); id = id || r.step; if (step(id)) r.off[id] = (r.off[id] || 0) + 1; return r; }
  // giveGift: [record, true] the first time (the gift is written before the count plays, so a page that dies during it never gives twice)
  function giveGift(rec, now) { const r = clone(record(rec)); if (r.gift) return [r, false]; r.gift = isoOf(now); return [r, true]; }
  // where: the page the lessons want now (the menu's two buttons go there), or null when there are none or they are done
  function where(rec) { if (!rec || rec.done) return null; const p = pageOf(record(rec).step); return p === "cellar" ? "cellar" : "forge"; }

  // ------------------------------------------------------------------ storage (smith.js's store, with its visit fallback)
  function local() {
    const ok = (() => { try { return !!root.localStorage; } catch (e) { return false; } })();
    return { get(k) { try { return ok ? root.localStorage.getItem(k) : null; } catch (e) { return null; } }, set(k, v) { try { if (!ok) return false; root.localStorage.setItem(k, v); return true; } catch (e) { return false; } },
      del(k) { try { if (ok) root.localStorage.removeItem(k); return ok; } catch (e) { return false; } },
      keys(p) { const out = []; try { for (let i = 0; ok && i < root.localStorage.length; i++) { const k = root.localStorage.key(i); if (k && k.indexOf(p) === 0) out.push(k); } } catch (e) { /* none */ } return out; } };
  }
  const storeOf = s => s || (root.Smith && root.Smith.store) || local();
  function load(id, s) { if (!id) return null; let r = null; try { r = JSON.parse(storeOf(s).get(KEY_PREFIX + id) || "null"); } catch (e) { r = null; } return r && typeof r === "object" && r.v === 1 ? record(r) : null; }
  // (build 9) on the Cloudflare copy a lesson's step goes online with the rest of the player's records (proto/cloud.js)
  function save(id, rec, s) { if (!id || !rec) return false; const ok = storeOf(s).set(KEY_PREFIX + id, JSON.stringify(record(rec))); try { if (!s && root.Cloud) root.Cloud.touch(); } catch (e) { /* kept here */ } return ok; }
  // start(id, { now, named }): a new record at the welcome, saved (Into the forge; the bench's Start the lessons over)
  function start(id, o) { o = o || {}; const r = begin(o.now, o.named); save(id, r, o.store); return r; }
  // forgetAll: every forge-forever:lessons:* goes (Erase my smithy)
  function forgetAll(s) { const st = storeOf(s), ks = st.keys ? st.keys(KEY_PREFIX) : []; for (const k of ks) st.del(k); return ks; }

  // ------------------------------------------------------------------ the playtest notes (section 3.8), pure
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function span(t) { const s = Math.max(0, Math.round(t / 1000)); return s >= 60 ? Math.floor(s / 60) + " m " + (s % 60) + " s" : s + " s"; }
  const labelOf = id => { const s = step(id); return s ? s.label : id; };
  // how long each step took: from when it began to when the next began (or the end, or now)
  function times(rec, now) {
    const r = record(rec), end = ms(r.done) !== null ? ms(r.done) : (now === undefined ? Date.now() : ms(isoOf(now)));
    const marks = Object.entries(r.at).map(([id, t]) => [id, ms(t)]).sort((a, b) => a[1] - b[1] || index(a[0]) - index(b[0]));
    const out = {};
    marks.forEach(([id, t], i) => { const to = i + 1 < marks.length ? marks[i + 1][1] : end; out[id] = Math.max(0, to - t); });
    return out;
  }
  // notes(rec, { build, player: { name, id }, screen: { w, h }, touch, lefty, now }): the lines a tester pastes into a message
  function notes(rec, o) {
    o = o || {};
    const r = record(rec), now = o.now === undefined ? Date.now() : ms(isoOf(o.now)), p = o.player || {};
    const day = new Date(ms(r.started) !== null ? ms(r.started) : now);
    const code = root.Smith && root.Smith.code ? root.Smith.code : (id => String(id || "").toUpperCase());
    const sp = times(r, now), started = ms(r.started);
    let lessons;
    if (!rec) lessons = "not started";
    else if (r.done && !r.skipped) lessons = "done in " + span(ms(r.done) - started) + " (not skipped)";
    else if (r.skipped) lessons = "skipped at " + labelOf(r.step) + " (after " + span(ms(r.done) - started) + ")";
    else lessons = "not done yet, at " + labelOf(r.step) + " (after " + span(now - started) + ")";
    const longest = Object.entries(sp).filter(([, t]) => t > 0).sort((a, b) => b[1] - a[1] || index(a[0]) - index(b[0])).slice(0, 3).map(([id, t]) => labelOf(id) + " " + span(t));
    const offs = Object.entries(r.off).sort((a, b) => b[1] - a[1] || index(a[0]) - index(b[0])), total = offs.reduce((n, [, k]) => n + k, 0);
    const sc = o.screen || {};
    return [
      "Forge Forever playtest · build " + (o.build || "dev") + " · " + day.getDate() + " " + MONTHS[day.getMonth()] + " " + day.getFullYear(),
      "Player: " + (p.name || "nobody yet") + (p.id ? " (" + code(p.id) + ")" : ""),
      "Lessons: " + lessons,
      "Longest: " + (longest.join(" · ") || "none yet"),
      "Taps off the glow: " + total + (offs.length ? " (" + offs.slice(0, 3).map(([id, k]) => labelOf(id) + " " + k).join(", ") + ")" : ""),
      "Screen: " + Math.round(sc.w || 0) + " × " + Math.round(sc.h || 0) + ", " + (o.touch === false ? "mouse" : "touch") + ", left-handed " + (o.lefty ? "on" : "off")
    ].join("\n");
  }

  // ------------------------------------------------------------------ his words
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  // fill(html, name): his words as HTML: only <em> and <b> survive from the data, and the name goes in as text
  function fill(html, name) { return esc(html || "").replace(/&lt;(\/?)(em|b)&gt;/g, "<$1$2>").replace(/\{name\}/g, esc(name || "kid")); }
  const plain = html => String(html || "").replace(/<[^>]+>/g, "");
  // wordsFor(step, { desktop, lefty }): a mouse and the keys first, then Left-handed, then a phone's
  function wordsFor(s, o) { o = o || {}; if (!s) return ""; return (o.desktop && s.desktop) || (o.lefty && s.lefty) || s.words || ""; }
  // the pips: one per step of the part that has a plank (the forging has none)
  function pips(id) { const s = step(id); if (!s) return { n: 0, at: -1 }; const part = steps().filter(x => x.part === s.part && x.plank !== "none"); return { n: part.length, at: part.findIndex(x => x.id === id) }; }

  // ------------------------------------------------------------------ where his plank goes (section 3.3), pure
  const PAD = 8, CLEAR = 12, TAIL_IN = 22, TAIL_H = 14, RING_OUT = 4;
  // the widest he may be (design pass 34 revision 1, build 26: the pass's widths a tenth smaller with the type): an ordinary plank (and
  // the tiny one on the plaque) 47 % of the screen and 414 px; the big one (a talk box over his head) 67.5 % and 540 px; a ribbon 63 %
  // and 540 px; the one in the middle (the farewell, his largest, with nothing left to point at) 83 % and 648 px
  function widest(kind, W, middle) { return middle ? Math.min(0.83 * W, 648) : kind === "big" ? Math.min(0.675 * W, 540) : kind === "ribbon" ? Math.min(0.63 * W, 540) : Math.min(0.47 * W, 414); }
  const narrowest = kind => kind === "big" ? 270 : kind === "tiny" ? 200 : 216;
  const meets = (a, b) => !!a && !!b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const grow = (b, d) => ({ x: b.x - d, y: b.y - d, w: b.w + 2 * d, h: b.h + 2 * d });
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  // place(o): { x, y, w, h, tail, how, overlaps } in the root's coordinates. o = { W, H, size(w) → h, kind, targets: [boxes], anchor,
  // box, middle, bounds, maxW }. Away from the target: on the half of the screen away from it, at the top unless it is at the top, never
  // over it and 12 px round it (narrower, or above or below it, if it would be); over his head with a tail; or at a given box
  function place(o) {
    const W = o.W, H = o.H, kind = o.kind || "plank", size = o.size || (() => 80);
    const B = o.bounds ? { x: o.bounds.x, y: o.bounds.y, w: o.bounds.w, h: o.bounds.h } : { x: PAD, y: PAD, w: W - 2 * PAD, h: H - 2 * PAD };
    const zones = (o.targets || []).filter(Boolean).map(t => grow(t, CLEAR));
    const hits = b => zones.some(z => meets(b, z));
    const maxW = Math.floor(Math.min(o.maxW || widest(kind, W, !!o.middle && !o.box), B.w)), minW = Math.min(narrowest(kind), maxW);
    const at = (x, y, w, h, how, tail) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), tail: tail === undefined ? null : tail, how, overlaps: hits({ x, y, w, h }) });
    if (o.box) {
      const w = Math.min(o.box.w || maxW, B.w), h = size(w), x = clamp(o.box.x, B.x, B.x + B.w - w);
      const y = o.box.bottom !== undefined ? o.box.bottom - h : o.box.y;
      return at(x, clamp(y, B.y, B.y + B.h - h), w, h, "box");
    }
    if (o.middle) { const w = maxW, h = size(w); return at(B.x + (B.w - w) / 2, B.y + clamp((B.h - h) / 2, 0, 16), w, h, "middle"); }
    if (o.anchor) {
      // over his head: the tail at his head, the plank running right from it as his bubble does. When that would meet the target it
      // slides left first, the tail moving along its foot (never nearer its right end than 20 px), and only then narrows (design pass
      // 34: F3's plank keeps its width beside ADD instead of squeezing to five lines)
      for (let w = maxW; w >= minW; w -= 20) {
        const h = size(w), x0 = clamp(o.anchor.x - TAIL_IN, B.x, B.x + B.w - w), y = o.anchor.y - TAIL_H - h;
        if (y < B.y) break;   // no room over him: away from the target instead
        const x1 = clamp(o.anchor.x - w + 20, B.x, x0);
        for (const x of x1 < x0 ? [x0, x1] : [x0]) { const b = { x, y, w, h }; if (!hits(b)) return at(x, y, w, h, "anchor", Math.round(clamp(o.anchor.x - x, 14, w - 20))); }
      }
    }
    // nothing glows: centred at the top
    if (!zones.length) { const w = maxW, h = size(w); return at(B.x + (B.w - w) / 2, B.y, w, h, "top"); }
    // away from the target (every glowing thing together): the far half, at the top unless the target is at the top
    const t = zones.reduce((u, z) => { const x0 = Math.min(u.x, z.x), y0 = Math.min(u.y, z.y); return { x: x0, y: y0, w: Math.max(u.x + u.w, z.x + z.w) - x0, h: Math.max(u.y + u.h, z.y + z.h) - y0 }; });
    const left = t.x + t.w / 2 >= W / 2, topFirst = t.y + t.h / 2 >= H / 2;
    const xFor = w => left ? B.x : B.x + B.w - w;
    const tries = [];
    for (const atTop of [topFirst, !topFirst]) {
      let w = maxW, h = size(w), b = { x: xFor(w), y: atTop ? B.y : B.y + B.h - h, w, h };
      if (hits(b)) {
        // narrower, to keep out of the target's way across
        const room = Math.floor(left ? t.x - B.x : B.x + B.w - (t.x + t.w));
        if (room >= minW && room < w) { w = room; h = size(w); b = { x: xFor(w), y: atTop ? B.y : B.y + B.h - h, w, h }; }
      }
      if (!hits(b)) return at(b.x, b.y, b.w, b.h, w === maxW ? "away" : "narrower");
      tries.push(b);
    }
    // above or below the target, on its far half
    const w = maxW, h = size(w), x = xFor(w);
    for (const y of [t.y - h, t.y + t.h]) { const b = { x, y: clamp(y, B.y, B.y + B.h - h), w, h }; if (!hits(b)) return at(b.x, b.y, w, h, "beside"); }
    return at(tries[0].x, tries[0].y, tries[0].w, tries[0].h, "away");   // (it meets the target: overlaps says so, and the checks look)
  }

  // where the pointer goes: beside the first glowing thing, pointing in, clear of the plank when it can be
  function pointerAt(t, W, H, want, plank) {
    if (!t || want === "none") return null;
    const S = 32, r = grow(t, RING_OUT);
    const opts = {
      above: { x: t.x + t.w / 2 - S / 2, y: r.y - S + 4, dir: "down" },
      below: { x: t.x + t.w / 2 - S / 2, y: r.y + r.h - 4, dir: "up" },
      left: { x: r.x - S + 4, y: t.y + t.h / 2 - S / 2, dir: "right" },
      right: { x: r.x + r.w - 4, y: t.y + t.h / 2 - S / 2, dir: "left" }
    };
    const order = want === "side" ? (t.x + t.w / 2 >= W / 2 ? ["left", "right", "above", "below"] : ["right", "left", "above", "below"])
      : want && opts[want] ? [want, "above", "below", "left", "right"] : ["above", "below", "left", "right"];
    const fits = p => p.x >= 0 && p.y >= 0 && p.x + S <= W && p.y + S <= H && !meets({ x: p.x, y: p.y, w: S, h: S }, plank);
    const pick = order.map(k => opts[k]).find(fits) || opts[order[0]];
    return { x: Math.round(pick.x), y: Math.round(pick.y), w: S, h: S, dir: pick.dir };
  }

  // ------------------------------------------------------------------ his face: a 16 x 16 crop of his idle frame
  function facePixels() {
    try { const px = root.Grycus.frame("idle", 0).px, out = []; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) out.push(px[(6 + y) * 32 + 13 + x] || null); return out; } catch (e) { return null; }
  }
  // (design pass 34 revision 1, build 26) a face's size in CSS px: the whole number of device pixels a face pixel nearest to the
  // target, so the crop stays crisp on any screen (a talk box's 72: 14 device px a face pixel on a 3x phone, 74.67 CSS px; 9 on a 2x,
  // 72). The targets: a talk box 72, a lesson plank 57.6, the tiny plank on the plaque 43.2 (the pass's 80, 64 and 48, a tenth
  // smaller); the menu's plank and the folk's planks use the lesson plank's
  const FACE = { talk: 72, plank: 57.6, tiny: 43.2 };
  function faceSize(target, dpr) { const d = dpr > 0 ? dpr : (root.devicePixelRatio > 0 ? root.devicePixelRatio : 1); return 16 * Math.max(1, Math.round(target * d / 16)) / d; }
  // face(scale, doc): the crop on a 16 x 16 canvas shown at 16 x scale CSS px, or null without Grycus
  function face(scale, doc) {
    const px = facePixels(); doc = doc || root.document; if (!px || !doc) return null;
    const cv = doc.createElement("canvas"); cv.width = 16; cv.height = 16; cv.className = "lsn-face"; cv.setAttribute("aria-hidden", "true");
    const s = Math.max(1, scale | 0 || 3); cv.style.width = cv.style.height = 16 * s + "px";
    try { const g = cv.getContext("2d"); px.forEach((c, i) => { if (c) { g.fillStyle = c; g.fillRect(i % 16, Math.floor(i / 16), 1, 1); } }); } catch (e) { return null; }
    return cv;
  }

  // ------------------------------------------------------------------ measuring in the root's own coordinates
  // boxIn(el, root): the element's border box in the root's coordinates, through offsets: unchanged by the root's quarter turn. Each
  // scrolled box between the two counts its scroll, and each offset parent its border. null when the element is not laid out
  function boxIn(el, rt) {
    if (!el || !rt || !el.isConnected) return null;
    if (el === rt) return { x: 0, y: 0, w: rt.clientWidth, h: rt.clientHeight };
    if (!el.offsetParent && root.getComputedStyle && root.getComputedStyle(el).position !== "fixed") return null;
    let x = 0, y = 0, n = el;
    while (n && n !== rt) {
      x += n.offsetLeft; y += n.offsetTop;
      const p = n.offsetParent;
      for (let a = n.parentElement; a && a !== p && a !== rt; a = a.parentElement) { x -= a.scrollLeft; y -= a.scrollTop; }
      if (p && p !== rt) { x += p.clientLeft - p.scrollLeft; y += p.clientTop - p.scrollTop; }
      if (!p || !rt.contains(p) && p !== rt) {
        // the root is not an offset parent on the way (not positioned): fall back to the screen's rectangles (right when not turned)
        const a = el.getBoundingClientRect(), b = rt.getBoundingClientRect();
        return { x: a.left - b.left - rt.clientLeft, y: a.top - b.top - rt.clientTop, w: el.offsetWidth, h: el.offsetHeight };
      }
      n = p;
    }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  }

  // ------------------------------------------------------------------ the look, written once into the page
  const CSS = `
.lsn{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:hidden;-webkit-user-select:none;user-select:none}
.lsn[hidden]{display:none!important}
.lsn-veil{position:absolute;left:0;top:0;pointer-events:none}
.lsn-ring{position:absolute;box-sizing:border-box;border:3px solid var(--brass,#feae34);border-radius:4px;box-shadow:0 0 0 2px var(--soot,#181425),0 0 14px 3px rgba(247,118,34,.5);pointer-events:none;animation:lsn-breathe 1.1s ease-in-out infinite}
@keyframes lsn-breathe{50%{box-shadow:0 0 0 2px var(--soot,#181425),0 0 22px 8px rgba(247,118,34,.95)}}
.lsn-ring.flare{animation:lsn-flare .32s ease-out 1}
@keyframes lsn-flare{50%{box-shadow:0 0 0 2px var(--soot,#181425),0 0 30px 14px rgba(254,231,97,.95)}}
.lsn-glance{position:absolute;box-sizing:border-box;border:2px solid rgba(254,174,52,.85);border-radius:4px;box-shadow:0 0 0 2px rgba(24,20,37,.7);pointer-events:none}
.lsn-pointer{position:absolute;width:32px;height:32px;image-rendering:pixelated;image-rendering:crisp-edges;pointer-events:none;animation:lsn-bob .55s steps(3,jump-none) infinite alternate}
.lsn-pointer.up{transform:rotate(180deg);animation-name:lsn-bobup}
.lsn-pointer.right{transform:rotate(-90deg);animation-name:lsn-bobright}
.lsn-pointer.left{transform:rotate(90deg);animation-name:lsn-bobleft}
@keyframes lsn-bob{to{translate:0 4px}}
@keyframes lsn-bobup{to{translate:0 -4px}}
@keyframes lsn-bobright{to{translate:4px 0}}
@keyframes lsn-bobleft{to{translate:-4px 0}}
.lsn-plank{position:absolute;left:0;top:0;color:var(--ink,#3e2731);pointer-events:auto;cursor:default;-webkit-tap-highlight-color:transparent}
.lsn-body{position:relative;background:var(--parch,#ead4aa);border:3px solid var(--soot,#181425);box-shadow:0 0 0 3px var(--oak,#733e39);padding:7px 11px 6px 8px;display:grid;grid-template-columns:auto minmax(0,1fr);column-gap:10px;row-gap:3px;align-items:start}
.lsn-body.noface{grid-template-columns:minmax(0,1fr)}
.lsn-face{grid-row:1/span 3;display:block;width:58px;height:58px;background:var(--stone-2,#2c2540);border:2px solid #3a4466;box-shadow:0 0 0 2px var(--soot,#181425);image-rendering:pixelated;image-rendering:crisp-edges}
.lsn-who{display:block;font-family:var(--data,"Pixelify Sans","Courier New",monospace);font-weight:600;font-size:10.8px;letter-spacing:.14em;text-transform:uppercase;color:var(--oak,#733e39);line-height:1.1}
.lsn-words{margin:0;font-family:var(--text,Alegreya,Georgia,serif);font-size:15.3px;line-height:1.28;color:var(--ink,#3e2731);text-wrap:pretty}
.lsn-words b{font-weight:700}
.lsn-words em{font-style:normal;font-weight:700;color:var(--ink3,#a22633)}
.lsn-foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:3px 10px;margin-top:1px;min-height:12px}
.lsn-body.noface .lsn-foot{grid-column:1}
.lsn-tap{font-family:var(--data,"Pixelify Sans",monospace);font-weight:600;font-size:11.25px;letter-spacing:.2em;color:var(--ink3,#a22633);white-space:nowrap}
.lsn-pips{display:flex;gap:3px}
.lsn-pips i{display:block;width:5px;height:5px;background:rgba(62,39,49,.25)}
.lsn-pips i.on{background:var(--ember,#f77622)}
.lsn-pips i.was{background:var(--oak,#733e39)}
.lsn-skip{border:0;background:none;padding:2px 0;margin:0;font-family:var(--data,"Pixelify Sans",monospace);font-size:11.25px;letter-spacing:.06em;color:var(--oak,#733e39);text-decoration:underline;cursor:pointer;touch-action:manipulation}
.lsn-count{font-family:var(--data,"Pixelify Sans",monospace);font-weight:600;font-size:13.5px;letter-spacing:.06em;color:var(--ink3,#a22633);white-space:nowrap}
.lsn-btn{grid-column:1/-1;justify-self:center;margin-top:6px;min-height:44px;min-width:170px;padding:0 20px;background-color:transparent;font-family:var(--display,"Grenze Gotisch",Georgia,serif);font-weight:800;font-size:20px;line-height:1;color:var(--soot,#181425);cursor:pointer;touch-action:manipulation}
.lsn-plank.tail .lsn-body::after{content:"";position:absolute;left:var(--tail,24px);bottom:-10px;width:13px;height:13px;margin-left:-8px;background:var(--parch,#ead4aa);border-right:3px solid var(--soot,#181425);border-bottom:3px solid var(--soot,#181425);transform:rotate(45deg)}
.lsn-plank.tiny .lsn-body{padding:5px 9px 5px 6px;column-gap:8px}
.lsn-plank.tiny .lsn-face{grid-row:1/span 2;width:43px;height:43px}
.lsn-plank.tiny .lsn-words{font-size:14.4px;line-height:1.25}
.lsn-plank.ribbon .lsn-body{padding:5px 10px 5px 6px;column-gap:9px}
.lsn-plank.ribbon .lsn-words{font-size:15.3px;line-height:1.26}
.lsn-plank.ribbon .lsn-who{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.lsn-plank.ribbon .lsn-who .lsn-count{letter-spacing:.06em;text-transform:none}
.lsn-plank.talk .lsn-body{padding:9px 13px 8px 9px;column-gap:12px}
.lsn-plank.talk .lsn-face{width:72px;height:72px}
.lsn-plank.talk .lsn-who{font-size:11.7px}
.lsn-plank.talk .lsn-words{font-size:18px;line-height:1.3}
.lsn-plank.talk .lsn-tap{font-size:11.7px}
.lsn-plank.rise .lsn-body{animation:lsn-rise .27s steps(3,end)}
@keyframes lsn-rise{from{translate:0 6px;opacity:.2}to{translate:0 0;opacity:1}}
.lsn-plank.nudge{animation:lsn-nudge .2s linear 1}
@keyframes lsn-nudge{25%{translate:2px 0}75%{translate:-2px 0}}
.lsn-plank .lsn-words.beat{font-style:italic}
.lsn-shroud{position:absolute;left:0;top:0;width:100%;height:100%;background:rgba(24,20,37,.55);pointer-events:auto}
.lsn-ask{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(340px,calc(100% - 24px));padding:6px 12px 10px;color:var(--ink,#3e2731);pointer-events:auto;text-align:center}
.lsn-ask h3{margin:0 0 4px;font-family:var(--display,"Grenze Gotisch",Georgia,serif);font-weight:800;font-size:25px;line-height:1.05;color:var(--ink,#3e2731)}
.lsn-ask p{margin:0 0 8px;font-family:var(--text,Alegreya,Georgia,serif);font-size:15px;line-height:1.3;color:var(--ink,#3e2731)}
.lsn-ask .lsn-two{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.lsn-ask button{min-height:44px;padding:0 6px;background-color:transparent;font-family:var(--display,"Grenze Gotisch",Georgia,serif);font-weight:700;font-size:18px;line-height:1;cursor:pointer;touch-action:manipulation}
.lsn-ask .f-ember{color:var(--soot,#181425)}
.lsn-ask .f-iron{color:var(--parch,#ead4aa)}
.lsn-dim{filter:brightness(.45) saturate(.5)!important}
.lsn.still .lsn-ring{animation:none!important;box-shadow:0 0 0 2px var(--soot,#181425),0 0 0 4px var(--brass,#feae34)}
.lsn.still .lsn-pointer,.lsn.still .lsn-plank,.lsn.still .lsn-body{animation:none!important}
@media (prefers-reduced-motion:reduce){.lsn-ring{animation:none!important;box-shadow:0 0 0 2px var(--soot,#181425),0 0 0 4px var(--brass,#feae34)}.lsn-pointer,.lsn-plank,.lsn-body{animation:none!important}}
`;
  function addCSS(doc) {
    if (!doc || doc.getElementById("lsn-css")) return;
    const st = doc.createElement("style"); st.id = "lsn-css"; st.textContent = CSS.trim(); (doc.head || doc.documentElement).appendChild(st);
  }
  function pointerCanvas(doc) {
    const cv = doc.createElement("canvas"); cv.className = "lsn-pointer"; cv.setAttribute("aria-hidden", "true");
    try { root.Smithy.glyph(cv, "pointer", 1); } catch (e) { cv.width = 16; cv.height = 16; }
    return cv;
  }

  // ------------------------------------------------------------------ the controller
  const GATED = ["pointerdown", "pointerup", "mousedown", "mouseup", "touchstart", "touchend", "click", "dblclick", "contextmenu"];
  const media = q => { try { return !!(root.matchMedia && root.matchMedia(q).matches); } catch (e) { return false; } };
  function param(k) { try { return new URLSearchParams(root.location.search).get(k); } catch (e) { return null; } }
  // mount(rt, o): o = { page, resolve, view, onStep, onSkip, onButton, onOff, allow (Elements, or a function: always bright and
  // live), desktop (words for a mouse; default a fine pointer, or ?pointer=fine), lefty (default Settings' switch), still (default
  // Settings.reduce()), z (the layer's z-index in the root, default 6: over the Forge's plaque, under its planks and Settings),
  // build (default the body's data-build), player ({ id, name }, default Smith.read()), store (default Smith.store) }
  function mount(rt, o) {
    if (!rt || !rt.ownerDocument) return null;
    o = o || {};
    const doc = rt.ownerDocument, win = doc.defaultView || root;
    addCSS(doc);
    const S = root.Settings || null;
    const desktop = () => o.desktop !== undefined ? !!o.desktop : param("pointer") ? param("pointer") === "fine" : media("(pointer: fine)");
    const lefty = () => o.lefty !== undefined ? !!o.lefty : !!(S && S.isOn && S.isOn("lefty"));
    const still = () => o.still !== undefined ? !!o.still : S && S.reduce ? S.reduce() : media("(prefers-reduced-motion: reduce)");
    const player = () => o.player || (root.Smith && root.Smith.read ? root.Smith.read() : null);
    const store = storeOf(o.store);
    let who = player(), rec = who ? load(who.id, store) : null;
    // the layer, last in the root so it sits over the page at equal z
    const layer = doc.createElement("div"); layer.className = "lsn"; layer.hidden = true; layer.style.zIndex = String(o.z === undefined ? 6 : o.z);
    rt.appendChild(layer);
    const SVGNS = "http://www.w3.org/2000/svg";
    const veil = doc.createElementNS(SVGNS, "svg"); veil.setAttribute("class", "lsn-veil"); veil.setAttribute("aria-hidden", "true");
    const maskId = "lsn-mask-" + Math.random().toString(36).slice(2, 8);
    veil.innerHTML = `<defs><mask id="${maskId}"><rect x="0" y="0" width="100%" height="100%" fill="#fff"></rect><g class="lsn-holes"></g></mask></defs><rect x="0" y="0" width="100%" height="100%" fill="rgba(24,20,37,.55)" mask="url(#${maskId})"></rect>`;
    const holesG = veil.querySelector(".lsn-holes");
    const marks = doc.createElement("div");   // rings, glances, the pointer: over the plank, whose own button can glow
    const plank = doc.createElement("div"); plank.className = "lsn-plank"; plank.setAttribute("role", "status"); plank.setAttribute("aria-live", "polite");
    const shroud = doc.createElement("div"); shroud.className = "lsn-shroud"; shroud.hidden = true;
    const ask = doc.createElement("div"); ask.className = "lsn-ask f-parch"; ask.hidden = true; ask.setAttribute("role", "dialog");
    layer.append(veil, plank, marks, shroud, ask);
    const live = { count: 0, beat: null, bonk: null, asking: false, paused: false, shown: null, view: null, key: "", els: { targets: [], allow: [], block: [], glances: [] }, laid: null, pending: null, timers: [] };
    let destroyed = false, lastDown = -1e9, watch = 0;
    const L = {};

    // ---------------------------------------------------------------- the record
    const keep = r => { rec = r; if (who && rec) save(who.id, rec, store); };
    const s = () => rec ? step(rec.step) : null;
    function moved(from) {
      live.count = 0; live.bonk = null; live.key = "";
      const id = rec && !rec.done ? rec.step : null;
      if (typeof o.onStep === "function") { try { o.onStep(id, from, L); } catch (e) { report(e); } }
      render(true);
    }
    function report(e) { try { (win.__errors || []).push("lessons: " + (e && e.message || e)); } catch (x) { /* no list */ } }
    L.advance = () => { if (!rec || rec.done) return false; const from = rec.step; keep(advance(rec)); moved(from); return true; };
    L.jump = id => { if (!rec || !step(id)) return false; const from = rec.step; const r = moveTo(rec, id); r.done = null; r.skipped = false; keep(r); moved(from); return true; };
    L.start = (now, named) => { who = player(); if (!who) return false; const from = rec ? rec.step : null; keep(begin(now, named)); moved(from); return true; };
    L.finish = () => { if (!rec || rec.done) return false; const from = rec.step; keep(finish(rec)); moved(from); return true; };
    L.skip = () => {
      if (!rec || rec.done) return false;
      const from = rec.step; keep(finish(rec, undefined, true)); closeAsk();
      if (typeof o.onSkip === "function") { try { o.onSkip(L); } catch (e) { report(e); } }
      moved(from); return true;
    };
    L.giveGift = () => { if (!rec) return false; const [r, first] = giveGift(rec); keep(r); return first; };
    L.reload = () => { who = player(); rec = who ? load(who.id, store) : null; live.key = ""; render(true); return rec; };
    // event(name, data): counted toward the step's end when it is the step's event and matches (ends.match)
    L.event = (name, data) => {
      const st = s(); if (!st || rec.done || live.asking) return false;
      if (live.beat) return false;   // (a beat is his line between two steps: the next step counts once it shows)
      if (name === "bonk" && st.bonk) { const tok = live.bonk = Date.now() + (st.bonk.ms || 1600); later(() => { if (live.bonk === tok) { live.bonk = null; render(false); } }, st.bonk.ms || 1600); render(false); return true; }
      const e = st.ends || {}, ev = e.on === "tap" ? "tap" : e.event;
      if (name !== ev) return false;
      for (const [k, v] of Object.entries(e.match || {})) if (!data || data[k] !== v) return false;
      live.count++;
      if (live.count < (e.count || 1)) { render(false); return true; }
      if (st.beat) {
        // the beat: his line between two steps, for its time (a tap on his plank cuts it short); the record has moved on already
        live.beat = { from: st.id, words: st.beat.words, glance: st.beat.glance || null, until: Date.now() + st.beat.ms };
        const from = rec.step; keep(advance(rec)); live.count = 0; live.key = "";
        if (typeof o.onStep === "function") { try { o.onStep(rec.done ? null : rec.step, from, L); } catch (err) { report(err); } }
        later(() => { if (live.beat && live.beat.from === from) { live.beat = null; render(true); } }, st.beat.ms);
        render(true);
        return true;
      }
      L.advance(); return true;
    };
    function later(fn, t) { const id = win.setTimeout(() => { live.timers = live.timers.filter(x => x !== id); if (!destroyed) fn(); }, t); live.timers.push(id); return id; }
    const endBeat = () => { if (!live.beat) return false; live.beat = null; render(true); return true; };

    // ---------------------------------------------------------------- the skip question
    function openAsk() {
      const w = words().skip || {};
      ask.innerHTML = `<h3>${esc(w.heading || "Skip the lessons?")}</h3><p>${esc(w.words || "")}</p><div class="lsn-two"><button type="button" class="f-ember" data-yes>${esc(w.yes || "Skip")}</button><button type="button" class="f-iron" data-no>${esc(w.no || "Keep learning")}</button></div>`;
      ask.querySelector("[data-yes]").addEventListener("click", () => L.skip());
      ask.querySelector("[data-no]").addEventListener("click", () => { closeAsk(); render(false); });
      live.asking = true; shroud.hidden = false; ask.hidden = false; layer.hidden = false;
      if (desktop()) { const b = ask.querySelector("[data-no]"); try { b.focus({ preventScroll: true }); } catch (e) { b.focus(); } }
    }
    function closeAsk() { live.asking = false; shroud.hidden = true; ask.hidden = true; }
    L.askSkip = () => { if (!rec || rec.done) return false; openAsk(); return true; };

    // ---------------------------------------------------------------- what shows
    const list = v => (Array.isArray(v) ? v : v ? [v] : []).flatMap(x => Array.isArray(x) ? x : [x]).filter(x => x && x.nodeType === 1);
    const resolve = (names, id) => (Array.isArray(names) ? names : names ? [names] : []).flatMap(n => { if (n && n.nodeType === 1) return [n]; if (typeof o.resolve !== "function") return []; try { return list(o.resolve(n, id)); } catch (e) { report(e); return []; } });
    function hideAll() {
      layer.hidden = !live.asking; plank.hidden = true; veil.style.display = "none"; marks.innerHTML = "";
      for (const el of live.els.block) el.classList.remove("lsn-dim");
      live.shown = null; live.view = null; live.laid = null; live.els = { targets: [], allow: [], block: [], glances: [] };
    }
    L.hide = () => { hideAll(); };
    L.pause = on => { live.paused = !!on; if (live.paused) hideAll(); else render(false); };
    function render(entering) {
      if (destroyed) return;
      const st = s();
      if (!st || rec.done || live.paused) { hideAll(); stopWatch(); return; }
      let v = null;
      try { v = typeof o.view === "function" ? o.view(st.id, L) : {}; } catch (e) { report(e); v = null; }
      if (!v) { hideAll(); stopWatch(); return; }
      const beat = live.beat;
      const allowOpt = typeof o.allow === "function" ? o.allow() : o.allow;
      const els = {
        targets: beat ? [] : list(v.target !== undefined ? v.target : resolve(st.target === "button" ? null : st.target, st.id)),
        glances: beat ? resolve(beat.glance, st.id) : list(v.glances !== undefined ? v.glances : resolve(st.glances, st.id)),
        allow: list(allowOpt).concat(list(v.allow)),
        block: list(v.block)
      };
      for (const el of live.els.block) if (!els.block.includes(el)) el.classList.remove("lsn-dim");
      for (const el of els.block) el.classList.add("lsn-dim");
      live.view = v; live.els = els;
      layout(st, v, beat, entering);
      startWatch();
    }
    // the plank's contents for the step (or the beat)
    function fillPlank(st, v, beat) {
      const kind = v.kind || st.plank || "plank", W = words(), d = desktop();
      const text = beat ? beat.words : live.bonk && st.bonk ? st.bonk.words : v.words !== undefined ? v.words : wordsFor(st, { desktop: d, lefty: lefty() });
      const label = v.who || (kind === "ribbon" ? W.stairs || "Grycus · from the stairs" : W.who || "Grycus");
      const foot = beat || v.foot === false || (v.foot === undefined && st.foot === false) ? null : (() => {
        const bits = [], e = st.ends || {}, pp = pips(st.id);
        if (kind !== "ribbon" && pp.n > 1) bits.push(`<span class="lsn-pips" aria-hidden="true">${Array.from({ length: pp.n }, (_, i) => `<i class="${i === pp.at ? "on" : i < pp.at ? "was" : ""}"></i>`).join("")}</span>`);
        if ((e.count || 1) > 1 && kind !== "ribbon") bits.push(`<span class="lsn-count">${live.count} / ${e.count}</span>`);   // (a ribbon's rides on its name row)
        if (e.on === "tap") bits.push(`<span class="lsn-tap">${esc((W.continue || {})[d ? "desktop" : "touch"] || "TAP TO CONTINUE")}</span>`);
        if (st.skip) bits.push(`<button type="button" class="lsn-skip" data-lsn-skip>${esc((W.skip || {}).link || "Skip the lessons")}</button>`);
        return bits.length ? `<div class="lsn-foot">${bits.join("")}</div>` : null;
      })();
      const btn = !beat && (v.button !== undefined ? v.button : st.button);
      // (design pass 34) the talk box: a line the player taps through (a step of this page that ends on a tap) or the plank's own
      // button (the farewell); never a beat, the bonk or another page's step shown here (the yard's resume line); a view may say so
      const mine = !o.page || st.page === o.page, ends = st.ends || {};
      const talk = v.talk !== undefined ? !!v.talk : !beat && !(live.bonk && st.bonk) && mine && (ends.on === "tap" || !!btn);
      // (design pass 34 revision 1) the face at a whole number of device pixels a face pixel: about 72 px in a talk box, 58 on a
      // lesson plank, 43 on the plaque's tiny one; the count of a ribbon on its name row
      const dpr = win.devicePixelRatio > 0 ? win.devicePixelRatio : 1, fpx = faceSize(talk ? FACE.talk : kind === "tiny" ? FACE.tiny : FACE.plank, dpr);
      const count = kind === "ribbon" && !beat && (ends.count || 1) > 1 ? `<span class="lsn-count">${live.count} / ${ends.count}</span>` : "";
      const key = [kind, talk, text, label, foot, count, btn, fpx, !!(root.Grycus), who ? who.name : "", v.face === null ? "noface" : v.face && v.face.nodeType === 1 ? "face:" + (v.face.dataset.face || "x") : ""].join("|");   // (the name too: a rename refills it)
      if (plank.dataset.key === key) return kind;
      plank.dataset.key = key;
      plank.className = "lsn-plank " + kind + (talk ? " talk" : "");
      plank.innerHTML = `<div class="lsn-body"><span class="lsn-who">${esc(label)}${count}</span><p class="lsn-words${beat ? " beat" : ""}">${fill(text, who ? who.name : "")}</p>${foot || ""}${btn ? `<button type="button" class="lsn-btn f-ember" data-lsn-btn>${esc(btn)}</button>` : ""}</div>`;
      // (build 17) the face: the page's own when it gives one (Nell's, in the courtyard), his by default, none when asked; sized here
      const body = plank.firstChild, f = v.face === null ? null : v.face && v.face.nodeType === 1 ? v.face : face(4, doc);
      if (f) { if (f.classList && !f.classList.contains("lsn-face")) f.classList.add("lsn-face"); f.style.width = f.style.height = fpx + "px"; body.prepend(f); } else body.classList.add("noface");
      const sk = plank.querySelector("[data-lsn-skip]"); if (sk) sk.addEventListener("click", e => { e.stopPropagation(); openAsk(); });
      const b = plank.querySelector("[data-lsn-btn]"); if (b) b.addEventListener("click", () => {
        if (typeof o.onButton === "function") { try { o.onButton(st.id, L); } catch (e) { report(e); } }
        const e = st.ends || {}; if (e.on === "target" && (st.target === "button" || !st.target)) L.event(e.event);
      });
      return kind;
    }
    function layout(st, v, beat, entering) {
      const W = rt.clientWidth, H = rt.clientHeight;
      if (!W || !H) return;
      layer.hidden = false;
      layer.style.zIndex = String(v.z !== undefined ? v.z : o.z === undefined ? 6 : o.z);   // (design pass 34: y.fire lifts it over Nell's plank)
      const veilOn = !beat && (v.veil !== undefined ? !!v.veil : !!st.veil);
      layer.classList.toggle("still", still());
      // the boxes of what glows, what is allowed and what is glanced at
      const tb = live.els.targets.map(el => boxIn(el, rt)).filter(Boolean);
      const ab = live.els.allow.map(el => boxIn(el, rt)).filter(Boolean);
      const gb = live.els.glances.map(el => boxIn(el, rt)).filter(Boolean);
      // his plank
      let pl = null, kind = v.kind || st.plank || "plank";
      if (v.plank !== false && kind !== "none") {
        kind = fillPlank(st, v, beat);
        plank.hidden = false;
        const size = w => { plank.style.width = w + "px"; return plank.offsetHeight; };
        pl = place({ W, H, kind, size, targets: tb, anchor: v.anchor || null, box: v.box || null, middle: (v.place || st.place) === "middle" && !v.anchor && !v.box, bounds: v.bounds || null, maxW: v.maxW });
        plank.style.width = pl.w + "px"; plank.style.left = pl.x + "px"; plank.style.top = pl.y + "px";
        plank.classList.toggle("tail", pl.tail !== null);
        if (pl.tail !== null) plank.style.setProperty("--tail", pl.tail + "px");
        if (entering && !still()) { plank.classList.remove("rise"); void plank.offsetWidth; plank.classList.add("rise"); later(() => plank.classList.remove("rise"), 320); }
      } else { plank.hidden = true; plank.dataset.key = ""; }
      // the plank's own button glows too (the farewell's Into the wild): measured once the plank is placed, its pointer under it
      const own = plank.hidden ? null : plank.querySelector("[data-lsn-btn]");
      const ownB = own && st.target === "button" && !beat ? boxIn(own, rt) : null;
      if (ownB) tb.push(ownB);
      // the veil, cut open over what glows and what is allowed
      const holes = veilOn ? tb.concat(ab).map(b => grow(b, 2)) : [];
      if (veilOn) {
        veil.style.display = ""; veil.setAttribute("width", W); veil.setAttribute("height", H); veil.setAttribute("viewBox", `0 0 ${W} ${H}`);
        holesG.innerHTML = holes.map(b => `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="3" fill="#000"></rect>`).join("");
      } else veil.style.display = "none";
      // the rings, the pointer, the glances
      const rings = tb.map(b => grow(b, RING_OUT));
      const inPlank = !!ownB && tb[0] === ownB;
      const ptr = tb.length ? pointerAt(tb[0], W, H, inPlank ? "below" : v.pointer || st.pointer || "auto", inPlank ? null : pl) : null;
      marks.innerHTML = "";
      for (const g of gb) marks.appendChild(boxEl("lsn-glance", grow(g, 3)));
      for (const r of rings) marks.appendChild(boxEl("lsn-ring", r));
      if (ptr) { const cv = pointerCanvas(doc); if (ptr.dir !== "down") cv.classList.add(ptr.dir); cv.style.left = ptr.x + "px"; cv.style.top = ptr.y + "px"; marks.appendChild(cv); }
      live.laid = { W, H, veil: veilOn, plank: pl ? { x: pl.x, y: pl.y, w: pl.w, h: pl.h } : null, tail: pl && pl.tail !== null ? { x: pl.x + pl.tail, y: pl.y + pl.h } : null, how: pl ? pl.how : null, overlaps: pl ? pl.overlaps : false, kind, targets: tb, rings, pointer: ptr, glances: gb, holes, allow: ab };
      live.shown = st.id;
      live.key = signature();
      // with a mouse or the keys, the glowing thing takes the focus, so Enter presses it
      if (entering && desktop() && live.els.targets[0] && !beat) { try { live.els.targets[0].focus({ preventScroll: true }); } catch (e) { /* not focusable */ } }
      if (entering && own && desktop()) { try { own.focus({ preventScroll: true }); } catch (e) { /* kept */ } }
    }
    function boxEl(cls, b) { const el = doc.createElement("div"); el.className = cls; el.style.left = b.x + "px"; el.style.top = b.y + "px"; el.style.width = b.w + "px"; el.style.height = b.h + "px"; return el; }
    // what the layout depends on: the root's size and every glowing thing's box. The watch redraws only when it changes
    function signature() { const bx = el => { const b = boxIn(el, rt); return b ? [b.x, b.y, b.w, b.h].map(Math.round).join(",") : "-"; }; return [rt.clientWidth, rt.clientHeight, ...live.els.targets.map(bx), ...live.els.allow.map(bx), ...live.els.glances.map(bx), live.view && JSON.stringify(live.view.anchor || live.view.box || null)].join(";"); }
    L.refit = () => { if (live.shown) render(false); };
    function startWatch() { if (watch) return; watch = win.setInterval(() => { if (!live.shown || live.paused) return; let v = null; try { v = typeof o.view === "function" ? o.view(rec.step, L) : {}; } catch (e) { v = null; } if (!v) { render(false); return; } live.view = v; if (signature() !== live.key) render(false); }, 400); }
    function stopWatch() { if (watch) { win.clearInterval(watch); watch = 0; } }
    L.render = () => render(true);

    // ---------------------------------------------------------------- the gate: taps that are not on the glow
    function nudge() {
      if (!still()) {
        plank.classList.remove("nudge"); void plank.offsetWidth; plank.classList.add("nudge"); later(() => plank.classList.remove("nudge"), 220);
        for (const r of marks.querySelectorAll(".lsn-ring")) { r.classList.remove("flare"); void r.offsetWidth; r.classList.add("flare"); later(() => r.classList.remove("flare"), 340); }
      }
    }
    L.nudge = nudge;
    L.offTap = () => { if (!rec || rec.done) return false; keep(offTap(rec)); nudge(); if (typeof o.onOff === "function") { try { o.onOff(rec.step, rec.off[rec.step]); } catch (e) { report(e); } } return true; };
    const inAny = (els, t) => els.some(el => el === t || el.contains(t));
    // what is allowed at this tap: an allow function is asked again, so a plank opened since the last render (the Forge's Settings)
    // takes its taps at once
    const allowNow = () => { if (typeof o.allow !== "function") return live.els.allow; try { return list(o.allow()).concat(list(live.view && live.view.allow)); } catch (e) { return live.els.allow; } };
    function zone(t) {
      if (!t || t.nodeType !== 1 && t.nodeType !== 3) return "outside";
      if (t.nodeType === 3) t = t.parentElement;
      if (ask.contains(t) || shroud === t) return "ask";
      if (!rt.contains(t)) return "outside";
      if (plank.contains(t)) return t.closest("[data-lsn-skip],[data-lsn-btn]") ? "control" : "plank";
      if (inAny(live.els.targets, t)) return "target";
      if (inAny(live.els.block, t)) return "block";   // (before allow: a blocked button inside an allowed plank, the cellar's menu's ways out, stays blocked)
      if (inAny(allowNow(), t)) return "allow";
      return "room";
    }
    function gate(e) {
      if (destroyed || !rec || rec.done) return;
      const kind = zone(e.target);
      if (kind === "outside") return;
      const block = () => { if (e.cancelable) e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); };
      if (live.asking) { if (kind !== "ask") block(); return; }
      if (!live.shown) return;
      // one act per tap: on its pointerdown, or on a click that came with none (the keys, or a script's click)
      const now = Date.now(), first = e.type === "pointerdown" || (e.type === "click" && (e.detail === 0 || now - lastDown > 1000));
      if (e.type === "pointerdown") lastDown = now;
      // (a step of another page, shown here as a way to it, e.g. the Forge's resume line during a cellar step, is never ended by a tap
      // here: its taps are off the glow, and its target only runs its own handler)
      const st = s(), mine = !o.page || st.page === o.page, tapStep = mine && !live.beat && (st.ends || {}).on === "tap", veilOn = !!(live.laid && live.laid.veil);
      if (kind === "control" || kind === "allow") return;
      if (kind === "target") {
        if (mine && e.type === "click" && !live.beat && (st.ends || {}).on === "target" && !(live.view && live.view.manual)) schedule((st.ends || {}).event, st.id);
        return;
      }
      if (kind === "block") { block(); if (first) L.offTap(); return; }
      if (live.beat && kind === "plank") { block(); if (first) endBeat(); return; }
      if (tapStep) { if (veilOn || kind === "plank") block(); if (first) L.event("tap"); return; }
      if (veilOn) { block(); if (first) L.offTap(); return; }
      if (kind === "plank" && first) nudge();
    }
    // a tap on the glowing thing ends its step once the page's own handlers have run (or at once, if the page is leaving)
    function schedule(name, id) {
      if (!name) return;
      live.pending = { name, id };
      win.setTimeout(flush, 0);
    }
    // (only on the step it was for: the page may have moved the lessons on itself meanwhile)
    function flush() { const p = live.pending; live.pending = null; if (p && rec && !rec.done && rec.step === p.id) L.event(p.name); }
    for (const t of GATED) win.addEventListener(t, gate, { capture: true, passive: false });
    win.addEventListener("pagehide", flush);
    // the keys: Enter, Space or → continue a step that ends on a tap (not while a button that is allowed has the focus)
    function onKey(e) {
      if (destroyed || !live.shown || live.asking || !rec || rec.done) return;
      const st = s(), a = doc.activeElement;
      if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable)) return;
      if (a && a !== doc.body && (inAny(allowNow(), a) || a.closest && a.closest("[data-lsn-skip],[data-lsn-btn]"))) return;
      if (!["Enter", " ", "ArrowRight"].includes(e.key)) return;
      if (live.beat) { e.preventDefault(); endBeat(); return; }
      if ((st.ends || {}).on === "tap" && (!o.page || st.page === o.page)) { e.preventDefault(); L.event("tap"); }
    }
    win.addEventListener("keydown", onKey, true);
    // measured again on resize, turn and fit (and the fonts arriving)
    let raf = 0;
    const refitSoon = () => { if (raf) return; raf = (win.requestAnimationFrame || (f => win.setTimeout(f, 16)))(() => { raf = 0; L.refit(); }); };
    win.addEventListener("resize", refitSoon); win.addEventListener("orientationchange", refitSoon);
    if (win.visualViewport) win.visualViewport.addEventListener("resize", refitSoon);
    try { if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(refitSoon); } catch (e) { /* no font loading API */ }

    // ---------------------------------------------------------------- the rest of the API
    L.pointIn = (el, x, y) => { const b = boxIn(el, rt); return b ? { x: b.x + x, y: b.y + y } : null; };
    L.boxOf = el => boxIn(el, rt);
    L.notes = n => notes(rec, Object.assign({ build: o.build || (doc.body && doc.body.getAttribute("data-build")) || "dev", player: who, screen: { w: win.innerWidth, h: win.innerHeight }, touch: !desktop(), lefty: lefty() }, n || {}));
    L.words = id => fill(wordsFor(step(id || (rec && rec.step)), { desktop: desktop(), lefty: lefty() }), who ? who.name : "");
    L.destroy = () => {
      destroyed = true; stopWatch(); for (const t of live.timers) win.clearTimeout(t);
      for (const t of GATED) win.removeEventListener(t, gate, { capture: true });
      win.removeEventListener("keydown", onKey, true); win.removeEventListener("resize", refitSoon); win.removeEventListener("orientationchange", refitSoon);
      if (win.visualViewport) win.visualViewport.removeEventListener("resize", refitSoon);
      win.removeEventListener("pagehide", flush);
      for (const el of live.els.block) el.classList.remove("lsn-dim");
      layer.remove();
    };
    Object.defineProperties(L, {
      record: { get: () => rec ? clone(rec) : null },
      active: { get: () => !!rec && !rec.done },
      step: { get: () => rec && !rec.done ? rec.step : null },
      player: { get: () => who },
      layer: { get: () => layer },
      state: { get: () => {
        const st = s(), lay = live.laid || {}, e = (st && st.ends) || {};
        return { step: rec && !rec.done ? rec.step : null, active: !!rec && !rec.done, count: live.count, need: e.count || 1, beat: !!live.beat, bonk: !!live.bonk, asking: live.asking, paused: live.paused,
          showing: !!live.shown && !layer.hidden, kind: lay.kind || null, talk: !plank.hidden && plank.classList.contains("talk"), z: +layer.style.zIndex || 0, words: plank.hidden ? "" : plain(plank.querySelector(".lsn-words") ? plank.querySelector(".lsn-words").innerHTML : "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"'),
          who: plank.hidden || !plank.querySelector(".lsn-who") ? "" : plank.querySelector(".lsn-who").textContent, face: !plank.hidden && !!plank.querySelector(".lsn-face"),
          veil: !!lay.veil, plank: lay.plank || null, how: lay.how || null, overlaps: !!lay.overlaps, tail: lay.tail || null, targets: lay.targets || [], rings: lay.rings || [], pointer: lay.pointer || null,
          glances: lay.glances || [], holes: lay.holes || [], allow: lay.allow || [], root: { w: rt.clientWidth, h: rt.clientHeight },
          off: rec && st ? rec.off[st.id] || 0 : 0, offTotal: rec ? Object.values(rec.off).reduce((a, b) => a + b, 0) : 0, record: rec ? clone(rec) : null, still: still(), desktop: desktop() };
      } }
    });
    render(true);
    return L;
  }

  const api = { KEY_PREFIX, get FIRST() { return FIRST(); }, RING_OUT, CLEAR, TAIL_H, TAIL_IN, get data() { return D(); }, steps, step, next, index, pageOf, words, record, begin, moveTo, advance, finish, offTap, giveGift, where,
    load, save, start, forgetAll, times, notes, span, fill, wordsFor, pips, place, pointerAt, widest, narrowest, facePixels, face, FACE, faceSize, boxIn, mount, version: 1 };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Lessons = api;
})(typeof window !== "undefined" ? window : globalThis);
