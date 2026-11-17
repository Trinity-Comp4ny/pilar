// Semáforo de custo da obra para o card da lista: compara quanto já se gastou do orçado com quanto da obra
// já andou. Gastar 50% do orçado com 50% de avanço é saudável; gastar 80% com 40% de avanço é alerta.

export type SemaforoCusto = "verde" | "amarelo" | "vermelho";

export interface ResumoCusto {
  previsto: number;
  realizado: number;
}

export interface LeituraCusto {
  semaforo: SemaforoCusto;
  /** Realizado ÷ previsto, em %, arredondado. Pode passar de 100. */
  gastoPct: number;
  /** Gasto % − avanço %, em pontos. Positivo = gastando mais rápido do que a obra anda. */
  desvioPontos: number;
}

/** Margem (em pontos) entre gasto e avanço antes de acender amarelo e vermelho. */
const MARGEM_AMARELO = 5;
const MARGEM_VERMELHO = 15;

/** Sem orçado definido não há o que comparar: devolve null e o card não mostra nada. */
export function lerCusto(resumo: ResumoCusto | undefined, avancoPct: number): LeituraCusto | null {
  if (!resumo || resumo.previsto <= 0) return null;
  const gastoPct = Math.round((resumo.realizado / resumo.previsto) * 100);
  const desvioPontos = gastoPct - avancoPct;
  const estourou = resumo.realizado > resumo.previsto;
  const semaforo: SemaforoCusto =
    estourou || desvioPontos > MARGEM_VERMELHO ? "vermelho" : desvioPontos > MARGEM_AMARELO ? "amarelo" : "verde";
  return { semaforo, gastoPct, desvioPontos };
}
