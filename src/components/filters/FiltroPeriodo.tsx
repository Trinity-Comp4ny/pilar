import { ReactNode, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { type PeriodoPreset, detectPreset, labelForPreset, rangeForPreset } from "@/lib/periodo";
import { makeMonthYearCaption } from "./CalendarCaption";

interface FiltroPeriodoProps {
  from: Date | undefined;
  to: Date | undefined;
  onChange: (from: Date | undefined, to: Date | undefined) => void;
  /** Presets exibidos, na ordem. Default: todos, incluindo "Todo o período". */
  presets?: PeriodoPreset[];
  /** Slot no rodapé do popover (ex.: toggle Diário/Mensal da Visão Geral). */
  footer?: ReactNode;
  align?: "start" | "center" | "end";
  numberOfMonths?: 1 | 2;
  fromYear?: number;
  toYear?: number;
  className?: string;
}

const DEFAULT_PRESETS: PeriodoPreset[] = [
  "mes-atual",
  "mes-anterior",
  "ultimos-30",
  "este-trimestre",
  "trimestre-passado",
  "este-ano",
  "tudo",
  "custom",
];

/**
 * Filtro de período compartilhado do Financeiro (spec 024). Presets à esquerda; o
 * calendário só aparece ao escolher "Personalizado" (ou ao reabrir num intervalo
 * custom), resolvendo a confusão do calendário sempre aberto. O calendário usa
 * dropdown de mês/ano para saltar anos sem clicar seta a seta.
 */
export function FiltroPeriodo({
  from,
  to,
  onChange,
  presets = DEFAULT_PRESETS,
  footer,
  align = "end",
  numberOfMonths = 1,
  fromYear,
  toYear,
  className,
}: FiltroPeriodoProps) {
  const [open, setOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  // Seleção de trabalho do calendário, desacoplada do valor semântico. Assim,
  // entrar no "Personalizado" começa limpo (1º clique = início, 2º = fim) em vez
  // de herdar o intervalo do preset e travar o início.
  const [draft, setDraft] = useState<DateRange | undefined>();

  const preset = useMemo(() => detectPreset(from, to), [from, to]);
  const currentYear = new Date().getFullYear();
  const yearFrom = fromYear ?? currentYear - 10;
  const yearTo = toYear ?? currentYear + 2;
  const MonthYearCaption = useMemo(() => makeMonthYearCaption(yearFrom, yearTo), [yearFrom, yearTo]);

  const triggerLabel =
    preset === "custom"
      ? from && to
        ? `${format(from, "dd/MM/yy")} – ${format(to, "dd/MM/yy")}`
        : "Personalizado"
      : labelForPreset(preset);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      // Ao abrir num intervalo personalizado, já mostra o calendário e retoma a
      // seleção atual; caso contrário começa pelos presets.
      const isCustom = detectPreset(from, to) === "custom";
      setShowCalendar(isCustom);
      setDraft(isCustom && from ? { from, to } : undefined);
    }
  };

  const applyPreset = (key: PeriodoPreset) => {
    if (key === "custom") {
      // Começa uma seleção nova, sem herdar o intervalo do preset anterior.
      setDraft(undefined);
      setShowCalendar(true);
      return;
    }
    const r = rangeForPreset(key);
    onChange(r.from, r.to);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("rounded-full h-9 px-3.5 text-[13px] font-normal gap-1.5", className)}
        >
          <CalendarDays size={14} className="text-black/50" />
          {triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto p-0">
        {showCalendar ? (
          <div className="p-2">
            <button
              type="button"
              onClick={() => setShowCalendar(false)}
              className="flex items-center gap-1 text-[13px] text-black/60 hover:text-ink px-1.5 py-1 rounded-lg hover:bg-black/[0.04] transition-colors"
            >
              <ChevronLeft size={15} />
              Voltar aos períodos
            </button>
            <Calendar
              mode="range"
              selected={draft}
              onSelect={(r) => {
                // Aplica na hora, mas não fecha: o usuário ajusta o intervalo à
                // vontade e fecha clicando fora (ou no botão do filtro).
                setDraft(r);
                onChange(r?.from, r?.to);
              }}
              numberOfMonths={numberOfMonths}
              defaultMonth={from ?? undefined}
              components={{ MonthCaption: MonthYearCaption, Nav: () => <span className="sr-only" /> }}
              locale={ptBR}
              autoFocus
            />
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 p-2 min-w-[188px]">
            {presets.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => applyPreset(key)}
                className={cn(
                  "text-left text-[13px] px-3 py-1.5 rounded-lg transition-colors",
                  preset === key
                    ? "bg-brand/15 text-ink font-medium"
                    : "text-black/70 hover:bg-black/[0.04]"
                )}
              >
                {labelForPreset(key)}
              </button>
            ))}
          </div>
        )}

        {footer && <div className="border-t border-black/5">{footer}</div>}
      </PopoverContent>
    </Popover>
  );
}
