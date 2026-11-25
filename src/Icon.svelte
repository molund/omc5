<script>
  // panel: a window with a sidebar (show or hide the layer panel); menu: three lines (open the menu on a phone); close: a
  // cross (close it, or the progress card); info: an information icon (bring the progress card back); comment: a speech bubble (comment on the newest update); comment-off: the same, struck through (comments are off); chevron: a "›" (fold the layer switches out or away); minus, plus: a − or + (zoom out or in); fit: four corner brackets (zoom to fit); centre: a crosshair (center without zooming); share: three joined dots (share the animation, or copy an update's permalink); back, forward: a circular arrow round −1 or +1 (a span back or on in the animation); pause, play: two bars or a triangle (pause the gantry animation or play it on); github: the GitHub mark (link to the repo); map: a folded map (the Map section); news: a page of text (the Trackside section)
  let { kind = "panel" } = $props();
</script>

<!-- Icons for the buttons that show and hide the layer panel and the progress card, scaled by
     the iPhone's Text Size setting (see app.css) -->
<svg
  class="block h-4.5 w-4.5"
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
  {:else if kind === "comment"}
    <!-- a speech bubble with its tail at the lower left -->
    <path
      d="M3.75 3h10.5a1.75 1.75 0 0 1 1.75 1.75v6.5A1.75 1.75 0 0 1 14.25 13H8.5l-3.5 3v-3H3.75A1.75 1.75 0 0 1 2 11.25v-6.5A1.75 1.75 0 0 1 3.75 3z"
      stroke-linejoin="round"
    />
  {:else if kind === "comment-off"}
    <!-- the speech bubble struck through from corner to corner -->
    <path
      d="M3.75 3h10.5a1.75 1.75 0 0 1 1.75 1.75v6.5A1.75 1.75 0 0 1 14.25 13H8.5l-3.5 3v-3H3.75A1.75 1.75 0 0 1 2 11.25v-6.5A1.75 1.75 0 0 1 3.75 3z"
      stroke-linejoin="round"
    />
    <line x1="2" y1="2" x2="16" y2="16" />
  {:else if kind === "share"}
    <!-- a share icon: three dots joined by two lines, one dot on the left and two on the right -->
    <circle cx="4.75" cy="9" r="2.25" />
    <circle cx="13.25" cy="4.25" r="2.25" />
    <circle cx="13.25" cy="13.75" r="2.25" />
    <path d="M6.75 7.9 11.25 5.35M6.75 10.1l4.5 2.55" />
  {:else if kind === "back" || kind === "forward"}
    <!-- a span back or on: an arrow curving round a "−1" (anticlockwise, from the top to an arrowhead at the upper left) or
         a "+1" (clockwise, mirrored) -->
    <g transform={kind === "forward" ? "matrix(-1 0 0 1 18 0)" : undefined} stroke-linejoin="round">
      <path d="M1.8 9a7.2 7.2 0 1 0 2.11-5.09L1.8 6" />
      <path d="M1.8 1.8V6H6" />
    </g>
    <text
      x="9"
      y="11.6"
      text-anchor="middle"
      font-size="7"
      font-weight="700"
      fill="currentColor"
      stroke="none"
      font-family="system-ui, sans-serif">{kind === "forward" ? "+1" : "−1"}</text
    >
  {:else if kind === "pause"}
    <!-- a pause icon: two filled bars -->
    <rect x="4.5" y="4.5" width="3" height="9" rx="0.75" fill="currentColor" stroke="none" />
    <rect x="10.5" y="4.5" width="3" height="9" rx="0.75" fill="currentColor" stroke="none" />
  {:else if kind === "play"}
    <!-- a play icon: a filled triangle pointing right, with its middle a little right of centre so it looks centred -->
    <path
      d="M6 4.25v9.5a.5.5 0 0 0 .77.42l7.1-4.75a.5.5 0 0 0 0-.84l-7.1-4.75A.5.5 0 0 0 6 4.25z"
      fill="currentColor"
      stroke="none"
    />
  {:else if kind === "info"}
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
    <polyline points="15.25,11.5 15.25,15.25 11.5,15.25" stroke-linejoin="round" />
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
  {:else if kind === "map"}
    <!-- a folded map: three panels -->
    <polygon
      points="2.25,4.25 6.5,2.75 11.5,4.25 15.75,2.75 15.75,13.75 11.5,15.25 6.5,13.75 2.25,15.25"
      stroke-linejoin="round"
    />
    <line x1="6.5" y1="2.75" x2="6.5" y2="13.75" />
    <line x1="11.5" y1="4.25" x2="11.5" y2="15.25" />
  {:else if kind === "news"}
    <!-- a page of text: a rounded sheet with three lines -->
    <rect x="3.25" y="2.25" width="11.5" height="13.5" rx="1.5" />
    <line x1="6" y1="6" x2="12" y2="6" />
    <line x1="6" y1="9" x2="12" y2="9" />
    <line x1="6" y1="12" x2="10" y2="12" />
  {:else if kind === "close"}
    <line x1="4" y1="4" x2="14" y2="14" />
    <line x1="14" y1="4" x2="4" y2="14" />
  {:else}
    <rect x="1.75" y="2.75" width="14.5" height="12.5" rx="2" />
    <line x1="6.75" y1="2.75" x2="6.75" y2="15.25" />
  {/if}
</svg>
