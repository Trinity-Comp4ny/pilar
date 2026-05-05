import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Save, Trash2, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { type DisciplinaResponsavel } from "@/types/projetos";
import { formatCurrency } from "@/lib/currencyUtils";

interface ProjectBudgetTabProps {
  projetoId: string;
  canEdit: boolean;
  disciplinas: DisciplinaResponsavel[];
}

interface OrcamentoFase {
  id: string;
  disciplina: string;
  horas_estimadas: number;
  custo_hora: number;
  custo_estimado: number;
  margem_alvo_pct: number;
  valor_venda: number;
}

export function ProjectBudgetTab({ projetoId, canEdit, disciplinas }: ProjectBudgetTabProps) {
  const queryClient = useQueryClient();

  const { data: orcamentos = [], isLoading } = useQuery({
    queryKey: ["orcamento-fases", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_orcamento_fases")
        .select("*")
        .eq("projeto_id", projetoId)
        .is("deleted_at", null)
        .order("disciplina");
      if (error) throw error;
      return (data || []) as OrcamentoFase[];
    },
  });

  const [editRow, setEditRow] = useState<Partial<OrcamentoFase> & { isNew?: boolean }>({});
  const [isEditing, setIsEditing] = useState(false);

  const upsertMutation = useMutation({
    mutationFn: async (row: {
      id?: string;
      disciplina: string;
      horas_estimadas: number;
      custo_hora: number;
      margem_alvo_pct: number;
      valor_venda: number;
    }) => {
      if (row.id) {
        const { error } = await supabase
          .from("projeto_orcamento_fases")
          .update({
            horas_estimadas: row.horas_estimadas,
            custo_hora: row.custo_hora,
            margem_alvo_pct: row.margem_alvo_pct,
            valor_venda: row.valor_venda,
          })
          .eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("projeto_orcamento_fases").insert({
          projeto_id: projetoId,
          disciplina: row.disciplina,
          horas_estimadas: row.horas_estimadas,
          custo_hora: row.custo_hora,
          margem_alvo_pct: row.margem_alvo_pct,
          valor_venda: row.valor_venda,
        } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orcamento-fases", projetoId] });
      toast.success("Orçamento salvo");
      setEditRow({});
      setIsEditing(false);
    },
    onError: () => toast.error("Erro"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projeto_orcamento_fases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orcamento-fases", projetoId] });
      toast.success("Linha removida");
    },
  });

  const handleSave = () => {
    if (!editRow.disciplina || !editRow.horas_estimadas) return;
    upsertMutation.mutate({
      id: editRow.isNew ? undefined : editRow.id,
      disciplina: editRow.disciplina!,
      horas_estimadas: editRow.horas_estimadas || 0,
      custo_hora: editRow.custo_hora || 0,
      margem_alvo_pct: editRow.margem_alvo_pct || 20,
      valor_venda: editRow.valor_venda || 0,
    });
  };

  const startEdit = (row: OrcamentoFase) => {
    setEditRow(row);
    setIsEditing(true);
  };

  const startNew = (disciplina: string) => {
    setEditRow({ disciplina, horas_estimadas: 0, custo_hora: 0, margem_alvo_pct: 20, valor_venda: 0, isNew: true });
    setIsEditing(true);
  };

  // Disciplinas sem orçamento
  const disciplinasSemOrcamento = disciplinas
    .map((d) => d.disciplina)
    .filter((d) => !orcamentos.some((o) => o.disciplina === d));

  const totalCusto = orcamentos.reduce((s, o) => s + (o.custo_estimado || 0), 0);
  const totalVenda = orcamentos.reduce((s, o) => s + (o.valor_venda || 0), 0);
  const totalHoras = orcamentos.reduce((s, o) => s + (o.horas_estimadas || 0), 0);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        {/* Resumo */}
        <div className="flex items-center gap-4 mb-4 text-sm">
          <Badge variant="secondary">{totalHoras}h orçadas</Badge>
          <Badge variant="secondary">Custo: {formatCurrency(totalCusto)}</Badge>
          <Badge variant="secondary">Venda: {formatCurrency(totalVenda)}</Badge>
          {totalVenda > 0 && (
            <Badge className={totalVenda - totalCusto > 0 ? "bg-positive/10 text-positive" : "bg-red-100 text-red-800"}>
              Margem: {(((totalVenda - totalCusto) / totalVenda) * 100).toFixed(1)}%
            </Badge>
          )}
        </div>

        {/* Tabela */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Disciplina</TableHead>
              <TableHead className="text-xs text-right">Horas Est.</TableHead>
              <TableHead className="text-xs text-right">Custo/h</TableHead>
              <TableHead className="text-xs text-right">Custo Total</TableHead>
              <TableHead className="text-xs text-right">Margem Alvo</TableHead>
              <TableHead className="text-xs text-right">Valor Venda</TableHead>
              {canEdit && <TableHead className="text-xs w-[80px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {orcamentos.map((o) => (
              <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50" onClick={() => canEdit && startEdit(o)}>
                <TableCell className="text-xs font-medium">{o.disciplina}</TableCell>
                <TableCell className="text-xs text-right">{o.horas_estimadas}h</TableCell>
                <TableCell className="text-xs text-right">{formatCurrency(o.custo_hora)}</TableCell>
                <TableCell className="text-xs text-right">{formatCurrency(o.custo_estimado)}</TableCell>
                <TableCell className="text-xs text-right">{o.margem_alvo_pct}%</TableCell>
                <TableCell className="text-xs text-right">{formatCurrency(o.valor_venda)}</TableCell>
                {canEdit && (
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate(o.id);
                      }}
                      aria-label="Excluir"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}

            {/* Linha de edição */}
            {isEditing && (
              <TableRow className="bg-blue-50/50">
                <TableCell className="text-xs font-medium">{editRow.disciplina}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    className="h-7 text-xs w-20 ml-auto"
                    value={editRow.horas_estimadas || ""}
                    onChange={(e) => setEditRow({ ...editRow, horas_estimadas: parseFloat(e.target.value) || 0 })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    className="h-7 text-xs w-20 ml-auto"
                    value={editRow.custo_hora || ""}
                    onChange={(e) => setEditRow({ ...editRow, custo_hora: parseFloat(e.target.value) || 0 })}
                  />
                </TableCell>
                <TableCell className="text-xs text-right">
                  {formatCurrency((editRow.horas_estimadas || 0) * (editRow.custo_hora || 0))}
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    className="h-7 text-xs w-16 ml-auto"
                    value={editRow.margem_alvo_pct || ""}
                    onChange={(e) => setEditRow({ ...editRow, margem_alvo_pct: parseFloat(e.target.value) || 0 })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    className="h-7 text-xs w-24 ml-auto"
                    value={editRow.valor_venda || ""}
                    onChange={(e) => setEditRow({ ...editRow, valor_venda: parseFloat(e.target.value) || 0 })}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="icon"
                    className="h-6 w-6"
                    onClick={handleSave}
                    disabled={upsertMutation.isPending}
                    aria-label="Salvar"
                  >
                    <Save className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Adicionar disciplinas sem orçamento */}
        {canEdit && disciplinasSemOrcamento.length > 0 && !isEditing && (
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground self-center">Adicionar:</span>
            {disciplinasSemOrcamento.map((d) => (
              <Button key={d} variant="outline" size="sm" className="text-xs h-7" onClick={() => startNew(d)}>
                <Plus className="h-3 w-3 mr-1" /> {d}
              </Button>
            ))}
          </div>
        )}

        {orcamentos.length === 0 && !isEditing && (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum orçamento definido. {canEdit ? "Clique nas disciplinas acima para adicionar." : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
