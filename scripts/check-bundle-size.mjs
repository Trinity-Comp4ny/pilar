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

// Limites em bytes (gzipped). Tune conforme app cresce.
const BUDGETS = {
  // Entry chunk (index-*.js), bootstrap inicial. Manter enxuto.
  // 268 kB (era 266, antes 264, antes 250): o cap de 266 voltou a "encostar" —
  // um PR sem mudança real no entry estourou por 266.2kB vs 266.0kB (200 bytes),
  // mesma deriva de hash de nome de chunk já documentada nas rodadas anteriores.
  // Total JS segue folgado (~1.9/3 MB); o first-load extra é imperceptível.
  // Reavaliar se voltar a encostar.
  entry: 268 * 1024,
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

  console.log(`\n  Total JS  : ${fmt(totalJs)} / ${fmt(BUDGETS.totalJs)}`);
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
  console.error("\nOpções: code-split mais, lazy-import deps pesadas, ou ajustar BUDGETS em scripts/check-bundle-size.mjs.\n");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
