#!/usr/bin/env node
/**
 * Guard de migration destrutiva.
 *
 * Motivo: não existe rollback barato aqui. Nenhuma das 183 migrations tem `down`,
 * e uma migration que apaga dado só volta por PITR, com perda de tudo desde o
 * snapshot. Então o momento de perguntar "isso é intencional?" é no PR, não depois.
 *
 * Calibragem importa mais que abrangência: `DROP POLICY IF EXISTS` seguido de
 * `CREATE POLICY` é o padrão de idempotência do repo, e `DROP FUNCTION` + `CREATE
 * FUNCTION` é obrigatório aqui (com overload, `CREATE OR REPLACE` falha em
 * silêncio). Um guard que reprova esses dois seria desligado na primeira semana,
 * então ele só reclama quando o DROP não tem o CREATE correspondente.
 *
 * Uso:
 *   node scripts/check-migration-safety.mjs <arquivo.sql> [...]
 *   node scripts/check-migration-safety.mjs --base origin/staging
 *
 * Saída: exit 1 se houver achado bloqueante, a menos que
 * ALLOW_DESTRUCTIVE_MIGRATION=true.
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

/** Remove comentários para não acusar DDL citado em texto explicativo. */
export function stripComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
}

const BLOCKING_PATTERNS = [
  {
    // Bloqueia mesmo quando vem seguido de CREATE TABLE do mesmo nome (o padrão
    // "recriar do zero"): recriar apaga todas as linhas existentes, e é justamente
    // aí que alguém precisa dizer "sim, essa tabela é descartável".
    id: "drop-table",
    re: /\bDROP\s+TABLE\b/gi,
    message: "DROP TABLE apaga a tabela e todo o dado dentro dela",
  },
  {
    id: "drop-column",
    re: /\bDROP\s+COLUMN\b/gi,
    message: "DROP COLUMN apaga o dado da coluna, sem caminho de volta",
  },
  {
    id: "drop-schema",
    re: /\bDROP\s+SCHEMA\b/gi,
    message: "DROP SCHEMA apaga tudo que estiver dentro do schema",
  },
  {
    id: "truncate",
    re: /\bTRUNCATE\b/gi,
    message: "TRUNCATE esvazia a tabela",
  },
  {
    id: "disable-rls",
    re: /\bDISABLE\s+ROW\s+LEVEL\s+SECURITY\b/gi,
    message:
      "desligar RLS expõe o dado de todas as empresas entre si (o isolamento multi-tenant é RLS, ver ADR 0001)",
  },
];

/** DELETE sem WHERE apaga a tabela inteira; com WHERE é operação normal de dado. */
function findUnscopedDeletes(sql) {
  const findings = [];
  const re = /\bDELETE\s+FROM\s+([\w".]+)([^;]*);/gi;
  let m;
  while ((m = re.exec(sql)) !== null) {
    if (!/\bWHERE\b/i.test(m[2])) {
      findings.push({
        id: "delete-without-where",
        blocking: true,
        message: `DELETE FROM ${m[1]} sem WHERE apaga a tabela inteira`,
      });
    }
  }
  return findings;
}

/**
 * DROP de objeto recriável só é problema quando o CREATE não vem junto.
 * Compara por nome para não depender da ordem dos statements.
 */
function findOrphanDrops(sql) {
  const findings = [];
  const kinds = [
    {
      kind: "POLICY",
      dropRe: /\bDROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?("[^"]+"|[\w]+)/gi,
      createRe: /\bCREATE\s+POLICY\s+("[^"]+"|[\w]+)/gi,
      // Medido contra as 183 migrations do repo: 95 achados, e a amostra mostrou que
      // remover policy sem recriar é normalmente o APERTO de segurança, não a brecha
      // (016_policies_financeiro.sql derruba as policies "Read Only" permissivas de
      // propósito). "A tabela ficou sem nenhuma policy" depende do estado acumulado
      // do banco e não é decidível lendo um arquivo, então quem responde isso é o
      // teste pgTAP de RLS, não este guard. Aqui fica como aviso.
      blocking: false,
      why: "confirme que a tabela continua coberta por outra policy (o teste de RLS é quem prova)",
    },
    {
      kind: "FUNCTION",
      dropRe: /\bDROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?([\w".]+)/gi,
      createRe: /\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([\w".]+)/gi,
      blocking: false,
      why: "DROP + CREATE é o padrão correto aqui; sem o CREATE, quem chamava a função quebra",
    },
    {
      kind: "TRIGGER",
      dropRe: /\bDROP\s+TRIGGER\s+(?:IF\s+EXISTS\s+)?([\w".]+)/gi,
      createRe: /\bCREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+([\w".]+)/gi,
      blocking: false,
      why: "sem o CREATE correspondente, a regra que o trigger garantia deixa de valer",
    },
  ];

  const normalize = (name) => name.replace(/"/g, "").split(".").pop().toLowerCase();

  for (const { kind, dropRe, createRe, blocking, why } of kinds) {
    const created = new Set();
    let c;
    while ((c = createRe.exec(sql)) !== null) created.add(normalize(c[1]));

    let d;
    while ((d = dropRe.exec(sql)) !== null) {
      const name = normalize(d[1]);
      if (!created.has(name)) {
        findings.push({
          id: `orphan-drop-${kind.toLowerCase()}`,
          blocking,
          message: `DROP ${kind} ${name} sem CREATE correspondente no mesmo arquivo: ${why}`,
        });
      }
    }
  }
  return findings;
}

/** Analisa um arquivo de migration e devolve os achados. */
export function analyzeSql(rawSql) {
  const sql = stripComments(rawSql);
  const findings = [];

  for (const { id, re, message } of BLOCKING_PATTERNS) {
    const matches = sql.match(re);
    if (matches) {
      findings.push({ id, blocking: true, message, count: matches.length });
    }
  }

  findings.push(...findUnscopedDeletes(sql));
  findings.push(...findOrphanDrops(sql));
  return findings;
}

function changedMigrations(base) {
  // Só arquivos ADICIONADOS: migration já aplicada não deve ser reavaliada, e
  // editar uma migration antiga é outro problema (o histórico já divergiu).
  const out = execSync(
    `git diff --name-only --diff-filter=A ${base}...HEAD -- supabase/migrations`,
    { encoding: "utf8" },
  );
  return out.split("\n").filter((l) => l.endsWith(".sql"));
}

function main(argv) {
  const baseFlag = argv.indexOf("--base");
  const files =
    baseFlag === -1 ? argv.filter((a) => a.endsWith(".sql")) : changedMigrations(argv[baseFlag + 1]);

  if (files.length === 0) {
    console.log("Nenhuma migration nova para analisar.");
    return 0;
  }

  let blocking = 0;
  let warnings = 0;

  for (const file of files) {
    const findings = analyzeSql(readFileSync(file, "utf8"));
    if (findings.length === 0) {
      console.log(`✅ ${file}`);
      continue;
    }
    console.log(`\n${file}`);
    for (const f of findings) {
      const tag = f.blocking ? "BLOQUEIA" : "aviso   ";
      console.log(`  ${tag}  ${f.message}`);
      if (f.blocking) blocking++;
      else warnings++;
    }
  }

  console.log(`\n${files.length} migration(s) analisada(s): ${blocking} bloqueante(s), ${warnings} aviso(s).`);

  if (blocking === 0) return 0;

  if (process.env.ALLOW_DESTRUCTIVE_MIGRATION === "true") {
    console.log(
      "\n⚠️  ALLOW_DESTRUCTIVE_MIGRATION=true: seguindo com a mudança destrutiva.\n" +
        "   Confirme que existe backup recente e que o PR explica por que a perda de dado é aceitável.",
    );
    return 0;
  }

  console.log(
    "\n❌ Migration destrutiva sem autorização.\n" +
      "   Se a perda de dado é intencional, rode de novo com ALLOW_DESTRUCTIVE_MIGRATION=true\n" +
      "   (no CI: repository variable com o mesmo nome) e diga no PR o porquê.",
  );
  return 1;
}

// Só executa quando chamado como CLI, para o teste poder importar as funções.
if (process.argv[1] && process.argv[1].endsWith("check-migration-safety.mjs")) {
  process.exit(main(process.argv.slice(2)));
}
