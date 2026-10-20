// SPEC 137 / ADR 0064: adicionais e itens do catálogo da estimativa, cada linha com a origem do preço.
//
// Ordem do preço: valor do usuário, valor da empresa, SINAPI, referência provisória do Pilar, a definir.
// Nunca sai valor sem origem. Funções puras, em centavos, chamadas pelo motor (estimativaObra.ts).
import {
  ADICIONAIS_IDS,
  adicionalSchema,
  type Adicional,
  type AdicionalId,
  type AjustesEmpresa,
  type Ficha,
  type OrigemLinha,
  type Padrao,
  type Parametros,
  type PrecoSinapi,
  type Premissas,
  type Regime,
  type ResultadoEstimativa,
  type Uf,
} from "@/schemas/estimativaObra";
import { centavos, formatarNumero } from "./estimativaAritmetica";

type AvisoSaida = ResultadoEstimativa["avisos"][number];

export interface AjusteMesclado {
  adicional: Adicional;
  /** A empresa tem valor próprio para o item (campo do adicional ou valor unitário). */
  ajustado: boolean;
  valorUnitario: number | null;
}

export function mesclarAjustes(
  parametros: Parametros,
  ajustes: AjustesEmpresa | null | undefined,
  avisos: AvisoSaida[]
): Partial<Record<AdicionalId, AjusteMesclado>> {
  const saida: Partial<Record<AdicionalId, AjusteMesclado>> = {};
  for (const id of ADICIONAIS_IDS) {
    const base = parametros.adicionais[id];
    // Parâmetro que o banco ainda não tem (ex.: item novo antes da migration): o adicional não existe.
    if (!base) continue;
    const bruto = ajustes?.adicionais?.[id];
    if (!bruto || Object.keys(bruto).length === 0) {
      saida[id] = { adicional: base, ajustado: false, valorUnitario: null };
      continue;
    }
    const { valor_unitario: vuBruto, ...resto } = bruto;
    let valorUnitario: number | null = null;
    let invalido = false;
    if (vuBruto !== undefined) {
      if (typeof vuBruto === "number" && Number.isFinite(vuBruto) && vuBruto > 0) valorUnitario = vuBruto;
      else invalido = true;
    }
    let adicional = base;
    let ajustado = valorUnitario !== null;
    if (Object.keys(resto).length > 0) {
      // O ajuste só muda valores: tipo e fase seguem os parâmetros do Pilar.
      const mesclado = adicionalSchema.safeParse({ ...base, ...resto, tipo: base.tipo, fase: base.fase });
      if (mesclado.success) {
        adicional = mesclado.data;
        ajustado = true;
      } else {
        invalido = true;
      }
    }
    if (invalido) {
      avisos.push({
        codigo: "ajuste_ignorado",
        mensagem: `O ajuste da empresa para ${base.rotulo.toLowerCase()} é inválido e foi ignorado. Vale o valor de referência.`,
      });
    }
    saida[id] = { adicional, ajustado, valorUnitario };
  }
  return saida;
}

export interface LinhaAdicional {
  id: AdicionalId;
  rotulo: string;
  nota: string | null;
  fase: string;
  servicos: string[];
  /** null = "a definir". */
  cents: number | null;
  quantidade: number;
  unidade: string | null;
  valorUnitarioCents: number | null;
  origem: OrigemLinha;
}

export interface ContextoLinha {
  ficha: Ficha;
  padrao: Padrao;
  baseCents: number;
  premissas?: Premissas;
  regime: Regime;
  precosSinapi: PrecoSinapi[];
}

const UNIDADE_INVARIAVEL = new Set(["kWp", "m²"]);
const ITENS_DE_CLIMATIZACAO = ["ac9", "ac12", "ac18", "ac24"] as const;

/** Quantidade do item na ficha. null = o item não se aplica a esta obra; 0 = aplica, mas falta a medida. */
function quantidadeDoItem(id: AdicionalId, ficha: Ficha): number | null {
  const residencial = ficha.tipo === "residencial";
  switch (id) {
    case "fundacao":
      return 1;
    case "piscina":
      return residencial && ficha.piscina > 0 ? ficha.piscina : null;
    case "gourmet":
      return residencial && ficha.gourmet ? 1 : null;
    case "marcenaria":
      return ficha.marcenaria !== "nenhuma" ? 1 : null;
    case "paisagismo":
      return ficha.paisagismo ? Math.max(0, ficha.terreno - ficha.area / ficha.pavimentos) : null;
    case "elevador":
      return ficha.elevador ? 1 : null;
    case "subsolo":
      return ficha.subsolo ? 1 : null;
    case "arrimo":
      return ficha.topografia === "inclinado" ? ficha.arrimo : null;
    case "terraplenagem":
      return ficha.topografia === "inclinado" ? 1 : null;
    case "acinst": {
      const n = ITENS_DE_CLIMATIZACAO.reduce((s, k) => s + (ficha.itens[k] ?? 0), 0);
      return n > 0 ? n : null;
    }
    default: {
      const n = ficha.itens[id] ?? 0;
      return n > 0 ? n : null;
    }
  }
}

/** Preço de insumo do SINAPI na UF e no regime da obra, do mês mais recente. Sem preço na UF, não empresta de outra. */
function precoSinapi(precos: PrecoSinapi[], codigo: number, uf: Uf, regime: Regime): PrecoSinapi | null {
  const doItem = precos.filter((p) => p.codigo === codigo && p.uf === uf && p.regime === regime);
  if (doItem.length === 0) return null;
  return doItem.reduce((a, b) => (b.mes_base > a.mes_base ? b : a));
}

/**
 * Qual item entra na ficha, quanto vale e de onde vem o preço (ADR 0064). Ordem: valor do usuário, valor da
 * empresa, SINAPI, referência provisória do Pilar, a definir. Nunca devolve valor sem origem.
 */
export function linhaDoAdicional(
  id: AdicionalId,
  a: Adicional,
  emp: AjusteMesclado,
  ctx: ContextoLinha
): LinhaAdicional | null {
  if (a.escopo === "dentro_do_cub") return null;
  const { ficha, padrao, baseCents } = ctx;
  const quantidade = quantidadeDoItem(id, ficha);
  if (quantidade === null) return null;

  let rotulo = a.rotulo;
  if (a.tipo === "por_m2") rotulo = `${a.rotulo} (${formatarNumero(quantidade)} m²)`;
  if (a.tipo === "por_m2_arrimo" && quantidade > 0) rotulo = `${a.rotulo} (${formatarNumero(quantidade)} m²)`;
  if (a.tipo === "percentual_base_por_nivel")
    rotulo = `${a.rotulo} ${ficha.marcenaria === "basica" ? "básica" : "completa"}`;
  if (a.unidade && (quantidade !== 1 || a.unidade === "kWp")) {
    const u = UNIDADE_INVARIAVEL.has(a.unidade) || quantidade === 1 ? a.unidade : `${a.unidade}s`;
    rotulo = `${a.rotulo} (${formatarNumero(quantidade)} ${u})`;
  }

  let cents: number | null = null;
  let valorUnitarioCents: number | null = null;
  let origem: OrigemLinha = { tipo: "a_definir" };
  const comValorUnitario = (vu: number) => {
    valorUnitarioCents = centavos(vu);
    cents = quantidade > 0 ? centavos(vu * quantidade) : null;
  };

  const doUsuario = ctx.premissas?.valores?.[id];
  const sinapi = a.sinapi ? precoSinapi(ctx.precosSinapi, a.sinapi.codigo, ficha.uf, ctx.regime) : null;
  if (doUsuario) {
    comValorUnitario(doUsuario.valor_unitario);
    origem = { tipo: "usuario", nota: doUsuario.nota };
  } else if (emp.valorUnitario !== null) {
    comValorUnitario(emp.valorUnitario);
    origem = { tipo: "empresa" };
  } else if (sinapi) {
    comValorUnitario(sinapi.valor);
    origem = {
      tipo: "sinapi",
      codigo: sinapi.codigo,
      uf: sinapi.uf,
      mesBase: sinapi.mes_base,
      regime: sinapi.regime,
      nivel: sinapi.origem === "C" ? "coletado" : "derivado",
      descricao: sinapi.descricao,
      unidade: sinapi.unidade,
      valorUnitario: sinapi.valor,
    };
  } else {
    switch (a.tipo) {
      case "percentual_base": {
        const pct = ficha.tipo === "industrial" && a.valor_industrial != null ? a.valor_industrial : a.valor;
        cents = Math.round((baseCents * pct) / 100);
        break;
      }
      case "por_m2":
        valorUnitarioCents = centavos(a.valor);
        cents = centavos(quantidade * a.valor);
        break;
      case "por_padrao":
        cents = centavos(a.valores[padrao]);
        break;
      case "percentual_base_por_nivel": {
        const nivel = ficha.marcenaria === "basica" ? "basica" : "completa";
        cents = Math.round((baseCents * a.valores[nivel]) / 100);
        break;
      }
      case "por_m2_area_livre":
        valorUnitarioCents = centavos(a.valor);
        cents = centavos(quantidade * a.valor);
        break;
      case "valor_fixo":
        cents = centavos(a.valor);
        break;
      case "por_m2_arrimo":
        // Sem a medida do muro não há como calcular: fica "a definir", e o aviso diz o que falta.
        valorUnitarioCents = centavos(a.valor);
        cents = quantidade > 0 ? centavos(quantidade * a.valor) : null;
        break;
      case "a_definir":
        cents = null;
        break;
    }
    if (cents !== null) origem = emp.ajustado ? { tipo: "empresa" } : { tipo: "referencia_pilar" };
  }
  if (cents === null) origem = { tipo: "a_definir" };

  return {
    id,
    rotulo,
    nota: a.nota ?? null,
    fase: a.fase,
    servicos: a.servicos,
    cents,
    quantidade,
    unidade: a.unidade ?? null,
    valorUnitarioCents: cents === null ? null : valorUnitarioCents,
    origem,
  };
}

export const FAIXA_PROVISORIA_PADRAO = { acima_de_pct: 10, a_cada_pct: 5, pontos: 1, max_pontos: 8 };
