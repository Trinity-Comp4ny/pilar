import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { callUntypedRpc } from "@/lib/supabaseRpc";

const TOKEN_KEY = "pilar_portal_token";

export interface ClienteAccount {
  id: string;
  cliente_id: string;
  empresa_id: string;
  nome: string;
  email: string;
  must_change_password?: boolean;
}

interface VerifySessionResponse extends ClienteAccount {
  new_token?: string;
}

export function getPortalToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setPortalToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearPortalToken() {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY); // limpa tokens legados em localStorage
}

export async function portalLogout() {
  const token = getPortalToken();
  if (token) {
    try {
      // gen:types não inclui portal_logout ainda
      await callUntypedRpc("portal_logout", { p_token: token });
    } catch {
      // Falha no logout server-side é tolerável — o importante é limpar cliente
    }
  }
  clearPortalToken();
}

export function useClienteAuth() {
  const [account, setAccount] = useState<ClienteAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const verify = useCallback(async () => {
    const token = getPortalToken();
    if (!token) {
      setError("not_authenticated");
      setLoading(false);
      return;
    }

    try {
      const { data, error: rpcError } = await supabase.rpc("portal_verify_session", {
        p_token: token,
      });

      if (rpcError) throw rpcError;

      if (!data) {
        clearPortalToken();
        setError("session_expired");
        setLoading(false);
        return;
      }

      const response = data as unknown as VerifySessionResponse;

      if (response.new_token) {
        setPortalToken(response.new_token);
      }

      const { new_token: _newToken, ...accountData } = response;
      setAccount(accountData);
    } catch {
      clearPortalToken();
      setError("session_expired");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    verify();
  }, [verify]);

  // refresh re-valida a sessão contra o servidor. Usado após a troca forçada de
  // senha para recarregar account.must_change_password (agora false) e liberar a
  // navegação sem exigir novo login.
  return { account, loading, error, refresh: verify };
}
