<script>
  import { onMount } from "svelte";
  import planSvg from "./assets/plan.svg?raw";
  import { DRAW_VB, ZOOM_VB } from "./lib/layers.js";
  import { tagLaunchers } from "./lib/tagLaunchers.js";
  import { gantrySpan } from "./lib/gantrySpan.js";
  import { placeGantry } from "./lib/gantryAnchor.js";
  import { status } from "./lib/status.js";
  import {
    layers,
    ui,
    els,
    setView,
    setZoom,
    fitZoom,
    isFit,
    progressView,
  } from "./lib/state.svelte.js";
  import ProgressCard from "./ProgressCard.svelte";

  let stage;
  let drag = $state(null);

  onMount(() => {
    const svg = stage.querySelector("svg");
    els.stage = stage;
    els.svg = svg;
    tagLaunchers(svg);
    // the gantry's span and whether it is complete come from status.yaml
    const gantry = svg.querySelector("#clayton-clipper");
    if (gantry && status.span) gantry.dataset.span = status.span;
    els.gantrySpan = placeGantry(svg);
    ui.gantry = gantrySpan(svg, status.span ? status.complete : null);
    // the turn that levels the Clayton Clipper route: the line from span 105's label to span 1's, turned flat
    const toRoot = DOMMatrix.fromMatrix(svg.getScreenCTM()).inverse(),
      label = (n) => {
        const t = [...svg.querySelectorAll("text.cclabel")].find(
          (t) => t.textContent.trim() === String(n),
        );
        return (
          t &&
          new DOMPoint(+t.getAttribute("x"), +t.getAttribute("y"))
            .matrixTransform(DOMMatrix.fromMatrix(t.getScreenCTM()))
            .matrixTransform(toRoot)
        );
      },
      first = label(1),
      last = label(ui.gantry ? ui.gantry.total : 105);
    if (first && last)
      els.routeAngle =
        (-Math.atan2(first.y - last.y, first.x - last.x) * 180) / Math.PI;
    // everything in the drawing goes in one group, so Horizontal can turn it all
    const turn = document.createElementNS("http://www.w3.org/2000/svg", "g");
    turn.id = "plan-turn";
    turn.append(...svg.childNodes);
    svg.append(turn);
    els.turn = turn;
    ui.ready = true;
    svg.style.width = ui.zoom + "%";
    if (layers.progress) progressView();
    else if (layers.drawing) setView(DRAW_VB);
    else if (layers.sfzoom) setView(ZOOM_VB);

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
    // a fitted plan stays fitted when the window or the layer panel changes the stage size
    const resize = new ResizeObserver(() => {
      if (isFit()) setZoom(fitZoom());
      else ui.fit = fitZoom();
    });
    resize.observe(stage);
    return () => {
      resize.disconnect();
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

<div class="wrap">
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <main
    class="stage"
    class:drag
    class:horizontal={layers.horizontal}
    bind:this={stage}
    onpointerdown={pointerdown}
    onpointermove={pointermove}
    onpointerup={end}
    onpointercancel={end}
  >
    {@html planSvg}
  </main>
  <ProgressCard />
</div>

<style>
  .wrap {
    position: relative;
    min-width: 0;
    min-height: 0;
  }
  .stage {
    position: relative;
    height: 100%;
    overflow: auto;
    min-width: 0;
    cursor: grab;
    touch-action: pan-x pan-y pinch-zoom;
  }
  .stage.drag {
    cursor: grabbing;
  }
  /* white, with the canvas centred top to bottom while it is smaller than the stage (the auto margins drop to 0 once it is
     bigger, so it still scrolls) */
  .stage.horizontal {
    background: #fff;
    display: flex;
  }
  .stage.horizontal :global(svg) {
    margin: auto;
    flex: none;
  }
  .stage,
  .stage :global(*) {
    -webkit-user-select: none;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .stage :global(svg) {
    display: block;
    margin: 0 auto;
    width: 100%;
    height: auto;
    max-width: none;
  }
</style>
