import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

// Persiste por navegador, não por empresa/usuário no banco: RBAC de quem PODE ver valor continua em usePermissions.
const STORAGE_KEY = "pilar:valores-ocultos";

function readStored(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "1";
}

interface ValoresOcultosValue {
  ocultos: boolean;
  toggle: () => void;
}

// Sem provider (ex.: teste isolado), mostra o valor real em vez de quebrar.
const DEFAULT_VALUE: ValoresOcultosValue = { ocultos: false, toggle: () => {} };

const ValoresOcultosContext = createContext<ValoresOcultosValue | null>(null);

export function ValoresOcultosProvider({ children }: { children: ReactNode }) {
  const [ocultos, setOcultos] = useState(readStored);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, ocultos ? "1" : "0");
  }, [ocultos]);

  const toggle = useCallback(() => setOcultos((v) => !v), []);

  return <ValoresOcultosContext.Provider value={{ ocultos, toggle }}>{children}</ValoresOcultosContext.Provider>;
}

export function useValoresOcultos(): ValoresOcultosValue {
  return useContext(ValoresOcultosContext) ?? DEFAULT_VALUE;
}
