# Double girder spans: planning the animation

What the Clayton Clipper is expected to do at the three double girder stretches (span 31, spans 43 to 47 and spans 52 to 54),
and the one-off moves at spans 30, 42 and 51 that set them up. The new code has to work on 31 too, which follows the same
rules as the other two. Nothing here is built yet. The goal is to work out what happens
next so the animation can be ready before the gantry gets there, with the real figures dropped in later.

Everything is Mike's description from watching the site, unless it says "inferred". Inferred means Claude worked it out
from what Mike said and it still needs checking against what actually happens.

## The steps live in three files, and one for the code

Read them in this order:

1. [`1-before-the-crawl.md`](1-before-the-crawl.md): the one-off move at span 42 (or 51, or 30): the front support goes ahead by
   crane, and Support B takes its place across the girders.
2. [`2-the-crawl.md`](2-the-crawl.md): the crawl over the double girder spans on the three long supports: the leapfrog, and
   `Dmax`, `Smin` and `L`.
3. [`3-after-the-crawl.md`](3-after-the-crawl.md): the one-off move at the end: the move over span 48 (or 55 / 56) and the
   return to the normal cycle. Deferred: it will be planned later, once Mike has seen where the crawl finishes.
4. [`code-layout-and-refactor.md`](code-layout-and-refactor.md): how the animation code is laid out, and a proposed refactor.

This file holds what they share.

## The short version

- On a double girder span the gantry doesn't place its front support on a concrete support. It crawls over the span on
  its three long supports and the trolley crane.
- Before each crawl, the front support is moved ahead to the next support after the double girder section, so it is
  waiting there when the gantry arrives. On site it takes three steps: the trolley crane lifts it onto a flatbed, the
  flatbed carries it to that support, and a crane lifts it onto the support. The animation shows only the first part: the trolley crane
  picks up the front support and carries it forward a little, then the support disappears while the trolley is still
  holding it, and reappears on its new support further down the line.
- That happens three times: span 30 (before the crawl over span 31), span 42 (front support to the tulip between spans 48
  and 49) and span 51 (front support to the tulip between spans 55 and 56).

| Gantry is on | Crane move                              | Crawl over     | Front support waits at                                           |
| ------------ | --------------------------------------- | -------------- | ---------------------------------------------------------------- |
| Span 30      | Same again                              | Span 31        | Hammerhead between 32 / 33, centred on the gantry-built guideway |
| Span 42      | Front support moved ahead of the gantry | Spans 43 to 47 | Tulip between 48 / 49                                            |
| Span 51      | Same again (confirmed by Mike)          | Spans 52 to 54 | Tulip between 55 / 56                                            |

Double girder spans: 31, 43, 44, 45, 46, 47, 52, 53, 54. The gantry follows the same pattern on every one of them, for
engineering and operational simplicity. The concrete supports underneath are irrelevant to it. They only mattered before
because the front support had to land on one.

## Why spans 30, 42 and 51 are different

The westbound precast girder at span 43, the first double girder span, is sitting where the front support would normally
land. It is the westbound girder at 43 that blocks it, not the eastbound girder at 42. At span 51 the blocker is the
westbound girder at span 52, and span 51 has no eastbound girder. The front support can't go there, so it can't follow the
usual cycle (steps 12 to 16 in [`../animation-steps/README.md`](../animation-steps/README.md)).

Spans 30, 42 and 51 are not in the double girder list. They are the irregular ones that set up the crawl.

## No tower

Spans 30, 42 and 51 have no tower and no segments under the front support. It is set down on a real concrete support (the
tulip). The temporary tower used at the extra long span 29, and the temporary structure for span 50, are ignored here. The gantry
is on span 29 and span 50 when the one-off moves to 30 and 51 start, and those follow the same rule as the move from 41 to 42.

## Ballast (not animated)

A guideway segment is used as extra ballast only on moves that use the front lifting jacks. On those moves, the rules, as
Mike describes them:

- When the trolley anchors itself over a gantry support to move the trusses, it is always holding the ballast segment.
- Any time the trolley needs to move a support, it puts the ballast down first.

The ballast doesn't need to be drawn. The crawl itself (the three long supports and the trolley crane) doesn't use it, so
it doesn't enter `Dmax`. It only matters for the two moves that use the front jacks, the one at the start (file 1) and the
one at the end (file 3), and neither is part of `L`. The ballast is a concrete segment (Mike's "guideway support"), and
that only matters for its weight (about 28 tonnes, the published segment weight).

## Where this touches the code today

- `DOUBLE_GIRDER` in `src/lib/placeGantry.js` here, and `src/lib/doubleGirder.js` in molund/omc5-admin. Keep them the same.
- On a double girder span only the gantry's arrival is logged: no Hung and no cycle steps. The progress card shows one span
  less until the gantry arrives at the next (`cardSpan`).
- The animation (`src/MapView/gantryAnimation.js`) draws Support C turned across the span on a double girder span, with a
  quarter turn when it picks it up. The existing move still puts the front support on a concrete support. The crawl
  would replace that on these spans.
- Leash Log: the stage picker is fixed to "arrived at span" on a double girder span (`stageToPost` in
  `src/components/StagePicker.js`).

## Settled

- When the crane move happens: right after Support C is set down behind the forward support, before the trusses move back
  for Support B (Mike, Nov. 15).
- Which support goes behind the forward support: Support C, not A.
- The flatbed, the crane that lifts the support onto its new support, and the ballast aren't animated. Their type and model
  don't matter, and neither does how many flatbeds there are. The trolley crane is animated: it picks up the front support
  and carries it forward a little, the support disappears while the trolley is holding it, and it reappears on its new
  support.
- Only the front support gets moved by the flatbed. Settled from theory, not observation.
- Span 30's front support goes to the hammerhead between 32 and 33, not a tulip, centred on the unfinished gantry-built
  guideway in the drawing and not on the whole hammerhead.
- The same placing code is used at spans 30, 42 and 51: centre the front support on the unfinished gantry-built guideway in the
  drawing. On a tulip that guideway is already centred, so either target works there. Using the same code in all three
  places is simpler.
- Span 31 follows the same rules as the other two double girder stretches, and the new code works on it. The moves from 29 to 30, 41 to 42 and 50 to 51 follow the same rule. The tower at 29 and the structure for 50 are ignored.
- `2 x Dmax` won't be calculated: Mike fills it in from observation, for example "it moved about 2/3 the length of a span".
- The trolley's limit on the trusses (background only): it can't go past the same place the animation stops it at the rear (just short of the
  blue tips), and the same relative place at the front.
- Support B takes over as the front across both girders.
- The ballast is a concrete segment, and only its weight matters.
- The Leash Log changes for this are already planned, with the rules, in the handover document, so they aren't tracked here.
- The leapfrog and the limits on `Dmax` are in file 2.
- `L` does not include the move at the start or the move at the end, which both use the front lifting jacks and the ballast.
- Whether a girder is in the way during the crawl doesn't matter: ignore it.

## Open questions

- Deferred to a later plan, after seeing where the crawl finishes: everything in file 3, including how the gantry hands over
  from Support B to the waiting front support at the tulip.
- The observed value of `2 x Dmax`, filled in by Mike from the ground (it isn't calculated), and how many moves each section needs
  from the span lengths on the map. (File 2.)
