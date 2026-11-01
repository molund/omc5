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
- `trackside/` — Trackside (`/trackside/`), the updates page; read `trackside/README.md` before changing it.
- `status.yaml` — gantry span / complete / time-stamped notes (newest on the progress card, all on Trackside). Site news
  only: update this file, don't change the drawing unless asked. When adding a note, write it a `title:` (see the
  format in `status.yaml`): a short headline of what the note says, under 60 characters, plain words people would search
  for (span numbers, places, gantry names), nothing the note doesn't say. Never a bare span number: name the gantry
  the span belongs to (e.g. "Clayton Clipper completes span 36"), even when the note doesn't, so the title makes sense on
  its own in a search result. Follow-ups get no title.
- `public/images/` — aerial photos.
- `public/images/sorry-im-a-shitty-photographer/` — update photos (see the `photo:` format in `status.yaml`). Resize every
  uploaded photo to at most 800 pixels wide, save it as JPEG at quality 75, and strip all metadata (especially the GPS
  location) before committing it.
