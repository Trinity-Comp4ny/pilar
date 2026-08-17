/**
 * Deploy troca o hash dos chunks (Vite). Quem já tinha a SPA aberta e navega para
 * uma rota/lazy component ainda não carregado tenta buscar um arquivo que não existe
 * mais no CDN: "Failed to fetch dynamically imported module". Vite emite
 * `vite:preloadError` nesse caso (dev e produção). Recarregar uma vez resolve, porque
 * o `index.html` novo aponta pros assets certos.
 *
 * Guarda de sessionStorage evita loop: se o reload não resolver (deploy genuinamente
 * quebrado), a segunda falha na mesma aba cai no fluxo normal (ErrorBoundary).
 */
const RELOAD_FLAG_KEY = "pilar:stale-chunk-reload";

export function initStaleChunkReload(): void {
  window.addEventListener("vite:preloadError", (event) => {
    if (sessionStorage.getItem(RELOAD_FLAG_KEY)) return;

    event.preventDefault();
    sessionStorage.setItem(RELOAD_FLAG_KEY, "1");
    window.location.reload();
  });
}
