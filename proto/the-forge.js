// FORGE FOREVER: The Forge screen (design pass 2's smithy, pass 5 section 3.13 in full, pass 6 section 3.1.6 named legends).
// Plain script; runs from disk as a world of one (the seed ledger plus the offline Combiner) or against the local world service
// (?world=http://localhost:8765&player=mara, or the bench's Connect button). Everything the rules decide comes from the shared
// modules: combiner.js (the cases, keys, the Combiner, the validator), naming.js, progress.js, coin.js, crucible.js, discovery.js.
// Since build 2 (card t65, design pass 7 section 3.9) the smithy has a door down to the Training Cellar (proto/the-battlegrounds.html):
// the door and "Try it in the cellar" hand the loadout and every owned weapon down as whole records (forge-forever:to-cellar), the
// loadout comes back (forge-forever:from-cellar, on boot and on pageshow), and the save keeps what the page forged itself.
(function () {
  "use strict";
  const G = window.FORGE_GRAMMAR, F = window.Forge, PF = window.PixelForge, SHOP = window.FORGE_SHOP, TERMS = window.FORGE_TERMS, FILTER = window.FORGE_NAME_FILTER;
  const $ = id => document.getElementById(id);
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const params = new URLSearchParams(location.search);
  const CLASS_COUNT = G.visual.bases.length;
  const TIER = G.tiers;
  const nowIso = () => new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const clone = x => JSON.parse(JSON.stringify(x));
  const plural = b => ({ staff: "Staves", scythe: "Scythes", lance: "Lances", book: "Books", dagger: "Daggers", axe: "Axes", orb: "Orbs", claw: "Claws", whip: "Whips", flail: "Flails", cannon: "Cannons", lantern: "Lanterns", horn: "Horns", bow: "Bows", crossbow: "Crossbows", wand: "Wands", shield: "Shields", spear: "Spears", hammer: "Hammers", sword: "Swords", legendary: "Legendary" })[b] || (b[0].toUpperCase() + b.slice(1) + "s");
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  const FORM_VERB = { slash: "Slashes", thrust: "Thrusts", smash: "Smashes", shoot: "Shoots", stream: "Streams", lob: "Lobs", orbit: "Orbits", field: "Wards", trap: "Traps", summon: "Summons" };
  const FORM_LOW = { slash: "slashes", thrust: "thrusts", smash: "smashes", shoot: "shoots", stream: "streams", lob: "lobs", orbit: "orbits", field: "wards", trap: "traps", summon: "summons" };
  const CASE_SIGN = { apply: "+", gift: "▸", mix: "+", fuse: "✦" };
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
  function gain(id, n) { const o = own.get(id); if (o) { o.n += n || 1; } else own.set(id, { n: n || 1, seq: ++seq }); }
  function have(id) { const o = own.get(id); return o ? o.n : 0; }
  let profile = Progress.newProfile("isaac");
  const session = { revealed: new Set(), equipped: [], active: 0, savedAt: null, slideToastShown: false, pending: [], lastClaim: null, assistTap: false };
  const state = { station: "anvil", a: null, b: null, ma: null, mb: null, forging: false, pouring: false, tab: "weapons", view: "wall", cab: null, sort: "newest", el: null, kindChip: null, q: "", glow: null, glowItem: null, bulk: false,
    ledgerOpen: false, page: "ledger", filter: "all", rollWindow: "all", rollCache: null, kindsOpen: new Set(), lastCabKind: null, hold: null };
  const svc = { url: null, player: null, smiths: 0, spare: null };
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
    if (svc.url) return false;
    const stock = {}; for (const [id, o] of own) stock[id] = o.n;
    const at = nowIso();
    const mine = []; for (const [k, r] of rows) if (!ledgerRows.has(k)) mine.push({ k, r });
    const data = { profile, stock, equipped: session.equipped, active: session.active, assist: session.assistTap, at, rows: mine, kinds: kinds.filter(k => !ledgerKinds.has(k.key)), players };
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
      for (const [id, n] of Object.entries(d.stock || {})) if (world.has(id)) gain(id, n);
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
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { /* nothing was locked */ }
    window.TheForge.wentDown = { url: cellarUrl(), sent, try: tryId };
    if (params.get("stay") !== "1") window.location.href = cellarUrl();
    return sent;
  }
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
  // the Forge stays upright: it asks for a portrait lock where the browser has one
  function lockPortrait() { try { const o = screen.orientation; if (o && o.lock) { const p = o.lock("portrait"); if (p && p.catch) p.catch(() => {}); } } catch (e) { /* this browser doesn't lock */ } }

  // ------------------------------------------------------------------ sprites and their four-frame particles
  const live = new Set();
  function animated(t) { return (t.weapon && (t.weapon.element !== "physical" || t.hybrid)) || (t.hints && t.hints.element && t.kind !== "weapon"); }
  function sprite(t, scale) { const cv = PF.canvasFor(t, { scale }); if (animated(t)) live.add([cv, t, scale]); return cv; }
  if (!reduce) { let fr = 0; setInterval(() => { fr = (fr + 1) % 4; for (const e of live) { if (!e[0].isConnected) { live.delete(e); continue; } PF.draw(e[0], e[1], { scale: e[2], frame: fr }); } }, 130); }
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
    async run(level, boss, replay, things) {
      if (svc.url) {
        const { code, body } = await api("POST", "/run", { player: svc.player, level, boss, replay, things });
        if (code === 200) { await refreshProfile(); return body; }
        return null;
      }
      const before = profile.level;
      const pay = Coin.runPay(level, boss, replay);
      const ember = pay.ember || ((pay.ember_chance && Math.random() < pay.ember_chance) ? 1 : 0);
      profile.xp += pay.xp; profile.coins += pay.coins; profile.embers += ember;
      for (const id of things) { gain(id); if (!profile.found.includes(id)) profile.found.push(id); }
      profile.level = Progress.levelFor(profile.xp);
      const woke = before < G.fuse.level && profile.level >= G.fuse.level;
      if (woke) profile.embers += 1;
      save();
      return { pay: Object.assign({}, pay, { ember }), level: profile.level, levelled: profile.level > before, crucible_woke: woke };
    },
    async buy(id, n) {
      if (svc.url) {
        const { code, body } = await api("POST", "/buy", { player: svc.player, id, n });
        if (code === 200) { await refreshProfile(); if (id === SHOP.ember.id) { } else if (id === "all-elements") { for (const e of SHOP.bundles[0].items) gain(e, n); } else gain(id, n); }
        return { ok: code === 200, cost: body.cost, reason: body.reason };
      }
      const [ok, cost, reason] = Coin.buy(id, n, SHOP, profile, profile.found);
      if (!ok) return { ok, cost, reason };
      profile.coins -= cost;
      if (id === SHOP.ember.id) profile.embers += n;
      else if (id === "all-elements") { for (const e of SHOP.bundles[0].items) gain(e, n); }
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
    $("crucPlate").hidden = awake || state.station === "crucible";
    if (room.crucible !== (awake ? "lit" : "cold")) room.setCrucible(awake ? "lit" : "cold");
    const picks = Progress.picksLeft(profile);
    profile.picks = picks;
    $("pickBadge").hidden = !(picks > 0 && profile.classes.length);
    $("pickBadge").textContent = picks + (picks === 1 ? " rack to open" : " racks to open");
    if (!awake && state.station === "crucible") setStation("anvil");
  }

  // ------------------------------------------------------------------ the stations
  const room = Smithy.mount($("scene"), { w: 200, h: 112, crucible: "cold" });
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
  }
  $("stAnvil").addEventListener("click", () => setStation("anvil"));
  $("stCruc").addEventListener("click", () => setStation("crucible"));
  $("crucPlate").addEventListener("click", () => toast("The Crucible wakes at level 25. It melts two rare weapons into a legend."));
  $("cellarDoor").addEventListener("click", () => { if (state.forging || state.pouring) return; goDown(null); });

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
    const forms = F.fuseForms(A, B, G);
    $("price").textContent = `Uses ${A.name}, ${B.name} and one Legend Ember.`;
    return `${cap(F.bodyClass(A))} body, ${cap(F.bodyClass(B))} head · ${FORM_LOW[A.weapon.form]}, then ${FORM_LOW[forms[0]] || "strikes"} · ${known ? "You've forged this: " + known.name : "New to you"}`;
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
  $("slotA").addEventListener("click", () => { if (state.forging) return; state.a = state.b; state.b = null; renderSlots(); });
  $("slotB").addEventListener("click", () => { if (state.forging) return; state.b = null; renderSlots(); });
  $("moldA").addEventListener("click", () => { if (state.pouring) return; state.ma = state.mb; state.mb = null; renderSlots(); });
  $("moldB").addEventListener("click", () => { if (state.pouring) return; state.mb = null; renderSlots(); });
  $("swap").addEventListener("click", swap);
  $("swapM").addEventListener("click", swap);
  $("socket").addEventListener("click", () => { if (profile.embers === 0) { setStation("anvil"); setTab("materials"); openCabinet({ kind: "cart", key: "The Trader's Cart" }); toast(Progress.crucibleAwake(profile, G) ? "The Trader sells Legend Embers for 500 coins" : "Legend Embers are sold from level 25"); } });

  function sparks(n, cols) {
    const box = $("sparks"); box.innerHTML = "";
    for (let i = 0; i < n; i++) { const s = document.createElement("i"); s.style.background = cols[i % cols.length];
      const ang = -Math.PI * (0.1 + 0.8 * ((i * 37) % n) / n), r = 30 + (i % 4) * 16;
      s.style.setProperty("--dx", Math.cos(ang) * r + "px"); s.style.setProperty("--dy", Math.sin(ang) * r + "px"); s.style.animationDelay = (i % 3) * 0.5 + "s"; box.appendChild(s); }
  }

  // ------------------------------------------------------------------ the anvil: STRIKE
  async function forge() {
    if (!state.a || !state.b || state.forging || state.station !== "anvil") return;
    const A = world.get(state.a), B = world.get(state.b);
    state.forging = true; closePlaque(); renderSlots();
    const hadClass = new Set(racks().map(r => r.c));
    $("phone").classList.add("forging"); room.heat = 1;
    sparks(14, ["#fff6c8", "#fee761", "#f77622", "#ffffff"]);
    $("state").textContent = "The hammer falls…";
    const think = setTimeout(() => { if (state.forging) $("state").textContent = "the fire is thinking…"; }, 3000);
    const wait = new Promise(res => setTimeout(res, reduce ? 300 : 1500));
    const [claim] = await Promise.all([World.forge(A.id, B.id, "anvil"), wait]);
    clearTimeout(think);
    state.forging = false; $("phone").classList.remove("forging");
    if (!claim || claim.error) { toast(claim ? claim.error : "The forge failed"); renderSlots(); return; }
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
    if (claim.status === "first" && !claim.provisional) { $("phone").classList.add("burst"); sparks(18, ["#feae34", "#fee761", "#ffffff"]); setTimeout(() => $("phone").classList.remove("burst"), 1600); }
    if (claim.newRack) { toast("A new rack goes up: " + plural(cls)); state.glow = cls; }
    $("state").textContent = claim.provisional ? (claim.status === "pending" ? "Pending: the world will settle it" : "Provisional: the Combiner's draft") : claim.status === "first" ? "A world first" : claim.status === "rediscovered" ? "A re-discovery" : "A known recipe";
    renderSign();
    if (state.view === "wall") renderWall(); else renderCabinet();
    renderLedger(); renderInfo();
    return claim;
  }
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
    $("state").textContent = claim.provisional ? "Provisional: the Combiner's legend" : claim.status === "first" ? "A world first" : "A known legend";
    renderSign(); renderSlots();
    if (state.view === "wall") renderWall(); else renderCabinet();
    renderLedger(); renderInfo();
    return claim;
  }

  // ------------------------------------------------------------------ the plaques
  function sentence(t) { const w = t.weapon; return w ? [w.form + (w.form2 ? "/" + w.form2 : ""), w.element, ...w.status, ...w.modifiers].join(" · ") : "ingredient" + (t.hints && t.hints.element ? " · " + t.hints.element : ""); }
  function fmtDate(iso) { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); }
  function recipeLine(t) {
    const p = t.parents || [];
    if (p.length !== 2) return "";
    const a = world.get(p[0]) || { name: p[0] }, b = world.get(p[1]) || { name: p[1] };
    const kase = t.hybrid && t.gift === null && p.every(id => { const x = world.get(id); return x && !x.hybrid; }) && t.weapon && t.weapon.visual.fuse ? "fuse" : t.gift ? "gift" : "apply";
    return `${a.name} ${CASE_SIGN[kase]} ${b.name}`;
  }
  function baseLineText(t) {
    if (!F.isWeapon(t) || !t.base || !t.base.on || !isForged(t)) return "";
    const on = world.get(t.base.on) || { name: t.base.on };
    return `Forged on ${on.name} · a ${cap(t.base.root === t.id ? classOf(t) : (world.get(t.base.root) || { name: cap(t.base.root) }).name)} at heart`;
  }
  function discLine(claim, t) {
    const d = t.discovery || {};
    const mine = d.first === profile.id;
    if (claim.status === "pending") return `The world will settle this when you're back online.`;
    if (claim.provisional) return `The Combiner's draft. The Oracle would name it.`;
    if (claim.status === "first") return `No smith in the world had made this. <b>It carries your name for ever.</b>`;
    if (claim.status === "rediscovered") return `The world already has this: <b>${esc(t.name)}</b>, first forged by <b>${esc(d.first || "someone")}</b>.`;
    return `First forged by <b>${mine ? "you" : esc(d.first || "someone")}</b>${d.at ? ", " + fmtDate(d.at) : ""}.`;
  }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function bars(t) {
    const w = t.weapon; if (!w) return "";
    const uses = new Set([...G.forms[w.form].uses, ...(w.form2 ? G.forms[w.form2].uses : [])]);
    return `<div class="bars">${G.numbers.map(k => `<div class="bar ${uses.has(k) ? "" : "off"}"><span>${k}</span><span class="pips">${Array.from({ length: 10 }, (_, i) => `<i class="${i < w.numbers[k] ? "on" : ""}"></i>`).join("")}</span><span>${w.numbers[k]}</span></div>`).join("")}</div>`;
  }
  function showPlaque(claim, base, added) {
    const t = claim.thing, w = t.weapon;
    const p = $("plaque");
    const first = claim.status === "first" && !claim.provisional;
    const isIng = t.kind !== "weapon";
    const giftLine = t.gift ? `takes ${t.gift.word ? esc(t.gift.word.replace("_", " ")) : "nothing new"} from the ${esc((world.get(t.gift.from) || { name: t.gift.from }).name)}${t.gift.replaced ? " · in place of " + esc(t.gift.replaced.replace("_", " ")) : ""}${t.gift.word ? "" : " · re-tempered"}` : "";
    p.innerHTML = `${first ? '<div class="banner f-ember">First forged</div>' : ""}${claim.provisional ? '<span class="stamp">PROVISIONAL</span>' : ""}
      <div class="art"></div><h2></h2><div class="kindline">${esc(recipeLine(t))}</div><div class="flavor"></div>
      <div class="meta"><span></span><span><b>${TIER[t.tier]}</b></span><span>${esc(sentence(t))}</span></div>
      ${giftLine ? `<div class="line">${giftLine}</div>` : ""}
      ${baseLineText(t) ? `<div class="line">${esc(baseLineText(t))}</div>` : ""}
      ${isIng ? `<div class="line">An ingredient, not a weapon. Put it on the anvil beside a weapon to use it.</div><div class="line">Gives: ${esc(hintText(t))}</div>` : bars(t)}
      <div class="line">${discLine(claim, t)}</div>
      <div class="pbtns">${isIng ? '<button class="f-ember primary" id="applyBtn">Apply to a weapon</button><button class="f-iron" id="hang">Store it</button>' : `<button class="f-ember primary" id="hang">Hang it</button><button class="f-iron" id="equipBtn" ${Progress.canEquip(t, profile, G) ? "" : "disabled"}>${session.equipped.includes(t.id) ? "Equipped" : Progress.canEquip(t, profile, G) ? "Equip" : "Chained"}</button>`}<button class="f-iron" id="share">Share</button></div>
      ${isIng ? "" : tryRow(t)}
      ${t.why || claim.provisional ? `<div class="why">${claim.provisional ? "The Combiner's draft. The Oracle would name it." : "Why the Oracle chose this: " + esc(t.why)}</div>` : ""}`;
    p.querySelector(".art").appendChild(sprite(t, 6));
    p.querySelector("h2").textContent = t.name;
    p.querySelector(".flavor").textContent = "“" + t.flavor + "”";
    const cls = classOf(t);
    p.querySelector(".meta span").textContent = cls ? cls : storeOf(t);
    p.hidden = false;
    $("hang").addEventListener("click", () => { closePlaque(); state.a = null; state.b = null; renderSlots(); hangIt(t); });
    const eq = $("equipBtn"); if (eq) eq.addEventListener("click", () => equip(t, eq));
    const ap = $("applyBtn"); if (ap) ap.addEventListener("click", () => { closePlaque(); state.a = null; state.b = t.id; renderSlots(); setTab("weapons"); toast("Pick a weapon for the base"); });
    $("share").addEventListener("click", () => share(t));
    const tr = $("tryBtn"); if (tr) tr.addEventListener("click", () => goDown(t.id));
  }
  function tryRow(t) { return `<button class="f-iron tryit" id="tryBtn">↓ Try it in the cellar${Progress.canEquip(t, profile, G) ? "" : "<small>practice only</small>"}</button>`; }
  function hintText(t) { const h = t.hints || {}; const bits = []; if (h.element) bits.push(h.element); bits.push(...(h.forms || []), ...(h.modifiers || [])); if (h.status) bits.push(h.status); if (h.visual_part) bits.push("a " + h.visual_part); if (h.material) bits.push(h.material); return bits.join(", ") || "nothing yet"; }
  function hangIt(t) {
    const cls = classOf(t);
    if (cls) { setTab("weapons"); state.glowItem = t.id; state.sort = "newest"; openCabinet({ kind: "class", key: cls }); }
    else { setTab("materials"); state.glowItem = t.id; state.sort = "newest"; openCabinet({ kind: "store", key: storeOf(t) }); }
    toast(`${t.name} is on the ${cls ? plural(cls).toLowerCase() : storeOf(t).toLowerCase()} shelf`);
  }
  function equip(t, btn) {
    if (!Progress.canEquip(t, profile, G)) { toast(classOf(t) === "legendary" ? "Legends can be wielded from level 25" : `The ${plural(classOf(t))} rack is chained: open the class to wield it`); return; }
    if (!session.equipped.includes(t.id)) { session.equipped.push(t.id); if (session.equipped.length > 2) session.equipped.shift(); }
    if (btn) btn.textContent = "Equipped"; save(); toast(`${t.name} goes to the Battlegrounds with you`);
  }
  function share(t) {
    const cls = classOf(t);
    const named = t.naming && t.naming.status === "named" ? ` Named by ${t.naming.by}.` : "";
    const txt = `${t.name} (${TIER[t.tier]} ${cls || "ingredient"}): ${sentence(t)}. ${recipeLine(t) ? "Forged from " + recipeLine(t) + "." : ""}${t.discovery && t.discovery.first ? " First forged by " + t.discovery.first + "." : ""}${named} Forge Forever`;
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => toast("Copied: " + txt), () => toast(txt)); else toast(txt);
  }
  function closePlaque() { $("plaque").hidden = true; $("legendPlaque").hidden = true; }

  function showLegend(claim, A, B) {
    const t = claim.thing, w = t.weapon, p = $("legendPlaque");
    const kind = claim.kind || (t.hybrid && kinds.find(k => k.id === t.hybrid.kind)) || null;
    const first = claim.status === "first" && !claim.provisional;
    const founded = !!kind && kind.first === profile.id && kind.thing === t.id && claim.status === "first";
    const canName = claim.status === "first" && t.naming && t.naming.status === "open" && (t.discovery || {}).first === profile.id && !claim.provisional;
    const canNameLocal = claim.status === "first" && t.naming && t.naming.status === "open" && (t.discovery || {}).first === profile.id && !svc.url;
    const body = world.get(t.base && t.base.on) || A;
    p.innerHTML = `<div class="banner f-ember gold">${t.tier >= 6 ? "Mythic" : "Legendary"}</div>${first ? '<span class="ribbon">FIRST FORGED</span>' : ""}${claim.provisional ? '<span class="stamp">PROVISIONAL</span>' : ""}
      ${founded ? '<div class="banner f-ember kind">A new kind</div>' : ""}
      <div class="art"></div><h2 id="legendName"></h2><div class="named" id="namedBy"></div>
      <div class="kindline">${kind ? "A " + esc(kind.name) : "A new kind"} · ${esc(t.hybrid.classes[0])} ✦ ${esc(t.hybrid.classes[1])}</div>
      ${kind ? `<div class="line" style="font-style:italic">${esc(kind.line)}</div>` : ""}
      ${founded ? `<div class="line">The first ${esc(kind.name)} in the world: you founded the kind.</div>` : ""}
      <div class="line"><b>${FORM_VERB[w.form] || cap(w.form)}</b> · every third blow ${w.form2 ? FORM_LOW[w.form2] : "strikes again"}</div>
      <div class="line">Fused on ${esc(body ? body.name : "?")} · a ${esc(cap(t.hybrid.classes[0]))} at heart</div>
      <div class="flavor"></div>
      <div class="meta"><span><b>${TIER[t.tier]}</b></span><span>${esc(sentence(t))}</span></div>
      ${bars(t)}
      <div class="line">${discLine(claim, t)}</div>
      <div class="pbtns">${(canName || canNameLocal) ? '<button class="f-ember goldbtn" id="nameBtn">Name it</button>' : ""}<button class="f-ember primary" id="hang">Hang it</button><button class="f-iron" id="equipBtn" ${Progress.canEquip(t, profile, G) ? "" : "disabled"}>${session.equipped.includes(t.id) ? "Equipped" : Progress.canEquip(t, profile, G) ? "Equip" : "Chained"}</button><button class="f-iron" id="share">Share</button></div>
      ${tryRow(t)}`;
    p.querySelector(".art").appendChild(sprite(t, 6));
    $("legendName").textContent = t.name;
    renderNamedBy(t);
    p.querySelector(".flavor").textContent = "“" + t.flavor + "”";
    p.hidden = false;
    $("hang").addEventListener("click", () => { closePlaque(); renderSlots(); hangIt(t); });
    $("equipBtn").addEventListener("click", () => equip(t, $("equipBtn")));
    $("share").addEventListener("click", () => share(t));
    const nb = $("nameBtn"); if (nb) nb.addEventListener("click", () => openNaming(t));
    $("tryBtn").addEventListener("click", () => goDown(t.id));
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
    $("termsNo").addEventListener("click", () => { el.hidden = true; toast("The offer stays open: Name it from the Ledger when you're ready"); renderLedger(); });
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
        b.title = `${t.name} · ${TIER[t.tier]}: ${t.flavor}` + (dimWhy ? " · " + dimWhy : ""); b.appendChild(sprite(t, 2));
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
    if (Progress.crucibleAwake(profile, G) || profile.level >= SHOP.ember.from_level) rowsOut.push({ id: SHOP.ember.id, name: SHOP.ember.name, sub: "melts two rare weapons into a legend", ember: true, price: Coin.price(SHOP.ember.id, SHOP, profile, profile.found) });
    for (const it of items) if (it.thing) rowsOut.push({ id: it.id, name: it.thing.name, sub: `${it.store} · you have ${have(it.id)}`, sprite: it.thing, price: Coin.price(it.id, SHOP, profile, profile.found) });
    for (const r of rowsOut) {
      const [unit, why] = r.price;
      const b = document.createElement("button"); b.className = "cartrow" + (unit === null ? " sold" : "");
      if (r.sprite) b.appendChild(sprite(r.sprite, 1)); else { const cv = document.createElement("canvas"); cv.width = 33; cv.height = 33; const g = cv.getContext("2d"); g.fillStyle = "#f77622"; g.fillRect(12, 6, 9, 21); g.fillStyle = "#fee761"; g.fillRect(14, 10, 5, 12); b.appendChild(cv); }
      const d = document.createElement("div"); d.innerHTML = `<div class="n"></div><div class="s"></div>`; d.firstChild.textContent = r.name; d.lastChild.textContent = why ? why : r.sub;
      b.appendChild(d);
      const tag = document.createElement("span"); tag.className = "tag" + (unit === null ? " off" : ""); tag.textContent = unit === null ? "—" : (unit * (r.id === bundle.id || r.ember ? 1 : n)).toLocaleString(); b.appendChild(tag);
      b.addEventListener("click", async () => {
        const count = (r.id === bundle.id || r.ember) ? 1 : n;
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
      setTimeout(() => { toast("The Crucible wakes: melt two rare weapons into a legend"); setTimeout(() => toast("Here is your first Legend Ember"), 1800); }, picks > 0 ? 400 : 0);
      state.glow = "legendary";
      renderSign();
      if (state.view === "wall") renderWall();
    }
  }

  // ------------------------------------------------------------------ the ledger book: your Ledger, the Roll, the Book of Kinds
  function openLedger(page, filter) {
    closePlaque();
    state.ledgerOpen = true; if (page) state.page = page; if (filter) state.filter = filter;
    $("ledger").hidden = false; $("walls").hidden = true; $("ledgerBtn").setAttribute("aria-pressed", "true");
    renderLedger();
  }
  function closeLedger() { state.ledgerOpen = false; $("ledger").hidden = true; $("walls").hidden = false; $("ledgerBtn").setAttribute("aria-pressed", "false"); }
  $("ledgerBtn").addEventListener("click", () => { if (state.ledgerOpen) closeLedger(); else openLedger("ledger"); });
  $("chipFirsts").addEventListener("click", () => openLedger("ledger", "firsts"));
  for (const [id, pg] of [["pgLedger", "ledger"], ["pgRoll", "roll"], ["pgKinds", "kinds"]]) $(id).addEventListener("click", () => { state.page = pg; renderLedger(); });
  let ledgerShown = 60;
  function ledgerItems() {
    const items = [];
    const seen = new Set();
    const mine = new Set([...(profile.found || []), ...own.keys()]);
    for (const id of mine) { const t = world.get(id); if (!t || !isForged(t) || seen.has(id)) continue; seen.add(id); items.push({ t, at: (t.discovery || {}).at || "", gold: (t.discovery || {}).first === profile.id, prov: !!(t.oracle && t.oracle.provisional) }); }
    let list = items.sort((x, y) => String(y.at).localeCompare(String(x.at)));
    if (state.filter === "firsts") list = list.filter(i => i.gold);
    if (state.filter === "legends") list = list.filter(i => classOf(i.t) === "legendary");
    return list;
  }
  function renderLedger() {
    $("ledgerBtn").textContent = "LEDGER";
    if (!state.ledgerOpen) return;
    for (const [id, pg] of [["pgLedger", "ledger"], ["pgRoll", "roll"], ["pgKinds", "kinds"]]) $(id).setAttribute("aria-selected", String(state.page === pg));
    const el = $("ledgerBody");
    if (state.page === "roll") return renderRoll(el);
    if (state.page === "kinds") return renderKinds(el);
    const items = ledgerItems();
    el.innerHTML = `<div class="cabhead"><b>The Ledger</b><span class="n">${profile.found.length} found</span></div>
      <div class="chips2">${["all", "firsts", "legends"].map(f => `<button data-f="${f}" aria-pressed="${String(state.filter === f)}">${f}</button>`).join("")}</div><div id="tree"></div><div id="lrows"></div>`;
    for (const b of el.querySelectorAll(".chips2 button")) b.addEventListener("click", () => { state.filter = b.dataset.f; renderLedger(); });
    const box = el.querySelector("#lrows");
    for (const { t, gold, prov } of items.slice(0, ledgerShown)) {
      const b = document.createElement("button"); b.className = "lrow" + (gold ? " gold" : ""); b.appendChild(sprite(t, 1));
      const d = document.createElement("div"); d.innerHTML = `<div class="n"></div><div class="s"></div>`; d.firstChild.textContent = t.name;
      d.lastChild.textContent = `${TIER[t.tier]} · ${recipeLine(t)} · ${prov ? "provisional" : "first forged by " + ((t.discovery && t.discovery.first) === profile.id ? "you" : (t.discovery && t.discovery.first) || "?")}`;
      b.appendChild(d);
      if (t.naming && t.naming.status === "open" && (t.discovery || {}).first === profile.id) { const tag = document.createElement("span"); tag.className = "nametag"; tag.textContent = "Name it"; b.appendChild(tag); }
      else b.appendChild(document.createElement("span"));
      b.addEventListener("click", e => { if (e.target.classList.contains("nametag")) { openNaming(t); return; } showTree(t.id); });
      box.appendChild(b);
    }
    if (!items.length) box.innerHTML = `<div class="empty">${state.filter === "all" ? "Nothing forged yet." : "Nothing here yet."}</div>`;
    if (items.length > ledgerShown) { const m = document.createElement("button"); m.className = "f-iron"; m.style.cssText = "width:100%;height:40px;margin-top:8px;background:none;cursor:pointer;font-family:var(--data);font-size:12px;color:var(--parch)";
      m.textContent = `Show more (${items.length - ledgerShown} older)`; m.addEventListener("click", () => { ledgerShown += 60; renderLedger(); }); box.appendChild(m); }
  }
  function roleOf(t, i) { if (!t.parents || t.parents.length < 2) return ""; if (t.hybrid && t.weapon && t.weapon.visual.fuse && !((world.get(t.parents[0]) || {}).hybrid)) return i === 0 ? "base" : "fused"; if (t.gift) return i === 0 ? "base" : "gift"; if (t.kind !== "weapon") return ""; return i === 0 ? "base" : "added"; }
  function treeHTML(id, depth, role) { const t = world.get(id); if (!t) return `<li>${esc(id)}</li>`;
    const kids = isForged(t) && depth < 8 ? `<ul>${t.parents.map((p, i) => treeHTML(p, depth + 1, roleOf(t, i))).join("")}</ul>` : "";
    return `<li><b>${esc(t.name)}</b>${role ? `<span class="role">${role}</span>` : ""} <span style="font-family:var(--data);font-size:11px;color:#733e39">${TIER[t.tier]}${isForged(t) ? "" : " · base"}</span>${kids}</li>`; }
  function baseChain(t) { const chain = []; let cur = t, guard = 0; while (cur && guard++ < 12) { chain.unshift(cur.name); if (!cur.base || !cur.base.on || cur.base.on === cur.id) break; cur = world.get(cur.base.on); } return chain; }
  function showTree(id) { const t = world.get(id); const chain = F.isWeapon(t) ? baseChain(t) : [];
    $("tree").innerHTML = `<div class="tree f-parch"><b>Family tree</b><ul style="border:0;margin-left:0">${treeHTML(id, 0, "")}</ul>${chain.length > 1 ? `<div class="baseline">${chain.map(esc).join(" → ")}</div>` : ""}${t.why ? `<div class="why">${esc(t.why)}</div>` : ""}</div>`; $("ledger").scrollTop = 0; }

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
          d.insertAdjacentHTML("beforeend", k ? `<b>${esc(k.name)}</b><span>${esc(k.line)}</span><span>founded by ${esc(k.first === profile.id ? "you" : k.first)}${founding ? " · " + esc(founding.name) : ""}</span>` : `<b>not yet named</b><span>${esc(cap(body))} ✦ ${esc(cap(head))}</span>`);
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
    $("assist").checked = session.assistTap;
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
      const woke = before < G.fuse.level && profile.level >= G.fuse.level;
      if (woke) profile.embers += 1;
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
    const res = await World.run(level, boss, false, got.map(t => t.id));
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
  $("assist").addEventListener("change", e => { session.assistTap = e.target.checked; save(); });
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
    save, load, goDown, writeHandoff, takeLoadoutBack, equip, worldKey, wentDown: null };
  function renderAll() { renderSign(); renderSlots(); if (state.view === "wall") renderWall(); else renderCabinet(); renderLedger(); renderInfo(); }
  (async function boot() {
    const w = params.get("world"), p = params.get("player");
    if (w) { $("worldUrl").value = w; $("smithName").value = p || "isaac"; if (await connect(w, p || "isaac")) return; }
    if (!load()) { returningSmith(); state.a = "sword"; state.b = "fire"; }
    takeLoadoutBack();
    renderAll();
    if (!profile.classes.length) openFirstWeapon();
  })().then(() => { document.body.setAttribute("data-booted", "1"); document.body.setAttribute("data-errors", String((window.__errors || []).length)); });
  lockPortrait();
  // the back gesture restores the page without booting it: the loadout is taken then too
  window.addEventListener("pageshow", e => { lockPortrait(); if (e.persisted && takeLoadoutBack()) renderAll(); });
})();
