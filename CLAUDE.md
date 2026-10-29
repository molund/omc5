# Clayton Clipper Tracker (OMC5 plan view)

Svelte 5 + Vite site, deployed to GitHub Pages (https://molund.github.io/omc5/) by
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

## Local server

- `npm ci` once, then `npm run dev` (Vite dev server, http://localhost:5173/omc5/).
- `npm run build` must pass before pushing; Pages deploys whatever lands on `main`.

## Layout

- `src/assets/plan.svg` — the plan-view drawing.
- `src/lib/layers.js` — layer definitions; `LayerPanel.svelte` the switches.
- `status.yaml` — gantry span / complete / note shown on the progress card. Site news
  only: update this file, don't change the drawing unless asked.
- `public/images/` — aerial photos.
