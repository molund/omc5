// The Highway 15 crossing from where the crews had the supports on Nov. 19 (placeNowLayout() in beforeCrawl.js: A and C
// half way through the normal move, the short support off its long blue legs 15 ft behind A, B craned across the
// double girders at the 42/43 joint, its deck facing west): span 42 built and the supports spread out a spacing apart
// (ENTRY), the crawl over the double girder spans 43 to 47 as a loop (LOOP: four supports a spacing apart, the trolley
// carrying the back one to the front each time, no lifting jacks), and the supports brought into the normal move's
// half-way layout for the move from span 47 to 48 (EXIT), where the normal move takes over at its step 11. Worked out
// with the model of the move (every rule Mike gave, the tipping margin kept at 3.93 or more; 3.97 at the least) and played
// by walkPlayer.js. Positions are metres along the guideway's middle line from the 40/41 joint. See
// docs/double-girder/2-the-crawl.md.

import { playSteps } from "./walkPlayer.js";

/**
 * From the Nov. 19 layout to the start of the loop: the trusses slide onto span 42 on A (41/42) and B (42/43) and it is
 * built; the short support (standing across 15 ft behind A) is carried a little further back, so it can hold the trusses
 * while C is carried; then A, C and the short support are carried forward to the loop's places, a spacing apart behind B,
 * in the order they already stand (C, S, A, B), and the trusses go to where the loop starts.
 */
const ENTRY = [
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
 * The crawl: `times` carries, the trolley each time turning the back support lengthwise, carrying it over the others to
 * `spacing` past the front one and turning it across the regular way (it lands on the girders' middle line by itself; B's
 * deck faces east again after its first carry), and the trusses moving on so their middle is over the third support from
 * the back, with the trolley parked over the support it carries next (over the front long support when that is the short
 * support, which can't anchor it). B stands where the crane set it (82.1 m), and the spacing is chosen so the last carry
 * sets the short support down on the 47/48 hammerhead (301.04 m), 14 spacings past B. The trusses line up again only when
 * the short support stands in the middle two, so it never holds them during a swing.
 */
const LOOP = { order: ["C", "S", "A", "B"], spacing: (301.04 - 82.1) / 14, times: 14 };

/**
 * From the end of the loop (A, B, C a spacing apart behind the short support on the 47/48 hammerhead, the trusses slid
 * forward) to the normal move's half-way layout for the move from span 47 to 48: A carried to its place just behind the
 * short support (where the normal move's step 10 puts it), C back to its place on span 47 (step 4's), the trusses back to
 * where placeGantry() puts them on span 47, and B back behind C as far as the trusses allow (233.2 m: any further and C
 * alone would be behind the trusses' middle; the normal move picks B up there in step 13). The normal move goes on from
 * its step 11.
 */
const EXIT = [
  { op: "carry", who: "A", to: 299.05, turnFirst: true, turnLast: true },
  { op: "carry", who: "C", to: 255.53, turnFirst: true, turnLast: true },
  { op: "trusses", R: 224.69, anchor: "C", align: false },
  { op: "carry", who: "B", to: 233.2, turnFirst: true, turnLast: true },
];

/** The span the walk ends on: the last double girder span, where the normal move takes over. */
const WALK_ENDS_ON = { 41: 47 };

/** Whether there is a walk from span S (only from 41 so far: the crossings from 29 and 50 aren't worked out). */
export const hasWalk = (S) => S in WALK_ENDS_ON;
/** Half the trusses' length (tip to tip), in metres: the trusses' middle stands over the third support from the back. */
const HALF_TRUSSES = 103.93 / 2;

/** The loop's steps, one carry and one move of the trusses each time round, from where ENTRY leaves the supports. */
function loopSteps() {
  const { order, spacing, times } = LOOP,
    at = { B: 82.1 },
    roles = [...order],
    steps = [];
  for (const st of ENTRY) if (st.op === "carry") at[st.who] = st.to;
  for (let k = 1; k <= times; k++) {
    const back = roles.shift(),
      to = at[roles[roles.length - 1]] + spacing;
    steps.push({ op: "carry", who: back, to, turnFirst: true, turnLast: true });
    at[back] = to;
    roles.push(back);
    const next = k < times ? roles[0] : EXIT[0].who,
      anchor = next !== "S" ? next : [...roles].reverse().find((n) => n !== "S"),
      s = roles.indexOf("S");
    steps.push({ op: "trusses", R: at[roles[2]] - HALF_TRUSSES, anchor, align: s > 0 && s < roles.length - 1 });
  }
  return steps;
}

/**
 * Plays the crossing on from the Nov. 19 layout (span S, about to build S + 1) and snaps the gantry onto the last double
 * girder span, half way through its normal move, for the normal move to go on from step 11.
 * @returns {Promise<boolean>} true when it played, so playToEnd() goes on with the normal move.
 */
export async function playWalk(m) {
  const last = WALK_ENDS_ON[m.S];
  if (!last) return false;
  return playSteps(m, [...ENTRY, ...loopSteps(), ...EXIT], last, { halfway: true });
}
