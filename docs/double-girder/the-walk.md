# The walk

How the gantry crosses spans 43 to 47 (from span 41) and 52 to 54 (from span 50), from the start layout in
[`README.md`](README.md) to the normal move's half-way layout on the last double girder span.

## How it is built

`walk.js` holds each walk as data (`WALKS`, by the span it starts from) and `walkPlayer.js` (`playSteps`) plays
it. Positions are metres along the guideway's middle line (the girders' middle on the double girder spans) from the back
of the span the walk starts from. A step is one of:

- `trusses`: the trusses slide until their rear end is at `R`, the trolley parked over `anchor`, then line up again.
- `carry`: the trolley carries a support to `to`, turned lengthwise first and back across at the end when it passes over
  others.
- `turn`, `fill` (the span is built) and `park`.

The steps were worked out with a model of the move that checks the rules in the README, with the trusses at 75% of the
gantry's weight, the trolley 3.5 long supports and the short support 1/1.3 of a long one.

After a truss move the trusses lie along the guideway, centred on its middle line (halfway between the two supports'
wheel assemblies while they stand either side of the step onto the girders, so the span just built stays under the
hangers). The sideways part is played during the slide. The long supports under the trusses slide their wheel assemblies
to stay under them, and the trolley sets the short support down straight under the trusses.

## Spans 43 to 47 (from span 41): 40 steps

- **Start (8 steps).** The trusses slide onto span 42 on A and B, and the span fills in; C is still the rear holder, so
  the short support holds nothing during the swing at the 41/42 bend. The short support is carried back to 20 m, then A,
  C and the short support go forward to the loop's places, a spacing apart behind B.
- **The loop (14 carries).** The trolley carries the back support over the others to one spacing past the front one,
  and the trusses move on so their middle is over the third support from the back, the trolley parked over the support it
  carries next. The spacing is 15.64 m, so the last carry lands the short support on the 47/48 hammerhead (301.04 m).
- **End (4 steps).** A to just behind the short support (299.05 m), C back to its place on span 48 (256.4 m), the trusses
  back, and B back over C to one spacing behind it (240.76 m).
- **Margins.** 3.97 at the least, and 11.7 in the normal move's steps 12 to 14.

B and C go back at the end because the normal move's steps 12 to 14 slide the trusses about 36 m back to pick up the
short support with the front jacks, which needs a long support behind the trusses' middle (about 249 m). B goes back
only as far as that needs.

## Spans 52 to 54 (from span 50): 32 steps

The same walk. B starts across the double girders at the 51/52 joint (79.2 m); span 51 is only 30 m long.

- **The loop (10 carries).** The spacing is 16.12 m, so the last carry lands the short support on the 54/55 hammerhead
  (240.42 m).
- **End.** A to 238.41 m, C to its place on span 55 (191.02 m), the trusses back, and B one spacing behind C (174.9 m).
- **Margins.** 4.55 at the least, and 15.3 in the normal move's steps 12 to 14.

## The hand-off

The walk writes every piece's place into the drawing and sets `gantry.dataset.halfway`, and the normal move goes on from
its step 11 (`playSecondHalf` in `normalMove.js`), measuring every support where it stands. The short support's place
(steps 13 to 16) and B's (step 20) come from the snap layout on the next span (`placesOn` in `placeGantry.js`), so the
snap swaps B and C, two identical supports, with nothing jumping.

## Starting part way

With status.yaml on span 42 (hung), 51 (hung) or a double girder span, the gantry is shown where the walk has it at that
point (`poseGantry`), and Play goes on from there. The steps up to it play with no time (`walkPartWay` in `walk.js`).
The gantry stands where status.yaml's span turns to the progress colour: once it is built for 42 and 51, once two
supports stand at or past its far joint for the double girder spans, and at the hand-off for the last one.

| Span  | 42 (hung) | 43  | 44  | 45  | 46  | 47       |
| ----- | --------- | --- | --- | --- | --- | -------- |
| After | step 2    | 13  | 19  | 25  | 31  | hand-off |

| Span  | 51 (hung) | 52  | 53  | 54       |
| ----- | --------- | --- | --- | -------- |
| After | step 2    | 15  | 23  | hand-off |
