import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "pilar-portal-token";

export interface PortalData {
  projeto_id: string;
  cliente_id: string;
  empresa_id: string;
  projeto_nome: string;
  projeto_status: string;
  projeto_codigo: string;
  cliente_nome: string;
  empresa_nome: string;
}

export function usePortalData() {
  const token = sessionStorage.getItem(STORAGE_KEY);
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError("Link inválido ou expirado.");
      setLoading(false);
      return;
    }
    const verify = async () => {
      try {
        const { data: result, error: err } = await supabase.rpc("verify_portal_token", { p_token: token });
        if (err) throw err;
        setData(result as unknown as PortalData);
      } catch (e: unknown) {
        sessionStorage.removeItem(STORAGE_KEY);
        setError(e instanceof Error ? e.message : "Token inválido");
      } finally {
        setLoading(false);
      }
    };
    verify();
  }, [token]);

  return { data, error, loading, token };
}
