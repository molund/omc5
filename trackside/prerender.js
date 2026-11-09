// Run after the client build (npm run build): writes Trackside as finished pages, with the text, title, description and
// Open Graph tags in the HTML, for search engines and link previews:
//   dist/trackside/index.html            the newest 10 updates
//   dist/trackside/page/2/index.html …   the older ones, 10 a page
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
  writeFileSync(
    `${dir}/index.html`,
    await format(html, {
      parser: "html",
      htmlWhitespaceSensitivity: "strict",
      printWidth: 120,
    }),
  );
}

const pages = Math.max(1, Math.ceil(status.history.length / PAGE_SIZE));
for (let p = 1; p <= pages; p++)
  await write(p === 1 ? "dist/trackside" : `dist/trackside/page/${p}`, {
    page: p,
  });
for (const [i, n] of status.history.entries()) {
  const page = Math.floor(i / PAGE_SIZE) + 1,
    target = `/trackside/${page === 1 ? "" : `page/${page}/`}?post=${n.slug}&comments`,
    permalink = `${SITE}trackside/${n.slug}/`,
    image = n.photo || n.block.find((m) => m.photo)?.photo;
  const escape = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  mkdirSync(`dist/trackside/${n.slug}`, { recursive: true });
  writeFileSync(
    `dist/trackside/${n.slug}/index.html`,
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="robots" content="noindex" />
    <meta property="og:title" content="${escape(n.title)}" />
    <meta property="og:description" content="${escape(plainText(n.summary))}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${escape(permalink)}" />
    ${image ? `<meta property="og:image" content="${escape(new URL(image.src, SITE).href)}" />` : ""}
    <title>Trackside permalink · Clayton Clipper Tracker</title>
    <meta http-equiv="refresh" content="0;url=${target}" />
    <script>location.replace(${JSON.stringify(target)});</script>
  </head>
  <body>
    <noscript><a href="${target}">Open this update and its comments on Trackside.</a></noscript>
  </body>
</html>
`,
  );
}

// dist/sitemap.xml, for search engines (submitted in Google Search Console, since a project site can't have a robots.txt):
// the map, the pages of updates and the About page, each with when it last changed (a page of updates, at its newest update
// or follow-up; the map, at status.yaml's `updated`)
const changed = (n) => n.followUps[0]?.time ?? n.time;
const newest = (list) => new Date(Math.max(...list.map(changed)));
const urls = [
  [SITE, status.updated ?? newest(status.history)],
  ...Array.from({ length: pages }, (_, i) => [
    i === 0 ? `${SITE}trackside/` : `${SITE}trackside/page/${i + 1}/`,
    newest(status.history.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE)),
  ]),
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
const chart = velocityChart(velocityPoints(readFileSync("gantry-cycles.yaml", "utf8")));
if (chart) writeFileSync("dist/velocity.svg", chart);
console.log(chart ? "drew the velocity chart" : "no velocity chart: too few values in gantry-cycles.yaml");
