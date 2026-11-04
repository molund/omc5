import { ui, setSwitch, showSpan } from "./appState.svelte.js";

/**
 * Bookmarkable views: each view but Progress has its own address (?view=aerial), so a link or bookmark opens on that view;
 * Progress (the opening view) leaves the address clean. Other query parameters are left as they are.
 * @type {Record<string, string>} The view's key and its ?view= value.
 */
const VIEW_PARAMS = {
  fullAerial: "aerial",
  horizontal: "horizontal",
  sfmsfAerial: "omc",
  sfmsfDrawing: "omc-drawing",
};
/**
 * What the page was opened with, read before anything rewrites it. The old #omc and #span-36 links still work.
 */
const opened =
  typeof location === "undefined" ? { search: "", hash: "" } : { search: location.search, hash: location.hash };

/**
 * Switches to the view or span the address the page was opened with names. Called by MapView once the map is ready; an
 * unknown view is left alone.
 * @returns {void}
 */
export function applyAddress() {
  const params = new URLSearchParams(opened.search),
    old = opened.hash.replace(/^#/, "");
  const span = Number(params.get("span")?.match(/^\d{1,3}$/)?.[0] ?? old.match(/^span-(\d{1,3})$/)?.[1]) || null;
  if (span) {
    if (ui.span !== span) showSpan(span);
    return;
  }
  const name = params.get("view") ?? old;
  const v = Object.keys(VIEW_PARAMS).find((k) => VIEW_PARAMS[k] === name) ?? (name ? null : "progress");
  if (v && ui.view !== v) setSwitch(v, true);
}

// Keep the address in step with the view, without adding a history entry for every view picked
$effect.root(() => {
  $effect(() => {
    if (!ui.ready || typeof location === "undefined") return;
    const params = new URLSearchParams(location.search);
    params.delete("view");
    params.delete("span");
    if (ui.span) params.set("span", ui.span);
    else if (VIEW_PARAMS[ui.view]) params.set("view", VIEW_PARAMS[ui.view]);
    const search = params.size ? `?${params}` : "";
    if (location.search !== search || location.hash) history.replaceState(null, "", location.pathname + search);
  });
});
