// discovery.js: First Forge and the Roll for the page's world of one (design pass 5 sections 3.7 and 3.8), mirroring the engine's
// settle and the service's leaderboard: a row's claim status for a smith, the twin check, the Roll's ranking. Needs combiner.js.
// window.Discovery in the page, module.exports in node.
(function (root) {
  "use strict";
  const F = typeof module !== "undefined" && module.exports ? require("./combiner.js") : root.Forge;
  const WEEK_MS = 7 * 24 * 3600 * 1000;
  // what a forge of a known row means to this smith: first (an unclaimed seed row taken now), known, rediscovered (a link row) or pending
  function status(row, thing, player) {
    if (!row) return null;
    if (row.linked_to) return "rediscovered";
    const d = (thing && thing.discovery) || {};
    if (!d.first) return "first";
    if (thing.oracle && thing.oracle.provisional && d.first === player) return "pending";
    return "known";
  }
  // a weapon with the same fingerprint text (everything but the numbers), or null
  function twinOf(thing, things) {
    const fp = F.fingerprintText(thing);
    if (!fp) return null;
    for (const t of things) if (t !== thing && t.id !== thing.id && F.isWeapon(t) && F.fingerprintText(t) === fp) return t;
    return null;
  }
  // the Roll of First Smiths: rows ranked by weapons first-forged (settled ones), legends and kinds shown, ties to the earlier smith
  function roll(things, kinds, players, window, now) {
    now = now || Date.now();
    const by = new Map();
    for (const t of things) {
      const d = t.discovery || {};
      if (!d.first || !F.isWeapon(t) || (t.oracle && t.oracle.provisional)) continue;
      if (window === "week") { const at = Date.parse(d.at || ""); if (Number.isNaN(at) || now - at > WEEK_MS) continue; }
      if (!by.has(d.first)) by.set(d.first, { player: d.first, name: d.first, weapons: 0, legends: 0, kinds: 0, latest: null, latest_at: "" });
      const r = by.get(d.first);
      r.weapons += 1;
      if (F.classOf(t) === "legendary") r.legends += 1;
      if ((d.at || "") >= r.latest_at) { r.latest_at = d.at; r.latest = { id: t.id, name: t.name }; }
    }
    for (const k of (kinds || [])) if (by.has(k.first)) by.get(k.first).kinds += 1;
    for (const p of (players || [])) if (by.has(p.id)) by.get(p.id).name = p.name || p.id;
    const rows = Array.from(by.values()).sort((a, b) => b.weapons - a.weapons || (a.latest_at < b.latest_at ? -1 : a.latest_at > b.latest_at ? 1 : 0));
    rows.forEach((r, i) => { r.rank = i + 1; });
    return rows;
  }
  const api = { status, twinOf, roll };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Discovery = api;
})(typeof window !== "undefined" ? window : globalThis);
