import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { LancamentosFilters } from "../components/lancamentosFilters";

// KPIs da aba Lançamentos: erro ao carregar o resumo mostra o estado de erro,
// não quatro cards zerados como se fosse dado real.

const resumoHook = vi.hoisted(() => ({
  isError: false,
  atrasados: 0,
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
      atrasadosCount: resumoHook.atrasados,
    },
    isLoading: false,
    isError: resumoHook.isError,
    isFetching: false,
    dataUpdatedAt: 0,
    refetch: resumoHook.refetch,
  }),
}));
// A tabela expõe os filtros que recebeu e os callbacks que a aba passa a ela.
vi.mock("../components/LancamentosTable", () => ({
  LancamentosTable: ({
    filters,
    onFiltersChange,
    onMutated,
  }: {
    filters: LancamentosFilters;
    onFiltersChange: (f: LancamentosFilters) => void;
    onMutated: () => void;
  }) => (
    <div>
      <span data-testid="filtros">{JSON.stringify({ tipo: filters.tipo, status: filters.status })}</span>
      <button type="button" onClick={() => onFiltersChange({ ...filters, search: "aluguel" })}>
        tabela-buscar
      </button>
      <button type="button" onClick={() => onFiltersChange({ ...filters, tipo: "despesa" })}>
        tabela-a-pagar
      </button>
      <button type="button" onClick={onMutated}>
        tabela-mutou
      </button>
    </div>
  ),
}));
vi.mock("../components/ImportarLancamentosDialog", () => ({
  ImportarLancamentosDialog: ({ open, onImported }: { open: boolean; onImported: () => void }) =>
    open ? (
      <button type="button" onClick={onImported}>
        importado
      </button>
    ) : null,
}));
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

function Url() {
  return <span data-testid="url">{useLocation().search}</span>;
}

function renderTab(url = "/") {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Lancamentos />
        <Url />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return { invalidate };
}

beforeEach(() => {
  vi.clearAllMocks();
  resumoHook.isError = false;
  resumoHook.atrasados = 0;
});

describe("Lancamentos: KPIs", () => {
  it("com o resumo carregado mostra os quatro KPIs", () => {
    renderTab();
    expect(screen.getByText("Recebido")).toBeInTheDocument();
    // Só no KPI: o seletor de visão que repetia o da barra de filtros saiu.
    expect(screen.getAllByText("A pagar")).toHaveLength(1);
    expect(screen.queryByRole("group", { name: "O que ver" })).not.toBeInTheDocument();
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

describe("Lancamentos: recorte, filtros na URL e recarga", () => {
  const recorte = () => screen.getByText(/· por vencimento/).querySelector("span")?.textContent;

  it("rótulo do recorte acompanha o período da URL", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 10, 12, 0));
    try {
      const casos: [string, string][] = [
        ["/", "novembro de 2026"],
        ["/?fp=mes-anterior", "outubro de 2026"],
        ["/?fp=tudo", "todo o período"],
        ["/?fp=ano", "2026"],
        ["/?fp=ultimos-30", "últimos 30 dias"],
        ["/?fp=custom&fcf=2026-01-05&fct=2026-02-10", "05/01/2026 a 10/02/2026"],
        ["/?fp=custom", "… a …"],
      ];
      for (const [url, esperado] of casos) {
        const { unmount } = render(
          <QueryClientProvider client={new QueryClient()}>
            <MemoryRouter initialEntries={[url]}>
              <Lancamentos />
            </MemoryRouter>
          </QueryClientProvider>
        );
        expect(recorte()).toBe(esperado);
        unmount();
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("cada KPI aplica o filtro de tipo e status correspondente", async () => {
    // Ao aplicar um tipo, a aba vira A pagar / A receber e os KPIs dão lugar aos chips
    // de posição; por isso cada KPI é clicado numa montagem nova.
    const casos: [string, { tipo: string; status: string }][] = [
      ["Recebido", { tipo: "receita", status: "pagos" }],
      ["Pago", { tipo: "despesa", status: "pagos" }],
      ["A receber", { tipo: "receita", status: "pendentes" }],
      ["A pagar", { tipo: "despesa", status: "pendentes" }],
    ];
    for (const [kpi, esperado] of casos) {
      const user = userEvent.setup();
      renderTab();
      // "A pagar"/"A receber" também nomeiam o seletor de visão; o KPI é o último.
      await user.click(screen.getAllByText(kpi).at(-1)!);
      expect(JSON.parse(screen.getByTestId("filtros").textContent ?? "{}")).toEqual(esperado);
      expect(screen.getByTestId("url").textContent).toContain(`ft=${esperado.tipo}`);
      cleanup();
    }
  });

  it("trocar o tipo pela barra segue a regra das visões: abre em aberto e lembra a escolha", async () => {
    renderTab();
    await userEvent.setup().click(screen.getByRole("button", { name: "tabela-a-pagar" }));
    expect(screen.getByTestId("filtros")).toHaveTextContent('"tipo":"despesa","status":"pendentes"');
    expect(localStorage.getItem("pilar:financeiro:lancamentos:visao")).toBe("despesa");
    localStorage.removeItem("pilar:financeiro:lancamentos:visao");
  });

  it("atrasados aparecem no KPI 'A pagar'", () => {
    resumoHook.atrasados = 3;
    renderTab();
    expect(screen.getByText("3 atrasado(s)")).toBeInTheDocument();
  });

  it("a tabela grava os filtros na URL preservando outros parâmetros", async () => {
    const user = userEvent.setup();
    renderTab("/?tab=lancamentos");
    await user.click(screen.getByRole("button", { name: "tabela-buscar" }));
    const url = screen.getByTestId("url").textContent ?? "";
    expect(url).toContain("tab=lancamentos");
    expect(url).toContain("fq=aluguel");
  });

  it("mutação na tabela e importação invalidam página, resumo e grupos", async () => {
    const user = userEvent.setup();
    const { invalidate } = renderTab();
    await user.click(screen.getByRole("button", { name: "tabela-mutou" }));
    expect(invalidate.mock.calls.map((c) => c[0]?.queryKey)).toEqual([
      ["lancamentos-pagina"],
      ["lancamentos-resumo"],
      ["grupos-parcela-resumo"],
      ["titulos-posicao"],
    ]);
    expect(screen.queryByRole("button", { name: "importado" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Importar/ }));
    await user.click(screen.getByRole("button", { name: "importado" }));
    expect(invalidate).toHaveBeenCalledTimes(8);
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
