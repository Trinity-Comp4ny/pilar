import { useEffect, useState } from "react";

/**
 * Retorna o valor com atraso: só atualiza depois de `delayMs` sem mudanças.
 * Útil para não disparar busca a cada tecla.
 */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
