# Code layout

How the gantry animation code is laid out and how a move is picked. Overview: [`README.md`](README.md).

## The files

`src/MapView/gantryAnimation.js` is the public face. It exports `playGantry`, `playToEnd`, `poseGantry`, `stopGantry`,
`holdGantry`, `resumeGantry`, `lowerSupports` and `FOLLOW_GANTRY`, which `MapView.svelte` uses. Behind it, in
`src/MapView/gantryAnimation/`:

| File            | Holds                                                                                                                                                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `normalMove.js` | The normal move: `startMove` (finds the gantry and measures everything, `prepare`), the step functions (steps 0 to 28) and `playNormalMove`.                                                                                |
| `walkStart.js`  | `startWalk`: sets the supports in a walk's start layout (`placeNowLayout`, see the README) and plays the walk.                                                                                                              |
| `walk.js`       | The walks as data (`WALKS`), `hasWalk`, `walkPartWay` (starting part way) and `playWalk`.                                                                                                                                   |
| `walkPlayer.js` | `playSteps`: plays a walk's steps, lines the trusses up, keeps the wheel assemblies under them, and hands over to the normal move half way.                                                                                 |
| `fill.js`       | Step 0: the span fill, its hangers, and the trolley following the fill.                                                                                                                                                     |
| `clock.js`      | `SPEED`, the animation's own clock, the waits between moves (`pause`), Pause and Play (`holdGantry`), and `setInstant` (moves played with no time).                                                                         |
| `measure.js`    | `between`, `screen`, `halfLength`, `centreIn`, `reachIn`: measuring through the screen.                                                                                                                                     |
| `guideway.js`   | `girderEdges`: where a double girder span's two girders are.                                                                                                                                                                |
| `supports.js`   | How Support C is slid and swung (it moves differently from the other supports).                                                                                                                                             |
| `holders.js`    | Debugging: the arrows at the supports holding the trusses and the moment panel (the tipping check).                                                                                                                         |
| `debug.js`      | `GANTRY_DEBUG` (off) and `debugLog`. It switches on the debugging aids: `holders.js`, the letters A, B and C and the dot on the trusses' middle (`addSupportLetters` in `normalMove.js`), and the `[gantry]` console lines. |

In `src/lib/`: `placeGantry.js` (`placeGantry`, `gantryMoves`, which works out where each piece goes on a span,
`placesOn`, the same from the drawn layout, and `stackSupports`) and `doubleGirder.js` (`DOUBLE_GIRDER`, the same list as in
molund/omc5-admin). `src/MapView/gantryProgress.js` marks the spans the gantry has reached (the progress colour).

## How a move is picked

- `playToEnd` plays moves one after another until the last span, calling `playGantry` for each.
- `playGantry` plays `startWalk` when the span has a walk (`hasWalk`: 41 or 50, or a span part way through a
  walk) and the gantry hasn't just handed over from one; the normal move otherwise.
- A walk ends by writing every piece's place into the drawing, setting `gantry.dataset.span` to the last double girder
  span and `gantry.dataset.halfway`, and returning. The next `playGantry` then plays the normal move, which reads the flag
  and goes straight on from step 11 (`playSecondHalf`).
- `poseGantry` sets the gantry where the walk has it on a span part way through a walk, without playing the rest
  (`startWalk` with `pose`). `MapView.svelte` calls it whenever the gantry shows and isn't playing; `stopGantry` (the
  Reset button, a view change, the Gantry layer turned off) calls it after putting the drawing back.

## The double girder rules in the normal move

`gantryMoves()` places the fourth support across a double girder span, centred across its two girders, and the normal
move's steps 2, 7, 19 and 20 turn supports to and from across on those spans. These stay: the snaps onto the last double
girder spans and the spans after them use them, and so do the normal moves around span 31.
