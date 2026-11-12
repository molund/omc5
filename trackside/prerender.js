// Run after the client build (npm run build): writes Trackside as finished pages, with the text, title, description and
// Open Graph tags in the HTML, for search engines and link previews:
//   dist/trackside/index.html            the newest 10 updates
//   dist/trackside/page/2/index.html …   the older ones, 10 a page
//   dist/trackside/<slug>/index.html     each update on its own page (in the sitemap, not linked from the site)
// dist/sitemap.xml, every page for search engines, and dist-ssr/threads.json, each update's comment thread title and
// body, for .github/scripts/sync_discussions.py, so status.yaml is read in one place (lib/status.js). And
// dist/velocity.svg, the progress card's velocity chart, from gantry-cycles.yaml (lib/velocityChart.js).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { render } from "svelte/server";
import { format } from "prettier";
import TracksidePage from "./TracksidePage.svelte";
import { status, followUpTime } from "../src/lib/status.js";
import { inline, plainText } from "../src/lib/inline.js";
import { term, SITE } from "../src/lib/comments.js";
import { velocityChart, velocityPoints } from "../src/lib/velocityChart.js";
import { statusData, datasetJsonLd, summarySentence } from "../src/lib/statusData.js";

const PAGE_SIZE = 10;

// the client build's page, with its hashed script and stylesheet, as the template
const template = readFileSync("dist/trackside/index.html", "utf8");

// each page laid out by Prettier, so it reads like hand-written HTML
async function write(dir, view) {
  const { head, body } = render(TracksidePage, { props: { view } });
  const html = template
    .replace("</head>", `${head}\n  </head>`)
    .replace('<div id="app"></div>', `<div id="app" data-view='${JSON.stringify(view)}'>${body}</div>`);
  mkdirSync(dir, { recursive: true });
  const formatted = await format(html, {
    parser: "html",
    htmlWhitespaceSensitivity: "strict",
    printWidth: 120,
  });
  // Prettier still lays out the inside of an <svg> on lines of its own, even in strict mode, and Svelte then finds
  // spaces where it expects the icon's first shape and redraws the page (hydration_mismatch); spaces between an svg's
  // tags don't change how it draws, so they come out again
  writeFileSync(
    `${dir}/index.html`,
    formatted.replace(
      /(<svg\b[^>]*>)([\s\S]*?)(<\/svg)/g,
      (_, open, inner, close) => open + inner.replace(/>\s+</g, "><").trim() + close,
    ),
  );
}

const pages = Math.max(1, Math.ceil(status.history.length / PAGE_SIZE));
for (let p = 1; p <= pages; p++)
  await write(p === 1 ? "dist/trackside" : `dist/trackside/page/${p}`, {
    page: p,
  });
// each update's own page, /trackside/<slug>/: just that update, with its own title, description and photo
for (const n of status.history) await write(`dist/trackside/${n.slug}`, { slug: n.slug });

// dist/sitemap.xml, for search engines (submitted in Google Search Console, since a project site can't have a robots.txt):
// the map, the pages of updates, each update's own page and the About page, each with when it last changed (a page of
// updates, at its newest update or follow-up; the map, at status.yaml's `updated`). Not the animation launcher, /play/:
// it only redirects to the map.
const changed = (n) => n.followUps[0]?.time ?? n.time;
const newest = (list) => new Date(Math.max(...list.map(changed)));
const urls = [
  [SITE, status.updated ?? newest(status.history)],
  ...Array.from({ length: pages }, (_, i) => [
    i === 0 ? `${SITE}trackside/` : `${SITE}trackside/page/${i + 1}/`,
    newest(status.history.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE)),
  ]),
  // each update's own page, at its newest follow-up or its own time
  ...status.history.map((n) => [`${SITE}trackside/${n.slug}/`, changed(n)]),
  // the About page, which has no date of its own
  [`${SITE}about/`, null],
];
writeFileSync(
  "dist/sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(([loc, t]) => `  <url><loc>${loc}</loc>${t ? `<lastmod>${t.toISOString()}</lastmod>` : ""}</url>`)
  .join("\n")}
</urlset>
`,
);

// A thread's body shows the update itself, as on the Trackside page: the summary, its photo and caption, its further
// paragraphs and photos, its follow-ups (oldest first), a link to the update on its page of updates, and giscus's
// strict-mode marker,
// the sha1 of the title it asks for. No date line: the thread's title already has it.
function threadBody(n) {
  // the text's links and bold written out again, each link with its full address (a link on this site is to a page of
  // Trackside, where it was written), since the thread is on GitHub
  const md = (text) =>
    inline(text)
      .map((p) => {
        const t = p.href ? `[${p.text}](${new URL(p.href, `${SITE}trackside/`).href})` : p.text;
        return p.bold ? `**${t}**` : t;
      })
      .join("");
  const parts = [md(n.summary)];
  const photo = (p, parts) => {
    parts.push(`![${plainText(p.caption) || "Photo for this update"}](${new URL(p.src, SITE).href})`);
    if (p.caption) parts.push(`_${md(p.caption)}_`);
  };
  const blocks = (list, parts) => list.forEach((m) => (m.photo ? photo(m.photo, parts) : parts.push(md(m.text))));
  if (n.photo) photo(n.photo, parts);
  blocks(n.block, parts);
  if (n.followUps.length) {
    parts.push("### Follow-ups");
    parts.push(
      [...n.followUps]
        .reverse()
        .map((m) => {
          const item = [`\`${followUpTime(m.time, n.time)}\` ${md(m.summary)}`.trim()];
          if (m.photo) photo(m.photo, item);
          blocks(m.block, item);
          // later paragraphs are indented to stay inside the list item
          return "- " + item.join("\n\n  ");
        })
        .join("\n"),
    );
  }
  // the update on the page of updates it is listed on (made again at every deploy, as updates move down the pages)
  const at = Math.floor(status.history.indexOf(n) / PAGE_SIZE) + 1;
  parts.push(
    `[See it on the Clayton Clipper Tracker](${SITE}trackside/${at === 1 ? "" : `page/${at}/`}?post=${n.slug})`,
  );
  parts.push(`<!-- sha1: ${createHash("sha1").update(term(n.time)).digest("hex")} -->`);
  return parts.join("\n\n");
}

writeFileSync(
  "dist-ssr/threads.json",
  JSON.stringify(
    status.history.map((n) => ({
      title: term(n.time),
      body: threadBody(n),
      // posts stay open for comments however old they get (see close_old in sync_discussions.py)
      post: n.post,
    })),
    null,
    2,
  ) + "\n",
);
console.log(`prerendered Trackside: ${pages} page(s), ${status.history.length} updates`);

// dist/velocity.svg, the progress card's velocity chart, from the velocity the Leash Log keeps in gantry-cycles.yaml (the only part
// of gantry-cycles.yaml the site reads); with too little to draw, there's no file, and the card shows no chart
const points = velocityPoints(readFileSync("gantry-cycles.yaml", "utf8"));
const chart = velocityChart(points);
if (chart) writeFileSync("dist/velocity.svg", chart);
console.log(chart ? "drew the velocity chart" : "no velocity chart: too few values in gantry-cycles.yaml");

// dist/status.json, the current span and velocity as data, and the schema.org Dataset that describes it, put into the map page's
// <head> where index.html has the marker (lib/statusData.js). "<" is escaped so nothing in the data can end the script early.
const data = statusData(status, points);
writeFileSync("dist/status.json", JSON.stringify(data, null, 2) + "\n");
const MARKER = "<!--dataset-jsonld-->";
const SUMMARY = "<!--status-summary-->";
const mapPage = readFileSync("dist/index.html", "utf8");
for (const marker of [MARKER, SUMMARY])
  if (!mapPage.includes(marker)) throw new Error(`index.html has no ${marker} for the status data to go in`);
const jsonLd = JSON.stringify(datasetJsonLd(data), null, 2).replaceAll("<", "\\u003c");
// the sentence is plain text of our own making, but is escaped all the same
const sentence = summarySentence(data).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
writeFileSync(
  "dist/index.html",
  mapPage
    .replace(MARKER, () => `<script type="application/ld+json">\n${jsonLd}\n    </script>`)
    .replace(SUMMARY, () => sentence),
);
console.log("wrote status.json, the Dataset JSON-LD and the status sentence");
