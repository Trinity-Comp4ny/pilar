// Custo no Gantt: o desembolso previsto e o gasto em cada coluna da linha do tempo (mês ou semana).
//
// O PREVISTO não é calculado aqui: vem do físico-financeiro (spec 165, `montarFisicoFinanceiro`), a mesma conta da
// grade da aba Financeiro, inclusive o ajuste manual por mês. Assim o Gantt e a grade nunca divergem. Este arquivo
// só reparte o total de cada mês entre as colunas do Gantt: no zoom em meses é o próprio total; em semanas, cada dia
// leva 1/dias-do-mês do total do mês dele.
import type { FisicoFinanceiro } from "./fisicoFinanceiro";

export interface ColunaIso {
  /** Primeiro dia da coluna (aaaa-mm-dd), inclusive. */
  inicio: string;
  /** Último dia da coluna, inclusive. */
  fim: string;
}

export interface CustoPorColuna {
  previsto: number[];
  realizado: number[];
  /** Previsto de itens sem período (do físico-financeiro): não cabe em nenhuma coluna. */
  previstoSemData: number;
  /** Despesa com data fora da linha do tempo. */
  realizadoForaDaLinha: number;
}

const DIA_MS = 86_400_000;
const diaDe = (iso: string) => Math.floor(new Date(`${iso}T00:00:00Z`).getTime() / DIA_MS);
const isoDe = (dia: number) => new Date(dia * DIA_MS).toISOString().slice(0, 10);
const diasNoMes = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();

export function desembolsoPorColuna(
  ff: Pick<FisicoFinanceiro, "totalPorMes" | "semData">,
  despesas: ReadonlyArray<{ data: string; valor: number }>,
  colunas: ReadonlyArray<ColunaIso>
): CustoPorColuna {
  const faixas = colunas.map((c) => [diaDe(c.inicio), diaDe(c.fim)] as const);
  const previsto = colunas.map(() => 0);
  const realizado = colunas.map(() => 0);
  let realizadoForaDaLinha = 0;

  // Dia a dia: o total do mês entra nas colunas pelos dias que elas cobrem desse mês.
  faixas.forEach(([ini, fim], i) => {
    for (let d = ini; d <= fim; d++) {
      const iso = isoDe(d);
      const total = ff.totalPorMes[iso.slice(0, 7)];
      if (!total) continue;
      previsto[i] += total / diasNoMes(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)));
    }
  });

  for (const d of despesas) {
    const x = diaDe(d.data);
    const i = faixas.findIndex(([ini, fim]) => x >= ini && x <= fim);
    if (i === -1) realizadoForaDaLinha += d.valor;
    else realizado[i] += d.valor;
  }

  return { previsto, realizado, previstoSemData: ff.semData.valor, realizadoForaDaLinha };
}
