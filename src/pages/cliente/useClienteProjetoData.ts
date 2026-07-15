import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPortalToken } from "@/hooks/useClienteAuth";

export interface ClienteReceita {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  data_recebimento: string | null;
  status: string;
  asaas_payment_url?: string | null;
  asaas_billing_type?: string | null;
}

export interface ClienteProjetoData {
  projeto_id: string;
  cliente_id: string;
  empresa_id: string;
  projeto_nome: string;
  projeto_status: string;
  projeto_codigo: string | null;
  data_inicio: string | null;
  data_previsao: string | null;
  data_final: string | null;
  valor_contrato: number | null;
  disciplinas: Array<{
    disciplina?: string;
    status?: string;
    data_inicio?: string;
    data_previsao?: string;
    data_final?: string;
    responsavel_nome?: string;
  }>;
  cliente_nome: string;
  empresa_nome: string;
  receitas: ClienteReceita[];
  portal_entregas_pendentes: number;
}

export function useClienteProjetoData(projetoId: string | undefined) {
  const [data, setData] = useState<ClienteProjetoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projetoId) return;
    setLoading(true);
    try {
      const token = getPortalToken();
      if (!token) throw new Error("Não autenticado");

      const { data: result, error: rpcError } = await supabase.rpc("get_cliente_projeto_detail", {
        p_projeto_id: projetoId,
        p_token: token,
      });
      if (rpcError) throw rpcError;
      setData(result as unknown as ClienteProjetoData);
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : ((e as { message?: string } | null)?.message ?? "Erro ao carregar projeto");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [projetoId]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refresh: load };
}
