import { uuidObrigatorio, validar, z } from "../_shared/schemas.ts";
import { audioSchema, dataIsoSchema, fotoSchema, MAX_FOTOS } from "../_shared/registro-midia-entrada.ts";

export const entradaSchema = z
  .object({
    obra_id: uuidObrigatorio("obra_id inválido"),
    // Idempotência: reenviar o mesmo registro não duplica.
    client_id: uuidObrigatorio("client_id inválido"),
    data: dataIsoSchema,
    texto: z.string().trim().max(5000, "Texto grande demais").optional(),
    audio: audioSchema.optional(),
    fotos: z.array(fotoSchema).max(MAX_FOTOS, `No máximo ${MAX_FOTOS} fotos por registro`).default([]),
  })
  .refine((e) => Boolean(e.texto) || Boolean(e.audio) || e.fotos.length > 0, { message: "Registro vazio" });

export type EntradaRegistroEscritorio = z.output<typeof entradaSchema>;

export const lerEntrada = (corpo: unknown) => validar(entradaSchema, corpo);

/** Mesma regra de `_campo_criar_registro`: o que o registro tem decide o tipo. */
export function tipoDoRegistro(e: Pick<EntradaRegistroEscritorio, "texto" | "audio" | "fotos">) {
  const temAudio = Boolean(e.audio);
  const temTexto = Boolean(e.texto);
  const temFoto = e.fotos.length > 0;
  if (temAudio && !temTexto && !temFoto) return "audio" as const;
  if (!temAudio && temTexto && !temFoto) return "texto" as const;
  if (!temAudio && !temTexto && temFoto) return "foto" as const;
  return "misto" as const;
}
