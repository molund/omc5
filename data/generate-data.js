// Export the guideway supports and spans in src/assets/map.svg as GeoJSON (data/sls-hillcrest-to-bakerview-supports.geojson and
// data/sls-hillcrest-to-bakerview-spans.geojson), and the same as KML in data/kml/. Run with `npm run export-geojson` after changing the drawing.
// - Every shape is taken down to canvas units through its transforms (as getScreenCTM does in the browser), then to lon/lat
//   with a similarity transform (scale, turn, shift) to Web Mercator, the projection of the Apple Maps screenshots the
//   drawing is traced on, fitted to the measured pins in data/control-points.json.
// - Supports: each bent cap (rect.g) is one support, exported as the cap's outline; its pillars are the support circles inside
//   it (or nearest it).
// - Pillars: each support circle, exactly where it is drawn, with the id of its support.
// - Spans: the guideway polygons, numbered from the nearest Clayton Clipper (cclabel) and SFMSF (spanlabel) labels.
import fs from "node:fs";
import { XMLParser } from "fast-xml-parser";
import { writeKml } from "./kml.js";

const SVG = "src/assets/map.svg",
  CONTROL = "data/control-points.json",
  STATUS = "status.yaml",
  OUT = "data/sls-hillcrest-to-bakerview-",
  R = 6378137; // Web Mercator sphere radius

// 2D affine matrices as [a, b, c, d, e, f] (x' = a x + c y + e, y' = b x + d y + f), as in SVG
const mul = ([a1, b1, c1, d1, e1, f1], [a2, b2, c2, d2, e2, f2]) => [
  a1 * a2 + c1 * b2,
  b1 * a2 + d1 * b2,
  a1 * c2 + c1 * d2,
  b1 * c2 + d1 * d2,
  a1 * e2 + c1 * f2 + e1,
  b1 * e2 + d1 * f2 + f1,
];
const apply = ([a, b, c, d, e, f], [x, y]) => [
  a * x + c * y + e,
  b * x + d * y + f,
];
const ID = [1, 0, 0, 1, 0, 0];

function parseTransform(s) {
  let m = ID;
  for (const [, op, args] of (s || "").matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const v = args
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    if (op === "translate") m = mul(m, [1, 0, 0, 1, v[0], v[1] || 0]);
    else if (op === "scale") m = mul(m, [v[0], 0, 0, v[1] ?? v[0], 0, 0]);
    else if (op === "matrix") m = mul(m, v);
    else if (op === "rotate") {
      const r = (v[0] * Math.PI) / 180,
        [cx, cy] = [v[1] || 0, v[2] || 0];
      m = mul(m, [1, 0, 0, 1, cx, cy]);
      m = mul(m, [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]);
      m = mul(m, [1, 0, 0, 1, -cx, -cy]);
    } else throw new Error(`unsupported transform ${op}`);
  }
  return m;
}

// Every element as { tag, attrs, classes, ctm, parents (the ids and classes of the groups it is in), clips }. clips: the
// clip paths on the element and the groups it is in, each a list of canvas polygons (it shows only inside all of them).
function elements(xml) {
  const doc = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    preserveOrder: true,
    parseTagValue: false,
    parseAttributeValue: false,
  }).parse(xml);
  const tagOf = (n) => Object.keys(n).find((k) => k !== ":@");
  // clip path shapes by id, in the clip path's own units; null if it has a shape this can't follow
  const clipPaths = {};
  (function find(nodes) {
    for (const n of nodes) {
      const tag = tagOf(n),
        attrs = n[":@"] || {};
      if (tag === "clipPath")
        clipPaths[attrs.id] = n[tag]
          .filter((c) => !tagOf(c).startsWith("#"))
          .map((c) => ({
            tag: tagOf(c),
            attrs: c[":@"] || {},
            ctm: mul(
              parseTransform(attrs.transform),
              parseTransform((c[":@"] || {}).transform),
            ),
          }));
      else if (!tag.startsWith("#")) find(n[tag]);
    }
  })(doc);
  const out = [];
  (function walk(nodes, ctm, parents, clips) {
    for (const n of nodes) {
      const tag = tagOf(n);
      if (
        tag.startsWith("#") ||
        tag === "defs" ||
        tag === "clipPath" ||
        tag === "mask"
      )
        continue;
      const attrs = n[":@"] || {},
        m = mul(ctm, parseTransform(attrs.transform)),
        classes = (attrs.class || "").split(/\s+/).filter(Boolean),
        clip =
          clipPaths[
            (/url\(#([^)]+)\)/.exec(attrs["clip-path"] || "") || [])[1]
          ],
        polys = clip && clip.map((c) => outline({ ...c, ctm: mul(m, c.ctm) }));
      const own =
        polys && polys.every((p) => p && p.length > 2)
          ? [...clips, polys]
          : clips;
      const text =
        tag === "text"
          ? (n[tag].find((k) => "#text" in k) || {})["#text"]
          : undefined;
      out.push({ tag, attrs, classes, ctm: m, parents, text, clips: own });
      walk(n[tag], m, [...parents, { id: attrs.id, classes }], own);
    }
  })(doc, ID, [], []);
  return out;
}

const points = (s) =>
  s
    .trim()
    .split(/[\s,]+/)
    .map(Number)
    .reduce(
      (a, v, i) => (i % 2 ? (a[a.length - 1].push(v), a) : (a.push([v]), a)),
      [],
    );
const centroid = (ps) =>
  ps.reduce(
    ([x, y], [px, py]) => [x + px / ps.length, y + py / ps.length],
    [0, 0],
  );
const outline = (el) => {
  const { tag, attrs: a, ctm } = el;
  if (tag === "polygon") return points(a.points).map((p) => apply(ctm, p));
  if (tag === "rect") {
    const [x, y, w, h] = [+a.x || 0, +a.y || 0, +a.width, +a.height];
    return [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ].map((p) => apply(ctm, p));
  }
  if (tag === "circle") return [apply(ctm, [+a.cx || 0, +a.cy || 0])];
  return null;
};

const inGantry = (e) => e.parents.some((p) => p.id === "clayton-clipper");
const dist = ([x1, y1], [x2, y2]) => Math.hypot(x2 - x1, y2 - y1);
const nearest = (list, q, max) => {
  let best = null,
    d = max;
  for (const l of list)
    if (dist(l.q, q) < d) {
      d = dist(l.q, q);
      best = l;
    }
  return best;
};

// whether point q is inside polygon ps (even-odd)
const inside = (ps, [x, y]) =>
  ps.reduce((c, [x1, y1], i) => {
    const [x2, y2] = ps[(i + 1) % ps.length];
    return y1 > y !== y2 > y && x < x1 + ((y - y1) * (x2 - x1)) / (y2 - y1)
      ? !c
      : c;
  }, false);
// whether point q of element e is shown, not clipped away
const shown = (e, q) =>
  e.clips.every((polys) => polys.some((p) => inside(p, q)));

// Canvas to lon/lat. Canvas y points south, so points are taken as complex numbers x - iy.
function georeference(control) {
  const z = ([x, y]) => [x, -y],
    merc = ({ lon, lat }) => [
      (R * lon * Math.PI) / 180,
      R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)),
    ];
  // least squares for w = s z + t (s, t complex) over the pins (exact for two)
  const pins = control.pins,
    m = pins.map((p) => [z(p.canvas), merc(p)]),
    n = m.length,
    mean = (k, i) => m.reduce((a, p) => a + p[k][i], 0) / n,
    [zx, zy, wx, wy] = [mean(0, 0), mean(0, 1), mean(1, 0), mean(1, 1)];
  let re = 0,
    im = 0,
    zz = 0;
  for (const [[x, y], [u, v]] of m) {
    const [dx, dy, du, dv] = [x - zx, y - zy, u - wx, v - wy];
    re += du * dx + dv * dy;
    im += dv * dx - du * dy;
    zz += dx * dx + dy * dy;
  }
  const [sr, si] = [re / zz, im / zz],
    scaled = ([x, y]) => [sr * x - si * y, si * x + sr * y],
    [cx, cy] = scaled([zx, zy]),
    t = [wx - cx, wy - cy];
  const toMerc = (c) => {
      const [u, v] = scaled(z(c));
      return [u + t[0], v + t[1]];
    },
    toLonLat = (c) => {
      const [u, v] = toMerc(c);
      return [
        +((u / R) * (180 / Math.PI)).toFixed(7),
        +(
          (2 * Math.atan(Math.exp(v / R)) - Math.PI / 2) *
          (180 / Math.PI)
        ).toFixed(7),
      ];
    };
  return toLonLat;
}

function exportGeojson() {
  // everything but the gantry, and only what isn't clipped away (the drawing keeps shapes that run past the photo outline)
  const centre = (e) =>
      e.tag === "text"
        ? apply(e.ctm, [+e.attrs.x, +e.attrs.y])
        : outline(e) && centroid(outline(e)),
    els = elements(fs.readFileSync(SVG, "utf8")).filter(
      (e) => !inGantry(e) && (!centre(e) || shown(e, centre(e))),
    ),
    toLonLat = georeference(JSON.parse(fs.readFileSync(CONTROL, "utf8")));
  const labels = (cls) =>
    els
      .filter((e) => e.tag === "text" && e.classes.includes(cls))
      .map((e) => ({
        t: e.text.trim(),
        q: apply(e.ctm, [+e.attrs.x, +e.attrs.y]),
      }));
  const cc = labels("cclabel").map((l) => ({ ...l, n: +l.t })),
    sfmsf = labels("spanlabel");

  // supports: one per bent cap, with the pillar circles nearest it (shapes drawn twice in the same place count once)
  const once = (list) =>
    list.filter((a, i) => !list.slice(0, i).some((b) => dist(a.q, b.q) < 1));
  const caps = once(
    els
      .filter((e) => e.tag === "rect" && e.classes.includes("g"))
      .map((e) => ({ box: outline(e), q: centroid(outline(e)), pillars: [] })),
  );
  const pillars = once(
    els
      .filter((e) => e.tag === "circle" && e.attrs.fill === "#D7D7D7")
      .map((e) => ({ q: outline(e)[0] })),
  );
  for (const p of pillars) {
    p.cap = caps.find((c) => inside(c.box, p.q)) || nearest(caps, p.q, 60);
    if (p.cap) p.cap.pillars.push(p.q);
  }
  // the joint between spans n and n+1 is the cap nearest the midpoint of their labels (as in src/lib/placeGantry.js)
  for (const a of cc) {
    const b = cc.find((l) => l.n === a.n + 1);
    if (!b) continue;
    const cap = nearest(
      caps,
      [(a.q[0] + b.q[0]) / 2, (a.q[1] + b.q[1]) / 2],
      200,
    );
    if (cap) cap.joint = `${a.n}/${b.n}`;
  }
  const along = (q) => toLonLat(q)[0]; // west to east
  caps.sort((a, b) => along(a.q) - along(b.q));
  caps.forEach((c, i) => (c.id = i + 1));
  const supports = caps.map((c, i) => {
    const [p, r] = [c.box[0], c.box[1]],
      [q, s] = [c.box[1], c.box[2]],
      long = dist(p, r) > dist(q, s) ? [p, r] : [q, s],
      [a, b] = long.map(toLonLat),
      bearing =
        (Math.atan2(
          (b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180),
          b[1] - a[1],
        ) *
          180) /
        Math.PI;
    return feature(
      { type: "Polygon", coordinates: [[...c.box, c.box[0]].map(toLonLat)] },
      {
        id: i + 1,
        pillars: c.pillars.length,
        cap_bearing: Math.round(((bearing % 180) + 180) % 180),
        cc_joint: c.joint || null,
      },
    );
  });

  pillars.sort((a, b) => along(a.q) - along(b.q));
  const pillarFeatures = pillars.map((p, i) =>
    feature(
      { type: "Point", coordinates: toLonLat(p.q) },
      { id: i + 1, support: p.cap ? p.cap.id : null },
    ),
  );

  // spans: guideway polygons. finished: as drawn (not class "unfinished"), except the Clayton Clipper's gantry boxes, which
  // are finished behind the span in status.yaml, and on it once it is complete, as the site draws them
  const status = fs.readFileSync(STATUS, "utf8"),
    gantryAt = +(status.match(/^span:\s*(\d+)/m) || [])[1] || 0,
    gantryDone = /^complete:\s*true\b/m.test(status);
  const spans = els
    .filter((e) => e.tag === "polygon" && e.classes.includes("guideway"))
    .map((e) => {
      const ring = outline(e),
        q = centroid(ring),
        n = nearest(cc, q, 35),
        l = nearest(sfmsf, q, 35);
      return {
        q,
        geometry: {
          type: "Polygon",
          coordinates: [[...ring, ring[0]].map(toLonLat)],
        },
        properties: {
          kind: e.classes.includes("steel-hwy15")
            ? "steel girder"
            : e.classes.includes("gi") || e.classes.includes("p")
              ? "segmental (gantry)"
              : "precast girder",
          cc_span: n ? n.n : null,
          sfmsf_span: l ? l.t : null,
          finished:
            (e.classes.includes("gi") || e.classes.includes("p")) && n
              ? n.n < gantryAt || (n.n === gantryAt && gantryDone)
              : !e.classes.includes("unfinished"),
        },
      };
    })
    .sort((a, b) => along(a.q) - along(b.q))
    .map((s, i) => feature(s.geometry, { id: i + 1, ...s.properties }));

  const meta = {
    source:
      "Traced on aerial imagery and checked on site visits; see data/README.md",
  };
  write(`${OUT}supports.geojson`, supports, meta);
  write(`${OUT}pillars.geojson`, pillarFeatures, meta);
  write(`${OUT}spans.geojson`, spans, meta);
  // the same three layers as KML, one file each, so the spans can be re-imported into My Maps on their own
  fs.mkdirSync("data/kml", { recursive: true });
  writeKml(
    "data/kml/sls-hillcrest-to-bakerview-supports.kml",
    "SLS Hillcrest to Bakerview supports",
    supports,
    meta,
  );
  writeKml(
    "data/kml/sls-hillcrest-to-bakerview-pillars.kml",
    "SLS Hillcrest to Bakerview pillars",
    pillarFeatures,
    meta,
  );
  writeKml(
    "data/kml/sls-hillcrest-to-bakerview-spans.kml",
    "SLS Hillcrest to Bakerview spans",
    spans,
    meta,
  );
  console.log(
    `${supports.length} supports, ${pillarFeatures.length} pillars, ${spans.length} spans`,
  );
}

const feature = (geometry, properties) => ({
  type: "Feature",
  properties,
  geometry,
});
// one feature per line, so diffs show which features changed
function write(file, features, meta) {
  const head = JSON.stringify({
    type: "FeatureCollection",
    metadata: meta,
  }).slice(0, -1);
  fs.writeFileSync(
    file,
    `${head},"features":[\n${features.map((f) => JSON.stringify(f)).join(",\n")}\n]}\n`,
  );
}

exportGeojson();
