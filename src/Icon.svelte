<script>
  // panel: a window with a sidebar (show or hide the layer panel); menu: three lines (open the menu on a phone); close: a
  // cross (close it, or the progress card); progress: an information icon (bring the progress card back); chevron: a "›" (fold the layer switches out or away); minus, plus: a − or + (zoom out or in); fit: four corner brackets (fit the whole plan); centre: a crosshair (center the plan); github: the GitHub mark (link to the repo)
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
  {:else if kind === "minus" || kind === "plus"}
    <line x1="4.5" y1="9" x2="13.5" y2="9" />
    {#if kind === "plus"}<line x1="9" y1="4.5" x2="9" y2="13.5" />{/if}
  {:else if kind === "fit"}
    <!-- four corner brackets -->
    <polyline points="2.75,6.5 2.75,2.75 6.5,2.75" stroke-linejoin="round" />
    <polyline points="11.5,2.75 15.25,2.75 15.25,6.5" stroke-linejoin="round" />
    <polyline
      points="15.25,11.5 15.25,15.25 11.5,15.25"
      stroke-linejoin="round"
    />
    <polyline points="6.5,15.25 2.75,15.25 2.75,11.5" stroke-linejoin="round" />
  {:else if kind === "centre"}
    <!-- a crosshair: a small circle with four ticks -->
    <circle cx="9" cy="9" r="4.25" />
    <line x1="9" y1="1.75" x2="9" y2="4.75" />
    <line x1="9" y1="13.25" x2="9" y2="16.25" />
    <line x1="1.75" y1="9" x2="4.75" y2="9" />
    <line x1="13.25" y1="9" x2="16.25" y2="9" />
    <circle cx="9" cy="9" r="0.6" fill="currentColor" />
  {:else if kind === "chevron"}
    <polyline points="7,4 12,9 7,14" stroke-linejoin="round" />
  {:else if kind === "github"}
    <!-- the GitHub mark, filled rather than drawn in lines -->
    <path
      transform="translate(1 1)"
      fill="currentColor"
      stroke="none"
      d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
    />
  {:else if kind === "close"}
    <line x1="4" y1="4" x2="14" y2="14" />
    <line x1="14" y1="4" x2="4" y2="14" />
  {:else}
    <rect x="1.75" y="2.75" width="14.5" height="12.5" rx="2" />
    <line x1="6.75" y1="2.75" x2="6.75" y2="15.25" />
  {/if}
</svg>

<style>
  /* 18px at the default text size, scaled by the iPhone's Text Size setting (see app.css) */
  svg {
    display: block;
    width: calc(18rem / 17);
    height: calc(18rem / 17);
  }
</style>
