import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Loader2, FileText, CheckCircle2, XCircle, Clock, ChevronDown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/currencyUtils";

interface EscopoTabProps {
  projetoId: string;
  canEdit: boolean;
}

interface Escopo {
  id: string;
  descricao: string;
  tipo: "original" | "aditivo";
  status: string;
  horas_estimadas: number;
  custo_estimado: number;
  impacto_prazo_dias: number;
  valor_aditivo: number;
  justificativa: string | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
  created_at: string;
}

interface EscopoItem {
  id: string;
  descricao: string;
  disciplina: string | null;
  horas: number;
  custo: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  rascunho: { label: "Rascunho", color: "bg-gray-100 text-gray-800", icon: FileText },
  pendente_aprovacao: { label: "Pendente", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  aprovado: { label: "Aprovado", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  rejeitado: { label: "Rejeitado", color: "bg-red-100 text-red-800", icon: XCircle },
};

export function EscopoTab({ projetoId, canEdit }: EscopoTabProps) {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [formTipo, setFormTipo] = useState<"original" | "aditivo">("aditivo");
  const [formDescricao, setFormDescricao] = useState("");
  const [formJustificativa, setFormJustificativa] = useState("");
  const [formItens, setFormItens] = useState<
    Array<{ descricao: string; disciplina: string; horas: number; custo: number }>
  >([]);

  const { data: escopos = [], isLoading } = useQuery({
    queryKey: ["escopos", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("escopos")
        .select("*")
        .eq("projeto_id", projetoId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as Escopo[];
    },
  });

  const { data: itensMap = {} } = useQuery({
    queryKey: ["escopo-itens", projetoId],
    queryFn: async () => {
      const escopoIds = escopos.map((e) => e.id);
      if (escopoIds.length === 0) return {};
      const { data, error } = await supabase.from("escopo_itens").select("*").in("escopo_id", escopoIds);
      if (error) throw error;
      const map: Record<string, EscopoItem[]> = {};
      (data || []).forEach((item) => {
        if (!map[item.escopo_id]) map[item.escopo_id] = [];
        map[item.escopo_id].push(item);
      });
      return map;
    },
    enabled: escopos.length > 0,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!formDescricao.trim()) throw new Error("Descrição é obrigatória");

      const totalHoras = formItens.reduce((s, i) => s + i.horas, 0);
      const totalCusto = formItens.reduce((s, i) => s + i.custo, 0);

      const { data: escopo, error } = await supabase
        .from("escopos")
        .insert({
          projeto_id: projetoId,
          descricao: formDescricao.trim(),
          tipo: formTipo,
          status: formTipo === "original" ? "aprovado" : "rascunho",
          horas_estimadas: totalHoras,
          custo_estimado: totalCusto,
          valor_aditivo: totalCusto * 1.3, // 30% de margem sugerida
          justificativa: formJustificativa.trim() || null,
        })
        .select()
        .single();
      if (error) throw error;

      // Insere itens
      if (formItens.length > 0) {
        const { error: itensError } = await supabase.from("escopo_itens").insert(
          formItens.map((item) => ({
            escopo_id: escopo.id,
            descricao: item.descricao,
            disciplina: item.disciplina || null,
            horas: item.horas,
            custo: item.custo,
          }))
        );
        if (itensError) throw itensError;
      }

      // Registra histórico
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase.from("escopo_historico").insert({
        escopo_id: escopo.id,
        acao: "criado",
        usuario_id: user?.id,
        usuario_nome: user?.email,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["escopos", projetoId] });
      queryClient.invalidateQueries({ queryKey: ["escopo-itens", projetoId] });
      toast.success(formTipo === "original" ? "Escopo original definido" : "Aditivo criado");
      resetForm();
    },
    onError: (err: Error) => toast.error("Erro"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const updateData: Record<string, string> = { status };
      if (status === "aprovado" || status === "rejeitado") {
        updateData.aprovado_por = user?.id;
        updateData.aprovado_em = new Date().toISOString();
      }
      const { error } = await supabase.from("escopos").update(updateData).eq("id", id);
      if (error) throw error;

      await supabase.from("escopo_historico").insert({
        escopo_id: id,
        acao: status === "aprovado" ? "aprovado" : status === "rejeitado" ? "rejeitado" : "enviado_aprovacao",
        usuario_id: user?.id,
        usuario_nome: user?.email,
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["escopos", projetoId] });
      // Quando aditivo é aprovado, o trigger atualiza orçamento e valor_contrato
      if (variables.status === "aprovado") {
        queryClient.invalidateQueries({ queryKey: ["projeto-orcamento"] });
        queryClient.invalidateQueries({ queryKey: ["projetos"] });
        queryClient.invalidateQueries({ queryKey: ["projeto-rentabilidade"] });
        toast.success("Aditivo aprovado!", { description: "Orçamento do projeto atualizado automaticamente." });
      } else {
        toast.success("Status atualizado");
      }
    },
  });

  const resetForm = () => {
    setIsFormOpen(false);
    setFormDescricao("");
    setFormJustificativa("");
    setFormItens([]);
    setFormTipo("aditivo");
  };

  const addItem = () => {
    setFormItens([...formItens, { descricao: "", disciplina: "", horas: 0, custo: 0 }]);
  };

  const updateItem = (index: number, field: keyof (typeof formItens)[number], value: string | number) => {
    const updated = [...formItens];
    (updated[index] as Record<string, string | number>)[field] = value;
    setFormItens(updated);
  };

  const removeItem = (index: number) => {
    setFormItens(formItens.filter((_, i) => i !== index));
  };

  const escopoOriginal = escopos.find((e) => e.tipo === "original");
  const aditivos = escopos.filter((e) => e.tipo === "aditivo");
  const totalAditivos = aditivos.filter((a) => a.status === "aprovado").reduce((s, a) => s + a.valor_aditivo, 0);

  if (isLoading)
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {escopoOriginal && <Badge variant="secondary">Escopo original definido</Badge>}
          <Badge variant="secondary">{aditivos.length} aditivo(s)</Badge>
          {totalAditivos > 0 && (
            <Badge className="bg-orange-100 text-orange-800">+ {formatCurrency(totalAditivos)} em aditivos</Badge>
          )}
        </div>
        {canEdit && (
          <div className="flex gap-2">
            {!escopoOriginal && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setFormTipo("original");
                  setIsFormOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Escopo Original
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => {
                setFormTipo("aditivo");
                setIsFormOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Novo Aditivo
            </Button>
          </div>
        )}
      </div>

      {/* Lista */}
      {escopos.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhum escopo definido ainda.</p>
          </CardContent>
        </Card>
      ) : (
        escopos.map((escopo) => {
          const config = STATUS_CONFIG[escopo.status] || STATUS_CONFIG.rascunho;
          const Icon = config.icon;
          const itens = itensMap[escopo.id] || [];
          const isExpanded = expandedId === escopo.id;

          return (
            <Card key={escopo.id}>
              <CardContent className="p-4">
                <div
                  className="flex items-start gap-3 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : escopo.id)}
                >
                  <div className={`p-1.5 rounded mt-0.5 ${config.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={escopo.tipo === "original" ? "default" : "secondary"} className="text-[10px]">
                        {escopo.tipo === "original" ? "Original" : "Aditivo"}
                      </Badge>
                      <Badge className={`text-[10px] ${config.color}`}>{config.label}</Badge>
                    </div>
                    <p className="text-sm mt-1">{escopo.descricao}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {escopo.horas_estimadas > 0 && <span>{escopo.horas_estimadas}h</span>}
                      {escopo.custo_estimado > 0 && <span>Custo: {formatCurrency(escopo.custo_estimado)}</span>}
                      {escopo.tipo === "aditivo" && escopo.valor_aditivo > 0 && (
                        <span className="font-medium text-orange-700">
                          Aditivo: {formatCurrency(escopo.valor_aditivo)}
                        </span>
                      )}
                      {escopo.impacto_prazo_dias > 0 && <span>+{escopo.impacto_prazo_dias} dias</span>}
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  />
                </div>

                {/* Expandido: itens + ações */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t">
                    {itens.length > 0 && (
                      <div className="space-y-1 mb-3">
                        {itens.map((item) => (
                          <div key={item.id} className="flex items-center gap-2 text-xs py-1">
                            <span className="flex-1">{item.descricao}</span>
                            {item.disciplina && (
                              <Badge variant="secondary" className="text-[10px]">
                                {item.disciplina}
                              </Badge>
                            )}
                            {item.horas > 0 && <span className="text-muted-foreground">{item.horas}h</span>}
                            {item.custo > 0 && (
                              <span className="text-muted-foreground">{formatCurrency(item.custo)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {escopo.justificativa && (
                      <p className="text-xs text-muted-foreground italic mb-3">{escopo.justificativa}</p>
                    )}
                    {canEdit && (
                      <div className="flex items-center gap-2">
                        {escopo.status === "rascunho" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            onClick={() => updateStatusMutation.mutate({ id: escopo.id, status: "pendente_aprovacao" })}
                          >
                            Enviar para Aprovação
                          </Button>
                        )}
                        {escopo.status === "pendente_aprovacao" && (
                          <>
                            <Button
                              size="sm"
                              className="text-xs h-7 bg-green-600 hover:bg-green-700"
                              onClick={() => updateStatusMutation.mutate({ id: escopo.id, status: "aprovado" })}
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="text-xs h-7"
                              onClick={() => updateStatusMutation.mutate({ id: escopo.id, status: "rejeitado" })}
                            >
                              <XCircle className="h-3 w-3 mr-1" /> Rejeitar
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Dialog de criação */}
      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{formTipo === "original" ? "Definir Escopo Original" : "Novo Aditivo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Textarea
                value={formDescricao}
                onChange={(e) => setFormDescricao(e.target.value)}
                rows={2}
                placeholder="Descreva o escopo ou a mudança solicitada..."
              />
            </div>

            {formTipo === "aditivo" && (
              <div className="space-y-2">
                <Label>Justificativa</Label>
                <Textarea
                  value={formJustificativa}
                  onChange={(e) => setFormJustificativa(e.target.value)}
                  rows={2}
                  placeholder="Por que este aditivo é necessário?"
                />
              </div>
            )}

            {/* Itens */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Itens do Escopo</Label>
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={addItem}>
                  <Plus className="h-3 w-3 mr-1" /> Item
                </Button>
              </div>
              {formItens.map((item, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <Input
                    className="flex-1 h-8 text-xs"
                    placeholder="Descrição"
                    value={item.descricao}
                    onChange={(e) => updateItem(i, "descricao", e.target.value)}
                  />
                  <Input
                    className="w-24 h-8 text-xs"
                    placeholder="Disciplina"
                    value={item.disciplina}
                    onChange={(e) => updateItem(i, "disciplina", e.target.value)}
                  />
                  <Input
                    className="w-16 h-8 text-xs"
                    type="number"
                    placeholder="Horas"
                    value={item.horas || ""}
                    onChange={(e) => updateItem(i, "horas", parseFloat(e.target.value) || 0)}
                  />
                  <Input
                    className="w-20 h-8 text-xs"
                    type="number"
                    placeholder="Custo"
                    value={item.custo || ""}
                    onChange={(e) => updateItem(i, "custo", parseFloat(e.target.value) || 0)}
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => removeItem(i)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {formItens.length > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  Total: {formItens.reduce((s, i) => s + i.horas, 0)}h ·{" "}
                  {formatCurrency(formItens.reduce((s, i) => s + i.custo, 0))}
                  {formTipo === "aditivo" && (
                    <span className="ml-2 font-medium text-orange-700">
                      Valor sugerido (30% margem): {formatCurrency(formItens.reduce((s, i) => s + i.custo, 0) * 1.3)}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                {formTipo === "original" ? "Definir Escopo" : "Criar Aditivo"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
