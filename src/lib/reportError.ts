/**
 * Caminho padrão do catch de escrita (ADR 0030).
 *
 * O interceptor do cliente Supabase já garante que nenhuma falha de dado passa
 * invisível, mas ele não sabe o que o usuário estava tentando fazer. `reportError`
 * adiciona esse contexto e devolve a mensagem pronta para o toast, com o event id
 * como código de referência para o suporte.
 *
 *   const { error } = await supabase.from("disciplinas").insert({ nome });
 *   if (error) {
 *     const { message } = reportError(error, { context: "disciplina:criar" });
 *     toast.error("Não foi possível adicionar a disciplina", { description: message });
 *     return;
 *   }
 */

import { monitoring } from "./monitoring";
import { getSafeErrorMessage } from "./safeError";

export type ReportContext = {
  /** Identificador curto da ação, no formato "entidade:ação". */
  context: string;
  /** Dados extras da ação (nunca segredo nem corpo cru de request). */
  extra?: Record<string, unknown>;
  /** Mensagem de fallback quando o erro não tem nada legível. */
  fallback?: string;
};

export type ReportedError = {
  /** Mensagem segura para mostrar ao usuário. */
  message: string;
  /** Event id do Sentry, quando houver: serve de código de referência. */
  eventId?: string;
};

/** Código do PostgREST para violação de RLS (nenhuma policy permitiu a escrita). */
const RLS_DENIED = "42501";

function isPermissionDenied(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === RLS_DENIED || code === "PGRST301";
}

export function reportError(error: unknown, ctx: ReportContext): ReportedError {
  const eventId = monitoring.captureException(error, {
    context: ctx.context,
    ...ctx.extra,
  });

  // 403 de RLS não é "erro inesperado": dizer isso ao usuário só gera ticket.
  const message = isPermissionDenied(error)
    ? "Você não tem permissão para esta ação nesta empresa."
    : getSafeErrorMessage(error, ctx.fallback);

  return { message, eventId };
}
