// ai-chat — Copiloto conversacional do Pilar (MVP consultivo, read-only).
//
// Fluxo: mensagem do usuário → ORQUESTRADOR classifica a intenção → aciona o
// AGENTE DE DOMÍNIO (read-only, via RLS/JWT do usuário) que coleta os dados →
// gera a resposta em linguagem natural. NADA é gravado no domínio — só o histórico
// do chat. Escrita de dados virá numa próxima fase, com card de confirmação + gate.
//
// Segurança: todas as leituras de domínio usam o client autenticado (RLS ativa),
// nunca service_role. Isolamento por empresa é garantido pelas policies, não por
// filtro manual. (Corrige por construção o padrão service_role dos ai-* legados.)

//
// Organização (2026-10-08): o arquivo de 1.767 linhas foi dividido sem mudar código.
// index.ts ficou só com o handler; o resto vive em módulos vizinhos:
//   schemas.ts (entrada, intenção, extrações) · prompts.ts · entidades.ts (o que o
//   chat sabe criar) · contexto.ts (histórico e sanitização) · coleta.ts (dados por
//   agente, via RLS) · resposta.ts (SSE, débito de tokens, log) · consulta.ts
//   (resposta em streaming) · criacao.ts (fluxo de criação com rascunho).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry, setSentryUser } from "../_shared/sentry.ts";
import { getCorsHeaders, jsonResponse, optionsResponse } from "../_shared/cors.ts";
import {
  createAuthClient,
  createAdminClient,
  checkRateLimit,
  callGeminiStructured,
  verificarTokens,
  mensagemBloqueioTokens,
  modeloEmUso,
} from "../_shared/ai-client.ts";
import { coletarDados } from "./coleta.ts";
import { streamConsulta } from "./consulta.ts";
import { carregarHistorico, comContexto } from "./contexto.ts";
import { processarCriacao } from "./criacao.ts";
import { ENTIDADE_CFG } from "./entidades.ts";
import { ORQUESTRADOR_PROMPT } from "./prompts.ts";
import { logAction, recordAndSaldo, respondFinal, respostaPrompt } from "./resposta.ts";
import { AGENTE_LABEL, Agente, FEATURE_KEY, IntentSchema, RequestSchema, RespostaSchema } from "./schemas.ts";

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
serve(
  withSentry("ai-chat", async (req: Request) => {
    if (req.method === "OPTIONS") return optionsResponse(req);

    // O client sinaliza streaming via Accept: text/event-stream (fetch direto).
    // functions.invoke (fallback buffered) não manda esse header → resposta JSON.
    const wantsStream = (req.headers.get("accept") ?? "").includes("text/event-stream");

    try {
      const authClient = createAuthClient(req);
      const adminClient = createAdminClient();

      const {
        data: { user },
        error: userError,
      } = await authClient.auth.getUser();
      if (userError || !user) return jsonResponse({ error: "Não autenticado" }, 401, req);

      const { data: profile } = await authClient.from("profiles").select("empresa_id").eq("id", user.id).single();
      if (!profile?.empresa_id) return jsonResponse({ error: "Perfil não encontrado" }, 403, req);
      const empresaId = profile.empresa_id as string;
      setSentryUser({ id: user.id, email: user.email, empresa_id: empresaId });

      if (!(await checkRateLimit(adminClient, empresaId))) {
        return jsonResponse(
          { error: "Muitas chamadas de IA em sequência. Aguarde um minuto e tente de novo." },
          429,
          req
        );
      }

      // Gate de tokens (Fase 2, spec 075; teto por usuário na spec 094): bloqueia
      // ANTES de gastar no provider.
      const gateTokens = await verificarTokens(adminClient, empresaId, user.id);
      if (!gateTokens.ok && gateTokens.motivo) {
        return jsonResponse({ error: mensagemBloqueioTokens(gateTokens.motivo), motivo: gateTokens.motivo }, 402, req);
      }

      const body = await req.json().catch(() => ({}));
      const parsed = RequestSchema.safeParse(body);
      if (!parsed.success) {
        return jsonResponse({ error: parsed.error.issues[0]?.message ?? "payload inválido" }, 400, req);
      }
      const { message } = parsed.data;

      // Contexto de projeto em foco (spec 007): busca via RLS (só projeto da empresa)
      // e injeta nos prompts, para o agente responder/agir no escopo desse projeto.
      const projetoId = parsed.data.projetoId;
      let focoProjeto = "";
      if (projetoId) {
        const { data: proj } = await authClient
          .from("projetos")
          .select("id, nome, status, valor_contrato, data_inicio, data_previsao, clientes(nome)")
          .eq("id", projetoId)
          .single();
        if (proj) {
          focoProjeto = `\n\nPROJETO EM FOCO (o usuário está trabalhando neste projeto; priorize-o e responda no contexto dele):\n${JSON.stringify(proj)}`;
        }
      }

      // Sessão: cria se não veio (via RLS — o usuário é o dono).
      let sessionId = parsed.data.sessionId;
      if (!sessionId) {
        const { data: sess, error: sessErr } = await authClient
          .from("chat_sessions")
          .insert({ empresa_id: empresaId, user_id: user.id, titulo: message.slice(0, 60) })
          .select("id")
          .single();
        if (sessErr || !sess) return jsonResponse({ error: "Falha ao criar sessão" }, 500, req);
        sessionId = sess.id as string;
      }

      // Carrega o transcript ANTES de gravar a mensagem atual (contexto = turnos anteriores).
      const historico = await carregarHistorico(authClient, sessionId);

      // Grava a mensagem do usuário.
      await authClient.from("chat_messages").insert({ session_id: sessionId, role: "user", content: message });

      // 1) Orquestrador classifica a intenção (considerando o contexto da conversa).
      const rota = await callGeminiStructured(
        {
          systemPrompt: ORQUESTRADOR_PROMPT,
          userMessage: comContexto(
            historico,
            message,
            "Classifique a intenção real do usuário (agente + modo)." + focoProjeto
          ),
          empresaId,
          tipo: FEATURE_KEY,
          conversationId: sessionId,
        },
        IntentSchema
      );
      const agente = rota.data.agente;
      const modo = rota.data.modo;

      // ─── MODO AÇÃO ─── Dispatch por entidade (config em ENTIDADE_CFG).
      if (modo === "acao") {
        const cfg = rota.data.entidade ? ENTIDADE_CFG[rota.data.entidade] : undefined;
        if (cfg) {
          return await processarCriacao({
            db: authClient,
            admin: adminClient,
            req,
            wantsStream,
            sessionId,
            empresaId,
            userId: user.id,
            historico,
            message,
            motivo: rota.data.motivo,
            rotaTok: { in: rota.tokensEntrada, out: rota.tokensSaida, calls: rota.attempts },
            ...cfg,
          });
        }

        const aviso =
          "Ainda não sei criar isso. Sei criar: lead, projeto, receita, despesa e cartão. " +
          "Para consultar dados, é só perguntar.";
        await authClient.from("chat_messages").insert({
          session_id: sessionId,
          role: "assistant",
          content: aviso,
          meta: {
            agente,
            agente_label: AGENTE_LABEL[agente],
            motivo: rota.data.motivo,
            model: modeloEmUso(FEATURE_KEY),
          },
        });
        const saldo = await recordAndSaldo(
          adminClient,
          empresaId,
          user.id,
          undefined,
          rota.tokensEntrada,
          rota.tokensSaida,
          rota.attempts
        );
        return respondFinal(
          {
            sessionId,
            tipo: "resposta",
            resposta: aviso,
            agentes: [{ agente, agente_label: AGENTE_LABEL[agente] }],
            saldo,
          },
          req,
          wantsStream
        );
      }

      // ─── MODO OPERAÇÃO ─── Ação sobre entidade existente. O card lista candidatos e escolhe o alvo.
      if (modo === "operacao" && rota.data.operacao) {
        const label = AGENTE_LABEL[agente];
        const { data: run, error: runErr } = await authClient
          .from("agent_runs")
          .insert({
            empresa_id: empresaId,
            agent_type: "acao",
            status: "pending_review",
            entity_type: rota.data.operacao,
            input: { message },
            result: { acao: rota.data.operacao },
            model: modeloEmUso(FEATURE_KEY),
            tokens_input: rota.tokensEntrada,
            tokens_output: rota.tokensSaida,
            created_by: user.id,
          })
          .select("id")
          .single();
        if (runErr || !run) return jsonResponse({ error: "Falha ao preparar a ação" }, 500, req);
        await authClient.from("chat_messages").insert({
          session_id: sessionId,
          role: "assistant",
          content: "Escolha o alvo e confirme a ação.",
          meta: {
            agente,
            agente_label: label,
            model: modeloEmUso(FEATURE_KEY),
            acao_run_id: run.id,
            operacao: rota.data.operacao,
          },
        });
        const saldo = await recordAndSaldo(
          adminClient,
          empresaId,
          user.id,
          run.id as string,
          rota.tokensEntrada,
          rota.tokensSaida,
          rota.attempts
        );
        return respondFinal(
          {
            sessionId,
            tipo: "acao",
            operacao: rota.data.operacao,
            runId: run.id,
            custoCreditos: 1,
            agentes: [{ agente, agente_label: label, motivo: rota.data.motivo }],
            saldo,
          },
          req,
          wantsStream
        );
      }

      // Run leve de consulta (spec 007, Fase 2b): âncora da timeline de raciocínio.
      // agent_type 'consulta' + running → executed → NÃO entra na fila 'pending_review'.
      const { data: consultaRun } = await authClient
        .from("agent_runs")
        .insert({
          empresa_id: empresaId,
          agent_type: "consulta",
          status: "running",
          entity_type: agente,
          input: { message },
          model: modeloEmUso(FEATURE_KEY),
          tokens_input: rota.tokensEntrada,
          tokens_output: rota.tokensSaida,
          created_by: user.id,
        })
        .select("id")
        .single();
      const consultaRunId = (consultaRun?.id as string | undefined) ?? undefined;
      await logAction(
        authClient,
        consultaRunId,
        "classificar_intencao",
        { message },
        { agente, modo, motivo: rota.data.motivo }
      );

      // 2) Agente de domínio coleta os dados (read-only, RLS).
      const dados = await coletarDados(agente, authClient, empresaId);
      await logAction(
        authClient,
        consultaRunId,
        `consultar_${agente}`,
        { fonte: agente },
        { chaves: Object.keys(dados) }
      );

      const userMessage = comContexto(
        historico,
        message,
        `Responda à mensagem atual do usuário usando SOMENTE os dados abaixo.\n\nDados disponíveis (JSON):\n${JSON.stringify(dados)}${focoProjeto}`
      );
      const meta = {
        agente,
        agente_label: AGENTE_LABEL[agente],
        motivo: rota.data.motivo,
        model: modeloEmUso(FEATURE_KEY),
      };

      // 3a) Streaming (SSE): resposta em linguagem natural token-a-token.
      if (wantsStream) {
        return streamConsulta({
          db: authClient,
          admin: adminClient,
          req,
          sessionId,
          empresaId,
          agente,
          meta,
          userMessage,
          userId: user.id,
          runId: consultaRunId,
          rotaTok: { in: rota.tokensEntrada, out: rota.tokensSaida, calls: rota.attempts },
        });
      }

      // 3b) Buffered (fallback): resposta em linguagem natural de uma vez.
      const resp = await callGeminiStructured(
        {
          systemPrompt: respostaPrompt(agente),
          userMessage,
          empresaId,
          tipo: FEATURE_KEY,
          conversationId: sessionId,
        },
        RespostaSchema
      );

      const tokensIn = rota.tokensEntrada + resp.tokensEntrada;
      const tokensOut = rota.tokensSaida + resp.tokensSaida;
      const chamadas = rota.attempts + resp.attempts;

      // Grava a resposta do assistente.
      await authClient.from("chat_messages").insert({
        session_id: sessionId,
        role: "assistant",
        content: resp.data.resposta,
        meta,
        tokens_input: tokensIn,
        tokens_output: tokensOut,
      });

      // Contabiliza uso (débito no ledger de tokens) e lê o saldo restante.
      const saldo = await recordAndSaldo(adminClient, empresaId, user.id, consultaRunId, tokensIn, tokensOut, chamadas);

      await logAction(authClient, consultaRunId, "gerar_resposta", undefined, { chars: resp.data.resposta.length });
      if (consultaRunId) {
        await authClient
          .from("agent_runs")
          .update({ status: "executed", result: { resposta_len: resp.data.resposta.length } })
          .eq("id", consultaRunId);
      }

      return jsonResponse(
        {
          sessionId,
          tipo: "resposta",
          resposta: resp.data.resposta,
          agentes: [meta],
          saldo,
        },
        200,
        req
      );
    } catch (e) {
      console.error("[ai-chat]", e);
      const headers = { ...getCorsHeaders(req), "Content-Type": "application/json" };
      return new Response(JSON.stringify({ error: "Erro ao processar a conversa" }), { status: 500, headers });
    }
  })
);
