// coin.js: coin, XP and Legend Embers from a run, and the Trader's Cart (design pass 5 section 3.10), mirrored from tools/rules.py.
// Pure functions; the caller moves the coins and the stock. window.Coin in the page, module.exports in node.
// Since build 17 (design pass 24 sections 4.8 and 4.9) also Vorn's weapon classes, on the house while levels have earned them and
// for coins after that (classPrice, arm), and the well's daily coins (daily); their numbers are spec/shop.json's `classes` and `daily`.
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
  // Vorn's wares (design pass 24 section 4.8, build 17): shop.classes names the first class, which is never sold, and three groups of
  // the others, each group with one price. classPrice is the coins of a class's group, or null for the first class and for what is
  // not a class. arm says how a class would be taken up, by the first of these that holds: it is not a class of the shop's; it is
  // already held; it is on the house while a free pick is left (Progress.picksLeft: a free pick is always used before coins, for the
  // first class too); it is not for sale (the first class, with no pick left); the coins are too few (`cost` is the price); else it
  // is bought for its price. { ok, free, cost }, with `reason` when not ok. Pure: the caller adds the class to profile.classes and,
  // when it was not free, takes `cost` from profile.coins and adds the class to profile.bought. A shop from before build 17 has no
  // `classes`, and then nothing is a class
  const ARM_LINES = { unknown: "Not a weapon class", held: "That class is already owned", unsold: "Not for sale", poor: "Too few coins" };
  function classPrice(cls, shop) { for (const g of ((shop.classes || {}).groups || [])) if (g.classes.includes(cls)) return g.coins; return null; }
  function arm(cls, shop, profile) {
    const coins = classPrice(cls, shop), no = (reason, cost) => ({ ok: false, free: false, cost, reason });
    if (typeof cls !== "string" || (coins === null && cls !== (shop.classes || {}).first)) return no(ARM_LINES.unknown, 0);
    if (profile.classes.includes(cls)) return no(ARM_LINES.held, 0);
    if (progress().picksLeft(profile) > 0) return { ok: true, free: true, cost: 0 };
    if (coins === null) return no(ARM_LINES.unsold, 0);
    if ((profile.coins | 0) < coins) return no(ARM_LINES.poor, coins);
    return { ok: true, free: false, cost: coins };
  }
  // the well (design pass 24 section 4.9, build 17; when it pays again is design pass 26 section 3.2 row 7): shop.daily.coins once a
  // calendar day. `today` is the caller's local date as "YYYY-MM-DD", the phone's calendar day; anything else is no date. It pays
  // when the save has no date of a last claim (profile.daily.last), or when today is later than it: so once a date, a missed day
  // does not stack, and a clock turned back pays nothing. Two dates of this form compare as plain strings, and a `last` that is not
  // one counts as none. { ok, coins }, with `reason` when not ok. Pure: the caller adds the coins and writes profile.daily =
  // { last: today }. A shop from before build 17 has no `daily`, and then there is nothing to draw
  const DAILY_LINES = { date: "No date", claimed: "Back tomorrow" };
  const DATE = /^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/, isDate = s => typeof s === "string" && DATE.test(s);
  function daily(profile, today, shop) {
    const last = (profile.daily || {}).last, coins = (shop.daily || {}).coins | 0;
    if (!isDate(today)) return { ok: false, coins: 0, reason: DAILY_LINES.date };
    if (coins <= 0 || (isDate(last) && today <= last)) return { ok: false, coins: 0, reason: DAILY_LINES.claimed };
    return { ok: true, coins };
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
  const api = { runPay, price, buy, EMBER_NOT_SOLD, classPrice, arm, ARM_LINES, daily, DAILY_LINES, dropEntry, dropRolls, dropFactor, pickDrop, rollDrop };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Coin = api;
})(typeof window !== "undefined" ? window : globalThis);
