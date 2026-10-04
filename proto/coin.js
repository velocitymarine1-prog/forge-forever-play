// coin.js: coin, XP and Legend Embers from a run, and the Trader's Cart (design pass 5 section 3.10), mirrored from tools/rules.py.
// Pure functions; the caller moves the coins and the stock. window.Coin in the page, module.exports in node.
(function (root) {
  "use strict";
  // Legend Embers (design pass 10, revision 1) come only from what the run found (spec/drops.json): `ember` is how many are sure (a
  // boss's first clear, a quest's reward), `ember_chances` one chance per other source (a boss again, then each gold chest, iron chest
  // and rare enemy), which the caller rolls with its own random numbers. `finds` is { gold_chests, iron_chests, rare_enemies,
  // quest_embers }, each a count, missing means 0; `drops` is the drop table (window.FORGE_DROPS unless given; none pays no Embers)
  const EMBER_NOT_SOLD = "Legend Embers aren't sold: bosses, chests and rare enemies drop them";
  // XP since build 12 (design pass 19, revision 1): a cleared level's XP is Progress.clearXp(level) (250 for level 1, 10 % more a
  // level), a replay's Progress.replayXp(level) (15 % of it), and a boss level pays its level's XP, not doubled. Coins are as they
  // were: 20 + 8 n, three times that for a boss, half on a replay. Progress is looked up when called, so the pages' script order
  // does not matter
  const progress = () => root.Progress || (typeof module !== "undefined" && module.exports && typeof require === "function" ? require("./progress.js") : null);
  function runPay(level, boss, replay, finds, drops) {
    const P = progress();
    const xp = replay ? P.replayXp(level) : P.clearXp(level);
    let coins = 20 + 8 * level;
    if (boss) coins *= 3;
    if (replay) coins = Math.floor(coins / 2);
    const E = ((drops || root.FORGE_DROPS || {})["legend-ember"]) || {}, f = finds || {}, chances = [];
    const sure = (boss && !replay ? (E.boss_first || 0) : 0) + (f.quest_embers | 0);
    if (boss && replay && E.boss_again) chances.push(E.boss_again);
    for (const [key, n] of [["gold_chest", f.gold_chests], ["iron_chest", f.iron_chests], ["rare_enemy", f.rare_enemies]]) for (let i = 0; i < (n | 0); i++) if (E[key]) chances.push(E[key]);
    return { xp, coins, ember: sure, ember_chances: chances };
  }
  // (coins, reason): the price of one, or why it cannot be bought
  function price(itemId, shop, profile, found) {
    found = found || [];
    if (itemId === shop.ember.id) return [null, EMBER_NOT_SOLD];   // never sold, at any level: found in the Battlegrounds only
    for (const b of (shop.bundles || [])) if (b.id === itemId) return [b.coins, null];
    for (const it of shop.items) if (it.id === itemId) {
      if (it.needs_found && !found.includes(itemId)) return [null, "Bring one back first"];
      return [it.coins, null];
    }
    return [null, "Not sold here"];
  }
  function buy(itemId, n, shop, profile, found) {
    const [unit, why] = price(itemId, shop, profile, found);
    if (unit === null) return [false, 0, why];
    const cost = unit * Math.max(1, n);
    if (profile.coins < cost) return [false, cost, "Earn coins in the Battlegrounds"];
    return [true, cost, null];
  }
  // the Battlegrounds' drops (design pass 12 section 3.11): a table by kind (a troll's, else a hut's, else a chest's; null for what
  // drops nothing), fair share's multiplier on one knight's chance (a source that grows with the party is divided by its total's
  // count ratio, scaled / solo, and times fairShare.bonus in a party of humans; the undivided sources pay as solo), and one knight's
  // roll: each roll in order takes one number from `rand` (the caller's seeded stream, [0, 1)) for its chance and, when it drops,
  // one for its weighted pick
  function dropEntry(kind, drops) { const D = drops || root.FORGE_DROPS || {}; for (const g of ["trolls", "huts", "chests"]) { const e = (D[g] || {})[kind]; if (e) return e; } return null; }
  function dropRolls(entry) { if (!entry) return []; return entry.rolls ? entry.rolls.slice() : [entry]; }
  function dropFactor(source, humans, solo, scaled, drops) {
    const fs = (drops || root.FORGE_DROPS || {}).fairShare || {};
    if ((fs.undivided || []).includes(source)) return 1;
    const bonus = (humans === undefined ? 1 : humans) >= (fs.bonusFrom === undefined ? 2 : fs.bonusFrom) ? (fs.bonus === undefined ? 1 : fs.bonus) : 1;
    return solo > 0 && scaled > 0 ? bonus * solo / scaled : bonus;
  }
  function pickDrop(pick, u) { const items = Object.entries(pick); let x = u * items.reduce((s, [, w]) => s + w, 0); for (const [id, w] of items) { if (x < w) return id; x -= w; } return items[items.length - 1][0]; }
  function rollDrop(entry, rand, factor) { const f = factor === undefined ? 1 : factor, out = []; for (const r of dropRolls(entry)) if (rand() < Math.min(1, r.chance * f)) out.push(pickDrop(r.pick, rand())); return out; }
  const api = { runPay, price, buy, EMBER_NOT_SOLD, dropEntry, dropRolls, dropFactor, pickDrop, rollDrop };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Coin = api;
})(typeof window !== "undefined" ? window : globalThis);
