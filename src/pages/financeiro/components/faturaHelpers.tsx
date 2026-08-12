import { Badge } from "@/components/ui/badge";

export const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function isFaturaVencida(status: string, dataVencimento: string): boolean {
  // Parse local (T00:00:00): sem isso a fatura era marcada "Vencida" horas antes,
  // no próprio dia do vencimento, em UTC-3.
  return status !== "Paga" && new Date(dataVencimento + "T00:00:00") < new Date();
}

export function getStatusBadge(status: string, dataVencimento: string) {
  if (status === "Paga")
    return <Badge className="bg-positive/10 text-positive-strong hover:bg-positive/10">Paga</Badge>;
  if (isFaturaVencida(status, dataVencimento))
    return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Vencida</Badge>;
  if (status === "Parcial") return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Parcial</Badge>;
  if (status === "Fechada") return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Fechada</Badge>;
  return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Aberta</Badge>;
}

// Vencimento relativo em linguagem curta: "vencida 2d", "vence hoje", "vence em 3d".
export function vencimentoRelativo(status: string, dataVencimento: string): { label: string; vencida: boolean } {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = new Date(dataVencimento + "T00:00:00");
  const dias = Math.round((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  if (status === "Paga") return { label: "paga", vencida: false };
  if (dias < 0) return { label: `vencida ${Math.abs(dias)}d`, vencida: true };
  if (dias === 0) return { label: "vence hoje", vencida: true };
  if (dias === 1) return { label: "vence amanhã", vencida: false };
  return { label: `vence em ${dias}d`, vencida: false };
}
