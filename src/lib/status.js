// The Clayton Clipper status from status.yaml: when it was last updated, the span the gantry is on, whether that span is
// complete, and the newest of its time-stamped notes. The file is flat `key: value` lines plus the `notes:` list of
// `  - time: "text"` lines, each optionally followed by a title, for its page's <title> and Open Graph title on Trackside
// (not shown on the page itself):
//     title: "Span 36 is complete"
// a photo, indented under it:
//     photo:
//       file: span-36.jpg
//       caption: "Its own caption, separate from the note"
// optionally more paragraphs and photos, indented under it (shown after the note and its photo on the Trackside page and
// in its thread; the card shows only the note, with a link to the rest):
//     more:
//       - "A second paragraph"
//       - photo:
//           file: span-36-close-up.jpg
//           caption: "Its caption"
// and optionally follow-ups, also indented under it (no photo, no thread or entry of their own):
//     follow-up:
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
  // the list a "      - …" line belongs to: "more" after a "    more:" line, otherwise follow-ups
  let list = null,
    // the photo a `file:` or `caption:` line belongs to
    photo = null;
  src.split("\n").forEach((line) => {
    // a note: "  - time: text", two spaces in
    const n = line.match(/^ {2}-\s+(\S+):\s+(.*?)\s*$/);
    if (n) {
      notes.push({
        time: new Date(n[1]),
        text: unquote(n[2]),
        photo: null,
        more: [],
        title: "",
        followUps: [],
      });
      list = null;
      photo = null;
      return;
    }
    const last = notes[notes.length - 1];
    // under "    more:", a photo, "      - photo:" with its file and caption under it, or a paragraph, "      - text"
    if (list === "more" && /^ {3,}-\s+photo:\s*$/.test(line)) {
      photo = { src: null, caption: "" };
      if (last) last.more.push({ photo });
      return;
    }
    const mo = list === "more" && line.match(/^ {3,}-\s+(.*?)\s*$/);
    if (mo) {
      if (last && unquote(mo[1])) last.more.push({ text: unquote(mo[1]) });
      return;
    }
    if (/^\s+more:\s*$/.test(line)) {
      list = "more";
      return;
    }
    // a follow-up under the note: "      - time: text", further in, after a "    follow-up:" line
    const mi = line.match(/^ {3,}-\s+(\S+):\s+(.*?)\s*$/);
    if (mi) {
      if (last)
        last.followUps.push({ time: new Date(mi[1]), text: unquote(mi[2]) });
      return;
    }
    if (/^\s+follow-up:\s*$/.test(line)) {
      list = "followUps";
      return;
    }
    // the note's title, four spaces in
    const ti = line.match(/^ {4}title:\s*(.*?)\s*$/);
    if (ti) {
      list = null;
      photo = null;
      if (last) last.title = unquote(ti[1]);
      return;
    }
    // a photo belongs to the note above it: `photo:`, then its `file:` and `caption:` indented under it
    if (/^\s+photo:\s*$/.test(line)) {
      list = null;
      if (last) photo = last.photo = { src: null, caption: "" };
      return;
    }
    const pf = line.match(/^\s+(file|caption):\s*(.*?)\s*$/);
    if (pf) {
      if (photo) {
        if (pf[1] === "file") photo.src = PHOTOS + unquote(pf[2]);
        else photo.caption = unquote(pf[2]);
      }
      return;
    }
    const m = line.match(/^([A-Za-z_]+):\s*(.*?)\s*$/);
    if (m) out[m[1]] = unquote(m[2]);
  });
  // newest first by time stamp, whatever order the list is in
  // a photo without a file doesn't count
  notes.forEach((n) => {
    if (n.photo && !n.photo.src) n.photo = null;
    n.more = n.more.filter((m) => m.text || m.photo?.src);
  });
  // follow-ups newest first, those with text
  notes.forEach(
    (n) =>
      (n.followUps = n.followUps
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
    // the newest note's further paragraphs and photos, [{ text } or { photo: { src, caption } }], or []
    more: sorted.length ? sorted[0].more : [],
    // the newest note's follow-ups, [{ time, text }], newest first
    followUps: sorted.length ? sorted[0].followUps : [],
    // every note with text, newest first, for Trackside (each with its photo or null, and its follow-ups)
    history: sorted.filter((n) => n.text),
  };
}

export const status = parse(text);

// the calendar day of a time, in the site's time zone, as "2026-10-29". The site's time zone is BC time, UTC−7 all
// year: America/Dawson_Creek, which has had no daylight saving time since 1972
const dayOf = (t) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Dawson_Creek" }).format(
    t,
  );

// "6:45 a.m. on Oct 29, 2026", BC time, rounded to the nearest quarter hour; with relative, a time today or yesterday
// reads "6:45 a.m. today" or "6:45 a.m. yesterday" instead, and the day before yesterday "6:45 a.m. on Tuesday"
export function asOf(date, relative = false) {
  if (!date || isNaN(date)) return "";
  const q = 15 * 60 * 1000,
    d = new Date(Math.round(date.getTime() / q) * q);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Dawson_Creek",
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
    // BC time has no daylight saving changes, so a day back is always 24 hours
    const now = Date.now(),
      day = 24 * 60 * 60 * 1000;
    if (dayOf(d) === dayOf(now)) return `${time} today`;
    if (dayOf(d) === dayOf(now - day)) return `${time} yesterday`;
    if (dayOf(d) === dayOf(now - 2 * day)) return `${time} on ${parts.weekday}`;
  }
  return `${time} on ${parts.month} ${parts.day}, ${parts.year}`;
}

// a follow-up's time: just "11:45 a.m." on the same day as its note, otherwise in full
export function followUpTime(t, note) {
  const full = asOf(t);
  return dayOf(t) === dayOf(note) ? full.replace(/ on .*$/, "") : full;
}
