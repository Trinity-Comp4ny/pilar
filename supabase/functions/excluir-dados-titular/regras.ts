/**
 * Quando o ultra admin pode decidir um pedido de exclusão (SPEC 116), sem banco nem rede.
 */

export type Recusa = { status: number; error: string };

/** Só pedido aberto (ou que falhou ao executar) recebe decisão. */
const DECIDIVEL = new Set(["pending", "failed"]);

const PAPEIS_ADMIN = new Set(["admin", "owner"]);

/** Titular ativo com papel de admin e nenhum outro admin ativo na empresa. */
export function ehUnicoAdmin(papel: string | null, desativadoEm: string | null, outrosAdminsAtivos: number): boolean {
  return PAPEIS_ADMIN.has(papel ?? "") && !desativadoEm && outrosAdminsAtivos === 0;
}

export function recusaDaDecisao(statusPedido: string, acao: "aprovar" | "recusar", unicoAdmin: boolean): Recusa | null {
  if (!DECIDIVEL.has(statusPedido)) {
    return { status: 409, error: `Este pedido já foi decidido (situação: ${statusPedido}).` };
  }
  if (acao === "aprovar" && unicoAdmin) {
    return {
      status: 409,
      error:
        "O titular é o único admin ativo da empresa. Peça para ele passar o papel de admin a outra pessoa antes, ou recuse explicando isso.",
    };
  }
  return null;
}
