// Launcher layers: tag every span, arrow, label, exit-track piece and support as Clayton Clipper (cc, everything west of the
// Hillcrest 184 station) or Langley Launcher (ll, the station itself and everything east). The dividing line is the centre line of
// the first station bent; an element is east of it when its centre is on that line or past it.
export function tagLaunchers(root) {
  const inv = root.getScreenCTM().inverse();
  const th = (122.7 * Math.PI) / 180,
    nx = Math.sin(th),
    ny = -Math.cos(th),
    P0x = 5108.7,
    P0y = 3022.6;
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
    el.classList.add((q.x - P0x) * nx + (q.y - P0y) * ny >= -0.5 ? "ll" : "cc");
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
