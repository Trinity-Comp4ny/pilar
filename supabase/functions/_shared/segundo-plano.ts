// Trabalho que continua depois da resposta (SPEC 135): no Supabase Edge, `EdgeRuntime.waitUntil`
// mantém o isolate vivo até a promessa terminar. Fora dele (teste local), roda solto e o erro
// vai para o log em vez de virar rejeição sem dono.

declare const EdgeRuntime: { waitUntil?: (promise: Promise<unknown>) => void } | undefined;

export function emSegundoPlano(trabalho: Promise<unknown>, aoFalhar: (e: unknown) => void): void {
  const guardado = trabalho.catch(aoFalhar);
  if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
    EdgeRuntime.waitUntil(guardado);
  }
}
