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

    const { horizonte_meses } = await req.json();
    const meses = horizonte_meses || 6;

    // Busca equipe atual, projetos ativos, pipeline e timesheets
    const [{ data: pessoas }, { data: projetosAtivos }, { data: leads }, { data: timesheets }] = await Promise.all([
      adminClient
        .from("pessoas")
        .select("id, nome, cargo, disciplinas, tipo_contrato, custo_hora, carga_horaria_mensal, ativo")
        .eq("empresa_id", empresaId)
        .eq("ativo", true),
      adminClient
        .from("projetos")
        .select("id, nome, status, data_inicio, data_final, disciplinas, valor_contrato")
        .eq("empresa_id", empresaId)
        .in("status", ["Em andamento", "Não iniciado"])
        .is("deleted_at", null),
      adminClient
        .from("leads")
        .select("nome, valor_estimado, probabilidade, status, disciplinas")
        .eq("empresa_id", empresaId)
        .in("status", ["Qualificado", "Proposta Enviada"]),
      adminClient
        .from("timesheets")
        .select("pessoa_id, horas, data")
        .eq("empresa_id", empresaId)
        .gte("data", new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0]),
    ]);

    // Calcula utilização por pessoa nos últimos 3 meses
    const utilizacaoPorPessoa: Record<string, number> = {};
    for (const t of (timesheets || [])) {
      utilizacaoPorPessoa[t.pessoa_id] = (utilizacaoPorPessoa[t.pessoa_id] || 0) + (t.horas || 0);
    }

    const equipeResumo = (pessoas || []).map((p: any) => ({
      nome: p.nome,
      cargo: p.cargo,
      disciplinas: p.disciplinas,
      tipo: p.tipo_contrato,
      custo_hora: p.custo_hora,
      carga_mensal: p.carga_horaria_mensal,
      horas_3m: utilizacaoPorPessoa[p.id] || 0,
      utilizacao_pct: p.carga_horaria_mensal
        ? ((utilizacaoPorPessoa[p.id] || 0) / (p.carga_horaria_mensal * 3) * 100).toFixed(1)
        : "N/A",
    }));

    // Disciplinas demandadas pelos projetos ativos
    const disciplinasDemanda: Record<string, number> = {};
    for (const p of (projetosAtivos || [])) {
      for (const d of (p.disciplinas || [])) {
        disciplinasDemanda[d] = (disciplinasDemanda[d] || 0) + 1;
      }
    }

    const contexto = `
EQUIPE ATUAL (${equipeResumo.length} pessoas):
${equipeResumo.map((p: any) => `- ${p.nome} (${p.cargo}): ${p.disciplinas?.join(", ") || "geral"}, ${p.tipo}, R$ ${p.custo_hora}/h, utilização 3m: ${p.utilizacao_pct}%`).join("\n")}

PROJETOS ATIVOS (${(projetosAtivos || []).length}):
${(projetosAtivos || []).map((p: any) => `- ${p.nome}: ${p.status}, disciplinas: ${p.disciplinas?.join(", ") || "N/A"}, previsão: ${p.data_final || "N/A"}`).join("\n")}

PIPELINE (leads qualificados):
${(leads || []).map((l: any) => `- ${l.nome}: R$ ${l.valor_estimado || 0}, ${l.probabilidade || 0}% prob., disciplinas: ${l.disciplinas?.join(", ") || "N/A"}`).join("\n") || "Nenhum"}

DEMANDA POR DISCIPLINA (projetos ativos):
${Object.entries(disciplinasDemanda).map(([d, n]) => `- ${d}: ${n} projetos`).join("\n") || "N/A"}

HORIZONTE DE PLANEJAMENTO: ${meses} meses
`.trim();

    const aiRequest: AiRequest = {
      systemPrompt: `Você é um consultor de RH especializado em escritórios de engenharia e arquitetura no Brasil.
Analise a equipe, carga de trabalho, pipeline e projete necessidades de contratação.
Responda em português brasileiro. Retorne JSON:
{
  "resumo": "resumo da análise de contratação",
  "capacidade_atual": {
    "total_pessoas": number,
    "utilizacao_media_pct": number,
    "gargalos": [{ "disciplina": string, "severidade": "critico|alto|medio", "motivo": string }],
    "ociosidade": [{ "disciplina": string, "pessoas": [string], "motivo": string }]
  },
  "projecao_demanda": {
    "cenario_conservador": { "horas_mensais": number, "pessoas_necessarias": number },
    "cenario_otimista": { "horas_mensais": number, "pessoas_necessarias": number }
  },
  "contratacoes_recomendadas": [
    {
      "cargo": string,
      "disciplina": string,
      "prioridade": "urgente|alta|media|baixa",
      "tipo_sugerido": "CLT|PJ|Freelancer|Estagiário",
      "faixa_salarial": { "min": number, "max": number },
      "justificativa": string,
      "prazo_ideal": "YYYY-MM"
    }
  ],
  "alternativas": [string],
  "investimento_mensal_estimado": number,
  "roi_esperado": string
}`,
      userMessage: contexto,
      empresaId,
      tipo: "planejador_contratacao",
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
    const message = isAuthError ? (error as Error).message : "Erro ao gerar planejamento de contratação";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  }
});
