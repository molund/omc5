// TEMP: arrows pointing at the supports holding the trusses up during each step, so the balance can be checked by eye
// while the steps are worked out. Each step's two main ones are a guess, set with holders() before the step plays; a
// third arrow finds itself: the support the trolley is anchored over while it moves the trusses.

import { between, centreIn } from "./measure.js";
import { UNITS_PER_METRE } from "../../lib/layerSwitches.js";

const NS = "http://www.w3.org/2000/svg";
/** The beam of each support, by its data-anchor, as the steps' shared object (m) names it. */
const BEAMS = { second: "secondBeam", rear: "thirdBeam", fourth: "beam", front: "frontBeam" };

/** The supports' names on the screen, by data-anchor. */
const NAMES = { second: "A", rear: "B", fourth: "C", front: "short" };
/**
 * The weights for the moment panel, in long supports, as Mike guesses them: a long support 1.3 times the short one, the
 * trolley 3.5 long supports, and the trusses TRUSSES_SHARE of the whole gantry's weight (trusses, trolley and the four
 * supports).
 */
const WEIGHTS = { second: 1, rear: 1, fourth: 1, front: 1 / 1.3, trolley: 3.5, trusses: 0 };
/** The trusses' share of the whole gantry's weight. */
const TRUSSES_SHARE = 0.75;
{
  const rest = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  WEIGHTS.trusses = (rest * TRUSSES_SHARE) / (1 - TRUSSES_SHARE);
}

let layer = null,
  shown = [],
  shownAnchors = [],
  ahead = 1,
  truss = null,
  // the gantry's pieces for the anchor arrow: the trolley, the blue tips and all four beams
  parts = null;
/** How far, in map units per frame, the trolley may drift and still count as still, and the trusses must move to count as moving. */
const STILL = 0.01;

/**
 * Points the arrows at the supports holding the trusses up from now on (A = "second", B = "rear", C = "fourth", the
 * short support = "front"). The arrows follow the supports as they move.
 * @param {object} m What the steps share.
 * @param {...string} anchors The data-anchors of the supports holding the trusses.
 */
export function holders(m, ...anchors) {
  shown = anchors.map((a) => m[BEAMS[a]]).filter(Boolean);
  shownAnchors = anchors.filter((a) => m[BEAMS[a]]);
  ahead = m.ahead;
  truss = m.truss;
  parts = {
    trolley: m.trolley,
    tips: [...m.gantry.querySelectorAll(".clipper-tip")],
    beams: Object.values(BEAMS)
      .map((k) => m[k])
      .filter(Boolean),
    byAnchor: Object.fromEntries(Object.entries(BEAMS).map(([a, k]) => [a, m[k]])),
  };
  if (!layer?.isConnected) start(m.svg);
}

/** Makes the arrow layer and the loop that keeps the arrows on their supports. */
function start(svg) {
  svg.querySelector("#temp-holder-arrows")?.remove();
  layer = document.createElementNS(NS, "g");
  layer.setAttribute("id", "temp-holder-arrows");
  layer.setAttribute("pointer-events", "none");
  const arrows = [0, 1, 2].map(() => {
    const p = document.createElementNS(NS, "polygon");
    p.setAttribute("fill", "#ff2d2d");
    p.setAttribute("stroke", "#ffffff");
    p.setAttribute("stroke-width", "0.8");
    p.setAttribute("stroke-linejoin", "round");
    layer.appendChild(p);
    return p;
  });
  svg.appendChild(layer);
  const own = layer;
  let last = null,
    // the anchor: while the trusses move and the trolley stays still on the map, the support nearest under the trolley.
    // It stays while nothing moves (the Pause button, the waits between steps), and clears when the trolley moves.
    anchor = null;
  const panel = momentPanel();
  const follow = () => {
    if (!own.isConnected) return panel.remove();
    if (parts?.trolley?.getBoundingClientRect().width) {
      const t = centreIn(parts.trolley, svg),
        tipPts = parts.tips.map((e) => centreIn(e, svg)),
        tips = {
          x: tipPts.reduce((a, q) => a + q.x, 0) / tipPts.length,
          y: tipPts.reduce((a, q) => a + q.y, 0) / tipPts.length,
        };
      const trolleyMoves = last && Math.hypot(t.x - last.t.x, t.y - last.t.y) >= STILL,
        trussesMove = last && Math.hypot(tips.x - last.tips.x, tips.y - last.tips.y) > STILL;
      if (trolleyMoves) anchor = null;
      else if (trussesMove)
        anchor = parts.beams.reduce((a, b) => {
          const ca = centreIn(a, svg),
            cb = centreIn(b, svg);
          return Math.hypot(cb.x - t.x, cb.y - t.y) < Math.hypot(ca.x - t.x, ca.y - t.y) ? b : a;
        });
      track(svg, t, tips, last);
      last = { t, tips };
      showMoments(panel, svg);
    }
    arrows.forEach((p, i) => {
      const beam = i < 2 ? shown[i] : shown.includes(anchor) ? null : anchor;
      // Progress view hides polygons it doesn't know; an inline !important wins over that
      p.style.setProperty("visibility", beam?.getBoundingClientRect().width ? "visible" : "hidden", "important");
      if (beam?.getBoundingClientRect().width) p.setAttribute("points", arrowAt(beam, svg));
    });
    requestAnimationFrame(follow);
  };
  follow();
}

/**
 * An arrow lying along a beam's long side, past one end of it, its tip on that end and pointing in at the beam, as a
 * polygon's points in the map's frame. It is the end on the same side of the trusses for every beam, so the arrows line up.
 */
function arrowAt(beam, svg) {
  const b = beam.getBBox(),
    m = between(beam, svg),
    at = (x, y) => new DOMPoint(x, y).matrixTransform(m),
    ends =
      b.width >= b.height
        ? [at(b.x, b.y + b.height / 2), at(b.x + b.width, b.y + b.height / 2)]
        : [at(b.x + b.width / 2, b.y), at(b.x + b.width / 2, b.y + b.height)],
    // which end is further across the trusses (x in their frame)
    toTruss = truss && between(svg, truss),
    across = (p) => (toTruss ? p.matrixTransform(toTruss).x : p.x),
    [end, other] = across(ends[0]) >= across(ends[1]) ? ends : [ends[1], ends[0]],
    length = Math.hypot(other.x - end.x, other.y - end.y),
    u = { x: (other.x - end.x) / length, y: (other.y - end.y) / length },
    v = { x: -u.y, y: u.x },
    // sizes as shares of the beam's length: the whole arrow, its head, and the half-widths of the head and the shaft
    whole = length * 0.45,
    head = length * 0.16,
    headHalf = length * 0.09,
    shaftHalf = length * 0.03,
    pt = (along, across) => `${end.x + u.x * along + v.x * across},${end.y + u.y * along + v.y * across}`;
  return [
    pt(0, 0),
    pt(-head, headHalf),
    pt(-head, shaftHalf),
    pt(-whole, shaftHalf),
    pt(-whole, -shaftHalf),
    pt(-head, -shaftHalf),
    pt(-head, -headHalf),
  ].join(" ");
}

/**
 * What each support is riding on, by data-anchor: "trolley", "jacks" or nothing (on the ground). Worked out from the
 * moves: a support that moves with the trolley is on the trolley, one that keeps its place on the trusses while they
 * move is on the jacks, and either lets go when its carrier moves without it. A support the trolley set down and then
 * stood over without moving still counts as on the trolley.
 */
const riding = {};
/** Where each support's middle was on the map and on the trusses, the frame before. */
let lastSupports = {};

/** Updates riding{} from this frame's moves (t: the trolley's middle, tips: the tips' middle, both on the map). */
function track(svg, t, tips, last) {
  const now = {};
  for (const [a, beam] of Object.entries(parts.byAnchor)) {
    if (!beam) continue;
    now[a] = { map: centreIn(beam, svg), onTrusses: centreIn(beam, truss) };
    const was = lastSupports[a];
    if (!last || !was) continue;
    const moved = (p, q) => Math.hypot(p.x - q.x, p.y - q.y),
      trolleyStep = { x: t.x - last.t.x, y: t.y - last.t.y },
      supportStep = { x: now[a].map.x - was.map.x, y: now[a].map.y - was.map.y },
      trolleyMoves = Math.hypot(trolleyStep.x, trolleyStep.y) >= STILL,
      trussesMove = moved(tips, last.tips) > STILL,
      supportMoves = Math.hypot(supportStep.x, supportStep.y) >= STILL;
    if (trolleyMoves) {
      // on the trolley if it moved as the trolley did; off it if it stayed behind
      if (
        supportMoves &&
        moved(trolleyStep, supportStep) < Math.max(STILL, 0.05 * Math.hypot(trolleyStep.x, trolleyStep.y))
      )
        riding[a] = "trolley";
      else if (riding[a] === "trolley") riding[a] = undefined;
    }
    if (trussesMove && riding[a] !== "trolley") {
      // on the jacks if it kept its place on the trusses as they moved; off them if it stayed behind
      if (supportMoves && moved(now[a].onTrusses, was.onTrusses) < STILL) riding[a] = "jacks";
      else if (riding[a] === "jacks") riding[a] = undefined;
    }
  }
  lastSupports = now;
}

/** The moment panel: a box in the bottom right corner of the page. */
function momentPanel() {
  document.querySelector("#temp-moment-panel")?.remove();
  const box = document.createElement("div");
  box.id = "temp-moment-panel";
  Object.assign(box.style, {
    position: "fixed",
    right: "12px",
    bottom: "40px",
    zIndex: 1000,
    padding: "8px 10px",
    background: "rgba(0, 0, 0, 0.78)",
    color: "#fff",
    font: "12px/1.45 ui-monospace, Menlo, monospace",
    borderRadius: "6px",
    pointerEvents: "none",
    whiteSpace: "pre",
  });
  document.body.appendChild(box);
  return box;
}

/**
 * Fills the panel: the moment of each load on the trusses about the rear support holding them (the rear one of the two
 * holders() names), weight × arm, the arm in metres along the trusses, forward positive. Positive totals hold the
 * gantry down on that support; a negative total tips it back over it.
 */
function showMoments(panel, svg) {
  if (shownAnchors.length < 2 || !truss) return (panel.textContent = "");
  const y = (el) => centreIn(el, truss).y,
    [rear, front] = [...shownAnchors].sort((a, b) => ahead * (y(parts.byAnchor[a]) - y(parts.byAnchor[b]))),
    pivot = y(parts.byAnchor[rear]),
    onMap = between(truss, svg),
    metres = Math.hypot(onMap.c, onMap.d) / UNITS_PER_METRE,
    arm = (yy) => ahead * (yy - pivot) * metres,
    tipYs = parts.tips.map((e) => centreIn(e, truss).y),
    rows = [
      ["trusses", WEIGHTS.trusses, arm(tipYs.reduce((a, b) => a + b, 0) / tipYs.length)],
      ["trolley", WEIGHTS.trolley, arm(y(parts.trolley))],
      ...Object.entries(riding)
        .filter(([a, on]) => on && a !== rear && a !== front)
        .map(([a, on]) => [
          `${NAMES[a]} (${on === "trolley" ? "on trolley" : "on jacks"})`,
          WEIGHTS[a],
          arm(y(parts.byAnchor[a])),
        ]),
    ],
    total = rows.reduce((sum, [, w, d]) => sum + w * d, 0),
    // the loads that hold it down against the ones that would tip it back over the pivot
    down = rows.reduce((sum, [, w, d]) => sum + Math.max(0, w * d), 0),
    up = rows.reduce((sum, [, w, d]) => sum - Math.min(0, w * d), 0),
    pad = (v, n) => String(v).padStart(n),
    line = ([name, w, d]) =>
      `${name.padEnd(17)}${pad(+w.toFixed(2), 4)} × ${pad(d.toFixed(1), 6)} m = ${pad((w * d).toFixed(1), 6)}`;
  panel.textContent = [
    `Moments about ${NAMES[rear]} (rear holder), front: ${NAMES[front]}`,
    ...rows.map(line),
    `${"total".padEnd(33)}= ${pad(total.toFixed(1), 6)}`,
    up ? `held down ${(down / up).toFixed(2)} : 1` : "nothing tipping it back",
  ].join("\n");
  panel.style.background =
    total < 0 ? "rgba(170, 20, 20, 0.85)" : up && down / up < 1.5 ? "rgba(160, 110, 0, 0.85)" : "rgba(0, 0, 0, 0.78)";
}
