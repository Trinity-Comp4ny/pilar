/**
 * Lógica da limpeza de áudio do registro de obra (ADR 0062), sem rede: o index injeta o
 * Storage e o banco. Vale para os três motivos que o banco lista (vencido, conta removida,
 * órfão).
 */

export type ItemApagar = { path: string; registro_id: string | null; motivo: "vencido" | "conta_removida" | "orfao" };

export type Deps = {
  listar: (limite: number) => Promise<ItemApagar[]>;
  /** Apaga pela API do Storage. Arquivo que já não existe não é erro. */
  remover: (paths: string[]) => Promise<{ erro: string | null }>;
  marcarApagados: (registroIds: string[]) => Promise<{ erro: string | null }>;
};

export type Resumo = { apagados: number; registrosMarcados: number; lotes: number; erro: string | null };

export const TAMANHO_LOTE = 200;
export const MAX_LOTES = 10;

/**
 * Apaga em lotes até esvaziar a lista ou bater no teto de lotes por execução. Para no primeiro
 * erro: sem o arquivo fora do Storage o mesmo lote voltaria a cada rodada. O que ficou
 * sai na execução do dia seguinte.
 */
export async function limparAudios(deps: Deps): Promise<Resumo> {
  const resumo: Resumo = { apagados: 0, registrosMarcados: 0, lotes: 0, erro: null };

  for (let i = 0; i < MAX_LOTES; i++) {
    const itens = await deps.listar(TAMANHO_LOTE);
    if (itens.length === 0) break;
    resumo.lotes++;

    const removido = await deps.remover(itens.map((item) => item.path));
    if (removido.erro) return { ...resumo, erro: removido.erro };
    resumo.apagados += itens.length;

    const ids = itens.map((item) => item.registro_id).filter((id): id is string => id !== null);
    if (ids.length > 0) {
      const marcado = await deps.marcarApagados(ids);
      if (marcado.erro) return { ...resumo, erro: marcado.erro };
      resumo.registrosMarcados += ids.length;
    }

    if (itens.length < TAMANHO_LOTE) break;
  }

  return resumo;
}
