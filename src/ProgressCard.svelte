<script>
  import { PROGRESS_COLOUR } from "./lib/layerSwitches.js";
  import { layers, ui } from "./lib/appState.svelte.js";
  import { status, asOf } from "./lib/status.js";
  import Icon from "./Icon.svelte";

  // "today" or "yesterday" on the card (the past updates list keeps full dates)
  const when = asOf(status.updated, true);
  // the past updates page
  const UPDATES = `${import.meta.env.BASE_URL}updates/`;

  // what each number counts, shown when it is hovered or clicked with a mouse, tapped (tap again to hide) or pressed with
  // Enter/Space
  const TIPS = {
    span: "Completed span positions at or behind the Clayton Clipper. The current span counts after all its segments are hung. Previously completed spans count after the gantry crawls over them.",
    ahead:
      "Completed span positions ahead, built by cranes, which the Clayton Clipper must crawl over.",
    total:
      "Total span positions on the Clayton Clipper's route. Parallel spans at the same location count as one.",
  };
  let tip = $state(null);
  const toggle = (k) => (tip = tip === k ? null : k);
  // a tap anywhere else, or Escape, closes the tip
  function outside(e) {
    if (!e.target.closest(".num")) tip = null;
  }
</script>

<svelte:window
  onpointerdown={outside}
  onkeydown={(e) => e.key === "Escape" && (tip = null)}
/>

{#snippet num(k, value, big)}
  <button
    class="num"
    class:big
    class:open={tip === k}
    aria-describedby={tip === k ? "progress-tip" : undefined}
    aria-label="{value}: {TIPS[k]}"
    onclick={(e) => (e.pointerType === "mouse" ? (tip = k) : toggle(k))}
    onpointerenter={(e) => e.pointerType === "mouse" && (tip = k)}
    onpointerleave={(e) =>
      e.pointerType === "mouse" && tip === k && (tip = null)}
    onblur={() => tip === k && (tip = null)}>{value}</button
  >
{/snippet}

{#if layers.progress && ui.gantry && ui.cardHidden}
  <button
    class="show"
    title="Show the progress card"
    aria-label="Show the progress card"
    onclick={() => (ui.cardHidden = false)}
    ><Icon kind="info" /></button
  >
{:else if layers.progress && ui.gantry}
  {@const { span, ahead, total } = ui.gantry}
  <div class="card">
    <div class="title">Clayton Clipper</div>
    <button
      class="close"
      title="Hide the progress card"
      aria-label="Hide the progress card"
      onclick={() => (ui.cardHidden = true)}><Icon kind="close" /></button
    >
    <div class="figure">
      ({@render num("span", span, true)}+{@render num(
        "ahead",
        ahead,
      )})/{@render num("total", total)}
    </div>
    {#if tip}<div class="tip" id="progress-tip" role="tooltip">
        {TIPS[tip]}
      </div>{/if}
    <div
      class="track"
      role="progressbar"
      aria-label="Clayton Clipper progress"
      aria-valuemin="0"
      aria-valuemax={total}
      aria-valuenow={span}
    >
      <div
        class="fill"
        style:width="{(span / total) * 100}%"
        style:background={PROGRESS_COLOUR}
      ></div>
    </div>
    {#if when}<div class="asof">As of {when}</div>{/if}
    {#if status.note}<div class="note">{status.note}</div>{/if}
    {#if status.photo}<a class="thumb" href={status.photo}
        ><img src={status.photo} alt="Photo for this update" /></a
      >{/if}
    {#if status.history.length}
      <a class="history-link" href={UPDATES}
        >Past updates</a
      >
    {/if}
  </div>
{/if}


<style>
  /* every size on the card is in rem, so it follows the iPhone's Text Size setting (see app.css) */
  .card {
    position: absolute;
    top: 12px;
    right: 12px;
    width: calc(240rem / 17); /* grows with the text */
    max-width: calc(100% - 24px);
    padding: 12px 14px 14px;
    background: var(--panel);
    color: var(--ink);
    border: 1px solid var(--line);
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
    z-index: 5;
  }
  /* the card's close button, in its top right corner, and the information button that takes the card's place once it is closed */
  .close {
    position: absolute;
    top: 6px;
    right: 6px;
    padding: 4px;
    border-color: transparent;
    background: none;
    color: var(--mute);
  }
  .close:hover {
    color: var(--ink);
  }
  .show {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 5;
    padding: calc(6rem / 17);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  }
  .title {
    font-size: calc(13rem / 17);
    font-weight: 600;
    color: var(--mute);
  }
  .figure {
    margin: 2px 0 8px;
    font-size: calc(15rem / 17);
    color: var(--mute);
  }
  .figure {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
  }
  /* the numbers are buttons, with room to tap, that look like plain figures with a dotted underline hinting at the tip */
  .num {
    font: inherit;
    font-weight: 600;
    color: var(--ink);
    background: none;
    border: 0;
    border-radius: 4px;
    padding: 2px 3px;
    min-height: 36px;
    position: relative;
    cursor: help;
    text-decoration: underline dotted;
    text-underline-offset: 4px;
    text-decoration-color: var(--mute);
  }
  /* an invisible extension of the tap area over the brackets and signs, so even the "8" is a comfortable target while the
     figure stays tight */
  .num::after {
    content: "";
    position: absolute;
    inset: 0 -7px;
  }
  .num.big {
    font-size: calc(28rem / 17);
  }
  .num:hover,
  .num.open {
    background: var(--bg);
  }
  /* floats over the progress bar (no top: it sits where it would have started, just under the figure), in the card's
     colours reversed so it stands out from the card in light and dark mode */
  .tip {
    position: absolute;
    left: 8px;
    right: 8px;
    z-index: 1;
    margin-top: -2px;
    padding: 7px 9px;
    font-size: calc(
      12rem / 17
    ); /* follows the iPhone's Text Size setting (see app.css) */
    line-height: 1.35;
    color: var(--panel);
    background: var(--ink);
    border-radius: 6px;
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.35);
  }
  .track {
    height: 10px;
    border-radius: 5px;
    background: var(--line);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    border-radius: 5px;
  }
  .asof {
    margin-top: 8px;
    font-size: calc(12rem / 17);
    color: var(--mute);
  }
  /* 13px at the default text size, scaled by the iPhone's Text Size setting (see app.css) */
  .note {
    margin-top: 4px;
    font-size: calc(13rem / 17);
  }
  /* the newest update's photo, a short strip across the card, opening full size when tapped */
  .thumb {
    display: block;
    margin-top: 8px;
  }
  .thumb img {
    display: block;
    width: 100%;
    height: calc(110rem / 17);
    object-fit: cover;
    border-radius: 6px;
  }
  /* a plain text link at the foot of the card */
  .history-link {
    display: inline-block;
    margin-top: 8px;
    font-size: calc(12rem / 17);
    color: var(--ink);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
</style>
