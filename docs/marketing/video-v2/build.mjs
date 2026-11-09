// Gera out/<nome>.html: CSS da marca, GSAP, os ícones lucide usados, o logotipo oficial
// e (se houver) os tempos da narração.
//   node build.mjs <id> [--theme light|dark] [--w 1080] [--h 1920]
// O arquivo sai como out/<id>.html, ou out/<id>-<tema>.html quando o tema é passado.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "../../..");
const vendor = join(here, "vendor/node_modules");
const args = process.argv.slice(2);
const id = args[0];
const opt = (k, d) => {
  const i = args.indexOf("--" + k);
  return i >= 0 ? args[i + 1] : d;
};
const theme = opt("theme");
const w = opt("w", "1080");
const h = opt("h", "1920");
const name = theme ? `${id}-${theme}` : id;

const src = readFileSync(join(here, "src", id + ".js"), "utf8") + readFileSync(join(here, "src", "engine.js"), "utf8");
const names = new Set([...src.matchAll(/icon\("([a-z0-9-]+)"/g)].map((m) => m[1]));
for (const m of src.matchAll(/\["([a-z0-9-]+)",\s*"/g)) names.add(m[1]);
names.add("lock");
const icons = {};
for (const n of names) {
  try {
    icons[n] = readFileSync(join(vendor, "lucide-static/icons", n + ".svg"), "utf8").replace(/<!--.*?-->/gs, "").replace(/class="[^"]*"/, "").trim();
  } catch {
    // nome que não é ícone (ex.: chave de dado); ignorado
  }
}
const logo = (v) => readFileSync(join(repo, `brand/assets/logo/pilar-logo-horizontal-${v}.svg`), "utf8").replace(/<title>.*?<\/title>/, "");
const timingFile = join(here, "narration", id, "timing.json");
const timing = existsSync(timingFile) ? readFileSync(timingFile, "utf8") : "null";

mkdirSync(join(here, "out"), { recursive: true });
writeFileSync(
  join(here, "out", name + ".html"),
  `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${name}</title>
<link rel="stylesheet" href="../src/base.css"></head><body>
<div id="stage" data-w="${w}" data-h="${h}" data-theme="${theme || "dark"}"></div>
<script src="../vendor/node_modules/gsap/dist/gsap.min.js"></script>
<script>window.ICONS=${JSON.stringify(icons)};window.LOCKUP=${JSON.stringify(logo("white"))};window.LOCKUP_INK=${JSON.stringify(logo("ink"))};window.TIMING=${timing};</script>
<script type="module" src="../src/${id}.js"></script></body></html>`,
);
console.log(`out/${name}.html (${Object.keys(icons).length} ícones${timing !== "null" ? ", com narração" : ""})`);
