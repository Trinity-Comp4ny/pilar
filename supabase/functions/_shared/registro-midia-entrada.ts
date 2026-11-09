// SPEC 135: partes do corpo de criar registro que o campo (token) e o escritório (JWT) repetem.
// Validar na fronteira: mídia em base64, tipos e tamanhos aceitos.

import { z } from "./schemas.ts";
import { MAX_DURACAO_S, MIME_AUDIO } from "./registro-esquema.ts";

export const MAX_FOTO_BYTES = 8 * 1024 * 1024;
export const MAX_FOTOS = 6;
export const EXT_FOTO: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export const fotoSchema = z.object({
  content_type: z.enum(["image/jpeg", "image/png", "image/webp"], {
    errorMap: () => ({ message: "Tipo de imagem não suportado" }),
  }),
  image_base64: z
    .string({ required_error: "imagem ausente", invalid_type_error: "imagem ausente" })
    .min(1, "imagem ausente"),
});

export const audioSchema = z.object({
  mime_type: z.enum(MIME_AUDIO, { errorMap: () => ({ message: "Formato de áudio não suportado neste aparelho" }) }),
  base64: z.string({ required_error: "áudio ausente", invalid_type_error: "áudio ausente" }).min(1, "áudio ausente"),
  duracao_s: z
    .number({ required_error: "duração do áudio ausente", invalid_type_error: "duração do áudio inválida" })
    .int("duração do áudio inválida")
    .min(0, "duração do áudio inválida")
    // Folga de 5 s sobre o teto de 3 min: o relógio do aparelho não é exato.
    .max(MAX_DURACAO_S + 5, "Áudio acima de 3 minutos"),
});

export const dataIsoSchema = z
  .string({ required_error: "data inválida", invalid_type_error: "data inválida" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "data inválida");
