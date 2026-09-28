// naming.js: the rules of a player's name for a world-first legend (design pass 6, section 3.1.3, checks 1 to 4), ported line
// for line from tools/forge.py (normalise_name, filter_hit, taken_names, check_name) so the naming plank can refuse instantly
// and the service gives the same answer. Runs in the page (window.Naming) and in node (module.exports, tools/test-rules.js).
(function (root) {
  "use strict";
  const NAME_LINES = {
    short: "That's too short: 2 to 28 characters",
    long: n => "Too long by " + n,
    chars: "Letters, numbers, spaces, hyphens and apostrophes only",
    letters: "A name needs at least two letters",
    run: "No more than three of one character in a row",
    filter: "That name isn't allowed here",
    kind: "That's the kind's name: give this one its own",
    class: "That's a class word: give this one its own",
    word: "That's a grammar word: give this one its own",
    taken: name => "The world already has a " + name,
    keep: "That's the Oracle's name: Keep it, or type your own",
    ok: ""
  };

  function normaliseName(name, F) {
    let s = String(name).toLowerCase();
    s = Array.from(s).map(ch => (ch in F.leet ? F.leet[ch] : ch)).join("");
    const spaced = s.replace(/[\s'-]+/g, " ").trim();
    let compact = s.replace(/[\s'-]+/g, "");
    compact = compact.replace(/(.)\1{2,}/g, "$1$1");
    return [compact, spaced];
  }
  function filterHit(name, F) {
    const [compact, spaced] = normaliseName(name, F);
    for (const w of F.severe) if (compact.includes(normaliseName(w, F)[0])) return w;
    const words = spaced.split(" ");
    for (const w of F.words) {
      const ws = normaliseName(w, F)[1].split(" "), n = ws.length;
      for (let i = 0; i <= words.length - n; i++) if (words.slice(i, i + n).join(" ") === ws.join(" ")) return w;
    }
    return null;
  }
  // every name a legend may not take: Things, Oracle names, kinds, classes, forms, elements. `things` is an iterable of Things.
  function takenNames(things, G, kinds) {
    const out = new Map();
    for (const f of [...Object.keys(G.forms), ...Object.keys(G.elements)]) out.set(f, ["word", f]);
    for (const t of things) {
      out.set(t.name.toLowerCase().replace(/\s+/g, " ").trim(), ["thing", t.name]);
      const on = (t.naming || {}).oracle_name;
      if (on) out.set(on.toLowerCase().replace(/\s+/g, " ").trim(), ["thing", on]);
    }
    for (const k of (kinds || [])) out.set(k.name.toLowerCase(), ["kind", k.name]);
    for (const c of [...G.visual.bases, "legendary", "legend"]) out.set(c, ["class", c]);
    return out;
  }
  function checkName(name, thing, taken, G, F) {
    const raw = String(name || "").replace(/\s+/g, " ").trim();
    const rules = G.name_rules;
    if (raw.length < 2) return { ok: false, code: "short", reason: NAME_LINES.short, name: raw };
    if (raw.length > rules.max_length) return { ok: false, code: "long", reason: NAME_LINES.long(raw.length - rules.max_length), name: raw };
    if (!new RegExp(rules.allowed).test(raw)) return { ok: false, code: "chars", reason: NAME_LINES.chars, name: raw };
    if ((raw.match(/[A-Za-z]/g) || []).length < 2) return { ok: false, code: "letters", reason: NAME_LINES.letters, name: raw };
    if (/(.)\1{3,}/.test(raw.toLowerCase())) return { ok: false, code: "run", reason: NAME_LINES.run, name: raw };
    const oracleName = ((thing || {}).naming || {}).oracle_name || (thing || {}).name || "";
    if (raw.toLowerCase() === oracleName.toLowerCase()) return { ok: false, code: "keep", reason: NAME_LINES.keep, name: raw };
    if (filterHit(raw, F)) return { ok: false, code: "filter", reason: NAME_LINES.filter, name: raw };
    const hit = taken.get(raw.toLowerCase());
    if (hit && !(thing && hit[0] === "thing" && hit[1].toLowerCase() === (thing.name || "").toLowerCase())) {
      const code = ["kind", "class", "word"].includes(hit[0]) ? hit[0] : "taken";
      return { ok: false, code, reason: code === "taken" ? NAME_LINES.taken(hit[1]) : NAME_LINES[code], name: raw };
    }
    return { ok: true, code: "ok", reason: "", name: raw };
  }

  const api = { NAME_LINES, normaliseName, filterHit, takenNames, checkName };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Naming = api;
})(typeof window !== "undefined" ? window : globalThis);
