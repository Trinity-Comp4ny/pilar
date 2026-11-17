import { uuidObrigatorio, validar, z } from "../_shared/schemas.ts";

export const entradaSchema = z.object({
  entrega_id: uuidObrigatorio("entrega_id inválido"),
});

export const lerEntrada = (corpo: unknown) => validar(entradaSchema, corpo);
