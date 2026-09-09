/**
 * Minifies css/styles.css -> css/styles.min.css (the file index.html links to).
 * Edit styles.css, then run: node scripts/build-css.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { minify } from "csso";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "css", "styles.css");
const out = path.join(root, "css", "styles.min.css");

const css = await readFile(src, "utf8");
const result = minify(css, { restructure: false, comments: false }).css;
await writeFile(out, result);
console.log(`styles.css ${(css.length / 1024).toFixed(1)}KB -> styles.min.css ${(result.length / 1024).toFixed(1)}KB`);
