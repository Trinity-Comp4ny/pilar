import { describe, it, expect } from "vitest";
import {
  normalizeValorBR,
  parseDataBR,
  parseCsv,
  detectarDelimitador,
  csvParaLinhas,
  lineHash,
  linhaParaCandidato,
  encontrarDuplicata,
  type Candidato,
  type ContaPendente,
} from "./importFinanceiro";

describe("normalizeValorBR", () => {
  it("lê formato BR com milhar e decimal", () => {
    expect(normalizeValorBR("1.234,56")).toBe(1234.56);
    expect(normalizeValorBR("R$ 1.234,56")).toBe(1234.56);
  });
  it("lê formato US", () => {
    expect(normalizeValorBR("1,234.56")).toBe(1234.56);
  });
  it("preserva o sinal negativo", () => {
    expect(normalizeValorBR("-1234,56")).toBe(-1234.56);
    expect(normalizeValorBR("(100,00)")).toBe(-100);
  });
  it("interpreta débito/crédito por sufixo D/C", () => {
    expect(normalizeValorBR("100,00 D")).toBe(-100);
    expect(normalizeValorBR("100,00 C")).toBe(100);
  });
  it("valor simples sem separador de milhar", () => {
    expect(normalizeValorBR("1234,56")).toBe(1234.56);
    expect(normalizeValorBR("500")).toBe(500);
  });
  it("retorna null para texto não numérico", () => {
    expect(normalizeValorBR("PIX RECEBIDO")).toBeNull();
    expect(normalizeValorBR("")).toBeNull();
    expect(normalizeValorBR(null)).toBeNull();
  });
});

describe("parseDataBR", () => {
  it("converte dd/mm/yyyy para ISO", () => {
    expect(parseDataBR("10/07/2026")).toBe("2026-07-10");
    expect(parseDataBR("05.03.2026")).toBe("2026-03-05");
  });
  it("aceita ano de 2 dígitos", () => {
    expect(parseDataBR("10/07/26")).toBe("2026-07-10");
  });
  it("aceita ISO já formatado", () => {
    expect(parseDataBR("2026-07-10")).toBe("2026-07-10");
  });
  it("rejeita mês inválido e texto", () => {
    expect(parseDataBR("10/13/2026")).toBeNull();
    expect(parseDataBR("histórico")).toBeNull();
  });
});

describe("parseCsv / detectarDelimitador", () => {
  it("detecta ponto e vírgula", () => {
    expect(detectarDelimitador("a;b;c\n1;2;3")).toBe(";");
  });
  it("respeita aspas com delimitador dentro", () => {
    const rows = parseCsv('data,desc,valor\n10/07/2026,"MERCADO, LTDA",100,00');
    expect(rows[1][1]).toBe("MERCADO, LTDA");
  });
});

describe("csvParaLinhas", () => {
  it("lê extrato com header e coluna valor única", () => {
    const csv = "Data;Histórico;Valor\n10/07/2026;PAGAMENTO ALUGUEL;-3.000,00\n11/07/2026;PIX RECEBIDO;5.000,00";
    const { linhas } = csvParaLinhas(csv);
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toEqual({ data: "2026-07-10", descricao: "PAGAMENTO ALUGUEL", valorComSinal: -3000 });
    expect(linhas[1].valorComSinal).toBe(5000);
  });

  it("lê extrato com colunas débito e crédito separadas", () => {
    const csv = "Data;Descrição;Débito;Crédito\n10/07/2026;Fornecedor X;1000,00;\n12/07/2026;Cliente Y;;2000,00";
    const { linhas } = csvParaLinhas(csv);
    expect(linhas[0].valorComSinal).toBe(-1000);
    expect(linhas[1].valorComSinal).toBe(2000);
  });

  it("cai na heurística quando não há header reconhecível", () => {
    const csv = "10/07/2026;COMPRA CARTAO;-250,00\n11/07/2026;DEPOSITO;1.000,00";
    const { linhas } = csvParaLinhas(csv);
    expect(linhas).toHaveLength(2);
    expect(linhas[0].data).toBe("2026-07-10");
    expect(linhas[0].valorComSinal).toBe(-250);
  });

  it("registra aviso para linha sem data/valor", () => {
    const csv = "Data;Histórico;Valor\nlixo;sem nada;abc";
    const { linhas, avisos } = csvParaLinhas(csv);
    expect(linhas).toHaveLength(0);
    expect(avisos.length).toBeGreaterThan(0);
  });
});

describe("linhaParaCandidato", () => {
  it("negativo vira despesa com valor positivo", () => {
    const c = linhaParaCandidato({ data: "2026-07-10", descricao: "Aluguel", valorComSinal: -3000 });
    expect(c.tipo).toBe("despesa");
    expect(c.valor).toBe(3000);
  });
  it("positivo vira receita", () => {
    const c = linhaParaCandidato({ data: "2026-07-11", descricao: "PIX", valorComSinal: 5000 });
    expect(c.tipo).toBe("receita");
  });
});

describe("lineHash", () => {
  it("é estável para a mesma linha", () => {
    const a = lineHash({ data: "2026-07-10", valor: 3000, descricao: "Aluguel" });
    const b = lineHash({ data: "2026-07-10", valor: 3000, descricao: "  aluguel  " });
    expect(a).toBe(b);
  });
  it("muda quando o valor muda", () => {
    const a = lineHash({ data: "2026-07-10", valor: 3000, descricao: "Aluguel" });
    const b = lineHash({ data: "2026-07-10", valor: 3001, descricao: "Aluguel" });
    expect(a).not.toBe(b);
  });
});

describe("encontrarDuplicata", () => {
  const cand: Candidato = { data: "2026-07-10", descricao: "Aluguel", valor: 3000, tipo: "despesa", lineHash: "x" };
  it("casa conta pendente por valor e data dentro da janela", () => {
    const pendentes: ContaPendente[] = [{ id: "p1", valor: 3000, data: "2026-07-11", tipo: "despesa" }];
    expect(encontrarDuplicata(cand, pendentes)).toBe("p1");
  });
  it("não casa fora da janela de dias", () => {
    const pendentes: ContaPendente[] = [{ id: "p1", valor: 3000, data: "2026-07-20", tipo: "despesa" }];
    expect(encontrarDuplicata(cand, pendentes)).toBeNull();
  });
  it("não casa tipo diferente", () => {
    const pendentes: ContaPendente[] = [{ id: "p1", valor: 3000, data: "2026-07-10", tipo: "receita" }];
    expect(encontrarDuplicata(cand, pendentes)).toBeNull();
  });
});
