/** Estado do link de cotação que o escritório vê (SPEC 144). Derivado das datas do convite. */
export type EstadoConvite = "enviado" | "aberto" | "respondido" | "expirado" | "revogado";

export interface ConviteDatas {
  expira_em: string;
  aberto_em: string | null;
  respondido_em: string | null;
  revogado_em: string | null;
}

/** Revogar é ação explícita e vale primeiro; depois vem o que o fornecedor fez; por fim o relógio. */
export function estadoDoConvite(c: ConviteDatas, agora: Date = new Date()): EstadoConvite {
  if (c.revogado_em) return "revogado";
  if (c.respondido_em) return "respondido";
  if (new Date(c.expira_em).getTime() <= agora.getTime()) return "expirado";
  if (c.aberto_em) return "aberto";
  return "enviado";
}

/** Só link ainda vivo e sem resposta pode ser revogado. */
export const podeRevogarConvite = (e: EstadoConvite) => e === "enviado" || e === "aberto";

/** Endereço que o escritório manda ao fornecedor. O token só existe neste momento. */
export const linkDaCotacao = (origem: string, token: string) => `${origem}/cotar/${token}`;

export const CRITERIOS_AVALIACAO = [
  { chave: "demora", rotulo: "Demora na resposta" },
  { chave: "preco", rotulo: "Preço" },
  { chave: "prazo", rotulo: "Prazo de entrega" },
  { chave: "qualidade", rotulo: "Qualidade" },
] as const;

export type ChaveCriterio = (typeof CRITERIOS_AVALIACAO)[number]["chave"];
export type NotasAvaliacao = Record<ChaveCriterio, number | null>;

/** Média dos critérios preenchidos, uma casa decimal (a mesma conta do banco). */
export function notaGeral(notas: NotasAvaliacao): number | null {
  const preenchidas = Object.values(notas).filter((n): n is number => n !== null);
  if (preenchidas.length === 0) return null;
  const media = preenchidas.reduce((a, b) => a + b, 0) / preenchidas.length;
  return Math.round(media * 10) / 10;
}

/** "4,2" no formato do Brasil. */
export const formatarNota = (n: number | null | undefined) => (n == null ? "-" : n.toFixed(1).replace(".", ","));

/** "04/11/2026" a partir de um timestamp ISO (o formatDate do app espera só a data, sem hora). */
export function diaDoTimestamp(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("pt-BR");
}
