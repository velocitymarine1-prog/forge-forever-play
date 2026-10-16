// FORGE FOREVER: the armour's rule (design pass 47, the Armorer, with its revision 1; jumpr card t109, built as build 38 by card t113).
// The whole fight side of the four sets Ottar sells, in one pure module: a blow's **school** (physical, magic, fire, or water and ice:
// spec/armour.json `sources` by the blow's src, else its `default`; null for a fall and for the table's nulls, a bleed's tick), the
// **guard** (1 less the worn set's guard for that school: 0.85 for a blow in the Castle Plate, 0.5 for fire in the Frost Plate, 1 for
// anything the set does not guard) and the **ward** (a knight status the set turns away: the Frost Plate never burns, the Molten Plate
// never chills, the Wizard's Robes are never marked). proto/combat.js calls it at its two seams (hurt() and afflict()), proto/signatures.js
// at the mark; nothing else in the rules hears of armour, and the look never reaches here (proto/armour-art.js draws the sets).
// Every number is spec/armour.json's (window.FORGE_ARMOUR in a page, the json in node); `on` false, or no spec at all, is no armour.
//
//   Armour.on()                 the spec is loaded and on
//   Armour.sets()               the four sets, in the plank's order; set(id) one of them, or null
//   Armour.schoolOf(o)          the school of a hurt's options { src, fall, tick }: one of the four, or null (armour never touches it)
//   Armour.cut(id, o)           the share of a blow's damage the wearer takes: 1 - guard[school]; 1 for no set, no school or no guard
//   Armour.wards(id, status)    whether the set turns the status away (burning, chill, mark)
//   Armour.ink(id), says(id), short(id), name(id), coins(id)   the set's words and numbers for the pages (the own kit for null)
//   Armour.schoolOfElement(el)  a weapon element's school (read only if arena.guard is ever on)
//   Armour.words                the pages' words (the prompt, the plank's labels, the toasts, WARDED, the tally's lines, the notes' line)
//   Armour.fill(line, o)        a line with its {braces} filled
//   Armour.use(spec)            the checks give another spec
// Plain script, defines window.Armour (module.exports in node). Needs no other file.
(function (root) {
  "use strict";
  let SPEC = null;
  function spec() {
    if (SPEC) return SPEC;
    SPEC = root.FORGE_ARMOUR || null;
    if (!SPEC && typeof require === "function") { try { SPEC = require("../spec/armour.json"); } catch (e) { SPEC = null; } }
    return SPEC;
  }
  function use(s) { SPEC = s || null; }
  const on = () => { const S = spec(); return !!(S && S.on !== false && Array.isArray(S.sets)); };
  const sets = () => (on() ? spec().sets : []);
  function set(id) { if (!on() || typeof id !== "string") return null; for (const s of spec().sets) if (s.id === id) return s; return null; }
  const SCHOOLS = ["physical", "magic", "fire", "water"];
  // the school of a hurt: a fall is nobody's; the table's row (null means never touched); else the default (physical)
  function schoolOf(o) {
    const S = spec(); if (!S) return null;
    if (!o || o.fall) return null;
    const src = o.src;
    if (typeof src === "string" && Object.prototype.hasOwnProperty.call(S.sources || {}, src)) { const sch = S.sources[src]; return sch === null ? null : (SCHOOLS.includes(sch) ? sch : S.default || "physical"); }
    return S.default || "physical";
  }
  function cut(id, o) {
    const s = set(id); if (!s) return 1;
    const sch = schoolOf(o); if (!sch) return 1;
    const g = s.guard && typeof s.guard[sch] === "number" ? s.guard[sch] : 0;
    return Math.max(0, Math.min(1, 1 - g));
  }
  function wards(id, status) { const s = set(id); return !!(s && Array.isArray(s.wards) && s.wards.includes(status)); }
  const kit = () => (spec() && spec().kit) || { name: "Your own kit", says: "What you came in. It guards nothing.", short: "Guards nothing" };
  const name = id => { const s = set(id); return s ? s.name : kit().name; };
  const says = id => { const s = set(id); return s ? s.says : kit().says; };
  const short = id => { const s = set(id); return s ? s.short : kit().short; };
  const coins = id => { const s = set(id); return s ? s.coins | 0 : 0; };
  const ink = id => { const s = set(id); return s && s.ink ? s.ink : "#fee761"; };
  const firstWard = id => { const s = set(id); return s && s.firstWard ? s.firstWard : null; };
  function schoolOfElement(el) { const S = spec(); if (!S || !S.elements) return null; const sch = S.elements[el]; return SCHOOLS.includes(sch) ? sch : null; }
  const words = () => (spec() && spec().words) || {};
  const word = (key, dflt) => { const w = words(); return typeof w[key] === "string" ? w[key] : dflt; };
  const fill = (line, o) => String(line || "").replace(/\{(\w+)\}/g, (m, k) => (o && o[k] !== undefined && o[k] !== null ? String(o[k]) : m));
  // the arena's switches (both off: the sand's kits and the sand's rules)
  const arena = () => Object.assign({ worn: false, guard: false }, (spec() && spec().arena) || {});
  const api = { on, use, spec, sets, set, SCHOOLS, schoolOf, cut, wards, kit, name, says, short, coins, ink, firstWard, schoolOfElement, words, word, fill, arena, version: 1 };
  root.Armour = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
