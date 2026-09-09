import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { authenticateUser, isUUID, jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { EMAIL_RE } from "../_shared/validators.ts";
import { createLogger } from "../_shared/logger.ts";
import { sendEmail, templateConviteAcessoCampo } from "../_shared/email/index.ts";
import { gerarConviteToken } from "../_shared/convite-token.ts";

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

// Login inventado quando não há e-mail real: nunca endereçável, serve só para
// digitar no campo "email" da tela de login. Domínio .local não resolve.
function gerarLoginInterno(nome: string): string {
  const slug =
    String(nome)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove acentos (combining diacritical marks)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "campo";
  const sufixo = Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => b.toString(16).padStart(2, "0")).join("");
  return `${slug}-${sufixo}@campo.local`;
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
      // E-mail é opcional (spec 099): quando informado, tem que ser válido —
      // quando ausente, o pessoal de campo não tem e-mail real e o fluxo cai
      // no fallback de senha manual.
      if (email && !EMAIL_RE.test(String(email))) return safeErrorResponse(400, "email inválido", req);

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

      const nomeTrim = String(nome).trim();

      // ------------------------------------------------------------------
      // Com e-mail real: convite por link (mesmo mecanismo do portal)
      // ------------------------------------------------------------------
      if (email) {
        const normalizedEmail = String(email).toLowerCase().trim();

        const { data: existing } = await supabaseAdmin
          .from("campo_accounts")
          .select("id, ativo, empresa_id")
          .eq("email", normalizedEmail)
          .maybeSingle();

        if (existing?.ativo) return safeErrorResponse(409, "Já existe um acesso de campo ativo com esse e-mail", req);
        if (existing && existing.empresa_id !== profile.empresa_id) {
          return safeErrorResponse(409, "Já existe um acesso de campo com esse e-mail em outra empresa", req);
        }

        const { token, hash } = await gerarConviteToken();
        const siteUrl = Deno.env.get("PUBLIC_SITE_URL");
        if (!siteUrl) log.error("PUBLIC_SITE_URL secret not set — email button will be broken", null, {});
        const conviteUrl = `${siteUrl ?? "https://www.pilarsoft.com.br"}/campo/convite?token=${token}`;

        const { data: empresa } = await supabaseAdmin
          .from("empresas")
          .select("nome")
          .eq("id", profile.empresa_id)
          .maybeSingle();

        // E-mail antes de gravar: se o envio falhar, nada foi persistido.
        try {
          await sendEmail({
            classe: "escritorio",
            tipo: "campo_acesso_criado",
            to: normalizedEmail,
            empresa: { id: profile.empresa_id, nome: empresa?.nome ?? "Seu escritório" },
            ...templateConviteAcessoCampo({
              nome: nomeTrim,
              email: normalizedEmail,
              conviteUrl,
              empresaNome: empresa?.nome,
            }),
          });
        } catch (emailErr) {
          log.error("sendEmail failed — convite não enviado, nada foi gravado", emailErr, { obra_id });
          return safeErrorResponse(502, "Não foi possível enviar o e-mail de convite. Tente novamente.", req);
        }

        const { error: createError } = await supabaseAdmin.rpc("_campo_create_account_convite", {
          p_obra_id: obra.id,
          p_empresa_id: profile.empresa_id,
          p_nome: nomeTrim,
          p_email: normalizedEmail,
          p_token_hash: hash,
          p_created_by: user.id,
        });

        if (createError) {
          log.error("_campo_create_account_convite failed", createError, { obra_id, empresa_id: profile.empresa_id });
          return safeErrorResponse(400, `Convite enviado, mas falhou ao gravar: ${createError.message}`, req);
        }

        return jsonResponse({ success: true, modo: "convite", email: normalizedEmail }, 200, req);
      }

      // ------------------------------------------------------------------
      // Sem e-mail: fallback de senha manual (decisão da spec 042, mantida)
      // ------------------------------------------------------------------
      const loginGerado = gerarLoginInterno(nomeTrim);
      const senha = generatePassword(8);

      const { error: createError } = await supabaseAdmin.rpc("_campo_create_account", {
        p_obra_id: obra.id,
        p_empresa_id: profile.empresa_id,
        p_nome: nomeTrim,
        p_email: loginGerado,
        p_senha: senha,
        p_created_by: user.id,
      });

      if (createError) {
        log.error("_campo_create_account failed", createError, { obra_id, empresa_id: profile.empresa_id });
        return safeErrorResponse(400, `Falha ao criar acesso de campo: ${createError.message}`, req);
      }

      // Devolve a senha em claro UMA vez, para o gestor copiar e entregar ao
      // pessoal de campo (que não tem e-mail). Não fica guardada em claro.
      return jsonResponse({ success: true, modo: "senha", email: loginGerado, senha }, 200, req);
    } catch (error: unknown) {
      log.error("unexpected error", error, { user_id: user.id });
      return safeErrorResponse(400, "Invalid request", req);
    }
  })
);
