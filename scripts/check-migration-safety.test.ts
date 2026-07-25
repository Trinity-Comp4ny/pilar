import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { analyzeSql, stripComments } from "./check-migration-safety.mjs";

const blockingIds = (sql: string) =>
  analyzeSql(sql)
    .filter((f) => f.blocking)
    .map((f) => f.id);

const allIds = (sql: string) => analyzeSql(sql).map((f) => f.id);

describe("check-migration-safety: o que precisa bloquear", () => {
  it("bloqueia DROP TABLE", () => {
    expect(blockingIds("DROP TABLE public.receitas;")).toContain("drop-table");
  });

  it("bloqueia DROP TABLE mesmo com recriação, porque recriar apaga as linhas", () => {
    const sql = `DROP TABLE IF EXISTS public.rate_limit_attempts;
                 CREATE TABLE public.rate_limit_attempts (id uuid primary key);`;
    expect(blockingIds(sql)).toContain("drop-table");
  });

  it("bloqueia DROP COLUMN", () => {
    expect(blockingIds("ALTER TABLE public.pessoas DROP COLUMN cpf;")).toContain("drop-column");
  });

  it("bloqueia TRUNCATE e DROP SCHEMA", () => {
    expect(blockingIds("TRUNCATE public.audit_logs;")).toContain("truncate");
    expect(blockingIds("DROP SCHEMA app CASCADE;")).toContain("drop-schema");
  });

  it("bloqueia desligar RLS, que é o isolamento entre empresas", () => {
    expect(blockingIds("ALTER TABLE public.receitas DISABLE ROW LEVEL SECURITY;")).toContain("disable-rls");
  });

  it("bloqueia DELETE sem WHERE", () => {
    expect(blockingIds("DELETE FROM public.receitas;")).toContain("delete-without-where");
  });
});

describe("check-migration-safety: o que NÃO pode reprovar", () => {
  it("aceita DELETE com WHERE", () => {
    expect(blockingIds("DELETE FROM public.receitas WHERE empresa_id = '1';")).toEqual([]);
  });

  it("aceita DROP POLICY + CREATE POLICY, o padrão de idempotência do repo", () => {
    const sql = `DROP POLICY IF EXISTS "receitas_select" ON public.receitas;
                 CREATE POLICY "receitas_select" ON public.receitas FOR SELECT USING (true);`;
    expect(allIds(sql)).toEqual([]);
  });

  it("aceita DROP FUNCTION + CREATE FUNCTION, obrigatório aqui por causa de overload", () => {
    const sql = `DROP FUNCTION IF EXISTS public.calcular_saldo(uuid);
                 CREATE FUNCTION public.calcular_saldo(p uuid) RETURNS numeric AS $$ SELECT 0 $$ LANGUAGE sql;`;
    expect(allIds(sql)).toEqual([]);
  });

  it("não reprova DROP POLICY órfão: remover policy permissiva é aperto, não brecha", () => {
    // Caso real: 016_policies_financeiro.sql derruba as policies "Read Only" que
    // deixavam qualquer funcionário ler o financeiro inteiro.
    const sql = `DROP POLICY IF EXISTS "Receitas Read Only" ON public.receitas;`;
    expect(analyzeSql(sql)).toHaveLength(1);
    expect(blockingIds(sql)).toEqual([]);
  });

  it("ignora DDL citado em comentário", () => {
    const sql = `-- antes isso fazia DROP TABLE public.x
                 /* e também TRUNCATE public.y */
                 SELECT 1;`;
    expect(analyzeSql(sql)).toEqual([]);
  });

  it("não acusa nada numa migration só de CREATE", () => {
    const sql = `CREATE TABLE public.jobs_queue (id uuid primary key);
                 ALTER TABLE public.jobs_queue ENABLE ROW LEVEL SECURITY;`;
    expect(analyzeSql(sql)).toEqual([]);
  });
});

describe("stripComments", () => {
  it("remove comentário de linha e de bloco", () => {
    expect(stripComments("a -- b\nc /* d */ e").replace(/\s+/g, " ").trim()).toBe("a c e");
  });
});

describe("contrato do pipeline", () => {
  // Mesmo padrão do test_deploy_safety_contract.py do labrynth-platform: quem
  // remover o guard, ou movê-lo para depois do deploy, quebra o CI.
  // cwd, não import.meta.url: no ambiente jsdom do vitest a URL do módulo não é file://
  const ci = readFileSync(resolve(process.cwd(), ".github/workflows/ci.yml"), "utf8");

  it("o guard de migration roda no CI", () => {
    expect(ci).toContain("check-migration-safety.mjs");
  });

  it("o guard roda ANTES de aplicar migration em qualquer ambiente", () => {
    const guard = ci.indexOf("check-migration-safety.mjs");
    const firstPush = ci.indexOf("supabase db push");
    expect(guard).toBeGreaterThan(-1);
    expect(firstPush).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(firstPush);
  });

  it("o deno check das edge functions roda no CI", () => {
    expect(ci).toContain("scripts/deno-check.sh");
  });

  it("todo job declara timeout, para um job travado não consumir 6h de runner", () => {
    // Conta só depois de `jobs:`, senão `push:` e `pull_request:` do bloco `on:`
    // entram na conta (têm a mesma indentação de um job).
    const jobsBlock = ci.slice(ci.indexOf("\njobs:"));
    const jobCount = (jobsBlock.match(/^ {2}[\w-]+:$/gm) ?? []).length;
    const timeoutCount = (jobsBlock.match(/^ {4}timeout-minutes:/gm) ?? []).length;
    expect(jobCount).toBeGreaterThan(0);
    expect(timeoutCount).toBe(jobCount);
  });
});
