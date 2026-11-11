/**
 * Abrir o agente da ajuda (SPEC 155) de qualquer lugar sem importar o painel, que é carregado
 * sob demanda (traz o renderizador de markdown).
 */
export const EVENTO_ABRIR_AGENTE = "pilar:abrir-agente-ajuda";

export function abrirAgenteAjuda() {
  window.dispatchEvent(new Event(EVENTO_ABRIR_AGENTE));
}
