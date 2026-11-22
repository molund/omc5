// Where the gantry animation is, for the address: how long it has played, and the step under way and the span its move
// started on. The steps call markStep() as they start; hash.svelte.js puts encodeMark() in the address's hash (no key,
// just the value), so a link to a moment says which step it was, whatever span the animation started on (for captions).
//
// The value is five base64url characters: 30 bits, from the highest, of
//   time: 16 bits, in quarter seconds (up to about 4.5 hours)
//   span: 7 bits, the span the move started on (a walk's from span 41 or 50)
//   step: 7 bits, the step's number (STEPS below)
// decodeMark() turns one back.

/**
 * The step numbers: the normal move's steps 0 to 28 (0 the fill, normalMove.js), and the walks' own steps.
 * - 0 to 28: the normal move's step of that number (also steps 1 to 10 played into a walk's start layout)
 * - 29: B flies across to the double girders (the walk's start layout, walkStart.js)
 * - 30: the trolley carries the short support back to its place in the start layout (playWalk()'s carryShort)
 * - 32 + i: the walk's step i (walk.js: entry, loop and exit, counted from 0)
 */
export const STEPS = { FLY_B: 29, CARRY_SHORT_BACK: 30, WALK: 32 };

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

let span = 0,
  step = 0;
/** What to tell as each step starts (onStep()). @type {Set<(span: number, step: number) => void>} */
const listeners = new Set();

/**
 * Has `fn` told the span and step each time a step starts (the captions, MapView/captions.js).
 * @param {(span: number, step: number) => void} fn
 * @returns {void}
 */
export function onStep(fn) {
  listeners.add(fn);
}

/** The span the gantry is on as the step starts: the move's span, but part way through a walk the span the walk has
 * reached (the −1 and +1 buttons step from it). */
let current = 0;
/** Steps played with no time (setInstant() in clock.js: a pose, or catching up to a start span) aren't noted. */
let muted = false;

/**
 * Stops noting steps, or starts again (setInstant() in clock.js): steps played with no time are only setting the gantry
 * up, so they leave the span, step and captions where they were.
 * @param {boolean} on
 * @returns {void}
 */
export function muteMarks(on) {
  muted = on;
}

/**
 * The span the gantry is on, before the move that starts there notes its first step (stepAnimation(), so a second −1 or
 * +1 straight after steps from the span the first one went to).
 * @param {number} n
 * @returns {void}
 */
export function setCurrentSpan(n) {
  current = n;
}

/**
 * Notes the step that is starting.
 * @param {number} s The span the move started on.
 * @param {number} n The step's number (see STEPS).
 * @param {number} [on] The span the gantry is on now, when that isn't `s` (part way through a walk).
 * @returns {void}
 */
export function markStep(s, n, on = s) {
  if (muted) return;
  span = Math.max(0, Math.min(127, Math.round(+s) || 0));
  step = Math.max(0, Math.min(127, n));
  current = Math.round(+on) || span;
  listeners.forEach((fn) => fn(span, step));
}

/** The span the move under way started on (as markStep() last had it). */
export const markedSpan = () => span;

/** The span the gantry is on (as markStep() last had it): the move's, or the one a walk has reached. */
export const currentSpan = () => current;

/**
 * The address's hash value for now.
 * @param {number} seconds How long the animation has played.
 * @returns {string} Five base64url characters.
 */
export function encodeMark(seconds) {
  const v = Math.max(0, Math.min(0xffff, Math.round(seconds * 4))) * 2 ** 14 + span * 2 ** 7 + step;
  let out = "";
  for (let i = 4; i >= 0; i--) out += ALPHABET[Math.floor(v / 2 ** (6 * i)) % 64];
  return out;
}

/**
 * A hash value back into its parts.
 * @param {string} value Five base64url characters (a leading # is ignored).
 * @returns {{ seconds: number, span: number, step: number }|null} null when it isn't one.
 */
export function decodeMark(value) {
  const s = value.replace(/^#/, "");
  if (!/^[A-Za-z0-9_-]{5}$/.test(s)) return null;
  const v = [...s].reduce((a, c) => a * 64 + ALPHABET.indexOf(c), 0);
  return { seconds: Math.floor(v / 2 ** 14) / 4, span: Math.floor(v / 2 ** 7) % 128, step: v % 128 };
}
