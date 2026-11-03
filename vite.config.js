import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";

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

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [tailwindcss(), svelte(), googleTag],
  // GitHub Pages serves the site from https://clayton-clipper.olund.ca/ (the custom domain set in the repo's Pages settings)
  base: "/",
  // three pages: the map, Trackside at /trackside/ and About at /about/ (the SSR build, for trackside/prerender.js, takes its entry from
  // --ssr)
  build: isSsrBuild
    ? {}
    : {
        rollupOptions: {
          input: {
            main: "index.html",
            trackside: "trackside/index.html",
            about: "about/index.html",
          },
        },
      },
}));
