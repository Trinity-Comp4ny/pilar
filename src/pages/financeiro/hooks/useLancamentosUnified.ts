import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TipoLancamento = "receita" | "despesa";
export type GrupoTipo = "finito" | "recorrente" | null;
export type GrupoStatus = "aberto" | "parcial" | "quitado" | "cancelado" | null;

export interface Lancamento {
  id: string;
  tipo: TipoLancamento;
  data_vencimento: string;
  data_efetivacao: string | null;
  data_competencia: string | null;
  descricao: string;
  valor: number;
  status: string;
  categoria_id: string | null;
  categoria_nome: string | null;
  projeto_id: string | null;
  projeto_codigo: string | null;
  centro_custo_id: string | null;
  contraparte_id: string | null;
  contraparte_tipo: string | null;
  contraparte_nome: string | null;
  forma_pagamento: string | null;
  cartao_id: string | null;
  parcela_numero: number | null;
  parcela_total: number | null;
  grupo_parcela: string | null;
  grupo_tipo: GrupoTipo;
  grupo_status: GrupoStatus;
  grupo_total_original: number | null;
  tags: string[] | null;
}

interface UseLancamentosArgs {
  from: string | null;
  to: string | null;
}

type LancamentoRow = {
  id: string;
  tipo: TipoLancamento;
  data_vencimento: string;
  data_efetivacao: string | null;
  data_competencia: string | null;
  descricao: string;
  valor: number;
  status: string;
  categoria_id: string | null;
  projeto_id: string | null;
  centro_custo_id: string | null;
  contraparte_id: string | null;
  contraparte_tipo: string | null;
  forma_pagamento: string | null;
  cartao_id: string | null;
  parcela_numero: number | null;
  parcela_total: number | null;
  grupo_parcela: string | null;
  grupo_tipo: GrupoTipo;
  grupo_status: GrupoStatus;
  grupo_total_original: number | null;
  tags: string[] | null;
};

export function useLancamentosUnified({ from, to }: UseLancamentosArgs) {
  const [data, setData] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      let lancQ = supabase.from("lancamentos").select("*");
      if (from) lancQ = lancQ.gte("data_vencimento", from);
      if (to) lancQ = lancQ.lte("data_vencimento", to);

      const [lancRes, catRes, projRes, cliRes, fornRes] = await Promise.all([
        lancQ,
        supabase.from("categorias_financeiras").select("id, nome"),
        supabase.from("projetos").select("id, codigo_projeto"),
        supabase.from("clientes").select("id, nome"),
        supabase.from("fornecedores").select("id, nome"),
      ]);

      const catMap = new Map<string, string>((catRes.data ?? []).map((c) => [c.id, c.nome]));
      const projMap = new Map<string, string | null>((projRes.data ?? []).map((p) => [p.id, p.codigo_projeto]));
      const cliMap = new Map<string, string>((cliRes.data ?? []).map((c) => [c.id, c.nome]));
      const fornMap = new Map<string, string>((fornRes.data ?? []).map((f) => [f.id, f.nome]));

      const rows = (lancRes.data ?? []) as unknown as LancamentoRow[];

      const all: Lancamento[] = rows.map((r) => {
        const contraparteNome =
          r.contraparte_id == null
            ? null
            : r.contraparte_tipo === "cliente"
              ? (cliMap.get(r.contraparte_id) ?? null)
              : (fornMap.get(r.contraparte_id) ?? null);

        return {
          id: r.id,
          tipo: r.tipo,
          data_vencimento: r.data_vencimento,
          data_efetivacao: r.data_efetivacao,
          data_competencia: r.data_competencia,
          descricao: r.descricao,
          valor: Number(r.valor || 0),
          status: r.status,
          categoria_id: r.categoria_id,
          categoria_nome: r.categoria_id ? (catMap.get(r.categoria_id) ?? null) : null,
          projeto_id: r.projeto_id,
          projeto_codigo: r.projeto_id ? (projMap.get(r.projeto_id) ?? null) : null,
          centro_custo_id: r.centro_custo_id,
          contraparte_id: r.contraparte_id,
          contraparte_tipo: r.contraparte_tipo,
          contraparte_nome: contraparteNome,
          forma_pagamento: r.forma_pagamento,
          cartao_id: r.cartao_id,
          parcela_numero: r.parcela_numero,
          parcela_total: r.parcela_total,
          grupo_parcela: r.grupo_parcela,
          grupo_tipo: r.grupo_tipo,
          grupo_status: r.grupo_status,
          grupo_total_original: r.grupo_total_original == null ? null : Number(r.grupo_total_original),
          tags: r.tags,
        };
      });

      all.sort((a, b) => {
        const da = a.data_efetivacao ?? a.data_vencimento;
        const db = b.data_efetivacao ?? b.data_vencimento;
        return db.localeCompare(da);
      });

      setData(all);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const categorias = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of data) if (l.categoria_id && l.categoria_nome) map.set(l.categoria_id, l.categoria_nome);
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome }));
  }, [data]);

  const projetos = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of data) if (l.projeto_id && l.projeto_codigo) map.set(l.projeto_id, l.projeto_codigo);
    return Array.from(map.entries()).map(([id, codigo]) => ({ id, codigo }));
  }, [data]);

  return { data, loading, categorias, projetos, refetch: fetchAll };
}
