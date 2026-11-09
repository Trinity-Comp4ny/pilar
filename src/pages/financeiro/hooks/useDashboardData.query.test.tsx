import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { sb } from "../testing/supabaseMock";

// useDashboardData de ponta a ponta sobre o supabase-js mockado (as consultas de
// dashboard/queries.ts + os processors): período e período anterior, nomes de
// clientes resolvidos à parte (projetos_safe não embeda), contagens e o erro
// explícito quando qualquer consulta falha (em vez de tela zerada).

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("../testing/supabaseMock")).sb.client,
}));

import { useDashboardData } from "./useDashboardData";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  sb.reset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 15, 12));
  // receitas: mês, mês anterior, pendentes, próximas (ordem do Promise.all)
  sb.resultado("receitas.select", [
    {
      data: [{ valor: 1000, status: "Recebido", data_recebimento: "2026-10-05", data_vencimento: "2026-10-05" }],
      error: null,
    },
    {
      data: [{ valor: 500, status: "Recebido", data_recebimento: "2026-09-05", data_vencimento: "2026-09-05" }],
      error: null,
    },
    { data: [{ valor: 300 }], error: null },
    {
      data: [
        {
          id: "r1",
          descricao: "Parcela 2",
          valor: 300,
          data_vencimento: "2026-10-16",
          status: "Pendente",
          projeto_id: "p1",
          projetos: { nome: "Casa Verde" },
          cliente_id: "c1",
          clientes: { nome: "Alfa" },
        },
      ],
      error: null,
    },
  ]);
  sb.resultado("despesas.select", [
    {
      data: [{ valor: 400, status: "Pago", data_pagamento: "2026-10-03", data_vencimento: "2026-10-03" }],
      error: null,
    },
    { data: [], error: null },
    { data: [{ valor: 200 }], error: null },
    { data: [], error: null },
  ]);
  sb.resultado("projetos_safe.select", [
    {
      data: [
        { id: "p1", nome: "Casa Verde", status: "Em andamento", prioridade: "Alta", cliente_id: "c1" },
        { id: "p2", nome: "Galpão", status: "Planejamento", prioridade: null, cliente_id: null },
      ],
      error: null,
    },
    { data: null, error: null, count: 7 },
  ]);
  sb.resultado("clientes.select", { data: [{ id: "c1", nome: "Alfa" }], error: null });
  sb.resultado("leads.select", { data: [{ id: "l1", status: "novo", nome: "Lead" }], error: null });
  sb.resultado("alertas.select", [
    {
      data: [{ id: "a1", tipo: "x", severidade: "alta", titulo: "Atraso", mensagem: "m", created_at: "2026-10-14" }],
      error: null,
    },
    { data: null, error: null, count: 3 },
  ]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useDashboardData (consultas)", () => {
  it("monta KPIs, projetos com cliente, vencimentos e contagens", async () => {
    const { result } = renderHook(() => useDashboardData(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const d = result.current.data!;
    expect(d.kpis).toMatchObject({ receitaMes: 1000, despesaMes: 400, aReceber: 300, aPagar: 200, projetosAtivos: 7 });
    expect(d.projetos.map((p) => [p.nome, p.cliente])).toEqual([
      ["Casa Verde", "Alfa"],
      ["Galpão", "—"],
    ]);
    expect(d.proximosVencimentos).toHaveLength(1);
    expect(d.alertasNaoLidos).toBe(3);
    expect(d.leadsTotal).toBe(1);
    // nomes dos clientes buscados à parte só para os ids presentes
    expect(sb.de("clientes", "in")[0].args).toEqual(["id", ["c1"]]);
  });

  it("período padrão é o mês atual e o anterior tem a mesma duração", async () => {
    const { result } = renderHook(() => useDashboardData(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const filtros = sb.de("receitas", "or").map((c) => String(c.args[0]));
    expect(filtros[0]).toContain("data_recebimento.gte.2026-10-01");
    expect(filtros[0]).toContain("data_vencimento.lte.2026-10-31");
    expect(filtros[1]).toContain("data_recebimento.gte.2026-08-31");
    expect(filtros[1]).toContain("data_recebimento.lte.2026-09-30");
    // pagamento de fatura não conta como despesa do mês
    expect(sb.de("despesas", "eq")[0].args).toEqual(["is_fatura_payment", false]);
  });

  it("período informado substitui o mês atual", async () => {
    const { result } = renderHook(() => useDashboardData(new Date(2026, 0, 1), new Date(2026, 0, 10)), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const filtros = sb.de("receitas", "or").map((c) => String(c.args[0]));
    expect(filtros[0]).toContain("data_recebimento.gte.2026-01-01");
    expect(filtros[1]).toContain("data_recebimento.gte.2025-12-22");
    expect(filtros[1]).toContain("data_recebimento.lte.2025-12-31");
  });

  it("sem clientes nos projetos não consulta clientes", async () => {
    sb.resultado("projetos_safe.select", [
      { data: [{ id: "p2", nome: "Galpão", status: "Planejamento", cliente_id: null }], error: null },
      { data: null, error: null, count: null },
    ]);
    const { result } = renderHook(() => useDashboardData(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(sb.client.from).not.toHaveBeenCalledWith("clientes");
    expect(result.current.data!.kpis.projetosAtivos).toBe(0);
  });

  it("qualquer consulta com erro (ex.: RLS) vira erro, não números zerados", async () => {
    sb.resultado("leads.select", { data: null, error: { message: "permission denied for table leads" } });
    const { result } = renderHook(() => useDashboardData(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ message: "permission denied for table leads" });
  });
});
