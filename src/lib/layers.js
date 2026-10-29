// Layer switches: [key, label, class in plan.svg, on by default], in panel groups
export const LAYERS = [
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
    "View",
    [
      ["sfzoom", "SFMSF zoom", "sfzoom", true],
      ["view_default", "Full", "view_default", false],
      ["progress", "Progress-chart mode", "progress", false],
      ["drawing", "Drawing mode", "drawing", false],
    ],
  ],
  [
    "Labels",
    [
      ["labels", "SFMSF span labels", "spanlabel", true],
      ["cclabels", "Clayton Clipper span labels", "cclabel", false],
      ["roadlabels", "Highway labels", "road-labels", false],
      ["arrows", "Direction arrows", "arrows", false],
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
// Opening view: Drawing mode as it is entered from the panel (every layer on except the aerial photo, the Clayton Clipper labels,
// the support beams, progress-chart mode and SFMSF zoom), with the old railway line also off
export const defaults = Object.fromEntries(
  Object.keys(normalDefaults).map((k) => [k, true]),
);
Object.assign(defaults, {
  aerial: false,
  cclabels: false,
  beams: false,
  progress: false,
  sfzoom: false,
  view_default: false,
  railway: false,
});
// "Full" is the earlier default: the whole canvas with roads and the SFMSF labels off
export const fullDefaults = Object.assign({}, normalDefaults, {
  sfzoom: false,
  roads: false,
  labels: false,
  view_default: true,
});
// Rows that stay at full strength in progress-chart mode
export const PROGRESS_ROWS = [
  "aerial",
  "hires",
  "cc",
  "ll",
  "ff",
  "progress",
  "drawing",
  "sfzoom",
  "view_default",
];
// Progress-chart mode: only the aerial photo, the Clayton Clipper finished spans (concrete and steel, in bright pink), the unfinished
// sections (still white) and the Clayton Clipper span labels (black) stay visible. Everything else is hidden with visibility, which
// leaves the masks and clip paths that the drawing relies on untouched.
const PROGRESS_CSS =
  "#plan polygon,#plan path,#plan line,#plan polyline,#plan rect,#plan circle,#plan ellipse,#plan text{visibility:hidden !important}" +
  "#plan mask *,#plan clipPath *,#plan defs *{visibility:visible !important}" +
  "#plan polygon.guideway.cc:not(.unfinished){visibility:visible !important;fill:#FF2E93 !important}" +
  "#plan polygon.guideway.unfinished,#plan path.guideway.unfinished{visibility:visible !important}" +
  "#plan text.cclabel.cc{visibility:visible !important;fill:#000000 !important}";
// Drawing mode shrinks the canvas to the first-photo frame (the area the greenbelt drawing fills)
export const FULL_VB = "-6840.7 -5402.04 12387.4 8699.48",
  DRAW_VB = "-38.4 -126.95 2188.4 1888.55",
  ZOOM_VB = "-38.4 -126.95 2188.4 1888.55"; // drawing mode and zoom view: the right edge cuts through span A

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
        !(k === "roads" && !state.drawing && !state.sfzoom) &&
        !(k === "aerial" && state.drawing) &&
        !((k === "labels" || k === "cclabels") && !avail) &&
        !(k === "hires" && !state.aerial);
      if (
        k === "progress" ||
        k === "drawing" ||
        k === "sfzoom" ||
        k === "view_default" ||
        (state.progress && !["aerial", "hires", "cc", "ll", "ff"].includes(k))
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
  if (state.progress) r += PROGRESS_CSS;
  r +=
    'polygon.ave72[fill="#FFFFFF"]{opacity:' +
    (state.greenbelt && state.drawing ? 1 : 0) +
    " !important}";
  return r;
}
