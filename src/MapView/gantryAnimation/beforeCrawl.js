// The move before a crawl (the gantry on span 29, 41 or 50, about to move to 30, 42 or 51): the same as the normal move
// up to step 3, with the trolley carrying Support C. From there it differs: the trolley carries C forward, with the
// span, instead of backing up, and sets it down behind the front support. See docs/double-girder/1-before-the-crawl.md.
// Work in progress: it ends with the fill of the span the gantry is now on, with no snap to the next span.

import { gantryMoves, placeGantry, stackSupports } from "../../lib/placeGantry.js";
import { UNITS_PER_METRE } from "../../lib/layerSwitches.js";
import { SPEED, nextSpeed, pause } from "./clock.js";
import { clearHangers } from "./fill.js";
import { girderEdges } from "./guideway.js";
import { playCrawl } from "./crawl.js";
import { cMiddle, slideC, swingC } from "./supports.js";
import { between, centreIn, halfLength, reachIn } from "./measure.js";
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
/** How far behind C's rear edge, in metres, the front support is set down. */
const SET_DOWN_GAP_METRES = 1;

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
    reached = (thirdAt.y - rearTipAt.y - back) / cTrip,
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
  const { gantry, truss, ahead, trusses, moveTrolley, secondBeam } = m;
  const tips = [...gantry.querySelectorAll(".clipper-tip")].map((t) => centreIn(t, truss).y),
    rearTip = ahead > 0 ? Math.min(...tips) : Math.max(...tips),
    d = yNow(m, secondBeam) - rearTip;
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
  await step1TrolleyToFourthSupport(m);
  await step2CarryFourthSupportForward(m);
  await step3TurnFourthSupport(m);
  await step4SetCBehindFrontSupport(m);
  await step5TrolleyToFrontSupport(m);
  await step6CarryFrontSupportForward(m);
  await step7TurnFrontSupportLengthwise(m);
  await step8CarryFrontSupportBack(m);
  await step9TurnFrontSupportAcross(m);
  await step10SetFrontSupportBehindC(m);
  await step11TrolleyBackToSupportA(m);
  await step12TrussesBackForC(m);
  await step13CarryCForward(m);
  await step14FinishCTrip(m);
  await step15SwingTrussesWithC(m);
  await step16SwingTrussesBackFromC(m);
  await step17TrussesToHalfway(m);
  await step18TrolleyToThirdSupport(m);
  await step19TurnThirdSupportLengthwise(m);
  await step20CarryBAheadOfFrontSupport(m);
  await step21TurnBBack(m);
  await step22SetBWhereCWas(m);
  await step23TrolleyToSupportA(m);
  await step22TrussesPastFrontSupport(m, m.beam);
  await step23TurnTrussesOntoNextSpan(m, m.thirdBeam);
  await step24TrolleyToShortSupport(m);
  await step25CarryShortSupportBack(m);
  await step26TurnShortSupportLengthwise(m);
  await step27CarryShortSupportIntoSpan(m);
  await step28MoveShortSupportToJoint(m);
  await step23TrolleyToSupportA(m);
  await step24SlideTrussesToNextSpan(m);
  await step25TrolleyToMiddleSupportAndSlideRest(m, m.thirdBeam);
  await step29TrolleyToSnapPlace(m);
  // the gantry is now on the next span, which fills in as step 0 does at the start of every move
  m.gantry.dataset.span = m.S + 1;
  await step0FillSpan(m.svg, m.trolley);
  await step30TrolleyToC(m);
  // the hangers the fill put on the span come down, as in step 1 of the normal move
  clearHangers();
  await step31RearTipsToA(m);
  await step32CarryAOnJacks(m);
  await step33TrolleyToA(m);
  await step34TurnALengthwise(m);
  await step35CarryAHalfwayBetweenBAndC(m);
  await step36TurnAAcross(m);
  // the move before the crawl is one cycle, and each move of the crawl is another: the speed goes on to the next of SPEEDS
  // after each, as it does after each normal move (playToEnd)
  nextSpeed();
  await playCrawl(m);
  // the pieces are not placed on the next span (there is no snap), so a move played after this one would start from the
  // drawing as it is placed for the span before, and the supports would jump back to it. Until the crawl is built, the run
  // ends here: false stops playToEnd's loop.
  return false;
}
