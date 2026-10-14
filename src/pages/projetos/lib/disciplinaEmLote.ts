import { supabase } from "@/integrations/supabase/client";
import type { Projeto } from "@/types/projetos";

export type CatalogoLinha = { id: string; nome: string; empresa_id: string | null };

type Resultado = PromiseLike<{ error: Error | null }>;

// `projeto_disciplinas` guarda o nome em texto, então disciplina é um nome:
// renomear ou excluir vale para o catálogo e para todo projeto que a usa.
const chave = (nome: string) => nome.trim().toLowerCase();
const LOTE = 100; // .in() vai na URL; lote evita estourar o limite de tamanho

/** Linhas de projeto_disciplinas com este nome e em quantos projetos aparecem. */
export function usosDaDisciplina(projetos: Projeto[], nome: string) {
  const alvo = chave(nome);
  const discIds: string[] = [];
  const projetoIds = new Set<string>();
  for (const projeto of projetos) {
    for (const disc of projeto.disciplinas) {
      if (disc.id && chave(disc.disciplina) === alvo) {
        discIds.push(disc.id);
        projetoIds.add(projeto.id);
      }
    }
  }
  return { discIds, projetos: projetoIds.size };
}

/** O nome já é de outra disciplina (catálogo ou projetos), ignorando a que está sendo editada. */
export function nomeJaExiste(
  nome: string,
  { projetos, catalogo, ignorar }: { projetos: Projeto[]; catalogo: CatalogoLinha[]; ignorar?: string }
) {
  const alvo = chave(nome);
  if (ignorar && chave(ignorar) === alvo) return false;
  return (
    catalogo.some((c) => chave(c.nome) === alvo) ||
    projetos.some((p) => p.disciplinas.some((d) => chave(d.disciplina) === alvo))
  );
}

async function emLotes(ids: string[], acao: (lote: string[]) => Resultado) {
  for (let i = 0; i < ids.length; i += LOTE) {
    const { error } = await acao(ids.slice(i, i + LOTE));
    if (error) throw error;
  }
}

/** Só as disciplinas da própria empresa: a RLS não deixa mexer em outra. */
function linhasDoCatalogo(catalogo: CatalogoLinha[], nome: string) {
  return catalogo.filter((c) => c.empresa_id && chave(c.nome) === chave(nome));
}

export async function renomearDisciplina(args: {
  nome: string;
  novoNome: string;
  projetos: Projeto[];
  catalogo: CatalogoLinha[];
}) {
  const { nome, novoNome, projetos, catalogo } = args;
  const { discIds } = usosDaDisciplina(projetos, nome);
  await emLotes(discIds, (ids) => supabase.from("projeto_disciplinas").update({ nome: novoNome }).in("id", ids));
  for (const linha of linhasDoCatalogo(catalogo, nome)) {
    const { error } = await supabase.from("disciplinas").update({ nome: novoNome }).eq("id", linha.id);
    if (error) throw error;
  }
}

export async function excluirDisciplina(args: { nome: string; projetos: Projeto[]; catalogo: CatalogoLinha[] }) {
  const { nome, projetos, catalogo } = args;
  const { discIds } = usosDaDisciplina(projetos, nome);
  await emLotes(discIds, (ids) => supabase.from("projeto_disciplinas").delete().in("id", ids));
  for (const linha of linhasDoCatalogo(catalogo, nome)) {
    const { error } = await supabase.from("disciplinas").delete().eq("id", linha.id);
    if (error) throw error;
  }
}
