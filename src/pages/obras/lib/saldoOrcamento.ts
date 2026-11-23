// Saldo do orçamento ao decidir uma compra: quanto o nó (ou o ancestral que tem orçado) ainda comporta.
import { achatarOrcado, montarOrcadoRealizado, type NoFinanceiro } from "@/lib/orcadoRealizado";

export interface SaldoCompra {
  /** "Fase › Etapa": onde o orçado foi definido. */
  caminho: string;
  previsto: number;
  realizado: number;
  saldoAntes: number;
  saldoApos: number;
  estoura: boolean;
}

/**
 * `null` quando a compra não tem frente ou nenhum nó do caminho tem orçado (nada a comparar). Sobe da frente
 * da compra até o primeiro ancestral com previsto; o realizado já soma os descendentes.
 */
export function saldoDaCompra(
  frenteId: string | null | undefined,
  valorCompra: number,
  nos: ReadonlyArray<NoFinanceiro>,
  previstoPorNo: ReadonlyMap<string, number>,
  realizadoPorNo: Readonly<Record<string, number>>
): SaldoCompra | null {
  if (!frenteId) return null;
  const linhas = achatarOrcado(montarOrcadoRealizado(nos, previstoPorNo, realizadoPorNo).raizes);
  const porId = new Map(linhas.map((l) => [l.no.id, l]));
  let atual = porId.get(frenteId);
  while (atual && atual.previsto <= 0) atual = atual.no.parent_id ? porId.get(atual.no.parent_id) : undefined;
  if (!atual) return null;
  const saldoAntes = atual.previsto - atual.realizado;
  const saldoApos = saldoAntes - valorCompra;
  return {
    caminho: atual.caminho,
    previsto: atual.previsto,
    realizado: atual.realizado,
    saldoAntes,
    saldoApos,
    estoura: saldoApos < 0,
  };
}
