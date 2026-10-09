/**
 * guardiao-margem-cron — prepara um rascunho de aditivo quando um projeto estoura
 * o orçamento vivo (spec 081, continuação da spec 067).
 *
 * Deploy: supabase functions deploy guardiao-margem-cron --no-verify-jwt
 *
 * Deve ser chamada via cron com:
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Responsabilidades:
 *  - Consulta projetos_com_escopo_estourado() (mesma condição do alerta
 *    'orcamento_excedido' em gerar_notificacoes_ambient(), fonte única).
 *  - Para cada projeto, carrega a evidência (orçamento por disciplina + despesas), pede ao
 *    Gemini um rascunho de aditivo em que cada item cita as despesas que o sustentam, e
 *    aterra a resposta em código (aditivo.ts, spec 107): citação inválida é descartada e
 *    custo/horas/valor saem da diferença e das despesas, nunca do modelo. Grava em escopos
 *    (tipo='aditivo', status='rascunho', created_by=NULL) + escopo_itens + agent_runs.
 *  - Idempotente: projetos_com_escopo_estourado() já exclui quem tem aditivo em
 *    aberto, então rodar duas vezes no mesmo dia não duplica.
 *  - Aprovação é humana, na aba Escopo do projeto — este cron nunca aprova nada.
 *  - Notifica quem vê financeiro (notificar_aditivo_pronto, categoria financeiro)
 *    que há um rascunho esperando decisão — sem isso, só descobre quem abre /agentes.
 *  - Faz check-in no Sentry Crons (monitor guardiao-margem-daily) pra detectar se o
 *    job parou de rodar, já que ele é fire-and-forget do lado do agendador SQL.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withSentry, captureException, cronCheckin } from "../_shared/sentry.ts";
import { createLogger } from "../_shared/logger.ts";
import { callGeminiStructured, verificarTokens, debitarTokens, GEMINI_MODEL } from "../_shared/ai-client.ts";
import { montarAditivoSugeridoSchema } from "../_shared/agent-schemas.ts";
import {
  aterrarAditivo,
  type DespesaEvidencia,
  type Evidencia,
  MAX_DESPESAS_NO_PROMPT,
  type ProjetoEstourado,
  systemPrompt,
  userMessage,
} from "./aditivo.ts";

const log = createLogger("guardiao-margem-cron");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
// Segredo próprio do cron: ver notificacoes-email-cron/index.ts.
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

type Admin = SupabaseClient;

/** Nome de uma relação embutida do PostgREST, que pode vir como objeto ou lista. */
function nomeEmbutido(rel: unknown): string | null {
  const alvo = Array.isArray(rel) ? rel[0] : rel;
  if (alvo && typeof alvo === "object" && "nome" in alvo && typeof alvo.nome === "string") return alvo.nome;
  return null;
}

/**
 * Evidência do estouro (spec 107): fases do orçamento e as despesas que entram na conta,
 * com o mesmo filtro de projetos_com_escopo_estourado() (não deletadas, Pago/Pendente).
 */
async function carregarEvidencia(admin: Admin, p: ProjetoEstourado): Promise<Evidencia> {
  const [fasesRes, despesasRes] = await Promise.all([
    admin
      .from("projeto_orcamento_fases")
      .select("disciplina, custo_estimado, custo_hora")
      .eq("projeto_id", p.projeto_id)
      .is("deleted_at", null),
    admin
      .from("despesas")
      .select("id, descricao, valor, data_competencia, categorias_financeiras(nome), fornecedores(nome)", {
        count: "exact",
      })
      .eq("projeto_id", p.projeto_id)
      .is("deleted_at", null)
      .in("status", ["Pago", "Pendente"])
      .order("valor", { ascending: false })
      .limit(MAX_DESPESAS_NO_PROMPT),
  ]);
  if (fasesRes.error) throw new Error(`falha ao ler orçamento: ${fasesRes.error.message}`);
  if (despesasRes.error) throw new Error(`falha ao ler despesas: ${despesasRes.error.message}`);

  const despesas: DespesaEvidencia[] = (despesasRes.data ?? []).map((d) => ({
    id: d.id as string,
    descricao: (d.descricao as string) ?? "",
    valor: Number(d.valor) || 0,
    data: (d.data_competencia as string | null) ?? null,
    categoria: nomeEmbutido(d.categorias_financeiras),
    fornecedor: nomeEmbutido(d.fornecedores),
  }));
  const somaEnviadas = despesas.reduce((s, d) => s + d.valor, 0);

  return {
    fases: (fasesRes.data ?? []).map((f) => ({
      disciplina: f.disciplina as string,
      custo_estimado: Number(f.custo_estimado) || 0,
      custo_hora: Number(f.custo_hora) || 0,
    })),
    despesas,
    foraDoPrompt: {
      quantidade: Math.max((despesasRes.count ?? despesas.length) - despesas.length, 0),
      total: Math.max(Math.round((p.despesas_diretas - somaEnviadas) * 100) / 100, 0),
    },
  };
}

serve(
  withSentry("guardiao-margem-cron", async (req) => {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token || !CRON_SECRET || token !== CRON_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Check-in de heartbeat (Sentry Crons): este job só dispara via net.http_post
    // (fire-and-forget) do lado SQL, então o check-in em SQL não confirmaria que a
    // function de fato terminou — por isso ele vem de dentro dela mesma.
    const checkInId = await cronCheckin("guardiao-margem-daily", "in_progress");

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: estourados, error: queryErr } = await admin.rpc("projetos_com_escopo_estourado");
    if (queryErr) {
      log.error("falha ao consultar projetos_com_escopo_estourado", queryErr);
      await cronCheckin("guardiao-margem-daily", "error", checkInId);
      await admin.rpc("registrar_heartbeat_agente", {
        p_agent_type: "guardiao_margem_cron",
        p_status: "failed",
        p_detail: { error: queryErr.message },
      });
      return new Response(JSON.stringify({ error: queryErr.message }), { status: 500 });
    }

    const projetos = (estourados ?? []) as ProjetoEstourado[];
    log.info("projetos estourados encontrados", { count: projetos.length });

    let criados = 0;
    let falhas = 0;
    // empresa_id -> qtd de projetos pulados por falta de créditos de IA. Antes disso
    // era só um log.warn interno: o usuário nunca ficava sabendo que um projeto
    // estourado ficou sem análise.
    const puladosSemCreditos = new Map<string, number>();

    for (const p of projetos) {
      try {
        const gate = await verificarTokens(admin, p.empresa_id);
        if (!gate.ok) {
          log.warn("empresa sem tokens, pulando", { empresa_id: p.empresa_id, projeto_id: p.projeto_id });
          puladosSemCreditos.set(p.empresa_id, (puladosSemCreditos.get(p.empresa_id) ?? 0) + 1);
          continue;
        }

        const evidencia = await carregarEvidencia(admin, p);
        if (evidencia.fases.length === 0 || evidencia.despesas.length === 0) {
          throw new Error("projeto estourado sem fase de orçamento ou sem despesa para citar");
        }

        const result = await callGeminiStructured(
          {
            systemPrompt: systemPrompt(),
            userMessage: userMessage(p, evidencia),
            empresaId: p.empresa_id,
            tipo: "guardiao_margem",
            referenciaId: p.projeto_id,
            referenciaTipo: "projeto",
          },
          montarAditivoSugeridoSchema(evidencia.fases.map((f) => f.disciplina)),
          { maxRetries: 2 }
        );

        const aditivo = aterrarAditivo(result.data, evidencia, p.despesas_diretas - p.custo_orcado);
        if (!aditivo) {
          throw new Error("sugestão sem nenhum item sustentado por despesa da lista");
        }

        const { data: escopo, error: escopoErr } = await admin
          .from("escopos")
          .insert({
            empresa_id: p.empresa_id,
            projeto_id: p.projeto_id,
            descricao: aditivo.descricao,
            tipo: "aditivo",
            status: "rascunho",
            horas_estimadas: aditivo.horasTotal,
            custo_estimado: aditivo.custoTotal,
            valor_aditivo: aditivo.valorAditivo,
            justificativa: aditivo.justificativa,
            created_by: null,
            updated_by: null,
          })
          .select("id")
          .single();

        if (escopoErr || !escopo) {
          throw new Error(`falha ao criar escopo: ${escopoErr?.message ?? "sem retorno"}`);
        }

        const { error: itensErr } = await admin.from("escopo_itens").insert(
          aditivo.itens.map((i) => ({
            escopo_id: escopo.id,
            descricao: i.descricao,
            disciplina: i.disciplina,
            horas: i.horas,
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
          input: {
            projeto_id: p.projeto_id,
            custo_orcado: p.custo_orcado,
            despesas_diretas: p.despesas_diretas,
            despesas_no_prompt: evidencia.despesas.length,
            despesas_fora_do_prompt: evidencia.foraDoPrompt.quantidade,
          },
          // Sugestão crua + o que foi gravado + o que o código descartou (spec 107).
          result: { sugestao: result.data, itens: aditivo.itens, reparos: aditivo.reparos },
          confidence: aditivo.confianca,
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

        // Avisa quem vê financeiro que há um rascunho esperando decisão: sem isso, a
        // única forma de descobrir é abrir /agentes por conta própria (o badge no
        // sidebar já ajuda, mas ninguém é avisado ativamente).
        const { error: notifErr } = await admin.rpc("notificar_aditivo_pronto", {
          p_empresa_id: p.empresa_id,
          p_projeto_id: p.projeto_id,
          p_projeto_nome: p.nome,
          p_valor: aditivo.custoTotal,
        });
        if (notifErr) {
          log.error("falha ao notificar aditivo pronto (escopo já criado)", notifErr, { escopo_id: escopo.id });
        }

        criados++;
        log.info("aditivo rascunho criado", { projeto_id: p.projeto_id, escopo_id: escopo.id });
      } catch (e) {
        falhas++;
        log.error("falha ao preparar aditivo do projeto", e, { projeto_id: p.projeto_id, empresa_id: p.empresa_id });
        await captureException(e, { fn: "guardiao-margem-cron", tags: { projeto_id: p.projeto_id } });
      }
    }

    await cronCheckin("guardiao-margem-daily", "ok", checkInId);

    for (const [empresaId, qtd] of puladosSemCreditos) {
      const { error: notifErr } = await admin.rpc("notificar_guardiao_sem_creditos", {
        p_empresa_id: empresaId,
        p_qtd_projetos: qtd,
      });
      if (notifErr) {
        log.error("falha ao notificar créditos insuficientes", notifErr, { empresa_id: empresaId });
      }
    }

    await admin.rpc("registrar_heartbeat_agente", {
      p_agent_type: "guardiao_margem_cron",
      p_status: falhas > 0 ? "partial_failure" : "ok",
      p_detail: { encontrados: projetos.length, criados, falhas, pulados_sem_creditos: puladosSemCreditos.size },
    });

    return new Response(JSON.stringify({ encontrados: projetos.length, criados, falhas }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  })
);
