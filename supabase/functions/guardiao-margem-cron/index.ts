/**
 * guardiao-margem-cron — prepara um rascunho de aditivo quando um projeto estoura
 * o orçamento vivo (spec 081, continuação da spec 067).
 *
 * Deploy: supabase functions deploy guardiao-margem-cron --no-verify-jwt
 *
 * Deve ser chamada via cron com:
 *   Authorization: Bearer <SERVICE_ROLE_KEY>
 *
 * Responsabilidades:
 *  - Consulta projetos_com_escopo_estourado() (mesma condição do alerta
 *    'orcamento_excedido' em gerar_notificacoes_ambient(), fonte única).
 *  - Para cada projeto, gera via Gemini um rascunho de aditivo (itens + justificativa)
 *    e grava direto em escopos (tipo='aditivo', status='rascunho', created_by=NULL)
 *    + escopo_itens + agent_runs (com confidence preenchido).
 *  - Idempotente: projetos_com_escopo_estourado() já exclui quem tem aditivo em
 *    aberto, então rodar duas vezes no mesmo dia não duplica.
 *  - Aprovação é humana, na aba Escopo do projeto — este cron nunca aprova nada.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withSentry, captureException } from "../_shared/sentry.ts";
import { createLogger } from "../_shared/logger.ts";
import { callGeminiStructured, verificarTokens, debitarTokens, GEMINI_MODEL } from "../_shared/ai-client.ts";
import { AditivoSugeridoSchema } from "../_shared/agent-schemas.ts";

const log = createLogger("guardiao-margem-cron");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface ProjetoEstourado {
  projeto_id: string;
  empresa_id: string;
  nome: string;
  custo_orcado: number;
  despesas_diretas: number;
}

function systemPrompt(): string {
  return [
    "Você é o Guardião de Margem do Pilar, um sistema de gestão para escritórios de",
    "engenharia e arquitetura. Um projeto gastou mais do que o orçamento aprovado previa.",
    "Prepare um RASCUNHO de aditivo contratual que cubra essa diferença, para um humano",
    "revisar e aprovar depois — você NUNCA aprova nada, só sugere.",
    "",
    "Responda em português do Brasil. Seja concreto e conservador: não infle valores,",
    "não invente disciplinas que não fazem sentido para o contexto dado. Se a diferença",
    "for pequena, o aditivo também deve ser pequeno.",
    "",
    "`confianca` (0 a 1) reflete o quanto você confia nesta sugestão dado o contexto",
    "disponível: baixa se o motivo do estouro não está claro, alta se as despesas",
    "descrevem claramente o que gerou o excesso.",
  ].join("\n");
}

function userMessage(p: ProjetoEstourado): string {
  const diferenca = p.despesas_diretas - p.custo_orcado;
  return [
    `Projeto: ${p.nome}`,
    `Orçamento aprovado: R$ ${p.custo_orcado.toFixed(2)}`,
    `Despesas diretas já lançadas: R$ ${p.despesas_diretas.toFixed(2)}`,
    `Diferença a cobrir: R$ ${diferenca.toFixed(2)}`,
    "",
    "Prepare o rascunho de aditivo que cobre essa diferença.",
  ].join("\n");
}

serve(
  withSentry("guardiao-margem-cron", async (req) => {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token || token !== SERVICE_ROLE_KEY) {
      return new Response("Unauthorized", { status: 401 });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: estourados, error: queryErr } = await admin.rpc("projetos_com_escopo_estourado");
    if (queryErr) {
      log.error("falha ao consultar projetos_com_escopo_estourado", queryErr);
      return new Response(JSON.stringify({ error: queryErr.message }), { status: 500 });
    }

    const projetos = (estourados ?? []) as ProjetoEstourado[];
    log.info("projetos estourados encontrados", { count: projetos.length });

    let criados = 0;
    let falhas = 0;

    for (const p of projetos) {
      try {
        const gate = await verificarTokens(admin, p.empresa_id);
        if (!gate.ok) {
          log.warn("empresa sem tokens, pulando", { empresa_id: p.empresa_id, projeto_id: p.projeto_id });
          continue;
        }

        const result = await callGeminiStructured(
          {
            systemPrompt: systemPrompt(),
            userMessage: userMessage(p),
            empresaId: p.empresa_id,
            tipo: "guardiao_margem",
            referenciaId: p.projeto_id,
            referenciaTipo: "projeto",
          },
          AditivoSugeridoSchema,
          { maxRetries: 1, maxOutputTokens: 2048 }
        );

        const { data: escopo, error: escopoErr } = await admin
          .from("escopos")
          .insert({
            empresa_id: p.empresa_id,
            projeto_id: p.projeto_id,
            descricao: result.data.descricao,
            tipo: "aditivo",
            status: "rascunho",
            horas_estimadas: result.data.itens.reduce((s, i) => s + (i.horas ?? 0), 0),
            custo_estimado: result.data.itens.reduce((s, i) => s + i.custo, 0),
            valor_aditivo: Math.round(result.data.itens.reduce((s, i) => s + i.custo, 0) * 1.3 * 100) / 100,
            justificativa: result.data.justificativa,
            created_by: null,
            updated_by: null,
          })
          .select("id")
          .single();

        if (escopoErr || !escopo) {
          throw new Error(`falha ao criar escopo: ${escopoErr?.message ?? "sem retorno"}`);
        }

        const { error: itensErr } = await admin.from("escopo_itens").insert(
          result.data.itens.map((i) => ({
            escopo_id: escopo.id,
            descricao: i.descricao,
            disciplina: i.disciplina ?? null,
            horas: i.horas ?? 0,
            custo: i.custo,
          }))
        );
        if (itensErr) {
          log.error("falha ao gravar escopo_itens (escopo já criado)", itensErr, { escopo_id: escopo.id });
        }

        const { error: runErr } = await admin.from("agent_runs").insert({
          empresa_id: p.empresa_id,
          agent_type: "guardiao_margem",
          status: "executed",
          entity_type: "escopo",
          entity_id: escopo.id,
          input: { projeto_id: p.projeto_id, custo_orcado: p.custo_orcado, despesas_diretas: p.despesas_diretas },
          result: result.data,
          confidence: result.data.confianca,
          model: GEMINI_MODEL,
          tokens_input: result.tokensEntrada,
          tokens_output: result.tokensSaida,
          created_by: null,
        });
        if (runErr) {
          log.error("falha ao gravar agent_runs (escopo já criado)", runErr, { escopo_id: escopo.id });
        }

        await debitarTokens(admin, {
          empresaId: p.empresa_id,
          userId: null,
          agentKey: "guardiao_margem",
          agentRunId: null,
          model: GEMINI_MODEL,
          tokensInput: result.tokensEntrada,
          tokensOutput: result.tokensSaida,
          idempotencyKey: `guardiao_margem:${escopo.id}`,
          calls: result.attempts,
        });

        criados++;
        log.info("aditivo rascunho criado", { projeto_id: p.projeto_id, escopo_id: escopo.id });
      } catch (e) {
        falhas++;
        log.error("falha ao preparar aditivo do projeto", e, { projeto_id: p.projeto_id, empresa_id: p.empresa_id });
        await captureException(e, { fn: "guardiao-margem-cron", tags: { projeto_id: p.projeto_id } });
      }
    }

    return new Response(JSON.stringify({ encontrados: projetos.length, criados, falhas }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  })
);
