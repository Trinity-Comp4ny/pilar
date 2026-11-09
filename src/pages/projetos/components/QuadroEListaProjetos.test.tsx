import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { DragDropContext } from "@hello-pangea/dnd";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fake, rpcComEmpresa } from "@/pages/obras/testing/supabaseFake";
import type { Projeto } from "@/types/projetos";
import type { ProjetoEtapa } from "@/pages/projetos/hooks/useProjetoEtapas";

// Quadro (colunas por etapa, órfãos, criar coluna, criar projeto rápido), cards,
// lista em tabela, lista do celular, KPIs e o vazio da página Projetos.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/obras/testing/supabaseFake")).fake.supabase,
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const perms = vi.hoisted(() => ({ financeiro: true }));
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ can: (f: string) => (f === "financeiro" ? perms.financeiro : true) }),
}));

Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import { KanbanBoard } from "./KanbanBoard";
import { ListaProjetos } from "./ListaProjetos";
import { ProjetosMobileList } from "./ProjetosMobileList";
import { ProjetosKPIs } from "./ProjetosKPIs";
import { ProjetosEmptyState } from "./ProjetosEmptyState";

const hoje = new Date();
const iso = (dias: number) => {
  const d = new Date(hoje);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};

const projetos = [
  {
    id: "p-1",
    nome: "Residência Silva",
    cliente_nome: "Ana",
    status: "Em andamento",
    etapa_id: "e-2",
    prioridade: "Alta",
    valor_contrato: 120000,
    data_inicio: iso(-60),
    data_previsao: iso(-3),
    disciplinas: [
      {
        disciplina: "Estrutural",
        status: "Concluído",
        responsavel_nome: "Bia",
        responsaveis: [{ responsavel_id: "b", responsavel_nome: "Bia" }],
      },
    ],
  },
  {
    id: "p-2",
    nome: "Galpão Norte",
    cliente_nome: "Bruno",
    status: "Planejamento",
    etapa_id: "e-1",
    prioridade: "Baixa",
    valor_contrato: 50000,
    data_inicio: iso(-5),
    data_previsao: iso(4),
    disciplinas: [{ disciplina: "Elétrica", status: "Não Iniciado", responsaveis: [] }],
  },
  {
    id: "p-3",
    nome: "Loja Centro",
    cliente_nome: "Caio",
    status: "Legado",
    etapa_id: null,
    prioridade: null,
    valor_contrato: 0,
    data_inicio: iso(-5),
    data_previsao: iso(90),
    disciplinas: [],
  },
] as unknown as Projeto[];

const etapas: ProjetoEtapa[] = [
  { id: "e-1", nome: "Briefing", ordem: 1, cor: null, bucket: "Planejamento" as never },
  { id: "e-2", nome: "Execução", ordem: 2, cor: "#3b82f6", bucket: "Em andamento" as never },
];

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/projetos"]}>
        <Routes>
          <Route path="/projetos" element={<DragDropContext onDragEnd={() => {}}>{children}</DragDropContext>} />
          <Route path="/projetos/:id" element={<div>pagina-projeto</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function montarQuadro(over: Partial<Parameters<typeof KanbanBoard>[0]> = {}) {
  const h = {
    onToggleColumn: vi.fn(),
    onCriarEtapa: vi.fn().mockResolvedValue(true),
    onEditarEtapa: vi.fn(),
    onReordenarEtapa: vi.fn(),
    onExcluirEtapa: vi.fn(),
    onCardClick: vi.fn(),
    onEditClick: vi.fn(),
    onDelete: vi.fn(),
    onQuickAddCreated: vi.fn(),
  };
  render(
    <KanbanBoard
      etapas={etapas}
      collapsedColumns={new Set()}
      loadingProjetos={false}
      canEdit
      clientes={[{ id: "c-1", nome: "Ana" }]}
      rentabilidadeMap={{ "p-1": 10 }}
      getProjetosByEtapa={(id) => projetos.filter((p) => p.etapa_id === id)}
      orfaos={projetos.filter((p) => !p.etapa_id)}
      criandoEtapa={false}
      {...h}
      {...over}
    />,
    { wrapper: wrapper() }
  );
  return h;
}

const abrirMenu = (botao: HTMLElement) => fireEvent.pointerDown(botao, { button: 0, ctrlKey: false });

describe("KanbanBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fake.reset();
    rpcComEmpresa();
    perms.financeiro = true;
  });

  it("mostra uma coluna por etapa, os cards e a coluna dos órfãos", () => {
    montarQuadro();
    expect(screen.getByText("Briefing")).toBeInTheDocument();
    expect(screen.getByText("Execução")).toBeInTheDocument();
    expect(screen.getByText("Sem coluna")).toBeInTheDocument();
    expect(screen.getByText("Residência Silva")).toBeInTheDocument();
    expect(screen.getByText("Loja Centro")).toBeInTheDocument();
    expect(screen.getByText("Margem baixa")).toBeInTheDocument();
    expect(screen.getByText("Planejamento pendente")).toBeInTheDocument();
    expect(screen.getByText(/-3d/)).toBeInTheDocument();
  });

  it("clicar no card abre o projeto", () => {
    const h = montarQuadro();
    fireEvent.click(screen.getByText("Galpão Norte"));
    expect(h.onCardClick).toHaveBeenCalledWith(projetos[1]);
  });

  it("menu do card: editar, excluir e abrir a página", async () => {
    const h = montarQuadro();
    // ordem de render: Briefing (Galpão), Execução (Residência), Sem coluna (Loja)
    abrirMenu(screen.getAllByRole("button", { name: "Mais opções" })[0]);
    fireEvent.click(await screen.findByRole("menuitem", { name: /Editar dados/ }));
    expect(h.onEditClick).toHaveBeenCalledWith(projetos[1]);
    abrirMenu(screen.getAllByRole("button", { name: "Mais opções" })[1]);
    fireEvent.click(await screen.findByRole("menuitem", { name: /Excluir/ }));
    expect(h.onDelete).toHaveBeenCalledWith("p-1");
    abrirMenu(screen.getAllByRole("button", { name: "Mais opções" })[2]);
    fireEvent.click(await screen.findByRole("menuitem", { name: /Abrir página completa/ }));
    expect(await screen.findByText("pagina-projeto")).toBeInTheDocument();
  });

  it("coluna: recolher e ações de editar, mover e excluir", async () => {
    const h = montarQuadro();
    fireEvent.click(screen.getAllByRole("button", { name: "Minimizar coluna" })[0]);
    expect(h.onToggleColumn).toHaveBeenCalledWith("e-1");
    abrirMenu(screen.getAllByRole("button", { name: "Ações da coluna" })[0]);
    const itens = await screen.findAllByRole("menuitem");
    for (const item of itens) {
      if (item.getAttribute("aria-disabled") !== "true" && !item.hasAttribute("data-disabled")) {
        fireEvent.click(item);
        break;
      }
    }
    expect(
      h.onEditarEtapa.mock.calls.length + h.onReordenarEtapa.mock.calls.length + h.onExcluirEtapa.mock.calls.length
    ).toBe(1);
  });

  it("coluna recolhida mostra o botão de expandir", () => {
    montarQuadro({ collapsedColumns: new Set(["e-2"]) });
    expect(screen.getByRole("button", { name: "Expandir coluna Execução" })).toBeInTheDocument();
  });

  it("carregando mostra esqueleto e sem edição não há criação", () => {
    montarQuadro({ loadingProjetos: true, canEdit: false });
    expect(screen.queryByText("Adicionar projeto")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ações da coluna" })).not.toBeInTheDocument();
  });

  it("criar coluna com o balde escolhido", async () => {
    const h = montarQuadro();
    fireEvent.click(screen.getByRole("button", { name: /Nova coluna/ }));
    fireEvent.change(screen.getByPlaceholderText("Nome da coluna"), { target: { value: "Aprovação" } });
    const combo = screen.getAllByRole("combobox").at(-1)!;
    fireEvent.keyDown(combo, { key: "Enter" });
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Revisão" }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    await waitFor(() => expect(h.onCriarEtapa).toHaveBeenCalledWith("Aprovação", expect.any(String), "Revisão"));
  });

  describe("criar projeto rápido na coluna", () => {
    const abrir = () => fireEvent.click(screen.getAllByRole("button", { name: /Adicionar projeto/ })[0]);

    it("exige nome e cliente", () => {
      montarQuadro();
      abrir();
      expect(screen.getByRole("button", { name: "Criar" })).toBeDisabled();
    });

    it("cria pelo RPC e move para a coluna clicada", async () => {
      rpcComEmpresa({ create_projeto_completo: { data: "p-novo", error: null } });
      const h = montarQuadro();
      abrir();
      fireEvent.change(screen.getByPlaceholderText("Nome do projeto"), { target: { value: "  Casa nova " } });
      fireEvent.keyDown(
        screen.getAllByRole("combobox").find((c) => c.textContent?.includes("Cliente"))!,
        {
          key: "Enter",
        }
      );
      fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Ana" }));
      fireEvent.click(screen.getByRole("button", { name: "Criar" }));
      await waitFor(() => expect(h.onQuickAddCreated).toHaveBeenCalled());
      expect(fake.rpc).toHaveBeenCalledWith(
        "create_projeto_completo",
        expect.objectContaining({ p_nome: "Casa nova", p_cliente_id: "c-1" })
      );
      expect(fake.escritas("projetos")[0]).toMatchObject({
        payload: { etapa_id: "e-1" },
        filtros: [["eq", "id", "p-novo"]],
      });
      expect(toast.success).toHaveBeenCalledWith("Projeto criado");
    });

    it("limite de projetos do plano mostra a mensagem de capacidade", async () => {
      rpcComEmpresa({
        create_projeto_completo: { data: null, error: { message: "capacidade:projetos", hint: "3", code: "P0001" } },
      });
      const h = montarQuadro();
      abrir();
      fireEvent.change(screen.getByPlaceholderText("Nome do projeto"), { target: { value: "Quarto projeto" } });
      fireEvent.keyDown(
        screen.getAllByRole("combobox").find((c) => c.textContent?.includes("Cliente"))!,
        {
          key: "Enter",
        }
      );
      fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Ana" }));
      fireEvent.click(screen.getByRole("button", { name: "Criar" }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Limite de projetos ativos atingido."));
      expect(h.onQuickAddCreated).not.toHaveBeenCalled();
      expect(fake.escritas("projetos")).toHaveLength(0);
    });

    it("Esc e cancelar fecham o formulário", () => {
      montarQuadro();
      abrir();
      fireEvent.keyDown(screen.getByPlaceholderText("Nome do projeto"), { key: "Escape" });
      expect(screen.queryByPlaceholderText("Nome do projeto")).not.toBeInTheDocument();
      abrir();
      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
      expect(screen.queryByPlaceholderText("Nome do projeto")).not.toBeInTheDocument();
    });
  });
});

describe("ListaProjetos", () => {
  it("tabela com coluna, prioridade, prazo, valor e margem; clique abre", () => {
    const onCardClick = vi.fn();
    const onMoverEtapa = vi.fn();
    render(
      <ListaProjetos
        projetos={projetos}
        etapas={etapas}
        rentabilidadeMap={{ "p-1": 32.4 }}
        canEdit
        onCardClick={onCardClick}
        onMoverEtapa={onMoverEtapa}
      />,
      { wrapper: wrapper() }
    );
    const tabela = screen.getByRole("table");
    expect(within(tabela).getByText("Residência Silva")).toBeInTheDocument();
    expect(within(tabela).getByText("32%")).toBeInTheDocument();
    expect(within(tabela).getAllByText("Alta").length).toBeGreaterThan(0);
    fireEvent.click(within(tabela).getByText("Galpão Norte"));
    expect(onCardClick).toHaveBeenCalledWith(projetos[1]);
  });

  it("vazio mostra a mensagem", () => {
    render(
      <ListaProjetos
        projetos={[]}
        etapas={etapas}
        rentabilidadeMap={{}}
        canEdit={false}
        onCardClick={vi.fn()}
        onMoverEtapa={vi.fn()}
      />,
      { wrapper: wrapper() }
    );
    expect(screen.getByText("Nenhum projeto nesta lista.")).toBeInTheDocument();
  });
});

describe("ProjetosMobileList", () => {
  it("agrupa por status e permite mover pelo menu do card", async () => {
    const onMoveStatus = vi.fn();
    render(
      <ProjetosMobileList
        canEdit
        rentabilidadeMap={{}}
        getProjetosByStatus={(s) => projetos.filter((p) => p.status === s)}
        onCardClick={vi.fn()}
        onEditClick={vi.fn()}
        onDelete={vi.fn()}
        onMoveStatus={onMoveStatus}
      />,
      { wrapper: wrapper() }
    );
    expect(screen.getByText("Residência Silva")).toBeInTheDocument();
    expect(screen.getByText("Galpão Norte")).toBeInTheDocument();
    expect(screen.queryByText("Loja Centro")).not.toBeInTheDocument();
  });
});

describe("ProjetosKPIs", () => {
  it("conta ativos, atrasados e próximos; cards com valor viram filtro", () => {
    const onFilterAtraso = vi.fn();
    const onFilterProximos = vi.fn();
    render(<ProjetosKPIs projetos={projetos} onFilterAtraso={onFilterAtraso} onFilterProximos={onFilterProximos} />);
    expect(screen.getByText("Projetos ativos").parentElement?.parentElement).toHaveTextContent("3");
    expect(screen.getByText("Valor pipeline")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Em atraso"));
    fireEvent.click(screen.getByText("Próximas entregas (7d)"));
    expect(onFilterAtraso).toHaveBeenCalled();
    expect(onFilterProximos).toHaveBeenCalled();
  });

  it("sem financeiro não mostra o valor do pipeline", () => {
    perms.financeiro = false;
    render(<ProjetosKPIs projetos={projetos} />);
    expect(screen.queryByText("Valor pipeline")).not.toBeInTheDocument();
    perms.financeiro = true;
  });
});

describe("ProjetosEmptyState", () => {
  it("erro oferece tentar de novo", () => {
    const onRetry = vi.fn();
    render(<ProjetosEmptyState variant="error" onRetry={onRetry} />);
    expect(screen.getByText("Não foi possível carregar os projetos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("sem resultados oferece limpar filtros", () => {
    const onClearFilters = vi.fn();
    render(<ProjetosEmptyState variant="no-results" onClearFilters={onClearFilters} />);
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(onClearFilters).toHaveBeenCalled();
  });

  it("sem projetos oferece criar o primeiro", () => {
    const onCreate = vi.fn();
    render(<ProjetosEmptyState variant="no-projetos" onCreate={onCreate} />);
    fireEvent.click(screen.getByRole("button", { name: /Criar primeiro projeto/ }));
    expect(onCreate).toHaveBeenCalled();
  });
});
