import { uuidObrigatorio, validar, z } from "../_shared/schemas.ts";

export const entradaSchema = z.object({ receita_id: uuidObrigatorio("receita_id inválido") });

export const lerEntrada = (corpo: unknown) => validar(entradaSchema, corpo);
