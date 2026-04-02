import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

vi.mock("@/integrations/supabase/client", () => {
  const makeChainable = (resolvedData: any = { data: [], error: null, count: 0 }) => {
    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      gte: vi.fn(() => chain),
      lte: vi.fn(() => chain),
      in: vi.fn(() => chain),
      is: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      single: vi.fn(() => Promise.resolve(resolvedData)),
      then: (resolve: any) => resolve(resolvedData),
    };
    Object.defineProperty(chain, "data", { get: () => resolvedData.data });
    Object.defineProperty(chain, "error", { get: () => resolvedData.error });
    Object.defineProperty(chain, "count", { get: () => resolvedData.count ?? 0 });
    return chain;
  };

  const mockSupabase = {
    auth: { getUser: vi.fn() },
    from: vi.fn(() => makeChainable()),
    rpc: vi.fn().mockResolvedValue({ data: "empresa-1", error: null }),
  };
  return { supabase: mockSupabase };
});

vi.mock("@/lib/dateUtils", () => ({
  getDisplayDate: vi.fn((recebimento: string | null, vencimento: string | null) => recebimento || vencimento || null),
}));

vi.mock("@/constants", () => ({
  PROJECT_STATUS: { EM_ANDAMENTO: "Em andamento", PLANEJAMENTO: "Planejamento" },
  FINANCIAL_STATUS: { PENDENTE: "Pendente" },
  LEAD_STATUS: {
    NOVO: "Novo",
    EM_CONTATO: "Em contato",
    PROPOSTA: "Proposta",
    NEGOCIACAO: "Negociação",
    GANHO: "Ganho",
    PERDIDO: "Perdido",
  },
}));

import { useDashboardData } from "./useDashboardData";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useDashboardData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns default KPI structure when data is empty", async () => {
    const { result } = renderHook(() => useDashboardData(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const kpis = result.current.data?.kpis;
    expect(kpis).toBeDefined();
    expect(kpis?.receitaMes).toBe(0);
    expect(kpis?.despesaMes).toBe(0);
    expect(kpis?.saldoMes).toBe(0);
    expect(kpis?.projetosAtivos).toBe(0);
  });

  it("returns chart data and projetos arrays", async () => {
    const { result } = renderHook(() => useDashboardData(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(Array.isArray(result.current.data?.chartData)).toBe(true);
    expect(Array.isArray(result.current.data?.projetos)).toBe(true);
    expect(Array.isArray(result.current.data?.proximosVencimentos)).toBe(true);
    expect(Array.isArray(result.current.data?.leadsPipeline)).toBe(true);
    expect(Array.isArray(result.current.data?.alertas)).toBe(true);
  });
});
