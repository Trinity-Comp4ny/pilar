import { textoObrigatorio, uuidObrigatorio, validar, z } from "../_shared/schemas.ts";

export const MAX_ABERTURA = 1500;

export const entradaSchema = z.object({
  cobranca_id: uuidObrigatorio("cobranca_id inválido"),
  // Texto que o usuário editou antes de aprovar. Sem ele, vale o rascunho do agente.
  abertura: textoObrigatorio("abertura inválida", MAX_ABERTURA).optional(),
});

export const lerEntrada = (corpo: unknown) => validar(entradaSchema, corpo);
