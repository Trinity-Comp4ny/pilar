import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

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
  conteudo: any;
  resumo: string;
  tokensEntrada: number;
  tokensSaida: number;
}

/**
 * Verifica rate limit e retorna se pode prosseguir
 */
export async function checkRateLimit(supabaseAdmin: any, empresaId: string): Promise<boolean> {
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

  if (data && data.total_requests >= data.limite_requests) {
    return false;
  }
  return true;
}

/**
 * Chama a API do Gemini e retorna a resposta parseada
 */
export async function callGemini(request: AiRequest): Promise<AiResponse> {
  const body = {
    system_instruction: {
      parts: [{ text: request.systemPrompt }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: request.userMessage }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
    },
  };

  const response = await fetch(GEMINI_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();

  const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  const usageMetadata = result.usageMetadata || {};

  let parsed: any;
  try {
    parsed = JSON.parse(textContent);
  } catch {
    parsed = { texto: textContent };
  }

  return {
    conteudo: parsed,
    resumo: parsed.resumo || parsed.summary || textContent.substring(0, 200),
    tokensEntrada: usageMetadata.promptTokenCount || 0,
    tokensSaida: usageMetadata.candidatesTokenCount || 0,
  };
}

/**
 * Salva o insight no banco e atualiza usage
 */
export async function saveInsight(
  supabaseAdmin: any,
  request: AiRequest,
  aiResponse: AiResponse,
  userId: string
): Promise<any> {
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
  const { data: existing } = await supabaseAdmin
    .from("ai_usage")
    .select("id, total_requests, total_tokens_entrada, total_tokens_saida")
    .eq("empresa_id", request.empresaId)
    .eq("mes", mes)
    .eq("ano", ano)
    .maybeSingle();

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
    await supabaseAdmin
      .from("ai_usage")
      .insert({
        empresa_id: request.empresaId,
        mes,
        ano,
        total_requests: 1,
        total_tokens_entrada: aiResponse.tokensEntrada,
        total_tokens_saida: aiResponse.tokensSaida,
      });
  }

  return insight;
}

/**
 * Cria um Supabase client admin (com service role key)
 */
export function createAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
}

/**
 * Cria um Supabase client autenticado (com token do request)
 */
export function createAuthClient(req: Request) {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
  );
}
