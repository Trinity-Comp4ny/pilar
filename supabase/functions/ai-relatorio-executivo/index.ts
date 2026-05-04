import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  createAuthClient,
  createAdminClient,
  checkRateLimit,
  callGemini,
  saveInsight,
  type AiRequest,
} from "../_shared/ai-client.ts";

serve(
  withSentry("ai-relatorio-executivo", async (req) => {
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

      const { periodo } = await req.json(); // 'semanal' ou 'mensal'

      const now = new Date();
      const startDate =
        periodo === "semanal"
          ? new Date(now.getTime() - 7 * 86400000).toISOString().split("T")[0]
          : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

      // Coleta todos os dados relevantes
      const [receitasRes, despesasRes, projetosRes, leadsRes, pessoasRes] = await Promise.all([
        adminClient
          .from("receitas")
          .select("valor, status, data_recebimento")
          .eq("empresa_id", empresaId)
          .gte("data_vencimento", startDate)
          .is("deleted_at", null),
        adminClient
          .from("despesas")
          .select("valor, status, data_pagamento")
          .eq("empresa_id", empresaId)
          .gte("data_vencimento", startDate)
          .is("deleted_at", null),
        adminClient
          .from("projetos")
          .select("nome, codigo_projeto, status, data_previsao, valor_contrato")
          .eq("empresa_id", empresaId)
          .is("deleted_at", null)
          .in("status", ["Planejamento", "Em andamento"]),
        adminClient
          .from("leads")
          .select("nome, status")
          .eq("empresa_id", empresaId)
          .gte("created_at", startDate)
          .is("deleted_at", null),
        adminClient.from("pessoas").select("nome, cargo").eq("empresa_id", empresaId).is("deleted_at", null),
      ]);

      interface ReceitaRow {
        valor: number;
        status: string;
        data_recebimento: string | null;
      }
      interface DespesaRow {
        valor: number;
        status: string;
        data_pagamento: string | null;
      }
      interface ProjetoRow {
        nome: string;
        codigo_projeto: string;
        status: string;
        data_previsao: string | null;
        valor_contrato: number | null;
      }
      interface LeadRow {
        nome: string;
        status: string;
      }
      interface PessoaRow {
        nome: string;
        cargo: string;
      }

      const receitas = (receitasRes.data || []) as ReceitaRow[];
      const despesas = (despesasRes.data || []) as DespesaRow[];
      const projetos = (projetosRes.data || []) as ProjetoRow[];
      const leads = (leadsRes.data || []) as LeadRow[];
      const pessoas = (pessoasRes.data || []) as PessoaRow[];

      const totalRec = receitas.reduce((s: number, r) => s + Number(r.valor), 0);
      const totalDesp = despesas.reduce((s: number, d) => s + Number(d.valor), 0);

      const contexto = `
RELATÓRIO EXECUTIVO - Período: ${periodo === "semanal" ? "Última semana" : "Mês atual"}

FINANCEIRO:
- Receitas: R$ ${totalRec.toFixed(2)} (${receitas.filter((r) => r.status === "Recebido").length} recebidas)
- Despesas: R$ ${totalDesp.toFixed(2)} (${despesas.filter((d) => d.status === "Pago").length} pagas)
- Saldo: R$ ${(totalRec - totalDesp).toFixed(2)}

PROJETOS ATIVOS (${projetos.length}):
${projetos
  .slice(0, 15)
  .map(
    (p) =>
      `- ${p.codigo_projeto}: ${p.nome} (${p.status}, previsão: ${p.data_previsao || "?"}, R$ ${p.valor_contrato || 0})`
  )
  .join("\n")}

PIPELINE:
- ${leads.length} leads no período
- Novos: ${leads.filter((l) => l.status === "Novo").length}
- Em negociação: ${leads.filter((l) => l.status === "Negociação").length}
- Ganhos: ${leads.filter((l) => l.status === "Ganho").length}
- Perdidos: ${leads.filter((l) => l.status === "Perdido").length}

EQUIPE: ${pessoas.length} pessoas
`.trim();

      const aiRequest: AiRequest = {
        systemPrompt: `Você é um assistente executivo de um escritório de engenharia/arquitetura.
Gere um relatório executivo conciso e acionável para a reunião de diretoria.
Responda em português brasileiro. Retorne JSON:
{
  "resumo": "resumo executivo de 3-4 frases",
  "pipeline": { "texto": string, "destaque": string },
  "operacao": { "texto": string, "projetos_criticos": [string] },
  "financeiro": { "texto": string, "indicadores": { "receitas": number, "despesas": number, "margem_pct": number } },
  "equipe": { "texto": string },
  "caixa": { "texto": string },
  "decisoes_pendentes": [string],
  "recomendacoes": [string]
}`,
        userMessage: contexto,
        empresaId,
        tipo: "relatorio_executivo",
      };

      const aiResponse = await callGemini(aiRequest);
      const insight = await saveInsight(adminClient, aiRequest, aiResponse, user.id);

      return new Response(JSON.stringify(insight), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } catch (error: unknown) {
      const isAuthError =
        error instanceof Error && (error.message === "Não autenticado" || error.message === "Perfil não encontrado");
      const status = isAuthError ? 401 : 400;
      const message = isAuthError ? (error as Error).message : "Erro ao gerar relatório executivo";
      return new Response(JSON.stringify({ error: message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status,
      });
    }
  })
);
