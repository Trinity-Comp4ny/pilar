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
  /** "por: fulano" — só o modo interno mostra. */
  rodape?: string | null;
  /** Conteúdo extra dentro do card (interno: impedimento/visita/tarefas resumidos). */
  extra?: React.ReactNode;
  /** Interno: clique abre o RDO pra editar. Sem onClick, o card não é clicável (portal). */
  onClick?: () => void;
}

/**
 * Card visual de um dia do diário, tipo feed (spec 087). Componente
 * compartilhado entre a aba Diário interna (todos os dados) e o portal do
 * cliente (resumo curado) — a diferença de conteúdo vem de QUAIS PROPS cada
 * chamador passa, nunca de lógica de esconder campo aqui dentro.
 */
export function RdoFeedCard({ data, clima, atividades, ocorrencias, fotos, rodape, extra, onClick }: RdoFeedCardProps) {
  const Icone = clima ? (CLIMA_ICON[clima] ?? Cloud) : null;
  const resumo = resumoFeedRdo(atividades, ocorrencias ?? null);

  return (
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
      className={`overflow-hidden rounded-2xl border border-black/5 bg-white ${onClick ? "cursor-pointer transition-shadow hover:shadow-md" : ""}`}
    >
      {fotos.length > 0 && (
        <div className={`grid gap-0.5 ${fotos.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {fotos.slice(0, 4).map((f, i) => (
            <div key={f.id} className={`relative bg-muted ${fotos.length === 1 ? "aspect-video" : "aspect-square"}`}>
              <img src={f.url} alt="Foto da obra" className="h-full w-full object-cover" />
              {i === 3 && fotos.length > 4 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-medium text-white">
                  +{fotos.length - 4}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink">
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
        {rodape && <p className="text-[11px] text-muted-foreground">Por {rodape}</p>}
      </div>
    </div>
  );
}
