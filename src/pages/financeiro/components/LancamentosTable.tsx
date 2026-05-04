import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Check,
  Pencil,
  Rows3,
  Rows4,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatDateDisplay, getDisplayDate } from "@/lib/dateUtils";
import { parseCurrencyString } from "@/lib/currencyUtils";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import type { Lancamento } from "../hooks/useLancamentosUnified";
import { LancamentoDetailDialog } from "./LancamentoDetailDialog";
import { LancamentoFormDialog } from "./LancamentoFormDialog";
import { LancamentosFilterBar } from "./LancamentosFilterBar";
import { useLancamentosFiltersData } from "../hooks/useLancamentosFiltersData";
import { defaultFilters, type LancamentosFilters } from "./lancamentosFilters";

interface Props {
  data: Lancamento[];
  loading: boolean;
  onRefetch: () => void;
  filters: LancamentosFilters;
  onFiltersChange: (next: LancamentosFilters) => void;
}

type SortKey = "data" | "descricao" | "valor" | "categoria" | "projeto" | "contraparte" | "status";
interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

type Density = "comfortable" | "compact";

const ROW_HEIGHT: Record<Density, number> = { comfortable: 56, compact: 40 };

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const isPaidStatus = (l: Lancamento) =>
  (l.tipo === "receita" && (l.status === "Recebido" || l.status === "Recebida")) ||
  (l.tipo === "despesa" && l.status === "Pago");

const isOverdue = (l: Lancamento): boolean => {
  if (isPaidStatus(l)) return false;
  if (!l.data_vencimento) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const venc = new Date(l.data_vencimento + "T00:00:00");
  return venc < today;
};

export function LancamentosTable({ data, loading, onRefetch, filters, onFiltersChange }: Props) {
  const { canEdit } = useFeatureAccess("financeiro");
  const aux = useLancamentosFiltersData();

  const [sort, setSort] = useState<SortState>({ key: "data", dir: "desc" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [density, setDensity] = useState<Density>(
    () => (localStorage.getItem("lancamentos.density") as Density) ?? "comfortable"
  );

  const [deleteTarget, setDeleteTarget] = useState<Lancamento | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [detailTarget, setDetailTarget] = useState<Lancamento | null>(null);
  const [editTarget, setEditTarget] = useState<Lancamento | null>(null);

  useEffect(() => {
    localStorage.setItem("lancamentos.density", density);
  }, [density]);

  const filtered = useMemo(() => {
    const minVal = filters.valorMin ? parseCurrencyString(filters.valorMin) : null;
    const maxVal = filters.valorMax ? parseCurrencyString(filters.valorMax) : null;
    const catSet = new Set(filters.categorias);
    const projSet = new Set(filters.projetos);
    const cliSet = new Set(filters.clientes);
    const fornSet = new Set(filters.fornecedores);
    const formaSet = new Set(filters.formasPagamento);
    const q = filters.search.trim().toLowerCase();

    return data.filter((l) => {
      if (filters.tipo !== "todos" && l.tipo !== filters.tipo) return false;

      if (filters.status === "pagos" && !isPaidStatus(l)) return false;
      if (filters.status === "pendentes" && isPaidStatus(l)) return false;
      if (filters.status === "atrasados" && !isOverdue(l)) return false;

      if (catSet.size && (!l.categoria_id || !catSet.has(l.categoria_id))) return false;
      if (projSet.size && (!l.projeto_id || !projSet.has(l.projeto_id))) return false;

      if (cliSet.size) {
        if (l.tipo !== "receita" || !l.contraparte_id || !cliSet.has(l.contraparte_id)) return false;
      }
      if (fornSet.size) {
        if (l.tipo !== "despesa" || !l.contraparte_id || !fornSet.has(l.contraparte_id)) return false;
      }

      if (formaSet.size && (!l.forma_pagamento || !formaSet.has(l.forma_pagamento))) return false;

      if (minVal !== null && l.valor < minVal) return false;
      if (maxVal !== null && l.valor > maxVal) return false;

      if (q) {
        const hit =
          l.descricao.toLowerCase().includes(q) ||
          (l.contraparte_nome ?? "").toLowerCase().includes(q) ||
          (l.categoria_nome ?? "").toLowerCase().includes(q) ||
          (l.projeto_codigo ?? "").toLowerCase().includes(q);
        if (!hit) return false;
      }

      return true;
    });
  }, [data, filters]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sort.dir === "asc" ? 1 : -1;
    const get = (l: Lancamento): string | number => {
      switch (sort.key) {
        case "data":
          return l.data_efetivacao ?? l.data_vencimento ?? "";
        case "descricao":
          return l.descricao.toLowerCase();
        case "valor":
          return l.valor;
        case "categoria":
          return (l.categoria_nome ?? "").toLowerCase();
        case "projeto":
          return (l.projeto_codigo ?? "").toLowerCase();
        case "contraparte":
          return (l.contraparte_nome ?? "").toLowerCase();
        case "status":
          return l.status.toLowerCase();
      }
    };
    arr.sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return arr;
  }, [filtered, sort]);

  useEffect(() => {
    setSelected(new Set());
  }, [filters]);

  const totals = useMemo(() => {
    let receitas = 0;
    let despesas = 0;
    for (const l of sorted) {
      if (l.tipo === "receita") receitas += l.valor;
      else despesas += l.valor;
    }
    return { receitas, despesas, saldo: receitas - despesas };
  }, [sorted]);

  const allSelected = sorted.length > 0 && sorted.every((l) => selected.has(rowKey(l)));
  const someSelected = sorted.some((l) => selected.has(rowKey(l)));

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(sorted.map((l) => rowKey(l))));
  };

  const toggleRow = (l: Lancamento) => {
    const k = rowKey(l);
    const next = new Set(selected);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setSelected(next);
  };

  const selectedRows = useMemo(() => sorted.filter((l) => selected.has(rowKey(l))), [sorted, selected]);

  const headerSort = (key: SortKey) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sort.key !== k) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const setStatus = async (l: Lancamento, novoStatus: string) => {
    const table = l.tipo === "receita" ? "receitas" : "despesas";
    const today = new Date().toISOString().slice(0, 10);
    const isPaying =
      (l.tipo === "receita" && (novoStatus === "Recebido" || novoStatus === "Recebida")) ||
      (l.tipo === "despesa" && novoStatus === "Pago");
    const dataField = l.tipo === "receita" ? "data_recebimento" : "data_pagamento";
    const normalized = l.tipo === "receita" && novoStatus === "Recebida" ? "Recebido" : novoStatus;
    const payload: Record<string, unknown> = { status: normalized };
    payload[dataField] = isPaying ? today : null;
    const { error } = await supabase
      .from(table)
      .update(payload as never)
      .eq("id", l.id);
    if (error) {
      toast.error("Falha ao atualizar status", { description: error.message });
      return;
    }
    toast.success("Status atualizado");
    onRefetch();
  };

  const bulkMarkPaid = async () => {
    if (selectedRows.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const recIds = selectedRows.filter((l) => l.tipo === "receita" && !isPaidStatus(l)).map((l) => l.id);
    const despIds = selectedRows.filter((l) => l.tipo === "despesa" && !isPaidStatus(l)).map((l) => l.id);
    const ops: PromiseLike<{ error: unknown }>[] = [];
    if (recIds.length)
      ops.push(
        supabase
          .from("receitas")
          .update({ status: "Recebido", data_recebimento: today } as never)
          .in("id", recIds) as unknown as PromiseLike<{ error: unknown }>
      );
    if (despIds.length)
      ops.push(
        supabase
          .from("despesas")
          .update({ status: "Pago", data_pagamento: today } as never)
          .in("id", despIds) as unknown as PromiseLike<{ error: unknown }>
      );
    if (!ops.length) {
      toast.info("Nada a marcar — selecionados já efetivados");
      return;
    }
    const results = await Promise.all(ops);
    const failed = results.find((r) => (r as { error?: unknown }).error);
    if (failed) {
      toast.error("Falha em alguns registros");
      return;
    }
    toast.success(`${recIds.length + despIds.length} marcado(s) como pago/recebido`);
    setSelected(new Set());
    onRefetch();
  };

  const bulkDelete = async () => {
    if (selectedRows.length === 0) return;
    const recIds = selectedRows.filter((l) => l.tipo === "receita").map((l) => l.id);
    const despIds = selectedRows.filter((l) => l.tipo === "despesa").map((l) => l.id);
    const stamp = new Date().toISOString();
    const ops: PromiseLike<{ error: unknown }>[] = [];
    if (recIds.length)
      ops.push(
        supabase
          .from("receitas")
          .update({ deleted_at: stamp } as never)
          .in("id", recIds) as unknown as PromiseLike<{ error: unknown }>
      );
    if (despIds.length)
      ops.push(
        supabase
          .from("despesas")
          .update({ deleted_at: stamp } as never)
          .in("id", despIds) as unknown as PromiseLike<{ error: unknown }>
      );
    const results = await Promise.all(ops);
    const failed = results.find((r) => (r as { error?: unknown }).error);
    if (failed) {
      toast.error("Falha em alguns registros");
      return;
    }
    toast.success(`${selectedRows.length} excluído(s)`);
    setSelected(new Set());
    setBulkConfirm(false);
    onRefetch();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { id, tipo } = deleteTarget;
    setDeleteTarget(null);
    const table = tipo === "receita" ? "receitas" : "despesas";
    const { error } = await supabase
      .from(table)
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (error) {
      toast.error("Falha ao excluir", { description: error.message });
      return;
    }
    toast.success("Lançamento excluído");
    onRefetch();
  };

  // Virtualização
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowHeight = ROW_HEIGHT[density];
  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const paddingTop = virtualItems.length ? virtualItems[0].start : 0;
  const paddingBottom = virtualItems.length ? totalSize - virtualItems[virtualItems.length - 1].end : 0;

  // Resetar scroll ao mudar filtros/sort
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [filters, sort]);

  const cellTextSize = density === "compact" ? "text-xs" : "text-sm";
  const cellPad = density === "compact" ? "py-1.5 px-3" : "py-3 px-3";

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
        total={data.length}
        visible={sorted.length}
      />

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand bg-brand/5 px-3 py-2 text-xs">
          <span className="font-medium">
            {selected.size} selecionado{selected.size > 1 ? "s" : ""}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={bulkMarkPaid}
                className="h-7 text-xs gap-1 bg-white border-positive text-positive hover:bg-positive/10"
              >
                <Check className="h-3 w-3" />
                Marcar pago/recebido
              </Button>
            )}
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkConfirm(true)}
                className="h-7 text-xs gap-1 bg-white border-red-300 text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3 w-3" />
                Excluir
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
              className="h-7 text-xs text-muted-foreground gap-1"
            >
              <X className="h-3 w-3" />
              Limpar seleção
            </Button>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDensity(density === "compact" ? "comfortable" : "compact")}
          className="h-8 px-2 text-xs gap-1 text-muted-foreground"
          title={density === "compact" ? "Densidade confortável" : "Densidade compacta"}
        >
          {density === "compact" ? <Rows3 className="h-3.5 w-3.5" /> : <Rows4 className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* Tabela virtualizada */}
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
                <SortableTH
                  label="Descrição"
                  k="descricao"
                  sort={sort}
                  onSort={headerSort}
                  icon={<SortIcon k="descricao" />}
                />
                <SortableTH
                  label="Cliente/Fornecedor"
                  k="contraparte"
                  sort={sort}
                  onSort={headerSort}
                  icon={<SortIcon k="contraparte" />}
                />
                <SortableTH
                  label="Categoria"
                  k="categoria"
                  sort={sort}
                  onSort={headerSort}
                  icon={<SortIcon k="categoria" />}
                />
                <SortableTH
                  label="Projeto"
                  k="projeto"
                  sort={sort}
                  onSort={headerSort}
                  icon={<SortIcon k="projeto" />}
                />
                <th className="px-3 py-2">Parcela</th>
                <SortableTH
                  label="Valor"
                  k="valor"
                  sort={sort}
                  onSort={headerSort}
                  icon={<SortIcon k="valor" />}
                  className="text-right"
                />
                <SortableTH label="Status" k="status" sort={sort} onSort={headerSort} icon={<SortIcon k="status" />} />
                <th className="w-[60px] px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {loading && sorted.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="text-center text-muted-foreground py-10">
                    Carregando…
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="text-center text-muted-foreground py-10">
                    Nenhum lançamento no filtro atual
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
                    const l = sorted[vi.index];
                    const isReceita = l.tipo === "receita";
                    const dataExibir = getDisplayDate(l.data_efetivacao, l.data_vencimento, l.status);
                    const overdue = isOverdue(l);
                    const k = rowKey(l);
                    const isSel = selected.has(k);
                    return (
                      <tr
                        key={k}
                        data-index={vi.index}
                        ref={virtualizer.measureElement}
                        className={cn(
                          "border-b border-black/5 hover:bg-gray-50 cursor-pointer transition-colors",
                          isSel && "bg-brand/5"
                        )}
                        onClick={() => setDetailTarget(l)}
                      >
                        {canEdit && (
                          <td className={cellPad} onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSel}
                              onCheckedChange={() => toggleRow(l)}
                              aria-label="Selecionar linha"
                            />
                          </td>
                        )}
                        <td className={cellPad}>
                          <span
                            className={cn(
                              "inline-flex items-center justify-center h-7 w-7 rounded-full",
                              isReceita ? "bg-positive/10 text-positive" : "bg-red-50 text-red-600"
                            )}
                            title={isReceita ? "Receita" : "Despesa"}
                          >
                            {isReceita ? (
                              <ArrowUpCircle className="h-4 w-4" />
                            ) : (
                              <ArrowDownCircle className="h-4 w-4" />
                            )}
                          </span>
                        </td>
                        <td className={cn(cellPad, cellTextSize, overdue && "text-red-600 font-medium")}>
                          {formatDateDisplay(dataExibir)}
                          {overdue && <span className="ml-1 text-[10px] uppercase">atrasado</span>}
                        </td>
                        <td className={cn(cellPad, "font-medium", cellTextSize)}>{l.descricao}</td>
                        <td className={cn(cellPad, cellTextSize)}>{l.contraparte_nome || "-"}</td>
                        <td className={cn(cellPad, cellTextSize)}>{l.categoria_nome || "-"}</td>
                        <td className={cn(cellPad, cellTextSize)}>{l.projeto_codigo || "-"}</td>
                        <td className={cn(cellPad, "text-xs text-muted-foreground")}>
                          {l.parcela_numero && l.parcela_total ? `${l.parcela_numero}/${l.parcela_total}` : "1/1"}
                        </td>
                        <td
                          className={cn(
                            cellPad,
                            "text-right font-semibold tabular-nums",
                            cellTextSize,
                            isReceita ? "text-positive" : "text-red-600"
                          )}
                        >
                          {isReceita ? "+" : "−"} {formatBRL(l.valor)}
                        </td>
                        <td className={cellPad} onClick={(e) => e.stopPropagation()}>
                          <StatusBadge l={l} canEdit={canEdit} onChange={(s) => setStatus(l, s)} />
                        </td>
                        <td className={cellPad} onClick={(e) => e.stopPropagation()}>
                          {canEdit && (
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-blue-600 hover:bg-blue-50"
                                onClick={() => setEditTarget(l)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-600 hover:bg-red-50"
                                onClick={() => setDeleteTarget(l)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
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

        {/* Footer com totais filtrados */}
        {sorted.length > 0 && (
          <div className="border-t border-black/10 bg-gray-50/60 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-muted-foreground">
              {sorted.length} de {data.length} lançamento{data.length !== 1 ? "s" : ""}
            </span>
            <div className="flex flex-wrap items-center gap-4 tabular-nums">
              <span className="text-positive">+ {formatBRL(totals.receitas)}</span>
              <span className="text-red-600">− {formatBRL(totals.despesas)}</span>
              <span className={cn("font-bold", totals.saldo >= 0 ? "text-positive" : "text-red-600")}>
                = {formatBRL(totals.saldo)}
              </span>
            </div>
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
        onGroupChanged={onRefetch}
      />

      {editTarget && (
        <LancamentoFormDialog
          open={editTarget !== null}
          onOpenChange={(v) => !v && setEditTarget(null)}
          tipo={editTarget.tipo}
          lancamento={editTarget}
          onSaved={() => {
            setEditTarget(null);
            onRefetch();
          }}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={`Excluir ${deleteTarget?.tipo === "receita" ? "receita" : "despesa"}?`}
        description={
          deleteTarget?.grupo_parcela
            ? "Esta é uma parcela de um grupo. Apenas esta parcela será excluída — use a aba específica para excluir o grupo inteiro."
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
    </div>
  );
}

function rowKey(l: Lancamento): string {
  return `${l.tipo}-${l.id}`;
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

function StatusBadge({ l, canEdit, onChange }: { l: Lancamento; canEdit: boolean; onChange: (s: string) => void }) {
  const isReceita = l.tipo === "receita";
  const paid = isPaidStatus(l);
  const overdue = isOverdue(l);
  const options: { value: string; label: string }[] = isReceita
    ? [
        { value: "Pendente", label: "Pendente" },
        { value: "Recebido", label: "Recebido" },
      ]
    : [
        { value: "Pendente", label: "Pendente" },
        { value: "Pago", label: "Pago" },
      ];

  const badge = (
    <Badge
      variant="secondary"
      className={cn(
        "text-xs cursor-pointer transition-colors",
        paid && isReceita && "bg-positive text-white hover:bg-positive/90",
        paid && !isReceita && "bg-red-600 text-white hover:bg-red-600/90",
        !paid && overdue && "bg-amber-100 text-amber-800 hover:bg-amber-200"
      )}
    >
      {overdue && !paid ? "Atrasado" : l.status}
    </Badge>
  );

  if (!canEdit) return badge;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{badge}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="text-xs">
        {options.map((o) => (
          <DropdownMenuItem key={o.value} onSelect={() => onChange(o.value)} className="text-xs">
            <Check className={cn("h-3 w-3 mr-1.5", l.status === o.value ? "opacity-100" : "opacity-0")} />
            {o.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="text-[10px] text-muted-foreground">
          Click rápido para alterar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
