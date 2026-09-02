import { useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Boxes, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatDate, formatDecimal } from "@/lib/format";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import { saldoMaterial } from "@/lib/obras";
import { useObraFrentes } from "@/hooks/useObraFrentes";
import {
  useObraEstoque,
  useDeleteMaterial,
  useDeleteMovimento,
  type MaterialComMovimentos,
  type MovimentoRow,
} from "@/hooks/useObraEstoque";
import { MaterialMovDialog } from "./MaterialMovDialog";

type MovDialogState = { movInicial?: MovimentoRow | null; materialIdInicial?: string | null };

export function ObraEstoqueTab({ obraId, canEdit }: { obraId: string; canEdit: boolean }) {
  const formatCurrency = useMoneyMask();
  const { data: materiais = [], isLoading } = useObraEstoque(obraId);
  const { data: frentes = [] } = useObraFrentes(obraId);
  const delMaterial = useDeleteMaterial(obraId);
  const delMov = useDeleteMovimento(obraId);

  const [movDialog, setMovDialog] = useState<MovDialogState | null>(null);
  const [confirmDelMaterial, setConfirmDelMaterial] = useState<MaterialComMovimentos | null>(null);
  const [confirmDelMov, setConfirmDelMov] = useState<MovimentoRow | null>(null);

  const frenteNome = useMemo(() => new Map(frentes.map((f) => [f.id, f.nome])), [frentes]);

  // "Dinheiro do cliente parado no canteiro": soma dos saldos valorizados.
  const totalParado = useMemo(
    () => materiais.reduce((acc, m) => acc + (saldoMaterial(m.movimentos).valorParado ?? 0), 0),
    [materiais]
  );

  if (isLoading) return <Skeleton className="h-40 w-full rounded-2xl" />;

  return (
    <div className="space-y-4">
      {materiais.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Comprado ainda não aplicado</p>
            <p className="text-lg font-semibold text-ink">{formatCurrency(totalParado)}</p>
          </div>
          {canEdit && (
            <Button variant="brand" size="sm" onClick={() => setMovDialog({})}>
              <Plus className="mr-1.5 h-4 w-4" />
              Registrar movimento
            </Button>
          )}
        </div>
      )}

      {materiais.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="Nenhum material ainda"
          description="Registre o material que entrou (comprado) e o que foi aplicado na obra. O saldo mostra o que ainda está no canteiro."
          action={canEdit ? { label: "Registrar movimento", onClick: () => setMovDialog({}) } : undefined}
        />
      ) : (
        <div className="space-y-3">
          {materiais.map((m) => {
            const { comprado, aplicado, saldo, valorParado } = saldoMaterial(m.movimentos);
            return (
              <Card key={m.id} className="rounded-2xl border border-black/5 bg-white">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 font-medium text-ink">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{m.nome}</span>
                        {m.categoria && <span className="text-xs text-muted-foreground">· {m.categoria}</span>}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        <span>
                          Comprado {formatDecimal(comprado, 3)} {m.unidade}
                        </span>
                        <span>
                          Aplicado {formatDecimal(aplicado, 3)} {m.unidade}
                        </span>
                        <span className={saldo < 0 ? "text-danger-strong" : "text-ink"}>
                          Saldo {formatDecimal(saldo, 3)} {m.unidade}
                          {valorParado != null && saldo !== 0 && <> · {formatCurrency(valorParado)}</>}
                        </span>
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex shrink-0 gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Registrar movimento deste material"
                          onClick={() => setMovDialog({ materialIdInicial: m.id })}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Excluir material"
                          onClick={() => setConfirmDelMaterial(m)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {m.movimentos.length > 0 && (
                    <ul className="mt-3 divide-y divide-black/5 border-t border-black/5 pt-1">
                      {m.movimentos.map((mv) => {
                        const isEntrada = mv.tipo === "entrada";
                        return (
                          <li key={mv.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                            <span className="flex min-w-0 items-center gap-2">
                              {isEntrada ? (
                                <ArrowDownToLine className="h-3.5 w-3.5 shrink-0 text-positive" />
                              ) : (
                                <ArrowUpFromLine className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              )}
                              <span className="text-ink">
                                {isEntrada ? "Entrada" : "Baixa"} {formatDecimal(Number(mv.quantidade), 3)} {m.unidade}
                              </span>
                              <span className="truncate text-xs text-muted-foreground">
                                {formatDate(mv.data)}
                                {mv.obra_frente_id && ` · ${frenteNome.get(mv.obra_frente_id) ?? ""}`}
                                {isEntrada &&
                                  mv.valor_unitario != null &&
                                  ` · ${formatCurrency(Number(mv.valor_unitario))}/${m.unidade}`}
                              </span>
                            </span>
                            {canEdit && (
                              <span className="flex shrink-0 gap-0.5">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => setMovDialog({ movInicial: mv })}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => setConfirmDelMov(mv)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {movDialog && (
        <MaterialMovDialog
          open
          onOpenChange={(v) => !v && setMovDialog(null)}
          obraId={obraId}
          materiais={materiais}
          frentes={frentes}
          movInicial={movDialog.movInicial}
          materialIdInicial={movDialog.materialIdInicial}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelMaterial}
        onOpenChange={(v) => !v && setConfirmDelMaterial(null)}
        onConfirm={async () => {
          if (!confirmDelMaterial) return;
          await delMaterial.mutateAsync(confirmDelMaterial.id);
          setConfirmDelMaterial(null);
        }}
        title="Excluir material?"
        itemName={confirmDelMaterial?.nome}
        description="O material e seus movimentos saem do estoque. Despesas já lançadas na conta não são afetadas."
        variant="destructive"
        confirmText="Excluir"
        loading={delMaterial.isPending}
      />

      <ConfirmDialog
        open={!!confirmDelMov}
        onOpenChange={(v) => !v && setConfirmDelMov(null)}
        onConfirm={async () => {
          if (!confirmDelMov) return;
          await delMov.mutateAsync(confirmDelMov.id);
          setConfirmDelMov(null);
        }}
        title="Excluir movimento?"
        description="O movimento sai do estoque e o saldo é recalculado."
        variant="destructive"
        confirmText="Excluir"
        loading={delMov.isPending}
      />
    </div>
  );
}
