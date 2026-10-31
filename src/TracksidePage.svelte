<script>
  // The Trackside page: every status note, newest first, each with an id from its time stamp (e.g. #2026-10-30T20-45) so
  // a single update can be linked to
  import { onMount } from "svelte";
  import { status, asOf, minorTime } from "./lib/status.js";
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
    // GitHub light / dark as before, minus the upvote arrows (public/giscus.css)
    "data-theme": new URL(
      `${import.meta.env.BASE_URL}giscus.css`,
      location.origin,
    ).href,
    "data-lang": "en",
    crossorigin: "anonymous",
    async: "",
  };
  // a heading's date first: "Oct 31, 2026 at 9:30 a.m."
  const heading = (t) => {
    const [time, date] = asOf(t).split(" on ");
    return `${date} at ${time}`;
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

<!-- a photo and its caption, under a note or among its further paragraphs -->
{#snippet photo(p)}
  <figure class="photo">
    <a href={p.src}
      ><img
        src={p.src}
        alt={p.caption || "Photo for this update"}
        loading="lazy"
      /></a
    >
    {#if p.caption}<figcaption>{p.caption}</figcaption>{/if}
  </figure>
{/snippet}

<!-- laid out like a README on GitHub: a heading per update, the note, its photo, its minor changes as a list with code-style
     times, then its comments -->
<main class="page">
  <h1>Trackside</h1>
  <a class="back" href={MAP}>← Back to the map</a>
  {#each shown as n (anchor(n.time))}
    <article id={anchor(n.time)}>
      <h2>{heading(n.time)}</h2>
      <p class="note">{n.text}</p>
      {#if n.photo}{@render photo(n.photo)}{/if}
      {#each n.more as m}
        {#if m.photo}{@render photo(m.photo)}{:else}<p class="note">
            {m.text}
          </p>{/if}
      {/each}
      {#if n.minor.length}
        <h3>Follow-ups</h3>
        <ul class="minor">
          <!-- oldest first, in the order they happened (the card shows the newest first) -->
          {#each [...n.minor].reverse() as m}<li>
              <code>{minorTime(m.time, n.time)}</code>
              {m.text}
            </li>{/each}
        </ul>
      {/if}
      <div class="discuss">
        <button
          class="comments-link"
          aria-expanded={open === anchor(n.time)}
          onclick={() =>
            (open = open === anchor(n.time) ? null : anchor(n.time))}
          ><span aria-hidden="true">💬</span>
          {open === anchor(n.time)
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
            {#each counts[term(n.time)].reactions as [e, c]}<span class="pill"
                >{e} {c}</span
              >{/each}
          </span>
        {/if}
      </div>
      {#if open === anchor(n.time)}<div class="comments" use:giscus={n.time}></div>{/if}
    </article>
  {/each}
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
  /* a GitHub README look: system font, headings with a rule under them, link colour for links, code-style times; all sizes
     in rem so they follow the iPhone's Text Size setting */
  .page {
    max-width: calc(640rem / 17);
    margin: 0 auto;
    padding: calc(16px + env(safe-area-inset-top, 0px)) 16px 32px;
    font-size: calc(15rem / 17);
    line-height: 1.5;
  }
  h1 {
    margin: 12px 0 4px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--line);
    font-size: calc(26rem / 17);
    line-height: 1.25;
  }
  .back {
    color: var(--accent);
    font-size: calc(13rem / 17);
    text-decoration: none;
  }
  h2 {
    margin: 28px 0 8px;
    padding-bottom: 5px;
    border-bottom: 1px solid var(--line);
    font-size: calc(19rem / 17);
    line-height: 1.25;
  }
  h3 {
    margin: 14px 0 4px;
    font-size: calc(15rem / 17);
  }
  /* paragraphs spaced apart (the first sits right under the heading) */
  .note {
    margin: 10px 0 0;
  }
  h2 + .note {
    margin-top: 0;
  }
  /* an update's photo, the page's width, opening full size when tapped */
  .photo {
    margin: 10px 0 0;
  }
  .photo img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 6px;
  }
  /* with room under it, so the caption reads as the photo's and not the next paragraph's */
  .photo figcaption {
    margin: 4px 0 20px;
    font-size: calc(13rem / 17);
    font-style: italic;
    color: var(--mute);
  }
  /* the minor changes, a bullet list, each time in GitHub's inline-code style */
  .minor {
    margin: 0;
    padding-left: 22px;
  }
  .minor li + li {
    margin-top: 4px;
  }
  code {
    padding: 0.15em 0.4em;
    border-radius: 6px;
    background: rgba(129, 139, 152, 0.18);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 85%;
  }
  /* the comments link (in the link colour) and the reactions as GitHub's pills */
  .discuss {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 12px;
  }
  .comments-link {
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    font-size: calc(14rem / 17);
    color: var(--accent);
    cursor: pointer;
  }
  .reactions {
    display: inline-flex;
    gap: 6px;
  }
  .pill {
    padding: 0 8px;
    border: 1px solid var(--line);
    border-radius: 2em;
    background: var(--bg);
    font-size: calc(12rem / 17);
  }
  /* the giscus thread, set off from the update by a dashed line */
  .comments {
    margin-top: 10px;
    padding-top: 12px;
    border-top: 1px dashed var(--line);
  }
  /* the page buttons, drawn like the Oldest / Newest switch in the giscus comments (GitHub's segmented control): a grey
     track, the buttons you can press raised on it with an outline and bold text, a button you can't press flat and faded.
     GitHub's own colours, light and dark, as giscus uses them */
  .pager {
    --track: #eff2f5;
    --knob: #ffffff;
    --knob-line: #818b98;
    --knob-ink: #1f2328;
    --flat-ink: #59636e;
    display: flex;
    gap: 0;
    width: fit-content;
    margin: 24px auto 0;
    padding: 0;
    border-radius: 6px;
    background: var(--track);
  }
  @media (prefers-color-scheme: dark) {
    .pager {
      --track: #212830;
      --knob: #0d1117;
      --knob-line: #656c76;
      --knob-ink: #f0f6fc;
      --flat-ink: #9198a1;
    }
  }
  .pager button {
    min-width: calc(96rem / 17);
    min-height: calc(36rem / 17);
    padding: 0 calc(14rem / 17);
    border: 1px solid var(--knob-line);
    border-radius: 6px;
    background: var(--knob);
    color: var(--knob-ink);
    font-family:
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      "Noto Sans",
      Helvetica,
      Arial,
      sans-serif;
    font-size: calc(14rem / 17);
    font-weight: 600;
  }
  .pager button:disabled {
    border-color: transparent;
    background: transparent;
    color: var(--flat-ink);
    font-weight: 400;
    cursor: default;
  }
  /* on a phone: the spacing from before, the buttons sharing the full width with a gap and tall enough to tap, in the same
     colours (a button you can't press keeps the track colour) */
  @media (max-width: 760px) {
    .pager {
      gap: 8px;
      width: auto;
      margin-top: 24px;
      background: none;
    }
    .pager button {
      flex: 1;
      min-height: calc(44rem / 17);
    }
    .pager button:disabled {
      background: var(--track);
    }
  }
</style>
