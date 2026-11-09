import { uuidObrigatorio, validar, z } from "../_shared/schemas.ts";

/**
 * Entrega baixada pelo cliente logado no portal (session_token). O link público por
 * token foi removido do banco (20260429600000) e não existe mais aqui.
 */
export const entradaSchema = z.object({
  entrega_id: uuidObrigatorio("entrega_id inválido"),
  session_token: z
    .string({ required_error: "session_token obrigatório", invalid_type_error: "session_token obrigatório" })
    .trim()
    .min(1, "session_token obrigatório")
    .max(512, "session_token obrigatório"),
});

export const lerEntrada = (corpo: unknown) => validar(entradaSchema, corpo);
