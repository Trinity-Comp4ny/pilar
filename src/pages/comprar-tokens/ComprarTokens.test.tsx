// Compra de pacote de créditos de IA (SPEC 077/080): catálogo exibido em créditos,
// validação do cartão e do titular antes do servidor, recusa do Asaas, permissão
// negada, PIX aguardando e crédito liberado.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { FunctionsHttpError } from "@supabase/supabase-js";

const { invoke, statusCompra, toast, track, auth } = vi.hoisted(() => ({
  invoke: vi.fn(),
  statusCompra: { value: "pending" as string },
  toast: { error: vi.fn(), success: vi.fn() },
  track: vi.fn(),
  auth: {
    value: {
      loading: false,
      isAuthenticated: true,
      profile: {
        empresa_id: "e1",
        first_name: "Ana",
        last_name: "Souza",
        email: "ana@escritorio.com",
        contato: "11987654321",
        empresas: { cnpj: "" },
      } as Record<string, unknown> | null,
    },
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { status: statusCompra.value }, error: null })),
        })),
      })),
    })),
  },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth.value }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/lib/analytics", () => ({ analytics: { track } }));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: () => {} }));
vi.mock("@/lib/brasilApi", async () => {
  const actual = await vi.importActual<typeof import("@/lib/brasilApi")>("@/lib/brasilApi");
  return { ...actual, lookupCEP: vi.fn().mockResolvedValue(null) };
});

import ComprarTokens from "./index";

const anoFuturo = String((new Date().getFullYear() + 3) % 100).padStart(2, "0");

function abrir() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/comprar-tokens"]}>
        <Routes>
          <Route path="/comprar-tokens" element={<ComprarTokens />} />
          <Route path="/login" element={<div>Tela de login</div>} />
          <Route path="/inicio" element={<div>Início</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

async function preencherCartao(over: { cpf?: string; celular?: string; numero?: string } = {}) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Nome impresso no cartão"), "ANA SOUZA");
  await user.type(screen.getByLabelText(/Número do cartão/), over.numero ?? "4111111111111111");
  await user.type(screen.getByLabelText("Validade"), `12${anoFuturo}`);
  await user.type(screen.getByLabelText("CVV"), "123");
  await user.type(screen.getByLabelText("CPF ou CNPJ do titular"), over.cpf ?? "52998224725");
  await user.type(screen.getByLabelText("CEP"), "01310100");
  await user.type(screen.getByLabelText("Número"), "100");
  const celular = screen.getByLabelText("Celular do titular");
  await user.clear(celular);
  if (over.celular !== "") await user.type(celular, over.celular ?? "11987654321");
  return user;
}

const pagar = () => screen.getByRole("button", { name: /Pagar/ });

const resposta = (over: Record<string, unknown> = {}) => ({
  success: true,
  purchase_id: "compra_1",
  billing_type: "PIX",
  payment_status: "pending",
  tokens: 1_500_000,
  value: 129,
  metadata: {
    payment_id: "pay_1",
    invoice_url: null,
    pix: {
      encoded_image: "aW1n",
      payload: "00020126pix",
      expiration_date: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    },
  },
  ...over,
});

describe("Comprar créditos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    statusCompra.value = "pending";
    auth.value = { ...auth.value, loading: false, isAuthenticated: true };
  });

  it("sem login vai para a tela de login", () => {
    auth.value = { ...auth.value, isAuthenticated: false };
    abrir();
    expect(screen.getByText("Tela de login")).toBeInTheDocument();
  });

  it("catálogo aparece em créditos de IA, com o preço de cada pacote", () => {
    abrir();
    for (const [label, preco] of [
      ["100 créditos de IA", "R$ 49,00"],
      ["300 créditos de IA", "R$ 129,00"],
      ["600 créditos de IA", "R$ 228,00"],
      ["1.200 créditos de IA", "R$ 399,00"],
    ]) {
      const botao = screen.getByRole("button", { name: new RegExp(label) });
      expect(botao).toHaveTextContent(preco);
    }
    expect(screen.queryByText(/tokens/)).not.toBeInTheDocument();
  });

  it("PIX manda só o pacote e a forma de pagamento (preço é do servidor)", async () => {
    invoke.mockResolvedValue({ data: resposta(), error: null });
    abrir();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /100 créditos de IA/ }));
    await user.click(screen.getByRole("button", { name: "Pix" }));
    await user.click(pagar());
    await waitFor(() => expect(invoke).toHaveBeenCalled());
    expect(invoke).toHaveBeenCalledWith("pilar-token-pack-create", {
      body: { tier_id: "starter", billing_type: "PIX" },
    });
  });

  it("cartão válido manda cartão e titular com o nome e e-mail do perfil", async () => {
    invoke.mockResolvedValue({ data: resposta({ billing_type: "CREDIT_CARD", payment_status: "paid" }), error: null });
    abrir();
    const user = await preencherCartao();
    await user.click(pagar());
    await waitFor(() => expect(invoke).toHaveBeenCalled());
    const body = invoke.mock.calls[0][1].body;
    expect(body.tier_id).toBe("cresce");
    expect(body.credit_card).toEqual({
      holderName: "ANA SOUZA",
      number: "4111111111111111",
      expiryMonth: "12",
      expiryYear: `20${anoFuturo}`,
      ccv: "123",
    });
    expect(body.credit_card_holder_info).toEqual({
      name: "Ana Souza",
      email: "ana@escritorio.com",
      cpfCnpj: "52998224725",
      postalCode: "01310100",
      addressNumber: "100",
      phone: "11987654321",
    });
  });

  it("cartão aprovado na hora libera os créditos e registra a compra uma vez", async () => {
    invoke.mockResolvedValue({ data: resposta({ billing_type: "CREDIT_CARD", payment_status: "paid" }), error: null });
    abrir();
    const user = await preencherCartao();
    await user.click(pagar());
    expect(await screen.findByText("Créditos liberados")).toBeInTheDocument();
    expect(screen.getByText("300 créditos já estão disponíveis no seu saldo.")).toBeInTheDocument();
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("pacote_tokens_comprado", { tier: "cresce", tokens: 1_500_000 });
  });

  it("CPF do titular inválido é barrado antes do servidor", async () => {
    abrir();
    const user = await preencherCartao({ cpf: "52998224726" });
    await user.click(pagar());
    expect(toast.error).toHaveBeenCalledWith("CPF/CNPJ inválido", expect.anything());
    expect(invoke).not.toHaveBeenCalled();
  });

  it("celular do titular sem DDD é barrado (o Asaas recusaria)", async () => {
    abrir();
    const user = await preencherCartao({ celular: "98765432" });
    await user.click(pagar());
    expect(toast.error).toHaveBeenCalledWith("Celular do titular inválido", expect.anything());
    expect(invoke).not.toHaveBeenCalled();
  });

  it("número de cartão inválido é barrado", async () => {
    abrir();
    const user = await preencherCartao({ numero: "4111111111111112" });
    await user.click(pagar());
    expect(toast.error).toHaveBeenCalledWith("Número do cartão inválido");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("cartão recusado pelo Asaas mostra o motivo e mantém o formulário", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(
        new Response(JSON.stringify({ error: "Falha ao criar cobrança: Asaas: Transação não autorizada." }), {
          status: 502,
        })
      ),
    });
    abrir();
    const user = await preencherCartao();
    await user.click(pagar());
    expect(await screen.findByText("Falha ao criar cobrança: Asaas: Transação não autorizada.")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome impresso no cartão")).toBeInTheDocument();
    expect(track).not.toHaveBeenCalled();
  });

  it("não admin: a recusa do servidor (403) aparece na tela", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(
        new Response(JSON.stringify({ error: "Apenas admin da empresa pode comprar tokens" }), { status: 403 })
      ),
    });
    abrir();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Pix" }));
    await user.click(pagar());
    expect(await screen.findByText("Apenas admin da empresa pode comprar tokens")).toBeInTheDocument();
  });

  it("PIX gerado espera o pagamento; confirmação pelo polling libera os créditos", async () => {
    invoke.mockResolvedValue({ data: resposta(), error: null });
    statusCompra.value = "paid";
    abrir();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Pix" }));
    await user.click(pagar());
    expect(await screen.findByText("Créditos liberados")).toBeInTheDocument();
    expect(track).toHaveBeenCalledTimes(1);
  });

  it("clique duplo no pagar cria uma cobrança só", async () => {
    let resolver!: (v: unknown) => void;
    invoke.mockReturnValue(new Promise((r) => (resolver = r)));
    abrir();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Pix" }));
    await user.dblClick(pagar());
    await waitFor(() => expect(screen.getByRole("button", { name: /Processando|Pagar/ })).toBeDisabled());
    expect(invoke).toHaveBeenCalledTimes(1);
    resolver({ data: resposta(), error: null });
  });
});
