/**
 * Configuração de geração do Gemini direto e leitura do motivo de parada (SPEC 110).
 *
 * Puro (sem fetch), para teste. ai-client.ts monta o corpo da chamada com isto.
 */

import { ErroIa } from "./ai-erros.ts";

export type ModoGeracao = "json" | "texto";

/**
 * Temperatura por modo. JSON (classificar, extrair, montar rascunho) quer a mesma resposta
 * para a mesma entrada: 0. Texto livre (a resposta da consulta no chat) mantém 0.7, que
 * soa menos robótico e não grava nada no banco.
 */
const TEMPERATURA: Record<ModoGeracao, number> = { json: 0, texto: 0.7 };

/**
 * No Gemini 2.5 o raciocínio (thinking) conta dentro do maxOutputTokens. Sem teto, ele pode
 * comer o limite e o JSON sai cortado. Teto = 1/4 do limite: sobra sempre 3/4 para a
 * resposta. Só a família 2.5 aceita thinkingBudget; nos demais modelos vale o padrão deles.
 */
const FRACAO_RACIOCINIO = 0.25;

export function aceitaTetoDeRaciocinio(modelo: string): boolean {
  return /^gemini-2\.5-/.test(modelo);
}

export function configDeGeracao(
  modelo: string,
  o: { modo: ModoGeracao; maxOutputTokens: number }
): Record<string, unknown> {
  return {
    temperature: TEMPERATURA[o.modo],
    maxOutputTokens: o.maxOutputTokens,
    ...(o.modo === "json" && { responseMimeType: "application/json" }),
    ...(aceitaTetoDeRaciocinio(modelo) && {
      thinkingConfig: { thinkingBudget: Math.floor(o.maxOutputTokens * FRACAO_RACIOCINIO) },
    }),
  };
}

export interface RespostaGeminiParada {
  candidates?: Array<{ finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
}

/** Motivo de parada da resposta: o do candidato ou o bloqueio do prompt. */
export function motivoDeParada(r: RespostaGeminiParada): string | undefined {
  return r.candidates?.[0]?.finishReason ?? (r.promptFeedback?.blockReason ? "PROMPT_BLOCKED" : undefined);
}

// Paradas que não são "terminou normalmente". MAX_TOKENS é a única que outra tentativa com
// o mesmo limite não resolve por sorte; as de conteúdo (SAFETY etc.) também não.
const BLOQUEIOS = new Set([
  "SAFETY",
  "RECITATION",
  "BLOCKLIST",
  "PROHIBITED_CONTENT",
  "SPII",
  "IMAGE_SAFETY",
  "PROMPT_BLOCKED",
]);

/**
 * Lança ErroIa quando a parada impede usar a resposta como JSON: cortada por limite ou
 * bloqueada pelo filtro do provedor. STOP, ausente ou outro motivo segue (o parse e o
 * schema decidem).
 */
export function exigirParadaUtil(motivo: string | undefined, modelo: string): void {
  if (motivo === "MAX_TOKENS") {
    throw new ErroIa("saida_truncada", `Resposta de ${modelo} cortada no limite de tokens (MAX_TOKENS)`);
  }
  if (motivo && BLOQUEIOS.has(motivo)) {
    throw new ErroIa("bloqueada", `Resposta de ${modelo} bloqueada pelo provedor (${motivo})`);
  }
}

/**
 * Teto de uma chamada ao modelo. Texto curto: o limite por chamada, sobrando orçamento
 * para uma nova tentativa. Com anexo (PDF/imagem de extrato, orçamento), a extração com
 * saída longa passa dos 30 s e a chamada era abortada no meio (PILAR-1M, 30006 ms): aí o
 * teto é o orçamento inteiro, porque refazer uma extração de 50 s não caberia de todo jeito.
 */
export function tetoDaChamadaMs(o: {
  restanteMs?: number;
  comArquivo: boolean;
  porChamadaMs: number;
  orcamentoMs: number;
}): number {
  const teto = o.comArquivo ? o.orcamentoMs : o.porChamadaMs;
  return o.restanteMs === undefined ? teto : Math.min(teto, o.restanteMs);
}
