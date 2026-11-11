// Clayton Clipper gantry animations, played by the layer panel's "animate" link (through ui.gantryPlaying and MapView).
//
// Every move uses the Web Animations API: el.animate(keyframes, options) slides an element from the first keyframe to the
// last, and returns an Animation whose `finished` promise lets the next step wait its turn (`await`). `fill: "forwards"`
// keeps each piece where its last move left it.

import { gantryMoves, placeGantry, DOUBLE_GIRDER } from "../lib/placeGantry.js";
import { gantryProgress } from "./gantryProgress.js";

/** Smooth starts and stops, and stay put at the end. */
const SMOOTH = { easing: "ease-in-out", fill: "forwards" };

/**
 * How fast the whole animation plays: every move's duration and every pause is divided by it, so 2 is twice as fast as
 * the times written in the steps, and 1 plays them as written. After the "animate" link, the moves play at SPEEDS in
 * turn, and every move after the last of them at that last speed (playToEnd sets it).
 */
const SPEEDS = [2, 3, 4];
let SPEED = SPEEDS[0];

/**
 * The matrix that turns `el`'s own coordinates into `frame`'s coordinates (both measured through the screen).
 * @param {SVGGraphicsElement} el
 * @param {SVGGraphicsElement} frame
 * @returns {DOMMatrix}
 */
const between = (el, frame) => screen(frame).inverse().multiply(screen(el));

/**
 * An element's getScreenCTM as a 2D DOMMatrix, from its six numbers (DOMMatrix.fromMatrix() can make one Chrome treats as
 * 3D, which can't then be multiplied with a 2D one).
 * @param {SVGGraphicsElement} el
 * @returns {DOMMatrix}
 */
function screen(el) {
  const m = el.getScreenCTM();
  return new DOMMatrix([m.a, m.b, m.c, m.d, m.e, m.f]);
}

/**
 * Half the length of `el`'s long side, in `frame`'s coordinates (both measured through the screen).
 * @param {SVGGraphicsElement} el
 * @param {SVGGraphicsElement} frame
 * @returns {number}
 */
function halfLength(el, frame) {
  const b = el.getBBox(),
    m = between(el, frame),
    o = new DOMPoint(b.x, b.y).matrixTransform(m),
    w = new DOMPoint(b.x + b.width, b.y).matrixTransform(m),
    h = new DOMPoint(b.x, b.y + b.height).matrixTransform(m);
  return Math.max(Math.hypot(w.x - o.x, w.y - o.y), Math.hypot(h.x - o.x, h.y - o.y)) / 2;
}

/**
 * The middle of `el`'s box, in `frame`'s coordinates.
 * @param {SVGGraphicsElement} el
 * @param {SVGGraphicsElement} frame
 * @returns {DOMPoint}
 */
function centreIn(el, frame) {
  const b = el.getBBox();
  return new DOMPoint(b.x + b.width / 2, b.y + b.height / 2).matrixTransform(between(el, frame));
}

/**
 * How far `el` reaches along y in `frame`: the lowest and highest y of its box's four corners there.
 * @param {SVGGraphicsElement} el
 * @param {SVGGraphicsElement} frame
 * @returns {{ lo: number, hi: number }}
 */
function reachIn(el, frame) {
  const b = el.getBBox(),
    m = between(el, frame);
  const ys = [
    [b.x, b.y],
    [b.x + b.width, b.y],
    [b.x, b.y + b.height],
    [b.x + b.width, b.y + b.height],
  ].map(([x, y]) => new DOMPoint(x, y).matrixTransform(m).y);
  return { lo: Math.min(...ys), hi: Math.max(...ys) };
}

/**
 * How far, in pixels on the screen, a step has to move something to be played: a step whose move would be shorter is
 * skipped, with its pause (on straight track the swings in steps 9 and 10, the turn in step 17 and the slide in step 20
 * come out at next to nothing, and would only hold the animation still). The drawing still ends up right: step 22 snaps
 * every piece to where placeGantry() puts it on the next span.
 */
const UNSEEN = 2;

/**
 * Counts the stops: stopGantry() adds one. A move notes it as it starts waiting, and gives up if it has changed by the
 * time the wait is over.
 */
let stops = 0;

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
const clock = () => performance.now() - heldFor - (heldAt == null ? 0 : performance.now() - heldAt);

/**
 * The waits under way (pause()): how long each has left, when it last started counting (performance.now()), its
 * timer, and what to do when it is up. holdGantry() stops their timers and resumeGantry() starts them again with what
 * they had left.
 * @type {Set<{ left: number, from: number, timer: number, up: () => void }>}
 */
const waits = new Set();

/** Starts a wait's timer for what it has left. */
function count(w) {
  w.from = performance.now();
  w.timer = setTimeout(w.up, w.left);
}

/** Waits `ms` milliseconds; fails instead if the gantry is stopped meanwhile, so the move it is part of goes no further. */
const pause = (ms) =>
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

/**
 * A whole gantry move, from the span the gantry is on to the next one: the trolley carries the supports forward one by
 * one, the trusses go back for the front support and carry it on, and the trusses slide forward onto the next span.
 * Every final position is where placeGantry() puts that piece on the next span, and at the end the drawing snaps to it.
 * @param {SVGSVGElement} svg The map's <svg>, after placeGantry() has put the gantry on its span.
 * @returns {Promise<boolean>} Whether it moved the gantry on: false when the drawing has no gantry, or no next span for
 * placeGantry's rules to find.
 */
export async function playGantry(svg) {
  const gantry = svg.querySelector("#clayton-clipper"),
    trolley = svg.querySelector("#clipper-trolley"),
    beam = svg.querySelector("#clipper-support-1"),
    frontBeam = svg.querySelector("#clipper-support-4-short"),
    secondBeam = svg.querySelector("#clipper-support-3"),
    thirdBeam = svg.querySelector("#clipper-support-2");
  if (!gantry || !trolley || !beam || !frontBeam || !secondBeam || !thirdBeam) return false;
  // a moment for the page to settle and the gantry layer to show: a hidden element has no size to measure
  await pause(1000);
  // whether a move of `d` on the map would be too short to see (UNSEEN), measured as the map is shown on the screen now
  const shown = screen(svg),
    unseen = (d) => d * Math.hypot(shown.a, shown.b) < UNSEEN;

  // 0. the span the gantry is on is drawn complete (all its segments hung) before the gantry moves: as MapView draws it
  // when status.yaml says `hung: true`, but only in the drawing (status.yaml isn't touched). Each piece that turns
  // finished fills in like a progress bar, from its east end to its west end, over FILL_TIME, in steps (more for a
  // longer span) (fillIn). The trolley takes part (followFill): it hurries to the east end, follows the fill front to
  // the west end, and hurries back. With nothing to fill (the span was already drawn hung), it just pauses.
  const unfinished = [...svg.querySelectorAll("polygon.guideway.cc.unfinished")].map((el) => [
    el,
    el.getAttribute("class"),
  ]);
  gantryProgress(svg, true);
  const filling = unfinished
    .filter(([el]) => !el.classList.contains("unfinished"))
    .map(([el, was]) => fillIn(svg, el, was))
    .filter(Boolean);
  if (filling.length) await followFill(trolley, filling);
  else await pause(1000);

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

  // THE FOURTH SUPPORT is four groups (beam, walkway and two pads) side by side in #clayton-clipper, all marked
  // data-anchor="fourth"; they get the same moves so they stay together.
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
  if (!next) return false;
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

  // where things are at the start, on the map: the second support (the pivot of step 9), the front and third supports'
  // middles, and the angles of the supports' long sides
  const pivot = centreIn(secondBeam, svg),
    secondStart = pivot,
    frontStart = centreIn(frontBeam, svg),
    thirdStart = centreIn(thirdBeam, svg),
    fourthAngle = lengthwise(beam),
    secondAngle = lengthwise(secondBeam),
    thirdAngle = lengthwise(thirdBeam);
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
  const FOURTH_TURNS_AT = 70 / 151;
  // PICKUP: a nudge, in truss units along y, to where the front tip stops when the trusses go back for the front support
  const PICKUP = -8;
  // THIRD_RIDES: how much of the front support's trip, at the end, the third support rides along for (0 to 1)
  const THIRD_RIDES = 25 / 121;

  // 1. the trolley slides from where it is to stop over the middle of the fourth support; there, the hangers the fill
  // put on the finished span come down
  await moveTrolley(beamAt.y - trolleyAt.y, 3000);
  clearHangers();
  await pause(500);

  // THE FOURTH SUPPORT'S TRIP: from where it starts (`middle`) to the second support's place on the next span
  // (N.second.to), split into the part along the trusses, which the trolley carrying it follows, and a small move
  // sideways that only the support makes
  const fourthGap = { x: N.second.to.x - middle.x, y: N.second.to.y - middle.y },
    fourthTrip = alongOf(fourthGap),
    fourthStraight = along(fourthTrip),
    fourthSide = { x: fourthGap.x - fourthStraight.x, y: fourthGap.y - fourthStraight.y };

  // 2. the trolley and the fourth support move forward together: the first part of its trip. On a double girder span
  // (DOUBLE_GIRDER, from placeGantry) the fourth support is drawn turned across the span, so when it is picked up there
  // it first turns a quarter turn clockwise (a positive turn on the map, where y points down).
  if (DOUBLE_GIRDER.has(S - 1)) {
    await moveFourth({ ...fourth, turn: fourth.turn + 90 }, 2000);
    await pause(500);
  }
  const leg1 = fourthTrip * FOURTH_TURNS_AT;
  let step = along(leg1);
  await Promise.all([
    moveTrolley(trolleyY + leg1, 2500),
    moveFourth({ ...fourth, x: fourth.x + step.x, y: fourth.y + step.y }, 2500),
  ]);
  await pause(500);

  // 3. the fourth support turns to lie the way the second support will on the next span: the second support's angle now
  // plus its turn on the move (N.second.turn), from the fourth support's angle now (where it started plus any turn in
  // step 2); of the ways round, the one nearest a quarter turn back
  await moveFourth(
    { ...fourth, turn: fourth.turn + nearest(secondAngle + N.second.turn - (fourthAngle + fourth.turn), -90) },
    2000,
  );

  // 4. the rest of its trip, with the move sideways: the fourth support ends on the second support's place
  const leg2 = fourthTrip - leg1;
  step = along(leg2);
  await Promise.all([
    moveTrolley(trolleyY + leg2, 2500),
    moveFourth({ ...fourth, x: fourth.x + step.x + fourthSide.x, y: fourth.y + step.y + fourthSide.y }, 2500),
  ]);
  await pause(500);

  // 5. the trolley slides back to stop over the middle of the second support (the trusses haven't moved yet, so this is
  // measured the same way as step 1)
  await moveTrolley(secondAt.y - trolleyAt.y, 3000);
  await pause(500);

  // 6. The trusses slide back so they can pick up the front supprt: until the front tip is over the middle of the front
  // support (nudged by PICKUP). The trolley rides on the trusses, so it is moved forward the same distance at the same
  // time, with the same timing and easing: the two moves cancel out at every moment, and it stays still over the second
  // support.
  const back = frontAt.y - tipAt.y + PICKUP;
  await Promise.all([trusses.by(back, 3000), moveTrolley(trolleyY - back, 3000)]);
  await pause(500);

  // THE FRONT SUPPORT'S TRIP along the trusses: after the swing in step 9 it has to be on its place on the next span
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
    ride = frontTrip * THIRD_RIDES,
    alone = frontTrip - ride;

  // 7. the trusses carry the front support forward, the first part of its trip, and the trolley stays still over the
  // second support (moved back inside the trusses as they go forward, as in step 6)
  await Promise.all([trusses.by(alone, 2500), front.by(alone, 2500), moveTrolley(trolleyY - alone, 2500)]);
  await pause(500);

  // 8. the rest of its trip, with the third support riding along too, and the trolley still stays still
  await Promise.all([
    trusses.by(ride, 1500),
    front.by(ride, 1500),
    third.by(ride, 1500),
    moveTrolley(trolleyY - ride, 1500),
  ]);
  await pause(500);

  // 9. the trusses stay on the second support and their front end swings, carrying the front support, until the front
  // support is on its place on the next span: the turn from where it is now to N.front.to, seen from the pivot. The
  // trolley, parked over the pivot, turns where it is.
  const frontSlid = along(front.at),
    turn = small(
      deg({ x: frontTo.x - pivot.x, y: frontTo.y - pivot.y }) -
        deg({ x: frontStart.x + frontSlid.x - pivot.x, y: frontStart.y + frontSlid.y - pivot.y }),
    );
  // How far the swing carries the front end: the arc the front support's middle follows. On straight track `turn` is next
  // to nothing, and steps 9 and 10 skip the swing (UNSEEN).
  const swingArc = (Math.hypot(frontTo.x - pivot.x, frontTo.y - pivot.y) * Math.abs(turn) * Math.PI) / 180,
    swings = !unseen(swingArc);
  if (swings) {
    await Promise.all([trusses.swing(pivot, turn, 3000), front.swing(pivot, turn, 3000)]);
    await pause(500);
  }

  // 10. the trusses swing back the same way to where they were, leaving the front support on its place; at the same time
  // it turns about its own middle to the angle it has there (its whole turn on the move is N.front.turn, and the swing
  // has done `turn` of it)
  // The front support's own turn is played if the ends of its beam would move far enough to see, even without the swing.
  const frontEnds = (halfLength(frontBeam, svg) * Math.abs(N.front.turn - turn) * Math.PI) / 180,
    tenMoves = [
      ...(swings ? [trusses.swing(pivot, -turn, 3000)] : []),
      ...(unseen(frontEnds) ? [] : [front.swing(frontTo, N.front.turn - turn, 3000)]),
    ];
  if (tenMoves.length) {
    await Promise.all(tenMoves);
    await pause(500);
  }

  // 11. the trusses slide back until their middle is halfway between the fourth support and the second support. The
  // third and front supports stay where they are, and the trolley stays still over the second support, as in step 6.
  // How far the fourth support has gone along the trusses: its moves are kept as x, y on the map (alongOf).
  const fourthAlong = alongOf(fourth),
    halfway = (beamAt.y + fourthAlong + secondAt.y) / 2,
    toMiddle = halfway - (trussMiddleY + trusses.at);
  await Promise.all([trusses.by(toMiddle, 3000), moveTrolley(trolleyY - toMiddle, 3000)]);
  await pause(500);

  // 12. the trolley slides back to stop over the third support, now the one at the rear. The third support is where it
  // started plus its slide (third.at); the trolley's own offset is measured inside the trusses, which have moved
  // (trusses.at), so that is taken off.
  await moveTrolley(thirdAt.y + third.at - trolleyAt.y - trusses.at, 3000);
  await pause(500);

  // WHICH WAY THE FOURTH SUPPORT LIES ON THE NEXT SPAN, on span S (just behind it): lengthwise, or turned across on a
  // double girder span (DOUBLE_GIRDER). gantryMoves() turns it from how it lies now and adds the double girder's quarter
  // turn on top, so when it is already turned across now (span S − 1 is a double girder) that quarter turn is taken
  // back out once: fourthFinal is its true angle there, and fourthLengthwise the angle it would have lying lengthwise.
  const acrossNow = DOUBLE_GIRDER.has(S - 1) ? -90 : 0,
    acrossNext = DOUBLE_GIRDER.has(S) ? -90 : 0,
    fourthFinal = fourthAngle + N.fourth.turn - acrossNow,
    fourthLengthwise = fourthFinal - acrossNext;

  // 13. the third support turns about its own middle (where it started plus its slide) to lie lengthwise, the way the
  // fourth support lies on the next span unless that's a double girder span (step 14 turns it across then); of the ways
  // round, the one nearest a quarter turn. swing() turns in the map's frame, so it keeps its shape.
  const slidThird = along(third.at),
    thirdTurn = nearest(fourthLengthwise - thirdAngle, 90);
  await third.swing({ x: thirdStart.x + slidThird.x, y: thirdStart.y + slidThird.y }, thirdTurn, 2000);
  await pause(500);

  // 14. the trolley carries the third support to the fourth support's place on the next span (N.fourth.to). The gap is
  // split into the part along the trusses (alongOf), which the trolley follows, and what's left over, a small move
  // sideways that only the support makes. (The slide's `translate` sits outside the turn, so the turned support moves
  // as it is.)
  const thirdNow = along(third.at),
    gap = { x: N.fourth.to.x - (thirdStart.x + thirdNow.x), y: N.fourth.to.y - (thirdStart.y + thirdNow.y) },
    forward = alongOf(gap),
    straight = along(forward),
    sideways = { x: gap.x - straight.x, y: gap.y - straight.y };
  await Promise.all([third.by(forward, 2500, sideways), moveTrolley(trolleyY + forward, 2500)]);
  await pause(500);
  // on a double girder span it is set down turned across the span, as placeGantry draws the fourth support there: a
  // quarter turn about its middle (now on N.fourth.to) from lengthwise to fourthFinal, the way back from step 2's turn
  // (anticlockwise) when either way would do
  if (acrossNext) {
    await third.swing(N.fourth.to, nearest(fourthFinal - (thirdAngle + thirdTurn), -90), 2000);
    await pause(500);
  }

  // 15. the trolley slides on its own to stop over the fourth support, leaving the third support where step 14 put it.
  // The fourth support hasn't moved since step 11, so it is still where it started plus fourthAlong; take off the
  // trolley's drawn position and the trusses' slide, as in step 12.
  await moveTrolley(beamAt.y + fourthAlong - trolleyAt.y - trusses.at, 2500);
  await pause(500);

  // 16. the trusses slide forward until their front ends (where the yellow truss lines stop) are just past the front
  // support, and the trolley stays still over the fourth support. Measured as things are now: the browser counts the
  // animations so far when it measures, and the truss frame moves with the trusses, so the front support's position
  // there is where it is relative to the trusses. "Front" edges depend on which way along y is forward (`ahead`).
  // GAP: how far past the front support's front edge the truss ends stop. Make it bigger to go further, smaller (or
  // negative) to stop sooner.
  const GAP = 2;
  const lines = [...gantry.querySelectorAll(".clipper-truss line")].map((l) => reachIn(l, truss)),
    trussFront = ahead > 0 ? Math.max(...lines.map((r) => r.hi)) : Math.min(...lines.map((r) => r.lo)),
    supportReach = reachIn(frontBeam, truss),
    supportFront = ahead > 0 ? supportReach.hi : supportReach.lo,
    past = supportFront + ahead * GAP - trussFront;
  await Promise.all([trusses.by(past, 2500), moveTrolley(trolleyY - past, 2500)]);
  await pause(500);

  // 17. the trusses turn and shift onto the line they have on the next span: through N.body.to (where their middle goes)
  // at their angle at the start plus their turn on the move (N.body.turn). They swing about the fourth support's middle,
  // where the trolley is parked, after a shift straight across: the shift has to put their middle line through the
  // point that the swing then carries onto N.body.to, which is N.body.to turned back about the pivot.
  const fourthMid = centreIn(beam, svg),
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

  // 18. the trusses slide forward until their rear ends (where the yellow truss lines stop at the back) are over the
  // middle of the second support, and the trolley stays still over the fourth support. Measured in the truss frame,
  // which has moved and turned with the trusses, so y there is along the trusses as they lie now (step 17's angle): the
  // second support's middle there is where it is relative to them. `lines` (step 16) are the truss lines' reach, which
  // doesn't change in their own frame.
  // REAR_PAST: how far past the second support's middle the rear ends stop. Bigger goes further forward, negative stops
  // short of the middle.
  const REAR_PAST = 0;
  const secondNow = centreIn(secondBeam, truss).y,
    rearEnd = ahead > 0 ? Math.min(...lines.map((r) => r.lo)) : Math.max(...lines.map((r) => r.hi)),
    forward18 = secondNow + ahead * REAR_PAST - rearEnd;
  // by() takes the slide as an x, y move on the map: a move of 1 along the trusses as they lie now is (c, d) of the truss
  // frame's matrix onto the map, as `along` was for their old direction
  const nowOnMap = between(truss, svg),
    unitNow = { x: nowOnMap.c, y: nowOnMap.d },
    slide = { x: unitNow.x * forward18, y: unitNow.y * forward18 };
  await Promise.all([trusses.by(0, 3000, slide), moveTrolley(trolleyY - forward18, 3000)]);
  await pause(500);

  // 19. the trusses carry the second support to the rear support's place on the next span (N.rear.to), turning it to
  // the angle the rear support has there (the third support's angle at the start plus its turn on the move,
  // N.rear.turn), and the trolley stays still over the fourth support. The trusses slide along themselves by the part
  // of the gap that runs along them; the support also makes the small move sideways. Its slide is started before its
  // turn, so it turns about its middle as the slide leaves it (as in step 17).
  const rearGap = { x: N.rear.to.x - secondStart.x, y: N.rear.to.y - secondStart.y },
    forward19 = (rearGap.x * unitNow.x + rearGap.y * unitNow.y) / (unitNow.x * unitNow.x + unitNow.y * unitNow.y),
    slide19 = { x: unitNow.x * forward19, y: unitNow.y * forward19 };
  await Promise.all([
    trusses.by(0, 2000, slide19),
    second.by(0, 2000, rearGap),
    second.swing(N.rear.to, nearest(thirdAngle + N.rear.turn - secondAngle, 0), 2000),
    moveTrolley(trolleyY - forward19, 2000),
  ]);
  await pause(500);

  // 20. the trusses slide forward on their own until their middle is on its place on the next span (N.body.to), and the
  // trolley stays still over the fourth support. Step 17 put them on the right line, so this slide runs along it. The
  // trolley's cancelling move is that slide in truss units, measured against a move of 1 along the trusses as they lie
  // now (the dot product again).
  const middleNow = trussesMiddle(),
    slide20 = { x: N.body.to.x - middleNow.x, y: N.body.to.y - middleNow.y },
    forward20 = (slide20.x * unitNow.x + slide20.y * unitNow.y) / (unitNow.x * unitNow.x + unitNow.y * unitNow.y);
  // step 19 usually leaves the trusses all but there, and then the slide is skipped (UNSEEN)
  if (!unseen(Math.hypot(slide20.x, slide20.y))) {
    await Promise.all([trusses.by(0, 3000, slide20), moveTrolley(trolleyY - forward20, 3000)]);
    await pause(500);
  }

  // 21. the trolley drives back to where it started on the trusses. Its offset is measured inside the trusses from where
  // it is drawn, so its starting place there is an offset of 0, wherever the trusses have gone.
  await moveTrolley(0, 3000);
  await pause(1000);

  // 22. the drawing is reset as if status.yaml said the next span with `hung: false`, as MapView draws it when the page
  // loads: every animation on the gantry is cancelled (each piece goes back to where placeGantry put it), the gantry is
  // put on the next span, and the spans behind it are drawn as hung (gantryProgress, with complete = false). Only the
  // drawing changes: the progress card still shows status.yaml's span. It's a sudden snap, not an animation: cancelling
  // drops every animation at once, and placeGantry() sets the new positions straight onto the drawing.
  gantry.getAnimations({ subtree: true }).forEach((a) => a.cancel());
  gantry.dataset.span = S + 1;
  placeGantry(svg);
  gantryProgress(svg, false);
  return true;
}

/**
 * Plays gantry moves one after another, span by span, until the gantry is on span `last` or can't go any further.
 * @param {SVGSVGElement} svg The map's <svg>.
 * @param {number} [last] The span to stop on.
 * @returns {Promise<void>}
 */
export async function playToEnd(svg, last = 106) {
  const gantry = svg.querySelector("#clayton-clipper");
  if (!gantry) return;
  // the drawing as it is before the first move, for stopGantry() to put back: the span the gantry is on, and the classes
  // gantryProgress() changes as the gantry moves on (on the guideway pieces, arrows and span numbers)
  before ??= {
    span: gantry.dataset.span,
    classes: [...svg.querySelectorAll(PROGRESS_MARKED)].map((el) => [el, el.getAttribute("class")]),
  };
  const at = stops;
  let moved = 0;
  SPEED = SPEEDS[0];
  try {
    while (+gantry.dataset.span < last && (await playGantry(svg))) SPEED = SPEEDS[Math.min(++moved, SPEEDS.length - 1)];
  } catch (error) {
    // a stop makes the move under way give up (see pause() and stopGantry()); anything else is a real error
    if (at === stops) throw error;
  }
}

/** What gantryProgress() marks as the gantry moves on: the guideway pieces, their arrows and the span numbers. */
const PROGRESS_MARKED = "polygon.guideway, .arrow-pending, text.guideway, text.ccnumber";

/** The drawing before the "animate" link's first move, saved by playToEnd(); null when nothing has moved. */
let before = null;

/**
 * Stops the gantry's moves and puts the drawing back as it was before the first one, as status.yaml has it: every
 * animation on the gantry is cancelled (each piece goes back to where placeGantry put it, and the move under way gives up
 * at its next step), the classes gantryProgress() changed are put back, and the gantry is placed on its span again.
 * @param {SVGSVGElement} svg The map's <svg>.
 */
export function stopGantry(svg) {
  const gantry = svg?.querySelector("#clayton-clipper");
  if (!gantry) return;
  stops++;
  // a held gantry lets go first, and the waits give up straight away rather than waiting out what they had left
  resumeGantry();
  waits.forEach((w) => w.up());
  fills.forEach((end) => end());
  clearHangers();
  gantry.getAnimations({ subtree: true }).forEach((a) => a.cancel());
  if (!before) return;
  before.classes.forEach(([el, c]) => (c == null ? el.removeAttribute("class") : el.setAttribute("class", c)));
  gantry.dataset.span = before.span;
  placeGantry(svg);
  before = null;
}

/** The supports, as the Supports switch shows and hides them. */
const SUPPORTS = 'rect.g, circle[fill="#D7D7D7"]';
/** What counts as a span when the supports are moved below them. */
const SPANS = "polygon.guideway";

/**
 * Where lowerSupports() took each support from, [element, parent, next sibling], in the drawing's order; empty when the
 * supports are where map.svg has them.
 * @type {Array<[Element, Node, Node|null]>}
 */
let lowered = [];

/**
 * Moves the supports below the spans, for while the gantry animates. Each support (or the group it is in, up to the
 * group that also holds spans) goes just before the first spans that came ahead of it in the same group, without going
 * past an aerial photo, so it stays above the photos and the roads. The geometry doesn't change: only the order the
 * pieces are drawn in. raiseSupports() puts them back.
 * @param {SVGSVGElement} svg The map's <svg>.
 * @returns {void}
 */
export function lowerSupports(svg) {
  if (lowered.length) return;
  const units = new Set();
  svg.querySelectorAll(SUPPORTS).forEach((el) => {
    let unit = el;
    while (unit.parentNode !== svg && !unit.parentNode.querySelector(SPANS)) unit = unit.parentNode;
    if (unit.parentNode !== svg) units.add(unit);
  });
  for (const unit of units) {
    let below = null;
    for (let s = unit.previousElementSibling; s; s = s.previousElementSibling) {
      if (s.matches("image") || s.querySelector("image")) break;
      if (s.matches(SPANS) || s.querySelector(SPANS)) below = s;
    }
    if (!below) continue;
    lowered.push([unit, unit.parentNode, unit.nextSibling]);
    below.before(unit);
  }
}

/**
 * Puts the supports back where map.svg has them, above the spans (the last one moved goes back first, so every next
 * sibling is already in its place).
 * @returns {void}
 */
export function raiseSupports() {
  for (const [el, parent, next] of lowered.reverse()) parent.insertBefore(el, next);
  lowered = [];
}

/** How long a span takes to fill in when it turns finished, in milliseconds as written (divided by SPEED like every move). */
const FILL_TIME = 6000;
/**
 * How many equal steps a piece fills in by (and so how many hangers it gets): FILL_STEPS for a piece as long as span
 * BASELINE_SPAN's, more or fewer in proportion to its length, to the nearest whole step (at least one). See fillSteps.
 */
const FILL_STEPS = 12;
const BASELINE_SPAN = 39;
/**
 * The length of span BASELINE_SPAN's gantry box (the piece that fills in: p while it's unfinished, gi once it's
 * finished, not the span's ramp pieces), measured once, as axisOf measures a piece.
 */
let baselineLength = null;

/**
 * How many steps a piece of this length fills in by: FILL_STEPS for span BASELINE_SPAN's length, in proportion for
 * others, rounded to a whole number and never less than one.
 * @param {SVGSVGElement} svg The map's <svg>.
 * @param {number} length The piece's length, as axisOf measures it.
 * @returns {number}
 */
function fillSteps(svg, length) {
  baselineLength ??= Math.max(
    0,
    ...[...svg.querySelectorAll(`polygon.guideway.cc[data-span="${BASELINE_SPAN}"]:is(.p, .gi)`)].map(
      (el) => axisOf(svg, el)?.length ?? 0,
    ),
  );
  if (!baselineLength) return FILL_STEPS;
  return Math.max(1, Math.round((FILL_STEPS * length) / baselineLength));
}

/**
 * A guideway piece's length and direction in the map's own frame (#map-turn's, where east is to the right whatever the
 * view's turn): the main axis of its corners (the direction they spread out most along), pointing west.
 * @param {SVGSVGElement} svg The map's <svg>.
 * @param {SVGPolygonElement} el The piece.
 * @returns {{ turn: SVGGraphicsElement, toPiece: DOMMatrix, cx: number, cy: number, u: { x: number, y: number },
 *   v: { x: number, y: number }, from: number, to: number, length: number, across: number }|null} The map's frame, the
 * matrix back to the piece's coordinates, the piece's middle, its direction west (u) and across (v), how far along u
 * its east and west ends are, its length, and how far across it reaches (with 10 to spare); null for a piece with no
 * shape.
 */
function axisOf(svg, el) {
  const turn = svg.querySelector("#map-turn") ?? svg,
    toMap = turn.getCTM().inverse().multiply(el.getCTM());
  const pts = [...el.points].map((p) => new DOMPoint(p.x, p.y).matrixTransform(toMap));
  if (pts.length < 3) return null;
  const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length,
    cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  let xx = 0,
    xy = 0,
    yy = 0;
  pts.forEach((p) => {
    xx += (p.x - cx) ** 2;
    xy += (p.x - cx) * (p.y - cy);
    yy += (p.y - cy) ** 2;
  });
  const angle = Math.atan2(2 * xy, xx - yy) / 2;
  let u = { x: Math.cos(angle), y: Math.sin(angle) };
  if (u.x > 0) u = { x: -u.x, y: -u.y };
  const v = { x: -u.y, y: u.x },
    along = pts.map((p) => (p.x - cx) * u.x + (p.y - cy) * u.y),
    from = Math.min(...along),
    to = Math.max(...along);
  return {
    turn,
    toPiece: toMap.inverse(),
    cx,
    cy,
    u,
    v,
    from,
    to,
    length: to - from,
    across: Math.max(...pts.map((p) => Math.abs((p.x - cx) * v.x + (p.y - cy) * v.y))) + 10,
  };
}
/** The fills under way, each as the function that ends it at once (stopGantry ends them all). */
const fills = new Set();
let fillCount = 0;
/**
 * The hangers drawn by fills (one group per piece), kept until the trolley gets to the fourth support at the start of
 * the move (playGantry's step 1) or the animation is stopped.
 */
const hangers = new Set();

/** A hanger's size against the gantry's blue tips: HANGER_LENGTH times as long, HANGER_WIDTH times as wide. */
const HANGER_LENGTH = 1.2;
const HANGER_WIDTH = 0.8;

/** Takes the fills' hangers away. */
function clearHangers() {
  hangers.forEach((g) => g.remove());
  hangers.clear();
}

/**
 * Fills in a guideway piece that has just turned finished, like a progress bar: its finished look fills from its east
 * end to its west end over FILL_TIME, in a number of equal steps for its length (fillSteps), with a hanger on each,
 * over a copy of the piece in the look it had before (shown or hidden by the layer switches like any unfinished piece).
 * The finished piece is clipped by a strip that grows across it; the strip is worked out in the map's own frame
 * (axisOf: east is to the right, whatever the view's turn) and drawn in the piece's coordinates. The piece shows
 * unfinished until start() is called.
 * @param {SVGSVGElement} svg The map's <svg>.
 * @param {SVGPolygonElement} el The piece, now finished.
 * @param {string} was Its class before it turned finished.
 * @returns {{ east: DOMPoint, west: DOMPoint, length: number, start: () => void }|null} The middles of the piece's east
 * and west ends on the screen (where the fill starts and stops), its length, and start(), which starts the fill; null
 * for a piece with no shape to fill.
 */
function fillIn(svg, el, was) {
  const axis = axisOf(svg, el);
  if (!axis) return null;
  const { turn, toPiece, cx, cy, u, v, from, to, across } = axis,
    // how many steps (and hangers) this piece fills in by, for its length
    steps = fillSteps(svg, axis.length);
  // the strip from the east end to `s` along the piece, in the piece's own coordinates
  const strip = (s) =>
    [
      [from, -across],
      [s, -across],
      [s, across],
      [from, across],
    ]
      .map(([a, b]) => new DOMPoint(cx + u.x * a + v.x * b, cy + u.y * a + v.y * b).matrixTransform(toPiece))
      .map((p) => `${p.x},${p.y}`)
      .join(" ");
  const ns = "http://www.w3.org/2000/svg",
    id = `fill-clip-${++fillCount}`,
    clip = document.createElementNS(ns, "clipPath"),
    shape = document.createElementNS(ns, "polygon"),
    under = el.cloneNode(false);
  clip.id = id;
  clip.setAttribute("clipPathUnits", "userSpaceOnUse");
  shape.setAttribute("points", strip(from));
  clip.append(shape);
  under.removeAttribute("id");
  under.setAttribute("class", was);
  under.setAttribute("aria-hidden", "true");
  el.before(clip, under);
  el.setAttribute("clip-path", `url(#${id})`);
  let frame;
  const end = () => {
    cancelAnimationFrame(frame);
    el.removeAttribute("clip-path");
    clip.remove();
    under.remove();
    fills.delete(end);
  };
  fills.add(end);

  // HANGERS: as each step fills, a hanger is drawn on it: a rectangle sized from the gantry's blue tips (.clipper-tip),
  // HANGER_LENGTH times as long and HANGER_WIDTH times as wide, in the darker blue and the opacity of the gantry's
  // walkways (.clipper-walkway; the tips' solid blue if there are none), its long side across the guideway, centred on
  // the step. The tip's two sides are measured in the map's frame, where the gantry's squash doesn't bend them. They go
  // in a group just above the piece, in its coordinates.
  const tip = svg.querySelector(".clipper-tip"),
    walkway = svg.querySelector(".clipper-walkway"),
    colour = walkway?.getAttribute("fill") ?? tip?.getAttribute("fill") ?? "currentColor",
    opacity = walkway?.getAttribute("opacity"),
    group = document.createElementNS(ns, "g");
  let short = 0,
    long = 0;
  if (tip) {
    const b = tip.getBBox(),
      tipToMap = turn.getCTM().inverse().multiply(tip.getCTM()),
      at = (x, y) => new DOMPoint(x, y).matrixTransform(tipToMap),
      o = at(b.x, b.y),
      w = at(b.x + b.width, b.y),
      h = at(b.x, b.y + b.height),
      sides = [Math.hypot(w.x - o.x, w.y - o.y), Math.hypot(h.x - o.x, h.y - o.y)];
    short = Math.min(...sides) * HANGER_WIDTH;
    long = Math.max(...sides) * HANGER_LENGTH;
  }
  if (el.getAttribute("transform")) group.setAttribute("transform", el.getAttribute("transform"));
  group.setAttribute("class", "clipper-hangers");
  group.setAttribute("aria-hidden", "true");
  const hang = (i) => {
    if (!tip) return;
    const a = from + ((to - from) * (i + 0.5)) / steps,
      hanger = document.createElementNS(ns, "polygon");
    hanger.setAttribute(
      "points",
      [
        [a - short / 2, -long / 2],
        [a + short / 2, -long / 2],
        [a + short / 2, long / 2],
        [a - short / 2, long / 2],
      ]
        .map(([s, t]) => new DOMPoint(cx + u.x * s + v.x * t, cy + u.y * s + v.y * t).matrixTransform(toPiece))
        .map((p) => `${p.x},${p.y}`)
        .join(" "),
    );
    hanger.setAttribute("fill", colour);
    if (opacity) hanger.setAttribute("opacity", opacity);
    group.append(hanger);
  };

  // the middles of the piece's two ends, on the screen
  const onScreen = screen(turn),
    endAt = (a) => new DOMPoint(cx + u.x * a, cy + u.y * a).matrixTransform(onScreen);
  return {
    east: endAt(from),
    west: endAt(to),
    length: to - from,
    start() {
      // timed by clock(), so a held gantry's fill waits where it is
      const t0 = clock(),
        fillTime = FILL_TIME / SPEED;
      let shown = 0;
      el.after(group);
      hangers.add(group);
      const step = () => {
        // the steps filled so far: one more every fillTime / steps, the last one when fillTime is up; each step
        // that has just filled gets its hanger
        const k = Math.min(steps, Math.floor(((clock() - t0) / fillTime) * steps)),
          was = shown;
        while (shown < k) hang(shown++);
        if (k === steps) return end();
        if (shown !== was) shape.setAttribute("points", strip(from + ((to - from) * k) / steps));
        frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    },
  };
}

/**
 * How long the trolley takes to get to the start of a fill and back afterwards, in milliseconds as written (divided by
 * SPEED like every move): half its usual 3000, so it hurries there and back.
 */
const FILL_TROLLEY_TIME = 1500;

/**
 * The trolley's part in a fill: it hurries along the trusses to the east end of the span (where the fill starts),
 * starts the fills, follows the fill front to the west end over FILL_TIME, then hurries back to where it was. It
 * follows the longest piece that fills; the ends are measured in the truss frame (the trolley's parent group, where the
 * trusses run along y), from where the trolley is drawn, as moveTrolley() measures it.
 * @param {SVGGraphicsElement} trolley #clipper-trolley, with no move of its own under way.
 * @param {ReturnType<typeof fillIn>[]} pieces The pieces filling in.
 * @returns {Promise<void>} Done when the trolley is back.
 */
async function followFill(trolley, pieces) {
  const truss = trolley.parentNode,
    toTruss = screen(truss).inverse(),
    drawnAt = centreIn(trolley, truss).y,
    longest = pieces.reduce((a, b) => (b.length > a.length ? b : a)),
    east = longest.east.matrixTransform(toTruss).y - drawnAt,
    west = longest.west.matrixTransform(toTruss).y - drawnAt;
  const go = (from, to, ms, easing) =>
    trolley.animate([{ translate: `0 ${from}px` }, { translate: `0 ${to}px` }], {
      duration: ms,
      easing,
      fill: "forwards",
    }).finished;
  await go(0, east, FILL_TROLLEY_TIME / SPEED, "ease-in-out");
  pieces.forEach((p) => p.start());
  // the fill's time, divided by SPEED like the fill itself, and at a steady pace like the fill's equal steps
  await go(east, west, FILL_TIME / SPEED, "linear");
  await go(west, 0, FILL_TROLLEY_TIME / SPEED, "ease-in-out");
}
