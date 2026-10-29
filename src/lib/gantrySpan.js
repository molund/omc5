// Where the Clayton Clipper gantry is on its journey: the numbered span (the cclabel span numbers, 1-105) it is working on, from
// data-span on the #clayton-clipper group in plan.svg.
// Every Clayton Clipper guideway span is also given the number of its nearest label, and the ones the gantry has reached (that
// number or lower) are tagged "reached" so progress-chart mode can colour just those.
export function gantrySpan(root) {
  const gantry = root.querySelector("#clayton-clipper"),
    body = gantry && gantry.querySelector(".gantry-body"),
    labels = [...root.querySelectorAll("text.cclabel")];
  if (!body || !labels.length) return null;
  const inv = root.getScreenCTM().inverse();
  const toCanvas = (el, x, y) => {
    const p = root.createSVGPoint();
    p.x = x;
    p.y = y;
    return p.matrixTransform(el.getScreenCTM()).matrixTransform(inv);
  };
  const anchors = labels.map((t) => ({
    n: +t.textContent.trim(),
    q: toCanvas(t, +t.getAttribute("x"), +t.getAttribute("y")),
  }));
  const nearest = (c) => {
    let n = null,
      best = Infinity;
    anchors.forEach(({ n: m, q }) => {
      const d = Math.hypot(q.x - c.x, q.y - c.y);
      if (d < best) {
        best = d;
        n = m;
      }
    });
    return n;
  };
  // the span the gantry is anchored to (see gantryAnchor.js); without one, the label nearest the gantry body
  let span = +gantry.dataset.span || null;
  if (span == null) {
    // the drawing's own styles hide the gantry, and a hidden element has no box to measure
    const display = gantry.style.display;
    gantry.style.display = "inline";
    const b = body.getBBox();
    span = nearest(toCanvas(body, b.x + b.width / 2, b.y + b.height / 2));
    gantry.style.display = display;
  }
  root.querySelectorAll("polygon.guideway.cc").forEach((el) => {
    const L = el.points,
      k = L.numberOfItems;
    let x = 0,
      y = 0;
    for (let i = 0; i < k; i++) {
      x += L.getItem(i).x;
      y += L.getItem(i).y;
    }
    if (nearest(toCanvas(el, x / k, y / k)) <= span) el.classList.add("reached");
  });
  return { span, total: labels.length };
}
