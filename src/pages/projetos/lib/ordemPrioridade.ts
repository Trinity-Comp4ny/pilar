import { parseDate } from "@/lib/cronograma";
import { type Projeto } from "@/types/projetos";

type ComOrdem = Pick<Projeto, "id" | "nome" | "data_inicio" | "ordem_prioridade">;

const dataOuInfinito = (iso: string | undefined) => parseDate(iso)?.getTime() ?? Number.POSITIVE_INFINITY;

/**
 * Ordem do cronograma (SPEC 143): quem tem ordem de prioridade vem primeiro, do menor para o maior.
 * Sem ordem vai para o fim, pela data de início (como era antes) e, empatando, pelo nome.
 */
export function compararPorPrioridade(a: ComOrdem, b: ComOrdem): number {
  const oa = a.ordem_prioridade ?? Number.POSITIVE_INFINITY;
  const ob = b.ordem_prioridade ?? Number.POSITIVE_INFINITY;
  if (oa !== ob) return oa < ob ? -1 : 1;
  const da = dataOuInfinito(a.data_inicio);
  const db = dataOuInfinito(b.data_inicio);
  if (da !== db) return da < db ? -1 : 1;
  return a.nome.localeCompare(b.nome, "pt-BR");
}

/** Move um item da lista e devolve a lista nova (a original não muda). */
export function moverNaLista<T>(lista: T[], de: number, para: number): T[] {
  if (de === para || de < 0 || para < 0 || de >= lista.length || para >= lista.length) return lista;
  const copia = [...lista];
  const [item] = copia.splice(de, 1);
  copia.splice(para, 0, item);
  return copia;
}

/**
 * Ids que vão para a RPC depois de arrastar: os projetos visíveis na ordem nova e, depois deles, os
 * que o cronograma não mostra (sem datas, por exemplo) na ordem em que já estavam. Assim a
 * numeração 1..N não repete posição com projeto escondido.
 */
export function idsParaGravar(visiveisNaOrdemNova: ComOrdem[], todos: ComOrdem[]): string[] {
  const visiveis = new Set(visiveisNaOrdemNova.map((p) => p.id));
  const resto = todos.filter((p) => !visiveis.has(p.id)).sort(compararPorPrioridade);
  return [...visiveisNaOrdemNova.map((p) => p.id), ...resto.map((p) => p.id)];
}

type ComDisciplinas = Pick<Projeto, "disciplinas">;

/** O projeto é "meu" quando sou responsável por ao menos uma disciplina dele (mesma regra do Meu trabalho). */
export function projetoTemDisciplinaDaPessoa(projeto: ComDisciplinas, pessoaId: string): boolean {
  return (projeto.disciplinas ?? []).some(
    (d) => d.responsavel_id === pessoaId || (d.responsaveis ?? []).some((r) => r.responsavel_id === pessoaId)
  );
}
