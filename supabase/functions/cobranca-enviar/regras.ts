/**
 * Regras do cobranca-enviar sem banco nem rede: quem pode enviar, quando o rascunho
 * ainda vale, quando a parcela ainda pode ser cobrada e o que responder quando o
 * e-mail não sai. O index.ts busca os registros e executa.
 */

import { EMAIL_RE } from "../_shared/validators.ts";

type Recusa = { ok: false; status: number; error: string };
type Ok = { ok: true };

/** Mesma regra de cobranca_decidir: quem vê dinheiro E edita o financeiro. */
export function podeEnviarCobranca(verDinheiro: unknown, editorFinanceiro: unknown): boolean {
  return verDinheiro === true && editorFinanceiro === true;
}

/** Rascunho de outra empresa é tratado como inexistente; já decidido não sai de novo. */
export function verificarRascunho<C extends { empresa_id: string; status: string }>(
  cobranca: C | null,
  empresaId: string
): { ok: true; cobranca: C } | Recusa {
  if (!cobranca || cobranca.empresa_id !== empresaId) {
    return { ok: false, status: 404, error: "Cobrança não encontrada" };
  }
  if (cobranca.status !== "rascunho") return { ok: false, status: 409, error: "Esta cobrança já foi decidida" };
  return { ok: true, cobranca };
}

/** Parcela excluída, paga ou cancelada não é cobrada: o rascunho é cancelado. */
export function parcelaCobravel<R extends { status: string; deleted_at: string | null }>(
  receita: R | null
): receita is R {
  return !!receita && !receita.deleted_at && ["Pendente", "Atrasado"].includes(receita.status);
}

/** Sem e-mail válido do cliente não há para quem mandar; sem e-mail da empresa não há reply-to. */
export function verificarDestinos(destinatarioEmail: string, empresaEmail: string | null): Ok | Recusa {
  if (!EMAIL_RE.test(destinatarioEmail)) {
    return { ok: false, status: 400, error: "O cliente está sem e-mail válido cadastrado" };
  }
  if (!empresaEmail) {
    return {
      ok: false,
      status: 422,
      error: "Cadastre o e-mail da empresa em Configurações para enviar ao cliente",
    };
  }
  return { ok: true };
}

/** E-mail que não saiu: o rascunho continua aberto e o usuário sabe o porquê. */
export function erroDoEnvioPulado(skipped: "suprimido" | "dry_run"): { status: number; error: string } {
  return skipped === "dry_run"
    ? { status: 503, error: "O envio de e-mail está desligado neste ambiente; nada foi enviado" }
    : { status: 422, error: "O e-mail do cliente está bloqueado para envio (descadastro ou devolução)" };
}
