import { supabase } from "@/integrations/supabase/client";
import { monitoring } from "@/lib/monitoring";

export type EntidadeMencao = "projeto" | "disciplina" | "tarefa";

const PREVIEW_MAX = 200;

/**
 * Notifica quem foi marcado com @ num comentário (spec 089). Chamar só depois do comentário
 * ter sido salvo com sucesso: pior caso aceitável é "comentário sem notificação", nunca
 * "notificação fantasma" de um comentário que não persistiu. Best-effort: falha aqui não deve
 * quebrar o fluxo de quem comentou, só reporta pro Sentry. Com `comentarioId`, o link da
 * notificação abre a conversa já no comentário e cada comentário notifica à parte (spec 103).
 */
export async function notificarMencao(
  entidadeTipo: EntidadeMencao,
  entidadeId: string,
  mencionados: string[],
  textoComentario: string,
  comentarioId?: string
) {
  if (mencionados.length === 0) return;

  const { error } = await supabase.rpc("rpc_notificar_mencao", {
    p_entidade_tipo: entidadeTipo,
    p_entidade_id: entidadeId,
    p_mencionados: mencionados,
    p_preview: textoComentario.slice(0, PREVIEW_MAX),
    p_comentario_id: comentarioId,
  });

  if (error) monitoring.captureException(error, { entidadeTipo, entidadeId });
}
