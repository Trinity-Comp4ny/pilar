import { supabase } from "@/integrations/supabase/client";
import { blobParaBase64, lerErro, mimeBase } from "@/lib/registroUpload";
import type { FilaRegistroItem, ResultadoEnvio } from "./campoRegistroFila";

/**
 * Envia um item da fila para a edge `campo-registro-criar`. 413 (arquivo grande demais) e 403
 * (aviso do áudio não aceito) repetir não resolve: são definitivos. O resto (rede, 5xx, 401 de
 * sessão vencida, 400 de falha de upload) pode melhorar: a fila tenta de novo.
 */
export async function enviarRegistroRemoto(token: string, item: FilaRegistroItem): Promise<ResultadoEnvio> {
  const body: Record<string, unknown> = {
    token,
    client_id: item.id,
    data: item.data,
    fotos: await Promise.all(
      item.fotos.map(async (f) => ({ content_type: f.contentType, image_base64: await blobParaBase64(f.blob) }))
    ),
  };
  if (item.texto) body.texto = item.texto;
  if (item.audio) {
    body.audio = {
      mime_type: mimeBase(item.audio.mimeType),
      base64: await blobParaBase64(item.audio.blob),
      duracao_s: item.audio.duracaoS,
    };
  }
  if (item.aceiteAudio) body.aceite_audio = true;

  const { data, error } = await supabase.functions.invoke("campo-registro-criar", { body });
  if (!error && (data as { success?: boolean } | null)?.success) return { ok: true };

  const { status, mensagem } = await lerErro(error);
  return { ok: false, erro: mensagem, definitivo: status === 413 || status === 403 };
}
