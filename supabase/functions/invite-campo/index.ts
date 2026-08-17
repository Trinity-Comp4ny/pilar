import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { authenticateUser, isUUID, jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { EMAIL_RE } from "../_shared/validators.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("invite-campo");

// Papéis de gestão que podem emitir credencial de campo (alinha com o RLS da
// tabela campo_accounts: admin/owner/ultra_admin + coordenador).
const ROLES_GESTAO = new Set(["admin", "ultra_admin", "owner", "coordenador"]);

// Senha legível: sem caracteres ambíguos (0/O, 1/l/I). O pedreiro digita à mão.
function generatePassword(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("");
}

serve(
  withSentry("invite-campo", async (req) => {
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
      if (!ROLES_GESTAO.has(profile.role)) {
        return safeErrorResponse(403, "Apenas gestão pode criar acesso de campo", req);
      }
      if (!profile.empresa_id) return safeErrorResponse(403, "Você precisa pertencer a uma empresa", req);

      const { obra_id, nome, email } = await req.json();
      if (!isUUID(obra_id)) return safeErrorResponse(400, "obra_id inválido", req);
      if (!nome || String(nome).trim().length === 0) return safeErrorResponse(400, "Informe o nome", req);
      if (!email || !EMAIL_RE.test(String(email))) return safeErrorResponse(400, "email inválido", req);

      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      // A obra tem que ser da empresa do gestor.
      const { data: obra, error: obraError } = await supabaseAdmin
        .from("obras")
        .select("id, empresa_id")
        .eq("id", obra_id)
        .eq("empresa_id", profile.empresa_id)
        .single();
      if (obraError || !obra) return safeErrorResponse(404, "Obra não encontrada", req);

      const normalizedEmail = String(email).toLowerCase().trim();

      // Email é único globalmente na tabela; avisa cedo se já existe.
      const { data: existing } = await supabaseAdmin
        .from("campo_accounts")
        .select("id, ativo")
        .eq("email", normalizedEmail)
        .maybeSingle();
      if (existing) return safeErrorResponse(409, "Já existe um acesso de campo com esse email", req);

      const senha = generatePassword(8);

      const { error: createError } = await supabaseAdmin.rpc("_campo_create_account", {
        p_obra_id: obra.id,
        p_empresa_id: profile.empresa_id,
        p_nome: String(nome).trim(),
        p_email: normalizedEmail,
        p_senha: senha,
        p_created_by: user.id,
      });

      if (createError) {
        log.error("_campo_create_account failed", createError, { obra_id, empresa_id: profile.empresa_id });
        return safeErrorResponse(400, `Falha ao criar acesso de campo: ${createError.message}`, req);
      }

      // Devolve a senha em claro UMA vez, para o gestor copiar e entregar ao
      // pessoal de campo (que pode não ter email). Não fica guardada em claro.
      return jsonResponse({ success: true, email: normalizedEmail, senha }, 200, req);
    } catch (error: unknown) {
      log.error("unexpected error", error, { user_id: user.id });
      return safeErrorResponse(400, "Invalid request", req);
    }
  })
);
