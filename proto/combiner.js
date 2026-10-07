// combiner.js: the rules of FORGE FOREVER (formerly Forgecrawl) in the browser: roles, keys, gifts, the base record, the
// Crucible's checks, the offline Combiner, the validator, the fingerprint. Ported line for line from tools/forge.py; runs in
// the bench page (window.Forge) and in node (module.exports) so tools/test-forge.py can check that the two languages agree on
// every base forge and every fusion.
(function (root) {
  "use strict";

  function slug(name) {
    const s = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return s || "thing";
  }
  function dedupe(seq) { const out = []; for (const x of seq) if (!out.includes(x)) out.push(x); return out; }
  function title(s) { return String(s).split(" ").map(w => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w).join(" "); }
  const clone = x => JSON.parse(JSON.stringify(x));

  // ------------------------------------------------------------------ what a thing is
  function isWeapon(t) { return t.kind === "weapon" && !!t.weapon; }
  function classOf(t) { if (!isWeapon(t)) return null; if (t.hybrid) return "legendary"; return t.weapon.visual.base; }
  function bodyClass(t) { return isWeapon(t) ? t.weapon.visual.base : null; }

  function roles(left, right, station) {
    if (station === "crucible") return ["fuse", left, right];
    const wl = isWeapon(left), wr = isWeapon(right);
    if (wl && wr) return ["gift", left, right];
    if (wl) return ["apply", left, right];
    if (wr) return ["apply", right, left];
    return left.id <= right.id ? ["mix", left, right] : ["mix", right, left];
  }
  function keyText(kase, baseId, addedId) {
    if (kase === "gift" && baseId !== addedId) return baseId + ">" + addedId;
    if (kase === "fuse") return baseId + "*" + addedId;
    return [baseId, addedId].sort().join("+");
  }
  // the bench has no SHA-1: rows are matched by the key text
  function pairKey(kase, base, added) {
    const b = typeof base === "string" ? base : base.id, a = typeof added === "string" ? added : added.id;
    const pair = (kase === "mix" || b === a) ? [b, a].sort() : [b, a];
    return { text: keyText(kase, b, a), pair };
  }
  function tierRule(tA, tB, same, G) {
    const hi = Math.max(tA, tB), lo = Math.min(tA, tB);
    const step = same ? 0 : (lo >= hi - 1 ? 1 : 0);
    return Math.min(G.budget.max_tier, hi + step);
  }
  function resultTier(kase, base, added, G) {
    if (kase === "fuse") return fuseTier(base.tier, added.tier, G);
    let t = tierRule(base.tier, added.tier, base.id === added.id, G);
    if (kase === "mix") t = Math.min(t, G.budget.ingredient_max_tier);
    return t;
  }
  function capFor(tier, G) { return G.budget.base + G.budget.per_tier * tier; }

  function hintsOf(thing, G) {
    const h = { element: "", forms: [], modifiers: [], status: "", visual_part: "", material: "", adjective: "" };
    for (const [k, v] of Object.entries(thing.hints || {})) if (k in h) h[k] = Array.isArray(v) ? v.slice() : v;
    const table = G.tag_table;
    for (const tag of (thing.tags || [])) {
      const t = tag.split(":").pop();
      const row = table[t];
      if (!row) continue;
      if (!h.element && row.element) h.element = row.element;
      if (!h.forms.length && row.form) h.forms = [row.form];
      if (!h.modifiers.length && row.modifiers) h.modifiers = row.modifiers.slice();
      if (!h.visual_part && row.visual_part) h.visual_part = row.visual_part;
    }
    return h;
  }
  function mergeTags(aTags, bTags, element) {
    const tags = [];
    if (element && element !== "physical") tags.push("element:" + element);
    for (const t of [...(aTags || []), ...(bTags || [])]) {
      if (t.startsWith("element:") && element && t !== "element:" + element) continue;
      if (!tags.includes(t)) tags.push(t);
    }
    return tags.slice(0, 6);
  }

  // ------------------------------------------------------------------ the base, the gift
  function baseRecord(base) {
    const rec = base.base || { root: base.id, on: null, depth: 0 };
    return { root: rec.root, on: base.id, depth: rec.depth + 1 };
  }
  function baseOf(thing, W, depth) {
    depth = depth || 0;
    if (!isWeapon(thing)) return null;
    if (thing.base) return thing.base;
    const parents = (thing.parents || []).filter(p => W.has ? W.has(p) : p in W).map(p => W.has ? W.get(p) : W[p]);
    const weapons = parents.filter(isWeapon);
    if (!weapons.length || depth > 20) return { root: thing.id, on: null, depth: 0 };
    const on = weapons[0];
    const rec = baseOf(on, W, depth + 1) || { root: on.id, on: null, depth: 0 };
    return { root: rec.root, on: on.id, depth: rec.depth + 1 };
  }
  function classGifts(cls, G) { if (cls === "legendary") return []; return ((G.classes[cls] || {}).gift || []).slice(); }
  function gifts(base, giver, G) {
    const words = [];
    if (giver.id === base.id) words.push("twin");
    if (giver.hybrid) {
      const [a, b] = giver.hybrid.classes; const ga = classGifts(a, G), gb = classGifts(b, G);
      for (let i = 0; i < Math.max(ga.length, gb.length); i++) { if (i < ga.length) words.push(ga[i]); if (i < gb.length) words.push(gb[i]); }
    } else words.push(...classGifts(bodyClass(giver), G));
    const gw = giver.weapon, bw = base.weapon;
    if (gw.element !== "physical" && bw.element === "physical") words.push(gw.element);
    words.push(...gw.modifiers, ...gw.status);
    const have = new Set([...bw.modifiers, ...bw.status, bw.element]);
    return dedupe(words.filter(w => !have.has(w)));
  }
  function axisOf(word, G) {
    if (G.modifiers.includes(word)) return "modifier";
    if (G.statuses.includes(word)) return "status";
    if (word in G.elements) return "element";
    return null;
  }
  function applyGift(w0, word, G) {
    const w = clone(w0); const axis = axisOf(word, G); let replaced = null;
    if (axis === "modifier") {
      const nw = [word, ...w.modifiers.filter(m => m !== word)]; if (nw.length > 3) replaced = nw[3]; w.modifiers = nw.slice(0, 3);
      if (word === "giant") w.visual.size = "L"; else if (word === "tiny") w.visual.size = "S";
    } else if (axis === "status") {
      const nw = [word, ...w.status.filter(s => s !== word)]; if (nw.length > 2) replaced = nw[2]; w.status = nw.slice(0, 2);
    } else if (axis === "element") {
      w.element = word; const dflt = G.elements[word].status;
      const nw = [...(dflt ? [dflt] : []), ...w.status.filter(s => s !== dflt)]; if (nw.length > 2) replaced = nw[2]; w.status = nw.slice(0, 2);
    }
    return [w, replaced];
  }
  function giverAdjective(giver, G) { return (giver.hints || {}).adjective || (G.classes[classOf(giver) || ""] || {}).adjective || giver.name; }

  // ------------------------------------------------------------------ the Crucible
  const FUSE_LINES = {
    legend: n => "A legend is forged once: " + n + " can't go back in the Crucible",
    tier: (n, t) => "Only rare weapons or better can hold a legend: " + n + " is " + t,
    same: c => "Two " + c + "s make a better " + c + ", not a new kind of weapon: use the anvil",
    weapon: "Put two weapons in the molds"
  };
  function fuseCheck(left, right, G) {
    if (!(isWeapon(left) && isWeapon(right))) return FUSE_LINES.weapon;
    for (const t of [left, right]) if (t.hybrid) return FUSE_LINES.legend(t.name);
    for (const t of [left, right]) if (t.tier < G.fuse.min_tier) return FUSE_LINES.tier(t.name, G.tiers[String(t.tier)]);
    if (bodyClass(left) === bodyClass(right)) return FUSE_LINES.same(bodyClass(left));
    return null;
  }
  function fuseTier(tl, tr, G) { return Math.min(G.budget.max_tier, Math.max(G.fuse.tier_floor, Math.max(tl, tr) + 1)); }
  function fuseForms(left, right, G) {
    const opts = [right.weapon.form, ...G.classes[bodyClass(right)].forms, ...(((right.hints || {}).forms) || [])];
    return dedupe(opts).filter(f => f !== left.weapon.form);
  }
  function kindKey(left, right) { return bodyClass(left) + "*" + bodyClass(right); }
  const SIZE_ORDER = { S: 0, M: 1, L: 2 };

  // ------------------------------------------------------------------ the Combiner
  function combine(kase, base, added, tier, G, kind) {
    if (kase === "mix") return combineMix(base, added, tier, G);
    if (kase === "fuse") return combineFuse(base, added, tier, G, kind || null);
    if (kase === "gift") return combineGift(base, added, tier, G);
    const parent = base, other = added;
    const w = clone(parent.weapon);
    const h = hintsOf(other, G);
    if (h.element) w.element = h.element;
    // (forge rules 3, 2026-10-07) the form is the base's for ever: an ingredient adds on top (an element, a status, modifiers, a part),
    // never a new way of attacking. A War Horn on an axe makes an axe that charges, not an axe that lobs
    const st = [];
    const dflt = G.elements[w.element].status;
    if (dflt) st.push(dflt);
    if (h.status && !st.includes(h.status)) st.push(h.status);
    for (const s of parent.weapon.status) if (!st.includes(s) && st.length < 2) st.push(s);
    w.status = st.slice(0, 2);
    w.modifiers = dedupe([...h.modifiers, ...w.modifiers]).slice(0, 3);
    const v = w.visual;
    if (h.material) v.material = h.material;
    const att = v.attachments.slice();
    if (h.visual_part && !att.includes(h.visual_part)) att.push(h.visual_part);
    v.attachments = att.slice(-2);
    if (w.modifiers.includes("giant")) v.size = "L";
    else if (w.modifiers.includes("tiny")) v.size = "S";
    const delta = Math.max(tier - parent.tier, 0);
    const n = Object.assign({}, w.numbers);
    n.damage = Math.min(10, n.damage + 2 * delta);
    n.rate = Math.min(10, n.rate + delta);
    w.numbers = n;
    const adj = h.adjective || other.name;
    let name = adj + " " + parent.name;
    if (name.length > 28) name = adj + " " + title(v.base);
    if (name.length > 28) name = name.slice(0, 28).replace(/\s+$/, "");
    return { id: slug(name), name, kind: "weapon", tier,
      tags: mergeTags(parent.tags, other.tags, w.element),
      flavor: base.name + " and " + added.name + ", hammered into one.",
      parents: [base.id, added.id], hints: hintsOf(parent, G), weapon: w,
      base: baseRecord(base), gift: null, hybrid: parent.hybrid ? clone(parent.hybrid) : null };
  }
  function combineGift(base, giver, tier, G) {
    const same = base.id === giver.id;
    let w = clone(base.weapon);
    const words = gifts(base, giver, G);
    const word = words.length ? words[0] : null;
    let replaced = null;
    if (word) [w, replaced] = applyGift(w, word, G);
    const delta = Math.max(tier - base.tier, 0);
    const n = Object.assign({}, w.numbers);
    n.damage = Math.min(10, n.damage + 2 * delta);
    n.rate = Math.min(10, n.rate + delta);
    w.numbers = n;
    const cls = classOf(giver);
    w.visual.graft = cls;
    let name;
    if (same) name = base.name.startsWith("Twin ") ? "Triple " + base.name.slice(5) : "Twin " + base.name;
    else { const adj = giverAdjective(giver, G); name = adj + " " + base.name; if (name.length > 28) name = adj + " " + title(w.visual.base); }
    if (name.length > 28) name = name.slice(0, 28).replace(/\s+$/, "");
    return { id: slug(name), name, kind: "weapon", tier,
      tags: mergeTags(base.tags, giver.tags, w.element),
      flavor: base.name + " and " + giver.name + ", hammered into one.",
      parents: [base.id, giver.id], hints: hintsOf(base, G), weapon: w,
      base: baseRecord(base),
      gift: { from: giver.id, class: cls, word, axis: word ? axisOf(word, G) : null, replaced },
      hybrid: base.hybrid ? clone(base.hybrid) : null };
  }
  function combineMix(A, B, tier, G) {
    const same = A.id === B.id;
    let strong, weak;
    if (A.tier >= B.tier) { strong = A; weak = B; } else { strong = B; weak = A; }
    const hs = hintsOf(strong, G), hw = hintsOf(weak, G);
    const h = { element: hs.element || hw.element,
      forms: dedupe([...hs.forms, ...hw.forms]).slice(0, 2),
      modifiers: dedupe([...hs.modifiers, ...hw.modifiers]).slice(0, 2),
      status: hs.status || hw.status, visual_part: hs.visual_part || hw.visual_part,
      material: hs.material || hw.material, adjective: hs.adjective || hw.adjective };
    const ha = hintsOf(A, G);
    let name = same ? "Double " + A.name : (ha.adjective || A.name) + " " + B.name;
    if (name.length > 28) name = name.slice(0, 28).replace(/\s+$/, "");
    return { id: slug(name), name, kind: "ingredient", tier: Math.min(tier, G.budget.ingredient_max_tier),
      tags: mergeTags(A.tags, B.tags, h.element), flavor: A.name + " and " + B.name,
      parents: [A.id, B.id], hints: h, weapon: null, base: null, gift: null, hybrid: null };
  }
  function combineFuse(left, right, tier, G, kind) {
    const lw = left.weapon, rw = right.weapon;
    const w = clone(lw);
    w.form = lw.form;
    const forms = fuseForms(left, right, G);
    w.form2 = forms.length ? forms[0] : null;
    w.element = lw.element !== "physical" ? lw.element : rw.element;
    const dflt = G.elements[w.element].status;
    w.status = dedupe([...(dflt ? [dflt] : []), ...lw.status, ...rw.status]).slice(0, 2);
    w.modifiers = dedupe([...classGifts(bodyClass(right), G).slice(0, 1), ...lw.modifiers, ...rw.modifiers]).slice(0, 3);
    const uses = new Set([...G.forms[w.form].uses, ...(w.form2 ? G.forms[w.form2].uses : [])]);
    const n = {};
    for (const k of G.numbers) n[k] = uses.has(k) ? Math.max(lw.numbers[k], rw.numbers[k]) : 1;
    w.numbers = n;
    const v = w.visual;
    v.base = bodyClass(left); v.fuse = bodyClass(right);
    v.material = lw.visual.material;
    v.attachments = dedupe([...lw.visual.attachments, ...rw.visual.attachments]).slice(-2);
    v.size = SIZE_ORDER[lw.visual.size] >= SIZE_ORDER[rw.visual.size] ? lw.visual.size : rw.visual.size;
    v.graft = null;
    const adj = (left.hints || {}).adjective || (right.hints || {}).adjective || G.classes[bodyClass(left)].adjective;
    const kindName = kind ? kind.name : title(bodyClass(left)) + "-" + title(bodyClass(right));
    let name = adj + " " + kindName;
    if (name.length > 28) name = kindName;
    if (name.length > 28) name = name.slice(0, 28).replace(/\s+$/, "");
    return { id: slug(name), name, kind: "weapon", tier,
      tags: mergeTags(left.tags, right.tags, w.element),
      flavor: left.name + " and " + right.name + ", melted into one.",
      parents: [left.id, right.id], hints: hintsOf(left, G), weapon: w,
      base: baseRecord(left), gift: null,
      hybrid: { classes: [bodyClass(left), bodyClass(right)], kind: kind ? kind.id : null } };
  }

  // ------------------------------------------------------------------ the validator
  function validate(thing, tier, G, existingNames, parents, kase, ctx) {
    existingNames = existingNames || []; parents = parents || []; ctx = ctx || {};
    const notes = [];
    const t = clone(thing);
    const base = parents.length ? parents[0] : null;
    const added = parents.length > 1 ? parents[1] : null;
    const parentWeapons = parents.filter(isWeapon);
    if (kase === undefined || kase === null) kase = (parents.length && !parentWeapons.length) ? "mix" : (t.hybrid && !(base && base.hybrid)) ? "fuse" : parentWeapons.length === 2 ? "gift" : "apply";
    if (kase === "mix" && t.kind !== "ingredient") { t.kind = "ingredient"; notes.push("kind forced to ingredient (two ingredients)"); }
    else if (parentWeapons.length && t.kind !== "weapon") { t.kind = "weapon"; notes.push("kind forced to weapon (a parent is a weapon)"); }
    if (t.kind === "ingredient") tier = Math.min(tier, G.budget.ingredient_max_tier);
    if (t.tier !== undefined && t.tier !== null && t.tier !== tier) notes.push("tier set to " + tier);
    t.tier = tier;
    let name = String(t.name || "").replace(/\s+/g, " ").trim();
    let cleaned = name.replace(/[^A-Za-z0-9' -]/g, "").replace(/\s+/g, " ").trim();
    if (cleaned !== name) { notes.push("name characters cleaned"); name = cleaned; }
    const maxlen = G.name_rules.max_length;
    if (name.length > maxlen) {
      const cut = name.slice(0, maxlen);
      name = (cut.includes(" ") ? cut.slice(0, cut.lastIndexOf(" ")) : cut).replace(/\s+$/, "");
      notes.push("name truncated");
    }
    const low = name.toLowerCase();
    if (!name || G.name_rules.banned.some(b => low.includes(b))) {
      const bse = t.kind === "weapon" ? (((t.weapon || {}).visual || {}).base || "thing") : "mixture";
      const adj = ((t.hints || {}).adjective) || "Odd";
      name = (adj + " " + title(bse)).slice(0, maxlen).replace(/\s+$/, "");
      notes.push("name replaced (empty or banned)");
    }
    if (low && existingNames.some(e => low === e.toLowerCase())) notes.push("duplicate name");
    t.name = name; t.id = slug(name);
    let flavor = String(t.flavor || "").replace(/\s+/g, " ").trim();
    if (flavor.length > G.name_rules.flavor_max_length) { flavor = flavor.slice(0, G.name_rules.flavor_max_length).replace(/\s+$/, ""); notes.push("flavor truncated"); }
    t.flavor = flavor || (name + ".");
    const tags = (t.tags || []).map(x => String(x).trim().toLowerCase()).filter(x => x);
    t.tags = dedupe(tags).slice(0, 6); if (!t.tags.length) t.tags = ["thing"];
    const h = { element: "", forms: [], modifiers: [], status: "", visual_part: "", material: "", adjective: "" };
    for (const [k, v] of Object.entries(t.hints || {})) if (k in h) h[k] = v;
    h.element = (h.element in G.elements) ? h.element : "";
    h.forms = dedupe(h.forms || []).filter(f => f in G.forms).slice(0, 2);
    h.modifiers = dedupe(h.modifiers || []).filter(m => G.modifiers.includes(m)).slice(0, 2);
    h.status = G.statuses.includes(h.status) ? h.status : "";
    h.visual_part = G.visual.attachments.includes(h.visual_part) ? h.visual_part : "";
    h.material = (h.material in G.visual.materials) ? h.material : "";
    h.adjective = String(h.adjective || "").replace(/[^A-Za-z0-9' -]/g, "").slice(0, 16).trim();
    t.hints = h;
    if (parents.length) t.parents = parents.map(p => p.id);
    if (t.kind === "ingredient") { t.weapon = null; t.base = null; t.gift = null; t.hybrid = null; t.budget = { spent: 0, cap: 0 }; return [t, notes]; }
    let w = t.weapon || {};
    const parentW = (base && isWeapon(base)) ? base.weapon : (parentWeapons.length ? parentWeapons[0].weapon : null);
    if (kase === "gift" && base !== null) {
      const words = ctx.gifts !== undefined && ctx.gifts !== null ? ctx.gifts : gifts(base, added, G);
      let word = t.gift ? (t.gift || {}).word : ctx.word;
      if (word === undefined) word = null;
      if (words.length && !words.includes(word)) { notes.push(word ? "gift word replaced" : "gift word set"); word = words[0]; }
      if (!words.length) word = null;
      let gw, replaced;
      if (word) [gw, replaced] = applyGift(base.weapon, word, G); else { gw = clone(base.weapon); replaced = null; }
      gw.numbers = Object.assign({}, w.numbers || gw.numbers);
      w = gw;
      w.visual.graft = classOf(added);
      t.gift = { from: added.id, class: classOf(added), word, axis: word ? axisOf(word, G) : null, replaced };
      t.hybrid = base.hybrid ? clone(base.hybrid) : null;
    }
    if (kase === "fuse" && base !== null && added !== null) {
      if (w.form !== base.weapon.form) notes.push("form kept");
      w.form = base.weapon.form;
      const opts = ctx.form2_options !== undefined && ctx.form2_options !== null ? ctx.form2_options : fuseForms(base, added, G);
      if (opts.length && !opts.includes(w.form2)) { notes.push("form2 set to " + opts[0]); w.form2 = opts[0]; }
      if (!opts.length) w.form2 = null;
      if (w.form2 === w.form) { const o = opts.find(x => x !== w.form); w.form2 = o === undefined ? null : o; }
      const elOpts = dedupe([base.weapon.element, added.weapon.element]);
      if (!elOpts.includes(w.element)) { notes.push("element replaced"); w.element = elOpts[0]; }
      const matOpts = dedupe([base.weapon.visual.material, added.weapon.visual.material]);
      const v0 = w.visual || {};
      if (!matOpts.includes(v0.material)) { notes.push("material replaced"); v0.material = matOpts[0]; }
      v0.base = bodyClass(base); v0.fuse = bodyClass(added); v0.graft = null;
      w.visual = v0;
      const kind = ctx.kind;
      t.hybrid = { classes: [bodyClass(base), bodyClass(added)], kind: kind ? kind.id : ((t.hybrid || {}).kind === undefined ? null : (t.hybrid || {}).kind) };
      t.gift = null;
    }
    if (kase === "apply" && base !== null) {
      // (forge rules 3) the base's forms, whatever the draft said
      if (w.form !== base.weapon.form) notes.push("form kept");
      w.form = base.weapon.form;
      const bf2 = base.weapon.form2 || null;
      if ((w.form2 || null) !== bf2) notes.push(bf2 ? "form2 kept" : "form2 dropped");
      w.form2 = bf2;
      t.hybrid = base.hybrid ? clone(base.hybrid) : null;
      t.gift = null;
    }
    if (!(w.form in G.forms)) { w.form = parentW ? parentW.form : "slash"; notes.push("form replaced"); }
    if (w.form2 !== undefined && w.form2 !== null && !(w.form2 in G.forms)) { w.form2 = null; notes.push("form2 dropped"); }
    if (!(w.element in G.elements)) { w.element = parentW ? parentW.element : "physical"; notes.push("element replaced"); }
    let status = dedupe(w.status || []).filter(s => G.statuses.includes(s));
    if (status.length > 2) notes.push("statuses cut to 2");
    w.status = status.slice(0, 2);
    let mods = dedupe(w.modifiers || []).filter(m => G.modifiers.includes(m));
    if (mods.length > 3) notes.push("modifiers cut to 3");
    w.modifiers = mods.slice(0, 3);
    const uses = G.forms[w.form].uses.slice();
    if (w.form2) for (const k of G.forms[w.form2].uses) if (!uses.includes(k)) uses.push(k);
    const n = {};
    for (const k of G.numbers) {
      let val = parseInt((w.numbers || {})[k], 10);
      if (Number.isNaN(val)) val = 1;
      n[k] = Math.max(1, Math.min(10, val));
    }
    for (const k of G.numbers) if (!uses.includes(k) && n[k] !== 1) { n[k] = 1; notes.push(k + " is not used by " + w.form + ": set to 1"); }
    const B = G.budget;
    const cap = capFor(tier, G);
    const floor = cap - B.floor_gap;
    const form2Cost = w.form2 ? G.fuse.form2_cost : 0;
    const spent = () => G.numbers.reduce((s, k) => s + n[k], 0) + B.modifier_cost * w.modifiers.length + B.status_cost * w.status.length + form2Cost;
    if (spent() > cap) {
      notes.push("over budget (" + spent() + " > " + cap + "): scaled down");
      let fixed = G.numbers.filter(k => !uses.includes(k)).length + B.modifier_cost * w.modifiers.length + B.status_cost * w.status.length + form2Cost;
      while (cap - fixed < uses.length && w.modifiers.length) {
        if (kase === "gift" && t.gift && t.gift.word === w.modifiers[w.modifiers.length - 1] && w.modifiers.length > 1) w.modifiers = [...w.modifiers.slice(0, -2), w.modifiers[w.modifiers.length - 1]];
        else w.modifiers = w.modifiers.slice(0, -1);
        fixed -= B.modifier_cost; notes.push("modifier dropped");
      }
      const room = cap - fixed;
      const total = uses.reduce((s, k) => s + n[k], 0);
      for (const k of uses) n[k] = Math.max(1, Math.floor((n[k] * room) / total));
      const order = G.numbers.slice();
      while (spent() > cap) {
        let best = null;
        for (const k of uses) if (best === null || n[k] > n[best] || (n[k] === n[best] && order.indexOf(k) < order.indexOf(best))) best = k;
        if (n[best] <= 1) break;
        n[best] -= 1;
      }
    }
    if (spent() < floor) {
      notes.push("under budget (" + spent() + " < " + floor + "): raised");
      let guard = 0;
      while (spent() < floor && guard < 200) {
        let moved = false;
        for (const k of G.numbers) if (uses.includes(k) && n[k] < 10 && spent() < floor) { n[k] += 1; moved = true; }
        if (!moved) break;
        guard += 1;
      }
    }
    w.numbers = n;
    const v = w.visual || {};
    if ((kase === "apply" || kase === "gift") && base !== null) {
      if (v.base !== base.weapon.visual.base) notes.push("base replaced");
      v.base = base.weapon.visual.base;
      if ("fuse" in base.weapon.visual) v.fuse = base.weapon.visual.fuse;
      if (kase === "apply" && base.weapon.visual.graft) v.graft = base.weapon.visual.graft;
    }
    if (!G.visual.bases.includes(v.base)) { v.base = parentW ? parentW.visual.base : "sword"; notes.push("base replaced"); }
    if (!(v.material in G.visual.materials)) { v.material = parentW ? parentW.visual.material : "steel"; notes.push("material replaced"); }
    if (kase === "gift" && base !== null) {
      v.material = base.weapon.visual.material;
      v.attachments = base.weapon.visual.attachments.slice();
      const gsz = base.weapon.visual.size, word = t.gift.word;
      v.size = word === "giant" ? "L" : word === "tiny" ? "S" : gsz;
    }
    v.attachments = dedupe(v.attachments || []).filter(a => G.visual.attachments.includes(a)).slice(0, 2);
    if (!G.visual.sizes.includes(v.size)) v.size = "M";
    if (v.fuse !== undefined && v.fuse !== null && !G.visual.bases.includes(v.fuse)) v.fuse = null;
    if (v.graft !== undefined && v.graft !== null && !G.visual.bases.includes(v.graft) && v.graft !== "legendary") v.graft = null;
    v.spot = w.element !== "physical" ? G.elements[w.element].spot : G.visual.materials[v.material];
    const outV = { base: v.base, material: v.material, attachments: v.attachments, size: v.size, spot: v.spot };
    if (v.fuse) outV.fuse = v.fuse;
    if (v.graft) outV.graft = v.graft;
    const outW = { form: w.form, element: w.element, status: w.status, modifiers: w.modifiers, numbers: w.numbers, visual: outV };
    if (w.form2) outW.form2 = w.form2;
    t.weapon = outW;
    if (base !== null && isWeapon(base) && ["apply", "gift", "fuse"].includes(kase)) t.base = baseRecord(base);
    else if ((t.base === undefined || t.base === null) && parentWeapons.length) t.base = baseRecord(parentWeapons[0]);
    if (kase === "apply" || kase === null) { if (t.gift === undefined) t.gift = null; }
    if (t.hybrid === undefined) t.hybrid = null;
    t.budget = { spent: spent(), cap };
    return [t, notes];
  }

  // ------------------------------------------------------------------ the form of a class, the repair
  // the one form a class attacks with: the first of its forms (the class weapon's own); a legend's is its body's
  function classForm(cls, G) { const c = G.classes[cls]; return c && c.forms && c.forms.length ? c.forms[0] : null; }
  function formOf(thing, G) {
    if (!isWeapon(thing)) return null;
    const body = thing.hybrid && thing.hybrid.classes ? thing.hybrid.classes[0] : thing.weapon.visual.base;
    return classForm(body, G);
  }
  // (forge rules 3) a weapon forged under the old rules may attack with an ingredient's form (an axe that lobs): it is given its class's
  // form back, a second form that now equals it is dropped, and its numbers are made legal for the form (the validator's clamp, with no
  // parents: the record's name, id, tags and history stay). Returns [thing, changed]
  function repairForm(thing, G) {
    const want = formOf(thing, G);
    if (!want || thing.weapon.form === want) return [thing, false];
    const t = clone(thing);
    t.weapon.form = want;
    if (t.weapon.form2 === want) t.weapon.form2 = null;
    if (!t.hybrid && t.weapon.form2) t.weapon.form2 = null;   // only a legend has a second form
    const [v] = validate(t, t.tier, G, [], [], null);
    t.weapon = v.weapon; t.budget = v.budget;
    return [t, true];
  }

  // ------------------------------------------------------------------ links, twins
  function linkOk(existing, result) {
    if (existing.kind !== result.kind) return false;
    if (result.kind === "weapon") return classOf(existing) === classOf(result);
    return true;
  }
  // the fingerprint's text (the SHA-1 is taken by the service; the bench compares the text)
  function fingerprintText(thing) {
    if (!isWeapon(thing)) return null;
    const w = thing.weapon, v = w.visual;
    const core = { attachments: v.attachments.slice().sort(), class: v.base, element: w.element, form: w.form, form2: w.form2 || null,
      fuse: v.fuse || null, graft: v.graft || null, material: v.material, modifiers: w.modifiers.slice().sort(), size: v.size, status: w.status.slice().sort() };
    return JSON.stringify(core);
  }

  const api = { slug, dedupe, title, isWeapon, classOf, bodyClass, roles, keyText, pairKey, tierRule, resultTier, capFor, hintsOf, mergeTags,
    baseRecord, baseOf, classGifts, gifts, axisOf, applyGift, giverAdjective, fuseCheck, fuseTier, fuseForms, kindKey, FUSE_LINES,
    combine, combineGift, combineMix, combineFuse, validate, classForm, formOf, repairForm, linkOk, fingerprintText };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Forge = api;
})(typeof window !== "undefined" ? window : globalThis);
