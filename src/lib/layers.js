// Layer switches: [key, label, class in plan.svg, on by default], in panel groups. The View group comes first and
// is shown as radio buttons: picking one switches the others off (see toggle in state.svelte.js)
export const LAYERS = [
  [
    "View",
    [
      ["progress", "Progress", "progress", false],
      ["view_default", "Full image", "view_default", false],
      ["sfzoom", "SFMSF aerial", "sfzoom", true],
      ["drawing", "SFMSF drawing", "drawing", false],
      ["horizontal", "Horizontal", "horizontal", false],
    ],
  ],
  [
    "Guideway",
    [
      ["guideway", "Finished concrete spans", "guideway", true],
      ["steel", "Finished steel spans", "steel-hwy15", true],
      ["unfinished", "Unfinished spans", "unfinished", true],
      ["supports", "Supports", "supports", true],
    ],
  ],
  [
    "Base",
    [
      ["aerial", "Aerial photo", "aerial", true],
      ["roads", "Roads", "roads", true],
      ["yard", "Construction yard", "yard", false],
      ["ave72", "Future 72 Ave", "ave72", false],
      ["greenbelt", "Greenbelt", "greenbelt", false],
      ["creeks", "Creeks", "creeks", false],
      ["railway", "Old railway line", "railway", false],
      ["walk", "Walking paths", "walk-paths", false],
    ],
  ],
  [
    "Gantry",
    [
      ["gantry", "Full gantry", "gantry", false],
      ["beams", "Support beams only", "gantry-beams", false],
    ],
  ],
  [
    "Labels",
    [
      ["labels", "SFMSF span labels", "spanlabel", true],
      ["cclabels", "Clayton Clipper span labels", "cclabel", false],
      ["roadlabels", "Highway labels", "road-labels", false],
      ["arrows", "SkyTrain direction arrows", "arrows", false],
    ],
  ],
  [
    "Built by",
    [
      ["cc", "Clayton Clipper", "cc", true],
      ["ll", "Langley Launcher", "ll", true],
      ["ff", "Fleetwood Flyer", "ff", true],
    ],
  ],
];
// The normal view (the on-by-default column above), which Drawing mode returns to when it is switched off
export const normalDefaults = {};
LAYERS.forEach((g) =>
  g[1].forEach((l) => {
    normalDefaults[l[0]] = l[3];
  }),
);
// "Full" is the earlier default: the whole canvas with roads and the SFMSF labels off
export const fullDefaults = Object.assign({}, normalDefaults, {
  sfzoom: false,
  roads: false,
  labels: false,
  view_default: true,
});
// Switches that progress-chart mode starts with, which match what it shows: the Clayton Clipper's spans (finished, steel and
// unfinished) with their span numbers, the aerial photo and the full gantry. Every switch works in it, as in Full image.
export const PROGRESS_DEFAULTS = {
  guideway: true,
  steel: true,
  unfinished: true,
  supports: false,
  aerial: true,
  yard: false,
  ave72: false,
  railway: false,
  labels: false,
  cclabels: true,
  roadlabels: false,
  arrows: false,
  gantry: true,
  beams: false,
  cc: true,
  ll: false,
  ff: false,
};
// Opening view: Progress, as it is picked from the panel
export const defaults = Object.assign({}, fullDefaults, PROGRESS_DEFAULTS, {
  progress: true,
  view_default: false,
});
// violet: opposite the gantry's yellow on the colour wheel, so it stands out and goes with it
export const PROGRESS_COLOUR = "#6D28D9";
// Progress-chart mode hides everything (with visibility, which leaves the masks and clip paths the drawing relies on untouched)
// and then lets through what its switched-on layers show (PROGRESS_SHOWS), so the base drawing, which has no switch, stays hidden.
// The Clayton Clipper's finished spans are violet up to the span the gantry has reached, their usual colour past it, and its
// span numbers are black, or white on violet.
const PROGRESS_CSS =
  "#plan polygon,#plan path,#plan line,#plan polyline,#plan rect,#plan circle,#plan ellipse,#plan text{visibility:hidden !important}" +
  "#plan mask *,#plan clipPath *,#plan defs *{visibility:visible !important}" +
  "#plan polygon.guideway.cc.reached:not(.unfinished){fill:" +
  PROGRESS_COLOUR +
  " !important}" +
  "#plan text.cclabel.cc{fill:#000000 !important}" +
  // white where the number sits on a span in the progress colour
  "#plan text.cclabel.cc.on-reached{fill:#ffffff !important}" +
  // the SFMSF span labels' grey (unfinished spans) and default dark grey (the steel spans) in the same black
  '#plan text.spanlabel[style*="#767676"],#plan text.spanlabel:not([style*="fill"]){fill:#000000 !important}';
// what each switch shows in progress-chart mode (whether it shows is still up to the layer's own display rule)
const PROGRESS_SHOWS = {
  guideway: [".guideway"],
  steel: [".steel-hwy15"],
  unfinished: [".guideway.unfinished"],
  supports: ["rect.g", 'circle[fill="#D7D7D7"]'],
  yard: [".yard"],
  ave72: [".ave72"],
  railway: [".railway"],
  labels: [".spanlabel"],
  cclabels: [".cclabel"],
  roadlabels: [".road.hwy15", ".road.fraser"],
  arrows: ["text.n.guideway"],
  gantry: [".gantry"],
  beams: [".gantry"],
};
// Drawing mode shrinks the canvas to the first-photo frame (the area the greenbelt drawing fills)
export const FULL_VB = "-6840.7 -5402.04 12387.4 8699.48",
  DRAW_VB = "-38.4 -126.95 2188.4 1888.55",
  ZOOM_VB = "-38.4 -126.95 2188.4 1888.55"; // drawing mode and zoom view: the right edge cuts through span A
// Progress-chart mode zooms to the span the gantry is on: a view three gantry lengths wide (the gantry's trusses are 401.56
// canvas units long), with the span 35% of the way across and down
export const GANTRY_LENGTH = 401.56,
  PROGRESS_VIEW_WIDTH = 3 * GANTRY_LENGTH,
  // where the span sits in the view, as fractions of the view's width (from the left) and height (from the top)
  PROGRESS_SPAN_AT = { x: 0.35, y: 0.35 };
// Horizontal's canvas is what is drawn with a margin on every side of this fraction of the straight-line distance between its
// two ends
export const HORIZONTAL_MARGIN = 0.05;
// The drawing's scale: 3 units per metre, shown 1.11 times larger around SFMSF, so a span (about 134 units) is about 40 m
export const UNITS_PER_METRE = 3 * 1.11;
// Horizontal starts zoomed to show this many metres before and after the gantry's span, with the span in the middle
export const HORIZONTAL_VIEW_METRES = 350;

// Full image view draws the old railway line about 50% heavier: the line itself, and its cross ties (dash) thicker on the same
// spacing. The original line is inside the 1.11x zoomed frame; its two extensions are in canvas units, 1.11 times larger.
export const FULL_VIEW_CSS =
  "#nwsr-railway{stroke-width:3 !important}" +
  "#nwsr-railway-ties{stroke-dasharray:3 13 !important}" +
  "#railway-extension path:first-of-type,#railway-extension-north path:first-of-type{stroke-width:3.33 !important}" +
  "#railway-extension path:last-of-type,#railway-extension-north path:last-of-type{stroke-dasharray:3.33 14.43 !important}";

// the span-label options need Clayton Clipper spans on screen: Clayton Clipper on and at least one type of span on
export const labelsAvailable = (state) =>
  state.progress ||
  (state.cc && (state.guideway || state.steel || state.unfinished));

// The CSS rules that show and hide the layers of plan.svg for the given switch state
export function layerCss(state) {
  let r = "";
  const avail = labelsAvailable(state);
  LAYERS.forEach((g) =>
    g[1].forEach(([k, , cls]) => {
      const on =
        state[k] &&
        !((k === "greenbelt" || k === "creeks") && !state.drawing) &&
        !(
          ["roads", "walk", "roadlabels"].includes(k) &&
          !state.drawing &&
          !state.sfzoom
        ) &&
        !(k === "aerial" && state.drawing) &&
        !((k === "labels" || k === "cclabels") && !avail) &&
        !(k === "hires" && !state.aerial);
      if (
        k === "progress" ||
        k === "drawing" ||
        k === "sfzoom" ||
        k === "view_default" ||
        k === "horizontal"
      )
        return;
      if (k === "bg")
        r +=
          ".bg{visibility:" +
          (on ? "visible" : "hidden") +
          " !important}" +
          (on
            ? ""
            : ".bg.hwy15,.bg.ave72,.fraser{visibility:visible !important}");
      else if (k === "roads")
        r +=
          '.roads,.fraser,.hwy15,line[class="bg"]{display:' +
          (on ? "inline" : "none") +
          " !important}";
      else if (k === "labels")
        r +=
          ".spanlabel{display:" +
          (on ? "inline" : "none") +
          " !important}" +
          (on ? "" : ".spanlabel.steel-hwy15{display:none !important}");
      else if (k === "cclabels")
        r +=
          ".cclabel{display:" +
          (on ? "inline" : "none") +
          " !important}" +
          (on ? "" : ".cclabel.steel-hwy15{display:none !important}");
      else if (k === "cc" || k === "ll" || k === "ff")
        r += on
          ? ""
          : "#plan ." + k + "." + k + "." + k + "{display:none !important}";
      else if (k === "arrows")
        r += on ? "" : "text.n.guideway{display:none !important}";
      else if (k === "gantry" || k === "beams") r += "";
      else if (k === "supports")
        r += on ? "" : 'rect.g,circle[fill="#D7D7D7"]{display:none !important}';
      else if (k === "roadlabels")
        r +=
          ".road.hwy15,.road.fraser{display:" +
          (on ? "inline" : "none") +
          " !important}";
      else if (k === "unfinished")
        r +=
          ".guideway.unfinished{display:" +
          (on ? "inline" : "none") +
          " !important}";
      else if (k === "steel")
        r +=
          ".steel-hwy15,.guideway.steel-hwy15,.spanlabel.steel-hwy15,.cclabel.steel-hwy15{display:" +
          (on ? "inline" : "none") +
          " !important}";
      else if (k === "yard")
        r += ".yard{display:" + (on ? "inline" : "none") + " !important}";
      else
        r +=
          "." + cls + "{display:" + (on ? "inline" : "none") + " !important}";
    }),
  );
  r +=
    ".gantry{display:" +
    (state.gantry || state.beams ? "inline" : "none") +
    " !important}" +
    (state.gantry || !state.beams
      ? ""
      : ".gantry-body{display:none !important}");
  if (state.progress) {
    r += PROGRESS_CSS;
    const shows = Object.keys(PROGRESS_SHOWS)
      .filter((k) => state[k])
      .flatMap((k) => PROGRESS_SHOWS[k])
      .flatMap((sel) => [`#plan ${sel}`, `#plan ${sel} *`]);
    if (shows.length) r += `${shows.join(",")}{visibility:visible !important}`;
  }
  r +=
    'polygon.ave72[fill="#FFFFFF"]{opacity:' +
    (state.greenbelt && state.drawing ? 1 : 0) +
    " !important}";
  return r;
}
