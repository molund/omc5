// Write GeoJSON features as KML (for Google My Maps and Google Earth): one Placemark per feature, named for the span or
// joint it is, with its properties as data fields. Points and polygons only, which is all the exported layers use.
import fs from "node:fs";

// KML colours are aabbggrr hex
const STYLES = {
  // spans: finished ones in the drawing's grey (#888780), unfinished ones a pale outline, so they read on aerial imagery
  // without relying on hue. Finished spans are outlined in the drawing's darkest outline colour (#2C2C2A), 1.5 wide like the
  // unfinished ones. Google My Maps ignores the outline colour and draws the border in the fill colour at full strength, so
  // the finished fills are 75% opaque (bf), or their border wouldn't show there
  finished:
    "<PolyStyle><color>bf808788</color></PolyStyle><LineStyle><color>ff2a2c2c</color><width>1.5</width></LineStyle>",
  unfinished:
    "<PolyStyle><color>66ffffff</color></PolyStyle><LineStyle><color>ff4a4a4a</color><width>1.5</width></LineStyle>",
  // finished steel spans: the drawing's tan (#E3D3B2), 75% opaque and outlined like the other finished spans
  steel:
    "<PolyStyle><color>bfb2d3e3</color></PolyStyle><LineStyle><color>ff2a2c2c</color><width>1.5</width></LineStyle>",
  // supports: the pier caps, solid mid grey with a dark outline
  support:
    "<PolyStyle><color>ff8a8a8a</color></PolyStyle><LineStyle><color>ff222222</color><width>1</width></LineStyle>",
  // pillars: small dark circles
  Point:
    "<IconStyle><scale>0.6</scale><color>ff333333</color><Icon><href>https://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle><LabelStyle><scale>0</scale></LabelStyle>",
};

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const coords = (ring) => ring.map(([lon, lat]) => `${lon},${lat}`).join(" ");

function geometry(g) {
  if (g.type === "Point")
    return `<Point><coordinates>${coords([g.coordinates])}</coordinates></Point>`;
  if (g.type === "Polygon")
    return (
      "<Polygon>" +
      g.coordinates
        .map(
          (ring, i) =>
            `<${i ? "innerBoundaryIs" : "outerBoundaryIs"}><LinearRing><coordinates>${coords(ring)}</coordinates></LinearRing></${i ? "innerBoundaryIs" : "outerBoundaryIs"}>`,
        )
        .join("") +
      "</Polygon>"
    );
  throw new Error(`KML export: unsupported geometry ${g.type}`);
}

// the name shown on the map and in My Maps' list
function nameOf(p) {
  if ("cc_span" in p)
    return p.cc_span
      ? `Span ${p.cc_span}`
      : p.sfmsf_span
        ? `Span ${p.sfmsf_span}`
        : `Span #${p.id}`;
  if ("cc_joint" in p)
    return p.cc_joint ? `Support ${p.cc_joint}` : `Support #${p.id}`;
  return `Pillar #${p.id}`;
}

// spans by whether they are finished (spans exported without it count as finished), finished steel ones in their own colour;
// supports alike; points all alike
const styleOf = (p) =>
  "finished" in p || "cc_span" in p
    ? p.finished === false
      ? "unfinished"
      : p.kind === "steel girder"
        ? "steel"
        : "finished"
    : "cc_joint" in p
      ? "support"
      : "Point";

// one Placemark per line, so diffs show which features changed
export function writeKml(file, title, features, meta) {
  // the styles the layer's features use (the spans layer always has both finished and unfinished)
  const styles = [
    ...new Set(
      features.flatMap((f) =>
        "cc_span" in f.properties
          ? ["finished", "unfinished", styleOf(f.properties)]
          : [styleOf(f.properties)],
      ),
    ),
  ];
  const placemarks = features.map((f) => {
    const data = Object.entries(f.properties)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => `<Data name="${esc(k)}"><value>${esc(v)}</value></Data>`)
      .join("");
    return `<Placemark><name>${esc(nameOf(f.properties))}</name><styleUrl>#${styleOf(f.properties)}</styleUrl><ExtendedData>${data}</ExtendedData>${geometry(f.geometry)}</Placemark>`;
  });
  fs.writeFileSync(
    file,
    `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
<name>${esc(title)}</name>
<description>${esc(`${meta.source}.`)}</description>
${styles.map((id) => `<Style id="${id}">${STYLES[id]}</Style>`).join("\n")}
${placemarks.join("\n")}
</Document></kml>
`,
  );
}
