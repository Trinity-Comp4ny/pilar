import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

/** Dias de calendário entre o início da pausa e `ate` (hoje por padrão). Nunca negativo. */
export function diasDePausa(pausadoEm: string, ate: Date = new Date()): number {
  return Math.max(0, differenceInCalendarDays(ate, parseISO(pausadoEm)));
}

/** Empurra uma data `yyyy-MM-dd` pelos dias parados, igual à retomada no banco. */
export function empurrarData(data: string | null | undefined, dias: number): string | null {
  if (!data) return null;
  return format(addDays(parseISO(data), dias), "yyyy-MM-dd");
}

/** Conta disciplinas que uma pausa de projeto pausaria: abertas e ainda não pausadas à parte. */
export function contaDisciplinasAbertas(statuses: Array<string | null | undefined>): number {
  return statuses.filter((s) => {
    const status = (s ?? "").toLowerCase();
    return !status.includes("conclu") && !status.includes("pausad");
  }).length;
}

/**
 * Mensagem para o toast de erro de pausar/retomar. O banco levanta P0001 com texto
 * pronto em português ("Projeto já está pausado"); qualquer outro erro vira o texto padrão.
 */
export function mensagemDaPausa(erro: unknown, padrao: string): string {
  if (typeof erro !== "object" || erro === null) return padrao;
  const { code, message } = erro as { code?: unknown; message?: unknown };
  return code === "P0001" && typeof message === "string" && message ? message : padrao;
}
