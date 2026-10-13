import { uuidObrigatorio, validar, z } from "../_shared/schemas.ts";

const credencial = z.string().trim().min(1).max(512).optional().catch(undefined);

/**
 * Entrega baixada por quem tem o link público (token) ou pelo cliente logado no
 * portal (session_token). Um dos dois é obrigatório; o token tem precedência.
 */
export const entradaSchema = z
  .object({
    entrega_id: uuidObrigatorio("entrega_id inválido"),
    token: credencial,
    session_token: credencial,
  })
  .refine((e) => e.token || e.session_token, { message: "token ou session_token obrigatório" });

export const lerEntrada = (corpo: unknown) => validar(entradaSchema, corpo);
