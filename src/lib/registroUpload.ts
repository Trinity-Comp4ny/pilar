/**
 * Pedaços de envio de registro de obra que o Pilar Campo (token) e o escritório (JWT) repetem
 * (SPEC 135): converter mídia para o base64 que a edge espera e ler o erro de `functions.invoke`.
 */

/** "audio/webm;codecs=opus" → "audio/webm": a edge valida só o tipo base. */
export function mimeBase(mimeType: string): string {
  return mimeType.split(";")[0].trim().toLowerCase();
}

/** Base64 puro (sem o prefixo data:), que é o que a edge espera. */
export function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(((r.result as string) ?? "").split(",")[1] ?? "");
    r.onerror = () => reject(new Error("Não deu para ler o arquivo"));
    r.readAsDataURL(blob);
  });
}

/** Status HTTP e mensagem de um erro de `functions.invoke` (o corpo da resposta vem em `context`). */
export async function lerErro(error: unknown): Promise<{ status: number | null; mensagem: string }> {
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
