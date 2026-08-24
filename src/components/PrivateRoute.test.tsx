import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { signOut: vi.fn() },
    from: vi.fn(() => ({
      select: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: null })) })),
    })),
  },
}));

import { PrivateRoute } from "./PrivateRoute";

function renderWithRouter(initialRoute = "/inicio") {
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

const baseAuth = {
  user: null,
  signOut: vi.fn(),
  refreshProfile: vi.fn(),
  mfaChallengeRequired: false,
  hasVerifiedMfaFactor: false,
};

describe("PrivateRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially", () => {
    mockUseAuth.mockReturnValue({ ...baseAuth, isAuthenticated: false, profile: null, loading: true });
    renderWithRouter();
    expect(screen.getByText("Carregando...")).toBeInTheDocument();
  });

  it("redirects to landing when not authenticated", async () => {
    mockUseAuth.mockReturnValue({ ...baseAuth, isAuthenticated: false, profile: null, loading: false });
    renderWithRouter();

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

    renderWithRouter();

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

    renderWithRouter();

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

    renderWithRouter();

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

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId("layout")).toBeInTheDocument();
    });
  });
});
