<script>
  import { onMount } from "svelte";
  import LayerPanel from "./LayerPanel.svelte";
  import Icon from "./Icon.svelte";
  import MapView from "./MapView.svelte";
  import { layerCss, FULL_AERIAL_CSS } from "./lib/layerSwitches.js";
  import { fade } from "svelte/transition";
  import { layers, ui, PHONE } from "./lib/appState.svelte.js";

  // if coming from Trackside or About on mobile, close the card so the map is visible
  onMount(() => {
    if (typeof location === "undefined" || !PHONE.matches) return;
    if (new URLSearchParams(location.search).has("hidecardopen")) {
      ui.cardHidden = true;
      window.history.replaceState(null, "", location.pathname + location.hash);
    }
  });

  // the layer rules wait until MapView has tagged the drawing, which needs it laid out as map.svg draws it on its own
  const css = $derived(
    ui.ready
      ? layerCss(layers) + (ui.view === "fullAerial" ? FULL_AERIAL_CSS : "")
      : "",
  );
  // turning a tablet or resizing the window across the phone width: the panel opens beside the map, or the menu closes
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

<!-- on a phone the panel slides in over the map, so the map always has the whole screen -->
<div
  class={[
    "grid h-full",
    ui.collapsed
      ? "grid-cols-[1fr] grid-rows-[1fr]"
      : "grid-cols-[260px_1fr] [@media(max-width:760px)]:grid-cols-[1fr] [@media(max-width:760px)]:grid-rows-[1fr]",
  ]}
>
  {#if !ui.collapsed}
    <LayerPanel />
  {/if}
  <MapView />
</div>
<!-- on a phone the open menu dims the map; tapping the map closes it -->
{#if ui.phone && !ui.collapsed}
  <div
    class="fixed inset-0 z-25 bg-[rgba(0,0,0,0.35)]"
    role="presentation"
    transition:fade={{ duration: 150 }}
    onclick={closeMenu}
  ></div>
{/if}
{#if ui.collapsed}
  <button
    class="fixed top-[calc(env(safe-area-inset-top,0px)_+_10px)] left-[10px] z-20 p-[calc(6rem/17)] shadow-[0_1px_4px_rgba(0,0,0,0.3)]"
    title={ui.phone ? "Open the menu" : "Show the layer panel"}
    aria-label={ui.phone ? "Open the menu" : "Show the layer panel"}
    aria-expanded="false"
    onclick={() => (ui.collapsed = false)}
    ><Icon kind={ui.phone ? "menu" : "panel"} /></button
  >
{/if}
