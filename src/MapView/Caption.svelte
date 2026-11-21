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

  /* the caption itself, as subtitles are usually set: white text in the system's sans-serif, a black outline and a soft
     drop shadow so it reads over the drawing and the aerial alike, nothing behind it, and lines of at most 42
     characters, balanced so neither is left short (captions.js splits anything longer than two of them into screens) */
  .caption {
    @apply mx-4 max-w-[42ch] text-center font-sans text-base leading-snug font-medium text-balance text-white;
    -webkit-text-stroke: 0.1em black;
    paint-order: stroke fill;
    text-shadow: 0 0.0625em 0.25em rgb(0 0 0 / 0.6);
  }
</style>
