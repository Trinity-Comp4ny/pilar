import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { authenticateUser, jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { sendEmail, templateMensagemPortal } from "../_shared/email/index.ts";
import { createLogger } from "../_shared/logger.ts";
import { checkDbRateLimit } from "../_shared/db-rate-limit.ts";
import { lerJson } from "../_shared/schemas.ts";
import { lerEntrada } from "./entrada.ts";

const log = createLogger("portal-avisar-mensagem");

// Mensagens seguidas do escritório viram um e-mail só por janela: o e-mail é um aviso de "tem
// mensagem nova", o texto completo está no portal.
const JANELA_MS = 30 * 60 * 1000;

serve(
  withSentry("portal-avisar-mensagem", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

    const auth = await authenticateUser(req);
    if (auth.error) return auth.error;
    const { supabase: supabaseUser, user } = auth;

    try {
      const entrada = lerEntrada(await lerJson(req));
      if (!entrada.ok) return safeErrorResponse(400, entrada.error, req);

      // Lida com o token da equipe: a RLS de portal_mensagens decide se ela enxerga esta mensagem.
      const { data: msg } = await supabaseUser
        .from("portal_mensagens")
        .select("id, empresa_id, texto, autor_tipo, interna, projeto_id, obra_id, entrega_id, autor_nome")
        .eq("id", entrada.data.mensagem_id)
        .maybeSingle();
      if (!msg) return safeErrorResponse(404, "Mensagem não encontrada", req);
      if (msg.autor_tipo !== "escritorio" || msg.interna)
        return jsonResponse({ enviados: 0, motivo: "nao_se_aplica" }, 200, req);

      const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

      const rl = await checkDbRateLimit(admin, {
        bucket: "portal_avisar_mensagem",
        key: `uid:${user.id}`,
        max: 120,
        windowSeconds: 3600,
      });
      if (rl.rpcError) {
        log.error("rate limit check failed, fail-closed", null, { rpcError: rl.rpcError });
        return safeErrorResponse(503, "Serviço indisponível", req);
      }
      if (!rl.allowed) return safeErrorResponse(429, "Muitos avisos em sequência. Aguarde alguns minutos.", req);

      let clienteId: string | null = null;
      let origem = "";
      let caminho = "";
      if (msg.obra_id) {
        const { data: obra } = await admin.from("obras").select("nome, cliente_id").eq("id", msg.obra_id).maybeSingle();
        clienteId = obra?.cliente_id ?? null;
        origem = obra?.nome ? `Obra ${obra.nome}` : "Obra";
        caminho = `/cliente/obra/${msg.obra_id}`;
      } else if (msg.projeto_id) {
        const { data: projeto } = await admin
          .from("projetos")
          .select("nome, cliente_id")
          .eq("id", msg.projeto_id)
          .maybeSingle();
        clienteId = projeto?.cliente_id ?? null;
        origem = projeto?.nome ? `Projeto ${projeto.nome}` : "Projeto";
        caminho = `/cliente/projeto/${msg.projeto_id}`;
      }
      if (!clienteId) return jsonResponse({ enviados: 0, motivo: "sem_cliente" }, 200, req);

      const { data: acessos } = await admin
        .from("cliente_portal_accounts")
        .select("nome, email")
        .eq("cliente_id", clienteId)
        .eq("empresa_id", msg.empresa_id)
        .eq("ativo", true)
        .not("email", "is", null);
      if (!acessos || acessos.length === 0) return jsonResponse({ enviados: 0, motivo: "sem_acesso" }, 200, req);

      const { data: empresa } = await admin
        .from("empresas")
        .select("nome, email")
        .eq("id", msg.empresa_id)
        .maybeSingle();
      if (!empresa?.email) return jsonResponse({ enviados: 0, motivo: "empresa_sem_email" }, 200, req);

      const appUrl = (Deno.env.get("APP_URL") ?? "https://app.pilarsoft.com.br").replace(/\/+$/, "");
      const escopo = msg.entrega_id ?? msg.obra_id ?? msg.projeto_id;
      const janela = Math.floor(Date.now() / JANELA_MS);

      let enviados = 0;
      for (const acesso of acessos) {
        if (!acesso.email) continue;
        try {
          const r = await sendEmail({
            classe: "escritorio",
            tipo: "portal_mensagem_nova",
            to: acesso.email,
            empresa: { id: msg.empresa_id, nome: empresa.nome ?? "Seu escritório", email: empresa.email },
            referencia: { tipo: "portal_mensagem", id: msg.id },
            idempotencyKey: `portal-mensagem-${escopo}-${acesso.email}-${janela}`,
            ...templateMensagemPortal({
              nomeCliente: acesso.nome,
              autor: msg.autor_nome,
              trecho: msg.texto,
              origem,
              portalUrl: `${appUrl}${caminho}`,
              empresaNome: empresa.nome ?? undefined,
            }),
          });
          if (r.ok) enviados += 1;
        } catch (e) {
          log.error("sendEmail failed", e, { mensagem_id: msg.id });
        }
      }

      return jsonResponse({ enviados }, 200, req);
    } catch (error: unknown) {
      log.error("unexpected error", error, { user_id: user.id });
      return safeErrorResponse(400, "Invalid request", req);
    }
  })
);
