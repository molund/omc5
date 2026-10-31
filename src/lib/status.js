// The Clayton Clipper status from status.yaml: when it was last updated, the span the gantry is on, whether that span is
// complete, and the newest of its time-stamped notes. The file is flat `key: value` lines plus the `notes:` list of
// `  - time: "text"` lines, each optionally followed by a photo, indented under it:
//     photo:
//       file: span-36.jpg
//       caption: "Its own caption, separate from the note"
// and optionally minor updates, also indented under it (no photo, no thread or entry of their own):
//     minor:
//       - time: "text"
// so a small reader does instead of a YAML library.
import text from "../../status.yaml?raw";

// where update photos live (public/images/sorry-im-a-shitty-photographer/), as a URL on the site
const PHOTOS = `${import.meta.env.BASE_URL}images/sorry-im-a-shitty-photographer/`;

function unquote(v) {
  if (/^".*"$/.test(v)) return JSON.parse(v);
  if (/^'.*'$/.test(v)) return v.slice(1, -1).replace(/''/g, "'");
  return v;
}

function parse(src) {
  const out = {},
    notes = [];
  src.split("\n").forEach((line) => {
    // a note: "  - time: text", two spaces in
    const n = line.match(/^ {2}-\s+(\S+):\s+(.*?)\s*$/);
    if (n) {
      notes.push({
        time: new Date(n[1]),
        text: unquote(n[2]),
        photo: null,
        minor: [],
      });
      return;
    }
    const last = notes[notes.length - 1];
    // a minor update under the note: "      - time: text", further in, after a "    minor:" line
    const mi = line.match(/^ {3,}-\s+(\S+):\s+(.*?)\s*$/);
    if (mi) {
      if (last)
        last.minor.push({ time: new Date(mi[1]), text: unquote(mi[2]) });
      return;
    }
    if (/^\s+minor:\s*$/.test(line)) return;
    // a photo belongs to the note above it: `photo:`, then its `file:` and `caption:` indented under it
    if (/^\s+photo:\s*$/.test(line)) {
      if (last) last.photo = { src: null, caption: "" };
      return;
    }
    const pf = line.match(/^\s+(file|caption):\s*(.*?)\s*$/);
    if (pf) {
      if (last && last.photo) {
        if (pf[1] === "file") last.photo.src = PHOTOS + unquote(pf[2]);
        else last.photo.caption = unquote(pf[2]);
      }
      return;
    }
    const m = line.match(/^([A-Za-z_]+):\s*(.*?)\s*$/);
    if (m) out[m[1]] = unquote(m[2]);
  });
  // newest first by time stamp, whatever order the list is in
  // a photo without a file doesn't count
  notes.forEach((n) => n.photo && !n.photo.src && (n.photo = null));
  // minor updates newest first, those with text
  notes.forEach(
    (n) =>
      (n.minor = n.minor
        .filter((m) => m.text && !isNaN(m.time))
        .sort((a, b) => b.time - a.time)),
  );
  const sorted = notes
    .filter((n) => !isNaN(n.time))
    .sort((a, b) => b.time - a.time);
  return {
    updated: out.updated ? new Date(out.updated) : null,
    span: out.span ? +out.span : null,
    complete: out.complete === "true",
    note: sorted.length ? sorted[0].text : "",
    // the newest note's photo, { src, caption }, or null
    photo: sorted.length ? sorted[0].photo : null,
    // the newest note's minor updates, [{ time, text }], newest first
    minor: sorted.length ? sorted[0].minor : [],
    // every note with text, newest first, for the update history (each with its photo or null, and its minor updates)
    history: sorted.filter((n) => n.text),
  };
}

export const status = parse(text);

// the calendar day of a time, in the site's time zone, as "2026-10-29"
const dayOf = (t) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Whitehorse" }).format(
    t,
  );

// "6:45 a.m. on Oct 29, 2026", Pacific time, rounded to the nearest quarter hour; with relative, a time today or yesterday
// reads "6:45 a.m. today" or "6:45 a.m. yesterday" instead, and the day before yesterday "6:45 a.m. on Tuesday"
export function asOf(date, relative = false) {
  if (!date || isNaN(date)) return "";
  const q = 15 * 60 * 1000,
    d = new Date(Math.round(date.getTime() / q) * q);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Whitehorse",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      month: "short",
      day: "numeric",
      year: "numeric",
      weekday: "long",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  const period = parts.dayPeriod.toLowerCase().startsWith("a")
    ? "a.m."
    : "p.m.";
  const time = `${parts.hour}:${parts.minute} ${period}`;
  if (relative) {
    // Yukon time has no daylight saving changes, so a day back is always 24 hours
    const now = Date.now(),
      day = 24 * 60 * 60 * 1000;
    if (dayOf(d) === dayOf(now)) return `${time} today`;
    if (dayOf(d) === dayOf(now - day)) return `${time} yesterday`;
    if (dayOf(d) === dayOf(now - 2 * day)) return `${time} on ${parts.weekday}`;
  }
  return `${time} on ${parts.month} ${parts.day}, ${parts.year}`;
}

// a minor update's time: just "11:45 a.m." on the same day as its note, otherwise in full
export function minorTime(t, note) {
  const full = asOf(t);
  return dayOf(t) === dayOf(note) ? full.replace(/ on .*$/, "") : full;
}
