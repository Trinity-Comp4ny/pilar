import { z } from "../_shared/schemas.ts";
import { AGENTES_EXECUTAVEIS, type AgenteExecutavel } from "./regras.ts";

const entradaSchema = z.object({
  agente_id: z.enum(AGENTES_EXECUTAVEIS as unknown as [AgenteExecutavel, ...AgenteExecutavel[]]),
});

export type Entrada = z.infer<typeof entradaSchema>;

/** Corpo do POST: só o agente. Qualquer outra coisa é 400, nunca execução parcial. */
export function lerEntrada(corpo: unknown): { ok: true; entrada: Entrada } | { ok: false; erro: string } {
  const r = entradaSchema.safeParse(corpo);
  if (!r.success) return { ok: false, erro: "agente_id inválido: use receita, clientes, produto ou chefe" };
  return { ok: true, entrada: r.data };
}
