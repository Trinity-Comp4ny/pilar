import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const h = vi.hoisted(() => ({
  profile: { empresa_id: "emp-1", role: "admin" } as { empresa_id?: string | null; role?: string } | null,
  maybeSingle: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...a: unknown[]) => {
      h.rpc(...a);
      return { maybeSingle: h.maybeSingle };
    },
  },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ profile: h.profile }) }));

import { useNivelConfianca } from "./useNivelConfianca";

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  vi.clearAllMocks();
  h.profile = { empresa_id: "emp-1", role: "admin" };
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

describe("useNivelConfianca", () => {
  it("mapeia os limites da RPC", async () => {
    h.maybeSingle.mockResolvedValue({
      data: {
        max_projetos: 5,
        max_obras: null,
        max_leads: 10,
        max_usuarios: 3,
        tokens_total: 1000,
        portal_habilitado: true,
        import_habilitado: false,
      },
      error: null,
    });
    const { result } = renderHook(() => useNivelConfianca(), { wrapper });
    await waitFor(() => expect(result.current.limites).not.toBeNull());
    expect(result.current.limites).toEqual({
      maxProjetos: 5,
      maxObras: null,
      maxLeads: 10,
      maxUsuarios: 3,
      tokensTotal: 1000,
      portalHabilitado: true,
      importHabilitado: false,
    });
    expect(h.rpc).toHaveBeenCalledWith("limites_empresa", { p_empresa_id: "emp-1" });
    expect(result.current.isAdmin).toBe(true);
  });

  it("sem linha: limites nulos", async () => {
    h.maybeSingle.mockResolvedValue({ data: null, error: null });
    const { result } = renderHook(() => useNivelConfianca(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.limites).toBeNull();
  });

  it("erro na RPC: limites nulos", async () => {
    h.maybeSingle.mockResolvedValue({ data: null, error: { message: "permission denied" } });
    const { result } = renderHook(() => useNivelConfianca(), { wrapper });
    await waitFor(() => expect(client.getQueryCache().getAll()[0]?.state.status).toBe("error"));
    expect(result.current.limites).toBeNull();
  });

  it("sem empresa não consulta; ultra_admin é admin; usuário comum não", () => {
    h.profile = { empresa_id: null, role: "ultra_admin" };
    const ultra = renderHook(() => useNivelConfianca(), { wrapper });
    expect(ultra.result.current.isAdmin).toBe(true);
    expect(h.rpc).not.toHaveBeenCalled();

    h.profile = null;
    const semProfile = renderHook(() => useNivelConfianca(), { wrapper });
    expect(semProfile.result.current.isAdmin).toBe(false);
    expect(semProfile.result.current.limites).toBeNull();
  });
});
