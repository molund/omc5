# 1. Before the crawl: the one-off move at span 42 (and 51, and 30)

The gantry is on span 41 (or 50, or 29) and about to move to 42 (or 51, or 30). This move is built: it is
`src/MapView/gantryAnimation/beforeCrawl.js`, and this file records what it does, step by step, as the code plays it. Where
the first plan (written before it was built) said something different, that is noted at the end. Overview and shared notes:
[`README.md`](README.md). Next: [`2-the-crawl.md`](2-the-crawl.md).

Everything here is as the animation draws it. The real gantry's moves are Mike's description; the sizes and distances in
metres are the animation's own choices, set by Mike, and are named constants in the file (see the table below).

## When it plays

`playGantry` in `gantryAnimation.js` plays this move, instead of the normal one, when the gantry is on span 29, 41 or 50
(`BEFORE_CRAWL`). The span it is about to build is then 30, 42 or 51, and the double girder span it sets up for is the one
after: 31, 43 or 52.

| Gantry is on | About to build | Double girders at | The short support goes to the end of span |
| ------------ | -------------- | ----------------- | ----------------------------------------- |
| Span 29      | Span 30        | Span 31           | 32 (the hammerhead between 32 and 33)     |
| Span 41      | Span 42        | Span 43           | 48 (the tulip between 48 and 49)          |
| Span 50      | Span 51        | Span 52           | 55 (the tulip between 55 and 56)          |

Only the move from span 41 has been watched. The other two use the same code with their own spans and have not been run.

## The supports

The animation names them as the normal move's steps do (see [`../animation-steps/README.md`](../animation-steps/README.md)):

- **Support A**: the second support, just behind the span the gantry is on.
- **Support B**: the third support, at the rear, lying lengthwise.
- **Support C**: the fourth support, picked up first, as in the normal move.
- **The short support**: the front support, the shorter of the four beams (63 long, against 90). It is the one the crane
  move sends ahead.

While the move is being worked on, temporary letters A, B and C are drawn on the supports (`addSupportLetters` in
`normalMove.js`, marked `// TEMP`), and every step logs to the console (also `// TEMP`).

## Observed, Nov. 19 (what plays from span 41)

The crews didn't do it the way the steps below guessed. By the afternoon of Nov. 19 (Mike, from the ground):

- **Support A** is in its regular place half way through the normal move (after the normal step 10): just behind span 42,
  at the 41/42 tulip, in the front position.
- **Support C** is in its regular place half way through the normal move (after the normal step 4): the rear support's
  place on span 41.
- **The short support** is off its long blue legs, standing across the guideway 15 ft behind A (the gap between the two beams).
- **Support B** was lifted by a mobile crane (not the short support, as the steps below have it) across the two double
  girders at the east end of the double girder section (the 42/43 joint), with its deck facing west. Its wheel assemblies
  are on the unfinished span 42.

From span 41 the animation starts in that layout (`placeNowLayout` in `beforeCrawl.js`, with no animation, and the
trusses where `placeGantry()` puts them) and plays the walk from there (file 2). The steps below are the earlier guess, and
they no longer play from span 41. They still play from spans 29 and 50, which haven't been watched.

## The steps (the earlier guess)

The sequence was worked out with a model of the move (`P` steps in the code, 29 of them), keeping the tipping margin at 3.93 : 1
or more throughout, with the trusses at 75% of the gantry's 440 t, the trolley 3.5 long supports and the short support 1/1.3 of
a long one. The trolley never moves while a lifting jack holds a support over open air, and the short support never holds
the trusses during a swing.

| P     | What happens                                                                                                                                                                                  |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-3   | The trolley takes C lengthwise to 19.5 m from the 40/41 joint and turns it across                                                                                                             |
| 4     | The trusses go back as far as they can with the short support still in the trolley's reach; B comes under them                                                                                |
| 5-7   | The short support goes back lengthwise over A and is set down lengthwise, 26 m behind span 41                                                                                                 |
| 8-11  | A goes lengthwise to the edge of span 41 and is turned across facing the other way (it takes the front role)                                                                                  |
| 12-13 | C goes to just behind A, the beams touching                                                                                                                                                   |
| 14-15 | The short support is turned across: the rear holder                                                                                                                                           |
| 16-17 | The trolley goes to B; the trusses go back until the front lifting jacks are over A                                                                                                           |
| 18-20 | B goes lengthwise over the short support onto span 41 and is turned across                                                                                                                    |
| 21-22 | The front jacks carry A to the swing point (the rear jacks taking the short support on the way); the swing about C; A set down across the double girders. The trolley stays over B throughout |
| 23-24 | The rear jacks carry the short support forward and set it down; the trusses go back until it is in reach                                                                                      |
| 25-27 | The trolley takes the short support lengthwise to between B and C                                                                                                                             |
| 28-29 | The trusses go forward until centred between C and A                                                                                                                                          |

Then the walk over the double girders follows (file 2).

## The numbers

Named constants in `beforeCrawl.js`: `C_TURNS_AT_METRES` (19.5), `SHORT_REAR_METRES` (26), `SHORT_DROP_METRES` (20.5) and
`C_A_GAP_METRES` (0, C's beam against A's). The rear lifting jacks are `PICKUP` past the rear tip's middle, outwards, mirroring
the front ones (`rearJackY`).

## Differences from the first plan

The first plan (the steps this file used to list) was simpler, and the built move is not the same:

- The first plan had the trolley carry the front support about 8 m ahead and make it disappear there. The move first carries
  the short support forward, turns it, back, turns it again and sets it down behind C (steps 6 to 10), and only later moves
  it to the joint (steps 26 to 30).
- The first plan had Support B become the temporary front support, picked up by the front lifting jacks and carried across
  both girders. The move carries Support C to the front support's place, and puts it across both girders; B is the
  counterweight on the rear jacks and is moved later.
- The first plan skipped steps 12 to 16 of the normal move. They are played, with the roles above.
- The first plan had no step where A is moved. Here A is lifted on the rear lifting jacks and carried forward at the end
  (steps 37 to 42).

## What isn't settled

- The ending: the move stops after step 42, with no snap to the next span and the pieces left where the animation put them.
  The span number is already the next span's. The move returns false, so the Play run ends there. If it returned true, the
  run would go on with the normal move for the next span, which starts from the drawing as it is placed for the span before,
  so the supports would jump back to that (Support C, for one, to span 40). What the crawl (file 2) starts from is not decided.
- Step 34 (`step29TrolleyToSnapPlace`) drives the trolley to where the snap would put it, but there is no snap.
- The gap after step 4 and after step 10 is about 4 to 7 px at the usual zoom, not touching. The supports' beams are measured
  without their outlines, and C's beam has a stretch of its own in the drawing, so the edges don't line up exactly.
- The wheel slide of step 17 has been checked by arithmetic, not by eye.
- The trolley's limit against the blue tips is applied only in the normal step 24 (step 32 above). The other moves of the
  trolley and trusses don't check it.
- The temporary letters and console logs are still in.
