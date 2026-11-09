import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/obras/testing/supabaseFake")).fake.supabase,
}));

import { fake } from "@/pages/obras/testing/supabaseFake";
import {
  getDiasStatus,
  useMarcarAtrasado,
  useMarcarRecebido,
  usePagamentosProjeto,
  type PagamentoProjeto,
} from "./usePagamentosProjeto";

// Pagamentos do projeto (receitas): resumo de contrato/recebido/pendente/atrasado,
// nome do cliente vindo como objeto ou array, falha do banco, e as mutações de
// marcar recebido/atrasado.

let qc: QueryClient;
function wrapper() {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  vi.spyOn(qc, "invalidateQueries");
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const iso = (dias: number) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};

const receita = (p: Record<string, unknown>) => ({
  id: "r",
  descricao: "Parcela",
  valor: 100,
  data_vencimento: iso(10),
  data_recebimento: null,
  status: "Pendente",
  cliente_id: "c1",
  nota_fiscal: null,
  forma_pagamento: null,
  parcela_numero: 1,
  parcela_total: 3,
  grupo_parcela: null,
  observacao: null,
  created_at: null,
  clientes: { nome: "Construtora" },
  ...p,
});

beforeEach(() => fake.reset());

describe("usePagamentosProjeto", () => {
  it("monta o resumo com recebido, pendente, atrasado e próximo vencimento", async () => {
    fake.responder((c) => {
      if (c.tabela === "receitas")
        return {
          data: [
            receita({ id: "a", valor: 300, status: "Recebido", clientes: [{ nome: "Via array" }] }),
            receita({ id: "b", valor: 200, status: "Pago", clientes: [] }),
            receita({ id: "c", valor: 100, status: "Atrasado", data_vencimento: iso(-5) }),
            receita({ id: "d", valor: 150, status: "Pendente", data_vencimento: iso(20) }),
            receita({ id: "e", valor: 50, status: "Pendente", data_vencimento: iso(3) }),
            receita({ id: "f", valor: 999, status: "Cancelado", clientes: null }),
          ],
          error: null,
        };
      if (c.tabela === "projetos_safe") return { data: { valor_contrato: 1000 }, error: null };
      return undefined;
    });
    const { result } = renderHook(() => usePagamentosProjeto("proj-1"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const { pagamentos, resumo } = result.current.data!;
    expect(pagamentos.map((p) => p.cliente_nome)).toEqual([
      "Via array",
      null,
      "Construtora",
      "Construtora",
      "Construtora",
      null,
    ]);
    expect(pagamentos[0].created_at).toBe("");
    expect(resumo).toEqual({
      totalContrato: 1000,
      totalFaturado: 800,
      totalRecebido: 500,
      totalPendente: 300,
      totalAtrasado: 100,
      percentualRecebido: 50,
      proximoVencimento: iso(3),
      qtdPendentes: 3,
      qtdAtrasados: 1,
    });
  });

  it("sem acesso ao valor do contrato e sem receitas: zeros e sem próximo", async () => {
    fake.responder((c) => (c.tabela === "receitas" ? { data: null, error: null } : { data: null, error: null }));
    const { result } = renderHook(() => usePagamentosProjeto("proj-1"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.resumo).toEqual(
      expect.objectContaining({ totalContrato: 0, percentualRecebido: 0, proximoVencimento: null })
    );
  });

  it("erro ao ler receitas vira erro da query", async () => {
    fake.responder((c) => (c.tabela === "receitas" ? { data: null, error: { message: "rls" } } : undefined));
    const { result } = renderHook(() => usePagamentosProjeto("proj-1"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("sem projeto não consulta", () => {
    const { result } = renderHook(() => usePagamentosProjeto(undefined), { wrapper: wrapper() });
    expect(result.current.fetchStatus).toBe("idle");
    expect(fake.chamadas).toHaveLength(0);
  });
});

describe("getDiasStatus", () => {
  const pag = (p: Partial<PagamentoProjeto>) =>
    ({ status: "Pendente", data_vencimento: iso(0), ...p }) as PagamentoProjeto;
  it("classifica atraso, próximo e no prazo; quitado ou cancelado devolve o próprio status", () => {
    expect(getDiasStatus(pag({ status: "Recebido" }))).toEqual({ dias: 0, tipo: "Recebido" });
    expect(getDiasStatus(pag({ status: "Cancelado" }))).toEqual({ dias: 0, tipo: "Cancelado" });
    expect(getDiasStatus(pag({ data_vencimento: null }))?.tipo).toBe("proximo");
    expect(getDiasStatus(pag({ data_vencimento: iso(-3) }))?.tipo).toBe("atrasado");
    expect(getDiasStatus(pag({ data_vencimento: iso(5) }))?.tipo).toBe("proximo");
    expect(getDiasStatus(pag({ data_vencimento: iso(30) }))?.tipo).toBe("no_prazo");
  });
});

describe("mutações", () => {
  it("marcar recebido grava status e data (hoje por padrão) e recarrega", async () => {
    const { result } = renderHook(() => useMarcarRecebido(), { wrapper: wrapper() });
    await act(() => result.current.mutateAsync({ receitaId: "r1", dataRecebimento: "2026-03-01" }));
    await act(() => result.current.mutateAsync({ receitaId: "r2" }));
    const [primeira, segunda] = fake.escritas("receitas");
    expect(primeira.payload).toEqual({ status: "Recebido", data_recebimento: "2026-03-01" });
    expect(segunda.payload).toEqual({ status: "Recebido", data_recebimento: new Date().toISOString().split("T")[0] });
    expect(segunda.filtros).toContainEqual(["eq", "id", "r2"]);
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["pagamentos-projeto"] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["receitas"] });
  });

  it("marcar recebido com erro do banco rejeita", async () => {
    fake.responder((c) => (c.op === "update" ? { data: null, error: { message: "rls" } } : undefined));
    const { result } = renderHook(() => useMarcarRecebido(), { wrapper: wrapper() });
    await expect(act(() => result.current.mutateAsync({ receitaId: "r1" }))).rejects.toEqual({ message: "rls" });
  });

  it("marcar atrasado grava o status; erro rejeita", async () => {
    const { result } = renderHook(() => useMarcarAtrasado(), { wrapper: wrapper() });
    await act(() => result.current.mutateAsync("r1"));
    expect(fake.escritas("receitas")[0].payload).toEqual({ status: "Atrasado" });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["pagamentos-projeto"] });

    fake.responder((c) => (c.op === "update" ? { data: null, error: { message: "rls" } } : undefined));
    await expect(act(() => result.current.mutateAsync("r2"))).rejects.toEqual({ message: "rls" });
  });
});
