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
import { SPEED, pause, setInstant } from "./clock.js";
import { clearHangers } from "./fill.js";
import { girderEdges } from "./guideway.js";
import { between, centreIn } from "./measure.js";
import { slideC, swingC } from "./supports.js";
import { step0FillSpan } from "./normalMove.js";
import { holders } from "./holders.js"; // TEMP
import { debugLog } from "./debug.js";

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
    zero = 0,
    // where the line steps across onto the girders' middle: the start of the first double girder span, from the 40/41 joint
    jog = null;
  for (let n = S - 3; n <= last + 1; n++) {
    const sp = gantryMoves(svg, n, n)?.spans[n];
    if (!sp) continue;
    const e = n > S + 1 ? girderEdges(svg, gantry, sp) : null,
      shift = e ? (e.edge0 + e.edge1) / 2 : 0,
      a = add(sp.ends.back, mul(sp.v, shift)),
      b = add(sp.ends.front, mul(sp.v, shift)),
      len = Math.hypot(b.x - a.x, b.y - a.y);
    if (n === S) zero = start;
    if (e && jog == null) jog = start;
    pieces.push({ a, b, len, start, u: mul(sub(b, a), 1 / len), v: sp.v });
    start += len;
  }
  const find = (s) => pieces.find((p) => s * UNITS_PER_METRE + zero <= p.start + p.len) ?? pieces[pieces.length - 1];
  return {
    // the step across, in metres along the line
    get jog() {
      return jog == null ? null : (jog - zero) / UNITS_PER_METRE;
    },
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
 * @param {{ halfway?: boolean }} [options] halfway: the steps end in the normal move's half-way layout (after its step 10),
 * so the normal move goes on from its step 11 (gantry.dataset.halfway tells it); done: how many of the steps are already
 * made, played with no time while the gantry is see-through, which shows again as the rest starts; pose: only those
 * steps, then it stops (the gantry stays where they leave it, its pieces held there by their moves).
 * @returns {Promise<boolean>} true, so playToEnd() goes on with the normal move.
 */
export async function playSteps(m, steps, last, { halfway = false, done = 0, pose = false } = {}) {
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
  // the gantry rolls on the long supports' wheel assemblies, so they can't be out of line with the trusses: when the trusses
  // move, every long support standing across under them slides its wheel assemblies along its beam, in the same time, to
  // where the trusses' middle line will cross the beam (`after`: that line on the map, `rear`: where the trusses' rear end
  // will be; `only`: just that support). The short support's wheel assemblies hardly move on it, so they stay put
  const wheelsFollow = (after, rear, ms, only) =>
    Object.keys(sups)
      .filter((n) => sups[n].long && !riding.has(n) && !lengthwise(n) && (!only || n === only))
      .filter((n) => {
        const s = line.arc(mid(n));
        return s >= rear - 1 && s <= rear + 105;
      })
      .flatMap((n) => {
        const c = mid(n),
          r = (longAngle(n) * Math.PI) / 180,
          b = { x: Math.cos(r), y: Math.sin(r) },
          { at, dir } = after,
          den = b.x * dir.y - b.y * dir.x;
        if (Math.abs(den) < 1e-9) return [];
        const w = sub(at, c),
          cross = add(c, mul(b, (w.x * dir.y - w.y * dir.x) / den)),
          by = mul(b, dot(sub(cross, wheelsMid(n)), b));
        if (Math.hypot(by.x, by.y) < NUDGE_METRES * UNITS_PER_METRE) return [];
        return [...gantry.querySelectorAll(`:scope > [data-anchor="${sups[n].anchor}"] > .gantry-support-wheels`)].map(
          (e) => {
            const [x = 0, y = 0] = getComputedStyle(e)
                .translate.split(" ")
                .map(parseFloat)
                .filter((v) => !Number.isNaN(v)),
              toLocal = between(e.parentNode, svg).inverse(),
              dx = toLocal.a * by.x + toLocal.c * by.y,
              dy = toLocal.b * by.x + toLocal.d * by.y;
            return e.animate([{ translate: `${x}px ${y}px` }, { translate: `${x + dx}px ${y + dy}px` }], {
              duration: ms / SPEED,
              easing: "ease-in-out",
              fill: "forwards",
            }).finished;
          },
        );
      });
  // the trusses (and whatever the jacks hold) slide by a map vector; the trolley stays still on the map
  const slideTrusses = async (v, ms) => {
    const { dir, unit } = frame(),
      l = m.trussLine(between(truss, svg));
    await Promise.all([
      ...wheelsFollow({ at: add(l.at, v), dir: l.dir }, rearEnd() + dot(v, dir) / UNITS_PER_METRE, ms),
      trusses.by(0, ms, v),
      m.moveTrolley(m.trolleyY - (m.ahead * dot(v, dir)) / unit, ms),
      ...[...riding.keys()].map((n) => sups[n].by(v, ms)),
    ]);
  };
  // the trusses (and whatever the jacks hold) swing by `turn` degrees about the map point p
  const swingTrusses = async (p, turn, ms) => {
    const l = m.trussLine(between(truss, svg)),
      r = (turn * Math.PI) / 180,
      rot = (v) => ({ x: v.x * Math.cos(r) - v.y * Math.sin(r), y: v.x * Math.sin(r) + v.y * Math.cos(r) });
    await Promise.all([
      ...wheelsFollow({ at: add(p, rot(sub(l.at, p))), dir: rot(l.dir) }, rearEnd(), ms),
      trusses.swing(p, turn, ms),
      ...[...riding.keys()].map((n) => sups[n].swing(p, turn, ms)),
    ]);
  };
  // the two main supports: the outermost long ones standing across under the trusses
  // (with the trusses' rear end at `rear`: where it is now, unless given)
  const mains = (moving = [], rear = rearEnd()) => {
    const under = Object.keys(sups)
      .filter((n) => sups[n].long && !riding.has(n) && !moving.includes(n) && !lengthwise(n))
      .map((n) => ({ n, s: line.arc(mid(n)) }))
      .filter(({ s }) => s >= rear - 1 && s <= rear + 105);
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
  // where a support's wheel assemblies are, between them: the trusses ride on them (its beam's middle, unless they have been
  // slid along it)
  const wheelsMid = (n) => {
    const w = [...gantry.querySelectorAll(`:scope > [data-anchor="${sups[n].anchor}"] > .gantry-support-wheels`)].map(
      (e) => centreIn(e, svg),
    );
    return w.length ? mul(w.reduce(add, { x: 0, y: 0 }), 1 / w.length) : mid(n);
  };
  // lines the trusses up again on their two main supports: a swing about the rear one and a slide across, skipped when too
  // small to see; what the jacks hold goes with them. The trusses always lie along the guideway (its direction halfway
  // between the two), never aimed from one support to the other: a support's wheel assemblies slid along its beam (B's,
  // set over span 42 until its first carry) would turn them off it, and the next line-up would turn them back. They are
  // centred on the guideway's middle line there; when the two stand either side of the step across onto the girders'
  // middle (one on the span just built, one on the double girders), halfway between the two supports' wheel assemblies,
  // so the span just built stays under the hangers
  // where a line-up puts the trusses, with their rear end at `rear`: the rear main support's middle (the swing's pivot), the
  // direction they lie in and a point their middle line goes through; null with fewer than two main supports
  const lineUpAim = (rear) => {
    const pair = mains([], rear);
    if (!pair) return null;
    const p = mid(pair[0]),
      q = mid(pair[1]),
      ap = line.arc(p),
      aq = line.arc(q),
      straddle = line.jog != null && ap < line.jog !== aq < line.jog,
      want = deg(line.u((ap + aq) / 2)),
      through = straddle ? mul(add(wheelsMid(pair[0]), wheelsMid(pair[1])), 0.5) : line.at((ap + aq) / 2);
    return { p, want, through };
  };
  // the slide straight across the trusses that puts their middle line through `through`
  const acrossTo = (through) => {
    const l = m.trussLine(between(truss, svg)),
      across = { x: -l.dir.y, y: l.dir.x };
    return mul(across, dot(sub(through, l.at), across));
  };
  // the slide straight across the trusses that leaves them, once swung about `p` to lie along `want`, with their middle
  // line through `through`: a swing about p keeps the line's distance from p, so that distance is set now
  const acrossBeforeSwing = ({ p, want, through }) => {
    const l = m.trussLine(between(truss, svg)),
      { dir } = frame(),
      r = (want * Math.PI) / 180,
      now = { x: -dir.y, y: dir.x },
      then = { x: -Math.sin(r), y: Math.cos(r) };
    return mul(now, dot(sub(p, l.at), now) - dot(sub(p, through), then));
  };
  const lineUp = async () => {
    const aim = lineUpAim(rearEnd());
    if (!aim) return;
    const { p, want, through } = aim,
      { dir } = frame(),
      turn = small(want - deg(dir)),
      far = 110 * UNITS_PER_METRE;
    if (!m.unseen((Math.abs(turn) * Math.PI * far) / 180)) {
      await swingTrusses(p, turn, 1500);
    }
    // across: the trusses' middle line through the guideway's middle line (or halfway between the two supports' wheel
    // assemblies)
    const off = acrossTo(through);
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
        await swingTrusses(p, turn, 1500);
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

  // a support set down across the girders before the walk (B, by placeNowLayout()) has its wheel assemblies slid along its
  // beam to the middle of span S + 1, under the trusses; the first time it moves in the walk they slide back to the middle
  // of its beam (for one whose wheels are in the middle already, nothing moves)
  const wheelsCentred = new Set();
  const centreWheels = async (n) => {
    if (wheelsCentred.has(n)) return;
    wheelsCentred.add(n);
    const wheels = [...gantry.querySelectorAll(`:scope > [data-anchor="${sups[n].anchor}"] > .gantry-support-wheels`)];
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

  // TEMP: where everything is, in metres along the middle line, for checking the steps against the model
  const layout = () => {
    const facing = (n) => {
      const deck = gantry.querySelector(`:scope > [data-anchor="${sups[n].anchor}"] > .gantry-support-walkway`);
      return deck && dot(sub(centreIn(deck, svg), mid(n)), line.u(line.arc(mid(n)))) > 0 ? "W" : "E";
    };
    const sp = Object.keys(sups).map(
      (n) =>
        `${n} ${line.arc(mid(n)).toFixed(1)}${lengthwise(n) ? " L" : ` x${facing(n)}`}${riding.has(n) ? " riding" : ""}`,
    );
    return `${sp.join(", ")}, R ${rearEnd().toFixed(1)}, trolley ${line.arc(trolleyMid()).toFixed(1)}`;
  };
  debugLog(`[gantry] walk layout: ${layout()}`); // TEMP
  debugLog(
    `[gantry] walk joints: ${Object.entries(joints)
      .map(([n, a]) => `${n}/${+n + 1} ${a.toFixed(1)}`)
      .join(", ")}, ${S}/${S + 1} ${line.arc(gantryMoves(svg, S, S)?.spans[S].ends.front).toFixed(1)}`,
  ); // TEMP
  for (const [i, step] of steps.entries()) {
    // the steps already made are over: the rest plays at speed, with the gantry showing again
    setInstant(i < done);
    // only setting the gantry where the crews have it (pose): it stops there, with nothing snapped
    if (pose && i === done) return false;
    if (done && i === done) gantry.style.opacity = "";
    if (i) debugLog(`[gantry] walk layout: ${layout()}`); // TEMP
    debugLog(`[gantry] walk ${i + 1}: ${JSON.stringify(step)}`); // TEMP
    // the arrows: the two outermost supports holding the trusses during this step (the short one too, when it stands
    // across under them), leaving out the one being carried or picked up
    const moving = [step.who, step.pick?.who].filter(Boolean),
      pair = bearing(moving);
    if (pair) holders(m, sups[pair[0]].anchor, sups[pair[1]].anchor); // TEMP
    if (step.op === "trusses") {
      await driveTo(step.anchor);
      if (step.pick) riding.set(step.pick.who, step.pick.jacks);
      if (step.pick) await centreWheels(step.pick.who);
      const { dir } = frame(),
        total = (step.R - rearEnd()) * UNITS_PER_METRE;
      let first = total;
      if (step.then) {
        // the trolley reaches its limit on the trusses (forward room when they go back, and the other way round)
        const r = room(total > 0 ? -1 : 1);
        first = Math.sign(total) * Math.min(r, Math.abs(total));
      }
      // the move across that the line-up afterwards would make goes into the slide, so the trusses drift over to the
      // guideway's middle line as they go instead of stepping across at the end
      const aim = step.align !== false && !step.then && !step.drop?.length && lineUpAim(step.R),
        side = aim ? acrossBeforeSwing(aim) : { x: 0, y: 0 };
      await slideTrusses(add(mul(dir, first), side), 3500 * Math.min(1, Math.abs(first / total) + 0.15));
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
      await centreWheels(step.who);
      if (step.turnFirst) await turnTo(step.who, "L");
      // a long support lands on the girders' middle line (its wheel assemblies then slide to under the trusses); the short
      // one, whose wheel assemblies hardly move on it, straight under the trusses' middle line, where it hangs
      const onLine = line.at(step.to),
        tl = m.trussLine(between(truss, svg)),
        target = sups[step.who].long ? onLine : add(tl.at, mul(tl.dir, dot(sub(onLine, tl.at), tl.dir))),
        v = sub(target, mid(step.who)),
        { dir } = frame(),
        along = mul(dir, dot(v, dir));
      await Promise.all([sups[step.who].by(v, 3500), trolleyBy(along, 3500)]);
      // across at the end: turned the regular way round; otherwise squared to the guideway where it lands
      if (step.turnLast) await turnTo(step.who, "x", 2000, step.deck);
      else if (!lengthwise(step.who)) await squareUp(step.who);
      // set down under the trusses: its wheel assemblies slide along its beam to under them
      if (!lengthwise(step.who))
        await Promise.all(wheelsFollow(m.trussLine(between(truss, svg)), rearEnd(), 800, step.who));
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
  if (pose) return false;
  debugLog("[gantry] walk: snap"); // TEMP
  const settled = [...gantry.querySelectorAll("*")]
    .filter((el) => el.getAnimations().length)
    .map((el) => [el, between(el, el.parentNode)]);
  gantry.getAnimations({ subtree: true }).forEach((a) => a.cancel());
  for (const [el, t] of settled) el.setAttribute("transform", `matrix(${t.a} ${t.b} ${t.c} ${t.d} ${t.e} ${t.f})`);
  gantry.dataset.span = last;
  gantryProgress(svg, false);
  // the last span turns to the progress colour only once two supports are at or past its far joint: in the normal move,
  // when its second support is set down there (step 10). Handing over half way, A is there already
  markReached(svg, last, halfway);
  if (halfway) gantry.dataset.halfway = "true";
  debugLog("[gantry] walk: snapped"); // TEMP
  return true;
}
