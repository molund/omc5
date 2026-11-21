# 2. The crawl: over the double girder spans

Spans 43 to 47, and 52 to 54. The gantry moves on its three long supports and the trolley crane. No front support is
placed on a concrete support, so the concrete supports under the section don't matter. The leapfrog is built
(`src/MapView/gantryAnimation/crawl.js`, see "What is built" below); the move after the crawl is not.
Overview and shared notes: [`README.md`](README.md). Before: [`1-before-the-crawl.md`](1-before-the-crawl.md). After:
[`3-after-the-crawl.md`](3-after-the-crawl.md).

## The walk (built)

`walk.js` (`playWalk`) plays the walk from the layout the crews had on Nov. 19 (file 1, "Observed, Nov. 19") to the
normal move's half-way layout for the move from span 47 to 48, where the normal move takes over at its step 11. It is kept as plain as it can be: almost all of it
is the loop, and the start and the end are made of the same kind of move.

- **Start (`ENTRY`, 8 steps).** The trusses slide onto span 42, held by A at 41/42 and B at 42/43, and the span fills in.
  The short support (standing across 15 ft behind A) is carried a little further back, to 20 m, so it can hold the trusses
  while C is carried. Then A, C and the short support are carried forward to the loop's places, a spacing apart behind B.
  They already stand in an order that works (C, S, A, B from the back), so nothing has to swap places.
- **The loop (`LOOP`, 14 times round).** The spacing is 15.64 m, so the short support's last carry lands on the 47/48
  hammerhead, 14 spacings past B. B's deck faces east again after its first carry.
- **End (`EXIT`, 4 steps).** After the loop's last carry (the short support onto the 47/48 hammerhead) the trusses slide
  forward, A is carried to its place just behind the short support (as the normal move's step 10 places it), C goes back
  to its place on span 47 (step 4's), the trusses go back to their place on span 47, and B goes back behind C as far as the
  trusses allow (233.2 m; any further and the trusses' middle would be behind the last support holding them). That is
  the normal move's half-way layout for the move from span 47 to 48, and the normal move goes on from its step 11
  (`playSecondHalf` in `normalMove.js`, told by `gantry.dataset.halfway`). It picks B up on the rear jacks where it
  stands, in step 13.

The supports end in the normal move's half-way layout, each letter in its normal role. The margin never goes below 3.97.
It was worked out with the same model of the move as file 1, with these rules:

- The tipping margin stays at 3.93 : 1 or more.
- No support is ever set down lengthwise on the double girders. A support can be turned in the air during a carry.
- During any swing or turn the short support holds nothing: it hangs from the jacks, is out from under the trusses, or
  stands between the two main long supports without holding them. Turns too small for the animation to show don't count.
  The bends between spans are measured from the map (41/42 1.9 degrees, 43/44 -1.6 degrees, and so on).
- The trusses only move with the trolley parked over a long support standing across.
- The short support ends on the hammerhead at the end of span 47 (47/48), A in its normal place just behind span 47, and every
  deck in its regular position (long supports' decks east, the short support's west).
- Repeated identical steps are preferred: two identical steps count as 0.85 steps each (A, B and C count as the same).

After each truss move the trusses are lined up again on their two main supports, with a swing where the curve calls for one.
The leapfrog below was the earlier plan. It is not played any more (`crawl.js` is unused and can go once the walk has been
watched).

## Where the crawl starts

The crawl starts where `beforeCrawl.js` ends (file 1), with the three long supports in this order along the guideway:

- **B** is the rear support, set down where C was set down in step 4 of file 1.
- **A** is the middle support, halfway between B and C.
- **C** is the front support, centred across the two double girders, with its wheel assemblies on the unfinished span.

The short support isn't one of the three. It is waiting at the joint past the section (48/49 for the crawl over spans 43 to
47, 55/56 for 52 to 54, and 32/33 for span 31). The trolley is wherever file 1 left it: over A, on the trusses as they were
placed there. The crawl moves the three long supports and the trolley crane only; it doesn't use the front lifting jacks or
the ballast.

## The rule for moving the trusses

New, from Mike. **The trusses can only move while the trolley crane is sitting still over one of the three long supports.**
It applies to every truss move, in the crawl and outside it. Over the short support, or between supports, the trusses don't
move. In the animation that means the trolley's cancelling moves (it stays still on the map as the trusses slide under it)
are only played while it is over A, B or C.

Checked against file 1's steps: every truss move there has the trolley over A, B or C (over A in steps 12 to 17, 24, 25 and
32, over B in step 33, and over C in steps 37 and 38). The steps where the trolley is over the short support don't move the
trusses. Nothing was changed.

## The leapfrog, step by step

Each crawl move, as Mike describes it. At the start of a move the three long supports are, rear to front, R (rear), M
(middle) and F (front); in the first move R is B, M is A and F is C.

1. The trolley goes to the front support F and anchors there: it sits still over it.
2. It pushes the trusses forward until 66% of the trusses' length is in front of the middle support: the trusses' front tip
   is 66% of their length past M's middle. The 66% is a constant to tune (`PUSH_SHARE = 0.66`, named here, to be created
   with the code). It is a separate thing from the "about 3/4 of the truss length" below, which is only a figure of speech
   about `Dmax`. **At the same time** the gantry is centred on the two supports that hold it, M and F: the trusses' line is
   made to run through the middle of both beams (the trusses shift straight across so M is on their line, and swing about M
   so F is too), so the ends of the beams stick out the same distance on both sides of the gantry. This is all done with the
   trolley anchored over F; the trolley doesn't go to M to do it. It means that when the rear support is picked up the gantry
   is already centred for the move.
3. The trolley moves to the rear support R and picks it up.
4. It turns it 90 degrees clockwise, so it lies lengthwise.
5. It carries it to a place the `Dmax`-based distance (the `step` below) in front of F. **In the middle of the carry**, when
   the support is halfway between the other two (M and F), the trolley stops, turns it 90 degrees counter-clockwise (across
   the guideway) and puts it down there. Then the trolley goes
   to the rear support (M, now the rear of the three), pushes the trusses back by 13% of their length (`BACK_SHARE = 0.13`;
   it stays over M), and returns to the support in the middle, picks it up, turns it 90 degrees clockwise (lengthwise again)
   and carries it on. The rest of the carry is the trusses swinging
   about M so the support lands centred on the two girders (see "What is built").
6. It turns it 90 degrees counter-clockwise, so it lies across the guideway again, and puts it down.
7. The support it just put down is the new front support and the one the trolley anchors to next. The old F is now the
   middle one and the old M is the rear one, and the next move repeats from step 1.

So the first move picks up B and puts it ahead of C; the next picks up A and puts it ahead of B; then C, and so on.

This is the three steps this file had before (pick up the rear support, put it `Dmax` in front of the front one, the old
middle support is now the rear one), with the trolley's anchoring, the push and the two turns added. The crawl itself doesn't
use the front lifting jacks or the ballast.

## What is built

`playBeforeCrawl` ends by calling `playCrawl` (`crawl.js`), so the crawl follows the move before it in the same run, from the
state it leaves. Helper files: `guideway.js` (the line along the guideway through the middle of each span's two girders) and
`supports.js` (how Support C is slid and turned).

- **Spans.** The double girder spans after the span about to be built: 43 to 47 for the move from span 41 (31 alone from span
  29, and 52 to 54 from span 50).
- **Numbers.** `Dmax` is half the length of span 42 (`DMAX_REFERENCE_SPAN`, `DMAX_SHARE = 0.5`): 66.9 drawing units (about
  20 m) on this map. `L` is from where C stands (the start of span 43) to the end of the last double girder span, 725.7 units
  for 43 to 47, so there are `ceil(725.7 / 66.9) = 11` moves of 66.0 units each. The push is `PUSH_SHARE = 0.66`.
- **Wheels.** The crawl starts with Support C's wheel assemblies slid back to the middle of its beam (the move before the
  crawl had slid them to the middle of the unfinished span).
- **The stop in the middle.** The carry is in two parts, with the support put down halfway between M and F. The trolley
  goes to M, the trusses are pushed back 13% of their length (`BACK_SHARE`, tune it), and the trolley returns to the support in
  the middle. The next push (step 2 of the following move) is longer by about that much (about 114 units against 60 in the run).
- **Centring.** The push and the centring on M and F are one movement (step 2), played with the trolley over F. The push
  is given in the direction the trusses lie in now, since a shift and a swing at once turn the slide. After it the trolley
  settles back over F if the turn left it a hair off.
- **A move** is the seven steps above: the trolley to the front support, the push (skipped when it is under 0.5 of a unit),
  the trolley to the rear support, it turns 90 degrees clockwise, it is carried to its place, it turns counter-clockwise to lie
  across the span it lands on, and is set down. Then the roles shift.
- **Carrying it to its place.** The place is on the line through the middle of the two girders of the span it lands on, so the
  support is centred on the two girders when it is set down. The trolley can only move it along the trusses, so it is done as
  the move before the crawl does it: the trolley carries the support along the trusses to the point on that line which is as
  far from the middle support as its place is, then the trusses swing about the middle support, with the trolley still holding
  the support, until it is on its place. If a small gap is left (up to about 1.4 units in the run), the support is moved that
  little by itself.
- **The whole crawl plays.** `MAX_MOVES` in `crawl.js` is `Infinity` (set it to a number to play only that many moves while
  checking). From span 41 all 11 moves ran with no errors; the supports end spaced one `step` apart. The swings were small
  (up to about 3 degrees).
- **Not done.** The trolley's limit near the blue tips isn't applied; nothing stops the crawl at the section's end except the
  move count; nothing is done after it (file 3). The run ends after the crawl.

## How far it can move

1. `Dmax`: the most the gantry can advance in one move without tipping.
2. `moves = ceil(L / Dmax)`, where `L` is the length of the crawl on the three long supports. `L` leaves out the move at
   the start (file 1) and the move over span 48, or 55 / 56, at the end (file 3): both use the front lifting jacks and the
   ballast, so they aren't part of it.
3. `step = L / moves`: equal steps, each a little shorter than `Dmax`. `step` is the distance in step 5 above.
4. `Smin`: the shortest spacing between the three long supports, the room needed to finish the rotation. Calculate it from
   the length of a long gantry support in the drawing: half that length plus about 2 m of clearance. It doesn't have to be
   exact.

The starting value of `Dmax` is **half the length of span 42**, read from the map. This is the reference for all three
crawls (31, 43 to 47 and 52 to 54), not a value taken from each crawl's own spans. It replaces the doc's earlier starting
value (half of span 44's length, about 20 m), which is no longer used. It is only a starting value, and probably a
conservative one: `2 x Dmax` won't be calculated, Mike will fill it in from what he sees from the ground, increasing or
decreasing it after the first move. `Smin` comes from the drawing. The shorter crawl (52 to 54) should need fewer moves than
the five-span one, which makes the two a good check on the first estimate.

## The limit on `2 x Dmax`

The total distance across the three supports is limited by the trusses. With equal gaps that is two gaps of `Dmax`, so the
limit applies to `2 x Dmax`.

**The 3/4 is only a figure of speech.** Mike says "about 3/4 of the truss length" in conversation, as a rough idea of the
size. It is not a constant to put in the code, and `Dmax` is not to be set as 3/8 of the truss length. The real value of
`2 x Dmax` will not be calculated. Mike will fill it in from observation: from the ground he expects to see something like
"it moved about 2/3 the length of a span", and that kind of reading sets the number.

The trolley's stopping points are recorded here as background, not as a way to calculate the value. They are the ones the animation already uses (`TIP_GAP_SHARE` in `normalMove.js`). Plainly: the trolley may
not come closer to the blue tips at the rear end of the trusses than half a tip's length. Mike confirms the rear limit is
that same place, and that the front limit is the same place relative to the front end of the trusses.

## Open in this file

- Where the crawl stops, and so `L`: not said yet.
- The observed value of `2 x Dmax`, to be filled in by Mike from the ground.
- How many moves each section needs, from the span lengths on the map.
- Whether `PUSH_SHARE` (66%) needs to change after the first run: it is a starting figure.
