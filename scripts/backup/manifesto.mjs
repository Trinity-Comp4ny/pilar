#!/usr/bin/env node
/**
 * Manifesto do backup: quantas linhas cada tabela tem no dump de dados.
 *
 *   node scripts/backup/manifesto.mjs data.sql > manifesto.json
 *
 * Lê o dump gerado com `supabase db dump --data-only --use-copy`. No formato texto do
 * COPY cada linha é um registro (quebra de linha dentro do valor vira \n), e o bloco
 * termina numa linha só com "\.". O manifesto viaja junto com o backup e o drill mensal
 * compara as contagens depois do restore (scripts/backup-restore-test.sh).
 *
 * Sai com erro se as tabelas que provam "tem cliente aqui" vierem vazias: foi assim que
 * o backup passou meses só com o schema sem ninguém perceber.
 */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

/** Tabelas que precisam ter linha em qualquer backup de um ambiente em uso. */
export const ESSENCIAIS = ["auth.users", "public.empresas", "public.profiles"];

const COPY_RE = /^COPY "?([\w]+)"?\."?([\w]+)"? .*FROM stdin;$/;

/** Conta as linhas de cada bloco COPY. Exportada para teste. */
export async function contarLinhas(linhas) {
  const tabelas = {};
  let atual = null;
  for await (const linha of linhas) {
    if (atual === null) {
      const m = COPY_RE.exec(linha);
      if (m) {
        atual = `${m[1]}.${m[2]}`;
        tabelas[atual] = tabelas[atual] ?? 0;
      }
      continue;
    }
    if (linha === "\\.") {
      atual = null;
      continue;
    }
    tabelas[atual] += 1;
  }
  return tabelas;
}

/** Tabelas essenciais sem nenhuma linha. Exportada para teste. */
export function essenciaisVazias(tabelas) {
  return ESSENCIAIS.filter((t) => !tabelas[t]);
}

const executado = import.meta.url === `file://${process.argv[1]}`;
if (executado) {
  const arquivo = process.argv[2];
  if (!arquivo) {
    console.error("Uso: node scripts/backup/manifesto.mjs <data.sql>");
    process.exit(2);
  }
  const tabelas = await contarLinhas(createInterface({ input: createReadStream(arquivo), crlfDelay: Infinity }));
  const total = Object.values(tabelas).reduce((a, b) => a + b, 0);
  process.stdout.write(`${JSON.stringify({ gerado_em: new Date().toISOString(), total, tabelas }, null, 2)}\n`);

  const vazias = essenciaisVazias(tabelas);
  if (vazias.length > 0) {
    console.error(`::error::Backup sem dados nas tabelas essenciais: ${vazias.join(", ")}`);
    process.exit(1);
  }
}
