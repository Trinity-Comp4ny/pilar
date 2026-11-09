import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ProjetoTimelineEvento } from "@/pages/projetos/hooks/useProjetoTimeline";

const timeline = vi.hoisted(() => ({ data: undefined as ProjetoTimelineEvento[] | undefined, isLoading: false }));
vi.mock("@/pages/projetos/hooks/useProjetoTimeline", () => ({ useProjetoTimeline: () => timeline }));
vi.mock("@/components/motion/ReadingRing", () => ({ ReadingRing: () => <div data-testid="carregando" /> }));

import { ProjetoHistoricoTab } from "./ProjetoHistoricoTab";

const evento = (p: Partial<ProjetoTimelineEvento>): ProjetoTimelineEvento => ({
  disciplinaId: null,
  disciplinaNome: null,
  tipo: "projeto_iniciado",
  ocorridoEm: "2026-05-01T10:00:00Z",
  detalhe: null,
  autorNome: null,
  ...p,
});

beforeEach(() => {
  timeline.data = undefined;
  timeline.isLoading = false;
});

describe("ProjetoHistoricoTab", () => {
  it("carregando mostra o anel de leitura", () => {
    timeline.isLoading = true;
    render(<ProjetoHistoricoTab projetoId="p1" disciplinas={[]} />);
    expect(screen.getByTestId("carregando")).toBeInTheDocument();
  });

  it("sem eventos mostra o estado vazio", () => {
    render(<ProjetoHistoricoTab projetoId="p1" disciplinas={[]} />);
    expect(screen.getByText("Nenhum evento ainda")).toBeInTheDocument();
  });

  it("lista eventos com rótulo, disciplina, detalhe e autor; sem disciplinas não mostra filtro", () => {
    timeline.data = [
      evento({ tipo: "portal_entrega_aprovada", disciplinaNome: "Estrutural", detalhe: "Prancha 3", autorNome: "Ana" }),
      evento({ tipo: "status_alterado" }),
    ];
    render(<ProjetoHistoricoTab projetoId="p1" disciplinas={[]} />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("Entrega aprovada pelo cliente")).toBeInTheDocument();
    expect(screen.getByText("Status alterado")).toBeInTheDocument();
    expect(screen.getByText("Estrutural")).toBeInTheDocument();
    expect(screen.getByText("Prancha 3")).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
  });

  it("filtra por disciplina e mostra vazio quando a disciplina não tem evento", () => {
    timeline.data = [
      evento({ tipo: "disciplina_iniciada", disciplinaId: "d1", disciplinaNome: "Estrutural" }),
      evento({ tipo: "pausa_iniciada", disciplinaId: "d2", disciplinaNome: "Elétrica" }),
    ];
    render(
      <ProjetoHistoricoTab
        projetoId="p1"
        disciplinas={[
          { id: "d1", nome: "Estrutural" },
          { id: "d2", nome: "Elétrica" },
          { id: "d3", nome: "Hidráulica" },
        ]}
      />
    );
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Elétrica" }));
    expect(screen.getByText("Disciplina pausada")).toBeInTheDocument();
    expect(screen.queryByText("Disciplina iniciada")).not.toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Hidráulica" }));
    expect(screen.getByText("Nenhum evento para esta disciplina")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Todas as disciplinas" }));
    expect(screen.getByText("Disciplina iniciada")).toBeInTheDocument();
  });
});
