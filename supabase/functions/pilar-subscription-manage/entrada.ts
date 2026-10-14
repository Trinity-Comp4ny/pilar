import { parseOr400, z } from "../_shared/schemas.ts";

export const entradaSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cancel") }),
  z.object({
    action: z.literal("update_plan"),
    new_plan_slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9_-]{1,64}$/, "new_plan_slug inválido"),
    new_cycle: z.enum(["monthly", "yearly"]).optional(),
  }),
]);

export type Entrada = z.infer<typeof entradaSchema>;

export function lerEntrada(corpo: unknown) {
  return parseOr400(entradaSchema, corpo);
}
