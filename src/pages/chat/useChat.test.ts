import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ChainQuery, ChainResult } from "@/test/supabaseChain";

// Chat com os agentes: SSE token a token com fallback buffered quando o stream não serve,
// erros definitivos (401/402/403/429, falha de IA tipada) sem fallback, parada manual,
// persistência da conversa e o ciclo do rascunho (confirmar via RPC, cancelar, desfazer).

const h = vi.hoisted(() => ({
  token: "jwt" as string | null,
  fetch: vi.fn(),
  invoke: vi.fn(),
  rpc: vi.fn(),
  resolve: (() => ({ data: null })) as (q: ChainQuery) => ChainResult,
  calls: [] as ChainQuery[],
  softDelete: vi.fn(),
  softDeleteGrupo: vi.fn(),
  report: vi.fn(),
  track: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom } = await import("@/test/supabaseChain");
  const chain = createSupabaseFrom((q) => h.resolve(q));
  h.calls = chain.calls;
  return {
    supabase: {
      from: chain.from,
      rpc: h.rpc,
      functions: { invoke: h.invoke },
      auth: { getSession: async () => ({ data: { session: h.token ? { access_token: h.token } : null } }) },
    },
  };
});
vi.mock("@/lib/env", () => ({
  env: { VITE_SUPABASE_URL: "https://ref.supabase.co", VITE_SUPABASE_PUBLISHABLE_KEY: "anon" },
}));
vi.mock("@/lib/monitoring", () => ({ reportInvokeError: h.report }));
vi.mock("@/lib/softDelete", () => ({ softDelete: h.softDelete, softDeleteGrupo: h.softDeleteGrupo }));
vi.mock("@/lib/analytics", () => ({ analytics: { track: h.track } }));

import { useChat } from "./useChat";

const STORAGE_KEY = "pilar.chat.v1";

/** Resposta de fetch com corpo SSE entregue em pedaços. */
function sse(chunks: string[], init: { ok?: boolean; status?: number; json?: unknown; erroLeitura?: boolean } = {}) {
  const enc = new TextEncoder();
  let i = 0;
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => {
      if (init.json === undefined) throw new Error("sem json");
      return init.json;
    },
    body: {
      getReader: () => ({
        read: async () => {
          if (init.erroLeitura && i >= chunks.length) throw new Error("conexão caiu");
          return i < chunks.length ? { done: false, value: enc.encode(chunks[i++]) } : { done: true, value: undefined };
        },
      }),
    },
  };
}
const ev = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  h.token = "jwt";
  h.resolve = () => ({ data: null });
  h.calls.length = 0;
  h.softDelete.mockResolvedValue(null);
  h.softDeleteGrupo.mockResolvedValue(null);
  vi.stubGlobal("fetch", h.fetch);
});

describe("useChat: envio por stream", () => {
  it("mensagem em branco não envia", async () => {
    const { result } = renderHook(() => useChat());
    await act(() => result.current.send("   "));
    expect(result.current.messages).toEqual([]);
    expect(h.fetch).not.toHaveBeenCalled();
  });

  it("tokens montam a resposta e o final fecha com agentes, sessão e saldo", async () => {
    h.fetch.mockResolvedValue(
      sse([
        ev("token", { text: "Você tem " }),
        // Evento partido entre dois pedaços do stream.
        "event: token\nda",
        `ta: ${JSON.stringify({ text: "3 projetos." })}\n\n`,
        "linha sem evento\n\n",
        "event: token\ndata: {quebrado\n\n",
        ev("final", {
          sessionId: "s1",
          tipo: "resposta",
          resposta: "ignorada",
          agentes: [{ agente: "projetos", agente_label: "Projetos" }],
          saldo: { tokens_plano: 10, tokens_comprado: 0, tokens_restantes: 7 },
        }),
      ])
    );
    const { result } = renderHook(() => useChat());
    await act(() => result.current.send("  quantos projetos?  ", "proj-1"));
    const [user, resp] = result.current.messages;
    expect(user).toMatchObject({ role: "user", content: "quantos projetos?" });
    expect(resp).toMatchObject({
      role: "assistant",
      content: "Você tem 3 projetos.",
      agentes: [{ agente: "projetos" }],
    });
    expect(result.current.saldo).toEqual({ tokens_plano: 10, tokens_comprado: 0, tokens_restantes: 7 });
    expect(result.current.loading).toBe(false);
    const [url, init] = h.fetch.mock.calls[0];
    expect(url).toBe("https://ref.supabase.co/functions/v1/ai-chat");
    expect(JSON.parse(init.body)).toEqual({ message: "quantos projetos?", projetoId: "proj-1" });
    expect(init.headers.Authorization).toBe("Bearer jwt");
    expect(h.track).toHaveBeenCalledWith("ia_mensagem_enviada", { com_projeto: true });
    expect(h.invoke).not.toHaveBeenCalled();
    // A segunda mensagem leva a sessão.
    h.fetch.mockResolvedValue(sse([ev("final", { sessionId: "s1", tipo: "resposta", resposta: "Ok", agentes: [] })]));
    await act(() => result.current.send("e agora?"));
    expect(JSON.parse(h.fetch.mock.calls[1][1].body).sessionId).toBe("s1");
    expect(result.current.messages.at(-1)!.content).toBe("Ok");
  });

  it("final de rascunho vira card pendente", async () => {
    h.fetch.mockResolvedValue(
      sse([
        ev("final", {
          sessionId: "s1",
          tipo: "draft",
          runId: "r1",
          entidade: "lead",
          campos: { nome: "Ana" },
          custoCreditos: 2,
          agentes: [],
        }),
      ])
    );
    const { result } = renderHook(() => useChat());
    await act(() => result.current.send("cria lead Ana"));
    expect(result.current.messages[1].draft).toEqual({
      runId: "r1",
      entidade: "lead",
      campos: { nome: "Ana" },
      custoCreditos: 2,
      status: "pendente",
    });
  });

  it("final de ação vira card de ação pendente", async () => {
    h.fetch.mockResolvedValue(
      sse([
        ev("final", { sessionId: "s1", tipo: "acao", operacao: "quitar", runId: "r2", custoCreditos: 1, agentes: [] }),
      ])
    );
    const { result } = renderHook(() => useChat());
    await act(() => result.current.send("quita a fatura"));
    expect(result.current.messages[1].acao).toEqual({
      operacao: "quitar",
      runId: "r2",
      custoCreditos: 1,
      status: "pendente",
    });
  });

  it("evento de erro depois de tokens marca a mensagem; sem tokens cria uma de erro", async () => {
    h.fetch.mockResolvedValue(sse([ev("token", { text: "Parcial" }), ev("error", { error: "Modelo caiu" })]));
    const { result } = renderHook(() => useChat());
    await act(() => result.current.send("oi"));
    expect(result.current.messages[1]).toMatchObject({ content: "Parcial", erro: true });

    h.fetch.mockResolvedValue(sse([ev("error", {})]));
    await act(() => result.current.send("oi de novo"));
    expect(result.current.messages.at(-1)).toMatchObject({ content: "Não consegui gerar a resposta.", erro: true });
  });
});

describe("useChat: fallback e erros", () => {
  const buffered = { sessionId: "s9", tipo: "resposta", resposta: "Via invoke", agentes: [] };

  it.each([
    ["sem sessão", () => (h.token = null)],
    ["fetch falha ao abrir", () => h.fetch.mockRejectedValue(new TypeError("Failed to fetch"))],
    ["status 500 sem tipo", () => h.fetch.mockResolvedValue(sse([], { ok: false, status: 500, json: { error: "x" } }))],
    ["stream vazio", () => h.fetch.mockResolvedValue(sse([]))],
    ["sem corpo", () => h.fetch.mockResolvedValue({ ok: true, status: 200, body: null })],
    ["leitura cai sem dados", () => h.fetch.mockResolvedValue(sse([], { erroLeitura: true }))],
  ])("%s cai no buffered", async (_nome, preparar) => {
    preparar();
    h.invoke.mockResolvedValue({ data: buffered, error: null });
    const { result } = renderHook(() => useChat());
    await act(() => result.current.send("oi"));
    expect(h.invoke).toHaveBeenCalledWith(
      "ai-chat",
      expect.objectContaining({ body: { message: "oi", sessionId: undefined, projetoId: undefined } })
    );
    expect(result.current.messages.at(-1)!.content).toBe("Via invoke");
  });

  it.each([
    [402, { motivo: "limite_usuario" }, /seu limite de créditos/],
    [402, {}, /créditos de IA da empresa acabaram/],
    [429, null, /Muitas chamadas/],
    [401, null, /não tem permissão/],
  ])("HTTP %s é definitivo e não cai no buffered", async (status, json, msg) => {
    h.fetch.mockResolvedValue(sse([], { ok: false, status, json: json ?? undefined }));
    const { result } = renderHook(() => useChat());
    await act(() => result.current.send("oi"));
    expect(h.invoke).not.toHaveBeenCalled();
    expect(result.current.messages.at(-1)).toMatchObject({ erro: true, content: expect.stringMatching(msg) });
    expect(h.report).toHaveBeenCalled();
  });

  it("falha de IA tipada mostra o texto do servidor sem chamar o modelo de novo", async () => {
    h.fetch.mockResolvedValue(
      sse([], { ok: false, status: 503, json: { error: "O provedor de IA está fora do ar.", tipo: "indisponivel" } })
    );
    const { result } = renderHook(() => useChat());
    await act(() => result.current.send("oi"));
    expect(h.invoke).not.toHaveBeenCalled();
    expect(result.current.messages.at(-1)!.content).toBe("O provedor de IA está fora do ar.");
  });

  it("erro também no buffered vira mensagem de erro", async () => {
    h.token = null;
    h.invoke.mockResolvedValue({ data: null, error: Object.assign(new Error("x"), { name: "FunctionsFetchError" }) });
    const { result } = renderHook(() => useChat());
    await act(() => result.current.send("oi"));
    expect(result.current.messages.at(-1)).toMatchObject({ erro: true, content: expect.stringMatching(/Sem conexão/) });
  });

  it("leitura que cai depois de tokens não refaz pelo buffered", async () => {
    h.fetch.mockResolvedValue(sse([ev("token", { text: "meio" })], { erroLeitura: true }));
    const { result } = renderHook(() => useChat());
    await act(() => result.current.send("oi"));
    expect(h.invoke).not.toHaveBeenCalled();
    expect(result.current.messages.at(-1)!.erro).toBe(true);
  });

  it("parar a geração encerra sem erro alarmante e sem fallback", async () => {
    h.fetch.mockImplementation(
      (_u: string, init: { signal: AbortSignal }) =>
        new Promise((_ok, falha) =>
          init.signal.addEventListener("abort", () => falha(new DOMException("abort", "AbortError")))
        )
    );
    const { result } = renderHook(() => useChat());
    let envio!: Promise<void>;
    act(() => {
      envio = result.current.send("texto longo");
    });
    await waitFor(() => expect(result.current.loading).toBe(true));
    await waitFor(() => expect(h.fetch).toHaveBeenCalled());
    act(() => result.current.stop());
    await act(() => envio);
    expect(result.current.messages.at(-1)).toEqual(expect.objectContaining({ content: "Geração interrompida." }));
    expect(result.current.messages.at(-1)!.erro).toBeUndefined();
    expect(h.invoke).not.toHaveBeenCalled();
    expect(h.report).not.toHaveBeenCalled();
  });

  it("stop sem envio em curso não faz nada", () => {
    const { result } = renderHook(() => useChat());
    expect(() => act(() => result.current.stop())).not.toThrow();
  });
});

describe("useChat: persistência", () => {
  it("reidrata do localStorage e limpa ao resetar", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ sessionId: "s1", messages: [{ id: "m1", role: "user", content: "oi" }] })
    );
    const { result } = renderHook(() => useChat());
    expect(result.current.messages).toHaveLength(1);
    act(() => result.current.reset());
    expect(result.current.messages).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("snapshot corrompido ou sem lista começa vazio", () => {
    localStorage.setItem(STORAGE_KEY, "{nao é json");
    expect(renderHook(() => useChat()).result.current.messages).toEqual([]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: "x" }));
    expect(renderHook(() => useChat()).result.current.messages).toEqual([]);
  });

  it("grava a conversa depois de responder", async () => {
    h.fetch.mockResolvedValue(sse([ev("final", { sessionId: "s7", tipo: "resposta", resposta: "Oi!", agentes: [] })]));
    const { result } = renderHook(() => useChat());
    await act(() => result.current.send("oi"));
    const salvo = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(salvo.sessionId).toBe("s7");
    expect(salvo.messages).toHaveLength(2);
  });
});

describe("useChat: rascunhos e ações", () => {
  async function comRascunho(entidade = "lead") {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        messages: [
          {
            id: "m1",
            role: "assistant",
            content: "",
            draft: { runId: "r1", entidade, campos: {}, custoCreditos: 1, status: "pendente" },
          },
          {
            id: "m2",
            role: "assistant",
            content: "",
            acao: { operacao: "quitar", runId: "r2", custoCreditos: 1, status: "pendente" },
          },
        ],
      })
    );
    return renderHook(() => useChat());
  }

  it("confirmar grava as edições, chama a RPC da entidade, roda o pós-criação e marca criado", async () => {
    h.rpc.mockResolvedValue({ data: { projeto_id: "p9" }, error: null });
    const depois = vi.fn().mockResolvedValue(undefined);
    const { result } = await comRascunho("projeto");
    let id: string | undefined;
    await act(async () => {
      id = await result.current.confirmarDraft("r1", "projeto", { nome: "Casa" }, depois);
    });
    expect(id).toBe("p9");
    expect(h.calls[0]).toMatchObject({ table: "agent_runs", op: "update", payload: { result: { nome: "Casa" } } });
    expect(h.rpc).toHaveBeenCalledWith("criar_projeto_agente", { p_run_id: "r1" });
    expect(depois).toHaveBeenCalledWith("p9");
    expect(result.current.messages[0].draft).toMatchObject({
      status: "criado",
      entityId: "p9",
      campos: { nome: "Casa" },
    });
  });

  it("parcelado usa o grupo como id da entidade", async () => {
    h.rpc.mockResolvedValue({ data: { grupo_id: "g1", receita_id: "x" }, error: null });
    const { result } = await comRascunho("receita");
    await act(async () => {
      await expect(result.current.confirmarDraft("r1", "receita", {})).resolves.toBe("g1");
    });
  });

  it("pós-criação que falha não marca criado; erro no update ou na RPC propaga", async () => {
    h.rpc.mockResolvedValue({ data: { lead_id: "l1" }, error: null });
    const { result } = await comRascunho();
    await act(async () => {
      await expect(
        result.current.confirmarDraft("r1", "lead", {}, async () => Promise.reject(new Error("disciplinas")))
      ).rejects.toThrow("disciplinas");
    });
    expect(result.current.messages[0].draft!.status).toBe("pendente");

    h.rpc.mockResolvedValue({ data: null, error: new Error("Sem créditos") });
    await act(async () => {
      await expect(result.current.confirmarDraft("r1", "lead", {})).rejects.toThrow("Sem créditos");
    });

    h.resolve = () => ({ error: new Error("rls") });
    await act(async () => {
      await expect(result.current.confirmarDraft("r1", "lead", {})).rejects.toThrow("rls");
    });
  });

  it("cancelar rascunho rejeita o run", async () => {
    const { result } = await comRascunho();
    await act(() => result.current.cancelarDraft("r1"));
    expect(h.calls[0].payload).toEqual({ status: "rejected" });
    expect(result.current.messages[0].draft!.status).toBe("cancelado");
  });

  it("desfazer usa soft delete simples ou por grupo na tabela da entidade", async () => {
    const { result } = await comRascunho("aditivo");
    await act(() => result.current.desfazer("r1", "aditivo", "esc-1"));
    expect(h.softDelete).toHaveBeenCalledWith("escopos", "esc-1");
    await act(() => result.current.desfazer("r1", "despesa", "g1", true));
    expect(h.softDeleteGrupo).toHaveBeenCalledWith("despesas", "g1");
    expect(result.current.messages[0].draft!.status).toBe("cancelado");
  });

  it("desfazer com erro do soft delete não rejeita o run", async () => {
    h.softDelete.mockResolvedValue(new Error("já faturado"));
    const { result } = await comRascunho();
    await act(async () => {
      await expect(result.current.desfazer("r1", "lead", "l1")).rejects.toThrow("já faturado");
    });
    expect(h.calls).toHaveLength(0);
  });

  it("desfazer folha apaga só as linhas da run quando conhecidas", async () => {
    h.resolve = (q) => (q.single ? { data: { result: { linhas_ids: ["f1", "f2"] } } } : { data: null });
    const { result } = await comRascunho("folha");
    await act(() => result.current.desfazerFolha("r1", 7, 2026));
    const del = h.calls.find((c) => c.op === "delete")!;
    expect(del.filters).toContainEqual(["in", "id", ["f1", "f2"]]);
    expect(result.current.messages[0].draft!.status).toBe("cancelado");
  });

  it("desfazer folha de run antiga apaga as pendentes do mês da empresa", async () => {
    h.resolve = (q) => (q.single ? { data: { result: {} } } : { data: null });
    h.rpc.mockResolvedValue({ data: "emp-1", error: null });
    const { result } = await comRascunho("folha");
    await act(() => result.current.desfazerFolha("r1", 7, 2026));
    const del = h.calls.find((c) => c.op === "delete")!;
    expect(del.filters).toEqual(
      expect.arrayContaining([
        ["eq", "empresa_id", "emp-1"],
        ["eq", "mes", 7],
        ["eq", "ano", 2026],
        ["eq", "status", "pendente"],
      ])
    );
  });

  it("desfazer folha com erro no delete propaga", async () => {
    h.resolve = (q) =>
      q.single
        ? { data: { result: { linhas_ids: ["f1"] } } }
        : q.op === "delete"
          ? { error: new Error("x") }
          : { data: null };
    const { result } = await comRascunho("folha");
    await act(async () => {
      await expect(result.current.desfazerFolha("r1", 7, 2026)).rejects.toThrow("x");
    });
  });

  it("ação genérica grava o payload e chama o dispatcher; convite ao portal usa a edge", async () => {
    h.rpc.mockResolvedValue({ error: null });
    const { result } = await comRascunho();
    await act(() => result.current.executarAcao("r2", "quitar", { despesa_id: "d1" }));
    expect(h.calls[0].payload).toEqual({ result: { acao: "quitar", despesa_id: "d1" } });
    expect(h.rpc).toHaveBeenCalledWith("executar_acao_agente", { p_run_id: "r2" });
    expect(result.current.messages[1].acao!.status).toBe("feito");

    h.invoke.mockResolvedValue({ error: null });
    await act(() => result.current.executarAcao("r2", "convidar_portal", { cliente_id: "c1", email: "c@x.co" }));
    expect(h.invoke).toHaveBeenCalledWith("invite-cliente-portal", { body: { cliente_id: "c1", email: "c@x.co" } });
    expect(h.calls.at(-1)!.payload).toEqual({ status: "executed", entity_type: "convidar_portal" });
  });

  it("ação com erro não marca feito", async () => {
    h.invoke.mockResolvedValue({ error: new Error("e-mail inválido") });
    const { result } = await comRascunho();
    await act(async () => {
      await expect(result.current.executarAcao("r2", "convidar_portal", {})).rejects.toThrow("e-mail inválido");
    });
    h.rpc.mockResolvedValue({ error: new Error("saldo") });
    await act(async () => {
      await expect(result.current.executarAcao("r2", "pagar", {})).rejects.toThrow("saldo");
    });
    h.resolve = () => ({ error: new Error("rls") });
    await act(async () => {
      await expect(result.current.executarAcao("r2", "pagar", {})).rejects.toThrow("rls");
    });
    expect(result.current.messages[1].acao!.status).toBe("pendente");
  });

  it("cancelar ação rejeita o run", async () => {
    const { result } = await comRascunho();
    await act(() => result.current.cancelarAcao("r2"));
    expect(result.current.messages[1].acao!.status).toBe("cancelado");
  });
});
