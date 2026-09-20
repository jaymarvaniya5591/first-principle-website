/**
 * Hero trust-rail marks.
 *
 * Sources are the official wordmarks from Wikimedia Commons, kept in
 * assets/img/logos/src/. They arrive in brand colour (Taj/ITC gold, Leela and
 * Oberoi black) and the Oberoi file additionally ships on an opaque white
 * box. None of that survives on a blue hero, and a full-colour rail would
 * compete with the CTA besides - the 2026 trust-bar research is consistent
 * that a rail should sit quieter than the primary action.
 *
 * So each mark is reduced to a white silhouette on transparency:
 *   - files that already carry alpha use it directly;
 *   - the Oberoi PNG is keyed out by luminance instead (white paper -> 0,
 *     black ink -> 255), which is the only way to drop its baked-in box.
 * Output is 4x the display height so the rail stays crisp on retina.
 *
 * Run: npm run logos
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const SRC = "assets/img/logos/src";
const OUT = "assets/img/logos";
const RENDER_H = 176; // 4x the ~44px tallest display height

const marks = [
  { src: "taj.svg", out: "taj", keyOut: false },
  { src: "leela.svg", out: "leela", keyOut: false },
  { src: "itc.svg", out: "itc", keyOut: false },
  { src: "oberoi.png", out: "oberoi", keyOut: true },
];

fs.mkdirSync(OUT, { recursive: true });

for (const m of marks) {
  const src = path.join(SRC, m.src);
  const base = await sharp(src, { density: 1200 })
    .resize({ height: RENDER_H * 2, fit: "inside" })
    .png()
    .toBuffer();

  // Single-channel mask: 255 where the mark's ink is, 0 where it is not.
  const mask = m.keyOut
    ? await sharp(base).flatten({ background: "#ffffff" }).greyscale().negate().toColourspace("b-w").raw().toBuffer({ resolveWithObject: true })
    : await sharp(base).ensureAlpha().extractChannel(3).toColourspace("b-w").raw().toBuffer({ resolveWithObject: true });

  const { width, height } = mask.info;

  const white = await sharp({
    create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .joinChannel(mask.data, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();

  // Trim the transparent margin so every mark's own ink - not its artboard -
  // is what the CSS height applies to, then normalise to the render height.
  const out = await sharp(white)
    .trim({ threshold: 2 })
    .resize({ height: RENDER_H, fit: "inside" })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();

  const info = await sharp(out).metadata();
  const p = path.join(OUT, m.out + "-white.png");
  fs.writeFileSync(p, out);
  console.log(
    `${m.out.padEnd(7)} ${String(info.width).padStart(4)}x${info.height}  ratio ${(info.width / info.height).toFixed(2)}  ${(out.length / 1024).toFixed(1)}KB`
  );
}
