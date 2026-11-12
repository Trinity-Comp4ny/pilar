import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { useLarguraDoElemento } from "./useLarguraDoElemento";

function Medida() {
  const ref = useRef<HTMLDivElement>(null);
  const largura = useLarguraDoElemento(ref);
  return (
    <div ref={ref}>
      <span>{largura}</span>
    </div>
  );
}

describe("useLarguraDoElemento", () => {
  const original = globalThis.ResizeObserver;
  afterEach(() => {
    globalThis.ResizeObserver = original;
    vi.restoreAllMocks();
  });

  it("mede ao montar e acompanha quando o elemento muda de tamanho", () => {
    let avisar: () => void = () => {};
    const desligar = vi.fn();
    globalThis.ResizeObserver = class {
      constructor(cb: () => void) {
        avisar = cb;
      }
      observe() {}
      unobserve() {}
      disconnect = desligar;
    } as unknown as typeof ResizeObserver;
    const largura = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(390);

    const { unmount } = render(<Medida />);
    expect(screen.getByText("390")).toBeInTheDocument();

    largura.mockReturnValue(1440);
    act(() => avisar());
    expect(screen.getByText("1440")).toBeInTheDocument();

    unmount();
    expect(desligar).toHaveBeenCalled();
  });

  it("sem ResizeObserver, mede uma vez e não quebra", () => {
    // @ts-expect-error simula navegador sem a API
    delete globalThis.ResizeObserver;
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800);
    render(<Medida />);
    expect(screen.getByText("800")).toBeInTheDocument();
  });
});
