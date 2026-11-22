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

/**
 * The person behind the site, the author of every update; the same Person as in the About page's ProfilePage (the "@id"
 * ties them together), where more of his links can be added to sameAs.
 */
export const AUTHOR = {
  "@type": "Person",
  "@id": `${SITE}about/#mike`,
  name: "Mike",
  url: `${SITE}about/`,
  sameAs: ["https://github.com/molund"],
};

/**
 * What every update is about, so search engines and AI tools can tie Trackside to the project; its sameAs is the project's
 * official site and its section of the Expo Line article on Wikipedia (it has no article of its own).
 */
export const ABOUT = {
  "@type": "Thing",
  name: "Surrey Langley SkyTrain",
  // its official name since Sept. 15, 2026 (https://news.gov.bc.ca/releases/2026TT0034-001071), which nobody uses
  alternateName: "Dave Barrett Extension",
  sameAs: [
    "https://surreylangleyskytrain.gov.bc.ca/",
    "https://en.wikipedia.org/wiki/Expo_Line_(SkyTrain)#Surrey%E2%80%93Langley_extension",
  ],
};

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
    about: ABOUT,
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

/** Trackside itself, which every update is part of. */
const BLOG_ID = `${SITE}trackside/#blog`;

/**
 * A page of updates: the first page as the schema.org Blog, with the updates on it; an older page as a CollectionPage of
 * that blog.
 * @param {import("./status.js").Note[]} shown The updates on the page.
 * @param {number} page Which page of updates it is.
 * @param {string} url The page's address, in full.
 * @param {(n: import("./status.js").Note) => string} headline An update's title, or its date for a status update.
 */
export function blogPage(shown, page, url, headline) {
  const posts = shown.map((n) => ({
    "@type": "BlogPosting",
    headline: headline(n),
    url: permalink(n),
    datePublished: published(n),
    dateModified: modified(n),
    author: AUTHOR,
  }));
  const description =
    "Updates and photos from along the Surrey Langley SkyTrain guideway, following the Clayton Clipper gantry span by span.";
  return page === 1
    ? {
        "@context": "https://schema.org",
        "@type": "Blog",
        "@id": BLOG_ID,
        name: "Trackside",
        description,
        url,
        author: AUTHOR,
        publisher: AUTHOR,
        about: ABOUT,
        inLanguage: "en",
        blogPost: posts,
      }
    : {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `Trackside, page ${page}`,
        url,
        isPartOf: { "@type": "Blog", "@id": BLOG_ID, name: "Trackside", url: `${SITE}trackside/` },
        hasPart: posts,
      };
}
