import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { softDelete } from "@/lib/softDelete";

export type CotacaoRow = Tables<"obra_cotacao">;
export type PropostaRow = Tables<"obra_cotacao_proposta">;
export type PropostaItemRow = Tables<"obra_cotacao_proposta_item">;
export type PropostaComFornecedor = PropostaRow & {
  fornecedor: { id: string; nome: string } | null;
  itens: PropostaItemRow[];
};
export type CotacaoComPropostas = CotacaoRow & { propostas: PropostaComFornecedor[] };

const cotacoesKey = (obraId: string) => ["obra_cotacao", obraId] as const;

/** Ao decidir e lançar despesa, a conta da obra e a margem mudam: invalidar as views que somam. */
function invalidarFinancas(qc: QueryClient, obraId: string) {
  qc.invalidateQueries({ queryKey: ["obra_conta", obraId] });
  qc.invalidateQueries({ queryKey: ["finance-items"] });
  qc.invalidateQueries({ queryKey: ["finance-data"] });
  qc.invalidateQueries({ queryKey: ["dashboard-rentabilidade"] });
  qc.invalidateQueries({ queryKey: ["projeto-rentabilidade"] });
}

/**
 * Cotações de uma obra com suas propostas (fornecedor embutido), mais recentes
 * primeiro. O embed de propostas não aplica o filtro de soft-delete, então
 * filtramos aqui as propostas removidas.
 *
 * `!cotacao_id` desambigua o embed: há duas FKs entre as tabelas (cotacao_id e a
 * reversa proposta_vencedora_id), e sem o hint o PostgREST recusa a query (PGRST201).
 */
export function useObraCotacoes(obraId: string | undefined) {
  return useQuery({
    queryKey: ["obra_cotacao", obraId],
    enabled: !!obraId,
    queryFn: async (): Promise<CotacaoComPropostas[]> => {
      const { data, error } = await supabase
        .from("obra_cotacao")
        .select(
          "*, propostas:obra_cotacao_proposta!cotacao_id(*, fornecedor:fornecedores(id, nome), itens:obra_cotacao_proposta_item(*))"
        )
        .eq("obra_id", obraId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .returns<CotacaoComPropostas[]>();
      if (error) throw error;
      return (data ?? []).map((c) => ({
        ...c,
        propostas: (c.propostas ?? [])
          .filter((p) => !p.deleted_at)
          .map((p) => ({ ...p, itens: [...(p.itens ?? [])].sort((a, b) => a.ordem - b.ordem) })),
      }));
    },
    staleTime: 1000 * 60 * 2,
  });
}

export type CotacaoTipo = "item" | "cesta";

export type CotacaoInput = {
  id?: string | null;
  descricao: string;
  tipo?: CotacaoTipo;
  obra_frente_id?: string | null;
  quantidade?: number | null;
  unidade?: string | null;
  prazo_necessidade?: string | null;
  observacoes?: string | null;
};

/** Cria ou edita uma cotação (a necessidade a cotar). */
export function useSaveCotacao(obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: CotacaoInput): Promise<void> => {
      if (id) {
        const { error } = await supabase.from("obra_cotacao").update(input).eq("id", id);
        if (error) throw error;
        return;
      }
      const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
      if (!empresaId) throw new Error("Usuário não vinculado a uma empresa");
      const { error } = await supabase
        .from("obra_cotacao")
        .insert({ ...input, empresa_id: empresaId, obra_id: obraId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: cotacoesKey(obraId) }),
  });
}

/** Soft delete da cotação (as propostas caem junto via ON DELETE CASCADE se for hard delete; aqui só marcamos). */
export function useDeleteCotacao(obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      // Via RPC: a policy de SELECT esconde deletado, então UPDATE direto leva 42501.
      const error = await softDelete("obra_cotacao", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: cotacoesKey(obraId) }),
  });
}

/** Reabre uma cotação decidida/cancelada: volta a 'aberta' e limpa a vencedora. */
export function useReabrirCotacao(obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from("obra_cotacao")
        .update({ status: "aberta", proposta_vencedora_id: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: cotacoesKey(obraId) }),
  });
}

export type PropostaItemInput = {
  descricao: string;
  quantidade?: number | null;
  unidade?: string | null;
  preco_unitario?: number | null;
  valor_total: number;
};

export type PropostaInput = {
  id?: string | null;
  fornecedor_id?: string | null;
  fornecedor_nome?: string | null;
  valor: number;
  prazo_entrega_dias?: number | null;
  condicao_pagamento?: string | null;
  link_orcamento?: string | null;
  observacoes?: string | null;
  /**
   * Cesta de itens da proposta (spec 023). `undefined` = não mexe nos itens
   * (edição de campos simples). Array (mesmo vazio) = sincroniza: apaga os itens
   * atuais e regrava estes. Os itens são filhos hard-delete (CASCADE).
   */
  itens?: PropostaItemInput[];
};

/** Grava os itens de uma proposta: apaga os atuais e insere a lista nova, na ordem dada. */
async function sincronizarItens(propostaId: string, empresaId: string, itens: PropostaItemInput[]): Promise<void> {
  const { error: delErr } = await supabase.from("obra_cotacao_proposta_item").delete().eq("proposta_id", propostaId);
  if (delErr) throw delErr;
  if (itens.length === 0) return;
  const rows = itens.map((it, ordem) => ({
    empresa_id: empresaId,
    proposta_id: propostaId,
    descricao: it.descricao,
    quantidade: it.quantidade ?? null,
    unidade: it.unidade ?? null,
    preco_unitario: it.preco_unitario ?? null,
    valor_total: it.valor_total,
    ordem,
  }));
  const { error: insErr } = await supabase.from("obra_cotacao_proposta_item").insert(rows);
  if (insErr) throw insErr;
}

/** Cria ou edita uma proposta de fornecedor dentro de uma cotação, com sua cesta de itens. */
export function useSaveProposta(obraId: string, cotacaoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, itens, ...input }: PropostaInput): Promise<void> => {
      const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
      if (!empresaId) throw new Error("Usuário não vinculado a uma empresa");

      if (id) {
        const { error } = await supabase.from("obra_cotacao_proposta").update(input).eq("id", id);
        if (error) throw error;
        if (itens !== undefined) await sincronizarItens(id, empresaId, itens);
        return;
      }
      const { data: nova, error } = await supabase
        .from("obra_cotacao_proposta")
        .insert({ ...input, empresa_id: empresaId, cotacao_id: cotacaoId })
        .select("id")
        .single();
      if (error) throw error;
      if (itens !== undefined && itens.length > 0) await sincronizarItens(nova.id, empresaId, itens);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: cotacoesKey(obraId) }),
  });
}

export function useDeleteProposta(obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const error = await softDelete("obra_cotacao_proposta", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: cotacoesKey(obraId) }),
  });
}

export type ClassificacaoOrcamento = { tipo: string; confianca: number; motivo: string | null };

export type OrcamentoCesta = {
  modo: "cesta";
  classificacao: ClassificacaoOrcamento | null;
  fornecedor_nome: string | null;
  itens: PropostaItemInput[];
  avisos: string[];
};

export type OrcamentoItemUnico = {
  modo: "item";
  classificacao: ClassificacaoOrcamento | null;
  fornecedor_nome: string | null;
  valor_total: number;
  prazo_entrega_dias: number | null;
  condicao_pagamento: string | null;
  avisos: string[];
};

export type PropostaComparativa = {
  fornecedor_nome: string;
  quantidade: number | null;
  unidade: string | null;
  /** Preço à vista (base de comparação; vira o `valor` da proposta). */
  valor_a_vista: number;
  /** Preço cheio/parcelado, quando difere do à vista. */
  valor_parcelado: number | null;
  condicao_pagamento: string | null;
  /** Confiança 0–1 da extração da IA (após verificação). */
  confianca: number;
};

export type OrcamentoComparativo = {
  modo: "comparativo";
  classificacao: ClassificacaoOrcamento | null;
  item_nome: string | null;
  propostas: PropostaComparativa[];
  avisos: string[];
};

export type OrcamentoImportado = OrcamentoCesta | OrcamentoItemUnico | OrcamentoComparativo;

/**
 * Modo do import por IA. 'auto' (padrão) deixa a IA CLASSIFICAR o documento e
 * rotear sozinha; os outros forçam um tipo. O resultado sempre traz o modo real.
 */
export type ImportModo = "auto" | "item" | "cesta" | "comparativo";

export type ImportarOrcamentoInput = {
  file: File;
  modo: ImportModo;
  contexto?: string;
};

const MIME_ORCAMENTO = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const MAX_ARQUIVO_BYTES = 8 * 1024 * 1024;

/** Lê um arquivo como base64 puro (sem o prefixo data:...;base64,). */
function arquivoParaBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.includes(",") ? result.slice(result.indexOf(",") + 1) : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo"));
    reader.readAsDataURL(file);
  });
}

/**
 * Envia um PDF/imagem de orçamento para a edge function ai-cotacao-import, que usa
 * o Gemini multimodal para extrair os itens (spec 023). Retorna a cesta sugerida
 * para o preview editável, sem gravar nada.
 */
export function useImportarOrcamento() {
  return useMutation({
    mutationFn: async ({ file, modo, contexto }: ImportarOrcamentoInput): Promise<OrcamentoImportado> => {
      // Valida no cliente antes de subir: feedback imediato e evita upload à toa.
      if (!MIME_ORCAMENTO.includes(file.type)) {
        throw new Error("Formato não suportado. Envie PDF, PNG, JPG ou WebP.");
      }
      if (file.size > MAX_ARQUIVO_BYTES) {
        throw new Error("Arquivo grande demais (máx. 8 MB). Reduza ou divida o orçamento.");
      }

      const arquivoBase64 = await arquivoParaBase64(file);
      const { data, error } = await supabase.functions.invoke("ai-cotacao-import", {
        body: { arquivoBase64, mimeType: file.type, modo, contexto: contexto ?? "" },
      });
      if (error) {
        // O invoke devolve uma mensagem genérica em non-2xx; o motivo real (ex.:
        // "timeout do Gemini", "arquivo grande") vem no corpo da resposta.
        let motivo = error.message;
        if (error instanceof FunctionsHttpError) {
          try {
            const corpo = await error.context.json();
            if (corpo?.error) motivo = corpo.error;
          } catch {
            // corpo não-JSON: mantém a mensagem genérica
          }
        }
        throw new Error(motivo);
      }

      // Em 'auto' o backend decide; o modo real vem no próprio payload.
      const payload = data as { modo?: string; classificacao?: ClassificacaoOrcamento | null };
      const modoRet =
        payload.modo === "comparativo" || payload.modo === "cesta" || payload.modo === "item" ? payload.modo : modo;
      const classificacao = payload.classificacao ?? null;

      if (modoRet === "cesta") {
        const res = data as { fornecedor_nome?: string | null; itens?: PropostaItemInput[]; avisos?: string[] };
        return {
          modo: "cesta",
          classificacao,
          fornecedor_nome: res.fornecedor_nome ?? null,
          itens: res.itens ?? [],
          avisos: res.avisos ?? [],
        };
      }
      if (modoRet === "comparativo") {
        const res = data as {
          item_nome?: string | null;
          propostas?: Array<Partial<PropostaComparativa>>;
          avisos?: string[];
        };
        return {
          modo: "comparativo",
          classificacao,
          item_nome: res.item_nome ?? null,
          propostas: (res.propostas ?? []).map((p) => ({
            fornecedor_nome: p.fornecedor_nome ?? "",
            quantidade: p.quantidade ?? null,
            unidade: p.unidade ?? null,
            valor_a_vista: p.valor_a_vista ?? 0,
            valor_parcelado: p.valor_parcelado ?? null,
            condicao_pagamento: p.condicao_pagamento ?? null,
            confianca: p.confianca ?? 0.7,
          })),
          avisos: res.avisos ?? [],
        };
      }
      const res = data as {
        fornecedor_nome?: string | null;
        valor_total?: number;
        prazo_entrega_dias?: number | null;
        condicao_pagamento?: string | null;
        avisos?: string[];
      };
      return {
        modo: "item",
        classificacao,
        fornecedor_nome: res.fornecedor_nome ?? null,
        valor_total: res.valor_total ?? 0,
        prazo_entrega_dias: res.prazo_entrega_dias ?? null,
        condicao_pagamento: res.condicao_pagamento ?? null,
        avisos: res.avisos ?? [],
      };
    },
  });
}

/** Cria várias propostas de uma vez (import de comparativo → uma proposta por fornecedor). */
export function useSalvarPropostasEmLote(obraId: string, cotacaoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (propostas: PropostaComparativa[]): Promise<void> => {
      if (propostas.length === 0) return;
      const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
      if (!empresaId) throw new Error("Usuário não vinculado a uma empresa");
      const rows = propostas.map((p) => ({
        empresa_id: empresaId,
        cotacao_id: cotacaoId,
        fornecedor_nome: p.fornecedor_nome,
        valor: p.valor_a_vista,
        valor_parcelado: p.valor_parcelado,
        quantidade: p.quantidade,
        unidade: p.unidade,
        condicao_pagamento: p.condicao_pagamento,
      }));
      const { error } = await supabase.from("obra_cotacao_proposta").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: cotacoesKey(obraId) }),
  });
}

export type DecisaoInput = {
  cotacaoId: string;
  proposta: PropostaComFornecedor;
  cotacaoDescricao: string;
  obraFrenteId: string | null;
  /** Se true, lança a vencedora como despesa na conta da obra (RPC transacional). */
  lancarDespesa: boolean;
  data: string;
};

/**
 * Decide a cotação: marca status 'decidida' + a proposta vencedora. Se pedido,
 * lança a vencedora como despesa reusando rpc_obra_despesa_salvar (a taxa de
 * administração sai de lá, sem duplicar lógica de dinheiro aqui).
 */
export function useDecidirCotacao(obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DecisaoInput): Promise<void> => {
      const { error } = await supabase
        .from("obra_cotacao")
        .update({ status: "decidida", proposta_vencedora_id: input.proposta.id })
        .eq("id", input.cotacaoId);
      if (error) throw error;

      if (input.lancarDespesa) {
        const fornecedor = input.proposta.fornecedor?.nome ?? input.proposta.fornecedor_nome ?? "fornecedor";
        const { error: despErr } = await supabase.rpc("rpc_obra_despesa_salvar", {
          p_obra_id: obraId,
          p_data: input.data,
          p_descricao: `${input.cotacaoDescricao} — ${fornecedor}`,
          p_valor: Number(input.proposta.valor),
          p_obra_frente_id: input.obraFrenteId ?? undefined,
          p_fornecedor_id: input.proposta.fornecedor_id ?? undefined,
          p_pago_por: "cliente",
        });
        if (despErr) throw despErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cotacoesKey(obraId) });
      invalidarFinancas(qc, obraId);
    },
  });
}

export interface CotacaoPendente {
  id: string;
  obra_id: string;
  obra_nome: string;
  descricao: string;
  prazo_necessidade: string | null;
  created_at: string;
}

/**
 * Cotações abertas de TODAS as obras da empresa (spec 064): sem `.eq("obra_id", ...)`,
 * a própria RLS de `obra_cotacao` (por `empresa_id`) já restringe à empresa do
 * usuário. Ordenação de urgência fica no cliente (`ordenarCotacoesPendentes`).
 */
export function useCotacoesPendentesEmpresa() {
  return useQuery({
    queryKey: ["obra_cotacao_pendentes"],
    queryFn: async (): Promise<CotacaoPendente[]> => {
      const { data, error } = await supabase
        .from("obra_cotacao")
        .select("id, obra_id, descricao, prazo_necessidade, created_at, obras(nome)")
        .eq("status", "aberta")
        .is("deleted_at", null)
        .returns<
          Array<{
            id: string;
            obra_id: string;
            descricao: string;
            prazo_necessidade: string | null;
            created_at: string;
            obras: { nome: string } | null;
          }>
        >();
      if (error) throw error;
      return (data ?? []).map((c) => ({
        id: c.id,
        obra_id: c.obra_id,
        obra_nome: c.obras?.nome ?? "Obra removida",
        descricao: c.descricao,
        prazo_necessidade: c.prazo_necessidade,
        created_at: c.created_at,
      }));
    },
    staleTime: 1000 * 30,
  });
}
