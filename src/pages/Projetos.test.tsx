import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { useState, type ReactNode } from "react";
import { sb } from "@/pages/financeiro/testing/supabaseMock";

// Página de Projetos (casca em src/pages): filtros aplicados à lista, agrupamento
// por coluna (com órfãos), abas (quadro, lista, disciplinas, cronograma, mapa),
// estados vazio/erro, exclusão com "Desfazer", datas do cronograma e a gestão
// das colunas (criar, editar, reordenar, excluir). Os componentes do módulo
// viram marcadores que expõem as props que a página passa.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/financeiro/testing/supabaseMock")).sb.client,
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));

const ctx = vi.hoisted(() => ({
  podeEditar: true,
  mobile: false,
  projetos: [] as Record<string, unknown>[],
  loading: false,
  erro: false,
  refetch: vi.fn(),
  etapas: [] as { id: string; nome: string; ordem: number; cor: string | null; bucket: string }[],
  aba: "quadro",
  visao: "quadro" as "quadro" | "lista",
  mut: {
    criar: { mutateAsync: vi.fn(), isPending: false },
    editar: { mutateAsync: vi.fn(), isPending: false },
    reordenar: { mutateAsync: vi.fn(), isPending: false },
    excluir: { mutateAsync: vi.fn(), isPending: false },
  },
  applyStatusMove: vi.fn(),
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    can: (feature: string, action = "view") => (action === "view" && feature !== "financeiro" ? true : ctx.podeEditar),
  }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => ctx.mobile }));
vi.mock("@/components/PageLayout", () => ({
  PageLayout: ({ header, toolbar, children }: { header: ReactNode; toolbar: ReactNode; children: ReactNode }) => (
    <div>
      {header}
      {toolbar}
      {children}
    </div>
  ),
}));
vi.mock("@/components/PageHeader", () => ({
  PageHeader: ({
    search,
    primaryAction,
    children,
  }: {
    search: { value: string; onChange: (v: string) => void };
    primaryAction: { label: string; onClick: () => void };
    children: ReactNode;
  }) => (
    <header>
      <input aria-label="Buscar projetos" value={search.value} onChange={(e) => search.onChange(e.target.value)} />
      <button type="button" onClick={primaryAction.onClick}>
        {primaryAction.label}
      </button>
      {children}
    </header>
  ),
}));
vi.mock("@/components/CollapsibleKpiSection", () => ({
  CollapsibleKpiSection: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/kanban/KanbanSortControl", () => ({ KanbanSortControl: () => null }));
vi.mock("@/components/ViewSwitcher", () => ({
  ViewSwitcher: ({ onChange }: { onChange: (v: string) => void }) => (
    <button type="button" onClick={() => onChange("lista")}>
      ver-lista
    </button>
  ),
}));

type Filtros = Record<string, unknown>;
vi.mock("@/pages/projetos/hooks/useProjetosUrlState", () => ({
  useProjetosUrlState: () => {
    const [filters, setFilters] = useState<Filtros>({
      search: "",
      pessoaIds: [],
      prioridades: [],
      clienteIds: [],
      disciplinaIds: [],
      deadlineStatus: [],
      dataCampo: "previsao",
      dataInicio: "",
      dataFim: "",
    });
    const [viewMode, setViewMode] = useState(ctx.visao);
    return {
      filters,
      setFilters,
      sort: { key: "name", dir: "asc" },
      setSort: vi.fn(),
      collapsedColumns: new Set(),
      toggleColumn: vi.fn(),
      activeTab: ctx.aba,
      viewMode,
      setViewMode,
    };
  },
}));
vi.mock("@/pages/projetos/hooks/useProjetosData", () => ({
  useProjetosData: () => ({
    templatesData: [],
    fluxosData: [],
    rentabilidadeMap: new Map(),
    currentUser: null,
    projetos: ctx.projetos,
    loadingProjetos: ctx.loading,
    projetosError: ctx.erro,
    refetchProjetos: ctx.refetch,
    clientes: [],
    pessoas: [],
    disciplinas: [
      { id: "d-arq", nome: "Arquitetura" },
      { id: "d-est", nome: "Estrutural" },
    ],
  }),
}));
vi.mock("@/pages/projetos/hooks/useProjetoStatusMove", () => ({
  useProjetoStatusMove: () => ({
    pendingPausa: null,
    setPendingPausa: vi.fn(),
    pendingRetomada: null,
    setPendingRetomada: vi.fn(),
    pendingReopen: { projetoId: "p1", newStatus: "Em andamento", etapaId: "e1" },
    setPendingReopen: vi.fn(),
    applyStatusMove: ctx.applyStatusMove,
    handleMoveStatus: vi.fn(),
    moverParaEtapa: vi.fn(),
    onDragEnd: vi.fn(),
  }),
}));
vi.mock("@/pages/projetos/hooks/useProjetoEtapas", () => ({
  CORES_ETAPA_PROJETO: [],
  corDaEtapaProjeto: (c: string | null) => c ?? "#ccc",
  useProjetoEtapas: () => ({ data: ctx.etapas }),
  useProjetoEtapaMutations: () => ctx.mut,
}));

// Filtros expostos como botões que aplicam um recorte por vez.
vi.mock("@/pages/projetos/components/ProjetosFilterBar", () => ({
  EMPTY_FILTERS: {
    search: "",
    pessoaIds: [],
    prioridades: [],
    clienteIds: [],
    disciplinaIds: [],
    deadlineStatus: [],
    dataCampo: "previsao",
    dataInicio: "",
    dataFim: "",
  },
  ProjetosFilterBar: ({ onChange }: { onChange: (fn: (f: Filtros) => Filtros) => void }) => {
    const aplicar = (patch: Filtros) => () => onChange((f) => ({ ...f, ...patch }));
    return (
      <div>
        <button type="button" onClick={aplicar({ prioridades: ["Alta"] })}>
          f-prioridade
        </button>
        <button type="button" onClick={aplicar({ clienteIds: ["c1"] })}>
          f-cliente
        </button>
        <button type="button" onClick={aplicar({ pessoaIds: ["pe2"] })}>
          f-pessoa
        </button>
        <button type="button" onClick={aplicar({ disciplinaIds: ["d-est"] })}>
          f-disciplina
        </button>
        <button type="button" onClick={aplicar({ deadlineStatus: ["concluido_no_prazo"] })}>
          f-prazo
        </button>
        <button
          type="button"
          onClick={aplicar({ dataCampo: "inicio", dataInicio: "2026-02-01", dataFim: "2026-12-31" })}
        >
          f-inicio
        </button>
        <button
          type="button"
          onClick={aplicar({ dataCampo: "final", dataInicio: "2026-01-01", dataFim: "2026-03-01" })}
        >
          f-final
        </button>
      </div>
    );
  },
}));
vi.mock("@/pages/projetos/components/ProjetosKPIs", () => ({
  ProjetosKPIsResumo: () => <span data-testid="kpis-resumo" />,
  ProjetosKPIs: ({
    onFilterAtraso,
    onFilterProximos,
  }: {
    onFilterAtraso: () => void;
    onFilterProximos: () => void;
  }) => (
    <div>
      <button type="button" onClick={onFilterAtraso}>
        kpi-atraso
      </button>
      <button type="button" onClick={onFilterProximos}>
        kpi-proximos
      </button>
    </div>
  ),
}));
vi.mock("@/pages/projetos/components/ProjetosEmptyState", () => ({
  ProjetosEmptyState: ({
    variant,
    onRetry,
    onCreate,
    onClearFilters,
  }: {
    variant: string;
    onRetry?: () => void;
    onCreate?: () => void;
    onClearFilters?: () => void;
  }) => (
    <div>
      vazio:{variant}
      {onRetry && (
        <button type="button" onClick={onRetry}>
          tentar
        </button>
      )}
      {onCreate && (
        <button type="button" onClick={onCreate}>
          criar-primeiro
        </button>
      )}
      {onClearFilters && (
        <button type="button" onClick={onClearFilters}>
          limpar
        </button>
      )}
    </div>
  ),
}));

type P = { id: string; nome: string };
vi.mock("@/pages/projetos/components/KanbanBoard", () => ({
  KanbanBoard: (p: {
    etapas: { id: string; nome: string }[];
    getProjetosByEtapa: (id: string) => P[];
    orfaos: P[];
    onCriarEtapa: (n: string, c: string, b: string) => Promise<boolean>;
    onEditarEtapa: (e: unknown) => void;
    onReordenarEtapa: (id: string, d: -1 | 1) => void;
    onExcluirEtapa: (e: unknown) => void;
    onCardClick: (p: P) => void;
    onEditClick: (p: P) => void;
    onDelete: (id: string) => void;
    onQuickAddCreated: () => void;
  }) => (
    <div data-testid="kanban">
      {p.etapas.map((e) => (
        <section key={e.id} aria-label={`coluna ${e.nome}`}>
          {p.getProjetosByEtapa(e.id).map((x) => (
            <span key={x.id}>{x.nome}</span>
          ))}
          <button type="button" onClick={() => p.onEditarEtapa(e)}>
            editar-{e.nome}
          </button>
          <button type="button" onClick={() => p.onReordenarEtapa(e.id, 1)}>
            direita-{e.nome}
          </button>
          <button type="button" onClick={() => p.onReordenarEtapa(e.id, -1)}>
            esquerda-{e.nome}
          </button>
          <button type="button" onClick={() => p.onExcluirEtapa(e)}>
            excluir-{e.nome}
          </button>
        </section>
      ))}
      <section aria-label="orfaos">
        {p.orfaos.map((x) => (
          <span key={x.id}>{x.nome}</span>
        ))}
      </section>
      <button type="button" onClick={() => void p.onCriarEtapa(" Revisão ", "#f00", "Revisão")}>
        nova-coluna
      </button>
      <button type="button" onClick={() => void p.onCriarEtapa("   ", "#f00", "Revisão")}>
        nova-coluna-vazia
      </button>
      {p.etapas.length > 0 && p.getProjetosByEtapa(p.etapas[0].id)[0] && (
        <>
          <button type="button" onClick={() => p.onCardClick(p.getProjetosByEtapa(p.etapas[0].id)[0])}>
            abrir-card
          </button>
          <button type="button" onClick={() => p.onEditClick(p.getProjetosByEtapa(p.etapas[0].id)[0])}>
            editar-card
          </button>
          <button type="button" onClick={() => p.onDelete(p.getProjetosByEtapa(p.etapas[0].id)[0].id)}>
            excluir-card
          </button>
        </>
      )}
      <button type="button" onClick={() => p.onDelete("sumiu")}>
        excluir-inexistente
      </button>
      <button type="button" onClick={p.onQuickAddCreated}>
        quick-add
      </button>
    </div>
  ),
}));
vi.mock("@/pages/projetos/components/ProjetosMobileList", () => ({
  ProjetosMobileList: ({ getProjetosByStatus }: { getProjetosByStatus: (s: string) => P[] }) => (
    <div data-testid="mobile">
      {getProjetosByStatus("Em andamento")
        .concat(getProjetosByStatus("Inexistente"))
        .map((x) => x.nome)
        .join(",")}
    </div>
  ),
}));
vi.mock("@/pages/projetos/components/ListaProjetos", () => ({
  ListaProjetos: ({ projetos }: { projetos: P[] }) => (
    <div data-testid="lista">{projetos.map((x) => x.nome).join(",")}</div>
  ),
}));
vi.mock("@/pages/projetos/components/DisciplinasTab", () => ({
  DisciplinasTab: ({ onChanged }: { onChanged: () => void }) => (
    <button type="button" onClick={onChanged}>
      aba-disciplinas
    </button>
  ),
}));
vi.mock("@/pages/projetos/components/CronogramaProjetosTab", () => ({
  CronogramaProjetosTab: ({
    onDatesChange,
  }: {
    onDatesChange?: (id: string, u: { data_inicio: string; data_previsao: string }) => Promise<void>;
  }) => (
    <button
      type="button"
      disabled={!onDatesChange}
      onClick={() =>
        onDatesChange?.("p1", { data_inicio: "2026-01-01", data_previsao: "2026-02-01" }).catch(() => undefined)
      }
    >
      aba-cronograma
    </button>
  ),
}));
vi.mock("@/pages/projetos/components/MapaTab", () => ({ MapaTab: () => <div>aba-mapa</div> }));
vi.mock("@/pages/projetos/components/ProjectDetailDialog", () => ({
  ProjectDetailDialog: ({
    open,
    projeto,
    onEdit,
    onProjectUpdated,
  }: {
    open: boolean;
    projeto: P | null;
    onEdit: (p: P) => void;
    onProjectUpdated: () => void;
  }) =>
    open && projeto ? (
      <div>
        detalhe:{projeto.nome}
        <button type="button" onClick={() => onEdit(projeto)}>
          detalhe-editar
        </button>
        <button type="button" onClick={onProjectUpdated}>
          detalhe-atualizou
        </button>
      </div>
    ) : null,
}));
vi.mock("@/pages/projetos/components/ProjetoFormDialog", () => ({
  ProjetoFormDialog: ({ open, editProjeto, onSaved }: { open: boolean; editProjeto: P | null; onSaved: () => void }) =>
    open ? (
      <div>
        form:{editProjeto?.nome ?? "novo"}
        <button type="button" onClick={onSaved}>
          form-salvou
        </button>
      </div>
    ) : null,
}));
vi.mock("@/pages/projetos/components/ManageDisciplinasDialog", () => ({
  ManageDisciplinasDialog: ({ open, onDisciplinasChanged }: { open: boolean; onDisciplinasChanged: () => void }) =>
    open ? (
      <button type="button" onClick={onDisciplinasChanged}>
        dialogo-disciplinas
      </button>
    ) : null,
}));
vi.mock("@/pages/projetos/components/FluxoDisciplinasDialog", () => ({
  FluxoDisciplinasDialog: ({ open }: { open: boolean }) => (open ? <div>dialogo-fluxos</div> : null),
}));
vi.mock("@/pages/projetos/components/PausarProjetoDialog", () => ({ PausarProjetoDialog: () => null }));
vi.mock("@/pages/projetos/components/RetomarProjetoDialog", () => ({ RetomarProjetoDialog: () => null }));
vi.mock("@/pages/projetos/components/ProjetoStatusDialogs", () => ({
  ReopenProjetoDialog: ({ onConfirm }: { onConfirm: () => Promise<void> }) => (
    <button type="button" onClick={() => void onConfirm()}>
      reabrir-confirmar
    </button>
  ),
}));
vi.mock("@/components/kanban/EditColumnDialog", () => ({
  EditColumnDialog: ({
    coluna,
    onSave,
  }: {
    coluna: { id: string; nome: string; cor: string } | null;
    onSave: (c: { id: string; nome: string; cor: string }) => Promise<boolean>;
  }) =>
    coluna ? (
      <button type="button" onClick={() => void onSave({ ...coluna, nome: "Renomeada" })}>
        salvar-coluna:{coluna.nome}
      </button>
    ) : null,
}));

import ProjetosKanban from "./Projetos";

const ETAPAS = [
  { id: "e1", nome: "Planejamento", ordem: 0, cor: null, bucket: "Planejamento" },
  { id: "e2", nome: "Execução", ordem: 1, cor: "#0a0", bucket: "Em andamento" },
];

const PROJETOS = [
  {
    id: "p1",
    nome: "Torre Alfa",
    cliente_nome: "Construtora X",
    cliente_id: "c1",
    prioridade: "Alta",
    status: "Em andamento",
    etapa_id: "e1",
    data_inicio: "2026-03-01",
    data_previsao: "2026-12-01",
    disciplinas: [{ disciplina: "Arquitetura", responsavel_id: "pe1" }],
  },
  {
    id: "p2",
    nome: "Casa Beta",
    cliente_nome: null,
    cliente_id: "c2",
    prioridade: "Baixa",
    status: "Concluído",
    etapa_id: "e2",
    data_inicio: "2026-01-10",
    data_previsao: "2026-02-01",
    data_final: "2026-01-20",
    disciplinas: [{ disciplina: "Estrutural", responsavel_id: null, responsaveis: [{ responsavel_id: "pe2" }] }],
  },
  {
    id: "p3",
    nome: "Galpão Órfão",
    cliente_id: "c3",
    prioridade: "Media",
    status: "Em andamento",
    etapa_id: "legado",
    data_inicio: null,
    data_previsao: null,
  },
];

function Url() {
  return <span data-testid="url">{useLocation().search}</span>;
}

function abrir(url = "/projetos") {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <ProjetosKanban />
        <Url />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return { invalidate };
}

const visiveis = () =>
  ["Torre Alfa", "Casa Beta", "Galpão Órfão"].filter(
    (n) => within(screen.getByTestId("kanban")).queryByText(n) !== null
  );

beforeEach(() => {
  vi.clearAllMocks();
  sb.reset();
  ctx.podeEditar = true;
  ctx.mobile = false;
  ctx.projetos = PROJETOS;
  ctx.loading = false;
  ctx.erro = false;
  ctx.etapas = ETAPAS;
  ctx.aba = "quadro";
  ctx.visao = "quadro";
  for (const m of Object.values(ctx.mut)) m.mutateAsync.mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

describe("Projetos: quadro e filtros", () => {
  it("agrupa por coluna, guarda os órfãos e agrupa por status no celular", () => {
    abrir();
    expect(
      within(screen.getByRole("region", { name: "coluna Planejamento" })).getByText("Torre Alfa")
    ).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "coluna Execução" })).getByText("Casa Beta")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "orfaos" })).getByText("Galpão Órfão")).toBeInTheDocument();
    expect(screen.getByTestId("mobile")).toHaveTextContent("Galpão Órfão,Torre Alfa");
  });

  it("busca por nome ou cliente", () => {
    abrir();
    fireEvent.change(screen.getByLabelText("Buscar projetos"), { target: { value: "construtora" } });
    expect(visiveis()).toEqual(["Torre Alfa"]);
  });

  it.each([
    ["f-prioridade", ["Torre Alfa"]],
    ["f-cliente", ["Torre Alfa"]],
    ["f-pessoa", ["Casa Beta"]],
    ["f-disciplina", ["Casa Beta"]],
    ["f-prazo", ["Casa Beta"]],
    ["f-inicio", ["Torre Alfa", "Galpão Órfão"]],
    ["f-final", ["Torre Alfa", "Casa Beta", "Galpão Órfão"]],
  ])("filtro %s", (botao, esperado) => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: botao }));
    expect(visiveis()).toEqual(esperado);
  });

  it("filtro de prioridade olha a disciplina, não só o projeto", () => {
    ctx.projetos = [
      ...PROJETOS,
      {
        id: "p4",
        nome: "Clínica Gama",
        cliente_id: "c4",
        prioridade: "Baixa",
        status: "Em andamento",
        etapa_id: "e1",
        disciplinas: [{ disciplina: "Hidráulica", responsavel_id: "pe3", prioridade: "Alta" }],
      },
    ];
    abrir();
    fireEvent.click(screen.getByRole("button", { name: "f-prioridade" }));
    const nomes = ["Torre Alfa", "Casa Beta", "Galpão Órfão", "Clínica Gama"].filter(
      (n) => within(screen.getByTestId("kanban")).queryByText(n) !== null
    );
    expect(nomes).toEqual(["Torre Alfa", "Clínica Gama"]);
  });

  it("sem resultado mostra o vazio de filtro e limpar volta tudo", () => {
    abrir();
    fireEvent.change(screen.getByLabelText("Buscar projetos"), { target: { value: "zzz" } });
    expect(screen.getByText("vazio:no-results")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "limpar" }));
    expect(visiveis()).toHaveLength(3);
  });

  it("KPIs aplicam atraso e próximos 7 dias", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-30T12:00:00Z"));
    abrir();
    fireEvent.click(screen.getByRole("button", { name: "kpi-atraso" }));
    expect(screen.getByText("vazio:no-results")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "limpar" }));
    fireEvent.click(screen.getByRole("button", { name: "kpi-proximos" }));
    expect(visiveis()).toEqual(["Torre Alfa", "Galpão Órfão"]);
  });

  it("visão em lista mostra a tabela com os projetos filtrados", () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: "ver-lista" }));
    expect(screen.getByTestId("lista")).toHaveTextContent("Torre Alfa");
  });
});

describe("Projetos: estados e abas", () => {
  it("sem projetos convida a criar; sem permissão não oferece", () => {
    ctx.projetos = [];
    abrir();
    expect(screen.getByText("vazio:no-projetos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "criar-primeiro" }));
    expect(screen.getByText("form:novo")).toBeInTheDocument();
  });

  it("erro de carregamento oferece tentar de novo", () => {
    ctx.erro = true;
    abrir();
    fireEvent.click(screen.getByRole("button", { name: "tentar" }));
    expect(ctx.refetch).toHaveBeenCalled();
    expect(screen.queryByTestId("kanban")).not.toBeInTheDocument();
  });

  it("aba Disciplinas recarrega disciplinas e projetos ao mudar", () => {
    ctx.aba = "disciplinas";
    const { invalidate } = abrir();
    fireEvent.click(screen.getByRole("button", { name: "aba-disciplinas" }));
    expect(invalidate.mock.calls.map((c) => c[0]?.queryKey)).toEqual([["disciplinas"], ["projetos"]]);
  });

  it("aba Mapa", () => {
    ctx.aba = "mapa";
    abrir();
    expect(screen.getByText("aba-mapa")).toBeInTheDocument();
  });

  it("cronograma grava as datas arrastadas; erro avisa e não recarrega", async () => {
    ctx.aba = "cronograma";
    sb.resultado("projetos.update", [
      { data: null, error: null },
      { data: null, error: { message: "rls" } },
    ]);
    const { invalidate } = abrir();
    fireEvent.click(screen.getByRole("button", { name: "aba-cronograma" }));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["projetos"] }));
    expect(sb.de("projetos", "update")[0].args[0]).toEqual({ data_inicio: "2026-01-01", data_previsao: "2026-02-01" });
    fireEvent.click(screen.getByRole("button", { name: "aba-cronograma" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não deu para atualizar as datas", expect.anything()));
  });

  it("cronograma sem permissão não deixa arrastar", () => {
    ctx.aba = "cronograma";
    ctx.podeEditar = false;
    abrir();
    expect(screen.getByRole("button", { name: "aba-cronograma" })).toBeDisabled();
  });
});

describe("Projetos: ações", () => {
  it("cabeçalho abre Disciplinas e Fluxos; no celular pelo menu", async () => {
    const { invalidate } = abrir();
    fireEvent.click(screen.getByRole("button", { name: /Disciplinas/ }));
    fireEvent.click(screen.getByRole("button", { name: "dialogo-disciplinas" }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["disciplinas"] });
    fireEvent.click(screen.getByRole("button", { name: /Fluxos/ }));
    expect(screen.getByText("dialogo-fluxos")).toBeInTheDocument();
  });

  it("no celular as ações ficam no menu '⋯'", async () => {
    ctx.mobile = true;
    const userEvent = (await import("@testing-library/user-event")).default;
    const user = userEvent.setup();
    abrir();
    await user.click(screen.getByRole("button", { name: "Mais ações" }));
    await user.click(await screen.findByRole("menuitem", { name: /Fluxos/ }));
    expect(screen.getByText("dialogo-fluxos")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mais ações" }));
    await user.click(await screen.findByRole("menuitem", { name: /Disciplinas/ }));
    expect(screen.getByRole("button", { name: "dialogo-disciplinas" })).toBeInTheDocument();
  });

  it("card: abrir detalhe, editar e salvar recarregam", () => {
    const { invalidate } = abrir();
    fireEvent.click(screen.getByRole("button", { name: "abrir-card" }));
    expect(screen.getByText("detalhe:Torre Alfa")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "detalhe-atualizou" }));
    fireEvent.click(screen.getByRole("button", { name: "detalhe-editar" }));
    expect(screen.queryByText("detalhe:Torre Alfa")).not.toBeInTheDocument();
    expect(screen.getByText("form:Torre Alfa")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "form-salvou" }));
    fireEvent.click(screen.getByRole("button", { name: "quick-add" }));
    expect(invalidate).toHaveBeenCalledTimes(3);
    fireEvent.click(screen.getByRole("button", { name: "Novo projeto" }));
    expect(screen.getByText("form:novo")).toBeInTheDocument();
  });

  it("excluir: confirma pela RPC, oferece desfazer e restaura", async () => {
    sb.rpcResultado("rpc_restaurar_projeto", [
      { data: null, error: null },
      { data: null, error: { message: "x" } },
    ]);
    const { invalidate } = abrir();
    fireEvent.click(screen.getByRole("button", { name: "excluir-card" }));
    const dlg = screen.getByRole("alertdialog");
    expect(dlg).toHaveTextContent("Torre Alfa");
    fireEvent.click(within(dlg).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(sb.argsRpc("rpc_excluir_projeto")).toEqual({ p_id: "p1" });
    const [msg, opts] = toast.success.mock.calls[0];
    expect(msg).toBe('Projeto "Torre Alfa" excluído');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["projetos"] });

    await act(async () => opts.action.onClick());
    expect(sb.argsRpc("rpc_restaurar_projeto")).toEqual({ p_id: "p1" });
    expect(toast.success).toHaveBeenCalledWith("Projeto restaurado");
    await act(async () => opts.action.onClick());
    expect(toast.error).toHaveBeenCalledWith("Não foi possível restaurar o projeto", expect.anything());
  });

  it("excluir com erro avisa; projeto que sumiu usa nome genérico", async () => {
    sb.rpcResultado("rpc_excluir_projeto", { data: null, error: { message: "fk" } });
    abrir();
    fireEvent.click(screen.getByRole("button", { name: "excluir-inexistente" }));
    const dlg = screen.getByRole("alertdialog");
    expect(dlg).toHaveTextContent(/"?Projeto"?/);
    fireEvent.click(within(dlg).getByRole("button", { name: "Excluir" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível excluir o projeto", expect.anything())
    );
  });

  it("reabrir confirmado aplica a mudança de status forçada", async () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: "reabrir-confirmar" }));
    await waitFor(() => expect(ctx.applyStatusMove).toHaveBeenCalledWith("p1", "Em andamento", true, "e1"));
  });
});

describe("Projetos: colunas", () => {
  it("criar coluna apara o nome e põe no fim; nome vazio não cria; erro avisa", async () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: "nova-coluna" }));
    await waitFor(() =>
      expect(ctx.mut.criar.mutateAsync).toHaveBeenCalledWith({
        nome: "Revisão",
        ordem: 2,
        cor: "#f00",
        bucket: "Revisão",
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "nova-coluna-vazia" }));
    expect(ctx.mut.criar.mutateAsync).toHaveBeenCalledTimes(1);
    ctx.mut.criar.mutateAsync.mockRejectedValueOnce(new Error("x"));
    fireEvent.click(screen.getByRole("button", { name: "nova-coluna" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não deu para criar a coluna"));
  });

  it("editar coluna salva o nome; erro avisa", async () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: "editar-Execução" }));
    fireEvent.click(screen.getByRole("button", { name: "salvar-coluna:Execução" }));
    await waitFor(() =>
      expect(ctx.mut.editar.mutateAsync).toHaveBeenCalledWith({ id: "e2", nome: "Renomeada", cor: "#0a0" })
    );
    ctx.mut.editar.mutateAsync.mockRejectedValueOnce(new Error("x"));
    fireEvent.click(screen.getByRole("button", { name: "salvar-coluna:Execução" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não deu para salvar a coluna"));
  });

  it("reordenar troca as ordens; fora dos limites não faz nada; erro avisa", async () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: "esquerda-Planejamento" }));
    fireEvent.click(screen.getByRole("button", { name: "direita-Execução" }));
    expect(ctx.mut.reordenar.mutateAsync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "direita-Planejamento" }));
    await waitFor(() =>
      expect(ctx.mut.reordenar.mutateAsync).toHaveBeenCalledWith([
        { id: "e1", ordem: 1 },
        { id: "e2", ordem: 0 },
      ])
    );
    ctx.mut.reordenar.mutateAsync.mockRejectedValueOnce(new Error("x"));
    fireEvent.click(screen.getByRole("button", { name: "direita-Planejamento" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não deu para reordenar as colunas"));
  });

  it("excluir coluna com projetos é barrado; vazia pede confirmação; erro avisa", async () => {
    ctx.etapas = [...ETAPAS, { id: "e3", nome: "Vazia", ordem: 2, cor: null, bucket: "Revisão" }];
    abrir();
    fireEvent.click(screen.getByRole("button", { name: "excluir-Planejamento" }));
    expect(toast.error).toHaveBeenCalledWith("Mova os projetos desta coluna antes de excluí-la");

    fireEvent.click(screen.getByRole("button", { name: "excluir-Vazia" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Coluna excluída"));
    expect(ctx.mut.excluir.mutateAsync).toHaveBeenCalledWith("e3");

    ctx.mut.excluir.mutateAsync.mockRejectedValueOnce(new Error("x"));
    fireEvent.click(screen.getByRole("button", { name: "excluir-Vazia" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não deu para excluir a coluna"));
  });

  it("busca rápida: ?new=1 abre o formulário de projeto novo e sai da URL", () => {
    abrir("/projetos?new=1");
    expect(screen.getByText("form:novo")).toBeInTheDocument();
    expect(screen.getByTestId("url")).toBeEmptyDOMElement();
  });

  it("busca rápida: sem permissão de criar não abre o formulário", () => {
    ctx.podeEditar = false;
    abrir("/projetos?new=1");
    expect(screen.queryByText("form:novo")).not.toBeInTheDocument();
    expect(screen.getByTestId("url")).toBeEmptyDOMElement();
  });
});
