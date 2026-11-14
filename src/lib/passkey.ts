import { supabase } from "@/integrations/supabase/client";
import { env } from "@/lib/env";

/**
 * Passkey (biometria: digital, rosto, PIN do aparelho) como atalho de entrada, pela API nativa de
 * passkey do Supabase Auth. O fluxo do navegador (WebAuthn) é feito pelo próprio supabase-js.
 * Quem tem MFA (aal2) continua passando pelo desafio de MFA depois, como no login por senha.
 */

/** Ligado por ambiente (VITE_PASSKEY_ENABLED) E suportado pelo navegador. */
export function passkeyDisponivel(): boolean {
  if (env.VITE_PASSKEY_ENABLED !== "true") return false;
  return typeof window !== "undefined" && typeof window.PublicKeyCredential === "function";
}

export type ResultadoPasskey = { ok: true } | { ok: false; cancelado: boolean; mensagem: string };

function falha(error: unknown): ResultadoPasskey {
  const nome = (error as { name?: string } | null)?.name ?? "";
  const codigo = (error as { code?: string } | null)?.code ?? "";
  // Fechar o prompt do sistema sem escolher não é erro para mostrar.
  const cancelado = nome === "NotAllowedError" || codigo === "ERROR_CEREMONY_ABORTED" || nome === "AbortError";
  const mensagem = (error as { message?: string } | null)?.message ?? "Não foi possível usar a biometria.";
  return { ok: false, cancelado, mensagem };
}

export async function entrarComPasskey(): Promise<ResultadoPasskey> {
  try {
    const { error } = await supabase.auth.signInWithPasskey();
    return error ? falha(error) : { ok: true };
  } catch (e) {
    return falha(e);
  }
}

export async function cadastrarPasskey(): Promise<ResultadoPasskey> {
  try {
    const { error } = await supabase.auth.registerPasskey();
    return error ? falha(error) : { ok: true };
  } catch (e) {
    return falha(e);
  }
}
