#!/usr/bin/env node
/**
 * Catraca de código morto (Knip).
 *
 * O Knip acha arquivo que ninguém importa, export sem uso e dependência que sobrou.
 * Medido em 07/10: 39 arquivos mortos, 21 dependências sobrando, 272 exports sem uso.
 * Limpar tudo de uma vez é um PR enorme e arriscado; ligar o Knip como gate cru
 * reprovaria todo PR. Então a contagem de cada categoria fica congelada em
 * knip-baseline.json e só pode cair: PR que ADICIONA código morto reprova, PR que
 * limpa passa e avisa para baixar o número.
 *
 * Uso:
 *   node scripts/check-dead-code.mjs           # compara com o baseline
 *   node scripts/check-dead-code.mjs --update  # grava a contagem atual (só depois de limpar)
 *   npx knip                                   # lista o que é, arquivo por arquivo
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const BASELINE_PATH = "knip-baseline.json";
const CATEGORIAS = ["files", "dependencies", "devDependencies", "unlisted", "exports", "types"];

function contarAtual() {
  let raw;
  try {
    raw = execFileSync("npx", ["knip", "--reporter", "json", "--no-progress"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    // Knip sai com 1 quando acha qualquer coisa; o JSON vem no stdout mesmo assim.
    raw = err.stdout;
    if (!raw) throw err;
  }
  const { issues } = JSON.parse(raw);
  const contagem = Object.fromEntries(CATEGORIAS.map((c) => [c, 0]));
  for (const issue of issues) {
    for (const c of CATEGORIAS) {
      if (Array.isArray(issue[c])) contagem[c] += issue[c].length;
    }
  }
  return contagem;
}

const atual = contarAtual();

if (process.argv.includes("--update")) {
  writeFileSync(BASELINE_PATH, `${JSON.stringify(atual, null, 2)}\n`);
  console.log(`Baseline gravado em ${BASELINE_PATH}:`, atual);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
let falhou = false;

for (const c of CATEGORIAS) {
  const antes = baseline[c] ?? 0;
  const agora = atual[c];
  if (agora > antes) {
    falhou = true;
    console.error(`::error::Knip: ${c} subiu de ${antes} para ${agora}. Rode \`npx knip\` para ver o que é novo e remova (ou use, ou exporte só o que é usado).`);
  } else if (agora < antes) {
    console.log(`::notice::Knip: ${c} caiu de ${antes} para ${agora}. Rode \`npm run check:dead-code -- --update\` e commite o baseline para travar o ganho.`);
  } else {
    console.log(`Knip: ${c} = ${agora} (igual ao baseline)`);
  }
}

process.exit(falhou ? 1 : 0);
