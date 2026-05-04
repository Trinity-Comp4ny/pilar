import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarIcon,
  Filter,
  LayoutList,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import { formatCurrencyInput } from "@/lib/currencyUtils";
import { MultiSelectFilter, type MultiSelectOption } from "./MultiSelectFilter";
import { FORMAS_PAGAMENTO } from "../hooks/useLancamentosFiltersData";
import type { LancamentosFilters, Periodo, StatusFilter } from "./lancamentosFilters";

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
  custom: "Personalizado",
};

const STATUS_LABEL: Record<StatusFilter, string> = {
  todos: "Todos status",
  pagos: "Pagos/Recebidos",
  pendentes: "Pendentes",
  atrasados: "Atrasados",
};

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
  const [advOpen, setAdvOpen] = useState(false);

  const formaOptions = useMemo<MultiSelectOption[]>(() => FORMAS_PAGAMENTO.map((f) => ({ value: f, label: f })), []);
  const labelMap = useMemo(() => {
    const m = new Map<string, string>();
    [...categorias, ...projetos, ...clientes, ...fornecedores, ...formaOptions].forEach((o) => m.set(o.value, o.label));
    return m;
  }, [categorias, projetos, clientes, fornecedores, formaOptions]);

  const customFromDate = filters.customFrom ? parseISO(filters.customFrom) : undefined;
  const customToDate = filters.customTo ? parseISO(filters.customTo) : undefined;

  const periodoTriggerLabel =
    filters.periodo === "custom"
      ? customFromDate && customToDate
        ? `${format(customFromDate, "dd/MM")} → ${format(customToDate, "dd/MM")}`
        : "Personalizado"
      : PERIODO_LABEL[filters.periodo];

  const advancedCount =
    (filters.status !== "todos" ? 1 : 0) +
    (filters.categorias.length > 0 ? 1 : 0) +
    (filters.projetos.length > 0 ? 1 : 0) +
    (filters.clientes.length > 0 ? 1 : 0) +
    (filters.fornecedores.length > 0 ? 1 : 0) +
    (filters.formasPagamento.length > 0 ? 1 : 0) +
    (filters.valorMin || filters.valorMax ? 1 : 0);

  const hasActive =
    !!filters.search || filters.tipo !== "todos" || filters.periodo !== "mes-atual" || advancedCount > 0;

  const removeFromList = (key: keyof LancamentosFilters, value: string) => {
    const arr = filters[key] as string[];
    onChange({ [key]: arr.filter((v) => v !== value) } as Partial<LancamentosFilters>);
  };

  return (
    <div className="space-y-2.5">
      {/* Linha unificada: search + tipo + período + filtros avançados + contador */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar descrição, cliente ou fornecedor…"
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            className="h-9 pl-8 pr-8 rounded-full"
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

        <Popover open={periodoOpen} onOpenChange={setPeriodoOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-9 rounded-full gap-1.5 text-xs font-normal",
                filters.periodo !== "mes-atual" && "border-brand bg-brand/5 text-brand"
              )}
            >
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

        <Sheet open={advOpen} onOpenChange={setAdvOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-9 rounded-full gap-1.5 text-xs font-normal",
                advancedCount > 0 && "border-brand bg-brand/5 text-brand hover:bg-brand/10 hover:text-brand"
              )}
            >
              <SlidersHorizontal className="h-3 w-3" />
              Filtros
              {advancedCount > 0 && (
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px] bg-brand text-ink hover:bg-brand">
                  {advancedCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-md flex flex-col">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filtros avançados
              </SheetTitle>
              <SheetDescription>Combine filtros para refinar a lista de lançamentos.</SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto py-4 space-y-5">
              <FilterSection title="Status">
                <div className="grid grid-cols-2 gap-1.5">
                  {(Object.keys(STATUS_LABEL) as StatusFilter[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => onChange({ status: s })}
                      className={cn(
                        "h-8 px-3 rounded-full text-xs font-medium border transition-colors",
                        filters.status === s
                          ? "bg-brand/10 text-brand border-brand"
                          : "bg-white border-black/10 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </FilterSection>

              <Separator />

              <FilterSection title="Categorização">
                <div className="flex flex-wrap gap-2">
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
                  <MultiSelectFilter
                    label="Forma pgto"
                    options={formaOptions}
                    selected={filters.formasPagamento}
                    onChange={(v) => onChange({ formasPagamento: v })}
                  />
                </div>
              </FilterSection>

              <Separator />

              <FilterSection
                title="Contraparte"
                hint="Selecionar cliente troca tipo para Receitas; fornecedor para Despesas."
              >
                <div className="flex flex-wrap gap-2">
                  <MultiSelectFilter
                    label="Cliente"
                    options={clientes}
                    selected={filters.clientes}
                    onChange={(next) => {
                      const patch: Partial<LancamentosFilters> = { clientes: next };
                      if (next.length > 0 && filters.tipo !== "receita") patch.tipo = "receita";
                      onChange(patch);
                    }}
                  />
                  <MultiSelectFilter
                    label="Fornecedor"
                    options={fornecedores}
                    selected={filters.fornecedores}
                    onChange={(next) => {
                      const patch: Partial<LancamentosFilters> = { fornecedores: next };
                      if (next.length > 0 && filters.tipo !== "despesa") patch.tipo = "despesa";
                      onChange(patch);
                    }}
                  />
                </div>
              </FilterSection>

              <Separator />

              <FilterSection title="Faixa de valor">
                <ValorRange
                  min={filters.valorMin}
                  max={filters.valorMax}
                  onApply={(min, max) => onChange({ valorMin: min, valorMax: max })}
                />
              </FilterSection>
            </div>

            <SheetFooter className="border-t pt-3">
              <div className="flex items-center justify-between w-full gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onChange({
                      status: "todos",
                      categorias: [],
                      projetos: [],
                      clientes: [],
                      fornecedores: [],
                      formasPagamento: [],
                      valorMin: "",
                      valorMax: "",
                    });
                  }}
                  className="h-8 text-xs gap-1 text-muted-foreground"
                  disabled={advancedCount === 0}
                >
                  <X className="h-3 w-3" />
                  Limpar avançados
                </Button>
                <Button
                  size="sm"
                  onClick={() => setAdvOpen(false)}
                  className="h-8 text-xs bg-brand hover:bg-brand/90 text-ink"
                >
                  Aplicar
                </Button>
              </div>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <span className="text-xs text-muted-foreground ml-auto tabular-nums">
          {visible} de {total}
        </span>

        {hasActive && (
          <Button variant="ghost" size="sm" onClick={onReset} className="h-8 gap-1 text-xs text-muted-foreground">
            <X className="h-3 w-3" />
            Limpar tudo
          </Button>
        )}
      </div>

      {/* Chips ativos */}
      {hasActive && (
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.status !== "todos" && (
            <Chip label={STATUS_LABEL[filters.status]} onRemove={() => onChange({ status: "todos" })} />
          )}
          {filters.categorias.map((id) => (
            <Chip
              key={`cat-${id}`}
              label={`Cat: ${labelMap.get(id) ?? id}`}
              onRemove={() => removeFromList("categorias", id)}
            />
          ))}
          {filters.projetos.map((id) => (
            <Chip
              key={`proj-${id}`}
              label={`Proj: ${labelMap.get(id) ?? id}`}
              onRemove={() => removeFromList("projetos", id)}
            />
          ))}
          {filters.clientes.map((id) => (
            <Chip
              key={`cli-${id}`}
              label={`Cli: ${labelMap.get(id) ?? id}`}
              onRemove={() => removeFromList("clientes", id)}
            />
          ))}
          {filters.fornecedores.map((id) => (
            <Chip
              key={`forn-${id}`}
              label={`Forn: ${labelMap.get(id) ?? id}`}
              onRemove={() => removeFromList("fornecedores", id)}
            />
          ))}
          {filters.formasPagamento.map((id) => (
            <Chip
              key={`forma-${id}`}
              label={`Pgto: ${labelMap.get(id) ?? id}`}
              onRemove={() => removeFromList("formasPagamento", id)}
            />
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

function FilterSection({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="space-y-0.5">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 h-6 pl-2.5 pr-1 rounded-full bg-brand/10 text-brand border border-brand/30 text-[11px] font-medium">
      <span className="truncate max-w-[200px]">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 hover:bg-brand/20"
        aria-label={`Remover ${label}`}
      >
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

function ValorRange({ min, max, onApply }: { min: string; max: string; onApply: (min: string, max: string) => void }) {
  const [localMin, setLocalMin] = useState(min);
  const [localMax, setLocalMax] = useState(max);

  useEffect(() => {
    setLocalMin(min);
    setLocalMax(max);
  }, [min, max]);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] uppercase text-muted-foreground">Mínimo</label>
          <Input
            value={localMin}
            onChange={(e) => setLocalMin(formatCurrencyInput(e.target.value))}
            onBlur={() => onApply(localMin, localMax)}
            placeholder="R$ 0,00"
            className="h-8 text-xs tabular-nums"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase text-muted-foreground">Máximo</label>
          <Input
            value={localMax}
            onChange={(e) => setLocalMax(formatCurrencyInput(e.target.value))}
            onBlur={() => onApply(localMin, localMax)}
            placeholder="R$ 0,00"
            className="h-8 text-xs tabular-nums"
          />
        </div>
      </div>
      {(localMin || localMax) && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1 text-muted-foreground"
          onClick={() => {
            setLocalMin("");
            setLocalMax("");
            onApply("", "");
          }}
        >
          <X className="h-3 w-3" />
          Limpar valor
        </Button>
      )}
    </div>
  );
}
