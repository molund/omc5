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
 * An update's comment thread on Remark42: its own page's address, in full, so it's the same thread wherever the update
 * shows.
 * @param {string} slug The update's slug.
 * @returns {string}
 */
export const threadUrl = (slug) => new URL(`trackside/${slug}/`, SITE).href;

/**
 * The updates that had comments on GitHub Discussions (giscus) before the move to Remark42, by thread title (see
 * {@link term}), and the number of their discussion on GitHub: Trackside links to them as earlier comments.
 * @type {Record<string, number>}
 */
const EARLIER = {
  "Update 2026-10-31 09:30": 23,
  "Update 2026-11-06 08:45": 71,
  "Update 2026-11-16 09:00": 96,
  "Update 2026-11-19 16:00": 99,
};

/**
 * The address of an update's earlier comments on GitHub, if it had any before the move to Remark42.
 * @param {Date} t The update's time stamp.
 * @returns {string|undefined}
 */
export const earlierComments = (t) =>
  EARLIER[term(t)] && `https://github.com/molund/omc5/discussions/${EARLIER[term(t)]}`;

/**
 * Comment counts for several Remark42 threads at once, in one request.
 * @param {string[]} urls The threads' addresses (see {@link threadUrl}).
 * @returns {Promise<Record<string, number>>} The counts by address; empty if the server can't be reached.
 */
export function fetchRemarkCounts(urls) {
  return fetch(`${REMARK42.host}/api/v1/counts?site=${REMARK42.site}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(urls),
  })
    .then((r) => (r.ok ? r.json() : []))
    .then((list) => Object.fromEntries(list.map((p) => [p.url, p.count])))
    .catch(() => ({}));
}
