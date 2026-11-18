import type { ProjetoDisciplinaDB } from "@/types/projetos";
export function atribuicaoDisciplina(
  tipo: "interna" | "terceirizada",
  prestador: string,
  ids: string[] | undefined,
  pessoas: { id: string; nome: string }[]
) {
  return {
    tipo_execucao: tipo,
    prestador_nome: tipo === "terceirizada" ? prestador || "Serviço terceirizado" : null,
    ...(ids ? { responsaveis: ids.map((id) => ({ id, nome: pessoas.find((p) => p.id === id)?.nome ?? "" })) } : {}),
  } satisfies Partial<ProjetoDisciplinaDB>;
}
export function atribuicaoLegacy(
  tipo: "interna" | "terceirizada",
  prestador: string,
  ids: string[] | undefined,
  pessoas: { id: string; nome: string }[]
) {
  const patch = atribuicaoDisciplina(tipo, prestador, ids, pessoas);
  const { responsaveis: dbResponsaveis, ...campos } = patch;
  const responsaveis = dbResponsaveis?.map((r) => ({ responsavel_id: r.id, responsavel_nome: r.nome }));
  return {
    ...campos,
    ...(responsaveis
      ? {
          responsaveis,
          responsavel_id: responsaveis[0]?.responsavel_id ?? "",
          responsavel_nome: responsaveis[0]?.responsavel_nome ?? "",
        }
      : {}),
  };
}
