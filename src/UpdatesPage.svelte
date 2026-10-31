<script>
  // The past updates page: every status note, newest first, each with an id from its time stamp (e.g. #2026-10-30T20-45) so
  // a single update can be linked to
  import { onMount } from "svelte";
  import { status, asOf } from "./lib/status.js";
  import { anchor, term, fetchCounts } from "./lib/comments.js";

  const MAP = import.meta.env.BASE_URL;
  // Comments: one GitHub Discussion per update, through giscus, in the "Past Updates page comments" category, titled by
  // term() in lib/comments.js
  const GISCUS = {
    "data-repo": "molund/omc5",
    "data-repo-id": "R_kgDOVbOMWA",
    "data-category": "Past Updates page comments",
    "data-category-id": "DIC_kwDOVbOMWM4DKF3d",
    "data-mapping": "specific",
    "data-strict": "1",
    "data-reactions-enabled": "1",
    "data-emit-metadata": "0",
    "data-input-position": "top",
    "data-theme": "preferred_color_scheme",
    "data-lang": "en",
    crossorigin: "anonymous",
    async: "",
  };
  let counts = $state({});
  fetchCounts().then((c) => (counts = c));

  // Pages of 10 updates, newest first. The page is in the address (?page=2), so the browser's back button and shared links
  // work; a link to one update (#2026-10-31T16-30) opens the page it is on.
  const PAGE_SIZE = 10;
  const pages = Math.max(1, Math.ceil(status.history.length / PAGE_SIZE));
  function pageFromAddress() {
    const id = location.hash.slice(1),
      i = id ? status.history.findIndex((n) => anchor(n.time) === id) : -1;
    if (i >= 0) return Math.floor(i / PAGE_SIZE) + 1;
    const n = +new URLSearchParams(location.search).get("page") || 1;
    return Math.min(Math.max(1, Math.round(n)), pages);
  }
  let page = $state(pageFromAddress());
  const shown = $derived(
    status.history.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
  );
  function goTo(p) {
    page = p;
    open = null;
    const url = new URL(location.href);
    if (p === 1) url.searchParams.delete("page");
    else url.searchParams.set("page", p);
    url.hash = "";
    history.pushState(null, "", url);
    window.scrollTo(0, 0);
  }

  // the anchor of the update whose comments are open (one at a time, so the page stays light); a string, since $state would
  // wrap an update object in a proxy that never equals the original. ?comments#2026-10-31T16-30 (the progress card's Comments
  // button) opens that update's comments and scrolls to it.
  let open = $state(
    new URLSearchParams(location.search).has("comments") && location.hash
      ? location.hash.slice(1)
      : null,
  );
  onMount(() => {
    if (location.hash)
      document.getElementById(location.hash.slice(1))?.scrollIntoView();
  });
  // load giscus into the element for this update's thread
  function giscus(el, t) {
    const s = document.createElement("script");
    s.src = "https://giscus.app/client.js";
    Object.entries(GISCUS).forEach(([k, v]) => s.setAttribute(k, v));
    s.setAttribute("data-term", term(t));
    el.appendChild(s);
  }
</script>

<svelte:window
  onpopstate={() => {
    page = pageFromAddress();
    open = null;
  }}
/>

<main class="page">
  <a class="back" href={MAP}>← Back to the map</a>
  <h1>Past updates</h1>
  <ol class="list">
    {#each shown as n (anchor(n.time))}
      <li id={anchor(n.time)}>
        <div class="asof">{asOf(n.time)}</div>
        <div class="note">{n.text}</div>
        {#if n.photo}
          <figure class="photo">
            <a href={n.photo.src}
              ><img
                src={n.photo.src}
                alt={n.photo.caption || "Photo for this update"}
                loading="lazy"
              /></a
            >
            {#if n.photo.caption}<figcaption>{n.photo.caption}</figcaption>{/if}
          </figure>
        {/if}
        <button
          class="comments-link"
          aria-expanded={open === anchor(n.time)}
          onclick={() =>
            (open = open === anchor(n.time) ? null : anchor(n.time))}
          >{open === anchor(n.time)
            ? "Hide comments"
            : counts[term(n.time)]?.comments
              ? `Comments (${counts[term(n.time)].comments})`
              : "Comments"}</button
        >
        {#if counts[term(n.time)]?.reactions.length}
          <span
            class="reactions"
            aria-label="Reactions: {counts[term(n.time)].reactions
              .map(([e, c]) => `${e} ${c}`)
              .join(', ')}"
          >
            {#each counts[term(n.time)].reactions as [e, c]}<span
                >{e} {c}</span
              >{/each}
          </span>
        {/if}
        {#if open === anchor(n.time)}<div class="comments" use:giscus={n.time}></div>{/if}
      </li>
    {/each}
  </ol>
  <!-- the first page has one button to older updates; later pages go either way, with Next off on the last page -->
  {#if pages > 1}
    <nav class="pager" aria-label="Pages of updates">
      {#if page === 1}
        <button onclick={() => goTo(2)}>Show older</button>
      {:else}
        <button onclick={() => goTo(page - 1)}>Previous</button>
        <button disabled={page === pages} onclick={() => goTo(page + 1)}
          >Next</button
        >
      {/if}
    </nav>
  {/if}
</main>

<style>
  /* a plain reading page, a comfortable width, all sizes in rem so they follow the iPhone's Text Size setting */
  .page {
    max-width: calc(640rem / 17);
    margin: 0 auto;
    padding: calc(16px + env(safe-area-inset-top, 0px)) 16px 32px;
    font-size: calc(15rem / 17);
  }
  .back {
    color: var(--ink);
    font-size: calc(13rem / 17);
  }
  h1 {
    margin: 12px 0 8px;
    font-size: calc(22rem / 17);
  }
  .list {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .list li {
    padding: 12px 0;
    border-bottom: 1px solid var(--line);
  }
  .list li:last-child {
    border-bottom: 0;
  }
  .asof {
    font-size: calc(12rem / 17);
    color: var(--mute);
  }
  .note {
    margin-top: 4px;
  }
  /* the page buttons: the site's buttons (as on the card and in the layer panel), sharing the width, tall enough to tap */
  .pager {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }
  .pager button {
    flex: 1;
    min-height: calc(44rem / 17);
  }
  .pager button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  /* the comments toggle, a plain text link, and the giscus thread it opens */
  .comments-link {
    display: inline-block;
    margin-top: 8px;
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    font-size: calc(13rem / 17);
    color: var(--ink);
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
  }
  .comments {
    margin-top: 8px;
  }
  /* the thread's reactions, beside the Comments link */
  .reactions {
    display: inline-flex;
    gap: 10px;
    margin-left: 12px;
    font-size: calc(13rem / 17);
    color: var(--mute);
  }
  /* an update's photo, the page's width, opening full size when tapped */
  .photo {
    margin: 8px 0 0;
  }
  .photo figcaption {
    margin-top: 4px;
    font-size: calc(12rem / 17);
    color: var(--mute);
  }
  .photo img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 6px;
  }
</style>
