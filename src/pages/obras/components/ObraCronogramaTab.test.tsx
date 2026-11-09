import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ObraFrenteRow } from "@/pages/obras/hooks/useObraFrentes";
import type { ObraTarefa } from "@/pages/obras/hooks/useObraTarefas";
import { ObraCronogramaTab } from "./ObraCronogramaTab";

/**
 * Cronograma da obra em quatro níveis (spec 111): a lista monta a cascata
 * fase > etapa > serviço > tarefa sem modal, o checklist grava a tarefa e a data
 * salva aparece no campo (regressão do modal que mostrava o snapshot antigo).
 */

let nos: ObraFrenteRow[] = [];
let tarefas: ObraTarefa[] = [];

// vi.mock sobe pro topo do arquivo; espiões e helper precisam subir junto.
const { criarNo, atualizarNo, atualizarTarefa, criarTarefa, mutacao } = vi.hoisted(() => ({
  criarNo: vi.fn(async (..._a: unknown[]) => ({})),
  atualizarNo: vi.fn(async (..._a: unknown[]) => {}),
  atualizarTarefa: vi.fn(async (..._a: unknown[]) => {}),
  criarTarefa: vi.fn(async (..._a: unknown[]) => ({})),
  mutacao: (fn: (...a: unknown[]) => Promise<unknown>) => () => ({ mutate: fn, mutateAsync: fn, isPending: false }),
}));

vi.mock("@/pages/obras/hooks/useObraFrentes", () => ({
  useObraFrentes: () => ({ data: nos, isLoading: false }),
  useCreateFrente: mutacao(criarNo),
  useUpdateFrente: mutacao(atualizarNo),
  useDeleteFrente: mutacao(async () => {}),
}));

vi.mock("@/pages/obras/hooks/useObraTarefas", () => ({
  useObraTarefas: () => ({ data: tarefas }),
  useCreateObraTarefa: mutacao(criarTarefa),
  useUpdateObraTarefa: mutacao(atualizarTarefa),
  useDeleteObraTarefa: mutacao(async () => {}),
}));

vi.mock("@/pages/meu-trabalho/hooks", () => ({
  usePessoasEmpresa: () => ({ data: [] }),
  useTarefaMutations: () => ({ atualizar: { mutateAsync: async () => {} } }),
}));

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

function no(id: string, nivel: string, parent_id: string | null, campos: Partial<ObraFrenteRow> = {}): ObraFrenteRow {
  return {
    id,
    empresa_id: "e1",
    obra_id: "o1",
    nome: id,
    nivel,
    parent_id,
    ordem: 0,
    data_inicio: null,
    data_fim: null,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    ...campos,
  } as ObraFrenteRow;
}

function tarefa(id: string, servico: string, campos: Partial<ObraTarefa> = {}): ObraTarefa {
  return {
    id,
    titulo: id,
    obra_frente_id: servico,
    obra_id: "o1",
    status: "a_fazer",
    data_inicio: null,
    prazo: null,
    labels: [],
    sensivel_clima: null,
    created_at: "2026-10-02T00:00:00Z",
    responsavel: null,
    responsaveis: [],
    ...campos,
  } as ObraTarefa;
}

const tela = () => (
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter>
      <ObraCronogramaTab obraId="o1" projetoId={null} canEdit />
    </MemoryRouter>
  </QueryClientProvider>
);
const renderTab = () => render(tela());

// jsdom deste setup não traz localStorage; um Map basta para a preferência de visão.
function storageEmMemoria(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("localStorage", storageEmMemoria());
  nos = [];
  tarefas = [];
});

describe("ObraCronogramaTab · lista", () => {
  it("obra vazia: cria a primeira fase pela lista", async () => {
    renderTab();
    await userEvent.click(screen.getByRole("button", { name: "Criar primeira fase" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Nova fase" }), "Estrutura{Enter}");
    expect(criarNo).toHaveBeenCalledWith(
      expect.objectContaining({ nome: "Estrutura", nivel: "fase", parent_id: null })
    );
  });

  it("mostra a cascata e cria o filho certo em cada nível", async () => {
    nos = [no("Estrutura", "fase", null), no("Fundação", "etapa", "Estrutura"), no("Sapatas", "servico", "Fundação")];
    tarefas = [tarefa("Concretar S1", "Sapatas")];
    renderTab();

    for (const nome of ["Estrutura", "Fundação", "Sapatas", "Concretar S1"]) {
      expect(screen.getByRole("button", { name: nome })).toBeInTheDocument();
    }

    await userEvent.click(screen.getByRole("button", { name: "Novo serviço" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Novo serviço" }), "Vigas baldrame{Enter}");
    expect(criarNo).toHaveBeenCalledWith(
      expect.objectContaining({ nome: "Vigas baldrame", nivel: "servico", parent_id: "Fundação" })
    );

    await userEvent.click(screen.getByRole("button", { name: "Nova tarefa" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Nova tarefa" }), "Concretar S2{Enter}");
    expect(criarTarefa).toHaveBeenCalledWith(
      expect.objectContaining({ titulo: "Concretar S2", obra_frente_id: "Sapatas" })
    );
  });

  it("checklist: marcar a tarefa grava concluída", async () => {
    nos = [no("Estrutura", "fase", null), no("Fundação", "etapa", "Estrutura"), no("Sapatas", "servico", "Fundação")];
    tarefas = [tarefa("Concretar S1", "Sapatas")];
    renderTab();

    await userEvent.click(screen.getByRole("checkbox", { name: "Concluir Concretar S1" }));
    expect(atualizarTarefa).toHaveBeenCalledWith({ id: "Concretar S1", status: "concluida" });
  });

  it("avanço sobe para a fase: 1 de 2 tarefas concluídas = 50%", () => {
    nos = [no("Estrutura", "fase", null), no("Fundação", "etapa", "Estrutura"), no("Sapatas", "servico", "Fundação")];
    tarefas = [tarefa("t1", "Sapatas", { status: "concluida" }), tarefa("t2", "Sapatas")];
    renderTab();
    expect(within(screen.getByTestId("no-Estrutura")).getByText("50% · 1/2")).toBeInTheDocument();
  });

  it("data salva aparece no campo depois do refetch", () => {
    nos = [no("Estrutura", "fase", null), no("Fundação", "etapa", "Estrutura")];
    const { rerender } = renderTab();
    expect(within(screen.getByTestId("no-Fundação")).queryByText("20/10/2026")).toBeNull();

    nos = [no("Estrutura", "fase", null), no("Fundação", "etapa", "Estrutura", { data_inicio: "2026-10-20" })];
    rerender(tela());
    expect(within(screen.getByTestId("no-Fundação")).getByText("20/10/2026")).toBeInTheDocument();
  });

  it("recolher a etapa esconde serviços e tarefas", async () => {
    nos = [no("Estrutura", "fase", null), no("Fundação", "etapa", "Estrutura"), no("Sapatas", "servico", "Fundação")];
    renderTab();
    await userEvent.click(screen.getByRole("button", { name: "Recolher Fundação" }));
    expect(screen.queryByRole("button", { name: "Sapatas" })).toBeNull();
  });

  it("a escolha Lista/Gantt fica salva", async () => {
    nos = [no("Estrutura", "fase", null)];
    renderTab();
    await userEvent.click(screen.getByRole("button", { name: /Gantt/ }));
    expect(localStorage.getItem("pilar:obra-cronograma-visao")).toBe("gantt");
    expect(screen.getByText("Sem datas para a linha do tempo")).toBeInTheDocument();
  });
});
