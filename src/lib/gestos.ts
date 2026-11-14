/** Regras puras dos gestos de arrastar (linha deslizável e sheet). Testáveis sem DOM de toque. */

/** Deslocamento mínimo (px) para o gesto ser tratado como arrasto horizontal, não toque. */
export const TRAVA_ARRASTO = 10;
/** Fração da largura da ação a partir da qual soltar confirma a ação. */
export const FRACAO_CONFIRMA = 0.6;

/** O gesto é mais horizontal que vertical? Decide se a linha desliza ou a página rola. */
export function ehHorizontal(dx: number, dy: number): boolean {
  return Math.abs(dx) > TRAVA_ARRASTO && Math.abs(dx) > Math.abs(dy) * 1.3;
}

/** Limita o deslocamento da linha ao que há de ação de cada lado, com leve resistência além. */
export function limitarDeslize(dx: number, larguraEsq: number, larguraDir: number): number {
  if (dx > 0) return larguraEsq === 0 ? 0 : Math.min(dx, larguraEsq * 1.25);
  return larguraDir === 0 ? 0 : Math.max(dx, -larguraDir * 1.25);
}

export type DecisaoDeslize = "esquerda" | "direita" | "volta";

/**
 * Ao soltar: passou do limiar, executa a ação daquele lado. `dx > 0` revela a ação da esquerda
 * (arrastou para a direita); `dx < 0` revela a da direita.
 */
export function decidirDeslize(dx: number, larguraEsq: number, larguraDir: number): DecisaoDeslize {
  if (dx > 0 && larguraEsq > 0 && dx >= larguraEsq * FRACAO_CONFIRMA) return "esquerda";
  if (dx < 0 && larguraDir > 0 && -dx >= larguraDir * FRACAO_CONFIRMA) return "direita";
  return "volta";
}

/** Sheet de baixo: fecha se arrastou mais de 1/3 da altura ou com velocidade (px/ms) de "flick". */
export function deveFecharSheet(deslocamento: number, altura: number, velocidade: number): boolean {
  if (deslocamento <= 0) return false;
  return deslocamento > altura / 3 || velocidade > 0.6;
}
