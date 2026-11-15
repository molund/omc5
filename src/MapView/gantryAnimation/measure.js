// Measuring the drawing through the screen: where an element is, and how big, in another element's coordinates.

/**
 * The matrix that turns `el`'s own coordinates into `frame`'s coordinates (both measured through the screen).
 * @param {SVGGraphicsElement} el
 * @param {SVGGraphicsElement} frame
 * @returns {DOMMatrix}
 */
export const between = (el, frame) => screen(frame).inverse().multiply(screen(el));

/**
 * An element's getScreenCTM as a 2D DOMMatrix, from its six numbers (DOMMatrix.fromMatrix() can make one Chrome treats as
 * 3D, which can't then be multiplied with a 2D one).
 * @param {SVGGraphicsElement} el
 * @returns {DOMMatrix}
 */
export function screen(el) {
  const m = el.getScreenCTM();
  return new DOMMatrix([m.a, m.b, m.c, m.d, m.e, m.f]);
}

/**
 * Half the length of `el`'s long side, in `frame`'s coordinates (both measured through the screen).
 * @param {SVGGraphicsElement} el
 * @param {SVGGraphicsElement} frame
 * @returns {number}
 */
export function halfLength(el, frame) {
  const b = el.getBBox(),
    m = between(el, frame),
    o = new DOMPoint(b.x, b.y).matrixTransform(m),
    w = new DOMPoint(b.x + b.width, b.y).matrixTransform(m),
    h = new DOMPoint(b.x, b.y + b.height).matrixTransform(m);
  return Math.max(Math.hypot(w.x - o.x, w.y - o.y), Math.hypot(h.x - o.x, h.y - o.y)) / 2;
}

/**
 * The middle of `el`'s box, in `frame`'s coordinates.
 * @param {SVGGraphicsElement} el
 * @param {SVGGraphicsElement} frame
 * @returns {DOMPoint}
 */
export function centreIn(el, frame) {
  const b = el.getBBox();
  return new DOMPoint(b.x + b.width / 2, b.y + b.height / 2).matrixTransform(between(el, frame));
}

/**
 * How far `el` reaches along y in `frame`: the lowest and highest y of its box's four corners there.
 * @param {SVGGraphicsElement} el
 * @param {SVGGraphicsElement} frame
 * @returns {{ lo: number, hi: number }}
 */
export function reachIn(el, frame) {
  const b = el.getBBox(),
    m = between(el, frame);
  const ys = [
    [b.x, b.y],
    [b.x + b.width, b.y],
    [b.x, b.y + b.height],
    [b.x + b.width, b.y + b.height],
  ].map(([x, y]) => new DOMPoint(x, y).matrixTransform(m).y);
  return { lo: Math.min(...ys), hi: Math.max(...ys) };
}
