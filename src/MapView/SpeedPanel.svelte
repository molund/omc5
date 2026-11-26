<script>
  /**
   * The speed panel, while the gantry animates: a narrow, see-through rounded panel that slides in from the right edge,
   * halfway down, clear of the buttons at the top and the Esri credits at the bottom, with seven speeds (×5, ×4, ×3, ×2, ×1.5, Normal, ×0.5) that multiply the animation's own (clock.js). A swipe in from the edge
   * pulls it out under the finger, as does dragging the grip; a tap on the grip opens or closes it, and a swipe back, a
   * tap on the map or picking a speed closes it. The choice holds while the animation plays; the panel goes when it stops,
   * and the speed goes back to Normal with it.
   */
  import { onDestroy } from "svelte";
  import { setMultiplier, speedMultiplier } from "./gantryAnimation/clock.js";

  onDestroy(() => setMultiplier(1));

  const SPEEDS = [
    { m: 5, label: "×5" },
    { m: 4, label: "×4" },
    { m: 3, label: "×3" },
    { m: 2, label: "×2" },
    { m: 1.5, label: "×1.5" },
    { m: 1, label: "Normal" },
    { m: 0.5, label: "×0.5" },
  ];
  /** How near the right edge a swipe has to start, how far a finger moves before it counts as a swipe, and the gap
   * between the open panel and the map's right edge (as in the style below), in pixels. */
  const EDGE = 28,
    SLOP = 8,
    GAP = 8;

  let open = $state(false),
    chosen = $state(speedMultiplier()),
    // while a finger drags the panel: how far it is pushed off to the right, in pixels (0 all the way out, `away` all the
    // way off the map)
    offset = $state(null),
    width = $state(0),
    panel;
  const away = $derived(width + GAP);

  function choose(m) {
    chosen = m;
    setMultiplier(m);
    // a moment to see the choice light up, then out of the way
    setTimeout(() => (open = false), 250);
  }

  // a touch that starts on the panel or the grip, or (closed) at the map's right edge: once it moves sideways more than it
  // moves up or down, it drags the panel and the map doesn't pan; a tap stays a tap
  let touch = null;
  function touchstart(e) {
    if (e.touches.length !== 1 || !panel) return;
    const t = e.touches[0],
      onPanel = panel.contains(e.target),
      right = panel.parentElement.getBoundingClientRect().right;
    if (!onPanel && (open || t.clientX < right - EDGE)) return;
    touch = { x: t.clientX, y: t.clientY, from: open ? 0 : away, dragging: false };
  }
  function touchmove(e) {
    if (!touch) return;
    const t = e.touches[0],
      dx = t.clientX - touch.x,
      dy = t.clientY - touch.y;
    if (!touch.dragging) {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
      // up or down first: leave it to the map
      if (Math.abs(dy) > Math.abs(dx)) return (touch = null);
      touch.dragging = true;
    }
    e.preventDefault();
    e.stopPropagation();
    offset = Math.min(away, Math.max(0, touch.from + dx));
  }
  function touchend() {
    if (touch?.dragging) open = offset < away / 2;
    touch = null;
    offset = null;
  }

  // a tap or click on the map closes it
  function outside(e) {
    if (open && panel && !panel.contains(e.target)) open = false;
  }

  // on the window, in the capture phase, so a swipe from the edge reaches here before the map can pan with it
  $effect(() => {
    const opts = { capture: true, passive: false };
    window.addEventListener("touchstart", touchstart, opts);
    window.addEventListener("touchmove", touchmove, opts);
    window.addEventListener("touchend", touchend, true);
    window.addEventListener("touchcancel", touchend, true);
    return () => {
      window.removeEventListener("touchstart", touchstart, opts);
      window.removeEventListener("touchmove", touchmove, opts);
      window.removeEventListener("touchend", touchend, true);
      window.removeEventListener("touchcancel", touchend, true);
    };
  });
</script>

<svelte:window onpointerdown={outside} />

<div
  class={["speed-panel", offset != null && "dragging"]}
  style:transform={offset != null
    ? `translateX(${offset}px)`
    : open
      ? "none"
      : `translateX(calc(100% + ${GAP}px + env(safe-area-inset-right, 0px)))`}
  bind:this={panel}
  bind:clientWidth={width}
>
  <!-- the grip rides on the panel's inner edge, so it sits on the map's right edge while the panel is away -->
  <button
    class="grip absolute top-1/2 right-full -translate-y-1/2"
    title="Animation speed"
    aria-label="Animation speed"
    aria-expanded={open}
    onclick={() => (open = !open)}><span class="grip-bar"></span></button
  >
  <div class="speed-list" inert={!open}>
    <div class="speed-label">Speed</div>
    {#each SPEEDS as s (s.m)}
      <button class={["speed", s.m === chosen && "chosen"]} aria-pressed={s.m === chosen} onclick={() => choose(s.m)}
        >{s.label}</button
      >
    {/each}
  </div>
</div>

<style>
  @reference "../app.css";

  /* a rounded box near the map's right edge, halfway down, over the map and the captions; at most as tall as leaves 64px
     above and below it, clear of the buttons at the top and the Esri credits at the bottom (its speeds scroll if they
     don't fit). A see-through dark shade with a slight blur, so the map shows through. The panel and its buttons are in
     px, not rem, so they keep their size whatever the iPhone's Text Size setting */
  .speed-panel {
    @apply absolute z-20 flex flex-col backdrop-blur-xs;
    top: 50%;
    right: calc(8px + env(safe-area-inset-right, 0px));
    translate: 0 -50%;
    width: 76px;
    max-height: calc(100% - 128px);
    padding: 10px;
    border-radius: 14px;
    background: color-mix(in srgb, var(--map-shade) 40%, transparent);
    transition: transform 0.25s ease-out;
  }
  /* under the finger, it follows at once */
  .speed-panel.dragging {
    transition: none;
  }
  @media (prefers-reduced-motion: reduce) {
    .speed-panel {
      transition: none;
    }
  }

  /* the grip's touch area: wider and taller than the bar it shows */
  .grip {
    @apply flex items-center justify-center rounded-none border-0 bg-transparent p-0;
    width: 24px;
    height: 80px;
  }
  .grip:hover {
    @apply border-0;
  }
  /* the bar itself: a see-through white, with a lighter edge and a faint shadow so it shows on pale ground */
  .grip-bar {
    @apply block rounded-full border border-(--on-map)/60 bg-(--on-map)/40;
    width: 5px;
    height: 56px;
    box-shadow: 0 0 2px color-mix(in srgb, var(--map-shade) 35%, transparent);
  }

  /* the speeds scroll here (not the panel itself, which would cut the grip off) */
  .speed-list {
    @apply flex min-h-0 flex-col overflow-y-auto;
    gap: 8px;
  }

  .speed-label {
    @apply text-center font-bold tracking-wider text-(--on-map)/80 uppercase;
    margin-bottom: 2px;
    font-size: 11px;
  }

  /* a speed: white-outlined, see-through; the chosen one solid white */
  .speed {
    @apply shrink-0 border-(--on-map)/45 bg-(--on-map)/8 p-0 font-bold text-(--on-map);
    height: 40px;
    border-radius: 8px;
    font-size: 12px;
  }
  /* only with a mouse: on a phone, the outline would stay on the last speed tapped */
  @media (hover: hover) {
    .speed:hover {
      @apply border-(--on-map);
    }
  }
  .speed.chosen {
    @apply border-transparent bg-(--on-map)/92 text-(--on-map-ink);
  }
</style>
