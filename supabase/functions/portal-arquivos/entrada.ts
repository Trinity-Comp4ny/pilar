import { uuidObrigatorio, validar, z } from "../_shared/schemas.ts";

const sessao = z
  .string({ required_error: "session_token obrigatório", invalid_type_error: "session_token obrigatório" })
  .trim()
  .min(1, "session_token obrigatório")
  .max(512, "session_token obrigatório");

const idDrive = (mensagem: string) =>
  z.string({ required_error: mensagem, invalid_type_error: mensagem }).regex(/^[A-Za-z0-9_-]{10,200}$/, mensagem);

/** Cliente logado no portal (session_token): lista a pasta "Cliente" do projeto e baixa dela. */
export const acaoSchema = z.discriminatedUnion("acao", [
  z.object({
    acao: z.literal("listar"),
    session_token: sessao,
    projeto_id: uuidObrigatorio("projeto_id inválido"),
    pasta_id: idDrive("pasta inválida").optional(),
  }),
  z.object({
    acao: z.literal("baixar"),
    session_token: sessao,
    projeto_id: uuidObrigatorio("projeto_id inválido"),
    arquivo_id: idDrive("arquivo inválido"),
  }),
]);

export const lerAcao = (corpo: unknown) => validar(acaoSchema, corpo);
