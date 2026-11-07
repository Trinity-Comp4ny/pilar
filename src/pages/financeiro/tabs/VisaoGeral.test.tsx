import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { sb } from "../testing/supabaseMock";
import { FinanceFilterProvider, type Visualizacao } from "../contexts/FinanceFilterContext";

// Visão geral do Financeiro: KPIs (lucro e margem primeiro), gráfico de fluxo
// (comparativo/performance), rosca por categoria com detalhe, top 5, lançamentos
// recentes e próximos vencimentos. Estados de carregamento, erro e vazio.

const financeState: {
  data: unknown;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  dataUpdatedAt: number;
  refetch: ReturnType<typeof vi.fn>;
} = { data: undefined, isLoading: false, isError: false, isFetching: false, dataUpdatedAt: 0, refetch: vi.fn() };
const radarState: { data: unknown } = { data: undefined };
const useFinanceData = vi.fn((_from?: Date, _to?: Date) => financeState);

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("../testing/supabaseMock")).sb.client,
}));
vi.mock("@/pages/financeiro/hooks/useFinanceData", () => ({
  useFinanceData: (f?: Date, t?: Date) => useFinanceData(f, t),
}));
vi.mock("@/pages/financeiro/hooks/useDashboardData", () => ({ useDashboardData: () => radarState }));
// ResponsiveContainer mede o pai (0x0 no jsdom): dá tamanho fixo ao gráfico.
vi.mock("recharts", async (orig) => {
  const real = await orig<typeof import("recharts")>();
  return {
    ...real,
    ResponsiveContainer: ({ children }: { children: ReactNode }) =>
      isValidElement(children) ? cloneElement(children as ReactElement<Record<string, unknown>>, { width: 600, height: 300 }) : null,
  };
});

import VisaoGeral from "./VisaoGeral";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const dadosCheios = {
  stats: {
    receitasTotal: 100000,
    receitasMes: 12,
    despesasTotal: 60000,
    despesasMes: -5,
    saldo: 40000,
    aReceber: { total: 15000, count: 3 },
    aPagar: { total: 8000, count: 2 },
  },
  topReceitas: [{ id: "r1", descricao: "Honorários Casa Verde", data: "2026-10-03", valor: 50000 }],
  topDespesas: [{ id: "d1", descricao: "Folha outubro", data: "2026-10-05", valor: 30000 }],
  chartData: [{ mes: "Out", receitas: 100000, despesas: 60000 }],
  chartDataDiario: [{ dia: "01/10", receitas: 1000, despesas: 500 }],
  categoriaData: [
    { name: "Projetos", value: 70000, color: "#0a0", count: 4 },
    { name: "Consultoria", value: 30000, color: "#0b0", count: 1 },
  ],
  despesasCategoriaData: [{ name: "Pessoal", value: 60000, color: "#a00", count: 6 }],
};

function setup(props: { onNavigateTab?: (t: string) => void; onNovoLancamento?: () => void } = {}, viz: Visualizacao = "mes") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const filtro = {
    dateFrom: new Date(2026, 9, 1),
    setDateFrom: vi.fn(),
    dateTo: new Date(2026, 9, 31),
    setDateTo: vi.fn(),
    visualizacao: viz,
    setVisualizacao: vi.fn(),
  };
  render(
    <QueryClientProvider client={client}>
      <FinanceFilterProvider value={filtro}>
        <VisaoGeral {...props} />
      </FinanceFilterProvider>
    </QueryClientProvider>
  );
  return filtro;
}

beforeEach(() => {
  vi.clearAllMocks();
  sb.reset();
  Object.assign(financeState, {
    data: dadosCheios,
    isLoading: false,
    isError: false,
    isFetching: false,
    dataUpdatedAt: Date.now(),
    refetch: vi.fn(),
  });
  radarState.data = {
    proximosVencimentos: [
      {
        id: "v1",
        tipo: "receita",
        descricao: "Parcela 2/3",
        entidade: "Construtora Alfa",
        projeto: "Casa Verde",
        valor: 5000,
        diasRestantes: 0,
      },
    ],
  };
  sb.resultado("lancamentos.select", {
    data: [
      { id: "l1", tipo: "despesa", descricao: "Cimento", valor: "150", data_vencimento: "2026-10-04", status: "Pago" },
      { id: "l2", tipo: "receita", descricao: "Sinal projeto", valor: 2000, data_vencimento: "2026-10-02", status: "Pago" },
      { id: "l3", tipo: "transferencia", descricao: "Entre contas", valor: null, data_vencimento: "2026-10-01", status: "Pago" },
    ],
    error: null,
  });
});

describe("VisaoGeral", () => {
  it("passa o período do filtro para os dados", () => {
    const filtro = setup();
    expect(useFinanceData).toHaveBeenCalledWith(filtro.dateFrom, filtro.dateTo);
  });

  it("carregando mostra o esqueleto, sem KPIs", () => {
    financeState.isLoading = true;
    setup();
    expect(screen.queryByText("Lucro líquido")).not.toBeInTheDocument();
  });

  it("erro mostra o estado de erro e tenta de novo", () => {
    financeState.isError = true;
    setup();
    expect(screen.getByText("Não foi possível carregar os dados financeiros")).toBeInTheDocument();
    expect(screen.queryByText("Lucro líquido")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(financeState.refetch).toHaveBeenCalled();
  });

  it("KPIs com lucro, margem e pendências", () => {
    setup();
    expect(screen.getByText("Lucro líquido")).toBeInTheDocument();
    expect(screen.getByText("Margem de 40.0%")).toBeInTheDocument();
    expect(screen.getByText("3 lançamento(s) pendente(s)")).toBeInTheDocument();
    expect(screen.getByText("2 lançamento(s) pendente(s)")).toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s?40\.000,00/).length).toBeGreaterThan(0);
  });

  it("sem dados: zera KPIs, margem 0 e mostra os vazios", async () => {
    financeState.data = undefined;
    radarState.data = undefined;
    sb.resultado("lancamentos.select", { data: [], error: null });
    setup({ onNovoLancamento: vi.fn() });
    expect(screen.getByText("Margem de 0%")).toBeInTheDocument();
    expect(screen.getAllByText("Sem registros no período")).toHaveLength(3);
    expect(screen.getByText("Sem receitas no período")).toBeInTheDocument();
    expect(screen.getByText("Sem despesas no período")).toBeInTheDocument();
    expect(screen.getByText("Sem vencimentos próximos")).toBeInTheDocument();
    expect(await screen.findByText("Nenhum lançamento ainda")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ver detalhes/ })).not.toBeInTheDocument();
  });

  it("nenhum lançamento: oferece criar o primeiro", async () => {
    sb.resultado("lancamentos.select", { data: [], error: null });
    const onNovoLancamento = vi.fn();
    setup({ onNovoLancamento });
    fireEvent.click(await screen.findByRole("button", { name: "Novo lançamento" }));
    expect(onNovoLancamento).toHaveBeenCalled();
  });

  it("lucro negativo continua mostrando a margem negativa", () => {
    financeState.data = { ...dadosCheios, stats: { ...dadosCheios.stats, saldo: -20000 } };
    setup();
    expect(screen.getByText("Margem de -20.0%")).toBeInTheDocument();
  });

  it("gráfico alterna entre comparativo mensal/diário e performance", () => {
    setup({}, "dia");
    expect(screen.getByText("Comparativo de Receitas x Despesas (Diário)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Performance" }));
    expect(screen.getByText("Receitas e despesas acumuladas ao longo do período")).toBeInTheDocument();
  });

  it("comparativo mensal com dados não mostra o aviso de vazio", () => {
    setup();
    expect(screen.getByText("Comparativo de Receitas x Despesas (Mensal)")).toBeInTheDocument();
    expect(screen.queryByText("Sem registros no período")).not.toBeInTheDocument();
  });

  it("performance sem dados diários avisa vazio", () => {
    financeState.data = { ...dadosCheios, chartDataDiario: [{ dia: "01/10", receitas: 0, despesas: 0 }] };
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Performance" }));
    expect(screen.getByText("Sem registros no período")).toBeInTheDocument();
  });

  it("rosca tem resumo acessível e o detalhe abre a tabela por categoria", () => {
    setup();
    expect(screen.getByText(/Gráfico de rosca, total R\$\s?100\.000,00: Projetos/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /Ver detalhes/ })[0]);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Detalhamento de receitas")).toBeInTheDocument();
    expect(within(dialog).getByText("70.0%")).toBeInTheDocument();
    expect(within(dialog).getByText("30.0%")).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /Ver detalhes/ })[1]);
    expect(within(screen.getByRole("dialog")).getByText("Detalhamento de despesas")).toBeInTheDocument();
  });

  it("top 5 receitas e despesas", () => {
    setup();
    expect(screen.getByText("Honorários Casa Verde")).toBeInTheDocument();
    expect(screen.getByText("Folha outubro")).toBeInTheDocument();
  });

  it("lançamentos recentes com sinal por tipo e atalho Ver todos", async () => {
    const onNavigateTab = vi.fn();
    setup({ onNavigateTab });
    const cimento = await screen.findByText("Cimento");
    const linha = cimento.closest("li") as HTMLElement;
    expect(linha).toHaveTextContent(/- R\$\s?150,00/);
    expect(screen.getByText("Sinal projeto").closest("li")).toHaveTextContent(/\+ R\$\s?2\.000,00/);
    // tipo sem sinal (ex.: transferência) e valor nulo vira 0
    expect(screen.getByText("Entre contas").closest("li")).toHaveTextContent(/^Entre contas.*R\$\s?0,00$/);
    fireEvent.click(screen.getByRole("button", { name: /Ver todos/ }));
    expect(onNavigateTab).toHaveBeenCalledWith("lancamentos");
    expect(sb.de("lancamentos", "limit")[0].args).toEqual([6]);
  });

  it("erro nos recentes mostra o vazio sem quebrar a tela", async () => {
    sb.resultado("lancamentos.select", { data: null, error: { message: "permission denied" } });
    setup();
    expect(await screen.findByText("Nenhum lançamento ainda")).toBeInTheDocument();
    expect(screen.getByText("Lucro líquido")).toBeInTheDocument();
  });

  it("próximos vencimentos listados", () => {
    setup();
    expect(screen.getByText("Construtora Alfa")).toBeInTheDocument();
    expect(screen.getByText("Hoje")).toBeInTheDocument();
  });
});
