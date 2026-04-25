import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { authenticateUser, isUUID, jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { sendEmail, templateNotificacaoProjeto } from "../_shared/email.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

  const auth = await authenticateUser(req);
  if (auth.error) return auth.error;
  const { supabase: userClient, user } = auth;

  try {
    const { projetoId, novoStatus } = await req.json();

    if (!isUUID(projetoId)) return safeErrorResponse(400, "projetoId inválido", req);
    if (!novoStatus || typeof novoStatus !== "string") {
      return safeErrorResponse(400, "novoStatus obrigatório", req);
    }

    // Garante que o projeto pertence à empresa do usuário autenticado
    const { data: profile } = await userClient.from("profiles").select("empresa_id").eq("id", user.id).single();

    if (!profile?.empresa_id) return safeErrorResponse(403, "Perfil sem empresa", req);

    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const { data: projeto } = await admin
      .from("projetos")
      .select("nome, empresa_id")
      .eq("id", projetoId)
      .eq("empresa_id", profile.empresa_id)
      .single();

    if (!projeto) return safeErrorResponse(404, "Projeto não encontrado", req);

    // Busca pessoas alocadas ao projeto com email
    const { data: alocacoes } = await admin
      .from("alocacoes")
      .select("pessoas(id, nome, email)")
      .eq("projeto_id", projetoId)
      .eq("empresa_id", profile.empresa_id);

    if (!alocacoes?.length) {
      return jsonResponse({ success: true, notified: 0 }, 200, req);
    }

    // Deduplica por email
    const seen = new Set<string>();
    const destinatarios: { nome: string; email: string }[] = [];

    for (const a of alocacoes) {
      const pessoa = (a as unknown as { pessoas: { nome: string; email: string } | null }).pessoas;
      if (pessoa?.email && !seen.has(pessoa.email)) {
        seen.add(pessoa.email);
        destinatarios.push(pessoa);
      }
    }

    await Promise.allSettled(
      destinatarios.map(({ nome, email }) =>
        sendEmail({
          to: email,
          subject: `Atualização: projeto "${projeto.nome}" → ${novoStatus}`,
          html: templateNotificacaoProjeto(nome, projeto.nome, novoStatus),
        })
      )
    );

    return jsonResponse({ success: true, notified: destinatarios.length }, 200, req);
  } catch (err) {
    console.error("[notify-project-people]", err);
    return safeErrorResponse(500, "Erro ao enviar notificações", req);
  }
});
