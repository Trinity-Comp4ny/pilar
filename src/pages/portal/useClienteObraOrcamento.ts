import { useEffect, useState } from "react";
import { getPortalToken } from "@/hooks/useClienteAuth";
import { callUntypedRpc } from "@/lib/supabaseRpc";
import type { LinhaDoRelatorio } from "@/components/obras/RelatorioOrcadoRealizado";

interface Resposta {
  linhas: LinhaDoRelatorio[];
  sem_frente: number;
}

/** Orçado x realizado da obra para o portal (RPC `get_cliente_obra_orcamento`): só despesa confirmada para o cliente. */
export function useClienteObraOrcamento(obraId: string | undefined) {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!obraId) return;
    let ativo = true;
    (async () => {
      try {
        const token = getPortalToken();
        if (!token) throw new Error("Não autenticado");
        const { data, error: rpcError } = await callUntypedRpc<Resposta>("get_cliente_obra_orcamento", {
          p_token: token,
          p_obra_id: obraId,
        });
        if (rpcError) throw rpcError;
        if (ativo) setDados(data);
      } catch (e: unknown) {
        if (ativo)
          setError(
            e instanceof Error ? e.message : ((e as { message?: string } | null)?.message ?? "Erro ao carregar")
          );
      } finally {
        if (ativo) setLoading(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [obraId]);

  return { dados, loading, error };
}
