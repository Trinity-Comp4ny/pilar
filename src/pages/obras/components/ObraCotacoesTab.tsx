import { useMemo, useState } from "react";
import { Pencil, Plus, Scale, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatCurrency, formatDate } from "@/lib/format";
import { menorValorProposta } from "@/lib/obras";
import { useObraFrentes } from "@/hooks/useObraFrentes";
import {
  useObraCotacoes,
  useDeleteCotacao,
  type CotacaoComPropostas,
  type CotacaoRow,
} from "@/hooks/useObraCotacoes";
import { CotacaoFormDialog } from "./CotacaoFormDialog";
import { CotacaoDetailDialog } from "./CotacaoDetailDialog";

export function ObraCotacoesTab({ obraId, canEdit }: { obraId: string; canEdit: boolean }) {
  const { data: cotacoes = [], isLoading } = useObraCotacoes(obraId);
  const { data: frentes = [] } = useObraFrentes(obraId);
  const del = useDeleteCotacao(obraId);

  const [form, setForm] = useState<{ cotacao?: CotacaoRow | null } | null>(null);
  const [detalhe, setDetalhe] = useState<CotacaoComPropostas | null>(null);
  const [confirmDel, setConfirmDel] = useState<CotacaoComPropostas | null>(null);

  const frenteNome = useMemo(() => new Map(frentes.map((f) => [f.id, f.nome])), [frentes]);

  // Mantém o detalhe aberto em sincronia com os dados após adicionar proposta/decidir.
  const detalheAtual = detalhe ? cotacoes.find((c) => c.id === detalhe.id) ?? detalhe : null;

  if (isLoading) return <Skeleton className="h-40 w-full rounded-2xl" />;

  return (
    <div className="space-y-4">
      {canEdit && cotacoes.length > 0 && (
        <div className="flex justify-end">
          <Button variant="brand" size="sm" onClick={() => setForm({})}>
            <Plus className="mr-1.5 h-4 w-4" />
            Nova cotação
          </Button>
        </div>
      )}

      {cotacoes.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="Nenhuma cotação ainda"
          description="Registre o que precisa cotar, junte os preços dos fornecedores e compare antes de decidir a compra."
          action={canEdit ? { label: "Nova cotação", onClick: () => setForm({}) } : undefined}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {cotacoes.map((c) => {
            const menor = menorValorProposta(c.propostas);
            const etapa = c.obra_frente_id ? frenteNome.get(c.obra_frente_id) : null;
            const qtd =
              c.quantidade != null ? `${c.quantidade}${c.unidade ? ` ${c.unidade}` : ""}` : null;
            return (
              <Card
                key={c.id}
                className="cursor-pointer rounded-2xl border border-black/5 bg-white transition-colors hover:border-black/10"
                onClick={() => setDetalhe(c)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{c.descricao}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {[qtd, etapa, c.prazo_necessidade && `até ${formatDate(c.prazo_necessidade)}`]
                          .filter(Boolean)
                          .join(" · ") || "Sem detalhes"}
                      </p>
                    </div>
                    <StatusBadge domain="cotacao" status={c.status} />
                  </div>

                  <div className="mt-3 flex items-end justify-between">
                    <div className="text-xs text-muted-foreground">
                      {c.propostas.length === 0
                        ? "Sem propostas"
                        : `${c.propostas.length} ${c.propostas.length === 1 ? "proposta" : "propostas"}`}
                      {menor != null && (
                        <span className="ml-1.5 text-ink">· menor {formatCurrency(menor)}</span>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex shrink-0 gap-0.5" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setForm({ cotacao: c })}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setConfirmDel(c)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {form && (
        <CotacaoFormDialog
          open
          onOpenChange={(v) => !v && setForm(null)}
          obraId={obraId}
          cotacao={form.cotacao}
        />
      )}

      {detalheAtual && (
        <CotacaoDetailDialog
          open
          onOpenChange={(v) => !v && setDetalhe(null)}
          obraId={obraId}
          cotacao={detalheAtual}
          canEdit={canEdit}
        />
      )}

      <ConfirmDialog
        open={!!confirmDel}
        onOpenChange={(v) => !v && setConfirmDel(null)}
        onConfirm={async () => {
          if (!confirmDel) return;
          await del.mutateAsync(confirmDel.id);
          setConfirmDel(null);
        }}
        title="Excluir cotação?"
        itemName={confirmDel?.descricao}
        description="A cotação e suas propostas saem da obra. Despesas já lançadas na conta não são afetadas."
        variant="destructive"
        confirmText="Excluir"
        loading={del.isPending}
      />
    </div>
  );
}
