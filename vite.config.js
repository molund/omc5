import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
  // GitHub Pages serves the site from https://molund.github.io/omc5/
  base: "/omc5/",
  // two pages: the map, and Trackside at /omc5/trackside/
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        trackside: "trackside/index.html",
      },
    },
  },
});
