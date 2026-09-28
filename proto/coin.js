// coin.js: coin, XP and Legend Embers from a run, and the Trader's Cart (design pass 5 section 3.10), mirrored from tools/rules.py.
// Pure functions; the caller moves the coins and the stock. window.Coin in the page, module.exports in node.
(function (root) {
  "use strict";
  function runPay(level, boss, replay) {
    let xp = 40 + 10 * level, coins = 20 + 8 * level;
    if (boss) { xp *= 2; coins *= 3; }
    if (replay) { xp = Math.floor(xp / 2); coins = Math.floor(coins / 2); }
    return { xp, coins, ember: (boss && !replay) ? 1 : 0, ember_chance: (boss && replay) ? 0.25 : 0.0 };
  }
  // (coins, reason): the price of one, or why it cannot be bought
  function price(itemId, shop, profile, found) {
    found = found || [];
    if (itemId === shop.ember.id) {
      if (profile.level < shop.ember.from_level) return [null, "Legend Embers are sold from level " + shop.ember.from_level];
      return [shop.ember.coins, null];
    }
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
  const api = { runPay, price, buy };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Coin = api;
})(typeof window !== "undefined" ? window : globalThis);
