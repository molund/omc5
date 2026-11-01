import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";

// the page's text for search engines (index.html) gives way to the map
const target = document.getElementById("app");
target.replaceChildren();

export default mount(App, { target });
