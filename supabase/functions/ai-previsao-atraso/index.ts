import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createAuthClient, createAdminClient, checkRateLimit, callGemini, saveInsight, type AiRequest } from "../_shared/ai-client.ts";

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
      return new Response(JSON.stringify({ error: "Limite mensal atingido" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 });
    }

    // Busca projetos ativos
    const { data: projetos } = await adminClient
      .from("projetos")
      .select("id, nome, codigo_projeto, status, data_inicio, data_previsao, data_final, valor_contrato, disciplinas")
      .eq("empresa_id", empresaId)
      .is("deleted_at", null)
      .in("status", ["Planejamento", "Em andamento"]);

    // Busca horas consumidas por projeto
    const { data: timesheets } = await adminClient
      .from("timesheets")
      .select("projeto_id, horas")
      .eq("empresa_id", empresaId)
      .eq("status", "aprovado")
      .is("deleted_at", null);

    const horasPorProjeto = (timesheets || []).reduce((acc: any, t: any) => {
      acc[t.projeto_id] = (acc[t.projeto_id] || 0) + Number(t.horas);
      return acc;
    }, {});

    // Busca receitas por projeto
    const { data: receitas } = await adminClient
      .from("receitas")
      .select("projeto_id, valor, status")
      .eq("empresa_id", empresaId)
      .is("deleted_at", null);

    const receitasPorProjeto = (receitas || []).reduce((acc: any, r: any) => {
      if (!acc[r.projeto_id]) acc[r.projeto_id] = { total: 0, recebido: 0 };
      acc[r.projeto_id].total += Number(r.valor);
      if (r.status === "Recebido") acc[r.projeto_id].recebido += Number(r.valor);
      return acc;
    }, {});

    // Projetos concluídos para histórico
    const { data: concluidos } = await adminClient
      .from("projetos")
      .select("data_inicio, data_previsao, data_final")
      .eq("empresa_id", empresaId)
      .eq("status", "Concluído")
      .is("deleted_at", null)
      .limit(50);

    const taxaAtraso = (concluidos || []).filter((p: any) => p.data_final && p.data_previsao && new Date(p.data_final) > new Date(p.data_previsao)).length / Math.max((concluidos || []).length, 1) * 100;

    const contexto = `
PROJETOS ATIVOS (${(projetos || []).length}):
${(projetos || []).map((p: any) => {
  const disc = Array.isArray(p.disciplinas) ? p.disciplinas : [];
  const concluidas = disc.filter((d: any) => d.status === "Concluído").length;
  const rec = receitasPorProjeto[p.id] || { total: 0, recebido: 0 };
  return `- ${p.codigo_projeto} "${p.nome}": status=${p.status}, início=${p.data_inicio || "?"}, previsão=${p.data_previsao || "?"}, contrato=R$${p.valor_contrato || 0}, disciplinas=${concluidas}/${disc.length} concluídas, horas=${horasPorProjeto[p.id] || 0}h, receitas=R$${rec.recebido}/R$${rec.total}`;
}).join("\n")}

HISTÓRICO: Taxa de atraso em projetos concluídos: ${taxaAtraso.toFixed(0)}% (${(concluidos || []).length} projetos)
`.trim();

    const aiRequest: AiRequest = {
      systemPrompt: `Você é um analista de riscos para escritórios de engenharia/arquitetura.
Analise cada projeto ativo e preveja probabilidade de atraso e estouro.
Responda em português brasileiro. Retorne JSON:
{
  "resumo": "resumo geral",
  "projetos": [
    {
      "projeto_id": string,
      "nome": string,
      "probabilidade_atraso": number (0-100),
      "probabilidade_estouro": number (0-100),
      "classificacao": "verde|amarelo|vermelho",
      "fatores_risco": [string],
      "recomendacao": string
    }
  ],
  "recomendacoes_gerais": [string]
}`,
      userMessage: contexto,
      empresaId,
      tipo: "previsao_atraso",
    };

    const aiResponse = await callGemini(aiRequest);
    const insight = await saveInsight(adminClient, aiRequest, aiResponse, user.id);

    return new Response(JSON.stringify(insight), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (error: unknown) {
    const isAuthError = error instanceof Error && (error.message === "Não autenticado" || error.message === "Perfil não encontrado");
    const status = isAuthError ? 401 : 400;
    const message = isAuthError ? (error as Error).message : "Erro ao gerar previsão de atraso";
    return new Response(JSON.stringify({ error: message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status });
  }
});
