// Run after the client build (npm run build): writes Trackside as finished pages, with the text, title, description and
// Open Graph tags in the HTML, for search engines and link previews:
//   dist/trackside/index.html            the newest 10 updates
//   dist/trackside/page/2/index.html …   the older ones, 10 a page
// dist/sitemap.xml, every page for search engines, and dist-ssr/threads.json, each update's comment thread title and
// body, for .github/scripts/sync_discussions.py, so status.yaml is read in one place (lib/status.js).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { render } from "svelte/server";
import { format } from "prettier";
import TracksidePage from "./TracksidePage.svelte";
import { status, followUpTime } from "../src/lib/status.js";
import { term, SITE } from "../src/lib/comments.js";

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
  const parts = [n.summary];
  const photo = (p, parts) => {
    parts.push(`![${p.caption || "Photo for this update"}](${new URL(p.src, SITE).href})`);
    if (p.caption) parts.push(`_${p.caption}_`);
  };
  const blocks = (list, parts) => list.forEach((m) => (m.photo ? photo(m.photo, parts) : parts.push(m.text)));
  if (n.photo) photo(n.photo, parts);
  blocks(n.block, parts);
  if (n.followUps.length) {
    parts.push("### Follow-ups");
    parts.push(
      [...n.followUps]
        .reverse()
        .map((m) => {
          const item = [`\`${followUpTime(m.time, n.time)}\` ${m.summary}`.trim()];
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
  parts.push(`[See it on the Clayton Clipper Tracker](${SITE}trackside/${at === 1 ? "" : `page/${at}/`}#${n.slug})`);
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
