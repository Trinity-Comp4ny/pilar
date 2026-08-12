import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Loader2, Plus, Zap } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrencyInput, parseCurrencyString } from "@/lib/currencyUtils";

// ---------- schema ----------

const quickSchema = z.object({
  descricao: z.string().min(1, "Descrição obrigatória"),
  valor: z.string().min(1, "Valor obrigatório").refine(
    (v) => parseCurrencyString(v) > 0,
    "Valor deve ser maior que zero"
  ),
  data: z.date({ required_error: "Data obrigatória" }),
});

type QuickFormData = z.infer<typeof quickSchema>;

type TipoLancamento = "receita" | "despesa";

// ---------- props ----------

interface QuickLancamentoDialogProps {
  children: ReactNode;
  /** Abre o LancamentoFormDialog completo quando o usuário clica em "Adicionar detalhes" */
  onOpenFullForm?: (tipo: TipoLancamento) => void;
}

// ---------- componente ----------

export function QuickLancamentoDialog({ children, onOpenFullForm }: QuickLancamentoDialogProps) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<TipoLancamento>("despesa");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<QuickFormData>({
    resolver: zodResolver(quickSchema),
    defaultValues: {
      descricao: "",
      valor: "",
      data: new Date(),
    },
  });

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrencyInput(e.target.value);
    form.setValue("valor", formatted, { shouldValidate: true });
  };

  const handleSave = async (data: QuickFormData) => {
    setSaving(true);
    try {
      const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
      if (!empresaId) throw new Error("Usuário sem empresa");

      const dataStr = format(data.data, "yyyy-MM-dd");
      const valorNum = parseCurrencyString(data.valor);
      const table = tipo === "receita" ? "receitas" : "despesas";

      const payload =
        tipo === "receita"
          ? {
              descricao: data.descricao,
              valor: valorNum,
              data_vencimento: dataStr,
              status: "Pendente",
              empresa_id: empresaId,
            }
          : {
              descricao: data.descricao,
              valor: valorNum,
              data_vencimento: dataStr,
              status: "Pendente",
              empresa_id: empresaId,
            };

      const { error } = await supabase.from(table as "receitas").insert(payload as never);
      if (error) throw new Error(error.message);

      toast.success(`${tipo === "receita" ? "Receita" : "Despesa"} criada com sucesso`);
      await queryClient.invalidateQueries({ queryKey: ["finance-data"] });
      await queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
      form.reset({ descricao: "", valor: "", data: new Date() });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar lançamento");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenFullForm = () => {
    setOpen(false);
    onOpenFullForm?.(tipo);
  };

  return (
    <>
      <span onClick={() => setOpen(true)}>{children}</span>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              Lançamento Rápido
            </DialogTitle>
            <DialogDescription>Registre um lançamento em segundos. Campos opcionais podem ser adicionados depois.</DialogDescription>
          </DialogHeader>

          {/* Toggle tipo */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setTipo("despesa")}
              className={cn(
                "flex-1 py-2 text-sm font-medium transition-colors",
                tipo === "despesa"
                  ? "bg-red-50 text-red-700 border-r border-border"
                  : "bg-white text-muted-foreground hover:bg-muted/50 border-r border-border"
              )}
            >
              Despesa
            </button>
            <button
              type="button"
              onClick={() => setTipo("receita")}
              className={cn(
                "flex-1 py-2 text-sm font-medium transition-colors",
                tipo === "receita"
                  ? "bg-green-50 text-green-700"
                  : "bg-white text-muted-foreground hover:bg-muted/50"
              )}
            >
              Receita
            </button>
          </div>

          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
            {/* Descrição */}
            <div className="space-y-1.5">
              <Label htmlFor="ql-descricao">Descrição</Label>
              <Input
                id="ql-descricao"
                placeholder="Ex: Combustível, Honorários..."
                {...form.register("descricao")}
              />
              {form.formState.errors.descricao && (
                <p className="text-xs text-destructive">{form.formState.errors.descricao.message}</p>
              )}
            </div>

            {/* Valor */}
            <div className="space-y-1.5">
              <Label htmlFor="ql-valor">Valor</Label>
              <Input
                id="ql-valor"
                inputMode="numeric"
                placeholder="R$ 0,00"
                value={form.watch("valor")}
                onChange={handleValorChange}
              />
              {form.formState.errors.valor && (
                <p className="text-xs text-destructive">{form.formState.errors.valor.message}</p>
              )}
            </div>

            {/* Data */}
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !form.watch("data") && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.watch("data")
                      ? format(form.watch("data"), "dd/MM/yyyy", { locale: ptBR })
                      : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={form.watch("data")}
                    onSelect={(d) => d && form.setValue("data", d, { shouldValidate: true })}
                    locale={ptBR}
                    autoFocus
                  />
                </PopoverContent>
              </Popover>
              {form.formState.errors.data && (
                <p className="text-xs text-destructive">{form.formState.errors.data.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-xs text-muted-foreground"
                onClick={handleOpenFullForm}
              >
                Adicionar detalhes →
              </Button>

              <Button
                type="submit"
                disabled={saving}
                className={cn(
                  tipo === "receita"
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-red-600 hover:bg-red-700 text-white"
                )}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar rápido"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------- FAB mobile ----------

interface FloatingQuickAddProps {
  onOpenFullForm?: (tipo: TipoLancamento) => void;
}

export function FloatingQuickAdd({ onOpenFullForm }: FloatingQuickAddProps) {
  return (
    <QuickLancamentoDialog onOpenFullForm={onOpenFullForm}>
      <button
        type="button"
        className="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand shadow-lg hover:bg-brand/90 transition-colors sm:hidden"
        aria-label="Lançamento rápido"
      >
        <Plus className="h-6 w-6 text-ink" />
      </button>
    </QuickLancamentoDialog>
  );
}
