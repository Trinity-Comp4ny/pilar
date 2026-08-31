import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { z } from "../_shared/schemas.ts";
import {
  createAuthClient,
  createAdminClient,
  checkRateLimit,
  verificarTokens,
  callGeminiStructured,
  debitarTokens,
  GEMINI_MODEL,
  recordAgentRun,
  type AiRequest,
} from "../_shared/ai-client.ts";

// Spec 017: extrai lançamentos financeiros do TEXTO de um extrato/fatura.
// O client extrai o texto do PDF localmente e manda só texto (decisão de
// privacidade) — a imagem do documento nunca chega aqui. CSV/planilha nem
// passam por esta função: são parseados de forma determinística no client.

const MAX_TEXTO_CHARS = 60_000;

const LancamentoSchema = z.object({
  data: z.string(), // ISO yyyy-mm-dd
  descricao: z.string().min(1),
  valor: z.number().nonnegative(), // sempre positivo; o tipo diz o sentido
  tipo: z.enum(["despesa", "receita"]),
  categoria_sugerida: z.string().nullable().optional(),
  parcela_numero: z.number().int().positive().nullable().optional(),
  parcela_total: z.number().int().positive().nullable().optional(),
  confianca: z.number().min(0).max(1),
});

const ResultSchema = z.object({
  lancamentos: z.array(LancamentoSchema),
  avisos: z.array(z.string()).default([]),
});

interface CategoriaRow {
  nome: string;
  tipo: string | null;
}

function montarPrompt(tipoDoc: string, categorias: CategoriaRow[]) {
  const listaCategorias =
    categorias.length > 0
      ? categorias.map((c) => `- ${c.nome} (${c.tipo ?? "?"})`).join("\n")
      : "(a empresa ainda não cadastrou categorias; deixe categoria_sugerida como null)";

  const systemPrompt = [
    "Você extrai lançamentos financeiros do texto de um documento bancário brasileiro",
    `(tipo: ${tipoDoc}). Devolve APENAS JSON válido, sem comentários.`,
    "",
    "Regras:",
    "- Uma entrada por movimento financeiro real. Ignore saldos, cabeçalhos, totais e rodapés.",
    "- `valor` é SEMPRE positivo (número, ponto decimal). O sentido vai em `tipo`.",
    "- `tipo`: 'despesa' para saída/débito/pagamento; 'receita' para entrada/crédito/recebimento.",
    ...(tipoDoc === "fatura"
      ? [
          "- Em fatura de cartão TODO movimento é 'despesa', exceto estorno/crédito/pagamento da fatura, que é 'receita'.",
        ]
      : []),
    "- `data` no formato ISO yyyy-mm-dd. Se o ano estiver ausente, use o mais provável do contexto.",
    "- `categoria_sugerida`: escolha o NOME exato de uma das categorias abaixo cujo tipo bata com o lançamento; se nenhuma servir, use null. Nunca invente categoria.",
    "- Parcelas ('2/12', 'PARC 03/10'): preencha parcela_numero e parcela_total.",
    "- `confianca` de 0 a 1: quão seguro você está da linha (valor/data ambíguos → baixa).",
    "- Em `avisos`, liste trechos que pareciam movimento mas você não conseguiu interpretar.",
    "",
    "Categorias da empresa (nome e tipo):",
    listaCategorias,
  ].join("\n");

  return systemPrompt;
}

serve(
  withSentry("ai-import-financeiro", async (req) => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    try {
      const authClient = createAuthClient(req);
      const adminClient = createAdminClient();

      const {
        data: { user },
        error: userError,
      } = await authClient.auth.getUser();
      if (userError || !user) throw new Error("Não autenticado");

      const { data: profile } = await authClient.from("profiles").select("empresa_id").eq("id", user.id).single();
      if (!profile) throw new Error("Perfil não encontrado");
      const empresaId = profile.empresa_id as string;

      const canProceed = await checkRateLimit(adminClient, empresaId);
      if (!canProceed) {
        return new Response(
          JSON.stringify({ error: "Muitas chamadas de IA em sequência. Aguarde um minuto e tente de novo." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
        );
      }

      // Gate de tokens (Fase 2, spec 075): bloqueia ANTES de gastar no provider.
      const gateTokens = await verificarTokens(adminClient, empresaId);
      if (!gateTokens.ok) {
        return new Response(
          JSON.stringify({
            error: "Os tokens de IA da empresa acabaram neste ciclo. Aguarde a renovação ou fale com o administrador.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 402 }
        );
      }

      const body = await req.json().catch(() => ({}));
      const tipoDoc = typeof body.tipo === "string" ? body.tipo : "extrato";
      const texto = typeof body.texto === "string" ? body.texto.trim() : "";

      if (!texto) {
        return new Response(JSON.stringify({ error: "Nenhum texto para importar" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }
      if (texto.length > MAX_TEXTO_CHARS) {
        return new Response(
          JSON.stringify({ error: `Documento grande demais (${texto.length} caracteres). Divida em partes menores.` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      // Categorias da empresa para o modelo sugerir (nunca inventa).
      const { data: categorias } = await adminClient
        .from("categorias_financeiras")
        .select("nome, tipo")
        .eq("empresa_id", empresaId)
        .is("deleted_at", null);

      const systemPrompt = montarPrompt(tipoDoc, (categorias as CategoriaRow[]) ?? []);
      const aiRequest: AiRequest = {
        systemPrompt,
        userMessage: `Extraia os lançamentos deste documento:\n\n"""\n${texto}\n"""`,
        empresaId,
        tipo: "import-financeiro",
      };

      const result = await callGeminiStructured(aiRequest, ResultSchema, { maxRetries: 1 });

      const runId = await recordAgentRun(
        adminClient,
        aiRequest,
        {
          conteudo: result.data as Record<string, unknown>,
          resumo: "Importação de lançamentos financeiros",
          tokensEntrada: result.tokensEntrada,
          tokensSaida: result.tokensSaida,
        },
        user.id
      );
      await debitarTokens(adminClient, {
        empresaId,
        userId: user.id,
        agentKey: "import-financeiro",
        agentRunId: runId,
        model: GEMINI_MODEL,
        tokensInput: result.tokensEntrada,
        tokensOutput: result.tokensSaida,
        idempotencyKey: crypto.randomUUID(),
        calls: result.attempts,
      });

      return new Response(JSON.stringify(result.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao processar documento";
      const status = message === "Não autenticado" ? 401 : 400;
      return new Response(JSON.stringify({ error: message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status,
      });
    }
  })
);
