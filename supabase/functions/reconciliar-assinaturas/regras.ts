/**
 * Regras puras da reconciliação diária (SPEC 114): o que conta como divergência entre
 * a assinatura no banco e no Asaas, e quando um aviso repetido deve ser suprimido.
 */

export const DIA_MS = 24 * 60 * 60 * 1000;
/** Cobrança vencida há menos que isto ainda pode receber o webhook: não acusa. */
export const TOLERANCIA_ATRASO_DIAS = 1;
/** Mesma lista de divergências não é reavisada antes disto. */
export const SILENCIO_DIAS = 7;

export type CodigoDivergencia =
  | "cancelada_no_asaas"
  | "ativa_no_asaas"
  | "atraso_nao_registrado"
  | "pagamento_nao_registrado"
  | "valor_divergente"
  | "ciclo_divergente";

export interface Divergencia {
  codigo: CodigoDivergencia;
  descricao: string;
}

export interface AssinaturaBanco {
  status: string; // trialing | active | overdue | canceled | expired
  billing_cycle: string | null; // monthly | yearly
  preco_mensal: number | null;
  preco_anual: number | null;
}

export interface AssinaturaAsaas {
  status: string; // ACTIVE | INACTIVE | EXPIRED
  deleted?: boolean;
  value: number;
  cycle: string; // MONTHLY | YEARLY | ...
}

export interface CobrancaAsaas {
  status: string; // PENDING | OVERDUE | RECEIVED | CONFIRMED | REFUNDED | ...
  dueDate: string; // YYYY-MM-DD
}

const PAGA = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);
const brl = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

export function compararAssinatura(
  banco: AssinaturaBanco,
  asaas: AssinaturaAsaas,
  cobrancas: CobrancaAsaas[],
  agora: number
): Divergencia[] {
  const out: Divergencia[] = [];
  const ativaNoAsaas = !asaas.deleted && asaas.status === "ACTIVE";
  const emVigor = banco.status === "active" || banco.status === "overdue";

  if (emVigor && !ativaNoAsaas) {
    out.push({
      codigo: "cancelada_no_asaas",
      descricao: `No banco está "${banco.status}", mas no Asaas a assinatura está ${asaas.deleted ? "removida" : asaas.status}. O cliente não está sendo cobrado.`,
    });
  }
  if (banco.status === "canceled" && ativaNoAsaas) {
    out.push({
      codigo: "ativa_no_asaas",
      descricao: "Cancelada no banco, mas ainda ativa no Asaas: o cliente continua sendo cobrado. Cancele no Asaas.",
    });
  }

  // Cobranças ordenadas da mais recente para a mais antiga (contrato da consulta).
  const vencidas = cobrancas.filter((c) => {
    const venc = new Date(`${c.dueDate}T00:00:00Z`).getTime();
    return Number.isFinite(venc) && agora - venc > TOLERANCIA_ATRASO_DIAS * DIA_MS;
  });
  const ultimaVencida = vencidas[0];

  if (banco.status === "active" && ultimaVencida?.status === "OVERDUE") {
    out.push({
      codigo: "atraso_nao_registrado",
      descricao: `Cobrança de ${ultimaVencida.dueDate} está vencida no Asaas, mas a assinatura segue "active" no banco.`,
    });
  }
  if (banco.status === "overdue" && ultimaVencida && PAGA.has(ultimaVencida.status)) {
    out.push({
      codigo: "pagamento_nao_registrado",
      descricao: `Cobrança de ${ultimaVencida.dueDate} está paga no Asaas, mas a assinatura segue "overdue" no banco.`,
    });
  }

  if (emVigor && ativaNoAsaas) {
    const anual = banco.billing_cycle === "yearly";
    const cicloAsaas = asaas.cycle === "YEARLY" ? "yearly" : asaas.cycle === "MONTHLY" ? "monthly" : asaas.cycle;
    if (banco.billing_cycle && cicloAsaas !== banco.billing_cycle) {
      out.push({
        codigo: "ciclo_divergente",
        descricao: `Ciclo "${banco.billing_cycle}" no banco e "${asaas.cycle}" no Asaas.`,
      });
    }
    const esperado = anual ? banco.preco_anual : banco.preco_mensal;
    if (esperado != null && Math.abs(esperado - asaas.value) > 0.01) {
      out.push({
        codigo: "valor_divergente",
        descricao: `Plano custa ${brl(esperado)} no ciclo do banco, Asaas cobra ${brl(asaas.value)}.`,
      });
    }
  }

  return out;
}

/** Chave estável de uma lista de divergências, para comparar rodadas. */
export function assinaturaDaLista(divergencias: Divergencia[]): string {
  return [...new Set(divergencias.map((d) => d.codigo))].sort().join(",");
}

/** Reavisa só se a lista mudou ou se o último aviso igual tem mais de SILENCIO_DIAS. */
export function deveAvisar(
  divergencias: Divergencia[],
  ultimoAviso: { chave: string; em: string } | null,
  agora: number
): boolean {
  if (divergencias.length === 0) return false;
  if (!ultimoAviso) return true;
  if (ultimoAviso.chave !== assinaturaDaLista(divergencias)) return true;
  return agora - new Date(ultimoAviso.em).getTime() >= SILENCIO_DIAS * DIA_MS;
}
