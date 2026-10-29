// Anchor the Clayton Clipper gantry to the span it is working on. #clayton-clipper is drawn for span data-drawn-at; this moves
// each of its data-anchor groups to span data-span (the cclabel span numbers, 1-105). Spans are found from the drawing:
// - the joint between spans n and n+1 is the bent cap (rect.g) nearest the midpoint of their two labels
// - span n runs from joint n-1/n to joint n/n+1, centred on its gantry box (a gi or p polygon) where it has one, so the gantry stays
//   on its own track; crane spans with no gantry box use the midpoint between their joints
// Anchors (S is the working span):
// - front: just ahead of S, on joint S/S+1     - second: just behind S, on joint S-1/S
// - rear: the back of S-1, on joint S-2/S-1    - fourth: on S-1, at the same fraction of the way along it as drawn
//   (the supports keep the along and across offsets they are drawn with, turned with the span)
// - body: centred on S's midpoint, between its outer edges, and parallel to them
// span: S plus this; end: which of that span's joints
const SUPPORTS = {
  front: { span: 0, end: "front" },
  second: { span: 0, end: "back" },
  rear: { span: -1, end: "back" },
  fourth: { span: -1, along: true },
};

export function placeGantry(root) {
  const gantry = root.querySelector("#clayton-clipper");
  if (!gantry || !gantry.dataset.span) return;
  const S = +gantry.dataset.span,
    D = +(gantry.dataset.drawnAt || S);
  const groups = [...gantry.querySelectorAll(":scope > [data-anchor]")];
  // start from the drawn position, so placing again is safe
  groups.forEach((g) => {
    if (g.dataset.drawnTransform == null)
      g.dataset.drawnTransform = g.getAttribute("transform") || "";
    else g.setAttribute("transform", g.dataset.drawnTransform);
  });

  // getScreenCTM gives an SVGMatrix in some browsers, which DOMMatrix maths won't take
  const ctm = (el) => DOMMatrix.fromMatrix(el.getScreenCTM());
  const toRoot = ctm(root).inverse();
  const toCanvas = (el, x, y) =>
    new DOMPoint(x, y).matrixTransform(ctm(el)).matrixTransform(toRoot);
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y }),
    sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y }),
    mul = (a, k) => ({ x: a.x * k, y: a.y * k }),
    dot = (a, b) => a.x * b.x + a.y * b.y,
    unit = (a) => mul(a, 1 / Math.hypot(a.x, a.y)),
    mid = (a, b) => mul(add(a, b), 0.5);

  const labels = {};
  root.querySelectorAll("text.cclabel").forEach((t) => {
    labels[+t.textContent.trim()] = toCanvas(
      t,
      +t.getAttribute("x"),
      +t.getAttribute("y"),
    );
  });
  const caps = [...root.querySelectorAll("rect.g")]
    .filter((el) => !gantry.contains(el))
    .map((el) =>
      toCanvas(
        el,
        +el.getAttribute("x") + +el.getAttribute("width") / 2,
        +el.getAttribute("y") + +el.getAttribute("height") / 2,
      ),
    );
  const nearest = (list, p, at = (q) => q) => {
    let best = null,
      d = Infinity;
    list.forEach((q) => {
      const e = Math.hypot(at(q).x - p.x, at(q).y - p.y);
      if (e < d) {
        d = e;
        best = q;
      }
    });
    return [best, d];
  };
  const joint = (n) =>
    labels[n] && labels[n + 1]
      ? nearest(caps, mid(labels[n], labels[n + 1]))[0]
      : null;
  const boxes = [...root.querySelectorAll("polygon.gi, polygon.p")]
    .filter((el) => !gantry.contains(el))
    .map((el) => {
      const pts = [...el.points].map((p) => toCanvas(el, p.x, p.y));
      return { pts, c: mul(pts.reduce(add), 1 / pts.length) };
    });
  // span n: its centre, its direction (forward, towards higher numbers) and the projected positions of its joints
  const span = (n) => {
    const back = joint(n - 1),
      front = joint(n);
    if (!back || !front) return null;
    let u = unit(sub(front, back)),
      c = mid(back, front);
    const [box, d] = nearest(boxes, c, (b) => b.c);
    if (box && d < 0.4 * Math.hypot(front.x - back.x, front.y - back.y)) {
      c = box.c;
      // the box's long edges, pointing forward
      const edges = box.pts.map((p, i) => sub(box.pts[(i + 1) % box.pts.length], p));
      edges.sort((a, b) => Math.hypot(b.x, b.y) - Math.hypot(a.x, a.y));
      const e = edges
        .slice(0, 2)
        .map((v) => (dot(v, u) < 0 ? mul(v, -1) : v))
        .reduce(add);
      u = unit(e);
    }
    const on = (p) => add(c, mul(u, dot(sub(p, c), u)));
    return { c, u, v: { x: -u.y, y: u.x }, back: on(back), front: on(front) };
  };
  const needed = [S - 1, S, D - 1, D];
  const spans = Object.fromEntries(needed.map((n) => [n, span(n)]));
  if (needed.some((n) => !spans[n])) {
    console.warn(`gantry: span ${S} or a span next to it has no joints; left where it is drawn`);
    return;
  }
  const angle = (u) => (Math.atan2(u.y, u.x) * 180) / Math.PI;

  // the gantry's own styles hide it, and a hidden element has no box to measure
  const display = gantry.style.display;
  gantry.style.display = "inline";
  const centre = (el) => {
    const b = el.getBBox();
    return toCanvas(el, b.x + b.width / 2, b.y + b.height / 2);
  };
  // the canvas-space move for each anchor: turn by `turn` degrees about `from`, then move `from` onto `to`
  const moves = {};
  Object.entries(SUPPORTS).forEach(([a, rule]) => {
    const key = gantry.querySelector(`:scope > [data-anchor="${a}"] > *`);
    if (!key) return;
    const from = centre(key),
      was = spans[D + rule.span],
      now = spans[S + rule.span];
    let to;
    if (rule.along) {
      const t = dot(sub(from, was.back), was.u) / dot(sub(was.front, was.back), was.u),
        across = dot(sub(from, was.c), was.v);
      to = add(add(now.back, mul(sub(now.front, now.back), t)), mul(now.v, across));
    } else {
      const off = sub(from, was[rule.end]);
      to = add(
        now[rule.end],
        add(mul(now.u, dot(off, was.u)), mul(now.v, dot(off, was.v))),
      );
    }
    moves[a] = { from, to, turn: angle(now.u) - angle(was.u) };
  });
  // body: the midpoint between the two trusses onto the span centre, trusses parallel to the span's edges
  const trusses = [...gantry.querySelectorAll(".clipper-truss")];
  if (trusses.length === 2) {
    const from = mid(centre(trusses[0]), centre(trusses[1]));
    const b = trusses[0].getBBox(),
      p0 = toCanvas(trusses[0], b.x, b.y),
      along =
        b.width > b.height
          ? sub(toCanvas(trusses[0], b.x + b.width, b.y), p0)
          : sub(toCanvas(trusses[0], b.x, b.y + b.height), p0);
    const now = spans[S],
      dir = dot(along, now.u) < 0 ? mul(along, -1) : along;
    moves.body = { from, to: now.c, turn: angle(now.u) - angle(dir) };
  }
  gantry.style.display = display;

  groups.forEach((g) => {
    const m = moves[g.dataset.anchor];
    if (!m) return;
    const T = new DOMMatrix()
      .translate(m.to.x, m.to.y)
      .rotate(m.turn)
      .translate(-m.from.x, -m.from.y);
    // the same move in the group's own (narrowed, rotated) frame
    const P = toRoot.multiply(ctm(gantry)),
      M = P.inverse().multiply(T).multiply(P);
    g.setAttribute(
      "transform",
      `matrix(${[M.a, M.b, M.c, M.d, M.e, M.f].map((x) => +x.toFixed(6)).join(" ")}) ${g.dataset.drawnTransform}`.trim(),
    );
  });
}
