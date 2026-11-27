/**
 * Utilitários de atalho de teclado compartilhados pelo shell (paleta ⌘K, busca "/",
 * painel "?"). Sem dependência de React: entram no bundle de entrada sem custo.
 */

/** Foco num campo em edição: atalho de uma tecla só ("/", "?") não pode roubar a digitação. */
export function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  const campoNativo = el.closest("input, textarea, select");
  const campoComposto = el.closest('[role="textbox"], [role="searchbox"], [role="combobox"], [role="spinbutton"]');
  return !!campoNativo || !!campoComposto || (el as HTMLElement).isContentEditable === true;
}

/** Eventos já tratados, composição IME e repetição não disparam atalhos globais. */
export function isShortcutEventBlocked(event: KeyboardEvent): boolean {
  return event.defaultPrevented || event.isComposing || event.repeat;
}

/** Atalhos de uma tecla só respeitam campos em edição e o contexto de um diálogo. */
export function isSingleKeyShortcutBlocked(event: KeyboardEvent): boolean {
  if (isShortcutEventBlocked(event) || event.metaKey || event.ctrlKey || event.altKey) return true;
  const target = event.target instanceof Element ? event.target : null;
  const focused = document.activeElement;
  const inDialog = (el: Element | null) => !!el?.closest('[role="dialog"], [role="alertdialog"], dialog[open]');
  return isTypingTarget(target) || isTypingTarget(focused) || inDialog(target) || inDialog(focused);
}

/** Mac/iOS usam ⌘ no lugar de Ctrl. */
export function isMacPlatform(): boolean {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform);
}

/** Rótulo da tecla modificadora da plataforma: "⌘" no Mac, "Ctrl" nos demais. */
export function teclaModificadora(): string {
  return isMacPlatform() ? "⌘" : "Ctrl";
}
