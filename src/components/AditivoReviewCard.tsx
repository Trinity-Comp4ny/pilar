import { Sparkles, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { EscopoRow } from "@/hooks/useEscopos";

const STATUS_ATIVOS = ["rascunho", "pendente_aprovacao"];

interface AditivoReviewCardProps {
  escopo: EscopoRow;
  canEdit: boolean;
  onAprovar: () => void;
  onRejeitar: () => void;
  /** Nome do projeto (spec 084): só usado na visão cross-projeto de Pendências, ausente na aba Escopo (já dentro do projeto). */
  projetoNome?: string;
}

/**
 * Card de revisão de um aditivo (spec 081/083/084). Compartilhado entre a aba Escopo
 * de um projeto (onde `projetoNome` não faz sentido, já está óbvio pelo contexto) e a
 * aba Pendências de /agentes (cross-projeto, onde o nome do projeto é a única forma
 * de saber do que se trata sem clicar).
 */
export function AditivoReviewCard({ escopo, canEdit, onAprovar, onRejeitar, projetoNome }: AditivoReviewCardProps) {
  const isPendente = STATUS_ATIVOS.includes(escopo.status ?? "");
  const origemAgente = escopo.created_by === null;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            {projetoNome && <p className="text-xs font-medium text-muted-foreground">{projetoNome}</p>}
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground">{escopo.descricao}</p>
              <StatusBadge domain="escopo" status={escopo.status ?? "rascunho"} />
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {origemAgente ? (
                <>
                  <Sparkles className="h-3 w-3" /> Sugerido pelo agente
                </>
              ) : (
                <>
                  <User className="h-3 w-3" /> Criado manualmente
                </>
              )}
              {" · "}
              {formatDateTime(escopo.created_at ?? undefined)}
            </p>
          </div>
          <p className="whitespace-nowrap text-sm font-medium text-foreground">
            {formatCurrency(escopo.valor_aditivo ?? 0)}
          </p>
        </div>

        {escopo.justificativa && <p className="text-sm text-muted-foreground">{escopo.justificativa}</p>}

        {escopo.escopo_itens.length > 0 && (
          <ul className="space-y-1 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {escopo.escopo_itens.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2">
                <span>
                  {item.descricao}
                  {item.disciplina ? ` (${item.disciplina})` : ""}
                </span>
                <span className="whitespace-nowrap">{formatCurrency(item.custo ?? 0)}</span>
              </li>
            ))}
          </ul>
        )}

        {isPendente && canEdit && (
          <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
            <Button variant="ghost" size="sm" onClick={onRejeitar}>
              Rejeitar
            </Button>
            <Button variant="brand" size="sm" onClick={onAprovar}>
              Aprovar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
