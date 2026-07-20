import { toast } from "sonner";
import { Inbox, Check, X, Loader2, FileText, Clock } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/currencyUtils";
import {
  useAgentInbox,
  useAprovarOrcamento,
  useRejeitarRun,
  type AgentRun,
  type OrcamentoResult,
} from "./useAgentRuns";

const AGENT_LABEL: Record<string, string> = {
  orcamento_honorarios: "Orçamento de Honorários",
};

function parseOrcamento(run: AgentRun): OrcamentoResult | null {
  const result = run.result as unknown as OrcamentoResult | null;
  if (!result || !Array.isArray(result.fases)) return null;
  return result;
}

function OrcamentoCard({ run }: { run: AgentRun }) {
  const aprovar = useAprovarOrcamento();
  const rejeitar = useRejeitarRun();
  const orcamento = parseOrcamento(run);

  if (!orcamento) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Draft em formato não reconhecido (run {run.id.slice(0, 8)}).
        </CardContent>
      </Card>
    );
  }

  const semProjeto = !run.entity_id;
  const totalVenda = orcamento.fases.reduce(
    (sum, f) => sum + Math.round(f.horas_estimadas * f.custo_hora * (1 + f.margem_alvo_pct / 100) * 100) / 100,
    0
  );

  const handleAprovar = () => {
    aprovar.mutate(run.id, {
      onSuccess: () => toast.success("Orçamento aprovado", { description: "As fases foram criadas no projeto." }),
      onError: (e) => toast.error("Erro ao aprovar", { description: e instanceof Error ? e.message : undefined }),
    });
  };

  const handleRejeitar = () => {
    rejeitar.mutate(run.id, {
      onSuccess: () => toast.info("Draft rejeitado"),
      onError: (e) => toast.error("Erro ao rejeitar", { description: e instanceof Error ? e.message : undefined }),
    });
  };

  const loading = aprovar.isPending || rejeitar.isPending;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-foreground" />
              {AGENT_LABEL[run.agent_type] ?? run.agent_type}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{orcamento.resumo}</p>
          </div>
          <Badge variant="secondary" className="shrink-0 gap-1">
            <Clock className="h-3 w-3" /> Aguardando revisão
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Disciplina</TableHead>
              <TableHead className="text-right">Horas</TableHead>
              <TableHead className="text-right">Custo/h</TableHead>
              <TableHead className="text-right">Margem</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orcamento.fases.map((f, i) => {
              const valor = Math.round(f.horas_estimadas * f.custo_hora * (1 + f.margem_alvo_pct / 100) * 100) / 100;
              return (
                <TableRow key={i}>
                  <TableCell className="font-medium">{f.disciplina}</TableCell>
                  <TableCell className="text-right">{f.horas_estimadas}h</TableCell>
                  <TableCell className="text-right">{formatCurrency(f.custo_hora)}</TableCell>
                  <TableCell className="text-right">{f.margem_alvo_pct}%</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(valor)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total estimado</span>
          <span className="font-semibold text-base">{formatCurrency(totalVenda)}</span>
        </div>

        {orcamento.perguntas_faltantes && orcamento.perguntas_faltantes.length > 0 && (
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            <p className="font-medium mb-1">Perguntas para refinar:</p>
            <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
              {orcamento.perguntas_faltantes.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </div>
        )}

        {semProjeto && (
          <p className="text-sm text-amber-600">
            Este draft não está associado a um projeto — associe um projeto antes de aprovar.
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <Button onClick={handleAprovar} disabled={loading || semProjeto} className="gap-2">
            {aprovar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Aprovar
          </Button>
          <Button onClick={handleRejeitar} disabled={loading} variant="ghost" className="gap-2">
            {rejeitar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
            Rejeitar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RevisaoIA() {
  const { data: runs, isLoading } = useAgentInbox();

  return (
    <PageLayout
      header={
        <PageHeader title="Revisão da IA" description="Trabalho gerado por agentes, aguardando sua aprovação" />
      }
    >
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : !runs || runs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium">Nenhum item para revisar</p>
            <p className="text-sm text-muted-foreground mt-1">
              Quando um agente gerar um orçamento, ele aparecerá aqui para sua aprovação.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {runs.map((run) => (
            <OrcamentoCard key={run.id} run={run} />
          ))}
        </div>
      )}
    </PageLayout>
  );
}
