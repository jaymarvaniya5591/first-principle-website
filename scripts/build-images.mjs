/**
 * Generates responsive AVIF / WebP / fallback images into assets/img from the
 * high-resolution sources. Sources live in two places:
 *   - assets/img-src/            (Figma exports; git-ignored)
 *   - ../Website Assets/         (feature renders and product photos supplied by the client)
 *
 * Usage: node scripts/build-images.mjs
 * Generated files are committed, so the Vercel deployment needs no build step.
 */
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(root, "assets", "img-src");
const CLIENT = process.env.ASSET_SRC || path.join(root, "..", "Website Assets");
const OUT = path.join(root, "assets", "img");

const exists = async (p) => { try { await stat(p); return true; } catch { return false; } };

/** Product photos: use a client export when present, else the Figma placeholder. */
async function productSource(name, fallback) {
  for (const ext of ["png", "jpg", "jpeg", "webp"]) {
    const p = path.join(CLIENT, "Products", `${name}.${ext}`);
    if (await exists(p)) return p;
  }
  console.warn(`  (placeholder) ${name}: no Website Assets/Products/${name}.png found, using ${path.basename(fallback)}`);
  return fallback;
}

/**
 * name      output base name  ->  assets/img/<name>-<width>.<ext>
 * src       source file
 * widths    output widths (capped at source width)
 * alpha     keep transparency (fallback is PNG instead of JPEG)
 * square    force a 1:1 centre crop
 */
const manifest = [
  { name: "hero-bg", src: path.join(SRC, "hero-bg.jpg"), widths: [960, 1440, 1535] },
  { name: "hero-toilet", src: path.join(SRC, "hero-toilet.png"), widths: [800, 1200, 1536], alpha: true },
  { name: "clouds", src: path.join(SRC, "clouds.png"), widths: [1080, 1440, 2172], alpha: true },

  { name: "feature-health-checkup", src: path.join(CLIENT, "07-health-checkup-v1.png"), widths: [800, 1024], square: true },
  { name: "feature-uv", src: path.join(CLIENT, "active-uv-sterilisation.png"), widths: [800, 1600], square: true },
  { name: "feature-odour", src: path.join(CLIENT, "Fragrance.png"), widths: [800, 1254], square: true },
  { name: "feature-germ", src: path.join(CLIENT, "03-germ-resistant-v4.png"), widths: [800, 1024], square: true },
  { name: "feature-handsfree", src: path.join(CLIENT, "hands-free-wash-single-clean-web.jpg"), widths: [800, 1600], square: true },
  { name: "feature-constipation", src: path.join(CLIENT, "05-constipation-aid-v3.png"), widths: [800, 1024], square: true },
  { name: "feature-flush", src: path.join(CLIENT, "flushes-itself-transparent-side-v3-web.jpg"), widths: [800, 1600], square: true },

  // Placeholder photos are cropped away from the third-party branding baked into the Figma exports
  // (novi-a has text along the top, novi-b along the bottom). Client exports use a centre crop.
  { name: "product-sora", src: path.join(SRC, "product-sora.jpg"), widths: [560, 1100], square: true },
  { name: "product-novi", src: path.join(SRC, "product-novi-b.jpg"), widths: [560, 736], square: true, position: "top" },
  ...(await Promise.all([
    ["liva", "product-novi-a.jpg", "bottom"],
    ["vero", "product-novi-b.jpg", "top"],
    ["aera", "product-novi-a.jpg", "bottom"],
    ["luma", "product-novi-b.jpg", "top"],
  ].map(async ([name, fallback, pos]) => {
    const src = await productSource(name, path.join(SRC, fallback));
    const isPlaceholder = src.endsWith(fallback);
    return { name: `product-${name}`, src, widths: [560, 736], square: true, position: isPlaceholder ? pos : "centre" };
  }))),
];

await mkdir(OUT, { recursive: true });

const report = [];
for (const item of manifest) {
  if (!(await exists(item.src))) { console.warn(`skip ${item.name}: missing ${item.src}`); continue; }
  const meta = await sharp(item.src).metadata();
  const maxW = item.square ? Math.min(meta.width, meta.height) : meta.width;

  for (const w of item.widths) {
    const width = Math.min(w, maxW);
    let img = sharp(item.src);
    if (item.square) img = img.resize({ width, height: width, fit: "cover", position: item.position || "centre", withoutEnlargement: true });
    else img = img.resize({ width, withoutEnlargement: true });

    const base = path.join(OUT, `${item.name}-${w}`);
    const avif = await img.clone().avif({ quality: item.alpha ? 50 : 55, effort: 7 }).toBuffer();
    await writeFile(`${base}.avif`, avif);
    const webp = await img.clone().webp({ quality: item.alpha ? 82 : 78, effort: 6, alphaQuality: 90 }).toBuffer();
    await writeFile(`${base}.webp`, webp);

    let fallback;
    if (item.alpha) {
      fallback = await img.clone().png({ compressionLevel: 9, palette: true, quality: 90, effort: 9 }).toBuffer();
      await writeFile(`${base}.png`, fallback);
    } else {
      fallback = await img.clone().jpeg({ quality: 80, mozjpeg: true, progressive: true }).toBuffer();
      await writeFile(`${base}.jpg`, fallback);
    }
    report.push({ file: `${item.name}-${w}`, width, avifKB: (avif.length / 1024).toFixed(0), webpKB: (webp.length / 1024).toFixed(0), fallbackKB: (fallback.length / 1024).toFixed(0) });
  }
}

/* Favicons / touch icon from the brand mark, and an Open Graph image. */
const mark = path.join(root, "assets", "img", "logo-mobile.svg");
for (const size of [32, 180, 512]) {
  const png = await sharp(mark, { density: 384 }).resize(size, size).png().toBuffer();
  await writeFile(path.join(OUT, `icon-${size}.png`), png);
}

{
  const W = 1200, H = 630;
  const bg = await sharp(path.join(SRC, "hero-bg.jpg")).resize(W, H, { fit: "cover" }).toBuffer();
  const toilet = await sharp(path.join(SRC, "hero-toilet.png")).resize({ width: 820 }).toBuffer();
  const tMeta = await sharp(toilet).metadata();
  const clouds = await sharp(path.join(SRC, "clouds.png")).resize({ width: W }).ensureAlpha().modulate({ brightness: 1 }).toBuffer();
  const og = await sharp(bg)
    .composite([
      { input: toilet, left: W - tMeta.width - 20, top: H - tMeta.height + 40 },
      { input: clouds, left: 0, top: H - Math.round((W * 724) / 2172) + 90 },
    ])
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  await writeFile(path.join(OUT, "og-image.jpg"), og);
  report.push({ file: "og-image", width: W, fallbackKB: (og.length / 1024).toFixed(0) });
}

console.table(report);
