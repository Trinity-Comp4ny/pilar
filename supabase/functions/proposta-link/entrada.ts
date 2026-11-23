import { z } from "../_shared/schemas.ts";

export const propostaLinkSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i),
  acao: z.enum(["abrir", "aceitar"]),
});
