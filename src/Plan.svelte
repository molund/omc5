<script>
  import { onMount } from "svelte";
  import planSvg from "./assets/plan.svg?raw";
  import { DRAW_VB, ZOOM_VB } from "./lib/layers.js";
  import { tagLaunchers } from "./lib/tagLaunchers.js";
  import { layers, ui, els, setView, setZoom } from "./lib/state.svelte.js";

  let stage;
  let drag = $state(null);

  onMount(() => {
    const svg = stage.querySelector("svg");
    els.stage = stage;
    els.svg = svg;
    tagLaunchers(svg);
    ui.ready = true;
    if (layers.drawing) setView(DRAW_VB);
    else if (layers.sfzoom) setView(ZOOM_VB);
    svg.style.width = ui.zoom + "%";

    // touchpad pinch: Chrome, Edge and Firefox send it as ctrl+wheel; Safari sends gesture events
    const wheel = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      // a mouse wheel notch is much bigger than a touchpad pinch event, so it gets a gentler factor
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : 1),
        k = e.metaKey && !e.ctrlKey ? 0.002 : 0.01;
      setZoom(ui.zoom * Math.exp(-dy * k), e.clientX, e.clientY);
    };
    let gz = 100;
    const gesturestart = (e) => {
      e.preventDefault();
      gz = ui.zoom;
    };
    const gesturechange = (e) => {
      e.preventDefault();
      setZoom(gz * e.scale, e.clientX, e.clientY);
    };
    stage.addEventListener("wheel", wheel, { passive: false });
    stage.addEventListener("gesturestart", gesturestart);
    stage.addEventListener("gesturechange", gesturechange);
    return () => {
      stage.removeEventListener("wheel", wheel);
      stage.removeEventListener("gesturestart", gesturestart);
      stage.removeEventListener("gesturechange", gesturechange);
    };
  });

  // drag to pan
  function pointerdown(e) {
    if (e.pointerType === "touch") return;
    drag = {
      x: e.clientX,
      y: e.clientY,
      l: stage.scrollLeft,
      t: stage.scrollTop,
    };
    stage.setPointerCapture(e.pointerId);
  }
  function pointermove(e) {
    if (!drag) return;
    stage.scrollLeft = drag.l - (e.clientX - drag.x);
    stage.scrollTop = drag.t - (e.clientY - drag.y);
  }
  const end = () => (drag = null);
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<main
  class="stage"
  class:drag
  bind:this={stage}
  onpointerdown={pointerdown}
  onpointermove={pointermove}
  onpointerup={end}
  onpointercancel={end}
>
  {@html planSvg}
</main>

<style>
  .stage {
    position: relative;
    overflow: auto;
    min-width: 0;
    cursor: grab;
    touch-action: pan-x pan-y pinch-zoom;
  }
  .stage.drag {
    cursor: grabbing;
  }
  .stage,
  .stage :global(*) {
    -webkit-user-select: none;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .stage :global(svg) {
    display: block;
    width: 100%;
    height: auto;
    max-width: none;
  }
</style>
