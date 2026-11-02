import { NavLink } from "react-router-dom";
import { ArrowUpRight, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Pendencia, PendenciaArea, PendenciaSeveridade } from "./hooks/useAgentePendencias";
import { AREAS, diasDesde, ehPronta, num, plural, txt } from "./lib/pendencias";

const DOT: Record<PendenciaSeveridade, string> = {
  critical: "bg-danger-strong",
  high: "bg-attention-strong",
  medium: "bg-warning-mid",
  low: "bg-muted-foreground",
};

const SEVERIDADE_LABEL: Record<PendenciaSeveridade, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

const AREA_VARIANT: Record<PendenciaArea, "brand" | "info" | "warning" | "attention" | "neutral" | "highlight"> = {
  financeiro: "brand",
  prazos: "info",
  orcamento: "warning",
  obra: "attention",
  planejamento: "neutral",
  comercial: "highlight",
};

const DIAS_ADIAR = [1, 3, 7, 30];

type Fato = { texto: string; tom?: "perigo" | "aviso" };

/** Fatos da regra viram etiquetas curtas. Tudo vem de `dados`, que o código do banco preenche. */
function fatosDe(p: Pendencia): Fato[] {
  const d = p.dados;
  const fatos: Fato[] = [];
  const valor = num(d.valor);
  if (valor !== null) fatos.push({ texto: formatCurrency(valor) });

  const atraso = num(d.dias_atraso) ?? (p.acao_sugerida === "enviar_cobranca" ? (num(d.dias) ?? 0) : 0);
  const paraVencer = num(d.dias_para_vencer);
  if (atraso > 0) fatos.push({ texto: `${plural(atraso, "dia", "dias")} de atraso`, tom: "perigo" });
  else if (paraVencer !== null) fatos.push({ texto: `Vence em ${plural(paraVencer, "dia", "dias")}`, tom: "aviso" });

  const etapa = num(d.etapa);
  const total = num(d.etapa_total);
  if (etapa !== null && total !== null) fatos.push({ texto: `Etapa ${etapa} de ${total}` });

  const aberto = diasDesde(p.primeira_deteccao);
  if (aberto >= 2) fatos.push({ texto: `Em aberto há ${plural(aberto, "dia", "dias")}`, tom: "aviso" });
  return fatos;
}

interface PendenciaCardProps {
  pendencia: Pendencia;
  onRevisar?: (p: Pendencia) => void;
  onAdiar: (p: Pendencia, dias: number) => void;
  onDispensar: (p: Pendencia) => void;
}

/** Item da fila de pendências (SPEC 146): o que é, por que importa e a ação que resolve. */
export function PendenciaCard({ pendencia: p, onRevisar, onAdiar, onDispensar }: PendenciaCardProps) {
  const pronta = ehPronta(p);
  const area = AREAS.find((a) => a.key === p.area)?.label ?? p.area;
  const preparado = txt(p.dados.destinatario);

  return (
    <Card className={cn(pronta && "border-brand")}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <span
            role="img"
            aria-label={`Urgência ${SEVERIDADE_LABEL[p.severidade].toLowerCase()}`}
            className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", DOT[p.severidade])}
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant={AREA_VARIANT[p.area]}>{area}</Badge>
              <h3 className="text-sm font-semibold text-foreground">{p.titulo}</h3>
              {pronta && <Badge variant="secondary">Rascunho do agente</Badge>}
            </div>
            {p.detalhe && <p className="text-sm text-ink-soft">{p.detalhe}</p>}
            <div className="flex flex-wrap gap-1.5">
              {fatosDe(p).map((f) => (
                <span
                  key={f.texto}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-xs",
                    f.tom === "perigo" && "bg-danger-soft text-danger-strong",
                    f.tom === "aviso" && "bg-warning-soft text-warning-strong",
                    !f.tom && "bg-muted text-ink-soft"
                  )}
                >
                  {f.texto}
                </span>
              ))}
            </div>
            {pronta && preparado && (
              <p className="rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-ink-soft">
                <span className="font-medium text-foreground">Preparei:</span> e-mail para {preparado}, no tom da etapa,
                com os dados da parcela.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {pronta ? (
            <Button variant="brand" size="sm" onClick={() => onRevisar?.(p)}>
              Revisar e enviar
            </Button>
          ) : (
            p.link && (
              <Button variant="outline" size="sm" asChild>
                <NavLink to={p.link}>
                  Abrir <ArrowUpRight className="ml-1 h-3 w-3" />
                </NavLink>
              </Button>
            )
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Adiar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {DIAS_ADIAR.map((dias) => (
                <DropdownMenuItem key={dias} onClick={() => onAdiar(p, dias)}>
                  Por {plural(dias, "dia", "dias")}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onDispensar(p)}>Dispensar</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
