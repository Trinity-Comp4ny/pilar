// Aba Pagamento das configurações: o que cada status de assinatura mostra, quem pode
// agir (só admin) e quais ações ficam travadas em teste, vencida ou cancelada.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { MySubscription } from "@/pages/billing/hooks/useMySubscription";
import type { Plan } from "@/hooks/usePlans";

const { estado } = vi.hoisted(() => ({
  estado: {
    role: "admin" as string | null,
    sub: { data: null as unknown, isLoading: false, error: null as unknown },
  },
}));

vi.mock("@/hooks/useUserRole", () => ({ useUserRole: () => ({ data: estado.role }) }));
vi.mock("@/pages/billing/hooks/useMySubscription", () => ({ useMySubscription: () => estado.sub }));
vi.mock("@/contexts/SettingsModalContext", () => ({ useSettingsModal: () => ({ closeSettings: vi.fn() }) }));
// Os diálogos têm teste próprio; aqui só importa se abrem.
vi.mock("@/pages/billing/components/ChangePlanDialog", () => ({
  ChangePlanDialog: ({ open }: { open: boolean }) => (open ? <div>diálogo mudar plano</div> : null),
}));
vi.mock("@/pages/billing/components/CancelDialog", () => ({
  CancelDialog: ({ open }: { open: boolean }) => (open ? <div>diálogo cancelar</div> : null),
}));
vi.mock("@/components/trial/AtivarPlano", () => ({
  AtivarPlano: ({ open }: { open: boolean }) => (open ? <div>diálogo ativar plano</div> : null),
}));

import { PagamentoPanel } from "./PagamentoPanel";

const PLANO: Plan = {
  id: "p-pro",
  slug: "pro",
  nome: "Profissional",
  descricao: "Para escritórios em crescimento",
  preco_mensal: 499,
  preco_anual: 4990,
  max_usuarios: null,
  max_projetos: 30,
  max_obras: 5,
  max_leads: 200,
  tokens_mensais: 2_000_000,
  features: ["Portal do cliente"],
  destaque: true,
  ordem: 2,
};

function assinatura(over: Partial<MySubscription> = {}): MySubscription {
  return {
    id: "s1",
    empresa_id: "e1",
    plan_id: "p-pro",
    status: "active",
    billing_cycle: "monthly",
    billing_type: "CREDIT_CARD",
    trial_ends_at: null,
    current_period_start: "2026-11-01T12:00:00.000Z",
    current_period_end: "2026-12-01T12:00:00.000Z",
    canceled_at: null,
    created_at: "2026-10-01T12:00:00.000Z",
    asaas_subscription_id: "sub_1",
    plan: PLANO,
    ...over,
  };
}

function abrir(sub: MySubscription | null, role: string | null = "admin") {
  estado.role = role;
  estado.sub = { data: sub, isLoading: false, error: null };
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <PagamentoPanel />
    </QueryClientProvider>
  );
}

const botao = (nome: string | RegExp) => screen.getByRole("button", { name: nome });

describe("PagamentoPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("erro ao carregar mostra aviso e nenhuma ação", () => {
    estado.role = "admin";
    estado.sub = { data: undefined, isLoading: false, error: new Error("falhou") };
    render(
      <QueryClientProvider client={new QueryClient()}>
        <PagamentoPanel />
      </QueryClientProvider>
    );
    expect(screen.getByText("Erro ao carregar assinatura. Tente recarregar.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cancelar assinatura/ })).not.toBeInTheDocument();
    // Erro não pode virar "empresa convidada".
    expect(screen.queryByText("Empresa convidada")).not.toBeInTheDocument();
  });

  it("ativa sem Asaas é convidada: sem preço nem ações de cobrança", () => {
    abrir(assinatura({ asaas_subscription_id: null }));
    expect(screen.getByText("Empresa convidada")).toBeInTheDocument();
    expect(screen.getByText("Pilar Profissional, sem cobrança")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cancelar assinatura/ })).not.toBeInTheDocument();
  });

  it("ativa paga: mostra plano, valor mensal e libera mudar e cancelar para o admin", async () => {
    abrir(assinatura());
    expect(screen.getByText("Pilar Profissional")).toBeInTheDocument();
    expect(screen.getByText("R$ 499,00")).toBeInTheDocument();
    expect(screen.getByText("/mês")).toBeInTheDocument();
    expect(screen.getByText("Cartão de crédito")).toBeInTheDocument();
    await userEvent.click(botao(/Mudar plano/));
    expect(screen.getByText("diálogo mudar plano")).toBeInTheDocument();
    await userEvent.click(botao("Cancelar assinatura"));
    expect(screen.getByText("diálogo cancelar")).toBeInTheDocument();
  });

  it("ciclo anual mostra o preço anual por ano", () => {
    abrir(assinatura({ billing_cycle: "yearly" }));
    expect(screen.getByText("R$ 4.990,00")).toBeInTheDocument();
    expect(screen.getByText("/ano")).toBeInTheDocument();
  });

  it("não admin vê o plano mas não tem nenhuma ação de cobrança", () => {
    abrir(assinatura(), "colaborador");
    expect(screen.getByText("Apenas o admin da empresa pode gerenciar a assinatura.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mudar plano/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar assinatura" })).not.toBeInTheDocument();
  });

  it("em atraso: aviso para regularizar, ações seguem liberadas", () => {
    abrir(assinatura({ status: "overdue" }));
    expect(screen.getByText("Pagamento em atraso.")).toBeInTheDocument();
    expect(botao("Cancelar assinatura")).toBeEnabled();
  });

  it.each(["trialing", "expired", "canceled"] as const)("%s: mudar plano e cancelar ficam travados", (status) => {
    abrir(assinatura({ status, trial_ends_at: "2026-11-10T12:00:00.000Z" }));
    expect(botao(/Mudar plano/)).toBeDisabled();
    expect(botao("Cancelar assinatura")).toBeDisabled();
  });

  it("em teste, o admin pode ativar o plano antes do fim", async () => {
    abrir(assinatura({ status: "trialing", trial_ends_at: "2026-11-10T12:00:00.000Z" }));
    expect(screen.getByText("Você está no teste grátis.")).toBeInTheDocument();
    await userEvent.click(botao("Ativar plano"));
    expect(screen.getByText("diálogo ativar plano")).toBeInTheDocument();
  });

  it("em teste, não admin não vê o convite para ativar", () => {
    abrir(assinatura({ status: "trialing", trial_ends_at: "2026-11-10T12:00:00.000Z" }), "colaborador");
    expect(screen.queryByText("Você está no teste grátis.")).not.toBeInTheDocument();
  });

  it("teste vencido: admin assina agora; não admin é orientado a pedir ao admin", async () => {
    const { unmount } = abrir(assinatura({ status: "expired" }));
    await userEvent.click(botao("Assinar agora"));
    expect(screen.getByText("diálogo ativar plano")).toBeInTheDocument();
    unmount();

    abrir(assinatura({ status: "expired" }), "colaborador");
    expect(screen.getByText(/Peça ao administrador da empresa para assinar\./)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Assinar agora" })).not.toBeInTheDocument();
  });

  it("cancelada: sem próxima cobrança; admin pode assinar de novo", async () => {
    abrir(assinatura({ status: "canceled" }));
    expect(screen.getByText("Assinatura cancelada.")).toBeInTheDocument();
    await userEvent.click(botao("Assinar de novo"));
    expect(screen.getByText("diálogo ativar plano")).toBeInTheDocument();
  });

  it("cancelada vista por não admin: sem botão de assinar", () => {
    abrir(assinatura({ status: "canceled" }), "colaborador");
    expect(screen.getByText(/Peça ao administrador da empresa para assinar de novo/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Assinar de novo" })).not.toBeInTheDocument();
  });
});
