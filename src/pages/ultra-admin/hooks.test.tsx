import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createSupabaseFrom, type ChainQuery, type ChainResult } from "@/test/supabaseChain";

// Hooks do portal ultra admin: feed de atividade (auditoria + avisos), mutações da empresa
// (só com UUID), feedback com troca otimista de status, incidentes e ações sobre empresa.

const h = vi.hoisted(() => ({
  resolve: (() => ({ data: [] })) as (q: ChainQuery) => ChainResult,
  rpc: vi.fn(),
  user: { id: "ultra-1" } as { id: string } | null,
}));
const chain = vi.hoisted(() => ({ from: null as unknown as ReturnType<typeof createSupabaseFrom> }));

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom } = await import("@/test/supabaseChain");
  chain.from = createSupabaseFrom((q) => h.resolve(q));
  return { supabase: { from: chain.from.from, rpc: h.rpc } };
});
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: h.user }) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const monitoring = vi.hoisted(() => ({ reportInvokeError: vi.fn() }));
vi.mock("@/lib/monitoring", () => monitoring);
const api = vi.hoisted(() => ({ edgeFetch: vi.fn() }));
vi.mock("./api", async (orig) => ({ ...(await orig<typeof import("./api")>()), edgeFetch: api.edgeFetch }));

import {
  KEYS,
  atualizarEmpresa,
  marcarEmpresaInterna,
  useAcaoEmpresa,
  useAtividade,
  useComponentes,
  useEmpresa,
  useFeedback,
  useIncidentes,
  useMudarStatusFeedback,
  useMutacoesEmpresa,
  type FeedbackItem,
} from "./hooks";

const UUID = "0b8e7c1a-1234-4abc-9def-0123456789ab";

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.resolve = () => ({ data: [] });
  h.user = { id: "ultra-1" };
  h.rpc.mockResolvedValue({ error: null });
  chain.from.calls.length = 0;
});

describe("KEYS", () => {
  it("todas as chaves começam em ultra-admin", () => {
    expect(KEYS.atividade(null, 10)).toEqual(["ultra-admin", "atividade", "todas", 10]);
    expect(KEYS.empresa("e1")[0]).toBe("ultra-admin");
    expect(KEYS.mutacoes("e1")).toEqual(["ultra-admin", "mutacoes", "e1"]);
  });
});

describe("useAtividade", () => {
  it("junta auditoria e avisos, ordena por data, esconde eco de exclusão manual", async () => {
    h.resolve = (q) => {
      if (q.table === "admin_audit_logs")
        return {
          data: [
            {
              id: 1,
              actor_email: "m@pilar",
              action: "create_company",
              category: "empresa",
              target_name: "Alfa",
              empresa_id: "e1",
              metadata: null,
              created_at: "2026-11-01T10:00:00Z",
            },
            {
              id: 2,
              actor_email: "m@pilar",
              action: "empresa_excluida_retencao",
              category: "empresa",
              target_name: "X",
              empresa_id: "e2",
              metadata: { motivo: "Exclusão manual no portal por m" },
              created_at: "2026-11-03T10:00:00Z",
            },
          ],
        };
      return {
        data: [
          {
            id: 9,
            tipo: "novo_cadastro",
            titulo: "Nova empresa",
            mensagem: "Beta se cadastrou",
            empresa_id: "e3",
            link: "/x",
            created_at: "2026-11-02T10:00:00Z",
          },
          {
            id: 10,
            tipo: "plano_bloqueado",
            titulo: "Plano bloqueado",
            mensagem: null,
            empresa_id: "e3",
            link: null,
            created_at: "2026-10-01T10:00:00Z",
          },
        ],
      };
    };
    const { wrapper } = setup();
    const { result } = renderHook(() => useAtividade(null), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const evs = result.current.data!;
    expect(evs.map((e) => e.id)).toEqual(["aviso-9", "audit-1", "aviso-10"]);
    expect(evs[0]).toMatchObject({ ator: null, tipo: "cadastro", detalhe: "Beta se cadastrou", link: "/x" });
    expect(evs[1]).toMatchObject({ ator: "m@pilar", frase: "criou a empresa Alfa", tipo: "empresa" });
    expect(evs[2].tipo).toBe("cobranca");
    // Sem filtro de empresa: avisos só do próprio ultra admin.
    const avisos = chain.from.calls.find((c) => c.table === "notificacoes")!;
    expect(avisos.filters).toContainEqual(["eq", "destinatario_id", "ultra-1"]);
    expect(avisos.filters.some((f) => f[1] === "empresa_id")).toBe(false);
  });

  it("filtra por empresa nas duas fontes e respeita o limite", async () => {
    h.resolve = (q) =>
      q.table === "admin_audit_logs"
        ? {
            data: [
              {
                id: 1,
                actor_email: null,
                action: "x",
                category: null,
                target_name: null,
                empresa_id: "e1",
                metadata: null,
                created_at: "2026-11-01",
              },
              {
                id: 2,
                actor_email: null,
                action: "x",
                category: null,
                target_name: null,
                empresa_id: "e1",
                metadata: null,
                created_at: "2026-11-02",
              },
            ],
          }
        : { data: null };
    const { wrapper } = setup();
    const { result } = renderHook(() => useAtividade("e1", 1), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].id).toBe("audit-2");
    for (const t of ["admin_audit_logs", "notificacoes"]) {
      expect(chain.from.calls.find((c) => c.table === t)!.filters).toContainEqual(["eq", "empresa_id", "e1"]);
    }
  });

  it("erro em qualquer fonte vira erro da query", async () => {
    h.resolve = (q) => (q.table === "notificacoes" ? { data: null, error: new Error("rls") } : { data: [] });
    const { wrapper } = setup();
    const { result } = renderHook(() => useAtividade(null), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("rls");
  });

  it("erro na auditoria também falha a query", async () => {
    h.resolve = (q) => (q.table === "admin_audit_logs" ? { data: null, error: new Error("audit") } : { data: [] });
    const { wrapper } = setup();
    const { result } = renderHook(() => useAtividade(null), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("sem usuário não consulta", () => {
    h.user = null;
    const { wrapper } = setup();
    const { result } = renderHook(() => useAtividade(null), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(chain.from.from).not.toHaveBeenCalled();
  });
});

describe("useMutacoesEmpresa", () => {
  it("id que não é UUID não chega ao .or() (evita injeção no filtro)", () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useMutacoesEmpresa("e1,empresa_id.neq.x"), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(chain.from.from).not.toHaveBeenCalled();
  });

  it("com UUID filtra pela coluna e pelo metadata", async () => {
    h.resolve = () => ({
      data: [{ id: "a1", actor_email: "x@y", action: "update", target_table: "company_features", created_at: "q" }],
    });
    const { wrapper } = setup();
    const { result } = renderHook(() => useMutacoesEmpresa(UUID), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      { id: "a1", ator: "x@y", action: "update", tabela: "company_features", quando: "q" },
    ]);
    expect(chain.from.calls[0].filters).toContainEqual([
      "or",
      `empresa_id.eq.${UUID},metadata->>empresa_id.eq.${UUID}`,
    ]);
  });

  it("erro do banco propaga", async () => {
    h.resolve = () => ({ data: null, error: new Error("x") });
    const { wrapper } = setup();
    const { result } = renderHook(() => useMutacoesEmpresa(UUID), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useEmpresa", () => {
  it("sem id fica parado", () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useEmpresa(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(api.edgeFetch).not.toHaveBeenCalled();
  });
});

describe("useFeedback e troca de status", () => {
  const linha = {
    id: "f1",
    tipo: "bug",
    titulo: "Erro",
    descricao: "Quebrou",
    created_at: "2026-11-01",
    status_interno: "novo",
    created_by: "u1",
    empresa_id: "e1",
    print_path: null,
    contexto: { rota: "/financeiro", navegador: "Chrome", janela: "1440x900" },
    sentry_event_id: "s1",
  };

  it("mapeia contexto e tipo (desconhecido vira sugestão)", async () => {
    h.resolve = () => ({ data: [linha, { ...linha, id: "f2", tipo: "elogio", contexto: null }] });
    const { wrapper } = setup();
    const { result } = renderHook(() => useFeedback(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data![0]).toMatchObject({
      tipo: "bug",
      rota: "/financeiro",
      navegador: "Chrome",
      janela: "1440x900",
      status: "novo",
    });
    expect(result.current.data![1]).toMatchObject({ tipo: "sugestao", rota: null, navegador: null, janela: null });
  });

  it("erro na listagem propaga", async () => {
    h.resolve = () => ({ data: null, error: new Error("x") });
    const { wrapper } = setup();
    const { result } = renderHook(() => useFeedback(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("troca otimista: aplica na hora e grava no banco", async () => {
    const { qc, wrapper } = setup();
    const item = { id: "f1", status: "novo" } as FeedbackItem;
    qc.setQueryData(KEYS.feedback, [item, { ...item, id: "f2" }]);
    const { result } = renderHook(() => useMudarStatusFeedback(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: "f1", status: "resolvido" });
    });
    const dados = qc.getQueryData<FeedbackItem[]>(KEYS.feedback)!;
    expect(dados.map((f) => f.status)).toEqual(["resolvido", "novo"]);
    const upd = chain.from.calls.find((c) => c.op === "update")!;
    expect(upd.payload).toEqual({ status_interno: "resolvido" });
    expect(upd.filters).toContainEqual(["eq", "id", "f1"]);
  });

  it("falha no banco desfaz a troca e avisa", async () => {
    h.resolve = (q) => (q.op === "update" ? { error: new Error("sem permissão") } : { data: [] });
    const { qc, wrapper } = setup();
    const item = { id: "f1", status: "novo" } as FeedbackItem;
    qc.setQueryData(KEYS.feedback, [item]);
    const { result } = renderHook(() => useMudarStatusFeedback(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: "f1", status: "descartado" }).catch(() => {});
    });
    expect(qc.getQueryData<FeedbackItem[]>(KEYS.feedback)![0].status).toBe("novo");
    expect(toast.error).toHaveBeenCalledWith("Não foi possível mudar o status", expect.anything());
  });
});

describe("incidentes e componentes", () => {
  it("componentes usam o nome de exibição", async () => {
    h.resolve = () => ({ data: [{ id: "c1", slug: "app", nome_exibicao: "Aplicativo", ordem: 1 }] });
    const { wrapper } = setup();
    const { result } = renderHook(() => useComponentes(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: "c1", slug: "app", nome: "Aplicativo" }]);
  });

  it("incidente traz componentes e atualizações da mais nova para a mais antiga", async () => {
    h.resolve = () => ({
      data: [
        {
          id: "i1",
          titulo: "Lentidão",
          severidade: "degradado",
          status: "monitorando",
          created_at: "2026-11-01",
          resolved_at: null,
          status_incident_components: [{ component_id: "c1" }],
          status_incident_updates: [
            { id: "u1", mensagem: "Investigando", created_at: "2026-11-01T10:00:00Z" },
            { id: "u2", mensagem: "Corrigido", created_at: "2026-11-01T12:00:00Z" },
          ],
        },
        {
          id: "i2",
          titulo: "x",
          severidade: "outage",
          status: "resolvido",
          created_at: "c",
          resolved_at: "r",
          status_incident_components: null,
          status_incident_updates: null,
        },
      ],
    });
    const { wrapper } = setup();
    const { result } = renderHook(() => useIncidentes(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [i1, i2] = result.current.data!;
    expect(i1.componentIds).toEqual(["c1"]);
    expect(i1.updates.map((u) => u.id)).toEqual(["u2", "u1"]);
    expect(i2).toMatchObject({ componentIds: [], updates: [], resolvedAt: "r" });
  });

  it("erros propagam", async () => {
    h.resolve = () => ({ data: null, error: new Error("x") });
    const { wrapper } = setup();
    const a = renderHook(() => useIncidentes(), { wrapper });
    const b = renderHook(() => useComponentes(), { wrapper });
    await waitFor(() => expect(a.result.current.isError).toBe(true));
    await waitFor(() => expect(b.result.current.isError).toBe(true));
  });
});

describe("ações sobre empresa", () => {
  it("marcarEmpresaInterna chama a RPC e propaga erro", async () => {
    await marcarEmpresaInterna("e1", true);
    expect(h.rpc).toHaveBeenCalledWith("ops_marcar_empresa_interna", { p_empresa_id: "e1", p_interna: true });
    h.rpc.mockResolvedValueOnce({ error: new Error("negado") });
    await expect(marcarEmpresaInterna("e1", false)).rejects.toThrow("negado");
  });

  it("atualizarEmpresa faz PUT com o id junto do patch", async () => {
    api.edgeFetch.mockResolvedValue({ ok: true });
    await atualizarEmpresa("e1", { status: "suspended" });
    expect(api.edgeFetch).toHaveBeenCalledWith("ultra-admin-empresas", {
      method: "PUT",
      body: { empresa_id: "e1", status: "suspended" },
    });
  });

  it("useAcaoEmpresa: sucesso avisa (texto ou função) e recarrega o portal", async () => {
    const { qc, wrapper } = setup();
    const inval = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(
      () =>
        useAcaoEmpresa<string>({ run: async () => "ok", sucesso: (n) => `Feito: ${n}`, erro: "Falhou", contexto: "t" }),
      { wrapper }
    );
    await act(async () => {
      await result.current.mutateAsync("Alfa");
    });
    expect(toast.success).toHaveBeenCalledWith("Feito: Alfa");
    expect(inval).toHaveBeenCalledWith({ queryKey: ["ultra-admin"] });
  });

  it("useAcaoEmpresa com sucesso null não avisa", async () => {
    const { wrapper } = setup();
    const { result } = renderHook(
      () => useAcaoEmpresa<void>({ run: async () => 1, sucesso: null, erro: "x", contexto: "t" }),
      {
        wrapper,
      }
    );
    await act(async () => {
      await result.current.mutateAsync();
    });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("useAcaoEmpresa: erro reporta, avisa e relança", async () => {
    const { wrapper } = setup();
    const erro = new Error("Plano inválido");
    const { result } = renderHook(
      () =>
        useAcaoEmpresa<void>({
          run: async () => Promise.reject(erro),
          sucesso: "ok",
          erro: "Não deu",
          contexto: "ctx",
        }),
      { wrapper }
    );
    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toThrow("Plano inválido");
    });
    expect(monitoring.reportInvokeError).toHaveBeenCalledWith(erro, "ctx");
    expect(toast.error).toHaveBeenCalledWith("Não deu", expect.objectContaining({ description: expect.any(String) }));
    expect(toast.success).not.toHaveBeenCalled();
  });
});
