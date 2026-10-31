# Fraser Highway SkyTrain guideway: supports and spans

Positions of the elevated guideway supports (pillars and bents) and spans of the Surrey Langley SkyTrain extension along
Fraser Highway in Surrey, BC, from 166 Street to 184 Street (about 4 km). This is an independent, unofficial dataset
compiled by Mike Olund. It is not from TransLink or the Province of BC.

| File                       | Contents                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------- |
| `clipper-supports.geojson` | One point per support, at the centre of its pillar(s)                                  |
| `clipper-pillars.geojson`  | One point per pillar (column), where it stands                                         |
| `clipper-spans.geojson`    | One polygon per span deck (or per girder line, see below)                              |
| `control-points.json`      | The two control points used to georeference the drawing                                |
| `kml/`                     | The same three layers as KML, for Google My Maps and Google Earth (one file per layer) |
| `LICENSE`                  | CC0 1.0: public domain, no conditions                                                  |

Coordinates are WGS84 longitude/latitude (GeoJSON, RFC 7946). The files open directly in QGIS, ArcGIS, geojson.io,
Leaflet, Mapbox and Google Earth (import), and GitHub shows them on a map.

## How it was made

The supports and spans were traced on Apple Maps aerial imagery and checked on site visits, in the plan drawing that this
repository's site shows (`src/assets/plan.svg`). `data/generate-data.js` converts the drawing to lon/lat.

Scale, rotation and position come from two control points, one at each end of the line, placed by Mike Olund on very
high-resolution Apple Maps aerial imagery in the Maps app for macOS: where Clayton Clipper spans 13 and 14 meet (near 182
Street), matched to the finished tulip before the gantry reached it, and where spans 92 and 93 meet (near 168 Street),
matched to its foundation hole.

## Other sources

The GeoJSON files hold only the supports, pillars and spans. The plan drawing also shows roads, paths, a creek and a
historic railway line, which came from these sources:

- **Aerial imagery:** Apple Maps satellite screenshots, from a phone and a desktop. The site's background aerial is a
  desktop screenshot, also used for detailed pillar placement. Apple Maps was used instead of Google Maps because its
  imagery was more up to date at the time. Roads, paths and other background features were traced on it unless listed
  below.
- **Future 72 Avenue:** north of Fraser Highway, the City of Surrey's
  [West Clayton NCP](https://www.surrey.ca/renovating-building-development/land-planning-development/land-use-planning/cloverdale-land-use-plans/west-clayton-ncp)
  Stage 2 Land Use Concept; south of it, the City of Surrey's
  [72 Avenue Improvements & Extensions](https://www.surrey.ca/about-surrey/capital-projects/72-avenue-improvements-extensions)
  project website. The road classification layers in Surrey
  [COSMOS](https://www.surrey.ca/services-payments/online-services/maps-cosmos) (the City's web map) were a secondary
  check: slightly off, but within tolerance. The alignment used is the one most likely to meet span 29, which is the
  project website and NCP one.
- **Historic New Westminster Southern Railway (NWSR):** a Google My Maps KML of the railway's route,
  [NWSR GoogleMap](https://www.google.com/maps/d/edit?mid=ziHfaf3WSF4E.kWI_IGEKmEeI&usp=sharing), found through
  [New Westminster Southern Railway Survey](https://oppositethecity.wordpress.com/2014/02/12/new-westminster-southern-railway-survey/)
  on the blog _opposite the city_ (2014). The line was fitted to Harvie Road and Highway 15. A chain of park and
  greenbelt parcels in Surrey COSMOS follows the old route and agrees with it.

## Accuracy

The two control points (where spans 13 and 14 meet, and where spans 92 and 93 meet) are accurate to within
about a foot (0.3 m). Elsewhere,
accuracy depends on how well the drawing matches the imagery it was traced on. Support spacing and span lengths along the line are more accurate than the absolute position.

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

| Property     | Meaning                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| `id`         | Sequential number from west to east                                                                      |
| `kind`       | `segmental (gantry)`, `precast girder` or `steel girder`                                                 |
| `cc_span`    | Clayton Clipper span number (1–105, counted in the order the launching gantry builds them)               |
| `sfmsf_span` | Span label used near the SFMSF (letters A–S, numbers 1–11), where there is one                           |
| `finished`   | Whether the span is built, as of the export (in the KML, finished spans are solid, unfinished ones pale) |

Some spans have more than one feature. Where the eastbound and westbound tracks are separate structures, each is its
own polygon with the same `cc_span`. Each steel span is drawn as its two girder lines.

`finished` is only current as of the export. The copies published with the site, at https://molund.github.io/omc5/data/,
are regenerated on every update; the copies in this folder only when the export is run by hand.

## Updating

After changing the drawing, run `npm run export-geojson` and commit the regenerated files. The `metadata` block in each
file records the export date and the accuracy figures.
