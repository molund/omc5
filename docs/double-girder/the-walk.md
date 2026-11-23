# The walk

How the gantry crosses spans 43 to 47 (from span 41) and 52 to 54 (from span 51), from the start layout in
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
  back, and B back over C to 223.9 m, where the rear lifting jacks pick it up as ballast about 70% of the way through the
  front support's trip.
- **Margins.** 3.97 at the least, and 11.7 in the normal move's steps 12 to 14 (worked out with B at 240.76 m, before
  it went further back; not checked again since).

B and C go back at the end because the normal move's steps 12 to 14 slide the trusses about 36 m back to pick up the
short support with the front jacks, which needs a long support behind the trusses' middle (about 249 m). B, the rear
support, goes further: far enough for the rear lifting jacks to carry it as ballast, as in a normal move. Span 47 is
55.6 m long, so the places the normal move's rules give (made for 40 m spans) would leave it out of their reach.

## Spans 52 to 54 (from span 51): 26 steps

No crane: the normal move from span 50 has set the short support, legs off, across the span 52 girders at the 51/52
joint (30.96 m, from the 50/51 joint), and span 51 is built (step 0) before the walk starts. Span 51 is only 30 m long.

- **Start (6 steps).** The trusses slide back in two goes (rear end to −46.24 m, then −54.24 m), so they roll onto B
  before their middle passes A. Then A goes forward to 10.81 m, C (lengthwise on span 50) back to −29.5 m, turned across,
  and B over C to −9.34 m, a spacing apart behind the short support, which stays where the jacks set it. The trusses go
  to where the loop starts.
- **The loop (8 carries).** The short support starts at the front, so it comes round every fourth carry. The spacing is
  20.15 m, so the eighth carry lands it on the 54/55 hammerhead (192.18 m). The spacing can't go much past 21.5 m: the
  trolley can only reach about 43 m behind the trusses' middle, two spacings.
- **End (4 steps).** A to 190.17 m, the trusses back (rear end to 102.76 m), B back over C to 112.16 m as ballast for
  the rear lifting jacks, and C to its place on span 55 (142.78 m). B goes before C, or the two would stand only 9 m
  apart. That's the same half-way layout the walk from span 50 used to hand over in, with the trusses 1 m further back
  so the trolley reaches B; the normal move's step 11 sends the trolley to C.
- **Margins.** 4.84 at the least, in the loop's carries (any spacing gives the same: 21.81 ÷ 4.5). The model was checked
  against the walk from span 41, whose 3.97 it gives at the same step. The normal move's steps 12 to 14 weren't checked
  again: they start from the same layout as before (15.3).

## The hand-off

The walk writes every piece's place into the drawing and sets `gantry.dataset.halfway`, and the normal move goes on from
its step 11 (`playSecondHalf` in `normalMove.js`), measuring every support where it stands. The short support's place
(steps 13 to 16) and B's (step 20) come from the snap layout on the next span (`placesOn` in `placeGantry.js`), so the
snap swaps B and C, two identical supports, with nothing jumping.

## Starting part way

With status.yaml on span 42 (hung) or a double girder span, the gantry is shown where the walk has it at that point
(`poseGantry`), and Play goes on from there. The steps up to it play with no time (`walkPartWay` in `walk.js`). The
gantry stands where status.yaml's span turns to the progress colour: once it is built for 42, once two supports stand at
or past its far joint for the double girder spans, and at the hand-off for the last one. On span 51 the walk hasn't
started yet: the gantry stands where `placeGantry()` draws it, and Play starts the walk from there.

| Span  | 42 (hung) | 43  | 44  | 45  | 46  | 47       |
| ----- | --------- | --- | --- | --- | --- | -------- |
| After | step 2    | 13  | 19  | 25  | 31  | hand-off |

| Span  | 52  | 53  | 54       |
| ----- | --- | --- | -------- |
| After | 13  | 19  | hand-off |
