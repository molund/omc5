// Comments on updates: one GitHub Discussion per update, through giscus. Shared by the progress card and the Trackside
// page: each update's page anchor and thread title, and the comment and reaction counts of every thread.

// the site's public address, for links that leave it: the comment threads' bodies and the Open Graph tags
export const SITE = "https://molund.github.io/omc5/";

// an update's id on the Trackside page, from its time stamp in UTC, e.g. "2026-10-31T16-30"
export const anchor = (t) => t.toISOString().slice(0, 16).replace(/:/g, "-");

// an update's thread title, its Yukon time, e.g. "Update 2026-10-31 09:30" (the title must never change, or the thread is
// lost; .github/scripts/sync_discussions.py makes the same titles)
export const term = (t) =>
  "Update " +
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Whitehorse",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(t)
    .replace(",", "");

const EMOJI = {
  "+1": "👍",
  "-1": "👎",
  laugh: "😄",
  hooray: "🎉",
  confused: "😕",
  heart: "❤️",
  rocket: "🚀",
  eyes: "👀",
};

// Comment and reaction counts for every thread, from GitHub's public API (no login; 60 requests an hour per visitor), by
// thread title: { comments, reactions: [[emoji, count], ...] }. One request only: GitHub's first 100 threads (the deploy
// workflow fails once the category reaches 100, as a reminder to rethink this). Empty if GitHub can't be reached.
export function fetchCounts() {
  return fetch(
    "https://api.github.com/repos/molund/omc5/discussions?per_page=100",
    { headers: { Accept: "application/vnd.github+json" } },
  )
    .then((r) => (r.ok ? r.json() : []))
    .then((list) => {
      const out = {};
      list.forEach((d) => {
        out[d.title] = {
          comments: d.comments,
          reactions: Object.keys(EMOJI)
            .filter((k) => d.reactions?.[k] > 0)
            .map((k) => [EMOJI[k], d.reactions[k]]),
        };
      });
      return out;
    })
    .catch(() => ({}));
}
