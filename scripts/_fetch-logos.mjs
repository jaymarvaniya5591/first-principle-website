// One-off helper: pull the four hotel-group wordmarks from Wikimedia Commons.
import fs from "node:fs";
import path from "node:path";

const UA = "first-principle-website/1.0 (logo fetch; contact: site owner)";
const OUT = "assets/img/logos";
fs.mkdirSync(OUT, { recursive: true });

const api = "https://commons.wikimedia.org/w/api.php";

async function search(term) {
  const u = `${api}?action=query&list=search&srsearch=${encodeURIComponent(
    term
  )}&srnamespace=6&srlimit=12&format=json&origin=*`;
  const r = await fetch(u, { headers: { "User-Agent": UA } });
  const j = await r.json();
  return (j.query?.search || []).map((s) => s.title);
}

async function download(title, outName) {
  const u = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(
    title.replace(/^File:/, "")
  )}`;
  const r = await fetch(u, { headers: { "User-Agent": UA }, redirect: "follow" });
  if (!r.ok) return { ok: false, status: r.status };
  const buf = Buffer.from(await r.arrayBuffer());
  const p = path.join(OUT, outName);
  fs.writeFileSync(p, buf);
  return { ok: true, bytes: buf.length, path: p };
}

const wanted = [
  ["Taj Hotels logo.svg", "taj.svg", "Taj Hotels logo"],
  ["ITC Hotels logo.svg", "itc.svg", "ITC Hotels logo"],
  ["The Leela Palaces, Hotels and Resorts logo.svg", "leela.svg", "Leela Palaces logo"],
  [null, "oberoi.svg", "Oberoi Hotels Resorts logo"],
];

for (const [known, out, query] of wanted) {
  let title = known;
  if (!title) {
    const hits = await search(query);
    console.log(query, "->", hits.slice(0, 8).join(" | "));
    title = hits.find((t) => /oberoi/i.test(t) && /\.svg$/i.test(t)) || hits.find((t) => /\.svg$/i.test(t));
  }
  if (!title) {
    console.log("NO CANDIDATE for", out);
    continue;
  }
  const res = await download(title, out);
  console.log(out, title, JSON.stringify(res));
}
