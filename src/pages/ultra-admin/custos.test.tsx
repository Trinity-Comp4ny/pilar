import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createSupabaseFrom, type ChainQuery, type ChainResult } from "@/test/supabaseChain";

// Custos de IA (spec 076/085): só o mês corrente entra, custo do ledger em USD vira BRL pelo
// câmbio de referência, receita só de quem paga (plano com Asaas + pacote pago no mês).

const h = vi.hoisted(() => ({ resolve: (() => ({ data: [] })) as (q: ChainQuery) => ChainResult, ocultos: false }));
const chain = vi.hoisted(() => ({ from: null as unknown as ReturnType<typeof createSupabaseFrom> }));

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom } = await import("@/test/supabaseChain");
  chain.from = createSupabaseFrom((q) => h.resolve(q));
  return { supabase: { from: chain.from.from } };
});
vi.mock("@/contexts/ValoresOcultosContext", () => ({ useValoresOcultos: () => ({ ocultos: h.ocultos }) }));

import { USD_BRL_REFERENCIA, emBrl, useCustosIa, useFormatCusto, useUltimasRequisicoes } from "./custos";

const AGORA = new Date().toISOString();
const ANTIGO = "2020-01-15T00:00:00Z";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function tabelas(t: Record<string, ChainResult>) {
  h.resolve = (q) => t[q.table] ?? { data: [] };
}

beforeEach(() => {
  h.resolve = () => ({ data: [] });
  h.ocultos = false;
  chain.from.calls.length = 0;
});

describe("emBrl", () => {
  it("converte pelo câmbio de referência", () => {
    expect(USD_BRL_REFERENCIA).toBe(5.5);
    expect(emBrl(2)).toBe(11);
    expect(emBrl(0)).toBe(0);
  });
});

describe("useFormatCusto", () => {
  it("valores normais e zero com 2 casas; fração de centavo com 4", () => {
    const { result } = renderHook(() => useFormatCusto());
    const f = result.current;
    expect(f(12.5)).toMatch(/R\$\s?12,50/);
    expect(f(0)).toMatch(/R\$\s?0,00/);
    expect(f(0.0042)).toBe("R$ 0,0042");
    expect(f(-0.0042)).toBe("R$ -0,0042");
  });

  it("modo valores ocultos mascara inclusive fração de centavo", () => {
    h.ocultos = true;
    const { result } = renderHook(() => useFormatCusto());
    expect(result.current(0.0042)).toContain("•");
    expect(result.current(100)).toContain("•");
  });
});

describe("useCustosIa", () => {
  it("agrega por empresa e agente só no mês, com receita, margem e anomalia", async () => {
    tabelas({
      v_uso_tokens_por_empresa: {
        data: [
          { empresa_id: "e1", mes: AGORA, eventos: 10, tokens_input: 1000, tokens_output: 500, custo_estimado: 2 },
          { empresa_id: "e2", mes: AGORA, eventos: 3, tokens_input: null, tokens_output: 100, custo_estimado: null },
          { empresa_id: "e3", mes: AGORA, eventos: 1, tokens_input: 1, tokens_output: 1, custo_estimado: 1 },
          { empresa_id: "e1", mes: ANTIGO, eventos: 99, tokens_input: 1, tokens_output: 1, custo_estimado: 50 },
        ],
      },
      empresas: {
        data: [
          { id: "e1", nome: "Alfa" },
          { id: "e2", nome: "Beta" },
        ],
      },
      pilar_subscriptions: {
        data: [
          {
            empresa_id: "e1",
            status: "active",
            asaas_subscription_id: "sub_1",
            pilar_subscription_plans: { nome: "Pro", preco_mensal: 400 },
          },
          // Convidada: plano ativo sem Asaas não gera receita.
          {
            empresa_id: "e2",
            status: "trialing",
            asaas_subscription_id: null,
            pilar_subscription_plans: { nome: "Starter", preco_mensal: 200 },
          },
          {
            empresa_id: "e3",
            status: "canceled",
            asaas_subscription_id: "sub_3",
            pilar_subscription_plans: { nome: "Pro", preco_mensal: 400 },
          },
        ],
      },
      v_uso_tokens_por_agente: {
        data: [
          { agent_key: "financeiro", mes: AGORA, eventos: 5, tokens_input: 100, tokens_output: 50, custo_estimado: 1 },
          { agent_key: "financeiro", mes: AGORA, eventos: 2, tokens_input: 10, tokens_output: null, custo_estimado: 1 },
          { agent_key: "propostas", mes: AGORA, eventos: 1, tokens_input: 1, tokens_output: 1, custo_estimado: null },
          { agent_key: "velho", mes: ANTIGO, eventos: 9, tokens_input: 1, tokens_output: 1, custo_estimado: 9 },
        ],
      },
      pilar_token_pack_purchases: {
        data: [
          { empresa_id: "e2", valor_centavos: 5000, paid_at: AGORA },
          { empresa_id: "e2", valor_centavos: 2500, paid_at: AGORA },
          { empresa_id: "e1", valor_centavos: 9999, paid_at: ANTIGO },
          { empresa_id: "e1", valor_centavos: 9999, paid_at: null },
        ],
      },
      v_uso_tokens_anomalia_diaria: {
        data: [{ empresa_id: "e1", tokens_hoje: 50000, media_dias_anteriores: 2000, anomalia: true }],
      },
    });

    const { result } = renderHook(() => useCustosIa(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const { porEmpresa, porAgente, totais } = result.current.data!;

    expect(porEmpresa).toHaveLength(3);
    const [alfa, beta, e3] = porEmpresa;
    expect(alfa).toMatchObject({
      empresaNome: "Alfa",
      planoNome: "Pro",
      chamadas: 10,
      tokensTotal: 1500,
      custo: 11,
      receita: 400,
      margem: 389,
      tokensHoje: 50000,
      mediaAnteriorGasto: 2000,
      anomaliaGasto: true,
    });
    // Convidada com pacote pago: receita só do pacote.
    expect(beta).toMatchObject({
      planoNome: "Starter",
      custo: 0,
      tokensTotal: 100,
      receita: 75,
      margem: 75,
      anomaliaGasto: false,
    });
    // Sem nome conhecido e assinatura cancelada: sem plano e sem receita.
    expect(e3).toMatchObject({ empresaNome: "e3", planoNome: null, receita: null, margem: null, tokensHoje: 0 });

    expect(porAgente).toEqual([
      { agentKey: "financeiro", chamadas: 7, tokensTotal: 160, custo: 11 },
      { agentKey: "propostas", chamadas: 1, tokensTotal: 2, custo: 0 },
    ]);
    expect(totais).toEqual({ custo: 11, chamadas: 8, tokens: 162, receita: 475, anomalias: 1 });

    expect(chain.from.calls.find((c) => c.table === "pilar_token_pack_purchases")!.filters).toContainEqual([
      "eq",
      "status",
      "paid",
    ]);
  });

  it("tudo vazio dá totais zerados", async () => {
    h.resolve = () => ({ data: null });
    const { result } = renderHook(() => useCustosIa(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      porEmpresa: [],
      porAgente: [],
      totais: { custo: 0, chamadas: 0, tokens: 0, receita: 0, anomalias: 0 },
    });
  });

  it("erro em qualquer leitura falha a query", async () => {
    tabelas({ v_uso_tokens_anomalia_diaria: { data: null, error: new Error("view ausente") } });
    const { result } = renderHook(() => useCustosIa(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("view ausente");
  });
});

describe("useUltimasRequisicoes", () => {
  it("mapeia o ledger de uso, com nome da empresa e custo em reais", async () => {
    tabelas({
      ai_token_ledger: {
        data: [
          {
            id: "l1",
            created_at: "q1",
            empresa_id: "e1",
            agent_key: "chat",
            model: "m",
            tokens_input: 10,
            tokens_output: 5,
            custo_estimado: 0.001,
          },
          {
            id: "l2",
            created_at: "q2",
            empresa_id: "eX",
            agent_key: "chat",
            model: null,
            tokens_input: 1,
            tokens_output: 1,
            custo_estimado: null,
          },
        ],
      },
      empresas: { data: [{ id: "e1", nome: "Alfa" }] },
    });
    const { result } = renderHook(() => useUltimasRequisicoes(10), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data![0]).toMatchObject({
      empresaNome: "Alfa",
      custo: 0.0055,
      tokensInput: 10,
      tokensOutput: 5,
    });
    expect(result.current.data![1]).toMatchObject({ empresaNome: "eX", custo: 0, model: null });
    const q = chain.from.calls.find((c) => c.table === "ai_token_ledger")!;
    expect(q.filters).toContainEqual(["eq", "source", "usage"]);
    expect(q.filters).toContainEqual(["limit", 10]);
  });

  it("erro no ledger ou nas empresas propaga", async () => {
    tabelas({ empresas: { data: null, error: new Error("empresas") } });
    const a = renderHook(() => useUltimasRequisicoes(), { wrapper });
    await waitFor(() => expect(a.result.current.isError).toBe(true));
    expect((a.result.current.error as Error).message).toBe("empresas");

    tabelas({ ai_token_ledger: { data: null, error: new Error("ledger") } });
    const b = renderHook(() => useUltimasRequisicoes(5), { wrapper });
    await waitFor(() => expect(b.result.current.isError).toBe(true));
    expect((b.result.current.error as Error).message).toBe("ledger");
  });
});
