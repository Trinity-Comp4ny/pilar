/**
 * Token de app externo (SPEC 151): ChatGPT, Claude e outros clientes conectados à Pilar pelo
 * servidor OAuth 2.1 do Supabase Auth recebem um JWT de usuário com a claim `client_id`. A
 * sessão normal do app não tem essa claim.
 *
 * Esse token vale como o usuário em qualquer API, não só no servidor MCP. Por isso o acesso de
 * app externo é só leitura e passa só pela função `mcp`:
 *  - banco (PostgREST): o pre-request `seguranca.pre_request_app_externo` recusa escrita;
 *  - Edge Functions: quem autentica usuário chama `recusarAppExterno` (cors.ts) logo após o
 *    getUser; o `authenticateUser` já faz isso. A única exceção é a própria `mcp`.
 *
 * A decodificação abaixo não valida assinatura: ela só roda DEPOIS do getUser() (que valida o
 * token no Auth), ou no máximo recusa um token que diz ser de app externo.
 */
export type ClaimsDoToken = Record<string, unknown>;

/** Payload do JWT do header Authorization, ou null se não for um Bearer JWT legível. */
export function claimsDoToken(authHeader: string | null | undefined): ClaimsDoToken | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const partes = authHeader.slice("Bearer ".length).trim().split(".");
  if (partes.length !== 3) return null;
  try {
    const base64 = partes[1].replace(/-/g, "+").replace(/_/g, "/");
    const preenchido = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const json = new TextDecoder().decode(Uint8Array.from(atob(preenchido), (c) => c.charCodeAt(0)));
    const claims = JSON.parse(json);
    return claims && typeof claims === "object" && !Array.isArray(claims) ? (claims as ClaimsDoToken) : null;
  } catch {
    return null;
  }
}

/** `client_id` do app externo que recebeu o token, ou null quando é a sessão do próprio app. */
export function clientIdDoAppExterno(authHeader: string | null | undefined): string | null {
  const clientId = claimsDoToken(authHeader)?.client_id;
  return typeof clientId === "string" && clientId.trim() !== "" ? clientId : null;
}
