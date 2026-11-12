import { invocar } from "@/lib/googleDrive";
import { type PrazoEvento, fmtKey } from "@/components/calendario/eventos";

/**
 * Google Agenda do usuário (SPEC 164): chamadas à Edge Function `google-calendar` e a
 * conversão das reuniões copiadas em eventos da camada "Reuniões" do calendário.
 */

export interface EventoAgenda {
  id: string;
  titulo: string;
  inicio: string;
  fim: string;
  dia_inteiro: boolean;
  local: string | null;
  link_reuniao: string | null;
  link_google: string | null;
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

export const desconectarAgenda = () =>
  invocar<{ ok: true }>("google-calendar", { acao: "desconectar" }, "Não foi possível desconectar.");

const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** "14:00–15:00 · Meet" / "Dia inteiro · Sala 2". */
export function rotuloHorario(ev: EventoAgenda): string {
  const quando = ev.dia_inteiro ? "Dia inteiro" : `${hora(ev.inicio)}–${hora(ev.fim)}`;
  const onde = ev.link_reuniao?.includes("meet.google.com") ? "Meet" : ev.link_reuniao ? "Online" : ev.local;
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
