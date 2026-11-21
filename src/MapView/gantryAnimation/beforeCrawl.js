// The move before a crawl (the gantry on span 29, 41 or 50, about to move to 30, 42 or 51): the same as the normal move
// up to step 3, with the trolley carrying Support C. From there it differs: the trolley carries C forward, with the
// span, instead of backing up, and sets it down behind the front support. See docs/double-girder/1-before-the-crawl.md.
// Work in progress: it ends with the fill of the span the gantry is now on, with no snap to the next span.

import { gantryMoves, placeGantry, stackSupports } from "../../lib/placeGantry.js";
import { UNITS_PER_METRE } from "../../lib/layerSwitches.js";
import { DOUBLE_GIRDER } from "../../lib/doubleGirder.js";
import { SPEED, nextSpeed, pause } from "./clock.js";
import { clearHangers } from "./fill.js";
import { girderEdges } from "./guideway.js";
import { playCrawl } from "./crawl.js";
import { cMiddle, slideC, swingC } from "./supports.js";
import { between, centreIn, halfLength, reachIn } from "./measure.js";
import { holders } from "./holders.js"; // TEMP
import { playWalk } from "./walk.js";
import {
  startMove,
  step0FillSpan,
  step18TrolleyToThirdSupport,
  step19TurnThirdSupportLengthwise,
  step22TrussesPastFrontSupport,
  step23TurnTrussesOntoNextSpan,
  step24SlideTrussesToNextSpan,
  step25TrolleyToMiddleSupportAndSlideRest,
  step1TrolleyToFourthSupport,
  step2CarryFourthSupportForward,
  step3TurnFourthSupport,
} from "./normalMove.js";

/** The spans the gantry is on when it makes this move (before the crawl over span 31, spans 43 to 47 and spans 52 to 54). */
export const BEFORE_CRAWL = new Set([29, 41, 50]);

/**
 * The front support's trip: forward this far, turned lengthwise, back far enough to have room to turn across again, and
 * placed behind C.
 */
const FORWARD_METRES = 6;
/** How far the short support (the front support) is carried back before it turns, in metres. */
const SHORT_BACK_METRES = 12;
/** Where the short support is carried to, in metres in from the rear end of the unfinished span about to be built. */
const SHORT_INTO_SPAN_METRES = 12;
/** The span whose front end (joint) the short support is moved to, by the span the gantry is on (the tulip or hammerhead past the crawl). */
const SHORT_JOINT = { 29: 32, 41: 48, 50: 55 };
/** How far ahead of the front support (the shorter one) Support B is carried in step 20, in metres. */
const B_AHEAD_METRES = 12;
/** How far behind B, in metres, Support A is carried on the rear lifting jacks before the trolley takes it. */
const A_FROM_B_METRES = 12;
/** How much room, in metres, it keeps between its sweep as it turns and C's rear edge, on top of half its length. */
const SPIN_CLEARANCE_METRES = 1.5;
/** How far back, in metres, the front support is carried from where it was picked up. */
const CARRY_BACK_METRES = 15.5;
/** How much of the trusses' length (tip to tip) overhangs past the front end of the span the gantry is on, in step 14. */
const OVERHANG_SHARE = 0.1;
/** How far forward, in metres, the trolley carries A in step 16 before it turns lengthwise. */
const A_FORWARD_METRES = 4;
/** How far across the span behind the one the gantry is on (back end to front end) B's middle is carried in step 5. */
const B_INTO_SPAN_SHARE = 0.2;
/**
 * How far across that span the trolley then carries B, in step 14b, before A is moved. Not in step 5: with B that far
 * forward, the trusses' middle would be behind B at the end of step 13, and the gantry would tip.
 */
const B_CRANE_SHARE = 0.8;
/** The closest the trolley may come to a rear blue tip, as a share of the tip's length (as in the normal move's step 24). */
const TIP_GAP_SHARE = 0.5;
/** How much further forward than the normal move's step 2 leaves it, in metres, C is carried in step 2. */
const C_FURTHER_METRES = 4;
/** How far, in metres, the trusses slide forward in step 33, after B is moved onto the span the gantry is on. */
const TRUSSES_FORWARD_METRES = 14;
/**
 * The gap, in metres, left between C's beam and A's when C is set down behind A in step 25: none, so they touch and C
 * stands as far forward as it can (span 42 is a 12-segment span, so the gap to it is kept as short as it can be).
 */
const C_A_GAP_METRES = 0;
/** How far behind C's rear edge, in metres, the front support is set down. */
const SET_DOWN_GAP_METRES = 1;
/**
 * Where C is carried to, lengthwise, before it turns across, in metres from the rear end of the span the gantry is on: far
 * enough from A behind it and the short support ahead of it that its ends clear both as it turns.
 */
const C_TURNS_AT_METRES = 19.5;
/**
 * Where the short support is set down (lengthwise, then turned across as the rear holder), in metres behind the rear end
 * of the span the gantry is on. Found with a model of the move, with the tipping margin kept at 3.93 or more.
 */
const SHORT_REAR_METRES = 26;
/**
 * Where the rear lifting jacks set the short support down after the swing, in metres behind the rear end of the span the
 * gantry is on: as far forward as they carry it before the trolley fetches it.
 */
const SHORT_DROP_METRES = 20.5;

/**
 * Step 4: the trolley carries the fourth support (Support C) forward and sets it down behind the front support, its front
 * edge against the front support's rear edge, turned to the same angle as the front support. The front support hasn't
 * moved yet, so it is where it is drawn.
 */
async function step4SetCBehindFrontSupport(m) {
  console.log("[gantry] before the crawl, step 4: SetCBehindFrontSupport"); // TEMP
  const { truss, beam, frontBeam, frontStart, ahead, moveTrolley, moveFourth, nearest, alongOf, along } = m;
  const { fourthAngle, frontAngle, middle } = m;
  // how thick each support is along the trusses (both lie across the guideway now): when they touch, their middles are
  // half of each apart
  const thick = (el) => {
    const r = reachIn(el, truss);
    return r.hi - r.lo;
  };
  const gap = (thick(frontBeam) + thick(beam)) / 2;
  // kept for the steps that place the front support behind C
  m.gapCF = gap;
  m.thickC = thick(beam);
  m.thickF = thick(frontBeam);
  // where C is set down (its middle on the map), for the step that puts B there later
  m.cPlace = { x: frontStart.x - along(ahead * gap).x, y: frontStart.y - along(ahead * gap).y };
  // the front support's middle on the map, less that distance along the trusses, as a move from where C started
  const back = along(-ahead * gap),
    to = { x: frontStart.x + back.x - middle.x, y: frontStart.y + back.y - middle.y };
  await Promise.all([
    moveTrolley(m.trolleyY + alongOf({ x: to.x - m.fourth.x, y: to.y - m.fourth.y }), 3000),
    moveFourth({ ...to, turn: m.fourth.turn + nearest(frontAngle - (fourthAngle + m.fourth.turn), 0) }, 3000),
  ]);
  await pause(500);
}

/**
 * Step 5: the crane move starts: the trolley slides on its own to stop over the middle of the front support. The trusses
 * haven't moved, so it is measured as step 1 does.
 */
async function step5TrolleyToFrontSupport(m) {
  console.log("[gantry] before the crawl, step 5: TrolleyToFrontSupport"); // TEMP
  const { frontAt, trolleyAt, trusses, moveTrolley } = m;
  await moveTrolley(frontAt.y - trolleyAt.y - trusses.at, 3000);
  await pause(500);
}

/** A distance in metres as truss units along the trusses (one truss unit is a map move of along(1)), forward positive. */
const alongMetres = (m, metres) => (m.ahead * metres * UNITS_PER_METRE) / Math.hypot(m.along(1).x, m.along(1).y);

/** Where the front support's middle is on the map now: where it started, slid along the trusses. */
const frontMiddle = (m) => {
  const slid = m.along(m.front.at);
  return { x: m.frontStart.x + slid.x, y: m.frontStart.y + slid.y };
};

/**
 * Step 6: the trolley picks up the front support and carries it forward along the trusses, FORWARD_METRES. It doesn't turn.
 * The trolley is over it, so they move together.
 */
async function step6CarryFrontSupportForward(m) {
  console.log("[gantry] before the crawl, step 6: CarryFrontSupportForward"); // TEMP
  const trip = alongMetres(m, FORWARD_METRES);
  await Promise.all([m.moveTrolley(m.trolleyY + trip, 2500), m.front.by(trip, 2500)]);
  await pause(500);
}

/**
 * Step 7: the front support turns a quarter turn counter-clockwise about its own middle, to lie lengthwise (a negative
 * turn on the map, where y points down). It is drawn above the supports that lie across the trusses while it is carried.
 */
async function step7TurnFrontSupportLengthwise(m) {
  console.log("[gantry] before the crawl, step 7: TurnFrontSupportLengthwise"); // TEMP
  stackSupports(m.svg, ["front"]);
  await m.front.swing(frontMiddle(m), -90, 2000);
  await pause(500);
}

/**
 * Step 8: the trolley carries the front support back along the trusses, over C, until it has room to turn across again: its
 * middle is half its length (plus SPIN_CLEARANCE_METRES) behind C's rear edge, so the ends of the support sweep clear of C.
 */
async function step8CarryFrontSupportBack(m) {
  console.log("[gantry] before the crawl, step 8: CarryFrontSupportBack"); // TEMP
  const { frontBeam, svg, frontAt, front, ahead, gapCF, thickC, along } = m;
  const trussUnit = Math.hypot(along(1).x, along(1).y),
    halfLong = halfLength(frontBeam, svg) / trussUnit,
    cMiddle = frontAt.y - ahead * gapCF,
    spinAt = cMiddle - ahead * (thickC / 2 + halfLong + alongMetres(m, SPIN_CLEARANCE_METRES) * ahead),
    trip = spinAt - (frontAt.y + front.at);
  await Promise.all([m.moveTrolley(m.trolleyY + trip, 3500), front.by(trip, 3500)]);
  await pause(500);
}

/** Step 9: the front support turns a quarter turn clockwise about its own middle, across the guideway again. */
async function step9TurnFrontSupportAcross(m) {
  console.log("[gantry] before the crawl, step 9: TurnFrontSupportAcross"); // TEMP
  await m.front.swing(frontMiddle(m), 90, 2000);
  // it lies across the trusses now, so it goes back under the supports that are lengthwise
  stackSupports(m.svg);
  await pause(500);
}

/**
 * Step 10: the trolley carries the front support the rest of the way and sets it down behind C, SET_DOWN_GAP_METRES from
 * C's rear edge. C is behind the front support's first place by gapCF (half of each one's thickness), and this one is the
 * same distance again behind C, less the gap: it slides forward to it from where it turned.
 */
async function step10SetFrontSupportBehindC(m) {
  console.log("[gantry] before the crawl, step 10: SetFrontSupportBehindC"); // TEMP
  const target = m.frontAt.y - 2 * m.ahead * m.gapCF - alongMetres(m, SET_DOWN_GAP_METRES),
    rest = target - (m.frontAt.y + m.front.at);
  if (m.unseen(Math.abs(rest) * Math.hypot(m.along(1).x, m.along(1).y))) return;
  await Promise.all([m.moveTrolley(m.trolleyY + rest, 2500), m.front.by(rest, 2500)]);
  await pause(500);
}

/**
 * Step 11: the trolley slides back on its own to stop over the middle of Support A (the second support), where it stays
 * while the trusses move: the same as the normal move's step 11, with A as the target. A hasn't moved in this move, so it is
 * where it is drawn, and the trusses haven't moved either.
 */
async function step11TrolleyBackToSupportA(m) {
  console.log("[gantry] before the crawl, step 11: TrolleyBackToSupportA"); // TEMP
  const { secondAt, trolleyAt, trusses, moveTrolley } = m;
  await moveTrolley(secondAt.y - trolleyAt.y - trusses.at, 3000);
  await pause(500);
}

/**
 * Where Support C goes on the next span, and how far its wheels slide along it. Its beam is centred across the two double
 * girders of the span after the one about to be built (midway between their outer edges, as placeGantry() measures them for a
 * support set across a double girder), at the front support's place along the guideway (N.front.to); its two wheel
 * assemblies are centred on the unfinished span about to be built (N.body.to). Measured before anything moves.
 * @returns The place for C's middle on the map (`cAim`), the slide of its wheels on the map (`wheelShift`; zero when the
 * girders can't be found, with C going to N.front.to as normal), the unfinished span's rear end and direction
 * (`unfinished`), and the joint the short support is moved to (`joint`: its place on the map, span direction and across
 * direction; undefined when the drawing has none).
 */
function aimC(m) {
  const { svg, gantry, S, N } = m;
  const plain = { cAim: N.front.to, wheelShift: { x: 0, y: 0 } };
  const far = gantryMoves(svg, S, S + 2)?.spans;
  const girders = far?.[S + 2];
  if (!girders) return plain;
  // the unfinished span about to be built: where its rear end is, and which way it runs
  const unfinished = { back: far[S + 1].ends.back, u: far[S + 1].u };
  // the joint the short support is moved to (the end of span SHORT_JOINT), on the unfinished guideway, with the span's
  // direction and across direction there
  const jointSpan = SHORT_JOINT[S] && gantryMoves(svg, S, SHORT_JOINT[S] + 1)?.spans[SHORT_JOINT[S]];
  const joint = jointSpan && { at: jointSpan.ends.front, u: jointSpan.u, v: jointSpan.v };
  plain.unfinished = unfinished;
  plain.joint = joint;
  const dot = (a, b) => a.x * b.x + a.y * b.y,
    sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y }),
    v = girders.v;
  const edges = girderEdges(svg, gantry, girders);
  if (!edges) return plain;
  const { edge0, edge1 } = edges;
  // the girders' middle across, from the span's middle; C goes to that line, at N.front.to along the guideway
  const middleAcross = dot(sub(girders.c, N.front.to), v) + (edge0 + edge1) / 2,
    cAim = { x: N.front.to.x + v.x * middleAcross, y: N.front.to.y + v.y * middleAcross },
    wheels = dot(sub(N.body.to, cAim), v);
  return { cAim, wheelShift: { x: v.x * wheels, y: v.y * wheels }, unfinished, joint };
}

/** Slides Support C's wheel assemblies along the beam by `by` (a move on the map), in `ms`. */
function slideCWheels(m, by, ms) {
  const fromMap = between(m.gantry, m.svg).inverse(),
    to = `${fromMap.a * by.x + fromMap.c * by.y}px ${fromMap.b * by.x + fromMap.d * by.y}px`;
  return Promise.all(
    [...m.gantry.querySelectorAll(':scope > [data-anchor="fourth"]')]
      .filter((g) => g.querySelector(":scope > .gantry-support-wheels"))
      .map(
        (g) =>
          g.animate([{ translate: "0px 0px" }, { translate: to }], {
            duration: ms / SPEED,
            easing: "ease-in-out",
            fill: "forwards",
          }).finished,
      ),
  );
}

/**
 * Where the snap to the next span puts the trolley, on the map. The gantry is placed on the next span and put back, and the
 * trolley's middle is measured in between. Nothing is left moved: placeGantry() starts from the drawn position each time.
 */
function trolleyAfterSnap(m) {
  const { svg, gantry, trolley, S } = m;
  gantry.dataset.span = S + 1;
  placeGantry(svg);
  const after = centreIn(trolley, svg);
  gantry.dataset.span = S;
  placeGantry(svg);
  return { x: after.x, y: after.y };
}

/**
 * Steps 12 to 17 are the normal move's steps 12 to 17 with other supports: Support C is picked up and carried to the front
 * support's place on the next span (N.front.to), Support B rides on the rear lifting jacks, and the trusses pivot about
 * the front support, where it stands (set down behind C's first place in step 10). The trolley is anchored over Support A.
 */

/** Step 12: the trusses slide back to pick up Support C: until the front tip is over C's middle (nudged by PICKUP). */
async function step12TrussesBackForC(m) {
  console.log("[gantry] before the crawl, step 12: TrussesBackForC"); // TEMP
  const { beamAt, tipAt, PICKUP, trusses, moveTrolley, alongOf } = m;
  // where C is along the trusses: where it started plus how far it has gone (its moves are kept as x, y on the map)
  const cAt = beamAt.y + alongOf(m.fourth),
    back = cAt - tipAt.y + PICKUP;
  await Promise.all([trusses.by(back, 3000), moveTrolley(m.trolleyY - back, 3000)]);
  await pause(500);
  Object.assign(m, { back });
}

/** Step 13: the trusses carry Support C forward, the first part of its trip. */
async function step13CarryCForward(m) {
  console.log("[gantry] before the crawl, step 13: CarryCForward"); // TEMP
  const { gantry, truss, thirdAt, ahead, moveTrolley, trusses, N, one, alongOf, back } = m;
  // C's trip, as the normal move's front support's: after the swing in step 15 it has to be on its place (cAim). The swing turns
  // it about the pivot (the front support, where it stands) without changing its distance from it, so first it slides to the point
  // on its slide line that is as far from the pivot as its place (cAim) is.
  const pivot = frontMiddle(m),
    cStart = cMiddle(m),
    cTo = m.cAim,
    w = { x: cStart.x - pivot.x, y: cStart.y - pivot.y },
    qa = one.x * one.x + one.y * one.y,
    qb = 2 * (w.x * one.x + w.y * one.y),
    qc = w.x * w.x + w.y * w.y - ((cTo.x - pivot.x) ** 2 + (cTo.y - pivot.y) ** 2),
    root = Math.sqrt(Math.max(0, qb * qb - 4 * qa * qc)),
    plain = alongOf({ x: cTo.x - cStart.x, y: cTo.y - cStart.y }),
    cTrip = [(-qb + root) / (2 * qa), (-qb - root) / (2 * qa)].reduce((a, b) =>
      Math.abs(b - plain) < Math.abs(a - plain) ? b : a,
    ),
    // Support B rides along for the end of the trip: from when the rear tips reach it
    rearTipAt = [...gantry.querySelectorAll(".clipper-tip")]
      .map((t) => centreIn(t, truss))
      .reduce((a, b) => (ahead * b.y < ahead * a.y ? b : a)),
    reached = (thirdAt.y - (rearTipAt.y + ahead * m.PICKUP) - back) / cTrip,
    alone = cTrip * Math.min(1, Math.max(0, reached)),
    ride = cTrip - alone;
  // the trolley stays still over Support A, moved back inside the trusses as they go forward
  await Promise.all([trusses.by(alone, 2500), slideC(m, alone, 2500), moveTrolley(m.trolleyY - alone, 2500)]);
  await pause(500);
  Object.assign(m, { cTo, ride, pivot });
}

/** Step 14: the rest of C's trip, with Support B riding along on the rear lifting jacks. */
async function step14FinishCTrip(m) {
  console.log("[gantry] before the crawl, step 14: FinishCTrip"); // TEMP
  const { moveTrolley, trusses, third, ride } = m;
  await Promise.all([
    trusses.by(ride, 1500),
    slideC(m, ride, 1500),
    third.by(ride, 1500),
    moveTrolley(m.trolleyY - ride, 1500),
  ]);
  await pause(500);
}

/** Step 15: the trusses pivot about the front support and swing, carrying C to its place. B swings with them as a counterweight. */
async function step15SwingTrussesWithC(m) {
  console.log("[gantry] before the crawl, step 15: SwingTrussesWithC"); // TEMP
  const { unseen, trusses, third, deg, small, pivot, cTo } = m;
  const c = cMiddle(m),
    turn = small(deg({ x: cTo.x - pivot.x, y: cTo.y - pivot.y }) - deg({ x: c.x - pivot.x, y: c.y - pivot.y })),
    swingArc = (Math.hypot(cTo.x - pivot.x, cTo.y - pivot.y) * Math.abs(turn) * Math.PI) / 180,
    swings = !unseen(swingArc);
  if (swings) {
    await Promise.all([trusses.swing(pivot, turn, 3000), swingC(m, pivot, turn, 3000), third.swing(pivot, turn, 3000)]);
    await pause(500);
  }
  Object.assign(m, { turn, swings });
}

/** Step 16: the trusses and B swing back, and C turns about its own middle to the angle it has on the next span. */
async function step16SwingTrussesBackFromC(m) {
  console.log("[gantry] before the crawl, step 16: SwingTrussesBackFromC"); // TEMP
  const { svg, beam, unseen, trusses, third, N, pivot, turn, swings } = m;
  const cEnds = (halfLength(beam, svg) * Math.abs(N.front.turn - turn) * Math.PI) / 180,
    cSeen = !unseen(cEnds);
  await Promise.all([
    ...(swings ? [trusses.swing(pivot, -turn, 3000), third.swing(pivot, -turn, 3000)] : []),
    m.moveFourth({ ...m.fourth, turn: m.fourth.turn + N.front.turn - turn }, cSeen || swings ? 3000 : 0),
  ]);
  if (swings || cSeen) await pause(500);
}

/**
 * Step 17: the trusses slide back until their middle is halfway between the front support (now set down behind C's first
 * place, where the normal move has C) and Support A. The trolley stays still over A. C's wheel assemblies slide along its
 * beam to the unfinished span's middle (see aimC), starting 500 ms after the trusses.
 */
async function step17TrussesToHalfway(m) {
  console.log("[gantry] before the crawl, step 17: TrussesToHalfway"); // TEMP
  const { frontAt, front, secondAt, trussMiddleY, trusses, moveTrolley } = m;
  const halfway = (frontAt.y + front.at + secondAt.y) / 2,
    toMiddle = halfway - (trussMiddleY + trusses.at);
  await Promise.all([
    trusses.by(toMiddle, 3000),
    moveTrolley(m.trolleyY - toMiddle, 3000),
    // C's wheels wait 500 ms after the trusses start to move back, and finish with them
    pause(500).then(() => slideCWheels(m, m.wheelShift, 2500)),
  ]);
  await pause(500);
}

/**
 * Step 20: the trolley carries Support B (lengthwise since step 19) forward along the trusses until its middle is
 * B_AHEAD_METRES ahead of the front support's middle (the shorter support, set down behind C's first place in step 10).
 * It doesn't turn or move sideways.
 */
async function step20CarryBAheadOfFrontSupport(m) {
  console.log("[gantry] before the crawl, step 20: CarryBAheadOfFrontSupport"); // TEMP
  const { frontAt, front, thirdAt, third, moveTrolley } = m;
  const trip = frontAt.y + front.at + alongMetres(m, B_AHEAD_METRES) - (thirdAt.y + third.at);
  await Promise.all([third.by(trip, 3500), moveTrolley(m.trolleyY + trip, 3500)]);
  await pause(500);
}

/**
 * Step 21: Support B turns a quarter turn about its own middle the opposite way to its turn in step 19 (m.thirdTurn), so it
 * lies across the guideway again. It goes back under the supports that lie lengthwise.
 */
async function step21TurnBBack(m) {
  console.log("[gantry] before the crawl, step 21: TurnBBack"); // TEMP
  const { svg, third, thirdStart, thirdTurn, along } = m;
  const slid = along(third.at);
  await third.swing({ x: thirdStart.x + slid.x, y: thirdStart.y + slid.y }, -Math.sign(thirdTurn) * 90, 2000);
  stackSupports(svg);
  await pause(500);
}

/**
 * Step 22: the trolley backs up with Support B and sets it down where C was set down in step 4, in front of the front support
 * (the short one). The trip is split as in the normal move's step 20: the part along the trusses, which the trolley follows,
 * and what is left over, a small move sideways that only the support makes.
 */
async function step22SetBWhereCWas(m) {
  console.log("[gantry] before the crawl, step 22: SetBWhereCWas"); // TEMP
  const { third, thirdStart, cPlace, along, alongOf, moveTrolley } = m;
  const now = along(third.at),
    gap = { x: cPlace.x - (thirdStart.x + now.x), y: cPlace.y - (thirdStart.y + now.y) },
    trip = alongOf(gap),
    straight = along(trip),
    sideways = { x: gap.x - straight.x, y: gap.y - straight.y };
  await Promise.all([third.by(trip, 3500, sideways), moveTrolley(m.trolleyY + trip, 3500)]);
  await pause(500);
}

/**
 * Step 23: the trolley slides on its own to stop over the middle of Support A, where it is parked for the next steps (the
 * normal move's step 21, with A). A hasn't moved, and the trusses are where step 17 left them.
 */
async function step23TrolleyToSupportA(m) {
  console.log("[gantry] before the crawl, step 23: TrolleyToSupportA"); // TEMP
  const { secondBeam, truss, trolleyAt, moveTrolley } = m;
  // measured on the trusses as they lie now, whatever they have done so far
  await moveTrolley(centreIn(secondBeam, truss).y - trolleyAt.y, 2500);
  await pause(500);
}

/**
 * Step 24: the trolley slides on its own to stop over the middle of the short support (the front support, set down behind
 * C's first place in step 10). Its place is measured in the truss frame as it is now, after the trusses' moves.
 */
async function step24TrolleyToShortSupport(m) {
  console.log("[gantry] before the crawl, step 24: TrolleyToShortSupport"); // TEMP
  const { frontBeam, truss, trolleyAt, moveTrolley } = m;
  await moveTrolley(centreIn(frontBeam, truss).y - trolleyAt.y, 2500);
  await pause(500);
}

/** Step 25: the trolley picks up the short support and carries it back along the trusses, SHORT_BACK_METRES. */
async function step25CarryShortSupportBack(m) {
  console.log("[gantry] before the crawl, step 25: CarryShortSupportBack"); // TEMP
  const trip = -alongMetres(m, SHORT_BACK_METRES);
  await Promise.all([m.moveTrolley(m.trolleyY + trip, 3500), m.front.by(trip, 3500)]);
  await pause(500);
}

/**
 * Step 26: the short support turns a quarter turn counter-clockwise about its own middle, to lie lengthwise, as in step 7.
 * The trolley keeps holding it.
 */
async function step26TurnShortSupportLengthwise(m) {
  console.log("[gantry] before the crawl, step 26: TurnShortSupportLengthwise"); // TEMP
  stackSupports(m.svg, ["front"]);
  await m.front.swing(frontMiddle(m), -90, 2000);
  stackSupports(m.svg);
  await pause(500);
}

/**
 * Step 27: the trolley carries the short support (lengthwise) forward along the trusses until its middle is
 * SHORT_INTO_SPAN_METRES in from the rear end of the unfinished span about to be built. Only along the trusses: the
 * support's own sideways offset isn't corrected.
 */
async function step27CarryShortSupportIntoSpan(m) {
  console.log("[gantry] before the crawl, step 27: CarryShortSupportIntoSpan"); // TEMP
  const { unfinished, alongOf, moveTrolley, front } = m;
  if (!unfinished) return;
  const into = SHORT_INTO_SPAN_METRES * UNITS_PER_METRE,
    target = { x: unfinished.back.x + unfinished.u.x * into, y: unfinished.back.y + unfinished.u.y * into },
    now = frontMiddle(m),
    trip = alongOf({ x: target.x - now.x, y: target.y - now.y });
  await Promise.all([moveTrolley(m.trolleyY + trip, 3500), front.by(trip, 3500)]);
  await pause(500);
}

/**
 * Step 28: the short support is moved at once to the joint at the end of span SHORT_JOINT (48/49 for the move from 41): the
 * flatbed and the crane that lift it there aren't drawn. It lies across the guideway on the west side of the joint (the
 * side of the next span, as spans are numbered westward), its edge against the joint, centred across on the unfinished
 * guideway. The trolley is left where it is.
 */
async function step28MoveShortSupportToJoint(m) {
  console.log("[gantry] before the crawl, step 28: MoveShortSupportToJoint"); // TEMP
  const { svg, front, joint, thickF, frontAngle, deg, nearest } = m;
  if (!joint) return;
  const half = (thickF * Math.hypot(m.along(1).x, m.along(1).y)) / 2,
    target = { x: joint.at.x + joint.u.x * half, y: joint.at.y + joint.u.y * half },
    now = frontMiddle(m);
  // it lies lengthwise now (turned -90 from where it was drawn across the guideway): the turn that puts it across the
  // guideway there is the one nearest to none from the angle across the span, measured from how it lies now
  const across = nearest(deg(joint.v) - (frontAngle - 90), 0);
  await front.by(0, 0, { x: target.x - now.x, y: target.y - now.y });
  await front.swing(target, across, 0);
  stackSupports(svg);
}

/**
 * Step 29: the trolley drives to the place the snap in step 28 gives it on the map (trolleyAfterSnap, measured when the move
 * starts), as near as it can get along the trusses. Nothing else is moved.
 */
async function step29TrolleyToSnapPlace(m) {
  console.log("[gantry] before the crawl, step 29: TrolleyToSnapPlace"); // TEMP
  const { svg, truss, trolley, trolleyAfterSnap } = m;
  const now = centreIn(trolley, svg),
    on = between(truss, svg),
    drive = ((trolleyAfterSnap.x - now.x) * on.c + (trolleyAfterSnap.y - now.y) * on.d) / (on.c * on.c + on.d * on.d);
  await m.moveTrolley(m.trolleyY + drive, 3000);
  await pause(1000);
}

/** Where a piece's middle is along the trusses now, in the truss frame as it is now (it moves with the trusses). */
const yNow = (m, el) => centreIn(el, m.truss).y;

/**
 * Where the rear lifting jacks are along the trusses, in the truss frame: PICKUP past the rear tip's middle, outwards,
 * mirroring the front jacks (the trusses go back for a support until the front tip's middle is PICKUP short of it).
 */
function rearJackY(m) {
  const tips = [...m.gantry.querySelectorAll(".clipper-tip")].map((t) => centreIn(t, m.truss).y),
    rearTip = m.ahead > 0 ? Math.min(...tips) : Math.max(...tips);
  return rearTip + m.ahead * m.PICKUP;
}

/** Step 30: the trolley slides on its own to stop over the middle of Support C, where it stays while the trusses move. */
async function step30TrolleyToC(m) {
  console.log("[gantry] before the crawl, step 30: TrolleyToC"); // TEMP
  await m.moveTrolley(yNow(m, m.beam) - m.trolleyAt.y, 2500);
  await pause(500);
}

/**
 * Step 31: the trusses slide so their rear tips (the blue tips at the rear end) are over Support A. The trolley stays still
 * over C (moved back inside the trusses as they go).
 */
async function step31RearTipsToA(m) {
  console.log("[gantry] before the crawl, step 31: RearTipsToA"); // TEMP
  const { trusses, moveTrolley, secondBeam } = m;
  const d = yNow(m, secondBeam) - rearJackY(m);
  await Promise.all([trusses.by(d, 3000), moveTrolley(m.trolleyY - d, 3000)]);
  await pause(500);
}

/**
 * Step 32: A is lifted by the rear lifting jacks and the trusses carry it forward, along the trusses, until it is
 * A_FROM_B_METRES behind B (middle to middle). The trolley stays still over C.
 */
async function step32CarryAOnJacks(m) {
  console.log("[gantry] before the crawl, step 32: CarryAOnJacks"); // TEMP
  const { ahead, trusses, second, moveTrolley, secondBeam, thirdBeam } = m;
  const d = yNow(m, thirdBeam) - ahead * Math.abs(alongMetres(m, A_FROM_B_METRES)) - yNow(m, secondBeam);
  await Promise.all([trusses.by(d, 3500), second.by(d, 3500), moveTrolley(m.trolleyY - d, 3500)]);
  await pause(500);
}

/** Step 33: the trolley slides on its own to stop over the middle of A. */
async function step33TrolleyToA(m) {
  console.log("[gantry] before the crawl, step 33: TrolleyToA"); // TEMP
  await m.moveTrolley(yNow(m, m.secondBeam) - m.trolleyAt.y, 2500);
  await pause(500);
}

/** Step 34: A turns a quarter turn counter-clockwise about its own middle, to lie lengthwise (as in step 7). */
async function step34TurnALengthwise(m) {
  console.log("[gantry] before the crawl, step 34: TurnALengthwise"); // TEMP
  const { svg, second, secondBeam } = m;
  stackSupports(svg, ["second"]);
  await second.swing(centreIn(secondBeam, svg), -90, 2000);
  await pause(500);
}

/** Step 35: the trolley carries A along the trusses to halfway between B and C. */
async function step35CarryAHalfwayBetweenBAndC(m) {
  console.log("[gantry] before the crawl, step 35: CarryAHalfwayBetweenBAndC"); // TEMP
  const { second, moveTrolley, secondBeam, thirdBeam, beam } = m;
  const d = (yNow(m, thirdBeam) + yNow(m, beam)) / 2 - yNow(m, secondBeam);
  await Promise.all([second.by(d, 3500), moveTrolley(m.trolleyY + d, 3500)]);
  await pause(500);
}

/** Step 36: A turns a quarter turn clockwise about its own middle, across the guideway again, and is left there. */
async function step36TurnAAcross(m) {
  console.log("[gantry] before the crawl, step 36: TurnAAcross"); // TEMP
  const { svg, second, secondBeam } = m;
  await second.swing(centreIn(secondBeam, svg), 90, 2000);
  // it lies across the trusses now, so it goes back under the supports that are lengthwise
  stackSupports(svg);
  await pause(500);
}

/**
 * Step 4: the trolley stays anchored over C (where step 3 turned it) while the trusses slide back until their rear tips
 * (the rear lifting jacks) are over Support B's middle.
 */
async function step4RearJacksBackToB(m) {
  console.log("[gantry] before the crawl, step 4: RearJacksBackToB"); // TEMP
  const { trusses, moveTrolley, thirdBeam } = m;
  const d = yNow(m, thirdBeam) - rearJackY(m);
  await Promise.all([trusses.by(d, 3000), moveTrolley(m.trolleyY - d, 3000)]);
  await pause(500);
}

/**
 * Step 5: the rear lifting jacks pick up B and the trusses carry it forward along the trusses until its middle is
 * B_INTO_SPAN_SHARE of the way across the span behind the one the gantry is on (span 40 for the move from 41), and set it
 * down. The trolley stays still over C.
 */
async function step5CarryBIntoSpanBehind(m) {
  console.log("[gantry] before the crawl, step 5: CarryBIntoSpanBehind"); // TEMP
  const { trusses, third, moveTrolley } = m;
  const d = bTripIntoSpanBehind(m, B_INTO_SPAN_SHARE);
  if (d == null) return;
  await Promise.all([trusses.by(d, 3500), third.by(d, 3500), moveTrolley(m.trolleyY - d, 3500)]);
  await pause(500);
}

/**
 * How far B has to go along the trusses (truss units) for its middle to be `share` of the way across the span behind the
 * one the gantry is on (back end to front end); undefined when the drawing has no such span.
 */
function bTripIntoSpanBehind(m, share) {
  const { svg, truss, S, thirdBeam } = m;
  const behind = gantryMoves(svg, S, S)?.spans[S - 1];
  if (!behind) return;
  const { back, front } = behind.ends,
    target = { x: back.x + (front.x - back.x) * share, y: back.y + (front.y - back.y) * share },
    toTruss = between(truss, svg).inverse();
  return toTruss.b * target.x + toTruss.d * target.y + toTruss.f - yNow(m, thirdBeam);
}

/** Step 14a: the trolley slides on its own to stop over the middle of B, wherever it was last set down. */
async function step14aTrolleyToB(m) {
  console.log("[gantry] before the crawl, step 14a: TrolleyToB"); // TEMP
  await m.moveTrolley(yNow(m, m.thirdBeam) - m.trolleyAt.y, 2500);
  await pause(500);
}

/** Step 12: the trusses slide back until the front tip is over the front support's middle (nudged by PICKUP), ready to pick it up. A stays under the trolley. */
async function step12TrussesBackForFrontSupport(m) {
  console.log("[gantry] before the crawl, step 12: TrussesBackForFrontSupport"); // TEMP
  const { frontAt, tipAt, PICKUP, trusses, moveTrolley } = m;
  // less the trusses' slide so far (steps 4 and 5): tipAt was measured before they moved
  const back = frontAt.y - tipAt.y + PICKUP - trusses.at;
  await Promise.all([trusses.by(back, 3000), moveTrolley(m.trolleyY - back, 3000)]);
  await pause(500);
}

/**
 * Step 13: the front lifting jacks pick up the front support and the trusses carry it back, CARRY_BACK_METRES, and set it
 * down. It doesn't turn. The trolley stays still over A (moved forward inside the trusses as they go back).
 */
async function step13CarryFrontSupportBack(m) {
  console.log("[gantry] before the crawl, step 13: CarryFrontSupportBack"); // TEMP
  const trip = -alongMetres(m, CARRY_BACK_METRES);
  await Promise.all([m.trusses.by(trip, 4000), m.front.by(trip, 4000), m.moveTrolley(m.trolleyY - trip, 4000)]);
  await pause(500);
}

/**
 * Step 14: the trusses slide forward until OVERHANG_SHARE of their length (tip to tip) overhangs past the front end of the
 * span the gantry is on (the finished span). The trolley stays still (moved back inside the trusses as they go forward).
 */
async function step14TrussesOverhangFinishedSpan(m) {
  console.log("[gantry] before the crawl, step 14: TrussesOverhangFinishedSpan"); // TEMP
  const { svg, gantry, truss, ahead, S, trusses, moveTrolley } = m;
  // the front end of the finished span: the rear end of the span after it
  const end = gantryMoves(svg, S, S + 1)?.spans[S + 1]?.ends.back;
  if (!end) return;
  // the tips are fixed in the truss frame; the span's end is put into it as the trusses lie now
  const tips = [...gantry.querySelectorAll(".clipper-tip")].map((t) => centreIn(t, truss).y),
    length = Math.max(...tips) - Math.min(...tips),
    frontTip = ahead > 0 ? Math.max(...tips) : Math.min(...tips),
    toTruss = between(truss, svg).inverse(),
    endY = toTruss.b * end.x + toTruss.d * end.y + toTruss.f,
    d = endY + ahead * OVERHANG_SHARE * length - frontTip;
  await Promise.all([trusses.by(d, 3500), moveTrolley(m.trolleyY - d, 3500)]);
  await pause(500);
}

/** Where Support A's middle is on the map now. */
const aMiddle = (m) => centreIn(m.secondBeam, m.svg);

/**
 * Step 14b: the trolley picks up B and carries it forward along the trusses until its middle is B_CRANE_SHARE of the way
 * across the span behind the one the gantry is on, and sets it down. It doesn't turn.
 */
async function step14bCarryBFurtherIntoSpan(m) {
  console.log("[gantry] before the crawl, step 14b: CarryBFurtherIntoSpan"); // TEMP
  const d = bTripIntoSpanBehind(m, B_CRANE_SHARE);
  if (d == null) return;
  await Promise.all([m.third.by(d, 3500), m.moveTrolley(m.trolleyY + d, 3500)]);
  await pause(500);
}

/** Step 15: the trolley slides on its own back from B to stop over the middle of Support A. */
async function step15TrolleyToA(m) {
  console.log("[gantry] before the crawl, step 15: TrolleyToA"); // TEMP
  await m.moveTrolley(yNow(m, m.secondBeam) - m.trolleyAt.y, 2500);
  await pause(500);
}

/** Step 16: the trolley picks up A and carries it forward along the trusses, A_FORWARD_METRES, still across the guideway. */
async function step16CarryAForward(m) {
  console.log("[gantry] before the crawl, step 16: CarryAForward"); // TEMP
  const d = alongMetres(m, A_FORWARD_METRES);
  await Promise.all([m.second.by(d, 2500), m.moveTrolley(m.trolleyY + d, 2500)]);
  await pause(500);
}

/** Step 17: A turns a quarter turn clockwise about its own middle, to lie lengthwise. */
async function step17TurnALengthwise(m) {
  console.log("[gantry] before the crawl, step 17: TurnALengthwise"); // TEMP
  stackSupports(m.svg, ["second"]);
  await m.second.swing(aMiddle(m), 90, 2000);
  await pause(500);
}

/**
 * Step 18: the trolley carries A, lengthwise, to its final place at the front edge of the span the gantry is on: where the
 * normal move puts it, its place on the next span (N.second.to), its front edge flush with the end of the span once it is
 * turned across. A long support can't stand on the bare tulip past it. The trip is split as in step 22: the part along
 * the trusses, which the trolley follows, and a small move sideways that only A makes.
 */
async function step18CarryAToEdgeOfSpan(m) {
  console.log("[gantry] before the crawl, step 18: CarryAToEdgeOfSpan"); // TEMP
  const { N, along, alongOf, moveTrolley } = m;
  const a = aMiddle(m),
    gap = { x: N.second.to.x - a.x, y: N.second.to.y - a.y },
    trip = alongOf(gap),
    straight = along(trip),
    sideways = { x: gap.x - straight.x, y: gap.y - straight.y };
  await Promise.all([m.second.by(trip, 3500, sideways), moveTrolley(m.trolleyY + trip, 3500)]);
  await pause(500);
}

/**
 * Step 19: A turns another quarter turn clockwise about its own middle, across the guideway again but facing the other way
 * (half a turn in all, so its deck faces the other way: it takes over the front support's role), to the angle it has on the
 * next span (its turn on the move, N.second.turn, as in the normal move), and is set down.
 */
async function step19TurnAAcross(m) {
  console.log("[gantry] before the crawl, step 19: TurnAAcross"); // TEMP
  await m.second.swing(aMiddle(m), m.N.second.turn + 90, 2000);
  // it lies across the trusses now, so it goes back under the supports that are lengthwise
  stackSupports(m.svg);
  await pause(500);
}

/** Step 21: the trolley picks up the short support and turns it a quarter turn clockwise about its own middle, to lie lengthwise. */
async function step21TurnShortSupportLengthwise(m) {
  console.log("[gantry] before the crawl, step 21: TurnShortSupportLengthwise"); // TEMP
  stackSupports(m.svg, ["front"]);
  await m.front.swing(frontMiddle(m), 90, 2000);
  await pause(500);
}

/**
 * How far back along the trusses (truss units, never negative) the trolley may still go: until its rear edge is
 * TIP_GAP_SHARE of a tip's length from the inner edge of the rear tips, the limit the normal move's step 24 keeps.
 */
function trolleyRearRoom(m) {
  const { gantry, truss, trolley, ahead, trussMiddleY } = m;
  const tipReaches = [...gantry.querySelectorAll(".clipper-tip")].map((t) => reachIn(t, truss)),
    tipLength = tipReaches[0].hi - tipReaches[0].lo,
    rearTips = tipReaches.filter((r) => ahead * (r.lo + r.hi) < ahead * 2 * trussMiddleY),
    tipInner = ahead > 0 ? Math.max(...rearTips.map((r) => r.hi)) : Math.min(...rearTips.map((r) => r.lo)),
    trolleyReach = reachIn(trolley, truss),
    gapNow = ahead * ((ahead > 0 ? trolleyReach.lo : trolleyReach.hi) - tipInner);
  return Math.max(0, gapNow - Math.round(tipLength * TIP_GAP_SHARE));
}

/**
 * Step 22: the trolley carries the short support back along the trusses as far as it may go: until its rear edge is
 * TIP_GAP_SHARE of a tip's length from the inner edge of the rear tips, the limit the normal move's step 24 keeps.
 */
async function step22CarryShortSupportToRearLimit(m) {
  console.log("[gantry] before the crawl, step 22: CarryShortSupportToRearLimit"); // TEMP
  const d = -m.ahead * trolleyRearRoom(m);
  await Promise.all([m.front.by(d, 3500), m.moveTrolley(m.trolleyY + d, 3500)]);
  await pause(500);
}

/** Step 23: the short support turns a quarter turn counter-clockwise about its own middle, across the guideway again. */
async function step23TurnShortSupportAcross(m) {
  console.log("[gantry] before the crawl, step 23: TurnShortSupportAcross"); // TEMP
  await m.front.swing(frontMiddle(m), -90, 2000);
  // it lies across the trusses now, so it goes back under the supports that are lengthwise
  stackSupports(m.svg);
  await pause(500);
}

/**
 * How far a support reaches along the trusses as it lies now, all of it (beam, blue deck and wheels): the lowest and
 * highest y, in the truss frame, of all the groups with its data-anchor.
 */
function supportReach(m, anchor) {
  const reaches = [...m.gantry.querySelectorAll(`:scope > [data-anchor="${anchor}"]`)].map((g) => reachIn(g, m.truss));
  return { lo: Math.min(...reaches.map((r) => r.lo)), hi: Math.max(...reaches.map((r) => r.hi)) };
}

/**
 * Step 25: the trolley picks up C and carries it along the trusses until it is just behind A: its beam's front edge
 * C_A_GAP_METRES behind A's beam's rear edge (the beams themselves, not the blue decks). It doesn't turn.
 */
async function step25SetCBehindA(m) {
  console.log("[gantry] before the crawl, step 25: SetCBehindA"); // TEMP
  const { ahead, moveTrolley, truss } = m;
  const a = reachIn(m.secondBeam, truss),
    c = reachIn(m.beam, truss),
    aRear = ahead > 0 ? a.lo : a.hi,
    cFront = ahead > 0 ? c.hi : c.lo,
    d = aRear - alongMetres(m, C_A_GAP_METRES) - cFront;
  await Promise.all([slideC(m, d, 3000), moveTrolley(m.trolleyY + d, 3000)]);
  await pause(500);
}

/**
 * Step 26: the trolley is parked over B while the trusses slide back until the front tip (the front lifting jacks) is over
 * A's middle, nudged by PICKUP as in step 12.
 */
async function step26TrussesBackForA(m) {
  console.log("[gantry] before the crawl, step 26: TrussesBackForA"); // TEMP
  const { gantry, truss, ahead, PICKUP, trusses, moveTrolley, secondBeam } = m;
  const tips = [...gantry.querySelectorAll(".clipper-tip")].map((t) => centreIn(t, truss).y),
    frontTip = ahead > 0 ? Math.max(...tips) : Math.min(...tips),
    d = yNow(m, secondBeam) - frontTip + PICKUP;
  await Promise.all([trusses.by(d, 3500), moveTrolley(m.trolleyY - d, 3500)]);
  await pause(500);
}

/**
 * Step 27: the front lifting jacks pick up A and the trusses carry it forward until their rear tips (the rear lifting
 * jacks) are over the short support's middle. The trolley stays still over B.
 */
async function step27CarryAToRearJacksOverShortSupport(m) {
  console.log("[gantry] before the crawl, step 27: CarryAToRearJacksOverShortSupport"); // TEMP
  const { trusses, second, moveTrolley, frontBeam } = m;
  const d = yNow(m, frontBeam) - rearJackY(m);
  await Promise.all([trusses.by(d, 3500), second.by(d, 3500), moveTrolley(m.trolleyY - d, 3500)]);
  await pause(500);
}

/**
 * Slides Support A's wheel assemblies (or another slider's, by its data-anchor) along its beam by `by` (a move on the map),
 * in `ms`, as slideCWheels() does for C. A's groups already use `translate` for their slides, so the wheels' own rects are
 * moved instead, in their group's frame as it lies now.
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

/**
 * Step 28: the rear lifting jacks pick up the short support, and the trusses carry it and A (on the front lifting jacks)
 * forward, as the normal move's steps 13 and 14 carry the front support. The trusses will pivot about C, where it stands
 * at the front edge of the span the gantry is on, and the swing in step 29 doesn't change A's distance from C, so A first
 * slides to the point on its slide line that is as far from C as its place across the two double girders (cAim, see
 * aimC). The trolley stays still over B.
 */
async function step28CarryAToSwingPoint(m) {
  console.log("[gantry] before the crawl, step 28: CarryAToSwingPoint"); // TEMP
  const { one, alongOf, trusses, second, front, moveTrolley, cAim } = m;
  const pivot = cMiddle(m),
    aStart = aMiddle(m),
    w = { x: aStart.x - pivot.x, y: aStart.y - pivot.y },
    qa = one.x * one.x + one.y * one.y,
    qb = 2 * (w.x * one.x + w.y * one.y),
    qc = w.x * w.x + w.y * w.y - ((cAim.x - pivot.x) ** 2 + (cAim.y - pivot.y) ** 2),
    root = Math.sqrt(Math.max(0, qb * qb - 4 * qa * qc)),
    plain = alongOf({ x: cAim.x - aStart.x, y: cAim.y - aStart.y }),
    trip = [(-qb + root) / (2 * qa), (-qb - root) / (2 * qa)].reduce((a, b) =>
      Math.abs(b - plain) < Math.abs(a - plain) ? b : a,
    );
  await Promise.all([
    trusses.by(trip, 3500),
    second.by(trip, 3500),
    front.by(trip, 3500),
    moveTrolley(m.trolleyY - trip, 3500),
  ]);
  await pause(500);
  Object.assign(m, { aPivot: pivot });
}

/**
 * Step 29: the trusses pivot about C and swing, carrying A to its place across the two double girders (cAim), as the
 * normal move's step 15. The short support swings with them on the rear lifting jacks.
 */
async function step29SwingTrussesWithA(m, withShort = true) {
  console.log("[gantry] before the crawl, step 29: SwingTrussesWithA"); // TEMP
  const { trusses, second, front, deg, small, aPivot: pivot, cAim } = m;
  const a = aMiddle(m),
    turn = small(deg({ x: cAim.x - pivot.x, y: cAim.y - pivot.y }) - deg({ x: a.x - pivot.x, y: a.y - pivot.y })),
    // always played unless there is no turn at all: A's place across the girders is a small move sideways that unseen()
    // would skip, and close up it shows (A was left off-centre)
    swings = Math.abs(turn) > 1e-6;
  if (swings) {
    await Promise.all([
      trusses.swing(pivot, turn, 3000),
      second.swing(pivot, turn, 3000),
      ...(withShort ? [front.swing(pivot, turn, 3000)] : []),
    ]);
    await pause(500);
  }
  Object.assign(m, { aSwing: turn, aSwings: swings });
}

/**
 * Step 30: A is set down across the two double girders. The trusses and the short support swing back, A turns about its
 * own middle to the front support's angle on the next span (its deck still facing the way step 19 turned it), and its
 * wheel assemblies slide along its beam to the unfinished span's middle (wheelShift, see aimC), as the normal move's step
 * 16 and the old step 17 did for C.
 */
async function step30SetADownAcrossGirders(m, withShort = true) {
  console.log("[gantry] before the crawl, step 30: SetADownAcrossGirders"); // TEMP
  const { trusses, front, second, N, nearest, frontAngle, secondAngle, aPivot: pivot, aSwing: turn, aSwings } = m;
  // A's long side lies at its starting angle plus its turns so far (half a turn in steps 17 and 19, which nearest()
  // ignores, plus N.second.turn) and the swing
  const aTurn = nearest(frontAngle + N.front.turn - (secondAngle + N.second.turn + turn), 0);
  await Promise.all([
    ...(aSwings ? [trusses.swing(pivot, -turn, 3000), ...(withShort ? [front.swing(pivot, -turn, 3000)] : [])] : []),
    second.swing(aMiddle(m), aTurn, 3000),
    pause(500).then(() => slideAWheels(m, m.wheelShift, 2500)),
  ]);
  await pause(500);
}

/**
 * Step 31: the trusses back up until their middle is halfway between C and the short support (middle to middle, along
 * the trusses), leaving the short support where step 30 set it down. The trolley stays still.
 */
async function step31TrussesBetweenCAndShortSupport(m) {
  console.log("[gantry] before the crawl, step 31: TrussesBetweenCAndShortSupport"); // TEMP
  const { trussMiddleY, trusses, moveTrolley, beam, frontBeam } = m;
  // the trusses' middle is fixed in their own frame; C and the short support are measured in it as it lies now
  const d = (yNow(m, beam) + yNow(m, frontBeam)) / 2 - trussMiddleY;
  await Promise.all([trusses.by(d, 3500), moveTrolley(m.trolleyY - d, 3500)]);
  await pause(500);
}

/**
 * Step 32: the trolley picks up B and carries it forward along the trusses until it is fully on the span the gantry is on
 * (span 41 for the move from 41): the rear edge of the whole support (blue deck and wheels too) flush with the span's back
 * end. It doesn't turn.
 */
async function step32CarryBOntoSpan(m) {
  console.log("[gantry] before the crawl, step 32: CarryBOntoSpan"); // TEMP
  const { svg, truss, S, ahead, third, moveTrolley } = m;
  const back = gantryMoves(svg, S, S)?.spans[S]?.ends.back;
  if (!back) return;
  const toTruss = between(truss, svg).inverse(),
    backY = toTruss.b * back.x + toTruss.d * back.y + toTruss.f,
    b = supportReach(m, "rear"),
    d = backY - (ahead > 0 ? b.lo : b.hi);
  await Promise.all([third.by(d, 3500), moveTrolley(m.trolleyY + d, 3500)]);
  await pause(500);
}

/** Step 33: the trusses slide forward TRUSSES_FORWARD_METRES. The trolley stays still over B. */
async function step33TrussesForward(m) {
  console.log("[gantry] before the crawl, step 33: TrussesForward"); // TEMP
  const d = alongMetres(m, TRUSSES_FORWARD_METRES);
  await Promise.all([m.trusses.by(d, 3500), m.moveTrolley(m.trolleyY - d, 3500)]);
  await pause(500);
}

/**
 * Step 34: the trolley carries the short support (lengthwise since step 21) forward along the trusses until its middle is
 * halfway between B's and C's, and sets it down there, still lengthwise.
 */
async function step34SetShortSupportBetweenBAndC(m) {
  console.log("[gantry] before the crawl, step 34: SetShortSupportBetweenBAndC"); // TEMP
  const { front, moveTrolley, thirdBeam, beam, frontBeam } = m;
  const d = (yNow(m, thirdBeam) + yNow(m, beam)) / 2 - yNow(m, frontBeam);
  await Promise.all([front.by(d, 3500), moveTrolley(m.trolleyY + d, 3500)]);
  await pause(500);
}

/**
 * Step 35: the trusses slide forward until their middle is halfway between C and A (middle to middle, along the
 * trusses). The trolley stays still over B until it reaches its rear limit on the trusses (see trolleyRearRoom); then,
 * as in the normal move's steps 24 to 26, the trusses stop, the trolley drives to C, and the trusses slide the rest of the
 * way with the trolley still over C.
 */
async function step35TrussesBetweenCAndA(m) {
  console.log("[gantry] before the crawl, step 35: TrussesBetweenCAndA"); // TEMP
  const { ahead, trussMiddleY, trusses, moveTrolley, beam, secondBeam } = m;
  const d = (yNow(m, beam) + yNow(m, secondBeam)) / 2 - trussMiddleY,
    // a slide forward moves the trolley back along the trusses by as much; one back has no limit here
    first = ahead * d > 0 ? Math.sign(d) * Math.min(trolleyRearRoom(m), Math.abs(d)) : d,
    rest = d - first;
  if (first) {
    await Promise.all([
      trusses.by(first, 3500 * Math.abs(first / d)),
      moveTrolley(m.trolleyY - first, 3500 * Math.abs(first / d)),
    ]);
    await pause(500);
  }
  if (Math.abs(rest) > 1e-6) {
    console.log("[gantry] before the crawl, step 35b: TrolleyToCAndSlideRest"); // TEMP
    holders(m, "fourth", "second"); // TEMP
    await m.moveTrolley(yNow(m, beam) - m.trolleyAt.y, 2500);
    await pause(500);
    await Promise.all([
      trusses.by(rest, 3500 * Math.abs(rest / d)),
      moveTrolley(m.trolleyY - rest, 3500 * Math.abs(rest / d)),
    ]);
    await pause(500);
  }
}

// THE SHORTER SEQUENCE (plan steps P1 to P30). Each support travels as few times as the rules allow: C forward once, the
// short support back once to be the rear holder and then to its last place, A once to the edge of the span, B once onto
// the span. The trusses go back once for A, carry it forward and swing, and go forward once to the end.

/** Where a point `metres` along the span the gantry is on (from its rear end, forward positive) is in the truss frame, along y. */
function yAtMetres(m, metres) {
  const { svg, truss, S } = m;
  const span = gantryMoves(svg, S, S)?.spans[S];
  if (!span) return null;
  const k = metres * UNITS_PER_METRE,
    p = { x: span.ends.back.x + span.u.x * k, y: span.ends.back.y + span.u.y * k },
    toTruss = between(truss, svg).inverse();
  return toTruss.b * p.x + toTruss.d * p.y + toTruss.f;
}

/**
 * How far forward along the trusses (truss units, never negative) the trolley may still go: until its front edge is
 * TIP_GAP_SHARE of a tip's length from the inner edge of the front tips, the rear limit (trolleyRearRoom) mirrored.
 */
function trolleyFrontRoom(m) {
  const { gantry, truss, trolley, ahead, trussMiddleY } = m;
  const tipReaches = [...gantry.querySelectorAll(".clipper-tip")].map((t) => reachIn(t, truss)),
    tipLength = tipReaches[0].hi - tipReaches[0].lo,
    frontTips = tipReaches.filter((r) => ahead * (r.lo + r.hi) > ahead * 2 * trussMiddleY),
    tipInner = ahead > 0 ? Math.min(...frontTips.map((r) => r.lo)) : Math.max(...frontTips.map((r) => r.hi)),
    trolleyReach = reachIn(trolley, truss),
    gapNow = ahead * (tipInner - (ahead > 0 ? trolleyReach.hi : trolleyReach.lo));
  return Math.max(0, gapNow - Math.round(tipLength * TIP_GAP_SHARE));
}

/** P2: the trolley carries C, lengthwise, forward along the trusses to C_TURNS_AT_METRES. */
async function p4CarryCToTurningPlace(m) {
  console.log("[gantry] before the crawl, P2: CarryCToTurningPlace"); // TEMP
  const target = yAtMetres(m, C_TURNS_AT_METRES);
  if (target == null) return;
  stackSupports(m.svg, ["fourth"]);
  const d = target - yNow(m, m.beam);
  await Promise.all([slideC(m, d, 3500), m.moveTrolley(m.trolleyY + d, 3500)]);
  await pause(500);
}

/**
 * P4: the trolley stays still over C while the trusses slide back as far as they can with the short support still in
 * the trolley's reach (just inside its front limit). B, at the rear, comes under the trusses as the rear holder.
 */
async function p4TrussesBackKeepingShortInReach(m) {
  console.log("[gantry] before the crawl, P4: TrussesBackKeepingShortInReach"); // TEMP
  const { ahead, truss, trolley, trusses, moveTrolley } = m;
  // the trolley's front limit is fixed on the trusses; the short support, on the ground, moves forward along them as
  // they go back
  const limit = centreIn(trolley, truss).y + ahead * trolleyFrontRoom(m),
    d = yNow(m, m.frontBeam) - limit;
  if (ahead * d >= 0) return;
  await Promise.all([trusses.by(d, 3500), moveTrolley(m.trolleyY - d, 3500)]);
  await pause(500);
}

/** P8: the trolley carries the short support, lengthwise, back over A and C to SHORT_REAR_METRES behind the span. */
async function p8CarryShortSupportToRear(m) {
  console.log("[gantry] before the crawl, P8: CarryShortSupportToRear"); // TEMP
  const target = yAtMetres(m, -SHORT_REAR_METRES);
  if (target == null) return;
  const d = target - yNow(m, m.frontBeam);
  await Promise.all([m.front.by(d, 4000), m.moveTrolley(m.trolleyY + d, 4000)]);
  await pause(500);
}

/**
 * P16 to P18: the trusses slide back until the front tip (the front lifting jacks) is over A's middle, nudged by PICKUP.
 * The trolley stays still over C until it reaches its front limit on the trusses (see trolleyFrontRoom), then drives to B,
 * and the trusses slide the rest of the way with the trolley still over B.
 */
async function p16TrussesBackForA(m) {
  console.log("[gantry] before the crawl, P16: TrussesBackForA"); // TEMP
  const { gantry, truss, ahead, PICKUP, trusses, moveTrolley, secondBeam } = m;
  const tips = [...gantry.querySelectorAll(".clipper-tip")].map((t) => centreIn(t, truss).y),
    frontTip = ahead > 0 ? Math.max(...tips) : Math.min(...tips),
    d = yNow(m, secondBeam) - frontTip + PICKUP,
    // a slide back moves the trolley forward along the trusses by as much
    first = ahead * d < 0 ? Math.sign(d) * Math.min(trolleyFrontRoom(m), Math.abs(d)) : d,
    rest = d - first;
  if (first) {
    await Promise.all([
      trusses.by(first, 3500 * Math.abs(first / d)),
      moveTrolley(m.trolleyY - first, 3500 * Math.abs(first / d)),
    ]);
    await pause(500);
  }
  if (Math.abs(rest) > 1e-6) {
    console.log("[gantry] before the crawl, P17-18: TrolleyToBAndSlideRest"); // TEMP
    await step14aTrolleyToB(m);
    await Promise.all([
      trusses.by(rest, 3500 * Math.abs(rest / d)),
      moveTrolley(m.trolleyY - rest, 3500 * Math.abs(rest / d)),
    ]);
    await pause(500);
  }
}

/** Where B's middle is on the map now. */
const bMiddle = (m) => centreIn(m.thirdBeam, m.svg);

/**
 * P19: the trolley picks up B and turns it a quarter turn clockwise about its own middle, to lie lengthwise. First it notes
 * how far B's middle is from its rear edge (blue deck included) while it lies across, for P20.
 */
async function p19TurnBLengthwise(m) {
  console.log("[gantry] before the crawl, P19: TurnBLengthwise"); // TEMP
  const b = supportReach(m, "rear");
  m.bMiddleFromRear = m.ahead * (yNow(m, m.thirdBeam) - (m.ahead > 0 ? b.lo : b.hi));
  stackSupports(m.svg, ["rear"]);
  await m.third.swing(bMiddle(m), 90, 2000);
  await pause(500);
}

/**
 * P20: the trolley carries B, lengthwise, over the short support onto the span the gantry is on: to where, once it is
 * turned across again, the rear edge of the whole support is flush with the span's rear end.
 */
async function p20CarryBOntoSpan(m) {
  console.log("[gantry] before the crawl, P20: CarryBOntoSpan"); // TEMP
  const back = yAtMetres(m, 0);
  if (back == null) return;
  const d = back + m.ahead * m.bMiddleFromRear - yNow(m, m.thirdBeam);
  await Promise.all([m.third.by(d, 4000), m.moveTrolley(m.trolleyY + d, 4000)]);
  await pause(500);
}

/** P21: B turns a quarter turn counter-clockwise about its own middle, across the guideway again, and is set down. */
async function p21TurnBAcross(m) {
  console.log("[gantry] before the crawl, P21: TurnBAcross"); // TEMP
  await m.third.swing(bMiddle(m), -90, 2000);
  stackSupports(m.svg);
  await pause(500);
}

/**
 * P22-P23: the front lifting jacks pick up A and the trusses carry it to the swing point, as step 28 works it out (A
 * slides to the point on its slide line that is as far from C, the pivot, as its place across the girders). The trolley
 * stays still over B the whole time: it doesn't move while a lifting jack holds a support out over open air. When the
 * rear tips reach the short support, the rear lifting jacks pick it up and it rides the rest of the way (and through the
 * swing, without holding the trusses up).
 */
async function p22CarryAToSwingPoint(m) {
  console.log("[gantry] before the crawl, P22: CarryAToSwingPoint"); // TEMP
  const { one, alongOf, ahead, trusses, second, front, moveTrolley, cAim } = m;
  const pivot = cMiddle(m),
    aStart = aMiddle(m),
    w = { x: aStart.x - pivot.x, y: aStart.y - pivot.y },
    qa = one.x * one.x + one.y * one.y,
    qb = 2 * (w.x * one.x + w.y * one.y),
    qc = w.x * w.x + w.y * w.y - ((cAim.x - pivot.x) ** 2 + (cAim.y - pivot.y) ** 2),
    root = Math.sqrt(Math.max(0, qb * qb - 4 * qa * qc)),
    plain = alongOf({ x: cAim.x - aStart.x, y: cAim.y - aStart.y }),
    trip = [(-qb + root) / (2 * qa), (-qb - root) / (2 * qa)].reduce((a, b) =>
      Math.abs(b - plain) < Math.abs(a - plain) ? b : a,
    ),
    // the slide that brings the rear lifting jacks over the short support's middle (on the ground, it moves back along the
    // trusses as they go forward)
    toShort = yNow(m, m.frontBeam) - rearJackY(m),
    reaches = ahead * toShort >= 0 && ahead * toShort < ahead * trip,
    first = reaches ? toShort : trip,
    rest = trip - first;
  const time = (d) => 4500 * Math.abs(d / trip);
  await Promise.all([
    trusses.by(first, time(first)),
    second.by(first, time(first)),
    moveTrolley(m.trolleyY - first, time(first)),
  ]);
  if (reaches && rest) {
    console.log("[gantry] before the crawl, P21b: RearJacksTakeShortSupport"); // TEMP
    holders(m, "rear", "fourth"); // TEMP
    await pause(500);
    await Promise.all([
      trusses.by(rest, time(rest)),
      second.by(rest, time(rest)),
      front.by(rest, time(rest)),
      moveTrolley(m.trolleyY - rest, time(rest)),
    ]);
  }
  await pause(500);
  Object.assign(m, { aPivot: pivot, shortRides: reaches });
}

/**
 * P23: with A set down, the rear lifting jacks (still holding the short support) carry it forward along the trusses to
 * SHORT_DROP_METRES behind the span and set it down; the trolley stays still over B.
 */
async function p23RearJacksCarryShortForward(m) {
  console.log("[gantry] before the crawl, P23: RearJacksCarryShortForward"); // TEMP
  if (!m.shortRides) return;
  const target = yAtMetres(m, -SHORT_DROP_METRES);
  if (target == null) return;
  const d = target - yNow(m, m.frontBeam);
  if (m.ahead * d <= 0) return;
  await Promise.all([m.trusses.by(d, 2500), m.front.by(d, 2500), m.moveTrolley(m.trolleyY - d, 2500)]);
  await pause(500);
}

/**
 * P26: with A set down, the trusses slide back (the trolley still over B) until the short support, set down by the rear
 * lifting jacks, is just inside the trolley's reach.
 */
async function p26TrussesBackForShortSupport(m) {
  console.log("[gantry] before the crawl, P26: TrussesBackForShortSupport"); // TEMP
  const { ahead, truss, trolley, trusses, moveTrolley } = m;
  // the trolley's rear limit is fixed on the trusses; the short support moves forward along them as they go back
  const limit = centreIn(trolley, truss).y - ahead * trolleyRearRoom(m),
    d = Math.min(0, ahead * (yNow(m, m.frontBeam) - limit)) * ahead;
  if (!d) return;
  await Promise.all([trusses.by(d, 3000), moveTrolley(m.trolleyY - d, 3000)]);
  await pause(500);
}

/** The gap between the short support's beam and A's on Nov. 19, the short support behind (Mike: 15 ft). */
const SHORT_GAP_METRES = 15 * 0.3048;

/**
 * Where the crews had the supports on Nov. 19, from span 41, put there at once (no animation): A and C in their places half
 * way through the normal move (after its steps 10 and 4), the short support off its long blue legs, standing across the
 * guideway 15 ft behind A (SHORT_GAP_METRES), and B (lifted there by a mobile crane, which isn't drawn) across the two double girders at the
 * front support's place on the next span (cAim), its deck facing west and its wheel assemblies on the unfinished span
 * (wheelShift). The trusses and the trolley stay where placeGantry() put them.
 */
async function placeNowLayout(m) {
  const { svg, gantry, N, nearest, small, fourthAngle, secondAngle, thirdAngle, frontAngle, middle, S } = m;
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  // C: the normal move's steps 3 and 4 (the same turns, so it lies the way it does there)
  const turn3 = nearest(secondAngle + N.second.turn - fourthAngle, -90),
    turn4 = turn3 + nearest(thirdAngle + N.rear.turn - (fourthAngle + turn3), 0);
  const moves = [m.moveFourth({ ...sub(N.rear.to, middle), turn: turn4 }, 0)];
  // A: the normal move's steps 6 to 10 end with it on N.second.to, turned by step 7's and step 9's turns about its middle
  const carryAngle = fourthAngle + (DOUBLE_GIRDER.has(S - 1) ? 90 : 0),
    sideways = nearest(carryAngle - secondAngle, 90),
    aTurn = sideways + nearest(N.second.turn - sideways, -90);
  moves.push(m.second.by(0, 0, sub(N.second.to, m.secondStart)));
  if (Math.abs(aTurn) > 0.01) moves.push(m.second.swing(N.second.to, aTurn, 0));
  // the short support: across the guideway as it stood at the front, slid back to SHORT_GAP_METRES behind A. It stood with
  // its rear edge against the joint and A's front edge is against it now, so the gap between the two beams is how far
  // past A's middle its middle is now, less the two halves (the same distance), plus the gap
  const onward = m.along(m.ahead),
    unit = { x: onward.x / Math.hypot(onward.x, onward.y), y: onward.y / Math.hypot(onward.x, onward.y) },
    ahead = sub(m.frontStart, N.second.to),
    back = (ahead.x * unit.x + ahead.y * unit.y) * 2 + SHORT_GAP_METRES * UNITS_PER_METRE;
  moves.push(m.front.by(0, 0, { x: -unit.x * back, y: -unit.y * back }));
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
  moves.push(m.third.by(0, 0, sub(m.cAim, m.thirdStart)), m.third.swing(m.cAim, bTurn, 0));
  // the moves take effect once they have started; the wheels are slid in B's frame as it lies then
  await Promise.all(moves);
  await slideAWheels(m, m.wheelShift, 0, "rear");
  stackSupports(svg);
}

/**
 * The move before a crawl, from the span the gantry is on (29, 41 or 50) to the next one. docs/double-girder/1-before-the-crawl.md
 * lists its steps. It ends with the fill of the new span and Support A moved between B and C, with the pieces left where it
 * put them: there is no snap.
 * @param {SVGSVGElement} svg The map's <svg>, after placeGantry() has put the gantry on its span.
 * @returns {Promise<boolean>} Always false once it has played (see the end of the function), so the run stops here; false
 * when the drawing has no gantry or no next span for placeGantry's rules to find.
 */
export async function playBeforeCrawl(svg) {
  const m = await startMove(svg);
  if (!m) return false;
  Object.assign(m, aimC(m), { trolleyAfterSnap: trolleyAfterSnap(m) });
  holders(m, "second", "front"); // TEMP
  if (m.S === 41) {
    // span 41 starts where the crews had the supports on Nov. 19 (placeNowLayout); the walk goes on from there
    await placeNowLayout(m);
    return playWalk(m);
  }
  // the first move, as the crews make it: Support C is carried forward and set down behind the front support
  await step1TrolleyToFourthSupport(m);
  await step2CarryFourthSupportForward(m);
  await step3TurnFourthSupport(m);
  await step4SetCBehindFrontSupport(m);
  // the rest (the move before the crawl, span S + 1 built, the crawl as a loop, and the move into the normal layout on the
  // last double girder span) is walk.js's
  return playWalk(m);
}
