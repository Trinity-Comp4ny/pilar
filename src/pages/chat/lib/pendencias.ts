import type { Pendencia, PendenciaArea, PendenciaSeveridade } from "../hooks/useAgentePendencias";

export const AREAS: { key: PendenciaArea; label: string }[] = [
  { key: "financeiro", label: "Financeiro" },
  { key: "prazos", label: "Prazos" },
  { key: "orcamento", label: "Orçamento" },
  { key: "obra", label: "Obra" },
  { key: "planejamento", label: "Planejamento" },
  { key: "comercial", label: "Comercial" },
];

const PESO: Record<PendenciaSeveridade, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/** Ação preparada pelo agente: a pendência já vem com o próximo passo pronto para aprovar. */
const ACOES_PRONTAS = ["enviar_cobranca"];

export const ehPronta = (p: Pendencia) => !!p.acao_sugerida && ACOES_PRONTAS.includes(p.acao_sugerida);

export function ordenar(lista: Pendencia[]): Pendencia[] {
  return [...lista].sort(
    (a, b) => PESO[a.severidade] - PESO[b.severidade] || a.primeira_deteccao.localeCompare(b.primeira_deteccao)
  );
}

export type Grupos = {
  prontas: Pendencia[];
  urgentes: Pendencia[];
  semana: Pendencia[];
  planejar: Pendencia[];
};

/** Prontas para aprovar, urgentes (sem ação preparada), da semana (média) e para planejar (baixa). */
export function agrupar(lista: Pendencia[]): Grupos {
  const g: Grupos = { prontas: [], urgentes: [], semana: [], planejar: [] };
  for (const p of ordenar(lista)) {
    if (ehPronta(p)) g.prontas.push(p);
    else if (p.severidade === "critical" || p.severidade === "high") g.urgentes.push(p);
    else if (p.severidade === "medium") g.semana.push(p);
    else g.planejar.push(p);
  }
  return g;
}

export function contarPorArea(lista: Pendencia[]): Record<PendenciaArea, number> {
  const c: Record<PendenciaArea, number> = {
    financeiro: 0,
    prazos: 0,
    orcamento: 0,
    obra: 0,
    planejamento: 0,
    comercial: 0,
  };
  for (const p of lista) c[p.area] += 1;
  return c;
}

export const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
export const txt = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

const diaEmMs = 86_400_000;

/** Soma dias a uma data pura (yyyy-mm-dd) sem depender do fuso. */
export function somarDias(iso: string, dias: number): string {
  return new Date(Date.parse(`${iso}T12:00:00Z`) + dias * diaEmMs).toISOString().slice(0, 10);
}

/** Dias inteiros desde um instante ISO até hoje (0 no mesmo dia). */
export function diasDesde(iso: string, agora = new Date()): number {
  return Math.max(0, Math.floor((agora.getTime() - Date.parse(iso)) / diaEmMs));
}

export const plural = (n: number, singular: string, pluralTxt: string) => `${n} ${n === 1 ? singular : pluralTxt}`;

/** Escada de cobrança da SPEC 148: dias em relação ao vencimento e o nome de cada etapa. */
export const ETAPAS_COBRANCA = [
  { etapa: 1, nome: "Lembrete cordial", quando: "3 dias antes", offset: -3 },
  { etapa: 2, nome: "Aviso simples", quando: "1 dia depois", offset: 1 },
  { etapa: 3, nome: "Cobrança direta", quando: "7 dias depois", offset: 7 },
  { etapa: 4, nome: "Cobrança firme", quando: "15 dias depois", offset: 15 },
  { etapa: 5, nome: "Ligar ou negociar", quando: "30 dias depois, sem e-mail", offset: 30 },
] as const;
