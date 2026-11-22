// The width and height of every update photo, read from the files when the site is built (a Vite plugin in
// vite.config.js serves them as the module "virtual:photo-sizes"), so a photo's <img> can say its shape before it loads.
import { readdirSync, readFileSync } from "node:fs";

/**
 * A JPEG's or PNG's size in pixels, from its header.
 * @param {Buffer} b The file.
 * @returns {[number, number] | null} [width, height], or null for anything else.
 */
export function imageSize(b) {
  // PNG: the IHDR chunk, right after the signature
  if (b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  // JPEG: walk the markers to the first start-of-frame (SOF0-SOF15, except DHT, JPG and DAC)
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  for (let i = 2; i + 9 < b.length;) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) {
      i++;
      continue;
    }
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
      return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

/**
 * Every photo in a folder by file name, with its [width, height].
 * @param {string | URL} dir
 * @returns {Record<string, [number, number]>}
 */
export function photoSizes(dir) {
  const out = {};
  for (const name of readdirSync(dir)) {
    if (!/\.(jpe?g|png)$/i.test(name)) continue;
    const size = imageSize(readFileSync(new URL(name, dir)));
    if (size) out[name] = size;
  }
  return out;
}
