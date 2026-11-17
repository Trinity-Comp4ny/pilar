import { useRef, useState } from "react";
import { format, parse, isValid, isBefore, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { mascararData, parseDataDigitada } from "@/lib/data-digitada";

interface DatePickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minDate?: string;
  maxDate?: string;
  className?: string;
  disabled?: boolean;
  captionLayout?: "label" | "dropdown";
  fromYear?: number;
  toYear?: number;
  id?: string;
  /** Mostra o "X" de limpar. `false` em data obrigatória: o campo nunca fica vazio pelo botão. */
  clearable?: boolean;
}

function parseIso(iso?: string): Date | undefined {
  if (!iso) return undefined;
  const d = parse(iso, "yyyy-MM-dd", new Date());
  return isValid(d) ? d : undefined;
}

function toIso(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

const ANOS_ANTES = 30;
const ANOS_DEPOIS = 15;

/**
 * Campo de data do app: digita direto (dd/mm/aaaa, com máscara) ou escolhe no
 * calendário. O calendário tem mês e ano em lista (não precisa clicar mês a mês
 * para trocar de ano) e altura fixa de 6 semanas, para as setas não mudarem de
 * lugar ao navegar (feedback 99f163e4).
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "Selecione",
  minDate,
  maxDate,
  className,
  disabled,
  captionLayout = "dropdown",
  fromYear,
  toYear,
  id,
  clearable = true,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const conteudoRef = useRef<HTMLDivElement>(null);
  // Por que a última digitação não valeu (erro inline, ADR 0008: nada de toast em validação).
  const [erro, setErro] = useState<string | null>(null);

  const selected = parseIso(value);
  const fromDate = parseIso(minDate);
  const toDate = parseIso(maxDate);
  const displayValue = selected ? format(selected, "dd/MM/yyyy") : "";

  // Rascunho só vale durante a digitação; fora dela o campo mostra o valor gravado.
  const [rascunho, setRascunho] = useState("");
  const texto = editando ? rascunho : displayValue;
  const [mes, setMes] = useState<Date>(selected ?? fromDate ?? new Date());

  const anoAtual = new Date().getFullYear();
  const startMonth = fromDate ?? new Date(fromYear ?? anoAtual - ANOS_ANTES, 0);
  const endMonth = toDate ?? new Date(toYear ?? anoAtual + ANOS_DEPOIS, 11);

  const foraDoIntervalo = (d: Date) => (fromDate && isBefore(d, fromDate)) || (toDate && isAfter(d, toDate));

  const abrir = () => {
    if (disabled || open) return;
    setMes(selected ?? fromDate ?? new Date());
    setOpen(true);
  };

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const hojePermitido = !foraDoIntervalo(hoje);

  const escolher = (data: Date | undefined) => {
    setErro(null);
    onChange(data ? toIso(data) : "");
    setEditando(false);
    setOpen(false);
  };

  /**
   * Confirma o que foi digitado. Data inválida ou fora do limite volta ao valor anterior
   * e diz o porquê (não some em silêncio).
   */
  const confirmarTexto = () => {
    setEditando(false);
    if (!texto.trim()) {
      if (value) onChange("");
      return;
    }
    if (texto === displayValue) return;
    const data = parseDataDigitada(texto);
    if (!data) {
      setErro(`"${texto}" não é uma data válida. Use dia/mês/ano.`);
      return;
    }
    if (fromDate && isBefore(data, fromDate)) {
      setErro(`A data precisa ser a partir de ${format(fromDate, "dd/MM/yyyy")}.`);
      return;
    }
    if (toDate && isAfter(data, toDate)) {
      setErro(`A data precisa ser até ${format(toDate, "dd/MM/yyyy")}.`);
      return;
    }
    const iso = toIso(data);
    if (iso !== value) onChange(iso);
  };

  /** Seta para baixo leva o foco ao calendário (setas andam nos dias, Enter escolhe). */
  const focarCalendario = () => {
    const raiz = conteudoRef.current;
    const alvo =
      raiz?.querySelector<HTMLButtonElement>("[data-selected] button") ??
      raiz?.querySelector<HTMLButtonElement>("[data-today] button:not([disabled])") ??
      raiz?.querySelector<HTMLButtonElement>("[role=gridcell] button:not([disabled])");
    alvo?.focus();
  };

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div
            ref={wrapperRef}
            data-slot="date-picker"
            className={cn(
              "flex h-10 w-full items-center rounded-md border border-input bg-background px-3 text-sm",
              "focus-within:outline-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
              disabled && "cursor-not-allowed opacity-50",
              className
            )}
          >
            <button
              type="button"
              tabIndex={-1}
              disabled={disabled}
              onClick={() => (open ? setOpen(false) : abrir())}
              aria-label="Abrir calendário"
              className="mr-1.5 shrink-0 text-muted-foreground disabled:cursor-not-allowed"
            >
              <CalendarIcon className="h-4 w-4 opacity-70" />
            </button>
            <input
              id={id}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              aria-invalid={!!erro}
              disabled={disabled}
              value={texto}
              placeholder={editando ? "dd/mm/aaaa" : placeholder}
              maxLength={10}
              // Abre o calendário no clique, não no foco: passar pelo campo com Tab (ou o
              // foco inicial de um dialog) não deve estourar um calendário na tela.
              onFocus={(e) => {
                setRascunho(displayValue);
                setEditando(true);
                // Selecionado, digitar uma data nova substitui a anterior de uma vez.
                e.currentTarget.select();
              }}
              onClick={abrir}
              onChange={(e) => {
                const mascarado = mascararData(e.target.value);
                setRascunho(mascarado);
                setEditando(true);
                setErro(null);
                const data = parseDataDigitada(mascarado);
                if (data && mascarado.length === 10) setMes(data);
              }}
              onBlur={confirmarTexto}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirmarTexto();
                  setOpen(false);
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  if (!open) abrir();
                  // O calendário monta no próximo frame quando acabou de abrir.
                  requestAnimationFrame(focarCalendario);
                }
              }}
              className={cn(
                "h-full min-w-0 flex-1 bg-transparent outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed",
                displayValue && !disabled && "pr-4"
              )}
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          ref={conteudoRef}
          className="w-auto max-w-[calc(100vw-2rem)] p-0"
          align="start"
          collisionPadding={12}
          // O foco fica no campo para a pessoa poder digitar com o calendário aberto.
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          // Clicar no próprio campo não é "clicar fora".
          onInteractOutside={(e) => {
            if (wrapperRef.current?.contains(e.target as Node)) e.preventDefault();
          }}
        >
          <Calendar
            mode="single"
            selected={selected}
            onSelect={escolher}
            month={mes}
            onMonthChange={setMes}
            startMonth={startMonth}
            endMonth={endMonth}
            disabled={[...(fromDate ? [{ before: fromDate }] : []), ...(toDate ? [{ after: toDate }] : [])]}
            captionLayout={captionLayout}
            fixedWeeks
            locale={ptBR}
          />
          {hojePermitido && (
            <div className="flex justify-end border-t px-3 py-2">
              <Button type="button" variant="ghost" size="xs" className="px-2" onClick={() => escolher(hoje)}>
                Hoje
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      {clearable && displayValue && !disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setEditando(false);
            onChange("");
          }}
          aria-label="Limpar data"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {erro && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {erro}
        </p>
      )}
    </div>
  );
}
