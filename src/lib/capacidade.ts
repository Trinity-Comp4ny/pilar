/**
 * SPEC 098: os triggers `enforce_capacidade_projetos`/`enforce_capacidade_obras`
 * (migration 20260921000000) recusam a escrita com `RAISE EXCEPTION` cuja
 * mensagem É o código (`capacidade:projetos` | `capacidade:obras`) e o `HINT`
 * carrega o limite do nível atual. `supabase-js` expõe os dois em
 * PostgrestError (`.message`, `.hint`), desde que o erro não seja reembrulhado
 * em `new Error(...)` no caminho até aqui (isso descartaria o hint).
 */

export type RecursoCapacidade = "projetos" | "obras";

export interface CapacidadeErro {
  recurso: RecursoCapacidade;
  limite: number | null;
}

function extrairCampo(error: unknown, campo: "message" | "hint"): string {
  if (error && typeof error === "object" && campo in error) {
    const v = (error as Record<string, unknown>)[campo];
    return typeof v === "string" ? v : "";
  }
  return "";
}

export function parseCapacidadeError(error: unknown): CapacidadeErro | null {
  const message = extrairCampo(error, "message");
  const match = /^capacidade:(projetos|obras)$/.exec(message.trim());
  if (!match) return null;

  const hint = extrairCampo(error, "hint");
  const limite = hint ? Number.parseInt(hint, 10) : NaN;

  return {
    recurso: match[1] as RecursoCapacidade,
    limite: Number.isFinite(limite) ? limite : null,
  };
}
