import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";

function generatePassword(length = 10): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("");
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: req.headers.get("Authorization")! } },
    });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("empresa_id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) throw new Error("Profile not found");
    if (profile.role !== "admin" && profile.role !== "operacional") {
      throw new Error("Apenas admin ou operacional podem redefinir senhas do portal");
    }
    if (!profile.empresa_id) throw new Error("Você precisa pertencer a uma empresa");

    const { cliente_id } = await req.json();
    if (!cliente_id) throw new Error("cliente_id é obrigatório");

    const { data: account, error: accountError } = await supabaseAdmin
      .from("cliente_portal_accounts")
      .select("id, email")
      .eq("cliente_id", cliente_id)
      .eq("empresa_id", profile.empresa_id)
      .single();

    if (accountError || !account) throw new Error("Conta do portal não encontrada");

    const novaSenha = generatePassword(10);

    const { error: resetError } = await supabaseAdmin.rpc("_portal_reset_password", {
      p_account_id: account.id,
      p_nova_senha: novaSenha,
    });

    if (resetError) throw resetError;

    return new Response(JSON.stringify({ success: true, email: account.email, senha: novaSenha }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
