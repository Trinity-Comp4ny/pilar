// HTML pré-renderizado (scripts/prerender.mjs) da rota em que o visitante caiu.
//
// O createRoot apaga o #root no primeiro commit. Numa rota preguiçosa esse commit é
// o fallback do Suspense, então a página pronta sumiria até o chunk chegar: piscada
// na tela e LCP medido de novo. Os nós do <main> são guardados antes do render para o
// fallback mostrar a mesma página enquanto isso.

let guardado: { rota: string; nos: Node[] } | null = null;

/** Guarda os nós do <main> pré-renderizado. Chamar antes do createRoot. */
export function guardarConteudoPronto(root: HTMLElement | null, rota: string): boolean {
  const main = root?.querySelector("main");
  if (!main?.hasChildNodes()) return false;
  guardado = { rota, nos: Array.from(main.childNodes) };
  return true;
}

/** Os nós guardados, se a rota atual é a que veio pronta do servidor. */
export function conteudoProntoDe(rota: string): Node[] | null {
  return guardado?.rota === rota ? guardado.nos : null;
}
