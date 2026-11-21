<script>
  /** A caption over the gantry animation (captions.js): centred near the bottom of the map, above the credits. */
  let { text = null } = $props();
</script>

{#if text}
  <div class="caption-row">
    <p class="caption" aria-live="polite">{text}</p>
  </div>
{/if}

<style>
  @reference "../app.css";

  /* across the bottom of the map, above the credits; taps go through to the map */
  .caption-row {
    @apply pointer-events-none absolute inset-x-0 bottom-10 z-10 flex justify-center;
  }

  /* the caption itself: a card that reads over the aerial photo and the drawing */
  .caption {
    @apply mx-4 max-w-md rounded-md bg-(--panel) px-4 py-2.5 text-center text-base text-(--ink) shadow-(--shadow-card);
  }
</style>
