// Escrita recusada pelo banco porque a assinatura da empresa está suspensa
// (trigger enforce_empresa_nao_leitura, erro `empresa_assinatura_suspensa`).
// Quando isso acontece com a aba aberta, o gate de acesso relê o status na hora
// em vez de esperar a próxima checagem periódica.

export const ERRO_ASSINATURA_SUSPENSA = "empresa_assinatura_suspensa";
export const EVENTO_ASSINATURA_SUSPENSA = "pilar:assinatura-suspensa";

export function ehErroDeAssinaturaSuspensa(error: unknown): boolean {
  const mensagem =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : typeof error === "string"
          ? error
          : "";
  return mensagem.includes(ERRO_ASSINATURA_SUSPENSA);
}

export function avisarAssinaturaSuspensa(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENTO_ASSINATURA_SUSPENSA));
}
