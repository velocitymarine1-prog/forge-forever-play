// progress.js: the class ladder of FORGE FOREVER (design pass 5 section 3.9), mirrored from tools/rules.py: levels from XP, racks
// earned, what can be equipped, when the Crucible wakes, and (design pass 12) the runs brought home. Pure functions; window.Progress
// in the page, module.exports in node.
(function (root) {
  "use strict";
  const START_CHOICES = ["sword", "bow", "axe", "flail"];
  const MAX_LEVEL = 50;
  function xpForLevel(level) { let s = 0; for (let k = 2; k <= level; k++) s += 100 + 40 * (k - 1); return s; }
  function levelFor(xp) { let level = 1; while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++; return level; }
  function picksEarned(level) { let picks = 1 + 2 * Math.min(9, Math.floor(level / 5)); if (level >= 50) picks += 1; return Math.min(picks, 20); }
  function picksLeft(profile) { return Math.max(0, picksEarned(profile.level) - profile.classes.length); }
  function nextUnlock(level) { if (level >= 50) return null; return (Math.floor(level / 5) + 1) * 5; }
  function crucibleAwake(profile, G) { return profile.level >= G.fuse.level; }
  function classOf(t) { if (!(t.kind === "weapon" && t.weapon)) return null; return t.hybrid ? "legendary" : t.weapon.visual.base; }
  function canEquip(thing, profile, G) {
    const cls = classOf(thing);
    if (!cls) return false;
    if (cls === "legendary") return crucibleAwake(profile, G);
    return profile.classes.includes(cls);
  }
  // `runs` holds the ids of the last runs brought home and `cleared` the areas cleared once (design pass 12 section 3.11.5)
  function newProfile(id, name) {
    return { id, name: name || id, joined: new Date().toISOString().replace(/\.\d+Z$/, "Z"), level: 1, xp: 0, coins: 0, embers: 0, classes: [], picks: 1,
      firsts: { weapons: [], legends: [], ingredients: [] }, kinds: [], found: [], terms: {}, unnamed: [], runs: [], cleared: {} };
  }
  // a run brought home is counted once: false when its id is already in profile.runs, else it is added (the last RUNS_KEPT kept) and
  // true; the caller pays or banks only on true, in the same save
  const RUNS_KEPT = 50;
  function rememberRun(profile, runId) {
    if (!Array.isArray(profile.runs)) profile.runs = [];
    if (!runId || profile.runs.includes(runId)) return false;
    profile.runs.push(runId);
    if (profile.runs.length > RUNS_KEPT) profile.runs.splice(0, profile.runs.length - RUNS_KEPT);
    return true;
  }
  const api = { START_CHOICES, MAX_LEVEL, RUNS_KEPT, xpForLevel, levelFor, picksEarned, picksLeft, nextUnlock, crucibleAwake, canEquip, classOf, newProfile, rememberRun };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Progress = api;
})(typeof window !== "undefined" ? window : globalThis);
