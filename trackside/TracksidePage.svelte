<script>
  // The Trackside page: every status note, newest first, each with its slug as its id (e.g.
  // ?post=clipper-completes-span-36). It is prerendered at build time (trackside/prerender.js) as pages of 10
  // (/trackside/, /trackside/page/2/, …), each with its own title, description and Open Graph photo; view says which one
  // this is
  import { onMount } from "svelte";
  import { status, asOf, followUpTime } from "../src/lib/status.js";
  import { inline, plainText } from "../src/lib/inline.js";
  import { SITE, REMARK42, threadUrl, fetchRemarkCounts, fetchFrozen } from "../src/lib/comments.js";
  import { track } from "../src/lib/track.js";
  import { blogPosting, blogPage, ldScript, isoBC, published, modified } from "../src/lib/seo.js";
  import Icon from "../src/Icon.svelte";
  import SIZES from "virtual:photo-sizes";

  let { view = { page: 1 } } = $props();

  const MAP = import.meta.env.BASE_URL;
  const TRACKSIDE = `${MAP}trackside/`;

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
  // update text cut into pieces: its links and bold (src/lib/inline.js), and outside the links, span numbers ('span 36',
  // 'spans 70 and 71') that link to the map's ?span=N view; a span already in `seen` (linked earlier in the same update)
  // stays plain
  const SPANS = /\b[Ss]pans? \d+(?:(?:, and |, | and )\d+)*/g;
  function spanParts(text) {
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
    return out;
  }
  function parts(text, seen) {
    return inline(text).flatMap((piece) =>
      piece.href
        ? [piece]
        : spanParts(piece.text).map((p) => {
            if (!(p.span >= 1 && p.span <= 105) || seen.has(p.span)) return { text: p.text, bold: piece.bold };
            seen.add(p.span);
            return { ...p, bold: piece.bold };
          }),
    );
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
  // the comment counts of the updates on the page, by thread address (threadUrl() in src/lib/comments.js)
  let counts = $state({});
  // the read-only threads (`comments: readonly`), by slug, as they were when the site was built (trackside/prerender.js)
  let frozen = $state({});
  const commentCount = (n) => (n.comments === "readonly" ? frozen[n.slug]?.count : counts[threadUrl(n.slug)]);
  // the comments button's words: "Leave a comment" only where one can be left
  const commentsLabel = (n) =>
    commentCount(n)
      ? `Comments (${commentCount(n)})`
      : commentCount(n) === 0 && n.comments === "on"
        ? "Leave a comment"
        : "Comments";

  // Pages of 10 updates, newest first
  const PAGE_SIZE = 10;
  const pages = Math.max(1, Math.ceil(status.history.length / PAGE_SIZE));
  const page = $derived(Math.min(Math.max(1, view.page || 1), pages));
  // an update's own page, /trackside/<slug>/ ({ slug } as the view): just that update, listed in the sitemap but not linked
  // from the site, and linking only to the first page of Trackside
  const single = $derived(view.slug ? status.history.find((n) => n.slug === view.slug) : null);
  const shown = $derived(single ? [single] : status.history.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));

  // what search engines and link previews show: on a page of updates, the page's title, a fixed description, and the
  // newest photo; on an update's own page, its title (or date), its summary, and its own photo
  const singleTitle = $derived(single && (single.title || heading(single.time)));
  const title = $derived(
    single
      ? `${singleTitle} · Clayton Clipper Tracker`
      : page > 1
        ? `Trackside, page ${page} · Clayton Clipper Tracker`
        : "Trackside · Clayton Clipper Tracker",
  );
  const description = $derived(
    single
      ? plainText(single.summary)
      : "Updates and photos from along the Surrey Langley SkyTrain guideway, following the Clayton Clipper gantry span by span.",
  );
  const image = $derived(
    single ? single.photo || single.block.find((m) => m.photo)?.photo : status.history.find((n) => n.photo)?.photo,
  );
  const url = $derived(full(single ? `${TRACKSIDE}${single.slug}/` : pageUrl(page)));

  // on the pages of updates, a long update is cut off at CLAMP rem with a fade and a Read more link to its own page; one
  // that would hide less than CLAMP_SLACK rem more shows whole (measured once the page is in the browser, so the built
  // page starts with every update cut off). The slugs of the ones shown whole; a list, since $state doesn't watch a Set
  const CLAMP = 32,
    CLAMP_SLACK = 6;
  let unclamped = $state([]);
  const clamped = (n) => !single && !unclamped.includes(n.slug);
  let copied = $state(false);
  let copyTimer;
  // the permalink icon is a real link to the update's own page, for search engines and for anyone without JavaScript;
  // a plain click copies the address instead, and a cmd-, ctrl-, shift- or middle-click still opens it
  async function copyPermalink(e, n) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    track("copy_permalink", { where: "trackside", slug: n.slug });
    try {
      await navigator.clipboard.writeText(full(`${TRACKSIDE}${n.slug}/`));
      copied = true;
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copied = false), 1800);
    } catch (error) {
      console.error("Could not copy permalink", error);
    }
  }
  onMount(() => {
    const params = new URLSearchParams(location.search),
      // the old #slug links still work
      id = params.get("post") ?? location.hash.slice(1);
    // one request to the comment server for the whole page's counts, for the updates whose comments are on; the read-only
    // threads come from the site itself, and only when the page has one
    const live = shown.filter((n) => n.comments === "on");
    if (live.length) fetchRemarkCounts(live.map((n) => threadUrl(n.slug))).then((c) => (counts = c));
    if (shown.some((n) => n.comments === "readonly")) fetchFrozen().then((f) => (frozen = f));
    // comments are on the updates' own pages now: an old ?post=<slug>&comments link goes to its thread there
    if (id && params.has("comments") && status.history.some((n) => n.slug === id))
      return location.replace(`${TRACKSIDE}${id}/#comments`);
    if (!single) {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      unclamped = [...document.querySelectorAll("[data-body]")]
        .filter((el) => el.scrollHeight <= (CLAMP + CLAMP_SLACK) * rem)
        .map((el) => el.dataset.body);
    }
    if (id) document.getElementById(id)?.scrollIntoView();
  });
  // a span link or a photo in an update, for Google Analytics; the update is the article the link is in
  const slugOf = (e) => e.currentTarget.closest("article")?.id;
  // an update's own page's ← Trackside button: back to the page of updates the reader came from, where they were on it,
  // when they came from one (a plain click); otherwise, and for a cmd-, ctrl-, shift- or middle-click, the first page
  function backToList(e) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0 || history.length < 2) return;
    let from;
    try {
      from = new URL(document.referrer);
    } catch {
      return;
    }
    if (from.origin !== location.origin) return;
    if (from.pathname !== TRACKSIDE && !from.pathname.startsWith(`${TRACKSIDE}page/`)) return;
    e.preventDefault();
    history.back();
  }
  // an update's own page loads its thread as the reader nears it (a screen away), or straight away when they arrive at
  // #comments (a Comments button on a page of updates, or the progress card's)
  function lazyRemark42(el, n) {
    let done = null;
    const load = () => {
      observer.disconnect();
      done ??= remark42(el, n);
    };
    const observer = new IntersectionObserver((seen) => seen.some((s) => s.isIntersecting) && load(), {
      rootMargin: "100% 0px",
    });
    if (location.hash === "#comments") load();
    else observer.observe(el);
    return {
      destroy: () => {
        observer.disconnect();
        done?.destroy();
      },
    };
  }
  // a colour variable of the site's as written in app.css's :root rule: the page itself only reports the scheme it's in
  function rawVar(name, rules = [...document.styleSheets].flatMap((sheet) => [...sheet.cssRules])) {
    for (const rule of rules) {
      if (rule.selectorText === ":root" && rule.style.getPropertyValue(name)) return rule.style.getPropertyValue(name);
      const inner = rule.cssRules && rawVar(name, [...rule.cssRules]);
      if (inner) return inner;
    }
  }
  // a colour of the site's (a variable in app.css) as "r, g, b", in the light or dark scheme: its light-dark() pair, as
  // the build writes it (var(--lightningcss-light,…)var(--lightningcss-dark,…)) or as app.css has it
  function siteRGB(el, name, scheme) {
    const raw = rawVar(name) ?? "",
      pair =
        raw.match(/--lightningcss-light,\s*([^)]+)\)\s*var\(--lightningcss-dark,\s*([^)]+)\)/) ??
        raw.match(/light-dark\(\s*([^,]+),\s*([^)]+)\)/),
      probe = document.createElement("span");
    probe.style.color = pair ? pair[scheme === "dark" ? 2 : 1] : `var(${name})`;
    el.append(probe);
    const rgb = getComputedStyle(probe).color.match(/\d+/g).slice(0, 3).join(", ");
    probe.remove();
    return rgb;
  }
  // Remark42's teal, in the site's link blues instead: its colour variables (custom-properties.css in Remark42), set on
  // the comment frame's root through custom_properties. Links and the Send button use the numbered ones; the named
  // ones (--primary-color and the like) only take in the light theme, since the dark theme sets its own on the body
  function remarkColours(el, theme) {
    const link = siteRGB(el, "--link", theme),
      button = siteRGB(el, "--link", "light"),
      hover = siteRGB(el, "--accent", "light");
    return {
      "--color9": `rgb(${link})`,
      "--color29": `rgb(${link})`,
      "--color33": `rgb(${hover})`,
      "--color15": `rgb(${button})`,
      "--color47": `rgb(${link}, 0.4)`,
      "--color48": `rgb(${link}, 0.6)`,
      "--color40": `rgb(${hover}, 0.45)`,
      "--color43": `rgb(${hover}, 0.35)`,
      "--color42": `rgb(${hover}, 0.25)`,
      "--color3": `rgb(${hover}, 0.15)`,
      "--color4": `rgb(${hover}, 0.1)`,
      "--primary-color": link,
      "--primary-brighter-color": hover,
      "--primary-darker-color": button,
    };
  }
  // load Remark42 into the element for an update's thread: the thread is the update's own page (threadUrl()). Remark42
  // draws into the element with the id remark42 and reads window.remark_config, whichever way it starts: by itself
  // when its script first loads, or through createInstance() once it has (each time the comments open again)
  function remark42(el, n) {
    el.id = "remark42";
    const theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    window.remark_config = {
      host: REMARK42.host,
      site_id: REMARK42.site,
      url: threadUrl(n.slug),
      page_title: label(n),
      theme,
      custom_properties: remarkColours(el, theme),
      components: ["embed"],
      // no "Subscribe by RSS" link under the comment box
      show_rss_subscription: false,
      // oldest first, as giscus showed them, instead of Remark42's most recent activity first; a reader's own pick in the
      // sort menu still wins
      default_sort: "+time",
    };
    if (window.REMARK42?.createInstance) window.REMARK42.createInstance(window.remark_config);
    else if (!document.querySelector(`script[src="${REMARK42.host}/web/embed.mjs"]`)) {
      const s = document.createElement("script");
      s.type = "module";
      s.src = `${REMARK42.host}/web/embed.mjs`;
      document.head.appendChild(s);
    }
    // closing the comments takes the newest instance down with them
    return { destroy: () => window.REMARK42?.destroy?.() };
  }
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={url} />
  <!-- every update as a feed, for feed readers and AI tools -->
  <link rel="alternate" type="application/atom+xml" title="Trackside" href="{TRACKSIDE}feed.xml" />
  <link rel="alternate" type="application/feed+json" title="Trackside" href="{TRACKSIDE}feed.json" />
  {#if single}<link rel="alternate" type="text/markdown" href="{TRACKSIDE}{single.slug}/index.md" />{/if}
  <meta property="og:site_name" content="Clayton Clipper Tracker" />
  <meta property="og:type" content={single ? "article" : "website"} />
  <meta property="og:title" content={single ? singleTitle : "Trackside"} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={url} />
  {#if single}
    <!-- an update's own page is an article, with its dates and author -->
    <meta property="article:published_time" content={published(single)} />
    <meta property="article:modified_time" content={modified(single)} />
    <meta property="article:author" content="{SITE}about/" />
  {/if}
  {#if image}
    <meta property="og:image" content={full(image.src)} />
    {#if image.caption}<meta property="og:image:alt" content={plainText(image.caption)} />{/if}
    <meta name="twitter:card" content="summary_large_image" />
  {:else}
    <meta name="twitter:card" content="summary" />
  {/if}
  <!-- what the page is, for search engines and AI tools: an update's own page is a blog post, with its dates and author; the
       first page of updates is the blog, and an older page a collection of its posts -->
  {#if single}{@html ldScript(blogPosting(single, singleTitle))}{:else}{@html ldScript(
      blogPage(shown, page, url, (n) => n.title || heading(n.time)),
    )}{/if}
</svelte:head>

<!-- update text with its links and bold, and its span numbers linked to the map, the first time each appears in an update
     (the giscus threads get no span links, and the headings stay plain) -->
{#snippet piece(p)}{#if p.href}<a class="text-(--link)" href={p.href}>{p.text}</a>{:else if p.span}<a
      class="text-(--link)"
      href="{MAP}?span={p.span}"
      onclick={(e) => track("span_link", { span: p.span, slug: slugOf(e) })}
      title="Zoom to span {p.span} on the map">{p.text}</a
    >{:else}{p.text}{/if}{/snippet}
{#snippet linked(pieces)}{#each pieces as p}{#if p.bold}<strong>{@render piece(p)}</strong>{:else}{@render piece(
        p,
      )}{/if}{/each}{/snippet}

<!-- a photo and its caption, under a note or among its further paragraphs -->
<!-- a read-only thread's comments, each with its author and date, its replies indented under it -->
{#snippet frozenComments(list)}<ul class="frozen-list">
    {#each list as c}<li class="frozen-comment">
        <p class="frozen-meta"><strong>{c.name}</strong> · {heading(new Date(c.time))}</p>
        <div class="frozen-text">{@html c.html}</div>
        {#if c.replies.length}{@render frozenComments(c.replies)}{/if}
      </li>{/each}
  </ul>{/snippet}
{#snippet photo(p, plan)}
  <!-- its width and height (read from the file when the site is built) only give its shape, so the page doesn't jump as
       it loads; the CSS still fits it to the column. The main photo on an update's own page loads first, the rest lazily -->
  {@const size = SIZES[p.src.split("/").pop()]}
  <figure class="mx-0 mt-2.5 mb-0">
    <a href={p.src} onclick={(e) => track("photo_open", { slug: slugOf(e) })}
      ><img
        class="update-photo block h-auto w-full"
        src={p.src}
        alt={plainText(p.caption) || "Photo for this update"}
        width={size?.[0]}
        height={size?.[1]}
        loading={single && p === image ? "eager" : "lazy"}
        fetchpriority={single && p === image ? "high" : undefined}
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
  <!-- a slim bar: the Clayton Clipper logo (to the map) and the page's name (to the top of Trackside) on the left, a button
       back to the map on the right. It stays at the top of the screen while the updates scroll under it, clear of the
       iPhone's notch; its own top padding takes the place of the page's space above it, so it sits where it did before
       scrolling -->
  <header class="page-header">
    <a class="block leading-[0]" href={MAP}
      ><img class="h-10 w-auto logo" src="{MAP}images/logo.png" alt="Clayton Clipper" width="625" height="351" /></a
    >
    <!-- the page's main heading, except on an update's own page, where the update's title is the main heading -->
    <svelte:element this={single ? "p" : "h1"} class="page-header-title"
      ><a class="text-inherit no-underline" href={TRACKSIDE}>Trackside</a></svelte:element
    >
    <!-- back to the map; on an update's own page, back to the updates instead (the logo still goes to the map) -->
    <nav class="page-header-nav">
      {#if single}<a class="btn btn-grey" href={TRACKSIDE} onclick={backToList}>← Trackside</a>{:else}<a
          class="btn btn-grey"
          href={MAP}>← Map</a
        >{/if}
    </nav>
  </header>
  {#each shown as n (n.slug)}
    {@const plan = linkPlan(n)}
    <!-- an update a link jumps to lands below the bar, not under it; each update is a card, with a gap above it, so
         the comments link reads as the end of its own update rather than the start of the next -->
    <article id={n.slug} class="update-card scroll-mt-[calc(var(--spacing)*19_+_env(safe-area-inset-top,0px))] mt-5">
      <!-- a title links to the update's own page (as the permalink button at the foot of the card does), except on that
           page itself -->
      <!-- an update with a title leads with its date in gold (a post's date, a status update's date and time), then the
           title as its heading; one without is headed by its date and time alone, drawn the same small gold. Dates and
           times are <time> elements, so machines can read them too. An h1 on the update's own page, an h2 among the
           other updates -->
      {#if n.title}<p class="update-date">
          <time datetime={published(n)}>{n.post ? dateOnly(n.time) : heading(n.time)}</time>
        </p>
        <svelte:element this={single ? "h1" : "h2"} class="update-heading"
          >{#if single}{n.title}{:else}<a class="title-link" href="{TRACKSIDE}{n.slug}/">{n.title}</a
            >{/if}</svelte:element
        >
      {:else}<svelte:element this={single ? "h1" : "h2"} class="update-heading update-date"
          ><time datetime={published(n)}>{heading(n.time)}</time></svelte:element
        >{/if}
      <!-- on a page of updates, a long one is cut off with a fade, and Read more goes to its own page -->
      <div class="update-body" class:clamped={clamped(n)} data-body={n.slug}>
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
                  ><time datetime={isoBC(m.time)}>{followUpTime(m.time, n.time)}</time></code
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
      </div>
      {#if clamped(n)}<a class="read-more" href="{TRACKSIDE}{n.slug}/">Read more →</a>{/if}
      <!-- on a page of updates, the comments button, drawn like the ← Map button, with a speech bubble: a link to the
           thread on the update's own page; when the update's comments are off, the same button greyed out and struck
           through, which can't be pressed. An update's own page has its thread right below instead -->
      <div class="update-footer mt-3.5 flex flex-wrap items-center gap-2.5">
        {#if single}{:else if n.comments === "off"}<button class="btn comments-off gap-1.5" disabled
            ><Icon kind="comment-off" />
            Comments off</button
          >{:else}<a
            class="btn btn-grey comments-button gap-1.5"
            href="{TRACKSIDE}{n.slug}/#comments"
            onclick={() => track("open_comments", { where: "trackside", slug: n.slug })}
            ><Icon kind="comment" />
            {commentsLabel(n)}</a
          >{/if}
        <!-- the permalink, at the right end of the row, so the heading above has the card's full width -->
        <a
          class="ml-auto shrink-0 p-1 text-(--mute) hover:text-(--accent)"
          href="{TRACKSIDE}{n.slug}/"
          title="Copy permalink"
          aria-label="Copy permalink"
          onclick={(e) => copyPermalink(e, n)}><Icon kind="link" /></a
        >
      </div>
      <!-- on an update's own page, its comments, always shown, at #comments (clear of the bar at the top), set off from the
           update by a dashed line: the thread (Remark42), or for a read-only one, its comments as they were when the site
           was built -->
      {#if single}<section
          id="comments"
          class="comments-section scroll-mt-[calc(var(--spacing)*19_+_env(safe-area-inset-top,0px))] mt-2.5"
        >
          {#if n.comments === "readonly"}
            {#if frozen[n.slug]?.comments.length}{@render frozenComments(frozen[n.slug].comments)}
              <p class="frozen-note mt-2">Comments are closed.</p>
            {:else}<p class="frozen-note">No comments.</p>
              <p class="frozen-note mt-2">Comments are closed.</p>{/if}
          {:else if n.comments === "off"}<p class="frozen-note">Comments are off for this update.</p>
          {:else}<div use:lazyRemark42={n}></div>{/if}
        </section>{/if}
    </article>
  {/each}
  <!-- the first page has one button to older updates; later pages go either way, with Older off on the last page, and from
       page 3 on, Newest goes straight back to the first page; links to
       the prerendered pages, so search engines follow them too. Drawn like the Oldest / Newest switch in the giscus
       comments (GitHub's segmented control): a grey track, the buttons you can press raised on it with an outline and
       bold text, a button you can't press flat and faded, in GitHub's own colours, light and dark. On a phone: the
       buttons share the full width with a gap and are tall enough to tap, with no track behind them (a button you can't
       press keeps the track colour). -->
  {#if single}
    <!-- an update's own page links to the first page of Trackside, not to the page of updates it is on -->
    <nav class="mx-auto mt-6 flex w-fit rounded-md bg-(--button-bg) phone:w-auto phone:bg-transparent">
      <a class="pager-link" href={TRACKSIDE}>See all updates</a>
    </nav>
  {:else if pages > 1}
    <nav
      class="mx-auto mt-6 flex w-fit rounded-md bg-(--button-bg) phone:w-auto phone:gap-2 phone:bg-transparent"
      aria-label="Pages of updates"
    >
      {#if page === 1}
        <a class="pager-link" href={pageUrl(2)} rel="next">Show older</a>
      {:else}
        {#if page > 2}<a class="pager-link" href={pageUrl(1)}>Newest</a>{/if}
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

<style>
  @reference "../src/app.css";

  /* an update, raised on its own card so one update doesn't run into the next */
  .update-card {
    @apply rounded-xl border border-(--line) bg-(--panel) p-4.5 shadow-card phone:px-3.5;
  }
  /* an update's heading: a post's title, with the permalink icon at the right */
  .update-heading {
    @apply m-0 mb-2 text-2xl leading-tight font-bold;
  }
  /* a title's link to its update's own page: drawn like the heading, underlined on hover */
  .title-link {
    @apply text-inherit no-underline hover:underline;
  }
  /* a date in gold: a post's, over its title, and a status update's heading, which is its date and time */
  .update-date {
    @apply m-0 mb-1 text-sm font-bold tracking-wide text-(--date) uppercase;
  }
  /* the comments button's row, under a thin line at the foot of the card */
  .update-footer {
    @apply border-t border-(--line) pt-3;
  }
  /* the comments button: .btn .btn-grey, plus the pointer and the accent outline on hover that other buttons have */
  .comments-button {
    @apply cursor-pointer hover:border-(--accent);
  }
  /* an update's body on a page of updates: cut off when it's long, fading into the card */
  .update-body {
    @apply relative;
  }
  .clamped {
    @apply max-h-128 overflow-hidden;
  }
  .clamped::after {
    content: "";
    @apply pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-b from-transparent to-(--panel);
  }
  /* the link to a cut-off update's own page */
  .read-more {
    @apply mt-2 inline-block text-sm font-bold text-(--link);
  }
  /* an update's own page's comments: the thread, or a read-only one's comments as they were when the site was built, set
     off by a dashed line like Remark42's */
  .comments-section {
    @apply border-t border-dashed border-(--line) pt-3;
  }
  /* its list of comments; a reply's list is indented under its comment, with a line down its left */
  .frozen-list {
    @apply m-0 list-none p-0;
  }
  .frozen-list .frozen-list {
    @apply mt-2 ml-1 border-l-2 border-(--line) pl-3;
  }
  .frozen-comment {
    @apply mb-3;
  }
  /* a comment's author and date */
  .frozen-meta {
    @apply m-0 text-sm text-(--mute);
  }
  /* a comment's text: Remark42's HTML, its paragraphs spaced like an update's */
  .frozen-text :global(p) {
    @apply mt-1 mb-0;
  }
  .frozen-text :global(a) {
    @apply text-(--link);
  }
  /* "Comments are closed." and "No comments." */
  .frozen-note {
    @apply m-0 text-sm text-(--mute) italic;
  }
  /* the comments button of an update whose comments are off: greyed out, and it can't be pressed */
  .comments-off {
    @apply cursor-not-allowed border-(--line) bg-(--bg) text-(--mute);
  }
  /* an update's photo, with rounded corners */
  .update-photo {
    @apply rounded-md;
  }
</style>
