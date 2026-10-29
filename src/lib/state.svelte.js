import {
  defaults,
  fullDefaults,
  FULL_VB,
  DRAW_VB,
  ZOOM_VB,
} from "./layers.js";

// Layer switches, keyed as in LAYERS
export const layers = $state({ ...defaults });
// zoom is a percentage of the stage width; ready turns on the layer rules once plan.svg is tagged
export const ui = $state({ zoom: 187.31, collapsed: false, ready: false });
// The stage and the <svg>, set by Plan.svelte when it mounts
export const els = { stage: null, svg: null };
export const PCTS = [100, 150, 200, 300];

// "Full" stays ticked exactly while every switch matches the old default view
function refresh() {
  layers.view_default = Object.keys(fullDefaults).every(
    (k) => k === "view_default" || layers[k] === fullDefaults[k],
  );
}

export function setView(vb) {
  els.svg.setAttribute("viewBox", vb);
  els.stage.scrollLeft = 0;
  els.stage.scrollTop = 0;
}

export function setZoom(p, cx, cy) {
  const stage = els.stage;
  p = Math.max(100, Math.min(16000, p));
  const r = stage.getBoundingClientRect();
  const x = (cx == null ? r.left + r.width / 2 : cx) - r.left,
    y = (cy == null ? r.top + r.height / 2 : cy) - r.top;
  const fx = (stage.scrollLeft + x) / stage.scrollWidth,
    fy = (stage.scrollTop + y) / stage.scrollHeight;
  ui.zoom = p;
  els.svg.style.width = p + "%";
  stage.scrollLeft = fx * stage.scrollWidth - x;
  stage.scrollTop = fy * stage.scrollHeight - y;
}

// Drawing mode: shrink the canvas to the first-photo frame, switch the aerial photo off, put the SFMSF labels and every other
// layer on, and put everything back as it was when the mode is switched off.
// opening in Drawing mode, so switching it off goes to the Full view (the normal view with SFMSF zoom ended, as when Drawing
// mode is entered from it)
const startSnap = () => (defaults.drawing ? { ...fullDefaults } : null);
let drawingSnap = startSnap();
function enterDrawing() {
  drawingSnap = $state.snapshot(layers);
  Object.keys(layers).forEach((k) => {
    layers[k] = true;
  });
  layers.aerial = false;
  layers.cclabels = false;
  layers.beams = false;
  layers.progress = false;
  layers.sfzoom = false;
  layers.drawing = true;
  setView(DRAW_VB);
}
function exitDrawing() {
  if (drawingSnap) Object.assign(layers, drawingSnap);
  layers.drawing = false;
  drawingSnap = null;
  setView(FULL_VB);
}
// SFMSF zoom: same canvas as Drawing mode, nothing else changes except that Roads goes on with it and off again when it ends
function exitZoom() {
  layers.sfzoom = false;
  setView(FULL_VB);
  layers.roads = false;
  layers.labels = false;
}
function applyFull() {
  drawingSnap = null;
  setView(FULL_VB);
  Object.assign(layers, fullDefaults);
}

// A layer checkbox was ticked or unticked
export function toggle(k, checked) {
  layers[k] = checked;
  if (k === "greenbelt" && checked) layers.aerial = false;
  if (k === "aerial" && checked) layers.greenbelt = false;
  if (k === "gantry" && checked) layers.beams = false;
  if (k === "beams" && checked) layers.gantry = false;
  if (k === "labels" && checked) layers.cclabels = false;
  if (k === "cclabels" && checked) layers.labels = false;
  if (k === "view_default") {
    applyFull();
  } else if (k === "drawing") {
    if (checked) {
      if (layers.sfzoom) exitZoom();
      enterDrawing();
    } else exitDrawing();
  } else if (k === "progress" && checked) {
    if (layers.drawing) exitDrawing();
    if (layers.sfzoom) exitZoom();
    layers.progress = true;
  } else if (k === "sfzoom") {
    if (checked) {
      if (layers.drawing) exitDrawing();
      layers.sfzoom = true;
      layers.progress = false;
      setView(ZOOM_VB);
      layers.roads = true;
      layers.labels = true;
      layers.cclabels = false;
    } else {
      setView(FULL_VB);
      layers.roads = false;
      layers.labels = false;
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
      k !== "drawing" &&
      k !== "sfzoom"
    )
      layers[k] = true;
  });
  layers.greenbelt = false;
  layers.cclabels = false;
  refresh();
}

export function reset() {
  drawingSnap = startSnap();
  setView(defaults.drawing ? DRAW_VB : defaults.sfzoom ? ZOOM_VB : FULL_VB);
  Object.assign(layers, defaults);
  refresh();
}
