import { describe, expect, it } from "vitest";
import { calcularEstimativa } from "@/lib/estimativaObra";
import { FICHA_SOBRADO, insumosProntos, resultadoDoSobrado } from "@/test/estimativaFixtures";
import { obraDaEstimativa } from "./obraDaEstimativa";

describe("obraDaEstimativa", () => {
  const r = resultadoDoSobrado();
  const obra = obraDaEstimativa(r);

  it("o previsto das etapas soma o subtotal da estimativa, sem a taxa de administração", () => {
    expect(obra.previstoTotal).toBe(r.subtotal);
    expect(obra.previstoTotal).toBeLessThan(r.provavel);
  });

  it("leva as fases, as etapas e os serviços do cronograma, com as datas", () => {
    expect(obra.fases.map((f) => f.nome)).toEqual(r.fases.map((f) => f.nome));
    expect(obra.inicio).toBe(r.fases[0].inicio);
    expect(obra.fim).toBe(r.fases.at(-1)?.fim);
    const estrutura = obra.fases.find((f) => f.nome === "Estrutura")!;
    expect(estrutura.etapas.map((e) => e.nome)).toEqual(["Pilares e vigas", "Lajes"]);
    expect(estrutura.etapas[0].servicos.map((s) => s.nome)).toEqual(["Formas", "Armação", "Concretagem"]);
    expect(obra.servicos).toBe(r.fases.reduce((s, f) => s + f.etapas.reduce((t, e) => t + e.servicos.length, 0), 0));
  });

  it("etapa de custo com o mesmo nome vai inteira; o resto se divide entre as etapas sem valor", () => {
    const alv = obra.fases.find((f) => f.nome === "Alvenaria e cobertura")!;
    const alvenaria = r.etapas.find((e) => e.id === "alvenaria")!.valor;
    const cobertura = r.etapas.find((e) => e.id === "cobertura")!.valor;
    expect(alv.etapas.find((e) => e.nome === "Alvenaria")?.previsto).toBe(alvenaria);
    expect(alv.etapas.find((e) => e.nome === "Cobertura")?.previsto).toBe(cobertura);

    const estrutura = obra.fases.find((f) => f.nome === "Estrutura")!;
    const total = estrutura.etapas.reduce((s, e) => s + e.previsto, 0);
    expect(Math.round(total * 100)).toBe(Math.round(r.etapas.find((e) => e.id === "estrutura")!.valor * 100));
    expect(Math.abs(estrutura.etapas[0].previsto - estrutura.etapas[1].previsto)).toBeLessThanOrEqual(0.01);
  });

  it("item fora do CUB vira etapa com o próprio valor; item a definir não entra no previsto", () => {
    const piscina = r.adicionais.find((a) => a.id === "piscina")!;
    const adic = obra.fases.find((f) => f.nome === "Adicionais")!;
    expect(adic.etapas.find((e) => e.nome === "Piscina")?.previsto).toBe(piscina.valor);

    const i = insumosProntos();
    const comFv = calcularEstimativa({
      ficha: { ...FICHA_SOBRADO, itens: { fv: 8 } },
      cub: i.cub,
      parametros: i.parametros,
      parametrosValidados: false,
    });
    if (!comFv.ok) throw new Error(comFv.mensagem);
    const obraFv = obraDaEstimativa(comFv.resultado);
    expect(obraFv.previstoTotal).toBe(comFv.resultado.subtotal);
    const inst = obraFv.fases.find((f) => f.nome === "Instalações")!;
    expect(inst.etapas.find((e) => e.nome === "Energia solar fotovoltaica")?.previsto).toBe(0);
    expect(inst.etapas.find((e) => e.nome === "Elétrica")!.previsto).toBeGreaterThan(0);
  });
});
