import { ui, layers, setSwitch, showSpan, animateGantry } from "./appState.svelte.js";
import { track } from "../track.js";
import { encodeMark } from "../animationMark.js";

/** Whether the address's hash shows where the animation is (encodeMark()): off for now, on to find a caption's moment. */
const MARK_IN_HASH = false;

/**
 * Bookmarkable views: each view but Progress has its own address (?view=aerial), so a link or bookmark opens on that view;
 * Progress (the opening view) leaves the address clean. The address the page opened with keeps its other parameters
 * (?animate=true) until another view or span is picked; from then on it is only the view or span.
 * @type {Record<string, string>} The view's key and its ?view= value.
 */
const VIEW_PARAMS = {
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
 * Whether the address says ?animate=true: from when an animation starts (the Play pill, or the address itself)
 * until another view or span is picked, the gantry is turned off or the Reset button pressed (each stops it). A run that
 * finishes leaves it on.
 */
let animateInAddress = false,
  wasPlaying = false,
  lastPlace = null,
  stopsWere = 0;

/**
 * Switches to the view or span the address the page was opened with names, then, with ?animate=true (on its own, for
 * Progress, or alongside ?view=), starts the gantry animation in it. Alongside ?animate=true, ?span=N is the span the
 * animation starts on (ui.animateFrom), in the view ?view= names (Progress without one), rather than a span link. Called
 * by MapView once the map is ready; an unknown view is left alone.
 * @returns {void}
 */
export function applyAddress() {
  const params = new URLSearchParams(opened.search),
    // an animation address's hash (how long it had played and the step, animationMark.js) isn't an old view link
    old = opened.hash.replace(/^#/, "").replace(/^[A-Za-z0-9_-]{5}$/, "");
  const span = Number(params.get("span")?.match(/^\d{1,3}$/)?.[0] ?? old.match(/^span-(\d{1,3})$/)?.[1]) || null,
    animate = params.get("animate") === "true";
  // with ?animate=true, the span is where the animation starts (ui.animateFrom, set below), in the view the address
  // names; without it, a span link
  if (span && !animate) {
    if (ui.span !== span) showSpan(span);
    track("select_span", { span, source: "address" });
  } else {
    const name = params.get("view") ?? old;
    // the old Full aerial address: Progress, with the gantry on as in Progress, but without Progress purple
    if (name === "aerial") {
      if (ui.view !== "progress") setSwitch("progress", true);
      layers.purpleSpans = false;
      ui.changed = true;
    }
    const v = Object.keys(VIEW_PARAMS).find((k) => VIEW_PARAMS[k] === name) ?? (name ? null : "progress");
    if (v && ui.view !== v) setSwitch(v, true);
    // a view the address names (not a clean address, which is always Progress), for Google Analytics
    if (v && name) track("select_view", { view: v, source: "address" });
  }
  // after the view is picked, which clears it: MapView puts the gantry on this span before the animation starts
  if (span && animate) ui.animateFrom = span;
  openedOn = placeKey();
  // a frame later: switching view stops any animation (MapView), and that has to happen before this one starts, or it
  // would stop it too. The parameter stays in the address until another view or span is picked, so a reload or bookmark
  // starts it again.
  if (animate) requestAnimationFrame(() => animateGantry("address"));
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
    // off or the Reset button pressed (a run stopped that way is still finishing, so `playing` can't be used for that)
    if (playing && !wasPlaying) animateInAddress = true;
    // (the Reset button leaves an animation that started on a span in the address: Reset goes back to that span)
    if ((lastPlace !== null && place !== lastPlace) || !layers.gantry || (stopsNow !== stopsWere && !ui.animateFrom))
      animateInAddress = false;
    stopsWere = stopsNow;
    wasPlaying = playing;
    lastPlace = place;
    // always in this order: the view (or span link), then the span an animation started on, then ?animate, then any
    // others the opening address had
    const params = new URLSearchParams();
    if (ui.span) params.set("span", ui.span);
    else if (VIEW_PARAMS[ui.view]) params.set("view", VIEW_PARAMS[ui.view]);
    if (animateInAddress && ui.animateFrom) params.set("span", ui.animateFrom);
    if (animateInAddress) params.set("animate", "true");
    if (keepOthers)
      new URLSearchParams(location.search).forEach((value, key) => {
        if (!["view", "span", "animate"].includes(key)) params.append(key, value);
      });
    const search = params.size ? `?${params}` : "",
      // while ?animate=true is in it, how long the animation has played (ui.animationTime, every 250 ms) and the step under
      // way, packed into five base64url characters with no key (animationMark.js)
      hash = MARK_IN_HASH && animateInAddress && ui.animationTime != null ? `#${encodeMark(ui.animationTime)}` : "";
    if (location.search !== search || location.hash !== hash)
      history.replaceState(null, "", location.pathname + search + hash);
  });
});
