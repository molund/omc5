<script>
  import LayerPanel from "./LayerPanel.svelte";
  import PanelIcon from "./PanelIcon.svelte";
  import Plan from "./Plan.svelte";
  import { layerCss, FULL_VIEW_CSS } from "./lib/layers.js";
  import { fade } from "svelte/transition";
  import { layers, ui, PHONE } from "./lib/state.svelte.js";

  // the layer rules wait until Plan has tagged the drawing, which needs it laid out as plan.svg draws it on its own
  const css = $derived(
    ui.ready
      ? layerCss(layers) + (ui.view === "view_default" ? FULL_VIEW_CSS : "")
      : "",
  );
  // turning a tablet or resizing the window across the phone width: the panel opens beside the plan, or the menu closes
  $effect(() => {
    const changed = (e) => {
      ui.phone = e.matches;
      ui.collapsed = e.matches;
    };
    PHONE.addEventListener("change", changed);
    return () => PHONE.removeEventListener("change", changed);
  });
  const closeMenu = () => (ui.collapsed = true);
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape" && ui.phone && !ui.collapsed) closeMenu();
  }}
/>

<svelte:head>
  {@html `<style>${css}</style>`}
</svelte:head>

<div class="app" class:collapsed={ui.collapsed}>
  {#if !ui.collapsed}
    <LayerPanel />
  {/if}
  <Plan />
</div>
<!-- on a phone the open menu dims the plan; tapping the plan closes it -->
{#if ui.phone && !ui.collapsed}
  <div
    class="backdrop"
    role="presentation"
    transition:fade={{ duration: 150 }}
    onclick={closeMenu}
  ></div>
{/if}
{#if ui.collapsed}
  <button
    class="expand"
    title={ui.phone ? "Open the menu" : "Show the layer panel"}
    aria-label={ui.phone ? "Open the menu" : "Show the layer panel"}
    aria-expanded="false"
    onclick={() => (ui.collapsed = false)}
    ><PanelIcon kind={ui.phone ? "menu" : "panel"} /></button
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
  /* on a phone the panel slides in over the plan, so the plan always has the whole screen */
  @media (max-width: 760px) {
    .app {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr;
    }
  }
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 25;
    background: rgba(0, 0, 0, 0.35);
  }
  .expand {
    padding: calc(6rem / 17);
    position: fixed;
    top: calc(env(safe-area-inset-top, 0px) + 10px);
    left: 10px;
    z-index: 20;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  }
</style>
