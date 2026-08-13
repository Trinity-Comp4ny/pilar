import * as React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "inputMode" | "min" | "max"> {
  /** String numérica guardada no form (ex.: "12", "3,5"). */
  value: string;
  onChange: (value: string) => void;
  /** Aceita vírgula/ponto decimal. Default: só inteiros. */
  allowDecimal?: boolean;
  /** Sufixo visual não editável (ex.: "%", "h", "dias"). */
  suffix?: string;
  min?: number;
  max?: number;
}

/**
 * Campo numérico (quantidade, parcelas, dias) com máscara própria, sem o
 * `type="number"` nativo (que traz spinner do SO e aceita "e", "+", "-").
 * Mantém a convenção de string no form; clampa em `min`/`max` na digitação.
 */
export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onChange, allowDecimal = false, suffix, min, max, className, placeholder = "0", ...props }, ref) => {
    const sanitize = (raw: string): string => {
      let clean = allowDecimal ? raw.replace(/[^\d.,]/g, "") : raw.replace(/\D/g, "");
      if (clean && (min != null || max != null)) {
        const n = allowDecimal ? parseFloat(clean.replace(",", ".")) : parseInt(clean, 10);
        if (!Number.isNaN(n)) {
          if (max != null && n > max) clean = String(max);
          if (min != null && n < min) clean = String(min);
        }
      }
      return clean;
    };

    const field = (
      <Input
        ref={ref}
        inputMode={allowDecimal ? "decimal" : "numeric"}
        value={value}
        onChange={(e) => onChange(sanitize(e.target.value))}
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
