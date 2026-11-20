// SPEC 169: a transcrição erra termo do domínio (Cloud→Claude, Kube→CUB, Inha/Access→IA,
// Synapse→SINAPI). Correção por palavra inteira, preservando a caixa inicial. Função pura.

const TERMOS: Array<[RegExp, string]> = [
  [/\bcloud\s+code\b/gi, "Claude Code"],
  [/\bcloud\b(?=\s+(?:ai|opus|sonnet|haiku))/gi, "Claude"],
  [/\bkube\b/gi, "CUB"],
  [/\binha\b/gi, "IA"],
  [/\baccess\b(?=\s+(?:para|de|do|da|no|na|que))/gi, "IA"],
  [/\bsynapse\b/gi, "SINAPI"],
  [/\bsinapi\b/gi, "SINAPI"],
];

export function aplicarGlossario(texto: string): string {
  return TERMOS.reduce((acc, [re, certo]) => acc.replace(re, certo), texto);
}
