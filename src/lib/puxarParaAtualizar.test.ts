import { describe, expect, it } from "vitest";
import {
  LIMIAR_PUXAR,
  MAXIMO_PUXAR,
  amortecer,
  podeIniciarPuxar,
  progressoDoPuxar,
} from "./puxarParaAtualizar";

describe("puxarParaAtualizar", () => {
  it("amortece e limita o puxão", () => {
    expect(amortecer(-10)).toBe(0);
    expect(amortecer(100)).toBe(50);
    expect(amortecer(1000)).toBe(MAXIMO_PUXAR);
  });

  it("progresso vai de 0 a 1 no limiar", () => {
    expect(progressoDoPuxar(0)).toBe(0);
    expect(progressoDoPuxar(LIMIAR_PUXAR / 2)).toBe(0.5);
    expect(progressoDoPuxar(500)).toBe(1);
  });

  it("só inicia no topo, sem sobreposição e fora de área própria", () => {
    const base = { scrollY: 0, sobreposicaoAberta: false, alvoProprio: false };
    expect(podeIniciarPuxar(base)).toBe(true);
    expect(podeIniciarPuxar({ ...base, scrollY: 40 })).toBe(false);
    expect(podeIniciarPuxar({ ...base, sobreposicaoAberta: true })).toBe(false);
    expect(podeIniciarPuxar({ ...base, alvoProprio: true })).toBe(false);
  });
});
