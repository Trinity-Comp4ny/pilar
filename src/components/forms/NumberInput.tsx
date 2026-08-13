import * as React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "inputMode" | "min" | "max"> {
  /** String numérica guardada no form (ex.: "12", "3,5"). Aceita pai que guarda número. */
  value: string;
  onChange: (value: string) => void;
  /** Aceita vírgula/ponto decimal. Default: só inteiros. */
  allowDecimal?: boolean;
  /** Sufixo visual não editável (ex.: "%", "h", "dias"). */
  suffix?: string;
  min?: number;
  max?: number;
}

/** Número que a string representa, para comparar o buffer local com o value do pai. */
function toNum(s: string, allowDecimal: boolean): number {
  if (!s) return NaN;
  return allowDecimal ? parseFloat(s.replace(",", ".")) : parseInt(s, 10);
}

/**
 * Campo numérico (quantidade, parcelas, dias, percentual) com máscara própria,
 * sem o `type="number"` nativo (spinner do SO, aceita "e"/"+"/"-").
 *
 * Guarda um buffer local do que o usuário digitou. Isso é o que permite usar em
 * um pai que armazena NÚMERO: sem o buffer, digitar "3," faria o pai normalizar
 * para 3 e devolver "3", apagando a vírgula no meio da digitação. O buffer só
 * ressincroniza quando o value externo representa OUTRO número (ex.: reset).
 */
export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onChange, allowDecimal = false, suffix, min, max, className, placeholder = "0", ...props }, ref) => {
    const [buffer, setBuffer] = React.useState(value);
    const prevValue = React.useRef(value);

    // Padrão React "ajustar estado ao mudar a prop": reconcilia durante o render,
    // sem useEffect. Mantém o buffer quando o value do pai é o MESMO número.
    if (value !== prevValue.current) {
      prevValue.current = value;
      const same = !Number.isNaN(toNum(value, allowDecimal)) && toNum(value, allowDecimal) === toNum(buffer, allowDecimal);
      if (value !== buffer && !same) setBuffer(value);
    }

    const handleChange = (raw: string): void => {
      let clean = allowDecimal ? raw.replace(/[^\d.,]/g, "") : raw.replace(/\D/g, "");
      if (clean && (min != null || max != null)) {
        const n = toNum(clean, allowDecimal);
        if (!Number.isNaN(n)) {
          if (max != null && n > max) clean = String(max);
          if (min != null && n < min) clean = String(min);
        }
      }
      setBuffer(clean);
      onChange(clean);
    };

    const field = (
      <Input
        ref={ref}
        inputMode={allowDecimal ? "decimal" : "numeric"}
        value={buffer}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className={cn("tabular-nums", suffix && "pr-9", className)}
        {...props}
      />
    );

    if (!suffix) return field;

    return (
      <div className="relative">
        {field}
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
          {suffix}
        </span>
      </div>
    );
  }
);
NumberInput.displayName = "NumberInput";
