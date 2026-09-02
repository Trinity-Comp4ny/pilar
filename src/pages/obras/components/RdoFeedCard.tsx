import { CalendarClock, Cloud, CloudLightning, CloudRain, Sun } from "lucide-react";
import { climaLabel, resumoFeedRdo } from "@/lib/obras";
import { formatDate } from "@/lib/format";

/** Ícone por clima do RDO — mesmo enum de src/lib/obras.ts (ClimaRdo). */
const CLIMA_ICON: Record<string, typeof Sun> = {
  ensolarado: Sun,
  nublado: Cloud,
  chuvoso: CloudRain,
  chuva_forte: CloudLightning,
};

export interface FotoFeed {
  id: string;
  url: string;
}

interface RdoFeedCardProps {
  data: string;
  clima: string | null;
  atividades: string | null;
  /** Só o modo interno passa isso — o card do portal nunca recebe ocorrências (spec 087). */
  ocorrencias?: string | null;
  fotos: FotoFeed[];
  /** "por: fulano" — só o modo interno mostra (precisa de created_by → profiles). */
  autor?: string | null;
  /** Conteúdo extra dentro do card (interno: impedimento/visita/tarefas resumidos). */
  extra?: React.ReactNode;
  /** Interno: clique abre o RDO pra editar. Sem onClick, o card não é clicável (portal). */
  onClick?: () => void;
  /** Esconde o traço da timeline abaixo do card — último item da lista. */
  ultimo?: boolean;
}

/**
 * Card visual de um dia do diário, tipo feed (spec 087) — timeline vertical
 * com um traço + marcador conectando os dias, no espírito do benchmark do
 * Obra Guru (mantendo os tokens de cor do design system, não a paleta escura
 * da referência: o resto do app é claro, criar um segundo tema só pra este
 * card seria inconsistência nova). Compartilhado entre a aba Diário interna
 * (todos os dados) e o portal do cliente (resumo curado) — a diferença de
 * conteúdo vem de QUAIS PROPS cada chamador passa, nunca de lógica de
 * esconder campo aqui dentro.
 */
export function RdoFeedCard({
  data,
  clima,
  atividades,
  ocorrencias,
  fotos,
  autor,
  extra,
  onClick,
  ultimo,
}: RdoFeedCardProps) {
  const Icone = clima ? (CLIMA_ICON[clima] ?? Cloud) : null;
  const resumo = resumoFeedRdo(atividades, ocorrencias ?? null);
  const fotosVisiveis = fotos.slice(0, 3);

  return (
    <div className="flex gap-3">
      {/* Trilho da timeline: marcador + traço até o próximo card. */}
      <div className="flex w-3 shrink-0 flex-col items-center">
        <span className="mt-4 h-2.5 w-2.5 shrink-0 rounded-full bg-info-mid ring-4 ring-white" />
        {!ultimo && <span className="w-px flex-1 bg-black/10" />}
      </div>

      <div
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") onClick();
              }
            : undefined
        }
        className={`mb-4 flex-1 overflow-hidden rounded-2xl border border-black/5 bg-white ${
          onClick ? "cursor-pointer transition-shadow hover:shadow-md" : ""
        }`}
      >
        <div className="space-y-2 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
              <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
              {formatDate(data)}
            </span>
            {Icone && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Icone className="h-3.5 w-3.5" />
                {climaLabel(clima)}
              </span>
            )}
          </div>
          <p className="whitespace-pre-wrap text-sm text-ink/90">{resumo}</p>
          {extra}
          {(autor || fotos.length > 0) && (
            <div className="flex items-center justify-between gap-2 border-t border-black/5 pt-2">
              {autor ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/20 text-[10px] font-semibold text-ink">
                    {autor.charAt(0).toUpperCase()}
                  </span>
                  Por {autor}
                </span>
              ) : (
                <span />
              )}
              {fotos.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <span className="flex -space-x-1.5">
                    {fotosVisiveis.map((f) => (
                      <img
                        key={f.id}
                        src={f.url}
                        alt=""
                        className="h-5 w-5 rounded-full border-2 border-white object-cover"
                      />
                    ))}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{fotos.length}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
