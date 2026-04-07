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

    const { projeto_id, motivo_aditivo, descricao_mudanca } = await req.json();

    // Busca dados do projeto
    const { data: projeto } = await adminClient
      .from("projetos")
      .select("*, clientes(nome)")
      .eq("id", projeto_id)
      .eq("empresa_id", empresaId)
      .is("deleted_at", null)
      .single();

    if (!projeto) throw new Error("Projeto não encontrado");

    // Busca timesheets, marcos e histórico de aditivos
    const [{ data: timesheets }, { data: marcos }, { data: receitas }] = await Promise.all([
      adminClient
        .from("timesheets")
        .select("horas, pessoas(nome, cargo, custo_hora)")
        .eq("projeto_id", projeto_id),
      adminClient
        .from("billing_milestones")
        .select("*")
        .eq("projeto_id", projeto_id)
        .order("data_prevista", { ascending: true }),
      adminClient
        .from("receitas")
        .select("valor, descricao, data_competencia")
        .eq("projeto_id", projeto_id)
        .order("data_competencia", { ascending: true }),
    ]);

    const horasTotais = (timesheets || []).reduce((s: number, t: any) => s + (t.horas || 0), 0);
    const custoReal = (timesheets || []).reduce((s: number, t: any) => s + (t.horas || 0) * (t.pessoas?.custo_hora || 0), 0);
    const receitaTotal = (receitas || []).reduce((s: number, r: any) => s + (r.valor || 0), 0);

    const contexto = `
PROJETO: ${projeto.nome}
Cliente: ${projeto.clientes?.nome || "N/A"}
Valor contrato original: R$ ${projeto.valor_contrato || 0}
Orçamento atual: R$ ${projeto.orcamento || projeto.valor_contrato || 0}
Área: ${projeto.area_m2 || "N/A"} m²
Data início: ${projeto.data_inicio || "N/A"}
Data final prevista: ${projeto.data_final || "N/A"}
Disciplinas: ${projeto.disciplinas?.join(", ") || "N/A"}
Escopo original: ${projeto.escopo || "N/A"}

CONSUMO ATUAL:
- Horas realizadas: ${horasTotais}h
- Custo real da equipe: R$ ${custoReal.toFixed(2)}
- Receita já faturada: R$ ${receitaTotal.toFixed(2)}
- Margem atual: ${projeto.valor_contrato ? ((1 - custoReal / projeto.valor_contrato) * 100).toFixed(1) : "N/A"}%

MARCOS:
${(marcos || []).map((m: any) => `- ${m.descricao}: R$ ${m.valor} (${m.status})`).join("\n") || "Nenhum"}

MOTIVO DO ADITIVO: ${motivo_aditivo || "Não informado"}
DESCRIÇÃO DA MUDANÇA: ${descricao_mudanca || "Não informada"}
`.trim();

    const aiRequest: AiRequest = {
      systemPrompt: `Você é um consultor especializado em gestão de contratos de engenharia e arquitetura no Brasil.
Analise o projeto e a mudança solicitada para sugerir um aditivo contratual justo e bem fundamentado.
Considere o histórico de consumo, margem atual e complexidade da mudança.
Responda em português brasileiro. Retorne JSON:
{
  "resumo": "resumo da recomendação de aditivo",
  "analise_impacto": {
    "horas_adicionais_estimadas": number,
    "custo_adicional_estimado": number,
    "valor_aditivo_sugerido": number,
    "novo_prazo_sugerido": "YYYY-MM-DD ou null",
    "impacto_margem": "texto explicando impacto na rentabilidade"
  },
  "justificativa_tecnica": "texto de justificativa para apresentar ao cliente",
  "riscos": [{ "risco": string, "mitigacao": string }],
  "recomendacao": "aprovar_aditivo|renegociar_escopo|absorver_custo",
  "explicacao_recomendacao": "por que esta é a melhor abordagem",
  "clausulas_sugeridas": ["texto de cláusula para o aditivo"],
  "comparativo": {
    "contrato_original": number,
    "valor_aditivo": number,
    "novo_total": number,
    "variacao_pct": number
  }
}`,
      userMessage: contexto,
      empresaId,
      tipo: "aditivo_copilot",
      referenciaId: projeto_id,
      referenciaTipo: "projeto",
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
    const message = isAuthError ? (error as Error).message : "Erro ao gerar análise de aditivo";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  }
});
