/**
 * Minifies css/styles.css -> css/styles.min.css.
 * Edit styles.css, then run: node scripts/build-css.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transform } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "css", "styles.css");
const out = path.join(root, "css", "styles.min.css");

const css = await readFile(src, "utf8");
// The old minifier silently discarded range media queries. Keep modern CSS
// syntax intact so the source and production stylesheets have the same layout.
const { code: result } = await transform(css, { loader: "css", minify: true });
await writeFile(out, result);
console.log(`styles.css ${(css.length / 1024).toFixed(1)}KB -> styles.min.css ${(result.length / 1024).toFixed(1)}KB`);
