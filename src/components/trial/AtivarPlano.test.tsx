// "Ativar plano" (SPEC 098/104): em teste guarda o cartão sem cobrar; com o teste
// vencido ou a assinatura cancelada, cobra na hora. Cobre consentimento obrigatório,
// validação do cartão e do titular, recusa do Asaas, tokenização não liberada e
// clique duplo.
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FunctionsHttpError } from "@supabase/supabase-js";
import type { Plan } from "@/hooks/usePlans";
import type { MySubscription } from "@/pages/billing/hooks/useMySubscription";

const { invoke, toast, track, PLANOS } = vi.hoisted(() => {
  const plano = (id: string, nome: string, mensal: number, destaque: boolean): Plan => ({
    id,
    slug: id,
    nome,
    descricao: null,
    preco_mensal: mensal,
    preco_anual: mensal * 10,
    max_usuarios: null,
    max_projetos: 10,
    max_obras: 2,
    max_leads: 50,
    tokens_mensais: 500_000,
    features: [],
    destaque,
    ordem: 0,
  });
  return {
    invoke: vi.fn(),
    toast: { success: vi.fn(), error: vi.fn() },
    track: vi.fn(),
    // Planos v4 (DECISOES.md 2026-11-06).
    PLANOS: [plano("plano-essencial", "Essencial", 299, false), plano("plano-pro", "Profissional", 499, true)],
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/lib/analytics", () => ({ analytics: { track } }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { email: "dono@escritorio.com" }, profile: { contato: "" } }),
}));
vi.mock("@/hooks/usePlans", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/usePlans")>("@/hooks/usePlans");
  return { ...actual, usePlans: () => ({ data: PLANOS }) };
});

import { AtivarPlano } from "./AtivarPlano";

const DIA = 24 * 60 * 60 * 1000;
const anoFuturo = String((new Date().getFullYear() + 3) % 100).padStart(2, "0");

function assinatura(over: Partial<MySubscription> = {}): MySubscription {
  return {
    id: "s1",
    empresa_id: "e1",
    plan_id: "plano-pro",
    status: "trialing",
    billing_cycle: null,
    billing_type: null,
    trial_ends_at: new Date(Date.now() + 2 * DIA).toISOString(),
    current_period_start: null,
    current_period_end: null,
    canceled_at: null,
    created_at: "2026-11-01T00:00:00.000Z",
    asaas_subscription_id: null,
    plan: null,
    ...over,
  };
}

function abrir(sub = assinatura()) {
  const onAtivado = vi.fn();
  const onOpenChange = vi.fn();
  render(<AtivarPlano open onOpenChange={onOpenChange} subscription={sub} onAtivado={onAtivado} />);
  return { onAtivado, onOpenChange };
}

async function preencher(over: { numero?: string; cpf?: string; celular?: string; consentir?: boolean } = {}) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Nome impresso no cartão"), "ANA SOUZA");
  await user.type(screen.getByLabelText(/Número do cartão/), over.numero ?? "4111111111111111");
  await user.type(screen.getByLabelText("Validade"), `12${anoFuturo}`);
  await user.type(screen.getByLabelText("CVV"), "123");
  await user.type(screen.getByLabelText("CPF ou CNPJ do titular"), over.cpf ?? "52998224725");
  await user.type(screen.getByLabelText("CEP"), "01310100");
  await user.type(screen.getByLabelText("Número do endereço"), "100");
  await user.type(screen.getByLabelText("Celular do titular"), over.celular ?? "11987654321");
  if (over.consentir !== false) await user.click(screen.getByRole("checkbox"));
  return user;
}

beforeAll(() => {
  // O Checkbox (Radix) mede o próprio tamanho com ResizeObserver; o jsdom não tem.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("AtivarPlano", () => {
  beforeEach(() => vi.clearAllMocks());

  it("em teste: nada é cobrado agora; envia plano sugerido, cartão e titular, sem cobrar_agora", async () => {
    invoke.mockResolvedValue({ data: { success: true }, error: null });
    const { onAtivado, onOpenChange } = abrir();
    expect(screen.getAllByText(/Nada é cobrado agora/).length).toBeGreaterThan(0);
    const user = await preencher();
    await user.click(screen.getByRole("button", { name: "Ativar plano" }));
    await waitFor(() => expect(onAtivado).toHaveBeenCalled());
    const body = invoke.mock.calls[0][1].body;
    expect(invoke.mock.calls[0][0]).toBe("ativar-plano");
    expect(body.plan_id).toBe("plano-pro");
    expect(body.billing_cycle).toBe("monthly");
    expect("cobrar_agora" in body).toBe(false);
    expect(body.credit_card_holder_info).toEqual({
      name: "ANA SOUZA",
      email: "dono@escritorio.com",
      cpfCnpj: "52998224725",
      postalCode: "01310100",
      addressNumber: "100",
      phone: "11987654321",
    });
    expect(toast.success.mock.calls[0][0]).toBe("Plano ativado");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("teste vencido: título e botão de assinar com o valor, cobrança hoje", async () => {
    invoke.mockResolvedValue({ data: { success: true }, error: null });
    const { onAtivado } = abrir(assinatura({ status: "expired" }));
    expect(screen.getByText("Assinar a Pilar")).toBeInTheDocument();
    const user = await preencher();
    await user.click(screen.getByRole("button", { name: /^Assinar e pagar R\$\s499,00$/ }));
    await waitFor(() => expect(onAtivado).toHaveBeenCalled());
    expect(toast.success.mock.calls[0][0]).toBe("Assinatura ativa");
  });

  it("assinatura cancelada também assina de novo com cobrança na hora", () => {
    abrir(assinatura({ status: "canceled", trial_ends_at: null }));
    expect(screen.getByText(/Sua assinatura foi cancelada/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Assinar e pagar/ })).toBeInTheDocument();
  });

  it("sem marcar o consentimento o botão fica desabilitado", async () => {
    abrir();
    await preencher({ consentir: false });
    expect(screen.getByRole("button", { name: "Ativar plano" })).toBeDisabled();
  });

  it.each([
    ["número que não passa no Luhn", { numero: "4111111111111112" }],
    ["CPF com dígito errado", { cpf: "52998224726" }],
    ["celular sem DDD", { celular: "98765432" }],
  ])("%s mantém o botão desabilitado e não chama o servidor", async (_caso, over) => {
    abrir();
    const user = await preencher(over);
    const botao = screen.getByRole("button", { name: "Ativar plano" });
    expect(botao).toBeDisabled();
    await user.click(botao);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("cartão recusado: mostra o motivo e não fecha nem ativa", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(
        new Response(JSON.stringify({ error: "Não foi possível validar o cartão: Cartão recusado" }), { status: 502 })
      ),
    });
    const { onAtivado, onOpenChange } = abrir();
    const user = await preencher();
    await user.click(screen.getByRole("button", { name: "Ativar plano" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível ativar o plano", {
        description: "Não foi possível validar o cartão: Cartão recusado",
      })
    );
    expect(onAtivado).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("tokenização não liberada: passa a cobrar hoje e exige novo consentimento", async () => {
    invoke.mockResolvedValueOnce({
      data: null,
      error: new FunctionsHttpError(
        new Response(
          JSON.stringify({
            error: "Ainda não dá para guardar o cartão sem cobrar.",
            codigo: "tokenizacao_indisponivel",
          }),
          { status: 409 }
        )
      ),
    });
    abrir();
    const user = await preencher();
    await user.click(screen.getByRole("button", { name: "Ativar plano" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Ainda não dá para guardar o cartão sem cobrar.");
    const assinar = screen.getByRole("button", { name: /Assinar e pagar/ });
    // Consentimento zerado: o texto mudou para cobrança hoje.
    expect(assinar).toBeDisabled();
    expect(toast.error).not.toHaveBeenCalled();

    invoke.mockResolvedValueOnce({ data: { success: true }, error: null });
    await user.click(screen.getByRole("checkbox"));
    await user.click(assinar);
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(2));
    expect(invoke.mock.calls[1][1].body.cobrar_agora).toBe(true);
  });

  it("resposta 200 com { error } também é tratada como falha", async () => {
    invoke.mockResolvedValue({ data: { error: "Plano não encontrado" }, error: null });
    const { onAtivado } = abrir();
    const user = await preencher();
    await user.click(screen.getByRole("button", { name: "Ativar plano" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error.mock.calls[0][1].description).toBe("Plano não encontrado");
    expect(onAtivado).not.toHaveBeenCalled();
  });

  it("clique duplo envia uma vez só", async () => {
    let resolver!: (v: unknown) => void;
    invoke.mockReturnValue(new Promise((r) => (resolver = r)));
    abrir();
    const user = await preencher();
    await user.dblClick(screen.getByRole("button", { name: "Ativar plano" }));
    expect(invoke).toHaveBeenCalledTimes(1);
    resolver({ data: { success: true }, error: null });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });
});
