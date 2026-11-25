// The Privacy page is plain HTML styled with Tailwind classes; this brings in the site's colours and Tailwind, and
// fetches the map's script ahead of a tap on Map
import "../src/app.css";
import { preloadMap } from "../src/lib/preloadMap.js";

preloadMap();
