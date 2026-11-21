// Step 0, the fill: the span the gantry is on fills in like a progress bar, with a hanger on each step, while the trolley
// follows the fill front along the trusses.

import { SPEED, playClock } from "./clock.js";
import { screen, centreIn } from "./measure.js";

/** How long a span takes to fill in when it turns finished, in milliseconds as written (divided by SPEED like every move). */
const FILL_TIME = 6000;
/**
 * How many equal steps a piece fills in by (and so how many hangers it gets): FILL_STEPS for a piece as long as span
 * BASELINE_SPAN's, more or fewer in proportion to its length, to the nearest whole step (at least one). See fillSteps.
 */
const FILL_STEPS = 12;
const BASELINE_SPAN = 39;
/**
 * The length of span BASELINE_SPAN's gantry box (the piece that fills in: p while it's unfinished, gi once it's
 * finished, not the span's ramp pieces), measured once, as axisOf measures a piece.
 */
let baselineLength = null;

/**
 * How many steps a piece of this length fills in by: FILL_STEPS for span BASELINE_SPAN's length, in proportion for
 * others, rounded to a whole number and never less than one.
 * @param {SVGSVGElement} svg The map's <svg>.
 * @param {number} length The piece's length, as axisOf measures it.
 * @returns {number}
 */
function fillSteps(svg, length) {
  baselineLength ??= Math.max(
    0,
    ...[...svg.querySelectorAll(`polygon.guideway.cc[data-span="${BASELINE_SPAN}"]:is(.p, .gi)`)].map(
      (el) => axisOf(svg, el)?.length ?? 0,
    ),
  );
  if (!baselineLength) return FILL_STEPS;
  return Math.max(1, Math.round((FILL_STEPS * length) / baselineLength));
}

/**
 * A guideway piece's length and direction in the map's own frame (#map-turn's, where east is to the right whatever the
 * view's turn): the main axis of its corners (the direction they spread out most along), pointing west.
 * @param {SVGSVGElement} svg The map's <svg>.
 * @param {SVGPolygonElement} el The piece.
 * @returns {{ turn: SVGGraphicsElement, toPiece: DOMMatrix, cx: number, cy: number, u: { x: number, y: number },
 *   v: { x: number, y: number }, from: number, to: number, length: number, across: number }|null} The map's frame, the
 * matrix back to the piece's coordinates, the piece's middle, its direction west (u) and across (v), how far along u
 * its east and west ends are, its length, and how far across it reaches (with 10 to spare); null for a piece with no
 * shape.
 */
function axisOf(svg, el) {
  const turn = svg.querySelector("#map-turn") ?? svg,
    toMap = turn.getCTM().inverse().multiply(el.getCTM());
  const pts = [...el.points].map((p) => new DOMPoint(p.x, p.y).matrixTransform(toMap));
  if (pts.length < 3) return null;
  const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length,
    cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  let xx = 0,
    xy = 0,
    yy = 0;
  pts.forEach((p) => {
    xx += (p.x - cx) ** 2;
    xy += (p.x - cx) * (p.y - cy);
    yy += (p.y - cy) ** 2;
  });
  const angle = Math.atan2(2 * xy, xx - yy) / 2;
  let u = { x: Math.cos(angle), y: Math.sin(angle) };
  if (u.x > 0) u = { x: -u.x, y: -u.y };
  const v = { x: -u.y, y: u.x },
    along = pts.map((p) => (p.x - cx) * u.x + (p.y - cy) * u.y),
    from = Math.min(...along),
    to = Math.max(...along);
  return {
    turn,
    toPiece: toMap.inverse(),
    cx,
    cy,
    u,
    v,
    from,
    to,
    length: to - from,
    across: Math.max(...pts.map((p) => Math.abs((p.x - cx) * v.x + (p.y - cy) * v.y))) + 10,
  };
}
/** The fills under way, each as the function that ends it at once (stopGantry ends them all). */
export const fills = new Set();
let fillCount = 0;
/**
 * The hangers drawn by fills (one group per piece), kept until the trolley gets to the fourth support at the start of
 * the move (playGantry's step 1) or the animation is stopped.
 */
const hangers = new Set();

/** A hanger's size against the gantry's blue tips: HANGER_LENGTH times as long, HANGER_WIDTH times as wide. */
const HANGER_LENGTH = 1.2;
const HANGER_WIDTH = 0.8;
/** The colour of a piece's first and last hanger (the middle ones keep the walkways' blue): bright burgundy. */
const HANGER_END_COLOUR = "#8E1B33";

/** Takes the fills' hangers away. */
export function clearHangers() {
  hangers.forEach((g) => g.remove());
  hangers.clear();
}

/**
 * Fills in a guideway piece that has just turned finished, like a progress bar: its finished look fills in a number of
 * equal steps for its length (fillSteps), with a hanger on each, over a copy of the piece in the look it had before
 * (shown or hidden by the layer switches like any unfinished piece). The trolley hangs the first half from the east end
 * towards the middle (start(1)), then the second half from the west end, ending at the middle (start(2)); each half
 * takes half of FILL_TIME, and an odd step goes to the first half. The finished piece is clipped by two strips that
 * grow across it, one from each end; they are worked out in the map's own frame (axisOf: east is to the right,
 * whatever the view's turn) and drawn in the piece's coordinates. The piece shows unfinished until start(1) is called.
 * @param {SVGSVGElement} svg The map's <svg>.
 * @param {SVGPolygonElement} el The piece, now finished.
 * @param {string} was Its class before it turned finished.
 * @returns {{ east: DOMPoint, west: DOMPoint, middle: DOMPoint, length: number, start: (half: 1|2) => void }|null} The
 * middles of the piece's east and west ends on the screen (where the two halves of the fill start), the point where
 * they meet, its length, and start(), which starts the first or second half of the fill; null for a piece with no shape
 * to fill.
 */
export function fillIn(svg, el, was) {
  const axis = axisOf(svg, el);
  if (!axis) return null;
  const { turn, toPiece, cx, cy, u, v, from, to, across } = axis,
    // how many steps (and hangers) this piece fills in by, for its length
    steps = fillSteps(svg, axis.length),
    // the first half's steps (the odd one too), the second half's, and how far along the piece the steps' edges are
    first = Math.ceil(steps / 2),
    second = steps - first,
    at = (k) => from + ((to - from) * k) / steps;
  // the strip from `a` to `b` along the piece, in the piece's own coordinates
  const strip = (a, b) =>
    [
      [a, -across],
      [b, -across],
      [b, across],
      [a, across],
    ]
      .map(([a, b]) => new DOMPoint(cx + u.x * a + v.x * b, cy + u.y * a + v.y * b).matrixTransform(toPiece))
      .map((p) => `${p.x},${p.y}`)
      .join(" ");
  const ns = "http://www.w3.org/2000/svg",
    id = `fill-clip-${++fillCount}`,
    clip = document.createElementNS(ns, "clipPath"),
    shape = document.createElementNS(ns, "polygon"),
    shapeWest = document.createElementNS(ns, "polygon"),
    under = el.cloneNode(false);
  clip.id = id;
  clip.setAttribute("clipPathUnits", "userSpaceOnUse");
  shape.setAttribute("points", strip(from, from));
  shapeWest.setAttribute("points", strip(to, to));
  clip.append(shape, shapeWest);
  under.removeAttribute("id");
  under.setAttribute("class", was);
  under.setAttribute("aria-hidden", "true");
  el.before(clip, under);
  el.setAttribute("clip-path", `url(#${id})`);
  let frame;
  const end = () => {
    cancelAnimationFrame(frame);
    el.removeAttribute("clip-path");
    clip.remove();
    under.remove();
    fills.delete(end);
  };
  fills.add(end);

  // HANGERS: as each step fills, a hanger is drawn on it: a rectangle sized from the gantry's blue tips (.clipper-tip),
  // HANGER_LENGTH times as long and HANGER_WIDTH times as wide, in the darker blue and the opacity of the gantry's
  // walkways (.clipper-walkway; the tips' solid blue if there are none), except the one at each end of the piece, which
  // is HANGER_END_COLOUR; its long side across the guideway, centred on the step. The tip's two sides are measured in the
  // map's frame, where the gantry's squash doesn't bend them. They go in a group just above the piece, in its
  // coordinates.
  const tip = svg.querySelector(".clipper-tip"),
    walkway = svg.querySelector(".clipper-walkway"),
    colour = walkway?.getAttribute("fill") ?? tip?.getAttribute("fill") ?? "currentColor",
    opacity = walkway?.getAttribute("opacity"),
    group = document.createElementNS(ns, "g");
  let short = 0,
    long = 0;
  if (tip) {
    const b = tip.getBBox(),
      tipToMap = turn.getCTM().inverse().multiply(tip.getCTM()),
      at = (x, y) => new DOMPoint(x, y).matrixTransform(tipToMap),
      o = at(b.x, b.y),
      w = at(b.x + b.width, b.y),
      h = at(b.x, b.y + b.height),
      sides = [Math.hypot(w.x - o.x, w.y - o.y), Math.hypot(h.x - o.x, h.y - o.y)];
    short = Math.min(...sides) * HANGER_WIDTH;
    long = Math.max(...sides) * HANGER_LENGTH;
  }
  if (el.getAttribute("transform")) group.setAttribute("transform", el.getAttribute("transform"));
  group.setAttribute("class", "clipper-hangers");
  group.setAttribute("aria-hidden", "true");
  // the hanger on step `p`, counted from the east end
  const hang = (p) => {
    if (!tip) return;
    const a = from + ((to - from) * (p + 0.5)) / steps,
      hanger = document.createElementNS(ns, "polygon");
    hanger.setAttribute(
      "points",
      [
        [a - short / 2, -long / 2],
        [a + short / 2, -long / 2],
        [a + short / 2, long / 2],
        [a - short / 2, long / 2],
      ]
        .map(([s, t]) => new DOMPoint(cx + u.x * s + v.x * t, cy + u.y * s + v.y * t).matrixTransform(toPiece))
        .map((p) => `${p.x},${p.y}`)
        .join(" "),
    );
    hanger.setAttribute("fill", p === 0 || p === steps - 1 ? HANGER_END_COLOUR : colour);
    if (opacity) hanger.setAttribute("opacity", opacity);
    group.append(hanger);
  };

  // the middles of the piece's two ends, on the screen
  const onScreen = screen(turn),
    endAt = (a) => new DOMPoint(cx + u.x * a, cy + u.y * a).matrixTransform(onScreen);
  return {
    east: endAt(from),
    west: endAt(to),
    middle: endAt(at(first)),
    length: to - from,
    start(half) {
      // each half takes half of FILL_TIME as written, timed by playClock(), so a held gantry's fill waits where it is and a
      // change of speed carries it along (played with no time, it fills at once)
      const t0 = playClock(),
        instant = !Number.isFinite(SPEED),
        halfTime = FILL_TIME / 2,
        count = half === 1 ? first : second;
      let shown = 0;
      if (half === 1) {
        el.after(group);
        hangers.add(group);
      }
      const step = () => {
        // the steps filled so far in this half: one more every halfTime / count, the last one when halfTime is up;
        // each step that has just filled gets its hanger (the first half from the east end, the second from the west)
        const k = instant ? count : Math.min(count, Math.floor(((playClock() - t0) / halfTime) * count)),
          was = shown;
        while (shown < k) hang(half === 1 ? shown++ : steps - 1 - shown++);
        if (shown !== was) {
          if (half === 1) shape.setAttribute("points", strip(from, at(k)));
          else shapeWest.setAttribute("points", strip(at(steps - k), to));
        }
        if (k === count) return half === 2 || !second ? end() : undefined;
        frame = requestAnimationFrame(step);
      };
      if (count) frame = requestAnimationFrame(step);
      else if (half === 2) end();
    },
  };
}

/**
 * How long the trolley takes to get to the start of a fill, across to its second half, and then on to the fourth
 * support (step 1), in milliseconds as written (divided by SPEED like every move): half its usual 3000, so it hurries.
 */
export const FILL_TROLLEY_TIME = 1500;
/** How long the trolley takes to get back to its start position after the fill, from the middle: a quick snap back. */
const FILL_RETURN_TIME = 600;

/**
 * The trolley's part in a fill: it hurries along the trusses to the east end of the span (where the fill starts),
 * starts the first half of the fills and follows the fill front to the middle, hurries to the west end, starts the
 * second half and follows the fill front back to the middle (each half takes half of FILL_TIME), then hurries back to
 * where it was. It follows the longest piece that fills; the ends are measured in the truss frame (the trolley's parent group, where the
 * trusses run along y), from where the trolley is drawn, as moveTrolley() measures it.
 * @param {SVGGraphicsElement} trolley #clipper-trolley, with no move of its own under way.
 * @param {ReturnType<typeof fillIn>[]} pieces The pieces filling in.
 * @returns {Promise<void>} Done when the trolley is back.
 */
export async function followFill(trolley, pieces) {
  const truss = trolley.parentNode,
    toTruss = screen(truss).inverse(),
    drawnAt = centreIn(trolley, truss).y,
    longest = pieces.reduce((a, b) => (b.length > a.length ? b : a)),
    east = longest.east.matrixTransform(toTruss).y - drawnAt,
    west = longest.west.matrixTransform(toTruss).y - drawnAt,
    middle = longest.middle.matrixTransform(toTruss).y - drawnAt;
  const go = (from, to, ms, easing) =>
    trolley.animate([{ translate: `0 ${from}px` }, { translate: `0 ${to}px` }], {
      duration: ms,
      easing,
      fill: "forwards",
    }).finished;
  await go(0, east, FILL_TROLLEY_TIME / SPEED, "ease-in-out");
  pieces.forEach((p) => p.start(1));
  // half the fill's time, divided by SPEED like the fill itself, and at a steady pace like the fill's equal steps
  await go(east, middle, FILL_TIME / 2 / SPEED, "linear");
  await go(middle, west, FILL_TROLLEY_TIME / SPEED, "ease-in-out");
  pieces.forEach((p) => p.start(2));
  await go(west, middle, FILL_TIME / 2 / SPEED, "linear");
  await go(middle, 0, FILL_RETURN_TIME / SPEED, "ease-in-out");
}
