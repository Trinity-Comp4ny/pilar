import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";

function generatePassword(length = 8): string {
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
      global: {
        headers: { Authorization: req.headers.get("Authorization")! },
      },
    });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Valida o usuário chamador
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    // 2. Verifica permissões (admin ou operacional)
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("empresa_id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) throw new Error("Profile not found");

    if (profile.role !== "admin" && profile.role !== "operacional") {
      throw new Error("Apenas admin ou operacional podem criar acesso ao portal");
    }

    if (!profile.empresa_id) {
      throw new Error("Você precisa pertencer a uma empresa");
    }

    // 3. Valida body
    const { cliente_id, email } = await req.json();
    if (!cliente_id) throw new Error("cliente_id é obrigatório");
    if (!email) throw new Error("email é obrigatório");

    // 4. Busca dados do cliente
    const { data: cliente, error: clienteError } = await supabaseAdmin
      .from("clientes")
      .select("id, nome, empresa_id")
      .eq("id", cliente_id)
      .eq("empresa_id", profile.empresa_id)
      .single();

    if (clienteError || !cliente) throw new Error("Cliente não encontrado");

    // 5. Verifica se já existe conta portal
    const { data: existingAccount } = await supabaseAdmin
      .from("cliente_portal_accounts")
      .select("id")
      .eq("cliente_id", cliente_id)
      .eq("empresa_id", profile.empresa_id)
      .maybeSingle();

    if (existingAccount) {
      throw new Error("Este cliente já possui acesso ao portal");
    }

    // 6. Gera senha aleatória
    const senha = generatePassword(8);

    // 7. Insere com hash via pgcrypto (SQL direto)
    const { error: insertError } = await supabaseAdmin.rpc("_portal_create_account", {
      p_cliente_id: cliente.id,
      p_empresa_id: profile.empresa_id,
      p_nome: cliente.nome,
      p_email: email.toLowerCase().trim(),
      p_senha: senha,
      p_created_by: user.id,
    });

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ success: true, email: email.toLowerCase().trim(), senha }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : "Erro interno";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
