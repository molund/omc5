/**
 * @typedef {[key: string, label: string, cls: string, on: boolean]} LayerSwitch A layer switch: its key, the label shown
 * for it, its class in map.svg and whether it is on by default.
 */

/**
 * The layer switches in panel groups, as [group name, switches]. The View group comes first and is shown as radio
 * buttons: picking one switches the others off (see setSwitch in appState/appState.svelte.js).
 * @type {Array<[string, LayerSwitch[]]>}
 */
export const LAYERS = [
  [
    "View",
    [
      ["progress", "Progress", "progress", false],
      ["fullAerial", "Full aerial", "fullAerial", false],
      ["horizontal", "Horizontal aerial", "horizontal", false],
      ["sfmsfAerial", "SFMSF aerial", "sfmsfAerial", true],
      ["sfmsfDrawing", "SFMSF drawing", "sfmsfDrawing", false],
    ],
  ],
  [
    "Guideway",
    [
      ["gantry", "Gantry", "gantry", false],
      ["guideway", "Finished spans", "guideway", true],
      ["unfinished", "Unfinished spans", "unfinished", true],
      ["supports", "Supports", "supports", true],
      ["spanNumbers", "Span numbers", "ccnumber", true],
      ["arrows", "Direction arrows", "arrows", false],
      ["stationLabels", "Station labels", "stationlabel", true],
    ],
  ],
  [
    "Reference",
    [
      ["aerial", "Basemap", "aerial", true],
      ["greenbelt", "Greenbelt", "greenbelt", false],
      ["roads", "Roads", "roads", true],
      ["yard", "Construction yard", "yard", false],
      ["ave72", "Future 72 Ave", "ave72", false],
      ["creeks", "Creeks", "creeks", false],
      ["railway", "Old railway line", "railway", false],
      ["walk", "Walking paths", "walk-paths", false],
    ],
  ],
];
/**
 * The basemaps the Basemap switch's dropdown offers, as [key, label]: the Apple Maps photos (MapView/aerialImages.js)
 * and Esri's (SERVICES in MapView/esriTiles.js). One shows at a time. Every aerial view has the dropdown, and starts on
 * the basemap basemapFor gives it.
 * @type {Array<[string, string]>}
 */
export const BASEMAPS = [
  ["apple", "Apple"],
  ["streets", "Streets"],
  ["navigation", "Navigation"],
  ["aerial", "Esri aerial"],
  ["outdoor", "Outdoor"],
];
/** The basemap a view starts with, unless basemapFor says otherwise. */
export const DEFAULT_BASEMAP = "apple";
/**
 * The basemap a view starts with: Esri aerial in Full aerial and Horizontal aerial, Apple everywhere else.
 * @param {string} view A view's key.
 * @returns {string} A BASEMAPS key.
 */
export const basemapFor = (view) => (view === "fullAerial" || view === "horizontal" ? "aerial" : DEFAULT_BASEMAP);
/**
 * The normal view (the on-by-default column above), which Drawing mode returns to when it is switched off.
 * @type {Record<string, boolean>} Every switch's key and whether it is on.
 */
export const sfmsfAerialDefaults = {};
LAYERS.forEach((g) =>
  g[1].forEach((l) => {
    sfmsfAerialDefaults[l[0]] = l[3];
  }),
);
/**
 * "Full" is the earlier default: the whole canvas with roads off (Horizontal starts with these too).
 * @type {Record<string, boolean>}
 */
export const fullAerialDefaults = Object.assign({}, sfmsfAerialDefaults, {
  sfmsfAerial: false,
  roads: false,
  fullAerial: true,
});
/**
 * Switches that progress-chart mode starts with, which match what it shows: the Clayton Clipper's spans (finished and
 * unfinished) with their span numbers, the aerial photo and the full gantry. Every
 * switch works in it, as in Full image.
 * @type {Record<string, boolean>}
 */
export const PROGRESS_DEFAULTS = {
  guideway: true,
  unfinished: true,
  supports: false,
  aerial: true,
  yard: false,
  ave72: false,
  railway: false,
  spanNumbers: true,
  arrows: false,
  stationLabels: false,
  gantry: true,
};
/**
 * Opening view: Progress, as it is picked from the panel.
 * @type {Record<string, boolean>}
 */
export const defaults = Object.assign({}, fullAerialDefaults, PROGRESS_DEFAULTS, {
  progress: true,
  fullAerial: false,
});
/**
 * The colour of the Clayton Clipper's complete spans in progress-chart mode.
 */
export const PROGRESS_COLOUR = "#8473a8";
/**
 * Progress-chart mode's own CSS: it hides everything (with visibility, which leaves the masks and clip paths the drawing
 * relies on untouched) and then lets through what its switched-on layers show (see PROGRESS_SHOWS), so the base drawing,
 * which has no switch, stays hidden. The Clayton Clipper's complete spans are in the progress colour up to the gantry's span,
 * their usual colour past it, and its span numbers are white on the progress colour and as in the other views everywhere
 * else.
 */
const PROGRESS_CSS =
  "#map polygon,#map path,#map line,#map polyline,#map rect,#map circle,#map ellipse,#map text{visibility:hidden !important}" +
  "#map #aerial-backing,#map mask *,#map clipPath *,#map defs *{visibility:visible !important}" +
  "#map polygon.guideway.cc.reached:not(.unfinished){fill:" +
  PROGRESS_COLOUR +
  " !important}" +
  // white where the number sits on a span in the progress colour; every other number looks as it does in the other views
  "#map text.ccnumber.cc.on-reached{fill:#ffffff !important}" +
  // only the Clayton Clipper's spans: the other launchers' stay hidden
  "#map .ll.ll.ll,#map .ff.ff.ff{display:none !important}";
/**
 * What each switch shows in progress-chart mode, as CSS selectors (whether it shows is still up to the layer's own
 * display rule).
 * @type {Record<string, string[]>}
 */
const PROGRESS_SHOWS = {
  // finished spans, concrete and steel
  guideway: [".guideway"],
  unfinished: [".guideway.unfinished"],
  supports: ["rect.g", 'circle[fill="#D7D7D7"]'],
  yard: [".yard"],
  ave72: [".ave72"],
  railway: [".railway"],
  spanNumbers: [".ccnumber"],
  arrows: ["text.n.guideway"],
  stationLabels: [".stationlabel"],
  gantry: [".gantry"],
};
/** The whole canvas, as an SVG viewBox string. */
export const FULL_VB = "-6840.7 -5402.04 12387.4 8699.48";
/** Drawing mode's canvas: the first-photo frame (the area the greenbelt drawing fills). */
export const DRAW_VB = "-38.4 -126.95 2188.4 1888.55";
/** The SFMSF zoom view's canvas, the same frame as drawing mode: the right edge cuts through span A. */
export const SFMSF_AERIAL_VB = "-38.4 -126.95 2188.4 1888.55";
/** The length of the gantry's trusses, in canvas units. */
export const GANTRY_LENGTH = 401.56;
/**
 * Progress-chart mode zooms to the span the gantry is on: a view three gantry lengths wide, in canvas units.
 */
export const PROGRESS_VIEW_WIDTH = 3 * GANTRY_LENGTH;
/**
 * Where the span sits in progress-chart mode's view (35% of the way across and down), as fractions of the view's width
 * (from the left) and height (from the top).
 */
export const PROGRESS_SPAN_AT = { x: 0.35, y: 0.35 };
/**
 * The least far along the route progress-chart mode's canvas goes: it always takes in this span whole, so the spans well
 * ahead of the gantry (the "+8" in the figures) can be reached. It is a floor, not an edge: once the gantry gets past it
 * the canvas grows with the built spans. Delete it (and its rule in canvasProgress) once the gantry has crossed the
 * Serpentine River.
 */
export const PROGRESS_MIN_LAST_SPAN = 55;
/**
 * Horizontal's canvas is what is drawn with a margin on every side of this fraction of the straight-line distance between
 * its two ends.
 */
export const HORIZONTAL_MARGIN = 0.05;
/**
 * How far into the drawing Horizontal's canvas starts on the west, in canvas units: no margin there, and the westmost span
 * (the Fleetwood Flyer's, by Bakerview-166 Street Station) runs just off the edge.
 */
export const HORIZONTAL_WEST_TRIM = 4;
/** The drawing's scale: 3 units per metre, shown 1.11 times larger around SFMSF, so a span (about 134 units) is about 40 m. */
export const UNITS_PER_METRE = 3 * 1.11;
/** Horizontal starts zoomed to show this many metres before and after the gantry's span, with the span in the middle. */
export const HORIZONTAL_VIEW_METRES = 350;

/**
 * CSS for the Full image view, which draws the old railway line about 50% heavier: the line itself, and its cross ties
 * (dash) thicker on the same spacing. The original line is inside the 1.11x zoomed frame; its two extensions are in canvas
 * units, 1.11 times larger.
 */
export const FULL_AERIAL_CSS =
  "#nwsr-railway{stroke-width:3 !important}" +
  "#nwsr-railway-ties{stroke-dasharray:3 13 !important}" +
  "#railway-extension path:first-of-type,#railway-extension-north path:first-of-type{stroke-width:3.33 !important}" +
  "#railway-extension path:last-of-type,#railway-extension-north path:last-of-type{stroke-dasharray:3.33 14.43 !important}";

/**
 * Whether the span numbers can show: they need Clayton Clipper spans on screen, so Progress, or at least one type of span
 * on.
 * @param {Record<string, boolean>} state The switches' state.
 * @returns {boolean}
 */
export const spanNumbersAvailable = (state) => state.progress || state.guideway || state.unfinished;

/**
 * The CSS rules that show and hide the layers of map.svg for the given switch state.
 * @param {Record<string, boolean>} state The switches' state.
 * @returns {string} The CSS, to put in a <style> element.
 */
export function layerCss(state) {
  let r = "";
  const avail = spanNumbersAvailable(state);
  LAYERS.forEach((g) =>
    g[1].forEach(([k, , cls]) => {
      const on =
        state[k] &&
        !((k === "greenbelt" || k === "creeks") && !state.sfmsfDrawing) &&
        !(["roads", "yard", "walk"].includes(k) && !state.sfmsfDrawing && !state.sfmsfAerial) &&
        !(k === "aerial" && state.sfmsfDrawing) &&
        !(k === "stationLabels" && (state.sfmsfDrawing || state.sfmsfAerial)) &&
        !(k === "spanNumbers" && !avail);
      if (k === "progress" || k === "sfmsfDrawing" || k === "sfmsfAerial" || k === "fullAerial" || k === "horizontal")
        return;
      // roads: Fraser Highway and Highway 15, with their labels (every piece is tagged "roads")
      if (k === "roads") r += ".roads{display:" + (on ? "inline" : "none") + " !important}";
      else if (k === "spanNumbers") r += ".ccnumber{display:" + (on ? "inline" : "none") + " !important}";
      else if (k === "arrows") r += on ? "" : "text.n.guideway{display:none !important}";
      else if (k === "gantry") r += "";
      else if (k === "supports") r += on ? "" : 'rect.g,circle[fill="#D7D7D7"]{display:none !important}';
      else if (k === "unfinished") r += ".guideway.unfinished{display:" + (on ? "inline" : "none") + " !important}";
      // finished spans, concrete and steel alike
      else if (k === "guideway") r += ".guideway{display:" + (on ? "inline" : "none") + " !important}";
      else if (k === "yard") r += ".yard{display:" + (on ? "inline" : "none") + " !important}";
      else r += "." + cls + "{display:" + (on ? "inline" : "none") + " !important}";
    }),
  );
  // over the aerial photo (every view but SFMSF drawing), the unfinished spans are 45% opaque, so the finished ones stand out,
  // and an unfinished span's number is black with a white outline, so it reads on them
  if (state.aerial && !state.sfmsfDrawing)
    r +=
      "#map .guideway.unfinished{opacity:0.45 !important}" +
      "#map text.ccnumber.on-unfinished{fill:#000000 !important;stroke:#ffffff !important;stroke-width:1.5 !important;stroke-linejoin:round !important;paint-order:stroke !important}";
  r += ".gantry{display:" + (state.gantry ? "inline" : "none") + " !important}";
  if (state.progress) {
    r += PROGRESS_CSS;
    const shows = Object.keys(PROGRESS_SHOWS)
      .filter((k) => state[k])
      .flatMap((k) => PROGRESS_SHOWS[k])
      .flatMap((sel) => [`#map ${sel}`, `#map ${sel} *`]);
    if (shows.length) r += `${shows.join(",")}{visibility:visible !important}`;
  }
  r += 'polygon.ave72[fill="#FFFFFF"]{opacity:' + (state.greenbelt && state.sfmsfDrawing ? 1 : 0) + " !important}";
  return r;
}
