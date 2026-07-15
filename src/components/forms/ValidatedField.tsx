import { useState } from "react";
import type { ReactNode } from "react";
import { AlertCircle, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ValidatedFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  maxLength?: number;
  /** Validador rodado no onBlur. Retorna mensagem de erro ou null. */
  onValidate?: (value: string) => string | null;
  /** Erro externo (ex.: validação de servidor). Tem precedência sobre o onBlur. */
  error?: string | null;
  /** Mostra o check verde quando o valor é não-vazio e válido. Padrão: true se houver onValidate. */
  showSuccess?: boolean;
  /**
   * Aviso não-bloqueante exibido abaixo do campo (ex.: "e-mail pessoal").
   * Não impede o envio; apenas sinaliza.
   */
  hint?: ReactNode;
}

/**
 * Campo de form controlado com validação no onBlur, estado de sucesso (check verde)
 * e acessibilidade (aria-invalid / aria-describedby / role="alert" no erro).
 *
 * Complementa o shadcn Form: use quando quiser validação inline por campo sem
 * montar um react-hook-form completo.
 */
export function ValidatedField({
  label,
  name,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
  autoComplete,
  maxLength,
  onValidate,
  error,
  showSuccess,
  hint,
}: ValidatedFieldProps) {
  const id = `field-${name}`;
  const [touched, setTouched] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const displayError = (error && error.length > 0 ? error : null) ?? (touched ? localError : null);
  const isValid = !!value.trim() && !displayError && touched && (showSuccess ?? !!onValidate);

  const handleBlur = () => {
    setTouched(true);
    if (onValidate) {
      setLocalError(onValidate(value));
    } else if (required && !value.trim()) {
      setLocalError("Campo obrigatório");
    } else {
      setLocalError(null);
    }
  };

  const handleChange = (next: string) => {
    onChange(next);
    // Revalida enquanto digita apenas se já havia um erro (não incomoda antes do 1º blur).
    if (touched && localError) {
      setLocalError(onValidate ? onValidate(next) : null);
    }
  };

  const describedBy = [displayError ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          required={required}
          placeholder={placeholder}
          autoComplete={autoComplete}
          maxLength={maxLength}
          aria-invalid={!!displayError}
          aria-describedby={describedBy || undefined}
          className={cn(
            isValid && "pr-9",
            displayError && "border-destructive focus-visible:ring-destructive/40",
            isValid && "border-positive focus-visible:ring-positive/40",
          )}
        />
        {isValid && (
          <Check
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-positive"
            aria-hidden
          />
        )}
      </div>
      {displayError && (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {displayError}
        </p>
      )}
      {hint && !displayError && (
        <p id={`${id}-hint`} className="flex items-center gap-1 text-xs text-warning-mid">
          <AlertCircle className="h-3 w-3 flex-shrink-0" aria-hidden />
          {hint}
        </p>
      )}
    </div>
  );
}
