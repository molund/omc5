<script>
  import { LAYERS, labelsAvailable } from "./lib/layers.js";
  import {
    layers,
    ui,
    toggle,
    showAll,
    reset,
    setZoom,
    fitZoom,
    isFit,
  } from "./lib/state.svelte.js";

  // Fit's zoom depends on the stage and canvas shape, so it is worked out when pressed
  const ZOOMS = [
    ["Fit", null],
    ["150%", 150],
    ["200%", 200],
    ["300%", 300],
  ];
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

<aside class="side">
  <div class="hd">
    <h1>Clayton Clipper Tracker</h1>
    <button
      title="Hide the layer panel"
      aria-label="Hide the layer panel"
      onclick={() => (ui.collapsed = true)}>Hide</button
    >
  </div>
  <p>
    Pick a view to start from, then switch layers on or off. Drag the plan to
    pan.
  </p>
  {#each LAYERS as [group, rows]}
    <div class="grp">{group}</div>
    {#each rows as [k, label]}
      <label
        class="row"
        class:disabled={disabled(k)}
        style:opacity={opacity(k)}
        style:display={hidden(k) ? "none" : ""}
      >
        <input
          type={group === "View" ? "radio" : "checkbox"}
          name={group === "View" ? "view" : undefined}
          checked={layers[k]}
          disabled={disabled(k)}
          onchange={(e) => change(e, k)}
        />{label}
      </label>
    {/each}
  {/each}
  <div class="btns">
    <button onclick={showAll}>Show all</button><button onclick={reset}
      >Reset</button
    >
  </div>
  <div class="grp">Zoom</div>
  <div class="btns">
    {#each ZOOMS as [text, p]}
      <button
        class:on={p == null ? isFit() : Math.abs(p - ui.zoom) < 0.5}
        onclick={() => setZoom(p ?? fitZoom())}>{text}</button
      >
    {/each}
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
  .btns {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 10px;
  }
  @media (max-width: 760px) {
    .side {
      max-height: 42vh;
      border-right: 0;
      border-bottom: 1px solid var(--line);
    }
  }
</style>
