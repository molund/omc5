# Trackside

Trackside is the site's updates page: every note in [`status.yaml`](../status.yaml), newest
first, with its photos, follow-ups and a comment thread. The map's progress card shows only the
newest note; Trackside keeps them all.

**Live:** https://clayton-clipper.olund.ca/trackside/

It's built as plain HTML pages when the site is built, so search engines and link previews see
the real text, and then Svelte takes over in the browser for the comments and counts.

## Pages

- `/trackside/` — the newest 10 updates, then `/trackside/page/2/`, `/trackside/page/3/` and so on.
- `/trackside/2026-10-31T21-00/` — each update on its own page. The name is the update's time
  stamp in UTC, the same as its `#2026-10-31T21-00` anchor on the list pages. This is the page to
  share: it has the update's own title, description and photo for search results and link previews.
  On the list pages, the date heading links to it.

The map's progress card links to the newest update on `/trackside/`: its More link to
`/trackside/#2026-10-31T22-15`, and its Comments button to `/trackside/?comments#2026-10-31T22-15`,
which also opens that update's comments. `?comments` works on an update's own page too.

## Files

| File                   | What it does                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`           | The HTML shell. Vite builds `/trackside/` from it, so where it sits sets the address.                                           |
| `main.js`              | The browser entry. Takes over the built page, or draws it from scratch in `npm run dev`.                                        |
| `TracksidePage.svelte` | The page itself: list pages and each update's own page, the head tags, the redirects for old links, the pager and the comments. |
| `prerender.js`         | The build step: writes every page, the sitemap and the comment-thread text.                                                     |

Shared with the map, in `src/`:

- `src/lib/status.js` — reads `status.yaml`. It's the only reader: the map, Trackside and the
  comment threads all go through it.
- `src/lib/comments.js` — each update's anchor and thread title, the comment and reaction counts,
  and `SITE`, the site's address.
- `src/app.css` — colours and base styles, and Tailwind (with its preflight reset). Only the
  pages' own markup is scanned for classes: `about/index.html`, `trackside/*.svelte` and
  `src/*.svelte`. Trackside is styled with Tailwind classes in `TracksidePage.svelte`; its own
  sizes are in rem, 17 to a rem, set in `app.css`'s `@theme`: `mt-14` is 14px at the default text
  size, `text-13` is a 13px font and `rounded-6` a 6px corner, and all of them follow the iPhone's
  Text Size setting.
  The base `button` look is in `app.css`'s base layer, so utilities on a button override it.

## How it's built

`npm run build` runs three steps:

1. `vite build` — the normal build of the map and of `index.html` here.
2. `vite build --ssr trackside/prerender.js` — builds the prerender step itself, so it can import
   the Svelte page and `status.yaml` the way the site does.
3. `node dist-ssr/prerender.js` — renders `TracksidePage.svelte` for every list page and every
   update, using the built `dist/trackside/index.html` as the template. It writes:
   - `dist/trackside/…/index.html` — the pages
   - `dist/sitemap.xml` — every page on the site, with when it last changed
   - `dist-ssr/threads.json` — each update's thread title and text, for the comment threads

The pages are laid out by Prettier so they're easy to read, with its strict whitespace setting.
That setting matters: Svelte has to match the built HTML exactly when it takes over, and normal
Prettier formatting adds spaces that make it give up and redraw the page.

`npm run dev` only draws the first list page, in the browser. To see the other pages, the sitemap
or the head tags, run `npm run build` and then `npm run preview` (http://localhost:4173/trackside/).

## What goes in `status.yaml`

Each update is a note with a time stamp, and optionally, indented under it:

- `title:` — a short headline for the update's own page: its `<title>` and its link-preview title.
  It isn't shown on any page. Without one, the page uses the date.
- `photo:` — a photo and its caption, shown under the note.
- `more:` — more paragraphs and photos, after the note.
- `follow-up:` — later, time-stamped additions, shown as a list under the update. They get no
  page, title or thread of their own.

The comment at the top of `status.yaml` shows the exact format. Photos go in
`public/images/sorry-im-a-shitty-photographer/`.

## Search and link previews

Each page gets its own `<title>`, description, canonical link, and Open Graph and Twitter tags.

- An update's own page uses its title (or its date), its note cut to about 155 characters, and its
  photo, or the first photo under `more:`. An update with no photo gets a text-only preview.
- The list pages use a fixed description and the newest photo.
- `sitemap.xml` is for search engines: submit https://clayton-clipper.olund.ca/sitemap.xml once
  in Google Search Console, and Google rereads it from then on.
- On the list pages, the date links carry an `aria-label` with the date and the title, for screen
  readers.

## Comments

Comments use [giscus](https://giscus.app): each update has its own GitHub Discussion in the
"Trackside" category, titled by its BC time (UTC−7), e.g. "Update 2026-10-31 14:00".

- **Thread titles must never change**, or giscus loses the thread. They come from `term()` in
  `src/lib/comments.js`.
- The deploy workflow creates and updates the threads with
  `.github/scripts/sync_discussions.py`, from `dist-ssr/threads.json`. A thread's text shows the
  update itself, and links back to its page. A thread that giscus started itself, before the
  workflow made one, is left alone.
- Threads older than the newest 30 are closed and locked, to keep spam out of old threads.
- The comment and reaction counts come from one GitHub API call, which returns at most 100
  threads. Once there are 100, the workflow's thread-count check fails (and GitHub emails) as a
  reminder to deal with it. It doesn't stop the deploy.

## Settings

- `PAGE_SIZE` (10 updates a page) is set in both `TracksidePage.svelte` and `prerender.js`.
  Change both together, or the pager and the built pages won't agree.
- `SITE`, the site's address, is in `src/lib/comments.js`.
