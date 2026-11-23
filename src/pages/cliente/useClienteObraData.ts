import { useQuery } from "@tanstack/react-query";
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

/** Resumo curado de um dia (spec 087) — nunca ocorrências, pendências,
 * efetivo por fornecedor, impedimento ou visita: o SQL de
 * get_cliente_obra_detail nem devolve esses campos, não é filtro no front. */
export interface ClienteObraDiarioDia {
  id: string;
  data: string;
  clima: string | null;
  atividades: string | null;
  fotos: Array<{ id: string; path: string }>;
}

/** Registro da equipe que o gestor liberou ao cliente (SPEC 135, fase C): texto e quantas fotos, nada mais. */
export interface ClienteObraRegistro {
  id: string;
  data: string;
  texto: string | null;
  num_fotos: number;
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
  diario: ClienteObraDiarioDia[];
  registros: ClienteObraRegistro[];
}

const STALE_PORTAL = 5 * 60 * 1000;

function msgErro(e: unknown, padrao: string): string {
  return e instanceof Error ? e.message : ((e as { message?: string } | null)?.message ?? padrao);
}

/** Lista de obras que o cliente pode acompanhar no portal (só administração + visíveis). */
export function useClienteObras() {
  const token = getPortalToken();
  const q = useQuery({
    queryKey: ["portal-obras", token],
    staleTime: STALE_PORTAL,
    retry: false,
    queryFn: async (): Promise<ClienteObraResumo[]> => {
      if (!token) throw new Error("Não autenticado");
      const { data, error: rpcError } = await supabase.rpc("get_cliente_obras", { p_token: token });
      if (rpcError) throw rpcError;
      return (data as unknown as ClienteObraResumo[] | null) ?? [];
    },
  });
  return {
    obras: q.data ?? [],
    loading: q.isLoading,
    error: q.error ? msgErro(q.error, "Erro ao carregar obras") : null,
    refresh: async () => {
      await q.refetch();
    },
  };
}

/** Detalhe de uma obra: cronograma (frentes) + prestação de contas. */
export function useClienteObraData(obraId: string | undefined) {
  const token = getPortalToken();
  const q = useQuery({
    queryKey: ["portal-obra", token, obraId],
    enabled: !!obraId,
    staleTime: STALE_PORTAL,
    retry: false,
    queryFn: async (): Promise<ClienteObraData> => {
      if (!token) throw new Error("Não autenticado");
      const { data: result, error: rpcError } = await supabase.rpc("get_cliente_obra_detail", {
        p_token: token,
        p_obra_id: obraId!,
      });
      if (rpcError) throw rpcError;
      return result as unknown as ClienteObraData;
    },
  });
  return {
    data: q.data ?? null,
    loading: q.isLoading,
    error: q.error ? msgErro(q.error, "Erro ao carregar obra") : null,
    refresh: async () => {
      await q.refetch();
    },
  };
}
