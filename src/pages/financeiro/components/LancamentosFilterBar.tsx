import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowDownCircle, ArrowUpCircle, CalendarIcon, LayoutList, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import { formatCurrencyInput } from "@/lib/currencyUtils";
import { MultiSelectFilter, type MultiSelectOption } from "./MultiSelectFilter";
import { FORMAS_PAGAMENTO } from "../hooks/useLancamentosFiltersData";
import type { LancamentosFilters, Periodo, QuickFilter, TipoFilter, StatusFilter } from "./lancamentosFilters";

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
}

const PERIODO_LABEL: Record<Periodo | "custom", string> = {
  "mes-atual": "Mês atual",
  "mes-anterior": "Mês anterior",
  "ultimos-30": "Últimos 30 dias",
  ano: "Este ano",
  tudo: "Todo período",
  custom: "Personalizado…",
};

const QUICK: { id: QuickFilter; label: string }[] = [
  { id: "mes-atual", label: "Mês atual" },
  { id: "vence-hoje", label: "Vence hoje" },
  { id: "atrasados", label: "Atrasados" },
  { id: "pendentes", label: "Pendentes" },
];

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
}: Props) {
  const [periodoOpen, setPeriodoOpen] = useState(false);

  const formaOptions = useMemo<MultiSelectOption[]>(() => FORMAS_PAGAMENTO.map((f) => ({ value: f, label: f })), []);

  const setTipo = (tipo: TipoFilter) => onChange({ tipo });

  const onSelectCliente = (next: string[]) => {
    const patch: Partial<LancamentosFilters> = { clientes: next };
    if (next.length > 0 && filters.tipo !== "receita") patch.tipo = "receita";
    onChange(patch);
  };

  const onSelectFornecedor = (next: string[]) => {
    const patch: Partial<LancamentosFilters> = { fornecedores: next };
    if (next.length > 0 && filters.tipo !== "despesa") patch.tipo = "despesa";
    onChange(patch);
  };

  const applyQuick = (q: QuickFilter) => {
    if (q === "mes-atual") onChange({ periodo: "mes-atual", status: "todos" });
    else if (q === "vence-hoje") {
      const today = format(new Date(), "yyyy-MM-dd");
      onChange({ periodo: "custom", customFrom: today, customTo: today, status: "pendentes" });
    } else if (q === "atrasados") onChange({ periodo: "tudo", status: "atrasados" });
    else if (q === "pendentes") onChange({ status: "pendentes" });
  };

  const isQuickActive = (q: QuickFilter): boolean => {
    if (q === "mes-atual") return filters.periodo === "mes-atual" && filters.status === "todos";
    if (q === "atrasados") return filters.status === "atrasados";
    if (q === "pendentes") return filters.status === "pendentes";
    if (q === "vence-hoje") {
      const today = format(new Date(), "yyyy-MM-dd");
      return (
        filters.periodo === "custom" &&
        filters.customFrom === today &&
        filters.customTo === today &&
        filters.status === "pendentes"
      );
    }
    return false;
  };

  const customFromDate = filters.customFrom ? parseISO(filters.customFrom) : undefined;
  const customToDate = filters.customTo ? parseISO(filters.customTo) : undefined;

  const periodoTriggerLabel =
    filters.periodo === "custom"
      ? customFromDate && customToDate
        ? `${format(customFromDate, "dd/MM")} → ${format(customToDate, "dd/MM")}`
        : "Personalizado…"
      : PERIODO_LABEL[filters.periodo];

  const hasActive =
    filters.search ||
    filters.tipo !== "todos" ||
    filters.status !== "todos" ||
    filters.periodo !== "mes-atual" ||
    filters.categorias.length > 0 ||
    filters.projetos.length > 0 ||
    filters.clientes.length > 0 ||
    filters.fornecedores.length > 0 ||
    filters.formasPagamento.length > 0 ||
    filters.valorMin ||
    filters.valorMax;

  return (
    <div className="space-y-2.5">
      {/* Linha 1 — search + tipo + período + quick pills */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar descrição, cliente ou fornecedor…"
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            className="h-9 pl-8 rounded-full"
          />
        </div>

        <div className="inline-flex rounded-full bg-muted p-1">
          <SegBtn active={filters.tipo === "todos"} onClick={() => setTipo("todos")}>
            <LayoutList className="h-3.5 w-3.5" />
            Todos
          </SegBtn>
          <SegBtn active={filters.tipo === "receita"} onClick={() => setTipo("receita")} tone="positive">
            <ArrowUpCircle className="h-3.5 w-3.5" />
            Receitas
          </SegBtn>
          <SegBtn active={filters.tipo === "despesa"} onClick={() => setTipo("despesa")} tone="negative">
            <ArrowDownCircle className="h-3.5 w-3.5" />
            Despesas
          </SegBtn>
        </div>

        <Popover open={periodoOpen} onOpenChange={setPeriodoOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 rounded-full gap-1.5 text-xs font-normal">
              <CalendarIcon className="h-3 w-3" />
              {periodoTriggerLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="flex">
              <div className="border-r py-2 px-1 space-y-0.5 min-w-[160px]">
                {(["mes-atual", "mes-anterior", "ultimos-30", "ano", "tudo"] as Periodo[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      onChange({ periodo: p, customFrom: null, customTo: null });
                      setPeriodoOpen(false);
                    }}
                    className={cn(
                      "w-full text-left text-xs px-3 py-2 rounded hover:bg-muted transition-colors",
                      filters.periodo === p && "bg-brand/10 text-brand font-medium"
                    )}
                  >
                    {PERIODO_LABEL[p]}
                  </button>
                ))}
                <div className="border-t my-1" />
                <div
                  className={cn(
                    "text-[10px] uppercase px-3 py-1 text-muted-foreground tracking-wider",
                    filters.periodo === "custom" && "text-brand"
                  )}
                >
                  Personalizado
                </div>
              </div>
              <Calendar
                mode="range"
                locale={ptBR}
                selected={{ from: customFromDate, to: customToDate } as DateRange}
                onSelect={(range: DateRange | undefined) => {
                  onChange({
                    periodo: "custom",
                    customFrom: range?.from ? format(range.from, "yyyy-MM-dd") : null,
                    customTo: range?.to ? format(range.to, "yyyy-MM-dd") : null,
                  });
                  if (range?.from && range?.to) setPeriodoOpen(false);
                }}
                numberOfMonths={2}
                initialFocus
              />
            </div>
          </PopoverContent>
        </Popover>

        <span className="text-xs text-muted-foreground ml-auto tabular-nums">
          {visible} de {total}
        </span>
      </div>

      {/* Linha quick pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        {QUICK.map((q) => (
          <button
            key={q.id}
            type="button"
            onClick={() => applyQuick(q.id)}
            className={cn(
              "h-7 px-3 rounded-full text-[11px] font-medium border transition-colors",
              isQuickActive(q.id)
                ? "bg-brand/10 text-brand border-brand"
                : "bg-white border-black/10 text-muted-foreground hover:text-foreground hover:border-black/20"
            )}
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Linha 2 — chips de filtro */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filters.status} onValueChange={(v) => onChange({ status: v as StatusFilter })}>
          <SelectTrigger className="h-8 w-auto rounded-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            <SelectItem value="pagos">Pagos/Recebidos</SelectItem>
            <SelectItem value="pendentes">Pendentes</SelectItem>
            <SelectItem value="atrasados">Atrasados</SelectItem>
          </SelectContent>
        </Select>

        <MultiSelectFilter
          label="Categoria"
          options={categorias}
          selected={filters.categorias}
          onChange={(v) => onChange({ categorias: v })}
        />
        <MultiSelectFilter
          label="Projeto"
          options={projetos}
          selected={filters.projetos}
          onChange={(v) => onChange({ projetos: v })}
        />
        <MultiSelectFilter label="Cliente" options={clientes} selected={filters.clientes} onChange={onSelectCliente} />
        <MultiSelectFilter
          label="Fornecedor"
          options={fornecedores}
          selected={filters.fornecedores}
          onChange={onSelectFornecedor}
        />
        <MultiSelectFilter
          label="Forma pgto"
          options={formaOptions}
          selected={filters.formasPagamento}
          onChange={(v) => onChange({ formasPagamento: v })}
        />

        <ValorRangePopover
          min={filters.valorMin}
          max={filters.valorMax}
          onApply={(min, max) => onChange({ valorMin: min, valorMax: max })}
        />

        {hasActive && (
          <Button variant="ghost" size="sm" onClick={onReset} className="h-8 gap-1 text-xs text-muted-foreground">
            <X className="h-3 w-3" />
            Limpar tudo
          </Button>
        )}
      </div>
    </div>
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
      size="sm"
      onClick={onClick}
      className={cn(
        "rounded-full h-7 px-3 gap-1.5 text-xs transition-colors",
        active
          ? tone === "positive"
            ? "bg-positive/10 text-positive shadow-sm"
            : tone === "negative"
              ? "bg-red-50 text-red-600 shadow-sm"
              : "bg-white shadow-sm text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </Button>
  );
}

function ValorRangePopover({
  min,
  max,
  onApply,
}: {
  min: string;
  max: string;
  onApply: (min: string, max: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [localMin, setLocalMin] = useState(min);
  const [localMax, setLocalMax] = useState(max);

  useEffect(() => {
    if (open) {
      setLocalMin(min);
      setLocalMax(max);
    }
  }, [open, min, max]);

  const hasValue = !!min || !!max;
  const triggerLabel = !hasValue
    ? "Valor"
    : min && max
      ? `Valor: ${min} → ${max}`
      : min
        ? `Valor ≥ ${min}`
        : `Valor ≤ ${max}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 rounded-full gap-1 text-xs font-normal max-w-[220px]",
            hasValue && "border-brand bg-brand/5 text-brand hover:bg-brand/10 hover:text-brand"
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          {hasValue ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onApply("", "");
              }}
              className="ml-0.5 rounded-full hover:bg-brand/20 p-0.5 cursor-pointer"
              aria-label="Limpar"
            >
              <X className="h-3 w-3" />
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-3 space-y-2" align="start">
        <div className="text-xs font-medium">Faixa de valor</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-muted-foreground">Mínimo</label>
            <Input
              value={localMin}
              onChange={(e) => setLocalMin(formatCurrencyInput(e.target.value))}
              placeholder="R$ 0,00"
              className="h-8 text-xs tabular-nums"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-muted-foreground">Máximo</label>
            <Input
              value={localMax}
              onChange={(e) => setLocalMax(formatCurrencyInput(e.target.value))}
              placeholder="R$ 0,00"
              className="h-8 text-xs tabular-nums"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              setLocalMin("");
              setLocalMax("");
              onApply("", "");
              setOpen(false);
            }}
          >
            Limpar
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs bg-brand hover:bg-brand/90 text-ink"
            onClick={() => {
              onApply(localMin, localMax);
              setOpen(false);
            }}
          >
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
