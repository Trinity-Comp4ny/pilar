import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { sb } from "@/pages/financeiro/testing/supabaseMock";

// Última execução de um cron agêntico: a UI usa para distinguir "não achou nada"
// de "está parado há dias".

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/financeiro/testing/supabaseMock")).sb.client,
}));

import { useAgentHeartbeat } from "./useAgentHeartbeat";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  sb.reset();
});

describe("useAgentHeartbeat", () => {
  it("lê o heartbeat do agente pedido", async () => {
    const hb = { agent_type: "guardiao_margem_cron", last_run_at: "2026-11-07T10:00:00Z", last_status: "ok" };
    sb.resultado("agent_cron_heartbeats.select", { data: hb, error: null });
    const { result } = renderHook(() => useAgentHeartbeat("guardiao_margem_cron"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(hb);
    expect(sb.de("agent_cron_heartbeats", "eq")[0].args).toEqual(["agent_type", "guardiao_margem_cron"]);
  });

  it("agente que nunca rodou devolve null", async () => {
    sb.resultado("agent_cron_heartbeats.select", { data: null, error: null });
    const { result } = renderHook(() => useAgentHeartbeat("x"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("erro do banco vira erro da query", async () => {
    sb.resultado("agent_cron_heartbeats.select", { data: null, error: { message: "rls" } });
    const { result } = renderHook(() => useAgentHeartbeat("x"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
