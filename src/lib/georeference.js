/** The Web Mercator sphere's radius, in metres. */
export const R = 6378137;

/**
 * Ties map.svg's canvas units to Web Mercator with a similarity transform (scale, turn, shift), fitted to the measured pins.
 * Canvas y points south, so points are taken as complex numbers x - iy.
 * @param {{ pins: { lon: number, lat: number, canvas: [number, number] }[] }} control data/control-points.json.
 * @returns {{ toMerc: (c: [number, number]) => [number, number], fromMerc: (w: [number, number]) => [number, number] }}
 * Canvas to Web Mercator metres, and back.
 */
export function georeference(control) {
  const z = ([x, y]) => [x, -y],
    merc = ({ lon, lat }) => [(R * lon * Math.PI) / 180, R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))];
  // least squares for w = s z + t (s, t complex) over the pins (exact for two)
  const pins = control.pins,
    m = pins.map((p) => [z(p.canvas), merc(p)]),
    n = m.length,
    mean = (k, i) => m.reduce((a, p) => a + p[k][i], 0) / n,
    [zx, zy, wx, wy] = [mean(0, 0), mean(0, 1), mean(1, 0), mean(1, 1)];
  let re = 0,
    im = 0,
    zz = 0;
  for (const [[x, y], [u, v]] of m) {
    const [dx, dy, du, dv] = [x - zx, y - zy, u - wx, v - wy];
    re += du * dx + dv * dy;
    im += dv * dx - du * dy;
    zz += dx * dx + dy * dy;
  }
  const [sr, si] = [re / zz, im / zz],
    scaled = ([x, y]) => [sr * x - si * y, si * x + sr * y],
    [cx, cy] = scaled([zx, zy]),
    t = [wx - cx, wy - cy],
    size = sr * sr + si * si;
  return {
    toMerc: (c) => {
      const [u, v] = scaled(z(c));
      return [u + t[0], v + t[1]];
    },
    fromMerc: ([u, v]) => {
      const [du, dv] = [u - t[0], v - t[1]];
      return [(sr * du + si * dv) / size, -(sr * dv - si * du) / size];
    },
  };
}
