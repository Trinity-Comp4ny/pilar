import { describe, expect, it } from "vitest";
import {
  LIMIAR_PUXAR,
  MAXIMO_PUXAR,
  alvoTratoGestoProprio,
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

  it("reconhece alvo que trata o gesto sozinho", () => {
    document.body.innerHTML = `<div id="a"><input id="i"/></div><div data-no-ptr><span id="n"></span></div><p id="p"></p>`;
    const sem = () => ({ overflowY: "visible", overflowX: "visible" }) as CSSStyleDeclaration;
    expect(alvoTratoGestoProprio(document.getElementById("i"), sem)).toBe(true);
    expect(alvoTratoGestoProprio(document.getElementById("n"), sem)).toBe(true);
    expect(alvoTratoGestoProprio(document.getElementById("p"), sem)).toBe(false);
    expect(alvoTratoGestoProprio(null, sem)).toBe(false);
  });

  it("área que rola por dentro também é própria", () => {
    document.body.innerHTML = `<div id="r"><p id="p"></p></div>`;
    const r = document.getElementById("r") as HTMLElement;
    Object.defineProperty(r, "scrollHeight", { value: 500 });
    Object.defineProperty(r, "clientHeight", { value: 100 });
    const estilo = (el: Element) =>
      ({ overflowY: el === r ? "auto" : "visible", overflowX: "visible" }) as CSSStyleDeclaration;
    expect(alvoTratoGestoProprio(document.getElementById("p"), estilo)).toBe(true);
  });
});
