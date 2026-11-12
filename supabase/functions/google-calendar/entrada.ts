import { emailSchema, validar, z } from "../_shared/schemas.ts";

const DIA = /^\d{4}-\d{2}-\d{2}$/;

/** Dados de uma reunião criada ou editada pela Pilar. */
const reuniaoSchema = z
  .object({
    titulo: z.string().trim().min(1, "Dê um título para a reunião").max(300),
    inicio: z.string().max(40),
    fim: z.string().max(40),
    dia_inteiro: z.boolean(),
    local: z.string().trim().max(300).nullish(),
    descricao: z.string().max(8000).nullish(),
    convidados: z.array(emailSchema).max(50, "No máximo 50 convidados").optional(),
    meet: z.boolean().optional(),
    lembrete_minutos: z.number().int().min(-1).max(40320).nullish(),
  })
  .refine(
    (d) =>
      d.dia_inteiro
        ? DIA.test(d.inicio) && DIA.test(d.fim) && d.fim >= d.inicio
        : !Number.isNaN(Date.parse(d.inicio)) &&
          !Number.isNaN(Date.parse(d.fim)) &&
          Date.parse(d.fim) > Date.parse(d.inicio),
    { message: "O fim precisa ser depois do início" }
  );

export const acaoSchema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("iniciar"), retorno: z.string().max(300).optional() }),
  z.object({ acao: z.literal("sincronizar") }),
  z.object({ acao: z.literal("desconectar") }),
  z.object({ acao: z.literal("criar"), reuniao: reuniaoSchema }),
  z.object({ acao: z.literal("editar"), id: z.string().uuid(), reuniao: reuniaoSchema }),
  z.object({ acao: z.literal("excluir"), id: z.string().uuid() }),
]);

export const lerAcao = (corpo: unknown) => validar(acaoSchema, corpo);
