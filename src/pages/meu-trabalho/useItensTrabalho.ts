// Camada de dados unificada do board de "Meu trabalho" (spec 014).
// Funde tarefas avulsas e disciplinas de projeto num único ItemTrabalho, sem
// achatar o modelo no banco: cada item guarda seu `tipo` e a origem para ações.
import { useMemo } from "react";
import type { Prioridade, StatusBucket } from "./status";
import { useDisciplinas, usePessoasEmpresa, useTarefas, type DisciplinaItem, type TarefaItem } from "./hooks";
import type { Etapa } from "./useEtapas";

export type TipoItem = "tarefa" | "disciplina";

export type ItemTrabalho = {
  /** Chave estável para React: `${tipo}:${id}`. */
  key: string;
  tipo: TipoItem;
  id: string;
  titulo: string;
  status: StatusBucket;
  prioridade: Prioridade;
  prazo: string | null;
  projetoId: string | null;
  projetoNome: string | null;
  responsavelId: string | null;
  responsavelNome: string | null;
  etapaId: string | null;
  labels: string[];
  /** Nº de comentários (só tarefa hoje). */
  comentarios: number;
  /** Nº de links. */
  links: number;
  /** A tarefa original, quando tipo === 'tarefa' (para editar no dialog). */
  tarefa?: TarefaItem;
};

export type FiltroTipo = "tudo" | "tarefa" | "disciplina";

function tarefaParaItem(t: TarefaItem, nomePorPessoa: Map<string, string>): ItemTrabalho {
  return {
    key: `tarefa:${t.id}`,
    tipo: "tarefa",
    id: t.id,
    titulo: t.titulo,
    status: t.status,
    prioridade: t.prioridade,
    prazo: t.prazo,
    projetoId: t.projeto?.id ?? t.projeto_id ?? null,
    projetoNome: t.projeto?.nome ?? null,
    responsavelId: t.responsavel_id,
    responsavelNome: t.responsavel_id ? (nomePorPessoa.get(t.responsavel_id) ?? null) : null,
    etapaId: t.etapa_id,
    labels: t.labels,
    comentarios: t.comentarios.length,
    links: t.links.length,
    tarefa: t,
  };
}

function disciplinaParaItem(d: DisciplinaItem): ItemTrabalho {
  return {
    key: `disciplina:${d.id}`,
    tipo: "disciplina",
    id: d.id,
    titulo: d.titulo,
    status: d.status_bucket,
    prioridade: d.prioridade,
    prazo: d.prazo,
    projetoId: d.projeto_id,
    projetoNome: d.projeto_nome,
    responsavelId: d.responsavel_id,
    responsavelNome: d.responsavel_nome,
    etapaId: null,
    labels: d.labels,
    comentarios: 0,
    links: d.links.length,
  };
}

type Options = {
  /** Só busca disciplinas quando a empresa tem o módulo Projetos. */
  comDisciplinas: boolean;
  tipo: FiltroTipo;
};

export function useItensTrabalho(pessoaId: string | null, { comDisciplinas, tipo }: Options) {
  const tarefasQ = useTarefas(pessoaId);
  const disciplinasQ = useDisciplinas(pessoaId, { enabled: comDisciplinas });
  const { data: pessoas } = usePessoasEmpresa();

  const itens = useMemo<ItemTrabalho[]>(() => {
    const nomePorPessoa = new Map((pessoas ?? []).map((p) => [p.id, p.nome]));
    const lista: ItemTrabalho[] = [];
    if (tipo !== "disciplina") {
      for (const t of tarefasQ.data ?? []) lista.push(tarefaParaItem(t, nomePorPessoa));
    }
    if (tipo !== "tarefa" && comDisciplinas) {
      for (const d of disciplinasQ.data ?? []) lista.push(disciplinaParaItem(d));
    }
    return lista;
  }, [tarefasQ.data, disciplinasQ.data, pessoas, tipo, comDisciplinas]);

  return {
    itens,
    isLoading: tarefasQ.isLoading || (comDisciplinas && disciplinasQ.isLoading),
    isError: tarefasQ.isError || (comDisciplinas && disciplinasQ.isError),
  };
}

export type Grupo = { chave: string; titulo: string; itens: ItemTrabalho[] };

/**
 * O board é sempre um Kanban de status; as colunas são as etapas (na ordem). A
 * tarefa cai na sua etapa (ou, se estiver sem etapa/órfã, na âncora "A fazer").
 * A disciplina, que só tem os 3 baldes, cai na etapa-âncora do seu bucket.
 */
export function colunaDaEtapa(item: ItemTrabalho, etapas: Etapa[]): string | null {
  if (etapas.length === 0) return null;
  const fallback = (etapas.find((e) => e.bucket === "a_fazer") ?? etapas[0]).id;
  if (item.tipo === "tarefa") {
    return item.etapaId && etapas.some((e) => e.id === item.etapaId) ? item.etapaId : fallback;
  }
  return (etapas.find((e) => e.bucket === item.status) ?? etapas[0]).id ?? fallback;
}

export function agruparPorEtapa(itens: ItemTrabalho[], etapas: Etapa[]): Grupo[] {
  return etapas.map((e) => ({
    chave: e.id,
    titulo: e.nome,
    itens: itens.filter((i) => colunaDaEtapa(i, etapas) === e.id),
  }));
}
