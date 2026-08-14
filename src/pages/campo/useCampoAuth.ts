import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Sessão do Pilar Campo: token próprio (não é auth do Supabase), guardado por
// aba. Espelha o portal do cliente (useClienteAuth), mas a conta é escopada a
// UMA obra e o verify não rotaciona o token (só a troca de senha rotaciona).
const TOKEN_KEY = "pilar_campo_token";

export interface CampoAccount {
  account_id: string;
  obra_id: string;
  empresa_id: string;
  nome: string;
  must_change_senha: boolean;
}

export function getCampoToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}
export function setCampoToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}
export function clearCampoToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

type VerifyResp = { ok: boolean } & Partial<CampoAccount>;

/** Verifica o token guardado e devolve a conta de campo (ou null). */
export function useCampoAuth() {
  const [account, setAccount] = useState<CampoAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const verify = useCallback(async () => {
    const token = getCampoToken();
    if (!token) {
      setError("not_authenticated");
      setLoading(false);
      return;
    }
    try {
      const { data, error: rpcError } = await supabase.rpc("campo_verify_session", { p_token: token });
      if (rpcError) throw rpcError;
      const res = data as unknown as VerifyResp;
      if (!res?.ok) {
        clearCampoToken();
        setAccount(null);
        setError("session_expired");
        setLoading(false);
        return;
      }
      setAccount({
        account_id: res.account_id!,
        obra_id: res.obra_id!,
        empresa_id: res.empresa_id!,
        nome: res.nome!,
        must_change_senha: !!res.must_change_senha,
      });
      setError(null);
      setLoading(false);
    } catch {
      setError("error");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    verify();
  }, [verify]);

  return { account, loading, error, refresh: verify };
}

export function campoLogout(): void {
  clearCampoToken();
}
