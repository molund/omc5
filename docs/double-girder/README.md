# Double girder spans: the animation

What the Clayton Clipper does at the three double girder stretches (span 31, spans 43 to 47 and spans 52 to 54), and the
one-off moves at spans 42 and 51 that set them up, as the animation plays them. The crossings of spans 43 to 47 (from
span 41) and 52 to 54 (from span 50) are built as walks; span 31 (from span 29) isn't worked out, and the normal move
plays there.

Everything is Mike's description from watching the site, unless it says "inferred" or "assumed". Those were worked out
from what Mike said and still need checking against what actually happens.

## The files

1. [`1-before-the-crawl.md`](1-before-the-crawl.md): where the supports stand when a crossing starts (the layout the crews
   had on Nov. 19 at span 41, assumed the same at span 50).
2. [`2-the-crawl.md`](2-the-crawl.md): the walk itself, from that layout over the double girder spans to the normal move's
   half-way layout on the last one, the rules it keeps, and starting part way through it.
3. [`code-layout-and-refactor.md`](code-layout-and-refactor.md): how the animation code is laid out, and what is left over
   from earlier plans.

This file holds what they share.

## The short version

- On a double girder span the gantry doesn't place its front support on a concrete support. It crawls over the span on
  its four supports and the trolley crane: the trolley carries the back support over the others to the front, again and
  again (a leapfrog), with no lifting jacks.
- Before the crossing, the span in front of the double girders (42, or 51) is built in a one-off way: a mobile crane sets
  Support B across the double girders at their near end, and the short support comes off its long blue legs and stands
  across the guideway behind A (observed Nov. 19 at span 41).
- At the end the short support stands on the hammerhead at the end of the last double girder span (47/48, or 54/55), A
  just behind it, and the normal move takes over half way through and carries the short support on to the next tulip
  (48/49, or 55/56).

| Gantry is on | One-off move                                  | Crawl over     | Short support ends the walk on | Normal move takes it to |
| ------------ | --------------------------------------------- | -------------- | ------------------------------ | ----------------------- |
| Span 29      | Not worked out (the normal move plays)        | Span 31        |                                |                         |
| Span 41      | B craned to 42/43, short support off its legs | Spans 43 to 47 | Hammerhead 47/48               | Tulip 48/49             |
| Span 50      | Assumed the same: B craned to 51/52           | Spans 52 to 54 | Hammerhead 54/55               | Tulip 55/56             |

Double girder spans: 31, 43, 44, 45, 46, 47, 52, 53, 54. The gantry follows the same pattern on every one of them, for
engineering and operational simplicity. The concrete supports underneath are irrelevant to it.

## Why spans 30, 42 and 51 are different

The westbound precast girder at span 43, the first double girder span, is sitting where the front support would normally
land. It is the westbound girder at 43 that blocks it, not the eastbound girder at 42. At span 51 the blocker is the
westbound girder at span 52, and span 51 has no eastbound girder. The front support can't go there, so it can't follow the
usual cycle (steps 12 to 16 in [`../animation-steps/README.md`](../animation-steps/README.md)).

Spans 30, 42 and 51 are not in the double girder list. They are the irregular ones that set up the crawl.

## No tower

Spans 30, 42 and 51 have no tower and no segments under the front support. The temporary tower used at the extra long span
29, and the temporary structure for span 50, are ignored here.

## Ballast (not animated)

A guideway segment is used as extra ballast only on moves that use the front lifting jacks. On those moves, the rules, as
Mike describes them:

- When the trolley anchors itself over a gantry support to move the trusses, it is always holding the ballast segment.
- Any time the trolley needs to move a support, it puts the ballast down first.

The ballast isn't drawn, and the walks don't use the front lifting jacks. The ballast is a concrete segment (Mike's
"guideway support"). Its weight isn't needed.

## When the trusses can move

The trusses can only move while the trolley crane is sitting still over one of the three long supports (A, B or C). This is
true of every truss move, in the normal move and in the walks. Over the short support, or between supports, they don't
move.

## Where this touches the code

- `DOUBLE_GIRDER` in `src/lib/doubleGirder.js` here, and `src/lib/doubleGirder.js` in molund/omc5-admin. Keep them the same.
- On a double girder span only the gantry's arrival is logged: no Hung and no cycle steps. The progress card shows the
  span as status.yaml gives it (the one-less rule, `cardSpan`, was dropped on Nov. 20; the Leash Log may still have its
  own).
- `playGantry` in `src/MapView/gantryAnimation.js` plays a crossing (`playBeforeCrawl` in `beforeCrawl.js`, then the walk
  in `walk.js`) from spans 41 and 50, and on the spans part way through one; the normal move everywhere else.
- Leash Log: the stage picker is fixed to "arrived at span" on a double girder span (`stageToPost` in
  `src/components/StagePicker.js`).

## Settled

- Nov. 19, observed: a mobile crane lifted Support B, not the short support, across the double girders at the 42/43 joint
  (deck facing west). A took the front position at the 41/42 tulip, C went to its usual mid-cycle place, and the short
  support came off its long blue legs and was set down across the guideway 15 ft behind A (the gap between the beams).
- The crossing of spans 52 to 54 starts from the same kind of layout (assumed; the move from 50 to 51 follows the move
  from 41 to 42).
- The flatbed, the cranes and the ballast aren't animated. B appears across the double girders where the crane set it.
- A long support can slide its wheel assemblies along its beam, so the trusses can move across on it. The short support's
  wheel assemblies hardly move, so it is set down straight under the trusses.
- The short support may hold the trusses, but never during a swing.
- The trolley's limit on the trusses: it can't come closer to the blue tips at either end than half a tip's length.
- Whether a girder is in the way during the crawl doesn't matter: ignore it.

## Open questions

- The crossing of span 31, from span 29: not worked out. The normal move plays there.
- Whether the crews set span 50 up the way they set span 41 up on Nov. 19.
