# Clayton Clipper Tracker

A hand-drawn (later corrected against aerial photos) map tracking construction of the Surrey Langley SkyTrain guideway
along the Clayton Clipper's route in Surrey, BC. It shows progress as the Clipper gantry
and mobile cranes build the guideway, updated from regular walks along the
line.

The project started as a drawing of the stretch past the South Fraser Maintenance
and Storage Facility (SFMSF, formerly OMC5) at Fraser Highway and Highway 15 (176 St), which is
where the repo name comes from.

**Live site:** https://clayton-clipper.olund.ca/

## About

I'm Mike Olund, a web developer, a map nerd and a guy who walks his dogs through the job site
every day.

I was seriously injured in a bicycle accident in September 2024. After multiple
surgeries, I was finally walking normally again with Piper and Toby by March 2025. Those
daily walks have turned me into a huge SkyTrain construction nerd, and many days it's
what keeps me motivated to get my 10,000 steps in.

I started this as a fun project to get better at working with Claude, and the whole site
is vibe coded with it.

## Run it locally

```sh
npm ci
npm run dev
```

Then open http://localhost:5173/.

`npm run build` makes the production build. Every push to `main` deploys to GitHub Pages.

## What's where

- `src/` — the map app
- `src/assets/map.svg` — the map
- `trackside/` — Trackside, the updates page (see [its README](trackside/README.md))
- `status.yaml` — progress notes shown on the site
- `public/images/` — aerial photos

### Data files

Not used by the site itself. `data/` is an open dataset (CC0) of the guideway supports,
pillars and spans from 166 St to 184 St, exported from the drawing as GeoJSON. See
[data/README.md](data/README.md) for the files, how they were made and how to update them.

## License

The code is under the [MIT License](LICENSE). Two kinds of images in `public/images/` aren't covered by it:

- the aerial images (`aerial-base.jpg` and `aerial-zoom-*.jpg`), Apple Maps screenshots that belong to Apple and its
  imagery providers
- the Clayton Clipper logo (`logo.png`), which belongs to the Surrey Langley SkyTrain project

The Esri basemaps (Esri World Imagery and Esri's road maps), offered in the SFMSF aerial view, load from Esri as the map
is viewed and are credited on the map; they aren't in this repository.
