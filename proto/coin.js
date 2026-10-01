// coin.js: coin, XP and Legend Embers from a run, and the Trader's Cart (design pass 5 section 3.10), mirrored from tools/rules.py.
// Pure functions; the caller moves the coins and the stock. window.Coin in the page, module.exports in node.
(function (root) {
  "use strict";
  // Legend Embers (design pass 10, revision 1) come only from what the run found (spec/drops.json): `ember` is how many are sure (a
  // boss's first clear, a quest's reward), `ember_chances` one chance per other source (a boss again, then each gold chest, iron chest
  // and rare enemy), which the caller rolls with its own random numbers. `finds` is { gold_chests, iron_chests, rare_enemies,
  // quest_embers }, each a count, missing means 0; `drops` is the drop table (window.FORGE_DROPS unless given; none pays no Embers)
  const EMBER_NOT_SOLD = "Legend Embers aren't sold: bosses, chests and rare enemies drop them";
  function runPay(level, boss, replay, finds, drops) {
    let xp = 40 + 10 * level, coins = 20 + 8 * level;
    if (boss) { xp *= 2; coins *= 3; }
    if (replay) { xp = Math.floor(xp / 2); coins = Math.floor(coins / 2); }
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
  const api = { runPay, price, buy, EMBER_NOT_SOLD };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Coin = api;
})(typeof window !== "undefined" ? window : globalThis);
