import { uuidObrigatorio, validar, z } from "../_shared/schemas.ts";

// Quem pede "Tentar de novo" é o escritório (JWT no cabeçalho) ou o campo (token no corpo).
export const entradaSchema = z.object({
  registro_id: uuidObrigatorio("registro_id inválido"),
  token: z.string().trim().min(1).max(512).optional(),
});

export const lerEntrada = (corpo: unknown) => validar(entradaSchema, corpo);
