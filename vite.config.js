import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [svelte()],
  // GitHub Pages serves the site from https://clayton-clipper.olund.ca/ (the custom domain set in the repo's Pages settings)
  base: "/",
  // two pages: the map, and Trackside at /trackside/ (the SSR build, for src/prerender.js, takes its entry from --ssr)
  build: isSsrBuild
    ? {}
    : {
        rollupOptions: {
          input: {
            main: "index.html",
            trackside: "trackside/index.html",
          },
        },
      },
}));
