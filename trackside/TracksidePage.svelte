<script>
  // The Trackside page: every status note, newest first, each with its slug as its id (e.g.
  // ?post=clipper-completes-span-36). It is prerendered at build time (trackside/prerender.js) as pages of 10
  // (/trackside/, /trackside/page/2/, …), each with its own title, description and Open Graph photo; view says which one
  // this is
  import { onMount } from "svelte";
  import { status, asOf, followUpTime } from "../src/lib/status.js";
  import { term, fetchCounts, SITE } from "../src/lib/comments.js";
  import Icon from "../src/Icon.svelte";

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
  // the addresses of a page of updates, and in full, for the Open Graph tags
  const pageUrl = (p) => (p === 1 ? TRACKSIDE : `${TRACKSIDE}page/${p}/`);
  const full = (path) => new URL(path, SITE).href;
  // update text cut into plain pieces and span numbers ('span 36', 'spans 70 and 71') that link to the map's ?span=N view;
  // a span already in `seen` (linked earlier in the same update) stays plain
  const SPANS = /\b[Ss]pans? \d+(?:(?:, and |, | and )\d+)*/g;
  function parts(text, seen) {
    const out = [];
    let last = 0;
    for (const m of text.matchAll(SPANS)) {
      if (m.index > last) out.push({ text: text.slice(last, m.index) });
      const nums = m[0].match(/\d+/g);
      if (nums.length === 1) out.push({ text: m[0], span: +nums[0] });
      else m[0].split(/(\d+)/).forEach((s, i) => s && out.push(i % 2 ? { text: s, span: +s } : { text: s }));
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ text: text.slice(last) });
    return out.map((p) => {
      if (!(p.span >= 1 && p.span <= 105) || seen.has(p.span)) return { text: p.text };
      seen.add(p.span);
      return p;
    });
  }
  // the linked pieces of every text in an update (summaries, paragraphs, photo captions), in the order they show, keyed by
  // the note, follow-up, paragraph or photo
  function linkPlan(n) {
    const seen = new Set(),
      plan = new Map();
    const add = (key, text) => plan.set(key, parts(text, seen));
    const addPhoto = (p) => p?.caption && add(p, p.caption);
    const addBlock = (list) => list.forEach((m) => (m.photo ? addPhoto(m.photo) : m.text && add(m, m.text)));
    add(n, n.summary);
    addPhoto(n.photo);
    addBlock(n.block);
    [...n.followUps].reverse().forEach((f) => {
      add(f, f.summary);
      addPhoto(f.photo);
      addBlock(f.block);
    });
    return plan;
  }
  let counts = $state({});

  // Pages of 10 updates, newest first
  const PAGE_SIZE = 10;
  const pages = Math.max(1, Math.ceil(status.history.length / PAGE_SIZE));
  const page = $derived(Math.min(Math.max(1, view.page || 1), pages));
  const shown = $derived(status.history.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));

  // what search engines and link previews show: the page's title, a fixed description, and the newest photo
  const title = $derived(
    page > 1 ? `Trackside, page ${page} · Clayton Clipper Tracker` : "Trackside · Clayton Clipper Tracker",
  );
  const description =
    "Updates and photos from along the Surrey Langley SkyTrain guideway, following the Clayton Clipper gantry span by span.";
  const image = status.history.find((n) => n.photo)?.photo;
  const url = $derived(full(pageUrl(page)));

  // the slug of the update whose comments are open (one at a time, so the page stays light); a string, since $state would
  // wrap an update object in a proxy that never equals the original. ?post=<slug>&comments (the progress card's Comments
  // button) scrolls to that update and opens its comments; ?post=<slug> alone just scrolls to it.
  let open = $state(null);
  let copied = $state(false);
  let copyTimer;
  async function copyPermalink(n) {
    try {
      await navigator.clipboard.writeText(full(`${TRACKSIDE}${n.slug}/`));
      copied = true;
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copied = false), 1800);
    } catch (error) {
      console.error("Could not copy permalink", error);
    }
  }
  // a date heading's click: the address becomes ?post=<slug> and the update scrolls into view, with no hash anchor
  function jumpTo(e, slug) {
    e.preventDefault();
    const params = new URLSearchParams(location.search);
    params.set("post", slug);
    params.delete("comments");
    history.replaceState(null, "", `${location.pathname}?${params}`);
    document.getElementById(slug)?.scrollIntoView();
  }
  onMount(() => {
    const params = new URLSearchParams(location.search),
      // the old #slug links still work
      id = params.get("post") ?? location.hash.slice(1);
    fetchCounts().then((c) => (counts = c));
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
    s.setAttribute("data-theme", new URL(`${import.meta.env.BASE_URL}giscus.css`, location.origin).href);
    s.setAttribute("data-term", term(t));
    el.appendChild(s);
  }
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={url} />
  <meta property="og:site_name" content="Clayton Clipper Tracker" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Trackside" />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={url} />
  {#if image}
    <meta property="og:image" content={full(image.src)} />
    {#if image.caption}<meta property="og:image:alt" content={image.caption} />{/if}
    <meta name="twitter:card" content="summary_large_image" />
  {:else}
    <meta name="twitter:card" content="summary" />
  {/if}
</svelte:head>

<!-- update text with its span numbers linked to the map, the first time each appears in an update (the giscus threads and
     the headings stay plain) -->
{#snippet linked(pieces)}{#each pieces as p}{#if p.span}<a
        class="text-(--link)"
        href="{MAP}?span={p.span}"
        title="Zoom to span {p.span} on the map">{p.text}</a
      >{:else}{p.text}{/if}{/each}{/snippet}

<!-- a photo and its caption, under a note or among its further paragraphs -->
{#snippet photo(p, plan)}
  <figure class="mx-0 mt-2.5 mb-0">
    <a href={p.src}
      ><img
        class="block h-auto w-full rounded-md"
        src={p.src}
        alt={p.caption || "Photo for this update"}
        loading="lazy"
      /></a
    >
    {#if p.caption}<figcaption class="mt-1 mb-5 text-sm text-(--mute) italic">
        {@render linked(plan.get(p))}
      </figcaption>{/if}
  </figure>
{/snippet}

<!-- laid out like a README on GitHub: a heading per update, the note, its photo, its follow-ups as a list with code-style
     times, then its comments -->
<main class="page-column">
  <!-- a slim bar: the Clayton Clipper logo (back to the top of Trackside) and the page's name on the left, a button back to
       the map on the right. It stays at the top of the screen while the updates scroll under it, clear of the iPhone's
       notch; its own top padding takes the place of the page's space above it, so it sits where it did before scrolling -->
  <header class="page-header">
    <a class="block leading-[0]" href={TRACKSIDE}
      ><img class="h-10 w-auto logo" src="{MAP}images/logo.png" alt="Clayton Clipper" width="625" height="351" /></a
    >
    <h1 class="page-header-title">Trackside</h1>
    <nav class="page-header-nav">
      <a class="btn btn-grey" href={MAP}>← Map</a>
    </nav>
  </header>
  {#each shown as n (n.slug)}
    {@const plan = linkPlan(n)}
    <!-- an update a link jumps to lands below the bar, not under it; a wide gap separates one update from the next, so
         the comments link reads as the end of its own update rather than the start of the next -->
    <article id={n.slug} class="scroll-mt-[calc(var(--spacing)*19_+_env(safe-area-inset-top,0px))] [article+&]:mt-9">
      <!-- the date links to the update's own anchor on the page, drawn as plain heading text; with a title, screen readers
           hear the date and the title (the date first, so the visible text is in the name, for voice control) -->
      <h2
        class="mt-7 mb-2 flex items-center justify-between gap-2 border-b border-(--line) pb-1.25 text-xl leading-tight font-bold"
      >
        <a
          class="text-inherit no-underline"
          href="?post={n.slug}"
          onclick={(e) => jumpTo(e, n.slug)}
          aria-label={n.title && !n.post ? `${heading(n.time)}: ${n.title}` : undefined}>{label(n)}</a
        >
        <button
          class="shrink-0 border-0 bg-transparent p-1 text-(--mute) hover:text-(--accent)"
          type="button"
          title="Copy permalink"
          aria-label="Copy permalink"
          onclick={() => copyPermalink(n)}><Icon kind="link" /></button
        >
      </h2>
      <!-- a post leads with its title, with just its date under it -->
      {#if n.post && n.title}<p class="mx-0 -mt-1 mb-2 text-sm text-(--mute)">
          {dateOnly(n.time)}
        </p>{/if}
      <p class="m-0">{@render linked(plan.get(n))}</p>
      {#if n.photo}{@render photo(n.photo, plan)}{/if}
      {#each n.block as m}
        {#if m.photo}{@render photo(m.photo, plan)}{:else}<p class="m-0 mt-2.5">
            {@render linked(plan.get(m))}
          </p>{/if}
      {/each}
      {#if n.followUps.length}
        <h3 class="mt-3.5 mb-1 text-base font-bold">Follow-ups</h3>
        <ul class="mx-0 mt-0 mb-2 list-disc pl-5.5 [&>li+li]:mt-2.5">
          <!-- oldest first, in the order they happened (the card shows the newest first) -->
          {#each [...n.followUps].reverse() as m}<li>
              <code
                class="rounded-md bg-[rgba(129,139,152,0.18)] px-[0.4em] py-[0.15em] font-[family-name:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace] text-[85%]"
                >{followUpTime(m.time, n.time)}</code
              >
              {@render linked(plan.get(m))}
              {#if m.photo}{@render photo(m.photo, plan)}{/if}
              {#each m.block as b}
                {#if b.photo}{@render photo(b.photo, plan)}{:else}<p class="m-0 mt-2.5">
                    {@render linked(plan.get(b))}
                  </p>{/if}
              {/each}
            </li>{/each}
        </ul>
      {/if}
      <div class="mt-2 flex flex-wrap items-center gap-2.5">
        <!-- the comments link, in the link colour -->
        <button
          class="cursor-pointer border-0 bg-transparent p-0 text-sm text-(--link)"
          aria-expanded={open === n.slug}
          onclick={() => (open = open === n.slug ? null : n.slug)}
          ><span aria-hidden="true">💬</span>
          {open === n.slug
            ? "Hide comments"
            : counts[term(n.time)]?.comments
              ? `Comments (${counts[term(n.time)].comments})`
              : "Comments"}</button
        >
        {#if counts[term(n.time)]?.reactions.length}
          <!-- the reactions as GitHub's pills -->
          <span
            class="inline-flex gap-1.5"
            aria-label="Reactions: {counts[term(n.time)].reactions.map(([e, c]) => `${e} ${c}`).join(', ')}"
          >
            {#each counts[term(n.time)].reactions as [e, c]}<span
                class="rounded-full border border-(--line) bg-(--bg) px-2 text-xs">{e} {c}</span
              >{/each}
          </span>
        {/if}
      </div>
      <!-- the giscus thread, set off from the update by a dashed line -->
      {#if open === n.slug}<div
          class="mt-2.5 border-t border-dashed border-(--line) pt-3"
          use:giscus={n.time}
        ></div>{/if}
    </article>
  {/each}
  <!-- the first page has one button to older updates; later pages go either way, with Older off on the last page; links to
       the prerendered pages, so search engines follow them too. Drawn like the Oldest / Newest switch in the giscus
       comments (GitHub's segmented control): a grey track, the buttons you can press raised on it with an outline and
       bold text, a button you can't press flat and faded, in GitHub's own colours, light and dark. On a phone: the
       buttons share the full width with a gap and are tall enough to tap, with no track behind them (a button you can't
       press keeps the track colour). -->
  {#if pages > 1}
    <nav
      class="mx-auto mt-6 flex w-fit rounded-md bg-(--button-bg) phone:w-auto phone:gap-2 phone:bg-transparent"
      aria-label="Pages of updates"
    >
      {#if page === 1}
        <a class="pager-link" href={pageUrl(2)} rel="next">Show older</a>
      {:else}
        <a class="pager-link" href={pageUrl(page - 1)} rel="prev">Newer</a>
        {#if page < pages}<a class="pager-link" href={pageUrl(page + 1)} rel="next">Older</a>{:else}<span
            class="pager-link pager-link-off">Older</span
          >{/if}
      {/if}
    </nav>
  {/if}
  <!-- the footer, at the very bottom of every Trackside page: who's behind this, and a link to the About page; small and
       muted, centred under a thin line, with the link on its own line -->
  <footer class="mt-10 border-t border-(--line) pt-3.5 pb-1 text-center text-xs text-(--mute)">
    <p class="mx-0 mt-0 mb-1">A hobby project by Mike, not affiliated with TransLink.</p>
    <a class="text-(--link)" href="{MAP}about/">About this site</a>
  </footer>
  {#if copied}<div
      class="fixed inset-x-0 bottom-5 z-20 mx-auto w-fit rounded-md bg-(--ink) px-3 py-2 text-sm text-(--panel) shadow-card"
      role="status"
      aria-live="polite"
    >
      Permalink copied
    </div>{/if}
</main>
