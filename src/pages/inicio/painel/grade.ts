import { COLUNAS } from "./catalogo";
import type { Tamanho } from "@/hooks/usePainelLayout";

/**
 * Geometria da grade do painel. Fica separado do componente porque é lógica
 * pura e testável, e porque exportar função de arquivo de componente quebra o
 * fast refresh.
 */

/** Colunas ocupadas na última linha da seção, para o cartão de adicionar caber nela. */
export function sobraDaLinha(itens: { s: Tamanho }[]): number {
  let naLinha = 0;
  for (const item of itens) {
    const col = COLUNAS[item.s];
    naLinha = naLinha + col > 12 ? col : naLinha + col;
    if (naLinha === 12) naLinha = 0;
  }
  return naLinha === 0 ? 0 : 12 - naLinha;
}
