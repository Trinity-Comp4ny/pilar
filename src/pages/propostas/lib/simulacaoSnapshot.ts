import type { Json } from "@/integrations/supabase/types";
import type { SimulacaoMargem } from "../components/CalculadoraMargem";
import type { ConfigComercial } from "../hooks/useConfigComercial";
import { margemLiquidaPct, taxaDoMeio } from "@/lib/margemLiquida";

/** Monta o snapshot gravado em propostas.dados_simulacao (SPEC 168). */
export const montarSnapshot = (
  sim: SimulacaoMargem,
  precoTabela: number,
  custo: number,
  config: ConfigComercial
): Json => {
  const meio = config.meiosRecebimento.find((m) => m.id === sim.meioId);
  const taxaPct = taxaDoMeio(meio, sim.parcelas);
  const precoFinal = Math.round(precoTabela * (1 - sim.descontoPct / 100) * 100) / 100;
  return {
    impostoPct: sim.impostoPct,
    meioId: sim.meioId,
    parcelas: sim.parcelas,
    taxaPct,
    margemAlvoPct: sim.margemAlvoPct,
    margemMinimaPct: config.margemMinimaPct,
    descontoPct: sim.descontoPct,
    precoTabela,
    custo,
    margemLiquidaPct: margemLiquidaPct(precoFinal, custo, { impostoPct: sim.impostoPct, taxaPct }),
  };
};

/** Lê o snapshot gravado; null quando ausente ou malformado. */
export const lerSimulacao = (
  raw: Json | null | undefined
): { simulacao: SimulacaoMargem; precoTabela: number | null; custo: number | null } | null => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, Json>;
  if (typeof r.impostoPct !== "number" || typeof r.margemAlvoPct !== "number") return null;
  return {
    simulacao: {
      impostoPct: r.impostoPct,
      meioId: typeof r.meioId === "string" ? r.meioId : "",
      parcelas: typeof r.parcelas === "number" ? r.parcelas : 1,
      margemAlvoPct: r.margemAlvoPct,
      descontoPct: typeof r.descontoPct === "number" ? r.descontoPct : 0,
    },
    precoTabela: typeof r.precoTabela === "number" ? r.precoTabela : null,
    custo: typeof r.custo === "number" ? r.custo : null,
  };
};
