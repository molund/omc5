<script>
  /**
   * The permalink button's share box while the gantry animates, after YouTube's: the link, shown as its path and query
   * only, from ~ (the site's home, as in a shell: ~/play/?span=12), in a greyed, read-only field, a Copy button that copies the whole
   * address, and three choices that make the link (all on at first):
   * - Play the animation, or open the map without it
   * - at the span whose move is under way, or where the gantry is now (status.yaml's span)
   * - fit to the screen (/play/ picks vertical for a phone, horizontal for a computer), or Progress. A span link without
   *   the animation always opens in Progress, so this choice is greyed out then.
   */
  import { tick } from "svelte";
  import { ui } from "./lib/appState/appState.svelte.js";
  import { currentSpan } from "./lib/animationMark.js";
  import { SITE } from "./lib/comments.js";
  import { track } from "./lib/track.js";

  let { onclose } = $props();

  // the span whose move is under way, as the box opens
  const span = currentSpan() || null;
  let play = $state(true),
    atSpan = $state(!!span),
    fit = $state(true),
    copied = $state(false),
    box = $state();
  let copyTimer;

  // a span link without the animation opens in Progress whatever the address says: nothing to fit
  const canFit = $derived(play || !atSpan);

  /** The link, as a path and query on the site. */
  const path = $derived.by(() => {
    const s = atSpan && span ? span : null;
    if (canFit && fit) return play ? (s ? `/play/?span=${s}` : "/play/") : "/play/?animate=false";
    if (play) return s ? `/?span=${s}&animate=true` : "/?animate=true";
    return s ? `/?span=${s}` : "/";
  });
  // shown from ~, the site's home, as a shell writes a path from the home folder
  const shown = $derived(`~${path}`);

  async function copy() {
    track("copy_permalink", { where: "map", view: ui.view, play, atSpan, fit: canFit && fit });
    try {
      await navigator.clipboard.writeText(new URL(path.slice(1), SITE).href);
      copied = true;
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copied = false), 1800);
    } catch (error) {
      console.error("Could not copy the link", error);
    }
  }

  // a tap or click outside it, or Escape, closes it
  function outside(e) {
    if (box && !box.contains(e.target) && !e.target.closest?.("[data-share-button]")) onclose();
  }
  function keydown(e) {
    if (e.key === "Escape") onclose();
  }
  tick().then(() => box?.querySelector("button")?.focus());
  track("share", { action: "open", view: ui.view, span: span ?? 0 });
</script>

<svelte:window onpointerdown={outside} onkeydown={keydown} />

<div bind:this={box} class="share-box absolute top-14 right-3 z-20" role="dialog" aria-label="Share">
  <p class="share-title">Share</p>
  <div class="flex items-center gap-2">
    <!-- read-only: the text can be selected but not changed -->
    <input class="share-link" readonly value={shown} aria-label="Link" onfocus={(e) => e.currentTarget.select()} />
    <button class="share-copy" onclick={copy}>{copied ? "Copied" : "Copy"}</button>
  </div>
  <label class="share-choice mt-3 flex items-center gap-2"
    ><input type="checkbox" bind:checked={play} /> Play the animation</label
  >
  {#if span}
    <label class="share-choice mt-2 flex items-center gap-2"
      ><input type="checkbox" bind:checked={atSpan} /> {play ? "Start at" : "Show"} span {span}</label
    >
  {/if}
  <label class={["share-choice mt-2 flex items-center gap-2", !canFit && "share-choice-off"]}
    ><input type="checkbox" bind:checked={fit} disabled={!canFit} /> Fit to the screen</label
  >
</div>

<style>
  @reference "./app.css";

  /* the box under the permalink button, as wide as a phone allows */
  .share-box {
    @apply w-72 max-w-[calc(100vw-1.5rem)] rounded-md border border-(--line) bg-(--panel) p-3.5 text-(--ink) shadow-card;
  }
  .share-title {
    @apply m-0 mb-2.5 text-sm font-semibold;
  }
  /* the link: its path and query, cut short with an ellipsis if it doesn't fit; greyed like a disabled field, as it
     can't be edited (only selected) */
  .share-link {
    @apply min-w-0 flex-1 cursor-text truncate rounded-md border border-(--line) bg-(--button-bg) px-2 py-1.5 font-mono text-xs text-(--mute) outline-none select-text;
  }
  .share-copy {
    @apply shrink-0;
  }
  .share-choice {
    @apply text-sm;
  }
  /* a choice that doesn't apply to the others ticked: greyed out */
  .share-choice-off {
    @apply text-(--mute) opacity-60;
  }
</style>
