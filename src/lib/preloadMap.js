// once the page has loaded and gone quiet, fetch the map's own script (the drawing is inside it, the biggest file the
// map needs) and its styles into the browser's cache, so a first tap on Map doesn't wait for them; the files the
// pages share are already cached from this one. The map page is read for their names, which change with every build.
// Nothing is fetched when the reader has asked to save data, and a failed fetch is no matter: the map loads as before
function fetchMap() {
  if (navigator.connection?.saveData) return;
  fetch(import.meta.env.BASE_URL)
    .then((r) => r.text())
    .then((html) => {
      for (const [, url] of html.matchAll(/(?:src|href)="([^"]*\/assets\/main-[^"]+\.(?:js|css))"/g))
        fetch(url).catch(() => {});
    })
    .catch(() => {});
}
// called by the pages with a link to the map (Trackside, About, Privacy and the 404 page); Safari has no
// requestIdleCallback: there, a couple of seconds after the page has loaded
export function preloadMap() {
  const whenIdle = window.requestIdleCallback ?? ((f) => setTimeout(f, 2000));
  if (document.readyState === "complete") whenIdle(fetchMap);
  else addEventListener("load", () => whenIdle(fetchMap), { once: true });
}
