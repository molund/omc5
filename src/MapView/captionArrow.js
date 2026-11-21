// An arrow over the map pointing at a part of the gantry while a caption shows (captions.json's `point`): black with a
// white halo, like the captions and the span numbers, the same size on the screen at any zoom, and following the part as
// it moves. It comes in across the trusses from the left of the screen.
//
// The parts it can point at (POINTS): the supports by their letters (support-a, support-b, support-c, short-support), the
// trolley, and the lifting jacks at either end of the trusses (front-jacks, rear-jacks: the middle of that end's two blue
// tips).

const NS = "http://www.w3.org/2000/svg";

/** The arrow's size on the screen, in CSS pixels: its length, its head's length and width, its shaft's width, and the
 * gap between its tip and the part. */
const LENGTH = 56,
  HEAD = 18,
  HEAD_WIDTH = 20,
  SHAFT = 6,
  GAP = 6;

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

/** Where each part is on the screen, by its name in captions.json. */
const POINTS = {
  "support-a": (g) => middle(g.querySelector("#gantry-support-a")),
  "support-b": (g) => middle(g.querySelector("#gantry-support-b")),
  "support-c": (g) => middle(g.querySelector("#gantry-support-c")),
  "short-support": (g) => middle(g.querySelector("#gantry-support-front")),
  trolley: (g) => middle(g.querySelector("#clipper-trolley")),
  "front-jacks": (g) => ends(g)?.front,
  "rear-jacks": (g) => ends(g)?.rear,
};

let arrow = null,
  frame = null;

/**
 * Points the arrow at a part of the gantry until hideArrow(); a name it doesn't know hides it.
 * @param {SVGSVGElement} svg The map's <svg>.
 * @param {string|null} name The part (POINTS).
 * @returns {void}
 */
export function showArrow(svg, name) {
  hideArrow();
  const gantry = svg?.querySelector("#clayton-clipper"),
    at = POINTS[name];
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
    if (p?.shown && e && ctm) {
      // across the trusses, from the left of the screen
      const dx = e.front.x - e.rear.x,
        dy = e.front.y - e.rear.y,
        l = Math.hypot(dx, dy) || 1;
      let ux = -dy / l,
        uy = dx / l;
      if (ux > 0) [ux, uy] = [-ux, -uy];
      // the arrow's outline on the screen: from its tip (GAP from the part) back along u, then into the map's own units
      const along = (d, w) => ({ x: p.x + ux * (GAP + d) - uy * w, y: p.y + uy * (GAP + d) + ux * w }),
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
