import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabaseFake } from "@/hooks/testing/supabaseFake";

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/hooks/testing/supabaseFake")).supabaseFake.client,
}));

import { useCriarFornecedor, useFornecedorDetalhe, useFornecedoresLite } from "./useFornecedorDetalhe";
import { useAvaliarFornecedor, useAvaliacaoDaProposta, useFornecedorAvaliacoes } from "./useFornecedorAvaliacoes";

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  supabaseFake.reset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  supabaseFake.respondRpc("get_user_empresa_id", { data: "emp-1" });
});

describe("useCriarFornecedor (cadastro inline)", () => {
  it("cria só com o nome na empresa do usuário e devolve o id", async () => {
    supabaseFake.respond("fornecedores", "insert", { data: { id: "f9" } });
    const { result } = renderHook(() => useCriarFornecedor(), { wrapper });

    await expect(result.current.mutateAsync("Areia Fina")).resolves.toBe("f9");
    expect(supabaseFake.callsTo("fornecedores", "insert")[0].payload).toEqual({
      nome: "Areia Fina",
      empresa_id: "emp-1",
    });
  });

  it("usuário sem empresa não grava", async () => {
    supabaseFake.respondRpc("get_user_empresa_id", { data: null });
    const { result } = renderHook(() => useCriarFornecedor(), { wrapper });

    await expect(result.current.mutateAsync("Areia")).rejects.toThrow("Usuário não vinculado a uma empresa");
    expect(supabaseFake.callsTo("fornecedores", "insert")).toHaveLength(0);
  });

  it("erro do banco é propagado", async () => {
    supabaseFake.respond("fornecedores", "insert", { error: { message: "duplicate key value" } });
    const { result } = renderHook(() => useCriarFornecedor(), { wrapper });
    await expect(result.current.mutateAsync("Areia")).rejects.toMatchObject({ message: "duplicate key value" });
  });
});

describe("useFornecedoresLite", () => {
  it("lista só os não excluídos, por nome", async () => {
    supabaseFake.respond("fornecedores", "select", { data: [{ id: "f1", nome: "A", cnpj: null }] });
    const { result } = renderHook(() => useFornecedoresLite(), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    const [q] = supabaseFake.callsTo("fornecedores");
    expect(q.chain).toContainEqual(["is", ["deleted_at", null]]);
  });
});

describe("useFornecedorDetalhe", () => {
  it("junta cotações (sem as removidas, itens em ordem) e compras com o resumo", async () => {
    supabaseFake.respond("fornecedores", "select", { data: { id: "f1", nome: "Concreto Forte" } });
    supabaseFake.respond("obra_cotacao_proposta", "select", {
      data: [
        {
          id: "p1",
          valor: "1000",
          cotacao: {
            id: "c1",
            descricao: "Cimento",
            status: "fechada",
            proposta_vencedora_id: "p1",
            obra_id: "o1",
            deleted_at: null,
            obra: { nome: "Obra Centro" },
          },
          itens: [
            { descricao: "B", quantidade: 1, unidade: "un", preco_unitario: 1, valor_total: 1, ordem: 2 },
            { descricao: "A", quantidade: 1, unidade: "un", preco_unitario: 1, valor_total: 1, ordem: 1 },
          ],
        },
        {
          id: "p2",
          valor: 500,
          cotacao: {
            id: "c2",
            descricao: "Areia",
            status: "aberta",
            proposta_vencedora_id: null,
            obra_id: "o1",
            deleted_at: "2026-01-01",
            obra: null,
          },
          itens: null,
        },
      ],
    });
    supabaseFake.respond("obra_conta_lancamento", "select", {
      data: [
        {
          id: "l1",
          data: "2026-10-01",
          descricao: "Cimento",
          valor: "800",
          obra_id: "o2",
          comprovante_url: null,
          obra: null,
          frente: { nome: "Fundação" },
        },
      ],
    });
    const { result } = renderHook(() => useFornecedorDetalhe("f1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const d = result.current.data!;
    expect(d.cotacoes).toHaveLength(1);
    expect(d.cotacoes[0]).toMatchObject({ propostaId: "p1", valor: 1000, status: "venceu", obraNome: "Obra Centro" });
    expect(d.cotacoes[0].itens.map((i) => i.descricao)).toEqual(["A", "B"]);
    expect(d.cotacoes[0].itens[0]).not.toHaveProperty("ordem");
    expect(d.compras[0]).toMatchObject({ valor: 800, obraNome: "Obra removida", frente: "Fundação" });
    expect(d.resumo).toMatchObject({ obras: 2, totalComprado: 800, totalCotado: 1000, vitorias: 1 });
  });

  it("erro em qualquer consulta vira estado de erro", async () => {
    supabaseFake.respond("obra_conta_lancamento", "select", { error: { message: "boom" } });
    const { result } = renderHook(() => useFornecedorDetalhe("f1"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("sem id não consulta", () => {
    renderHook(() => useFornecedorDetalhe(undefined), { wrapper });
    expect(supabaseFake.calls).toHaveLength(0);
  });
});

describe("avaliações do fornecedor", () => {
  it("avaliar manda só as notas dadas e o comentário aparado", async () => {
    supabaseFake.respondRpc("rpc_avaliar_fornecedor", { data: 4 });
    const { result } = renderHook(() => useAvaliarFornecedor("p1", "f1"), { wrapper });

    await expect(
      result.current.mutateAsync({
        notas: { demora: 4, preco: null, prazo: 5, qualidade: null },
        comentario: "   ",
      })
    ).resolves.toBe(4);
    expect(supabaseFake.rpcCalls.at(-1)).toEqual({
      fn: "rpc_avaliar_fornecedor",
      args: {
        p_proposta_id: "p1",
        p_demora: 4,
        p_preco: undefined,
        p_prazo: 5,
        p_qualidade: undefined,
        p_comentario: undefined,
      },
    });
  });

  it("erro do RPC é propagado (ex.: nota fora da faixa)", async () => {
    supabaseFake.respondRpc("rpc_avaliar_fornecedor", { error: { message: "violates check constraint" } });
    const { result } = renderHook(() => useAvaliarFornecedor("p1", null), { wrapper });
    await expect(
      result.current.mutateAsync({ notas: { demora: 9, preco: null, prazo: null, qualidade: null }, comentario: "" })
    ).rejects.toBeTruthy();
  });

  it("lista as avaliações do fornecedor e a avaliação de uma proposta", async () => {
    supabaseFake.respond("fornecedor_avaliacao", "select", { data: [{ id: "a1" }] }, { data: { id: "a1" } });
    const lista = renderHook(() => useFornecedorAvaliacoes("f1"), { wrapper });
    await waitFor(() => expect(lista.result.current.data).toEqual([{ id: "a1" }]));
    const daProposta = renderHook(() => useAvaliacaoDaProposta("p1"), { wrapper });
    await waitFor(() => expect(daProposta.result.current.data).toEqual({ id: "a1", cotacao: null }));
  });
});
