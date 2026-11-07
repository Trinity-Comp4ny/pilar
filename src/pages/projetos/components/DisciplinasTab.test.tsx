import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Projeto } from "@/types/projetos";

// Visão "Disciplinas" da página Projetos: agrupa as atribuições por disciplina, KPIs,
// busca, filtros por status e projeto, expandir/recolher, cards e tabela, vazio e
// carregamento; ações de grupo só para quem edita.

vi.mock("@/pages/projetos/components/DisciplinaGrupoAcoes", () => ({
  DisciplinaGrupoAcoes: ({ nome }: { nome: string }) => <span>acoes:{nome}</span>,
}));

Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import { DisciplinasTab } from "./DisciplinasTab";

const d = (disciplina: string, status: string, resp: string, previsao?: string, final?: string) => ({
  disciplina,
  status,
  responsavel_id: resp ? `id-${resp}` : "",
  responsavel_nome: resp,
  responsaveis: resp ? [{ responsavel_id: `id-${resp}`, responsavel_nome: resp }] : [],
  data_previsao: previsao,
  data_final: final,
});

const projetos = [
  {
    id: "p-1",
    nome: "Residência Silva",
    status: "Em andamento",
    disciplinas: [
      d("Estrutural", "Concluído", "Ana", "2026-03-01", "2026-02-25"),
      d("Elétrica", "Em Andamento", "Bia", "2020-01-01"),
    ],
  },
  {
    id: "p-2",
    nome: "Galpão Norte",
    status: "Planejamento",
    disciplinas: [d("Estrutural", "Pendente", "Caio", "2099-01-01"), d("Hidráulica", "Não Iniciado", "")],
  },
] as unknown as Projeto[];

function montar(props: Partial<Parameters<typeof DisciplinasTab>[0]> = {}) {
  return render(
    <TooltipProvider>
      <DisciplinasTab projetos={projetos} {...props} />
    </TooltipProvider>
  );
}

function escolher(rotulo: string, opcao: string) {
  fireEvent.keyDown(screen.getByRole("combobox", { name: rotulo }), { key: "Enter" });
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: opcao }));
}

describe("DisciplinasTab", () => {
  beforeEach(() => vi.clearAllMocks());

  it("carregando mostra o indicador", () => {
    montar({ isLoading: true });
    expect(screen.queryByText("Estrutural")).not.toBeInTheDocument();
  });

  it("agrupa por disciplina com KPIs", () => {
    montar();
    expect(screen.getByText("Estrutural")).toBeInTheDocument();
    expect(screen.getByText("Elétrica")).toBeInTheDocument();
    expect(screen.getByText("Hidráulica")).toBeInTheDocument();
    expect(screen.getByText("Concluídas")).toBeInTheDocument();
    expect(screen.getByText("atribuições")).toBeInTheDocument();
  });

  it("busca sem resultado mostra o vazio e limpar filtros volta", () => {
    montar();
    fireEvent.change(screen.getByPlaceholderText("Buscar disciplina..."), { target: { value: "paisagismo" } });
    expect(screen.getByText("Nenhuma disciplina encontrada")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByText("Estrutural")).toBeInTheDocument();
  });

  it("busca por nome de projeto ou responsável também encontra", () => {
    montar();
    fireEvent.change(screen.getByPlaceholderText("Buscar disciplina..."), { target: { value: "elé" } });
    expect(screen.getByText("Elétrica")).toBeInTheDocument();
    expect(screen.queryByText("Hidráulica")).not.toBeInTheDocument();
  });

  it("filtro por status e por projeto", () => {
    montar();
    escolher("Filtrar por status", "Pendente");
    expect(screen.getByText("Estrutural")).toBeInTheDocument();
    expect(screen.queryByText("Elétrica")).not.toBeInTheDocument();
    escolher("Filtrar por status", "Todos os status");
    escolher("Filtrar por projeto", "Galpão Norte");
    expect(screen.getByText("Hidráulica")).toBeInTheDocument();
    expect(screen.queryByText("Elétrica")).not.toBeInTheDocument();
  });

  it("expandir tudo mostra os projetos de cada disciplina; recolher esconde", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /Expandir tudo/ }));
    expect(screen.getAllByText("Residência Silva").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Galpão Norte").length).toBeGreaterThan(0);
    expect(screen.getByText("Caio")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Recolher tudo/ }));
    expect(screen.queryByText("Caio")).not.toBeInTheDocument();
  });

  it("expandir um grupo só pelo cabeçalho", () => {
    montar();
    fireEvent.click(screen.getByText("Hidráulica"));
    expect(screen.getAllByText("Galpão Norte").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("Hidráulica"));
  });

  it("tabela mostra uma linha por atribuição", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Tabela" }));
    const tabela = screen.getByRole("table");
    expect(within(tabela).getAllByRole("row").length).toBeGreaterThanOrEqual(5);
    expect(within(tabela).getByText("Caio")).toBeInTheDocument();
  });

  it("ações de grupo aparecem só para quem edita", () => {
    const { unmount } = montar({ canEdit: true, onChanged: vi.fn() });
    expect(screen.getByText("acoes:Estrutural")).toBeInTheDocument();
    unmount();
    montar({ canEdit: false });
    expect(screen.queryByText(/acoes:/)).not.toBeInTheDocument();
  });

  it("tabela com edição também tem ações", () => {
    montar({ canEdit: true, onChanged: vi.fn() });
    fireEvent.click(screen.getByRole("button", { name: "Tabela" }));
    expect(screen.getAllByText(/acoes:/).length).toBeGreaterThan(0);
  });

  it("sem projetos mostra o vazio", () => {
    montar({ projetos: [] });
    expect(screen.getByText("Nenhuma disciplina encontrada")).toBeInTheDocument();
  });
});
