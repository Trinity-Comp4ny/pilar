import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  createAuthClient,
  createAdminClient,
  checkRateLimit,
  callGemini,
  debitarTokens,
  GEMINI_MODEL,
  recordAgentRun,
  type AiRequest,
} from "../_shared/ai-client.ts";

serve(
  withSentry("ai-fechamento-mensal", async (req) => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    try {
      const authClient = createAuthClient(req);
      const adminClient = createAdminClient();

      // Autenticação
      const {
        data: { user },
        error: userError,
      } = await authClient.auth.getUser();
      if (userError || !user) throw new Error("Não autenticado");

      // Busca empresa
      const { data: profile } = await authClient.from("profiles").select("empresa_id").eq("id", user.id).single();
      if (!profile) throw new Error("Perfil não encontrado");

      const empresaId = profile.empresa_id;

      // Rate limit
      const canProceed = await checkRateLimit(adminClient, empresaId);
      if (!canProceed) {
        return new Response(JSON.stringify({ error: "Limite mensal de consultas IA atingido" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 429,
        });
      }

      // Parâmetros
      const { mes, ano } = await req.json();
      const targetMes = mes || new Date().getMonth() + 1;
      const targetAno = ano || new Date().getFullYear();

      // Coleta dados financeiros do mês
      const startDate = `${targetAno}-${String(targetMes).padStart(2, "0")}-01`;
      const endDate = new Date(targetAno, targetMes, 0).toISOString().split("T")[0];

      const prevMes = targetMes === 1 ? 12 : targetMes - 1;
      const prevAno = targetMes === 1 ? targetAno - 1 : targetAno;
      const prevStart = `${prevAno}-${String(prevMes).padStart(2, "0")}-01`;
      const prevEnd = new Date(prevAno, prevMes, 0).toISOString().split("T")[0];

      // Queries em paralelo
      const [
        receitasRes,
        despesasRes,
        receitasPrevRes,
        despesasPrevRes,
        projetosRes,
        folhaRes,
        leadsRes,
        despesasFuturas,
      ] = await Promise.all([
        adminClient
          .from("receitas")
          .select("valor, status, projeto_id, categoria_id")
          .eq("empresa_id", empresaId)
          .gte("data_vencimento", startDate)
          .lte("data_vencimento", endDate)
          .is("deleted_at", null),
        adminClient
          .from("despesas")
          .select("valor, status, projeto_id, categoria_id")
          .eq("empresa_id", empresaId)
          .gte("data_vencimento", startDate)
          .lte("data_vencimento", endDate)
          .is("deleted_at", null),
        adminClient
          .from("receitas")
          .select("valor, status")
          .eq("empresa_id", empresaId)
          .gte("data_vencimento", prevStart)
          .lte("data_vencimento", prevEnd)
          .is("deleted_at", null),
        adminClient
          .from("despesas")
          .select("valor, status")
          .eq("empresa_id", empresaId)
          .gte("data_vencimento", prevStart)
          .lte("data_vencimento", prevEnd)
          .is("deleted_at", null),
        adminClient
          .from("projetos")
          .select("id, nome, status, valor_contrato")
          .eq("empresa_id", empresaId)
          .is("deleted_at", null)
          .in("status", ["Planejamento", "Em andamento"]),
        adminClient
          .from("folha_pagamento")
          .select("total_receber, status")
          .eq("empresa_id", empresaId)
          .eq("mes", targetMes)
          .eq("ano", targetAno),
        adminClient
          .from("leads")
          .select("id, status")
          .eq("empresa_id", empresaId)
          .gte("created_at", startDate)
          .is("deleted_at", null),
        adminClient
          .from("despesas")
          .select("valor, data_vencimento, descricao")
          .eq("empresa_id", empresaId)
          .eq("status", "Pendente")
          .gte("data_vencimento", endDate)
          .is("deleted_at", null)
          .order("data_vencimento")
          .limit(20),
      ]);

      interface ReceitaRow {
        valor: number;
        status: string;
        projeto_id: string;
        categoria_id: string;
      }
      interface DespesaRow {
        valor: number;
        status: string;
        projeto_id: string;
        categoria_id: string;
      }
      interface ReceitaPrevRow {
        valor: number;
        status: string;
      }
      interface DespesaPrevRow {
        valor: number;
        status: string;
      }
      interface ProjetoRow {
        id: string;
        nome: string;
        status: string;
        valor_contrato: number | null;
      }
      interface FolhaRow {
        total_receber: number;
        status: string;
      }
      interface LeadRow {
        id: string;
        status: string;
      }
      interface DespesaFuturaRow {
        valor: number;
        data_vencimento: string;
        descricao: string;
      }

      const receitas = (receitasRes.data || []) as ReceitaRow[];
      const despesas = (despesasRes.data || []) as DespesaRow[];
      const receitasPrev = (receitasPrevRes.data || []) as ReceitaPrevRow[];
      const despesasPrev = (despesasPrevRes.data || []) as DespesaPrevRow[];
      const projetos = (projetosRes.data || []) as ProjetoRow[];
      const folha = (folhaRes.data || []) as FolhaRow[];
      const leads = (leadsRes.data || []) as LeadRow[];
      const futuras = (despesasFuturas.data || []) as DespesaFuturaRow[];

      const totalReceitas = receitas.reduce((s: number, r) => s + Number(r.valor), 0);
      const totalReceitasRecebidas = receitas
        .filter((r) => r.status === "Recebido")
        .reduce((s: number, r) => s + Number(r.valor), 0);
      const totalDespesas = despesas.reduce((s: number, d) => s + Number(d.valor), 0);
      const totalDespesasPagas = despesas
        .filter((d) => d.status === "Pago")
        .reduce((s: number, d) => s + Number(d.valor), 0);
      const totalReceitasPrev = receitasPrev.reduce((s: number, r) => s + Number(r.valor), 0);
      const totalDespesasPrev = despesasPrev.reduce((s: number, d) => s + Number(d.valor), 0);
      const totalFolha = folha.reduce((s: number, f) => s + Number(f.total_receber), 0);
      const leadsNovos = leads.length;
      const leadsGanhos = leads.filter((l) => l.status === "Ganho").length;
      const despesasFuturasTotal = futuras.reduce((s: number, d) => s + Number(d.valor), 0);

      const contexto = `
DADOS FINANCEIROS - ${String(targetMes).padStart(2, "0")}/${targetAno}:

MÊS ATUAL:
- Receitas totais: R$ ${totalReceitas.toFixed(2)} (recebidas: R$ ${totalReceitasRecebidas.toFixed(2)})
- Despesas totais: R$ ${totalDespesas.toFixed(2)} (pagas: R$ ${totalDespesasPagas.toFixed(2)})
- Margem bruta: R$ ${(totalReceitas - totalDespesas).toFixed(2)} (${totalReceitas > 0 ? (((totalReceitas - totalDespesas) / totalReceitas) * 100).toFixed(1) : 0}%)
- Folha de pagamento: R$ ${totalFolha.toFixed(2)}

MÊS ANTERIOR (${String(prevMes).padStart(2, "0")}/${prevAno}):
- Receitas: R$ ${totalReceitasPrev.toFixed(2)}
- Despesas: R$ ${totalDespesasPrev.toFixed(2)}

PROJETOS ATIVOS: ${projetos.length}
${projetos
  .slice(0, 10)
  .map((p) => `- ${p.nome} (${p.status}, contrato: R$ ${p.valor_contrato || 0})`)
  .join("\n")}

PIPELINE:
- Leads novos no mês: ${leadsNovos}
- Leads convertidos: ${leadsGanhos}

DESPESAS FUTURAS (próximos 60 dias): R$ ${despesasFuturasTotal.toFixed(2)}
${futuras
  .slice(0, 5)
  .map((d) => `- ${d.descricao}: R$ ${d.valor} (${d.data_vencimento})`)
  .join("\n")}
`.trim();

      const aiRequest: AiRequest = {
        systemPrompt: `Você é um consultor financeiro especializado em escritórios de engenharia e arquitetura.
Analise os dados financeiros do mês e forneça um relatório executivo de fechamento mensal.
Responda SEMPRE em português brasileiro.
Retorne um JSON com esta estrutura:
{
  "resumo": "resumo executivo de 2-3 frases",
  "margem_analise": { "atual_pct": number, "anterior_pct": number, "variacao": string, "explicacao": string },
  "projetos_destaque": [{ "nome": string, "observacao": string, "impacto": "positivo|negativo|neutro" }],
  "gargalos_equipe": string,
  "pipeline_mudancas": string,
  "ameacas_caixa": [{ "descricao": string, "valor": number, "prazo": string }],
  "recomendacoes": [string]
}`,
        userMessage: contexto,
        empresaId,
        tipo: "fechamento_mensal",
        mesReferencia: targetMes,
        anoReferencia: targetAno,
      };

      const aiResponse = await callGemini(aiRequest);
      const runId = await recordAgentRun(adminClient, aiRequest, aiResponse, user.id);
      await debitarTokens(adminClient, {
        empresaId,
        userId: user.id,
        agentKey: aiRequest.tipo,
        agentRunId: runId,
        model: GEMINI_MODEL,
        tokensInput: aiResponse.tokensEntrada,
        tokensOutput: aiResponse.tokensSaida,
        idempotencyKey: crypto.randomUUID(),
      });

      return new Response(JSON.stringify(aiResponse), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } catch (error: unknown) {
      const isAuthError =
        error instanceof Error && (error.message === "Não autenticado" || error.message === "Perfil não encontrado");
      const status = isAuthError ? 401 : 400;
      const message = isAuthError ? (error as Error).message : "Erro ao gerar fechamento mensal";
      return new Response(JSON.stringify({ error: message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status,
      });
    }
  })
);
