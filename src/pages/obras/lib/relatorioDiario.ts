import { climaLabel, condicaoLabel } from "@/lib/obras";
import type { RdoRow } from "@/pages/obras/hooks/useObraRdo";

export interface PeriodoRelatorio {
  de: string;
  ate: string;
}

const isoDia = (d: Date) => d.toISOString().slice(0, 10);

/** Últimos 7 dias, contando hoje: o período que a prestação de contas semanal costuma pedir. */
export function periodoPadrao(hoje: Date = new Date()): PeriodoRelatorio {
  const ini = new Date(hoje);
  ini.setDate(ini.getDate() - 6);
  return { de: isoDia(ini), ate: isoDia(hoje) };
}

/** Período válido: as duas datas preenchidas e o início não vem depois do fim. */
export const periodoValido = (p: PeriodoRelatorio) => !!p.de && !!p.ate && p.de <= p.ate;

/** Dias do diário dentro do período (inclusive), do mais antigo para o mais novo, como se lê um relatório. */
export function rdosDoPeriodo(rdos: RdoRow[], p: PeriodoRelatorio): RdoRow[] {
  if (!periodoValido(p)) return [];
  return rdos.filter((r) => r.data >= p.de && r.data <= p.ate).sort((a, b) => a.data.localeCompare(b.data));
}

const dataBr = (iso: string) => iso.split("-").reverse().join("/");

/** Texto curto para a folha de compartilhar do celular (WhatsApp, e-mail). */
export function textoDoRelatorio(obraNome: string, p: PeriodoRelatorio, rdos: RdoRow[]): string {
  const cab = `Diário de obra · ${obraNome}\n${dataBr(p.de)} a ${dataBr(p.ate)}`;
  if (rdos.length === 0) return `${cab}\n\nSem registros no período.`;
  const dias = rdos.map((r) => {
    const meta = [climaLabel(r.clima), condicaoLabel(r.condicao_trabalho)].filter(Boolean).join(" · ");
    const linhas = [`${dataBr(r.data)}${meta ? ` (${meta})` : ""}`];
    if (r.atividades) linhas.push(`Atividades: ${r.atividades}`);
    if (r.ocorrencias) linhas.push(`Ocorrências: ${r.ocorrencias}`);
    if (r.pendencias) linhas.push(`Pendências: ${r.pendencias}`);
    return linhas.join("\n");
  });
  return `${cab}\n\n${dias.join("\n\n")}`;
}
