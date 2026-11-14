import { hapticoDeMutation, iniciarRastroDeToque } from "./haptico";

/**
 * Inicialização só do celular, carregada sob demanda pelo main.tsx (fora do bundle de entrada):
 * rastro do último toque e vibração quando uma mutation conclui ou falha (evento disparado pelo
 * MutationCache em App.tsx).
 */
export function iniciarMobile(): void {
  iniciarRastroDeToque();
  window.addEventListener("pilar:mutation", (e) => {
    const { tipo, meta } = (e as CustomEvent<{ tipo: "sucesso" | "erro"; meta?: Record<string, unknown> }>).detail;
    hapticoDeMutation(tipo, meta);
  });
}
