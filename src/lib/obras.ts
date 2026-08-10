/**
 * Domínio de Obras (spec 015, ADR 0011). Constantes e cálculos puros — sem
 * dependência de rede, para serem testáveis e reusados por hooks e telas.
 */

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
