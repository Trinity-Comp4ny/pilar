import { describe, expect, it } from "vitest";
import { resultadoDoSobrado } from "@/test/estimativaFixtures";
import { obraDaEstimativa } from "./obraDaEstimativa";
import { planejarOrcadoDaEstimativa, type NoDoOrcado } from "./orcadoDaEstimativa";

const r = resultadoDoSobrado();
const est = obraDaEstimativa(r);

/** Obra com as mesmas fases e etapas do cronograma da estimativa (o caso comum: obra criada de um fluxo parecido). */
const nosIguais = (): NoDoOrcado[] =>
  est.fases.flatMap((f, fi) => [
    { id: `f${fi}`, parent_id: null, nivel: "fase", nome: f.nome },
    ...f.etapas.map((e, ei) => ({ id: `f${fi}e${ei}`, parent_id: `f${fi}`, nivel: "etapa", nome: e.nome })),
  ]);

describe("planejarOrcadoDaEstimativa", () => {
  it("obra com as mesmas etapas: leva o previsto inteiro, que soma o subtotal da estimativa", () => {
    const p = planejarOrcadoDaEstimativa(r, nosIguais(), new Map(), false);
    expect(p.semCorrespondencia).toEqual([]);
    expect(Math.round(p.totalNovo * 100)).toBe(Math.round(est.previstoTotal * 100));
    expect(p.linhas.every((l) => !l.mantido)).toBe(true);
  });

  it("casa por nome sem diferenciar maiúscula e acento", () => {
    const nos = nosIguais().map((n) => ({ ...n, nome: n.nome.toUpperCase() }));
    const p = planejarOrcadoDaEstimativa(r, nos, new Map(), false);
    expect(p.semCorrespondencia).toEqual([]);
    expect(p.linhas.length).toBeGreaterThan(0);
  });

  it("não troca o valor que o usuário já digitou, a não ser que peça para substituir", () => {
    const alvo = nosIguais().find((n) => n.nivel === "etapa")!;
    const atual = new Map([[alvo.id, 1234]]);
    const manter = planejarOrcadoDaEstimativa(r, nosIguais(), atual, false).linhas.find((l) => l.id === alvo.id)!;
    expect(manter).toMatchObject({ mantido: true, novo: 1234, anterior: 1234 });
    const trocar = planejarOrcadoDaEstimativa(r, nosIguais(), atual, true).linhas.find((l) => l.id === alvo.id)!;
    expect(trocar.mantido).toBe(false);
    expect(trocar.novo).not.toBe(1234);
  });

  it("fase que a obra não tem fica de fora e é avisada com o valor", () => {
    const nos = nosIguais().filter((n) => !n.id.startsWith("f0"));
    const p = planejarOrcadoDaEstimativa(r, nos, new Map(), false);
    expect(p.semCorrespondencia[0].fase).toBe(est.fases[0].nome);
    expect(p.semCorrespondencia[0].valor).toBeGreaterThanOrEqual(0);
    expect(p.linhas.some((l) => l.id.startsWith("f0"))).toBe(false);
  });

  it("etapa com nome diferente recebe a parte que sobrou da fase", () => {
    const estrutura = est.fases.find((f) => f.nome === "Estrutura")!;
    const total = estrutura.etapas.reduce((s, e) => s + Math.round(e.previsto * 100), 0);
    const nos: NoDoOrcado[] = [
      { id: "F", parent_id: null, nivel: "fase", nome: "Estrutura" },
      { id: "E1", parent_id: "F", nivel: "etapa", nome: "Etapa com outro nome" },
      { id: "E2", parent_id: "F", nivel: "etapa", nome: "Outra etapa qualquer" },
    ];
    const p = planejarOrcadoDaEstimativa(r, nos, new Map(), false);
    const soma = p.linhas.filter((l) => l.id.startsWith("E")).reduce((s, l) => s + Math.round(l.novo * 100), 0);
    expect(soma).toBe(total);
  });

  it("fase sem etapa na obra recebe o total da fase", () => {
    const nos: NoDoOrcado[] = [{ id: "F", parent_id: null, nivel: "fase", nome: "Estrutura" }];
    const p = planejarOrcadoDaEstimativa(r, nos, new Map(), false);
    expect(p.linhas).toHaveLength(1);
    expect(p.linhas[0].caminho).toBe("Estrutura");
  });
});
