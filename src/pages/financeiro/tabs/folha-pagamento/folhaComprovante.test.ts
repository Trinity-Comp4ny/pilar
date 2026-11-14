import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FolhaItem } from "./types";

// Comprovante da folha em PDF: conteúdo por pessoa (projetos, resumo, PIX, aviso
// de que não é holerite CLT), nome do arquivo e o lote com uma página por pessoa.

const autoTable = vi.fn();
const pdfDoc = {
  setFontSize: vi.fn(),
  setTextColor: vi.fn(),
  setFont: vi.fn(),
  text: vi.fn(),
  save: vi.fn(),
  addPage: vi.fn(),
  lastAutoTable: undefined as { finalY: number } | undefined,
};
vi.mock("jspdf", () => ({
  default: vi.fn(function () {
    return pdfDoc;
  }),
}));
vi.mock("jspdf-autotable", () => ({ default: (...a: unknown[]) => autoTable(...a) }));

import { gerarComprovantePDF, gerarLoteComprovantesPDF } from "./folhaComprovante";

const nbsp = (s: string) => s.replace(/\u00a0/g, " ");

function item(p: Partial<FolhaItem> = {}): FolhaItem {
  return {
    p_id: "p1",
    p_nome: "João Araújo",
    p_cargo: "Projetista",
    p_salario_fixo: 3000,
    p_valor_m2: 2,
    soma_area: 150,
    v_variavel: 300,
    v_total: 3300,
    lista_projetos: ["Edifício A"],
    detalhe_projetos: [
      { nome: "Edifício A", area_m2: 100 },
      { nome: "", area_m2: 50 },
    ],
    p_cpf: "123.456.789-00",
    p_chave_pix: "joao@pix.com",
    ...p,
  };
}

const textos = () => pdfDoc.text.mock.calls.map((c) => nbsp(String(c[0])));
const corpoTabela = (n = 0) => (autoTable.mock.calls[n][1] as { body: string[][] }).body.map((r) => r.map(nbsp));

beforeEach(() => {
  vi.clearAllMocks();
  pdfDoc.lastAutoTable = { finalY: 100 };
});

describe("gerarComprovantePDF", () => {
  it("desenha cabeçalho, projetos com subtotal, resumo e PIX; salva com nome sem acento", async () => {
    await gerarComprovantePDF(item(), { empresaNome: "Escritório X", mes: 3, ano: 2026 });

    const t = textos();
    expect(t).toContain("Escritório X");
    expect(t).toContain("Competência: Março/2026");
    expect(t).toContain("João Araújo");
    expect(t).toContain("Projetista  ·  CPF 123.456.789-00");
    expect(t).toContain("Chave PIX: joao@pix.com");
    expect(t).toContain("Total a receber");
    expect(t).toContain("R$ 3.300,00");
    expect(t).toContain("desconto de INSS, IRRF ou FGTS.");

    expect(corpoTabela()).toEqual([
      ["Edifício A", "100 m²", "R$ 2,00/m²", "R$ 200,00"],
      ["-", "50 m²", "R$ 2,00/m²", "R$ 100,00"],
    ]);
    // O resumo começa abaixo da tabela (finalY + 8).
    const linhaFixo = pdfDoc.text.mock.calls.find((c) => c[0] === "Salário fixo");
    expect(linhaFixo?.[2]).toBe(108);
    expect(pdfDoc.save).toHaveBeenCalledWith("comprovante-joao-araujo-3-2026.pdf");
  });

  it("sem empresa, cargo, CPF e PIX: título genérico e sem linha de info nem PIX", async () => {
    pdfDoc.lastAutoTable = undefined;
    await gerarComprovantePDF(item({ p_cargo: "", p_cpf: null, p_chave_pix: null, p_valor_m2: 0 }), {
      mes: 12,
      ano: 2025,
    });
    const t = textos();
    expect(t.filter((x) => x === "Demonstrativo de pagamento")).toHaveLength(2);
    expect(t.some((x) => x.startsWith("CPF") || x.includes("·"))).toBe(false);
    expect(t.some((x) => x.startsWith("Chave PIX"))).toBe(false);
    expect(corpoTabela()[0]).toEqual(["Edifício A", "100 m²", "R$ 0,00/m²", "R$ 0,00"]);
  });

  it("sem detalhe e variável positivo: avisa que o detalhamento está indisponível", async () => {
    await gerarComprovantePDF(item({ detalhe_projetos: undefined as never }), { mes: 1, ano: 2026 });
    expect(corpoTabela()).toEqual([["Detalhamento por projeto indisponível para esta folha", "-", "-", "R$ 300,00"]]);
  });

  it("sem detalhe e sem variável: diz que não houve projetos", async () => {
    await gerarComprovantePDF(item({ detalhe_projetos: [], v_variavel: 0, v_total: 3000 }), { mes: 1, ano: 2026 });
    expect(corpoTabela()).toEqual([["Sem projetos no período", "-", "-", "R$ 0,00"]]);
  });
});

describe("gerarComprovantePDF: percentual", () => {
  const cabecalho = () => (autoTable.mock.calls[0][1] as { head: string[][] }).head[0];

  it("só percentual: troca as colunas de m² pela de percentual", async () => {
    await gerarComprovantePDF(
      item({
        p_valor_m2: 0,
        p_percentual: 10,
        detalhe_projetos: [{ nome: "Armário cozinha", area_m2: 0, valor_base: 10000 }],
        v_variavel: 1000,
      }),
      { mes: 11, ano: 2026 }
    );
    expect(cabecalho()).toEqual(["Projeto", "Percentual", "Subtotal"]);
    expect(corpoTabela()).toEqual([["Armário cozinha", "10,0% de R$ 10.000,00", "R$ 1.000,00"]]);
  });

  it("m² e percentual: as duas regras na mesma linha, subtotal somado", async () => {
    await gerarComprovantePDF(
      item({ p_valor_m2: 5, p_percentual: 2.5, detalhe_projetos: [{ nome: "Casa", area_m2: 120, valor_base: 40000 }] }),
      { mes: 11, ano: 2026 }
    );
    expect(cabecalho()).toEqual(["Projeto", "Área", "Valor/m²", "Percentual", "Subtotal"]);
    expect(corpoTabela()).toEqual([["Casa", "120 m²", "R$ 5,00/m²", "2,5% de R$ 40.000,00", "R$ 1.600,00"]]);
  });
});

describe("gerarLoteComprovantesPDF", () => {
  it("uma página por pessoa num único PDF", async () => {
    await gerarLoteComprovantesPDF([item(), item({ p_nome: "Maria" }), item({ p_nome: "Ana" })], {
      mes: 5,
      ano: 2026,
    });
    expect(pdfDoc.addPage).toHaveBeenCalledTimes(2);
    expect(autoTable).toHaveBeenCalledTimes(3);
    expect(textos()).toEqual(expect.arrayContaining(["João Araújo", "Maria", "Ana"]));
    expect(pdfDoc.save).toHaveBeenCalledTimes(1);
    expect(pdfDoc.save).toHaveBeenCalledWith("comprovantes-folha-5-2026.pdf");
  });

  it("lista vazia ainda salva o documento, sem páginas extras", async () => {
    await gerarLoteComprovantesPDF([], { mes: 5, ano: 2026 });
    expect(pdfDoc.addPage).not.toHaveBeenCalled();
    expect(autoTable).not.toHaveBeenCalled();
    expect(pdfDoc.save).toHaveBeenCalledWith("comprovantes-folha-5-2026.pdf");
  });
});
