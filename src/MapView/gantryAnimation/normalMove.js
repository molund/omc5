// The normal move: the gantry from the span it is on to the next one, with the trolley carrying the supports forward one
// by one, the trusses going back for the front support, and the trusses sliding forward onto the next span.

import { gantryMoves, placeGantry, placesOn, stackSupports } from "../../lib/placeGantry.js";
import { DOUBLE_GIRDER } from "../../lib/doubleGirder.js";
import { gantryProgress, markReached } from "../gantryProgress.js";
import { SPEED, pause } from "./clock.js";
import { between, screen, halfLength, centreIn, reachIn } from "./measure.js";
import { clearHangers, fillIn, followFill, FILL_TROLLEY_TIME } from "./fill.js";
import { holders } from "./holders.js"; // TEMP
import { GANTRY_DEBUG, debugLog } from "./debug.js";

/** Smooth starts and stops, and stay put at the end. */
const SMOOTH = { easing: "ease-in-out", fill: "forwards" };

/**
 * How far, in pixels on the screen, a step has to move something to be played: a step whose move would be shorter is
 * skipped, with its pause (on straight track the swings in steps 15 and 16, the turn in step 23 and the slides in steps
 * 24 and 26 come out at next to nothing, and would only hold the animation still). The drawing still ends up right: step
 * 28 snaps every piece to where placeGantry() puts it on the next span.
 */
const UNSEEN = 2;

/** The gantry's own elements; null when the drawing has no gantry. */
function findGantry(svg) {
  const els = {
    gantry: svg.querySelector("#clayton-clipper"),
    trolley: svg.querySelector("#clipper-trolley"),
    beam: svg.querySelector("#gantry-support-c"),
    frontBeam: svg.querySelector("#gantry-support-front"),
    secondBeam: svg.querySelector("#gantry-support-a"),
    thirdBeam: svg.querySelector("#gantry-support-b"),
  };
  return Object.values(els).every(Boolean) ? els : null;
}

/** Step 0: the span the gantry is on fills in. */
export async function step0FillSpan(svg, trolley) {
  debugLog("[gantry] step 0: FillSpan"); // TEMP
  // 0. the span the gantry is on is drawn complete (all its segments hung) before the gantry moves: as MapView draws it
  // when status.yaml says `hung: true`, but only in the drawing (status.yaml isn't touched). Each piece that turns
  // finished fills in like a progress bar, over FILL_TIME, in steps (more for a longer span) (fillIn): the first half
  // from its east end towards the middle, then the second half from its west end, ending at the middle (an odd step
  // goes to the first half). The trolley takes part (followFill): it hurries to the east end, follows the fill front to
  // the middle, hurries to the west end, follows the fill front back to the middle, and hurries back to where it
  // started. With nothing to fill (the span was already drawn hung), it just pauses.
  const unfinished = [...svg.querySelectorAll("polygon.guideway.cc.unfinished")].map((el) => [
    el,
    el.getAttribute("class"),
  ]);
  // a double girder span is already built (the gantry walked over it): nothing fills in, the trolley stays put, and the
  // span turns to the progress colour later, in step 10, once two supports are at or past its far joint
  if (DOUBLE_GIRDER.has(+svg.querySelector("#clayton-clipper")?.dataset.span)) {
    await pause(1000);
    return;
  }
  gantryProgress(svg, true);
  const filling = unfinished
    .filter(([el]) => !el.classList.contains("unfinished"))
    .map(([el, was]) => fillIn(svg, el, was))
    .filter(Boolean);
  if (filling.length) await followFill(trolley, filling);
  else await pause(1000);
}

/**
 * Measures everything before anything has moved, and works out where the next span puts the gantry (gantryMoves).
 * @param {SVGSVGElement} svg The map's <svg>.
 * @param {Record<string, SVGGraphicsElement>} els The gantry's elements (findGantry).
 * @param {(d: number) => boolean} unseen Whether a move of d on the map is too short to see (UNSEEN).
 * @returns The things the steps share, with `trolleyY` and `fourth` (how far the trolley and the fourth support have
 * moved) kept up to date by moveTrolley and moveFourth; null when placeGantry's rules find no next span.
 */
function prepare(svg, els, unseen) {
  const { gantry, trolley, beam, frontBeam, secondBeam, thirdBeam } = els;
  // THE TRUSS FRAME: the trolley's parent group. In it the trusses run straight along y, so a move along the gantry is a
  // change in y only. All the measuring is done here, before anything has moved.
  const truss = trolley.parentNode;
  const trolleyAt = centreIn(trolley, truss),
    beamAt = centreIn(beam, truss),
    frontAt = centreIn(frontBeam, truss),
    secondAt = centreIn(secondBeam, truss),
    thirdAt = centreIn(thirdBeam, truss);
  // which way is forward (towards higher span numbers) along y: from the fourth support towards the front one
  const ahead = Math.sign(frontAt.y - beamAt.y);

  // THE TROLLEY moves with the CSS `translate` property, which adds to its transform attribute instead of replacing it
  let trolleyY = 0;
  function moveTrolley(y, ms) {
    const a = trolley.animate([{ translate: `0 ${trolleyY}px` }, { translate: `0 ${y}px` }], {
      duration: ms / SPEED,
      ...SMOOTH,
    });
    trolleyY = y;
    return a.finished;
  }

  // THE FOURTH SUPPORT is four groups (beam, walkway and two wheel assemblies) side by side in #clayton-clipper, all
  // marked data-anchor="fourth"; they get the same moves so they stay together.
  // Its groups live in #clayton-clipper's frame, which is squashed to 55% across (the scale(0.55 1) above it): a turn in
  // that frame would stretch the beam as it turned. So it is moved and turned in the map's own frame (the <svg>, the same
  // scale both ways), and the move is carried into #clayton-clipper's frame by `toMap` and back out by `fromMap`.
  const parts = [...gantry.querySelectorAll(':scope > [data-anchor="fourth"]')];
  const toMap = between(gantry, svg),
    fromMap = toMap.inverse(),
    css = (m) => `matrix(${m.a}, ${m.b}, ${m.c}, ${m.d}, ${m.e}, ${m.f})`;
  const trussToMap = between(truss, svg);
  // a move of d along the trusses, as an x, y move in the map's frame (just the turn and scale, no shift)
  const along = (d) => ({ x: trussToMap.c * d, y: trussToMap.d * d });
  // it turns about its own middle, in the map's frame
  const middle = centreIn(beam, svg);
  // where placeGantry() put each group, as CSS: matrix(a, b, c, d, e, f)
  const placed = new Map(
    parts.map((g) => {
      const m = g.transform.baseVal.consolidate()?.matrix ?? new DOMMatrix();
      return [g, css(m)];
    }),
  );
  // a pose: shifted by x, y and turned by `turn` degrees about its middle, on top of where placeGantry() put it. Read it
  // from the right: where it was placed, out to the map's frame (toMap), the shift and turn there, then back into
  // #clayton-clipper's frame (fromMap). The CSS `transform` property replaces the attribute, so the placed matrix is
  // written at the end of every pose. Keeping the same list of functions in every keyframe lets the browser blend each
  // number on its own: a smooth slide and turn.
  const pose = (g, { x, y, turn }) =>
    `${css(fromMap)} translate(${middle.x + x}px, ${middle.y + y}px) rotate(${turn}deg) ` +
    `translate(${-middle.x}px, ${-middle.y}px) ${css(toMap)} ${placed.get(g)}`;
  let fourth = { x: 0, y: 0, turn: 0 };
  function moveFourth(to, ms) {
    const from = fourth;
    fourth = to;
    return Promise.all(
      parts.map(
        (g) =>
          g.animate([{ transform: pose(g, from) }, { transform: pose(g, to) }], { duration: ms / SPEED, ...SMOOTH })
            .finished,
      ),
    );
  }

  // PIECES THAT SLIDE AND SWING: the trusses, the front support and the third support. Each is a set of groups with the
  // same data-anchor, moved together. A slide is the CSS `translate` property: it shifts each group in its parent's frame,
  // #clayton-clipper's (a shift isn't bent out of shape by the squash, only a turn is). A swing is a CSS `transform`.
  // slider("front") makes a mover for the data-anchor="front" groups; .by(d, ms) slides them d further along the trusses
  // (and, given `sideways`, an x, y move on the map as well), and .swing(pivot, turn, ms) turns them `turn` degrees further
  // about a point on the map (on top of the swings so far, so a swing by −turn about the same point puts them back)
  function slider(anchor) {
    const groups = [...gantry.querySelectorAll(`:scope > [data-anchor="${anchor}"]`)];
    let at = 0,
      side = { x: 0, y: 0 },
      // the turns so far, on the map (before the slide), so a swing about a new point starts from where the last left it
      spun = new DOMMatrix();
    // the whole slide on the map: `at` along the trusses plus the sideways part
    const slide = () => {
      const a = along(at);
      return { x: a.x + side.x, y: a.y + side.y };
    };
    // a slide on the map as a CSS translate in #clayton-clipper's frame: fromMap's turn and stretch, without its shift
    const translate = (v) => `${fromMap.a * v.x + fromMap.c * v.y}px ${fromMap.b * v.x + fromMap.d * v.y}px`;
    return {
      // how far it has slid along the trusses so far
      get at() {
        return at;
      },
      by(d, ms, sideways = { x: 0, y: 0 }) {
        const from = translate(slide());
        at += d;
        side = { x: side.x + sideways.x, y: side.y + sideways.y };
        const to = translate(slide());
        return Promise.all(
          groups.map(
            (g) => g.animate([{ translate: from }, { translate: to }], { duration: ms / SPEED, ...SMOOTH }).finished,
          ),
        );
      },
      // The turn is a CSS `transform`, done in the map's frame like the fourth support's. The slide's `translate` is
      // applied after (outside) it, so turning about the pivot as the slide sees it means turning about the pivot moved
      // back by the slide: the point that the slide then carries onto the pivot.
      swing(pivot, turn, ms) {
        const o = slide(),
          p = { x: pivot.x - o.x, y: pivot.y - o.y };
        // this swing (0 to `turn` about p), on top of the turns so far (`spun`, the same in both keyframes)
        const turned = (g, a) =>
          `${css(fromMap)} translate(${p.x}px, ${p.y}px) rotate(${a}deg) translate(${-p.x}px, ${-p.y}px) ` +
          `${css(spun)} ${css(toMap)} ${css(g.transform.baseVal.consolidate()?.matrix ?? new DOMMatrix())}`;
        const done = Promise.all(
          groups.map(
            (g) =>
              g.animate([{ transform: turned(g, 0) }, { transform: turned(g, turn) }], {
                duration: ms / SPEED,
                ...SMOOTH,
              }).finished,
          ),
        );
        spun = new DOMMatrix().translate(p.x, p.y).rotate(turn).translate(-p.x, -p.y).multiply(spun);
        return done;
      },
    };
  }
  // the trusses are the two "body" groups: the trusses, cross beams, walkways and blue tips in one, the trolley in the
  // other, so the trolley rides along with them. The supports are named front, second, rear (the third) and fourth.
  const trusses = slider("body"),
    front = slider("front"),
    third = slider("rear"),
    second = slider("second");
  // the front tip: the blue tip furthest forward, measured in the truss frame like everything else
  const tipAt = [...gantry.querySelectorAll(".clipper-tip")]
    .map((t) => centreIn(t, truss))
    .reduce((a, b) => (ahead * b.y > ahead * a.y ? b : a));
  // the middle of the trusses along their length: halfway between the blue tips at the two ends (the average of all four)
  const tips = [...gantry.querySelectorAll(".clipper-tip")].map((t) => centreIn(t, truss).y),
    trussMiddleY = tips.reduce((a, b) => a + b, 0) / tips.length;

  // THE NEXT SPAN: every final position is aimed at where placeGantry() puts the gantry on the next span. Its own rules
  // (gantryMoves), asked now, before anything moves, to move the gantry from the span it is on to the next one, give
  // each anchor's move: where its middle goes on the map (`to`) and how far it turns (`turn`). On that move the
  // supports swap jobs: the front support stays the front one, the fourth becomes the second (just behind the next
  // span), the second becomes the rear (third) one, and the third becomes the fourth.
  const S = +gantry.dataset.span;
  const next = S ? gantryMoves(svg, S, S + 1) : null;
  if (!next) return null;
  const N = next.moves;

  // angles on the map in degrees, the smallest turn (between −180 and 180), and the angle of a beam's long side. A
  // beam's long side has no front or back, so a turn that lines one up can go 180° either way: nearest() picks the one
  // closest to the turn wanted.
  const deg = (v) => (Math.atan2(v.y, v.x) * 180) / Math.PI,
    small = (a) => ((((a + 180) % 360) + 360) % 360) - 180,
    nearest = (raw, wanted) => raw + 180 * Math.round((wanted - raw) / 180),
    lengthwise = (el) => {
      const b = el.getBBox(),
        m = between(el, svg),
        o = new DOMPoint(b.x, b.y).matrixTransform(m),
        w = new DOMPoint(b.x + b.width, b.y).matrixTransform(m),
        h = new DOMPoint(b.x, b.y + b.height).matrixTransform(m),
        across = { x: w.x - o.x, y: w.y - o.y },
        down = { x: h.x - o.x, y: h.y - o.y };
      return deg(Math.hypot(across.x, across.y) >= Math.hypot(down.x, down.y) ? across : down);
    };
  // a move of 1 along the trusses on the map, and how far along the trusses an x, y move on the map goes: the dot
  // product, divided by that move's length squared
  const one = along(1),
    alongOf = (v) => (v.x * one.x + v.y * one.y) / (one.x * one.x + one.y * one.y);

  // where things are at the start, on the map: the second support, the front and third supports' middles, and the angles
  // of the supports' long sides. The pivot of the trusses' swing (step 15) is the second support's middle once step 10 has
  // put it on its place on the next span.
  const secondStart = centreIn(secondBeam, svg),
    pivot = N.second.to,
    frontStart = centreIn(frontBeam, svg),
    thirdStart = centreIn(thirdBeam, svg),
    fourthAngle = lengthwise(beam),
    secondAngle = lengthwise(secondBeam),
    thirdAngle = lengthwise(thirdBeam),
    frontAngle = lengthwise(frontBeam);
  // the trusses' middle line: halfway across between the two trusses (in the truss frame); trussLine(m) is a point on it
  // and its direction on the map, pointing forward, with the truss frame's matrix onto the map as it is when asked
  const trussGroups = [...gantry.querySelectorAll(".clipper-truss")],
    acrossMid = trussGroups.reduce((x, t) => x + centreIn(t, truss).x / 2, 0),
    trussLine = (m) => {
      const a = new DOMPoint(acrossMid, 0).matrixTransform(m),
        b = new DOMPoint(acrossMid, ahead).matrixTransform(m),
        l = Math.hypot(b.x - a.x, b.y - a.y);
      return { at: a, dir: { x: (b.x - a.x) / l, y: (b.y - a.y) / l } };
    },
    startDir = trussLine(between(truss, svg)).dir;
  // the trusses' middle on the map, as placeGantry measures it: halfway between the middles of the two trusses
  const trussesMiddle = () => {
    const [a, b] = trussGroups.map((t) => centreIn(t, svg));
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };

  // TUNING: these only set where along the way things happen; every final position comes from the next span.
  // FOURTH_TURNS_AT: how much of the fourth support's trip it makes before it turns (0 to 1)
  const FOURTH_TURNS_AT = 0.5;
  // PICKUP: a nudge, in truss units along y, to where the front tip stops when the trusses go back for the front support
  const PICKUP = -8;
  return {
    svg,
    gantry,
    trolley,
    beam,
    frontBeam,
    secondBeam,
    thirdBeam,
    unseen,
    truss,
    trolleyAt,
    beamAt,
    frontAt,
    secondAt,
    thirdAt,
    ahead,
    moveTrolley,
    moveFourth,
    trusses,
    front,
    third,
    second,
    tipAt,
    trussMiddleY,
    S,
    N,
    deg,
    small,
    nearest,
    one,
    alongOf,
    secondStart,
    pivot,
    frontStart,
    thirdStart,
    fourthAngle,
    secondAngle,
    thirdAngle,
    frontAngle,
    trussLine,
    startDir,
    trussesMiddle,
    FOURTH_TURNS_AT,
    PICKUP,
    along,
    middle,
    get trolleyY() {
      return trolleyY;
    },
    get fourth() {
      return fourth;
    },
  };
}

/** Step 1: the trolley slides to the fourth support, and the hangers the fill put on come down. */
export async function step1TrolleyToFourthSupport(m) {
  debugLog("[gantry] step 1: TrolleyToFourthSupport"); // TEMP
  const { trolleyAt, beamAt, moveTrolley } = m;
  // 1. the trolley slides from where it is (back at its start, after the fill) to stop over the middle of the fourth
  // support, hurrying like it did to and from the fill (FILL_TROLLEY_TIME); there, the hangers the fill put on the
  // finished span come down
  await moveTrolley(beamAt.y - trolleyAt.y, FILL_TROLLEY_TIME);
  clearHangers();
}

/**
 * Step 2: the trolley and the fourth support move forward together.
 * @param {number} [further] How much further than usual to carry it, in truss units (the move before a crawl uses it).
 */
export async function step2CarryFourthSupportForward(m, further = 0) {
  debugLog("[gantry] step 2: CarryFourthSupportForward"); // TEMP
  const { svg, moveTrolley, moveFourth, S, N, alongOf, FOURTH_TURNS_AT, along, middle } = m;
  // THE FOURTH SUPPORT'S TRIP (steps 2 and 3): from where it starts (`middle`) towards the second support's place on the
  // next span (N.second.to), as far as the point where it turns
  const fourthGap = { x: N.second.to.x - middle.x, y: N.second.to.y - middle.y },
    fourthTrip = alongOf(fourthGap);

  // 2. the trolley and the fourth support move forward together: the first part of its trip. On a double girder span
  // (DOUBLE_GIRDER, from placeGantry) the fourth support is drawn turned across the span, so when it is picked up there
  // it first turns a quarter turn clockwise (a positive turn on the map, where y points down).
  // (A support that lies lengthwise is drawn above those across the trusses, so it doesn't blend with them as it is
  // carried over them: stackSupports. The fourth support is lifted first, to turn lengthwise.)
  stackSupports(svg, ["fourth"]);
  if (DOUBLE_GIRDER.has(S - 1)) {
    await moveFourth({ ...m.fourth, turn: m.fourth.turn + 90 }, 2000);
    await pause(500);
  }
  const leg1 = fourthTrip * FOURTH_TURNS_AT + further;
  const step = along(leg1);
  await Promise.all([
    moveTrolley(m.trolleyY + leg1, 2500),
    moveFourth({ ...m.fourth, x: m.fourth.x + step.x, y: m.fourth.y + step.y }, 2500),
  ]);
  await pause(500);
}

/** Step 3: the fourth support turns to lie the way the second support will on the next span. */
export async function step3TurnFourthSupport(m) {
  debugLog("[gantry] step 3: TurnFourthSupport"); // TEMP
  const { svg, moveFourth, N, nearest, fourthAngle, secondAngle } = m;
  // 3. the fourth support turns to lie the way the second support will on the next span: the second support's angle now
  // plus its turn on the move (N.second.turn), from the fourth support's angle now (where it started plus any turn in
  // step 2); of the ways round, the one nearest a quarter turn back
  await moveFourth(
    { ...m.fourth, turn: m.fourth.turn + nearest(secondAngle + N.second.turn - (fourthAngle + m.fourth.turn), -90) },
    2000,
  );
  // it lies across the trusses now, so it goes back under the supports that are lengthwise
  stackSupports(svg);
}

/** Step 4: the trolley backs up with the fourth support and sets it down on the rear support's place. */
async function step4SetFourthSupportDown(m) {
  debugLog("[gantry] step 4: SetFourthSupportDown"); // TEMP
  const { moveTrolley, moveFourth, N, nearest, alongOf, fourthAngle, thirdAngle, middle } = m;
  // 4. the trolley backs up with the fourth support and sets it down on the rear support's place on the next span
  // (N.rear.to), where it stays for the rest of the move. It turns to the angle the rear support has there (the third
  // support's angle now plus its turn on the move, N.rear.turn) as it goes: step 3 left it a little short of that on a
  // curve. The trolley follows its trip along the trusses.
  const rearGap = { x: N.rear.to.x - middle.x, y: N.rear.to.y - middle.y };
  await Promise.all([
    moveTrolley(m.trolleyY + alongOf({ x: rearGap.x - m.fourth.x, y: rearGap.y - m.fourth.y }), 3000),
    moveFourth(
      {
        x: rearGap.x,
        y: rearGap.y,
        turn: m.fourth.turn + nearest(thirdAngle + N.rear.turn - (fourthAngle + m.fourth.turn), 0),
      },
      3000,
    ),
  ]);
  await pause(500);
}

/** Step 5: the trolley slides to stop over the second support. */
async function step5TrolleyToSecondSupport(m) {
  debugLog("[gantry] step 5: TrolleyToSecondSupport"); // TEMP
  const { trolleyAt, secondAt, moveTrolley } = m;
  // 5. the trolley slides to stop over the middle of the second support (the trusses haven't moved yet, so this is
  // measured the same way as step 1)
  await moveTrolley(secondAt.y - trolleyAt.y, 3000);
  await pause(500);
}

/** Step 6: the trolley lifts the second support and backs up with it a little. */
async function step6LiftSecondSupportAndBackUp(m) {
  debugLog("[gantry] step 6: LiftSecondSupportAndBackUp"); // TEMP
  const { svg, ahead, moveTrolley, second, secondStart, along } = m;
  // THE SECOND SUPPORT'S TRIP (steps 6 to 10): the trolley does with it what step 2 to 4 first had it do with the fourth:
  // it lifts it, backs up a little, turns it lengthwise, and carries it to the second support's place on the next span
  // (N.second.to), turning it to the angle it has there half way. aMid is where its middle is as it goes, on the map.
  // BACK_UP: how far, in truss units, it backs up before it turns
  const BACK_UP = 20;
  m.aMid = { x: secondStart.x, y: secondStart.y };

  // 6. the trolley lifts the second support and backs up with it a little
  const backUp = -ahead * BACK_UP,
    backStep = along(backUp);
  stackSupports(svg, ["second"]);
  await Promise.all([moveTrolley(m.trolleyY + backUp, 1500), second.by(backUp, 1500)]);
  m.aMid = { x: m.aMid.x + backStep.x, y: m.aMid.y + backStep.y };
  await pause(500);
  Object.assign(m, { backUp });
}

/** Step 7: the second support turns to lie lengthwise. */
async function step7TurnSecondSupportLengthwise(m) {
  debugLog("[gantry] step 7: TurnSecondSupportLengthwise"); // TEMP
  const { second, S, nearest, fourthAngle, secondAngle } = m;
  // 7. the second support turns about its own middle to lie lengthwise, the way the fourth support lies when it is carried
  // (a quarter turn across from the way it lies on a double girder span); of the ways round, the one nearest a quarter turn
  const carryAngle = fourthAngle + (DOUBLE_GIRDER.has(S - 1) ? 90 : 0),
    secondSideways = nearest(carryAngle - secondAngle, 90);
  await second.swing(m.aMid, secondSideways, 2000);
  await pause(500);
  Object.assign(m, { secondSideways });
}

/** Step 8: the trolley carries the second support forward, the first part of its trip. */
async function step8CarrySecondSupportForward(m) {
  debugLog("[gantry] step 8: CarrySecondSupportForward"); // TEMP
  const { moveTrolley, second, N, alongOf, FOURTH_TURNS_AT, along } = m;
  // 8. the trolley carries it forward, the first part of its trip: the same share of it as step 2 (FOURTH_TURNS_AT)
  const secondGap = { x: N.second.to.x - m.aMid.x, y: N.second.to.y - m.aMid.y },
    secondTrip = alongOf(secondGap),
    secondLeg1 = secondTrip * FOURTH_TURNS_AT;
  const step = along(secondLeg1);
  await Promise.all([moveTrolley(m.trolleyY + secondLeg1, 2500), second.by(secondLeg1, 2500)]);
  m.aMid = { x: m.aMid.x + step.x, y: m.aMid.y + step.y };
  await pause(500);
  Object.assign(m, { secondGap, secondTrip, secondLeg1 });
}

/** Step 9: the second support turns to the angle it has on the next span. */
async function step9TurnSecondSupportToItsAngle(m) {
  debugLog("[gantry] step 9: TurnSecondSupportToItsAngle"); // TEMP
  const { svg, second, N, nearest, secondSideways } = m;
  // 9. the second support turns to the angle it has on the next span: its angle now plus its turn on the move
  // (N.second.turn), from its angle now (where it started plus the turn in step 7); of the ways round, the one nearest a
  // quarter turn back, as in step 3
  await second.swing(m.aMid, nearest(N.second.turn - secondSideways, -90), 2000);
  stackSupports(svg);
  await pause(500);
}

/** Step 10: the rest of the second support's trip, and the trolley lowers it on its place. */
async function step10SetSecondSupportDown(m) {
  debugLog("[gantry] step 10: SetSecondSupportDown"); // TEMP
  const { moveTrolley, second, along, secondGap, secondTrip, secondLeg1 } = m;
  // 10. the rest of its trip, with the small move sideways that only the support makes, and the trolley lowers it on the
  // second support's place on the next span
  const secondLeg2 = secondTrip - secondLeg1,
    secondSide = { x: secondGap.x - along(secondTrip).x, y: secondGap.y - along(secondTrip).y };
  await Promise.all([moveTrolley(m.trolleyY + secondLeg2, 2500), second.by(secondLeg2, 2500, secondSide)]);
  // on a double girder span, the second support is now at the span's far joint, with the front support past it: two
  // supports at or past the joint, so the span turns to the progress colour (step 0 left it alone)
  if (DOUBLE_GIRDER.has(m.S)) markReached(m.svg, m.S);
  await pause(500);
}

/** Step 11: the trolley slides to stop over the fourth support. */
async function step11TrolleyBackToFourthSupport(m) {
  debugLog("[gantry] step 11: TrolleyBackToFourthSupport"); // TEMP
  const { trolleyAt, beamAt, moveTrolley, trusses, alongOf } = m;
  // 11. the trolley slides on its own to stop over the middle of the fourth support, where it stays through steps 12 to 16
  // (it leaves the second support, which is still the pivot of the swing in step 15). Its place on the trusses is where the
  // fourth support started plus how far it has gone along them (its moves are kept as x, y on the map, alongOf), less the
  // trusses' slide so far, and the trolley's own drawn position, as in step 18 (the trusses haven't moved yet).
  const fourthAlong = alongOf(m.fourth);
  await moveTrolley(beamAt.y + fourthAlong - trolleyAt.y - trusses.at, 3000);
  await pause(500);
  Object.assign(m, { fourthAlong });
}

/** Step 12: the trusses slide back to pick up the front support. */
async function step12TrussesBackForFrontSupport(m) {
  debugLog("[gantry] step 12: TrussesBackForFrontSupport"); // TEMP
  const { frontAt, moveTrolley, trusses, tipAt, PICKUP } = m;
  // 12. The trusses slide back so they can pick up the front supprt: until the front tip is over the middle of the front
  // support (nudged by PICKUP). The trolley rides on the trusses, so it is moved forward the same distance at the same
  // time, with the same timing and easing: the two moves cancel out at every moment, and it stays still over the fourth
  // support.
  const back = frontAt.y - tipAt.y + PICKUP;
  await Promise.all([trusses.by(back, 3000), moveTrolley(m.trolleyY - back, 3000)]);
  await pause(500);
  Object.assign(m, { back });
}

/** Step 13: the trusses carry the front support forward, the first part of its trip. */
async function step13CarryFrontSupportForward(m) {
  debugLog("[gantry] step 13: CarryFrontSupportForward"); // TEMP
  const {
    gantry,
    truss,
    thirdAt,
    ahead,
    moveTrolley,
    trusses,
    front,
    N,
    one,
    alongOf,
    pivot,
    frontStart,
    back,
    PICKUP,
  } = m;
  // THE FRONT SUPPORT'S TRIP along the trusses: after the swing in step 15 it has to be on its place on the next span
  // (N.front.to). The swing turns it about the pivot without changing its distance from it, so first it slides to the
  // point on its slide line that is as far from the pivot as N.front.to is: |w + s × one|² = R², a quadratic in s, with
  // w from the pivot to where it starts. Of its two answers, the one nearest a plain slide to N.front.to.
  const frontTo = N.front.to,
    w = { x: frontStart.x - pivot.x, y: frontStart.y - pivot.y },
    qa = one.x * one.x + one.y * one.y,
    qb = 2 * (w.x * one.x + w.y * one.y),
    qc = w.x * w.x + w.y * w.y - ((frontTo.x - pivot.x) ** 2 + (frontTo.y - pivot.y) ** 2),
    root = Math.sqrt(Math.max(0, qb * qb - 4 * qa * qc)),
    plain = alongOf({ x: frontTo.x - frontStart.x, y: frontTo.y - frontStart.y }),
    frontTrip = [(-qb + root) / (2 * qa), (-qb - root) / (2 * qa)].reduce((a, b) =>
      Math.abs(b - plain) < Math.abs(a - plain) ? b : a,
    ),
    // the third support rides along for the end of the trip: from when the rear lifting jacks reach it, over its middle
    // (the rear tip is the blue tip furthest back, measured in the truss frame; the jacks are PICKUP past its middle,
    // outwards, as the front jacks are past the front tip's; the trusses are `back` along by now, and the third support
    // hasn't moved), kept within the trip
    rearTipAt = [...gantry.querySelectorAll(".clipper-tip")]
      .map((t) => centreIn(t, truss))
      .reduce((a, b) => (ahead * b.y < ahead * a.y ? b : a)),
    reached = (thirdAt.y - (rearTipAt.y + ahead * PICKUP) - back) / frontTrip,
    alone = frontTrip * Math.min(1, Math.max(0, reached)),
    ride = frontTrip - alone;

  // 13. the trusses carry the front support forward, the first part of its trip, and the trolley stays still over the
  // fourth support (moved back inside the trusses as they go forward, as in step 12)
  await Promise.all([trusses.by(alone, 2500), front.by(alone, 2500), moveTrolley(m.trolleyY - alone, 2500)]);
  await pause(500);
  Object.assign(m, { frontTo, ride });
}

/** Step 14: the rest of the front support's trip, with the third support riding along. */
async function step14FinishFrontSupportTrip(m) {
  debugLog("[gantry] step 14: FinishFrontSupportTrip"); // TEMP
  const { moveTrolley, trusses, front, third, ride } = m;
  // 14. the rest of its trip, with the third support riding along too, and the trolley still stays still
  await Promise.all([
    trusses.by(ride, 1500),
    front.by(ride, 1500),
    third.by(ride, 1500),
    moveTrolley(m.trolleyY - ride, 1500),
  ]);
  await pause(500);
}

/** Step 15: the trusses swing, carrying the front support to its place. */
async function step15SwingTrussesWithFrontSupport(m) {
  debugLog("[gantry] step 15: SwingTrussesWithFrontSupport"); // TEMP
  const { unseen, trusses, front, third, deg, small, pivot, frontStart, along, frontTo } = m;
  // 15. the trusses stay on the second support and their front end swings, carrying the front support, until the front
  // support is on its place on the next span: the turn from where it is now to N.front.to, seen from the pivot. The
  // trolley, parked over the fourth support, rides round with the trusses. The third support, riding on the rear lifting jacks since step 14,
  // swings with the trusses as a counterweight for the front support.
  const frontSlid = along(front.at),
    turn = small(
      deg({ x: frontTo.x - pivot.x, y: frontTo.y - pivot.y }) -
        deg({ x: frontStart.x + frontSlid.x - pivot.x, y: frontStart.y + frontSlid.y - pivot.y }),
    );
  // How far the swing carries the front end: the arc the front support's middle follows. On straight track `turn` is next
  // to nothing, and steps 15 and 16 skip the swing (UNSEEN).
  const swingArc = (Math.hypot(frontTo.x - pivot.x, frontTo.y - pivot.y) * Math.abs(turn) * Math.PI) / 180,
    swings = !unseen(swingArc);
  if (swings) {
    await Promise.all([
      trusses.swing(pivot, turn, 3000),
      front.swing(pivot, turn, 3000),
      third.swing(pivot, turn, 3000),
    ]);
    await pause(500);
  }
  Object.assign(m, { turn, swings });
}

/** Step 16: the trusses swing back, and the front support turns to its angle. */
async function step16SwingTrussesBack(m) {
  debugLog("[gantry] step 16: SwingTrussesBack"); // TEMP
  const { svg, frontBeam, unseen, trusses, front, third, N, pivot, frontTo, turn, swings } = m;
  // 16. the trusses swing back the same way to where they were, leaving the front support on its place; at the same time
  // it turns about its own middle to the angle it has there (its whole turn on the move is N.front.turn, and the swing
  // has done `turn` of it). The third support swings back with the trusses, ending where step 14 left it.
  // The front support's own turn is played if the ends of its beam would move far enough to see, even without the swing.
  // Otherwise it is made at once, with no pause, so the support still ends exactly parallel or perpendicular to its span.
  const frontEnds = (halfLength(frontBeam, svg) * Math.abs(N.front.turn - turn) * Math.PI) / 180,
    frontSeen = !unseen(frontEnds),
    tenMoves = [
      ...(swings ? [trusses.swing(pivot, -turn, 3000), third.swing(pivot, -turn, 3000)] : []),
      front.swing(frontTo, N.front.turn - turn, frontSeen || swings ? 3000 : 0),
    ];
  await Promise.all(tenMoves);
  if (swings || frontSeen) await pause(500);
}

/** Step 17: the trusses slide back to halfway between the fourth and second supports. */
async function step17TrussesToHalfway(m) {
  debugLog("[gantry] step 17: TrussesToHalfway"); // TEMP
  const { beamAt, secondAt, moveTrolley, trusses, trussMiddleY, alongOf, backUp, secondGap, fourthAlong } = m;
  // 17. the trusses slide back until their middle is halfway between the fourth support and the second support. The
  // third and front supports stay where they are, and the trolley stays still over the fourth support, as in step 12.
  // How far the fourth support has gone along the trusses: its moves are kept as x, y on the map (alongOf).
  const halfway = (beamAt.y + fourthAlong + secondAt.y + alongOf(secondGap) + backUp) / 2,
    toMiddle = halfway - (trussMiddleY + trusses.at);
  await Promise.all([trusses.by(toMiddle, 3000), moveTrolley(m.trolleyY - toMiddle, 3000)]);
  await pause(500);
}

/** Step 18: the trolley slides back to stop over the third support. */
export async function step18TrolleyToThirdSupport(m) {
  debugLog("[gantry] step 18: TrolleyToThirdSupport"); // TEMP
  const { trolleyAt, thirdAt, moveTrolley, trusses, third } = m;
  // 18. the trolley slides back to stop over the third support, now the one at the rear. The third support is where it
  // started plus its slide (third.at); the trolley's own offset is measured inside the trusses, which have moved
  // (trusses.at), so that is taken off.
  await moveTrolley(thirdAt.y + third.at - trolleyAt.y - trusses.at, 3000);
  await pause(500);
}

/** Step 19: the third support turns to lie lengthwise. */
export async function step19TurnThirdSupportLengthwise(m) {
  debugLog("[gantry] step 19: TurnThirdSupportLengthwise"); // TEMP
  const { svg, third, S, N, nearest, thirdStart, fourthAngle, thirdAngle, along } = m;
  // WHICH WAY THE FOURTH SUPPORT LIES ON THE NEXT SPAN, on span S (just behind it): lengthwise, or turned across on a
  // double girder span (DOUBLE_GIRDER). gantryMoves() turns it from how it lies now and adds the double girder's quarter
  // turn on top, so when it is already turned across now (span S − 1 is a double girder) that quarter turn is taken
  // back out once: fourthFinal is its true angle there, and fourthLengthwise the angle it would have lying lengthwise.
  const acrossNow = DOUBLE_GIRDER.has(S - 1) ? -90 : 0,
    acrossNext = DOUBLE_GIRDER.has(S) ? -90 : 0,
    fourthFinal = fourthAngle + N.fourth.turn - acrossNow,
    fourthLengthwise = fourthFinal - acrossNext;

  // 19. the third support turns about its own middle (where it started plus its slide) to lie lengthwise, the way the
  // fourth support lies on the next span unless that's a double girder span (step 20 turns it across then); of the ways
  // round, the one nearest a quarter turn. swing() turns in the map's frame, so it keeps its shape.
  const slidThird = along(third.at),
    thirdTurn = nearest(fourthLengthwise - thirdAngle, 90);
  stackSupports(svg, ["rear"]);
  await third.swing({ x: thirdStart.x + slidThird.x, y: thirdStart.y + slidThird.y }, thirdTurn, 2000);
  await pause(500);
  Object.assign(m, { acrossNext, fourthFinal, thirdTurn });
}

/** Step 20: the trolley carries the third support to the fourth support's place. */
async function step20CarryThirdSupportToFourthPlace(m) {
  debugLog("[gantry] step 20: CarryThirdSupportToFourthPlace"); // TEMP
  const {
    svg,
    moveTrolley,
    third,
    N,
    nearest,
    alongOf,
    thirdStart,
    thirdAngle,
    along,
    acrossNext,
    fourthFinal,
    thirdTurn,
  } = m;
  // 20. the trolley carries the third support to the fourth support's place on the next span (N.fourth.to). The gap is
  // split into the part along the trusses (alongOf), which the trolley follows, and what's left over, a small move
  // sideways that only the support makes. (The slide's `translate` sits outside the turn, so the turned support moves
  // as it is.)
  const thirdNow = along(third.at),
    gap = { x: N.fourth.to.x - (thirdStart.x + thirdNow.x), y: N.fourth.to.y - (thirdStart.y + thirdNow.y) },
    forward = alongOf(gap),
    straight = along(forward),
    sideways = { x: gap.x - straight.x, y: gap.y - straight.y };
  await Promise.all([third.by(forward, 2500, sideways), moveTrolley(m.trolleyY + forward, 2500)]);
  await pause(500);
  // on a double girder span it is set down turned across the span, as placeGantry draws the fourth support there: a
  // quarter turn about its middle (now on N.fourth.to) from lengthwise to fourthFinal, the way back from step 2's turn
  // (anticlockwise) when either way would do
  if (acrossNext) {
    await third.swing(N.fourth.to, nearest(fourthFinal - (thirdAngle + thirdTurn), -90), 2000);
    stackSupports(svg);
    await pause(500);
  }
}

/**
 * Step 20, handed over from a walk with the fourth support already about on its place on the next span (playSecondHalf):
 * the trolley carries the third support straight to its own place there, the rear support's (placeGantry's), standing
 * across as it is: no other support is in the way, so it isn't turned lengthwise.
 * @param {object} m The shared object.
 * @param {{ x: number, y: number }} to Its place on the next span (placesOn()).
 */
async function step20CarryThirdSupportToRearPlace(m, to) {
  debugLog("[gantry] step 20: CarryThirdSupportToRearPlace"); // TEMP
  const { moveTrolley, third, alongOf, thirdStart, along } = m;
  const thirdNow = along(third.at),
    gap = { x: to.x - (thirdStart.x + thirdNow.x), y: to.y - (thirdStart.y + thirdNow.y) },
    forward = alongOf(gap),
    straight = along(forward),
    sideways = { x: gap.x - straight.x, y: gap.y - straight.y };
  await Promise.all([third.by(forward, 2500, sideways), moveTrolley(m.trolleyY + forward, 2500)]);
  await pause(500);
}

/** Step 21: the trolley slides to stop over the fourth support. */
async function step21TrolleyOverFourthSupport(m) {
  debugLog("[gantry] step 21: TrolleyOverFourthSupport"); // TEMP
  const { trolleyAt, beamAt, moveTrolley, trusses, fourthAlong } = m;
  // 21. the trolley slides on its own to stop over the fourth support, leaving the third support where step 20 put it.
  // The fourth support hasn't moved since step 17, so it is still where it started plus fourthAlong; take off the
  // trolley's drawn position and the trusses' slide, as in step 18.
  await moveTrolley(beamAt.y + fourthAlong - trolleyAt.y - trusses.at, 2500);
  await pause(500);
}

/**
 * Step 22: the trusses slide forward until their front ends are just past the front support.
 * @param {object} m The shared object.
 * @param {SVGGraphicsElement} [support] The support to go just past (the front support unless another move says so).
 */
export async function step22TrussesPastFrontSupport(m, support = m.frontBeam) {
  debugLog("[gantry] step 22: TrussesPastFrontSupport"); // TEMP
  const { gantry, truss, ahead, moveTrolley, trusses } = m;
  // 22. the trusses slide forward until their front ends (where the yellow truss lines stop) are just past the front
  // support, and the trolley stays still over the fourth support. Measured as things are now: the browser counts the
  // animations so far when it measures, and the truss frame moves with the trusses, so the front support's position
  // there is where it is relative to the trusses. "Front" edges depend on which way along y is forward (`ahead`).
  // GAP: how far past the front support's front edge the truss ends stop. Make it bigger to go further, smaller (or
  // negative) to stop sooner.
  const GAP = 2;
  const lines = [...gantry.querySelectorAll(".clipper-truss line")].map((l) => reachIn(l, truss)),
    trussFront = ahead > 0 ? Math.max(...lines.map((r) => r.hi)) : Math.min(...lines.map((r) => r.lo)),
    supportReach = reachIn(support, truss),
    supportFront = ahead > 0 ? supportReach.hi : supportReach.lo,
    past = supportFront + ahead * GAP - trussFront;
  await Promise.all([trusses.by(past, 2500), moveTrolley(m.trolleyY - past, 2500)]);
  await pause(500);
}

/**
 * Step 23: the trusses turn and shift onto the line they have on the next span.
 * @param {object} m The shared object.
 * @param {SVGGraphicsElement} [pivotBeam] The beam of the support they swing about (the fourth support unless another move
 * says so).
 */
export async function step23TurnTrussesOntoNextSpan(m, pivotBeam = m.beam) {
  debugLog("[gantry] step 23: TurnTrussesOntoNextSpan"); // TEMP
  const { svg, gantry, unseen, truss, trusses, N, deg, small, trussLine, startDir } = m;
  // 23. the trusses turn and shift onto the line they have on the next span: through N.body.to (where their middle goes)
  // at their angle at the start plus their turn on the move (N.body.turn). They swing about the fourth support's middle,
  // where the trolley is parked, after a shift straight across: the shift has to put their middle line through the
  // point that the swing then carries onto N.body.to, which is N.body.to turned back about the pivot.
  const fourthMid = centreIn(pivotBeam, svg),
    { at: lineAt, dir: lineDir } = trussLine(between(truss, svg)),
    lineUp = small(deg(startDir) + N.body.turn - deg(lineDir)),
    turnBack = (-lineUp * Math.PI) / 180,
    fromPivot = { x: N.body.to.x - fourthMid.x, y: N.body.to.y - fourthMid.y },
    beforeSwing = {
      x: fourthMid.x + fromPivot.x * Math.cos(turnBack) - fromPivot.y * Math.sin(turnBack),
      y: fourthMid.y + fromPivot.x * Math.sin(turnBack) + fromPivot.y * Math.cos(turnBack),
    },
    toLine = { x: beforeSwing.x - lineAt.x, y: beforeSwing.y - lineAt.y },
    alongLine = toLine.x * lineDir.x + toLine.y * lineDir.y,
    across = { x: toLine.x - alongLine * lineDir.x, y: toLine.y - alongLine * lineDir.y };
  // how far the move takes the trusses: the shift, plus the arc their end furthest from the pivot follows in the swing.
  // On straight track both are next to nothing, and the step is skipped (UNSEEN).
  const reach = Math.max(
      ...[...gantry.querySelectorAll(".clipper-tip")].map((t) => {
        const c = centreIn(t, svg);
        return Math.hypot(c.x - fourthMid.x, c.y - fourthMid.y);
      }),
    ),
    moves17 = Math.hypot(across.x, across.y) + (reach * Math.abs(lineUp) * Math.PI) / 180;
  if (!unseen(moves17)) {
    // the shift is started first, so the swing turns about the fourth support as the shifted trusses see it
    await Promise.all([trusses.by(0, 2500, across), trusses.swing(fourthMid, lineUp, 2500)]);
    await pause(500);
  }
}

/** Step 24: the trusses slide forward onto their place on the next span. */
export async function step24SlideTrussesToNextSpan(m) {
  debugLog("[gantry] step 24: SlideTrussesToNextSpan"); // TEMP
  const { svg, gantry, trolley, unseen, truss, ahead, moveTrolley, trusses, trussMiddleY, N, trussesMiddle } = m;
  // by() takes a slide as an x, y move on the map: a move of 1 along the trusses as they lie now is (c, d) of the truss
  // frame's matrix onto the map, as `along` was for their old direction
  const nowOnMap = between(truss, svg),
    unitNow = { x: nowOnMap.c, y: nowOnMap.d };

  // 24. the trusses slide forward on their own until their middle is on its place on the next span (N.body.to), and the
  // trolley stays still over the fourth support. Step 23 put them on the right line, so this slide runs along it. The
  // trolley's cancelling move is that slide in truss units, measured against a move of 1 along the trusses as they lie
  // now (the dot product again). It is played in three parts, 24, 25 and 26 below: the slide stops when the trolley has
  // come as close to the blue tips at the trusses' rear end as it may, the trolley drives to the middle support, and the
  // slide goes on.
  // TIP_GAP_SHARE: the closest the trolley may come to a blue tip, as a share of the tip's length (the result is rounded
  // to a whole number of truss units)
  const TIP_GAP_SHARE = 0.5;
  const middleNow = trussesMiddle(),
    slide20 = { x: N.body.to.x - middleNow.x, y: N.body.to.y - middleNow.y },
    forward20 = (slide20.x * unitNow.x + slide20.y * unitNow.y) / (unitNow.x * unitNow.x + unitNow.y * unitNow.y);
  // how much of the slide the trolley can take before it gets too close to the rear tips: the trusses slide past it, so
  // it moves towards their rear end. `gapNow` is how far its rear edge is from the tips' inner edge now.
  const tipReaches = [...gantry.querySelectorAll(".clipper-tip")].map((t) => reachIn(t, truss)),
    tipLength = tipReaches[0].hi - tipReaches[0].lo,
    rearTips = tipReaches.filter((r) => ahead * (r.lo + r.hi) < ahead * 2 * trussMiddleY),
    tipInner = ahead > 0 ? Math.max(...rearTips.map((r) => r.hi)) : Math.min(...rearTips.map((r) => r.lo)),
    trolleyReach = reachIn(trolley, truss),
    gapNow = ahead * ((ahead > 0 ? trolleyReach.lo : trolleyReach.hi) - tipInner),
    room = Math.max(0, gapNow - Math.round(tipLength * TIP_GAP_SHARE)),
    first = forward20 * ahead > 0 ? Math.sign(forward20) * Math.min(room, Math.abs(forward20)) : forward20,
    firstSlide = {
      x: forward20 ? (slide20.x * first) / forward20 : 0,
      y: forward20 ? (slide20.y * first) / forward20 : 0,
    },
    rest = forward20 - first;

  // the slide as far as the trolley may go. On a short slide (the trusses are all but there) it is skipped (UNSEEN)
  if (!unseen(Math.hypot(firstSlide.x, firstSlide.y))) {
    await Promise.all([
      trusses.by(0, 3000 * (first / forward20), firstSlide),
      moveTrolley(m.trolleyY - first, 3000 * (first / forward20)),
    ]);
    await pause(500);
  }
  Object.assign(m, { slide20, forward20, firstSlide, rest });
}

/** Step 25: the trolley drives to the middle support while the trusses slide the rest of the way (steps 25 and 26). */
export async function step25TrolleyToMiddleSupportAndSlideRest(m, nextBeam = m.secondBeam) {
  debugLog("[gantry] step 25: TrolleyToMiddleSupportAndSlideRest"); // TEMP
  const { unseen, truss, trolleyAt, moveTrolley, trusses, slide20, forward20, firstSlide, rest } = m;
  // 25. the trolley drives on its own to stop over the middle support (secondBeam), the next support ahead of it that lies
  // across the guideway: the third support, between it and the trolley, lies lengthwise, so it doesn't count. It is measured on the trusses as they lie now, after the
  // slide so far. Skipped when the trusses have no slide left.
  if (!unseen(Math.hypot(slide20.x - firstSlide.x, slide20.y - firstSlide.y))) {
    await moveTrolley(centreIn(nextBeam, truss).y - trolleyAt.y, 2500);
    await pause(500);

    debugLog("[gantry] step 26: SlideRestOfTheWay"); // TEMP
    // 26. the trusses slide the rest of the way, the trolley staying still over the middle support
    await Promise.all([
      trusses.by(0, 3000 * (rest / forward20), { x: slide20.x - firstSlide.x, y: slide20.y - firstSlide.y }),
      moveTrolley(m.trolleyY - rest, 3000 * (rest / forward20)),
    ]);
    await pause(500);
  }
}

/** Step 27: the trolley drives back to where it started on the trusses. */
async function step27TrolleyBackToStart(m) {
  debugLog("[gantry] step 27: TrolleyBackToStart"); // TEMP
  const { moveTrolley } = m;
  // 27. the trolley drives back to where it started on the trusses. Its offset is measured inside the trusses from where
  // it is drawn, so its starting place there is an offset of 0, wherever the trusses have gone.
  await moveTrolley(0, 3000);
  await pause(1000);
}

/** Step 28: the drawing snaps to the next span. */
export async function step28SnapToNextSpan(m) {
  debugLog("[gantry] step 28: SnapToNextSpan"); // TEMP
  const { svg, gantry, S } = m;
  // 28. the drawing is reset as if status.yaml said the next span with `hung: false`, as MapView draws it when the page
  // loads: every animation on the gantry is cancelled (each piece goes back to where placeGantry put it), the gantry is
  // put on the next span, and the spans behind it are drawn as hung (gantryProgress, with complete = false). Only the
  // drawing changes: the progress card still shows status.yaml's span. It's a sudden snap, not an animation: cancelling
  // drops every animation at once, and placeGantry() sets the new positions straight onto the drawing.
  gantry.getAnimations({ subtree: true }).forEach((a) => a.cancel());
  gantry.dataset.span = S + 1;
  placeGantry(svg);
  gantryProgress(svg, false);
}

/**
 * TEMP: draws the letters A, B and C over the supports so they can be told apart while the animation is worked on. They are
 * in a group of their own at the top of the map, outside the gantry (so nothing that measures the gantry sees them), and
 * every frame each letter is put on the middle of its beam, upright. Remove this function and its call in startMove.
 */
function addSupportLetters(svg, els) {
  if (!GANTRY_DEBUG) return;
  // made again on every move, so the letters follow the beams the gantry has now (an old layer's loop ends when it is removed)
  svg.querySelector("#temp-support-letters")?.remove();
  const layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  layer.setAttribute("id", "temp-support-letters");
  layer.setAttribute("pointer-events", "none");
  const letters = [
    ["A", els.secondBeam],
    ["B", els.thirdBeam],
    ["C", els.beam],
  ].map(([letter, beam]) => {
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("font-size", "11");
    text.setAttribute("font-weight", "bold");
    text.setAttribute("fill", "#ffffff");
    text.setAttribute("stroke", "#000000");
    text.setAttribute("stroke-width", "1.2");
    text.setAttribute("paint-order", "stroke");
    // Progress view hides every <text> with CSS (visibility: hidden !important); an inline !important wins over that
    text.style.setProperty("visibility", "visible", "important");
    text.textContent = letter;
    layer.appendChild(text);
    return [text, beam];
  });
  // TEMP: a marker on the middle of the trusses (halfway between the middles of the two trusses), which moves with them
  const marker = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  marker.setAttribute("r", "3");
  marker.setAttribute("fill", "#ff2d2d");
  marker.setAttribute("stroke", "#ffffff");
  marker.setAttribute("stroke-width", "1");
  // Progress view hides every circle with CSS (visibility: hidden !important); an inline !important wins over that
  marker.style.setProperty("visibility", "visible", "important");
  layer.appendChild(marker);
  const trussGroups = [...els.gantry.querySelectorAll(".clipper-truss")];
  svg.appendChild(layer);
  const follow = () => {
    if (!layer.isConnected) return;
    if (trussGroups.length) {
      const pts = trussGroups.map((t) => centreIn(t, svg));
      marker.setAttribute("cx", pts.reduce((a, q) => a + q.x, 0) / pts.length);
      marker.setAttribute("cy", pts.reduce((a, q) => a + q.y, 0) / pts.length);
    }
    for (const [text, beam] of letters) {
      if (!beam.getBoundingClientRect().width) continue;
      const c = centreIn(beam, svg);
      text.setAttribute("x", c.x);
      text.setAttribute("y", c.y);
    }
    requestAnimationFrame(follow);
  };
  follow();
} // TEMP

/**
 * The start every move shares: finds the gantry, lets the page settle, plays step 0 (the span fills in) and does the
 * measuring (prepare).
 * @param {SVGSVGElement} svg The map's <svg>, after placeGantry() has put the gantry on its span.
 * @returns {Promise<object|null>} What the steps share (see prepare); null when the drawing has no gantry, or no next
 * span for placeGantry's rules to find.
 */
export async function startMove(svg) {
  const els = findGantry(svg);
  if (!els) return null;
  addSupportLetters(svg, els); // TEMP
  // a moment for the page to settle and the gantry layer to show: a hidden element has no size to measure
  await pause(1000);
  // whether a move of `d` on the map would be too short to see (UNSEEN), measured as the map is shown on the screen now
  const shown = screen(svg),
    unseen = (d) => d * Math.hypot(shown.a, shown.b) < UNSEEN;
  await step0FillSpan(svg, els.trolley);
  return prepare(svg, els, unseen);
}

/**
 * A whole gantry move, from the span the gantry is on to the next one: the trolley carries the supports forward one by
 * one, the trusses go back for the front support and carry it on, and the trusses slide forward onto the next span.
 * Every final position is where placeGantry() puts that piece on the next span, and at the end the drawing snaps to it.
 * @param {SVGSVGElement} svg The map's <svg>, after placeGantry() has put the gantry on its span.
 * @returns {Promise<boolean>} Whether it moved the gantry on: false when the drawing has no gantry, or no next span for
 * placeGantry's rules to find.
 */
export async function playNormalMove(svg) {
  const gantry = svg.querySelector("#clayton-clipper"),
    halfway = gantry?.dataset.halfway === "true";
  if (halfway) delete gantry.dataset.halfway;
  const m = await startMove(svg);
  if (!m) return false;
  if (halfway) return playSecondHalf(m, true);
  holders(m, "second", "front"); // TEMP
  await step1TrolleyToFourthSupport(m);
  await step2CarryFourthSupportForward(m);
  await step3TurnFourthSupport(m);
  await step4SetFourthSupportDown(m);
  await step5TrolleyToSecondSupport(m);
  holders(m, "fourth", "front"); // TEMP
  await step6LiftSecondSupportAndBackUp(m);
  await step7TurnSecondSupportLengthwise(m);
  await step8CarrySecondSupportForward(m);
  await step9TurnSecondSupportToItsAngle(m);
  await step10SetSecondSupportDown(m);
  return playSecondHalf(m);
}

/**
 * The normal move from its step 11 on: the front support carried to the next span, the third support to the fourth's
 * place, and the trusses onto the next span. A walk that ends in the half-way layout (the fourth and second supports
 * already on their places, measured there by startMove()) starts here: neither has anything left to go (`secondGap`,
 * `backUp`).
 * @param {object} m What the steps share (startMove()), after step 10 or measured in the half-way layout.
 * @returns {Promise<boolean>} true: the gantry has moved on.
 */
async function playSecondHalf(m, handOff = false) {
  m.secondGap ??= { x: 0, y: 0 };
  m.backUp ??= 0;
  // handed over from a walk (walk.js): the supports stand where the walk left them, not where this move's first half
  // would have put them. When the fourth support already stands about where placeGantry() puts it on the next span, the
  // third support only has to go to its own place there (the rear one) instead of the fourth's: see step 20 below
  const places = handOff ? placesOn(m.svg, m.S + 1) : null,
    fourthNow = places && centreIn(m.beam, m.svg),
    toRearPlace =
      places &&
      Math.hypot(fourthNow.x - places.fourth.to.x, fourthNow.y - places.fourth.to.y) <
        Math.hypot(fourthNow.x - places.rear.to.x, fourthNow.y - places.rear.to.y);
  // the front support goes onto the place the snap gives it too (N's keeps how far across it stands now: under the trusses'
  // middle line in a walk, not where placeGantry() draws it)
  if (places) m.N.front.to = places.front.to;
  holders(m, "fourth", "front"); // TEMP
  await step11TrolleyBackToFourthSupport(m);
  await step12TrussesBackForFrontSupport(m);
  holders(m, "rear", "second"); // TEMP
  await step13CarryFrontSupportForward(m);
  holders(m, "fourth", "second"); // TEMP
  await step14FinishFrontSupportTrip(m);
  await step15SwingTrussesWithFrontSupport(m);
  await step16SwingTrussesBack(m);
  holders(m, "fourth", "front"); // TEMP
  await step17TrussesToHalfway(m);
  await step18TrolleyToThirdSupport(m);
  if (toRearPlace) await step20CarryThirdSupportToRearPlace(m, places.rear.to);
  else {
    // the fourth support's place on the next span as the snap puts it (N's is measured from where it stands now)
    if (places) m.N.fourth.to = places.fourth.to;
    await step19TurnThirdSupportLengthwise(m);
    await step20CarryThirdSupportToFourthPlace(m);
  }
  await step21TrolleyOverFourthSupport(m);
  await step22TrussesPastFrontSupport(m);
  await step23TurnTrussesOntoNextSpan(m);
  await step24SlideTrussesToNextSpan(m);
  holders(m, "second", "front"); // TEMP
  await step25TrolleyToMiddleSupportAndSlideRest(m);
  await step27TrolleyBackToStart(m);
  step28SnapToNextSpan(m);
  return true;
}
