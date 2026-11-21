// Captions over the gantry animation, from captions.json at the top of the repo. Each one is tied to a step of the
// animation, not to a time, so it shows at the same moment whatever span the animation started on:
//   span: the span the move starts on (a walk's from span 41 or 50); left out, every span
//   step: the step's number, as in the address's hash (animationMark.js: 0 the fill, 1 to 28 the normal move, 29 B flies
//         across, 30 the short support carried back, 32 on the walk's steps)
//   at:   seconds after the step starts, in the steps' own time (as written, before SPEED divides it); default 0.
//         Captions play at CAPTION_SPEED (clock.js, 2x): the animation slows to it as a caption comes up, so a caption
//         that should show a second before a moment has `at` two seconds (as written) before it
//   parts: the caption's text, as a list: one after another, with the same arrow throughout
//   seconds: how long each screen shows instead of its reading time
// Captions follow the usual subtitle rules (as Netflix's and the BBC's guidelines have them): a part longer than a screen
// (two lines of LINE characters) is split into screens, at sentence ends where it can be, otherwise at the word break
// nearest the middle (a comma preferred), and each screen shows for its reading time at READ_CPS characters a second,
// between READ_MIN and READ_MAX.
//   point: a part of the gantry for an arrow to point at while it shows (captionArrow.js: support-a, support-b, support-c,
//          short-support, trolley, front-jacks, rear-jacks), or a guideway support by the spans either side ("12/13")
//   pause: true to hold the gantry for CAPTION_PAUSE as it shows, for news worth stopping for (every pause is that long)
// A caption's time goes by clock(), so it waits while the Pause button holds the gantry.

import CAPTIONS from "../../captions.json";
import { onStep } from "../lib/animationMark.js";
import { SPEED, clock, playClock, setCaptionSlow } from "./gantryAnimation/clock.js";

/** How long a caption with `pause` holds the gantry, in seconds (the same for every caption). */
export const CAPTION_PAUSE = 1.5;

/** A caption line's most characters, a screen's lines, the reading speed in characters a second, and the shortest and
 * longest a screen shows, in milliseconds. */
const LINE = 42,
  LINES = 2,
  READ_CPS = 17,
  READ_MIN = 1500,
  READ_MAX = 7000;

/** A part's text as screens of at most LINES lines of LINE characters: whole sentences where they fit, otherwise split. */
function screens(text) {
  const most = LINE * LINES,
    out = [];
  // sentence ends: a full stop, question or exclamation mark before a capital (so "Dec. 11" stays together)
  for (const sentence of text.trim().split(/(?<=[.!?])\s+(?=[A-Z])/)) {
    const last = out.length - 1;
    if (last >= 0 && out[last].length + 1 + sentence.length <= most) out[last] += " " + sentence;
    else out.push(...split(sentence, most));
  }
  return out;
}

/** A sentence too long for one screen, in as few even pieces as fit, each break at the space nearest its share of the
 * way (a comma just before it counts as nearer). */
function split(sentence, most) {
  const n = Math.ceil(sentence.length / most);
  if (n <= 1) return [sentence];
  const pieces = [];
  let rest = sentence;
  for (let k = n; k > 1; k--) {
    const target = rest.length / k;
    let best = -1,
      score = Infinity;
    for (let i = rest.indexOf(" "); i !== -1; i = rest.indexOf(" ", i + 1)) {
      if (i > most) break;
      const s = Math.abs(i - target) - (rest[i - 1] === "," ? LINE / 3 : 0);
      if (s < score) {
        score = s;
        best = i;
      }
    }
    if (best < 0) break;
    pieces.push(rest.slice(0, best));
    rest = rest.slice(best + 1);
  }
  return [...pieces, rest];
}

/** How long a screen of text shows, in milliseconds: its reading time, or `seconds` when the caption gives it. */
const readTime = (text, seconds) =>
  seconds ? seconds * 1000 : Math.min(READ_MAX, Math.max(READ_MIN, (text.length / READ_CPS) * 1000));

/** Captions waiting for their time (`due` on playClock(), the steps' own time), and the parts of the one showing, each
 * with its own time (`from` to `until` on clock(): read at the reader's pace). */
let pending = [],
  showing = [],
  // the timer that slows the animation to CAPTION_SPEED the moment the next caption is due
  timer = null;

/** Slows the animation to CAPTION_SPEED as soon as a caption is due, so it doesn't play on past its moment before the next
 * look (captionNow(), every 250 ms); then has the next one watched. */
function watch() {
  clearTimeout(timer);
  if (!pending.length) return;
  const left = Math.min(...pending.map((p) => p.due)) - playClock();
  if (left <= 0) setCaptionSlow(true);
  // at the speed now: a change of speed meanwhile only makes it look again sooner or later
  else timer = setTimeout(watch, Number.isFinite(SPEED) ? left / SPEED : 0);
}

// a step that starts at speed (not one played with no time, setInstant) lines up its captions
onStep((span, step) => {
  if (!Number.isFinite(SPEED)) return;
  for (const c of CAPTIONS)
    if (c.step === step && (c.span == null || c.span === span))
      pending.push({ c, due: playClock() + (c.at ?? 0) * 1000 });
  watch();
});

/**
 * The caption to show now (MapView asks every 250 ms while the gantry plays).
 * @returns {{ text: string|null, point: string|null, pause: boolean }} point: the part the arrow points at; pause: a caption with `pause` has just come up, so MapView holds the
 * gantry for CAPTION_PAUSE (true once only).
 */
export function captionNow() {
  const now = clock(),
    played = playClock();
  let pause = false;
  for (const p of pending.filter((p) => p.due <= played)) {
    // a caption that comes up takes over from one still showing; its parts follow one another, from now
    let from = now;
    showing = p.c.parts.flatMap(screens).map((text) => {
      const until = from + readTime(text, p.c.seconds),
        part = { text, point: p.c.point ?? null, from, until };
      from = until;
      return part;
    });
    pause ||= !!p.c.pause;
  }
  pending = pending.filter((p) => p.due > played);
  showing = showing.filter((s) => now < s.until);
  const part = showing.find((s) => s.from <= now);
  // CAPTION_SPEED while a caption is up or due; back to the cycle's speed once it has gone
  setCaptionSlow(!!part || pending.some((p) => p.due <= playClock()));
  watch();
  return { text: part?.text ?? null, point: part?.point ?? null, pause };
}

/** Drops every caption, waiting or showing (the run is over or stopped). */
export function clearCaptions() {
  pending = [];
  showing = [];
  clearTimeout(timer);
  setCaptionSlow(false);
}
