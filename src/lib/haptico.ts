/**
 * Feedback tátil (celular). `navigator.vibrate` existe no Android (Chrome, Edge, Samsung);
 * o Safari do iPhone não expõe, então lá vira no-op silencioso. Respeita "reduzir movimento".
 *
 * Padrões curtos de propósito: o objetivo é confirmar o toque, não chamar atenção.
 */
export type TipoHaptico = "leve" | "sucesso" | "erro";

const PADROES: Record<TipoHaptico, number | number[]> = {
  leve: 10,
  sucesso: [12, 40, 12],
  erro: [40, 60, 40],
};

function podeVibrar(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return false;
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  return true;
}

export function haptico(tipo: TipoHaptico = "leve"): void {
  if (!podeVibrar()) return;
  try {
    navigator.vibrate(PADROES[tipo]);
  } catch {
    // Sem ativação do usuário o navegador recusa: é cosmético, ignora.
  }
}

// Mutation concluída segundos depois de um toque é ação da pessoa (salvar, aprovar, registrar);
// depois disso é autosave ou tarefa de fundo, que não deve vibrar o aparelho.
const JANELA_ACAO_MS = 4000;
let ultimoToque = 0;

export function registrarToque(agora = Date.now()): void {
  ultimoToque = agora;
}

export function foiAcaoRecente(agora = Date.now()): boolean {
  return agora - ultimoToque <= JANELA_ACAO_MS;
}

/** Liga a escuta de toque que alimenta `foiAcaoRecente`. Devolve a função que desliga. */
export function iniciarRastroDeToque(): () => void {
  if (typeof document === "undefined") return () => {};
  const aoTocar = () => registrarToque();
  document.addEventListener("pointerdown", aoTocar, { passive: true });
  document.addEventListener("pointerup", aoTocar, { passive: true });
  return () => {
    document.removeEventListener("pointerdown", aoTocar);
    document.removeEventListener("pointerup", aoTocar);
  };
}

/** Para o MutationCache: vibra só quando a mutation veio de uma ação recente da pessoa. */
export function hapticoDeMutation(tipo: "sucesso" | "erro", meta?: Record<string, unknown>): void {
  if (meta?.haptico === false) return;
  if (!foiAcaoRecente()) return;
  haptico(tipo);
}
