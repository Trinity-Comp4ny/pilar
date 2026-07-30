import { type Projeto, type DisciplinaResponsavel, getResponsaveisList } from "@/types/projetos";
import { FolderKanban, Layers, CheckSquare, type LucideIcon } from "lucide-react";

// Uma "camada" é uma fonte de eventos que o usuário liga/desliga na sidebar,
// no modelo "Meus calendários" do Google (ADR 0010). O motor é agnóstico à
// origem: cada tela monta os eventos das camadas que fizerem sentido ali.
export type CamadaId = "projeto" | "disciplina" | "tarefa";
export type EventoEstado = "atrasado" | "proximo" | "concluido" | "futuro";

export interface PrazoEvento {
  /** id do item de origem (projeto, disciplina ou tarefa); usado no clique. */
  id: string;
  data: string; // YYYY-MM-DD
  camada: CamadaId;
  estado: EventoEstado;
  /** Rótulo principal do evento. */
  titulo: string;
  /** Linha secundária (ex.: "COD — Projeto"). */
  subtitulo?: string;
  responsavel?: string;
  status: string;
  /** Projeto de origem, quando houver (navegação de projeto/disciplina). */
  projetoId?: string;
}

/** Estado de visibilidade das camadas (toggles "Meus calendários"). */
export type CamadasVisiveis = Partial<Record<CamadaId, boolean>>;

interface CamadaMeta {
  label: string;
  icon: LucideIcon;
  /** Classe do checkbox marcado na sidebar. */
  toggleClass: string;
}

/** Metadados de cada camada conhecida (rótulo, ícone, cor do toggle). */
export const CAMADA_REGISTRY: Record<CamadaId, CamadaMeta> = {
  projeto: {
    label: "Projetos",
    icon: FolderKanban,
    toggleClass: "data-[state=checked]:!bg-brand data-[state=checked]:!border-brand data-[state=checked]:!text-ink",
  },
  disciplina: {
    label: "Disciplinas",
    icon: Layers,
    toggleClass: "data-[state=checked]:!bg-brand data-[state=checked]:!border-brand data-[state=checked]:!text-ink",
  },
  tarefa: {
    label: "Tarefas",
    icon: CheckSquare,
    toggleClass: "data-[state=checked]:!bg-brand data-[state=checked]:!border-brand data-[state=checked]:!text-ink",
  },
};

// Início da semana em segunda, como no Google Calendar de referência (spec 009).
export const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
export const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function fmtKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return fmtKey(new Date());
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/** Offset do dia da semana com segunda = 0 ... domingo = 6. */
export function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** Segunda-feira da semana que contém `d`. */
export function startOfWeek(d: Date): Date {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - weekdayIndex(s));
  return s;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function calcEstado(dataStr: string, concluido: boolean, hoje: string, in7: string): EventoEstado {
  if (concluido) return "concluido";
  if (dataStr < hoje) return "atrasado";
  if (dataStr <= in7) return "proximo";
  return "futuro";
}

/**
 * Monta os eventos das camadas de projeto (prazo do projeto) e de disciplina.
 * Emite as duas camadas sempre; quem esconde por toggle é o motor
 * (`filtrarVisiveis`). Aplica os filtros de projeto/responsável e a busca.
 */
export function buildEventosProjetos(
  projetos: Projeto[],
  filtroProjeto: string,
  filtroResponsavel: string,
  busca: string
): PrazoEvento[] {
  const hoje = todayKey();
  const in7 = fmtKey(addDays(new Date(), 7));
  const termo = busca.trim().toLowerCase();
  const list: PrazoEvento[] = [];

  for (const p of projetos) {
    if (p.data_previsao) {
      list.push({
        id: p.id,
        data: p.data_previsao,
        camada: "projeto",
        estado: calcEstado(p.data_previsao, p.status === "Concluído" || p.status === "Cancelado", hoje, in7),
        titulo: p.nome,
        subtitulo: p.codigo_projeto,
        status: p.status,
        projetoId: p.id,
      });
    }

    for (const d of p.disciplinas as DisciplinaResponsavel[]) {
      if (!d.data_previsao) continue;
      const resps = getResponsaveisList(d);
      const respNome = resps.length > 0 ? resps.map((r) => r.responsavel_nome).join(", ") : undefined;
      const status = d.status || "Não Iniciado";
      list.push({
        id: d.id ?? `${p.id}-${d.disciplina}`,
        data: d.data_previsao,
        camada: "disciplina",
        estado: calcEstado(d.data_previsao, status === "Concluído", hoje, in7),
        titulo: d.disciplina,
        subtitulo: `${p.codigo_projeto} — ${p.nome}`,
        responsavel: respNome,
        status,
        projetoId: p.id,
      });
    }
  }

  return list.filter((e) => {
    if (filtroProjeto !== "todos" && e.projetoId !== filtroProjeto) return false;
    if (filtroResponsavel !== "todos") {
      if (!e.responsavel) return false;
      if (!e.responsavel.toLowerCase().includes(filtroResponsavel.toLowerCase())) return false;
    }
    if (termo) {
      const alvo = `${e.titulo} ${e.subtitulo ?? ""}`.toLowerCase();
      if (!alvo.includes(termo)) return false;
    }
    return true;
  });
}

/** Item mínimo de tarefa que a camada "tarefa" consome. */
export interface TarefaEventoInput {
  id: string;
  titulo: string;
  prazo: string | null;
  concluida: boolean;
  projetoNome?: string | null;
  responsavel?: string | null;
}

/** Monta os eventos da camada de tarefas (só as que têm prazo). */
export function buildEventosTarefas(tarefas: TarefaEventoInput[]): PrazoEvento[] {
  const hoje = todayKey();
  const in7 = fmtKey(addDays(new Date(), 7));
  const list: PrazoEvento[] = [];

  for (const t of tarefas) {
    if (!t.prazo) continue;
    list.push({
      id: t.id,
      data: t.prazo,
      camada: "tarefa",
      estado: calcEstado(t.prazo, t.concluida, hoje, in7),
      titulo: t.titulo,
      subtitulo: t.projetoNome ?? "Tarefa avulsa",
      responsavel: t.responsavel ?? undefined,
      status: t.concluida ? "Concluído" : "",
    });
  }

  return list;
}

/** Item mínimo de disciplina que a camada "disciplina" consome (escopo pessoal). */
export interface DisciplinaEventoInput {
  id: string;
  titulo: string;
  prazo: string | null;
  concluida: boolean;
  projetoId: string;
  projetoNome?: string | null;
  responsavel?: string | null;
}

/** Monta os eventos da camada de disciplinas a partir da lista já escopada. */
export function buildEventosDisciplinas(disciplinas: DisciplinaEventoInput[]): PrazoEvento[] {
  const hoje = todayKey();
  const in7 = fmtKey(addDays(new Date(), 7));
  const list: PrazoEvento[] = [];

  for (const d of disciplinas) {
    if (!d.prazo) continue;
    list.push({
      id: d.id,
      data: d.prazo,
      camada: "disciplina",
      estado: calcEstado(d.prazo, d.concluida, hoje, in7),
      titulo: d.titulo,
      subtitulo: d.projetoNome ?? undefined,
      responsavel: d.responsavel ?? undefined,
      status: d.concluida ? "Concluído" : "",
      projetoId: d.projetoId,
    });
  }

  return list;
}

/** Esconde os eventos das camadas desligadas nos toggles. */
export function filtrarVisiveis(eventos: PrazoEvento[], visiveis: CamadasVisiveis): PrazoEvento[] {
  return eventos.filter((e) => visiveis[e.camada] !== false);
}

export function groupByDia(eventos: PrazoEvento[]): Map<string, PrazoEvento[]> {
  const map = new Map<string, PrazoEvento[]>();
  for (const e of eventos) {
    const arr = map.get(e.data) || [];
    arr.push(e);
    map.set(e.data, arr);
  }
  return map;
}

// ── Estilos por estado, partilhados pelas visões ──────────────────────────────
export const ESTADO_CHIP: Record<EventoEstado, string> = {
  atrasado: "bg-red-100 text-red-700 border-red-500",
  proximo: "bg-amber-100 text-amber-700 border-amber-500",
  concluido: "bg-positive/10 text-positive-strong border-positive",
  futuro: "bg-blue-100 text-blue-700 border-blue-500",
};

export const ESTADO_SIMBOLO: Record<EventoEstado, string> = {
  atrasado: "⚠",
  proximo: "»",
  concluido: "✓",
  futuro: "•",
};

export const ESTADO_LABEL: Record<EventoEstado, string> = {
  atrasado: "Em atraso",
  proximo: "Próximos 7 dias",
  concluido: "Concluído",
  futuro: "Futuro",
};
