import { uuidObrigatorio, validar, z } from "../_shared/schemas.ts";

export const entradaSchema = z.object({
  mensagem_id: uuidObrigatorio("mensagem_id inválido"),
});

export const lerEntrada = (corpo: unknown) => validar(entradaSchema, corpo);
