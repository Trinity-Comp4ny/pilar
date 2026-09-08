/**
 * E-mail de notificação da central (SPEC 096). Dois modos:
 * - "imediato": itens high/critical que ainda não foram lidos no app.
 * - "semanal": resumo de segunda-feira, itens agrupados por categoria.
 * Layout de lista, sem card: cada item tem barra de severidade, título com link e mensagem.
 */

import { BRAND } from "../brand.ts";
import { html } from "../html.ts";
import { button, em, listItem, sectionHeading, shell, small, strong, type Modulo, type Tone } from "../layout.ts";
import type { EmailTemplate } from "./types.ts";

export type NotifCategoria = "financeiro" | "projeto" | "disciplina" | "tarefa" | "obra" | "sistema";
export type NotifSeveridade = "low" | "medium" | "high" | "critical";

export interface NotifItem {
  categoria: NotifCategoria | string;
  severidade: NotifSeveridade | string;
  titulo: string;
  mensagem: string | null;
  /** URL absoluta (APP_URL + link). */
  url: string;
  criadoEm: string; // ISO
}

export interface NotificacoesParams {
  nome: string | null;
  modo: "imediato" | "semanal";
  itens: NotifItem[];
  /** Itens além dos exibidos. */
  totalOculto: number;
  gerenciarUrl: string;
  sinoUrl: string;
}

export const MAX_ITENS_EMAIL = 20;

const ORDEM: NotifCategoria[] = ["financeiro", "projeto", "disciplina", "obra", "tarefa", "sistema"];

const CATEGORIA_LABEL: Record<NotifCategoria, string> = {
  financeiro: "Financeiro",
  projeto: "Projetos",
  disciplina: "Disciplinas",
  tarefa: "Tarefas",
  obra: "Obras",
  sistema: "Sistema",
};

const CATEGORIA_MODULO: Record<NotifCategoria, Modulo> = {
  financeiro: "gestao",
  projeto: "projetos",
  disciplina: "projetos",
  tarefa: "projetos",
  obra: "obra",
  sistema: "neutro",
};

export function severidadeTone(sev: string): Tone {
  if (sev === "critical" || sev === "high") return "negative";
  if (sev === "medium") return "warning";
  return "neutral";
}

function categoriaKey(c: string): NotifCategoria {
  return (ORDEM as string[]).includes(c) ? (c as NotifCategoria) : "sistema";
}

function tempoRelativo(iso: string, agora = new Date()): string {
  const diffMin = Math.max(0, Math.round((agora.getTime() - new Date(iso).getTime()) / 60000));
  if (diffMin < 60) return `há ${diffMin} min`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

/** Agrupa por categoria na ordem fixa. Exportado para teste. */
export function agruparPorCategoria(itens: NotifItem[]): Array<{ categoria: NotifCategoria; itens: NotifItem[] }> {
  const map = new Map<NotifCategoria, NotifItem[]>();
  for (const it of itens) {
    const k = categoriaKey(it.categoria);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(it);
  }
  return ORDEM.filter((c) => map.has(c)).map((c) => ({ categoria: c, itens: map.get(c)! }));
}

export function assuntoNotificacoes(params: Pick<NotificacoesParams, "modo" | "itens" | "totalOculto">): string {
  const total = params.itens.length + params.totalOculto;
  if (params.modo === "imediato") {
    return total === 1 ? params.itens[0].titulo : `${total} alertas importantes no ${BRAND.nome}`;
  }
  return `Seu resumo da semana: ${total} ${total === 1 ? "pendência" : "pendências"}`;
}

export function templateNotificacoes(params: NotificacoesParams, agora = new Date()): EmailTemplate {
  const { nome, modo, itens, totalOculto, gerenciarUrl, sinoUrl } = params;
  const total = itens.length + totalOculto;
  const saudacao = nome ? html`Olá, ${strong(nome)}.` : html`Olá.`;

  const tituloHtml =
    modo === "imediato"
      ? total === 1
        ? html`Um alerta ${em("importante")}`
        : html`${total} alertas ${em("importantes")}`
      : html`Seu ${em("resumo")} da semana`;

  const leadHtml =
    modo === "imediato"
      ? html`${saudacao} ${total === 1 ? "Este item precisa" : "Estes itens precisam"} da sua atenção e ainda
        ${total === 1 ? "não foi visto" : "não foram vistos"} na ${BRAND.nome}.`
      : html`${saudacao} Você tem ${strong(`${total} ${total === 1 ? "pendência" : "pendências"}`)}
        ${total === 1 ? "não lida" : "não lidas"}. Clique num item para abrir direto.`;

  const grupos = agruparPorCategoria(itens);
  const lista = grupos.flatMap((g, i) => [
    sectionHeading(CATEGORIA_LABEL[g.categoria], {
      modulo: CATEGORIA_MODULO[g.categoria],
      count: g.itens.length,
      mt: i === 0 ? 0 : 30,
    }),
    ...g.itens.map((it) =>
      listItem({
        titulo: it.titulo,
        mensagem: it.mensagem ?? undefined,
        href: it.url,
        tone: severidadeTone(it.severidade),
        meta: tempoRelativo(it.criadoEm, agora),
      })
    ),
  ]);

  const oculto =
    totalOculto > 0
      ? small(
          html`E mais ${strong(String(totalOculto))} ${totalOculto === 1 ? "pendência" : "pendências"} aguardando.`,
          { mt: 16 }
        )
      : null;

  return {
    subject: assuntoNotificacoes(params),
    html: shell({
      preview: itens[0]?.titulo ?? assuntoNotificacoes(params),
      footerNote:
        modo === "imediato"
          ? `Alerta de alta prioridade sai por e-mail quando não é lido no aplicativo em alguns minutos.`
          : `Resumo diário das suas notificações.`,
      footerLinks: [{ label: "Gerenciar notificações por e-mail", href: gerenciarUrl }],
      hero: { titulo: tituloHtml, lead: leadHtml },
      content: [
        ...lista,
        ...(oculto ? [oculto] : []),
        button(`Abrir ${BRAND.nome}`, sinoUrl, { variant: total > 1 ? "brand" : "quiet" }),
      ],
    }),
  };
}
