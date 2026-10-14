import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
      <Select value={mes.toString()} onValueChange={(v) => onChange(parseInt(v, 10), ano)}>
        <SelectTrigger className="w-[140px] h-9 rounded-full text-sm">
          <SelectValue placeholder="Mês" />
        </SelectTrigger>
        <SelectContent>
          {MESES.map((label, i) => (
            <SelectItem key={i + 1} value={(i + 1).toString()}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={ano.toString()} onValueChange={(v) => onChange(mes, parseInt(v, 10))}>
        <SelectTrigger className="w-[100px] h-9 rounded-full text-sm">
          <SelectValue placeholder="Ano" />
        </SelectTrigger>
        <SelectContent>
          {anos.map((y) => (
            <SelectItem key={y} value={y.toString()}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
