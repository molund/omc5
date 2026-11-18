// TEMP: arrows pointing at the supports holding the trusses up during each step, so the balance can be checked by eye
// while the steps are worked out. Each step's two main ones are a guess, set with holders() before the step plays; a
// third arrow finds itself: the support the trolley is anchored over while it moves the trusses.

import { between, centreIn } from "./measure.js";

const NS = "http://www.w3.org/2000/svg";
/** The beam of each support, by its data-anchor, as the steps' shared object (m) names it. */
const BEAMS = { second: "secondBeam", rear: "thirdBeam", fourth: "beam", front: "frontBeam" };

let layer = null,
  shown = [],
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
  truss = m.truss;
  parts = {
    trolley: m.trolley,
    tips: [...m.gantry.querySelectorAll(".clipper-tip")],
    beams: Object.values(BEAMS)
      .map((k) => m[k])
      .filter(Boolean),
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
  let last = null;
  const follow = () => {
    if (!own.isConnected) return;
    // the anchor: while the trusses move and the trolley stays still on the map, the support nearest under the trolley
    let anchor = null;
    if (parts?.trolley?.getBoundingClientRect().width) {
      const t = centreIn(parts.trolley, svg),
        tipPts = parts.tips.map((e) => centreIn(e, svg)),
        tips = {
          x: tipPts.reduce((a, q) => a + q.x, 0) / tipPts.length,
          y: tipPts.reduce((a, q) => a + q.y, 0) / tipPts.length,
        };
      if (
        last &&
        Math.hypot(t.x - last.t.x, t.y - last.t.y) < STILL &&
        Math.hypot(tips.x - last.tips.x, tips.y - last.tips.y) > STILL
      ) {
        anchor = parts.beams.reduce((a, b) => {
          const ca = centreIn(a, svg),
            cb = centreIn(b, svg);
          return Math.hypot(cb.x - t.x, cb.y - t.y) < Math.hypot(ca.x - t.x, ca.y - t.y) ? b : a;
        });
        if (shown.includes(anchor)) anchor = null;
      }
      last = { t, tips };
    }
    arrows.forEach((p, i) => {
      const beam = i < 2 ? shown[i] : anchor;
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
