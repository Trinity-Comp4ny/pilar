import { useState, type ReactNode } from "react";
import { Check, ChevronDown, SlidersHorizontal, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { filterTriggerClass } from "./filterStyles";

/**
 * Peças da toolbar de filtros (SPEC 121 / ADR 0058). Toda tela com filtro monta
 * `<FilterBar>` no slot `toolbar` de `PilarPage`/`PageLayout`, com `ViewSwitcher` no
 * começo e as peças abaixo na sequência. Tudo `h-9 rounded-full`; filtro ativo é
 * fundo verde com texto `ink` (verde nunca em primeiro plano, regra de contraste).
 */

interface FilterBarProps {
  children: ReactNode;
  /** Controles alinhados à direita (ordenar, colunas, contagem). */
  end?: ReactNode;
  className?: string;
}

/** Linha única da toolbar. Rola na horizontal quando não cabe, sem quebrar em duas linhas. */
export function FilterBar({ children, end, className }: FilterBarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Filtros"
      className={cn(
        "flex items-center gap-2 overflow-x-auto px-4 py-2 md:px-6 scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      {children}
      {end && <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">{end}</div>}
    </div>
  );
}

export function FilterDivider() {
  return <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />;
}

/** "Limpar" da barra: só aparece quando há filtro ativo, sem reservar espaço quando não há. */
export function FilterClear({ count, onClick }: { count: number; onClick: () => void }) {
  if (count <= 0) return null;
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className="h-9 shrink-0 gap-1.5 rounded-full px-3 text-[13px] font-normal text-muted-foreground"
    >
      <X className="h-3.5 w-3.5" aria-hidden />
      Limpar
      <span className="tabular-nums">({count})</span>
    </Button>
  );
}

interface FilterOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  /** Nome do filtro: aparece no gatilho e vira o `aria-label`. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  /** Valor que significa "sem filtro" (ex.: "todos"). Fora dele, o filtro fica ativo. */
  emptyValue?: string;
  icon?: LucideIcon;
  /** Mostra só a opção escolhida no gatilho (mês, ano), sem "Rótulo: opção" nem estado ativo. */
  showValue?: boolean;
  /** Força a busca na lista; por padrão só aparece acima de 8 opções. */
  searchable?: boolean;
  align?: "start" | "center" | "end";
  className?: string;
}

/** Acima disto a lista ganha busca. */
const LIMITE_SEM_BUSCA = 8;

/**
 * Filtro de escolha única. Mostra `Rótulo` quando está no valor vazio e `Rótulo: opção`
 * quando ativo, igual ao `MultiSelectFilter`. O "x" limpa sem abrir o popover.
 */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
  emptyValue,
  icon: Icon,
  showValue = false,
  searchable,
  align = "start",
  className,
}: FilterSelectProps) {
  const [open, setOpen] = useState(false);
  const atual = options.find((o) => o.value === value);
  const ativo = !showValue && emptyValue !== undefined && value !== emptyValue && !!atual;
  const comBusca = searchable ?? options.length > LIMITE_SEM_BUSCA;

  const escolher = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const limpar = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    if (emptyValue !== undefined) onChange(emptyValue);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" aria-label={label} className={filterTriggerClass(ativo, className)}>
          {Icon && <Icon size={14} aria-hidden className={cn("shrink-0", !ativo && "text-black/50")} />}
          <span className="truncate">
            {showValue ? (atual?.label ?? label) : ativo ? `${label}: ${atual.label}` : label}
          </span>
          {ativo ? (
            <span
              role="button"
              tabIndex={0}
              aria-label={`Limpar filtro ${label}`}
              onClick={limpar}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") limpar(e);
              }}
              className="ml-0.5 cursor-pointer rounded-full p-0.5 hover:bg-brand/20"
            >
              <X className="h-3 w-3" />
            </span>
          ) : (
            <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto min-w-[200px] p-0">
        {comBusca ? (
          <Command>
            <CommandInput placeholder="Buscar..." className="h-9" />
            <CommandList>
              <CommandEmpty>Nenhum resultado.</CommandEmpty>
              <CommandGroup>
                {options.map((o) => (
                  <CommandItem key={o.value} value={o.label} onSelect={() => escolher(o.value)} className="gap-2">
                    <span className="flex-1 truncate">{o.label}</span>
                    {o.value === value && <Check className="h-4 w-4" aria-hidden />}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        ) : (
          <div role="listbox" aria-label={label} className="flex max-h-72 flex-col gap-0.5 overflow-y-auto p-2">
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                onClick={() => escolher(o.value)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-left text-[13px] transition-colors",
                  o.value === value ? "bg-brand/15 font-medium text-ink" : "text-black/70 hover:bg-black/4"
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface FilterPopoverProps {
  /** Quantos filtros do painel estão ativos. */
  count: number;
  onClear: () => void;
  /** Seções de filtro do painel (cada tela decide as suas). */
  children: ReactNode;
  label?: string;
  align?: "start" | "center" | "end";
  className?: string;
}

/**
 * Botão "Filtros (n)" com painel de seções, para os filtros menos usados. O cabeçalho
 * do painel e o "Limpar" são fixos; o conteúdo rola. Abaixo de `sm` o botão vira só o ícone.
 */
export function FilterPopover({
  count,
  onClear,
  children,
  label = "Filtros",
  align = "end",
  className,
}: FilterPopoverProps) {
  const ativo = count > 0;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" aria-label={label} className={filterTriggerClass(ativo, className)}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          <span className="sr-only sm:not-sr-only">{label}</span>
          {ativo && (
            <span className="min-w-5 rounded-full bg-ink px-1.5 py-0.5 text-center text-[11px] leading-none text-background tabular-nums">
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-[340px] p-0">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <span className="text-sm font-medium">{label}</span>
          {ativo && (
            <Button variant="ghost" onClick={onClear} className="h-7 rounded-full px-2 text-xs text-muted-foreground">
              Limpar tudo
            </Button>
          )}
        </div>
        <div className="max-h-[64vh] overflow-y-auto">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
