// Troca de plano e cancelamento pela tela de assinatura: o que vai para a edge
// pilar-subscription-manage, o retorno ao usuário em sucesso e em erro, e o botão
// travado enquanto a chamada corre (clique duplo não dispara duas vezes).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { MySubscription } from "../hooks/useMySubscription";
import type { Plan } from "@/hooks/usePlans";

const { invoke, toast, PLANOS } = vi.hoisted(() => {
  const plano = (slug: string, nome: string, mensal: number, anual: number | null): Plan => ({
    id: `id-${slug}`,
    slug,
    nome,
    descricao: null,
    preco_mensal: mensal,
    preco_anual: anual,
    max_usuarios: null,
    max_projetos: null,
    features: [],
    destaque: false,
    ordem: 0,
  });
  return {
    invoke: vi.fn(),
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
    PLANOS: [plano("essencial", "Essencial", 290, 2900), plano("pro", "Pro", 690, 6900)],
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));
vi.mock("sonner", () => ({ toast }));

vi.mock("@/hooks/usePlans", () => ({ usePlans: () => ({ data: PLANOS }) }));

import { ChangePlanDialog } from "./ChangePlanDialog";
import { CancelDialog } from "./CancelDialog";

const DIA = 24 * 60 * 60 * 1000;

function assinatura(over: Partial<MySubscription> = {}): MySubscription {
  return {
    id: "s1",
    empresa_id: "e1",
    plan_id: "id-essencial",
    status: "active",
    billing_cycle: "monthly",
    billing_type: "CREDIT_CARD",
    trial_ends_at: null,
    current_period_start: new Date(Date.now() - 20 * DIA).toISOString(),
    current_period_end: "2026-12-01T12:00:00.000Z",
    canceled_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    asaas_subscription_id: "sub_1",
    plan: PLANOS[0],
    ...over,
  };
}

function comQuery(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

/** Promessa que o teste resolve na hora que quiser (chamada "em voo"). */
function pendente<T>() {
  let resolver!: (v: T) => void;
  const promessa = new Promise<T>((r) => (resolver = r));
  return { promessa, resolver };
}

describe("ChangePlanDialog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("confirmar sem mudar plano nem ciclo avisa e não chama o servidor", async () => {
    comQuery(<ChangePlanDialog open onOpenChange={vi.fn()} current={assinatura()} />);
    await userEvent.click(screen.getByRole("button", { name: "Confirmar mudança" }));
    expect(toast.info).toHaveBeenCalledWith("Nenhuma alteração selecionada");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("trocar de plano manda o slug e o ciclo atual, avisa sucesso e fecha", async () => {
    invoke.mockResolvedValue({ data: { success: true }, error: null });
    const onOpenChange = vi.fn();
    comQuery(<ChangePlanDialog open onOpenChange={onOpenChange} current={assinatura()} />);
    await userEvent.click(screen.getByText("Pro"));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar mudança" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(invoke).toHaveBeenCalledWith("pilar-subscription-manage", {
      body: { action: "update_plan", new_plan_slug: "pro", new_cycle: "monthly" },
    });
    expect(toast.success).toHaveBeenCalledWith("Plano atualizado", expect.anything());
  });

  it("mudar só o ciclo (mesmo plano) também é uma troca válida", async () => {
    invoke.mockResolvedValue({ data: { success: true }, error: null });
    comQuery(<ChangePlanDialog open onOpenChange={vi.fn()} current={assinatura()} />);
    await userEvent.click(screen.getByRole("tab", { name: /anual/i }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar mudança" }));
    await waitFor(() => expect(invoke).toHaveBeenCalled());
    expect(invoke.mock.calls[0][1].body).toEqual({
      action: "update_plan",
      new_plan_slug: "essencial",
      new_cycle: "yearly",
    });
  });

  it("erro do servidor (ex.: Asaas recusou) mostra a mensagem e mantém o diálogo aberto", async () => {
    invoke.mockResolvedValue({ data: { success: false, error: "Falha ao atualizar: Asaas 500" }, error: null });
    const onOpenChange = vi.fn();
    comQuery(<ChangePlanDialog open onOpenChange={onOpenChange} current={assinatura()} />);
    await userEvent.click(screen.getByText("Pro"));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar mudança" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Erro ao trocar plano", {
        description: "Falha ao atualizar: Asaas 500",
      })
    );
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("falha de rede ou 403 (não admin) vira toast de erro, sem fechar", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: { message: "Apenas admin da empresa pode gerenciar a assinatura" },
    });
    const onOpenChange = vi.fn();
    comQuery(<ChangePlanDialog open onOpenChange={onOpenChange} current={assinatura()} />);
    await userEvent.click(screen.getByText("Pro"));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar mudança" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error.mock.calls[0][1].description).toBe("Apenas admin da empresa pode gerenciar a assinatura");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("enquanto a troca corre, os botões ficam travados (clique duplo não chama duas vezes)", async () => {
    const voo = pendente<unknown>();
    invoke.mockReturnValue(voo.promessa);
    comQuery(<ChangePlanDialog open onOpenChange={vi.fn()} current={assinatura()} />);
    await userEvent.click(screen.getByText("Pro"));
    const confirmar = screen.getByRole("button", { name: "Confirmar mudança" });
    await userEvent.dblClick(confirmar);
    expect(await screen.findByRole("button", { name: /Atualizando/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(invoke).toHaveBeenCalledTimes(1);
    voo.resolver({ data: { success: true }, error: null });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });
});

describe("CancelDialog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fora do prazo de arrependimento: promete acesso até o fim do período", () => {
    comQuery(<CancelDialog open onOpenChange={vi.fn()} current={assinatura()} />);
    expect(screen.getByText(/O acesso continua até/)).toBeInTheDocument();
    expect(screen.queryByText(/estornado integralmente/)).not.toBeInTheDocument();
  });

  it("dentro de 7 dias da 1ª cobrança: avisa estorno integral e fim do acesso agora", () => {
    comQuery(
      <CancelDialog
        open
        onOpenChange={vi.fn()}
        current={assinatura({ current_period_start: new Date(Date.now() - 2 * DIA).toISOString() })}
      />
    );
    expect(screen.getByText("estornado integralmente")).toBeInTheDocument();
  });

  it("cancelar sem estorno avisa até quando o acesso fica e fecha", async () => {
    invoke.mockResolvedValue({ data: { success: true, refunded: false }, error: null });
    const onOpenChange = vi.fn();
    comQuery(<CancelDialog open onOpenChange={onOpenChange} current={assinatura()} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar assinatura" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(invoke).toHaveBeenCalledWith("pilar-subscription-manage", { body: { action: "cancel" } });
    expect(toast.success.mock.calls[0][0]).toBe("Assinatura cancelada");
    expect(toast.success.mock.calls[0][1].description).toMatch(/^Acesso mantido até \d{2}\/\d{2}\/\d{4}\.$/);
  });

  it("sem data de fim do período, a mensagem não inventa data", async () => {
    invoke.mockResolvedValue({ data: { success: true, refunded: false }, error: null });
    comQuery(<CancelDialog open onOpenChange={vi.fn()} current={assinatura({ current_period_end: null })} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar assinatura" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(toast.success.mock.calls[0][1].description).toBe("Acesso mantido até o fim do período atual.");
  });

  it("cancelar com estorno avisa do estorno", async () => {
    invoke.mockResolvedValue({ data: { success: true, refunded: true }, error: null });
    comQuery(<CancelDialog open onOpenChange={vi.fn()} current={assinatura()} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar assinatura" }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Assinatura cancelada e valor estornado", expect.anything())
    );
  });

  it("assinatura já cancelada: o erro do servidor aparece e o diálogo fica aberto", async () => {
    invoke.mockResolvedValue({ data: { success: false, error: "Assinatura já cancelada" }, error: null });
    const onOpenChange = vi.fn();
    comQuery(<CancelDialog open onOpenChange={onOpenChange} current={assinatura({ status: "canceled" })} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar assinatura" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error.mock.calls[0][0]).toBe("Não foi possível cancelar a assinatura");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("falha do Asaas ao cancelar não fecha o diálogo nem mostra sucesso", async () => {
    invoke.mockResolvedValue({ data: null, error: { message: "Edge Function returned a non-2xx status code" } });
    const onOpenChange = vi.fn();
    comQuery(<CancelDialog open onOpenChange={onOpenChange} current={assinatura()} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar assinatura" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("clique duplo no cancelar chama o servidor uma vez só e trava 'Manter assinatura'", async () => {
    const voo = pendente<unknown>();
    invoke.mockReturnValue(voo.promessa);
    comQuery(<CancelDialog open onOpenChange={vi.fn()} current={assinatura()} />);
    await userEvent.dblClick(screen.getByRole("button", { name: "Cancelar assinatura" }));
    expect(await screen.findByRole("button", { name: /Cancelando/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Manter assinatura" })).toBeDisabled();
    expect(invoke).toHaveBeenCalledTimes(1);
    voo.resolver({ data: { success: true }, error: null });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });
});
