import { textoObrigatorio, uuidObrigatorio, validar, z } from "../_shared/schemas.ts";

export const entradaSchema = z.object({
  session_token: textoObrigatorio("session_token obrigatório"),
  obra_id: uuidObrigatorio("obra_id inválido"),
});

export const lerEntrada = (corpo: unknown) => validar(entradaSchema, corpo);
