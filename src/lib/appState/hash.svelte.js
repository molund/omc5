import { ui, layers, setSwitch, showSpan, animateGantry } from "./appState.svelte.js";

/**
 * Bookmarkable views: each view but Progress has its own address (?view=aerial), so a link or bookmark opens on that view;
 * Progress (the opening view) leaves the address clean. The address the page opened with keeps its other parameters
 * (?animate=true) until another view or span is picked; from then on it is only the view or span.
 * @type {Record<string, string>} The view's key and its ?view= value.
 */
const VIEW_PARAMS = {
  fullAerial: "aerial",
  horizontal: "horizontal",
  vertical: "vertical",
  sfmsfAerial: "omc",
  sfmsfDrawing: "omc-drawing",
};
/**
 * What the page was opened with, read before anything rewrites it. The old #omc and #span-36 links still work.
 */
const opened =
  typeof location === "undefined" ? { search: "", hash: "" } : { search: location.search, hash: location.hash };

/** The view and span the opening address put the map on (set by applyAddress), as a key: null until then. */
let openedOn = null;
/** Whether the address still keeps the opening address's other parameters: until another view or span is picked. */
let keepOthers = true;
const placeKey = () => `${ui.view}|${ui.span}`;
/**
 * Whether the address says ?animate=true: from when an animation starts (the "animate" link, or the address itself)
 * until another view or span is picked, the gantry is turned off or the Stop button pressed (each stops it). A run that
 * finishes leaves it on.
 */
let animateInAddress = false,
  wasPlaying = false,
  lastPlace = null,
  stopsWere = 0;

/**
 * Switches to the view or span the address the page was opened with names, then, with ?animate=true (on its own, for
 * Progress, or alongside ?view= or ?span=), starts the gantry animation in it. Called by MapView once the map is ready; an
 * unknown view is left alone.
 * @returns {void}
 */
export function applyAddress() {
  const params = new URLSearchParams(opened.search),
    old = opened.hash.replace(/^#/, "");
  const span = Number(params.get("span")?.match(/^\d{1,3}$/)?.[0] ?? old.match(/^span-(\d{1,3})$/)?.[1]) || null;
  if (span) {
    if (ui.span !== span) showSpan(span);
  } else {
    const name = params.get("view") ?? old;
    const v = Object.keys(VIEW_PARAMS).find((k) => VIEW_PARAMS[k] === name) ?? (name ? null : "progress");
    if (v && ui.view !== v) setSwitch(v, true);
  }
  openedOn = placeKey();
  // a frame later: switching view stops any animation (MapView), and that has to happen before this one starts, or it
  // would stop it too. The parameter stays in the address until another view or span is picked, so a reload or bookmark
  // starts it again.
  if (params.get("animate") === "true") requestAnimationFrame(animateGantry);
}

// Keep the address in step with the view, without adding a history entry for every view picked. While the map is on the
// view or span the address opened it on, the address keeps its other parameters; once another is picked, they go (and
// stay gone) and the address is only the view or span.
$effect.root(() => {
  $effect(() => {
    if (!ui.ready || typeof location === "undefined") return;
    const place = placeKey(),
      playing = ui.gantryPlaying,
      stopsNow = ui.gantryStops;
    if (openedOn !== null && place !== openedOn) keepOthers = false;
    // ?animate=true goes on when an animation starts, and off when another view or span is picked, the gantry turned
    // off or the Stop button pressed (a run stopped that way is still finishing, so `playing` can't be used for that)
    if (playing && !wasPlaying) animateInAddress = true;
    if ((lastPlace !== null && place !== lastPlace) || !layers.gantry || stopsNow !== stopsWere)
      animateInAddress = false;
    stopsWere = stopsNow;
    wasPlaying = playing;
    lastPlace = place;
    // always in this order: the view (or span), then ?animate, then any others the opening address had
    const params = new URLSearchParams();
    if (ui.span) params.set("span", ui.span);
    else if (VIEW_PARAMS[ui.view]) params.set("view", VIEW_PARAMS[ui.view]);
    if (animateInAddress) params.set("animate", "true");
    if (keepOthers)
      new URLSearchParams(location.search).forEach((value, key) => {
        if (!["view", "span", "animate"].includes(key)) params.append(key, value);
      });
    const search = params.size ? `?${params}` : "";
    if (location.search !== search || location.hash) history.replaceState(null, "", location.pathname + search);
  });
});
