export type OrdemDisc = "padrao" | "previsao" | "prioridade";

export const ORDEM_LABEL: Record<OrdemDisc, string> = {
  padrao: "Ordem do fluxo",
  previsao: "Previsão (mais próxima)",
  prioridade: "Prioridade (maior primeiro)",
};
