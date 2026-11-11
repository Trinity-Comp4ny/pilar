import { textoObrigatorio, uuidObrigatorio, validar, z } from "../_shared/schemas.ts";

const idDrive = (mensagem: string) =>
  z.string({ required_error: mensagem, invalid_type_error: mensagem }).regex(/^[A-Za-z0-9_-]{10,200}$/, mensagem);

// Teto do envio: 5 GB por arquivo (DWG e IFC grandes cabem; o Drive aceita até 5 TB).
export const TAMANHO_MAXIMO = 5 * 1024 ** 3;

export const acaoSchema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("pasta_projeto"), projeto_id: uuidObrigatorio("projeto_id inválido") }),
  z.object({ acao: z.literal("listar"), pasta_id: idDrive("pasta inválida") }),
  z.object({
    acao: z.literal("criar_pasta"),
    pasta_pai_id: idDrive("pasta inválida"),
    nome: textoObrigatorio("nome da pasta obrigatório", 200),
  }),
  z.object({
    acao: z.literal("iniciar_upload"),
    pasta_id: idDrive("pasta inválida"),
    nome: textoObrigatorio("nome do arquivo obrigatório", 200),
    mime: z.string().max(200).optional(),
    tamanho: z
      .number({ invalid_type_error: "tamanho inválido", required_error: "tamanho inválido" })
      .int("tamanho inválido")
      .min(0, "tamanho inválido")
      .max(TAMANHO_MAXIMO, "arquivo maior que 5 GB"),
  }),
  z.object({ acao: z.literal("baixar"), arquivo_id: idDrive("arquivo inválido") }),
  z.object({ acao: z.literal("lixeira"), arquivo_id: idDrive("arquivo inválido") }),
]);

export type AcaoDrive = z.output<typeof acaoSchema>;

/** Ações que mexem no Drive: exigem edição em Projetos. */
export const ACOES_DE_ESCRITA = new Set(["criar_pasta", "iniciar_upload", "lixeira"]);

export const lerAcao = (corpo: unknown) => validar(acaoSchema, corpo);
