import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

// KPIs da aba Lançamentos: erro ao carregar o resumo mostra o estado de erro,
// não quatro cards zerados como se fosse dado real.

const resumoHook = vi.hoisted(() => ({
  isError: false,
  refetch: vi.fn(),
}));

vi.mock("../hooks/useLancamentosResumo", () => ({
  useLancamentosResumo: () => ({
    resumo: {
      totalCount: 0,
      recebido: 0,
      aReceber: 0,
      pago: 0,
      aPagar: 0,
      receitas: 0,
      despesas: 0,
      saldo: 0,
      atrasadosCount: 0,
    },
    isLoading: false,
    isError: resumoHook.isError,
    isFetching: false,
    dataUpdatedAt: 0,
    refetch: resumoHook.refetch,
  }),
}));
vi.mock("../components/LancamentosTable", () => ({ LancamentosTable: () => null }));
vi.mock("../components/ImportarLancamentosDialog", () => ({ ImportarLancamentosDialog: () => null }));
vi.mock("@/components/DataFrescor", () => ({ DataFrescor: () => null }));
vi.mock("../hooks/useTitulosPosicao", () => ({
  useTitulosPosicao: (tipo: string | null) => ({
    isLoading: false,
    data: tipo
      ? {
          hoje: "2026-11-10",
          baldes: {
            vencidos: { qtd: 2, valor: 8050 },
            hoje: { qtd: 1, valor: 3400 },
            semana: { qtd: 2, valor: 1720.35 },
            futuro: { qtd: 6, valor: 6100 },
            pagos_mes: { qtd: 1, valor: 289.9 },
          },
        }
      : undefined,
  }),
}));

import Lancamentos from "./Lancamentos";

function renderTab(url = "/") {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[url]}>
        <Lancamentos />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  resumoHook.isError = false;
});

describe("Lancamentos: KPIs", () => {
  it("com o resumo carregado mostra os quatro KPIs", () => {
    renderTab();
    expect(screen.getByText("Recebido")).toBeInTheDocument();
    // "A pagar" aparece no seletor de visão e no KPI.
    expect(screen.getAllByText("A pagar")).toHaveLength(2);
    expect(screen.queryByText("Não foi possível carregar os dados financeiros")).not.toBeInTheDocument();
  });

  it("erro no resumo mostra o estado de erro em vez de zeros e permite tentar de novo", async () => {
    resumoHook.isError = true;
    renderTab();
    expect(screen.getByText("Não foi possível carregar os dados financeiros")).toBeInTheDocument();
    expect(screen.queryByText("Recebido")).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(resumoHook.refetch).toHaveBeenCalled();
  });
});

describe("Lancamentos: visões A pagar / A receber", () => {
  it("A pagar troca os KPIs gerais pelos chips de posição", () => {
    renderTab("/?ft=despesa&fs=pendentes");
    expect(screen.getByRole("button", { name: /Vencidos/ })).toHaveTextContent("R$ 8.050,00");
    expect(screen.getByRole("button", { name: /Pagos no mês/ })).toBeInTheDocument();
    expect(screen.queryByText("Recebido")).not.toBeInTheDocument();
  });

  it("clicar em Vencidos marca o chip (filtro aplicado na URL)", async () => {
    renderTab("/?ft=despesa&fs=pendentes");
    const vencidos = screen.getByRole("button", { name: /Vencidos/ });
    expect(vencidos).toHaveAttribute("aria-pressed", "false");
    await userEvent.setup().click(vencidos);
    expect(screen.getByRole("button", { name: /Vencidos/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("A receber nomeia o balde de pagos como recebidos", () => {
    renderTab("/?ft=receita&fs=pendentes");
    expect(screen.getByRole("button", { name: /Recebidos no mês/ })).toBeInTheDocument();
  });
});
