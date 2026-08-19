import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FluxoPipelineGraph, type FluxoPipelineStage } from "./FluxoPipelineGraph";

function mockMatchMedia(reducedMotion: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("prefers-reduced-motion") ? reducedMotion : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function stage(overrides: Partial<FluxoPipelineStage>): FluxoPipelineStage {
  return { key: "s", titulo: "Etapa", nodes: [], ...overrides };
}

describe("FluxoPipelineGraph", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renderiza uma coluna por stage, na ordem recebida", () => {
    render(
      <FluxoPipelineGraph
        stages={[
          stage({
            key: "1",
            titulo: "Etapa 1",
            nodes: [{ key: "a", titulo: "Arquitetônico", status: "nao_iniciado" }],
          }),
          stage({ key: "2", titulo: "Etapa 2", nodes: [{ key: "b", titulo: "Estrutural", status: "nao_iniciado" }] }),
        ]}
      />
    );

    expect(screen.getByText("Etapa 1")).toBeInTheDocument();
    expect(screen.getByText("Etapa 2")).toBeInTheDocument();
  });

  it("nó com status atrasado usa o token de cor de atraso", () => {
    render(<FluxoPipelineGraph stages={[stage({ nodes: [{ key: "a", titulo: "Fachada", status: "atrasado" }] })]} />);

    expect(document.querySelector(".bg-status-cancelled")).toBeInTheDocument();
  });

  it("clique num nó chama onNodeClick com a key certa", async () => {
    const onNodeClick = vi.fn();
    render(
      <FluxoPipelineGraph
        stages={[stage({ nodes: [{ key: "no-1", titulo: "Estrutural", status: "nao_iniciado" }] })]}
        onNodeClick={onNodeClick}
      />
    );

    await userEvent.click(screen.getByText("Estrutural"));
    expect(onNodeClick).toHaveBeenCalledWith("no-1");
  });

  it("com prefers-reduced-motion, não aplica classe de animação de entrada", () => {
    mockMatchMedia(true);
    render(<FluxoPipelineGraph stages={[stage({ nodes: [{ key: "a", titulo: "X", status: "nao_iniciado" }] })]} />);

    expect(document.querySelector(".animate-fade-up")).not.toBeInTheDocument();
  });

  it("stages vazio não renderiza nada", () => {
    const { container } = render(<FluxoPipelineGraph stages={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
