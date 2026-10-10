// FORGE FOREVER: cloud.js (design pass 13 with its revision 3, build 9). The online copy of a player's records, on the Cloudflare
// copy of the game only. A page there carries <meta name="ff-cloud" content="/api/v1">, stamped by tools/deploy-cloud.sh. Anywhere
// else (GitHub Pages and the TestFlight app that loads it, a page opened from disk, the harnesses) Cloud.on is false, Cloud.ready
// resolves at once and every call does nothing, so the game is exactly as it was.
//
// Since build 16 (design pass 23) the game is on GitHub Pages only, and the server is the backend on Cloudflare: an address in the
// fragment, #handoff=<ticket>, is a player coming from the old Cloudflare copy's moving page, claimed before the page reads the player.
// Pages opened in the checks' test mode (?stay=1) keep the cloud off, so the checks never leave a player online.
// Since build 11 (revision 4) the GitHub Pages copy, which the TestFlight dev app loads, has the switch too, pointing at the Cloudflare
// server from another site: the sign-in is then a token the phone keeps (forge-forever:cloud-token) and sends as Authorization: Bearer,
// since a page can't keep another site's cookie. The Cloudflare copy sends it too, and keeps its cookie.
//
// The game keeps using localStorage as it does. This module copies the player's own records to the server and back, as one bundle:
//   { v: 2, at, smith: { id, name, joined }, forge: <forge-forever:local:<id>>, lessons: <forge-forever:lessons:<id>>,
//     marks: { cellarSeen, gateSeen, gateFirsts, hallSeen } }   or the erase marker { v: 2, erased: true, at }
// (hallSeen, the Great Hall's first visit since design pass 21, rides only once it is set, so a bundle from before it is the same bundle)
// gzipped where the browser can (CompressionStream), plain JSON where it can't. The phone's bookkeeping is forge-forever:cloud =
// { id, rev, dirty, registered, erase }: the player it belongs to, the version both sides last agreed on, unsent changes, whether
// this player was ever online from here, an erase still to send.
//
//   Cloud.on, Cloud.ready             ready: a promise the pages wait for (4 s at most) before reading the player
//   Cloud.status                      off | starting | online | offline | none (no player yet) | signed-out (the key brings it back)
//                                     | local (kept on this phone only: too big, or the server refused it)
//   Cloud.smith, Cloud.role, Cloud.canBench()   the server's word on who this is, and whether the bench is theirs
//   Cloud.touch()                     the page wrote the player's records: they go 2 s later (no more than once every 5 s)
//   Cloud.adopt(record)               the player the menu just named goes online (or, after an erase, takes the account's place)
//   Cloud.newKey(), Cloud.claim(key)  a key for another phone; this phone signed in with one (its game replaced by that player's)
//   Cloud.erase(), Cloud.deleteGame() Erase my smithy online (after the local wipe); the game gone for good, online and here
//   Cloud.foot(build), Cloud.onNote(fn)   Settings' foot line; the page's toast for what happened while it was away
//   Cloud.call(method, path, body, ms)   (build 24, design pass 29) one call to the API with this phone's token, for proto/roll.js:
//                                     { ok, status, json } or { ok: false, status: 0, err }
(function (root) {
  "use strict";
  const doc = root.document || null;
  const meta = doc && doc.querySelector ? doc.querySelector('meta[name="ff-cloud"]') : null;
  const API = meta ? String(meta.getAttribute("content") || "").replace(/\/+$/, "") : "";
  let fileUrl = false; try { fileUrl = root.location.protocol === "file:"; } catch (e) { fileUrl = true; }
  let testPage = false; try { testPage = new URLSearchParams(root.location.search).get("stay") === "1"; } catch (e) { testPage = false; }
  const on = !!API && !fileUrl && !testPage && typeof root.fetch === "function";
  // cross: the server is on another site (the GitHub Pages copy): no cookie, the token alone, and no keepalive send as a page closes
  let cross = false; try { cross = /^https?:\/\//i.test(API) && new URL(API).origin !== root.location.origin; } catch (e) { cross = false; }
  const K = { smith: "forge-forever:smith", local: "forge-forever:local:", lessons: "forge-forever:lessons:", intro: "forge-forever:intro:", sync: "forge-forever:cloud", device: "forge-forever:device",
    note: "forge-forever:cloud-note", cellarSeen: "forge-forever:cellar-seen", gateSeen: "forge-forever:gate-seen", gateFirsts: "forge-forever:gate-firsts", hallSeen: "forge-forever:hall-seen", keepSeen: "forge-forever:keep-seen" };
  const WAIT = 4000, DEBOUNCE = 2000, GAP = 5000, RETRY = 30000, KEEPALIVE_MAX = 60000, AWAY = 60000;
  const DEV = "isaac";   // the bench's dev smith (proto/smith.js): never sent online
  // the Battlegrounds page shows none of the save (it plays what the Forge handed down), so it is never reloaded for the cloud: a run
  // in the cellar or at the Troll Gate is never cut short by a save arriving from elsewhere
  let reloadable = true; try { reloadable = !/battlegrounds/.test(root.location.pathname); } catch (e) { reloadable = true; }
  function reload() { if (!reloadable) return; try { root.location.reload(); } catch (e) { /* the next open shows it */ } }

  // ------------------------------------------------------------------ storage: smith.js's store when it is here (it keeps the visit's
  // copy when the browser blocks storage), else localStorage; sessionStorage for the note a reload carries
  const St = () => (root.Smith && root.Smith.store ? root.Smith.store : null);
  function get(k) { const s = St(); if (s) return s.get(k); try { return root.localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { const s = St(); if (s) return s.set(k, v); try { root.localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function del(k) { const s = St(); if (s) return s.del(k); try { root.localStorage.removeItem(k); return true; } catch (e) { return false; } }
  const parse = t => { if (!t) return null; try { return JSON.parse(t); } catch (e) { return null; } };
  const nowIso = () => new Date().toISOString().replace(/\.\d+Z$/, "Z");
  function readSync() { const s = parse(get(K.sync)); return s && typeof s === "object" ? s : {}; }
  // the sign-in token (build 11): this phone's, kept through an erase (the account stays); in the page's memory when storage is blocked
  const TOKEN = "forge-forever:cloud-token";
  let memToken = null;
  function token() { try { const t = root.localStorage.getItem(TOKEN); if (t) return t; } catch (e) { /* blocked */ } return memToken; }
  function setToken(t) { memToken = t || null; try { if (t) root.localStorage.setItem(TOKEN, t); else root.localStorage.removeItem(TOKEN); } catch (e) { /* kept in memory */ } }
  function writeSync(s) { set(K.sync, JSON.stringify(s)); }
  const record = () => (root.Smith ? root.Smith.read() : parse(get(K.smith)));
  // this phone's own mark on what it sends (kept through an erase), so a newer version on the server that this phone sent itself (the
  // last send of a page that was closing) is told apart from another phone's
  function deviceId() {
    let d = get(K.device);
    if (!d || !/^[0-9a-z]{12}$/.test(d)) { d = Array.from({ length: 12 }, () => "0123456789abcdefghjkmnpqrstvwxyz"[Math.floor(Math.random() * 32)]).join(""); set(K.device, d); }
    return d;
  }
  const realId = r => !!r && typeof r.id === "string" && r.id !== DEV && (!root.Smith || root.Smith.isId(r.id));

  // ------------------------------------------------------------------ state
  const state = { status: on ? "starting" : "off", smith: null, meta: null, error: null };
  const notes = [];
  let noteFn = null;
  function note(m, carry) {
    if (!m) return;
    if (carry) { try { root.sessionStorage.setItem(K.note, m); } catch (e) { /* it is shown now instead */ } }
    else if (noteFn) { try { noteFn(m); } catch (e) { /* the page's toast failed */ } }
    else notes.push(m);
  }
  function take(smith) { if (smith && smith.id) state.smith = smith; }

  // ------------------------------------------------------------------ the bundle
  function collect(id) {
    const r = record();
    if (!r || r.id !== id) return null;
    return { v: 2, at: nowIso(), by: on ? deviceId() : null, smith: { id: r.id, name: r.name, joined: r.joined || null },
      forge: parse(get(K.local + id)), lessons: parse(get(K.lessons + id)),
      marks: Object.assign({ cellarSeen: get(K.cellarSeen), gateSeen: get(K.gateSeen), gateFirsts: parse(get(K.gateFirsts)) }, get(K.hallSeen) !== null ? { hallSeen: get(K.hallSeen) } : {}) };
  }
  const same = (a, b) => !!a && !!b && JSON.stringify([a.smith, a.forge, a.lessons, a.marks]) === JSON.stringify([b.smith, b.forge, b.lessons, b.marks]);
  // apply(bundle, smith): the bundle's records become this phone's (another player's records already here stay where they are)
  function apply(b, smith) {
    if (b && b.erased) { wipeLocal(); return "erased"; }
    const id = (b && b.smith && b.smith.id) || (smith && smith.id);
    if (!id) return "none";
    const name = (b && b.smith && b.smith.name) || (smith && smith.name) || "Kid";
    set(K.smith, JSON.stringify({ v: 1, id, name, joined: (b && b.smith && b.smith.joined) || (smith && smith.joined) || null }));
    if (!b) return "named";
    const put = (k, v) => (v === null || v === undefined ? del(k) : set(k, typeof v === "string" ? v : JSON.stringify(v)));
    put(K.local + id, b.forge); put(K.lessons + id, b.lessons);
    const m = b.marks || {};
    put(K.cellarSeen, m.cellarSeen); put(K.gateSeen, m.gateSeen); put(K.gateFirsts, m.gateFirsts); put(K.hallSeen, m.hallSeen);
    return "applied";
  }
  // wipeLocal(): what Erase my smithy wipes on this phone (settings.js's own list), without telling the server
  function wipeLocal() {
    if (root.Settings && typeof root.Settings.eraseLocal === "function") { root.Settings.eraseLocal(); return; }
    const ks = St() && St().keys ? St().keys("forge-forever:") : [];
    for (const k of ks) if (k.indexOf(K.local) === 0 || k.indexOf(K.lessons) === 0 || k.indexOf(K.intro) === 0) del(k);   // (build 29: the opening's record too)
    for (const k of [K.smith, "forge-forever:to-cellar", "forge-forever:from-cellar", K.cellarSeen]) del(k);
  }

  // ------------------------------------------------------------------ the wire
  // (build 27) socket(path): a WebSocket to the API (wss when the API is https; the same site when the switch is a path), for the
  // arena's queue and bouts (proto/wire.js); throws where WebSocket is missing
  function socket(path) {
    const base = /^https?:\/\//i.test(API) ? API : root.location.origin + API;
    return new root.WebSocket(base.replace(/^http/i, "ws") + path);
  }
  async function call(method, path, body, ms, headers) {
    const ctl = typeof root.AbortController === "function" ? new root.AbortController() : null;
    const t = ctl ? root.setTimeout(() => ctl.abort(), ms || 10000) : 0;
    try {
      const h = Object.assign({}, headers || {});
      const t = token(); if (t) h.authorization = "Bearer " + t;
      let b;
      if (body && body.bytes !== undefined) { b = body.bytes; h["content-type"] = body.type; }
      else if (body !== undefined && body !== null) { b = JSON.stringify(body); h["content-type"] = "application/json"; }
      const res = await root.fetch(API + path, { method, headers: h, body: b, credentials: "same-origin", cache: "no-store", signal: ctl ? ctl.signal : undefined });
      let json = null;
      if (path !== "/save" || method !== "GET") { try { json = await res.json(); } catch (e) { json = null; } }
      return { ok: res.ok, status: res.status, json, res };
    } catch (e) { return { ok: false, status: 0, err: e }; }
    finally { if (t) root.clearTimeout(t); }
  }
  async function pack(text) {
    try {
      if (typeof root.CompressionStream === "function" && typeof root.Blob === "function" && typeof root.Response === "function") {
        const stream = new root.Blob([text]).stream().pipeThrough(new root.CompressionStream("gzip"));
        return { bytes: await new root.Response(stream).arrayBuffer(), type: "application/gzip" };
      }
    } catch (e) { /* plain JSON instead */ }
    return { bytes: text, type: "application/json" };
  }
  async function unpack(res) {
    const type = (res.headers.get("content-type") || "").split(";")[0].trim();
    if (type === "application/gzip") {
      const stream = new root.Blob([await res.arrayBuffer()]).stream().pipeThrough(new root.DecompressionStream("gzip"));
      return parse(await new root.Response(stream).text());
    }
    return parse(await res.text());
  }
  // fetchSave(): { bundle, rev } as the server keeps it, or null
  async function fetchSave() {
    const r = await call("GET", "/save", null, 15000);
    if (!r.ok || !r.res) return null;
    let bundle = null; try { bundle = await unpack(r.res); } catch (e) { bundle = null; }
    const rev = parseInt(r.res.headers.get("x-save-rev") || "0", 10) || 0;
    return bundle ? { bundle, rev } : null;
  }

  // ------------------------------------------------------------------ (build 16) a player coming from the old Cloudflare copy
  // takeHandoff(): the ticket in the address's fragment, taken out of the address at once (history.replaceState), or null
  function takeHandoff() {
    let h = ""; try { h = root.location.hash || ""; } catch (e) { return null; }
    const m = /(?:^#|&)handoff=([A-Za-z0-9_-]{16,64})(?=&|$)/.exec(h);
    if (!m) return null;
    const rest = h.replace(/(^#|&)handoff=[^&]*/, "$1").replace(/^#&/, "#").replace(/^#$/, "");
    try { root.history.replaceState(root.history.state, "", root.location.pathname + root.location.search + rest); } catch (e) { /* kept in the address; spent anyway */ }
    return m[1];
  }
  // claimHandoff(ticket): this phone becomes the player who came across (their game, a new token); false when the ticket is spent or late
  async function claimHandoff(ticket) {
    const r = await call("POST", "/claim", { handoff: ticket }, WAIT);
    if (!r.ok || !r.json || !r.json.smith) return false;
    if (r.json.token) setToken(r.json.token);
    take(r.json.smith);
    const got = r.json.save && !r.json.save.erased ? await fetchSave() : null;
    if (got) apply(got.bundle, state.smith); else { wipeLocal(); apply(null, state.smith); }
    writeSync({ id: state.smith.id, rev: got ? got.rev : (r.json.save ? r.json.save.rev : 0), dirty: false, registered: true });
    note("Welcome back, " + state.smith.name + ". Your game moved here.");
    return true;
  }

  // ------------------------------------------------------------------ opening: who this phone is, and whose records are newer
  async function start() {
    const ticket = takeHandoff();
    if (ticket && await claimHandoff(ticket)) { state.status = "online"; changed = true; return state; }
    const me = await call("GET", "/me", null, WAIT);
    if (me.err || me.status === 0 || me.status >= 500 || me.status === 429) { state.status = "offline"; later(); return state; }
    if (me.status === 401) {
      setToken(null);   // (a token that names no session is forgotten)
      const r = record();
      if (realId(r)) await adopt(r, true);   // a player made offline, or before the cloud: registered now (or signed out, or deleted)
      else state.status = "none";
      return state;
    }
    if (!me.ok || !me.json || !me.json.smith) { state.status = "offline"; later(); return state; }
    take(me.json.smith);
    let m = me.json.save;
    const sync = readSync(), r = record();
    if (sync.erase && sync.id === state.smith.id) {
      if (m && m.erased) { sync.erase = false; sync.rev = m.rev; writeSync(sync); }   // this phone's own erase reached the server
      else {
        // it hadn't yet (the page reloaded at once): it goes now, so the erased game is never taken back from the server
        const e = await call("DELETE", "/save", null, WAIT);
        if (e.ok && e.json) { sync.erase = false; sync.rev = e.json.rev; writeSync(sync); m = { rev: e.json.rev, at: e.json.at, bytes: 0, erased: true }; }
        else { state.status = "offline"; later(); return state; }
      }
    }
    state.meta = m;
    if (!r || r.id !== state.smith.id) {
      if (m && !m.erased) {
        const got = await fetchSave();
        if (got) { apply(got.bundle, state.smith); writeSync({ id: state.smith.id, rev: got.rev, dirty: false, registered: true }); changed = true; }
      } else if (realId(r)) { await rekey(r); changed = true; }   // records made after an erase (or another id's): they become this player's
      else writeSync(Object.assign(readSync(), { id: state.smith.id, rev: m ? m.rev : 0, registered: true }));   // no records: the plank names this player
      state.status = "online";
      return state;
    }
    // the same player on both sides
    if (m && m.erased && m.rev > (sync.rev || 0)) {
      wipeLocal(); writeSync({ id: state.smith.id, rev: m.rev, dirty: false, registered: true });   // erased on another phone: forgotten here too
      note("Your game was erased on another phone", true); changed = true;
    } else if (!m) {
      touch(true);
    } else if (m.rev === (sync.rev || 0)) {
      if (sync.dirty) touch(true);
    } else if (m.rev > (sync.rev || 0)) {
      await reconcile(m, sync); changed = true;
    } else {
      sync.rev = m.rev; writeSync(sync); touch(true);   // the server is behind this phone (a restore): this phone's records go
    }
    state.status = "online";
    return state;
  }
  // reconcile: the server has a newer version. With nothing unsent here it is taken; with unsent changes too, they are sent first (the
  // server keeps them as a revision) and the newer one is taken, unless they are the same (this phone's last send arrived as it closed)
  async function reconcile(m, sync) {
    const got = await fetchSave();
    if (!got) return;
    const id = state.smith.id;
    if (sync.dirty) {
      const mine = collect(id);
      if (same(mine, got.bundle)) { writeSync({ id, rev: got.rev, dirty: false, registered: true }); return; }
      // the newer version is this phone's own (sent as the last page closed) and this phone has changed since: its records go again
      if (got.bundle.by && got.bundle.by === deviceId()) { const now = readSync(); writeSync(Object.assign(now, { id, rev: got.rev, dirty: true, registered: true })); touch(true); return; }
      if (mine) { const body = await pack(JSON.stringify(mine)); await call("PUT", "/save", body, 15000, { "if-match": `"${sync.rev || 0}"` }); }
      note("Your game was updated on another phone", true);
    }
    if (got.bundle.erased) { wipeLocal(); writeSync({ id, rev: got.rev, dirty: false, registered: true }); return; }
    apply(got.bundle, state.smith);
    writeSync({ id, rev: got.rev, dirty: false, registered: true });
  }
  // rekey(r): this phone's records under r.id become the signed-in player's (after an erase, the plank made a new id)
  async function rekey(r) {
    const to = state.smith.id;
    if (r.id !== to) for (const p of [K.local, K.lessons]) { const v = get(p + r.id); if (v !== null) { set(p + to, v); del(p + r.id); } }
    set(K.smith, JSON.stringify({ v: 1, id: to, name: r.name, joined: r.joined || state.smith.joined || null }));
    const sync = readSync();
    writeSync({ id: to, rev: state.meta ? state.meta.rev : (sync.id === to ? sync.rev || 0 : 0), dirty: true, registered: true });
    touch(true);
  }

  // ------------------------------------------------------------------ registering
  async function adopt(r, booting) {
    if (!on || !realId(r)) return state;
    if (!booting) await ready;
    if (state.smith) { if (r.id !== state.smith.id || r.name !== state.smith.name) await rekey(r); return state; }
    const sync = readSync();
    const res = await call("POST", "/smiths", { id: r.id, name: r.name, joined: r.joined || null }, WAIT);
    if (res.status === 201 && res.json) {
      take(res.json.smith);
      if (res.json.token) setToken(res.json.token);
      writeSync({ id: r.id, rev: 0, dirty: true, registered: true });
      state.status = "online";
      touch(true);
    } else if (res.status === 409) {
      // the id is online already: this phone's own player whose cookie went (the key brings it back), or (very rarely) someone else's
      state.status = sync.registered && sync.id === r.id ? "signed-out" : "local";
    } else if (res.status === 410) {
      wipeLocal(); writeSync({});
      state.status = "none";
      note("This game was deleted on another phone", true);
      if (!booting) reload();
    } else if (res.err || res.status === 0 || res.status >= 500 || res.status === 429) {
      state.status = "offline"; later();
    } else {
      state.status = "local";
    }
    return state;
  }

  // ------------------------------------------------------------------ sending
  let timer = 0, lastSend = 0, sending = false, again = false, retry = 0;
  function schedule(ms) { if (timer) root.clearTimeout(timer); timer = root.setTimeout(() => { timer = 0; send(); }, ms); }
  // touch(): the page wrote the player's records; now: send as soon as the gap allows (opening, registering)
  function touch(now) {
    if (!on) return;
    const sync = readSync(); sync.dirty = true; sync.gen = (sync.gen || 0) + 1; writeSync(sync);
    const wait = Math.max(now ? 0 : DEBOUNCE, GAP - (Date.now() - lastSend));
    schedule(Math.max(0, wait));
  }
  // later(): try again in 5 s, then 15 s, then every 30 s, until the server answers (a phone back online may need a moment)
  let backoff = 5000;
  function later() { if (retry) return; retry = root.setTimeout(() => { retry = 0; if (!state.smith) restart(); else send(); }, backoff); backoff = Math.min(backoff * 3, RETRY); }
  // restart(): opening again after being offline, while the page runs: what it changes is shown by reloading
  function restart() { changed = false; return start().then(st => { if (changed) { note("Your game was updated from the forge's server", true); reload(); } changed = false; return st; }); }
  async function send() {
    if (!on || !state.smith || ["signed-out", "local", "none"].includes(state.status)) return;
    if (sending) { again = true; return; }
    const r = record();
    if (!realId(r) || r.id !== state.smith.id) return;
    sending = true; lastSend = Date.now();
    try {
      let sync = readSync();
      const gen0 = sync.gen || 0;   // (a change made while this send is on its way is still unsent afterwards)
      if (sync.erase) {
        const e = await call("DELETE", "/save", null, 10000);
        if (!e.ok) { state.status = e.status === 401 ? "signed-out" : "offline"; if (e.status !== 401) later(); return; }
        sync = Object.assign(sync, { erase: false, rev: e.json.rev }); writeSync(sync);
      }
      if (r.name !== state.smith.name) { const p = await call("PATCH", "/me", { name: r.name }, 10000); if (p.ok && p.json) take(p.json.smith); }
      const bundle = collect(r.id); if (!bundle) return;
      const res = await call("PUT", "/save", await pack(JSON.stringify(bundle)), 15000, { "if-match": `"${sync.rev || 0}"` });
      if (res.ok && res.json) {
        const now = readSync();
        writeSync(Object.assign(now, { id: r.id, rev: res.json.rev, dirty: (now.gen || 0) !== gen0, registered: true }));
        state.status = "online"; backoff = 5000;
      } else if (res.status === 409) {
        // the server has a newer version. Most often it is this phone's own: the page before this one sent its last changes as it
        // closed, and this send started from the same version. Then nothing changes here. Otherwise another phone saved first: the
        // server kept this one as a revision, and this phone takes the newer one and starts again from it
        const got = await fetchSave();
        if (got && same(collect(r.id), got.bundle)) {
          const now = readSync();
          writeSync(Object.assign(now, { id: r.id, rev: got.rev, dirty: (now.gen || 0) !== gen0, registered: true }));
          state.status = "online";
        } else if (got && got.bundle.by && got.bundle.by === deviceId()) {
          // this phone's own earlier send: its records now are newer, and go again from that version
          const now = readSync();
          writeSync(Object.assign(now, { id: r.id, rev: got.rev, dirty: true, registered: true }));
          again = true;
        } else if (got) {
          if (got.bundle.erased) wipeLocal(); else apply(got.bundle, state.smith);
          writeSync({ id: r.id, rev: got.rev, dirty: false, registered: true });
          note("Your game was updated on another phone", true);
          reload();
        }
      } else if (res.status === 401) {
        state.smith = null; setToken(null); await adopt(r, false);   // signed out (or deleted) elsewhere: a deleted game reloads as the plank
      } else if (res.status === 413) {
        state.status = "local"; state.error = "too_big";
      } else {
        state.status = "offline"; later();
      }
    } finally {
      sending = false;
      if (again) { again = false; touch(); }
    }
  }
  // the last changes as the page closes: plain JSON with keepalive, when small enough; otherwise the next open sends them
  function flush() {
    if (!on || !state.smith || sending) return;
    const sync = readSync(), r = record();
    if (!sync.dirty || !realId(r) || r.id !== state.smith.id) return;
    if (cross) return;   // (a cross-site send as a page closes would need a preflight the browser may not wait for: the next open sends it)
    const text = JSON.stringify(collect(r.id));
    if (!text || text.length > KEEPALIVE_MAX) return;
    const h = { "content-type": "application/json", "if-match": `"${sync.rev || 0}"` }, t = token(); if (t) h.authorization = "Bearer " + t;
    try { root.fetch(API + "/save", { method: "PUT", keepalive: true, credentials: "same-origin", headers: h, body: text }); } catch (e) { /* the next open sends it */ }
  }

  // ------------------------------------------------------------------ what Settings does
  async function newKey() {
    if (!on) return { ok: false };
    await ready;
    if (!state.smith) return { ok: false, reason: state.status === "signed-out" ? "This phone is signed out. Type your key under Bring a game here." : "Your game isn't online yet. Try again when you're online." };
    const r = await call("POST", "/key", null, 10000);
    return r.ok && r.json && r.json.key ? { ok: true, key: r.json.key } : { ok: false, reason: "Can't reach the forge's server. Try again when you're online." };
  }
  async function claim(key) {
    if (!on) return { ok: false };
    await ready;
    const r = await call("POST", "/claim", { key: String(key || "") }, 10000);
    if (!r.ok || !r.json || !r.json.smith) return { ok: false, reason: (r.json && r.json.reason) || "Can't reach the forge's server. Try again when you're online." };
    take(r.json.smith);
    if (r.json.token) setToken(r.json.token);
    const got = r.json.save && !r.json.save.erased ? await fetchSave() : null;
    if (got) apply(got.bundle, state.smith);
    else { wipeLocal(); apply(null, state.smith); }
    writeSync({ id: state.smith.id, rev: got ? got.rev : (r.json.save ? r.json.save.rev : 0), dirty: false, registered: true });
    state.status = "online";
    return { ok: true, smith: state.smith };
  }
  // erase(): after Settings wiped this phone. It goes now with keepalive (the page reloads at once) and is kept to send again until the
  // server answers, so an erase made offline still reaches it
  function erase() {
    if (!on) return;
    const sync = readSync();
    writeSync(Object.assign(sync, { erase: true, dirty: false }));
    if (!state.smith) return;
    const h = {}, t = token(); if (t) h.authorization = "Bearer " + t;
    try { root.fetch(API + "/save", { method: "DELETE", keepalive: !cross, credentials: "same-origin", headers: h }); } catch (e) { /* the next send does it */ }
  }
  async function deleteGame() {
    if (!on) return { ok: false };
    await ready;
    const r = await call("DELETE", "/me", null, 10000);
    if (r.ok || r.status === 204 || r.status === 401) {
      wipeLocal(); writeSync({}); setToken(null); state.smith = null; state.status = "none";
      return { ok: true };
    }
    return { ok: false, reason: "Can't reach the forge's server. Try again when you're online." };
  }
  function foot(build) {
    const b = " · build " + (build || "dev");
    if (!on) return null;
    switch (state.status) {
      case "online": return "Saved online" + b;
      case "signed-out": return "This phone is signed out · your key brings your game back";
      case "local": return "Saved on this phone only" + b;
      case "none": return "Saved on this phone" + b;
      default: return "Saved on this phone · goes online when you do" + b;
    }
  }
  function onNote(fn) {
    noteFn = typeof fn === "function" ? fn : null;
    let carried = null; try { carried = root.sessionStorage.getItem(K.note); root.sessionStorage.removeItem(K.note); } catch (e) { carried = null; }
    if (carried) notes.unshift(carried);
    while (noteFn && notes.length) { const m = notes.shift(); try { noteFn(m); } catch (e) { /* gone */ } }
  }

  // ------------------------------------------------------------------ boot
  // the page waits for ready (4.5 s at most). When the server answers later than that and the answer changed this phone's records,
  // the page (which has read the old ones) reloads, so what it shows and saves is the newer game
  let readyDone = false, changed = false;
  function done() { readyDone = true; return state; }
  const starting = !on ? null : start().catch(e => { state.status = "offline"; state.error = String(e && e.message || e); later(); return state; })
    .then(st => { if (readyDone && changed) { note("Your game was updated from the forge's server", true); reload(); } changed = false; return st; });
  const ready = !on ? Promise.resolve(state) : Promise.race([starting, new Promise(res => root.setTimeout(() => res(state), WAIT + 500))]).then(done);
  if (on) {
    root.addEventListener("pagehide", flush);
    let hiddenAt = 0;
    doc.addEventListener("visibilitychange", () => {
      if (doc.visibilityState === "hidden") { hiddenAt = Date.now(); flush(); return; }
      // back after a while: another phone may have played; a newer version is taken (the page reloads to show it)
      if (hiddenAt && Date.now() - hiddenAt > AWAY && state.smith && !sending) {
        call("GET", "/me", null, WAIT).then(async me => {
          if (!me.ok || !me.json || !me.json.save) return;
          const sync = readSync();
          if (me.json.save.rev > (sync.rev || 0)) {
            const before = JSON.stringify(collect(state.smith.id));
            await reconcile(me.json.save, sync);
            if (JSON.stringify(collect(state.smith.id)) !== before) { note("Your game was updated on another phone", true); reload(); }
          }
          else if (sync.dirty) touch(true);
        });
      }
    });
    // back online: a second's grace (the network can come back a moment after the event), then the unsent changes go
    root.addEventListener("online", () => root.setTimeout(() => { if (state.status === "offline") { if (retry) { root.clearTimeout(retry); retry = 0; } backoff = 5000; if (state.smith) send(); else restart(); } }, 1000));
  }

  root.Cloud = {
    on, API, cross, ready, K,
    get status() { return state.status; }, get smith() { return state.smith; }, get role() { return state.smith ? state.smith.role : null; },
    get ready_() { return readyDone; },
    canBench() { return on && !!state.smith && (state.smith.role === "dev" || state.smith.role === "admin"); },
    touch, adopt: r => adopt(r, false), newKey, claim, erase, deleteGame, foot, onNote,
    call,   // (build 24) the Roll's claims and reads go through the same wire, with the token
    socket, token,   // (build 27, design pass 36) the arena's wire: a WebSocket to the API and the token its first message carries
    // for the checks: what would be sent, and the bookkeeping
    collect, readSync, send
  };
})(typeof window !== "undefined" ? window : globalThis);
