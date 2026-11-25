import { hydrate, mount } from "svelte";
import "../src/app.css";
import TracksidePage from "./TracksidePage.svelte";

// which page this is, { page: 2 }, as trackside/prerender.js wrote it; the
// prerendered page is brought to life where there is one, and drawn from scratch otherwise (npm run dev)
const target = document.getElementById("app");
const props = { view: JSON.parse(target.dataset.view || '{"page":1}') };

export default target.firstChild ? hydrate(TracksidePage, { target, props }) : mount(TracksidePage, { target, props });

// once the page has loaded and gone quiet, fetch the map's own script (the drawing is inside it, the biggest file the
// map needs) and its styles into the browser's cache, so a first tap on Map doesn't wait for them; the files the two
// pages share are already cached from this one. The map page is read for their names, which change with every build.
// Nothing is fetched when the reader has asked to save data, and a failed fetch is no matter: the map loads as before
function preloadMap() {
  if (navigator.connection?.saveData) return;
  fetch(import.meta.env.BASE_URL)
    .then((r) => r.text())
    .then((html) => {
      for (const [, url] of html.matchAll(/(?:src|href)="([^"]*\/assets\/main-[^"]+\.(?:js|css))"/g))
        fetch(url).catch(() => {});
    })
    .catch(() => {});
}
// Safari has no requestIdleCallback: there, a couple of seconds after the page has loaded
const whenIdle = window.requestIdleCallback ?? ((f) => setTimeout(f, 2000));
if (document.readyState === "complete") whenIdle(preloadMap);
else addEventListener("load", () => whenIdle(preloadMap), { once: true });
