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
