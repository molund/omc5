<script>
  import { onMount, untrack } from "svelte";
  import mapSvg from "../assets/map.svg?raw";
  import { startEsriTiles, esriCredit, defaultCredit, isEsri } from "./esriTiles.js";
  import { showAerialPhotos } from "./aerialImages.js";
  import { DRAW_VB, SFMSF_AERIAL_VB, FULL_VB, GANTRY_LENGTH } from "../lib/layerSwitches.js";
  import { tagBuiltBy } from "./builtBy.js";
  import { gantryProgress } from "./gantryProgress.js";
  import { placeGantry } from "../lib/placeGantry.js";
  import { playToEnd, stopGantry, lowerSupports, raiseSupports } from "./gantryAnimation.js";
  import { status } from "../lib/status.js";
  import {
    layers,
    ui,
    els,
    setView,
    setZoom,
    fitZoom,
    holdMap,
    isFit,
    fillView,
    progressView,
    horizontalView,
  } from "../lib/appState/appState.svelte.js";
  import { applyAddress } from "../lib/appState/hash.svelte.js";
  import ProgressCard from "../ProgressCard.svelte";

  let stage;
  let drag = $state(null);
  // the layer panel's "animate" link: the gantry moves on span by span to the last span (span 48 in the two SFMSF views),
  // then the link comes back. Only ui.gantryPlaying is watched; the moves themselves are untracked, so nothing they read
  // starts them again.
  $effect(() => {
    if (!ui.gantryPlaying) return;
    untrack(() => {
      // the next frame, once the Gantry layer the link may have just turned on is showing (a hidden gantry has no size)
      requestAnimationFrame(() => {
        frameGantry().then(followGantry);
      });
      playToEnd(els.svg, layers.sfmsfDrawing || layers.sfmsfAerial ? 48 : undefined).finally(
        () => (ui.gantryPlaying = false),
      );
    });
  });

  // while the gantry animates, the supports are drawn below the spans; they go back above them when it stops
  $effect(() => {
    if (!ui.ready) return;
    if (ui.gantryPlaying) lowerSupports(els.svg);
    else raiseSupports();
  });

  /** While the gantry animates, how much of the stage's width or height the whole gantry fills. */
  const GANTRY_FILL = 0.7;
  /** The space kept around the gantry on every side when it is framed, as a share of its length (GANTRY_LENGTH). */
  const GANTRY_PAD = 0.08;

  /** How long the zoom onto the gantry takes when an animation starts, in milliseconds. */
  const ZOOM_TIME = 1200;

  /**
   * Zooms smoothly so the whole gantry (its trusses and all four supports), with GANTRY_PAD of its length added on every
   * side, fills GANTRY_FILL of the stage, and centres it, over ZOOM_TIME. Each frame zooms about the gantry's centre point
   * (gantryCentre), so it stays put while the map grows around it, and scrolls it the matching part of the way to the
   * stage's middle. The zoom grows by the same ratio each step (it is eased between the two zooms' logarithms), so it
   * looks steady rather than speeding up as it gets closer.
   * @returns {Promise<void>} Done when the zoom is.
   */
  function frameGantry() {
    const gantry = els.svg?.querySelector("#clayton-clipper"),
      box = gantry?.getBoundingClientRect();
    if (!box?.width) return Promise.resolve();
    // the padding on each side, on the screen: GANTRY_PAD of the gantry's length in canvas units, times the screen pixels
    // to a canvas unit now
    const m = els.svg.getScreenCTM(),
      pad = GANTRY_PAD * GANTRY_LENGTH * Math.hypot(m.a, m.b);
    const frame = stage.getBoundingClientRect(),
      from = ui.zoom,
      to =
        from *
        Math.min(
          (frame.width * GANTRY_FILL) / (box.width + 2 * pad),
          (frame.height * GANTRY_FILL) / (box.height + 2 * pad),
        ),
      // where the gantry's centre point starts, from the stage's middle
      start = offCentre(gantry);
    // ease in and out, gently: a sine curve, whose fastest moment (the middle) is only about 1.6 times its average speed
    const ease = (t) => (1 - Math.cos(Math.PI * t)) / 2;
    return new Promise((done) => {
      let t0 = null;
      const step = (now) => {
        t0 ??= now;
        const t = Math.min(1, (now - t0) / ZOOM_TIME),
          e = ease(t);
        // zoom about the gantry's centre point, where it is on the screen now
        const c = gantryCentre(gantry);
        setZoom(from * (to / from) ** e, c.x, c.y);
        // then scroll so it is (1 − e) of its starting distance from the stage's middle
        const now_ = offCentre(gantry);
        stage.scrollLeft += now_.x - start.x * (1 - e);
        stage.scrollTop += now_.y - start.y * (1 - e);
        if (t < 1 && ui.gantryPlaying) requestAnimationFrame(step);
        else done();
      };
      requestAnimationFrame(step);
    });
  }

  /**
   * The point the animation keeps centred, on the screen: the middle of the gantry's trusses (the two .clipper-truss
   * groups, together), where they are now, mid-move included (the gantry's middle if they can't be found).
   * @param {Element} gantry The gantry, #clayton-clipper.
   * @returns {{ x: number, y: number }}
   */
  function gantryCentre(gantry) {
    const trusses = [...gantry.querySelectorAll(".clipper-truss")].map((t) => t.getBoundingClientRect());
    if (!trusses.length) trusses.push(gantry.getBoundingClientRect());
    const left = Math.min(...trusses.map((r) => r.left)),
      right = Math.max(...trusses.map((r) => r.right)),
      top = Math.min(...trusses.map((r) => r.top)),
      bottom = Math.max(...trusses.map((r) => r.bottom));
    return { x: (left + right) / 2, y: (top + bottom) / 2 };
  }

  /**
   * How far the gantry's centre point (gantryCentre) is from the stage's middle, on the screen.
   * @param {Element} gantry The gantry, #clayton-clipper.
   * @returns {{ x: number, y: number }}
   */
  function offCentre(gantry) {
    const c = gantryCentre(gantry),
      f = stage.getBoundingClientRect();
    return { x: c.x - (f.left + f.width / 2), y: c.y - (f.top + f.height / 2) };
  }

  /**
   * Keeps the gantry's centre point (gantryCentre) in the middle of the stage while it animates: every frame, the map
   * scrolls by however far the point has moved. It stops when the animation does. Zooming by hand still works (the point
   * stays in the middle); panning by hand is undone on the next frame.
   * @returns {void}
   */
  function followGantry() {
    const look = () => {
      if (!ui.gantryPlaying) return;
      // measured from where the map actually is: browsers round the scroll position to whole pixels, so keeping a
      // fractional one and adding each frame's offset to it counts every rounding twice, and the map flicks back and
      // forth a pixel every few frames. From the real scroll position, the map only moves once the point is half a pixel
      // or more off centre, and always the way the gantry is going.
      const gantry = els.svg?.querySelector("#clayton-clipper");
      if (gantry?.getBoundingClientRect().width) {
        const off = offCentre(gantry);
        if (Math.abs(off.x) >= 0.5) stage.scrollLeft += off.x;
        if (Math.abs(off.y) >= 0.5) stage.scrollTop += off.y;
      }
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  }
  // picking another view preset stops the gantry's moves and puts the drawing back as status.yaml has it (the moves give
  // up, and the "animate" link comes back when playToEnd ends)
  let viewWas = ui.view;
  $effect(() => {
    const view = ui.view;
    if (view === viewWas) return;
    viewWas = view;
    untrack(() => stopGantry(els.svg));
  });
  // turning the gantry off does the same
  $effect(() => {
    if (!layers.gantry) untrack(() => stopGantry(els.svg));
  });
  let touchDrag = null;
  // whether the map is still where its view opened it, untouched by a pan or zoom on it (and the zoom the opening framing
  // set, so the zoom buttons count too): until then, a Progress map is framed again if the stage changes size (see the
  // ResizeObserver in onMount)
  let untouched = true,
    framedZoom = null;
  let edgeTimer;
  let esriTiles = $state(null);
  // the basemap shown: the dropdown's pick, in every aerial view (each view starts on its own: basemapFor). One at a time, whatever the zoom
  const basemap = $derived(ui.basemap);
  let credit = $state(defaultCredit(basemap));
  const basemapShown = $derived(layers.aerial && !layers.sfmsfDrawing);
  // Esri's credits show only with its basemaps
  const esriShown = $derived(basemapShown && isEsri(basemap));

  // the Apple Maps photos, loaded only once that basemap is showing, or the Esri tiles (which may need loading when the
  // basemap comes on again or is picked)
  $effect(() => {
    if (!esriTiles) return;
    showAerialPhotos(els.svg, basemapShown && basemap === "apple", ui.view === "sfmsfAerial");
    if (basemapShown) esriTiles.setBasemap(basemap);
  });
  // Vertical turns the span numbers 90 degrees clockwise, each about its own point, on top of the turn map.svg gives it
  // (the drawing's own turn is kept in data-turn, and put back in every other view)
  $effect(() => {
    const vertical = layers.vertical;
    if (!ui.ready) return;
    els.svg.querySelectorAll("text.ccnumber").forEach((t) => {
      t.dataset.turn ??= t.getAttribute("transform") ?? "";
      const turn = vertical
        ? `${t.dataset.turn} rotate(90 ${t.getAttribute("x")} ${t.getAttribute("y")})`.trim()
        : t.dataset.turn;
      if (turn) t.setAttribute("transform", turn);
      else t.removeAttribute("transform");
    });
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
    if (layers.progress) {
      progressView();
      framedZoom = ui.zoom;
    } else if (layers.sfmsfDrawing) {
      setView(DRAW_VB);
      fillView();
    } else if (layers.sfmsfAerial) {
      setView(SFMSF_AERIAL_VB);
      fillView();
    } else if (layers.horizontal) horizontalView();
    else if (layers.vertical) horizontalView(true);
    // the views a reload can come back to (the page itself opens on Progress)
    else if (ui.view === "fullAerial") {
      setView(FULL_VB);
      fillView();
    }
    // a view or span named in the address (?view=aerial, ?view=horizontal, ?view=vertical, ?view=omc, ?view=omc-drawing, ?span=36) wins over
    // the opening view
    applyAddress();

    // touchpad pinch: Chrome, Edge and Firefox send it as ctrl+wheel; Safari sends gesture events
    const wheel = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      untouched = false;
      // a mouse wheel notch is much bigger than a touchpad pinch event, so it gets a gentler factor
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : 1),
        k = e.metaKey && !e.ctrlKey ? 0.002 : 0.01;
      setZoom(ui.zoom * Math.exp(-dy * k), e.clientX, e.clientY);
    };
    let gz = 100;
    const gesturestart = (e) => {
      e.preventDefault();
      untouched = false;
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
      untouched = false;
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
    // Progress opens framed on the gantry's span, worked out from the stage's size at that moment. A page can open at one
    // size and be shown at another: one Google prerendered from its search results (laid out before it's shown), or a phone
    // browser whose toolbars settle after the page opens. Until the map is panned or zoomed, Progress is framed again when
    // the stage changes size, and when a prerendered page is shown.
    const reframe = () => {
      if (!untouched || !layers.progress || ui.span || framedZoom === null || Math.abs(ui.zoom - framedZoom) > 0.01)
        return false;
      progressView();
      framedZoom = ui.zoom;
      return true;
    };
    document.addEventListener("prerenderingchange", reframe);
    // the stage's size and scroll position as they last were, for holdMap: by the time the stage's new size is reported, the
    // browser has already rescaled the map
    const seen = {
      width: stage.clientWidth,
      height: stage.clientHeight,
      left: stage.scrollLeft,
      top: stage.scrollTop,
    };
    const scrolled = () => {
      seen.left = stage.scrollLeft;
      seen.top = stage.scrollTop;
    };
    stage.addEventListener("scroll", scrolled, { passive: true });
    // a filled or fitted map stays so when the window or the layer panel changes the stage size; any other map stays at its
    // scale, on the same point
    const resize = new ResizeObserver(() => {
      if (!reframe()) {
        if (ui.filled) fillView();
        else if (isFit()) setZoom(fitZoom());
        else if (seen.width && stage.clientWidth && stage.clientWidth !== seen.width) holdMap(seen);
        else ui.fit = fitZoom();
      }
      seen.width = stage.clientWidth;
      seen.height = stage.clientHeight;
      scrolled();
    });
    resize.observe(stage);
    return () => {
      clearTimeout(edgeTimer);
      esriTiles?.stop();
      resize.disconnect();
      stage.removeEventListener("scroll", scrolled);
      document.removeEventListener("prerenderingchange", reframe);
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
    untouched = false;
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
  <!-- where the map zooms itself on a pinch (Safari), the browser mustn't zoom the page with it; Horizontal and Vertical:
       the white canvas backing would show past the turned photo, so it goes -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <main
    class={[
      "relative h-full min-w-0 touch-pan-x touch-pan-y overflow-auto overscroll-none bg-black select-none [-webkit-tap-highlight-color:transparent]",
      "[&_*]:[-webkit-tap-highlight-color:transparent] [&_*]:select-none",
      "[&_svg]:mx-auto [&_svg]:block [&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-none",
      "[&_#canvas-backing]:fill-black",
      drag ? "cursor-grabbing" : "cursor-grab",
      !safariPinch && "touch-pinch-zoom",
      (layers.horizontal || layers.vertical) && "[&_#canvas-backing]:hidden",
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
