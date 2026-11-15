// The animation's time: how fast it plays (SPEED), its own clock, the waits between moves, and the Pause and Play buttons'
// hold on them all.

/**
 * How fast the whole animation plays: every move's duration and every pause is divided by it, so 2 is twice as fast as
 * the times written in the steps, and 1 plays them as written. After the Play pill, the moves play at SPEEDS in
 * turn, and every move after the last of them at that last speed (playToEnd sets it).
 */
export const SPEEDS = [6, 3, 1, 1, 1];
export let SPEED = SPEEDS[0];

/** Which of SPEEDS is playing now. */
let speedIndex = 0;

/** Sets how fast the moves play: SPEED is SPEEDS[i]. */
export const setSpeed = (i) => {
  speedIndex = i;
  SPEED = SPEEDS[i];
};

/** Goes on to the next of SPEEDS (the last one stays), for a move that plays a number of cycles in one call. */
export const nextSpeed = () => setSpeed(Math.min(speedIndex + 1, SPEEDS.length - 1));

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
  heldFor += performance.now() - heldAt;
  heldAt = null;
  heldMoves.forEach((a) => a.playState === "paused" && a.play());
  heldMoves.clear();
  waits.forEach(count);
}
