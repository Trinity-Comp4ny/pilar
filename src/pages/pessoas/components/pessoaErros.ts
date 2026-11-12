/** Mensagem legível para erro do banco ao salvar pessoa (duplicado, campo obrigatório). */
export function parseSupabaseError(err: unknown): string {
  const e = err as { code?: string; message?: string };
  if (e.code === "23505") {
    const msg = (e.message ?? "").toLowerCase();
    if (msg.includes("cpf")) return "CPF já cadastrado na empresa";
    if (msg.includes("email")) return "Email já cadastrado na empresa";
    if (msg.includes("telefone")) return "Telefone já cadastrado na empresa";
    return "Registro duplicado — verifique CPF, email ou telefone";
  }
  if (e.code === "23502") return "Preencha todos os campos obrigatórios.";
  return err instanceof Error && !e.code ? err.message : "Não foi possível salvar. Tente de novo.";
}
