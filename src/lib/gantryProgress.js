// How far the Clayton Clipper gantry has got on its journey: the numbered span (the cclabel span numbers, 1-105) it is working on,
// from data-span on the #clayton-clipper group (set from status.yaml), counted only once that span is complete (or at least
// hung); until then the count is the span behind it.
// Every Clayton Clipper guideway span is also given the number of its nearest label. With `complete` given (status.yaml), the
// gantry boxes behind the gantry, and the one it is on when complete, are drawn finished; the ones the gantry has reached (the
// count or lower) are tagged "reached" so progress-chart mode can colour just those.
export function gantryProgress(root, complete) {
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
  // the span the gantry is anchored to (see placeGantry.js); without one, the label nearest the gantry body
  let span = +gantry.dataset.span || null;
  if (span == null) {
    // the drawing's own styles hide the gantry, and a hidden element has no box to measure
    const display = gantry.style.display;
    gantry.style.display = "inline";
    const b = body.getBBox();
    span = nearest(toCanvas(body, b.x + b.width / 2, b.y + b.height / 2));
    gantry.style.display = display;
  }
  const pieces = [...root.querySelectorAll("polygon.guideway.cc")].map((el) => {
    const L = el.points,
      k = L.numberOfItems;
    let x = 0,
      y = 0;
    for (let i = 0; i < k; i++) {
      x += L.getItem(i).x;
      y += L.getItem(i).y;
    }
    return {
      el,
      n: nearest(toCanvas(el, x / k, y / k)),
      c: toCanvas(el, x / k, y / k),
    };
  });
  let done;
  if (complete != null) {
    // the gantry never moves on until its span is finished, so every gantry box behind it is finished too
    done = complete;
    pieces.forEach(({ el, n }) => {
      if (el.matches(".p") && (n < span || (done && n === span))) {
        el.classList.remove("p", "unfinished");
        el.classList.add("gi");
      }
    });
  } else {
    // from the drawing: the span the gantry is on only counts once it is complete (or at least hung): its gantry box (gi, or p
    // while unfinished) if it has one, otherwise its precast or steel pieces
    const on = pieces.filter((p) => p.n === span),
      boxes = on.filter((p) => p.el.matches(".gi, .p")),
      decide = boxes.length ? boxes : on;
    done =
      !decide.length ||
      decide.some((p) => !p.el.classList.contains("unfinished"));
  }
  const count = done ? span : span - 1;
  pieces.forEach((p) => {
    if (p.n <= count) p.el.classList.add("reached");
  });
  // the SFMSF span labels (span letters and the old gantry span numbers) are drawn grey with a white halo on unfinished spans and
  // plain white on finished ones; one sitting on a piece that is finished (now perhaps because of status.yaml) gets the finished
  // look: its text white, its halo (the white-stroked copy under it) gone
  root.querySelectorAll("text.spanlabel").forEach((t) => {
    const q = toCanvas(t, +t.getAttribute("x"), +t.getAttribute("y"));
    let under = null,
      best = Infinity;
    pieces.forEach((p) => {
      const d = Math.hypot(p.c.x - q.x, p.c.y - q.y);
      if (d < best) {
        best = d;
        under = p.el;
      }
    });
    if (!under || under.classList.contains("unfinished")) return;
    if (t.getAttribute("stroke") === "#FFFFFF") t.remove();
    else if (
      t.style.fill &&
      t.style.fill !== "rgb(255, 255, 255)" &&
      t.style.fill !== "#ffffff"
    )
      t.style.fill = "#ffffff";
  });
  // a span number sitting on a reached, finished piece (the one with its centre nearest the number) is tagged "on-reached", so
  // progress-chart mode can draw it white on the progress colour
  labels.forEach((t, i) => {
    const { n, q } = anchors[i];
    let under = null,
      best = Infinity;
    pieces.forEach((p) => {
      if (p.n !== n) return;
      const d = Math.hypot(p.c.x - q.x, p.c.y - q.y);
      if (d < best) {
        best = d;
        under = p.el;
      }
    });
    if (
      under &&
      under.classList.contains("reached") &&
      !under.classList.contains("unfinished")
    )
      t.classList.add("on-reached");
  });
  return {
    span: count,
    ahead: westboundAhead(root, pieces, anchors, span, toCanvas),
    total: labels.length,
  };
}

// Completed westbound spans ahead of the gantry: the spans numbered past it whose westbound track is already finished (crane
// spans the Clayton Clipper will crawl over). A piece is westbound when it lies on the westbound side of its span's centre line,
// the line between the bents at either end (the bent cap, rect.g, nearest the midpoint of each pair of labels). Westbound is
// the side of positive cross product with the direction of increasing span numbers: where the gantry's own boxes are at
// spans 31-42.
function westboundAhead(root, pieces, anchors, span, toCanvas) {
  const at = Object.fromEntries(anchors.map(({ n, q }) => [n, q]));
  const caps = [...root.querySelectorAll("rect.g")]
    .filter((el) => !el.closest("#clayton-clipper"))
    .map((el) =>
      toCanvas(
        el,
        +el.getAttribute("x") + +el.getAttribute("width") / 2,
        +el.getAttribute("y") + +el.getAttribute("height") / 2,
      ),
    );
  const bent = (n) => {
    if (!at[n] || !at[n + 1]) return null;
    const m = {
      x: (at[n].x + at[n + 1].x) / 2,
      y: (at[n].y + at[n + 1].y) / 2,
    };
    return caps.reduce((a, k) =>
      Math.hypot(k.x - m.x, k.y - m.y) < Math.hypot(a.x - m.x, a.y - m.y)
        ? k
        : a,
    );
  };
  const counted = new Set();
  pieces.forEach(({ el, n, c }) => {
    if (n <= span || counted.has(n) || el.classList.contains("unfinished"))
      return;
    const a = bent(n - 1),
      b = bent(n);
    if (!a || !b) return;
    const ux = b.x - a.x,
      uy = b.y - a.y,
      side =
        (ux * (c.y - (a.y + b.y) / 2) - uy * (c.x - (a.x + b.x) / 2)) /
        Math.hypot(ux, uy);
    // more than a couple of units off the centre line, so a full-width box doesn't count as one track
    if (side > 2) counted.add(n);
  });
  return counted.size;
}
