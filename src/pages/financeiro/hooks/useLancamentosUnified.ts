import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TipoLancamento = "receita" | "despesa";

export interface Lancamento {
  id: string;
  tipo: TipoLancamento;
  data_vencimento: string;
  data_efetivacao: string | null;
  descricao: string;
  valor: number;
  status: string;
  categoria_id: string | null;
  categoria_nome: string | null;
  projeto_id: string | null;
  projeto_codigo: string | null;
  contraparte_id: string | null;
  contraparte_nome: string | null;
  forma_pagamento: string | null;
  parcela_numero: number | null;
  parcela_total: number | null;
  grupo_parcela: string | null;
}

interface UseLancamentosArgs {
  from: string | null;
  to: string | null;
}

export function useLancamentosUnified({ from, to }: UseLancamentosArgs) {
  const [data, setData] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      let recQ = supabase
        .from("receitas")
        .select(
          `id, data_vencimento, data_recebimento, descricao, valor, status, categoria_id, projeto_id, cliente_id,
           forma_pagamento, parcela_numero, parcela_total, grupo_parcela,
           categorias_financeiras(nome), clientes(nome), projetos(codigo_projeto)`
        )
        .is("deleted_at", null);
      let despQ = supabase
        .from("despesas")
        .select(
          `id, data_vencimento, data_pagamento, descricao, valor, status, categoria_id, projeto_id, fornecedor_id,
           forma_pagamento, parcela_numero, parcela_total, grupo_parcela,
           categorias_financeiras(nome), fornecedores(nome), projetos(codigo_projeto)`
        )
        .is("deleted_at", null);

      if (from) {
        recQ = recQ.gte("data_vencimento", from);
        despQ = despQ.gte("data_vencimento", from);
      }
      if (to) {
        recQ = recQ.lte("data_vencimento", to);
        despQ = despQ.lte("data_vencimento", to);
      }

      const [{ data: rec }, { data: desp }] = await Promise.all([recQ, despQ]);

      type RecRow = {
        id: string;
        data_vencimento: string;
        data_recebimento: string | null;
        descricao: string;
        valor: number;
        status: string;
        categoria_id: string | null;
        projeto_id: string | null;
        cliente_id: string | null;
        forma_pagamento: string | null;
        parcela_numero: number | null;
        parcela_total: number | null;
        grupo_parcela: string | null;
        categorias_financeiras: { nome: string } | null;
        clientes: { nome: string } | null;
        projetos: { codigo_projeto: string | null } | null;
      };
      type DespRow = {
        id: string;
        data_vencimento: string;
        data_pagamento: string | null;
        descricao: string;
        valor: number;
        status: string;
        categoria_id: string | null;
        projeto_id: string | null;
        fornecedor_id: string | null;
        forma_pagamento: string | null;
        parcela_numero: number | null;
        parcela_total: number | null;
        grupo_parcela: string | null;
        categorias_financeiras: { nome: string } | null;
        fornecedores: { nome: string } | null;
        projetos: { codigo_projeto: string | null } | null;
      };

      const receitas: Lancamento[] = ((rec ?? []) as unknown as RecRow[]).map((r) => ({
        id: r.id,
        tipo: "receita",
        data_vencimento: r.data_vencimento,
        data_efetivacao: r.data_recebimento,
        descricao: r.descricao,
        valor: Number(r.valor || 0),
        status: r.status,
        categoria_id: r.categoria_id,
        categoria_nome: r.categorias_financeiras?.nome ?? null,
        projeto_id: r.projeto_id,
        projeto_codigo: r.projetos?.codigo_projeto ?? null,
        contraparte_id: r.cliente_id,
        contraparte_nome: r.clientes?.nome ?? null,
        forma_pagamento: r.forma_pagamento,
        parcela_numero: r.parcela_numero,
        parcela_total: r.parcela_total,
        grupo_parcela: r.grupo_parcela,
      }));

      const despesas: Lancamento[] = ((desp ?? []) as unknown as DespRow[]).map((d) => ({
        id: d.id,
        tipo: "despesa",
        data_vencimento: d.data_vencimento,
        data_efetivacao: d.data_pagamento,
        descricao: d.descricao,
        valor: Number(d.valor || 0),
        status: d.status,
        categoria_id: d.categoria_id,
        categoria_nome: d.categorias_financeiras?.nome ?? null,
        projeto_id: d.projeto_id,
        projeto_codigo: d.projetos?.codigo_projeto ?? null,
        contraparte_id: d.fornecedor_id,
        contraparte_nome: d.fornecedores?.nome ?? null,
        forma_pagamento: d.forma_pagamento,
        parcela_numero: d.parcela_numero,
        parcela_total: d.parcela_total,
        grupo_parcela: d.grupo_parcela,
      }));

      const all = [...receitas, ...despesas].sort((a, b) => {
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
