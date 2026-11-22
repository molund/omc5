// Captions over the gantry animation, from captions.json at the top of the repo. Each one is tied to a step of the
// animation, not to a time, so it shows at the same moment whatever span the animation started on:
//   span: the span the move starts on (a walk's from span 41 or 50); left out, every span
//   step: the step's number, as in the address's hash (animationMark.js: 0 the fill, 1 to 28 the normal move, 29 B flies
//         across, 30 the short support carried back, 32 on the walk's steps)
//   at:   seconds after the step starts, in the steps' own time (as written, before SPEED divides it); default 0.
//         Captions play at CAPTION_SPEED (clock.js, 2x): the animation slows to it as a caption comes up, so a caption
//         that should show a second before a moment has `at` two seconds (as written) before it
//   parts: the caption's text, as a list: one after another, with the same arrow throughout
//   seconds: how long each part shows instead of its reading time
// Each part shows whole, as one block (the parts are where a caption breaks), for its reading time at READ_CPS characters a
// second, READ_MIN at the least.
//   point: a part of the gantry for an arrow to point at while it shows (captionArrow.js: support-a, support-b, support-c,
//          short-support, trolley, front-jacks, rear-jacks), or a guideway support by the spans either side ("12/13")
//   layer: a layer switch's key (layerSwitches.js, e.g. "ave72") to turn on while the caption shows; it goes back as it was
//          after
//   pause: true to hold the gantry for CAPTION_PAUSE as it shows, for news worth stopping for (every pause is that long)
// A caption's time goes by clock(), so it waits while the Pause button holds the gantry.
// An opening caption (one due at the run's first step at speed, `at` 1 or less) comes up over a still map instead: the
// gantry is held while the zoom and the buttons settle (SETTLE), then while the caption's first part shows, and plays on
// under the rest.

import CAPTIONS from "../../captions.json";
import { onStep } from "../lib/animationMark.js";
import { SPEED, clock, playClock, setCaptionSlow } from "./gantryAnimation/clock.js";

/** How long a caption with `pause` holds the gantry, in seconds (the same for every caption). */
export const CAPTION_PAUSE = 1.5;
/** How long the map stays still before an opening caption comes up, in milliseconds. */
const SETTLE = 1500;

/** The reading speed in characters a second, and the shortest a part shows, in milliseconds. */
const READ_CPS = 17,
  READ_MIN = 1500;

/** How long a part shows, in milliseconds: its reading time, or `seconds` when the caption gives it. */
const readTime = (text, seconds) => (seconds ? seconds * 1000 : Math.max(READ_MIN, (text.length / READ_CPS) * 1000));

/** Captions waiting for their time (`due` on playClock(), the steps' own time), and the parts of the one showing, each
 * with its own time (`from` to `until` on clock(): read at the reader's pace). */
let pending = [],
  showing = [],
  // the timer that slows the animation to CAPTION_SPEED the moment the next caption is due
  timer = null,
  // whether the next step at speed is the run's first (clearCaptions() starts a run)
  first = true,
  // the opening caption, its parts timed on performance.now() (the gantry is held, so clock() stands still), the end of
  // the hold (once its first part has gone) and of the caption
  opening = null,
  // holds the gantry (true) or lets it play on (false): MapView's (onOpeningHold())
  holder = null;

/**
 * Has `fn` hold the gantry for an opening caption, and let it go once the caption has gone (MapView).
 * @param {(on: boolean) => void} fn
 * @returns {void}
 */
export function onOpeningHold(fn) {
  holder = fn;
}

/** Holds the gantry and times caption `c`'s parts from SETTLE on. */
function open(c) {
  let from = performance.now() + SETTLE,
    held = from;
  const parts = c.parts.map((text, i) => {
    const until = from + readTime(text, c.seconds),
      part = { text, point: c.point ?? null, layer: c.layer ?? null, from, until };
    from = until;
    if (i === 0) held = until;
    return part;
  });
  opening = { parts, held, end: from, holding: true };
  holder?.(true);
}

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
  const opens = first;
  first = false;
  for (const c of CAPTIONS)
    if (c.step === step && (c.span == null || c.span === span)) {
      if (opens && !opening && (c.at ?? 0) <= 1) open(c);
      else pending.push({ c, due: playClock() + (c.at ?? 0) * 1000 });
    }
  watch();
});

/**
 * The caption to show now (MapView asks every 250 ms while the gantry plays).
 * @returns {{ text: string|null, point: string|null, layer: string|null, pause: boolean }} point: the part the arrow
 * points at; layer: the layer switch to have on while it shows; pause: a caption with `pause` has just come up, so MapView holds the
 * gantry for CAPTION_PAUSE (true once only).
 */
export function captionNow() {
  if (opening) {
    const t = performance.now();
    if (opening.holding && t >= opening.held) {
      opening.holding = false;
      holder?.(false);
    }
    if (t < opening.end) {
      const part = opening.parts.find((p) => p.from <= t && t < p.until);
      // the rest of it shows at CAPTION_SPEED, as any caption does
      setCaptionSlow(true);
      return { text: part?.text ?? null, point: part?.point ?? null, layer: part?.layer ?? null, pause: false };
    }
    opening = null;
  }
  const now = clock(),
    played = playClock();
  let pause = false;
  for (const p of pending.filter((p) => p.due <= played)) {
    // a caption that comes up takes over from one still showing; its parts follow one another, from now
    let from = now;
    showing = p.c.parts.map((text) => {
      const until = from + readTime(text, p.c.seconds),
        part = { text, point: p.c.point ?? null, layer: p.c.layer ?? null, from, until };
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
  return { text: part?.text ?? null, point: part?.point ?? null, layer: part?.layer ?? null, pause };
}

/** Drops every caption, waiting or showing (the run is over or stopped). */
export function clearCaptions() {
  pending = [];
  showing = [];
  first = true;
  if (opening?.holding) holder?.(false);
  opening = null;
  clearTimeout(timer);
  setCaptionSlow(false);
}
