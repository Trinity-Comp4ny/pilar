/**
 * Google Agenda do usuário (SPEC 164): leitura dos eventos e a conversão para a linha de
 * agenda_eventos_google. O OAuth e a cifra do token vêm de `google-drive.ts` (mesmo
 * cliente OAuth, outro escopo).
 *
 * Escopo `calendar.events.readonly`: a Pilar só lê eventos; não cria nem altera nada na
 * agenda. É escopo sensível (verificação do Google com vídeo de uso), não restrito (sem CASA).
 */
import { fetchComTempo } from "./http.ts";
import { ErroGoogle } from "./google-drive.ts";

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export const ESCOPOS_AGENDA = "openid email https://www.googleapis.com/auth/calendar.events.readonly";
const API = "https://www.googleapis.com/calendar/v3";

/** Janela copiada: 30 dias para trás (a aba mostra o mês) e 60 para frente. */
export const DIAS_ANTES = 30;
export const DIAS_DEPOIS = 60;
const MAX_EVENTOS = 1000;

/** Recorte do evento da API do Google Agenda que a Pilar usa. */
export interface EventoGoogle {
  id: string;
  status?: string;
  summary?: string;
  location?: string;
  htmlLink?: string;
  hangoutLink?: string;
  transparency?: string;
  eventType?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { self?: boolean; responseStatus?: string }[];
  conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
}

export interface LinhaEvento {
  google_evento_id: string;
  titulo: string;
  inicio: string;
  fim: string;
  dia_inteiro: boolean;
  local: string | null;
  link_reuniao: string | null;
  link_google: string | null;
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
    link_reuniao: urlSegura(ev.hangoutLink) ?? urlSegura(video) ?? (local ? urlSegura(local) : null),
    link_google: urlSegura(ev.htmlLink),
  };
}

/** Eventos da agenda principal na janela, já com as recorrências abertas. */
export async function listarEventos(token: string, de: Date, ate: Date, f: Fetch = fetch): Promise<EventoGoogle[]> {
  const eventos: EventoGoogle[] = [];
  let pagina: string | undefined;
  do {
    const p = new URLSearchParams({
      timeMin: de.toISOString(),
      timeMax: ate.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
      fields:
        "nextPageToken,items(id,status,summary,location,htmlLink,hangoutLink,eventType,start,end,attendees(self,responseStatus),conferenceData(entryPoints(entryPointType,uri)))",
    });
    if (pagina) p.set("pageToken", pagina);
    const r = await fetchComTempo(
      `${API}/calendars/primary/events?${p}`,
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
