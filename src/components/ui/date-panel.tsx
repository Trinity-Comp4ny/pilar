import { useState } from "react";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { mascararData, parseDataDigitada } from "@/lib/data-digitada";

interface DatePanelProps {
  value?: Date;
  onSelect: (date: Date) => void;
  /** Com ele, aparece "Limpar" no rodapé. */
  onClear?: () => void;
  clearLabel?: string;
}

const ATALHOS = [
  { label: "Hoje", dias: 0 },
  { label: "Amanhã", dias: 1 },
  { label: "Em 1 semana", dias: 7 },
] as const;

/**
 * Painel de data para gatilhos compactos (chip de prazo numa lista, célula de tabela):
 * o gatilho não é um campo, então o campo digitável vem dentro do painel, em cima do
 * calendário, com atalhos de prazo. Campo de formulário usa `DatePicker`, não isto.
 */
export function DatePanel({ value, onSelect, onClear, clearLabel = "Limpar" }: DatePanelProps) {
  const [texto, setTexto] = useState(value ? format(value, "dd/MM/yyyy") : "");
  const [invalido, setInvalido] = useState(false);
  const [mes, setMes] = useState<Date>(value ?? new Date());
  const anoAtual = new Date().getFullYear();

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const confirmar = () => {
    const data = parseDataDigitada(texto);
    if (!data) {
      setInvalido(true);
      return;
    }
    onSelect(data);
  };

  return (
    <div className="w-[17.5rem] max-w-full">
      <div className="space-y-2 border-b p-3">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          // Já vem com a data atual: selecionada, digitar substitui em vez de esbarrar no limite.
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Digitar data"
          aria-invalid={invalido}
          placeholder="dd/mm/aaaa"
          maxLength={10}
          value={texto}
          onChange={(e) => {
            const mascarado = mascararData(e.target.value);
            setTexto(mascarado);
            setInvalido(false);
            const data = parseDataDigitada(mascarado);
            if (data && mascarado.length === 10) setMes(data);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              confirmar();
            }
          }}
          className={cn(
            "h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-hidden placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring",
            invalido && "border-destructive focus-visible:ring-destructive"
          )}
        />
        {invalido && <p className="text-xs text-destructive">Data inválida. Use dia/mês/ano.</p>}
        <div className="flex flex-wrap gap-1">
          {ATALHOS.map((a) => (
            <Button
              key={a.label}
              type="button"
              variant="outline"
              size="xs"
              className="px-2"
              onClick={() => onSelect(addDays(hoje, a.dias))}
            >
              {a.label}
            </Button>
          ))}
        </div>
      </div>
      <Calendar
        mode="single"
        selected={value}
        onSelect={(d) => d && onSelect(d)}
        month={mes}
        onMonthChange={setMes}
        startMonth={new Date(anoAtual - 30, 0)}
        endMonth={new Date(anoAtual + 15, 11)}
        captionLayout="dropdown"
        fixedWeeks
        locale={ptBR}
      />
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="w-full border-t px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted"
        >
          {clearLabel}
        </button>
      )}
    </div>
  );
}
