// The gantry's yellow support beams (#gantry-support-*) are drawn inside the gantry's squashed frame (the
// scale(0.55 1) in map.svg), so their brown border was squashed with them: full width on the sides that run across
// the gantry, 55% on the sides that run along it. Turning a beam (the gantry animation does) turned its thin and thick
// sides with it, and when the animation's cycle snapped back (placeGantry puts each beam's own drawing in each place),
// a border would jump in thickness. This draws each beam's border the same width on all four sides instead: a stroke
// of fixed width on screen (vector-effect: non-scaling-stroke), set to the full width (the drawing's stroke-width, in
// the gantry's unsquashed direction) at the zoom now, and set again whenever the zoom, the view or the stage's size
// changes.

/** The gantry's support beams. */
const BEAMS = 'rect[id^="gantry-support-"]';

/**
 * The largest stretch of a matrix's turn-and-scale part: how many screen pixels one unit becomes in its least squashed
 * direction.
 * @param {DOMMatrix|SVGMatrix} m
 * @returns {number}
 */
function stretch(m) {
  const s = m.a * m.a + m.b * m.b + m.c * m.c + m.d * m.d,
    det = m.a * m.d - m.b * m.c;
  return Math.sqrt((s + Math.sqrt(Math.max(0, s * s - 4 * det * det))) / 2);
}

/**
 * Keeps the support beams' borders even: the same width on every side, the width the drawing gives them across the
 * gantry.
 * @param {SVGSVGElement} svg The map's <svg>.
 * @param {HTMLElement} stage The element the map scrolls in.
 * @returns {{ stop: () => void }} stop() lets the beams go back to their drawn borders.
 */
export function evenSupportBorders(svg, stage) {
  const beams = [...svg.querySelectorAll(BEAMS)].map((el) => [el, +(el.getAttribute("stroke-width") || 1)]);
  if (!beams.length) return { stop() {} };
  let frame = null;
  const update = () => {
    frame = null;
    const gantry = svg.querySelector("#clayton-clipper"),
      m = gantry?.getScreenCTM();
    // a hidden gantry has no size to measure: keep the last width
    if (!m || !stretch(m)) return;
    const px = stretch(m);
    beams.forEach(([el, width]) => {
      el.style.vectorEffect = "non-scaling-stroke";
      el.style.strokeWidth = `${width * px}px`;
    });
  };
  // at most once a frame, however many changes come in
  const later = () => (frame ??= requestAnimationFrame(update));
  const resize = new ResizeObserver(later);
  resize.observe(stage);
  // a zoom changes the <svg>'s style, a view its viewBox and the turn; turning the gantry layer on gives it a size
  const changes = new MutationObserver(later);
  changes.observe(svg, { attributes: true, attributeFilter: ["style", "viewBox"] });
  const turn = svg.querySelector("#map-turn");
  if (turn) changes.observe(turn, { attributes: true, attributeFilter: ["transform"] });
  // the layer rules (App.svelte writes them into a <style> in the head) show and hide the gantry
  changes.observe(document.head, { childList: true, characterData: true, subtree: true });
  update();
  return {
    stop() {
      cancelAnimationFrame(frame);
      resize.disconnect();
      changes.disconnect();
      beams.forEach(([el]) => {
        el.style.vectorEffect = "";
        el.style.strokeWidth = "";
      });
    },
  };
}
