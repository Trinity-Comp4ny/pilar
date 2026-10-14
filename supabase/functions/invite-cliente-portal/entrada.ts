import { emailObrigatorio, uuidObrigatorio, validar, z } from "../_shared/schemas.ts";

export const entradaSchema = z.object({
  cliente_id: uuidObrigatorio("cliente_id inválido"),
  email: emailObrigatorio("email inválido"),
});

export const lerEntrada = (corpo: unknown) => validar(entradaSchema, corpo);
