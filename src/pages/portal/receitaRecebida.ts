export function receitaRecebida(status: string | null | undefined): boolean {
  return status === "Recebido" || status === "Pago";
}
