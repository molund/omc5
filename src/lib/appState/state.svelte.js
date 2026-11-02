import { saved } from "./persist.svelte.js";
import { defaults } from "../layerSwitches.js";

// Layer switches, keyed as in LAYERS (saved ones only for switches that still exist)
export const layers = $state({
  ...defaults,
  ...Object.fromEntries(
    Object.entries(saved?.layers ?? {}).filter(([k]) => k in defaults),
  ),
});
// Screens this narrow are phones: the layer panel is a menu that slides in over the map
export const PHONE =
  typeof matchMedia !== "undefined"
    ? matchMedia("(max-width: 760px)")
    : {
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      };
// zoom is a percentage of the stage width, and fit the zoom at which the whole canvas fits the stage; ready turns on the layer
// rules once map.svg is tagged; gantry is the Clayton Clipper's span number out of the total; phone is PHONE, kept up to
// date by App.svelte; collapsed hides the panel (a phone opens on the map, with the menu closed); changed is whether a layer
// switch has been changed since the view was picked or reset, which is when Reset has something to do; filled is whether the
// map is at a view's opening fill (see fillView); cardHidden is whether
// the progress card is closed (an information button, in every view, brings it back; it opens by itself only on the Progress
// view, and closes when another view is picked); layersOpen is whether the layer switches are
// folded out under Layers in the panel (folded away when the page opens, unless it is a reload)
// the view last picked (a View group key), which stays put while layers are switched on and off
const view =
  saved?.view ??
  (defaults.progress
    ? "progress"
    : defaults.sfmsfDrawing
      ? "sfmsfDrawing"
      : "sfmsfAerial");
export const ui = $state({
  view,
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
// The stage and the <svg>, set by MapView.svelte when it mounts, with the middle of the span the gantry is on (canvas units), the
// group that turns the whole drawing (#map-turn) and the turn that levels the Clayton Clipper route (degrees)
export const els = {
  stage: null,
  svg: null,
  gantrySpanCentre: null,
  turn: null,
  routeAngle: 0,
};
