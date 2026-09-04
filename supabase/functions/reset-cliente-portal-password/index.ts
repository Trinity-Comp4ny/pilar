import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { authenticateUser, isUUID, jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { sendEmail, templateAcessoPortalCliente } from "../_shared/email/index.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("reset-cliente-portal-password");

function generatePassword(length = 10): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("");
}

serve(
  withSentry("reset-cliente-portal-password", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

    const auth = await authenticateUser(req);
    if (auth.error) return auth.error;
    const { supabase: supabaseClient, user } = auth;

    try {
      const { data: profile, error: profileError } = await supabaseClient
        .from("profiles")
        .select("empresa_id, role")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) return safeErrorResponse(403, "Profile not found", req);
      if (profile.role !== "admin" && profile.role !== "ultra_admin") {
        return safeErrorResponse(403, "Apenas admin pode redefinir senhas do portal", req);
      }
      if (!profile.empresa_id) return safeErrorResponse(403, "Você precisa pertencer a uma empresa", req);

      const { cliente_id, nome_cliente } = await req.json();
      if (!isUUID(cliente_id)) return safeErrorResponse(400, "cliente_id inválido", req);

      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const { data: account, error: accountError } = await supabaseAdmin
        .from("cliente_portal_accounts")
        .select("id, email")
        .eq("cliente_id", cliente_id)
        .eq("empresa_id", profile.empresa_id)
        .single();

      if (accountError || !account) return safeErrorResponse(404, "Conta do portal não encontrada", req);

      const novaSenha = generatePassword(10);

      const { data: empresa } = await supabaseAdmin
        .from("empresas")
        .select("nome, email")
        .eq("id", profile.empresa_id)
        .maybeSingle();

      const siteUrl = Deno.env.get("PUBLIC_SITE_URL");
      if (!siteUrl) log.error("PUBLIC_SITE_URL secret not set — email button will be broken", null, {});
      const loginUrl = `${siteUrl ?? "https://www.pilarsoft.com.br"}/cliente/login`;

      // Envia o e-mail ANTES de trocar a senha: se o envio falhar, a senha atual do cliente
      // continua válida (não fica trancado fora) e o admin recebe erro claro para reenviar.
      try {
        await sendEmail({
          classe: "escritorio",
          tipo: "portal_senha_redefinida",
          to: account.email,
          empresa: {
            id: profile.empresa_id,
            nome: empresa?.nome ?? "Seu escritório",
            email: empresa?.email,
          },
          ...templateAcessoPortalCliente({
            nomeCliente: nome_cliente ?? "Cliente",
            email: account.email,
            senha: novaSenha,
            loginUrl,
            isReset: true,
            empresaNome: empresa?.nome,
          }),
        });
      } catch (emailErr) {
        log.error("sendEmail failed — senha NÃO alterada", emailErr, {
          account_id: account.id,
          empresa_id: profile.empresa_id,
        });
        return safeErrorResponse(
          502,
          "Não foi possível enviar o e-mail com a nova senha. A senha atual foi mantida — tente novamente.",
          req
        );
      }

      const { error: resetError } = await supabaseAdmin.rpc("_portal_reset_password", {
        p_account_id: account.id,
        p_nova_senha: novaSenha,
      });

      if (resetError) {
        log.error("_portal_reset_password failed", resetError, {
          account_id: account.id,
          empresa_id: profile.empresa_id,
          user_id: user.id,
        });
        return safeErrorResponse(400, `Falha ao redefinir senha: ${resetError.message}`, req);
      }

      return jsonResponse({ success: true, email: account.email }, 200, req);
    } catch (error: unknown) {
      log.error("unexpected error", error, { user_id: user.id });
      return safeErrorResponse(400, "Invalid request", req);
    }
  })
);
