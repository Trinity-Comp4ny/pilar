import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "./schemas.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
export const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
// streamGenerateContent + alt=sse: cada chunk chega como um evento SSE ("data: {json}\n\n").
const GEMINI_STREAM_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`;

// Teto mensal padrão quando ainda não há linha em ai_usage (mesmo default da coluna limite_requests).
const DEFAULT_LIMITE_REQUESTS = 100;

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

interface AiUsageRow {
  total_requests: number;
  limite_requests: number;
}

interface AiUsageDetailRow {
  id: string;
  total_requests: number;
  total_tokens_entrada: number;
  total_tokens_saida: number;
}

/** Record returned from ai_insights after insert */
export interface AiInsightRow {
  id: string;
  empresa_id: string;
  tipo: string;
  conteudo: Record<string, unknown>;
  resumo: string;
  created_at: string;
  [key: string]: unknown;
}

/**
 * Verifica rate limit e retorna se pode prosseguir
 */
export async function checkRateLimit(supabaseAdmin: SupabaseClient, empresaId: string): Promise<boolean> {
  // Janela curta: barra rajada/loop de chamadas antes de olhar o teto mensal.
  const desde = new Date(Date.now() - SHORT_WINDOW_SECONDS * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from("ai_usage_logs")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .gte("created_at", desde);
  if ((count ?? 0) >= SHORT_WINDOW_MAX_CALLS) {
    return false;
  }

  const now = new Date();
  const mes = now.getMonth() + 1;
  const ano = now.getFullYear();

  const { data } = await supabaseAdmin
    .from("ai_usage")
    .select("total_requests, limite_requests")
    .eq("empresa_id", empresaId)
    .eq("mes", mes)
    .eq("ano", ano)
    .maybeSingle();

  const row = data as AiUsageRow | null;
  if (row && row.total_requests >= row.limite_requests) {
    return false;
  }
  return true;
}

export interface AiSaldo {
  usados: number;
  limite: number;
  restante: number;
}

/**
 * Saldo de uso de IA do mês corrente: teto mensal (limite_requests) menos o já usado
 * (total_requests) em ai_usage. Sem linha ainda → usa o teto padrão e zero usado.
 * `restante` nunca fica negativo. Usa o client admin (bypassa RLS de ai_usage).
 */
export async function getAiSaldo(supabaseAdmin: SupabaseClient, empresaId: string): Promise<AiSaldo> {
  const now = new Date();
  const mes = now.getMonth() + 1;
  const ano = now.getFullYear();

  const { data } = await supabaseAdmin
    .from("ai_usage")
    .select("total_requests, limite_requests")
    .eq("empresa_id", empresaId)
    .eq("mes", mes)
    .eq("ano", ano)
    .maybeSingle();

  const row = data as AiUsageRow | null;
  const usados = row?.total_requests ?? 0;
  const limite = row?.limite_requests ?? DEFAULT_LIMITE_REQUESTS;
  return { usados, limite, restante: Math.max(0, limite - usados) };
}

/**
 * Registra uso do Gemini na tabela ai_usage_logs para billing granular por feature.
 * Falha silenciosa — nunca quebra o fluxo principal.
 */
async function logAiUsage(
  supabaseAdmin: SupabaseClient,
  empresaId: string,
  featureKey: string,
  tokensInput: number,
  tokensOutput: number
): Promise<void> {
  try {
    await supabaseAdmin.from("ai_usage_logs").insert({
      empresa_id: empresaId,
      feature_key: featureKey,
      tokens_input: tokensInput,
      tokens_output: tokensOutput,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Tabela pode não existir ainda — falha silenciosa intencional
  }
}

/**
 * Chamada bruta ao Gemini. Retorna o texto cru + tokens, sem parsear nem validar.
 * Base compartilhada por callGemini (legado) e callGeminiStructured.
 */
async function fetchGeminiRaw(
  systemPrompt: string,
  userMessage: string,
  opts: { deadline?: number } = {}
): Promise<{ text: string; tokensEntrada: number; tokensSaida: number }> {
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
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error(`Gemini API timeout após ${timeoutMs}ms`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const result: GeminiApiResponse = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  const usage = result.usageMetadata || {};
  return {
    text,
    tokensEntrada: usage.promptTokenCount || 0,
    tokensSaida: usage.candidatesTokenCount || 0,
  };
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
  opts: { deadline?: number } = {}
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
      if (e instanceof DOMException && e.name === "AbortError") {
        throw new Error(`Gemini API timeout após ${timeoutMs}ms`);
      }
      throw e;
    }

    if (!response.ok || !response.body) {
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
        if (txt) yield txt;
        const usage = parsed.usageMetadata;
        if (usage) {
          // usageMetadata é cumulativa: fica com o último valor visto.
          tokensEntrada = usage.promptTokenCount ?? tokensEntrada;
          tokensSaida = usage.candidatesTokenCount ?? tokensSaida;
        }
      }
    }
  } finally {
    clearTimeout(timer);
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
  const { text, tokensEntrada, tokensSaida } = await fetchGeminiRaw(request.systemPrompt, request.userMessage, {
    deadline: Date.now() + GEMINI_CALL_TIMEOUT_MS,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    parsed = { texto: text };
  }

  return {
    conteudo: parsed,
    resumo: (parsed.resumo as string) || (parsed.summary as string) || text.substring(0, 200),
    tokensEntrada,
    tokensSaida,
  };
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
  opts: { maxRetries?: number } = {}
): Promise<StructuredResult<T>> {
  const maxRetries = opts.maxRetries ?? 2;
  let lastError = "";
  let tokensEntrada = 0;
  let tokensSaida = 0;

  // Orçamento total de tempo: o retry sequencial não pode estourar o wall-clock da edge.
  const deadline = Date.now() + GEMINI_TOTAL_BUDGET_MS;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
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

    const raw = await fetchGeminiRaw(request.systemPrompt, userMessage, { deadline });
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
      return { data: result.data, tokensEntrada, tokensSaida, attempts: attempt };
    }
    lastError = result.error.issues.map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`).join("; ");
  }

  throw new Error(
    `Gemini structured output falhou após ${maxRetries + 1} tentativas. Último erro de validação: ${lastError}`
  );
}

/**
 * Salva o insight no banco e atualiza usage
 */
export async function saveInsight(
  supabaseAdmin: SupabaseClient,
  request: AiRequest,
  aiResponse: AiResponse,
  userId: string
): Promise<AiInsightRow> {
  const now = new Date();
  const mes = now.getMonth() + 1;
  const ano = now.getFullYear();

  // Salva insight
  const { data: insight, error: insightError } = await supabaseAdmin
    .from("ai_insights")
    .insert({
      empresa_id: request.empresaId,
      tipo: request.tipo,
      referencia_id: request.referenciaId || null,
      referencia_tipo: request.referenciaTipo || null,
      conteudo: aiResponse.conteudo,
      resumo: aiResponse.resumo,
      modelo_ia: GEMINI_MODEL,
      tokens_entrada: aiResponse.tokensEntrada,
      tokens_saida: aiResponse.tokensSaida,
      mes_referencia: request.mesReferencia || null,
      ano_referencia: request.anoReferencia || null,
      created_by: userId,
    })
    .select()
    .single();

  if (insightError) throw insightError;

  // Upsert usage
  const { data: existingData } = await supabaseAdmin
    .from("ai_usage")
    .select("id, total_requests, total_tokens_entrada, total_tokens_saida")
    .eq("empresa_id", request.empresaId)
    .eq("mes", mes)
    .eq("ano", ano)
    .maybeSingle();

  const existing = existingData as AiUsageDetailRow | null;

  if (existing) {
    await supabaseAdmin
      .from("ai_usage")
      .update({
        total_requests: existing.total_requests + 1,
        total_tokens_entrada: existing.total_tokens_entrada + aiResponse.tokensEntrada,
        total_tokens_saida: existing.total_tokens_saida + aiResponse.tokensSaida,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await supabaseAdmin.from("ai_usage").insert({
      empresa_id: request.empresaId,
      mes,
      ano,
      total_requests: 1,
      total_tokens_entrada: aiResponse.tokensEntrada,
      total_tokens_saida: aiResponse.tokensSaida,
    });
  }

  // Registra em ai_usage_logs para billing granular por feature (falha silenciosa)
  await logAiUsage(supabaseAdmin, request.empresaId, request.tipo, aiResponse.tokensEntrada, aiResponse.tokensSaida);

  return insight as AiInsightRow;
}

/**
 * Fallback não-atômico do incremento de uso (read-then-update). Usado só quando o RPC
 * atômico increment_ai_usage ainda não existe no banco. Nunca deve ser o caminho normal.
 */
async function recordAiUsageFallback(
  supabaseAdmin: SupabaseClient,
  empresaId: string,
  tokensInput: number,
  tokensOutput: number,
  calls: number
): Promise<void> {
  const now = new Date();
  const mes = now.getMonth() + 1;
  const ano = now.getFullYear();

  const { data: existingData } = await supabaseAdmin
    .from("ai_usage")
    .select("id, total_requests, total_tokens_entrada, total_tokens_saida")
    .eq("empresa_id", empresaId)
    .eq("mes", mes)
    .eq("ano", ano)
    .maybeSingle();

  const existing = existingData as AiUsageDetailRow | null;

  if (existing) {
    await supabaseAdmin
      .from("ai_usage")
      .update({
        total_requests: existing.total_requests + calls,
        total_tokens_entrada: existing.total_tokens_entrada + tokensInput,
        total_tokens_saida: existing.total_tokens_saida + tokensOutput,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await supabaseAdmin.from("ai_usage").insert({
      empresa_id: empresaId,
      mes,
      ano,
      total_requests: calls,
      total_tokens_entrada: tokensInput,
      total_tokens_saida: tokensOutput,
    });
  }
}

/**
 * Incrementa o contador mensal de uso (ai_usage — alimenta o rate limit) e
 * registra o log granular por feature (ai_usage_logs). NÃO depende de ai_insights
 * (dropada em 20260429400000). Use nos fluxos agênticos que gravam em agent_runs.
 *
 * `calls` = nº REAL de chamadas ao Gemini no turno (cada retry conta). O padrão 1 mantém
 * o comportamento antigo dos callers que ainda não passam a contagem. O incremento é
 * atômico (RPC increment_ai_usage com col = col + delta) — evita a corrida read-then-update.
 */
export async function recordAiUsage(
  supabaseAdmin: SupabaseClient,
  empresaId: string,
  featureKey: string,
  tokensInput: number,
  tokensOutput: number,
  calls = 1
): Promise<void> {
  const { error } = await supabaseAdmin.rpc("increment_ai_usage", {
    p_empresa_id: empresaId,
    p_calls: calls,
    p_tokens_input: tokensInput,
    p_tokens_output: tokensOutput,
  });
  if (error) {
    // RPC ainda não aplicado no banco → cai no caminho legado, sem quebrar o fluxo.
    await recordAiUsageFallback(supabaseAdmin, empresaId, tokensInput, tokensOutput, calls);
  }

  await logAiUsage(supabaseAdmin, empresaId, featureKey, tokensInput, tokensOutput);
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
