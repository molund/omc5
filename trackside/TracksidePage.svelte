<script>
  // The Trackside page: every status note, newest first, each with an id from its time stamp (e.g. #2026-10-30T20-45). It
  // is prerendered at build time (trackside/prerender.js) as pages of 10 (/trackside/, /trackside/page/2/, …) and a
  // page per update (/trackside/2026-10-30T20-45/), each with its own title, description and Open Graph photo; view says
  // which one this is
  import { onMount } from "svelte";
  import { status, asOf, followUpTime } from "../src/lib/status.js";
  import { anchor, term, fetchCounts, SITE } from "../src/lib/comments.js";

  let { view = { page: 1 } } = $props();

  const MAP = import.meta.env.BASE_URL;
  const TRACKSIDE = `${MAP}trackside/`;
  // Comments: one GitHub Discussion per update, through giscus, in the "Trackside" category, titled by term() in
  // src/lib/comments.js
  const GISCUS = {
    "data-repo": "molund/omc5",
    "data-repo-id": "R_kgDOVbOMWA",
    "data-category": "Trackside",
    "data-category-id": "DIC_kwDOVbOMWM4DKF3d",
    "data-mapping": "specific",
    "data-strict": "1",
    "data-reactions-enabled": "1",
    "data-emit-metadata": "0",
    "data-input-position": "top",
    "data-lang": "en",
    crossorigin: "anonymous",
    async: "",
  };
  // a heading's date first: "Oct 31, 2026 at 9:30 a.m."
  const heading = (t) => {
    const [time, date] = asOf(t).split(" on ");
    return `${date} at ${time}`;
  };
  // the addresses of an update's own page and of a page of updates, and either in full, for the Open Graph tags
  const postUrl = (n) => `${TRACKSIDE}${anchor(n.time)}/`;
  const pageUrl = (p) => (p === 1 ? TRACKSIDE : `${TRACKSIDE}page/${p}/`);
  const full = (path) => new URL(path, SITE).href;
  let counts = $state({});

  // Pages of 10 updates, newest first, or the one update this page is for
  const PAGE_SIZE = 10;
  const pages = Math.max(1, Math.ceil(status.history.length / PAGE_SIZE));
  const post = $derived(
    view.post ? status.history.find((n) => anchor(n.time) === view.post) : null,
  );
  const page = $derived(
    post ? null : Math.min(Math.max(1, view.page || 1), pages),
  );
  const shown = $derived(
    post
      ? [post]
      : status.history.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
  );

  // what search engines and link previews show: a post's title (else its date) and note, and its photo (or the first among
  // its further photos); a page of updates, the newest photo
  const title = $derived(
    post
      ? post.title
        ? `${post.title} · Clayton Clipper Tracker`
        : `${heading(post.time)} · Trackside · Clayton Clipper Tracker`
      : page > 1
        ? `Trackside, page ${page} · Clayton Clipper Tracker`
        : "Trackside · Clayton Clipper Tracker",
  );
  // a note cut at a word to about 155 characters, the length search results show
  const clip = (s, n = 155) =>
    s.length <= n
      ? s
      : s.slice(0, s.lastIndexOf(" ", n - 1)).replace(/[\s,.;:]+$/, "") + "…";
  const description = $derived(
    post
      ? clip(post.text)
      : "Updates and photos from along the Surrey Langley SkyTrain guideway, following the Clayton Clipper gantry span by span.",
  );
  const image = $derived(
    post
      ? post.photo || post.more.find((m) => m.photo)?.photo
      : status.history.find((n) => n.photo)?.photo,
  );
  const url = $derived(full(post ? postUrl(post) : pageUrl(page)));

  // the anchor of the update whose comments are open (one at a time, so the page stays light); a string, since $state would
  // wrap an update object in a proxy that never equals the original. ?comments opens an update's comments: on its own page,
  // or with its anchor (?comments#2026-10-31T16-30, the progress card's Comments button) on a page of updates.
  let open = $state(null);
  onMount(() => {
    const params = new URLSearchParams(location.search),
      id = location.hash.slice(1);
    fetchCounts().then((c) => (counts = c));
    if (post) {
      if (params.has("comments")) open = view.post;
      return;
    }
    if (id) {
      if (params.has("comments")) open = id;
      document.getElementById(id)?.scrollIntoView();
    }
  });
  // load giscus into the element for this update's thread
  function giscus(el, t) {
    const s = document.createElement("script");
    s.src = "https://giscus.app/client.js";
    Object.entries(GISCUS).forEach(([k, v]) => s.setAttribute(k, v));
    // GitHub light / dark as before, minus the upvote arrows (public/giscus.css)
    s.setAttribute(
      "data-theme",
      new URL(`${import.meta.env.BASE_URL}giscus.css`, location.origin).href,
    );
    s.setAttribute("data-term", term(t));
    el.appendChild(s);
  }
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={url} />
  <meta property="og:site_name" content="Clayton Clipper Tracker" />
  <meta property="og:type" content={post ? "article" : "website"} />
  <meta
    property="og:title"
    content={post
      ? post.title || `${heading(post.time)} · Trackside`
      : "Trackside"}
  />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={url} />
  {#if image}
    <meta property="og:image" content={full(image.src)} />
    {#if image.caption}<meta
        property="og:image:alt"
        content={image.caption}
      />{/if}
    <meta name="twitter:card" content="summary_large_image" />
  {:else}
    <meta name="twitter:card" content="summary" />
  {/if}
  {#if post}<meta
      property="article:published_time"
      content={post.time.toISOString()}
    />{/if}
</svelte:head>

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

<!-- laid out like a README on GitHub: a heading per update, the note, its photo, its follow-ups as a list with code-style
     times, then its comments -->
<main class="page">
  <!-- a slim bar: the Clayton Clipper logo (back to the top of Trackside) and the page's name on the left, buttons back to
       the map (and, on an update's own page, to all updates) on the right -->
  <header class="bar">
    <a class="logo" href={TRACKSIDE}
      ><img
        src="{MAP}images/logo.png"
        alt="Clayton Clipper"
        width="625"
        height="351"
      /></a
    >
    <h1>Trackside</h1>
    <nav class="links">
      {#if post}<a class="button" href={TRACKSIDE}>← All updates</a>{/if}
      <a class="button" href={MAP}>← Map</a>
    </nav>
  </header>
  {#each shown as n (anchor(n.time))}
    <article id={anchor(n.time)}>
      <!-- on a page of updates, the date links to the update's own page; with a title, screen readers hear the date and
           the title (the date first, so the visible text is in the name, for voice control) -->
      <h2>
        {#if post}{heading(n.time)}{:else}<a
            href={postUrl(n)}
            aria-label={n.title ? `${heading(n.time)}: ${n.title}` : undefined}
            >{heading(n.time)}</a
          >{/if}
      </h2>
      <p class="note">{n.text}</p>
      {#if n.photo}{@render photo(n.photo)}{/if}
      {#each n.more as m}
        {#if m.photo}{@render photo(m.photo)}{:else}<p class="note">
            {m.text}
          </p>{/if}
      {/each}
      {#if n.followUps.length}
        <h3>Follow-ups</h3>
        <ul class="follow-ups">
          <!-- oldest first, in the order they happened (the card shows the newest first) -->
          {#each [...n.followUps].reverse() as m}<li>
              <code>{followUpTime(m.time, n.time)}</code>
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
      {#if open === anchor(n.time)}<div
          class="comments"
          use:giscus={n.time}
        ></div>{/if}
    </article>
  {/each}
  <!-- the first page has one button to older updates; later pages go either way, with Next off on the last page; links to
       the prerendered pages, so search engines follow them too -->
  {#if !post && pages > 1}
    <nav class="pager" aria-label="Pages of updates">
      {#if page === 1}
        <a href={pageUrl(2)} rel="next">Show older</a>
      {:else}
        <a href={pageUrl(page - 1)} rel="prev">Previous</a>
        {#if page < pages}<a href={pageUrl(page + 1)} rel="next">Next</a
          >{:else}<span class="off">Next</span>{/if}
      {/if}
    </nav>
  {/if}
  <!-- the footer, at the very bottom of every Trackside page: who's behind this, and a link to the About page -->
  <footer class="foot">
    <p>A hobby project by Mike, not affiliated with TransLink.</p>
    <a href="{MAP}about/">About this site</a>
  </footer>
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
  /* the footer: small and muted, centred under a thin line, with the link on its own line */
  .foot {
    margin-top: 40px;
    padding: 14px 0 4px;
    border-top: 1px solid var(--line);
    text-align: center;
    font-size: calc(12.5rem / 17);
    color: var(--mute);
  }
  .foot p {
    margin: 0 0 4px;
  }
  .foot a {
    color: var(--accent);
  }
  /* the header bar: logo and name on the left, buttons on the right (wrapping under them when there isn't room), over a line */
  /* it stays at the top of the screen while the updates scroll under it, clear of the iPhone's notch; its own top padding
     takes the place of the page's space above it, so it sits where it did before scrolling */
  .bar {
    position: sticky;
    top: 0;
    z-index: 5;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 10px;
    margin: calc(-16px - env(safe-area-inset-top, 0px)) 0 4px;
    padding: calc(26px + env(safe-area-inset-top, 0px)) 0 8px;
    border-bottom: 1px solid var(--line);
    background: var(--bg);
  }
  /* an update a link jumps to lands below the bar, not under it */
  article {
    scroll-margin-top: calc(76rem / 17 + env(safe-area-inset-top, 0px));
  }
  .logo {
    display: block;
    line-height: 0;
  }
  .logo img {
    width: auto;
    height: calc(40rem / 17);
  }
  /* the page's name, small and spaced out beside the logo */
  h1 {
    margin: 0;
    font-size: calc(13rem / 17);
    font-weight: 700;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: var(--mute);
  }
  .links {
    display: flex;
    gap: 8px;
    margin-left: auto;
  }
  /* the buttons, in the pager's colours (GitHub's segmented control) */
  .button {
    --track: #eff2f5;
    --knob-line: #818b98;
    --knob-ink: #1f2328;
    display: inline-flex;
    align-items: center;
    padding: calc(6rem / 17) calc(12rem / 17);
    border: 1px solid var(--knob-line);
    border-radius: 6px;
    background: var(--track);
    color: var(--knob-ink);
    font-size: calc(14rem / 17);
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
  }
  @media (prefers-color-scheme: dark) {
    .button {
      --track: #212830;
      --knob-line: #656c76;
      --knob-ink: #f0f6fc;
    }
  }
  h2 {
    margin: 28px 0 8px;
    padding-bottom: 5px;
    border-bottom: 1px solid var(--line);
    font-size: calc(19rem / 17);
    line-height: 1.25;
  }
  /* a heading links to its update's own page, drawn as plain heading text */
  h2 a {
    color: inherit;
    text-decoration: none;
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
  /* the follow-ups, a bullet list, each time in GitHub's inline-code style */
  .follow-ups {
    margin: 0;
    padding-left: 22px;
  }
  .follow-ups li + li {
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
  /* the comments link sits close under its update, and a wide gap separates one update from the next, so the link reads
     as the end of its own update rather than the start of the next */
  .discuss {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 8px;
  }
  article + article {
    margin-top: 36px;
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
  /* links to the pages, drawn as buttons */
  .pager a,
  .pager .off {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    text-decoration: none;
    min-width: calc(96rem / 17);
    min-height: calc(36rem / 17);
    padding: 0 calc(14rem / 17);
    border: 1px solid var(--knob-line);
    border-radius: 6px;
    background: var(--knob);
    color: var(--knob-ink);
    font-family:
      -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica,
      Arial, sans-serif;
    font-size: calc(14rem / 17);
    font-weight: 600;
  }
  .pager .off {
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
    .pager a,
    .pager .off {
      flex: 1;
      min-height: calc(44rem / 17);
    }
    .pager .off {
      background: var(--track);
    }
  }
</style>
