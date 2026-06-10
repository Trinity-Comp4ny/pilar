import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  createAuthClient,
  createAdminClient,
  checkRateLimit,
  callGeminiStructured,
  recordAiUsage,
  type AiRequest,
} from "../_shared/ai-client.ts";
import { OrcamentoSchema } from "../_shared/agent-schemas.ts";

serve(
  withSentry("ai-proposta-copilot", async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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

      const empresaId = profile.empresa_id;
      if (!(await checkRateLimit(adminClient, empresaId))) {
        return new Response(JSON.stringify({ error: "Limite mensal atingido" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 429,
        });
      }

      const { briefing, area_m2, tipologia, disciplinas, prazo_dias, projeto_id } = await req.json();

      // Busca projetos históricos similares
      const { data: historicos } = await adminClient
        .from("projetos")
        .select("nome, area_m2, valor_contrato, data_inicio, data_final, status")
        .eq("empresa_id", empresaId)
        .eq("status", "Concluído")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(20);

      interface ProjetoHistRow {
        nome: string;
        area_m2: number | null;
        valor_contrato: number | null;
        data_inicio: string | null;
        data_final: string | null;
        status: string;
      }
      interface ProjetoHistMetrica {
        nome: string;
        area: number | null;
        valor: number | null;
        duracao_dias: number | null;
      }

      const projetosHist: ProjetoHistMetrica[] = ((historicos || []) as ProjetoHistRow[]).map((p) => ({
        nome: p.nome,
        area: p.area_m2,
        valor: p.valor_contrato,
        duracao_dias:
          p.data_inicio && p.data_final
            ? Math.round((new Date(p.data_final).getTime() - new Date(p.data_inicio).getTime()) / 86400000)
            : null,
      }));

      const projetosComAreaValor = projetosHist.filter(
        (p): p is ProjetoHistMetrica & { area: number; valor: number } =>
          p.area != null && p.area > 0 && p.valor != null && p.valor > 0
      );
      const valorMedioM2 =
        projetosComAreaValor.length > 0
          ? projetosComAreaValor.reduce((s: number, p) => s + p.valor / p.area, 0) / projetosComAreaValor.length
          : 0;

      const contexto = `
BRIEFING DO CLIENTE:
${briefing || "Não fornecido"}

DADOS DA PROPOSTA:
- Área: ${area_m2 || "não informada"} m²
- Tipologia: ${tipologia || "não informada"}
- Disciplinas: ${disciplinas?.join(", ") || "não informadas"}
- Prazo desejado: ${prazo_dias || "não informado"} dias

HISTÓRICO DO ESCRITÓRIO (últimos 20 projetos concluídos):
${projetosHist.map((p) => `- ${p.nome}: ${p.area}m², R$ ${p.valor}, ${p.duracao_dias} dias`).join("\n")}

Valor médio por m² do escritório: R$ ${valorMedioM2.toFixed(2)}/m²
`.trim();

      const aiRequest: AiRequest = {
        systemPrompt: `Você é um consultor especializado em orçamento de honorários para escritórios de engenharia e arquitetura no Brasil.
Com base no briefing e no histórico do escritório, monte um orçamento de honorários detalhado por disciplina.
Use o histórico para calibrar horas e custo/hora realistas. Responda em português brasileiro.
Retorne APENAS JSON neste formato exato:
{
  "resumo": "resumo executivo do orçamento",
  "fases": [{ "disciplina": "Arquitetura", "horas_estimadas": 120, "custo_hora": 90, "margem_alvo_pct": 30, "observacao": "opcional" }],
  "premissas": ["premissa adotada"],
  "riscos": ["risco identificado"],
  "perguntas_faltantes": ["informação que falta para refinar"]
}`,
        userMessage: contexto,
        empresaId,
        tipo: "orcamento_honorarios",
      };

      // Gera o orçamento com saída validada por schema (retry + erro explícito, sem fallback silencioso)
      const gen = await callGeminiStructured(aiRequest, OrcamentoSchema);

      // Grava o draft em agent_runs aguardando revisão humana no cockpit
      const { data: run, error: runErr } = await adminClient
        .from("agent_runs")
        .insert({
          empresa_id: empresaId,
          agent_type: "orcamento_honorarios",
          status: "pending_review",
          entity_type: projeto_id ? "projeto" : null,
          entity_id: projeto_id ?? null,
          input: { briefing, area_m2, tipologia, disciplinas, prazo_dias },
          result: gen.data,
          model: "gemini-2.0-flash",
          tokens_input: gen.tokensEntrada,
          tokens_output: gen.tokensSaida,
          created_by: user.id,
        })
        .select()
        .single();
      if (runErr) throw runErr;

      const runId = (run as { id: string }).id;

      // Audit trail dos passos do agente (exibido como log de raciocínio no cockpit)
      await adminClient.from("agent_actions").insert([
        {
          run_id: runId,
          tool_name: "get_project_context",
          args: { projetos_historicos: projetosHist.length, valor_medio_m2: Number(valorMedioM2.toFixed(2)) },
        },
        {
          run_id: runId,
          tool_name: "generate_orcamento",
          args: { attempts: gen.attempts, fases: gen.data.fases.length },
        },
      ]);

      // Contabiliza uso (alimenta rate limit mensal + log granular por feature)
      await recordAiUsage(adminClient, empresaId, "orcamento_honorarios", gen.tokensEntrada, gen.tokensSaida);

      return new Response(JSON.stringify(run), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } catch (error: unknown) {
      const isAuthError =
        error instanceof Error && (error.message === "Não autenticado" || error.message === "Perfil não encontrado");
      const status = isAuthError ? 401 : 400;
      const message = isAuthError ? (error as Error).message : "Erro ao gerar orçamento";
      return new Response(JSON.stringify({ error: message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status,
      });
    }
  })
);
