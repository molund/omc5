import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
  // GitHub Pages serves the site from https://molund.github.io/omc5/
  base: "/omc5/",
  // two pages: the map, and the past updates at /omc5/updates/
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        updates: "updates/index.html",
      },
    },
  },
});
