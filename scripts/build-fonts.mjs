/**
 * Subsets the source fonts in assets/fonts-src to the characters the site uses
 * and writes WOFF2 files to assets/fonts. Also prints the vertical metrics and
 * average advance width of each face so the CSS fallback @font-face rules
 * (size-adjust / ascent-override / descent-override) can be kept in sync.
 *
 * Usage: node scripts/build-fonts.mjs
 * Source fonts are not committed (licensed); drop them in assets/fonts-src.
 */
import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import subsetFont from "subset-font";
import * as fontkit from "fontkit";
import * as opentypeNs from "opentype.js";

const opentype = opentypeNs.default && opentypeNs.default.parse ? opentypeNs.default : opentypeNs;

/**
 * Some legacy Apple TrueType files only carry Mac-encoded cmap subtables, which
 * the subsetter drops (browsers then reject the font). Rebuild such fonts through
 * opentype.js, which writes a fresh Unicode (format 4) cmap.
 */
function rebuildWithUnicodeCmap(buf, family, styleName) {
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  // Name records are irrelevant for @font-face use; keep whatever opentype.js parsed.
  void family; void styleName;
  return Buffer.from(font.toArrayBuffer());
}

function hasCmap(buf) {
  try { return Boolean(fontkit.create(buf).directory.tables.cmap); } catch { return false; }
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(root, "assets", "fonts-src");
const OUT = path.join(root, "assets", "fonts");

/** source file -> [output name (without extension), family, style] */
const FACES = {
  "Anton-Regular.ttf": ["anton-400", "Anton", "Regular"],
  "BillionDreams.ttf": ["billion-dreams-400", "Billion Dreams", "Regular"],
  "HelveticaNowDisplayLight.otf": ["helvetica-now-300", "Helvetica Now Display", "Light"],
  "HelveticaNowDisplay.otf": ["helvetica-now-400", "Helvetica Now Display", "Regular"],
  "HelveticaNowDisplayMedium.otf": ["helvetica-now-500", "Helvetica Now Display", "Medium"],
  "HelveticaNowDisplayBold.otf": ["helvetica-now-700", "Helvetica Now Display", "Bold"],
  "HelveticaNowDisplayBdIt.otf": ["helvetica-now-700i", "Helvetica Now Display", "Bold Italic"],
  "HelveticaNeue-Regular.ttf": ["helvetica-neue-400", "Helvetica Neue", "Regular"],
  "HelveticaNeue-Medium.ttf": ["helvetica-neue-500", "Helvetica Neue", "Medium"],
  "HelveticaNowText-Regular.ttf": ["helvetica-now-text-400", "Helvetica Now Text", "Regular"],
  "HelveticaNowText-Medium.ttf": ["helvetica-now-text-500", "Helvetica Now Text", "Medium"],
  "HelveticaNowText-Bold.ttf": ["helvetica-now-text-700", "Helvetica Now Text", "Bold"],
};

/** Character set: Basic Latin, Latin-1 Supplement, general punctuation, rupee sign. */
function charset() {
  let s = "";
  const range = (a, b) => { for (let c = a; c <= b; c++) s += String.fromCodePoint(c); };
  range(0x0020, 0x007e);
  range(0x00a0, 0x00ff);
  s += "\u2013\u2014\u2018\u2019\u201c\u201d\u2022\u2026\u2032\u2033\u00b7\u20b9\u2122\u00ae\u2192\u2190";
  return s;
}

const text = charset();
await mkdir(OUT, { recursive: true });

let totalIn = 0;
let totalOut = 0;
const metrics = [];

for (const [file, [name, family, styleName]] of Object.entries(FACES)) {
  const srcPath = path.join(SRC, file);
  try { await stat(srcPath); } catch { console.warn(`skip: ${file} not found in assets/fonts-src`); continue; }

  let buf = await readFile(srcPath);
  let woff2 = await subsetFont(buf, text, { targetFormat: "woff2" });
  if (!hasCmap(woff2)) {
    console.log(`  ${file}: subset lost its cmap (legacy Mac cmap only) -> rebuilding with a Unicode cmap`);
    buf = rebuildWithUnicodeCmap(buf, family, styleName);
    woff2 = await subsetFont(buf, text, { targetFormat: "woff2" });
    if (!hasCmap(woff2)) throw new Error(`${file}: still no cmap after rebuild`);
  }
  const outPath = path.join(OUT, `${name}.woff2`);
  await writeFile(outPath, woff2);
  totalIn += buf.length;
  totalOut += woff2.length;

  const font = fontkit.create(buf);
  const upm = font.unitsPerEm;
  // average advance of lowercase letters + space, in em (used for size-adjust of fallbacks)
  const sample = "abcdefghijklmnopqrstuvwxyz ";
  let adv = 0;
  for (const ch of sample) adv += font.layout(ch).advanceWidth;
  const avg = adv / sample.length / upm;
  metrics.push({
    name,
    ascent: (font.ascent / upm).toFixed(4),
    descent: (Math.abs(font.descent) / upm).toFixed(4),
    lineGap: (font.lineGap / upm).toFixed(4),
    capHeight: (font.capHeight / upm).toFixed(4),
    xHeight: (font.xHeight / upm).toFixed(4),
    avgAdvance: avg.toFixed(4),
  });
  console.log(`${name}.woff2  ${(buf.length / 1024).toFixed(0)}KB -> ${(woff2.length / 1024).toFixed(1)}KB`);
}

console.log(`\nTotal ${(totalIn / 1024).toFixed(0)}KB -> ${(totalOut / 1024).toFixed(0)}KB`);
console.log("\nMetrics (em):");
console.table(metrics);

// leftover legacy files in assets/fonts
const leftovers = (await readdir(OUT)).filter((f) => !f.endsWith(".woff2"));
if (leftovers.length) console.log("\nNon-woff2 files still in assets/fonts:", leftovers.join(", "));
