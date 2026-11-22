// Comments on updates: one GitHub Discussion per update, through giscus. Shared by the progress card and the Trackside
// page: each update's page anchor and thread title, and the comment and reaction counts of every thread.

/**
 * The site's public address, for links that leave it: the comment threads' bodies and the Open Graph tags.
 * @type {string}
 */
export const SITE = "https://clayton-clipper.olund.ca/";

/**
 * An update's id on the Trackside page, from its time stamp in UTC, e.g. "2026-10-31T16-30".
 * @param {Date} t The update's time stamp.
 * @returns {string}
 */
export const anchor = (t) => t.toISOString().slice(0, 16).replace(/:/g, "-");

/**
 * An update's thread title, its BC time (UTC−7), e.g. "Update 2026-10-31 09:30". The title must never change, or the
 * thread is lost; trackside/prerender.js gives the comment threads these titles.
 * @param {Date} t The update's time stamp.
 * @returns {string}
 */
export const term = (t) =>
  "Update " +
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Dawson_Creek",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(t)
    .replace(",", "");

/** GitHub's reaction names and the emoji shown for them, in the order they are listed. */
const EMOJI = {
  "+1": "👍",
  "-1": "👎",
  laugh: "😄",
  hooray: "🎉",
  confused: "😕",
  heart: "❤️",
  rocket: "🚀",
  eyes: "👀",
};

/**
 * @typedef {object} ThreadCounts
 * @property {number} comments How many comments the thread has.
 * @property {Array<[string, number]>} reactions The reactions with at least one vote, as [emoji, count] pairs.
 */

/**
 * Comment and reaction counts for every thread, from GitHub's public API (no login; 60 requests an hour per visitor).
 * One request only: GitHub's first 100 threads (the deploy workflow fails once the category reaches 100, as a reminder
 * to rethink this).
 * @returns {Promise<Record<string, ThreadCounts>>} The counts by thread title (see {@link term}); empty if GitHub can't
 * be reached.
 */
export function fetchCounts() {
  return fetch("https://api.github.com/repos/molund/omc5/discussions?per_page=100", {
    headers: { Accept: "application/vnd.github+json" },
  })
    .then((r) => (r.ok ? r.json() : []))
    .then((list) => {
      const out = {};
      list.forEach((d) => {
        out[d.title] = {
          comments: d.comments,
          reactions: Object.keys(EMOJI)
            .filter((k) => d.reactions?.[k] > 0)
            .map((k) => [EMOJI[k], d.reactions[k]]),
        };
      });
      return out;
    })
    .catch(() => ({}));
}

/**
 * Remark42, the self-hosted comments being tried out (comments.olund.ca, on a Google Cloud e2-micro): its address and
 * site ID (the server's SITE).
 */
export const REMARK42 = { host: "https://comments.olund.ca", site: "trackside" };

/**
 * The updates whose comments use Remark42 instead of giscus while it's tried out, by slug. A thread is the update's own
 * page (/trackside/<slug>/), so it's the same thread on every page that shows the update.
 * @type {Set<string>}
 */
export const REMARK42_SLUGS = new Set(["construction-update-for-friday-oct-30-2026"]);

/**
 * How many comments a Remark42 thread has.
 * @param {string} url The thread's address: the update's own page, in full.
 * @returns {Promise<number|null>} The count; null if the server can't be reached.
 */
export function fetchRemarkCount(url) {
  return fetch(`${REMARK42.host}/api/v1/count?site=${REMARK42.site}&url=${encodeURIComponent(url)}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => d?.count ?? null)
    .catch(() => null);
}
