import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { useRecolherAoRolar } from "./useRecolherAoRolar";

function Tela({ ativo = true }: { ativo?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const recolhido = useRecolherAoRolar(ref, ativo);
  return (
    <div ref={ref}>
      <span>{recolhido ? "recolhido" : "aberto"}</span>
      <div data-testid="lista" />
    </div>
  );
}

function rolar(el: HTMLElement, topo: number) {
  Object.defineProperty(el, "scrollTop", { value: topo, configurable: true });
  act(() => {
    el.dispatchEvent(new Event("scroll"));
  });
}

describe("useRecolherAoRolar", () => {
  it("recolhe ao rolar para baixo, inclusive numa lista interna, e volta ao subir", () => {
    render(<Tela />);
    const lista = screen.getByTestId("lista");
    rolar(lista, 120);
    expect(screen.getByText("recolhido")).toBeInTheDocument();
    rolar(lista, 80);
    expect(screen.getByText("aberto")).toBeInTheDocument();
  });

  it("volta a mostrar no topo e não recolhe com rolagem pequena", () => {
    render(<Tela />);
    const lista = screen.getByTestId("lista");
    rolar(lista, 4);
    expect(screen.getByText("aberto")).toBeInTheDocument();
    rolar(lista, 200);
    rolar(lista, 10);
    expect(screen.getByText("aberto")).toBeInTheDocument();
  });

  it("desligado (desktop) nunca recolhe", () => {
    render(<Tela ativo={false} />);
    rolar(screen.getByTestId("lista"), 300);
    expect(screen.getByText("aberto")).toBeInTheDocument();
  });
});
