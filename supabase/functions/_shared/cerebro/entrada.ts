// SPEC 169: corpo do POST de reuniao-analisar. Teto de caracteres para não estourar o
// contexto nem o custo; acima dele a resposta é 400 com mensagem clara, nunca corte mudo.
import { z } from "../schemas.ts";

export const TETO_TRANSCRIPT = 150_000;

const entradaSchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  ocorreu_em: z.string().datetime({ offset: true }),
  origem_nome: z.string().trim().max(200).optional(),
  origem_contato: z.enum(["parente", "indicacao", "frio", "inbound"]).optional(),
  transcript: z.string().min(1),
});

export type EntradaReuniao = z.infer<typeof entradaSchema>;

export function lerEntrada(corpo: unknown): { ok: true; entrada: EntradaReuniao } | { ok: false; erro: string } {
  const r = entradaSchema.safeParse(corpo);
  if (!r.success) return { ok: false, erro: "Informe título, data (ISO) e a transcrição da reunião." };
  if (r.data.transcript.length > TETO_TRANSCRIPT) {
    return {
      ok: false,
      erro: `A transcrição passa de ${TETO_TRANSCRIPT.toLocaleString("pt-BR")} caracteres. Divida a reunião em partes.`,
    };
  }
  return { ok: true, entrada: r.data };
}
