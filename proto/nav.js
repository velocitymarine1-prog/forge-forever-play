// FORGE FOREVER: nav.js (design pass 9 section 3.6, built by card t69): which page is right behind this one, and one rule for going to
// another page.
// The main menu, the Forge and the Battlegrounds link to each other. Going to the page that is right behind this one goes back in the
// history, so the browser restores it as it was left; any other page is pushed, with a note in the URL's hash (#from=forge) that tells
// the new page which page is behind it. The page keeps that note in its own history entry (history.state.ffFrom) and takes it out of
// the address, so a reload, or the page restored from the back-forward cache, still knows. Plain script, defines window.Nav.
//
// Since design pass 22 (card t76) a level is a page of its own to this rule, never the cellar. The Battlegrounds page is two places (the
// Training Cellar, and a level under ?area=): it arrives as "cellar" or as "level". Nobody goes "to the level" through go() (a level is
// opened by its own buttons), so a page reached from a level holds the note #from=level, that note matches no trip, and the trip is
// pushed. Before this, a level signed itself "cellar": home from the Troll Gate, the Forge's door and Try it in the cellar (and the
// menu's Battlegrounds) went back one entry in the history, onto the level, and the level started over.
//
// Since design pass 41 (card t103) a trip can be fresh: go(to, url, { fresh: true }) pushes even when `to` is the page right behind, for
// a trip whose address carries something the entry behind lacks (the menu with ?intro=1, Settings' The story so far). Before this, that
// trip went back onto the menu's old entry, whose address had no ?intro=1, and the menu showed its tap line instead of the story.
(function (root) {
  "use strict";
  const PAGES = ["menu", "forge", "cellar", "level"];
  const NOTE = new RegExp("(?:^#|&)from=(" + PAGES.join("|") + ")(?=&|$)");   // the note in the address, one of the names above
  let me = null, from = null, went = null;
  // arrive(name): on load. Returns the page right behind this one ("menu", "forge", "cellar", "level") or null
  function arrive(name) {
    me = name;
    const st = root.history.state && typeof root.history.state === "object" ? root.history.state : {};
    const m = NOTE.exec(root.location.hash);
    if (m) {
      from = m[1];
      const rest = root.location.hash.replace(/(^#|&)from=[a-z]+/, "$1").replace(/^#&/, "#").replace(/^#$/, "");
      try { root.history.replaceState(Object.assign({}, st, { ffFrom: from }), "", root.location.pathname + root.location.search + rest); } catch (e) { /* a sandboxed frame keeps its address */ }
    } else from = PAGES.includes(st.ffFrom) ? st.ffFrom : null;
    return from;
  }
  // go(to, url, o): back when `to` is right behind this page, else push `url` with the note. o.stay (the harness) records and stays.
  // o.fresh (design pass 41): push even when `to` is right behind, for a trip whose address carries something the entry behind lacks
  // (the menu with ?intro=1, Settings' The story so far); going back would restore that entry as it was, without it
  function go(to, url, o) {
    o = o || {};
    const back = from === to && root.history.length > 1 && !o.fresh;
    went = { to, url, how: back ? "back" : "push", fresh: !!o.fresh };
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