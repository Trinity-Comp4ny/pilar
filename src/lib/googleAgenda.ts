import { supabase } from "@/integrations/supabase/client";
import { invocar } from "@/lib/googleDrive";
import { type PrazoEvento, fmtKey } from "@/components/calendario/eventos";

/**
 * Google Agenda do usuário (SPEC 164): chamadas à Edge Function `google-calendar` e a
 * conversão das reuniões copiadas em eventos da camada "Reuniões" do calendário.
 */

export interface EventoAgenda {
  id: string;
  /** Agenda do Google de onde veio (pessoal, trabalho...). */
  calendario_id: string;
  titulo: string;
  inicio: string;
  fim: string;
  dia_inteiro: boolean;
  local: string | null;
  descricao: string | null;
  convidados: string[];
  link_reuniao: string | null;
  link_google: string | null;
  /** A pessoa organiza (ou o organizador deixou convidado editar). */
  pode_editar: boolean;
  /** Minutos antes; null = padrão da pessoa; -1 = sem aviso. */
  lembrete_minutos: number | null;
}

/** O que vai para a Edge Function ao criar ou editar. */
export interface DadosReuniao {
  titulo: string;
  /** ISO com fuso (hora marcada) ou YYYY-MM-DD (dia inteiro; fim = último dia). */
  inicio: string;
  fim: string;
  dia_inteiro: boolean;
  local: string | null;
  descricao: string | null;
  convidados: string[];
  meet: boolean;
  lembrete_minutos: number | null;
  /** Agenda onde nasce (só ao criar); sem ela, a principal. */
  calendario_id?: string;
}

/** Uma agenda da conta Google e se aparece na Pilar. */
export interface AgendaDaConta {
  id: string;
  calendario_id: string;
  nome: string;
  cor: string | null;
  principal: boolean;
  pode_editar: boolean;
  visivel: boolean;
}

/** Liga ou desliga uma agenda na Pilar (desligar tira as reuniões e os avisos dela). */
export async function definirAgendaVisivel(id: string, visivel: boolean): Promise<void> {
  const { error } = await supabase.rpc("set_google_agenda_calendario_visivel", { p_id: id, p_visivel: visivel });
  if (error) throw error;
}

/** Opções de aviso (minutos antes). */
export const OPCOES_AVISO: { valor: number; rotulo: string }[] = [
  { valor: 0, rotulo: "Na hora" },
  { valor: 5, rotulo: "5 minutos antes" },
  { valor: 10, rotulo: "10 minutos antes" },
  { valor: 15, rotulo: "15 minutos antes" },
  { valor: 30, rotulo: "30 minutos antes" },
  { valor: 60, rotulo: "1 hora antes" },
  { valor: 1440, rotulo: "1 dia antes" },
];

export const AVISO_PADRAO = 10;

export function rotuloAviso(minutos: number | null): string {
  if (minutos === null || minutos < 0) return "Não avisar";
  return OPCOES_AVISO.find((o) => o.valor === minutos)?.rotulo ?? `${minutos} minutos antes`;
}

/** Leva o usuário ao consentimento do Google; o Google devolve para a página atual. */
export async function conectarGoogleAgenda(
  retorno = `${window.location.pathname}${window.location.search}${window.location.hash}`
) {
  const { url } = await invocar<{ url: string }>(
    "google-calendar",
    { acao: "iniciar", retorno },
    "Não foi possível abrir o Google para conectar."
  );
  window.location.assign(url);
}

export const sincronizarAgenda = () =>
  invocar<{ ok: true; eventos: number }>(
    "google-calendar",
    { acao: "sincronizar" },
    "Não foi possível atualizar a agenda."
  );

export const criarReuniao = (reuniao: DadosReuniao) =>
  invocar<{ ok: true; evento: { id: string } | null }>(
    "google-calendar",
    { acao: "criar", reuniao },
    "Não foi possível criar a reunião."
  );

export const editarReuniao = (id: string, reuniao: DadosReuniao) =>
  invocar<{ ok: true }>("google-calendar", { acao: "editar", id, reuniao }, "Não foi possível salvar a reunião.");

export const excluirReuniao = (id: string) =>
  invocar<{ ok: true }>("google-calendar", { acao: "excluir", id }, "Não foi possível excluir a reunião.");

/** Aviso padrão da pessoa (minutos antes); null = não avisar. */
export async function definirAvisoPadrao(minutos: number | null): Promise<void> {
  const { error } = await supabase.rpc("set_google_agenda_lembrete", { p_minutos: minutos ?? -1 });
  if (error) throw error;
}

export const desconectarAgenda = () =>
  invocar<{ ok: true }>("google-calendar", { acao: "desconectar" }, "Não foi possível desconectar.");

const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** O link é uma sala do Google Meet? Compara o host inteiro, não um pedaço da URL. */
export function ehGoogleMeet(link: string | null): boolean {
  if (!link) return false;
  try {
    return new URL(link).hostname === "meet.google.com";
  } catch {
    return false;
  }
}

/** "14:00–15:00 · Meet" / "Dia inteiro · Sala 2". */
export function rotuloHorario(ev: EventoAgenda): string {
  const quando = ev.dia_inteiro ? "Dia inteiro" : `${hora(ev.inicio)}–${hora(ev.fim)}`;
  const onde = ehGoogleMeet(ev.link_reuniao) ? "Meet" : ev.link_reuniao ? "Online" : ev.local;
  return onde ? `${quando} · ${onde}` : quando;
}

/** Link que o clique abre: a sala da reunião, senão o evento no Google Agenda. */
export const linkDoEvento = (ev: Pick<EventoAgenda, "link_reuniao" | "link_google">) =>
  ev.link_reuniao ?? ev.link_google;

/** Reuniões viram eventos da camada "reuniao", no dia local de início, em ordem de horário. */
export function buildEventosReunioes(eventos: EventoAgenda[], agora: Date = new Date()): PrazoEvento[] {
  return [...eventos]
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
    .map((ev) => ({
      id: ev.id,
      data: ev.dia_inteiro ? ev.inicio.slice(0, 10) : fmtKey(new Date(ev.inicio)),
      camada: "reuniao" as const,
      estado: new Date(ev.fim) < agora ? ("concluido" as const) : ("compromisso" as const),
      titulo: ev.titulo,
      subtitulo: rotuloHorario(ev),
      status: "",
    }));
}
