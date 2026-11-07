import { saved } from "./persist.svelte.js";
import { BASEMAPS, basemapFor, defaults } from "../layerSwitches.js";

/**
 * Layer switches, keyed as in LAYERS (saved ones only for switches that still exist).
 * @type {Record<string, boolean>}
 */
export const layers = $state({
  ...defaults,
  ...Object.fromEntries(Object.entries(saved?.layers ?? {}).filter(([k]) => k in defaults)),
});

/**
 * Screens this narrow are phones: the layer panel is a menu that slides in over the map.
 * @type {MediaQueryList | { matches: boolean, addEventListener: Function, removeEventListener: Function }}
 */
export const PHONE =
  typeof matchMedia !== "undefined"
    ? matchMedia("(max-width: 760px)")
    : {
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      };

/** The view last picked (a View group key), which stays put while layers are switched on and off. */
const view = saved?.view ?? (defaults.progress ? "progress" : defaults.sfmsfDrawing ? "sfmsfDrawing" : "sfmsfAerial");

/**
 * @typedef {object} GantryProgress
 * @property {number} span The Clayton Clipper's span number the gantry is on.
 * @property {number} ahead Spans ahead of the gantry that cranes have built.
 * @property {number} total The total number of spans.
 */

/**
 * The map's and panel's state.
 * @type {{
 *   view: string,
 *   basemap: string,
 *   span: number|null,
 *   zoom: number,
 *   fit: number,
 *   phone: boolean,
 *   collapsed: boolean,
 *   changed: boolean,
 *   cardHidden: boolean,
 *   layersOpen: boolean,
 *   filled: boolean,
 *   ready: boolean,
 *   gantry: GantryProgress|null,
 * }}
 * - view: the view last picked (a View group key).
 * - basemap: the basemap picked (a BASEMAPS key), shown while the Basemap switch (layers.aerial) is on.
 * - span: the span a ?span=N link opened the map on, until another view is picked.
 * - zoom: a percentage of the stage width; fit: the zoom at which the whole canvas fits the stage.
 * - phone: PHONE, kept up to date by App.svelte; collapsed: whether the panel is hidden (a phone opens on the map, with
 *   the menu closed).
 * - changed: whether a layer switch has been changed since the view was picked or reset, which is when Reset has something
 *   to do.
 * - cardHidden: whether the progress card is closed (an information button, in every view, brings it back; it opens by
 *   itself only on the Progress view, and closes when another view is picked).
 * - layersOpen: whether the layer switches are folded out under Layers in the panel (folded away when the page opens,
 *   unless it is a reload).
 * - filled: whether the map is at a view's opening fill (see fillView).
 * - ready: turns on the layer rules once map.svg is tagged.
 * - gantry: the Clayton Clipper's span number out of the total, and the spans ahead of it.
 */
export const ui = $state({
  view,
  basemap: BASEMAPS.some(([k]) => k === saved?.basemap) ? saved.basemap : basemapFor(view),
  span: null,
  zoom: 187.31,
  fit: 100,
  phone: PHONE.matches,
  collapsed: PHONE.matches,
  changed: saved?.changed ?? false,
  cardHidden: view !== "progress",
  layersOpen: saved?.layersOpen ?? false,
  filled: false,
  ready: false,
  gantry: null,
});

/**
 * The stage and the <svg>, set by MapView.svelte when it mounts.
 * @type {{
 *   stage: HTMLElement|null,
 *   svg: SVGSVGElement|null,
 *   gantrySpanCentre: { x: number, y: number }|null,
 *   turn: SVGGElement|null,
 *   routeAngle: number,
 * }}
 * - gantrySpanCentre: the middle of the span the gantry is on, in canvas units.
 * - turn: the group that turns the whole drawing (#map-turn).
 * - routeAngle: the turn that levels the Clayton Clipper route, in degrees.
 */
export const els = {
  stage: null,
  svg: null,
  gantrySpanCentre: null,
  turn: null,
  routeAngle: 0,
};
