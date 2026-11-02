# Clayton Clipper Tracker

Svelte 5 + Vite site, deployed to GitHub Pages (https://clayton-clipper.olund.ca/) by
`.github/workflows/deploy.yml` on every push to `main`.

## Working from the Claude app (phone or desktop)

- Commit author for changes made from the Claude app is `Mike Olund (Claude app)`
  (changes made from Claude Code in Visual Studio stay as `Mike Olund`). Set this in
  the clone before the first commit:
  `git config author.name "Mike Olund (Claude app)"` and `git config author.email "mike@oxd.com"`.
  Leave the committer (`user.name` / `user.email`) as the app's signing identity
  (`Claude` / `noreply@anthropic.com`) so GitHub shows the commits as Verified.
- One change, one commit, pushed straight to `main` — don't batch several requested
  changes into one commit.
- Commit messages follow the existing style: a short plain-English summary of what
  changed on the site (e.g. "Show Highway labels only in the two SFMSF views").
- Make small, exact edits; change nothing that wasn't asked for, and mention other
  issues instead of fixing them.
- Format every changed file with Prettier, default options (`prettier --write <file>`),
  before committing — this matches VS Code's format-on-save. `.svelte` files need
  `prettier-plugin-svelte`; if it isn't available, match the surrounding style by hand.

## Local server

- `npm ci` once, then `npm run dev` (Vite dev server, http://localhost:5173/).
- `npm run build` must pass before pushing; Pages deploys whatever lands on `main`.

## Layout

- `src/assets/map.svg` — the map.
- `src/lib/layerSwitches.js` — layer definitions; `LayerPanel.svelte` the switches.
- `src/app.css` — Tailwind, the colour variables and the base styles; see Styling below.
- `trackside/` — Trackside (`/trackside/`), the updates page; read `trackside/README.md` before changing it.
- `status.yaml` — gantry span / complete / time-stamped notes (newest on the progress card, all on Trackside). Site news
  only: update this file, don't change the drawing unless asked. When adding a note, write it a `title:` (see the
  format in `status.yaml`): a short headline of what the note says, under 60 characters, plain words people would search
  for (span numbers, places, gantry names), nothing the note doesn't say. Never a bare span number: name the gantry
  the span belongs to (e.g. "Clayton Clipper completes span 36"), even when the note doesn't, so the title makes sense on
  its own in a search result. Follow-ups get no title.
- `public/images/` — aerial photos.
- `public/images/sorry-im-a-shitty-photographer/` — update photos (see the `photo:` format in `status.yaml`). Resize every
  uploaded photo to at most 800 pixels wide, save it as JPEG at quality 75, and strip all metadata before committing it.

## Styling

- Everything is styled with Tailwind v4 classes in the markup (`.svelte` files and `about/index.html`); no component
  `<style>` blocks. `src/app.css` is the only stylesheet: Tailwind (with preflight), the colour variables, `@theme` and the
  base rules.
- Sizes are written as plain numbers, set in `@theme` in `src/app.css`: 1rem is 17px, so `mt-14`, `text-13` and `rounded-6`
  are 14px, 13px and 6px at the default text size and follow the iPhone's Text Size setting. Don't write px or rem values
  (`mt-[14px]`); if a size has no token, add one to `@theme` (a font size is `--text-N`, a radius `--radius-N`).
- Colours come from the variables in `app.css` (`bg-(--panel)`, `text-(--mute)`, `border-(--line)`, `bg-(--primary-button)`,
  `bg-(--button-bg)` and so on), which already switch in dark mode. Don't hard-code hex colours; add a variable, with its dark
  value, to the light and both dark blocks.
- A new page or folder with markup needs an `@source` line in `app.css`, or its classes won't be generated. The map
  drawing and `data/` are deliberately not scanned.
- `phone:` is the phone layout (up to 760px wide, the same width as `PHONE` in `src/lib/appState.svelte.js`).
- The map drawing's own styles (`map.svg`) and the layer rules built in `src/lib/layerSwitches.js` stay plain CSS: the
  drawing is injected as raw markup and can't take classes.
- After a styling change, `npm run build` must pass, and `prettier --write` the changed files.

## Writing style (status updates and posts)

- Spans: lowercase, "span 50", like "page 5"; capitalised only at the start of a sentence.
- Titles: sentence case for everything, posts included ("The curious case of Clayton Clipper span 50").
- Gantries: the full name first ("Clayton Clipper", "Surrey Sprinter"); "the Clipper", "the Sprinter" or "the gantry" after.
- Segments: always "segments", never "rocks". When all of a span's segments are hung, the span is "marked as complete".
- Pillar, support, tulip, hammerhead: use the word as written in the note.
- Supports by name: "where spans 70 and 71 meet" in the text; "70/71" is fine in titles and short form.
- Roads: Surrey's style, "176 St", "152 St" (no "th"); "Highway 15 (176 St)" on first mention; "Fraser Highway" in text
  (the map labels stay "Fraser Hwy (1A)").
- Stations: the official names ("Green Timbers Station", "Hillcrest-184 Street Station").
- Times: "a.m." and "p.m.", BC time; posts show the date only.
