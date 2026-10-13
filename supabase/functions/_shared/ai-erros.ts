/**
 * Erro de IA com tipo fechado (SPEC 110, ADR 0054).
 *
 * Toda falha de chamada ao modelo vira um destes tipos. Cada tipo tem um status HTTP e uma
 * mensagem para o usuário: o texto bruto do provedor (que pode trazer JSON interno, id de
 * projeto ou trecho do prompt) nunca chega à tela.
 */

export type TipoErroIa =
  | "limite_do_provedor"
  | "provedor_indisponivel"
  | "tempo_esgotado"
  | "saida_truncada"
  | "saida_invalida"
  | "bloqueada"
  | "configuracao"
  | "desconhecido";

export class ErroIa extends Error {
  readonly tipo: TipoErroIa;

  constructor(tipo: TipoErroIa, mensagem: string, opts: { cause?: unknown } = {}) {
    super(mensagem, opts.cause === undefined ? undefined : { cause: opts.cause });
    this.name = "ErroIa";
    this.tipo = tipo;
  }
}

/** Status HTTP de erro do provedor → tipo. 429 é do provedor, não o nosso anti-rajada. */
export function tipoDoStatus(status: number): TipoErroIa {
  if (status === 429) return "limite_do_provedor";
  if (status === 408) return "tempo_esgotado";
  if (status >= 500) return "provedor_indisponivel";
  return "configuracao";
}

/** Só falha passageira do provedor vale nova tentativa; o resto se repetiria igual. */
export function ehPassageiro(tipo: TipoErroIa): boolean {
  return tipo === "limite_do_provedor" || tipo === "provedor_indisponivel";
}

/**
 * Tipo de qualquer erro. ErroIa diz o próprio tipo; Error comum (ex.: o adaptador do
 * gateway em llm.ts) é lido pelo texto, que segue o formato "... error (NNN) ..." ou
 * "... timeout ...". Erro de rede do fetch (TypeError) é provedor fora do ar.
 */
export function classificarErroIa(e: unknown): TipoErroIa {
  if (e instanceof ErroIa) return e.tipo;
  if (e instanceof TypeError) return "provedor_indisponivel";
  const msg = e instanceof Error ? e.message : String(e);
  const status = /error \((\d{3})\)/i.exec(msg);
  if (status) return tipoDoStatus(Number(status[1]));
  if (/timeout|orçamento de tempo/i.test(msg)) return "tempo_esgotado";
  if (/API_KEY|não definida|configuração de modelo inválida/i.test(msg)) return "configuracao";
  return "desconhecido";
}

export const RESPOSTA_ERRO_IA: Record<TipoErroIa, { status: number; mensagem: string }> = {
  limite_do_provedor: {
    status: 503,
    mensagem: "O serviço de IA está com muita procura agora. Tente de novo em alguns segundos.",
  },
  provedor_indisponivel: {
    status: 502,
    mensagem: "O serviço de IA não respondeu. Tente de novo em instantes.",
  },
  tempo_esgotado: {
    status: 504,
    mensagem: "A IA demorou demais para responder. Tente de novo ou divida o pedido em partes menores.",
  },
  saida_truncada: {
    status: 502,
    mensagem: "A resposta da IA veio incompleta. Tente de novo com um pedido mais curto.",
  },
  saida_invalida: {
    status: 502,
    mensagem: "A IA não conseguiu montar uma resposta válida. Reformule o pedido e tente de novo.",
  },
  bloqueada: {
    status: 422,
    mensagem: "A IA não respondeu a este pedido. Reformule a mensagem e tente de novo.",
  },
  configuracao: {
    status: 500,
    mensagem: "A IA está fora do ar por um problema do nosso lado. A equipe já foi avisada.",
  },
  desconhecido: {
    status: 500,
    mensagem: "Não deu para processar o pedido agora. Tente de novo em instantes.",
  },
};

/** Tipos que pedem ação nossa (vão pro Sentry); os demais são do provedor ou do pedido. */
export function ehFalhaNossa(tipo: TipoErroIa): boolean {
  return tipo === "configuracao" || tipo === "desconhecido";
}

/** Corpo de erro para o cliente: mensagem própria do tipo, nunca o texto bruto. */
export function corpoErroIa(e: unknown): { error: string; tipo: TipoErroIa } {
  const tipo = classificarErroIa(e);
  return { error: RESPOSTA_ERRO_IA[tipo].mensagem, tipo };
}

export type Dormir = (ms: number) => Promise<void>;
const dormirDeVerdade: Dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Espera antes da 2ª e da 3ª tentativa. Curta de propósito: o orçamento total da edge é
// de 55 s e uma chamada pode levar até 30 s.
const ESPERAS_MS = [600, 1800];
// Não vale tentar de novo se, depois da espera, sobrar menos que isto até o prazo.
const MINIMO_PARA_TENTAR_MS = 3_000;

/** Espera antes da tentativa `proxima` (2, 3...) ou null quando não há mais tentativa. */
export function esperaAntesDe(proxima: number, restanteMs: number): number | null {
  const base = ESPERAS_MS[proxima - 2];
  if (base === undefined) return null;
  // Jitter de até 25%: várias empresas batendo no mesmo 429 não voltam juntas.
  const espera = Math.round(base * (1 + Math.random() * 0.25));
  return restanteMs - espera >= MINIMO_PARA_TENTAR_MS ? espera : null;
}

/**
 * Roda `fn` e tenta de novo, com espera crescente, quando a falha é passageira (429 ou
 * 5xx do provedor, rede). Respeita o prazo: sem tempo para outra tentativa, lança a última
 * falha. Qualquer outra falha sai na hora.
 */
export async function comNovaTentativa<T>(
  fn: (tentativa: number) => Promise<T>,
  o: { deadline: number; dormir?: Dormir; aoRepetir?: (tipo: TipoErroIa, tentativa: number) => void }
): Promise<T> {
  const dormir = o.dormir ?? dormirDeVerdade;
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await fn(tentativa);
    } catch (e) {
      const tipo = classificarErroIa(e);
      if (!ehPassageiro(tipo)) throw e;
      const espera = esperaAntesDe(tentativa + 1, o.deadline - Date.now());
      if (espera === null) throw e;
      o.aoRepetir?.(tipo, tentativa + 1);
      await dormir(espera);
    }
  }
}
