// Run after the client build (npm run build): writes Trackside as finished pages, with the text, title, description and
// Open Graph tags in the HTML, for search engines and link previews:
//   dist/trackside/index.html            the newest 10 updates
//   dist/trackside/page/2/index.html …   the older ones, 10 a page
//   dist/trackside/<anchor>/index.html   each update on its own, e.g. /trackside/2026-10-31T16-30/
// and dist-ssr/threads.json, each update's comment thread title and body, for .github/scripts/sync_discussions.py, so
// status.yaml is read in one place (lib/status.js).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { render } from "svelte/server";
import { format } from "prettier";
import TracksidePage from "./TracksidePage.svelte";
import { status, followUpTime } from "./lib/status.js";
import { anchor, term, SITE } from "./lib/comments.js";

const PAGE_SIZE = 10;

// the client build's page, with its hashed script and stylesheet, as the template
const template = readFileSync("dist/trackside/index.html", "utf8");

// each page laid out by Prettier, so it reads like hand-written HTML
async function write(dir, view) {
  const { head, body } = render(TracksidePage, { props: { view } });
  const html = template
    .replace("</head>", `${head}\n  </head>`)
    .replace(
      '<div id="app"></div>',
      `<div id="app" data-view='${JSON.stringify(view)}'>${body}</div>`,
    );
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
for (const n of status.history)
  await write(`dist/trackside/${anchor(n.time)}`, { post: anchor(n.time) });

// A thread's body shows the update itself, as on the Trackside page: the note, its photo and caption, its further
// paragraphs and photos, its follow-ups (oldest first), a link to the update's own page, and giscus's strict-mode marker,
// the sha1 of the title it asks for. No date line: the thread's title already has it.
function threadBody(n) {
  const parts = [n.text];
  const photo = (p) => {
    parts.push(
      `![${p.caption || "Photo for this update"}](${new URL(p.src, SITE).href})`,
    );
    if (p.caption) parts.push(`_${p.caption}_`);
  };
  if (n.photo) photo(n.photo);
  n.more.forEach((m) => (m.photo ? photo(m.photo) : parts.push(m.text)));
  if (n.followUps.length) {
    parts.push("### Follow-ups");
    parts.push(
      [...n.followUps]
        .reverse()
        .map((m) => `- \`${followUpTime(m.time, n.time)}\` ${m.text}`)
        .join("\n"),
    );
  }
  parts.push(
    `[See it on the Clayton Clipper Tracker](${SITE}trackside/${anchor(n.time)}/)`,
  );
  parts.push(
    `<!-- sha1: ${createHash("sha1").update(term(n.time)).digest("hex")} -->`,
  );
  return parts.join("\n\n");
}

writeFileSync(
  "dist-ssr/threads.json",
  JSON.stringify(
    status.history.map((n) => ({ title: term(n.time), body: threadBody(n) })),
    null,
    2,
  ) + "\n",
);
console.log(
  `prerendered Trackside: ${pages} page(s), ${status.history.length} updates`,
);
