import { mount } from "svelte";
import "./app.css";
import UpdatesPage from "./UpdatesPage.svelte";

export default mount(UpdatesPage, { target: document.getElementById("app") });
