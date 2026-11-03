// Only aerial-base.jpg (1.9 MB) has an href in map.svg; it loads with the page. The other aerial photos have a data-href and get
// their href once the page has loaded, in the order below.

/** The photos held back until the page has loaded (file names without .jpg), in the order they are added. */
const DEFERRED = [
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

/**
 * Gives the photos with a data-href their href, in DEFERRED's order, once the page has loaded.
 * @param {SVGSVGElement} root The map's <svg>.
 * @returns {void}
 */
export function loadAerialImages(root) {
  const add = () =>
    DEFERRED.forEach((name) => {
      const photo = root.querySelector(`image[data-href$="/${name}.jpg"]`);
      photo?.setAttribute("href", photo.dataset.href);
    });
  if (document.readyState === "complete") add();
  else addEventListener("load", add, { once: true });
}
