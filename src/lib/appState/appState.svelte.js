import { saved, autosave } from "./persist.svelte.js";
import { layers, ui } from "./state.svelte.js";
import {
  setView,
  fillView,
  progressView,
  horizontalView,
} from "./viewport.svelte.js";
import {
  defaults,
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

// "Full" stays ticked exactly while every switch matches the old default view
function refresh() {
  layers.fullAerial = Object.keys(fullAerialDefaults).every(
    (k) => k === "fullAerial" || layers[k] === fullAerialDefaults[k],
  );
}

// Drawing mode (SFMSF drawing): shrink the canvas to the first-photo frame and fill the stage with it, switch the aerial photo off, put the SFMSF labels and every other
// layer on, and put everything back as it was when the mode is switched off.
// opening in Drawing mode, so switching it off goes to the Full view (the normal view with SFMSF zoom ended, as when Drawing
// mode is entered from it)
const startSnap = () =>
  defaults.sfmsfDrawing ? { ...fullAerialDefaults } : null;
// (on a reload, the switches saved from before Drawing mode, so switching it off still puts them back)
let drawingSnap = saved ? (saved.drawingSnap ?? null) : startSnap();
// Drawing mode's switches: everything on but the aerial photo and the other views
const drawingSwitches = () => ({
  ...Object.fromEntries(Object.keys(layers).map((k) => [k, true])),
  aerial: false,
  progress: false,
  sfmsfAerial: false,
  horizontal: false,
  sfmsfDrawing: true,
});
function enterDrawing() {
  drawingSnap = $state.snapshot(layers);
  Object.assign(layers, drawingSwitches());
  setView(DRAW_VB);
  fillView();
}
function exitDrawing() {
  if (drawingSnap) Object.assign(layers, drawingSnap);
  layers.sfmsfDrawing = false;
  drawingSnap = null;
  setView(FULL_VB);
}
// SFMSF aerial's Reference switches when it is arrived at from a view other than SFMSF drawing: all on, but the greenbelt
// (never shown with the aerial photo)
const REFERENCE = LAYERS.find(([g]) => g === "Reference")[1].map(([k]) => k);
const sfmsfAerialReference = () => ({
  ...Object.fromEntries(REFERENCE.map((k) => [k, true])),
  greenbelt: false,
});
// SFMSF zoom: same canvas as Drawing mode, nothing else changes except that Roads goes on with it and off again when it ends
function exitSfmsfAerial() {
  layers.sfmsfAerial = false;
  setView(FULL_VB);
  layers.roads = false;
}
// Full image: the whole canvas, filling the stage, with the Full image switches
function applyFullAerial() {
  drawingSnap = null;
  setView(FULL_VB);
  fillView();
  Object.assign(layers, fullAerialDefaults);
}

const VIEWS = [
  "progress",
  "sfmsfAerial",
  "fullAerial",
  "horizontal",
  "sfmsfDrawing",
];

// A layer checkbox was ticked or unticked
export function setSwitch(k, on) {
  layers[k] = on;
  ui.changed = !VIEWS.includes(k);
  if (on && VIEWS.includes(k)) ui.view = k;
  // picking any other view leaves Horizontal (Full image does so through fullAerialDefaults)
  if (on && (k === "sfmsfDrawing" || k === "progress" || k === "sfmsfAerial"))
    layers.horizontal = false;
  if (k === "fullAerial") {
    applyFullAerial();
  } else if (k === "horizontal" && on) {
    if (layers.sfmsfDrawing) exitDrawing();
    if (layers.sfmsfAerial) exitSfmsfAerial();
    drawingSnap = null;
    Object.assign(layers, fullAerialDefaults, {
      horizontal: true,
      progress: false,
    });
    horizontalView();
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
    // the progress card opens every time Progress is picked, even if it was closed before
    ui.cardHidden = false;
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
      if (layers.progress)
        Object.keys(PROGRESS_DEFAULTS).forEach(
          (key) => (layers[key] = fullAerialDefaults[key]),
        );
      layers.sfmsfAerial = true;
      layers.progress = false;
      setView(SFMSF_AERIAL_VB);
      fillView();
      layers.spanLabels = true;
      // every Reference switch on, with the aerial photo (it is an aerial view) instead of the greenbelt
      Object.assign(layers, sfmsfAerialReference());
    } else {
      setView(FULL_VB);
      layers.roads = false;
    }
  }
  refresh();
}

export function showAll() {
  Object.keys(layers).forEach((k) => {
    if (
      k !== "greenbelt" &&
      k !== "creeks" &&
      k !== "roads" &&
      k !== "progress" &&
      k !== "sfmsfDrawing" &&
      k !== "sfmsfAerial" &&
      k !== "horizontal"
    )
      layers[k] = true;
  });
  layers.greenbelt = false;
  ui.changed = true;
  refresh();
}

// The switches each view starts with, as picking it from the panel sets them up
function viewSwitches(view) {
  if (view === "progress") return defaults;
  if (view === "fullAerial") return fullAerialDefaults;
  if (view === "horizontal")
    return { ...fullAerialDefaults, horizontal: true, progress: false };
  if (view === "sfmsfDrawing") return drawingSwitches();
  return { ...sfmsfAerialDefaults, ...sfmsfAerialReference() }; // SFMSF aerial
}

// Reset: the current view's switches back as it starts with them, staying on the same view, zoom and position
export function reset() {
  Object.assign(layers, viewSwitches(ui.view));
  ui.changed = false;
  refresh();
}

// Save the panel's settings whenever one changes
autosave(() => ({
  layers: $state.snapshot(layers),
  view: ui.view,
  changed: ui.changed,
  layersOpen: ui.layersOpen,
  drawingSnap,
}));
