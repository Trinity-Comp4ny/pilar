import { beforeEach, describe, expect, it, vi } from "vitest";
import { sb } from "../testing/supabaseMock";

// Exclusão de lançamentos: transferência só pela RPC própria, receita/despesa
// pela rpc_soft_delete (que falha quando nada foi marcado), e falha parcial
// contada em vez de virar sucesso.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("../testing/supabaseMock")).sb.client,
}));

import { excluirLancamentos } from "./excluirLancamentos";

const naoEncontrado = { message: "Registro não encontrado", code: "P0002" };

beforeEach(() => {
  sb.reset();
});

describe("excluirLancamentos", () => {
  it("receita e despesa vão pela rpc_soft_delete, uma por id, sem delete direto", async () => {
    const r = await excluirLancamentos([
      { id: "r-1", tipo: "receita" },
      { id: "d-1", tipo: "despesa" },
    ]);
    expect(r).toEqual({ excluidos: 2, falhas: 0, erro: null });
    expect(sb.argsRpc("rpc_soft_delete", 0)).toEqual({ p_tabela: "receitas", p_id: "r-1" });
    expect(sb.argsRpc("rpc_soft_delete", 1)).toEqual({ p_tabela: "despesas", p_id: "d-1" });
    expect(sb.de("despesas", "delete")).toHaveLength(0);
    expect(sb.de("receitas", "delete")).toHaveLength(0);
  });

  it("transferência vai pela rpc_excluir_transferencia, sem update direto na tabela", async () => {
    const r = await excluirLancamentos([
      { id: "t-1", tipo: "transferencia" },
      { id: "t-2", tipo: "transferencia" },
    ]);
    expect(r.excluidos).toBe(2);
    expect(sb.argsRpc("rpc_excluir_transferencia", 0)).toEqual({ p_id: "t-1" });
    expect(sb.argsRpc("rpc_excluir_transferencia", 1)).toEqual({ p_id: "t-2" });
    expect(sb.de("transferencias", "update")).toHaveLength(0);
  });

  it("linha barrada (RLS, outra empresa, já excluída) conta como falha", async () => {
    sb.rpcResultado("rpc_soft_delete", [
      { data: null, error: null },
      { data: null, error: naoEncontrado },
    ]);
    const r = await excluirLancamentos([
      { id: "d-1", tipo: "despesa" },
      { id: "d-2", tipo: "despesa" },
    ]);
    expect(r.excluidos).toBe(1);
    expect(r.falhas).toBe(1);
    expect(r.erro).toEqual(naoEncontrado);
  });

  it("id repetido na seleção é excluído uma vez só", async () => {
    const r = await excluirLancamentos([
      { id: "d-1", tipo: "despesa" },
      { id: "d-1", tipo: "despesa" },
    ]);
    expect(r).toEqual({ excluidos: 1, falhas: 0, erro: null });
  });
});
