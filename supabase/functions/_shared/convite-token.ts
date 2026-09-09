// Token de convite (Portal do Cliente / Pilar Campo, spec 099): gerado no edge
// (Deno) e não no banco, para preservar a mesma ordem de segurança que o fluxo
// legado já tinha ("manda o e-mail antes de mexer no banco" — se o envio falhar,
// nada muda pro cliente). O RPC recebe só o HASH, nunca o token puro.
export async function gerarConviteToken(): Promise<{ token: string; hash: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");

  return { token, hash };
}
