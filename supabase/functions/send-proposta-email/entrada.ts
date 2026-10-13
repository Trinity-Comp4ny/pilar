import { emailObrigatorio, textoOpcional, validar, z } from "../_shared/schemas.ts";

export const MAX_MESSAGE_LEN = 5_000;
export const MAX_ATTACHMENT_B64 = 15 * 1024 * 1024; // ~11 MB decoded

export const entradaSchema = z.object({
  email: emailObrigatorio("Email inválido"),
  subject: z
    .string({ required_error: "Assunto obrigatório", invalid_type_error: "Assunto obrigatório" })
    .trim()
    .min(1, "Assunto obrigatório")
    .max(300, "Assunto obrigatório"),
  attachment_base64: z
    .string({ required_error: "Documento obrigatório", invalid_type_error: "Documento obrigatório" })
    .min(1, "Documento obrigatório")
    .max(MAX_ATTACHMENT_B64, "Documento excede o tamanho máximo (10 MB)"),
  mensagem: z.preprocess(
    (v) => (v === null || v === "" ? undefined : v),
    z.string().max(MAX_MESSAGE_LEN, `Mensagem excede ${MAX_MESSAGE_LEN} caracteres`).optional()
  ),
  // Vai como nome do anexo: só um nome de arquivo, sem caminho.
  filename: textoOpcional(200).transform((v) => v?.replace(/[\\/\r\n]/g, "_")),
  proposta_id: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().uuid().optional()),
  nome_cliente: textoOpcional(200),
  doc_mode: z.enum(["proposta", "contrato"]).optional().catch(undefined),
});

export const lerEntrada = (corpo: unknown) => validar(entradaSchema, corpo);
