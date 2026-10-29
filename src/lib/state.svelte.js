import { flushSync } from "svelte";
import { visibleExtent } from "./visibleExtent.js";
import {
  HORIZONTAL_MARGIN,
  HORIZONTAL_VIEW_METRES,
  UNITS_PER_METRE,
  defaults,
  normalDefaults,
  fullDefaults,
  FULL_VB,
  DRAW_VB,
  ZOOM_VB,
  PROGRESS_VIEW_WIDTH,
  PROGRESS_SPAN_AT,
  PROGRESS_DEFAULTS,
} from "./layers.js";

// Layer switches, keyed as in LAYERS
export const layers = $state({ ...defaults });
// Screens this narrow are phones: the layer panel is a menu that slides in over the plan
export const PHONE = matchMedia("(max-width: 760px)");
// zoom is a percentage of the stage width, and fit the zoom at which the whole canvas fits the stage; ready turns on the layer
// rules once plan.svg is tagged; gantry is the Clayton Clipper's span number out of the total; phone is PHONE, kept up to
// date by App.svelte; collapsed hides the panel (a phone opens on the plan, with the menu closed); changed is whether a layer
// switch has been changed since the view was picked or reset, which is when Reset has something to do
export const ui = $state({
  // the view last picked (a View group key), which stays put while layers are switched on and off
  view: defaults.progress
    ? "progress"
    : defaults.drawing
      ? "drawing"
      : "sfzoom",
  zoom: 187.31,
  fit: 100,
  phone: PHONE.matches,
  collapsed: PHONE.matches,
  changed: false,
  ready: false,
  gantry: null,
});
// The stage and the <svg>, set by Plan.svelte when it mounts, with the middle of the span the gantry is on (canvas units), the
// group that turns the whole drawing (#plan-turn) and the turn that levels the Clayton Clipper route (degrees)
export const els = {
  stage: null,
  svg: null,
  gantrySpan: null,
  turn: null,
  routeAngle: 0,
};

// "Full" stays ticked exactly while every switch matches the old default view
function refresh() {
  layers.view_default = Object.keys(fullDefaults).every(
    (k) => k === "view_default" || layers[k] === fullDefaults[k],
  );
}

// The zoom that fits the whole canvas in the stage: the full width, or less when the canvas is taller than the stage allows
export function fitZoom() {
  const r = els.stage.getBoundingClientRect(),
    vb = els.svg.viewBox.baseVal;
  return Math.min(100, (100 * r.height * vb.width) / (r.width * vb.height));
}
export const isFit = () => Math.abs(ui.zoom - ui.fit) < 0.5;

// The whole drawing turns about the middle of the full canvas
const [fx0, fy0, fw, fh] = FULL_VB.split(" ").map(Number),
  TURN_X = fx0 + fw / 2,
  TURN_Y = fy0 + fh / 2;

// Show the canvas area vb, with the drawing turned by `turn` degrees (0, upright, for every view but Horizontal)
export function setView(vb, turn = 0) {
  const wasFit = isFit();
  if (els.turn) {
    if (turn)
      els.turn.setAttribute("transform", `rotate(${turn} ${TURN_X} ${TURN_Y})`);
    else els.turn.removeAttribute("transform");
  }
  els.svg.setAttribute("viewBox", vb);
  ui.fit = fitZoom();
  // a different canvas shape needs a different fit
  if (wasFit) setZoom(ui.fit);
  els.stage.scrollLeft = 0;
  els.stage.scrollTop = 0;
}

// Progress-chart mode starts on the whole canvas, zoomed so PROGRESS_VIEW_WIDTH fills the stage's width and scrolled so the
// gantry's span sits at PROGRESS_SPAN_AT across and down the stage; from there it zooms and pans like any other view
export function progressView() {
  setView(FULL_VB);
  const c = els.gantrySpan;
  if (!c) return;
  const vb = els.svg.viewBox.baseVal;
  setZoom((100 * vb.width) / PROGRESS_VIEW_WIDTH);
  const stage = els.stage,
    r = els.svg.getBoundingClientRect();
  stage.scrollLeft =
    ((c.x - vb.x) / vb.width) * r.width -
    stage.clientWidth * PROGRESS_SPAN_AT.x;
  stage.scrollTop =
    ((c.y - vb.y) / vb.height) * r.height -
    stage.clientHeight * PROGRESS_SPAN_AT.y;
}

// Horizontal: the drawing turned so both ends of the Clayton Clipper route are level. Its canvas is what is drawn with a margin
// on every side of HORIZONTAL_MARGIN times the distance between its two ends; it starts zoomed to HORIZONTAL_VIEW_METRES
// before and after the gantry's span, with the span in the middle
function horizontalView() {
  canvasHorizontal();
  const c = els.gantrySpan;
  if (!c) return;
  const vb = els.svg.viewBox.baseVal;
  setZoom((100 * vb.width) / (2 * HORIZONTAL_VIEW_METRES * UNITS_PER_METRE));
  // the span's middle, turned with the drawing, then onto the middle of the stage
  const r = (els.routeAngle * Math.PI) / 180,
    x = TURN_X + (c.x - TURN_X) * Math.cos(r) - (c.y - TURN_Y) * Math.sin(r),
    y = TURN_Y + (c.x - TURN_X) * Math.sin(r) + (c.y - TURN_Y) * Math.cos(r);
  const stage = els.stage,
    box = els.svg.getBoundingClientRect();
  stage.scrollLeft =
    ((x - vb.x) / vb.width) * box.width - stage.clientWidth / 2;
  stage.scrollTop =
    ((y - vb.y) / vb.height) * box.height - stage.clientHeight / 2;
}
// Horizontal's canvas, fitted
function canvasHorizontal() {
  // the layer rules for the new switches have to be on the page before measuring what shows
  flushSync();
  els.turn.removeAttribute("transform");
  const e = visibleExtent(els.svg, els.routeAngle, TURN_X, TURN_Y);
  if (!e) return turnedFullView();
  const m =
      HORIZONTAL_MARGIN *
      Math.hypot(e.right.x - e.left.x, e.right.y - e.left.y),
    x = e.left.x - m,
    y = e.top.y - m;
  setView(
    `${x} ${y} ${e.right.x + m - x} ${e.bottom.y + m - y}`,
    els.routeAngle,
  );
  setZoom(fitZoom());
}
// the whole canvas, turned level, all of it in view (when there is nothing drawn to measure)
function turnedFullView() {
  const r = (els.routeAngle * Math.PI) / 180,
    c = Math.cos(r),
    s = Math.sin(r);
  const pts = [
    [fx0, fy0],
    [fx0 + fw, fy0],
    [fx0 + fw, fy0 + fh],
    [fx0, fy0 + fh],
  ].map(([x, y]) => [
    TURN_X + (x - TURN_X) * c - (y - TURN_Y) * s,
    TURN_Y + (x - TURN_X) * s + (y - TURN_Y) * c,
  ]);
  const xs = pts.map((p) => p[0]),
    ys = pts.map((p) => p[1]),
    x = Math.min(...xs),
    y = Math.min(...ys);
  setView(
    `${x} ${y} ${Math.max(...xs) - x} ${Math.max(...ys) - y}`,
    els.routeAngle,
  );
  setZoom(fitZoom());
}

export function setZoom(p, cx, cy) {
  const stage = els.stage;
  ui.fit = fitZoom();
  p = Math.max(ui.fit, Math.min(16000, p));
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

// Drawing mode (SFMSF drawing): shrink the canvas to the first-photo frame and fit it, switch the aerial photo off, put the SFMSF labels and every other
// layer on, and put everything back as it was when the mode is switched off.
// opening in Drawing mode, so switching it off goes to the Full view (the normal view with SFMSF zoom ended, as when Drawing
// mode is entered from it)
const startSnap = () => (defaults.drawing ? { ...fullDefaults } : null);
let drawingSnap = startSnap();
// Drawing mode's switches: everything on but the aerial photo, the Clayton Clipper span labels, the support beams and the
// other views
const drawingSwitches = () => ({
  ...Object.fromEntries(Object.keys(layers).map((k) => [k, true])),
  aerial: false,
  cclabels: false,
  beams: false,
  progress: false,
  sfzoom: false,
  horizontal: false,
  drawing: true,
});
function enterDrawing() {
  drawingSnap = $state.snapshot(layers);
  Object.assign(layers, drawingSwitches());
  setView(DRAW_VB);
  setZoom(fitZoom());
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
// Full image: the whole canvas, fitted, with the Full image switches
function applyFull() {
  drawingSnap = null;
  setView(FULL_VB);
  setZoom(fitZoom());
  Object.assign(layers, fullDefaults);
}

const VIEWS = ["progress", "sfzoom", "view_default", "horizontal", "drawing"];

// A layer checkbox was ticked or unticked
export function toggle(k, checked) {
  layers[k] = checked;
  ui.changed = !VIEWS.includes(k);
  if (checked && VIEWS.includes(k)) ui.view = k;
  if (k === "greenbelt" && checked) layers.aerial = false;
  if (k === "aerial" && checked) layers.greenbelt = false;
  if (k === "gantry" && checked) layers.beams = false;
  if (k === "beams" && checked) layers.gantry = false;
  if (k === "labels" && checked) layers.cclabels = false;
  if (k === "cclabels" && checked) layers.labels = false;
  // picking any other view leaves Horizontal (Full image does so through fullDefaults)
  if (checked && (k === "drawing" || k === "progress" || k === "sfzoom"))
    layers.horizontal = false;
  if (k === "view_default") {
    applyFull();
  } else if (k === "horizontal" && checked) {
    if (layers.drawing) exitDrawing();
    if (layers.sfzoom) exitZoom();
    drawingSnap = null;
    Object.assign(layers, fullDefaults, {
      horizontal: true,
      progress: false,
    });
    horizontalView();
  } else if (k === "drawing") {
    if (checked) {
      if (layers.sfzoom) exitZoom();
      enterDrawing();
    } else exitDrawing();
  } else if (k === "progress" && checked) {
    if (layers.drawing) exitDrawing();
    if (layers.sfzoom) exitZoom();
    layers.progress = true;
    Object.assign(layers, PROGRESS_DEFAULTS);
    progressView();
  } else if (k === "sfzoom") {
    if (checked) {
      if (layers.drawing) exitDrawing();
      // leaving Progress puts back the switches it starts with as Full image has them (Full image, Horizontal and SFMSF drawing
      // set their own)
      if (layers.progress)
        Object.keys(PROGRESS_DEFAULTS).forEach(
          (key) => (layers[key] = fullDefaults[key]),
        );
      layers.sfzoom = true;
      layers.progress = false;
      setView(ZOOM_VB);
      setZoom(fitZoom());
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
      k !== "sfzoom" &&
      k !== "horizontal"
    )
      layers[k] = true;
  });
  layers.greenbelt = false;
  // the two span-label sets are one or the other: Show all uses the Clayton Clipper's
  layers.labels = false;
  ui.changed = true;
  refresh();
}

// The switches each view starts with, as picking it from the panel sets them up
function viewSwitches(view) {
  if (view === "progress") return defaults;
  if (view === "view_default") return fullDefaults;
  if (view === "horizontal")
    return { ...fullDefaults, horizontal: true, progress: false };
  if (view === "drawing") return drawingSwitches();
  return normalDefaults; // SFMSF aerial
}

// Reset: the current view's switches back as it starts with them, staying on the same view, zoom and position
export function reset() {
  Object.assign(layers, viewSwitches(ui.view));
  ui.changed = false;
  refresh();
}
