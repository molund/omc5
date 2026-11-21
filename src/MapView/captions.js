// Captions over the gantry animation, from captions.json at the top of the repo. Each one is tied to a step of the
// animation, not to a time, so it shows at the same moment whatever span the animation started on:
//   span: the span the move starts on (a walk's from span 41 or 50); left out, every span
//   step: the step's number, as in the address's hash (animationMark.js: 0 the fill, 1 to 28 the normal move, 29 B flies
//         across, 30 the short support carried back, 32 on the walk's steps)
//   at:   seconds after the step starts, at the speed the steps are written at (divided by SPEED as it plays); default 0
//   text: the caption
//   seconds: how long it shows; left out, long enough to read (READ_BASE plus READ_PER_WORD a word)
// A caption's time goes by clock(), so it waits while the Pause button holds the gantry.

import CAPTIONS from "../../captions.json";
import { onStep } from "../lib/animationMark.js";
import { SPEED, clock } from "./gantryAnimation/clock.js";

/** How long any caption shows at the least, and how much longer for each word, in milliseconds. */
const READ_BASE = 2000,
  READ_PER_WORD = 300;

/** Captions waiting for their time, and the one showing (`until` on clock()). */
let pending = [],
  showing = null;

// a step that starts at speed (not one played with no time, setInstant) lines up its captions
onStep((span, step) => {
  if (!Number.isFinite(SPEED)) return;
  for (const c of CAPTIONS)
    if (c.step === step && (c.span == null || c.span === span))
      pending.push({ c, from: clock() + ((c.at ?? 0) * 1000) / SPEED });
});

/**
 * The caption to show now (MapView asks every 250 ms while the gantry plays).
 * @returns {string|null}
 */
export function captionNow() {
  const now = clock();
  for (const p of pending.filter((p) => p.from <= now)) {
    const words = p.c.text.split(/\s+/).length;
    showing = {
      text: p.c.text,
      until: p.from + (p.c.seconds ? p.c.seconds * 1000 : READ_BASE + READ_PER_WORD * words),
    };
  }
  pending = pending.filter((p) => p.from > now);
  if (showing && now >= showing.until) showing = null;
  return showing?.text ?? null;
}

/** Drops every caption, waiting or showing (the run is over or stopped). */
export function clearCaptions() {
  pending = [];
  showing = null;
}
