import { mount } from "svelte";
import "./app.css";
import TracksidePage from "./TracksidePage.svelte";

export default mount(TracksidePage, { target: document.getElementById("app") });
