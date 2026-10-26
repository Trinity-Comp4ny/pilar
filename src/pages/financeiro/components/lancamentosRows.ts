import type { Lancamento } from "../hooks/useLancamentosUnified";

export type FlatRow =
  { kind: "item"; data: Lancamento; isChild: boolean } | { kind: "group"; groupId: string; items: Lancamento[] };

export const isPaidStatus = (l: Lancamento) =>
  (l.tipo === "receita" && (l.status === "Recebido" || l.status === "Recebida")) ||
  (l.tipo === "despesa" && l.status === "Pago") ||
  (l.tipo === "transferencia" && l.status === "Concluída");

export const isOverdue = (l: Lancamento): boolean => {
  if (isPaidStatus(l)) return false;
  if (!l.data_vencimento) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const venc = new Date(l.data_vencimento + "T00:00:00");
  return venc < today;
};

export const stripParcelaSuffix = (desc: string) => desc.replace(/\s*\(\d+\/\d+\)$/, "").trim();

export function rowKey(l: Lancamento): string {
  return `${l.tipo}-${l.id}`;
}
