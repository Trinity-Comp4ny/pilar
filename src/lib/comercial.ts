// Funil comercial: funções puras que juntam lead + proposta numa lente só
// (spec 022). O estágio continua sendo do lead; a proposta enriquece o card e
// os KPIs. Nada aqui muta estado nem toca o banco.
import type { Lead } from "@/hooks/useLeads";
import type { Proposta } from "@/hooks/usePropostas";

// Ordem dos estágios do lead, para decidir avanço/retrocesso sem retroceder
// um lead que já passou de "Proposta" (ex.: em "Negociação").
export const LEAD_STAGE_ORDER: Lead["status"][] = [
  "Novo",
  "Em contato",
  "Proposta",
  "Negociação",
  "Ganho",
  "Perdido",
];

/**
 * A proposta que representa o lead no funil quando há mais de uma: a mais
 * recente que não foi recusada. Retorna null se o lead não tem proposta viva
 * (ou só tem recusadas). Não conta um lead duas vezes num somatório.
 */
export function propostaPrimaria(propostas: Proposta[]): Proposta | null {
  const vivas = propostas
    .filter((p) => p.status !== "recusada")
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
  return vivas[0] ?? null;
}

/**
 * Status a exibir no badge. "expirada" é derivada em runtime (validade
 * vencida numa proposta ainda "enviada"), nunca persistida — o banco segue
 * com "enviada". Mesma regra que a tela de Documentos aplica no display.
 */
export function statusExibido(proposta: Proposta, hoje: Date = new Date()): string {
  if (proposta.status === "enviada" && proposta.validade) {
    const validade = new Date(proposta.validade + "T00:00:00");
    const inicioHoje = new Date(hoje);
    inicioHoje.setHours(0, 0, 0, 0);
    if (validade < inicioHoje) return "expirada";
  }
  return proposta.status;
}

/**
 * Valor do lead no funil: o valor proposto real quando há proposta primária,
 * senão o valor estimado (chute) do lead. Precedência que evita somar chute e
 * valor real ao mesmo tempo.
 */
export function valorNoFunil(lead: Lead, primaria: Proposta | null): number {
  return primaria?.valor_proposto ?? lead.valor_estimado ?? 0;
}

/**
 * Taxa de fechamento de propostas: de cada proposta que saiu do rascunho,
 * quantas foram aceitas. Denominador = propostas que já foram enviadas
 * (enviada/aceita/recusada/expirada), numerador = aceitas. Retorna null (sem
 * base) quando nenhuma proposta saiu do rascunho. É uma pergunta DIFERENTE da
 * conversão de lead (Ganho/Perdido) — por isso vive separada.
 */
export function taxaFechamentoPropostas(propostas: Proposta[], hoje: Date = new Date()): number | null {
  const decididas = propostas.filter((p) => statusExibido(p, hoje) !== "rascunho");
  if (decididas.length === 0) return null;
  const aceitas = decididas.filter((p) => statusExibido(p, hoje) === "aceita").length;
  return Math.round((aceitas / decididas.length) * 100);
}

/**
 * Agrupa propostas por lead_id (ignora as sem lead, que ficam só em
 * /documentos nesta v1). Usado para casar cada card do Kanban com sua proposta.
 */
export function propostasPorLead(propostas: Proposta[]): Map<string, Proposta[]> {
  const map = new Map<string, Proposta[]>();
  for (const p of propostas) {
    if (!p.lead_id) continue;
    const atual = map.get(p.lead_id);
    if (atual) atual.push(p);
    else map.set(p.lead_id, [p]);
  }
  return map;
}
