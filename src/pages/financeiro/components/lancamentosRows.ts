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

const ordemDaParcela = (a: Lancamento, b: Lancamento) => (a.parcela_numero ?? 0) - (b.parcela_numero ?? 0);

/**
 * Monta as linhas da tabela agrupando as parcelas de um mesmo plano (spec 033). A linha-grupo
 * resume só as parcelas do período; ao EXPANDIR, os filhos são o plano inteiro: as parcelas
 * que caem em outros meses entram junto (`parcelasDoPlano`), senão a pessoa vê só a parcela do
 * mês e não consegue editar as outras (BEZ-442). Parcela do período prevalece sobre a cópia do plano.
 */
export function montarLinhasAgrupadas(
  items: Lancamento[],
  expandedGroups: Set<string>,
  parcelasDoPlano: Map<string, Lancamento[]> = new Map()
): FlatRow[] {
  const ehParcela = (l: Lancamento) => !!l.grupo_parcela && !!l.parcela_total && l.parcela_total > 1;

  const grupos = new Map<string, Lancamento[]>();
  for (const l of items) {
    if (!ehParcela(l)) continue;
    const arr = grupos.get(l.grupo_parcela!) ?? [];
    arr.push(l);
    grupos.set(l.grupo_parcela!, arr);
  }

  const filhosDe = (gid: string, doPeriodo: Lancamento[]) => {
    const ids = new Set(doPeriodo.map(rowKey));
    const fora = (parcelasDoPlano.get(gid) ?? []).filter((p) => !ids.has(rowKey(p)));
    return [...doPeriodo, ...fora].sort(ordemDaParcela);
  };

  const emitidos = new Set<string>();
  const resultado: FlatRow[] = [];
  const emitirGrupo = (gid: string) => {
    emitidos.add(gid);
    const doPeriodo = [...grupos.get(gid)!].sort(ordemDaParcela);
    resultado.push({ kind: "group", groupId: gid, items: doPeriodo });
    if (expandedGroups.has(gid)) {
      for (const item of filhosDe(gid, doPeriodo)) resultado.push({ kind: "item", data: item, isChild: true });
    }
  };

  // O grupo aparece na posição da sua primeira parcela do período.
  const ancora = new Map<string, string>();
  for (const [gid, doPeriodo] of grupos) {
    const primeira = doPeriodo.reduce((best, cur) =>
      (cur.parcela_numero ?? Infinity) < (best.parcela_numero ?? Infinity) ? cur : best
    );
    ancora.set(gid, rowKey(primeira));
  }

  for (const l of items) {
    if (!ehParcela(l)) {
      resultado.push({ kind: "item", data: l, isChild: false });
    } else if (!emitidos.has(l.grupo_parcela!) && ancora.get(l.grupo_parcela!) === rowKey(l)) {
      emitirGrupo(l.grupo_parcela!);
    }
  }
  for (const gid of grupos.keys()) if (!emitidos.has(gid)) emitirGrupo(gid);
  return resultado;
}
