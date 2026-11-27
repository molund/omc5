<script>
  import { tick } from "svelte";
  import { fade } from "svelte/transition";
  import { cubicIn } from "svelte/easing";
  import { PROGRESS_COLOUR, CONCRETE_COLOUR } from "./lib/layerSwitches.js";
  import {
    ui,
    layers,
    animateGantry,
    exitAnimation,
    stepAnimation,
    pauseAnimation,
    resumeAnimation,
    canAnimate,
  } from "./lib/appState/appState.svelte.js";
  import { status, asOf, dayOf } from "./lib/status.js";
  import { inline } from "./lib/inline.js";
  import { threadUrl, fetchRemarkCounts, fetchFrozen } from "./lib/comments.js";
  import { track } from "./lib/track.js";
  import Icon from "./Icon.svelte";
  import SharePopover from "./SharePopover.svelte";

  // "today" or "yesterday" on the card (Trackside keeps full dates)
  const when = asOf(status.updated, true);
  // the card's text: `card-text:` in status.yaml, as the Leash Log writes it (the summary of the update or addendum just
  // posted, or a position's own words). It shows until midnight BC time at the end of its `card-text-until:` day, by the
  // visitor's clock; after that the card has no text and a Trackside button instead of Comments. The page has to be loaded
  // again to see it go.
  const note = status.cardText && status.cardTextUntil >= dayOf(new Date()) ? status.cardText : "";
  // the update it came from (`card-text-from:`, its slug), whose comments the card opens; none for a position's words
  const newest = note ? (status.history.find((n) => n.slug === status.cardTextFrom) ?? null) : null;
  const current = !!newest;
  // a link in the note: an address on this site that's only `?…` was written for Trackside, so it goes there from the map
  const noteLink = (href) => (href.startsWith("?") ? `${import.meta.env.BASE_URL}trackside/${href}` : href);
  // the Comments button opens the newest update's own page on Trackside at its comments (#comments), and shows its
  // comment count; it's there only once the update has comments, as counted by the comment server (Remark42) or, for
  // read-only comments, the site's copy of them (`comments:` in status.yaml). Until then, or with its comments off, the
  // card has the Trackside button instead, to /trackside/, and the note goes to the update's own page
  const TRACKSIDE = `${import.meta.env.BASE_URL}trackside/`;
  const commentsOff = newest?.comments === "off";
  const COMMENTS = newest ? `${TRACKSIDE}${newest.slug}/${commentsOff ? "" : "#comments"}` : TRACKSIDE;
  let commentCount = $state(0);
  // a tap or click on the note goes where the Comments button goes (a cmd-, ctrl- or shift-click opens it in a new tab), but
  // not from a link in the note or after selecting some of its text; keyboard users have the Comments button itself
  function openComments(e) {
    if (!newest || e.target.closest("a") || getSelection()?.toString()) return;
    track("open_comments", { where: "card_note", slug: newest.slug });
    if (e.metaKey || e.ctrlKey || e.shiftKey) window.open(COMMENTS, "_blank");
    else location.href = COMMENTS;
  }
  if (newest && current && newest.comments === "readonly")
    fetchFrozen().then((f) => (commentCount = f[newest.slug]?.count ?? 0));
  else if (newest && current && newest.comments === "on")
    fetchRemarkCounts([threadUrl(newest.slug)]).then((c) => (commentCount = c[threadUrl(newest.slug)] ?? 0));
  // the velocity the Leash Log writes, how far the gantry got in the last week, and its chart, drawn when the site is
  // built (trackside/prerender.js); a new address for each update, so a browser doesn't show an old one, and none shown
  // when there isn't one (too few values yet, or `npm run dev`, which doesn't draw it)
  const pace = status.spansPerWeek;
  const CHART = `${import.meta.env.BASE_URL}velocity.svg?v=${+status.updated}`;
  let chart = $state(true);

  // what each number counts, shown when it is hovered or clicked with a mouse, tapped (tap again to hide) or pressed with
  // Enter/Space
  const TIPS = $derived({
    span: "<strong>The span the Clayton Clipper is currently working on.</strong> Its colour changes on the map once all the segments are hung.",
    ahead:
      "<strong>Built ahead by mobile cranes.</strong> Parallel guideways count as one position. Single guideways do not count.",
    total: "<strong>Route total.</strong> Parallel guideways count as one position.",
    percent: ui.gantry
      ? `<strong>${ui.gantry.span} \u00f7 ${ui.gantry.total}.</strong> Excludes the ${ui.gantry.ahead} built ahead.`
      : "",
    pace: "<strong>Approximate.</strong> Based on 2-3 site visits per day during the 168 hours preceding the last check-in. A statutory holiday extends the week by the hours without gantry work, up to 24. Significant figures are for entertainment purposes only.",
  });
  let tip = $state(null);
  // a click with a mouse shows the tip (hovering already has); a tap or a key shows it, or hides it if it's showing. Only
  // a tip shown this way goes to Google Analytics, not one shown by hovering
  function clickTip(e, k) {
    const show = e.pointerType === "mouse" || tip !== k;
    tip = show ? k : null;
    if (show) track("show_tip", { tip: k });
  }
  // a tap anywhere else, or Escape, closes the tip
  function outside(e) {
    if (!e.target.closest("[data-num]")) tip = null;
    // on a phone a touch anywhere off the card closes it
    if (ui.phone && card && !card.contains(e.target) && !ui.cardHidden) {
      ui.cardHidden = true;
      track("progress_card", { action: "hide", source: "outside" });
    }
  }

  // closing: the card funnels into the information button at its top right corner, like a genie into a bottle
  function genie(_node, { duration = 500 } = {}) {
    return {
      duration,
      easing: cubicIn,
      css: (t) =>
        `transform-origin: top right; transform: scale(${t ** 2}, ${t}) skewY(${(1 - t) * -12}deg); opacity: ${Math.min(1, t * 3)}`,
    };
  }
  let card = $state(),
    showButton = $state();
  // while the gantry animates, in every view, a Share button left of the playback buttons (and the info button's corner
  // has the ✕): a real link to /play/, the animation's launcher (a cmd-, ctrl-, shift- or middle-click opens it), and a
  // plain click opens the share box (SharePopover.svelte), after YouTube's, to choose the link and copy it.
  const PLAY = `${import.meta.env.BASE_URL}play/`;
  let sharing = $state(false);
  function openShare(e) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    sharing = !sharing;
  }
  // the share box closes when the animation stops
  $effect(() => {
    if (!ui.gantryPlaying) sharing = false;
  });
  function close() {
    tip = null;
    ui.cardHidden = true;
    track("progress_card", { action: "hide", source: "button" });
    // back to the button that reopens it, once it's drawn
    tick().then(() => showButton?.focus());
  }
  // Escape closes the tip
  function keydown(e) {
    if (e.key === "Escape") tip = null;
  }

  function stripHtml(html) {
    return html.replace(/<[^>]*>/g, "");
  }
</script>

<svelte:window onpointerdown={outside} onkeydown={keydown} />

{#snippet num(k, value, big, bar = false)}
  <!-- the numbers are buttons, with room to tap, that look like plain figures with a dotted underline hinting at the tip;
       the ::after is an invisible extension of the tap area over the brackets and signs, so even the "8" is a comfortable
       target while the figure stays tight -->
  <button
    data-num
    class={[
      "relative cursor-help rounded-sm border-0 px-0.75 py-0.5 after:absolute after:-inset-x-1.75 after:inset-y-0 after:content-['']",
      bar
        ? "map-number tip-dots min-h-6 text-[length:calc(var(--text-sm)*1.12)] leading-5 font-bold text-black"
        : "min-h-9 font-semibold text-(--ink) underline decoration-(--mute) decoration-dotted underline-offset-4",
      !bar && (big ? "text-3xl" : "[font-size:inherit]"),
      bar ? "bg-transparent hover:bg-transparent" : tip === k ? "bg-(--bg)" : "bg-transparent hover:bg-(--bg)",
    ]}
    aria-describedby={tip === k ? "progress-tip" : undefined}
    aria-label="{value}: {stripHtml(TIPS[k])}"
    onclick={(e) => clickTip(e, k)}
    onpointerenter={(e) => e.pointerType === "mouse" && (tip = k)}
    onpointerleave={(e) => e.pointerType === "mouse" && tip === k && (tip = null)}
    onblur={() => tip === k && (tip = null)}
    ><!-- on the bar, the type is 12% bigger than text-sm in text-sm's line height, so the button (and its dots) keep their
         place; a bigger font sinks in a line box of the same height by half its extra ascent less descent, about 0.35 of
         the extra size, so the figure is lifted by that: its bottom stays where it was and it grows at the top --><span
      class={bar && "relative bottom-[calc(var(--text-sm)*0.12*0.35)]"}>{value}</span
    ></button
  >
{/snippet}

<!-- while the gantry animates, in every view: Share, then −1 (back a span), Pause and +1 (on a span) together, then a ✕
     in the top-right corner, with gaps between the three; the progress card, drawn after them, opens over them. Pause
     holds the gantry where it is and turns into Play, which plays it on from there; ✕ leaves the animation and puts the map
     back to today (status.yaml), with the layers as they were (the Play pill starts it again) -->
{#if ui.gantry && ui.gantryPlaying}
  <!-- a real link to /play/ (a cmd-, ctrl-, shift- or middle-click opens it); a plain click opens the share box -->
  <a
    class="share-button absolute top-3 right-47 z-5 block p-1.5"
    href={PLAY}
    title="Share"
    aria-label="Share"
    aria-expanded={sharing}
    data-share-button
    onclick={openShare}><Icon kind="share" /></a
  >
  <button
    class="absolute top-3 right-35 z-5 p-1.5 shadow-float"
    title="Back one span"
    aria-label="Back one span"
    onclick={() => stepAnimation(-1)}><Icon kind="back" /></button
  >
  {#if ui.gantryPaused}
    <button
      class="absolute top-3 right-25 z-5 p-1.5 shadow-float"
      title="Play the animation"
      aria-label="Play the animation"
      onclick={resumeAnimation}><Icon kind="play" /></button
    >
  {:else}
    <button
      class="absolute top-3 right-25 z-5 p-1.5 shadow-float"
      title="Pause the animation"
      aria-label="Pause the animation"
      onclick={pauseAnimation}><Icon kind="pause" /></button
    >
  {/if}
  <button
    class="absolute top-3 right-15 z-5 p-1.5 shadow-float"
    title="Forward one span"
    aria-label="Forward one span"
    onclick={() => stepAnimation(1)}><Icon kind="forward" /></button
  >
{/if}
<!-- while the gantry doesn't animate, a Play pill where the Pause and Reset buttons go (as wide as the two together), left of
     the info button, or left of the progress card when that is open (on a phone, only once the card is closed: there's no
     room beside it, so the pill would end up under the menu button); none in the two SFMSF views, which have no animation,
     or once status.yaml has the gantry on the last
     span, 105: there's nowhere left to move it. It ticks the Gantry box first if it's off and, on a phone, closes the menu
     so the map shows. While the animation plays, the ✕ puts everything back to the gantry's current status -->
{#if ui.gantry && !ui.gantryPlaying && canAnimate() && !(status.span >= 105) && !(ui.phone && !ui.cardHidden)}
  <button
    class={["play-pill absolute top-3 z-5", ui.cardHidden ? "right-13" : "right-65"]}
    title="Play the animation"
    aria-label="Play the animation"
    onclick={() => {
      animateGantry("pill");
      if (ui.phone) ui.collapsed = true;
    }}><Icon kind="play" /><span>Play</span></button
  >
{/if}
{#if ui.gantry && ui.cardHidden && ui.gantryPlaying}
  <button
    class="absolute top-3 right-3 z-5 p-1.5 shadow-float"
    title="Back to today"
    aria-label="Back to today"
    onclick={exitAnimation}><Icon kind="close" /></button
  >
  {#if sharing}<SharePopover onclose={() => (sharing = false)} />{/if}
{:else if ui.gantry && ui.cardHidden}
  <button
    bind:this={showButton}
    in:fade={{ delay: 350, duration: 100 }}
    class="absolute top-3 right-3 z-5 p-1.5 shadow-float"
    title="Show the progress card"
    aria-label="Show the progress card"
    onclick={() => {
      ui.cardHidden = false;
      track("progress_card", { action: "show", source: "button" });
    }}><Icon kind="info" /></button
  >
{:else if ui.gantry}
  {@const { ahead, total } = ui.gantry}
  {@const span = ui.gantry.span}
  {@const percent = (span / total) * 100}
  <div
    bind:this={card}
    out:genie
    class="absolute top-3 right-3 z-5 w-60 max-w-[calc(100%_-_var(--spacing)*6)] rounded-lg border border-(--line) bg-(--panel) px-3.5 pt-3 pb-3.5 text-(--ink) shadow-card"
  >
    <!-- the title: the Clayton Clipper logo with "Progress" beside it, small and spaced out, as in Trackside's header -->
    <div class="eyebrow flex items-center gap-1.25 pr-6 text-xs">
      <img
        class="h-7.5 w-auto logo"
        src="{import.meta.env.BASE_URL}images/logo.png"
        alt="Clayton Clipper"
        width="625"
        height="351"
      /><span>Progress</span>
    </div>
    <button
      class="absolute top-1.5 right-1.5 border-transparent bg-transparent p-1 text-(--mute) hover:text-(--ink)"
      title="Hide the progress card"
      aria-label="Hide the progress card"
      onclick={close}><Icon kind="close" /></button
    >
    <!-- "36 (+8) / 105 spans": the spans done, the spans ahead built by cranes, and the total (non-breaking spaces, which the
         flex row keeps) -->
    <div class="mt-0.5 mb-2 flex flex-wrap items-baseline text-base text-(--mute)">
      {@render num("span", span, true)}&nbsp;(+{@render num("ahead", ahead)})&nbsp;/&nbsp;{@render num(
        "total",
        total,
      )}&nbsp;spans
    </div>
    <!-- floats over the progress bar (no top: it sits where it would have started, just under the figure), in the card's
         colours reversed so it stands out from the card in light and dark mode; the spans per week's floats under its own
         line, below -->
    {#snippet tipBox(offset)}<div
        class={[
          "absolute inset-x-2 z-1 rounded-md bg-(--ink) px-2.25 py-1.75 text-xs leading-snug text-(--panel) shadow-tip",
          offset,
        ]}
        id="progress-tip"
        role="tooltip"
      >
        {@html TIPS[tip]}
      </div>{/snippet}
    {#if tip && tip !== "pace"}{@render tipBox(tip === "percent" ? "mt-7" : "-mt-0.5")}{/if}
    <div class="relative h-6 overflow-hidden rounded-md bg-(--line)">
      <div
        class="absolute inset-0"
        role="progressbar"
        aria-label="Clayton Clipper progress"
        aria-valuemin="0"
        aria-valuemax={total}
        aria-valuenow={span}
      >
        <div
          class="h-full rounded-md"
          style:width="{percent}%"
          style:background={!layers.purpleSpans && layers.guideway ? CONCRETE_COLOUR : PROGRESS_COLOUR}
        ></div>
      </div>
      <div
        class="absolute inset-y-0 left-0 flex min-w-12 max-w-full items-center justify-center"
        style:width="{percent}%"
      >
        {@render num("percent", `${Math.round(percent)}%`, false, true)}
      </div>
    </div>
    <!-- "〰 2.83 spans/wk velocity": the chart green going up, red going down, grey flat (src/lib/velocityChart.js); the
         figure has its tip, like the ones above -->
    {#if pace}<div class="mt-1 flex flex-wrap items-center text-sm text-(--mute)">
        {#if chart}<img
            class="mr-1.5 h-4 w-12"
            src={CHART}
            alt="Velocity trend"
            width="48"
            height="16"
            onerror={() => (chart = false)}
          />{/if}{@render num("pace", pace)}&nbsp;spans/wk velocity
      </div>
      {#if tip === "pace"}{@render tipBox("-mt-1")}{/if}{/if}
    {#if when}<div class="mt-2 text-xs text-(--mute)">As of {when}</div>{/if}
    {#if note}<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div class={["card-note mt-2", newest && "cursor-pointer"]} onclick={openComments}>
        {#each inline(note) as p}{#if p.href}<a class="text-(--link)" href={noteLink(p.href)}
              >{#if p.bold}<strong>{p.text}</strong>{:else}{p.text}{/if}</a
            >{:else if p.bold}<strong>{p.text}</strong>{:else}{p.text}{/if}{/each}
      </div>{/if}
    {#if !newest || commentsOff || !commentCount}
      <a
        class="btn mt-2.5 flex min-h-8 justify-center gap-1.5 border-(--button-line) bg-(--button-bg) px-2.5 text-sm font-semibold text-(--button-ink) hover:bg-(--bg)"
        href={TRACKSIDE}
        onclick={() => track("open_trackside", { where: "card" })}
        ><span>Trackside</span><span aria-hidden="true">→</span></a
      >
    {:else}
      <a
        class="btn mt-2.5 flex min-h-8 gap-1.5 border-(--line) bg-(--panel) px-2.5 text-sm font-normal text-(--ink) hover:bg-(--bg)"
        href={COMMENTS}
        onclick={() => track("open_comments", { where: "card_button", slug: newest.slug })}
        ><Icon kind="comment" /><span>Comments{commentCount ? ` (${commentCount})` : ""}</span></a
      >
    {/if}
  </div>
{/if}

<style>
  @reference "./app.css";

  /* the share button: a link that looks like the buttons beside it */
  .share-button {
    @apply rounded-md border border-(--line) bg-(--panel) leading-none text-(--ink) shadow-float [touch-action:manipulation] hover:border-(--accent) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent);
  }

  /* the note on the card: tapping it opens the comments, like the Comments button under it */
  .card-note {
    @apply text-sm;
  }

  /* the idle Play pill: as wide as the Pause and Reset buttons are together (2 + 0.5 + 2 rem), with an accent border so it
     reads as the thing to press, and a ring that pulses three times when the map loads */
  .play-pill {
    @apply flex w-18 items-center justify-center gap-1.5 border-(--accent) px-0 font-medium shadow-float;
  }
  @media (prefers-reduced-motion: no-preference) {
    .play-pill::after {
      content: "";
      position: absolute;
      inset: calc(var(--spacing) * -1);
      border: calc(var(--spacing) * 0.5) solid var(--accent);
      border-radius: var(--radius-lg);
      opacity: 0;
      pointer-events: none;
      animation: play-pulse 2.4s ease-out 3;
    }
  }
  @keyframes play-pulse {
    0% {
      opacity: 0.55;
      transform: scale(0.96);
    }
    100% {
      opacity: 0;
      transform: scale(1.12);
    }
  }
</style>
