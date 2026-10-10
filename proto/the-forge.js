// FORGE FOREVER: The Forge screen (design pass 2's smithy, pass 5 section 3.13 in full, pass 6 section 3.1.6 named legends).
// Plain script; runs from disk as a world of one (the seed ledger plus the offline Combiner) or against the local world service
// (?world=http://localhost:8765&player=mara, or the bench's Connect button). Everything the rules decide comes from the shared
// modules: combiner.js (the cases, keys, the Combiner, the validator), naming.js, progress.js, coin.js, crucible.js, discovery.js.
// Since build 2 (card t65, design pass 7 section 3.9) the smithy has a door down to the Training Cellar (proto/the-battlegrounds.html):
// the door and "Try it in the cellar" hand the loadout and every owned weapon down as whole records (forge-forever:to-cellar), the
// loadout comes back (forge-forever:from-cellar, on boot and on pageshow), and the save keeps what the page forged itself.
// Since build 3 (card t69, design pass 11 with pass 9's menu) the page is an app frame that fills the screen, landscape only: the
// anvil the whole screen until a slot asks for the walls; a phone held upright sees the turn plate or, with My screen won't turn, the
// frame turned a quarter; the house on the sign goes to the main menu through nav.js; the bench lives in Settings (settings.js)
// under Developer; the handoff is written whenever the page is left.
// Since build 4 (design pass 14) the room is the wide smithy (Smithy.mount with wide: true, 232 to 320 world pixels, the width the
// pane's shape asks for): wall to wall sideways, the cellar's door on the left and the Armory's door on the right (it opened the book until build 5);
// with the walls open the room keeps its height and is cut to the station. No "Wakes at level 25" plate: the Crucible's tab says it.
// Build 4 also brings design pass 10 (card t67): the clean plaque (the rarity band, the traits in words, a legend's Strike and Ability
// rows, no flavour and no placeholders), the Armory in place of the Ledger (a shelf per class, Legends by the date acquired, any
// weapon's plaque again in view mode), and the Legend Ember found in the Battlegrounds only (spec/drops.json), never sold or given.
// Since build 5 (design pass 15, card t70) the Armory is a room of its own (armory.js: a hall of shelves the smith walks sideways, a
// bay for every class held, the Legends on a wall of their own; the Roll and the Book of Kinds are gone from the page), reached by
// its door or ARMORY on the sign and left by the door at its left end or FORGE on the sign; a plaque is a static card that never
// scrolls (three columns, fitted by fitPlaque); and the forging's hammer floats without an arm (forge-fx.js).
// Since build 6 (design pass 17 with its revision 1, card t71) the Forge has its smith: Grycus (grycus.js, his words spec/grycus.json)
// stands by the bellows, drawn into the room by the smithy's figure layer, breathes and twitches, swings the sledge in every forge
// (forge-fx.js draws him at the anvil in the close-up), and has a word after the forges that matter, when tapped, on a first meeting,
// on a greeting and on the way up from the cellar, in a parchment bubble over his head. The player is not a smith: he calls them kid.
// Since build 7 (design pass 12, section 3.11.5) a level hands its run back through forge-forever:from-battle: a clear is paid by
// World.run (a replay once the area is in profile.cleared), a run that did not clear banks its finds by World.bank with no pay, and
// either way the run's id goes into profile.runs in the same save, so a reload never pays or banks twice. Ingredients only, never a
// weapon. The handoff down carries the areas cleared.
// Since build 8 (design pass 16 with its revision 1, the first five minutes) the player record (smith.js) names the save, local:<id>: a
// record with no save is a new player (newSmith: level 1, 60 coins, the Sword), no record sends the page to the main menu, which asks
// the name (under ?stay=1 the dev smith boots as before), and Grycus's lessons (forge-lessons.js, through the lessonOn hooks) teach
// the first forge and say good luck; while they run he says none of his own lines.
// Since build 17 (design passes 24 and 25, settled by design pass 26; cards t79 and t82) the page is the castle: four rooms under one
// sign. The Courtyard (state.room "yard": proto/courtyard.js's yard walked at the cellar's scale with proto/stick.js's stick, tap to
// go, a prompt over the knight; Nell's cart and Vorn's weapons as planks, the well's daily coins) is the game's hub and where the
// menu's Play lands; the Forge's left door goes out to it and its right wall is the Rack of the two hands; the Armory is entered
// from the yard; and the Map Table (state.room "map": proto/map-table.js's map on its table, by the yard's gate) is where a level is
// picked and Go leaves for the Battlegrounds page. Vorn's classes and the well's coins are Coin.arm and Coin.daily (and the service's
// /arm and /daily); the unlock plaque and the Cart's cabinet are gone. Only the Map Table is an entry in the phone's history.
// Since build 20 (design pass 31, card t89) the walls pane is bare: no head line over a wall, no gift line under a shelf's name and
// no chip row (by element, or by kind on the Legendary shelf); a shelf is its name and count, the search, the sort and the things.
// Since build 21 (design pass 32, card t90) the confirm plank paints over Vorn's plank (it was hidden under it, so a tap on a class
// seemed to do nothing), a class held reads Owned ✓ at his stall, and a class taken there (or the first weapon chosen) raises the
// drill (openDrill, proto/drill.js): the knight using the weapon against a straw dummy, with its damage and strengths under it.
// Since build 23 (design pass 33, card t92) the drill's stage is as big as the plaque holds (a whole number of device pixels a world
// pixel: 480 x 192 CSS px on an iPhone, from 320 x 128) and Vorn's line and face are off its head.
(function () {
  "use strict";
  const G = window.FORGE_GRAMMAR, F = window.Forge, PF = window.PixelForge, SHOP = window.FORGE_SHOP, TERMS = window.FORGE_TERMS, FILTER = window.FORGE_NAME_FILTER;
  const $ = id => document.getElementById(id);
  let reduce = window.Settings ? Settings.reduce() : !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const params = new URLSearchParams(location.search);
  // under the harness the page's own motion is off (as in the cellar), so a check or a picture never catches a plaque half risen
  document.documentElement.classList.toggle("still", reduce || params.get("harness") === "1");
  const CLASS_COUNT = G.visual.bases.length;
  const TIER = G.tiers;
  // (build 17) the castle's rooms and the modules the Courtyard and the Map Table need (the section "the castle" below says the rest)
  const ROOMS = { yard: "The Courtyard", forge: "The Forge", armory: "The Armory", map: "The Map Table" };
  const Y = window.Courtyard || null, FK = window.Folk || null, MT = window.MapTable || null, KN = window.Knight || null, ST = window.Stick || null, TR = window.Trolls || null;
  const hasYard = !!(Y && FK && KN && ST && window.Physics && window.FORGE_COMBAT && window.FORGE_COURTYARD && window.FORGE_FOLK);
  const hasMap = !!(MT && KN && TR && window.FORGE_MAP);
  const noyard = params.get("noyard") === "1" || !hasYard;
  const stay = params.get("stay") === "1";
  const SPOT_OF = { menu: "menu", cellar: "cellar", level: "road", road: "road", lessons: "lessons", forge: "forge", armory: "armory", table: "table" };

  const nowIso = () => new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const clone = x => JSON.parse(JSON.stringify(x));
  const plural = b => ({ staff: "Staves", scythe: "Scythes", lance: "Lances", book: "Books", dagger: "Daggers", axe: "Axes", orb: "Orbs", claw: "Claws", whip: "Whips", flail: "Flails", cannon: "Cannons", lantern: "Lanterns", horn: "Horns", bow: "Bows", crossbow: "Crossbows", wand: "Wands", shield: "Shields", spear: "Spears", hammer: "Hammers", sword: "Swords", legendary: "Legendary" })[b] || (b[0].toUpperCase() + b.slice(1) + "s");
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  const FORM_VERB = { slash: "Slashes", thrust: "Thrusts", smash: "Smashes", shoot: "Shoots", stream: "Streams", lob: "Lobs", orbit: "Orbits", field: "Wards", trap: "Traps", summon: "Summons" };
  const FORM_LOW = { slash: "slashes", thrust: "thrusts", smash: "smashes", shoot: "shoots", stream: "streams", lob: "lobs", orbit: "orbits", field: "wards", trap: "traps", summon: "summons" };
  const CASE_SIGN = { apply: "+", gift: "▸", mix: "+", fuse: "✦" };
  // the plaque's words for the grammar's (design pass 10 section 3.3.3): one readable line in place of the grammar's own tokens
  const STATUS_WORD = { burn: "Burns", freeze: "Freezes", shock: "Shocks", poisoned: "Poisons", bleed: "Bleeds", slow: "Slows", stun: "Stuns", knockback: "Knocks back", blind: "Blinds", weaken: "Weakens", mark: "Marks", lifesteal: "Lifesteal" };
  const MOD_WORD = { pierce: "Pierces", chain: "Chains", bounce: "Bounces", homing: "Homing", explode: "Explodes", split: "Splits", ricochet: "Ricochets", charge: "Charges", rapid: "Rapid", giant: "Giant", tiny: "Tiny", twin: "Twin", boomerang: "Returns", spread: "Spreads",
    lunge: "Lunges", spin: "Spins", combo: "Combo", reach: "Long reach", guard: "Guards", reflect: "Reflects", vampiric: "Vampiric", crit: "Keen", heavy: "Heavy", light: "Light", sticky: "Sticky", seeking: "Seeking", phasing: "Phasing", pull: "Pulls", push: "Pushes",
    ignite_ground: "Burning ground", frost_trail: "Frost trail" };
  // a legend's ability (design pass 10 section 3.5): its head's class, from the right mold, gives it one of twenty (spec/abilities.js)
  const AB = (window.FORGE_ABILITIES || { classes: {} }).classes || {};
  const headOf = t => { const v = t && t.weapon && t.weapon.visual; return v && v.fuse && v.fuse !== v.base ? v.fuse : null; };
  const abilityOf = t => AB[headOf(t)] || null;
  Smithy.installFrames();

  // ------------------------------------------------------------------ the world (things, rows, kinds), what you own, the smith
  const world = new Map(), rows = new Map(), kinds = [], players = [];
  let ledgerAt = window.FORGE_LEDGER;
  // the keys of the ledger's own rows and kinds: every other row, kind and smith is the page's own, and goes into its save
  let ledgerRows = new Set(), ledgerKinds = new Set();
  function loadLedger(L) {
    world.clear(); rows.clear(); kinds.length = 0;
    for (const t of window.FORGE_THINGS) world.set(t.id, t);
    for (const r of L.rows) { if (r.thing) world.set(r.thing.id, r.thing); rows.set(rowKey(r), r); }
    for (const k of (L.kinds || [])) kinds.push(k);
    for (const t of world.values()) if (F.isWeapon(t) && !t.base) t.base = F.baseOf(t, world);
    ledgerRows = new Set(rows.keys()); ledgerKinds = new Set(kinds.map(k => k.key));
  }
  // every weapon in the world whose form is not its class's is repaired in place (F.repairForm); returns how many were
  function repairForms() {
    if (typeof F.repairForm !== "function") return 0;
    let n = 0;
    for (const [id, t] of [...world.entries()]) {
      if (!F.isWeapon(t)) continue;
      try { const [r, changed] = F.repairForm(t, G); if (!changed) continue; world.set(id, r); for (const row of rows.values()) if (row.thing && row.thing.id === id) row.thing = r; n++; }
      catch (e) { (window.__errors || []).push("repair " + id + ": " + (e && e.message || e)); }
    }
    return n;
  }
  function rowKey(r) { const kase = r.case || (r.thing && r.thing.hybrid ? "fuse" : F.roles(world.get(r.pair[0]) || { id: r.pair[0], kind: "ingredient" }, world.get(r.pair[1]) || { id: r.pair[1], kind: "ingredient" })[0]); return F.keyText(kase, r.pair[0], r.pair[1]); }
  loadLedger(ledgerAt);

  const own = new Map();      // id -> { n, seq }
  let seq = 0;
  // when each thing was first acquired (design pass 10 section 3.4.2: the Legends tab sorts by it). gain writes the date the first time a
  // thing is gained (not for gain(id, 0), which the cabinet uses to list a store's things); a save from before build 4 has none, and
  // those legends sort last
  const got = {};
  // (build 8: gain(id, 0) adds nothing, as the cabinet and a save's stock of 0 mean; it added one, so every reload gave back a used-up
  // Fire and opening a store's cabinet gave one of every thing in it)
  function gain(id, n) { const k = n === undefined ? 1 : n, o = own.get(id); if (o) { o.n += k; } else own.set(id, { n: k, seq: ++seq }); if ((n === undefined || n > 0) && !got[id]) got[id] = nowIso(); }
  function have(id) { const o = own.get(id); return o ? o.n : 0; }
  let profile = Progress.newProfile("isaac");
  const session = { revealed: new Set(), equipped: [], active: 0, savedAt: null, slideToastShown: false, noPayToastShown: false, backPay: null, levelSaved: null, loadFailed: false, pending: [], lastClaim: null, assistTap: false, erased: false, leaving: false, booted: false, roomSet: false };
  const state = { station: "anvil", a: null, b: null, ma: null, mb: null, forging: false, pouring: false, tab: "weapons", view: "wall", cab: null, sort: "newest", q: "", glow: null, glowItem: null, bulk: false,
    room: "forge", page: "armory", hallX: { armory: 0, legends: 0 }, hold: null, wallsOpen: false, picking: false };
  const svc = { url: null, player: null, smiths: 0, spare: null };
  const turn = { forced: window.Settings ? Settings.isOn("forced") : false, turned: false, plate: false };   // landscape only (amendment 9)
  const isForged = t => !!(t.parents && t.parents.length);
  const classOf = t => F.classOf(t);
  const classOpen = c => c === "legendary" ? Progress.crucibleAwake(profile, G) : profile.classes.includes(c);
  const isClassWeapon = t => F.isWeapon(t) && !isForged(t);
  const worldKey = () => svc.url ? "svc:" + svc.url + ":" + svc.player : "local:" + profile.id;

  // ------------------------------------------------------------------ persistence (per world; a convenience, the page works without it)
  // The save keeps what the page forged itself (design pass 7 section 3.9.3): every row that is not the ledger's own (the Combiner's
  // drafts of a world of one, the page's linked rows, the bench's week of other smiths), the kinds the page founded, and those smiths.
  // Without them a weapon the page forged was lost on reload, and going down to the cellar and back is a reload.
  function save() {
    // (build 12) nor over a save that is there but could not be read (session.loadFailed): the page runs unsaved until it is opened again
    if (svc.url || session.erased || session.loadFailed) return false;
    const stock = {}; for (const [id, o] of own) stock[id] = o.n;
    const at = nowIso();
    const mine = []; for (const [k, r] of rows) if (!ledgerRows.has(k)) mine.push({ k, r });
    const data = { profile, stock, got, equipped: session.equipped, active: session.active, assist: session.assistTap, at, rows: mine, kinds: kinds.filter(k => !ledgerKinds.has(k.key)), players, grycus: gry.mem, folk: folk.mem, roll: rollMem };   // (build 17: the folk's memory beside Grycus's; build 24: the Roll's queue beside them)
    // (build 9) on the Cloudflare copy the save then goes online too (proto/cloud.js sends it a moment later)
    const put = d => { localStorage.setItem("forge-forever:" + worldKey(), JSON.stringify(d)); session.savedAt = at; if (window.Cloud) Cloud.touch(); return true; };
    try { return put(data); }
    catch (e) {
      // over the quota: only the rows of owned Things are kept
      try { return put(Object.assign({}, data, { rows: mine.filter(({ r }) => own.has(r.thing ? r.thing.id : r.linked_to)), players: [], trimmed: true })); }
      catch (e2) { return false; /* no storage: the page still works */ }
    }
  }
  // (build 12) a save that is there and whole but cannot be taken in (the page and its scripts from two builds while a deploy is
  // fresh, a script that did not load) sets session.loadFailed: boot then writes nothing over it, and save() is refused for the
  // visit. Before, any error in here read as "no save", and a new smith was saved over the player's game. A save that is not JSON,
  // or has no profile, is no save, as before
  function load() {
    let raw = null, d = null;
    try { raw = localStorage.getItem("forge-forever:" + worldKey()); d = raw ? JSON.parse(raw) : null; } catch (e) { return false; }
    if (!d || !d.profile) return false;
    try {
      profile = Object.assign(Progress.newProfile(d.profile.id), d.profile);
      // (build 12, design pass 19 section 3.5) a save made under the old XP rules (no xpRules) keeps its XP, its level follows the new
      // curve, and each Battleground level it cleared is paid the difference once (+200 for the Troll Gate); it is marked xpRules: 2,
      // and boot saves it, says so once and runs the level-up it brings (session.levelSaved is the level the save had). With an older
      // progress.js still cached (no backPay), or the numbers not loaded, the save is left as it was, unmarked, for a later opening
      if (!(d.profile.xpRules >= 2)) {
        delete profile.xpRules;
        if (d.profile.xpRules !== undefined) profile.xpRules = d.profile.xpRules;
        try { if (typeof Progress.backPay === "function") { session.backPay = Progress.backPay(profile); session.levelSaved = Math.max(1, d.profile.level | 0); } }
        catch (e) { session.backPay = null; (window.__errors || []).push("back pay: " + (e && e.message || e)); }
      }
      try { profile.level = Progress.levelFor(profile.xp | 0); } catch (e) { /* the numbers are not loaded: the saved level stands */ }
      // the page's own rows go back into the world before the stock, so what it forged is known again
      for (const e of (d.rows || [])) { const r = e && e.r; if (!r || !e.k || rows.has(e.k)) continue; if (r.thing && r.thing.id) { if (!world.has(r.thing.id)) world.set(r.thing.id, r.thing); else r.thing = world.get(r.thing.id); } rows.set(e.k, r); }
      for (const k of (d.kinds || [])) if (k && k.key && !kinds.some(x => x.key === k.key)) kinds.push(k);
      for (const p of (d.players || [])) if (p && p.id && !players.some(x => x.id === p.id)) players.push(p);
      for (const t of world.values()) if (F.isWeapon(t) && !t.base) t.base = F.baseOf(t, world);
      // (forge rules 3, 2026-10-07) a weapon forged before the rule attacks with its class's form again (a Horn-Blown Axe swings, it
      // does not lob): the repaired record replaces the old one in the world and in its row, and boot saves it
      session.formsRepaired = repairForms();
      own.clear(); seq = 0;
      // the dates acquired come back as saved, and none is invented: a thing the save has no date for stays undated
      for (const k of Object.keys(got)) delete got[k];
      for (const [id, at] of Object.entries(d.got || {})) if (typeof at === "string") got[id] = at;
      for (const [id, n] of Object.entries(d.stock || {})) if (world.has(id)) { const had = got[id]; gain(id, n); if (!had) delete got[id]; }
      session.equipped = (d.equipped || []).filter(id => world.has(id));
      session.active = d.active | 0;
      session.assistTap = !!d.assist;
      session.savedAt = d.at || null;
      gry.mem = GRY ? GRY.memory(d.grycus) : null;   // (a save from before build 6 has none: he meets the player)
      folk.mem = FK ? FK.memory(d.folk) : null;   // (build 17: Nell's and Vorn's; a save from before has none: they meet the knight)
      rollMem = rollMemory(d.roll);   // (build 24: the claims still to be settled by the world; a save from before has none, and its old firsts are claimed once at boot)
      return true;
    } catch (e) { session.loadFailed = true; (window.__errors || []).push("load: " + (e && e.message || e)); return false; }
  }

  // ------------------------------------------------------------------ the seam with the Battlegrounds (design pass 7 section 3.9)
  const KEY_TO = "forge-forever:to-cellar", KEY_FROM = "forge-forever:from-cellar", KEY_BATTLE = "forge-forever:from-battle", MAX_DOWN = 400;
  const canWield = t => !!t && F.isWeapon(t) && Progress.canEquip(t, profile, G);
  const cellarUrl = () => (document.body.getAttribute("data-battlegrounds") || "the-battlegrounds.html") + (params.get("harness") === "1" ? "?harness=1&seen=1" : "");
  // out goes the loadout and every weapon the smith owns, as whole records: the loadout first, then newest first, at most 400; a
  // weapon the smith can't wield yet (a chained class, a legend below level 25) goes down as practice only
  function writeHandoff(tryId) {
    if (session.erased) return 0;
    const loadout = session.equipped.filter(id => own.has(id) && canWield(world.get(id))).slice(0, 2);
    const ids = loadout.slice();
    if (tryId && world.has(tryId) && !ids.includes(tryId)) ids.push(tryId);
    for (const t of owned(t => F.isWeapon(t)).sort((a, b) => own.get(b.id).seq - own.get(a.id).seq)) { if (ids.length >= MAX_DOWN) break; if (!ids.includes(t.id)) ids.push(t.id); }
    const pack = list => { const out = {}; for (const id of list) { const t = clone(world.get(id)); if (!canWield(t)) t.practice = true; out[id] = t; } return out; };
    // (design pass 12: the areas cleared ride down too, so the gate plate says Cleared and a run knows it is a replay; the Things found,
    // so a level's toast can say "First find"; the XP, so a clear's tally can say the level it reaches; and the bench's Party size, when
    // more than one, so the level fills bench seats: section 3.10)
    const head = { v: 1, at: nowIso(), world: worldKey(), smith: { id: profile.id, name: profile.name || profile.id, level: profile.level, xp: profile.xp, classes: profile.classes.slice(), cleared: Object.assign({}, profile.cleared), found: profile.found.slice() },
      loadout, active: Math.max(0, Math.min(loadout.length - 1, session.active | 0)) };
    const party = benchParty(); if (party > 1) head.bench = { party };
    if (tryId && !loadout.includes(tryId) && world.has(tryId)) head.try = tryId;
    try { localStorage.setItem(KEY_TO, JSON.stringify(Object.assign({}, head, { weapons: pack(ids), order: ids }))); return ids.length; }
    catch (e) {
      // over the quota: the loadout's records only; the rack then holds the loadout and the class weapons
      const few = loadout.concat(head.try ? [head.try] : []);
      try { localStorage.setItem(KEY_TO, JSON.stringify(Object.assign({}, head, { weapons: pack(few), order: few, trimmed: true }))); return few.length; }
      catch (e2) { return 0; }   // no storage: the cellar arrives visiting
    }
  }
  // the bench's Party size (Settings > Developer), 1 to 4: the level fills the seats after the player's with bench bots, full knights
  function benchParty() { const el = $("benchParty"); const n = el ? parseInt(el.value, 10) : 1; return Math.max(1, Math.min(4, n || 1)); }
  // the door, or Try it in the cellar on a weapon's plaque: the weapon becomes the active hand (equipped, first in first out as always,
  // when it can be wielded; practice only when it can't), and the smith goes down
  function goDown(id) {
    lessonOn("down", id);   // (build 8) the lessons' F6 ends here: the record moves on to the cellar's steps before the page leaves
    gryHush();
    let tryId = null;
    const t = id ? world.get(id) : null;
    if (t && F.isWeapon(t) && own.has(id)) {
      if (canWield(t)) { if (!session.equipped.includes(id)) { session.equipped.push(id); if (session.equipped.length > 2) session.equipped.shift(); } session.active = session.equipped.indexOf(id); }
      else tryId = id;
    }
    session.equipped = session.equipped.filter(x => own.has(x) && world.has(x));
    save();
    const sent = writeHandoff(tryId);
    markWent("cellar"); saveYardMark();   // (build 17: the next boot or the back gesture opens the courtyard at the top of the cellar's stairs)
    const url = cellarUrl();
    const went = window.Nav ? Nav.go("cellar", url, { stay }) : { to: "cellar", url, how: "push" };
    window.TheForge.wentDown = { url, sent, try: tryId, how: went.how };
    if (!stay) { session.leaving = true; if (!window.Nav) window.location.href = url; }
    return sent;
  }
  // the house on the sign: back to the main menu (design pass 9 section 3.4), the handoff written so Battlegrounds from the menu
  // carries the smith's weapons; nothing while forging or pouring, like the door
  const menuUrl = () => document.body.getAttribute("data-menu") || "main-menu.html";
  // (build 17: from the Map Table its history entry comes off first, so the menu is right behind as nav.js expects)
  function goHome() {
    if (state.forging || state.pouring || session.leaving) return null;
    if (state.room === "map" && map.pushed) { popMap(() => goHomeNow()); return { to: "menu", how: "popmap" }; }
    return goHomeNow();
  }
  function goHomeNow() {
    if (state.forging || state.pouring || session.leaving) return null;
    gryHush(); closeFolk(); saveYardMark();
    session.equipped = session.equipped.filter(x => own.has(x) && world.has(x));
    save();
    writeHandoff(null);
    const url = menuUrl();
    const went = window.Nav ? Nav.go("menu", url, { stay }) : { to: "menu", url, how: "push" };
    window.TheForge.wentTo = went;
    if (!stay) { session.leaving = true; if (!window.Nav) window.location.href = url; }
    return went;
  }
  // the handoff whenever the page is left or hidden (the app switched away or closed), except right after going down, so a door
  // handoff with `try` is never overwritten
  // (the handoff only: the save is already current after every action, and a save here would write an erased smithy back)
  function handoffOnLeave() { if (!session.booted || session.erased || window.TheForge.wentDown) return; writeHandoff(null); saveYardMark(); }
  window.addEventListener("pagehide", handoffOnLeave);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") handoffOnLeave(); else if (session.booted) setTimeout(settleQueue, 1500); });   // (build 24: back to the page, the Roll's queue goes)
  window.addEventListener("online", () => setTimeout(settleQueue, 1500));
  // in comes the loadout, and nothing else: taken when it is for this world and newer than the Forge's own save
  function takeLoadoutBack() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY_FROM)); } catch (e) { d = null; }
    if (!d || d.v !== 1 || !Array.isArray(d.loadout) || d.world !== worldKey()) return false;
    if (session.savedAt && d.at && Date.parse(d.at) < Date.parse(session.savedAt)) return false;   // two tabs: the Forge's own save is newer
    loadoutFrom(d);
    try { localStorage.removeItem(KEY_FROM); } catch (e) { /* no storage */ }
    save();
    if (session.equipped.length) toast("Up from the cellar with " + session.equipped.map(id => world.get(id).name).join(" and "));
    return true;
  }
  function loadoutFrom(d) {
    session.equipped = d.loadout.filter(id => world.has(id) && own.has(id) && canWield(world.get(id))).slice(0, 2);
    session.active = Math.max(0, Math.min(session.equipped.length - 1, d.active | 0));
  }
  // in come the runs from a level (design pass 12 section 3.11.5), once each, those for this world: forge-forever:from-battle holds the
  // latest world's runs in order under `runs` (`run` the latest, the note's shape) and other worlds' under `others`; a run for another
  // world waits in the key for its own Forge. Each run is paid or banked by its own id: a clear by World.run, a replay when the run or
  // profile.cleared says the area was cleared before (so the second of two clears waiting together is a replay); a run that did not clear
  // banks its things by World.bank, and its finds are dropped. Either way the run's id goes into profile.runs in the same save, so a reload
  // never pays or banks twice; what the world can't take yet (no answer, no save) stays in the key with the runs after it, as do the other
  // worlds' runs. Only ingredients the Forge knows are taken, never a weapon. The loadout comes back as from the cellar, unless the Forge's
  // own save was newer. Returns the last run taken, { res, before, cleared, things, id }, or null
  // (the key as it stands once this world's runs but `left` are taken: the other worlds' parts take the head in turn; nothing left: null)
  function keyLeaving(d, me, left) {
    const others = Object.assign({}, d.others && typeof d.others === "object" ? d.others : {}), mineHead = d.world === me ? { at: d.at, loadout: d.loadout, active: d.active } : Object.assign({}, others[me] || {});
    delete others[me];
    const parts = [];
    if (left.length) parts.push([me, Object.assign(mineHead, { runs: left })]);
    if (d.world !== me && typeof d.world === "string") parts.push([d.world, { at: d.at, loadout: d.loadout, active: d.active, runs: Array.isArray(d.runs) ? d.runs : d.run ? [d.run] : [] }]);
    for (const [w, o] of Object.entries(others)) if (o && typeof o === "object") parts.push([w, o]);
    if (!parts.length) return null;
    const [w0, p0] = parts[0], runs = Array.isArray(p0.runs) ? p0.runs : [], out = { v: 1, at: p0.at || d.at, world: w0, loadout: p0.loadout, active: p0.active, run: runs.length ? runs[runs.length - 1] : null, runs };
    if (parts.length > 1) { out.others = {}; for (const [w, p] of parts.slice(1)) out.others[w] = p; }
    return out;
  }
  async function takeRunBack() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY_BATTLE)); } catch (e) { d = null; }
    if (!d || typeof d !== "object" || d.v !== 1) return null;
    const me = worldKey(), part = d.world === me ? d : d.others && typeof d.others === "object" && d.others[me] && typeof d.others[me] === "object" ? d.others[me] : null;
    if (!part) return null;   // nothing for this world: the key waits for its own
    const list = (Array.isArray(part.runs) ? part.runs : part.run && typeof part.run === "object" ? [part.run] : []).filter(r => r && typeof r === "object");
    const write = left => { try { const k = keyLeaving(d, me, left); if (k) localStorage.setItem(KEY_BATTLE, JSON.stringify(k)); else localStorage.removeItem(KEY_BATTLE); } catch (e) { /* no storage */ } };
    const before = profile.level, savedBefore = session.savedAt;
    let last = null, taken = 0;
    for (const run of list) {
      const id = typeof run.id === "string" ? run.id.slice(0, 120) : "";
      if (!id || (profile.runs || []).includes(id)) { taken++; continue; }   // no id, or brought home already (a reload after the save)
      const things = (Array.isArray(run.things) ? run.things : []).filter(t => typeof t === "string" && world.has(t) && !F.isWeapon(world.get(t)));
      const cleared = run.cleared === true, area = typeof run.area === "string" ? run.area.slice(0, 60) : "", replay = !!run.replay || !!(profile.cleared || {})[area];
      let res = null;
      try {
        if (run.arena && typeof run.arena === "object") res = await World.arena(run.arena, { id });   // (design pass 36) a bout on the sand: its XP, nothing cleared
        else if (cleared) {
          const f = run.finds || {}, finds = {};
          for (const k of ["gold_chests", "iron_chests", "rare_enemies", "quest_embers"]) finds[k] = Math.max(0, Math.min(99, f[k] | 0));
          res = await World.run(Math.max(1, run.level | 0), !!run.boss, replay, things, finds, { id, area });
        } else res = await World.bank(things, { id });
      } catch (e) { res = null; }
      if (!res || res.saved === false) break;   // the world can't take it now: it waits in the key, with the runs after it
      taken++;
      if (res.again) continue;
      if (run.arena && typeof run.arena === "object") { toast(res.pay && res.pay.xp > 0 ? "From the sand: +" + res.pay.xp + " XP" + (res.levelled ? " · Level " + res.level + "!" : "") : "Back from the sand"); last = { res, before, cleared: false, things: [], id }; continue; }
      const n = {}; for (const t of (cleared ? things : res.banked || [])) n[t] = (n[t] || 0) + 1;
      const names = Object.keys(n).map(t => world.get(t).name + (n[t] > 1 ? " ×" + n[t] : "")).join(", ");
      if (cleared) toast(`Home with a clear${(res.replay === undefined ? replay : res.replay) ? " (a replay)" : ""}: ${res.pay.xp} XP, ${res.pay.coins} coins${res.pay.ember ? ", a Legend Ember" : ""}${names ? " · " + names : ""}`);
      else toast("Home without a clear: " + (names ? names + " banked, no pay" : "nothing to bank"));
      last = { res, before, cleared, things, id };
    }
    write(list.slice(taken));
    if (last && Array.isArray(part.loadout) && !(savedBefore && part.at && Date.parse(part.at) < Date.parse(savedBefore))) { loadoutFrom(part); save(); }
    window.TheForge.lastRun = last ? { id: last.id, cleared: last.cleared, things: last.things, res: last.res } : null;
    return last;
  }

  // ------------------------------------------------------------------ sprites and their four-frame particles
  const live = new Set();
  function animated(t) { return (t.weapon && (t.weapon.element !== "physical" || t.hybrid)) || (t.hints && t.hints.element && t.kind !== "weapon"); }
  function sprite(t, scale) { const cv = PF.canvasFor(t, { scale }); if (animated(t)) live.add([cv, t, scale]); return cv; }
  { let fr = 0; setInterval(() => { if (reduce) return; fr = (fr + 1) % 4; for (const e of live) { if (!e[0].isConnected) { live.delete(e); continue; } PF.draw(e[0], e[1], { scale: e[2], frame: fr }); } }, 130); }

  // ------------------------------------------------------------------ the service adapter (or the world of one)
  async function api(method, path, body) {
    const r = await fetch(svc.url + path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    let json = null;
    try { json = await r.json(); } catch (e) { json = {}; }
    return { code: r.status, body: json };
  }
  function absorbClaim(c) {
    // the world's answer becomes part of the page's world
    if (c.thing) world.set(c.thing.id, c.thing);
    if (F.isWeapon(c.thing) && !c.thing.base) c.thing.base = F.baseOf(c.thing, world);
    const kase = c.case || "apply";
    const pair = c.pair || [];
    if (pair.length === 2) rows.set(F.keyText(kase, pair[0], pair[1]), { key: c.key, pair, thing: c.status === "rediscovered" ? null : c.thing, linked_to: c.status === "rediscovered" ? c.thing.id : undefined, case: kase, at: c.at, player: c.first });
    if (c.kind && !kinds.some(k => k.key === c.kind.key)) kinds.push(c.kind);
    return c;
  }
  async function refreshProfile() {
    const { code, body } = await api("GET", "/player/" + encodeURIComponent(svc.player));
    if (code === 200) {
      const stock = body.stock;
      profile = Object.assign(Progress.newProfile(body.id), body, { stock: undefined });
      if (stock) { for (const [id, n] of Object.entries(stock)) { const o = own.get(id); if (o) o.n = n; else if (n > 0 && world.has(id)) gain(id, n); } }
    }
    return code;
  }
  const World = {
    async forge(leftId, rightId, station) {
      const left = world.get(leftId), right = world.get(rightId);
      if (svc.url) {
        try {
          const { code, body } = await api("POST", station === "crucible" ? "/crucible" : "/forge", { player: svc.player, left: leftId, right: rightId });
          if (code !== 200) return { error: body.reason || body.error || ("The world answered " + code), code };
          absorbClaim(body);
          await refreshProfile();
          return body;
        } catch (e) {
          toast("The world can't be reached: the Combiner's draft, provisional");
          const c = localForge(left, right, station, true);
          if (c && !c.error) session.pending.push({ left: leftId, right: rightId, station });
          return c;
        }
      }
      // (build 24, design pass 29) on the online copy a forge the phone's world calls a first is settled by the server before the plaque
      const c = localForge(left, right, station, false, rollOn());
      return rollOn() && c && !c.error ? settleForge(c, left, right, station) : c;
    },
    async name(thingId, name) {
      if (svc.url) {
        const { code, body } = await api("POST", "/name", { player: svc.player, thing: thingId, name });
        if (code === 200) { const t = world.get(thingId); if (t) { t.name = body.name; t.naming = body.thing.naming; } await refreshProfile(); }
        return { code, body };
      }
      return localName(thingId, name);
    },
    async keep(thingId) {
      if (svc.url) {
        const { code, body } = await api("POST", "/name/keep", { player: svc.player, thing: thingId });
        if (code === 200) { const t = world.get(thingId); if (t) t.naming = body.thing.naming; await refreshProfile(); }
        return { code, body };
      }
      const t = world.get(thingId);
      t.naming = Object.assign({}, t.naming || {}, { status: "kept", by: profile.id, at: nowIso() });
      profile.unnamed = (profile.unnamed || []).filter(id => id !== thingId);
      save();
      return { code: 200, body: { ok: true, thing: { id: t.id, name: t.name, naming: t.naming } } };
    },
    async acceptTerms() {
      if (svc.url) {
        const { code, body } = await api("POST", "/terms/accept", { player: svc.player, version: TERMS.version });
        if (code === 200) profile.terms = Object.assign({}, profile.terms, { naming: body.accepted });
        return code === 200;
      }
      profile.terms = Object.assign({}, profile.terms, { naming: { version: TERMS.version, at: nowIso() } });
      save();
      return true;
    },
    // a run's pay (design pass 10 revision 1): XP and coins as always; Legend Embers only from what the run found (`finds`: gold
    // chests, iron chests, rare enemies, quest Embers, by spec/drops.js), each chance rolled here; reaching level 25 gives none.
    // `from` is a level's run brought home (design pass 12 section 3.11.5), { id, area }: paid once by its id (remembered in
    // profile.runs) and marking its area in profile.cleared, in the same save; the service does the same by run_id ({ again: true }
    // when it was paid before). The things go into the stock in both modes
    async run(level, boss, replay, things, finds, from) {
      if (svc.url) {
        const { code, body } = await api("POST", "/run", Object.assign({ player: svc.player, level, boss, replay, things, finds: finds || {} }, from ? { run_id: from.id, area: from.area || "" } : {}));
        if (code === 200) { await refreshProfile(); if (!body.again) for (const id of things) if (world.has(id)) gain(id); return body; }
        return null;
      }
      if (from && !Progress.rememberRun(profile, from.id)) return { again: true, pay: { xp: 0, coins: 0, ember: 0, ember_chances: [] }, level: profile.level, levelled: false, crucible_woke: false };
      const before = profile.level;
      const pay = Coin.runPay(level, boss, replay, finds, window.FORGE_DROPS);
      const ember = pay.ember + pay.ember_chances.filter(p => Math.random() < p).length;
      profile.xp += pay.xp; profile.coins += pay.coins; profile.embers += ember;
      for (const id of things) { gain(id); if (!profile.found.includes(id)) profile.found.push(id); }
      if (from && from.area) profile.cleared = Object.assign({}, profile.cleared, { [from.area]: true });
      profile.level = Progress.levelFor(profile.xp);
      const woke = before < G.fuse.level && profile.level >= G.fuse.level;
      const saved = save();
      return { pay: Object.assign({}, pay, { ember }), replay: !!replay, level: profile.level, levelled: profile.level > before, crucible_woke: woke, saved };
    },
    // (design pass 36, build 27) a bout on the Arena's sand brought home: its XP as the page worked it out (spec/arena.json xp: a win by
    // mode, a loss a quarter, the house's knights a few a day), paid once by the run's id; nothing is cleared, no coins, no ember. The
    // bench's world service has no route for it: it is paid on the phone either way
    async arena(a, from) {
      if (from && !Progress.rememberRun(profile, from.id)) return { again: true, pay: { xp: 0, coins: 0, ember: 0, ember_chances: [] }, level: profile.level, levelled: false, crucible_woke: false };
      const before = profile.level, xp = Math.max(0, Math.min(1000, a.xp | 0));
      profile.xp += xp;
      profile.level = Progress.levelFor(profile.xp);
      const woke = before < G.fuse.level && profile.level >= G.fuse.level;
      const saved = save();
      return { pay: { xp, coins: 0, ember: 0, ember_chances: [] }, replay: false, level: profile.level, levelled: profile.level > before, crucible_woke: woke, saved, arena: { mode: a.mode, win: !!a.win, house: !!a.house } };
    },
    // a run that did not clear (design pass 12 section 3.11.5): its things (ingredients the Forge knows, never a weapon) go into the
    // stock and profile.found, and nothing is paid; `from` ({ id }) banks it once, remembered in profile.runs in the same save; the
    // service's POST /bank does the same
    async bank(things, from) {
      if (svc.url) {
        const { code, body } = await api("POST", "/bank", Object.assign({ player: svc.player, things }, from ? { run_id: from.id } : {}));
        if (code === 200) { await refreshProfile(); for (const id of body.banked || []) if (world.has(id)) gain(id); return body; }
        return null;
      }
      if (from && !Progress.rememberRun(profile, from.id)) return { ok: true, again: true, banked: [] };
      const banked = things.filter(id => world.has(id) && !F.isWeapon(world.get(id)));
      for (const id of banked) { gain(id); if (!profile.found.includes(id)) profile.found.push(id); }
      const saved = save();
      return { ok: true, banked, saved };
    },
    async buy(id, n) {
      if (svc.url) {
        const { code, body } = await api("POST", "/buy", { player: svc.player, id, n });
        if (code === 200) { await refreshProfile(); if (id === "all-elements") { for (const e of SHOP.bundles[0].items) gain(e, n); } else gain(id, n); }
        return { ok: code === 200, cost: body.cost, reason: body.reason };
      }
      const [ok, cost, reason] = Coin.buy(id, n, SHOP, profile, profile.found);   // (the Legend Ember is refused here: it is never sold)
      if (!ok) return { ok, cost, reason };
      profile.coins -= cost;
      if (id === "all-elements") { for (const e of SHOP.bundles[0].items) gain(e, n); }
      else gain(id, n);
      save();
      return { ok: true, cost };
    },
    // (build 17, design pass 24 section 4.8) Vorn's stall: one class taken up, on the house while a pick waits, else for its group's
    // coins (Coin.arm; the service's POST /arm). The class weapon joins the things; a class paid for joins profile.bought
    async arm(cls) {
      const t = classWeaponOf(cls);
      if (svc.url) {
        const { code, body } = await api("POST", "/arm", { player: svc.player, class: cls });
        if (code === 200) { await refreshProfile(); if (t && !own.has(t.id)) gain(t.id); }
        return { ok: code === 200, free: !!body.free, cost: body.cost | 0, reason: body.reason };
      }
      const r = Coin.arm(cls, SHOP, profile);
      if (!r.ok) return r;
      profile.classes = profile.classes.concat([cls]);
      if (!r.free) { profile.coins -= r.cost; profile.bought = (Array.isArray(profile.bought) ? profile.bought : []).concat([cls]); }
      if (t) { gain(t.id); if (!profile.found.includes(t.id)) profile.found.push(t.id); }
      profile.picks = Progress.picksLeft(profile);
      save();
      return { ok: true, free: r.free, cost: r.cost };
    },
    // (build 17, design pass 24 section 4.9) the well: the day's coins once a calendar day (Coin.daily; the service's POST /daily).
    // `today` is the phone's local date, YYYY-MM-DD
    async daily(today) {
      if (svc.url) {
        const { code, body } = await api("POST", "/daily", { player: svc.player, today });
        if (code === 200) await refreshProfile();
        return { ok: code === 200, coins: body.coins | 0, reason: body.reason };
      }
      const r = Coin.daily(profile, today, SHOP);
      if (!r.ok) return r;
      profile.coins += r.coins; profile.daily = { last: today };
      save();
      return { ok: true, coins: r.coins };
    },
    async pick(classes) {
      if (svc.url) {
        const { code, body } = await api("POST", "/pick", { player: svc.player, classes });
        if (code === 200) await refreshProfile();
        return { ok: code === 200, reason: body.reason };
      }
      profile.classes = profile.classes.concat(classes.filter(c => !profile.classes.includes(c)));
      profile.picks = Progress.picksLeft(profile);
      save();
      return { ok: true };
    },
    async kinds() {
      if (svc.url) {
        try { const { code, body } = await api("GET", "/kinds"); if (code === 200) { kinds.length = 0; for (const k of body.kinds) kinds.push(k); } } catch (e) { /* keep the cache */ }
      }
      return kinds;
    }
  };

  // ---- the world of one: the page's own rows settle firsts here
  function names() { return Array.from(world.values()).map(t => t.name); }
  function uniqueId(base) { let id = base, i = 2; while (world.has(id)) id = base + "-" + (i++); return id; }
  function countFirst(thing, kind) {
    const f = profile.firsts;
    if (F.isWeapon(thing)) { if (!f.weapons.includes(thing.id)) f.weapons.push(thing.id); if (classOf(thing) === "legendary" && !f.legends.includes(thing.id)) f.legends.push(thing.id); }
    else if (!f.ingredients.includes(thing.id)) f.ingredients.push(thing.id);
    if (kind && !profile.kinds.includes(kind.id)) profile.kinds.push(kind.id);
    if (!profile.found.includes(thing.id)) profile.found.push(thing.id);
  }
  // (build 24) with defer, a first is not counted here: the claim carries what it founded, and the world's answer counts it (applyAnswers)
  const deferred = (c, defer, founded) => { if (defer && c && c.status === "first") c.deferred = { founded: founded ? founded.id : null }; return c; };
  function localForge(left, right, station, pendingClaim, defer) {
    const [kase, base, added] = F.roles(left, right, station);
    if (kase === "fuse") { const why = F.fuseCheck(base, added, G); if (why) return { error: why, status: "refused" }; }
    const key = F.keyText(kase, base.id, added.id);
    const pair = (kase === "mix" || base.id === added.id) ? [base.id, added.id].sort() : [base.id, added.id];
    const row = rows.get(key);
    const at = nowIso();
    if (row) {
      const thing = row.thing || world.get(row.linked_to);
      let status = Discovery.status(row, thing, profile.id);
      if (status === "first") { thing.discovery = { first: profile.id, at, novel: true }; if (!defer) countFirst(thing); }
      return deferred(claimOf(thing, status, row, kase, pair, "ledger"), defer, null);
    }
    const tier = F.resultTier(kase, base, added, G);
    let kind = kase === "fuse" ? kinds.find(k => k.key === F.kindKey(base, added)) || null : null;
    const draft = F.combine(kase, base, added, tier, G, kind);
    const [v] = F.validate(draft, tier, G, [], [base, added], kase, { kind });
    const twin = F.isWeapon(v) ? Discovery.twinOf(v, world.values()) : null;
    const dupe = Array.from(world.values()).find(t => t.name.toLowerCase() === v.name.toLowerCase());
    const linkTo = twin || (dupe && F.linkOk(dupe, v) ? dupe : null);
    if (linkTo) {
      const lrow = { key, pair, thing: null, linked_to: linkTo.id, at, player: profile.id, case: kase, link: twin ? "twin" : "name" };
      rows.set(key, lrow);
      return claimOf(linkTo, "rediscovered", lrow, kase, pair, "combiner:" + lrow.link);
    }
    v.id = uniqueId(v.id);
    v.discovery = { first: profile.id, at, novel: true };
    v.oracle = { model: null, backend: "local", route: null, grammar: G.version, rules: 2, provisional: true, notes: pendingClaim ? ["pending: the world could not be reached"] : ["the Combiner's draft: this page is a world of one"] };
    v.why = "";
    let founded = null;
    if (kase === "fuse") {
      if (!kind) {
        const name = cap(F.bodyClass(base)) + "-" + cap(F.bodyClass(added));
        kind = { key: F.kindKey(base, added), classes: [F.bodyClass(base), F.bodyClass(added)], id: uniqueId(F.slug(name)), name, line: "A " + F.bodyClass(base) + "'s body carrying a " + F.bodyClass(added) + "'s head.", first: profile.id, at, thing: v.id, oracle: { model: null, provisional: true } };
        kinds.push(kind); founded = kind;
      }
      v.hybrid.kind = kind.id;
      v.naming = { status: "open", by: null, at: null, oracle_name: v.name, terms: null, check: null };
      if (!profile.unnamed.includes(v.id)) profile.unnamed.push(v.id);
    }
    world.set(v.id, v);
    const nrow = { key, pair, thing: v, at, player: profile.id, case: kase };
    rows.set(key, nrow);
    if (!defer) countFirst(v, founded);
    return deferred(claimOf(v, pendingClaim ? "pending" : "first", nrow, kase, pair, "combiner", kind, founded), defer, founded);
  }
  // ---- the Roll of First Forges (design pass 29 with its revision 1, build 24): on the online copy the world decides every first
  // rollOn: only where the cloud is (the Pages copy with its switch); everywhere else the world of one forges exactly as before.
  // rollMem is the queue of claims the world has not answered yet, kept in the save beside Grycus's and the folk's memory (so another
  // phone of the same player carries it too): { v, queue: [{ recipe, id, forged, founded }] }, at most 1000; v is set once the
  // save's old firsts (from before build 24) have been queued
  const rollOn = () => !!(window.Roll && Roll.on());
  let rollMem = { queue: [] };
  function rollMemory(saved, fresh) {
    const m = { queue: [] };
    if (saved && typeof saved === "object") {
      if (saved.v !== undefined) m.v = saved.v | 0;
      for (const e of (Array.isArray(saved.queue) ? saved.queue : [])) if (e && typeof e.recipe === "string" && typeof e.id === "string" && world.has(e.id) && !m.queue.some(x => x.recipe === e.recipe)) m.queue.push({ recipe: e.recipe, id: e.id, forged: typeof e.forged === "string" ? e.forged : null, founded: typeof e.founded === "string" ? e.founded : null });
      m.queue = m.queue.slice(0, 1000);
    }
    if (fresh) m.v = 1;
    return m;
  }
  const queued = recipe => rollMem.queue.some(e => e.recipe === recipe);
  function enqueue(e) { if (queued(e.recipe) || rollMem.queue.length >= 1000) return false; rollMem.queue.push(e); return true; }
  // settleForge(c, …): a forge's claim settled by the world, during the forging's own 2.67 s (2.5 s at most): the world's first gets the
  // banner and the ★; another knight's recipe is known, their twin is rediscovered; no answer in time is pending, and the entry waits in
  // the queue for the next settle
  async function settleForge(c, left, right, station) {
    if (c.status === "pending") { if (!queued(c.key)) c.status = "known"; return c; }   // (re-forging your own draft: the world has it, or still waits on it)
    if (c.status !== "first" || !c.key) return c;
    const thing = c.thing, entry = { recipe: c.key, id: thing.id, forged: c.at || nowIso(), founded: c.deferred && c.deferred.founded ? c.deferred.founded : null };
    enqueue(entry); save();
    const st = window.Cloud ? Cloud.status : "off", erasing = !!(window.Cloud && Cloud.readSync && Cloud.readSync().erase);
    if ((st === "online" || st === "starting") && !erasing) {
      const r = await Roll.claim([Roll.wire(entry, thing, F)].filter(Boolean), 2500);
      if (r.ok) {
        applyAnswers(r.results, { quiet: true });
        const a = (r.results || []).find(x => x.recipe === entry.recipe);
        const got = a ? a.status : null;
        if (got === "first" || got === "mine") { c.status = "first"; c.provisional = false; }
        else if (got === "known") c.status = "known";
        else if (got === "twin") c.status = "rediscovered";
        else { c.status = "pending"; c.provisional = true; }
        c.first = (thing.discovery || {}).first; c.at = (thing.discovery || {}).at;
        if (c.status !== "pending") { setTimeout(() => { settleQueue(); }, 0); return c; }
        return c;
      }
    }
    c.status = "pending"; c.provisional = true;
    return c;
  }
  // yieldFirst(thing, r): the world gave this thing's first to another knight: the plaque names them, the ★ lets it go, a naming closes
  function yieldFirst(thing, r) {
    const who = r.first || {};
    thing.discovery = { first: who.id || "someone", by: who.name || null, at: r.at || (thing.discovery || {}).at || null, world: true };
    const f = profile.firsts; for (const k of ["weapons", "legends", "ingredients"]) if (Array.isArray(f[k])) f[k] = f[k].filter(id => id !== thing.id);
    profile.unnamed = (profile.unnamed || []).filter(id => id !== thing.id);
    if (thing.naming && thing.naming.status === "open") thing.naming = Object.assign({}, thing.naming, { status: "closed" });
  }
  // applyAnswers(results, o): each answer takes its entry out of the queue; first and mine count the thing as the world's first, known
  // and twin yield it; bad is dropped; anything else (retry) stays queued. Returns what was spoken, for the toast
  function applyAnswers(results, o) {
    o = o || {};
    const spoken = [];
    for (const r of (results || [])) {
      if (!r || typeof r.recipe !== "string") continue;
      const i = rollMem.queue.findIndex(e => e.recipe === r.recipe); if (i < 0) continue;
      const e = rollMem.queue[i];
      if (r.status === "bad") { rollMem.queue.splice(i, 1); (window.__errors || []).push("roll: a claim the world refused, " + r.recipe); continue; }
      if (!["first", "mine", "known", "twin"].includes(r.status)) continue;
      rollMem.queue.splice(i, 1);
      const thing = world.get(e.id); if (!thing) continue;
      if (r.status === "first" || r.status === "mine") {
        const kind = e.founded ? kinds.find(k => k.id === e.founded) || null : null;
        countFirst(thing, kind);
        thing.discovery = Object.assign({}, thing.discovery || {}, { first: profile.id, at: r.at || (thing.discovery || {}).at || nowIso(), world: true });
        spoken.push({ name: thing.name, mine: true });
      } else { yieldFirst(thing, r); spoken.push({ name: thing.name, mine: false, by: r.first && r.first.name }); }
    }
    save(); renderSign();
    if (!o.quiet && spoken.length) sayRoll(spoken);
    return spoken;
  }
  // the one toast for what the world said (pass 3's words); while a plaque is up it waits for the plaque to close
  function sayRoll(spoken) {
    if (!spoken.length) return;
    let line;
    if (spoken.length === 1) line = spoken[0].mine ? `The forge has spoken: ${spoken[0].name}. First forged by you.` : `The forge has spoken: ${spoken[0].name}, first forged by ${spoken[0].by || "another knight"} while you were away.`;
    else { const n = spoken.filter(x => x.mine).length; line = `The forge has spoken on ${spoken.length} things: ${n === 0 ? "none are your firsts" : n === spoken.length ? "all are your firsts" : n === 1 ? "1 is your first" : n + " are your firsts"}.`; }
    if (plaqueOpen()) owed.spoken = line; else toast(line);
  }
  // settleQueue(): the queue goes 50 at a time while the phone is online and no erase waits; one run at a time; a failed batch stops the
  // run until the next trigger (boot, back online, back to the page, into the yard, the Roll opened, a forge answered)
  let settling = null;
  function settleQueue() {
    if (settling) return settling;
    if (!rollOn() || !rollMem.queue.length || !window.Cloud) return Promise.resolve(false);
    if (Cloud.status !== "online" || (Cloud.readSync && Cloud.readSync().erase)) return Promise.resolve(false);
    settling = (async () => {
      let spoken = [], went = true;
      try {
        for (let guard = 0; guard < 40 && rollMem.queue.length; guard++) {
          rollMem.queue = rollMem.queue.filter(e => world.has(e.id));
          const batch = rollMem.queue.slice(0, 50), claims = batch.map(e => Roll.wire(e, world.get(e.id), F)).filter(Boolean);
          if (!claims.length) break;
          const n0 = rollMem.queue.length;
          const r = await Roll.claim(claims, 8000);
          if (!r.ok) { went = false; break; }
          spoken = spoken.concat(applyAnswers(r.results, { quiet: true }));
          if (rollMem.queue.length >= n0) break;   // (nothing settled: the rest waits for the next trigger)
        }
      } catch (e) { (window.__errors || []).push("roll: " + (e && e.message || e)); went = false; }
      finally { settling = null; }
      if (spoken.length) sayRoll(spoken);
      return went;
    })();
    return settling;
  }
  // settleOld(): a save from before build 24 claims its old firsts once, oldest first (its rows' keys are their recipes); they keep
  // counting meanwhile, and only a known or twin answer takes one off the ★
  function settleOld() {
    if (!rollOn() || rollMem.v !== undefined) return false;
    const old = [];
    for (const [k, r] of rows) { if (ledgerRows.has(k) || !r || !r.thing) continue; const d = r.thing.discovery || {}; if (d.first !== profile.id || d.world) continue; if (!world.has(r.thing.id)) continue; const kind = r.thing.hybrid && r.thing.hybrid.kind ? kinds.find(x => x.id === r.thing.hybrid.kind) : null; old.push({ recipe: k, id: r.thing.id, forged: typeof d.at === "string" ? d.at : null, founded: kind && kind.first === profile.id && kind.thing === r.thing.id ? kind.id : null }); }
    old.sort((a, b) => (a.forged || "") < (b.forged || "") ? -1 : (a.forged || "") > (b.forged || "") ? 1 : 0);
    for (const e of old) enqueue(e);
    rollMem.v = 1; save();
    return old.length;
  }
  function claimOf(thing, status, row, kase, pair, source, kind, founded) {
    const d = thing.discovery || {};
    const k = kind || (thing.hybrid && thing.hybrid.kind ? kinds.find(x => x.id === thing.hybrid.kind) : null) || null;
    return { thing, status, first: d.first, at: d.at, provisional: !!(thing.oracle && thing.oracle.provisional), case: kase, key: row.key || null, pair, source, kind: k, naming: thing.naming || null, notes: [], kind_founded: !!founded };
  }
  function localName(thingId, name) {
    const t = world.get(thingId);
    if (!t || classOf(t) !== "legendary") return { code: 403, body: { ok: false, reason: "Only a legend can be named", code: "not_allowed" } };
    if ((t.discovery || {}).first !== profile.id) return { code: 403, body: { ok: false, reason: "Only the first smith names a legend", code: "not_allowed" } };
    if (!t.naming || t.naming.status !== "open") return { code: 403, body: { ok: false, reason: "This legend's name is decided", code: "not_allowed" } };
    if (!((profile.terms || {}).naming || {}).version) return { code: 428, body: { ok: false, reason: "Accept the Smith's Naming Terms first", code: "terms", terms_required: TERMS.version } };
    const taken = Naming.takenNames(world.values(), G, kinds);
    const r = Naming.checkName(name, t, taken, G, FILTER);
    if (r.code === "keep") return World.keep(thingId);
    if (!r.ok) return { code: 400, body: { ok: false, reason: r.reason, code: r.code } };
    t.naming = { status: "named", by: profile.id, at: nowIso(), oracle_name: t.naming.oracle_name || t.name, terms: TERMS.version, check: { model: null, category: "ok", rules_only: true, backend: "local" } };
    t.name = r.name;
    profile.unnamed = (profile.unnamed || []).filter(id => id !== thingId);
    save();
    return { code: 200, body: { ok: true, thing: { id: t.id, name: t.name, naming: t.naming }, name: t.name, oracle_name: t.naming.oracle_name, rules_only: true } };
  }

  // ------------------------------------------------------------------ where a thing lives
  function storeOf(t) {
    const tags = t.tags || [], h = t.hints || {};
    if (tags.some(x => x.startsWith("creature:"))) return "Trophies";
    if (tags.includes("curio")) return "Curios";
    if (isForged(t)) return h.element ? "Elements" : h.material ? "Materials" : "Curios";
    if (tags.some(x => x.startsWith("element:")) && !tags.some(x => x.startsWith("material:"))) return "Elements";
    return "Materials";
  }
  const STORES = ["Elements", "Materials", "Trophies", "Curios"];
  function owned(filter) { const out = []; for (const [id, o] of own) { const t = world.get(id); if (t && filter(t)) out.push(t); } return out; }
  function racks() {
    const by = new Map();
    for (const t of owned(t => F.isWeapon(t))) { const c = classOf(t); if (!by.has(c)) by.set(c, []); by.get(c).push(t); }
    return Array.from(by.entries()).map(([c, list]) => ({ c, list, first: Math.min(...list.map(t => own.get(t.id).seq)) }))
      .sort((x, y) => y.list.length - x.list.length || x.first - y.first);
  }
  function consume(ids) {
    for (const id of ids) {
      const t = world.get(id);
      if (!t) continue;
      if (isClassWeapon(t) && classOpen(classOf(t))) continue;
      const o = own.get(id);
      if (!o) continue;
      o.n = Math.max(0, o.n - 1);
      if (o.n === 0 && F.isWeapon(t)) own.delete(id);
    }
  }

  // ------------------------------------------------------------------ the sign bar
  // where the player stands (design pass 19 section 3.4.4): the Lv chip's title, its label and the toast a tap on it shows
  function levelLine() {
    const L = Progress.levelFor(profile.xp);
    if (L >= Progress.MAX_LEVEL) return `Lv ${L} · Champion of the Forge`;
    if (typeof Progress.xpToNext !== "function") return `Lv ${L}`;   // (an older progress.js still cached)
    return `Lv ${L} · ${(profile.xp - Progress.xpForLevel(L)).toLocaleString()} of ${Progress.xpToNext(L).toLocaleString()} XP to Lv ${L + 1}`;
  }
  // a forge's XP by the rules (0 with an older progress.js still cached: the forge itself must never fail for it)
  function forgePay(o) { try { return Progress.forgeXp(o) | 0; } catch (e) { return 0; } }
  // what stands on the anvil or in the molds must be in hand: an ingredient or a forged weapon the player holds at least one of (one
  // weapon may sit in both slots, as always), a class weapon of an open rack always. Returns the first thing that is not, or null.
  // Without this a plaque closed by the cog left the used-up things on the anvil, and Strike forged them again from nothing
  function notInHand(ids) { for (const id of ids) { const t = world.get(id); if (!t || !own.has(id) || have(id) < 1) return t || { id, name: id }; } return null; }
  // "+N XP" rising into the Lv chip when a forge pays (section 3.4.1); under less motion it stands in place for 1.2 s. The amount is
  // what the forge added to the profile, so it reads the same with the world service; nothing for a forge that paid nothing
  let riseTimer = null;
  function xpRise(n) {
    const el = $("xpRise");
    if (!el || !(n > 0)) return;
    el.textContent = `+${n.toLocaleString()} XP`;
    el.classList.remove("go", "hold"); void el.offsetWidth;
    el.classList.add(reduce ? "hold" : "go");
    clearTimeout(riseTimer); riseTimer = setTimeout(() => el.classList.remove("go", "hold"), reduce ? 1200 : 950);
    window.TheForge.rises.push(el.textContent);
  }
  // what a forge or a pour paid (section 3.4): the rise as the plaque comes up; a level gained waits for the plaque to close (afterPlaque);
  // the first forge in a visit that paid nothing because two weapons made a thing already had says why, once, after the shelf toast
  const NO_PAY_LINE = "Two weapons pay XP only for something new";
  const owed = { level: null, why: false, hold: false, spoken: null };
  function forgePaid(xpBefore, levelBefore, guarded) {
    const paid = profile.xp - xpBefore;
    xpRise(paid);
    if (profile.level > levelBefore) owed.level = { before: levelBefore };
    if (paid <= 0 && guarded && !session.noPayToastShown) owed.why = true;
    return paid;
  }
  // the plaque has closed: the level-up runs once the closing tap's own work is done (so its "Level N" is the toast that stays, and the
  // racks to open and the Crucible's wake come with it), and the why-line follows the shelf toast by 1.8 s
  function afterPlaque() {
    if (owed.hold) return;   // (Settings is opening over the page: what is owed waits until it closes)
    const up = !!owed.level;
    if (owed.level) { const up = owed.level; owed.level = null; Promise.resolve().then(() => afterLevelChange(up.before, null)); }
    if (owed.why) { owed.why = false; session.noPayToastShown = true; setTimeout(() => toast(NO_PAY_LINE), 1800); }
    if (owed.spoken) { const m = owed.spoken; owed.spoken = null; setTimeout(() => toast(m), up ? 1800 : 0); }   // (build 24: the world's word on earlier forges, after any level-up)
  }
  function renderSign() {
    profile.level = Progress.levelFor(profile.xp);
    const next = profile.level < 50 ? Progress.xpForLevel(profile.level + 1) : profile.xp, prev = Progress.xpForLevel(profile.level);
    $("lvl").textContent = "Lv " + profile.level;
    $("xpbar").style.width = (profile.level >= 50 ? 100 : Math.round(100 * (profile.xp - prev) / Math.max(1, next - prev))) + "%";
    $("chipLevel").title = levelLine(); $("chipLevel").setAttribute("aria-label", levelLine());
    $("coins").textContent = profile.coins.toLocaleString();
    const n = profile.firsts.weapons.length;
    $("firsts").textContent = n;
    $("chipFirsts").setAttribute("aria-label", `${n} weapon${n === 1 ? "" : "s"} you forged first in the world`);
    $("chipFirsts").title = svc.url ? "Weapons you forged first in the world" : "Firsts in this page's world";
    const awake = Progress.crucibleAwake(profile, G);
    $("chipEmbers").hidden = !awake;
    $("embers").textContent = profile.embers;
    $("title").textContent = profile.level >= 50 ? "Champion of the Forge" : "";
    $("stCruc").classList.toggle("dim", !awake);
    $("stCrucLv").hidden = awake;
    if (room.crucible !== (awake ? "lit" : "cold")) room.setCrucible(awake ? "lit" : "cold");
    profile.picks = Progress.picksLeft(profile);   // (build 17: the picks are Vorn's, in the courtyard; the Weapons tab has no badge)
    if (!awake && state.station === "crucible") setStation("anvil");
  }

  // ------------------------------------------------------------------ the stations
  // the room is as wide as the screen (design pass 14): the smithy is 112 world pixels high and W wide, W from 232 to 320, so the room
  // fills the pane sideways; the station (the hearth, the anvil, the bellows, the barrel) stays centred and the doors keep to the walls
  // (W_MIN keeps the Armory's door clear of the quench barrel; STATION is the least of the room the open view shows: the hood and the
  // anvil, so with the walls open the station fills the pane's height on any screen a phone has)
  const ROOM_H = 112, W_MIN = 232, W_MAX = 320, STATION = 76;
  let roomW = W_MIN;
  let room = Smithy.mount($("scene"), { w: roomW, h: ROOM_H, wide: true, yard: !noyard, crucible: "cold", still: reduce });   // (build 17: yard: the door out and the Rack; the old walls under ?noyard=1 or without the yard's modules)
  // mount the smithy again at the width W, keeping the crucible's mode and the fire's heat; the old room's loop is stopped first so two
  // fires never draw into one canvas, and the forging's overlay is sized with the scene
  function mountRoom(W) {
    const mode = room ? room.crucible : "cold", heat = room ? room.heat : 0;
    if (room) room.stop = true;
    room = Smithy.mount($("scene"), { w: W, h: ROOM_H, wide: true, yard: !noyard, crucible: mode, still: reduce });
    room.heat = heat; roomW = W; room.figure = gryFigure; room.redraw();   // (the new room draws him at once, also when still)
    const fx = $("forgeFx"); if (fx) { fx.width = W; fx.height = ROOM_H; }
    renderPegs();
    return room;
  }
  function setMotion(still) {
    reduce = !!still;
    document.documentElement.classList.toggle("still", reduce || params.get("harness") === "1");
    mountRoom(roomW);
  }

  // ------------------------------------------------------------------ Grycus, the smith (design pass 17 with its revision 1, build 6)
  // He stands by the bellows (Grycus.place, drawn into the room by the smithy's figure layer: gryFigure), breathes and twitches on the
  // room's clock, leans in at a Strike and, from the cut to the close-up, is drawn at the anvil by forge-fx.js instead. He speaks in
  // #grySay: his first meeting, a greeting, the way up from the cellar, the Crucible's waking, a tap, and a word after a forge by the
  // rate rule (Grycus.after). His memory (gry.mem) is saved with the player's save. Without grycus.js nothing here does anything.
  const GRY = window.Grycus || null;
  const gry = { mem: GRY ? GRY.memory(null) : null, pose: "idle", since: Date.now(), loops: Infinity, queue: [], timer: 0, openTimer: 0, seq: null, pending: null, spot: null, line: null };
  const IDLE_MS = GRY ? GRY.MS.idle.reduce((a, b) => a + b, 0) : 2160;
  // the frame the room draws now: none in the close-up, with the walls open or in the Armory; else his pose, its loops, then idle with a
  // cane tap every seventh loop, a glint every fourth, a twitch toward the anvil every fifth
  function gryFigure(ms) {
    if (!GRY || !gry.spot) return null;
    if ($("lens").classList.contains("near") || state.wallsOpen || state.room !== "forge") return null;
    const p = gry.spot, at = (pose, i) => ({ px: GRY.frame(pose, i).px, n: GRY.N, x: p.x, y: p.y });
    if (reduce) return at(gry.pose, 0);
    if (gry.pose !== "idle") {
      const a = GRY.at(gry.pose, ms - gry.since, gry.loops);
      if (!a.done) return at(gry.pose, a.i);
      gryNext(); if (gry.pose !== "idle") return at(gry.pose, 0);
    }
    const t = Math.max(0, ms - gry.since), k = Math.floor(t / IDLE_MS), r = t % IDLE_MS, beat = k % 7 === 6 ? "tap" : k % 4 === 3 ? "glint" : k % 5 === 1 ? "twitch" : null;
    if (beat) { const b = GRY.at(beat, r, 1); if (!b.done) return at(beat, b.i); }
    return at("idle", GRY.at("idle", r).i);
  }
  function gryPose(name, loops) { gry.pose = name; gry.since = Date.now(); gry.loops = loops === undefined ? 1 : loops; if (reduce && room && room.redraw) room.redraw(); }
  function gryNext() { const n = gry.queue.shift(); if (n) gryPose(n[0], n[1]); else gryPose("idle", Infinity); }
  // where he stands (Grycus.place), measured against where the showing station's first slot begins, and his button and bubble over him
  function gryPlace() {
    const b = $("grycus"), say = $("grySay"), lens = $("lens"), el = $("room");
    if (!GRY || !b || !say || !lens.offsetWidth) return;
    const k = lens.offsetWidth / roomW, cruc = state.station === "crucible";
    const wrap = ($(cruc ? "moldA" : "slotA") || {}).parentElement, plate = $(cruc ? "plateMA" : "plateA");
    const from = n0 => { let v = { x: 0, y: 0 }; for (let n = n0; n && n !== el; n = n.offsetParent) { v.x += n.offsetLeft; v.y += n.offsetTop; } return v; };
    let slotLeft, plateTop = Infinity;
    if (wrap && wrap.offsetParent) slotLeft = (from(wrap).x - lens.offsetLeft) / k;
    if (plate && plate.offsetParent) plateTop = from(plate).y - lens.offsetTop;
    const p = gry.spot = GRY.place(roomW, slotLeft), pct = (v, of) => (100 * v / of).toFixed(3) + "%";
    b.hidden = false;
    b.style.left = pct(p.box.x0, roomW); b.style.width = pct(p.box.x1 - p.box.x0 + 1, roomW); b.style.top = pct(p.box.y0, ROOM_H); b.style.height = pct(p.box.y1 - p.box.y0 + 1, ROOM_H);
    // the bubble's foot over his head, or over the slots' plates if they stand higher (a short room): never over a plate or a slot
    say.style.left = pct(p.head.x, roomW); say.style.top = Math.min(p.box.y0 * k - 2, plateTop - 4) + "px";
    say.style.maxWidth = Math.min(240, el.clientWidth * 0.46) + "px";
    say.classList.toggle("short", el.clientHeight < 260);
    if (room) { room.figure = gryFigure; if (room.redraw) room.redraw(); }
  }
  // something stands over the room, or he is out of sight: he holds his tongue (build 8: and while the lessons run, the lesson is his word)
  function gryQuiet() { return state.forging || state.pouring || state.wallsOpen || state.room !== "forge" || session.leaving || plaqueOpen() || plankOpen() || !$("setPlank").hidden || !$("firstWeapon").hidden || !$("unlockPlaque").hidden || drillOpen() || lessonOn("quiet") === true; }
  function gryShow(text, ms, then) {
    const say = $("grySay"); $("gryLine").textContent = text; say.hidden = false; gry.line = text;
    say.classList.remove("pop"); void say.offsetWidth; if (!reduce) say.classList.add("pop");
    clearTimeout(gry.timer); gry.timer = setTimeout(() => { if (then) then(); else gryHide(); }, ms);
  }
  // (the bubble gone, he goes back to idle from the line's poses; under less motion the figure never walks the queue, so this ends them)
  function gryHide() { $("grySay").hidden = true; gry.line = null; clearTimeout(gry.timer); if (gry.pose !== "idle" && gry.pose !== "watch") { gry.queue = []; gryPose("idle", Infinity); } }
  function gryHush() { if (!GRY) return; gry.seq = null; gry.queue = []; clearTimeout(gry.openTimer); gryHide(); if (gry.pose !== "idle" && gry.pose !== "watch") gryPose("idle", Infinity); }
  // the next line of a pool, said in its reaction pose and then talking; then (if given) runs when the line has been held
  function grySay(pool, then) {
    if (!GRY || !pool) return false;
    const r = GRY.line(gry.mem, pool, null, nowIso()); gry.mem = r.mem; save();
    if (!r.text) return false;
    const react = GRY.REACT[pool], pre = react ? GRY.MS[react].reduce((a, b) => a + b, 0) : 0;
    gry.queue = (react ? [[react, 1]] : []).concat([["talk", 2]]); gryNext();
    gryShow(r.text, pre + GRY.holdFor(r.text), then);
    return true;
  }
  // his first meeting: the three meet lines in a row, each moving on after its time or a tap on him
  function gryMeet() { gry.seq = 0; gryMeetNext(); }
  function gryMeetNext() {
    if (gry.seq === null) return;
    if (gry.seq >= 3 || gryQuiet()) { gry.seq = null; gryHide(); return; }
    gry.seq++; grySay("meet", gryMeetNext);
  }
  function gryTap() {
    if (!GRY || state.forging || state.pouring) return;
    if (gry.seq !== null) gryMeetNext();
    else if (!$("grySay").hidden) gryHide();
    else grySay("tap");
  }
  // on opening the Forge (and after the first weapon is taken, and back from the cellar by the back gesture): what he says first, when
  // nothing stands over the room (he waits up to a minute for a plank to close)
  function gryOpen(fromCellar) {
    if (!GRY) return;
    clearTimeout(gry.openTimer);
    const go = tries => {
      if (gryQuiet()) { if (tries > 0) gry.openTimer = setTimeout(() => go(tries - 1), 1000); return; }
      const pool = GRY.opening(gry.mem, { now: Date.now(), fromCellar: !!fromCellar, crucibleAwake: Progress.crucibleAwake(profile, G) });
      if (pool === "meet") gryMeet(); else if (pool) grySay(pool);
    };
    gry.openTimer = setTimeout(() => go(60), 900);
  }
  // after a forge or a pour: which pool he will answer from when the plaque is continued (the count moves now)
  function gryAfter(o) { if (!GRY) return null; const a = GRY.after(gry.mem, o); gry.mem = a.mem; gry.pending = a.trigger; return a.trigger; }
  function gryRemark(delay) { const pool = gry.pending; gry.pending = null; if (!pool) return; setTimeout(() => { if (!gryQuiet()) grySay(pool); }, delay); }
  if (GRY) $("grycus").addEventListener("click", e => { e.stopPropagation(); gryTap(); });
  try { for (const cv of document.querySelectorAll("canvas[data-glyph]")) Smithy.glyph(cv, cv.getAttribute("data-glyph"), 1); } catch (e) { /* the plates stand without their glyphs */ }
  // the room fills its pane (design pass 14 section 3.3). Walls shut: as tall as the pane leaves after the state and price lines, and as
  // wide as the pane, the smithy mounted at the width that makes it so (re-mounted only when that width changes, never during a forge
  // or a pour). Walls open: the same height, the smithy kept at its width and cut to the left pane, centred on the anvil: the station,
  // without the doors. The door buttons are laid over the doors from the scene's boxes, in % of the lens, so they stay on their doors
  // at every width; a scene without a box (an old smithy.js) leaves its button hidden
  function fitRoom() {
    const pane = $("roompane"), el = $("room"), lens = $("lens");
    if (!pane.clientWidth || !pane.clientHeight) return window.TheForge && window.TheForge.layout;
    const rest = $("state").offsetHeight + ($("price").hidden ? 0 : $("price").offsetHeight);
    const boxW = pane.clientWidth, boxH = Math.max(60, pane.clientHeight - rest);
    let s;
    if (!state.wallsOpen) {
      s = Math.min(boxH / ROOM_H, boxW / W_MIN);
      const W = Math.max(W_MIN, Math.min(W_MAX, 2 * Math.ceil(boxW / s / 2)));
      if (W !== roomW && !state.forging && !state.pouring) mountRoom(W);
    } else s = Math.min(boxH / ROOM_H, boxW / STATION);
    const lw = roomW * s, lh = ROOM_H * s, bw = Math.min(boxW, lw);
    el.style.width = bw + "px"; el.style.height = lh + "px";
    lens.style.width = lw + "px"; lens.style.height = lh + "px"; lens.style.left = (bw - lw) / 2 + "px";
    const sc = room.scene, pct = (v, of) => (100 * v / of).toFixed(3) + "%", castle = !!sc.handsRack;
    // (build 17) the castle's Forge: the door out on the left and the Rack on the right; the old graph (no yard) keeps the cellar's arch
    // and the Armory's door. Whichever pair the scene lacks stays hidden
    for (const [id, d] of [["outDoor", castle ? sc.door : null], ["rackDoor", castle ? sc.rack : null], ["cellarDoor", castle ? null : sc.door], ["armoryDoor", castle ? null : sc.armory]]) {
      const b = $(id); if (!b) continue;
      b.hidden = !d; if (!d) continue;
      b.style.left = pct(d.x0 - 1, roomW); b.style.width = pct(d.x1 - d.x0 + 3, roomW); b.style.top = pct(d.y0, ROOM_H); b.style.height = pct(d.y1 - d.y0 + 1, ROOM_H);
    }
    renderPegs();
    gryPlace();
    const view = bw / s;
    window.TheForge.layout = { paneW: pane.clientWidth, paneH: pane.clientHeight, roomW: el.clientWidth, roomH: el.clientHeight, W: roomW, s, view: [roomW / 2 - view / 2, roomW / 2 + view / 2], turned: turn.turned, plate: turn.plate };
    return window.TheForge.layout;
  }
  // landscape only (design pass 11 amendment 9): the cellar's rules. A phone held upright sees the turn plate; My screen won't turn
  // (the shared switch) lays the frame out at height x width and turns it a quarter; a fine pointer never sees the plate
  const coarse = params.get("pointer") ? params.get("pointer") === "coarse" : !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
  const viewport = () => { const vv = window.visualViewport; return { w: Math.max(1, Math.round(vv ? vv.width : window.innerWidth)), h: Math.max(1, Math.round(vv ? vv.height : window.innerHeight)) }; };
  // the phone's safe-area insets as the game sees them (design pass 30: #probe's padding is the four game insets, turned with the frame)
  function insets() { const p = $("probe"); if (!p) return { t: 0, r: 0, b: 0, l: 0 }; const cs = window.getComputedStyle(p), n = v => parseFloat(v) || 0; return { t: n(cs.paddingTop), r: n(cs.paddingRight), b: n(cs.paddingBottom), l: n(cs.paddingLeft) }; }
  function fitTurn() {
    const v = viewport(), portrait = v.h > v.w, el = $("phone");
    turn.turned = turn.forced && portrait;   // forced landscape only turns a viewport that is upright
    if (turn.turned) { el.style.width = v.h + "px"; el.style.height = v.w + "px"; el.style.transform = "translateX(" + v.w + "px) rotate(90deg)"; }
    else { el.style.width = ""; el.style.height = ""; el.style.transform = ""; }
    el.classList.toggle("forced", turn.turned);
    turn.plate = portrait && coarse && !turn.forced;
    turn.v = v;   // (build 17: toGame turns a viewport point back when the frame is turned)
    $("turnPlate").hidden = !turn.plate;
    $("tFull").hidden = !(document.documentElement.requestFullscreen && screen.orientation && screen.orientation.lock);
    const fitted = fitRoom();
    fitArmory(); fitPlaque();   // (function declarations below: the Armory's hall at the room's scale, and an open plaque refitted to its card)
    fitYard(); fitMap();   // (build 17: the Courtyard's view and the Map Table's, whichever room shows)
    return fitted;
  }
  function lockLandscape() { try { const o = screen.orientation; if (o && o.lock) { const p = o.lock("landscape"); if (p && p.catch) p.catch(() => {}); } } catch (e) { /* this browser doesn't lock */ } }
  function setForced(on) { turn.forced = !!on; if (window.Settings && Settings.isOn("forced") !== turn.forced) Settings.setOn("forced", turn.forced); fitTurn(); if (settings) settings.render(); }
  $("tForce").addEventListener("click", () => setForced(true));
  $("tFull").addEventListener("click", () => { try { const p = document.documentElement.requestFullscreen(); if (p && p.then) p.then(lockLandscape).catch(() => {}); } catch (e) { /* this browser doesn't go full screen */ } });
  $("tHome").addEventListener("click", () => goHome());
  (function () { const cv = $("turnPhone"); try { Smithy.drawTurnPhone(cv, false); } catch (e) { return; } let sw = false; setInterval(() => { if ($("turnPlate").hidden || reduce) return; sw = !sw; Smithy.drawTurnPhone(cv, sw); }, 1000); })();
  // sideways, the anvil is the whole screen: the walls pane opens on the right when a slot asks to be filled, and closes when the
  // second slot is filled, when Strike or Pour falls, or by its ✕ (design pass 11, amendment 8)
  function openWalls(why) {
    if (why === "pick") state.picking = true;
    if (state.wallsOpen) return;
    gryHush();
    state.wallsOpen = true;
    $("app").classList.add("open");
    fitRoom();
    if (state.view === "cabinet") renderCabinet();   // (the shelf's columns were counted while it was hidden)
  }
  function closeWalls() {
    state.picking = false;
    if (!state.wallsOpen) return;
    state.wallsOpen = false;
    $("app").classList.remove("open");
    fitRoom();
  }
  $("wallsClose").addEventListener("click", closeWalls);
  function setStation(s) {
    if (s === "crucible" && !Progress.crucibleAwake(profile, G)) { toast("The Crucible wakes at level 25. It melts two rare weapons into a legend."); return; }
    if (state.forging || state.pouring) return;
    state.station = s;
    $("stAnvil").setAttribute("aria-pressed", String(s === "anvil"));
    $("stCruc").setAttribute("aria-pressed", String(s === "crucible"));
    $("anvilSlots").hidden = s !== "anvil";
    $("crucSlots").hidden = s !== "crucible";
    $("price").hidden = s !== "crucible";
    $("tabMaterials").hidden = s === "crucible";
    if (s === "crucible" && state.tab !== "weapons") setTab("weapons");
    closePlaque();
    renderSign(); renderSlots();
    if (state.view === "wall") renderWall(); else renderCabinet();
    fitRoom();
  }
  $("stAnvil").addEventListener("click", () => setStation("anvil"));
  $("stCruc").addEventListener("click", () => setStation("crucible"));
  // the two doors (design pass 14 section 3.4): the cellar's goes down, the Armory's goes through into the Armory's own room (design
  // pass 15); neither while forging or pouring
  $("cellarDoor").addEventListener("click", () => { if (state.forging || state.pouring) return; goDown(null); });   // (the old graph only)
  $("armoryDoor").addEventListener("click", () => openArmory("armory"));   // (the old graph only)
  // (build 17, design pass 24 section 4.10) the door out to the courtyard, and the Rack of the two hands
  $("outDoor").addEventListener("click", () => { if (state.forging || state.pouring) return; enter("yard", { at: "forge" }); });
  $("rackDoor").addEventListener("click", () => { if (state.forging || state.pouring) return; openFolk("rack"); });

  function forecast() {
    const st = $("state");
    st.classList.remove("warn");
    if (state.station === "crucible") return forecastCrucible();
    const A = state.a ? world.get(state.a) : null, B = state.b ? world.get(state.b) : null;
    if (!A && !B) return "Put two things on the anvil";
    if (A && !B) return F.isWeapon(A) ? `${A.name} is the base · one more` : "One more · add a weapon to make a weapon";
    if (!A && B) return F.isWeapon(B) ? `${B.name} is the base · one more` : "One more · add a weapon to make a weapon";
    const [kase, base, added] = F.roles(A, B);
    const key = F.keyText(kase, base.id, added.id);
    const known = session.revealed.has(key) ? resultOf(key) : null;
    const tail = known ? "You've forged this: " + known.name : "New to you";
    let line;
    if (kase === "mix") line = `${base.name} + ${added.name} make an ingredient, not a weapon`;
    else if (kase === "apply") line = `${base.name} + ${added.name} · ${tail}`;
    else if (base.id === added.id) line = `${base.name} twice: a double`;
    else {
      const gl = F.gifts(base, added, G);
      if (!gl.length) { st.classList.add("warn"); line = `The ${added.name} has nothing new to give the ${base.name} · ${tail}`; }
      else line = `${base.name} takes a gift from the ${added.name} · ${tail}`;
    }
    if (kase === "gift" && Progress.crucibleAwake(profile, G) && !F.fuseCheck(A, B, G) && classOpen(classOf(A)) && classOpen(classOf(B)) && base.id !== added.id) line += " · the Crucible can fuse them";
    return line;
  }
  function forecastCrucible() {
    const A = state.ma ? world.get(state.ma) : null, B = state.mb ? world.get(state.mb) : null;
    $("price").textContent = "";
    if (!A && !B) return "Put two weapons in the molds";
    if (A && !B) return `${A.name} is the body · one more`;
    if (!A && B) return `${B.name} is the head · put a body in the base mold`;
    const why = Crucible.crucibleCheck(A, B, profile, G, true);
    if (why) return why;
    const key = F.keyText("fuse", A.id, B.id);
    const known = session.revealed.has(key) ? resultOf(key) : null;
    const ab = AB[F.bodyClass(B)];   // the head's class gives the legend its ability (design pass 10 section 3.5.6)
    $("price").textContent = `Uses ${A.name}, ${B.name} and one Legend Ember.`;
    return `${cap(F.bodyClass(A))} body, ${cap(F.bodyClass(B))} head · ${FORM_LOW[A.weapon.form]} · ✦ ${ab ? ab.name : "an ability"} · ${known ? "You've forged this: " + known.name : "New to you"}`;
  }
  function resultOf(key) { const r = rows.get(key); return r ? (r.thing || world.get(r.linked_to)) : null; }

  function renderSlots() {
    if (state.station === "anvil") {
      const A = state.a ? world.get(state.a) : null, B = state.b ? world.get(state.b) : null;
      for (const [el, t, label] of [[$("slotA"), A, "Base slot"], [$("slotB"), B, "Second slot"]]) {
        el.innerHTML = "";
        if (t) { el.appendChild(sprite(t, 2)); el.insertAdjacentHTML("beforeend", `<span class="l"></span>`); el.lastChild.textContent = t.name; el.setAttribute("aria-label", `${t.name}, tap to take it off the anvil`); }
        else { el.innerHTML = '<span class="e">EMPTY</span>'; el.setAttribute("aria-label", label); }
      }
      const both = A && B;
      const kase = both ? F.roles(A, B)[0] : null;
      $("plateA").textContent = "Base"; $("plateB").textContent = kase === "gift" ? "Gift" : "Add";
      $("plateA").classList.toggle("lit", !!(A && F.isWeapon(A)) || (!!B && !A && F.isWeapon(B)));
      $("plateB").classList.toggle("lit", !!both);
      $("swap").hidden = !(both && kase === "gift" && A.id !== B.id);
      $("strike").disabled = !both || state.forging;
      if (!state.forging) $("state").textContent = forecast();
    } else {
      const A = state.ma ? world.get(state.ma) : null, B = state.mb ? world.get(state.mb) : null;
      for (const [el, t, label] of [[$("moldA"), A, "Base mold"], [$("moldB"), B, "Fuse mold"]]) {
        el.innerHTML = "";
        if (t) { el.appendChild(sprite(t, 2)); el.insertAdjacentHTML("beforeend", `<span class="l"></span>`); el.lastChild.textContent = t.name; el.setAttribute("aria-label", `${t.name}, tap to take it out of the mold`); }
        else { el.innerHTML = '<span class="e">EMPTY</span>'; el.setAttribute("aria-label", label); }
      }
      $("plateMA").classList.toggle("lit", !!A); $("plateMB").classList.toggle("lit", !!B);
      const ready = !!(A && B) && !Crucible.crucibleCheck(A, B, profile, G, true);
      $("swapM").hidden = !(A && B);
      $("socket").textContent = "Legend Ember ×" + profile.embers;
      $("socket").classList.toggle("glow", ready);
      $("pour").disabled = !ready || state.pouring;
      if (!state.pouring) $("state").textContent = forecast();
    }
  }
  function pick(id) {
    if (state.forging || state.pouring) return;
    const t = world.get(id);
    if (!t) return;
    if (t.kind !== "weapon" && have(id) === 0) { toast(`You're out of ${t.name}`); return; }
    if (state.station === "crucible") {
      if (!F.isWeapon(t)) return;
      const why = fuseWhy(t);
      if (why) { toast(why); return; }
      if (!state.ma) state.ma = id; else if (!state.mb) state.mb = id; else { state.ma = id; state.mb = null; }
      const which = state.mb === id ? $("moldB") : $("moldA"); which.classList.remove("pulse"); void which.offsetWidth; which.classList.add("pulse");
      closePlaque(); renderSlots();
      if (state.ma && state.mb && state.view === "cabinet") closeCabinet(); else if (state.view === "cabinet") drawShelves(true);
      if (state.ma && state.mb) closeWalls();
      return;
    }
    if (!state.a) state.a = id; else if (!state.b) state.b = id; else { state.a = id; state.b = null; }
    // the slide: a lone weapon goes to the left
    let slid = false;
    if (state.a && state.b) {
      const A = world.get(state.a), B = world.get(state.b);
      if (!F.isWeapon(A) && F.isWeapon(B)) { state.a = B.id; state.b = A.id; slid = true; }
    }
    const which = state.b === id && !slid ? $("slotB") : $("slotA");
    which.classList.remove("pulse"); which.classList.remove("slide"); void which.offsetWidth; which.classList.add(slid ? "slide" : "pulse");
    lessonOn("picked", id);   // (build 17: the lessons' f.pick, Fire onto the anvil)
    if (slid && !session.slideToastShown) { session.slideToastShown = true; toast("The weapon is the base: it goes on the left"); }
    closePlaque(); renderSlots();
    if (state.a && state.b && state.view === "cabinet") closeCabinet(); else if (state.view === "cabinet") drawShelves(true);
    if (state.a && state.b) closeWalls();
  }
  function fuseWhy(t) {
    // why a weapon is dim on the Crucible's wall: gates 3, 4, 6 and, with a mold filled, 5
    if (t.hybrid) return F.FUSE_LINES.legend(t.name);
    if (t.tier < G.fuse.min_tier) return F.FUSE_LINES.tier(t.name, TIER[String(t.tier)]);
    if (!classOpen(classOf(t))) return Crucible.CRUCIBLE_LINES.locked(classOf(t));
    const other = state.ma && !state.mb ? world.get(state.ma) : null;
    if (other && F.bodyClass(other) === F.bodyClass(t)) return F.FUSE_LINES.same(F.bodyClass(t));
    return null;
  }
  function swap() {
    if (state.forging || state.pouring) return;
    if (state.station === "anvil") { const t = state.a; state.a = state.b; state.b = t; }
    else { const t = state.ma; state.ma = state.mb; state.mb = t; }
    renderSlots();
  }
  $("slotA").addEventListener("click", () => { if (state.forging) return; state.a = state.b; state.b = null; renderSlots(); openWalls("pick"); });
  $("slotB").addEventListener("click", () => { if (state.forging) return; state.b = null; renderSlots(); openWalls("pick"); });
  $("moldA").addEventListener("click", () => { if (state.pouring) return; state.ma = state.mb; state.mb = null; renderSlots(); openWalls("pick"); });
  $("moldB").addEventListener("click", () => { if (state.pouring) return; state.mb = null; renderSlots(); openWalls("pick"); });
  $("swap").addEventListener("click", swap);
  $("swapM").addEventListener("click", swap);
  // where Legend Embers come from (design pass 10 revision 1): the empty socket, and the Crucible's wake, say so; the Trader has none
  const EMBER_WHERE = "Legend Embers drop from bosses, chests and rare enemies in the Battlegrounds";
  $("socket").addEventListener("click", () => { if (profile.embers === 0) toast("No Legend Ember. " + EMBER_WHERE); });

  function sparks(n, cols) {
    const box = $("sparks"); box.innerHTML = "";
    for (let i = 0; i < n; i++) { const s = document.createElement("i"); s.style.background = cols[i % cols.length];
      const ang = -Math.PI * (0.1 + 0.8 * ((i * 37) % n) / n), r = 30 + (i % 4) * 16;
      s.style.setProperty("--dx", Math.cos(ang) * r + "px"); s.style.setProperty("--dy", Math.sin(ang) * r + "px"); s.style.animationDelay = (i % 3) * 0.5 + "s"; box.appendChild(s); }
  }

  // ------------------------------------------------------------------ the anvil: STRIKE (design pass 10's forging, in pass 14's wide room)
  // Strike closes the plaque and the walls, measures where each thing's sprite sits in its slot (in the smithy's pixels), hides the
  // slots, the tabs and the doors (.room.seq) and starts the overlay's run (forge-fx.js): both things fly into the hearth, the lens
  // cuts to 2x, the hammer beats the billet until the world answers, the result comes out of the last blow, then the plaque. A
  // landing puts .hit on the app for one beat; a pointerdown on the room skips to the result once the world has answered; a failed
  // forge cools the billet and puts both things back, nothing consumed before the answer. Without forge-fx.js (the guard is
  // window.ForgeFx) Strike waits as build 1 did and shows the plaque.
  let run = null;   // the forging's run on the overlay; null between forges
  // the sprite's centre in the room's layout box (offsets, so a frame turned a quarter measures the same), then the sprite's top-left
  // in the lens's own pixels
  function slotFrom(el) {
    const c = el.querySelector("canvas") || el, lens = $("lens"), stop = $("room");
    let x = c.offsetWidth / 2, y = c.offsetHeight / 2;
    for (let n = c; n && n !== stop; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
    const k = lens.offsetWidth / roomW;
    return [Math.round((x - lens.offsetLeft) / k - 16), Math.round((y - lens.offsetTop) / k - 16)];
  }
  function endForging() { if (run) { run.stop(); run = null; } $("room").classList.remove("seq"); if (gry.pose === "watch") gryPose("idle", Infinity); }
  function hitRoom() { const a = $("app"); a.classList.remove("hit"); void a.offsetWidth; a.classList.add("hit"); setTimeout(() => a.classList.remove("hit"), ForgeFx.BEAT); }
  async function forge() {
    if (!state.a || !state.b || state.forging || state.station !== "anvil") return;
    const A = world.get(state.a), B = world.get(state.b);
    { const gone = notInHand([state.a, state.b]);   // (build 12) nothing is forged from a thing no longer in hand
      if (gone) { if (state.a === gone.id) state.a = null; if (state.b === gone.id) state.b = null; renderSlots(); toast(`You're out of ${gone.name}`); return; } }
    closePlaque(); if (state.room === "armory") closeArmory(); closeWalls();   // (the walls close first, and the room re-lays out at once, so the slots are measured where the player saw them)
    const hadClass = new Set(racks().map(r => r.c));
    const FX = window.ForgeFx;
    const from = FX ? [slotFrom($("slotA")), slotFrom($("slotB"))] : null;
    state.forging = true; renderSlots();
    lessonOn("strike");   // (build 8) the lessons' F5 ends: the forging plays with no veil and no words
    gryHush(); gryPose("watch", Infinity);   // he leans in by the bellows; from the cut forge-fx draws him at the anvil
    if (FX) {
      $("room").classList.add("seq");
      $("state").textContent = reduce ? "Grycus swings…" : "Into the fire…";
      run = FX.start({ canvas: $("forgeFx"), lens: $("lens"), room, from, things: [A, B], reduce, W: roomW,
        onPhase: ph => { if (ph === "blow") $("state").textContent = "Grycus swings…"; }, onStrike: hitRoom });
    } else { room.heat = 1; $("state").textContent = "Grycus swings…"; }
    const think = setTimeout(() => { if (state.forging) $("state").textContent = "The fire is thinking…"; }, 3000);
    const wait = FX ? null : new Promise(res => setTimeout(res, reduce ? 300 : 1500));
    // (build 12, design pass 19) the forge's XP: what the player had ever held is read before the forge adds its result to `found`
    const xp0 = profile.xp, lv0 = Progress.levelFor(profile.xp), hadBefore = new Set(profile.found), twoWeapons = F.isWeapon(A) && F.isWeapon(B);
    const claim = await World.forge(A.id, B.id, "anvil");
    clearTimeout(think);
    if (!claim || claim.error) {
      if (run) { run.fail(); await run.done; }
      endForging(); state.forging = false;
      toast(claim ? claim.error : "The forge failed"); renderSlots();
      gryAfter({ failed: true }); gryRemark(600);
      lessonOn("failed");   // (build 8) a lesson's forge that failed goes back to Strike
      return;
    }
    if (run) {
      run.answer(claim.thing, claim.status === "first");
      if (params.get("hold") === "1") return claim;   // (the harness's pictures only: ?hold=1 leaves the run to TheForge.run.hold(ms); nothing is consumed)
      await run.done;
    } else await wait;
    state.forging = false;
    const thing = claim.thing;
    const [kase, base, added] = F.roles(A, B);
    const key = F.keyText(kase, base.id, added.id);
    session.revealed.add(key);
    gryAfter({ status: claim.status, tier: claim.thing.tier, weapon: F.isWeapon(claim.thing) });   // (saved with the forge below)
    // in the world of one the forge pays here, in its own save: by the rarity of what it made, when it used up an ingredient or made
    // something the player never had; two weapons into a thing already had pay nothing (with a service, POST /forge paid by the same rule)
    if (!svc.url) {
      consume([A.id, B.id]); gain(thing.id); if (!profile.found.includes(thing.id)) profile.found.push(thing.id);
      profile.xp += forgePay({ tier: thing.tier, usesUp: !twoWeapons, isNew: !hadBefore.has(thing.id) });
      save();
    }
    else gain(thing.id);
    profile.level = Progress.levelFor(profile.xp);
    session.lastClaim = claim;
    const cls = classOf(thing);
    claim.newRack = !!(cls && !hadClass.has(cls));
    showPlaque(claim, base, added);
    claim.xp = forgePaid(xp0, lv0, twoWeapons && claim.status !== "pending");
    if (claim.newRack) { toast("A new rack goes up: " + plural(cls)); state.glow = cls; }
    $("state").textContent = claim.status === "pending" ? "Pending: the world will settle it" : claim.status === "first" ? "First forged" : claim.status === "rediscovered" ? "Already in the world" : "A known recipe";
    renderSign();
    if (state.view === "wall") renderWall(); else renderCabinet();
    renderArmory(); renderInfo();
    return claim;
  }
  $("room").addEventListener("pointerdown", () => { if (run) run.skip(); });   // a tap on the room cuts to the result once the world has answered
  $("strike").addEventListener("click", forge);

  // ------------------------------------------------------------------ the Crucible: POUR (hold one second)
  function startHold(e) {
    if ($("pour").disabled || state.pouring) return;
    if (session.assistTap) { confirmPour(); return; }
    if (state.hold) return;
    $("pour").classList.add("holding");
    state.hold = setTimeout(() => { state.hold = null; $("pour").classList.remove("holding"); pour(); }, reduce ? 300 : 1000);
    $("state").textContent = "Keep holding to pour";
  }
  function endHold() {
    if (!state.hold) return;
    clearTimeout(state.hold); state.hold = null;
    $("pour").classList.remove("holding");
    if (!state.pouring) renderSlots();
  }
  $("pour").addEventListener("pointerdown", e => { e.preventDefault(); startHold(e); });
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) $("pour").addEventListener(ev, endHold);
  $("pour").addEventListener("keydown", e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (!$("pour").disabled && !state.pouring) confirmPour(); } });
  $("pour").addEventListener("click", e => { if (session.assistTap && !state.pouring && !$("pour").disabled && !e.detail) confirmPour(); });
  function confirmPour() {
    plank($("confirmPlank"), `<h3>Pour the Crucible?</h3><div class="body">Both weapons and one Legend Ember are used up.</div><div class="pbtns"><button class="f-ember primary" id="cpYes">Pour</button><button class="f-iron" id="cpNo">Not yet</button></div>`);
    $("cpYes").addEventListener("click", () => { $("confirmPlank").hidden = true; pour(); });
    $("cpNo").addEventListener("click", () => { $("confirmPlank").hidden = true; });
  }
  const PHASES = [["melt", 2000, "The metal melts…"], ["pourm", 1500, "It pours…"], ["quench", 1000, "Quenched in a burst of steam…"], ["crack", 1500, "The mold cracks…"]];
  async function pour() {
    if (state.station !== "crucible" || state.pouring || !state.ma || !state.mb) return;
    const A = world.get(state.ma), B = world.get(state.mb);
    if (Crucible.crucibleCheck(A, B, profile, G, true)) { renderSlots(); return; }
    { const gone = notInHand([state.ma, state.mb]);   // (build 12) nor poured from a weapon no longer in hand
      if (gone) { if (state.ma === gone.id) state.ma = null; if (state.mb === gone.id) state.mb = null; renderSlots(); toast(`You no longer have ${gone.name}`); return; } }
    state.pouring = true; closePlaque(); renderSlots();
    closeWalls();
    gryHush(); gryPose("watch", Infinity);
    $("pour").disabled = true;
    $("phone").classList.add("pouring"); room.heat = 1;
    sparks(16, ["#fee761", "#f77622", "#ffffff", "#fff6c8"]);
    const molds = [$("moldA"), $("moldB")];
    const xp0 = profile.xp, lv0 = Progress.levelFor(profile.xp);   // (build 12) a pour uses up a Legend Ember, so it always pays, by the legend's rarity
    const answer = World.forge(A.id, B.id, "crucible");
    for (const [cls, ms, line] of PHASES) {
      $("state").textContent = line;
      for (const m of molds) m.classList.add(cls);
      if (cls === "quench") $("phone").classList.add("quench");
      await new Promise(res => setTimeout(res, reduce ? 120 : ms));
      if (cls === "quench") $("phone").classList.remove("quench");
    }
    for (const m of molds) for (const [cls] of PHASES) m.classList.remove(cls);
    $("state").textContent = "The metal is cooling…";
    let claim = null;
    const timeout = new Promise(res => setTimeout(() => res({ timeout: true }), 45000));
    claim = await Promise.race([answer, timeout]);
    $("phone").classList.remove("pouring");
    state.pouring = false;
    gryPose("idle", Infinity);
    if (!claim || claim.error || claim.timeout) {
      toast(claim && claim.error ? claim.error : "The Crucible needs the world: connect to fuse");
      renderSlots(); return;
    }
    const thing = claim.thing;
    session.revealed.add(F.keyText("fuse", A.id, B.id));
    gryAfter({ pour: true });
    if (!svc.url) {
      consume([A.id, B.id]); profile.embers = Math.max(0, profile.embers - G.fuse.embers); gain(thing.id); if (!profile.found.includes(thing.id)) profile.found.push(thing.id);
      profile.xp += forgePay({ tier: thing.tier, usesUp: true, isNew: true });
      save();
    }
    else gain(thing.id);
    profile.level = Progress.levelFor(profile.xp);
    session.lastClaim = claim;
    state.ma = null; state.mb = null;
    const hadLegends = racks().some(r => r.c === "legendary");
    showLegend(claim, A, B);
    claim.xp = forgePaid(xp0, lv0, false);
    if (claim.status === "first") { $("phone").classList.add("burst"); sparks(22, ["#feae34", "#fee761", "#ffffff"]); setTimeout(() => $("phone").classList.remove("burst"), 1600); }
    if (!hadLegends) { state.glow = "legendary"; toast("The Legendary rack takes its first legend"); }
    $("state").textContent = claim.status === "pending" ? "Pending: the world will settle it" : claim.status === "first" ? "First forged" : "A known legend";
    renderSign(); renderSlots();
    if (state.view === "wall") renderWall(); else renderCabinet();
    renderArmory(); renderInfo();
    return claim;
  }

  // ------------------------------------------------------------------ the plaques (design pass 10 section 3.3, a static card since pass 15)
  // What is left says what the weapon is, how rare it is (the band), what it's made of (the recipe), what it does (the traits in words;
  // a legend's Strike and Ability rows), how strong it is (the stats), who made it first (the discovery line) and what to do next (TAP
  // ANYWHERE TO CONTINUE). No flavour, no meta line, no gift or base line, no PROVISIONAL stamp, no "Why the Oracle chose this".
  // The card never scrolls (design pass 15): the icon and its band, the words, and the stats stand in three columns over the buttons,
  // the discovery line and TAP ANYWHERE, and fitPlaque makes the card hold them at any size of screen.
  function fmtDate(iso) { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); }
  function recipeLine(t) {
    const p = t.parents || [];
    if (p.length !== 2) return "";
    const a = world.get(p[0]) || { name: p[0] }, b = world.get(p[1]) || { name: p[1] };
    const kase = t.hybrid && t.gift === null && p.every(id => { const x = world.get(id); return x && !x.hybrid; }) && t.weapon && t.weapon.visual.fuse ? "fuse" : t.gift ? "gift" : "apply";
    return `${a.name} ${CASE_SIGN[kase]} ${b.name}`;
  }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  // the rarity band (section 3.3.2) under the icon: one of six colours, the word in it
  const tierClass = t => "r" + Math.max(1, Math.min(6, t.tier | 0));
  function rarityHTML(t) { return `<span class="rarity ${tierClass(t)}">${esc(TIER[t.tier] || "")}</span>`; }
  // the traits line (section 3.3.3): the form, the element, the statuses and the modifiers in words; a legend shows its element and
  // modifiers only (its statuses are on the Strike and Ability rows); an ingredient says what it gives
  function traitLine(t, legend) {
    const w = t.weapon;
    if (!w) { const g = hintText(t); return "An ingredient" + (g !== "nothing yet" ? " · gives " + g : ""); }
    if (legend === undefined) legend = !!headOf(t);
    return [legend ? null : (FORM_VERB[w.form] || cap(w.form)), w.element && w.element !== "physical" ? cap(w.element) : null,
      ...(legend ? [] : (w.status || []).map(x => STATUS_WORD[x] || cap(x))), ...(w.modifiers || []).map(m => MOD_WORD[m] || cap(m.replace(/_/g, " ")))].filter(Boolean).join(" · ");
  }
  // the discovery line (section 3.3.3), one quiet line at the foot: a first or a known pair, a re-discovery, a pending claim; opened
  // from the Armory, a weapon no longer held says so
  function discHTML(claim, t, view) {
    const d = t.discovery || {}, who = d.first === profile.id ? "you" : (d.by || d.first || "someone");   // (build 24: the world's answer names the knight)
    let line;
    if (claim.status === "pending") line = "Pending · the world will settle it when you're back online";
    else if (claim.status === "rediscovered") line = `Already in the world · first forged by <b>${esc(who)}</b>`;
    else if (!isForged(t) && !d.first) line = "One of the twenty class weapons";
    else line = `First forged by <b>${esc(who)}</b>${d.at ? " · " + esc(fmtDate(d.at)) : ""}`;
    return line + (view && !own.has(t.id) ? " · <b>no longer held</b>" : "");
  }
  const TAP_ON = '<button type="button" class="tapon" id="tapOn">Tap anywhere to continue</button>';
  function equipLabel(t) { return session.equipped.includes(t.id) ? "Equipped" : Progress.canEquip(t, profile, G) ? "Equip" : "Chained"; }
  function equipBtnHTML(t) { return `<button class="f-iron" id="equipBtn" ${Progress.canEquip(t, profile, G) ? "" : "disabled"}>${equipLabel(t)}</button>`; }
  // the plaque's mode: "forge" (after Strike), "pour" (after the Crucible) or "view" (a weapon opened from the Armory: no banner, To the
  // anvil among the buttons, TAP ANYWHERE back to the Armory); and the thing on it
  let plaqueMode = null, plaqueThing = null;
  function bars(t) {
    const w = t.weapon; if (!w) return "";
    const uses = new Set([...G.forms[w.form].uses, ...(w.form2 ? G.forms[w.form2].uses : [])]);
    return `<div class="bars">${G.numbers.map(k => `<div class="bar ${uses.has(k) ? "" : "off"}"><span>${k}</span><span class="pips">${Array.from({ length: 10 }, (_, i) => `<i class="${i < w.numbers[k] ? "on" : ""}"></i>`).join("")}</span><span>${w.numbers[k]}</span></div>`).join("")}</div>`;
  }
  // the weapon plaque: after Strike (the First forged banner for every first, Equip · Share · Try it, or Apply on an ingredient), or
  // from the Armory in view mode (no banner; To the anvil · Equip · Share · Try it while held, Share alone once no longer held)
  function showPlaque(claim, base, added, o) {
    const t = claim.thing, p = $("plaque"), isIng = t.kind !== "weapon", view = !!(o && o.view), held = own.has(t.id);
    plaqueMode = view ? "view" : "forge"; plaqueThing = t;
    $("legendPlaque").hidden = true; $("legendPlaque").innerHTML = "";   // (one plaque holds the ids at a time: a hidden one would answer getElementById first)
    p.classList.toggle("view", view); p.classList.toggle("nostats", isIng);
    const btns = view
      ? (held ? `<div class="pbtns"><button class="f-ember primary" id="toAnvil">To the anvil</button>${equipBtnHTML(t)}<button class="f-iron" id="share">Share</button></div>${tryRow(t)}` : '<div class="pbtns"><button class="f-iron" id="share">Share</button></div>')
      : `<div class="pbtns">${isIng ? '<button class="f-ember primary" id="applyBtn">Apply to a weapon</button>' : equipBtnHTML(t)}<button class="f-iron" id="share">Share</button></div>${isIng ? "" : tryRow(t)}`;
    p.innerHTML = `${claim.status === "first" && !view ? '<div class="banners"><div class="banner f-ember">First forged</div></div>' : ""}
      <div class="side"><div class="art"></div>${rarityHTML(t)}</div>
      <div class="main"><h2></h2><div class="kindline">${esc(recipeLine(t) || (isIng ? "" : "A class weapon"))}</div><div class="traits">${esc(traitLine(t))}</div>
      ${isIng ? '<div class="line">An ingredient, not a weapon. Put it on the anvil beside a weapon to use it.</div>' : ""}</div>
      ${isIng ? "" : `<div class="stats">${bars(t)}</div>`}
      <div class="foot"><div class="btnrow">${btns}</div><div class="line disc">${discHTML(claim, t, view)}</div>${TAP_ON}</div>`;
    p.querySelector(".art").appendChild(sprite(t, 4));
    p.querySelector("h2").textContent = t.name;
    p.hidden = false;
    fitPlaque(p);
    $("tapOn").addEventListener("click", continueOn);
    const ta = $("toAnvil"); if (ta) ta.addEventListener("click", () => toAnvil(t));
    const eq = $("equipBtn"); if (eq) eq.addEventListener("click", () => equip(t, eq));
    const ap = $("applyBtn"); if (ap) ap.addEventListener("click", () => { closePlaque(); state.a = null; state.b = t.id; renderSlots(); setTab("weapons"); openWalls("pick"); toast("Pick a weapon for the base"); });
    $("share").addEventListener("click", () => share(t));
    const tr = $("tryBtn"); if (tr) tr.addEventListener("click", () => goDown(t.id));
    lessonOn("plaque", claim, view);   // (build 8) the lessons' F6: the plaque in lesson mode
  }
  function tryRow(t) { return `<button class="f-iron tryit" id="tryBtn">↓ Try it in the cellar${Progress.canEquip(t, profile, G) ? "" : "<small>practice only</small>"}</button>`; }
  // (forge rules 3) an ingredient's hinted forms are not said: it never changes how a weapon attacks
  function hintText(t) { const h = t.hints || {}; const bits = []; if (h.element) bits.push(h.element); bits.push(...(h.modifiers || [])); if (h.status) bits.push(h.status); if (h.visual_part) bits.push("a " + h.visual_part); if (h.material) bits.push(h.material); return bits.join(", ") || "nothing yet"; }
  // To the anvil (a weapon opened from the Armory, pass 10 section 3.4.2): back through the door to the Forge, the station is the
  // anvil, the anvil is emptied and this weapon goes on it as the base
  function toAnvil(t) { closePlaque(); closeArmory(); if (state.station !== "anvil") setStation("anvil"); state.a = null; state.b = null; pick(t.id); }
  function equip(t, btn) {
    if (!Progress.canEquip(t, profile, G)) { toast(classOf(t) === "legendary" ? "Legends can be wielded from level 25" : `The ${plural(classOf(t))} rack is chained: Vorn sells the class, in the courtyard`); return; }
    if (!session.equipped.includes(t.id)) { session.equipped.push(t.id); if (session.equipped.length > 2) session.equipped.shift(); }
    if (btn) btn.textContent = "Equipped"; save(); toast(`${t.name} goes to the Battlegrounds with you`);
  }
  // Share's text in the traits words (pass 10 section 3.3.5): "Emberbane (uncommon sword): slashes · fire · burns · burning ground · long reach. Forged from Sword + Fire. First forged by isaac. Forge Forever"
  function share(t) {
    const cls = classOf(t);
    const named = t.naming && t.naming.status === "named" ? ` Named by ${t.naming.by}.` : "";
    const txt = `${t.name} (${TIER[t.tier]} ${cls || "ingredient"}): ${traitLine(t, false).toLowerCase()}. ${recipeLine(t) ? "Forged from " + recipeLine(t) + "." : ""}${t.discovery && t.discovery.first ? " First forged by " + (t.discovery.first === profile.id ? (profile.name || "me") : (t.discovery.by || t.discovery.first)) + "." : ""}${named} Forge Forever`;
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => toast("Copied: " + txt), () => toast(txt)); else toast(txt);
  }
  // the static card (design pass 15): nothing in a plaque scrolls. Its sizes are multiples of --k, and its icon is --art screen pixels
  // to a sprite pixel. This tries the fits in order and keeps the first the card holds: everything full size with the icon at 4; the
  // icon at 3 with the letters stepping down to 0.8; then the icon at 2 with the letters from 0.95 down. A name too long for its line
  // takes a smaller letter (--kn) before it takes a second line. Called when a plaque opens, when a legend is renamed and whenever the
  // frame is laid out again; returns the k it settled on (null with no plaque open)
  const PLAQUE_FITS = [[1, 4], [1, 3], [0.95, 3], [0.9, 3], [0.85, 3], [0.8, 3]].concat([0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4].map(k => [k, 2]));
  function fitPlaque(p) {
    p = p || (!$("plaque").hidden ? $("plaque") : !$("legendPlaque").hidden ? $("legendPlaque") : null);
    if (!p || p.hidden || !p.clientHeight) return null;
    const h2 = p.querySelector("h2"), over = el => el.scrollWidth > el.clientWidth + 0.5;
    let fit = PLAQUE_FITS[PLAQUE_FITS.length - 1];
    for (const f of PLAQUE_FITS) {
      p.style.setProperty("--k", f[0]); p.style.setProperty("--art", f[1]);
      if (h2) {
        h2.style.whiteSpace = "nowrap";
        for (const kn of [1, 0.92, 0.84, 0.76]) { p.style.setProperty("--kn", kn); if (!over(h2)) break; }
        if (over(h2)) { h2.style.whiteSpace = ""; p.style.setProperty("--kn", 0.84); }
      }
      if (p.scrollHeight <= p.clientHeight + 0.5 && p.scrollWidth <= p.clientWidth + 0.5) { fit = f; break; }
    }
    p.dataset.k = String(fit[0]); p.dataset.art = String(fit[1]);
    return fit[0];
  }
  // closing the plaque (a tap anywhere, Apply, the station, the Armory, Settings) also ends the forging's overlay, unless a forge is running
  // (build 12) and what a paying forge left for after its plaque: the level-up, the line that says why a forge paid nothing
  function closePlaque() { const was = !$("plaque").hidden || !$("legendPlaque").hidden; $("plaque").hidden = true; $("legendPlaque").hidden = true; plaqueMode = null; plaqueThing = null; if (!state.forging) endForging(); if (was) afterPlaque(); }
  // Tap anywhere to continue: after a forge or a pour the plaque closes, the anvil empties, the new thing's shelf item is marked to glow
  // and a toast says where it hangs; from the Armory (view mode) the plaque closes back to the Armory as it was, its class still open.
  // Nothing while the terms, naming or confirm plank is open
  const plaqueOpen = () => !$("plaque").hidden || !$("legendPlaque").hidden;
  const plankOpen = () => !$("termsPlank").hidden || !$("namePlank").hidden || !$("confirmPlank").hidden;
  function continueOn() {
    if (!plaqueOpen() || plankOpen() || lessonOn("pinned")) return false;   // (build 8: the lessons' plaque waits for Try it in the cellar)
    const mode = plaqueMode, t = mode === "view" ? null : session.lastClaim && session.lastClaim.thing;
    closePlaque();
    if (mode === "view") return true;
    gryRemark(400);
    if (state.station === "anvil") { state.a = null; state.b = null; } else { state.ma = null; state.mb = null; }
    renderSlots();
    if (t && own.has(t.id)) { const cls = classOf(t); state.glowItem = t.id; state.sort = "newest"; toast(`${t.name} is on the ${cls ? plural(cls).toLowerCase() : storeOf(t).toLowerCase()} shelf`); }
    return true;
  }
  $("app").addEventListener("click", e => {
    if (!plaqueOpen() || plankOpen()) return;
    if (e.target.closest("#plaque button, #legendPlaque button, .plank-over, .overlay, .sign, #setPlank, input")) return;   // the buttons keep their jobs
    e.preventDefault(); e.stopPropagation();
    continueOn();
  }, true);
  window.addEventListener("keydown", e => {
    if ((e.key !== "Enter" && e.key !== "Escape") || !plaqueOpen() || plankOpen() || !$("setPlank").hidden || lessonOn("pinned")) return;   // (build 8: Enter presses the glowing Try it)
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
    e.preventDefault(); continueOn();
  });

  // what a legend's ability carries (pass 10 section 3.5.3): the legend's second status (its first when it has only one) and the
  // ability's own, two at most
  function abilityStatuses(t, ab) { const st = (t.weapon.status || []).slice(); const mine = st.length > 1 ? [st[1]] : st.slice(0, 1); if (ab && ab.status && !mine.includes(ab.status)) mine.push(ab.status); return mine.slice(0, 2); }
  // the legend plaque: the First forged banner and A new kind as they apply, the name and who named it, the kind line, the Strike row
  // (the body's form and first status) and the Ability row (the head's ability, its line and the carried status), the element and the
  // modifiers, the stats; Name it first while the name is open to this smith, after the pour and again from the Armory
  function showLegend(claim, A, B, o) {
    const t = claim.thing, w = t.weapon, p = $("legendPlaque"), view = !!(o && o.view), held = own.has(t.id);
    const kind = claim.kind || (t.hybrid && kinds.find(k => k.id === t.hybrid.kind)) || null;
    const founded = !view && !!kind && kind.first === profile.id && kind.thing === t.id && claim.status === "first";
    const canName = !!(t.naming && t.naming.status === "open" && (t.discovery || {}).first === profile.id && (view || claim.status === "first") && (!claim.provisional || !svc.url));
    plaqueMode = view ? "view" : "pour"; plaqueThing = t;
    $("plaque").hidden = true; $("plaque").innerHTML = "";
    p.classList.toggle("view", view); p.classList.remove("nostats");
    const [body, head] = t.hybrid.classes, ab = abilityOf(t);
    const abWords = ab ? abilityStatuses(t, ab).filter(x => x !== ab.status).map(x => (STATUS_WORD[x] || x).toLowerCase()) : [];
    const traits = traitLine(t, true);
    const btns = view && !held ? '<div class="pbtns"><button class="f-iron" id="share">Share</button></div>'
      : `<div class="pbtns">${canName ? '<button class="f-ember goldbtn" id="nameBtn">Name it</button>' : ""}${view ? '<button class="f-ember primary" id="toAnvil">To the anvil</button>' : ""}${equipBtnHTML(t)}<button class="f-iron" id="share">Share</button></div>${tryRow(t)}`;
    const banners = [claim.status === "first" && !view ? '<div class="banner f-ember">First forged</div>' : "", founded ? '<div class="banner f-ember kind">A new kind</div>' : ""].filter(Boolean);
    p.innerHTML = `${banners.length ? `<div class="banners">${banners.join("")}</div>` : ""}
      <div class="side"><div class="art"></div>${rarityHTML(t)}</div>
      <div class="main"><h2 id="legendName"></h2><div class="named" id="namedBy"></div>
      <div class="kindline">${kind ? "A " + esc(kind.name) : "A new kind"} · ${esc(cap(body))} ✦ ${esc(cap(head))}</div>
      <div class="moves"><div><b>Strike<small>${esc(body)}</small></b> <span>${esc(FORM_VERB[w.form] || cap(w.form))}${(w.status || [])[0] ? " · " + esc((STATUS_WORD[w.status[0]] || w.status[0]).toLowerCase()) : ""}</span></div>
        ${ab ? `<div><b>Ability<small>${esc(head)}</small></b> <span><em>✦ ${esc(ab.name)}</em> ${esc(ab.line)}${abWords.length ? " · " + esc(abWords.join(", ")) : ""}</span></div>` : ""}</div>
      ${traits ? `<div class="traits">${esc(traits)}</div>` : ""}</div>
      <div class="stats">${bars(t)}</div>
      <div class="foot"><div class="btnrow">${btns}</div><div class="line disc">${discHTML(claim, t, view)}</div>${TAP_ON}</div>`;
    p.querySelector(".art").appendChild(sprite(t, 4));
    $("legendName").textContent = t.name;
    renderNamedBy(t);
    p.hidden = false;
    fitPlaque(p);
    $("tapOn").addEventListener("click", continueOn);
    const ta = $("toAnvil"); if (ta) ta.addEventListener("click", () => toAnvil(t));
    const eb = $("equipBtn"); if (eb) eb.addEventListener("click", () => equip(t, eb));
    $("share").addEventListener("click", () => share(t));
    const nb = $("nameBtn"); if (nb) nb.addEventListener("click", () => openNaming(t));
    const tb = $("tryBtn"); if (tb) tb.addEventListener("click", () => goDown(t.id));
  }
  function renderNamedBy(t) {
    const el = $("namedBy"); if (!el) return;
    const n = t.naming;
    el.textContent = n && n.status === "named" ? (n.by === profile.id ? "Named by you" : "Named by " + n.by) : "";
  }

  // ------------------------------------------------------------------ naming: the terms plank, then the naming plank (pass 6)
  function plank(el, html) { el.innerHTML = html; el.hidden = false; }
  function termsAccepted() { return ((profile.terms || {}).naming || {}).version === TERMS.version; }
  function openNaming(t) {
    if (!termsAccepted()) { openTerms(() => openNamePlank(t)); return; }
    openNamePlank(t);
  }
  function openTerms(then) {
    const el = $("termsPlank");
    plank(el, `<h3>${esc(TERMS.title)}</h3><div class="terms"><p>${esc(TERMS.intro)}</p><ol>${TERMS.lines.map(([lead, text]) => `<li><b>${esc(lead)}</b> ${esc(text)}</li>`).join("")}</ol></div>
      <label class="tick"><input type="checkbox" id="termsTick"> ${esc(TERMS.accept_label)}</label>
      <div class="pbtns"><button class="f-ember primary" id="termsAccept" disabled>Accept</button><button class="f-iron" id="termsNo">Not now</button></div>`);
    $("termsTick").addEventListener("change", e => { $("termsAccept").disabled = !e.target.checked; });
    $("termsAccept").addEventListener("click", async () => { if (!$("termsTick").checked) return; const ok = await World.acceptTerms(); if (!ok) { toast("The world can't record the terms right now"); return; } el.hidden = true; then(); });
    $("termsNo").addEventListener("click", () => { el.hidden = true; toast("The offer stays open: Name it from the Armory when you're ready"); renderArmory(); });
  }
  function openNamePlank(t) {
    const el = $("namePlank");
    const oracleName = (t.naming && t.naming.oracle_name) || t.name;
    plank(el, `<h3>Name your legend</h3><div class="row"><div id="npArt"></div><div class="field f-stone"><input id="nameField" type="text" maxlength="40" autocomplete="off" spellcheck="false" aria-label="The legend's name"><span class="count" id="nameCount"></span></div></div>
      <div class="nline" id="nameLine">Letters, numbers, spaces, hyphens and apostrophes.</div>
      <div class="pbtns"><button class="f-ember primary" id="stamp">Stamp it</button><button class="f-iron" id="keepBtn">Keep the Oracle's name</button></div>`);
    $("npArt").appendChild(sprite(t, 2));
    const field = $("nameField"), line = $("nameLine"), stamp = $("stamp");
    field.value = oracleName;
    const taken = Naming.takenNames(world.values(), G, kinds);
    let checkResult = null;
    function live() {
      const v = field.value;
      $("nameCount").textContent = `${v.trim().replace(/\s+/g, " ").length} / ${G.name_rules.max_length}`;
      checkResult = Naming.checkName(v, t, taken, G, FILTER);
      line.classList.remove("bad");
      if (checkResult.code === "keep") { line.textContent = Naming.NAME_LINES.keep; stamp.disabled = true; }
      else if (!checkResult.ok) { line.textContent = checkResult.reason; line.classList.add("bad"); stamp.disabled = true; }
      else { line.textContent = svc.url ? "Letters, numbers, spaces, hyphens and apostrophes." : "Checked by the rules only: this page is a world of one"; stamp.disabled = false; }
    }
    field.addEventListener("input", live);
    field.addEventListener("keydown", e => { if (e.key === "Enter" && !stamp.disabled) stamp.click(); if (e.key === "Escape") el.hidden = true; });
    live();
    field.focus(); field.select();
    stamp.addEventListener("click", () => submitName(t, field.value));
    $("keepBtn").addEventListener("click", async () => { const r = await World.keep(t.id); if (r.code === 200) { el.hidden = true; toast("The Oracle's name stands: " + t.name); renderNamedBy(t); renderArmory(); renderSign(); } else toast(r.body.reason || "The world refused"); });
  }
  async function submitName(t, value) {
    const el = $("namePlank"), field = $("nameField"), line = $("nameLine"), stamp = $("stamp");
    if (!field || field.disabled) return;
    field.disabled = true; stamp.disabled = true; $("keepBtn").disabled = true;
    line.classList.remove("bad");
    line.innerHTML = svc.url ? '<span class="dot"></span>The world is checking the name…' : "Stamping…";
    const r = await World.name(t.id, value);
    field.disabled = false; $("keepBtn").disabled = false;
    if (r.code === 200) {
      el.hidden = true;
      if (r.body.naming && r.body.naming.status === "kept") { toast("The Oracle's name stands: " + t.name); }
      else {
        toast(`Named: ${t.name}. It carries your name for ever`);
        const h = $("legendName"); if (h) { h.textContent = t.name; fitPlaque(); h.classList.remove("relit"); void h.offsetWidth; h.classList.add("relit"); }
        $("phone").classList.add("burst"); sparks(18, ["#feae34", "#fee761", "#ffffff"]); setTimeout(() => $("phone").classList.remove("burst"), 1600);
      }
      renderNamedBy(t); fitPlaque(); renderSign(); renderArmory(); renderInfo();
      if (state.view === "cabinet") renderCabinet(); else renderWall();
      return r;
    }
    stamp.disabled = false;
    line.classList.add("bad");
    if (r.code === 503) line.textContent = "The world can't check names right now. Try again in a moment";
    else if (r.code === 429) { line.textContent = r.body.reason || "Five tries today: the Oracle's name stands for now"; stamp.disabled = true; field.disabled = true; }
    else if (r.code === 428) { el.hidden = true; openTerms(() => openNamePlank(t)); }
    else line.textContent = r.body.reason || "The world refused the name";
    return r;
  }

  // ------------------------------------------------------------------ the wall
  function rackButton(cls, list, opts) {
    const b = document.createElement("button");
    b.className = "rack f-plank" + (opts.gold ? " gold" : "") + (opts.chained ? " chained" : "") + (state.glow === cls ? " new" : "");
    const newest = list.slice().sort((a, b2) => own.get(b2.id).seq - own.get(a.id).seq)[0];
    if (newest) b.appendChild(sprite(newest, 2)); else b.appendChild(silhouetteClass(cls));
    const count = list.reduce((s, t) => s + own.get(t.id).n, 0);
    b.insertAdjacentHTML("beforeend", `<b>${plural(cls)}</b><span>${opts.chained ? (opts.label || "chained") : count}</span>`);
    b.setAttribute("aria-label", `${plural(cls)}: ${list.length} kinds${opts.chained ? ", chained" : ""}`);
    b.addEventListener("click", () => { if (opts.chained && !list.length) { toast(opts.tip || `The ${plural(cls)} rack is chained: Vorn sells the class, in the courtyard`); return; } openCabinet({ kind: "class", key: cls }); });
    return b;
  }
  function silhouetteClass(cls) {
    const t = window.FORGE_THINGS.find(x => x.kind === "weapon" && x.weapon.visual.base === cls);
    const cv = t ? PF.canvasFor(t, { scale: 2 }) : document.createElement("canvas");
    cv.style.filter = "grayscale(1) brightness(.5)";
    return cv;
  }
  function renderWall() {
    const wall = $("wall"); wall.innerHTML = "";
    if (state.tab === "weapons") {
      const rs = racks();
      const awake = Progress.crucibleAwake(profile, G);
      const legends = rs.find(r => r.c === "legendary");
      if (awake) wall.appendChild(rackButton("legendary", legends ? legends.list : [], { gold: true }));
      for (const r of rs) if (r.c !== "legendary") { if (classOpen(r.c)) wall.appendChild(rackButton(r.c, r.list, {})); }
      for (const r of rs) if (r.c !== "legendary" && !classOpen(r.c)) wall.appendChild(rackButton(r.c, r.list, { chained: true, label: r.list.length + " chained" }));
      const seen = new Set(rs.map(r => r.c));
      for (const c of Progress.START_CHOICES) if (!seen.has(c) && !classOpen(c) && profile.classes.length) wall.appendChild(rackButton(c, [], { chained: true, label: "not taken", tip: `You did not take the ${cap(c)}: Vorn has it, in the courtyard` }));
      const known = new Set([...rs.map(r => r.c), ...Progress.START_CHOICES.filter(c => profile.classes.length)]);
      known.delete("legendary");
      const left = CLASS_COUNT - known.size;
      if (!awake && !legends) wall.appendChild(rackButton("legendary", [], { chained: true, label: "level 25", tip: "Legends · level 25: the Crucible wakes then" }));
      else if (!awake && legends) wall.appendChild(rackButton("legendary", legends.list, { chained: true, label: "level 25" }));
      if (left > 0) wall.insertAdjacentHTML("beforeend", `<div class="rack q f-plank"><b>?</b><span>${left} to find</span></div>`);
    } else {
      for (const s of STORES) { const list = owned(t => t.kind !== "weapon" && storeOf(t) === s); if (!list.length) continue;
        const b = document.createElement("button"); b.className = "rack f-plank"; b.appendChild(sprite(list[list.length - 1], 2));
        b.insertAdjacentHTML("beforeend", `<b>${s}</b><span>${list.reduce((n, t) => n + have(t.id), 0)}</span>`); b.addEventListener("click", () => openCabinet({ kind: "store", key: s })); wall.appendChild(b); }
      // (build 17, design pass 24 section 4.7) the Cart is Nell's, in the courtyard: a tile that leaves the Forge and walks the knight to her
      const cart = document.createElement("button"); cart.className = "rack f-plank"; cart.appendChild(sprite(world.get("gold-nugget"), 2));
      cart.insertAdjacentHTML("beforeend", `<b>Nell's cart</b><span>${noyard ? profile.coins.toLocaleString() + " coins" : "Go to the cart"}</span>`); cart.setAttribute("aria-label", noyard ? "The Trader's Cart" : "Nell's cart is in the courtyard. Go to the cart"); cart.addEventListener("click", () => goToNell(null)); wall.appendChild(cart);
    }
    state.glow = null;
  }

  // ------------------------------------------------------------------ the cabinet: an endless, windowed shelf; the cart
  const ROW_H = 96;
  let shelfList = [], perRow = 4;
  function cabItems() {
    const c = state.cab;
    let list = c.kind === "class" ? owned(t => classOf(t) === c.key) : owned(t => t.kind !== "weapon" && storeOf(t) === c.key);
    if (c.kind === "store") for (const t of window.FORGE_THINGS) if (t.kind !== "weapon" && storeOf(t) === c.key && !own.has(t.id) && (c.key !== "Trophies")) { gain(t.id, 0); list.push(t); }
    const all = list;
    if (state.q) { const q = state.q.toLowerCase(); list = list.filter(t => t.name.toLowerCase().includes(q)); }
    const by = { newest: (a, b) => own.get(b.id).seq - own.get(a.id).seq, tier: (a, b) => b.tier - a.tier || own.get(b.id).seq - own.get(a.id).seq, name: (a, b) => a.name.localeCompare(b.name) }[state.sort];
    return { list: list.sort(by), total: all.length };
  }
  function openCabinet(c) {
    if (!c) return;
    state.cab = c; state.view = "cabinet"; state.q = ""; $("search").value = "";
    $("wall").hidden = true; $("cabinet").hidden = false;
    $("cabTitle").textContent = c.kind === "class" ? plural(c.key) : c.key;
    $("shelves").scrollTop = 0;
    renderCabinet();
  }
  function closeCabinet() { state.view = "wall"; state.cab = null; $("cabinet").hidden = true; $("wall").hidden = false; renderWall(); }
  function renderCabinet() {
    const c = state.cab;
    const isCart = c.kind === "cart";
    $("shelfTools").hidden = isCart; $("shelves").hidden = isCart; $("cartHead").hidden = !isCart; $("cart").hidden = !isCart;
    if (isCart) return renderCart();
    const { list, total } = cabItems();
    shelfList = list;
    $("cabCount").textContent = list.length === total ? `${total}` : `${list.length} of ${total}`;
    $("sort").textContent = state.sort.toUpperCase();
    perRow = Math.max(4, Math.floor(($("shelves").clientWidth || 340) / 84));
    const nRows = Math.max(3, Math.ceil(list.length / perRow));
    $("spacer").style.height = nRows * ROW_H + "px";
    drawShelves(true);
  }
  let drawn = "";
  function drawShelves(force) {
    const sh = $("shelves"), sp = $("spacer");
    if (!shelfList.length) { sp.innerHTML = `<div class="empty">${state.q ? "Nothing on this shelf matches." : "This shelf is empty. Forge something for it."}</div>`; drawn = ""; return; }
    const first = Math.max(0, Math.floor(sh.scrollTop / ROW_H) - 1), last = Math.min(Math.ceil(shelfList.length / perRow) - 1, Math.floor((sh.scrollTop + sh.clientHeight) / ROW_H) + 1);
    const key = first + ":" + last + ":" + shelfList.length + ":" + state.station + ":" + state.ma + ":" + (state.a || "") + (state.b || "");
    if (!force && key === drawn) return;
    drawn = key; sp.innerHTML = "";
    for (let r = first; r <= last; r++) {
      const row = document.createElement("div"); row.className = "shelf"; row.style.top = r * ROW_H + "px"; row.style.gridTemplateColumns = `repeat(${perRow},minmax(0,1fr))`;
      for (const t of shelfList.slice(r * perRow, r * perRow + perRow)) {
        const n = have(t.id);
        const dimWhy = state.station === "crucible" && F.isWeapon(t) ? fuseWhy(t) : null;
        const picked = state.station === "crucible" ? (state.ma === t.id || state.mb === t.id) : (state.a === t.id || state.b === t.id);
        const b = document.createElement("button"); b.className = "shelfitem" + (picked ? " picked" : "") + (state.glowItem === t.id ? " glow" : "") + (n === 0 && t.kind !== "weapon" ? " out" : "") + (dimWhy ? " dim" : "");
        b.title = `${t.name} · ${TIER[t.tier]}` + (dimWhy ? " · " + dimWhy : ""); b.appendChild(sprite(t, 2));   // (the name and the tier; no flavour, pass 10 section 3.3.5)
        const s = document.createElement("span"); s.textContent = t.name; b.appendChild(s);
        if (n > 1 || (t.kind !== "weapon" && !isForged(t))) b.insertAdjacentHTML("beforeend", `<span class="x">×${n}</span>`);
        if (n === 0 && t.kind !== "weapon") b.insertAdjacentHTML("beforeend", `<span class="buy">BUY</span>`);
        b.addEventListener("click", () => { if (n === 0 && t.kind !== "weapon") { if (isForged(t)) toast(`You're out of ${t.name}: forge more`); else { toast(`You're out of ${t.name}: Nell sells it`); goToNell(t.id); } return; } if (dimWhy) { toast(dimWhy); return; } pick(t.id); });
        row.appendChild(b);
      }
      sp.appendChild(row);
    }
    state.glowItem = null;
  }
  function renderCart() {
    const cart = $("cart"); cart.innerHTML = "";
    const n = state.bulk ? SHOP.bulk : 1;
    $("cabCount").textContent = `${profile.coins.toLocaleString()} coins`;
    $("cartLine").textContent = `Crafting materials only. Tap to buy ${n === 1 ? "one" : n}.`;
    $("bulk").setAttribute("aria-pressed", String(state.bulk));
    const items = [];
    for (const it of SHOP.items) items.push({ id: it.id, thing: world.get(it.id), store: it.store });
    const order = { Elements: 0, Materials: 1, Curios: 2, Trophies: 3 };
    items.sort((a, b) => order[a.store] - order[b.store]);
    const rowsOut = [];
    const bundle = SHOP.bundles[0];
    rowsOut.push({ id: bundle.id, name: bundle.name, sub: "one of each element · 60 off the singles", sprite: world.get("arcane-dust"), price: Coin.price(bundle.id, SHOP, profile, profile.found) });
    for (const it of items) if (it.thing) rowsOut.push({ id: it.id, name: it.thing.name, sub: `${it.store} · you have ${have(it.id)}`, sprite: it.thing, price: Coin.price(it.id, SHOP, profile, profile.found) });
    for (const r of rowsOut) {
      const [unit, why] = r.price;
      const b = document.createElement("button"); b.className = "cartrow" + (unit === null ? " sold" : "");
      if (r.sprite) b.appendChild(sprite(r.sprite, 1)); else { const cv = document.createElement("canvas"); cv.width = 33; cv.height = 33; const g = cv.getContext("2d"); g.fillStyle = "#f77622"; g.fillRect(12, 6, 9, 21); g.fillStyle = "#fee761"; g.fillRect(14, 10, 5, 12); b.appendChild(cv); }
      const d = document.createElement("div"); d.innerHTML = `<div class="n"></div><div class="s"></div>`; d.firstChild.textContent = r.name; d.lastChild.textContent = why ? why : r.sub;
      b.appendChild(d);
      const tag = document.createElement("span"); tag.className = "tag" + (unit === null ? " off" : ""); tag.textContent = unit === null ? "—" : (unit * (r.id === bundle.id ? 1 : n)).toLocaleString(); b.appendChild(tag);
      b.addEventListener("click", async () => {
        const count = r.id === bundle.id ? 1 : n;
        const res = await World.buy(r.id, count);
        if (!res.ok) { tag.classList.add("red"); $("chipCoins").classList.remove("shake"); void $("chipCoins").offsetWidth; $("chipCoins").classList.add("shake"); toast(res.reason || "Not sold"); setTimeout(() => tag.classList.remove("red"), 900); return; }
        toast(`Bought ${count === 1 ? "" : count + " "}${r.name} for ${res.cost} coins`);
        renderSign(); renderCart(); renderInfo();
        lessonOn("bought", r.id, res);   // (build 8) in the lessons' F4 the bought Fire flies onto the anvil by itself
      });
      cart.appendChild(b);
    }
  }
  $("bulk").addEventListener("click", () => { state.bulk = !state.bulk; renderCart(); });
  $("shelves").addEventListener("scroll", () => drawShelves(false), { passive: true });
  window.addEventListener("resize", () => { if (state.view === "cabinet") renderCabinet(); });
  $("back").addEventListener("click", closeCabinet);
  $("search").addEventListener("input", e => { state.q = e.target.value.trim(); $("shelves").scrollTop = 0; renderCabinet(); });
  $("sort").addEventListener("click", () => { state.sort = { newest: "tier", tier: "name", name: "newest" }[state.sort]; renderCabinet(); });
  function setTab(t) { if (t === "materials" && state.station === "crucible") return; state.tab = t; $("tabWeapons").setAttribute("aria-selected", String(t === "weapons")); $("tabMaterials").setAttribute("aria-selected", String(t === "materials")); closeCabinet(); }
  $("tabWeapons").addEventListener("click", () => setTab("weapons"));
  $("tabMaterials").addEventListener("click", () => setTab("materials"));

  // ------------------------------------------------------------------ the class ladder: the first weapon, the unlock plaque
  const STARTER_LINES = { sword: "Swings in an arc", bow: "Shoots", axe: "Splits, slowly and hard", flail: "Spins and smashes" };
  function classWeapon(c) { return window.FORGE_THINGS.find(t => t.kind === "weapon" && t.weapon.visual.base === c); }
  function openFirstWeapon() {
    const el = $("firstWeapon");
    el.innerHTML = `<div class="head">Take up your first weapon</div><div class="sub">Four racks are lit. The others open as you level.</div><div class="choices" id="choices"></div>`;
    const box = el.querySelector("#choices");
    for (const c of Progress.START_CHOICES) {
      const t = classWeapon(c);
      const b = document.createElement("button"); b.className = "choice f-plank"; b.appendChild(sprite(t, 2)); b.insertAdjacentHTML("beforeend", `<b>${t.name}</b><span>${STARTER_LINES[c]}</span>`);
      b.addEventListener("click", () => confirmFirst(c));
      box.appendChild(b);
    }
    el.hidden = false;
  }
  function confirmFirst(c) {
    const t = classWeapon(c);
    plank($("confirmPlank"), `<h3>Take up the ${esc(t.name)}</h3><div class="body">${esc(STARTER_LINES[c])}. Its rack goes up on the wall; the other three stay chained until a level-up.</div><div class="pbtns"><button class="f-ember primary" id="cfYes">Take it up</button><button class="f-iron" id="cfNo">Not this one</button></div>`);
    $("cfYes").addEventListener("click", async () => {
      $("confirmPlank").hidden = true;
      const r = await World.pick([c]);
      if (!r.ok) { toast(r.reason || "The world refused"); return; }
      gain(t.id); if (!profile.found.includes(t.id)) profile.found.push(t.id);
      $("firstWeapon").hidden = true; state.glow = c; save();
      renderSign(); setTab("weapons"); renderInfo();
      gryOpen(false);
      if (!openDrill(c, { first: true, toast: `The ${plural(c)} rack goes up` })) toast(`The ${plural(c)} rack goes up`);   // (design pass 32) the first weapon is a class opened: the drill, its toast after
    });
    $("cfNo").addEventListener("click", () => { $("confirmPlank").hidden = true; });
  }
  // ------------------------------------------------------------------ the drill (design pass 32, card t90; build 21): a new class is a big deal
  // When a class is taken at Vorn's (confirmClass) or the first weapon is chosen (confirmFirst), #drillPlaque rises over everything:
  // the eyebrow (the group and what it cost, or YOUR FIRST WEAPON), the class weapon's name, the stage (proto/drill.js: the knight
  // using the weapon against a straw dummy, looping; one still under less motion; shown at a whole number of device pixels a world
  // pixel in the room left, fitDrill), then one row: the Damage and Strengths lines (Drill.words) at the left and Done at the right.
  // Esc closes it too; Settings closes it; the yard pauses and Grycus is quiet under it. Vorn's face and his drill line stood under
  // the name until build 23 (design pass 33, card t92: clutter, Isaac's word; their room and the foot's went to the stage, 320 x 128
  // to 480 x 192 CSS px on an iPhone). Without drill.js on the page (an old cached page) nothing opens and the flow is as it was
  const drill = { run: null, cls: null, toast: null };   // (toast: the rack's line, shown when the drill closes, so it never sits on Done)
  const drillOpen = () => !$("drillPlaque").hidden;
  function openDrill(c, o) {
    o = o || {};
    const DR = window.Drill, t = classWeaponOf(c);
    if (!DR || !t) return false;
    closeDrill();
    const el = $("drillPlaque"), group = o.group || ((SHOP.classes && SHOP.classes.groups) || []).find(g => g.classes.includes(c)) || null;
    const eyebrow = o.first ? "Your first weapon" : "A new class" + (group ? " · " + group.name : "") + (o.free ? " · on the house" : o.cost ? " · " + o.cost + " coins" : "");
    let words = { damage: "", strengths: "" };
    try { words = DR.words(t); } catch (e) { (window.__errors || []).push("drill words " + c + ": " + (e && e.message || e)); }
    el.innerHTML = '<div class="dhead"><div class="eyebrow"></div><h3></h3></div><div class="dstage" id="drillStage"><canvas id="drillCanvas" width="' + (DR.W || 160) + '" height="' + (DR.H || 64) + '" role="img"></canvas></div><div class="dfoot"><div class="dlines"><div class="dline" id="drillDamage"></div><div class="dline" id="drillStrengths"></div></div><div class="pbtns"><button class="f-ember primary" id="drillDone">Done</button></div></div>';
    el.querySelector(".eyebrow").textContent = eyebrow; el.querySelector("h3").textContent = t.name;
    const dmg = $("drillDamage"), str = $("drillStrengths");
    dmg.innerHTML = "<b>Damage:</b> "; dmg.appendChild(document.createTextNode(words.damage || ""));
    str.innerHTML = "<b>Strengths:</b> "; str.appendChild(document.createTextNode(words.strengths || "")); str.hidden = !words.strengths;
    $("drillCanvas").setAttribute("aria-label", t.name + ": the knight drilling with it against a straw dummy");
    $("drillDone").addEventListener("click", closeDrill);
    el.hidden = false; drill.cls = c; drill.toast = o.toast || null;
    fitDrill();
    try { drill.run = DR.mount($("drillCanvas"), t, { reduce }); } catch (e) { (window.__errors || []).push("drill " + c + ": " + (e && e.message || e)); drill.run = null; }
    window.addEventListener("keydown", drillKey);
    syncYardPrompt();
    return true;
  }
  // the stage at a whole number of device pixels a world pixel (the yard's and the levels' rule, design pass 24 section 4.2; pass 33
  // section 3.3), as big as the room between the head and the foot allows: 9 on an iPhone 15 Pro (480 x 192 CSS px), 1 at least. On a
  // 1x screen it is a whole number of CSS pixels, as before. The 8 is the canvas's ring (a 2 px border and a 2 px shadow a side); the
  // picture's size is the canvas's own (160 x 64)
  function fitDrill() {
    const st = $("drillStage"), cv = $("drillCanvas"); if (!st || !cv || !drillOpen()) return;
    const dpr = window.devicePixelRatio || 1, W = cv.width || 160, H = cv.height || 64;
    const kd = Math.max(1, Math.floor(Math.min((st.clientWidth - 8) / W, (st.clientHeight - 8) / H) * dpr + 1e-6)), per = kd / dpr;
    cv.style.width = (W * per) + "px"; cv.style.height = (H * per) + "px";
  }
  function drillKey(e) { if (e.key === "Escape" && drillOpen()) { e.preventDefault(); closeDrill(); } }
  function closeDrill() {
    if (!drillOpen() && !drill.run) return false;
    if (drill.run) { try { drill.run.stop(); } catch (e) { /* stopped */ } drill.run = null; }
    $("drillPlaque").hidden = true; $("drillPlaque").innerHTML = ""; drill.cls = null;
    window.removeEventListener("keydown", drillKey);
    const line = drill.toast; drill.toast = null; if (line) toast(line);
    syncYardPrompt();
    return true;
  }
  window.addEventListener("resize", fitDrill);
  // (the unlock plaque, "The armory grows: choose two", stood here until build 17: Vorn hands the classes over in the courtyard, design pass 24 section 4.8)
  // (build 12, design pass 19) `wait` holds the level's toasts back that long: a run brought home says what it paid first ("Home with a
  // clear: 250 XP, …"), and since a clear now lifts the level nearly every time, "Level N" follows it instead of replacing it at once
  const AFTER_HOME_MS = 1800;
  function afterLevelChange(before, res, wait) {
    renderSign();
    const woke = res ? res.crucible_woke : (before < G.fuse.level && profile.level >= G.fuse.level), ms = wait > 0 ? wait : 0;
    const picks = Progress.picksLeft(profile), words = n => n === 1 ? "one" : n === 2 ? "two" : n === 3 ? "three" : n === 4 ? "four" : String(n);
    // (build 17) a level-up says where the new racks are: Vorn's, in the courtyard (design pass 24 section 4.8)
    if (profile.level > before) { const line = `Level ${profile.level}` + (picks > 0 && profile.classes.length ? ` · Vorn has ${words(picks)} weapon${picks === 1 ? "" : "s"} on the house` : profile.level >= 50 ? ": Champion of the Forge" : ""); if (ms) setTimeout(() => toast(line), ms); else toast(line); }
    if (woke) {
      room.setCrucible("lit");
      setTimeout(() => { toast("The Crucible wakes: melt two rare weapons into a legend"); if (!profile.embers) setTimeout(() => toast(EMBER_WHERE), 1800); }, ms + (picks > 0 ? 400 : 0));
      state.glow = "legendary";
      renderSign();
      if (state.view === "wall") renderWall();
    }
  }

  // ------------------------------------------------------------------ the Armory (design pass 15): a room of its own
  // The door on the smithy's right wall, or ARMORY on the sign, goes through into the Armory: the hall takes the room's place under
  // the sign (armory.js paints it and walks it), the sign says The Armory and its button says FORGE. Nothing is played there. Two
  // walls: the Armory (a bay of two shelves for every class the smith holds a weapon of, the rarest nearest the door) and the Legends
  // (each in a gilt case, the newest first). A weapon opens its plaque in view mode; the door at the hall's left end, FORGE on the
  // sign, Esc and To the anvil go back. Neither way while forging or pouring. The Roll and the Book of Kinds are gone from the page.
  const PAGES = [["pgArmory", "armory"], ["pgLegends", "legends"]];
  const hall = window.Armory ? Armory.mount({ hall: $("hall"), track: $("track") }, {
    sprite, tierWord: t => TIER[t.tier] || "", onOpen: t => viewWeapon(t), onBay: cls => openBay(cls), onDoor: () => armoryOut(), turned: () => turn.turned,
    onScroll(x, max) { $("armPrev").hidden = x < 4; $("armNext").hidden = x > max - 4; if (state.room === "armory" && hall) state.hallX[state.page] = hall.x; }
  }) : null;
  // the smith's weapons: everything held now. (Until 2026-10-07 everything ever found stood here too, a weapon melted into another
  // greyed; Isaac's call: one no longer held leaves the Armory altogether. profile.found still remembers it for the ledger.)
  // Class weapons are in (the plain Sword is a common sword); ingredients are not (they live on the Materials wall)
  function armoryWeapons() { const out = []; for (const id of own.keys()) { const t = world.get(id); if (t && F.isWeapon(t)) out.push(t); } return out; }
  // what the hall shows. The Armory: the classes with weapons in the grammar's order, which never moves; in a bay the rarest first
  // and by name within a tier (the shelves show the first six; the plate opens them all). The Legends: newest first by the date
  // acquired; legends with no date (a save from before build 4) after the dated ones, newest first by the order they were gained
  function armoryModel() {
    const item = t => { const o = own.get(t.id); return { t, n: o ? o.n : 0, mine: (t.discovery || {}).first === profile.id }; };
    const all = armoryWeapons();
    if (state.page === "legends") {
      const when = t => got[t.id] || "";
      const list = all.filter(t => classOf(t) === "legendary").sort((a, b) => String(when(b)).localeCompare(String(when(a))) || ((own.get(b.id) || { seq: 0 }).seq - (own.get(a.id) || { seq: 0 }).seq));
      return { page: "legends", empty: "No legends yet. The Crucible wakes at level 25.", door: noyard ? "forge" : "yard", legends: list.map(t => {
        const k = t.hybrid && kinds.find(x => x.id === t.hybrid.kind), ab = abilityOf(t);
        return Object.assign(item(t), { sub: [(k ? "A " + k.name : cap(t.hybrid.classes[0]) + " ✦ " + cap(t.hybrid.classes[1])) + (ab ? " · ✦ " + ab.name : ""), when(t) ? "acquired " + fmtDate(when(t)) : ""].filter(Boolean) });
      }) };
    }
    const by = new Map(G.visual.bases.map(c => [c, []]));
    for (const t of all) { const c = classOf(t); if (by.has(c)) by.get(c).push(item(t)); }
    const classes = G.visual.bases.filter(c => by.get(c).length).map(c => ({ cls: c, label: plural(c), items: by.get(c).sort((a, b) => (b.t.tier - a.t.tier) || a.t.name.localeCompare(b.t.name)) }));
    return { page: "armory", classes, missing: G.visual.bases.length - classes.length, empty: "No weapons yet.", door: noyard ? "forge" : "yard" };   // (build 17: the hall's door shows the yard and says ← Courtyard)
  }
  // the hall at the Forge's own scale: as tall as the pane leaves after its line of words, 112 world pixels high
  function fitArmory() {
    if (!hall || state.room !== "armory") return null;
    const pane = $("armpane"), el = $("armRoom");
    if (!pane.clientWidth || !pane.clientHeight) return null;
    const boxW = pane.clientWidth, boxH = Math.max(60, pane.clientHeight - $("armState").offsetHeight);
    const sc = Math.min(boxH / ROOM_H, boxW / W_MIN);
    el.style.height = ROOM_H * sc + "px";
    hall.fit(sc, boxW / sc);
    return { s: sc, viewW: boxW / sc };
  }
  // draw the wall the tabs name (nothing unless the smith is in the Armory); keep leaves the hall where it was walked to
  function renderArmory(keep) {
    if (!hall || state.room !== "armory") return null;
    for (const [id, pg] of PAGES) $(id).setAttribute("aria-selected", String(state.page === pg));
    const m = armoryModel(), L = hall.render(m, keep !== false);
    if (m.page === "legends") { const n = m.legends.length; $("armState").textContent = n ? `${n} legend${n === 1 ? "" : "s"}, the newest first` : "No legends yet"; }
    else { const n = m.classes.reduce((a, c) => a + c.items.length, 0);
      $("armState").textContent = `${n} weapon${n === 1 ? "" : "s"} in ${m.classes.length} class${m.classes.length === 1 ? "" : "es"} · tap one to read its plaque`; }
    return L;
  }
  // through the door: the room walked into comes out of soot (nothing under less motion, or under the harness)
  const quiet = () => reduce || params.get("harness") === "1";
  function walkThrough() { if (quiet()) return; const a = $("app"); a.classList.remove("walk"); void a.offsetWidth; a.classList.add("walk"); setTimeout(() => a.classList.remove("walk"), 340); }
  // (build 17) the three ways: in through enter(); closeArmory back to the Forge (To the anvil, a forge, the bench); armoryOut through the
  // hall's door or Esc, out to the courtyard (the Forge under the old graph)
  function openArmory(page) { if (!hall || state.forging || state.pouring) return false; return enter("armory", { page: page === "legends" ? "legends" : "armory" }); }
  function closeArmory() { if (state.room !== "armory") return false; if (plaqueMode === "view") closePlaque(); return enter("forge"); }
  function armoryOut() { if (state.room !== "armory") return false; if (plaqueMode === "view") closePlaque(); return enter(noyard ? "forge" : "yard", { at: "armory" }); }
  for (const [id, pg] of PAGES) $(id).addEventListener("click", () => { if (state.page === pg) return; state.page = pg; const at = state.hallX[pg] || 0; renderArmory(false); if (hall) hall.x = at; });
  $("armPrev").addEventListener("click", () => hall && hall.walk(-1, quiet()));
  $("armNext").addEventListener("click", () => hall && hall.walk(1, quiet()));
  // Esc leaves the Armory when nothing stands over it (a plaque, a plank and Settings take the key first)
  window.addEventListener("keydown", e => { if (e.key !== "Escape" || e.defaultPrevented || state.room !== "armory" || plaqueOpen() || plankOpen() || !$("setPlank").hidden) return; if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return; e.preventDefault(); if (folkOpen()) closeFolk(); else armoryOut(); });
  // the plate before a bay opens the whole class on the folk's plank: every weapon of it the smith holds, the rarest first; a row opens its plaque
  function openBay(cls) { if (state.room !== "armory" || !cls) return false; if (folkOpen() && folk.who === "bay" && folk.cls === cls) { closeFolk(); return false; } return openFolk("bay", { cls }); }
  // the ★ chip counts the smith's firsts; in the Armory they carry the star
  $("chipLevel").addEventListener("click", () => toast(levelLine()));   // (build 12) where the player stands: "Lv 3 · 45 of 110 XP to Lv 4"
  $("chipFirsts").addEventListener("click", () => {
    // (build 24, design pass 29) in the yard the chip walks the knight to the Roll's board, which opens on arrival; elsewhere its toast says where the Roll stands
    if (state.room === "yard" && yard.kn && yard.Y && yard.Y.placeOf("roll") && !yardPaused() && !(lessonOn("quiet") === true)) { yard.Y.goTo(yard.kn, "roll"); return; }
    const n = profile.firsts.weapons.length, where = yard.Y && yard.Y.placeOf("roll") ? " · the Roll of First Forges stands by the well" : "";
    toast((n ? `${n} weapon${n === 1 ? "" : "s"} you forged first in the world: ${n === 1 ? "it carries" : "they carry"} a ★ in the Armory` : "No weapon forged first in the world yet: a first carries a ★ in the Armory") + where);
  });
  function viewWeapon(t) {
    const claim = { thing: t, status: t.oracle && t.oracle.provisional && svc.url ? "pending" : "known", kind: t.hybrid ? kinds.find(k => k.id === t.hybrid.kind) || null : null };
    if (classOf(t) === "legendary") showLegend(claim, null, null, { view: true }); else showPlaque(claim, null, null, { view: true });
  }

  function enter(room, o) {
    o = o || {};
    if (room === "yard" && noyard) room = "forge";
    if (room === "map" && (noyard || !hasMap)) { toast("The map could not be read"); return false; }
    if (!ROOMS[room] || state.forging || state.pouring) return false;
    const was = state.room;
    closePlaque(); closeWalls(); closeFolk(); gryHush();
    if (was === "map" && room !== "map") mapLeave();
    if (was === "yard" && room !== "yard") yardLeave();
    state.room = room; session.roomSet = true;
    if (room === "yard") settleQueue();   // (build 24: into the yard, the Roll's queue goes)
    const app = $("app");
    app.classList.toggle("in-armory", room === "armory"); app.classList.toggle("in-yard", room === "yard"); app.classList.toggle("in-map", room === "map");
    $("signName").textContent = ROOMS[room];
    $("armoryBtn").hidden = room !== "map";
    if (room === "armory") { if (o.page === "armory" || o.page === "legends") state.page = o.page; const at = state.hallX[state.page] || 0; fitArmory(); renderArmory(false); if (hall) hall.x = at; }   // (the hall opens where that wall was left: hallX is kept per wall by onScroll, which the re-render also fires with the scroll at 0 once the room is named, so the place is read before it, as the tabs do; card t83)
    if (room === "forge") { fitRoom(); renderPegs(); }
    if (room === "yard") yardEnter(o);
    if (room === "map") mapEnter(o);
    if (was !== room && !o.cut) walkThrough();
    saveYardMark();
    lessonOn("room", room, was);
    return true;
  }
  // the room and spot the page keeps in its own history entry (pass 26 section 3.3): read at the next boot, with no note in the address
  function histState() { try { const st = window.history.state; return st && typeof st === "object" ? st : {}; } catch (e) { return {}; } }
  function putState(o) { try { window.history.replaceState(Object.assign({}, histState(), o), ""); return true; } catch (e) { return false; } }
  function saveYardMark() {
    const k = yard.kn, mark = { room: state.room };
    if (k) { mark.x = Math.round(k.x); mark.y = Math.round(k.y); mark.face = k.facing; }
    putState({ ffYard: mark });
  }
  // the mark of where the page went (pass 24 section 4.6): the cellar, or the road to a level. Read by the next boot or the back gesture
  function markWent(where) { putState({ ffWent: where }); }
  function clearWent() { const st = histState(); if (st.ffWent !== undefined) { const rest = Object.assign({}, st); delete rest.ffWent; try { window.history.replaceState(rest, ""); } catch (e) { /* kept */ } } }
  // a point of the viewport in the app's own space (turned back when the frame is turned a quarter: the cellar's rule)
  function toGame(cx, cy) {
    const app = $("app");
    if (turn.turned && turn.v) return [cy - app.offsetLeft, turn.v.w - cx - app.offsetTop];
    const r = app.getBoundingClientRect(); return [cx - r.left, cy - r.top];
  }
  const walkKeys = { w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] };

  // ------------------------------------------------------------------ the Courtyard (design pass 24 with its revisions, pass 25 section 4.1, pass 26 sections 3.3 and 3.4)
  // The yard itself is proto/courtyard.js (the painter, the walk, the camera, the zones, tap to go); this is the page's side: the canvas
  // and its fit at the cellar's scale, the baked ground, the frame loop, the stick, the keys, the taps, the prompt over the knight, what a
  // place does when used, the arrivals, and what the page draws over the yard (the lessons' ring, arrow and chevron, the "!" over Vorn,
  // the well's purse)
  const yard = { Y: null, ground: [], bakeId: 0, pieces: [], knCache: new Map(), folkCache: new Map(), kn: null, cam: { x: 0, y: 0 }, L: null, stick: null, t0: 0, last: 0, t: 0, raf: 0, zone: null, promptText: "", keys: {},
    fx: { purse: null, flick: 0, lit: null }, toastedWell: false, bakeMs: null, arrows: null };
  const yardPaused = () => !!(state.room !== "yard" || plaqueOpen() || plankOpen() || folkOpen() || !$("setPlank").hidden || document.hidden || session.leaving || turn.plate || !$("firstWeapon").hidden || drillOpen());
  function canvasOf(fr) { const c = document.createElement("canvas"); c.width = fr.w; c.height = fr.h; const g = c.getContext("2d"), id = g.createImageData(fr.w, fr.h); id.data.set(fr.d); g.putImageData(id, 0, 0); return c; }
  function pxCanvas(px, w, h, flip) { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const col = px[y * w + x]; if (col) { g.fillStyle = col; g.fillRect(flip ? w - 1 - x : x, y, 1, 1); } } return c; }
  function knightSprite(facing, anim, i) { const key = facing + anim + i; let c = yard.knCache.get(key); if (!c) { c = pxCanvas(KN.frame(facing, anim, i).px, 32, 32); yard.knCache.set(key, c); } return c; }
  function folkSprite(who, pose, i, flip) { const key = who + pose + i + (flip ? "f" : ""); let s = yard.folkCache.get(key); if (!s) { const fr = FK.frame(who, pose, i); s = fr ? { c: pxCanvas(fr.layer.px, fr.layer.w, fr.layer.h, flip), ox: fr.ox, oy: fr.oy } : null; yard.folkCache.set(key, s); } return s; }
  function yardBoot() {
    if (yard.Y || !hasYard) return !!yard.Y;
    yard.Y = new Y.Yard();
    yard.pieces = yard.Y.pieces.map(P => ({ P, c: canvasOf(yard.Y.pieceFrame(P)) }));
    return true;
  }
  // the ground, baked whole (pass 26 section 3.2 row 4): phase 0 before the room shows, timed; the other three in idle slices of 44
  // rows, the flicker starting when all four are ready. Under less motion only phase 0 is ever drawn
  function yardBake() {
    const t0 = performance.now(), id = ++yard.bakeId;
    yard.ground = [canvasOf(yard.Y.groundFrame(0))];
    yard.bakeMs = Math.round(performance.now() - t0);
    if (reduce) return;
    const W = yard.Y.W, H = yard.Y.H, rows = 44, bufs = [1, 2, 3].map(() => new Uint8ClampedArray(W * H * 4));
    let f = 1, y = 0;
    const idle = cb => (window.requestIdleCallback ? window.requestIdleCallback(cb, { timeout: 120 }) : setTimeout(cb, 30));
    const slice = () => {
      if (id !== yard.bakeId || !yard.Y) return;
      yard.Y.groundFrame(f, bufs[f - 1], y, Math.min(H, y + rows)); y += rows;
      if (y >= H) { yard.ground[f] = canvasOf({ w: W, h: H, d: bufs[f - 1] }); f++; y = 0; }
      if (f <= 3) idle(slice);
    };
    idle(slice);
  }
  // the view: a whole number of device pixels to a world pixel, taken as the cellar takes it (the whole frame over 384 x 216), and as
  // much of the yard as the pane under the sign holds; a pane bigger than the yard centres it on the stone
  function fitYard() {
    if (state.room !== "yard" || !yard.Y) return null;
    const pane = $("yardpane"), cv = $("yard");
    if (!pane.clientWidth || !pane.clientHeight) return null;
    const app = $("app"), dpr = window.devicePixelRatio || 1;
    const f = Y.fit(app.clientWidth, app.clientHeight, pane.clientWidth, pane.clientHeight, dpr);
    cv.width = f.vw; cv.height = f.vh; cv.style.width = (f.vw * f.per) + "px"; cv.style.height = (f.vh * f.per) + "px";
    yard.L = { k: f.k, per: f.per, vw: f.vw, vh: f.vh, dpr, paneW: pane.clientWidth, paneH: pane.clientHeight };
    if (yard.kn) { yard.Y.camera(yard.cam, yard.kn, f.vw, f.vh); yardPaint(yard.t); syncYardPrompt(); }
    return yard.L;
  }
  // where the knight stands as the room opens: a spot by name (spec.arrive), { x, y, face } from the page's own mark, or the menu's
  function yardEnter(o) {
    if (!yardBoot()) return;
    const at = typeof o.at === "string" ? (SPOT_OF[o.at] || o.at) : o.at;
    const spot = typeof at === "string" ? (yard.Y.spec.arrive[at] ? at : "menu") : at && typeof at.x === "number" ? { x: at.x, y: at.y, face: at.face } : "menu";
    yard.kn = yard.Y.knight(spot);
    if (!yard.Y.free(yard.kn.x, yard.kn.y)) yard.Y.settle(yard.kn);
    yard.zone = null; yard.promptText = ""; yard.keys = {}; yard.fx.purse = null;
    if (!yard.ground.length) yardBake();
    if (!yard.stick && ST) {
      const origin = () => { const p = $("yardpane"); return [p.offsetLeft, p.offsetTop]; };
      const stickPaused = () => yardPaused() && !folkOpen();   // (a thumb on the stick closes a folk's plank and walks: pass 24 section 4.7)
      yard.stick = ST.mount({ zone: $("yardZone"), stick: $("yardStick"), knob: $("yardKnob"), toGame, origin, paused: stickPaused, onTap: (gx, gy) => yardTap(gx, gy) });
      ST.tap($("yard"), { toGame, paused: stickPaused, onTap: (gx, gy) => yardTap(gx, gy) });
    }
    $("app").classList.toggle("lefty", !!(window.Settings && Settings.isOn("lefty")));
    fitYard();
    yard.Y.camera(yard.cam, yard.kn, yard.L ? yard.L.vw : 384, yard.L ? yard.L.vh : 216);
    yard.t0 = performance.now(); yard.last = yard.t0; yard.t = 0;
    yardPaint(0); syncYardPrompt();
    if (!yard.toastedWell && wellReady() && !(lessonOn("quiet") === true)) { yard.toastedWell = true; toast("Your daily coins are in the well"); }
    if (yard.raf) cancelAnimationFrame(yard.raf);
    yard.raf = requestAnimationFrame(yardFrame);
  }
  function yardLeave() { if (yard.raf) cancelAnimationFrame(yard.raf); yard.raf = 0; if (yard.stick) yard.stick.up(); yard.keys = {}; $("yardPrompt").hidden = true; }
  // the frame: the stick's or the keys' wish, one step of the walk (none while a plank stands over the yard), the camera, the paint, the
  // prompt. Time moves on the page's clock; the harness moves it through TheForge.yard.step(ms)
  function yardWish() {
    let wx = 0, wy = 0;
    if (yard.stick && yard.stick.held) { wx = yard.stick.x; wy = yard.stick.y; }
    else { for (const k of Object.keys(yard.keys)) if (yard.keys[k] && walkKeys[k]) { wx += walkKeys[k][0]; wy += walkKeys[k][1]; } const m = Math.hypot(wx, wy); if (m > 1) { wx /= m; wy /= m; } }
    return [wx, wy];
  }
  function yardTick(dt) {
    const k = yard.kn; if (!k) return;
    const [wx, wy] = yardWish();
    if ((wx || wy) && folkOpen()) closeFolk();   // the knight walking closes a plank
    if (yardPaused()) { yard.Y.camera(yard.cam, k, yard.L.vw, yard.L.vh, dt); return; }
    const lv = lessonOn("yardView") || null, allow = lv && lv.allow ? lv.allow : null;
    const r = yard.Y.tick(k, wx, wy, dt, allow);
    yard.t += dt;
    if (r.zone !== yard.zone || (r.zone && yardPromptFor(r.zone) !== yard.promptText)) { yard.zone = r.zone; syncYardPrompt(); }
    lessonOn("yardTick", k, yard.t);
    if (r.use) yardUse(r.use);
    yard.Y.camera(yard.cam, k, yard.L.vw, yard.L.vh, dt);
  }
  function yardFrame(now) {
    if (state.room !== "yard") { yard.raf = 0; return; }
    const dt = Math.max(0, Math.min(0.05, (now - yard.last) / 1000)); yard.last = now;
    if (!harnessClock) yardTick(dt);
    if (yard.L) yardPaint(yard.t);
    if (yard.zone) syncYardPrompt(true);
    yard.raf = requestAnimationFrame(yardFrame);
  }
  const harnessClock = params.get("harness") === "1" && params.get("clock") === "harness";   // (the harness steps the yard itself)
  function shadow(g, x, y, w) { g.fillStyle = "rgba(18,14,26,0.45)"; g.fillRect(x - w, y, w * 2 + 1, 1); g.fillRect(x - Math.round(w * 0.7), y - 1, Math.round(w * 1.4) + 1, 1); g.fillRect(x - Math.round(w * 0.7), y + 1, Math.round(w * 1.4) + 1, 1); }
  // the yard at time t into the canvas: the baked ground at the camera, the pieces, the folk and the knight sorted by their feet, the
  // flames, the smoke and sparks, the well's glint; then what the page adds: the "!" over Vorn while picks wait, the purse rising from
  // the well, the lessons' ring, arrow and chevron
  function yardPaint(t) {
    const cv = $("yard"), g = cv.getContext("2d"), L = yard.L, k = yard.kn, YD = yard.Y; if (!L || !k || !YD) return;
    const still = reduce, f = still ? 0 : Math.floor(t * 8) % 4, gc = yard.ground[f] || yard.ground[0], cx = Math.round(yard.cam.x), cy = Math.round(yard.cam.y), vw = L.vw, vh = L.vh;
    g.imageSmoothingEnabled = false;
    g.fillStyle = "#181425"; g.fillRect(0, 0, vw, vh);
    if (gc) g.drawImage(gc, -cx, -cy);
    const live = YD.live(t, still, { wellReady: wellReady() }), acts = [];
    for (const { P, c } of yard.pieces) acts.push({ y: P.sy, fn: () => g.drawImage(c, P.x - cx, P.y - cy) });
    for (const fk of live.folk) {
      let i = fk.i; if (fk.who === "biscuit" && yard.fx.flick > t) i = 1;
      const sp = folkSprite(fk.who, fk.pose || "idle", i, fk.flip); if (!sp) continue;
      acts.push({ y: fk.y, fn: () => { if (!fk.onRoof) shadow(g, Math.round(fk.x) - cx, Math.round(fk.y) - cy, fk.who === "biscuit" ? 13 : fk.who === "hen" ? 3 : 6); g.drawImage(sp.c, Math.round(fk.x) - sp.ox - cx, Math.round(fk.y) - sp.oy - cy); } });
    }
    acts.push({ y: k.y, fn: () => { shadow(g, Math.round(k.x) - cx, Math.round(k.y) - cy, 6); g.drawImage(knightSprite(k.facing, k.anim, k.i), Math.round(k.x) - 16 - cx, Math.round(k.y) - 31 - cy); } });
    acts.sort((a, b) => a.y - b.y); for (const a of acts) a.fn();
    for (const fl of live.flames) { const FR = Y.FLAME[fl.f]; if (!FR) continue; for (let j = 0; j < 6; j++) for (let i = 0; i < 5; i++) { const ch = FR[j][i]; if (ch !== ".") { g.fillStyle = Y.FIRE[ch]; g.fillRect(fl.x - 2 + i - cx, fl.y - 6 + j - cy, 1, 1); } } }
    const BAY = Smithy.BAYER;
    for (const s of live.smoke) { g.fillStyle = s.c; const R = s.r, sx = Math.round(s.x), sy = Math.round(s.y); for (let dy = -Math.ceil(R); dy <= R; dy++) for (let dx = -Math.ceil(R); dx <= R; dx++) if (dx * dx + dy * dy <= R * R && BAY[((sy + dy) & 3) * 4 + ((sx + dx) & 3)] < s.a * 0.75) g.fillRect(sx + dx - cx, sy + dy - cy, 1, 1); }
    for (const s of live.sparks) { g.fillStyle = s.c; g.fillRect(Math.round(s.x) - cx, Math.round(s.y) - cy, 1, 1); }
    if (live.glint && live.glint.on) for (const [dx, dy, c] of [[0, 0, "#fee761"], [1, 0, "#feae34"], [0, 1, "#feae34"], [3, -1, "#fffaf0"], [-2, 1, "#feae34"]]) { g.fillStyle = c; g.fillRect(live.glint.x + dx - cx, live.glint.y + dy - cy, 1, 1); }
    // "!" over Vorn's head while classes wait on the house (pass 26 section 3.7)
    if (Progress.picksLeft(profile) > 0 && profile.classes.length && !(lessonOn("quiet") === true)) { const V = YD.spec.folk.vorn, bob = still ? 0 : Math.floor(t * 2) % 2, x = V.x - cx, y = V.y - 40 - bob - cy; g.fillStyle = "#181425"; g.fillRect(x - 2, y - 1, 5, 9); g.fillStyle = "#fee761"; g.fillRect(x - 1, y, 3, 4); g.fillRect(x - 1, y + 5, 3, 2); }
    // the purse coming up out of the well's mouth for 0.7 s (pass 26 row 9; a 6 x 5 purse, drawn here)
    if (yard.fx.purse) { const d = t - yard.fx.purse.t0, W0 = YD.spec.well; if (d > 0.7 || still) yard.fx.purse = null; else { const x = W0.x - 3 - cx, y = W0.y - 4 - Math.round(d / 0.7 * 14) - cy; for (let j = 0; j < 5; j++) for (let i = 0; i < 6; i++) { const edge = j === 0 || j === 4 || i === 0 || i === 5, knot = j === 0 && (i === 2 || i === 3); if (knot) g.fillStyle = "#733e39"; else if (edge) g.fillStyle = "#181425"; else g.fillStyle = (i + j) % 3 ? "#733e39" : "#feae34"; if (!(j === 0 && !knot)) g.fillRect(x + i, y + j, 1, 1); } } }
    // the lessons' marks (pass 26 section 3.2 row 5): an ember ring on the floor at the target's stand, a yellow arrow over it, and a
    // chevron at the view's edge while it is off screen
    const lv = lessonOn("yardView") || null;
    if (lv && lv.target) {
      const tg = YD.targetOf(lv.target), P = YD.placeOf(lv.target); if (tg && P) {
        const rx = 16, ry = 9, n = Math.ceil(Math.PI * (rx + ry)), ph = still ? 0 : Math.floor(t * 12);
        for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, x = Math.round(tg.x + rx * Math.cos(a)) - cx, y = Math.round(tg.y + ry * Math.sin(a)) - cy; g.fillStyle = "#181425"; g.fillRect(x, y + 1, 1, 1); if (((i + ph) % 6) < 3) { g.fillStyle = ((i + ph) % 6) === 1 ? "#feae34" : "#f77622"; g.fillRect(x, y, 1, 1); } }
        const ax = Math.round(tg.x) - cx, top = P.y0 !== undefined && P.side === "e" ? P.y0 : P.top !== undefined ? P.top : (P.zone ? P.zone[1] : tg.y) ;
        const ay = Math.round((P.side === "n" ? top - 6 : P.zone ? P.zone[1] - 14 : tg.y - 40) - (still ? 0 : (Math.floor(t * 4) % 2) * 2)) - cy;
        const inView = ax >= 0 && ax < vw && ay >= 0 && ay < vh;
        if (inView) { g.fillStyle = "#181425"; for (let j = 0; j < 9; j++) { const w = j < 5 ? 1 + j * 2 : 3; g.fillRect(ax - (w >> 1) - 1, ay + j, w + 2, 1); } g.fillStyle = "#fee761"; for (let j = 1; j < 8; j++) { const w = j < 5 ? 1 + (j - 1) * 2 : 1; g.fillRect(ax - (w >> 1), ay + j, w, 1); } }
        else {
          const ex = Math.max(4, Math.min(vw - 5, ax)), ey = Math.max(4, Math.min(vh - 5, ay)), dx = Math.sign(ax - ex), dy = Math.sign(ay - ey), bob = still ? 0 : (Math.floor(t * 4) % 2);
          g.fillStyle = "#181425"; for (let s = 0; s < 4; s++) { const w = 7 - s * 2; if (dx) g.fillRect(ex + dx * (s + bob) - 1, ey - (w >> 1) - 1, 1, w + 2); else g.fillRect(ex - (w >> 1) - 1, ey + dy * (s + bob) - 1, w + 2, 1); }
          g.fillStyle = "#fee761"; for (let s = 0; s < 3; s++) { const w = 5 - s * 2; if (dx) g.fillRect(ex + dx * (s + bob), ey - (w >> 1), 1, w); else g.fillRect(ex - (w >> 1), ey + dy * (s + bob), w, 1); }
        }
      }
    }
  }
  // the prompt over the knight (pass 24 section 4.5): the place's own words, the well's by whether the day's coins wait; "←" and "→"
  // fall back to plain words when Pixelify Sans lacks them, as the cellar's do
  function yardPromptFor(z) { if (!z) return ""; const w = YD_WELL(); const s = z.kind === "well" ? (wellReady() ? w.prompt : w.spent) : z.prompt || ""; return yard.arrows === false ? String(s).replace(/^[←→]\s*/, "").replace(/\s*[←→]$/, "") : s; }
  const YD_WELL = () => yard.Y ? yard.Y.spec.well : { prompt: "", spent: "" };
  function syncYardPrompt(moveOnly) {
    const el = $("yardPrompt"), z = yard.zone, k = yard.kn, L = yard.L;
    if (!z || !k || !L || state.room !== "yard" || folkOpen() || plaqueOpen() || plankOpen()) { el.hidden = true; return; }
    const cv = $("yard");
    if (!moveOnly || el.hidden) { yard.promptText = yardPromptFor(z); if (el.textContent !== yard.promptText) el.textContent = yard.promptText; el.hidden = false; yard.promptHalf = el.offsetWidth / 2 || 40; }
    // (design pass 30) clamped inside the pane and the screen's insets (the notch's strip at either side), as the cellar's prompt is
    const ins = insets(), half = yard.promptHalf || 40, lo = ins.l + half, hi = Math.max(lo, $("yardpane").clientWidth - ins.r - half);
    el.style.left = Math.round(Math.max(lo, Math.min(hi, cv.offsetLeft + (k.x - yard.cam.x) * L.per))) + "px";
    el.style.top = Math.round(cv.offsetTop + (k.y - 34 - yard.cam.y) * L.per) + "px";
  }
  (function yardArrows() {
    const FS = document.fonts; if (!FS || !FS.ready) return;
    FS.ready.then(() => { try {
      const c = document.createElement("canvas").getContext("2d"), w = (f, s) => { c.font = f; return c.measureText(s).width; }, inFont = ch => Math.abs(w("40px 'Pixelify Sans', monospace", ch) - w("40px 'Pixelify Sans', serif", ch)) < 0.01;
      yard.arrows = inFont("A") ? inFont("←") && inFont("→") && inFont("↑") : null;
      if (yard.zone) syncYardPrompt();
    } catch (e) { /* the arrows stay */ } }, () => {});
  })();
  // a tap on the yard (pass 24 section 4.5, Isaac's call 6): on a place's tap box the knight walks there and uses it; on bare floor
  // nothing. (gx, gy) is in the app's own space
  function yardTap(gx, gy) {
    const L = yard.L, k = yard.kn; if (!L || !k || state.room !== "yard") return null;
    if (folkOpen()) { closeFolk(); return null; }
    const pane = $("yardpane"), cv = $("yard"), x0 = pane.offsetLeft + cv.offsetLeft, y0 = pane.offsetTop + cv.offsetTop;
    const wx = (gx - x0) / L.per + yard.cam.x, wy = (gy - y0) / L.per + yard.cam.y;
    const hit = yard.Y.tapAt(wx, wy);
    const lv = lessonOn("yardView") || null;
    if (!hit || (lv && lv.allow && !lv.allow(hit.id))) { if (lv && lv.allow && hit) lessonOn("offTap"); return null; }
    yard.Y.goTo(k, hit.id);
    return hit.id;
  }
  // E, the prompt, a door's dwell or a tap's arrival: what the place does (pass 26 section 3.3, every trip)
  function yardUse(z) {
    if (!z || state.room !== "yard") return false;
    const k = yard.kn; if (k) { k.path = null; k.goal = null; }
    lessonOn("yardUse", z.id);
    if (z.kind === "folk") return openFolk(z.id);
    if (z.kind === "well") { wellUse(); return true; }
    if (z.kind === "roll") { if (k) k.facing = "away"; return openFolk("roll"); }   // (build 24: the Roll of First Forges, read facing the board)
    if (z.kind === "table") return enter("map");
    const d = z.door; if (!d) return false;
    if (d.shut) { toast(d.shut); return true; }
    if (d.goes === "forge") return enter("forge");
    if (d.goes === "armory") return enter("armory", { page: "armory" });
    if (d.goes === "map") return enter("map");
    if (d.goes === "cellar") { goDown(null); return true; }
    return false;
  }
  function yardUseHere() { const k = yard.kn; if (!k || !yard.Y) return false; const lv = lessonOn("yardView") || null; let z = yard.Y.zoneAt(k.x, k.y); if (z && lv && lv.allow && !lv.allow(z.id)) z = null; return yardUse(z); }
  $("yardPrompt").addEventListener("click", e => { e.stopPropagation(); yardUseHere(); });
  window.addEventListener("keydown", e => {
    if (state.room !== "yard" || e.defaultPrevented) return;
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
    const key = e.key.toLowerCase();
    if (walkKeys[key]) { if (!yardPaused() || folkOpen()) { yard.keys[key] = true; if (yard.kn) { yard.kn.path = null; yard.kn.goal = null; } e.preventDefault(); } return; }
    if ((key === "e" || key === "enter") && !yardPaused()) { yardUseHere(); e.preventDefault(); return; }
    if (key === "escape" && folkOpen()) { closeFolk(); e.preventDefault(); }
  });
  window.addEventListener("keyup", e => { delete yard.keys[e.key.toLowerCase()]; });
  window.addEventListener("blur", () => { yard.keys = {}; });

  // ------------------------------------------------------------------ the well (design pass 24 section 4.9, pass 26 section 3.2 rows 7 and 9)
  const localDate = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  function wellReady() { return !!(Coin.daily && Coin.daily(profile, localDate(), SHOP).ok); }
  function shakeCoins() { const c = $("chipCoins"); c.classList.remove("shake"); void c.offsetWidth; c.classList.add("shake"); }
  // "+50" rising into the coin chip as "+N XP" rises into the Lv chip (pass 24 section 4.9); the chip counts up meanwhile
  let coinRiseTimer = null, coinCount = 0;
  function coinRise(n, from) {
    let el = $("coinRise"); if (!el) { el = document.createElement("span"); el.className = "coinrise"; el.id = "coinRise"; el.setAttribute("aria-hidden", "true"); $("chipCoins").appendChild(el); }
    if (!(n > 0)) return;
    el.textContent = "+" + n.toLocaleString();
    el.classList.remove("go", "hold"); void el.offsetWidth; el.classList.add(reduce ? "hold" : "go");
    clearTimeout(coinRiseTimer); coinRiseTimer = setTimeout(() => el.classList.remove("go", "hold"), reduce ? 1200 : 950);
    const to = profile.coins, f0 = typeof from === "number" ? from : to - n, chip = $("coins");
    clearInterval(coinCount);
    if (reduce || f0 === to) { chip.textContent = to.toLocaleString(); return; }
    const t0 = Date.now(); chip.textContent = f0.toLocaleString();
    coinCount = setInterval(() => { const q = Math.min(1, (Date.now() - t0) / 900); chip.textContent = Math.round(f0 + (to - f0) * q).toLocaleString(); if (q >= 1) clearInterval(coinCount); }, 40);
    window.TheForge.rises.push(el.textContent);
  }
  async function wellUse() {
    if (lessonOn("quiet") === true) return false;   // (inert under the lessons: its coins wait)
    if (!wellReady()) { toast("The bucket's empty. Back tomorrow."); return false; }
    const r = await World.daily(localDate());
    if (!r || !r.ok) { shakeCoins(); toast(r && r.reason ? r.reason : "The well can't pay just now"); return false; }
    yard.fx.purse = { t0: yard.t };
    renderSign(); coinRise(r.coins);
    toast("Your daily coins: +" + r.coins);
    syncYardPrompt();
    return true;
  }

  // ------------------------------------------------------------------ the folk's planks: Nell's cart, Vorn's weapons, the Rack (design pass 24 sections 4.7, 4.8, 4.10)
  // One oak plank, #folkPlank: a head (a face or a crest, the title, the folk's line, the coins), a bar, a list. Nell's rows are the
  // Cart's rows moved (World.buy); Vorn's are the classes still chained, free while picks wait and for the group's coins after (World.arm);
  // the Rack's are the two hands over every weapon the knight can wield (session.equipped, session.active). They close by ✕, Esc, a tap
  // outside, or the knight walking. The folk's memory (what each has said: Folk.memory) is saved beside Grycus's
  const folk = { who: null, cls: null, mem: FK ? FK.memory(null) : null, bulk: false, said: null };
  const folkOpen = () => !$("folkPlank").hidden;
  // (design pass 34 revision 1, build 26) a folk's face a little bigger than the 48 px of the bay's weapon and the crests beside it:
  // a lesson plank's, about 58 px, at a whole number of device pixels a face pixel (Lessons.faceSize; the CSS's 58 px without it)
  function faceCanvas(who) {
    const cv = document.createElement("canvas"); cv.width = 16; cv.height = 16; cv.className = "fface"; cv.setAttribute("aria-hidden", "true");
    try { const f = FK.face(who), g = cv.getContext("2d"); f.px.forEach((c, i) => { if (c) { g.fillStyle = c; g.fillRect(i % 16, Math.floor(i / 16), 1, 1); } }); } catch (e) { /* a blank face */ }
    try { if (window.Lessons && Lessons.faceSize) cv.style.width = cv.style.height = Lessons.faceSize(Lessons.FACE.plank) + "px"; } catch (e) { /* the CSS's size */ }
    return cv;
  }
  function folkSay(who, pool, o) { if (!FK || !folk.mem) return ""; const r = FK.say(folk.mem, who, pool, o); folk.mem = r.mem; save(); return r.text || ""; }
  function folkOpening(who, o) { if (!FK || !folk.mem) return ""; const op = FK.opening(folk.mem, who, Object.assign({ now: Date.now() }, o || {})); folk.mem = op.mem; return folkSay(who, op.pool); }
  const classWeaponOf = c => window.FORGE_THINGS.find(t => t.kind === "weapon" && t.weapon.visual.base === c && !(t.parents && t.parents.length));
  function openFolk(who, o) {
    o = o || {};
    if (state.forging || state.pouring) return false;
    if (!$("setPlank").hidden) return false;
    closePlaque();
    if (yard.stick) yard.stick.up();
    folk.who = who; folk.cls = who === "bay" ? o.cls : null;
    const bayList = who === "bay" ? armoryWeapons().filter(t => classOf(t) === o.cls).sort((a, b) => (b.tier - a.tier) || a.name.localeCompare(b.name)) : [];
    const P = $("folkPlank"); P.innerHTML = ""; P.setAttribute("aria-label", who === "nell" ? "Nell's cart" : who === "vorn" ? "Vorn's weapons" : who === "bay" ? "The " + plural(o.cls) + " rack" : who === "roll" ? "The Roll of First Forges" : "The Rack");
    const head = document.createElement("div"); head.className = "fhead";
    if (who === "bay") head.appendChild(bayList.length ? sprite(bayList[0], 2) : document.createElement("canvas"));
    else if (who === "rack") { const cv = document.createElement("canvas"); try { Smithy.glyph(cv, "sword", 3); } catch (e) { /* no crest */ } head.appendChild(cv); }
    else if (who === "roll") head.appendChild(crestCanvas());
    else head.appendChild(faceCanvas(who));
    const t = document.createElement("div"); t.style.minWidth = "0"; t.innerHTML = '<div class="fwho"></div><div class="fsays" id="folkSays"></div>';
    t.querySelector(".fwho").textContent = who === "bay" ? plural(o.cls).toUpperCase() + " · " + bayList.length : who === "rack" ? "THE RACK" : who === "roll" ? rollBoard().title : FK.title(who);
    head.appendChild(t);
    const x = document.createElement("button"); x.className = "fx f-iron"; x.id = "folkClose"; x.textContent = "✕"; x.setAttribute("aria-label", "Close"); x.addEventListener("click", closeFolk); head.appendChild(x);
    P.appendChild(head);
    if (who === "nell") renderNell(P, o); else if (who === "vorn") renderVorn(P, o); else if (who === "bay") renderBay(P, o, bayList); else if (who === "roll") renderRoll(P, o); else renderRack(P, o);
    P.hidden = false;
    $("yardPrompt").hidden = true;
    return true;
  }
  function closeFolk() { if (!folkOpen()) return false; $("folkPlank").hidden = true; $("folkPlank").innerHTML = ""; folk.who = null; folk.cls = null; yard.fx.lit = null; if (!$("confirmPlank").hidden && $("confirmPlank").dataset.folk) { $("confirmPlank").hidden = true; delete $("confirmPlank").dataset.folk; } syncYardPrompt(); return true; }
  function says(text, red) { const el = $("folkSays"); if (!el) return; el.textContent = text || ""; el.classList.toggle("red", !!red); }
  function priceTag(text, cls) { const tag = document.createElement("span"); tag.className = "tag" + (cls ? " " + cls : ""); tag.textContent = text; return tag; }
  function listRow(spriteOf, name, sub, tag) {
    const b = document.createElement("button"); b.className = "cartrow"; b.type = "button";
    if (spriteOf) b.appendChild(spriteOf); else { const cv = document.createElement("canvas"); cv.width = 33; cv.height = 33; const g = cv.getContext("2d"); g.fillStyle = "#f77622"; g.fillRect(12, 6, 9, 21); g.fillStyle = "#fee761"; g.fillRect(14, 10, 5, 12); b.appendChild(cv); }
    const d = document.createElement("div"); d.innerHTML = '<div class="n"></div><div class="s"></div>'; d.firstChild.textContent = name; d.lastChild.textContent = sub; b.appendChild(d);
    if (tag) b.appendChild(tag);
    return b;
  }
  // Nell: today's Cart moved, unchanged in what it sells and what it costs (pass 24 section 4.7)
  function renderNell(P, o) {
    const n = folk.bulk ? SHOP.bulk : 1;
    const bar = document.createElement("div"); bar.className = "fbar"; bar.innerHTML = '<span><b id="folkCoins"></b> coins · crafting materials only · tap to buy ' + (n === 1 ? "one" : n) + '</span><button class="bulk f-iron" id="folkBulk" aria-pressed="' + folk.bulk + '">×5</button>';
    bar.querySelector("#folkCoins").textContent = profile.coins.toLocaleString();
    bar.querySelector("#folkBulk").addEventListener("click", () => { folk.bulk = !folk.bulk; openFolk("nell", { keep: true }); });
    P.appendChild(bar);
    const list = document.createElement("div"); list.className = "flist"; list.id = "folkList"; P.appendChild(list);
    const items = SHOP.items.map(it => ({ id: it.id, thing: world.get(it.id), store: it.store })).filter(it => it.thing);
    const order = { Elements: 0, Materials: 1, Curios: 2, Trophies: 3 }; items.sort((a, b) => order[a.store] - order[b.store]);
    const bundle = SHOP.bundles[0];
    const rowsOut = [{ id: bundle.id, name: bundle.name, sub: "one of each element · 60 off the singles", sprite: world.get("arcane-dust"), price: Coin.price(bundle.id, SHOP, profile, profile.found) }];
    for (const it of items) rowsOut.push({ id: it.id, name: it.thing.name, sub: it.store + " · you have " + have(it.id), sprite: it.thing, price: Coin.price(it.id, SHOP, profile, profile.found) });
    let litRow = null;
    for (const r of rowsOut) {
      const [unit, why] = r.price, count = r.id === bundle.id ? 1 : n;
      const tag = priceTag(unit === null ? "—" : (unit * count).toLocaleString(), unit === null ? "off" : "");
      const b = listRow(r.sprite ? sprite(r.sprite, 1) : null, r.name, why ? why : r.sub, tag);
      if (unit === null) b.classList.add("sold");
      if (yard.fx.lit === r.id) { b.classList.add("lit"); litRow = b; }
      b.addEventListener("click", async () => {
        const res = await World.buy(r.id, count);
        if (!res.ok) { tag.classList.add("red"); shakeCoins(); says(folkSay("nell", res.reason === Coin.EMBER_NOT_SOLD ? "ember" : "poor") || res.reason || "Not sold", true); setTimeout(() => tag.classList.remove("red"), 900); return; }
        toast("Bought " + (count === 1 ? "" : count + " ") + r.name + " for " + res.cost + " coins");
        yard.fx.flick = yard.t + 0.6;
        renderSign(); renderInfo();
        const keep = list.scrollTop; yard.fx.lit = null; openFolk("nell", { keep: true, said: folkSay("nell", count > 1 ? "bulk" : r.sub.startsWith("Trophies") ? "trophy" : "bought") }); const l2 = $("folkList"); if (l2) l2.scrollTop = keep;
        lessonOn("bought", r.id, res);
      });
      list.appendChild(b);
    }
    says(o.said !== undefined ? o.said : o.keep ? "" : folkOpening("nell"));
    if (litRow) requestAnimationFrame(() => { try { litRow.scrollIntoView({ block: "center" }); } catch (e) { /* in view enough */ } });
  }
  // Vorn: every class not yet held, by group, on the house while a pick waits and for coins after (pass 24 section 4.8)
  function renderVorn(P, o) {
    const C = SHOP.classes || { first: "sword", groups: [] }, free = Progress.picksLeft(profile), left = C.groups.flatMap(g => g.classes).filter(c => !profile.classes.includes(c)), all = !left.length;
    const bar = document.createElement("div"); bar.className = "fbar";
    bar.innerHTML = '<span><b id="folkCoins"></b> coins</span>' + (free > 0 ? '<span class="free">On the house: ' + free + '</span>' : "") + '<span>a class opens its rack in the Armory</span>';
    bar.querySelector("#folkCoins").textContent = profile.coins.toLocaleString();
    P.appendChild(bar);
    const list = document.createElement("div"); list.className = "flist"; list.id = "folkList"; P.appendChild(list);
    for (const g of C.groups) {
      const h = document.createElement("div"); h.className = "grp"; h.textContent = g.name + " · " + g.coins + " coins"; list.appendChild(h);
      for (const c of g.classes) {
        const t = classWeaponOf(c), own = profile.classes.includes(c), held = owned(x => classOf(x) === c).length;
        const tag = priceTag(own ? "Owned ✓" : free > 0 ? "On the house" : g.coins.toLocaleString(), own ? "own" : free > 0 ? "free" : "");   // (design pass 32: Owned, never "yours")
        const b = listRow(t ? sprite(t, 1) : null, t ? t.name : cap(c), (FK.arms(c) || "") + (held && !own ? " · you hold " + held + ", chained" : ""), tag);
        if (!own && held) b.classList.add("chained");
        if (own) b.disabled = true; else b.addEventListener("click", () => confirmClass(c, g, t, tag));
        list.appendChild(b);
      }
    }
    says(o.said !== undefined ? o.said : o.keep ? "" : folkOpening("vorn", { free, all }));
  }
  // taking a class (pass 24 section 4.8): the confirm, then World.arm; a free pick is always spent before coins
  function confirmClass(c, g, t, tag) {
    const free = Progress.picksLeft(profile) > 0, name = t ? t.name : cap(c);
    plank($("confirmPlank"), `<h3>Take up the ${esc(name)}?</h3><div class="body">Its rack goes up in the Armory, and every ${esc(name.toLowerCase())} you forge or find can be equipped.</div><div class="pbtns"><button class="f-ember primary" id="cfYes">Take it · ${free ? "on the house" : g.coins + " coins"}</button><button class="f-iron" id="cfNo">Not this one</button></div>`);
    $("confirmPlank").dataset.folk = "1";
    $("cfNo").addEventListener("click", () => { $("confirmPlank").hidden = true; delete $("confirmPlank").dataset.folk; });
    $("cfYes").addEventListener("click", async () => {
      $("confirmPlank").hidden = true; delete $("confirmPlank").dataset.folk;
      const r = await World.arm(c);
      if (!r || !r.ok) {
        if (r && r.reason === Coin.ARM_LINES.poor) { if (tag) { tag.classList.add("red"); setTimeout(() => tag.classList.remove("red"), 900); } shakeCoins(); says(folkSay("vorn", "poor") || r.reason, true); }
        else toast(r && r.reason ? r.reason : "The world refused");
        return;
      }
      state.glow = c; renderAll();
      const line = "The " + plural(c) + " rack goes up" + (r.free ? "" : " · " + r.cost + " coins");
      if (!r.free) coinRise(0, profile.coins + r.cost);
      if (folkOpen() && folk.who === "vorn") { const keep = $("folkList") ? $("folkList").scrollTop : 0; openFolk("vorn", { keep: true, said: folkSay("vorn", "bought") }); const l2 = $("folkList"); if (l2) l2.scrollTop = keep; }
      // (design pass 32) the drill over his plank, the big deal; the rack's toast waits for its Done (it would sit on the button)
      if (!openDrill(c, { group: g, free: !!r.free, cost: r.cost | 0, toast: line })) toast(line);
    });
  }
  // the Rack (pass 24 section 4.10): the two hands and every weapon the knight can wield, newest first; a chained one says who sells it
  function handsNow() { session.equipped = session.equipped.filter(id => own.has(id) && world.has(id)); const a = Math.max(0, Math.min(session.equipped.length - 1, session.active | 0)); const front = session.equipped[a], back = session.equipped.find((id, i) => i !== a); return { front: front || null, back: back || null }; }
  function setHands(front, back) { session.equipped = [front, back].filter(Boolean); session.active = 0; save(); renderPegs(); }
  // ------------------------------------------------------------------ the Roll's plank (design pass 29 section 3.6, build 24)
  // The folk's plank headed by the Roll's crest: the board's title, a line saying where you stand, a bar (your ★, what counts, how
  // fresh), the top 50 knights as rows (a rank plate gold, silver and bronze for the first three, the name, when they last forged a
  // first, a ★ tag with the count), your row lit and flashed once, and pinned under the list with your real rank when you are outside
  // it. Online: the copy kept from the last read at once under Reading the Roll…, the queue settled first (2.5 s at most), then the
  // answer; offline or signed out, the kept copy dimmed with its line. With the cloud off: the world of one's own Roll (Roll.local)
  const rollUi = { seq: 0, tab: null };
  function rollBoard() {
    const bs = window.Roll ? Roll.boards() : [];
    if (rollUi.tab === null) { try { rollUi.tab = localStorage.getItem("forge-forever:roll-tab") || ""; } catch (e) { rollUi.tab = ""; } }
    return bs.find(b => b.id === rollUi.tab) || bs[0] || { id: "first-forges", title: "THE ROLL OF FIRST FORGES", glyph: "★", what: "weapons no one had forged before", lines: {} };
  }
  function crestCanvas() {
    const cv = document.createElement("canvas"); cv.width = 16; cv.height = 16; cv.setAttribute("aria-hidden", "true");
    try { const L = Y.rollCrest(), g = cv.getContext("2d"); L.px.forEach((c, i) => { if (c) { g.fillStyle = c; g.fillRect(i % 16, Math.floor(i / 16), 1, 1); } }); } catch (e) { /* a blank crest */ }
    return cv;
  }
  function rollRowEl(r, glyph) {
    const d = document.createElement("div"); d.className = "rollrow" + (r.me ? " me" : ""); d.setAttribute("role", "listitem");
    const rk = document.createElement("span"); rk.className = "rk" + (r.medal ? " m" + r.medal : ""); rk.textContent = r.rank; d.appendChild(rk);
    const mid = document.createElement("div"); mid.style.minWidth = "0"; mid.innerHTML = '<div class="n"></div><div class="s"></div>';
    mid.firstChild.textContent = r.name; if (r.me) { const i = document.createElement("i"); i.textContent = " · you"; mid.firstChild.appendChild(i); } mid.lastChild.textContent = r.sub; d.appendChild(mid);
    const tag = document.createElement("span"); tag.className = "tag"; tag.textContent = glyph + " " + r.value; d.appendChild(tag);
    return d;
  }
  function rollPaint(P, data, st) {
    st = st || {};
    const B = rollBoard(), v = Roll.view(data, B, Object.assign({ mine: profile.firsts.weapons.length, waiting: rollMem.queue.length, name: profile.name || "You" }, st));
    says(v.line);
    const bar = P.querySelector("#rollBar"), list = P.querySelector("#folkList"), pin = P.querySelector("#rollPin"); if (!bar || !list || !pin) return;
    const bs = Roll.boards();
    bar.innerHTML = (bs.length > 1 ? '<span class="tabs" role="tablist">' + bs.map(b => `<button type="button" role="tab" aria-selected="${b.id === B.id}" data-tab="${esc(b.id)}">${esc(b.glyph + " " + b.tab)}</button>`).join("") + "</span>" : "") +
      `<span><b>${esc(v.bar.glyph)} ${v.bar.mine}</b> yours · ${esc(v.bar.what)}</span>` + (v.bar.waiting ? `<span class="wait">${v.bar.waiting} waiting to be settled</span>` : "") + `<span class="fresh">${esc(v.bar.fresh)}</span>`;
    for (const b of bar.querySelectorAll("[data-tab]")) b.addEventListener("click", () => { rollUi.tab = b.dataset.tab; try { localStorage.setItem("forge-forever:roll-tab", rollUi.tab); } catch (e) { /* not kept */ } openFolk("roll", { keep: true }); });
    list.innerHTML = ""; list.classList.toggle("dim", !!v.dim);
    if (v.empty) { const n = document.createElement("div"); n.className = "none"; n.textContent = st.why && !data ? "Nothing kept on this phone yet." : st.reading && !data ? "" : "No names yet."; list.appendChild(n); }
    for (const r of v.rows) { if (r.me && st.local) r.name = profile.name || r.name; list.appendChild(rollRowEl(r, v.bar.glyph)); }
    pin.innerHTML = ""; pin.hidden = !v.pin; if (v.pin) pin.appendChild(rollRowEl(v.pin, v.bar.glyph));
    const me = list.querySelector(".rollrow.me");
    if (me && st.flash && !reduce) me.classList.add("flash");
    if (me) requestAnimationFrame(() => { try { me.scrollIntoView({ block: "center" }); } catch (e) { /* in view enough */ } });
    roll.view = v; roll.state = st;
  }
  const roll = { view: null, state: null };
  async function renderRoll(P, o) {
    const bar = document.createElement("div"); bar.className = "fbar"; bar.id = "rollBar"; P.appendChild(bar);
    const list = document.createElement("div"); list.className = "flist"; list.id = "folkList"; list.setAttribute("role", "list"); P.appendChild(list);
    const pin = document.createElement("div"); pin.className = "fpin"; pin.id = "rollPin"; pin.hidden = true; P.appendChild(pin);
    const seq = ++rollUi.seq, live = () => seq === rollUi.seq && folkOpen() && folk.who === "roll";
    const B = rollBoard();
    if (!rollOn()) { rollPaint(P, Roll.local(world.values(), players, profile.id), { local: true, flash: true }); return; }
    const kept = Roll.kept(B.id, "all");
    rollPaint(P, kept ? kept.data : null, { reading: true, keptAt: kept ? kept.at : null });
    await Promise.race([settleQueue(), new Promise(res => setTimeout(res, 2500))]);
    if (!live()) return;
    const r = await Roll.read(B.id, "all", 6000);
    if (!live()) return;
    if (r.ok) rollPaint(P, r.data, { flash: true });
    else rollPaint(P, r.kept ? r.kept.data : null, { why: r.why, keptAt: r.kept ? r.kept.at : null });
  }
  function renderRack(P, o) {
    const H = handsNow();
    const hands = document.createElement("div"); hands.className = "hands";
    const slot = (id, label, front) => { const t = id ? world.get(id) : null, b = document.createElement("button"); b.type = "button"; b.className = "hand f-slot" + (front ? " front" : "") + (t ? "" : " empty"); if (t) b.appendChild(sprite(t, 2)); else { const cv = document.createElement("canvas"); cv.width = 1; cv.height = 1; b.appendChild(cv); } const d = document.createElement("div"); d.style.minWidth = "0"; d.innerHTML = "<b></b><span></span>"; d.querySelector("b").textContent = t ? t.name : "Empty"; d.querySelector("span").textContent = label; b.appendChild(d); b.disabled = true; return b; };
    hands.appendChild(slot(H.front, "In front · you strike with it", true)); hands.appendChild(slot(H.back, "Behind · Swap in the cellar", false));
    const sw = document.createElement("button"); sw.type = "button"; sw.className = "swaphands f-iron"; sw.id = "swapHands"; sw.textContent = "Swap hands"; sw.disabled = !(H.front && H.back);
    sw.addEventListener("click", () => { const h = handsNow(); setHands(h.back, h.front); openFolk("rack", { keep: true }); toast((handsNow().front ? world.get(handsNow().front).name : "Nothing") + " is in front"); });
    hands.appendChild(sw);
    P.appendChild(hands);
    const list = document.createElement("div"); list.className = "flist"; list.id = "folkList"; P.appendChild(list);
    const mine = owned(t => F.isWeapon(t)).sort((a, b) => own.get(b.id).seq - own.get(a.id).seq);
    if (!mine.length) { const e = document.createElement("div"); e.className = "empty"; e.textContent = "No weapons yet. Forge one."; list.appendChild(e); }
    for (const t of mine) {
      const can = canWield(t), where = t.id === H.front ? "in front" : t.id === H.back ? "behind" : "on the shelf";
      const tag = priceTag(can ? where : "chained", can ? (t.id === H.front ? "free" : "own") : "off");
      const b = listRow(sprite(t, 1), t.name, can ? (TIER[t.tier] || "") + " " + (classOf(t) || "") : "Vorn sells the class, in the courtyard", tag);
      if (!can) b.classList.add("chained");
      if (!can || t.id === H.front) b.disabled = true;
      else b.addEventListener("click", () => { const h = handsNow(); setHands(t.id, h.front && h.front !== t.id ? h.front : (h.back !== t.id ? h.back : null)); const keep = list.scrollTop; openFolk("rack", { keep: true }); const l2 = $("folkList"); if (l2) l2.scrollTop = keep; toast(t.name + " is in front"); });
      list.appendChild(b);
    }
    says(o.said !== undefined ? o.said : "Your two hands. The one in front is the one you strike with.");
  }
  // a bay of the Armory opened from its plate (2026-10-07): every weapon of the class the smith holds, the rarest first and by name within
  // a tier, the same order as the shelves, which show only the first six. A row opens the weapon's plaque in view mode over the hall
  function renderBay(P, o, list) {
    const cls = o.cls, n = list.length, shown = Math.min(n, window.Armory ? Armory.SHOW : 6);
    const bar = document.createElement("div"); bar.className = "fbar"; bar.innerHTML = "<span></span>";
    bar.firstChild.textContent = n > shown ? `${n} ${plural(cls).toLowerCase()} held · the shelves show the rarest ${shown} · tap one to read its plaque` : `every ${cls} you hold · tap one to read its plaque`;
    P.appendChild(bar);
    const el = document.createElement("div"); el.className = "flist"; el.id = "folkList"; P.appendChild(el);
    if (!n) { const e = document.createElement("div"); e.className = "empty"; e.textContent = `No ${plural(cls).toLowerCase()} held.`; el.appendChild(e); }
    list.forEach((t, i) => {
      const o2 = own.get(t.id), mine = (t.discovery || {}).first === profile.id;
      const sub = [TIER[t.tier] || "", mine ? "★ first forged by you" : "", i >= shown ? "not on the shelves" : ""].filter(Boolean).join(" · ");
      const b = listRow(sprite(t, 1), t.name, sub, o2 && o2.n > 1 ? priceTag("×" + o2.n, "own") : null);
      b.dataset.id = t.id; b.classList.add("bayrow");
      b.addEventListener("click", () => { closeFolk(); viewWeapon(t); });
      el.appendChild(b);
    });
    says(o.said !== undefined ? o.said : (n > shown ? "The rarest stand on the shelves; the rest are here." : "Everything of the kind you hold."));
  }
  // the two hands hung on the Rack's pegs in the Forge's room (pass 24 section 4.10), drawn over the room's canvas at the rack's box
  function renderPegs() {
    const cv = $("pegs"), sc = room && room.scene, R = sc && sc.handsRack; if (!cv) return;
    if (!R || state.wallsOpen) { cv.hidden = true; return; }
    const w = R.x1 - R.x0 + 1, h = R.y1 - R.y0 + 1; cv.width = w; cv.height = h; cv.hidden = false;
    const pct = (v, of) => (100 * v / of).toFixed(3) + "%";
    cv.style.left = pct(R.x0, roomW); cv.style.width = pct(w, roomW); cv.style.top = pct(R.y0, ROOM_H); cv.style.height = pct(h, ROOM_H);
    const g = cv.getContext("2d"); g.clearRect(0, 0, w, h); g.imageSmoothingEnabled = false;
    const H = handsNow(), pegs = R.pegs || [];
    [H.front, H.back].forEach((id, n) => { const t = id ? world.get(id) : null, p = pegs[n]; if (!t || !p) return; try { g.drawImage(PF.canvasFor(t, { scale: 1, shadow: false }), Math.round(p.x - R.x0 - 16), Math.round(p.y - R.y0 - 16)); } catch (e) { /* no sprite */ } });
  }
  // from the Forge's Materials wall: Go to the cart, or a used-up thing's BUY (pass 24 section 4.7): out to the yard, the knight walks to
  // Nell and her plank opens with that row lit; under the old room graph her plank opens here
  function goToNell(litId) {
    yard.fx.lit = litId || null;
    if (noyard) { openFolk("nell"); return; }
    if (!enter("yard", { at: "forge" })) return;
    if (yard.kn && yard.Y) yard.Y.goTo(yard.kn, "nell");
  }
  $("app").addEventListener("pointerdown", e => { if (!folkOpen()) return; if (e.target.closest("#folkPlank, #confirmPlank, #drillPlaque, .sign, #setPlank, #yardZone, #yardPrompt")) return; closeFolk(); }, true);   // (pass 32: the drill's Done is not a tap outside)

  // ------------------------------------------------------------------ the Map Table (design pass 25 with its revision 1, pass 26 sections 3.2 to 3.4)
  // The map itself is proto/map-table.js (the painter, the live layer, the rules, the trip, the reveal); this is the page's side: the
  // canvas at the largest whole scale that fits the sheet under the sign, the names as buttons over it, the taps, the area's plate and
  // the legend's, Go (two steps, the soot curtain, the level's address), the trip's clock, the reveal once, and the room's one history
  // entry (pass 26 section 3.2 row 2)
  const map = { M: null, pieces: [], ground: [], bakeId: 0, L: null, raf: 0, t0: 0, last: 0, t: 0, plate: null, legend: false, trip: null, going: null, reveal: null, queue: [], wobble: null, pushed: false, then: null, cache: new Map() };
  const KEY_BROTHERS = "forge-forever:gate-brothers", KEY_PICK = "forge-forever:level-pick";
  const mstore = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { /* no storage */ } } };
  const once = (key, make) => { let v = map.cache.get(key); if (!v) { v = make(); map.cache.set(key, v); } return v; };
  const clearedNow = () => Object.assign({}, profile.cleared || {});
  const areaStates = () => { const o = {}; for (const A of MT.SPEC.areas) o[A.id] = MT.areaState(A, clearedNow()); return o; };
  function mapBoot() { if (map.M || !hasMap) return !!map.M; map.M = new MT.Room(); map.pieces = map.M.pieces.map(P => ({ P, c: [0, 1, 2, 3].map(f => canvasOf(map.M.pieceFrame(P, f))) })); return true; }
  function fitMap() {
    if (state.room !== "map" || !map.M) return null;
    const pane = $("mappane"), cv = $("map"); if (!pane.clientWidth || !pane.clientHeight) return null;
    const dpr = window.devicePixelRatio || 1, devW = pane.clientWidth * dpr, devH = pane.clientHeight * dpr, k = MT.fit(devW, devH), per = k / dpr;
    const vw = Math.min(map.M.W, Math.ceil(devW / k)), vh = Math.min(map.M.H, Math.ceil(devH / k)), cx0 = Math.floor((map.M.W - vw) / 2), cy0 = Math.floor((map.M.H - vh) / 2);   // (rounded up to the pane since design pass 30: no line of the pane beside the table)
    const same = map.L && map.L.vw === vw && map.L.vh === vh && map.L.k === k;
    cv.width = vw; cv.height = vh; cv.style.width = (vw * per) + "px"; cv.style.height = (vh * per) + "px";
    map.L = { k, per, vw, vh, cx0, cy0, dpr, paneW: pane.clientWidth, paneH: pane.clientHeight };
    if (!same) mapBake();
    placeLabels();
    if (map.plate) renderPlate();
    mapPaint(map.t);
    return map.L;
  }
  // the room's crop baked for the view: phase 0 as the room opens, the other three in idle time (pass 25 section 4.11)
  function mapBake() {
    const id = ++map.bakeId, L = map.L;
    map.ground = [canvasOf(map.M.groundFrame(0, L.cx0, L.cy0, L.vw, L.vh))];
    if (reduce) return;
    let f = 1; const idle = cb => (window.requestIdleCallback ? window.requestIdleCallback(cb, { timeout: 200 }) : setTimeout(cb, 40));
    const more = () => { if (id !== map.bakeId || f > 3) return; map.ground[f] = canvasOf(map.M.groundFrame(f, L.cx0, L.cy0, L.vw, L.vh)); f++; idle(more); };
    idle(more);
  }
  function mapEnter(o) {
    if (!mapBoot()) return;
    map.plate = null; map.legend = false; map.trip = null; map.going = null; map.wobble = null;
    $("areaPlate").hidden = true; $("legendPlate").hidden = true; $("mapCurtain").classList.remove("on");
    map.t0 = performance.now(); map.last = map.t0; map.t = 0;
    fitMap();
    // the reveal (pass 25 section 4.7): what changed since the map was last shown plays once, in order; then the map remembers
    const ch = MT.changes(MT.SPEC, profile.mapSeen, clearedNow());
    map.queue = reduce ? [] : ch.slice();
    if (reduce) for (const c of ch) revealToast(c);
    const seen = MT.seenOf(MT.SPEC, clearedNow());
    if (JSON.stringify(seen) !== JSON.stringify(profile.mapSeen || null)) { profile.mapSeen = seen; save(); }
    nextReveal();
    if (!o.noPush && !map.pushed) pushMap();
    if (map.raf) cancelAnimationFrame(map.raf);
    map.raf = requestAnimationFrame(mapFrame);
  }
  function mapLeave() { if (map.raf) cancelAnimationFrame(map.raf); map.raf = 0; map.plate = null; map.legend = false; $("areaPlate").hidden = true; $("legendPlate").hidden = true; $("mapLabels").replaceChildren(); $("mapCurtain").classList.remove("on"); }
  function revealToast(c) { const W = MT.SPEC.words; if (c.kind === "open") toast(W.opened.replace("{name}", c.name)); else if (c.kind === "won") toast(W.won.replace("{name}", c.name)); }
  function nextReveal() {
    const c = map.queue.shift(); if (!c) { map.reveal = null; return; }
    map.reveal = { kind: c.kind, area: c.area, level: c.level, t0: map.t }; revealToast(c);
    const ms = (MT.REVEAL_S[c.kind] || 1) * 1000; setTimeout(() => { if (map.reveal && map.reveal.t0 === ms && false) return; if (state.room === "map") nextReveal(); }, ms);
  }
  const revealing = () => !!map.reveal;
  // the Map Table's history entry (pass 26 section 3.2 row 2): pushed as the room opens (not under ?room=map); the phone's back, ←
  // Courtyard and Esc take it off and the popstate leaves the room; Go takes it off before the level loads, so the castle page is right
  // behind the level and Home steps back onto it
  function pushMap() { try { window.history.pushState(Object.assign({}, histState(), { ffRoom: "map" }), ""); map.pushed = true; } catch (e) { map.pushed = false; } }
  function popMap(then) {
    if (!map.pushed) { then(); return; }
    map.then = then;
    const t = setTimeout(() => { if (map.then === then) { map.then = null; map.pushed = false; then(); } }, 600);
    window.addEventListener("pagehide", () => clearTimeout(t), { once: true });
    try { window.history.back(); } catch (e) { clearTimeout(t); map.then = null; map.pushed = false; then(); }
  }
  window.addEventListener("popstate", e => {
    const st = e.state && typeof e.state === "object" ? e.state : {};
    if (state.room === "map" && st.ffRoom !== "map") { map.pushed = false; const then = map.then; map.then = null; if (then) then(); else enter("yard", { at: "table" }); }
    else if (state.room !== "map" && st.ffRoom === "map" && hasMap && !noyard) { enter("map", { noPush: true }); map.pushed = true; }   // (forward onto the entry: it is the room's again)
  });
  function leaveMap() { if (state.room !== "map") return false; closeLegend(); popMap(() => enter("yard", { at: "table" })); return true; }
  $("armoryBtn").addEventListener("click", () => leaveMap());
  // sheet pixels to the pane's CSS pixels (the canvas is centred in the pane)
  function toCss(x, y) { const L = map.L, cv = $("map"), SX = map.M.SX, SY = map.M.SY; return { x: cv.offsetLeft + (SX + x - L.cx0) * L.per, y: cv.offsetTop + (SY + y - L.cy0) * L.per }; }
  function pipsOf(A) { return MT.levelRows(A, clearedNow()).rows.map(r => r.state === "cleared" ? "●" : r.state === "soon" ? "·" : "○").join(""); }
  // the names on the map (pass 25 section 4.3): HTML buttons over the canvas, each with its pips or soon; home; the legend's hit box
  function placeLabels() {
    const box = $("mapLabels"); box.replaceChildren();
    if (!map.L) return;
    const st = areaStates(), lv = lessonOn("mapView") || null;
    for (const A of MT.SPEC.areas) {
      const s0 = st[A.id], p = toCss(A.label[0], A.label[1]), b = document.createElement("button"); b.type = "button";
      b.className = "place " + s0; b.style.left = p.x + "px"; b.style.top = p.y + "px"; b.dataset.area = A.id;
      const n = MT.levelRows(A, clearedNow()).rows.filter(r => r.state === "cleared").length;
      b.innerHTML = '<span class="nm"></span><span class="tag"></span>'; b.querySelector(".nm").textContent = A.name; b.querySelector(".tag").textContent = A.pvp ? (s0 === "open" ? ((MT.SPEC.words.arena || {}).tag || "open") : "") : s0 === "soon" ? "soon" : s0 === "won" ? "✓ " + pipsOf(A) : pipsOf(A);   // (design pass 36: the Arena's tag)
      b.setAttribute("aria-label", A.name + ": " + (A.pvp ? s0 : s0 === "soon" ? "coming soon" : s0 + ", " + n + " of " + A.levels.length + " levels cleared"));
      if (lv && lv.allow && !lv.allow(A.id)) b.classList.add("dim");
      b.addEventListener("click", e => { e.stopPropagation(); tapArea(A.id); });
      box.appendChild(b);
    }
    const H0 = MT.SPEC.home, hp = toCss(H0.label[0], H0.label[1]), h = document.createElement("button"); h.type = "button"; h.className = "place home" + (lv && lv.allow && !lv.allow("home") ? " dim" : ""); h.style.left = hp.x + "px"; h.style.top = hp.y + "px"; h.textContent = H0.name; h.setAttribute("aria-label", "Home: the courtyard. ← Courtyard goes back in");
    h.addEventListener("click", e => { e.stopPropagation(); tapArea("home"); }); box.appendChild(h);
    const lb = MT.SPEC.legend.box, a = toCss(lb[0], lb[1]), b2 = toCss(lb[2] + 1, lb[3] + 1), lh = document.createElement("button"); lh.type = "button"; lh.className = "legendhit" + (lv && lv.allow && !lv.allow("legend") ? " dim" : ""); lh.id = "legendHit"; lh.setAttribute("aria-label", MT.SPEC.words.legend);
    lh.style.left = a.x + "px"; lh.style.top = a.y + "px"; lh.style.width = (b2.x - a.x) + "px"; lh.style.height = (b2.y - a.y) + "px";
    lh.addEventListener("click", e => { e.stopPropagation(); tapArea("legend"); }); box.appendChild(lh);
  }
  // a tap on the canvas: its sheet point, and what lies there (pass 25 section 4.5)
  function mapTapAt(gx, gy) {
    const L = map.L; if (!L) return;
    const pane = $("mappane"), cv = $("map"), x = (gx - pane.offsetLeft - cv.offsetLeft) / L.per + L.cx0 - map.M.SX, y = (gy - pane.offsetTop - cv.offsetTop) / L.per + L.cy0 - map.M.SY;
    const hit = MT.hitAt(MT.SPEC, x, y);
    if (hit) tapArea(hit); else if (map.legend) closeLegend(); else if (map.plate) closePlate();
  }
  if (ST) ST.tap($("map"), { toGame, paused: () => state.room !== "map" || !!map.going || revealing(), onTap: (gx, gy) => mapTapAt(gx, gy) });
  else $("map").addEventListener("click", e => { if (state.room !== "map" || map.going) return; const [gx, gy] = toGame(e.clientX, e.clientY); mapTapAt(gx, gy); });
  function tapArea(id) {
    if (state.room !== "map" || map.going || revealing()) return false;
    const lv = lessonOn("mapView") || null;
    if (lv && lv.allow && !lv.allow(id)) { lessonOn("offTap"); return false; }
    const W = MT.SPEC.words, st = areaStates();
    if (id === "legend") { if (map.legend) return closeLegend(); if (map.plate) closePlate(); map.legend = true; renderLegend(); return true; }
    if (map.legend) closeLegend();
    if (id === "home") { toast(W.home); return true; }
    const A = MT.SPEC.areas.find(a => a.id === id); if (!A) return false;
    const s0 = st[id];
    if (s0 === "soon") { map.wobble = { area: id, t0: map.t }; toast(W.soon.replace("{name}", A.name)); return true; }
    if (map.plate === id) return true;
    if (s0 === "shut") { map.plate = id; renderPlate(); return true; }   // (rows locked, the knight stays home)
    map.plate = id; map.trip = { area: id, t0: map.t, back: false };
    renderPlate();
    lessonOn("plate", id);
    return true;
  }
  function closePlate() { if (!map.plate) return false; if (map.trip && !map.trip.back) map.trip = { area: map.plate, t0: map.t, back: true }; map.plate = null; $("areaPlate").hidden = true; return true; }
  function closeLegend() { if (!map.legend) return false; map.legend = false; $("legendPlate").hidden = true; return true; }
  const sentence = w => w.charAt(0) + w.slice(1).toLowerCase();
  function renderLegend() {
    const el = $("legendPlate"), Lg = MT.SPEC.legend, W = MT.SPEC.words;
    if (!map.legend) { el.hidden = true; return; }
    el.innerHTML = '<button type="button" class="x" id="legendBack" aria-label="Back to the map">✕</button><h5></h5><div class="keys">'
      + Lg.rows.map(r => '<div><canvas data-sign="' + esc(r.sign) + '" width="11" height="5" aria-hidden="true"></canvas><b>' + esc(sentence(r.word)) + '</b><span>' + esc(r.says) + '</span></div>').join("")
      + '<div><span class="pips" aria-hidden="true">●○·</span><b>Levels</b><span>' + esc(Lg.pips) + '</span></div></div>';
    el.querySelector("h5").textContent = W.legend;
    el.hidden = false;
    el.querySelectorAll("canvas").forEach(c => { try { const sg = MT.sign(c.dataset.sign), g = c.getContext("2d"); for (let y = 0; y < sg.h; y++) for (let x = 0; x < sg.w; x++) { const col = sg.px[y * sg.w + x]; if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } } } catch (e) { /* no sign */ } });
    $("legendBack").addEventListener("click", closeLegend);
  }
  // the area's plate (pass 25 section 4.5): its levels with their states, the picked row lit, Go alone and Bring sword-brothers 1 2 3
  // (the last choice remembered), ✕ back to the map; a shut area's rows locked
  function renderPlate() {
    const el = $("areaPlate"), A = MT.SPEC.areas.find(a => a.id === map.plate); if (!A) { el.hidden = true; return; }
    if (A.pvp) return renderArenaPlate(el, A);   // (design pass 36) the Arena's plate: its line and one button
    const W = MT.SPEC.words, st = areaStates()[A.id], R = MT.levelRows(A, clearedNow(), mstore.get(KEY_PICK));
    const pick = R.pick, last = Math.max(0, Math.min(3, parseInt(mstore.get(KEY_BROTHERS), 10) || 0)), lv = lessonOn("mapView") || null, lit = !!(lv && lv.goOnly);
    el.className = "mapplate f-plank " + (A.place[0] > 256 ? "left" : "right");
    el.setAttribute("aria-label", A.name);
    const rows = R.rows.map(r => {
      const pickable = st !== "shut" && (r.state === "open" || r.state === "cleared");
      const sTxt = r.state === "cleared" ? W.cleared : r.state === "open" ? (st === "shut" ? W.shut.replace("{name}", A.name) : W.open) : r.state === "locked" ? W.locked.replace("{need}", String(r.need).replace(/^The\b/, "the")) : "soon";
      return '<button type="button" data-id="' + esc(r.id) + '" class="' + r.state + (lit ? " off" : "") + '" aria-pressed="' + String(pick === r.id) + '"' + (pickable && !lit ? "" : " disabled") + '><span>' + r.n + '</span><span class="nm">' + esc(r.name) + (r.boss ? ' <span class="st">· ' + esc(r.boss) + '</span>' : "") + '</span><span class="st">' + esc(sTxt) + '</span></button>';
    }).join("");
    const shut = st === "shut";
    el.innerHTML = '<button type="button" class="x' + (lit ? " off" : "") + '" id="plateBack" aria-label="Back to the map">✕</button><h5></h5><div class="line"></div><div class="lv">' + rows + '</div>'
      + '<button type="button" class="f-ember alone" id="goAlone" aria-pressed="' + String(last === 0) + '"' + (shut || !pick ? " disabled" : "") + '>' + esc(W.alone) + '</button>'
      + '<div class="party"><span class="small">' + esc(W.brothers) + '</span>' + [1, 2, 3].map(n => '<button type="button" class="f-iron' + (lit ? " off" : "") + '" id="goB' + n + '" data-b="' + n + '" aria-pressed="' + String(last === n) + '"' + (shut || !pick ? " disabled" : "") + '>' + n + '</button>').join("") + '</div>';
    el.querySelector("h5").textContent = A.name; el.querySelector(".line").textContent = shut ? W.shut.replace("{name}", (MT.SPEC.areas.find(a => a.levels.some(l => l.id === A.opensAfter)) || {}).name || A.name) : A.line;
    el.hidden = false;
    el.querySelectorAll(".lv button").forEach(b => b.addEventListener("click", () => { if (b.disabled) return; mstore.set(KEY_PICK, b.dataset.id); renderPlate(); }));
    $("goAlone").addEventListener("click", () => goLevel(A, 0));
    el.querySelectorAll(".party button").forEach(b => b.addEventListener("click", () => goLevel(A, +b.dataset.b)));
    $("plateBack").addEventListener("click", closePlate);
    if (!coarse) { const g = $("goAlone"); if (g && !g.disabled) g.focus(); }
  }
  // (design pass 36, build 27) the Arena's plate: ✕, its name, its line (shut: clear the castle first), and To the Gate of Champions
  function renderArenaPlate(el, A) {
    const W = MT.SPEC.words, AW = W.arena || {}, st = areaStates()[A.id], shut = st === "shut", lv = lessonOn("mapView") || null, lit = !!(lv && lv.goOnly);
    el.className = "mapplate f-plank " + (A.place[0] > 256 ? "left" : "right");
    el.setAttribute("aria-label", A.name);
    el.innerHTML = '<button type="button" class="x' + (lit ? " off" : "") + '" id="plateBack" aria-label="Back to the map">✕</button><h5></h5><div class="line"></div>'
      + '<button type="button" class="f-ember alone" id="goArena"' + (shut || lit ? " disabled" : "") + '>' + esc(AW.go || "To the Gate of Champions") + '</button>';
    el.querySelector("h5").textContent = A.name; el.querySelector(".line").textContent = shut ? (AW.shut || W.shut.replace("{name}", "the Troll Castle")) : (AW.open || A.line);
    el.hidden = false;
    $("goArena").addEventListener("click", () => goArena(A));
    $("plateBack").addEventListener("click", closePlate);
    if (!coarse) { const g = $("goArena"); if (g && !g.disabled) g.focus(); }
  }
  // To the Gate of Champions: as Go, to the Battlegrounds page's ?area=arena (no brothers; the house's knights are the Arena's own)
  function goArena(A) {
    if (map.going || state.room !== "map" || session.leaving) return null;
    map.going = { area: A.id, t0: map.t };
    const url = MT.levelUrl({ area: A.area || "arena" }, 0, cellarUrl());
    gryHush();
    session.equipped = session.equipped.filter(x => own.has(x) && world.has(x));
    save();
    const sent = writeHandoff(null);
    markWent("road");
    window.TheForge.wentDown = { url, sent, try: null, how: "push", level: "arena", brothers: 0 };
    lessonOn("go", "arena", 0);
    const quick = reduce || params.get("harness") === "1";
    const leave = () => { if (stay) return; popMap(() => { session.leaving = true; window.location.href = url + "#from=forge"; }); };
    setTimeout(() => { $("mapCurtain").classList.add("on"); setTimeout(leave, quick ? 0 : 320); }, quick ? 0 : 250);
    return url;
  }
  // Go (pass 25 section 4.5, pass 26 row 11): the knight takes two steps into the place, the soot curtain falls, the handoff and the save
  // are written, the Map Table's history entry comes off, and the level's address is pushed plainly with #from=forge
  function goLevel(A, n) {
    if (map.going || state.room !== "map" || session.leaving) return null;
    const R = MT.levelRows(A, clearedNow(), mstore.get(KEY_PICK)), row = R.rows.find(r => r.id === R.pick); if (!row) return null;
    n = Math.max(0, Math.min(3, n | 0));
    mstore.set(KEY_BROTHERS, n); mstore.set(KEY_PICK, row.id);
    map.going = { area: A.id, t0: map.t };
    const url = MT.levelUrl(row, n, cellarUrl());
    gryHush();
    session.equipped = session.equipped.filter(x => own.has(x) && world.has(x));
    save();
    const sent = writeHandoff(null);
    markWent("road");
    window.TheForge.wentDown = { url, sent, try: null, how: "push", level: row.area, brothers: n };
    lessonOn("go", row.id, n);
    const quick = reduce || params.get("harness") === "1";
    const leave = () => { if (stay) return; popMap(() => { session.leaving = true; window.location.href = url + "#from=forge"; }); };
    setTimeout(() => { $("mapCurtain").classList.add("on"); setTimeout(leave, quick ? 0 : 320); }, quick ? 0 : 250);
    return url;
  }
  function mapFrame(now) {
    if (state.room !== "map") { map.raf = 0; return; }
    const dt = Math.max(0, Math.min(0.05, (now - map.last) / 1000)); map.last = now; map.t += dt;
    if (map.trip && map.trip.back && map.t - map.trip.t0 > 1.2) map.trip = null;
    if (map.reveal && map.t - map.reveal.t0 > (MT.REVEAL_S[map.reveal.kind] || 1) + 0.05) nextReveal();
    if (map.L) mapPaint(map.t);
    map.raf = requestAnimationFrame(mapFrame);
  }
  const trollC = (kind, facing, anim, i) => once("t" + kind + facing + anim + i, () => { const fr = TR.frame(kind, facing, anim, i); return pxCanvas(fr.px, fr.N, fr.N); });
  const pawnC = () => once("pawn", () => { const P = MT.pawn(); return { c: pxCanvas(P.px, P.w, P.h), ox: P.ox, oy: P.oy }; });
  const shadeC = (kind, i) => once("s" + kind + i, () => { const s = MT.shade(kind, i); return { c: pxCanvas(s.px, s.w, s.h), ox: s.ox, oy: s.oy }; });
  const bannerC = (kind, f, clean) => once("b" + kind + f + clean, () => { const b = MT.banner(kind, f, clean); return { c: pxCanvas(b.px, b.w, b.h), oy: b.oy }; });
  const crowC = f => once("c" + f, () => { const c = MT.crow(f); return { c: pxCanvas(c.px, c.w, c.h), ox: c.ox, oy: c.oy }; });
  const shipC = flip => once("ship" + flip, () => { const S0 = MT.ship(); return { c: pxCanvas(S0.px, S0.w, S0.h, flip), ox: S0.ox, oy: S0.oy }; });
  const cloudC = (w, seed) => once("cl" + w + ":" + seed, () => { const c = MT.cloud(w, seed); return pxCanvas(c.px, c.w, c.h); });
  const discC = (r, a, col, px, py) => once("d" + r + ":" + a + col + px + py, () => { const BAY = Smithy.BAYER, R = r / 2, n = Math.ceil(R) * 2 + 1, c = document.createElement("canvas"); c.width = n; c.height = n; const g = c.getContext("2d"); g.fillStyle = col; const o = Math.ceil(R); for (let dy = -o; dy <= o; dy++) for (let dx = -o; dx <= o; dx++) if (dx * dx + dy * dy <= R * R && BAY[((py + dy) & 3) * 4 + ((px + dx) & 3)] < (a / 8) * 0.75) g.fillRect(dx + o, dy + o, 1, 1); return c; });
  function mapPaint(t) {
    const cv = $("map"), g = cv.getContext("2d"), L = map.L, M = map.M; if (!L || !M) return;
    const still = reduce, f = still ? 0 : Math.floor(t * 4) % 4, ox = L.cx0, oy = L.cy0, SX = M.SX, SY = M.SY;
    g.imageSmoothingEnabled = false;
    g.fillStyle = "#2a1d28"; g.fillRect(0, 0, L.vw, L.vh);
    if (map.ground[f] || map.ground[0]) g.drawImage(map.ground[f] || map.ground[0], 0, 0);
    const live = M.live(t, { states: areaStates(), trip: map.trip, going: map.going, reveal: map.reveal, still });
    const dot = (x, y, c) => { g.fillStyle = c; g.fillRect(x - ox, y - oy, 1, 1); };
    for (const r of live.road) { dot(r.x, r.y, r.hot ? "#fee761" : "#feae34"); dot(r.x + 1, r.y, r.hot ? "#fff6c8" : "#be4a2f"); dot(r.x, r.y + 1, "#be4a2f"); dot(r.x + 1, r.y + 1, "#be4a2f"); }
    for (const p of live.lava || []) dot(p.x, p.y, p.c);
    for (const p of live.glints || []) dot(p.x, p.y, p.c);
    for (const s of live.sand || []) { g.fillStyle = s.c; g.fillRect(s.x - ox, s.y - oy, s.len, 1); }
    g.fillStyle = "rgba(24,20,37,0.2)";
    for (const s of live.shadows || []) for (let dy = -s.ry; dy <= s.ry; dy++) { const hw = Math.round(s.rx * Math.sqrt(Math.max(0, 1 - (dy / s.ry) ** 2))); g.fillRect(s.x - hw - ox, s.y + dy - oy, hw * 2 + 1, 1); }
    const acts = [];
    for (const { P, c } of map.pieces) acts.push({ y: P.sy, fn: () => g.drawImage(c[f], P.x - ox, P.y - oy) });
    for (const FG of live.figures) acts.push({ y: FG.sy, fn: () => mapFigure(g, FG, t) });
    if (live.ship) { const sh = shipC(!!live.ship.flip); acts.push({ y: live.ship.y, fn: () => g.drawImage(sh.c, live.ship.x - sh.ox - ox, live.ship.y - sh.oy - oy) }); }
    acts.sort((a, b) => a.y - b.y); for (const a of acts) a.fn();
    for (const B of live.banners || []) { const b = bannerC(B.kind, B.f, B.clean); g.drawImage(b.c, B.x - ox, B.y - b.oy - oy); }
    for (const FL of live.flames || []) { const fr = MT.FLAME[FL.kind] && MT.FLAME[FL.kind][FL.f]; if (!fr) continue; const w = fr[0].length, h = fr.length; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const ch = fr[j][i]; if (ch !== ".") dot(FL.x - (w >> 1) + i, FL.y - h + 1 + j, MT.FLAME_PAL[ch]); } }
    for (const s of live.smoke || []) { const r2 = Math.max(2, Math.round(s.r * 2)), a8 = Math.max(1, Math.round(s.a * 8)), d = discC(r2, a8, s.c, s.x & 3, s.y & 3); g.drawImage(d, Math.round(s.x) - (d.width >> 1) - ox, Math.round(s.y) - (d.height >> 1) - oy); }
    for (const s of live.sparks || []) dot(s.x, s.y, s.c);
    for (const s of live.snow || []) dot(s.x, s.y, s.c);
    for (const c of live.crows || []) { const cr = crowC(c.f); g.drawImage(cr.c, c.x - cr.ox - ox, c.y - cr.oy - oy); }
    for (const c of live.clouds || []) g.drawImage(cloudC(c.w, c.seed), c.x - ox, c.y - oy);
    // the lessons' veil over the map with the Troll Castle cut out, and an ember ring round it (pass 25 section 4.10)
    const lv = lessonOn("mapView") || null;
    if (lv && lv.ring) {
      const A = MT.SPEC.areas.find(a => a.id === lv.ring); if (A) {
        const Z = A.zone, xs = Z.map(p => p[0]), ys = Z.map(p => p[1]), cx = SX + (Math.min(...xs) + Math.max(...xs)) / 2 - ox, cy = SY + (Math.min(...ys) + Math.max(...ys)) / 2 - oy, rx = (Math.max(...xs) - Math.min(...xs)) / 2 + 4, ry = (Math.max(...ys) - Math.min(...ys)) / 2 + 4;
        g.fillStyle = "rgba(13,10,20,0.62)"; g.beginPath(); g.rect(0, 0, L.vw, L.vh); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2, true); g.fill("evenodd");
        const pulse = still ? 0 : Math.round(Math.sin(t * 5) * 1.5); g.strokeStyle = "#feae34"; g.lineWidth = 2; g.setLineDash([4, 3]); g.lineDashOffset = still ? 0 : -t * 12; g.beginPath(); g.ellipse(cx, cy, rx + pulse, ry + pulse, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); g.lineWidth = 1;
      }
    }
  }
  function mapFigure(g, FG, t) {
    const L = map.L, ox = L.cx0, oy = L.cy0;
    const shadowAt = (x, y, w) => { g.fillStyle = "rgba(18,14,26,0.4)"; const X = Math.round(x) - ox, Yy = Math.round(y) - oy; g.fillRect(X - w, Yy, w * 2 + 1, 1); g.fillRect(X - Math.round(w * 0.7), Yy - 1, Math.round(w * 1.4) + 1, 1); g.fillRect(X - Math.round(w * 0.7), Yy + 1, Math.round(w * 1.4) + 1, 1); };
    if (FG.who === "troll") { shadowAt(FG.x, FG.y, 6); const c = trollC(FG.troll, FG.facing, FG.anim, FG.i); if (FG.stone !== undefined && FG.stone < 4) { g.save(); g.filter = "grayscale(" + (FG.stone / 4) + ")"; g.drawImage(c, Math.round(FG.x) - 16 - ox, Math.round(FG.y) - 31 - oy); g.restore(); } else g.drawImage(c, Math.round(FG.x) - 16 - ox, Math.round(FG.y) - 31 - oy); }
    else if (FG.who === "knight") { shadowAt(FG.x, FG.y, 6); g.drawImage(knightSprite(FG.facing, FG.anim, FG.i), Math.round(FG.x) - 16 - ox, Math.round(FG.y) - 31 - oy); }
    else if (FG.who === "pawn") {
      let dx = 0; if (map.wobble && map.wobble.area === FG.area && !reduce) { const k = t - map.wobble.t0; if (k < 0.6) dx = Math.round(Math.sin(k * 26) * (1 - k / 0.6) * 2); else map.wobble = null; }
      const P = pawnC(), sink = FG.sink || 0; shadowAt(FG.x, FG.y, 5);
      if (sink > 0) { const h = Math.max(0, Math.round(P.c.height * (1 - sink))); if (h > 0) g.drawImage(P.c, 0, 0, P.c.width, h, FG.x - P.ox - ox + dx, FG.y - P.oy - oy + (P.c.height - h), P.c.width, h); }
      else g.drawImage(P.c, FG.x - P.ox - ox + dx, FG.y - P.oy - oy);
    }
    else if (FG.who === "shade") { const s = shadeC(FG.shade, FG.i); shadowAt(FG.x, FG.y, 8); g.drawImage(s.c, FG.x - s.ox - ox, FG.y - s.oy - oy); }
  }
  window.addEventListener("keydown", e => {
    if (state.room !== "map" || e.defaultPrevented || e.key !== "Escape") return;
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
    if (plaqueOpen() || plankOpen() || !$("setPlank").hidden) return;
    e.preventDefault();
    if (map.legend) closeLegend(); else if (map.plate && !(lessonOn("mapView") || {}).goOnly) closePlate(); else leaveMap();
  });

  // ------------------------------------------------------------------ the bench
  function renderInfo() {
    const ws = owned(t => F.isWeapon(t)), total = Array.from(own.values()).reduce((s, o) => s + o.n, 0);
    const oracleRows = Array.from(rows.values()).filter(r => r.thing && r.thing.oracle && !r.thing.oracle.provisional).length;
    $("info").textContent = `Armory: ${ws.length} kinds of weapon on ${racks().length} racks, ${total} things in all. Ledger: ${rows.size} rows, ${oracleRows} from the Forge Oracle, ${kinds.length} kinds. Grammar ${G.version}, forge rules ${G.forge_rules.version}.`;
    $("worldLine").textContent = svc.url ? `World: local service at ${svc.url.replace(/^https?:\/\//, "")} · ${svc.smiths} smith${svc.smiths === 1 ? "" : "s"} · you are ${svc.player}` : `World: this page only (a world of one: firsts are first in this page's world, naming is checked by the rules only)`;
  }
  function fresh() {
    own.clear(); seq = 0; session.revealed.clear(); session.equipped = []; session.pending = [];
    profile = Progress.newProfile(svc.player || "isaac"); profile.coins = 120;
    gry.mem = GRY ? GRY.memory(null) : null;
    for (const t of window.FORGE_THINGS) if (t.kind !== "weapon" && storeOf(t) !== "Trophies") gain(t.id, 3);
    folk.mem = FK ? FK.memory(null) : null;
    rollMem = rollMemory(null, true);
    state.a = null; state.b = null; state.ma = null; state.mb = null;
    closePlaque(); if (state.room !== "forge") enter("forge"); setStation("anvil"); renderSign(); setTab("weapons"); renderSlots(); renderInfo(); save();
    openFirstWeapon();
  }
  async function grant(levels, embers) {
    const before = profile.level;
    if (svc.url) {
      let res = null;
      for (let i = 0; i < (levels || 0); i++) { const target = Progress.xpForLevel(profile.level + 1); while (profile.xp < target) { res = await World.run(30, true, false, []); if (!res) break; } }
      if (embers) toast("Grant an Ember through a boss run in service mode: Come back from a run with boss ticked");
      afterLevelChange(before, res);
    } else {
      if (levels) { profile.xp = Progress.xpForLevel(Math.min(50, profile.level + levels)); profile.level = Progress.levelFor(profile.xp); }
      if (embers) profile.embers += embers;
      const woke = before < G.fuse.level && profile.level >= G.fuse.level;   // (no Ember with the wake: Grant an Ember is the bench's way)
      save();
      afterLevelChange(before, { crucible_woke: woke });
    }
    renderSlots(); renderInfo();
  }
  $("fresh").addEventListener("click", () => { if (!lessonOn("startOver")) fresh(); });   // (build 8: the bench's Start fresh is Start the lessons over)
  $("grant").addEventListener("click", () => grant(1, 0));
  $("grantEmber").addEventListener("click", () => grant(0, 1));
  let lootRng = PF.rng(4242);
  $("run").addEventListener("click", async () => {
    const level = Math.max(1, parseInt($("runLevel").value, 10) || 1), boss = $("runBoss").checked;
    const before = profile.level;
    const hadClass = new Set(racks().map(r => r.c));
    const got = [];
    const missing = window.FORGE_THINGS.filter(t => t.kind === "weapon" && !own.has(t.id));
    if (missing.length && lootRng() < 0.5) got.push(missing[Math.floor(lootRng() * missing.length)]);
    const ings = window.FORGE_THINGS.filter(t => t.kind !== "weapon"); for (let i = 0; i < 2; i++) got.push(ings[Math.floor(lootRng() * ings.length)]);
    const finds = { gold_chests: $("runGold").checked ? 1 : 0, rare_enemies: $("runRare").checked ? 1 : 0 };   // the run's finds (design pass 10 revision 1): one each when ticked
    const res = await World.run(level, boss, false, got.map(t => t.id), finds);
    if (!res) { toast("The world can't be reached"); return; }
    const nc = got.map(classOf).find(c => c && !hadClass.has(c));
    toast(`Back from level ${level}${boss ? "'s boss" : ""}: ${res.pay.coins} coins, ${res.pay.xp} XP${res.pay.ember ? ", a Legend Ember" : ""}, ${got.map(t => t.name).join(", ")}`);
    if (nc) state.glow = nc;
    afterLevelChange(before, res, AFTER_HOME_MS);
    setTab("weapons"); renderSlots(); renderInfo();
  });
  $("fill").addEventListener("click", () => {
    const t0 = performance.now(), r = PF.rng(seq + 99);
    const weps = owned(t => F.isWeapon(t) && !t.hybrid), ings = window.FORGE_THINGS.filter(t => t.kind !== "weapon");
    let made = 0, gifts = 0;
    for (let i = 0; i < 1000; i++) {
      const A = weps[Math.floor(r() * weps.length)];
      const giftTurn = r() < 0.2 && weps.length > 1;
      const B = giftTurn ? weps[Math.floor(r() * weps.length)] : ings[Math.floor(r() * ings.length)];
      const [kase, base, added] = F.roles(A, B);
      const key = F.keyText(kase, base.id, added.id);
      if (rows.has(key)) { const t = resultOf(key); if (t) gain(t.id); continue; }
      const c = localForge(A, B, "anvil", false);
      if (!c || c.error) continue;
      gain(c.thing.id); made++; if (kase === "gift") gifts++;
      if (F.isWeapon(c.thing) && r() < 0.3) weps.push(c.thing);
    }
    const ms = Math.round(performance.now() - t0);
    renderSign(); renderArmory(); renderInfo(); setTab("weapons");
    toast(`Forged 1,000 (${made} new kinds, ${gifts} gifts) in ${ms} ms. Open the Swords rack.`);
  });
  $("week").addEventListener("click", () => {
    if (svc.url) { toast("In service mode run: python3 tools/forge_service.py simulate"); return; }
    const names = ["Mara", "Tam", "Pim", "Osk", "Vell", "Dun"];
    const r = PF.rng(77);
    const me = profile;
    let legends = 0, firsts = 0;
    const daysAgo = d => new Date(Date.now() - d * 86400000).toISOString().replace(/\.\d+Z$/, "Z");
    for (let i = 0; i < 300; i++) {
      const pid = names[i % names.length].toLowerCase();
      if (!players.some(p => p.id === pid)) players.push({ id: pid, name: names[i % names.length] });
      profile = Object.assign(Progress.newProfile(pid), { level: 30, classes: G.visual.bases.slice(), embers: 9, unnamed: [], firsts: { weapons: [], legends: [], ingredients: [] }, kinds: [], found: [] });
      const weapons = Array.from(world.values()).filter(t => F.isWeapon(t) && !t.hybrid);
      const ings = window.FORGE_THINGS.filter(t => t.kind !== "weapon");
      let c;
      if (r() < 0.1) {
        const rare = weapons.filter(t => t.tier >= 3);
        if (rare.length > 1) { const a = rare[Math.floor(r() * rare.length)], b = rare[Math.floor(r() * rare.length)]; if (a !== b && !F.fuseCheck(a, b, G)) { c = localForge(a, b, "crucible", false); if (c && c.status === "first") legends++; } }
      }
      if (!c) { const A = weapons[Math.floor(r() * weapons.length)]; const B = r() < 0.3 ? weapons[Math.floor(r() * weapons.length)] : ings[Math.floor(r() * ings.length)]; c = localForge(A, B, "anvil", false); }
      if (c && c.status === "first") { firsts++; c.thing.discovery.at = daysAgo(Math.floor(r() * 12)); c.thing.oracle.provisional = false; c.thing.oracle.notes = ["settled by the bench's week of other smiths"]; if (c.kind_founded) c.kind.at = c.thing.discovery.at; }
    }
    profile = me;
    renderArmory(); renderInfo();
    toast(`A week passes: six smiths made ${firsts} firsts and ${legends} legends. Forge a pair one of them made and its plaque names them.`);
  });
  async function connect(url, player) {
    url = (url || $("worldUrl").value).trim().replace(/\/$/, "");
    player = (player || $("smithName").value).trim() || "isaac";
    try {
      const r = await fetch(url + "/", { method: "GET" });
      const root = await r.json();
      svc.url = url; svc.player = player; svc.smiths = root.smiths || 0;
      if (GRY) gry.mem = Object.assign(GRY.memory(null), { met: true });   // (no save in service mode: he does not meet the player on every load)
      own.clear(); seq = 0; session.revealed.clear(); session.equipped = [];
      // the world's rows, then the smith
      const wr = await fetch(url + "/world"); const L = await wr.json();
      loadLedger(L);
      await refreshProfile();
      await World.kinds();
      for (const t of window.FORGE_THINGS) if (t.kind !== "weapon" && storeOf(t) !== "Trophies" && !own.has(t.id)) gain(t.id, 3);
      for (const id of profile.found || []) if (world.has(id) && !own.has(id)) gain(id);
      for (const t of world.values()) if ((t.discovery || {}).first === player && !own.has(t.id)) gain(t.id);   // your own firsts are yours
      for (const c of profile.classes) { const t = classWeapon(c); if (t && !own.has(t.id)) gain(t.id); }
      state.a = null; state.b = null; state.ma = null; state.mb = null;
      folk.mem = FK ? Object.assign(FK.memory(null), { nell: { met: true, at: null, n: {} }, vorn: { met: true, at: null, n: {} } }) : null;
      closePlaque(); if (state.room !== "forge") enter("forge"); setStation("anvil"); renderSign(); setTab("weapons"); renderSlots(); renderInfo();
      if (!profile.classes.length) openFirstWeapon();
      takeLoadoutBack();
      const ran = await takeRunBack();   // (a level's run for this smith, paid or banked by the service once)
      if (ran) { renderAll(); if (ran.cleared) afterLevelChange(ran.before, ran.res); }
      toast(`Connected: ${svc.smiths} smith${svc.smiths === 1 ? "" : "s"} in the world · you are ${player}`);
      if (session.pending.length) { try { await api("POST", "/forge/settle", { player, forges: session.pending }); session.pending = []; toast("The forge has spoken on your pending forges"); } catch (e) { /* later */ } }
      return true;
    } catch (e) {
      toast(`No world at ${url}: start it with python3 tools/forge_service.py serve`);
      return false;
    }
  }
  $("connect").addEventListener("click", () => connect());

  // ------------------------------------------------------------------ Settings: the shared switches, Erase, and the bench under Developer
  let settings = null;
  function openSettings(atBench) {
    if (state.forging || state.pouring) return false;
    if (!settings) { toast("Settings didn't load"); return false; }
    owed.hold = true;   // (build 12) a level-up owed after the plaque waits for Settings to close, so its racks never open under it
    if (!lessonOn("pinned")) closePlaque();   // (build 8: the lessons' plaque stays under Settings, so the step is not lost)
    gryHush(); closeFolk(); closeDrill();   // (design pass 32: the drill is only a show; the class is kept)
    settings.closeErase(); settings.render();
    $("setPlank").hidden = false; $("setBtn").setAttribute("aria-pressed", "true");
    if (atBench && $("bench")) { const b = $("bench"), pl = $("setPlank"); window.requestAnimationFrame(() => { pl.scrollTop = Math.max(0, b.offsetTop - 8); }); }
    return true;
  }
  function closeSettings() { $("setPlank").hidden = true; $("setBtn").setAttribute("aria-pressed", "false"); if (settings) settings.closeErase(); if (owed.hold) { owed.hold = false; if (!plaqueOpen()) afterPlaque(); } }
  // (build 9, design pass 13) on the Cloudflare copy the bench is only for a player the server says is dev or admin: Settings mounts
  // without it, and it is added when the server answers, or taken out of the page; everywhere else it is in Settings as before
  const benchGated = !!(window.Cloud && Cloud.on);
  const benchOk = () => !benchGated || Cloud.canBench();
  if (window.Settings) {
    $("bench").hidden = benchGated;
    settings = Settings.mount($("setBody"), {
      build: document.body.getAttribute("data-build") || "dev", section: benchGated ? null : $("bench"), toast,
      rows: lessonOn("settingsRows") || [], onRename(r) { lessonOn("renamed", r); },   // (build 8: Skip the lessons while they run; Your name)
      onChange(name, on) { if (name === "pour") session.assistTap = on; if (name === "motion") setMotion(Settings.reduce()); if (name === "forced") { turn.forced = on; fitTurn(); } },
      onErase() { session.erased = true; try { window.location.reload(); } catch (e) { /* the next boot starts fresh */ } },
      onClose: closeSettings
    });
  }
  if (benchGated) {
    // (a player's page keeps the bench hidden, outside Settings: renderInfo writes into it, and in phase 1 the save is the phone's anyway)
    Cloud.ready.then(() => { const b = $("bench"); if (!b) return; if (benchOk() && settings && settings.addSection) { b.hidden = false; settings.addSection(b); } else b.hidden = true; });
  }
  $("setBtn").addEventListener("click", () => { if ($("setPlank").hidden) openSettings(false); else closeSettings(); });
  $("homeBtn").addEventListener("click", () => goHome());
  window.addEventListener("keydown", e => { if (e.key === "Escape" && !$("setPlank").hidden) { e.preventDefault(); if (settings && settings.asking) settings.closeErase(); else closeSettings(); } });
  const bootAt = Date.now();
  const erasedSinceBoot = () => { if (!window.Settings) return false; const t = Date.parse(Settings.store.get(Settings.KEYS.erased) || ""); return !isNaN(t) && t >= bootAt - 1000; };

  let toastTimer;
  function toast(m) { const el = $("toast"); el.textContent = m; el.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 3200); window.TheForge && window.TheForge.toasts.push(m); }

  // ------------------------------------------------------------------ the first five minutes (design pass 16 with its revision 1, build 8)
  // Who is playing: the player record (proto/smith.js) names the save, local:<id>, and a record with no save is a new player
  // (newSmith); the dev smith, isaac, keeps returningSmith behind the bench's Play as the dev smith. The lessons are
  // proto/forge-lessons.js (window.ForgeLessons, loaded before this file), which drives them through window.TheForge. lessonOn(name,
  // ...) calls its hook of that name: who, boot, shown, quiet, pinned, strike, failed, plaque, down, bought, settingsRows, renamed,
  // startOver. Without forge-lessons.js (an old cached page) every hook is a no-op, and service mode (?world=) never runs lessons
  function lessonOn(name, ...args) {
    const FL = window.ForgeLessons;
    if (!FL || typeof FL[name] !== "function" || params.get("world")) return undefined;
    try { return FL[name](...args); } catch (e) { (window.__errors || []).push("forge-lessons " + name + ": " + (e && e.message || e)); return undefined; }
  }
  // newSmith(): a new player's start (section 3.4; the numbers are spec/lessons.json's start): level 1, no XP, 60 coins, the Sword's rack
  // the only one open and the Sword the only thing owned, equipped and on the anvil's BASE, nothing on ADD, no materials; Grycus counts
  // as met (his welcome is the lesson's); the world of one is the ledger's alone. The profile keeps the player's id and name. Saved
  function newSmith() {
    const S = (window.FORGE_LESSONS || {}).start || {}, id = profile.id, name = profile.name;
    loadLedger(ledgerAt); players.length = 0;
    own.clear(); seq = 0; session.revealed.clear(); session.pending = [];
    for (const k of Object.keys(got)) delete got[k];
    profile = Progress.newProfile(id, name);
    profile.level = S.level || 1; profile.xp = Progress.xpForLevel(profile.level); profile.coins = typeof S.coins === "number" ? S.coins : 60;
    profile.classes = (S.classes || ["sword"]).slice();
    for (const c of profile.classes) { const t = classWeapon(c); if (t) gain(t.id); }
    profile.found = Array.from(own.keys()); profile.picks = Progress.picksLeft(profile);
    session.equipped = (S.equipped || ["sword"]).filter(x => own.has(x)); session.active = 0;
    gry.mem = GRY ? Object.assign(GRY.memory(null), { met: true, greetAt: nowIso() }) : null;
    folk.mem = FK ? FK.memory(null) : null;
    rollMem = rollMemory(null, true);   // (build 24: a new knight has no old firsts to claim)
    const base = S.base || "sword";
    state.a = own.has(base) ? base : null; state.b = null; state.ma = null; state.mb = null;
    save();
  }

  // ------------------------------------------------------------------ boot: a returning smith (or the saved one), sword and fire on the anvil
  function returningSmith() {
    profile = Progress.newProfile("isaac");
    gry.mem = GRY ? GRY.memory(null) : null;
    folk.mem = FK ? FK.memory(null) : null;
    rollMem = rollMemory(null, true);   // (build 24: the dev smith's world never asks the server)
    profile.xp = Progress.xpForLevel(12); profile.level = 12; profile.coins = 312; profile.embers = 0;
    profile.classes = ["sword", "bow", "axe", "staff", "hammer"];
    own.clear(); seq = 0;
    for (const t of window.FORGE_THINGS) if (t.kind !== "weapon" && storeOf(t) !== "Trophies") gain(t.id, 3);
    for (const t of window.FORGE_THINGS) if (t.kind !== "weapon" && storeOf(t) === "Trophies") gain(t.id, 1);
    for (const r of Array.from(rows.values()).sort((a, b) => String(a.at).localeCompare(String(b.at)))) if (r.thing && !r.thing.hybrid) gain(r.thing.id);
    for (const c of profile.classes) gain(classWeapon(c).id);
    for (const t of window.FORGE_THINGS) if (t.kind === "weapon" && !own.has(t.id) && ["dagger", "shield", "whip", "wand"].includes(t.weapon.visual.base)) gain(t.id);
    profile.found = Array.from(own.keys());
    profile.picks = Progress.picksLeft(profile);
  }
  window.TheForge = { state, get profile() { return profile; }, own, world, rows, kinds, players, session, svc, pick, swap, forge, pour, setStation, openCabinet, closeCabinet, setTab, fresh, grant, connect, openNaming, submitName, openArmory, closeArmory, armoryOut, openBay, openFolk, closeFolk, folkOpen, closePlaque, confirmFirst, localForge, renderAll, toasts: [], rises: [], toast, levelLine, xpRise, hold: startHold, release: endHold, World,
    // (design pass 32) the drill: its run (seek(t) draws a moment for a check or a picture), and the doors
    openDrill, closeDrill, drillOpen, get drill() { return drill.run; },
    save, load, goDown, writeHandoff, takeLoadoutBack, takeRunBack, lastRun: null, equip, worldKey, wentDown: null, wentTo: null, goHome, openSettings, closeSettings, fitRoom, layout: null, setMotion, get reduce() { return reduce; }, get settings() { return settings; },
    // (build 17) the castle: the rooms and the two new ones (the harness steps the yard through yard.step)
    enter, get roomName() { return state.room; }, ROOMS, hasYard, hasMap, noyard, toGame, popMap, get mapPushed() { return map.pushed; }, saveYardMark, histState,
    yard: { get Y() { return yard.Y; }, get kn() { return yard.kn; }, get cam() { return yard.cam; }, get L() { return yard.L; }, get zone() { return yard.zone; }, get prompt() { return yard.promptText; }, get bakeMs() { return yard.bakeMs; }, get ground() { return yard.ground.length; }, get t() { return yard.t; }, get fx() { return yard.fx; },
      step(ms) { const n = Math.max(1, Math.round(ms / 1000 * 60)); for (let i = 0; i < n; i++) yardTick(1 / 60); if (yard.L) yardPaint(yard.t); syncYardPrompt(); return n; },
      keys(o) { yard.keys = Object.assign({}, o || {}); }, goTo(id) { return yard.kn && yard.Y ? yard.Y.goTo(yard.kn, id) : false; }, use: yardUseHere, tap: yardTap, fit: fitYard, wish: yardWish,
      stick(cx, cy, dx, dy) { return yard.stick ? yard.stick.hold(cx, cy, dx, dy) : [0, 0]; }, up() { if (yard.stick) yard.stick.up(); }, paused: yardPaused },
    map: { get M() { return map.M; }, get L() { return map.L; }, get plate() { return map.plate; }, get legend() { return map.legend; }, get trip() { return map.trip; }, get going() { return map.going; }, get reveal() { return map.reveal; }, get t() { return map.t; }, get pushed() { return map.pushed; },
      tap: tapArea, go: goLevel, closePlate, closeLegend, leave: leaveMap, fit: fitMap, states: areaStates, cleared: clearedNow, tapAt: mapTapAt, paint() { mapPaint(map.t); }, step(ms) { map.t += ms / 1000; mapPaint(map.t); } },
    openFolk, closeFolk, folkOpen, get folk() { return { who: folk.who, mem: folk.mem }; }, wellUse, wellReady, localDate, goToNell, renderPegs, handsNow, setHands, coinRise,
    // (build 24) the Roll: its queue, settling, answers and what the plank last drew
    roll: { get mem() { return rollMem; }, get on() { return rollOn(); }, get view() { return roll.view; }, get state() { return roll.state; }, settle: settleQueue, old: settleOld, apply: applyAnswers, queued, forge: settleForge },
    openWalls, closeWalls, continueOn, get wallsOpen() { return state.wallsOpen; }, get run() { return run; }, get roomW() { return roomW; }, get room() { return room; }, mountRoom, renderArmory, fitArmory, fitPlaque, armoryModel, get hall() { return hall; }, get inArmory() { return state.room === "armory"; }, fitTurn, setForced, get turned() { return turn.turned; }, get plate() { return turn.plate; }, get forced() { return turn.forced; },
    showPlaque, showLegend, viewWeapon, got, get plaqueMode() { return plaqueMode; }, traitLine,
    grycus: { get pose() { return gry.pose; }, get line() { return gry.line; }, get mem() { return gry.mem; }, get pending() { return gry.pending; }, get spot() { return gry.spot; }, get seq() { return gry.seq; },
      say: grySay, tap: gryTap, hush: gryHush, figure: gryFigure, place: gryPlace, open: gryOpen, meet: gryMeet, quiet: gryQuiet } };
  function renderAll() { renderSign(); renderSlots(); if (state.view === "wall") renderWall(); else renderCabinet(); renderArmory(); renderInfo(); }
  // (build 8, design pass 16) what forge-lessons.js reaches besides the above
  Object.assign(window.TheForge, { newSmith, returningSmith, gain, have, plural, storeOf, renderSign, renderCart, plaqueOpen, cellarUrl, menuUrl, lessons: null });
  // (build 17, design pass 26 section 3.3) where the page opens: ?room= for the checks; else the note in the address (menu, cellar, a
  // level), read here before nav.js takes it out, so a reload never looks like a new arrival; else the mark of where the page went
  // (ffWent: the cellar, the road); else the room and spot it last saved (ffYard); else the courtyard at the menu's spot
  const START = (function startRoom() {
    const q = params.get("room");
    if (q && ROOMS[q]) return { room: q, at: q === "yard" ? "menu" : null, how: "query" };
    if (noyard) return { room: "forge", how: "noyard" };
    const m = /(?:^#|&)from=(menu|cellar|level|forge)(?=&|$)/.exec(location.hash), st = histState();
    if (m) return { room: "yard", at: m[1] === "cellar" ? "cellar" : m[1] === "level" ? "road" : "menu", how: "note" };
    if (st.ffWent === "cellar" || st.ffWent === "road") return { room: "yard", at: st.ffWent, how: "went" };
    if (st.ffYard && ROOMS[st.ffYard.room]) return { room: st.ffYard.room === "map" ? "yard" : st.ffYard.room, at: st.ffYard.room === "yard" && typeof st.ffYard.x === "number" ? { x: st.ffYard.x, y: st.ffYard.y, face: st.ffYard.face } : st.ffYard.room === "map" ? "table" : null, how: "mark" };
    return { room: "yard", at: "menu", how: "fresh" };
  })();
  window.TheForge.start = START;
  if (window.Nav) Nav.arrive("forge");
  lockLandscape();
  // the pour assist follows the shared Tap to pour switch; a save from before it (assist: true) sets the switch once
  function takeAssist() { if (!window.Settings) return; if (Settings.isOn("pour")) session.assistTap = true; else if (session.assistTap) { if (!Settings.setOn("pour", true)) session.assistTap = true; } }
  fitTurn();
  window.addEventListener("resize", fitTurn);
  window.addEventListener("orientationchange", fitTurn);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", fitTurn);
  document.addEventListener("fullscreenchange", fitTurn);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitTurn);
  let bootFromCellar = false, bootFresh = false;
  const AREA_NAMES = { "castle-gate": "the Troll Gate" };
  function backPayLine(paid) { const a = paid.areas; return `Back pay for ${a.length === 1 ? AREA_NAMES[a[0]] || "a level cleared" : a.length + " levels cleared"}: +${paid.xp.toLocaleString()} XP`; }
  (async function boot() {
    // (build 9) on the Cloudflare copy the server is asked first (4.5 s at most): it may bring this phone's game back, take a newer
    // one from another phone, or say it was erased, before the page reads the player
    if (window.Cloud && Cloud.on) await Cloud.ready;
    const w = params.get("world"), p = params.get("player");
    if (w) { $("worldUrl").value = w; $("smithName").value = p || "isaac"; if (await connect(w, p || "isaac")) { takeAssist(); return; } }
    // (build 8, design pass 16) who is playing: { id, name } from the player record; "menu" when there is none, so the main menu asks
    // the name and this page gives way to it (replaced in the history: a Forge with no player is never gone back to); null for the dev
    // smith (no record under ?stay=1, the harnesses and the pictures; or no smith.js). A record with no save is a new player
    const who = lessonOn("who");
    if (who === "menu") { session.leaving = true; try { window.location.replace(menuUrl()); } catch (e) { window.location.href = menuUrl(); } return "left"; }
    if (who && who.id) profile = Progress.newProfile(who.id, who.name);
    if (!load()) {
      // (build 12) a save that is there but could not be read is not written over: the page shows a smith for the visit, unsaved
      // (save() refuses), and says so; the next opening reads the save again
      if (who && who.id && who.id !== "isaac") { newSmith(); bootFresh = !session.loadFailed; }
      else { returningSmith(); state.a = "sword"; state.b = "fire"; }
    }
    if (who && who.name) profile.name = who.name;
    takeAssist();
    bootFromCellar = takeLoadoutBack();
    const ran = await takeRunBack();   // a level's run, paid or banked once (design pass 12 section 3.11.5)
    renderAll();
    // (build 12, design pass 19 section 3.5) a save from the old XP rules was back-paid and marked in load(): it is saved now (and so
    // goes online marked). The toasts come one after another, 1.8 s apart: what a run brought home, the back pay, then the level the
    // new curve, the back pay and the run lift the save to (once, from the level the save had), with its racks to open and the
    // Crucible's wake
    {
      let n = ran ? 1 : 0;
      const moved = !!session.backPay && session.levelSaved !== null && profile.level > session.levelSaved;
      // (forge rules 3) weapons whose form was put back on load are saved now too, so the repair goes online with the save
      if (session.backPay || session.formsRepaired > 0) {
        save();
        if (session.backPay.xp > 0) { const line = backPayLine(session.backPay); if (n) setTimeout(() => toast(line), n * AFTER_HOME_MS); else toast(line); n++; }
      }
      if (moved) afterLevelChange(session.levelSaved, null, n * AFTER_HOME_MS);
      else if (ran && ran.cleared) afterLevelChange(ran.before, ran.res, AFTER_HOME_MS);
    }
    if (session.loadFailed) toast("Your game could not be opened just now. Close the game and open it again.");
    // (build 24, design pass 29) the Roll: a save from before the build claims its old firsts once, then whatever waits goes to the world
    if (rollOn() && !session.loadFailed) { settleOld(); settleQueue(); if (Cloud.status === "starting") setTimeout(settleQueue, 10000); }
    if (!profile.classes.length) openFirstWeapon();
    lessonOn("boot", { fromCellar: bootFromCellar, fresh: bootFresh });   // (build 8) the lessons start or resume, with what their step needs
  })().then(left => {
    if (left === "left") return;
    session.booted = true; fitRoom();
    // (build 17) the room the page opens in, unless the lessons chose one as they resumed; the mark of where the page went is spent
    if (!session.roomSet) enter(START.room, { at: START.at, page: params.get("page") === "legends" ? "legends" : "armory", noPush: true, cut: true });
    clearWent();
    gryOpen(bootFromCellar);
    if (params.get("bench") === "1" && benchOk()) openSettings(true); if (benchGated) Cloud.onNote(toast);
    document.body.setAttribute("data-booted", "1"); document.body.setAttribute("data-errors", String((window.__errors || []).length));
  });
  // the back gesture restores the page as it was left, without booting it: the loadout is taken then too, and a plaque that was left
  // open says what is equipped now. After an erase, or a change of less motion, elsewhere, the page boots again instead
  window.addEventListener("pageshow", async e => {
    if (!e.persisted) return;
    session.leaving = false; window.TheForge.wentTo = null; window.TheForge.wentDown = null;
    if (window.Settings && (erasedSinceBoot() || Settings.reduce() !== reduce)) { window.location.reload(); return; }
    if (window.Settings) { session.assistTap = Settings.isOn("pour"); turn.forced = Settings.isOn("forced"); }
    lockLandscape(); fitTurn();
    const took = takeLoadoutBack(), ran = await takeRunBack();
    // (build 17) back from the cellar or a level by the back gesture: the courtyard at the top of the stairs, or walking in through the gate
    { const st = histState(); if ((st.ffWent === "cellar" || st.ffWent === "road") && !noyard) { enter("yard", { at: st.ffWent, cut: true }); clearWent(); } }
    lessonOn("shown", { fromCellar: took });   // (build 8) the lessons as the other pages left them (the cellar moves them on)
    if (!took && !ran) return;
    renderAll();
    if (ran && ran.cleared) afterLevelChange(ran.before, ran.res, AFTER_HOME_MS);
    gryHush(); gryOpen(took);   // (his way-up lines are the cellar's: dummies and straw; a level's run home gets the ordinary opening)
    const eq = $("equipBtn"), t = plaqueThing;
    if (eq && t && plaqueOpen()) eq.textContent = equipLabel(t);
  });
})();
