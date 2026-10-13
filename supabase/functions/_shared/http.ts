/**
 * fetch com tempo limite para chamada a serviço de terceiro (Asaas, Resend, BrasilAPI,
 * Nominatim...). Sem limite, um provedor travado segura a Edge Function até o teto do
 * runtime e o usuário espera à toa; com ele, a falha chega rápido ao tratamento de erro
 * que já existe (fallback, "indisponível", nova tentativa).
 *
 * O erro de tempo esgotado é um DOMException "TimeoutError"; quem chama não precisa
 * diferenciar, é uma falha de rede como outra qualquer.
 */

export const TEMPO_PADRAO_MS = 15_000;

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export function fetchComTempo(
  url: string | URL,
  init: RequestInit = {},
  ms: number = TEMPO_PADRAO_MS,
  impl: Fetch = fetch
): Promise<Response> {
  const limite = AbortSignal.timeout(ms);
  // Respeita um signal que o chamador já tenha passado: aborta no que vier primeiro.
  const signal = init.signal ? AbortSignal.any([init.signal, limite]) : limite;
  return impl(url, { ...init, signal });
}
