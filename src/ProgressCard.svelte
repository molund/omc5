<script>
  import { tick } from "svelte";
  import { PROGRESS_COLOUR } from "./lib/layerSwitches.js";
  import { layers, ui } from "./lib/appState.svelte.js";
  import { status, asOf, followUpTime } from "./lib/status.js";
  import { anchor, term, fetchCounts } from "./lib/comments.js";
  import Icon from "./Icon.svelte";

  // "today" or "yesterday" on the card (Trackside keeps full dates)
  const when = asOf(status.updated, true);
  // the newest note's own time, short like its follow-ups' ("9:30 a.m."): "As of" above already says which day
  const postedAt = status.latest
    ? followUpTime(status.latest.time, status.latest.time)
    : "";
  // the Trackside page
  const TRACKSIDE = `${import.meta.env.BASE_URL}trackside/`;
  // the Comments button opens the newest update on that page with its comments open, and shows its comment and reaction
  // counts once GitHub has sent them
  const newest = status.latest;
  const COMMENTS = newest
    ? `${TRACKSIDE}?comments#${anchor(newest.time)}`
    : TRACKSIDE;
  let activity = $state(null);
  if (newest)
    fetchCounts().then((c) => (activity = c[term(newest.time)] ?? null));

  // what each number counts, shown when it is hovered or clicked with a mouse, tapped (tap again to hide) or pressed with
  // Enter/Space
  const TIPS = {
    span: "<strong>Completed span positions at or behind the Clayton Clipper.</strong> The current span position counts after all segments are hung.",
    ahead:
      "<strong>Completed span positions ahead of the Clayton Clipper.</strong> These positions were built by mobile cranes and will count toward progress after the gantry passes over them.",
    total:
      "<strong>Total span positions on the Clayton Clipper route.</strong> Parallel guideways at the same location count as a single span position.",
  };
  let tip = $state(null);
  const toggle = (k) => (tip = tip === k ? null : k);
  // a tap anywhere else, or Escape, closes the tip
  function outside(e) {
    if (!e.target.closest("[data-num]")) tip = null;
  }

  // On a phone the card is a full-screen dialog: it fills the screen, has its own Close button in a sticky header, and stays
  // open until that button (or Escape) closes it. While it's open the page behind it doesn't scroll, focus moves into it and
  // stays there, and closing it puts focus back on the information button.
  const open = $derived(layers.progress && ui.gantry && !ui.cardHidden);
  const full = $derived(open && ui.phone);
  let card = $state(),
    closeButton = $state(),
    showButton = $state();
  function close() {
    tip = null;
    ui.cardHidden = true;
    // back to the button that reopens it, once it's drawn
    tick().then(() => showButton?.focus());
  }
  $effect(() => {
    if (!full) return;
    const html = document.documentElement,
      was = [html.style.overflow, document.body.style.overflow];
    html.style.overflow = document.body.style.overflow = "hidden";
    tick().then(() => closeButton?.focus());
    return () => {
      [html.style.overflow, document.body.style.overflow] = was;
    };
  });
  // Escape closes the tip first, then the full-screen card; Tab stays inside the full-screen card
  function keydown(e) {
    if (e.key === "Escape") {
      if (tip) tip = null;
      else if (full) close();
      return;
    }
    if (e.key !== "Tab" || !full || !card) return;
    const stops = [...card.querySelectorAll("a[href], button:not([disabled])")];
    if (!stops.length) return;
    const first = stops[0],
      last = stops[stops.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    } else if (!card.contains(document.activeElement)) {
      e.preventDefault();
      first.focus();
    }
  }

  // every size on the card is in rem, so it follows the iPhone's Text Size setting (see app.css). On a phone the Comments
  // button is the secondary button to Let's go (the same shape and weight, in the Map buttons' secondary colours, the
  // pager's, GitHub's segmented control), and More trackside updates is a green one at the bottom of the card.
  const COMMENT_BUTTON =
    "mt-[10px] flex min-h-[calc(32rem/17)] items-center gap-[6px] rounded-[6px] border px-[calc(10rem/17)] py-[calc(6rem/17)] no-underline";
  const COMMENT_BUTTON_SMALL =
    "border-(--line) bg-(--panel) text-[calc(13rem/17)] text-(--ink) hover:bg-(--bg)";
  const COMMENT_BUTTON_FULL =
    "border-(--button-line) bg-(--button-bg) text-[calc(14rem/17)] font-semibold text-(--button-ink)";
  const COMMENT_BUTTON_GREEN =
    "mt-[40px] border-(--primary-button) bg-(--primary-button) text-[calc(14rem/17)] font-semibold text-white";
  // the notes, each led by its own time in a small grey chip (a note after a note has a little more room above it)
  const NOTE = "mt-[4px] text-[calc(13rem/17)] [[data-note]+&]:mt-[6px]";
  const CHIP =
    "mr-[4px] inline-block rounded-[9px] bg-(--bg) px-[6px] text-[calc(11rem/17)] font-semibold text-(--mute)";
  // primary green buttons
  const PRIMARY_BUTTON =
    "inline-flex items-center rounded-[6px] border border-(--primary-button) bg-(--primary-button) px-[calc(12rem/17)] py-[calc(6rem/17)] text-[calc(14rem/17)] font-semibold whitespace-nowrap text-white";

  function stripHtml(html) {
    return html.replace(/<[^>]*>/g, "");
  }
</script>

<svelte:window onpointerdown={outside} onkeydown={keydown} />

{#snippet num(k, value, big)}
  <!-- the numbers are buttons, with room to tap, that look like plain figures with a dotted underline hinting at the tip;
       the ::after is an invisible extension of the tap area over the brackets and signs, so even the "8" is a comfortable
       target while the figure stays tight -->
  <button
    data-num
    class={[
      "relative min-h-[36px] cursor-help rounded-[4px] border-0 px-[3px] py-[2px] font-semibold text-(--ink) underline decoration-(--mute) decoration-dotted underline-offset-[4px] after:absolute after:inset-x-[-7px] after:inset-y-0 after:content-['']",
      big ? "text-[calc(28rem/17)]" : "[font-size:inherit]",
      tip === k ? "bg-(--bg)" : "bg-transparent hover:bg-(--bg)",
    ]}
    aria-describedby={tip === k ? "progress-tip" : undefined}
    aria-label="{value}: {stripHtml(TIPS[k])}"
    onclick={(e) => (e.pointerType === "mouse" ? (tip = k) : toggle(k))}
    onpointerenter={(e) => e.pointerType === "mouse" && (tip = k)}
    onpointerleave={(e) =>
      e.pointerType === "mouse" && tip === k && (tip = null)}
    onblur={() => tip === k && (tip = null)}>{value}</button
  >
{/snippet}

{#if layers.progress && ui.gantry && ui.cardHidden}
  <button
    bind:this={showButton}
    class="absolute top-[12px] right-[12px] z-5 p-[calc(6rem/17)] shadow-[0_1px_4px_rgba(0,0,0,0.3)]"
    title="Show the progress card"
    aria-label="Show the progress card"
    onclick={() => (ui.cardHidden = false)}><Icon kind="info" /></button
  >
{:else if layers.progress && ui.gantry}
  {@const { span, ahead, total } = ui.gantry}
  <div
    bind:this={card}
    class={[
      "bg-(--panel) text-(--ink)",
      full
        ? "fixed inset-0 z-50 h-[100dvh] w-auto max-w-none overflow-y-auto overscroll-contain pt-0 pr-[max(16px,env(safe-area-inset-right))] pb-[calc(16px_+_env(safe-area-inset-bottom))] pl-[max(16px,env(safe-area-inset-left))]"
        : "absolute top-[12px] right-[12px] z-5 w-[calc(240rem/17)] max-w-[calc(100%_-_24px)] rounded-[8px] border border-(--line) px-[14px] pt-[12px] pb-[14px] shadow-[0_2px_8px_rgba(0,0,0,0.25)]",
    ]}
    role={full ? "dialog" : undefined}
    aria-modal={full ? "true" : undefined}
    aria-labelledby={full ? "progress-title" : undefined}
  >
    <!-- the title: the Clayton Clipper logo with "Progress" beside it, small and spaced out, as in Trackside's header; on a
         phone, a sticky header with a large Close button -->
    <div
      class={full &&
        "sticky top-0 z-2 mt-0 mr-[calc(-1_*_max(16px,env(safe-area-inset-right)))] mb-[12px] ml-[calc(-1_*_max(16px,env(safe-area-inset-left)))] flex items-center justify-between gap-[12px] border-b border-(--line) bg-(--panel) pt-[calc(8px_+_env(safe-area-inset-top))] pr-[max(16px,env(safe-area-inset-right))] pb-[8px] pl-[max(16px,env(safe-area-inset-left))]"}
    >
      <div
        class="flex items-center gap-[8px] pr-[calc(24rem/17)] text-[calc(10.5rem/17)] font-bold tracking-[0.3em] text-(--mute) uppercase"
        id="progress-title"
      >
        <img
          class="h-[calc(30rem/17)] w-auto"
          src="{import.meta.env.BASE_URL}images/logo.png"
          alt="Clayton Clipper"
          width="625"
          height="351"
        /><span>Progress</span>
      </div>
      {#if full}<button
          bind:this={closeButton}
          class={PRIMARY_BUTTON}
          onclick={close}
          aria-label="Let’s go to the map">Let’s go →</button
        >{:else}<button
          class="absolute top-[6px] right-[6px] border-transparent bg-transparent p-[4px] text-(--mute) hover:text-(--ink)"
          title="Hide the progress card"
          aria-label="Hide the progress card"
          onclick={close}><Icon kind="close" /></button
        >{/if}
    </div>
    <!-- "36 (+8) / 105": the spans done, the spans ahead built by cranes, and the total (non-breaking spaces, which the flex
         row keeps) -->
    <div
      class="mt-[2px] mb-[8px] flex flex-wrap items-baseline text-[calc(15rem/17)] text-(--mute)"
    >
      {@render num("span", span, true)}&nbsp;(+{@render num(
        "ahead",
        ahead,
      )})&nbsp;/&nbsp;{@render num("total", total)}
    </div>
    <!-- floats over the progress bar (no top: it sits where it would have started, just under the figure), in the card's
         colours reversed so it stands out from the card in light and dark mode -->
    {#if tip}<div
        class="absolute inset-x-[8px] z-1 mt-[-2px] rounded-[6px] bg-(--ink) px-[9px] py-[7px] text-[calc(12rem/17)] leading-[1.35] text-(--panel) shadow-[0_3px_10px_rgba(0,0,0,0.35)]"
        id="progress-tip"
        role="tooltip"
      >
        {@html TIPS[tip]}
      </div>{/if}
    <div
      class="h-[10px] overflow-hidden rounded-[5px] bg-(--line)"
      role="progressbar"
      aria-label="Clayton Clipper progress"
      aria-valuemin="0"
      aria-valuemax={total}
      aria-valuenow={span}
    >
      <div
        class="h-full rounded-[5px]"
        style:width="{(span / total) * 100}%"
        style:background={PROGRESS_COLOUR}
      ></div>
    </div>
    {#if when}<div class="mt-[8px] text-[calc(12rem/17)] text-(--mute)">
        As of {when}
      </div>{/if}
    <!-- every update in the order it happened, since later ones build on earlier ones: the original note, then its
         follow-ups oldest first, each led by its own time in a small chip -->
    {#if status.note}<div data-note class={NOTE}>
        <span class={CHIP}>{postedAt}</span>{status.note}
        {#if status.more.length}<a
            class="whitespace-nowrap text-(--accent)"
            href="{TRACKSIDE}#{anchor(newest.time)}">More</a
          >{/if}
      </div>{/if}
    {#each [...status.followUps].reverse() as m}<div data-note class={NOTE}>
        <span class={CHIP}>{followUpTime(m.time, status.latest.time)}</span
        >{m.text}
      </div>{/each}
    {#if status.photo}<a
        class="mt-[8px] block"
        href="{TRACKSIDE}#{anchor(newest.time)}"
        ><img
          class="block h-[calc(110rem/17)] w-full rounded-[6px] object-cover"
          src={status.photo.src}
          alt={status.photo.caption || "Photo for this update"}
        /></a
      >{/if}
    {#if status.history.length}
      <a
        class="{COMMENT_BUTTON} {full
          ? COMMENT_BUTTON_FULL
          : COMMENT_BUTTON_SMALL}"
        href={COMMENTS}
        ><Icon kind="comment" /><span
          >Comments{activity?.comments ? ` (${activity.comments})` : ""}</span
        >{#if activity?.reactions.length}<span
            class="ml-auto flex gap-[8px] text-(--mute)"
            >{#each activity.reactions as [e, c]}<span>{e} {c}</span
              >{/each}</span
          >{/if}</a
      >
      {#if full}
        <a class="{COMMENT_BUTTON} {COMMENT_BUTTON_GREEN}" href={COMMENTS}>
          More trackside updates</a
        >
        <button
          bind:this={closeButton}
          class="{PRIMARY_BUTTON} mt-[16px] w-full"
          onclick={close}
          aria-label="Let’s go to the map">View map</button
        >
      {/if}
    {/if}
  </div>
{/if}
