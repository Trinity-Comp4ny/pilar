import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TABELAS_SOFT_DELETE_POR_RPC } from "./softDelete";

/**
 * A lista do front e a allowlist do banco precisam ser a mesma coisa. Se o front
 * achar que uma tabela não precisa de RPC e o banco achar que precisa, o
 * fallback de UPDATE direto volta a levar 42501 em produção; no sentido
 * contrário, a RPC recusa a tabela e o soft delete quebra do mesmo jeito.
 */
describe("sincronia da allowlist de soft delete (front x banco)", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const migracao = path.resolve(here, "../../supabase/migrations/20260859000000_soft_delete_via_rpc.sql");

  it("as duas listas têm exatamente as mesmas tabelas", () => {
    const sql = fs.readFileSync(migracao, "utf8");
    const corpo = sql.match(/_soft_delete_feature\(p_tabela text\)[\s\S]*?\$function\$;/);
    expect(corpo, "não achou o corpo de _soft_delete_feature na migration").not.toBeNull();

    const noBanco = new Set(
      Array.from((corpo?.[0] ?? "").matchAll(/WHEN '([a-z_]+)'\s+THEN/g)).map((m) => m[1])
    );

    expect([...noBanco].sort()).toEqual([...TABELAS_SOFT_DELETE_POR_RPC].sort());
  });

  it("nenhuma tabela sem deleted_at entrou na lista por engano", () => {
    // Tabelas que fazem soft delete mas NÃO têm deleted_at na policy de SELECT:
    // elas devem seguir no UPDATE direto, senão a RPC recusa.
    for (const t of ["leads", "propostas", "pessoas", "metas", "centros_custo", "transferencias", "folha_pagamento"]) {
      expect(TABELAS_SOFT_DELETE_POR_RPC.has(t), `${t} não deveria estar na lista de RPC`).toBe(false);
    }
  });
});
