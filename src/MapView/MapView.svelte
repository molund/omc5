<script>
  import { onMount } from "svelte";
  import mapSvg from "../assets/map.svg?raw";
  import { startEsriTiles, esriCredit, defaultCredit, isEsri } from "./esriTiles.js";
  import { showAerialPhotos } from "./aerialImages.js";
  import { DRAW_VB, SFMSF_AERIAL_VB, FULL_VB, DEFAULT_BASEMAP } from "../lib/layerSwitches.js";
  import { tagBuiltBy } from "./builtBy.js";
  import { gantryProgress } from "./gantryProgress.js";
  import { placeGantry } from "../lib/placeGantry.js";
  import { status } from "../lib/status.js";
  import {
    layers,
    ui,
    els,
    setView,
    setZoom,
    fitZoom,
    isFit,
    fillView,
    progressView,
    horizontalView,
  } from "../lib/appState/appState.svelte.js";
  import { applyAddress } from "../lib/appState/hash.svelte.js";
  import ProgressCard from "../ProgressCard.svelte";

  let stage;
  let drag = $state(null);
  let touchDrag = null;
  let edgeTimer;
  let esriTiles = $state(null);
  // the basemap shown: the dropdown's pick in the SFMSF aerial view, the only one that has it; Apple Maps everywhere else.
  // One at a time, whatever the zoom
  const basemap = $derived(layers.sfmsfAerial ? ui.basemap : DEFAULT_BASEMAP);
  let credit = $state(defaultCredit(basemap));
  const basemapShown = $derived(layers.aerial && !layers.sfmsfDrawing);
  // Esri's credits show only with its basemaps
  const esriShown = $derived(basemapShown && isEsri(basemap));

  // the Apple Maps photos, or the Esri tiles (which may need loading when the basemap comes on again or is picked)
  $effect(() => {
    if (!esriTiles) return;
    showAerialPhotos(els.svg, basemap === "apple");
    if (basemapShown) esriTiles.setBasemap(basemap);
  });
  // each Esri basemap has its own credit; one that is still being read doesn't replace a later pick's
  $effect(() => {
    if (!isEsri(basemap)) return;
    let current = true;
    credit = defaultCredit(basemap);
    esriCredit(basemap).then((text) => {
      if (current) credit = text;
    });
    return () => (current = false);
  });

  function startDrag(clientX, clientY) {
    clearTimeout(edgeTimer);
    els.svg.style.transition = "";
    els.svg.style.translate = "";
    return {
      x: clientX,
      y: clientY,
      l: stage.scrollLeft,
      t: stage.scrollTop,
      maxLeft: stage.scrollWidth - stage.clientWidth,
      maxTop: stage.scrollHeight - stage.clientHeight,
    };
  }

  function pan(origin, clientX, clientY) {
    const left = origin.l - (clientX - origin.x);
    const top = origin.t - (clientY - origin.y);
    const boundedLeft = Math.max(0, Math.min(origin.maxLeft, left));
    const boundedTop = Math.max(0, Math.min(origin.maxTop, top));
    stage.scrollLeft = boundedLeft;
    stage.scrollTop = boundedTop;
    const box = els.svg.getBoundingClientRect();
    const marginX = box.width * 0.05;
    const marginY = box.height * 0.05;
    const offsetX = marginX * Math.tanh((boundedLeft - left) / marginX);
    const offsetY = marginY * Math.tanh((boundedTop - top) / marginY);
    els.svg.style.translate = `${offsetX}px ${offsetY}px`;
  }

  function settleEdge() {
    const svg = els.svg;
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    svg.style.transition = reducedMotion ? "" : "translate 180ms ease-out";
    svg.style.translate = "";
    clearTimeout(edgeTimer);
    edgeTimer = setTimeout(
      () => {
        svg.style.transition = "";
      },
      reducedMotion ? 0 : 180,
    );
  }

  onMount(() => {
    const svg = stage.querySelector("svg");
    els.stage = stage;
    els.svg = svg;
    tagBuiltBy(svg);
    // the gantry's span and whether it is complete come from status.yaml
    const gantry = svg.querySelector("#clayton-clipper");
    if (gantry && status.span) gantry.dataset.span = status.span;
    els.gantrySpanCentre = placeGantry(svg);
    ui.gantry = gantryProgress(svg, status.span ? status.complete : null);
    // the turn that levels the Clayton Clipper route: the line from span 105's label to span 1's, turned flat
    const toRoot = DOMMatrix.fromMatrix(svg.getScreenCTM()).inverse(),
      label = (n) => {
        const t = [...svg.querySelectorAll("text.ccnumber")].find((t) => t.textContent.trim() === String(n));
        return (
          t &&
          new DOMPoint(+t.getAttribute("x"), +t.getAttribute("y"))
            .matrixTransform(DOMMatrix.fromMatrix(t.getScreenCTM()))
            .matrixTransform(toRoot)
        );
      },
      first = label(1),
      last = label(ui.gantry ? ui.gantry.total : 105);
    if (first && last) els.routeAngle = (-Math.atan2(first.y - last.y, first.x - last.x) * 180) / Math.PI;
    // everything in the drawing goes in one group, so Horizontal can turn it all
    const turn = document.createElementNS("http://www.w3.org/2000/svg", "g");
    turn.id = "map-turn";
    turn.append(...svg.childNodes);
    svg.append(turn);
    els.turn = turn;
    esriTiles = startEsriTiles(svg, stage);
    ui.ready = true;
    svg.style.width = ui.zoom + "%";
    if (layers.progress) progressView();
    else if (layers.sfmsfDrawing) {
      setView(DRAW_VB);
      fillView();
    } else if (layers.sfmsfAerial) {
      setView(SFMSF_AERIAL_VB);
      fillView();
    } else if (layers.horizontal) horizontalView();
    // the views a reload can come back to (the page itself opens on Progress)
    else if (ui.view === "fullAerial") {
      setView(FULL_VB);
      fillView();
    }
    // a view or span named in the address (?view=aerial, ?view=horizontal, ?view=omc, ?view=omc-drawing, ?span=36) wins over
    // the opening view
    applyAddress();

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
    // Safari's own pinch would zoom the whole page instead; stop it anywhere on the page (a pinch that starts on the
    // progress card or a button, say), not only on the map, which zooms itself above
    const noPageZoom = (e) => e.preventDefault();
    stage.addEventListener("wheel", wheel, { passive: false });
    stage.addEventListener("gesturestart", gesturestart);
    stage.addEventListener("gesturechange", gesturechange);
    const touchstart = (event) => {
      touchDrag = event.touches.length === 1 ? startDrag(event.touches[0].clientX, event.touches[0].clientY) : null;
      if (!touchDrag) settleEdge();
    };
    const touchmove = (event) => {
      if (!touchDrag || event.touches.length !== 1) return;
      event.preventDefault();
      pan(touchDrag, event.touches[0].clientX, event.touches[0].clientY);
    };
    const touchend = () => {
      touchDrag = null;
      settleEdge();
    };
    stage.addEventListener("touchstart", touchstart, { passive: true });
    stage.addEventListener("touchmove", touchmove, { passive: false });
    stage.addEventListener("touchend", touchend);
    stage.addEventListener("touchcancel", touchend);
    document.addEventListener("gesturestart", noPageZoom, { passive: false });
    document.addEventListener("gesturechange", noPageZoom, { passive: false });
    // a filled or fitted map stays so when the window or the layer panel changes the stage size
    const resize = new ResizeObserver(() => {
      if (ui.filled) fillView();
      else if (isFit()) setZoom(fitZoom());
      else ui.fit = fitZoom();
    });
    resize.observe(stage);
    return () => {
      clearTimeout(edgeTimer);
      esriTiles?.stop();
      resize.disconnect();
      stage.removeEventListener("wheel", wheel);
      stage.removeEventListener("gesturestart", gesturestart);
      stage.removeEventListener("gesturechange", gesturechange);
      stage.removeEventListener("touchstart", touchstart);
      stage.removeEventListener("touchmove", touchmove);
      stage.removeEventListener("touchend", touchend);
      stage.removeEventListener("touchcancel", touchend);
      document.removeEventListener("gesturestart", noPageZoom);
      document.removeEventListener("gesturechange", noPageZoom);
    };
  });

  // drag to pan
  function pointerdown(e) {
    if (e.pointerType === "touch" || e.button !== 0) return;
    drag = startDrag(e.clientX, e.clientY);
    stage.setPointerCapture(e.pointerId);
  }
  function pointermove(e) {
    if (!drag) return;
    pan(drag, e.clientX, e.clientY);
  }
  const end = (event) => {
    if (event.pointerType === "touch" || !drag) return;
    drag = null;
    settleEdge();
  };
  // Safari (iPhone, iPad, Mac) sends pinches as gesture events, which the map zooms with itself
  const safariPinch = "GestureEvent" in window;
</script>

<div class="relative min-h-0 min-w-0">
  <!-- where the map zooms itself on a pinch (Safari), the browser mustn't zoom the page with it; Horizontal: the white
       canvas backing would show past the turned photo, so it goes -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <main
    class={[
      "relative h-full min-w-0 touch-pan-x touch-pan-y overflow-auto overscroll-none bg-black select-none [-webkit-tap-highlight-color:transparent]",
      "[&_*]:[-webkit-tap-highlight-color:transparent] [&_*]:select-none",
      "[&_svg]:mx-auto [&_svg]:block [&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-none",
      "[&_#canvas-backing]:fill-black",
      drag ? "cursor-grabbing" : "cursor-grab",
      !safariPinch && "touch-pinch-zoom",
      layers.horizontal && "[&_#canvas-backing]:hidden",
    ]}
    bind:this={stage}
    onpointerdown={pointerdown}
    onpointermove={pointermove}
    onpointerup={end}
    onpointercancel={end}
    onlostpointercapture={end}
  >
    {@html mapSvg}
  </main>
  {#if esriShown}
    <!-- Esri requires both credits, in view and not covered, wherever its basemaps show; a fixed 12px, not the Text Size -->
    <div
      class="absolute right-0 bottom-0 z-5 max-w-full rounded-tl-md bg-(--panel) px-1.5 py-0.5 text-[12px] text-(--mute)"
    >
      Powered by <a class="text-(--ink) underline" href="https://www.esri.com">Esri</a> | {credit}
    </div>
  {/if}
  <ProgressCard />
</div>
