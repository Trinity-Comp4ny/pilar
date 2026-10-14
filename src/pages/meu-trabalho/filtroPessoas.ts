const EU = "eu";

/**
 * Ids de pessoa que a lista de tarefas filtra. Todo mundo da empresa vê as
 * tarefas de todos, então o filtro é de escolha, não de permissão:
 * `null` = sem filtro (todas, inclusive tarefa sem responsável); array = só
 * as tarefas de quem está nele, onde "eu" vira a própria pessoa. Array vazio
 * (só "eu" sem pessoa vinculada) é filtro ativo que não bate com ninguém.
 */
export function resolverPessoaIds({
  filtroPessoas,
  minhaPessoaId,
}: {
  filtroPessoas: string[];
  minhaPessoaId: string | null;
}): string[] | null {
  if (filtroPessoas.length === 0) return null;
  const ids = new Set<string>();
  for (const v of filtroPessoas) {
    if (v !== EU) ids.add(v);
    else if (minhaPessoaId) ids.add(minhaPessoaId);
  }
  return [...ids];
}
