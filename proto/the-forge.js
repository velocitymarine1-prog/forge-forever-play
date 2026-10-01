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
// pane's shape asks for): wall to wall sideways, the cellar's door on the left and the Armory's door on the right (it opens the book);
// with the walls open the room keeps its height and is cut to the station. No "Wakes at level 25" plate: the Crucible's tab says it.
// Build 4 also brings design pass 10 (card t67): the clean plaque (the rarity band, the traits in words, a legend's Strike and Ability
// rows, no flavour and no placeholders), the Armory in place of the Ledger (a shelf per class, Legends by the date acquired, any
// weapon's plaque again in view mode), and the Legend Ember found in the Battlegrounds only (spec/drops.json), never sold or given.
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
  function rowKey(r) { const kase = r.case || (r.thing && r.thing.hybrid ? "fuse" : F.roles(world.get(r.pair[0]) || { id: r.pair[0], kind: "ingredient" }, world.get(r.pair[1]) || { id: r.pair[1], kind: "ingredient" })[0]); return F.keyText(kase, r.pair[0], r.pair[1]); }
  loadLedger(ledgerAt);

  const own = new Map();      // id -> { n, seq }
  let seq = 0;
  // when each thing was first acquired (design pass 10 section 3.4.2: the Legends tab sorts by it). gain writes the date the first time a
  // thing is gained (not for gain(id, 0), which the cabinet uses to list a store's things); a save from before build 4 has none, and
  // those legends sort last
  const got = {};
  function gain(id, n) { const o = own.get(id); if (o) { o.n += n || 1; } else own.set(id, { n: n || 1, seq: ++seq }); if ((n === undefined || n > 0) && !got[id]) got[id] = nowIso(); }
  function have(id) { const o = own.get(id); return o ? o.n : 0; }
  let profile = Progress.newProfile("isaac");
  const session = { revealed: new Set(), equipped: [], active: 0, savedAt: null, slideToastShown: false, pending: [], lastClaim: null, assistTap: false, erased: false, leaving: false, booted: false };
  const state = { station: "anvil", a: null, b: null, ma: null, mb: null, forging: false, pouring: false, tab: "weapons", view: "wall", cab: null, sort: "newest", el: null, kindChip: null, q: "", glow: null, glowItem: null, bulk: false,
    ledgerOpen: false, page: "ledger", armoryOpen: null, rollWindow: "all", rollCache: null, kindsOpen: new Set(), lastCabKind: null, hold: null, wallsOpen: false, picking: false };
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
    if (svc.url || session.erased) return false;
    const stock = {}; for (const [id, o] of own) stock[id] = o.n;
    const at = nowIso();
    const mine = []; for (const [k, r] of rows) if (!ledgerRows.has(k)) mine.push({ k, r });
    const data = { profile, stock, got, equipped: session.equipped, active: session.active, assist: session.assistTap, at, rows: mine, kinds: kinds.filter(k => !ledgerKinds.has(k.key)), players };
    const put = d => { localStorage.setItem("forge-forever:" + worldKey(), JSON.stringify(d)); session.savedAt = at; return true; };
    try { return put(data); }
    catch (e) {
      // over the quota: only the rows of owned Things are kept
      try { return put(Object.assign({}, data, { rows: mine.filter(({ r }) => own.has(r.thing ? r.thing.id : r.linked_to)), players: [], trimmed: true })); }
      catch (e2) { return false; /* no storage: the page still works */ }
    }
  }
  function load() {
    try {
      const raw = localStorage.getItem("forge-forever:" + worldKey());
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (!d || !d.profile) return false;
      profile = Object.assign(Progress.newProfile(d.profile.id), d.profile);
      // the page's own rows go back into the world before the stock, so what it forged is known again
      for (const e of (d.rows || [])) { const r = e && e.r; if (!r || !e.k || rows.has(e.k)) continue; if (r.thing && r.thing.id) { if (!world.has(r.thing.id)) world.set(r.thing.id, r.thing); else r.thing = world.get(r.thing.id); } rows.set(e.k, r); }
      for (const k of (d.kinds || [])) if (k && k.key && !kinds.some(x => x.key === k.key)) kinds.push(k);
      for (const p of (d.players || [])) if (p && p.id && !players.some(x => x.id === p.id)) players.push(p);
      for (const t of world.values()) if (F.isWeapon(t) && !t.base) t.base = F.baseOf(t, world);
      own.clear(); seq = 0;
      // the dates acquired come back as saved, and none is invented: a thing the save has no date for stays undated
      for (const k of Object.keys(got)) delete got[k];
      for (const [id, at] of Object.entries(d.got || {})) if (typeof at === "string") got[id] = at;
      for (const [id, n] of Object.entries(d.stock || {})) if (world.has(id)) { const had = got[id]; gain(id, n); if (!had) delete got[id]; }
      session.equipped = (d.equipped || []).filter(id => world.has(id));
      session.active = d.active | 0;
      session.assistTap = !!d.assist;
      session.savedAt = d.at || null;
      return true;
    } catch (e) { return false; }
  }

  // ------------------------------------------------------------------ the seam with the Battlegrounds (design pass 7 section 3.9)
  const KEY_TO = "forge-forever:to-cellar", KEY_FROM = "forge-forever:from-cellar", MAX_DOWN = 400;
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
    const head = { v: 1, at: nowIso(), world: worldKey(), smith: { id: profile.id, name: profile.name || profile.id, level: profile.level, classes: profile.classes.slice() },
      loadout, active: Math.max(0, Math.min(loadout.length - 1, session.active | 0)) };
    if (tryId && !loadout.includes(tryId) && world.has(tryId)) head.try = tryId;
    try { localStorage.setItem(KEY_TO, JSON.stringify(Object.assign({}, head, { weapons: pack(ids), order: ids }))); return ids.length; }
    catch (e) {
      // over the quota: the loadout's records only; the rack then holds the loadout and the class weapons
      const few = loadout.concat(head.try ? [head.try] : []);
      try { localStorage.setItem(KEY_TO, JSON.stringify(Object.assign({}, head, { weapons: pack(few), order: few, trimmed: true }))); return few.length; }
      catch (e2) { return 0; }   // no storage: the cellar arrives visiting
    }
  }
  // the door, or Try it in the cellar on a weapon's plaque: the weapon becomes the active hand (equipped, first in first out as always,
  // when it can be wielded; practice only when it can't), and the smith goes down
  function goDown(id) {
    let tryId = null;
    const t = id ? world.get(id) : null;
    if (t && F.isWeapon(t) && own.has(id)) {
      if (canWield(t)) { if (!session.equipped.includes(id)) { session.equipped.push(id); if (session.equipped.length > 2) session.equipped.shift(); } session.active = session.equipped.indexOf(id); }
      else tryId = id;
    }
    session.equipped = session.equipped.filter(x => own.has(x) && world.has(x));
    save();
    const sent = writeHandoff(tryId);
    const url = cellarUrl(), stay = params.get("stay") === "1";
    const went = window.Nav ? Nav.go("cellar", url, { stay }) : { to: "cellar", url, how: "push" };
    window.TheForge.wentDown = { url, sent, try: tryId, how: went.how };
    if (!stay) { session.leaving = true; if (!window.Nav) window.location.href = url; }
    return sent;
  }
  // the house on the sign: back to the main menu (design pass 9 section 3.4), the handoff written so Battlegrounds from the menu
  // carries the smith's weapons; nothing while forging or pouring, like the door
  const menuUrl = () => document.body.getAttribute("data-menu") || "main-menu.html";
  function goHome() {
    if (state.forging || state.pouring || session.leaving) return null;
    session.equipped = session.equipped.filter(x => own.has(x) && world.has(x));
    save();
    writeHandoff(null);
    const url = menuUrl(), stay = params.get("stay") === "1";
    const went = window.Nav ? Nav.go("menu", url, { stay }) : { to: "menu", url, how: "push" };
    window.TheForge.wentTo = went;
    if (!stay) { session.leaving = true; if (!window.Nav) window.location.href = url; }
    return went;
  }
  // the handoff whenever the page is left or hidden (the app switched away or closed), except right after going down, so a door
  // handoff with `try` is never overwritten
  // (the handoff only: the save is already current after every action, and a save here would write an erased smithy back)
  function handoffOnLeave() { if (!session.booted || session.erased || window.TheForge.wentDown) return; writeHandoff(null); }
  window.addEventListener("pagehide", handoffOnLeave);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") handoffOnLeave(); });
  // in comes the loadout, and nothing else: taken when it is for this world and newer than the Forge's own save
  function takeLoadoutBack() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY_FROM)); } catch (e) { d = null; }
    if (!d || d.v !== 1 || !Array.isArray(d.loadout) || d.world !== worldKey()) return false;
    if (session.savedAt && d.at && Date.parse(d.at) < Date.parse(session.savedAt)) return false;   // two tabs: the Forge's own save is newer
    session.equipped = d.loadout.filter(id => world.has(id) && own.has(id) && canWield(world.get(id))).slice(0, 2);
    session.active = Math.max(0, Math.min(session.equipped.length - 1, d.active | 0));
    try { localStorage.removeItem(KEY_FROM); } catch (e) { /* no storage */ }
    save();
    if (session.equipped.length) toast("Up from the cellar with " + session.equipped.map(id => world.get(id).name).join(" and "));
    return true;
  }

  // ------------------------------------------------------------------ sprites and their four-frame particles
  const live = new Set();
  function animated(t) { return (t.weapon && (t.weapon.element !== "physical" || t.hybrid)) || (t.hints && t.hints.element && t.kind !== "weapon"); }
  function sprite(t, scale) { const cv = PF.canvasFor(t, { scale }); if (animated(t)) live.add([cv, t, scale]); return cv; }
  { let fr = 0; setInterval(() => { if (reduce) return; fr = (fr + 1) % 4; for (const e of live) { if (!e[0].isConnected) { live.delete(e); continue; } PF.draw(e[0], e[1], { scale: e[2], frame: fr }); } }, 130); }
  function silhouette(body, head) {
    const rec = { id: "sil-" + body + "-" + head, kind: "weapon", parents: ["a", "b"], weapon: { form: "slash", element: "physical", status: [], modifiers: [], numbers: {}, visual: { base: body, fuse: head, material: "steel", attachments: [], size: "M" } } };
    const sp = PF.spriteFor(rec, 0), N = PF.N, scale = 2, cv = document.createElement("canvas");
    cv.width = N * scale; cv.height = N * scale; const ctx = cv.getContext("2d");
    for (let i = 0; i < N * N; i++) if (sp.px[i]) { ctx.fillStyle = sp.px[i] === PF.OUT ? "#120e1a" : "#2c2540"; ctx.fillRect((i % N) * scale, ((i / N) | 0) * scale, scale, scale); }
    cv.className = "px"; cv.setAttribute("role", "img"); cv.setAttribute("aria-label", "not yet named");
    return cv;
  }

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
      return localForge(left, right, station, false);
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
    // chests, iron chests, rare enemies, quest Embers, by spec/drops.js), each chance rolled here; reaching level 25 gives none
    async run(level, boss, replay, things, finds) {
      if (svc.url) {
        const { code, body } = await api("POST", "/run", { player: svc.player, level, boss, replay, things, finds: finds || {} });
        if (code === 200) { await refreshProfile(); return body; }
        return null;
      }
      const before = profile.level;
      const pay = Coin.runPay(level, boss, replay, finds, window.FORGE_DROPS);
      const ember = pay.ember + pay.ember_chances.filter(p => Math.random() < p).length;
      profile.xp += pay.xp; profile.coins += pay.coins; profile.embers += ember;
      for (const id of things) { gain(id); if (!profile.found.includes(id)) profile.found.push(id); }
      profile.level = Progress.levelFor(profile.xp);
      const woke = before < G.fuse.level && profile.level >= G.fuse.level;
      save();
      return { pay: Object.assign({}, pay, { ember }), level: profile.level, levelled: profile.level > before, crucible_woke: woke };
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
    async leaderboard(win) {
      if (svc.url) {
        try {
          const { code, body } = await api("GET", "/leaderboard?window=" + win + "&limit=50&player=" + encodeURIComponent(svc.player));
          if (code === 200) { state.rollCache = { at: new Date(), win, body }; return body; }
        } catch (e) { /* fall through to the cache */ }
        return state.rollCache ? Object.assign({ stale: true, at: state.rollCache.at }, state.rollCache.body) : null;
      }
      const rs = Discovery.roll([...world.values()], kinds, players.concat([{ id: profile.id, name: profile.name }]), win);
      const mine = rs.find(r => r.player === profile.id);
      return { window: win, rows: rs.slice(0, 50), you: mine ? { rank: mine.rank, weapons: mine.weapons, legends: mine.legends, kinds: mine.kinds } : { rank: null, weapons: 0, legends: 0, kinds: 0 } };
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
  function localForge(left, right, station, pendingClaim) {
    const [kase, base, added] = F.roles(left, right, station);
    if (kase === "fuse") { const why = F.fuseCheck(base, added, G); if (why) return { error: why, status: "refused" }; }
    const key = F.keyText(kase, base.id, added.id);
    const pair = (kase === "mix" || base.id === added.id) ? [base.id, added.id].sort() : [base.id, added.id];
    const row = rows.get(key);
    const at = nowIso();
    if (row) {
      const thing = row.thing || world.get(row.linked_to);
      let status = Discovery.status(row, thing, profile.id);
      if (status === "first") { thing.discovery = { first: profile.id, at, novel: true }; countFirst(thing); }
      return claimOf(thing, status, row, kase, pair, "ledger");
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
    countFirst(v, founded);
    return claimOf(v, pendingClaim ? "pending" : "first", nrow, kase, pair, "combiner", kind, founded);
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
  function renderSign() {
    profile.level = Progress.levelFor(profile.xp);
    const next = profile.level < 50 ? Progress.xpForLevel(profile.level + 1) : profile.xp, prev = Progress.xpForLevel(profile.level);
    $("lvl").textContent = "Lv " + profile.level;
    $("xpbar").style.width = (profile.level >= 50 ? 100 : Math.round(100 * (profile.xp - prev) / Math.max(1, next - prev))) + "%";
    $("chipLevel").title = profile.level >= 50 ? "Level 50: Master Smith" : `Level ${profile.level} · ${profile.xp} XP · next at ${next}`;
    $("coins").textContent = profile.coins.toLocaleString();
    const n = profile.firsts.weapons.length;
    $("firsts").textContent = n;
    $("chipFirsts").setAttribute("aria-label", `${n} weapon${n === 1 ? "" : "s"} you forged first in the world`);
    $("chipFirsts").title = svc.url ? "World firsts: the Roll counts them" : "Firsts in this page's world";
    const awake = Progress.crucibleAwake(profile, G);
    $("chipEmbers").hidden = !awake;
    $("embers").textContent = profile.embers;
    $("title").textContent = profile.level >= 50 ? "Master Smith" : "";
    $("stCruc").classList.toggle("dim", !awake);
    $("stCrucLv").hidden = awake;
    if (room.crucible !== (awake ? "lit" : "cold")) room.setCrucible(awake ? "lit" : "cold");
    const picks = Progress.picksLeft(profile);
    profile.picks = picks;
    $("pickBadge").hidden = !(picks > 0 && profile.classes.length);
    $("pickBadge").textContent = picks + (picks === 1 ? " rack to open" : " racks to open");
    if (!awake && state.station === "crucible") setStation("anvil");
  }

  // ------------------------------------------------------------------ the stations
  // the room is as wide as the screen (design pass 14): the smithy is 112 world pixels high and W wide, W from 232 to 320, so the room
  // fills the pane sideways; the station (the hearth, the anvil, the bellows, the barrel) stays centred and the doors keep to the walls
  // (W_MIN keeps the Armory's door clear of the quench barrel; STATION is the least of the room the open view shows: the hood and the
  // anvil, so with the walls open the station fills the pane's height on any screen a phone has)
  const ROOM_H = 112, W_MIN = 232, W_MAX = 320, STATION = 76;
  let roomW = W_MIN;
  let room = Smithy.mount($("scene"), { w: roomW, h: ROOM_H, wide: true, crucible: "cold", still: reduce });
  // mount the smithy again at the width W, keeping the crucible's mode and the fire's heat; the old room's loop is stopped first so two
  // fires never draw into one canvas, and the forging's overlay is sized with the scene
  function mountRoom(W) {
    const mode = room ? room.crucible : "cold", heat = room ? room.heat : 0;
    if (room) room.stop = true;
    room = Smithy.mount($("scene"), { w: W, h: ROOM_H, wide: true, crucible: mode, still: reduce });
    room.heat = heat; roomW = W;
    const fx = $("forgeFx"); if (fx) { fx.width = W; fx.height = ROOM_H; }
    return room;
  }
  function setMotion(still) {
    reduce = !!still;
    document.documentElement.classList.toggle("still", reduce || params.get("harness") === "1");
    mountRoom(roomW);
  }
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
    const sc = room.scene, pct = (v, of) => (100 * v / of).toFixed(3) + "%";
    for (const [id, d] of [["cellarDoor", sc.door], ["armoryDoor", sc.armory]]) {
      const b = $(id); if (!b) continue;
      b.hidden = !d; if (!d) continue;
      b.style.left = pct(d.x0 - 1, roomW); b.style.width = pct(d.x1 - d.x0 + 3, roomW); b.style.top = pct(d.y0, ROOM_H); b.style.height = pct(d.y1 - d.y0 + 1, ROOM_H);
    }
    const view = bw / s;
    window.TheForge.layout = { paneW: pane.clientWidth, paneH: pane.clientHeight, roomW: el.clientWidth, roomH: el.clientHeight, W: roomW, s, view: [roomW / 2 - view / 2, roomW / 2 + view / 2], turned: turn.turned, plate: turn.plate };
    return window.TheForge.layout;
  }
  // landscape only (design pass 11 amendment 9): the cellar's rules. A phone held upright sees the turn plate; My screen won't turn
  // (the shared switch) lays the frame out at height x width and turns it a quarter; a fine pointer never sees the plate
  const coarse = params.get("pointer") ? params.get("pointer") === "coarse" : !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
  const viewport = () => { const vv = window.visualViewport; return { w: Math.max(1, Math.round(vv ? vv.width : window.innerWidth)), h: Math.max(1, Math.round(vv ? vv.height : window.innerHeight)) }; };
  function fitTurn() {
    const v = viewport(), portrait = v.h > v.w, el = $("phone");
    turn.turned = turn.forced && portrait;   // forced landscape only turns a viewport that is upright
    if (turn.turned) { el.style.width = v.h + "px"; el.style.height = v.w + "px"; el.style.transform = "translateX(" + v.w + "px) rotate(90deg)"; }
    else { el.style.width = ""; el.style.height = ""; el.style.transform = ""; }
    el.classList.toggle("forced", turn.turned);
    turn.plate = portrait && coarse && !turn.forced;
    $("turnPlate").hidden = !turn.plate;
    $("tFull").hidden = !(document.documentElement.requestFullscreen && screen.orientation && screen.orientation.lock);
    return fitRoom();
  }
  function lockLandscape() { try { const o = screen.orientation; if (o && o.lock) { const p = o.lock("landscape"); if (p && p.catch) p.catch(() => {}); } } catch (e) { /* this browser doesn't lock */ } }
  function setForced(on) { turn.forced = !!on; if (window.Settings && Settings.isOn("forced") !== turn.forced) Settings.setOn("forced", turn.forced); fitTurn(); if (settings) settings.render(); }
  $("tForce").addEventListener("click", () => setForced(true));
  $("tFull").addEventListener("click", () => { try { const p = document.documentElement.requestFullscreen(); if (p && p.then) p.then(lockLandscape).catch(() => {}); } catch (e) { /* this browser doesn't go full screen */ } });
  $("tHome").addEventListener("click", () => goHome());
  (function () { const cv = $("turnPhone"); try { Smithy.drawTurnPhone(cv, false); } catch (e) { return; } let sw = false; setInterval(() => { if ($("turnPlate").hidden || reduce) return; sw = !sw; Smithy.drawTurnPhone(cv, sw); }, 1000); })();
  // sideways, the anvil is the whole screen: the walls pane opens on the right when a slot asks to be filled, or for the Ledger, and
  // closes when the second slot is filled, when Strike or Pour falls, or by its ✕ (design pass 11, amendment 8)
  function openWalls(why) {
    if (why === "pick") state.picking = true;
    if (state.wallsOpen) return;
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
  // the two doors (design pass 14 section 3.4): the cellar's goes down, the Armory's opens the book in the walls pane; neither while
  // forging or pouring
  $("cellarDoor").addEventListener("click", () => { if (state.forging || state.pouring) return; goDown(null); });
  $("armoryDoor").addEventListener("click", () => { if (state.forging || state.pouring) return; openLedger("ledger"); });

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
  function endForging() { if (run) { run.stop(); run = null; } $("room").classList.remove("seq"); }
  function hitRoom() { const a = $("app"); a.classList.remove("hit"); void a.offsetWidth; a.classList.add("hit"); setTimeout(() => a.classList.remove("hit"), ForgeFx.BEAT); }
  async function forge() {
    if (!state.a || !state.b || state.forging || state.station !== "anvil") return;
    const A = world.get(state.a), B = world.get(state.b);
    closePlaque(); if (state.ledgerOpen) closeLedger(); closeWalls();   // (the walls close first, and the room re-lays out at once, so the slots are measured where the player saw them)
    const hadClass = new Set(racks().map(r => r.c));
    const FX = window.ForgeFx;
    const from = FX ? [slotFrom($("slotA")), slotFrom($("slotB"))] : null;
    state.forging = true; renderSlots();
    if (FX) {
      $("room").classList.add("seq");
      $("state").textContent = reduce ? "The hammer falls…" : "Into the fire…";
      run = FX.start({ canvas: $("forgeFx"), lens: $("lens"), room, from, things: [A, B], reduce, W: roomW,
        onPhase: ph => { if (ph === "blow") $("state").textContent = "The hammer falls…"; }, onStrike: hitRoom });
    } else { room.heat = 1; $("state").textContent = "The hammer falls…"; }
    const think = setTimeout(() => { if (state.forging) $("state").textContent = "The fire is thinking…"; }, 3000);
    const wait = FX ? null : new Promise(res => setTimeout(res, reduce ? 300 : 1500));
    const claim = await World.forge(A.id, B.id, "anvil");
    clearTimeout(think);
    if (!claim || claim.error) {
      if (run) { run.fail(); await run.done; }
      endForging(); state.forging = false;
      toast(claim ? claim.error : "The forge failed"); renderSlots(); return;
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
    if (!svc.url) { consume([A.id, B.id]); gain(thing.id); if (!profile.found.includes(thing.id)) profile.found.push(thing.id); save(); }
    else gain(thing.id);
    session.lastClaim = claim;
    const cls = classOf(thing);
    claim.newRack = !!(cls && !hadClass.has(cls));
    showPlaque(claim, base, added);
    if (claim.newRack) { toast("A new rack goes up: " + plural(cls)); state.glow = cls; }
    $("state").textContent = claim.status === "pending" ? "Pending: the world will settle it" : claim.status === "first" ? "First forged" : claim.status === "rediscovered" ? "Already in the world" : "A known recipe";
    renderSign();
    if (state.view === "wall") renderWall(); else renderCabinet();
    renderLedger(); renderInfo();
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
    state.pouring = true; closePlaque(); renderSlots();
    closeWalls();
    $("pour").disabled = true;
    $("phone").classList.add("pouring"); room.heat = 1;
    sparks(16, ["#fee761", "#f77622", "#ffffff", "#fff6c8"]);
    const molds = [$("moldA"), $("moldB")];
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
    if (!claim || claim.error || claim.timeout) {
      toast(claim && claim.error ? claim.error : "The Crucible needs the world: connect to fuse");
      renderSlots(); return;
    }
    const thing = claim.thing;
    session.revealed.add(F.keyText("fuse", A.id, B.id));
    if (!svc.url) { consume([A.id, B.id]); profile.embers = Math.max(0, profile.embers - G.fuse.embers); gain(thing.id); if (!profile.found.includes(thing.id)) profile.found.push(thing.id); save(); }
    else gain(thing.id);
    session.lastClaim = claim;
    state.ma = null; state.mb = null;
    const hadLegends = racks().some(r => r.c === "legendary");
    showLegend(claim, A, B);
    if (claim.status === "first") { $("phone").classList.add("burst"); sparks(22, ["#feae34", "#fee761", "#ffffff"]); setTimeout(() => $("phone").classList.remove("burst"), 1600); }
    if (!hadLegends) { state.glow = "legendary"; toast("The Legendary rack takes its first legend"); }
    $("state").textContent = claim.status === "pending" ? "Pending: the world will settle it" : claim.status === "first" ? "First forged" : "A known legend";
    renderSign(); renderSlots();
    if (state.view === "wall") renderWall(); else renderCabinet();
    renderLedger(); renderInfo();
    return claim;
  }

  // ------------------------------------------------------------------ the plaques (design pass 10 section 3.3, in amendment 8's three parts)
  // What is left says what the weapon is, how rare it is (the band), what it's made of (the recipe), what it does (the traits in words;
  // a legend's Strike and Ability rows), how strong it is (the stats), who made it first (the discovery line) and what to do next (TAP
  // ANYWHERE TO CONTINUE). No flavour, no meta line, no gift or base line, no PROVISIONAL stamp, no "Why the Oracle chose this".
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
    const d = t.discovery || {}, who = d.first === profile.id ? "you" : (d.first || "someone");
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
    p.classList.toggle("view", view);
    const btns = view
      ? (held ? `<div class="pbtns"><button class="f-ember primary" id="toAnvil">To the anvil</button>${equipBtnHTML(t)}<button class="f-iron" id="share">Share</button></div>${tryRow(t)}` : '<div class="pbtns"><button class="f-iron" id="share">Share</button></div>')
      : `<div class="pbtns">${isIng ? '<button class="f-ember primary" id="applyBtn">Apply to a weapon</button>' : equipBtnHTML(t)}<button class="f-iron" id="share">Share</button></div>${isIng ? "" : tryRow(t)}`;
    p.innerHTML = `${claim.status === "first" && !view ? '<div class="banner f-ember">First forged</div>' : ""}
      <div class="side"><div class="art"></div>${rarityHTML(t)}</div>
      <div class="main"><h2></h2><div class="kindline">${esc(recipeLine(t) || (isIng ? "" : "A class weapon"))}</div><div class="traits">${esc(traitLine(t))}</div>
      ${isIng ? '<div class="line">An ingredient, not a weapon. Put it on the anvil beside a weapon to use it.</div>' : bars(t)}</div>
      <div class="foot"><div class="line disc">${discHTML(claim, t, view)}</div><div class="btnrow">${btns}</div>${TAP_ON}</div>`;
    p.querySelector(".art").appendChild(sprite(t, 4));
    p.querySelector("h2").textContent = t.name;
    p.hidden = false;
    $("tapOn").addEventListener("click", continueOn);
    const ta = $("toAnvil"); if (ta) ta.addEventListener("click", () => toAnvil(t));
    const eq = $("equipBtn"); if (eq) eq.addEventListener("click", () => equip(t, eq));
    const ap = $("applyBtn"); if (ap) ap.addEventListener("click", () => { closePlaque(); state.a = null; state.b = t.id; renderSlots(); setTab("weapons"); openWalls("pick"); toast("Pick a weapon for the base"); });
    $("share").addEventListener("click", () => share(t));
    const tr = $("tryBtn"); if (tr) tr.addEventListener("click", () => goDown(t.id));
  }
  function tryRow(t) { return `<button class="f-iron tryit" id="tryBtn">↓ Try it in the cellar${Progress.canEquip(t, profile, G) ? "" : "<small>practice only</small>"}</button>`; }
  function hintText(t) { const h = t.hints || {}; const bits = []; if (h.element) bits.push(h.element); bits.push(...(h.forms || []), ...(h.modifiers || [])); if (h.status) bits.push(h.status); if (h.visual_part) bits.push("a " + h.visual_part); if (h.material) bits.push(h.material); return bits.join(", ") || "nothing yet"; }
  // To the anvil (a weapon opened from the Armory, pass 10 section 3.4.2): the book closes, the station is the anvil, the anvil is
  // emptied and this weapon goes on it as the base
  function toAnvil(t) { closePlaque(); closeLedger(); if (state.station !== "anvil") setStation("anvil"); state.a = null; state.b = null; pick(t.id); }
  function equip(t, btn) {
    if (!Progress.canEquip(t, profile, G)) { toast(classOf(t) === "legendary" ? "Legends can be wielded from level 25" : `The ${plural(classOf(t))} rack is chained: open the class to wield it`); return; }
    if (!session.equipped.includes(t.id)) { session.equipped.push(t.id); if (session.equipped.length > 2) session.equipped.shift(); }
    if (btn) btn.textContent = "Equipped"; save(); toast(`${t.name} goes to the Battlegrounds with you`);
  }
  // Share's text in the traits words (pass 10 section 3.3.5): "Emberbrand (uncommon sword): slashes · fire · burns · burning ground · long reach. Forged from Sword + Fire. First forged by isaac. Forge Forever"
  function share(t) {
    const cls = classOf(t);
    const named = t.naming && t.naming.status === "named" ? ` Named by ${t.naming.by}.` : "";
    const txt = `${t.name} (${TIER[t.tier]} ${cls || "ingredient"}): ${traitLine(t, false).toLowerCase()}. ${recipeLine(t) ? "Forged from " + recipeLine(t) + "." : ""}${t.discovery && t.discovery.first ? " First forged by " + t.discovery.first + "." : ""}${named} Forge Forever`;
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => toast("Copied: " + txt), () => toast(txt)); else toast(txt);
  }
  // closing the plaque (a tap anywhere, Apply, the station, the Armory, Settings) also ends the forging's overlay, unless a forge is running
  function closePlaque() { $("plaque").hidden = true; $("legendPlaque").hidden = true; plaqueMode = null; plaqueThing = null; if (!state.forging) endForging(); }
  // Tap anywhere to continue: after a forge or a pour the plaque closes, the anvil empties, the new thing's shelf item is marked to glow
  // and a toast says where it hangs; from the Armory (view mode) the plaque closes back to the Armory as it was, its class still open.
  // Nothing while the terms, naming or confirm plank is open
  const plaqueOpen = () => !$("plaque").hidden || !$("legendPlaque").hidden;
  const plankOpen = () => !$("termsPlank").hidden || !$("namePlank").hidden || !$("confirmPlank").hidden;
  function continueOn() {
    if (!plaqueOpen() || plankOpen()) return false;
    const mode = plaqueMode, t = mode === "view" ? null : session.lastClaim && session.lastClaim.thing;
    closePlaque();
    if (mode === "view") return true;
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
    if ((e.key !== "Enter" && e.key !== "Escape") || !plaqueOpen() || plankOpen() || !$("setPlank").hidden) return;
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
    p.classList.toggle("view", view);
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
      ${traits ? `<div class="traits">${esc(traits)}</div>` : ""}
      ${bars(t)}</div>
      <div class="foot"><div class="line disc">${discHTML(claim, t, view)}</div><div class="btnrow">${btns}</div>${TAP_ON}</div>`;
    p.querySelector(".art").appendChild(sprite(t, 4));
    $("legendName").textContent = t.name;
    renderNamedBy(t);
    p.hidden = false;
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
    $("termsNo").addEventListener("click", () => { el.hidden = true; toast("The offer stays open: Name it from the Armory when you're ready"); renderLedger(); });
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
    $("keepBtn").addEventListener("click", async () => { const r = await World.keep(t.id); if (r.code === 200) { el.hidden = true; toast("The Oracle's name stands: " + t.name); renderNamedBy(t); renderLedger(); renderSign(); } else toast(r.body.reason || "The world refused"); });
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
        const h = $("legendName"); if (h) { h.textContent = t.name; h.classList.remove("relit"); void h.offsetWidth; h.classList.add("relit"); }
        $("phone").classList.add("burst"); sparks(18, ["#feae34", "#fee761", "#ffffff"]); setTimeout(() => $("phone").classList.remove("burst"), 1600);
      }
      renderNamedBy(t); renderSign(); renderLedger(); renderInfo();
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
  function renderWallHead() {
    const open = profile.classes.length, nxt = Progress.nextUnlock(profile.level);
    if (state.tab === "weapons") $("wallHead").textContent = `Weapon classes: ${open} of ${CLASS_COUNT} open · Legendary ${Progress.crucibleAwake(profile, G) ? "open" : "at 25"} · ${nxt ? "next unlock at level " + nxt : "all open"}`;
    else { const n = owned(t => t.kind !== "weapon").reduce((s, t) => s + have(t.id), 0); $("wallHead").textContent = `Crafting materials: ${n} things · ${profile.coins.toLocaleString()} coins${Progress.crucibleAwake(profile, G) ? " · " + profile.embers + " Legend Ember" + (profile.embers === 1 ? "" : "s") : ""}`; }
  }
  function rackButton(cls, list, opts) {
    const b = document.createElement("button");
    b.className = "rack f-plank" + (opts.gold ? " gold" : "") + (opts.chained ? " chained" : "") + (state.glow === cls ? " new" : "");
    const newest = list.slice().sort((a, b2) => own.get(b2.id).seq - own.get(a.id).seq)[0];
    if (newest) b.appendChild(sprite(newest, 2)); else b.appendChild(silhouetteClass(cls));
    const count = list.reduce((s, t) => s + own.get(t.id).n, 0);
    b.insertAdjacentHTML("beforeend", `<b>${plural(cls)}</b><span>${opts.chained ? (opts.label || "chained") : count}</span>`);
    b.setAttribute("aria-label", `${plural(cls)}: ${list.length} kinds${opts.chained ? ", chained" : ""}`);
    b.addEventListener("click", () => { if (opts.chained && !list.length) { toast(opts.tip || `The ${plural(cls)} rack is chained: open the class to wield its weapons`); return; } openCabinet({ kind: "class", key: cls }); });
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
    renderWallHead();
    if (state.tab === "weapons") {
      const rs = racks();
      const awake = Progress.crucibleAwake(profile, G);
      const legends = rs.find(r => r.c === "legendary");
      if (awake) wall.appendChild(rackButton("legendary", legends ? legends.list : [], { gold: true }));
      for (const r of rs) if (r.c !== "legendary") { if (classOpen(r.c)) wall.appendChild(rackButton(r.c, r.list, {})); }
      for (const r of rs) if (r.c !== "legendary" && !classOpen(r.c)) wall.appendChild(rackButton(r.c, r.list, { chained: true, label: r.list.length + " chained" }));
      const seen = new Set(rs.map(r => r.c));
      for (const c of Progress.START_CHOICES) if (!seen.has(c) && !classOpen(c) && profile.classes.length) wall.appendChild(rackButton(c, [], { chained: true, label: "not taken", tip: `You did not take the ${cap(c)}: open the class at a level-up` }));
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
      const cart = document.createElement("button"); cart.className = "rack f-plank"; cart.appendChild(sprite(world.get("gold-nugget"), 2));
      cart.insertAdjacentHTML("beforeend", `<b>The Cart</b><span>${profile.coins.toLocaleString()} coins</span>`); cart.setAttribute("aria-label", "The Trader's Cart"); cart.addEventListener("click", () => openCabinet({ kind: "cart", key: "The Trader's Cart" })); wall.appendChild(cart);
    }
    state.glow = null;
  }

  // ------------------------------------------------------------------ the cabinet: an endless, windowed shelf; the cart
  const ROW_H = 96;
  let shelfList = [], perRow = 4;
  function elementOf(t) { return t.kind === "weapon" && t.weapon ? t.weapon.element : (t.hints && t.hints.element) || "physical"; }
  function cabItems() {
    const c = state.cab;
    let list = c.kind === "class" ? owned(t => classOf(t) === c.key) : owned(t => t.kind !== "weapon" && storeOf(t) === c.key);
    if (c.kind === "store") for (const t of window.FORGE_THINGS) if (t.kind !== "weapon" && storeOf(t) === c.key && !own.has(t.id) && (c.key !== "Trophies")) { gain(t.id, 0); list.push(t); }
    const els = new Set(list.map(elementOf));
    const kindIds = c.key === "legendary" ? new Set(list.map(t => t.hybrid && t.hybrid.kind).filter(Boolean)) : new Set();
    if (state.el && !els.has(state.el)) state.el = null;
    if (state.kindChip && !kindIds.has(state.kindChip)) state.kindChip = null;
    const all = list;
    if (state.el) list = list.filter(t => elementOf(t) === state.el);
    if (state.kindChip) list = list.filter(t => t.hybrid && t.hybrid.kind === state.kindChip);
    if (state.q) { const q = state.q.toLowerCase(); list = list.filter(t => t.name.toLowerCase().includes(q)); }
    const by = { newest: (a, b) => own.get(b.id).seq - own.get(a.id).seq, tier: (a, b) => b.tier - a.tier || own.get(b.id).seq - own.get(a.id).seq, name: (a, b) => a.name.localeCompare(b.name) }[state.sort];
    return { list: list.sort(by), els: Array.from(els), kindIds: Array.from(kindIds), total: all.length };
  }
  function openCabinet(c) {
    if (!c) return;
    state.cab = c; state.view = "cabinet"; state.q = ""; $("search").value = "";
    if (!state.el || c.kind !== (state.lastCabKind || c.kind)) state.el = null;
    state.kindChip = null;
    state.lastCabKind = c.kind;
    $("wall").hidden = true; $("wallHead").hidden = true; $("cabinet").hidden = false;
    $("cabTitle").textContent = c.kind === "class" ? plural(c.key) : c.key;
    $("shelves").scrollTop = 0;
    renderCabinet();
  }
  function closeCabinet() { state.view = "wall"; state.cab = null; $("cabinet").hidden = true; $("wall").hidden = false; $("wallHead").hidden = false; renderWall(); }
  function renderCabinet() {
    const c = state.cab;
    const isCart = c.kind === "cart";
    $("shelfTools").hidden = isCart; $("chips").hidden = isCart; $("shelves").hidden = isCart; $("cartHead").hidden = !isCart; $("cart").hidden = !isCart;
    if (isCart) return renderCart();
    const { list, els, kindIds, total } = cabItems();
    shelfList = list;
    $("cabCount").textContent = list.length === total ? `${total}` : `${list.length} of ${total}`;
    $("sort").textContent = state.sort.toUpperCase();
    const gl = $("giftLine");
    if (c.kind === "class" && c.key === "legendary") { gl.hidden = false; gl.textContent = `Fused in the Crucible. ${kinds.length} kind${kinds.length === 1 ? "" : "s"} named in the world.`; }
    else if (c.kind === "class" && G.classes[c.key]) { gl.hidden = false; gl.textContent = `On the right of the anvil, a ${cap(c.key)} gives ${G.classes[c.key].gift.map(w => w.replace("_", " ")).join(" or ")}`; }
    else gl.hidden = true;
    const chips = $("chips"); chips.innerHTML = "";
    if (els.length > 1) for (const e of ["all", ...els]) { const b = document.createElement("button"); const on = e === "all" ? !state.el : state.el === e; b.setAttribute("aria-pressed", String(on));
      const col = e === "all" || !PF.ELEM[e] ? "#8b9bb4" : PF.ELEM[e][2]; b.innerHTML = `<i style="background:${col}"></i>${e}`;
      b.addEventListener("click", () => { state.el = e === "all" ? null : e; $("shelves").scrollTop = 0; renderCabinet(); }); chips.appendChild(b); }
    if (kindIds.length > 1) for (const kid of kindIds) { const k = kinds.find(x => x.id === kid); const b = document.createElement("button"); b.setAttribute("aria-pressed", String(state.kindChip === kid)); b.textContent = k ? k.name : kid;
      b.addEventListener("click", () => { state.kindChip = state.kindChip === kid ? null : kid; renderCabinet(); }); chips.appendChild(b); }
    perRow = Math.max(4, Math.floor(($("shelves").clientWidth || 340) / 84));
    const nRows = Math.max(3, Math.ceil(list.length / perRow));
    $("spacer").style.height = nRows * ROW_H + "px";
    drawShelves(true);
  }
  let drawn = "";
  function drawShelves(force) {
    const sh = $("shelves"), sp = $("spacer");
    if (!shelfList.length) { sp.innerHTML = `<div class="empty">${state.q || state.el || state.kindChip ? "Nothing on this shelf matches." : "This shelf is empty. Forge something for it."}</div>`; drawn = ""; return; }
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
        b.addEventListener("click", () => { if (n === 0 && t.kind !== "weapon") { if (isForged(t)) toast(`You're out of ${t.name}: forge more`); else { openCabinet({ kind: "cart", key: "The Trader's Cart" }); toast(`You're out of ${t.name}: the Trader sells it`); } return; } if (dimWhy) { toast(dimWhy); return; } pick(t.id); });
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
  $("tabWeapons").addEventListener("click", () => { if (state.tab === "weapons" && Progress.picksLeft(profile) > 0 && profile.classes.length) { openUnlock(); return; } setTab("weapons"); });
  $("tabMaterials").addEventListener("click", () => setTab("materials"));
  $("pickBadge").addEventListener("click", e => { e.stopPropagation(); openUnlock(); });

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
      toast(`The ${plural(c)} rack goes up`);
    });
    $("cfNo").addEventListener("click", () => { $("confirmPlank").hidden = true; });
  }
  function openUnlock() {
    const picks = Progress.picksLeft(profile);
    if (picks <= 0) return;
    const el = $("unlockPlaque");
    const locked = G.visual.bases.filter(c => !profile.classes.includes(c));
    const chosen = new Set();
    el.innerHTML = `<div class="head">Level ${profile.level}. The armory grows: choose ${picks === 1 ? "one" : picks === 2 ? "two" : picks}.</div><div class="sub">Tap the racks to unchain, then open them.</div><div class="choices" id="unlockChoices"></div><div class="pbtns"><button class="f-ember primary" id="openRacks" disabled>Open the racks</button><button class="f-iron" id="unlockLater">Later</button></div>`;
    const box = el.querySelector("#unlockChoices");
    for (const c of locked) {
      const t = classWeapon(c);
      const b = document.createElement("button"); b.className = "choice chained f-plank"; b.setAttribute("aria-pressed", "false"); b.appendChild(sprite(t, 2)); b.insertAdjacentHTML("beforeend", `<b>${plural(c)}</b><span>${G.classes[c].forms.join(", ")}</span>`);
      b.addEventListener("click", () => {
        if (chosen.has(c)) { chosen.delete(c); b.setAttribute("aria-pressed", "false"); b.classList.add("chained"); }
        else if (chosen.size < picks) { chosen.add(c); b.setAttribute("aria-pressed", "true"); b.classList.remove("chained"); }
        $("openRacks").disabled = chosen.size !== Math.min(picks, locked.length);
        $("openRacks").textContent = chosen.size ? `Open the rack${chosen.size === 1 ? "" : "s"}` : "Open the racks";
      });
      box.appendChild(b);
    }
    $("openRacks").addEventListener("click", async () => {
      const list = Array.from(chosen);
      const r = await World.pick(list);
      if (!r.ok) { toast(r.reason || "The world refused"); return; }
      for (const c of list) { const t = classWeapon(c); gain(t.id); if (!profile.found.includes(t.id)) profile.found.push(t.id); }
      el.hidden = true; state.glow = list[0]; save();
      renderSign(); setTab("weapons"); renderInfo();
      toast(`The chains fall: ${list.map(plural).join(" and ")}`);
    });
    $("unlockLater").addEventListener("click", () => { el.hidden = true; renderSign(); });
    el.hidden = false;
  }
  function afterLevelChange(before, res) {
    renderSign();
    const woke = res ? res.crucible_woke : (before < G.fuse.level && profile.level >= G.fuse.level);
    if (profile.level > before) toast(`Level ${profile.level}` + (profile.level >= 50 ? ": Master Smith" : ""));
    const picks = Progress.picksLeft(profile);
    if (picks > 0 && profile.classes.length) openUnlock();
    if (woke) {
      room.setCrucible("lit");
      setTimeout(() => { toast("The Crucible wakes: melt two rare weapons into a legend"); if (!profile.embers) setTimeout(() => toast(EMBER_WHERE), 1800); }, picks > 0 ? 400 : 0);
      state.glow = "legendary";
      renderSign();
      if (state.view === "wall") renderWall();
    }
  }

  // ------------------------------------------------------------------ the book behind ARMORY (design pass 10 section 3.4, pass 14 section 3.8):
  // the Armory (a shelf per class), Legends (newest first), the Roll of First Smiths, the Book of Kinds. The element ids and
  // state.ledgerOpen keep the old name: the world's data is still the ledger; the player's word is the Armory
  function openLedger(page) {
    closePlaque();
    state.ledgerOpen = true; if (page) state.page = page;
    $("ledger").hidden = false; $("walls").hidden = true; $("ledgerBtn").setAttribute("aria-pressed", "true");
    openWalls("ledger");
    renderLedger();
  }
  function closeLedger() { if (plaqueMode === "view") closePlaque(); state.ledgerOpen = false; $("ledger").hidden = true; $("walls").hidden = false; $("ledgerBtn").setAttribute("aria-pressed", "false"); if (!state.picking) closeWalls(); }
  $("ledgerBtn").addEventListener("click", () => { if (state.ledgerOpen) closeLedger(); else openLedger("ledger"); });
  $("ledgerClose").addEventListener("click", closeLedger);   // the book's own ✕ (design pass 14 section 3.8): the pane closes too unless a slot is waiting
  $("chipFirsts").addEventListener("click", () => openLedger("roll"));   // the ★ chip opens the Roll: its page is about firsts
  const PAGES = [["pgLedger", "ledger"], ["pgLegends", "legends"], ["pgRoll", "roll"], ["pgKinds", "kinds"]];
  for (const [id, pg] of PAGES) $(id).addEventListener("click", () => { state.page = pg; renderLedger(); });
  function renderLedger() {
    $("ledgerBtn").textContent = "ARMORY";
    if (!state.ledgerOpen) return;
    for (const [id, pg] of PAGES) $(id).setAttribute("aria-selected", String(state.page === pg));
    const el = $("ledgerBody");
    if (state.page === "roll") return renderRoll(el);
    if (state.page === "kinds") return renderKinds(el);
    if (state.page === "legends") return renderLegends(el);
    return renderArmory(el);
  }
  // the smith's weapons: everything held now or ever found (a weapon melted into another, or poured into a legend, stays, marked gone).
  // Class weapons are in (the plain Sword is a common sword); ingredients are not (they live on the Materials wall)
  function armoryWeapons() { const out = [], seen = new Set(); for (const id of [...own.keys(), ...(profile.found || [])]) { if (seen.has(id)) continue; seen.add(id); const t = world.get(id); if (t && F.isWeapon(t)) out.push(t); } return out; }
  const tierCount = list => { const n = {}; for (const t of list) n[t.tier] = (n[t.tier] || 0) + 1; return n; };
  const smallBand = t => `<span class="rarity sm ${tierClass(t)}">${esc(TIER[t.tier] || "")}</span>`;
  // a row (pass 10 section 3.4.2): the sprite, the name (★ when the smith forged it first in the world), the small band and the recipe
  // (or the kind, the ability and the date acquired on Legends), ×n when more than one is held or "gone"; a tap opens its plaque in view mode
  function weaponRow(t, sub) {
    const held = own.get(t.id), b = document.createElement("button"), gold = (t.discovery || {}).first === profile.id;
    b.className = "lrow" + (gold ? " gold" : "") + (held ? "" : " gone"); b.appendChild(sprite(t, 1));
    const d = document.createElement("div"); d.innerHTML = `<div class="n"></div><div class="s">${sub}</div>`; d.firstChild.textContent = t.name + (gold ? " ★" : "");
    b.appendChild(d);
    const r = document.createElement("span"); r.className = "x2"; r.textContent = held ? (held.n > 1 ? "×" + held.n : "") : "gone"; b.appendChild(r);
    b.setAttribute("aria-label", `${t.name}: ${TIER[t.tier] || ""}${held ? "" : ", no longer held"}`);
    b.addEventListener("click", () => viewWeapon(t));
    return b;
  }
  function viewWeapon(t) {
    const claim = { thing: t, status: t.oracle && t.oracle.provisional && svc.url ? "pending" : "known", kind: t.hybrid ? kinds.find(k => k.id === t.hybrid.kind) || null : null };
    if (classOf(t) === "legendary") showLegend(claim, null, null, { view: true }); else showPlaque(claim, null, null, { view: true });
  }
  // page 1, the Armory: twenty shelves (pass 14 section 3.8), the classes with weapons first, then the rest, each group in the grammar's
  // order, which never moves. A shelf's head: the plural name, a small band per tier present with its count, the total, ▸ or ▾. Its
  // board: the class's weapons at 1x, rarest first, as many as fit, then "+N"; with none, the class weapon greyed and "none yet". A tap
  // opens the class's rows under it, from the most common to the rarest and by name within a tier; one class open at a time
  function renderArmory(el) {
    const all = armoryWeapons().filter(t => classOf(t) !== "legendary");
    const by = new Map(G.visual.bases.map(c => [c, []])); for (const t of all) { const c = classOf(t); if (by.has(c)) by.get(c).push(t); }
    const order = G.visual.bases.filter(c => by.get(c).length).concat(G.visual.bases.filter(c => !by.get(c).length));
    el.innerHTML = `<div class="cabhead"><b>The Armory</b><span class="n">${all.length} weapon${all.length === 1 ? "" : "s"}</span></div><div class="lhead">A shelf for every class. Open one to see its weapons from the most common to the rarest. Legends have their own tab.</div><div id="aclasses"></div>`;
    const box = el.querySelector("#aclasses"), fit = Math.max(3, Math.floor(((el.clientWidth || 380) - 30) / 35));
    for (const c of order) {
      const list = by.get(c).sort((a, b) => (a.tier - b.tier) || a.name.localeCompare(b.name)), open = state.armoryOpen === c;
      const b = document.createElement("button"); b.className = "ashelf" + (list.length ? "" : " none"); b.setAttribute("aria-expanded", String(open)); b.dataset.cls = c;
      const counts = tierCount(list);
      b.innerHTML = `<span class="ahead"><b>${esc(plural(c))}</b><span class="tiers">${list.length ? Object.keys(counts).sort().map(k => `<span class="rarity sm r${Math.max(1, Math.min(6, k | 0))}">${counts[k]}</span>`).join("") : ""}</span><span class="cnt">${list.length || ""}</span><i>${open ? "▾" : "▸"}</i></span><span class="board"></span>`;
      b.setAttribute("aria-label", `${plural(c)}: ${list.length ? list.length + " weapon" + (list.length === 1 ? "" : "s") : "none yet"}`);
      const board = b.querySelector(".board"), show = list.slice().reverse();   // rarest first on the shelf
      if (!list.length) { const t = classWeapon(c); if (t) board.appendChild(sprite(t, 1)); board.insertAdjacentHTML("beforeend", '<span class="none">none yet</span>'); }
      else { for (const t of show.slice(0, show.length > fit ? fit - 1 : fit)) board.appendChild(sprite(t, 1)); if (show.length > fit) board.insertAdjacentHTML("beforeend", `<span class="more">+${show.length - fit + 1}</span>`); }
      b.addEventListener("click", () => { if (!list.length) { toast(`No ${plural(c).toLowerCase()} yet`); return; } state.armoryOpen = open ? null : c; renderLedger(); });
      box.appendChild(b);
      if (open) { const rows = document.createElement("div"); rows.className = "arows"; for (const t of list) rows.appendChild(weaponRow(t, `${smallBand(t)} ${esc(recipeLine(t) || "a class weapon")}`)); box.appendChild(rows); }
    }
  }
  // page 2, Legends: every legend held or held before, newest first by the date acquired; legends with no date (a save from before this
  // build) after the dated ones, newest first by the order they were gained
  function renderLegends(el) {
    const list = armoryWeapons().filter(t => classOf(t) === "legendary");
    const when = t => got[t.id] || "";
    list.sort((a, b) => String(when(b)).localeCompare(String(when(a))) || ((own.get(b.id) || { seq: 0 }).seq - (own.get(a.id) || { seq: 0 }).seq));
    el.innerHTML = `<div class="cabhead"><b>Legends</b><span class="n">${list.length}</span></div><div class="lhead">Every legend you have poured or found, the newest first.</div><div id="lrows"></div>`;
    const box = el.querySelector("#lrows");
    for (const t of list) {
      const k = t.hybrid && kinds.find(x => x.id === t.hybrid.kind), ab = abilityOf(t);
      box.appendChild(weaponRow(t, `${smallBand(t)} ${esc(k ? "A " + k.name : cap(t.hybrid.classes[0]) + " ✦ " + cap(t.hybrid.classes[1]))}${ab ? " · ✦ " + esc(ab.name) : ""}${when(t) ? " · acquired " + esc(fmtDate(when(t))) : ""}`));
    }
    if (!list.length) box.innerHTML = '<div class="empty">No legends yet. The Crucible wakes at level 25.</div>';
  }

  async function renderRoll(el) {
    el.innerHTML = `<div class="cabhead"><b>The Roll of First Smiths</b></div><div class="lhead">Weapons no smith had made before, by the smith who made them first.</div>
      <div class="chips2">${["week", "all"].map(w => `<button data-w="${w}" aria-pressed="${String(state.rollWindow === w)}">${w === "week" ? "This week" : "All time"}</button>`).join("")}</div><div id="rollBody" class="lhead">Reading the Roll…</div>`;
    for (const b of el.querySelectorAll(".chips2 button")) b.addEventListener("click", () => { state.rollWindow = b.dataset.w; renderLedger(); });
    const data = await World.leaderboard(state.rollWindow);
    const box = el.querySelector("#rollBody"); if (!box) return;
    if (!data) { box.textContent = "The Roll cannot be read right now."; return; }
    box.className = "";
    const row = r => `<tr class="${r.player === profile.id ? "you" : ""}"><td><span class="rk ${["", "one", "two", "three"][r.rank] || ""}">${r.rank}</span></td><td class="sm">${esc(r.name || r.player)}</td><td class="num">${r.weapons}</td><td class="num lg">${r.legends ? "◆ " + r.legends : ""}</td><td class="num">${r.kinds ? "♛ " + r.kinds : ""}</td><td><div class="lt" data-id="${esc(r.latest ? r.latest.id : "")}"><span>${esc(r.latest ? r.latest.name : "")}</span></div></td></tr>`;
    box.innerHTML = `<table class="roll"><thead><tr><th>Rank</th><th>Smith</th><th>Weapons</th><th>Legends</th><th>Kinds</th><th>Latest</th></tr></thead><tbody>${data.rows.map(row).join("")}</tbody></table>
      ${data.you && data.you.rank && !data.rows.some(r => r.player === profile.id) ? `<div class="lhead">You: ${data.you.rank}${ordinal(data.you.rank)} · ${data.you.weapons} weapon${data.you.weapons === 1 ? "" : "s"}</div>` : ""}
      ${!data.rows.length ? '<div class="empty">No firsts yet in this window.</div>' : ""}${data.stale ? `<div class="lhead">As of ${data.at.toLocaleTimeString()}: the world cannot be reached.</div>` : ""}`;
    for (const lt of box.querySelectorAll(".lt")) { const t = world.get(lt.dataset.id); if (t) lt.prepend(sprite(t, 1)); }
  }
  function ordinal(n) { const s = ["th", "st", "nd", "rd"], v = n % 100; return s[(v - 20) % 10] || s[v] || s[0]; }
  async function renderKinds(el) {
    await World.kinds();
    const bases = G.visual.bases;
    el.innerHTML = `<div class="cabhead"><b>The Book of Kinds</b><span class="n">Kinds named: ${kinds.length} of ${bases.length * (bases.length - 1)}</span></div><div class="lhead">What a pair of classes becomes in the Crucible, in order: the left's body, the right's head. The first smith to pour one founds the kind.</div><div id="kgroups"></div>`;
    const box = el.querySelector("#kgroups");
    for (const body of bases) {
      const g = document.createElement("div"); g.className = "kgroup";
      const named = kinds.filter(k => k.classes[0] === body).length;
      const btn = document.createElement("button"); btn.className = "f-plank"; btn.innerHTML = `${esc(cap(body))} ✦ … <span>${named} of ${bases.length - 1} named</span>`;
      btn.setAttribute("aria-expanded", String(state.kindsOpen.has(body)));
      btn.addEventListener("click", () => { if (state.kindsOpen.has(body)) state.kindsOpen.delete(body); else state.kindsOpen.add(body); renderLedger(); });
      g.appendChild(btn);
      if (state.kindsOpen.has(body)) {
        const grid = document.createElement("div"); grid.className = "kinds";
        for (const head of bases) { if (head === body) continue;
          const k = kinds.find(x => x.key === body + "*" + head);
          const d = document.createElement("div"); d.className = "kind" + (k ? "" : " unnamed");
          const founding = k ? world.get(k.thing) : null;
          d.appendChild(founding ? sprite(founding, 2) : silhouette(body, head));
          const abn = AB[head] ? "✦ " + AB[head].name : "";   // every tile names its ability, named or not (pass 10 section 3.5.6): a smith can plan a fusion by it
          d.insertAdjacentHTML("beforeend", k ? `<b>${esc(k.name)}</b><span>${esc(k.line)}</span>${abn ? `<span>${esc(abn)}</span>` : ""}<span>founded by ${esc(k.first === profile.id ? "you" : k.first)}${founding ? " · " + esc(founding.name) : ""}</span>` : `<b>not yet named</b><span>${esc(cap(body))} ✦ ${esc(cap(head))}</span>${abn ? `<span>${esc(abn)}</span>` : ""}`);
          grid.appendChild(d);
        }
        g.appendChild(grid);
      }
      box.appendChild(g);
    }
  }

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
    for (const t of window.FORGE_THINGS) if (t.kind !== "weapon" && storeOf(t) !== "Trophies") gain(t.id, 3);
    state.a = null; state.b = null; state.ma = null; state.mb = null;
    closePlaque(); setStation("anvil"); renderSign(); setTab("weapons"); renderSlots(); renderInfo(); renderLedger(); save();
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
  $("fresh").addEventListener("click", fresh);
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
    if (svc.url) for (const t of got) gain(t.id);
    const nc = got.map(classOf).find(c => c && !hadClass.has(c));
    toast(`Back from level ${level}${boss ? "'s boss" : ""}: ${res.pay.coins} coins, ${res.pay.xp} XP${res.pay.ember ? ", a Legend Ember" : ""}, ${got.map(t => t.name).join(", ")}`);
    if (nc) state.glow = nc;
    afterLevelChange(before, res);
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
    renderSign(); renderLedger(); renderInfo(); setTab("weapons");
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
    renderLedger(); renderInfo();
    openLedger("roll");
    toast(`A week passes: six smiths made ${firsts} firsts and ${legends} legends. The Roll and the Book of Kinds have rows.`);
  });
  async function connect(url, player) {
    url = (url || $("worldUrl").value).trim().replace(/\/$/, "");
    player = (player || $("smithName").value).trim() || "isaac";
    try {
      const r = await fetch(url + "/", { method: "GET" });
      const root = await r.json();
      svc.url = url; svc.player = player; svc.smiths = root.smiths || 0;
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
      closePlaque(); setStation("anvil"); renderSign(); setTab("weapons"); renderSlots(); renderInfo(); renderLedger();
      if (!profile.classes.length) openFirstWeapon();
      takeLoadoutBack();
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
    closePlaque();
    settings.closeErase(); settings.render();
    $("setPlank").hidden = false; $("setBtn").setAttribute("aria-pressed", "true");
    if (atBench) { const b = $("bench"), pl = $("setPlank"); window.requestAnimationFrame(() => { pl.scrollTop = Math.max(0, b.offsetTop - 8); }); }
    return true;
  }
  function closeSettings() { $("setPlank").hidden = true; $("setBtn").setAttribute("aria-pressed", "false"); if (settings) settings.closeErase(); }
  if (window.Settings) {
    $("bench").hidden = false;
    settings = Settings.mount($("setBody"), {
      build: document.body.getAttribute("data-build") || "dev", section: $("bench"), toast,
      onChange(name, on) { if (name === "pour") session.assistTap = on; if (name === "motion") setMotion(Settings.reduce()); if (name === "forced") { turn.forced = on; fitTurn(); } },
      onErase() { session.erased = true; try { window.location.reload(); } catch (e) { /* the next boot starts fresh */ } },
      onClose: closeSettings
    });
  }
  $("setBtn").addEventListener("click", () => { if ($("setPlank").hidden) openSettings(false); else closeSettings(); });
  $("homeBtn").addEventListener("click", () => goHome());
  window.addEventListener("keydown", e => { if (e.key === "Escape" && !$("setPlank").hidden) { e.preventDefault(); if (settings && settings.asking) settings.closeErase(); else closeSettings(); } });
  const bootAt = Date.now();
  const erasedSinceBoot = () => { if (!window.Settings) return false; const t = Date.parse(Settings.store.get(Settings.KEYS.erased) || ""); return !isNaN(t) && t >= bootAt - 1000; };

  let toastTimer;
  function toast(m) { const el = $("toast"); el.textContent = m; el.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 3200); window.TheForge && window.TheForge.toasts.push(m); }

  // ------------------------------------------------------------------ boot: a returning smith (or the saved one), sword and fire on the anvil
  function returningSmith() {
    profile = Progress.newProfile("isaac");
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
  window.TheForge = { state, get profile() { return profile; }, own, world, rows, kinds, players, session, svc, pick, swap, forge, pour, setStation, openCabinet, closeCabinet, setTab, fresh, grant, connect, openNaming, submitName, openLedger, closeLedger, closePlaque, openUnlock, confirmFirst, localForge, renderAll, toasts: [], toast, hold: startHold, release: endHold, World,
    save, load, goDown, writeHandoff, takeLoadoutBack, equip, worldKey, wentDown: null, wentTo: null, goHome, openSettings, closeSettings, fitRoom, layout: null, setMotion, get reduce() { return reduce; }, get settings() { return settings; },
    openWalls, closeWalls, continueOn, get wallsOpen() { return state.wallsOpen; }, get run() { return run; }, get roomW() { return roomW; }, get room() { return room; }, mountRoom, renderLedger, fitTurn, setForced, get turned() { return turn.turned; }, get plate() { return turn.plate; }, get forced() { return turn.forced; },
    showPlaque, showLegend, viewWeapon, got, get plaqueMode() { return plaqueMode; }, traitLine };
  function renderAll() { renderSign(); renderSlots(); if (state.view === "wall") renderWall(); else renderCabinet(); renderLedger(); renderInfo(); }
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
  (async function boot() {
    const w = params.get("world"), p = params.get("player");
    if (w) { $("worldUrl").value = w; $("smithName").value = p || "isaac"; if (await connect(w, p || "isaac")) { takeAssist(); return; } }
    if (!load()) { returningSmith(); state.a = "sword"; state.b = "fire"; }
    takeAssist();
    takeLoadoutBack();
    renderAll();
    if (!profile.classes.length) openFirstWeapon();
  })().then(() => { session.booted = true; fitRoom(); if (params.get("bench") === "1") openSettings(true); document.body.setAttribute("data-booted", "1"); document.body.setAttribute("data-errors", String((window.__errors || []).length)); });
  // the back gesture restores the page as it was left, without booting it: the loadout is taken then too, and a plaque that was left
  // open says what is equipped now. After an erase, or a change of less motion, elsewhere, the page boots again instead
  window.addEventListener("pageshow", e => {
    if (!e.persisted) return;
    session.leaving = false; window.TheForge.wentTo = null; window.TheForge.wentDown = null;
    if (window.Settings && (erasedSinceBoot() || Settings.reduce() !== reduce)) { window.location.reload(); return; }
    if (window.Settings) { session.assistTap = Settings.isOn("pour"); turn.forced = Settings.isOn("forced"); }
    lockLandscape(); fitTurn();
    if (!takeLoadoutBack()) return;
    renderAll();
    const eq = $("equipBtn"), t = plaqueThing;
    if (eq && t && plaqueOpen()) eq.textContent = equipLabel(t);
  });
})();
