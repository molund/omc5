<script>
  import { PROGRESS_PINK } from "./lib/layers.js";
  import { layers, ui } from "./lib/state.svelte.js";
  import { status, asOf } from "./lib/status.js";

  const when = asOf(status.updated);
</script>

{#if layers.progress && ui.gantry}
  {@const { span, total } = ui.gantry}
  <div class="card">
    <div class="title">Clayton Clipper</div>
    <div class="figure"><b>{span}</b> / {total} spans</div>
    <div
      class="track"
      role="progressbar"
      aria-label="Clayton Clipper progress"
      aria-valuemin="0"
      aria-valuemax={total}
      aria-valuenow={span}
    >
      <div
        class="fill"
        style:width="{(span / total) * 100}%"
        style:background={PROGRESS_PINK}
      ></div>
    </div>
    {#if when}<div class="asof">As of {when}</div>{/if}
    {#if status.note}<div class="note">{status.note}</div>{/if}
  </div>
{/if}

<style>
  .card {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 240px;
    max-width: calc(100% - 24px);
    padding: 12px 14px 14px;
    background: var(--panel);
    color: var(--ink);
    border: 1px solid var(--line);
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
    z-index: 5;
  }
  .title {
    font-size: 13px;
    font-weight: 600;
    color: var(--mute);
  }
  .figure {
    margin: 2px 0 8px;
    font-size: 15px;
    color: var(--mute);
  }
  .figure b {
    font-size: 28px;
    color: var(--ink);
  }
  .track {
    height: 10px;
    border-radius: 5px;
    background: var(--line);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    border-radius: 5px;
  }
  .asof {
    margin-top: 8px;
    font-size: 12px;
    color: var(--mute);
  }
  .note {
    margin-top: 4px;
    font-size: 13px;
  }
</style>
