<script>
  import { LAYERS, labelsAvailable } from "./lib/layers.js";
  import PanelIcon from "./PanelIcon.svelte";
  import { fly } from "svelte/transition";
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
  {#each LAYERS as [group, rows]}
    <div class="grp">{group}</div>
    {#if group === "View"}
      <!-- the views are presets, picked like the zoom buttons; picking the one already on does nothing to the view, as a radio button did -->
      <div class="views">
        {#each rows as [k, label]}
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
    {:else}
      {#each rows as [k, label]}
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
      {/each}
    {/if}
  {/each}
  <div class="btns">
    <button onclick={showAll}>Show all</button><button
      disabled={!ui.changed}
      onclick={reset}>Reset</button
    >
  </div>
  <div class="grp">Zoom</div>
  <div class="btns">
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
  }
  .side h1 {
    font-size: 17px;
    margin: 0;
  }
  .side p {
    margin: 0 0 14px;
    color: var(--mute);
    font-size: 13px;
  }
  .hd {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 2px;
  }
  .hide {
    padding: 6px;
  }
  .grp {
    margin: 14px 0 4px;
    font-weight: 600;
    font-size: 13px;
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
  .btns {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 10px;
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
