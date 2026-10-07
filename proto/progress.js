// progress.js: the class ladder of FORGE FOREVER (design pass 5 section 3.9), mirrored from tools/rules.py: levels from XP, racks
// earned, what can be equipped, when the Crucible wakes, and (design pass 12) the runs brought home. Pure functions; window.Progress
// in the page, module.exports in node.
// Since build 12 (design pass 19, revision 1) XP's numbers come from spec/xp.json (window.FORGE_XP in the page, the file in node): your
// level's curve (100 XP to reach Lv 2, each later level the one before plus 5 % through Lv 25, plus 2.5 % from Lv 26), what a forge
// pays by the rarity of what it makes, what a cleared Battleground level pays (and its replay), and the back pay of a save made under
// the old rules. All of it in whole numbers (tenths of a percent, halves up), so tools/rules.py gives the same tables.
// Since build 17 (design pass 24 section 4.8) a class bought from Vorn with coins (profile.bought) does not use up a rack earned.
(function (root) {
  "use strict";
  const START_CHOICES = ["sword", "bow", "axe", "flail"];
  const MAX_LEVEL = 50;
  // an old cached page (GitHub Pages keeps a page for ten minutes) has no <script src="spec/xp.js">, and without the numbers nothing
  // here can count: this file then asks for them itself, beside its own folder (proto/progress.js, so ../spec/xp.js in the source and
  // spec/xp.js in the deploy), while the page is still being read, so they are there before the next script runs
  try {
    const doc = typeof document !== "undefined" ? document : null, me = doc && doc.currentScript;
    if (doc && !root.FORGE_XP && me && me.src && doc.readyState === "loading") doc.write('<script src="' + new URL("../spec/xp.js", me.src).href.replace(/"/g, "%22") + '"><\/script>');
  } catch (e) { /* the page's own tag, or none */ }
  // the numbers, looked up when first needed (so the page's script order does not matter)
  let XP = null;
  function xpSpec() {
    if (!XP) XP = root.FORGE_XP || (typeof module !== "undefined" && module.exports && typeof require === "function" ? require("../spec/xp.json") : null);
    if (!XP) throw new Error("progress.js: spec/xp.js is not loaded");
    return XP;
  }
  // one step of a curve: `prev` plus `pct` percent, to a whole number, halves up (in tenths of a percent, so no fractions)
  const grow = (prev, pct) => Math.floor((prev * (1000 + Math.round(10 * pct)) + 500) / 1000);
  // your level: xpToNext(L) is the XP from Lv L to Lv L + 1; each step grows from the rounded step before it, by `growth` percent while
  // the level reached is below `from` and by `growthFrom` from there on (Lv 26 is the first level at 2.5 %). The curve is defined past
  // the cap. steps[L] and totals[L] (the XP in all to reach Lv L) are built once and grown on demand
  const steps = [0], totals = [0, 0];
  function xpToNext(level) {
    const C = xpSpec().level, L = Math.max(1, level | 0);
    while (steps.length <= L) { const k = steps.length; steps.push(k === 1 ? C.first : grow(steps[k - 1], k + 1 >= C.from ? C.growthFrom : C.growth)); totals.push(totals[k] + steps[k]); }
    return steps[L];
  }
  function xpForLevel(level) { const L = Math.max(1, level | 0); if (L > 1) xpToNext(L - 1); return totals[L]; }
  // a forge's XP: by the tier of what it made, when it used up an ingredient or a Legend Ember (`usesUp`) or made something the player
  // never had (`isNew`); two weapons into a thing already had pay nothing (the guard, section 3.2.2)
  function forgeXp(o) { if (!o || !(o.usesUp || o.isNew)) return 0; return xpSpec().forge.byTier[String(o.tier | 0)] || 0; }
  // a cleared Battleground level n: `first` for level 1, then `growth` percent more a level; a replay pays `replay` percent of that
  const clears = [0];
  function clearXp(n) { const C = xpSpec().clear, k = Math.max(1, n | 0); while (clears.length <= k) clears.push(clears.length === 1 ? C.first : grow(clears[clears.length - 1], C.growth)); return clears[k]; }
  function replayXp(n) { return Math.floor((clearXp(n) * Math.round(10 * xpSpec().clear.replay) + 500) / 1000); }
  // the back pay (section 3.5): a save made under the old rules (no xpRules, or an older number) gets, once, for each area it cleared
  // the difference between the level's first-clear XP and what the old rules paid (spec/xp.json `before`); the profile takes the XP,
  // its level follows and it is marked xpRules: 2. Returns { xp, areas } (what was paid, and for which areas); { xp: 0, areas: [] }
  // for a save already marked
  const XP_RULES = 2;
  function backPay(profile) {
    const out = { xp: 0, areas: [] };
    if (!profile || profile.xpRules >= XP_RULES) return out;
    const before = xpSpec().before || {};
    for (const area of Object.keys(profile.cleared || {})) {
      const b = before[area];
      if (!profile.cleared[area] || !b) continue;
      const due = clearXp(b.level) - b.xp;
      if (due > 0) { out.xp += due; out.areas.push(area); }
    }
    profile.xp = (profile.xp | 0) + out.xp;
    profile.level = levelFor(profile.xp);
    profile.xpRules = XP_RULES;
    return out;
  }
  function levelFor(xp) { let level = 1; while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++; return level; }
  function picksEarned(level) { let picks = 1 + 2 * Math.min(9, Math.floor(level / 5)); if (level >= 50) picks += 1; return Math.min(picks, 20); }
  // free picks left (design pass 24 section 4.8, build 17): what the level has earned, less the classes held that were not paid for.
  // `profile.bought` lists the classes bought from Vorn with coins, so a class paid for never uses up a free pick; a save from before
  // build 17 has no `bought`, which counts as none bought. Never more than the classes still to open (the grammar's twenty, less
  // those held): a pick with no class left to take is not left, so a smith who paid for some has none waiting once every rack is up
  const CLASS_COUNT = 20;
  function picksLeft(profile) {
    const held = profile.classes, bought = Array.isArray(profile.bought) ? profile.bought : [];
    return Math.max(0, Math.min(picksEarned(profile.level) - held.filter(c => !bought.includes(c)).length, CLASS_COUNT - held.length));
  }
  function nextUnlock(level) { if (level >= 50) return null; return (Math.floor(level / 5) + 1) * 5; }
  function crucibleAwake(profile, G) { return profile.level >= G.fuse.level; }
  function classOf(t) { if (!(t.kind === "weapon" && t.weapon)) return null; return t.hybrid ? "legendary" : t.weapon.visual.base; }
  function canEquip(thing, profile, G) {
    const cls = classOf(thing);
    if (!cls) return false;
    if (cls === "legendary") return crucibleAwake(profile, G);
    return profile.classes.includes(cls);
  }
  // `runs` holds the ids of the last runs brought home and `cleared` the areas cleared once (design pass 12 section 3.11.5); `xpRules`
  // says which XP rules the save was paid under (2 since design pass 19: no back pay due); `bought` lists the classes paid for with
  // coins at Vorn's (design pass 24 section 4.8, build 17). The well's `daily` (section 4.9) is not here: a save has none until its
  // first claim
  function newProfile(id, name) {
    return { id, name: name || id, joined: new Date().toISOString().replace(/\.\d+Z$/, "Z"), level: 1, xp: 0, coins: 0, embers: 0, classes: [], picks: 1,
      firsts: { weapons: [], legends: [], ingredients: [] }, kinds: [], found: [], terms: {}, unnamed: [], runs: [], cleared: {}, xpRules: XP_RULES, bought: [] };
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
  const api = { START_CHOICES, MAX_LEVEL, CLASS_COUNT, RUNS_KEPT, XP_RULES, xpToNext, xpForLevel, levelFor, forgeXp, clearXp, replayXp, backPay, picksEarned, picksLeft, nextUnlock, crucibleAwake, canEquip, classOf, newProfile, rememberRun };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Progress = api;
})(typeof window !== "undefined" ? window : globalThis);
