import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FaturasCard, dataDaFatura } from "./FaturasCard";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));

function renderizar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <FaturasCard enabled />
    </QueryClientProvider>
  );
}

describe("FaturasCard", () => {
  beforeEach(() => invoke.mockReset());

  it("formata a data sem deslocar o dia pelo fuso", () => {
    expect(dataDaFatura("2026-11-17")).toBe("17/11/2026");
  });

  it("lista a cobrança paga com link de recibo e a aberta com link de fatura", async () => {
    invoke.mockResolvedValue({
      data: {
        success: true,
        invoices: [
          {
            id: "p1",
            status: "CONFIRMED",
            value: 299,
            due_date: "2026-11-17",
            payment_date: "2026-11-17",
            billing_type: "CREDIT_CARD",
            url: "https://asaas/comprovantes/1",
            paga: true,
          },
          {
            id: "p2",
            status: "PENDING",
            value: 299,
            due_date: "2026-12-17",
            payment_date: null,
            billing_type: "BOLETO",
            url: "https://asaas/i/2",
            paga: false,
          },
        ],
      },
      error: null,
    });
    renderizar();
    const recibo = await screen.findByRole("link", { name: /Recibo/ });
    expect(recibo).toHaveAttribute("href", "https://asaas/comprovantes/1");
    expect(screen.getByRole("link", { name: /Fatura/ })).toHaveAttribute("href", "https://asaas/i/2");
    expect(invoke).toHaveBeenCalledWith("pilar-subscription-manage", { body: { action: "list_invoices" } });
  });

  it("mostra mensagem amigável quando a leitura falha", async () => {
    invoke.mockResolvedValue({ data: { success: false, error: "x" }, error: null });
    renderizar();
    expect(await screen.findByText(/Não foi possível carregar as faturas/)).toBeInTheDocument();
  });
});
