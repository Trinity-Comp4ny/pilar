import { useMemo, useState } from "react";
import {
  AlarmClock,
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  CircleDashed,
  Layers,
  LayoutList,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { FiltroPeriodo } from "@/components/filters/FiltroPeriodo";
import { type MultiSelectOption } from "@/components/filters/MultiSelectFilter";
import { formatCurrencyInput } from "@/lib/currencyUtils";
import { FORMAS_PAGAMENTO } from "../hooks/useLancamentosFiltersData";
import {
  applyQuick,
  datesToFilterPatch,
  filtersToDates,
  matchQuick,
  QUICK_LABEL,
  type LancamentosFilters,
  type QuickFilter,
} from "./lancamentosFilters";

interface Props {
  filters: LancamentosFilters;
  onChange: (next: Partial<LancamentosFilters>) => void;
  onReset: () => void;
  categorias: MultiSelectOption[];
  projetos: MultiSelectOption[];
  clientes: MultiSelectOption[];
  fornecedores: MultiSelectOption[];
  total: number;
  visible: number;
  grouped: boolean;
  allGroupIds: string[];
  allExpanded: boolean;
  onToggleGrouped: () => void;
  onToggleExpandAll: () => void;
}

const QUICK_ICON: Record<QuickFilter, typeof CircleDashed> = {
  "em-aberto": CircleDashed,
  atrasados: AlarmClock,
  "vence-semana": CalendarClock,
  pagos: CheckCircle2,
};
const QUICK_ORDER: QuickFilter[] = ["em-aberto", "atrasados", "vence-semana", "pagos"];

export function LancamentosFilterBar({
  filters,
  onChange,
  onReset,
  categorias,
  projetos,
  clientes,
  fornecedores,
  total,
  visible,
  grouped,
  allGroupIds,
  allExpanded,
  onToggleGrouped,
  onToggleExpandAll,
}: Props) {
  const periodoDates = useMemo(() => filtersToDates(filters), [filters]);
  const activeQuick = useMemo(() => matchQuick(filters), [filters]);

  const formaOptions = useMemo<MultiSelectOption[]>(() => FORMAS_PAGAMENTO.map((f) => ({ value: f, label: f })), []);
  const labelMap = useMemo(() => {
    const m = new Map<string, string>();
    [...categorias, ...projetos, ...clientes, ...fornecedores, ...formaOptions].forEach((o) => m.set(o.value, o.label));
    return m;
  }, [categorias, projetos, clientes, fornecedores, formaOptions]);

  // Tudo que vive dentro do popover "Filtros" conta para o badge.
  const filtrosCount =
    (filters.status !== "todos" ? 1 : 0) +
    filters.projetos.length +
    filters.categorias.length +
    filters.clientes.length +
    filters.fornecedores.length +
    filters.formasPagamento.length +
    (filters.valorMin || filters.valorMax ? 1 : 0);

  const hasActive =
    !!filters.search || filters.tipo !== "todos" || filters.periodo !== "mes-atual" || filtrosCount > 0;

  const removeFromList = (key: keyof LancamentosFilters, value: string) => {
    const arr = filters[key] as string[];
    onChange({ [key]: arr.filter((v) => v !== value) } as Partial<LancamentosFilters>);
  };

  const onQuick = (q: QuickFilter) => {
    if (activeQuick === q) onChange({ status: "todos", periodo: "mes-atual", customFrom: null, customTo: null });
    else onChange(applyQuick(q));
  };

  return (
    <div className="space-y-2.5">
      {/* Linha única: busca + tipo + período + Filtros + contador */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar descrição, cliente, fornecedor ou projeto"
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            className="h-9 pl-9 pr-8 rounded-full text-sm"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => onChange({ search: "" })}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 hover:bg-muted"
              aria-label="Limpar busca"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>

        <div className="inline-flex rounded-full bg-muted p-1">
          <SegBtn active={filters.tipo === "todos"} onClick={() => onChange({ tipo: "todos" })}>
            <LayoutList className="h-3.5 w-3.5" />
            Todos
          </SegBtn>
          <SegBtn active={filters.tipo === "receita"} onClick={() => onChange({ tipo: "receita" })} tone="positive">
            <ArrowUpCircle className="h-3.5 w-3.5" />
            Receitas
          </SegBtn>
          <SegBtn active={filters.tipo === "despesa"} onClick={() => onChange({ tipo: "despesa" })} tone="negative">
            <ArrowDownCircle className="h-3.5 w-3.5" />
            Despesas
          </SegBtn>
        </div>

        <FiltroPeriodo
          from={periodoDates.from}
          to={periodoDates.to}
          onChange={(from, to) => onChange(datesToFilterPatch(from, to))}
          align="start"
          className={cn(filters.periodo !== "mes-atual" && "border-brand bg-brand text-ink")}
        />

        <FiltrosPopover
          filters={filters}
          onChange={onChange}
          activeQuick={activeQuick}
          onQuick={onQuick}
          projetos={projetos}
          categorias={categorias}
          clientes={clientes}
          fornecedores={fornecedores}
          formaOptions={formaOptions}
          count={filtrosCount}
        />

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleGrouped}
            className="h-8 px-2 text-xs gap-1 text-muted-foreground"
            title={grouped ? "Desagrupar parcelas" : "Agrupar parcelas"}
          >
            <Layers className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{grouped ? "Parcelas agrupadas" : "Agrupar parcelas"}</span>
          </Button>
          {grouped && allGroupIds.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleExpandAll}
              className="h-8 px-2 text-xs gap-1 text-muted-foreground"
              title={allExpanded ? "Recolher todos" : "Expandir todos"}
            >
              {allExpanded ? <ChevronsUp className="h-3.5 w-3.5" /> : <ChevronsDown className="h-3.5 w-3.5" />}
            </Button>
          )}
          <span className="text-xs text-muted-foreground tabular-nums pl-2 border-l border-black/10">
            {visible} de {total}
          </span>
          {hasActive && (
            <Button variant="ghost" onClick={onReset} className="h-8 gap-1 text-xs text-muted-foreground rounded-full">
              <X className="h-3 w-3" />
              Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Chips ativos */}
      {hasActive && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeQuick && <Chip label={QUICK_LABEL[activeQuick]} onRemove={() => onQuick(activeQuick)} />}
          {filters.projetos.map((id) => (
            <Chip key={`proj-${id}`} label={`Proj: ${labelMap.get(id) ?? id}`} onRemove={() => removeFromList("projetos", id)} />
          ))}
          {filters.categorias.map((id) => (
            <Chip key={`cat-${id}`} label={`Cat: ${labelMap.get(id) ?? id}`} onRemove={() => removeFromList("categorias", id)} />
          ))}
          {filters.clientes.map((id) => (
            <Chip key={`cli-${id}`} label={`Cli: ${labelMap.get(id) ?? id}`} onRemove={() => removeFromList("clientes", id)} />
          ))}
          {filters.fornecedores.map((id) => (
            <Chip key={`forn-${id}`} label={`Forn: ${labelMap.get(id) ?? id}`} onRemove={() => removeFromList("fornecedores", id)} />
          ))}
          {filters.formasPagamento.map((id) => (
            <Chip key={`forma-${id}`} label={`Pgto: ${labelMap.get(id) ?? id}`} onRemove={() => removeFromList("formasPagamento", id)} />
          ))}
          {(filters.valorMin || filters.valorMax) && (
            <Chip
              label={
                filters.valorMin && filters.valorMax
                  ? `Valor ${filters.valorMin} → ${filters.valorMax}`
                  : filters.valorMin
                    ? `Valor ≥ ${filters.valorMin}`
                    : `Valor ≤ ${filters.valorMax}`
              }
              onRemove={() => onChange({ valorMin: "", valorMax: "" })}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Popover "Filtros" (status/intenção + projeto + demais) ----------
function FiltrosPopover({
  filters,
  onChange,
  activeQuick,
  onQuick,
  projetos,
  categorias,
  clientes,
  fornecedores,
  formaOptions,
  count,
}: {
  filters: LancamentosFilters;
  onChange: (next: Partial<LancamentosFilters>) => void;
  activeQuick: QuickFilter | null;
  onQuick: (q: QuickFilter) => void;
  projetos: MultiSelectOption[];
  categorias: MultiSelectOption[];
  clientes: MultiSelectOption[];
  fornecedores: MultiSelectOption[];
  formaOptions: MultiSelectOption[];
  count: number;
}) {
  const toggleForma = (value: string) => {
    const set = new Set(filters.formasPagamento);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    onChange({ formasPagamento: [...set] });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("h-9 rounded-full gap-1.5 text-sm font-normal", count > 0 && "border-brand bg-brand text-ink hover:bg-brand/90 hover:text-ink")}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtros
          {count > 0 && (
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px] bg-brand text-ink hover:bg-brand">
              {count}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="end">
        <div className="flex items-center justify-between px-4 py-2.5 border-b">
          <span className="text-sm font-medium">Filtros</span>
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() =>
                onChange({
                  status: "todos",
                  periodo: "mes-atual",
                  customFrom: null,
                  customTo: null,
                  projetos: [],
                  categorias: [],
                  clientes: [],
                  fornecedores: [],
                  formasPagamento: [],
                  valorMin: "",
                  valorMax: "",
                })
              }
            >
              Limpar
            </Button>
          )}
        </div>
        <div className="max-h-[64vh] overflow-y-auto">
          {/* Status / intenção */}
          <div className="px-4 py-3 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</h4>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_ORDER.map((q) => {
                const Icon = QUICK_ICON[q];
                const active = activeQuick === q;
                return (
                  <button
                    key={q}
                    type="button"
                    onClick={() => onQuick(q)}
                    className={cn(
                      "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border transition-colors",
                      active ? "bg-brand text-ink border-brand" : "bg-white border-black/10 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {QUICK_LABEL[q]}
                  </button>
                );
              })}
            </div>
          </div>
          <Separator />
          <CheckboxSearchSection
            title="Projeto"
            items={projetos}
            selected={filters.projetos}
            onChange={(v) => onChange({ projetos: v })}
            placeholder="Buscar projeto…"
          />
          <Separator />
          <CheckboxSearchSection
            title="Categoria"
            items={categorias}
            selected={filters.categorias}
            onChange={(v) => onChange({ categorias: v })}
            placeholder="Buscar categoria…"
          />
          <Separator />
          <CheckboxSearchSection
            title="Cliente"
            items={clientes}
            selected={filters.clientes}
            onChange={(next) => onChange(next.length > 0 && filters.tipo !== "receita" ? { clientes: next, tipo: "receita" } : { clientes: next })}
            placeholder="Buscar cliente…"
          />
          <Separator />
          <CheckboxSearchSection
            title="Fornecedor"
            items={fornecedores}
            selected={filters.fornecedores}
            onChange={(next) => onChange(next.length > 0 && filters.tipo !== "despesa" ? { fornecedores: next, tipo: "despesa" } : { fornecedores: next })}
            placeholder="Buscar fornecedor…"
          />
          <Separator />
          <div className="px-4 py-3 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Forma de pagamento</h4>
            <div className="flex flex-wrap gap-1.5">
              {formaOptions.map((f) => {
                const active = filters.formasPagamento.includes(f.value);
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => toggleForma(f.value)}
                    className={cn(
                      "h-7 px-3 rounded-full text-xs border transition-colors",
                      active ? "bg-brand text-ink border-brand" : "bg-white border-black/10 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
          <Separator />
          <div className="px-4 py-3 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Faixa de valor</h4>
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={filters.valorMin}
                onChange={(e) => onChange({ valorMin: formatCurrencyInput(e.target.value) })}
                placeholder="Mínimo"
                className="h-8 text-xs tabular-nums"
              />
              <Input
                value={filters.valorMax}
                onChange={(e) => onChange({ valorMax: formatCurrencyInput(e.target.value) })}
                placeholder="Máximo"
                className="h-8 text-xs tabular-nums"
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CheckboxSearchSection({
  title,
  items,
  selected,
  onChange,
  placeholder,
}: {
  title: string;
  items: MultiSelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? items.filter((i) => i.label.toLowerCase().includes(q)) : items;
  }, [items, search]);

  const toggle = (value: string) => {
    const set = new Set(selected);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    onChange([...set]);
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
          {selected.length > 0 && (
            <span className="text-[10px] bg-brand text-ink rounded-full px-1.5 py-0 min-w-[18px] text-center tabular-nums">
              {selected.length}
            </span>
          )}
        </div>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-2">
          <Input placeholder={placeholder} value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 text-xs" />
          <div className="max-h-48 overflow-y-auto -mx-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">Nenhum resultado</p>
            ) : (
              filtered.map((i) => (
                <label key={i.value} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-xs">
                  <Checkbox checked={selected.includes(i.value)} onCheckedChange={() => toggle(i.value)} />
                  <span className="truncate">{i.label}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 h-6 pl-2.5 pr-1 rounded-full bg-brand text-ink border border-brand/30 text-[11px] font-medium">
      <span className="truncate max-w-[200px]">{label}</span>
      <button type="button" onClick={onRemove} className="rounded-full p-0.5 hover:bg-brand/20" aria-label={`Remover ${label}`}>
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function SegBtn({
  active,
  onClick,
  children,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "positive" | "negative";
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className={cn(
        "rounded-full h-9 sm:h-7 px-3 gap-1.5 text-xs transition-colors",
        active
          ? tone === "positive"
            ? "bg-positive/10 text-positive-strong shadow-sm"
            : tone === "negative"
              ? "bg-negative/10 text-negative-strong shadow-sm"
              : "bg-white shadow-sm text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </Button>
  );
}
