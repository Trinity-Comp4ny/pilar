import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fake, rpcComEmpresa } from "@/pages/obras/testing/supabaseFake";

// Físico-financeiro (spec 165, grade em leitura): estados vazios, a grade com percentual e valor por mês,
// escala trimestral, recolher, aviso de itens sem data e planejamento manual que não fecha 100%.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/obras/testing/supabaseFake")).fake.supabase,
}));
vi.mock("@/hooks/useMoneyMask", () => ({
  useMoneyMask: () => (v: number) =>
    `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
}));

vi.mock("@/lib/analytics", () => ({ analytics: { track: vi.fn() } }));

const baixar = vi.hoisted(() => ({ xlsx: vi.fn(async () => undefined), pdf: vi.fn(async () => undefined) }));
vi.mock("@/pages/obras/lib/exportarFisicoFinanceiro", async (orig) => ({
  ...(await orig<typeof import("@/pages/obras/lib/exportarFisicoFinanceiro")>()),
  baixarXLSX: baixar.xlsx,
  baixarPDF: baixar.pdf,
}));

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const grafico = vi.hoisted(() => ({ props: null as null | { pontos: unknown[]; mesAtual: string } }));
vi.mock("./FisicoFinanceiroChart", () => ({
  FisicoFinanceiroChart: (p: { pontos: unknown[]; mesAtual: string }) => {
    grafico.props = p;
    return <div data-testid="grafico" />;
  },
}));

import { ObraFisicoFinanceiro } from "./ObraFisicoFinanceiro";

const no = (
  id: string,
  parent_id: string | null,
  nivel: string,
  nome: string,
  ordem: number,
  ini: string | null,
  fim: string | null
) => ({
  id,
  obra_id: "o-1",
  empresa_id: "emp-1",
  parent_id,
  nivel,
  nome,
  ordem,
  data_inicio: ini,
  data_fim: fim,
  fornecedor_id: null,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
});

const FRENTES = [
  no("f1", null, "fase", "Fundação", 1, null, null),
  no("e1", "f1", "etapa", "Sapatas e vigas", 1, null, null),
  no("s1", "e1", "servico", "Sapatas", 1, "2026-11-15", "2026-12-15"),
  no("s2", "e1", "servico", "Vigas", 2, "2027-01-04", "2027-01-31"),
];

const ORC = [
  { id: "p1", obra_id: "o-1", obra_frente_id: "s1", empresa_id: "emp-1", valor_previsto: 30000 },
  { id: "p2", obra_id: "o-1", obra_frente_id: "s2", empresa_id: "emp-1", valor_previsto: 10000 },
];

function dados(over: Partial<Record<string, unknown[]>> = {}) {
  const t: Record<string, unknown[]> = {
    obra_frente: FRENTES,
    tarefas: [],
    obra_orcamento_etapa: ORC,
    obra_planejamento_mes: [],
    ...over,
  };
  fake.responder((c) => (c.op === "select" && t[c.tabela] ? { data: t[c.tabela], error: null } : undefined));
}

function montar(props: Partial<Parameters<typeof ObraFisicoFinanceiro>[0]> = {}) {
  const onIrParaConta = vi.fn();
  const onIrParaCronograma = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  render(
    <ObraFisicoFinanceiro
      obraId="o-1"
      onIrParaConta={onIrParaConta}
      onIrParaCronograma={onIrParaCronograma}
      {...props}
    />,
    {
      wrapper: Wrapper,
    }
  );
  return { onIrParaConta, onIrParaCronograma };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  fake.reset();
  rpcComEmpresa();
  grafico.props = null;
});

describe("ObraFisicoFinanceiro", () => {
  it("mostra a grade com percentual e valor por mês e o acumulado", async () => {
    dados();
    montar();
    const linha = await screen.findByTestId("ff-s1");
    // 15/11 a 15/12: 16 de 31 dias em novembro.
    expect(within(linha).getByText("51,6%")).toBeInTheDocument();
    expect(within(linha).getByText("R$ 15.483,87")).toBeInTheDocument();
    expect(within(linha).getByText("48,4%")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "nov/26" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "jan/27" })).toBeInTheDocument();
    // O eixo é contínuo: fevereiro não existe, mas dezembro e janeiro sim.
    expect(screen.getByRole("columnheader", { name: "dez/26" })).toBeInTheDocument();
    const acumulado = screen.getByRole("row", { name: /Acumulado/ });
    expect(within(acumulado).getByText("100%")).toBeInTheDocument();
  });

  it("entrega ao gráfico o planejado acumulado e o realizado das despesas", async () => {
    // Só a data é falsa: o relógio dos timers segue real para o React Query.
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2027-03-15T12:00:00") });
    dados({
      obra_conta_lancamento: [
        { id: "l1", tipo: "aporte", data: "2026-11-02", valor: 99999, descricao: "Aporte" },
        { id: "l2", tipo: "despesa", data: "2026-11-10", valor: 12000, descricao: "Concreto" },
        { id: "l3", tipo: "despesa", data: "2026-12-05", valor: 3000, descricao: "Ferro" },
      ],
    });
    montar();
    await screen.findByTestId("grafico");
    const pontos = grafico.props!.pontos as {
      mes: string;
      planejadoAcumulado: number;
      realizadoAcumulado: number | null;
    }[];
    const por = (mes: string) => pontos.find((p) => p.mes === mes)!;
    expect(por("2026-11").planejadoAcumulado).toBe(15483.87);
    expect(por("2026-12").planejadoAcumulado).toBe(30000);
    expect(por("2027-01").planejadoAcumulado).toBe(40000);
    // Só despesa conta como realizado; aporte não entra.
    expect(por("2026-11").realizadoAcumulado).toBe(12000);
    expect(por("2026-12").realizadoAcumulado).toBe(15000);
    expect(grafico.props!.mesAtual).toBe("2027-03");
    vi.useRealTimers();
  });

  it("agrega a etapa e a fase pelos serviços", async () => {
    dados();
    montar();
    const fase = await screen.findByTestId("ff-f1");
    expect(within(fase).getByText("R$ 40.000,00")).toBeInTheDocument();
  });

  it("recolher a fase esconde as linhas de baixo", async () => {
    dados();
    montar();
    await screen.findByTestId("ff-s1");
    fireEvent.click(screen.getByRole("button", { name: "Recolher Fundação" }));
    expect(screen.queryByTestId("ff-s1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ff-e1")).not.toBeInTheDocument();
    expect(screen.getByTestId("ff-f1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Expandir Fundação" }));
    expect(screen.getByTestId("ff-s1")).toBeInTheDocument();
  });

  it("a escala trimestral agrupa os meses e mantém o total", async () => {
    dados();
    montar();
    await screen.findByTestId("ff-s1");
    fireEvent.click(screen.getByRole("button", { name: "Trimestral" }));
    expect(screen.getByRole("columnheader", { name: "T4/26" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "T1/27" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "nov/26" })).not.toBeInTheDocument();
    const s1 = screen.getByTestId("ff-s1");
    expect(within(s1).getByText("R$ 30.000,00", { selector: "span" })).toBeInTheDocument();
  });

  it("sem previsto em nenhum nó: convida a preencher o orçado e leva à conta", async () => {
    dados({ obra_orcamento_etapa: [] });
    const { onIrParaConta } = montar();
    expect(await screen.findByText("Preencha o orçado para planejar o desembolso")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ir para a conta da obra" }));
    expect(onIrParaConta).toHaveBeenCalled();
  });

  it("com previsto e sem nenhuma data: pede datas e leva ao cronograma", async () => {
    dados({ obra_frente: FRENTES.map((f) => ({ ...f, data_inicio: null, data_fim: null })) });
    const { onIrParaCronograma } = montar();
    expect(await screen.findByText("Defina datas no cronograma para distribuir o desembolso")).toBeInTheDocument();
    expect(screen.getByText(/R\$ 40\.000,00 previstos em 2 itens/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Abrir o cronograma" }));
    expect(onIrParaCronograma).toHaveBeenCalled();
  });

  it("sem acesso ao cronograma, o estado de datas não oferece o botão", async () => {
    dados({ obra_frente: FRENTES.map((f) => ({ ...f, data_inicio: null, data_fim: null })) });
    montar({ onIrParaCronograma: undefined });
    await screen.findByText("Defina datas no cronograma para distribuir o desembolso");
    expect(screen.queryByRole("button", { name: "Abrir o cronograma" })).not.toBeInTheDocument();
  });

  it("item sem data entra na coluna 'Sem data' e o aviso cita valor e quantidade", async () => {
    dados({ obra_frente: FRENTES.map((f) => (f.id === "s2" ? { ...f, data_inicio: null, data_fim: null } : f)) });
    montar();
    const aviso = await screen.findByText(/em 1 item sem data/);
    expect(aviso).toHaveTextContent("R$ 10.000,00");
    expect(screen.getByRole("columnheader", { name: "Sem data" })).toBeInTheDocument();
    // Previsto e "Sem data" mostram o mesmo valor: a última célula da linha é a coluna "Sem data".
    const celulas = within(screen.getByTestId("ff-s2")).getAllByText("R$ 10.000,00");
    expect(celulas).toHaveLength(2);
    expect(celulas[1].closest("td")).toBe(screen.getByTestId("ff-s2").lastElementChild);
  });

  it("nó manual mostra a marca e quanto passou de 100%", async () => {
    dados({
      obra_planejamento_mes: [
        { id: "m1", obra_id: "o-1", obra_frente_id: "s1", empresa_id: "emp-1", mes: "2026-11-01", percentual: 51.6 },
        { id: "m2", obra_id: "o-1", obra_frente_id: "s1", empresa_id: "emp-1", mes: "2026-12-01", percentual: 70 },
      ],
    });
    montar();
    const linha = await screen.findByTestId("ff-s1");
    expect(within(linha).getByText(/Manual/)).toBeInTheDocument();
    expect(within(linha).getByText(/passou 21,6%/)).toBeInTheDocument();
    expect(screen.getByText(/O planejamento manual não fecha o previsto/)).toBeInTheDocument();
  });

  it("erro de servidor mostra o estado de erro com nova tentativa", async () => {
    fake.responder(() => ({ data: null, error: { message: "falhou" } }));
    montar();
    expect(await screen.findByText("Não foi possível carregar o físico-financeiro")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });
});

describe("ObraFisicoFinanceiro: edição de célula", () => {
  const editar = (nome: string, rotulo: string) =>
    screen.getByRole("button", { name: `Editar percentual de ${nome} em ${rotulo}` });
  const gravacoes = () => fake.escritas("obra_planejamento_mes");

  it("sem permissão de edição não há célula editável nem ação no nó", async () => {
    dados();
    montar();
    await screen.findByTestId("ff-s1");
    expect(screen.queryByRole("button", { name: /Editar percentual/ })).not.toBeInTheDocument();
  });

  it("editar um mês grava o nó inteiro (todos os meses) e o torna manual", async () => {
    dados();
    montar({ canEdit: true });
    await screen.findByTestId("ff-s1");
    fireEvent.click(editar("Sapatas", "dez/26"));
    const campo = screen.getByRole("textbox", { name: "Percentual de Sapatas em dez/26" });
    fireEvent.change(campo, { target: { value: "70" } });
    fireEvent.keyDown(campo, { key: "Enter" });

    await waitFor(() => expect(gravacoes().length).toBeGreaterThan(0));
    const upsert = gravacoes()[0];
    expect(upsert.op).toBe("upsert");
    expect(upsert.payload).toEqual([
      { empresa_id: "emp-1", obra_id: "o-1", obra_frente_id: "s1", mes: "2026-11-01", percentual: 51.6129 },
      { empresa_id: "emp-1", obra_id: "o-1", obra_frente_id: "s1", mes: "2026-12-01", percentual: 70 },
      { empresa_id: "emp-1", obra_id: "o-1", obra_frente_id: "s1", mes: "2027-01-01", percentual: 0 },
    ]);
  });

  it("aceita vírgula no percentual", async () => {
    dados();
    montar({ canEdit: true });
    await screen.findByTestId("ff-s1");
    fireEvent.click(editar("Sapatas", "dez/26"));
    const campo = screen.getByRole("textbox", { name: "Percentual de Sapatas em dez/26" });
    fireEvent.change(campo, { target: { value: "12,5" } });
    fireEvent.keyDown(campo, { key: "Enter" });
    await waitFor(() => expect(gravacoes().length).toBeGreaterThan(0));
    expect(
      (gravacoes()[0].payload as { mes: string; percentual: number }[]).find((c) => c.mes === "2026-12-01")!.percentual
    ).toBe(12.5);
  });

  it("valor inválido no Enter mantém o campo aberto marcado como inválido e não grava", async () => {
    dados();
    montar({ canEdit: true });
    await screen.findByTestId("ff-s1");
    fireEvent.click(editar("Sapatas", "dez/26"));
    const campo = screen.getByRole("textbox", { name: "Percentual de Sapatas em dez/26" });
    fireEvent.change(campo, { target: { value: "150" } });
    fireEvent.keyDown(campo, { key: "Enter" });
    expect(screen.getByRole("textbox", { name: "Percentual de Sapatas em dez/26" })).toHaveAttribute(
      "aria-invalid",
      "true"
    );
    expect(gravacoes()).toHaveLength(0);
  });

  it("Esc cancela e sair do campo sem mudar o valor não grava nem deixa o nó manual", async () => {
    dados();
    montar({ canEdit: true });
    await screen.findByTestId("ff-s1");
    fireEvent.click(editar("Sapatas", "dez/26"));
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Percentual de Sapatas em dez/26" }), { key: "Escape" });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    fireEvent.click(editar("Sapatas", "nov/26"));
    fireEvent.blur(screen.getByRole("textbox", { name: "Percentual de Sapatas em nov/26" }));
    expect(gravacoes()).toHaveLength(0);
  });

  it("nó que só soma filhos não é editável", async () => {
    dados();
    montar({ canEdit: true });
    await screen.findByTestId("ff-e1");
    expect(screen.queryByRole("button", { name: /Editar percentual de Sapatas e vigas/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Editar percentual de Fundação/ })).not.toBeInTheDocument();
  });

  it("na escala trimestral a edição some e a tela explica", async () => {
    dados();
    montar({ canEdit: true });
    await screen.findByTestId("ff-s1");
    fireEvent.click(screen.getByRole("button", { name: "Trimestral" }));
    expect(screen.queryByRole("button", { name: /Editar percentual/ })).not.toBeInTheDocument();
    expect(screen.getByText("Para ajustar um mês, volte à escala mensal.")).toBeInTheDocument();
  });

  it("'Voltar ao automático' apaga o ajuste do nó e avisa", async () => {
    dados({
      obra_planejamento_mes: [
        { id: "m1", obra_id: "o-1", obra_frente_id: "s1", empresa_id: "emp-1", mes: "2026-11-01", percentual: 100 },
      ],
    });
    montar({ canEdit: true });
    await screen.findByTestId("ff-s1");
    fireEvent.click(screen.getByRole("button", { name: "Voltar ao automático" }));
    await waitFor(() => expect(gravacoes()).toHaveLength(1));
    expect(gravacoes()[0].op).toBe("delete");
    expect(gravacoes()[0].filtros).toContainEqual(["eq", "obra_frente_id", "s1"]);
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Voltou a seguir o cronograma", { description: "Sapatas" })
    );
  });

  it("nó manual com mês fora do período atual avisa e oferece 'Redistribuir'", async () => {
    dados({
      obra_planejamento_mes: [
        { id: "m1", obra_id: "o-1", obra_frente_id: "s1", empresa_id: "emp-1", mes: "2026-11-01", percentual: 50 },
        { id: "m2", obra_id: "o-1", obra_frente_id: "s1", empresa_id: "emp-1", mes: "2027-02-01", percentual: 50 },
      ],
    });
    montar({ canEdit: true });
    const linha = await screen.findByTestId("ff-s1");
    expect(within(linha).getByText(/não acompanha as datas/)).toBeInTheDocument();
    expect(within(linha).getByRole("button", { name: "Redistribuir" })).toBeInTheDocument();
    expect(within(linha).queryByRole("button", { name: "Voltar ao automático" })).not.toBeInTheDocument();
  });

  it("erro ao gravar mostra aviso", async () => {
    dados();
    fake.responder((c) => {
      if (c.op === "upsert") return { data: null, error: { message: "violates row-level security" } };
      return c.op === "select"
        ? {
            data: (
              { obra_frente: FRENTES, tarefas: [], obra_orcamento_etapa: ORC, obra_planejamento_mes: [] } as Record<
                string,
                unknown[]
              >
            )[c.tabela],
            error: null,
          }
        : undefined;
    });
    montar({ canEdit: true });
    await screen.findByTestId("ff-s1");
    fireEvent.click(editar("Sapatas", "dez/26"));
    const campo = screen.getByRole("textbox", { name: "Percentual de Sapatas em dez/26" });
    fireEvent.change(campo, { target: { value: "70" } });
    fireEvent.keyDown(campo, { key: "Enter" });
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar o planejamento", {
        description: "violates row-level security",
      })
    );
  });

  it("exporta em Excel no nível escolhido, com o nome da obra", async () => {
    dados();
    montar({ obraNome: "Casa Ação" });
    await screen.findByTestId("ff-s1");
    fireEvent.keyDown(screen.getByRole("button", { name: "Exportar" }), { key: "Enter" });
    const itens = await screen.findAllByRole("menuitem", { name: "Tudo" });
    fireEvent.click(itens[0]);
    await waitFor(() => expect(baixar.xlsx).toHaveBeenCalledTimes(1));
    const [tabela, cab, nome] = baixar.xlsx.mock.calls[0] as unknown as [
      { linhas: unknown[][] },
      { obraNome: string },
      string,
    ];
    expect(cab.obraNome).toBe("Casa Ação");
    expect(nome).toMatch(/^fisico-financeiro-casa-acao-tudo-\d{4}-\d{2}-\d{2}$/);
    expect(tabela.linhas.length).toBeGreaterThan(2);
    expect(baixar.pdf).not.toHaveBeenCalled();
  });

  it("falha ao exportar mostra aviso e libera o botão", async () => {
    dados();
    baixar.pdf.mockRejectedValueOnce(new Error("x"));
    montar();
    await screen.findByTestId("ff-s1");
    fireEvent.keyDown(screen.getByRole("button", { name: "Exportar" }), { key: "Enter" });
    const itens = await screen.findAllByRole("menuitem", { name: "Fases" });
    fireEvent.click(itens[1]);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível exportar", { description: "Tente novamente." })
    );
  });
});
