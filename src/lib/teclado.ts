/**
 * Utilitários de atalho de teclado compartilhados pelo shell (paleta ⌘K, busca "/",
 * painel "?"). Sem dependência de React: entram no bundle de entrada sem custo.
 */

/** Foco num campo em edição: atalho de uma tecla só ("/", "?") não pode roubar a digitação. */
export function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el as HTMLElement).isContentEditable === true;
}

/** Mac/iOS usam ⌘ no lugar de Ctrl. */
export function isMacPlatform(): boolean {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform);
}

/** Rótulo da tecla modificadora da plataforma: "⌘" no Mac, "Ctrl" nos demais. */
export function teclaModificadora(): string {
  return isMacPlatform() ? "⌘" : "Ctrl";
}
