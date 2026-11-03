import { hydrate, mount } from "svelte";
import "../src/app.css";
import TracksidePage from "./TracksidePage.svelte";

// which page this is, { page: 2 } or { post: "clipper-completes-span-36" }, as trackside/prerender.js wrote it; the
// prerendered page is brought to life where there is one, and drawn from scratch otherwise (npm run dev)
const target = document.getElementById("app");
const props = { view: JSON.parse(target.dataset.view || '{"page":1}') };

export default target.firstChild ? hydrate(TracksidePage, { target, props }) : mount(TracksidePage, { target, props });
