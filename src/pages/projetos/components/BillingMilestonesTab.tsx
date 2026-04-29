import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Loader2, CheckCircle2, Clock, XCircle, Banknote } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrencyInput, parseCurrencyString, formatCurrency } from "@/lib/currencyUtils";

interface BillingMilestonesTabProps {
  projetoId: string;
  canEdit: boolean;
}

interface Marco {
  id: string;
  nome: string;
  disciplina: string | null;
  percentual: number | null;
  valor: number;
  data_prevista: string | null;
  data_faturada: string | null;
  status: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pendente: { label: "Pendente", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  faturado: { label: "Faturado", color: "bg-blue-100 text-blue-800", icon: CheckCircle2 },
  recebido: { label: "Recebido", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-800", icon: XCircle },
};

export function BillingMilestonesTab({ projetoId, canEdit }: BillingMilestonesTabProps) {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formNome, setFormNome] = useState("");
  const [formValor, setFormValor] = useState("");
  const [formData, setFormData] = useState("");
  const [formPercentual, setFormPercentual] = useState("");

  const { data: marcos = [], isLoading } = useQuery({
    queryKey: ["marcos-faturamento", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marcos_faturamento")
        .select("*")
        .eq("projeto_id", projetoId)
        .is("deleted_at", null)
        .order("data_prevista", { ascending: true });
      if (error) throw error;
      return (data || []) as Marco[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const valor = parseCurrencyString(formValor);
      if (!formNome.trim() || !valor) throw new Error("Nome e valor são obrigatórios");
      const { error } = await supabase.from("marcos_faturamento").insert({
        projeto_id: projetoId,
        nome: formNome.trim(),
        valor,
        data_prevista: formData || null,
        percentual: parseFloat(formPercentual) || null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marcos-faturamento", projetoId] });
      toast.success("Marco criado");
      setIsFormOpen(false);
      setFormNome("");
      setFormValor("");
      setFormData("");
      setFormPercentual("");
    },
    onError: () => toast.error("Erro"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updateData: Record<string, string> = { status };
      if (status === "faturado") updateData.data_faturada = new Date().toISOString().split("T")[0];
      const { error } = await supabase.from("marcos_faturamento").update(updateData).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marcos-faturamento", projetoId] });
      toast.success("Status atualizado");
    },
  });

  const faturarMarcoMutation = useMutation({
    mutationFn: async (marcoId: string) => {
      const { data, error } = await supabase.rpc("rpc_faturar_marco", { p_marco_id: marcoId });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marcos-faturamento", projetoId] });
      queryClient.invalidateQueries({ queryKey: ["receitas"] });
      toast.success("Marco faturado!", { description: "Receita criada automaticamente." });
    },
    onError: () => toast.error("Erro ao faturar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marcos_faturamento").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marcos-faturamento", projetoId] });
      toast.success("Marco removido");
    },
  });

  const gerarParcelasMutation = useMutation({
    mutationFn: async ({ numParcelas, intervaloDias }: { numParcelas: number; intervaloDias: number }) => {
      const { data, error } = await supabase.rpc("rpc_gerar_parcelas_projeto", {
        p_projeto_id: projetoId,
        p_num_parcelas: numParcelas,
        p_intervalo_dias: intervaloDias,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count) => {
      toast.success(`${count} parcela(s) gerada(s) como receitas`);
    },
    onError: () => toast.error("Erro"),
  });

  const formatDate = (d: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—");

  const totalMarcos = marcos.reduce((s, m) => s + m.valor, 0);
  const totalFaturado = marcos
    .filter((m) => m.status === "faturado" || m.status === "recebido")
    .reduce((s, m) => s + m.valor, 0);
  const totalRecebido = marcos.filter((m) => m.status === "recebido").reduce((s, m) => s + m.valor, 0);

  if (isLoading)
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );

  return (
    <Card>
      <CardContent className="p-4">
        {/* Resumo */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 text-sm">
            <Badge variant="secondary">Total: {formatCurrency(totalMarcos)}</Badge>
            <Badge className="bg-blue-100 text-blue-800">Faturado: {formatCurrency(totalFaturado)}</Badge>
            <Badge className="bg-green-100 text-green-800">Recebido: {formatCurrency(totalRecebido)}</Badge>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => gerarParcelasMutation.mutate({ numParcelas: 3, intervaloDias: 30 })}
                disabled={gerarParcelasMutation.isPending}
              >
                <Banknote className="h-3.5 w-3.5 mr-1" /> Gerar Parcelas
              </Button>
              <Button size="sm" onClick={() => setIsFormOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Novo Marco
              </Button>
            </div>
          )}
        </div>

        {marcos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum marco de faturamento definido.</p>
        ) : (
          <div className="space-y-3">
            {marcos.map((marco) => {
              const config = STATUS_CONFIG[marco.status] || STATUS_CONFIG.pendente;
              const Icon = config.icon;
              return (
                <div key={marco.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className={`p-1.5 rounded ${config.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{marco.nome}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Previsão: {formatDate(marco.data_prevista)}</span>
                      {marco.data_faturada && <span>· Faturado: {formatDate(marco.data_faturada)}</span>}
                      {marco.percentual && <span>· {marco.percentual}%</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{formatCurrency(marco.valor)}</p>
                    <Badge className={`text-[10px] ${config.color}`}>{config.label}</Badge>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1 ml-2">
                      {marco.status === "pendente" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-blue-600"
                          title="Faturar (cria receita)"
                          disabled={faturarMarcoMutation.isPending}
                          onClick={() => faturarMarcoMutation.mutate(marco.id)}
                        >
                          <Banknote className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {marco.status === "faturado" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-green-600"
                          onClick={() => updateStatusMutation.mutate({ id: marco.id, status: "recebido" })}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500"
                        onClick={() => deleteMutation.mutate(marco.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Dialog de criação */}
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Novo Marco de Faturamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <div className="space-y-1">
                <Label className="text-xs">Nome *</Label>
                <Input
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  placeholder="Ex: Entrega Projeto Legal"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Valor *</Label>
                  <Input
                    value={formValor}
                    onChange={(e) => setFormValor(formatCurrencyInput(e.target.value))}
                    placeholder="R$ 0,00"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">% do Contrato</Label>
                  <Input
                    type="number"
                    value={formPercentual}
                    onChange={(e) => setFormPercentual(e.target.value)}
                    placeholder="25"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data Prevista</Label>
                <Input type="date" value={formData} onChange={(e) => setFormData(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setIsFormOpen(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                  Criar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
