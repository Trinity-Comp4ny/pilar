import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ViewSwitcher, type ViewOption } from "@/components/ViewSwitcher";
import type { FiltroExtrato, FiltroTipo } from "@/pages/obras/lib/filtroExtrato";

const TIPOS: ViewOption<FiltroTipo>[] = [
  { value: "todos", label: "Todos" },
  { value: "aporte", label: "Aportes" },
  { value: "despesa", label: "Despesas" },
];

const QUALQUER = "__todos__";

/** Barra de filtros do extrato: tipo, fornecedor (só os que aparecem nos lançamentos) e busca na descrição. */
export function ExtratoFiltros({
  filtro,
  onChange,
  fornecedores,
}: {
  filtro: FiltroExtrato;
  onChange: (f: FiltroExtrato) => void;
  fornecedores: ReadonlyArray<{ id: string; nome: string }>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ViewSwitcher
        options={TIPOS}
        value={filtro.tipo}
        onChange={(tipo) => onChange({ ...filtro, tipo })}
        ariaLabel="Filtrar por tipo de lançamento"
      />
      <Select
        value={filtro.fornecedorId || QUALQUER}
        onValueChange={(v) => onChange({ ...filtro, fornecedorId: v === QUALQUER ? "" : v })}
      >
        <SelectTrigger className="h-9 w-60" aria-label="Filtrar por fornecedor">
          <SelectValue placeholder="Fornecedor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={QUALQUER}>Todos os fornecedores</SelectItem>
          {fornecedores.map((f) => (
            <SelectItem key={f.id} value={f.id}>
              {f.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="relative min-w-40 flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filtro.busca}
          onChange={(e) => onChange({ ...filtro, busca: e.target.value })}
          placeholder="Buscar no extrato"
          aria-label="Buscar no extrato"
          className="h-9 pl-8"
        />
      </div>
    </div>
  );
}
