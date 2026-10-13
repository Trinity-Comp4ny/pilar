import { textoObrigatorio, uuidObrigatorio, validar, z } from "../_shared/schemas.ts";

export const entradaSchema = z.object({
  token: textoObrigatorio("token obrigatório"),
  projeto_id: uuidObrigatorio("projeto_id inválido"),
});

export const lerEntrada = (corpo: unknown) => validar(entradaSchema, corpo);
