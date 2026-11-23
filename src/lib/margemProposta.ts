import { semaforoMargem, type SemaforoMargem } from "./margemLiquida";

/**
 * Margem líquida e semáforo que a proposta prometeu, lidos do snapshot. Usado no lead e no
 * projeto. Null quando a proposta não tem simulação (a margem simples segue valendo).
 */
export const resumoMargemProposta = (
  raw: unknown
): { margemPct: number; alvoPct: number; semaforo: SemaforoMargem } | null => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.margemLiquidaPct !== "number" || typeof r.margemAlvoPct !== "number") return null;
  const minima = typeof r.margemMinimaPct === "number" ? r.margemMinimaPct : 0;
  const semaforo = semaforoMargem(r.margemLiquidaPct, r.margemAlvoPct, minima);
  return semaforo ? { margemPct: r.margemLiquidaPct, alvoPct: r.margemAlvoPct, semaforo } : null;
};
