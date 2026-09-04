// Lógica pura do cron de notificação por e-mail: agrupar as linhas da RPC por
// destinatário e cortar o lote. Separada do index.ts (que chama serve() no
// top-level) para ser testável sem ligar servidor.

import { MAX_ITENS_EMAIL, type NotifItem } from "../_shared/email/index.ts";

/** Uma linha de `notificacoes_pendentes_email`. */
export interface LinhaPendente {
  destinatario_id: string;
  email: string;
  nome: string | null;
  empresa_id: string;
  notificacao_id: string;
  categoria: string;
  severidade: string;
  titulo: string;
  mensagem: string | null;
  link: string | null;
  created_at: string;
}

export interface LotePessoa {
  destinatarioId: string;
  email: string;
  nome: string | null;
  empresaId: string;
  /** Itens que vão no corpo (no máximo MAX_ITENS_EMAIL). */
  itens: NotifItem[];
  /** Ids de TODAS as notificações do lote, inclusive as que não entraram no corpo. */
  notificacaoIds: string[];
  /** Quantas ficaram fora do corpo. */
  totalOculto: number;
}

/** Monta a URL absoluta do item. Link relativo vira APP_URL + link; sem link, cai no sino. */
export function urlDoItem(link: string | null, appUrl: string, fallback: string): string {
  if (!link) return fallback;
  if (/^https?:\/\//i.test(link)) return link;
  return `${appUrl.replace(/\/$/, "")}/${link.replace(/^\//, "")}`;
}

/**
 * Agrupa por destinatário preservando a ordem em que a RPC devolveu (categoria
 * na ordem de exibição, mais recente primeiro dentro dela).
 *
 * `maxPessoas` corta o lote por PESSOA, nunca no meio dos itens de alguém: quem
 * ficou de fora entra na próxima rodada, porque `email_enviado_em` só é marcado
 * para quem recebeu.
 */
export function agruparPorPessoa(
  linhas: LinhaPendente[],
  opts: { appUrl: string; sinoUrl: string; maxPessoas: number }
): LotePessoa[] {
  const porPessoa = new Map<string, LotePessoa>();

  for (const l of linhas) {
    let lote = porPessoa.get(l.destinatario_id);
    if (!lote) {
      if (porPessoa.size >= opts.maxPessoas) continue;
      lote = {
        destinatarioId: l.destinatario_id,
        email: l.email,
        nome: l.nome,
        empresaId: l.empresa_id,
        itens: [],
        notificacaoIds: [],
        totalOculto: 0,
      };
      porPessoa.set(l.destinatario_id, lote);
    }

    lote.notificacaoIds.push(l.notificacao_id);

    if (lote.itens.length < MAX_ITENS_EMAIL) {
      lote.itens.push({
        categoria: l.categoria,
        severidade: l.severidade,
        titulo: l.titulo,
        mensagem: l.mensagem,
        url: urlDoItem(l.link, opts.appUrl, opts.sinoUrl),
        criadoEm: l.created_at,
      });
    } else {
      lote.totalOculto += 1;
    }
  }

  return [...porPessoa.values()];
}

/** Chave de idempotência estável para o lote: o mesmo conjunto de ids não reenvia. */
export async function chaveIdempotencia(modo: string, lote: LotePessoa): Promise<string> {
  const base = [...lote.notificacaoIds].sort().join(",");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(base));
  const hex = [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `notif-${modo}-${lote.destinatarioId}-${hex}`;
}
