import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { addMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Receipt, Calendar, Milestone, PenLine } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

// ---------- tipos ----------

type Opcao = "parcelas" | "marcos" | "manual";

interface MarcoFaturamento {
  id: string;
  nome: string;
  valor: number;
  data_prevista: string | null;
  status: string | null;
  receita_id: string | null;
}

interface ParcelaPreview {
  numero: number;
  data: Date;
  valor: number;
}

export interface SmartInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
  projetoId: string;
  propostaValor: number;
  propostaNome: string;
}

// ---------- helpers ----------

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const buildParcelas = (valor: number, qtd: number, inicio: Date): ParcelaPreview[] =>
  Array.from({ length: qtd }, (_, i) => ({
    numero: i + 1,
    data: addMonths(inicio, i),
    valor: i < qtd - 1
      ? Math.round((valor / qtd) * 100) / 100
      : Math.round((valor - Math.round((valor / qtd) * 100) / 100 * (qtd - 1)) * 100) / 100,
  }));

// ---------- componente ----------

export function SmartInvoiceDialog({
  open,
  onClose,
  projetoId,
  propostaValor,
  propostaNome,
}: SmartInvoiceDialogProps) {
  const queryClient = useQueryClient();
  const [opcao, setOpcao] = useState<Opcao>("parcelas");
  const [qtdParcelas, setQtdParcelas] = useState(1);
  const [marcosChecked, setMarcosChecked] = useState<Set<string>>(new Set());

  // busca marcos existentes
  const { data: marcos = [], isLoading: loadingMarcos } = useQuery({
    queryKey: ["marcos-faturamento", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marcos_faturamento")
        .select("id, nome, valor, data_prevista, status")
        .eq("projeto_id", projetoId)
        .is("deleted_at", null)
        .order("data_prevista", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MarcoFaturamento[];
    },
    enabled: open,
    staleTime: 2 * 60 * 1000,
  });

  const parcelas = buildParcelas(propostaValor, qtdParcelas, new Date());

  // mutation: criar receitas
  const criar = useMutation({
    mutationFn: async () => {
      const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
      if (!empresaId) throw new Error("Usuário sem empresa");

      if (opcao === "parcelas") {
        const rows = parcelas.map((p) => ({
          descricao:
            qtdParcelas > 1
              ? `${propostaNome} (${p.numero}/${qtdParcelas})`
              : propostaNome,
          valor: p.valor,
          data_vencimento: format(p.data, "yyyy-MM-dd"),
          status: "Pendente",
          empresa_id: empresaId,
          projeto_id: projetoId,
          grupo_parcela: qtdParcelas > 1 ? crypto.randomUUID() : null,
          parcela_numero: qtdParcelas > 1 ? p.numero : null,
          parcela_total: qtdParcelas > 1 ? qtdParcelas : null,
        }));
        const { error } = await supabase.from("receitas").insert(rows as never);
        if (error) throw new Error(error.message);
      } else {
        // marcos selecionados
        const selecionados = marcos.filter((m) => marcosChecked.has(m.id));
        if (selecionados.length === 0) throw new Error("Selecione ao menos um marco");
        const rows = selecionados.map((m) => ({
          descricao: `${propostaNome} — ${m.nome}`,
          valor: m.valor,
          data_vencimento: m.data_prevista ?? format(new Date(), "yyyy-MM-dd"),
          status: "Pendente",
          empresa_id: empresaId,
          projeto_id: projetoId,
        }));
        const { data: inserted, error } = await supabase
          .from("receitas")
          .insert(rows as never)
          .select("id");
        if (error) throw new Error(error.message);

        // vincula receita_id em cada marco
        await Promise.all(
          selecionados.map((m, i) =>
            supabase
              .from("marcos_faturamento")
              .update({ receita_id: (inserted as Array<{ id: string }>)[i]?.id })
              .eq("id", m.id)
          )
        );
      }
    },
    onSuccess: async () => {
      toast.success("Faturas criadas com sucesso");
      await queryClient.invalidateQueries({ queryKey: ["finance-data"] });
      await queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
      await queryClient.invalidateQueries({ queryKey: ["marcos-faturamento", projetoId] });
      onClose();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao criar faturas"),
  });

  const handleConfirmar = () => criar.mutate();

  const toggleMarco = (id: string) =>
    setMarcosChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-blue-600" />
            Gerar Faturas
          </DialogTitle>
          <DialogDescription>
            Deseja gerar as faturas automaticamente para o projeto <strong>{propostaNome}</strong>?
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={opcao}
          onValueChange={(v) => setOpcao(v as Opcao)}
          className="space-y-2"
        >
          {/* Opção 1: parcelas */}
          <label
            htmlFor="opt-parcelas"
            className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
              opcao === "parcelas" ? "border-blue-500 bg-blue-50" : "border-border hover:bg-muted/50"
            }`}
          >
            <RadioGroupItem value="parcelas" id="opt-parcelas" className="mt-0.5" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Parcelas mensais</span>
              </div>

              {opcao === "parcelas" && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="qtd-parcelas" className="text-xs whitespace-nowrap">
                      Quantidade de parcelas
                    </Label>
                    <Input
                      id="qtd-parcelas"
                      type="number"
                      min={1}
                      max={60}
                      value={qtdParcelas}
                      onChange={(e) => setQtdParcelas(Math.max(1, parseInt(e.target.value) || 1))}
                      className="h-8 w-20 text-sm"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  {/* Preview parcelas */}
                  {parcelas.length > 0 && (
                    <div className="rounded-md border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="text-xs h-8 py-0">#</TableHead>
                            <TableHead className="text-xs h-8 py-0">Vencimento</TableHead>
                            <TableHead className="text-xs h-8 py-0 text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {parcelas.map((p) => (
                            <TableRow key={p.numero} className="text-xs">
                              <TableCell className="py-1.5">{p.numero}</TableCell>
                              <TableCell className="py-1.5">
                                {format(p.data, "dd/MM/yyyy", { locale: ptBR })}
                              </TableCell>
                              <TableCell className="py-1.5 text-right font-medium">
                                {formatBRL(p.valor)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </label>

          {/* Opção 2: marcos */}
          <label
            htmlFor="opt-marcos"
            className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
              opcao === "marcos" ? "border-blue-500 bg-blue-50" : "border-border hover:bg-muted/50"
            }`}
          >
            <RadioGroupItem value="marcos" id="opt-marcos" className="mt-0.5" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Milestone className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Por marcos do projeto</span>
              </div>

              {opcao === "marcos" && (
                <div className="pt-1">
                  {loadingMarcos ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-9 w-full" />
                      ))}
                    </div>
                  ) : marcos.length === 0 ? (
                    <p className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded p-2">
                      Nenhum marco cadastrado neste projeto. Cadastre marcos na aba "Faturamento" antes de usar esta opção.
                    </p>
                  ) : (
                    <div className="rounded-md border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="text-xs h-8 py-0 w-8"></TableHead>
                            <TableHead className="text-xs h-8 py-0">Marco</TableHead>
                            <TableHead className="text-xs h-8 py-0">Data prev.</TableHead>
                            <TableHead className="text-xs h-8 py-0 text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {marcos.map((m) => (
                            <TableRow
                              key={m.id}
                              className="text-xs cursor-pointer"
                              onClick={() => toggleMarco(m.id)}
                            >
                              <TableCell className="py-1.5">
                                <Checkbox
                                  checked={marcosChecked.has(m.id)}
                                  onCheckedChange={() => toggleMarco(m.id)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </TableCell>
                              <TableCell className="py-1.5">
                                <div className="flex items-center gap-1.5">
                                  {m.nome}
                                  {m.receita_id && (
                                    <Badge variant="secondary" className="text-[10px] py-0">
                                      Vinculado
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="py-1.5 text-muted-foreground">
                                {m.data_prevista
                                  ? format(new Date(m.data_prevista + "T00:00:00"), "dd/MM/yyyy")
                                  : "—"}
                              </TableCell>
                              <TableCell className="py-1.5 text-right font-medium">
                                {formatBRL(m.valor)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </label>

          {/* Opção 3: manual */}
          <label
            htmlFor="opt-manual"
            className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
              opcao === "manual" ? "border-border bg-muted/50" : "border-border hover:bg-muted/50"
            }`}
          >
            <RadioGroupItem value="manual" id="opt-manual" />
            <div className="flex items-center gap-2">
              <PenLine className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Vou criar manualmente</span>
            </div>
          </label>
        </RadioGroup>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={criar.isPending}>
            Cancelar
          </Button>

          {opcao === "manual" ? (
            <Button onClick={onClose}>Fechar</Button>
          ) : (
            <Button
              onClick={handleConfirmar}
              disabled={criar.isPending || (opcao === "marcos" && marcosChecked.size === 0)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {criar.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                `Confirmar ${opcao === "parcelas" ? `(${qtdParcelas} parcela${qtdParcelas !== 1 ? "s" : ""})` : `(${marcosChecked.size} marco${marcosChecked.size !== 1 ? "s" : ""})`}`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
