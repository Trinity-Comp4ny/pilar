import {
  endOfMonth,
  endOfQuarter,
  endOfYear,
  isSameDay,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subDays,
  subMonths,
  subQuarters,
} from "date-fns";

// Fonte única dos presets de período (spec 024, ampliada na 025). Antes a conversão
// preset→datas vivia duplicada em PeriodoPopover (rangeForPreset), em
// lancamentosFilters (periodoRange) e em Relatorios (applyPreset). Aqui é um só.

export type PeriodoPreset =
  | "mes-atual"
  | "mes-anterior"
  | "ultimos-7"
  | "ultimos-30"
  | "este-trimestre"
  | "trimestre-passado"
  | "este-ano"
  | "tudo"
  | "custom";

export interface PeriodoPresetDef {
  key: PeriodoPreset;
  label: string;
}

export const PERIODO_PRESETS: PeriodoPresetDef[] = [
  { key: "mes-atual", label: "Este mês" },
  { key: "mes-anterior", label: "Mês passado" },
  { key: "ultimos-7", label: "Últimos 7 dias" },
  { key: "ultimos-30", label: "Últimos 30 dias" },
  { key: "este-trimestre", label: "Este trimestre" },
  { key: "trimestre-passado", label: "Trimestre passado" },
  { key: "este-ano", label: "Este ano" },
  { key: "tudo", label: "Todo o período" },
  { key: "custom", label: "Personalizado" },
];

export interface PeriodoRange {
  from: Date | undefined;
  to: Date | undefined;
}

/**
 * Converte um preset num intervalo de datas. "tudo" (sem filtro) e "custom" (o
 * usuário escolhe) retornam { undefined, undefined }; quem chama trata o resto.
 * `now` é injetável para testes determinísticos.
 */
export function rangeForPreset(preset: PeriodoPreset, now: Date = new Date()): PeriodoRange {
  switch (preset) {
    case "mes-atual":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "mes-anterior": {
      const last = subMonths(now, 1);
      return { from: startOfMonth(last), to: endOfMonth(last) };
    }
    case "ultimos-7":
      return { from: subDays(now, 6), to: now };
    case "ultimos-30":
      return { from: subDays(now, 30), to: now };
    case "este-trimestre":
      return { from: startOfQuarter(now), to: endOfQuarter(now) };
    case "trimestre-passado": {
      const last = subQuarters(now, 1);
      return { from: startOfQuarter(last), to: endOfQuarter(last) };
    }
    case "este-ano":
      return { from: startOfYear(now), to: endOfYear(now) };
    case "tudo":
    case "custom":
      return { from: undefined, to: undefined };
  }
}

/**
 * Descobre qual preset corresponde a um par de datas. Sem nenhuma data = "tudo";
 * só uma das pontas = "custom"; casou com um preset relativo = esse preset.
 */
export function detectPreset(from: Date | undefined, to: Date | undefined, now: Date = new Date()): PeriodoPreset {
  if (!from && !to) return "tudo";
  if (!from || !to) return "custom";
  const matches = (key: Exclude<PeriodoPreset, "tudo" | "custom">) => {
    const r = rangeForPreset(key, now);
    return !!r.from && !!r.to && isSameDay(r.from, from) && isSameDay(r.to, to);
  };
  if (matches("mes-atual")) return "mes-atual";
  if (matches("mes-anterior")) return "mes-anterior";
  if (matches("ultimos-7")) return "ultimos-7";
  if (matches("ultimos-30")) return "ultimos-30";
  if (matches("este-trimestre")) return "este-trimestre";
  if (matches("trimestre-passado")) return "trimestre-passado";
  if (matches("este-ano")) return "este-ano";
  return "custom";
}

export function labelForPreset(key: PeriodoPreset): string {
  return PERIODO_PRESETS.find((p) => p.key === key)?.label ?? "Período";
}
