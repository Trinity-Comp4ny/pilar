import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";

// Cria convite para novo tenant (dono de empresa).
// Requer header X-Super-Admin-Key matching SUPER_ADMIN_KEY (env).
// Endpoint bootstrap — não acessível a usuários comuns.

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  }

  try {
    const providedKey = req.headers.get("x-super-admin-key");
    const expectedKey = Deno.env.get("SUPER_ADMIN_KEY");

    if (!expectedKey) {
      throw new Error("SUPER_ADMIN_KEY não configurada no ambiente");
    }

    if (!providedKey || providedKey !== expectedKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const body = await req.json();
    const email = (body.email as string | undefined)?.trim().toLowerCase();
    const company_name = body.company_name as string | undefined;
    const nome = body.nome as string | undefined;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("email inválido");
    }
    if (!company_name || company_name.trim().length < 2) {
      throw new Error("company_name obrigatório (mínimo 2 chars)");
    }

    const ALLOWED_ORIGINS = [
      "https://pilarsoft.com.br",
      "https://app.pilarsoft.com.br",
      "http://localhost:5173",
      "http://localhost:4173",
    ];
    let origin = req.headers.get("origin") || "";
    if (origin.endsWith("/")) origin = origin.slice(0, -1);
    if (!ALLOWED_ORIGINS.includes(origin)) {
      origin = ALLOWED_ORIGINS[0];
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Invalida convites anteriores não usados para o mesmo email
    await supabaseAdmin
      .from("empresa_owners_pending")
      .update({ usado_em: new Date().toISOString() })
      .eq("email", email)
      .is("usado_em", null);

    // Cria novo token pendente
    const { data: pending, error: insertError } = await supabaseAdmin
      .from("empresa_owners_pending")
      .insert({ email, company_name: company_name.trim(), nome: nome ?? null })
      .select("token")
      .single();

    if (insertError || !pending?.token) {
      throw new Error(insertError?.message ?? "Falha ao criar convite");
    }

    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/profile-setup`,
      data: {
        invite_token: pending.token,
        nome: nome ?? "",
      },
    });

    if (inviteError) throw inviteError;

    return new Response(JSON.stringify({ success: true, email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
