import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [svelte()],
  // GitHub Pages serves the site from https://molund.github.io/omc5/
  base: "/omc5/",
  // two pages: the map, and Trackside at /omc5/trackside/ (the SSR build, for src/prerender.js, takes its entry from --ssr)
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
