import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/format";

/**
 * Domínio das metas (SPEC 123). Uma meta é indicador + alvo + período + escopo.
 *
 * O catálogo de indicadores espelha o CHECK `metas_indicador_check` e a função
 * `_meta_valor` do banco (migration 20261103000000). Indicador novo entra nos dois
 * lugares; `metas.test.ts` reprova se as chaves divergirem.
 */

export type MetaUnidade = "currency" | "percentage" | "quantity";
export type MetaRecorrencia = "nenhuma" | "mensal" | "trimestral" | "anual";

export type MetaIndicador =
  | "receita_recebida"
  | "lucro"
  | "margem_media"
  | "projetos_concluidos"
  | "projetos_ativos"
  | "disciplinas_concluidas"
  | "tarefas_concluidas"
  | "leads_ganhos";

export type IndicadorGrupo = "Financeiro" | "Projetos" | "Entregas" | "Comercial";

/** Texto fixo (digitado na meta manual) ou par singular/plural (indicadores do catálogo). */
export type RotuloUnidade = string | { um: string; muitos: string };

export interface IndicadorDef {
  key: MetaIndicador;
  label: string;
  grupo: IndicadorGrupo;
  unidade: MetaUnidade;
  /** Como a quantidade aparece depois do número no nome sugerido ("5 projetos concluídos"). */
  frase: string;
  /** Rótulo curto da quantidade nos cartões ("1 projeto", "3 projetos"). Só para unidade "quantity". */
  rotulo: RotuloUnidade | null;
  /** Pode ser medido por colaborador. Os demais valem só para a empresa toda. */
  aceitaPessoa: boolean;
  /** Exige acesso ao financeiro (ADR 0046) para ver o valor. */
  financeiro: boolean;
  /** Retrato de hoje: não depende de período. */
  pontual: boolean;
}

export const INDICADORES: readonly IndicadorDef[] = [
  {
    key: "receita_recebida",
    label: "Faturamento recebido",
    grupo: "Financeiro",
    unidade: "currency",
    frase: "faturamento recebido",
    rotulo: null,
    aceitaPessoa: false,
    financeiro: true,
    pontual: false,
  },
  {
    key: "lucro",
    label: "Lucro",
    grupo: "Financeiro",
    unidade: "currency",
    frase: "lucro",
    rotulo: null,
    aceitaPessoa: false,
    financeiro: true,
    pontual: false,
  },
  {
    key: "margem_media",
    label: "Margem média",
    grupo: "Financeiro",
    unidade: "percentage",
    frase: "margem média",
    rotulo: null,
    aceitaPessoa: false,
    financeiro: true,
    pontual: false,
  },
  {
    key: "projetos_concluidos",
    label: "Projetos concluídos",
    grupo: "Projetos",
    unidade: "quantity",
    frase: "projetos concluídos",
    rotulo: { um: "projeto", muitos: "projetos" },
    aceitaPessoa: true,
    financeiro: false,
    pontual: false,
  },
  {
    key: "projetos_ativos",
    label: "Projetos ativos",
    grupo: "Projetos",
    unidade: "quantity",
    frase: "projetos ativos",
    rotulo: { um: "projeto", muitos: "projetos" },
    aceitaPessoa: true,
    financeiro: false,
    pontual: true,
  },
  {
    key: "disciplinas_concluidas",
    label: "Disciplinas concluídas",
    grupo: "Entregas",
    unidade: "quantity",
    frase: "disciplinas concluídas",
    rotulo: { um: "disciplina", muitos: "disciplinas" },
    aceitaPessoa: true,
    financeiro: false,
    pontual: false,
  },
  {
    key: "tarefas_concluidas",
    label: "Tarefas concluídas",
    grupo: "Entregas",
    unidade: "quantity",
    frase: "tarefas concluídas",
    rotulo: { um: "tarefa", muitos: "tarefas" },
    aceitaPessoa: true,
    financeiro: false,
    pontual: false,
  },
  {
    key: "leads_ganhos",
    label: "Leads ganhos",
    grupo: "Comercial",
    unidade: "quantity",
    frase: "leads ganhos",
    rotulo: { um: "lead", muitos: "leads" },
    aceitaPessoa: false,
    financeiro: false,
    pontual: false,
  },
];

export const INDICADOR_POR_CHAVE: Record<string, IndicadorDef> = Object.fromEntries(INDICADORES.map((i) => [i.key, i]));

export const GRUPOS_INDICADOR: readonly IndicadorGrupo[] = ["Financeiro", "Projetos", "Entregas", "Comercial"];

export const UNIDADES: readonly { value: MetaUnidade; label: string }[] = [
  { value: "currency", label: "Valor (R$)" },
  { value: "percentage", label: "Percentual (%)" },
  { value: "quantity", label: "Quantidade" },
];

// Precisa casar com o CHECK de metas_categoria (migration 20261103000000).
export const AREAS: readonly { value: string; label: string }[] = [
  { value: "geral", label: "Geral" },
  { value: "rh", label: "RH" },
  { value: "financeiro", label: "Financeiro" },
  { value: "comercial", label: "Comercial" },
  { value: "logistica", label: "Logística" },
  { value: "administrativo", label: "Administrativo" },
  { value: "operacoes", label: "Operações" },
  { value: "inovacao", label: "Inovação" },
];

export const areaLabel = (v: string | null | undefined): string | null =>
  v ? (AREAS.find((a) => a.value === v)?.label ?? v) : null;

export const RECORRENCIAS: readonly { value: MetaRecorrencia; label: string }[] = [
  { value: "mensal", label: "Todo mês" },
  { value: "trimestral", label: "Todo trimestre" },
  { value: "anual", label: "Todo ano" },
  { value: "nenhuma", label: "Datas específicas" },
];

export interface MetaRow {
  id: string;
  nome: string;
  alvo: number;
  atual: number;
  prazo: string | null;
  categoria: string | null;
  pessoa_id: string | null;
  descricao: string | null;
  unidade: string;
  unidade_rotulo: string | null;
  indicador: string | null;
  periodo_inicio: string | null;
  recorrencia: string;
  created_at: string;
}

/** Linha de `rpc_metas_progresso`. */
export interface MetaProgresso {
  meta_id: string;
  atual: number | null;
  janela_inicio: string | null;
  janela_fim: string | null;
  restrito: boolean;
}

/** Meta com o progresso do período corrente já resolvido. */
export interface MetaView {
  meta: MetaRow;
  /** Null quando o valor é restrito (indicador financeiro sem acesso ao financeiro). */
  atual: number | null;
  restrito: boolean;
  janelaInicio: string | null;
  janelaFim: string | null;
  percent: number;
  status: MetaStatus;
}

export type MetaStatus = "em_andamento" | "concluida" | "atrasada";

export const STATUS_LABEL: Record<MetaStatus, string> = {
  em_andamento: "Em andamento",
  concluida: "Concluída",
  atrasada: "Atrasada",
};

/** Percentual do alvo, de 0 a 100. Alvo 0 ou valor ausente não gera NaN. */
export function percentual(atual: number | null | undefined, alvo: number): number {
  if (atual == null || !Number.isFinite(atual) || !Number.isFinite(alvo) || alvo <= 0) return 0;
  return Math.min(Math.max(Math.round((atual / alvo) * 100), 0), 100);
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** Data local em "yyyy-MM-dd" (não usa toISOString: ele converte para UTC e desloca o dia). */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Período que contém `ref`, para recorrência mensal, trimestral ou anual. Espelha `_meta_janela`. */
export function janelaDoPeriodo(
  recorrencia: Exclude<MetaRecorrencia, "nenhuma">,
  ref: Date
): { inicio: string; fim: string } {
  const ano = ref.getFullYear();
  const mes = ref.getMonth();
  if (recorrencia === "anual") {
    return { inicio: toIsoDate(new Date(ano, 0, 1)), fim: toIsoDate(new Date(ano, 11, 31)) };
  }
  if (recorrencia === "trimestral") {
    const m0 = Math.floor(mes / 3) * 3;
    return { inicio: toIsoDate(new Date(ano, m0, 1)), fim: toIsoDate(new Date(ano, m0 + 3, 0)) };
  }
  return { inicio: toIsoDate(new Date(ano, mes, 1)), fim: toIsoDate(new Date(ano, mes + 1, 0)) };
}

export interface AtalhoPeriodo {
  label: string;
  inicio: string;
  fim: string;
}

/** Atalhos do campo "Datas específicas". */
export function atalhosDePeriodo(hoje: Date): AtalhoPeriodo[] {
  const ano = hoje.getFullYear();
  const mes = janelaDoPeriodo("mensal", hoje);
  const tri = janelaDoPeriodo("trimestral", hoje);
  return [
    { label: "Este mês", ...mes },
    { label: "Este trimestre", ...tri },
    { label: "Este ano", inicio: toIsoDate(new Date(ano, 0, 1)), fim: toIsoDate(new Date(ano, 11, 31)) },
    { label: "Ano que vem", inicio: toIsoDate(new Date(ano + 1, 0, 1)), fim: toIsoDate(new Date(ano + 1, 11, 31)) },
  ];
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const parseIso = (iso: string): Date => {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d);
};

/** "out/2026", "4º tri/2026", "2026" ou o intervalo de datas. */
export function rotuloJanela(
  recorrencia: string,
  inicio: string | null | undefined,
  fim: string | null | undefined
): string {
  if (recorrencia === "mensal" && inicio) {
    const d = parseIso(inicio);
    return `${MESES[d.getMonth()]}/${d.getFullYear()}`;
  }
  if (recorrencia === "trimestral" && inicio) {
    const d = parseIso(inicio);
    return `${Math.floor(d.getMonth() / 3) + 1}º tri/${d.getFullYear()}`;
  }
  if (recorrencia === "anual" && inicio) return String(parseIso(inicio).getFullYear());
  if (inicio && fim) return `${formatDate(inicio)} a ${formatDate(fim)}`;
  if (fim) return `até ${formatDate(fim)}`;
  if (inicio) return `desde ${formatDate(inicio)}`;
  return "sem prazo";
}

/** Quanto vale o alvo: "R$ 500.000", "35%", "5" (ou "5 projetos" quando há rótulo). */
export function formatarValor(
  valor: number,
  unidade: string | null | undefined,
  rotulo?: RotuloUnidade | null
): string {
  if (unidade === "currency") return formatCurrency(valor, { decimals: Number.isInteger(valor) ? 0 : 2 });
  if (unidade === "percentage") return formatPercent(valor, Number.isInteger(valor) ? 0 : 1);
  if (!rotulo) return formatNumber(valor);
  const texto = typeof rotulo === "string" ? rotulo : valor === 1 ? rotulo.um : rotulo.muitos;
  return `${formatNumber(valor)} ${texto}`;
}

/** Rótulo da unidade "quantidade": o digitado na meta manual ou o do indicador. */
export function rotuloDaMeta(meta: Pick<MetaRow, "indicador" | "unidade_rotulo">): RotuloUnidade | null {
  if (meta.unidade_rotulo) return meta.unidade_rotulo;
  const def = meta.indicador ? INDICADOR_POR_CHAVE[meta.indicador] : undefined;
  return def?.unidade === "quantity" ? def.rotulo : null;
}

const PERIODICIDADE: Record<string, string> = {
  mensal: " por mês",
  trimestral: " por trimestre",
  anual: " por ano",
};

export interface EntradaNome {
  indicador: string | null;
  alvo: number;
  recorrencia: MetaRecorrencia;
  inicio?: string | null;
  fim?: string | null;
  /** Nome completo da pessoa; só o primeiro nome entra no texto. */
  pessoaNome?: string | null;
}

function sufixoPeriodo({ recorrencia, inicio, fim }: EntradaNome): string {
  if (recorrencia !== "nenhuma") return PERIODICIDADE[recorrencia];
  if (inicio && fim) {
    const a = parseIso(inicio);
    const b = parseIso(fim);
    const anoInteiro =
      a.getFullYear() === b.getFullYear() && a.getMonth() === 0 && a.getDate() === 1 && b.getMonth() === 11;
    if (anoInteiro) return ` em ${a.getFullYear()}`;
  }
  return fim ? ` até ${formatDate(fim)}` : "";
}

/**
 * Nome sugerido para meta de indicador: "Rafael: 5 projetos concluídos por mês",
 * "Faturamento recebido de R$ 500.000 em 2027". Meta manual ou sem alvo não tem sugestão.
 */
export function sugerirNomeMeta(entrada: EntradaNome): string {
  const def = entrada.indicador ? INDICADOR_POR_CHAVE[entrada.indicador] : undefined;
  if (!def || !(entrada.alvo > 0)) return "";

  let corpo: string;
  if (def.unidade === "currency") corpo = `${def.label} de ${formatarValor(entrada.alvo, "currency")}`;
  else if (def.unidade === "percentage") corpo = `${def.label} de ${formatarValor(entrada.alvo, "percentage")}`;
  else corpo = `${formatNumber(entrada.alvo)} ${def.frase}`;

  const pontual = def.pontual ? "" : sufixoPeriodo(entrada);
  const primeiroNome = entrada.pessoaNome?.trim().split(/\s+/)[0];
  return primeiroNome ? `${primeiroNome}: ${corpo}${pontual}` : `${corpo}${pontual}`;
}

/** Concluída quando bate o alvo; atrasada quando o prazo de uma meta de datas passou sem bater. */
export function statusDaMeta(
  meta: Pick<MetaRow, "alvo" | "prazo" | "recorrencia">,
  atual: number | null,
  hoje: Date
): MetaStatus {
  if (atual != null && meta.alvo > 0 && atual >= meta.alvo) return "concluida";
  // "yyyy-MM-dd" compara como texto.
  if (meta.recorrencia === "nenhuma" && meta.prazo && meta.prazo < toIsoDate(hoje)) return "atrasada";
  return "em_andamento";
}

/** Junta a meta ao progresso calculado no banco. Sem linha de progresso, cai no `atual` gravado. */
export function montarMetaView(meta: MetaRow, progresso: MetaProgresso | undefined, hoje: Date): MetaView {
  const restrito = progresso?.restrito ?? false;
  const atual = restrito ? null : (progresso?.atual ?? meta.atual);
  return {
    meta,
    atual,
    restrito,
    janelaInicio: progresso?.janela_inicio ?? null,
    janelaFim: progresso?.janela_fim ?? null,
    percent: percentual(atual, meta.alvo),
    status: statusDaMeta(meta, atual, hoje),
  };
}
