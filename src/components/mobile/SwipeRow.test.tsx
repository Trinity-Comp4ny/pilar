import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SwipeRowImpl } from "./SwipeRowImpl";
import { SwipeRow } from "./SwipeRow";

const acao = (tipo: "lida" | "arquivar", onAcionar = vi.fn()) => ({ tipo, onAcionar });

function arrastar(el: HTMLElement, de: [number, number], ate: [number, number]) {
  fireEvent.pointerDown(el, { pointerType: "touch", pointerId: 1, clientX: de[0], clientY: de[1] });
  fireEvent.pointerMove(el, { pointerType: "touch", pointerId: 1, clientX: ate[0], clientY: ate[1] });
  fireEvent.pointerUp(el, { pointerType: "touch", pointerId: 1, clientX: ate[0], clientY: ate[1] });
}

describe("SwipeRowImpl", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "vibrate", { value: vi.fn(), configurable: true });
  });

  it("sem ações só renderiza o conteúdo", () => {
    render(<SwipeRowImpl>conteudo</SwipeRowImpl>);
    expect(screen.getByText("conteudo")).toBeInTheDocument();
  });

  it("arrastar para a direita além do limiar aciona a ação da esquerda", () => {
    const lida = vi.fn();
    render(
      <SwipeRowImpl acaoEsquerda={acao("lida", lida)} acaoDireita={acao("arquivar")}>
        <span data-testid="linha">linha</span>
      </SwipeRowImpl>
    );
    arrastar(screen.getByTestId("linha").parentElement as HTMLElement, [10, 10], [90, 12]);
    expect(lida).toHaveBeenCalledTimes(1);
  });

  it("arrastar para a esquerda aciona a ação da direita", () => {
    const arquivar = vi.fn();
    render(
      <SwipeRowImpl acaoDireita={acao("arquivar", arquivar)}>
        <span data-testid="linha">linha</span>
      </SwipeRowImpl>
    );
    arrastar(screen.getByTestId("linha").parentElement as HTMLElement, [200, 10], [110, 11]);
    expect(arquivar).toHaveBeenCalledTimes(1);
  });

  it("arrasto curto volta sem acionar; gesto vertical e mouse são ignorados", () => {
    const lida = vi.fn();
    render(
      <SwipeRowImpl acaoEsquerda={acao("lida", lida)}>
        <span data-testid="linha">linha</span>
      </SwipeRowImpl>
    );
    const el = screen.getByTestId("linha").parentElement as HTMLElement;
    arrastar(el, [10, 10], [30, 11]);
    arrastar(el, [10, 10], [20, 80]);
    fireEvent.pointerDown(el, { pointerType: "mouse", clientX: 10, clientY: 10 });
    fireEvent.pointerMove(el, { pointerType: "mouse", clientX: 100, clientY: 10 });
    fireEvent.pointerUp(el, { pointerType: "mouse" });
    expect(lida).not.toHaveBeenCalled();
  });

  it("pointercancel desfaz o arrasto", () => {
    const lida = vi.fn();
    render(
      <SwipeRowImpl acaoEsquerda={acao("lida", lida)}>
        <span data-testid="linha">linha</span>
      </SwipeRowImpl>
    );
    const el = screen.getByTestId("linha").parentElement as HTMLElement;
    fireEvent.pointerDown(el, { pointerType: "touch", clientX: 10, clientY: 10 });
    fireEvent.pointerMove(el, { pointerType: "touch", clientX: 90, clientY: 10 });
    fireEvent.pointerCancel(el);
    expect(lida).not.toHaveBeenCalled();
  });

  it("clique logo após arrastar é engolido", () => {
    const clique = vi.fn();
    render(
      <SwipeRowImpl acaoEsquerda={acao("lida")}>
        <button data-testid="b" onClick={clique}>
          b
        </button>
      </SwipeRowImpl>
    );
    const el = screen.getByTestId("b").parentElement as HTMLElement;
    fireEvent.pointerDown(el, { pointerType: "touch", clientX: 10, clientY: 10 });
    fireEvent.pointerMove(el, { pointerType: "touch", clientX: 50, clientY: 10 });
    fireEvent.click(screen.getByTestId("b"));
    expect(clique).not.toHaveBeenCalled();
  });
});

describe("SwipeRow (wrapper)", () => {
  it("sem toque renderiza só o conteúdo", () => {
    render(<SwipeRow acaoEsquerda={acao("lida")}>linha simples</SwipeRow>);
    expect(screen.getByText("linha simples")).toBeInTheDocument();
  });

  it("com toque carrega o gesto sob demanda", async () => {
    vi.resetModules();
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    const { SwipeRow: ComToque } = await import("./SwipeRow");
    render(<ComToque acaoEsquerda={acao("lida")}>linha de toque</ComToque>);
    await waitFor(() => expect(screen.getByText("linha de toque")).toBeInTheDocument());
  });
});
