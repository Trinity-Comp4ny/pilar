import { describe, expect, it } from "vitest";
import {
  LIMITE_LINHAS,
  coberturaDoMes,
  interpretarPlanilhaCub,
  lerCsv,
  lerValor,
  opcoesMesBase,
  resumirMeses,
} from "./estimativaCubImport";

const MES = "2026-09-01";

describe("lerValor", () => {
  it("lê o formato brasileiro e o internacional", () => {
    expect(lerValor("3.350,00")).toBe(3350);
    expect(lerValor("R$ 3.350,00")).toBe(3350);
    expect(lerValor("R$3350,5")).toBe(3350.5);
    expect(lerValor("3350.50")).toBe(3350.5);
    expect(lerValor("2.700")).toBe(2700);
    expect(lerValor("1.234.567,89")).toBe(1234567.89);
    expect(lerValor("987,65")).toBe(987.65);
    expect(lerValor("3,350.00")).toBe(3350);
    expect(lerValor("3350")).toBe(3350);
  });

  it("recusa o que não é número", () => {
    expect(lerValor("")).toBeNull();
    expect(lerValor("abc")).toBeNull();
    expect(lerValor("12a")).toBeNull();
    expect(lerValor("1.2.3,4.5")).toBeNull();
    expect(lerValor("-")).toBeNull();
    expect(lerValor("3.350,000")).toBeNull();
    expect(lerValor("3,35,0")).toBeNull();
    expect(lerValor("12.34.56")).toBeNull();
  });
});

describe("interpretarPlanilhaCub: código combinado", () => {
  const planilha = [
    ["UF", "Código", "R$/m²"],
    ["SP", "R1-B", "2.150,00"],
    ["sp", "R1-N", "2.700,00"],
    ["SP", "R1-A", "3.350,00"],
    ["SP", "CSL-8-N", "2.600,00"],
    ["SP", "PP-4-A", "3.100,00"],
    ["SP", "R16-N", "2.380,00"],
    ["SP", "GI", "1.500,00"],
  ];

  it("lê subtipo e padrão do próprio código", () => {
    const r = interpretarPlanilhaCub(planilha, MES);
    expect(r.erroGeral).toBeNull();
    expect(r.erros).toEqual([]);
    expect(r.totalLidas).toBe(7);
    expect(r.linhas.map((l) => [l.subtipo, l.padrao, l.valor_m2])).toEqual([
      ["R1", "baixo", 2150],
      ["R1", "normal", 2700],
      ["R1", "alto", 3350],
      ["CSL-8", "normal", 2600],
      ["PP-4", "alto", 3100],
      ["R16", "normal", 2380],
      ["GI", "unico", 1500],
    ]);
    expect(r.linhas.every((l) => l.uf === "SP" && l.mes_base === MES)).toBe(true);
  });

  it("aponta o número da linha na planilha, contando o cabeçalho", () => {
    const r = interpretarPlanilhaCub(planilha, MES);
    expect(r.linhas[0].linha).toBe(2);
    expect(r.linhas[6].linha).toBe(8);
  });
});

describe("interpretarPlanilhaCub: regime", () => {
  const planilha = [
    ["UF", "Código", "Valor"],
    ["SP", "R1-A", "3.230,00"],
  ];

  it("sem regime informado, a linha é sem desoneração", () => {
    expect(interpretarPlanilhaCub(planilha, MES).linhas[0].regime).toBe("onerado");
  });

  it("marca todas as linhas com o regime escolhido", () => {
    const r = interpretarPlanilhaCub(planilha, MES, "desonerado");
    expect(r.erros).toEqual([]);
    expect(r.linhas.map((l) => l.regime)).toEqual(["desonerado"]);
  });
});

describe("interpretarPlanilhaCub: subtipo e padrão em colunas", () => {
  it("reconhece o cabeçalho com acento e variação, e pula o título acima dele", () => {
    const r = interpretarPlanilhaCub(
      [
        ["CUB por estado, setembro de 2026"],
        [],
        ["Estado", "Subtipo", "Padrão de acabamento", "Valor (R$/m²)"],
        ["RJ", "R1", "Alto", "3.300,00"],
        ["RJ", "R1", "Normal", "2.650,00"],
        ["RJ", "GI", "", "1.480,00"],
        ["RJ", "GI", "Único", "1.480,00"],
      ],
      MES
    );
    expect(r.erroGeral).toBeNull();
    expect(r.linhas.map((l) => [l.subtipo, l.padrao])).toEqual([
      ["R1", "alto"],
      ["R1", "normal"],
      ["GI", "unico"],
    ]);
    // A segunda linha de GI repete a primeira (vazio e "único" são o mesmo padrão).
    expect(r.erros).toEqual([{ linha: 7, mensagem: "Repetida: já está na linha 6" }]);
  });

  it("aceita a sigla do padrão (B, N, A)", () => {
    const r = interpretarPlanilhaCub(
      [
        ["UF", "Subtipo", "Padrão", "Valor"],
        ["MG", "R1", "B", "2.000,00"],
        ["MG", "R1", "N", "2.500,00"],
        ["MG", "R1", "A", "3.000,00"],
      ],
      MES
    );
    expect(r.linhas.map((l) => l.padrao)).toEqual(["baixo", "normal", "alto"]);
  });
});

describe("interpretarPlanilhaCub: erros por linha", () => {
  const cab = ["UF", "Código", "Valor"];

  it("cada problema vira um erro com a linha e a causa, e as linhas boas seguem lidas", () => {
    const r = interpretarPlanilhaCub(
      [
        cab,
        ["SP", "R1-A", "3.350,00"],
        ["MG", "R1-A", "0,00"],
        ["XX", "R1-B", "2.100,00"],
        ["RJ", "CSL-8", "2.900,00"],
        ["", "R1-N", "2.700,00"],
        ["PR", "R1-N", "dois mil"],
        ["PR", "???", "2.700,00"],
        ["SC", "R1-N", ""],
        ["RS", "R1-N", "250.000,00"],
        ["BA", "R1-N", "3,35"],
      ],
      MES
    );
    expect(r.linhas).toHaveLength(1);
    expect(r.erros).toEqual([
      { linha: 3, mensagem: "O valor deve ser maior que zero" },
      { linha: 4, mensagem: 'UF "XX" desconhecida' },
      { linha: 5, mensagem: "Padrão ausente" },
      { linha: 6, mensagem: "UF ausente" },
      { linha: 7, mensagem: 'Valor "dois mil" não é um número' },
      { linha: 8, mensagem: 'Código "???" não é um código de CUB' },
      { linha: 9, mensagem: "Valor ausente" },
      { linha: 10, mensagem: "O valor passa de R$ 100.000 por m², confira a unidade" },
      { linha: 11, mensagem: "O valor está abaixo de R$ 100 por m², confira a unidade" },
    ]);
    expect(r.totalLidas).toBe(10);
  });

  it("padrão desconhecido na coluna de padrão é recusado", () => {
    const r = interpretarPlanilhaCub(
      [
        ["UF", "Subtipo", "Padrão", "Valor"],
        ["SP", "R1", "luxo", "4.000,00"],
      ],
      MES
    );
    expect(r.erros[0].mensagem).toBe('Padrão "luxo" desconhecido (use baixo, normal ou alto)');
  });

  it("linha repetida aponta a primeira ocorrência", () => {
    const r = interpretarPlanilhaCub([cab, ["SP", "R1-A", "3.350,00"], ["SP", "R1-A", "3.400,00"]], MES);
    expect(r.linhas).toHaveLength(1);
    expect(r.erros).toEqual([{ linha: 3, mensagem: "Repetida: já está na linha 2" }]);
  });

  it("o mesmo código em UFs diferentes não é repetição", () => {
    const r = interpretarPlanilhaCub([cab, ["SP", "R1-A", "3.350,00"], ["RJ", "R1-A", "3.300,00"]], MES);
    expect(r.erros).toEqual([]);
    expect(r.linhas).toHaveLength(2);
  });

  it("linhas em branco no meio não contam nem dão erro", () => {
    const r = interpretarPlanilhaCub(
      [cab, ["SP", "R1-A", "3.350,00"], [], ["", "", ""], ["RJ", "R1-A", "3.300,00"]],
      MES
    );
    expect(r.totalLidas).toBe(2);
    expect(r.erros).toEqual([]);
  });
});

describe("interpretarPlanilhaCub: erros gerais", () => {
  it("sem cabeçalho reconhecível, explica o que procurar", () => {
    const r = interpretarPlanilhaCub(
      [
        ["a", "b"],
        ["1", "2"],
      ],
      MES
    );
    expect(r.erroGeral).toMatch(/Não achamos as colunas UF, valor/);
    expect(r.linhas).toEqual([]);
  });

  it("cabeçalho sem linhas embaixo", () => {
    const r = interpretarPlanilhaCub([["UF", "Código", "Valor"]], MES);
    expect(r.erroGeral).toMatch(/não tem linhas/);
  });

  it("mês-base inválido", () => {
    expect(interpretarPlanilhaCub([["UF", "Código", "Valor"]], "").erroGeral).toMatch(/mês-base/);
    expect(interpretarPlanilhaCub([["UF", "Código", "Valor"]], "2026-09-15").erroGeral).toMatch(/mês-base/);
  });

  it("planilha grande demais é recusada, não gravada pela metade", () => {
    const linhas = Array.from({ length: LIMITE_LINHAS + 1 }, (_, i) => ["SP", `R${i}-A`, "1.000,00"]);
    const r = interpretarPlanilhaCub([["UF", "Código", "Valor"], ...linhas], MES);
    expect(r.erroGeral).toMatch(/passa de 5000 linhas/);
    expect(r.linhas).toEqual([]);
  });
});

describe("opcoesMesBase", () => {
  it("lista do mês atual para trás, virando o ano", () => {
    const o = opcoesMesBase(new Date(Date.UTC(2027, 1, 10)), 4);
    expect(o.map((x) => x.valor)).toEqual(["2027-02-01", "2027-01-01", "2026-12-01", "2026-11-01"]);
    expect(o[0].rotulo).toBe("fev/2027");
  });
});

describe("resumo e cobertura do que já foi importado", () => {
  const gravadas = [
    {
      uf: "SP",
      subtipo: "R1",
      padrao: "alto",
      mes_base: "2026-09-01",
      regime: "onerado",
      created_at: "2026-10-02T10:00:00Z",
    },
    {
      uf: "SP",
      subtipo: "R1",
      padrao: "normal",
      mes_base: "2026-09-01",
      regime: "onerado",
      created_at: "2026-10-02T10:00:00Z",
    },
    {
      uf: "RJ",
      subtipo: "R1",
      padrao: "alto",
      mes_base: "2026-09-01",
      regime: "onerado",
      created_at: "2026-10-03T08:00:00Z",
    },
    {
      uf: "SP",
      subtipo: "R1",
      padrao: "alto",
      mes_base: "2026-08-01",
      regime: "onerado",
      created_at: "2026-09-02T10:00:00Z",
    },
    {
      uf: "SP",
      subtipo: "R1",
      padrao: "alto",
      mes_base: "2026-09-01",
      regime: "desonerado",
      created_at: "2026-10-04T09:00:00Z",
    },
  ] as const as unknown as Parameters<typeof resumirMeses>[0];

  it("resume por mês, do mais novo ao mais antigo", () => {
    expect(resumirMeses(gravadas)).toEqual([
      { mesBase: "2026-09-01", regime: "onerado", linhas: 3, ufs: 2, ultimaImportacao: "2026-10-03T08:00:00Z" },
      { mesBase: "2026-09-01", regime: "desonerado", linhas: 1, ufs: 1, ultimaImportacao: "2026-10-04T09:00:00Z" },
      { mesBase: "2026-08-01", regime: "onerado", linhas: 1, ufs: 1, ultimaImportacao: "2026-09-02T10:00:00Z" },
    ]);
  });

  it("cobertura separa as UFs com e sem tabela no mês", () => {
    const c = coberturaDoMes(gravadas, "2026-09-01");
    expect(c.com).toEqual(["RJ", "SP"]);
    expect(c.sem).toHaveLength(25);
    expect(c.sem).toContain("AC");
    expect(c.com.length + c.sem.length).toBe(27);
  });

  it("cobertura é por regime: com desoneração só tem SP", () => {
    const c = coberturaDoMes(gravadas, "2026-09-01", "desonerado");
    expect(c.com).toEqual(["SP"]);
    expect(c.sem).toHaveLength(26);
  });

  it("mês sem importação: nenhuma UF coberta", () => {
    const c = coberturaDoMes(gravadas, "2026-10-01");
    expect(c.com).toEqual([]);
    expect(c.sem).toHaveLength(27);
  });

  it("sem nenhuma importação, devolve vazio sem quebrar", () => {
    expect(resumirMeses([])).toEqual([]);
  });
});

describe("lerCsv", () => {
  it("lê CSV brasileiro com ponto e vírgula e CRLF", () => {
    expect(lerCsv("UF;Código;Valor\r\nSP;R1-A;3.350,00\r\nRJ;R1-A;3.300,00\r\n")).toEqual([
      ["UF", "Código", "Valor"],
      ["SP", "R1-A", "3.350,00"],
      ["RJ", "R1-A", "3.300,00"],
    ]);
  });

  it("lê CSV internacional, com aspas protegendo a vírgula do valor", () => {
    expect(lerCsv('UF,Código,Valor\nSP,R1-A,"3,350.00"\n')).toEqual([
      ["UF", "Código", "Valor"],
      ["SP", "R1-A", "3,350.00"],
    ]);
  });

  it("ignora o BOM do Excel e entende aspas duplas escapadas", () => {
    expect(lerCsv('\uFEFFUF;Nota\nSP;"disse ""oi"""')).toEqual([
      ["UF", "Nota"],
      ["SP", 'disse "oi"'],
    ]);
  });

  it("lê tab e termina sem quebra de linha final", () => {
    expect(lerCsv("UF\tValor\nSP\t3350")).toEqual([
      ["UF", "Valor"],
      ["SP", "3350"],
    ]);
  });

  it("texto vazio vira lista vazia", () => {
    expect(lerCsv("")).toEqual([]);
  });

  it("ponta a ponta: CSV brasileiro vira linhas do CUB", () => {
    const r = interpretarPlanilhaCub(lerCsv("UF;Código;R$/m²\nSP;R1-A;3.350,00\nSP;R1-N;2.700,00"), MES);
    expect(r.erros).toEqual([]);
    expect(r.linhas.map((l) => l.valor_m2)).toEqual([3350, 2700]);
  });
});
