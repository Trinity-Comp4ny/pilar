import { describe, expect, it } from "vitest";
import {
  LIMIAR_PUXAR,
  MAXIMO_PUXAR,
  amortecer,
  classificarToque,
  estaNoTopo,
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

  it("só inicia com o rolável no topo e sem sobreposição", () => {
    expect(podeIniciarPuxar({ tipoDoToque: "topo", sobreposicaoAberta: false })).toBe(true);
    expect(podeIniciarPuxar({ tipoDoToque: "rolado", sobreposicaoAberta: false })).toBe(false);
    expect(podeIniciarPuxar({ tipoDoToque: "proprio", sobreposicaoAberta: false })).toBe(false);
    expect(podeIniciarPuxar({ tipoDoToque: "topo", sobreposicaoAberta: true })).toBe(false);
  });

  describe("classificarToque", () => {
    const sem = () => ({ overflowY: "visible", overflowX: "visible" }) as CSSStyleDeclaration;

    function painel(scrollTop: number, alturaTotal = 800) {
      document.body.innerHTML = `<div id="painel"><div id="conteudo"><p id="p"></p></div></div>`;
      const el = document.getElementById("painel") as HTMLElement;
      Object.defineProperty(el, "scrollHeight", { value: alturaTotal, configurable: true });
      Object.defineProperty(el, "clientHeight", { value: 400, configurable: true });
      el.scrollTop = scrollTop;
      return el;
    }
    const estiloDoPainel = (el: Element) =>
      ({ overflowY: el.id === "painel" ? "auto" : "visible", overflowX: "visible" }) as CSSStyleDeclaration;

    it("painel interno no topo permite puxar, mesmo com a janela em 0", () => {
      const el = painel(0);
      const r = classificarToque(document.getElementById("p"), estiloDoPainel, 0);
      expect(r).toEqual({ tipo: "topo", rolavel: el });
    });

    it("painel interno rolado não deixa puxar", () => {
      painel(300);
      expect(classificarToque(document.getElementById("p"), estiloDoPainel, 0).tipo).toBe("rolado");
    });

    it("tolera fração do iOS no topo", () => {
      painel(0.33);
      expect(classificarToque(document.getElementById("p"), estiloDoPainel, 0).tipo).toBe("topo");
    });

    it("sem painel rolável, quem decide é a janela", () => {
      document.body.innerHTML = `<p id="p"></p>`;
      expect(classificarToque(document.getElementById("p"), sem, 0)).toEqual({ tipo: "topo", rolavel: null });
      expect(classificarToque(document.getElementById("p"), sem, 120).tipo).toBe("rolado");
    });

    it("campo, data-no-ptr e rolagem horizontal são gesto próprio", () => {
      document.body.innerHTML = `<input id="i"/><div data-no-ptr><span id="n"></span></div><div id="h"><p id="q"></p></div>`;
      expect(classificarToque(document.getElementById("i"), sem, 0).tipo).toBe("proprio");
      expect(classificarToque(document.getElementById("n"), sem, 0).tipo).toBe("proprio");
      const h = document.getElementById("h") as HTMLElement;
      Object.defineProperty(h, "scrollWidth", { value: 900, configurable: true });
      Object.defineProperty(h, "clientWidth", { value: 300, configurable: true });
      const estiloH = (el: Element) =>
        ({ overflowX: el.id === "h" ? "auto" : "visible", overflowY: "visible" }) as CSSStyleDeclaration;
      expect(classificarToque(document.getElementById("q"), estiloH, 0).tipo).toBe("proprio");
    });

    it("alvo que não é elemento cai na janela", () => {
      expect(classificarToque(null, sem, 0)).toEqual({ tipo: "topo", rolavel: null });
    });
  });

  it("estaNoTopo lê o rolável ou a janela", () => {
    const el = document.createElement("div");
    el.scrollTop = 0;
    expect(estaNoTopo(el, 500)).toBe(true);
    el.scrollTop = 50;
    expect(estaNoTopo(el, 0)).toBe(false);
    expect(estaNoTopo(null, 1)).toBe(true);
    expect(estaNoTopo(null, 80)).toBe(false);
  });
});
