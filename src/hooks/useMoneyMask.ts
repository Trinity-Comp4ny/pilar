import { useCallback } from "react";
import { useValoresOcultos } from "@/contexts/ValoresOcultosContext";
import { formatCurrency as formatCurrencyReal, type CurrencyOptions } from "@/lib/format";

const MASKED = "R$ ••••";

// Drop-in de tela para formatCurrency; NÃO usar em export (PDF/docx/comprovante/CSV), que mantém o valor real.
export function useMoneyMask() {
  const { ocultos } = useValoresOcultos();

  return useCallback(
    (value: number, opts?: CurrencyOptions) => (ocultos ? MASKED : formatCurrencyReal(value, opts)),
    [ocultos]
  );
}
