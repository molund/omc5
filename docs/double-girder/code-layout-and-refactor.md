# Code layout and the refactor

Notes on how the animation code is laid out today, how it could be laid out for the double girder moves, and the order the
refactor would be done in. **This is a proposal, not an agreed plan.** Nothing is built, and nothing here changes until
Mike says so. Overview: [`README.md`](README.md).

## How it is laid out today

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

## Proposed layout

Keep `gantryAnimation.js` as the public face so nothing that imports it has to change: it still exports `playGantry`,
`playToEnd`, `holdGantry`, `resumeGantry`, `stopGantry`, `lowerSupports`, `raiseSupports` and `FOLLOW_GANTRY`. Behind it:

| File                             | Holds                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| `gantryAnimation.js`             | The public functions above. `playGantry` only picks which move to play and plays it.  |
| `gantryAnimation/measure.js`     | The measuring helpers, and the setup that finds the pieces and measures them.         |
| `gantryAnimation/fill.js`        | Step 0: the span fill, hangers and trolley following the fill.                        |
| `gantryAnimation/normalMove.js`  | Steps 1 to 28 as they are today, one function per group of steps.                     |
| `gantryAnimation/beforeCrawl.js` | The move at span 30, 42 and 51.                                                       |
| `gantryAnimation/crawl.js`       | The crawl.                                                                            |
| `gantryAnimation/afterCrawl.js`  | The move at the end of the crawl. Deferred: an empty placeholder until it is planned. |
| `lib/doubleGirder.js`            | `DOUBLE_GIRDER` and `cardSpan`, with the same name as in molund/omc5-admin.           |

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
- `src/MapView/gantryAnimation.js`:
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

1. Move `DOUBLE_GIRDER` and `cardSpan` into `src/lib/doubleGirder.js`. Re-export them from `placeGantry.js` so nothing else
   changes.
2. Move the span fill (step 0, hangers, trolley following the fill) out into `fill.js`.
3. Move the measuring helpers and the setup out into `measure.js`.
4. Cut the numbered steps of `playGantry` into functions in `normalMove.js`, a few steps at a time. The steps share many
   local variables, so these functions will need a shared object for them.
5. Make `playGantry` pick which move to play. At this point it always picks the normal one.
6. Only then add `beforeCrawl.js` and `crawl.js`, and the rule that picks them. `afterCrawl.js` waits for its own plan.
7. Remove the old perpendicular rules (see above) once the new moves are in place to replace them. This one does change
   how the animation looks on double girder spans.

Steps 1 to 5 change no behaviour. Mike checks after each one that the animation looks the same; a run of span 103 to 104
with a picture of each step is what `animation-steps` already uses.

## Things to decide before starting

- Whether the folder name `gantryAnimation/` next to a file `gantryAnimation.js` is acceptable, or the entry file should be
  `gantryAnimation/index.js`.
- Whether the step 4 split goes by groups of steps (for example 1 to 4, 5 to 10, 11 to 16, 17 to 21, 22 to 28) or one
  function per step. Claude would suggest groups.
- Where the crawl's constants (`Dmax`, `Smin`, move counts) live, so Mike can adjust them without searching.

## Not part of the refactor

Separate fixes, to be done on their own and only when asked:

- The Nov 13 correction to the normal steps (C set in front of A, then A does what the animation gives C), and animation
  step 19, which doesn't exist on the real gantry.
- The Leash Log changes, which are already planned in the handover document.
