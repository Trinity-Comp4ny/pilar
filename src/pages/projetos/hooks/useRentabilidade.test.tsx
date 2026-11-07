import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { sb } from "@/pages/financeiro/testing/supabaseMock";

// Rentabilidade de projetos: margens calculadas no front a partir do RPC
// (mão de obra é custo direto; indireto = 15% das despesas), agregados do
// dashboard, por cliente, projetos drenando caixa e o detalhe de um projeto.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/financeiro/testing/supabaseMock")).sb.client,
}));

import {
  useDashboardRentabilidade,
  useProjetoRentabilidade,
  useProjetosDrenandoCaixa,
  useRentabilidadePorCliente,
} from "./useRentabilidade";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const row = (p: Record<string, unknown>) => ({
  projeto_id: "p",
  projeto_nome: "Projeto",
  codigo_projeto: "PRJ",
  status: "Em andamento",
  valor_contrato: 0,
  receitas_total: 0,
  receitas_recebidas: 0,
  despesas_diretas: 0,
  custo_mao_de_obra: 0,
  horas_orcadas: 0,
  horas_consumidas: 0,
  ...p,
});

const rows = [
  // margem bruta 100 - (20+30) = 50 (50%); indireto 3 -> líquida 47
  row({ projeto_id: "a", receitas_total: "100", despesas_diretas: 20, custo_mao_de_obra: 30, horas_orcadas: 10, horas_consumidas: 5 }),
  // margem bruta 200 - 300 = -100 (-50%)
  row({ projeto_id: "b", receitas_total: 200, despesas_diretas: 300, horas_orcadas: 10, horas_consumidas: 15 }),
  // sem receita: fora das médias e dos tops; margem bruta -10
  row({ projeto_id: "c", receitas_total: 0, despesas_diretas: "abc", custo_mao_de_obra: 10 }),
];

beforeEach(() => {
  sb.reset();
});

describe("useDashboardRentabilidade", () => {
  it("calcula margens, agregados e tops", async () => {
    sb.rpcResultado("rpc_dashboard_rentabilidade", { data: rows, error: null });
    const { result } = renderHook(() => useDashboardRentabilidade(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const d = result.current.data!;
    const a = d.projetos.find((p) => p.projeto_id === "a")!;
    expect(a).toMatchObject({
      receitas_total: 100,
      margem_bruta: 50,
      margem_bruta_pct: 50,
      margem_liquida: 47,
      margem_liquida_pct: 47,
    });
    const c = d.projetos.find((p) => p.projeto_id === "c")!;
    expect(c).toMatchObject({ despesas_diretas: 0, margem_bruta: -10, margem_bruta_pct: 0, margem_liquida_pct: 0 });

    expect(d.metricas).toMatchObject({
      totalReceitas: 300,
      totalDespesas: 320,
      totalMaoDeObra: 40,
      margemBrutaTotal: -60,
      margemMediaPct: 0, // (50 + -50) / 2
      totalHorasOrcadas: 20,
      totalHorasConsumidas: 20,
      utilizacaoHoras: 100,
      totalProjetos: 3,
      projetosComReceita: 2,
    });
    expect(d.topRentaveis.map((p) => p.projeto_id)).toEqual(["a", "b"]);
    expect(d.menosRentaveis.map((p) => p.projeto_id)).toEqual(["b", "a"]);
  });

  it("sem projetos: métricas zeradas, sem divisão por zero", async () => {
    sb.rpcResultado("rpc_dashboard_rentabilidade", { data: null, error: null });
    const { result } = renderHook(() => useDashboardRentabilidade(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.metricas).toMatchObject({ margemMediaPct: 0, utilizacaoHoras: 0, totalProjetos: 0 });
  });

  it("desabilitado (sem permissão financeira) não chama o RPC", () => {
    const { result } = renderHook(() => useDashboardRentabilidade(false), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(sb.client.rpc).not.toHaveBeenCalled();
  });

  it("erro do RPC vira erro da query", async () => {
    sb.rpcResultado("rpc_dashboard_rentabilidade", { data: null, error: { message: "can_view_financeiro" } });
    const { result } = renderHook(() => useDashboardRentabilidade(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ message: "can_view_financeiro" });
  });
});

describe("useRentabilidadePorCliente", () => {
  it("agrupa por cliente, ignora projeto sem cliente e calcula concentração", async () => {
    sb.rpcResultado("rpc_dashboard_rentabilidade", { data: rows, error: null });
    sb.resultado("projetos.select", {
      data: [
        { id: "a", cliente_id: "c1", clientes: { nome: "Alfa" } },
        { id: "b", cliente_id: "c1", clientes: { nome: "Alfa" } },
        { id: "c", cliente_id: null, clientes: null },
        { id: "zz", cliente_id: "c9", clientes: null }, // projeto fora do RPC
      ],
      error: null,
    });
    const { result } = renderHook(() => useRentabilidadePorCliente(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const d = result.current.data!;
    expect(d.totalReceitas).toBe(300);
    expect(d.clientes).toEqual([
      {
        cliente_id: "c1",
        cliente_nome: "Alfa",
        total_receitas: 300,
        total_despesas: 350,
        margem_bruta: -50,
        margem_bruta_pct: (-50 / 300) * 100,
        num_projetos: 2,
        concentracao_pct: 100,
      },
    ]);
    expect(sb.de("projetos", "in")[0].args).toEqual(["id", ["a", "b", "c"]]);
  });

  it("cliente sem nome cai em Sem cliente e ordena por margem", async () => {
    sb.rpcResultado("rpc_dashboard_rentabilidade", { data: rows, error: null });
    sb.resultado("projetos.select", {
      data: [
        { id: "a", cliente_id: "c1", clientes: null },
        { id: "b", cliente_id: "c2", clientes: { nome: "Beta" } },
      ],
      error: null,
    });
    const { result } = renderHook(() => useRentabilidadePorCliente(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.clientes.map((c) => c.cliente_nome)).toEqual(["Sem cliente", "Beta"]);
  });

  it("sem projetos retorna vazio sem consultar clientes", async () => {
    sb.rpcResultado("rpc_dashboard_rentabilidade", { data: [], error: null });
    const { result } = renderHook(() => useRentabilidadePorCliente(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ clientes: [], totalReceitas: 0 });
    expect(sb.client.from).not.toHaveBeenCalled();
  });

  it("erro do RPC vira erro da query", async () => {
    sb.rpcResultado("rpc_dashboard_rentabilidade", { data: null, error: { message: "boom" } });
    const { result } = renderHook(() => useRentabilidadePorCliente(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useProjetosDrenandoCaixa", () => {
  it("só projetos com margem negativa, do pior para o menos pior", async () => {
    sb.rpcResultado("rpc_dashboard_rentabilidade", { data: rows, error: null });
    const { result } = renderHook(() => useProjetosDrenandoCaixa(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.map((p) => p.projeto_id)).toEqual(["b", "c"]);
  });

  it("erro do RPC vira erro da query", async () => {
    sb.rpcResultado("rpc_dashboard_rentabilidade", { data: null, error: { message: "boom" } });
    const { result } = renderHook(() => useProjetosDrenandoCaixa(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useProjetoRentabilidade", () => {
  it("busca o projeto e calcula as margens", async () => {
    sb.rpcResultado("rpc_projeto_rentabilidade", { data: rows[0], error: null });
    const { result } = renderHook(() => useProjetoRentabilidade("a"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ projeto_id: "a", margem_bruta: 50, margem_liquida: 47 });
    expect(sb.argsRpc("rpc_projeto_rentabilidade")).toEqual({ p_projeto_id: "a" });
  });

  it("sem dado do RPC devolve null", async () => {
    sb.rpcResultado("rpc_projeto_rentabilidade", { data: null, error: null });
    const { result } = renderHook(() => useProjetoRentabilidade("a"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("sem id ou sem permissão não chama o RPC", () => {
    renderHook(() => useProjetoRentabilidade(undefined), { wrapper });
    renderHook(() => useProjetoRentabilidade("a", false), { wrapper });
    expect(sb.client.rpc).not.toHaveBeenCalled();
  });

  it("erro do RPC vira erro da query", async () => {
    sb.rpcResultado("rpc_projeto_rentabilidade", { data: null, error: { message: "boom" } });
    const { result } = renderHook(() => useProjetoRentabilidade("a"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
