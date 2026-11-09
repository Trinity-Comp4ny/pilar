/**
 * Período pedido pela plataforma de marketing: ?desde=AAAA-MM-DD[&ate=AAAA-MM-DD].
 * Sem `ate`, vai até hoje. Janela máxima de 120 dias: a plataforma busca por partes.
 */
export const JANELA_MAXIMA_DIAS = 120;

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const DIA = 24 * 60 * 60 * 1000;

function dataValida(s: string): boolean {
  if (!DATA.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function lerPeriodo(
  params: URLSearchParams,
  hoje: string
): { ok: true; desde: string; ate: string } | { ok: false; erro: string } {
  const desde = params.get("desde") ?? "";
  const ate = params.get("ate") ?? hoje;
  if (!dataValida(desde)) return { ok: false, erro: "desde é obrigatório, no formato AAAA-MM-DD" };
  if (!dataValida(ate)) return { ok: false, erro: "ate deve estar no formato AAAA-MM-DD" };
  const dias = (Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / DIA;
  if (dias < 0) return { ok: false, erro: "desde não pode ser depois de ate" };
  if (dias > JANELA_MAXIMA_DIAS) return { ok: false, erro: `janela máxima de ${JANELA_MAXIMA_DIAS} dias` };
  return { ok: true, desde, ate };
}
