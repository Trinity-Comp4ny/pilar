import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  createAuthClient,
  createAdminClient,
  checkRateLimit,
  callGemini,
  saveInsight,
  type AiRequest,
} from "../_shared/ai-client.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authClient = createAuthClient(req);
    const adminClient = createAdminClient();

    const { data: { user }, error: userError } = await authClient.auth.getUser();
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

    const { cenario } = await req.json();
    // cenario: { tipo: "perda_cliente" | "novo_projeto" | "aumento_custo" | "atraso_projeto" | "contratacao" | "custom", descricao: string, parametros: any }

    // Busca panorama financeiro completo
    const now = new Date();
    const mesAtual = now.getMonth() + 1;
    const anoAtual = now.getFullYear();

    const [{ data: projetos }, { data: receitas }, { data: despesas }, { data: pessoas }, { data: leads }] =
      await Promise.all([
        adminClient
          .from("projetos")
          .select("id, nome, status, valor_contrato, orcamento, data_inicio, data_final, percentual_conclusao")
          .eq("empresa_id", empresaId)
          .in("status", ["Em andamento", "Não iniciado"])
          .is("deleted_at", null),
        adminClient
          .from("receitas")
          .select("valor, status, data_competencia, projeto_id")
          .eq("empresa_id", empresaId)
          .gte("data_competencia", `${anoAtual}-01-01`),
        adminClient
          .from("despesas")
          .select("valor, categoria, data_competencia, recorrente")
          .eq("empresa_id", empresaId)
          .gte("data_competencia", `${anoAtual}-01-01`),
        adminClient
          .from("pessoas")
          .select("nome, cargo, custo_hora, carga_horaria_mensal, tipo_contrato")
          .eq("empresa_id", empresaId)
          .eq("ativo", true),
        adminClient
          .from("leads")
          .select("nome, valor_estimado, probabilidade, status")
          .eq("empresa_id", empresaId)
          .in("status", ["Qualificado", "Proposta Enviada"]),
      ]);

    const receitaTotal = (receitas || []).reduce((s: number, r: any) => s + (r.valor || 0), 0);
    const despesaTotal = (despesas || []).reduce((s: number, d: any) => s + (d.valor || 0), 0);
    const folhaMensal = (pessoas || []).reduce(
      (s: number, p: any) => s + (p.custo_hora || 0) * (p.carga_horaria_mensal || 160),
      0
    );
    const despesasRecorrentes = (despesas || [])
      .filter((d: any) => d.recorrente)
      .reduce((s: number, d: any) => s + (d.valor || 0), 0) / mesAtual;
    const pipelineValor = (leads || []).reduce(
      (s: number, l: any) => s + (l.valor_estimado || 0) * ((l.probabilidade || 0) / 100),
      0
    );

    const contexto = `
CENÁRIO A SIMULAR:
Tipo: ${cenario?.tipo || "custom"}
Descrição: ${cenario?.descricao || "Não informada"}
Parâmetros: ${JSON.stringify(cenario?.parametros || {})}

SITUAÇÃO FINANCEIRA ATUAL (${anoAtual}):
- Receita acumulada YTD: R$ ${receitaTotal.toFixed(2)}
- Despesa acumulada YTD: R$ ${despesaTotal.toFixed(2)}
- Margem YTD: ${receitaTotal > 0 ? ((1 - despesaTotal / receitaTotal) * 100).toFixed(1) : 0}%
- Folha mensal estimada: R$ ${folhaMensal.toFixed(2)}
- Despesas recorrentes mensais: R$ ${despesasRecorrentes.toFixed(2)}
- Custo fixo mensal total: R$ ${(folhaMensal + despesasRecorrentes).toFixed(2)}

PROJETOS ATIVOS (${(projetos || []).length}):
${(projetos || []).map((p: any) => `- ${p.nome}: R$ ${p.valor_contrato || 0}, ${p.percentual_conclusao || 0}% concluído, previsão: ${p.data_final || "N/A"}`).join("\n")}

PIPELINE PONDERADO: R$ ${pipelineValor.toFixed(2)}
${(leads || []).map((l: any) => `- ${l.nome}: R$ ${l.valor_estimado || 0} x ${l.probabilidade}% = R$ ${((l.valor_estimado || 0) * (l.probabilidade || 0) / 100).toFixed(2)}`).join("\n") || "Nenhum lead"}

EQUIPE (${(pessoas || []).length}):
${(pessoas || []).map((p: any) => `- ${p.nome} (${p.cargo}): R$ ${p.custo_hora}/h, ${p.tipo_contrato}`).join("\n")}
`.trim();

    const aiRequest: AiRequest = {
      systemPrompt: `Você é um analista financeiro especializado em escritórios de engenharia e arquitetura no Brasil.
Simule o impacto do cenário descrito sobre a operação do escritório.
Projete consequências financeiras, operacionais e estratégicas para os próximos 6 meses.
Responda em português brasileiro. Retorne JSON:
{
  "resumo": "resumo do impacto simulado",
  "cenario_analisado": string,
  "impacto_financeiro": {
    "receita_mensal_antes": number,
    "receita_mensal_depois": number,
    "variacao_receita_pct": number,
    "despesa_mensal_antes": number,
    "despesa_mensal_depois": number,
    "variacao_despesa_pct": number,
    "margem_antes_pct": number,
    "margem_depois_pct": number,
    "meses_ate_break_even": number
  },
  "impacto_operacional": {
    "equipe": string,
    "capacidade": string,
    "projetos_afetados": [string]
  },
  "projecao_6_meses": [
    { "mes": string, "receita": number, "despesa": number, "resultado": number, "caixa_acumulado": number }
  ],
  "riscos": [{ "risco": string, "probabilidade": "alta|media|baixa", "mitigacao": string }],
  "oportunidades": [string],
  "recomendacoes": [{ "acao": string, "prioridade": "urgente|alta|media", "impacto_estimado": string }],
  "veredito": "favoravel|neutro|desfavoravel"
}`,
      userMessage: contexto,
      empresaId,
      tipo: "simulacao_impacto",
    };

    const aiResponse = await callGemini(aiRequest);
    const insight = await saveInsight(adminClient, aiRequest, aiResponse, user.id);

    return new Response(JSON.stringify(insight), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const isAuthError = error instanceof Error &&
      (error.message === "Não autenticado" || error.message === "Perfil não encontrado");
    const status = isAuthError ? 401 : 400;
    const message = isAuthError ? (error as Error).message : "Erro ao gerar simulação de impacto";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  }
});
