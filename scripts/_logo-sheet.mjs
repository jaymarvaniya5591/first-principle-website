// Preview the built white marks over the hero blue at real display heights.
import sharp from "sharp";
import fs from "node:fs";

// Per-mark display heights, optically balanced rather than uniform: a
// single-line script wordmark reads much larger than a stacked lockup at the
// same pixel height.
const marks = [
  ["taj-white.png", 30],
  ["leela-white.png", 28],
  ["itc-white.png", 30],
  ["oberoi-white.png", 17],
];

const tiles = [];
for (const [f, h] of marks) {
  const buf = await sharp("assets/img/logos/" + f).resize({ height: h * 3, fit: "inside" }).png().toBuffer();
  const m = await sharp(buf).metadata();
  tiles.push({ buf, w: m.width, h: m.height, f, display: h });
  console.log(f, "display h", h, "-> w", Math.round(m.width / 3));
}

const pad = 96;
const totalW = tiles.reduce((a, t) => a + t.w, 0) + pad * (tiles.length + 1);
const maxH = Math.max(...tiles.map((t) => t.h));
let x = pad;
const comps = tiles.map((t) => {
  const c = { input: t.buf, left: Math.round(x), top: Math.round((maxH + pad * 2 - t.h) / 2) };
  x += t.w + pad;
  return c;
});

fs.mkdirSync(".shots", { recursive: true });
await sharp({
  create: { width: Math.round(totalW), height: maxH + pad * 2, channels: 4, background: { r: 61, g: 142, b: 224, alpha: 1 } },
})
  .composite(comps)
  .png()
  .toFile(".shots/logo-sheet.png");
console.log("wrote .shots/logo-sheet.png");
