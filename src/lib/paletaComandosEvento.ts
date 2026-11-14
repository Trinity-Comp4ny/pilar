/**
 * Abrir a paleta de comandos (⌘K) de qualquer lugar sem importar o cmdk, que é carregado sob
 * demanda. Quem escuta é o `useCommandPalette` montado no Layout.
 */
export const EVENTO_ABRIR_PALETA = "pilar:abrir-paleta-comandos";

export function abrirPaletaComandos() {
  window.dispatchEvent(new Event(EVENTO_ABRIR_PALETA));
}
