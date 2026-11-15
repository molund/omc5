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

/**
 * The guideway over a run of spans as a line, for placing supports along it: through the middle of the two girders of each
 * span, from the rear end of the first span to the front end of the last.
 * @param {SVGSVGElement} svg The map's <svg>.
 * @param {Element} gantry #clayton-clipper.
 * @param {number} S The span the gantry is on (for gantryMoves()).
 * @param {number[]} spans The span numbers, in order along the guideway.
 * @returns {{ length: number, at: (s: number) => { x: number, y: number }, across: (s: number) => { x: number, y: number },
 * along: (p: {x: number, y: number}) => number, span: (s: number) => number }|null} The line's length; the point at
 * distance s along it (s is clamped to the line); the direction across the guideway there; how far along the line a point
 * is (its nearest position on the first span's line if it is behind it); and which span s is on. null when a span has no
 * joints or no girders.
 */
export function guidewayLine(svg, gantry, S, spans) {
  const pieces = [];
  let start = 0;
  for (const n of spans) {
    const frames = gantryMoves(svg, S, n + 1)?.spans[n];
    if (!frames) return null;
    const edges = girderEdges(svg, gantry, frames);
    if (!edges) return null;
    const middle = (edges.edge0 + edges.edge1) / 2,
      girders = { x: frames.c.x + frames.v.x * middle, y: frames.c.y + frames.v.y * middle },
      length = dot(sub(frames.ends.front, frames.ends.back), frames.u),
      // how far along the span (from its rear end) the span's middle is, which is where the girders' middle point is
      mid = dot(sub(frames.c, frames.ends.back), frames.u);
    pieces.push({ n, frames, girders, length, mid, start });
    start += length;
  }
  const find = (s) => pieces.find((p) => s <= p.start + p.length) ?? pieces[pieces.length - 1];
  return {
    length: start,
    at(s) {
      const p = find(s),
        t = Math.min(Math.max(s - p.start, 0), p.length);
      return { x: p.girders.x + p.frames.u.x * (t - p.mid), y: p.girders.y + p.frames.u.y * (t - p.mid) };
    },
    across: (s) => find(s).frames.v,
    along(point) {
      const p = pieces[0];
      return dot(sub(point, p.frames.ends.back), p.frames.u);
    },
    span: (s) => find(s).n,
  };
}
