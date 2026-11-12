import { validar, z } from "../_shared/schemas.ts";

export const acaoSchema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("iniciar"), retorno: z.string().max(300).optional() }),
  z.object({ acao: z.literal("sincronizar") }),
  z.object({ acao: z.literal("desconectar") }),
]);

export const lerAcao = (corpo: unknown) => validar(acaoSchema, corpo);
