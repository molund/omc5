<script>
  // The past updates page: every status note, newest first, each with an id from its time stamp (e.g. #2026-10-30T20-45) so
  // a single update can be linked to
  import { status, asOf } from "./lib/status.js";

  const MAP = import.meta.env.BASE_URL;
  const anchor = (t) =>
    t
      .toISOString()
      .slice(0, 16)
      .replace(/:/g, "-");
</script>

<main class="page">
  <a class="back" href={MAP}>← Back to the map</a>
  <h1>Past updates</h1>
  <ol class="list">
    {#each status.history as n}
      <li id={anchor(n.time)}>
        <div class="asof">{asOf(n.time)}</div>
        <div class="note">{n.text}</div>
        {#if n.photo}<a class="photo" href={n.photo}
            ><img src={n.photo} alt="Photo for this update" loading="lazy" /></a
          >{/if}
      </li>
    {/each}
  </ol>
</main>

<style>
  /* a plain reading page, a comfortable width, all sizes in rem so they follow the iPhone's Text Size setting */
  .page {
    max-width: calc(640rem / 17);
    margin: 0 auto;
    padding: calc(16px + env(safe-area-inset-top, 0px)) 16px 32px;
    font-size: calc(15rem / 17);
  }
  .back {
    color: var(--ink);
    font-size: calc(13rem / 17);
  }
  h1 {
    margin: 12px 0 8px;
    font-size: calc(22rem / 17);
  }
  .list {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .list li {
    padding: 12px 0;
    border-bottom: 1px solid var(--line);
  }
  .list li:last-child {
    border-bottom: 0;
  }
  .asof {
    font-size: calc(12rem / 17);
    color: var(--mute);
  }
  .note {
    margin-top: 4px;
  }
  /* an update's photo, the page's width, opening full size when tapped */
  .photo {
    display: block;
    margin-top: 8px;
  }
  .photo img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 6px;
  }
</style>
