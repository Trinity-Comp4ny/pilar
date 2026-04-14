import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

vi.mock("@/integrations/supabase/client", () => {
  interface MockResolvedData {
    data: unknown[];
    error: null | { message: string };
    count?: number;
  }

  interface MockChain {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    gte: ReturnType<typeof vi.fn>;
    lte: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    is: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    then: (resolve: (value: MockResolvedData) => void) => void;
    readonly data: unknown[];
    readonly error: null | { message: string };
    readonly count: number;
  }

  const makeChainable = (resolvedData: MockResolvedData = { data: [], error: null, count: 0 }) => {
    const chain: MockChain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      gte: vi.fn(() => chain),
      lte: vi.fn(() => chain),
      in: vi.fn(() => chain),
      is: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      single: vi.fn(() => Promise.resolve(resolvedData)),
      then: (resolve: (value: MockResolvedData) => void) => resolve(resolvedData),
    } as MockChain;
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
