// The animation's time: how fast it plays (SPEED), its own clock, the waits between moves, and the Pause and Play buttons'
// hold on them all.

import { muteMarks } from "../../lib/animationMark.js";

/**
 * How fast the whole animation plays: every move's duration and every pause is divided by it, so 2 is twice as fast as
 * the times written in the steps, and 1 plays them as written. After the Play pill, the moves play at SPEEDS in
 * turn (one a cycle), and every move after the last of them at that last speed (playToEnd sets it). While a caption is up (or about to come up), everything plays at CAPTION_SPEED instead, and goes
 * back once it has gone (setCaptionSlow, from captions.js). A change of speed takes effect at once, on the moves and waits
 * under way too.
 */
export const SPEEDS = [2, 4, 8];
/** How fast everything plays while a caption is up. */
export const CAPTION_SPEED = 2;
/** How fast the span fill (step 0) always plays, whatever the cycle's speed or a caption: it stands for about three
 * quarters of the real cycle, so it keeps the same length on the screen. */
export const FILL_SPEED = 2;
export let SPEED = SPEEDS[0];

/** Which of SPEEDS is playing now, whether a caption has it at CAPTION_SPEED, and whether the fill has it at FILL_SPEED. */
let speedIndex = 0,
  captionSlow = false,
  filling = false;

/** The speed it should play at now: the fill's, a caption's, or the cycle's. */
const wanted = () => (filling ? FILL_SPEED : captionSlow ? CAPTION_SPEED : SPEEDS[speedIndex]);

/**
 * The animation's time as written (milliseconds of the steps' own times, before SPEED divides them), the time held by the
 * Pause button left out: what the fills and the captions go by, so a change of speed carries them along.
 */
let played = 0,
  playedAt = performance.now();
/** Brings `played` up to now, at the speed it has been playing at. */
function settle() {
  const now = performance.now();
  if (heldAt == null && Number.isFinite(SPEED)) played += (now - playedAt) * SPEED;
  playedAt = now;
}
/** The animation's time as written, now (see `played`). */
export const playClock = () => {
  settle();
  return played;
};

/** Plays at wanted() from now on: the moves under way speed up or slow down where they are, and so do the waits. */
function applySpeed() {
  // while steps play with no time, setInstant(false) picks up the speed
  if (!Number.isFinite(SPEED)) return;
  const next = wanted();
  if (next === SPEED) return;
  settle();
  const k = next / SPEED,
    now = performance.now();
  for (const a of document.getAnimations())
    if (a.effect?.target instanceof SVGElement && (a.playState === "running" || a.playState === "paused"))
      a.updatePlaybackRate(a.playbackRate * k);
  for (const w of waits) {
    if (heldAt != null) {
      // held: holdGantry() has already taken off what they had waited
      w.left /= k;
      continue;
    }
    clearTimeout(w.timer);
    w.left = Math.max(0, w.left - (now - w.from)) / k;
    count(w);
  }
  SPEED = next;
}

/** Sets how fast the moves play: SPEEDS[i] (unless a caption is up). */
export const setSpeed = (i) => {
  speedIndex = i;
  applySpeed();
};

/** Plays at FILL_SPEED while the span fills (on), or at the speed it would otherwise have again (off). */
export const setFilling = (on) => {
  filling = on;
  applySpeed();
};

/** Plays everything at CAPTION_SPEED while a caption is up or about to come up (on), or at SPEEDS again (off). */
export const setCaptionSlow = (on) => {
  captionSlow = on;
  applySpeed();
};

/**
 * Plays every move and pause with no time at all (on), or at the speed again (off): for steps that only set up where the
 * pieces start, such as the walk's steps the crews have already made (walk.js).
 */
export const setInstant = (on) => {
  muteMarks(on);
  settle();
  SPEED = on ? Infinity : wanted();
};

/**
 * Counts the stops: stopGantry() adds one. A move notes it as it starts waiting, and gives up if it has changed by the
 * time the wait is over.
 */
export let stops = 0;

/** Counts one more stop (stopGantry). */
export const stop = () => stops++;

/**
 * Whether the Pause button has the gantry held (holdGantry() to resumeGantry()), and since when (performance.now()).
 * @type {number|null}
 */
let heldAt = null;
/** How long the gantry has been held in all, in milliseconds, so clock() can leave it out. */
let heldFor = 0;
/** The moves holdGantry() paused, for resumeGantry() to play on. @type {Set<Animation>} */
const heldMoves = new Set();

/** The animation's own time, in milliseconds: performance.now() with the time the gantry has been held left out. */
export const clock = () => performance.now() - heldFor - (heldAt == null ? 0 : performance.now() - heldAt);

/**
 * The waits under way (pause()): how long each has left, when it last started counting (performance.now()), its
 * timer, and what to do when it is up. holdGantry() stops their timers and resumeGantry() starts them again with what
 * they had left.
 * @type {Set<{ left: number, from: number, timer: number, up: () => void }>}
 */
export const waits = new Set();

/** Starts a wait's timer for what it has left. */
function count(w) {
  w.from = performance.now();
  w.timer = setTimeout(w.up, w.left);
}

/** Waits `ms` milliseconds; fails instead if the gantry is stopped meanwhile, so the move it is part of goes no further. */
export const pause = (ms) =>
  new Promise((done, fail) => {
    const at = stops,
      w = { left: ms / SPEED, from: 0, timer: 0, up: () => {} };
    w.up = () => {
      clearTimeout(w.timer);
      waits.delete(w);
      if (at === stops) done();
      else fail(new Error("gantry stopped"));
    };
    waits.add(w);
    if (heldAt == null) count(w);
  });

/**
 * Holds the gantry where it is (the Pause button): every move on the map pauses, the waits between them stop counting,
 * and the fills stop filling (they go by clock()). Until resumeGantry(), any move that starts is paused on its first
 * frame, so a step that was just finishing doesn't carry on into the next.
 * @param {SVGSVGElement} svg The map's <svg>.
 * @returns {void}
 */
export function holdGantry(svg) {
  if (heldAt != null || !svg) return;
  settle();
  heldAt = performance.now();
  for (const w of waits) {
    clearTimeout(w.timer);
    w.left = Math.max(0, w.left - (heldAt - w.from));
  }
  const at = heldAt;
  const hold = () => {
    if (heldAt !== at) return;
    for (const a of svg.getAnimations({ subtree: true }))
      if (a.playState === "running") {
        a.pause();
        heldMoves.add(a);
      }
    requestAnimationFrame(hold);
  };
  hold();
}

/**
 * Plays the gantry on from where holdGantry() held it (the Play button).
 * @returns {void}
 */
export function resumeGantry() {
  if (heldAt == null) return;
  settle();
  heldFor += performance.now() - heldAt;
  heldAt = null;
  heldMoves.forEach((a) => a.playState === "paused" && a.play());
  heldMoves.clear();
  waits.forEach(count);
}
