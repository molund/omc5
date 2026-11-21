// Captions over the gantry animation, from captions.json at the top of the repo. Each one is tied to a step of the
// animation, not to a time, so it shows at the same moment whatever span the animation started on:
//   span: the span the move starts on (a walk's from span 41 or 50); left out, every span
//   step: the step's number, as in the address's hash (animationMark.js: 0 the fill, 1 to 28 the normal move, 29 B flies
//         across, 30 the short support carried back, 32 on the walk's steps)
//   at:   seconds after the step starts, at the speed the steps are written at (divided by SPEED as it plays); default 0
//   parts: the caption's text, as a list: one after another, each for long enough to read it (READ_BASE plus READ_PER_WORD
//          a word), with the same arrow throughout
//   seconds: how long each part shows instead
//   point: a part of the gantry for an arrow to point at while it shows (captionArrow.js: support-a, support-b, support-c,
//          short-support, trolley, front-jacks, rear-jacks), or a guideway support by the spans either side ("12/13")
//   pause: true to hold the gantry for CAPTION_PAUSE as it shows, for news worth stopping for (every pause is that long)
// A caption's time goes by clock(), so it waits while the Pause button holds the gantry.

import CAPTIONS from "../../captions.json";
import { onStep } from "../lib/animationMark.js";
import { SPEED, clock } from "./gantryAnimation/clock.js";

/** How long a caption with `pause` holds the gantry, in seconds (the same for every caption). */
export const CAPTION_PAUSE = 1.5;

/** How long any caption shows at the least, and how much longer for each word, in milliseconds. */
const READ_BASE = 2000,
  READ_PER_WORD = 300;

/** Captions waiting for their time, and the parts of the one showing, each with its own time (`from` to `until` on
 * clock()). */
let pending = [],
  showing = [];

// a step that starts at speed (not one played with no time, setInstant) lines up its captions
onStep((span, step) => {
  if (!Number.isFinite(SPEED)) return;
  for (const c of CAPTIONS)
    if (c.step === step && (c.span == null || c.span === span))
      pending.push({ c, from: clock() + ((c.at ?? 0) * 1000) / SPEED });
});

/**
 * The caption to show now (MapView asks every 250 ms while the gantry plays).
 * @returns {{ text: string|null, point: string|null, pause: boolean }} point: the part the arrow points at; pause: a caption with `pause` has just come up, so MapView holds the
 * gantry for CAPTION_PAUSE (true once only).
 */
export function captionNow() {
  const now = clock();
  let pause = false;
  for (const p of pending.filter((p) => p.from <= now)) {
    // a caption that comes up takes over from one still showing; its parts follow one another
    let from = p.from;
    showing = p.c.parts.map((text) => {
      const until = from + (p.c.seconds ? p.c.seconds * 1000 : READ_BASE + READ_PER_WORD * text.split(/\s+/).length),
        part = { text, point: p.c.point ?? null, from, until };
      from = until;
      return part;
    });
    pause ||= !!p.c.pause;
  }
  pending = pending.filter((p) => p.from > now);
  showing = showing.filter((s) => now < s.until);
  const part = showing.find((s) => s.from <= now);
  return { text: part?.text ?? null, point: part?.point ?? null, pause };
}

/** Drops every caption, waiting or showing (the run is over or stopped). */
export function clearCaptions() {
  pending = [];
  showing = [];
}
