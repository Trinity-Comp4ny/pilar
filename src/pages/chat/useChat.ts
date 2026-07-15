import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  | "lead" | "projeto" | "receita" | "despesa" | "cartao" | "folha"
  | "cliente" | "fornecedor" | "categoria" | "conta" | "centro_custo" | "pessoa" | "proposta" | "marco" | "disciplina" | "aditivo";

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
  role: "user" | "assistant";
  content: string;
  agentes?: AgenteMeta[];
  erro?: boolean;
  draft?: Draft;
  acao?: Acao;
};

type ChatResponse =
  | { sessionId: string; tipo: "resposta"; resposta: string; agentes: AgenteMeta[] }
  | {
      sessionId: string;
      tipo: "draft";
      runId: string;
      entidade: Entidade;
      campos: DraftCampos;
      custoCreditos: number;
      agentes: AgenteMeta[];
    }
  | {
      sessionId: string;
      tipo: "acao";
      operacao: string;
      runId: string;
      custoCreditos: number;
      agentes: AgenteMeta[];
    };

/**
 * Estado e envio do chat conversacional (edge function ai-chat).
 * Consulta (read-only) responde em texto; ação (criar lead) devolve um rascunho
 * que vira um card de confirmação editável — nada é gravado sem o humano aprovar.
 */
export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const patchDraft = useCallback((index: number, patch: Partial<Draft>) => {
    setMessages((prev) =>
      prev.map((m, i) => (i === index && m.draft ? { ...m, draft: { ...m.draft, ...patch } } : m))
    );
  }, []);

  const patchAcao = useCallback((index: number, patch: Partial<Acao>) => {
    setMessages((prev) =>
      prev.map((m, i) => (i === index && m.acao ? { ...m, acao: { ...m.acao, ...patch } } : m))
    );
  }, []);

  const send = useCallback(
    async (raw: string) => {
      const message = raw.trim();
      if (!message || loading) return;

      setMessages((prev) => [...prev, { role: "user", content: message }]);
      setLoading(true);

      try {
        const { data, error } = await supabase.functions.invoke("ai-chat", {
          body: { message, sessionId },
        });
        if (error) throw error;

        const res = data as ChatResponse;
        setSessionId(res.sessionId);

        if (res.tipo === "draft") {
          setMessages((prev) => [
            ...prev,
            {
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
              role: "assistant",
              content: "",
              agentes: res.agentes,
              acao: { operacao: res.operacao, runId: res.runId, custoCreditos: res.custoCreditos, status: "pendente" },
            },
          ]);
        } else {
          setMessages((prev) => [...prev, { role: "assistant", content: res.resposta, agentes: res.agentes }]);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Não consegui processar agora. Tente reformular ou tente de novo em instantes.",
            erro: true,
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, sessionId]
  );

  /**
   * Persiste as edições no run e materializa a entidade via RPC (gate server-side).
   * `onAfterCreate` roda depois do RPC (ex.: gravar disciplinas do projeto) e ANTES de
   * marcar o rascunho como criado — se lançar, o rascunho não vira "criado".
   */
  const confirmarDraft = useCallback(
    async (
      index: number,
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

      const res = data as
        | {
            lead_id?: string;
            projeto_id?: string;
            receita_id?: string;
            despesa_id?: string;
            cartao_id?: string;
            grupo_id?: string;
          }
        | null;
      const entityId =
        res?.grupo_id ??
        res?.projeto_id ??
        res?.lead_id ??
        res?.receita_id ??
        res?.despesa_id ??
        res?.cartao_id;
      if (entityId && onAfterCreate) await onAfterCreate(entityId);
      patchDraft(index, { status: "criado", campos, entityId });
      return entityId;
    },
    [patchDraft]
  );

  const cancelarDraft = useCallback(
    async (index: number, runId: string) => {
      await supabase.from("agent_runs").update({ status: "rejected" }).eq("id", runId);
      patchDraft(index, { status: "cancelado" });
    },
    [patchDraft]
  );

  /**
   * Desfaz uma entidade recém-criada: soft-delete + marca o run como rejeitado.
   * `porGrupo` (parcelado): apaga todas as parcelas do grupo (entityId = grupo_parcela).
   */
  const desfazer = useCallback(
    async (index: number, runId: string, entidade: Entidade, entityId: string, porGrupo = false) => {
      const table = TABELA_BY_ENTIDADE[entidade] as Parameters<typeof supabase.from>[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = supabase.from(table).update({ deleted_at: new Date().toISOString() } as any);
      const { error } = await (porGrupo ? q.eq("grupo_parcela", entityId) : q.eq("id", entityId));
      if (error) throw error;
      await supabase.from("agent_runs").update({ status: "rejected" }).eq("id", runId);
      patchDraft(index, { status: "cancelado" });
    },
    [patchDraft]
  );

  /**
   * Desfaz um fechamento de folha apagando EXATAMENTE as linhas criadas por esta run
   * (ids gravados pelo RPC em result.linhas_ids) — sem tocar em linhas pré-existentes do mês.
   * Fallback (runs antigas sem linhas_ids): remove as pendentes do mês.
   */
  const desfazerFolha = useCallback(
    async (index: number, runId: string, mes: number, ano: number) => {
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
      patchDraft(index, { status: "cancelado" });
    },
    [patchDraft]
  );

  /**
   * Executa uma ação sobre entidade existente. `payload` traz o alvo escolhido no card.
   * convidar_portal usa a edge function (gera senha + e-mail); o resto vai pelo dispatcher gated.
   */
  const executarAcao = useCallback(
    async (index: number, runId: string, operacao: string, payload: Record<string, unknown>) => {
      if (operacao === "convidar_portal") {
        const { error } = await supabase.functions.invoke("invite-cliente-portal", {
          body: { cliente_id: payload.cliente_id, email: payload.email },
        });
        if (error) throw error;
        await supabase.from("agent_runs").update({ status: "executed", entity_type: "convidar_portal" }).eq("id", runId);
      } else {
        const { error: upErr } = await supabase
          .from("agent_runs")
          .update({ result: { acao: operacao, ...payload } })
          .eq("id", runId);
        if (upErr) throw upErr;
        const { error } = await supabase.rpc("executar_acao_agente", { p_run_id: runId });
        if (error) throw error;
      }
      patchAcao(index, { status: "feito" });
    },
    [patchAcao]
  );

  const cancelarAcao = useCallback(
    async (index: number, runId: string) => {
      await supabase.from("agent_runs").update({ status: "rejected" }).eq("id", runId);
      patchAcao(index, { status: "cancelado" });
    },
    [patchAcao]
  );

  const reset = useCallback(() => {
    if (loading) return;
    setMessages([]);
    setSessionId(undefined);
  }, [loading]);

  return {
    messages, send, loading, reset,
    confirmarDraft, cancelarDraft, desfazer, desfazerFolha,
    executarAcao, cancelarAcao,
  };
}
