import { flushSync } from "svelte";
import { drawingBounds, turnedXRange, turnedPolygonsLeft } from "./drawingBounds.js";
import { ui, els } from "./state.svelte.js";
import {
  HORIZONTAL_MARGIN,
  HORIZONTAL_WEST_TRIM,
  HORIZONTAL_VIEW_METRES,
  UNITS_PER_METRE,
  FULL_VB,
  PROGRESS_VIEW_WIDTH,
  PROGRESS_SPAN_AT,
  PROGRESS_MIN_LAST_SPAN,
} from "../layerSwitches.js";

let fitBounds = null;

/**
 * The zoom that fits the view's Fit area in the stage, independently of its panning canvas.
 * @returns {number} A percentage of the stage width.
 */
export function fitZoom() {
  const r = els.stage.getBoundingClientRect(),
    vb = els.svg.viewBox.baseVal,
    bounds = fitBounds ?? vb;
  return Math.min((100 * vb.width) / bounds.width, (100 * r.height * vb.width) / (r.width * bounds.height));
}
/**
 * Whether the map is zoomed to Fit.
 * @returns {boolean}
 */
export const isFit = () => Math.abs(ui.zoom - ui.fit) < 0.5;
/**
 * The zoom that fills the stage with the view's Fit area, so nothing blank shows.
 * @returns {number} A percentage of the stage width.
 */
export function fillZoom() {
  const r = els.stage.getBoundingClientRect(),
    vb = els.svg.viewBox.baseVal,
    bounds = fitBounds ?? vb;
  return Math.max((100 * vb.width) / bounds.width, (100 * r.height * vb.width) / (r.width * bounds.height));
}
/**
 * Fills the stage with the canvas and centres it. Views open this way; `ui.filled` keeps them so when the stage changes
 * size (until the map is zoomed).
 * @returns {void}
 */
export function fillView() {
  setZoom(fillZoom());
  centreView();
  ui.filled = true;
}

// The whole drawing turns about the middle of the full canvas: the full canvas's top left and size, and the middle
const [fx0, fy0, fw, fh] = FULL_VB.split(" ").map(Number),
  TURN_X = fx0 + fw / 2,
  TURN_Y = fy0 + fh / 2;

/**
 * Shows the canvas area `vb`, with the drawing turned by `turn` degrees.
 * @param {string} vb The area to show, as an SVG viewBox string.
 * @param {number} [turn=0] Degrees to turn the drawing by (0, upright, for every view but Horizontal).
 * @param {string|null} [fitVb=null] A separate Fit area, or the whole canvas when omitted.
 * @returns {void}
 */
export function setView(vb, turn = 0, fitVb = null) {
  const wasFit = isFit();
  if (fitVb) {
    const [x, y, width, height] = fitVb.split(" ").map(Number);
    fitBounds = { x, y, width, height };
  } else fitBounds = null;
  els.svg.style.margin = "";
  if (els.turn) {
    if (turn) els.turn.setAttribute("transform", `rotate(${turn} ${TURN_X} ${TURN_Y})`);
    else els.turn.removeAttribute("transform");
  }
  els.svg.setAttribute("viewBox", vb);
  ui.fit = fitZoom();
  // a different canvas shape needs a different fit
  if (wasFit) setZoom(ui.fit);
  els.stage.scrollLeft = 0;
  els.stage.scrollTop = 0;
}

/**
 * Shows progress-chart mode with the full aerial for panning and the built route for Fit (see canvasProgress). It starts zoomed so
 * PROGRESS_VIEW_WIDTH fills the stage's width and scrolled so the gantry's span sits at PROGRESS_SPAN_AT across and down
 * the stage; from there it zooms and pans like any other view, and Fit shows everything built.
 * @returns {void}
 */
export function progressView() {
  canvasProgress();
  const c = els.gantrySpanCentre;
  if (!c) return;
  const vb = els.svg.viewBox.baseVal;
  // never less than filling the stage, so nothing blank shows
  setZoom(Math.max((100 * vb.width) / PROGRESS_VIEW_WIDTH, fillZoom()));
  const stage = els.stage,
    r = els.svg.getBoundingClientRect();
  stage.scrollLeft = ((c.x - vb.x) / vb.width) * r.width - stage.clientWidth * PROGRESS_SPAN_AT.x;
  stage.scrollTop = ((c.y - vb.y) / vb.height) * r.height - stage.clientHeight * PROGRESS_SPAN_AT.y;
}

/** What progress-chart mode's canvas is fitted to: the finished spans the gantry has reached, and the gantry. */
const BUILT = ".guideway.cc.reached:not(.unfinished), .gantry";

/**
 * Sets progress-chart mode's Fit area: the Clayton Clipper's finished spans the gantry has reached, and the gantry (not
 * the unfinished spans ahead of it, which run almost the whole width of the aerial), upright, with a margin on every side
 * of HORIZONTAL_MARGIN times their diagonal, but no wider than the overview aerial; the whole canvas when there is
 * nothing to measure. Span PROGRESS_MIN_LAST_SPAN, built or not, is always taken in whole, even past the aerial's edge; it is a floor, so the canvas still grows past it with the built spans.
 * @returns {void}
 */
function canvasProgress() {
  // the layer rules for Progress's switches have to be on the page before measuring what shows
  flushSync();
  els.turn.removeAttribute("transform");
  const e = drawingBounds(els.svg, 0, TURN_X, TURN_Y, BUILT);
  if (!e) return setView(FULL_VB);
  const m = HORIZONTAL_MARGIN * Math.hypot(e.right.x - e.left.x, e.bottom.y - e.top.y);
  let x = e.left.x - m,
    x1 = e.right.x + m,
    y = e.top.y - m,
    y1 = e.bottom.y + m;
  // a station label that reaches into that canvas is taken in whole, with a little room, so it isn't cut off (one that is
  // nowhere near stays out of the picture, rather than stretching the canvas along the whole route)
  for (const id of ["#station-label-hillcrest", "#station-label-bakerview"]) {
    const l = drawingBounds(els.svg, 0, TURN_X, TURN_Y, id);
    if (!l || l.right.x < x || l.left.x > x1 || l.bottom.y < y || l.top.y > y1) continue;
    const pad = 0.25 * m;
    x = Math.min(x, l.left.x - pad);
    x1 = Math.max(x1, l.right.x + pad);
    y = Math.min(y, l.top.y - pad);
    y1 = Math.max(y1, l.bottom.y + pad);
  }
  const photo = els.svg.querySelector("#baseoverview image");
  if (photo) {
    const p = turnedXRange(els.svg, photo, 0, TURN_X, TURN_Y);
    x = Math.max(x, p.x0);
    x1 = Math.min(x1, p.x1);
  }
  // the last span, whole and with a little room, whatever the other rules left out (the aerial's edge included)
  // (it is an unfinished span, which Progress hides, so it is shown while it is measured)
  const lastPieces = [...els.svg.querySelectorAll(`.guideway.cc[data-span="${PROGRESS_MIN_LAST_SPAN}"]`)];
  const styles = lastPieces.map((el) => el.style.cssText);
  lastPieces.forEach((el) => {
    el.style.setProperty("display", "inline", "important");
    el.style.setProperty("visibility", "visible", "important");
  });
  const last = drawingBounds(els.svg, 0, TURN_X, TURN_Y, `.guideway.cc[data-span="${PROGRESS_MIN_LAST_SPAN}"]`);
  lastPieces.forEach((el, i) => (el.style.cssText = styles[i]));
  if (last) {
    const pad = 0.25 * m;
    x = Math.min(x, last.left.x - pad);
    x1 = Math.max(x1, last.right.x + pad);
    y = Math.min(y, last.top.y - pad);
    y1 = Math.max(y1, last.bottom.y + pad);
  }
  setView(FULL_VB, 0, `${x} ${y} ${x1 - x} ${y1 - y}`);
}

/**
 * Shows the Horizontal view: the drawing turned so both ends of the Clayton Clipper route are level. Its canvas is what is
 * drawn with a margin on every side of HORIZONTAL_MARGIN times the distance between its two ends; it starts zoomed to
 * HORIZONTAL_VIEW_METRES before and after the gantry's span, with the span in the middle.
 * @returns {void}
 */
export function horizontalView() {
  canvasHorizontal();
  const c = els.gantrySpanCentre;
  if (!c) return;
  const vb = els.svg.viewBox.baseVal;
  setZoom(Math.max((100 * vb.width) / (2 * HORIZONTAL_VIEW_METRES * UNITS_PER_METRE), fillZoom()));
  // the span's middle, turned with the drawing, then onto the middle of the stage
  const r = (els.routeAngle * Math.PI) / 180,
    x = TURN_X + (c.x - TURN_X) * Math.cos(r) - (c.y - TURN_Y) * Math.sin(r),
    y = TURN_Y + (c.x - TURN_X) * Math.sin(r) + (c.y - TURN_Y) * Math.cos(r);
  const stage = els.stage,
    box = els.svg.getBoundingClientRect();
  stage.scrollLeft = ((x - vb.x) / vb.width) * box.width - stage.clientWidth / 2;
  stage.scrollTop = ((y - vb.y) / vb.height) * box.height - stage.clientHeight / 2;
}
/**
 * Fits the canvas to Horizontal: what is drawn with a margin, but no wider than the overview aerial; on the west, the
 * guideway's end runs just off it (HORIZONTAL_WEST_TRIM).
 * @returns {void}
 */
function canvasHorizontal() {
  // the layer rules for the new switches have to be on the page before measuring what shows
  flushSync();
  els.turn.removeAttribute("transform");
  const e = drawingBounds(els.svg, els.routeAngle, TURN_X, TURN_Y);
  if (!e) return turnedFullView();
  const m = HORIZONTAL_MARGIN * Math.hypot(e.right.x - e.left.x, e.right.y - e.left.y);
  // the margin is on the east only: the west end of the guideway (not a support or label past it) runs just off the canvas
  let x =
      (turnedPolygonsLeft(els.svg, "polygon.guideway", els.routeAngle, TURN_X, TURN_Y) ?? e.left.x) +
      HORIZONTAL_WEST_TRIM,
    x1 = e.right.x + m;
  // no margin past the ends of the overview aerial, the widest photo
  const photo = els.svg.querySelector("#baseoverview image");
  if (photo) {
    const p = turnedXRange(els.svg, photo, els.routeAngle, TURN_X, TURN_Y);
    x = Math.max(x, p.x0);
    x1 = Math.min(x1, p.x1);
  }
  const y = e.top.y - m;
  setView(`${x} ${y} ${x1 - x} ${e.bottom.y + m - y}`, els.routeAngle);
  setZoom(fitZoom());
}
/**
 * Shows the whole canvas, turned level, all of it in view (when there is nothing drawn to measure).
 * @returns {void}
 */
function turnedFullView() {
  const r = (els.routeAngle * Math.PI) / 180,
    c = Math.cos(r),
    s = Math.sin(r);
  const pts = [
    [fx0, fy0],
    [fx0 + fw, fy0],
    [fx0 + fw, fy0 + fh],
    [fx0, fy0 + fh],
  ].map(([x, y]) => [TURN_X + (x - TURN_X) * c - (y - TURN_Y) * s, TURN_Y + (x - TURN_X) * s + (y - TURN_Y) * c]);
  const xs = pts.map((p) => p[0]),
    ys = pts.map((p) => p[1]),
    x = Math.min(...xs),
    y = Math.min(...ys);
  setView(`${x} ${y} ${Math.max(...xs) - x} ${Math.max(...ys) - y}`, els.routeAngle);
  setZoom(fitZoom());
}

/**
 * Centres the view's Fit area without changing zoom; at Fit, preserves its top-aligned framing.
 * @returns {void}
 */
export function centreView() {
  const stage = els.stage;
  if (fitBounds) {
    const vb = els.svg.viewBox.baseVal;
    const box = els.svg.getBoundingClientRect();
    const frame = stage.getBoundingClientRect();
    stage.scrollLeft +=
      box.left -
      frame.left +
      ((fitBounds.x + fitBounds.width / 2 - vb.x) / vb.width) * box.width -
      stage.clientWidth / 2;
    stage.scrollTop +=
      box.top -
      frame.top +
      ((fitBounds.y + (isFit() ? 0 : fitBounds.height / 2) - vb.y) / vb.height) * box.height -
      (isFit() ? 0 : stage.clientHeight / 2);
    return;
  }
  stage.scrollLeft = (stage.scrollWidth - stage.clientWidth) / 2;
  stage.scrollTop = (stage.scrollHeight - stage.clientHeight) / 2;
}

/**
 * Scrolls the map so the canvas point (x, y) is in the middle of the stage, without changing zoom.
 * @param {number} x The canvas x (viewBox units).
 * @param {number} y The canvas y (viewBox units).
 * @returns {void}
 */
export function centreOn(x, y) {
  const stage = els.stage;
  const vb = els.svg.viewBox.baseVal;
  const box = els.svg.getBoundingClientRect();
  const frame = stage.getBoundingClientRect();
  stage.scrollLeft += box.left - frame.left + ((x - vb.x) / vb.width) * box.width - stage.clientWidth / 2;
  stage.scrollTop += box.top - frame.top + ((y - vb.y) / vb.height) * box.height - stage.clientHeight / 2;
}

/**
 * Zooms the map, keeping the point (cx, cy) where it is on the screen. Never less than Fit, never more than 16000%.
 * @param {number} p The zoom, a percentage of the stage width.
 * @param {number} [cx] The screen x to zoom about; the middle of the stage by default.
 * @param {number} [cy] The screen y to zoom about; the middle of the stage by default.
 * @returns {void}
 */
export function setZoom(p, cx, cy) {
  const stage = els.stage;
  ui.filled = false;
  ui.fit = fitZoom();
  p = Math.max(ui.fit, Math.min(16000, p));
  const r = stage.getBoundingClientRect();
  const x = (cx == null ? r.left + r.width / 2 : cx) - r.left,
    y = (cy == null ? r.top + r.height / 2 : cy) - r.top;
  const previousBox = fitBounds ? els.svg.getBoundingClientRect() : null;
  const fx = previousBox
      ? (r.left + x - previousBox.left) / previousBox.width
      : (stage.scrollLeft + x) / stage.scrollWidth,
    fy = previousBox ? (r.top + y - previousBox.top) / previousBox.height : (stage.scrollTop + y) / stage.scrollHeight;
  ui.zoom = p;
  els.svg.style.width = p + "%";
  if (fitBounds) {
    const vb = els.svg.viewBox.baseVal;
    const box = els.svg.getBoundingClientRect();
    const scale = box.width / vb.width;
    const left = (fitBounds.x - vb.x) * scale - Math.max(0, (stage.clientWidth - fitBounds.width * scale) / 2);
    const top = (fitBounds.y - vb.y) * scale;
    els.svg.style.marginLeft = Math.max(0, -left) + "px";
    els.svg.style.marginRight = Math.max(0, left + stage.clientWidth - box.width) + "px";
    els.svg.style.marginTop = Math.max(0, -top) + "px";
    els.svg.style.marginBottom = Math.max(0, top + stage.clientHeight - box.height) + "px";
  }
  if (fitBounds) {
    const box = els.svg.getBoundingClientRect();
    stage.scrollLeft += box.left - r.left + fx * box.width - x;
    stage.scrollTop += box.top - r.top + fy * box.height - y;
  } else {
    stage.scrollLeft = fx * stage.scrollWidth - x;
    stage.scrollTop = fy * stage.scrollHeight - y;
  }
  if (fitBounds && isFit()) centreView();
}
