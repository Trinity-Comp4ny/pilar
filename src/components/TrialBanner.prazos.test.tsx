// Contagem regressiva do teste grátis (SPEC 104): quando o aviso aparece, o texto de
// cada prazo e o atalho para ativar o plano.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ProfileWithEmpresa } from "@/contexts/AuthContext";

const mockUseAuth = vi.fn();
const openSettings = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("@/contexts/SettingsModalContext", () => ({ useSettingsModal: () => ({ openSettings }) }));

let resposta: { data: unknown; error: unknown } = { data: null, error: null };
const mockFrom = vi.fn(() => ({
  select: vi.fn(() => ({
    eq: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve(resposta)) })),
  })),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...(args as [])) },
}));

import { TrialBanner } from "./TrialBanner";

const HORA = 60 * 60 * 1000;
const emHoras = (h: number) => new Date(Date.now() + h * HORA).toISOString();

function renderBanner(subscription: unknown, profile: Partial<ProfileWithEmpresa> = { empresa_id: "e1" }) {
  resposta = { data: subscription, error: null };
  mockUseAuth.mockReturnValue({ profile });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TrialBanner />
    </QueryClientProvider>
  );
}

describe("TrialBanner: prazos do teste", () => {
  beforeEach(() => vi.clearAllMocks());

  it("assinatura ativa não mostra aviso nenhum", async () => {
    const { container } = renderBanner({ status: "active", trial_ends_at: emHoras(24) });
    await waitFor(() => expect(mockFrom).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("teste com mais de 7 dias restantes ainda não avisa", async () => {
    const { container } = renderBanner({ status: "trialing", trial_ends_at: emHoras(10 * 24) });
    await waitFor(() => expect(mockFrom).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("faltando alguns dias mostra a contagem em dias", async () => {
    renderBanner({ status: "trialing", trial_ends_at: emHoras(5 * 24 + 2) });
    expect(await screen.findByText("Seu teste grátis termina em 5 dias.")).toBeInTheDocument();
  });

  it("faltando um dia avisa que termina amanhã", async () => {
    renderBanner({ status: "trialing", trial_ends_at: emHoras(24 + 2) });
    expect(await screen.findByText("Seu teste grátis termina amanhã.")).toBeInTheDocument();
  });

  it("no último dia avisa que termina hoje", async () => {
    renderBanner({ status: "trialing", trial_ends_at: emHoras(3) });
    expect(await screen.findByText("Seu teste grátis termina hoje.")).toBeInTheDocument();
  });

  it("'Ativar plano' abre o painel de pagamento", async () => {
    renderBanner({ status: "trialing", trial_ends_at: emHoras(3) });
    await userEvent.click(await screen.findByRole("button", { name: "Ativar plano →" }));
    expect(openSettings).toHaveBeenCalledWith("pagamento");
  });

  it("teste em andamento sem data de fim não mostra contagem", async () => {
    const { container } = renderBanner({ status: "trialing", trial_ends_at: null });
    await waitFor(() => expect(mockFrom).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it.each(["overdue", "canceled"])("status %s não usa o aviso de teste", async (status) => {
    const { container } = renderBanner({ status, trial_ends_at: emHoras(3) });
    await waitFor(() => expect(mockFrom).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("bloqueio de teste vencido leva direto ao pagamento", async () => {
    renderBanner(
      { status: "expired", trial_ends_at: null },
      { empresa_id: "e1", empresas: { leitura_desde: null } as ProfileWithEmpresa["empresas"] }
    );
    await userEvent.click(await screen.findByRole("button", { name: "Assinar para continuar →" }));
    expect(openSettings).toHaveBeenCalledWith("pagamento");
  });

  it("sem empresa no perfil não consulta assinatura", async () => {
    const { container } = renderBanner({ status: "trialing", trial_ends_at: emHoras(3) }, { empresa_id: null });
    expect(container).toBeEmptyDOMElement();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("erro ao consultar a assinatura não mostra aviso nem quebra a tela", async () => {
    resposta = { data: null, error: { message: "falhou" } };
    mockUseAuth.mockReturnValue({ profile: { empresa_id: "e1" } });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={qc}>
        <TrialBanner />
      </QueryClientProvider>
    );
    await waitFor(() => expect(mockFrom).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
