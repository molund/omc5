# 1. Before the crawl: where a crossing starts

The gantry is on span 41 (or 50) and about to build 42 (or 51), the span in front of the double girders. The animation
starts the crossing from where the crews had the supports on Nov. 19 at span 41, and assumes the same at span 50. Overview
and shared notes: [`README.md`](README.md). Next: [`2-the-crawl.md`](2-the-crawl.md).

## When it plays

`playGantry` in `gantryAnimation.js` plays `playBeforeCrawl` (`beforeCrawl.js`) when the gantry is on a span with a walk
(`hasWalk` in `walk.js`): span 41 or 50, or a span part way through a crossing (file 2, "Starting part way"). It sets the
supports in the layout below with no animation (`placeNowLayout`), and the walk plays from there.

| Gantry is on | About to build | Double girders | B is craned to | The walk ends on |
| ------------ | -------------- | -------------- | -------------- | ---------------- |
| Span 41      | Span 42        | Spans 43 to 47 | 42/43          | Span 47          |
| Span 50      | Span 51        | Spans 52 to 54 | 51/52          | Span 54          |

From span 29 (span 31's crossing) there is no walk, and the normal move plays.

## The supports

The animation names them as the normal move's steps do (see [`../animation-steps/README.md`](../animation-steps/README.md)):

- **Support A**: the second support (`data-anchor` "second").
- **Support B**: the third support ("rear").
- **Support C**: the fourth support ("fourth").
- **The short support**: the front support ("front"), the shorter of the four beams.

## The layout (observed Nov. 19 at span 41)

By the afternoon of Nov. 19 (Mike, from the ground):

- **Support A** is in its regular place half way through the normal move (after the normal step 10): just behind span 42,
  at the 41/42 tulip, in the front position.
- **Support C** is in its regular place half way through the normal move (after the normal step 4): the rear support's
  place on span 41.
- **The short support** is off its long blue legs, standing across the guideway 15 ft behind A (the gap between the two
  beams), its deck facing west.
- **Support B** was lifted by a mobile crane across the two double girders at the east end of the double girder section
  (the 42/43 joint), with its deck facing west. Its wheel assemblies are slid along its beam over the unfinished span 42,
  under the trusses.
- **The trusses** are where `placeGantry()` puts them on span 41.

`placeNowLayout` works these places out from the normal move's own targets for the span (`m.N`), so the same code gives the
layout at span 50. Nobody has seen the start at span 50 yet.
