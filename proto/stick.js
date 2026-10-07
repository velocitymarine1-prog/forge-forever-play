// FORGE FOREVER: stick.js, the floating stick (design pass 7's, in battlegrounds.js until design pass 24, build 17, moved it here so
// the Training Cellar, the levels and the Courtyard walk under one thumb). The stick floats to where the thumb lands in its zone:
// the ring is put there, the knob follows the thumb to the ring's edge, and the wish is the thumb's offset from the landing point,
// 0 inside the dead zone and 1 at the ring's edge. Everything is measured in the page's own space, so a root turned a quarter by
// "My screen won't turn" steers the same: the page gives toGame.
//
//   const stick = Stick.mount({
//     zone,                       the element that takes the thumb (the left 45 % in the cellar, the left half in the courtyard)
//     stick, knob,                the ring (class "rest" while no thumb is on it) and the knob inside it
//     toGame(clientX, clientY),   → [x, y] in the page's own space (turned back when the root is turned)
//     origin(),                   → [left, top] of the ring's offset parent in that space (the HUD's inner corner)
//     paused(),                   → true while the stick takes no thumb (a plank is open, the page is hidden)
//     onTap(x, y, e)              optional: a touch that ended within TAP_MS and TAP_PX of where it began (the courtyard's tap to go)
//   });
//   stick.x, stick.y              the wish, each from -1 to 1 (both 0 in the dead zone and with no thumb)
//   stick.held                    a thumb is on it
//   stick.up()                    let go (the page lost the focus, a plank opened)
//   stick.hold(cx, cy, dx, dy)    for the harnesses: a thumb landed at client (cx, cy) and pushed (dx, dy); returns [x, y]
//   Stick.tap(el, { toGame, paused, onTap })   the same short, still touch on an element with no stick (the rest of the courtyard)
//
// Plain script, defines window.Stick. The numbers are the cellar's: a ring of 44 px, a dead zone of 12 %.
(function (root) {
  "use strict";
  const R = 44, DEAD = 0.12, TAP_MS = 250, TAP_PX = 10;
  const now = () => (root.performance && root.performance.now ? root.performance.now() : Date.now());

  function mount(o) {
    const zone = o.zone, ring = o.stick, knob = o.knob;
    const S = { at: null, x: 0, y: 0 };
    // the thumb is at (gx, gy): the wish, and the knob to the ring's edge
    function to(gx, gy) {
      const dx = gx - S.at.cx, dy = gy - S.at.cy, d = Math.hypot(dx, dy), m = Math.min(1, d / R);
      if (m < DEAD) { S.x = 0; S.y = 0; } else { S.x = dx / d * m; S.y = dy / d * m; }
      S.at.far = Math.max(S.at.far || 0, d);
      const kx = d > R ? dx / d * R : dx, ky = d > R ? dy / d * R : dy;
      if (knob) knob.style.transform = "translate(" + kx.toFixed(1) + "px," + ky.toFixed(1) + "px)";
    }
    function land(gx, gy, id) {
      S.at = { id, cx: gx, cy: gy, t0: now(), far: 0 };
      const O = o.origin ? o.origin() : [0, 0];
      if (ring) { ring.classList.remove("rest"); ring.style.left = (gx - O[0]) + "px"; ring.style.top = (gy - O[1]) + "px"; }
      to(gx, gy);
    }
    function up(e) {
      if (!S.at || (e && e.pointerId !== undefined && S.at.id !== e.pointerId)) return;
      const was = S.at;
      S.at = null; S.x = 0; S.y = 0;
      if (ring) { ring.classList.add("rest"); ring.style.left = ""; ring.style.top = ""; }
      if (knob) knob.style.transform = "";
      // a short, still touch is a tap (only a real lift: not a cancel, not a call from the page)
      if (e && e.type === "pointerup" && typeof o.onTap === "function" && now() - was.t0 < TAP_MS && was.far < TAP_PX) o.onTap(was.cx, was.cy, e);
    }
    zone.addEventListener("pointerdown", e => {
      if (S.at || (o.paused && o.paused())) return;
      e.preventDefault();
      const [gx, gy] = o.toGame(e.clientX, e.clientY);
      try { zone.setPointerCapture(e.pointerId); } catch (err) { /* a synthetic pointer */ }
      land(gx, gy, e.pointerId);
    });
    zone.addEventListener("pointermove", e => { if (!S.at || S.at.id !== e.pointerId) return; const [gx, gy] = o.toGame(e.clientX, e.clientY); to(gx, gy); });
    for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) zone.addEventListener(ev, up);
    return {
      get x() { return S.x; }, get y() { return S.y; }, get held() { return !!S.at; },
      up() { up(null); },
      hold(cx, cy, dx, dy) { const [gx, gy] = o.toGame(cx, cy), [hx, hy] = o.toGame(cx + dx, cy + dy); land(gx, gy, -1); to(hx, hy); return [S.x, S.y]; }
    };
  }

  // a short, still touch on an element that has no stick: onTap(x, y, e) in the page's own space
  function tap(el, o) {
    let at = null;
    el.addEventListener("pointerdown", e => { if (o.paused && o.paused()) { at = null; return; } const [gx, gy] = o.toGame(e.clientX, e.clientY); at = { id: e.pointerId, x: gx, y: gy, t0: now() }; });
    el.addEventListener("pointerup", e => {
      if (!at || at.id !== e.pointerId) return;
      const was = at; at = null;
      const [gx, gy] = o.toGame(e.clientX, e.clientY);
      if (now() - was.t0 < TAP_MS && Math.hypot(gx - was.x, gy - was.y) < TAP_PX) o.onTap(was.x, was.y, e);
    });
    el.addEventListener("pointercancel", () => { at = null; });
  }

  root.Stick = { mount, tap, R, DEAD, TAP_MS, TAP_PX, version: 1 };
})(typeof window !== "undefined" ? window : globalThis);
