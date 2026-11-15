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

## The steps

The steps are `step…` functions in `beforeCrawl.js`, run in the order below, and are numbered here 1 to 42 in the order they
play. The numbers in the code's function names are different, because the move reuses the normal move's steps (marked
"normal" below, with the normal move's own step number) and numbers its own steps 4 to 36 around them, so some numbers
appear twice in the code. The right-hand column of the map below gives the function for each step here.

| Here  | In the code                                                                             |
| ----- | --------------------------------------------------------------------------------------- |
| 1-3   | the normal steps 1 to 3 (step 0, the fill, runs first as the move starts)               |
| 4-11  | `step4SetCBehindFrontSupport` to `step11TrolleyBackToSupportA`                          |
| 12-17 | `step12TrussesBackForC` to `step17TrussesToHalfway`                                     |
| 18-19 | the normal steps 18 and 19                                                              |
| 20-22 | `step20CarryBAheadOfFrontSupport`, `step21TurnBBack`, `step22SetBWhereCWas`             |
| 23    | `step23TrolleyToSupportA`                                                               |
| 24-25 | the normal steps 22 and 23 (with C and B)                                               |
| 26-30 | `step24TrolleyToShortSupport` to `step28MoveShortSupportToJoint`                        |
| 31    | `step23TrolleyToSupportA` again                                                         |
| 32-33 | the normal steps 24 and 25 (with B)                                                     |
| 34    | `step29TrolleyToSnapPlace`                                                              |
| 35    | the fill, `step0FillSpan` (the normal step 0), with the span number put up by one first |
| 36-42 | `step30TrolleyToC` to `step36TurnAAcross` (36 also clears the hangers)                  |

The trolley is always the trolley crane; "stays still over X" means it is moved back along the trusses by the same amount as
they move, so it doesn't move on the map.

**1. Shared start (normal steps 0 to 3).**

1. The span the gantry is on fills in (hangers go on).
2. The trolley slides over Support C and the hangers come down.
3. The trolley carries C forward, and then C turns to lie the way the second support will on the next span.

**2. Support C goes behind the short support.**

4. The trolley carries C forward, with the span, and sets it down behind the short support, its front edge against the short
   support's rear edge, turned to the same angle as the short support.

**3. The crane move: the short support goes behind C.**

5. The trolley slides on its own over the middle of the short support.
6. It picks the short support up and carries it forward 6 m (`FORWARD_METRES`).
7. The short support turns a quarter turn counter-clockwise about its own middle, to lie lengthwise. It is drawn above the
   supports that lie across the trusses while it does.
8. The trolley carries it back, over C, until its middle is half its length plus 1.5 m (`SPIN_CLEARANCE_METRES`) behind C's
   rear edge: far enough back for it to turn without its ends touching C.
9. It turns a quarter turn clockwise, across the guideway again.
10. The trolley carries it forward to 1 m (`SET_DOWN_GAP_METRES`) behind C's rear edge, and sets it down.
11. The trolley slides back on its own over the middle of Support A. A doesn't move in this move until step 38.

**4. C is carried to the front support's place (the normal move's steps 12 to 17, with other supports).**

12. The trusses slide back until their front tip is over C's middle. The trolley stays still over A.
13. The trusses carry C forward, the first part of its trip.
14. The rest of its trip, with Support B riding along on the rear lifting jacks.
15. The trusses pivot about the short support and swing, carrying C to its place. B swings with them as a counterweight.
16. The trusses and B swing back, and C turns about its own middle to the angle it has on the next span.
17. The trusses slide back until their middle is halfway between the short support and Support A. C's wheel assemblies slide
    along its beam, starting 500 ms after the trusses start to move.

C's place is not the normal front support place. Along the guideway it is the normal place (the front support's place on the
next span). Across, its beam is centred on the two double girders of the span after the one about to be built (midway
between their outer edges). Its two wheel assemblies are centred on the unfinished span about to be built, and are slid
along the beam to get there (step 17). The pivot is the short support, not A: A hasn't been carried.

**5. B is carried out of the way and put where C was.**

18. The trolley slides back to stop over B (the normal step 18).
19. B turns to lie lengthwise (the normal step 19).
20. The trolley carries B forward until its middle is 12 m (`B_AHEAD_METRES`) ahead of the short support's middle.
21. B turns a quarter turn about its own middle, opposite to its turn in step 19, so it lies across the guideway again.
22. The trolley backs up with B and sets it down where C was set down in step 4, in front of the short support.

**6. The trusses move onto the next span.**

23. The trolley slides over Support A and stays there.
24. The normal step 22: the trusses slide forward until their front ends are just past C.
25. The normal step 23: the trusses shift across and turn onto the next span's line, pivoting about B.

**7. The short support goes to its joint.**

26. The trolley slides over the short support.
27. It carries it back 12 m (`SHORT_BACK_METRES`) along the trusses.
28. The short support turns a quarter turn counter-clockwise, to lie lengthwise. The trolley keeps holding it.
29. The trolley carries it forward until its middle is 12 m (`SHORT_INTO_SPAN_METRES`) in from the rear end of the unfinished
    span about to be built.
30. The short support disappears and reappears at once at the end of span 48 (the 48/49 joint, from span 41). It lies across
    the guideway on the west side of the joint (the next span's side, as spans are numbered westward), its edge against the
    joint, centred across on the unfinished gantry-built guideway there, not on the whole tulip. The flatbed and the crane
    that lift it are not drawn. The trolley is left where it is.

**8. The trusses finish their slide.**

31. The trolley slides back over Support A.
32. The normal step 24: the trusses slide forward onto the next span, as far as the trolley can go before it is half a blue
    tip (the blue rectangles) from the trusses' rear tips.
33. The normal step 25, with B: the trolley drives to B, and the trusses slide the rest of the way, the trolley staying still.
    This is why the trolley doesn't drive off the end of the trusses.
34. The trolley drives to where the snap would put it on the map (`step29TrolleyToSnapPlace`). There is no snap now, so
    this is left over from an earlier version and may go.

**9. The new span fills in; A is moved forward.**

35. The gantry's span number goes up by one, and the span it is now on fills in (the normal step 0). Nothing else resets:
    the pieces stay where the animation left them.
36. The trolley slides over C, and stays there. The hangers the fill put on come down.
37. The trusses slide so their rear tips (the blue tips) are over A.
38. A is lifted by the rear lifting jacks, and the trusses carry it forward until it is 12 m (`A_FROM_B_METRES`) behind B,
    middle to middle. The trolley stays still over C.
39. The trolley slides over A.
40. A turns a quarter turn counter-clockwise, to lie lengthwise.
41. The trolley carries A to halfway between B and C.
42. A turns a quarter turn clockwise, across the guideway again, and is left there. This is the end of `beforeCrawl.js`.

## The numbers

| Constant                 | Value | What it sets                                                                        |
| ------------------------ | ----- | ----------------------------------------------------------------------------------- |
| `FORWARD_METRES`         | 6 m   | How far the short support is carried forward before it turns (step 6).              |
| `SPIN_CLEARANCE_METRES`  | 1.5 m | Room kept beyond half its length when it carries back to turn (step 8).             |
| `SET_DOWN_GAP_METRES`    | 1 m   | The gap behind C's rear edge when it is set down (step 10).                         |
| `B_AHEAD_METRES`         | 12 m  | How far B is carried ahead of the short support (step 20).                          |
| `SHORT_BACK_METRES`      | 12 m  | How far the short support is carried back before it is turned lengthwise (step 27). |
| `SHORT_INTO_SPAN_METRES` | 12 m  | How far in from the rear end of the unfinished span it is carried (step 29).        |
| `A_FROM_B_METRES`        | 12 m  | How far behind B support A is carried on the rear jacks (step 38).                  |
| `SHORT_JOINT`            |       | The span whose front end the short support goes to, for span 29, 41 or 50.          |

Metres are turned into drawing units with `UNITS_PER_METRE` (3 units, shown 1.11 times larger: about 3.33 per metre).

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
