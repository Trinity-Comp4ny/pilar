// Físico-financeiro da obra (spec 165): desembolso previsto por mês de cada nó da árvore (fase, etapa, serviço).
// Tudo aqui é cálculo puro: recebe o orçado já montado, o período de cada nó e o planejamento manual, e
// devolve a grade. Datas são texto "YYYY-MM-DD" lidas por partes, nunca por `Date`, para não depender de fuso.
import type { PontoDesembolso } from "@/lib/obras";
import type { Periodo } from "./obraArvore";
import type { LinhaOrcado } from "./orcadoRealizado";

/** "YYYY-MM" */
export type MesChave = string;

/** Passa disso a grade pede escala trimestral (spec 165, requisito 5). */
export const LIMITE_MESES = 60;

const centavos = (v: number): number => Math.round((v + Number.EPSILON) * 100) / 100;

interface Dia {
  ano: number;
  mes: number;
  dia: number;
}

function lerData(iso: string | null | undefined): Dia | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return null;
  const d = { ano: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) };
  if (d.mes < 1 || d.mes > 12 || d.dia < 1 || d.dia > diasNoMes(d.ano, d.mes)) return null;
  return d;
}

function diasNoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

const chaveDe = (ano: number, mes: number): MesChave => `${ano}-${String(mes).padStart(2, "0")}`;

/** Número do dia dentro do calendário gregoriano (UTC), para contar dias corridos sem fuso. */
const diaAbsoluto = (d: Dia): number => Math.floor(Date.UTC(d.ano, d.mes - 1, d.dia) / 86_400_000);

/** Meses de `inicio` a `fim`, inclusive, em ordem. Vazio se alguma data for inválida ou o fim vier antes do início. */
export function mesesEntre(inicio: string, fim: string): MesChave[] {
  const a = lerData(inicio);
  const b = lerData(fim);
  if (!a || !b || diaAbsoluto(b) < diaAbsoluto(a)) return [];
  const meses: MesChave[] = [];
  let ano = a.ano;
  let mes = a.mes;
  while (ano < b.ano || (ano === b.ano && mes <= b.mes)) {
    meses.push(chaveDe(ano, mes));
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
  }
  return meses;
}

/**
 * Reparte `previsto` linearmente por dia corrido entre `inicio` e `fim` (os dois dias contam). Cada mês recebe
 * `previsto × dias do período naquele mês ÷ dias do período`, em centavos; o resíduo de arredondamento fica no
 * último mês para a soma fechar no previsto. Período inválido devolve `{}`.
 */
export function distribuirLinear(previsto: number, inicio: string, fim: string): Record<MesChave, number> {
  const a = lerData(inicio);
  const b = lerData(fim);
  if (!a || !b || previsto <= 0) return {};
  const primeiro = diaAbsoluto(a);
  const ultimo = diaAbsoluto(b);
  if (ultimo < primeiro) return {};
  const total = ultimo - primeiro + 1;

  const meses = mesesEntre(inicio, fim);
  const diasPorMes = meses.map((chave) => {
    const [ano, mes] = chave.split("-").map(Number);
    const iniMes = diaAbsoluto({ ano, mes, dia: 1 });
    const fimMes = diaAbsoluto({ ano, mes, dia: diasNoMes(ano, mes) });
    return Math.max(0, Math.min(ultimo, fimMes) - Math.max(primeiro, iniMes) + 1);
  });

  const saida: Record<MesChave, number> = {};
  let acumulado = 0;
  meses.forEach((chave, i) => {
    const ehUltimo = i === meses.length - 1;
    const valor = ehUltimo ? centavos(previsto - acumulado) : centavos((previsto * diasPorMes[i]) / total);
    acumulado = centavos(acumulado + valor);
    saida[chave] = valor;
  });
  return saida;
}

export interface LinhaFF {
  id: string;
  parentId: string | null;
  nivel: LinhaOrcado["nivel"];
  nome: string;
  caminho: string;
  profundidade: number;
  /** Previsto do nó (o próprio, ou a soma dos filhos quando não há próprio). */
  previsto: number;
  porMes: Record<MesChave, number>;
  /** Parte do previsto que ficou sem mês por falta de datas. */
  semData: number;
  /** O nó tem planejamento gravado à mão e não acompanha o cronograma. */
  manual: boolean;
  /** Só em nó manual: 100 menos a soma dos percentuais (positivo = faltam, negativo = passou). */
  faltaPct: number | null;
  /** Falso nos filhos de um pai com previsto próprio: aparecem como detalhe e não somam de novo. */
  contaNoTotal: boolean;
  /** Dá para editar o mês à mão: o nó tem valor próprio (ou é folha com valor) e conta no total. */
  distribuivel: boolean;
  /** Só em nó manual: há valor em mês fora do período atual do cronograma (as datas mudaram depois do ajuste). */
  datasMudaram: boolean;
}

export interface FisicoFinanceiro {
  /** Eixo contínuo, do primeiro ao último mês com valor. */
  meses: MesChave[];
  linhas: LinhaFF[];
  totalPorMes: Record<MesChave, number>;
  acumuladoPorMes: Record<MesChave, number>;
  /** Previsto das linhas que contam no total e não têm mês. */
  semData: { valor: number; itens: number };
  totalPrevisto: number;
  /** Diferença entre o total previsto e o que a grade distribuiu (só diferente de 0 com nó manual que não fecha 100%). */
  diferencaManual: number;
  /** Mais meses do que `LIMITE_MESES`: a tela deve oferecer escala trimestral. */
  excedeLimite: boolean;
}

/** Planejamento manual por nó: percentual de cada mês ("YYYY-MM" para 0 a 100). */
export type PlanejamentoManual = ReadonlyMap<string, Readonly<Record<MesChave, number>>>;

interface Calculo {
  porMes: Record<MesChave, number>;
  semData: number;
  itensSemData: number;
}

const somar = (a: Record<MesChave, number>, b: Record<MesChave, number>): Record<MesChave, number> => {
  const r = { ...a };
  for (const [k, v] of Object.entries(b)) r[k] = centavos((r[k] ?? 0) + v);
  return r;
};

/**
 * Monta a grade. `arvore` vem de `montarOrcadoRealizado`; `periodoPorNo` é o `periodo` de cada nó em
 * `montarArvoreCronograma` (união do próprio, dos filhos e das tarefas); `manual` é o que está em
 * `obra_planejamento_mes`.
 */
export function montarFisicoFinanceiro(
  arvore: ReadonlyArray<LinhaOrcado>,
  periodoPorNo: ReadonlyMap<string, Periodo | null>,
  manual: PlanejamentoManual = new Map()
): FisicoFinanceiro {
  const linhas: LinhaFF[] = [];

  const visitar = (l: LinhaOrcado, parentId: string | null, conta: boolean): Calculo => {
    // Reserva o lugar do nó antes dos filhos para manter a ordem de leitura.
    const indice = linhas.length;
    const linha: LinhaFF = {
      id: l.no.id,
      parentId,
      nivel: l.nivel,
      nome: l.no.nome,
      caminho: l.caminho,
      profundidade: l.profundidade,
      previsto: l.previsto,
      porMes: {},
      semData: 0,
      manual: false,
      faltaPct: null,
      contaNoTotal: conta,
      distribuivel: false,
      datasMudaram: false,
    };
    linhas.push(linha);

    const temProprio = l.previstoProprio > 0;
    // Filho de pai com valor próprio é detalhe: calcula para mostrar, mas não soma no pai nem no total.
    const filhos = l.filhos.map((f) => visitar(f, l.no.id, conta && !temProprio));

    const grava = linhas[indice];
    const planejado = manual.get(l.no.id);
    const temManual = !!planejado && Object.keys(planejado).length > 0;

    grava.distribuivel = conta && l.previsto > 0 && (temProprio || filhos.length === 0);

    let calc: Calculo;
    if (temManual && l.previsto > 0) {
      const porMes: Record<MesChave, number> = {};
      let soma = 0;
      for (const [mes, pct] of Object.entries(planejado)) {
        porMes[mes] = centavos((l.previsto * pct) / 100);
        soma += pct;
      }
      grava.manual = true;
      grava.faltaPct = Math.round((100 - soma) * 10_000) / 10_000;
      const periodo = periodoPorNo.get(l.no.id) ?? null;
      if (periodo) {
        const noPeriodo = new Set(mesesEntre(periodo.inicio, periodo.fim));
        grava.datasMudaram = Object.entries(porMes).some(([mes, v]) => v > 0 && !noPeriodo.has(mes));
      }
      calc = { porMes, semData: 0, itensSemData: 0 };
    } else if (temProprio || filhos.length === 0) {
      const periodo = periodoPorNo.get(l.no.id) ?? null;
      const porMes = l.previsto > 0 && periodo ? distribuirLinear(l.previsto, periodo.inicio, periodo.fim) : {};
      const semMes = l.previsto > 0 && Object.keys(porMes).length === 0;
      calc = { porMes, semData: semMes ? l.previsto : 0, itensSemData: semMes ? 1 : 0 };
    } else {
      calc = filhos.reduce<Calculo>(
        (acc, f) => ({
          porMes: somar(acc.porMes, f.porMes),
          semData: centavos(acc.semData + f.semData),
          itensSemData: acc.itensSemData + f.itensSemData,
        }),
        { porMes: {}, semData: 0, itensSemData: 0 }
      );
    }

    grava.porMes = calc.porMes;
    grava.semData = calc.semData;
    return calc;
  };

  const raizes = arvore.map((r) => visitar(r, null, true));

  let totalPorMes: Record<MesChave, number> = {};
  let semDataValor = 0;
  let semDataItens = 0;
  for (const r of raizes) {
    totalPorMes = somar(totalPorMes, r.porMes);
    semDataValor = centavos(semDataValor + r.semData);
    semDataItens += r.itensSemData;
  }

  const chaves = Object.keys(totalPorMes).sort();
  const meses = chaves.length > 0 ? mesesEntre(`${chaves[0]}-01`, `${chaves[chaves.length - 1]}-01`) : [];
  const acumuladoPorMes: Record<MesChave, number> = {};
  let acumulado = 0;
  for (const m of meses) {
    acumulado = centavos(acumulado + (totalPorMes[m] ?? 0));
    acumuladoPorMes[m] = acumulado;
  }

  const totalPrevisto = centavos(arvore.reduce((a, r) => a + r.previsto, 0));
  return {
    meses,
    linhas,
    totalPorMes,
    acumuladoPorMes,
    semData: { valor: semDataValor, itens: semDataItens },
    totalPrevisto,
    diferencaManual: centavos(totalPrevisto - semDataValor - acumulado),
    excedeLimite: meses.length > LIMITE_MESES,
  };
}

/** Percentual de `valor` sobre `previsto`, com uma casa. 0 quando não há previsto. */
export function percentualDe(valor: number, previsto: number): number {
  return previsto > 0 ? Math.round((valor / previsto) * 1000) / 10 : 0;
}

/** Percentuais de um nó (`valor ÷ previsto`) prontos para gravar em `obra_planejamento_mes`, em 4 casas. */
export function percentuaisDoNo(
  porMes: Readonly<Record<MesChave, number>>,
  previsto: number
): Record<MesChave, number> {
  const r: Record<MesChave, number> = {};
  if (previsto <= 0) return r;
  for (const [mes, valor] of Object.entries(porMes)) r[mes] = Math.round((valor / previsto) * 1_000_000) / 10_000;
  return r;
}

/** "2026-11" → "2026-T4" */
export function trimestreDe(mes: MesChave): string {
  const [ano, m] = mes.split("-").map(Number);
  return `${ano}-T${Math.ceil(m / 3)}`;
}

/** Soma colunas de mês por trimestre; ordem de chegada dos meses é preservada. */
export function somarPorTrimestre(porMes: Readonly<Record<MesChave, number>>): Record<string, number> {
  const r: Record<string, number> = {};
  for (const mes of Object.keys(porMes).sort())
    r[trimestreDe(mes)] = centavos((r[trimestreDe(mes)] ?? 0) + porMes[mes]);
  return r;
}

const NOMES_MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-11" → "nov/26" */
export function rotuloMes(mes: MesChave): string {
  const [ano, m] = mes.split("-").map(Number);
  return `${NOMES_MES[m - 1] ?? "?"}/${String(ano).slice(2)}`;
}

/** "2026-T4" → "T4/26" */
export function rotuloTrimestre(tri: string): string {
  const [ano, t] = tri.split("-");
  return `${t}/${ano.slice(2)}`;
}

export type EscalaGrade = "mensal" | "trimestral";

export interface ColunaGrade {
  chave: string;
  rotulo: string;
  /** Meses que a coluna soma (um, na escala mensal). */
  meses: MesChave[];
}

/** Colunas da grade na escala escolhida. Trimestral agrupa os meses do eixo, mantendo a ordem. */
export function colunasDaEscala(meses: ReadonlyArray<MesChave>, escala: EscalaGrade): ColunaGrade[] {
  if (escala === "mensal") return meses.map((m) => ({ chave: m, rotulo: rotuloMes(m), meses: [m] }));
  const colunas: ColunaGrade[] = [];
  for (const m of meses) {
    const tri = trimestreDe(m);
    const ultima = colunas[colunas.length - 1];
    if (ultima && ultima.chave === tri) ultima.meses.push(m);
    else colunas.push({ chave: tri, rotulo: rotuloTrimestre(tri), meses: [m] });
  }
  return colunas;
}

/** Valor de uma linha numa coluna (soma dos meses que ela cobre). */
export function valorDaColuna(porMes: Readonly<Record<MesChave, number>>, coluna: ColunaGrade): number {
  return centavos(coluna.meses.reduce((a, m) => a + (porMes[m] ?? 0), 0));
}

export interface PontoPlanejadoRealizado {
  mes: MesChave;
  planejadoAcumulado: number;
  /** `null` depois do mês atual: o realizado ainda não existe. */
  realizadoAcumulado: number | null;
}

/**
 * Curva planejada acumulada contra o realizado acumulado (de `desembolsoAcumuladoPorMes`). O eixo cobre os dois;
 * antes do primeiro mês planejado o planejado é 0, e depois do último fica no total.
 */
export function curvaPlanejadoRealizado(
  ff: Pick<FisicoFinanceiro, "meses" | "acumuladoPorMes">,
  realizado: ReadonlyArray<PontoDesembolso>,
  mesAtual: MesChave
): PontoPlanejadoRealizado[] {
  const todas = [...ff.meses, ...realizado.map((p) => p.mes)].sort();
  if (todas.length === 0) return [];
  const eixo = mesesEntre(`${todas[0]}-01`, `${todas[todas.length - 1]}-01`);
  const real = new Map(realizado.map((p) => [p.mes, p.acumuladoRealizado]));

  let planejado = 0;
  let ultimoReal = 0;
  return eixo.map((mes) => {
    if (ff.acumuladoPorMes[mes] != null) planejado = ff.acumuladoPorMes[mes];
    if (real.has(mes)) ultimoReal = real.get(mes) ?? ultimoReal;
    return {
      mes,
      planejadoAcumulado: planejado,
      realizadoAcumulado: mes > mesAtual ? null : ultimoReal,
    };
  });
}

export interface DiferencaPlanejado {
  /** Realizado menos planejado: positivo = gastou mais do que o planejado até o mês. */
  valor: number;
  /** Sobre o planejado acumulado, uma casa; `null` quando o planejado ainda é zero. */
  pct: number | null;
}

/** Diferença do mês; `null` nos meses sem realizado (depois do mês atual). */
export function diferencaPlanejado(p: PontoPlanejadoRealizado): DiferencaPlanejado | null {
  if (p.realizadoAcumulado == null) return null;
  const valor = centavos(p.realizadoAcumulado - p.planejadoAcumulado);
  return { valor, pct: p.planejadoAcumulado > 0 ? Math.round((valor / p.planejadoAcumulado) * 1000) / 10 : null };
}

/** Período de cada nó (união do próprio, dos filhos e das tarefas) por id, a partir da árvore do cronograma. */
export function periodosPorNo(
  fases: ReadonlyArray<{ no: { id: string }; periodo: Periodo | null; filhos: ReadonlyArray<unknown> }>
): Map<string, Periodo | null> {
  type No = (typeof fases)[number];
  const mapa = new Map<string, Periodo | null>();
  const visitar = (a: No) => {
    mapa.set(a.no.id, a.periodo);
    (a.filhos as ReadonlyArray<No>).forEach(visitar);
  };
  fases.forEach(visitar);
  return mapa;
}

/** "12,5", "12.5", " 40 %" → número de 0 a 100; texto vazio, inválido ou fora da faixa → `null`. */
export function lerPercentual(texto: string): number | null {
  const limpo = texto.replace("%", "").trim().replace(",", ".");
  if (limpo === "" || !/^\d+(\.\d+)?$/.test(limpo)) return null;
  const n = Number(limpo);
  return n >= 0 && n <= 100 ? Math.round(n * 10_000) / 10_000 : null;
}

/**
 * Percentuais do nó inteiro depois de editar um mês: parte dos valores de hoje (automáticos ou manuais), põe zero
 * nos meses sem valor e troca o mês editado. Gravar o nó inteiro de uma vez o torna manual por completo.
 */
export function percentuaisAposEdicao(
  linha: Pick<LinhaFF, "porMes" | "previsto">,
  meses: ReadonlyArray<MesChave>,
  mes: MesChave,
  percentual: number
): Record<MesChave, number> {
  const atuais = percentuaisDoNo(linha.porMes, linha.previsto);
  const r: Record<MesChave, number> = {};
  for (const m of meses) r[m] = atuais[m] ?? 0;
  r[mes] = percentual;
  return r;
}
