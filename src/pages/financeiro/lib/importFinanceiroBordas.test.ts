import { describe, expect, it } from "vitest";
import {
  csvParaLinhas,
  encontrarDuplicata,
  linhaParaCandidato,
  normalizeValorBR,
  parseCsv,
  parseDataBR,
} from "./importFinanceiro";

// Bordas da importação de extrato (CSV/planilha → linhas → candidatos). O
// leitor de .xlsx real é stub no ambiente de teste; aqui entram as linhas como o
// mapeamento as recebe.

describe("normalizeValorBR: bordas", () => {
  it.each([
    ["1.234.567,89", 1234567.89],
    ["1.234.567", 1234567],
    ["1,234,567.89", 1234567.89],
    ["1,234,567", 1234567],
    ["R$ -50,00", -50],
    ["(1.500,00)", -1500],
    ["250,00 C", 250],
    ["250,00 d", -250],
    ["+10,5", 10.5],
    ["0,01", 0.01],
  ])("%s → %d", (raw, esperado) => {
    expect(normalizeValorBR(raw)).toBe(esperado);
  });

  it.each(["", "  ", "abc", "12a", "--5", "1,2,3,4.5,6"])("%j não é valor", (raw) => {
    expect(normalizeValorBR(raw)).toBeNull();
  });

  it("número já numérico passa direto", () => {
    expect(normalizeValorBR(1234.5)).toBe(1234.5);
    expect(normalizeValorBR(-3)).toBe(-3);
  });
});

describe("parseDataBR: datas impossíveis", () => {
  it.each(["31/02/2026", "30/02/2024", "31/04/2026", "29/02/2026", "2026-02-30", "00/10/2026", "15/13/2026"])(
    "%s é recusada",
    (raw) => {
      expect(parseDataBR(raw)).toBeNull();
    }
  );

  it("29/02 em ano bissexto é aceita", () => {
    expect(parseDataBR("29/02/2028")).toBe("2028-02-29");
  });

  it("separadores ponto e hífen", () => {
    expect(parseDataBR("05.10.2026")).toBe("2026-10-05");
    expect(parseDataBR("5-1-26")).toBe("2026-01-05");
  });
});

describe("parseCsv", () => {
  it("aspas escapadas e quebra de linha dentro de campo", () => {
    const rows = parseCsv('a;b\n"x ""y""";"linha1\nlinha2"\n');
    expect(rows).toEqual([
      ["a", "b"],
      ['x "y"', "linha1\nlinha2"],
    ]);
  });

  it("CRLF e linhas em branco são ignoradas", () => {
    expect(parseCsv("a,b\r\n\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("tab como delimitador", () => {
    expect(parseCsv("Data\tValor\n01/10/2026\t10,00")).toEqual([
      ["Data", "Valor"],
      ["01/10/2026", "10,00"],
    ]);
  });
});

describe("csvParaLinhas: mapeamento de colunas", () => {
  it("coluna 'Data Lançamento' não é usada como descrição", () => {
    const csv = "Data Lançamento;Histórico;Valor\n05/10/2026;PIX ENVIADO FORNECEDOR;-150,00";
    const { linhas } = csvParaLinhas(csv);
    expect(linhas).toEqual([{ data: "2026-10-05", descricao: "PIX ENVIADO FORNECEDOR", valorComSinal: -150 }]);
  });

  it("valor zero é ignorado com aviso", () => {
    const { linhas, avisos } = csvParaLinhas("Data;Descrição;Valor\n01/10/2026;Estorno;0,00\n02/10/2026;TED;100,00");
    expect(linhas).toHaveLength(1);
    expect(avisos).toHaveLength(1);
  });

  it("data impossível vira aviso, não entra (o banco recusaria o lote inteiro)", () => {
    const { linhas, avisos } = csvParaLinhas("Data;Descrição;Valor\n31/02/2026;TED;100,00\n01/03/2026;TED;50,00");
    expect(linhas.map((l) => l.data)).toEqual(["2026-03-01"]);
    expect(avisos[0]).toMatch(/Linha ignorada/);
  });

  it("débito e crédito na mesma linha resultam no líquido", () => {
    const { linhas } = csvParaLinhas("Data;Histórico;Débito;Crédito\n01/10/2026;Ajuste;30,00;100,00");
    expect(linhas[0].valorComSinal).toBe(70);
  });

  it("débito informado com sinal negativo continua saída", () => {
    const { linhas } = csvParaLinhas("Data;Histórico;Débito;Crédito\n01/10/2026;Tarifa;-12,90;");
    expect(linhas[0].valorComSinal).toBe(-12.9);
  });

  it("arquivo vazio avisa", () => {
    expect(csvParaLinhas("")).toEqual({ linhas: [], avisos: ["Arquivo vazio ou ilegível."] });
  });

  it("nada reconhecido avisa no topo", () => {
    const { linhas, avisos } = csvParaLinhas("foo;bar\nbaz;qux");
    expect(linhas).toEqual([]);
    expect(avisos[0]).toBe("Nenhuma linha com data e valor foi reconhecida. Confira o formato do arquivo.");
  });

  it("extrato com milhar sem centavos (1.234.567) não perde a linha", () => {
    const { linhas } = csvParaLinhas("Data;Descrição;Valor\n01/10/2026;Aporte;1.234.567");
    expect(linhas[0].valorComSinal).toBe(1234567);
  });
});

describe("candidatos e duplicatas", () => {
  it("valores com centavos geram o mesmo hash independentemente de espaços/caixa na descrição", () => {
    const a = linhaParaCandidato({ data: "2026-10-01", descricao: "PIX  Fornecedor", valorComSinal: -10.1 });
    const b = linhaParaCandidato({ data: "2026-10-01", descricao: "pix fornecedor", valorComSinal: -10.1 });
    expect(a.lineHash).toBe(b.lineHash);
    expect(a).toMatchObject({ valor: 10.1, tipo: "despesa" });
  });

  it("duplicata casa no limite da janela e com diferença de centavo de float", () => {
    const c = linhaParaCandidato({ data: "2026-10-10", descricao: "x", valorComSinal: -(0.1 + 0.2) });
    expect(encontrarDuplicata(c, [{ id: "p1", valor: 0.3, data: "2026-10-13", tipo: "despesa" }] as never, 3)).toBe(
      "p1"
    );
    expect(encontrarDuplicata(c, [{ id: "p1", valor: 0.31, data: "2026-10-10", tipo: "despesa" }] as never)).toBeNull();
  });

  it("sem pendentes não há duplicata", () => {
    const c = linhaParaCandidato({ data: "2026-10-10", descricao: "x", valorComSinal: 5 });
    expect(encontrarDuplicata(c, [])).toBeNull();
  });
});
