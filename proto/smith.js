// FORGE FOREVER: smith.js (design pass 16 section 3.2, with its revision 1; built by build 8). Who is at the forge: the player record.
// A phone that has never had a player has none, and the main menu asks for a name ("Who's at the forge?"); that is the whole account.
// The record is { v: 1, id, name, joined } at localStorage forge-forever:smith. A new id is 8 characters of Crockford base32 in lower
// case, such as 7q2km9xd (pass 13's smith id, its section 4.2, so pass 13 can later send this player online as they are; the key keeps
// pass 13's word smith), shown as the code 7Q2K-M9XD; the bench's dev smith keeps its old id, isaac. Names are not unique: with no
// server there is nothing to check them against. checkSmithName holds section 3.2's rules and the game's word filter (Naming's own
// normalise and filter, the list legend names go through). Storage is a convenience: every read and write is in a try/catch, and when
// the browser blocks it (or the page was opened with ?nostore=1, the checks) the record lasts for the visit: in the page's memory and
// in window.name, which the tab keeps from one page of the game to the next, so the menu, the Forge and the cellar still agree. The
// next visit asks again. Plain script: window.Smith in the page, module.exports in node (tools/test-rules.js). Needs naming.js for
// the filter (window.Naming, or require in node) and the filter itself (window.FORGE_NAME_FILTER, or the caller's).
//
//   Smith.read()                      the record, or null (none, or one that is not a record)
//   Smith.make(name, { id, now })     writes a new record (the name cleaned, not checked: check it first); returns it
//   Smith.rename(name)                the record with its new name (cleaned), or null when there is none
//   Smith.clear()                     the record goes (Erase my smithy)
//   Smith.newId(rand), isId(s), code(id)   a new id, whether a string is one, the code shown for it (XXXX-XXXX)
//   Smith.cleanName(s)                curly apostrophes made straight, runs of spaces one, the ends trimmed: the name as it is kept
//   Smith.checkSmithName(name, filter)    "" when the name is good, else the line that says why (Smith.LINES)
//   Smith.store                       { get, set, del, keys(prefix), blocked } with the fallback above; lessons.js keeps its record in it
//   Smith.use(storage)                (node, the checks) a localStorage-like object to use, or null to act as if storage were blocked
(function (root) {
  "use strict";
  const KEY = "forge-forever:smith";
  // the lines under the name field, in the order they are checked (section 3.2)
  const LINES = {
    length: "3 to 16 characters",
    chars: "Letters, numbers, spaces, hyphens and apostrophes only",
    letters: "A name needs at least two letters",
    run: "No more than three of one character in a row",
    filter: "That name isn't allowed here",
    ok: ""
  };
  const MIN = 3, MAX = 16;

  // ------------------------------------------------------------------ storage, and the visit's own copy when the browser blocks it
  const VISIT = "forge-forever:visit:";   // window.name's marker: the visit's keys as JSON after it
  let backend = null, blocked = false;
  const visit = new Map();
  function probe() {
    if (typeof process !== "undefined" && process.versions && process.versions.node) return null;   // (node: memory, until the checks give it a storage)
    let q = false; try { q = new URLSearchParams(root.location.search).get("nostore") === "1"; } catch (e) { q = false; }
    if (q) return null;
    try { const s = root.localStorage; const t = "forge-forever:probe"; s.setItem(t, "1"); s.removeItem(t); return s; } catch (e) { return null; }
  }
  function readVisit() {
    visit.clear();
    let n = ""; try { n = String(root.name || ""); } catch (e) { n = ""; }
    if (n.indexOf(VISIT) !== 0) return;
    try { const o = JSON.parse(n.slice(VISIT.length)); for (const k of Object.keys(o || {})) if (typeof o[k] === "string") visit.set(k, o[k]); } catch (e) { /* not ours, or broken: an empty visit */ }
  }
  function writeVisit() {
    try { if (!("name" in root)) return; root.name = visit.size ? VISIT + JSON.stringify(Object.fromEntries(visit)) : (String(root.name || "").indexOf(VISIT) === 0 ? "" : root.name); } catch (e) { /* the page's memory still has it */ }
  }
  // use(storage): the backend from now on (null: blocked). On a page, the first call is made here with what the browser allows
  function use(s) {
    backend = s || null; blocked = !backend;
    if (blocked) readVisit();
    else { visit.clear(); try { if (String(root.name || "").indexOf(VISIT) === 0) root.name = ""; } catch (e) { /* kept */ } }   // a stale visit from a blocked page is not this one's
  }
  const store = {
    get(k) { if (!blocked) { try { const v = backend.getItem(k); if (v !== null && v !== undefined) return v; } catch (e) { /* fall through */ } } return visit.has(k) ? visit.get(k) : null; },
    set(k, v) { v = String(v); if (!blocked) { try { backend.setItem(k, v); visit.delete(k); return true; } catch (e) { /* full, or blocked since */ } } visit.set(k, v); writeVisit(); return false; },
    del(k) { let ok = false; if (!blocked) { try { backend.removeItem(k); ok = true; } catch (e) { ok = false; } } if (visit.delete(k)) writeVisit(); return ok; },
    keys(prefix) {
      const out = new Set();
      if (!blocked) { try { for (let i = 0; i < backend.length; i++) { const k = backend.key(i); if (k && k.indexOf(prefix || "") === 0) out.add(k); } } catch (e) { /* none readable */ } }
      for (const k of visit.keys()) if (k.indexOf(prefix || "") === 0) out.add(k);
      return Array.from(out);
    },
    get blocked() { return blocked; }
  };
  use(probe());

  // ------------------------------------------------------------------ ids (Crockford base32: no i, l, o or u, so a code read aloud is not misread)
  const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
  function randomInts(n) {
    try { const c = root.crypto; if (c && c.getRandomValues) return Array.from(c.getRandomValues(new Uint32Array(n))); } catch (e) { /* no crypto */ }
    return Array.from({ length: n }, () => Math.floor(Math.random() * 4294967296));
  }
  // newId(rand): 8 characters; rand (the checks) returns a whole number or a fraction in [0, 1) each time it is called
  function newId(rand) {
    const ints = rand ? Array.from({ length: 8 }, () => { const r = rand(); return r < 1 ? Math.floor(r * 32) : r; }) : randomInts(8);
    return ints.map(r => ALPHABET[(r >>> 0) % 32]).join("");
  }
  const isId = s => typeof s === "string" && /^[0-9abcdefghjkmnpqrstvwxyz]{8}$/.test(s);
  const okId = s => typeof s === "string" && /^[a-z0-9][a-z0-9-]{0,31}$/.test(s);   // what a record may carry: a new id, or the dev smith's isaac
  const code = id => isId(id) ? (id.slice(0, 4) + "-" + id.slice(4)).toUpperCase() : String(id || "").toUpperCase();

  // ------------------------------------------------------------------ the name
  // a phone types a curly apostrophe (iOS's smart punctuation) where the rules want a straight one: the name is kept straight
  const cleanName = s => String(s === undefined || s === null ? "" : s).normalize("NFC").replace(/[‘’ʼ`´]/g, "'").replace(/\s+/g, " ").trim();
  // letters are the Latin alphabet with its accents (Zoë, José, Łukasz), so a name the filter cannot read in another script is refused
  const LETTER = "A-Za-zÀ-ÖØ-öø-ɏ";
  const CHARS = new RegExp("^[" + LETTER + "0-9' -]+$"), LETTERS = new RegExp("[" + LETTER + "]", "g");
  // the filter reads plain letters: accents come off, and the letters with no plain form are spelled out (Ø o, ß ss, Æ ae)
  const FOLD = { "ß": "ss", "æ": "ae", "Æ": "AE", "ø": "o", "Ø": "O", "œ": "oe", "Œ": "OE", "đ": "d", "Đ": "D", "ł": "l", "Ł": "L", "þ": "th", "Þ": "Th", "ð": "d", "Ð": "D", "ı": "i", "ħ": "h", "Ħ": "H", "ŋ": "n", "Ŋ": "N" };
  const fold = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[ßæÆøØœŒđĐłŁþÞðÐıħĦŋŊ]/g, ch => FOLD[ch] || ch);
  function naming() { if (root.Naming) return root.Naming; try { return typeof require === "function" ? require("./naming.js") : null; } catch (e) { return null; } }
  // checkSmithName(name, filter): "" when good, else why not. Without a filter (an old cached spec) the word filter is not run
  function checkSmithName(name, filter) {
    const s = cleanName(name);
    const n = Array.from(s).length;
    if (n < MIN || n > MAX) return LINES.length;
    if (!CHARS.test(s)) return LINES.chars;
    if ((s.match(LETTERS) || []).length < 2) return LINES.letters;
    if (/(.)\1{3,}/u.test(s.toLowerCase())) return LINES.run;
    const F = filter || root.FORGE_NAME_FILTER || null, N = naming();
    if (F && N && N.filterHit(fold(s), F)) return LINES.filter;
    return LINES.ok;
  }

  // ------------------------------------------------------------------ the record
  const nowIso = d => (d ? new Date(d) : new Date()).toISOString().replace(/\.\d+Z$/, "Z");
  function read() {
    let r = null; try { r = JSON.parse(store.get(KEY) || "null"); } catch (e) { r = null; }
    if (!r || typeof r !== "object" || r.v !== 1 || !okId(r.id) || typeof r.name !== "string" || !cleanName(r.name)) return null;
    return { v: 1, id: r.id, name: cleanName(r.name), joined: typeof r.joined === "string" ? r.joined : null };
  }
  // (build 9) on the Cloudflare copy a new name, or a rename, goes online too (proto/cloud.js)
  function write(r) { const kept = store.set(KEY, JSON.stringify(r)); api.kept = kept; try { if (root.Cloud) root.Cloud.touch(); } catch (e) { /* kept here */ } return r; }
  function make(name, o) {
    o = o || {};
    return write({ v: 1, id: okId(o.id) ? o.id : newId(o.rand), name: cleanName(name), joined: nowIso(o.now) });
  }
  function rename(name) { const r = read(); if (!r) return null; r.name = cleanName(name); return write(r); }
  function clear() { store.del(KEY); }

  const api = { KEY, LINES, MIN, MAX, ALPHABET, store, use, newId, isId, code, cleanName, fold, checkSmithName, read, make, rename, clear, kept: true, version: 1 };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Smith = api;
})(typeof window !== "undefined" ? window : globalThis);
