import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPortalToken } from "@/hooks/useClienteAuth";

// Shapes espelham o JSON das RPCs get_cliente_obras / get_cliente_obra_detail
// (migration 20260818000100). O TS aqui é só o contrato consumido pelo front;
// a verdade e os gates de segurança vivem no SQL.

export interface ClienteObraResumo {
  id: string;
  nome: string;
  status: string;
  data_inicio_prevista: string | null;
  data_fim_prevista: string | null;
  avanco_pct: number;
}

export interface ClienteObraTarefa {
  status: string;
  data_inicio: string | null;
  prazo: string | null;
}

export interface ClienteObraFrente {
  id: string;
  nome: string;
  ordem: number;
  data_inicio: string | null;
  data_fim: string | null;
  tarefas: ClienteObraTarefa[];
}

export interface ClienteObraAporte {
  data: string;
  descricao: string;
  valor: number;
}

export interface ClienteObraDespesa extends ClienteObraAporte {
  frente_nome: string | null;
  comprovante_url: string | null;
}

export interface ClienteObraConta {
  total_aportado: number;
  total_gasto: number;
  saldo: number;
  taxa_administracao_valor: number;
  aportes: ClienteObraAporte[];
  despesas: ClienteObraDespesa[];
}

export interface ClienteObraData {
  obra_id: string;
  nome: string;
  status: string;
  data_inicio_prevista: string | null;
  data_fim_prevista: string | null;
  taxa_administracao_pct: number;
  frentes: ClienteObraFrente[];
  conta: ClienteObraConta;
}

/** Lista de obras que o cliente pode acompanhar no portal (só administração + visíveis). */
export function useClienteObras() {
  const [obras, setObras] = useState<ClienteObraResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = getPortalToken();
      if (!token) throw new Error("Não autenticado");

      const { data, error: rpcError } = await supabase.rpc("get_cliente_obras", { p_token: token });
      if (rpcError) throw rpcError;
      setObras((data as unknown as ClienteObraResumo[] | null) ?? []);
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : ((e as { message?: string } | null)?.message ?? "Erro ao carregar obras");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { obras, loading, error, refresh: load };
}

/** Detalhe de uma obra: cronograma (frentes) + prestação de contas. */
export function useClienteObraData(obraId: string | undefined) {
  const [data, setData] = useState<ClienteObraData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!obraId) return;
    setLoading(true);
    try {
      const token = getPortalToken();
      if (!token) throw new Error("Não autenticado");

      const { data: result, error: rpcError } = await supabase.rpc("get_cliente_obra_detail", {
        p_token: token,
        p_obra_id: obraId,
      });
      if (rpcError) throw rpcError;
      setData(result as unknown as ClienteObraData);
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : ((e as { message?: string } | null)?.message ?? "Erro ao carregar obra");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [obraId]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refresh: load };
}
