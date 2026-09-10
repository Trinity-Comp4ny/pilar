import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ProfileWithEmpresa } from "@/contexts/AuthContext";

const mockUseAuth = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/contexts/SettingsModalContext", () => ({
  useSettingsModal: () => ({ openSettings: vi.fn() }),
}));

let mockSubscription: { status: string; trial_ends_at: string | null } | null = null;
const mockFrom = vi.fn(() => ({
  select: vi.fn(() => ({
    eq: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: mockSubscription, error: null })) })),
  })),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...(args as [])) },
}));

import { TrialBanner } from "./TrialBanner";

function renderBanner(profile: Partial<ProfileWithEmpresa>) {
  mockUseAuth.mockReturnValue({ profile });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TrialBanner />
    </QueryClientProvider>
  );
}

// SPEC 098 Fase 3 (ADR 0042): status expired sozinho não basta mais pra
// decidir bloqueio total — depende de leitura_desde, o mesmo sinal que o
// PrivateRoute usa pra liberar <Layout /> com o ReadOnlyBanner.
describe("TrialBanner", () => {
  it("não bloqueia a tela quando expired está em modo leitura (leitura_desde setado)", async () => {
    mockSubscription = { status: "expired", trial_ends_at: null };
    renderBanner({
      empresa_id: "empresa-1",
      empresas: { leitura_desde: "2026-06-01T00:00:00Z" } as ProfileWithEmpresa["empresas"],
    });

    await waitFor(() => expect(mockFrom).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText("Seu trial expirou")).not.toBeInTheDocument());
  });

  it("bloqueia a tela por completo quando expired sem leitura_desde", async () => {
    mockSubscription = { status: "expired", trial_ends_at: null };
    renderBanner({
      empresa_id: "empresa-1",
      empresas: { leitura_desde: null } as ProfileWithEmpresa["empresas"],
    });

    expect(await screen.findByText("Seu trial expirou")).toBeInTheDocument();
  });
});
