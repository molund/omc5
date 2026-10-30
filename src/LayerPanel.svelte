<script>
  import { LAYERS, labelsAvailable } from "./lib/layers.js";
  import PanelIcon from "./PanelIcon.svelte";
  import { fly, slide } from "svelte/transition";
  import {
    layers,
    ui,
    toggle,
    showAll,
    reset,
    setZoom,
    fitZoom,
    isFit,
    centreView,
  } from "./lib/state.svelte.js";

  // each press of zoom in or out changes the zoom by this factor, about the middle of the stage; Fit's zoom depends on the
  // stage and canvas shape, so it is worked out when pressed
  const ZOOM_STEP = 1.5;
  const avail = $derived(labelsAvailable(layers));

  // the span-label switches need Clayton Clipper spans on screen, so they fade and can't be changed without them
  const disabled = (k) => (k === "labels" || k === "cclabels") && !avail;
  const opacity = (k) => (disabled(k) ? "0.4" : "");
  // greenbelt and creeks only in drawing mode, roads, walking paths and highway labels in the two SFMSF views (drawing mode and
  // SFMSF zoom),
  // aerial photo everywhere but drawing mode
  function hidden(k) {
    if (k === "greenbelt" || k === "creeks") return !layers.drawing;
    if (k === "roads" || k === "walk" || k === "roadlabels")
      return !(layers.drawing || layers.sfzoom);
    if (k === "aerial") return layers.drawing;
    return false;
  }
  // the Built by group is left out of the two SFMSF views
  const groupHidden = (group) =>
    group === "Built by" && (layers.drawing || layers.sfzoom);
  // the two pairs of switches that are one layer drawn one way or the other, picked as Off or a style: keyed by the pair's first
  // row in LAYERS, where its buttons go, with its label (none for the gantry, which has the Gantry heading) and its styles
  const PAIRS = {
    gantry: [
      null,
      [
        ["gantry", "Full"],
        ["beams", "Beams only"],
      ],
    ],
    labels: [
      "Span labels",
      [
        ["cclabels", "Full"],
        ["labels", "OMC5 only"],
      ],
    ],
  };
  const PAIRED = ["beams", "cclabels"];
  // the style showing (null for Off): the first if both are on (Show all turns on both gantry switches, and the drawing shows the full gantry)
  const picked = (opts) => opts.find(([k]) => layers[k])?.[0] ?? null;
  function change(e, k) {
    toggle(k, e.currentTarget.checked);
    // the mode logic can put the switch straight back (e.g. unticking Full), so match the box to the state
    e.currentTarget.checked = layers[k];
  }
</script>

<!-- on a phone it slides in from the left -->
<aside
  class="side"
  transition:fly={{ x: -320, opacity: 1, duration: ui.phone ? 200 : 0 }}
>
  <div class="hd">
    <h1>Clayton Clipper Tracker</h1>
    <button
      title={ui.phone ? "Close the menu" : "Hide the layer panel"}
      aria-label={ui.phone ? "Close the menu" : "Hide the layer panel"}
      class="hide"
      onclick={() => (ui.collapsed = true)}
      ><PanelIcon kind={ui.phone ? "close" : "panel"} /></button
    >
  </div>
  <p>
    Pick a view to start from, then switch layers on or off. Drag the plan to
    pan.
  </p>
  <div class="grp top">View</div>
  <!-- the views are presets, picked like the zoom buttons; picking the one already on does nothing to the view, as a radio button did -->
  <div class="views">
    {#each LAYERS[0][1] as [k, label]}
      <button
        class:on={layers[k]}
        aria-pressed={layers[k]}
        onclick={() => {
          if (!layers[k]) toggle(k, true);
          // on a phone, picking a view closes the menu to show it
          if (ui.phone) ui.collapsed = true;
        }}>{label}</button
      >
    {/each}
  </div>
  <!-- the layer switches fold away under Layers, so the panel is short until they are wanted -->
  <button
    class="fold"
    class:open={ui.layersOpen}
    aria-expanded={ui.layersOpen}
    aria-controls="layer-list"
    onclick={() => (ui.layersOpen = !ui.layersOpen)}
    >Layers<PanelIcon kind="chevron" /></button
  >
  {#if ui.layersOpen}
    <div id="layer-list" transition:slide={{ duration: 150 }}>
      {#each LAYERS.slice(1).filter(([g]) => !groupHidden(g)) as [group, rows]}
        <div class="grp">{group}</div>
        {#each rows as [k, label]}
          {#if PAIRS[k]}
            {@const [name, opts] = PAIRS[k]}
            {#if name}<div class="seg-name" style:opacity={opacity(k)}>
                {name}
              </div>{/if}
            <div
              class="seg"
              role="group"
              aria-label={name ?? group}
              style:opacity={opacity(k)}
            >
              {#each [[null, "Off"], ...opts] as [o, text]}
                <button
                  class:on={picked(opts) === o}
                  aria-pressed={picked(opts) === o}
                  disabled={disabled(k)}
                  onclick={() =>
                    o
                      ? toggle(o, true)
                      : opts.forEach(([s]) => toggle(s, false))}>{text}</button
                >
              {/each}
            </div>
          {:else if !PAIRED.includes(k)}
            <label
              class="row"
              class:disabled={disabled(k)}
              style:opacity={opacity(k)}
              style:display={hidden(k) ? "none" : ""}
            >
              <input
                type="checkbox"
                checked={layers[k]}
                disabled={disabled(k)}
                onchange={(e) => change(e, k)}
              />{label}
            </label>
          {/if}
        {/each}
      {/each}
      <div class="btns">
        <button onclick={showAll}>Show all</button><button
          disabled={!ui.changed}
          onclick={reset}>Reset</button
        >
      </div>
    </div>
  {/if}
  <div class="grp">Zoom</div>
  <div class="btns zoom">
    <button
      title="Zoom in"
      aria-label="Zoom in"
      onclick={() => setZoom(ui.zoom * ZOOM_STEP)}>+</button
    >
    <button
      title="Zoom out"
      aria-label="Zoom out"
      disabled={isFit()}
      onclick={() => setZoom(ui.zoom / ZOOM_STEP)}>−</button
    >
    <button class:on={isFit()} onclick={() => setZoom(fitZoom())}>Fit</button>
    <button
      title="Center the plan at this zoom"
      disabled={isFit()}
      onclick={centreView}>Center</button
    >
  </div>
</aside>

<style>
  .side {
    background: var(--panel);
    border-right: 1px solid var(--line);
    overflow-y: auto;
    padding: 16px 16px 24px;
    /* all text in the panel is sized in rem, so it follows the iPhone's Text Size setting (see app.css); the sizes match
       the old 15px rows, 13px buttons and notes, and 17px heading at the default text size */
    font-size: calc(15rem / 17);
  }
  .side h1 {
    font-size: 1rem;
    margin: 0;
  }
  .side p {
    margin: 0 0 14px;
    color: var(--mute);
    font-size: calc(13rem / 17);
  }
  .hd {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 2px;
  }
  .hide {
    padding: calc(6rem / 17);
  }
  .grp {
    margin: 14px 0 4px;
    font-weight: 600;
    font-size: calc(13rem / 17);
    color: var(--mute);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 4px;
    border-radius: 6px;
    cursor: pointer;
  }
  .row:hover {
    background: var(--bg);
  }
  /* a switch that can't be changed doesn't look clickable */
  .row.disabled {
    cursor: default;
  }
  .row.disabled:hover {
    background: none;
  }
  .row input {
    width: 18px;
    height: 18px;
    accent-color: var(--accent);
    margin: 0;
  }
  .row input:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .views {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 6px;
  }
  .views button {
    text-align: left;
  }
  /* a full-width row, tall enough to tap on a phone, with its chevron pointing down when the switches are folded out */
  .fold {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: calc(44rem / 17);
    margin-top: 14px;
  }
  /* the panel's two sections, View and Layers, are headed a little larger than the rest of its text, and bold */
  .top,
  .fold {
    font-size: calc(16rem / 17);
    font-weight: 700;
  }
  /* a pair's Off and two styles, side by side; they wrap at a large text size */
  .seg-name {
    padding: 6px 4px 0;
  }
  .seg {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 6px 4px;
  }
  .seg button {
    flex: 1 1 auto;
  }
  .seg button:disabled {
    cursor: default;
  }
  .fold :global(svg) {
    transition: transform 150ms;
  }
  .fold.open :global(svg) {
    transform: rotate(90deg);
  }
  .btns {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 10px;
  }
  /* the four zoom buttons share the panel's width equally, lining up with the full-width buttons above */
  .zoom button {
    flex: 1;
  }
  /* zoom out can't go past Fit, Center has nothing to move at Fit, and Reset has nothing to do until a layer is changed */
  .btns button:disabled {
    opacity: 0.4;
    cursor: default;
    border-color: var(--line);
  }
  @media (max-width: 760px) {
    .side {
      position: fixed;
      top: 0;
      bottom: 0;
      left: 0;
      z-index: 30;
      width: min(300px, 85vw);
      padding-top: calc(env(safe-area-inset-top, 0px) + 16px);
      padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 24px);
      box-shadow: 2px 0 12px rgba(0, 0, 0, 0.3);
    }
  }
</style>
