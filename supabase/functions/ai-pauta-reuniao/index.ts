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

    const { tipo_reuniao, projeto_id, participantes_contexto } = await req.json();

    // Busca dados contextuais em paralelo
    const now = new Date();
    const mesAtual = now.getMonth() + 1;
    const anoAtual = now.getFullYear();

    interface ProjetoRow { id: string; nome: string; status: string; data_final: string | null; valor_contrato: number | null; percentual_conclusao: number | null; prioridade: string | null }
    interface ReceitaPendenteRow { valor: number; descricao: string; status: string; projeto_id: string }
    interface LeadAtivoRow { nome: string; valor_estimado: number | null; status: string; probabilidade: number | null }
    interface ProjetoDetalheRow { nome: string; status: string; valor_contrato: number | null; clientes: { nome: string } | null; [key: string]: unknown }
    interface TimesheetRow { horas: number; data: string; pessoas: { nome: string } | null }

    interface SupabaseQueryResult {
      data: unknown[] | Record<string, unknown> | null;
      error: unknown;
    }

    const queries: Promise<SupabaseQueryResult>[] = [
      // Projetos ativos com alertas
      adminClient
        .from("projetos")
        .select("id, nome, status, data_final, valor_contrato, percentual_conclusao, prioridade")
        .eq("empresa_id", empresaId)
        .in("status", ["Em andamento", "Parado", "Em revisão"])
        .is("deleted_at", null)
        .order("prioridade", { ascending: false })
        .limit(15),
      // Receitas pendentes
      adminClient
        .from("receitas")
        .select("valor, descricao, status, projeto_id")
        .eq("empresa_id", empresaId)
        .eq("status", "Pendente")
        .limit(20),
      // Leads ativos
      adminClient
        .from("leads")
        .select("nome, valor_estimado, status, probabilidade")
        .eq("empresa_id", empresaId)
        .in("status", ["Novo", "Qualificado", "Proposta Enviada"])
        .limit(10),
    ];

    // Se for reunião de projeto específico, busca detalhes
    if (projeto_id) {
      queries.push(
        adminClient
          .from("projetos")
          .select("*, clientes(nome)")
          .eq("id", projeto_id)
          .single()
      );
      queries.push(
        adminClient
          .from("timesheets")
          .select("horas, data, pessoas(nome)")
          .eq("projeto_id", projeto_id)
          .gte("data", new Date(anoAtual, mesAtual - 2, 1).toISOString().split("T")[0])
          .order("data", { ascending: false })
          .limit(30)
      );
    }

    const results = await Promise.all(queries);
    const projetosAtivos = (results[0].data || []) as ProjetoRow[];
    const receitasPendentes = (results[1].data || []) as ReceitaPendenteRow[];
    const leadsAtivos = (results[2].data || []) as LeadAtivoRow[];
    const projetoDetalhe = projeto_id ? results[3]?.data as ProjetoDetalheRow | null : null;
    const timesheetsRecentes = projeto_id ? ((results[4]?.data || []) as TimesheetRow[]) : [] as TimesheetRow[];

    const projetosAtrasados = projetosAtivos.filter((p) =>
      p.data_final && new Date(p.data_final) < now
    );
    const totalPendente = receitasPendentes.reduce((s: number, r) => s + (r.valor || 0), 0);

    const contexto = `
TIPO DE REUNIÃO: ${tipo_reuniao || "diretoria"}
DATA: ${now.toLocaleDateString("pt-BR")}
CONTEXTO ADICIONAL: ${participantes_contexto || "N/A"}

PANORAMA GERAL:
- Projetos ativos: ${projetosAtivos.length}
- Projetos atrasados: ${projetosAtrasados.length}
- Receitas pendentes: R$ ${totalPendente.toFixed(2)} (${receitasPendentes.length} itens)
- Leads ativos: ${leadsAtivos.length} (R$ ${leadsAtivos.reduce((s: number, l) => s + (l.valor_estimado || 0), 0).toFixed(2)} pipeline)

PROJETOS COM ATENÇÃO:
${projetosAtrasados.map((p) => `- ⚠️ ${p.nome}: atrasado (previsão: ${p.data_final}), ${p.percentual_conclusao || 0}% concluído`).join("\n") || "Nenhum projeto atrasado"}

PROJETOS ATIVOS TOP:
${projetosAtivos.slice(0, 8).map((p) => `- ${p.nome}: ${p.status}, ${p.percentual_conclusao || 0}% concluído, prioridade ${p.prioridade || "N/A"}`).join("\n")}

PIPELINE COMERCIAL:
${leadsAtivos.map((l) => `- ${l.nome}: ${l.status}, R$ ${l.valor_estimado || 0} (${l.probabilidade || 0}%)`).join("\n") || "Nenhum lead ativo"}

${projetoDetalhe ? `
PROJETO ESPECÍFICO (${projetoDetalhe.nome}):
- Cliente: ${projetoDetalhe.clientes?.nome || "N/A"}
- Valor: R$ ${projetoDetalhe.valor_contrato || 0}
- Status: ${projetoDetalhe.status}
- Horas recentes: ${timesheetsRecentes.reduce((s: number, t) => s + (t.horas || 0), 0)}h
` : ""}
`.trim();

    const aiRequest: AiRequest = {
      systemPrompt: `Você é um facilitador de reuniões especializado em escritórios de engenharia e arquitetura.
Gere uma pauta de reunião estruturada, com tópicos priorizados e tempo estimado para cada item.
Responda em português brasileiro. Retorne JSON:
{
  "resumo": "objetivo principal da reunião",
  "tipo_reuniao": "${tipo_reuniao || "diretoria"}",
  "duracao_sugerida_min": number,
  "pauta": [
    {
      "ordem": number,
      "topico": string,
      "descricao": string,
      "responsavel_sugerido": string,
      "tempo_min": number,
      "prioridade": "alta|media|baixa",
      "dados_apoio": string
    }
  ],
  "decisoes_pendentes": [string],
  "metricas_acompanhar": [{ "metrica": string, "valor_atual": string }],
  "proximos_passos_sugeridos": [string]
}

Tipos de reunião:
- "diretoria": Reunião de diretoria/sócios — foco em estratégia, financeiro, pipeline
- "projeto": Reunião de acompanhamento de projeto específico
- "comercial": Reunião comercial — foco em leads, propostas, captação
- "operacional": Reunião operacional — equipe, capacidade, timesheets`,
      userMessage: contexto,
      empresaId,
      tipo: "pauta_reuniao",
      referenciaId: projeto_id || undefined,
      referenciaTipo: projeto_id ? "projeto" : undefined,
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
    const message = isAuthError ? (error as Error).message : "Erro ao gerar pauta de reunião";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  }
});
