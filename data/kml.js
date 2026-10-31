// Write GeoJSON features as KML (for Google My Maps and Google Earth): one Placemark per feature, named for the span or
// joint it is, with its properties as data fields. Points and polygons only, which is all the exported layers use.
import fs from "node:fs";

// KML colours are aabbggrr hex
const STYLES = {
  // spans: the guideway grey of the site, mostly opaque, with a darker outline
  Polygon:
    "<PolyStyle><color>cc848a8b</color></PolyStyle><LineStyle><color>ff444444</color><width>1</width></LineStyle>",
  // supports and pillars: small dark circles
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

// one Placemark per line, so diffs show which features changed
export function writeKml(file, title, features, meta) {
  const type = features[0]?.geometry.type ?? "Point";
  const placemarks = features.map((f) => {
    const data = Object.entries(f.properties)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => `<Data name="${esc(k)}"><value>${esc(v)}</value></Data>`)
      .join("");
    return `<Placemark><name>${esc(nameOf(f.properties))}</name><styleUrl>#s</styleUrl><ExtendedData>${data}</ExtendedData>${geometry(f.geometry)}</Placemark>`;
  });
  fs.writeFileSync(
    file,
    `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
<name>${esc(title)}</name>
<description>${esc(`${meta.source}. Exported ${meta.exported}.`)}</description>
<Style id="s">${STYLES[type] ?? ""}</Style>
${placemarks.join("\n")}
</Document></kml>
`,
  );
}
