import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { sb } from "@/pages/financeiro/testing/supabaseMock";

// Página de Relatórios: escolher o tipo gera a prévia, o resumo (receitas,
// despesas, saldo) e o rodapé batem com as linhas, filtros de coluna recortam
// os totais e exportar envia só as colunas visíveis.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/financeiro/testing/supabaseMock")).sb.client,
}));
vi.mock("@/components/ui/select", async () => await import("@/pages/financeiro/testing/nativeSelect"));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/analytics", () => ({ analytics: { track: vi.fn() } }));
vi.mock("./relatorios/RelatoriosChart", () => ({ default: () => <div>grafico</div> }));
vi.mock("./relatorios/RelatoriosRentabilidade", () => ({
  default: ({ modo }: { modo: string }) => <div>rentabilidade-{modo}</div>,
}));
const exportar = { csv: vi.fn(), xlsx: vi.fn(), pdf: vi.fn() };
vi.mock("./relatorios/relatorioExport", async (orig) => ({
  ...(await orig<typeof import("./relatorios/relatorioExport")>()),
  generateCSV: (...a: unknown[]) => exportar.csv(...a),
  generateXLSX: (...a: unknown[]) => exportar.xlsx(...a),
  generatePDF: (...a: unknown[]) => exportar.pdf(...a),
}));

import { toast } from "sonner";
import Relatorios from "./Relatorios";

const nbsp = (s: string | null) => (s ?? "").replace(/\u00a0/g, " ");

const receitas = [
  {
    descricao: "Honorários A",
    valor: 10000,
    data_vencimento: "2026-10-10",
    data_recebimento: "2026-10-09",
    status: "Recebido",
    nota_fiscal: null,
    observacao: null,
    parcela_numero: null,
    parcela_total: null,
    projetos: { nome: "Aurora" },
    clientes: { nome: "Alfa" },
    categorias_financeiras: { nome: "Honorários" },
    contas: { nome: "Itaú" },
  },
];
const despesas = [
  {
    descricao: "Aluguel",
    valor: 3000.25,
    data_vencimento: "2026-10-05",
    data_pagamento: "2026-10-05",
    status: "Pago",
    nota_fiscal: null,
    observacao: null,
    parcela_numero: null,
    parcela_total: null,
    projetos: null,
    fornecedores: { nome: "Imob" },
    categorias_financeiras: { nome: "Aluguel" },
    contas: { nome: "Itaú" },
  },
];

beforeAll(() => {
  // Checkbox do Radix mede com ResizeObserver; o jsdom não tem.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  sb.reset();
  localStorage.clear();
  sb.resultado("receitas.select", { data: receitas, error: null });
  sb.resultado("despesas.select", { data: despesas, error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

function setup() {
  const user = userEvent.setup();
  render(<Relatorios />);
  return { user };
}

describe("Relatorios", () => {
  it("estado inicial oferece os tipos de relatório", () => {
    setup();
    expect(screen.getByText("Escolha um relatório para começar")).toBeInTheDocument();
    for (const t of ["Financeiro", "Receitas", "Despesas", "Rentabilidade por projeto", "Rentabilidade por cliente"]) {
      expect(screen.getByRole("button", { name: new RegExp(`^${t}`) })).toBeInTheDocument();
    }
  });

  it("gerar prévia sem tipo pede para escolher", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /Gerar prévia/ }));
    expect(toast.error).toHaveBeenCalledWith("Selecione um tipo", expect.anything());
    expect(sb.client.from).not.toHaveBeenCalled();
  });

  it("financeiro: resumo com receitas, despesas e saldo; rodapé com saldo", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /^Financeiro/ }));
    await screen.findByText("Honorários A");
    const corpo = nbsp(document.body.textContent);
    expect(corpo).toContain("R$ 10.000,00");
    expect(corpo).toContain("R$ 3.000,25");
    // Saldo 10.000,00 − 3.000,25
    expect(corpo).toContain("R$ 6.999,75");
    expect(screen.getAllByText("Saldo").length).toBeGreaterThan(0);
  });

  it("filtro de coluna recorta linhas e totais", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /^Financeiro/ }));
    await screen.findByText("Honorários A");
    await user.selectOptions(screen.getByRole("combobox", { name: "Categoria" }), "Aluguel");
    await waitFor(() => expect(screen.queryByText("Honorários A")).not.toBeInTheDocument());
    expect(screen.getByText("Imob", { selector: "td" })).toBeInTheDocument();
    expect(nbsp(document.body.textContent)).not.toContain("R$ 6.999,75");
  });

  it("exportar CSV envia as linhas filtradas e só as colunas visíveis, na ordem", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /^Despesas/ }));
    await screen.findByText("Imob", { selector: "td" });
    await user.click(screen.getByRole("button", { name: /Exportar/ }));
    await user.click(await screen.findByRole("menuitem", { name: "CSV" }));
    expect(exportar.csv).toHaveBeenCalledTimes(1);
    const [linhas, colunas, arquivo] = exportar.csv.mock.calls[0];
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ Tipo: "Despesa", Valor: 3000.25 });
    expect(colunas).toEqual([
      "Tipo",
      "Descrição",
      "Valor",
      "Dt. Vencimento",
      "Status",
      "Cliente / Fornecedor",
      "Categoria",
    ]);
    expect(arquivo).toMatch(/^relatorio-despesas-\d{4}-\d{2}-\d{2}$/);
    expect(toast.success).toHaveBeenCalledWith("Exportação iniciada", expect.anything());
  });

  it("exportar PDF leva título e período", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /^Receitas/ }));
    await screen.findByText("Honorários A");
    await user.click(screen.getByRole("button", { name: /Exportar/ }));
    await user.click(await screen.findByRole("menuitem", { name: "PDF" }));
    await waitFor(() => expect(exportar.pdf).toHaveBeenCalled());
    expect(exportar.pdf.mock.calls[0][2]).toMatchObject({ title: "Relatório de Receitas • Início a Fim" });
  });

  it("falha na exportação avisa", async () => {
    exportar.xlsx.mockRejectedValueOnce(new Error("disco cheio"));
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /^Receitas/ }));
    await screen.findByText("Honorários A");
    await user.click(screen.getByRole("button", { name: /Exportar/ }));
    await user.click(await screen.findByRole("menuitem", { name: /Excel/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Erro ao exportar", { description: "disco cheio" }));
  });

  it("período sem dados avisa e não mostra tabela", async () => {
    sb.resultado("receitas.select", { data: [], error: null });
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /^Receitas/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Sem dados", expect.anything()));
    expect(screen.queryByRole("button", { name: /Exportar/ })).not.toBeInTheDocument();
  });

  it("rentabilidade abre o relatório próprio sem buscar receitas/despesas", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /^Rentabilidade por cliente/ }));
    expect(await screen.findByText("rentabilidade-cliente")).toBeInTheDocument();
    expect(sb.client.from).not.toHaveBeenCalled();
  });

  it("esconder coluna tira do export", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /^Despesas/ }));
    await screen.findByText("Imob", { selector: "td" });
    await user.click(screen.getByRole("button", { name: /Colunas/ }));
    const painel = (await screen.findByText("Colunas visíveis")).closest("[role=dialog]") as HTMLElement;
    await user.click(within(painel).getByRole("checkbox", { name: "Categoria" }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: /Exportar/ }));
    await user.click(await screen.findByRole("menuitem", { name: "CSV" }));
    expect(exportar.csv.mock.calls[0][1]).not.toContain("Categoria");
  });
});
