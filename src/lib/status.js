// The Clayton Clipper status from status.yaml: when it was last updated, the span the gantry is on, whether that span is
// complete, and the newest of its time-stamped notes. The file is flat `key: value` lines plus the `notes:` list of
// `  - time: "text"` lines, each optionally followed by a `    photo: file.jpg` line, so a small reader does instead of a
// YAML library.
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
    const n = line.match(/^\s+-\s+(\S+):\s+(.*?)\s*$/);
    if (n) {
      notes.push({ time: new Date(n[1]), text: unquote(n[2]), photo: null });
      return;
    }
    // a photo belongs to the note on the line above it
    const ph = line.match(/^\s+photo:\s*(.*?)\s*$/);
    if (ph) {
      if (notes.length && ph[1])
        notes[notes.length - 1].photo = PHOTOS + unquote(ph[1]);
      return;
    }
    const m = line.match(/^([A-Za-z_]+):\s*(.*?)\s*$/);
    if (m) out[m[1]] = unquote(m[2]);
  });
  // newest first by time stamp, whatever order the list is in
  const sorted = notes
    .filter((n) => !isNaN(n.time))
    .sort((a, b) => b.time - a.time);
  return {
    updated: out.updated ? new Date(out.updated) : null,
    span: out.span ? +out.span : null,
    complete: out.complete === "true",
    note: sorted.length ? sorted[0].text : "",
    // the newest note's photo URL, or null
    photo: sorted.length ? sorted[0].photo : null,
    // every note with text, newest first, for the update history (each with its photo URL or null)
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
