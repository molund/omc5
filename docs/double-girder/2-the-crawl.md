# 2. The crawl: over the double girder spans

Spans 43 to 47, and 52 to 54. The gantry moves on its three long supports and the trolley crane. No front support is
placed on a concrete support, so the concrete supports under the section don't matter. Planning only. Nothing is built.
Overview and shared notes: [`README.md`](README.md). Before: [`1-before-the-crawl.md`](1-before-the-crawl.md). After:
[`3-after-the-crawl.md`](3-after-the-crawl.md).

## The leapfrog, step by step

Each crawl move, as Mike describes it:

1. The trolley crane picks up the current rear support.
2. It places it a distance `Dmax` in front of the current front support.
3. The old middle support is now the rear one, and the next move repeats.

The crawl itself doesn't use the front lifting jacks or the ballast.

## How far it can move (inferred method)

1. `Dmax`: the most the gantry can advance in one move without tipping. The trolley crane and the support it is holding are
   the lopsided part of the balance, like a giant teeter-totter. Physics probably makes this matter more than it looks.
2. `moves = ceil(L / Dmax)`, where `L` is the length of the crawl on the three long supports. `L` leaves out the move at
   the start (file 1) and the move over span 48, or 55 / 56, at the end (file 3): both use the front lifting jacks and the
   ballast, so they aren't part of it.
3. `step = L / moves`: equal steps, each a little shorter than `Dmax`.
4. `Smin`: the shortest spacing between the three long supports, the room needed to finish the rotation. Calculate it from
   the length of a long gantry support in the drawing: half that length plus about 2 m of clearance. It doesn't have to be
   exact.

The starting value for `2 x Dmax` is the length of span 44, to be read from the map (a span is about 40 m in the drawing,
but use span 44's own length). So `Dmax` starts at half of that, about 20 m. Only `Dmax` needs later adjusting; `Smin` comes from the drawing. The shorter
crawl (52 to 54) should need fewer moves than the five-span one, which makes the two a good check on the first estimate.

## The limit on `2 x Dmax`

The total distance across the three supports is limited by the trusses. With equal gaps that is two gaps of `Dmax`, so the
limit applies to `2 x Dmax`.

**The 3/4 is only a figure of speech.** Mike says "about 3/4 of the truss length" in conversation, as a rough idea of the
size. It is not a constant to put in the code, and `Dmax` is not to be set as 3/8 of the truss length. The real maximum for
`2 x Dmax` has to be calculated, from the trusses and the points on them the trolley crane can't go past.

Those points are the ones the animation already uses (`TIP_GAP_SHARE` in `gantryAnimation.js`). Plainly: the trolley may
not come closer to the blue tips at the rear end of the trusses than half a tip's length. Mike confirms the rear limit is
that same place, and that the front limit is the same place relative to the front end of the trusses.

## Open in this file

- The calculated maximum for `2 x Dmax`, from the rear and front stopping points.
- How many moves each section needs, from the span lengths on the map.
