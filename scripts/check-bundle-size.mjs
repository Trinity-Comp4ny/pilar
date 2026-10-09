#!/usr/bin/env node
// Bundle size budget check.
//
// Roda após `vite build`. Falha se algum chunk passar do limite (gzipped).
// Tunar limites em BUDGETS abaixo. Variável BUDGET_OVERRIDE=relaxed
// permite passagem temporária com warning (use só em emergência).

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const DIST = join(process.cwd(), "dist", "assets");

// Chunks que só fazem sentido em telas específicas: nunca no carregamento inicial.
const PROIBIDOS_NO_INICIAL = [/^vendor-pdf-/, /^vendor-charts-/, /^vendor-maps-/, /^vendor-docx-/];

// Limites em bytes (gzipped). Tune conforme app cresce.
const BUDGETS = {
  // Entry chunk (index-*.js), bootstrap inicial. Manter enxuto.
  // 270 kB (era 268, antes 266, antes 264, antes 250): o cap de 268 voltou a
  // "encostar" no PR das specs 099/093 (auth self-service + timeline do
  // projeto) — estourou por 274457B vs 274432B (268*1024), 25 bytes, mesma
  // deriva de hash de nome de chunk já documentada nas rodadas anteriores.
  // Total JS segue folgado (~1.9/3 MB); o first-load extra é imperceptível.
  // Reavaliar se voltar a encostar.
  //
  // 2026-10-09: 230 kB. O Replay do Sentry passou a vir da CDN depois do boot e a
  // entrada caiu de ~270 para ~221 kB; a catraca acompanha.
  entry: 230 * 1024,
  // Tudo que o navegador baixa antes da primeira tela: a entrada mais os chunks que o
  // index.html pré-carrega (modulepreload) e o CSS. O limite só da entrada não via o
  // vendor-pdf e o vendor-charts sendo pré-carregados em toda página (~860 kB brutos),
  // porque eram outros arquivos. Medido em 2026-10-09: ~416 kB depois da correção.
  initialLoad: 430 * 1024,
  // Qualquer chunk individual (vendor-*, página lazy)
  perChunk: 600 * 1024,
  // Soma de todos JS gzipped — proxy pra peso total app
  totalJs: 3 * 1024 * 1024,
  // Soma CSS gzipped
  totalCss: 200 * 1024,
};

function fmt(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function main() {
  let entries;
  try {
    entries = await readdir(DIST);
  } catch {
    console.error(`[budget] dist/assets não encontrado. Rode 'npm run build' antes.`);
    process.exit(1);
  }

  const chunks = [];
  for (const name of entries) {
    const full = join(DIST, name);
    const s = await stat(full);
    if (!s.isFile()) continue;
    const ext = name.endsWith(".js") ? "js" : name.endsWith(".css") ? "css" : null;
    if (!ext) continue;
    const raw = await readFile(full);
    const gz = gzipSync(raw).length;
    chunks.push({ name, ext, raw: raw.length, gz });
  }

  chunks.sort((a, b) => b.gz - a.gz);

  console.log("\n📦 Bundle sizes (gzipped)\n");
  for (const c of chunks) {
    console.log(`  ${c.gz.toString().padStart(8)} B  ${c.name}`);
  }

  const violations = [];
  const totalJs = chunks.filter((c) => c.ext === "js").reduce((a, c) => a + c.gz, 0);
  const totalCss = chunks.filter((c) => c.ext === "css").reduce((a, c) => a + c.gz, 0);

  for (const c of chunks) {
    if (c.ext !== "js") continue;
    const isEntry = /^index-[A-Za-z0-9_-]+\.js$/.test(c.name);
    const limit = isEntry ? BUDGETS.entry : BUDGETS.perChunk;
    if (c.gz > limit) {
      violations.push(`${c.name} = ${fmt(c.gz)} > limite ${fmt(limit)} (${isEntry ? "entry" : "chunk"})`);
    }
  }

  if (totalJs > BUDGETS.totalJs) {
    violations.push(`Total JS = ${fmt(totalJs)} > limite ${fmt(BUDGETS.totalJs)}`);
  }
  if (totalCss > BUDGETS.totalCss) {
    violations.push(`Total CSS = ${fmt(totalCss)} > limite ${fmt(BUDGETS.totalCss)}`);
  }

  // Carregamento inicial: o que o index.html manda baixar antes da primeira tela.
  const html = await readFile(join(DIST, "..", "index.html"), "utf8");
  const iniciais = [...html.matchAll(/(?:src|href)="\/assets\/([^"]+\.(?:js|css))"/g)].map((m) => m[1]);
  const porNome = new Map(chunks.map((c) => [c.name, c]));
  const initialLoad = iniciais.reduce((a, n) => a + (porNome.get(n)?.gz ?? 0), 0);
  if (initialLoad > BUDGETS.initialLoad) {
    violations.push(`Carregamento inicial = ${fmt(initialLoad)} > limite ${fmt(BUDGETS.initialLoad)}`);
  }
  for (const n of iniciais) {
    if (PROIBIDOS_NO_INICIAL.some((re) => re.test(n))) {
      violations.push(`${n} entrou no carregamento inicial (só deveria carregar na tela que usa)`);
    }
  }

  console.log(`\n  Inicial   : ${fmt(initialLoad)} / ${fmt(BUDGETS.initialLoad)} (${iniciais.length} arquivos)`);
  console.log(`  Total JS  : ${fmt(totalJs)} / ${fmt(BUDGETS.totalJs)}`);
  console.log(`  Total CSS : ${fmt(totalCss)} / ${fmt(BUDGETS.totalCss)}\n`);

  if (violations.length === 0) {
    console.log("✅ Bundle dentro do budget.\n");
    return;
  }

  if (process.env.BUDGET_OVERRIDE === "relaxed") {
    console.warn("⚠️  Violações detectadas mas BUDGET_OVERRIDE=relaxed:");
    for (const v of violations) console.warn(`   - ${v}`);
    console.warn("");
    return;
  }

  console.error("❌ Bundle excede budget:");
  for (const v of violations) console.error(`   - ${v}`);
  console.error(
    "\nOpções: code-split mais, lazy-import deps pesadas, ou ajustar BUDGETS em scripts/check-bundle-size.mjs.\n"
  );
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
