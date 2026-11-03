import { ui, setSwitch, showSpan } from "./appState.svelte.js";

/**
 * Bookmarkable views: each view but Progress has its own address hash, so a link or bookmark opens on that view; Progress
 * (the opening view) leaves the address clean.
 * @type {Record<string, string>} The view's key and its hash, without the "#".
 */
const HASHES = {
  fullAerial: "aerial",
  horizontal: "horizontal",
  sfmsfAerial: "omc",
  sfmsfDrawing: "omc-drawing",
};
/**
 * The view an address hash names.
 * @param {string} h The hash, with or without the "#".
 * @returns {string|null} The view's key ("progress" for no hash), or null for a hash that names no view.
 */
const viewOfHash = (h) =>
  Object.keys(HASHES).find((k) => HASHES[k] === h.replace(/^#/, "")) ?? (h.replace(/^#/, "") ? null : "progress");
/**
 * The span an address hash names (#span-36).
 * @param {string} h The hash, with or without the "#".
 * @returns {number|null} The span number, or null for a hash that is not a span link.
 */
const spanOfHash = (h) => {
  const m = /^#?span-(\d{1,3})$/.exec(h);
  return m ? Number(m[1]) : null;
};
/** The hash the page was opened with, read before anything rewrites it. */
const openedWith = typeof location === "undefined" ? "" : location.hash;

/**
 * Switches to the view the address names. Called by MapView once the map is ready, and on back / forward or an edited
 * hash; an unknown hash is left alone.
 * @param {string} [h] The hash to apply; the one the page was opened with by default.
 * @returns {void}
 */
export function applyHash(h = openedWith) {
  const span = spanOfHash(h);
  if (span) {
    if (ui.span !== span) showSpan(span);
    return;
  }
  const v = viewOfHash(h);
  if (v && ui.view !== v) setSwitch(v, true);
}

// Keep the address in step with the view, without adding a history entry for every view picked
$effect.root(() => {
  $effect(() => {
    if (!ui.ready || typeof location === "undefined") return;
    const h = ui.span ? `#span-${ui.span}` : HASHES[ui.view] ? `#${HASHES[ui.view]}` : "";
    if (location.hash !== h) history.replaceState(null, "", h || location.pathname + location.search);
  });
});
