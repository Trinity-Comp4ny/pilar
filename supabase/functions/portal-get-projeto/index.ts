import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isUUID, jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("portal-get-projeto");

serve(
  withSentry("portal-get-projeto", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

    try {
      const { token, projeto_id } = await req.json();
      if (!token || typeof token !== "string") return safeErrorResponse(400, "token obrigatório", req);
      if (!isUUID(projeto_id)) return safeErrorResponse(400, "projeto_id inválido", req);

      const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

      // Valida sessão via RPC read-only (hash do token + expiração deslizante, sem
      // rotacionar). Comparar o token puro na coluna hasheada nunca bate.
      const { data: session } = await admin.rpc("portal_verify_session_readonly", {
        p_token: token,
      });
      const account = session as { cliente_id: string; empresa_id: string } | null;

      if (!account) return safeErrorResponse(401, "Sessão inválida", req);

      // Busca projeto
      const { data: projeto } = await admin
        .from("projetos")
        .select(
          "id, nome, status, codigo_projeto, data_inicio, data_previsao, data_final, valor_contrato, cliente_id, empresa_id"
        )
        .eq("id", projeto_id)
        .eq("cliente_id", account.cliente_id)
        .eq("empresa_id", account.empresa_id)
        .is("deleted_at", null)
        .single();

      if (!projeto) return safeErrorResponse(404, "Projeto não encontrado", req);

      // Busca disciplinas
      const { data: disciplinasRaw } = await admin
        .from("projeto_disciplinas")
        .select("nome, status, data_inicio, data_fim, data_fim_real, id")
        .eq("projeto_id", projeto_id)
        .order("created_at");

      const disciplinaIds = (disciplinasRaw ?? []).map((pd) => pd.id);
      const { data: todosResps } = disciplinaIds.length
        ? await admin
            .from("projeto_disciplina_responsaveis")
            .select("projeto_disciplina_id, pessoas(nome)")
            .in("projeto_disciplina_id", disciplinaIds)
        : { data: [] };

      const respsByDisciplina = new Map<string, string[]>();
      for (const r of todosResps ?? []) {
        const nome = (r as unknown as { pessoas: { nome: string } | null }).pessoas?.nome;
        if (!nome) continue;
        const arr = respsByDisciplina.get(r.projeto_disciplina_id) ?? [];
        arr.push(nome);
        respsByDisciplina.set(r.projeto_disciplina_id, arr);
      }

      const disciplinas = (disciplinasRaw ?? []).map((pd) => ({
        disciplina: pd.nome,
        status: pd.status,
        data_inicio: pd.data_inicio,
        data_previsao: pd.data_fim,
        data_final: pd.data_fim_real,
        responsavel_nome: respsByDisciplina.get(pd.id)?.join(", ") || null,
      }));

      // Busca receitas
      const { data: receitas } = await admin
        .from("receitas")
        .select("id, descricao, valor, data_vencimento, data_recebimento, status")
        .eq("projeto_id", projeto_id)
        .is("deleted_at", null)
        .order("data_vencimento", { ascending: true });

      // Conta portal_entregas pendentes
      const { count: portalEntregasPendentes } = await admin
        .from("portal_entregas")
        .select("id", { count: "exact", head: true })
        .eq("projeto_id", projeto_id)
        .eq("status", "pendente");

      // Busca nomes de cliente e empresa
      const { data: cliente } = await admin.from("clientes").select("nome").eq("id", account.cliente_id).single();
      const { data: empresa } = await admin.from("empresas").select("nome").eq("id", account.empresa_id).single();

      return jsonResponse(
        {
          projeto_id: projeto.id,
          cliente_id: projeto.cliente_id,
          empresa_id: projeto.empresa_id,
          projeto_nome: projeto.nome,
          projeto_status: projeto.status,
          projeto_codigo: projeto.codigo_projeto,
          data_inicio: projeto.data_inicio,
          data_previsao: projeto.data_previsao,
          data_final: projeto.data_final,
          valor_contrato: projeto.valor_contrato,
          cliente_nome: cliente?.nome ?? "",
          empresa_nome: empresa?.nome ?? "",
          disciplinas,
          receitas: receitas ?? [],
          portal_entregas_pendentes: portalEntregasPendentes ?? 0,
        },
        200,
        req
      );
    } catch (err) {
      log.error("unexpected error", err, {});
      return safeErrorResponse(500, "Erro interno", req);
    }
  })
);
