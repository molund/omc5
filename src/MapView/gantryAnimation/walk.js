// The walks over the double girder spans: spans 43 to 47 (from span 41, across Highway 15) and spans 52 to 54 (from
// span 51), each from where the crews have the supports at the start (from span 41, placeNowLayout() in walkStart.js: A
// and C half way through the normal move, the short support off its long blue legs 15 ft behind A, B craned across the
// double girders at the first double girder joint, its deck facing west; from span 51, the normal move's layout, the
// front lifting jacks having set the short support, legs off, on the span 52 girders): a span built and the supports
// spread out a spacing apart (entry), the walk over the double girder spans as a loop (four
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
 * so the snap doesn't move it), the trusses back until the trolley reaches B's place, and B carried back over C to
 * 223.9 m. The normal move goes on from its step 11.
 *
 * B and C have to go back: the normal move's steps 12 to 14 slide the trusses back about 36 m to pick up the short
 * support with the front jacks, which needs a long support behind their middle (about 249 m). Left at 269.8 m, the gantry
 * would tip back. C goes back first, or the trusses couldn't slide back far enough for the trolley to reach behind C. B is
 * the rear support, the ballast: it goes back far enough that the rear lifting jacks pick it up about 70% of the way
 * through the front support's trip (steps 13 and 14), as in a normal move. Span 47 is 55.6 m long, so the places the
 * normal move's rules give (made for 40 m spans) would leave it out of their reach.
 */
const EXIT_41 = [
  { op: "carry", who: "A", to: 299.05, turnFirst: true, turnLast: true },
  { op: "carry", who: "C", to: 256.4, turnFirst: true, turnLast: true },
  { op: "trusses", R: 215.1, anchor: "C", align: false },
  { op: "carry", who: "B", to: 223.9, turnFirst: true, turnLast: true },
];

/**
 * The walk over spans 52 to 54 from span 51. No crane (Mike): as at span 30, the normal move from span 50 has the front
 * lifting jacks set the short support, its legs off, on the span 52 girders at the 51/52 joint (30.96 m), so the walk
 * starts from the normal move's layout on span 51: B at the 49/50 joint, C lengthwise on span 50, A at the 50/51 tulip.
 * Positions are metres along the guideway's middle line from the 50/51 joint. Span 51 is built before the walk starts
 * (startMove()'s step 0, as before every move); the trusses slide back in two goes, so they roll onto B before their
 * middle passes A; then A, C (turned across) and B go to the loop's places, a spacing apart behind the short support,
 * which stays where the jacks set it. Worked out with the same model as the walk from span 41: the tipping margin 4.84 at
 * the least (the loop's carries).
 */
const ENTRY_51 = [
  { op: "trusses", R: -46.24, anchor: "A", align: false },
  { op: "trusses", R: -54.24, anchor: "A", align: false },
  { op: "carry", who: "A", to: 10.81 },
  { op: "carry", who: "C", to: -29.5, turnLast: true, deck: "E" },
  { op: "carry", who: "B", to: -9.34, turnFirst: true, turnLast: true },
  { op: "trusses", R: -41.16, anchor: "C", align: false },
];
/** The short support starts at the front, so it comes round every fourth carry: the eighth sets it down on the 54/55
 * hammerhead (192.18 m), 20.15 m a carry (the trolley's reach behind the trusses' middle allows up to about 21.5 m). */
const LOOP_51 = { order: ["C", "B", "A", "S"], spacing: (192.18 - 30.96) / 8, times: 8 };
/**
 * To the same half-way layout as the walk from span 50 had (and the same trusses, 1 m further back, so the trolley reaches
 * B): A to its place just behind the short support (190.17 m), the trusses back, B back over C to 112.16 m, where the rear
 * lifting jacks pick it up about 70% of the way through the front support's trip, and C to the place the snap gives it on
 * span 55 (142.78 m). B goes before C, or the two would stand only 9 m apart; the normal move's step 11 sends the trolley to
 * C anyway.
 */
const EXIT_51 = [
  { op: "carry", who: "A", to: 190.17, turnFirst: true, turnLast: true },
  { op: "trusses", R: 102.76, anchor: "B", align: false },
  { op: "carry", who: "B", to: 112.16, turnFirst: true, turnLast: true },
  { op: "carry", who: "C", to: 142.78, turnFirst: true, turnLast: true },
];

/** Half the trusses' length (tip to tip), in metres: the trusses' middle stands over the third support from the back. */
const HALF_TRUSSES = 103.93 / 2;

/**
 * The walks, by the span each starts from: the last double girder span, where the normal move takes over (`last`);
 * the span built first (`built`); where the supports stand at the start (`start`: as placeNowLayout() puts them with
 * `crane`, B lifted across by a mobile crane; as placeGantry() does without); the joints at the far ends of the double
 * girder spans before the last (`farJoint`); and the steps.
 */
const WALKS = {
  41: {
    last: 47,
    built: 42,
    crane: true,
    start: { A: 39.9, B: 82.1, S: 33.3, C: 3.4 },
    farJoint: { 43: 111.8, 44: 152.1, 45: 197.6, 46: 253.2 },
    entry: ENTRY_41,
    loop: LOOP_41,
    exit: EXIT_41,
  },
  51: {
    last: 54,
    built: 51,
    crane: false,
    start: { A: -1.0, B: -45.05, S: 30.96, C: -13.52 },
    farJoint: { 52: 79.21, 53: 139.58 },
    entry: ENTRY_51,
    loop: LOOP_51,
    exit: EXIT_51,
  },
};

/** Whether the walk from span S starts with B lifted across by a mobile crane (placeNowLayout() in walkStart.js). */
export const craneStart = (S) => !!WALKS[S]?.crane;

/** The loop's steps, one carry and one move of the trusses each time round, from where the entry leaves the supports. */
function loopSteps({ start, entry, loop, exit }) {
  const { order, spacing, times } = loop,
    // every support's place at the start, then the entry's carries (the walk from 51 never carries the short support)
    at = { ...start },
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
    // the span built first: once it is built (its fill); a walk that starts on it (from 51) isn't part way there
    if (S === c.built) return +from === S ? null : { from: +from, done: steps.findIndex((st) => st.op === "fill") + 1 };
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

/**
 * The span a walk from span S has reached once `done` of its steps are made: the last span whose walkPartWay() has no
 * more steps done than that (S itself before the first is built).
 * @param {number} S The span the walk starts from (41 or 51).
 * @param {number} done How many of the walk's own steps are made.
 * @returns {number}
 */
export function walkSpanAt(S, done) {
  const c = WALKS[S];
  let on = S;
  if (!c) return on;
  for (let s = c.built; s <= c.last; s++) {
    const p = walkPartWay(s);
    if (p && p.from === S && p.done <= done) on = s;
  }
  return on;
}

/** Whether there is a walk from span S (41 or 51), or one under way on it (29 isn't worked out). */
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
  return playSteps(m, [...lead, ...walkSteps(c)], c.last, { halfway: true, done, pose, lead: lead.length });
}
