import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "./schemas.ts";
import { captureException, recordGenAiSpan, recordMetric, scrub } from "./sentry.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
export const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
// streamGenerateContent + alt=sse: cada chunk chega como um evento SSE ("data: {json}\n\n").
const GEMINI_STREAM_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`;

// Timeouts do Gemini. Cada chamada tem um teto próprio (AbortController); o orçamento
// total limita a soma das tentativas (retry) para não estourar o wall-clock da edge.
const GEMINI_CALL_TIMEOUT_MS = 30_000;
const GEMINI_TOTAL_BUDGET_MS = 55_000;

// Janela curta de rate limit: trava rajadas/loops (ex.: agente em retry) além do teto mensal.
const SHORT_WINDOW_SECONDS = 60;
const SHORT_WINDOW_MAX_CALLS = 30;

export interface AiRequest {
  systemPrompt: string;
  userMessage: string;
  empresaId: string;
  tipo: string;
  referenciaId?: string;
  referenciaTipo?: string;
  mesReferencia?: number;
  anoReferencia?: number;
  // Anexos multimodais (PDF/imagem em base64) enviados junto do prompt.
  // Usado no import de orçamento por IA (spec 023). Vazio/ausente = texto puro.
  files?: Array<{ mimeType: string; dataBase64: string }>;
  // ID de conversa (thread), vira gen_ai.conversation.id nos spans (Conversations do
  // Sentry, ADR 0027). Só populado por fluxos multi-turno (ex.: ai-chat com sessionId).
  conversationId?: string;
}

export interface AiResponse {
  conteudo: Record<string, unknown>;
  resumo: string;
  tokensEntrada: number;
  tokensSaida: number;
}

interface GeminiCandidate {
  content?: {
    parts?: Array<{ text?: string }>;
  };
}

interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
}

interface GeminiApiResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiUsageMetadata;
}

/**
 * Anti-rajada: barra loop/burst (30 chamadas/60s) por empresa. Responde 429.
 * O teto mensal por REQUESTS morreu na Fase 2 (spec 075): a cota agora é de
 * tokens, aplicada por verificarTokens() (402).
 */
export async function checkRateLimit(supabaseAdmin: SupabaseClient, empresaId: string): Promise<boolean> {
  const desde = new Date(Date.now() - SHORT_WINDOW_SECONDS * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from("ai_token_ledger")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .eq("source", "usage")
    .gte("created_at", desde);
  return (count ?? 0) < SHORT_WINDOW_MAX_CALLS;
}

export interface AiSaldo {
  tokens_plano: number;
  tokens_comprado: number;
  tokens_restantes: number;
}

/**
 * Motivo do bloqueio (spec 094): `saldo_empresa` = pool da empresa zerado (mensagem
 * atual, comprar pacote/aguardar renovação); `limite_usuario` = teto pessoal batido
 * com saldo de empresa ainda disponível (mensagem nova, pedir mais ao admin).
 * `gate_tokens` já resolve a prioridade (saldo_empresa vence quando os dois estouram
 * juntos): o front só troca a mensagem por este campo, não recalcula nada.
 */
export type TokenBlockMotivo = "saldo_empresa" | "limite_usuario";

/**
 * Gate de tokens (Fase 2, spec 075; extensão por usuário na spec 094): garante a
 * concessão do ciclo corrente via RPC gate_tokens (idempotente por mês; cobre a
 * virada de ciclo on-demand, sem depender de cron) e devolve o saldo. `ok=false` =
 * responder 402 ANTES de chamar o modelo. `userId` é opcional: sem ele (ou para
 * quem nunca configurou teto pessoal), o gate por usuário é um no-op no banco —
 * zero custo extra no hot path.
 *
 * Falha de infra aqui NÃO bloqueia o usuário (fail-open consciente: melhor deixar
 * passar uma chamada do que travar a IA inteira por erro de RPC), mas é reportada
 * ao Sentry — nunca silenciosa.
 */
export async function verificarTokens(
  supabaseAdmin: SupabaseClient,
  empresaId: string,
  userId?: string | null
): Promise<{ ok: boolean; saldo: AiSaldo | null; motivo: TokenBlockMotivo | null }> {
  try {
    const { data, error } = await supabaseAdmin.rpc("gate_tokens", {
      p_empresa_id: empresaId,
      p_user_id: userId ?? null,
    });
    if (error) {
      throw new Error(`gate_tokens falhou: ${error.message}`);
    }
    const row = (
      data as Array<{ saldo_plano: number; saldo_comprado: number; bloqueado_motivo: TokenBlockMotivo | null }> | null
    )?.[0];
    if (!row) return { ok: true, saldo: null, motivo: null };
    const saldo: AiSaldo = {
      tokens_plano: Number(row.saldo_plano),
      tokens_comprado: Number(row.saldo_comprado),
      tokens_restantes: Number(row.saldo_plano) + Number(row.saldo_comprado),
    };
    const motivo = row.bloqueado_motivo ?? null;
    return { ok: motivo === null, saldo, motivo };
  } catch (e) {
    await captureException(e, { fn: "verificarTokens", tags: { empresa_id: empresaId } });
    return { ok: true, saldo: null, motivo: null };
  }
}

/**
 * Mensagem de bloqueio 402, uma fonte só para as edge functions que chamam
 * verificarTokens (evita 4 cópias divergindo entre si). Diz o que houve + o
 * próximo passo, sem culpar o usuário (padrão de mensagem de erro da casa).
 */
export function mensagemBloqueioTokens(motivo: TokenBlockMotivo): string {
  if (motivo === "limite_usuario") {
    return "Você atingiu seu limite de tokens de IA deste mês. Peça mais tokens ao administrador da sua empresa.";
  }
  return "Os tokens de IA da empresa acabaram neste ciclo. Aguarde a renovação ou fale com o administrador.";
}

/**
 * Saldo de tokens da empresa (leitura direta do cache ai_token_saldo, sem conceder
 * ciclo). Para o chip do chat e afins; o gate de bloqueio é verificarTokens().
 */
export async function getAiSaldo(supabaseAdmin: SupabaseClient, empresaId: string): Promise<AiSaldo> {
  const { data } = await supabaseAdmin
    .from("ai_token_saldo")
    .select("saldo_plano, saldo_comprado")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  const row = data as { saldo_plano: number; saldo_comprado: number } | null;
  const plano = Number(row?.saldo_plano ?? 0);
  const comprado = Number(row?.saldo_comprado ?? 0);
  return { tokens_plano: plano, tokens_comprado: comprado, tokens_restantes: plano + comprado };
}

export interface DebitarTokensParams {
  empresaId: string;
  userId: string | null;
  agentKey: string;
  agentRunId?: string | null;
  model: string;
  tokensInput: number;
  tokensOutput: number;
  // Dedupe de retry: a mesma key da mesma empresa nunca gera dois débitos.
  idempotencyKey: string;
  // Nº REAL de chamadas ao Gemini no turno (retries contam) — só telemetria Sentry.
  calls?: number;
}

/**
 * Único caminho de escrita de uso de token (ADR 0035): debita no ledger via RPC
 * debitar_tokens, que insere a linha e o trigger atualiza o saldo em cascata
 * (plano → comprado) na mesma transação. Shadow mode: falha aqui NUNCA quebra a
 * resposta ao usuário, mas é reportada ao Sentry — nunca silenciosa (spec 074, req 6).
 */
export async function debitarTokens(supabaseAdmin: SupabaseClient, params: DebitarTokensParams): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin.rpc("debitar_tokens", {
      p_empresa_id: params.empresaId,
      p_user_id: params.userId,
      p_agent_key: params.agentKey,
      p_agent_run_id: params.agentRunId ?? null,
      p_model: params.model,
      p_tokens_input: params.tokensInput,
      p_tokens_output: params.tokensOutput,
      p_idempotency_key: params.idempotencyKey,
    });
    if (error) {
      throw new Error(`debitar_tokens falhou: ${error.message}`);
    }
    const row = (data as Array<{ custo_estimado: number | null }> | null)?.[0];
    if (row && row.custo_estimado === null && params.tokensInput + params.tokensOutput > 0) {
      await captureException(new Error(`Modelo sem preço em ai_model_precos: ${params.model}`), {
        fn: "debitarTokens",
        tags: { empresa_id: params.empresaId, agent_key: params.agentKey },
      });
    }
  } catch (e) {
    await captureException(e, {
      fn: "debitarTokens",
      tags: { empresa_id: params.empresaId, agent_key: params.agentKey },
    });
  }

  recordMetric("ai.calls", params.calls ?? 1, { tags: { empresa_id: params.empresaId, feature: params.agentKey } });
  recordMetric("ai.tokens_input", params.tokensInput, { type: "distribution", tags: { feature: params.agentKey } });
  recordMetric("ai.tokens_output", params.tokensOutput, { type: "distribution", tags: { feature: params.agentKey } });
}

/**
 * Span gen_ai.chat de uma chamada ao Gemini (dashboard Insights > Agents do Sentry).
 * Inclui input.messages/output.messages (replay de conversa, ADR 0027) passados por
 * scrub(): trade-off aceito conscientemente de mandar conteúdo pro Sentry.
 */
function recordGeminiChatSpan(params: {
  startMs: number;
  status: "ok" | "error";
  tokensEntrada?: number;
  tokensSaida?: number;
  inputMessages?: Array<{ role: string; content: string }>;
  outputText?: string;
  conversationId?: string;
  empresaId?: string;
}): void {
  recordGenAiSpan({
    op: "gen_ai.chat",
    name: `chat ${GEMINI_MODEL}`,
    startMs: params.startMs,
    endMs: Date.now(),
    status: params.status,
    attributes: {
      "gen_ai.operation.name": "chat",
      "gen_ai.provider.name": "gemini",
      "gen_ai.request.model": GEMINI_MODEL,
      ...(params.conversationId && { "gen_ai.conversation.id": params.conversationId }),
      ...(params.empresaId && { "pilar.empresa_id": params.empresaId }),
      ...(params.inputMessages && { "gen_ai.input.messages": scrub(params.inputMessages) }),
      ...(params.status === "ok" && {
        "gen_ai.response.model": GEMINI_MODEL,
        "gen_ai.usage.input_tokens": params.tokensEntrada ?? 0,
        "gen_ai.usage.output_tokens": params.tokensSaida ?? 0,
        ...(params.outputText !== undefined && {
          "gen_ai.output.messages": scrub([{ role: "assistant", content: params.outputText }]),
        }),
      }),
    },
  });
}

/**
 * Chamada bruta ao Gemini. Retorna o texto cru + tokens, sem parsear nem validar.
 * Base compartilhada por callGemini (legado) e callGeminiStructured.
 */
async function fetchGeminiRaw(
  systemPrompt: string,
  userMessage: string,
  opts: {
    deadline?: number;
    files?: Array<{ mimeType: string; dataBase64: string }>;
    maxOutputTokens?: number;
    conversationId?: string;
    empresaId?: string;
  } = {}
): Promise<{ text: string; tokensEntrada: number; tokensSaida: number }> {
  const spanStartMs = Date.now();
  // Mensagens pro span gen_ai (Insights > Agents): só o texto, nunca os anexos base64.
  const inputMessages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];
  // Multimodal: cada arquivo vira uma part inline_data (base64) junto do texto.
  const userParts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }> = [
    { text: userMessage },
  ];
  for (const f of opts.files ?? []) {
    userParts.push({ inline_data: { mime_type: f.mimeType, data: f.dataBase64 } });
  }

  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: "user",
        parts: userParts,
      },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: opts.maxOutputTokens ?? 4096,
      responseMimeType: "application/json",
    },
  };

  // Teto desta chamada: o menor entre o limite por chamada e o que resta do orçamento total.
  const restante = opts.deadline ? opts.deadline - Date.now() : GEMINI_CALL_TIMEOUT_MS;
  const timeoutMs = Math.min(GEMINI_CALL_TIMEOUT_MS, restante);
  if (timeoutMs <= 0) {
    throw new Error("Orçamento de tempo do Gemini esgotado antes da chamada");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    recordGeminiChatSpan({
      startMs: spanStartMs,
      status: "error",
      inputMessages,
      conversationId: opts.conversationId,
      empresaId: opts.empresaId,
    });
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error(`Gemini API timeout após ${timeoutMs}ms`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    recordGeminiChatSpan({
      startMs: spanStartMs,
      status: "error",
      inputMessages,
      conversationId: opts.conversationId,
      empresaId: opts.empresaId,
    });
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const result: GeminiApiResponse = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  const usage = result.usageMetadata || {};
  const tokensEntrada = usage.promptTokenCount || 0;
  const tokensSaida = usage.candidatesTokenCount || 0;
  recordGeminiChatSpan({
    startMs: spanStartMs,
    status: "ok",
    tokensEntrada,
    tokensSaida,
    inputMessages,
    outputText: text,
    conversationId: opts.conversationId,
    empresaId: opts.empresaId,
  });
  return { text, tokensEntrada, tokensSaida };
}

export interface GeminiStreamUsage {
  tokensEntrada: number;
  tokensSaida: number;
}

/**
 * Chama o Gemini em modo STREAMING (streamGenerateContent) e emite o texto em pedaços,
 * conforme o modelo gera. Devolve, no retorno do generator, a contagem de tokens (a
 * usageMetadata só chega, cumulativa, nos chunks finais).
 *
 * Saída em TEXTO PURO (sem responseMimeType JSON) — pensada para a etapa de resposta
 * em linguagem natural do chat, onde o token-a-token dá feedback incremental ao usuário.
 * Fluxos que gravam no banco continuam em callGeminiStructured (validação + retry).
 */
export async function* streamGeminiText(
  systemPrompt: string,
  userMessage: string,
  opts: { deadline?: number; conversationId?: string; empresaId?: string } = {}
): AsyncGenerator<string, GeminiStreamUsage, unknown> {
  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userMessage }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096,
    },
  };

  const restante = opts.deadline ? opts.deadline - Date.now() : GEMINI_CALL_TIMEOUT_MS;
  const timeoutMs = Math.min(GEMINI_CALL_TIMEOUT_MS, restante);
  if (timeoutMs <= 0) {
    throw new Error("Orçamento de tempo do Gemini esgotado antes da chamada");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let tokensEntrada = 0;
  let tokensSaida = 0;
  let outputText = "";
  const spanStartMs = Date.now();
  let spanStatus: "ok" | "error" = "ok";
  const inputMessages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  try {
    let response: Response;
    try {
      response = await fetch(GEMINI_STREAM_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (e) {
      spanStatus = "error";
      if (e instanceof DOMException && e.name === "AbortError") {
        throw new Error(`Gemini API timeout após ${timeoutMs}ms`);
      }
      throw e;
    }

    if (!response.ok || !response.body) {
      spanStatus = "error";
      const errorText = response.body ? await response.text() : "sem corpo";
      throw new Error(`Gemini API error (${response.status}): ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Cada evento SSE é uma linha "data: {json}". Processa linha a linha.
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        let parsed: GeminiApiResponse;
        try {
          parsed = JSON.parse(payload) as GeminiApiResponse;
        } catch {
          // Chunk parcial/partido — ignora (o próximo read completa a linha).
          continue;
        }
        const txt = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
        if (txt) {
          outputText += txt;
          yield txt;
        }
        const usage = parsed.usageMetadata;
        if (usage) {
          // usageMetadata é cumulativa: fica com o último valor visto.
          tokensEntrada = usage.promptTokenCount ?? tokensEntrada;
          tokensSaida = usage.candidatesTokenCount ?? tokensSaida;
        }
      }
    }
  } catch (e) {
    spanStatus = "error";
    throw e;
  } finally {
    clearTimeout(timer);
    recordGenAiSpan({
      op: "gen_ai.chat",
      name: `chat ${GEMINI_MODEL} (stream)`,
      startMs: spanStartMs,
      endMs: Date.now(),
      status: spanStatus,
      attributes: {
        "gen_ai.operation.name": "chat",
        "gen_ai.provider.name": "gemini",
        "gen_ai.request.model": GEMINI_MODEL,
        "gen_ai.response.streaming": true,
        "gen_ai.input.messages": scrub(inputMessages),
        ...(opts.conversationId && { "gen_ai.conversation.id": opts.conversationId }),
        ...(opts.empresaId && { "pilar.empresa_id": opts.empresaId }),
        ...(spanStatus === "ok" && {
          "gen_ai.response.model": GEMINI_MODEL,
          "gen_ai.usage.input_tokens": tokensEntrada,
          "gen_ai.usage.output_tokens": tokensSaida,
          "gen_ai.output.messages": scrub([{ role: "assistant", content: outputText }]),
        }),
      },
    });
  }

  return { tokensEntrada, tokensSaida };
}

/**
 * Chama o Gemini e retorna a resposta parseada (LEGADO).
 * Mantém o fallback tolerante ({ texto }) para os copilots existentes que apenas
 * exibem o JSON ao usuário. Para fluxos agênticos que GRAVAM no banco, use
 * callGeminiStructured — que valida e nunca silencia erro.
 */
export async function callGemini(request: AiRequest): Promise<AiResponse> {
  const spanStartMs = Date.now();
  try {
    const { text, tokensEntrada, tokensSaida } = await fetchGeminiRaw(request.systemPrompt, request.userMessage, {
      deadline: Date.now() + GEMINI_CALL_TIMEOUT_MS,
      conversationId: request.conversationId,
      empresaId: request.empresaId,
    });

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      parsed = { texto: text };
    }

    recordGenAiSpan({
      op: "gen_ai.invoke_agent",
      name: `invoke_agent ${request.tipo}`,
      startMs: spanStartMs,
      endMs: Date.now(),
      status: "ok",
      attributes: {
        "gen_ai.operation.name": "invoke_agent",
        "gen_ai.agent.name": request.tipo,
        "gen_ai.usage.input_tokens": tokensEntrada,
        "gen_ai.usage.output_tokens": tokensSaida,
        "pilar.empresa_id": request.empresaId,
        ...(request.conversationId && { "gen_ai.conversation.id": request.conversationId }),
      },
    });

    return {
      conteudo: parsed,
      resumo: (parsed.resumo as string) || (parsed.summary as string) || text.substring(0, 200),
      tokensEntrada,
      tokensSaida,
    };
  } catch (e) {
    recordGenAiSpan({
      op: "gen_ai.invoke_agent",
      name: `invoke_agent ${request.tipo}`,
      startMs: spanStartMs,
      endMs: Date.now(),
      status: "error",
      attributes: {
        "gen_ai.operation.name": "invoke_agent",
        "gen_ai.agent.name": request.tipo,
        "pilar.empresa_id": request.empresaId,
        ...(request.conversationId && { "gen_ai.conversation.id": request.conversationId }),
      },
    });
    throw e;
  }
}

export interface StructuredResult<T> {
  data: T;
  tokensEntrada: number;
  tokensSaida: number;
  attempts: number;
}

/**
 * Chama o Gemini exigindo uma saída que satisfaça `schema` (Zod).
 *
 * Diferença crítica vs. callGemini: NÃO há fallback silencioso. Se o modelo
 * devolver JSON inválido ou que não bate no schema, faz retry (até `maxRetries`)
 * reinjetando o erro no prompt; esgotadas as tentativas, LANÇA erro explícito.
 *
 * Use em qualquer fluxo agêntico cujo resultado vá ser persistido (orçamento,
 * proposta, medição) — onde um JSON malformado viraria lixo no banco.
 */
export async function callGeminiStructured<T>(
  request: AiRequest,
  schema: z.ZodType<T>,
  opts: { maxRetries?: number; maxOutputTokens?: number } = {}
): Promise<StructuredResult<T>> {
  const maxRetries = opts.maxRetries ?? 2;
  let lastError = "";
  let tokensEntrada = 0;
  let tokensSaida = 0;
  let attempt = 0;
  const spanStartMs = Date.now();

  // Orçamento total de tempo: o retry sequencial não pode estourar o wall-clock da edge.
  const deadline = Date.now() + GEMINI_TOTAL_BUDGET_MS;

  try {
    for (attempt = 1; attempt <= maxRetries + 1; attempt++) {
      if (Date.now() >= deadline) {
        throw new Error(
          `Gemini structured output esgotou o orçamento de tempo (${GEMINI_TOTAL_BUDGET_MS}ms) após ${
            attempt - 1
          } tentativa(s). Último erro: ${lastError || "nenhum"}`
        );
      }

      const userMessage =
        attempt === 1
          ? request.userMessage
          : `${request.userMessage}\n\n[Tentativa ${attempt}] A resposta anterior foi rejeitada: ${lastError}. Responda APENAS com JSON válido que satisfaça exatamente o schema exigido.`;

      const raw = await fetchGeminiRaw(request.systemPrompt, userMessage, {
        deadline,
        files: request.files,
        maxOutputTokens: opts.maxOutputTokens,
        conversationId: request.conversationId,
        empresaId: request.empresaId,
      });
      tokensEntrada += raw.tokensEntrada;
      tokensSaida += raw.tokensSaida;

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.text);
      } catch (e) {
        lastError = `JSON inválido (${e instanceof Error ? e.message : "erro de parse"})`;
        continue;
      }

      const result = schema.safeParse(parsed);
      if (result.success) {
        recordGenAiSpan({
          op: "gen_ai.invoke_agent",
          name: `invoke_agent ${request.tipo}`,
          startMs: spanStartMs,
          endMs: Date.now(),
          status: "ok",
          attributes: {
            "gen_ai.operation.name": "invoke_agent",
            "gen_ai.agent.name": request.tipo,
            "gen_ai.usage.input_tokens": tokensEntrada,
            "gen_ai.usage.output_tokens": tokensSaida,
            "pilar.attempts": attempt,
            "pilar.empresa_id": request.empresaId,
            ...(request.conversationId && { "gen_ai.conversation.id": request.conversationId }),
          },
        });
        return { data: result.data, tokensEntrada, tokensSaida, attempts: attempt };
      }
      lastError = result.error.issues.map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`).join("; ");
    }

    throw new Error(
      `Gemini structured output falhou após ${maxRetries + 1} tentativas. Último erro de validação: ${lastError}`
    );
  } catch (e) {
    recordGenAiSpan({
      op: "gen_ai.invoke_agent",
      name: `invoke_agent ${request.tipo}`,
      startMs: spanStartMs,
      endMs: Date.now(),
      status: "error",
      attributes: {
        "gen_ai.operation.name": "invoke_agent",
        "gen_ai.agent.name": request.tipo,
        "gen_ai.usage.input_tokens": tokensEntrada,
        "gen_ai.usage.output_tokens": tokensSaida,
        "pilar.attempts": attempt,
        "pilar.empresa_id": request.empresaId,
        ...(request.conversationId && { "gen_ai.conversation.id": request.conversationId }),
      },
    });
    throw e;
  }
}

/**
 * Grava o rastro da execução em agent_runs (mesa de trabalho `/agentes`). Substitui
 * o antigo saveInsight()/ai_insights (tabela dropada em 20260429400000 — o insert
 * lá sempre lançava, e por isso nunca chegava a atualizar ai_usage nem agent_runs).
 *
 * Sem fluxo de aprovação humana aqui — nasce `executed` porque o resultado já foi
 * devolvido direto ao chamador (agent_runs também suporta um status `pending_review`
 * para fluxos com aprovação humana, hoje sem produtor ativo).
 *
 * Falha ao gravar é best-effort — nunca quebra o fluxo principal. Devolve o id do run
 * (ou null quando o insert falhou) para o caller correlacionar o débito de tokens
 * (debitarTokens, campo agentRunId) — são responsabilidades separadas.
 */
export async function recordAgentRun(
  supabaseAdmin: SupabaseClient,
  request: AiRequest,
  aiResponse: AiResponse,
  userId: string
): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin
      .from("agent_runs")
      .insert({
        empresa_id: request.empresaId,
        agent_type: request.tipo,
        status: "executed",
        entity_type: request.referenciaTipo ?? null,
        entity_id: request.referenciaId ?? null,
        input: { userMessage: request.userMessage },
        result: aiResponse.conteudo,
        model: GEMINI_MODEL,
        tokens_input: aiResponse.tokensEntrada,
        tokens_output: aiResponse.tokensSaida,
        created_by: userId,
      })
      .select("id")
      .single();
    return (data as { id: string } | null)?.id ?? null;
  } catch {
    // Rastro é best-effort — nunca quebra o fluxo principal.
    return null;
  }
}

/**
 * Cria um Supabase client admin (com service role key)
 */
export function createAdminClient() {
  return createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
}

/**
 * Cria um Supabase client autenticado (com token do request)
 */
export function createAuthClient(req: Request) {
  // Header ausente vira string vazia — o getUser() falha e o handler responde 401,
  // em vez de estourar por causa do non-null assertion.
  const authHeader = req.headers.get("Authorization") ?? "";
  return createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: authHeader } },
  });
}
