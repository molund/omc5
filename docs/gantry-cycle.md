# The Clayton Clipper's cycle

One cycle is everything the Clayton Clipper does for one span: from arriving at a new position to arriving at the next
one. It's the unit for the gantry's velocity (spans per week). This is Mike's description from watching the gantry,
refined into stages; the words are his where the writing style in `CLAUDE.md` says to use the word as written.

## The stages

Each stage starts when the one before it ends. The **marker** is what can be seen from the ground, and what a note in
`status.yaml` usually says, to tell that the stage has started or ended.

| #   | Stage                   | What happens                                                                                                                                                  | Ends when (marker)                                           | How long  |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------- |
| 0   | **Arrival**             | The gantry rests on its own forward support at the next guideway support. The cycle starts here.                                                              | "The Clayton Clipper has moved to span N."                   | (instant) |
| 1   | **Hanging**             | The segments arrive on trucks and the trolley crane hangs them, usually 11 or 12 for a span.                                                                  | All the segments are hung (`hung:` in `status.yaml`).        | hours     |
| 2   | **Gluing**              | Plastic is laid over the road. Epoxy joins all the segments together. The plastic stays down until the crews finish scraping the excess glue off the outside. | The plastic is lifted off the road.                          | not known |
| 3   | **Post-tensioning**     | The span is post-tensioned.                                                                                                                                   | Post-tensioning is done.                                     | hours     |
| 4   | **Hangers down**        | The cables attached to the hangers come down first. Then the trolley crane lifts the hangers down, stacked on top of each other, two at a time.               | All the hangers are down.                                    | not known |
| 5   | **Moving the supports** | The gantry's supports are moved forward (the order is below).                                                                                                 | The last support is placed lengthwise between the other two. | not known |
| 6   | **Launch**              | The gantry moves to the next guideway support and rests on its own forward support.                                                                           | Arrival at the next span: stage 0 of the next cycle.         | not known |

"Hours" is Mike's "several hours". Nothing has been timed yet; see Open questions.

### Stage 5: moving the supports, in order

1. The support sitting **sideways on the span** moves first: it's placed right behind the forward gantry support.
2. The gantry's **front lifting jacks** are attached to the gantry support, and it's moved to the next guideway support.
3. During that move, the **second-farthest-back support** is attached to the gantry by its **rear lifting jacks**, as
   counter-ballast, so it moves at the same time.
4. The gantry comes back, picks up the **farthest-back support** and places it **lengthwise** between the other two.

Then stage 6: the gantry launches.

## For the velocity

The Status Desk tags each entry in `desk.yaml`, by time stamp, with the one step the gantry had reached by then (`stage:`):
`arrived at span`, `hanging started`, `hung`, `gluing started`, `glued`, `post-tensioning started`, `cables down`,
`hangers down`, `supports started`. A tag means the step had happened by that time, so the earliest tag
for a span is the best time known for it. Every entry about the gantry has one, and a span marked as hung is at `hung` at
least. Post-tensioning and moving the supports have only a start: no end is tagged, and the next arrival ends the supports. Its velocity is the average of the last two spans' cycles.

- **A cycle is arrival to arrival** (stage 0 to the next stage 0). The time between two "moved to span N" notes is one
  cycle, whatever happened in between.
- **Working time, not calendar time.** The crews work 24/6. The Sunday shutdown runs from 6 p.m. Saturday to 6 p.m.
  Sunday (24 hours) and is taken out of any cycle it falls in.
- **Seen Nov. 7, 2026, not yet in the velocity:** the Friday night shift is pretty much nonexistent. There was a little
  activity early Friday evening, the hangers being lowered, which doesn't need a big crew; it may have just been the day
  shift working overtime. The day shift works six days a week and the night shift only five (Sunday to Thursday nights),
  so the working week is uneven, which is why the velocity is given only per week (spans per week), not as days per
  span.
- **No step means "complete".** Hung is the end of stage 1, well before the gantry leaves the span; the hangers coming
  down (stage 4) is the nearest thing to done. The progress card counts the span the gantry is on (stage 0), so the card
  moves at arrival.
- **Other markers give partial times.** Notes about gluing, post-tensioning, the hangers or the supports moving split a
  cycle into stages, so a slow cycle can be traced to the stage that was slow (a night shift off during hanging, girders
  being installed before the gantry can move, and so on).

## Open questions

- **Which support is which.** The gantry has three supports, and the steps name them by where they are at the time
  ("sitting sideways on the span", "second-farthest-back", "farthest-back"). A name for each (for example forward,
  middle and rear) would make the order easier to follow from cycle to cycle.
- **Step 2's support.** Is "the gantry support" in step 2 the forward gantry support, or the one just placed behind it
  in step 1?
- **Durations.** Stages 2, 4, 5 and 6 have no time yet, and stages 1 and 3 only "several hours". Time-stamped notes at
  each marker would fill this in.
- **Girders.** Precast concrete girders sometimes have to go in before the gantry can move on (span 34's, Nov. 2–3).
  Does that wait belong to a stage, or is it a pause in the cycle?
