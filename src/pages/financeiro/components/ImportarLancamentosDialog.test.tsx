import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { AuxData, ItemImport, ResumoImport } from "../hooks/useImportFinanceiro";

// Importação de lançamentos: arquivo (PDF -> texto + IA, Excel com escolha de
// aba, CSV), texto colado, revisão editável do preview, gravação em lote e desfazer.

const aux: AuxData = {
  categorias: [
    { id: "cat-mat", nome: "Material", tipo: "despesa" },
    { id: "cat-hon", nome: "Honorários", tipo: "receita" },
    { id: "cat-geral", nome: "Geral", tipo: null },
  ],
  contas: [{ id: "conta-1", nome: "Itaú PJ", banco: "Itaú" }],
  projetos: [{ id: "proj-1", nome: "Casa Verde" }],
  pendentes: [],
};

const hook = {
  auxQuery: { data: aux as AuxData | undefined, isLoading: false },
  listarAbas: vi.fn(async (_f: File): Promise<string[]> => ["Plan1"]),
  extrairArquivo: vi.fn(),
  extrairTextoIA: vi.fn(),
  gravarLote: vi.fn(),
  desfazer: vi.fn(async () => undefined),
  gravando: false,
  temDesfazer: true,
};
const extrairTextoPdf = vi.fn(async (_f: File) => "texto do pdf");
const reportInvokeError = vi.fn();

vi.mock("../hooks/useImportFinanceiro", () => ({ useImportFinanceiro: () => hook }));
vi.mock("@/lib/pdfText", () => ({ extrairTextoPdf: (f: File) => extrairTextoPdf(f) }));
vi.mock("@/lib/monitoring", () => ({ reportInvokeError: (...a: unknown[]) => reportInvokeError(...a) }));
vi.mock("@/components/ui/select", async () => await import("../testing/nativeSelect"));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: () => null,
}));

import { toast } from "sonner";
import { ImportarLancamentosDialog } from "./ImportarLancamentosDialog";

let seq = 0;
const item = (p: Partial<ItemImport> = {}): ItemImport => ({
  id: `it-${++seq}`,
  incluir: true,
  data: "2026-10-05",
  descricao: "Cimento Votoran",
  valor: 150,
  tipo: "despesa",
  categoriaId: null,
  categoriaSugerida: null,
  parcelaNumero: null,
  parcelaTotal: null,
  confianca: 0.9,
  lineHash: "h",
  duplicataId: null,
  acao: "criar",
  ...p,
});

const resumo: ResumoImport = { criados: 2, conciliados: 1, totalDespesa: 250, totalReceita: 1000 };

function setup() {
  const onImported = vi.fn();
  const onOpenChange = vi.fn();
  render(<ImportarLancamentosDialog open onOpenChange={onOpenChange} onImported={onImported} />);
  return { onImported, onOpenChange };
}

const inputArquivo = () => document.querySelector('input[type="file"]') as HTMLInputElement;
async function escolherArquivo(nome: string) {
  const f = new File(["x"], nome);
  await act(async () => {
    fireEvent.change(inputArquivo(), { target: { files: [f] } });
  });
  return f;
}
async function colarEExtrair(texto = "05/10 CIMENTO 150,00") {
  fireEvent.change(screen.getByPlaceholderText(/Cole aqui as linhas/), { target: { value: texto } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /Extrair com IA/ }));
  });
}
const linhas = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);

beforeEach(() => {
  vi.clearAllMocks();
  seq = 0;
  hook.auxQuery = { data: aux, isLoading: false };
  hook.gravando = false;
  hook.temDesfazer = true;
  hook.listarAbas.mockResolvedValue(["Plan1"]);
  hook.extrairArquivo.mockResolvedValue({ itens: [item()], avisos: [] });
  hook.extrairTextoIA.mockResolvedValue({
    itens: [item(), item({ descricao: "Honorários set", valor: 1000, tipo: "receita", confianca: 0.4 })],
    avisos: [],
  });
  hook.gravarLote.mockResolvedValue(resumo);
  extrairTextoPdf.mockResolvedValue("texto do pdf");
});

describe("ImportarLancamentosDialog: entrada", () => {
  it("carregando os dados auxiliares não mostra a entrada", () => {
    hook.auxQuery = { data: undefined, isLoading: true };
    setup();
    expect(screen.queryByRole("button", { name: /Escolher arquivo/ })).not.toBeInTheDocument();
  });

  it("PDF: lê o texto no navegador e manda para a IA com o tipo de documento", async () => {
    setup();
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "extrato" } });
    const f = await escolherArquivo("extrato.PDF");
    expect(extrairTextoPdf).toHaveBeenCalledWith(f);
    expect(hook.extrairTextoIA).toHaveBeenCalledWith("texto do pdf", "extrato", aux);
    expect(await screen.findByDisplayValue("Cimento Votoran")).toBeInTheDocument();
  });

  it("PDF digitalizado (sem texto) avisa e não chama a IA", async () => {
    extrairTextoPdf.mockResolvedValueOnce("   ");
    setup();
    await escolherArquivo("scan.pdf");
    expect(toast.error).toHaveBeenCalledWith("PDF sem texto legível", expect.anything());
    expect(hook.extrairTextoIA).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Escolher arquivo/ })).toBeEnabled();
  });

  it("erro ao ler o PDF reporta e avisa", async () => {
    extrairTextoPdf.mockRejectedValueOnce(new Error("PDF protegido"));
    setup();
    await escolherArquivo("x.pdf");
    expect(toast.error).toHaveBeenCalledWith("Erro ao ler arquivo", { description: "PDF protegido" });
    expect(reportInvokeError).toHaveBeenCalledWith(expect.any(Error), "financeiro-import:ler-arquivo");
  });

  it("CSV vai direto para o parsing determinístico", async () => {
    setup();
    const f = await escolherArquivo("gastos.csv");
    expect(hook.listarAbas).not.toHaveBeenCalled();
    expect(hook.extrairArquivo).toHaveBeenCalledWith(f, aux, undefined);
    expect(await screen.findByDisplayValue("Cimento Votoran")).toBeInTheDocument();
  });

  it("planilha sem nada reconhecível avisa", async () => {
    hook.extrairArquivo.mockResolvedValueOnce({ itens: [], avisos: ["linha 2: sem data"] });
    setup();
    await escolherArquivo("vazia.csv");
    expect(toast.error).toHaveBeenCalledWith("Nada reconhecido no arquivo", expect.anything());
    expect(screen.getByText("1 linha(s) não interpretada(s)")).toBeInTheDocument();
    expect(screen.getByText("linha 2: sem data")).toBeInTheDocument();
  });

  it("erro do parsing avisa", async () => {
    hook.extrairArquivo.mockRejectedValueOnce(new Error("Arquivo corrompido"));
    setup();
    await escolherArquivo("x.csv");
    expect(toast.error).toHaveBeenCalledWith("Erro ao ler arquivo", { description: "Arquivo corrompido" });
  });

  it("Excel de uma aba processa direto", async () => {
    setup();
    const f = await escolherArquivo("gastos.xlsx");
    expect(hook.listarAbas).toHaveBeenCalledWith(f);
    expect(hook.extrairArquivo).toHaveBeenCalledWith(f, aux, undefined);
  });

  it("Excel com várias abas pergunta qual usar e processa a escolhida", async () => {
    hook.listarAbas.mockResolvedValueOnce(["Resumo", "Lançamentos"]);
    setup();
    const f = await escolherArquivo("gastos.xlsx");
    expect(hook.extrairArquivo).not.toHaveBeenCalled();
    expect(screen.getByText("2 abas")).toBeInTheDocument();
    const selectAba = screen.getAllByRole("combobox")[1];
    expect(selectAba).toHaveValue("Resumo");
    fireEvent.change(selectAba, { target: { value: "Lançamentos" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Processar aba" }));
    });
    expect(hook.extrairArquivo).toHaveBeenCalledWith(f, aux, "Lançamentos");
    expect(screen.queryByText("Processar aba")).not.toBeInTheDocument();
  });

  it("cancelar a escolha de aba não processa", async () => {
    hook.listarAbas.mockResolvedValueOnce(["A", "B"]);
    setup();
    await escolherArquivo("gastos.xls");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByText("Processar aba")).not.toBeInTheDocument();
    expect(hook.extrairArquivo).not.toHaveBeenCalled();
  });

  it("texto colado: botão só habilita com texto; extrai com IA", async () => {
    setup();
    expect(screen.getByRole("button", { name: /Extrair com IA/ })).toBeDisabled();
    await colarEExtrair();
    expect(hook.extrairTextoIA).toHaveBeenCalledWith("05/10 CIMENTO 150,00", "extrato", aux);
    expect(linhas()).toHaveLength(2);
    // baixa confiança pede revisão
    expect(within(linhas()[1]).getByText("revisar")).toBeInTheDocument();
  });

  it("fatura de cartão força tudo como saída", async () => {
    setup();
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "fatura" } });
    await colarEExtrair();
    expect(within(linhas()[1]).getByRole("button", { name: /Saída/ })).toBeInTheDocument();
  });

  it("IA sem lançamentos avisa; erro da IA também", async () => {
    hook.extrairTextoIA.mockResolvedValueOnce({ itens: [], avisos: [] });
    setup();
    await colarEExtrair();
    expect(toast.error).toHaveBeenCalledWith("Nenhum lançamento extraído", { description: "Revise o texto." });

    hook.extrairTextoIA.mockRejectedValueOnce("timeout");
    await colarEExtrair();
    expect(toast.error).toHaveBeenCalledWith("Falha ao extrair", { description: "Erro inesperado" });
    expect(reportInvokeError).toHaveBeenCalledWith("timeout", "financeiro-import:extrair-texto");
  });
});

describe("ImportarLancamentosDialog: revisão e gravação", () => {
  it("totais refletem seleção, tipo e remoção de linhas", async () => {
    setup();
    await colarEExtrair();
    expect(screen.getByText(/Selecionados:/).parentElement).toHaveTextContent("Selecionados: 2 de 2");
    expect(screen.getByText(/Saídas:/).parentElement).toHaveTextContent(/R\$\s?150,00/);
    expect(screen.getByText(/Entradas:/).parentElement).toHaveTextContent(/R\$\s?1\.000,00/);

    // desmarca a primeira linha
    fireEvent.click(within(linhas()[0]).getByRole("checkbox"));
    expect(screen.getByText(/Selecionados:/).parentElement).toHaveTextContent("Selecionados: 1 de 2");
    expect(screen.getByRole("button", { name: "Importar 1 lançamento(s)" })).toBeEnabled();

    // marcar todos de novo
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar todos" }));
    expect(screen.getByText(/Selecionados:/).parentElement).toHaveTextContent("Selecionados: 2 de 2");

    // tudo como saída
    // ação em massa vem antes da tabela
    fireEvent.click(screen.getAllByRole("button", { name: /^Saída$/ })[0]);
    expect(screen.getByText(/Saídas:/).parentElement).toHaveTextContent(/R\$\s?1\.150,00/);

    // tudo como entrada
    fireEvent.click(screen.getAllByRole("button", { name: /^Entrada$/ })[0]);
    expect(screen.getByText(/Entradas:/).parentElement).toHaveTextContent(/R\$\s?1\.150,00/);

    // remove a segunda linha
    fireEvent.click(within(linhas()[1]).getByRole("button", { name: "Remover linha" }));
    expect(linhas()).toHaveLength(1);
  });

  it("desmarcar todos desabilita importar", async () => {
    setup();
    await colarEExtrair();
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar todos" }));
    expect(screen.getByRole("button", { name: "Importar 0 lançamento(s)" })).toBeDisabled();
  });

  it("categorias filtradas pelo tipo da linha; trocar o tipo limpa a categoria", async () => {
    setup();
    await colarEExtrair();
    const selectCat = within(linhas()[0]).getByRole("combobox");
    const opcoes = within(selectCat).getAllByRole("option").map((o) => o.textContent);
    expect(opcoes).toEqual(["(vazio)", "Sem categoria", "Material", "Geral"]);
    fireEvent.change(selectCat, { target: { value: "cat-mat" } });
    expect(within(linhas()[0]).getByRole("combobox")).toHaveValue("cat-mat");
    fireEvent.click(within(linhas()[0]).getByRole("button", { name: /Saída/ }));
    const depois = within(linhas()[0]).getByRole("combobox");
    expect(depois).toHaveValue("__none__");
    expect(within(depois).getAllByRole("option").map((o) => o.textContent)).toContain("Honorários");
  });

  it("edições na linha vão para a gravação com conta e projeto escolhidos", async () => {
    const { onImported } = setup();
    await colarEExtrair();
    const [l1] = linhas();
    fireEvent.change(within(l1).getByDisplayValue("Cimento Votoran"), { target: { value: "Cimento CP-II" } });
    fireEvent.change(within(l1).getByDisplayValue("2026-10-05"), { target: { value: "2026-10-06" } });
    fireEvent.change(within(l1).getByDisplayValue(/150,00/), { target: { value: "20000" } });
    const [, selConta, selProjeto] = screen.getAllByRole("combobox");
    fireEvent.change(selConta, { target: { value: "conta-1" } });
    fireEvent.change(selProjeto, { target: { value: "proj-1" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Importar 2 lançamento(s)" }));
    });
    const [itensGravados, opts] = hook.gravarLote.mock.calls[0];
    expect(itensGravados[0]).toMatchObject({ descricao: "Cimento CP-II", data: "2026-10-06", valor: 200 });
    expect(itensGravados[0].lineHash).not.toBe("h");
    expect(opts).toEqual({ contaId: "conta-1", projetoId: "proj-1" });
    expect(onImported).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Importação concluída", {
      description: "2 lançamento(s) criado(s), 1 conciliado(s).",
    });
    // resumo pós-importação substitui o preview
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText(/criado\(s\)/).closest("span")).toHaveTextContent(/Saídas R\$\s?250,00/);
  });

  it("sem conta/projeto grava com nulos", async () => {
    setup();
    await colarEExtrair();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Importar 2 lançamento(s)" }));
    });
    expect(hook.gravarLote.mock.calls[0][1]).toEqual({ contaId: null, projetoId: null });
  });

  it("erro ao gravar mantém o preview e avisa", async () => {
    hook.gravarLote.mockRejectedValueOnce(new Error("permission denied for table despesas"));
    const { onImported } = setup();
    await colarEExtrair();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Importar 2 lançamento(s)" }));
    });
    expect(toast.error).toHaveBeenCalledWith("Erro ao gravar", {
      description: "permission denied for table despesas",
    });
    expect(onImported).not.toHaveBeenCalled();
    expect(linhas()).toHaveLength(2);
  });

  it("gravando mostra o estado e bloqueia", async () => {
    hook.gravando = true;
    setup();
    await colarEExtrair();
    expect(screen.getByRole("button", { name: "Gravando..." })).toBeDisabled();
  });

  it("duplicata: alerta e alterna entre conciliar e criar novo", async () => {
    hook.extrairTextoIA.mockResolvedValueOnce({
      itens: [item({ duplicataId: "desp-9", acao: "conciliar" })],
      avisos: [],
    });
    setup();
    await colarEExtrair();
    expect(screen.getByText(/batem com contas já cadastradas/)).toBeInTheDocument();
    expect(screen.getByText(/A conciliar:/).parentElement).toHaveTextContent("A conciliar: 1");
    fireEvent.click(within(linhas()[0]).getByText("marcar como pago"));
    expect(within(linhas()[0]).getByText("criar novo")).toBeInTheDocument();
    expect(screen.getByText(/A criar:/).parentElement).toHaveTextContent("A criar: 1");
  });

  it("limpar descarta o preview", async () => {
    setup();
    await colarEExtrair();
    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("ImportarLancamentosDialog: desfazer", () => {
  async function importar() {
    await colarEExtrair();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Importar 2 lançamento(s)" }));
    });
  }

  it("desfaz o último lote", async () => {
    const { onImported } = setup();
    await importar();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Desfazer/ }));
    });
    expect(hook.desfazer).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Importação desfeita");
    expect(onImported).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: /Desfazer/ })).not.toBeInTheDocument();
  });

  it("erro ao desfazer mantém o resumo e avisa", async () => {
    hook.desfazer.mockRejectedValueOnce(new Error("lote já alterado"));
    setup();
    await importar();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Desfazer/ }));
    });
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Erro ao desfazer", { description: "lote já alterado" })
    );
    expect(screen.getByRole("button", { name: /Desfazer/ })).toBeInTheDocument();
  });

  it("sem lote para desfazer não oferece o botão", async () => {
    hook.temDesfazer = false;
    setup();
    await importar();
    expect(screen.queryByRole("button", { name: /Desfazer/ })).not.toBeInTheDocument();
  });
});
