/**
 * Cálculo de totais do editor de disciplinas de propostas.
 *
 * Cada linha tem horas, custo/hora e valor de venda. O custo de uma linha é
 * horas x custo/hora; o valor de venda é digitado direto. A soma dos valores
 * de venda é o valor sugerido para a proposta.
 */

export interface DisciplinaLinha {
  id: string;
  disciplina: string;
  horas_estimadas: number;
  custo_hora: number;
  valor_venda: number;
}

export interface DisciplinasTotais {
  totalHoras: number;
  totalCusto: number;
  totalValor: number;
  /** Margem sobre o valor de venda (null quando não há venda). */
  margemPct: number | null;
}

/** Custo de uma linha: horas x custo/hora. */
export const custoLinha = (linha: Pick<DisciplinaLinha, "horas_estimadas" | "custo_hora">): number =>
  (Number(linha.horas_estimadas) || 0) * (Number(linha.custo_hora) || 0);

/** Soma os totais de horas, custo, valor de venda e a margem derivada. */
export const calcDisciplinasTotais = (linhas: DisciplinaLinha[]): DisciplinasTotais => {
  const totais = linhas.reduce(
    (acc, l) => {
      acc.totalHoras += Number(l.horas_estimadas) || 0;
      acc.totalCusto += custoLinha(l);
      acc.totalValor += Number(l.valor_venda) || 0;
      return acc;
    },
    { totalHoras: 0, totalCusto: 0, totalValor: 0 }
  );

  const margemPct =
    totais.totalValor > 0 ? ((totais.totalValor - totais.totalCusto) / totais.totalValor) * 100 : null;

  return { ...totais, margemPct };
};

/** true quando o valor manual diverge da soma das disciplinas (tolerância de 1 centavo). */
export const valorDivergeDaSoma = (valorManual: number, totalValor: number): boolean =>
  totalValor > 0 && Math.abs((Number(valorManual) || 0) - totalValor) > 0.01;
