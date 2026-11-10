# Trackside

Trackside is the site's updates page: every note in [`status.yaml`](../status.yaml), newest
first, with its photos, follow-ups and a comment thread. The map's progress card shows only the
latest text and a Comments button; the full notes live here.

**Live:** https://clayton-clipper.olund.ca/trackside/

It's built as plain HTML pages when the site is built, so search engines and link previews see
the real text, and then Svelte takes over in the browser for the comments and counts.

## Pages

- `/trackside/` — the newest 10 updates, then `/trackside/page/2/`, `/trackside/page/3/` and so on.
  Every update is on one of these pages.
- `/trackside/<slug>/` — an update's own page, at a permanent address: just that update, with its comments. It's
  listed in `sitemap.xml` for search engines. The only link to it is the Copy permalink icon by each update's heading, a
  real link for search engines and anyone without JavaScript; a plain click copies the address instead (a cmd-, ctrl-,
  shift- or middle-click opens it). It links only to `/trackside/`, never to the page of updates the update is on. Its title,
  description and Open Graph tags use the update's title (or date) and summary; when the update has a photo, the first
  one is the preview image.
- An update is addressed by its slug: `/trackside/?post=clipper-completes-span-36` scrolls to it (the page's script
  calls `scrollIntoView()`, there are no hash anchors), and its date heading does the same. Add `&comments` to open
  its comments too. The old `#slug` links still work.

The progress card's Comments button goes to `/trackside/?post=clipper-completes-span-36&comments`: the first
page, scrolled to the newest update, with its comments open. The card shows that text and button only while the newest
update's (or its newest follow-up's) time stamp is the file's `updated`. After a change to the span or Hung with no
text, `updated` is later than every note, and the card shows no text and a Trackside button to `/trackside/` instead.

## Files

| File                   | What it does                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `index.html`           | The HTML shell. Vite builds `/trackside/` from it, so where it sits sets the address.    |
| `main.js`              | The browser entry. Takes over the built page, or draws it from scratch in `npm run dev`. |
| `TracksidePage.svelte` | The page itself: the list pages, the head tags, the pager and the comments.              |
| `prerender.js`         | The build step: writes every page, the sitemap and the comment-thread text.              |

Shared with the map, in `src/`:

- `src/lib/status.js` — reads `status.yaml`. It's the only reader: the map, Trackside and the
  comment threads all go through it.
- `src/lib/comments.js` — each update's thread title, the comment and reaction counts,
  and `SITE`, the site's address.
- `src/app.css` — colours, base styles and Tailwind. Trackside is styled with Tailwind classes in
  `TracksidePage.svelte`; sizes are Tailwind's standard ones, in rem, so they follow the iPhone's Text
  Size setting.

## How it's built

`npm run build` runs three steps:

1. `vite build` — the normal build of the map and of `index.html` here.
2. `vite build --ssr trackside/prerender.js` — builds the prerender step itself, so it can import
   the Svelte page and `status.yaml` the way the site does.
3. `node dist-ssr/prerender.js` — renders `TracksidePage.svelte` for every list page and every update's own page,
   using the built `dist/trackside/index.html` as the template. It writes:
   - `dist/trackside/…/index.html` — the pages
   - `dist/sitemap.xml` — every page on the site, with when it last changed
   - `dist-ssr/threads.json` — each update's thread title and text, for the comment threads

The pages are laid out by Prettier so they're easy to read, with its strict whitespace setting.
That setting matters: Svelte has to match the built HTML exactly when it takes over, and normal
Prettier formatting adds spaces that make it give up and redraw the page.

`npm run dev` only draws the first list page, in the browser. To see the other pages, the sitemap
or the head tags, run `npm run build` and then `npm run preview` (http://localhost:4173/trackside/).

## What goes in `status.yaml`

Each update is a note: its time stamp and its title on one line, then indented under it:

- The title (the value after the time stamp) — a short headline. It leads a post, and it is where the
  update's slug comes from (below). It isn't shown on a status update. `""` for none: the slug comes
  from the time stamp.
- `slug:` — the update's `?post=` slug on its page. Optional: without it the slug is the title in
  lowercase words ("Clayton Clipper" becomes "Clipper", and is dropped from the date titles), cut at a
  word to 80 characters. The oldest update with a given title keeps the plain words and a later one
  gets `-2`, so adding an update never changes an old slug. **Editing a title changes its slug**, so
  once an update has been linked to, add its current slug as `slug:` before changing the title.
- `summary:` — the update's main text, in a sentence or two. The progress card shows it on its own, and Trackside
  leads with it.
- `photo:` — a photo and its caption, shown under the summary.
- `block:` — more paragraphs and photos, after the summary.
- Summaries, paragraphs and captions can have links, `[text](https://…)` (or an address on this site, `/about/` or
  `?post=…`), and bold, `**text**` or `__text__`; `src/lib/inline.js` reads them. No other markdown: anything else shows
  as typed. Link previews and image descriptions get the plain text, and the comment threads get the links in full.
- Notes to self aren't here: they're in `gantry-cycles.yaml`, the Leash Log's file, which the site doesn't read. (The reader
  still skips a `note-to-self:` line, so an old one would never be shown.)
- `follow-up:` — later, time-stamped additions, shown as a list under the update. Each has its own
  `summary:`, `photo:` and `block:`, like the update. The card shows only the newest follow-up's
  summary. They get no
  anchor, title or thread of their own.

Use the current entries in `status.yaml` as a guide for the format (its top comment covers the rules the entries
don't show). Photos go in
`public/images/sorry-im-a-shitty-photographer/`.

## Search and link previews

Each page of updates gets its own `<title>`, description, canonical link, and Open Graph and Twitter tags.

- The pages of updates use a fixed description and the newest photo; an update's own page uses its title, summary and
  photo.
- `sitemap.xml` is for search engines: submit https://clayton-clipper.olund.ca/sitemap.xml once
  in Google Search Console, and Google rereads it from then on.
- On the pages, the date links carry an `aria-label` with the date and the title, for screen
  readers.

## Comments

Comments use [giscus](https://giscus.app): each update has its own GitHub Discussion in the
"Trackside" category, titled by its BC time (UTC−7), e.g. "Update 2026-10-31 14:00".

- **Thread titles must never change**, or giscus loses the thread. They come from `term()` in
  `src/lib/comments.js`.
- The deploy workflow creates and updates the threads with
  `.github/scripts/sync_discussions.py`, from `dist-ssr/threads.json`. A thread's text shows the
  update itself, and links to it on its page of updates (made again at every deploy, since updates move down the
  pages). A thread that giscus started itself, before the
  workflow made one, is left alone.
- Threads older than the newest 30 are closed and locked, to keep spam out of old threads.
- The comment and reaction counts come from one GitHub API call, which returns at most 100
  threads. Once there are 100, the workflow's thread-count check fails (and GitHub emails) as a
  reminder to deal with it. It doesn't stop the deploy.

## Settings

- `PAGE_SIZE` (10 updates a page) is set in both `TracksidePage.svelte` and `prerender.js`.
  Change both together, or the pager and the built pages won't agree.
- `SITE`, the site's address, is in `src/lib/comments.js`.
