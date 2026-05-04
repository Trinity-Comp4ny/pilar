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

interface TimesheetRow {
  horas: number | null;
  pessoas: { nome: string; cargo: string } | null;
}

interface MarcoRow {
  descricao: string;
  valor: number;
  status: string;
  data_prevista: string;
}

serve(
  withSentry("ai-documentos", async (req) => {
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

      const { projeto_id, tipo_documento } = await req.json();

      // Busca dados do projeto
      const { data: projeto } = await adminClient
        .from("projetos")
        .select("*, clientes(nome, email, telefone)")
        .eq("id", projeto_id)
        .eq("empresa_id", empresaId)
        .is("deleted_at", null)
        .single();

      if (!projeto) throw new Error("Projeto não encontrado");

      // Busca marcos e timesheets do projeto
      const [{ data: marcos }, { data: timesheets }] = await Promise.all([
        adminClient
          .from("billing_milestones")
          .select("*")
          .eq("projeto_id", projeto_id)
          .order("data_prevista", { ascending: true }),
        adminClient
          .from("timesheets")
          .select("*, pessoas(nome, cargo)")
          .eq("projeto_id", projeto_id)
          .order("data", { ascending: false })
          .limit(50),
      ]);

      const horasTotais = (timesheets || []).reduce((s: number, t: TimesheetRow) => s + (t.horas || 0), 0);

      const contexto = `
PROJETO: ${projeto.nome}
Cliente: ${projeto.clientes?.nome || "N/A"}
Status: ${projeto.status}
Valor contrato: R$ ${projeto.valor_contrato || 0}
Área: ${projeto.area_m2 || "N/A"} m²
Data início: ${projeto.data_inicio || "N/A"}
Data final prevista: ${projeto.data_final || "N/A"}
Disciplinas: ${projeto.disciplinas?.join(", ") || "N/A"}
Escopo: ${projeto.escopo || "N/A"}

MARCOS DO PROJETO:
${(marcos || []).map((m: MarcoRow) => `- ${m.descricao}: R$ ${m.valor} (${m.status}) - previsto: ${m.data_prevista}`).join("\n") || "Nenhum marco registrado"}

HORAS REGISTRADAS: ${horasTotais}h
Equipe envolvida: ${[...new Set((timesheets || []).map((t: TimesheetRow) => t.pessoas?.nome).filter(Boolean))].join(", ") || "N/A"}

TIPO DE DOCUMENTO SOLICITADO: ${tipo_documento}
`.trim();

      const aiRequest: AiRequest = {
        systemPrompt: `Você é um assistente especializado em documentação técnica para escritórios de engenharia e arquitetura no Brasil.
Gere o documento solicitado com base nos dados do projeto. Use linguagem profissional e formal.
Responda em português brasileiro. Retorne JSON:
{
  "resumo": "breve descrição do documento gerado",
  "titulo": "título do documento",
  "tipo_documento": "${tipo_documento}",
  "conteudo_documento": "texto completo do documento em formato markdown",
  "secoes": [{ "titulo": string, "conteudo": string }],
  "metadados": { "data_emissao": string, "versao": "1.0", "projeto": string, "cliente": string }
}

Tipos de documento aceitos:
- "ata_reuniao": Ata de reunião de acompanhamento
- "relatorio_progresso": Relatório de progresso do projeto
- "termo_encerramento": Termo de encerramento de projeto
- "memorial_descritivo": Memorial descritivo técnico
- "ordem_servico": Ordem de serviço`,
        userMessage: contexto,
        empresaId,
        tipo: "documentos",
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
      const isAuthError =
        error instanceof Error && (error.message === "Não autenticado" || error.message === "Perfil não encontrado");
      const status = isAuthError ? 401 : 400;
      const message = isAuthError ? (error as Error).message : "Erro ao gerar documento";
      return new Response(JSON.stringify({ error: message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status,
      });
    }
  })
);
