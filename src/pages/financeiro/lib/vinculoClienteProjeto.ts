/**
 * Vínculo cliente e projeto no lançamento de receita. O projeto já pertence a um cliente
 * (`projetos.cliente_id`); o formulário usa isso para não deixar o usuário lançar um
 * recebimento do cliente A num projeto do cliente B.
 */
export interface ProjetoOpcao {
  id: string;
  nome: string;
  cliente_id: string | null;
}

/** Cliente dono do projeto, ou null se o projeto não existe ou não tem cliente. */
export function clienteDoProjeto(projetos: ProjetoOpcao[], projetoId: string): string | null {
  return projetos.find((p) => p.id === projetoId)?.cliente_id ?? null;
}

/**
 * Projetos que o seletor oferece. Sem cliente escolhido, todos. Com cliente, só os dele,
 * mais o projeto já selecionado (editar um lançamento antigo não pode esvaziar o campo).
 */
export function projetosDoCliente(projetos: ProjetoOpcao[], clienteId: string, projetoSelecionadoId?: string) {
  if (!clienteId) return projetos;
  return projetos.filter((p) => p.cliente_id === clienteId || p.id === projetoSelecionadoId);
}

/** Ao trocar de cliente, o projeto escolhido continua só se for do novo cliente. */
export function projetoContinuaValido(
  projetos: ProjetoOpcao[],
  projetoId: string | undefined,
  novoClienteId: string
): boolean {
  if (!projetoId) return true;
  const dono = clienteDoProjeto(projetos, projetoId);
  return dono === null || dono === novoClienteId;
}
