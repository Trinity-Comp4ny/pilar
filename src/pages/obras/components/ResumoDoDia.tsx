import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ResumoDia } from "@/pages/obras/lib/resumoDia";

/**
 * Resumo do dia em rascunho (SPEC 135, fase B): o que os registros prontos do dia somam e o
 * caminho para fechar o RDO. Apresentação pura; quem monta o resumo é `resumirDia`.
 */

const MAX_ITENS = 3;

function Linha({ rotulo, itens }: { rotulo: string; itens: string[] }) {
  if (itens.length === 0) return null;
  const visiveis = itens.slice(0, MAX_ITENS);
  const resto = itens.length - visiveis.length;
  return (
    <p className="text-sm text-ink-soft">
      <span className="font-medium text-ink">{rotulo}: </span>
      {visiveis.join("; ")}
      {resto > 0 && <span className="text-muted-foreground"> e mais {resto}</span>}
    </p>
  );
}

export function ResumoDoDia({
  resumo,
  canEdit,
  onFechar,
}: {
  resumo: ResumoDia;
  canEdit: boolean;
  onFechar: () => void;
}) {
  const todosFechados = resumo.fechados > 0 && resumo.pendentes === 0 && resumo.fechados >= resumo.prontos;
  const efetivo =
    resumo.efetivoTotal === null
      ? []
      : [
          `${resumo.efetivoTotal} ${resumo.efetivoTotal === 1 ? "pessoa" : "pessoas"}` +
            (resumo.equipes.length > 0
              ? ` (${resumo.equipes.map((e) => `${e.nome} ${e.quantidade}`).join(", ")})`
              : ""),
        ];
  const vazio = resumo.prontos === 0;

  return (
    <div className="space-y-2 rounded-2xl border border-border/60 bg-white p-4 shadow-card" aria-label="Resumo do dia">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-ink">Resumo do dia</h4>
          <p className="text-xs text-muted-foreground">
            {vazio
              ? "Os registros ainda estão sendo organizados."
              : `Montado a partir de ${resumo.prontos} ${resumo.prontos === 1 ? "registro" : "registros"}.`}
            {resumo.pendentes > 0 && ` ${resumo.pendentes} em organização.`}
          </p>
        </div>
        {canEdit && (
          <Button size="sm" variant={todosFechados ? "outline" : "brand"} onClick={onFechar} className="shrink-0">
            <ClipboardCheck className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {todosFechados ? "Abrir o RDO" : "Revisar e fechar o RDO"}
          </Button>
        )}
      </div>

      <Linha rotulo="Efetivo" itens={efetivo} />
      <Linha rotulo="Avançou" itens={resumo.avancos} />
      <Linha rotulo="Ocorrências" itens={resumo.ocorrencias} />
      <Linha rotulo="Faltou" itens={resumo.materiaisFaltando} />
      <Linha rotulo="Pendências" itens={resumo.pendencias} />
    </div>
  );
}
