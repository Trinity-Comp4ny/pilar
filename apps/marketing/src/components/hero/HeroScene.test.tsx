import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { domAnimation, LazyMotion } from "framer-motion";
import { prepararAmbiente } from "../../test/ambiente";
import { CURSOR, FRASE, RASCUNHO } from "./scene";
import { HeroScene } from "./HeroScene";
import { useAbaVisivel, useScene } from "./useScene";

// O framer-motion lê `prefers-reduced-motion` uma vez por módulo: este arquivo
// roda inteiro com movimento reduzido, como o visitante que pediu isso no sistema.
beforeAll(() => prepararAmbiente({ movimentoReduzido: true }));

describe("HeroScene com movimento reduzido", () => {
  const renderizar = () =>
    render(
      <LazyMotion features={domAnimation}>
        <HeroScene />
      </LazyMotion>
    );

  it("congela no quadro do rascunho: pedido escrito e lançamento esperando aprovação", () => {
    const { container } = renderizar();

    // O pedido aparece inteiro nas duas versões (desktop e celular), sem digitação.
    expect(screen.getAllByText(FRASE).length).toBeGreaterThanOrEqual(2);
    // O rascunho do lançamento está montado, com o valor.
    for (const [, valor] of RASCUNHO) expect(screen.getAllByText(valor).length).toBeGreaterThan(0);
    // O cursor carrega o rótulo do ato "rascunho" e ainda não foi aprovado.
    expect(screen.getByText(CURSOR.rascunho.rotulo!)).toBeInTheDocument();
    expect(screen.queryByText("Gravado no financeiro")).not.toBeInTheDocument();
    expect(container.textContent).toContain("Confirmar");
  });

  it("não anda sozinha: o quadro é o mesmo depois de uma volta inteira", () => {
    vi.useFakeTimers();
    try {
      renderizar();
      act(() => {
        vi.advanceTimersByTime(25000);
      });
      expect(screen.getByText(CURSOR.rascunho.rotulo!)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("tem o equivalente textual para leitor de tela, e o palco visual fica escondido dele", () => {
    const { container } = renderizar();
    const sr = container.querySelector("p.sr-only");
    expect(sr?.textContent).toMatch(/agente de IA/);
    expect(sr?.textContent).toMatch(/converte em projeto/);
    expect(sr?.textContent).toMatch(/obra/);
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
  });
});

describe("useScene", () => {
  afterEach(() => vi.useRealTimers());

  const MARCOS = [0, 100, 300] as const;

  it("publica o índice ao cruzar cada marco e recomeça no fim do loop", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useScene(MARCOS, 500, true));

    expect(result.current).toBe(0);
    act(() => void vi.advanceTimersByTime(110));
    expect(result.current).toBe(1);
    act(() => void vi.advanceTimersByTime(200));
    expect(result.current).toBe(2);
    act(() => void vi.advanceTimersByTime(200));
    expect(result.current).toBe(0);
  });

  it("inativo congela o tempo e retoma de onde parou", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ ativo }) => useScene(MARCOS, 500, ativo), {
      initialProps: { ativo: true },
    });

    act(() => void vi.advanceTimersByTime(150));
    expect(result.current).toBe(1);

    rerender({ ativo: false });
    act(() => void vi.advanceTimersByTime(5000));
    expect(result.current).toBe(1);

    rerender({ ativo: true });
    act(() => void vi.advanceTimersByTime(160));
    expect(result.current).toBe(2);
  });

  it("nunca ativo fica no primeiro ato", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useScene(MARCOS, 500, false));
    act(() => void vi.advanceTimersByTime(5000));
    expect(result.current).toBe(0);
  });
});

describe("useAbaVisivel", () => {
  it("acompanha a visibilidade da aba", () => {
    const estado = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const { result } = renderHook(() => useAbaVisivel());
    expect(result.current).toBe(true);

    estado.mockReturnValue("hidden");
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    expect(result.current).toBe(false);

    estado.mockRestore();
  });
});
