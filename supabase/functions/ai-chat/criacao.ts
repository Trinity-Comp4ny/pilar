import { jsonResponse } from "../_shared/cors.ts";
import { callGeminiStructured, modeloEmUso } from "../_shared/ai-client.ts";
import { z } from "../_shared/schemas.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { comContexto, sha256Hex } from "./contexto.ts";
import { recordAndSaldo, respondFinal } from "./resposta.ts";
import { FEATURE_KEY } from "./schemas.ts";

// Fluxo genérico de criação (extrair → perguntar se faltar nome → rascunho editável).
// Reutilizado por lead e projeto; novas entidades só passam schema/prompt/labels.
export type ExtracaoBase = { tem_nome: boolean; pergunta?: string | null; [k: string]: unknown };

export async function processarCriacao(o: {
  db: SupabaseClient;
  admin: SupabaseClient;
  req: Request;
  wantsStream: boolean;
  sessionId: string;
  empresaId: string;
  userId: string;
  historico: string;
  message: string;
  motivo: string;
  rotaTok: { in: number; out: number; calls: number };
  agente: string;
  label: string;
  entidade: string;
  agentType: string;
  entityKey: string;
  prompt: string;
  schema: z.ZodType<ExtracaoBase>;
  requiredKeys: string[];
  instrucao: string;
  perguntaFallback: string;
  revisarMsg: string;
}): Promise<Response> {
  const extr = await callGeminiStructured(
    {
      systemPrompt: o.prompt,
      userMessage: comContexto(o.historico, o.message, o.instrucao),
      empresaId: o.empresaId,
      tipo: FEATURE_KEY,
      conversationId: o.sessionId,
    },
    o.schema
  );
  const tokIn = o.rotaTok.in + extr.tokensEntrada;
  const tokOut = o.rotaTok.out + extr.tokensSaida;
  const chamadas = o.rotaTok.calls + extr.attempts;
  const dados = extr.data;
  const entidadeObj = (dados[o.entityKey] ?? {}) as Record<string, unknown>;

  // Faltando campo obrigatório → pergunta ao usuário (não cria rascunho).
  const faltaObrigatorio = o.requiredKeys.some((k) => {
    const v = entidadeObj[k];
    return v === null || v === undefined || String(v).trim() === "";
  });
  if (!dados.tem_nome || faltaObrigatorio) {
    const pergunta = (dados.pergunta ?? "").toString().trim() || o.perguntaFallback;
    await o.db.from("chat_messages").insert({
      session_id: o.sessionId,
      role: "assistant",
      content: pergunta,
      meta: { agente: o.agente, agente_label: o.label, model: modeloEmUso(FEATURE_KEY) },
      tokens_input: tokIn,
      tokens_output: tokOut,
    });
    const saldo = await recordAndSaldo(o.admin, o.empresaId, o.userId, undefined, tokIn, tokOut, chamadas);
    return respondFinal(
      {
        sessionId: o.sessionId,
        tipo: "resposta",
        resposta: pergunta,
        agentes: [{ agente: o.agente, agente_label: o.label }],
        saldo,
      },
      o.req,
      o.wantsStream
    );
  }

  // Remove null/vazio que o Gemini devolve para campos não preenchidos.
  const campos = Object.fromEntries(
    Object.entries(entidadeObj).filter(([, v]) => v !== null && v !== undefined && v !== "")
  );
  const idempotencyKey = `${o.entidade}:${o.sessionId}:${await sha256Hex(o.message)}`;

  // Dedupe: o mesmo pedido reenviado devolve o rascunho existente, não cria outro.
  const { data: existente } = await o.db
    .from("agent_runs")
    .select("id, status")
    .eq("empresa_id", o.empresaId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  let runId: string;
  if (existente?.id && existente.status === "pending_review") {
    runId = existente.id as string;
  } else {
    const { data: run, error: runErr } = await o.db
      .from("agent_runs")
      .insert({
        empresa_id: o.empresaId,
        agent_type: o.agentType,
        status: "pending_review",
        entity_type: o.entidade,
        input: { message: o.message },
        result: campos,
        idempotency_key: idempotencyKey,
        model: modeloEmUso(FEATURE_KEY),
        tokens_input: tokIn,
        tokens_output: tokOut,
        created_by: o.userId,
      })
      .select("id")
      .single();
    if (runErr || !run) return jsonResponse({ error: "Falha ao preparar o rascunho" }, 500, o.req);
    runId = run.id as string;
    await o.db
      .from("agent_actions")
      .insert({ run_id: runId, tool_name: `extrair_${o.entidade}`, args: { message: o.message }, result: campos });
  }

  // Marca a mensagem no chat (o card editável é renderizado no front a partir do draft).
  await o.db.from("chat_messages").insert({
    session_id: o.sessionId,
    role: "assistant",
    content: o.revisarMsg,
    meta: {
      agente: o.agente,
      agente_label: o.label,
      model: modeloEmUso(FEATURE_KEY),
      draft_run_id: runId,
      entity_type: o.entidade,
    },
    tokens_input: tokIn,
    tokens_output: tokOut,
  });
  const saldo = await recordAndSaldo(o.admin, o.empresaId, o.userId, runId, tokIn, tokOut, chamadas);

  return respondFinal(
    {
      sessionId: o.sessionId,
      tipo: "draft",
      runId,
      entidade: o.entidade,
      campos,
      custoCreditos: 1,
      agentes: [{ agente: o.agente, agente_label: o.label, motivo: o.motivo }],
      saldo,
    },
    o.req,
    o.wantsStream
  );
}
