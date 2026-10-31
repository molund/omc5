<script>
  import { LAYERS, labelsAvailable } from "./lib/layerSwitches.js";
  import Icon from "./Icon.svelte";
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
    isMike,
  } from "./lib/appState.svelte.js";

  // each press of zoom in or out changes the zoom by this factor, about the middle of the stage; Fit's zoom depends on the
  // stage and canvas shape, so it is worked out when pressed
  const ZOOM_STEP = 1.5;
  const avail = $derived(labelsAvailable(layers));

  // the span-label switches need Clayton Clipper spans on screen, and the direction arrows the finished spans they sit on, so
  // they fade and can't be changed without them
  const disabled = (k) =>
    ((k === "labels" || k === "cclabels") && !avail) ||
    (k === "arrows" && !layers.guideway);
  const opacity = (k) => (disabled(k) ? "0.4" : "");
  // greenbelt and creeks only in drawing mode, roads (with their labels), construction yard and walking paths in the two SFMSF
  // views (drawing mode and SFMSF zoom),
  // aerial photo everywhere but drawing mode, and the SFMSF span labels and the support beams on their own only for Mike
  function hidden(k) {
    if (k === "labels" || k === "beams") return !isMike;
    if (k === "greenbelt" || k === "creeks") return !layers.drawing;
    if (k === "roads" || k === "yard" || k === "walk")
      return !(layers.drawing || layers.sfzoom);
    if (k === "aerial") return layers.drawing;
    return false;
  }
  // the Reference group shows only in the two SFMSF views; the Built by group only for Mike, and not in the two SFMSF views
  const sfmsf = $derived(layers.drawing || layers.sfzoom);
  const groupHidden = (group) =>
    (group === "Reference" && !sfmsf) ||
    (group === "Built by" && (!isMike || sfmsf));
  // switches picked from a row of buttons, Off or a style, instead of checkboxes (none at the moment): keyed by the first row
  // in LAYERS, where the buttons go, with its label (or none) and its styles; PAIRED lists the other rows they cover
  const PAIRS = {};
  const PAIRED = [];
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
  <!-- everything but the zoom footer scrolls -->
  <div class="body">
    <div class="hd">
      <!-- the title, with a small GitHub mark beside it linking to the site's source -->
      <div class="ttl">
        <h1>Clayton Clipper Tracker</h1>
        <a
          class="gh"
          href="https://github.com/molund/omc5"
          target="_blank"
          rel="noopener"
          title="Source on GitHub"
          aria-label="Source on GitHub"><Icon kind="github" /></a
        >
      </div>
      <button
        title={ui.phone ? "Close the menu" : "Hide the layer panel"}
        aria-label={ui.phone ? "Close the menu" : "Hide the layer panel"}
        class="hide"
        onclick={() => (ui.collapsed = true)}
        ><Icon kind={ui.phone ? "close" : "panel"} /></button
      >
    </div>
    <!-- the source code, with GitHub's mark -->
    <p>
      <a class="repo" href="https://github.com/molund/omc5"
        ><svg viewBox="0 0 16 16" aria-hidden="true"
          ><path
            fill="currentColor"
            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
          /></svg
        >Source code on GitHub</a
      >
    </p>
    <div class="grp top">View presets</div>
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
      >Layers<Icon kind="chevron" /></button
    >
    {#if ui.layersOpen}
      <div id="layer-list" transition:slide={{ duration: 150 }}>
        {#each LAYERS.slice(1).filter(([g]) => !groupHidden(g)) as [group, rows]}
          <div class="grp">{group}</div>
          {#each rows as [k, label]}
            {#if PAIRS[k]}
              {@const [name, all] = PAIRS[k]}
              <!-- the support beams on their own are only for Mike -->
              {@const opts = all.filter(([o]) => o !== "beams" || isMike)}
              {#if name}<div class="grp" style:opacity={opacity(k)}>
                  {name}
                </div>{/if}
              <div
                class="btns"
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
                        : opts.forEach(([s]) => toggle(s, false))}
                    >{text}</button
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
  </div>
  <!-- the zoom controls stay pinned to the bottom of the panel; none on a phone: it pinches to zoom -->
  {#if !ui.phone}
    <footer class="foot">
      <!-- zoom out, the zoom (1.0× at Fit), and zoom in, in one pill -->
      <div class="step" role="group" aria-label="Zoom">
        <button
          title="Zoom out"
          aria-label="Zoom out"
          disabled={isFit()}
          onclick={() => setZoom(ui.zoom / ZOOM_STEP)}
          ><Icon kind="minus" /></button
        >
        <output aria-live="polite">{(ui.zoom / ui.fit).toFixed(1)}×</output>
        <button
          title="Zoom in"
          aria-label="Zoom in"
          onclick={() => setZoom(ui.zoom * ZOOM_STEP)}
          ><Icon kind="plus" /></button
        >
      </div>
      <button
        class="ico"
        class:on={isFit()}
        title="Fit the whole plan"
        aria-label="Fit the whole plan"
        aria-pressed={isFit()}
        onclick={() => setZoom(fitZoom())}><Icon kind="fit" /></button
      >
      <button
        class="ico"
        title="Center the plan at this zoom"
        aria-label="Center the plan at this zoom"
        disabled={isFit()}
        onclick={centreView}><Icon kind="centre" /></button
      >
    </footer>
  {/if}
</aside>

<style>
  /* a column: the scrolling body above, the zoom footer pinned below */
  .side {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
    background: var(--panel);
    border-right: 1px solid var(--line);
    /* all text in the panel is sized in rem, so it follows the iPhone's Text Size setting (see app.css); the sizes match
       the old 15px rows, 13px buttons and notes, and 17px heading at the default text size */
    font-size: calc(15rem / 17);
  }
  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 16px 16px 24px;
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
  /* the link to the source code: GitHub's mark beside the text, both scaling with the text size */
  .repo {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: inherit;
  }
  .repo svg {
    width: 1.2em;
    height: 1.2em;
    flex: none;
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
  /* the title and its GitHub mark, side by side; the mark is muted until hovered, so it doesn't compete with the title */
  .ttl {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .gh {
    color: var(--mute);
    border-radius: 4px;
  }
  .gh:hover {
    color: var(--accent);
  }
  .gh:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
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
    gap: 4px;
    margin-top: 6px;
  }
  .views button {
    text-align: left;
  }
  /* buttons in the button groups: the views, the gantry's Off / style row, and Show all and Reset */
  .views button,
  .btns button {
    padding: 0.3rem 0.5rem;
  }
  /* a full-width row, tall enough to tap on a phone, with its chevron pointing down when the switches are folded out */
  .fold {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: calc(44rem / 17);
    margin: 22px 0 8px;
  }
  /* the panel's two sections, View and Layers, are headed a little larger than the rest of its text, and bold */
  .top,
  .fold {
    font-size: calc(16rem / 17);
    font-weight: 700;
  }
  .fold :global(svg) {
    transition: transform 150ms;
  }
  .fold.open :global(svg) {
    transform: rotate(90deg);
  }
  .btns {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    margin-top: 10px;
  }
  /* the zoom footer: a hairline above it, the zoom pill filling the width, then the Fit and Center icon buttons */
  .foot {
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    border-top: 1px solid var(--line);
    background: var(--panel);
  }
  .step {
    flex: 1;
    display: flex;
    align-items: stretch;
    border: 1px solid var(--line);
    border-radius: 8px;
    overflow: hidden;
  }
  /* − and + inside the pill: no border of their own, a soft fill on hover; 30px tall plus the pill's border makes 32px */
  .step button {
    border: 0;
    border-radius: 0;
    padding: calc(6rem / 17) calc(8rem / 17);
    background: none;
  }
  .step button:hover:not(:disabled) {
    background: var(--bg);
  }
  .step button:focus-visible {
    outline-offset: -2px;
  }
  /* the zoom, between hairlines, in figures of even width so it doesn't jitter as it changes */
  .step output {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border-inline: 1px solid var(--line);
    font-size: calc(13rem / 17);
    font-variant-numeric: tabular-nums;
    color: var(--mute);
  }
  .ico {
    padding: calc(6rem / 17);
    border-radius: 8px;
  }
  /* zoom out can't go past Fit, Center has nothing to move at Fit, and Reset has nothing to do until a layer is changed */
  .btns button:disabled,
  .foot button:disabled {
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
      box-shadow: 2px 0 12px rgba(0, 0, 0, 0.3);
    }
    .body {
      padding-top: calc(env(safe-area-inset-top, 0px) + 16px);
      padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 24px);
    }
  }
</style>
