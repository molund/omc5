/**
 * Sends a Google Analytics event, for what visitors do on the map and on Trackside (the page views come from the tag
 * itself, .google/gtag.html). Nothing is sent in `npm run dev`, which has no tag (vite.config.js adds it to the build
 * only), or in a browser with the opt-out cookie, which the tag turns off.
 * @param {string} name The event's name, e.g. "select_view".
 * @param {Record<string, string|number|boolean>} [params] Its parameters, each registered as a custom dimension in GA.
 * @returns {void}
 */
export function track(name, params = {}) {
  if (typeof window !== "undefined") window.gtag?.("event", name, params);
}

/**
 * The same event at most once per page load (a pinch or a touchpad zoom, say, which would otherwise send one per frame).
 * @param {string} name The event's name.
 * @param {Record<string, string|number|boolean>} [params] Its parameters; the first call's are the ones sent.
 * @returns {void}
 */
export function trackOnce(name, params = {}) {
  const key = `${name}|${JSON.stringify(params)}`;
  if (sent.has(key)) return;
  sent.add(key);
  track(name, params);
}
/** The events trackOnce has sent on this page load. */
const sent = new Set();
