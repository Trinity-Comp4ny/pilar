/**
 * Aditivos recalculam cobranças futuras. Uma prévia antiga pode deixar de
 * representar o contrato se outra pessoa registrar parcelas ou aditivos.
 * O servidor deve continuar validando o snapshot de forma transacional;
 * este gate evita confirmar uma prévia obsoleta antes de chamar a RPC.
 */
export const PRAZO_PREVIA_ADITIVO_MS = 60_000;

export function previaAditivoAtualizada(dataUpdatedAt: number, agora = Date.now()): boolean {
  return dataUpdatedAt > 0 && agora >= dataUpdatedAt && agora - dataUpdatedAt <= PRAZO_PREVIA_ADITIVO_MS;
}
