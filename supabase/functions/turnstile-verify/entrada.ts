/** Token do widget do Turnstile. A Cloudflare documenta até 2048 caracteres. */
export function tokenTurnstile(corpo: unknown): string | null {
  const token = corpo && typeof corpo === "object" ? (corpo as Record<string, unknown>).token : undefined;
  return typeof token === "string" && token.length > 0 && token.length <= 2048 ? token : null;
}

/** Corpo do siteverify. O IP é opcional e só vai quando o proxy informou. */
export function formularioVerificacao(secret: string, token: string, ip: string): URLSearchParams {
  const form = new URLSearchParams();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  return form;
}

/** Só passa com `success: true` literal; resposta inesperada da Cloudflare reprova. */
export function aprovado(resultado: unknown): boolean {
  return !!resultado && typeof resultado === "object" && (resultado as { success?: unknown }).success === true;
}
