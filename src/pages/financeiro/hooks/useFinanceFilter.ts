import { useContext } from "react";
import { FinanceFilterContext, FinanceFilterContextValue } from "../contexts/FinanceFilterContext";

export function useFinanceFilter(): FinanceFilterContextValue {
  const ctx = useContext(FinanceFilterContext);
  if (!ctx) {
    throw new Error("useFinanceFilter deve ser usado dentro de um FinanceFilterProvider");
  }
  return ctx;
}
