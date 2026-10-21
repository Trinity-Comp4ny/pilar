/**
 * Pontuação dos evals do ai-estimativa-itens (SPEC 138). Puro, sem rede: o runner (rodar.ts) chama o modelo e passa
 * as respostas por aqui. Testado em avaliar.test.ts.
 */
import type { Interpretacao } from "../esquema.ts";
import type { Esperado } from "./casos.ts";

export interface ContaDoCaso {
  /** Itens esperados que vieram com o id certo. */
  itensCertos: number;
  /** Itens que vieram e não eram esperados. */
  itensDemais: number;
  /** Itens esperados que não vieram. */
  itensFaltando: number;
  /** Itens certos cuja quantidade também bateu. */
  quantidadesCertas: number;
  /** Campos conferidos (ambientes, marcenaria, relevo) e quantos bateram. */
  camposConferidos: number;
  camposCertos: number;
  /** null = o caso não pede item fora do catálogo ou pergunta. */
  foraOk: boolean | null;
  perguntasOk: boolean | null;
  erros: string[];
}

const IGUAL = 0.01;

/** Compara a interpretação obtida com o esperado do caso. */
export function contarCaso(esperado: Esperado, obtido: Interpretacao): ContaDoCaso {
  const erros: string[] = [];
  const obtidos = new Map(obtido.itens.map((i) => [i.id as string, i.quantidade]));
  const esperados = Object.entries(esperado.itens) as [string, number][];

  let itensCertos = 0;
  let quantidadesCertas = 0;
  let itensFaltando = 0;
  for (const [id, quantidade] of esperados) {
    const q = obtidos.get(id);
    if (q === undefined) {
      itensFaltando++;
      erros.push(`faltou ${id} (${quantidade})`);
      continue;
    }
    itensCertos++;
    if (Math.abs(q - quantidade) <= IGUAL) quantidadesCertas++;
    else erros.push(`${id} = ${q}, esperado ${quantidade}`);
  }
  let itensDemais = 0;
  for (const [id, q] of obtidos) {
    if (!(id in esperado.itens)) {
      itensDemais++;
      erros.push(`item a mais: ${id} (${q})`);
    }
  }

  let camposConferidos = 0;
  let camposCertos = 0;
  const campo = (ok: boolean, descricao: string) => {
    camposConferidos++;
    if (ok) camposCertos++;
    else erros.push(descricao);
  };
  for (const [nome, valor] of Object.entries(esperado.ambientes ?? {})) {
    const obtidoAmb = (obtido.ambientes as Record<string, number | null | undefined>)[nome];
    campo(obtidoAmb === valor, `ambiente ${nome} = ${obtidoAmb ?? null}, esperado ${valor}`);
  }
  if (esperado.marcenaria !== undefined) {
    campo(
      obtido.marcenaria === esperado.marcenaria,
      `marcenaria ${obtido.marcenaria}, esperada ${esperado.marcenaria}`
    );
  }
  if (esperado.relevo !== undefined) {
    if (esperado.relevo === null) {
      campo(obtido.relevo === null || obtido.relevo.inclinado === false, "relevo devolvido sem o texto citar terreno");
    } else {
      campo(obtido.relevo?.inclinado === esperado.relevo.inclinado, "relevo inclinado diferente do esperado");
      const m2 = esperado.relevo.arrimo_m2 ?? null;
      const m2Obtido = obtido.relevo?.arrimo_m2 ?? null;
      campo(
        m2 === null ? m2Obtido === null : m2Obtido !== null && Math.abs(m2Obtido - m2) <= IGUAL,
        `muro de arrimo = ${m2Obtido}, esperado ${m2}`
      );
    }
  }

  const foraOk =
    esperado.foraDoCatalogo === undefined ? null : obtido.fora_do_catalogo.length >= esperado.foraDoCatalogo;
  if (foraOk === false)
    erros.push(`fora do catálogo: ${obtido.fora_do_catalogo.length}, esperado ao menos ${esperado.foraDoCatalogo}`);
  const perguntasOk = esperado.perguntas === undefined ? null : obtido.perguntas.length >= esperado.perguntas;
  if (perguntasOk === false)
    erros.push(`perguntas: ${obtido.perguntas.length}, esperado ao menos ${esperado.perguntas}`);

  return {
    itensCertos,
    itensDemais,
    itensFaltando,
    quantidadesCertas,
    camposConferidos,
    camposCertos,
    foraOk,
    perguntasOk,
    erros,
  };
}

export interface ResultadoCaso extends ContaDoCaso {
  id: string;
  /** O que a função devolveria ao cliente, para depurar um caso que falhou. */
  obtido?: unknown;
  categoria: string;
  /** Falha da chamada (rede, schema inválido depois do retry). Conta como todos os itens errados. */
  falhou: boolean;
  latenciaMs: number;
  tokensEntrada: number;
  tokensSaida: number;
}

export interface Limites {
  item: number;
  quantidade: number;
  campos: number;
  fora: number;
  perguntas: number;
}

/** Limites de aprovação (SPEC 138). Revistos quando entrarem descrições reais. */
export const LIMITES: Limites = { item: 0.95, quantidade: 0.9, campos: 0.9, fora: 0.8, perguntas: 0.8 };

const razao = (a: number, b: number) => (b === 0 ? 1 : a / b);

export function resumir(resultados: ResultadoCaso[], limites: Limites = LIMITES) {
  const soma = (f: (r: ResultadoCaso) => number) => resultados.reduce((a, r) => a + f(r), 0);
  const certos = soma((r) => r.itensCertos);
  const demais = soma((r) => r.itensDemais);
  const faltando = soma((r) => r.itensFaltando);
  // F1 de item: pune item faltando e item inventado igualmente.
  const precisao = razao(certos, certos + demais);
  const cobertura = razao(certos, certos + faltando);
  const item = precisao + cobertura === 0 ? 0 : (2 * precisao * cobertura) / (precisao + cobertura);
  const quantidade = razao(
    soma((r) => r.quantidadesCertas),
    certos
  );
  const campos = razao(
    soma((r) => r.camposCertos),
    soma((r) => r.camposConferidos)
  );
  const comFora = resultados.filter((r) => r.foraOk !== null);
  const comPerguntas = resultados.filter((r) => r.perguntasOk !== null);
  const fora = razao(comFora.filter((r) => r.foraOk).length, comFora.length);
  const perguntas = razao(comPerguntas.filter((r) => r.perguntasOk).length, comPerguntas.length);
  const latencias = resultados.map((r) => r.latenciaMs).sort((a, b) => a - b);
  const p95 = latencias[Math.min(latencias.length - 1, Math.floor(latencias.length * 0.95))] ?? 0;
  const tokens = resultados.map((r) => r.tokensEntrada + r.tokensSaida).sort((a, b) => a - b);
  const tokensP95 = tokens[Math.min(tokens.length - 1, Math.floor(tokens.length * 0.95))] ?? 0;
  return {
    casos: resultados.length,
    falhas: resultados.filter((r) => r.falhou).length,
    item,
    precisao,
    cobertura,
    itensDemais: demais,
    quantidade,
    campos,
    fora,
    perguntas,
    latenciaP95Ms: p95,
    tokensP95,
    tokensEntrada: soma((r) => r.tokensEntrada),
    tokensSaida: soma((r) => r.tokensSaida),
    aprovado:
      item >= limites.item &&
      quantidade >= limites.quantidade &&
      campos >= limites.campos &&
      fora >= limites.fora &&
      perguntas >= limites.perguntas,
  };
}

/** Conta de um caso cuja chamada falhou: tudo que era esperado conta como errado. */
export function contaDeFalha(esperado: Esperado, motivo: string): ContaDoCaso {
  const itens = Object.keys(esperado.itens).length;
  const ambientes = Object.keys(esperado.ambientes ?? {}).length;
  const campos =
    ambientes +
    (esperado.marcenaria !== undefined ? 1 : 0) +
    (esperado.relevo === undefined ? 0 : esperado.relevo === null ? 1 : 2);
  return {
    itensCertos: 0,
    itensDemais: 0,
    itensFaltando: itens,
    quantidadesCertas: 0,
    camposConferidos: campos,
    camposCertos: 0,
    foraOk: esperado.foraDoCatalogo === undefined ? null : false,
    perguntasOk: esperado.perguntas === undefined ? null : false,
    erros: [motivo],
  };
}
