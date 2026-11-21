// Moving Support C. A and B (and the short support) are moved by the sliders in normalMove.js's prepare(); C is moved by
// moveFourth(), which poses it in the map's frame, so these helpers do what a slider does for it.

/** Where Support C's middle is on the map now: where it started, plus its moves (m.fourth). */
const cMiddle = (m) => ({ x: m.middle.x + m.fourth.x, y: m.middle.y + m.fourth.y });

/**
 * Turns Support C about a point on the map, the way a slider's swing does for the trusses: its middle goes round the pivot
 * by `turn` degrees (a positive turn is clockwise on the screen), and it turns by the same amount.
 */
export function swingC(m, pivot, turn, ms) {
  const c = cMiddle(m),
    r = (turn * Math.PI) / 180,
    dx = c.x - pivot.x,
    dy = c.y - pivot.y;
  return m.moveFourth(
    {
      x: pivot.x + dx * Math.cos(r) - dy * Math.sin(r) - m.middle.x,
      y: pivot.y + dx * Math.sin(r) + dy * Math.cos(r) - m.middle.y,
      turn: m.fourth.turn + turn,
    },
    ms,
  );
}

/** Slides Support C `d` along the trusses (truss units), and `sideways` on the map besides, in `ms`. */
export function slideC(m, d, ms, sideways = { x: 0, y: 0 }) {
  const step = m.along(d);
  return m.moveFourth({ ...m.fourth, x: m.fourth.x + step.x + sideways.x, y: m.fourth.y + step.y + sideways.y }, ms);
}
