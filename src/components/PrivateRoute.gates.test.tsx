import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ComponentType } from "react";

/**
 * Lacunas do PrivateRoute não cobertas em PrivateRoute.test.tsx: tela de
 * suspensão por perfil, ultra-admin pós-login, falha da consulta de assinatura,
 * rotas de onboarding já concluídas e o bypass de MFA local.
 */

const { authState, subResult, openSettings, signOut, captureException, bypass } = vi.hoisted(() => ({
  authState: {
    isAuthenticated: true,
    loading: false,
    mfaChallengeRequired: false,
    profile: null as null | Record<string, unknown>,
  },
  subResult: { value: { data: null, error: null } as { data: unknown; error: unknown } },
  openSettings: vi.fn(),
  signOut: vi.fn(),
  captureException: vi.fn(),
  bypass: { value: false },
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => authState }));
vi.mock("@/contexts/SettingsModalContext", () => ({ useSettingsModal: () => ({ openSettings }) }));
vi.mock("./Layout", () => ({ default: () => <div data-testid="layout">Layout</div> }));
vi.mock("@/lib/monitoring", () => ({ monitoring: { captureException } }));
vi.mock("@/lib/mfaDevBypass", () => ({ mfaDevBypass: () => bypass.value }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { signOut },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve(subResult.value) }) }),
    }),
  },
}));

function perfil(role: string, extra: Record<string, unknown> = {}) {
  return {
    id: "u1",
    empresa_id: "e1",
    role,
    onboarding_completed: true,
    empresas: { onboarding_completed: true, nome: "Escritório Seed" },
    ...extra,
  };
}

async function renderAt(path: string) {
  vi.resetModules();
  const { PrivateRoute } = (await import("./PrivateRoute")) as { PrivateRoute: ComponentType };
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<div data-testid="landing" />} />
        <Route element={<PrivateRoute />}>
          <Route path="/inicio" element={<div />} />
          <Route path="/financeiro" element={<div />} />
          <Route path="/profile-setup" element={<div data-testid="profile-setup" />} />
          <Route path="/company-setup" element={<div data-testid="company-setup" />} />
          <Route path="/mfa" element={<div data-testid="mfa" />} />
          <Route path="/mfa/setup" element={<div data-testid="mfa-setup" />} />
        </Route>
        <Route path="/ultra-admin" element={<div data-testid="ultra" />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  bypass.value = false;
  authState.isAuthenticated = true;
  authState.loading = false;
  authState.mfaChallengeRequired = false;
  authState.profile = perfil("colaborador");
  subResult.value = { data: { status: "active", current_period_end: null }, error: null };
});

describe("PrivateRoute: assinatura suspensa", () => {
  it("não-admin vê orientação para falar com o admin e não tem atalho de pagamento", async () => {
    subResult.value = { data: { status: "canceled", current_period_end: null }, error: null };
    await renderAt("/inicio");
    expect(await screen.findByText("Acesso suspenso")).toBeInTheDocument();
    expect(screen.getByText(/Fale com o administrador da sua empresa/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver assinatura" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("layout")).not.toBeInTheDocument();
  });

  it("admin vê o atalho que abre o painel de pagamento", async () => {
    authState.profile = perfil("admin");
    subResult.value = { data: { status: "canceled", current_period_end: null }, error: null };
    await renderAt("/inicio");
    await userEvent.setup().click(await screen.findByRole("button", { name: "Ver assinatura" }));
    expect(openSettings).toHaveBeenCalledWith("pagamento");
  });

  it("Sair da conta encerra a sessão", async () => {
    subResult.value = { data: { status: "canceled", current_period_end: null }, error: null };
    await renderAt("/inicio");
    await userEvent.setup().click(await screen.findByRole("link", { name: "Sair da conta" }));
    expect(signOut).toHaveBeenCalled();
    expect(await screen.findByTestId("landing")).toBeInTheDocument();
  });

  it("falha transitória na consulta não bloqueia, mas é reportada", async () => {
    subResult.value = { data: null, error: { message: "timeout" } };
    await renderAt("/inicio");
    expect(await screen.findByTestId("layout")).toBeInTheDocument();
    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: "timeout" }),
      expect.objectContaining({ context: "subscription-gate" })
    );
  });
});

describe("PrivateRoute: onboarding e MFA", () => {
  it("não-admin com perfil completo em /company-setup volta ao início", async () => {
    await renderAt("/company-setup");
    expect(await screen.findByTestId("layout")).toBeInTheDocument();
    expect(screen.queryByTestId("company-setup")).not.toBeInTheDocument();
  });

  it("não-admin com empresa sem onboarding NÃO é mandado ao setup da empresa", async () => {
    authState.profile = perfil("colaborador", { empresas: { onboarding_completed: false } });
    await renderAt("/inicio");
    expect(await screen.findByTestId("layout")).toBeInTheDocument();
  });

  it("admin com perfil incompleto vai primeiro ao profile-setup", async () => {
    authState.profile = perfil("admin", { onboarding_completed: false, empresas: { onboarding_completed: false } });
    await renderAt("/inicio");
    expect(await screen.findByTestId("profile-setup")).toBeInTheDocument();
  });

  it("desafio MFA pendente bloqueia qualquer rota interna", async () => {
    authState.mfaChallengeRequired = true;
    await renderAt("/financeiro");
    expect(await screen.findByTestId("mfa")).toBeInTheDocument();
    expect(screen.queryByTestId("layout")).not.toBeInTheDocument();
  });

  it("com bypass de MFA local o desafio não bloqueia", async () => {
    bypass.value = true;
    authState.mfaChallengeRequired = true;
    await renderAt("/inicio");
    expect(await screen.findByTestId("layout")).toBeInTheDocument();
  });

  it("/mfa/setup fica acessível mesmo com onboarding pendente", async () => {
    authState.profile = perfil("colaborador", { onboarding_completed: false });
    await renderAt("/mfa/setup");
    expect(await screen.findByTestId("mfa-setup")).toBeInTheDocument();
  });
});

describe("PrivateRoute: ultra-admin", () => {
  it("logo após o login vai para /ultra-admin (uma vez)", async () => {
    authState.profile = perfil("ultra_admin");
    sessionStorage.setItem("pilar_post_login", "1");
    await renderAt("/inicio");
    expect(await screen.findByTestId("ultra")).toBeInTheDocument();
    expect(sessionStorage.getItem("pilar_post_login")).toBeNull();
  });

  it("usuário comum com a mesma marca de pós-login fica no início", async () => {
    sessionStorage.setItem("pilar_post_login", "1");
    await renderAt("/inicio");
    expect(await screen.findByTestId("layout")).toBeInTheDocument();
    expect(screen.queryByTestId("ultra")).not.toBeInTheDocument();
  });
});
