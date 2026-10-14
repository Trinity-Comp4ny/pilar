import { parseOr400, uuidSchema, z } from "../_shared/schemas.ts";

export const entradaSchema = z.object({
  receita_id: uuidSchema,
  billing_type: z.enum(["PIX", "BOLETO"], { errorMap: () => ({ message: "billing_type deve ser PIX ou BOLETO" }) }),
});

export type Entrada = z.infer<typeof entradaSchema>;

export function lerEntrada(corpo: unknown) {
  return parseOr400(entradaSchema, corpo);
}
