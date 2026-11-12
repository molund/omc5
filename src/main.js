import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";

// the page's text for search engines (index.html) stays where it is, hidden (index.html's style), and the map goes beside it
const target = document.getElementById("app");

export default mount(App, { target });
