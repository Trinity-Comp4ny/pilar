import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { getCorsHeaders, jsonResponse, optionsResponse } from "../_shared/cors.ts";
import {
  callGeminiStructured,
  checkRateLimit,
  createAdminClient,
  createAuthClient,
  debitarTokens,
  mensagemBloqueioTokens,
  modeloEmUso,
  recordAgentRun,
  respostaDeErroIa,
  verificarTokens,
} from "../_shared/ai-client.ts";
import { itensPermitidos } from "./catalogo.ts";
import { conferirSaida, lerEntrada, SaidaSchema } from "./esquema.ts";
import { mensagemDoUsuario, promptDoSistema } from "./prompt.ts";

const TIPO = "estimativa-itens";

// SPEC 138 (BEZ-83): lê a descrição da obra e devolve só itens do catálogo da estimativa, com quantidade, o que
// ficou de fora e o que faltou saber. A IA nunca define preço nem prazo (ADR 0063 e 0064): o preço e a origem de
// cada item saem do motor, no cliente, depois que o usuário confirma a lista.
serve(
  withSentry("ai-estimativa-itens", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);

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

      // A empresa precisa ter a estimativa ligada e o usuário poder criar (a função da RLS confere os dois).
      const { data: podeEstimar } = await authClient.rpc("user_has_feature", {
        p_feature: "estimativa_obra",
        p_min_level: "editor",
      });
      if (podeEstimar !== true) {
        return jsonResponse({ error: "A estimativa de obra não está ligada para a sua empresa." }, 403, req);
      }

      const canProceed = await checkRateLimit(adminClient, empresaId);
      if (!canProceed) {
        return jsonResponse(
          { error: "Muitas chamadas de IA em sequência. Aguarde um minuto e tente de novo." },
          429,
          req
        );
      }

      // Gate de tokens (SPEC 075 e 094): bloqueia ANTES de gastar no provedor.
      const gate = await verificarTokens(adminClient, empresaId, user.id);
      if (!gate.ok && gate.motivo) {
        return jsonResponse({ error: mensagemBloqueioTokens(gate.motivo), motivo: gate.motivo }, 402, req);
      }

      const entrada = lerEntrada(await req.json().catch(() => null));
      if (!entrada.ok) return jsonResponse({ error: entrada.error }, 400, req);

      // O catálogo vem do banco, não do cliente.
      const { data: parametros, error: erroParametros } = await adminClient
        .from("estimativa_parametros")
        .select("parametros")
        .eq("id", "default")
        .single();
      if (erroParametros || !parametros) throw new Error("Parâmetros da estimativa indisponíveis");
      const permitidos = itensPermitidos((parametros.parametros as { adicionais?: unknown } | null)?.adicionais);
      if (permitidos.length === 0) throw new Error("Catálogo da estimativa sem itens para a IA");

      const resultado = await callGeminiStructured(
        {
          systemPrompt: promptDoSistema(permitidos),
          userMessage: mensagemDoUsuario(entrada.descricao),
          empresaId,
          tipo: TIPO,
        },
        SaidaSchema,
        { maxRetries: 1, maxOutputTokens: 2048 }
      );

      const interpretacao = conferirSaida(SaidaSchema.parse(resultado.data), new Set(permitidos.map((i) => i.id)));
      const tokens = resultado.tokensEntrada + resultado.tokensSaida;

      const runId = await recordAgentRun(
        adminClient,
        { systemPrompt: "", userMessage: entrada.descricao, empresaId, tipo: TIPO },
        {
          conteudo: { ...interpretacao },
          resumo: `Descrição da obra interpretada: ${interpretacao.itens.length} item(ns)`,
          tokensEntrada: resultado.tokensEntrada,
          tokensSaida: resultado.tokensSaida,
        },
        user.id
      );
      await debitarTokens(adminClient, {
        empresaId,
        userId: user.id,
        agentKey: TIPO,
        agentRunId: runId,
        model: modeloEmUso(TIPO),
        tokensInput: resultado.tokensEntrada,
        tokensOutput: resultado.tokensSaida,
        idempotencyKey: crypto.randomUUID(),
        calls: resultado.attempts,
      });

      return jsonResponse({ ...interpretacao, tokens }, 200, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "Não autenticado" || message === "Perfil não encontrado") {
        return new Response(JSON.stringify({ error: message }), {
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
          status: message === "Não autenticado" ? 401 : 400,
        });
      }
      // Falha da IA ou inesperada: tipo fechado, sem o texto bruto do provedor (ADR 0054).
      return await respostaDeErroIa(err, getCorsHeaders(req), "ai-estimativa-itens");
    }
  })
);
