// Anchor the Clayton Clipper gantry to the span it is working on. #clayton-clipper is drawn for span data-drawn-at; this moves
// each of its data-anchor groups to span data-span (the cclabel span numbers, 1-105). Spans are found from the drawing:
// - the joint between spans n and n+1 is the bent cap (rect.g) nearest the midpoint of their two labels
// - span n runs from joint n-1/n to joint n/n+1, centred on its gantry box (a gi or p polygon) where it has one, so the gantry stays
//   on its own track; crane spans with no gantry box use the midpoint between their joints
// Anchors (S is the working span):
// - front: just ahead of S, its rear edge flush with S's front end
// - second: just behind S, its front edge flush with S's back end
// - rear: fully on S-1, its rear edge a third of its width in from S-1's back end
// - fourth: on S-1, at the same fraction of the way along it as drawn
//   (the supports keep the across offsets they are drawn with, and the fourth its along offset too, turned with the span)
// - body: centred on S's midpoint, between its outer edges, and parallel to them
// span: S plus this; end: which end of that span; edge: which edge of the support is lined up with that end (the middle of the
// edge on the middle of the end); gap: how far in from the end, into the span, as a fraction of the support's width
const SUPPORTS = {
  front: { span: 0, end: "front", edge: "rear" },
  second: { span: 0, end: "back", edge: "front" },
  rear: { span: -1, end: "back", edge: "rear", gap: 1 / 3 },
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
      c = mid(back, front),
      ends = null;
    const [box, d] = nearest(boxes, c, (b) => b.c);
    if (box && d < 0.4 * Math.hypot(front.x - back.x, front.y - back.y)) {
      c = box.c;
      // the box's long edges, pointing forward
      const edges = box.pts.map((p, i) =>
        sub(box.pts[(i + 1) % box.pts.length], p),
      );
      edges.sort((a, b) => Math.hypot(b.x, b.y) - Math.hypot(a.x, a.y));
      const e = edges
        .slice(0, 2)
        .map((v) => (dot(v, u) < 0 ? mul(v, -1) : v))
        .reduce(add);
      u = unit(e);
      // the middles of its back and front ends: the two corners furthest back and the two furthest forward
      const pts = [...box.pts].sort((a, b) => dot(a, u) - dot(b, u));
      ends = { back: mid(pts[0], pts[1]), front: mid(pts[2], pts[3]) };
    }
    const on = (p) => add(c, mul(u, dot(sub(p, c), u)));
    // without a box, the span ends at its joints
    return {
      c,
      u,
      v: { x: -u.y, y: u.x },
      back: on(back),
      front: on(front),
      ends: ends || { back: on(back), front: on(front) },
    };
  };
  const needed = [S - 1, S, D - 1, D];
  const spans = Object.fromEntries(needed.map((n) => [n, span(n)]));
  if (needed.some((n) => !spans[n])) {
    console.warn(
      `gantry: span ${S} or a span next to it has no joints; left where it is drawn`,
    );
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
      const t =
          dot(sub(from, was.back), was.u) /
          dot(sub(was.front, was.back), was.u),
        across = dot(sub(from, was.c), was.v);
      to = add(
        add(now.back, mul(sub(now.front, now.back), t)),
        mul(now.v, across),
      );
    } else {
      const off = sub(from, was[rule.end]);
      to = add(
        now[rule.end],
        add(mul(now.u, dot(off, was.u)), mul(now.v, dot(off, was.v))),
      );
    }
    const turn = angle(now.u) - angle(was.u);
    if (rule.edge) {
      // the support is its beam and its walkway (the pads sit on top): the middle of its rear edge (its two corners furthest
      // back) or front edge (furthest forward), carried through the move
      const corners = [
        ...gantry.querySelectorAll(
          `:scope > [data-anchor="${a}"] > :not(.clipper-support-pad)`,
        ),
      ].flatMap((el) => {
        const b = el.getBBox();
        return [
          [b.x, b.y],
          [b.x + b.width, b.y],
          [b.x + b.width, b.y + b.height],
          [b.x, b.y + b.height],
        ].map(([x, y]) => toCanvas(el, x, y));
      });
      corners.sort((p, q) => dot(p, was.u) - dot(q, was.u));
      // its width along the span
      const width = dot(sub(corners[corners.length - 1], corners[0]), was.u);
      const n = corners.length,
        facing =
          rule.edge === "rear"
            ? mid(corners[0], corners[1])
            : mid(corners[n - 2], corners[n - 1]);
      const r = (turn * Math.PI) / 180,
        o = sub(facing, from),
        edge = add(to, {
          x: o.x * Math.cos(r) - o.y * Math.sin(r),
          y: o.x * Math.sin(r) + o.y * Math.cos(r),
        });
      // into the span is forward from its back end, backward from its front end
      const target = add(
        now.ends[rule.end],
        mul(now.u, (rule.end === "back" ? 1 : -1) * (rule.gap || 0) * width),
      );
      to = add(to, mul(now.u, dot(sub(target, edge), now.u)));
    }
    moves[a] = { from, to, turn };
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
  // the middle of the span the gantry is on, in canvas units, for views that centre on it
  return spans[S].c;
}
