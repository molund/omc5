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
- Format every changed file with Prettier (`prettier --write <file>`; the project's options, including the 120-character
  width, are in `.prettierrc`), before committing — this matches VS Code's format-on-save. `.svelte` files need
  `prettier-plugin-svelte`; if it isn't available, match the surrounding style by hand.

## Local server

- `npm ci` once, then `npm run dev` (Vite dev server, http://localhost:5173/).
- `npm run build` must pass before pushing; Pages deploys whatever lands on `main`.

## Layout

- `src/assets/map.svg` — the map.
- `src/MapView/` — `MapView.svelte` and the code only it uses (`builtBy.js`, `gantryProgress.js`, `aerialImages.js`, which loads the aerial photos in a set order); code shared by more
  than one place stays in `src/lib/`.
- `src/lib/appState/` — the shared state and view code, imported from `appState.svelte.js`: `state.svelte.js` (layers, ui,
  els), `viewport.svelte.js` (zoom and the canvas views), the layer switch logic (`appState.svelte.js` itself),
  `hash.svelte.js` (address bookmarks), `persist.svelte.js` (saved panel settings) and `drawingBounds.js`.
- `src/lib/layerSwitches.js` — layer definitions; `LayerPanel.svelte` the switches.
- `src/app.css` — Tailwind, the colour variables and the base styles; see Styling below.
- `trackside/` — Trackside (`/trackside/`), the updates page; read `trackside/README.md` before changing it.
- `status.yaml` — gantry span / complete / time-stamped notes (all on Trackside; the progress card shows the newest update's latest text). Site news
  only: update this file, don't change the drawing unless asked. Follow-ups get no title.
  Titles (the value after a note's time stamp; it leads a post and is the source of the update's `?post=` slug on Trackside; see the format in `status.yaml`):
  - A day with one note, and a note whose title would be completely boring as written (a routine step: hung, glued, moved,
    about to lift), gets the date title, "Clayton Clipper construction update for Monday, Nov. 2, 2026" (weekday, month
    abbreviated with a period, day, year; BC time).
  - Otherwise write a short headline of what the note says, under 60 characters, in plain words (span numbers, places,
    gantry names), nothing the note doesn't say. Never a bare span number: name the gantry the span belongs to (e.g.
    "Clayton Clipper completes span 36"), even when the note doesn't, so the title, and the anchor made from it, make
    sense on their own.
  - A day with more than one note never gets a date title, since the titles (and anchors) would be identical: each gets a
    headline.
  - When a second note lands on a day whose first note has a date title, give that first note a headline too.
- `public/images/` — aerial photos.
- `public/images/sorry-im-a-shitty-photographer/` — update photos (see the `photo:` format in `status.yaml`). Resize every
  uploaded photo to at most 800 pixels wide, save it as JPEG at quality 75, and strip all metadata before committing it.

## Styling

- Everything is styled with Tailwind v4 classes in the markup (`.svelte` files and `about/index.html`); no component
  `<style>` blocks. `src/app.css` is the only stylesheet: Tailwind (with preflight), the colour variables, `@theme` and the
  base rules.
- Sizes are Tailwind's standard ones (`text-sm`, `p-4`, `rounded-md`), all in rem, so they follow the iPhone's Text Size
  setting (the `html` rule in `src/app.css` hands 1rem to the iPhone's body text size). Use the named font sizes and radii,
  and the spacing numbers (`mt-3.5` is 14px at 16px to the rem). Don't write px or rem values (`mt-[14px]`).
- Colours come from the variables in `app.css` (`bg-(--panel)`, `text-(--mute)`, `border-(--line)`, `bg-(--primary-button)`,
  `bg-(--button-bg)` and so on), which already switch in dark mode. Don't hard-code hex colours; add a variable to `:root`
  as `light-dark(light, dark)`.
- Looks shared by pages are classes in `@layer components` in `app.css` (`.page-column`, `.page-header`, `.btn` with
  `.btn-grey` / `.btn-green`, `.pager-link`, `.eyebrow`, `.group-label`, `.fine-print`); use them before repeating a long
  run of utilities.
- A new page or folder with markup needs an `@source` line in `app.css`, or its classes won't be generated. The map
  drawing and `data/` are deliberately not scanned.
- `phone:` is the phone layout (up to 760px wide, the same width as `PHONE` in `src/lib/appState/appState.svelte.js`).
- The map drawing's own styles (`map.svg`) and the layer rules built in `src/lib/layerSwitches.js` stay plain CSS: the
  drawing is injected as raw markup and can't take classes.
- After a styling change, `npm run build` must pass, and `prettier --write` the changed files.

## Writing style (status updates and posts)

- Spans: lowercase, "span 50", like "page 5"; capitalised only at the start of a sentence.
- Spans and girders: a span is the space between two supports, numbered along the route; a girder is a precast concrete or
  steel one connecting two supports, as opposed to the segmental spans the gantry builds from segments. Always call a
  precast concrete or steel one a "girder" and avoid "span" or "beam" for it; use the span's number only to say where it
  goes ("both precast concrete girders for span 34").
- Complete: a span is marked as complete when all its segments are hung, whether or not its girders are in yet, so
  "span 34 is complete" can be true while its girders are still missing. The map draws it complete; the progress card
  counts the span the gantry is on, complete or not.
- Titles: sentence case for everything, posts included ("The curious case of Clayton Clipper span 50").
- Gantries: the full name first ("Clayton Clipper", "Surrey Sprinter"); "the Clipper", "the Sprinter" or "the gantry" after.
- Segments: always "segments", never "rocks". When all of a span's segments are hung, the span is "marked as complete".
- Pillar, support, tulip, hammerhead: use the word as written in the note.
- Supports by name: "where spans 70 and 71 meet" in the text; "70/71" is fine in titles and short form.
- Roads: Surrey's style, "176 St", "152 St" (no "th"); "Highway 15 (176 St)" on first mention; "Fraser Highway" in text
  (the map labels stay "Fraser Hwy (1A)").
- Stations: the official names ("Green Timbers Station", "Hillcrest-184 Street Station").
- Times: "a.m." and "p.m.", BC time; posts show the date only.
