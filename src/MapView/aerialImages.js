// The Apple Maps basemap: the overview aerial and the close-up photos in map.svg, Apple Maps screenshots. They have a
// data-href and get their href the first time the basemap is shown, in the order below. Only one basemap shows at a
// time: these are hidden while an Esri one (esriTiles.js) is picked, whatever the zoom.

/** The photos (file names without .jpg), in the order they are added: the overview first. */
const DEFERRED = [
  "aerial-base", // 1.9 MB - the overview
  "aerial-zoom-9", // 68 KB - Fry's Corner
  "aerial-zoom-4", // 168 KB - Serpentine River
  "aerial-zoom-10", // 36 KB - Across from golf course
  "aerial-zoom-3", // 192 KB - Golf course
  "aerial-zoom-11", // 31 KB - Skinny strip at the bottom of the hill
  "aerial-zoom-6", // 81 KB - 80 Ave
  "aerial-zoom-8", // 68 KB - 168 St & Fraser Hwy
  "aerial-zoom-7", // 72 KB - Fortis Gas
  "aerial-zoom-5", // 90 KB - Bakerview 166 St
  "aerial-zoom-1", // 1.6 MB - SFMSF
  "aerial-zoom-2", // 753 KB - Hillcrest 184 St
];

let loaded = false;

/**
 * Shows or hides the Apple Maps photos, loading them in DEFERRED's order the first time they're shown.
 * @param {SVGSVGElement} root The map's <svg>.
 * @param {boolean} show Whether they show.
 * @returns {void}
 */
export function showAerialPhotos(root, show) {
  if (show && !loaded) {
    loaded = true;
    DEFERRED.forEach((name) => {
      const photo = root.querySelector(`image[data-href$="/${name}.jpg"]`);
      photo?.setAttribute("href", photo.dataset.href);
    });
  }
  // hidden, not taken out of the layout: the views are framed to the overview photo's outline (viewport.svelte.js), which
  // can't be measured with display: none
  root.querySelectorAll("image[data-href]").forEach((photo) => {
    photo.style.visibility = show ? "" : "hidden";
  });
}
