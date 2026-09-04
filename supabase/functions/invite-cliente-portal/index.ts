import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { authenticateUser, isUUID, jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { EMAIL_RE } from "../_shared/validators.ts";
import { sendEmail, templateAcessoPortalCliente } from "../_shared/email/index.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("invite-cliente-portal");

function generatePassword(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("");
}

serve(
  withSentry("invite-cliente-portal", async (req) => {
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
        return safeErrorResponse(403, "Apenas admin pode criar acesso ao portal", req);
      }
      if (!profile.empresa_id) return safeErrorResponse(403, "Você precisa pertencer a uma empresa", req);

      const { cliente_id, email } = await req.json();
      if (!isUUID(cliente_id)) return safeErrorResponse(400, "cliente_id inválido", req);
      if (!email || !EMAIL_RE.test(String(email))) return safeErrorResponse(400, "email inválido", req);

      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const { data: cliente, error: clienteError } = await supabaseAdmin
        .from("clientes")
        .select("id, nome, empresa_id")
        .eq("id", cliente_id)
        .eq("empresa_id", profile.empresa_id)
        .single();

      if (clienteError || !cliente) return safeErrorResponse(404, "Cliente não encontrado", req);

      const { data: existingAccount } = await supabaseAdmin
        .from("cliente_portal_accounts")
        .select("id, ativo")
        .eq("cliente_id", cliente_id)
        .eq("empresa_id", profile.empresa_id)
        .maybeSingle();

      if (existingAccount?.ativo) return safeErrorResponse(409, "Este cliente já possui acesso ao portal", req);

      const senha = generatePassword(8);
      const normalizedEmail = String(email).toLowerCase().trim();

      if (existingAccount) {
        // Conta revogada — reativar com nova senha e email
        const { error: reactivateError } = await supabaseAdmin
          .from("cliente_portal_accounts")
          .update({
            ativo: true,
            email: normalizedEmail,
            nome: cliente.nome,
            senha_hash: null, // limpa; _portal_reset_password fará o hash
            token_sessao: null,
            token_expira_em: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingAccount.id);

        if (reactivateError) {
          log.error("reactivate account failed", reactivateError, { account_id: existingAccount.id, cliente_id });
          return safeErrorResponse(400, `Falha ao reativar conta do portal: ${reactivateError.message}`, req);
        }

        // Aplica nova senha com hash via RPC
        const { error: resetError } = await supabaseAdmin.rpc("_portal_reset_password", {
          p_account_id: existingAccount.id,
          p_nova_senha: senha,
        });

        if (resetError) {
          log.error("reset password failed", resetError, { account_id: existingAccount.id });
          return safeErrorResponse(400, `Falha ao definir senha: ${resetError.message}`, req);
        }
      } else {
        const { error: insertError } = await supabaseAdmin.rpc("_portal_create_account", {
          p_cliente_id: cliente.id,
          p_empresa_id: profile.empresa_id,
          p_nome: cliente.nome,
          p_email: normalizedEmail,
          p_senha: senha,
          p_created_by: user.id,
        });

        if (insertError) {
          log.error("_portal_create_account failed", insertError, { cliente_id, empresa_id: profile.empresa_id });
          return safeErrorResponse(400, `Falha ao criar conta do portal: ${insertError.message}`, req);
        }
      }

      const { data: empresa } = await supabaseAdmin
        .from("empresas")
        .select("nome, email")
        .eq("id", profile.empresa_id)
        .maybeSingle();

      if (!empresa?.email)
        return safeErrorResponse(422, "Cadastre o e-mail da empresa em Configurações para enviar ao cliente", req);

      const siteUrl = Deno.env.get("PUBLIC_SITE_URL");
      if (!siteUrl) log.error("PUBLIC_SITE_URL secret not set — email button will be broken", null, {});
      const loginUrl = `${siteUrl ?? "https://www.pilarsoft.com.br"}/cliente/login`;

      try {
        await sendEmail({
          classe: "escritorio",
          tipo: "portal_acesso_criado",
          to: normalizedEmail,
          empresa: {
            id: profile.empresa_id,
            nome: empresa?.nome ?? "Seu escritório",
            email: empresa?.email,
          },
          ...templateAcessoPortalCliente({
            nomeCliente: cliente.nome,
            email: normalizedEmail,
            senha,
            loginUrl,
            empresaNome: empresa?.nome,
          }),
        });
      } catch (emailErr) {
        log.error("sendEmail failed — convite criado mas e-mail não enviado", emailErr, { cliente_id });
        return safeErrorResponse(
          502,
          "Conta do portal criada, mas o e-mail com as credenciais não foi enviado. Reenvie o convite ou redefina a senha.",
          req
        );
      }

      return jsonResponse({ success: true, email: normalizedEmail }, 200, req);
    } catch (error: unknown) {
      log.error("unexpected error", error, { user_id: user.id });
      return safeErrorResponse(400, "Invalid request", req);
    }
  })
);
