import { emailObrigatorio, textoObrigatorio, uuidObrigatorio, validar, z } from "../_shared/schemas.ts";

export const entradaSchema = z.object({
  obra_id: uuidObrigatorio("obra_id inválido"),
  nome: textoObrigatorio("Informe o nome", 120),
  // Opcional (spec 099): o pessoal de campo pode não ter e-mail real e o fluxo cai
  // na senha manual. Quando vem, tem que ser válido.
  email: z.preprocess((v) => (v === "" || v === null ? undefined : v), emailObrigatorio("email inválido").optional()),
});

export const lerEntrada = (corpo: unknown) => validar(entradaSchema, corpo);
