import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useBarraVisivel } from "./useBarraVisivel";

/** Rola um contêiner (não a janela), como o `main` do PageLayout, e dispara o evento. */
function rolar(el: HTMLElement, topo: number) {
  el.scrollTop = topo;
  act(() => {
    el.dispatchEvent(new Event("scroll"));
  });
}

describe("useBarraVisivel (SPEC 134)", () => {
  let el: HTMLElement | null = null;
  afterEach(() => {
    el?.remove();
    el = null;
  });

  const montar = () => {
    el = document.createElement("div");
    document.body.appendChild(el);
    return { el, hook: renderHook(() => useBarraVisivel()) };
  };

  it("começa visível", () => {
    const { hook } = montar();
    expect(hook.result.current).toBe(true);
  });

  it("some ao rolar para baixo e volta ao rolar para cima", () => {
    const { el: alvo, hook } = montar();
    rolar(alvo, 100);
    rolar(alvo, 220);
    expect(hook.result.current).toBe(false);
    rolar(alvo, 180);
    expect(hook.result.current).toBe(true);
  });

  it("volta ao chegar no topo", () => {
    const { el: alvo, hook } = montar();
    rolar(alvo, 100);
    rolar(alvo, 300);
    expect(hook.result.current).toBe(false);
    rolar(alvo, 10);
    expect(hook.result.current).toBe(true);
  });

  it("ignora tremida menor que a folga", () => {
    const { el: alvo, hook } = montar();
    rolar(alvo, 200);
    rolar(alvo, 300);
    expect(hook.result.current).toBe(false);
    rolar(alvo, 297);
    expect(hook.result.current).toBe(false);
  });

  it("perto do topo nunca esconde", () => {
    const { el: alvo, hook } = montar();
    rolar(alvo, 30);
    rolar(alvo, 60);
    expect(hook.result.current).toBe(true);
  });
});
