import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { authenticateUser, jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { sendEmail, templateAcessoPortalCliente } from "../_shared/email/index.ts";
import { createLogger } from "../_shared/logger.ts";
import { gerarConviteToken } from "../_shared/convite-token.ts";
import { checkDbRateLimit } from "../_shared/db-rate-limit.ts";
import { lerJson } from "../_shared/schemas.ts";
import { lerEntrada } from "./entrada.ts";

const log = createLogger("invite-cliente-portal");

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
      // Admin e coordenador cuidam do contato com o cliente (mesmos papéis da RLS
      // de cliente_portal_accounts).
      if (!["admin", "ultra_admin", "coordenador"].includes(profile.role)) {
        return safeErrorResponse(403, "Apenas admin ou coordenador pode criar acesso ao portal", req);
      }
      if (!profile.empresa_id) return safeErrorResponse(403, "Você precisa pertencer a uma empresa", req);

      const entrada = lerEntrada(await lerJson(req));
      if (!entrada.ok) return safeErrorResponse(400, entrada.error, req);
      const { cliente_id, email, nome } = entrada.data;

      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      // Cada chamada cria conta e manda e-mail: o teto é por quem convida, no banco
      // (vale entre instâncias da edge) e fecha se o RPC falhar.
      const rl = await checkDbRateLimit(supabaseAdmin, {
        bucket: "invite_cliente_portal",
        key: `uid:${user.id}`,
        max: 30,
        windowSeconds: 3600,
      });
      if (rl.rpcError) {
        log.error("rate limit check failed, fail-closed", null, { rpcError: rl.rpcError });
        return safeErrorResponse(503, "Serviço indisponível", req);
      }
      if (!rl.allowed)
        return safeErrorResponse(
          429,
          "Muitos convites ao portal em sequência. Aguarde alguns minutos e tente de novo.",
          req
        );

      const { data: cliente, error: clienteError } = await supabaseAdmin
        .from("clientes")
        .select("id, nome, empresa_id")
        .eq("id", cliente_id)
        .eq("empresa_id", profile.empresa_id)
        .single();

      if (clienteError || !cliente) return safeErrorResponse(404, "Cliente não encontrado", req);

      const normalizedEmail = String(email).toLowerCase().trim();
      // Vários acessos por cliente (SPEC 164): cada e-mail é uma conta. O e-mail é único
      // dentro do escritório, então a conta achada aqui pode ser deste ou de outro cliente.
      const { data: existingAccount } = await supabaseAdmin
        .from("cliente_portal_accounts")
        .select("id, ativo, cliente_id")
        .eq("email", normalizedEmail)
        .eq("empresa_id", profile.empresa_id)
        .maybeSingle();

      if (existingAccount && existingAccount.cliente_id !== cliente_id) {
        return safeErrorResponse(409, "Este e-mail já acessa o portal de outro cliente do escritório", req);
      }
      if (existingAccount?.ativo) {
        return safeErrorResponse(409, "Este e-mail já tem acesso ao portal deste cliente", req);
      }
      const nomeAcesso = nome ?? cliente.nome;

      const { data: empresa } = await supabaseAdmin
        .from("empresas")
        .select("nome, email")
        .eq("id", profile.empresa_id)
        .maybeSingle();

      if (!empresa?.email)
        return safeErrorResponse(422, "Cadastre o e-mail da empresa em Configurações para enviar ao cliente", req);

      // Gera o token ANTES de mexer no banco e manda o e-mail primeiro: se o
      // envio falhar, nada foi persistido (conta antiga, se houver, continua
      // intacta) — mesma postura de segurança que o fluxo de senha legado já
      // tinha (só grava depois de confirmar que o cliente vai receber o link).
      const { token, hash } = await gerarConviteToken();
      const appUrl = Deno.env.get("APP_URL");
      if (!appUrl) log.error("APP_URL secret not set — email button will point to production", null, {});
      const conviteUrl = `${(appUrl ?? "https://app.pilarsoft.com.br").replace(/\/+$/, "")}/cliente/convite?token=${token}`;

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
            nomeCliente: nomeAcesso,
            email: normalizedEmail,
            conviteUrl,
            empresaNome: empresa?.nome,
          }),
        });
      } catch (emailErr) {
        log.error("sendEmail failed — convite não enviado, nada foi gravado", emailErr, { cliente_id });
        return safeErrorResponse(502, "Não foi possível enviar o e-mail de convite. Tente novamente.", req);
      }

      if (existingAccount) {
        // Conta revogada — reativar com o convite recém-enviado
        const { error: reactivateError } = await supabaseAdmin
          .from("cliente_portal_accounts")
          .update({
            ativo: true,
            email: normalizedEmail,
            nome: nomeAcesso,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingAccount.id);

        if (reactivateError) {
          log.error("reactivate account failed", reactivateError, { account_id: existingAccount.id, cliente_id });
          return safeErrorResponse(400, "Falha ao reativar o acesso ao portal. Tente novamente.", req);
        }

        const { error: resetError } = await supabaseAdmin.rpc("_portal_reset_password_convite", {
          p_account_id: existingAccount.id,
          p_token_hash: hash,
        });

        if (resetError) {
          log.error("reset password convite failed", resetError, { account_id: existingAccount.id });
          return safeErrorResponse(400, "O e-mail saiu, mas o acesso não foi gravado. Reenvie o convite.", req);
        }
      } else {
        const { error: insertError } = await supabaseAdmin.rpc("_portal_create_account_convite", {
          p_cliente_id: cliente.id,
          p_empresa_id: profile.empresa_id,
          p_nome: nomeAcesso,
          p_email: normalizedEmail,
          p_token_hash: hash,
          p_created_by: user.id,
        });

        if (insertError) {
          log.error("_portal_create_account_convite failed", insertError, {
            cliente_id,
            empresa_id: profile.empresa_id,
          });
          return safeErrorResponse(400, "O e-mail saiu, mas o acesso não foi gravado. Reenvie o convite.", req);
        }
      }

      return jsonResponse({ success: true, email: normalizedEmail }, 200, req);
    } catch (error: unknown) {
      log.error("unexpected error", error, { user_id: user.id });
      return safeErrorResponse(400, "Invalid request", req);
    }
  })
);
