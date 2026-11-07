// The Esri basemaps: Esri tiles (World Imagery for Esri aerial, Static Basemap Tiles for the rest) drawn as <image>s
// inside the map's <svg>, so they zoom, pan and turn with the drawing. Each tile is billed (2 million a month are
// free), so only tiles in view are asked for, once the map has settled, and each only once per page load, along with a
// few coarse backdrop tiles (see BACKDROP) that show until the sharp ones arrive. Tiles that can't be seen are hidden, not
// removed, so the map doesn't slow down as tiles build up and coming back to them is not billed again. Esri's terms don't
// allow keeping tiles, so they always load from Esri.
import control from "../../data/control-points.json";
import { georeference, R } from "../lib/georeference.js";
import { DEFAULT_BASEMAP } from "../lib/layerSwitches.js";

const IMAGERY = "https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer";
const STATIC = "https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis";
/** An ArcGIS API key, public by design: its allowed referrers, set in ArcGIS, are what protect it. */
const KEY =
  "AAPTaQydXhCJfzYtR1V05u_U17g..SUo-QEohH_HPHkQulltqIP5d6tCQYIw-sW-DfFxr0dtBmH7sbGY_vv5XK_qeqAeBHU1k8X6j6Lf1gstnLkMUdQPM_GM1qOdBO0ijaRooTAYilch7HfoGlekcVX9WztVWvNNOmemK8M0vVUFES4sZ6rFokMlO6WIAVuXC0jE-q2ye-nFRfF7CT1WbCfULrIc1NSLvDBnoNElMNAu9_uXMk7KKfSfBQ2Aqo5oKdVWFlkpmHg7rEgktAT1_Hury5EdV";
/** The closest level with the recent imagery at Surrey: level 20 and up is an older photo from before construction. */
const MAX_LEVEL = 19;
const MIN_LEVEL = 10;
/** Half the width of the Web Mercator world, in metres. */
const WORLD = Math.PI * R;
/** How long the map has to sit still before tiles are asked for, in milliseconds. */
const SETTLE = 150;
/** The most device pixels per CSS pixel worth paying tiles for. */
const MAX_PIXEL_RATIO = 2;
/** How many levels coarser than the current one the backdrop is: one of its tiles covers 8 × 8 of the current level's. */
const BACKDROP = 3;
/** How often tiles are hidden and shown again while the map moves, in milliseconds. */
const CULL_EVERY = 100;
const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * @typedef {object} TileService
 * @property {string} url The service, whose metadata has the data credit.
 * @property {string} tiles The path of its tiles under `url`.
 * @property {number} pixels A tile's width in pixels.
 * @property {number} maxLevel The closest level to ask for.
 * @property {string} credit The data credit Esri requires, for when the service's own can't be read.
 */

const ROAD_CREDIT =
  "Sources: Esri, TomTom, Garmin, FAO, NOAA, USGS, © OpenStreetMap contributors, and the GIS User Community";
/**
 * @param {string} style The style's name in Static Basemap Tiles.
 * @returns {TileService}
 */
const roadMap = (style) => ({
  url: `${STATIC}/${style}/static`,
  tiles: "/tile",
  pixels: 512,
  maxLevel: 22,
  credit: ROAD_CREDIT,
});
/**
 * The tile service of each basemap in BASEMAPS.
 * @type {Record<string, TileService>}
 */
const SERVICES = {
  aerial: {
    url: IMAGERY,
    tiles: "/tile",
    pixels: 256,
    maxLevel: MAX_LEVEL,
    credit: "Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community",
  },
  streets: roadMap("streets"),
  navigation: roadMap("navigation"),
  outdoor: roadMap("outdoor"),
};

/**
 * The credit to show for a basemap until its service's own has been read.
 * @param {string} basemap A basemap's key.
 * @returns {string} The credit.
 */
export const defaultCredit = (basemap) => SERVICES[basemap]?.credit ?? "";

/**
 * Whether a basemap is one of Esri's (the Apple Maps one isn't: see aerialImages.js).
 * @param {string} basemap A basemap's key.
 * @returns {boolean}
 */
export const isEsri = (basemap) => basemap in SERVICES;

/** The credits read so far, by basemap. */
const credits = new Map();
/**
 * A basemap's current data credit, read from its service, as Esri says it changes.
 * @param {string} basemap A basemap's key.
 * @returns {Promise<string>} The credit.
 */
export function esriCredit(basemap) {
  if (!credits.has(basemap))
    credits.set(
      basemap,
      fetch(`${SERVICES[basemap].url}?f=json&token=${KEY}`)
        .then((response) => response.json())
        .then((metadata) => metadata.copyrightText || defaultCredit(basemap))
        .catch(() => defaultCredit(basemap)),
    );
  return credits.get(basemap);
}

/**
 * Starts drawing the tiles that come into view.
 * @param {SVGSVGElement} svg The map's <svg>.
 * @param {HTMLElement} stage The element the map scrolls in.
 * @returns {{ setBasemap: (basemap: string) => void, stop: () => void }} `setBasemap` shows a basemap and looks again for
 * tiles (when the layers change); `stop` stops looking.
 */
export function startEsriTiles(svg, stage) {
  const { fromMerc, toMerc } = georeference(control),
    base = svg.querySelector("#baseoverview"),
    layer = document.createElementNS(SVG_NS, "g"),
    levels = new Map(),
    asked = new Set(),
    // each tile's four corners, in the layer's coordinates
    corners = new Map();
  let timer,
    cullTimer,
    basemap = DEFAULT_BASEMAP;
  layer.id = "esri-tiles";
  base.append(layer);

  // the group a level's tiles go in; closer levels are drawn over further ones
  const levelGroup = (level) => {
    if (!levels.has(basemap)) {
      const group = document.createElementNS(SVG_NS, "g");
      layer.append(group);
      levels.set(basemap, { group, levels: new Map() });
    }
    const { group: parent, levels: own } = levels.get(basemap);
    if (!own.has(level)) {
      const group = document.createElementNS(SVG_NS, "g"),
        next = [...own.keys()].filter((l) => l > level).sort((a, b) => a - b)[0];
      parent.insertBefore(group, next == null ? null : own.get(next));
      own.set(level, group);
    }
    return own.get(level);
  };

  const addTile = (level, x, y, size, service) => {
    const resolution = size / service.pixels,
      west = -WORLD + x * size,
      north = WORLD - y * size,
      [e, f] = fromMerc([west, north]),
      [ax, ay] = fromMerc([west + resolution, north]),
      [cx, cy] = fromMerc([west, north - resolution]),
      image = document.createElementNS(SVG_NS, "image");
    // a touch over a tile's size, so no hairlines show between tiles
    image.setAttribute("width", service.pixels + 0.5);
    image.setAttribute("height", service.pixels + 0.5);
    image.setAttribute("preserveAspectRatio", "none");
    image.setAttribute("decoding", "async");
    image.setAttribute("transform", `matrix(${ax - e} ${ay - f} ${cx - e} ${cy - f} ${e} ${f})`);
    image.setAttribute("href", `${service.url}${service.tiles}/${level}/${y}/${x}?token=${KEY}`);
    corners.set(
      image,
      [
        [west, north],
        [west + size, north],
        [west + size, north - size],
        [west, north - size],
      ].map(fromMerc),
    );
    levelGroup(level).append(image);
  };

  // the part of the screen the map shows, and how the layer maps to it; null when there's nothing to draw or pay for: the
  // basemaps are off, or the Apple Maps one is shown
  const view = () => {
    if (getComputedStyle(base).display === "none" || !isEsri(basemap)) return null;
    const s = stage.getBoundingClientRect(),
      box = svg.getBoundingClientRect(),
      left = Math.max(s.left, box.left),
      right = Math.min(s.right, box.right),
      top = Math.max(s.top, box.top),
      bottom = Math.min(s.bottom, box.bottom);
    if (left >= right || top >= bottom) return null;
    return { ctm: DOMMatrix.fromMatrix(layer.getScreenCTM()), left, right, top, bottom };
  };

  // the level whose pixels best match the screen's
  const levelFor = (ctm) => {
    const service = SERVICES[basemap],
      [ox, oy] = fromMerc([0, 0]),
      [ux, uy] = fromMerc([1, 0]),
      canvasPerMetre = Math.hypot(ux - ox, uy - oy),
      cssPerCanvas = Math.hypot(ctm.a, ctm.b),
      pixelsPerCanvas = cssPerCanvas * Math.min(devicePixelRatio || 1, MAX_PIXEL_RATIO);
    return Math.max(
      MIN_LEVEL,
      Math.min(
        service.maxLevel,
        Math.round(Math.log2((2 * WORLD * canvasPerMetre * pixelsPerCanvas) / service.pixels)),
      ),
    );
  };

  // asks for a level's tiles in view, and `margin` tiles past it on every side
  const ask = ({ ctm, left, right, top, bottom }, level, margin) => {
    const service = SERVICES[basemap],
      toCanvas = ctm.inverse(),
      size = (2 * WORLD) / 2 ** level,
      screen = ([x, y]) => new DOMPoint(x, y).matrixTransform(ctm),
      viewCorners = [
        [left, top],
        [right, top],
        [right, bottom],
        [left, bottom],
      ].map(([x, y]) => {
        const p = new DOMPoint(x, y).matrixTransform(toCanvas);
        return toMerc([p.x, p.y]);
      }),
      us = viewCorners.map((c) => c[0]),
      vs = viewCorners.map((c) => c[1]),
      x0 = Math.floor((Math.min(...us) + WORLD) / size) - margin,
      x1 = Math.floor((Math.max(...us) + WORLD) / size) + margin,
      y0 = Math.floor((WORLD - Math.max(...vs)) / size) - margin,
      y1 = Math.floor((WORLD - Math.min(...vs)) / size) + margin;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const id = `${basemap}/${level}/${y}/${x}`;
        if (asked.has(id)) continue;
        // when the drawing is turned, some of that box is out of view
        const points = [
          [x, y],
          [x + 1, y],
          [x + 1, y + 1],
          [x, y + 1],
        ].map(([tx, ty]) => screen(fromMerc([-WORLD + tx * size, WORLD - ty * size])));
        const px = points.map((p) => p.x),
          py = points.map((p) => p.y),
          pad = margin * Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
        if (
          Math.max(...px) < left - pad ||
          Math.min(...px) > right + pad ||
          Math.max(...py) < top - pad ||
          Math.min(...py) > bottom + pad
        )
          continue;
        asked.add(id);
        addTile(level, x, y, size, service);
      }
  };

  // hides what can't be seen: levels finer than the current one, and tiles more than a screen out of view. Coarser levels
  // stay, as what shows until the current level's tiles arrive. No tile is asked for here, so this costs nothing to run while
  // the map moves.
  const cull = () => {
    const shown = view(),
      own = levels.get(basemap)?.levels;
    if (!shown || !own) return;
    const { ctm, left, right, top, bottom } = shown,
      level = levelFor(ctm),
      padX = right - left,
      padY = bottom - top;
    own.forEach((group, l) => {
      group.style.display = l > level ? "none" : "";
      if (l > level) return;
      for (const image of group.children) {
        const points = corners.get(image).map(([x, y]) => new DOMPoint(x, y).matrixTransform(ctm)),
          px = points.map((p) => p.x),
          py = points.map((p) => p.y),
          far =
            Math.max(...px) < left - padX ||
            Math.min(...px) > right + padX ||
            Math.max(...py) < top - padY ||
            Math.min(...py) > bottom + padY,
          display = far ? "none" : "";
        if (image.style.display !== display) image.style.display = display;
      }
    });
  };

  const update = () => {
    const shown = view();
    if (!shown) return;
    const level = levelFor(shown.ctm),
      backdrop = Math.max(MIN_LEVEL, level - BACKDROP);
    // the backdrop first, so it arrives first; with a tile to spare on every side, it also covers about a screen around the view
    if (backdrop < level) ask(shown, backdrop, 1);
    ask(shown, level, 0);
    cull();
  };

  const refresh = () => {
    clearTimeout(timer);
    timer = setTimeout(update, SETTLE);
    // tiles seen before come back while the map moves, without waiting for it to settle
    cullTimer ??= setTimeout(() => {
      cullTimer = null;
      cull();
    }, CULL_EVERY);
  };
  stage.addEventListener("scroll", refresh, { passive: true });
  const resize = new ResizeObserver(refresh);
  resize.observe(stage);
  // a zoom changes the <svg>'s style, a view its viewBox and the turn
  const changes = new MutationObserver(refresh);
  changes.observe(svg, { attributes: true, attributeFilter: ["style", "viewBox"] });
  changes.observe(svg.querySelector("#map-turn"), { attributes: true, attributeFilter: ["transform"] });
  refresh();
  return {
    setBasemap(next) {
      basemap = next;
      levels.forEach(({ group }, key) => (group.style.display = key === basemap ? "" : "none"));
      // a basemap shown for the first time gets its group when its first tile is added
      refresh();
    },
    stop() {
      clearTimeout(timer);
      clearTimeout(cullTimer);
      stage.removeEventListener("scroll", refresh);
      resize.disconnect();
      changes.disconnect();
    },
  };
}
