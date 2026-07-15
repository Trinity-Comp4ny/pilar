import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { detectTipoChavePix, type TipoChavePix } from "@/lib/pixUtils";
import { parseCurrencyString } from "@/lib/currencyUtils";

export interface ContaItem {
  id: string;
  nome: string;
  banco: string;
  chave_pix?: string | null;
  tipo_chave_pix?: TipoChavePix | null;
  cor: string | null;
  empresa_id: string;
  saldo_inicial: number;
  saldo_atual: number;
  total_entradas: number;
  total_saidas: number;
}

export interface CartaoItem {
  id: string;
  nome: string;
  tipo: string;
  dia_fechamento: number;
  dia_vencimento: number;
  limite: number;
  usado: number;
  disponivel: number;
  conta_pagamento_id: string | null;
}

// Chaves de cache. "cartoes-resumo", "faturas" e "despesas-fatura" são as MESMAS
// usadas por useFaturas, então uma alteração de cartão feita aqui invalida a aba
// Faturas (e o cartão criado/excluído reflete nos dois lugares).
export const CONTAS_KEYS = {
  contasResumo: ["contas-resumo"] as const,
  contasList: ["contas-list"] as const,
  cartoesResumo: ["cartoes-resumo"] as const,
  faturas: ["faturas"] as const,
  despesasFatura: ["despesas-fatura"] as const,
};

const STALE_30S = 30 * 1000;

// Query: contas do painel (view_financas_resumo) enriquecidas com a chave PIX.
// Erros da consulta de PIX são ignorados de propósito (só some o badge do PIX),
// exatamente como na versão anterior da página.
export function useContasResumo() {
  return useQuery({
    queryKey: CONTAS_KEYS.contasResumo,
    staleTime: STALE_30S,
    queryFn: async () => {
      const { data: viewData, error } = await supabase.from("view_financas_resumo").select("*");
      if (error) throw error;
      if (!viewData) return [] as ContaItem[];

      const ids = viewData.map((c) => c.conta_id).filter(Boolean) as string[];
      const { data: pixData = [] } = ids.length
        ? await supabase.from("contas").select("id, chave_pix, tipo_chave_pix").in("id", ids)
        : { data: [] };

      const pixMap = Object.fromEntries((pixData ?? []).map((p) => [p.id, p]));

      return viewData.map((c) => ({
        id: c.conta_id,
        nome: c.conta_nome,
        banco: c.banco,
        cor: c.cor,
        empresa_id: c.empresa_id,
        saldo_inicial: c.saldo_inicial,
        saldo_atual: c.saldo_atual,
        total_entradas: c.total_entradas,
        total_saidas: c.total_saidas,
        chave_pix: c.conta_id ? (pixMap[c.conta_id]?.chave_pix ?? null) : null,
        tipo_chave_pix: c.conta_id ? ((pixMap[c.conta_id]?.tipo_chave_pix as TipoChavePix) ?? null) : null,
      })) as ContaItem[];
    },
  });
}

// Query: cartões do painel (view_cartao_resumo). Compartilha a chave
// "cartoes-resumo" com useFaturas para manter os dois em sincronia.
export function useCartoesResumoDetalhado() {
  return useQuery({
    queryKey: CONTAS_KEYS.cartoesResumo,
    staleTime: STALE_30S,
    queryFn: async () => {
      const { data, error } = await supabase.from("view_cartao_resumo").select("*");
      if (error) throw error;
      return (data ?? []) as CartaoItem[];
    },
  });
}

// Erro que carrega o título e (opcionalmente) a descrição exatos do toast. As
// mensagens variavam por operação na página original, então preservamos cada uma.
class MutationToastError extends Error {
  constructor(
    public title: string,
    public toastDescription?: string
  ) {
    super(title);
    this.name = "MutationToastError";
  }
}

async function getEmpresaIdOrThrow(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new MutationToastError("Erro", "Usuário não autenticado");

  const empresaIdResult = await supabase.rpc("get_user_empresa_id");
  const empresaId = empresaIdResult.data;
  if (!empresaId) throw new MutationToastError("Erro", "Empresa não encontrada");
  return empresaId;
}

export interface SaveContaArgs {
  selected: ContaItem | null;
  nome: string;
  banco: string;
  saldoInicial: string;
  chavePix: string;
}

export interface SaveCartaoArgs {
  selected: CartaoItem | null;
  nome: string;
  tipoCartao: "credito" | "debito";
  diaFechamento: string;
  diaVencimento: string;
  limite: string;
  contaPagamentoId: string;
}

async function saveContaImpl({ selected, nome, banco, saldoInicial, chavePix }: SaveContaArgs) {
  const empresaId = await getEmpresaIdOrThrow();

  const pixTipo = chavePix ? (detectTipoChavePix(chavePix) ?? null) : null;

  if (selected) {
    const { error } = await supabase
      .from("contas")
      .update({
        nome,
        banco,
        saldo_inicial: parseCurrencyString(saldoInicial),
        chave_pix: chavePix || null,
        tipo_chave_pix: pixTipo,
      })
      .eq("id", selected.id);

    if (error) throw new MutationToastError("Erro ao atualizar conta", error.message);
    return { isEdit: true };
  }

  // saldo_atual não é definido aqui — é calculado pela view_financas_resumo
  const payload = {
    empresa_id: empresaId,
    nome,
    banco,
    saldo_inicial: parseCurrencyString(saldoInicial),
    cor: "hsl(var(--chart-neutral))",
    chave_pix: chavePix || null,
    tipo_chave_pix: pixTipo,
  };
  const { error } = await supabase.from("contas").insert(payload);
  if (error) throw new MutationToastError("Erro ao criar conta", error.message);
  return { isEdit: false };
}

async function saveCartaoImpl({
  selected,
  nome,
  tipoCartao,
  diaFechamento,
  diaVencimento,
  limite,
  contaPagamentoId,
}: SaveCartaoArgs) {
  const empresaId = await getEmpresaIdOrThrow();

  const contaPagId = contaPagamentoId === "__none__" ? null : contaPagamentoId || null;

  if (selected) {
    const { error } = await supabase
      .from("cartoes")
      .update({
        nome,
        tipo: tipoCartao,
        dia_fechamento: parseInt(diaFechamento),
        dia_vencimento: parseInt(diaVencimento),
        limite: parseCurrencyString(limite),
        conta_pagamento_id: contaPagId,
      })
      .eq("id", selected.id);

    if (error) throw new MutationToastError("Erro ao atualizar");
    return { isEdit: true };
  }

  const payload = {
    empresa_id: empresaId,
    nome,
    tipo: tipoCartao,
    dia_fechamento: parseInt(diaFechamento),
    dia_vencimento: parseInt(diaVencimento),
    limite: parseCurrencyString(limite),
    usado: 0,
    conta_pagamento_id: contaPagId,
  };
  const { error } = await supabase.from("cartoes").insert(payload as never);
  if (error) throw new MutationToastError("Erro ao criar cartão");
  return { isEdit: false };
}

async function deleteContaImpl(id: string) {
  const { count: receitasCount } = await supabase
    .from("receitas")
    .select("id", { count: "exact", head: true })
    .eq("conta_id", id)
    .is("deleted_at", null);
  const { count: despesasCount } = await supabase
    .from("despesas")
    .select("id", { count: "exact", head: true })
    .eq("conta_id", id)
    .is("deleted_at", null);
  const total = (receitasCount ?? 0) + (despesasCount ?? 0);
  if (total > 0) {
    throw new MutationToastError(
      "Conta com movimentações",
      `Existem ${total} lançamento(s) vinculados. Reatribua-os antes de excluir.`
    );
  }
  // Soft delete: mantém histórico; a view_financas_resumo filtra deleted_at.
  const { error } = await supabase
    .from("contas")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new MutationToastError("Não foi possível excluir a conta. Tente novamente.");
}

async function deleteCartaoImpl(id: string) {
  // Ignora faturas vazias pré-criadas (valor_total 0 e ainda Aberta).
  const { count: faturasCount } = await supabase
    .from("faturas")
    .select("id", { count: "exact", head: true })
    .eq("cartao_id", id)
    .or("valor_total.gt.0,status.neq.Aberta");
  if ((faturasCount ?? 0) > 0) {
    throw new MutationToastError(
      "Cartão com faturas",
      `Existem ${faturasCount} fatura(s) vinculada(s). Quite-as antes de excluir o cartão.`
    );
  }
  // Soft delete: a view_cartao_resumo filtra deleted_at.
  const { error } = await supabase
    .from("cartoes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new MutationToastError("Não foi possível excluir o cartão. Tente novamente.");
}

export function useContasCartoesMutations() {
  const qc = useQueryClient();

  const invalidateContas = () => {
    qc.invalidateQueries({ queryKey: CONTAS_KEYS.contasResumo });
    qc.invalidateQueries({ queryKey: CONTAS_KEYS.contasList });
  };
  const invalidateCartoes = () => {
    // Coordena com useFaturas: cartão alterado reflete na aba Faturas.
    qc.invalidateQueries({ queryKey: CONTAS_KEYS.cartoesResumo });
    qc.invalidateQueries({ queryKey: CONTAS_KEYS.faturas });
    qc.invalidateQueries({ queryKey: CONTAS_KEYS.despesasFatura });
  };

  // Reproduz os toasts exatos da página: MutationToastError carrega o texto certo;
  // qualquer erro inesperado cai no "Erro" genérico (igual ao catch original).
  const showError = (err: unknown) => {
    if (err instanceof MutationToastError) {
      toast.error(err.title, err.toastDescription ? { description: err.toastDescription } : undefined);
      return;
    }
    toast.error("Erro");
  };

  const saveConta = useMutation({
    mutationFn: saveContaImpl,
    onSuccess: ({ isEdit }) => {
      toast.success(isEdit ? "Conta atualizada" : "Conta criada");
      invalidateContas();
    },
    onError: showError,
  });

  const saveCartao = useMutation({
    mutationFn: saveCartaoImpl,
    onSuccess: ({ isEdit }) => {
      toast.success(isEdit ? "Cartão atualizado" : "Cartão criado");
      invalidateCartoes();
    },
    onError: showError,
  });

  const deleteConta = useMutation({
    mutationFn: deleteContaImpl,
    onSuccess: () => {
      toast.success("Conta desativada");
      invalidateContas();
    },
    onError: showError,
  });

  const deleteCartao = useMutation({
    mutationFn: deleteCartaoImpl,
    onSuccess: () => {
      toast.success("Cartão desativado");
      invalidateCartoes();
    },
    onError: showError,
  });

  return { saveConta, saveCartao, deleteConta, deleteCartao };
}
