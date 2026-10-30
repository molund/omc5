// The Clayton Clipper status from status.yaml: when it was last updated, the span the gantry is on, whether that span is
// complete, and an optional note. The file is flat `key: value` lines, so a small reader does instead of a YAML library.
import text from "../../status.yaml?raw";

function parse(src) {
  const out = {};
  src.split("\n").forEach((line) => {
    const m = line.match(/^([A-Za-z_]+):\s*(.*?)\s*$/);
    if (!m) return;
    let v = m[2];
    if (/^".*"$/.test(v)) v = JSON.parse(v);
    else if (/^'.*'$/.test(v)) v = v.slice(1, -1).replace(/''/g, "'");
    out[m[1]] = v;
  });
  return {
    updated: out.updated ? new Date(out.updated) : null,
    span: out.span ? +out.span : null,
    complete: out.complete === "true",
    note: out.note || "",
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
      timeZone: "America/Vancouver",
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
