<script>
  // The past updates page: every status note, newest first, each with an id from its time stamp (e.g. #2026-10-30T20-45) so
  // a single update can be linked to
  import { status, asOf } from "./lib/status.js";

  const MAP = import.meta.env.BASE_URL;
  const anchor = (t) =>
    t
      .toISOString()
      .slice(0, 16)
      .replace(/:/g, "-");

  // Comments: one GitHub Discussion per update, through giscus, in the "Past Updates page comments" category. Each update's
  // thread is titled by its Yukon time, e.g. "Update 2026-10-31 09:30" (the title must never change, or the thread is lost).
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
  const term = (t) =>
    "Update " +
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Whitehorse",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .format(t)
      .replace(",", "");
  // the update whose comments are open (one at a time, so the page stays light)
  let open = $state(null);
  // load giscus into the element for this update's thread
  function giscus(el, t) {
    const s = document.createElement("script");
    s.src = "https://giscus.app/client.js";
    Object.entries(GISCUS).forEach(([k, v]) => s.setAttribute(k, v));
    s.setAttribute("data-term", term(t));
    el.appendChild(s);
  }
</script>

<main class="page">
  <a class="back" href={MAP}>← Back to the map</a>
  <h1>Past updates</h1>
  <ol class="list">
    {#each status.history as n}
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
          aria-expanded={open === n}
          onclick={() => (open = open === n ? null : n)}
          >{open === n ? "Hide comments" : "Comments"}</button
        >
        {#if open === n}<div class="comments" use:giscus={n.time}></div>{/if}
      </li>
    {/each}
  </ol>
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
  /* the comments toggle, a plain text link, and the giscus thread it opens */
  .comments-link {
    display: block;
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
