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

    // Busca dados completos para diagnóstico
    const [{ data: projetos }, { data: timesheets }, { data: pessoas }, { data: propostas }] = await Promise.all([
      adminClient
        .from("projetos")
        .select("id, nome, status, valor_contrato, orcamento, area_m2, tipologia, disciplinas, data_inicio, data_final, percentual_conclusao")
        .eq("empresa_id", empresaId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(30),
      adminClient
        .from("timesheets")
        .select("projeto_id, horas, pessoa_id, pessoas(custo_hora)")
        .eq("empresa_id", empresaId)
        .gte("data", new Date(Date.now() - 365 * 86400000).toISOString().split("T")[0]),
      adminClient
        .from("pessoas")
        .select("id, cargo, custo_hora, disciplinas")
        .eq("empresa_id", empresaId)
        .eq("ativo", true),
      adminClient
        .from("leads")
        .select("nome, valor_estimado, status, motivo_perda")
        .eq("empresa_id", empresaId)
        .in("status", ["Perdido", "Convertido"])
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    // Tipos para as queries
    interface TimesheetRow {
      projeto_id: string;
      horas: number;
      pessoa_id: string;
      pessoas: { custo_hora: number } | null;
    }
    interface ProjetoRow {
      id: string;
      nome: string;
      status: string;
      valor_contrato: number | null;
      orcamento: number | null;
      area_m2: number | null;
      tipologia: string | null;
      disciplinas: string[] | null;
      data_inicio: string | null;
      data_final: string | null;
      percentual_conclusao: number | null;
    }
    interface PessoaRow {
      id: string;
      cargo: string;
      custo_hora: number;
      disciplinas: string[] | null;
    }
    interface PropostaRow {
      nome: string;
      valor_estimado: number | null;
      status: string;
      motivo_perda: string | null;
    }

    // Calcula métricas por projeto
    const horasPorProjeto: Record<string, { horas: number; custo: number }> = {};
    for (const t of ((timesheets || []) as TimesheetRow[])) {
      if (!horasPorProjeto[t.projeto_id]) horasPorProjeto[t.projeto_id] = { horas: 0, custo: 0 };
      horasPorProjeto[t.projeto_id].horas += t.horas || 0;
      horasPorProjeto[t.projeto_id].custo += (t.horas || 0) * (t.pessoas?.custo_hora || 0);
    }

    interface ProjetoMetrica {
      nome: string;
      status: string;
      valor: number | null;
      area: number | null;
      tipologia: string | null;
      disciplinas: string[] | null;
      horas_realizadas: number;
      custo_real: number;
      margem_real_pct: string | undefined;
      valor_hora_real: string | undefined;
      valor_m2: string | undefined;
      concluido: number | null;
    }

    const projetosComMetricas: ProjetoMetrica[] = ((projetos || []) as ProjetoRow[]).map((p) => {
      const hp = horasPorProjeto[p.id] || { horas: 0, custo: 0 };
      const margemReal = p.valor_contrato ? (1 - hp.custo / p.valor_contrato) * 100 : null;
      const valorHoraReal = hp.horas > 0 && p.valor_contrato ? p.valor_contrato / hp.horas : null;
      const valorM2 = p.area_m2 && p.valor_contrato ? p.valor_contrato / p.area_m2 : null;
      return {
        nome: p.nome,
        status: p.status,
        valor: p.valor_contrato,
        area: p.area_m2,
        tipologia: p.tipologia,
        disciplinas: p.disciplinas,
        horas_realizadas: hp.horas,
        custo_real: hp.custo,
        margem_real_pct: margemReal?.toFixed(1),
        valor_hora_real: valorHoraReal?.toFixed(2),
        valor_m2: valorM2?.toFixed(2),
        concluido: p.percentual_conclusao,
      };
    });

    const projetosConcluidos = projetosComMetricas.filter((p) => p.status === "Concluído" && p.horas_realizadas > 0);
    const margemMedia = projetosConcluidos.length > 0
      ? projetosConcluidos.reduce((s: number, p) => s + parseFloat(p.margem_real_pct || "0"), 0) / projetosConcluidos.length
      : 0;
    const projetosComValorHora = projetosConcluidos.filter((p) => p.valor_hora_real);
    const valorHoraMedio = projetosComValorHora.length > 0
      ? projetosConcluidos.reduce((s: number, p) => s + parseFloat(p.valor_hora_real || "0"), 0) / projetosComValorHora.length
      : 0;

    const propostasPerdidasPreco = ((propostas || []) as PropostaRow[]).filter(
      (p) => p.status === "Perdido" && p.motivo_perda?.toLowerCase().includes("preço")
    );

    const contexto = `
DIAGNÓSTICO DE PRECIFICAÇÃO — ÚLTIMOS 12 MESES

MÉTRICAS GERAIS:
- Projetos analisados: ${projetosComMetricas.length}
- Projetos concluídos com timesheet: ${projetosConcluidos.length}
- Margem real média: ${margemMedia.toFixed(1)}%
- Valor/hora médio praticado: R$ ${valorHoraMedio.toFixed(2)}
- Propostas perdidas por preço: ${propostasPerdidasPreco.length}

CUSTO MÉDIO DA EQUIPE:
${((pessoas || []) as PessoaRow[]).map((p) => `- ${p.cargo} (${p.disciplinas?.join(", ") || "geral"}): R$ ${p.custo_hora}/h`).join("\n")}

PROJETOS DETALHADOS:
${projetosComMetricas.map((p) => `- ${p.nome} [${p.status}]: R$ ${p.valor || 0}, ${p.area || "?"}m², ${p.tipologia || "?"}, margem: ${p.margem_real_pct || "?"}%, R$/h: ${p.valor_hora_real || "?"}, R$/m²: ${p.valor_m2 || "?"}`).join("\n")}

PROPOSTAS PERDIDAS POR PREÇO:
${propostasPerdidasPreco.map((p) => `- ${p.nome}: R$ ${p.valor_estimado || 0}`).join("\n") || "Nenhuma registrada"}
`.trim();

    const aiRequest: AiRequest = {
      systemPrompt: `Você é um consultor de precificação especializado em escritórios de engenharia e arquitetura no Brasil.
Analise o histórico de projetos, margens e custos para diagnosticar a estratégia de precificação.
Identifique projetos subprecificados, padrões de perda e oportunidades de melhoria.
Responda em português brasileiro. Retorne JSON:
{
  "resumo": "resumo do diagnóstico de precificação",
  "saude_precificacao": "saudavel|atencao|critico",
  "metricas_chave": {
    "margem_media_pct": number,
    "valor_hora_medio": number,
    "valor_hora_recomendado": number,
    "projetos_com_margem_negativa": number,
    "taxa_perda_por_preco_pct": number
  },
  "projetos_subprecificados": [
    { "projeto": string, "margem_real_pct": number, "valor_hora_praticado": number, "valor_hora_ideal": number, "perda_estimada": number }
  ],
  "analise_por_tipologia": [
    { "tipologia": string, "margem_media_pct": number, "valor_m2_medio": number, "valor_m2_recomendado": number, "observacao": string }
  ],
  "analise_por_disciplina": [
    { "disciplina": string, "custo_hora_medio": number, "valor_cobrado_medio": number, "markup_atual": number, "markup_recomendado": number }
  ],
  "padroes_identificados": [string],
  "recomendacoes": [
    { "acao": string, "impacto_estimado": string, "prioridade": "alta|media|baixa" }
  ],
  "tabela_precos_sugerida": {
    "valor_hora_junior": number,
    "valor_hora_pleno": number,
    "valor_hora_senior": number,
    "valor_hora_coordenacao": number,
    "markup_sugerido_pct": number
  }
}`,
      userMessage: contexto,
      empresaId,
      tipo: "diagnostico_precificacao",
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
    const message = isAuthError ? (error as Error).message : "Erro ao gerar diagnóstico de precificação";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  }
});
