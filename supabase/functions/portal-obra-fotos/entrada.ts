import { textoObrigatorio, validar, z } from "../_shared/schemas.ts";

export const MAX_FOTOS = 30;

export const entradaSchema = z.object({
  session_token: textoObrigatorio("session_token obrigatório"),
  foto_ids: z
    .array(z.unknown(), { required_error: "foto_ids obrigatório", invalid_type_error: "foto_ids obrigatório" })
    .min(1, "foto_ids obrigatório")
    .max(MAX_FOTOS, "foto_ids inválido")
    .pipe(z.array(z.string().uuid("foto_ids inválido"))),
});

export const lerEntrada = (corpo: unknown) => validar(entradaSchema, corpo);
