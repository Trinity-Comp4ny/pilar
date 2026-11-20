#!/usr/bin/env node
/**
 * Confere se as Edge Functions no Supabase estão com verify_jwt igual ao
 * supabase/config.toml versionado. Nunca altera funções, IAM nem tokens.
 *
 * Uso: SUPABASE_ACCESS_TOKEN=... node scripts/check-edge-jwt.mjs <project-ref>
 * Após o deploy, o script tenta novamente em caso de propagação de metadados.
 */
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export function expectedJwtFlags(toml, directories) {
  const expected = new Map(directories.map((name) => [name, true]));
  let section = null;
  const touched = new Set();
  for (const line of toml.split(/\r?\n/)) {
    const header = /^\s*\[functions\.([\w-]+)\]\s*(?:#.*)?$/.exec(line);
    if (header) {
      section = header[1];
      continue;
    }
    if (/^\s*\[/.test(line)) {
      section = null;
      continue;
    }
    if (!section || !expected.has(section)) continue;
    const flag = /^\s*verify_jwt\s*=\s*(true|false)\s*(?:#.*)?$/.exec(line);
    if (!flag) continue;
    if (touched.has(section)) throw new Error("verify_jwt definido mais de uma vez para " + section);
    touched.add(section);
    expected.set(section, flag[1] === "true");
  }
  return expected;
}

export function findJwtDrift(expected, deployed) {
  if (!Array.isArray(deployed)) throw new Error("A Management API não devolveu uma lista de funções.");
  const actual = new Map();
  for (const fn of deployed) {
    if (typeof fn.slug === "string" && typeof fn.verify_jwt === "boolean") {
      actual.set(fn.slug, fn.verify_jwt);
    }
  }
  const errors = [];
  for (const [slug, expectedValue] of expected) {
    if (!actual.has(slug)) {
      errors.push(slug + ": função não implantada/sem verify_jwt na resposta");
    } else if (actual.get(slug) !== expectedValue) {
      errors.push(slug + ": esperado verify_jwt=" + expectedValue + ", implantado=" + actual.get(slug));
    }
  }
  const stale = [...actual.keys()].filter((slug) => !expected.has(slug));
  return { errors, stale };
}

async function audit(ref, token) {
  if (!/^[a-z0-9]{20}$/.test(ref ?? "")) throw new Error("Project ref do Supabase inválido.");
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN ausente.");
  const all = await readdir("supabase/functions", { withFileTypes: true });
  const dirs = all.filter((d) => d.isDirectory() && !d.name.startsWith("_")).map((d) => d.name);
  const toml = await readFile("supabase/config.toml", "utf8");
  const expected = expectedJwtFlags(toml, dirs);
  let failures = [];
  for (let attempt = 1; attempt <= 6; attempt++) {
    const response = await fetch("https://api.supabase.com/v1/projects/" + ref + "/functions", {
      headers: { Authorization: "Bearer " + token },
    });
    if (!response.ok) {
      throw new Error("Management API não respondeu com sucesso (HTTP " + response.status + "). Verifique permissão edge_functions:read.");
    }
    const remote = await response.json();
    const { errors, stale } = findJwtDrift(expected, remote);
    if (stale.length) console.log("Funções implantadas fora do repositório (auditar separadamente): " + stale.join(", "));
    if (!errors.length) {
      console.log("JWT correto em " + expected.size + " funções do projeto " + ref + ".");
      return;
    }
    failures = errors;
    if (attempt < 6) {
      console.log("JWT drift em " + errors.length + " função(ões); aguardando propagação do deploy (" + attempt + "/6).");
      await new Promise((done) => setTimeout(done, 4000));
    }
  }
  for (const error of failures) console.error("::error::" + error);
  throw new Error("JWT drift após deploy (" + failures.length + " diferenças). Nenhum endpoint foi modificado.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  audit(process.argv[2], process.env.SUPABASE_ACCESS_TOKEN).catch((error) => {
    console.error("::error::" + error.message);
    process.exitCode = 1;
  });
}
