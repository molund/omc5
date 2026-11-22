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
    @apply pointer-events-none absolute inset-x-0 bottom-15 z-10 flex justify-center;
  }

  /* the caption itself: white medium-weight text with a black halo, in the map's span numbers' type (.map-number in app.css,
     its halo turned black), with nothing behind it, so the map shows through; each part shows whole, as one block */
  .caption {
    @apply mx-4 max-w-[42ch] text-center font-sans text-base leading-snug font-medium text-white;
    /* the system's own sans-serif, not .map-number's condensed face */
    font-stretch: normal;
    /* black, and a touch thinner than .map-number's 0.12em halo: the usual subtitle outline */
    -webkit-text-stroke: 0.1em black;
    /* a soft drop shadow lifts it off light parts of the aerial */
    text-shadow: 0 0.0625em 0.25em rgb(0 0 0 / 0.6);
  }
</style>
