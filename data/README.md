# Fraser Highway SkyTrain guideway: supports and spans

Positions of the elevated guideway supports (pillars and bents) and spans of the Surrey Langley SkyTrain extension along
Fraser Highway in Surrey, BC, from 166 Street to 184 Street (about 4 km). This is an independent, unofficial dataset
compiled by Mike Olund. It is not from TransLink or the Province of BC.

| File                       | Contents                                                  |
| -------------------------- | --------------------------------------------------------- |
| `clipper-supports.geojson` | One point per support, at the centre of its pillar(s)     |
| `clipper-pillars.geojson`  | One point per pillar (column), where it stands            |
| `clipper-spans.geojson`    | One polygon per span deck (or per girder line, see below) |
| `control-points.json`      | The two measured points used to georeference the drawing  |
| `LICENSE`                  | CC0 1.0: public domain, no conditions                     |

Coordinates are WGS84 longitude/latitude (GeoJSON, RFC 7946). The files open directly in QGIS, ArcGIS, geojson.io,
Leaflet, Mapbox and Google Earth (import), and GitHub shows them on a map.

## How it was made

The supports and spans were traced on Apple Maps aerial imagery and checked on site visits, in the plan drawing that this
repository's site shows (`src/assets/plan.svg`). `scripts/export-geojson.js` converts the drawing to lon/lat.

Scale, rotation and position come from two tulip pillars measured by Mike Olund, one at each end of the line: where
Clayton Clipper spans 13 and 14 meet (near 182 Street) and where spans 92 and 93 meet (near 168 Street).

## Accuracy

Those two pillars are exact. Elsewhere, accuracy depends on how well the drawing matches the imagery it was traced on.
Support spacing and span lengths along the line are more accurate than the absolute position.

This is not survey data. Do not use it for engineering, construction or anything safety-related.

## Properties

### Supports

| Property      | Meaning                                                                             |
| ------------- | ----------------------------------------------------------------------------------- |
| `id`          | Sequential number from west to east (not an official pier number)                   |
| `pillars`     | Number of columns: 1 (single column or hammerhead) or 2 (two-column bent)           |
| `cap_bearing` | Direction of the long axis of the pier cap, in degrees clockwise from north (0–179) |
| `cc_joint`    | The pair of Clayton Clipper span numbers that meet on this support, e.g. `"34/35"`  |

### Pillars

| Property  | Meaning                                                             |
| --------- | ------------------------------------------------------------------- |
| `id`      | Sequential number from west to east                                 |
| `support` | The `id` of the support (in `clipper-supports.geojson`) it holds up |

Each pillar is placed carefully in the drawing. For a two-column bent, the support point is the midpoint between its
pillars, so use this file for where each column actually stands.

### Spans

| Property     | Meaning                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------ |
| `id`         | Sequential number from west to east                                                        |
| `kind`       | `segmental (gantry)`, `precast girder` or `steel girder`                                   |
| `cc_span`    | Clayton Clipper span number (1–105, counted in the order the launching gantry builds them) |
| `sfmsf_span` | Span label used near the SFMSF (letters A–S, numbers 1–11), where there is one             |

Some spans have more than one feature. Where the eastbound and westbound tracks are separate structures, each is its
own polygon with the same `cc_span`. Each steel span is drawn as its two girder lines.

Construction progress is not included, because it changes daily. The site built from this repository shows it.

## Updating

After changing the drawing, run `npm run export-geojson` and commit the regenerated files. The `metadata` block in each
file records the export date and the accuracy figures.
