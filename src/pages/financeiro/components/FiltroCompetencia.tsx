import { FilterSelect } from "@/components/filters/FilterBar";
import { cn } from "@/lib/utils";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

interface FiltroCompetenciaProps {
  /** Mês 1-12. */
  mes: number;
  ano: number;
  onChange: (mes: number, ano: number) => void;
  fromYear?: number;
  toYear?: number;
  className?: string;
}

/**
 * Filtro de competência compartilhado do Financeiro (spec 024): um mês fechado.
 * Mesma cara (pills) do FiltroPeriodo, para as telas cuja unidade natural é a
 * competência (Folha, DRE, WIP), onde intervalo não faz sentido.
 */
export function FiltroCompetencia({ mes, ano, onChange, fromYear, toYear, className }: FiltroCompetenciaProps) {
  const currentYear = new Date().getFullYear();
  const start = fromYear ?? currentYear - 5;
  const end = toYear ?? currentYear + 1;
  const anos = Array.from({ length: end - start + 1 }, (_, i) => end - i);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <FilterSelect
        label="Mês"
        showValue
        value={mes.toString()}
        onChange={(v) => onChange(parseInt(v, 10), ano)}
        options={MESES.map((label, i) => ({ value: (i + 1).toString(), label }))}
        searchable={false}
      />
      <FilterSelect
        label="Ano"
        showValue
        value={ano.toString()}
        onChange={(v) => onChange(mes, parseInt(v, 10))}
        options={anos.map((y) => ({ value: y.toString(), label: y.toString() }))}
        searchable={false}
      />
    </div>
  );
}
