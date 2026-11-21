# 2. The crawl: the walk over the double girder spans

Spans 43 to 47 (from span 41), and 52 to 54 (from span 50). The gantry crawls on its four supports and the trolley crane,
with no lifting jacks, then hands over to the normal move half way through its move off the last double girder span.
Overview and shared notes: [`README.md`](README.md). Before: [`1-before-the-crawl.md`](1-before-the-crawl.md).

## How it is built

`walk.js` holds each crossing as data (`CROSSINGS`, by the span it starts from) and `walkPlayer.js` (`playSteps`) plays
it. Positions are metres along the guideway's middle line (the girders' middle on the double girder spans) from the back of
the span the walk starts from. There are five kinds of step: `trusses` (slide the trusses to a rear-end position, the
trolley parked over a long support, then line them up again), `carry` (the trolley carries a support, turned lengthwise
and back across when it passes over others), `turn`, `fill` (the span is built) and `park`.

The steps were worked out with a model of the move, under these rules:

- The tipping margin stays at 3.93 : 1 or more (the trusses 75% of the gantry's weight, the trolley 3.5 long supports, the
  short support 1/1.3 of a long one).
- No support is ever set down lengthwise on the double girders. A support can be turned in the air during a carry.
- A support is carried lengthwise when it passes over other supports.
- During any swing or turn the short support holds nothing: it hangs from the trolley, is out from under the trusses, or
  stands between the two main long supports without holding them. Turns too small for the animation to show don't count.
- The trusses only move with the trolley parked over a long support standing across.
- The long supports stand far enough apart to turn across (about 15.5 m: half a long support plus about 2 m).
- The short support ends on the hammerhead at the end of the last double girder span, A in its normal place just behind
  it, and every deck in its regular position (long supports' decks east, the short support's west).
- Repeated identical steps are preferred.

How a truss move ends: the trusses are lined up again along the guideway (its direction halfway between the two main
supports), centred on its middle line, or, while the two stand either side of the step across onto the girders' middle,
halfway between their wheel assemblies, so the span just built stays under the hangers. The sideways part goes into the
slide itself, so the trusses drift over as they go. Each long support standing under the trusses slides its wheel
assemblies along its beam to stay under them; the short support's hardly move, so the trolley sets it down straight under
the trusses' middle line.

## Spans 43 to 47 (from span 41)

From the layout of Nov. 19 (file 1) to the normal move's half-way layout for the move from span 47 to 48: 40 steps.

- **Start (`ENTRY_41`, 8 steps).** The trusses slide onto span 42, held by A at 41/42 and B at 42/43, and the span fills
  in. They stop short enough that C is still the rear holder, so the short support (standing across 15 ft behind A) stands
  between two long supports during the swing at the 41/42 bend. The short support is carried back to 20 m, so it can
  hold the trusses while C is carried. Then A, C and the short support are carried forward to the loop's places, a spacing
  apart behind B, in the order they already stand (C, S, A, B from the back).
- **The loop (`LOOP_41`, 14 times round).** The trolley carries the back support over the others to one spacing past the
  front one, and the trusses move on so their middle is over the third support from the back, with the trolley parked
  over the support it carries next. The spacing is 15.64 m, so the last carry lands the short support on the 47/48
  hammerhead (301.04 m). The trusses line up again only when the short support stands in the middle two. B's deck faces
  east again after its first carry.
- **End (`EXIT_41`, 4 steps).** A is carried to its place just behind the short support (299.05 m, as the normal move's
  step 10 places it), C back to the place the snap gives it on span 48 (256.4 m), the trusses back until the trolley
  reaches behind C, and B back over C to one spacing behind it (240.76 m). The normal move goes on from its step 11
  (`playSecondHalf` in `normalMove.js`, told by `gantry.dataset.halfway`).
- **Margins.** 3.97 at the least (in the loop), 4.82 in the end steps and 11.7 in the normal move's steps 12 to 14.

**Why B and C go back at the end.** Handing over straight after A's carry (B at 269.8 m, C at 285.4 m) looks closer, but
the normal move's steps 12 to 14 slide the trusses back about 36 m to pick up the short support with the front jacks. That
needs a long support behind their middle (about 249 m). With B at 269.8 m the margin falls to about 0.1 as the trusses
slide back. B can't be carried straight back either: while it is lifted, C (at 285.4 m) is the rear holder, so the trusses
can't slide back far enough for the trolley to reach behind 249 m. That is why C goes back first. Leaving B at the back
of the loop instead (skipping its last carry) doesn't work: with B behind, nothing is far enough forward to hold the
trusses for the last carries. B goes back only as far as that needs, not to where the normal move's rules would put the
rear support (the back of span 46, about 200 m: those rules are made for 40 m spans, and span 46 is 55.6 m long).

## Spans 52 to 54 (from span 50)

The same walk with the same rules (`ENTRY_50`, `LOOP_50`, `EXIT_50`), from the same kind of layout, assumed: B craned
across the double girders at the 51/52 joint (79.2 m). 32 steps.

- **Start (8 steps).** As at span 41: span 51 is built (it is only 30 m long), the short support is carried back to 20 m,
  and A, C and the short support go to the loop's places.
- **The loop (10 times round).** The spacing is 16.12 m, so the tenth carry sets the short support down on the 54/55
  hammerhead (240.42 m).
- **End (4 steps).** A to 238.41 m, C to the snap's place on span 55 (191.02 m), the trusses back to R 166.5, and B one
  spacing behind C (174.9 m). The normal move goes on from its step 11.
- **Margins.** 4.55 at the least, and 15.3 in the normal move's steps 12 to 14.

## After the hand-off

The normal move's steps 11 to 28 measure every support where it stands. Two of their targets come from the snap layout
on the next span instead (`placesOn` in `placeGantry.js`, which measures from the drawn layout, as `placeGantry` does):

- **Step 20.** B is carried to C's place on the next span (286.9 m on span 48, 225.0 m on span 55). The snap then swaps the
  two identical supports with no jump, because C already stands on the place behind. Measured from where C stood, that
  target sent B to the wrong place (327 m on span 48), and the snap pulled it back.
- **Steps 13 to 16.** The short support goes onto the snap's place on the next span. Measured from where it stood, the
  target kept how far across it stood (under the trusses' middle line), and the snap then moved it about 1.8 m sideways.

## Starting part way (`walkPartWay`)

With status.yaml on the span built first (42 or 51, hung) or a double girder span, the gantry is shown where the walk has
it at that point (`poseGantry`, whenever the gantry shows and isn't playing), and Play goes on from there. The walk's
steps up to that point play with no time while the gantry is see-through, set up from the start layout on span 41 or 50.
The progress card and the progress colour show the span as status.yaml gives it, and the gantry stands where that span
turns to the progress colour:

| Span  | 42 (hung) | 43  | 44  | 45  | 46  | 47       |
| ----- | --------- | --- | --- | --- | --- | -------- |
| After | step 2    | 13  | 19  | 25  | 31  | hand-off |

| Span  | 51 (hung) | 52  | 53  | 54       |
| ----- | --------- | --- | --- | -------- |
| After | step 2    | 15  | 23  | hand-off |

A double girder span turns to the progress colour once two supports stand at or past its far joint (`markPassedSpans` in
`walkPlayer.js`), and the last one at the hand-off, so Play from 47 or 54 goes straight on with the normal move's step 11.
