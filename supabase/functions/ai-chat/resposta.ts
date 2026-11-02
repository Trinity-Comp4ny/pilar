import { getCorsHeaders, SECURITY_HEADERS, jsonResponse } from "../_shared/cors.ts";
import { debitarTokens, getAiSaldo, modeloEmUso } from "../_shared/ai-client.ts";
import type { AiSaldo } from "../_shared/ai-client.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AGENTE_LABEL, Agente, FEATURE_KEY } from "./schemas.ts";

// ---------------------------------------------------------------------------
// Resposta em linguagem natural (por domínio)
// ---------------------------------------------------------------------------
// Regras de forma que valem para toda resposta de consulta (SPEC 147).
export const REGRAS_RESPOSTA = `Valores no formato R$ 1.234,56 e datas em dd/mm/aaaa.
Se os dados não permitirem responder, diga isso com honestidade e sugira o que o usuário pode registrar. Não invente números nem registros.
Seja conciso e vá direto ao ponto, sem explicar como os dados foram consultados.
Quando os dados trouxerem uma lista, mostre um item por linha, o mais urgente primeiro, com o prazo ou os dias de atraso. Se "total" for maior que "mostrando", diga "mostrando X de Y".
Cite cada registro com link em markdown usando o campo "link" dos dados, por exemplo [Parcela 2 do Projeto X](/projetos/abc). Nunca invente um link que não esteja nos dados.
Se algum dado de valor não veio porque o perfil de quem pergunta não vê dinheiro, diga isso em vez de omitir em silêncio.
Se um item trouxer "acao_sugerida" ou for uma pendência, feche com uma frase oferecendo o próximo passo (por exemplo: "Se quiser, marco como recebida: é só pedir.").`;

export function respostaPrompt(agente: Agente): string {
  const base = `Você é o ${AGENTE_LABEL[agente]} do Pilar, um copiloto para escritórios de engenharia.
Responda à pergunta do usuário de forma direta, clara e em português do Brasil, usando SOMENTE os dados fornecidos.
${REGRAS_RESPOSTA}
Responda APENAS em JSON no formato {"resposta": "<texto>"}.`;
  if (agente === "geral") {
    return `${base}
Você pode ajudar com: finanças (receitas, despesas, lucro do mês), projetos (status, quantos ativos), comercial (propostas, leads), obras (RDO, clima, efetivo, atraso) e equipe (pessoas, cargos). Oriente o usuário sobre isso quando fizer sentido.`;
  }
  return base;
}

// Variante do prompt de resposta para o modo STREAMING: pede TEXTO PURO (sem JSON),
// para que o token-a-token chegue como prosa legível ao usuário.
export function respostaPromptStream(agente: Agente): string {
  const base = `Você é o ${AGENTE_LABEL[agente]} do Pilar, um copiloto para escritórios de engenharia.
Responda à pergunta do usuário em TEXTO PURO (sem JSON, sem blocos de código), de forma direta, clara e em português do Brasil, usando SOMENTE os dados fornecidos.
${REGRAS_RESPOSTA}`;
  if (agente === "geral") {
    return `${base}
Você pode ajudar com: finanças (receitas, despesas, lucro do mês), projetos (status, quantos ativos), comercial (propostas, leads), obras (RDO, clima, efetivo, atraso) e equipe (pessoas, cargos). Oriente o usuário sobre isso quando fizer sentido.`;
  }
  return base;
}

// ---------------------------------------------------------------------------
// SSE — entrega via text/event-stream
// ---------------------------------------------------------------------------
export function sseHeaders(req: Request): Record<string, string> {
  return {
    ...getCorsHeaders(req),
    ...SECURITY_HEADERS,
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    // Evita buffering em proxies (mantém o stream saindo em tempo real).
    "X-Accel-Buffering": "no",
  };
}

// Serializa um evento SSE ("event: <nome>\ndata: <json>\n\n").
export function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// Resposta SSE de um único evento "final" — para os fluxos sem texto incremental
// (rascunho, ação, pergunta de campo faltante, aviso). O client trata igual ao stream.
export function sseFinal(payload: Record<string, unknown>, req: Request): Response {
  return new Response(sseEvent("final", payload), { headers: sseHeaders(req) });
}

// Entrega o payload como SSE (single "final") quando o client pediu stream, ou como JSON.
export function respondFinal(payload: Record<string, unknown>, req: Request, wantsStream: boolean): Response {
  return wantsStream ? sseFinal(payload, req) : jsonResponse(payload, 200, req);
}

// Debita o uso no ledger de tokens (fonte única, ADR 0035) e devolve o saldo restante.
// Cada turno termina em EXATAMENTE um chamador deste helper → um débito por turno.
// debitarTokens nunca lança (reporta ao Sentry por dentro); a leitura do saldo é best-effort.
export async function recordAndSaldo(
  admin: SupabaseClient,
  empresaId: string,
  userId: string | null,
  runId: string | undefined,
  tokIn: number,
  tokOut: number,
  calls: number
): Promise<AiSaldo | null> {
  await debitarTokens(admin, {
    empresaId,
    userId,
    agentKey: FEATURE_KEY,
    agentRunId: runId ?? null,
    model: modeloEmUso(FEATURE_KEY),
    tokensInput: tokIn,
    tokensOutput: tokOut,
    idempotencyKey: crypto.randomUUID(),
    calls,
  });
  try {
    return await getAiSaldo(admin, empresaId);
  } catch {
    return null;
  }
}

// Registra um passo do raciocínio do agente em agent_actions (timeline do modal, spec 007
// Fase 2b). Best-effort: logar um passo NUNCA pode quebrar o fluxo do usuário — falha é
// engolida. Sem runId (ex.: fluxo que não persistiu run) vira no-op.
export async function logAction(
  db: SupabaseClient,
  runId: string | undefined,
  toolName: string,
  args?: Record<string, unknown>,
  result?: Record<string, unknown>
): Promise<void> {
  if (!runId) return;
  try {
    await db
      .from("agent_actions")
      .insert({ run_id: runId, tool_name: toolName, args: args ?? null, result: result ?? null });
  } catch {
    // best-effort — não bloqueia a resposta
  }
}
