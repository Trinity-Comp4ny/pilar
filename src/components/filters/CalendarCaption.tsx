import { ChevronLeft, ChevronRight } from "lucide-react";
import { type MonthCaptionProps, useDayPicker } from "react-day-picker";
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

const arrowClass =
  "inline-flex h-7 w-7 items-center justify-center rounded-lg text-black/60 hover:bg-black/[0.04] hover:text-ink disabled:opacity-30 disabled:pointer-events-none transition-colors";

/**
 * Cabeçalho custom do calendário (spec 024): mês e ano como Select do design
 * system, no lugar dos dropdowns nativos do react-day-picker (que renderizavam
 * `<select>` do SO e duplicavam com o rótulo). Fábrica para fixar a faixa de anos.
 */
export function makeMonthYearCaption(fromYear: number, toYear: number) {
  const anos: number[] = [];
  for (let y = toYear; y >= fromYear; y--) anos.push(y);

  return function MonthYearCaption({ calendarMonth }: MonthCaptionProps) {
    const { goToMonth } = useDayPicker();
    const displayMonth = calendarMonth.date;
    const mes = displayMonth.getMonth();
    const ano = displayMonth.getFullYear();

    const prevDate = new Date(ano, mes - 1, 1);
    const nextDate = new Date(ano, mes + 1, 1);
    const canPrev = prevDate.getFullYear() >= fromYear;
    const canNext = nextDate.getFullYear() <= toYear;

    return (
      <div className="flex w-full items-center justify-between gap-1.5 pb-1">
        <div className="flex items-center gap-1.5">
          <Select value={mes.toString()} onValueChange={(v) => goToMonth(new Date(ano, parseInt(v, 10), 1))}>
            <SelectTrigger className="h-8 w-[124px] rounded-lg text-[13px] font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {MESES.map((label, i) => (
                <SelectItem key={i} value={i.toString()}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={ano.toString()} onValueChange={(v) => goToMonth(new Date(parseInt(v, 10), mes, 1))}>
            <SelectTrigger className="h-8 w-[82px] rounded-lg text-[13px] font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {anos.map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Mês anterior"
            disabled={!canPrev}
            onClick={() => goToMonth(prevDate)}
            className={cn(arrowClass)}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Próximo mês"
            disabled={!canNext}
            onClick={() => goToMonth(nextDate)}
            className={cn(arrowClass)}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };
}
