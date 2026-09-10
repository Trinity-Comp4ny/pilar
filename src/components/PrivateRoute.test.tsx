import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ComponentType } from "react";
import type { ProfileWithEmpresa } from "@/contexts/AuthContext";

const mockUseAuth = vi.fn<
  () => {
    isAuthenticated: boolean;
    profile: ProfileWithEmpresa | null;
    loading: boolean;
    user: null;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
  }
>();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("./Layout", () => ({
  default: () => <div data-testid="layout">Layout</div>,
}));

vi.mock("@/contexts/SettingsModalContext", () => ({
  useSettingsModal: () => ({ openSettings: vi.fn() }),
}));

// Mutado por teste antes de importar o componente (ver renderPrivateRoute).
let mockSubStatus: { status: string | null } | null = null;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { signOut: vi.fn() },
    from: vi.fn(() => ({
      select: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: mockSubStatus })) })),
    })),
  },
}));

const baseAuth = {
  user: null,
  signOut: vi.fn(),
  refreshProfile: vi.fn(),
  mfaChallengeRequired: false,
  hasVerifiedMfaFactor: false,
};

// PrivateRoute cacheia subStatus num módulo-singleton (subStatusCache) pra
// não reconsultar a cada navegação. Isso vaza entre testes se o componente
// for importado uma vez só: resetModules + reimport a cada teste garante
// cache limpo, coerente com o mockSubStatus que cada teste define antes.
async function renderPrivateRoute(initialRoute = "/inicio") {
  vi.resetModules();
  const { PrivateRoute } = (await import("./PrivateRoute")) as { PrivateRoute: ComponentType };

  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/" element={<div data-testid="landing">Landing</div>} />
        <Route element={<PrivateRoute />}>
          <Route path="/inicio" element={<div data-testid="inicio">Início</div>} />
          <Route path="/profile-setup" element={<div data-testid="profile-setup">Profile Setup</div>} />
          <Route path="/company-setup" element={<div data-testid="company-setup">Company Setup</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("PrivateRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubStatus = null;
  });

  it("shows loading state initially", async () => {
    mockUseAuth.mockReturnValue({ ...baseAuth, isAuthenticated: false, profile: null, loading: true });
    await renderPrivateRoute();
    expect(screen.getByText("Carregando...")).toBeInTheDocument();
  });

  it("redirects to landing when not authenticated", async () => {
    mockUseAuth.mockReturnValue({ ...baseAuth, isAuthenticated: false, profile: null, loading: false });
    await renderPrivateRoute();

    await waitFor(() => {
      expect(screen.getByTestId("landing")).toBeInTheDocument();
    });
  });

  it("renders layout when authenticated with complete profile", async () => {
    mockUseAuth.mockReturnValue({
      ...baseAuth,
      isAuthenticated: true,
      loading: false,
      profile: {
        id: "user-123",
        nome: "João Silva",
        email: "joao@test.com",
        contato: "(11) 99999-9999",
        role: "user",
        onboarding_completed: true,
        empresas: { onboarding_completed: true } as ProfileWithEmpresa["empresas"],
      } as ProfileWithEmpresa,
    });

    await renderPrivateRoute();

    await waitFor(() => {
      expect(screen.getByTestId("layout")).toBeInTheDocument();
    });
  });

  it("redirects to profile-setup when onboarding not completed", async () => {
    mockUseAuth.mockReturnValue({
      ...baseAuth,
      isAuthenticated: true,
      loading: false,
      profile: {
        id: "user-123",
        nome: "test@email.com",
        email: "test@email.com",
        contato: null,
        role: "user",
        onboarding_completed: false,
        empresas: { onboarding_completed: true } as ProfileWithEmpresa["empresas"],
      } as ProfileWithEmpresa,
    });

    await renderPrivateRoute();

    await waitFor(() => {
      expect(screen.getByTestId("profile-setup")).toBeInTheDocument();
    });
  });

  it("redirects admin to company-setup when company onboarding not completed", async () => {
    mockUseAuth.mockReturnValue({
      ...baseAuth,
      isAuthenticated: true,
      loading: false,
      profile: {
        id: "user-123",
        nome: "Admin User",
        email: "admin@test.com",
        contato: "(11) 99999-9999",
        role: "admin",
        onboarding_completed: true,
        empresas: { onboarding_completed: false } as ProfileWithEmpresa["empresas"],
      } as ProfileWithEmpresa,
    });

    await renderPrivateRoute();

    await waitFor(() => {
      expect(screen.getByTestId("company-setup")).toBeInTheDocument();
    });
  });

  it("não empurra para /mfa/setup quem não tem MFA ativo (ADR 0031)", async () => {
    mockUseAuth.mockReturnValue({
      ...baseAuth,
      isAuthenticated: true,
      loading: false,
      profile: {
        id: "user-123",
        nome: "Rafael",
        email: "rafael@empresa.com",
        contato: "(11) 99999-9999",
        role: "admin",
        onboarding_completed: true,
        empresas: { onboarding_completed: true } as ProfileWithEmpresa["empresas"],
      } as ProfileWithEmpresa,
    });

    await renderPrivateRoute();

    await waitFor(() => {
      expect(screen.getByTestId("layout")).toBeInTheDocument();
    });
  });

  it("bloqueia acesso total quando expired sem leitura_desde (nunca entrou em modo leitura)", async () => {
    mockSubStatus = { status: "expired" };
    mockUseAuth.mockReturnValue({
      ...baseAuth,
      isAuthenticated: true,
      loading: false,
      profile: {
        id: "user-123",
        nome: "Admin User",
        email: "admin@test.com",
        contato: "(11) 99999-9999",
        role: "admin",
        onboarding_completed: true,
        empresas: { onboarding_completed: true, leitura_desde: null } as ProfileWithEmpresa["empresas"],
      } as ProfileWithEmpresa,
    });

    await renderPrivateRoute();

    await waitFor(() => {
      expect(screen.getByText("Acesso suspenso")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("layout")).not.toBeInTheDocument();
  });

  it("SPEC 098 Fase 3: expired com leitura_desde renderiza Layout com banner de somente leitura", async () => {
    mockSubStatus = { status: "expired" };
    mockUseAuth.mockReturnValue({
      ...baseAuth,
      isAuthenticated: true,
      loading: false,
      profile: {
        id: "user-123",
        nome: "Admin User",
        email: "admin@test.com",
        contato: "(11) 99999-9999",
        role: "admin",
        onboarding_completed: true,
        empresas: {
          onboarding_completed: true,
          leitura_desde: "2026-06-01T00:00:00Z",
        } as ProfileWithEmpresa["empresas"],
      } as ProfileWithEmpresa,
    });

    await renderPrivateRoute();

    await waitFor(() => {
      expect(screen.getByTestId("layout")).toBeInTheDocument();
    });
    expect(screen.getByText("Somente leitura: o período de teste acabou")).toBeInTheDocument();
  });
});
