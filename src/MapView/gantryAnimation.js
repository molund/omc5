// Clayton Clipper gantry animations, played by the Play pill (through ui.gantryPlaying and MapView).
//
// Every move uses the Web Animations API: el.animate(keyframes, options) slides an element from the first keyframe to the
// last, and returns an Animation whose `finished` promise lets the next step wait its turn (`await`). `fill: "forwards"`
// keeps each piece where its last move left it.

import { placeGantry } from "../lib/placeGantry.js";
import { gantryProgress } from "./gantryProgress.js";
import { SPEEDS, setSpeed, stops, stop, waits, holdGantry, resumeGantry } from "./gantryAnimation/clock.js";
import { fills, clearHangers } from "./gantryAnimation/fill.js";
import { startWalk } from "./gantryAnimation/walkStart.js";
import { playNormalMove } from "./gantryAnimation/normalMove.js";
import { hasWalk, walkPartWay } from "./gantryAnimation/walk.js";

export { holdGantry, resumeGantry };

/**
 * Whether the map zooms onto the gantry when the animation starts and pans to keep it on the screen while it plays (MapView
 * does both; it pans only when the gantry nears the edge it is heading for). false leaves the map where it is, for
 * watching one part of a move up close.
 */
export const FOLLOW_GANTRY = true;

/**
 * A whole gantry move, from the span the gantry is on to the next one: a walk over the double girder spans (see startWalk
 * and walk.js) from span 41 or 50, or from a span part way through one; the normal move (see playNormalMove) everywhere
 * else.
 * @param {SVGSVGElement} svg The map's <svg>, after placeGantry() has put the gantry on its span.
 * @returns {Promise<boolean>} Whether it moved the gantry on.
 */
export function playGantry(svg) {
  const gantry = svg.querySelector("#clayton-clipper"),
    span = +gantry?.dataset.span;
  // a walk that has just handed over half way (gantry.dataset.halfway) is followed by the rest of the normal move
  return hasWalk(span) && gantry.dataset.halfway !== "true" ? startWalk(svg) : playNormalMove(svg);
}

/** The pose under way (poseGantry()), for Play to wait for. */
let posing = Promise.resolve();
/** How many poses have been asked for: a pose still waiting its turn gives way to a newer one (poseGantry()). */
let poses = 0;

/**
 * On a span part way through a walk (42 to 47), sets the gantry where the walk has it at that point instead of where
 * placeGantry() draws it: the walk's steps up to there, with no time (walkPartWay() in walk.js). Nothing happens on other
 * spans, or while the gantry is hidden (a hidden gantry has no size to measure).
 * @param {SVGSVGElement} svg The map's <svg>, after placeGantry() has put the gantry on its span.
 * @returns {Promise<void>}
 */
export function poseGantry(svg) {
  const gantry = svg?.querySelector("#clayton-clipper");
  if (!gantry || !gantry.getBoundingClientRect().width || !walkPartWay(+gantry.dataset.span)) return posing;
  // the stop, the view and the new span (+1, −1) can each ask within a frame: only the last one waiting is played
  const ask = ++poses;
  posing = posing.then(() => ask === poses && startWalk(svg, { pose: true })).catch(() => {});
  return posing;
}

/**
 * Plays gantry moves one after another, span by span, until the gantry is on span `last` or can't go any further.
 * @param {SVGSVGElement} svg The map's <svg>.
 * @param {number} [last] The span to stop on.
 * @returns {Promise<void>}
 */
export async function playToEnd(svg, last = 106) {
  const gantry = svg.querySelector("#clayton-clipper");
  if (!gantry) return;
  // a pose still being set (poseGantry) finishes first
  await posing;
  // the drawing as it is before the first move, for stopGantry() to put back: the span the gantry is on, and the classes
  // gantryProgress() changes as the gantry moves on (on the guideway pieces, arrows and span numbers)
  before ??= {
    span: gantry.dataset.span,
    classes: [...svg.querySelectorAll(PROGRESS_MARKED)].map((el) => [el, el.getAttribute("class")]),
  };
  const at = stops;
  let moved = 0;
  setSpeed(0);
  try {
    while (+gantry.dataset.span < last && (await playGantry(svg))) setSpeed(Math.min(++moved, SPEEDS.length - 1));
  } catch (error) {
    // a stop makes the move under way give up (see pause() and stopGantry()); anything else is a real error
    if (at === stops) throw error;
  }
}

/** What gantryProgress() marks as the gantry moves on: the guideway pieces, their arrows and the span numbers. */
const PROGRESS_MARKED = "polygon.guideway, .arrow-pending, text.guideway, text.ccnumber";

/** The classes on PROGRESS_MARKED as map.svg itself draws them, before status.yaml's span is marked: saved by keepDrawn(). */
let drawn = null;

/**
 * Saves the classes map.svg itself has on what gantryProgress() marks, for startFrom() to go back to. MapView calls it
 * once, before the first gantryProgress().
 * @param {SVGSVGElement} svg The map's <svg>.
 * @returns {void}
 */
export function keepDrawn(svg) {
  drawn = [...svg.querySelectorAll(PROGRESS_MARKED)].map((el) => [el, el.getAttribute("class")]);
}

/**
 * The matrix from an element's own coordinates to the <svg>'s, from the transform attributes alone (so it works on a hidden
 * layer, where nothing can be measured through the screen).
 */
function toSvg(el, svg) {
  let m = new DOMMatrix();
  for (let e = el; e && e !== svg; e = e.parentElement) {
    const t = e.transform?.baseVal?.consolidate()?.matrix;
    if (t) m = new DOMMatrix([t.a, t.b, t.c, t.d, t.e, t.f]).multiply(m);
  }
  return m;
}

/** Whether point q is inside the polygon pts (ray casting). */
const inside = (q, pts) =>
  pts.reduce((acc, a, i) => {
    const b = pts[(i + 1) % pts.length];
    return a.y > q.y !== b.y > q.y && q.x < ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y) + a.x ? !acc : acc;
  }, false);

/**
 * map.svg draws the Clayton Clipper's gantry boxes as built (gi) up to the span it had reached when it was drawn; an animation
 * that starts on an earlier span (startFrom()) draws the ones from span `n` on unbuilt again (p, unfinished), with the
 * direction arrows on them waiting for their box (arrow-pending, tagged with the span), as map.svg draws the spans ahead.
 * gantryProgress() then marks the ones behind span n built, as the animation goes on.
 * @param {SVGSVGElement} svg The map's <svg>, after gantryProgress() has numbered the pieces (data-span).
 * @param {number} n The span the animation starts on.
 * @returns {void}
 */
function unbuild(svg, n) {
  const boxes = [...svg.querySelectorAll("polygon.gi.guideway.cc")]
    .filter((el) => +el.dataset.span >= n)
    .map((el) => {
      const m = toSvg(el, svg);
      el.classList.remove("gi");
      el.classList.add("p", "unfinished");
      return { el, pts: [...el.points].map((q) => new DOMPoint(q.x, q.y).matrixTransform(m)) };
    });
  svg.querySelectorAll("text.guideway.cc:not(.arrow-pending)").forEach((el) => {
    // the arrow's visual centre, half its font size above the baseline (map.svg's arrows: baseline - 6.25)
    const q = new DOMPoint(+el.getAttribute("x"), +el.getAttribute("y") - 6.25).matrixTransform(toSvg(el, svg)),
      box = boxes.find((b) => inside(q, b.pts));
    if (!box) return;
    el.classList.add("arrow-pending");
    el.dataset.span = box.el.dataset.span;
  });
}

/**
 * An animation that starts on a span (startFrom()) draws every precast concrete girder and ramp span as finished: there is no
 * record of when each went in, and the animation may be showing the past. Their direction arrows show too: the ones waiting
 * for them (arrow-pending) and the exit ramp arrows map.svg draws grey while the ramps are unfinished.
 * @param {SVGSVGElement} svg The map's <svg>.
 * @returns {[Element, string][]} The pieces and arrows whose style changed, with their style before, for stopGantry() to
 * put back.
 */
function finishPrecast(svg) {
  const styles = [];
  const pieces = [...svg.querySelectorAll("polygon.guideway.unfinished:not(.p)")].map((el) => {
    el.classList.remove("unfinished");
    // map.svg draws an unfinished one white with a thin grey edge: it takes a finished one's colours (as map.svg has them)
    styles.push([el, el.getAttribute("style") ?? ""]);
    el.setAttribute("style", "fill: #888780; stroke: #5F5E5A; stroke-width: 1.5");
    const m = toSvg(el, svg);
    return [...el.points].map((q) => new DOMPoint(q.x, q.y).matrixTransform(m));
  });
  svg.querySelectorAll("text.guideway").forEach((el) => {
    const q = new DOMPoint(+el.getAttribute("x"), +el.getAttribute("y") - 6.25).matrixTransform(toSvg(el, svg));
    if (!pieces.some((pts) => inside(q, pts))) return;
    el.classList.remove("arrow-pending");
    const style = el.getAttribute("style") ?? "";
    if (/fill:\s*#767676/i.test(style)) {
      styles.push([el, style]);
      el.setAttribute("style", style.replace(/fill:\s*#767676/i, "fill: #eeeeee"));
    }
  });
  return styles;
}

/**
 * Puts the gantry on span `n` for an animation that starts there (?span=N with ?animate=true) instead of on status.yaml's
 * span: the drawing goes back to how map.svg draws it, the gantry is put on span n with its segments not yet hung
 * (gantryProgress() with complete = false, so the spans behind it are drawn hung and the first move fills n in), and, on a
 * span part way through a walk, posed where the walk has it. The drawing as status.yaml has it is saved first, so
 * stopGantry() (the Reset button) puts that back. Nothing happens for a span outside 1 to 105.
 * @param {SVGSVGElement} svg The map's <svg>, with the gantry showing (a hidden gantry has no size to pose).
 * @param {number} n The span to start on.
 * @param {{ pose?: boolean }} [options] pose: false when the animation plays from there at once (Play, +1, −1): the walk
 * sets itself up from its start anyway, so posing first would only keep the gantry out of sight for longer.
 * @returns {Promise<void>}
 */
export async function startFrom(svg, n, { pose = true } = {}) {
  const gantry = svg.querySelector("#clayton-clipper");
  if (!gantry || !drawn || !(n >= 1 && n <= 105)) return;
  // a pose still being set (poseGantry) finishes first, then goes, with anything else left on the gantry
  await posing;
  before ??= {
    span: gantry.dataset.span,
    classes: [...svg.querySelectorAll(PROGRESS_MARKED)].map((el) => [el, el.getAttribute("class")]),
  };
  gantry.getAnimations({ subtree: true }).forEach((a) => a.cancel());
  drawn.forEach(([el, c]) => (c == null ? el.removeAttribute("class") : el.setAttribute("class", c)));
  unbuild(svg, n);
  // on a replay the arrows are already restyled: the styles kept are the first time's, as map.svg has them
  const styles = finishPrecast(svg);
  before.styles ??= styles;
  gantry.dataset.span = n;
  delete gantry.dataset.halfway;
  gantryProgress(svg, false);
  placeGantry(svg);
  if (pose) await poseGantry(svg);
}

/** The drawing before the Play pill's first move, saved by playToEnd(); null when nothing has moved. */
let before = null;

/**
 * Stops the gantry's moves and puts the drawing back as it was before the first one, as status.yaml has it: every
 * animation on the gantry is cancelled (each piece goes back to where placeGantry put it, and the move under way gives up
 * at its next step), the classes gantryProgress() changed are put back, and the gantry is placed on its span again.
 * @param {SVGSVGElement} svg The map's <svg>.
 */
export function stopGantry(svg) {
  const gantry = svg?.querySelector("#clayton-clipper");
  if (!gantry) return;
  stop();
  // a held gantry lets go first, and the waits give up straight away rather than waiting out what they had left
  resumeGantry();
  waits.forEach((w) => w.up());
  fills.forEach((end) => end());
  clearHangers();
  gantry.getAnimations({ subtree: true }).forEach((a) => a.cancel());
  if (before) {
    before.classes.forEach(([el, c]) => (c == null ? el.removeAttribute("class") : el.setAttribute("class", c)));
    before.styles?.forEach(([el, c]) => el.setAttribute("style", c));
    gantry.dataset.span = before.span;
    before = null;
  }
  delete gantry.dataset.halfway;
  placeGantry(svg);
  // on a span part way through a walk, back where the walk has it (a frame later, once a view or layer change shows)
  requestAnimationFrame(() => poseGantry(svg));
}

/** The supports, as the Supports switch shows and hides them. */
const SUPPORTS = 'rect.g, circle[fill="#D7D7D7"]';
/** What counts as a span when the supports are moved below them. */
const SPANS = "polygon.guideway";

/** Whether lowerSupports() has moved the supports yet. */
let lowered = false;

/**
 * Moves the supports below the spans, as they stand under the guideway (map.svg draws them above). Each support (or the
 * group it is in, up to the group that also holds spans) goes just before the first spans that came ahead of it in the
 * same group, without going past an aerial photo, so it stays above the photos and the roads. The geometry doesn't
 * change: only the order the pieces are drawn in. Done once; later calls do nothing.
 * @param {SVGSVGElement} svg The map's <svg>.
 * @returns {void}
 */
export function lowerSupports(svg) {
  if (lowered) return;
  lowered = true;
  const units = new Set();
  svg.querySelectorAll(SUPPORTS).forEach((el) => {
    let unit = el;
    while (unit.parentNode !== svg && !unit.parentNode.querySelector(SPANS)) unit = unit.parentNode;
    if (unit.parentNode !== svg) units.add(unit);
  });
  for (const unit of units) {
    let below = null;
    for (let s = unit.previousElementSibling; s; s = s.previousElementSibling) {
      if (s.matches("image") || s.querySelector("image")) break;
      if (s.matches(SPANS) || s.querySelector(SPANS)) below = s;
    }
    if (!below) continue;
    below.before(unit);
  }
}
