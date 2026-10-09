/**
 * Pontuação dos evals do ai-chat. Puro (sem rede), testado em avaliar.test.ts: o runner
 * (rodar.ts) chama o modelo e passa as respostas por aqui.
 */
import type { CamposEsperados, Esperado } from "./casos.ts";

export type IntencaoObtida = {
  agente: string;
  modo: string;
  entidade?: string | null;
  operacao?: string | null;
};

/**
 * Diferenças entre a intenção esperada e a obtida (vazio = acertou). O agente só conta em
 * consulta: é ele que escolhe quais dados buscar. Em ação e operação o despacho vai pela
 * entidade ou operação (ENTIDADE_CFG), e o agente devolvido não é usado.
 */
export function errosDeIntencao(esperado: Esperado, obtido: IntencaoObtida): string[] {
  const erros: string[] = [];
  if (esperado.modo === "consulta" && !esperado.soModo && obtido.agente !== esperado.agente) {
    erros.push(`agente ${obtido.agente}, esperado ${esperado.agente}`);
  }
  if (obtido.modo !== esperado.modo) erros.push(`modo ${obtido.modo}, esperado ${esperado.modo}`);
  if (esperado.entidade && obtido.entidade !== esperado.entidade) {
    erros.push(`entidade ${obtido.entidade ?? "nenhuma"}, esperada ${esperado.entidade}`);
  }
  if (esperado.operacao && obtido.operacao !== esperado.operacao) {
    erros.push(`operação ${obtido.operacao ?? "nenhuma"}, esperada ${esperado.operacao}`);
  }
  return erros;
}

function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * Diferenças nos campos extraídos. Número: igual com tolerância de centavo. Texto: o
 * obtido contém o esperado, ignorando maiúscula e acento ("Grupo Ômega" contém "omega").
 */
export function errosDeCampos(esperados: CamposEsperados, obtidos: Record<string, unknown>): string[] {
  const erros: string[] = [];
  for (const [campo, esperado] of Object.entries(esperados)) {
    const obtido = obtidos[campo];
    if (typeof esperado === "number") {
      if (typeof obtido !== "number" || Math.abs(obtido - esperado) > 0.01) {
        erros.push(`${campo} = ${JSON.stringify(obtido ?? null)}, esperado ${esperado}`);
      }
      continue;
    }
    if (typeof obtido !== "string" || !normalizar(obtido).includes(normalizar(esperado))) {
      erros.push(`${campo} = ${JSON.stringify(obtido ?? null)}, esperado conter "${esperado}"`);
    }
  }
  return erros;
}

export type ResultadoCaso = {
  id: string;
  intencaoOk: boolean;
  /** null quando o caso não tem campos a conferir ou a intenção já errou a entidade. */
  camposOk: boolean | null;
  erros: string[];
  latenciaMs: number;
  tokens: number;
  tokensEntrada?: number;
  tokensSaida?: number;
};

export type Limites = { intencao: number; campos: number };

/** Limites de aprovação da suíte. Abaixo disso, a mudança de prompt ou modelo não entra. */
export const LIMITES: Limites = { intencao: 0.9, campos: 0.85 };

export function resumir(resultados: ResultadoCaso[], limites: Limites = LIMITES) {
  const comCampos = resultados.filter((r) => r.camposOk !== null);
  const intencao = resultados.filter((r) => r.intencaoOk).length / Math.max(resultados.length, 1);
  const campos = comCampos.length ? comCampos.filter((r) => r.camposOk).length / comCampos.length : 1;
  const latencias = resultados.map((r) => r.latenciaMs).sort((a, b) => a - b);
  const p95 = latencias[Math.min(latencias.length - 1, Math.floor(latencias.length * 0.95))] ?? 0;
  return {
    casos: resultados.length,
    intencao,
    campos,
    latenciaP95Ms: p95,
    tokens: resultados.reduce((a, r) => a + r.tokens, 0),
    tokensEntrada: resultados.reduce((a, r) => a + (r.tokensEntrada ?? 0), 0),
    tokensSaida: resultados.reduce((a, r) => a + (r.tokensSaida ?? 0), 0),
    aprovado: intencao >= limites.intencao && campos >= limites.campos,
  };
}
