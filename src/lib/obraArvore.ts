// Árvore do cronograma da obra (spec 111): fase > etapa > serviço > tarefa.
// Os três primeiros níveis moram em `obra_frente` (nivel + parent_id); a tarefa
// é a linha de `tarefas` pendurada no serviço. Lista e Gantt leem a mesma árvore,
// montada aqui, com período, avanço e estado de cada nível já somados de baixo
// para cima.
import { calcularAvanco, estadoFrenteCronograma, type EstadoFrente } from "./obras";

export type NivelCronograma = "fase" | "etapa" | "servico";

export const NIVEL_LABEL: Record<NivelCronograma, string> = {
  fase: "Fase",
  etapa: "Etapa",
  servico: "Serviço",
};

/** Filho direto de cada nível (serviço tem tarefa, que não é nó). */
export const NIVEL_FILHO: Record<NivelCronograma, NivelCronograma | "tarefa"> = {
  fase: "etapa",
  etapa: "servico",
  servico: "tarefa",
};

export interface NoInput {
  id: string;
  parent_id: string | null;
  nivel: string;
  nome: string;
  ordem: number;
  data_inicio: string | null;
  data_fim: string | null;
  created_at: string;
}

export interface TarefaInput {
  id: string;
  obra_frente_id: string | null;
  status: string;
  data_inicio: string | null;
  prazo: string | null;
  created_at: string;
}

export interface Periodo {
  inicio: string;
  fim: string;
}

export interface NoArvore<N extends NoInput = NoInput, T extends TarefaInput = TarefaInput> {
  no: N;
  nivel: NivelCronograma;
  filhos: NoArvore<N, T>[];
  /** Tarefas penduradas direto neste nó (na prática, só em serviço). */
  tarefas: T[];
  /** Todas as tarefas abaixo, em qualquer profundidade. */
  todasTarefas: T[];
  /** Período próprio (as duas datas preenchidas), arrastável no Gantt. */
  periodoProprio: Periodo | null;
  /** União do período próprio com o dos filhos e das tarefas: a barra-resumo. */
  periodo: Periodo | null;
  progresso: number;
  concluidas: number;
  total: number;
  estado: EstadoFrente;
}

export interface ArvoreCronograma<N extends NoInput = NoInput, T extends TarefaInput = TarefaInput> {
  fases: NoArvore<N, T>[];
  /** Tarefas da obra fora de qualquer serviço (campo, legado, serviço excluído). */
  soltas: T[];
}

const NIVEIS = new Set<string>(["fase", "etapa", "servico"]);

function nivelDe(n: NoInput): NivelCronograma {
  return NIVEIS.has(n.nivel) ? (n.nivel as NivelCronograma) : "etapa";
}

function ordenar<X extends { ordem?: number; created_at: string }>(a: X, b: X): number {
  return (a.ordem ?? 0) - (b.ordem ?? 0) || a.created_at.localeCompare(b.created_at);
}

/** Une períodos; datas em "YYYY-MM-DD" ordenam certo como string. */
export function unirPeriodos(periodos: ReadonlyArray<Periodo | null>): Periodo | null {
  let inicio: string | null = null;
  let fim: string | null = null;
  for (const p of periodos) {
    if (!p) continue;
    if (!inicio || p.inicio < inicio) inicio = p.inicio;
    if (!fim || p.fim > fim) fim = p.fim;
  }
  return inicio && fim ? { inicio, fim } : null;
}

function periodoDe(inicio: string | null, fim: string | null): Periodo | null {
  return inicio && fim ? { inicio, fim } : null;
}

export function montarArvoreCronograma<N extends NoInput, T extends TarefaInput>(
  nos: ReadonlyArray<N>,
  tarefas: ReadonlyArray<T>,
  hoje: Date = new Date()
): ArvoreCronograma<N, T> {
  const porId = new Map(nos.map((n) => [n.id, n]));
  const filhosDe = new Map<string | null, N[]>();
  for (const n of nos) {
    // Pai que não veio na lista vira raiz, para nada sumir da tela.
    const pai = n.parent_id && porId.has(n.parent_id) ? n.parent_id : null;
    const lista = filhosDe.get(pai) ?? [];
    lista.push(n);
    filhosDe.set(pai, lista);
  }

  const tarefasDe = new Map<string, T[]>();
  const soltas: T[] = [];
  for (const t of [...tarefas].sort(ordenar)) {
    if (t.obra_frente_id && porId.has(t.obra_frente_id)) {
      const lista = tarefasDe.get(t.obra_frente_id) ?? [];
      lista.push(t);
      tarefasDe.set(t.obra_frente_id, lista);
    } else {
      soltas.push(t);
    }
  }

  const montar = (n: N): NoArvore<N, T> => {
    const filhos = (filhosDe.get(n.id) ?? []).sort(ordenar).map(montar);
    const diretas = tarefasDe.get(n.id) ?? [];
    const todasTarefas = [...diretas, ...filhos.flatMap((f) => f.todasTarefas)];
    const periodoProprio = periodoDe(n.data_inicio, n.data_fim);
    const periodo = unirPeriodos([
      periodoProprio,
      ...filhos.map((f) => f.periodo),
      ...diretas.map((t) => periodoDe(t.data_inicio, t.prazo)),
    ]);
    const concluidas = todasTarefas.filter((t) => t.status === "concluida").length;
    return {
      no: n,
      nivel: nivelDe(n),
      filhos,
      tarefas: diretas,
      todasTarefas,
      periodoProprio,
      periodo,
      progresso: calcularAvanco(todasTarefas),
      concluidas,
      total: todasTarefas.length,
      estado: estadoFrenteCronograma(
        { data_inicio: periodo?.inicio ?? null, data_fim: periodo?.fim ?? null },
        todasTarefas,
        hoje
      ),
    };
  };

  return { fases: (filhosDe.get(null) ?? []).sort(ordenar).map(montar), soltas };
}

export type LinhaCronograma<N extends NoInput = NoInput, T extends TarefaInput = TarefaInput> =
  | { tipo: "no"; chave: string; profundidade: number; arvore: NoArvore<N, T> }
  | { tipo: "tarefa"; chave: string; profundidade: number; tarefa: T; servicoId: string };

/**
 * Linhas visíveis, em ordem, para a lista e o Gantt. `recolhidos` guarda os ids
 * dos nós fechados (vazio = tudo aberto).
 */
export function achatarArvore<N extends NoInput, T extends TarefaInput>(
  fases: ReadonlyArray<NoArvore<N, T>>,
  recolhidos: ReadonlySet<string>
): LinhaCronograma<N, T>[] {
  const linhas: LinhaCronograma<N, T>[] = [];
  const visitar = (a: NoArvore<N, T>, profundidade: number) => {
    linhas.push({ tipo: "no", chave: `no:${a.no.id}`, profundidade, arvore: a });
    if (recolhidos.has(a.no.id)) return;
    for (const f of a.filhos) visitar(f, profundidade + 1);
    for (const t of a.tarefas) {
      linhas.push({
        tipo: "tarefa",
        chave: `tarefa:${t.id}`,
        profundidade: profundidade + 1,
        tarefa: t,
        servicoId: a.no.id,
      });
    }
  };
  for (const f of fases) visitar(f, 0);
  return linhas;
}

/** "Fase › Etapa › Serviço" de um nó, para rótulo em seletores e na gestão de tarefas. */
export function caminhoDoNo(nos: ReadonlyArray<Pick<NoInput, "id" | "parent_id" | "nome">>, id: string): string {
  const porId = new Map(nos.map((n) => [n.id, n]));
  const partes: string[] = [];
  let atual = porId.get(id);
  // Limite de profundidade protege contra ciclo em dado corrompido.
  for (let i = 0; atual && i < 5; i++) {
    partes.unshift(atual.nome);
    atual = atual.parent_id ? porId.get(atual.parent_id) : undefined;
  }
  return partes.join(" › ");
}
