/**
 * Destinatário da proposta: se o cliente/lead tem e-mail cadastrado, é para ele
 * que vai. Sem e-mail no cadastro, aceita o digitado na tela.
 */
export function destinatarioPermitido(cadastrado: string | null | undefined, digitado: string): boolean {
  const alvo = cadastrado?.trim().toLowerCase();
  if (!alvo) return true;
  return alvo === digitado.trim().toLowerCase();
}
