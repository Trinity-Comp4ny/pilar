export interface ProjetoWithCliente {
  id: string;
  codigo_projeto: string | null;
  nome: string;
  status: string;
  prioridade: string;
  status_data: string | null;
  valor_contrato: number | null;
  data_inicio: string | null;
  data_previsao: string | null;
  data_final: string | null;
  cliente_id: string | null;
  clientes: { nome: string } | null;
}

export interface LeadRow {
  id: string;
  status: string;
  nome: string;
}

export interface AlertaRow {
  id: string;
  tipo: string;
  severidade: string;
  titulo: string;
  mensagem: string;
  created_at: string;
}

export interface ReceitaChartRow {
  valor: number;
  data_recebimento: string | null;
  data_vencimento: string;
  status: string;
}

export interface DespesaChartRow {
  valor: number;
  data_pagamento: string | null;
  data_vencimento: string;
  status: string;
}

export interface ProximaReceitaRow {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  status: string;
  projeto_id: string | null;
  projetos: { codigo_projeto: string | null } | null;
  cliente_id: string | null;
  clientes: { nome: string } | null;
}

export interface ProximaDespesaRow {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  status: string;
  projeto_id: string | null;
  projetos: { codigo_projeto: string | null } | null;
  fornecedor_id: string | null;
  fornecedores: { nome: string } | null;
}

export interface DashboardKPI {
  receitaMes: number;
  despesaMes: number;
  saldoMes: number;
  receitaVariacao: number;
  despesaVariacao: number;
  aReceber: number;
  aPagar: number;
  projetosAtivos: number;
}

export interface DashboardProjeto {
  id: string;
  nome: string;
  cliente: string;
  status: string;
  prioridade: string;
  statusData: string | null;
  valorContrato: number;
  dataInicio: string | null;
  dataPrevisao: string | null;
  dataFinal: string | null;
  progressoPrazo: number;
}

export interface DashboardVencimento {
  id: string;
  tipo: "receita" | "despesa";
  descricao: string;
  valor: number;
  vencimento: string;
  diasRestantes: number;
  status: string;
  projeto?: string | null;
  entidade?: string | null;
}

export interface LeadsPipeline {
  status: string;
  count: number;
  valor: number;
}

export interface DashboardAlerta {
  id: string;
  tipo: string;
  severidade: string;
  titulo: string;
  mensagem: string;
  created_at: string;
}

export interface ChartDataPoint {
  mes: string;
  receitas: number;
  despesas: number;
  saldo: number;
  sortKey: string;
}

export interface DashboardData {
  kpis: DashboardKPI;
  projetos: DashboardProjeto[];
  proximosVencimentos: DashboardVencimento[];
  leadsPipeline: LeadsPipeline[];
  leadsTotal: number;
  alertas: DashboardAlerta[];
  alertasNaoLidos: number;
}
