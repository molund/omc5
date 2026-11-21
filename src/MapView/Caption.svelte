<script>
  /** A caption over the gantry animation (captions.js): centred near the bottom of the map, above the credits. */
  let { text = null } = $props();
</script>

{#if text}
  <div class="caption-row">
    <p class="map-number caption" aria-live="polite">{text}</p>
  </div>
{/if}

<style>
  @reference "../app.css";

  /* across the bottom of the map, above the credits; taps go through to the map */
  .caption-row {
    @apply pointer-events-none absolute inset-x-0 bottom-10 z-10 flex justify-center;
  }

  /* the caption itself: white medium-weight text with a black halo, in the map's span numbers' type (.map-number in app.css,
     its halo turned black), with nothing behind it, so the map shows through */
  .caption {
    @apply mx-4 max-w-md text-center text-base leading-snug font-medium text-white;
    -webkit-text-stroke-color: black;
  }
</style>
