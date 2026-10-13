import { z } from "../_shared/schemas.ts";

export const MAX_TEXTO_CHARS = 60_000;
export const TIPOS_DOC = ["extrato", "fatura", "planilha"] as const;

const LancamentoSchema = z.object({
  data: z.string(), // ISO yyyy-mm-dd
  descricao: z.string().min(1),
  valor: z.number().nonnegative(), // sempre positivo; o tipo diz o sentido
  tipo: z.enum(["despesa", "receita"]),
  categoria_sugerida: z.string().nullable().optional(),
  parcela_numero: z.number().int().positive().nullable().optional(),
  parcela_total: z.number().int().positive().nullable().optional(),
  confianca: z.number().min(0).max(1),
});

/**
 * Resposta do modelo. A lista precisa existir (senão a extração falhou e vale
 * tentar de novo), mas um lançamento malformado sai com aviso em vez de reprovar
 * o documento inteiro: antes, um único valor negativo num extrato de 80 linhas
 * fazia o usuário perder a importação toda.
 */
export const ResultSchema = z
  .object({
    lancamentos: z.array(z.unknown()),
    avisos: z.array(z.string()).catch([]).default([]),
  })
  .transform(({ lancamentos, avisos }) => {
    const validos = lancamentos.flatMap((l) => {
      const r = LancamentoSchema.safeParse(l);
      return r.success ? [r.data] : [];
    });
    const ignorados = lancamentos.length - validos.length;
    return {
      lancamentos: validos,
      avisos: ignorados > 0 ? [...avisos, `${ignorados} lançamento(s) ignorado(s): formato inválido.`] : avisos,
    };
  });

export type Resultado = z.output<typeof ResultSchema>;

/** Corpo do request: texto já extraído do PDF no client e o tipo do documento. */
export function lerEntrada(
  corpo: unknown
): { ok: true; tipoDoc: (typeof TIPOS_DOC)[number]; texto: string } | { ok: false; error: string } {
  const b = (corpo && typeof corpo === "object" ? corpo : {}) as Record<string, unknown>;
  // O tipo vai para o prompt: só um dos valores conhecidos, nunca texto livre.
  const tipoDoc = TIPOS_DOC.find((t) => t === b.tipo) ?? "extrato";
  const texto = typeof b.texto === "string" ? b.texto.trim() : "";
  if (!texto) return { ok: false, error: "Nenhum texto para importar" };
  if (texto.length > MAX_TEXTO_CHARS) {
    return { ok: false, error: `Documento grande demais (${texto.length} caracteres). Divida em partes menores.` };
  }
  return { ok: true, tipoDoc, texto };
}
