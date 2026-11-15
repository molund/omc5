# Code layout and the refactor

Notes on how the animation code is laid out today, how it could be laid out for the double girder moves, and the order the
refactor is being done in. Overview: [`README.md`](README.md).

**Status.** The normal move has been cut into one function per step (`normalMove.js`), and `beforeCrawl.js` is built and plays
when the gantry is on span 29, 41 or 50: `playGantry` in `gantryAnimation.js` picks between it and the normal move. File 1
(`1-before-the-crawl.md`) records what it does. `crawl.js` is built (one move checked, see file 2) and `afterCrawl.js` doesn't exist yet, and none of the old rules are
removed. The sections below were written before `beforeCrawl.js`, so where they say it is a proposal, it is now built. See
"Order of the refactor".

## How it was laid out before the refactor

This is the layout on `main`. The branch has changed it: see "Layout on the `animation-refactor` branch" below.

- `src/MapView/gantryAnimation.js` (about 1,200 lines) holds everything about the gantry's animation.
  - `playGantry(svg)` is one async function of about 600 lines. It does the whole move for a normal span: step 0 (the span
    fills in), then the numbered steps 1 to 28 from [`../animation-steps/README.md`](../animation-steps/README.md), written
    one after another in the same function. The steps share the local variables set up at the top: the measured positions
    of the pieces, and the next span's rules from `gantryMoves()`.
  - Around it: small measuring helpers at the top (`screen`, `halfLength`, `centreIn`, `reachIn`), the hold, resume, stop and
    play-to-end functions, `lowerSupports` and `raiseSupports`, and the span fill with its hangers and trolley (`fillSteps`,
    `fillIn`, `followFill` and the constants for them).
- `src/lib/placeGantry.js` (about 375 lines) holds `DOUBLE_GIRDER`, `cardSpan`, `placeGantry`, `stackSupports` and
  `gantryMoves`, which works out where each piece goes on the next span.
- `DOUBLE_GIRDER` is repeated in molund/omc5-admin as `src/lib/doubleGirder.js`. The two lists have to match.
- The animation already uses `DOUBLE_GIRDER` in several places: around the fourth support's carry in step 2, the carry angle
  in steps 6 and 7, and the third support's turns in steps 19 and 20. `gantryMoves()` also uses it to place a support across a
  double girder.

## What the new moves need

Four kinds of move, from the files in this folder:

1. **Normal move.** What `playGantry` does today.
2. **Before the crawl** (span 30, 42 and 51). Steps 1 to 11 as normal, with Support C behind the forward support, then the
   trolley crane carries the forward support forward a little and it disappears, reappearing on its new support, the trusses go back for Support B, and the front jacks carry B across both girders.
3. **The crawl** (spans 43 to 47, and 52 to 54). Repeated leapfrog moves of the three long supports, with equal steps from
   `Dmax`, `Smin` and `L`.

4. **After the crawl** (the move over span 48, or 55 / 56). Deferred: the steps aren't planned yet, but it gets its own file
   in the layout so there is a place for it.

Choosing which one to play would depend on the span the gantry is on, like `DOUBLE_GIRDER` does now.

## Layout on the `animation-refactor` branch

Done so far. `gantryAnimation.js` is the public face (about 130 lines) and still exports `playGantry`, `playToEnd`,
`holdGantry`, `resumeGantry`, `stopGantry`, `lowerSupports`, `raiseSupports` and `FOLLOW_GANTRY`, so nothing that imports it
changed. Behind it:

| File                            | Holds                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `gantryAnimation.js`            | The public functions above. `playGantry` calls `playNormalMove`; it doesn't pick between moves yet.    |
| `gantryAnimation/measure.js`    | `between`, `screen`, `halfLength`, `centreIn`, `reachIn`: measuring through the screen.                |
| `gantryAnimation/clock.js`      | `SPEED`, the animation's own clock, the waits between moves (`pause`) and Pause / Play (`holdGantry`). |
| `gantryAnimation/fill.js`       | Step 0: the span fill, its hangers, and the trolley following the fill.                                |
| `gantryAnimation/normalMove.js` | The normal move: `findGantry`, `prepare`, the step functions, and `playNormalMove` that runs them.     |
| `lib/doubleGirder.js`           | `DOUBLE_GIRDER` and `cardSpan`, with the same name as in molund/omc5-admin.                            |

How `normalMove.js` is cut up:

- `prepare` does all the measuring before anything moves and works out the next span's rules (`gantryMoves`). It returns
  one shared object, `m`, that every step takes.
- Each step function plays one step, named with its number and what it does (`step1TrolleyToFourthSupport`, `step13CarryFrontSupportForward`, ...), with the same numbering and comments as `animation-steps`. A step picks what it needs out of
  `m`, and puts any value a later step needs back on it. The trolley's and fourth support's positions are read live from `m`
  (`m.trolleyY`, `m.fourth`), because moves change them during a step.
- One function per step, not groups. Steps 25 and 26 are one function, because 26 sits inside 25's `if`.
- The numbering of steps in the code comments is unchanged, so the pictures in `animation-steps` still match.

How it was checked: a script plays one move from each of 16 spans in headless Chrome and records every animation call,
every change to the drawing and the final drawing, on `main` and after each commit. They matched each time (a fill step
timed by the real clock now and then differs by one frame and matches on a re-run). The Pause, Play and Reset buttons were not
tested.

Still to come, as a proposal:

## Proposed layout for the new moves

On top of the files above, `playGantry` would pick the move, and three more files would hold the new ones:

| File                             | Holds                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| `gantryAnimation.js`             | `playGantry` only picks which move to play and plays it.                              |
| `gantryAnimation/beforeCrawl.js` | The move at span 30, 42 and 51.                                                       |
| `gantryAnimation/crawl.js`       | The crawl.                                                                            |
| `gantryAnimation/afterCrawl.js`  | The move at the end of the crawl. Deferred: an empty placeholder until it is planned. |

The front support's placing (file 1) is one shared piece of code used for spans 30, 42 and 51: it centres the support on
the unfinished gantry-built guideway in the drawing. It belongs in `beforeCrawl.js`, and the crawl and the move after it
don't need it.

The numbering of steps in the code comments stays the same, so the step pictures in `animation-steps` still match.

## Rules to remove

Part of the refactor is removing the existing rules that turn a support across the span (perpendicular to the guideway) when
it is placed on a double girder. On the new moves no support is placed on a double girder span that way, so these rules go.
Where they are today:

- `src/lib/placeGantry.js`, in `gantryMoves()`: the branch for `DOUBLE_GIRDER.has(S + rule.span)`. It turns the support a
  further quarter turn and centres it across the double girder, midway between the outer edges of its two girders, by
  measuring the guideway polygons.
- `src/MapView/gantryAnimation/normalMove.js` (`step2CarryFourthSupportForward`, `step7TurnSecondSupportLengthwise`, `step19TurnThirdSupportLengthwise`, `step20CarryThirdSupportToFourthPlace` and `prepare`):
  - step 2: the fourth support drawn turned across the span when it is picked up on a double girder span, with a quarter turn
    first (`DOUBLE_GIRDER.has(S - 1)`).
  - the carry angle for that support (`fourthAngle + 90` on a double girder span).
  - step 19 and 20: `acrossNow` and `acrossNext`, the quarter turn of the third support to and from across the span.
- `docs/animation-steps/README.md`: the "on a double girder span" pictures and sentences in steps 1, 2, 7, 19 and 20, which
  would no longer match.

What stays: `DOUBLE_GIRDER` itself and `cardSpan`, because the Leash Log and the progress card still need to know which spans
are double girder spans.

Two things to check before removing anything:

- Span 31 is in the double girder list and has already been crossed, but the new code has to work on it too, with the same
  rules as the other two stretches. So 31 gets a crane move at 30 and a crawl, and nothing keeps the old rules alive for it.
  The tower at span 29 and the structure for span 50 are ignored, but the moves from 29 to 30 and 50 to 51 follow the same rule as 41 to 42.
- The new moves put Support B across both girders (file 1). That is a new rule of its own, not one of the old ones, so
  it must be kept apart from the ones being removed.

## Order of the refactor

The idea is that every change is small, does one thing, and leaves the animation looking exactly as it does now. The
project's rules apply to each one: one change, one commit, Prettier, and `npm run build` passing.

1. **Done.** Move `DOUBLE_GIRDER` and `cardSpan` into `src/lib/doubleGirder.js`. Instead of a re-export from
   `placeGantry.js`, the three files that use them now import from the new file.
2. **Done.** Move the measuring helpers out into `measure.js`. This went before the fill, because the fill needs them.
3. **Done.** Move the clock, speed and waits into `clock.js`. A new file, not in the first plan: the fill needs the clock
   and the speed, and so does every move.
4. **Done.** Move the span fill (step 0, hangers, trolley following the fill) out into `fill.js`.
5. **Done.** Move the normal move into `normalMove.js`, then cut it into `prepare` and one function per step, with a shared
   object for the local variables.
6. **Done, in a simple form.** `playGantry` picks which move to play: `playBeforeCrawl` when the gantry is on a span in
   `BEFORE_CRAWL` (29, 41 and 50), and `playNormalMove` otherwise. The crawl and the move after it will need their own rules.
7. **Partly done.** `beforeCrawl.js` is built (file 1 records it); it reuses some of `normalMove.js`'s step functions (those are
   exported), and `normalMove.js`'s steps 22, 23 and 25 take an optional support so the normal move and this one can share
   them. `crawl.js` isn't built, and `afterCrawl.js` waits for its own plan.
8. Remove the old perpendicular rules (see above) once the new moves are in place to replace them. This one does change
   how the animation looks on double girder spans.

Steps 1 to 6 change no behaviour. Each one was checked by replaying the same moves and comparing every animation call and the
final drawing with `main`'s; Mike can still look at a run to see it is the same.

## Things to decide before starting

- Whether the folder name `gantryAnimation/` next to a file `gantryAnimation.js` is acceptable, or the entry file should be
  `gantryAnimation/index.js`.
- (Decided while doing it: one function per step, not groups.)
- Where the crawl's constants (`Dmax`, `Smin`, move counts) live, so Mike can adjust them without searching.

## Not part of the refactor

Separate fixes, to be done on their own and only when asked:

- The Nov 13 correction to the normal steps (C set in front of A, then A does what the animation gives C), and animation
  step 19, which doesn't exist on the real gantry.
- The Leash Log changes, which are already planned in the handover document.
