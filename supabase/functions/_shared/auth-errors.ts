// GoTrue (Supabase Auth) devolve `code: "email_exists"` / `status: 422` quando o
// e-mail convidado já tem conta. Isso não é falha de envio: nenhum e-mail sai,
// mas o pedido é rejeitado antes da tentativa. Sem checar isso, "Falha ao
// enviar convite" parecia bug de sistema quando era só duplicidade esperada
// (ver triagem Sentry PILAR-2E/2G/2H, 02/09, confirmada nos auth logs do projeto).
export function isEmailExistsError(err: { code?: string; status?: number } | null | undefined): boolean {
  return err?.code === "email_exists" || err?.status === 422;
}
