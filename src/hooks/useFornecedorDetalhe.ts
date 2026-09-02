import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  agruparPorObra,
  calcularResumo,
  statusProposta,
  type CompraInsight,
  type ObraRollup,
  type PropostaInsight,
  type ResumoFornecedor,
} from "@/lib/fornecedorInsights";

export type FornecedorCadastro = Tables<"fornecedores">;

export type ItemView = {
  descricao: string;
  quantidade: number | null;
  unidade: string | null;
  preco_unitario: number | null;
  valor_total: number;
};

/** Proposta do fornecedor pronta pra aba Cotações (insight + itens do orçamento). */
export type CotacaoView = PropostaInsight & { itens: ItemView[] };

/** Compra real da conta da obra, pronta pra aba Compras. */
export type CompraView = CompraInsight & { frente: string | null; comprovanteUrl: string | null };

export type FornecedorDetalhe = {
  fornecedor: FornecedorCadastro;
  resumo: ResumoFornecedor;
  cotacoes: CotacaoView[];
  compras: CompraView[];
  obras: ObraRollup[];
};

/** Cria um fornecedor só com o nome (cadastro inline a partir da proposta). Devolve o id. */
export function useCriarFornecedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nome: string): Promise<string> => {
      const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
      if (!empresaId) throw new Error("Usuário não vinculado a uma empresa");
      const { data, error } = await supabase
        .from("fornecedores")
        .insert({ nome, empresa_id: empresaId } as never)
        .select("id")
        .single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fornecedores-lite"] }),
  });
}

/** Lista enxuta de fornecedores da empresa (para reconciliação e selects). */
export function useFornecedoresLite() {
  return useQuery({
    queryKey: ["fornecedores-lite"],
    queryFn: async (): Promise<{ id: string; nome: string; cnpj: string | null }[]> => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("id, nome, cnpj")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Histórico consolidado de um fornecedor (spec 026), sem tabela nova: junta as
 * propostas dele (cotações da obra) e as compras da conta da obra, e deriva os
 * agregados no cliente com `@/lib/fornecedorInsights`.
 *
 * O hint `!cotacao_id` é obrigatório: há duas FKs entre proposta e cotação
 * (cotacao_id e a reversa proposta_vencedora_id), então sem ele o PostgREST
 * recusa o embed (PGRST201).
 */
export function useFornecedorDetalhe(fornecedorId: string | undefined) {
  return useQuery({
    queryKey: ["fornecedor-detalhe", fornecedorId],
    enabled: !!fornecedorId,
    staleTime: 1000 * 60 * 2,
    queryFn: async (): Promise<FornecedorDetalhe> => {
      const [cadastroRes, propostasRes, comprasRes] = await Promise.all([
        supabase.from("fornecedores").select("*").eq("id", fornecedorId!).single(),
        supabase
          .from("obra_cotacao_proposta")
          .select(
            "id, valor, deleted_at, cotacao:obra_cotacao!cotacao_id(id, descricao, status, proposta_vencedora_id, obra_id, deleted_at, obra:obras(nome)), itens:obra_cotacao_proposta_item(descricao, quantidade, unidade, preco_unitario, valor_total, ordem)"
          )
          .eq("fornecedor_id", fornecedorId!)
          .is("deleted_at", null),
        supabase
          .from("obra_conta_lancamento")
          .select("id, data, descricao, valor, obra_id, comprovante_url, obra:obras(nome), frente:obra_frente(nome)")
          .eq("fornecedor_id", fornecedorId!)
          .eq("tipo", "despesa")
          .is("deleted_at", null)
          .order("data", { ascending: false }),
      ]);

      if (cadastroRes.error) throw cadastroRes.error;
      if (propostasRes.error) throw propostasRes.error;
      if (comprasRes.error) throw comprasRes.error;

      type PropostaRaw = {
        id: string;
        valor: number;
        cotacao: {
          id: string;
          descricao: string;
          status: string;
          proposta_vencedora_id: string | null;
          obra_id: string;
          deleted_at: string | null;
          obra: { nome: string } | null;
        } | null;
        itens: Array<ItemView & { ordem: number }> | null;
      };

      const cotacoes: CotacaoView[] = ((propostasRes.data ?? []) as unknown as PropostaRaw[])
        // Proposta de cotação removida não conta no histórico.
        .filter((p) => p.cotacao && !p.cotacao.deleted_at)
        .map((p) => {
          const c = p.cotacao!;
          return {
            propostaId: p.id,
            cotacaoId: c.id,
            obraId: c.obra_id,
            obraNome: c.obra?.nome ?? "Obra removida",
            descricao: c.descricao,
            valor: Number(p.valor),
            status: statusProposta(c.status, p.id, c.proposta_vencedora_id),
            itens: [...(p.itens ?? [])].sort((a, b) => a.ordem - b.ordem).map(({ ordem: _ordem, ...it }) => it),
          };
        });

      type CompraRaw = {
        id: string;
        data: string;
        descricao: string;
        valor: number;
        obra_id: string;
        comprovante_url: string | null;
        obra: { nome: string } | null;
        frente: { nome: string } | null;
      };

      const compras: CompraView[] = ((comprasRes.data ?? []) as unknown as CompraRaw[]).map((c) => ({
        lancamentoId: c.id,
        obraId: c.obra_id,
        obraNome: c.obra?.nome ?? "Obra removida",
        data: c.data,
        descricao: c.descricao,
        valor: Number(c.valor),
        frente: c.frente?.nome ?? null,
        comprovanteUrl: c.comprovante_url,
      }));

      const insights: PropostaInsight[] = cotacoes.map(({ itens: _itens, ...rest }) => rest);

      return {
        fornecedor: cadastroRes.data,
        resumo: calcularResumo(insights, compras),
        cotacoes,
        compras,
        obras: agruparPorObra(insights, compras),
      };
    },
  });
}

/** Um nome solto de proposta de campo (fornecedor_id nulo), agrupado. */
export type NomeNaoVinculado = {
  nome: string;
  propostas: number;
  exemploObra: string | null;
  exemploDescricao: string | null;
};

/**
 * Propostas digitadas como texto livre (fornecedor_nome, sem vínculo com o
 * cadastro), agrupadas por nome. É a fila de reconciliação da spec 026.
 */
export function usePropostasNaoVinculadas() {
  return useQuery({
    queryKey: ["propostas-nao-vinculadas"],
    staleTime: 1000 * 60,
    queryFn: async (): Promise<NomeNaoVinculado[]> => {
      const { data, error } = await supabase
        .from("obra_cotacao_proposta")
        .select("fornecedor_nome, cotacao:obra_cotacao!cotacao_id(descricao, deleted_at, obra:obras(nome))")
        .is("fornecedor_id", null)
        .not("fornecedor_nome", "is", null)
        .is("deleted_at", null);
      if (error) throw error;

      type Raw = {
        fornecedor_nome: string | null;
        cotacao: { descricao: string; deleted_at: string | null; obra: { nome: string } | null } | null;
      };

      const grupos = new Map<string, NomeNaoVinculado>();
      for (const row of (data ?? []) as unknown as Raw[]) {
        const nome = row.fornecedor_nome?.trim();
        if (!nome || (row.cotacao && row.cotacao.deleted_at)) continue;
        const atual = grupos.get(nome) ?? {
          nome,
          propostas: 0,
          exemploObra: row.cotacao?.obra?.nome ?? null,
          exemploDescricao: row.cotacao?.descricao ?? null,
        };
        atual.propostas += 1;
        grupos.set(nome, atual);
      }
      return [...grupos.values()].sort((a, b) => b.propostas - a.propostas);
    },
  });
}

/**
 * Vincula todas as propostas com um dado `fornecedor_nome` solto a um fornecedor
 * do cadastro. RLS já garante o escopo da empresa. Passa a contar no histórico.
 */
export function useVincularFornecedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ nome, fornecedorId }: { nome: string; fornecedorId: string }): Promise<void> => {
      const { error } = await supabase
        .from("obra_cotacao_proposta")
        .update({ fornecedor_id: fornecedorId })
        .eq("fornecedor_nome", nome)
        .is("fornecedor_id", null)
        .is("deleted_at", null);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["propostas-nao-vinculadas"] });
      qc.invalidateQueries({ queryKey: ["fornecedor-detalhe"] });
    },
  });
}
