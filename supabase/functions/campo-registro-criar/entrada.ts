import { textoObrigatorio, uuidObrigatorio, validar, z } from "../_shared/schemas.ts";
import {
  audioSchema,
  dataIsoSchema,
  EXT_FOTO,
  fotoSchema,
  MAX_FOTO_BYTES,
  MAX_FOTOS,
} from "../_shared/registro-midia-entrada.ts";

export { EXT_FOTO, MAX_FOTO_BYTES, MAX_FOTOS };

export const entradaSchema = z
  .object({
    token: textoObrigatorio("token ausente"),
    // Idempotência: a fila offline reenvia o mesmo registro sem duplicar.
    client_id: uuidObrigatorio("client_id inválido"),
    data: dataIsoSchema,
    texto: z.string().trim().max(5000, "Texto grande demais").optional(),
    audio: audioSchema.optional(),
    fotos: z.array(fotoSchema).max(MAX_FOTOS, `No máximo ${MAX_FOTOS} fotos por registro`).default([]),
    // O aparelho mostrou o aviso do áudio guardado (ADR 0062) e a pessoa aceitou.
    aceite_audio: z.boolean().optional(),
  })
  .refine((e) => Boolean(e.texto) || Boolean(e.audio) || e.fotos.length > 0, { message: "Registro vazio" });

export type EntradaRegistro = z.output<typeof entradaSchema>;

export const lerEntrada = (corpo: unknown) => validar(entradaSchema, corpo);
