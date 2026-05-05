import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowDownCircle,
  ArrowLeftRight,
  ArrowUpCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  Layers,
  MoreHorizontal,
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
import { TransferenciaFormDialog } from "./TransferenciaFormDialog";
import { LancamentosFilterBar } from "./LancamentosFilterBar";
import { useLancamentosFiltersData } from "../hooks/useLancamentosFiltersData";
import { defaultFilters, type LancamentosFilters } from "./lancamentosFilters";

interface Props {
  data: Lancamento[];
  loading: boolean;
  onRefetch: () => void;
  filters: LancamentosFilters;
  onFiltersChange: (next: LancamentosFilters) => void;
  // Paginação cursor-based (opcional). Quando passados, exibe "Carregar mais".
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
}

type SortKey = "data" | "descricao" | "valor" | "categoria" | "projeto" | "contraparte" | "status";
interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

type Density = "comfortable" | "compact";

const ROW_HEIGHT: Record<Density, number> = { comfortable: 56, compact: 40 };

type FlatRow =
  | { kind: "item"; data: Lancamento; isChild: boolean }
  | { kind: "group"; groupId: string; items: Lancamento[] };

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const isPaidStatus = (l: Lancamento) =>
  (l.tipo === "receita" && (l.status === "Recebido" || l.status === "Recebida")) ||
  (l.tipo === "despesa" && l.status === "Pago") ||
  (l.tipo === "transferencia" && l.status === "Concluída");

const isOverdue = (l: Lancamento): boolean => {
  if (isPaidStatus(l)) return false;
  if (!l.data_vencimento) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const venc = new Date(l.data_vencimento + "T00:00:00");
  return venc < today;
};

const stripParcelaSuffix = (desc: string) => desc.replace(/\s*\(\d+\/\d+\)$/, "").trim();

export function LancamentosTable({
  data,
  loading,
  onRefetch,
  filters,
  onFiltersChange,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: Props) {
  const { canEdit } = useFeatureAccess("financeiro");
  const aux = useLancamentosFiltersData();

  const [sort, setSort] = useState<SortState>({ key: "data", dir: "desc" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [density, setDensity] = useState<Density>(
    () => (localStorage.getItem("lancamentos.density") as Density) ?? "comfortable"
  );
  const [grouped, setGrouped] = useState<boolean>(() => localStorage.getItem("lancamentos.grouped") !== "false");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const [deleteTarget, setDeleteTarget] = useState<Lancamento | null>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<Lancamento[] | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [detailTarget, setDetailTarget] = useState<Lancamento | null>(null);
  const [editTarget, setEditTarget] = useState<Lancamento | null>(null);
  const [editTransferencia, setEditTransferencia] = useState<Lancamento | null>(null);

  useEffect(() => {
    localStorage.setItem("lancamentos.density", density);
  }, [density]);

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

  const toggleGroupSelection = (items: Lancamento[]) => {
    const allSel = items.every((i) => selected.has(rowKey(i)));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const i of items) {
        if (allSel) next.delete(rowKey(i));
        else next.add(rowKey(i));
      }
      return next;
    });
  };

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
      else if (l.tipo === "despesa") despesas += l.valor;
    }
    return { receitas, despesas, saldo: receitas - despesas };
  }, [sorted]);

  const flatRows = useMemo((): FlatRow[] => {
    if (!grouped) return sorted.map((l) => ({ kind: "item" as const, data: l, isChild: false }));

    // Collect all items per group (preserving sort order inside each group)
    const groups = new Map<string, Lancamento[]>();
    for (const l of sorted) {
      if (l.grupo_parcela && l.parcela_total && l.parcela_total > 1) {
        const arr = groups.get(l.grupo_parcela) ?? [];
        arr.push(l);
        groups.set(l.grupo_parcela, arr);
      }
    }

    // Determine the "anchor" of each group: item with lowest parcela_numero.
    // The group header is emitted at the anchor's position in sorted, so the
    // group appears where parcela 1 would be — regardless of sort direction.
    const groupAnchors = new Map<string, string>();
    for (const [gid, items] of groups) {
      const anchor = items.reduce((best, cur) =>
        (cur.parcela_numero ?? Infinity) < (best.parcela_numero ?? Infinity) ? cur : best
      );
      groupAnchors.set(gid, rowKey(anchor));
    }

    const result: FlatRow[] = [];
    const emitted = new Set<string>();
    for (const l of sorted) {
      if (l.grupo_parcela && l.parcela_total && l.parcela_total > 1) {
        const gid = l.grupo_parcela;
        if (!emitted.has(gid) && groupAnchors.get(gid) === rowKey(l)) {
          emitted.add(gid);
          const items = groups.get(gid)!;
          // Children always shown in parcela_numero order for readability
          const orderedItems = [...items].sort((a, b) => (a.parcela_numero ?? 0) - (b.parcela_numero ?? 0));
          result.push({ kind: "group", groupId: gid, items: orderedItems });
          if (expandedGroups.has(gid)) {
            for (const item of orderedItems) {
              result.push({ kind: "item", data: item, isChild: true });
            }
          }
        }
        // Non-anchor group members are skipped (represented by the group header)
      } else {
        result.push({ kind: "item", data: l, isChild: false });
      }
    }

    // Safety: emit groups whose anchor wasn't in sorted (shouldn't happen)
    for (const [gid, items] of groups) {
      if (!emitted.has(gid)) {
        const orderedItems = [...items].sort((a, b) => (a.parcela_numero ?? 0) - (b.parcela_numero ?? 0));
        result.push({ kind: "group", groupId: gid, items: orderedItems });
        if (expandedGroups.has(gid)) {
          for (const item of orderedItems) {
            result.push({ kind: "item", data: item, isChild: true });
          }
        }
      }
    }

    return result;
  }, [sorted, grouped, expandedGroups]);

  const allGroupIds = useMemo(
    () => flatRows.filter((r): r is Extract<FlatRow, { kind: "group" }> => r.kind === "group").map((r) => r.groupId),
    [flatRows]
  );
  const allExpanded = allGroupIds.length > 0 && allGroupIds.every((id) => expandedGroups.has(id));

  const toggleExpandAll = () => {
    setExpandedGroups(allExpanded ? new Set() : new Set(allGroupIds));
  };

  const footerLabel = useMemo(() => {
    if (!grouped) return `${sorted.length} de ${data.length} lançamento${data.length !== 1 ? "s" : ""}`;
    const groupCount = flatRows.filter((r) => r.kind === "group").length;
    const singleCount = flatRows.filter((r) => r.kind === "item" && !r.isChild).length;
    const parts: string[] = [];
    if (groupCount > 0) parts.push(`${groupCount} grupo${groupCount !== 1 ? "s" : ""}`);
    if (singleCount > 0) parts.push(`${singleCount} avulso${singleCount !== 1 ? "s" : ""}`);
    parts.push(`${sorted.length} lançamento${sorted.length !== 1 ? "s" : ""}`);
    return parts.join(" · ");
  }, [grouped, sorted, flatRows, data.length]);

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
      onRefetch();
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

  const markItemsPaid = async (items: Lancamento[]) => {
    const today = new Date().toISOString().slice(0, 10);
    const recIds = items.filter((l) => l.tipo === "receita" && !isPaidStatus(l)).map((l) => l.id);
    const despIds = items.filter((l) => l.tipo === "despesa" && !isPaidStatus(l)).map((l) => l.id);
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
      toast.info("Nada a marcar — já efetivados");
      return;
    }
    const results = await Promise.all(ops);
    if (results.find((r) => (r as { error?: unknown }).error)) {
      toast.error("Falha em alguns registros");
      return;
    }
    toast.success(`${recIds.length + despIds.length} marcado(s) como pago/recebido`);
    onRefetch();
  };

  const bulkMarkPaid = async () => {
    if (selectedRows.length === 0) return;
    await markItemsPaid(selectedRows);
    setSelected(new Set());
  };

  const deleteItems = async (items: Lancamento[]) => {
    const recIds = items.filter((l) => l.tipo === "receita").map((l) => l.id);
    const despIds = items.filter((l) => l.tipo === "despesa").map((l) => l.id);
    const transfIds = items.filter((l) => l.tipo === "transferencia").map((l) => l.id);
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
    if (transfIds.length)
      ops.push(
        supabase
          .from("transferencias")
          .update({ deleted_at: stamp } as never)
          .in("id", transfIds) as unknown as PromiseLike<{ error: unknown }>
      );
    const results = await Promise.all(ops);
    if (results.find((r) => (r as { error?: unknown }).error)) {
      toast.error("Falha em alguns registros");
      return;
    }
    toast.success(`${items.length} excluído(s)`);
    onRefetch();
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
      onRefetch();
      return;
    }
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
    count: flatRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const paddingTop = virtualItems.length ? virtualItems[0].start : 0;
  const paddingBottom = virtualItems.length ? totalSize - virtualItems[virtualItems.length - 1].end : 0;

  // Resetar scroll ao mudar filtros/sort/grouped
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [filters, sort, grouped]);

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
          onClick={() => {
            setGrouped((v) => !v);
            setExpandedGroups(new Set());
          }}
          className={cn("h-8 px-2 text-xs gap-1", grouped ? "text-brand" : "text-muted-foreground")}
          title={grouped ? "Desagrupar parcelas" : "Agrupar parcelas"}
        >
          <Layers className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{grouped ? "Agrupado" : "Agrupar"}</span>
        </Button>
        {grouped && allGroupIds.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleExpandAll}
            className="h-8 px-2 text-xs gap-1 text-muted-foreground"
            title={allExpanded ? "Recolher todos os grupos" : "Expandir todos os grupos"}
          >
            {allExpanded ? <ChevronsUp className="h-3.5 w-3.5" /> : <ChevronsDown className="h-3.5 w-3.5" />}
          </Button>
        )}
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
                  <td colSpan={colCount}>
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                      <ArrowUpCircle className="h-8 w-8 text-muted-foreground/30" />
                      <p className="text-sm font-medium text-muted-foreground">Nenhum lançamento encontrado</p>
                      <p className="text-xs text-muted-foreground/70">
                        {data.length > 0
                          ? "Ajuste os filtros para ver mais resultados"
                          : "Crie uma receita ou despesa para começar"}
                      </p>
                      {data.length > 0 && (
                        <button
                          onClick={() => onFiltersChange(defaultFilters)}
                          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                        >
                          Limpar filtros
                        </button>
                      )}
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
                      const { groupId, items } = row;
                      const first = items[0];
                      const isReceita = first.tipo === "receita";
                      const total = items.reduce((s, i) => s + i.valor, 0);
                      const paidCount = items.filter(isPaidStatus).length;
                      const isExpanded = expandedGroups.has(groupId);
                      const groupDesc = stripParcelaSuffix(first.descricao);
                      const groupAllSelected = items.every((i) => selected.has(rowKey(i)));
                      const groupSomeSelected = items.some((i) => selected.has(rowKey(i)));
                      const originalTotal = first.parcela_total ?? items.length;
                      const isPartiallyFiltered = items.length < originalTotal;

                      // date range
                      const dates = items
                        .map((i) => i.data_vencimento)
                        .filter(Boolean)
                        .sort() as string[];
                      const firstDate = dates[0] ?? "";
                      const lastDate = dates[dates.length - 1] ?? "";
                      const dateLabel =
                        firstDate === lastDate
                          ? formatDateDisplay(firstDate)
                          : `${formatDateDisplay(firstDate)} → ${formatDateDisplay(lastDate)}`;

                      const groupStatusLabel =
                        paidCount === items.length
                          ? isReceita
                            ? "Recebido"
                            : "Pago"
                          : paidCount > 0
                            ? "Parcial"
                            : "Pendente";

                      return (
                        <tr
                          key={`group-${groupId}`}
                          data-index={vi.index}
                          ref={virtualizer.measureElement}
                          className="border-b border-black/5 hover:bg-gray-50 cursor-pointer transition-colors bg-gray-50/50"
                          onClick={() => toggleGroup(groupId)}
                        >
                          {canEdit && (
                            <td className={cellPad} onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={groupAllSelected ? true : groupSomeSelected ? "indeterminate" : false}
                                onCheckedChange={() => toggleGroupSelection(items)}
                                aria-label="Selecionar grupo"
                              />
                            </td>
                          )}
                          <td className={cellPad}>
                            <span
                              className={cn(
                                "inline-flex items-center justify-center h-7 w-7 rounded-full",
                                isReceita ? "bg-positive/10 text-positive" : "bg-red-50 text-red-600"
                              )}
                            >
                              {isReceita ? (
                                <ArrowUpCircle className="h-4 w-4" />
                              ) : (
                                <ArrowDownCircle className="h-4 w-4" />
                              )}
                            </span>
                          </td>
                          <td className={cn(cellPad, cellTextSize, "text-muted-foreground whitespace-nowrap")}>
                            {dateLabel}
                          </td>
                          <td className={cn(cellPad, "font-semibold", cellTextSize)}>
                            <span className="inline-flex items-center gap-1.5">
                              {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              )}
                              {groupDesc}
                            </span>
                          </td>
                          <td className={cn(cellPad, cellTextSize)}>{first.contraparte_nome || "-"}</td>
                          <td className={cn(cellPad, cellTextSize)}>{first.categoria_nome || "-"}</td>
                          <td className={cn(cellPad, cellTextSize)}>{first.projeto_codigo || "-"}</td>
                          <td className={cn(cellPad, "text-xs text-muted-foreground")}>
                            {isPartiallyFiltered ? (
                              <span className="inline-flex items-center gap-1">
                                <span className="text-amber-600 font-medium">{items.length}</span>
                                <span>de {originalTotal}x</span>
                              </span>
                            ) : (
                              `${items.length}x`
                            )}
                          </td>
                          <td
                            className={cn(
                              cellPad,
                              "text-right font-semibold tabular-nums",
                              cellTextSize,
                              isReceita ? "text-positive" : "text-red-600"
                            )}
                          >
                            {isReceita ? "+" : "−"} {formatBRL(total)}
                          </td>
                          <td className={cellPad}>
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-xs",
                                paidCount === items.length && isReceita && "bg-positive text-white",
                                paidCount === items.length && !isReceita && "bg-red-600 text-white",
                                paidCount > 0 && paidCount < items.length && "bg-amber-100 text-amber-800"
                              )}
                            >
                              {groupStatusLabel}
                            </Badge>
                          </td>
                          <td className={cellPad} onClick={(e) => e.stopPropagation()}>
                            {canEdit && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground"
                                    aria-label="Mais opções"
                                  >
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="text-xs">
                                  <DropdownMenuItem className="text-xs gap-2" onSelect={() => markItemsPaid(items)}>
                                    <Check className="h-3.5 w-3.5 text-positive" />
                                    Marcar todas como pagas
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-xs gap-2 text-red-600 focus:text-red-600"
                                    onSelect={() => setDeleteGroupTarget(items)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Excluir grupo inteiro
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </td>
                        </tr>
                      );
                    }

                    const l = row.data;
                    const isReceita = l.tipo === "receita";
                    const isTransf = l.tipo === "transferencia";
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
                          isSel && "bg-brand/5",
                          isTransf && "bg-blue-50/30",
                          row.isChild && "bg-white"
                        )}
                        onClick={() => (isTransf ? setEditTransferencia(l) : setDetailTarget(l))}
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
                        <td className={cn(cellPad, row.isChild && "pl-8")}>
                          <span
                            className={cn(
                              "inline-flex items-center justify-center h-7 w-7 rounded-full",
                              isTransf
                                ? "bg-blue-100 text-blue-600"
                                : isReceita
                                  ? "bg-positive/10 text-positive"
                                  : "bg-red-50 text-red-600"
                            )}
                            title={isTransf ? "Transferência" : isReceita ? "Receita" : "Despesa"}
                          >
                            {isTransf ? (
                              <ArrowLeftRight className="h-4 w-4" />
                            ) : isReceita ? (
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
                        <td className={cn(cellPad, "font-medium", cellTextSize)}>
                          {l.descricao}
                          {isTransf && l.conta_nome && (
                            <span className="ml-1 text-[10px] text-muted-foreground font-normal">({l.conta_nome})</span>
                          )}
                        </td>
                        <td className={cn(cellPad, cellTextSize)}>
                          {isTransf ? (l.contraparte_nome ?? "-") : l.contraparte_nome || "-"}
                        </td>
                        <td className={cn(cellPad, cellTextSize)}>{isTransf ? "-" : l.categoria_nome || "-"}</td>
                        <td className={cn(cellPad, cellTextSize)}>{isTransf ? "-" : l.projeto_codigo || "-"}</td>
                        <td className={cn(cellPad, "text-xs text-muted-foreground")}>
                          {isTransf
                            ? "-"
                            : l.parcela_numero && l.parcela_total
                              ? `${l.parcela_numero}/${l.parcela_total}`
                              : "1/1"}
                        </td>
                        <td
                          className={cn(
                            cellPad,
                            "text-right font-semibold tabular-nums",
                            cellTextSize,
                            isTransf ? "text-blue-600" : isReceita ? "text-positive" : "text-red-600"
                          )}
                        >
                          {isTransf ? "⇄" : isReceita ? "+" : "−"} {formatBRL(l.valor)}
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
                                className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                                onClick={() => (isTransf ? setEditTransferencia(l) : setEditTarget(l))}
                                aria-label="Editar lançamento"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:bg-red-50"
                                onClick={() => setDeleteTarget(l)}
                                aria-label="Excluir lançamento"
                              >
                                <Trash2 className="h-4 w-4" />
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
            <span className="text-muted-foreground">{footerLabel}</span>
            <div className="flex flex-wrap items-center gap-4 tabular-nums">
              <span className="text-positive">+ {formatBRL(totals.receitas)}</span>
              <span className="text-red-600">− {formatBRL(totals.despesas)}</span>
              <span className={cn("font-bold", totals.saldo >= 0 ? "text-positive" : "text-red-600")}>
                = {formatBRL(totals.saldo)}
              </span>
            </div>
          </div>
        )}

        {/* Botão "Carregar mais" para paginação cursor-based */}
        {hasNextPage && onLoadMore && (
          <div className="border-t border-black/10 bg-white px-4 py-3 flex justify-center">
            <Button variant="outline" size="sm" onClick={onLoadMore} disabled={isFetchingNextPage} className="text-xs">
              {isFetchingNextPage ? "Carregando…" : "Carregar mais"}
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

      <TransferenciaFormDialog
        open={editTransferencia !== null}
        onOpenChange={(v) => !v && setEditTransferencia(null)}
        transferencia={editTransferencia}
        onSaved={() => {
          setEditTransferencia(null);
          onRefetch();
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
  const isTransf = l.tipo === "transferencia";
  const paid = isPaidStatus(l);
  const overdue = isOverdue(l);

  const options: { value: string; label: string }[] = isTransf
    ? [
        { value: "Concluída", label: "Concluída" },
        { value: "Pendente", label: "Pendente" },
      ]
    : isReceita
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
        paid && !isReceita && !isTransf && "bg-red-600 text-white hover:bg-red-600/90",
        paid && isTransf && "bg-blue-600 text-white hover:bg-blue-600/90",
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
