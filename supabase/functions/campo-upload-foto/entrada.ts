import { textoObrigatorio, uuidObrigatorio, validar, z } from "../_shared/schemas.ts";

export const MAX_BYTES = 8 * 1024 * 1024; // 8MB por foto
export const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export const entradaSchema = z.object({
  token: textoObrigatorio("token ausente"),
  rdo_id: uuidObrigatorio("rdo_id inválido"),
  content_type: z.enum(["image/jpeg", "image/png", "image/webp"], {
    errorMap: () => ({ message: "Tipo de imagem não suportado" }),
  }),
  image_base64: z
    .string({ required_error: "imagem ausente", invalid_type_error: "imagem ausente" })
    .min(1, "imagem ausente"),
});

export const lerEntrada = (corpo: unknown) => validar(entradaSchema, corpo);

/**
 * Decodifica a foto. O tamanho é conferido pelo comprimento do base64 ANTES de
 * decodificar (4 caracteres = 3 bytes), para não alocar uma string gigante à toa,
 * e base64 malformado vira 400 em vez de derrubar a função.
 */
export function decodificarImagem(
  base64: string
): { ok: true; bytes: Uint8Array } | { ok: false; status: 400 | 413; erro: string } {
  if (Math.floor((base64.length * 3) / 4) > MAX_BYTES + 3) {
    return { ok: false, status: 413, erro: "Imagem maior que 8MB" };
  }
  let binario: string;
  try {
    binario = atob(base64);
  } catch {
    return { ok: false, status: 400, erro: "imagem inválida" };
  }
  const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
  if (bytes.byteLength === 0) return { ok: false, status: 400, erro: "imagem vazia" };
  if (bytes.byteLength > MAX_BYTES) return { ok: false, status: 413, erro: "Imagem maior que 8MB" };
  return { ok: true, bytes };
}
