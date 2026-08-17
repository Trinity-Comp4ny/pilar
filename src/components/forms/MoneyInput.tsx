import * as React from "react";

import { Input } from "@/components/ui/input";
import { formatCurrencyInput } from "@/lib/currencyUtils";
import { cn } from "@/lib/utils";

export interface MoneyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "inputMode"> {
  /**
   * Valor mascarado em reais (ex.: "R$ 1.234,56"). Guarde ESTA string no form e
   * converta com `parseCurrencyString` no submit (schema `valorCurrencyField`).
   */
  value: string;
  onChange: (maskedValue: string) => void;
}

/**
 * Campo de dinheiro (R$) padrão do Pilar. Dígitos entram como centavos
 * (`12345` → `R$ 123,45`), seguindo a convenção já usada nos forms financeiros.
 * Substitui o par repetido `<Input onChange={(e) => setValue(formatCurrencyInput(e.target.value))}>`.
 * Nunca use `type="number"` para dinheiro: ele rejeita "1.234,56" e mostra spinner.
 */
export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onChange, placeholder = "R$ 0,00", className, ...props }, ref) => (
    <Input
      ref={ref}
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(formatCurrencyInput(e.target.value))}
      placeholder={placeholder}
      className={cn("tabular-nums", className)}
      {...props}
    />
  )
);
MoneyInput.displayName = "MoneyInput";
