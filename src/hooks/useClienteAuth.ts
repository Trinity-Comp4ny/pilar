import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const TOKEN_KEY = "pilar_portal_token";

export interface ClienteAccount {
  id: string;
  cliente_id: string;
  empresa_id: string;
  nome: string;
  email: string;
}

export function getPortalToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setPortalToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearPortalToken() {
  localStorage.removeItem(TOKEN_KEY);
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

      setAccount(data as unknown as ClienteAccount);
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

  return { account, loading, error };
}
