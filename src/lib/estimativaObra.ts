// SPEC 136 / ADR 0063: motor da estimativa paramétrica de obra.
//
// Função pura: o mesmo input dá sempre o mesmo resultado, sem I/O e sem relógio. A IA nunca passa
// por aqui para definir preço ou prazo; ela só preenche a ficha. Todo valor é calculado em centavos
// inteiros e distribuído por maior resto, para as somas fecharem exatamente: etapas + adicionais +
// taxa = provável, natureza = provável, fases = provável e desembolso = provável.
import type { ZodType, ZodTypeDef } from "zod";
import { centavos, reais, somar, formatarNumero } from "./estimativaAritmetica";
import { FAIXA_PROVISORIA_PADRAO, linhaDoAdicional, mesclarAjustes, type ContextoLinha } from "./estimativaItens";
import {
  ADICIONAIS_IDS,
  PADROES,
  SUBTIPOS,
  ajustesEmpresaSchema,
  cubLinhaSchema,
  fichaSchema,
  parametrosSchema,
  precoSinapiSchema,
  premissasSchema,
  type Adicional,
  type AjustesEmpresa,
  type CubLinha,
  type Ficha,
  type Padrao,
  type Parametros,
  type Premissas,
  type PrecoSinapi,
  type Regime,
  type ResultadoEstimativa,
  type Uf,
} from "@/schemas/estimativaObra";

type MotivoErro = "sem_cub" | "regime_indisponivel" | "padrao_indisponivel" | "ficha_invalida";

export type SaidaCalculo =
  { ok: true; resultado: ResultadoEstimativa } | { ok: false; motivo: MotivoErro; mensagem: string };

export interface EntradaCalculo {
  ficha: Ficha;
  premissas?: Premissas;
  /** Linhas do CUB (qualquer UF e mês); o motor escolhe a que vale. */
  cub: CubLinha[];
  parametros: Parametros;
  ajustes?: AjustesEmpresa | null;
  /** Preços de insumo do SINAPI dos itens do catálogo (qualquer UF, regime e mês); o motor escolhe o que vale. */
  precosSinapi?: PrecoSinapi[];
  /** Calcula como se a ficha tivesse outro padrão (comparar cenários). */
  padraoCenario?: Padrao;
  /** `estimativa_parametros.validado_em` não nulo. */
  parametrosValidados: boolean;
}

/** UFs mais próximas, em ordem, para quando a UF da obra não tem tabela. Aproximação geográfica. */
const VIZINHAS: Record<Uf, Uf[]> = {
  AC: ["AM", "RO", "PA", "MT"],
  AL: ["PE", "SE", "BA", "PB"],
  AP: ["PA", "AM", "MA"],
  AM: ["PA", "RR", "RO", "AC", "MT"],
  BA: ["SE", "MG", "ES", "PE", "GO", "TO", "AL", "PI"],
  CE: ["PE", "RN", "PB", "PI", "MA"],
  DF: ["GO", "MG", "TO", "BA", "MT"],
  ES: ["RJ", "MG", "BA", "SP"],
  GO: ["DF", "MG", "TO", "MT", "MS", "BA", "SP"],
  MA: ["PI", "TO", "PA", "CE"],
  MT: ["GO", "MS", "TO", "RO", "PA", "AM", "DF"],
  MS: ["SP", "PR", "GO", "MT", "MG"],
  MG: ["SP", "RJ", "ES", "GO", "DF", "BA"],
  PA: ["MA", "TO", "AP", "AM", "MT"],
  PB: ["PE", "RN", "CE", "AL"],
  PR: ["SC", "SP", "MS", "RS"],
  PE: ["PB", "AL", "CE", "BA", "PI"],
  PI: ["CE", "MA", "PE", "BA", "TO"],
  RJ: ["SP", "MG", "ES"],
  RN: ["PB", "CE", "PE"],
  RS: ["SC", "PR"],
  RO: ["AC", "MT", "AM"],
  RR: ["AM", "PA"],
  SC: ["PR", "RS", "SP"],
  SE: ["AL", "BA", "PE"],
  SP: ["PR", "RJ", "MG", "MS", "SC"],
  TO: ["GO", "MA", "PA", "MT", "BA", "PI", "DF"],
};

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** `2026-09-01` → `set/2026`. */
export function rotuloMesBase(mesBase: string): string {
  const [ano, mes] = mesBase.split("-");
  return `${MESES[Number(mes) - 1]}/${ano}`;
}

type Leitura<T> = { ok: true; valor: T } | { ok: false; mensagem: string };

function ler<T>(schema: ZodType<T, ZodTypeDef, unknown>, bruto: unknown, rotulo: string): Leitura<T> {
  const lido = schema.safeParse(bruto);
  if (lido.success) return { ok: true, valor: lido.data };
  return { ok: false, mensagem: `${rotulo} inválidos: ${lido.error.issues[0]?.message ?? "formato inesperado"}` };
}

// Leitores de fronteira: tudo que volta do banco (jsonb) entra no motor por aqui. Falha cedo e
// claro, em vez de quebrar lá na frente.

/** `estimativa_parametros.parametros`. */
export function lerParametros(bruto: unknown): { ok: true; parametros: Parametros } | { ok: false; mensagem: string } {
  const lido = ler(parametrosSchema, bruto, "Parâmetros da estimativa");
  return lido.ok ? { ok: true, parametros: lido.valor } : lido;
}

/** Linhas de `cub_valores`. Uma linha inválida derruba a leitura inteira: preço errado é pior que nenhum. */
export function lerCub(bruto: unknown): Leitura<CubLinha[]> {
  return ler(cubLinhaSchema.array(), bruto, "Linhas do CUB");
}

/** Linhas de `sinapi_precos_insumo`. Uma linha inválida derruba a leitura inteira. */
export function lerPrecosSinapi(bruto: unknown): Leitura<PrecoSinapi[]> {
  return ler(precoSinapiSchema.array(), bruto, "Preços do SINAPI");
}

/** `estimativa_ajustes_empresa.adicionais` embrulhado como `{ adicionais }`. */
export function lerAjustes(bruto: unknown): Leitura<AjustesEmpresa> {
  return ler(ajustesEmpresaSchema, bruto, "Ajustes da empresa");
}

/** `estimativas_obra.premissas`. */
export function lerPremissas(bruto: unknown): Leitura<Premissas> {
  return ler(premissasSchema, bruto, "Premissas");
}

/** Nome do padrão em frase: o "normal" do CUB é o padrão médio. */
export function rotuloPadrao(padrao: Padrao): string {
  return padrao === "normal" ? "médio" : padrao;
}

const ROTULO_REGIME: Record<Regime, string> = { onerado: "sem desoneração", desonerado: "com desoneração" };

/** "sem desoneração" ou "com desoneração", para telas e para a fonte do preço. */
export function rotuloRegime(regime: Regime): string {
  return ROTULO_REGIME[regime];
}

/** Padrões que têm tabela de CUB para o subtipo no regime (o assistente desliga os demais). */
export function padroesDisponiveis(cub: CubLinha[], cubCodigo: string, regime: Regime = "onerado"): Padrao[] {
  const linhas = cub.filter((l) => l.subtipo === cubCodigo && l.regime === regime);
  if (linhas.some((l) => l.padrao === "unico")) return [...PADROES];
  return PADROES.filter((p) => linhas.some((l) => l.padrao === p));
}

const brl0 = (n: number) => `R$ ${n.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;

/** Como o adicional é cobrado, em uma frase: "6% da base", "R$ 2.500 por m²". Para telas de parâmetro. */
export function descreverAdicional(a: Adicional): string {
  switch (a.tipo) {
    case "percentual_base":
      return a.valor_industrial != null
        ? `${formatarNumero(a.valor)}% da base (${formatarNumero(a.valor_industrial)}% em galpão)`
        : `${formatarNumero(a.valor)}% da base`;
    case "por_m2":
      return `${brl0(a.valor)} por m²`;
    case "por_padrao":
      return `${brl0(a.valores.baixo)} no baixo, ${brl0(a.valores.normal)} no normal, ${brl0(a.valores.alto)} no alto`;
    case "percentual_base_por_nivel":
      return `${formatarNumero(a.valores.basica)}% da base na básica, ${formatarNumero(a.valores.completa)}% na completa`;
    case "por_m2_area_livre":
      return `${brl0(a.valor)} por m² de área livre`;
    case "valor_fixo":
      return brl0(a.valor);
    case "por_m2_arrimo":
      return `${brl0(a.valor)} por m² de muro de arrimo`;
    case "a_definir":
      return a.sinapi ? `a definir, ou preço do SINAPI (insumo ${a.sinapi.codigo})` : "a definir";
  }
}

/** Ficha inicial do assistente, com o que o Pilar sabe sem perguntar. */
export function fichaInicial(inicio: string, uf: Uf = "SP"): Ficha {
  return {
    tipo: "residencial",
    subtipo: "casa",
    padrao: "normal",
    uf,
    area: 150,
    pavimentos: 1,
    terreno: 300,
    topografia: "plano",
    arrimo: 0,
    itens: {},
    inicio,
    quartos: 3,
    suites: 1,
    banheiros: 2,
    lavabo: 0,
    vagas: 2,
    piscina: 0,
    gourmet: false,
    elevador: false,
    subsolo: false,
    paisagismo: false,
    marcenaria: "nenhuma",
  };
}

/** Avisos de coerência da ficha: não impedem o cálculo, só chamam a atenção antes de gerar. */
export function avisosCoerencia(ficha: Ficha): string[] {
  const avisos: string[] = [];
  if (ficha.suites * 22 > ficha.area * 0.6) {
    avisos.push(
      `${ficha.suites} ${ficha.suites === 1 ? "suíte" : "suítes"} em ${formatarNumero(ficha.area)} m² fica abaixo do usual. Confira a área construída ou o número de suítes.`
    );
  }
  if (ficha.suites > ficha.quartos) {
    avisos.push("Há mais suítes do que quartos. Toda suíte é um quarto: confira os dois números.");
  }
  if (ficha.suites > ficha.banheiros) {
    avisos.push("Há mais suítes do que banheiros. Confira o número de banheiros.");
  }
  if (ficha.pavimentos > 0 && ficha.area / ficha.pavimentos < 30) {
    avisos.push(
      `${formatarNumero(ficha.area)} m² em ${ficha.pavimentos} pavimentos dá menos de 30 m² por pavimento. Confira a área e os pavimentos.`
    );
  }
  if (ficha.terreno > 0 && ficha.piscina > ficha.terreno * 0.4) {
    avisos.push("A piscina ocupa mais de 40% do terreno. Confira a área da piscina e do terreno.");
  }
  return avisos;
}

// ── Aritmética em centavos ───────────────────────────────────────────────────

/** Divide `total` (centavos) proporcionalmente aos pesos, sem perder nem criar centavo (maior resto). */
export function distribuir(total: number, pesos: number[]): number[] {
  const n = pesos.length;
  if (n === 0) return [];
  const soma = somar(pesos);
  const efetivos = soma > 0 ? pesos : pesos.map(() => 1);
  const somaEfetiva = soma > 0 ? soma : n;
  const brutos = efetivos.map((p) => (total * p) / somaEfetiva);
  const partes = brutos.map(Math.floor);
  const sobra = total - somar(partes);
  const ordem = brutos.map((b, i) => ({ i, frac: b - partes[i] })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; k < sobra; k++) partes[ordem[k % n].i] += 1;
  return partes;
}

// ── Datas (UTC, sem relógio) ─────────────────────────────────────────────────

const DIA_MS = 86_400_000;
const diaDe = (ano: number, mesIdx: number, dia: number) => Math.floor(Date.UTC(ano, mesIdx, dia) / DIA_MS);
const isoDoDia = (dia: number) => new Date(dia * DIA_MS).toISOString().slice(0, 10);

function mesIso(ano: number, mesIdx: number): string {
  const d = new Date(Date.UTC(ano, mesIdx, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Divide a janela [d0, d1] (dias) em `n` partes em sequência, com sobreposição entre vizinhas
 * (`sobre` = fração de uma parte). A última termina em d1.
 */
function particionar(d0: number, d1: number, n: number, sobre: number): { ini: number; fim: number }[] {
  if (n <= 0) return [];
  const total = d1 - d0 + 1;
  const parte = total / (1 + (n - 1) * (1 - sobre));
  return Array.from({ length: n }, (_, i) => {
    const ini = d0 + Math.round(i * parte * (1 - sobre));
    const fim = i === n - 1 ? d1 : Math.min(d1, d0 + Math.round(i * parte * (1 - sobre) + parte) - 1);
    return { ini, fim: Math.max(ini, fim) };
  });
}

// ── CUB ──────────────────────────────────────────────────────────────────────

type CubEscolhido = { linha: CubLinha; origem: "uf" | "uf_vizinha"; mesAntigo: boolean };

function escolherCub(
  cub: CubLinha[],
  uf: Uf,
  cubCodigo: string,
  padrao: Padrao,
  regime: Regime
): CubEscolhido | { erro: "sem_cub" | "regime_indisponivel" | "padrao_indisponivel" } {
  const doSubtipo = cub.filter((l) => l.subtipo === cubCodigo);
  if (doSubtipo.length === 0) return { erro: "sem_cub" };
  const doRegime = doSubtipo.filter((l) => l.regime === regime);
  if (doRegime.length === 0) return { erro: "regime_indisponivel" };
  const aplicaveis = doRegime.filter((l) => l.padrao === padrao || l.padrao === "unico");
  if (aplicaveis.length === 0) return { erro: "padrao_indisponivel" };

  const mesReferencia = aplicaveis.reduce((m, l) => (l.mes_base > m ? l.mes_base : m), "");
  const maisRecente = (ufAlvo: Uf): CubLinha | null => {
    const linhas = aplicaveis.filter((l) => l.uf === ufAlvo);
    if (linhas.length === 0) return null;
    return linhas.reduce((melhor, l) => {
      if (l.mes_base !== melhor.mes_base) return l.mes_base > melhor.mes_base ? l : melhor;
      return l.padrao === padrao && melhor.padrao !== padrao ? l : melhor;
    });
  };

  for (const candidata of [uf, ...VIZINHAS[uf]]) {
    const linha = maisRecente(candidata);
    if (linha)
      return { linha, origem: candidata === uf ? "uf" : "uf_vizinha", mesAntigo: linha.mes_base < mesReferencia };
  }
  return { erro: "sem_cub" };
}

// ── Cálculo ──────────────────────────────────────────────────────────────────

export function calcularEstimativa(entrada: EntradaCalculo): SaidaCalculo {
  const lida = fichaSchema.safeParse(entrada.ficha);
  if (!lida.success) {
    return { ok: false, motivo: "ficha_invalida", mensagem: lida.error.issues[0]?.message ?? "Ficha inválida" };
  }
  const ficha = lida.data;
  const { parametros } = entrada;
  const padrao: Padrao = entrada.padraoCenario ?? ficha.padrao;
  const subtipo = SUBTIPOS[ficha.tipo][ficha.subtipo];

  const regime: Regime = entrada.premissas?.regime ?? "onerado";
  const escolha = escolherCub(entrada.cub, ficha.uf, subtipo.cub, padrao, regime);
  if ("erro" in escolha) {
    if (escolha.erro === "regime_indisponivel") {
      return {
        ok: false,
        motivo: "regime_indisponivel",
        mensagem: `O Pilar ainda não tem o CUB ${rotuloRegime(regime)} para esse tipo de obra. Escolha o outro regime ou fale com o time para importar.`,
      };
    }
    return escolha.erro === "sem_cub"
      ? {
          ok: false,
          motivo: "sem_cub",
          mensagem: "O Pilar ainda não tem a tabela do CUB para esse tipo de obra. Fale com o time para importar.",
        }
      : {
          ok: false,
          motivo: "padrao_indisponivel",
          mensagem: `Não há tabela do CUB para ${subtipo.nome.toLowerCase()} no padrão ${rotuloPadrao(padrao)}. Escolha outro padrão.`,
        };
  }

  const avisos: ResultadoEstimativa["avisos"] = [];
  const { linha, origem, mesAntigo } = escolha;

  // Premissas
  const admPct = entrada.premissas?.adm ?? parametros.adm_padrao;
  const equipe = entrada.premissas?.equipe ?? parametros.equipe_padrao;
  const faixaEscolhida = entrada.premissas?.faixa ?? parametros.faixa_padrao;
  const faixaPct =
    faixaEscolhida +
    (mesAntigo ? parametros.faixa_extra_mes_antigo : 0) +
    (origem === "uf_vizinha" ? parametros.faixa_extra_uf_vizinha : 0);

  if (origem === "uf_vizinha") {
    avisos.push({
      codigo: "uf_vizinha",
      mensagem: `Ainda não há CUB de ${ficha.uf}. Usamos o de ${linha.uf}, a UF mais próxima com tabela, e a faixa ficou ${formatarNumero(parametros.faixa_extra_uf_vizinha)} pontos percentuais mais larga.`,
    });
  }
  if (mesAntigo) {
    avisos.push({
      codigo: "mes_antigo",
      mensagem: `A tabela do CUB de ${linha.uf} mais recente é de ${rotuloMesBase(linha.mes_base)}, e há dados mais novos em outras UFs. A faixa ficou ${formatarNumero(parametros.faixa_extra_mes_antigo)} pontos percentuais mais larga.`,
    });
  }

  // Base do CUB
  const baseCents = centavos(ficha.area * linha.valor_m2);
  const etapasCents = distribuir(
    baseCents,
    parametros.etapas.map((e) => e.percentual)
  );

  // Adicionais e itens do catálogo, cada um com a origem do preço
  const ajustesMesclados = mesclarAjustes(parametros, entrada.ajustes, avisos);
  const contexto: ContextoLinha = {
    ficha,
    padrao,
    baseCents,
    premissas: entrada.premissas,
    regime,
    precosSinapi: entrada.precosSinapi ?? [],
  };
  const linhasAdicionais = ADICIONAIS_IDS.flatMap((id) => {
    const emp = ajustesMesclados[id];
    const l = emp ? linhaDoAdicional(id, emp.adicional, emp, contexto) : null;
    return l ? [l] : [];
  });
  for (const l of linhasAdicionais) {
    if (l.cents === null) {
      avisos.push({
        codigo: "adicional_a_definir",
        mensagem: `${l.rotulo} ainda não tem valor: depende de definição. O total e a faixa não incluem esse item.`,
      });
    }
  }
  const adicionaisCents = somar(linhasAdicionais.map((l) => l.cents ?? 0));

  // Origem do preço: quanto do total tem fonte verificável e quanto é referência provisória
  const porOrigem = { sinapi: 0, empresa: 0, usuario: 0, referencia_pilar: 0 };
  for (const l of linhasAdicionais) {
    if (l.cents !== null && l.origem.tipo !== "a_definir") porOrigem[l.origem.tipo] += l.cents;
  }
  const subtotalParaOrigem = baseCents + adicionaisCents;
  const provisoriaPct = (porOrigem.referencia_pilar / subtotalParaOrigem) * 100;
  const verificavelPct =
    ((baseCents + porOrigem.sinapi + porOrigem.empresa + porOrigem.usuario) / subtotalParaOrigem) * 100;
  const regra = parametros.faixa_extra_provisoria ?? FAIXA_PROVISORIA_PADRAO;
  const faixaExtra = Math.min(
    regra.max_pontos,
    Math.max(0, Math.round((provisoriaPct - regra.acima_de_pct) / regra.a_cada_pct) * regra.pontos)
  );
  if (faixaExtra > 0) {
    avisos.push({
      codigo: "faixa_provisoria",
      mensagem: `${formatarNumero(Math.round(provisoriaPct * 10) / 10)}% do total usa referência provisória do Pilar, sem fonte pública, então a faixa ficou ${formatarNumero(faixaExtra)} ${faixaExtra === 1 ? "ponto percentual" : "pontos percentuais"} mais larga. Informe o valor dos itens ou use a tabela de preços da empresa para estreitar.`,
    });
  }

  // Totais
  const subtotalCents = baseCents + adicionaisCents;
  const taxaCents = Math.round((subtotalCents * admPct) / 100);
  const provavelCents = subtotalCents + taxaCents;
  const faixaFinal = faixaPct + faixaExtra;
  const minimoCents = Math.round((provavelCents * (100 - faixaFinal)) / 100);
  const maximoCents = Math.round((provavelCents * (100 + faixaFinal)) / 100);

  // Natureza do custo
  const nb = parametros.natureza_base;
  const [baseMaterial, baseMao, baseEquip, baseDesp] = distribuir(baseCents, [
    nb.material,
    nb.mao_de_obra,
    nb.equipamentos,
    nb.despesas,
  ]);
  const [adicMaterial, adicMao] = distribuir(adicionaisCents, [
    parametros.natureza_adicionais.material,
    parametros.natureza_adicionais.mao_de_obra,
  ]);
  const natureza = [
    { id: "material", rotulo: "Material", valor: reais(baseMaterial + adicMaterial) },
    { id: "mao_de_obra", rotulo: "Mão de obra", valor: reais(baseMao + adicMao) },
    { id: "equipamentos", rotulo: "Equipamentos", valor: reais(baseEquip) },
    { id: "despesas", rotulo: "Despesas da obra", valor: reais(baseDesp) },
    { id: "administracao", rotulo: "Taxa de administração", valor: reais(taxaCents) },
  ];

  // Prazo
  const horasPorM2 =
    ficha.tipo === "industrial" ? parametros.produtividade_h_m2.industrial : parametros.produtividade_h_m2[padrao];
  const horas = ficha.area * horasPorM2;
  const meses = Math.max(4, Math.ceil(horas / (equipe * parametros.horas_mes_por_pessoa) + 1));

  // Fases: valor bruto por fase (etapas + adicionais), com a taxa rateada por maior resto
  const brutoPorFase = new Map<string, number>();
  parametros.etapas.forEach((e, i) => brutoPorFase.set(e.fase, (brutoPorFase.get(e.fase) ?? 0) + etapasCents[i]));
  for (const l of linhasAdicionais) brutoPorFase.set(l.fase, (brutoPorFase.get(l.fase) ?? 0) + (l.cents ?? 0));

  const fasesBase = parametros.fases
    .map((f) => {
      const geradas = linhasAdicionais
        .filter((l) => l.fase === f.id && l.servicos.length > 0)
        .map((l) => ({ nome: l.rotulo.replace(/ \(.*\)$/, ""), servicos: l.servicos }));
      const etapas = [...f.etapas, ...geradas];
      return { f, etapas, bruto: brutoPorFase.get(f.id) ?? 0 };
    })
    .filter((x) => x.etapas.length > 0 || x.bruto > 0);

  const taxaPorFase = distribuir(
    taxaCents,
    fasesBase.map((x) => x.bruto)
  );

  const [anoIni, mesIni] = ficha.inicio.split("-").map(Number);
  const mesIdx0 = mesIni - 1;
  const desembolsoCents = Array.from({ length: meses }, () => 0);

  const fases = fasesBase.map((x, i) => {
    const valorCents = x.bruto + taxaPorFase[i];
    const inicioMes = Math.floor(x.f.inicio * meses);
    const fimMes = Math.min(meses, Math.max(inicioMes + 1, Math.ceil(x.f.fim * meses)));
    const d0 = diaDe(anoIni, mesIdx0 + inicioMes, 1);
    const d1 = diaDe(anoIni, mesIdx0 + fimMes, 1) - 1;

    distribuir(
      valorCents,
      Array.from({ length: fimMes - inicioMes }, () => 1)
    ).forEach((v, k) => {
      desembolsoCents[inicioMes + k] += v;
    });

    const janelas = particionar(d0, d1, x.etapas.length, 0.2);
    return {
      id: x.f.id,
      nome: x.f.nome,
      valor: reais(valorCents),
      inicioMes,
      fimMes,
      inicio: isoDoDia(d0),
      fim: isoDoDia(d1),
      etapas: x.etapas.map((et, k) => {
        const sj = particionar(janelas[k].ini, janelas[k].fim, et.servicos.length, 0.25);
        return {
          nome: et.nome,
          inicio: isoDoDia(janelas[k].ini),
          fim: isoDoDia(janelas[k].fim),
          servicos: et.servicos.map((nome, s) => ({ nome, inicio: isoDoDia(sj[s].ini), fim: isoDoDia(sj[s].fim) })),
        };
      }),
    };
  });

  if (!entrada.parametrosValidados) {
    avisos.push({
      codigo: "parametros_nao_validados",
      mensagem:
        "Parâmetros em validação: o percentual por etapa, os adicionais e a produtividade ainda não foram conferidos com obras reais.",
    });
  }
  for (const mensagem of avisosCoerencia(ficha)) avisos.push({ codigo: "coerencia", mensagem });

  const sufixoPadrao = linha.padrao === "unico" ? "" : `-${linha.padrao[0].toUpperCase()}`;

  return {
    ok: true,
    resultado: {
      versaoMotor: 1,
      provavel: reais(provavelCents),
      minimo: reais(minimoCents),
      maximo: reais(maximoCents),
      faixaPct: faixaFinal,
      porM2: Math.round(provavelCents / ficha.area) / 100,
      base: reais(baseCents),
      subtotal: reais(subtotalCents),
      taxaAdministracao: reais(taxaCents),
      admPct,
      area: ficha.area,
      padrao,
      subtipoNome: subtipo.nome,
      fonte: {
        texto: `CUB ${subtipo.cub}${sufixoPadrao} · ${linha.uf} · ${rotuloMesBase(linha.mes_base)} · ${rotuloRegime(regime)}`,
        uf: linha.uf,
        cubCodigo: subtipo.cub,
        padrao: linha.padrao,
        mesBase: linha.mes_base,
        valorM2: linha.valor_m2,
        origem,
        mesAntigo,
        regime,
      },
      etapas: parametros.etapas.map((e, i) => ({ id: e.id, nome: e.nome, fase: e.fase, valor: reais(etapasCents[i]) })),
      adicionais: linhasAdicionais.map((l) => ({
        id: l.id,
        rotulo: l.rotulo,
        nota: l.nota,
        fase: l.fase,
        valor: l.cents === null ? null : reais(l.cents),
        aDefinir: l.cents === null,
        quantidade: l.quantidade,
        unidade: l.unidade,
        valorUnitario: l.valorUnitarioCents === null ? null : reais(l.valorUnitarioCents),
        origem: l.origem,
      })),
      origens: {
        cub: reais(baseCents),
        sinapi: reais(porOrigem.sinapi),
        empresa: reais(porOrigem.empresa),
        usuario: reais(porOrigem.usuario),
        referenciaPilar: reais(porOrigem.referencia_pilar),
        aDefinir: linhasAdicionais.filter((l) => l.cents === null).length,
        verificavelPct: Math.round(verificavelPct * 100) / 100,
        provisoriaPct: Math.round(provisoriaPct * 100) / 100,
        faixaExtraPontos: faixaExtra,
      },
      natureza,
      fases,
      desembolso: desembolsoCents.map((v, i) => ({ mes: mesIso(anoIni, mesIdx0 + i), valor: reais(v) })),
      meses,
      horas,
      equipe,
      avisos,
      parametrosValidados: entrada.parametrosValidados,
    },
  };
}
