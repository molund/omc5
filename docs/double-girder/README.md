# Double girder spans

Spans 31, 43 to 47 and 52 to 54 have two precast girders instead of a gantry-built box, so the gantry can't set its
front support down on them the normal way. It walks over them instead, for spans 43 to 47 (from span 41) and 52 to 54
(from span 51). The walk over span 31 (from span 29) isn't worked out, and the normal move plays there.

- [`the-walk.md`](the-walk.md): the walk, step by step, and starting part way through it.
- [`code-layout.md`](code-layout.md): how the animation code is laid out.

## What happens

1. **The span in front of the double girders (42, or 51) is built.** At span 42 the supports are in a one-off layout,
   with Support B lifted across by a mobile crane. At span 51 there's no crane: the normal move from span 50 has the
   front lifting jacks set the short support, its legs off, on the span 52 girders, as at span 30 (below).
2. **The gantry walks over the double girders** on its four supports: the trolley carries the back support over the
   others to the front, again and again, with no lifting jacks.
3. **At the end** the short support stands on the hammerhead at the end of the last double girder span (47/48, or 54/55),
   with A just behind it, and the normal move takes over half way through, carrying the short support on to the next
   tulip (48/49, or 55/56).

The front support can't follow the usual cycle at span 42 because the westbound girder at span 43 sits where it would
land. At span 51 the westbound girder at span 52 is in the way too, but the short support goes onto the girders without
its legs instead (Mike).

## Where a walk starts

### From span 41 (observed on Nov. 19)

- **Support A** in its place half way through the normal move (after step 10): at the 41/42 tulip, in front.
- **Support C** in its place half way through the normal move (after step 4).
- **The short support** off its long blue legs, standing across the guideway 15 ft behind A, its deck facing west.
- **Support B** craned across the double girders at their near end (42/43), its deck facing west, its wheel assemblies
  slid along its beam over span 42.
- **The trusses** where `placeGantry()` puts them on span 41.

### From span 51 (as Mike expects it; not seen yet)

The normal move's layout on span 51, as `placeGantry()` draws it, once span 51 is built:

- **The short support** off its legs, across the span 52 girders at the 51/52 joint, where the front lifting jacks set it.
- **Support A** at the 50/51 tulip.
- **Support C** lengthwise on span 50.
- **Support B** at the 49/50 joint.

## The rules

- The tipping margin stays at 3.93 : 1 or more.
- The trusses only move while the trolley sits still over a long support (A, B or C) standing across.
- The short support may hold the trusses, but never during a swing.
- No support is set down lengthwise on the double girders, and a support is carried lengthwise when it passes over others.
- The long supports stand far enough apart to turn across (about 15.5 m).
- A long support's wheel assemblies slide along its beam, so the trusses can move across on it; the short support's
  hardly move.
- The trolley can't come closer to the blue tips at either end than half a tip's length.

## Open

- The walk over span 31, from span 29.
