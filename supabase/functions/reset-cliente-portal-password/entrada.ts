import { uuidObrigatorio, validar, z } from "../_shared/schemas.ts";

export const entradaSchema = z.object({
  cliente_id: uuidObrigatorio("cliente_id inválido"),
  // Qual acesso do cliente (SPEC 164: pode haver vários). Sem ele, só funciona se o
  // cliente tiver um acesso só (compatível com a tela antiga).
  account_id: z.string().uuid("account_id inválido").optional(),
  // Vai para o corpo do e-mail: texto curto, sem quebra de linha.
  // Opcional e tolerante (o e-mail cai em "Cliente" sem ele): o que não for texto é ignorado.
  nome_cliente: z.unknown().transform((v): string | undefined => {
    if (typeof v !== "string") return undefined;
    return v.replace(/\s+/g, " ").trim().slice(0, 200) || undefined;
  }),
});

export const lerEntrada = (corpo: unknown) => validar(entradaSchema, corpo);
