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

import Lancamentos from "./Lancamentos";

function renderTab() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
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
    expect(screen.getByText("A pagar")).toBeInTheDocument();
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
