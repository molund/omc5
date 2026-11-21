// The walks over the double girder spans: spans 43 to 47 (from span 41, across Highway 15) and spans 52 to 54 (from
// span 50), each from where the crews have the supports at the start (placeNowLayout() in walkStart.js: A and C half way through the normal move, the short support off its long blue legs 15 ft behind A, B
// craned across the double girders at the first double girder joint, its deck facing west): the span after the start
// built and the supports spread out a spacing apart (entry), the walk over the double girder spans as a loop (four
// supports a spacing apart, the trolley carrying the back one to the front each time, no lifting jacks), and the supports
// brought into the normal move's half-way layout for the move off the last double girder span (exit), where the normal
// move takes over at its step 11. Worked out with the model of the move (every rule Mike gave, the tipping margin kept at
// 3.93 or more) and played by walkPlayer.js. Positions are metres along the guideway's middle line from the back of the
// span the walk starts from. See docs/double-girder/the-walk.md.

import { playSteps } from "./walkPlayer.js";

/**
 * From the Nov. 19 layout to the start of the loop: the trusses slide onto span 42 on A (41/42) and B (42/43) and it is
 * built; the short support (standing across 15 ft behind A) is carried a little further back, so it can hold the trusses
 * while C is carried; then A, C and the short support are carried forward to the loop's places, a spacing apart behind B,
 * in the order they already stand (C, S, A, B), and the trusses go to where the loop starts.
 */
const ENTRY_41 = [
  { op: "trusses", R: 4.0, anchor: "A" },
  { op: "fill" },
  { op: "carry", who: "S", to: 20.0 },
  { op: "trusses", R: -5.0, anchor: "A" },
  { op: "carry", who: "A", to: 66.46 },
  { op: "carry", who: "C", to: 35.18, turnFirst: true, turnLast: true, deck: "E" },
  { op: "carry", who: "S", to: 50.82, turnFirst: true, turnLast: true, deck: "W" },
  { op: "trusses", R: 14.5, anchor: "A" },
];

/**
 * The loop: `times` carries, the trolley each time turning the back support lengthwise, carrying it over the others to
 * `spacing` past the front one and turning it across the regular way (it lands on the girders' middle line by itself; B's
 * deck faces east again after its first carry), and the trusses moving on so their middle is over the third support from
 * the back, with the trolley parked over the support it carries next (over the front long support when that is the short
 * support, which can't anchor it). B stands where the crane set it (82.1 m), and the spacing is chosen so the last carry
 * sets the short support down on the 47/48 hammerhead (301.04 m), 14 spacings past B. The trusses line up again only when
 * the short support stands in the middle two, so it never holds them during a swing.
 */
const LOOP_41 = { order: ["C", "S", "A", "B"], spacing: (301.04 - 82.1) / 14, times: 14 };

/**
 * From the end of the loop (B, C and A a spacing apart behind the short support on the 47/48 hammerhead, the trusses slid
 * forward) to the normal move's half-way layout for the move from span 47 to 48: A carried to its place just behind the
 * short support (where the normal move's step 10 puts it), C back onto the place the snap gives it on span 48 (256.4 m,
 * so the snap doesn't move it), the trusses back until the trolley reaches behind C, and B carried back over C to one
 * spacing behind it (240.76 m: the room it needs to turn across there). The normal move goes on from its step 11.
 *
 * B and C have to go back: the normal move's steps 12 to 14 slide the trusses back about 36 m to pick up the short
 * support with the front jacks, which needs a long support behind their middle (about 249 m). Left at 269.8 m, the gantry
 * would tip back. C goes back first, or the trusses couldn't slide back far enough for the trolley to reach behind C. B
 * goes back only as far as that needs, not to where the normal move's rules put the rear support (the back of span 46,
 * about 200 m, rules made for 40 m spans: span 46 is 55.6 m long).
 */
const EXIT_41 = [
  { op: "carry", who: "A", to: 299.05, turnFirst: true, turnLast: true },
  { op: "carry", who: "C", to: 256.4, turnFirst: true, turnLast: true },
  { op: "trusses", R: 232.0, anchor: "C", align: false },
  { op: "carry", who: "B", to: 256.4 - LOOP_41.spacing, turnFirst: true, turnLast: true },
];

/**
 * The walk over spans 52 to 54 from span 50, the same walk as the one from span 41 with the same rules (worked out with the same
 * model: the tipping margin 4.55 at the least, 15.3 in the normal move's steps 12 to 14), from the same kind of start: A
 * and C half way through the normal move, the short support across 15 ft behind A, and B craned across the double girders
 * at the 51/52 joint, its deck facing west (placeNowLayout(), as at span 41: nobody has seen this one yet). Positions are
 * metres along the guideway's middle line from the 49/50 joint. The span built first, 51, is only 30 m long, and the
 * spacing is 16.12 m, so that the tenth carry sets the short support down on the 54/55 hammerhead (240.42 m).
 */
const ENTRY_50 = [
  { op: "trusses", R: 4.0, anchor: "A" },
  { op: "fill" },
  { op: "carry", who: "S", to: 20.0 },
  { op: "trusses", R: -8.0, anchor: "A" },
  { op: "carry", who: "A", to: 63.08 },
  { op: "carry", who: "C", to: 30.83, turnFirst: true, turnLast: true, deck: "E" },
  { op: "carry", who: "S", to: 46.96, turnFirst: true, turnLast: true, deck: "W" },
  { op: "trusses", R: 11.11, anchor: "A" },
];
const LOOP_50 = { order: ["C", "S", "A", "B"], spacing: (240.42 - 79.2) / 10, times: 10 };
/**
 * As the 41 walk's: A to its place just behind the short support (238.41 m), C to the place the snap gives it on span
 * 55 (191.02 m), the trusses back until the trolley reaches behind C, and B back over C to one spacing behind it.
 */
const EXIT_50 = [
  { op: "carry", who: "A", to: 238.41, turnFirst: true, turnLast: true },
  { op: "carry", who: "C", to: 191.02, turnFirst: true, turnLast: true },
  { op: "trusses", R: 166.5, anchor: "C", align: false },
  { op: "carry", who: "B", to: 191.02 - LOOP_50.spacing, turnFirst: true, turnLast: true },
];

/** Half the trusses' length (tip to tip), in metres: the trusses' middle stands over the third support from the back. */
const HALF_TRUSSES = 103.93 / 2;

/**
 * The walks, by the span each starts from: the last double girder span, where the normal move takes over (`last`);
 * the span built first (`built`); where the supports stand at the start (`start`, as placeNowLayout() puts them); the joints
 * at the far ends of the double girder spans before the last (`farJoint`); and the steps.
 */
const WALKS = {
  41: {
    last: 47,
    built: 42,
    start: { A: 39.9, B: 82.1, S: 33.3, C: 3.4 },
    farJoint: { 43: 111.8, 44: 152.1, 45: 197.6, 46: 253.2 },
    entry: ENTRY_41,
    loop: LOOP_41,
    exit: EXIT_41,
  },
  50: {
    last: 54,
    built: 51,
    start: { A: 47.2, B: 79.2, S: 40.7, C: 3.1 },
    farJoint: { 52: 127.45, 53: 187.82 },
    entry: ENTRY_50,
    loop: LOOP_50,
    exit: EXIT_50,
  },
};

/** The loop's steps, one carry and one move of the trusses each time round, from where the entry leaves the supports. */
function loopSteps({ start, entry, loop, exit }) {
  const { order, spacing, times } = loop,
    at = { B: start.B },
    roles = [...order],
    steps = [];
  for (const st of entry) if (st.op === "carry") at[st.who] = st.to;
  for (let k = 1; k <= times; k++) {
    const back = roles.shift(),
      to = at[roles[roles.length - 1]] + spacing;
    steps.push({ op: "carry", who: back, to, turnFirst: true, turnLast: true });
    at[back] = to;
    roles.push(back);
    const next = k < times ? roles[0] : exit[0].who,
      anchor = next !== "S" ? next : [...roles].reverse().find((n) => n !== "S"),
      s = roles.indexOf("S");
    steps.push({ op: "trusses", R: at[roles[2]] - HALF_TRUSSES, anchor, align: s > 0 && s < roles.length - 1 });
  }
  return steps;
}

/** A walk's steps, start to end. */
const walkSteps = (c) => [...c.entry, ...loopSteps(c), ...c.exit];

/**
 * Where the walk under way on span S started and how many of its steps the crews have made by then (played with no time
 * before the rest plays); null when S isn't part way through one. The gantry stands where span S turns to the progress
 * colour, as the progress card counts it: the span built first (hung) once it is built; a double girder span once two
 * supports stand at or past its far joint (markPassedSpans() in walkPlayer.js); the last one at the hand-off to the
 * normal move (the whole walk).
 * @param {number} S The span status.yaml gives.
 * @returns {{ from: number, done: number }|null}
 */
export function walkPartWay(S) {
  for (const [from, c] of Object.entries(WALKS)) {
    if (S < c.built || S > c.last) continue;
    const steps = walkSteps(c);
    if (S === c.built) return { from: +from, done: steps.findIndex((st) => st.op === "fill") + 1 };
    if (S === c.last) return { from: +from, done: steps.length };
    const joint = c.farJoint[S];
    if (joint == null) return null;
    const at = { ...c.start };
    for (const [i, st] of steps.entries()) {
      if (st.op === "carry") at[st.who] = st.to;
      if (Object.values(at).filter((x) => x >= joint - 0.5).length >= 2) return { from: +from, done: i + 1 };
    }
  }
  return null;
}

/** Whether there is a walk from span S (41 or 50), or one under way on it (29 isn't worked out). */
export const hasWalk = (S) => S in WALKS || walkPartWay(S) != null;

/**
 * Plays the walk on from its start (span S, about to build S + 1) and snaps the gantry onto the last double girder
 * span, half way through its normal move, for the normal move to go on from step 11.
 * @param {object} m What the steps share (startMove()).
 * @param {number} [done] How many of the steps the crews have already made: played with no time (see walkPartWay).
 * @param {boolean} [pose] Only those steps, to show the gantry where the crews have it (poseGantry()).
 * @param {boolean} [carryShort] First the trolley carries the short support back to its place in the start layout (after
 * placeNowLayout() has played the rest of the way into it).
 * @returns {Promise<boolean>} true when it played, so playToEnd() goes on with the normal move.
 */
export async function playWalk(m, done = 0, pose = false, carryShort = false) {
  const c = WALKS[m.S];
  if (!c) return false;
  // after the first half of a move into the start layout (placeNowLayout() in walkStart.js), the trolley carries the
  // short support back from the front to its place in it, behind A
  const lead = carryShort ? [{ op: "carry", who: "S", to: c.start.S, turnFirst: true, turnLast: true }] : [];
  return playSteps(m, [...lead, ...walkSteps(c)], c.last, { halfway: true, done, pose });
}
