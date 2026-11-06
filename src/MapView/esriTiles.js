// The base aerial: Esri World Imagery tiles drawn as <image>s inside the map's <svg>, so they zoom, pan and turn with the
// drawing. Each tile is billed (2 million a month are free), so only tiles in view are asked for, once the map has settled,
// and each only once per page load. Esri's terms don't allow keeping tiles, so they always load from Esri.
import control from "../../data/control-points.json";
import { georeference, R } from "../lib/georeference.js";
import { showAerialPhotos } from "./aerialImages.js";

const SERVICE = "https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer";
/** An ArcGIS API key, public by design: its allowed referrers, set in ArcGIS, are what protect it. */
const KEY =
  "AAPTaQydXhCJfzYtR1V05u_U17g..SUo-QEohH_HPHkQulltqIP5d6tCQYIw-sW-DfFxr0dtBmH7sbGY_vv5XK_qeqAeBHU1k8X6j6Lf1gstnLkMUdQPM_GM1qOdBO0ijaRooTAYilch7HfoGlekcVX9WztVWvNNOmemK8M0vVUFES4sZ6rFokMlO6WIAVuXC0jE-q2ye-nFRfF7CT1WbCfULrIc1NSLvDBnoNElMNAu9_uXMk7KKfSfBQ2Aqo5oKdVWFlkpmHg7rEgktAT1_Hury5EdV";
/** The closest level with the recent imagery at Surrey: level 20 and up is an older photo from before construction. */
const MAX_LEVEL = 19;
const MIN_LEVEL = 10;
const TILE = 256;
/** Half the width of the Web Mercator world, in metres. */
const WORLD = Math.PI * R;
/** How long the map has to sit still before tiles are asked for, in milliseconds. */
const SETTLE = 150;
/** The most device pixels per CSS pixel worth paying tiles for. */
const MAX_PIXEL_RATIO = 2;
const SVG_NS = "http://www.w3.org/2000/svg";

/** The credit Esri requires for the imagery, for when the service's own can't be read. */
export const DEFAULT_CREDIT = "Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community";

/**
 * The service's current data credit, which Esri says changes.
 * @returns {Promise<string>} The credit.
 */
export async function esriCredit() {
  try {
    const response = await fetch(`${SERVICE}?f=json&token=${KEY}`);
    return (await response.json()).copyrightText || DEFAULT_CREDIT;
  } catch {
    return DEFAULT_CREDIT;
  }
}

/**
 * Starts drawing the tiles that come into view.
 * @param {SVGSVGElement} svg The map's <svg>.
 * @param {HTMLElement} stage The element the map scrolls in.
 * @returns {{ refresh: () => void, stop: () => void }} `refresh` looks again (when the layers change); `stop` stops looking.
 */
export function startEsriTiles(svg, stage) {
  const { fromMerc, toMerc } = georeference(control),
    base = svg.querySelector("#baseoverview"),
    layer = document.createElementNS(SVG_NS, "g"),
    levels = new Map(),
    asked = new Set();
  let timer;
  layer.id = "esri-tiles";
  base.append(layer);

  // the group a level's tiles go in; closer levels are drawn over further ones
  const levelGroup = (level) => {
    if (!levels.has(level)) {
      const group = document.createElementNS(SVG_NS, "g"),
        next = [...levels.keys()].filter((l) => l > level).sort((a, b) => a - b)[0];
      layer.insertBefore(group, next == null ? null : levels.get(next));
      levels.set(level, group);
    }
    return levels.get(level);
  };

  const addTile = (level, x, y, size, resolution) => {
    const west = -WORLD + x * size,
      north = WORLD - y * size,
      [e, f] = fromMerc([west, north]),
      [ax, ay] = fromMerc([west + resolution, north]),
      [cx, cy] = fromMerc([west, north - resolution]),
      image = document.createElementNS(SVG_NS, "image");
    // a touch over a tile's size, so no hairlines show between tiles
    image.setAttribute("width", TILE + 0.5);
    image.setAttribute("height", TILE + 0.5);
    image.setAttribute("preserveAspectRatio", "none");
    image.setAttribute("transform", `matrix(${ax - e} ${ay - f} ${cx - e} ${cy - f} ${e} ${f})`);
    image.setAttribute("href", `${SERVICE}/tile/${level}/${y}/${x}?token=${KEY}`);
    levelGroup(level).append(image);
  };

  const update = () => {
    // nothing to pay for while the aerial layer is off
    if (getComputedStyle(base).display === "none") return;
    const ctm = DOMMatrix.fromMatrix(layer.getScreenCTM()),
      toCanvas = ctm.inverse(),
      s = stage.getBoundingClientRect(),
      box = svg.getBoundingClientRect(),
      left = Math.max(s.left, box.left),
      right = Math.min(s.right, box.right),
      top = Math.max(s.top, box.top),
      bottom = Math.min(s.bottom, box.bottom);
    if (left >= right || top >= bottom) return;

    // the level whose pixels best match the screen's
    const [ox, oy] = fromMerc([0, 0]),
      [ux, uy] = fromMerc([1, 0]),
      canvasPerMetre = Math.hypot(ux - ox, uy - oy),
      levelFor = (pixelsPerCanvas) => Math.round(Math.log2((2 * WORLD * canvasPerMetre * pixelsPerCanvas) / TILE)),
      cssPerCanvas = Math.hypot(ctm.a, ctm.b),
      level = Math.max(
        MIN_LEVEL,
        Math.min(MAX_LEVEL, levelFor(cssPerCanvas * Math.min(devicePixelRatio || 1, MAX_PIXEL_RATIO))),
      );
    // in CSS pixels, so a sharper screen doesn't swap to the older photos any sooner
    showAerialPhotos(svg, levelFor(cssPerCanvas) > MAX_LEVEL);

    const size = (2 * WORLD) / 2 ** level,
      resolution = size / TILE,
      screen = ([x, y]) => new DOMPoint(x, y).matrixTransform(ctm),
      corners = [
        [left, top],
        [right, top],
        [right, bottom],
        [left, bottom],
      ].map(([x, y]) => {
        const p = new DOMPoint(x, y).matrixTransform(toCanvas);
        return toMerc([p.x, p.y]);
      }),
      us = corners.map((c) => c[0]),
      vs = corners.map((c) => c[1]),
      x0 = Math.floor((Math.min(...us) + WORLD) / size),
      x1 = Math.floor((Math.max(...us) + WORLD) / size),
      y0 = Math.floor((WORLD - Math.max(...vs)) / size),
      y1 = Math.floor((WORLD - Math.min(...vs)) / size);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const id = `${level}/${y}/${x}`;
        if (asked.has(id)) continue;
        // when the drawing is turned, some of that box is out of view
        const points = [
          [x, y],
          [x + 1, y],
          [x + 1, y + 1],
          [x, y + 1],
        ].map(([tx, ty]) => screen(fromMerc([-WORLD + tx * size, WORLD - ty * size])));
        const px = points.map((p) => p.x),
          py = points.map((p) => p.y);
        if (Math.max(...px) < left || Math.min(...px) > right || Math.max(...py) < top || Math.min(...py) > bottom)
          continue;
        asked.add(id);
        addTile(level, x, y, size, resolution);
      }
  };

  const refresh = () => {
    clearTimeout(timer);
    timer = setTimeout(update, SETTLE);
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
    refresh,
    stop() {
      clearTimeout(timer);
      stage.removeEventListener("scroll", refresh);
      resize.disconnect();
      changes.disconnect();
    },
  };
}
