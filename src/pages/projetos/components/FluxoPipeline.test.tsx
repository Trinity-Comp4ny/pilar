import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FluxoPipeline } from "./FluxoPipeline";
import type { DisciplinaResponsavel } from "@/types/projetos";

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

function disc(overrides: Partial<DisciplinaResponsavel>): DisciplinaResponsavel {
  return {
    disciplina: "Disciplina",
    responsavel_id: "",
    responsavel_nome: "",
    status: "Não Iniciado",
    ...overrides,
  };
}

describe("FluxoPipeline", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renderiza uma coluna por etapa, na ordem certa", () => {
    render(
      <FluxoPipeline
        disciplinas={[disc({ disciplina: "Estrutural", etapa: 2 }), disc({ disciplina: "Arquitetônico", etapa: 1 })]}
      />
    );

    const headers = screen.getAllByText(/Etapa \d/);
    expect(headers.map((h) => h.textContent)).toEqual(["Etapa 1", "Etapa 2"]);
  });

  it("disciplina com previsão vencida e não concluída aparece marcada como atrasada", () => {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    const dataPassada = ontem.toISOString().slice(0, 10);

    render(
      <FluxoPipeline
        disciplinas={[disc({ disciplina: "Fachada", etapa: 1, data_previsao: dataPassada, status: "Em Andamento" })]}
      />
    );

    const dot = document.querySelector(".bg-status-cancelled");
    expect(dot).toBeInTheDocument();
  });

  it("clique na disciplina chama onOpenDisciplina com a disciplina certa", async () => {
    const onOpenDisciplina = vi.fn();
    const alvo = disc({ disciplina: "Estrutural", etapa: 1 });

    render(<FluxoPipeline disciplinas={[alvo]} onOpenDisciplina={onOpenDisciplina} />);

    await userEvent.click(screen.getByText("Estrutural"));
    expect(onOpenDisciplina).toHaveBeenCalledWith(alvo);
  });

  it("com prefers-reduced-motion, não aplica classe de animação de entrada", () => {
    mockMatchMedia(true);
    render(<FluxoPipeline disciplinas={[disc({ disciplina: "Estrutural", etapa: 1 })]} />);

    expect(document.querySelector(".animate-fade-up")).not.toBeInTheDocument();
  });

  it("sem disciplinas em nenhuma etapa, não renderiza nada", () => {
    const { container } = render(<FluxoPipeline disciplinas={[disc({ disciplina: "Avulsa" })]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
