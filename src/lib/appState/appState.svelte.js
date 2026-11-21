import { saved, autosave } from "./persist.svelte.js";
import { layers, ui } from "./state.svelte.js";
import { setView, fillView, progressView, horizontalView, setZoom, centreOn } from "./viewport.svelte.js";
import { SPAN_CENTRES } from "../spanCentres.js";
import { track } from "../track.js";
import {
  defaults,
  basemapFor,
  sfmsfAerialDefaults,
  fullAerialDefaults,
  FULL_VB,
  DRAW_VB,
  SFMSF_AERIAL_VB,
  PROGRESS_DEFAULTS,
  LAYERS,
} from "../layerSwitches.js";

// the state and the view code live in their own files; everything is still imported from here
export * from "./state.svelte.js";
export * from "./viewport.svelte.js";

/**
 * What Drawing mode (SFMSF drawing) puts back when it is switched off: it shrinks the canvas to the first-photo frame and
 * fills the stage with it, switches the aerial photo off and puts the SFMSF labels and every other layer on. When the page
 * opens in Drawing mode, switching it off goes to the Full view (the normal view with SFMSF zoom ended, as when Drawing mode
 * is entered from it).
 * @returns {Record<string, boolean>|null}
 */
const startSnap = () => (defaults.sfmsfDrawing ? { ...fullAerialDefaults } : null);

/**
 * The switches as they were before Drawing mode, so switching it off puts them back (on a reload, the ones saved from
 * before Drawing mode). null when Drawing mode is off.
 * @type {Record<string, boolean>|null}
 */
let drawingSnap = saved ? (saved.drawingSnap ?? null) : startSnap();

/**
 * Drawing mode's switches: everything on but the aerial photo and the other views.
 * @returns {Record<string, boolean>}
 */
const drawingSwitches = () => ({
  ...Object.fromEntries(Object.keys(layers).map((k) => [k, true])),
  aerial: false,
  purpleSpans: false,
  progress: false,
  sfmsfAerial: false,
  horizontal: false,
  vertical: false,
  sfmsfDrawing: true,
});
/**
 * Switches Drawing mode on, remembering the switches as they were.
 * @returns {void}
 */
function enterDrawing() {
  drawingSnap = $state.snapshot(layers);
  Object.assign(layers, drawingSwitches());
  setView(DRAW_VB);
  fillView();
}
/**
 * Switches Drawing mode off, putting the remembered switches back.
 * @returns {void}
 */
function exitDrawing() {
  if (drawingSnap) Object.assign(layers, drawingSnap);
  layers.sfmsfDrawing = false;
  drawingSnap = null;
  setView(FULL_VB);
}
/** The keys of the Reference group's switches. */
const REFERENCE = LAYERS.find(([g]) => g === "Reference")[1].map(([k]) => k);

/**
 * SFMSF aerial's Reference switches when it is arrived at from a view other than SFMSF drawing: all on, but the greenbelt
 * (never shown with the aerial photo).
 * @returns {Record<string, boolean>}
 */
const sfmsfAerialReference = () => ({
  ...Object.fromEntries(REFERENCE.map((k) => [k, true])),
  greenbelt: false,
});
/**
 * Ends SFMSF zoom, which has the same canvas as Drawing mode; nothing else changes except that Roads goes on with it and
 * off again when it ends.
 * @returns {void}
 */
function exitSfmsfAerial() {
  layers.sfmsfAerial = false;
  setView(FULL_VB);
  layers.roads = false;
}
/** The keys of the View group: radio-style switches, one on at a time. */
const VIEWS = ["progress", "sfmsfAerial", "horizontal", "vertical", "sfmsfDrawing"];

/**
 * A layer checkbox was ticked or unticked. Picking a view sets up that view's switches, canvas and card.
 * @param {string} k The switch's key.
 * @param {boolean} on Whether it is now on.
 * @returns {void}
 */
export function setSwitch(k, on) {
  layers[k] = on;
  ui.changed = !VIEWS.includes(k);
  // turning the gantry off puts back the switches the animation changed, as they were before it started
  if (k === "gantry" && !on && beforeAnimation) {
    Object.assign(layers, beforeAnimation.switches);
    ui.changed = beforeAnimation.changed || beforeAnimation.gantry;
    beforeAnimation = null;
  }
  // a view sets its own switches, so there is nothing to put back after it
  if (on && VIEWS.includes(k)) beforeAnimation = null;
  if (on && VIEWS.includes(k)) {
    ui.view = k;
    ui.span = null;
    ui.animateFrom = null;
    // every view starts on its own basemap (basemapFor); each aerial view's dropdown can change it
    ui.basemap = basemapFor(k);
    // the progress card opens every time Progress is picked, even if it was closed before; no other view opens it
    ui.cardHidden = k !== "progress";
  }
  // picking any other view leaves Horizontal and Vertical
  if (on && (k === "sfmsfDrawing" || k === "progress" || k === "sfmsfAerial")) {
    layers.horizontal = false;
    layers.vertical = false;
  }
  if ((k === "horizontal" || k === "vertical") && on) {
    if (layers.sfmsfDrawing) exitDrawing();
    if (layers.sfmsfAerial) exitSfmsfAerial();
    drawingSnap = null;
    Object.assign(layers, fullAerialDefaults, {
      [k]: true,
      progress: false,
    });
    horizontalView(k === "vertical");
  } else if (k === "sfmsfDrawing") {
    if (on && layers.sfmsfAerial) {
      // from SFMSF aerial only the aerial photo gives way to the greenbelt; every other switch stays as it is
      drawingSnap = $state.snapshot(layers);
      Object.assign(layers, {
        sfmsfAerial: false,
        aerial: false,
        greenbelt: true,
      });
      setView(DRAW_VB);
      fillView();
    } else if (on) enterDrawing();
    else exitDrawing();
  } else if (k === "progress" && on) {
    if (layers.sfmsfDrawing) exitDrawing();
    if (layers.sfmsfAerial) exitSfmsfAerial();
    layers.progress = true;
    Object.assign(layers, PROGRESS_DEFAULTS);
    progressView();
  } else if (k === "sfmsfAerial") {
    if (on && layers.sfmsfDrawing) {
      // from SFMSF drawing only the greenbelt gives way to the aerial photo; every other switch stays as it is
      drawingSnap = null;
      Object.assign(layers, {
        sfmsfDrawing: false,
        aerial: true,
        greenbelt: false,
      });
      setView(SFMSF_AERIAL_VB);
      fillView();
    } else if (on) {
      // leaving Progress puts back the switches it starts with as Full image has them (Full image, Horizontal and SFMSF drawing
      // set their own)
      if (layers.progress) Object.keys(PROGRESS_DEFAULTS).forEach((key) => (layers[key] = fullAerialDefaults[key]));
      layers.sfmsfAerial = true;
      layers.progress = false;
      setView(SFMSF_AERIAL_VB);
      fillView();
      layers.spanNumbers = true;
      // every Reference switch on, with the aerial photo (it is an aerial view) instead of the greenbelt
      Object.assign(layers, sfmsfAerialReference());
    } else {
      setView(FULL_VB);
      layers.roads = false;
    }
  }
}

/**
 * The Basemap switch's dropdown was changed.
 * @param {string} basemap A BASEMAPS key.
 * @returns {void}
 */
export function setBasemap(basemap) {
  ui.basemap = basemap;
  ui.changed = true;
  track("select_basemap", { basemap, view: ui.view });
}

/** The switches animateGantry() sets, besides the gantry itself. */
const ANIMATION_SWITCHES = ["arrows", "spanNumbers", "guideway", "unfinished", "supports"];

/**
 * The switches as they were before the first animation since the view was picked (ANIMATION_SWITCHES, the gantry and
 * whether anything had been changed), for turning the gantry off to put back; null when there's nothing to put back.
 * The animation's Reset button (stopAnimation()), picking a view, the layer panel's Reset and Show all clear it.
 * @type {{ switches: Record<string, boolean>, gantry: boolean, changed: boolean }|null}
 */
let beforeAnimation = null;

/**
 * Whether the gantry animation can play: in every view but the two SFMSF ones, which have no animation.
 * @returns {boolean}
 */
export const canAnimate = () => !(layers.sfmsfDrawing || layers.sfmsfAerial);

/**
 * Starts the gantry animation (MapView plays it while ui.gantryPlaying is set), except in the SFMSF views (canAnimate): the Gantry box is ticked if it's off, the
 * finished spans and supports are shown, the unfinished spans, span numbers and arrows hidden, and the progress card
 * closed so it doesn't cover the gantry (its information button brings it back). Used by the Play pill, the Gantry
 * switch's "animate" link and ?animate=true in the address.
 * @param {string} source What started it, for Google Analytics: "pill", "link" or "address".
 * @returns {void}
 */
export function animateGantry(source) {
  if (ui.gantryPlaying || !canAnimate()) return;
  track("animation", { action: "play", view: ui.view, source });
  beforeAnimation ??= {
    switches: Object.fromEntries(ANIMATION_SWITCHES.map((k) => [k, layers[k]])),
    gantry: layers.gantry,
    changed: ui.changed,
  };
  if (!layers.gantry) setSwitch("gantry", true);
  setSwitch("arrows", false);
  setSwitch("spanNumbers", false);
  setSwitch("guideway", true);
  setSwitch("unfinished", false);
  setSwitch("supports", true);
  ui.cardHidden = true;
  ui.gantryPlaying = true;
}

/**
 * Resets the gantry animation to the gantry's current status (the Reset button): MapView stops the moves, puts the
 * drawing back as status.yaml has it, with the supports above the spans again, and frames the gantry on its span; the
 * layer switches the animation changed go back to how they were before it (the Gantry box stays ticked), and
 * ?animate=true (with any ?span=N it started on) leaves the address. The Play pill starts it again.
 * @param {string} source Which control, for Google Analytics: "button" (beside the card) or "link" (in the panel).
 * @returns {void}
 */
export function stopAnimation(source) {
  if (!ui.gantryPlaying) return;
  track("animation", { action: "reset", view: ui.view, source });
  if (beforeAnimation) {
    Object.assign(layers, beforeAnimation.switches);
    ui.changed = beforeAnimation.changed || !beforeAnimation.gantry;
    beforeAnimation = null;
  }
  ui.gantryPlaying = false;
  ui.gantryPaused = false;
  ui.animateFrom = null;
  ui.gantryStops++;
}

/**
 * Holds the gantry animation where it is (the Pause button), without putting the drawing back: MapView pauses the moves,
 * and Play (resumeAnimation()) plays them on from there.
 * @returns {void}
 */
export function pauseAnimation() {
  if (!ui.gantryPlaying) return;
  ui.gantryPaused = true;
  track("animation", { action: "pause", view: ui.view, source: "button" });
}

/**
 * Plays a paused gantry animation on from where it was held (the Play button).
 * @returns {void}
 */
export function resumeAnimation() {
  ui.gantryPaused = false;
  track("animation", { action: "resume", view: ui.view, source: "button" });
}

/** The zoom a span link opens at, as the number the zoom readout shows (a multiple of Fit). */
const SPAN_ZOOM = 20;

/**
 * Opens a span link (?span=N): Progress with the gantry on and the card closed, zoomed to SPAN_ZOOM times Fit and centred on the
 * span.
 * @param {number} n The span number, 1 to 105.
 * @returns {void}
 */
export function showSpan(n) {
  const c = SPAN_CENTRES[n];
  if (!c) return;
  setSwitch("progress", true);
  layers.gantry = true;
  ui.changed = true;
  ui.cardHidden = true;
  setZoom(ui.fit * SPAN_ZOOM);
  centreOn(c[0], c[1]);
  ui.span = n;
}

/**
 * Show all: every switch on except the greenbelt, creeks, roads and the views.
 * @returns {void}
 */
export function showAll() {
  track("layers_action", { action: "show_all", view: ui.view });
  beforeAnimation = null;
  Object.keys(layers).forEach((k) => {
    if (
      k !== "greenbelt" &&
      k !== "creeks" &&
      k !== "roads" &&
      k !== "progress" &&
      k !== "sfmsfDrawing" &&
      k !== "sfmsfAerial" &&
      k !== "horizontal" &&
      k !== "vertical"
    )
      layers[k] = true;
  });
  layers.greenbelt = false;
  ui.changed = true;
}

/**
 * The switches each view starts with, as picking it from the panel sets them up.
 * @param {string} view A View group key.
 * @returns {Record<string, boolean>}
 */
function viewSwitches(view) {
  if (view === "progress") return defaults;
  if (view === "horizontal" || view === "vertical") return { ...fullAerialDefaults, [view]: true, progress: false };
  if (view === "sfmsfDrawing") return drawingSwitches();
  return { ...sfmsfAerialDefaults, ...sfmsfAerialReference() }; // SFMSF aerial
}

/**
 * Reset: the current view's switches back as it starts with them, staying on the same view, zoom and position.
 * @returns {void}
 */
export function reset() {
  track("layers_action", { action: "reset", view: ui.view });
  beforeAnimation = null;
  Object.assign(layers, viewSwitches(ui.view));
  ui.basemap = basemapFor(ui.view);
  ui.changed = false;
}

// Save the panel's settings whenever one changes
autosave(() => ({
  layers: $state.snapshot(layers),
  basemap: ui.basemap,
  view: ui.view,
  changed: ui.changed,
  layersOpen: ui.layersOpen,
  drawingSnap,
}));
