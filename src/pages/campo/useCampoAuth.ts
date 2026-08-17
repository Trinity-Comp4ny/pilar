import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Sessão do Pilar Campo: token próprio (não é auth do Supabase), guardado por
// aba. Espelha o portal do cliente (useClienteAuth), mas a conta é escopada a
// UMA obra e o verify não rotaciona o token (só a troca de senha rotaciona).
const TOKEN_KEY = "pilar_campo_token";
// Cache da última conta verificada com sucesso. Existe para o app de campo ser
// utilizável OFFLINE: sem rede, o verify não consegue confirmar nada com o
// servidor, e um app "offline-first" não pode deslogar o usuário por causa
// disso — só desloga quando o SERVIDOR responde de verdade que a sessão é
// inválida/expirada, nunca quando a chamada nem chega a sair do aparelho.
const ACCOUNT_CACHE_KEY = "pilar_campo_account";

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
  sessionStorage.removeItem(ACCOUNT_CACHE_KEY);
}

function getCachedAccount(): CampoAccount | null {
  const raw = sessionStorage.getItem(ACCOUNT_CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CampoAccount;
  } catch {
    return null;
  }
}
function setCachedAccount(acc: CampoAccount): void {
  sessionStorage.setItem(ACCOUNT_CACHE_KEY, JSON.stringify(acc));
}

type VerifyResp = { ok: boolean } & Partial<CampoAccount>;

/**
 * Verifica o token guardado e devolve a conta de campo (ou null).
 * Offline: se a chamada falhar por rede (não uma resposta explícita do
 * servidor), usa a última conta em cache em vez de deslogar — o app de campo
 * segue funcionando sem sinal; a próxima sincronização revalida de verdade.
 */
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
        // Resposta explícita do servidor: a sessão é realmente inválida/expirada.
        clearCampoToken();
        setAccount(null);
        setError("session_expired");
        setLoading(false);
        return;
      }
      const acc: CampoAccount = {
        account_id: res.account_id!,
        obra_id: res.obra_id!,
        empresa_id: res.empresa_id!,
        nome: res.nome!,
        must_change_senha: !!res.must_change_senha,
      };
      setCachedAccount(acc);
      setAccount(acc);
      setError(null);
      setLoading(false);
    } catch {
      const cached = getCachedAccount();
      if (cached) {
        setAccount(cached);
        setError(null);
      } else {
        setError("error");
      }
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
