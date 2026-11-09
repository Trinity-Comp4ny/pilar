import { useState } from "react";
import {
  ChevronDown,
  FolderKanban,
  Handshake,
  ListChecks,
  Lock,
  Pencil,
  Target,
  Trash2,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useMetaHistorico } from "@/hooks/useMetas";
import {
  INDICADOR_POR_CHAVE,
  RECORRENCIAS,
  formatarValor,
  percentual,
  rotuloDaMeta,
  rotuloJanela,
  type IndicadorGrupo,
  type MetaView,
  type RotuloUnidade,
} from "@/lib/metas";

interface MetaCardProps {
  view: MetaView;
  onEdit: () => void;
  onDelete: () => void;
}

const ICONE_POR_GRUPO: Record<IndicadorGrupo, LucideIcon> = {
  Financeiro: Wallet,
  Projetos: FolderKanban,
  Entregas: ListChecks,
  Comercial: Handshake,
};

/** "Projetos concluídos · Todo mês" ou "Manual · até 31/12/2027". */
const subtituloDaMeta = (view: MetaView): string => {
  const { meta } = view;
  const def = meta.indicador ? INDICADOR_POR_CHAVE[meta.indicador] : undefined;
  const periodo = def?.pontual
    ? "hoje"
    : meta.recorrencia !== "nenhuma"
      ? (RECORRENCIAS.find((r) => r.value === meta.recorrencia)?.label ?? "")
      : rotuloJanela("nenhuma", meta.periodo_inicio, meta.prazo);
  return [def?.label ?? "Manual", periodo].filter(Boolean).join(" · ");
};

export function MetaCard({ view, onEdit, onDelete }: MetaCardProps) {
  const { meta, atual, restrito, percent } = view;
  const isCompleted = view.status === "concluida";
  const recorrente = meta.recorrencia !== "nenhuma" && !!meta.indicador;
  const rotulo = rotuloDaMeta(meta);
  const grupo = meta.indicador ? INDICADOR_POR_CHAVE[meta.indicador]?.grupo : undefined;
  // Meta manual não tem indicador: usa o alvo.
  const Icon = grupo ? ICONE_POR_GRUPO[grupo] : Target;

  return (
    <Card className={cn("border-2 transition-all", isCompleted && "border-status-done bg-positive/10")}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className={cn("p-2 rounded-lg", isCompleted ? "bg-positive/10" : "bg-muted")}>
            <Icon className={cn("h-5 w-5", isCompleted ? "text-positive-strong" : "text-ink-muted")} />
          </div>
          <div className="flex gap-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} aria-label="Editar meta">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-danger-mid hover:text-danger-strong"
              onClick={onDelete}
              aria-label="Excluir meta"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-snug line-clamp-2">{meta.nome}</p>
            <p className="text-xs text-muted-foreground truncate">{subtituloDaMeta(view)}</p>
          </div>
          {!restrito && (
            <span
              className={cn(
                "text-2xl font-bold tabular-nums leading-none shrink-0",
                isCompleted ? "text-positive-strong" : "text-foreground"
              )}
            >
              {percent}%
            </span>
          )}
        </div>

        <Progress value={restrito ? 0 : percent} className="h-1.5 bg-muted" indicatorClassName="bg-positive" />

        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Atual</p>
            {restrito ? (
              <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1">
                <Lock className="h-3 w-3" aria-hidden="true" />
                Sem acesso ao valor
              </p>
            ) : (
              <p className="text-sm font-semibold whitespace-nowrap">
                {formatarValor(atual ?? 0, meta.unidade, rotulo)}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground mb-0.5">{recorrente ? "Alvo por período" : "Alvo"}</p>
            <p className="text-sm font-semibold whitespace-nowrap">{formatarValor(meta.alvo, meta.unidade, rotulo)}</p>
          </div>
        </div>

        {recorrente && <Historico view={view} rotulo={rotulo} />}
      </CardContent>
    </Card>
  );
}

function Historico({ view, rotulo }: { view: MetaView; rotulo: RotuloUnidade | null }) {
  const [open, setOpen] = useState(false);
  const { meta } = view;
  const { data, isLoading, isError } = useMetaHistorico(meta.id, open);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-t pt-2">
      <CollapsibleTrigger className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground">
        <span>Período atual: {rotuloJanela(meta.recorrencia, view.janelaInicio, view.janelaFim)}</span>
        <span className="flex items-center gap-1">
          Histórico
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} aria-hidden="true" />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2 space-y-2">
        {isLoading && <p className="text-xs text-muted-foreground">Carregando histórico...</p>}
        {isError && <p className="text-xs text-danger-strong">Não foi possível carregar o histórico.</p>}
        {(data ?? []).map((p) => {
          const pct = percentual(p.atual, meta.alvo);
          return (
            <div key={p.janela_inicio} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  {rotuloJanela(meta.recorrencia, p.janela_inicio, p.janela_fim)}
                </span>
                <span className="font-medium tabular-nums">
                  {p.restrito ? "Sem acesso" : `${formatarValor(p.atual ?? 0, meta.unidade, rotulo)} (${pct}%)`}
                </span>
              </div>
              <Progress
                value={p.restrito ? 0 : pct}
                className="h-1 bg-muted"
                indicatorClassName={pct >= 100 ? "bg-positive" : "bg-brand"}
              />
            </div>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}
