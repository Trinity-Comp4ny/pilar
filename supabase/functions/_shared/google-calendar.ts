/**
 * Google Agenda do usuário (SPEC 164): leitura, criação, edição e exclusão de eventos da
 * agenda principal, e a conversão para a linha de agenda_eventos_google. O OAuth e a cifra
 * do token vêm de `google-drive.ts` (mesmo cliente OAuth, outro escopo).
 *
 * Escopos `calendar.events` (eventos de todas as agendas da conta) e
 * `calendar.calendarlist.readonly` (quais agendas existem: pessoal, trabalho, compartilhadas).
 * Não mexe nas configurações da agenda. São escopos sensíveis (verificação do Google com
 * vídeo de uso), não restritos (sem CASA).
 */
import { fetchComTempo } from "./http.ts";
import { ErroGoogle } from "./google-drive.ts";

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export const ESCOPOS_AGENDA =
  "openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly";

/** Agenda da conta (calendarList), no formato da Pilar. */
export interface AgendaGoogle {
  calendario_id: string;
  nome: string;
  cor: string | null;
  principal: boolean;
  pode_editar: boolean;
  /** Marcada para aparecer no Google: é o padrão de visibilidade na Pilar. */
  selecionada: boolean;
}

interface ItemCalendarList {
  id?: string;
  summary?: string;
  summaryOverride?: string;
  backgroundColor?: string;
  primary?: boolean;
  accessRole?: string;
  selected?: boolean;
}

export function paraAgenda(item: ItemCalendarList): AgendaGoogle | null {
  if (!item.id || item.id.length > 1024) return null;
  // freeBusyReader só vê "ocupado", sem título: não serve como agenda na Pilar.
  if (item.accessRole !== "owner" && item.accessRole !== "writer" && item.accessRole !== "reader") return null;
  const cor = item.backgroundColor && /^#[0-9a-fA-F]{6}$/.test(item.backgroundColor) ? item.backgroundColor : null;
  return {
    calendario_id: item.id,
    nome: (item.summaryOverride || item.summary || item.id).trim().slice(0, 200),
    cor,
    principal: item.primary === true,
    pode_editar: item.accessRole === "owner" || item.accessRole === "writer",
    selecionada: item.primary === true || item.selected === true,
  };
}

/** Agendas da conta (sem as escondidas no Google e sem as só de livre/ocupado). */
export async function listarAgendas(token: string, f: Fetch = fetch): Promise<AgendaGoogle[]> {
  const agendas: AgendaGoogle[] = [];
  let pagina: string | undefined;
  do {
    const p = new URLSearchParams({
      minAccessRole: "reader",
      maxResults: "250",
      fields: "nextPageToken,items(id,summary,summaryOverride,backgroundColor,primary,accessRole,selected)",
    });
    if (pagina) p.set("pageToken", pagina);
    const r = await fetchComTempo(
      `${API}/users/me/calendarList?${p}`,
      { headers: { Authorization: `Bearer ${token}` } },
      undefined,
      f
    );
    if (!r.ok) throw new ErroGoogle(r.status, `Google Agenda respondeu ${r.status}`);
    const corpo = (await r.json()) as { items?: ItemCalendarList[]; nextPageToken?: string };
    for (const item of corpo.items ?? []) {
      const a = paraAgenda(item);
      if (a) agendas.push(a);
    }
    pagina = corpo.nextPageToken;
  } while (pagina && agendas.length < 100);
  return agendas;
}

const agendaNaUrl = (calendarioId: string) => encodeURIComponent(calendarioId);
const API = "https://www.googleapis.com/calendar/v3";

/** Janela copiada: 30 dias para trás (a aba mostra o mês) e 60 para frente. */
export const DIAS_ANTES = 30;
export const DIAS_DEPOIS = 60;
const MAX_EVENTOS = 1000;
const CAMPOS_EVENTO =
  "id,status,summary,description,location,htmlLink,hangoutLink,eventType,start,end,organizer(self),guestsCanModify,reminders,attendees(email,self,responseStatus),conferenceData(entryPoints(entryPointType,uri))";

/** Recorte do evento da API do Google Agenda que a Pilar usa. */
export interface EventoGoogle {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  hangoutLink?: string;
  transparency?: string;
  eventType?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { email?: string; self?: boolean; responseStatus?: string }[];
  organizer?: { self?: boolean };
  guestsCanModify?: boolean;
  reminders?: { useDefault?: boolean; overrides?: { method?: string; minutes?: number }[] };
  conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
}

export interface LinhaEvento {
  google_evento_id: string;
  titulo: string;
  inicio: string;
  fim: string;
  dia_inteiro: boolean;
  local: string | null;
  descricao: string | null;
  convidados: string[];
  link_reuniao: string | null;
  link_google: string | null;
  pode_editar: boolean;
  lembrete_minutos: number | null;
}

/**
 * Aviso da reunião lido do Google: o menor lembrete pop-up; sem lembrete nenhum = -1 (não
 * avisa); "padrão da agenda" = null (vale o padrão da pessoa na Pilar).
 */
export function lembreteDoEvento(r: EventoGoogle["reminders"]): number | null {
  if (!r || r.useDefault !== false) return null;
  const popups = (r.overrides ?? [])
    .filter((o) => o.method === "popup" && typeof o.minutes === "number")
    .map((o) => o.minutes as number);
  return popups.length ? Math.min(...popups) : -1;
}

/** Só https: link de reunião vira `href` e vai na notificação. */
function urlSegura(valor: string | undefined): string | null {
  if (!valor) return null;
  try {
    const u = new URL(valor);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Converte um evento do Google na linha da Pilar. Devolve null para o que não é reunião
 * do usuário: cancelado, recusado por ele, "fora do escritório", foco, local de trabalho.
 */
export function paraLinha(ev: EventoGoogle): LinhaEvento | null {
  if (!ev.id || ev.status === "cancelled") return null;
  if (ev.eventType && ev.eventType !== "default") return null;
  const eu = ev.attendees?.find((a) => a.self);
  if (eu?.responseStatus === "declined") return null;

  const diaInteiro = !ev.start?.dateTime && !!ev.start?.date;
  // Dia inteiro: a data é do calendário do usuário; meio-dia UTC não troca de dia no Brasil.
  const inicio = ev.start?.dateTime ?? (ev.start?.date ? `${ev.start.date}T12:00:00Z` : null);
  const fim = ev.end?.dateTime ?? (ev.end?.date ? `${ev.end.date}T12:00:00Z` : inicio);
  if (!inicio || !fim || Number.isNaN(Date.parse(inicio)) || Number.isNaN(Date.parse(fim))) return null;

  const video = ev.conferenceData?.entryPoints?.find((p) => p.entryPointType === "video")?.uri;
  const local = ev.location?.trim().slice(0, 300) || null;

  return {
    google_evento_id: ev.id.slice(0, 1024),
    titulo: (ev.summary?.trim() || "(sem título)").slice(0, 300),
    inicio: new Date(inicio).toISOString(),
    fim: new Date(fim).toISOString(),
    dia_inteiro: diaInteiro,
    local,
    descricao: ev.description?.slice(0, 8000) || null,
    convidados: (ev.attendees ?? [])
      .filter((a) => !a.self && a.email)
      .map((a) => (a.email as string).slice(0, 320))
      .slice(0, 100),
    link_reuniao: urlSegura(ev.hangoutLink) ?? urlSegura(video) ?? (local ? urlSegura(local) : null),
    link_google: urlSegura(ev.htmlLink),
    // Sem organizador informado é evento da própria agenda.
    pode_editar: ev.organizer?.self !== false || ev.guestsCanModify === true,
    lembrete_minutos: lembreteDoEvento(ev.reminders),
  };
}

/** Eventos da agenda principal na janela, já com as recorrências abertas. */
export async function listarEventos(
  token: string,
  de: Date,
  ate: Date,
  calendarioId = "primary",
  f: Fetch = fetch
): Promise<EventoGoogle[]> {
  const eventos: EventoGoogle[] = [];
  let pagina: string | undefined;
  do {
    const p = new URLSearchParams({
      timeMin: de.toISOString(),
      timeMax: ate.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
      fields: `nextPageToken,items(${CAMPOS_EVENTO})`,
    });
    if (pagina) p.set("pageToken", pagina);
    const r = await fetchComTempo(
      `${API}/calendars/${agendaNaUrl(calendarioId)}/events?${p}`,
      { headers: { Authorization: `Bearer ${token}` } },
      undefined,
      f
    );
    if (!r.ok) throw new ErroGoogle(r.status, `Google Agenda respondeu ${r.status}`);
    const corpo = (await r.json()) as { items?: EventoGoogle[]; nextPageToken?: string };
    eventos.push(...(corpo.items ?? []));
    pagina = corpo.nextPageToken;
  } while (pagina && eventos.length < MAX_EVENTOS);
  return eventos;
}

export function janela(agora = new Date()): { de: Date; ate: Date } {
  const dia = 24 * 60 * 60 * 1000;
  return { de: new Date(agora.getTime() - DIAS_ANTES * dia), ate: new Date(agora.getTime() + DIAS_DEPOIS * dia) };
}

// ---------------------------------------------------------------- escrita

/** O que a tela manda para criar ou editar uma reunião. */
export interface DadosReuniao {
  titulo: string;
  /** ISO com fuso (hora marcada) ou YYYY-MM-DD (dia inteiro). */
  inicio: string;
  fim: string;
  dia_inteiro: boolean;
  local?: string | null;
  descricao?: string | null;
  convidados?: string[];
  /** Cria a sala do Google Meet (só se ainda não tiver). */
  meet?: boolean;
  /** Minutos antes; null = padrão da agenda; -1 = sem aviso. */
  lembrete_minutos?: number | null;
}

/** Corpo do evento na API do Google. */
export function corpoDoEvento(d: DadosReuniao, comMeet: boolean): Record<string, unknown> {
  const quando = (v: string) => (d.dia_inteiro ? { date: v.slice(0, 10) } : { dateTime: new Date(v).toISOString() });
  // Dia inteiro: a tela manda o último dia; o Google quer o dia seguinte (fim exclusivo).
  const fimDiaInteiro = () => {
    const dia = new Date(`${d.fim.slice(0, 10)}T12:00:00Z`);
    dia.setUTCDate(dia.getUTCDate() + 1);
    return { date: dia.toISOString().slice(0, 10) };
  };
  const lembrete = d.lembrete_minutos;
  return {
    summary: d.titulo,
    description: d.descricao ?? "",
    location: d.local ?? "",
    start: quando(d.inicio),
    end: d.dia_inteiro ? fimDiaInteiro() : quando(d.fim),
    attendees: (d.convidados ?? []).map((email) => ({ email })),
    reminders:
      lembrete === null || lembrete === undefined
        ? { useDefault: true }
        : { useDefault: false, overrides: lembrete < 0 ? [] : [{ method: "popup", minutes: lembrete }] },
    ...(comMeet
      ? {
          conferenceData: {
            createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } },
          },
        }
      : {}),
  };
}

/** Id de evento do Google: base32hex em minúsculas, mais "_" das ocorrências de recorrência. */
export function idEventoValido(id: unknown): id is string {
  return typeof id === "string" && /^[a-zA-Z0-9_]{5,1024}$/.test(id);
}

async function escrever(token: string, url: string, init: RequestInit, f: Fetch): Promise<Response> {
  const r = await fetchComTempo(
    url,
    {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    },
    undefined,
    f
  );
  if (!r.ok) throw new ErroGoogle(r.status, `Google Agenda respondeu ${r.status}`);
  return r;
}

// sendUpdates=all: os convidados recebem o convite (ou a mudança) por e-mail, como no Google.
const PARAMS_ESCRITA = `conferenceDataVersion=1&sendUpdates=all&fields=${encodeURIComponent(CAMPOS_EVENTO)}`;

export async function criarEvento(
  token: string,
  d: DadosReuniao,
  calendarioId = "primary",
  f: Fetch = fetch
): Promise<EventoGoogle> {
  const r = await escrever(
    token,
    `${API}/calendars/${agendaNaUrl(calendarioId)}/events?${PARAMS_ESCRITA}`,
    { method: "POST", body: JSON.stringify(corpoDoEvento(d, !!d.meet)) },
    f
  );
  return (await r.json()) as EventoGoogle;
}

export async function editarEvento(
  token: string,
  calendarioId: string,
  id: string,
  d: DadosReuniao,
  jaTemMeet: boolean,
  f: Fetch = fetch
): Promise<EventoGoogle> {
  if (!idEventoValido(id)) throw new ErroGoogle(400, "evento inválido");
  const r = await escrever(
    token,
    `${API}/calendars/${agendaNaUrl(calendarioId)}/events/${id}?${PARAMS_ESCRITA}`,
    { method: "PATCH", body: JSON.stringify(corpoDoEvento(d, !!d.meet && !jaTemMeet)) },
    f
  );
  return (await r.json()) as EventoGoogle;
}

export async function excluirEvento(token: string, calendarioId: string, id: string, f: Fetch = fetch): Promise<void> {
  if (!idEventoValido(id)) throw new ErroGoogle(400, "evento inválido");
  try {
    await escrever(
      token,
      `${API}/calendars/${agendaNaUrl(calendarioId)}/events/${id}?sendUpdates=all`,
      { method: "DELETE" },
      f
    );
  } catch (e) {
    // Já apagado no Google: para a Pilar, deu certo.
    if (e instanceof ErroGoogle && (e.status === 404 || e.status === 410)) return;
    throw e;
  }
}
