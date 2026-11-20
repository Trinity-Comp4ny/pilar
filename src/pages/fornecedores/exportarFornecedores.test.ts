import { describe, expect, it } from "vitest";
import { gerarCsvFornecedores, linhasParaExportacao, type LinhaFornecedor } from "./exportarFornecedores";

const fornecedores: LinhaFornecedor[] = [
  {
    nome: "Pisos; & Revestimentos",
    categorias: ["Pisos", "Revestimentos"],
    contato: "Ana \"Compras\"",
    telefone: "14999999999",
    email: "compras@example.com",
    cnpj: "12345678000199",
  },
  {
    nome: "=HYPERLINK(\"https://example.com\")",
    categorias: [],
    email: "+SUM(1,1)",
    contato: "@formula",
  },
];

describe("exportar fornecedores em CSV e Excel", () => {
  it("mantém mesmas colunas e registros filtrados, com CNPJ opcional", () => {
    const sem = linhasParaExportacao([fornecedores[0]], false);
    expect(sem).toHaveLength(2);
    expect(sem[0]).not.toContain("CNPJ");
    expect(sem[1][0]).toBe("Pisos; & Revestimentos");
    expect(sem[1][1]).toBe("Pisos, Revestimentos");
    expect(sem[1][2]).toBe('Ana "Compras"');

    const com = linhasParaExportacao([fornecedores[0]], true);
    expect(com[0]).toContain("CNPJ");
    expect(com[1]).toHaveLength(6);
  });

  it("CSV com BOM UTF-8, ponto e vírgula, aspas e CRLF", () => {
    const csv = gerarCsvFornecedores([fornecedores[0]], false);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Pisos; & Revestimentos"');
    expect(csv).toContain('"Ana ""Compras"""');
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv.trim().split("\r\n")).toHaveLength(2);
  });

  it("previne fórmulas em campos CSV controlados por fornecedores", () => {
    const csv = gerarCsvFornecedores([fornecedores[1]], false);
    expect(csv).toContain('"\'=HYPERLINK');
    expect(csv).toContain('"\'+SUM(1,1)"');
    expect(csv).toContain('"\'@formula"');
    expect(csv).not.toMatch(/\r\n"=/);
  });
});
