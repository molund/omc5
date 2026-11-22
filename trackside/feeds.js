// Trackside's feeds, for feed readers and AI tools, written by prerender.js when the site is built: every update, newest
// first, with its text, photos and follow-ups as HTML.
import { status, followUpTime, asOf } from "../src/lib/status.js";
import { inline, plainText } from "../src/lib/inline.js";
import { SITE } from "../src/lib/comments.js";
import { published, modified, permalink, isoBC } from "../src/lib/seo.js";

/** Text made safe for HTML and XML. */
export const escape = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** An address in full; one on this site is relative to Trackside, where the text was written. */
const full = (href) => new URL(href, `${SITE}trackside/`).href;

/** An update's title, or its date for a status update without one, as Trackside's headings show it ("Nov 20, 2026 at 9:00 a.m."). */
export function titleOf(n) {
  if (n.title) return n.title;
  const [time, date] = asOf(n.time).split(" on ");
  return `${date} at ${time}`;
}

/**
 * An update as HTML: its summary, photo, further paragraphs and photos, then its follow-ups (oldest first), with links in
 * full, since a feed reader shows it away from the site.
 * @param {import("../src/lib/status.js").Note} n
 */
export function updateHtml(n) {
  const text = (t) =>
    inline(t)
      .map((p) => {
        const s = p.href ? `<a href="${escape(full(p.href))}">${escape(p.text)}</a>` : escape(p.text);
        return p.bold ? `<strong>${s}</strong>` : s;
      })
      .join("");
  const photo = (p) =>
    `<figure><img src="${escape(new URL(p.src, SITE).href)}" alt="${escape(plainText(p.caption) || "Photo for this update")}" />` +
    (p.caption ? `<figcaption>${text(p.caption)}</figcaption>` : "") +
    "</figure>";
  const blocks = (list) => list.map((m) => (m.photo ? photo(m.photo) : `<p>${text(m.text)}</p>`)).join("");
  let html = `<p>${text(n.summary)}</p>` + (n.photo ? photo(n.photo) : "") + blocks(n.block);
  if (n.followUps.length)
    html +=
      "<h3>Follow-ups</h3><ul>" +
      [...n.followUps]
        .reverse()
        .map(
          (m) =>
            `<li><time datetime="${isoBC(m.time)}">${escape(followUpTime(m.time, n.time))}</time> ${text(m.summary)}` +
            (m.photo ? photo(m.photo) : "") +
            blocks(m.block) +
            "</li>",
        )
        .join("") +
      "</ul>";
  return html;
}

const NAME = "Trackside · Clayton Clipper Tracker";
const DESCRIPTION =
  "Updates and photos from along the Surrey Langley SkyTrain guideway, following the Clayton Clipper gantry span by span.";

/** When the newest update or follow-up was added, for the feeds. */
const newest = () =>
  status.history
    .map((n) => atomTime(modified(n)))
    .sort()
    .at(-1);

/** The Atom feed, /trackside/feed.xml. */
export function atom() {
  const entries = status.history.map(
    (n) => `  <entry>
    <id>${permalink(n)}</id>
    <title>${escape(titleOf(n))}</title>
    <link rel="alternate" type="text/html" href="${permalink(n)}" />
    <published>${atomTime(published(n))}</published>
    <updated>${atomTime(modified(n))}</updated>
    <summary>${escape(plainText(n.summary))}</summary>
    <content type="html">${escape(updateHtml(n))}</content>
  </entry>`,
  );
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">
  <id>${SITE}trackside/</id>
  <title>${escape(NAME)}</title>
  <subtitle>${escape(DESCRIPTION)}</subtitle>
  <link rel="self" type="application/atom+xml" href="${SITE}trackside/feed.xml" />
  <link rel="alternate" type="text/html" href="${SITE}trackside/" />
  <updated>${newest()}</updated>
  <author><name>Mike</name><uri>${SITE}about/</uri></author>
  <icon>${SITE}favicon.ico</icon>
${entries.join("\n")}
</feed>
`;
}

/** Atom needs a full date and time with seconds: a date alone is the start of that day in BC time. */
function atomTime(t) {
  const full = t.length === 10 ? `${t}T00:00-07:00` : t;
  return full.replace(/(T\d\d:\d\d)(?=[-+])/, "$1:00");
}
