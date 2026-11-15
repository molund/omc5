// The spans with two girders, and what that does to the span number the progress card shows.

/**
 * Spans with two girders. The fourth support can't lie lengthwise on one of these, so on them it is turned across the span,
 * like the other supports, and centred across the double girder.
 */
export const DOUBLE_GIRDER = new Set([31, 43, 44, 45, 46, 47, 52, 53, 54]);

/**
 * The span number the progress card shows. status.yaml's span goes up when the gantry arrives at a span; on a double girder
 * span only the arrival is logged, so the card stays one behind until the gantry arrives at the next. Every other span (extra
 * long ones included) is shown as it is.
 */
export const cardSpan = (span) => (DOUBLE_GIRDER.has(span) ? span - 1 : span);
