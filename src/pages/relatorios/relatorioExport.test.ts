import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PizZip from "pizzip";
import type { ReportRow } from "./useRelatorioData";

// Exportação do relatório financeiro: CSV, XLSX e PDF exportam só as colunas
// visíveis, com a linha de Total (tipo único) ou Saldo (misto) correta.

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const autoTable = vi.fn();
const pdfDoc = { setFontSize: vi.fn(), setTextColor: vi.fn(), text: vi.fn(), save: vi.fn() };
vi.mock("jspdf", () => ({
  default: vi.fn(function () {
    return pdfDoc;
  }),
}));
vi.mock("jspdf-autotable", () => ({ default: (...a: unknown[]) => autoTable(...a) }));

import { toast } from "sonner";
import { computeReportTotal, generateCSV, generatePDF, generateXLSX, toCurrency } from "./relatorioExport";

const nbsp = (s: string) => s.replace(/\u00a0/g, " ");

function row(p: Partial<ReportRow>): ReportRow {
  return {
    Tipo: "Receita",
    Descrição: "x",
    Valor: 0,
    "Dt. Vencimento": "-",
    "Dt. Efetiva": "-",
    Status: "-",
    Projeto: "-",
    "Cliente / Fornecedor": "-",
    Categoria: "-",
    Conta: "-",
    "Forma Pgto": "-",
    "Nota Fiscal": "-",
    Parcela: "-",
    ...p,
  };
}

const misto: ReportRow[] = [
  row({ Tipo: "Receita", Descrição: "Honorários A", Valor: 10000, Status: "Recebido" }),
  row({ Tipo: "Receita", Descrição: "Medição 2", Valor: 2500.5, Status: "Pendente" }),
  row({ Tipo: "Despesa", Descrição: "Aluguel", Valor: 3000, Status: "Pago" }),
];

let blobs: Blob[] = [];
let downloads: string[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  blobs = [];
  downloads = [];
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn((b: Blob) => {
      blobs.push(b);
      return "blob:x";
    }),
    revokeObjectURL: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push(this.getAttribute("download") ?? "");
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function textoDoBlob(b: Blob): Promise<string> {
  return new TextDecoder("utf-8", { ignoreBOM: true }).decode(await b.arrayBuffer());
}

describe("toCurrency", () => {
  it("formata número e string numérica; inválido vira traço", () => {
    expect(nbsp(toCurrency(1234.5))).toBe("R$ 1.234,50");
    expect(nbsp(toCurrency("99.9"))).toBe("R$ 99,90");
    expect(nbsp(toCurrency(-10))).toBe("-R$ 10,00");
    expect(toCurrency("abc")).toBe("-");
    expect(toCurrency(undefined)).toBe("-");
    expect(nbsp(toCurrency(null))).toBe("R$ 0,00");
  });
});

describe("computeReportTotal", () => {
  it("relatório misto mostra Saldo = receitas − despesas", () => {
    expect(computeReportTotal(misto)).toEqual({ label: "Saldo", value: 9500.5 });
  });

  it("saldo negativo quando despesas superam receitas", () => {
    const r = [row({ Tipo: "Receita", Valor: 100 }), row({ Tipo: "Despesa", Valor: 350.25 })];
    expect(computeReportTotal(r)).toEqual({ label: "Saldo", value: -250.25 });
  });

  it("só despesas mostra Total da soma", () => {
    const r = [row({ Tipo: "Despesa", Valor: 10 }), row({ Tipo: "Despesa", Valor: 20.5 })];
    expect(computeReportTotal(r)).toEqual({ label: "Total", value: 30.5 });
  });

  it("vazio dá Total 0", () => {
    expect(computeReportTotal([])).toEqual({ label: "Total", value: 0 });
  });

  it("soma fecha no centavo, sem lixo de ponto flutuante", () => {
    const r = [0.1, 0.2, 0.7, 1.15, 2.3].map((v) => row({ Tipo: "Despesa", Valor: v }));
    expect(computeReportTotal(r).value).toBe(4.45);
    const m = [row({ Tipo: "Receita", Valor: 0.3 }), row({ Tipo: "Despesa", Valor: 0.1 })];
    expect(computeReportTotal(m).value).toBe(0.2);
  });
});

describe("generateCSV", () => {
  it("sem dados avisa e não baixa nada", () => {
    generateCSV([], ["Tipo", "Valor"], "rel");
    expect(toast.error).toHaveBeenCalledWith("Sem dados", { description: "Não há dados para exportar." });
    expect(blobs).toHaveLength(0);
  });

  it("exporta só as colunas visíveis, com BOM, valores em R$ e linha de saldo", async () => {
    generateCSV(misto, ["Tipo", "Descrição", "Valor"], "relatorio-out");
    expect(downloads).toEqual(["relatorio-out.csv"]);
    const texto = await textoDoBlob(blobs[0]);
    expect(texto.charCodeAt(0)).toBe(0xfeff);
    const linhas = nbsp(texto.slice(1)).split("\n");
    expect(linhas[0]).toBe("Tipo,Descrição,Valor");
    expect(linhas[1]).toBe('Receita,Honorários A,"R$ 10.000,00"');
    expect(linhas[3]).toBe('Despesa,Aluguel,"R$ 3.000,00"');
    expect(linhas[4]).toBe('SALDO,,"R$ 9.500,50"');
    expect(linhas).toHaveLength(5);
  });

  it("sem a coluna Tipo, a linha de total só traz o valor", async () => {
    generateCSV(misto, ["Descrição", "Valor"], "r");
    const linhas = nbsp((await textoDoBlob(blobs[0])).slice(1)).split("\n");
    expect(linhas.at(-1)).toBe(',"R$ 9.500,50"');
  });

  it("neutraliza injeção de fórmula e escapa aspas, vírgulas e quebras de linha", async () => {
    const r = [
      row({ Tipo: "Despesa", Descrição: '=HYPERLINK("http://x")', Valor: 1 }),
      row({ Tipo: "Despesa", Descrição: "+55 11 9999", Valor: 1 }),
      row({ Tipo: "Despesa", Descrição: "@SUM(A1)", Valor: 1 }),
      row({ Tipo: "Despesa", Descrição: "Linha1\nLinha2, com vírgula", Valor: 1 }),
    ];
    generateCSV(r, ["Descrição"], "r");
    const corpo = (await textoDoBlob(blobs[0])).slice(1);
    expect(corpo).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(corpo).toContain("'+55 11 9999");
    expect(corpo).toContain("'@SUM(A1)");
    expect(corpo).toContain('"Linha1\nLinha2, com vírgula"');
  });

  it("valor negativo exportado não vira fórmula", async () => {
    generateCSV([row({ Tipo: "Despesa", Valor: -50 })], ["Valor"], "r");
    const corpo = nbsp((await textoDoBlob(blobs[0])).slice(1));
    expect(corpo.split("\n")[1]).toBe(`"'-R$ 50,00"`);
  });
});

describe("generateXLSX", () => {
  async function sheetXml() {
    const zip = new PizZip(await blobs[0].arrayBuffer());
    return zip.file("xl/worksheets/sheet1.xml")!.asText();
  }

  it("sem dados avisa e não baixa nada", async () => {
    await generateXLSX([], ["Tipo"], "r");
    expect(toast.error).toHaveBeenCalledWith("Sem dados", expect.anything());
    expect(blobs).toHaveLength(0);
  });

  it("gera planilha com cabeçalho, valores numéricos e linha de saldo", async () => {
    await generateXLSX(misto, ["Tipo", "Descrição", "Valor"], "rel");
    expect(downloads).toEqual(["rel.xlsx"]);
    const xml = await sheetXml();
    expect(xml).toContain('<c r="A1" s="1" t="inlineStr"><is><t xml:space="preserve">Tipo</t></is></c>');
    expect(xml).toContain('<c r="C2" s="2"><v>10000</v></c>');
    expect(xml).toContain('<c r="C3" s="2"><v>2500.5</v></c>');
    expect(xml).toContain('<c r="A5" s="1" t="inlineStr"><is><t xml:space="preserve">SALDO</t></is></c>');
    expect(xml).toContain('<c r="C5" s="3"><v>9500.5</v></c>');
    expect(xml).not.toContain('r="D');
  });

  it("total em centavos exatos (sem 0.30000000000000004)", async () => {
    const r = [0.1, 0.2].map((v) => row({ Tipo: "Despesa", Valor: v }));
    await generateXLSX(r, ["Tipo", "Valor"], "r");
    expect(await sheetXml()).toContain('<c r="B4" s="3"><v>0.3</v></c>');
  });

  it("escapa XML no texto", async () => {
    await generateXLSX([row({ Descrição: 'A & B <c> "d"', Valor: 1 })], ["Descrição"], "r");
    expect(await sheetXml()).toContain("A &amp; B &lt;c&gt; &quot;d&quot;");
  });
});

describe("generatePDF", () => {
  it("monta a tabela com as colunas visíveis e a linha de saldo, e salva", async () => {
    await generatePDF(misto, ["Tipo", "Descrição", "Valor"], {
      title: "Relatório Financeiro",
      filename: "rel",
      dateFrom: new Date(2026, 9, 1),
      dateTo: new Date(2026, 9, 31),
    });
    const [, opts] = autoTable.mock.calls[0] as [unknown, { head: string[][]; body: string[][] }];
    expect(opts.head).toEqual([["Tipo", "Descrição", "Valor"]]);
    expect(opts.body).toHaveLength(4);
    expect(opts.body[2].map(nbsp)).toEqual(["Despesa", "Aluguel", "R$ 3.000,00"]);
    expect(opts.body[3].map(nbsp)).toEqual(["SALDO", "", "R$ 9.500,50"]);
    expect(pdfDoc.text).toHaveBeenCalledWith("Relatório Financeiro", 14, 16);
    expect(pdfDoc.text).toHaveBeenCalledWith("Período: 01/10/2026 a 31/10/2026", 14, 23);
    expect(pdfDoc.save).toHaveBeenCalledWith("rel.pdf");
  });

  it("sem período mostra Início a Fim", async () => {
    await generatePDF(misto, ["Valor"], { title: "T", filename: "r" });
    expect(pdfDoc.text).toHaveBeenCalledWith("Período: Início a Fim", 14, 23);
  });
});
