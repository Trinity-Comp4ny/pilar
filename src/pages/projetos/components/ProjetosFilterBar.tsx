import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Building2,
  Calendar as CalendarIcon,
  ChevronDown,
  Clock,
  Layers,
  SlidersHorizontal,
  Search,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { PROJECT_PRIORITY, PROJECT_PRIORITY_CONFIG, PRIORITY_OPTIONS, type ProjectPriority } from "@/constants";

export type DeadlineFilter = "em_atraso" | "atencao" | "no_prazo";

export interface ProjetosFilters {
  search: string;
  pessoaIds: string[];
  prioridades: ProjectPriority[];
  clienteIds: string[];
  disciplinaIds: string[];
  deadlineStatus: DeadlineFilter[];
  dataInicio: string;
  dataFim: string;
}

export const EMPTY_FILTERS: ProjetosFilters = {
  search: "",
  pessoaIds: [],
  prioridades: [],
  clienteIds: [],
  disciplinaIds: [],
  deadlineStatus: [],
  dataInicio: "",
  dataFim: "",
};

interface ProjetosFilterBarProps {
  pessoas: { id: string; nome: string }[];
  clientes: { id: string; nome: string }[];
  disciplinas: { id: string; nome: string }[];
  filters: ProjetosFilters;
  onChange: (filters: ProjetosFilters) => void;
}

const DEADLINE_OPTIONS: { id: DeadlineFilter; label: string; dot: string }[] = [
  { id: "em_atraso", label: "Atrasado", dot: "bg-red-500" },
  { id: "atencao", label: "Atenção", dot: "bg-yellow-500" },
  { id: "no_prazo", label: "No prazo", dot: "bg-positive/100" },
];

export function ProjetosFilterBar({ pessoas, clientes, disciplinas, filters, onChange }: ProjetosFilterBarProps) {
  const searchRef = useRef<HTMLInputElement>(null);

  // Atalho `/` foca a busca
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const filtroCount =
    filters.pessoaIds.length +
    filters.prioridades.length +
    filters.clienteIds.length +
    filters.disciplinaIds.length +
    filters.deadlineStatus.length +
    (filters.dataInicio ? 1 : 0) +
    (filters.dataFim ? 1 : 0);

  const totalActive = filtroCount + (filters.search ? 1 : 0);

  return (
    <div className="flex items-center gap-2">
      {/* Limpar — sempre ocupa espaço */}
      <Button
        variant="ghost"
        className={cn(
          "h-9 rounded-full text-sm text-muted-foreground transition-opacity w-[120px] justify-center",
          totalActive === 0 && "opacity-0 pointer-events-none"
        )}
        onClick={() => onChange(EMPTY_FILTERS)}
      >
        <X className="h-4 w-4 mr-1.5" /> Limpar ({totalActive})
      </Button>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={searchRef}
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Buscar (/)"
          className="h-9 w-[240px] pl-9 pr-8 text-sm rounded-full"
        />
        {filters.search && (
          <button
            type="button"
            onClick={() => onChange({ ...filters, search: "" })}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filtros — botão único */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn("h-9 rounded-full text-sm gap-2", filtroCount > 0 && "border-foreground/40 bg-muted")}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>Filtros</span>
            {filtroCount > 0 && (
              <span className="text-[11px] bg-foreground text-background rounded-full px-1.5 py-0.5 min-w-[20px] tabular-nums">
                {filtroCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[340px] p-0" align="end">
          <FiltersPanel
            pessoas={pessoas}
            clientes={clientes}
            disciplinas={disciplinas}
            filters={filters}
            onChange={onChange}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ---------- Painel de filtros ----------
function FiltersPanel({
  pessoas,
  clientes,
  disciplinas,
  filters,
  onChange,
}: {
  pessoas: { id: string; nome: string }[];
  clientes: { id: string; nome: string }[];
  disciplinas: { id: string; nome: string }[];
  filters: ProjetosFilters;
  onChange: (filters: ProjetosFilters) => void;
}) {
  const togglePessoa = (id: string) =>
    onChange({
      ...filters,
      pessoaIds: filters.pessoaIds.includes(id)
        ? filters.pessoaIds.filter((p) => p !== id)
        : [...filters.pessoaIds, id],
    });

  const toggleCliente = (id: string) =>
    onChange({
      ...filters,
      clienteIds: filters.clienteIds.includes(id)
        ? filters.clienteIds.filter((c) => c !== id)
        : [...filters.clienteIds, id],
    });

  const toggleDisciplina = (id: string) =>
    onChange({
      ...filters,
      disciplinaIds: filters.disciplinaIds.includes(id)
        ? filters.disciplinaIds.filter((d) => d !== id)
        : [...filters.disciplinaIds, id],
    });

  const togglePrioridade = (p: ProjectPriority) =>
    onChange({
      ...filters,
      prioridades: filters.prioridades.includes(p)
        ? filters.prioridades.filter((x) => x !== p)
        : [...filters.prioridades, p],
    });

  const toggleDeadline = (d: DeadlineFilter) =>
    onChange({
      ...filters,
      deadlineStatus: filters.deadlineStatus.includes(d)
        ? filters.deadlineStatus.filter((x) => x !== d)
        : [...filters.deadlineStatus, d],
    });

  const filtroCount =
    filters.pessoaIds.length +
    filters.prioridades.length +
    filters.clienteIds.length +
    filters.disciplinaIds.length +
    filters.deadlineStatus.length +
    (filters.dataInicio ? 1 : 0) +
    (filters.dataFim ? 1 : 0);

  return (
    <div className="flex flex-col max-h-[70vh]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">Filtros</span>
        </div>
        {filtroCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => onChange({ ...EMPTY_FILTERS, search: filters.search })}
          >
            Limpar tudo
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Prioridade */}
        <FilterSection title="Prioridade" count={filters.prioridades.length}>
          <div className="flex flex-wrap gap-1">
            {PRIORITY_OPTIONS.map((p) => {
              const active = filters.prioridades.includes(p);
              const dot =
                p === PROJECT_PRIORITY.ALTA
                  ? "bg-red-500"
                  : p === PROJECT_PRIORITY.MEDIA
                    ? "bg-amber-400"
                    : "bg-blue-400";
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePrioridade(p)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 h-7 rounded-full text-xs border transition-colors",
                    active
                      ? "bg-foreground text-background border-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted border-transparent"
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
                  {PROJECT_PRIORITY_CONFIG[p].label}
                </button>
              );
            })}
          </div>
        </FilterSection>

        {/* Atraso */}
        <FilterSection title="Status de prazo" count={filters.deadlineStatus.length}>
          <div className="flex flex-wrap gap-1">
            {DEADLINE_OPTIONS.map((d) => {
              const active = filters.deadlineStatus.includes(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => toggleDeadline(d.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 h-7 rounded-full text-xs border transition-colors",
                    active
                      ? "bg-foreground text-background border-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted border-transparent"
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", d.dot)} />
                  {d.label}
                </button>
              );
            })}
          </div>
        </FilterSection>

        {/* Equipe */}
        <PessoasSection
          pessoas={pessoas}
          selected={filters.pessoaIds}
          onToggle={togglePessoa}
          onClear={() => onChange({ ...filters, pessoaIds: [] })}
        />

        {/* Cliente */}
        <ClientesSection
          clientes={clientes}
          selected={filters.clienteIds}
          onToggle={toggleCliente}
          onClear={() => onChange({ ...filters, clienteIds: [] })}
        />

        {/* Disciplina */}
        <DisciplinasSection
          disciplinas={disciplinas}
          selected={filters.disciplinaIds}
          onToggle={toggleDisciplina}
          onClear={() => onChange({ ...filters, disciplinaIds: [] })}
        />

        {/* Período */}
        <PeriodoSection filters={filters} onChange={onChange} />
      </div>
    </div>
  );
}

function FilterSection({
  title,
  count,
  children,
  defaultOpen = true,
  icon,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</span>
          {count !== undefined && count > 0 && (
            <span className="text-[10px] bg-foreground text-background rounded-full px-1.5 py-0 min-w-[18px] tabular-nums">
              {count}
            </span>
          )}
        </div>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

function PessoasSection({
  pessoas,
  selected,
  onToggle,
  onClear,
}: {
  pessoas: { id: string; nome: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? pessoas.filter((p) => p.nome.toLowerCase().includes(q)) : pessoas;
  }, [pessoas, search]);

  return (
    <FilterSection
      title="Equipe"
      count={selected.length}
      icon={<Users className="h-3.5 w-3.5 text-muted-foreground" />}
      defaultOpen={false}
    >
      <div className="space-y-2">
        <Input
          placeholder="Buscar membro..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-xs"
        />
        <div className="max-h-48 overflow-y-auto -mx-1">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">Nenhum membro</p>
          ) : (
            filtered.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-xs"
              >
                <Checkbox checked={selected.includes(p.id)} onCheckedChange={() => onToggle(p.id)} />
                <span className="truncate">{p.nome}</span>
              </label>
            ))
          )}
        </div>
        {selected.length > 0 && (
          <Button variant="ghost" size="sm" className="h-7 text-xs w-full" onClick={onClear}>
            Limpar equipe
          </Button>
        )}
      </div>
    </FilterSection>
  );
}

function ClientesSection({
  clientes,
  selected,
  onToggle,
  onClear,
}: {
  clientes: { id: string; nome: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? clientes.filter((c) => c.nome.toLowerCase().includes(q)) : clientes;
  }, [clientes, search]);

  return (
    <FilterSection
      title="Cliente"
      count={selected.length}
      icon={<Building2 className="h-3.5 w-3.5 text-muted-foreground" />}
      defaultOpen={false}
    >
      <div className="space-y-2">
        <Input
          placeholder="Buscar cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-xs"
        />
        <div className="max-h-48 overflow-y-auto -mx-1">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">Nenhum cliente</p>
          ) : (
            filtered.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-xs"
              >
                <Checkbox checked={selected.includes(c.id)} onCheckedChange={() => onToggle(c.id)} />
                <span className="truncate">{c.nome}</span>
              </label>
            ))
          )}
        </div>
        {selected.length > 0 && (
          <Button variant="ghost" size="sm" className="h-7 text-xs w-full" onClick={onClear}>
            Limpar clientes
          </Button>
        )}
      </div>
    </FilterSection>
  );
}

function DisciplinasSection({
  disciplinas,
  selected,
  onToggle,
  onClear,
}: {
  disciplinas: { id: string; nome: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? disciplinas.filter((d) => d.nome.toLowerCase().includes(q)) : disciplinas;
  }, [disciplinas, search]);

  return (
    <FilterSection
      title="Disciplina"
      count={selected.length}
      icon={<Layers className="h-3.5 w-3.5 text-muted-foreground" />}
      defaultOpen={false}
    >
      <div className="space-y-2">
        <Input
          placeholder="Buscar disciplina..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-xs"
        />
        <div className="max-h-48 overflow-y-auto -mx-1">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">Nenhuma disciplina</p>
          ) : (
            filtered.map((d) => (
              <label
                key={d.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-xs"
              >
                <Checkbox checked={selected.includes(d.id)} onCheckedChange={() => onToggle(d.id)} />
                <span className="truncate">{d.nome}</span>
              </label>
            ))
          )}
        </div>
        {selected.length > 0 && (
          <Button variant="ghost" size="sm" className="h-7 text-xs w-full" onClick={onClear}>
            Limpar disciplinas
          </Button>
        )}
      </div>
    </FilterSection>
  );
}

function PeriodoSection({
  filters,
  onChange,
}: {
  filters: ProjetosFilters;
  onChange: (filters: ProjetosFilters) => void;
}) {
  const hasDate = !!(filters.dataInicio || filters.dataFim);
  return (
    <FilterSection
      title="Período (previsão)"
      count={hasDate ? 1 : 0}
      icon={<CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />}
      defaultOpen={false}
    >
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">De</label>
            <DatePicker value={filters.dataInicio} onChange={(v) => onChange({ ...filters, dataInicio: v })} />
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">Até</label>
            <DatePicker
              value={filters.dataFim}
              onChange={(v) => onChange({ ...filters, dataFim: v })}
              minDate={filters.dataInicio || undefined}
            />
          </div>
        </div>
        <div className="flex gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs flex-1"
            onClick={() => {
              const today = new Date();
              const in30 = new Date();
              in30.setDate(today.getDate() + 30);
              onChange({
                ...filters,
                dataInicio: today.toISOString().slice(0, 10),
                dataFim: in30.toISOString().slice(0, 10),
              });
            }}
          >
            <Clock className="h-3 w-3 mr-1" /> Próximos 30d
          </Button>
          {hasDate && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onChange({ ...filters, dataInicio: "", dataFim: "" })}
            >
              Limpar
            </Button>
          )}
        </div>
      </div>
    </FilterSection>
  );
}
