// The start of a walk over the double girder spans (from span 41 or 50, about to build 42 or 51): the supports are set
// where the crews had them on Nov. 19 at span 41 (placeNowLayout()), and the walk (walk.js) plays from there. See
// docs/double-girder/README.md.

import { gantryMoves, placeGantry, stackSupports } from "../../lib/placeGantry.js";
import { UNITS_PER_METRE } from "../../lib/layerSwitches.js";
import { DOUBLE_GIRDER } from "../../lib/doubleGirder.js";
import { SPEED, pause, setInstant } from "./clock.js";
import { girderEdges } from "./guideway.js";
import { between, centreIn } from "./measure.js";
import { holders } from "./holders.js";
import { playWalk, walkPartWay } from "./walk.js";
import { playFirstHalf, startMove } from "./normalMove.js";
import { STEPS, markStep } from "../../lib/animationMark.js";

/**
 * Where Support B is craned to, and how far its wheels slide along it. Its beam is centred across the two double girders of
 * the span after the one about to be built (midway between their outer edges, as placeGantry() measures them for a support
 * set across a double girder), at the front support's place along the guideway (N.front.to); its two wheel assemblies are
 * centred on the unfinished span about to be built (N.body.to). Measured before anything moves.
 * @returns The place for B's middle on the map (`cAim`) and the slide of its wheels on the map (`wheelShift`; zero when the
 * girders can't be found, with B going to N.front.to).
 */
function aimC(m) {
  const { svg, gantry, S, N } = m;
  const plain = { cAim: N.front.to, wheelShift: { x: 0, y: 0 } };
  const girders = gantryMoves(svg, S, S + 2)?.spans[S + 2];
  if (!girders) return plain;
  const dot = (a, b) => a.x * b.x + a.y * b.y,
    sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y }),
    v = girders.v;
  const edges = girderEdges(svg, gantry, girders);
  if (!edges) return plain;
  const { edge0, edge1 } = edges;
  // the girders' middle across, from the span's middle; B goes to that line, at N.front.to along the guideway
  const middleAcross = dot(sub(girders.c, N.front.to), v) + (edge0 + edge1) / 2,
    cAim = { x: N.front.to.x + v.x * middleAcross, y: N.front.to.y + v.y * middleAcross },
    wheels = dot(sub(N.body.to, cAim), v);
  return { cAim, wheelShift: { x: v.x * wheels, y: v.y * wheels } };
}

/**
 * Slides Support A's wheel assemblies (or another slider's, by its data-anchor) along its beam by `by` (a move on the map),
 * in `ms`. The supports' groups already use `translate` for their slides, so the wheels' own rects are moved instead, in
 * their group's frame as it lies now.
 */
function slideAWheels(m, by, ms, anchor = "second") {
  return Promise.all(
    [...m.gantry.querySelectorAll(`:scope > [data-anchor="${anchor}"] > .gantry-support-wheels`)].map((w) => {
      const fromMap = between(w.parentNode, m.svg).inverse(),
        to = `${fromMap.a * by.x + fromMap.c * by.y}px ${fromMap.b * by.x + fromMap.d * by.y}px`;
      return w.animate([{ translate: "0px 0px" }, { translate: to }], {
        duration: ms / SPEED,
        easing: "ease-in-out",
        fill: "forwards",
      }).finished;
    }),
  );
}

/** How long B takes to fly across from the back to the double girders (a mobile crane lifts it; the crane isn't drawn). */
const B_FLY_TIME = 5000;

/** The gap between the short support's beam and A's on Nov. 19, the short support behind (Mike: 15 ft). */
const SHORT_GAP_METRES = 15 * 0.3048;

/**
 * Where the crews had the supports on Nov. 19, from span 41, put there at once (no animation): A and C in their places half
 * way through the normal move (after its steps 10 and 4), the short support off its long blue legs, standing across the
 * guideway 15 ft behind A (SHORT_GAP_METRES), and B (lifted there by a mobile crane, which isn't drawn) across the two double girders at the
 * front support's place on the next span (cAim), its deck facing west and its wheel assemblies on the unfinished span
 * (wheelShift). The trusses and the trolley stay where placeGantry() put them.
 * With `animate` (a walk started from the span itself, not part way through it), it is played instead: the normal move's
 * steps 1 to 10 for C and A, then B flies across from the back (B_FLY_TIME); the trolley carries the short support back
 * afterwards, as the walk's first step (playWalk()'s carryShort). The legs coming off isn't drawn (seen from above).
 */
async function placeNowLayout(m, animate = false) {
  const { svg, gantry, N, nearest, small, fourthAngle, secondAngle, thirdAngle, frontAngle, middle, S } = m;
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  // C: the normal move's steps 3 and 4 (the same turns, so it lies the way it does there)
  const turn3 = nearest(secondAngle + N.second.turn - fourthAngle, -90),
    turn4 = turn3 + nearest(thirdAngle + N.rear.turn - (fourthAngle + turn3), 0);
  const moves = [];
  if (animate) await playFirstHalf(m);
  else moves.push(m.moveFourth({ ...sub(N.rear.to, middle), turn: turn4 }, 0));
  // A: the normal move's steps 6 to 10 end with it on N.second.to, turned by step 7's and step 9's turns about its middle
  const carryAngle = fourthAngle + (DOUBLE_GIRDER.has(S - 1) ? 90 : 0),
    sideways = nearest(carryAngle - secondAngle, 90),
    aTurn = sideways + nearest(N.second.turn - sideways, -90);
  if (!animate) moves.push(m.second.by(0, 0, sub(N.second.to, m.secondStart)));
  if (!animate && Math.abs(aTurn) > 0.01) moves.push(m.second.swing(N.second.to, aTurn, 0));
  // the short support: across the guideway as it stood at the front, slid back to SHORT_GAP_METRES behind A. It stood with
  // its rear edge against the joint and A's front edge is against it now, so the gap between the two beams is how far
  // past A's middle its middle is now, less the two halves (the same distance), plus the gap
  const onward = m.along(m.ahead),
    unit = { x: onward.x / Math.hypot(onward.x, onward.y), y: onward.y / Math.hypot(onward.x, onward.y) },
    ahead = sub(m.frontStart, N.second.to),
    back = (ahead.x * unit.x + ahead.y * unit.y) * 2 + SHORT_GAP_METRES * UNITS_PER_METRE;
  if (!animate) moves.push(m.front.by(0, 0, { x: -unit.x * back, y: -unit.y * back }));
  // B: across the girders at cAim, at the front support's angle there, its deck on the forward (west) side (which side
  // its deck is on, measured from its middle before it moves)
  const deck = gantry.querySelector(':scope > [data-anchor="rear"] > .gantry-support-walkway'),
    d0 = deck ? sub(centreIn(deck, svg), m.thirdStart) : { x: 0, y: 0 },
    fwd = m.along(m.ahead),
    base = small(frontAngle + N.front.turn - thirdAngle),
    forward = (t) => {
      const r = (t * Math.PI) / 180;
      return (d0.x * Math.cos(r) - d0.y * Math.sin(r)) * fwd.x + (d0.x * Math.sin(r) + d0.y * Math.cos(r)) * fwd.y > 0;
    },
    bTurn = [base, base + 180, base - 180].filter(forward).sort((a, b) => Math.abs(a) - Math.abs(b))[0] ?? base;
  // flying, B is drawn over the rest of the gantry
  if (animate) stackSupports(svg, ["rear"]);
  if (animate) markStep(S, STEPS.FLY_B);
  const fly = animate ? B_FLY_TIME : 0;
  moves.push(m.third.by(0, fly, sub(m.cAim, m.thirdStart)), m.third.swing(m.cAim, bTurn, fly));
  // the moves take effect once they have started; the wheels are slid in B's frame as it lies then
  await Promise.all(moves);
  await slideAWheels(m, m.wheelShift, animate ? 1000 : 0, "rear");
  if (animate) await pause(500);
  stackSupports(svg);
}

/**
 * The start of a walk, from span 41 or 50, or from a span part way through one (walkPartWay() in walk.js): the
 * supports set in the Nov. 19 layout, then the walk.
 * @param {SVGSVGElement} svg The map's <svg>, after placeGantry() has put the gantry on its span.
 * @param {{ pose?: boolean }} [options] pose: only set the gantry where the walk has it on a span part way through one
 * (poseGantry()), with no time, and stop there.
 * @returns {Promise<boolean>} true when the walk played and handed over to the normal move; false with `pose`, or when the
 * drawing has no gantry or no next span for placeGantry's rules to find.
 */
export async function startWalk(svg, { pose = false } = {}) {
  // part way through a walk (spans 42 to 47): the gantry is set up from the span the walk started on, see-through, and
  // its steps the crews have already made play with no time (walkPartWay in walk.js). With `pose`, only that, all of it
  // with no time, to show the gantry where the crews have it (poseGantry()); the gantry keeps status.yaml's span
  const gantry = svg.querySelector("#clayton-clipper"),
    span = gantry?.dataset.span,
    partWay = walkPartWay(+span);
  if (pose && !partWay) return false;
  if (pose) setInstant(true);
  if (partWay) {
    // anything an earlier pose left on the pieces goes first
    gantry.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    gantry.style.opacity = "0";
    gantry.dataset.span = partWay.from;
    placeGantry(svg);
  }
  try {
    const m = await startMove(svg);
    if (!m) return false;
    Object.assign(m, aimC(m));
    holders(m, "second", "front"); // TEMP
    // a walk starts where the crews had the supports on Nov. 19 at span 41 (placeNowLayout; the same at span 50); the
    // walk goes on from there
    // from the span itself (not part way through), the way into it is played; part way through, it is set at once
    await placeNowLayout(m, !partWay);
    return await playWalk(m, partWay?.done, pose, !partWay);
  } finally {
    // a stop during the set-up leaves nothing see-through or played with no time
    gantry.style.opacity = "";
    setInstant(false);
    if (pose) gantry.dataset.span = span;
  }
}
