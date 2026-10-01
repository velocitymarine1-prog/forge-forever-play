// crucible.js: the Crucible's gates (design pass 5 section 3.6.2), mirrored from tools/rules.py: the eight checks in order, the
// first failing reason as the forecast line. Needs combiner.js (Forge.fuseCheck, Forge.classOf). window.Crucible / module.exports.
(function (root) {
  "use strict";
  const F = typeof module !== "undefined" && module.exports ? require("./combiner.js") : root.Forge;
  const CRUCIBLE_LINES = {
    level: "The Crucible wakes at level 25",
    weapons: "Put two weapons in the molds",
    locked: cls => "You can only fuse what you can wield: the " + cls[0].toUpperCase() + cls.slice(1) + " rack is chained",
    ember: "You need a Legend Ember: bosses, chests and rare enemies drop them in the Battlegrounds",
    offline: "The Crucible needs the world: connect to fuse"
  };
  function crucibleCheck(left, right, profile, G, online) {
    if (online === undefined) online = true;
    if (profile.level < G.fuse.level) return CRUCIBLE_LINES.level;
    if (!left || !right) return CRUCIBLE_LINES.weapons;
    const reason = F.fuseCheck(left, right, G);
    if (reason) return reason;
    for (const t of [left, right]) { const cls = F.classOf(t); if (!profile.classes.includes(cls)) return CRUCIBLE_LINES.locked(cls); }
    if ((profile.embers || 0) < G.fuse.embers) return CRUCIBLE_LINES.ember;
    if (!online) return CRUCIBLE_LINES.offline;
    return null;
  }
  const api = { CRUCIBLE_LINES, crucibleCheck };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Crucible = api;
})(typeof window !== "undefined" ? window : globalThis);
