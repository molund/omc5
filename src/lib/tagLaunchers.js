// Launcher layers: tag every span, arrow, label, exit-track piece and support as Clayton Clipper (cc), Langley Launcher (ll, the
// Hillcrest 184 station and everything east of it) or Fleetwood Flyer (ff, everything north-west of the end of span 105). Each
// launcher has a dividing line through the centre of its first bent (P0), at angle th; an element is past it, and so belongs to
// that launcher, when its centre is on that line or beyond it (its normal, (sin th, -cos th), points away from the Clipper).
// Elements already drawn as ff stay ff.
const LAUNCHERS = [
  // the first station bent
  { cls: "ll", th: 122.7, P0x: 5108.7, P0y: 3022.6 },
  // the bent at the end of span 105, the Clipper's last, square to the line there
  { cls: "ff", th: 306.73, P0x: -6235.86, P0y: -4746.69 },
].map((l) => {
  const th = (l.th * Math.PI) / 180;
  return { ...l, nx: Math.sin(th), ny: -Math.cos(th) };
});

export function tagLaunchers(root) {
  const inv = root.getScreenCTM().inverse();
  function toCanvas(el, x, y) {
    const m = el.getScreenCTM();
    if (!m) return null;
    const p = root.createSVGPoint();
    p.x = x;
    p.y = y;
    return p.matrixTransform(m).matrixTransform(inv);
  }
  function tag(el, x, y) {
    if (el.classList.contains("ff")) return;
    const q = toCanvas(el, x, y);
    if (!q) return;
    const past = LAUNCHERS.find(
      (l) => (q.x - l.P0x) * l.nx + (q.y - l.P0y) * l.ny >= -0.5,
    );
    el.classList.add(past ? past.cls : "cc");
  }
  const has = (el, re) => re.test(el.getAttribute("class") || "");
  root.querySelectorAll("polygon").forEach((el) => {
    if (!has(el, /guideway/)) return;
    const L = el.points,
      n = L.numberOfItems;
    let x = 0,
      y = 0;
    for (let i = 0; i < n; i++) {
      x += L.getItem(i).x;
      y += L.getItem(i).y;
    }
    tag(el, x / n, y / n);
  });
  root.querySelectorAll("path").forEach((el) => {
    if (!has(el, /guideway/)) return;
    const p = el.getPointAtLength(el.getTotalLength() / 2);
    tag(el, p.x, p.y);
  });
  root.querySelectorAll("text").forEach((el) => {
    if (!has(el, /guideway|spanlabel/)) return;
    tag(el, +el.getAttribute("x"), +el.getAttribute("y"));
  });
  root
    .querySelectorAll("rect.g")
    .forEach((el) =>
      tag(
        el,
        +el.getAttribute("x") + +el.getAttribute("width") / 2,
        +el.getAttribute("y") + +el.getAttribute("height") / 2,
      ),
    );
  root
    .querySelectorAll('circle[fill="#D7D7D7"]')
    .forEach((el) => tag(el, +el.getAttribute("cx"), +el.getAttribute("cy")));
}
