// Gera out/<id>.html: CSS da marca, GSAP, os ícones lucide usados e o logotipo oficial.
// node build.mjs <id> [largura] [altura]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "../../..");
const vendor = join(here, "vendor/node_modules");
const [id = "comece-aqui", w = "1080", h = "1920"] = process.argv.slice(2);

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
const lockup = readFileSync(join(repo, "brand/assets/logo/pilar-logo-horizontal-white.svg"), "utf8").replace(/<title>.*?<\/title>/, "");

mkdirSync(join(here, "out"), { recursive: true });
writeFileSync(
  join(here, "out", id + ".html"),
  `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${id}</title>
<link rel="stylesheet" href="../src/base.css"></head><body>
<div id="stage" data-w="${w}" data-h="${h}"></div>
<script src="../vendor/node_modules/gsap/dist/gsap.min.js"></script>
<script>window.ICONS=${JSON.stringify(icons)};window.LOCKUP=${JSON.stringify(lockup)};</script>
<script type="module" src="../src/${id}.js"></script></body></html>`,
);
console.log(`out/${id}.html (${Object.keys(icons).length} ícones)`);
