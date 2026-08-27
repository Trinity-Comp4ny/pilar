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

  it("renderiza uma coluna por posição (ordem), na ordem certa, sem rótulo 'Etapa N'", () => {
    render(
      <FluxoPipeline
        disciplinas={[disc({ disciplina: "Estrutural", etapa: 2 }), disc({ disciplina: "Arquitetônico", etapa: 1 })]}
      />
    );

    // Rótulo é só a posição numérica (spec 067): "etapa" fica reservado ao
    // sub-passo do checklist dentro da disciplina, sem colidir com a coluna.
    const headers = document.querySelectorAll(".text-info-strong");
    expect(Array.from(headers).map((h) => h.textContent)).toEqual(["1", "2"]);
  });

  it("disciplina com previsão vencida e não concluída aparece marcada como atrasada", () => {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    // toISOString() converte pra UTC: à noite no fuso do Brasil (UTC-3) já é
    // "amanhã" em UTC, e "ontem" vira a data de hoje — o teste passa a
    // comparar hoje com hoje e nunca fica "em_atraso". Monta a string local.
    const pad = (n: number) => String(n).padStart(2, "0");
    const dataPassada = `${ontem.getFullYear()}-${pad(ontem.getMonth() + 1)}-${pad(ontem.getDate())}`;

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
