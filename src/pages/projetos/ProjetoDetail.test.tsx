import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// Página do projeto: carregando, não encontrado, ações por permissão, pausar/retomar
// pelo cabeçalho (nunca troca direta), edição rápida de contrato/área/prioridade,
// banner de pausa e a confirmação de reabrir projeto concluído.

vi.mock("@/components/ui/sidebar", async (orig) => ({
  ...(await orig<typeof import("@/components/ui/sidebar")>()),
  useSidebar: () => ({ state: "expanded", isMobile: false, open: true, setOpenMobile: vi.fn() }),
}));
vi.mock("@/components/ModuleChipNav", () => ({ ModuleChipNav: () => null }));
const perms = vi.hoisted(() => ({ financeiro: true, isAdmin: true, role: "admin" }));
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    can: (f: string) => (f === "financeiro" ? perms.financeiro : true),
    isAdmin: perms.isAdmin,
    role: perms.role,
  }),
}));
vi.mock("@/components/portal/AcessoPortalDialog", () => ({
  AcessoPortalDialog: ({ open, clienteId }: { open: boolean; clienteId: string }) =>
    open ? <div role="dialog">portal:{clienteId}</div> : null,
}));
const titulo = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: titulo }));
const recentes = vi.hoisted(() => ({ registrar: vi.fn() }));
vi.mock("@/hooks/useRecentes", () => ({ useRecentes: () => recentes }));
const pausas = vi.hoisted(() => ({ aberta: null as null | { pausado_em: string; motivo: string } }));
vi.mock("./hooks/useProjetoPausas", () => ({ useProjetoPausas: () => ({ aberta: pausas.aberta }) }));
const detalhe = vi.hoisted(() => ({ valor: {} as Record<string, unknown> }));
vi.mock("./hooks/useProjetoDetail", () => ({ useProjetoDetail: () => detalhe.valor }));
vi.mock("./components/ProjetoDetailTabs", () => ({ ProjetoDetailTabs: () => <div>abas-do-projeto</div> }));
vi.mock("./components/ProjetoFormDialog", () => ({
  ProjetoFormDialog: ({ open }: { open: boolean }) => (open ? <div role="dialog">form-projeto</div> : null),
}));
vi.mock("./components/PausarProjetoDialog", () => ({
  PausarProjetoDialog: ({ open }: { open: boolean }) => (open ? <div role="dialog">pausar</div> : null),
}));
vi.mock("./components/RetomarProjetoDialog", () => ({
  RetomarProjetoDialog: ({ open }: { open: boolean }) => (open ? <div role="dialog">retomar</div> : null),
}));

Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import ProjetoDetail from "./ProjetoDetail";

const projeto = {
  id: "proj-1",
  nome: "Residência Silva",
  cliente_id: "cli-1",
  cliente_nome: "Ana",
  status: "Em Andamento",
  prioridade: "Alta",
  valor_contrato: 100000,
  area_m2: 250,
  data_inicio: "2026-01-01",
  data_previsao: "2026-12-31",
};

function base(over: Record<string, unknown> = {}) {
  return {
    projeto,
    loading: false,
    canEdit: true,
    disciplinasLegacy: [],
    dbDisciplinas: [],
    disciplinasCatalog: [],
    pessoas: [],
    getDbDisc: vi.fn(),
    deadline: { label: "No prazo", color: "bg-x", days: 30 },
    progress: 40,
    margemBrutaPct: 25.4,
    applyDiscStatusChange: vi.fn(),
    handleRemoveDisc: vi.fn(),
    handleAddDisc: vi.fn(),
    handleSaveDiscChanges: vi.fn(),
    handleAddResponsavel: vi.fn(),
    handleRemoveResponsavel: vi.fn(),
    handleQuickUpdateProjeto: vi.fn(),
    handleQuickUpdateStatus: vi.fn(),
    pendingReopenStatus: null,
    setPendingReopenStatus: vi.fn(),
    applyStatusUpdate: vi.fn(),
    clientes: [],
    currentUser: null,
    templatesData: [],
    refetchProjeto: vi.fn(),
    ...over,
  };
}

function montar() {
  return render(<ProjetoDetail />, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={["/projetos/proj-1"]}>
        <Routes>
          <Route path="/projetos/:id" element={children} />
          <Route path="/projetos" element={<div>lista-projetos</div>} />
        </Routes>
      </MemoryRouter>
    ),
  });
}

function escolher(combo: string, opcao: string) {
  fireEvent.keyDown(screen.getByRole("combobox", { name: combo }), { key: "Enter" });
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: opcao }));
}

describe("ProjetoDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    perms.financeiro = true;
    perms.isAdmin = true;
    perms.role = "admin";
    pausas.aberta = null;
    detalhe.valor = base();
  });

  it("carregando mostra o indicador e não o conteúdo", () => {
    detalhe.valor = base({ loading: true, projeto: undefined });
    montar();
    expect(screen.queryByText("abas-do-projeto")).not.toBeInTheDocument();
    expect(titulo).toHaveBeenCalledWith("Projeto");
  });

  it("não encontrado oferece voltar para a lista", () => {
    detalhe.valor = base({ projeto: null });
    montar();
    expect(screen.getByText("Projeto não encontrado ou sem acesso.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Voltar para projetos" }));
    expect(screen.getByText("lista-projetos")).toBeInTheDocument();
  });

  it("mostra KPIs, registra nos recentes e o título", () => {
    montar();
    expect(screen.getByText("abas-do-projeto")).toBeInTheDocument();
    expect(screen.getByText("25.4%")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText(/No prazo/)).toBeInTheDocument();
    expect(recentes.registrar).toHaveBeenCalledWith({
      tipo: "projeto",
      rota: "/projetos/proj-1",
      label: "Residência Silva",
    });
    expect(titulo).toHaveBeenCalledWith("Projeto · Residência Silva");
  });

  it("editar abre o formulário; pausar abre o diálogo de pausa", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /Editar/ }));
    expect(screen.getByText("form-projeto")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Pausar projeto/ }));
    expect(screen.getByText("pausar")).toBeInTheDocument();
  });

  it("status Paralisado pelo cabeçalho abre a pausa em vez de trocar direto", () => {
    const d = base();
    detalhe.valor = d;
    montar();
    escolher("Status do projeto", "Paralisado");
    expect(screen.getByText("pausar")).toBeInTheDocument();
    expect(d.handleQuickUpdateStatus).not.toHaveBeenCalled();
  });

  it("outro status pelo cabeçalho vai para a troca rápida", () => {
    const d = base();
    detalhe.valor = d;
    montar();
    escolher("Status do projeto", "Concluído");
    expect(d.handleQuickUpdateStatus).toHaveBeenCalledWith("Concluído");
  });

  it("projeto pausado mostra o banner e retomar sai pelo diálogo", () => {
    pausas.aberta = { pausado_em: "2026-10-01T12:00:00Z", motivo: "cliente sem verba" };
    const d = base({ projeto: { ...projeto, status: "Paralisado" } });
    detalhe.valor = d;
    montar();
    expect(screen.getByRole("status")).toHaveTextContent("Motivo: cliente sem verba");
    expect(screen.queryByRole("button", { name: /Pausar projeto/ })).not.toBeInTheDocument();
    escolher("Status do projeto", "Em andamento");
    expect(screen.getByText("retomar")).toBeInTheDocument();
    expect(d.handleQuickUpdateStatus).not.toHaveBeenCalled();
  });

  it("botão Retomar projeto abre o diálogo", () => {
    detalhe.valor = base({ projeto: { ...projeto, status: "Paralisado" } });
    montar();
    fireEvent.click(screen.getByRole("button", { name: /Retomar projeto/ }));
    expect(screen.getByText("retomar")).toBeInTheDocument();
  });

  it("concluído ou cancelado não oferece pausar", () => {
    detalhe.valor = base({ projeto: { ...projeto, status: "Concluído" } });
    montar();
    expect(screen.queryByRole("button", { name: /Pausar projeto/ })).not.toBeInTheDocument();
  });

  it.each([
    ["admin", true, "admin", true],
    ["coordenador", false, "coordenador", true],
    ["usuário comum", false, "user", false],
  ])("portal do cliente no cabeçalho: %s", (_nome, isAdmin, role, ve) => {
    perms.isAdmin = isAdmin;
    perms.role = role;
    montar();
    const botao = screen.queryByRole("button", { name: /Portal do cliente/ });
    if (!ve) return expect(botao).not.toBeInTheDocument();
    fireEvent.click(botao!);
    expect(screen.getByText("portal:cli-1")).toBeInTheDocument();
  });

  it("projeto sem cliente não oferece o portal", () => {
    detalhe.valor = base({ projeto: { ...projeto, cliente_id: "" } });
    montar();
    expect(screen.queryByRole("button", { name: /Portal do cliente/ })).not.toBeInTheDocument();
  });

  it("sem edição não há ações nem campos editáveis", () => {
    detalhe.valor = base({ canEdit: false, margemBrutaPct: null });
    montar();
    expect(screen.queryByRole("button", { name: /Editar|Pausar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Status do projeto" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Contrato")).not.toBeInTheDocument();
  });

  it("contrato e área editados no blur viram patch; mesmo valor não grava", () => {
    const d = base();
    detalhe.valor = d;
    montar();
    const area = screen.getByLabelText("Área");
    fireEvent.blur(area);
    expect(d.handleQuickUpdateProjeto).not.toHaveBeenCalled();
    fireEvent.change(area, { target: { value: "300,5" } });
    fireEvent.blur(area);
    expect(d.handleQuickUpdateProjeto).toHaveBeenCalledWith({ area_m2: 300.5 });
    const contrato = screen.getByLabelText("Contrato");
    fireEvent.change(contrato, { target: { value: "150.000,00" } });
    fireEvent.blur(contrato);
    expect(d.handleQuickUpdateProjeto).toHaveBeenCalledWith({ valor_contrato: 150000 });
  });

  it("sem financeiro o contrato não é editável (evita zerar o valor mascarado)", () => {
    perms.financeiro = false;
    montar();
    expect(screen.queryByLabelText("Contrato")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Área")).toBeInTheDocument();
  });

  it("prioridade pelo cabeçalho vai para o patch", () => {
    const d = base();
    detalhe.valor = d;
    montar();
    escolher("Prioridade do projeto", "Baixa");
    expect(d.handleQuickUpdateProjeto).toHaveBeenCalledWith({ prioridade: "Baixa" });
  });

  it("confirmar reabertura aplica o status zerando a data final", () => {
    const d = base({ pendingReopenStatus: "Em Andamento" });
    detalhe.valor = d;
    montar();
    expect(screen.getByText("Reabrir projeto")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reabrir" }));
    expect(d.applyStatusUpdate).toHaveBeenCalledWith("Em Andamento", true);
    expect(d.setPendingReopenStatus).toHaveBeenCalledWith(null);
  });
});
