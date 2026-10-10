// FORGE FOREVER: wire.js (design pass 36 section 4.9, the Arena, build 27). Online play: deterministic lockstep with rollback, and the
// phone's side of the Herald (the queue) and the Bout (the relay, the clock, the record). Every phone in a bout runs the whole fight
// itself (proto/duel.js on the cellar's engine, which is a pure, seeded, fixed-step function of its inputs); the wire carries nothing
// but inputs. A phone's own input for tick t applies at t + inputDelay and is sent at once, with the last `redundancy` ticks in every
// packet against loss; a remote seat's missing input is predicted as its last known; when the truth arrives and differs, the fight is
// put back to that tick's snapshot and stepped again to now (up to `rollback` ticks; beyond that the phone waits: "the sand slows");
// a 32-bit checksum of the fight every `checksumEvery` ticks catches a phone whose sim drifted (the bout is void). The house's knights
// are driven by the sim itself (their inputs are never sent), so every phone plays them alike.
//
//   Wire.available()                  the page has the cloud (proto/cloud.js: Cloud.on, a token) and WebSocket
//   Wire.queue(o)                     the Herald's queue: o = { mode, name, level, loadout: [thingId, thingId], onState(s) }; q.leave()
//                                     s: { kind: "looking", waiting, t, needed, fillIn } | { kind: "filling" } | { kind: "found", bout, ticket, seat,
//                                     seats, seed, mode } | { kind: "offline" } | { kind: "error", why } | { kind: "left", name }
//   Wire.session(o)                   a bout online: o = { bout, ticket, seat, seats, seed, fight, duel, onForfeit(seat), onVoid(why), onEnd(result),
//                                     onWaiting(bool), onError(why), onStart() }; s.frame(realDt, localInput) -> { events, waiting, tick, started };
//                                     s.result(result); s.close(); s.stats()
//   Wire.local(o)                     the same s for a bout with no wire (Spar, or an offline phone): o = { fight, duel, seat }
//   Wire.Lockstep                     the core on its own (the tests): new Wire.Lockstep({ fight, duel, local, seats, tick, inputDelay, rollback,
//                                     checksumEvery, onSum(tick, sum) }); core.frame(targetTick, localInput); core.receive(seat, tick, inputs);
//                                     core.theirSum(seat, tick, sum) -> true on a mismatch; core.forfeit(seat, tick); core.packet(); Wire.pack, Wire.unpack
// Plain script, defines window.Wire (module.exports in node). The core is pure (no clock, no DOM); the sessions use WebSocket and Date.now.
(function (root) {
  "use strict";
  // redundancy: every packet carries the last 24 ticks of the phone's inputs (0.4 s), so a loss is repaired by the next packet unless
  // six in a row are lost at 15 Hz; sendHz: a packet at least that often, and at once when the input changes
  const DEF = { tick: 1 / 60, inputDelay: 3, rollback: 8, redundancy: 24, sendHz: 15, checksumEvery: 30, waitSlows: 8, forfeit: 10, reconnect: 10, pingEvery: 20, queue: { wordEvery: 5, silent: 30 } };
  const spec = () => Object.assign({}, DEF, (root.FORGE_ARENA && root.FORGE_ARENA.wire) || {});
  const MAX_PER_FRAME = 6;   // catching up after a hitch: never more ticks in one frame than this
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // ------------------------------------------------------------------ an input and its bytes (x, y: signed bytes of the stick; buttons: six bits)
  const BTN = { strike: 1, swap: 2, dodge: 4, guard: 8, ability: 16, use: 32 };
  const NEUTRAL = Object.freeze({ move: Object.freeze([0, 0]), strike: false, swap: false, dodge: false, guard: false, ability: false, use: false });
  function toBytes(inp) {
    const m = (inp && inp.move) || [0, 0];
    let b = 0; for (const k of Object.keys(BTN)) if (inp && inp[k]) b |= BTN[k];
    return [clamp(Math.round((+m[0] || 0) * 127), -127, 127), clamp(Math.round((+m[1] || 0) * 127), -127, 127), b];
  }
  function fromBytes(x, y, b) {
    const inp = { move: [x / 127, y / 127] };
    for (const k of Object.keys(BTN)) inp[k] = !!(b & BTN[k]);
    return inp;
  }
  // norm(inp): the input as the other phones will see it (quantised), so the local sim and the remote sims agree
  function norm(inp) { const t = toBytes(inp); return fromBytes(t[0], t[1], t[2]); }
  const keyOf = inp => { const t = toBytes(inp); return ((t[0] & 255) << 16) | ((t[1] & 255) << 8) | t[2]; };
  // a packet of kind 1: [u8 1][u32 tick][u8 seat][n x (i8 x, i8 y, u8 b)] for the ticks tick - n + 1 .. tick (n = redundancy, from the
  // packet's length; 78 bytes at 24); kind 2: [u8 2][u32 tick][u8 seat][u32 sum]
  function pack(seat, tick, inputs) {
    const n = inputs.length, buf = new ArrayBuffer(6 + 3 * n), v = new DataView(buf);
    v.setUint8(0, 1); v.setUint32(1, tick >>> 0, true); v.setUint8(5, seat & 255);
    for (let i = 0; i < n; i++) { const t = toBytes(inputs[i]); v.setInt8(6 + i * 3, t[0]); v.setInt8(7 + i * 3, t[1]); v.setUint8(8 + i * 3, t[2]); }
    return buf;
  }
  function packSum(seat, tick, sum) { const buf = new ArrayBuffer(10), v = new DataView(buf); v.setUint8(0, 2); v.setUint32(1, tick >>> 0, true); v.setUint8(5, seat & 255); v.setUint32(6, sum >>> 0, true); return buf; }
  // unpack(buf) -> { kind: 1, seat, tick, inputs: [{ tick, input }] } | { kind: 2, seat, tick, sum } | null
  function unpack(buf) {
    if (!(buf instanceof ArrayBuffer) || buf.byteLength < 6) return null;
    const v = new DataView(buf), kind = v.getUint8(0), tick = v.getUint32(1, true), seat = v.getUint8(5);
    if (kind === 2) return buf.byteLength >= 10 ? { kind: 2, seat, tick, sum: v.getUint32(6, true) } : null;
    if (kind !== 1) return null;
    const n = Math.floor((buf.byteLength - 6) / 3), inputs = [];
    for (let i = 0; i < n; i++) { const t = tick - n + 1 + i; if (t >= 0) inputs.push({ tick: t, input: fromBytes(v.getInt8(6 + i * 3), v.getInt8(7 + i * 3), v.getUint8(8 + i * 3)) }); }
    return { kind: 1, seat, tick, inputs };
  }

  // ------------------------------------------------------------------ the lockstep core
  function Lockstep(o) {
    const S = spec();
    this.fight = o.fight; this.duel = o.duel; this.local = o.local | 0;
    this.dt = o.tick || S.tick; this.delay = o.inputDelay === undefined ? S.inputDelay : o.inputDelay; this.R = o.rollback === undefined ? S.rollback : o.rollback;
    this.every = o.checksumEvery || S.checksumEvery; this.redundancy = o.redundancy || S.redundancy;
    this.onSum = o.onSum || null;
    // the seats: the local one, the remote ones (whose inputs come over the wire), the house's (the sim's own)
    this.remote = (o.seats || []).filter(s => s.seat !== this.local && !s.house && s.kind !== "house").map(s => s.seat);
    this.tick = 0; this.inputs = new Map(); this.known = new Map(); this.last = new Map(); this.predicted = new Map();
    for (const s of this.remote.concat([this.local])) { this.inputs.set(s, new Map()); this.known.set(s, -1); this.last.set(s, NEUTRAL); this.predicted.set(s, new Map()); }
    this.snaps = new Map(); this.sums = new Map(); this.theirSums = new Map(); this.rollbackTo = null; this.gone = new Map();
    this.played = new Map();   // tick -> Set of event keys already returned
    this.localTop = -1; this.rollbacks = 0; this.resteps = 0; this.waiting = false;
  }
  Lockstep.prototype.minKnown = function () { let m = Infinity; for (const s of this.remote) m = Math.min(m, this.known.get(s)); return m; };
  Lockstep.prototype.canStep = function (t) { for (const s of this.remote) if (!this.gone.has(s) && t - this.known.get(s) > this.R) return false; return true; };
  // needs(): the seats the core waits on, and the first tick it lacks of each (the session asks the Bout to send those again)
  Lockstep.prototype.needs = function () { const out = []; for (const s of this.remote) if (!this.gone.has(s) && this.tick - this.known.get(s) > this.R) out.push({ seat: s, tick: this.known.get(s) + 1 }); return out; };
  // packetFrom(tick, n): the local inputs from that tick on (at most n), for a peer that asked (the Bout answers from its log instead)
  Lockstep.prototype.packetFrom = function (tick, n) {
    const m = this.inputs.get(this.local), from = Math.max(0, tick | 0), to = Math.min(this.localTop, from + (n || this.redundancy) - 1);
    if (to < from) return null;
    const list = []; for (let t = from; t <= to; t++) list.push(m.has(t) ? m.get(t) : NEUTRAL);
    return pack(this.local, to, list);
  };
  Lockstep.prototype.advance = function (seat) {
    const m = this.inputs.get(seat); let k = this.known.get(seat);
    while (m.has(k + 1)) k++;
    this.known.set(seat, k); if (k >= 0) this.last.set(seat, m.get(k));
  };
  // the local input for a tick (recorded once; a frame that steps several ticks records the same input for each)
  Lockstep.prototype.recordLocal = function (t, inp) {
    const m = this.inputs.get(this.local);
    if (m.has(t)) return;
    m.set(t, inp); this.advance(this.local); if (t > this.localTop) this.localTop = t;
  };
  // receive(seat, tick, inputs): a packet's inputs; a late one that differs from what was predicted asks for a rollback to its tick
  Lockstep.prototype.receive = function (seat, tick, inputs) {
    if (!this.inputs.has(seat) || seat === this.local) return false;   // (a forged packet, or our own echoed)
    const m = this.inputs.get(seat), gone = this.gone.get(seat);
    for (const it of inputs) {
      const t = it.tick;
      if (t < 0 || m.has(t) || (gone !== undefined && t >= gone)) continue;
      const inp = norm(it.input);
      m.set(t, inp);
      if (t < this.tick) { const p = this.predicted.get(seat).get(t); if (p === undefined || keyOf(p) !== keyOf(inp)) this.rollbackTo = this.rollbackTo === null ? t : Math.min(this.rollbackTo, t); }
    }
    this.advance(seat);
    return true;
  };
  // forfeit(seat, tick): from that tick the seat's knight is out (the duel is told once, on every phone at the same tick), and every
  // input of its the Bout never relayed (the Bout replays what it did relay before it says forfeit) is neutral, so the remaining phones
  // agree on the whole of its history
  Lockstep.prototype.forfeit = function (seat, tick) {
    if (!this.inputs.has(seat) || seat === this.local) return;
    this.gone.set(seat, tick);
    const m = this.inputs.get(seat), k = this.known.get(seat), top = Math.min(tick, k + 4096) + this.R + 1;
    for (let t = k + 1; t <= top; t++) if (!m.has(t)) m.set(t, NEUTRAL);
    this.advance(seat);
    if (tick < this.tick) this.rollbackTo = this.rollbackTo === null ? tick : Math.min(this.rollbackTo, tick);
  };
  Lockstep.prototype.inputsFor = function (t) {
    const out = {};
    const lm = this.inputs.get(this.local); out[this.local] = lm.has(t) ? lm.get(t) : NEUTRAL;
    for (const s of this.remote) {
      const m = this.inputs.get(s), gone = this.gone.get(s);
      let inp;
      if (gone !== undefined && t >= gone) inp = NEUTRAL;
      else if (m.has(t)) inp = m.get(t);
      else inp = this.last.get(s);
      this.predicted.get(s).set(t, inp);
      out[s] = inp;
      if (gone !== undefined && t > gone + this.R + 1) m.set(t, NEUTRAL);
    }
    return out;
  };
  Lockstep.prototype.stepOne = function () {
    const t = this.tick;
    this.snaps.set(t, this.duel.snapshot(this.fight));
    for (const k of this.snaps.keys()) if (k < t - this.R - 1) this.snaps.delete(k);
    for (const [s, g] of this.gone) if (g === t && !this.forfeited(s)) { this.duel.forfeit(this.fight, s); }
    const inputs = this.inputsFor(t);
    const events = this.duel.step(this.fight, this.dt, inputs) || [];
    for (const e of events) e.tick = t;
    if (this.every > 0 && t % this.every === 0 && t > 0) this.sums.set(t, { sum: this.duel.checksum(this.fight) >>> 0, final: false, sent: false });
    for (const s of this.remote) { const p = this.predicted.get(s); for (const k of p.keys()) if (k < t - this.R - 2) p.delete(k); }
    this.tick = t + 1;
    return events;
  };
  Lockstep.prototype.forfeited = function (seat) { const f = this.fight && this.fight.arena && this.fight.arena.forfeited; return Array.isArray(f) ? f.includes(seat) : f === seat; };
  // dedupe(events): the events a frame returns: on a re-step only those not returned before (a key of tick, type, seat, target, amount)
  Lockstep.prototype.dedupe = function (events) {
    const out = [];
    for (const e of events) {
      const key = e.type + "|" + (e.seat === undefined ? "" : e.seat) + "|" + (e.d === undefined ? "" : e.d) + "|" + (e.amount === undefined ? "" : e.amount) + "|" + (e.x === undefined ? "" : Math.round(e.x)) + "|" + (e.y === undefined ? "" : Math.round(e.y));
      let set = this.played.get(e.tick); if (!set) { set = new Set(); this.played.set(e.tick, set); }
      if (set.has(key)) continue;
      set.add(key); out.push(e);
    }
    for (const k of this.played.keys()) if (k < this.tick - this.R - 2) this.played.delete(k);
    return out;
  };
  // frame(targetTick, localInput): the ticks this frame steps (a rollback first when one is due), bounded by the wall clock and the
  // rollback window; returns { events, waiting, tick }
  Lockstep.prototype.frame = function (targetTick, localInput) {
    const out = [], q = norm(localInput || NEUTRAL);
    if (this.rollbackTo !== null) {
      const to = this.tick, from = this.rollbackTo; this.rollbackTo = null;
      if (from < to) {
        const snap = this.snaps.get(from);
        if (snap) {
          this.duel.restore(this.fight, snap); this.tick = from; this.rollbacks++;
          while (this.tick < to) { for (const e of this.dedupe(this.stepOne())) out.push(e); this.resteps++; }
        }
      }
    }
    let steps = 0; this.waiting = false;
    while (this.tick < targetTick && steps < MAX_PER_FRAME) {
      if (!this.canStep(this.tick)) { this.waiting = true; break; }
      this.recordLocal(this.tick + this.delay, q);
      for (const e of this.dedupe(this.stepOne())) out.push(e);
      steps++;
    }
    // a checksum is final once every remote input up to its tick is known and no rollback can reach it: then it is sent and compared
    const mk = this.minKnown();
    for (const [t, s] of this.sums) {
      if (!s.final && t <= mk && this.tick > t && (this.rollbackTo === null || this.rollbackTo > t)) { s.final = true; if (this.onSum && !s.sent) { s.sent = true; this.onSum(t, s.sum); } this.compare(t); }
      if (t < this.tick - 4 * this.every) this.sums.delete(t);
    }
    return { events: out, waiting: this.waiting, tick: this.tick };
  };
  // theirSum(seat, tick, sum): a remote phone's checksum; true when it differs from our final one (the sand shifted)
  Lockstep.prototype.theirSum = function (seat, tick, sum) {
    let m = this.theirSums.get(tick); if (!m) { m = new Map(); this.theirSums.set(tick, m); }
    m.set(seat, sum >>> 0);
    for (const k of this.theirSums.keys()) if (k < this.tick - 4 * this.every - this.R) this.theirSums.delete(k);
    return this.compare(tick);
  };
  Lockstep.prototype.compare = function (tick) {
    const mine = this.sums.get(tick), theirs = this.theirSums.get(tick);
    if (!mine || !mine.final || !theirs) return false;
    for (const [, v] of theirs) if (v !== mine.sum) { this.desync = { tick, mine: mine.sum, theirs: v }; return true; }
    return false;
  };
  // packet(): the last `redundancy` local inputs, for the wire
  Lockstep.prototype.packet = function () {
    if (this.localTop < 0) return null;
    const m = this.inputs.get(this.local), list = [];
    for (let t = this.localTop - this.redundancy + 1; t <= this.localTop; t++) list.push(t >= 0 && m.has(t) ? m.get(t) : NEUTRAL);
    return pack(this.local, this.localTop, list);
  };

  // ------------------------------------------------------------------ the sessions
  const now = () => Date.now();
  const CloudOf = () => root.Cloud || null;
  function available() { const C = CloudOf(); return !!(C && C.on && typeof C.token === "function" && C.token() && typeof root.WebSocket === "function"); }
  const socketFor = (o, path) => (o.socket ? o.socket(path) : CloudOf().socket(path));
  const tokenOf = o => (o.token !== undefined ? o.token : (CloudOf() && typeof CloudOf().token === "function" ? CloudOf().token() : null));

  // the Herald's queue
  function queue(o) {
    const S = spec();
    let ws = null, done = false, timer = 0;
    const say = s => { if (!done && o.onState) o.onState(s); };
    try { ws = socketFor(o, "/arena/queue"); } catch (e) { say({ kind: "offline" }); return { leave() {} }; }
    ws.onopen = () => { ws.send(JSON.stringify({ kind: "join", token: tokenOf(o), mode: o.mode, name: o.name || null, level: o.level | 0, loadout: o.loadout || [] })); };
    ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.kind === "state") say({ kind: m.filling ? "filling" : "looking", waiting: m.waiting | 0, t: m.t || 0, needed: m.needed | 0, fillIn: m.fillIn });
      else if (m.kind === "found") { done = true; o.onState && o.onState({ kind: "found", bout: m.bout, ticket: m.ticket, seat: m.seat | 0, seats: m.seats, seed: m.seed >>> 0, mode: m.mode }); try { ws.close(1000); } catch (e) { /* closed */ } }
      else if (m.kind === "left") say({ kind: "left", name: m.name });
      else if (m.kind === "error") { say({ kind: "error", why: m.why || m.error || "error" }); done = true; try { ws.close(1000); } catch (e) { /* closed */ } }
    };
    ws.onerror = () => { if (!done) { say({ kind: "offline" }); done = true; } };
    ws.onclose = () => { if (!done) { say({ kind: "offline" }); done = true; } if (timer) root.clearTimeout(timer); };
    timer = root.setTimeout(() => { if (!done && ws.readyState === 0) { say({ kind: "offline" }); done = true; try { ws.close(); } catch (e) { /* closed */ } } }, (S.queue.silent || 30) * 1000);
    return { leave() { done = true; try { ws.send(JSON.stringify({ kind: "leave" })); } catch (e) { /* closed */ } try { ws.close(1000); } catch (e) { /* closed */ } }, get socket() { return ws; } };
  }

  // a bout online: the Bout's socket, the clock, the core, the packets
  function session(o) {
    const S = spec(), dtMs = (o.tick || S.tick) * 1000;
    const st = { started: false, startAt: null, serverStart: null, offset: null, bestRtt: Infinity, ended: false, closed: false, lastSend: 0, lastKey: -1, lastPing: 0, pings: 0, reopen: 0, ws: null, waiting: false };
    const core = new Lockstep({ fight: o.fight, duel: o.duel, local: o.seat, seats: o.seats, tick: o.tick, onSum: (t, sum) => send(packSum(o.seat, t, sum)) });
    const send = data => { try { if (st.ws && st.ws.readyState === 1) st.ws.send(data); } catch (e) { /* the next frame sends again */ } };
    const sendJson = m => send(JSON.stringify(m));
    const ping = () => { st.lastPing = now(); st.pings++; sendJson({ kind: "ping", t: st.lastPing }); };
    const startClock = () => { if (st.serverStart !== null && st.offset !== null && !st.started) { st.startAt = st.serverStart - st.offset; st.started = true; if (o.onStart) o.onStart(); } };
    function open(have) {
      let ws; try { ws = socketFor(o, "/arena/bout/" + encodeURIComponent(o.bout)); } catch (e) { if (o.onError) o.onError("socket"); return; }
      ws.binaryType = "arraybuffer"; st.ws = ws;
      ws.onopen = () => { sendJson({ kind: "hello", ticket: o.ticket, seat: o.seat, have: have | 0 }); ping(); root.setTimeout(ping, 150); const p = core.packet(); if (p) send(p); };
      ws.onmessage = ev => {
        if (typeof ev.data === "string") {
          let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
          if (m.kind === "start") { st.serverStart = +m.at; startClock(); }
          else if (m.kind === "pong") { const rtt = now() - (+m.t || 0); if (rtt < st.bestRtt) { st.bestRtt = rtt; st.offset = (+m.server || 0) - ((+m.t || 0) + rtt / 2); } startClock(); }
          else if (m.kind === "forfeit") { core.forfeit(m.seat | 0, m.tick | 0); if (o.onForfeit) o.onForfeit(m.seat | 0, m.tick | 0); }
          else if (m.kind === "void") { st.ended = true; if (o.onVoid) o.onVoid(m.why || "void"); }
          else if (m.kind === "end") { st.ended = true; if (o.onEnd) o.onEnd(m.result); }
          else if (m.kind === "error") { st.ended = true; if (o.onError) o.onError(m.why || m.error || "error"); }
          return;
        }
        const p = unpack(ev.data); if (!p || p.seat === o.seat) return;
        if (p.kind === 1) core.receive(p.seat, p.tick, p.inputs);
        else if (p.kind === 2 && core.theirSum(p.seat, p.tick, p.sum)) { sendJson({ kind: "void", tick: p.tick, why: "desync" }); st.ended = true; if (o.onVoid) o.onVoid("desync"); }
      };
      ws.onclose = () => { if (st.ended || st.closed) return; if (st.reopen < 5) { st.reopen++; root.setTimeout(() => { if (!st.ended && !st.closed) open(Math.max(0, core.minKnown() === Infinity ? core.tick : Math.min(core.tick, core.minKnown()))); }, 1000); } else if (o.onError) o.onError("lost"); };
      ws.onerror = () => { /* onclose follows */ };
    }
    open(0);
    return {
      core,
      frame(realDt, localInput) {
        if (st.ended) return { events: [], waiting: false, tick: core.tick, started: st.started, ended: true };
        // until the clock runs (the countdown before the start), a ping a second keeps the Bout's silence clock fresh and the offset sharp
        if (!st.started || core.tick === 0) { if (now() - st.lastPing >= 1000) ping(); }
        if (!st.started) return { events: [], waiting: true, tick: core.tick, started: false };
        const target = Math.max(0, Math.floor((now() - st.startAt) / dtMs));
        const r = core.frame(target, localInput);
        if (r.waiting !== st.waiting) { st.waiting = r.waiting; if (o.onWaiting) o.onWaiting(r.waiting); }
        // waiting on a seat: ask the Bout for the inputs that never came (it answers from its log), four times a second at most
        if (r.waiting && now() - (st.lastNeed || 0) >= 250) { st.lastNeed = now(); for (const n of core.needs()) sendJson({ kind: "need", seat: n.seat, tick: n.tick }); }
        const key = core.localTop >= 0 ? keyOf(core.inputs.get(o.seat).get(core.localTop)) : -1, t = now();
        if ((key !== st.lastKey || t - st.lastSend >= 1000 / (S.sendHz || 10)) && core.localTop >= 0) { const p = core.packet(); if (p) { send(p); st.lastSend = t; st.lastKey = key; } }
        if (t - st.lastPing >= (S.pingEvery || 20) * 1000) ping();
        r.started = true; return r;
      },
      result(result) { sendJson({ kind: "result", result }); },
      close() { st.closed = true; try { st.ws && st.ws.close(1000); } catch (e) { /* closed */ } },
      stats() { return { rtt: st.bestRtt, offset: st.offset, rollbacks: core.rollbacks, resteps: core.resteps, tick: core.tick, desync: core.desync || null }; },
      get started() { return st.started; }, get ended() { return st.ended; }
    };
  }

  // a bout with no wire: Spar, or an offline phone with the house's knights in every other seat
  function local(o) {
    const S = spec(), dt = o.tick || S.tick;
    const core = new Lockstep({ fight: o.fight, duel: o.duel, local: o.seat | 0, seats: [], tick: dt, inputDelay: o.inputDelay === undefined ? 0 : o.inputDelay, checksumEvery: 0 });
    let acc = 0, ended = false;
    return {
      core,
      frame(realDt, localInput) {
        if (ended) return { events: [], waiting: false, tick: core.tick, started: true, ended: true };
        acc += Math.min(0.25, Math.max(0, realDt || 0));
        const target = core.tick + Math.floor(acc / dt + 1e-9); acc -= (target - core.tick) * dt; if (acc < 0) acc = 0;
        const r = core.frame(target, localInput); r.started = true; return r;
      },
      result() { ended = true; }, close() { ended = true; }, stats() { return { rtt: 0, offset: 0, rollbacks: 0, resteps: 0, tick: core.tick, desync: null }; },
      get started() { return true; }, get ended() { return ended; }
    };
  }

  const Wire = { available, queue, session, local, Lockstep, pack, packSum, unpack, toBytes, fromBytes, norm, keyOf, NEUTRAL, BTN, spec };
  if (typeof module !== "undefined" && module.exports) module.exports = Wire; else root.Wire = Wire;
})(typeof window !== "undefined" ? window : globalThis);
