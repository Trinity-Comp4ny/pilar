/** Decidido uma vez: tela com toque como entrada principal (celular/tablet). Quem não tem nunca baixa os chunks de gesto. */
export const TELA_DE_TOQUE = typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches;
