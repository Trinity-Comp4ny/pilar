import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDownCircle, ArrowUp, ArrowUpDown, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { getDisplayDate } from "@/lib/dateUtils";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import type { Lancamento } from "../hooks/useLancamentosUnified";
import { useLancamentosPaginados } from "../hooks/useLancamentosPaginados";
import { useGruposParcelaResumo } from "../hooks/useGruposParcelaResumo";
import type { LancamentosResumo } from "../hooks/useLancamentosResumo";
import { invalidateLancamentos } from "../tabs/Lancamentos";
import { LancamentoDetailDialog } from "./LancamentoDetailDialog";
import { LancamentoFormDialog } from "./LancamentoFormDialog";
import { TransferenciaFormDialog } from "./TransferenciaFormDialog";
import { LancamentosFilterBar } from "./LancamentosFilterBar";
import { useLancamentosFiltersData } from "../hooks/useLancamentosFiltersData";
import { defaultFilters, type LancamentosFilters } from "./lancamentosFilters";
import { LancamentosBulkBar } from "./LancamentosBulkBar";
import { LancamentosGroupRow } from "./LancamentosGroupRow";
import { LancamentosItemRow } from "./LancamentosItemRow";

interface Props {
  resumo: LancamentosResumo;
  filters: LancamentosFilters;
  onFiltersChange: (next: LancamentosFilters) => void;
  onMutated: () => void;
}

type SortKey = "data" | "descricao" | "valor" | "categoria" | "projeto" | "contraparte" | "status";
interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

const ROW_HEIGHT = 56;

type FlatRow =
  | { kind: "item"; data: Lancamento; isChild: boolean }
  | { kind: "group"; groupId: string; items: Lancamento[] };

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

export function LancamentosTable({ resumo, filters, onFiltersChange, onMutated }: Props) {
  const { canEdit } = useFeatureAccess("financeiro");
  const aux = useLancamentosFiltersData();
  const queryClient = useQueryClient();

  const [sort, setSort] = useState<SortState>({ key: "data", dir: "desc" });

  // Filtro, ordenação e paginação rodam no banco (spec 033). A tabela só renderiza.
  const paginated = useLancamentosPaginados({ filters, sortKey: sort.key, sortDir: sort.dir });
  const items = paginated.data;
  const loading = paginated.isLoading;

  // "Nenhum lançamento ainda" só quando vê tudo e sem filtro; senão é recorte.
  const hasActiveFilters =
    filters.search.trim() !== "" ||
    filters.tipo !== "todos" ||
    filters.status !== "todos" ||
    filters.periodo !== "tudo" ||
    filters.categorias.length > 0 ||
    filters.projetos.length > 0 ||
    filters.clientes.length > 0 ||
    filters.fornecedores.length > 0 ||
    filters.formasPagamento.length > 0 ||
    filters.valorMin.trim() !== "" ||
    filters.valorMax.trim() !== "";

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [grouped, setGrouped] = useState<boolean>(() => localStorage.getItem("lancamentos.grouped") !== "false");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const [deleteTarget, setDeleteTarget] = useState<Lancamento | null>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<Lancamento[] | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkPaidConfirm, setBulkPaidConfirm] = useState(false);
  const [detailTarget, setDetailTarget] = useState<Lancamento | null>(null);
  const [editTarget, setEditTarget] = useState<Lancamento | null>(null);
  const [editTransferencia, setEditTransferencia] = useState<Lancamento | null>(null);

  const refetchAll = () => {
    invalidateLancamentos(queryClient);
    onMutated();
  };

  useEffect(() => {
    localStorage.setItem("lancamentos.grouped", String(grouped));
  }, [grouped]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const toggleGroupSelection = (groupItems: Lancamento[]) => {
    const allSel = groupItems.every((i) => selected.has(rowKey(i)));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const i of groupItems) {
        if (allSel) next.delete(rowKey(i));
        else next.add(rowKey(i));
      }
      return next;
    });
  };

  useEffect(() => {
    setSelected(new Set());
  }, [filters]);

  const flatRows = useMemo((): FlatRow[] => {
    if (!grouped) return items.map((l) => ({ kind: "item" as const, data: l, isChild: false }));

    const groups = new Map<string, Lancamento[]>();
    for (const l of items) {
      if (l.grupo_parcela && l.parcela_total && l.parcela_total > 1) {
        const arr = groups.get(l.grupo_parcela) ?? [];
        arr.push(l);
        groups.set(l.grupo_parcela, arr);
      }
    }

    const groupAnchors = new Map<string, string>();
    for (const [gid, groupItems] of groups) {
      const anchor = groupItems.reduce((best, cur) =>
        (cur.parcela_numero ?? Infinity) < (best.parcela_numero ?? Infinity) ? cur : best
      );
      groupAnchors.set(gid, rowKey(anchor));
    }

    const result: FlatRow[] = [];
    const emitted = new Set<string>();
    for (const l of items) {
      if (l.grupo_parcela && l.parcela_total && l.parcela_total > 1) {
        const gid = l.grupo_parcela;
        if (!emitted.has(gid) && groupAnchors.get(gid) === rowKey(l)) {
          emitted.add(gid);
          const groupItems = groups.get(gid)!;
          const orderedItems = [...groupItems].sort((a, b) => (a.parcela_numero ?? 0) - (b.parcela_numero ?? 0));
          result.push({ kind: "group", groupId: gid, items: orderedItems });
          if (expandedGroups.has(gid)) {
            for (const item of orderedItems) result.push({ kind: "item", data: item, isChild: true });
          }
        }
      } else {
        result.push({ kind: "item", data: l, isChild: false });
      }
    }

    for (const [gid, groupItems] of groups) {
      if (!emitted.has(gid)) {
        const orderedItems = [...groupItems].sort((a, b) => (a.parcela_numero ?? 0) - (b.parcela_numero ?? 0));
        result.push({ kind: "group", groupId: gid, items: orderedItems });
        if (expandedGroups.has(gid)) {
          for (const item of orderedItems) result.push({ kind: "item", data: item, isChild: true });
        }
      }
    }
    return result;
  }, [items, grouped, expandedGroups]);

  const allGroupIds = useMemo(
    () => flatRows.filter((r): r is Extract<FlatRow, { kind: "group" }> => r.kind === "group").map((r) => r.groupId),
    [flatRows]
  );
  const allExpanded = allGroupIds.length > 0 && allGroupIds.every((id) => expandedGroups.has(id));
  const gruposResumo = useGruposParcelaResumo(allGroupIds);

  const toggleExpandAll = () => setExpandedGroups(allExpanded ? new Set() : new Set(allGroupIds));

  const allSelected = items.length > 0 && items.every((l) => selected.has(rowKey(l)));
  const someSelected = items.some((l) => selected.has(rowKey(l)));

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(items.map((l) => rowKey(l))));
  };

  const toggleRow = (l: Lancamento) => {
    const k = rowKey(l);
    const next = new Set(selected);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setSelected(next);
  };

  const selectedRows = useMemo(() => items.filter((l) => selected.has(rowKey(l))), [items, selected]);

  const headerSort = (key: SortKey) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sort.key !== k) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const setStatus = async (l: Lancamento, novoStatus: string) => {
    if (l.tipo === "transferencia") {
      const { error } = await supabase.rpc("rpc_editar_transferencia", {
        p_id: l.id,
        p_conta_origem_id: l.conta_id,
        p_conta_destino_id: l.contraparte_id,
        p_valor: l.valor,
        p_data: l.data_vencimento,
        p_descricao: l.descricao || null,
        p_status: novoStatus,
        p_observacao: null,
      } as never);
      if (error) {
        toast.error("Falha ao atualizar status", { description: error.message });
        return;
      }
      toast.success("Status atualizado");
      refetchAll();
      return;
    }
    const table = l.tipo === "receita" ? "receitas" : "despesas";
    const today = new Date().toISOString().slice(0, 10);
    const isPaying =
      (l.tipo === "receita" && (novoStatus === "Recebido" || novoStatus === "Recebida")) ||
      (l.tipo === "despesa" && novoStatus === "Pago");
    const dataField = l.tipo === "receita" ? "data_recebimento" : "data_pagamento";
    const normalized = l.tipo === "receita" && novoStatus === "Recebida" ? "Recebido" : novoStatus;
    const payload: Record<string, unknown> = { status: normalized };
    payload[dataField] = isPaying ? today : null;
    const { error } = await supabase.from(table).update(payload as never).eq("id", l.id);
    if (error) {
      toast.error("Falha ao atualizar status", { description: error.message });
      return;
    }
    toast.success("Status atualizado");
    refetchAll();
  };

  const markItemsPaid = async (rows: Lancamento[]) => {
    const today = new Date().toISOString().slice(0, 10);
    const recIds = rows.filter((l) => l.tipo === "receita" && !isPaidStatus(l)).map((l) => l.id);
    const despIds = rows.filter((l) => l.tipo === "despesa" && !isPaidStatus(l)).map((l) => l.id);
    const ops: PromiseLike<{ error: unknown }>[] = [];
    if (recIds.length)
      ops.push(supabase.from("receitas").update({ status: "Recebido", data_recebimento: today } as never).in("id", recIds) as unknown as PromiseLike<{ error: unknown }>);
    if (despIds.length)
      ops.push(supabase.from("despesas").update({ status: "Pago", data_pagamento: today } as never).in("id", despIds) as unknown as PromiseLike<{ error: unknown }>);
    if (!ops.length) {
      toast.info("Nada a marcar — já efetivados");
      return;
    }
    const results = await Promise.all(ops);
    if (results.find((r) => (r as { error?: unknown }).error)) {
      toast.error("Falha em alguns registros");
      return;
    }
    toast.success(`${recIds.length + despIds.length} marcado(s) como pago/recebido`);
    refetchAll();
  };

  const bulkMarkPaid = async () => {
    if (selectedRows.length === 0) return;
    await markItemsPaid(selectedRows);
    setSelected(new Set());
    setBulkPaidConfirm(false);
  };

  const selectedUnpaidCount = useMemo(
    () => selectedRows.filter((l) => l.tipo !== "transferencia" && !isPaidStatus(l)).length,
    [selectedRows]
  );

  const deleteItems = async (rows: Lancamento[]) => {
    const recIds = rows.filter((l) => l.tipo === "receita").map((l) => l.id);
    const despIds = rows.filter((l) => l.tipo === "despesa").map((l) => l.id);
    const transfIds = rows.filter((l) => l.tipo === "transferencia").map((l) => l.id);
    const stamp = new Date().toISOString();
    const ops: PromiseLike<{ error: unknown }>[] = [];
    if (recIds.length)
      ops.push(supabase.from("receitas").delete().in("id", recIds) as unknown as PromiseLike<{ error: unknown }>);
    if (despIds.length)
      ops.push(supabase.from("despesas").delete().in("id", despIds) as unknown as PromiseLike<{ error: unknown }>);
    if (transfIds.length)
      ops.push(supabase.from("transferencias").update({ deleted_at: stamp } as never).in("id", transfIds) as unknown as PromiseLike<{ error: unknown }>);
    const results = await Promise.all(ops);
    if (results.find((r) => (r as { error?: unknown }).error)) {
      toast.error("Falha em alguns registros");
      return;
    }
    toast.success(`${rows.length} excluído(s)`);
    refetchAll();
  };

  const bulkDelete = async () => {
    if (selectedRows.length === 0) return;
    await deleteItems(selectedRows);
    setSelected(new Set());
    setBulkConfirm(false);
  };

  const confirmDeleteGroup = async () => {
    if (!deleteGroupTarget) return;
    setDeleteGroupTarget(null);
    await deleteItems(deleteGroupTarget);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { id, tipo } = deleteTarget;
    setDeleteTarget(null);
    if (tipo === "transferencia") {
      const { error } = await supabase.rpc("rpc_excluir_transferencia", { p_id: id } as never);
      if (error) {
        toast.error("Falha ao excluir", { description: error.message });
        return;
      }
      toast.success("Transferência excluída");
      refetchAll();
      return;
    }
    const table = tipo === "receita" ? "receitas" : "despesas";
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) {
      toast.error("Falha ao excluir", { description: error.message });
      return;
    }
    toast.success("Lançamento excluído");
    refetchAll();
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const paddingTop = virtualItems.length ? virtualItems[0].start : 0;
  const paddingBottom = virtualItems.length ? totalSize - virtualItems[virtualItems.length - 1].end : 0;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [filters, sort, grouped]);

  const cellTextSize = "text-sm";
  const cellPad = "py-3 px-3";
  const colCount = canEdit ? 11 : 10;

  return (
    <div className="space-y-3">
      <LancamentosFilterBar
        filters={filters}
        onChange={(patch) => onFiltersChange({ ...filters, ...patch })}
        onReset={() => onFiltersChange(defaultFilters)}
        categorias={aux.categorias.map((c) => ({ value: c.id, label: c.nome }))}
        projetos={aux.projetos.map((p) => ({ value: p.id, label: p.codigo }))}
        clientes={aux.clientes.map((c) => ({ value: c.id, label: c.nome }))}
        fornecedores={aux.fornecedores.map((f) => ({ value: f.id, label: f.nome }))}
        total={resumo.totalCount}
        visible={items.length}
        grouped={grouped}
        allGroupIds={allGroupIds}
        allExpanded={allExpanded}
        onToggleGrouped={() => {
          setGrouped((v) => !v);
          setExpandedGroups(new Set());
        }}
        onToggleExpandAll={toggleExpandAll}
      />

      <LancamentosBulkBar
        count={selected.size}
        canEdit={canEdit}
        onMarkPaid={() => setBulkPaidConfirm(true)}
        onDelete={() => setBulkConfirm(true)}
        onClear={() => setSelected(new Set())}
      />

      <div className="rounded-xl border border-black/10 bg-white overflow-hidden">
        <div ref={scrollRef} className="overflow-auto" style={{ maxHeight: "min(70vh, 720px)" }}>
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white z-10 shadow-[0_1px_0_rgba(0,0,0,0.06)]">
              <tr className="text-xs text-muted-foreground">
                {canEdit && (
                  <th className="w-[40px] px-3 py-2">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={toggleAll}
                      aria-label="Selecionar todos"
                    />
                  </th>
                )}
                <th className="w-[60px] px-3 py-2">Tipo</th>
                <SortableTH label="Data" k="data" sort={sort} onSort={headerSort} icon={<SortIcon k="data" />} />
                <SortableTH label="Descrição" k="descricao" sort={sort} onSort={headerSort} icon={<SortIcon k="descricao" />} />
                <SortableTH label="Cliente/Fornecedor" k="contraparte" sort={sort} onSort={headerSort} icon={<SortIcon k="contraparte" />} />
                <SortableTH label="Categoria" k="categoria" sort={sort} onSort={headerSort} icon={<SortIcon k="categoria" />} />
                <SortableTH label="Projeto" k="projeto" sort={sort} onSort={headerSort} icon={<SortIcon k="projeto" />} />
                <th className="px-3 py-2">Parcela</th>
                <SortableTH label="Valor" k="valor" sort={sort} onSort={headerSort} icon={<SortIcon k="valor" />} className="text-right" />
                <SortableTH label="Status" k="status" sort={sort} onSort={headerSort} icon={<SortIcon k="status" />} />
                <th className="w-[60px] px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="text-center text-muted-foreground py-10">
                    Carregando…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={colCount}>
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                      <ArrowDownCircle className="h-8 w-8 text-muted-foreground/30" />
                      <p className="text-sm font-medium text-muted-foreground">
                        {hasActiveFilters ? "Nenhum lançamento com esses filtros" : "Nenhum lançamento ainda"}
                      </p>
                      <p className="text-xs text-muted-foreground/70">
                        {hasActiveFilters
                          ? "Ajuste os filtros ou amplie o período"
                          : "Crie uma receita ou despesa para começar"}
                      </p>
                      {hasActiveFilters &&
                        (filters.periodo !== "tudo" ? (
                          <button
                            onClick={() =>
                              onFiltersChange({ ...filters, periodo: "tudo", customFrom: null, customTo: null })
                            }
                            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                          >
                            Ver todo o período
                          </button>
                        ) : (
                          <button
                            onClick={() => onFiltersChange(defaultFilters)}
                            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                          >
                            Limpar filtros
                          </button>
                        ))}
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {paddingTop > 0 && (
                    <tr aria-hidden>
                      <td colSpan={colCount} style={{ height: paddingTop, padding: 0 }} />
                    </tr>
                  )}
                  {virtualItems.map((vi) => {
                    const row = flatRows[vi.index];
                    if (row.kind === "group") {
                      return (
                        <LancamentosGroupRow
                          key={`group-${row.groupId}`}
                          groupId={row.groupId}
                          items={row.items}
                          resumo={gruposResumo.get(row.groupId)}
                          isExpanded={expandedGroups.has(row.groupId)}
                          canEdit={canEdit}
                          selected={selected}
                          cellPad={cellPad}
                          cellTextSize={cellTextSize}
                          measureRef={virtualizer.measureElement}
                          dataIndex={vi.index}
                          isPaidStatus={isPaidStatus}
                          rowKey={rowKey}
                          stripParcelaSuffix={stripParcelaSuffix}
                          onToggle={() => toggleGroup(row.groupId)}
                          onToggleSelection={toggleGroupSelection}
                          onMarkPaid={markItemsPaid}
                          onDeleteGroup={setDeleteGroupTarget}
                        />
                      );
                    }
                    return (
                      <LancamentosItemRow
                        key={rowKey(row.data)}
                        l={row.data}
                        isChild={row.isChild}
                        isSel={selected.has(rowKey(row.data))}
                        canEdit={canEdit}
                        cellPad={cellPad}
                        cellTextSize={cellTextSize}
                        measureRef={virtualizer.measureElement}
                        dataIndex={vi.index}
                        isPaidStatus={isPaidStatus}
                        isOverdue={isOverdue}
                        getDisplayDate={getDisplayDate}
                        rowKey={rowKey}
                        onToggleRow={toggleRow}
                        onRowClick={(l) => (l.tipo === "transferencia" ? setEditTransferencia(l) : setDetailTarget(l))}
                        onEdit={(l) => (l.tipo === "transferencia" ? setEditTransferencia(l) : setEditTarget(l))}
                        onDelete={setDeleteTarget}
                        onStatusChange={setStatus}
                      />
                    );
                  })}
                  {paddingBottom > 0 && (
                    <tr aria-hidden>
                      <td colSpan={colCount} style={{ height: paddingBottom, padding: 0 }} />
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        {paginated.hasNextPage && (
          <div className="border-t border-black/10 bg-white px-4 py-3 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => paginated.fetchNextPage()}
              disabled={paginated.isFetchingNextPage}
              className="text-xs"
            >
              {paginated.isFetchingNextPage ? "Carregando…" : "Carregar mais"}
            </Button>
          </div>
        )}
      </div>

      <LancamentoDetailDialog
        lancamento={detailTarget}
        open={detailTarget !== null}
        onOpenChange={(v) => !v && setDetailTarget(null)}
        onDelete={(l) => {
          setDetailTarget(null);
          setDeleteTarget(l);
        }}
        onEditInTab={(l) => {
          setDetailTarget(null);
          setEditTarget(l);
        }}
        onGroupChanged={refetchAll}
      />

      {editTarget && (
        <LancamentoFormDialog
          open
          onOpenChange={(v) => !v && setEditTarget(null)}
          tipo={editTarget.tipo}
          lancamento={editTarget}
          onSaved={() => {
            setEditTarget(null);
            refetchAll();
          }}
        />
      )}

      <TransferenciaFormDialog
        open={editTransferencia !== null}
        onOpenChange={(v) => !v && setEditTransferencia(null)}
        transferencia={editTransferencia}
        onSaved={() => {
          setEditTransferencia(null);
          refetchAll();
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={`Excluir ${deleteTarget?.tipo === "receita" ? "receita" : deleteTarget?.tipo === "transferencia" ? "transferência" : "despesa"}`}
        itemName={deleteTarget?.descricao || undefined}
        description={
          deleteTarget?.grupo_parcela
            ? "Esta é uma parcela de um grupo. Apenas esta parcela será excluída."
            : "Esta ação não pode ser desfeita."
        }
        confirmText="Excluir"
        variant="destructive"
      />

      <ConfirmDialog
        open={bulkConfirm}
        onOpenChange={setBulkConfirm}
        onConfirm={bulkDelete}
        title={`Excluir ${selectedRows.length} lançamento(s)?`}
        description="Esta ação não pode ser desfeita."
        confirmText="Excluir todos"
        variant="destructive"
      />

      <ConfirmDialog
        open={bulkPaidConfirm}
        onOpenChange={setBulkPaidConfirm}
        onConfirm={bulkMarkPaid}
        title={`Marcar ${selectedUnpaidCount} lançamento(s) como pago/recebido?`}
        description={
          selectedUnpaidCount > 0
            ? "Vão receber a data de hoje como efetivação e entrar no caixa. Você pode reverter o status depois."
            : "Nenhum dos selecionados está pendente — nada será alterado."
        }
        confirmText="Marcar pago/recebido"
        variant="default"
      />

      <ConfirmDialog
        open={deleteGroupTarget !== null}
        onOpenChange={(v) => !v && setDeleteGroupTarget(null)}
        onConfirm={confirmDeleteGroup}
        title={`Excluir grupo inteiro (${deleteGroupTarget?.length ?? 0} parcelas)?`}
        description="Todas as parcelas do grupo serão excluídas. Esta ação não pode ser desfeita."
        confirmText="Excluir grupo"
        variant="destructive"
      />
    </div>
  );
}

function SortableTH({
  label,
  k,
  sort,
  onSort,
  icon,
  className,
}: {
  label: string;
  k: SortKey;
  sort: SortState;
  onSort: (k: SortKey) => void;
  icon: React.ReactNode;
  className?: string;
}) {
  const active = sort.key === k;
  return (
    <th className={cn("px-3 py-2 cursor-pointer select-none font-medium text-xs", className)} onClick={() => onSort(k)}>
      <span
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground transition-colors",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        {icon}
      </span>
    </th>
  );
}
