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
  // just the date, "Nov 1, 2026", shown under a post's title
  const dateOnly = (t) => asOf(t).split(" on ")[1];
  // what an update's heading says: a post's title, or a status update's date and time
  const label = (n) => (n.post && n.title ? n.title : heading(n.time));
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
  <figure class="mx-0 mt-10 mb-0">
    <a href={p.src}
      ><img
        class="block h-auto w-full rounded-6"
        src={p.src}
        alt={p.caption || "Photo for this update"}
        loading="lazy"
      /></a
    >
    {#if p.caption}<figcaption class="mt-4 mb-20 text-13 text-(--mute) italic">
        {p.caption}
      </figcaption>{/if}
  </figure>
{/snippet}

<!-- laid out like a README on GitHub: a heading per update, the note, its photo, its follow-ups as a list with code-style
     times, then its comments -->
<main class="page-column">
  <!-- a slim bar: the Clayton Clipper logo (back to the top of Trackside) and the page's name on the left, buttons back to
       the map (and, on an update's own page, to all updates) on the right. It stays at the top of the screen while the
       updates scroll under it, clear of the iPhone's notch; its own top padding takes the place of the page's space above
       it, so it sits where it did before scrolling -->
  <header class="page-header">
    <a class="block leading-[0]" href={TRACKSIDE}
      ><img
        class="h-40 w-auto"
        src="{MAP}images/logo.png"
        alt="Clayton Clipper"
        width="625"
        height="351"
      /></a
    >
    <h1 class="page-header-title">Trackside</h1>
    <nav class="page-header-nav">
      {#if post}<a class="btn btn-grey" href={TRACKSIDE}>← All updates</a>{/if}
      <a class="btn btn-grey" href={MAP + "?hidecardopen=1"}>← Map</a>
    </nav>
  </header>
  {#each shown as n (anchor(n.time))}
    <!-- an update a link jumps to lands below the bar, not under it; a wide gap separates one update from the next, so
         the comments link reads as the end of its own update rather than the start of the next -->
    <article
      id={anchor(n.time)}
      class="scroll-mt-[calc(var(--spacing)*76_+_env(safe-area-inset-top,0px))] [article+&]:mt-36"
    >
      <!-- on a page of updates, the date links to the update's own page, drawn as plain heading text; with a title,
           screen readers hear the date and the title (the date first, so the visible text is in the name, for voice
           control) -->
      <h2
        class="mt-28 mb-8 border-b border-(--line) pb-5 text-19 leading-tight font-bold"
      >
        {#if post}{label(n)}{:else}<a
            class="text-inherit no-underline"
            href={postUrl(n)}
            aria-label={n.title && !n.post
              ? `${heading(n.time)}: ${n.title}`
              : undefined}>{label(n)}</a
          >{/if}
      </h2>
      <!-- a post leads with its title, with just its date under it -->
      {#if n.post && n.title}<p class="mx-0 -mt-4 mb-8 text-13 text-(--mute)">
          {dateOnly(n.time)}
        </p>{/if}
      <p class="m-0">{n.text}</p>
      {#if n.photo}{@render photo(n.photo)}{/if}
      {#each n.more as m}
        {#if m.photo}{@render photo(m.photo)}{:else}<p class="m-0 mt-10">
            {m.text}
          </p>{/if}
      {/each}
      {#if n.followUps.length}
        <h3 class="mt-14 mb-4 text-15 font-bold">Follow-ups</h3>
        <ul class="m-0 list-disc pl-22 [&>li+li]:mt-4">
          <!-- oldest first, in the order they happened (the card shows the newest first) -->
          {#each [...n.followUps].reverse() as m}<li>
              <code
                class="rounded-6 bg-[rgba(129,139,152,0.18)] px-[0.4em] py-[0.15em] font-[family-name:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace] text-[85%]"
                >{followUpTime(m.time, n.time)}</code
              >
              {m.text}
            </li>{/each}
        </ul>
      {/if}
      <div class="mt-8 flex flex-wrap items-center gap-10">
        <!-- the comments link, in the link colour -->
        <button
          class="cursor-pointer border-0 bg-transparent p-0 text-14 text-(--accent)"
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
          <!-- the reactions as GitHub's pills -->
          <span
            class="inline-flex gap-6"
            aria-label="Reactions: {counts[term(n.time)].reactions
              .map(([e, c]) => `${e} ${c}`)
              .join(', ')}"
          >
            {#each counts[term(n.time)].reactions as [e, c]}<span
                class="rounded-[2em] border border-(--line) bg-(--bg) px-8 text-12"
                >{e} {c}</span
              >{/each}
          </span>
        {/if}
      </div>
      <!-- the giscus thread, set off from the update by a dashed line -->
      {#if open === anchor(n.time)}<div
          class="mt-10 border-t border-dashed border-(--line) pt-12"
          use:giscus={n.time}
        ></div>{/if}
    </article>
  {/each}
  <!-- the first page has one button to older updates; later pages go either way, with Next off on the last page; links to
       the prerendered pages, so search engines follow them too. Drawn like the Oldest / Newest switch in the giscus
       comments (GitHub's segmented control): a grey track, the buttons you can press raised on it with an outline and
       bold text, a button you can't press flat and faded, in GitHub's own colours, light and dark. On a phone: the
       buttons share the full width with a gap and are tall enough to tap, with no track behind them (a button you can't
       press keeps the track colour). -->
  {#if !post && pages > 1}
    <nav
      class="mx-auto mt-24 flex w-fit rounded-6 bg-(--button-bg) phone:w-auto phone:gap-8 phone:bg-transparent"
      aria-label="Pages of updates"
    >
      {#if page === 1}
        <a class="pager-link" href={pageUrl(2)} rel="next">Show older</a>
      {:else}
        <a class="pager-link" href={pageUrl(page - 1)} rel="prev">Previous</a>
        {#if page < pages}<a
            class="pager-link"
            href={pageUrl(page + 1)}
            rel="next">Next</a
          >{:else}<span class="pager-link pager-link-off">Next</span>{/if}
      {/if}
    </nav>
  {/if}
  <!-- the footer, at the very bottom of every Trackside page: who's behind this, and a link to the About page; small and
       muted, centred under a thin line, with the link on its own line -->
  <footer
    class="mt-40 border-t border-(--line) pt-14 pb-4 text-center text-12-5 text-(--mute)"
  >
    <p class="mx-0 mt-0 mb-4">
      A hobby project by Mike, not affiliated with TransLink.
    </p>
    <a class="text-(--accent)" href="{MAP}about/">About this site</a>
  </footer>
</main>
