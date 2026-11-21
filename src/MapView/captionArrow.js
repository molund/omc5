// An arrow over the map pointing at a part of the gantry while a caption shows (captions.json's `point`): black with a
// white halo, like the captions and the span numbers, the same size on the screen at any zoom, and following the part as
// it moves. It comes in across the trusses from the left of the screen.
//
// The parts it can point at (POINTS): the supports by their letters (support-a, support-b, support-c, short-support), the
// trolley, and the lifting jacks at either end of the trusses (front-jacks, rear-jacks: JACKS_PAST_TIPS past the middle of
// that end's two blue tips, outwards, where the moves put them). It can also point at a guideway support on the map, by the
// spans either side ("12/13": the bent cap where spans 12 and 13 meet, as placeGantry.js finds it); then it comes in
// across the guideway, and stops at the cap's end.

import { gantryMoves } from "../lib/placeGantry.js";

const NS = "http://www.w3.org/2000/svg";

/** The arrow's size on the screen, in CSS pixels: its length, its head's length and width, its shaft's width, and the
 * gap between its tip and the part. */
const LENGTH = 56,
  HEAD = 18,
  HEAD_WIDTH = 20,
  SHAFT = 6,
  GAP = 6;

/** How far the lifting jacks are past the middle of their end's blue tips, outwards, in the trusses' own units: as the
 * moves have it (PICKUP in normalMove.js, where the front tip stops over the front support to pick it up, and where the rear
 * jacks reach Support B). */
const JACKS_PAST_TIPS = 8;

/** The middle of an element on the screen. */
const middle = (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, shown: r.width > 0 || r.height > 0 };
};
const mean = (ps) => ({
  x: ps.reduce((a, p) => a + p.x, 0) / ps.length,
  y: ps.reduce((a, p) => a + p.y, 0) / ps.length,
  shown: ps.every((p) => p.shown),
});

/** The gantry's two ends on the screen, the middles of their blue tips: { rear, front }, by where the short support is. */
function ends(gantry) {
  const tips = [...gantry.querySelectorAll(".clipper-tip")].map(middle),
    front = middle(gantry.querySelector("#gantry-support-front"));
  if (tips.length < 4) return null;
  // the two tips nearest the short support are the front end
  const sorted = [...tips].sort(
    (a, b) => Math.hypot(a.x - front.x, a.y - front.y) - Math.hypot(b.x - front.x, b.y - front.y),
  );
  return { front: mean(sorted.slice(0, 2)), rear: mean(sorted.slice(2)) };
}

/** Where an end's lifting jacks are on the screen: JACKS_PAST_TIPS past the middle of its tips, away from the other end. */
function jacks(gantry, which) {
  const e = ends(gantry),
    // the trusses' frame: the trolley's parent, as the moves measure it
    m = gantry.querySelector("#clipper-trolley")?.parentNode?.getScreenCTM();
  if (!e || !m) return null;
  const at = e[which],
    other = e[which === "front" ? "rear" : "front"],
    l = Math.hypot(at.x - other.x, at.y - other.y) || 1,
    // the trusses' units on the screen: their frame's y axis
    d = JACKS_PAST_TIPS * Math.hypot(m.c, m.d);
  return { x: at.x + ((at.x - other.x) / l) * d, y: at.y + ((at.y - other.y) / l) * d, shown: at.shown };
}

/** Where each part is on the screen, by its name in captions.json. */
const POINTS = {
  "support-a": (g) => middle(g.querySelector("#gantry-support-a")),
  "support-b": (g) => middle(g.querySelector("#gantry-support-b")),
  "support-c": (g) => middle(g.querySelector("#gantry-support-c")),
  "short-support": (g) => middle(g.querySelector("#gantry-support-front")),
  trolley: (g) => middle(g.querySelector("#clipper-trolley")),
  "front-jacks": (g) => jacks(g, "front"),
  "rear-jacks": (g) => jacks(g, "rear"),
};

/**
 * A guideway support on the screen, by the spans either side (n/n+1): its cap's middle, the direction across the
 * guideway there, and the cap's element (to stop the arrow at its end). Null when the drawing hasn't the spans or the cap.
 */
function bent(svg, n) {
  const span = gantryMoves(svg, n + 1, n + 1)?.spans[n],
    m = svg.getScreenCTM();
  if (!span || !m) return null;
  // the cap nearest the joint (the end of span n), as placeGantry.js finds it
  let cap = null,
    best = Infinity;
  for (const el of svg.querySelectorAll("rect.g")) {
    if (el.closest("#clayton-clipper")) continue;
    const b = el.getBBox(),
      to = el.getScreenCTM();
    if (!to) continue;
    const c = new DOMPoint(b.x + b.width / 2, b.y + b.height / 2).matrixTransform(to).matrixTransform(m.inverse()),
      d = Math.hypot(c.x - span.front.x, c.y - span.front.y);
    if (d < best) {
      best = d;
      cap = el;
    }
  }
  return cap ? { cap, across: span.v } : null;
}

/** A guideway support's place on the screen now (bent()): its cap's middle, the way across, and how far its end is. */
function bentOnScreen(svg, { cap, across }) {
  const b = cap.getBBox(),
    to = cap.getScreenCTM(),
    m = svg.getScreenCTM();
  if (!to || !m) return null;
  const c = new DOMPoint(b.x + b.width / 2, b.y + b.height / 2).matrixTransform(to),
    v = { x: m.a * across.x + m.c * across.y, y: m.b * across.x + m.d * across.y },
    l = Math.hypot(v.x, v.y) || 1;
  let u = { x: v.x / l, y: v.y / l };
  if (u.x > 0) u = { x: -u.x, y: -u.y };
  // how far the cap's end is from its middle, along u: its furthest corner that way
  const half = Math.max(
    ...[
      [b.x, b.y],
      [b.x + b.width, b.y],
      [b.x, b.y + b.height],
      [b.x + b.width, b.y + b.height],
    ].map(([x, y]) => {
      const q = new DOMPoint(x, y).matrixTransform(to);
      return (q.x - c.x) * u.x + (q.y - c.y) * u.y;
    }),
  );
  return { x: c.x, y: c.y, shown: b.width > 0, u, half };
}

let arrow = null,
  frame = null;

/**
 * Points the arrow at a part of the gantry, or a guideway support ("12/13"), until hideArrow(); a name it doesn't know
 * hides it.
 * @param {SVGSVGElement} svg The map's <svg>.
 * @param {string|null} name The part (POINTS) or the support.
 * @returns {void}
 */
export function showArrow(svg, name) {
  hideArrow();
  const gantry = svg?.querySelector("#clayton-clipper"),
    joint = name?.match(/^(\d+)\/(\d+)$/),
    support = joint && +joint[2] === +joint[1] + 1 ? bent(svg, +joint[1]) : null,
    at = support ? () => bentOnScreen(svg, support) : POINTS[name];
  if (!gantry || !at) return;
  arrow = document.createElementNS(NS, "path");
  arrow.setAttribute("fill", "black");
  arrow.setAttribute("stroke", "white");
  arrow.setAttribute("stroke-width", "3");
  arrow.setAttribute("stroke-linejoin", "round");
  arrow.setAttribute("vector-effect", "non-scaling-stroke");
  arrow.setAttribute("paint-order", "stroke fill");
  // Progress view hides what it doesn't know; an inline !important wins over that
  arrow.style.setProperty("visibility", "visible", "important");
  arrow.style.setProperty("pointer-events", "none");
  svg.appendChild(arrow);
  const follow = () => {
    if (!arrow?.isConnected) return;
    const p = at(gantry),
      e = ends(gantry),
      ctm = svg.getScreenCTM();
    if (p?.shown && (p.u || e) && ctm) {
      // across the guideway at a guideway support (bentOnScreen), or across the trusses; from the left of the screen
      let ux, uy;
      if (p.u) ({ x: ux, y: uy } = p.u);
      else {
        const dx = e.front.x - e.rear.x,
          dy = e.front.y - e.rear.y,
          l = Math.hypot(dx, dy) || 1;
        ux = -dy / l;
        uy = dx / l;
        if (ux > 0) [ux, uy] = [-ux, -uy];
      }
      // the arrow's outline on the screen: from its tip (GAP from the part, or from a cap's end) back along u, then into
      // the map's own units
      const off = GAP + (p.half ?? 0),
        along = (d, w) => ({ x: p.x + ux * (off + d) - uy * w, y: p.y + uy * (off + d) + ux * w }),
        pts = [
          along(0, 0),
          along(HEAD, HEAD_WIDTH / 2),
          along(HEAD, SHAFT / 2),
          along(LENGTH, SHAFT / 2),
          along(LENGTH, -SHAFT / 2),
          along(HEAD, -SHAFT / 2),
          along(HEAD, -HEAD_WIDTH / 2),
        ].map((q) => new DOMPoint(q.x, q.y).matrixTransform(ctm.inverse()));
      arrow.setAttribute("d", `M${pts.map((q) => `${q.x},${q.y}`).join("L")}Z`);
      arrow.style.removeProperty("display");
    } else arrow.style.display = "none";
    frame = requestAnimationFrame(follow);
  };
  follow();
}

/** Takes the arrow away. */
export function hideArrow() {
  cancelAnimationFrame(frame);
  arrow?.remove();
  arrow = null;
}
