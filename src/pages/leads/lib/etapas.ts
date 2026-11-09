// Regras puras das colunas do funil de leads (SPEC 120). O bucket da coluna
// ("Conta como") guarda o comportamento; o nome é livre.
import type { Lead } from "@/hooks/useLeads";
import type { LeadBucket, LeadEtapa } from "@/pages/leads/hooks/useLeadEtapas";

export const LEAD_BUCKETS: readonly LeadBucket[] = ["Novo", "Em contato", "Proposta", "Negociação", "Ganho", "Perdido"];

// Paleta das colunas (hex em lead_etapas.cor; o dot usa backgroundColor inline).
// As seis primeiras são as cores padrão semeadas no banco.
export const CORES_ETAPA_LEAD = [
  "#3b82f6",
  "#6366f1",
  "#eab308",
  "#a4ec86",
  "#22c55e",
  "#ef4444",
  "#ec4899",
  "#14b8a6",
] as const;

const COR_POR_BUCKET: Record<LeadBucket, string> = {
  Novo: "#3b82f6",
  "Em contato": "#6366f1",
  Proposta: "#eab308",
  Negociação: "#a4ec86",
  Ganho: "#22c55e",
  Perdido: "#ef4444",
};

/** Cor do dot: a escolhida na coluna, senão a padrão do bucket. */
export function corDaEtapaLead(cor: string | null | undefined, bucket: LeadBucket): string {
  return cor ?? COR_POR_BUCKET[bucket];
}

const ehFinal = (b: LeadBucket) => b === "Ganho" || b === "Perdido";

/**
 * Coluna em que o lead aparece. Usa `etapa_id`; se faltar (dado legado ou lead
 * sem coluna), cai na primeira coluna do bucket do status e, por último, na
 * primeira coluna aberta, para o card nunca sumir do quadro.
 */
export function etapaDoLead(lead: Pick<Lead, "etapa_id" | "status">, etapas: LeadEtapa[]): LeadEtapa | null {
  if (lead.etapa_id) {
    const direta = etapas.find((e) => e.id === lead.etapa_id);
    if (direta) return direta;
  }
  return (
    etapas.find((e) => e.bucket === lead.status) ??
    (ehFinal(lead.status) ? null : (etapas.find((e) => !ehFinal(e.bucket)) ?? null))
  );
}

/** Leads por id de coluna. Leads sem coluna possível ficam fora. */
export function agruparPorEtapa(leads: Lead[], etapas: LeadEtapa[]): Map<string, Lead[]> {
  const grupos = new Map<string, Lead[]>(etapas.map((e) => [e.id, []]));
  for (const lead of leads) {
    const etapa = etapaDoLead(lead, etapas);
    if (etapa) grupos.get(etapa.id)?.push(lead);
  }
  return grupos;
}

export type AcaoDoDrop = "motivo-perda" | "converter" | "mover";

/**
 * O que acontece ao soltar o lead na coluna: Perdido pede o motivo, Ganho abre a
 * conversão em cliente (se ainda não é cliente), o resto só move.
 */
export function acaoDoDrop(destino: Pick<LeadEtapa, "bucket">, lead: Pick<Lead, "cliente_id">): AcaoDoDrop {
  if (destino.bucket === "Perdido") return "motivo-perda";
  if (destino.bucket === "Ganho" && !lead.cliente_id) return "converter";
  return "mover";
}

/** Primeira coluna de um bucket (por ordem), usada para "Converter" fora do quadro. */
export function primeiraEtapaDoBucket(etapas: LeadEtapa[], bucket: LeadBucket): LeadEtapa | null {
  return [...etapas].sort((a, b) => a.ordem - b.ordem).find((e) => e.bucket === bucket) ?? null;
}

/** Mensagem do porquê a coluna não pode ser excluída, ou null se pode. */
export function motivoNaoExcluir(etapa: LeadEtapa, etapas: LeadEtapa[], totalLeads: number): string | null {
  if (totalLeads > 0) {
    const n = totalLeads === 1 ? "1 lead" : `${totalLeads} leads`;
    return `Esta coluna tem ${n}. Mova para outra coluna antes de excluir.`;
  }
  if (ehFinal(etapa.bucket) && !etapas.some((e) => e.id !== etapa.id && e.bucket === etapa.bucket)) {
    return `O funil precisa de pelo menos uma coluna que conta como ${etapa.bucket}. Crie outra antes de excluir esta.`;
  }
  return null;
}

/** Ordem da próxima coluna criada (vai para o fim). */
export function proximaOrdem(etapas: LeadEtapa[]): number {
  return etapas.reduce((m, e) => Math.max(m, e.ordem), -1) + 1;
}

/** Troca a ordem com o vizinho; null se já está na ponta. */
export function trocarOrdem(etapas: LeadEtapa[], id: string, dir: -1 | 1): { id: string; ordem: number }[] | null {
  const lista = [...etapas].sort((a, b) => a.ordem - b.ordem);
  const i = lista.findIndex((e) => e.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= lista.length) return null;
  return [
    { id: lista[i].id, ordem: lista[j].ordem },
    { id: lista[j].id, ordem: lista[i].ordem },
  ];
}

/**
 * Mensagem do banco quando é uma regra do funil (coluna com lead, última de
 * Ganho/Perdido, tipo imutável); qualquer outro erro vira o texto de fallback.
 */
export function mensagemDoBancoEtapa(err: unknown, fallback: string): string {
  const e = err as { code?: string; message?: string } | null;
  if (e && (e.code === "P0001" || e.code === "23503") && e.message) return e.message;
  return fallback;
}
