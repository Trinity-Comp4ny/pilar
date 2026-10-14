import { textoObrigatorio, uuidObrigatorio, validar, z } from "../_shared/schemas.ts";

export const entradaSchema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("aprovar"), request_id: uuidObrigatorio("request_id inválido") }),
  z.object({
    acao: z.literal("recusar"),
    request_id: uuidObrigatorio("request_id inválido"),
    motivo: textoObrigatorio("Informe o motivo da recusa", 1000),
  }),
]);

export type Entrada = z.output<typeof entradaSchema>;

export function lerEntrada(corpo: unknown) {
  const acao = (corpo as { acao?: unknown } | null)?.acao;
  if (corpo && typeof corpo === "object" && acao !== "aprovar" && acao !== "recusar") {
    return { ok: false as const, error: "acao deve ser aprovar ou recusar" };
  }
  return validar(entradaSchema, corpo);
}
