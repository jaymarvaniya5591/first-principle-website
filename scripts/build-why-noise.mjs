// Static neutral dither for the Why entrance. CSS applies it at 0.4% opacity
// only between the gradient's endpoints. Fixed seed makes builds reproducible.
import sharp from 'sharp';
import {fileURLToPath} from 'node:url';

const size = 128;
const pixels = Buffer.alloc(size * size);
let seed = 173;
for (let i = 0; i < pixels.length; i++) {
  seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
  pixels[i] = seed & 255;
}
await sharp(pixels, {raw: {width: size, height: size, channels: 1}})
  .png({compressionLevel: 9})
  .toFile(fileURLToPath(new URL('../assets/img/why-dither.png', import.meta.url)));
