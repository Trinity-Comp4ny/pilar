import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { sb } from "@/pages/financeiro/testing/supabaseMock";

// Relatório de rentabilidade (spec 037): margem por projeto e por cliente,
// filtros, totais, exportação CSV/PDF e drill-down das linhas do projeto.

const autoTable = vi.fn();
const pdf = { setFontSize: vi.fn(), setTextColor: vi.fn(), text: vi.fn(), save: vi.fn() };

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/financeiro/testing/supabaseMock")).sb.client,
}));
vi.mock("@/components/ui/select", async () => await import("@/pages/financeiro/testing/nativeSelect"));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("jspdf", () => ({
  default: vi.fn(function JsPdf() {
    return pdf;
  }),
}));
vi.mock("jspdf-autotable", () => ({ default: (...a: unknown[]) => autoTable(...a) }));

import { toast } from "sonner";
import RelatoriosRentabilidade from "./RelatoriosRentabilidade";

const rpcRows = [
  {
    projeto_id: "p1",
    projeto_nome: "Casa Verde",
    codigo_projeto: "PRJ-1",
    status: "Em andamento",
    valor_contrato: 100000,
    receitas_total: 80000,
    despesas_diretas: 20000,
    custo_mao_de_obra: 10000,
  },
  {
    projeto_id: "p2",
    projeto_nome: '=HYPERLINK("x")',
    codigo_projeto: "PRJ-2",
    status: "Concluído",
    valor_contrato: "50000",
    receitas_total: 10000,
    despesas_diretas: 15000,
    custo_mao_de_obra: null,
  },
  {
    projeto_id: "p3",
    projeto_nome: "Galpão, Norte",
    codigo_projeto: null,
    status: null,
    valor_contrato: null,
    receitas_total: 30000,
    despesas_diretas: 0,
    custo_mao_de_obra: 0,
  },
];
const projetos = [
  { id: "p1", cliente_id: "c1", clientes: { nome: "Construtora Alfa" } },
  { id: "p2", cliente_id: "c1", clientes: { nome: "Construtora Alfa" } },
  { id: "p3", cliente_id: "c2", clientes: { nome: "Beta Incorporações" } },
];

function setup(modo: "projeto" | "cliente" = "projeto") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RelatoriosRentabilidade modo={modo} />
    </QueryClientProvider>
  );
}

const linhasTabela = () => within(screen.getByRole("table")).getAllByRole("row").slice(1, -1);
const rodape = () => within(screen.getByRole("table")).getAllByRole("row").at(-1) as HTMLElement;

let csvLinhas: string[] = [];
const createObjectURL = vi.fn((b: Blob) => {
  void b.text().then((t) => (csvLinhas = t.split("\n")));
  return "blob:x";
});
const revokeObjectURL = vi.fn();
const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

beforeEach(() => {
  vi.clearAllMocks();
  sb.reset();
  csvLinhas = [];
  sb.rpcResultado("rpc_dashboard_rentabilidade", { data: rpcRows, error: null });
  sb.resultado("projetos.select", { data: projetos, error: null });
  Object.assign(URL, { createObjectURL, revokeObjectURL });
});

afterEach(() => {
  clickSpy.mockClear();
});

describe("RelatoriosRentabilidade: estados", () => {
  it("erro do RPC (sem permissão financeira) mostra a mensagem", async () => {
    sb.rpcResultado("rpc_dashboard_rentabilidade", { data: null, error: new Error("Acesso negado ao financeiro") });
    setup();
    expect(await screen.findByText("Não foi possível carregar a rentabilidade")).toBeInTheDocument();
    expect(screen.getByText("Acesso negado ao financeiro")).toBeInTheDocument();
  });

  it("erro ao buscar clientes dos projetos também vira erro", async () => {
    sb.resultado("projetos.select", { data: null, error: { message: "boom" } });
    setup();
    expect(await screen.findByText("Não foi possível carregar a rentabilidade")).toBeInTheDocument();
    expect(screen.getByText("Tente gerar o relatório novamente.")).toBeInTheDocument();
  });

  it("sem projetos mostra o vazio e não busca clientes", async () => {
    sb.rpcResultado("rpc_dashboard_rentabilidade", { data: [], error: null });
    setup();
    expect(await screen.findByText("Sem projetos para calcular rentabilidade")).toBeInTheDocument();
    expect(sb.client.from).not.toHaveBeenCalled();
  });

  it("resposta não-lista do RPC é tratada como vazia", async () => {
    sb.rpcResultado("rpc_dashboard_rentabilidade", { data: { foo: 1 }, error: null });
    setup();
    expect(await screen.findByText("Sem projetos para calcular rentabilidade")).toBeInTheDocument();
  });
});

describe("RelatoriosRentabilidade: por projeto", () => {
  it("ordena por margem, inclui mão de obra no custo e mostra os totais", async () => {
    setup();
    await screen.findByRole("table");
    const linhas = linhasTabela();
    expect(linhas.map((l) => within(l).getAllByRole("cell")[0].textContent)).toEqual([
      "Casa Verde",
      "Galpão, Norte",
      '=HYPERLINK("x")',
    ]);
    // Casa Verde: 80k - (20k + 10k) = 50k (62,5%)
    expect(linhas[0]).toHaveTextContent(/R\$\s?30\.000,00.*R\$\s?50\.000,00.*62\.5%/);
    // projeto sem status vira "-"; margem negativa em vermelho
    expect(linhas[1]).toHaveTextContent("-");
    expect(within(linhas[2]).getByText("-50.0%").className).toMatch(/negative/);
    // totais: receita 120k, custo 45k, margem 75k
    expect(rodape()).toHaveTextContent(/TOTAL.*R\$\s?120\.000,00.*R\$\s?45\.000,00.*R\$\s?75\.000,00.*62\.5%/);
    expect(screen.getByText("Margem (62.5%)")).toBeInTheDocument();
    expect(sb.de("projetos", "in")[0].args).toEqual(["id", ["p1", "p2", "p3"]]);
  });

  it("filtra por cliente e status, mostra 'de N' e limpa", async () => {
    setup();
    await screen.findByRole("table");
    const selCliente = screen.getByRole("combobox", { name: "Filtrar por cliente" });
    const opcoes = within(selCliente)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(opcoes).toEqual(["(vazio)", "Beta Incorporações", "Construtora Alfa"]);
    // status "-" não vira opção
    const selStatus = screen.getByRole("combobox", { name: "Filtrar por status" });
    expect(
      within(selStatus)
        .getAllByRole("option")
        .map((o) => o.textContent)
    ).toEqual(["(vazio)", "Concluído", "Em andamento"]);

    fireEvent.change(selCliente, { target: { value: "Construtora Alfa" } });
    expect(linhasTabela()).toHaveLength(2);
    expect(screen.getByText("2 de 3")).toBeInTheDocument();
    fireEvent.change(selStatus, { target: { value: "Concluído" } });
    expect(linhasTabela()).toHaveLength(1);
    expect(screen.getByText("Margem (-50.0%)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Limpar/ }));
    expect(linhasTabela()).toHaveLength(3);
    expect(screen.queryByText(/de 3/)).not.toBeInTheDocument();
  });

  it("filtro sem resultado mostra a mensagem da tabela", async () => {
    setup();
    await screen.findByRole("table");
    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por cliente" }), {
      target: { value: "Beta Incorporações" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por status" }), {
      target: { value: "Concluído" },
    });
    expect(screen.getByText("Nenhum projeto com os filtros aplicados.")).toBeInTheDocument();
  });

  it("clicar no projeto abre o detalhe com as linhas da margem", async () => {
    sb.rpcResultado("get_projeto_rentabilidade_detalhe", {
      data: {
        receitas: [{ descricao: "Parcela 1", valor: 80000, status: "Recebido", data: "2026-09-10" }],
        despesas_diretas: [{ descricao: null, valor: 20000, fornecedor: "Votoran" }],
        custo_mo: [],
      },
      error: null,
    });
    setup();
    await screen.findByRole("table");
    fireEvent.click(screen.getByText("Casa Verde"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("De onde vem a margem")).toBeInTheDocument();
    expect(await within(dialog).findByText("Parcela 1")).toBeInTheDocument();
    expect(within(dialog).getByText("Sem descrição")).toBeInTheDocument();
    expect(within(dialog).getByText(/Votoran/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Nenhuma hora apontada/)).toBeInTheDocument();
    expect(within(dialog).getByText("Nenhum marco de faturamento definido.")).toBeInTheDocument();
    expect(sb.argsRpc("get_projeto_rentabilidade_detalhe")).toEqual({ p_projeto_id: "p1" });
  });

  it("erro no detalhe avisa dentro do diálogo", async () => {
    sb.rpcResultado("get_projeto_rentabilidade_detalhe", { data: null, error: { message: "boom" } });
    setup();
    await screen.findByRole("table");
    fireEvent.click(screen.getByText("Casa Verde"));
    expect(await screen.findByText(/Não foi possível carregar o detalhe/)).toBeInTheDocument();
  });
});

describe("RelatoriosRentabilidade: por cliente", () => {
  it("agrega por cliente, sem filtros", async () => {
    setup("cliente");
    await screen.findByRole("table");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    const linhas = linhasTabela();
    expect(linhas).toHaveLength(2);
    // Alfa: receita 90k, custo 45k, margem 45k, 2 projetos, contrato 150k
    expect(linhas[0]).toHaveTextContent(/Construtora Alfa\s*2\s*R\$\s?150\.000,00\s*R\$\s?90\.000,00/);
    expect(linhas[1]).toHaveTextContent("Beta Incorporações");
    expect(rodape()).toHaveTextContent(/TOTAL.*R\$\s?120\.000,00/);
  });
});

describe("RelatoriosRentabilidade: exportação", () => {
  it("CSV com cabeçalho, linhas escapadas, proteção contra fórmula e total", async () => {
    setup();
    await screen.findByRole("table");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /CSV/ }));
    });
    await waitFor(() => expect(csvLinhas.length).toBeGreaterThan(0));
    expect(csvLinhas[0]).toBe("Projeto,Cliente,Status,Contrato,Receita,Custo,Margem,Margem %");
    expect(csvLinhas[1]).toMatch(/^Casa Verde,Construtora Alfa,Em andamento,/);
    // vírgula entre aspas
    expect(csvLinhas[2]).toMatch(/^"Galpão, Norte",Beta Incorporações,-?/);
    // célula que começa com = vira texto
    expect(csvLinhas[3].startsWith(`"'=HYPERLINK(""x"")"`)).toBe(true);
    expect(csvLinhas[4]).toMatch(/^TOTAL,,,,/);
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:x");
    expect(toast.success).toHaveBeenCalledWith("Exportação iniciada", expect.anything());
  });

  it("CSV por cliente usa as colunas do modo", async () => {
    setup("cliente");
    await screen.findByRole("table");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /CSV/ }));
    });
    await waitFor(() => expect(csvLinhas.length).toBeGreaterThan(0));
    expect(csvLinhas[0]).toBe("Cliente,Projetos,Contrato,Receita,Custo,Margem,Margem %");
    expect(csvLinhas[1]).toMatch(/^Construtora Alfa,2,/);
  });

  it("sem linhas filtradas não exporta", async () => {
    setup();
    await screen.findByRole("table");
    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por cliente" }), {
      target: { value: "Beta Incorporações" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por status" }), {
      target: { value: "Concluído" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /CSV/ }));
    });
    expect(toast.error).toHaveBeenCalledWith("Sem dados", { description: "Não há dados para exportar." });
    expect(createObjectURL).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /PDF/ }));
    });
    expect(autoTable).not.toHaveBeenCalled();
  });

  it("PDF com título do modo, linhas e total em destaque", async () => {
    setup("cliente");
    await screen.findByRole("table");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /PDF/ }));
    });
    await waitFor(() => expect(pdf.save).toHaveBeenCalled());
    expect(pdf.text).toHaveBeenCalledWith("Rentabilidade por cliente", 14, 16);
    const opts = autoTable.mock.calls[0][1] as {
      head: string[][];
      body: string[][];
      didParseCell: (h: unknown) => void;
    };
    expect(opts.head[0][0]).toBe("Cliente");
    expect(opts.body).toHaveLength(3);
    expect(opts.body[2][0]).toBe("TOTAL");
    const celula = { styles: {} as Record<string, unknown> };
    opts.didParseCell({ section: "body", row: { index: 2 }, cell: celula });
    expect(celula.styles.fontStyle).toBe("bold");
    const outra = { styles: {} as Record<string, unknown> };
    opts.didParseCell({ section: "body", row: { index: 0 }, cell: outra });
    expect(outra.styles.fontStyle).toBeUndefined();
    expect(String(pdf.save.mock.calls[0][0])).toMatch(/^relatorio-rentabilidade-cliente-\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it("falha ao gerar o PDF avisa o erro", async () => {
    pdf.save.mockImplementationOnce(() => {
      throw new Error("sem memória");
    });
    setup();
    await screen.findByRole("table");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /PDF/ }));
    });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Erro ao exportar", { description: "sem memória" }));
    expect(toast.success).not.toHaveBeenCalled();
  });
});
