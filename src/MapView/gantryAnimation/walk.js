// The Highway 15 crossing after the first move (Support C set down behind the front support, in beforeCrawl.js): the rest of
// the move before the crawl and the building of span 42 (ENTRY), the crawl over the double girder spans 43 to 47 as a loop
// (LOOP: four supports a spacing apart, the trolley carrying the back one to the front each time, no lifting jacks), and
// the move into placeGantry()'s layout for span 47 (EXIT), where the normal move takes over. Worked out with the model of
// the move (every rule Mike gave, the tipping margin kept at 3.93 or more) and played by walkPlayer.js. Positions are metres
// along the guideway's middle line from the 40/41 joint. See docs/double-girder/2-the-crawl.md.

import { playSteps } from "./walkPlayer.js";

/** From the first move to the start of the loop: the rest of the move before the crawl, span 42 built, and on. */
const ENTRY = [
  { op: "carry", who: "C", to: 26.0 },
  { op: "trusses", R: -53.5, anchor: "C" },
  { op: "carry", who: "S", to: -26.0, turnFirst: true, turnLast: true, deck: "W" },
  { op: "carry", who: "A", to: 38.0, turnFirst: true, turnLast: true, deck: "W" },
  { op: "carry", who: "C", to: 34.0 },
  { op: "carry", who: "B", to: -10.0, turnFirst: true, turnLast: true, deck: "E" },
  { op: "trusses", R: -66.7, anchor: "B" },
  { op: "trusses", R: -25.3, anchor: "B", pick: { who: "A", jacks: "front" } },
  { op: "trusses", R: -20.7, anchor: "B", pick: { who: "S", jacks: "rear" }, drop: ["A", "S"] },
  { op: "trusses", R: -3.3, anchor: "C" },
  { op: "fill" },
  { op: "trusses", R: -9.3, anchor: "C" },
  { op: "trusses", R: 25.5, anchor: "C", pick: { who: "B", jacks: "rear" }, drop: ["B"] },
  { op: "trusses", R: -20.7, anchor: "C" },
  { op: "trusses", R: 15.3, anchor: "C", pick: { who: "S", jacks: "rear" }, drop: ["S"] },
  { op: "carry", who: "C", to: 48.0 },
  { op: "carry", who: "B", to: 96.0, turnFirst: true, turnLast: true, deck: "E" },
  { op: "trusses", R: 40.7, anchor: "B", pick: { who: "S", jacks: "rear" }, drop: ["S"] },
  { op: "trusses", R: 24.7, anchor: "B" },
  { op: "carry", who: "S", to: 120.0, turnFirst: true, turnLast: true, deck: "W" },
  { op: "trusses", R: 48.7, anchor: "A" },
  { op: "trusses", R: 68.7, anchor: "A", pick: { who: "C", jacks: "rear" } },
  { op: "carry", who: "A", to: 108.0, turnFirst: true, turnLast: true, deck: "E" },
  { op: "carry", who: "A", to: 112.0 },
  { op: "trusses", R: 64.7, anchor: "A", drop: ["C"] },
  { op: "trusses", R: 48.7, anchor: "A" },
  { op: "carry", who: "S", to: 104.0, turnFirst: true, turnLast: true, deck: "W" },
  { op: "carry", who: "B", to: 84.0 },
  { op: "carry", who: "C", to: 124.0, turnFirst: true, turnLast: true, deck: "E" },
  { op: "carry", who: "A", to: 120.0 },
  { op: "carry", who: "C", to: 138.3 },
  { op: "trusses", R: 70.1, anchor: "C" },
  { op: "carry", who: "B", to: 89.5 },
  { op: "carry", who: "A", to: 122.0 },
  { op: "carry", who: "S", to: 105.8 },
];

/**
 * The crawl: four supports `spacing` apart, back to front in `order` from `start`. The spacing is chosen so the loop's last
 * carry sets the short support down on the 47/48 hammerhead (301.04 m), 13 spacings past the back support's start, which
 * also leaves A in its normal place for the normal move. Each time round, the trolley turns the
 * back one lengthwise, carries it over the others to `spacing` past the front one and turns it across (it lands on the
 * girders' middle line by itself), and the trusses advance `spacing` with the trolley parked over the front long support.
 * The trusses line up again only when the short support stands in the middle two, so it never holds them during a swing.
 */
const LOOP = { order: ["B", "S", "A", "C"], start: 89.5, spacing: (301.04 - 89.5) / 13, times: 10 };

/**
 * From the end of the loop to where the normal move takes over: the short support is on the 47/48 hammerhead (the loop's
 * last carry put it there) and A in its normal place (the loop left it there too); B and C go back behind A. They don't
 * have to be in placeGantry()'s exact places: the normal move picks them up where they stand.
 */
const EXIT = [
  { op: "carry", who: "C", to: 242.0, turnFirst: true, turnLast: true },
  { op: "carry", who: "B", to: 264.0 },
  { op: "trusses", R: 205.6, anchor: "B" },
  { op: "carry", who: "B", to: 224.0, turnFirst: true, turnLast: true },
];

/** The span the walk ends on: the last double girder span, where the normal move takes over. */
const WALK_ENDS_ON = { 41: 47 };
/** Half the trusses' length (tip to tip), in metres: the trusses' middle stands over the third support from the back. */
const HALF_TRUSSES = 103.93 / 2;

/** The loop's steps, one carry and one advance each time round. */
function loopSteps() {
  const { order, start, spacing, times } = LOOP,
    at = Object.fromEntries(order.map((n, i) => [n, start + i * spacing])),
    roles = [...order],
    steps = [];
  let R = at[roles[2]] - HALF_TRUSSES;
  for (let k = 1; k <= times; k++) {
    const back = roles.shift(),
      to = at[roles[roles.length - 1]] + spacing;
    steps.push({ op: "carry", who: back, to, turnFirst: true, turnLast: true });
    at[back] = to;
    roles.push(back);
    R += spacing;
    const anchor = [...roles].reverse().find((n) => n !== "S"),
      s = roles.indexOf("S");
    steps.push({ op: "trusses", R, anchor, align: s > 0 && s < roles.length - 1 });
  }
  return steps;
}

/**
 * Plays the crossing on from the first move (span S, about to build S + 1) and snaps the gantry onto the last double girder
 * span for the normal move.
 * @returns {Promise<boolean>} true when it played, so playToEnd() goes on with the normal move.
 */
export async function playWalk(m) {
  const last = WALK_ENDS_ON[m.S];
  if (!last) return false;
  return playSteps(m, [...ENTRY, ...loopSteps(), ...EXIT], last);
}
