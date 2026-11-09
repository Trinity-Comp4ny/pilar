import { addDays, format, parseISO } from "date-fns";
import type { LancamentosFilters } from "./lancamentosFilters";
import type { BaldePosicao } from "../hooks/useTitulosPosicao";

/**
 * Filtro que cada chip de posição aplica. Usa a mesma regra do balde em
 * get_titulos_posicao, para o número do chip bater com a lista ao clicar.
 */
export function filtroDoBalde(balde: BaldePosicao, hojeISO: string, atual: LancamentosFilters): LancamentosFilters {
  const hoje = parseISO(hojeISO);
  const d = (n: number) => format(addDays(hoje, n), "yyyy-MM-dd");
  const base = { ...atual, customFrom: null, customTo: null };
  switch (balde) {
    case "vencidos":
      return { ...base, status: "atrasados", periodo: "tudo" };
    case "hoje":
      return { ...base, status: "pendentes", periodo: "custom", customFrom: hojeISO, customTo: hojeISO };
    case "semana":
      return { ...base, status: "pendentes", periodo: "custom", customFrom: d(1), customTo: d(7) };
    case "futuro":
      return { ...base, status: "pendentes", periodo: "custom", customFrom: d(8), customTo: null };
    case "pagos_mes":
      return { ...base, status: "pagos", periodo: "mes-atual" };
  }
}

/** Qual chip está ativo para os filtros atuais (null se nenhum casa exatamente). */
export function baldeAtivo(f: LancamentosFilters, hojeISO: string): BaldePosicao | null {
  if (!hojeISO) return null;
  const baldes: BaldePosicao[] = ["vencidos", "hoje", "semana", "futuro", "pagos_mes"];
  for (const b of baldes) {
    const alvo = filtroDoBalde(b, hojeISO, f);
    if (
      alvo.status === f.status &&
      alvo.periodo === f.periodo &&
      (alvo.customFrom ?? null) === (f.customFrom ?? null) &&
      (alvo.customTo ?? null) === (f.customTo ?? null)
    )
      return b;
  }
  return null;
}
