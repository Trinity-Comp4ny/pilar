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

    // Busca clientes com receitas
    const { data: clientes } = await adminClient
      .from("clientes")
      .select("id, nome")
      .eq("empresa_id", empresaId)
      .is("deleted_at", null);

    // Receitas de todos os clientes
    const { data: receitas } = await adminClient
      .from("receitas")
      .select("cliente_id, valor, status, data_vencimento, data_recebimento")
      .eq("empresa_id", empresaId)
      .is("deleted_at", null);

    // Projetos por cliente
    const { data: projetos } = await adminClient
      .from("projetos")
      .select("id, cliente_id, nome, status, data_previsao, data_final")
      .eq("empresa_id", empresaId)
      .is("deleted_at", null);

    interface ClienteRow { id: string; nome: string }
    interface ReceitaRow { cliente_id: string; valor: number; status: string; data_vencimento: string; data_recebimento: string | null }
    interface ProjetoRow { id: string; cliente_id: string; nome: string; status: string; data_previsao: string | null; data_final: string | null }

    const clientesList = (clientes || []) as ClienteRow[];
    const receitasList = (receitas || []) as ReceitaRow[];
    const projetosList = (projetos || []) as ProjetoRow[];

    const clienteData = clientesList.map((c) => {
      const recs = receitasList.filter((r) => r.cliente_id === c.id);
      const projs = projetosList.filter((p) => p.cliente_id === c.id);
      const atrasadas = recs.filter((r) => r.status === "Pendente" && new Date(r.data_vencimento) < new Date());
      const totalFaturado = recs.reduce((s: number, r) => s + Number(r.valor), 0);
      const totalRecebido = recs.filter((r) => r.status === "Recebido").reduce((s: number, r) => s + Number(r.valor), 0);
      const projetosAtrasados = projs.filter((p) => p.data_previsao && !p.data_final && new Date(p.data_previsao) < new Date());

      return `- ${c.nome}: ${projs.length} projetos, faturado=R$${totalFaturado.toFixed(0)}, recebido=R$${totalRecebido.toFixed(0)}, ${atrasadas.length} receitas atrasadas (R$${atrasadas.reduce((s: number, r) => s + Number(r.valor), 0).toFixed(0)}), ${projetosAtrasados.length} projetos atrasados`;
    }).join("\n");

    const aiRequest: AiRequest = {
      systemPrompt: `Você é um analista de risco de clientes para escritórios de engenharia/arquitetura.
Classifique cada cliente por nível de risco.
Responda em português brasileiro. Retorne JSON:
{
  "resumo": "resumo geral",
  "clientes": [
    {
      "nome": string,
      "risk_score": number (0-100),
      "classificacao": "verde|amarelo|vermelho",
      "fatores": { "inadimplencia": string, "atrasos_aprovacao": string, "retrabalho": string, "scope_creep": string },
      "recomendacao": string
    }
  ],
  "recomendacoes_gerais": [string]
}`,
      userMessage: `CLIENTES DA EMPRESA:\n${clienteData}`,
      empresaId,
      tipo: "radar_cliente",
    };

    const aiResponse = await callGemini(aiRequest);
    const insight = await saveInsight(adminClient, aiRequest, aiResponse, user.id);

    return new Response(JSON.stringify(insight), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (error: unknown) {
    const isAuthError = error instanceof Error && (error.message === "Não autenticado" || error.message === "Perfil não encontrado");
    const status = isAuthError ? 401 : 400;
    const message = isAuthError ? (error as Error).message : "Erro ao gerar radar de clientes";
    return new Response(JSON.stringify({ error: message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status });
  }
});
