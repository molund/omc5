// The spans with two girders.

/**
 * Spans with two girders. The fourth support can't lie lengthwise on one of these, so on them it is turned across the span,
 * like the other supports, and centred across the double girder.
 */
export const DOUBLE_GIRDER = new Set([31, 43, 44, 45, 46, 47, 52, 53, 54]);

/** Before this span, the crews set Support C (the fourth support) down across the span everywhere, as on a double girder:
 * they only found that it could lie lengthwise on a gantry box later. */
const C_LENGTHWISE_FROM = 32;

/**
 * Whether Support C (the fourth support) is set down across span `s` rather than lengthwise: on a double girder, and on
 * every span before C_LENGTHWISE_FROM.
 * @param {number} s The span it stands on.
 * @returns {boolean}
 */
export const cAcross = (s) => DOUBLE_GIRDER.has(s) || s < C_LENGTHWISE_FROM;
