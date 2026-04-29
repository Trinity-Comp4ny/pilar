import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { authenticateUser, isUUID, jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { EMAIL_RE } from "../_shared/validators.ts";
import { sendEmail, templateAcessoPortalCliente } from "../_shared/email.ts";

function generatePassword(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("");
}

serve(async (req) => {
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
      .select("id")
      .eq("cliente_id", cliente_id)
      .eq("empresa_id", profile.empresa_id)
      .maybeSingle();

    if (existingAccount) return safeErrorResponse(409, "Este cliente já possui acesso ao portal", req);

    const senha = generatePassword(8);

    const { error: insertError } = await supabaseAdmin.rpc("_portal_create_account", {
      p_cliente_id: cliente.id,
      p_empresa_id: profile.empresa_id,
      p_nome: cliente.nome,
      p_email: String(email).toLowerCase().trim(),
      p_senha: senha,
      p_created_by: user.id,
    });

    if (insertError) {
      console.error("[invite-cliente-portal] _portal_create_account failed", insertError.message);
      return safeErrorResponse(400, `Falha ao criar conta do portal: ${insertError.message}`, req);
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const loginUrl = `${Deno.env.get("PUBLIC_SITE_URL") ?? ""}/portal/login`;

    try {
      await sendEmail({
        to: normalizedEmail,
        subject: "Seu acesso ao Portal do Cliente",
        html: templateAcessoPortalCliente({
          nomeCliente: cliente.nome,
          email: normalizedEmail,
          senha,
          loginUrl,
        }),
      });
    } catch (emailErr) {
      console.error("[invite-cliente-portal] sendEmail failed", emailErr);
    }

    return jsonResponse({ success: true, email: normalizedEmail }, 200, req);
  } catch (error: unknown) {
    console.error("[invite-cliente-portal] unexpected error", error);
    return safeErrorResponse(400, "Invalid request", req);
  }
});
