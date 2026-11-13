import { emailObrigatorio, uuidObrigatorio, validar, z } from "../_shared/schemas.ts";

export const entradaSchema = z.object({
  cliente_id: uuidObrigatorio("cliente_id inválido"),
  email: emailObrigatorio("email inválido"),
  // Quem é a pessoa deste acesso (ex.: "Maria, esposa"). Vai no e-mail e na lista de
  // acessos; sem ele vale o nome do cliente. Texto curto, sem quebra de linha.
  nome: z.unknown().transform((v): string | undefined => {
    if (typeof v !== "string") return undefined;
    return v.replace(/\s+/g, " ").trim().slice(0, 200) || undefined;
  }),
});

export const lerEntrada = (corpo: unknown) => validar(entradaSchema, corpo);
