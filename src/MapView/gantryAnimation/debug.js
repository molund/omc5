// The gantry animation's debugging aids, kept for working on the moves but switched off on the site: the arrows at the
// supports holding the trusses, the anchor arrow over the trolley and the moment panel (the tipping check, holders.js),
// the letters A, B and C on the supports and the dot on the trusses' middle (addSupportLetters() in normalMove.js), and
// the [gantry] lines in the console (each step as it plays, and the walk's layout before each of its steps).

/** Whether the debugging aids show. Set it to true to see them while working on the moves. */
export const GANTRY_DEBUG = false;

/** console.log, only with GANTRY_DEBUG on. */
export const debugLog = (...args) => {
  if (GANTRY_DEBUG) console.log(...args);
};
