import { uuidObrigatorio, validar, z } from "../_shared/schemas.ts";

export const MAX_SUBJECT_LEN = 200;
export const MAX_MESSAGE_LEN = 10_000;

const texto = (obrigatorio: string, max: number, excede: string) =>
  z
    .string({ required_error: obrigatorio, invalid_type_error: obrigatorio })
    .refine((v) => v.trim().length > 0, obrigatorio)
    .refine((v) => v.length <= max, excede);

export const entradaSchema = z.object({
  // Destinatário é sempre um cliente DA EMPRESA do caller, nunca endereço livre.
  cliente_id: uuidObrigatorio("cliente_id inválido"),
  subject: texto("Assunto obrigatório", MAX_SUBJECT_LEN, `Assunto excede ${MAX_SUBJECT_LEN} caracteres`),
  message: texto("Mensagem obrigatória", MAX_MESSAGE_LEN, `Mensagem excede ${MAX_MESSAGE_LEN} caracteres`),
});

export const lerEntrada = (corpo: unknown) => validar(entradaSchema, corpo);
