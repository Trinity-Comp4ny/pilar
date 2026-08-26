import { useEffect, useState } from "react";

function ler(key: string, defaultOpen: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultOpen;
    return raw === "1";
  } catch {
    return defaultOpen;
  }
}

/** Estado aberto/fechado de uma seção colapsável, lembrado por navegador (ex.: faixa de KPIs). */
export function usePersistedOpen(key: string, defaultOpen = true) {
  const storageKey = `pilar.collapsible.${key}`;
  const [open, setOpen] = useState(() => ler(storageKey, defaultOpen));

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, open ? "1" : "0");
    } catch {
      // localStorage indisponível (modo privado): sem persistência, sem erro.
    }
  }, [storageKey, open]);

  return [open, setOpen] as const;
}
