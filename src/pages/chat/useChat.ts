import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { msgErroChat } from "./erros";
import { env } from "@/lib/env";

export type AgenteMeta = {
  agente: string;
  agente_label: string;
  motivo?: string;
};

/** Campos editáveis de um rascunho de lead extraído pelo Agente Comercial. */
export type LeadCampos = {
  nome?: string;
  sobrenome?: string;
  email?: string;
  contato?: string;
  origem?: string;
  valor_estimado?: number;
  empresa_lead?: string;
  cnpj?: string;
  notas?: string;
  responsavel_id?: string;
  previsao_fechamento?: string;
};

/** Campos editáveis de um rascunho de projeto extraído pelo Agente de Projetos. */
export type ProjetoCampos = {
  nome?: string;
  codigo_projeto?: string;
  cliente_nome?: string;
  cliente_id?: string;
  localizacao?: string;
  valor_contrato?: number;
  prioridade?: string;
  area_m2?: number;
  data_inicio?: string;
  data_previsao?: string;
  data_final?: string;
  parcelas?: string;
  observacao?: string;
};

/** Campos de lançamento financeiro (receita/despesa). *_nome são dicas; o card resolve para *_id. */
export type ReceitaCampos = {
  descricao?: string;
  valor?: number;
  status?: string;
  data_vencimento?: string;
  data_recebimento?: string;
  forma_pagamento?: string;
  observacao?: string;
  categoria_nome?: string;
  categoria_id?: string;
  projeto_nome?: string;
  projeto_id?: string;
  cliente_nome?: string;
  cliente_id?: string;
  conta_id?: string;
  parcelas?: number;
};

export type DespesaCampos = {
  descricao?: string;
  valor?: number;
  status?: string;
  data_vencimento?: string;
  data_pagamento?: string;
  forma_pagamento?: string;
  observacao?: string;
  categoria_nome?: string;
  categoria_id?: string;
  projeto_nome?: string;
  projeto_id?: string;
  fornecedor_nome?: string;
  fornecedor_id?: string;
  conta_id?: string;
  cartao_nome?: string;
  cartao_id?: string;
  data_competencia?: string;
  parcelas?: number;
};

export type CartaoCampos = {
  nome?: string;
  limite?: number;
  dia_fechamento?: number;
  dia_vencimento?: number;
  tipo?: string;
  conta_pagamento_id?: string;
};

/** Uma linha de folha (por pessoa) enviada ao RPC de fechamento. */
export type FolhaLinhaPayload = {
  pessoa_id: string;
  salario_fixo: number;
  total_area_projetada: number;
  valor_m2: number;
  adicional_variavel: number;
  total_receber: number;
};

export type AditivoItem = { descricao?: string; disciplina?: string; horas?: number; custo?: number };

export type Entidade =
  | "lead"
  | "projeto"
  | "receita"
  | "despesa"
  | "cartao"
  | "folha"
  | "cliente"
  | "fornecedor"
  | "categoria"
  | "conta"
  | "centro_custo"
  | "pessoa"
  | "proposta"
  | "marco"
  | "disciplina"
  | "aditivo";

/** Ação sobre entidade existente (converter, marcar, quitar, pagar, convidar portal). */
export type Acao = {
  operacao: string;
  runId: string;
  custoCreditos: number;
  status: "pendente" | "feito" | "cancelado";
};
// `parcelas` colide entre projeto (string, coluna text) e financeiro (number) — normaliza para o union.
export type DraftCampos = Omit<
  LeadCampos & ProjetoCampos & ReceitaCampos & DespesaCampos & CartaoCampos,
  "parcelas"
> & {
  parcelas?: string | number;
  mes?: number;
  ano?: number;
  linhas?: FolhaLinhaPayload[];
  justificativa?: string;
  itens?: AditivoItem[];
};

const RPC_BY_ENTIDADE: Record<Entidade, string> = {
  lead: "criar_lead_agente",
  projeto: "criar_projeto_agente",
  receita: "criar_receita_agente",
  despesa: "criar_despesa_agente",
  cartao: "criar_cartao_agente",
  folha: "fechar_folha_agente",
  cliente: "criar_cliente_agente",
  fornecedor: "criar_fornecedor_agente",
  categoria: "criar_categoria_agente",
  conta: "criar_conta_agente",
  centro_custo: "criar_centro_custo_agente",
  pessoa: "criar_pessoa_agente",
  proposta: "criar_proposta_agente",
  marco: "criar_marco_agente",
  disciplina: "criar_disciplina_agente",
  aditivo: "criar_aditivo_agente",
};

const TABELA_BY_ENTIDADE: Record<Entidade, string> = {
  lead: "leads",
  projeto: "projetos",
  receita: "receitas",
  despesa: "despesas",
  cartao: "cartoes",
  folha: "folha_pagamento",
  cliente: "clientes",
  fornecedor: "fornecedores",
  categoria: "categorias_financeiras",
  conta: "contas",
  centro_custo: "centros_custo",
  pessoa: "pessoas",
  proposta: "propostas",
  marco: "marcos_faturamento",
  disciplina: "projeto_disciplinas",
  aditivo: "escopos",
};

export type Draft = {
  runId: string;
  entidade: Entidade;
  campos: DraftCampos;
  custoCreditos: number;
  status: "pendente" | "criado" | "cancelado";
  entityId?: string;
};

export type ChatMessage = {
  /** Chave estável (React keys + reidratação); não muda com a posição na lista. */
  id: string;
  role: "user" | "assistant";
  content: string;
  agentes?: AgenteMeta[];
  erro?: boolean;
  draft?: Draft;
  acao?: Acao;
};

/** Saldo de créditos de IA do mês: teto, usado e restante. Vem no payload da edge. */
export type Saldo = { usados: number; limite: number; restante: number };

type ChatResponse =
  | { sessionId: string; tipo: "resposta"; resposta: string; agentes: AgenteMeta[]; saldo?: Saldo | null }
  | {
      sessionId: string;
      tipo: "draft";
      runId: string;
      entidade: Entidade;
      campos: DraftCampos;
      custoCreditos: number;
      agentes: AgenteMeta[];
      saldo?: Saldo | null;
    }
  | {
      sessionId: string;
      tipo: "acao";
      operacao: string;
      runId: string;
      custoCreditos: number;
      agentes: AgenteMeta[];
      saldo?: Saldo | null;
    };

const STORAGE_KEY = "pilar.chat.v1";
/** Corta o loading se a edge function travar (evita spinner infinito). */
const SEND_TIMEOUT_MS = 45_000;

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const AI_CHAT_URL = `${SUPABASE_URL}/functions/v1/ai-chat`;

// Sinaliza que o SSE não pôde ser usado (não deu para abrir o stream ou veio vazio):
// quem chama cai no fluxo buffered (functions.invoke).
class StreamIndisponivel extends Error {}

/** Erro com status HTTP, para reaproveitar o mapeamento de msgErroChat (429/402/401...). */
function erroComStatus(status: number): Error {
  return Object.assign(new Error(`HTTP ${status}`), { context: { status } });
}

type SseEvento = { event: string; data: unknown };

/** Parseia um bloco de evento SSE ("event: x\ndata: {json}"). */
function parseSse(bloco: string): SseEvento | null {
  let event = "";
  const dataLinhas: string[] = [];
  for (const linha of bloco.split("\n")) {
    if (linha.startsWith("event:")) event = linha.slice(6).trim();
    else if (linha.startsWith("data:")) dataLinhas.push(linha.slice(5).trim());
  }
  if (!event) return null;
  const raw = dataLinhas.join("\n");
  try {
    return { event, data: raw ? JSON.parse(raw) : null };
  } catch {
    return null;
  }
}

type SetMessages = (updater: (prev: ChatMessage[]) => ChatMessage[]) => void;

/**
 * Envia a mensagem via SSE (fetch direto na URL da function — functions.invoke não faz
 * streaming) e renderiza o texto token-a-token. Eventos: "token" (pedaço de texto),
 * "final" (payload completo com saldo) e "error". Consulta chega em texto incremental;
 * rascunho/ação chegam só no "final". Lança StreamIndisponivel quando o SSE não pôde
 * ser usado, para o chamador cair no fluxo buffered.
 */
async function enviarStream(
  message: string,
  sessionId: string | undefined,
  signal: AbortSignal,
  cb: {
    setMessages: SetMessages;
    setSessionId: (id: string) => void;
    setSaldo: (s: Saldo) => void;
    aplicarResposta: (res: ChatResponse) => void;
  },
  projetoId?: string
): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new StreamIndisponivel("sem sessão");

  let res: Response;
  try {
    res = await fetch(AI_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
        Accept: "text/event-stream",
      },
      body: JSON.stringify({ message, sessionId, projetoId }),
      signal,
    });
  } catch (e) {
    if (signal.aborted) throw e; // cancelamento/timeout: não faz fallback buffered
    throw new StreamIndisponivel("falha ao abrir o stream");
  }

  if (!res.ok) {
    // Auth/limite: definitivo — mostra o erro (buffered daria o mesmo).
    if ([401, 402, 403, 429].includes(res.status)) throw erroComStatus(res.status);
    throw new StreamIndisponivel(`status ${res.status}`);
  }
  if (!res.body) throw new StreamIndisponivel("sem corpo no stream");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let assistantId: string | null = null;
  let recebeuToken = false;
  let finalRecebido = false;
  let erroRecebido = false;

  const appendToken = (texto: string) => {
    recebeuToken = true;
    if (!assistantId) {
      const id = novoId();
      assistantId = id;
      cb.setMessages((prev) => [...prev, { id, role: "assistant", content: texto }]);
      return;
    }
    const id = assistantId;
    cb.setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content: m.content + texto } : m)));
  };

  const processar = (ev: SseEvento) => {
    if (ev.event === "token") {
      appendToken((ev.data as { text?: string })?.text ?? "");
      return;
    }
    if (ev.event === "final") {
      finalRecebido = true;
      const payload = ev.data as ChatResponse;
      cb.setSessionId(payload.sessionId);
      if (payload.saldo) cb.setSaldo(payload.saldo);
      if (payload.tipo === "resposta") {
        // Texto já veio via tokens: finaliza o placeholder (conteúdo + agentes).
        if (!assistantId) {
          const id = novoId();
          assistantId = id;
          cb.setMessages((prev) => [
            ...prev,
            { id, role: "assistant", content: payload.resposta, agentes: payload.agentes },
          ]);
        } else {
          const id = assistantId;
          cb.setMessages((prev) =>
            prev.map((m) =>
              m.id === id ? { ...m, content: m.content || payload.resposta, agentes: payload.agentes } : m
            )
          );
        }
      } else {
        // Rascunho/ação: sem tokens — cria a mensagem-card.
        cb.aplicarResposta(payload);
      }
      return;
    }
    if (ev.event === "error") {
      erroRecebido = true;
      const texto = (ev.data as { error?: string })?.error || "Não consegui gerar a resposta.";
      if (assistantId) {
        const id = assistantId;
        cb.setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, erro: true, content: m.content || texto } : m))
        );
      } else {
        cb.setMessages((prev) => [...prev, { id: novoId(), role: "assistant", content: texto, erro: true }]);
      }
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) >= 0) {
        const bloco = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const ev = parseSse(bloco);
        if (ev) processar(ev);
      }
    }
  } catch (e) {
    // Erro de leitura sem nada recebido (e não foi cancelamento) → tenta buffered.
    if (!recebeuToken && !finalRecebido && !erroRecebido && !signal.aborted) {
      throw new StreamIndisponivel("stream interrompido sem dados");
    }
    throw e;
  }

  // Stream terminou sem entregar nada útil → cai no buffered.
  if (!finalRecebido && !erroRecebido && !recebeuToken) {
    throw new StreamIndisponivel("stream vazio");
  }
}

function novoId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `m_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

type ChatSnapshot = { sessionId?: string; messages: ChatMessage[] };

/** Lê a conversa persistida. Tolera localStorage indisponível/corrompido começando vazio. */
function carregarSnapshot(): ChatSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as ChatSnapshot;
      if (Array.isArray(s.messages)) return { sessionId: s.sessionId, messages: s.messages };
    }
  } catch {
    // modo privado / quota estourada / JSON inválido: começa do zero
  }
  return { messages: [] };
}

/**
 * Estado e envio do chat conversacional (edge function ai-chat).
 * Consulta (read-only) responde em texto; ação (criar lead) devolve um rascunho
 * que vira um card de confirmação editável — nada é gravado sem o humano aprovar.
 */
export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => carregarSnapshot().messages);
  const [sessionId, setSessionId] = useState<string | undefined>(() => carregarSnapshot().sessionId);
  const [loading, setLoading] = useState(false);
  // Saldo real de créditos de IA do mês (teto - usado), atualizado a cada resposta da edge.
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const canceladoRef = useRef(false);

  // Persiste a conversa por sessão para sobreviver a refresh (inclui os atalhos de "Desfazer").
  useEffect(() => {
    try {
      if (messages.length === 0) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId, messages }));
    } catch {
      // sem persistência disponível: segue só em memória
    }
  }, [messages, sessionId]);

  const patchDraft = useCallback((runId: string, patch: Partial<Draft>) => {
    setMessages((prev) => prev.map((m) => (m.draft?.runId === runId ? { ...m, draft: { ...m.draft, ...patch } } : m)));
  }, []);

  const patchAcao = useCallback((runId: string, patch: Partial<Acao>) => {
    setMessages((prev) => prev.map((m) => (m.acao?.runId === runId ? { ...m, acao: { ...m.acao, ...patch } } : m)));
  }, []);

  const send = useCallback(
    async (raw: string, projetoId?: string) => {
      const message = raw.trim();
      if (!message || loading) return;

      setMessages((prev) => [...prev, { id: novoId(), role: "user", content: message }]);
      setLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;
      canceladoRef.current = false;
      let porTimeout = false;
      const timeoutId = window.setTimeout(() => {
        porTimeout = true;
        controller.abort();
      }, SEND_TIMEOUT_MS);

      // Cria a mensagem-resposta a partir de um payload final (draft/ação/consulta buffered).
      const aplicarResposta = (res: ChatResponse) => {
        setSessionId(res.sessionId);
        if (res.saldo) setSaldo(res.saldo);
        if (res.tipo === "draft") {
          setMessages((prev) => [
            ...prev,
            {
              id: novoId(),
              role: "assistant",
              content: "",
              agentes: res.agentes,
              draft: {
                runId: res.runId,
                entidade: res.entidade,
                campos: res.campos,
                custoCreditos: res.custoCreditos,
                status: "pendente",
              },
            },
          ]);
        } else if (res.tipo === "acao") {
          setMessages((prev) => [
            ...prev,
            {
              id: novoId(),
              role: "assistant",
              content: "",
              agentes: res.agentes,
              acao: { operacao: res.operacao, runId: res.runId, custoCreditos: res.custoCreditos, status: "pendente" },
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            { id: novoId(), role: "assistant", content: res.resposta, agentes: res.agentes },
          ]);
        }
      };

      const tratarErro = (err: unknown) => {
        // Parada manual (botão "Parar"): encerra sem card de erro alarmante.
        if (canceladoRef.current && !porTimeout) {
          setMessages((prev) => [...prev, { id: novoId(), role: "assistant", content: "Geração interrompida." }]);
          return;
        }
        setMessages((prev) => [
          ...prev,
          { id: novoId(), role: "assistant", content: msgErroChat(err, porTimeout), erro: true },
        ]);
      };

      try {
        await enviarStream(
          message,
          sessionId,
          controller.signal,
          { setMessages, setSessionId, setSaldo, aplicarResposta },
          projetoId
        );
      } catch (e) {
        // SSE indisponível → cai no fluxo buffered atual (functions.invoke, sem streaming).
        if (e instanceof StreamIndisponivel && !canceladoRef.current) {
          try {
            const { data, error } = await supabase.functions.invoke("ai-chat", {
              body: { message, sessionId, projetoId },
              signal: controller.signal,
            });
            if (error) throw error;
            aplicarResposta(data as ChatResponse);
          } catch (e2) {
            tratarErro(e2);
          }
        } else {
          tratarErro(e);
        }
      } finally {
        clearTimeout(timeoutId);
        abortRef.current = null;
        setLoading(false);
      }
    },
    [loading, sessionId]
  );

  /** Aborta a geração em curso (liga no botão "Parar"). */
  const stop = useCallback(() => {
    if (abortRef.current) {
      canceladoRef.current = true;
      abortRef.current.abort();
    }
  }, []);

  /**
   * Persiste as edições no run e materializa a entidade via RPC (gate server-side).
   * `onAfterCreate` roda depois do RPC (ex.: gravar disciplinas do projeto) e ANTES de
   * marcar o rascunho como criado — se lançar, o rascunho não vira "criado".
   */
  const confirmarDraft = useCallback(
    async (
      runId: string,
      entidade: Entidade,
      campos: DraftCampos,
      onAfterCreate?: (entityId: string) => Promise<void>
    ) => {
      const { error: upErr } = await supabase.from("agent_runs").update({ result: campos }).eq("id", runId);
      if (upErr) throw upErr;

      const rpcName = RPC_BY_ENTIDADE[entidade] as Parameters<typeof supabase.rpc>[0];
      const { data, error } = await supabase.rpc(rpcName, { p_run_id: runId });
      if (error) throw error;

      const res = data as {
        lead_id?: string;
        projeto_id?: string;
        receita_id?: string;
        despesa_id?: string;
        cartao_id?: string;
        grupo_id?: string;
      } | null;
      const entityId =
        res?.grupo_id ?? res?.projeto_id ?? res?.lead_id ?? res?.receita_id ?? res?.despesa_id ?? res?.cartao_id;
      if (entityId && onAfterCreate) await onAfterCreate(entityId);
      patchDraft(runId, { status: "criado", campos, entityId });
      return entityId;
    },
    [patchDraft]
  );

  const cancelarDraft = useCallback(
    async (runId: string) => {
      await supabase.from("agent_runs").update({ status: "rejected" }).eq("id", runId);
      patchDraft(runId, { status: "cancelado" });
    },
    [patchDraft]
  );

  /**
   * Desfaz uma entidade recém-criada: soft-delete + marca o run como rejeitado.
   * `porGrupo` (parcelado): apaga todas as parcelas do grupo (entityId = grupo_parcela).
   */
  const desfazer = useCallback(
    async (runId: string, entidade: Entidade, entityId: string, porGrupo = false) => {
      const table = TABELA_BY_ENTIDADE[entidade] as Parameters<typeof supabase.from>[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = supabase.from(table).update({ deleted_at: new Date().toISOString() } as never) as any;
      const { error } = await (porGrupo ? q.eq("grupo_parcela", entityId) : q.eq("id", entityId));
      if (error) throw error;
      await supabase.from("agent_runs").update({ status: "rejected" }).eq("id", runId);
      patchDraft(runId, { status: "cancelado" });
    },
    [patchDraft]
  );

  /**
   * Desfaz um fechamento de folha apagando EXATAMENTE as linhas criadas por esta run
   * (ids gravados pelo RPC em result.linhas_ids) — sem tocar em linhas pré-existentes do mês.
   * Fallback (runs antigas sem linhas_ids): remove as pendentes do mês.
   */
  const desfazerFolha = useCallback(
    async (runId: string, mes: number, ano: number) => {
      const { data: run } = await supabase.from("agent_runs").select("result").eq("id", runId).single();
      const ids = (run?.result as { linhas_ids?: string[] } | null)?.linhas_ids;
      if (ids && ids.length > 0) {
        const { error } = await supabase.from("folha_pagamento").delete().in("id", ids);
        if (error) throw error;
      } else {
        const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
        const { error } = await supabase
          .from("folha_pagamento")
          .delete()
          .eq("empresa_id", empresaId ?? "")
          .eq("mes", mes)
          .eq("ano", ano)
          .eq("status", "pendente");
        if (error) throw error;
      }
      await supabase.from("agent_runs").update({ status: "rejected" }).eq("id", runId);
      patchDraft(runId, { status: "cancelado" });
    },
    [patchDraft]
  );

  /**
   * Executa uma ação sobre entidade existente. `payload` traz o alvo escolhido no card.
   * convidar_portal usa a edge function (gera senha + e-mail); o resto vai pelo dispatcher gated.
   */
  const executarAcao = useCallback(
    async (runId: string, operacao: string, payload: Record<string, unknown>) => {
      if (operacao === "convidar_portal") {
        const { error } = await supabase.functions.invoke("invite-cliente-portal", {
          body: { cliente_id: payload.cliente_id, email: payload.email },
        });
        if (error) throw error;
        await supabase
          .from("agent_runs")
          .update({ status: "executed", entity_type: "convidar_portal" })
          .eq("id", runId);
      } else {
        const { error: upErr } = await supabase
          .from("agent_runs")
          .update({ result: { acao: operacao, ...payload } })
          .eq("id", runId);
        if (upErr) throw upErr;
        const { error } = await supabase.rpc("executar_acao_agente", { p_run_id: runId });
        if (error) throw error;
      }
      patchAcao(runId, { status: "feito" });
    },
    [patchAcao]
  );

  const cancelarAcao = useCallback(
    async (runId: string) => {
      await supabase.from("agent_runs").update({ status: "rejected" }).eq("id", runId);
      patchAcao(runId, { status: "cancelado" });
    },
    [patchAcao]
  );

  const reset = useCallback(() => {
    if (loading) return;
    setMessages([]);
    setSessionId(undefined);
  }, [loading]);

  // Créditos de IA debitados nesta conversa (só o que foi de fato criado/executado).
  const creditosUsados = messages.reduce((total, m) => {
    if (m.draft?.status === "criado") return total + (m.draft.custoCreditos ?? 0);
    if (m.acao?.status === "feito") return total + (m.acao.custoCreditos ?? 0);
    return total;
  }, 0);

  return {
    messages,
    send,
    stop,
    loading,
    reset,
    creditosUsados,
    saldo,
    confirmarDraft,
    cancelarDraft,
    desfazer,
    desfazerFolha,
    executarAcao,
    cancelarAcao,
  };
}
