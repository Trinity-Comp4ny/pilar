import { createContext, Dispatch, ReactNode, SetStateAction } from "react";

export type Visualizacao = "dia" | "mes";

export interface FinanceFilterContextValue {
  dateFrom: Date | undefined;
  setDateFrom: Dispatch<SetStateAction<Date | undefined>>;
  dateTo: Date | undefined;
  setDateTo: Dispatch<SetStateAction<Date | undefined>>;
  visualizacao: Visualizacao;
  setVisualizacao: Dispatch<SetStateAction<Visualizacao>>;
}

export const FinanceFilterContext = createContext<FinanceFilterContextValue | null>(null);

interface FinanceFilterProviderProps {
  value: FinanceFilterContextValue;
  children: ReactNode;
}

export function FinanceFilterProvider({ value, children }: FinanceFilterProviderProps) {
  return <FinanceFilterContext.Provider value={value}>{children}</FinanceFilterContext.Provider>;
}
