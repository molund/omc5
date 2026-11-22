// What Trackside tells search engines, feed readers and AI tools about its updates: their dates as machine-readable
// time stamps, and the schema.org JSON-LD in each page's head. Shared by TracksidePage.svelte and trackside/prerender.js.
import { SITE } from "./comments.js";
import { plainText } from "./inline.js";

/**
 * A time as an ISO 8601 time stamp in BC time (UTC−7, the offset status.yaml uses), to the minute: "2026-11-20T09:00-07:00".
 * @param {Date} t
 * @returns {string}
 */
export const isoBC = (t) => new Date(t.getTime() - 7 * 60 * 60 * 1000).toISOString().slice(0, 16) + "-07:00";

/**
 * When an update was published: a post with a date alone in status.yaml ("2026-11-22") gets the date alone, everything else
 * its time stamp.
 * @param {import("./status.js").Note} n
 * @returns {string}
 */
export function published(n) {
  const t = isoBC(n.time);
  return n.post && t.endsWith("T00:00-07:00") ? t.slice(0, 10) : t;
}

/**
 * When an update last changed: its newest follow-up, or when it was published.
 * @param {import("./status.js").Note} n
 * @returns {string}
 */
export const modified = (n) => (n.followUps[0] ? isoBC(n.followUps[0].time) : published(n));

/** An update's own page, in full. */
export const permalink = (n) => `${SITE}trackside/${n.slug}/`;

/** Every photo in an update, in the order they show: its own, its paragraphs', then its follow-ups' (oldest first). */
export function photos(n) {
  const out = [],
    add = (p) => p?.src && out.push(p),
    blocks = (list) => list.forEach((m) => add(m.photo));
  add(n.photo);
  blocks(n.block);
  [...n.followUps].reverse().forEach((f) => {
    add(f.photo);
    blocks(f.block);
  });
  return out;
}

/** The person behind the site, the author of every update. */
export const AUTHOR = { "@type": "Person", name: "Mike", url: `${SITE}about/` };

/**
 * An update as a schema.org BlogPosting, for its own page.
 * @param {import("./status.js").Note} n
 * @param {string} headline The update's title, or its date for a status update without one.
 */
export function blogPosting(n, headline) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline,
    description: plainText(n.summary),
    datePublished: published(n),
    dateModified: modified(n),
    author: AUTHOR,
    publisher: AUTHOR,
    image: photos(n).map((p) => new URL(p.src, SITE).href),
    url: permalink(n),
    mainEntityOfPage: permalink(n),
    inLanguage: "en",
  };
}

/**
 * JSON-LD as a script element for a page's head, with "<" escaped so nothing in the text can end the script early.
 * @param {object} data
 * @returns {string}
 */
export const ldScript = (data) =>
  `<script type="application/ld+json">${JSON.stringify(data).replaceAll("<", "\\u003c")}</` + "script>";
