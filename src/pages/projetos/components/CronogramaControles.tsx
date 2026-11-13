import { useState } from "react";
import { CalendarCheck, ChevronDown, Info } from "lucide-react";
import { ZoomSwitcher } from "@/components/gantt/ZoomSwitcher";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { filterTriggerClass } from "@/components/filters/filterStyles";
import { cn } from "@/lib/utils";
import { PROJECT_STATUS_CONFIG, type ProjectStatus } from "@/constants";
import { CronogramaMeusToggle } from "./CronogramaMeusToggle";
import type { ZoomLevel } from "@/lib/cronograma";

interface MultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (val: string[]) => void;
  placeholder: string;
  searchPlaceholder?: string;
}

function MultiSelect({ options, selected, onChange, placeholder, searchPlaceholder }: MultiSelectProps) {
  const [open, setOpen] = useState(false);

  const toggle = (value: string) => {
    if (selected.includes(value)) onChange(selected.filter((v) => v !== value));
    else onChange([...selected, value]);
  };

  const label =
    selected.length === 0 ? placeholder : selected.length === 1 ? selected[0] : `${selected.length} selecionados`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={filterTriggerClass(selected.length > 0, "justify-between")}>
          <span className="truncate">{label}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder ?? "Buscar..."} className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty className="text-xs py-2 text-center text-muted-foreground">Nenhum resultado.</CommandEmpty>
            <CommandGroup>
              {selected.length > 0 && (
                <CommandItem onSelect={() => onChange([])} className="text-xs text-muted-foreground">
                  Limpar seleção
                </CommandItem>
              )}
              {options.map((opt) => (
                <CommandItem key={opt} onSelect={() => toggle(opt)} className="text-xs gap-2">
                  <Checkbox checked={selected.includes(opt)} className="pointer-events-none" />
                  <span className="truncate">{opt}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Legenda das cores do Gantt num popover: antes era uma linha fixa embaixo do gráfico. */
function Legenda({ cores, podeArrastar }: { cores: Record<string, string>; podeArrastar: boolean }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label="Legenda das cores"
          title="Legenda das cores"
          className={filterTriggerClass(false, "w-9 px-0 justify-center")}
        >
          <Info size={16} aria-hidden className="text-black/60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 space-y-2 p-3 text-xs text-muted-foreground">
        {Object.entries(cores).map(([status, cor]) => (
          <div key={status} className="flex items-center gap-2">
            <span className={cn("h-2.5 w-6 rounded-sm", cor)} aria-hidden />
            <span>{PROJECT_STATUS_CONFIG[status as ProjectStatus]?.label || status}</span>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <span className="ml-2.5 h-2.5 w-0.5 bg-fill-danger" aria-hidden />
          <span className="ml-2.5">Hoje</span>
        </div>
        {podeArrastar && <p className="border-t pt-2">Arraste as bordas da barra para ajustar as datas.</p>}
      </PopoverContent>
    </Popover>
  );
}

interface CronogramaControlesProps {
  meus: boolean;
  onMeus: (meus: boolean) => void;
  status: ProjectStatus | "all";
  onStatus: (status: ProjectStatus | "all") => void;
  statusOptions: Array<{ value: ProjectStatus | "all"; label: string }>;
  clienteOptions: string[];
  clientes: string[];
  onClientes: (v: string[]) => void;
  responsavelOptions: string[];
  responsaveis: string[];
  onResponsaveis: (v: string[]) => void;
  zoom: ZoomLevel;
  onZoom: (zoom: ZoomLevel) => void;
  onHoje: () => void;
  hojeDesabilitado: boolean;
  total: number;
  isSaving: boolean;
  isDragging: boolean;
  cores: Record<string, string>;
  podeArrastar: boolean;
}

/**
 * Controles do Cronograma de Projetos numa linha só. No desktop, a aba os põe na barra de
 * filtros da página, ao lado de "Filtros", em vez de um card com título próprio acima do
 * Gantt (116 px a menos de altura; auditoria de espaço, 2026-11).
 */
export function CronogramaControles(p: CronogramaControlesProps) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <CronogramaMeusToggle value={p.meus} onChange={p.onMeus} />
      <Select value={p.status} onValueChange={(v) => p.onStatus(v as ProjectStatus | "all")}>
        <SelectTrigger className={filterTriggerClass(p.status !== "all", "w-auto")} aria-label="Filtrar por status">
          {/* "Status" quando não filtra (mais curto que "Todos os status"), como os outros filtros. */}
          <SelectValue placeholder="Status">
            {p.status === "all" ? "Status" : p.statusOptions.find((o) => o.value === p.status)?.label}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {p.statusOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {p.clienteOptions.length > 0 && (
        <MultiSelect
          options={p.clienteOptions}
          selected={p.clientes}
          onChange={p.onClientes}
          placeholder="Cliente"
          searchPlaceholder="Buscar cliente..."
        />
      )}
      {p.responsavelOptions.length > 0 && (
        <MultiSelect
          options={p.responsavelOptions}
          selected={p.responsaveis}
          onChange={p.onResponsaveis}
          placeholder="Responsável"
          searchPlaceholder="Buscar responsável..."
        />
      )}
      {/* Contagem só em tela larga: no notebook o espaço vai para os controles. */}
      <span className="hidden shrink-0 px-1 text-xs tabular-nums text-muted-foreground 2xl:inline">
        {p.total} projeto{p.total === 1 ? "" : "s"}
      </span>
      {p.isSaving && <span className="shrink-0 text-[11px] text-muted-foreground animate-pulse">Salvando...</span>}
      {p.isDragging && <span className="shrink-0 text-[11px] text-muted-foreground">Esc para cancelar</span>}
      <Button
        variant="outline"
        aria-label="Hoje"
        title="Ir para hoje"
        className={filterTriggerClass(false, "w-9 px-0 justify-center")}
        onClick={p.onHoje}
        disabled={p.hojeDesabilitado}
      >
        <CalendarCheck size={16} aria-hidden className="text-black/60" />
      </Button>
      <ZoomSwitcher value={p.zoom} onChange={p.onZoom} />
      <Legenda cores={p.cores} podeArrastar={p.podeArrastar} />
    </div>
  );
}
