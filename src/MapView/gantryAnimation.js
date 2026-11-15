// Clayton Clipper gantry animations, played by the Play pill (through ui.gantryPlaying and MapView).
//
// Every move uses the Web Animations API: el.animate(keyframes, options) slides an element from the first keyframe to the
// last, and returns an Animation whose `finished` promise lets the next step wait its turn (`await`). `fill: "forwards"`
// keeps each piece where its last move left it.

import { placeGantry } from "../lib/placeGantry.js";
import { SPEEDS, setSpeed, stops, stop, waits, holdGantry, resumeGantry } from "./gantryAnimation/clock.js";
import { fills, clearHangers } from "./gantryAnimation/fill.js";
import { BEFORE_CRAWL, playBeforeCrawl } from "./gantryAnimation/beforeCrawl.js";
import { playNormalMove } from "./gantryAnimation/normalMove.js";

export { holdGantry, resumeGantry };

/**
 * Whether the map zooms onto the gantry when the animation starts and pans to keep it on the screen while it plays (MapView
 * does both; it pans only when the gantry nears the edge it is heading for). false leaves the map where it is, for
 * watching one part of a move up close.
 */
export const FOLLOW_GANTRY = true;

/**
 * A whole gantry move, from the span the gantry is on to the next one: the move before a crawl (see playBeforeCrawl) on
 * the spans that have one, the normal move (see playNormalMove) on the rest.
 * @param {SVGSVGElement} svg The map's <svg>, after placeGantry() has put the gantry on its span.
 * @returns {Promise<boolean>} Whether it moved the gantry on.
 */
export const playGantry = (svg) =>
  BEFORE_CRAWL.has(+svg.querySelector("#clayton-clipper")?.dataset.span) ? playBeforeCrawl(svg) : playNormalMove(svg);

/**
 * Plays gantry moves one after another, span by span, until the gantry is on span `last` or can't go any further.
 * @param {SVGSVGElement} svg The map's <svg>.
 * @param {number} [last] The span to stop on.
 * @returns {Promise<void>}
 */
export async function playToEnd(svg, last = 106) {
  const gantry = svg.querySelector("#clayton-clipper");
  if (!gantry) return;
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
  if (!before) return;
  before.classes.forEach(([el, c]) => (c == null ? el.removeAttribute("class") : el.setAttribute("class", c)));
  gantry.dataset.span = before.span;
  placeGantry(svg);
  before = null;
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
