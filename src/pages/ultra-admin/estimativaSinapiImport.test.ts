import { describe, expect, it } from "vitest";
import {
  codigosDoCatalogo,
  interpretarSinapi,
  resumirSinapi,
  type AbaSinapi,
  type CelulaBruta,
} from "./estimativaSinapiImport";

/**
 * Relatório de preços de insumos do SINAPI (SPEC 137, BEZ-69): o leitor confere o formato da planilha da Caixa,
 * guarda só os códigos do catálogo e recusa o que foge do contrato. Planilha de teste no mesmo layout do
 * arquivo de set/2026, com poucas UFs.
 */

const CATALOGO = new Map([
  [42425, { id: "ac12", rotulo: "Ar-condicionado split 12.000 BTU" }],
  [34469, { id: "aqsolar", rotulo: "Aquecedor solar" }],
]);

const UFS = ["AC", "SP", "TO"];

function aba(
  nome: "ISD" | "ICD",
  insumos: CelulaBruta[][],
  { mes = "09/2026", titulo }: { mes?: string; titulo?: string } = {}
): AbaSinapi {
  const regime = nome === "ISD" ? "SEM DESONERAÇÃO" : "COM DESONERAÇÃO";
  const linha = (c: CelulaBruta[]) => [...c, ...Array(Math.max(0, 5 + UFS.length - c.length)).fill("")];
  return {
    nome,
    celulas: [
      linha(["SINAPI - Sistema Nacional de Pesquisa de Custos e Índices da Construção Civil"]),
      linha([titulo ?? `RELATÓRIO DE PREÇOS DE INSUMOS - ENCARGOS SOCIAIS ${regime}`]),
      linha(["Mês de Referência:", mes, "", "", "Encargos sociais sobre a mão de obra:"]),
      linha(["Data de emissão:", "09/10/2026", "", "", `(${regime})`, ...UFS]),
      linha(["", "", "", "", "Localidade"]),
      linha([]),
      linha(["Classificação", "Código do\nInsumo", "Descrição do Insumo", "Unidade", "Origem de\nPreço", ...UFS]),
      ...insumos.map(linha),
    ],
  };
}

const SPLIT_12: CelulaBruta[] = [
  "MATERIAL",
  42425,
  "AR-CONDICIONADO SPLIT 12000 BTU/H",
  "UN",
  "CR",
  2400.5,
  2175.134,
  "",
];
const AQUECEDOR: CelulaBruta[] = ["MATERIAL", 34469, "AQUECEDOR SOLAR 1000 L", "UN", "C", "", 10530.81, 11000];
const OUTRO: CelulaBruta[] = ["MATERIAL", 11270, "ABRACADEIRA", "UN", "CR", 2.22, 2.04, 2.4];

describe("interpretarSinapi", () => {
  it("guarda só os códigos do catálogo, por UF com preço, e ignora preço em branco", () => {
    const r = interpretarSinapi([aba("ISD", [SPLIT_12, AQUECEDOR, OUTRO])], CATALOGO);
    expect(r.erroGeral).toBeNull();
    expect(r.erros).toEqual([]);
    expect(r.mesBase).toBe("2026-09-01");
    expect(r.regimes).toEqual(["onerado"]);
    expect(r.linhas).toHaveLength(4);
    expect(r.linhas.find((l) => l.codigo === 42425 && l.uf === "SP")).toEqual({
      codigo: 42425,
      uf: "SP",
      regime: "onerado",
      mes_base: "2026-09-01",
      valor: 2175.13,
      origem: "CR",
      descricao: "AR-CONDICIONADO SPLIT 12000 BTU/H",
      unidade: "UN",
    });
    expect(r.linhas.some((l) => l.codigo === 42425 && l.uf === "TO")).toBe(false);
    expect(r.linhas.some((l) => l.codigo === 11270)).toBe(false);
    expect(r.linhas.find((l) => l.codigo === 34469 && l.uf === "SP")?.origem).toBe("C");
  });

  it("ISD vira sem desoneração e ICD com desoneração, no mesmo mês", () => {
    const r = interpretarSinapi([aba("ISD", [SPLIT_12]), aba("ICD", [SPLIT_12])], CATALOGO);
    expect(r.erroGeral).toBeNull();
    expect(r.regimes).toEqual(["onerado", "desonerado"]);
    expect(r.linhas.filter((l) => l.regime === "desonerado")).toHaveLength(2);
    expect(r.cobertura.filter((c) => c.codigo === 42425).map((c) => [c.regime, c.ufs])).toEqual([
      ["onerado", 2],
      ["desonerado", 2],
    ]);
  });

  it("código do catálogo que não está na planilha vai para a lista de sem preço, sem erro", () => {
    const r = interpretarSinapi([aba("ISD", [SPLIT_12])], CATALOGO);
    expect(r.erros).toEqual([]);
    expect(r.semPreco).toEqual([{ codigo: 34469, rotulo: "Aquecedor solar" }]);
  });

  it("código que aparece sem preço em nenhuma UF também fica sem preço", () => {
    const sem: CelulaBruta[] = ["MATERIAL", 34469, "AQUECEDOR SOLAR", "UN", "CR", "", "", ""];
    const r = interpretarSinapi([aba("ISD", [SPLIT_12, sem])], CATALOGO);
    expect(r.erros).toEqual([]);
    expect(r.semPreco.map((s) => s.codigo)).toEqual([34469]);
  });

  it("recusa arquivo sem as abas ISD e ICD", () => {
    const r = interpretarSinapi([{ nome: "Menu", celulas: [] }], CATALOGO);
    expect(r.erroGeral).toMatch(/não tem as abas ISD e ICD/);
    expect(r.linhas).toEqual([]);
  });

  it("recusa aba cujo título não bate com o regime", () => {
    const r = interpretarSinapi([aba("ISD", [SPLIT_12], { titulo: "OUTRO RELATORIO" })], CATALOGO);
    expect(r.erroGeral).toMatch(/aba ISD não é o relatório/);
  });

  it("recusa ISD com título de com desoneração (aba trocada)", () => {
    const trocada = aba("ISD", [SPLIT_12], {
      titulo: "RELATÓRIO DE PREÇOS DE INSUMOS - ENCARGOS SOCIAIS COM DESONERAÇÃO",
    });
    expect(interpretarSinapi([trocada], CATALOGO).erroGeral).toMatch(/aba ISD não é o relatório/);
  });

  it("recusa mês de referência ilegível", () => {
    expect(interpretarSinapi([aba("ISD", [SPLIT_12], { mes: "setembro" })], CATALOGO).erroGeral).toMatch(
      /mês de referência/
    );
    expect(interpretarSinapi([aba("ISD", [SPLIT_12], { mes: "13/2026" })], CATALOGO).erroGeral).toMatch(
      /mês de referência/
    );
  });

  it("recusa abas de meses diferentes", () => {
    const r = interpretarSinapi([aba("ISD", [SPLIT_12]), aba("ICD", [SPLIT_12], { mes: "08/2026" })], CATALOGO);
    expect(r.erroGeral).toMatch(/meses diferentes/);
  });

  it("recusa cabeçalho com UF desconhecida", () => {
    const a = aba("ISD", [SPLIT_12]);
    a.celulas[6][6] = "XX";
    expect(interpretarSinapi([a], CATALOGO).erroGeral).toMatch(/não é uma UF válida/);
  });

  it("recusa planilha sem cabeçalho de código do insumo", () => {
    const a = aba("ISD", [SPLIT_12]);
    a.celulas[6][1] = "Codigo";
    expect(interpretarSinapi([a], CATALOGO).erroGeral).toMatch(/cabeçalho/);
  });

  it("aponta a linha da planilha quando o preço é inválido e não grava nada daquela linha", () => {
    const ruim: CelulaBruta[] = ["MATERIAL", 42425, "AR-CONDICIONADO", "UN", "CR", -5, "abc", 100];
    const r = interpretarSinapi([aba("ISD", [ruim])], CATALOGO);
    expect(r.erros.map((e) => [e.aba, e.linha])).toEqual([
      ["ISD", 8],
      ["ISD", 8],
    ]);
    expect(r.erros[0].mensagem).toMatch(/Preço inválido do código 42425 em AC/);
    expect(r.linhas).toHaveLength(1);
  });

  it("origem diferente de C e CR é erro", () => {
    const ruim: CelulaBruta[] = ["MATERIAL", 42425, "AR-CONDICIONADO", "UN", "X", 1, 2, 3];
    const r = interpretarSinapi([aba("ISD", [ruim])], CATALOGO);
    expect(r.erros[0].mensagem).toMatch(/deve ser C ou CR/);
    expect(r.linhas).toEqual([]);
  });

  it("código repetido na mesma aba é erro", () => {
    const r = interpretarSinapi([aba("ISD", [SPLIT_12, SPLIT_12])], CATALOGO);
    expect(r.erros.map((e) => e.mensagem)).toEqual(["O código 42425 aparece mais de uma vez."]);
  });

  it("aceita preço em texto com vírgula, como a planilha exportada em CSV", () => {
    const texto: CelulaBruta[] = ["MATERIAL", "42425", "AR-CONDICIONADO", "UN", "CR", "1943,00", "", ""];
    const r = interpretarSinapi([aba("ISD", [texto])], CATALOGO);
    expect(r.erros).toEqual([]);
    expect(r.linhas.map((l) => l.valor)).toEqual([1943]);
  });

  it("catálogo sem nenhum código do SINAPI é erro geral", () => {
    expect(interpretarSinapi([aba("ISD", [SPLIT_12])], new Map()).erroGeral).toMatch(/nenhum item com código/);
  });
});

describe("codigosDoCatalogo", () => {
  it("pega só os itens com código do SINAPI", () => {
    const mapa = codigosDoCatalogo({
      ac12: { rotulo: "Split", sinapi: { codigo: 42425 } },
      fv: { rotulo: "Energia solar" },
      indefinido: undefined,
    });
    expect([...mapa]).toEqual([[42425, { id: "ac12", rotulo: "Split" }]]);
  });
});

describe("resumirSinapi", () => {
  it("agrupa por mês e regime, do mais novo ao mais antigo", () => {
    const l = (codigo: number, uf: "SP" | "RJ", regime: "onerado" | "desonerado", mes: string, quando: string) => ({
      codigo,
      uf,
      regime,
      mes_base: mes,
      created_at: quando,
    });
    const r = resumirSinapi([
      l(1, "SP", "onerado", "2026-08-01", "2026-09-10T10:00:00Z"),
      l(1, "SP", "onerado", "2026-09-01", "2026-10-10T10:00:00Z"),
      l(2, "SP", "onerado", "2026-09-01", "2026-10-10T11:00:00Z"),
      l(2, "RJ", "onerado", "2026-09-01", "2026-10-10T09:00:00Z"),
      l(1, "SP", "desonerado", "2026-09-01", "2026-10-10T10:00:00Z"),
    ]);
    expect(r.map((x) => [x.mesBase, x.regime, x.codigos, x.ufs, x.linhas])).toEqual([
      ["2026-09-01", "desonerado", 1, 1, 1],
      ["2026-09-01", "onerado", 2, 2, 3],
      ["2026-08-01", "onerado", 1, 1, 1],
    ]);
    expect(r[1].ultimaImportacao).toBe("2026-10-10T11:00:00Z");
  });
});
