// Página de checkout ponta a ponta (com a edge mockada): plano inválido na URL,
// recusa do cartão, PIX aguardando confirmação, cartão aprovado na hora e a métrica
// de compra disparada uma vez só.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { FunctionsHttpError } from "@supabase/supabase-js";
import type { Plan } from "@/hooks/usePlans";

const { invoke, recordMetric, track, planos } = vi.hoisted(() => ({
  invoke: vi.fn(),
  recordMetric: vi.fn(),
  track: vi.fn(),
  planos: { data: [] as Plan[], isLoading: false },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));
vi.mock("@/hooks/usePlans", () => ({ usePlans: () => planos }));
vi.mock("@/lib/monitoring", () => ({ monitoring: { recordMetric, captureException: vi.fn() } }));
vi.mock("@/lib/analytics", () => ({ analytics: { track } }));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: () => {} }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import Checkout from "./index";

const PRO: Plan = {
  id: "p-pro",
  slug: "pro",
  nome: "Pro",
  descricao: null,
  preco_mensal: 690,
  preco_anual: 6900,
  max_usuarios: null,
  max_projetos: null,
  features: [],
  destaque: false,
  ordem: 1,
};

function abrir(url: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/planos" element={<div>Página de planos</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

async function preencherEPagarComPix() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Nome completo"), "Ana Souza");
  await user.type(screen.getByLabelText("Email"), "ana@escritorio.com");
  await user.type(screen.getByLabelText("CPF ou CNPJ"), "52998224725");
  await user.type(screen.getByLabelText("Telefone"), "11987654321");
  await user.type(screen.getByLabelText("Nome do escritório"), "Escritório Souza");
  await user.click(screen.getByRole("button", { name: "PIX" }));
  await user.click(screen.getByRole("button", { name: /Pagar/ }));
}

const respostaCheckout = (over: Record<string, unknown> = {}) => ({
  success: true,
  session_token: "tok_sessao_123456789012345",
  billing_type: "PIX",
  payment_status: "pending",
  plan: { slug: "pro", nome: "Pro", cycle: "monthly", value: 690 },
  metadata: {
    billing_type: "PIX",
    value: 690,
    cycle: "monthly",
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

describe("Checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    planos.data = [PRO];
    planos.isLoading = false;
  });

  it("sem plano na URL volta para a página de planos", () => {
    abrir("/checkout");
    expect(screen.getByText("Página de planos")).toBeInTheDocument();
  });

  it("plano inexistente ou inativo na URL volta para a página de planos", () => {
    abrir("/checkout?plano=gratis");
    expect(screen.getByText("Página de planos")).toBeInTheDocument();
  });

  it("ciclo desconhecido na URL cai no mensal (não cobra valor anual por engano)", () => {
    abrir("/checkout?plano=pro&ciclo=weekly");
    expect(screen.getByRole("button", { name: /Pagar/ })).toHaveTextContent("R$ 690,00");
  });

  it("ciclo anual usa o preço anual do plano", () => {
    abrir("/checkout?plano=pro&ciclo=yearly");
    expect(screen.getByRole("button", { name: /Pagar/ })).toHaveTextContent("R$ 6.900,00");
  });

  it("erro do servidor (corpo { error }) aparece no formulário, sem sair dele", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(
        new Response(JSON.stringify({ error: "Já existe uma conta com esse email. Faça login em /login." }), {
          status: 409,
        })
      ),
    });
    abrir("/checkout?plano=pro");
    await preencherEPagarComPix();
    expect(await screen.findByText("Já existe uma conta com esse email. Faça login em /login.")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome completo")).toBeInTheDocument();
    expect(recordMetric).not.toHaveBeenCalled();
  });

  it("erro sem corpo legível (rede, 502 em HTML) mostra mensagem genérica, não o texto técnico", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(new Response("<html>Bad Gateway</html>", { status: 502 })),
    });
    abrir("/checkout?plano=pro");
    await preencherEPagarComPix();
    expect(await screen.findByText(/Não foi possível processar o pagamento agora/)).toBeInTheDocument();
  });

  it("resposta sem success (falha lógica) também vira erro visível", async () => {
    invoke.mockResolvedValue({ data: { error: "Plano não encontrado" }, error: null });
    abrir("/checkout?plano=pro");
    await preencherEPagarComPix();
    expect(await screen.findByText("Plano não encontrado")).toBeInTheDocument();
  });

  it("PIX criado mostra o QR e consulta o status pelo token da sessão", async () => {
    invoke.mockImplementation((fn: string) =>
      fn === "pilar-checkout-create"
        ? Promise.resolve({ data: respostaCheckout(), error: null })
        : Promise.resolve({ data: { payment_status: "pending", invite_dispatched: false }, error: null })
    );
    abrir("/checkout?plano=pro");
    await preencherEPagarComPix();
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("pilar-checkout-status", {
        body: { session_token: "tok_sessao_123456789012345" },
      })
    );
    expect(screen.queryByLabelText("Nome completo")).not.toBeInTheDocument();
    expect(recordMetric).not.toHaveBeenCalled();
  });

  it("PIX confirmado pelo polling mostra sucesso e registra a compra uma vez", async () => {
    invoke.mockImplementation((fn: string) =>
      fn === "pilar-checkout-create"
        ? Promise.resolve({ data: respostaCheckout(), error: null })
        : Promise.resolve({
            data: { payment_status: "paid", invite_dispatched: true, email: "ana@escritorio.com" },
            error: null,
          })
    );
    abrir("/checkout?plano=pro");
    await preencherEPagarComPix();
    expect(await screen.findByText("Pagamento confirmado")).toBeInTheDocument();
    expect(screen.getByText("Email enviado")).toBeInTheDocument();
    expect(recordMetric).toHaveBeenCalledTimes(1);
    expect(recordMetric).toHaveBeenCalledWith("checkout.completed", 1, expect.anything());
    expect(track).toHaveBeenCalledWith("assinatura_ativada", expect.objectContaining({ plano: "pro" }));
  });

  it("cartão aprovado na hora vai direto ao sucesso sem polling", async () => {
    invoke.mockResolvedValue({
      data: respostaCheckout({ billing_type: "CREDIT_CARD", payment_status: "paid" }),
      error: null,
    });
    abrir("/checkout?plano=pro");
    // Mesmo payload de PIX no formulário; a resposta do servidor é que manda.
    await preencherEPagarComPix();
    expect(await screen.findByText("Pagamento confirmado")).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(recordMetric).toHaveBeenCalledTimes(1);
  });
});
