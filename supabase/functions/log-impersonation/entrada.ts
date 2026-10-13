import { textoObrigatorio, validar, z } from "../_shared/schemas.ts";

export const entradaSchema = z.object({
  action: z.enum(["start", "stop"], { errorMap: () => ({ message: "action deve ser 'start' ou 'stop'" }) }),
  // O banco (start_impersonation) decide se o papel é válido; aqui só formato.
  viewAsRole: textoObrigatorio("viewAsRole obrigatório", 40).regex(/^[a-z_]+$/, "viewAsRole obrigatório"),
});

export const lerEntrada = (corpo: unknown) => validar(entradaSchema, corpo);
