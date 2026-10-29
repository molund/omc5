<script>
  import LayerPanel from "./LayerPanel.svelte";
  import Plan from "./Plan.svelte";
  import { layerCss, FULL_VIEW_CSS } from "./lib/layers.js";
  import { layers, ui } from "./lib/state.svelte.js";

  // the layer rules wait until Plan has tagged the drawing, which needs it laid out as plan.svg draws it on its own
  const css = $derived(
    ui.ready
      ? layerCss(layers) + (ui.view === "view_default" ? FULL_VIEW_CSS : "")
      : "",
  );
</script>

<svelte:head>
  {@html `<style>${css}</style>`}
</svelte:head>

<div class="app" class:collapsed={ui.collapsed}>
  {#if !ui.collapsed}
    <LayerPanel />
  {/if}
  <Plan />
</div>
{#if ui.collapsed}
  <button
    class="expand"
    aria-label="Show the layer panel"
    onclick={() => (ui.collapsed = false)}>Layers</button
  >
{/if}

<style>
  .app {
    display: grid;
    grid-template-columns: 260px 1fr;
    height: 100%;
  }
  .app.collapsed {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;
  }
  @media (max-width: 760px) {
    .app:not(.collapsed) {
      grid-template-columns: 1fr;
      grid-template-rows: auto 1fr;
    }
  }
  .expand {
    position: fixed;
    top: calc(env(safe-area-inset-top, 0px) + 10px);
    left: 10px;
    z-index: 20;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  }
</style>
