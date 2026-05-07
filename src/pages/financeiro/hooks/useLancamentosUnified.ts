// Tipos do domínio de lançamentos financeiros — compartilhados entre
// LancamentosTable, LancamentoFormDialog, LancamentoDetailDialog,
// GrupoParcelaActions e useLancamentosPaginados.
//
// Arquitetura de dados financeiros:
//   useLancamentosPaginados  → tabela paginada (keyset cursor, TanStack Query infinite)
//   useFinanceItems          → listas completas para Despesas/Receitas (TanStack Query)
//   useFinanceData           → KPIs e gráficos para VisaoGeral/FluxoCaixa (TanStack Query)
//   useFinanceAuxData        → dados auxiliares do formulário (TanStack Query, staleTime 10min)

export type TipoLancamento = "receita" | "despesa" | "transferencia";
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
  conta_id: string | null;
  conta_nome: string | null;
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
  transferencia_par_id: string | null;
}
