// The leftmost, rightmost, highest and lowest points of what is actually drawn in plan.svg right now, in canvas units, after
// turning the canvas by `turn` degrees about (cx, cy). Hidden layers, defs, masks, clip paths and shapes painted only in white
// (the canvas backing, which can't be seen on the white page) don't count, nor do the aerial photos (it measures the drawing),
// and anything clipped (the zoomed photo frame clips the guideway, for one) only counts as far as its clip.
const SHAPES = "path, polygon, polyline, line, rect, circle, ellipse, text";
const WHITE = /^(none|rgb\(255, 255, 255\)|#fff(fff)?|white)$/i;

// shown: not display:none or visibility:hidden itself, and no ancestor display:none or opacity 0
function shown(el, root) {
  const own = getComputedStyle(el);
  if (own.visibility !== "visible" || own.display === "none") return false;
  for (let e = el; e && e !== root; e = e.parentElement) {
    const cs = getComputedStyle(e);
    if (cs.display === "none" || cs.opacity === "0") return false;
  }
  return true;
}
function paintedOnlyWhite(el) {
  const cs = getComputedStyle(el);
  const fill = cs.fill === "none" || cs.fillOpacity === "0" ? "none" : cs.fill,
    stroke =
      cs.stroke === "none" || cs.strokeOpacity === "0" ? "none" : cs.stroke;
  return WHITE.test(fill) && WHITE.test(stroke);
}

export function drawingBounds(root, turn, cx, cy) {
  const toRoot = DOMMatrix.fromMatrix(root.getScreenCTM()).inverse(),
    toCanvas = (el, x, y) =>
      new DOMPoint(x, y)
        .matrixTransform(DOMMatrix.fromMatrix(el.getScreenCTM()))
        .matrixTransform(toRoot);
  const r = (turn * Math.PI) / 180,
    c = Math.cos(r),
    s = Math.sin(r),
    turned = (p) => ({
      x: cx + (p.x - cx) * c - (p.y - cy) * s,
      y: cy + (p.x - cx) * s + (p.y - cy) * c,
    });
  const corners = (el, b) => [
    toCanvas(el, b.x, b.y),
    toCanvas(el, b.x + b.width, b.y),
    toCanvas(el, b.x + b.width, b.y + b.height),
    toCanvas(el, b.x, b.y + b.height),
  ];
  // the box (in canvas units, before turning) that an element's clip paths leave visible
  const clipBox = new Map();
  const clipOf = (el) => {
    let box = null;
    for (let e = el; e && e !== root; e = e.parentElement) {
      const ref = e.getAttribute("clip-path");
      const id = ref && ref.match(/url\(#([^)]+)\)/);
      const cp = id && root.getElementById(id[1]);
      if (!cp) continue;
      // the clip path's shapes are in the user space of the element it clips
      const key =
        cp.id + "|" + (e.parentElement ? e.getAttribute("transform") : "");
      if (!clipBox.has(key)) {
        const ctm = DOMMatrix.fromMatrix(e.getScreenCTM());
        const pts = [...cp.children].flatMap((k) => {
          const b = k.getBBox();
          return [
            [b.x, b.y],
            [b.x + b.width, b.y],
            [b.x + b.width, b.y + b.height],
            [b.x, b.y + b.height],
          ].map(([x, y]) =>
            new DOMPoint(x, y).matrixTransform(ctm).matrixTransform(toRoot),
          );
        });
        clipBox.set(key, {
          x0: Math.min(...pts.map((p) => p.x)),
          x1: Math.max(...pts.map((p) => p.x)),
          y0: Math.min(...pts.map((p) => p.y)),
          y1: Math.max(...pts.map((p) => p.y)),
        });
      }
      const k = clipBox.get(key);
      box = box
        ? {
            x0: Math.max(box.x0, k.x0),
            x1: Math.min(box.x1, k.x1),
            y0: Math.max(box.y0, k.y0),
            y1: Math.min(box.y1, k.y1),
          }
        : k;
    }
    return box;
  };
  let left = null,
    right = null,
    top = null,
    bottom = null;
  root.querySelectorAll(SHAPES).forEach((el) => {
    if (el.closest("defs, mask, clipPath, symbol, pattern, marker")) return;
    if (!shown(el, root) || paintedOnlyWhite(el)) return;
    let b;
    try {
      b = el.getBBox();
    } catch {
      return;
    }
    if (!b.width && !b.height) return;
    let pts = corners(el, b);
    const k = clipOf(el);
    if (k) {
      pts = pts.map((p) => ({
        x: Math.min(k.x1, Math.max(k.x0, p.x)),
        y: Math.min(k.y1, Math.max(k.y0, p.y)),
      }));
      const xs = pts.map((p) => p.x),
        ys = pts.map((p) => p.y);
      if (
        Math.max(...xs) - Math.min(...xs) < 1e-6 &&
        Math.max(...ys) - Math.min(...ys) < 1e-6
      )
        return;
    }
    pts.map(turned).forEach((p) => {
      if (!left || p.x < left.x) left = p;
      if (!right || p.x > right.x) right = p;
      if (!top || p.y < top.y) top = p;
      if (!bottom || p.y > bottom.y) bottom = p;
    });
  });
  return left && { left, right, top, bottom };
}

// The leftmost and rightmost x of element el's box, in canvas units, after turning the canvas by `turn` degrees about (cx, cy)
export function turnedXRange(root, el, turn, cx, cy) {
  const toRoot = DOMMatrix.fromMatrix(root.getScreenCTM()).inverse(),
    ctm = DOMMatrix.fromMatrix(el.getScreenCTM()),
    b = el.getBBox(),
    r = (turn * Math.PI) / 180,
    xs = [
      [b.x, b.y],
      [b.x + b.width, b.y],
      [b.x + b.width, b.y + b.height],
      [b.x, b.y + b.height],
    ].map(([x, y]) => {
      const p = new DOMPoint(x, y).matrixTransform(ctm).matrixTransform(toRoot);
      return cx + (p.x - cx) * Math.cos(r) - (p.y - cy) * Math.sin(r);
    });
  return { x0: Math.min(...xs), x1: Math.max(...xs) };
}
