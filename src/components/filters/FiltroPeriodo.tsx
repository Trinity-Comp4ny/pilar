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
import { mascararData, parseDataDigitada } from "@/lib/data-digitada";
import { makeMonthYearCaption } from "./CalendarCaption";
import { filterTriggerClass } from "./filterStyles";

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
  /** Pinta o gatilho de verde quando o período difere do padrão da tela. */
  active?: boolean;
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
  active = false,
  className,
}: FiltroPeriodoProps) {
  const [open, setOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  // Seleção de trabalho do calendário, desacoplada do valor semântico. Assim,
  // entrar no "Personalizado" começa limpo (1º clique = início, 2º = fim) em vez
  // de herdar o intervalo do preset e travar o início.
  const [draft, setDraft] = useState<DateRange | undefined>();
  const [mes, setMes] = useState<Date>(from ?? new Date());

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
      setMes(from ?? new Date());
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
        <Button variant="outline" className={filterTriggerClass(active, className)}>
          <CalendarDays size={14} className={cn(!active && "text-black/50")} />
          {triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto p-0">
        {showCalendar ? (
          <div className="p-2">
            <button
              type="button"
              onClick={() => setShowCalendar(false)}
              className="flex items-center gap-1 text-[13px] text-black/60 hover:text-ink px-1.5 py-1 rounded-lg hover:bg-black/4 transition-colors"
            >
              <ChevronLeft size={15} />
              Voltar aos períodos
            </button>
            <div className="flex gap-2 px-1.5 pb-1 pt-2">
              <CampoDataDigitada
                rotulo="De"
                valor={draft?.from}
                onConfirmar={(d) => {
                  const r = { from: d, to: draft?.to && d && draft.to < d ? undefined : draft?.to };
                  setDraft(r);
                  if (d) setMes(d);
                  onChange(r.from, r.to);
                }}
              />
              <CampoDataDigitada
                rotulo="Até"
                valor={draft?.to}
                onConfirmar={(d) => {
                  const r = { from: draft?.from && d && d < draft.from ? d : draft?.from, to: d };
                  setDraft(r);
                  onChange(r.from, r.to);
                }}
              />
            </div>
            <Calendar
              mode="range"
              selected={draft}
              month={mes}
              onMonthChange={setMes}
              onSelect={(r) => {
                // Aplica na hora, mas não fecha: o usuário ajusta o intervalo à
                // vontade e fecha clicando fora (ou no botão do filtro).
                setDraft(r);
                onChange(r?.from, r?.to);
              }}
              numberOfMonths={numberOfMonths}
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
                  preset === key ? "bg-brand/15 text-ink font-medium" : "text-black/70 hover:bg-black/4"
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

/**
 * Data digitável do intervalo personalizado (dd/mm/aaaa, com máscara). Confirma ao sair
 * do campo ou com Enter; data inválida volta ao que estava.
 */
function CampoDataDigitada({
  rotulo,
  valor,
  onConfirmar,
}: {
  rotulo: string;
  valor: Date | undefined;
  onConfirmar: (d: Date | undefined) => void;
}) {
  const [rascunho, setRascunho] = useState<string | null>(null);
  const exibido = valor ? format(valor, "dd/MM/yyyy") : "";
  const texto = rascunho ?? exibido;

  const confirmar = () => {
    setRascunho(null);
    if (rascunho === null || rascunho === exibido) return;
    if (!rascunho.trim()) return onConfirmar(undefined);
    const d = parseDataDigitada(rascunho);
    if (d) onConfirmar(d);
  };

  return (
    <label className="min-w-0 flex-1 space-y-0.5">
      <span className="block text-2xs text-muted-foreground">{rotulo}</span>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/aaaa"
        maxLength={10}
        size={10}
        value={texto}
        onChange={(e) => setRascunho(mascararData(e.target.value))}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            confirmar();
          }
        }}
        className="h-8 w-full rounded-md border border-input bg-background px-2 text-[13px] outline-hidden placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
  );
}
