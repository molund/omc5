// The Clayton Clipper status from status.yaml: when it was last updated, the span the gantry is on, whether that span is
// complete, and the newest of its time-stamped notes. The file is flat `key: value` lines plus the `notes:` list of
// `  - time: "text"` lines, so a small reader does instead of a YAML library.
import text from "../../status.yaml?raw";

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
      notes.push({ time: new Date(n[1]), text: unquote(n[2]) });
      return;
    }
    const m = line.match(/^([A-Za-z_]+):\s*(.*?)\s*$/);
    if (m) out[m[1]] = unquote(m[2]);
  });
  // the newest note by its time stamp, whatever order the list is in
  const latest = notes
    .filter((n) => !isNaN(n.time))
    .sort((a, b) => b.time - a.time)[0];
  return {
    updated: out.updated ? new Date(out.updated) : null,
    span: out.span ? +out.span : null,
    complete: out.complete === "true",
    note: latest ? latest.text : "",
  };
}

export const status = parse(text);

// "6:45 a.m. on Oct 29, 2026", Pacific time, rounded to the nearest quarter hour
export function asOf(date) {
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
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  const period = parts.dayPeriod.toLowerCase().startsWith("a")
    ? "a.m."
    : "p.m.";
  return `${parts.hour}:${parts.minute} ${period} on ${parts.month} ${parts.day}, ${parts.year}`;
}
