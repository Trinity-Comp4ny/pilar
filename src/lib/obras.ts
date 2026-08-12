/**
 * Domínio de Obras (spec 015, ADR 0011). Constantes e cálculos puros, sem
 * dependência de rede, para serem testáveis e reusados por hooks e telas.
 */

import { parseDate, startOfDay } from "./cronograma";

export type ObraStatus = "planejada" | "em_andamento" | "paralisada" | "concluida";
export type ClimaRdo = "ensolarado" | "nublado" | "chuvoso" | "chuva_forte";
export type CondicaoTrabalho = "normal" | "parcial" | "paralisada";

export const STATUS_OBRA_OPCOES: ReadonlyArray<{ value: ObraStatus; label: string }> = [
  { value: "planejada", label: "Planejada" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "paralisada", label: "Paralisada" },
  { value: "concluida", label: "Concluída" },
];

export const CLIMA_OPCOES: ReadonlyArray<{ value: ClimaRdo; label: string }> = [
  { value: "ensolarado", label: "Ensolarado" },
  { value: "nublado", label: "Nublado" },
  { value: "chuvoso", label: "Chuvoso" },
  { value: "chuva_forte", label: "Chuva forte" },
];

export const CONDICAO_OPCOES: ReadonlyArray<{ value: CondicaoTrabalho; label: string }> = [
  { value: "normal", label: "Trabalho normal" },
  { value: "parcial", label: "Trabalho parcial" },
  { value: "paralisada", label: "Obra paralisada" },
];

const CLIMA_LABEL: Record<string, string> = Object.fromEntries(CLIMA_OPCOES.map((o) => [o.value, o.label]));
const CONDICAO_LABEL: Record<string, string> = Object.fromEntries(CONDICAO_OPCOES.map((o) => [o.value, o.label]));

export const climaLabel = (v: string | null | undefined): string => (v ? (CLIMA_LABEL[v] ?? v) : "");
export const condicaoLabel = (v: string | null | undefined): string => (v ? (CONDICAO_LABEL[v] ?? v) : "");

/**
 * Avanço da obra = tarefas concluídas / total, em % inteiro (spec 015: avanço é
 * determinístico, não campo manual). Sem tarefas → 0.
 */
export function calcularAvanco(tarefas: ReadonlyArray<{ status: string }>): number {
  if (tarefas.length === 0) return 0;
  const concluidas = tarefas.filter((t) => t.status === "concluida").length;
  return Math.round((concluidas / tarefas.length) * 100);
}

// --- Cronograma da obra (spec 020: frentes na linha do tempo) -----------------

/**
 * Estado de uma frente no cronograma, derivado das datas previstas e do avanço
 * das pendências (nunca de um campo manual):
 * - `sem_prazo`: falta início ou fim → fica fora da timeline, listada à parte.
 * - `concluida`: todas as pendências fechadas (verde, mesmo antes do fim).
 * - `atrasada`: hoje já passou do fim e a frente não está concluída (vermelho).
 * - `em_andamento`: hoje entre início e fim (azul).
 * - `futura`: início ainda não chegou (cinza).
 */
export type EstadoFrente = "sem_prazo" | "concluida" | "atrasada" | "em_andamento" | "futura";

export function estadoFrenteCronograma(
  frente: { data_inicio?: string | null; data_fim?: string | null },
  tarefas: ReadonlyArray<{ status: string }>,
  hoje: Date = new Date()
): EstadoFrente {
  const inicio = parseDate(frente.data_inicio);
  const fim = parseDate(frente.data_fim);
  if (!inicio || !fim) return "sem_prazo";

  const total = tarefas.length;
  const concluidas = tarefas.filter((t) => t.status === "concluida").length;
  if (total > 0 && concluidas === total) return "concluida";

  const hojeDia = startOfDay(hoje);
  if (hojeDia > fim) return "atrasada";
  if (hojeDia >= inicio) return "em_andamento";
  return "futura";
}

// --- Cronograma em dois níveis (spec 027: passos dentro da frente) ------------

/**
 * Estado de um passo (tarefa) no cronograma, derivado do `status` e do período
 * previsto (data_inicio → prazo, onde `prazo` faz as vezes de fim):
 * - `sem_periodo`: falta início ou prazo → não vira barra, listado à parte.
 * - `concluida`: status concluído (verde, independente da data).
 * - `atrasada`: hoje já passou do prazo e não está concluído (vermelho).
 * - `em_andamento`: hoje entre início e prazo (azul).
 * - `futura`: início ainda não chegou (cinza).
 */
export type EstadoTarefa = "sem_periodo" | "concluida" | "atrasada" | "em_andamento" | "futura";

export function estadoTarefaCronograma(
  tarefa: { status: string; data_inicio?: string | null; prazo?: string | null },
  hoje: Date = new Date()
): EstadoTarefa {
  if (tarefa.status === "concluida") return "concluida";
  const inicio = parseDate(tarefa.data_inicio);
  const fim = parseDate(tarefa.prazo);
  if (!inicio || !fim) return "sem_periodo";

  const hojeDia = startOfDay(hoje);
  if (hojeDia > fim) return "atrasada";
  if (hojeDia >= inicio) return "em_andamento";
  return "futura";
}

/**
 * Período que a barra-resumo de uma frente deve cobrir: a união do período
 * próprio da frente (data_inicio/data_fim, spec 020) com o span dos passos que
 * têm início e prazo (spec 027). Assim a frente aparece na timeline se tiver
 * datas próprias OU passos datados. `null` quando não há nenhuma data.
 */
export function spanFrente(
  frente: { data_inicio?: string | null; data_fim?: string | null },
  tarefas: ReadonlyArray<{ data_inicio?: string | null; prazo?: string | null }>
): { inicio: string; fim: string } | null {
  const inicios: string[] = [];
  const fins: string[] = [];
  if (frente.data_inicio) inicios.push(frente.data_inicio);
  if (frente.data_fim) fins.push(frente.data_fim);
  for (const t of tarefas) {
    if (t.data_inicio && t.prazo) {
      inicios.push(t.data_inicio);
      fins.push(t.prazo);
    }
  }
  if (inicios.length === 0 || fins.length === 0) return null;
  // Datas em "YYYY-MM-DD" ordenam corretamente como string.
  return {
    inicio: inicios.reduce((a, b) => (b < a ? b : a)),
    fim: fins.reduce((a, b) => (b > a ? b : a)),
  };
}

// --- Conta da obra (spec 016, ADR 0013: dois bolsos e uma lente) --------------

export type TipoLancamento = "aporte" | "despesa";
export type PagoPor = "cliente" | "escritorio_reembolsavel";

export const TIPO_LANCAMENTO_OPCOES: ReadonlyArray<{ value: TipoLancamento; label: string }> = [
  { value: "aporte", label: "Aporte do cliente" },
  { value: "despesa", label: "Despesa" },
];

export const PAGO_POR_OPCOES: ReadonlyArray<{ value: PagoPor; label: string }> = [
  { value: "cliente", label: "Dinheiro do cliente" },
  { value: "escritorio_reembolsavel", label: "Escritório adiantou (reembolsável)" },
];

const PAGO_POR_LABEL: Record<string, string> = Object.fromEntries(PAGO_POR_OPCOES.map((o) => [o.value, o.label]));
export const pagoPorLabel = (v: string | null | undefined): string => (v ? (PAGO_POR_LABEL[v] ?? v) : "");

/** Chave usada no agregado por etapa para despesas sem frente vinculada. */
export const SEM_ETAPA = "sem_etapa";

type LancamentoCalc = {
  tipo: string;
  valor: number | string;
  obra_frente_id?: string | null;
  pago_por?: string | null;
};

const num = (v: number | string): number => (typeof v === "number" ? v : Number(v)) || 0;

/**
 * Saldo da conta da obra = aportes − despesas. Pode ser negativo: despesa sem
 * aporte é permitida (spec 016), o negativo significa que o cliente deve / o
 * escritório adiantou.
 */
export function calcularSaldoConta(lancamentos: ReadonlyArray<LancamentoCalc>): number {
  return lancamentos.reduce((acc, l) => (l.tipo === "aporte" ? acc + num(l.valor) : acc - num(l.valor)), 0);
}

/**
 * Total de despesas por grande etapa (frente). Chave = obra_frente_id; despesa
 * sem frente cai em SEM_ETAPA. Aportes são ignorados (não têm etapa).
 */
export function realizadoPorEtapa(lancamentos: ReadonlyArray<LancamentoCalc>): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const l of lancamentos) {
    if (l.tipo !== "despesa") continue;
    const key = l.obra_frente_id ?? SEM_ETAPA;
    acc[key] = (acc[key] ?? 0) + num(l.valor);
  }
  return acc;
}

/**
 * Desvio de orçamento por etapa: realizado − previsto. `pct` é sobre o previsto,
 * com uma casa decimal (previsto 0 → pct null, sem base para comparar).
 */
export function desvioOrcamento(previsto: number, realizado: number): { valor: number; pct: number | null } {
  const valor = realizado - previsto;
  const pct = previsto > 0 ? Math.round((valor / previsto) * 1000) / 10 : null;
  return { valor, pct };
}

/**
 * Quanto o escritório adiantou do próprio caixa e tem a reembolsar (despesas
 * `pago_por = escritorio_reembolsavel`). Fase 1: indicador na conta da obra, não
 * vira receita (ADR 0013 — não inflar a margem do escritório).
 */
export function totalAdiantadoEscritorio(lancamentos: ReadonlyArray<LancamentoCalc>): number {
  return lancamentos
    .filter((l) => l.tipo === "despesa" && l.pago_por === "escritorio_reembolsavel")
    .reduce((acc, l) => acc + num(l.valor), 0);
}

// --- Cotações (spec 018) ------------------------------------------------------

export type CotacaoStatus = "aberta" | "decidida" | "cancelada";

export const STATUS_COTACAO_OPCOES: ReadonlyArray<{ value: CotacaoStatus; label: string }> = [
  { value: "aberta", label: "Aberta" },
  { value: "decidida", label: "Decidida" },
  { value: "cancelada", label: "Cancelada" },
];

/** Menor valor entre as propostas de uma cotação. Sem propostas → null. */
export function menorValorProposta(propostas: ReadonlyArray<{ valor: number | string }>): number | null {
  if (propostas.length === 0) return null;
  return Math.min(...propostas.map((p) => num(p.valor)));
}

/** Nome exibível de uma proposta: fornecedor cadastrado ou o nome digitado. */
export function nomeFornecedorProposta(p: {
  fornecedor?: { nome: string } | null;
  fornecedor_nome?: string | null;
}): string {
  return p.fornecedor?.nome ?? p.fornecedor_nome ?? "Fornecedor sem nome";
}

// --- Estoque da obra (spec 019) -----------------------------------------------

export type TipoMovimento = "entrada" | "baixa";

export const TIPO_MOVIMENTO_OPCOES: ReadonlyArray<{ value: TipoMovimento; label: string }> = [
  { value: "entrada", label: "Entrada (compra recebida)" },
  { value: "baixa", label: "Baixa (aplicado na obra)" },
];

type MovimentoCalc = {
  tipo: string;
  quantidade: number | string;
  valor_unitario?: number | string | null;
};

/**
 * Custo médio ponderado das entradas de um material = Σ(qtd × valor_unitário) / Σ(qtd),
 * considerando só entradas com valor informado. Sem entrada valorada → null (não dá
 * para valorizar o saldo). Simples de propósito: sem PEPS/UEPS (spec 019, guardrail ERP).
 */
export function custoMedioEntradas(movs: ReadonlyArray<MovimentoCalc>): number | null {
  let qtdTotal = 0;
  let valorTotal = 0;
  for (const m of movs) {
    if (m.tipo !== "entrada" || m.valor_unitario == null) continue;
    const q = num(m.quantidade);
    qtdTotal += q;
    valorTotal += q * num(m.valor_unitario);
  }
  return qtdTotal > 0 ? valorTotal / qtdTotal : null;
}

/**
 * Saldo de um material a partir dos seus movimentos: comprado (Σ entradas),
 * aplicado (Σ baixas), saldo (comprado − aplicado, em quantidade) e valorParado
 * (saldo × custo médio das entradas; null se não há entrada valorada). O saldo
 * pode ser negativo — baixa maior que a entrada é permitida e sinalizada, não
 * bloqueada (spec 019).
 */
export function saldoMaterial(movs: ReadonlyArray<MovimentoCalc>): {
  comprado: number;
  aplicado: number;
  saldo: number;
  valorParado: number | null;
} {
  let comprado = 0;
  let aplicado = 0;
  for (const m of movs) {
    if (m.tipo === "entrada") comprado += num(m.quantidade);
    else if (m.tipo === "baixa") aplicado += num(m.quantidade);
  }
  const saldo = comprado - aplicado;
  const custoMedio = custoMedioEntradas(movs);
  return { comprado, aplicado, saldo, valorParado: custoMedio == null ? null : saldo * custoMedio };
}
