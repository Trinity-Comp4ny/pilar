import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { authenticateUser, isUUID, jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { sendEmail, templateProximaEtapa } from "../_shared/email.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("notify-next-stage");

interface DiscRow {
  id: string;
  nome: string;
  status: string;
  ordem_etapa: number | null;
  projeto_id: string;
}

interface RespRow {
  projeto_disciplina_id: string;
  pessoas: { id: string; nome: string; email: string } | null;
}

serve(
  withSentry("notify-next-stage", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

    const auth = await authenticateUser(req);
    if (auth.error) return auth.error;
    const { supabase: supabaseClient, user } = auth;

    try {
      const { data: profile, error: profileError } = await supabaseClient
        .from("profiles")
        .select("empresa_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.empresa_id) {
        return safeErrorResponse(403, "Perfil sem empresa", req);
      }

      const { disciplina_id } = await req.json();
      if (!isUUID(disciplina_id)) return safeErrorResponse(400, "disciplina_id inválido", req);

      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const { data: discConcluida, error: discError } = await supabaseAdmin
        .from("projeto_disciplinas")
        .select("id, nome, status, ordem_etapa, projeto_id, projetos!inner(empresa_id, nome)")
        .eq("id", disciplina_id)
        .single();

      if (discError || !discConcluida) return safeErrorResponse(404, "Disciplina não encontrada", req);

      const disc = discConcluida as unknown as DiscRow & { projetos: { empresa_id: string; nome: string } };
      if (disc.projetos.empresa_id !== profile.empresa_id) return safeErrorResponse(403, "Acesso negado", req);
      if (disc.ordem_etapa === null) {
        return jsonResponse({ success: true, skipped: "sem ordem_etapa", notificados: 0 }, 200, req);
      }

      const { data: etapaAtual } = await supabaseAdmin
        .from("projeto_disciplinas")
        .select("status")
        .eq("projeto_id", disc.projeto_id)
        .eq("ordem_etapa", disc.ordem_etapa);

      const etapaCompleta = (etapaAtual || []).every((d) => d.status === "Concluído");
      if (!etapaCompleta) {
        return jsonResponse({ success: true, skipped: "etapa ainda tem pendências", notificados: 0 }, 200, req);
      }

      const { data: proximas } = await supabaseAdmin
        .from("projeto_disciplinas")
        .select("id, nome")
        .eq("projeto_id", disc.projeto_id)
        .eq("ordem_etapa", disc.ordem_etapa + 1);

      if (!proximas || proximas.length === 0) {
        return jsonResponse({ success: true, skipped: "sem próxima etapa", notificados: 0 }, 200, req);
      }

      const proximasIds = proximas.map((p) => p.id);
      const { data: resps } = await supabaseAdmin
        .from("projeto_disciplina_responsaveis")
        .select("projeto_disciplina_id, pessoas(id, nome, email)")
        .in("projeto_disciplina_id", proximasIds);

      const respRows = (resps || []) as unknown as RespRow[];
      const discMap = new Map(proximas.map((p) => [p.id, p.nome]));

      const enviados: string[] = [];
      const erros: string[] = [];

      for (const row of respRows) {
        const pessoa = row.pessoas;
        if (!pessoa?.email) continue;
        const discNome = discMap.get(row.projeto_disciplina_id) || "sua disciplina";

        try {
          await sendEmail({
            to: pessoa.email,
            subject: `Próxima etapa liberada: ${discNome}`,
            html: templateProximaEtapa(pessoa.nome, disc.projetos.nome, disc.nome, discNome),
          });
          enviados.push(pessoa.email);
        } catch (err) {
          erros.push(`${pessoa.email}: ${err instanceof Error ? err.message : "erro"}`);
        }
      }

      return jsonResponse({ success: true, notificados: enviados.length, enviados, erros }, 200, req);
    } catch (err) {
      log.error("notify next stage failed", err, { user_id: user.id });
      return safeErrorResponse(500, "Erro ao notificar próxima etapa", req);
    }
  })
);
