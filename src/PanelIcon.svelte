<script>
  // panel: a window with a sidebar (show or hide the layer panel); menu: three lines (open the menu on a phone); close: a
  // cross (close it, or the progress card); progress: an information icon (bring the progress card back)
  let { kind = "panel" } = $props();
</script>

<!-- Icons for the buttons that show and hide the layer panel and the progress card -->
<svg
  width="18"
  height="18"
  viewBox="0 0 18 18"
  fill="none"
  stroke="currentColor"
  stroke-width="1.5"
  stroke-linecap="round"
  aria-hidden="true"
>
  {#if kind === "menu"}
    <line x1="2.5" y1="4.5" x2="15.5" y2="4.5" />
    <line x1="2.5" y1="9" x2="15.5" y2="9" />
    <line x1="2.5" y1="13.5" x2="15.5" y2="13.5" />
  {:else if kind === "progress"}
    <!-- an information icon: an "i" in a circle -->
    <circle cx="9" cy="9" r="7.25" />
    <line x1="9" y1="8" x2="9" y2="12.75" />
    <circle cx="9" cy="5.25" r="0.6" fill="currentColor" />
  {:else if kind === "close"}
    <line x1="4" y1="4" x2="14" y2="14" />
    <line x1="14" y1="4" x2="4" y2="14" />
  {:else}
    <rect x="1.75" y="2.75" width="14.5" height="12.5" rx="2" />
    <line x1="6.75" y1="2.75" x2="6.75" y2="15.25" />
  {/if}
</svg>

<style>
  svg {
    display: block;
  }
</style>
