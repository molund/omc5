import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { photoSizes } from "./src/lib/photoSizes.js";

// The Google tag (.google/gtag.html) goes at the top of <head> on every page, indented 4 spaces like the rest of the head.
// Trackside's update pages are rendered from the built Trackside page (trackside/prerender.js), so they get it too. Not in
// `npm run dev`, so local visits aren't counted.
const googleTag = {
  name: "google-tag",
  apply: "build",
  transformIndexHtml: (html) => {
    const tag = readFileSync(new URL(".google/gtag.html", import.meta.url), "utf8")
      .trimEnd()
      .split("\n")
      .map((line) => (line ? `    ${line}` : line))
      .join("\n");
    return html.replace("<head>", `<head>\n${tag}`);
  },
};

// "virtual:photo-sizes": the width and height of every update photo, read from the files in
// public/images/sorry-im-a-shitty-photographer/ at build time (src/lib/photoSizes.js), for Trackside's <img> tags. The same
// module goes into the browser build and the prerender, so the built pages and the browser agree.
const PHOTO_SIZES = "\0virtual:photo-sizes";
const photoSizesModule = {
  name: "photo-sizes",
  resolveId: (id) => (id === "virtual:photo-sizes" ? PHOTO_SIZES : null),
  load: (id) =>
    id === PHOTO_SIZES
      ? `export default ${JSON.stringify(photoSizes(new URL("public/images/sorry-im-a-shitty-photographer/", import.meta.url)))};`
      : null,
};

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [tailwindcss(), svelte(), googleTag, photoSizesModule],
  // GitHub Pages serves the site from https://clayton-clipper.olund.ca/ (the custom domain set in the repo's Pages settings)
  base: "/",
  // five pages: the map, Trackside at /trackside/, About at /about/, Privacy at /privacy/ and the animation launcher at /play/ (linked from the
  // blog, not from the site), plus 404.html, which GitHub Pages serves for missing addresses (the SSR build, for trackside/prerender.js, takes its entry from --ssr)
  build: isSsrBuild
    ? {}
    : {
        rollupOptions: {
          input: {
            main: "index.html",
            trackside: "trackside/index.html",
            about: "about/index.html",
            privacy: "privacy/index.html",
            play: "play/index.html",
            notFound: "404.html",
          },
        },
      },
}));
