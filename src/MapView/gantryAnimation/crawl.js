// The crawl over the double girder spans: the gantry moves on its three long supports (A, B and C) and the trolley crane.
// Each move the trolley anchors on the front support, the trusses are pushed forward, and the rear support is picked up,
// turned, carried to a place `step` in front of the front support, turned back and set down: it is the new front support.
// See docs/double-girder/2-the-crawl.md.

import { gantryMoves, stackSupports } from "../../lib/placeGantry.js";
import { DOUBLE_GIRDER } from "../../lib/doubleGirder.js";
import { SPEED, nextSpeed, pause } from "./clock.js";
import { guidewayLine } from "./guideway.js";
import { between, centreIn, reachIn } from "./measure.js";
import { slideC, swingC } from "./supports.js";
import { debugLog } from "./debug.js";

/** The span whose length sets `Dmax` for every crawl (half of it; see DMAX_SHARE). */
const DMAX_REFERENCE_SPAN = 42;
/** `Dmax` is this share of the reference span's length: the most the gantry advances in one move. Tune after watching. */
const DMAX_SHARE = 0.5;
/** The trusses are pushed back this share of their length in the middle of a move, while the carried support waits. */
const BACK_SHARE = 0.13;
/** The trusses are pushed forward until this share of their length is in front of the middle support. */
const PUSH_SHARE = 0.66;
/** The most moves played, for checking one at a time: Infinity plays the whole crawl. */
const MAX_MOVES = Infinity;

const dot = (a, b) => a.x * b.x + a.y * b.y,
  sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });

/** The angle on the map, in degrees, of a beam's long side. */
function angleOf(el, svg) {
  const b = el.getBBox(),
    to = between(el, svg),
    o = new DOMPoint(b.x, b.y).matrixTransform(to),
    w = new DOMPoint(b.x + b.width, b.y).matrixTransform(to),
    h = new DOMPoint(b.x, b.y + b.height).matrixTransform(to),
    across = { x: w.x - o.x, y: w.y - o.y },
    down = { x: h.x - o.x, y: h.y - o.y },
    long = Math.hypot(across.x, across.y) >= Math.hypot(down.x, down.y) ? across : down;
  return (Math.atan2(long.y, long.x) * 180) / Math.PI;
}

/**
 * The three long supports, each with its beam, its anchor (for stacking) and how it is slid and swung: A and B by their
 * sliders, C by the helpers in supports.js.
 */
function longSupports(m) {
  return {
    A: {
      name: "A",
      beam: m.secondBeam,
      anchor: "second",
      by: (d, ms, side) => m.second.by(d, ms, side),
      swing: (p, t, ms) => m.second.swing(p, t, ms),
    },
    B: {
      name: "B",
      beam: m.thirdBeam,
      anchor: "rear",
      by: (d, ms, side) => m.third.by(d, ms, side),
      swing: (p, t, ms) => m.third.swing(p, t, ms),
    },
    C: {
      name: "C",
      beam: m.beam,
      anchor: "fourth",
      by: (d, ms, side) => slideC(m, d, ms, side),
      swing: (p, t, ms) => swingC(m, p, t, ms),
    },
  };
}

/**
 * Puts Support C's wheel assemblies back in the middle of its beam: the move before the crawl slid them (m.wheelShift) to the
 * middle of the unfinished span, and they are centred on the beam again for the crawl.
 */
function centreCWheels(m) {
  const fromMap = between(m.gantry, m.svg).inverse(),
    by = m.wheelShift,
    shifted = `${fromMap.a * by.x + fromMap.c * by.y}px ${fromMap.b * by.x + fromMap.d * by.y}px`;
  return Promise.all(
    [...m.gantry.querySelectorAll(':scope > [data-anchor="fourth"]')]
      .filter((g) => g.querySelector(":scope > .gantry-support-wheels"))
      .map(
        (g) =>
          g.animate([{ translate: shifted }, { translate: "0px 0px" }], {
            duration: 1500 / SPEED,
            easing: "ease-in-out",
            fill: "forwards",
          }).finished,
      ),
  );
}

/**
 * One crawl move. `roles` are the three long supports: R the rear one, M the middle one and F the front one. It ends with R
 * set down `sTarget` along the guideway line, which makes it the new front support.
 * @param {object} m The shared object.
 * @param {ReturnType<typeof guidewayLine>} line The guideway over the crawl.
 * @param {{ R: object, M: object, F: object }} roles
 * @param {number} sTarget How far along the line R is set down.
 */
async function leapfrog(m, line, roles, sTarget) {
  const { svg, gantry, truss, trolleyAt, ahead, trusses, moveTrolley, alongOf, along, nearest, deg, small, unseen } = m;
  const { R, M, F } = roles;
  const mid = (s) => centreIn(s.beam, svg);
  // a point on the map as a position on the truss frame's y axis, as the trusses lie now
  const trussY = (p) => new DOMPoint(p.x, p.y).matrixTransform(between(truss, svg).inverse()).y;
  const overSupport = async (s) => {
    await moveTrolley(centreIn(s.beam, truss).y - trolleyAt.y, 2500);
    await pause(500);
  };

  // 1. the trolley goes to the front support and anchors there: it sits still over it while the trusses move
  debugLog(`[gantry] crawl: trolley to ${F.name} (front)`); // TEMP
  await overSupport(F);

  // 2. with the trolley anchored over the front support, the trusses are pushed forward until PUSH_SHARE of their length is in
  // front of the middle support, and at the same time squared up on the two supports that hold the gantry (M and F): their
  // line is made to run through the middle of both beams, so the ends of the beams stick out the same distance on both sides
  // of the gantry when the rear support is picked up. The squaring is the shift and swing of the normal move's step 23: the
  // trusses shift straight across so M is on their line, then turn about M so F is too. The slide of a shift and a swing at
  // once is turned by the swing, so the push is given in the direction the trusses lie in now. The trolley stays still over
  // the front support.
  const squarePivot = mid(M),
    toF = sub(mid(F), squarePivot),
    { at, dir } = m.trussLine(between(truss, svg)),
    off = sub(squarePivot, at),
    onLine = dot(off, dir),
    across = { x: off.x - onLine * dir.x, y: off.y - onLine * dir.y },
    squareTurn = small(deg(toF) - deg(dir)),
    lines = [...gantry.querySelectorAll(".clipper-truss line")].map((l) => reachIn(l, truss)),
    frontEnd = ahead > 0 ? Math.max(...lines.map((r) => r.hi)) : Math.min(...lines.map((r) => r.lo)),
    length = Math.max(...lines.map((r) => r.hi)) - Math.min(...lines.map((r) => r.lo)),
    wanted = centreIn(M.beam, truss).y + ahead * PUSH_SHARE * length - frontEnd,
    push = wanted * ahead > 0.5 ? wanted : 0,
    lie = between(truss, svg),
    squareSlide = { x: across.x + lie.c * push, y: across.y + lie.d * push },
    squareForward = alongOf(squareSlide),
    reach = Math.max(
      ...[...gantry.querySelectorAll(".clipper-tip")].map((t) => {
        const c = centreIn(t, svg);
        return Math.hypot(c.x - squarePivot.x, c.y - squarePivot.y);
      }),
    );
  debugLog(
    `[gantry] crawl: push ${push.toFixed(1)}, shift ${Math.hypot(across.x, across.y).toFixed(2)}, turn ${squareTurn.toFixed(2)} deg`,
  ); // TEMP
  if (!unseen(Math.hypot(squareSlide.x, squareSlide.y) + (reach * Math.abs(squareTurn) * Math.PI) / 180)) {
    // the shift is started first, so the swing turns about M as the shifted trusses see it
    await Promise.all([
      trusses.by(squareForward, 3000, sub(squareSlide, along(squareForward))),
      trusses.swing(squarePivot, squareTurn, 3000),
      moveTrolley(m.trolleyY - push, 3000),
    ]);
    await pause(500);
    // the turn leaves the trolley a hair off the front support: it settles back over it
    const settle = centreIn(F.beam, truss).y - trolleyAt.y - m.trolleyY;
    if (Math.abs(settle) > 0.2) await moveTrolley(m.trolleyY + settle, 800);
  }

  // 3. the trolley moves to the rear support and picks it up
  debugLog(`[gantry] crawl: trolley to ${R.name} (rear)`); // TEMP
  await overSupport(R);

  // 4. it turns it 90 degrees clockwise, to lie lengthwise
  stackSupports(svg, [R.anchor]);
  await R.swing(mid(R), 90, 2000);
  await pause(500);

  // 5a. in the middle of the carry, when the support is halfway between the other two (M and F), the trolley stops, turns it
  // 90 degrees counter-clockwise and puts it down there, goes to the rear support (M, now the rear of the three), pushes the trusses back by BACK_SHARE of their
  // length (still over M), and returns to the support in the middle to carry it on
  const halfway = { x: (mid(M).x + mid(F).x) / 2, y: (mid(M).y + mid(F).y) / 2 },
    toHalfway = sub(halfway, mid(R)),
    halfwayForward = alongOf(toHalfway);
  debugLog(`[gantry] crawl: ${R.name} halfway between ${M.name} and ${F.name}`); // TEMP
  await Promise.all([
    R.by(halfwayForward, 3000, sub(toHalfway, along(halfwayForward))),
    moveTrolley(trussY(halfway) - trolleyAt.y, 3000),
  ]);
  await pause(500);
  // it turns 90 degrees counter-clockwise, across the guideway, and is put down in the middle
  await R.swing(mid(R), -90, 2000);
  stackSupports(svg);
  await pause(500);
  await overSupport(M);
  const back = -ahead * BACK_SHARE * length,
    backNow = between(truss, svg),
    backSlide = { x: backNow.c * back, y: backNow.d * back },
    backForward = alongOf(backSlide);
  await Promise.all([
    trusses.by(backForward, 2500, sub(backSlide, along(backForward))),
    moveTrolley(m.trolleyY - back, 2500),
  ]);
  await pause(500);
  await overSupport(R);
  // picked up again, it turns 90 degrees clockwise to lie lengthwise for the rest of the carry
  stackSupports(svg, [R.anchor]);
  await R.swing(mid(R), 90, 2000);
  await pause(500);

  // 5. it carries it to its place on the guideway, centred on the two girders, the way the move before the crawl carries a
  // support to its place (steps 13 to 16 there): along the trusses to the point on that line which is as far from the middle
  // support M as the place is, and then the trusses swing about M, carrying it round onto the place, with the trolley still
  // holding it. The trusses' line is where they lie now, and a move of 1 along them is (c, d) of the truss frame's matrix.
  const target = line.at(sTarget),
    pivot = mid(M),
    now = mid(R),
    on = between(truss, svg),
    unit = { x: on.c, y: on.d },
    w = sub(now, pivot),
    qa = dot(unit, unit),
    qb = 2 * dot(w, unit),
    qc = dot(w, w) - dot(sub(target, pivot), sub(target, pivot)),
    root = Math.sqrt(Math.max(0, qb * qb - 4 * qa * qc)),
    plain = dot(sub(target, now), unit) / qa,
    trip = [(-qb + root) / (2 * qa), (-qb - root) / (2 * qa)].reduce((a, b) =>
      Math.abs(b - plain) < Math.abs(a - plain) ? b : a,
    ),
    slide = { x: unit.x * trip, y: unit.y * trip },
    forward = alongOf(slide);
  debugLog(`[gantry] crawl: carry ${R.name} to ${sTarget.toFixed(1)} along the guideway (span ${line.span(sTarget)})`); // TEMP
  await Promise.all([R.by(forward, 3500, sub(slide, along(forward))), moveTrolley(m.trolleyY + trip, 3500)]);
  await pause(500);
  // the swing: the trusses, with the support the trolley holds, turn about M until the support is on its place
  const swing = small(deg(sub(target, pivot)) - deg(sub(mid(R), pivot)));
  if (!unseen(Math.hypot(target.x - mid(R).x, target.y - mid(R).y))) {
    await Promise.all([trusses.swing(pivot, swing, 3000), R.swing(pivot, swing, 3000)]);
    await pause(500);
  }
  // whatever is left (a swing too small to play, or the gap a curve leaves) is made up by the support moving a little
  const left = sub(target, mid(R));
  debugLog(`[gantry] crawl: swing ${swing.toFixed(2)} deg, left ${Math.hypot(left.x, left.y).toFixed(2)}`); // TEMP
  if (Math.hypot(left.x, left.y) > 0.3) {
    const along2 = alongOf(left);
    await Promise.all([R.by(along2, 600, sub(left, along(along2))), moveTrolley(m.trolleyY + along2, 600)]);
  }

  // 6. it turns it 90 degrees counter-clockwise, across the guideway there, and puts it down
  const turn = nearest(deg(line.across(sTarget)) - angleOf(R.beam, svg), -90);
  await R.swing(target, turn, 2000);
  stackSupports(svg);
  await pause(500);
}

/**
 * Plays the crawl over the double girder spans after the move before it (see docs/double-girder/2-the-crawl.md): `moves`
 * leapfrogs of equal `step`, from where the front support (C) stands to the end of the last double girder span, with `Dmax`
 * half the length of span DMAX_REFERENCE_SPAN.
 * @param {object} m The shared object, as the move before the crawl leaves it.
 * @returns {Promise<void>}
 */
export async function playCrawl(m) {
  const { svg, gantry, S } = m;
  // the double girder spans after the span about to be built
  const spans = [];
  for (let n = S + 2; DOUBLE_GIRDER.has(n); n++) spans.push(n);
  const line = spans.length && guidewayLine(svg, gantry, S, spans);
  const reference = gantryMoves(svg, S, DMAX_REFERENCE_SPAN + 1)?.spans[DMAX_REFERENCE_SPAN];
  if (!line || !reference) return;
  const dmax = dot(sub(reference.ends.front, reference.ends.back), reference.u) * DMAX_SHARE;
  const supports = longSupports(m),
    roles = { R: supports.B, M: supports.A, F: supports.C };
  await centreCWheels(m);
  await pause(500);
  const start = line.along(centreIn(roles.F.beam, svg)),
    L = line.length - start,
    moves = Math.ceil(L / dmax),
    step = L / moves;
  debugLog(
    `[gantry] crawl: spans ${spans.join(",")}, Dmax ${dmax.toFixed(1)}, L ${L.toFixed(1)}, ${moves} moves of ${step.toFixed(1)}`,
  ); // TEMP
  for (let k = 1; k <= Math.min(moves, MAX_MOVES); k++) {
    await leapfrog(m, line, roles, start + k * step);
    nextSpeed();
    // the support just put down is the new front one, the old front is the middle one and the old middle the rear one
    Object.assign(roles, { R: roles.M, M: roles.F, F: roles.R });
  }
}
