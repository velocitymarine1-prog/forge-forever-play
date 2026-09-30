// FORGE FOREVER: nav.js (design pass 9 section 3.6, built by card t69): which page is right behind this one, and one rule for going to
// another page.
// The main menu, the Forge and the Battlegrounds link to each other. Going to the page that is right behind this one goes back in the
// history, so the browser restores it as it was left; any other page is pushed, with a note in the URL's hash (#from=forge) that tells
// the new page which page is behind it. The page keeps that note in its own history entry (history.state.ffFrom) and takes it out of
// the address, so a reload, or the page restored from the back-forward cache, still knows. Plain script, defines window.Nav.
(function (root) {
  "use strict";
  const PAGES = ["menu", "forge", "cellar"];
  let me = null, from = null, went = null;
  // arrive(name): on load. Returns the page right behind this one ("menu", "forge", "cellar") or null
  function arrive(name) {
    me = name;
    const st = root.history.state && typeof root.history.state === "object" ? root.history.state : {};
    const m = /(?:^#|&)from=(menu|forge|cellar)(?=&|$)/.exec(root.location.hash);
    if (m) {
      from = m[1];
      const rest = root.location.hash.replace(/(^#|&)from=[a-z]+/, "$1").replace(/^#&/, "#").replace(/^#$/, "");
      try { root.history.replaceState(Object.assign({}, st, { ffFrom: from }), "", root.location.pathname + root.location.search + rest); } catch (e) { /* a sandboxed frame keeps its address */ }
    } else from = PAGES.includes(st.ffFrom) ? st.ffFrom : null;
    return from;
  }
  // go(to, url, o): back when `to` is right behind this page, else push `url` with the note. o.stay (the harness) records and stays.
  function go(to, url, o) {
    o = o || {};
    const back = from === to && root.history.length > 1;
    went = { to, url, how: back ? "back" : "push" };
    if (o.stay) return went;
    const push = () => { root.location.href = url + (url.indexOf("#") >= 0 ? "&" : "#") + "from=" + me; };
    if (!back) { push(); return went; }
    // back did nothing within 600 ms (no such entry): go there anyway. pagehide clears the timer, so a page the browser keeps in its
    // back-forward cache never wakes up to navigate again
    const t = root.setTimeout(push, 600);
    root.addEventListener("pagehide", () => root.clearTimeout(t), { once: true });
    root.history.back();
    return went;
  }
  root.Nav = { arrive, go, PAGES, get from() { return from; }, get me() { return me; }, get went() { return went; } };
})(typeof window !== "undefined" ? window : globalThis);