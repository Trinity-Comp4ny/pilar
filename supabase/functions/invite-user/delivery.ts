import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isEmailExistsError } from "../_shared/auth-errors.ts";

type DeliveryResult =
  | { ok: true; conta_existente: boolean }
  | { ok: false; status: number; message: string; preservePending: boolean; error: unknown };

// Compartilhado por criação e reenvio. Enviar acesso nunca cria o profile:
// o vínculo só é feito pela RPC depois de a pessoa autenticar sua conta.
export async function deliverInvite(
  svc: SupabaseClient,
  email: string,
  token: string,
  nome: string,
  origin: string
): Promise<DeliveryResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const { error } = await svc.auth.admin.inviteUserByEmail(normalizedEmail, {
    redirectTo: `${origin}/profile-setup`,
    data: { invite_token: token, nome },
  });
  if (!error) return { ok: true, conta_existente: false };
  if (!isEmailExistsError(error)) {
    return { ok: false, status: 400, message: "Falha ao enviar convite", preservePending: false, error };
  }

  // ILIKE sem curingas: '_' e '%' são caracteres válidos em endereços.
  const literalEmail = normalizedEmail.replace(/[\\%_]/g, "\\$&");
  const { data: profile, error: lookupError } = await svc
    .from("profiles")
    .select("id")
    .ilike("email", literalEmail)
    .limit(1)
    .maybeSingle();
  if (lookupError) {
    return {
      ok: false,
      status: 500,
      message: "Não foi possível verificar a conta. Tente novamente.",
      preservePending: true,
      error: lookupError,
    };
  }
  if (profile) {
    return { ok: false, status: 400, message: "Esse e-mail já tem conta no Pilar", preservePending: false, error };
  }

  const { error: otpError } = await svc.auth.signInWithOtp({
    email: normalizedEmail,
    options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/callback` },
  });
  if (otpError) {
    return {
      ok: false,
      status: 400,
      message: "Falha ao enviar o link de acesso. Reenvie o convite.",
      preservePending: true,
      error: otpError,
    };
  }
  return { ok: true, conta_existente: true };
}

export async function checkUserLimit(supabase: SupabaseClient, empresaId: string, maxUsuarios: number | null) {
  if (maxUsuarios === null) return { reached: false, error: null };
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId);
  return { reached: !error && (count ?? 0) >= maxUsuarios, error };
}
