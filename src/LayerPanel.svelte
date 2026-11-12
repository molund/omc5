<script>
  import { BASEMAPS, LAYERS, spanNumbersAvailable } from "./lib/layerSwitches.js";
  import Icon from "./Icon.svelte";
  import { status } from "./lib/status.js";
  import { fly, slide } from "svelte/transition";
  import {
    layers,
    ui,
    setSwitch,
    setBasemap,
    showAll,
    reset,
    setZoom,
    fitZoom,
    isFit,
    centreView,
    animateGantry,
    stopAnimation,
  } from "./lib/appState/appState.svelte.js";

  // each press of zoom in or out changes the zoom by this factor, about the middle of the stage; Fit's zoom depends on the
  // stage and canvas shape, so it is worked out when pressed
  const ZOOM_STEP = 1.5;
  const avail = $derived(spanNumbersAvailable(layers));

  // the span number switch needs Clayton Clipper spans on screen, and the direction arrows and Progress purple the finished
  // spans they sit on, so they fade and can't be changed without them
  const disabled = (k) =>
    (k === "spanNumbers" && !avail) || ((k === "arrows" || k === "purpleSpans") && !layers.guideway);
  // the buttons in the button groups: the views, the gantry's Off / style row, and Show all and Reset; and what a button
  // that can't be pressed looks like (zoom out can't go past Fit, Center has nothing to move at Fit, and Reset has nothing
  // to do until a layer is changed)
  const GROUP_BUTTON = "px-2 py-1.25";
  const DISABLED = "disabled:cursor-default disabled:border-(--line) disabled:opacity-40";
  const STEP_BUTTON =
    "rounded-none border-0 bg-transparent px-2 py-1.5 focus-visible:-outline-offset-2 [&:hover:not(:disabled)]:bg-(--bg)";
  const ICON_BUTTON = "rounded-lg p-1.5";
  const LINK = "inline-flex items-center gap-1.5 text-inherit [&_svg]:h-[1.2em] [&_svg]:w-[1.2em] [&_svg]:flex-none";
  const opacity = (k) => (disabled(k) ? "0.4" : "");
  // greenbelt and creeks only in drawing mode, roads (with their labels) and walking paths in the two SFMSF views (drawing
  // mode and SFMSF zoom), the basemap everywhere but drawing mode
  function hidden(k) {
    if (k === "greenbelt" || k === "creeks") return !layers.sfmsfDrawing;
    if (k === "roads" || k === "walk") return !(layers.sfmsfDrawing || layers.sfmsfAerial);
    if (k === "aerial") return layers.sfmsfDrawing;
    if (k === "stationLabels") return layers.sfmsfDrawing || layers.sfmsfAerial;
    // the Clipper's spans in purple: not in the two SFMSF views, which are about the facility
    if (k === "purpleSpans") return layers.sfmsfDrawing || layers.sfmsfAerial;
    return false;
  }
  function change(e, k) {
    setSwitch(k, e.currentTarget.checked);
    // the mode logic can put the switch straight back (e.g. unticking Full), so match the box to the state
    e.currentTarget.checked = layers[k];
  }
</script>

<!-- on a phone it slides in from the left -->
<aside
  class="flex min-h-0 flex-col overflow-hidden border-r border-(--line) bg-(--panel) text-base phone:fixed phone:inset-y-0 phone:left-0 phone:z-30 phone:w-[min(calc(var(--spacing)*75),85vw)] phone:shadow-panel"
  transition:fly={{ x: -320, opacity: 1, duration: ui.phone ? 200 : 0 }}
>
  <!-- everything but the zoom footer scrolls -->
  <div
    class="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-6 phone:pt-[calc(env(safe-area-inset-top,0px)_+_var(--spacing)*4)] phone:pb-[calc(env(safe-area-inset-bottom,0px)_+_var(--spacing)*6)]"
  >
    <div class="mb-2 flex items-center justify-between gap-2">
      <!-- the title: the Clayton Clipper logo with "Map" beside it, small and spaced out, as on the progress card and Trackside; not a
           heading, since the page's one h1 is the hidden text in index.html -->
      <p class="eyebrow flex items-center gap-2.5 text-xs">
        <img
          class="h-9 w-auto logo"
          src="{import.meta.env.BASE_URL}images/logo.png"
          alt="Clayton Clipper"
          width="625"
          height="351"
        /><span>Map</span>
      </p>
      <button
        title={ui.phone ? "Close the menu" : "Hide the layer panel"}
        aria-label={ui.phone ? "Close the menu" : "Hide the layer panel"}
        class="p-1.5"
        onclick={() => (ui.collapsed = true)}><Icon kind={ui.phone ? "close" : "panel"} /></button
      >
    </div>
    <div class="mt-3.5 mb-1 text-base font-bold text-(--mute)">View presets</div>
    <!-- the views are presets, picked like the zoom buttons; picking the one already on does nothing to the view, as a radio button did -->
    <div class="mt-1.5 flex flex-col gap-1">
      {#each LAYERS[0][1] as [k, label]}
        <button
          class="{GROUP_BUTTON} text-left"
          class:on={layers[k]}
          aria-pressed={layers[k]}
          onclick={() => {
            if (!layers[k]) setSwitch(k, true);
            // on a phone, picking a view closes the menu to show it
            if (ui.phone) ui.collapsed = true;
          }}>{label}</button
        >
      {/each}
    </div>
    <!-- the layer switches fold away under Layers, so the panel is short until they are wanted -->
    <button
      class={[
        "mt-5.5 mb-2 flex min-h-11 w-full items-center justify-between text-base font-bold [&_svg]:[transition:transform_150ms]",
        ui.layersOpen && "[&_svg]:[transform:rotate(90deg)]",
      ]}
      aria-expanded={ui.layersOpen}
      aria-controls="layer-list"
      onclick={() => (ui.layersOpen = !ui.layersOpen)}>Layers<Icon kind="chevron" /></button
    >
    {#if ui.layersOpen}
      <div id="layer-list" transition:slide={{ duration: 150 }}>
        {#each LAYERS.slice(1) as [group, rows]}
          <div class="group-label">
            {group}
          </div>
          {#each rows as [k, label]}
            <!-- the basemap switch has a dropdown beside it, for which basemap, that can't be changed while it is off -->
            <!-- Progress purple is a child of Finished spans: indented under it -->
            <div
              class={["flex items-center gap-2", k === "purpleSpans" && "ml-6"]}
              style:display={hidden(k) ? "none" : ""}
            >
              <label
                class={[
                  "flex flex-1 items-center gap-2.5 rounded-md px-1 py-1.5",
                  disabled(k) ? "cursor-default" : "cursor-pointer hover:bg-(--bg)",
                ]}
                style:opacity={opacity(k)}
              >
                <input
                  class="m-0 h-4.5 w-4.5 accent-(--accent) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
                  type="checkbox"
                  checked={layers[k]}
                  disabled={disabled(k)}
                  onchange={(e) => change(e, k)}
                />{label}
              </label>
              <!-- no "animate" link once status.yaml has the gantry on the last span, 105: there's nowhere left to move it -->
              {#if k === "gantry" && !(status.span >= 105)}
                <!-- a small link that plays the gantry's moves span by span to the last span (MapView does the moving):
                     it ticks the Gantry box first if it's off (turning it off again stops and resets the moves), shows
                     the finished spans and supports and hides the unfinished spans, span numbers and arrows, and on a
                     phone closes the menu so the map shows. While the moves play it reads "stop" and stops them, as the
                     progress card's Stop button does -->
                <button
                  class="border-0 bg-transparent p-0 text-xs text-(--link) underline"
                  onclick={() => {
                    if (ui.gantryPlaying) return stopAnimation();
                    animateGantry();
                    if (ui.phone) ui.collapsed = true;
                  }}>{ui.gantryPlaying ? "stop" : "animate"}</button
                >
              {/if}
              {#if k === "aerial"}
                <select
                  class="min-w-0 rounded-md border border-(--line) bg-(--panel) px-1 py-0.5 text-base text-(--ink) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent) disabled:cursor-default disabled:opacity-40"
                  aria-label="Which basemap"
                  disabled={!layers.aerial}
                  value={ui.basemap}
                  onchange={(e) => setBasemap(e.currentTarget.value)}
                >
                  {#each BASEMAPS as [key, name]}
                    <option value={key}>{name}</option>
                  {/each}
                </select>
              {/if}
            </div>
          {/each}
        {/each}
        <div class="mt-2.5 flex flex-wrap gap-1">
          <button class="{GROUP_BUTTON} {DISABLED}" onclick={showAll}>Show all</button><button
            class="{GROUP_BUTTON} {DISABLED}"
            disabled={!ui.changed}
            onclick={reset}>Reset</button
          >
        </div>
      </div>
    {/if}
    <!-- the links, set apart from the map controls above: Trackside (named for what it holds, since its own name isn't known
         yet) and the source code, each with its mark -->
    <p class="fine-print mt-8">
      <a class={LINK} href="{import.meta.env.BASE_URL}trackside/"
        ><Icon kind="comment" />Trackside: updates and comments</a
      >
    </p>
    <p class="fine-print">
      <a class={LINK} href="{import.meta.env.BASE_URL}about/"><Icon kind="info" />About this site</a>
    </p>
    <p class="fine-print">
      <a class={LINK} href="https://github.com/molund/omc5"
        ><svg viewBox="0 0 16 16" aria-hidden="true"
          ><path
            fill="currentColor"
            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
          /></svg
        >Source code on GitHub</a
      >
    </p>
  </div>
  <!-- the zoom controls stay pinned to the bottom of the panel; none on a phone: it pinches to zoom -->
  {#if !ui.phone}
    <footer class="flex flex-none items-center gap-1.5 border-t border-(--line) bg-(--panel) px-4 py-2.5">
      <!-- zoom out, the zoom (1.0× at Fit), and zoom in, in one pill -->
      <!-- − and + inside the pill: no border of their own, a soft fill on hover;
           the zoom between hairlines, in figures of even width so it doesn't jitter as it changes -->
      <div
        class="flex flex-1 items-stretch overflow-hidden rounded-lg border border-(--line)"
        role="group"
        aria-label="Zoom"
      >
        <button
          class="{STEP_BUTTON} {DISABLED}"
          title="Zoom out"
          aria-label="Zoom out"
          disabled={isFit()}
          onclick={() => setZoom(ui.zoom / ZOOM_STEP)}><Icon kind="minus" /></button
        >
        <output
          class="flex flex-1 items-center justify-center border-x border-(--line) text-sm text-(--mute) tabular-nums"
          aria-live="polite">{(ui.zoom / ui.fit).toFixed(1)}×</output
        >
        <button
          class="{STEP_BUTTON} {DISABLED}"
          title="Zoom in"
          aria-label="Zoom in"
          onclick={() => setZoom(ui.zoom * ZOOM_STEP)}><Icon kind="plus" /></button
        >
      </div>
      <button
        class="{ICON_BUTTON} {DISABLED}"
        class:on={isFit()}
        title="Zoom to fit"
        aria-label="Zoom to fit"
        aria-pressed={isFit()}
        onclick={() => setZoom(fitZoom())}><Icon kind="fit" /></button
      >
      <button
        class="{ICON_BUTTON} {DISABLED}"
        title="Center without zooming"
        aria-label="Center without zooming"
        disabled={isFit()}
        onclick={centreView}><Icon kind="centre" /></button
      >
    </footer>
  {/if}
</aside>
