import { supabase } from "@/integrations/supabase/client";
import type { FilaRegistroItem, ResultadoEnvio } from "./campoRegistroFila";

/** "audio/webm;codecs=opus" → "audio/webm": a edge valida só o tipo base. */
function mimeBase(mimeType: string): string {
  return mimeType.split(";")[0].trim().toLowerCase();
}

/** Base64 puro (sem o prefixo data:), que é o que a edge espera. */
function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(((r.result as string) ?? "").split(",")[1] ?? "");
    r.onerror = () => reject(new Error("Não deu para ler o arquivo"));
    r.readAsDataURL(blob);
  });
}

/** Status HTTP e mensagem de um erro de `functions.invoke` (o corpo da resposta vem em `context`). */
async function lerErro(error: unknown): Promise<{ status: number | null; mensagem: string }> {
  const ctx = (error as { context?: Response } | null)?.context;
  const status = typeof ctx?.status === "number" ? ctx.status : null;
  let mensagem = "Sem conexão com o servidor";
  if (ctx && typeof ctx.json === "function") {
    try {
      const corpo = (await ctx.clone().json()) as { error?: string } | null;
      if (corpo?.error) mensagem = corpo.error;
    } catch {
      mensagem = `Erro ${status ?? ""}`.trim();
    }
  }
  return { status, mensagem };
}

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
