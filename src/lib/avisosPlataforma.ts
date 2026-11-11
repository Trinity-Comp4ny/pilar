/**
 * Faixa de avisos da plataforma (SPEC 153): o que o ultra admin declarou em Incidentes vira
 * aviso para quem está usando o Pilar. Regra pura (sem React, sem rede) para dar para testar.
 *
 * - Incidente aberto: faixa com a cor da severidade e a última atualização.
 * - Incidente resolvido há menos de 30 min: "Normalizado", depois some.
 * - Manutenção: 24 h antes ("programada") e durante ("em andamento"); cancelada não aparece.
 */
export type Severidade = "degradado" | "parcial" | "outage";
export type TomAviso = "danger" | "attention" | "warning" | "info" | "positive";

export interface IncidenteAviso {
  id: string;
  titulo: string;
  severidade: Severidade;
  status: string;
  resolvidoEm: string | null;
  componentes: string[];
  ultimaAtualizacao: { id: string; mensagem: string } | null;
}

export interface ManutencaoAviso {
  id: string;
  titulo: string;
  mensagem: string | null;
  inicio: string;
  fim: string;
  canceladaEm: string | null;
}

export interface Aviso {
  /** Muda quando o conteúdo muda: dispensar vale até a próxima atualização. */
  chave: string;
  tom: TomAviso;
  titulo: string;
  texto: string;
  detalhe: string | null;
  /** Comunicado (SPEC 157): link opcional e dispensa gravada no banco, não só na aba. */
  link?: { url: string; rotulo: string } | null;
  comunicadoId?: string;
}

export interface ComunicadoAviso {
  id: string;
  titulo: string;
  mensagem: string;
  formato: string;
  link_url: string | null;
  link_rotulo: string | null;
}

/** Comunicado em faixa vira aviso informativo, depois de incidentes e manutenções. */
export function comunicadosEmFaixa(comunicados: ComunicadoAviso[]): Aviso[] {
  return comunicados
    .filter((c) => c.formato === "faixa")
    .map((c) => ({
      chave: `comunicado:${c.id}`,
      tom: "info" as const,
      titulo: c.titulo,
      texto: c.mensagem,
      detalhe: null,
      link: c.link_url ? { url: c.link_url, rotulo: c.link_rotulo || "Saiba mais" } : null,
      comunicadoId: c.id,
    }));
}

export const JANELA_NORMALIZADO_MS = 30 * 60 * 1000;
export const ANTECEDENCIA_MANUTENCAO_MS = 24 * 60 * 60 * 1000;

const TOM_SEVERIDADE: Record<Severidade, TomAviso> = {
  outage: "danger",
  parcial: "attention",
  degradado: "warning",
};
const PESO_SEVERIDADE: Record<Severidade, number> = { outage: 0, parcial: 1, degradado: 2 };

const FUSO = "America/Sao_Paulo";
const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
const dia = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit" });

function mesmoDia(a: Date, b: Date): boolean {
  return dia.format(a) === dia.format(b);
}

/** "em 12/11, das 22:00 às 23:00" ou "de 12/11 22:00 a 13/11 02:00". */
export function janelaManutencao(inicio: Date, fim: Date): string {
  if (mesmoDia(inicio, fim)) return `em ${dia.format(inicio)}, das ${hora.format(inicio)} às ${hora.format(fim)}`;
  return `de ${dia.format(inicio)} ${hora.format(inicio)} a ${dia.format(fim)} ${hora.format(fim)}`;
}

export function montarAvisos(
  incidentes: IncidenteAviso[],
  manutencoes: ManutencaoAviso[],
  agora: Date,
  comunicados: ComunicadoAviso[] = []
): Aviso[] {
  const t = agora.getTime();

  const abertos = incidentes
    .filter((i) => i.status !== "resolvido")
    .sort((a, b) => PESO_SEVERIDADE[a.severidade] - PESO_SEVERIDADE[b.severidade])
    .map<Aviso>((i) => ({
      chave: `incidente:${i.id}:${i.ultimaAtualizacao?.id ?? i.status}`,
      tom: TOM_SEVERIDADE[i.severidade],
      titulo: i.titulo,
      texto: i.ultimaAtualizacao?.mensagem ?? "Já estamos atuando.",
      detalhe: i.componentes.length > 0 ? `Afeta: ${i.componentes.join(", ")}` : null,
    }));

  const normalizados = incidentes
    .filter(
      (i) => i.status === "resolvido" && i.resolvidoEm && t - new Date(i.resolvidoEm).getTime() < JANELA_NORMALIZADO_MS
    )
    .map<Aviso>((i) => ({
      chave: `incidente:${i.id}:resolvido`,
      tom: "positive",
      titulo: `Normalizado: ${i.titulo}`,
      texto: "Tudo funcionando de novo. Se algo ainda estiver estranho, recarregue a página.",
      detalhe: null,
    }));

  const emAndamento: Aviso[] = [];
  const programadas: Aviso[] = [];
  for (const m of manutencoes) {
    if (m.canceladaEm) continue;
    const inicio = new Date(m.inicio);
    const fim = new Date(m.fim);
    if (fim.getTime() <= t) continue;
    if (inicio.getTime() <= t) {
      emAndamento.push({
        chave: `manutencao:${m.id}:andamento`,
        tom: "warning",
        titulo: `Manutenção em andamento: ${m.titulo}`,
        texto: m.mensagem ?? `Até ${hora.format(fim)}. Algumas telas podem ficar indisponíveis.`,
        detalhe: m.mensagem ? `Até ${hora.format(fim)}` : null,
      });
    } else if (inicio.getTime() - t <= ANTECEDENCIA_MANUTENCAO_MS) {
      programadas.push({
        chave: `manutencao:${m.id}:programada`,
        tom: "info",
        titulo: `Manutenção programada: ${m.titulo}`,
        texto: m.mensagem ?? "O Pilar pode ficar indisponível nesse intervalo. Salve o que estiver fazendo antes.",
        detalhe: `Previsto ${janelaManutencao(inicio, fim)}`,
      });
    }
  }

  return [...abertos, ...emAndamento, ...programadas, ...comunicadosEmFaixa(comunicados), ...normalizados];
}
