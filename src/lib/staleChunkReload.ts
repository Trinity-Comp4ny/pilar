/**
 * Deploy troca o hash dos chunks (Vite). Quem já tinha a SPA aberta e navega para
 * uma rota ou componente lazy ainda não carregado tenta buscar um arquivo que não
 * existe mais. Recarregar uma vez resolve, porque o `index.html` novo aponta pros
 * assets certos.
 *
 * Havia UM caminho coberto: o evento `vite:preloadError`. Ele só cobre a falha de
 * preload, e o Sentry mostrou que essa não é a forma mais comum aqui.
 *
 * PILAR-D (25/08, 5 minutos depois de um deploy, com um design partner na tela):
 *
 *   TypeError: Cannot read properties of undefined (reading 'default')
 *   at Lazy → react.production.min.js: return a._result.default
 *
 * O import NÃO deu 404. O host serve `index.html` para caminho de asset
 * inexistente (fallback de SPA), então o `React.lazy` recebeu HTML, resolveu com
 * um objeto sem `default` e estourou dentro do React. Nenhum evento do Vite foi
 * emitido, e o usuário viu tela de erro em vez de um reload.
 *
 * A mesma família já tinha aparecido antes e sido ignorada: PILAR-6 ("Importing a
 * module script failed") e PILAR-5 ("undefined is not an object (evaluating
 * 't.SettingsDialog')").
 *
 * Agora a detecção é por ASSINATURA do erro, em três pontos: o evento do Vite,
 * promise rejeitada sem catch, e o ErrorBoundary. A guarda de sessionStorage vale
 * para todos: se o reload não resolver (deploy genuinamente quebrado), a segunda
 * falha na mesma aba segue o fluxo normal e aparece a tela de erro.
 */
const RELOAD_FLAG_KEY = "pilar:stale-chunk-reload";

/**
 * Assinaturas de chunk velho. Genéricas de propósito: cada navegador escreve a
 * mensagem de import falho de um jeito, e a de `default` undefined vem de dentro
 * do React, sem menção a módulo.
 */
const ASSINATURAS = [
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /error loading dynamically imported module/i,
  // Chrome quando o host devolve index.html no lugar do .js: "Failed to load
  // module script: Expected a JavaScript module script but the server responded
  // with a MIME type of 'text/html'".
  /failed to load module script/i,
  /mime type of 'text\/html'/i,
  // React.lazy recebeu um módulo sem `default` (o caso do fallback de SPA).
  /cannot read propert(y|ies) of undefined \(reading 'default'\)/i,
  /undefined is not an object \(evaluating '[^']*\.default'\)/i,
];

export function isStaleChunkError(erro: unknown): boolean {
  const msg =
    erro instanceof Error
      ? `${erro.name}: ${erro.message}`
      : typeof erro === "string"
        ? erro
        : "";
  if (!msg) return false;
  return ASSINATURAS.some((re) => re.test(msg));
}

/**
 * Recarrega uma vez por aba. Retorna true quando assumiu o caso, para quem chamou
 * saber que não precisa mostrar erro ao usuário.
 */
export function tentarReloadPorChunkVelho(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG_KEY)) return false;
    sessionStorage.setItem(RELOAD_FLAG_KEY, "1");
  } catch {
    // Aba privada ou storage bloqueado: sem guarda de loop, não arrisca reload.
    return false;
  }
  window.location.reload();
  return true;
}

export function initStaleChunkReload(): void {
  window.addEventListener("vite:preloadError", (event) => {
    if (sessionStorage.getItem(RELOAD_FLAG_KEY)) return;
    event.preventDefault();
    tentarReloadPorChunkVelho();
  });

  // Import dinâmico que rejeita fora de um boundary do React cai aqui.
  window.addEventListener("unhandledrejection", (event) => {
    if (!isStaleChunkError(event.reason)) return;
    event.preventDefault();
    tentarReloadPorChunkVelho();
  });
}
