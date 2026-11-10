<script>
  import { tick } from "svelte";
  import { fade } from "svelte/transition";
  import { cubicIn } from "svelte/easing";
  import { PROGRESS_COLOUR } from "./lib/layerSwitches.js";
  import { ui } from "./lib/appState/appState.svelte.js";
  import { status, asOf } from "./lib/status.js";
  import { inline } from "./lib/inline.js";
  import { term, fetchCounts, SITE } from "./lib/comments.js";
  import Icon from "./Icon.svelte";

  // "today" or "yesterday" on the card (Trackside keeps full dates)
  const when = asOf(status.updated, true);
  // the newest update's latest word: its newest follow-up if it has any, else its note. It shows only when it is from the
  // time the card was last updated (a position-only check-in leaves `updated` later than every note), otherwise the card has
  // no text and a Trackside button instead of Comments
  const newest = status.latest;
  const word = status.followUps[0] ?? newest;
  const current = !!word && +word.time === +status.updated;
  const note = current ? status.followUps[0]?.summary || status.note : "";
  // a link in the note: an address on this site that's only `?…` was written for Trackside, so it goes there from the map
  const noteLink = (href) => (href.startsWith("?") ? `${import.meta.env.BASE_URL}trackside/${href}` : href);
  // the Comments button opens Trackside's first page, scrolled to the newest update (a post can sit above it) with its
  // comments open, and shows its comment and reaction counts once GitHub has sent them
  const TRACKSIDE = `${import.meta.env.BASE_URL}trackside/`;
  const COMMENTS = newest ? `${TRACKSIDE}?post=${newest.slug}&comments` : TRACKSIDE;
  let activity = $state(null);
  if (newest && current) fetchCounts().then((c) => (activity = c[term(newest.time)] ?? null));
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
    pace: "<strong>Approximate.</strong> Based on 2-3 site visits per day during the 168 hours preceding the last check-in. Significant figures are for entertainment purposes only.",
  });
  let tip = $state(null);
  const toggle = (k) => (tip = tip === k ? null : k);
  // a tap anywhere else, or Escape, closes the tip
  function outside(e) {
    if (!e.target.closest("[data-num]")) tip = null;
    // on a phone a touch anywhere off the card closes it
    if (ui.phone && card && !card.contains(e.target)) ui.cardHidden = true;
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
  // while the gantry animates in any view but Progress, the info button gives way to a Permalink to /play/, the
  // animation's launcher: a real link (a cmd-, ctrl-, shift- or middle-click opens it), and a plain click copies its
  // address, as on Trackside. It goes back to the info button when the animation stops.
  const PLAY = `${import.meta.env.BASE_URL}play/`;
  let copied = $state(false);
  let copyTimer;
  async function copyPermalink(e) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(new URL("play/", SITE).href);
      copied = true;
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copied = false), 1800);
    } catch (error) {
      console.error("Could not copy permalink", error);
    }
  }
  function close() {
    tip = null;
    ui.cardHidden = true;
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
      "relative cursor-help rounded-sm border-0 px-0.75 py-0.5 font-semibold underline decoration-dotted underline-offset-4 after:absolute after:-inset-x-1.75 after:inset-y-0 after:content-['']",
      bar ? "min-h-6 text-xs text-white decoration-white" : "min-h-9 text-(--ink) decoration-(--mute)",
      !bar && (big ? "text-3xl" : "[font-size:inherit]"),
      bar ? "bg-transparent hover:bg-transparent" : tip === k ? "bg-(--bg)" : "bg-transparent hover:bg-(--bg)",
    ]}
    aria-describedby={tip === k ? "progress-tip" : undefined}
    aria-label="{value}: {stripHtml(TIPS[k])}"
    onclick={(e) => (e.pointerType === "mouse" ? (tip = k) : toggle(k))}
    onpointerenter={(e) => e.pointerType === "mouse" && (tip = k)}
    onpointerleave={(e) => e.pointerType === "mouse" && tip === k && (tip = null)}
    onblur={() => tip === k && (tip = null)}>{value}</button
  >
{/snippet}

{#if ui.gantry && ui.cardHidden && ui.gantryPlaying && ui.view !== "progress"}
  <a
    class="absolute top-3 right-3 z-5 block rounded-md border border-(--line) bg-(--panel) p-1.5 leading-none text-(--ink) shadow-float [touch-action:manipulation] hover:border-(--accent) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
    href={PLAY}
    title="Copy permalink"
    aria-label="Copy permalink"
    onclick={copyPermalink}><Icon kind="link" /></a
  >
{:else if ui.gantry && ui.cardHidden}
  <button
    bind:this={showButton}
    in:fade={{ delay: 350, duration: 100 }}
    class="absolute top-3 right-3 z-5 p-1.5 shadow-float"
    title="Show the progress card"
    aria-label="Show the progress card"
    onclick={() => (ui.cardHidden = false)}><Icon kind="info" /></button
  >
{:else if ui.gantry}
  {@const { span, ahead, total } = ui.gantry}
  {@const percent = (span / total) * 100}
  <div
    bind:this={card}
    out:genie
    class="absolute top-3 right-3 z-5 w-60 max-w-[calc(100%_-_var(--spacing)*6)] rounded-lg border border-(--line) bg-(--panel) px-3.5 pt-3 pb-3.5 text-(--ink) shadow-card"
  >
    <!-- the title: the Clayton Clipper logo with "Progress" beside it, small and spaced out, as in Trackside's header -->
    <div class="eyebrow flex items-center gap-2 pr-6 text-xs">
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
        <div class="h-full rounded-md" style:width="{percent}%" style:background={PROGRESS_COLOUR}></div>
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
    {#if note}<div class="mt-2 text-sm">
        {#each inline(note) as p}{#if p.href}<a class="text-(--link)" href={noteLink(p.href)}
              >{#if p.bold}<strong>{p.text}</strong>{:else}{p.text}{/if}</a
            >{:else if p.bold}<strong>{p.text}</strong>{:else}{p.text}{/if}{/each}
      </div>{/if}
    {#if newest && !current}
      <a
        class="btn mt-2.5 flex min-h-8 justify-center gap-1.5 border-(--button-line) bg-(--button-bg) px-2.5 text-sm font-semibold text-(--button-ink) hover:bg-(--bg)"
        href={TRACKSIDE}><span>Trackside</span><span aria-hidden="true">→</span></a
      >
    {:else if newest}
      <a
        class="btn mt-2.5 flex min-h-8 gap-1.5 border-(--line) bg-(--panel) px-2.5 text-sm font-normal text-(--ink) hover:bg-(--bg)"
        href={COMMENTS}
        ><Icon kind="comment" /><span>Comments{activity?.comments ? ` (${activity.comments})` : ""}</span
        >{#if activity?.reactions.length}<span class="ml-auto flex gap-2 text-(--mute)"
            >{#each activity.reactions as [e, c]}<span>{e} {c}</span>{/each}</span
          >{/if}</a
      >
    {/if}
  </div>
{/if}
{#if copied}<div
    class="fixed inset-x-0 bottom-5 z-20 mx-auto w-fit rounded-md bg-(--ink) px-3 py-2 text-sm text-(--panel) shadow-card"
    role="status"
    aria-live="polite"
  >
    Permalink copied
  </div>{/if}
