#!/usr/bin/env node
/**
 * Normaliza `types.ts` gerado pelo Supabase para comparação entre bancos.
 *
 * O gate de sincronia compara os tipos gerados do stack LOCAL (a fila de migrations
 * aplicada num banco vazio) com o arquivo commitado, que foi gerado do banco REMOTO.
 * Dois trechos diferem sem que exista qualquer diferença de schema:
 *
 * 1. `__InternalSupabase.PostgrestVersion`. É a versão do PostgREST que atende aquele
 *    banco. O stack local do CLI e o projeto hospedado não andam na mesma versão, então
 *    esse bloco diverge para sempre. Não descreve schema nenhum.
 * 2. Ordem e presença de comentários gerados junto do bloco acima.
 *
 * Sem esta normalização o gate reprovava todo PR, o que o transformaria em ruído e
 * levaria alguém a desligá-lo (foi o que aconteceu com os gates anteriores deste repo).
 *
 * Uso: node scripts/normalize-db-types.mjs <arquivo>
 */

import { readFileSync } from "node:fs";

/**
 * Remove o bloco __InternalSupabase e o comentário que o antecede.
 * Conservador: só corta esse bloco, para não mascarar diferença real de schema.
 */
export function normalize(source) {
  const lines = source.split("\n");
  const out = [];
  let depth = 0;
  let inBlock = false;

  for (const line of lines) {
    if (!inBlock && /^\s*__InternalSupabase\s*:\s*\{/.test(line)) {
      inBlock = true;
      depth = 0;
      // Descarta os comentários imediatamente acima, que só existem por causa do bloco.
      while (out.length > 0 && /^\s*\/\//.test(out[out.length - 1])) out.pop();
    }
    if (inBlock) {
      for (const ch of line) {
        if (ch === "{") depth++;
        else if (ch === "}") depth--;
      }
      if (depth <= 0) inBlock = false;
      continue;
    }
    out.push(line);
  }

  // Colapsa linhas vazias consecutivas que a remoção possa ter deixado.
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

if (process.argv[1] && process.argv[1].endsWith("normalize-db-types.mjs")) {
  const file = process.argv[2];
  if (!file) {
    console.error("uso: node scripts/normalize-db-types.mjs <arquivo>");
    process.exit(1);
  }
  process.stdout.write(normalize(readFileSync(file, "utf8")));
}
