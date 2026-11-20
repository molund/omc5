// Plays a walk over double girder spans as a list of steps worked out with the model of the move (the rules Mike gave, the
// tipping margin kept at 3.93 or more, repeated steps preferred), and snaps the gantry onto the last double girder span for
// the normal move. Shared by the Highway 15 walk (walk.js) and the Serpentine River crossing (serpentine.js). Positions are
// metres along the guideway's middle line (the girders' middle on the double girder spans), from the back of span S (the
// span the gantry is on when the move starts). Each truss move ends with the trusses lined up again on their two main
// supports (a swing where the curve calls for one). See docs/double-girder/2-the-crawl.md.
//
// Steps: trusses: slide until the rear tips' rear end is at R (the trolley parked over `anchor`, or over `then` once it
// reaches its limit), a jack picking up (`pick`) or setting down (`drop`) a support, then lined up again (unless `align` is
// false); carry: the trolley carries `who` to `to`,
// turned lengthwise first (`turnFirst`) and/or across at the end (`turnLast`, deck facing `deck`: E or W, the regular way when
// left out); turn: `who` turned `to` L (lengthwise) or x (across, deck facing `deck`); fill: span `span` is built (the trolley
// goes back to its drawn place first, as the fill's run starts there); park: the trolley to `to` for the normal move.

import { gantryMoves, stackSupports } from "../../lib/placeGantry.js";
import { UNITS_PER_METRE } from "../../lib/layerSwitches.js";
import { gantryProgress, markReached } from "../gantryProgress.js";
import { SPEED, pause } from "./clock.js";
import { clearHangers } from "./fill.js";
import { girderEdges } from "./guideway.js";
import { between, centreIn } from "./measure.js";
import { slideC, swingC } from "./supports.js";
import { step0FillSpan } from "./normalMove.js";
import { holders } from "./holders.js"; // TEMP

/** The trolley's closest approach to either end's blue tips, as a share of a tip's length (as TIP_GAP_SHARE elsewhere). */
const TIP_GAP_SHARE = 0.5;
/** A support set down on the girders is nudged onto their middle line when it is further off than this, in metres. */
const NUDGE_METRES = 0.02;
/** A support is squared to the guideway when it is turned further off than this, in degrees. */
const SQUARE_DEGREES = 0.2;

const dot = (a, b) => a.x * b.x + a.y * b.y;
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a, k) => ({ x: a.x * k, y: a.y * k });
const deg = (v) => (Math.atan2(v.y, v.x) * 180) / Math.PI;
const small = (a) => ((((a + 180) % 360) + 360) % 360) - 180;

/**
 * The guideway's middle line from span 40 to the span after the walk, on the map: each span from its back end to its front
 * end, moved across to the middle of its two girders on a double girder span. `at(s)` is the point s metres from the 40/41
 * joint, `u(s)` the forward direction there and `v(s)` the direction across; `arc(p)` how far along a point on the map is.
 */
function middleLine(svg, gantry, S, last) {
  const pieces = [];
  let start = 0,
    zero = 0;
  for (let n = S - 3; n <= last + 1; n++) {
    const sp = gantryMoves(svg, n, n)?.spans[n];
    if (!sp) continue;
    const e = n > S + 1 ? girderEdges(svg, gantry, sp) : null,
      shift = e ? (e.edge0 + e.edge1) / 2 : 0,
      a = add(sp.ends.back, mul(sp.v, shift)),
      b = add(sp.ends.front, mul(sp.v, shift)),
      len = Math.hypot(b.x - a.x, b.y - a.y);
    if (n === S) zero = start;
    pieces.push({ a, b, len, start, u: mul(sub(b, a), 1 / len), v: sp.v });
    start += len;
  }
  const find = (s) => pieces.find((p) => s * UNITS_PER_METRE + zero <= p.start + p.len) ?? pieces[pieces.length - 1];
  return {
    at(s) {
      const p = find(s),
        t = s * UNITS_PER_METRE + zero - p.start;
      return add(p.a, mul(p.u, t));
    },
    u: (s) => find(s).u,
    v: (s) => find(s).v,
    arc(q) {
      let best = null;
      for (const p of pieces) {
        const t = Math.max(-20, Math.min(p.len + 20, dot(sub(q, p.a), p.u))),
          d = Math.hypot(...Object.values(sub(q, add(p.a, mul(p.u, t)))));
        if (!best || d < best.d) best = { d, s: (p.start + t - zero) / UNITS_PER_METRE };
      }
      return best.s;
    },
  };
}

/** The four supports, each with its beam, data-anchor, and how it moves on the map (a slide by a map vector, a swing). */
function supportsOf(m) {
  const slider = (s) => ({ by: (v, ms) => s.by(0, ms, v), swing: (p, t, ms) => s.swing(p, t, ms) });
  return {
    A: { beam: m.secondBeam, anchor: "second", long: true, ...slider(m.second) },
    B: { beam: m.thirdBeam, anchor: "rear", long: true, ...slider(m.third) },
    S: { beam: m.frontBeam, anchor: "front", long: false, ...slider(m.front) },
    C: {
      beam: m.beam,
      anchor: "fourth",
      long: true,
      by: (v, ms) => slideC(m, 0, ms, v),
      swing: (p, t, ms) => swingC(m, p, t, ms),
    },
  };
}

/**
 * Plays `steps` from where the gantry is now (span S of the move), then snaps it onto span `last` for the normal move.
 * @param {object} m What the steps share (startMove()).
 * @param {object[]} steps The walk (see the top of this file).
 * @param {number} last The last double girder span, where the normal move takes over.
 * @returns {Promise<boolean>} true, so playToEnd() goes on with the normal move.
 */
export async function playSteps(m, steps, last) {
  const { svg, gantry, truss, trusses, S } = m;
  const line = middleLine(svg, gantry, S, last),
    sups = supportsOf(m),
    riding = new Map(); // support name -> "front" / "rear" jacks
  const mid = (n) => centreIn(sups[n].beam, svg);
  // the trusses' frame on the map now: their forward direction (a move of one truss unit) and its length
  const frame = () => {
    const t = between(truss, svg),
      y = { x: t.c * m.ahead, y: t.d * m.ahead };
    return { dir: mul(y, 1 / Math.hypot(y.x, y.y)), unit: Math.hypot(t.c, t.d) };
  };
  const trolleyMid = () => centreIn(m.trolley, svg);
  // the trolley moves by a map vector's component along the trusses
  const trolleyBy = (v, ms) => {
    const { dir, unit } = frame();
    return m.moveTrolley(m.trolleyY + (m.ahead * dot(v, dir)) / unit, ms);
  };
  const lengthwise = (n) => {
    const b = sups[n].beam.getBBox(),
      t = between(sups[n].beam, svg),
      o = new DOMPoint(b.x, b.y).matrixTransform(t),
      w = new DOMPoint(b.x + b.width, b.y).matrixTransform(t),
      h = new DOMPoint(b.x, b.y + b.height).matrixTransform(t),
      long = Math.hypot(w.x - o.x, w.y - o.y) >= Math.hypot(h.x - o.x, h.y - o.y) ? sub(w, o) : sub(h, o);
    return Math.abs(dot(mul(long, 1 / Math.hypot(long.x, long.y)), frame().dir)) > Math.SQRT1_2;
  };
  const longAngle = (n) => {
    const b = sups[n].beam.getBBox(),
      t = between(sups[n].beam, svg),
      o = new DOMPoint(b.x, b.y).matrixTransform(t),
      w = new DOMPoint(b.x + b.width, b.y).matrixTransform(t),
      h = new DOMPoint(b.x, b.y + b.height).matrixTransform(t);
    return deg(Math.hypot(w.x - o.x, w.y - o.y) >= Math.hypot(h.x - o.x, h.y - o.y) ? sub(w, o) : sub(h, o));
  };
  // the rear tips' rear end, in metres along the guideway
  const rearEnd = () => {
    const ys = [...gantry.querySelectorAll(".clipper-tip")].flatMap((t) => {
      const b = t.getBBox(),
        mt = between(t, svg);
      return [
        [b.x, b.y],
        [b.x + b.width, b.y + b.height],
      ].map(([x, y]) => line.arc(new DOMPoint(x, y).matrixTransform(mt)));
    });
    return Math.min(...ys);
  };
  // how far the trolley may still go along the trusses, forward (+1) or back (-1), on the map
  const room = (way) => {
    const tips = [...gantry.querySelectorAll(".clipper-tip")].map((t) => line.arc(centreIn(t, svg))),
      tipLen = 3.42,
      end = way > 0 ? Math.max(...tips) - tipLen / 2 : Math.min(...tips) + tipLen / 2,
      t = line.arc(trolleyMid());
    return Math.max(0, way * (end - t) - 3.8 - tipLen * TIP_GAP_SHARE) * UNITS_PER_METRE;
  };

  const driveTo = async (n) => {
    const v = sub(mid(n), trolleyMid()),
      { dir } = frame();
    if (Math.abs(dot(v, dir)) < 0.5) return;
    await trolleyBy(mul(dir, dot(v, dir)), 2500);
    await pause(400);
  };
  // the trusses (and whatever the jacks hold) slide by a map vector; the trolley stays still on the map
  const slideTrusses = async (v, ms) => {
    const { dir, unit } = frame();
    await Promise.all([
      trusses.by(0, ms, v),
      m.moveTrolley(m.trolleyY - (m.ahead * dot(v, dir)) / unit, ms),
      ...[...riding.keys()].map((n) => sups[n].by(v, ms)),
    ]);
  };
  // the two main supports: the outermost long ones standing across under the trusses
  const mains = (moving = []) => {
    const under = Object.keys(sups)
      .filter((n) => sups[n].long && !riding.has(n) && !moving.includes(n) && !lengthwise(n))
      .map((n) => ({ n, s: line.arc(mid(n)) }))
      .filter(({ s }) => s >= rearEnd() - 1 && s <= rearEnd() + 105);
    under.sort((a, b) => a.s - b.s);
    return under.length >= 2 ? [under[0].n, under[under.length - 1].n] : null;
  };
  // the two outermost supports standing across under the trusses (any of the four), for the arrows
  const bearing = (moving = []) => {
    const under = Object.keys(sups)
      .filter((n) => !riding.has(n) && !moving.includes(n) && !lengthwise(n))
      .map((n) => ({ n, s: line.arc(mid(n)) }))
      .filter(({ s }) => s >= rearEnd() - 1 && s <= rearEnd() + 105);
    under.sort((a, b) => a.s - b.s);
    return under.length >= 2 ? [under[0].n, under[under.length - 1].n] : null;
  };
  // lines the trusses up again on their two main supports: a swing about the rear one and a slide across, skipped when too
  // small to see; what the jacks hold goes with them
  const lineUp = async () => {
    const pair = mains();
    if (!pair) return;
    const p = mid(pair[0]),
      q = mid(pair[1]),
      want = deg(sub(q, p)),
      { dir } = frame(),
      turn = small(want - deg(dir)),
      far = 110 * UNITS_PER_METRE;
    if (!m.unseen((Math.abs(turn) * Math.PI * far) / 180)) {
      await Promise.all([trusses.swing(p, turn, 1500), ...[...riding.keys()].map((n) => sups[n].swing(p, turn, 1500))]);
    }
    // across: the trusses' middle line through the rear main support
    const l = m.trussLine(between(truss, svg)),
      across = { x: -l.dir.y, y: l.dir.x },
      off = mul(across, dot(sub(p, l.at), across));
    if (!m.unseen(Math.hypot(off.x, off.y))) await slideTrusses(off, 1000);
  };
  // turns a support about its own middle so it lies across the guideway there, its deck facing `facing` (E, back, or W,
  // forward; the regular way when left out: east for the long ones, west for the short one); or lengthwise along the trusses
  const turnTo = async (n, to, ms = 2000, facing) => {
    const s = sups[n],
      c = mid(n),
      cur = longAngle(n);
    let turn;
    if (to === "L") {
      turn = small(deg(frame().dir) - cur);
      if (Math.abs(turn) > 90) turn = small(turn + 180);
      stackSupports(svg, [s.anchor]);
    } else {
      const at = line.arc(c),
        base = small(deg(line.v(at)) - cur),
        deck = gantry.querySelector(`:scope > [data-anchor="${s.anchor}"] > .gantry-support-walkway`),
        d0 = deck ? sub(centreIn(deck, svg), c) : { x: 0, y: 0 },
        wantForward = facing ? facing === "W" : !s.long,
        ok = (t) => {
          const r = (t * Math.PI) / 180,
            d1 = { x: d0.x * Math.cos(r) - d0.y * Math.sin(r), y: d0.x * Math.sin(r) + d0.y * Math.cos(r) };
          return dot(d1, line.u(at)) > 0 === wantForward;
        };
      turn = [base, base + 180, base - 180].filter(ok).sort((a, b) => Math.abs(a) - Math.abs(b))[0] ?? base;
    }
    if (Math.abs(turn) > 0.2) await s.swing(c, turn, ms);
    if (to === "x") stackSupports(svg);
  };

  // squares a support across the guideway where it stands, keeping its deck facing the way it does (a turn of less than
  // a quarter either way); anything over SQUARE_DEGREES is played, whatever the zoom
  const squareUp = async (n, ms = 800) => {
    const c = mid(n);
    let turn = small(deg(line.v(line.arc(c))) - longAngle(n));
    if (turn > 90) turn -= 180;
    if (turn < -90) turn += 180;
    if (Math.abs(turn) > SQUARE_DEGREES) await sups[n].swing(c, turn, ms);
  };
  // before the jacks set a support down on the girders: the trusses (and whatever the jacks hold) swing about the long
  // support standing across under them furthest from it, so it comes onto the girders' middle line; the support closes any
  // small gap left by itself, and is squared to the guideway
  const landOnLine = async (n) => {
    const c = mid(n),
      standing = Object.keys(sups).filter((k) => k !== n && sups[k].long && !riding.has(k) && !lengthwise(k));
    const pivotName = standing.sort(
      (a, b) => Math.hypot(...Object.values(sub(mid(b), c))) - Math.hypot(...Object.values(sub(mid(a), c))),
    )[0];
    if (pivotName) {
      const p = mid(pivotName),
        target = line.at(line.arc(c)),
        turn = small(deg(sub(target, p)) - deg(sub(c, p)));
      if ((Math.abs(turn) * Math.PI * Math.hypot(c.x - p.x, c.y - p.y)) / 180 > NUDGE_METRES * UNITS_PER_METRE) {
        await Promise.all([
          trusses.swing(p, turn, 1500),
          ...[...riding.keys()].map((r) => sups[r].swing(p, turn, 1500)),
        ]);
      }
    }
    const gap = sub(line.at(line.arc(mid(n))), mid(n));
    if (Math.hypot(gap.x, gap.y) > NUDGE_METRES * UNITS_PER_METRE) await sups[n].by(gap, 800);
    await squareUp(n);
  };

  // a double girder span turns to the progress colour (reached, as gantryProgress() marks spans behind the gantry) once two
  // supports stand on the ground at or past its joint with the next span
  const joints = {};
  for (let n = S + 2; n <= last; n++) {
    const sp = gantryMoves(svg, n, n)?.spans[n];
    if (sp) joints[n] = line.arc(sp.ends.front);
  }
  const markPassedSpans = () => {
    const standing = Object.keys(sups)
      .filter((n) => !riding.has(n))
      .map((n) => line.arc(mid(n)));
    for (const [n, at] of Object.entries(joints)) {
      if (standing.filter((s) => s >= at - 0.5).length < 2) continue;
      markReached(svg, n);
      delete joints[n];
    }
  };

  // A's wheel assemblies were slid along its beam to the middle of span S + 1 when it was set down across the girders
  // (step 30 of the move before the crawl); the first time A moves in the walk they slide back to the middle of its beam
  let aWheelsCentred = false;
  const centreAWheels = async () => {
    if (aWheelsCentred) return;
    aWheelsCentred = true;
    const wheels = [...gantry.querySelectorAll(':scope > [data-anchor="second"] > .gantry-support-wheels')];
    await Promise.all(
      wheels.map(
        (w) =>
          w.animate([{ translate: getComputedStyle(w).translate || "0px 0px" }, { translate: "0px 0px" }], {
            duration: 1500 / SPEED,
            easing: "ease-in-out",
            fill: "forwards",
          }).finished,
      ),
    );
  };

  for (const [i, step] of steps.entries()) {
    console.log(`[gantry] walk ${i + 1}: ${JSON.stringify(step)}`); // TEMP
    // the arrows: the two outermost supports holding the trusses during this step (the short one too, when it stands
    // across under them), leaving out the one being carried or picked up
    const moving = [step.who, step.pick?.who].filter(Boolean),
      pair = bearing(moving);
    if (pair) holders(m, sups[pair[0]].anchor, sups[pair[1]].anchor); // TEMP
    if (step.op === "trusses") {
      await driveTo(step.anchor);
      if (step.pick) riding.set(step.pick.who, step.pick.jacks);
      if (step.pick?.who === "A") await centreAWheels();
      const { dir } = frame(),
        total = (step.R - rearEnd()) * UNITS_PER_METRE;
      let first = total;
      if (step.then) {
        // the trolley reaches its limit on the trusses (forward room when they go back, and the other way round)
        const r = room(total > 0 ? -1 : 1);
        first = Math.sign(total) * Math.min(r, Math.abs(total));
      }
      await slideTrusses(mul(dir, first), 3500 * Math.min(1, Math.abs(first / total) + 0.15));
      if (step.then && Math.abs(total - first) > 0.5) {
        await pause(400);
        await driveTo(step.then);
        await slideTrusses(mul(frame().dir, total - first), 2500);
      }
      for (const n of step.drop ?? []) {
        await landOnLine(n);
        riding.delete(n);
      }
      // lined up again on their two main supports, unless the step says not to (the loop does, when the short support
      // stands at the back or the front, so it never holds the trusses during a swing)
      if (step.align !== false) await lineUp();
      await pause(500);
    } else if (step.op === "carry") {
      await driveTo(step.who);
      if (step.who === "A") await centreAWheels();
      if (step.turnFirst) await turnTo(step.who, "L");
      const target = line.at(step.to),
        v = sub(target, mid(step.who)),
        { dir } = frame(),
        along = mul(dir, dot(v, dir));
      await Promise.all([sups[step.who].by(v, 3500), trolleyBy(along, 3500)]);
      // across at the end: turned the regular way round; otherwise squared to the guideway where it lands
      if (step.turnLast) await turnTo(step.who, "x", 2000, step.deck);
      else if (!lengthwise(step.who)) await squareUp(step.who);
      await pause(500);
    } else if (step.op === "turn") {
      await driveTo(step.who);
      if (step.to === "L") await turnTo(step.who, "L");
      else await turnTo(step.who, "x", 2000, step.deck);
      await pause(500);
    } else if (step.op === "fill") {
      // the span is built, as step 0 does at the start of every move; the fill's trolley run starts from its drawn place
      await m.moveTrolley(0, 2500);
      gantry.dataset.span = step.span ?? S + 1;
      await step0FillSpan(svg, m.trolley);
      clearHangers();
      await pause(500);
    } else if (step.op === "park") {
      const v = sub(line.at(step.to), trolleyMid()),
        { dir } = frame();
      await trolleyBy(mul(dir, dot(v, dir)), 2500);
      await pause(500);
    }
    markPassedSpans();
  }

  // the gantry is on the last double girder span and the normal move takes over from where everything stands: each moved
  // piece's place is written into the drawing (its transform, as it is now) and its animations are dropped, so nothing
  // moves on the screen, and the normal move's steps measure the pieces where they are. Its own snap at the end puts them in
  // placeGantry()'s layout as usual
  console.log("[gantry] walk: snap"); // TEMP
  const settled = [...gantry.querySelectorAll("*")]
    .filter((el) => el.getAnimations().length)
    .map((el) => [el, between(el, el.parentNode)]);
  gantry.getAnimations({ subtree: true }).forEach((a) => a.cancel());
  for (const [el, t] of settled) el.setAttribute("transform", `matrix(${t.a} ${t.b} ${t.c} ${t.d} ${t.e} ${t.f})`);
  gantry.dataset.span = last;
  gantryProgress(svg, false);
  // the last span turns to the progress colour only once two supports are at or past its far joint: in the normal move,
  // when its second support is set down there (step 10)
  markReached(svg, last, false);
  console.log("[gantry] walk: snapped"); // TEMP
  return true;
}
