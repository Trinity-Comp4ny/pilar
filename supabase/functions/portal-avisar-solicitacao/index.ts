import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { authenticateUser, jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { sendEmail, templateSolicitacaoCliente } from "../_shared/email/index.ts";
import { createLogger } from "../_shared/logger.ts";
import { checkDbRateLimit } from "../_shared/db-rate-limit.ts";
import { lerJson } from "../_shared/schemas.ts";
import { lerEntrada } from "./entrada.ts";

const log = createLogger("portal-avisar-solicitacao");

/**
 * Avisa por e-mail os acessos do portal do cliente de que o escritório criou uma solicitação
 * (projeto ou obra). Quem chama é a equipe logada: a solicitação é lida com o token dela, então a
 * RLS de portal_entregas decide se ela pode mexer naquele item.
 */
serve(
  withSentry("portal-avisar-solicitacao", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

    const auth = await authenticateUser(req);
    if (auth.error) return auth.error;
    const { supabase: supabaseUser, user } = auth;

    try {
      const entrada = lerEntrada(await lerJson(req));
      if (!entrada.ok) return safeErrorResponse(400, entrada.error, req);

      const { data: entrega } = await supabaseUser
        .from("portal_entregas")
        .select("id, empresa_id, titulo, descricao, status, projeto_id, obra_id")
        .eq("id", entrada.data.entrega_id)
        .maybeSingle();
      if (!entrega) return safeErrorResponse(404, "Solicitação não encontrada", req);
      if (entrega.status !== "pendente") return jsonResponse({ enviados: 0, motivo: "ja_respondida" }, 200, req);

      const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

      const rl = await checkDbRateLimit(admin, {
        bucket: "portal_avisar_solicitacao",
        key: `uid:${user.id}`,
        max: 60,
        windowSeconds: 3600,
      });
      if (rl.rpcError) {
        log.error("rate limit check failed, fail-closed", null, { rpcError: rl.rpcError });
        return safeErrorResponse(503, "Serviço indisponível", req);
      }
      if (!rl.allowed) return safeErrorResponse(429, "Muitos avisos em sequência. Aguarde alguns minutos.", req);

      let clienteId: string | null = null;
      let origem = "";
      if (entrega.obra_id) {
        const { data: obra } = await admin
          .from("obras")
          .select("nome, cliente_id")
          .eq("id", entrega.obra_id)
          .maybeSingle();
        clienteId = obra?.cliente_id ?? null;
        origem = obra?.nome ? `Obra ${obra.nome}` : "Obra";
      } else if (entrega.projeto_id) {
        const { data: projeto } = await admin
          .from("projetos")
          .select("nome, cliente_id")
          .eq("id", entrega.projeto_id)
          .maybeSingle();
        clienteId = projeto?.cliente_id ?? null;
        origem = projeto?.nome ? `Projeto ${projeto.nome}` : "Projeto";
      }
      if (!clienteId) return jsonResponse({ enviados: 0, motivo: "sem_cliente" }, 200, req);

      const { data: acessos } = await admin
        .from("cliente_portal_accounts")
        .select("nome, email")
        .eq("cliente_id", clienteId)
        .eq("empresa_id", entrega.empresa_id)
        .eq("ativo", true)
        .not("email", "is", null);
      if (!acessos || acessos.length === 0) return jsonResponse({ enviados: 0, motivo: "sem_acesso" }, 200, req);

      const { data: empresa } = await admin
        .from("empresas")
        .select("nome, email")
        .eq("id", entrega.empresa_id)
        .maybeSingle();
      if (!empresa?.email) return jsonResponse({ enviados: 0, motivo: "empresa_sem_email" }, 200, req);

      const appUrl = (Deno.env.get("APP_URL") ?? "https://app.pilarsoft.com.br").replace(/\/+$/, "");
      const portalUrl = `${appUrl}/cliente/dashboard`;

      let enviados = 0;
      for (const acesso of acessos) {
        if (!acesso.email) continue;
        try {
          const r = await sendEmail({
            classe: "escritorio",
            tipo: "portal_solicitacao_nova",
            to: acesso.email,
            empresa: { id: entrega.empresa_id, nome: empresa.nome ?? "Seu escritório", email: empresa.email },
            referencia: { tipo: "portal_entrega", id: entrega.id },
            idempotencyKey: `portal-solicitacao-${entrega.id}-${acesso.email}`,
            ...templateSolicitacaoCliente({
              nomeCliente: acesso.nome,
              titulo: entrega.titulo,
              descricao: entrega.descricao,
              origem,
              portalUrl,
              empresaNome: empresa.nome ?? undefined,
            }),
          });
          if (r.ok) enviados += 1;
        } catch (e) {
          log.error("sendEmail failed", e, { entrega_id: entrega.id });
        }
      }

      return jsonResponse({ enviados }, 200, req);
    } catch (error: unknown) {
      log.error("unexpected error", error, { user_id: user.id });
      return safeErrorResponse(400, "Invalid request", req);
    }
  })
);
