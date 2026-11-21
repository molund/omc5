// The guideway as the double girder moves need it: where the two girders of a span are across it, and points along it.

import { gantryMoves } from "../../lib/placeGantry.js";
import { between } from "./measure.js";

const dot = (a, b) => a.x * b.x + a.y * b.y,
  sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });

/**
 * Where a span's two girders are across it: the lowest and highest position across (along the span's `v`, from the span's
 * middle `c`) of the corners of the guideway pieces that lie along it, measured as placeGantry() measures a support set
 * across a double girder. The gantry boxes (gi, p) and the unfinished pieces don't count.
 * @param {SVGSVGElement} svg The map's <svg>.
 * @param {Element} gantry #clayton-clipper, whose own pieces are left out.
 * @param {{ back: {x: number, y: number}, front: {x: number, y: number}, u: {x: number, y: number}, v: {x: number, y: number}, c: {x: number, y: number} }} span A span from gantryMoves().
 * @returns {{ edge0: number, edge1: number }|null} null when no girders are found.
 */
export function girderEdges(svg, gantry, span) {
  const alongPos = (p) => dot(sub(p, span.back), span.u),
    lo = Math.min(alongPos(span.back), alongPos(span.front)),
    hi = Math.max(alongPos(span.back), alongPos(span.front));
  let edge0 = Infinity,
    edge1 = -Infinity;
  svg.querySelectorAll("polygon.guideway").forEach((el) => {
    if (gantry.contains(el) || el.matches(".gi, .p, .unfinished")) return;
    const to = between(el, svg),
      pts = [...el.points].map((q) => new DOMPoint(q.x, q.y).matrixTransform(to)),
      c = { x: pts.reduce((a, q) => a + q.x, 0) / pts.length, y: pts.reduce((a, q) => a + q.y, 0) / pts.length },
      ca = alongPos(c);
    if (ca < lo || ca > hi || Math.abs(dot(sub(c, span.c), span.v)) > 60) return;
    const across = pts.map((q) => dot(sub(q, span.c), span.v));
    edge0 = Math.min(edge0, ...across);
    edge1 = Math.max(edge1, ...across);
  });
  return edge0 < edge1 ? { edge0, edge1 } : null;
}
