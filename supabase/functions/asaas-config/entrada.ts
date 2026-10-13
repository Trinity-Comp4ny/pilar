import { parseOr400, z } from "../_shared/schemas.ts";

/**
 * Corpo aceito por asaas-config. A chave do Asaas é texto opaco do provedor:
 * só aparamos e limitamos o tamanho (a RPC cifra antes de gravar).
 */
export const entradaSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("get") }),
  z.object({ action: z.literal("remover") }),
  z.object({ action: z.literal("testar") }),
  z.object({
    action: z.literal("save"),
    ambiente: z.enum(["sandbox", "producao"], { errorMap: () => ({ message: "Ambiente inválido" }) }),
    api_key: z.string().trim().max(512).optional(),
  }),
]);

export type Entrada = z.infer<typeof entradaSchema>;

export function lerEntrada(corpo: unknown) {
  return parseOr400(entradaSchema, corpo);
}
