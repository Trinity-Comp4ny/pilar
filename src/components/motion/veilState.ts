// Estado dos véus de entrada (ADR 0049). A troca de um véu por outro (sessão
// carregada, depois assinatura) acontece no mesmo commit, então quem tira o boot
// espera um tick e confere se ainda há véu montado.

let mounted = 0;
let ownMounted = 0;

export const isEntryVeilMounted = (): boolean => mounted > 0;

/**
 * Há um véu próprio (sem o boot) na tela agora. O Layout pergunta isso no
 * primeiro render, que acontece antes de o véu que ele substitui desmontar:
 * se sim, o app entra por baixo de uma saída com fade.
 */
export const isOwnVeilShowing = (): boolean => ownMounted > 0;

export const veilMounted = (own: boolean): void => {
  mounted += 1;
  if (own) ownMounted += 1;
};

/** Devolve true se foi o último véu a sair. */
export const veilUnmounted = (own: boolean): boolean => {
  mounted -= 1;
  if (own) ownMounted -= 1;
  return mounted === 0;
};
