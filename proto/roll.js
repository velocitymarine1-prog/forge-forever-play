// FORGE FOREVER: roll.js (design pass 29 with its revision 1, build 24). The Roll of First Forges on the phone: a world-first forge is
// settled by the forge's server (the Worker's POST /api/v1/firsts, first come first served, one row per thing for ever), and the
// board it ranks is read from GET /api/v1/roll. This file is the phone's side of both, and the pure parts both sides share: the ISO
// week a claim is counted under and the canonical fingerprint a weapon is keyed by (cloud/src/rolls.js imports this file at bundle
// time, as names.js imports smith.js, so the two never drift). It talks to the server only through proto/cloud.js (Cloud.call), so
// everywhere the cloud is off (a page from disk, ?stay=1, the harnesses, NO_CLOUD=1) Roll.on() is false and the page's world of one
// forges exactly as before; the plank then shows that world's own Roll (Roll.local, from Discovery.roll).
//
//   Roll.on()                        the online copy only (Cloud.on)
//   Roll.boards(), Roll.boardOf(id)  the boards of spec/boards.json (window.FORGE_BOARDS), in order; one by its id
//   Roll.wire(entry, thing, F)       the claim for one queued entry: { recipe, kind, fp (weapons and legends: F.fingerprintText),
//                                    thing: { id, name, tier }, forged }
//   Roll.claim(claims, ms)           POST /firsts → { ok: true, results, you } | { ok: false, why: "offline" | "signed-out" | "busy" | "bad" | "local" }
//   Roll.read(boardId, period, ms)   GET /roll → { ok: true, data } (and keeps it on the phone), or { ok: false, why, kept: { data, at } | null }
//   Roll.kept(boardId, period)       the copy last kept on this phone, or null
//   Roll.local(things, players, me)  the world of one's board in the server's shape (rank, name, value: weapons, since: latest_at, me)
//   Roll.view(data, board, o)        what the plank shows: { line, bar: { glyph, mine, what, fresh, waiting }, rows: [{ rank, medal, name,
//                                    sub, value, me }], pin, dim, empty } (pure; o = { mine, waiting, reading, why, keptAt, local, name, now })
//   Roll.since(iso, now)             "today", "yesterday", "3 days ago", "6 Oct"
//   Roll.weekOf(iso)                 the ISO week, "2026-W41" (the server's rule too)
//   Roll.canonical(fpText)           a fingerprint's JSON with its keys sorted and its arrays sorted: what the server hashes
//   Roll.ordinal(n)                  "7th"
// Plain script: window.Roll in the page, module.exports in node and in the Worker's bundle. Pure but for claim, read and kept.
(function (root) {
  "use strict";
  const node = typeof module !== "undefined" && module.exports && typeof require === "function";
  const KEEP = "forge-forever:roll:";
  const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const nowIso = t => new Date(t === undefined ? Date.now() : t).toISOString().replace(/\.\d+Z$/, "Z");
  function spec() { if (root.FORGE_BOARDS) return root.FORGE_BOARDS; if (node) { try { return require("../spec/boards.json"); } catch (e) { /* none */ } } return { boards: [], limit: 50 }; }
  function on() { return !!(root.Cloud && root.Cloud.on); }
  function boards() { return (spec().boards || []).slice(); }
  function boardOf(id) { return boards().find(b => b.id === id) || null; }
  const limit = () => spec().limit || 50;

  // ------------------------------------------------------------------ the rules both sides share
  // the ISO 8601 week of a time, in UTC: weeks start on Monday, week 1 holds the year's first Thursday
  function weekOf(iso) {
    const d = new Date(iso); if (isNaN(d)) return null;
    const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);   // the Thursday of this week names the year
    const y = t.getUTCFullYear(), w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
    return y + "-W" + String(w).padStart(2, "0");
  }
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  function sortDeep(v) {
    if (Array.isArray(v)) return v.map(sortDeep).sort((a, b) => cmp(JSON.stringify(a), JSON.stringify(b)));
    if (v && typeof v === "object") { const o = {}; for (const k of Object.keys(v).sort()) o[k] = sortDeep(v[k]); return o; }
    return v;
  }
  // canonical(text): the fingerprint as the server keys it, or null when the text is not a JSON object
  function canonical(text) {
    let o; try { o = JSON.parse(text); } catch (e) { return null; }
    if (!o || typeof o !== "object" || Array.isArray(o)) return null;
    return JSON.stringify(sortDeep(o));
  }
  function ordinal(n) { n = n | 0; const v = n % 100; return n + (v >= 11 && v <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] || "th")); }

  // ------------------------------------------------------------------ the wire
  function wire(entry, thing, F) {
    if (!entry || !thing || !F || typeof entry.recipe !== "string") return null;
    const weapon = F.isWeapon(thing), legend = weapon && F.classOf(thing) === "legendary";
    const c = { recipe: entry.recipe, kind: legend ? "legend" : weapon ? "weapon" : "ingredient", thing: { id: thing.id, name: String(thing.name || thing.id), tier: thing.tier | 0 }, forged: typeof entry.forged === "string" ? entry.forged : null };
    if (weapon) c.fp = F.fingerprintText(thing);
    return c;
  }
  function why(r) { if (r.status === 429) return "busy"; if (r.status === 401) return "signed-out"; if (r.status >= 400 && r.status < 500) return "bad"; return "offline"; }
  async function claim(claims, ms) {
    if (!on()) return { ok: false, why: "local" };
    const C = root.Cloud;
    if (typeof C.call !== "function") return { ok: false, why: "bad" };
    const st = C.status;
    if (st === "offline" || st === "none") return { ok: false, why: "offline" };
    if (st === "signed-out" || st === "local") return { ok: false, why: "signed-out" };
    if (!Array.isArray(claims) || !claims.length) return { ok: true, results: [], you: null };
    const r = await C.call("POST", "/firsts", { claims }, ms || 8000);
    if (r.ok && r.json && Array.isArray(r.json.results)) return { ok: true, results: r.json.results, you: r.json.you || null };
    return { ok: false, why: why(r) };
  }
  function keptOf(boardId, period) {
    try { const v = JSON.parse(root.localStorage.getItem(KEEP + boardId + ":" + (period || "all")) || "null"); return v && v.data && Array.isArray(v.data.rows) ? v : null; } catch (e) { return null; }
  }
  function keep(boardId, period, data) { try { root.localStorage.setItem(KEEP + boardId + ":" + (period || "all"), JSON.stringify({ data, at: nowIso() })); } catch (e) { /* not kept: the next read asks again */ } }
  async function read(boardId, period, ms) {
    period = period || "all";
    const kept = keptOf(boardId, period);
    if (!on()) return { ok: false, why: "local", kept };
    const C = root.Cloud;
    if (typeof C.call !== "function") return { ok: false, why: "bad", kept };
    if (C.status === "signed-out" || C.status === "local") return { ok: false, why: "signed-out", kept };
    const r = await C.call("GET", "/roll?board=" + encodeURIComponent(boardId) + "&period=" + encodeURIComponent(period), null, ms || 6000);
    if (r.ok && r.json && Array.isArray(r.json.rows)) { keep(boardId, period, r.json); return { ok: true, data: r.json }; }
    return { ok: false, why: why(r), kept };
  }

  // ------------------------------------------------------------------ the world of one's own Roll (the cloud off)
  function local(things, players, me, now) {
    const D = root.Discovery || (node ? require("./discovery.js") : null);
    const rows = D ? D.roll(Array.from(things), [], players || [], undefined, now) : [];
    const out = rows.map(r => ({ rank: r.rank, name: r.name, value: r.weapons, since: r.latest_at || null, me: r.player === me }));
    const mine = out.find(r => r.me) || null;
    return { board: "first-forges", period: "all", at: nowIso(now), total: out.length, rows: out.slice(0, limit()), you: mine ? { rank: mine.rank, value: mine.value, since: mine.since } : { rank: null, value: 0 }, local: true };
  }

  // ------------------------------------------------------------------ the words
  const dayOf = t => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
  function since(iso, now) {
    const t = Date.parse(iso || ""); if (isNaN(t)) return "";
    const days = Math.round((dayOf(now === undefined ? Date.now() : now) - dayOf(t)) / 86400000);
    if (days <= 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 7) return days + " days ago";
    const d = new Date(t); return d.getDate() + " " + MONTH[d.getMonth()];
  }
  const two = n => String(n).padStart(2, "0");
  function clock(iso) { const d = new Date(iso || NaN); return isNaN(d) ? "" : two(d.getHours()) + ":" + two(d.getMinutes()); }
  function when(iso) { const d = new Date(iso || NaN); return isNaN(d) ? "" : d.getDate() + " " + MONTH[d.getMonth()] + ", " + clock(iso); }
  function fill(line, m) { return String(line || "").replace(/\{(\w+)\}/g, (s, k) => (m[k] !== undefined ? String(m[k]) : s)); }
  function view(data, board, o) {
    o = o || {}; board = board || {}; const L = board.lines || {}, now = o.now === undefined ? Date.now() : o.now;
    const label = board.glyph === "⚔" ? "last win " : "last first ";
    const rows = ((data && data.rows) || []).map(r => ({ rank: r.rank, medal: r.rank >= 1 && r.rank <= 3 ? r.rank : 0, name: r.name, sub: r.since ? label + since(r.since, now) : "", value: r.value, me: !!r.me }));
    const you = data && data.you ? data.you : null, onList = rows.some(r => r.me);
    const pin = you && you.rank && !onList ? { rank: you.rank, medal: 0, name: o.name || "You", sub: you.since ? label + since(you.since, now) : "", value: you.value, me: true } : null;
    let line, fresh;
    if (o.local) { line = L.local; fresh = "this phone's world"; }
    else if (o.reading) { line = L.reading; fresh = "reading…"; }
    else if (o.why === "signed-out") { line = L.signedOut; fresh = "signed out" + (o.keptAt ? " · as of " + when(o.keptAt) : ""); }
    else if (o.why) { line = rows.length || (data && data.at) ? fill(L.offline, { when: when(o.keptAt || data.at) }) : L.never; fresh = "offline" + (o.keptAt ? " · as of " + when(o.keptAt) : ""); }
    else if (!rows.length) { line = L.empty; fresh = "as of " + clock(data && data.at ? data.at : now); }
    else { line = you && you.rank === 1 ? L.top : you && you.rank ? fill(L.on, { rank: ordinal(you.rank), total: data.total | 0 }) : L.off; fresh = "as of " + clock(data.at || now); }
    return { line: line || "", bar: { glyph: board.glyph || "★", mine: o.mine | 0, what: board.what || "", fresh, waiting: o.waiting | 0 }, rows, pin, dim: !!(o.reading || (o.why && o.why !== "local")) && rows.length > 0, empty: !rows.length };
  }

  const api = { on, boards, boardOf, wire, claim, read, kept: keptOf, local, view, since, when, clock, weekOf, canonical, ordinal, KEEP, version: 1 };
  if (node) module.exports = api; else root.Roll = api;
})(typeof window !== "undefined" ? window : globalThis);
