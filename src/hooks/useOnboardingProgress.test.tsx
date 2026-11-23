import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const from = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: unknown[]) => from(...a) } }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ profile: { empresa_id: "e1", avatar_url: null, empresas: {} } }),
}));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => true, isAdmin: true }) }));

const estado = { dismissed: false };
vi.mock("@/hooks/useOnboardingState", () => ({ useOnboardingState: () => ({ state: estado }) }));
let depoisDaPintura = true;
vi.mock("@/hooks/useAposPrimeiraPintura", () => ({ useAposPrimeiraPintura: () => depoisDaPintura }));

import { useOnboardingProgress } from "./useOnboardingProgress";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function consultaDeContagem() {
  const q: Record<string, unknown> = {};
  q.eq = () => q;
  q.is = () => q;
  q.then = (ok: (v: unknown) => unknown) => Promise.resolve({ count: 1, error: null }).then(ok);
  return { select: () => q };
}

describe("useOnboardingProgress: contagens fora do caminho crítico", () => {
  beforeEach(() => {
    from.mockReset();
    from.mockImplementation(() => consultaDeContagem());
    estado.dismissed = false;
    depoisDaPintura = true;
  });

  it("não conta nada antes da primeira pintura e segue 'carregando'", () => {
    depoisDaPintura = false;
    const { result } = renderHook(() => useOnboardingProgress(), { wrapper });
    expect(from).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(true);
  });

  it("conta depois da pintura", async () => {
    renderHook(() => useOnboardingProgress(), { wrapper });
    await waitFor(() => expect(from).toHaveBeenCalled());
  });

  it("não conta quando o onboarding foi dispensado", () => {
    estado.dismissed = true;
    const { result } = renderHook(() => useOnboardingProgress(), { wrapper });
    expect(from).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it("conta mesmo dispensado quando o consumidor pede (Configurações > Conta)", async () => {
    estado.dismissed = true;
    renderHook(() => useOnboardingProgress({ mesmoDispensado: true }), { wrapper });
    await waitFor(() => expect(from).toHaveBeenCalled());
  });
});
