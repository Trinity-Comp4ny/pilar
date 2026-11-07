import { useEffect, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fake, rpcComEmpresa } from "@/pages/obras/testing/supabaseFake";

// Detalhe do projeto: carga (com cliente à parte), redirecionamento quando some, catálogos
// só para quem edita, mutações de disciplina/responsável (e suas guardas), edição rápida
// com a trava de previsão e a confirmação de reabrir projeto concluído.

const auth = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("@/integrations/supabase/client", async () => {
  const { fake: f } = await import("@/pages/obras/testing/supabaseFake");
  return { supabase: { ...f.supabase, auth } };
});
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const acesso = vi.hoisted(() => ({ canEdit: true, financeiro: true }));
vi.mock("@/hooks/useFeatureAccess", () => ({ useFeatureAccess: () => ({ canEdit: acesso.canEdit }) }));
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ ready: true, can: (f: string) => (f === "financeiro" ? acesso.financeiro : true) }),
}));
const rent = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("./useRentabilidade", () => ({
  useProjetoRentabilidade: (...a: unknown[]) => rent.fn(...a),
}));
vi.mock("@/hooks/useTemplates", () => ({ useTemplates: () => ({ data: [{ id: "tpl-1" }] }) }));
const disc = vi.hoisted(() => ({
  lista: [] as unknown[],
  upsert: vi.fn(),
  remover: vi.fn(),
  status: vi.fn(),
}));
vi.mock("@/hooks/useProjetoDisciplinas", () => ({
  useProjetoDisciplinas: () => ({ data: disc.lista }),
  useUpsertDisciplina: () => ({ mutateAsync: disc.upsert }),
  useDeleteDisciplina: () => ({ mutateAsync: disc.remover }),
  useUpdateDisciplinaStatus: () => ({ mutateAsync: disc.status }),
}));
const monitor = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@/lib/monitoring", () => ({ monitoring: monitor }));

import { useProjetoDetail } from "./useProjetoDetail";

const projetoDb = {
  id: "proj-1",
  codigo_projeto: "P-001",
  nome: "Residência",
  cliente_id: "cli-1",
  localizacao: "",
  parcelas: null,
  area_m2: 250,
  data_inicio: "2026-01-01",
  data_previsao: "2026-12-31",
  data_final: null,
  status: "Em Andamento",
  prioridade: null,
  valor_contrato: 100000,
  observacao: null,
};

const disciplinas = [
  {
    id: "d-1",
    nome: "Estrutural",
    status: "Em Andamento",
    data_inicio: "2026-02-01",
    data_fim: "2026-06-30",
    data_fim_real: null,
    prioridade: "alta",
    justificativa_atraso: null,
    horas_estimadas: 100,
    custo_hora: 80,
    responsaveis: [
      { id: "pes-1", nome: "Ana" },
      { id: "pes-2", nome: "Bruno" },
    ],
  },
  {
    id: "d-2",
    nome: "Elétrica",
    status: "Concluído",
    data_inicio: "2026-02-01",
    data_fim: "2026-05-30",
    data_fim_real: "2026-05-20",
    responsaveis: [{ id: "pes-1", nome: "Ana" }],
  },
];

const rota = { atual: "" };
function Espiao() {
  const { pathname } = useLocation();
  useEffect(() => {
    rota.atual = pathname;
  }, [pathname]);
  return null;
}

function montar(id: string | undefined = "proj-1") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidar = vi.spyOn(qc, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/projetos/proj-1"]}>
        <Routes>
          <Route path="*" element={<>{children}<Espiao /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return { invalidar, ...renderHook(() => useProjetoDetail(id), { wrapper }) };
}

function comProjeto(p: Record<string, unknown> | null = projetoDb, extra: Record<string, unknown> = {}) {
  const tabelas: Record<string, unknown> = {
    disciplinas: [{ id: "cat-1", nome: "Estrutural", empresa_id: null }],
    pessoas: [
      { id: "pes-1", nome: "Ana" },
      { id: "pes-3", nome: "Carla" },
    ],
    ...extra,
  };
  fake.responder((c) => {
    if (c.tabela === "projetos_safe") return { data: p, error: p ? null : { message: "not found" } };
    if (c.tabela === "clientes" && c.final === "maybeSingle") {
      return { data: { nome: "Cliente SA", email: "c@x.com" }, error: null };
    }
    if (c.tabela === "clientes") return { data: [{ id: "cli-1", nome: "Cliente SA" }], error: null };
    if (c.op === "select" && c.tabela in tabelas) return { data: tabelas[c.tabela], error: null };
    return undefined;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  fake.reset();
  rpcComEmpresa();
  acesso.canEdit = true;
  acesso.financeiro = true;
  disc.lista = disciplinas;
  disc.upsert.mockResolvedValue(undefined);
  disc.remover.mockResolvedValue(undefined);
  disc.status.mockResolvedValue(undefined);
  rent.fn.mockReturnValue({ data: { margem_bruta_pct: 32.5 }, isLoading: false });
  auth.getUser.mockResolvedValue({ data: { user: { email: "dev@local.test", user_metadata: {} } } });
  rota.atual = "";
});

describe("useProjetoDetail: carga", () => {
  it("monta o projeto com o cliente e os catálogos de quem edita", async () => {
    comProjeto();
    const { result } = montar();
    await waitFor(() => expect(result.current.projeto).toBeTruthy());
    expect(result.current.projeto).toMatchObject({
      nome: "Residência",
      cliente_nome: "Cliente SA",
      cliente_email: "c@x.com",
      prioridade: "Media",
      localizacao: undefined,
      area_m2: 250,
    });
    await waitFor(() => expect(result.current.currentUser).toEqual({ name: "dev", email: "dev@local.test" }));
    expect(result.current.pessoas).toHaveLength(2);
    expect(result.current.clientes).toHaveLength(1);
    expect(result.current.disciplinasCatalog).toHaveLength(1);
    expect(result.current.margemBrutaPct).toBe(32.5);
    expect(result.current.disciplinasLegacy).toHaveLength(2);
    expect(result.current.getDbDisc(1)?.id).toBe("d-2");
    expect(result.current.templatesData).toEqual([{ id: "tpl-1" }]);
    expect(rent.fn).toHaveBeenCalledWith("proj-1", true);
  });

  it("sem cliente não consulta clientes; nome do usuário vem do metadado", async () => {
    comProjeto({ ...projetoDb, cliente_id: null });
    auth.getUser.mockResolvedValue({
      data: { user: { email: "x@y.z", user_metadata: { full_name: "Matheus R" } } },
    });
    const { result } = montar();
    await waitFor(() => expect(result.current.projeto).toBeTruthy());
    expect(result.current.projeto?.cliente_nome).toBeUndefined();
    await waitFor(() => expect(result.current.currentUser?.name).toBe("Matheus R"));
  });

  it("projeto que não existe (ou RLS) volta para a lista", async () => {
    comProjeto(null);
    const { result } = montar();
    await waitFor(() => expect(rota.atual).toBe("/projetos"));
    expect(result.current.projeto).toBeNull();
  });

  it("quem só visualiza não carrega catálogos, e sem financeiro não pede rentabilidade", async () => {
    acesso.canEdit = false;
    acesso.financeiro = false;
    rent.fn.mockReturnValue({ data: undefined, isLoading: false });
    comProjeto();
    const { result } = montar();
    await waitFor(() => expect(result.current.projeto).toBeTruthy());
    expect(auth.getUser).not.toHaveBeenCalled();
    expect(result.current.pessoas).toEqual([]);
    expect(result.current.margemBrutaPct).toBeNull();
    expect(rent.fn).toHaveBeenCalledWith("proj-1", false);
  });

  it("sem id não busca nada", () => {
    const { result } = montar("");
    expect(result.current.projeto).toBeUndefined();
    expect(result.current.loading).toBe(false);
    expect(result.current.deadline).toBeNull();
    expect(fake.chamadas.filter((c) => c.tabela === "projetos_safe")).toHaveLength(0);
  });
});

describe("useProjetoDetail: disciplinas", () => {
  async function pronto() {
    comProjeto();
    const r = montar();
    await waitFor(() => expect(r.result.current.projeto).toBeTruthy());
    await waitFor(() => expect(r.result.current.pessoas).toHaveLength(2));
    return r;
  }

  it("concluir sem data grava hoje; com data já gravada não sobrescreve; override vence", async () => {
    const { result } = await pronto();
    const hoje = new Date().toISOString().split("T")[0];
    await act(async () => {
      await result.current.applyDiscStatusChange(0, "Concluído");
      await result.current.applyDiscStatusChange(1, "Concluído");
      await result.current.applyDiscStatusChange(0, "Concluído", "atraso do cliente", "2026-03-01");
      await result.current.applyDiscStatusChange(0, "Em Andamento");
    });
    expect(disc.status.mock.calls.map((c) => c[0].data_fim_real)).toEqual([hoje, undefined, "2026-03-01", undefined]);
    expect(disc.status.mock.calls[2][0].justificativa_atraso).toBe("atraso do cliente");
    expect(toast.success).toHaveBeenCalledWith("Estrutural: Concluído");
  });

  it("erro ao mudar status reporta ao monitoramento", async () => {
    const { result } = await pronto();
    disc.status.mockRejectedValue(new Error("RLS"));
    await act(async () => {
      await result.current.applyDiscStatusChange(0, "Pausada");
      await result.current.applyDiscStatusChange(9, "Pausada");
    });
    expect(monitor.captureException).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith("Erro ao atualizar");
  });

  it("remover disciplina: sucesso, índice inválido e erro", async () => {
    const { result } = await pronto();
    await act(async () => {
      await result.current.handleRemoveDisc(0);
      await result.current.handleRemoveDisc(5);
    });
    expect(disc.remover).toHaveBeenCalledTimes(1);
    expect(disc.remover).toHaveBeenCalledWith({ id: "d-1", projetoId: "proj-1" });
    disc.remover.mockRejectedValue({ message: "tem tarefas" });
    await act(async () => {
      await result.current.handleRemoveDisc(0);
    });
    expect(toast.error).toHaveBeenCalledWith("Erro ao remover", { description: "tem tarefas" });
  });

  it("adicionar disciplina exige nome e responsável", async () => {
    const { result } = await pronto();
    await act(async () => {
      await result.current.handleAddDisc({ disciplina: "", responsavel_id: "pes-1" });
      await result.current.handleAddDisc({ disciplina: "Hidráulica", responsavel_id: "" });
      await result.current.handleAddDisc({ disciplina: "Hidráulica", responsavel_id: "pes-1" });
    });
    expect(disc.upsert).toHaveBeenCalledTimes(1);
    expect(disc.upsert).toHaveBeenCalledWith({
      projeto_id: "proj-1",
      nome: "Hidráulica",
      status: "Não Iniciado",
      responsavel_ids: ["pes-1"],
    });
    disc.upsert.mockRejectedValue(new Error("duplicada"));
    await act(async () => {
      await result.current.handleAddDisc({ disciplina: "X", responsavel_id: "pes-1" });
    });
    expect(toast.error).toHaveBeenCalledWith("Erro ao adicionar disciplina", { description: "duplicada" });
  });

  it("salvar disciplina editada manda os responsáveis por id", async () => {
    const { result } = await pronto();
    await act(async () => {
      await result.current.handleSaveDiscChanges(disciplinas[0] as never);
    });
    expect(disc.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: "d-1", responsavel_ids: ["pes-1", "pes-2"] }));
    disc.upsert.mockRejectedValue(new Error("x"));
    await act(async () => {
      await result.current.handleSaveDiscChanges({ ...disciplinas[0], responsaveis: undefined } as never);
    });
    expect(toast.error).toHaveBeenCalledWith("Erro ao salvar", { description: "x" });
  });

  it("adicionar responsável: duplicado é recusado; novo entra no fim", async () => {
    const { result } = await pronto();
    await act(async () => {
      await result.current.handleAddResponsavel(0, "pes-1");
    });
    expect(toast.error).toHaveBeenCalledWith("Responsável já adicionado nesta disciplina");
    await act(async () => {
      await result.current.handleAddResponsavel(0, "pes-3");
      await result.current.handleAddResponsavel(0, "");
      await result.current.handleAddResponsavel(7, "pes-3");
    });
    expect(disc.upsert).toHaveBeenCalledTimes(1);
    expect(disc.upsert.mock.calls[0][0].responsavel_ids).toEqual(["pes-1", "pes-2", "pes-3"]);
    expect(toast.success).toHaveBeenCalledWith("Carla adicionado(a) a Estrutural");
    disc.upsert.mockRejectedValue(new Error("x"));
    await act(async () => {
      await result.current.handleAddResponsavel(1, "pes-3");
    });
    expect(toast.error).toHaveBeenCalledWith("Erro ao adicionar responsável");
  });

  it("remover responsável: último não sai; outro sai", async () => {
    const { result } = await pronto();
    await act(async () => {
      await result.current.handleRemoveResponsavel(1, 0);
    });
    expect(toast.error).toHaveBeenCalledWith("A disciplina precisa ter ao menos um responsável");
    await act(async () => {
      await result.current.handleRemoveResponsavel(0, 1);
      await result.current.handleRemoveResponsavel(9, 0);
    });
    expect(disc.upsert).toHaveBeenCalledTimes(1);
    expect(disc.upsert.mock.calls[0][0].responsavel_ids).toEqual(["pes-1"]);
    disc.upsert.mockRejectedValue(new Error("x"));
    await act(async () => {
      await result.current.handleRemoveResponsavel(0, 0);
    });
    expect(toast.error).toHaveBeenCalledWith("Erro ao remover responsável");
  });
});

describe("useProjetoDetail: edição rápida e status", () => {
  async function pronto(status = "Em Andamento") {
    comProjeto({ ...projetoDb, status });
    const r = montar();
    await waitFor(() => expect(r.result.current.projeto).toBeTruthy());
    return r;
  }

  it("previsão antes de uma disciplina agendada é recusada sem gravar", async () => {
    const { result } = await pronto();
    await act(async () => {
      await result.current.handleQuickUpdateProjeto({ data_previsao: "2026-06-01" });
    });
    expect(toast.error).toHaveBeenCalledWith("Data inválida", {
      description: 'A disciplina "Estrutural" tem data além dessa previsão',
    });
    expect(fake.escritas("projetos")).toHaveLength(0);
  });

  it("patch válido grava, avisa e invalida as listas", async () => {
    const { result, invalidar } = await pronto();
    await act(async () => {
      await result.current.handleQuickUpdateProjeto({ data_previsao: "2027-01-31", valor_contrato: 120000 });
    });
    expect(fake.escritas("projetos")[0].payload).toEqual({ data_previsao: "2027-01-31", valor_contrato: 120000 });
    expect(toast.success).toHaveBeenCalledWith("Projeto atualizado");
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["projetos"] });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["projeto-timeline", "proj-1"] });
  });

  it("erro ao gravar o patch mostra a mensagem do banco", async () => {
    const { result } = await pronto();
    fake.responder((c) => (c.op === "update" ? { data: null, error: { message: "sem permissão" } } : undefined));
    await act(async () => {
      await result.current.handleQuickUpdateProjeto({ area_m2: 300 });
    });
    expect(toast.error).toHaveBeenCalledWith("Erro ao salvar", { description: "sem permissão" });
  });

  it("mudar status de projeto em andamento grava direto", async () => {
    const { result } = await pronto();
    act(() => result.current.handleQuickUpdateStatus("Pausado"));
    await waitFor(() => expect(fake.escritas("projetos")).toHaveLength(1));
    expect(fake.escritas("projetos")[0].payload).toEqual({ status: "Pausado" });
    expect(result.current.pendingReopenStatus).toBeNull();
  });

  it("reabrir projeto concluído pede confirmação e só então zera a data final", async () => {
    const { result } = await pronto("Concluído");
    act(() => result.current.handleQuickUpdateStatus("Em Andamento"));
    expect(result.current.pendingReopenStatus).toBe("Em Andamento");
    expect(fake.escritas("projetos")).toHaveLength(0);
    await act(async () => {
      await result.current.applyStatusUpdate("Em Andamento", true);
    });
    expect(fake.escritas("projetos")[0].payload).toEqual({ status: "Em Andamento", data_final: null });
  });

  it("erro ao mudar status avisa", async () => {
    const { result } = await pronto();
    fake.responder((c) => (c.op === "update" ? { data: null, error: { message: "trigger recusou" } } : undefined));
    await act(async () => {
      await result.current.applyStatusUpdate("Inexistente", false);
    });
    expect(toast.error).toHaveBeenCalledWith("Erro ao mudar status", { description: "trigger recusou" });
  });

  it("status desconhecido aparece cru no toast", async () => {
    const { result } = await pronto();
    await act(async () => {
      await result.current.applyStatusUpdate("Status Novo", false);
    });
    expect(toast.success).toHaveBeenCalledWith("Status: Status Novo");
  });
});
