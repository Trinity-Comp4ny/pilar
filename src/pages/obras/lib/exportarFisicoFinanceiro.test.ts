import { describe, expect, it } from "vitest";
import { letraColuna, montarPlanilhaXML, montarTabelaExport, nomeArquivoFF } from "./exportarFisicoFinanceiro";
import { montarFisicoFinanceiro } from "./fisicoFinanceiro";
import { montarOrcadoRealizado, type NoFinanceiro } from "@/lib/orcadoRealizado";
import type { Periodo } from "./obraArvore";

const no = (id: string, parent_id: string | null, nivel: string, ordem = 0): NoFinanceiro => ({
  id,
  parent_id,
  nivel,
  nome: id.toUpperCase(),
  ordem,
  created_at: "2026-01-01",
});

function ff(semData = false) {
  const nos = [
    no("f1", null, "fase"),
    no("e1", "f1", "etapa"),
    no("s1", "e1", "servico"),
    no("s2", "e1", "servico", 1),
  ];
  const previsto = new Map([
    ["s1", 1000],
    ["s2", 500],
  ]);
  const orcado = montarOrcadoRealizado(nos, previsto, {});
  const per = new Map<string, Periodo>([["s1", { inicio: "2026-01-01", fim: "2026-02-28" }]]);
  if (!semData) per.set("s2", { inicio: "2026-02-01", fim: "2026-02-28" });
  return montarFisicoFinanceiro(orcado.raizes, per, new Map());
}

describe("montarTabelaExport", () => {
  it("filtra por nível: fases, fases e etapas, tudo", () => {
    const f = ff();
    const nomes = (n: "fases" | "etapas" | "tudo") => montarTabelaExport(f, n).linhas.map((l) => String(l[0]).trim());
    expect(nomes("fases")).toEqual(["F1", "No período", "Acumulado"]);
    expect(nomes("etapas")).toEqual(["F1", "E1", "No período", "Acumulado"]);
    expect(nomes("tudo")).toEqual(["F1", "E1", "S1", "S2", "No período", "Acumulado"]);
  });

  it("valores são números e o acumulado fecha o previsto", () => {
    const t = montarTabelaExport(ff(), "fases");
    expect(t.cabecalho.slice(0, 2)).toEqual(["Item", "Previsto"]);
    const [fase, periodo, acum] = t.linhas;
    expect(typeof fase[1]).toBe("number");
    expect(fase[1]).toBe(1500);
    expect(periodo[1]).toBe(1500);
    expect(acum[acum.length - 1]).toBe(1500);
    expect(t.rodape).toBe(2);
  });

  it("só tem coluna Sem data quando há valor sem data", () => {
    expect(montarTabelaExport(ff(false), "fases").cabecalho).not.toContain("Sem data");
    const t = montarTabelaExport(ff(true), "fases");
    expect(t.cabecalho[t.cabecalho.length - 1]).toBe("Sem data");
    expect(t.linhas[0][t.linhas[0].length - 1]).toBe(500);
  });

  it("recua o nome pela profundidade", () => {
    const t = montarTabelaExport(ff(), "tudo");
    expect(t.linhas[2][0]).toBe("    S1");
  });
});

describe("planilha e nome", () => {
  it("letraColuna passa do Z", () => {
    expect([letraColuna(0), letraColuna(25), letraColuna(26), letraColuna(27)]).toEqual(["A", "Z", "AA", "AB"]);
  });

  it("XML tem células numéricas e escapa texto", () => {
    const xml = montarPlanilhaXML(["A & B"], { cabecalho: ["Item", "Previsto"], linhas: [["x<y", 12.5]], rodape: 0 });
    expect(xml).toContain("A &amp; B");
    expect(xml).toContain("x&lt;y");
    expect(xml).toContain('<c r="B4" s="1"><v>12.5</v></c>');
  });

  it("nome do arquivo sem acento", () => {
    expect(nomeArquivoFF("Casa Ação/Vila", "etapas", new Date(2026, 10, 16))).toBe(
      "fisico-financeiro-casa-acao-vila-etapas-2026-11-16"
    );
  });
});
