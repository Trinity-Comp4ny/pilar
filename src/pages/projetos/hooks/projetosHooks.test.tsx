import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fake, rpcComEmpresa } from "@/pages/obras/testing/supabaseFake";

// Hooks de dados da página Projetos contra o Supabase falso: montagem da lista (projetos,
// clientes, disciplinas e responsáveis), rentabilidade, filtros na URL, checklist,
// revisões, etapas, atividades, reordenação otimista e erros do servidor.

const auth = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("@/integrations/supabase/client", async () => {
  const { fake: f } = await import("@/pages/obras/testing/supabaseFake");
  return { supabase: { ...f.supabase, auth } };
});
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const perms = vi.hoisted(() => ({ financeiro: true }));
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ ready: true, can: (f: string) => (f === "financeiro" ? perms.financeiro : true) }),
}));
vi.mock("@/hooks/useTemplates", () => ({ useTemplates: () => ({ data: [] }) }));
vi.mock("@/hooks/useFluxosDisciplinas", () => ({ useFluxosDisciplinas: () => ({ data: [{ id: "fx-1" }] }) }));
const perfil = vi.hoisted(() => ({ profile: { empresa_id: "emp-1" } as { empresa_id: string } | null }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ profile: perfil.profile }) }));

import { useProjetosData } from "./useProjetosData";
import {
  useDashboardRentabilidade,
  useProjetoRentabilidade,
  useProjetosDrenandoCaixa,
  useRentabilidadePorCliente,
} from "./useRentabilidade";
import { filtersToParams, parseFiltersFromParams, useProjetosUrlState } from "./useProjetosUrlState";
import { useDisciplinaChecklist, useProjetoDisciplinaChecklistCounts } from "./useProjetoDisciplinaChecklist";
import { revisaoAberta, useDisciplinaRevisoes, useProjetoDisciplinaRevisoesCounts } from "./useDisciplinaRevisoes";
import { corDaEtapaProjeto, useProjetoEtapaMutations, useProjetoEtapas } from "./useProjetoEtapas";
import { useProjetoAtividades } from "./useProjetoAtividades";
import { useReordenarProjetos } from "./useReordenarProjetos";
import { usePessoasSemConta } from "./usePessoasSemConta";
import { useProjetoTimeline } from "./useProjetoTimeline";

function montar(url = "/projetos") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidar = vi.spyOn(qc, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return { qc, invalidar, wrapper };
}
function hook<T>(fn: () => T, url?: string) {
  const m = montar(url);
  return { ...m, ...renderHook(fn, { wrapper: m.wrapper }) };
}
const erro = (message: string) => ({ message });

beforeEach(() => {
  vi.clearAllMocks();
  fake.reset();
  rpcComEmpresa();
  perms.financeiro = true;
  perfil.profile = { empresa_id: "emp-1" };
  auth.getUser.mockResolvedValue({ data: { user: { email: "dev@local.test", user_metadata: {} } } });
});

const linhaRent = (id: string, receitas: number, despesas: number, mo = 0) => ({
  projeto_id: id,
  projeto_nome: `P ${id}`,
  codigo_projeto: id,
  status: "Em Andamento",
  valor_contrato: "1000",
  receitas_total: String(receitas),
  receitas_recebidas: null,
  despesas_diretas: despesas,
  custo_mao_de_obra: mo,
  horas_orcadas: 10,
  horas_consumidas: 5,
});

describe("useProjetosData", () => {
  it("monta projetos com cliente, disciplinas, responsáveis e margem", async () => {
    rpcComEmpresa({ rpc_dashboard_rentabilidade: { data: [linhaRent("p-1", 1000, 400)], error: null } });
    fake.responder((c) => {
      if (c.tabela === "projetos_safe")
        return {
          data: [
            { id: "p-1", nome: "Casa", cliente_id: "c-1", status: "Em Andamento", prioridade: null, etapa_id: null },
            { id: "p-2", nome: "Galpão", cliente_id: null, status: "Concluído", prioridade: "Alta", ordem_prioridade: 2 },
          ],
          error: null,
        };
      if (c.tabela === "clientes" && c.filtros.some((f) => f[0] === "in"))
        return { data: [{ id: "c-1", nome: "Ana", email: "a@x" }], error: null };
      if (c.tabela === "projeto_disciplinas")
        return {
          data: [
            {
              id: "d-1",
              projeto_id: "p-1",
              nome: "Estrutural",
              status: "Em Andamento",
              projeto_disciplina_responsaveis: [{ pessoa_id: "pes-1", pessoas: { id: "pes-1", nome: "Bia" } }],
            },
            { id: "d-2", projeto_id: "p-1", nome: "Elétrica", status: "Não Iniciado", projeto_disciplina_responsaveis: null },
          ],
          error: null,
        };
      if (c.tabela === "clientes") return { data: [{ id: "c-1", nome: "Ana" }], error: null };
      if (c.tabela === "pessoas") return { data: [{ id: "pes-1", nome: "Bia" }], error: null };
      if (c.tabela === "disciplinas") return { data: [{ id: "x", nome: "Estrutural" }], error: null };
      return undefined;
    });
    const { result } = hook(() => useProjetosData());
    await waitFor(() => expect(result.current.projetos).toHaveLength(2));
    const [casa, galpao] = result.current.projetos;
    expect(casa).toMatchObject({ cliente_nome: "Ana", cliente_email: "a@x", prioridade: "Media" });
    expect(casa.disciplinas.map((d) => [d.disciplina, d.responsavel_nome])).toEqual([
      ["Estrutural", "Bia"],
      ["Elétrica", ""],
    ]);
    expect(galpao).toMatchObject({ cliente_nome: undefined, prioridade: "Alta", ordem_prioridade: 2, disciplinas: [] });
    await waitFor(() => expect(result.current.rentabilidadeMap).toEqual({ "p-1": 60 }));
    await waitFor(() => expect(result.current.currentUser).toEqual({ name: "dev", email: "dev@local.test" }));
    expect(result.current.clientes).toHaveLength(1);
    expect(result.current.pessoas).toHaveLength(1);
    expect(result.current.disciplinas).toHaveLength(1);
    expect(result.current.fluxosData).toEqual([{ id: "fx-1" }]);
  });

  it("lista vazia não consulta clientes nem disciplinas; sem financeiro não chama a rentabilidade", async () => {
    perms.financeiro = false;
    auth.getUser.mockResolvedValue({ data: { user: null } });
    const { result } = hook(() => useProjetosData());
    await waitFor(() => expect(result.current.loadingProjetos).toBe(false));
    expect(result.current.projetos).toEqual([]);
    expect(fake.chamadas.some((c) => c.tabela === "projeto_disciplinas")).toBe(false);
    expect(fake.rpc).not.toHaveBeenCalledWith("rpc_dashboard_rentabilidade");
    expect(result.current.rentabilidadeMap).toEqual({});
    expect(result.current.currentUser).toBeNull();
  });

  it("erro na view de projetos sinaliza erro; erros nos catálogos deixam listas vazias", async () => {
    fake.responder(() => ({ data: null, error: erro("RLS") }));
    const { result } = hook(() => useProjetosData());
    await waitFor(() => expect(result.current.projetosError).toBe(true));
    expect(result.current.clientes).toEqual([]);
    expect(result.current.pessoas).toEqual([]);
  });
});

describe("rentabilidade", () => {
  it("dashboard calcula margens, métricas e rankings", async () => {
    rpcComEmpresa({
      rpc_dashboard_rentabilidade: {
        data: [linhaRent("a", 1000, 200, 100), linhaRent("b", 0, 50), linhaRent("c", 500, 600)],
        error: null,
      },
    });
    const { result } = hook(() => useDashboardRentabilidade());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const d = result.current.data!;
    expect(d.projetos[0]).toMatchObject({ margem_bruta: 700, margem_bruta_pct: 70, margem_liquida: 670 });
    expect(d.projetos[1].margem_bruta_pct).toBe(0);
    expect(d.metricas).toMatchObject({
      totalReceitas: 1500,
      totalDespesas: 850,
      totalMaoDeObra: 100,
      projetosComReceita: 2,
      totalProjetos: 3,
      utilizacaoHoras: 50,
    });
    expect(d.topRentaveis.map((p) => p.projeto_id)).toEqual(["a", "c"]);
    expect(d.menosRentaveis.map((p) => p.projeto_id)).toEqual(["c", "a"]);
  });

  it("dashboard sem dados e com erro", async () => {
    rpcComEmpresa({ rpc_dashboard_rentabilidade: { data: null, error: null } });
    const a = hook(() => useDashboardRentabilidade());
    await waitFor(() => expect(a.result.current.isSuccess).toBe(true));
    expect(a.result.current.data!.metricas).toMatchObject({ margemMediaPct: 0, utilizacaoHoras: 0 });

    rpcComEmpresa({ rpc_dashboard_rentabilidade: { data: null, error: erro("can_view_financeiro") } });
    const b = hook(() => useDashboardRentabilidade());
    await waitFor(() => expect(b.result.current.isError).toBe(true));
  });

  it("por cliente agrupa projetos e calcula concentração", async () => {
    rpcComEmpresa({
      rpc_dashboard_rentabilidade: {
        data: [linhaRent("a", 600, 100), linhaRent("b", 400, 100, 100), linhaRent("c", 0, 0), linhaRent("d", 0, 0)],
        error: null,
      },
    });
    fake.responder((c) =>
      c.tabela === "projetos"
        ? {
            data: [
              { id: "a", cliente_id: "c-1", clientes: { nome: "Ana" } },
              { id: "b", cliente_id: "c-1", clientes: null },
              { id: "c", cliente_id: "c-2", clientes: { nome: "Bia" } },
              { id: "d", cliente_id: null, clientes: null },
              { id: "zz", cliente_id: "c-3", clientes: { nome: "X" } },
            ],
            error: null,
          }
        : undefined
    );
    const { result } = hook(() => useRentabilidadePorCliente());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.totalReceitas).toBe(1000);
    expect(result.current.data!.clientes).toEqual([
      expect.objectContaining({ cliente_id: "c-1", cliente_nome: "Ana", margem_bruta: 700, num_projetos: 2, concentracao_pct: 100 }),
      expect.objectContaining({ cliente_id: "c-2", margem_bruta_pct: 0, num_projetos: 1 }),
    ]);
  });

  it("por cliente sem projetos e com erro", async () => {
    rpcComEmpresa({ rpc_dashboard_rentabilidade: { data: [], error: null } });
    const a = hook(() => useRentabilidadePorCliente());
    await waitFor(() => expect(a.result.current.data).toEqual({ clientes: [], totalReceitas: 0 }));

    rpcComEmpresa({ rpc_dashboard_rentabilidade: { data: null, error: erro("x") } });
    const b = hook(() => useRentabilidadePorCliente());
    await waitFor(() => expect(b.result.current.isError).toBe(true));
  });

  it("drenando caixa: só margem negativa, pior primeiro", async () => {
    rpcComEmpresa({
      rpc_dashboard_rentabilidade: {
        data: [linhaRent("a", 100, 300), linhaRent("b", 100, 50), linhaRent("c", 100, 150)],
        error: null,
      },
    });
    const { result } = hook(() => useProjetosDrenandoCaixa());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.map((p) => p.projeto_id)).toEqual(["a", "c"]);

    rpcComEmpresa({ rpc_dashboard_rentabilidade: { data: null, error: erro("x") } });
    const b = hook(() => useProjetosDrenandoCaixa());
    await waitFor(() => expect(b.result.current.isError).toBe(true));
  });

  it("do projeto: dados, sem dados, erro e desabilitado", async () => {
    rpcComEmpresa({ rpc_projeto_rentabilidade: { data: linhaRent("p", 200, 50), error: null } });
    const a = hook(() => useProjetoRentabilidade("p"));
    await waitFor(() => expect(a.result.current.data?.margem_bruta).toBe(150));
    expect(fake.rpc).toHaveBeenCalledWith("rpc_projeto_rentabilidade", { p_projeto_id: "p" });

    rpcComEmpresa({ rpc_projeto_rentabilidade: { data: null, error: null } });
    const b = hook(() => useProjetoRentabilidade("q"));
    await waitFor(() => expect(b.result.current.isSuccess).toBe(true));
    expect(b.result.current.data).toBeNull();

    rpcComEmpresa({ rpc_projeto_rentabilidade: { data: null, error: erro("can_view_financeiro") } });
    const c = hook(() => useProjetoRentabilidade("r"));
    await waitFor(() => expect(c.result.current.isError).toBe(true));

    fake.rpc.mockClear();
    hook(() => useProjetoRentabilidade("s", false));
    expect(fake.rpc).not.toHaveBeenCalled();
  });
});

describe("filtros na URL", () => {
  const vazio = {
    search: "",
    prioridades: [],
    pessoaIds: [],
    clienteIds: [],
    disciplinaIds: [],
    deadlineStatus: [],
    dataCampo: "previsao" as const,
    dataInicio: "",
    dataFim: "",
  };

  it("ida e volta preserva todos os filtros", () => {
    const filters = {
      search: "casa",
      prioridades: ["Alta"],
      pessoaIds: ["p1", "p2"],
      clienteIds: ["c1"],
      disciplinaIds: ["d1"],
      deadlineStatus: ["atrasado"],
      dataCampo: "inicio",
      dataInicio: "2026-01-01",
      dataFim: "2026-12-31",
    } as never;
    const params = filtersToParams(filters, { key: "dueDate", dir: "desc" } as never, new Set(["Concluído"]), "lista");
    expect(params.get("v")).toBe("lista");
    const volta = parseFiltersFromParams(params);
    expect(volta.filters).toEqual(filters);
    expect(volta.collapsed).toEqual(new Set(["Concluído"]));
    expect(volta.sort).toEqual({ key: "dueDate", dir: "desc" });
  });

  it("padrões não poluem a URL e campo de data inválido volta ao padrão", () => {
    expect(filtersToParams(vazio, { key: "priority", dir: "asc" } as never, new Set()).toString()).toBe("");
    expect(parseFiltersFromParams(new URLSearchParams("dc=xpto")).filters.dataCampo).toBe("previsao");
  });

  function comLocal<T>(fn: () => T) {
    return () => ({ estado: fn(), local: useLocation() });
  }

  it("lê a visão pelo caminho e respeita o acesso ao mapa", () => {
    expect(hook(comLocal(() => useProjetosUrlState(true)), "/projetos/disciplinas").result.current.estado.activeTab).toBe(
      "disciplinas"
    );
    expect(hook(comLocal(() => useProjetosUrlState(true)), "/projetos/cronograma").result.current.estado.activeTab).toBe(
      "cronograma"
    );
    expect(hook(comLocal(() => useProjetosUrlState(true)), "/projetos/mapa").result.current.estado.activeTab).toBe("mapa");
    expect(hook(comLocal(() => useProjetosUrlState(false)), "/projetos/mapa").result.current.estado.activeTab).toBe(
      "quadro"
    );
    expect(hook(comLocal(() => useProjetosUrlState(true)), "/projetos?v=lista").result.current.estado.viewMode).toBe(
      "lista"
    );
  });

  it("link antigo ?view= redireciona para a rota nova", async () => {
    const a = hook(comLocal(() => useProjetosUrlState(true)), "/projetos?view=cronograma");
    await waitFor(() => expect(a.result.current.local.pathname).toBe("/projetos/cronograma"));
    const b = hook(comLocal(() => useProjetosUrlState(true)), "/projetos?view=qualquer");
    await waitFor(() => expect(b.result.current.local.search).toBe(""));
  });

  it("filtros, coluna recolhida e troca de visão vão para a URL", async () => {
    const { result } = hook(comLocal(() => useProjetosUrlState(true)), "/projetos?q=ini");
    expect(result.current.estado.filters.search).toBe("ini");
    act(() => result.current.estado.setFilters({ ...vazio, search: "galpão" }));
    await waitFor(() => expect(result.current.local.search).toContain("q=galp"));
    act(() => result.current.estado.toggleColumn("Concluído"));
    await waitFor(() => expect(result.current.local.search).toContain("col="));
    act(() => result.current.estado.toggleColumn("Concluído"));
    await waitFor(() => expect(result.current.local.search).not.toContain("col="));
    act(() => result.current.estado.setViewMode("lista"));
    await waitFor(() => expect(result.current.estado.viewMode).toBe("lista"));
    act(() => result.current.estado.setViewMode("quadro"));
    await waitFor(() => expect(result.current.estado.viewMode).toBe("quadro"));
  });
});

describe("checklist da disciplina", () => {
  it("contagem agregada por disciplina", async () => {
    fake.responder(() => ({
      data: [
        { projeto_disciplina_id: "d-1", concluido: true },
        { projeto_disciplina_id: "d-1", concluido: false },
        { projeto_disciplina_id: "d-2", concluido: true },
      ],
      error: null,
    }));
    const { result } = hook(() => useProjetoDisciplinaChecklistCounts("p-1"));
    await waitFor(() =>
      expect(result.current.data).toEqual({ "d-1": { total: 2, concluidos: 1 }, "d-2": { total: 1, concluidos: 1 } })
    );
  });

  it("contagem com erro", async () => {
    fake.responder(() => ({ data: null, error: erro("x") }));
    const { result } = hook(() => useProjetoDisciplinaChecklistCounts("p-1"));
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("CRUD: adiciona na próxima ordem, marca e remove", async () => {
    fake.responder((c) =>
      c.op === "select" ? { data: [{ id: "i-1", texto: "Memorial", concluido: false, ordem: 0 }], error: null } : undefined
    );
    const { result, invalidar } = hook(() => useDisciplinaChecklist("d-1"));
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    await act(async () => {
      await result.current.addItem.mutateAsync("Prancha");
      await result.current.toggleItem.mutateAsync({ id: "i-1", concluido: true });
      await result.current.removeItem.mutateAsync("i-1");
    });
    const esc = fake.escritas("projeto_disciplina_checklist");
    expect(esc.map((e) => e.op)).toEqual(["insert", "update", "delete"]);
    expect(esc[0].payload).toEqual({ projeto_disciplina_id: "d-1", texto: "Prancha", ordem: 1 });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["projeto-disciplinas"] });
  });

  it("disciplina ainda não salva não aceita item; erros propagam", async () => {
    const a = hook(() => useDisciplinaChecklist(undefined));
    await act(async () => {
      await expect(a.result.current.addItem.mutateAsync("x")).rejects.toThrow("Disciplina ainda não foi salva");
    });
    fake.responder(() => ({ data: null, error: erro("RLS") }));
    const b = hook(() => useDisciplinaChecklist("d-1"));
    await waitFor(() => expect(b.result.current.isError).toBe(true));
    await act(async () => {
      await expect(b.result.current.addItem.mutateAsync("x")).rejects.toBeTruthy();
      await expect(b.result.current.toggleItem.mutateAsync({ id: "i", concluido: true })).rejects.toBeTruthy();
      await expect(b.result.current.removeItem.mutateAsync("i")).rejects.toBeTruthy();
    });
  });
});

describe("revisões da disciplina", () => {
  it("histórico, aberta, registrar e concluir", async () => {
    fake.responder(() => ({
      data: [
        {
          id: "r-2",
          motivo: "cliente mudou layout",
          solicitada_em: "2026-10-01",
          concluida_em: null,
          registrada_por_pessoa: { nome: "Ana" },
          concluida_por_pessoa: null,
        },
        {
          id: "r-1",
          motivo: "erro de cota",
          solicitada_em: "2026-09-01",
          concluida_em: "2026-09-05",
          registrada_por_pessoa: null,
          concluida_por_pessoa: { nome: "Bia" },
        },
      ],
      error: null,
    }));
    const { result } = hook(() => useDisciplinaRevisoes("d-1"));
    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(result.current.data![1]).toMatchObject({ registrada_por_nome: null, concluida_por_nome: "Bia" });
    expect(revisaoAberta(result.current.data!)?.id).toBe("r-2");
    await act(async () => {
      await result.current.registrar.mutateAsync({ motivo: "nova" });
      await result.current.registrar.mutateAsync({ motivo: "retroativa", solicitadaEm: "2026-08-01" });
      await result.current.concluir.mutateAsync("r-2");
    });
    expect(fake.rpc).toHaveBeenCalledWith("rpc_registrar_revisao", { p_disciplina_id: "d-1", p_motivo: "nova" });
    expect(fake.rpc).toHaveBeenCalledWith("rpc_registrar_revisao", {
      p_disciplina_id: "d-1",
      p_motivo: "retroativa",
      p_solicitada_em: "2026-08-01",
    });
    expect(fake.rpc).toHaveBeenCalledWith("rpc_concluir_revisao", { p_revisao_id: "r-2" });
  });

  it("erros e disciplina não salva", async () => {
    const a = hook(() => useDisciplinaRevisoes(undefined));
    await act(async () => {
      await expect(a.result.current.registrar.mutateAsync({ motivo: "x" })).rejects.toThrow("ainda não foi salva");
    });
    fake.responder(() => ({ data: null, error: erro("x") }));
    rpcComEmpresa({
      rpc_registrar_revisao: { data: null, error: erro("já existe revisão aberta") },
      rpc_concluir_revisao: { data: null, error: erro("não está aberta") },
    });
    const b = hook(() => useDisciplinaRevisoes("d-1"));
    await waitFor(() => expect(b.result.current.isError).toBe(true));
    await act(async () => {
      await expect(b.result.current.registrar.mutateAsync({ motivo: "x" })).rejects.toMatchObject({
        message: "já existe revisão aberta",
      });
      await expect(b.result.current.concluir.mutateAsync("r")).rejects.toMatchObject({ message: "não está aberta" });
    });
  });

  it("contagem de revisões por disciplina", async () => {
    fake.responder(() => ({
      data: [
        { projeto_disciplina_id: "d-1", concluida_em: null },
        { projeto_disciplina_id: "d-1", concluida_em: "x" },
      ],
      error: null,
    }));
    const a = hook(() => useProjetoDisciplinaRevisoesCounts("p-1"));
    await waitFor(() => expect(a.result.current.data).toEqual({ "d-1": { total: 2, abertas: 1 } }));
    fake.responder(() => ({ data: null, error: erro("x") }));
    const b = hook(() => useProjetoDisciplinaRevisoesCounts("p-2"));
    await waitFor(() => expect(b.result.current.isError).toBe(true));
  });
});

describe("etapas do quadro", () => {
  it("lista e cor padrão", async () => {
    fake.responder(() => ({ data: [{ id: "e-1", nome: "Briefing", ordem: 1, cor: null, bucket: "Em Andamento" }], error: null }));
    const { result } = hook(() => useProjetoEtapas());
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(corDaEtapaProjeto(null)).toBe("#94a3b8");
    expect(corDaEtapaProjeto("#fff")).toBe("#fff");
  });

  it("criar, editar, reordenar e excluir", async () => {
    fake.responder((c) =>
      c.op === "insert" ? { data: { id: "e-n", nome: "Nova", ordem: 3, cor: null, bucket: "Em Andamento" }, error: null } : undefined
    );
    const { result, invalidar } = hook(() => useProjetoEtapaMutations());
    let criada: unknown;
    await act(async () => {
      criada = await result.current.criar.mutateAsync({ nome: "Nova", ordem: 3 });
      await result.current.editar.mutateAsync({ id: "e-n", nome: "Nova 2", cor: "#000" });
      await result.current.reordenar.mutateAsync([
        { id: "e-1", ordem: 2 },
        { id: "e-n", ordem: 1 },
      ]);
      await result.current.excluir.mutateAsync("e-n");
    });
    expect(criada).toMatchObject({ id: "e-n" });
    expect(fake.escritas("projeto_etapas")[0].payload).toEqual({
      empresa_id: "emp-1",
      nome: "Nova",
      ordem: 3,
      cor: null,
      bucket: "Em andamento",
    });
    expect(fake.escritas("projeto_etapas").map((e) => e.op)).toEqual(["insert", "update", "update", "update", "delete"]);
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["projetos"] });
  });

  it("sem empresa no perfil e erros de escrita", async () => {
    perfil.profile = null;
    const { result } = hook(() => useProjetoEtapaMutations());
    await act(async () => {
      await expect(result.current.criar.mutateAsync({ nome: "x", ordem: 1 })).rejects.toThrow("Sem empresa no perfil");
    });
    perfil.profile = { empresa_id: "emp-1" };
    fake.responder(() => ({ data: null, error: erro("RLS") }));
    const b = hook(() => ({ m: useProjetoEtapaMutations(), q: useProjetoEtapas() }));
    await waitFor(() => expect(b.result.current.q.isError).toBe(true));
    await act(async () => {
      await expect(b.result.current.m.criar.mutateAsync({ nome: "x", ordem: 1 })).rejects.toBeTruthy();
      await expect(b.result.current.m.editar.mutateAsync({ id: "e", nome: "x", cor: "y" })).rejects.toBeTruthy();
      await expect(b.result.current.m.reordenar.mutateAsync([{ id: "e", ordem: 1 }])).rejects.toBeTruthy();
      await expect(b.result.current.m.excluir.mutateAsync("e")).rejects.toBeTruthy();
    });
  });
});

describe("atividades, pessoas sem conta e timeline", () => {
  it("atividades: lê comentários/links e salva só o que mudou", async () => {
    fake.responder((c) =>
      c.op === "select" ? { data: { comentarios: [{ id: "c-1" }], links: null }, error: null } : undefined
    );
    const { result } = hook(() => useProjetoAtividades("p-1"));
    await waitFor(() => expect(result.current.comentarios).toEqual([{ id: "c-1" }]));
    expect(result.current.links).toEqual([]);
    await act(async () => {
      await result.current.salvar.mutateAsync({ links: [{ url: "https://x", label: "x" }] as never });
    });
    expect(fake.escritas("projetos")[0].payload).toEqual({ links: [{ url: "https://x", label: "x" }] });
    fake.responder(() => ({ data: null, error: erro("x") }));
    await act(async () => {
      await expect(result.current.salvar.mutateAsync({ comentarios: [] })).rejects.toBeTruthy();
    });
  });

  it("pessoas sem conta vira um Set de ids", async () => {
    fake.responder(() => ({ data: [{ id: "a" }, { id: "b" }], error: null }));
    const { result } = hook(() => usePessoasSemConta());
    await waitFor(() => expect(result.current).toEqual(new Set(["a", "b"])));
  });

  it("timeline mapeia os eventos; erro e sem id", async () => {
    fake.responder(() => ({
      data: [
        { disciplina_id: null, disciplina_nome: null, tipo: "projeto_iniciado", ocorrido_em: "x", detalhe: null, autor_nome: "Ana" },
      ],
      error: null,
    }));
    const a = hook(() => useProjetoTimeline("p-1"));
    await waitFor(() =>
      expect(a.result.current.data).toEqual([
        { disciplinaId: null, disciplinaNome: null, tipo: "projeto_iniciado", ocorridoEm: "x", detalhe: null, autorNome: "Ana" },
      ])
    );
    fake.responder(() => ({ data: null, error: erro("x") }));
    const b = hook(() => useProjetoTimeline("p-2"));
    await waitFor(() => expect(b.result.current.isError).toBe(true));
  });
});

describe("useReordenarProjetos", () => {
  it("aplica a ordem no cache na hora e confirma", async () => {
    const m = montar();
    m.qc.setQueryData(["projetos"], [{ id: "a", ordem_prioridade: 1 }, { id: "b", ordem_prioridade: 2 }, { id: "c" }]);
    const { result } = renderHook(() => useReordenarProjetos(), { wrapper: m.wrapper });
    await act(async () => {
      await result.current.mutateAsync(["b", "a"]);
    });
    expect(m.qc.getQueryData(["projetos"])).toEqual([
      { id: "a", ordem_prioridade: 2 },
      { id: "b", ordem_prioridade: 1 },
      { id: "c" },
    ]);
    expect(fake.rpc).toHaveBeenCalledWith("rpc_reordenar_projetos", { p_ids: ["b", "a"] });
    expect(toast.success).toHaveBeenCalledWith("Ordem de prioridade salva");
  });

  it("erro volta a ordem anterior e avisa", async () => {
    rpcComEmpresa({ rpc_reordenar_projetos: { data: null, error: erro("sem permissão") } });
    const m = montar();
    const antes = [{ id: "a", ordem_prioridade: 1 }, { id: "b", ordem_prioridade: 2 }];
    m.qc.setQueryData(["projetos"], antes);
    const { result } = renderHook(() => useReordenarProjetos(), { wrapper: m.wrapper });
    await act(async () => {
      await result.current.mutateAsync(["b", "a"]).catch(() => {});
    });
    expect(m.qc.getQueryData(["projetos"])).toEqual(antes);
    expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar a ordem", expect.anything());
  });
});
