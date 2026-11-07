// Gate de acesso por status da assinatura (SPEC 098/104, ADR 0042): quem entra,
// quem vê a tela de acesso suspenso, quem entra em somente leitura e o que cada
// papel enxerga em cada caso.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ComponentType } from "react";
import type { ProfileWithEmpresa } from "@/contexts/AuthContext";

const mockUseAuth = vi.fn();
const openSettings = vi.fn();
const captureException = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("./AccountRecoveryScreen", () => ({ AccountRecoveryScreen: () => <div>Recuperação</div> }));
vi.mock("./Layout", () => ({ default: () => <div data-testid="layout">Layout</div> }));
vi.mock("@/contexts/SettingsModalContext", () => ({ useSettingsModal: () => ({ openSettings }) }));
vi.mock("@/lib/monitoring", () => ({ monitoring: { captureException: (...a: unknown[]) => captureException(...a) } }));

let resposta: { data: unknown; error: unknown } = { data: null, error: null };

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { signOut: vi.fn() },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve(resposta)) })),
      })),
    })),
  },
}));

const DIA = 24 * 60 * 60 * 1000;
const futuro = () => new Date(Date.now() + 10 * DIA).toISOString();
const passado = () => new Date(Date.now() - 1 * DIA).toISOString();

function perfil(role: string, leituraDesde: string | null = null): ProfileWithEmpresa {
  return {
    id: "user-1",
    empresa_id: "empresa-1",
    nome: "Pessoa",
    email: "pessoa@test.com",
    role,
    onboarding_completed: true,
    empresas: { onboarding_completed: true, leitura_desde: leituraDesde } as ProfileWithEmpresa["empresas"],
  } as ProfileWithEmpresa;
}

async function entrar(role: string, assinatura: unknown, leituraDesde: string | null = null, error: unknown = null) {
  resposta = { data: assinatura, error };
  mockUseAuth.mockReturnValue({
    isAuthenticated: true,
    loading: false,
    mfaChallengeRequired: false,
    profile: perfil(role, leituraDesde),
  });
  vi.resetModules();
  const { PrivateRoute } = (await import("./PrivateRoute")) as { PrivateRoute: ComponentType };
  return render(
    <MemoryRouter initialEntries={["/inicio"]}>
      <Routes>
        <Route element={<PrivateRoute />}>
          <Route path="/inicio" element={<div>Início</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("PrivateRoute: acesso por status da assinatura", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it.each(["active", "trialing"])("%s entra normalmente, sem banner de leitura", async (status) => {
    await entrar("user", { status, current_period_end: null });
    expect(await screen.findByTestId("layout")).toBeInTheDocument();
    expect(screen.queryByText(/Somente leitura/)).not.toBeInTheDocument();
  });

  it("em atraso (overdue) ainda entra: inadimplência não bloqueia na hora", async () => {
    await entrar("admin", { status: "overdue", current_period_end: passado() });
    expect(await screen.findByTestId("layout")).toBeInTheDocument();
    expect(screen.queryByText("Acesso suspenso")).not.toBeInTheDocument();
  });

  it("cancelada com período pago vigente mantém o acesso até o fim do período", async () => {
    await entrar("admin", { status: "canceled", current_period_end: futuro() });
    expect(await screen.findByTestId("layout")).toBeInTheDocument();
  });

  it("cancelada com período encerrado (ou estornada) mostra acesso suspenso", async () => {
    await entrar("admin", { status: "canceled", current_period_end: passado() });
    expect(await screen.findByText("Acesso suspenso")).toBeInTheDocument();
    expect(screen.queryByTestId("layout")).not.toBeInTheDocument();
  });

  it("admin suspenso vê o atalho para regularizar e ele abre o pagamento", async () => {
    await entrar("admin", { status: "canceled", current_period_end: null });
    await userEvent.click(await screen.findByRole("button", { name: "Ver assinatura" }));
    expect(openSettings).toHaveBeenCalledWith("pagamento");
  });

  it("não admin suspenso não vê o atalho de pagamento e é orientado a falar com o administrador", async () => {
    await entrar("colaborador", { status: "canceled", current_period_end: null });
    expect(await screen.findByText(/Fale com o administrador da sua empresa/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver assinatura" })).not.toBeInTheDocument();
  });

  it("teste vencido em modo leitura: admin vê o banner com 'Assinar agora'", async () => {
    await entrar("admin", { status: "expired", current_period_end: null }, "2026-10-01T00:00:00Z");
    expect(await screen.findByTestId("layout")).toBeInTheDocument();
    expect(screen.getByText("Somente leitura: o período de teste acabou")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Assinar agora" }));
    expect(openSettings).toHaveBeenCalledWith("pagamento");
  });

  it("teste vencido em modo leitura: não admin vê o banner, mas sem botão de assinar", async () => {
    await entrar("colaborador", { status: "expired", current_period_end: null }, "2026-10-01T00:00:00Z");
    expect(await screen.findByText("Somente leitura: o período de teste acabou")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Assinar agora" })).not.toBeInTheDocument();
  });

  it("empresa sem assinatura (convidada antiga) entra normalmente", async () => {
    await entrar("admin", null);
    expect(await screen.findByTestId("layout")).toBeInTheDocument();
  });

  it("falha ao consultar a assinatura reporta ao monitoramento e não trava o usuário na tela de carregamento", async () => {
    await entrar("admin", null, null, { message: "network down" });
    expect(await screen.findByTestId("layout")).toBeInTheDocument();
    expect(captureException).toHaveBeenCalledWith({ message: "network down" }, { context: "subscription-gate" });
  });
});
